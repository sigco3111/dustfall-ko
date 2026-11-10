// Everyone and everything that lives in the basin: townsfolk, lawmen, outlaws, wildlife.
import * as THREE from 'three';
import { G, rand, pick, clamp, angLerp, sfx, addHonor, addItem, addMoney, fmt } from './core.js';
import { groundHeight, resolveCollision, rayBlocked, fx, SITES, siteDist, nearestSite, riverX, terrainH, inTown } from './world.js';
import { makeHuman, poseHuman, makeQuad, poseQuad, QUADS, humanAction, SIT_DROP } from './models.js';

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const isNight = () => G.time < 5.5 || G.time > 20.5;

export function spawnHuman(o) {
  const a = {
    kind: 'human', id: o.id || null, name: o.name || 'Stranger', faction: o.faction || 'civil',
    hp: o.hp || 100, maxHp: o.hp || 100, alive: true, state: 'idle', heading: o.heading || 0, face: o.heading,
    pos: new THREE.Vector3(o.x, groundHeight(o.x, o.z), o.z), home: { x: o.x, z: o.z, r: o.homeR ?? 0 },
    wander: !!o.wander, t: rand(1, 5), shootT: rand(0.6, 2), strafe: 1, strafeT: 0, phase: rand(6), moving: 0,
    tags: o.tags || [], essential: !!o.essential, weapon: o.weapon || 'revolver', acc: o.acc ?? 1, detect: o.detect || 40,
    talkFn: o.talkFn || null, shop: o.shop || null, label: o.label || null, deadT: 0, looted: false,
    respawn: !!o.respawn, sleeps: !!o.sleeps, posse: !!o.posse, cash: o.cash, greeted: 0, target: null, mountModel: null,
  };
  a.model = makeHuman(o.look || {});
  G.scene.add(a.model);
  if (o.mounted) { a.mountModel = makeQuad('horse', { color: pick([0x6b4226, 0x2a2018, 0x8a6a42, 0xb9a888]), saddle: true }); G.scene.add(a.mountModel); }
  G.actors.push(a);
  return a;
}

export function spawnAnimal(species, x, z, o = {}) {
  const q = QUADS[species];
  const a = {
    kind: 'animal', species, name: species, faction: o.faction || 'wild', q,
    hp: o.hp || { deer: 60, wolf: 70, cow: 140, rabbit: 40, horse: 200 }[species], alive: true, state: 'idle',
    heading: rand(6.28), pos: new THREE.Vector3(x, groundHeight(x, z), z), home: { x, z, r: o.homeR ?? 22 },
    t: rand(1, 6), phase: rand(6), moving: 0, tags: o.tags || [], biteT: 0, deadT: 0, looted: false, wild: !!o.wild, target: null,
  };
  a.maxHp = a.hp;
  a.model = makeQuad(species, o.look || {});
  G.scene.add(a.model); G.actors.push(a);
  return a;
}

export function removeActor(a) {
  if (a.removed) return;
  G.scene.remove(a.model); if (a.mountModel) G.scene.remove(a.mountModel);
  a.removed = true; a.alive = false;
}
export function removeTagged(tag) { for (const a of G.actors) if (a.tags.includes(tag)) removeActor(a); }
export const aliveTagged = (tag) => G.actors.filter((a) => a.alive && !a.removed && a.tags.includes(tag));

