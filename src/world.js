// Terrain, sky, weather, scenery, collision and small visual effects.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, clamp, lerp, rand, smoothstep, sfx } from './core.js';
import { A } from './assets.js';
import { tx } from './i18n.js';

export const WORLD = 1400, HALF = 700, WATER_Y = -1.1, BRIDGE_Y = 2.75;

export const SITES = {
  town: { x: 0, z: 0, r: 100, name: 'Marrow Creek' },
  camp: { x: -230, z: 140, r: 26, name: 'Hollow Camp' },
  ranch: { x: -60, z: -260, r: 56, name: 'Finch Ranch' },
  gulch: { x: -380, z: -330, r: 34, name: 'Vulture Gulch' },
  depot: { x: 120, z: 330, r: 70, name: 'Thorne Rail Depot' },
  thorne: { x: 480, z: -120, r: 64, name: 'Thorne Ranch' },
  mesa: { x: -420, z: 300, r: 30, name: 'Dry Bones Mesa' },
  bridge: { x: 300, z: 0, r: 60, name: 'Sorrel Bridge' },
};

export const ROADS = [
  [-100, 0, 100, 0], [100, 0, 300, 0], [300, 0, 400, -40], [400, -40, 480, -100],
  [-100, 0, -170, 80], [-170, 80, -225, 130],
  [-10, -20, -40, -140], [-40, -140, -60, -215],
  [30, 20, 80, 180], [80, 180, 115, 290],
  [-60, -230, -220, -300], [-220, -300, -360, -325],
  [-225, 130, -330, 230], [-330, 230, -405, 290],
];

// ---------- noise ----------
function hash(ix, iz) {
  let n = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let fx = x - ix, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
function fbm(x, z, oct) {
  let s = 0, amp = 0.5, tot = 0;
  for (let i = 0; i < oct; i++) { s += vnoise(x, z) * amp; tot += amp; amp *= 0.5; x = x * 2.03 + 17.1; z = z * 2.03 + 9.7; }
  return s / tot;
}

// ---------- height ----------
export const riverX = (z) => 300 + 70 * Math.sin(z * 0.007);
function rawH(x, z) {
  const n = fbm(x * 0.0035 + 11.3, z * 0.0035 + 4.7, 4);
  let h = 2 + Math.pow(n, 1.7) * 70;
  h += (fbm(x * 0.02 + 50, z * 0.02 + 50, 3) - 0.5) * 5;
  const rim = smoothstep(590, 700, Math.hypot(x, z));
  return h + rim * rim * 130;
}
for (const k in SITES) { const s = SITES[k]; s.h = k === 'bridge' ? 2.6 : clamp(rawH(s.x, s.z), 4, 16); }
const siteList = Object.values(SITES);

export function terrainH(x, z) {
  let h = rawH(x, z);
  for (const s of siteList) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r * 1.9) h = lerp(h, s.h, 1 - smoothstep(s.r, s.r * 1.9, d));
  }
  const rd = Math.abs(x - riverX(z));
  if (rd < 44) h = lerp(h, -3.2, 1 - smoothstep(9, 44, rd));
  return h;
}
export function groundHeight(x, z) {
  const h = terrainH(x, z);
  if (Math.abs(z) < 3.6 && Math.abs(x - 300) < 46) return Math.max(h, BRIDGE_Y);
  return h;
}
export const siteDist = (key, x, z) => Math.hypot(x - SITES[key].x, z - SITES[key].z);
export function nearestSite(x, z) {
  let best = null;
  for (const k in SITES) { const d = siteDist(k, x, z) - SITES[k].r; if (!best || d < best.d) best = { key: k, site: SITES[k], d }; }
  return best;
}
export const inTown = (x, z) => siteDist('town', x, z) < 105;
export const inWater = (x, z) => terrainH(x, z) < WATER_Y - 0.25 && !(Math.abs(z) < 3.6 && Math.abs(x - 300) < 46);

function roadDist(x, z) {
  let best = 1e9;
  for (const r of ROADS) {
    const ax = r[0], az = r[1], bx = r[2], bz = r[3];
    const vx = bx - ax, vz = bz - az;
    const t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1);
    const d = Math.hypot(x - ax - vx * t, z - az - vz * t);
    if (d < best) best = d;
  }
  return best;
}

const C_DRY = [0.60, 0.48, 0.29], C_GRASS = [0.40, 0.45, 0.19], C_LUSH = [0.21, 0.36, 0.13],
  C_ROCK = [0.36, 0.31, 0.26], C_DIRT = [0.44, 0.32, 0.20], C_BED = [0.28, 0.25, 0.17];
function mix3(a, b, t, o) { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; }
function terrainColor(x, z, h, o) {
  const m = fbm(x * 0.006 + 9.1, z * 0.006 + 3.3, 3);
  mix3(C_DRY, C_GRASS, smoothstep(0.38, 0.62, m), o);
  const rd = Math.abs(x - riverX(z));
  mix3(o, C_LUSH, (1 - smoothstep(40, 120, rd)) * 0.75, o);
  mix3(o, C_ROCK, smoothstep(42, 72, h), o);
  if (h < WATER_Y + 0.5) mix3(o, C_BED, 1, o);
  let rw = 1 - smoothstep(2.5, 6, roadDist(x, z));
  if (Math.abs(x) < 92 && Math.abs(z) < 11) rw = 1;
  mix3(o, C_DIRT, rw * 0.9, o);
  const j = (hash(Math.floor(x * 3), Math.floor(z * 3)) - 0.5) * 0.05;
  o[0] += j; o[1] += j; o[2] += j;
  return m;
}

// ---------- collision ----------
const CELL = 24, grid = new Map();
export const boxes = [];
const cellKey = (cx, cz) => cx * 4096 + cz;
function gridAdd(c, minx, minz, maxx, maxz) {
  for (let cx = Math.floor(minx / CELL); cx <= Math.floor(maxx / CELL); cx++)
    for (let cz = Math.floor(minz / CELL); cz <= Math.floor(maxz / CELL); cz++) {
      const k = cellKey(cx, cz); let arr = grid.get(k);
      if (!arr) grid.set(k, arr = []);
      arr.push(c);
    }
}
export function addBox(minx, minz, maxx, maxz, y0, h) {
  const b = { t: 0, minx, minz, maxx, maxz, y0, y1: y0 + h };
  boxes.push(b); gridAdd(b, minx, minz, maxx, maxz);
}
export function addCircle(x, z, r) { gridAdd({ t: 1, x, z, r }, x - r, z - r, x + r, z + r); }
export function resolveCollision(pos, rad) {
  const cx = Math.floor(pos.x / CELL), cz = Math.floor(pos.z / CELL);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const arr = grid.get(cellKey(cx + i, cz + j));
    if (!arr) continue;
    for (const c of arr) {
      if (c.t === 1) {
        const dx = pos.x - c.x, dz = pos.z - c.z, rr = rad + c.r, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = c.x + dx / d * rr; pos.z = c.z + dz / d * rr; }
      } else {
        const nx = clamp(pos.x, c.minx, c.maxx), nz = clamp(pos.z, c.minz, c.maxz);
        const dx = pos.x - nx, dz = pos.z - nz, d2 = dx * dx + dz * dz;
        if (d2 >= rad * rad) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); pos.x = nx + dx / d * rad; pos.z = nz + dz / d * rad; }
        else {
          const l = pos.x - c.minx, r = c.maxx - pos.x, t = pos.z - c.minz, b = c.maxz - pos.z, m = Math.min(l, r, t, b);
          if (m === l) pos.x = c.minx - rad; else if (m === r) pos.x = c.maxx + rad;
          else if (m === t) pos.z = c.minz - rad; else pos.z = c.maxz + rad;
        }
      }
    }
  }
}
// Distance along a ray to the first wall or hillside, or Infinity.
export function rayBlocked(o, d, maxT) {
  let best = maxT;
  for (const b of boxes) {
    let t0 = 0, t1 = best, ok = true;
    const ax = [[o.x, d.x, b.minx, b.maxx], [o.y, d.y, b.y0, b.y1], [o.z, d.z, b.minz, b.maxz]];
    for (const [oo, dd, mn, mx] of ax) {
      if (Math.abs(dd) < 1e-7) { if (oo < mn || oo > mx) { ok = false; break; } }
      else {
        let a = (mn - oo) / dd, c = (mx - oo) / dd;
        if (a > c) { const s = a; a = c; c = s; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, c);
        if (t0 > t1) { ok = false; break; }
      }
    }
    if (ok && t0 < best) best = t0;
  }
  for (let t = 2; t < best; t += 2) {
    if (o.y + d.y * t < terrainH(o.x + d.x * t, o.z + d.z * t) - 0.2) { best = t; break; }
  }
  return best >= maxT ? Infinity : best;
}

