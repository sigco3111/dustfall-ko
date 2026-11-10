// People and animals: skinned, skeletally animated models dressed and coloured in code.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pick, clamp } from './core.js';
import { A } from './assets.js';

const SKINS = [0xe0ac69, 0xc68642, 0x8d5524, 0xf1c27d, 0xffdbac, 0xa5673f];
const SHIRTS = [0x8a5a44, 0x4f6d7a, 0x9c8b5e, 0x6b4f4f, 0xb9a888, 0x556b4a, 0x7a3a26, 0x8a7ea0, 0xc9b27c];
const PANTS = [0x3d3d52, 0x4a3b2a, 0x2f3a33, 0x5a4a3a, 0x33302c];
const HATS = [0x2a2018, 0x5a4330, 0x8a7350, 0x1d1d1d, 0xb9a070];
const HAIRS = [0x2a1c12, 0x4a3324, 0x8a8a84, 0x1b1512, 0x9a6a3a];

const controllers = [];
const v = new THREE.Vector3(), q1 = new THREE.Quaternion();
const lam = (color, extra) => new THREE.MeshLambertMaterial({ color, ...extra });
const matCache = new Map();
const cm = (color) => { let m = matCache.get(color); if (!m) matCache.set(color, m = lam(color)); return m; };
function part(geo, color, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, typeof color === 'number' ? cm(color) : color); m.position.set(x, y, z); m.castShadow = true; return m; }

// ---------- animation controller ----------
class Ctl {
  constructor(root, holder, clips) {
    this.root = root; this.holder = holder; this.clips = clips; this.mixer = new THREE.AnimationMixer(root);
    this.acts = {}; this.tgt = {}; this.ts = {}; this.dead = false; this.post = null;
    controllers.push(this);
  }
  a(name) {
    let x = this.acts[name];
    if (!x) { const c = this.clips[name]; if (!c) return null; x = this.mixer.clipAction(c); x.w = 0; x.setEffectiveWeight(0); this.acts[name] = x; }
    return x;
  }
  set(tgt, ts) { this.tgt = tgt; this.ts = ts || {}; }
  shot(name) {
    const x = this.a(name); if (!x || this.dead) return;
    x.reset(); x.setLoop(THREE.LoopOnce, 1); x.clampWhenFinished = true; x.isShot = true; x.shotT = x.getClip().duration; x.timeScale = 1; x.play();
  }
  die(name) {
    if (this.dead) return; this.dead = true; this.tgt = { [name]: 1 };
    const x = this.a(name); if (!x) return;
    x.reset(); x.setLoop(THREE.LoopOnce, 1); x.clampWhenFinished = true; x.play();
  }
  revive() { if (!this.dead) return; this.dead = false; this.mixer.stopAllAction(); for (const k in this.acts) this.acts[k].w = 0; }
  snap() { for (const k in this.tgt) { const x = this.a(k); if (x) x.w = this.tgt[k]; } }
  update(dt) {
    const k = Math.min(1, dt * 9);
    for (const name in this.tgt) this.a(name);
    for (const name in this.acts) {
      const x = this.acts[name]; let tw = this.tgt[name] || 0;
      if (x.isShot) { x.shotT -= dt; tw = x.shotT > 0.1 ? 4 : 0; if (x.shotT <= 0 && x.w < 0.02) x.isShot = false; }
      x.w += (tw - x.w) * (x.isShot ? Math.min(1, dt * 16) : k);
      if (x.w < 0.004 && tw === 0) { if (x.w !== 0) { x.stop(); x.w = 0; } continue; }
      if (!x.isRunning() && !x.paused) x.play();
      x.setEffectiveWeight(x.w);
      if (!x.isShot && this.ts[name]) x.timeScale = this.ts[name];
    }
    this.mixer.update(dt);
    if (this.post) this.post();
  }
}
export function updateAnimations(dt) {
  for (let i = controllers.length - 1; i >= 0; i--) {
    const c = controllers[i];
    if (!c.holder.parent) { c.mixer.stopAllAction(); controllers.splice(i, 1); continue; }
    if (c.holder.visible) c.update(dt);
  }
}