// ---------- hit testing ----------
function spheres(a) {
  const x = a.pos.x, z = a.pos.z;
  if (a.kind === 'human') {
    if (a.mountModel) { const y = a.pos.y + a.mountModel.userData.seatY; return [[x, y + 0.72, z, 0.23, true], [x, y + 0.3, z, 0.4, false]]; }
    const y = a.pos.y;
    return [[x, y + 1.7, z, 0.23, true], [x, y + 1.22, z, 0.42, false], [x, y + 0.55, z, 0.34, false]];
  }
  const q = a.q, cy = a.pos.y + q.legL + q.bh / 2, fx_ = Math.sin(a.heading), fz = Math.cos(a.heading);
  const r = Math.max(q.bh, q.bw) * 0.72 + 0.12;
  return [[x + fx_ * q.bl * 0.22, cy, z + fz * q.bl * 0.22, r, false], [x - fx_ * q.bl * 0.25, cy, z - fz * q.bl * 0.25, r, false],
    [x + fx_ * (q.bl * 0.5 + q.headL * 0.4), cy + q.neckL * 0.7, z + fz * (q.bl * 0.5 + q.headL * 0.4), 0.2 + q.bw * 0.25, true]];
}
export function rayActors(o, d, maxT) {
  let best = null;
  for (const a of G.actors) {
    if (!a.alive || a.asleep || a.removed) continue;
    const dx = a.pos.x - o.x, dz = a.pos.z - o.z;
    if (dx * dx + dz * dz > (maxT + 4) * (maxT + 4)) continue;
    for (const s of spheres(a)) {
      const ox = o.x - s[0], oy = o.y - s[1], oz = o.z - s[2], r = s[3] + 0.07;
      const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - c;
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t > 0.5 && t < maxT && (!best || t < best.t)) best = { actor: a, t, head: s[4] };
    }
  }
  return best;
}

// ---------- damage ----------
function enterCombat(a, alertAllies) {
  if (!a.alive || a.state === 'combat') return;
  a.state = 'combat'; a.shootT = rand(0.7, 1.7);
  if (alertAllies) for (const o of G.actors) {
    if (o !== a && o.alive && o.kind === 'human' && o.faction === a.faction && o.state !== 'combat' && o.pos.distanceTo(a.pos) < 55) enterCombat(o, false);
  }
}
export function damageActor(a, dmg, opts = {}) {
  if (!a.alive) return false;
  if (a.essential) { a.state = 'cower'; a.t = 6; return false; }
  a.hp -= dmg;
  v1.copy(a.pos); v1.y += a.kind === 'human' ? 1.2 : a.q.legL + a.q.bh / 2;
  fx.puff(v1, 0x8a1c14, 5);
  if (a.hp <= 0) { killActor(a, opts.byPlayer !== false); return true; }
  if (a.kind === 'human') {
    humanAction(a.model, 'hit');
    if (a.faction === 'bandit' || a.faction === 'thorne') enterCombat(a, true);
    else if (a.faction === 'civil') { a.state = 'flee'; a.t = 12; }
  } else if (a.species === 'wolf') a.state = 'attack';
  else { a.state = 'flee'; a.t = 10; }
  return false;
}
function killActor(a, byPlayer) {
  a.alive = false; a.state = 'dead'; a.deadT = 0;
  if (!byPlayer) return;
  const p = G.player;
  if (a.kind === 'human') {
    if (a.faction === 'civil') { addHonor(-15); G.law.report('murder', a.pos); }
    else if (a.faction === 'law') { addHonor(-8); G.law.report('lawkill', a.pos); }
    else { G.stats.kills++; addHonor(0.5); }
    p.focus = clamp(p.focus + 8, 0, 100);
  } else {
    G.stats.hunted++;
    if (a.faction === 'ranch') { addHonor(-4); G.law.report('assault', a.pos); }
  }
  if (G.story) G.story.onKill(a);
}

// Gunfire and other loud trouble.
export function alarm(pos, radius) {
  for (const a of G.actors) {
    if (!a.alive || a.asleep) continue;
    const d = a.pos.distanceTo(pos);
    if (d > radius) continue;
    if (a.kind === 'human') {
      if (a.faction === 'bandit' || a.faction === 'thorne') enterCombat(a, false);
      else if (a.faction === 'civil' && a.state !== 'flee') { a.state = 'flee'; a.t = rand(8, 14); }
      else if (a.faction === 'vendor' && d < 30) { a.state = 'cower'; a.t = 5; }
    } else if (a.species === 'deer' || a.species === 'rabbit') { a.state = 'flee'; a.t = rand(8, 12); }
  }
}

