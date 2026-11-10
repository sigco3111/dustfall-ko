// Headless smoke test: node tools/smoke.mjs <url> <outDir> [scenario]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const url = process.argv[2] || 'http://localhost:4317/';
const out = process.argv[3] || './shots';
const scenario = process.argv[4] || 'basic';
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--window-size=1280,720', '--mute-audio'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + (e.stack || e.message)));
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const skipDialogue = async () => { for (let i = 0; i < 14; i++) { if (await ev(() => window.__G.mode !== 'dialogue')) break; await page.keyboard.press('KeyE'); await sleep(250); } };
const state = () => ev(() => { const G = window.__G, p = G.player; return { mode: G.mode, x: +p.pos.x.toFixed(1), z: +p.pos.z.toFixed(1), hp: Math.round(p.hp), money: G.money, m: G.story.m, s: G.story.s, actors: G.actors.length, time: +G.time.toFixed(2) }; });

try {
  await page.goto(url, { waitUntil: 'load' });
  await sleep(5000);
  console.log('fps', await ev(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 2000) r(n / 2); else requestAnimationFrame(f); }; requestAnimationFrame(f); })),
    await ev(() => { const c = document.createElement('canvas').getContext('webgl'); const e = c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; }));
  await shot('01-title');
  await ev(() => localStorage.clear());
  await page.click('#b-new');
  await sleep(1200);
  await shot('02-intro');
  await skipDialogue();
  await sleep(800);
  console.log('after intro', await state());
  await shot('03-start');

  if (scenario === 'basic' || scenario === 'all') {
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft'); await sleep(4000);
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    console.log('after walking', await state());
    // teleport to Tobias and talk
    await ev(() => { const G = window.__G; G.player.pos.set(-40, 0, -7.6); G.player.yaw = Math.PI; G.player.heading = Math.PI; });
    await sleep(700); await shot('04-town');
    await page.keyboard.press('KeyE'); await sleep(600); await shot('05-tobe-dialogue');
    await skipDialogue(); await sleep(800);
    console.log('after tobe', await state());
    await page.keyboard.press('KeyE'); await sleep(700); await shot('06-shop');
    await page.keyboard.press('Escape'); await sleep(500);
    await page.keyboard.press('Tab'); await sleep(500); await shot('07-satchel'); await page.keyboard.press('Escape'); await sleep(400);
    await page.keyboard.press('KeyM'); await sleep(500); await shot('08-map'); await page.keyboard.press('Escape'); await sleep(400);
    await page.keyboard.press('KeyJ'); await sleep(500); await shot('09-journal'); await page.keyboard.press('Escape'); await sleep(400);
    // street view
    await ev(() => { const G = window.__G; G.player.pos.set(-70, 0, 0); G.player.yaw = Math.PI / 2; G.player.pitch = -0.05; });
    await sleep(900); await shot('10-street');
  }
  if (scenario === 'ride' || scenario === 'all') {
    await ev(() => { const G = window.__G, S = G.story; S.m = 1; S.s = 1; S.enter(); G.player.pos.set(-54, 0, -241); G.player.yaw = 0.8; });
    await sleep(600); await shot('20-mare');
    await page.keyboard.down('KeyE'); await sleep(4200); await page.keyboard.up('KeyE');
    await sleep(500); await shot('21-name');
    for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyE'); await sleep(250); }
    await page.keyboard.press('Digit1'); await sleep(400); await skipDialogue(); await sleep(600);
    console.log('horse', await ev(() => ({ owned: window.__G.horse.owned, name: window.__G.horse.name, mode: window.__G.mode })));
    await page.keyboard.press('KeyE'); await sleep(500);
    await ev(() => { window.__G.player.yaw = Math.PI; });
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft'); await sleep(5000);
    await shot('22-riding');
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    console.log('after ride', await state(), await ev(() => ({ mounted: window.__G.player.mounted, hs: window.__G.horse.speed })));
  }
  if (scenario === 'combat' || scenario === 'all') {
    await ev(() => { const G = window.__G, S = G.story; G.weaponsOwned.rifle = true; G.inv.rifleAmmo = 40; S.m = 3; S.s = 1; S.enter(); G.player.mounted = false; G.player.pos.set(-380, 0, -300); G.player.yaw = Math.PI; G.player.pitch = -0.05; G.player.weapon = 'revolver'; });
    await sleep(1500); await shot('30-gulch');
    console.log('gulch', await state(), await ev(() => window.__G.actors.filter((a) => a.tags.includes('gulch')).map((a) => a.state)));
    // fire a few shots straight ahead
    for (let i = 0; i < 8; i++) { await page.mouse.click(640, 360); await sleep(450); }
    await shot('31-fight');
    console.log('fight', await state(), await ev(() => window.__G.actors.filter((a) => a.tags.includes('gulch')).map((a) => a.state + ':' + Math.round(a.hp))));
    // kill everyone through the damage path, then check the story advances
    await ev(() => { const G = window.__G; G.player.hp = 100; });
    await ev(async () => { const m = await import('/src/actors.js'); for (const a of window.__G.actors) if (a.tags.includes('gulch')) m.damageActor(a, 999); });
    await sleep(1200);
    console.log('after clear', await state());
    await shot('32-cleared');
    // night + rain look
    await ev(() => { const G = window.__G; G.time = 22.5; G.weather.type = 'rain'; G.weather.rain = 1; G.weather.c = 0.9; G.player.pos.set(-30, 0, 0); G.player.yaw = Math.PI / 2; });
    await sleep(1500); await shot('33-night-town');
  }
  if (scenario === 'looks') {
    // cam(target actor id or null for player, distance, height, side angle)
    const cam = (id, dist = 2.2, h = 1.5, ang = 0.35, lookH = 1.45) => ev((id, dist, h, ang, lookH) => {
      const G = window.__G; const a = id ? G.actors.find((x) => x.id === id || x.name === id) : null;
      const pos = a ? a.pos : G.player.pos, hd = (a ? a.heading : G.player.heading) + ang;
      G.debugCam = { pos: [pos.x + Math.sin(hd) * dist, pos.y + h, pos.z + Math.cos(hd) * dist], look: [pos.x, pos.y + lookH, pos.z], fov: 45 };
    }, id, dist, h, ang, lookH);
    const put = (x, z, heading) => ev((x, z, heading) => { const p = window.__G.player; p.mounted = false; p.pos.set(x, 0, z); p.heading = heading; p.yaw = heading; p.pitch = 0; }, x, z, heading);
    await ev(() => { window.__G.time = 10; });
    await put(-70, 0, Math.PI / 2); await cam(null, 3.2, 1.3, 0.4, 1.0); await sleep(900); await shot('60-player-front');
    await cam(null, 1.1, 1.65, 0.3, 1.62); await sleep(500); await shot('61-player-face');
    await cam(null, 3.2, 1.5, Math.PI - 0.5, 1.0); await sleep(500); await shot('61b-player-back');
    await put(-70, 20, 0);
    for (const [id, n] of [['tobe', '62-tobias'], ['barkeep', '63-barkeep'], ['sheriff', '64-sheriff'], ['doctor', '64b-doctor']]) { await cam(id, 2.6, 1.4, 0.35, 1.05); await sleep(700); await shot(n); }
    await cam('sheriff', 1.0, 1.66, 0.25, 1.62); await sleep(500); await shot('64c-sheriff-face');
    await ev(() => { const G = window.__G; G.debugCam = { pos: [-30, 3.2, 9], look: [-10, 1.2, -4], fov: 55 }; }); await sleep(600); await shot('65-street');
    // aiming pose
    await ev(() => { const G = window.__G, p = G.player; p.weapon = 'revolver'; G.debugCam = null; }); await put(-70, 0, Math.PI / 2);
    await page.mouse.move(640, 360); await page.mouse.down({ button: 'right' }); await sleep(700);
    await cam(null, 2.4, 1.5, -1.9, 1.3); await sleep(500); await shot('65b-aim-side');
    await page.mouse.up({ button: 'right' });
    await ev(() => { const G = window.__G, h = G.horse; h.owned = true; h.name = 'Juniper'; h.pos.set(-140, 0, 40); G.player.pos.set(-140, 0, 40); G.player.mounted = true; h.state = 'ridden'; h.heading = 0.6; G.player.yaw = 0.6; G.debugCam = { pos: [-136.5, h.pos.y + 1.9, 43.5], look: [-140, h.pos.y + 1.3, 40], fov: 50 }; });
    await sleep(900); await shot('68-mounted');
    await ev(() => { const G = window.__G, h = G.horse; G.debugCam = { pos: [-140 + 3.4, h.pos.y + 1.6, 40 + 2.2], look: [-140, h.pos.y + 1.3, 40], fov: 50 }; }); await sleep(400); await shot('68b-mounted-front');
    await ev(async () => { const m = await import('/src/actors.js'); const G = window.__G, p = G.player; p.mounted = false; p.pos.set(-300, 0, 30); for (let i = 0; i < 3; i++) m.spawnAnimal('deer', -300 + i * 3 - 3, 52 + i, {}); m.spawnAnimal('wolf', -295, 47, {}); G.actors.filter((a) => a.species === 'deer' || a.species === 'wolf').forEach((a) => { a.heading = 1.6; a.state = 'idle'; a.t = 99; a.pos.y = 0; }); G.debugCam = { pos: [-297, G.actors.at(-1).pos.y + 2.5, 40], look: [-299, G.actors.at(-1).pos.y + 0.8, 51], fov: 50 }; });
    await sleep(900); await shot('70-wildlife');
    await ev(() => { const G = window.__G; G.debugCam = { pos: [-88, 14, -228], look: [-96, 11.5, -238], fov: 50 }; G.player.pos.set(-70, 0, -215); }); await sleep(900); await shot('67-cows');
    await ev(() => { window.__G.debugCam = null; });
    await put(-260, -120, -0.6); await ev(() => { window.__G.player.pitch = -0.1; }); await sleep(1200); await shot('71-meadow');
    await put(268, 24, Math.PI / 2); await ev(() => { window.__G.player.pitch = -0.12; }); await sleep(1200); await shot('72-river');
    await ev(() => { const G = window.__G; G.time = 18.4; }); await put(-95, 4, Math.PI / 2); await sleep(1500); await shot('73-sunset-town');
  }
  if (scenario === 'systems') {
    const tp = (x, z, yaw = 0) => ev((x, z, yaw) => { const G = window.__G, p = G.player; p.mounted = false; p.pos.set(x, 0, z); p.yaw = yaw; p.heading = yaw; p.pitch = -0.08; }, x, z, yaw);
    const killTag = (tag) => ev(async (tag) => { const m = await import('/src/actors.js'); for (const a of window.__G.actors) if (a.tags.includes(tag)) m.damageActor(a, 999); }, tag);
    const prompt = () => ev(() => window.__G.player.prompt && window.__G.player.prompt.text);
    // --- the ledger ---
    await ev(() => { const G = window.__G, S = G.story; G.weaponsOwned.rifle = true; G.inv.rifleAmmo = 40; S.m = 4; S.s = 0; S.enter(); G.time = 12; });
    await tp(120, 250, 0); await sleep(1200); await shot('40-depot');
    await killTag('depot'); await tp(120, 338.4, Math.PI); await sleep(900);
    console.log('ledger prompt:', await prompt(), await state());
    await shot('41-depot-door');
    await page.keyboard.press('KeyE'); await sleep(500); await shot('42-narration'); await skipDialogue(); await sleep(600);
    console.log('ledger', await ev(() => window.__G.inv.ledger), await state());
    await tp(-58, -7.6, Math.PI); await sleep(700); console.log('sheriff prompt:', await prompt());
    await page.keyboard.press('KeyE'); await sleep(500); await shot('43-sheriff'); await skipDialogue(); await sleep(900);
    console.log('after sheriff', await state());
    // --- the reckoning ---
    await tp(480, -60, Math.PI); await sleep(1500); await shot('44-thorne-ranch');
    console.log('guards', await ev(() => window.__G.actors.filter((a) => a.tags.includes('thorneGuard')).length), await state());
    await killTag('thorneGuard'); await ev(() => { window.__G.player.hp = 100; }); await sleep(1200);
    console.log('yard cleared', await state(), await ev(() => !!window.__G.actors.find((a) => a.id === 'thorne')));
    await tp(485, -121, Math.PI); await sleep(700); console.log('thorne prompt:', await prompt());
    await page.keyboard.press('KeyE'); await sleep(500); await skipDialogue(); await sleep(500);
    console.log('duel mode', await ev(() => window.__G.mode)); await shot('45-duel');
    for (let i = 0; i < 200; i++) { if (await ev(() => document.querySelector('#duel').textContent === 'DRAW!')) break; await sleep(40); }
    await page.mouse.click(640, 360); await sleep(700); await shot('46-after-duel');
    for (let i = 0; i < 2; i++) { await page.keyboard.press('KeyE'); await sleep(300); }
    await shot('47-choice'); await page.keyboard.press('Digit1'); await sleep(500); await shot('48-epilogue');
    await skipDialogue(); await sleep(800);
    console.log('ending', await state(), await ev(() => ({ honor: window.__G.honor, flags: window.__G.story.flags })));
    await shot('49-end');
    // --- bounty board ---
    await tp(-50, -7.8, Math.PI); await sleep(700); console.log('board prompt:', await prompt());
    await page.keyboard.press('KeyE'); await sleep(500); await shot('50-bounty'); await page.keyboard.press('KeyE'); await sleep(300); await page.keyboard.press('Digit1'); await sleep(600);
    console.log('bounty', await ev(() => window.__G.bounty), await ev(() => window.__G.actors.filter((a) => a.tags.includes('bountyTarget')).length));
    await killTag('bountyTarget'); await sleep(500);
    await tp(-58, -7.6, Math.PI); await sleep(600); await page.keyboard.press('KeyE'); await sleep(400); await skipDialogue(); await sleep(500);
    console.log('bounty paid', await ev(() => ({ job: window.__G.bounty, money: window.__G.money })));
    // --- fishing ---
    await ev(() => { window.__G.inv.fishingRod = 1; });
    const bank = await ev(async () => { const w = await import('/src/world.js'); const z = 60; let x = w.riverX(z) - 45; while (!w.inWater(x + 5, z) && x < w.riverX(z)) x += 0.5; return { x, z }; });
    await tp(bank.x, bank.z, Math.PI / 2); await sleep(800); console.log('fish prompt:', await prompt()); await shot('51-river');
    await page.keyboard.press('KeyE');
    for (let i = 0; i < 120; i++) { if (await ev(() => window.__G.player.fishing && window.__G.player.fishing.bite > 0)) break; await sleep(100); }
    await page.keyboard.press('KeyE'); await sleep(500);
    console.log('fish', await ev(() => ({ fish: window.__G.inv.fish, caught: window.__G.stats.fish })));
    // --- camp: cook and sleep ---
    await ev(() => { window.__G.inv.rawMeat = 3; });
    await tp(-229, 140.5, 0); await sleep(700); console.log('camp prompt:', await prompt());
    await page.keyboard.press('KeyE'); await sleep(500); await shot('52-cook');
    await page.click('#modal [data-act="cook"][data-n="99"]'); await sleep(300); await page.keyboard.press('Escape'); await sleep(500);
    console.log('cooked', await ev(() => ({ inv: window.__G.inv, mode: window.__G.mode })));
    await tp(-231.5, 143.4, 0); await sleep(600); console.log('bed prompt:', await prompt());
    await page.keyboard.press('KeyE'); await sleep(500); await page.click('#modal [data-act="sleep"][data-h="7"]'); await sleep(3200);
    console.log('slept', await state(), await ev(() => window.__G.day)); await shot('53-morning-camp');
    // --- crime and the law ---
    await tp(-20, 0, Math.PI / 2); await ev(() => { window.__G.player.weapon = 'revolver'; window.__G.player.pitch = 0.5; }); await sleep(600);
    for (let i = 0; i < 3; i++) { await page.mouse.click(640, 360); await sleep(500); }
    await sleep(1500); console.log('law', await ev(() => ({ wanted: window.__G.law.wanted, bounty: window.__G.law.bounty }))); await shot('54-wanted');
    // --- death and respawn ---
    await ev(() => { window.__G.hurtPlayer(500); }); await sleep(1500); await shot('55-death'); await sleep(4500);
    console.log('respawn', await state(), await ev(() => ({ wanted: window.__G.law.wanted, bounty: window.__G.law.bounty })));
    // --- map, save, reload, continue ---
    await page.keyboard.press('KeyM'); await sleep(600); await shot('56-map'); await page.keyboard.press('Escape'); await sleep(400);
    await page.keyboard.press('F5'); await sleep(300);
    const before = await state();
    await page.reload({ waitUntil: 'load' }); await sleep(4000);
    await page.click('#b-cont'); await sleep(1500);
    console.log('saved', before, 'loaded', await state(), await ev(() => ({ horse: window.__G.horse.name, owned: window.__G.horse.owned, inv: window.__G.inv })));
    await shot('57-continued');
  }
} catch (e) { errors.push('[test] ' + e.stack); }
console.log('final', await state().catch((e) => e.message));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO CONSOLE ERRORS');
await browser.close();
