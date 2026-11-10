# Dustfall

> This project was created to test the Claude Fable 5.2 model. The whole game was written by the model in Claude Code from chat prompts.

An original open-world western that runs in the browser. Built with Three.js and Vite.
Sound is synthesised in code. The 3D models and ground textures are free public-domain (CC0) assets.

## Graphics and assets

- People: a rigged human body with skeletal animation (walk, jog, sprint, crouch, aim, shoot, reload, punch, ride, death).
  Clothes are generated in code as smoothed layers over the body; faces, hats and guns are attached to bones.
- Animals: animated horse, cattle and wolf models. Deer reuse the horse rig at a smaller scale with antlers.
- Nature: textured pine and broadleaf trees, bushes, ferns, flowers and rocks. Distant trees swap to cheap stand-ins.
- Ground: four photo textures blended by terrain type. Grass is a wind-animated patch that follows the camera.
- Everything in `public/assets` is CC0. Sources are listed in `public/assets/CREDITS.txt`
  (Quaternius models, Poly Haven textures).

## Play

```
npm install
npm run dev
```

Then open the address Vite prints (usually http://localhost:5173). Click the game to capture the mouse.

`npm run build` makes a static copy in `dist/`, and `npm run preview` serves it.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / steer horse |
| Mouse | Look (arrow keys also turn the camera) |
| Shift / Ctrl | Sprint or gallop / walk |
| Space, C | Jump, crouch |
| E | Talk, mount, loot, skin, use |
| H, B | Whistle for horse, pat horse |
| 1 2 3 4 | Holster, revolver, rifle, bow |
| Right / left mouse | Aim / shoot (punch when holstered) |
| R, Q, X | Reload, Focus (slow time), quick eat |
| G | Rob someone you are aiming at |
| Tab, M, J | Satchel, map, journal |
| F5, Esc | Save, pause |

## What is in it

- A 1.4 km basin with a town, ranches, a rail depot, outlaw camps, a river and a bridge
- Day and night, weather (clear, cloud, rain, storms, dust)
- A horse to tame, name, ride, feed and bond with
- Revolver, rifle and bow, a slow-time Focus ability, and a quick-draw duel
- Townsfolk, shopkeepers, lawmen, outlaws and wildlife with their own behaviour
- Crime, witnesses, bounties, posses and an honour meter that changes prices and the ending
- Hunting, skinning, cooking, fishing, hunger, sleeping, blackjack
- A six-chapter story with choices, plus repeatable bounty hunts and chance encounters
- Saving to the browser (automatic, and F5)

## Code map

| File | Holds |
| --- | --- |
| `src/core.js` | Shared state, items, input, sound |
| `src/world.js` | Terrain, sky, weather, buildings, collision |
| `src/assets.js` | Loads models and textures |
| `src/models.js` | Animated people and animals, clothing, faces |
| `src/actors.js` | AI, the law, wildlife, encounters |
| `src/player.js` | Player, horse, gunplay, camera |
| `src/ui.js` | HUD, dialogue, shops, map, mini-games |
| `src/story.js` | Characters, missions, bounties, saving |
| `tools/smoke.mjs` | Headless test: `node tools/smoke.mjs <url> <shotsDir> basic|all|systems|looks` |
| `tools/prof.mjs` | Frame-rate profiler: `node tools/prof.mjs town|wild` |
