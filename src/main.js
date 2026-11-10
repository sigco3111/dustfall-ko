// Boot and the frame loop.
import * as THREE from 'three';
import { G, initInput, endFrame, updateAudio } from './core.js';
import { buildWorld, updateWorld } from './world.js';
import { initPlayer, updatePlayer, updateCamera, updateDeath } from './player.js';
import { updateActors, initLaw, updateSpawns } from './actors.js';
import { initUI } from './ui.js';
import { initStory } from './story.js';
import { loadAssets } from './assets.js';
import { updateAnimations } from './models.js';

const canvas = document.getElementById('c');
const renderer = G.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
G.scene = new THREE.Scene();
G.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 3400);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  G.camera.aspect = innerWidth / innerHeight; G.camera.updateProjectionMatrix();
});

const loading = document.getElementById('loading');
await loadAssets((f) => { loading.querySelector('i').style.width = Math.round(f * 100) + '%'; });
loading.remove();
G.time = 17.4;                 // golden hour behind the title card
buildWorld();
initLaw();
initPlayer();
initStory();
initUI();
initInput(canvas);
window.__G = G;

// Keep the game smooth on modest graphics chips by trading resolution for frame rate.
let scale = Math.min(devicePixelRatio, 1.5), fpsN = 0, fpsT = performance.now();
function adaptQuality(now) {
  fpsN++;
  if (now - fpsT < 2500) return;
  const fps = fpsN * 1000 / (now - fpsT); fpsN = 0; fpsT = now;
  if (document.hidden) return;
  let next = scale;
  if (fps < 30 && scale > 0.6) next = Math.max(0.6, scale - 0.15);
  else if (fps > 56 && scale < Math.min(devicePixelRatio, 1.5)) next = Math.min(devicePixelRatio, 1.5, scale + 0.1);
  if (next !== scale) { scale = next; renderer.setPixelRatio(scale); }
}

let last = performance.now(), titleA = 2.2;
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min((now - last) / 1000, 0.05); last = now;
  adaptQuality(now);
  switch (G.mode) {
    case 'play': {
      const dt = rdt * G.timeScale;
      updatePlayer(dt, rdt);
      updateActors(dt); G.law.update(dt); updateSpawns(dt); G.story.update(dt);
      updateCamera(rdt); updateWorld(dt); updateAnimations(dt);
      break;
    }
    case 'duel': G.story.updateDuel(rdt); updateCamera(rdt); updateWorld(0); updateAnimations(rdt); break;
    case 'dead': updateDeath(rdt); updateActors(rdt); updateCamera(rdt); updateWorld(rdt); updateAnimations(rdt); break;
    case 'title':
      titleA += rdt * 0.04;
      G.camera.position.set(Math.cos(titleA) * 78, 24, Math.sin(titleA) * 78);
      G.camera.lookAt(0, 9, 0);
      updateWorld(rdt * 0.15); updateAnimations(rdt);
      break;
    default: updateCamera(rdt); updateWorld(0); updateAnimations(rdt);
  }
  G.ui.update(rdt);
  updateAudio(rdt);
  renderer.render(G.scene, G.camera);
  endFrame();
}
requestAnimationFrame(frame);