export function lootActor(a) {
  if (a.looted || a.alive) return;
  a.looted = true;
  if (a.kind === 'human') {
    const cash = a.cash ?? (a.faction === 'civil' ? rand(0.5, 5) : rand(2, 12));
    addMoney(cash);
    let msg = `Looted ${fmt(Math.round(cash * 100) / 100)}`;
    if (a.faction !== 'civil' && Math.random() < 0.75) { const n = 3 + Math.floor(rand(7)); addItem('revolverAmmo', n); msg += `, ${n} cartridges`; }
    if (Math.random() < 0.15) { addItem('whiskey'); msg += ', rye whiskey'; }
    if (a.faction === 'civil' || a.faction === 'law') addHonor(-2);
    G.ui.toast(msg); sfx.coin();
  } else {
    const gains = { deer: [['rawMeat', 2], ['deerPelt', 1]], wolf: [['rawMeat', 1], ['wolfPelt', 1]], rabbit: [['rawMeat', 1], ['rabbitPelt', 1]], cow: [['rawMeat', 3], ['cowHide', 1]], horse: [] }[a.species] || [];
    for (const [id, n] of gains) addItem(id, n);
    G.ui.toast(gains.length ? 'Skinned: ' + gains.map(([id, n]) => `${n} × ${id === 'rawMeat' ? 'raw meat' : id.replace('Pelt', ' pelt').replace('Hide', ' hide')}`).join(', ') : 'Nothing worth taking.');
    a.model.traverse((m) => { if (m.isSkinnedMesh) m.material = bareMat; });
  }
}
const bareMat = new THREE.MeshLambertMaterial({ color: 0x7a3028 });

// ---------- movement ----------
function move(a, dx, dz, speed, dt, face = true) {
  a.pos.x += dx * speed * dt; a.pos.z += dz * speed * dt;
  resolveCollision(a.pos, a.mountModel ? 0.9 : 0.4);
  const r = Math.hypot(a.pos.x, a.pos.z); if (r > 655) { a.pos.x *= 655 / r; a.pos.z *= 655 / r; }
  a.pos.y = groundHeight(a.pos.x, a.pos.z);
  if (face) a.heading = angLerp(a.heading, Math.atan2(dx, dz), dt * 8);
  a.phase += speed * dt * (a.kind === 'human' && !a.mountModel ? 1.7 : 1.1);
  a.moving = speed;
}

