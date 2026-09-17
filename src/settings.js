const $ = (id) => document.getElementById(id);

const interval = $('interval');
const intervalVal = $('intervalVal');
const startHour = $('startHour');
const endHour = $('endHour');
const dailyGoal = $('dailyGoal');
const snooze = $('snooze');
const position = $('position');
const sound = $('sound');
const soundName = $('soundName');
const previewSound = $('previewSound');
const soundPreview = $('soundPreview');
const launch = $('launch');

// Keep in sync with SOUND_FILES in main.js.
const SOUNDS = [
  { key: 'cute-twinkle', label: 'Cute Twinkle', file: 'cute-twinkle.wav' },
  { key: 'positive-twinkle', label: 'Positive Twinkle', file: 'positive-twinkle.wav' },
  { key: 'double-tone', label: 'Double Tone', file: 'double-tone.wav' },
];
for (const s of SOUNDS) {
  const opt = document.createElement('option');
  opt.value = s.key;
  opt.textContent = s.label;
  soundName.appendChild(opt);
}

function soundFileFor(key) {
  const s = SOUNDS.find((x) => x.key === key) || SOUNDS[0];
  return `../assets/notification/${s.file}`;
}

function playPreview() {
  soundPreview.src = soundFileFor(soundName.value);
  soundPreview.currentTime = 0;
  previewSound.classList.add('playing');
  soundPreview.play().catch(() => previewSound.classList.remove('playing'));
}
previewSound.addEventListener('click', playPreview);
// Auto-preview when picking a sound, but only if sounds are enabled — so it
// doesn't blast audio the user turned off while they arrow through the options.
soundName.addEventListener('change', () => {
  if (sound.checked) playPreview();
});
soundPreview.addEventListener('ended', () => previewSound.classList.remove('playing'));
const countNow = $('countNow');
const countGoal = $('countGoal');
const waterFill = $('waterFill');
const cadenceHint = $('cadenceHint');
const addGlass = $('addGlass');
const saved = $('saved');

function hourLabel(h) {
  const period = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${period}`;
}

function humanInterval(min) {
  if (min < 60) return `Every ${min} minutes`;
  if (min === 60) return 'Every hour';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `Every ${h} hours`;
  return `Every ${h}h ${m}m`;
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

function updateIntervalUI() {
  const v = +interval.value;
  intervalVal.textContent = humanInterval(v);
  const pct = ((v - interval.min) / (interval.max - interval.min)) * 100;
  interval.style.setProperty('--fill', pct + '%');
  updateCadenceHint();
}

function updateCadenceHint() {
  const cadence = humanInterval(+interval.value).toLowerCase();
  const from = hourLabel(+startHour.value);
  const to = hourLabel(+endHour.value);
  cadenceHint.innerHTML = `Reminders <b>${cadence}</b>, between <b>${from}</b> and <b>${to}</b>.`;
}

function updateHydro(now, goal) {
  countNow.textContent = now;
  countGoal.textContent = goal;
  const pct = goal > 0 ? Math.min(100, (now / goal) * 100) : 0;
  waterFill.style.width = pct + '%';
  waterFill.classList.toggle('goal', now >= goal && goal > 0);
}

interval.addEventListener('input', updateIntervalUI);
startHour.addEventListener('change', updateCadenceHint);
endHour.addEventListener('change', updateCadenceHint);

addGlass.addEventListener('click', async () => {
  const cfg = await window.waterBuddy.addGlass();
  updateHydro(cfg.glassesToday, cfg.dailyGoal);
});

async function load() {
  const cfg = await window.waterBuddy.getConfig();
  interval.value = cfg.intervalMinutes;
  startHour.value = String(cfg.activeStartHour);
  endHour.value = String(cfg.activeEndHour);
  dailyGoal.value = cfg.dailyGoal;
  snooze.value = cfg.snoozeMinutes;
  position.value = cfg.position;
  sound.checked = cfg.soundEnabled;
  soundName.value = cfg.soundName || 'cute-twinkle';
  launch.checked = cfg.launchAtLogin;
  updateIntervalUI();
  updateHydro(cfg.glassesToday, cfg.dailyGoal);
}

function clamp(n, lo, hi) {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
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
    soundName: soundName.value,
    launchAtLogin: launch.checked,
  };
  const cfg = await window.waterBuddy.setConfig(patch);
  updateHydro(cfg.glassesToday, cfg.dailyGoal);
  updateCadenceHint();
  saved.classList.add('show');
  setTimeout(() => saved.classList.remove('show'), 1800);
});

load();