// ---------- humans ----------
const R = { HEAD: 0, NECK: 1, HAND: 2, TORSO: 3, UARM: 4, FARM: 5, HIPS: 6, THIGH: 7, SHIN: 8, FOOT: 9 };
function regionOf(name) {
  const n = name.toLowerCase();
  if (n.includes('head')) return R.HEAD; if (n.includes('neck')) return R.NECK;
  if (n.includes('forearm')) return R.FARM; if (n.includes('upper_arm') || n.includes('shoulder')) return R.UARM;
  if (/hand|f_|thumb/.test(n)) return R.HAND; if (n.includes('hips')) return R.HIPS;
  if (n.includes('thigh')) return R.THIGH; if (n.includes('shin')) return R.SHIN; if (/foot|toe/.test(n)) return R.FOOT;
  return R.TORSO;
}
let H = null;
const LOWER = /hips|thigh|shin|foot|toe|root/i;
function prepHuman() {
  const src = A.human.scene; src.updateMatrixWorld(true);
  // merge the mannequin's two pieces into one skinned mesh
  const meshes = []; src.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  const first = meshes[0];
  const geo = meshes.length > 1 ? mergeGeometries(meshes.map((m) => m.geometry), false) : first.geometry;
  for (let i = 1; i < meshes.length; i++) meshes[i].parent.remove(meshes[i]);
  first.geometry = geo;
  const pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, n = pos.count;
  const reg = new Uint8Array(n), P = new Float32Array(n * 3), inv = first.matrixWorld.clone().invert();
  for (let i = 0; i < n; i++) {
    let bk = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; bk = si.getComponent(i, k); } }
    reg[i] = regionOf(first.skeleton.bones[bk].name);
    v.fromBufferAttribute(pos, i).applyMatrix4(first.matrixWorld); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
  }
  let top = -1e9, chin = 1e9, cz = 0, cnt = 0, hw = 0;
  for (let i = 0; i < n; i++) if (reg[i] === R.HEAD) { const y = P[i * 3 + 1]; top = Math.max(top, y); chin = Math.min(chin, y); cz += P[i * 3 + 2]; cnt++; hw = Math.max(hw, Math.abs(P[i * 3])); }
  const by = {}; for (const c of A.human.animations) by[c.name] = c;
  const sub = (c, name, upper) => new THREE.AnimationClip(name, c.duration, c.tracks.filter((t) => LOWER.test(t.name.split('.')[0]) !== upper));
  const clips = { ...by };
  for (const [k, c] of [['Idle', 'Idle_Loop'], ['Walk', 'Walk_Loop'], ['Jog', 'Jog_Fwd_Loop'], ['Sprint', 'Sprint_Loop'], ['Crouch_Idle', 'Crouch_Idle_Loop'], ['Crouch_Fwd', 'Crouch_Fwd_Loop'], ['Sit', 'Sitting_Idle_Loop']]) { clips[k] = by[c]; clips[k + '_L'] = sub(by[c], k + '_L', false); }
  for (const [k, c] of [['Aim', 'Pistol_Aim_Neutral'], ['AimUp', 'Pistol_Aim_Up'], ['AimDown', 'Pistol_Aim_Down'], ['Shoot', 'Pistol_Shoot'], ['Reload', 'Pistol_Reload'], ['Punch', 'Punch_Jab'], ['Drive', 'Driving_Loop'], ['Hit', 'Hit_Chest'], ['Interact', 'Interact']]) clips[k + '_U'] = sub(by[c], k + '_U', true);
  H = { src, geo, reg, P, inv, top, chin, cz: cz / cnt, hw, clips, geoCache: new Map(), shells: {} };
  // garments: smoothed, slightly inflated copies of parts of the body that share its skeleton
  const up = (i) => (reg[i] === R.TORSO || reg[i] === R.UARM || reg[i] === R.FARM) && P[i * 3 + 1] > 1.03;
  H.shells.shirt = makeShell(up, 0.014, 0.02, 10);
  H.shells.vest = makeShell((i) => reg[i] === R.TORSO && P[i * 3 + 1] > 1.06, 0.03, 0.036, 12);
  H.shells.coat = makeShell(up, 0.03, 0.038, 14);
  H.shells.pants = makeShell((i) => (reg[i] === R.HIPS && P[i * 3 + 1] < 1.0) || reg[i] === R.THIGH || (reg[i] === R.SHIN && P[i * 3 + 1] > 0.36), 0.012, 0.018, 8);
}
function makeShell(test, tmin, tavg, iters) {
  const g = H.geo, P = H.P, idx = g.index.array, n = P.length / 3, N0 = g.attributes.normal;
  const sel = [];
  for (let f = 0; f < idx.length; f += 3) if (test(idx[f]) && test(idx[f + 1]) && test(idx[f + 2])) sel.push(idx[f], idx[f + 1], idx[f + 2]);
  const canon = new Int32Array(n).fill(-1), map = new Map(), reps = [];
  for (const i of sel) {
    if (canon[i] >= 0) continue;
    const key = Math.round(P[i * 3] * 5000) + '_' + Math.round(P[i * 3 + 1] * 5000) + '_' + Math.round(P[i * 3 + 2] * 5000);
    let c = map.get(key); if (c === undefined) { c = reps.length; reps.push(i); map.set(key, c); }
    canon[i] = c;
  }
  const m = reps.length, nb = Array.from({ length: m }, () => new Set());
  for (let f = 0; f < sel.length; f += 3) { const a = canon[sel[f]], b = canon[sel[f + 1]], c = canon[sel[f + 2]]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  let S = new Float32Array(m * 3), S2 = new Float32Array(m * 3);
  for (let c = 0; c < m; c++) { const i = reps[c]; S[c * 3] = P[i * 3]; S[c * 3 + 1] = P[i * 3 + 1]; S[c * 3 + 2] = P[i * 3 + 2]; }
  for (let it = 0; it < iters; it++) {
    for (let c = 0; c < m; c++) {
      let x = 0, y = 0, z = 0; const k = nb[c].size;
      for (const j of nb[c]) { x += S[j * 3]; y += S[j * 3 + 1]; z += S[j * 3 + 2]; }
      S2[c * 3] = (S[c * 3] + x / k) / 2; S2[c * 3 + 1] = (S[c * 3 + 1] + y / k) / 2; S2[c * 3 + 2] = (S[c * 3 + 2] + z / k) / 2;
    }
    const t = S; S = S2; S2 = t;
  }
  const normals = (arr) => {
    const N = new Float32Array(m * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let f = 0; f < sel.length; f += 3) {
      const i0 = canon[sel[f]], i1 = canon[sel[f + 1]], i2 = canon[sel[f + 2]];
      a.fromArray(arr, i0 * 3); b.fromArray(arr, i1 * 3).sub(a); c.fromArray(arr, i2 * 3).sub(a); b.cross(c);
      for (const i of [i0, i1, i2]) { N[i * 3] += b.x; N[i * 3 + 1] += b.y; N[i * 3 + 2] += b.z; }
    }
    for (let i = 0; i < m; i++) { const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1; N[i * 3] /= l; N[i * 3 + 1] /= l; N[i * 3 + 2] /= l; }
    return N;
  };
  let N = normals(S);
  for (let c = 0; c < m; c++) {
    const i = reps[c];
    for (let k = 0; k < 3; k++) S[c * 3 + k] += N[c * 3 + k] * tavg;
    // never let the cloth sink below the body underneath it
    const nx = N0.getX(i), ny = N0.getY(i), nz = N0.getZ(i);
    const d = (S[c * 3] - P[i * 3]) * nx + (S[c * 3 + 1] - P[i * 3 + 1]) * ny + (S[c * 3 + 2] - P[i * 3 + 2]) * nz;
    if (d < tmin) { S[c * 3] += nx * (tmin - d); S[c * 3 + 1] += ny * (tmin - d); S[c * 3 + 2] += nz * (tmin - d); }
  }
  N = normals(S);
  const pos = new Float32Array(g.attributes.position.array), nor = new Float32Array(g.attributes.normal.array);
  for (let i = 0; i < n; i++) {
    const c = canon[i]; if (c < 0) continue;
    v.set(S[c * 3], S[c * 3 + 1], S[c * 3 + 2]).applyMatrix4(H.inv); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    nor[i * 3] = N[c * 3]; nor[i * 3 + 1] = N[c * 3 + 1]; nor[i * 3 + 2] = N[c * 3 + 2];
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('skinIndex', g.attributes.skinIndex); out.setAttribute('skinWeight', g.attributes.skinWeight);
  out.setIndex(sel);
  return out;
}
// front surface of the body near (x, y); the mesh is coarse, so widen the search until something is found
const surfZ = (x, y, rad = 0.03) => {
  const P = H.P;
  for (let r = rad; r < 0.2; r *= 1.6) {
    let best = -1e9;
    for (let i = 0; i < P.length; i += 3) { const dx = P[i] - x, dy = P[i + 1] - y; if (P[i + 2] > H.cz && dx * dx + dy * dy < r * r) best = Math.max(best, P[i + 2]); }
    if (best > -1e8) return best;
  }
  return H.cz + 0.1;
};
const surfX = (y, z, rad = 0.03) => {
  let best = 0; const P = H.P, reg = H.reg;
  for (let i = 0; i < P.length; i += 3) { if (reg[i / 3] !== R.HEAD) continue; const dy = P[i + 1] - y, dz = P[i + 2] - z; if (dy * dy + dz * dz < rad * rad) best = Math.max(best, Math.abs(P[i])); }
  return best;
};

const col = new THREE.Color();
function paint(L) {
  const key = JSON.stringify(L);
  let geo = H.geoCache.get(key); if (geo) return geo;
  const p = H, n = p.reg.length, out = new Float32Array(n * 3), hh = H.top - H.chin;
  const dress = L.skirt !== undefined;
  for (let i = 0; i < n; i++) {
    const x = p.P[i * 3], y = p.P[i * 3 + 1], z = p.P[i * 3 + 2];
    let c;
    switch (p.reg[i]) {
      case R.HEAD: {
        const h = (y - H.chin) / hh; c = L.skin;
        if (h > 0.8 || (z < H.cz - 0.012 && h > 0.36) || (dress && z < H.cz + 0.01 && h > 0.2)) c = L.hair;
        else if (L.beard && h < 0.34 && z > H.cz - 0.01) c = L.hair;
        if (L.bandana !== undefined && h < 0.46 && z > H.cz - 0.035) c = L.bandana;
        break;
      }
      case R.NECK: c = L.bandana !== undefined && z > H.cz - 0.02 ? L.bandana : L.skin; break;
      case R.HAND: c = L.skin; break;
      case R.TORSO: {
        c = L.shirt;
        if (L.coat !== undefined) c = Math.abs(x) < 0.035 && z > 0 ? L.shirt : L.coat;
        else if (L.vest !== undefined) c = Math.abs(x) < 0.05 && z > 0 ? L.shirt : L.vest;
        if (dress) c = L.shirt;
        if (y < 1.07 && !dress) c = Math.abs(x) < 0.035 && z > 0 ? 0xc9a23a : 0x1b1512;
        break;
      }
      case R.UARM: c = L.coat !== undefined ? L.coat : L.shirt; break;
      case R.FARM: c = L.coat !== undefined ? L.coat : L.rolled ? L.skin : L.shirt; break;
      case R.HIPS: c = dress ? L.skirt : (y > 0.99 ? (Math.abs(x) < 0.035 && z > 0 ? 0xc9a23a : 0x1b1512) : L.pants); break;
      case R.THIGH: c = dress ? L.skirt : L.pants; break;
      case R.SHIN: c = y < 0.4 ? 0x2a1c12 : (dress ? L.skin : L.pants); break;
      default: c = 0x2a1c12;
    }
    col.setHex(c); out[i * 3] = col.r; out[i * 3 + 1] = col.g; out[i * 3 + 2] = col.b;
  }
  geo = new THREE.BufferGeometry();
  for (const k in p.geo.attributes) geo.setAttribute(k, p.geo.attributes[k]);
  geo.setIndex(p.geo.index); geo.setAttribute('color', new THREE.BufferAttribute(out, 3));
  H.geoCache.set(key, geo);
  return geo;
}

let humanMat, hatGeo, bandGeo, gunParts;
const FACE = {
  eye: new THREE.SphereGeometry(0.0125, 10, 8), pupil: new THREE.SphereGeometry(0.0088, 8, 6), brow: new THREE.BoxGeometry(0.04, 0.008, 0.012),
  ear: new THREE.SphereGeometry(0.026, 8, 6), nose: new THREE.SphereGeometry(0.014, 8, 6), mouth: new THREE.BoxGeometry(0.046, 0.006, 0.008), collar: new THREE.TorusGeometry(0.058, 0.014, 6, 16), stache: new THREE.BoxGeometry(0.07, 0.016, 0.014),
};
const clothMats = new Map();
function clothMat(color) { let m = clothMats.get(color); if (!m) clothMats.set(color, m = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 })); return m; }
function hatMesh(color) {
  const R0 = H.hw * 1.12;
  if (!hatGeo) {
    const pts = [[R0 * 2.35, 0.03], [R0 * 2.25, 0.012], [R0 * 1.7, -0.004], [R0 * 1.12, 0], [R0 * 1.06, 0.02], [R0 * 0.98, 0.105], [R0 * 0.82, 0.13], [R0 * 0.4, 0.118], [0, 0.11]].map(([r, y]) => new THREE.Vector2(r, y));
    hatGeo = new THREE.LatheGeometry(pts, 22); hatGeo.scale(0.92, 1, 1.12);
    bandGeo = new THREE.CylinderGeometry(R0 * 1.075, R0 * 1.09, 0.022, 20, 1, true); bandGeo.scale(0.92, 1, 1.12);
  }
  const g = new THREE.Group();
  g.add(part(hatGeo, lam(color, { side: THREE.DoubleSide })), part(bandGeo, lam(new THREE.Color(color).multiplyScalar(0.45).getHex(), { side: THREE.DoubleSide }), 0, 0.03, 0));
  return g;
}
function gunMeshes() {
  const steel = new THREE.MeshStandardMaterial({ color: 0x2b2d31, metalness: 0.8, roughness: 0.35 }), wood = lam(0x4a2c18);
  const rev = new THREE.Group();
  const barrel = part(new THREE.CylinderGeometry(0.011, 0.011, 0.17, 8), steel, 0, 0.03, 0.14); barrel.rotation.x = Math.PI / 2;
  const drum = part(new THREE.CylinderGeometry(0.023, 0.023, 0.045, 10), steel, 0, 0.025, 0.045); drum.rotation.x = Math.PI / 2;
  const grip = part(new THREE.BoxGeometry(0.026, 0.1, 0.04), wood, 0, -0.03, -0.005); grip.rotation.x = -0.35;
  rev.add(barrel, drum, part(new THREE.BoxGeometry(0.02, 0.035, 0.09), steel, 0, 0.02, 0.03), grip);
  const rifle = new THREE.Group();
  const rb = part(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 8), steel, 0, 0.035, 0.42); rb.rotation.x = Math.PI / 2;
  const stock = part(new THREE.BoxGeometry(0.035, 0.085, 0.36), wood, 0, -0.005, -0.2); stock.rotation.x = 0.12;
  rifle.add(rb, part(new THREE.BoxGeometry(0.03, 0.055, 0.3), wood, 0, 0.01, 0.2), part(new THREE.BoxGeometry(0.032, 0.06, 0.16), steel, 0, 0.02, 0.02), stock);
  return { rev, rifle };
}