function updateHuman(a, dt, d) {
  const p = G.player, hostile = a.faction === 'bandit' || a.faction === 'thorne';
  if (a.state !== 'combat') {
    if (hostile && p.alive) {
      let r = a.detect; if (p.crouch) r *= 0.42; if (isNight()) r *= 0.62; if (p.mounted) r *= 1.25;
      if (d < r) enterCombat(a, true);
    } else if (a.faction === 'law' && G.law.wanted && p.alive && d < 85) enterCombat(a, false);
    else if ((a.faction === 'civil' || a.faction === 'vendor') && p.aiming && p.weapon !== 'none' && d < 9 && a.state !== 'flee') {
      const ang = Math.atan2(a.pos.x - p.pos.x, a.pos.z - p.pos.z);
      let df = Math.abs(ang - p.yaw) % (Math.PI * 2); if (df > Math.PI) df = Math.PI * 2 - df;
      if (df < 0.22) { a.state = 'cower'; a.t = 3; }
    }
  } else if ((a.faction === 'law' && !G.law.wanted) || !p.alive || d > 150) { a.state = 'idle'; a.t = 2; }
  if (a.posse && !G.law.wanted && d > 70) { removeActor(a); return; }

  a.moving = 0;
  let pose = 'idle';
  switch (a.state) {
    case 'idle':
      a.t -= dt;
      if (a.face !== undefined && !a.wander) a.heading = angLerp(a.heading, a.face, dt * 3);
      if (a.t <= 0) {
        a.t = rand(3, 9);
        if (a.wander) {
          const ang = rand(6.28), r = rand(a.home.r);
          a.target = { x: a.home.x + Math.cos(ang) * r, z: a.home.z + Math.sin(ang) * r }; a.state = 'walk'; a.t = 25;
        }
      }
      break;
    case 'walk': {
      const dx = a.target.x - a.pos.x, dz = a.target.z - a.pos.z, l = Math.hypot(dx, dz);
      a.t -= dt;
      if (l < 1 || a.t <= 0) { a.state = 'idle'; a.t = rand(2, 8); } else move(a, dx / l, dz / l, 1.5, dt);
      break;
    }
    case 'flee': {
      const dx = a.pos.x - p.pos.x, dz = a.pos.z - p.pos.z, l = Math.hypot(dx, dz) || 1;
      move(a, dx / l, dz / l, 5.2, dt);
      a.t -= dt;
      if (a.t <= 0) { a.state = 'walk'; a.target = { x: a.home.x, z: a.home.z }; a.t = 60; }
      break;
    }
    case 'cower': pose = 'cower'; a.t -= dt; if (a.t <= 0) { a.state = 'idle'; a.t = 2; } break;
    case 'combat': {
      G.combatT = 0;
      const dx = p.pos.x - a.pos.x, dz = p.pos.z - a.pos.z, nx = dx / (d || 1), nz = dz / (d || 1);
      const ride = !!a.mountModel, want = ride ? 19 : 13, sp = ride ? 10.5 : 4.7;
      a.strafeT -= dt;
      if (a.strafeT <= 0) { a.strafeT = rand(1.5, 3.5); a.strafe = Math.random() < 0.5 ? -1 : 1; if (!ride && Math.random() < 0.3) a.strafe = 0; }
      let mx = 0, mz = 0;
      if (d > want + 8) { mx = nx; mz = nz; } else if (d < want - 6) { mx = -nx; mz = -nz; }
      mx += -nz * a.strafe * 0.7; mz += nx * a.strafe * 0.7;
      const l = Math.hypot(mx, mz);
      if (l > 0.1) move(a, mx / l, mz / l, l > 0.9 ? sp : sp * 0.55, dt, ride);
      if (!ride) a.heading = angLerp(a.heading, Math.atan2(nx, nz), dt * 10);
      pose = 'aim';
      a.shootT -= dt;
      const range = a.weapon === 'rifle' ? 95 : 62;
      if (a.shootT <= 0 && d < range) {
        const yo = ride ? a.mountModel.userData.seatY - 0.55 : 0;
        v1.set(a.pos.x, a.pos.y + 1.5 + yo, a.pos.z);
        v2.set(p.pos.x, p.pos.y + (p.mounted ? 1.9 : p.crouch ? 0.9 : 1.2), p.pos.z);
        v3.subVectors(v2, v1).normalize();
        if (rayBlocked(v1, v3, d) < d - 1.5) { a.shootT = 0.5; break; }
        a.shootT = a.weapon === 'rifle' ? rand(1.8, 3.2) : rand(1, 2.4);
        sfx.shot(clamp(1.2 - d / 70, 0.15, 0.8), a.weapon === 'rifle'); humanAction(a.model, 'shoot');
        let ch = clamp(0.44 - d * 0.008, 0.05, 0.44) * a.acc;
        if (p.speed > 5) ch *= 0.55; else if (p.speed > 1) ch *= 0.8;
        if (p.crouch) ch *= 0.8; if (G.timeScale < 1) ch *= 0.45;
        if (Math.random() < ch) { fx.tracer(v1, v2); G.hurtPlayer(rand(6, 10) * (a.weapon === 'rifle' ? 1.5 : 1), a); }
        else { v2.x += rand(-1.5, 1.5); v2.y += rand(-0.6, 1.2); v2.z += rand(-1.5, 1.5); v2.addScaledVector(v3, 12); fx.tracer(v1, v2); }
      }
      break;
    }
  }
  const yo = a.mountModel ? a.mountModel.userData.seatY - SIT_DROP : 0;
  a.model.position.set(a.pos.x, a.pos.y + yo, a.pos.z); a.model.rotation.y = a.heading;
  if (a.mountModel) {
    a.mountModel.position.copy(a.pos); a.mountModel.rotation.y = a.heading; poseQuad(a.mountModel, a.moving);
    poseHuman(a.model, { pose: 'ride', aim: a.state === 'combat', weapon: a.weapon });
  } else poseHuman(a.model, { speed: a.moving, pose, aim: pose === 'aim', weapon: a.state === 'combat' ? a.weapon : 'none' });
}