// ---------- building blocks ----------
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const mats = new Map();
export function mat(color, extra) {
  if (extra) return new THREE.MeshLambertMaterial({ color, ...extra });
  let m = mats.get(color);
  if (!m) mats.set(color, m = new THREE.MeshLambertMaterial({ color }));
  return m;
}
export function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const me = new THREE.Mesh(UNIT, typeof m === 'number' ? mat(m) : m);
  me.scale.set(w, h, d); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true;
  return me;
}
function cyl(rt, rb, h, m, x, y, z, seg = 10) {
  const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof m === 'number' ? mat(m) : m);
  me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true;
  return me;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let plankTex = null;
function planks() {
  if (plankTex) return plankTex;
  plankTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ddd'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      const v = 195 + rand(50) | 0;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x + 1, 0, 14, h);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, 0, 1.5, h);
      for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x + rand(14), rand(h), 1, rand(10, 40)); }
    }
  });
  plankTex.wrapS = plankTex.wrapT = THREE.RepeatWrapping;
  return plankTex;
}
function wallMat(color, w, h) {
  const t = A.tex.planks.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, w / 3.2), Math.max(1, h / 3.2));
  return new THREE.MeshLambertMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.5).multiplyScalar(1.5), map: t });
}
function signMesh(text, w, h, bg = '#2a1a10', fg = '#f1e3c6') {
  text = tx(text);
  const tex = canvasTex(512, Math.round(512 * h / w), (g, cw, ch) => {
    g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, cw - 16, ch - 16);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = ch * 0.5; g.font = `bold ${size}px Rockwell, Georgia, "Noto Serif KR", "Nanum Myeongjo", "Malgun Gothic", "Apple SD Gothic Neo", serif`;
    while (g.measureText(text).width > cw - 50 && size > 12) { size -= 2; g.font = `bold ${size}px Rockwell, Georgia, "Noto Serif KR", "Nanum Myeongjo", "Malgun Gothic", "Apple SD Gothic Neo", serif`; }
    g.fillText(text, cw / 2, ch / 2 + 2);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex }));
}

let windowMat, lampMat;
const fires = [], lamps = [];

function gableRoof(w, d, rh, color) {
  const sh = new THREE.Shape();
  sh.moveTo(-d / 2 - 0.5, 0); sh.lineTo(d / 2 + 0.5, 0); sh.lineTo(0, rh); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: w + 0.8, bevelEnabled: false });
  const m = new THREE.Mesh(geo, mat(color));
  m.rotation.y = Math.PI / 2; m.position.x = -(w + 0.8) / 2;
  m.castShadow = true;
  return m;
}

function addBuilding(o) {
  const { x, z, w = 14, d = 11, h = 5, face = 1, wall = 0x9b7653, roof = 0x4a3324, sign, falseFront = true, porch = true } = o;
  const y = groundHeight(x, z);
  const g = new THREE.Group(); g.position.set(x, y, z);
  if (face < 0) g.rotation.y = Math.PI;
  g.add(box(w, h, d, wallMat(wall, w, h), 0, h / 2, 0));
  const rf = gableRoof(w, d, o.roofH || 2.2, roof); rf.position.y = h; g.add(rf);
  const fz = d / 2;
  if (falseFront) g.add(box(w + 0.4, h + 2.4, 0.35, wallMat(wall, w, h + 2.4), 0, (h + 2.4) / 2, fz + 0.05));
  g.add(box(1.4, 2.4, 0.12, 0x2a1c12, 0, 1.2, fz + 0.26));
  const nWin = Math.max(1, Math.floor(w / 6));
  for (let i = 0; i < nWin; i++) for (const s of [-1, 1]) {
    const wx = s * (2.2 + i * 2.6);
    if (Math.abs(wx) > w / 2 - 1) continue;
    g.add(box(1.3, 1.3, 0.1, windowMat, wx, 2.1, fz + 0.26));
    if (h > 6.5) g.add(box(1.3, 1.3, 0.1, windowMat, wx, 5.4, fz + 0.26));
  }
  for (const s of [-1, 1]) g.add(box(0.1, 1.3, 1.4, windowMat, s * (w / 2 + 0.02), 2.2, 0));
  if (porch) {
    g.add(box(w, 0.14, 3, 0x6b5138, 0, 0.07, fz + 1.6));
    g.add(box(w + 0.2, 0.14, 3.3, roof, 0, 3.15, fz + 1.7));
    const n = Math.max(2, Math.round(w / 5));
    for (let i = 0; i <= n; i++) g.add(box(0.18, 3.1, 0.18, 0x5a4330, -w / 2 + 0.2 + i * (w - 0.4) / n, 1.55, fz + 3));
  }
  if (sign) {
    const s = signMesh(sign, Math.min(w - 1, 9), 1.5, o.signBg, o.signFg);
    s.position.set(0, falseFront ? h + 1.2 : h - 0.9, fz + (falseFront ? 0.24 : 0.08)); g.add(s);
  }
  G.scene.add(g);
  addBox(x - w / 2, z - d / 2, x + w / 2, z + d / 2, y, h + 3);
  return g;
}

function addTent(x, z, rot = 0, color = 0xd9cdb0) {
  const y = groundHeight(x, z);
  const sh = new THREE.Shape(); sh.moveTo(-1.6, 0); sh.lineTo(1.6, 0); sh.lineTo(0, 2.1); sh.closePath();
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 3.4, bevelEnabled: false }), mat(color));
  m.position.set(x, y, z); m.rotation.y = rot; m.castShadow = true; m.receiveShadow = true;
  G.scene.add(m);
  addCircle(x + Math.sin(rot) * 1.7, z + Math.cos(rot) * 1.7, 1.5);
}
function addFire(x, z, lit = true) {
  const y = groundHeight(x, z);
  const g = new THREE.Group(); g.position.set(x, y, z);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; g.add(box(0.3, 0.22, 0.3, 0x6e6a64, Math.cos(a) * 0.75, 0.1, Math.sin(a) * 0.75)); }
  for (let i = 0; i < 3; i++) { const l = box(0.16, 0.16, 1.1, 0x3a2616, 0, 0.14, 0); l.rotation.y = i * 1.05; g.add(l); }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1, 6), new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.9 }));
  flame.position.y = 0.65; g.add(flame);
  const light = new THREE.PointLight(0xff8a3a, 0, 34, 1.6); light.position.y = 1.2; g.add(light);
  G.scene.add(g);
  fires.push({ flame, light, lit });
  addCircle(x, z, 0.7);
}
function addCrate(x, z, s = 0.9, color = 0x8a6a42) {
  const b = box(s, s, s, color, x, groundHeight(x, z) + s / 2, z); b.rotation.y = rand(1.5); G.scene.add(b); addCircle(x, z, s * 0.6);
}
function addBarrel(x, z) { G.scene.add(cyl(0.42, 0.42, 1.05, 0x70502e, x, groundHeight(x, z) + 0.52, z)); addCircle(x, z, 0.45); }
function fenceRect(minx, minz, maxx, maxz, color = 0x7a6248) {
  const pts = [[minx, minz, maxx, minz], [maxx, minz, maxx, maxz], [maxx, maxz, minx, maxz], [minx, maxz, minx, minz]];
  const g = new THREE.Group();
  for (const [ax, az, bx, bz] of pts) {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 3.5);
    for (let i = 0; i < n; i++) {
      const px = ax + (bx - ax) * i / n, pz = az + (bz - az) * i / n;
      g.add(box(0.16, 1.3, 0.16, color, px, groundHeight(px, pz) + 0.65, pz));
    }
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, my = groundHeight(mx, mz);
    for (const ry of [0.55, 1.05]) {
      const r = box(ax === bx ? 0.08 : len, 0.1, ax === bx ? len : 0.08, color, mx, my + ry, mz);
      r.castShadow = false; g.add(r);
    }
  }
  G.scene.add(g);
}
function addLamp(x, z) {
  const y = groundHeight(x, z);
  G.scene.add(box(0.14, 3.4, 0.14, 0x2b2118, x, y + 1.7, z));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lampMat); bulb.position.set(x, y + 3.55, z); G.scene.add(bulb);
  const light = new THREE.PointLight(0xffc878, 0, 32, 1.6); light.position.set(x, y + 3.5, z); G.scene.add(light);
  lamps.push(light); addCircle(x, z, 0.2);
}