export function makeHuman(o = {}) {
  if (!H) prepHuman();
  if (!humanMat) humanMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  const L = {
    skin: o.skin ?? pick(SKINS), shirt: o.shirt ?? pick(SHIRTS), pants: o.pants ?? pick(PANTS), hair: o.hair ?? pick(HAIRS),
    vest: o.vest, coat: o.coat, skirt: o.skirt, bandana: o.bandana, beard: !!o.beard, rolled: false,
  };
  const body = SkeletonUtils.clone(H.src);
  const g = new THREE.Group(); g.rotation.order = 'YXZ'; g.add(body);
  let base = null;
  body.traverse((m) => { if (m.isSkinnedMesh && !base) base = m; });
  const sphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.9);
  base.geometry = paint(L); base.material = humanMat; base.castShadow = true; base.receiveShadow = false; base.boundingSphere = sphere;
  const wear = (name, color) => {
    const s = new THREE.SkinnedMesh(H.shells[name], clothMat(color));
    s.bind(base.skeleton, base.bindMatrix); s.boundingSphere = sphere; s.castShadow = false; base.parent.add(s);
  };
  wear('shirt', L.shirt);
  if (L.skirt === undefined) wear('pants', L.pants);
  if (L.coat !== undefined) wear('coat', L.coat); else if (L.vest !== undefined) wear('vest', L.vest);
  g.updateMatrixWorld(true);
  const bone = (n) => body.getObjectByName(n);
  const head = bone('DEF-head'), handR = bone('DEF-handR'), hips = bone('DEF-hips'), chest = bone('DEF-spine003');
  const hh = H.top - H.chin;
  // face: eyes, brows, nose, mouth and ears sit on the head bone
  const stick = (m) => { m.castShadow = false; g.add(m); head.attach(m); };
  const eyeY = H.chin + hh * 0.535, skinM = cm(L.skin), darkSkin = cm(new THREE.Color(L.skin).multiplyScalar(0.72).getHex());
  for (const s of [-1, 1]) {
    const ex = s * H.hw * 0.42, ez = surfZ(ex, eyeY, 0.02);
    const white = part(FACE.eye, 0xd9d2c2, ex, eyeY, ez - 0.005); white.scale.set(1.3, 0.62, 0.6); stick(white);
    const pu = part(FACE.pupil, 0x24160c, ex, eyeY, ez - 0.0015); pu.scale.set(1, 0.8, 0.7); stick(pu);
    const b = part(FACE.brow, L.hair, ex, eyeY + 0.019, ez + 0.003); b.rotation.z = -s * 0.1; stick(b);
    const earZ = H.cz - 0.005, ear = part(FACE.ear, skinM, s * (surfX(eyeY - 0.01, earZ, 0.03) + 0.004), eyeY - 0.012, earZ); ear.scale.set(0.45, 1, 0.75); stick(ear);
  }
  const noseY = H.chin + hh * 0.38, nose = part(FACE.nose, skinM, 0, noseY + 0.006, surfZ(0, noseY, 0.02) + 0.003); nose.scale.set(0.85, 1.5, 1.1); stick(nose);
  const mouthY = H.chin + hh * 0.23;
  if (L.bandana === undefined) stick(part(FACE.mouth, darkSkin, 0, mouthY, surfZ(0, mouthY, 0.02) + 0.0005));
  if (L.beard && L.bandana === undefined) { const mz = surfZ(0, mouthY + 0.02, 0.02); const mo = part(FACE.stache, L.hair, 0, mouthY + 0.016, mz + 0.004); stick(mo); }
  if (o.hat !== false) {
    const hat = hatMesh(o.hat ?? pick(HATS)); hat.position.set(0, H.top - 0.034, H.cz - 0.004); hat.rotation.x = -0.2;
    g.add(hat); head.attach(hat);
  } else if (L.skirt !== undefined) {
    const bun = part(new THREE.SphereGeometry(H.hw * 0.62, 10, 8), L.hair, 0, H.chin + hh * 0.72, H.cz - H.hw * 1.0); g.add(bun); head.attach(bun);
  }
  if (L.skirt !== undefined) {
    const sk = part(new THREE.CylinderGeometry(0.19, 0.4, 0.86, 14, 1, true), lam(L.skirt, { side: THREE.DoubleSide }), 0, 0.57, 0.01);
    g.add(sk); hips.attach(sk);
  }
  const neckP = bone('DEF-neck').getWorldPosition(new THREE.Vector3());
  const collar = part(FACE.collar, clothMat(L.coat ?? L.shirt), 0, neckP.y + 0.012, neckP.z + 0.004); collar.rotation.x = Math.PI / 2 + 0.25; collar.scale.set(1, 1.15, 1.6); collar.castShadow = false;
  g.add(collar); chest.attach(collar);
  // body build: the base figure is very muscular, so slim it (more for women)
  const fem = L.skirt !== undefined, arm = fem ? 0.76 : 0.86;
  const scl = [[bone('DEF-upper_armL'), arm, arm], [bone('DEF-upper_armR'), arm, arm], [bone('DEF-handL'), 0.95 / arm, 0.95 / arm], [bone('DEF-handR'), 0.95 / arm, 0.95 / arm]];
  if (fem) { scl.push([bone('DEF-spine003'), 0.84, 0.9], [bone('DEF-neck'), 1 / 0.84, 1 / 0.9], [bone('DEF-spine001'), 0.86, 0.9], [bone('DEF-spine002'), 1, 1]); body.scale.setScalar(0.94); }
  if (o.badge) {
    const z = surfZ(0.1, 1.36, 0.03), b = part(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 5), new THREE.MeshStandardMaterial({ color: 0xe0a526, metalness: 0.7, roughness: 0.3 }), 0.1, 1.36, z + 0.004);
    b.rotation.x = Math.PI / 2; g.add(b); chest.attach(b);
  }
  // weapons ride in the right hand; orientation is derived from the forearm in the rest pose
  if (!gunParts) gunParts = gunMeshes();
  const hp = handR.getWorldPosition(new THREE.Vector3()), fp = bone('DEF-forearmR').getWorldPosition(new THREE.Vector3());
  const dir = hp.clone().sub(fp).normalize();
  const mount = new THREE.Group(); mount.position.copy(hp).addScaledVector(dir, 0.085);
  mount.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  mount.rotateZ(GUN_ROLL);
  const rev = gunParts.rev.clone(), rifle = gunParts.rifle.clone(); rev.visible = rifle.visible = false;
  mount.add(rev, rifle); g.add(mount); handR.attach(mount);

  const ctl = new Ctl(body, g, H.clips);
  const thL = bone('DEF-thighL'), thR = bone('DEF-thighR');
  ctl.post = () => {
    for (const [b, sx, sz] of scl) { b.scale.x = sx; b.scale.z = sz; }
    if (ctl.riding) { thL.rotateZ(-RIDE_SPREAD); thR.rotateZ(RIDE_SPREAD); }
  };
  ctl.set({ Idle: 1 }); ctl.snap(); ctl.update(Math.random() * 2);
  g.userData = { ctl, rev, rifle, human: true };
  return g;
}
export const TUNE = { gunRoll: Math.PI / 2, rideSpread: 0.5 };
const GUN_ROLL = Math.PI / 2, RIDE_SPREAD = 0.5;
// how far below the saddle a seated rider's root sits
export const SIT_DROP = 0.5;