function updateAnimal(a, dt, d) {
  const p = G.player, sp = a.species;
  a.moving = 0;
  if (sp === 'deer' || sp === 'rabbit') {
    if (a.state !== 'flee' && p.alive) {
      const r = (p.crouch ? 13 : 30) * (sp === 'rabbit' ? 0.55 : 1) * (p.mounted ? 1.25 : 1);
      if (d < r) { a.state = 'flee'; a.t = rand(6, 10); }
    }
  } else if (sp === 'wolf') {
    if (a.state !== 'attack' && p.alive && d < 36) { a.state = 'attack'; if (Math.random() < 0.3) sfx.howl(); }
    if (a.state === 'attack' && (!p.alive || d > 95)) a.state = 'idle';
  }
  switch (a.state) {
    case 'idle':
      a.t -= dt;
      if (a.t <= 0) { const ang = rand(6.28), r = rand(a.home.r); a.target = { x: a.home.x + Math.cos(ang) * r, z: a.home.z + Math.sin(ang) * r }; a.state = 'walk'; a.t = 20; }
      break;
    case 'walk': {
      const dx = a.target.x - a.pos.x, dz = a.target.z - a.pos.z, l = Math.hypot(dx, dz);
      a.t -= dt;
      if (l < 1 || a.t <= 0) { a.state = 'idle'; a.t = rand(3, 10); } else move(a, dx / l, dz / l, sp === 'rabbit' ? 1.6 : 1.1, dt);
      break;
    }
    case 'flee': {
      let dx = a.pos.x - p.pos.x, dz = a.pos.z - p.pos.z; const l = Math.hypot(dx, dz) || 1;
      const wob = Math.sin(a.phase * 0.3) * 0.5; dx = dx / l - dz / l * wob; dz = dz / l + (a.pos.x - p.pos.x) / l * wob;
      const l2 = Math.hypot(dx, dz) || 1;
      move(a, dx / l2, dz / l2, sp === 'rabbit' ? 7 : sp === 'deer' ? 10.5 : 5, dt);
      a.t -= dt;
      if (a.t <= 0 && d > 45) { a.state = 'idle'; a.t = rand(2, 5); a.home.x = a.pos.x; a.home.z = a.pos.z; }
      break;
    }
    case 'attack': {
      G.combatT = 0;
      const dx = p.pos.x - a.pos.x, dz = p.pos.z - a.pos.z, l = d || 1;
      if (d > 1.7) move(a, dx / l, dz / l, 8.3, dt); else a.heading = Math.atan2(dx, dz);
      a.biteT -= dt;
      if (d < 2.3 && a.biteT <= 0) { a.biteT = 1.15; G.hurtPlayer(rand(8, 13), a); sfx.punch(); }
      break;
    }
  }
  a.model.position.copy(a.pos); a.model.rotation.y = a.heading;
  poseQuad(a.model, a.moving);
}

function updateDead(a, dt, d) {
  a.deadT += dt;
  const k = Math.min(1, a.deadT * 2.6);
  if (a.kind === 'human') {
    a.model.position.set(a.pos.x, a.pos.y + (a.mountModel ? (a.mountModel.userData.seatY - SIT_DROP) * (1 - k) : 0), a.pos.z);
    poseHuman(a.model, { pose: 'dead' });
    if (a.mountModel) poseQuad(a.mountModel, 0);
  } else {
    poseQuad(a.model, 0, true);
    if (!a.model.userData.hasDeath) { a.model.rotation.z = Math.PI / 2 * k; a.model.position.set(a.pos.x, a.pos.y + a.q.bw * 0.45 * k, a.pos.z); }
  }
  if (!a.respawn && (a.deadT > 300 || (a.deadT > 45 && d > 170))) removeActor(a);
}

export function updateActors(dt) {
  const p = G.player;
  G.combatT += dt;
  const night = G.time >= 22 || G.time < 6;
  for (const a of G.actors) {
    if (a.removed) continue;
    const d = Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z);
    if (a.sleeps && a.alive) {
      if (night !== !!a.asleep && a.state !== 'combat') {
        a.asleep = night; if (!night) { a.pos.set(a.home.x, groundHeight(a.home.x, a.home.z), a.home.z); a.state = 'idle'; }
      }
      if (a.asleep) { a.model.visible = false; continue; }
    }
    const vis = d < 260;
    a.model.visible = vis; if (a.mountModel) a.mountModel.visible = vis;
    if (!a.alive) { updateDead(a, dt, d); continue; }
    if (a.wild && d > 300) { removeActor(a); continue; }
    if (!vis && a.state !== 'combat') continue;
    if (a.kind === 'human') updateHuman(a, dt, d); else updateAnimal(a, dt, d);
  }
  if (G.actors.some((a) => a.removed)) G.actors = G.actors.filter((a) => !a.removed);
}

