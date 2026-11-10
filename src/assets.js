// Loads the 3D models (all CC0, see public/assets/CREDITS.txt).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const A = {};
const FILES = {
  human: 'human.glb', horse: 'horse.glb', cow: 'cow.glb', wolf: 'wolf.glb',
  pine5: 'pine_5.glb', tree5: 'commontree_5.glb',
  bush: 'bush_common.glb', rock1: 'rock_medium_1.glb', rock2: 'rock_medium_2.glb', rock3: 'rock_medium_3.glb',
  fern: 'fern_1.glb', flower: 'flower_3_group.glb', plant: 'plant_7_big.glb',
};

const TEX = { grass: 'leafy_grass.jpg', dry: 'dry_ground_01.jpg', dirt: 'dirt.jpg', rock: 'dry_ground_rocks.jpg', planks: 'raw_plank_wall.jpg' };

export async function loadAssets(onProgress) {
  const loader = new GLTFLoader(), keys = Object.keys(FILES), tl = new THREE.TextureLoader();
  let done = 0;
  A.tex = {};
  const texJobs = Object.keys(TEX).map(async (k) => {
    const t = await tl.loadAsync(`${import.meta.env.BASE_URL}assets/tex/${TEX[k]}`);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; A.tex[k] = t;
  });
  await Promise.all(keys.map(async (k) => {
    A[k] = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/${FILES[k]}`);
    done++; if (onProgress) onProgress(done / keys.length);
  }).concat(texJobs));
}
