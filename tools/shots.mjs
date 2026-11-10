// Captures the README logo and screenshots: node tools/shots.mjs [url]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const url = process.argv[2] || 'http://localhost:4317/';
const out = 'docs';
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--window-size=1280,720', '--mute-audio'],
});

// ---- logo ----
const lp = await browser.newPage();
await lp.setViewport({ width: 920, height: 330, deviceScaleFactor: 2 });
await lp.setContent(`<body style="margin:0;background:transparent;display:grid;place-items:center;height:100vh">
  <div style="width:820px;background:#f1e3c6;color:#1d1410;text-align:center;padding:22px 30px 20px;border:6px solid #1d1410;outline:3px solid #1d1410;outline-offset:-15px;box-shadow:10px 10px 0 #1d1410;font-family:Rockwell,Georgia,serif">
    <div style="letter-spacing:.3em;font-size:13px;text-transform:uppercase;margin-top:8px">A frontier tale of the Sorrel Basin</div>
    <div style="font-weight:900;font-size:112px;line-height:1;letter-spacing:.03em;color:#b3261e;text-shadow:5px 5px 0 #1d1410;margin:6px 0 2px">DUSTFALL</div>
    <div style="position:relative;height:22px;margin:4px 120px"><div style="position:absolute;left:0;right:0;top:9px;border-top:4px double #1d1410"></div><span style="position:relative;background:#f1e3c6;padding:0 12px;color:#e0a526;font-size:20px">★</span></div>
    <div style="font-weight:700;letter-spacing:.34em;font-size:15px;margin:2px 0 8px">1887 · RIDE · HUNT · RECKON</div>
  </div></body>`);
await sleep(300);
await lp.screenshot({ path: `${out}/logo.png`, omitBackground: true });
await lp.close();

// ---- game ----
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('pageerror', e.message));
const shot = (n) => page.screenshot({ path: `${out}/${n}.jpg`, type: 'jpeg', quality: 86 });
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const skip = async () => { for (let i = 0; i < 14; i++) { if (await ev(() => window.__G.mode !== 'dialogue')) break; await page.keyboard.press('KeyE'); await sleep(250); } };
const clearToasts = () => ev(() => { document.querySelector('#toasts').innerHTML = ''; });
const put = (x, z, yaw, pitch = -0.08) => ev((x, z, yaw, pitch) => { const p = window.__G.player; p.mounted = false; p.pos.set(x, 0, z); p.heading = yaw; p.yaw = yaw; p.pitch = pitch; }, x, z, yaw, pitch);

await page.goto(url, { waitUntil: 'load' });
await sleep(9000);
await shot('title');
await ev(() => localStorage.clear());
await page.click('#b-new'); await sleep(1000); await skip(); await sleep(500);

// talking to Tobias
await ev(() => { window.__G.time = 9.5; });
await put(-41.6, -7.4, Math.PI - 0.35, -0.02); await sleep(900);
await page.keyboard.press('KeyE'); await sleep(700);
await ev(() => { const G = window.__G, a = G.actors.find((x) => x.id === 'tobe'); G.debugCam = { pos: [a.pos.x + 1.5, a.pos.y + 1.6, a.pos.z + 3.1], look: [a.pos.x - 0.2, a.pos.y + 1.3, a.pos.z], fov: 48 }; });
await sleep(600); await shot('dialogue');
await ev(() => { window.__G.debugCam = null; }); await skip(); await sleep(600);

// main street
await put(-74, 1.5, Math.PI / 2, -0.04); await sleep(1500); await clearToasts(); await shot('town');

// riding through the meadow
await ev(() => { const G = window.__G, h = G.horse, p = G.player; h.owned = true; h.name = 'Juniper'; h.bond = 40; h.pos.set(-262, 0, -128); h.heading = -0.6; p.pos.copy(h.pos); p.mounted = true; h.state = 'ridden'; p.yaw = -0.25; p.pitch = -0.1; G.story.m = 1; G.story.s = 2; G.story.enter(); });
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft'); await sleep(2300); await clearToasts(); await shot('riding');
await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); await sleep(300);

// gunfight at the gulch
await ev(() => { const G = window.__G, S = G.story, p = G.player; G.weaponsOwned.rifle = true; S.m = 3; S.s = 1; S.enter(); p.mounted = false; G.horse.state = 'idle'; p.pos.set(-380, 0, -308); p.yaw = Math.PI; p.heading = Math.PI; p.pitch = -0.04; p.weapon = 'revolver'; p.hp = 100; });
await page.mouse.move(640, 360); await page.mouse.down({ button: 'right' }); await sleep(1700);
await ev(() => { window.__G.player.hp = 100; }); await clearToasts(); await page.mouse.click(640, 360); await sleep(120); await shot('gunfight');
await page.mouse.up({ button: 'right' });
await ev(async () => { const m = await import('/src/actors.js'); for (const a of window.__G.actors) if (a.tags.includes('gulch')) m.removeActor(a); window.__G.player.hp = 100; window.__G.player.weapon = 'none'; });

// town at night
await ev(() => { const G = window.__G; G.time = 21.2; G.weather.type = 'clear'; G.weather.c = 0; G.weather.rain = 0; });
await put(-30, 0.5, Math.PI / 2, 0.02); await sleep(2500); await clearToasts(); await shot('night');

// map
await ev(() => { window.__G.time = 10; }); await sleep(300);
await page.keyboard.press('KeyM'); await sleep(700); await shot('map');
await browser.close();
console.log('done');