function buildTown() {
  const N = -17, S = 17;
  addBuilding({ x: -58, z: N, w: 12, wall: 0x7d6a55, sign: 'SHERIFF', signBg: '#1d1410' });
  addBuilding({ x: -40, z: N, w: 14, wall: 0xa9814f, sign: "FINCH'S GENERAL STORE", signBg: '#7a2318' });
  addBuilding({ x: -18, z: N, w: 18, h: 8, d: 12, wall: 0x8c3b2e, sign: 'THE GILDED MULE SALOON', signBg: '#e0a526', signFg: '#1d1410' });
  addBuilding({ x: 6, z: N, w: 16, h: 8, d: 12, wall: 0xb9a888, sign: 'CRANE HOTEL', signBg: '#23404a' });
  addBuilding({ x: 28, z: N, w: 11, wall: 0x92865f, sign: 'TELEGRAPH & POST', signBg: '#1d1410' });
  addBuilding({ x: -52, z: S, w: 12, face: -1, wall: 0x6f5a48, sign: 'KESSLER GUNSMITH', signBg: '#1d1410' });
  addBuilding({ x: -34, z: S, w: 12, face: -1, wall: 0xc8c1ad, sign: 'DR. HALE  PHYSICIAN', signBg: '#23404a' });
  addBuilding({ x: -8, z: S + 1.5, w: 22, d: 14, h: 6, face: -1, wall: 0x7a3a26, sign: 'PIKE LIVERY STABLE', signBg: '#f1e3c6', signFg: '#1d1410', falseFront: false, roofH: 3.4 });
  addBuilding({ x: 20, z: S, w: 12, face: -1, wall: 0x54524c, sign: 'UNDERTAKER', signBg: '#111' });
  addBuilding({ x: 42, z: S, w: 13, face: -1, wall: 0x9a7b55, sign: 'FEED & TACK', signBg: '#3d5a2a' });
  // church with steeple at the east end
  const ch = addBuilding({ x: 62, z: -24, w: 10, d: 16, h: 6, wall: 0xe6e0d0, roof: 0x3d3a3a, falseFront: false, porch: false, roofH: 3.5 });
  ch.add(box(2.6, 6, 2.6, 0xe6e0d0, 0, 9.5, 5.5));
  const sp = new THREE.Mesh(new THREE.ConeGeometry(2.3, 4.5, 4), mat(0x3d3a3a)); sp.position.set(0, 14.7, 5.5); sp.rotation.y = Math.PI / 4; ch.add(sp);
  // water tower
  const ty = groundHeight(-80, 26);
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) G.scene.add(box(0.25, 7, 0.25, 0x5a4330, -80 + dx, ty + 3.5, 26 + dz));
  G.scene.add(cyl(2.6, 2.6, 3.6, 0x80603c, -80, ty + 8.8, 26, 12));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(3, 1.5, 12), mat(0x4a3324)); cap.position.set(-80, ty + 11.35, 26); G.scene.add(cap);
  addBox(-82, 24, -78, 28, ty, 4);
  // street furniture
  for (const x of [-64, -22, 18, 50]) { addLamp(x, -7.6); }
  for (const x of [-46, 0, 34]) { addLamp(x, 7.6); }
  for (const [x, z] of [[-45, -9.5], [-13, -9.4], [10, -9.5], [-56, 9.5], [-30, 9.6], [25, 9.5], [46, 9.4]]) addBarrel(x, z);
  for (const [x, z] of [[-34.5, -9.6], [-47, 9.6], [39, 9.6], [-25.5, -9.5]]) addCrate(x, z);
  for (const x of [-48, -26, -4, 14]) {            // hitching rails
    const z = x % 8 === 0 ? -6.9 : 6.9, y = groundHeight(x, z);
    G.scene.add(box(0.14, 1.1, 0.14, 0x5a4330, x - 1.4, y + 0.55, z), box(0.14, 1.1, 0.14, 0x5a4330, x + 1.4, y + 0.55, z), box(3, 0.12, 0.12, 0x5a4330, x, y + 1.05, z));
  }
  const trough = box(2.4, 0.6, 0.8, 0x5a4330, -2, groundHeight(-2, 7) + 0.3, 7.4); G.scene.add(trough);
  const board = signMesh('WANTED', 1.6, 0.5, '#f1e3c6', '#7a2318');   // bounty board by the sheriff
  const by = groundHeight(-50, -10.6);
  G.scene.add(box(0.12, 2.2, 0.12, 0x3a2616, -50.9, by + 1.1, -10.6), box(0.12, 2.2, 0.12, 0x3a2616, -49.1, by + 1.1, -10.6), box(2, 1.3, 0.08, 0x8a6a42, -50, by + 1.6, -10.6));
  board.position.set(-50, by + 2.05, -10.54); G.scene.add(board);
  for (let i = 0; i < 4; i++) G.scene.add(box(0.36, 0.5, 0.02, 0xf1e3c6, -50.6 + i * 0.4, by + 1.5, -10.55));
}