// state: { speed, pose: idle|ride|cower|dead, aim, pitch, weapon, crouch }
export function poseHuman(g, s) {
  const { ctl, rev, rifle } = g.userData, w = s.weapon || 'none';
  rev.visible = w === 'revolver'; rifle.visible = w === 'rifle' || w === 'bow';
  if (s.pose === 'dead') { ctl.riding = false; ctl.die('Death01'); return; }
  if (ctl.dead) ctl.revive();
  const sp = s.speed || 0, t = {}, ts = {};
  let loco = 'Idle';
  ctl.riding = s.pose === 'ride';
  if (s.pose === 'ride') loco = 'Sit';
  else if (s.pose === 'cower') loco = 'Crouch_Idle';
  else if (s.crouch) { loco = sp > 0.2 ? 'Crouch_Fwd' : 'Crouch_Idle'; ts.Crouch_Fwd = ts.Crouch_Fwd_L = clamp(sp / 1.4, 0.5, 2); }
  else if (sp < 0.2) loco = 'Idle';
  else if (sp < 2.7) { loco = 'Walk'; ts.Walk = ts.Walk_L = clamp(sp / 1.5, 0.5, 2); }
  else if (sp < 5.6) { loco = 'Jog'; ts.Jog = ts.Jog_L = clamp(sp / 3.6, 0.6, 1.8); }
  else { loco = 'Sprint'; ts.Sprint = ts.Sprint_L = clamp(sp / 6.2, 0.7, 1.6); }
  if (s.aim && w !== 'none') {
    const p = clamp((s.pitch || 0) / 0.75, -1, 1);
    t[loco + '_L'] = 1; t.Aim_U = 1 - Math.abs(p); if (p > 0) t.AimUp_U = p; else if (p < 0) t.AimDown_U = -p;
  } else if (s.pose === 'ride') { t.Sit_L = 1; t.Drive_U = 1; }
  else t[loco] = 1;
  ctl.set(t, ts);
}
// kind: shoot | reload | punch | hit | interact
export function humanAction(g, kind) {
  const name = { shoot: 'Shoot_U', reload: 'Reload_U', punch: 'Punch_U', hit: 'Hit_U', interact: 'Interact_U' }[kind];
  if (name) g.userData.ctl.shot(name);
}

