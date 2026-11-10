// The player, their horse, gunplay, interactions and the camera.
import * as THREE from 'three';
import { G, keys, mouse, wasPressed, consume, clamp, lerp, rand, pick, dist2, angLerp, angApproach, approach, sfx, WEAPONS, ITEMS, addItem, count, addMoney, addHonor, fmt } from './core.js';
import { groundHeight, resolveCollision, rayBlocked, fx, inTown, inWater } from './world.js';
import { makeHuman, poseHuman, makeQuad, poseQuad, humanAction, SIT_DROP } from './models.js';
import { rayActors, damageActor, alarm, lootActor, removeActor } from './actors.js';

const fwd = new THREE.Vector3(), right = new THREE.Vector3(), tgt = new THREE.Vector3(), look = new THREE.Vector3();
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();

export function initPlayer() {
  const p = G.player = {
    pos: new THREE.Vector3(-118, 0, 22), vy: 0, onGround: true, heading: Math.PI / 2, yaw: Math.PI / 2, pitch: -0.12,
    hp: 100, stamina: 100, focus: 60, hunger: 80, crouch: false, mounted: false, aiming: false,
    weapon: 'none', clip: { revolver: 6, rifle: 5, bow: 1 }, reloadT: 0, fireT: 0, aimHold: 0,
    alive: true, speed: 0, phase: 0, hurtT: 99, focusOn: false, fishing: null, camDist: 4.6, fov: 60, prompt: null, patT: 0, deadT: 0,
  };
  p.pos.y = groundHeight(p.pos.x, p.pos.z);
  p.model = makeHuman({ skin: 0xd9a066, shirt: 0x9a8468, vest: 0x6b4426, pants: 0x4d4d68, hat: 0x4a3524, coat: 0x7a5c3a, hair: 0x2a1c12 });
  G.scene.add(p.model);
  const h = G.horse = { pos: new THREE.Vector3(-52, 0, -243), heading: 1, speed: 0, stamina: 100, bond: 0, name: 'the mare', owned: false, state: 'idle', phase: 0, calm: 0, saddle: 0 };
  h.pos.y = groundHeight(h.pos.x, h.pos.z);
  h.model = makeQuad('horse', { color: 0x7a4a26, saddle: true });
  G.scene.add(h.model);

  G.hurtPlayer = (dmg, src) => {
    if (!p.alive || G.mode !== 'play') return;
    p.hp -= dmg; p.hurtT = 0; p.lastHitLaw = !!(src && src.faction === 'law');
    G.ui.hurtFlash(); sfx.hurt(); humanAction(p.model, 'hit');
    if (p.fishing) p.fishing = null;
    if (p.hp <= 0) die();
  };
  G.useItem = useItem;
  G.feedHorse = feedHorse;
}

function useItem(id) {
  const p = G.player, it = ITEMS[id];
  if (!it || !it.use || count(id) <= 0) return false;
  const u = it.use;
  if (u.hunger) p.hunger = clamp(p.hunger + u.hunger, 0, 100);
  if (u.hp) p.hp = clamp(p.hp + u.hp, 1, 100);
  if (u.stamina) p.stamina = clamp(p.stamina + u.stamina, 0, 100);
  if (u.focus) p.focus = clamp(p.focus + u.focus, 0, 100);
  addItem(id, -1); sfx.click();
  G.ui.toast(`Used ${it.name}.`);
  return true;
}
function feedHorse(id) {
  const h = G.horse, p = G.player;
  if (!h.owned || count(id) <= 0) return false;
  if (h.pos.distanceTo(p.pos) > 6) { G.ui.toast(`${h.name} is too far away.`); return false; }
  addItem(id, -1); h.stamina = 100; h.bond = clamp(h.bond + (id === 'oats' ? 6 : 3), 0, 100);
  G.ui.toast(`${h.name} crunches happily.`);
  return true;
}