function buildCamp() {
  const c = SITES.camp;
  addTent(c.x - 5, c.z - 3, 0.5);
  addFire(c.x + 1, c.z + 2);
  const y = groundHeight(c.x - 1.5, c.z + 4.5);
  const bed = box(0.9, 0.12, 2, 0x7a2318, c.x - 1.5, y + 0.06, c.z + 4.5); bed.rotation.y = 0.4; G.scene.add(bed);
  const log = cyl(0.25, 0.25, 2.4, 0x4a3324, c.x + 3.4, groundHeight(c.x + 3.4, c.z + 1) + 0.25, c.z + 1, 8); log.rotation.x = Math.PI / 2; G.scene.add(log);
  addCrate(c.x - 2.5, c.z - 1); addBarrel(c.x - 1.5, c.z - 1.8);
}
function buildRanch() {
  addBuilding({ x: -75, z: -276, w: 13, d: 10, wall: 0xd9d2bd, roof: 0x5a3d2b, falseFront: false, roofH: 3 });
  addBuilding({ x: -42, z: -290, w: 16, d: 20, h: 7, wall: 0x8c2f22, roof: 0x3d2a20, falseFront: false, porch: false, roofH: 4.5 });
  fenceRect(-70, -256, -34, -230);
  fenceRect(-112, -252, -80, -224);
  addBarrel(-67, -269); addCrate(-83, -269.5);
  const y = groundHeight(-60, -226);
  G.scene.add(box(0.2, 4, 0.2, 0x5a4330, -64, y + 2, -222), box(0.2, 4, 0.2, 0x5a4330, -56, y + 2, -222));
  const s = signMesh('FINCH RANCH', 8, 1.1, '#5a4330'); s.position.set(-60, y + 4.2, -222); G.scene.add(s);
}
function buildOutlawCamp(c, n) {
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + 0.4; addTent(c.x + Math.cos(a) * 9, c.z + Math.sin(a) * 9, -a + Math.PI / 2, 0xb7a783); }
  addFire(c.x, c.z);
  addCrate(c.x + 3, c.z - 4); addCrate(c.x + 4, c.z - 3.2, 0.7); addBarrel(c.x - 4, c.z + 3);
}
function buildDepot() {
  const c = SITES.depot;
  addBuilding({ x: c.x, z: c.z + 2, w: 22, d: 10, h: 5.5, wall: 0xb08a4f, roof: 0x3d2a20, sign: 'THORNE CATTLE & RAIL CO.', signBg: '#1d1410', falseFront: false, roofH: 3 });
  const y = c.h;
  G.scene.add(box(40, 0.5, 5, 0x6b5138, c.x, y + 0.25, c.z + 12.5));       // platform
  addBox(c.x - 20, c.z + 10, c.x + 20, c.z + 15, y, 0.4);
  const tz = c.z + 19;
  for (const dz of [-0.75, 0.75]) { const r = box(132, 0.14, 0.12, 0x55585c, c.x, y + 0.2, tz + dz); r.castShadow = false; G.scene.add(r); }
  const sleeper = new THREE.InstancedMesh(UNIT, mat(0x3a2a1c), 88), dm = new THREE.Object3D();
  for (let i = 0; i < 88; i++) { dm.position.set(c.x - 66 + i * 1.5, y + 0.07, tz); dm.scale.set(0.3, 0.14, 2.4); dm.updateMatrix(); sleeper.setMatrixAt(i, dm.matrix); }
  G.scene.add(sleeper);
  // locomotive and cars
  const loco = new THREE.Group(); loco.position.set(c.x + 24, y + 0.3, tz);
  const boiler = cyl(1.15, 1.15, 5.4, 0x1c1c1e, 1.2, 1.9, 0, 14); boiler.rotation.z = Math.PI / 2; loco.add(boiler);
  loco.add(box(2.6, 2.9, 2.6, 0x5a1f18, -2.6, 2.3, 0), box(2.9, 0.16, 2.9, 0x1c1c1e, -2.6, 3.8, 0));
  loco.add(cyl(0.32, 0.45, 1.3, 0x1c1c1e, 3, 3.5, 0), cyl(0.3, 0.3, 0.5, 0xb08a2e, 1.2, 3.2, 0), box(7.6, 0.4, 2.2, 0x26262a, 0.2, 0.7, 0));
  const cow = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.6, 4), mat(0x26262a)); cow.rotation.z = -Math.PI / 2; cow.position.set(4.6, 0.7, 0); loco.add(cow);
  for (const wx of [-2.6, -0.4, 1.6, 3.2]) for (const wz of [-1.05, 1.05]) { const w = cyl(0.62, 0.62, 0.2, 0x3a1512, wx, 0.6, wz, 14); w.rotation.x = Math.PI / 2; loco.add(w); }
  G.scene.add(loco); addBox(c.x + 20, tz - 1.5, c.x + 29.5, tz + 1.5, y, 4);
  for (let i = 0; i < 3; i++) {
    const cx = c.x + 12 - i * 8.6, car = new THREE.Group(); car.position.set(cx, y + 0.3, tz);
    car.add(box(7.6, 2.7, 2.5, wallMat(i === 1 ? 0x4d5a3a : 0x7a3a26, 7.6, 2.7), 0, 2.1, 0), box(7.9, 0.14, 2.8, 0x2a2a2a, 0, 3.5, 0), box(7.6, 0.3, 2.1, 0x26262a, 0, 0.75, 0));
    for (const wx of [-2.6, 2.6]) for (const wz of [-1.05, 1.05]) { const w = cyl(0.5, 0.5, 0.2, 0x26262a, wx, 0.5, wz, 12); w.rotation.x = Math.PI / 2; car.add(w); }
    G.scene.add(car); addBox(cx - 3.8, tz - 1.3, cx + 3.8, tz + 1.3, y, 4);
  }
  for (const [dx, dz] of [[-14, 13], [-12.6, 12.4], [13, 13], [-26, 6], [-27.2, 7.4], [26, 8]]) addCrate(c.x + dx, c.z + dz, 1.1);
  addLamp(c.x - 8, c.z + 9); addLamp(c.x + 9, c.z + 9);
}
function buildThorneRanch() {
  const c = SITES.thorne;
  const m = addBuilding({ x: c.x + 5, z: c.z - 16, w: 26, d: 14, h: 8.5, wall: 0xe9e4d6, roof: 0x3a3f4a, falseFront: false, roofH: 4, sign: 'THORNE', signBg: '#1d1410' });
  for (const sx of [-11, -4, 4, 11]) m.add(cyl(0.3, 0.3, 8.5, 0xf4f1ea, sx, 4.25, 10));
  addBuilding({ x: c.x - 30, z: c.z + 6, w: 16, d: 9, wall: 0x7d6a55, roof: 0x3d2a20, falseFront: false });
  addBuilding({ x: c.x + 36, z: c.z + 10, w: 14, d: 18, h: 7, wall: 0x4a3f38, roof: 0x2a2420, falseFront: false, porch: false, roofH: 4 });
  fenceRect(c.x - 50, c.z - 40, c.x + 54, c.z + 36, 0xe9e4d6);
  addLamp(c.x - 4, c.z - 3); addLamp(c.x + 14, c.z - 3);
  for (const [dx, dz] of [[-12, 12], [-10.5, 13], [20, 16], [-22, 14], [8, 24]]) addCrate(c.x + dx, c.z + dz, 1.2);
  addBarrel(c.x + 21.5, c.z + 15);
}
function buildBridge() {
  const g = new THREE.Group();
  g.add(box(94, 0.3, 7, 0x6b5138, 300, BRIDGE_Y - 0.15, 0));
  for (let x = 258; x <= 342; x += 12) for (const s of [-1, 1]) {
    g.add(box(0.4, 7, 0.4, 0x4a3324, x, BRIDGE_Y - 3.2, s * 3.3), box(0.18, 1.2, 0.18, 0x4a3324, x, BRIDGE_Y + 0.6, s * 3.4));
  }
  for (const s of [-1, 1]) g.add(box(92, 0.12, 0.12, 0x4a3324, 300, BRIDGE_Y + 1.1, s * 3.4));
  G.scene.add(g);
}

