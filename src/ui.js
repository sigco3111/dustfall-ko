// HUD, dialogue, menus, map and mini-games. All plain DOM over the 3D canvas.
import { G, ITEMS, WEAPONS, keys, wasPressed, consume, mouse, releaseLock, requestLock, sfx, clamp, fmt, addItem, addMoney, addHonor, count, honorLabel, rand, initAudio } from './core.js';
import { SITES, WORLD, HALF, setWeather } from './world.js';
import { t, tx, lang, setLang } from './i18n.js';

const $ = (s) => document.querySelector(s);
const FONT_SLAB = 'Rockwell, Georgia, "Noto Serif KR", "Nanum Myeongjo", serif';
const CONTROLS = [
  ['W A S D', 'Move / steer horse'], ['Mouse', 'Look (click the game to capture the mouse)'], ['Shift', 'Sprint / gallop'], ['Ctrl', 'Walk slowly'],
  ['Space', 'Jump'], ['C', 'Crouch (quieter, harder to spot)'], ['E', 'Interact, talk, mount, loot, skin'], ['H', 'Whistle for your horse'],
  ['1 2 3 4', 'Holster / revolver / rifle / bow'], ['Right mouse', 'Aim'], ['Left mouse', 'Shoot (or punch when holstered)'], ['R', 'Reload'],
  ['Q', 'Focus: slow time while it lasts'], ['X', 'Quick eat / drink'], ['G', 'Rob someone you are aiming at'], ['B', 'Pat your horse'],
  ['Tab', 'Satchel'], ['M', 'Map'], ['J', 'Journal'], ['F5', 'Save'], ['Esc', 'Pause'],
];

