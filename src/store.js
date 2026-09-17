// Tiny dependency-free JSON store persisted in the app's userData folder.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

let _configPath = null;
function configPath() {
  if (!_configPath) {
    _configPath = path.join(app.getPath('userData'), 'sipling-config.json');
  }
  return _configPath;
}

const DEFAULTS = {
  intervalMinutes: 60, // how often to remind
  activeStartHour: 9, // 24h, reminders only fire between start and end
  activeEndHour: 22,
  soundEnabled: true,
  soundName: 'cute-twinkle', // which notification sound to play
  launchAtLogin: true,
  position: 'bottom-right', // corner the avatar appears in
  dailyGoal: 8, // glasses per day
  snoozeMinutes: 10,
  launchedBefore: false, // set true after the first launch (gates the intro window)
  // runtime counters, reset each day
  glassesToday: 0,
  lastResetDate: '', // YYYY-MM-DD
};

const POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];

// Local calendar date (YYYY-MM-DD). Uses local getters, not toISOString(), so the
// daily counter resets at the user's midnight rather than UTC midnight.
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function intIn(value, lo, hi, fallback) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

function boolOr(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

// Coerce/clamp every field so a corrupt or hand-edited config can't produce a
// tight reminder loop, a schedule that never fires, or a broken overlay.
function sanitize(cfg) {
  return {
    ...cfg,
    intervalMinutes: intIn(cfg.intervalMinutes, 1, 720, DEFAULTS.intervalMinutes),
    activeStartHour: intIn(cfg.activeStartHour, 0, 23, DEFAULTS.activeStartHour),
    activeEndHour: intIn(cfg.activeEndHour, 0, 23, DEFAULTS.activeEndHour),
    dailyGoal: intIn(cfg.dailyGoal, 1, 30, DEFAULTS.dailyGoal),
    snoozeMinutes: intIn(cfg.snoozeMinutes, 1, 120, DEFAULTS.snoozeMinutes),
    glassesToday: intIn(cfg.glassesToday, 0, 9999, 0),
    position: POSITIONS.includes(cfg.position) ? cfg.position : DEFAULTS.position,
    soundName:
      typeof cfg.soundName === 'string' && cfg.soundName ? cfg.soundName : DEFAULTS.soundName,
    soundEnabled: boolOr(cfg.soundEnabled, DEFAULTS.soundEnabled),
    launchAtLogin: boolOr(cfg.launchAtLogin, DEFAULTS.launchAtLogin),
    launchedBefore: boolOr(cfg.launchedBefore, DEFAULTS.launchedBefore),
    lastResetDate: typeof cfg.lastResetDate === 'string' ? cfg.lastResetDate : '',
  };
}

let cache = null;

function persist() {
  try {
    fs.writeFileSync(configPath(), JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save config:', err);
  }
}

function load() {
  if (!cache) {
    try {
      const raw = fs.readFileSync(configPath(), 'utf-8');
      cache = sanitize({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      cache = { ...DEFAULTS };
    }
  }
  // Roll the daily counter over on every access, so an app left running past
  // local midnight still resets rather than only resetting on restart.
  const today = todayKey();
  if (cache.lastResetDate !== today) {
    cache.glassesToday = 0;
    cache.lastResetDate = today;
    persist();
  }
  return cache;
}

function save(next) {
  load();
  cache = sanitize({ ...cache, ...next });
  persist();
  return cache;
}

function get(key) {
  return load()[key];
}

module.exports = { load, save, get, DEFAULTS, configPath };