// A new morning: the town refills.
export function reviveTown() {
  for (const a of G.actors) {
    if (a.respawn && !a.alive && !a.removed) {
      a.alive = true; a.hp = a.maxHp; a.state = 'idle'; a.looted = false; a.deadT = 0;
      a.pos.set(a.home.x, groundHeight(a.home.x, a.home.z), a.home.z);
      a.model.rotation.set(0, a.heading, 0);
    }
  }
}

// ---------- the law ----------
export function initLaw() {
  G.law = {
    bounty: 0, wanted: false, heat: 0, recog: 0, posseT: 25,
    report(type, pos) {
      const amt = { disturb: 4, assault: 12, robbery: 20, murder: 45, lawkill: 70 }[type];
      pos = pos || G.player.pos;
      let seen = false;
      for (const a of G.actors) {
        if (a.alive && !a.asleep && a.kind === 'human' && (a.faction === 'civil' || a.faction === 'vendor' || a.faction === 'law') && a.pos.distanceTo(pos) < 55) { seen = true; break; }
      }
      if (!seen) return false;
      if (type === 'disturb' && this.wanted) return true;
      this.bounty += amt;
      if (!this.wanted) { G.ui.toast('WANTED — the law is on to you.', 'bad'); sfx.bad(); }
      this.wanted = true; this.heat = 45;
      return true;
    },
    update(dt) {
      const p = G.player;
      let lawNear = false, lawClose = false;
      for (const a of G.actors) {
        if (!a.alive || a.asleep || a.faction !== 'law') continue;
        const d = a.pos.distanceTo(p.pos);
        if (d < 75) lawNear = true;
        if (d < 15) lawClose = true;
      }
      if (this.wanted) {
        if (lawNear) this.heat = Math.max(this.heat, 22); else this.heat -= dt;
        if (this.heat <= 0) { this.wanted = false; this.recog = 0; G.ui.toast(`You lost the law. A bounty of ${fmt(this.bounty)} stays on your head.`); }
        this.posseT -= dt;
        if (this.posseT <= 0 && !inTown(p.pos.x, p.pos.z) && p.alive) {
          this.posseT = 50;
          const ang = rand(6.28);
          for (let i = 0; i < 3; i++) {
            const x = p.pos.x + Math.cos(ang + i * 0.12) * 80, z = p.pos.z + Math.sin(ang + i * 0.12) * 80;
            spawnHuman({ x, z, name: 'Deputy', faction: 'law', mounted: true, posse: true, hp: 110, look: LOOKS.deputy() });
          }
          G.ui.toast('A posse is riding you down!', 'bad');
        }
      } else if (this.bounty > 0 && p.alive) {
        if (lawClose && !p.crouch) { this.recog += dt; if (this.recog > 3.5) { this.wanted = true; this.heat = 45; this.recog = 0; G.ui.toast('A lawman recognised you!', 'bad'); sfx.bad(); } }
        else this.recog = Math.max(0, this.recog - dt);
      }
    },
  };
}

export const LOOKS = {
  deputy: () => ({ shirt: 0x39485a, vest: 0x1d1d1d, pants: 0x2a2a30, hat: 0x1d1d1d, badge: true }),
  bandit: () => ({ shirt: pick([0x3a3a3a, 0x4a3b2a, 0x5a2a22]), vest: 0x1b1512, hat: pick([0x1d1d1d, 0x2a2018]), bandana: pick([0x7a2318, 0x3a3a3a, 0x7a2318]), coat: Math.random() < 0.5 ? 0x2a2420 : undefined }),
  guard: () => ({ shirt: 0xd9d2bd, vest: 0x23404a, pants: 0x2a2a30, hat: 0x23404a, coat: 0x23404a }),
  towns: () => (Math.random() < 0.4 ? { skirt: pick([0x7a3a4a, 0x39485a, 0x556b4a, 0x8a6a42]), hat: false } : { vest: Math.random() < 0.5 ? pick([0x3a2616, 0x2a2a30, 0x4a3b2a]) : undefined, beard: Math.random() < 0.3 }),
};

