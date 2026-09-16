const buddy = document.getElementById('buddy');
const bubbleMain = document.getElementById('bubbleMain');
const bubbleSub = document.getElementById('bubbleSub');
const avatarWrap = document.getElementById('avatarWrap');
const progress = document.getElementById('progress');
const ding = document.getElementById('ding');

const MESSAGES = [
  ['Time to drink some water! 💧', "Stay hydrated, you've got this."],
  ['Hey! Hydration break 🥤', 'Your body will thank you.'],
  ['Sip sip hooray! 💦', 'A quick glass keeps you sharp.'],
  ["Water o'clock! ⏰", 'Even a few sips count.'],
  ['Feeling thirsty yet? 🌊', 'Refill and refresh.'],
];

const ENTER_MS = 950; // keep in sync with the CSS transform transition
let autoHideTimer = null;
let interactive = false;
let busy = false; // true while entering/leaving so we ignore re-triggers

function setInteractive(on) {
  if (on === interactive) return;
  interactive = on;
  window.waterBuddy.setInteractive(on);
}

// While resting, only the buddy's own rectangle should capture the mouse; the
// rest of the (fullscreen) overlay stays click-through. The main process forwards
// mousemove even when click-through, so we hit-test here and toggle accordingly.
function onMouseMove(e) {
  if (buddy.dataset.state !== 'resting') return;
  const r = buddy.getBoundingClientRect();
  const pad = 8;
  const inside =
    e.clientX >= r.left - pad &&
    e.clientX <= r.right + pad &&
    e.clientY >= r.top - pad &&
    e.clientY <= r.bottom + pad;
  setInteractive(inside);
}
window.addEventListener('mousemove', onMouseMove);

function pickMessage() {
  const [main, sub] = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  bubbleMain.textContent = main;
  bubbleSub.textContent = sub;
}

function renderAvatar(avatar) {
  avatarWrap.innerHTML = '';
  if (!avatar) {
    const el = document.createElement('div');
    el.className = 'emoji-buddy';
    el.textContent = '🧑‍🚀';
    avatarWrap.appendChild(el);
    return;
  }
  if (avatar.type === 'mp4' || avatar.type === 'webm') {
    const v = document.createElement('video');
    v.src = avatar.url;
    v.autoplay = true;
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    avatarWrap.appendChild(v);
    v.play().catch(() => {});
  } else {
    const img = document.createElement('img');
    img.src = avatar.url;
    avatarWrap.appendChild(img);
  }
}

function reflow() {
  // Force the browser to apply the "off" position before we transition to "on".
  void buddy.offsetWidth;
}

function enter(payload) {
  if (busy) return;
  busy = true;

  pickMessage();
  renderAvatar(payload.avatar);
  progress.textContent = `${payload.glassesToday} / ${payload.dailyGoal} glasses today`;
  buddy.dataset.corner = payload.position || 'bottom-right';

  // Place off-screen instantly (no transition), then walk in.
  buddy.classList.remove('on', 'resting', 'walking');
  buddy.classList.add('off');
  buddy.dataset.state = 'entering';
  buddy.style.visibility = 'visible';
  buddy.style.opacity = '1';
  reflow();

  buddy.classList.add('walking');
  buddy.classList.remove('off');
  buddy.classList.add('on');

  if (payload.soundEnabled) ding.play().catch(() => {});

  setTimeout(() => {
    buddy.classList.remove('walking');
    buddy.classList.add('resting');
    buddy.dataset.state = 'resting';
    busy = false;
  }, ENTER_MS);

  if (autoHideTimer) clearTimeout(autoHideTimer);
  autoHideTimer = setTimeout(() => leave(() => window.waterBuddy.dismiss()), 30000);
}

function leave(cb) {
  if (buddy.dataset.state === 'idle') {
    cb && cb();
    return;
  }
  busy = true;
  if (autoHideTimer) clearTimeout(autoHideTimer);
  setInteractive(false);
  buddy.dataset.state = 'leaving';
  buddy.classList.remove('resting');
  buddy.classList.add('walking');
  buddy.classList.remove('on');
  buddy.classList.add('off');

  setTimeout(() => {
    buddy.classList.remove('walking');
    buddy.style.visibility = 'hidden';
    buddy.style.opacity = '0';
    buddy.dataset.state = 'idle';
    busy = false;
    cb && cb();
  }, ENTER_MS);
}

document.getElementById('drink').addEventListener('click', () =>
  leave(() => window.waterBuddy.drank())
);
document.getElementById('snooze').addEventListener('click', () =>
  leave(() => window.waterBuddy.snooze())
);

window.waterBuddy.onReminderShow(enter);
