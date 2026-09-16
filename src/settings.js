const $ = (id) => document.getElementById(id);

const interval = $('interval');
const intervalVal = $('intervalVal');
const startHour = $('startHour');
const endHour = $('endHour');
const dailyGoal = $('dailyGoal');
const snooze = $('snooze');
const position = $('position');
const sound = $('sound');
const launch = $('launch');
const goalBanner = $('goalBanner');
const saved = $('saved');

function hourLabel(h) {
  const period = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${period}`;
}

function fillHours(sel) {
  for (let h = 0; h < 24; h++) {
    const opt = document.createElement('option');
    opt.value = String(h);
    opt.textContent = hourLabel(h);
    sel.appendChild(opt);
  }
}
fillHours(startHour);
fillHours(endHour);

interval.addEventListener('input', () => {
  intervalVal.textContent = `${interval.value} min`;
});

async function load() {
  const cfg = await window.waterBuddy.getConfig();
  interval.value = cfg.intervalMinutes;
  intervalVal.textContent = `${cfg.intervalMinutes} min`;
  startHour.value = String(cfg.activeStartHour);
  endHour.value = String(cfg.activeEndHour);
  dailyGoal.value = cfg.dailyGoal;
  snooze.value = cfg.snoozeMinutes;
  position.value = cfg.position;
  sound.checked = cfg.soundEnabled;
  launch.checked = cfg.launchAtLogin;
  goalBanner.textContent = `${cfg.glassesToday} / ${cfg.dailyGoal} glasses today`;
}

$('save').addEventListener('click', async () => {
  const patch = {
    intervalMinutes: clamp(+interval.value, 1, 720),
    activeStartHour: +startHour.value,
    activeEndHour: +endHour.value,
    dailyGoal: clamp(+dailyGoal.value, 1, 30),
    snoozeMinutes: clamp(+snooze.value, 1, 120),
    position: position.value,
    soundEnabled: sound.checked,
    launchAtLogin: launch.checked,
  };
  const cfg = await window.waterBuddy.setConfig(patch);
  goalBanner.textContent = `${cfg.glassesToday} / ${cfg.dailyGoal} glasses today`;
  saved.textContent = 'Saved ✓';
  setTimeout(() => (saved.textContent = ''), 1800);
});

function clamp(n, lo, hi) {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

load();