// ---------- vegetation ----------
const chunks = [];
const CH = 8, CSZ = WORLD / CH;
function templ(key) {
  const out = []; A[key].scene.updateMatrixWorld(true);
  A[key].scene.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    out.push({ geo: o.geometry.clone().applyMatrix4(o.matrixWorld), mat: new THREE.MeshLambertMaterial({ map: m.map, color: m.map ? 0xffffff : m.color, alphaTest: m.alphaTest > 0 ? 0.45 : 0, side: m.alphaTest > 0 ? THREE.DoubleSide : THREE.FrontSide }) });
  });
  return out;
}
function scatter() {
  const loPine = mergeGeometries([new THREE.ConeGeometry(2.3, 4.4, 6).translate(0, 3.6, 0), new THREE.ConeGeometry(1.7, 3.6, 6).translate(0, 5.9, 0), new THREE.ConeGeometry(1, 2.6, 6).translate(0, 7.6, 0), new THREE.CylinderGeometry(0.25, 0.3, 2.4, 5).translate(0, 1.2, 0)]);
  const loOak = mergeGeometries([new THREE.IcosahedronGeometry(2.1, 0).translate(0, 5, 0), new THREE.CylinderGeometry(0.22, 0.3, 3.6, 5).toNonIndexed().translate(0, 1.8, 0)]);
  const cactusGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.3, 0.34, 3.2, 10).translate(0, 1.6, 0), new THREE.SphereGeometry(0.3, 10, 6).translate(0, 3.2, 0),
    new THREE.CylinderGeometry(0.2, 0.2, 1.3, 8).translate(0.75, 2.2, 0), new THREE.CylinderGeometry(0.2, 0.2, 0.6, 8).rotateZ(Math.PI / 2).translate(0.45, 1.65, 0), new THREE.SphereGeometry(0.2, 8, 5).translate(0.75, 2.85, 0),
    new THREE.CylinderGeometry(0.2, 0.2, 1, 8).translate(-0.7, 1.9, 0), new THREE.CylinderGeometry(0.2, 0.2, 0.6, 8).rotateZ(Math.PI / 2).translate(-0.4, 1.45, 0), new THREE.SphereGeometry(0.2, 8, 5).translate(-0.7, 2.4, 0)]);
  const T = { pine: templ('pine5'), oak: templ('tree5'), bush: templ('bush'), fern: templ('fern'), flower: templ('flower'), plant: templ('plant') };
  const rocks = [templ('rock1'), templ('rock2'), templ('rock3')];

  const lists = { pine: [], oak: [], cactus: [], rock: [], bush: [], fern: [], flower: [], plant: [] };
  const col = [0, 0, 0];
  const tryPlace = (kind, n, radius) => {
    for (let i = 0; i < n; i++) {
      const x = rand(-HALF + 40, HALF - 40), z = rand(-HALF + 40, HALF - 40);
      if (Math.hypot(x, z) > radius) continue;
      const ns = nearestSite(x, z); if (ns.d < 8) continue;
      const rd = Math.abs(x - riverX(z));
      if (rd < 30 || roadDist(x, z) < 5) continue;
      const h = terrainH(x, z), m = terrainColor(x, z, h, col);
      let k = kind;
      if (kind === 'tree') { if (h > 62) continue; k = m > 0.55 || h > 30 ? 'pine' : m > 0.46 ? 'oak' : null; if (!k) { if (Math.random() < 0.25) k = 'cactus'; else continue; } }
      if (kind === 'cactus' && m > 0.47) continue;
      if (kind === 'green') { if (m < 0.44 && rd > 110) continue; k = Math.random() < 0.45 ? 'fern' : Math.random() < 0.5 ? 'flower' : 'plant'; }
      lists[k].push({ x, y: h, z, m, rot: rand(6.28), s: rand(0.8, 1.45) });
    }
  };
  tryPlace('tree', 4300, 665); tryPlace('cactus', 700, 640); tryPlace('rock', 800, 690); tryPlace('bush', 800, 660); tryPlace('green', 1500, 640);
  for (const [x, z] of [[-74, -8], [70, 12], [84, -14], [-90, -22], [58, 30], [-82, -262], [-96, -280], [-240, 128], [-218, 152], [470, -92], [452, -150], [512, -96]]) lists.oak.push({ x, y: terrainH(x, z), z, m: 0.5, rot: rand(6.28), s: rand(1.1, 1.5) });

  const dm = new THREE.Object3D(), c = new THREE.Color();
  const inst = (parts, arr, sc, tint, shadow, group) => {
    if (!arr.length) return;
    for (const p of parts) {
      const im = new THREE.InstancedMesh(p.geo, p.mat, arr.length);
      arr.forEach((it, i) => {
        dm.position.set(it.x, it.y - 0.12, it.z); dm.rotation.set(0, it.rot, 0); dm.scale.setScalar(it.s * sc); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix);
        const v = tint ? tint(it) : 1; if (typeof v === 'number') c.setScalar(v); else c.copy(v); im.setColorAt(i, c);
      });
      im.castShadow = shadow; im.receiveShadow = false; im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      group.add(im);
    }
  };
  const flat = (color) => [{ geo: null, mat: new THREE.MeshLambertMaterial({ color, flatShading: true }) }];
  const vary = (it) => 0.82 + ((it.x * 7.3 + it.z * 3.1) % 1 + 1) % 1 * 0.3;
  // split into a grid so far-off chunks can swap to cheap stand-ins
  for (let cj = 0; cj < CH; cj++) for (let ci = 0; ci < CH; ci++) {
    const inC = (it) => Math.floor((it.x + HALF) / CSZ) === ci && Math.floor((it.z + HALF) / CSZ) === cj;
    const pines = lists.pine.filter(inC), oaks = lists.oak.filter(inC), bushes = lists.bush.filter(inC);
    if (!pines.length && !oaks.length && !bushes.length) continue;
    const hi = new THREE.Group(), lo = new THREE.Group();
    inst(T.pine, pines, 1.05, vary, true, hi); inst(T.oak, oaks, 1.25, vary, true, hi); inst(T.bush, bushes, 1.1, vary, false, hi);
    inst(T.fern, lists.fern.filter(inC), 0.5, vary, false, hi); inst(T.flower, lists.flower.filter(inC), 0.7, null, false, hi); inst(T.plant, lists.plant.filter(inC), 1.3, vary, false, hi);
    const lp = flat(0xffffff); lp[0].geo = loPine; inst(lp, pines, 1.05, (it) => c.setRGB(0.07 + (it.m - 0.5) * 0.05, 0.19, 0.09), false, lo);
    const lk = flat(0xffffff); lk[0].geo = loOak; inst(lk, oaks, 1.25, () => c.setRGB(0.2, 0.3, 0.1), false, lo);
    hi.visible = false; G.scene.add(hi, lo);
    chunks.push({ x: (ci + 0.5) * CSZ - HALF, z: (cj + 0.5) * CSZ - HALF, hi, lo });
  }
  const all = new THREE.Group(); G.scene.add(all);
  rocks.forEach((r, k) => inst(r, lists.rock.filter((_, i) => i % 3 === k), 1, (it) => 0.75 + (it.s - 0.8) * 0.4, true, all));
  const cm = flat(0xffffff); cm[0].geo = cactusGeo; cm[0].mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  inst(cm, lists.cactus, 1, (it) => c.setRGB(0.2, 0.36 + (it.s - 0.8) * 0.1, 0.16), true, all);
  for (const p of lists.pine) addCircle(p.x, p.z, 0.4 * p.s);
  for (const p of lists.oak) addCircle(p.x, p.z, 0.45 * p.s);
  for (const p of lists.cactus) addCircle(p.x, p.z, 0.4 * p.s);
  for (const p of lists.rock) addCircle(p.x, p.z, 1.1 * p.s);
}
let lodT = 0;
function updateLod(dt) {
  lodT -= dt; if (lodT > 0 || G.dbg.lodOff) return; lodT = 0.25;
  const cam = G.camera.position;
  for (const ch of chunks) { const near = Math.hypot(ch.x - cam.x, ch.z - cam.z) < 215; ch.hi.visible = near; ch.lo.visible = !near; }
}