export function initUI() {
  const root = $('#ui');
  root.innerHTML = `
  <div id="hud" class="hidden">
    <div id="objective"><div class="obj-title"></div><div class="obj-text"></div></div>
    <div id="topright"><div id="money"></div><div id="clock"></div><div id="honor"><span></span><div class="bar"><i></i></div></div></div>
    <div id="wanted" class="hidden"><span>${t('WANTED')}</span><b></b></div>
    <div id="bl">
      <canvas id="minimap" width="200" height="200"></canvas>
      <div id="cores">
        <div class="core" id="c-hp" title="${t('Health')}"><i>♥</i></div><div class="core" id="c-st" title="${t('Stamina')}"><i>⚡</i></div>
        <div class="core" id="c-fo" title="${t('Focus')}"><i>◎</i></div><div class="core" id="c-hu" title="${t('Hunger')}"><i>Ψ</i></div>
        <div class="core hidden" id="c-hs" title="${t('Horse stamina')}"><i>♞</i></div>
      </div>
    </div>
    <div id="ammo"></div>
    <div id="prompt" class="hidden"><span></span><div class="pbar hidden"><i></i></div></div>
    <div id="hint"></div>
    <div id="toasts"></div>
    <div id="crosshair"></div>
  </div>
  <div id="tint"></div><div id="hurt"></div>
  <div id="dialogue" class="hidden"><div class="who"></div><div class="text"></div><div class="choices"></div><div class="next">${t('E / Space ▸')}</div></div>
  <div id="banner" class="hidden"><div class="b1"></div><div class="b2"></div></div>
  <div id="duel" class="hidden"></div>
  <div id="death" class="hidden"><div>${t('YOU FELL')}</div><span>${t('The basin is not kind to the careless.')}</span></div>
  <div id="modal" class="hidden"><div class="panel"><div class="mhead"><h2></h2><span class="mmoney"></span><button class="x" data-act="close">${t('Close · Esc')}</button></div><div class="mbody"></div></div></div>
  <div id="fade"></div>
  <div id="title">
    <div class="poster">
      <div class="pre">${t('A frontier tale of the Sorrel Basin')}</div>
      <h1>DUSTFALL</h1>
      <div class="rule"><span>★</span></div>
      <div class="sub">${t('1887 · RIDE · HUNT · RECKON')}</div>
      <div class="btns"><button id="b-new">${t('New Game')}</button><button id="b-cont">${t('Continue')}</button><button id="b-ctrl">${t('Controls')}</button></div>
      <div class="langs" role="group" aria-label="${t('Language')}"><button id="l-ko" class="${lang === 'ko' ? 'on' : ''}">한국어</button><button id="l-en" class="${lang === 'en' ? 'on' : ''}">English</button></div>
      <div id="ctrl" class="hidden">${controlsHtml()}</div>
      <div class="foot">${t('An original open-world western · best played with mouse and keyboard')}</div>
      <div class="credit">${t('Korean localization by sigco3111 · original game by webKing021 (unofficial)')} · <a href="https://github.com/webKing021/dustfall" target="_blank" rel="noopener">webKing021/dustfall</a></div>
    </div>
  </div>`;

  const el = {
    hud: $('#hud'), objT: $('.obj-title'), objD: $('.obj-text'), money: $('#money'), clock: $('#clock'), honorL: $('#honor span'), honorB: $('#honor i'),
    wanted: $('#wanted'), bounty: $('#wanted b'), mini: $('#minimap'), ammo: $('#ammo'), prompt: $('#prompt'), promptT: $('#prompt span'), pbar: $('#prompt .pbar'), pfill: $('#prompt .pbar i'),
    hint: $('#hint'), toasts: $('#toasts'), cross: $('#crosshair'), tint: $('#tint'), hurt: $('#hurt'), dlg: $('#dialogue'), who: $('#dialogue .who'), text: $('#dialogue .text'),
    choices: $('#dialogue .choices'), next: $('#dialogue .next'), banner: $('#banner'), modal: $('#modal'), mh: $('#modal h2'), mm: $('#modal .mmoney'), mb: $('#modal .mbody'),
    fade: $('#fade'), title: $('#title'), duel: $('#duel'), death: $('#death'),
    cores: { hp: $('#c-hp'), st: $('#c-st'), fo: $('#c-fo'), hu: $('#c-hu'), hs: $('#c-hs') },
  };
  const mctx = el.mini.getContext('2d');
  let dlg = null, modalHandler = null, modalOpenAt = 0, modalOnClose = null, lastTxt = {}, frame = 0;
  const setTxt = (node, key, v) => { if (lastTxt[key] !== v) { lastTxt[key] = v; node.textContent = v; } };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ----- modal plumbing -----
  function openModal(title, html, handler, onClose) {
    if (G.mode !== 'play' && G.mode !== 'menu') return false;
    G.mode = 'menu'; releaseLock(); modalOpenAt = performance.now();
    el.modal.classList.remove('hidden'); el.mh.textContent = title; el.mb.innerHTML = html;
    modalHandler = handler || null; modalOnClose = onClose || null; el.mm.textContent = fmt(G.money);
    return true;
  }
  function closeModal(relock = true) {
    if (el.modal.classList.contains('hidden')) return;
    el.modal.classList.add('hidden'); modalHandler = null;
    G.mode = 'play'; if (relock) requestLock();
    const f = modalOnClose; modalOnClose = null; if (f) f();
  }
  el.modal.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    initAudio(); sfx.click();
    if (b.dataset.act === 'close') closeModal(); else if (modalHandler) modalHandler(b.dataset.act, b.dataset);
    el.mm.textContent = fmt(G.money);
  });
  const row = (name, desc, right, btns) => `<div class="row"><div class="rn"><b>${tx(name)}</b><small>${tx(desc || '')}</small></div><div class="rp">${tx(right || '')}</div><div class="rb">${btns || ''}</div></div>`;

  const ui = G.ui = {
    toast(msg, kind = '') {
      const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = tx(msg); el.toasts.appendChild(d);
      while (el.toasts.children.length > 5) el.toasts.firstChild.remove();
      setTimeout(() => d.classList.add('out'), 4600); setTimeout(() => d.remove(), 5200);
    },
    setObjective(ti, d) { el.objT.textContent = tx(ti); el.objD.textContent = tx(d || ''); },
    setPrompt(text, progress) {
      if (!text) { el.prompt.classList.add('hidden'); return; }
      el.prompt.classList.remove('hidden'); setTxt(el.promptT, 'prompt', tx(text));
      el.pbar.classList.toggle('hidden', progress === null || progress === undefined);
      if (progress !== null && progress !== undefined) el.pfill.style.width = clamp(progress * 100, 0, 100) + '%';
    },
    hurtFlash() { el.hurt.classList.remove('on'); void el.hurt.offsetWidth; el.hurt.classList.add('on'); },
    hitMarker(killed, head) { el.cross.className = killed ? 'kill' : head ? 'head' : 'hit'; setTimeout(() => { el.cross.className = ''; }, 160); },
    death(on) { el.death.classList.toggle('hidden', !on); },
    duel(text, cls = '') { el.duel.classList.toggle('hidden', !text); el.duel.textContent = tx(text) || ''; el.duel.className = text ? cls : 'hidden'; },
    fade(on) { el.fade.classList.toggle('on', on); return wait(650); },
    banner(big, small) {
      el.banner.querySelector('.b1').textContent = tx(big); el.banner.querySelector('.b2').textContent = tx(small || '');
      el.banner.classList.remove('hidden'); el.banner.classList.remove('show'); void el.banner.offsetWidth; el.banner.classList.add('show');
      sfx.good(); setTimeout(() => el.banner.classList.add('hidden'), 4200);
    },
    showHud(on) { el.hud.classList.toggle('hidden', !on); },
    hideTitle() { el.title.classList.add('hidden'); },

    // lines: [{who, text}], choices: ['...', '...'] -> resolves with the chosen index (or -1)
    dialogue(lines, choices) {
      return new Promise((res) => {
        dlg = { lines, i: 0, choices: choices || null, res, picking: false, back: G.mode === 'dialogue' || G.mode === 'menu' ? 'play' : G.mode };
        G.mode = 'dialogue'; consume('KeyE'); consume('Space'); mouse.clicked = false;
        showLine();
      });
    },

    openShop(shop) {
      // good standing earns a discount, a bad name costs extra
      const mult = () => (G.honor > 20 ? 1 - (Math.min(G.honor, 80) - 20) / 300 : G.honor < -20 ? 1 + (Math.min(-G.honor, 80) - 20) / 300 : 1);
      const price = (s) => (s.fixed ? s.price : Math.max(0.05, Math.round(s.price * mult() * 20) / 20));
      const render = () => {
        let h = `<p class="keeper">${tx(shop.line || '')}</p><div class="cols"><div><h3>${t('For sale')}</h3>`;
        shop.stock.forEach((s, i) => {
          if (s.hide && s.hide()) return;
          const it = s.item ? ITEMS[s.item] : s, pr = price(s), own = s.item ? ` <em>${tx('(have ' + count(s.item) + ')')}</em>` : '';
          h += row(it.name + (s.qty > 1 ? ` ×${s.qty}` : ''), s.desc || it.desc, fmt(pr), `<button data-act="buy" data-i="${i}" ${G.money < pr ? 'disabled' : ''}>${tx(s.verb || 'Buy')}</button>`).replace('</b><small>', own + '</b><small>');
        });
        h += `</div><div><h3>${t('They will buy')}</h3>`;
        const sell = (shop.buys || []).filter((id) => count(id) > 0);
        if (!sell.length) h += `<p class="dim">${t(shop.buys ? 'You have nothing they want. Bring pelts, meat or fish.' : 'This shop does not buy goods.')}</p>`;
        for (const id of sell) h += row(`${ITEMS[id].name} ×${count(id)}`, '', fmt(ITEMS[id].sell), `<button data-act="sell" data-id="${id}">${t('Sell 1')}</button><button data-act="sellall" data-id="${id}">${t('All')}</button>`);
        h += '</div></div>';
        if (G.honor > 20) h += `<p class="dim">${tx('Your good name earns you ' + Math.round((1 - mult()) * 100) + '% off.')}</p>`;
        el.mb.innerHTML = h;
      };
      if (!openModal(tx(shop.title), '', (act, d) => {
        if (act === 'buy') {
          const s = shop.stock[+d.i], pr = price(s);
          if (G.money < pr) return;
          if (s.can && !s.can()) return;
          addMoney(-pr); sfx.coin();
          if (s.item) addItem(s.item, s.qty || 1);
          if (s.act && s.act() === true) return;
        } else if (act === 'sell') { addItem(d.id, -1); addMoney(ITEMS[d.id].sell); sfx.coin(); }
        else if (act === 'sellall') { const n = count(d.id); addItem(d.id, -n); addMoney(ITEMS[d.id].sell * n); sfx.coin(); }
        if (G.mode === 'menu' && modalHandler) render();
      })) return;
      render();
    },

    openSatchel() {
      const render = () => {
        const p = G.player, ids = Object.keys(G.inv);
        let h = '<div class="cols"><div><h3>' + t('Provisions &amp; goods') + '</h3>';
        if (!ids.length) h += `<p class="dim">${t('Your satchel is empty.')}</p>`;
        for (const id of ids) {
          const it = ITEMS[id]; let b = '';
          if (it.use) b += `<button data-act="use" data-id="${id}">${t('Use')}</button>`;
          if (it.horse && G.horse.owned) b += `<button data-act="feed" data-id="${id}">${t('Feed horse')}</button>`;
          h += row(`${it.name} ×${G.inv[id]}`, it.desc, it.sell ? 'sells ' + fmt(it.sell) : '', b);
        }
        h += `</div><div><h3>${t('Weapons')}</h3>`;
        for (const w of ['revolver', 'rifle', 'bow']) if (G.weaponsOwned[w]) h += row(WEAPONS[w].name, `Loaded ${p.clip[w]}/${WEAPONS[w].clip} · spare ${count(WEAPONS[w].ammo)}`, '', '');
        h += `<h3>${t('Condition')}</h3>${row('Health', '', Math.round(p.hp) + '%')}${row('Stamina', '', Math.round(p.stamina) + '%')}${row('Focus', '', Math.round(p.focus) + '%')}${row('Hunger', p.hunger < 20 ? 'You are starving. Eat something.' : '', Math.round(p.hunger) + '%')}`;
        if (G.horse.owned) h += `<h3>${tx(G.horse.name)}</h3>${row('Trust', 'Grows as you ride, pat and feed her.', Math.round(G.horse.bond) + '%')}`;
        h += '</div></div>';
        el.mb.innerHTML = h;
      };
      if (openModal(t('Satchel'), '', (act, d) => { if (act === 'use') G.useItem(d.id); if (act === 'feed') G.feedHorse(d.id); render(); })) render();
    },

    openMap() {
      if (!openModal(t('Sorrel Basin'), `<canvas id="bigmap" width="620" height="620"></canvas><p class="dim">${t('Gold star: current objective · White: you · Horseshoe: your horse')}</p>`)) return;
      const c = $('#bigmap'), g = c.getContext('2d'), S = 620 / WORLD, T = (v) => (v + HALF) * S;
      g.drawImage(G.mapCanvas, 0, 0, 620, 620);
      g.font = 'bold 13px ' + FONT_SLAB; g.textAlign = 'center';
      for (const k in SITES) {
        const s = SITES[k]; g.fillStyle = 'rgba(29,20,16,.85)';
        const nm = tx(s.name), w = g.measureText(nm).width + 10; g.fillRect(T(s.x) - w / 2, T(s.z) - 26, w, 17);
        g.fillStyle = '#f1e3c6'; g.fillText(nm, T(s.x), T(s.z) - 13);
      }
      const mk = G.story.marker();
      if (mk) star(g, T(mk.x), T(mk.z), 9);
      if (G.horse.owned && !G.player.mounted) { g.fillStyle = '#fff'; g.strokeStyle = '#1d1410'; g.beginPath(); g.arc(T(G.horse.pos.x), T(G.horse.pos.z), 4, 0, 6.3); g.fill(); g.stroke(); }
      arrow(g, T(G.player.pos.x), T(G.player.pos.z), G.player.heading, 8);
    },

    openJournal() {
      const S = G.story; let h = `<div class="cols"><div><h3>${t('The story so far')}</h3>`;
      S.missions.forEach((m, i) => {
        if (i > S.m) return;
        h += row((i < S.m ? '✔ ' : '▸ ') + m.title, i < S.m ? m.recap : (S.cur() ? S.cur().obj : ''), '', '');
      });
      if (S.m >= S.missions.length) h += `<p class="dim">${t('The main story is finished. The basin is yours to roam.')}</p>`;
      if (G.bounty) h += `<h3>${t('Open warrant')}</h3>${row(G.bounty.name, G.bounty.state === 'done' ? 'Collect your reward from Sheriff Brandt.' : `Last seen near ${G.bounty.place}. Reward ${fmt(G.bounty.reward)}.`, '', '')}`;
      h += `</div><div><h3>${t('Your name in the basin')}</h3>${row(honorLabel(), 'Honour ' + Math.round(G.honor), '', '')}
        ${row('Day', '', G.day)}${row('Outlaws put down', '', G.stats.kills)}${row('Animals hunted', '', G.stats.hunted)}${row('Fish caught', '', G.stats.fish)}${row('Meals cooked', '', G.stats.cooked)}
        ${G.law.bounty > 0 ? row('Bounty on your head', 'Pay it at the telegraph office.', fmt(G.law.bounty)) : ''}</div></div>`;
      openModal(t('Journal'), h);
    },

    openPause() {
      if (G.mode !== 'play') return;
      const render = () => {
        el.mb.innerHTML = `<div class="pausebtns"><button data-act="close">${t('Resume')}</button><button data-act="save">${t('Save game')}</button>
          <button data-act="music">${t(G.settings.music ? 'Music: On' : 'Music: Off')}</button>
          <button data-act="sens">${tx('Mouse speed: ' + G.settings.sens.toFixed(1) + '×')}</button><button data-act="lang">${t(lang === 'ko' ? 'Language: 한국어 → English' : 'Language: English → 한국어')}</button><button data-act="quit">${t('Quit to title')}</button></div>
          <h3>${t('Controls')}</h3>${controlsHtml()}`;
      };
      openModal(t('Paused'), '', (act) => {
        if (act === 'save') { G.save(); ui.toast('Game saved.', 'good'); }
        if (act === 'music') G.settings.music = !G.settings.music;
        if (act === 'sens') G.settings.sens = G.settings.sens >= 2 ? 0.4 : Math.round((G.settings.sens + 0.2) * 10) / 10;
        if (act === 'lang') { setLang(lang === 'ko' ? 'en' : 'ko'); G.save(); location.reload(); return; }
        if (act === 'quit') { G.save(); location.reload(); return; }
        render();
      });
      render();
    },

    sleepMenu(cost = 0) {
      if (G.law.wanted) { ui.toast('No rest while the law is after you.', 'bad'); return true; }
      if (G.combatT < 15) { ui.toast('You cannot rest with enemies about.', 'bad'); return true; }
      const opts = [['Morning', 7], ['Noon', 12], ['Evening', 18], ['Night', 22]];
      openModal(t('Rest'), `<p class="keeper">${t(cost ? 'A clean bed and a locked door.' : 'Your bedroll, under canvas.')}${t(' Sleep until…')}</p><div class="pausebtns">${opts.map(([n, h]) => `<button data-act="sleep" data-h="${h}">${t(n)}</button>`).join('')}</div>`,
        async (act, d) => {
          if (act !== 'sleep') return;
          const hr = +d.h, p = G.player;
          el.modal.classList.add('hidden'); modalHandler = null;
          await ui.fade(true);
          if (hr <= G.time) { G.day++; if (G.onNewDay) G.onNewDay(); }
          G.time = hr; p.hp = 100; p.stamina = 100; p.focus = Math.min(100, p.focus + 50); p.hunger = Math.max(8, p.hunger - 18);
          const r = Math.random(); setWeather(r < 0.6 ? 'clear' : r < 0.8 ? 'cloudy' : r < 0.93 ? 'rain' : 'dust');
          G.weather.c = G.weather.rain = G.weather.dust = 0;
          await wait(500); await ui.fade(false);
          G.mode = 'play'; requestLock(); ui.toast('You wake rested. Day ' + G.day + '.', 'good'); G.save();
        });
      return true;
    },

    cookMenu() {
      const render = () => {
        let h = `<p class="keeper">${t('The fire is hot and the pan is black.')}</p>`;
        const any = count('rawMeat') + count('fish');
        if (!any) h += `<p class="dim">${t('You have nothing to cook. Hunt game or catch fish first.')}</p>`;
        if (count('rawMeat')) h += row(`Raw Game Meat ×${count('rawMeat')}`, 'Becomes flame-cooked meat.', '', `<button data-act="cook" data-id="rawMeat" data-n="1">${t('Cook 1')}</button><button data-act="cook" data-id="rawMeat" data-n="99">${t('All')}</button>`);
        if (count('fish')) h += row(`Fresh Fish ×${count('fish')}`, 'Becomes pan-fried fish.', '', `<button data-act="cook" data-id="fish" data-n="1">${t('Cook 1')}</button><button data-act="cook" data-id="fish" data-n="99">${t('All')}</button>`);
        el.mb.innerHTML = h;
      };
      if (openModal(t('Campfire'), '', (act, d) => {
        if (act !== 'cook') return;
        const n = Math.min(+d.n, count(d.id)); addItem(d.id, -n); addItem(d.id === 'rawMeat' ? 'cookedMeat' : 'cookedFish', n); G.stats.cooked += n;
        ui.toast('Cooked ' + n + '.', 'good'); render();
      })) render();
    },

    blackjack() {
      const S = { bet: 0, me: [], dl: [], phase: 'bet', msg: 'Place your bet.' };
      const draw = () => { const r = Math.floor(rand(13)) + 1; return { r, s: '♠♥♦♣'[Math.floor(rand(4))] }; };
      const val = (h) => { let t = 0, a = 0; for (const c of h) { t += c.r > 10 ? 10 : c.r === 1 ? 11 : c.r; if (c.r === 1) a++; } while (t > 21 && a) { t -= 10; a--; } return t; };
      const face = (c) => `<span class="card ${'♥♦'.includes(c.s) ? 'red' : ''}">${{ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[c.r] || c.r}${c.s}</span>`;
      const finish = (msg, mult) => { S.phase = 'bet'; addMoney(S.bet * mult); S.msg = msg; if (mult > 1) sfx.coin(); };
      const render = () => {
        let h = `<p class="keeper">${tx(S.msg)}</p>`;
        if (S.me.length) h += `<div class="bj"><div><h3>${t('Dealer')} ${S.phase === 'play' ? '' : val(S.dl)}</h3>${S.dl.map((c, i) => (S.phase === 'play' && i === 1 ? '<span class="card back">?</span>' : face(c))).join('')}</div><div><h3>${t('You')} ${val(S.me)}</h3>${S.me.map(face).join('')}</div></div>`;
        h += '<div class="pausebtns">';
        if (S.phase === 'bet') for (const b of [1, 5, 10, 25]) h += `<button data-act="bet" data-b="${b}" ${G.money < b ? 'disabled' : ''}>${tx('Bet ' + fmt(b))}</button>`;
        else h += `<button data-act="hit">${t('Hit')}</button><button data-act="stand">${t('Stand')}</button>`;
        el.mb.innerHTML = h + '</div>';
      };
      el.mh.textContent = t('Blackjack at the Gilded Mule');
      modalHandler = (act, d) => {
        if (act === 'bet') {
          S.bet = +d.b; if (G.money < S.bet) return;
          addMoney(-S.bet); S.me = [draw(), draw()]; S.dl = [draw(), draw()]; S.phase = 'play'; S.msg = 'Hit or stand?';
          if (val(S.me) === 21) finish('Blackjack! The table groans.', 2.5);
        } else if (act === 'hit') { S.me.push(draw()); if (val(S.me) > 21) finish('Bust. The house takes it.', 0); }
        else if (act === 'stand') {
          while (val(S.dl) < 17) S.dl.push(draw());
          const m = val(S.me), dv = val(S.dl);
          if (dv > 21 || m > dv) finish('You win the hand.', 2); else if (m === dv) finish('A push. Your stake comes back.', 1); else finish('Dealer wins.', 0);
        }
        render();
      };
      render();
      return true;
    },

    update(rdt) {
      frame++;
      // dialogue
      if (dlg) {
        if (dlg.picking) {
          for (let i = 0; i < dlg.choices.length; i++) if (wasPressed('Digit' + (i + 1)) || wasPressed('Numpad' + (i + 1))) { endDialogue(i); break; }
        } else if (wasPressed('KeyE') || wasPressed('Space') || wasPressed('Enter') || mouse.clicked) {
          consume('KeyE'); consume('Space'); sfx.click(); dlg.i++;
          if (dlg.i < dlg.lines.length) showLine();
          else if (dlg.choices) { dlg.picking = true; showChoices(); } else endDialogue(-1);
        }
      } else if (G.mode === 'menu') {
        if ((wasPressed('Escape') || wasPressed('Tab')) && performance.now() - modalOpenAt > 250 && modalHandler !== undefined) closeModal();
      } else if (G.mode === 'play') {
        if (wasPressed('Tab')) ui.openSatchel();
        else if (wasPressed('KeyM')) ui.openMap();
        else if (wasPressed('KeyJ')) ui.openJournal();
        else if (wasPressed('KeyP') || wasPressed('Escape')) ui.openPause();
        else if (wasPressed('F5')) { G.save(); ui.toast('Game saved.', 'good'); }
      }
      if (G.mode === 'title' || !G.player) return;
      if (G.mode !== 'play') el.prompt.classList.add('hidden');
      // hud
      const p = G.player, h = G.horse, L = G.law;
      const core = (k, v, low) => { const n = el.cores[k], r = Math.round(v); if (n._v !== r) { n._v = r; n.style.setProperty('--v', r); n.classList.toggle('low', r < low); } };
      core('hp', p.hp, 30); core('st', p.stamina, 15); core('fo', p.focus, 0); core('hu', p.hunger, 20);
      el.cores.hs.classList.toggle('hidden', !p.mounted); if (p.mounted) core('hs', h.stamina, 15);
      setTxt(el.money, 'money', fmt(G.money));
      const hr = Math.floor(G.time), mn = Math.floor((G.time - hr) * 60 / 5) * 5;
      const hm = `${(hr + 11) % 12 + 1}:${String(mn).padStart(2, '0')}`, ap = t(hr < 12 ? 'AM' : 'PM');
      setTxt(el.clock, 'clock', lang === 'ko' ? `${G.day}일째 · ${ap} ${hm} · ${t(G.weather.type)}` : `Day ${G.day} · ${hm} ${ap} · ${G.weather.type}`);
      setTxt(el.honorL, 'honor', tx(honorLabel())); el.honorB.style.left = (G.honor + 100) / 2 + '%';
      el.wanted.classList.toggle('hidden', !(L.wanted || L.bounty > 0)); el.wanted.classList.toggle('active', L.wanted);
      setTxt(el.bounty, 'bounty', tx(L.wanted ? `Bounty ${fmt(L.bounty)}` : `Bounty ${fmt(L.bounty)} · unpaid`));
      if (p.weapon === 'none') setTxt(el.ammo, 'ammo', t('Holstered'));
      else { const w = WEAPONS[p.weapon]; setTxt(el.ammo, 'ammo', `${tx(w.name)}  ${p.reloadT > 0 ? t('reloading…') : p.clip[p.weapon] + ' / ' + count(w.ammo)}`); }
      el.cross.style.opacity = p.weapon !== 'none' && G.mode === 'play' ? (p.aiming ? 1 : 0.45) : 0;
      el.tint.classList.toggle('on', p.focusOn);
      setTxt(el.hint, 'hint', G.mode === 'play' && !mouse.locked ? t('Click the game to capture the mouse  ·  arrow keys also turn the camera') : '');
      if (frame % 2 === 0) drawMini();
    },
  };

  function showLine() {
    const l = dlg.lines[dlg.i];
    el.dlg.classList.remove('hidden'); el.who.textContent = tx(l.who) || ''; el.who.classList.toggle('hidden', !l.who);
    el.text.textContent = tx(l.text); el.choices.innerHTML = ''; el.next.classList.remove('hidden');
    el.dlg.classList.toggle('narr', !l.who);
  }
  function showChoices() {
    el.next.classList.add('hidden');
    el.choices.innerHTML = dlg.choices.map((c, i) => `<div class="choice" data-i="${i}"><b>${i + 1}</b>${tx(c)}</div>`).join('');
  }
  el.choices.addEventListener('click', (e) => { const c = e.target.closest('.choice'); if (c && dlg && dlg.picking) endDialogue(+c.dataset.i); });
  function endDialogue(i) {
    const d = dlg; dlg = null; el.dlg.classList.add('hidden');
    G.mode = d.back === 'title' ? 'title' : d.back; mouse.clicked = false;
    for (let k = 1; k <= 4; k++) consume('Digit' + k);
    d.res(i);
  }

  // ----- minimap -----
  function star(g, x, y, r) {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = '#e0a526'; g.strokeStyle = '#1d1410'; g.lineWidth = 2; g.fill(); g.stroke();
  }
  function arrow(g, x, y, heading, s) {
    g.save(); g.translate(x, y); g.rotate(Math.PI - heading);
    g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.7, s * 0.8); g.lineTo(0, s * 0.35); g.lineTo(-s * 0.7, s * 0.8); g.closePath();
    g.fillStyle = '#fff'; g.strokeStyle = '#1d1410'; g.lineWidth = 2; g.fill(); g.stroke(); g.restore();
  }
  function drawMini() {
    const p = G.player, R = 150, mc = G.mapCanvas, k = mc.width / WORLD;
    mctx.fillStyle = '#3a3226'; mctx.fillRect(0, 0, 200, 200);
    mctx.drawImage(mc, (p.pos.x - R + HALF) * k, (p.pos.z - R + HALF) * k, R * 2 * k, R * 2 * k, 0, 0, 200, 200);
    const T = (x, z) => [100 + (x - p.pos.x) / R * 100, 100 + (z - p.pos.z) / R * 100];
    for (const a of G.actors) {
      if (!a.alive || a.asleep || a.kind !== 'human') continue;
      const [x, y] = T(a.pos.x, a.pos.z); if (x < 0 || y < 0 || x > 200 || y > 200) continue;
      let col = null;
      if (a.state === 'combat') col = '#e0392b'; else if (a.faction === 'law') col = '#5aa0e0'; else if (a.shop || a.id) col = '#f1e3c6';
      if (!col) continue;
      mctx.fillStyle = col; mctx.beginPath(); mctx.arc(x, y, 3.2, 0, 6.3); mctx.fill();
    }
    if (G.horse.owned && !p.mounted) { const [x, y] = T(G.horse.pos.x, G.horse.pos.z); mctx.fillStyle = '#fff'; mctx.strokeStyle = '#1d1410'; mctx.lineWidth = 1.5; mctx.beginPath(); mctx.arc(clamp(x, 6, 194), clamp(y, 6, 194), 4, 0, 6.3); mctx.fill(); mctx.stroke(); }
    const mk = G.story.marker();
    if (mk) {
      let [x, y] = T(mk.x, mk.z); const dx = x - 100, dy = y - 100, d = Math.hypot(dx, dy);
      if (d > 90) { x = 100 + dx / d * 90; y = 100 + dy / d * 90; }
      star(mctx, x, y, 8);
    }
    arrow(mctx, 100, 100, p.mounted ? G.horse.heading : p.heading, 8);
    mctx.fillStyle = '#f1e3c6'; mctx.font = 'bold 12px ' + FONT_SLAB; mctx.textAlign = 'center'; mctx.fillText('N', 100, 14);
  }

  // ----- title -----
  $('#b-cont').disabled = !G.hasSave();
  $('#b-new').onclick = () => { initAudio(); sfx.click(); G.startGame(false); };
  $('#b-cont').onclick = () => { initAudio(); sfx.click(); G.startGame(true); };
  for (const l of ['ko', 'en']) $('#l-' + l).onclick = () => { if (l !== lang) { setLang(l); location.reload(); } };
  $('#b-ctrl').onclick = () => { initAudio(); sfx.click(); $('#ctrl').classList.toggle('hidden'); };
  return ui;
}

function controlsHtml() {
  return `<div class="controls">${CONTROLS.map(([k, d]) => `<div><kbd>${tx(k)}</kbd><span>${tx(d)}</span></div>`).join('')}</div>`;
}