// ---------- weapons ----------
function startReload() {
  const p = G.player, w = WEAPONS[p.weapon];
  if (!w.clip || p.reloadT > 0 || p.clip[p.weapon] >= w.clip) return;
  if (count(w.ammo) <= 0) { G.ui.toast(`Out of ${ITEMS[w.ammo].name.toLowerCase()}.`, 'bad'); return; }
  p.reloadT = w.reload; sfx.reload(); humanAction(p.model, 'reload');
}
function fire() {
  const p = G.player, w = WEAPONS[p.weapon];
  if (p.fireT > 0 || p.reloadT > 0) return;
  if (p.clip[p.weapon] <= 0) { startReload(); return; }
  p.clip[p.weapon]--; p.fireT = w.rate; p.aimHold = 0.6; humanAction(p.model, 'shoot');
  const cam = G.camera, o = cam.position;
  cam.getWorldDirection(v1);
  const sp = w.spread * (p.aiming ? 1 : 3.5) * (p.mounted && G.horse.speed > 6 ? 2 : 1);
  v1.x += rand(-sp, sp); v1.y += rand(-sp, sp); v1.z += rand(-sp, sp); v1.normalize();
  const hit = rayActors(o, v1, w.range + p.camDist), block = rayBlocked(o, v1, w.range + p.camDist);
  const hitT = hit ? hit.t : Infinity, endT = Math.min(hitT, block, w.range + p.camDist);
  v2.copy(o).addScaledVector(v1, endT);
  tgt.set(p.pos.x, p.pos.y + (p.mounted ? 2.2 : 1.45), p.pos.z).addScaledVector(fwd, 0.7);
  fx.tracer(tgt, v2, w.loud ? 0xffe9a0 : 0xd9cdb0);
  if (w.loud) { sfx.shot(1, p.weapon === 'rifle'); fx.puff(tgt, 0xffd27a, 3, 1.2); } else sfx.bow();
  p.pitch = clamp(p.pitch + (p.weapon === 'rifle' ? 0.03 : 0.015), -1.25, 1);
  let justified = G.combatT < 8;
  if (hit && hitT <= block) {
    const a = hit.actor, dmg = w.dmg * (hit.head ? 2.6 : 1) * rand(0.9, 1.1);
    const innocent = a.kind === 'human' ? (a.faction === 'civil' || a.faction === 'vendor' || a.faction === 'law') : a.faction === 'ranch';
    if (innocent) { G.law.report('assault', a.pos); addHonor(-3); }
    const killed = damageActor(a, dmg, { byPlayer: true });
    G.ui.hitMarker(killed, hit.head);
  } else if (block < Infinity) fx.puff(v2, 0x9a8a6a, 4, 1.4);
  if (w.loud) {
    alarm(p.pos, 95);
    if (inTown(p.pos.x, p.pos.z) && !justified) G.law.report('disturb');
  }
}
function punch() {
  const p = G.player;
  if (p.fireT > 0 || p.stamina < 6 || p.mounted) return;
  p.fireT = 0.45; p.stamina -= 6; humanAction(p.model, 'punch');
  let best = null, bd = 2.3;
  for (const a of G.actors) {
    if (!a.alive || a.asleep) continue;
    const d = a.pos.distanceTo(p.pos); if (d > bd) continue;
    const ang = Math.atan2(a.pos.x - p.pos.x, a.pos.z - p.pos.z);
    let df = Math.abs(ang - p.heading) % (Math.PI * 2); if (df > Math.PI) df = Math.PI * 2 - df;
    if (df < 1) { best = a; bd = d; }
  }
  if (!best) return;
  sfx.punch();
  const innocent = best.kind === 'human' && (best.faction === 'civil' || best.faction === 'vendor' || best.faction === 'law');
  if (innocent) { G.law.report('assault', best.pos); addHonor(-2); }
  damageActor(best, 24, { byPlayer: true });
}