// ---------- terrain, water, map ----------
function buildTerrain() {
  const seg = 280, geo = new THREE.PlaneGeometry(WORLD, WORLD, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, splat = new Float32Array(pos.count * 4), c = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = terrainH(x, z);
    pos.setY(i, h);
    const w = splatAt(x, z, h); splat.set(w, i * 4);
  }
  geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { tGrass: { value: A.tex.grass }, tDry: { value: A.tex.dry }, tRock: { value: A.tex.rock }, tDirt: { value: A.tex.dirt } });
    sh.vertexShader = 'attribute vec4 splat;\nvarying vec4 vSplat;\nvarying vec2 vTuv;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSplat = splat; vTuv = position.xz;');
    sh.fragmentShader = 'uniform sampler2D tGrass, tDry, tRock, tDirt;\nvarying vec4 vSplat;\nvarying vec2 vTuv;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      vec2 u1 = vTuv * 0.16, u2 = vTuv * 0.021;
      vec3 g = texture2D(tGrass, u1).rgb * 0.6 + texture2D(tGrass, u2).rgb * 0.5;
      vec3 d = texture2D(tDry, u1 * 0.8).rgb * 0.65 + texture2D(tDry, u2 * 1.3).rgb * 0.5;
      vec3 r = texture2D(tRock, u1 * 0.45).rgb * 0.7 + texture2D(tRock, u2).rgb * 0.45;
      vec3 t = texture2D(tDirt, u1 * 0.9).rgb * 0.7 + texture2D(tDirt, u2 * 1.7).rgb * 0.45;
      vec3 alb = g * vec3(0.92, 1.0, 0.62) * vSplat.x + d * vec3(1.25, 1.08, 0.82) * vSplat.y + r * vec3(1.0, 0.94, 0.86) * vSplat.z + t * vec3(1.15, 0.98, 0.8) * vSplat.w;
      diffuseColor.rgb *= alb * 1.25;`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  G.scene.add(mesh); G.dbg.terrain = mesh;
}
// ground cover weights: grass, dry earth, rock, bare dirt
function splatAt(x, z, h) {
  const m = fbm(x * 0.006 + 9.1, z * 0.006 + 3.3, 3);
  const rd = Math.abs(x - riverX(z));
  let g = clamp(smoothstep(0.4, 0.6, m) + (1 - smoothstep(40, 120, rd)) * 0.7, 0, 1);
  const slope = Math.hypot(terrainH(x + 2.5, z) - h, terrainH(x, z + 2.5) - h) / 2.5;
  let r = clamp(smoothstep(40, 68, h) + smoothstep(0.5, 0.95, slope), 0, 1);
  let t = 1 - smoothstep(2.5, 6, roadDist(x, z));
  if (Math.abs(x) < 92 && Math.abs(z) < 11) t = 1;
  for (const k of ['ranch', 'depot', 'gulch', 'mesa', 'camp']) { const s = SITES[k]; t = Math.max(t, (1 - smoothstep(s.r * 0.35, s.r * 0.8, Math.hypot(x - s.x, z - s.z))) * 0.8); }
  if (h < WATER_Y + 0.5) { t = 1; r = 0.3; }
  g *= (1 - r) * (1 - t); const d = (1 - g) * (1 - r) * (1 - t), rr = r * (1 - t);
  return [g, d, rr, t];
}
let water, waterMat;
function buildWater() {
  const pts = [], idx = [];
  let n = 0;
  for (let z = -HALF; z <= HALF; z += 10) {
    const x = riverX(z);
    pts.push(x - 30, WATER_Y, z, x + 30, WATER_Y, z);
    if (n > 0) { const a = (n - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    n++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setIndex(idx);
  waterMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { time: { value: 0 }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, skyCol: { value: new THREE.Color() }, deep: { value: new THREE.Color(0x0e3a44) }, fogColor: { value: new THREE.Color() }, fogNear: { value: 100 }, fogFar: { value: 900 }, lum: { value: 1 } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float time, fogNear, fogFar, lum; uniform vec3 sunDir, sunCol, skyCol, deep, fogColor; varying vec3 vW;
      float hgt(vec2 p){ return sin(p.x*0.9+time*1.3)*0.5 + sin(p.y*1.3-time*1.1)*0.5 + sin((p.x+p.y)*2.1+time*1.9)*0.25 + sin((p.x-p.y)*3.7-time*2.3)*0.12; }
      void main(){
        vec2 p = vW.xz * 0.55; float e = 0.15;
        vec3 n = normalize(vec3(hgt(p-vec2(e,0.0))-hgt(p+vec2(e,0.0)), 3.4, hgt(p-vec2(0.0,e))-hgt(p+vec2(0.0,e))));
        vec3 V = normalize(cameraPosition - vW);
        float fr = pow(1.0 - max(dot(V, n), 0.0), 3.0);
        vec3 col = mix(deep * lum, skyCol, 0.12 + fr * 0.78);
        col += sunCol * pow(max(dot(reflect(-sunDir, n), V), 0.0), 180.0) * 1.6;
        col = mix(col, fogColor, smoothstep(fogNear, fogFar, length(cameraPosition - vW)));
        gl_FragColor = vec4(col, 0.8 + fr * 0.18);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  water = new THREE.Mesh(geo, waterMat);
  G.scene.add(water);
}
let heightTex;
function buildMap() {
  const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d'), img = g.createImageData(N, N), c = [0, 0, 0], hd = new Float32Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i + 0.5) / N * WORLD - HALF, z = (j + 0.5) / N * WORLD - HALF, h = terrainH(x, z);
    const m = terrainColor(x, z, h, c);
    const shade = 0.82 + clamp(h, 0, 90) / 260 + (terrainH(x - 4, z - 4) - h) * 0.03;
    let r = Math.sqrt(clamp(c[0] * shade, 0, 1)), gg = Math.sqrt(clamp(c[1] * shade, 0, 1)), b = Math.sqrt(clamp(c[2] * shade, 0, 1));
    if (Math.abs(x - riverX(z)) < 24) { r = 0.27; gg = 0.5; b = 0.6; }
    const k = (j * N + i) * 4;
    img.data[k] = r * 255; img.data[k + 1] = gg * 255; img.data[k + 2] = b * 255; img.data[k + 3] = 255;
    // height + grass density + dryness, sampled by the grass shader
    let mask = 0.5 + smoothstep(0.38, 0.62, m) * 0.5 + (1 - smoothstep(40, 120, Math.abs(x - riverX(z)))) * 0.3;
    if (h < WATER_Y + 0.7 || h > 56 || roadDist(x, z) < 4.5 || (Math.abs(x) < 94 && Math.abs(z) < 30)) mask = 0;
    for (const s of siteList) if (s !== SITES.town && s !== SITES.bridge && Math.hypot(x - s.x, z - s.z) < s.r * 0.7) mask = 0;
    hd[k] = h; hd[k + 1] = Math.min(mask, 1.2); hd[k + 2] = 1 - smoothstep(0.36, 0.6, m); hd[k + 3] = 1;
  }
  heightTex = new THREE.DataTexture(hd, N, N, THREE.RGBAFormat, THREE.FloatType);
  heightTex.magFilter = heightTex.minFilter = THREE.LinearFilter; heightTex.needsUpdate = true;
  g.putImageData(img, 0, 0);
  g.fillStyle = '#3a2616';
  const s = N / WORLD;
  for (const b of boxes) g.fillRect((b.minx + HALF) * s, (b.minz + HALF) * s, Math.max(2, (b.maxx - b.minx) * s), Math.max(2, (b.maxz - b.minz) * s));
  g.fillStyle = '#5a4330'; g.fillRect((254 + HALF) * s, (-3 + HALF) * s, 92 * s, 6 * s);
  G.mapCanvas = cv;
}

// ---------- grass: one patch of blades that follows the camera ----------
let grassMat;
const GRASS_TILE = 64;
function buildGrass() {
  const pos = [], hf = [];
  for (let b = 0; b < 4; b++) {
    const a = b / 4 * Math.PI * 2 + rand(0.6), ox = Math.cos(a) * 0.09, oz = Math.sin(a) * 0.09, w = 0.035, hgt = rand(0.42, 0.7), lean = rand(0.05, 0.22);
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    const lv = [[0, 1], [0.5, 0.7], [1, 0]];
    for (let s = 0; s < 2; s++) {
      const [t0, w0] = lv[s], [t1, w1] = lv[s + 1];
      const p = (t, ww, side) => [ox + px * ww * side + Math.cos(a) * lean * t * t, hgt * t, oz + pz * ww * side + Math.sin(a) * lean * t * t];
      const q = [p(t0, w0, -1), p(t0, w0, 1), p(t1, w1, -1), p(t1, w1, 1)];
      for (const k of [0, 1, 2, 2, 1, 3]) { pos.push(...q[k]); hf.push(k < 2 ? t0 : t1); }
    }
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('hf', new THREE.Float32BufferAttribute(hf, 1));
  const N = 17000, off = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) off.set([rand(GRASS_TILE), rand(GRASS_TILE), Math.random(), Math.random()], i * 4);
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4)); geo.instanceCount = N;
  grassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { tH: { value: heightTex }, time: { value: 0 }, camP: { value: new THREE.Vector3() }, light: { value: new THREE.Color(1, 1, 1) }, fogColor: { value: new THREE.Color() }, fogNear: { value: 100 }, fogFar: { value: 900 }, wind: { value: 1 } },
    vertexShader: `uniform sampler2D tH; uniform float time, fogNear, fogFar, wind; uniform vec3 camP, light;
      attribute vec4 aOff; attribute float hf; varying vec3 vCol; varying float vFog;
      const float TILE = ${GRASS_TILE}.0;
      void main(){
        vec2 w = camP.xz + mod(aOff.xy - camP.xz, TILE) - TILE * 0.5;
        vec4 hm = texture2D(tH, w / ${WORLD}.0 + 0.5);
        float fade = 1.0 - smoothstep(TILE * 0.34, TILE * 0.49, length(w - camP.xz));
        float s = hm.g * fade * (0.65 + aOff.z * 0.8);
        float a = aOff.w * 6.283; mat2 r = mat2(cos(a), -sin(a), sin(a), cos(a));
        vec3 p = position; p.xz = r * p.xz; p *= s;
        float sway = sin(time * 1.7 + w.x * 0.35 + w.y * 0.27 + aOff.w * 6.0) * 0.1 + sin(time * 0.8 + w.x * 0.06 + w.y * 0.04) * 0.14;
        p.x += sway * hf * hf * s * wind; p.z += sway * 0.6 * hf * hf * s * wind;
        vec3 wp = vec3(w.x, hm.r, w.y) + p;
        vec3 base = mix(vec3(0.17, 0.27, 0.06), vec3(0.44, 0.36, 0.13), clamp(hm.b + (aOff.z - 0.5) * 0.5, 0.0, 1.0));
        vCol = base * (0.4 + 0.75 * hf) * light;
        vec4 mv = viewMatrix * vec4(wp, 1.0); gl_Position = projectionMatrix * mv; vFog = smoothstep(fogNear, fogFar, -mv.z);
      }`,
    fragmentShader: `uniform vec3 fogColor; varying vec3 vCol; varying float vFog;
      void main(){ gl_FragColor = vec4(mix(vCol, fogColor, vFog), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, grassMat); mesh.frustumCulled = false;
  G.scene.add(mesh); G.dbg.grass = mesh;
}

