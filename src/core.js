// Shared game state, helpers, input and sound.

export const G = {
  mode: 'title',          // title | play | dialogue | menu | dead | duel
  time: 7.5, day: 1, timeScale: 1, combatT: 99,
  actors: [], interactables: [],
  money: 3, honor: 0, inv: {}, weaponsOwned: { revolver: true },
  stats: { kills: 0, hunted: 0, fish: 0, cooked: 0 },
  bounty: null,
  settings: { music: true, sens: 1 },
  scene: null, camera: null, renderer: null,
  player: null, horse: null, law: null, story: null, ui: null, weather: null,
};

// ---------- maths ----------
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export function angDiff(a, b) { return ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; }
export function angLerp(a, b, t) { return a + angDiff(a, b) * clamp(t, 0, 1); }
export function angApproach(a, b, step) { const d = angDiff(a, b); return a + clamp(d, -step, step); }
export function approach(a, b, step) { return a < b ? Math.min(b, a + step) : Math.max(b, a - step); }
export const fmt = (n) => '$' + n.toFixed(2);

// ---------- items and weapons ----------
export const ITEMS = {
  jerky: { name: 'Venison Jerky', desc: 'Tough, salty, keeps for months.', use: { hunger: 25, hp: 8 } },
  beans: { name: 'Canned Beans', desc: 'A proper trail supper.', use: { hunger: 38, hp: 10 } },
  bread: { name: 'Sourdough Loaf', desc: 'Baked this morning.', use: { hunger: 20 } },
  apple: { name: 'Apple', desc: 'You or your horse will enjoy it.', use: { hunger: 8, hp: 3 }, horse: true },
  oats: { name: 'Bag of Oats', desc: 'Horse feed. Restores stamina and builds trust.', horse: true },
  cookedMeat: { name: 'Flame-Cooked Meat', desc: 'Restores a great deal.', sell: 1.5, use: { hunger: 50, hp: 30, stamina: 30 } },
  cookedFish: { name: 'Pan-Fried Fish', desc: 'Crisp skin, river fresh.', sell: 1.2, use: { hunger: 38, hp: 22 } },
  rawMeat: { name: 'Raw Game Meat', desc: 'Cook it at a campfire.', sell: 1 },
  fish: { name: 'Fresh Fish', desc: 'Cook it at a campfire.', sell: 1.5 },
  deerPelt: { name: 'Deer Pelt', desc: 'Tobias pays for good hides.', sell: 6 },
  wolfPelt: { name: 'Wolf Pelt', desc: 'Thick and grey.', sell: 9 },
  rabbitPelt: { name: 'Rabbit Pelt', desc: 'Soft, small.', sell: 2.5 },
  cowHide: { name: 'Cow Hide', desc: 'Somebody is missing this.', sell: 4 },
  tonic: { name: 'Health Tonic', desc: 'Fully restores health.', use: { hp: 100 } },
  bitters: { name: 'Stamina Bitters', desc: 'Fully restores stamina.', use: { stamina: 100 } },
  elixir: { name: 'Nerve Elixir', desc: 'Fully restores focus.', use: { focus: 100 } },
  whiskey: { name: 'Rye Whiskey', desc: 'Steadies the hand, sours the gut.', use: { focus: 25, hp: -4 } },
  revolverAmmo: { name: 'Revolver Cartridges', desc: 'For your sidearm.' },
  rifleAmmo: { name: 'Rifle Cartridges', desc: 'For the repeater.' },
  arrows: { name: 'Arrows', desc: 'Quiet. Good for hunting.' },
  fishingRod: { name: 'Fishing Rod', desc: 'Cast a line at the Sorrel River.' },
  ledger: { name: "Thorne's Ledger", desc: 'Every dollar the company ever moved.' },
  payChit: { name: 'Pay Chit', desc: 'Dated the night of the fire.' },
};

export const WEAPONS = {
  none: { name: 'Fists' },
  revolver: { name: 'Revolver', dmg: 36, clip: 6, rate: 0.36, reload: 1.7, range: 95, ammo: 'revolverAmmo', loud: true, spread: 0.01, fov: 46 },
  rifle: { name: 'Repeater Rifle', dmg: 78, clip: 5, rate: 0.85, reload: 2.3, range: 230, ammo: 'rifleAmmo', loud: true, spread: 0.004, fov: 30 },
  bow: { name: 'Hunting Bow', dmg: 70, clip: 1, rate: 0.5, reload: 0.7, range: 75, ammo: 'arrows', loud: false, spread: 0.008, fov: 42 },
};

export function addItem(id, n = 1) { G.inv[id] = (G.inv[id] || 0) + n; if (G.inv[id] <= 0) delete G.inv[id]; }
export const count = (id) => G.inv[id] || 0;
export function addMoney(n) { G.money = Math.max(0, Math.round((G.money + n) * 100) / 100); }
export function addHonor(n) { G.honor = clamp(G.honor + n, -100, 100); }
export function honorLabel() {
  const h = G.honor;
  return h <= -60 ? 'Feared Outlaw' : h <= -20 ? 'Scoundrel' : h < 20 ? 'Drifter' : h < 60 ? 'Good Hand' : 'Folk Hero';
}

// ---------- input ----------
export const keys = Object.create(null);
const pressed = new Set();
export const mouse = { dx: 0, dy: 0, left: false, right: false, clicked: false, locked: false };
export const wasPressed = (c) => pressed.has(c);
export const consume = (c) => pressed.delete(c);
export function endFrame() { pressed.clear(); mouse.dx = 0; mouse.dy = 0; mouse.clicked = false; }