// ---------- horse ----------
function mount() { const p = G.player, h = G.horse; p.mounted = true; p.crouch = false; h.state = 'ridden'; p.fishing = null; }
function dismount() {
  const p = G.player, h = G.horse;
  p.mounted = false; h.state = 'idle'; h.speed = 0;
  p.pos.set(h.pos.x - Math.cos(h.heading) * 1.3, 0, h.pos.z + Math.sin(h.heading) * 1.3);
  resolveCollision(p.pos, 0.4); p.pos.y = groundHeight(p.pos.x, p.pos.z); p.vy = 0;
}
function whistle() {
  const p = G.player, h = G.horse;
  if (!h.owned || p.mounted) return;
  sfx.whistle();
  const d = h.pos.distanceTo(p.pos);
  if (d > 230) {            // too far to hear: she turns up from behind instead
    const a = p.yaw + Math.PI + rand(-0.6, 0.6);
    h.pos.set(p.pos.x + Math.sin(a) * 70, 0, p.pos.z + Math.cos(a) * 70);
    resolveCollision(h.pos, 1);
  }
  h.state = 'follow';
}
function updateHorse(dt) {
  const p = G.player, h = G.horse;
  if (p.mounted) {
    const mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const dx = Math.sin(p.yaw) * mz - Math.cos(p.yaw) * mx, dz = Math.cos(p.yaw) * mz + Math.sin(p.yaw) * mx;
    const want = Math.hypot(dx, dz) > 0.1;
    const gallop = (keys.ShiftLeft || keys.ShiftRight) && h.stamina > 1;
    let top = gallop ? 14.5 + h.bond * 0.015 : keys.ControlLeft ? 3 : 8.5;
    if (inWater(h.pos.x, h.pos.z)) top *= 0.5;
    h.speed = approach(h.speed, want ? top : 0, (want ? 6 : 10) * dt);
    if (want) h.heading = angApproach(h.heading, Math.atan2(dx, dz), (2.9 - h.speed * 0.07) * dt);
    const ox = h.pos.x, oz = h.pos.z;
    h.pos.x += Math.sin(h.heading) * h.speed * dt; h.pos.z += Math.cos(h.heading) * h.speed * dt;
    resolveCollision(h.pos, 0.9);
    const r = Math.hypot(h.pos.x, h.pos.z); if (r > 650) { h.pos.x *= 650 / r; h.pos.z *= 650 / r; }
    const moved = Math.hypot(h.pos.x - ox, h.pos.z - oz);
    if (moved < h.speed * dt * 0.4) h.speed *= 0.8;
    h.bond = clamp(h.bond + moved * 0.004, 0, 100);
    if (gallop && h.speed > 9) h.stamina = Math.max(0, h.stamina - (5.5 - h.bond * 0.025 - h.saddle) * dt);
    else h.stamina = Math.min(100, h.stamina + 5 * dt);
    p.pos.copy(h.pos); p.speed = h.speed;
  } else if (h.state === 'follow') {
    const dx = p.pos.x - h.pos.x, dz = p.pos.z - h.pos.z, d = Math.hypot(dx, dz);
    if (d < 3.4) { h.state = 'idle'; h.speed = 0; }
    else {
      h.speed = approach(h.speed, d > 12 ? 13 : 5, 9 * dt);
      h.heading = angLerp(h.heading, Math.atan2(dx, dz), dt * 6);
      h.pos.x += Math.sin(h.heading) * h.speed * dt; h.pos.z += Math.cos(h.heading) * h.speed * dt;
      resolveCollision(h.pos, 0.9);
    }
    h.stamina = Math.min(100, h.stamina + 4 * dt);
  } else { h.speed = 0; h.stamina = Math.min(100, h.stamina + 4 * dt); }
  h.pos.y = groundHeight(h.pos.x, h.pos.z);
  const prev = Math.floor(h.phase / Math.PI);
  h.phase += h.speed * dt * 1.15;
  if (h.speed > 1 && Math.floor(h.phase / Math.PI) !== prev) sfx.hoof(p.mounted ? 1 : clamp(1 - h.pos.distanceTo(p.pos) / 40, 0, 1));
  h.model.position.copy(h.pos); h.model.rotation.y = h.heading;
  poseQuad(h.model, h.speed);
}