// ---------- sky and weather ----------
let sun, hemi, skyMat, sky, stars, sunDisc, moonDisc, clouds = [], rain, rainPos, flashT = 0, boltT = 8;
const SKY = {
  dayTop: new THREE.Color(0x2f7fd6), dayBot: new THREE.Color(0xb9d6ee),
  setTop: new THREE.Color(0x35477d), setBot: new THREE.Color(0xff8c4a),
  nightTop: new THREE.Color(0x04060e), nightBot: new THREE.Color(0x121a2e),
  grey: new THREE.Color(0x7a848c), dust: new THREE.Color(0xb48a55),
};
const cTop = new THREE.Color(), cBot = new THREE.Color(), cTmp = new THREE.Color();
const WEATHERS = { clear: [0, 0, 0], cloudy: [0.75, 0, 0], rain: [0.92, 1, 0], storm: [1, 1, 0], dust: [0.35, 0, 1] };

function buildSky() {
  hemi = new THREE.HemisphereLight(0xbfd9ee, 0x9a8870, 1); G.scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff4e0, 2);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 10; sc.far = 420;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
  G.scene.add(sun, sun.target);
  skyMat = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top, bottom, sunDir, sunCol; varying vec3 vP; void main(){ vec3 d=normalize(vP); float t=pow(clamp(d.y,0.0,1.0),0.5); vec3 c=mix(bottom,top,t); float s=max(dot(d,sunDir),0.0); c+=sunCol*(pow(s,900.0)*4.0+pow(s,60.0)*0.3+pow(s,7.0)*0.14); gl_FragColor=vec4(min(c,vec3(1.0)),1.0);\n#include <colorspace_fragment>\n}',
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 12), skyMat); sky.renderOrder = -10; sky.frustumCulled = false; G.scene.add(sky);
  const sp = [];
  for (let i = 0; i < 1300; i++) { const a = rand(6.283), e = Math.asin(rand(0.03, 1)); sp.push(Math.cos(a) * Math.cos(e) * 1300, Math.sin(e) * 1300, Math.sin(a) * Math.cos(e) * 1300); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  stars.frustumCulled = false; G.scene.add(stars);
  sunDisc = new THREE.Mesh(new THREE.SphereGeometry(42, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }));
  moonDisc = new THREE.Mesh(new THREE.SphereGeometry(26, 16, 12), new THREE.MeshBasicMaterial({ color: 0xdfe6f5, fog: false }));
  G.scene.add(sunDisc, moonDisc);
  const blob = canvasTex(128, 128, (g) => {
    for (let i = 0; i < 9; i++) {
      const x = rand(34, 94), y = rand(44, 84), r = rand(18, 34), gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
  });
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blob, transparent: true, opacity: 0.4, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = rand(6.28);
    m.position.set(rand(-1100, 1100), rand(230, 330), rand(-1100, 1100));
    const s = rand(280, 560); m.scale.set(s, s * rand(0.6, 1), 1);
    clouds.push(m); G.scene.add(m);
  }
  const N = 1400; rainPos = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) { const x = rand(-35, 35), y = rand(0, 40), z = rand(-35, 35); rainPos.set([x, y, z, x, y - 0.9, z], i * 6); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaec3d6, transparent: true, opacity: 0.45, fog: false }));
  rain.frustumCulled = false; rain.visible = false; G.scene.add(rain);
  G.scene.fog = new THREE.Fog(0xb9d6ee, 150, 950);
  G.weather = { type: 'clear', c: 0, rain: 0, dust: 0, left: rand(3, 6) };
}

export function setWeather(type) { G.weather.type = type; G.weather.left = rand(2.5, 6); }