export function requestLock() {
  const c = G.renderer && G.renderer.domElement;
  if (!c || document.pointerLockElement === c) return;
  try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
}
export function releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (['Tab', 'Space', 'F5', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys[e.code] = true;
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.left = mouse.right = false; });
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
  });
  canvas.addEventListener('mousedown', (e) => {
    initAudio();
    if ((G.mode === 'play' || G.mode === 'duel' || G.mode === 'dialogue') && document.pointerLockElement !== canvas) {
      requestLock();
      if (G.mode === 'play') return;           // first click only captures the mouse
    }
    if (e.button === 0) { mouse.left = true; mouse.clicked = true; }
    if (e.button === 2) mouse.right = true;
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) mouse.left = false; if (e.button === 2) mouse.right = false; });
  addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    mouse.locked = document.pointerLockElement === canvas;
    if (!mouse.locked) { mouse.left = mouse.right = false; if (G.mode === 'play' && G.ui) G.ui.openPause(); }
  });
}

// ---------- sound (all synthesised, no audio files) ----------
let ac = null, master = null, noiseBuf = null, windGain = null, rainGain = null;
export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const loop = (freq, type) => {
      const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.6;
      const g = ac.createGain(); g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(master); s.start();
      return g;
    };
    windGain = loop(380, 'bandpass');
    rainGain = loop(2600, 'highpass');
  } catch (e) { ac = null; }
}
function noise(dur, freq, vol, type = 'lowpass', q = 0.8) {
  if (!ac) return;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); const t = ac.currentTime;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function tone(freq, dur, vol, type = 'sine', slideTo = 0, delay = 0) {
  if (!ac) return;
  const o = ac.createOscillator(); o.type = type; const t = ac.currentTime + delay;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
export const sfx = {
  shot(v = 1, heavy = false) { noise(heavy ? 0.4 : 0.28, heavy ? 900 : 1500, 0.9 * v); tone(heavy ? 85 : 130, 0.2, 0.5 * v, 'triangle', 38); },
  bow() { tone(320, 0.14, 0.2, 'triangle', 110); noise(0.09, 3200, 0.08, 'highpass'); },
  step() { noise(0.06, 520, 0.06); },
  hoof(v = 1) { noise(0.05, 300, 0.16 * v, 'lowpass', 2); },
  click() { tone(620, 0.05, 0.08, 'square'); },
  coin() { tone(1250, 0.09, 0.12); tone(1680, 0.14, 0.12, 'sine', 0, 0.07); },
  whistle() { tone(1300, 0.16, 0.16, 'sine', 2100); tone(2100, 0.25, 0.16, 'sine', 1500, 0.17); },
  hurt() { tone(170, 0.18, 0.3, 'sawtooth', 80); },
  punch() { noise(0.09, 380, 0.45); },
  thunder() { noise(2.6, 170, 0.9, 'lowpass', 0.4); },
  reload() { tone(900, 0.03, 0.08, 'square'); tone(700, 0.03, 0.08, 'square', 0, 0.12); },
  good() { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.5, 0.1, 'triangle', 0, i * 0.11)); },
  bad() { tone(220, 0.4, 0.14, 'sawtooth', 110); },
  chirp() { tone(4200, 0.04, 0.02, 'sine'); tone(4200, 0.04, 0.02, 'sine', 0, 0.07); },
  howl() { tone(380, 1.4, 0.07, 'sine', 620); },
};

// A sparse plucked melody in a minor pentatonic, generated on the fly.
const SCALE = [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 293.66, 329.63, 392];
let noteT = 4, noteI = 4, phraseLeft = 0, restT = 3, chirpT = 2;
function pluck(freq, vol) {
  tone(freq, 1.6, vol, 'triangle');
  tone(freq * 2.003, 0.7, vol * 0.35, 'sine');
}
export function updateAudio(dt) {
  if (!ac) return;
  const w = G.weather || { rain: 0, dust: 0 };
  const targetWind = 0.025 + w.dust * 0.12 + w.rain * 0.03 + Math.sin(performance.now() / 4000) * 0.012;
  windGain.gain.value += (targetWind - windGain.gain.value) * Math.min(1, dt * 2);
  rainGain.gain.value += (w.rain * 0.07 - rainGain.gain.value) * Math.min(1, dt * 2);
  if (G.mode === 'title' || G.mode === 'play' || G.mode === 'dialogue') {
    const night = G.time > 20.5 || G.time < 5;
    if (night && w.rain < 0.3) { chirpT -= dt; if (chirpT <= 0) { sfx.chirp(); chirpT = rand(0.3, 1.6); } }
    if (!G.settings.music) return;
    if (phraseLeft <= 0) { restT -= dt; if (restT <= 0) { phraseLeft = 5 + Math.floor(rand(7)); restT = rand(7, 16); } return; }
    noteT -= dt;
    if (noteT <= 0) {
      noteI = clamp(noteI + pick([-2, -1, -1, 1, 1, 2]), 0, SCALE.length - 1);
      pluck(SCALE[noteI], G.combatT < 6 ? 0.03 : 0.055);
      if (Math.random() < 0.3) pluck(SCALE[Math.max(0, noteI - 4)] / 2, 0.05);
      noteT = pick([0.32, 0.32, 0.64, 0.64, 0.96]);
      phraseLeft--;
    }
  }
}