// ---------- interactions ----------
function findPrompt() {
  const p = G.player, h = G.horse;
  if (p.fishing) return { text: p.fishing.bite > 0 ? '[E] Reel it in!' : 'Fishing…  move to stop' };
  if (p.mounted) return h.speed < 4.5 ? { text: `[E] Dismount`, act: dismount } : null;
  let best = null, bd = 1e9;
  const consider = (d, max, obj) => { if (d < max && d < bd) { bd = d; best = obj; } };
  for (const it of G.interactables) {
    if (it.enabled && !it.enabled()) continue;
    consider(dist2(p.pos.x, p.pos.z, it.x, it.z), it.r || 2.6, { text: `[E] ${it.label}`, act: it.action });
  }
  for (const a of G.actors) {
    if (a.removed || a.asleep) continue;
    const d = dist2(p.pos.x, p.pos.z, a.pos.x, a.pos.z);
    if (d > 3.4) continue;
    if (a.alive) {
      if (a.kind !== 'human' || a.state === 'combat' || a.faction === 'bandit' || a.faction === 'thorne' || a.mountModel) continue;
      const rob = a.state === 'cower' && p.weapon !== 'none' && a.faction === 'civil' && !a.essential && !a.robbed;
      consider(d, 3, { text: rob ? `[E] Talk    [G] Rob ${a.name}` : `[E] ${a.label || 'Talk to ' + a.name}`, act: () => G.story.talkTo(a), rob: rob ? a : null });
    } else if (!a.looted && a.species !== 'horse') {
      consider(d - 0.4, 2.6, { text: a.kind === 'human' ? '[E] Loot body' : `[E] Skin ${a.species}`, act: () => lootActor(a) });
    }
  }
  const dh = dist2(p.pos.x, p.pos.z, h.pos.x, h.pos.z);
  if (h.owned) consider(dh - 0.6, 3, { text: `[E] Mount ${h.name}    [B] Pat`, act: mount, pat: true });
  else if (G.story.canCalm()) consider(dh - 3, 0.8, { text: 'Hold [E] to calm the mare', hold: true });
  if (!best && count('fishingRod') > 0 && !inWater(p.pos.x, p.pos.z)) {
    const fxx = Math.sin(p.heading), fz = Math.cos(p.heading);
    if (inWater(p.pos.x + fxx * 5, p.pos.z + fz * 5) || inWater(p.pos.x + fxx * 9, p.pos.z + fz * 9)) best = { text: '[E] Cast your line', act: () => { p.fishing = { t: rand(3, 8), bite: 0 }; G.ui.toast('You cast your line. Wait for a bite…'); } };
  }
  return best;
}
function rob(a) {
  const cash = Math.round(rand(2, 12) * 100) / 100;
  a.robbed = true; a.state = 'flee'; a.t = 14;
  addMoney(cash); addHonor(-5); sfx.coin();
  G.ui.toast(`You took ${fmt(cash)} from ${a.name}.`, 'bad');
  G.law.report('robbery', a.pos);
}

// ---------- death ----------
function die() {
  const p = G.player;
  p.alive = false; p.hp = 0; p.focusOn = false; G.timeScale = 1; p.deadT = 0; p.aiming = false; p.fishing = null;
  if (p.mounted) dismount();
  G.mode = 'dead'; G.ui.death(true);
}
export function updateDeath(rdt) {
  const p = G.player;
  p.deadT += rdt;
  const k = Math.min(1, p.deadT * 2.5);
  p.model.position.set(p.pos.x, p.pos.y, p.pos.z); poseHuman(p.model, { pose: 'dead' });
  if (p.deadT > 4.2) respawn();
}
function respawn() {
  const p = G.player, h = G.horse, L = G.law;
  let msg;
  if (L.bounty > 0 && (p.lastHitLaw || L.wanted)) {
    const paid = Math.min(G.money, L.bounty); addMoney(-paid);
    msg = `The law patched you up and took ${fmt(paid)} to settle your bounty.`; L.bounty = 0;
  } else { const lost = Math.round(G.money * 10) / 100; addMoney(-lost); msg = `Dr. Hale stitched you up. It cost you ${fmt(lost)}.`; }
  L.wanted = false; L.heat = 0;
  for (const a of G.actors) { if (a.posse) removeActor(a); else if (a.state === 'combat' || a.state === 'attack') { a.state = 'idle'; a.t = 3; } }
  p.pos.set(-34, 0, 5); p.pos.y = groundHeight(-34, 5); p.yaw = 0; p.heading = Math.PI; p.pitch = -0.1;
  p.hp = 70; p.stamina = 100; p.hunger = Math.max(p.hunger, 45); p.alive = true; p.vy = 0; p.weapon = 'none';
  p.model.rotation.set(0, p.heading, 0);
  if (h.owned) { h.pos.set(-28, 0, 3); h.state = 'idle'; }
  G.time += 6; if (G.time >= 24) { G.time -= 24; G.day++; if (G.onNewDay) G.onNewDay(); }
  G.mode = 'play'; G.ui.death(false); G.ui.toast(msg);
}