export function updateWorld(dt) {
  const W = G.weather;
  // clock: one game hour per real minute
  G.time += dt / 60;
  if (G.time >= 24) { G.time -= 24; G.day++; if (G.onNewDay) G.onNewDay(); }
  W.left -= dt / 60;
  if (W.left <= 0) {
    const r = Math.random();
    setWeather(r < 0.55 ? 'clear' : r < 0.75 ? 'cloudy' : r < 0.9 ? 'rain' : r < 0.95 ? 'storm' : 'dust');
  }
  const tgt = WEATHERS[W.type], k = Math.min(1, dt * 0.25);
  W.c += (tgt[0] - W.c) * k; W.rain += (tgt[1] - W.rain) * k; W.dust += (tgt[2] - W.dust) * k;

  const ang = (G.time - 5.5) / 14 * Math.PI, e = Math.sin(ang);
  const dayK = smoothstep(0, 0.28, e), nightK = smoothstep(0, -0.22, e);
  cTop.copy(SKY.setTop).lerp(SKY.dayTop, dayK).lerp(SKY.nightTop, nightK);
  cBot.copy(SKY.setBot).lerp(SKY.dayBot, dayK).lerp(SKY.nightBot, nightK);
  const lum = 1 - nightK * 0.85;
  cTmp.copy(SKY.grey).multiplyScalar(lum); cTop.lerp(cTmp, W.c * 0.8); cBot.lerp(cTmp, W.c * 0.85);
  cTmp.copy(SKY.dust).multiplyScalar(lum); cTop.lerp(cTmp, W.dust * 0.7); cBot.lerp(cTmp, W.dust * 0.9);
  if (flashT > 0) { flashT -= dt; cTop.lerp(cTmp.set(0xffffff), 0.6); cBot.lerp(cTmp, 0.6); }
  skyMat.uniforms.top.value.copy(cTop); skyMat.uniforms.bottom.value.copy(cBot);
  G.scene.fog.color.copy(cBot);
  const fNear = lerp(lerp(160, 40, W.rain), 12, W.dust), fFar = lerp(lerp(lerp(1000, 620, W.c), 320, W.rain), 150, W.dust);
  G.scene.fog.near += (fNear - G.scene.fog.near) * k * 4; G.scene.fog.far += (fFar - G.scene.fog.far) * k * 4;

  const cam = G.camera.position, focus = G.player ? G.player.pos : cam;
  const sx = Math.cos(ang), sy = e, sz = 0.35;
  const dim = 1 - W.c * 0.65 - W.dust * 0.4;
  if (e > -0.05) {
    sun.color.setHex(0xff9a55).lerp(cTmp.set(0xfff4e0), smoothstep(0, 0.35, e));
    sun.intensity = smoothstep(-0.05, 0.25, e) * 2.6 * dim;
    sun.position.set(focus.x + sx * 200, focus.y + Math.max(sy, 0.12) * 200, focus.z + sz * 200);
  } else {
    sun.color.setHex(0x8fa8ff); sun.intensity = 0.4 * dim;
    sun.position.set(focus.x - sx * 200, focus.y + Math.max(-sy, 0.15) * 200, focus.z - sz * 200);
  }
  sun.target.position.copy(focus);
  hemi.intensity = lerp(0.8, 1.9, smoothstep(-0.2, 0.3, e)) * (1 - W.c * 0.25) + (flashT > 0 ? 2 : 0);
  hemi.color.copy(cTop).lerp(cBot, 0.6);
  sky.position.copy(cam); stars.position.copy(cam);
  stars.material.opacity = nightK * (1 - W.c) * 0.95;
  stars.rotation.y = G.time * 0.02;
  sunDisc.visible = false;
  const sl = Math.hypot(sx, sy, sz), sunVis = smoothstep(-0.08, 0.05, e) * (1 - W.c * 0.9) * (1 - W.dust * 0.7);
  skyMat.uniforms.sunDir.value.set(sx / sl, sy / sl, sz / sl);
  skyMat.uniforms.sunCol.value.setHex(0xff8a3c).lerp(cTmp.set(0xfff2d0), smoothstep(0, 0.4, e)).multiplyScalar(sunVis);
  // water, grass and distance swaps follow the light
  const t0 = performance.now() / 1000, fog = G.scene.fog;
  waterMat.uniforms.time.value = t0; waterMat.uniforms.sunDir.value.copy(skyMat.uniforms.sunDir.value); waterMat.uniforms.sunCol.value.copy(skyMat.uniforms.sunCol.value);
  waterMat.uniforms.skyCol.value.copy(cTop).lerp(cBot, 0.5); waterMat.uniforms.lum.value = lerp(0.12, 1, smoothstep(-0.2, 0.3, e));
  waterMat.uniforms.fogColor.value.copy(fog.color); waterMat.uniforms.fogNear.value = fog.near; waterMat.uniforms.fogFar.value = fog.far;
  const gu = grassMat.uniforms; gu.time.value = t0; gu.camP.value.copy(cam); gu.fogColor.value.copy(fog.color); gu.fogNear.value = fog.near; gu.fogFar.value = fog.far; gu.wind.value = 1 + W.rain * 0.8 + W.dust * 1.5;
  gu.light.value.copy(hemi.color).multiplyScalar(hemi.intensity * 0.42).add(cTmp.copy(sun.color).multiplyScalar(sun.intensity * 0.36));
  updateLod(dt || 0.016);
  moonDisc.position.set(cam.x - sx * 1250, cam.y - sy * 1250, cam.z - sz * 1250); moonDisc.visible = e < 0.08 && W.c < 0.8;
  const cl = lerp(0.25, 1, smoothstep(-0.2, 0.3, e));
  for (const m of clouds) {
    m.position.x += dt * 3; if (m.position.x > 1150) m.position.x = -1150;
    m.material.opacity = 0.22 + W.c * 0.6;
    m.material.color.setScalar(cl * (1 - W.c * 0.45));
  }
  // rain and lightning
  rain.visible = W.rain > 0.08;
  if (rain.visible) {
    rain.position.set(cam.x, cam.y - 12, cam.z); rain.material.opacity = 0.5 * W.rain;
    for (let i = 0; i < rainPos.length; i += 6) {
      let y = rainPos[i + 1] - dt * 42; if (y < 0) y += 40;
      rainPos[i + 1] = y; rainPos[i + 4] = y - 0.9;
    }
    rain.geometry.attributes.position.needsUpdate = true;
  }
  if (W.type === 'storm' && W.rain > 0.6) { boltT -= dt; if (boltT <= 0) { boltT = rand(6, 18); flashT = 0.12; setTimeout(() => sfx.thunder(), rand(300, 1600)); } }
  // glow
  const glow = smoothstep(0.12, -0.1, e);
  windowMat.emissiveIntensity = glow * 0.9; lampMat.emissiveIntensity = glow * 1.4;
  for (const l of lamps) l.intensity = glow * 55;
  const t = performance.now() / 1000;
  fires.forEach((f, i) => {
    const fl = 0.8 + Math.sin(t * 11 + i) * 0.12 + Math.sin(t * 23 + i * 2) * 0.08;
    f.flame.visible = f.lit; f.flame.scale.set(fl, 0.8 + fl * 0.5, fl);
    f.light.intensity = f.lit ? (18 + glow * 60) * fl : 0;
  });
  updateFx(dt);
}

// ---------- small effects ----------
const tracers = [], puffs = [];
const puffGeo = new THREE.SphereGeometry(0.07, 5, 4);
export const fx = {
  tracer(a, b, color = 0xffe9a0) {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    l.userData.life = 0.07; G.scene.add(l); tracers.push(l);
  },
  puff(pos, color = 0x9a2a1e, n = 6, spd = 2.2) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.copy(pos);
      m.userData = { v: new THREE.Vector3(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1)).multiplyScalar(spd), life: rand(0.3, 0.6) };
      G.scene.add(m); puffs.push(m);
    }
  },
};
function updateFx(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const l = tracers[i]; l.userData.life -= dt / Math.max(0.3, G.timeScale);
    if (l.userData.life <= 0) { G.scene.remove(l); l.geometry.dispose(); l.material.dispose(); tracers.splice(i, 1); }
  }
  for (let i = puffs.length - 1; i >= 0; i--) {
    const m = puffs[i], u = m.userData; u.life -= dt; u.v.y -= 6 * dt;
    m.position.addScaledVector(u.v, dt); m.material.opacity = clamp(u.life * 3, 0, 1);
    if (u.life <= 0) { G.scene.remove(m); m.material.dispose(); puffs.splice(i, 1); }
  }
}

export function buildWorld() {
  G.dbg = { chunks };
  windowMat = new THREE.MeshLambertMaterial({ color: 0x26303a, emissive: 0xffb84d, emissiveIntensity: 0 });
  lampMat = new THREE.MeshLambertMaterial({ color: 0x6a6252, emissive: 0xffc878, emissiveIntensity: 0 });
  buildSky(); buildTerrain(); buildWater();
  buildTown(); buildCamp(); buildRanch(); buildDepot(); buildThorneRanch(); buildBridge();
  buildOutlawCamp(SITES.gulch, 4); buildOutlawCamp(SITES.mesa, 3);
  scatter(); buildMap(); buildGrass();
}