// ---------- animals ----------
// gameplay sizes (hit testing, saddles); the visuals come from the models
export const QUADS = {
  horse: { bl: 2.0, bh: 0.7, bw: 0.55, legL: 0.9, neckL: 0.8, headL: 0.55, len: 2.5, src: 'horse', color: 0x6b4226 },
  deer: { bl: 1.25, bh: 0.45, bw: 0.36, legL: 0.6, neckL: 0.55, headL: 0.36, len: 1.6, src: 'horse', color: 0xa9783f },
  wolf: { bl: 1.0, bh: 0.36, bw: 0.3, legL: 0.42, neckL: 0.25, headL: 0.34, len: 1.45, src: 'wolf', color: 0x77766f },
  cow: { bl: 1.8, bh: 0.8, bw: 0.7, legL: 0.6, neckL: 0.35, headL: 0.5, len: 2.4, src: 'cow', color: 0x6e4a2e },
};
QUADS.rabbit = QUADS.deer;
const T = {};
function prepQuad(key) {
  const src = A[key].scene; src.updateMatrixWorld(true);
  const box = new THREE.Box3(), meshes = [];
  src.traverse((o) => { if (o.isSkinnedMesh) { o.skeleton.update(); meshes.push(o); } });
  const pts = [];
  for (const m of meshes) { const n = m.geometry.attributes.position.count; for (let i = 0; i < n; i++) { m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld); box.expandByPoint(v); pts.push(v.x, v.y, v.z); } }
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const alongX = size.x > size.z;
  let headSign = 1, hb = null;
  src.traverse((o) => { if (o.isBone && /^head$/i.test(o.name)) hb = o; });
  if (hb) { hb.getWorldPosition(v); headSign = (alongX ? v.x - c.x : v.z - c.z) >= 0 ? 1 : -1; }
  else {      // no named head: the end that carries more of the height is the front
    let front = 0, back = 0;
    for (let i = 0; i < pts.length; i += 3) { const a = (alongX ? pts[i] - c.x : pts[i + 2] - c.z); if (pts[i + 1] > c.y + size.y * 0.2) { if (a > 0) front++; else back++; } }
    headSign = front >= back ? 1 : -1;
  }
  let backY = 0; const half = (alongX ? size.x : size.z) * 0.12;
  for (let i = 0; i < pts.length; i += 3) { const a = alongX ? pts[i] - c.x : pts[i + 2] - c.z; if (Math.abs(a) < half) backY = Math.max(backY, pts[i + 1] - box.min.y); }
  const clips = {}; for (const cl of A[key].animations) clips[cl.name.split('|').pop()] = cl;
  T[key] = { src, len: alongX ? size.x : size.z, rotY: alongX ? (headSign > 0 ? -Math.PI / 2 : Math.PI / 2) : (headSign > 0 ? 0 : Math.PI), c, minY: box.min.y, backY, clips };
}