// ---------- per-frame ----------
export function updatePlayer(dt, rdt) {
  const p = G.player, h = G.horse;
  if (!p.alive) return;
  const sens = 0.0022 * G.settings.sens * (p.aiming ? 0.55 : 1);
  p.yaw -= mouse.dx * sens; p.pitch -= mouse.dy * sens;
  const kl = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0), ku = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0);
  p.yaw += kl * 1.9 * rdt; p.pitch = clamp(p.pitch + ku * 1.2 * rdt, -1.25, 1);
  const cp = Math.cos(p.pitch);
  fwd.set(Math.sin(p.yaw) * cp, Math.sin(p.pitch), Math.cos(p.yaw) * cp);

  // weapons
  const sel = (w) => {
    if (w !== 'none' && !G.weaponsOwned[w]) { G.ui.toast(`You don't own a ${WEAPONS[w].name.toLowerCase()} yet.`); return; }
    p.weapon = w; p.reloadT = 0; sfx.click();
  };
  if (wasPressed('Digit1')) sel('none');
  if (wasPressed('Digit2')) sel('revolver');
  if (wasPressed('Digit3')) sel('rifle');
  if (wasPressed('Digit4')) sel('bow');
  p.fireT -= rdt; p.aimHold -= rdt; p.patT -= rdt;
  p.aiming = mouse.right && p.weapon !== 'none' && !p.fishing;
  if (p.reloadT > 0) {
    p.reloadT -= rdt;
    if (p.reloadT <= 0) { const w = WEAPONS[p.weapon], n = Math.min(w.clip - p.clip[p.weapon], count(w.ammo)); p.clip[p.weapon] += n; addItem(w.ammo, -n); }
  }
  if (wasPressed('KeyR') && p.weapon !== 'none') startReload();
  if (mouse.clicked && !p.fishing) { if (p.weapon === 'none') punch(); else fire(); }
  if (wasPressed('KeyQ')) { if (p.focusOn) p.focusOn = false; else if (p.focus > 8 && p.weapon !== 'none') p.focusOn = true; else G.ui.toast(p.weapon === 'none' ? 'Draw a weapon first.' : 'Not enough focus.'); }
  if (p.focusOn) { p.focus -= 13 * rdt; if (p.focus <= 0) { p.focus = 0; p.focusOn = false; } }
  G.timeScale = p.focusOn ? 0.3 : 1;
  if (wasPressed('KeyH')) whistle();
  if (wasPressed('KeyX')) {
    const id = p.hp < 50 && count('tonic') ? 'tonic' : ['cookedMeat', 'cookedFish', 'beans', 'jerky', 'bread', 'apple'].find((i) => count(i) > 0);
    if (id) useItem(id); else G.ui.toast('Nothing to eat in your satchel.');
  }

  // movement
  const mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  if (p.fishing) {
    const f = p.fishing;
    if (mx || mz) { p.fishing = null; G.ui.toast('You reel in your line.'); }
    else if (f.bite > 0) {
      f.bite -= dt;
      if (wasPressed('KeyE')) {
        consume('KeyE'); p.fishing = null; addItem('fish'); G.stats.fish++; sfx.good();
        G.ui.toast(`You landed a ${(rand(1, 6)).toFixed(1)} lb ${pick(['Sorrel trout', 'channel catfish', 'bluegill', 'river perch'])}!`, 'good');
      } else if (f.bite <= 0) { p.fishing = null; G.ui.toast('It slipped the hook.'); }
    } else { f.t -= dt; if (f.t <= 0) { f.bite = 1.4; sfx.click(); G.ui.toast('A bite! Press E!', 'good'); } }
  }
  if (p.mounted) updateHorse(dt);
  else {
    updateHorse(dt);
    if (wasPressed('KeyC')) p.crouch = !p.crouch;
    let dx = Math.sin(p.yaw) * mz - Math.cos(p.yaw) * mx, dz = Math.cos(p.yaw) * mz + Math.sin(p.yaw) * mx;
    const l = Math.hypot(dx, dz);
    const sprint = (keys.ShiftLeft || keys.ShiftRight) && p.stamina > 0 && !p.crouch && !p.aiming && l > 0;
    let sp = p.aiming ? 2.1 : p.crouch ? 1.8 : sprint ? 6.6 : keys.ControlLeft ? 1.8 : 4;
    const wet = inWater(p.pos.x, p.pos.z); if (wet) sp *= 0.5;
    if (l > 0 && !p.fishing) {
      dx /= l; dz /= l;
      p.pos.x += dx * sp * dt; p.pos.z += dz * sp * dt;
      resolveCollision(p.pos, 0.4);
      const r = Math.hypot(p.pos.x, p.pos.z); if (r > 650) { p.pos.x *= 650 / r; p.pos.z *= 650 / r; }
      if (!p.aiming && p.aimHold <= 0) p.heading = angLerp(p.heading, Math.atan2(dx, dz), dt * 12);
      const prev = Math.floor(p.phase / Math.PI); p.phase += sp * dt * 1.75;
      if (Math.floor(p.phase / Math.PI) !== prev && p.onGround) sfx.step();
      p.speed = sp;
      if (sprint) p.stamina = Math.max(0, p.stamina - 9 * dt);
    } else p.speed = 0;
    if (p.aiming || p.aimHold > 0) p.heading = angLerp(p.heading, p.yaw, rdt * 18);
    const gy = groundHeight(p.pos.x, p.pos.z);
    if (wasPressed('Space') && p.onGround && !p.crouch && !wet) { p.vy = 5.4; p.onGround = false; }
    if (!p.onGround) { p.vy -= 16 * dt; p.pos.y += p.vy * dt; if (p.pos.y <= gy) { p.pos.y = gy; p.onGround = true; p.vy = 0; } }
    else p.pos.y = gy;
    if (!sprint) p.stamina = Math.min(100, p.stamina + (p.hunger < 20 ? 5 : 12) * dt);
  }

  // cores
  p.hurtT += rdt;
  p.hunger = Math.max(0, p.hunger - 0.055 * dt);
  if (p.hunger <= 0) p.hp = Math.max(15, p.hp - 0.3 * dt);
  else if (p.hurtT > 8 && p.hunger > 35) p.hp = Math.min(100, p.hp + 0.8 * dt);
  if (!p.focusOn) p.focus = Math.min(100, p.focus + 0.5 * dt);

  // prompts
  const pr = findPrompt(); p.prompt = pr;
  if (pr && !p.fishing) {
    if (pr.hold) {
      if (keys.KeyE) { h.calm += rdt / 3.2; if (h.calm >= 1) { h.calm = 0; G.story.onCalmed(); } }
      else h.calm = Math.max(0, h.calm - rdt * 0.5);
    } else if (wasPressed('KeyE') && pr.act) { consume('KeyE'); pr.act(); }
    if (pr.rob && wasPressed('KeyG')) rob(pr.rob);
    if (pr.pat && wasPressed('KeyB') && p.patT <= 0) { p.patT = 10; h.bond = clamp(h.bond + 1.5, 0, 100); G.ui.toast(`You pat ${h.name}. She leans into your hand.`); }
  }
  G.ui.setPrompt(pr ? pr.text : null, pr && pr.hold ? h.calm : null);

  // model
  const m = p.model;
  if (p.mounted) {
    m.position.set(h.pos.x, h.pos.y + h.model.userData.seatY - SIT_DROP, h.pos.z); m.rotation.set(0, p.aiming ? p.yaw : h.heading, 0);
    poseHuman(m, { pose: 'ride', aim: p.aiming || p.aimHold > 0, pitch: p.pitch, weapon: p.weapon });
  } else {
    m.position.copy(p.pos); m.rotation.set(0, p.heading, 0);
    poseHuman(m, { speed: p.speed, aim: p.aiming || p.aimHold > 0, pitch: p.pitch, weapon: p.weapon, crouch: p.crouch });
  }
}

