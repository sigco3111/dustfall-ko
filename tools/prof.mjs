// Frame-rate profiler: toggles parts of the scene and reports fps for each.
import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--window-size=1280,720', '--mute-audio'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:4317/', { waitUntil: 'load' }); await sleep(6000);
await page.evaluate(() => localStorage.clear()); await page.click('#b-new'); await sleep(1000);
for (let i = 0; i < 8; i++) { await page.keyboard.press('KeyE'); await sleep(250); }
const fps = () => page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 2500) r(Math.round(n / 2.5)); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
const run = async (label, fn) => { await page.evaluate(fn); await sleep(600); console.log(label.padEnd(34), await fps(), JSON.stringify(await page.evaluate(() => { const i = window.__G.renderer.info.render; return { calls: i.calls, tris: i.triangles }; }))); };
const spot = process.argv[2] || 'town';
await page.evaluate((spot) => { const G = window.__G, p = G.player; G.time = 11; if (spot === 'town') { p.pos.set(-70, 0, 0); p.yaw = Math.PI / 2; } else { p.pos.set(-260, 0, -120); p.yaw = -0.6; } p.heading = p.yaw; p.pitch = -0.08; }, spot);
await sleep(1500);
await run('baseline', () => {});
await run('no grass', () => { window.__G.dbg.grass.visible = false; });
await run('+ no hi-detail trees', () => { const G = window.__G; G.dbg.lodOff = true; for (const c of G.dbg.chunks) { c.hi.visible = false; c.lo.visible = true; } });
await run('+ no people/animals', () => { const G = window.__G; G.dbg.hidePeople = true; for (const a of G.actors) { a.model.visible = false; } G.player.model.visible = false; G.horse.model.visible = false; });
await run('+ plain terrain', () => { const G = window.__G; G.dbg.terrain.visible = false; });
await run('+ no shadows', () => { const G = window.__G; G.renderer.shadowMap.enabled = false; G.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); }); });
await run('+ pixel ratio 0.75', () => { window.__G.renderer.setPixelRatio(0.75); });
// eye debug
console.log(await page.evaluate(() => { const G = window.__G; const out = []; G.player.model.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.geometry.type === 'SphereGeometry') { const v = o.getWorldPosition(new o.position.constructor()); out.push([o.geometry.parameters.radius, +(v.x - G.player.pos.x).toFixed(3), +(v.y - G.player.pos.y).toFixed(3), +(v.z - G.player.pos.z).toFixed(3), o.visible]); } }); return out; }));
await browser.close();
