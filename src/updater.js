// Auto-update via electron-updater + GitHub Releases. Only runs in packaged
// builds; silently no-ops in dev or if the update feed is missing.
const { app, Notification } = require('electron');

function initAutoUpdate() {
  if (!app.isPackaged) return; // no updates in `npm start`
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    console.error('[updater] electron-updater not installed:', err);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => console.error('[updater] error:', err));
  autoUpdater.on('update-available', (info) => {
    console.log('[updater] update available:', info.version);
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (Notification.isSupported()) {
      new Notification({
        title: 'Sipling update ready 🌱',
        body: `v${info.version} will be installed next time you quit.`,
      }).show();
    }
  });

  // Check now, then every 6 hours.
  autoUpdater.checkForUpdates().catch((e) => console.error('[updater]', e));
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((e) => console.error('[updater]', e));
  }, 6 * 60 * 60 * 1000);
}

module.exports = { initAutoUpdate };