export function updateCamera(rdt) {
  const p = G.player, cam = G.camera, w = WEAPONS[p.weapon];
  if (G.debugCam) { cam.position.fromArray(G.debugCam.pos); cam.lookAt(G.debugCam.look[0], G.debugCam.look[1], G.debugCam.look[2]); if (G.debugCam.fov) { cam.fov = G.debugCam.fov; cam.updateProjectionMatrix(); } return; }
  p.camDist = lerp(p.camDist, p.aiming ? 2.3 : p.mounted ? 6.8 : 4.6, Math.min(1, rdt * 8));
  p.fov = lerp(p.fov, p.aiming ? w.fov : p.mounted && G.horse.speed > 11 ? 68 : 60, Math.min(1, rdt * 7));
  if (Math.abs(cam.fov - p.fov) > 0.05) { cam.fov = p.fov; cam.updateProjectionMatrix(); }
  const cp = Math.cos(p.pitch);
  fwd.set(Math.sin(p.yaw) * cp, Math.sin(p.pitch), Math.cos(p.yaw) * cp);
  right.set(-Math.cos(p.yaw), 0, Math.sin(p.yaw));
  tgt.set(p.pos.x, p.pos.y + (p.mounted ? 2.55 : p.crouch ? 1.25 : 1.62), p.pos.z).addScaledVector(right, p.aiming ? 0.62 : 0.3);
  cam.position.copy(tgt).addScaledVector(fwd, -p.camDist);
  const gy = groundHeight(cam.position.x, cam.position.z) + 0.35;
  if (cam.position.y < gy) cam.position.y = gy;
  look.copy(cam.position).add(fwd); cam.lookAt(look);
}