// ---------- wildlife and chance encounters ----------
export function findWildSpot(minD, maxD, ax, az) {
  const p = G.player; ax = ax ?? p.pos.x; az = az ?? p.pos.z;
  for (let i = 0; i < 14; i++) {
    const ang = rand(6.28), r = rand(minD, maxD), x = ax + Math.cos(ang) * r, z = az + Math.sin(ang) * r;
    if (Math.hypot(x, z) > 630 || nearestSite(x, z).d < 25 || Math.abs(x - riverX(z)) < 42 || terrainH(x, z) > 58) continue;
    return { x, z };
  }
  return null;
}
export function spawnPack(species, n, at, opts = {}) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(spawnAnimal(species, at.x + rand(-7, 7), at.z + rand(-7, 7), { wild: true, ...opts }));
  return out;
}
export function spawnGang(tag, cx, cz, n, faction = 'bandit', o = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const ang = i / n * 6.28 + rand(0.5), r = rand(3, o.spread || 12);
    out.push(spawnHuman({
      x: cx + Math.cos(ang) * r, z: cz + Math.sin(ang) * r, name: faction === 'thorne' ? 'Thorne Gunhand' : 'Ash Rider', faction, tags: [tag],
      wander: true, homeR: o.spread || 12, hp: o.hp || 90, acc: o.acc ?? 0.9, detect: o.detect || 40, mounted: !!o.mounted,
      weapon: i % 3 === 2 ? 'rifle' : 'revolver', look: faction === 'thorne' ? LOOKS.guard() : LOOKS.bandit(), heading: rand(6.28),
    }));
  }
  return out;
}

let wildT = 3, encT = 140;
export function updateSpawns(dt) {
  const p = G.player;
  wildT -= dt;
  if (wildT <= 0) {
    wildT = 2.5;
    let n = 0; for (const a of G.actors) if (a.wild && a.alive) n++;
    if (n < 11 && !inTown(p.pos.x, p.pos.z)) {
      const at = findWildSpot(95, 160);
      if (at) {
        const r = Math.random(), wolfCh = isNight() ? 0.24 : 0.1;
        if (r < wolfCh) spawnPack('wolf', 2 + Math.floor(rand(2)), at);
        else spawnPack('deer', 2 + Math.floor(rand(3)), at);
      }
    }
  }
  encT -= dt;
  if (encT <= 0) {
    encT = rand(150, 300);
    if (nearestSite(p.pos.x, p.pos.z).d < 90 || G.law.wanted || G.combatT < 20 || !p.alive) { encT = 40; return; }
    const at = findWildSpot(70, 95); if (!at) { encT = 20; return; }
    const r = Math.random();
    if (r < 0.4) {
      spawnGang('ambush', at.x, at.z, 3, 'bandit', { mounted: true, spread: 6, detect: 120, hp: 80 }).forEach((a) => { a.wild = true; });
      G.ui.toast('Ambush! Ash Riders on the trail!', 'bad');
    } else if (r < 0.65) {
      spawnPack('wolf', 3, at).forEach((w) => { w.state = 'attack'; }); sfx.howl();
      G.ui.toast('Wolves have caught your scent.', 'bad');
    } else {
      const t = spawnHuman({ x: at.x, z: at.z, name: pick(['Lost Surveyor', 'Stranded Peddler', 'Circuit Preacher', 'Mail Rider']), faction: 'civil', look: LOOKS.towns(), tags: ['traveler'] });
      t.wild = true; t.state = 'cower'; t.t = 9999; t.essential = true;
      const ws = spawnPack('wolf', 2, { x: at.x + 9, z: at.z + 6 }, { tags: ['travelerWolf'] });
      t.wolves = ws;
      t.talkFn = async (a) => {
        if (a.wolves.some((w) => w.alive)) { G.ui.toast('"The wolves! Shoot them, for mercy\'s sake!"'); return; }
        if (a.thanked) { G.ui.toast('"God keep you, friend."'); return; }
        a.thanked = true; a.state = 'idle'; a.t = 5; a.wander = true; a.home.r = 6;
        const cash = Math.round(rand(6, 18));
        await G.ui.dialogue([{ who: a.name, text: `I thought I was wolf supper. Take this — ${fmt(cash)} is all I carry, and you've earned every cent.` }]);
        addMoney(cash); addHonor(6); sfx.coin();
      };
      G.ui.toast('Someone is shouting for help nearby.');
    }
  }
}
