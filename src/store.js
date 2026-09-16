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
  launchAtLogin: true,
  position: 'bottom-right', // corner the avatar appears in
  dailyGoal: 8, // glasses per day
  snoozeMinutes: 10,
  // runtime counters, reset each day
  glassesToday: 0,
  lastResetDate: '', // YYYY-MM-DD
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(configPath(), 'utf-8');
    cache = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    cache = { ...DEFAULTS };
  }
  // Roll over the daily counter if it's a new day.
  const today = todayKey();
  if (cache.lastResetDate !== today) {
    cache.glassesToday = 0;
    cache.lastResetDate = today;
    save(cache);
  }
  return cache;
}

function save(next) {
  cache = { ...load(), ...next };
  try {
    fs.writeFileSync(configPath(), JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save config:', err);
  }
  return cache;
}

function get(key) {
  return load()[key];
}

module.exports = { load, save, get, DEFAULTS, configPath };
