const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  screen,
  nativeImage,
  Notification,
} = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./store');
const { initAutoUpdate } = require('./updater');

let tray = null;
let overlay = null; // persistent fullscreen, transparent, click-through window
let overlayReady = false;
let pendingReminder = null;
let settingsWindow = null;
let reminderTimer = null;

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Keep the app out of the macOS dock — it lives in the tray/menu bar.
if (process.platform === 'darwin' && app.dock) {
  app.dock.hide();
}

// ---------- Avatar discovery ----------
// Pick whatever the user dropped into assets/: prefer video, fall back to gif/png.
function findAvatar() {
  const candidates = [
    'avatar.webm',
    'avatar.mp4',
    'avatar.gif',
    'avatar.png',
    'avatar.jpg',
  ];
  for (const name of candidates) {
    const p = path.join(ASSETS_DIR, name);
    if (fs.existsSync(p)) {
      return { path: p, type: name.split('.').pop().toLowerCase() };
    }
  }
  return null;
}

// ---------- Scheduling ----------
function isWithinActiveHours() {
  const cfg = store.load();
  const hour = new Date().getHours();
  const { activeStartHour: start, activeEndHour: end } = cfg;
  if (start === end) return true; // always active
  if (start < end) return hour >= start && hour < end;
  // wraps past midnight (e.g. 22 -> 6)
  return hour >= start || hour < end;
}

function scheduleNextReminder() {
  if (reminderTimer) clearTimeout(reminderTimer);
  const cfg = store.load();
  const ms = Math.max(1, cfg.intervalMinutes) * 60 * 1000;
  reminderTimer = setTimeout(() => {
    if (isWithinActiveHours()) {
      showReminder();
    }
    scheduleNextReminder();
  }, ms);
}

function snooze() {
  if (reminderTimer) clearTimeout(reminderTimer);
  const cfg = store.load();
  const ms = Math.max(1, cfg.snoozeMinutes) * 60 * 1000;
  reminderTimer = setTimeout(() => {
    if (isWithinActiveHours()) showReminder();
    scheduleNextReminder();
  }, ms);
}

// ---------- Overlay window ----------
// A single, permanent, fullscreen, transparent, click-through window that the
// buddy is drawn into. It is never shown/hidden per reminder — a reminder just
// triggers the walk-in animation inside it. Toggling a transparent window's
// visibility on macOS causes flicker and focus bugs, so we avoid it.
function createOverlayWindow() {
  const { bounds } = screen.getPrimaryDisplay();
  overlay = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: process.platform === 'win32',
    focusable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  // Float above app windows on every space, including fullscreen apps.
  overlay.setAlwaysOnTop(true, 'screen-saver');
  if (typeof overlay.setVisibleOnAllWorkspaces === 'function') {
    overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  // Click-through by default; the renderer flips this on only over the buddy.
  overlay.setIgnoreMouseEvents(true, { forward: true });

  // Surface renderer-side errors in the main log (helps debugging in dev/packaged).
  overlay.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) console.error('[overlay]', message);
  });

  overlay.webContents.on('did-finish-load', () => {
    overlayReady = true;
    if (pendingReminder) {
      overlay.webContents.send('reminder:show', pendingReminder);
      pendingReminder = null;
    }
  });

  overlay.loadFile(path.join(__dirname, 'overlay.html'));
  overlay.on('closed', () => {
    overlay = null;
    overlayReady = false;
  });
  overlay.showInactive();
  return overlay;
}

function showReminder() {
  if (!overlay || overlay.isDestroyed()) createOverlayWindow();

  const avatar = findAvatar();
  const cfg = store.load();
  const payload = {
    avatar: avatar ? { url: 'file://' + avatar.path, type: avatar.type } : null,
    glassesToday: cfg.glassesToday,
    dailyGoal: cfg.dailyGoal,
    soundEnabled: cfg.soundEnabled,
    position: cfg.position,
  };

  // Re-fit to the display the cursor is on, and re-assert the layer.
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  overlay.setBounds(display.bounds);
  overlay.setAlwaysOnTop(true, 'screen-saver');

  if (overlayReady) {
    overlay.webContents.send('reminder:show', payload);
  } else {
    pendingReminder = payload;
  }
}

function openSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 460,
    height: 640,
    title: 'Sipling — Settings',
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  settingsWindow.on('closed', () => (settingsWindow = null));
}

// ---------- Tray ----------
function buildTrayIcon() {
  // Prefer the generated black template drop (auto-adapts to light/dark menu bar
  // on macOS). createFromPath picks up the @2x variant automatically.
  const templatePath = path.join(ASSETS_DIR, 'trayTemplate.png');
  if (fs.existsSync(templatePath)) {
    const img = nativeImage.createFromPath(templatePath);
    if (!img.isEmpty()) {
      if (process.platform === 'darwin') img.setTemplateImage(true);
      return img;
    }
  }
  // Fallback: a tiny blue water-drop drawn as a data URL.
  const drop =
    'data:image/svg+xml;base64,' +
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path d="M9 1C9 1 3.5 7.5 3.5 11a5.5 5.5 0 0 0 11 0C14.5 7.5 9 1 9 1z" fill="#3BA7F0"/></svg>`
    ).toString('base64');
  return nativeImage.createFromDataURL(drop);
}

function refreshTrayMenu() {
  if (!tray) return;
  const cfg = store.load();
  const menu = Menu.buildFromTemplate([
    { label: `💧 ${cfg.glassesToday} / ${cfg.dailyGoal} glasses today`, enabled: false },
    { type: 'separator' },
    { label: 'Remind me now', click: () => showReminder() },
    { label: 'I drank a glass  +1', click: () => logGlass() },
    { type: 'separator' },
    { label: 'Settings…', click: () => openSettings() },
    { type: 'separator' },
    { label: 'Quit Sipling', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(`Sipling — ${cfg.glassesToday}/${cfg.dailyGoal} glasses`);
}

function logGlass() {
  const cfg = store.load();
  const next = store.save({ glassesToday: (cfg.glassesToday || 0) + 1 });
  refreshTrayMenu();
  if (next.glassesToday === next.dailyGoal && Notification.isSupported()) {
    new Notification({
      title: 'Sipling',
      body: `🎉 You hit your goal of ${next.dailyGoal} glasses today!`,
    }).show();
  }
  return next;
}

// ---------- IPC ----------
ipcMain.handle('config:get', () => store.load());
ipcMain.handle('config:set', (_e, patch) => {
  const next = store.save(patch);
  applyLaunchAtLogin();
  scheduleNextReminder();
  refreshTrayMenu();
  return next;
});
ipcMain.on('reminder:drank', () => logGlass());
ipcMain.on('reminder:snooze', () => snooze());
ipcMain.on('reminder:dismiss', () => {
  /* the buddy walks off on its own; nothing to do here */
});
ipcMain.on('overlay:interactive', (_e, on) => {
  if (overlay && !overlay.isDestroyed()) {
    overlay.setIgnoreMouseEvents(!on, { forward: true });
  }
});

function applyLaunchAtLogin() {
  const cfg = store.load();
  try {
    app.setLoginItemSettings({ openAtLogin: !!cfg.launchAtLogin });
  } catch {
    /* not supported everywhere */
  }
}

// ---------- Lifecycle ----------
// Safety nets: never let a stray error tear the background app down.
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  // Relaunching Sipling (second launch) reopens the settings window.
  app.on('second-instance', () => openSettings());

  app.whenReady().then(() => {
    createOverlayWindow();
    tray = new Tray(buildTrayIcon());
    refreshTrayMenu();
    tray.on('click', () => refreshTrayMenu());

    applyLaunchAtLogin();
    scheduleNextReminder();
    initAutoUpdate();

    // Dev helper: fire a reminder shortly after launch for quick visual testing.
    if (process.env.SIPLING_TEST_REMINDER) {
      setTimeout(() => showReminder(), 1500);
    }

    // Friendly first-run nudge.
    if (Notification.isSupported()) {
      new Notification({
        title: 'Sipling is here 🌱💧',
        body: 'I live in your menu bar. I\'ll pop by when it\'s time to hydrate.',
      }).show();
    }
  });

  app.on('window-all-closed', (e) => {
    // Tray app: don't quit when windows close.
    e.preventDefault?.();
  });
}