export function makeQuad(species, o = {}) {
  const q = QUADS[species] || QUADS.deer, key = q.src;
  if (!T[key]) prepQuad(key);
  const t = T[key], s = q.len / t.len;
  const model = SkeletonUtils.clone(t.src);
  const inner = new THREE.Group(), g = new THREE.Group(); g.rotation.order = 'YXZ';
  model.position.set(-t.c.x, -t.minY, -t.c.z);
  inner.add(model); inner.rotation.y = t.rotY; inner.scale.setScalar(s);
  if (species === 'deer') inner.scale.set(s * 0.82, s, s);
  g.add(inner);
  const base = new THREE.Color(o.color ?? q.color);
  let mi = 0;
  model.traverse((m) => {
    if (!m.isSkinnedMesh) return;
    m.castShadow = true; m.frustumCulled = false;
    const mat = m.material.clone(); mat.roughness = 0.9; mat.metalness = 0;
    if (key === 'horse') mat.color.copy(base).multiplyScalar(mi === 0 ? 1 : species === 'deer' ? 0.9 : 0.3);
    else if (key === 'wolf') mat.color.copy(base);
    else if (o.color !== undefined && mi === 0) mat.color.copy(base);
    m.material = mat; mi++;
  });
  g.updateMatrixWorld(true);
  const seatY = t.backY * s;
  if (o.saddle) {
    const sad = new THREE.Group();
    const seat = part(new THREE.SphereGeometry(0.3, 12, 8), 0x4a2c18, 0, seatY - 0.06, -0.05); seat.scale.set(0.95, 0.35, 1.25);
    const blanket = part(new THREE.BoxGeometry(0.62, 0.03, 0.8), 0x7a2318, 0, seatY - 0.07, -0.05);
    const horn = part(new THREE.CylinderGeometry(0.03, 0.045, 0.12, 8), 0x3a2212, 0, seatY + 0.07, 0.24);
    sad.add(seat, blanket, horn);
    for (const sx of [-1, 1]) sad.add(part(new THREE.BoxGeometry(0.03, 0.5, 0.05), 0x3a2212, sx * 0.31, seatY - 0.33, 0.02), part(new THREE.BoxGeometry(0.06, 0.03, 0.13), 0x55585c, sx * 0.33, seatY - 0.58, 0.03));
    g.add(sad);
    const bb = model.getObjectByName('Body') || model.getObjectByName('Torso'); if (bb) bb.attach(sad);
  }
  if (species === 'deer' && o.antlers !== false && Math.random() < 0.55) {
    const hb = model.getObjectByName('Head');
    if (hb) {
      hb.getWorldPosition(v); const am = cm(0xd9cdb0);
      for (const sx of [-1, 1]) {
        const a = new THREE.Group(); a.position.set(v.x + sx * 0.06, v.y + 0.12, v.z - 0.02);
        const main = part(new THREE.CylinderGeometry(0.012, 0.02, 0.42, 5), am, 0, 0.2, 0); a.add(main);
        const t1 = part(new THREE.CylinderGeometry(0.008, 0.012, 0.2, 5), am, 0, 0.24, 0.07); t1.rotation.x = 0.8; a.add(t1);
        const t2 = part(new THREE.CylinderGeometry(0.008, 0.012, 0.16, 5), am, 0, 0.36, 0.05); t2.rotation.x = 0.7; a.add(t2);
        a.rotation.z = -sx * 0.45; a.rotation.x = -0.25; g.add(a); hb.attach(a);
      }
    }
  }
  const ctl = new Ctl(model, g, t.clips);
  ctl.set({ Idle: 1 }); ctl.snap(); ctl.update(Math.random() * 2);
  g.userData = { ctl, q, seatY, key, hasDeath: !!t.clips.Death };
  return g;
}

export function poseQuad(g, speed, dead = false) {
  const { ctl, key, hasDeath } = g.userData;
  if (dead) { if (hasDeath) ctl.die('Death'); else ctl.set({ Idle: 1 }, { Idle: 0.0001 }); return; }
  if (ctl.dead) ctl.revive();
  if (key === 'wolf') {
    if (speed < 0.2) ctl.set({ Idle: 1 }); else ctl.set({ Walking: 1 }, { Walking: clamp(speed / 1.4, 0.8, 4.5) });
    return;
  }
  const sc = g.userData.q.len / 2.5;
  if (speed < 0.2) ctl.set({ Idle: 1 });
  else if (speed < 1.8 * sc) ctl.set({ WalkSlow: 1 }, { WalkSlow: clamp(speed / (1.1 * sc), 0.6, 2) });
  else if (speed < 5.5 * sc) ctl.set({ Walk: 1 }, { Walk: clamp(speed / (2.6 * sc), 0.7, 2.4) });
  else ctl.set({ Run: 1 }, { Run: clamp(speed / (9.5 * sc), 0.7, 1.9) });
}
