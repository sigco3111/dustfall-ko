// The people of Marrow Creek, the main story, bounty work, shops and saving.
import { G, rand, pick, mouse, sfx, addItem, addMoney, addHonor, count, fmt, requestLock, dist2 } from './core.js';
import { SITES, groundHeight, box, fx } from './world.js';
import { spawnHuman, spawnAnimal, spawnGang, removeTagged, aliveTagged, LOOKS, findWildSpot, reviveTown, damageActor } from './actors.js';
import { poseHuman, humanAction } from './models.js';
import * as THREE from 'three';
import { tx } from './i18n.js';

const say = (who, text) => ({ who, text });
const N = (text) => ({ text });
const WREN = 'Wren Calloway';
const D = (lines, choices) => G.ui.dialogue(lines, choices);
const actor = (id) => G.actors.find((a) => a.id === id && !a.removed);

const SHOPS = {
  general: {
    title: "Finch's General Store", line: '“If it isn\'t on the shelf, the basin doesn\'t need it.”',
    stock: [{ item: 'jerky', price: 1.5 }, { item: 'beans', price: 2.5 }, { item: 'bread', price: 1 }, { item: 'apple', price: 0.5 }, { item: 'bitters', price: 4 }, { item: 'arrows', qty: 10, price: 2 },
      { name: 'Fishing Rod', desc: 'Stand on the bank of the Sorrel, face the water and cast.', price: 8, hide: () => count('fishingRod') > 0, act: () => addItem('fishingRod') }],
    buys: ['deerPelt', 'wolfPelt', 'rabbitPelt', 'cowHide', 'rawMeat', 'fish', 'cookedMeat', 'cookedFish'],
  },
  gunsmith: {
    title: 'Kessler Gunsmith', line: '“A clean gun is a polite gun.”',
    stock: [{ item: 'revolverAmmo', qty: 12, price: 1.5 }, { item: 'rifleAmmo', qty: 10, price: 2.5 }, { item: 'arrows', qty: 10, price: 2 },
      { name: 'Repeater Rifle', desc: 'Long reach and a heavy punch. Key 3.', price: 85, hide: () => G.weaponsOwned.rifle, act: () => { G.weaponsOwned.rifle = true; addItem('rifleAmmo', 10); } },
      { name: 'Hunting Bow', desc: 'Silent. Will not spook a herd or wake a camp. Key 4.', price: 35, hide: () => G.weaponsOwned.bow, act: () => { G.weaponsOwned.bow = true; addItem('arrows', 12); } }],
  },
  doctor: {
    title: 'Dr. Hale, Physician', line: '“Sit. Bleed on the towel, not the floor.”',
    stock: [{ item: 'tonic', price: 6 }, { item: 'elixir', price: 7 },
      { name: 'Treatment', desc: 'Dr. Hale sees to your wounds at once.', price: 3, verb: 'Pay', fixed: true, act: () => { G.player.hp = 100; G.ui.toast('Stitched, bound and scolded.', 'good'); } }],
  },
  saloon: {
    title: 'The Gilded Mule Saloon', line: '“First one costs. So do the rest.”',
    stock: [{ item: 'whiskey', price: 1.5 },
      { name: 'Hot Supper', desc: 'Stew, bread and no questions.', price: 2, verb: 'Eat', act: () => { const p = G.player; p.hunger = 100; p.hp = Math.min(100, p.hp + 25); G.ui.toast('You eat until the bowl shines.', 'good'); } },
      { name: 'Sit in at Blackjack', desc: 'Try your luck against the house.', price: 0, verb: 'Play', fixed: true, act: () => G.ui.blackjack() }],
  },
  hotel: {
    title: 'Crane Hotel', line: '“Boots off before the stairs, if you please.”',
    stock: [{ name: 'Room for the Night', desc: 'Sleep, mend, and let the hours pass.', price: 1, verb: 'Rent', fixed: true, act: () => G.ui.sleepMenu(1) }],
  },
  stable: {
    title: 'Pike Livery Stable', line: '“Treat her right and she\'ll carry you out of anything.”',
    stock: [{ item: 'oats', price: 1 }, { item: 'apple', price: 0.5 },
      { name: 'Trail Saddle', desc: 'Your horse tires more slowly at a gallop.', price: 40, hide: () => !G.horse.owned || G.horse.saddle > 0, act: () => { G.horse.saddle = 1.5; } },
      { name: 'Fetch My Horse', desc: 'Ezra brings her round to the stable door.', price: 0.5, fixed: true, verb: 'Fetch', hide: () => !G.horse.owned, act: () => { const h = G.horse; h.pos.set(-8, 0, 5); h.state = 'idle'; if (G.player.mounted) G.player.mounted = false; } }],
  },
};

const GREETS = ['Morning. Or whatever it is by now.', "You're the Calloway kid. Sorry about your pa. He was a decent man.", "Thorne's men rode through again. Nobody looked up.", 'Rain is coming. My knee says so.',
  'Keep that iron holstered in town and we will get along.', 'June Finch breeds the best horses this side of the Sorrel.', 'They say there are wolves on the north trail after dark.', "If you fish, try the bank south of the bridge.",
  'Rosalind deals an honest hand. Mostly.', 'This town was something before the rail company came.'];

function populate() {
  const V = (o) => spawnHuman({ faction: 'vendor', essential: true, heading: 0, ...o });
  V({ id: 'sheriff', name: 'Sheriff Brandt', x: -58, z: -9.6, look: { shirt: 0x39485a, vest: 0x1d1d1d, hat: 0x8a7350, badge: true, hair: 0x8a8a84, pants: 0x2a2a30, skin: 0xc68642 } });
  V({ id: 'tobe', name: 'Tobias Finch', x: -40, z: -9.6, shop: 'general', look: { shirt: 0xd9d2bd, vest: 0x556b4a, hat: false, beard: true, hair: 0x8a8a84, skin: 0xe0ac69 } });
  V({ id: 'barkeep', name: 'Rosalind Vane', x: -18, z: -10.2, shop: 'saloon', look: { skirt: 0x7a2318, shirt: 0x7a2318, hat: false, hair: 0x1b1512, skin: 0xf1c27d } });
  V({ id: 'hotel', name: 'Mrs. Crane', x: 6, z: -10.2, shop: 'hotel', look: { skirt: 0x23404a, shirt: 0xb9a888, hat: false, hair: 0x8a8a84, skin: 0xffdbac } });
  V({ id: 'clerk', name: 'Mr. Pruitt', x: 28, z: -9.6, look: { shirt: 0xe6e0d0, vest: 0x1d1d1d, hat: 0x1d1d1d, pants: 0x1d1d1d, skin: 0xffdbac } });
  V({ id: 'gunsmith', name: 'Hobb Kessler', x: -52, z: 9.6, heading: Math.PI, shop: 'gunsmith', look: { shirt: 0x6b4f4f, coat: 0x3a2616, hat: false, beard: true, skin: 0x8d5524 } });
  V({ id: 'doctor', name: 'Dr. Imogen Hale', x: -34, z: 9.6, heading: Math.PI, shop: 'doctor', look: { skirt: 0x33302c, shirt: 0xe6e0d0, hat: false, hair: 0x4a3324, skin: 0xa5673f } });
  V({ id: 'stable', name: 'Ezra Pike', x: -8, z: 8.6, heading: Math.PI, shop: 'stable', look: { shirt: 0x8a5a44, vest: 0x4a3b2a, hat: 0xb9a070, skin: 0x8d5524 } });
  V({ id: 'june', name: 'June Finch', x: -75, z: -268.4, look: { shirt: 0x8a5a44, pants: 0x4a3b2a, hat: 0xb9a070, hair: 0x9a6a3a, vest: 0x5a4330, skin: 0xe0ac69 } });
  for (let i = 0; i < 3; i++) spawnHuman({ name: 'Deputy', faction: 'law', x: -40 + i * 35, z: rand(-4, 4), wander: true, homeR: 22, respawn: true, hp: 120, look: LOOKS.deputy() });
  const first = ['Abel', 'Clara', 'Josiah', 'Mabel', 'Silas', 'Nettie', 'Ruben', 'Opal', 'Cyrus', 'Della', 'Amos', 'Pearl'], last = ['Whitlow', 'Garrity', 'Okonkwo', 'Sandoval', 'Brandvold', 'Mercer', 'Yoder', 'Tanaka', 'Ibarra', 'Lachance'];
  for (let i = 0; i < 10; i++) {
    spawnHuman({ name: `${first[i]} ${pick(last)}`, faction: 'civil', x: -60 + i * 12 + rand(-3, 3), z: rand(-6, 6), wander: true, homeR: 20, respawn: true, sleeps: true, look: LOOKS.towns() });
  }
  spawnHuman({ name: 'Ranch Hand', faction: 'civil', x: -90, z: -264, wander: true, homeR: 9, respawn: true, look: LOOKS.towns() });
  for (let i = 0; i < 6; i++) spawnAnimal('cow', -96 + rand(-10, 10), -238 + rand(-9, 9), { faction: 'ranch', homeR: 9, look: { color: pick([0x6e4a2e, 0x2a2018, 0x8a6a42]) } });

  // things in the world you can use
  const c = SITES.camp, g = SITES.gulch, d = SITES.depot, S = G.story;
  const sb = box(0.8, 0.5, 0.55, 0x3a3a3a, g.x + 2.2, groundHeight(g.x + 2.2, g.z - 5.5) + 0.25, g.z - 5.5);
  sb.add(box(1.02, 0.14, 1.04, 0xe0a526, 0, 0.1, 0)); G.scene.add(sb);
  G.interactables.push(
    { x: c.x + 1, z: c.z + 2, r: 2.8, label: 'Cook at the fire', action: () => G.ui.cookMenu() },
    { x: c.x - 1.5, z: c.z + 4.5, r: 2.2, label: 'Sleep on your bedroll', action: () => G.ui.sleepMenu(0) },
    { x: -50, z: -9.6, r: 2.2, label: 'Read the bounty board', action: bountyBoard },
    { x: g.x + 2.2, z: g.z - 5.5, r: 2.6, label: 'Open the strongbox', action: () => S.complete(), enabled: () => S.is(3, 2) },
    { x: d.x, z: d.z + 8.4, r: 2.6, label: 'Search the office for the ledger', action: () => S.complete(), enabled: () => S.is(4, 1) },
  );
}

// ---------- bounty work ----------
async function bountyBoard() {
  if (G.bounty) { G.ui.toast(G.bounty.state === 'done' ? 'Collect your reward from Sheriff Brandt.' : `You already carry the warrant for ${G.bounty.name}.`); return; }
  if (G.law.bounty > 0) { G.ui.toast('Your own face is on this board. Pay your bounty first.', 'bad'); return; }
  const name = `${pick(['Cutter', 'Rattlesnake', 'One-Eye', 'Preacher', 'Sour', 'Lucky', 'Iron', 'Gentleman'])} ${pick(['Maddox', 'Pell', 'Varga', 'Okafor', 'Lindqvist', 'Dray', 'Hollis', 'Quade'])}`;
  const useMesa = Math.random() < 0.5, spot = useMesa ? SITES.mesa : (findWildSpot(260, 460, 0, 0) || SITES.mesa);
  const place = spot === SITES.mesa ? 'Dry Bones Mesa' : `the wilds ${spot.z < -80 ? 'north' : spot.z > 80 ? 'south' : ''}${spot.x < -80 ? 'west' : spot.x > 80 ? 'east' : ''} of town`.replace('  ', ' ');
  const reward = 30 + Math.round(rand(40));
  const crime = pick(['stage robbery and arson', 'horse theft and murder', 'robbing the Sorrel mail', 'rustling and three killings', 'burning the Garrity barn']);
  const c = await D([say('Bounty Board', `WANTED — ${name}. For ${crime}. Last seen near ${place} with armed company. Reward ${fmt(reward)}, dead or alive. — A. Brandt, Sheriff`)], ['Take the poster', 'Leave it']);
  if (c !== 0) return;
  G.bounty = { name, x: spot.x, z: spot.z, place, reward, state: 'active' };
  spawnBounty(); G.ui.toast(`Warrant taken: ${name}. Marked on your map.`, 'good');
}
function spawnBounty() {
  const b = G.bounty; if (!b || b.state !== 'active') return;
  removeTagged('bountyGang'); removeTagged('bountyTarget');
  spawnGang('bountyGang', b.x, b.z, 3, 'bandit', { spread: 10 });
  spawnHuman({ x: b.x + 1, z: b.z + 1, name: b.name, faction: 'bandit', tags: ['bountyTarget'], hp: 170, acc: 1.15, wander: true, homeR: 6, cash: 15, weapon: 'rifle', look: { shirt: 0x7a2318, coat: 0x1b1512, hat: 0x1b1512, bandana: 0x1b1512, beard: true } });
}

// ---------- the final duel ----------
let duel = null;
function runDuel(th) {
  return new Promise((res) => {
    const p = G.player;
    if (p.mounted) { p.mounted = false; G.horse.state = 'idle'; G.horse.speed = 0; }
    p.pos.set(th.pos.x, 0, th.pos.z + 10); p.pos.y = groundHeight(p.pos.x, p.pos.z);
    p.heading = Math.PI; p.yaw = Math.PI; p.pitch = -0.04; p.weapon = 'revolver'; p.aiming = false; p.focusOn = false; G.timeScale = 1;
    p.model.position.copy(p.pos); p.model.rotation.set(0, Math.PI, 0); poseHuman(p.model, { weapon: 'revolver', speed: 0 });
    th.heading = 0; th.state = 'idle'; th.model.rotation.y = 0;
    duel = { state: 'wait', t: rand(2.4, 4.6), res, th };
    G.mode = 'duel'; G.ui.setPrompt(null); G.ui.duel('Steady…  click to fire the instant you see DRAW'); requestLock();
  });
}
function updateDuel(rdt) {
  const d = duel; if (!d) return;
  const p = G.player; d.t -= rdt;
  if (d.state === 'wait') {
    if (mouse.clicked) { G.ui.duel('Too soon! Thorne only smiles.', 'bad'); d.state = 'reset'; d.t = 1.8; }
    else if (d.t <= 0) { d.state = 'draw'; d.t = 0.75; G.ui.duel('DRAW!', 'go'); sfx.click(); }
  } else if (d.state === 'draw') {
    if (mouse.clicked) {
      sfx.shot(1); poseHuman(p.model, { aim: true, weapon: 'revolver', speed: 0 }); humanAction(p.model, 'shoot');
      const a = new THREE.Vector3(p.pos.x, p.pos.y + 1.45, p.pos.z - 0.6), b = new THREE.Vector3(d.th.pos.x + 0.2, d.th.pos.y + 1.4, d.th.pos.z);
      fx.tracer(a, b); fx.puff(b, 0x8a1c14, 6);
      G.ui.duel(''); duel = null; G.mode = 'play'; d.res(true);
    } else if (d.t <= 0) {
      sfx.shot(0.9); p.hp = Math.max(8, p.hp - 30); G.ui.hurtFlash();
      G.ui.duel('Too slow. His bullet clips you.', 'bad'); d.state = 'reset'; d.t = 2;
    }
  } else if (d.t <= 0) { d.state = 'wait'; d.t = rand(2.2, 4.6); G.ui.duel('Steady…'); poseHuman(p.model, { weapon: 'revolver', speed: 0 }); }
}

// ---------- missions ----------
const at = (id) => () => { const a = actor(id); return a ? a.pos : null; };
const MISSIONS = [
  {
    title: 'Ashes on the Wind', recap: 'You came home to Marrow Creek and found Tobias Finch.',
    steps: [{
      obj: 'Walk east into Marrow Creek and find Tobias Finch outside the general store. Press E to talk.', marker: at('tobe'), talk: 'tobe',
      done: async () => {
        await D([say('Tobias Finch', "Well, I'll be. Wren Calloway. You have your pa's walk, right down to the bad knee."),
          say(WREN, 'Tobias. I got your letter.'),
          say('Tobias Finch', "Wish I'd had better to write. Thorne's men made an offer on the Flats three times. Your pa said no three times. Then came the fire."),
          say(WREN, 'Can anyone prove it?'),
          say('Tobias Finch', "Nobody who'd live to testify. But a man who buys a whole valley keeps books. Find the paper and you find the rope."),
          say('Tobias Finch', "First things first. You can't chase a cattle baron on foot. My sister June runs the ranch north of town. Tell her I sent you."),
          say('Tobias Finch', "And take this. It isn't charity. It's wages your pa never collected.")]);
        addMoney(20); addItem('jerky', 3); addItem('revolverAmmo', 24); sfx.coin();
        G.ui.toast('Received $20.00, venison jerky and revolver cartridges.', 'good');
        G.ui.toast('Tobias also buys pelts and meat. Talk to him again to trade.');
      },
    }],
  },
  {
    title: 'Four Legs Better', recap: 'June Finch gave you a horse and pointed you to Hollow Camp.',
    steps: [{
      obj: 'Follow the north road to Finch Ranch and speak with June Finch.', marker: at('june'), talk: 'june',
      done: () => D([say('June Finch', "Tobe sent word. You're Amos Calloway's kid. He pulled my wagon out of the Sorrel in a flood once and never let me pay him."),
        say('June Finch', "So I'll pay you. There's a bay mare in the corral. Three years old and sure every human is a wolf in a hat."),
        say('June Finch', 'Walk up slow. Talk low, keep your hand out, and wait until she quits trembling. If she lets you, she is yours.')]),
    }, {
      obj: 'Walk up to the bay mare in the corral and hold E until she is calm.', marker: () => G.horse.pos,
      done: async () => {
        const names = ['Juniper', 'Ember', 'Marigold'];
        const c = await D([N('The mare blows hard through her nose, stamps once, then lowers her head into your palm.'), say('June Finch', 'Well. She never did that for me. What will you call her?')], names);
        const h = G.horse; h.name = names[Math.max(0, c)]; h.owned = true; h.bond = 10;
        await D([say('June Finch', `${h.name}. That suits her. Now, there's an old line camp west of town, by the hollow. Nobody has used it since the drought, and it isn't on Thorne's maps.`),
          say('June Finch', 'Ride her there. Shift to gallop, but mind her wind. And whistle with H if she wanders.')]);
        G.ui.toast(`${h.name} is yours. Press E beside her to mount.`, 'good');
      },
    }, {
      obj: 'Mount up with E and ride to Hollow Camp, west of town.', marker: () => SITES.camp, goto: { x: SITES.camp.x, z: SITES.camp.z, r: 15 },
      done: () => D([N('Hollow Camp. A canvas tent, a ring of stones, and quiet.'), N('Sleep on the bedroll to pass the hours and mend. Cook what you hunt at the fire. The game saves whenever you rest.'), N('The larder is empty, though. There are deer in the hills to the north.')]),
    }],
  },
  {
    title: 'Meat for the Pot', recap: 'You hunted, cooked and made the camp your own.',
    steps: [{
      obj: 'Hunt deer in the hills north of camp. Skin them with E and collect 2 raw meat. Crouch (C) to get close.', marker: () => S.flags.hunt,
      enter: () => {
        if (!S.flags.hunt) S.flags.hunt = findWildSpot(0, 70, -300, -30) || { x: -300, z: -30 };
        if (count('rawMeat') < 2) for (let i = 0; i < 4; i++) spawnAnimal('deer', S.flags.hunt.x + rand(-10, 10), S.flags.hunt.z + rand(-10, 10), { wild: true });
      },
      check: () => count('rawMeat') >= 2,
      done: () => { G.ui.toast('That will do. Take it back to your campfire.', 'good'); },
    }, {
      obj: 'Return to Hollow Camp and cook the meat at your fire.', marker: () => SITES.camp,
      enter: () => { if (S.flags.cook0 === undefined) S.flags.cook0 = G.stats.cooked; },
      check: () => G.stats.cooked > S.flags.cook0,
      done: () => D([N('Fat spits in the pan. For the first time in three weeks, you eat something hot.'), N('Open your satchel with Tab to eat, or press X for a quick bite. Tobias will want to know you are settled.')]),
    }, {
      obj: 'Go back to town and talk to Tobias Finch.', marker: at('tobe'), talk: 'tobe',
      done: () => D([say('Tobias Finch', 'You look fed. Good. Now listen. Sheriff Brandt was in here asking who the new gun in town was.'),
        say('Tobias Finch', "Ada Brandt is the only law in the basin Thorne doesn't own. Which means she is short on deputies and long on enemies. Go and see her.")]),
    }],
  },
  {
    title: 'A Badge and a Bad Lot', recap: 'You broke the Ash Riders at Vulture Gulch and found a pay chit.',
    steps: [{
      obj: "Speak with Sheriff Brandt outside the sheriff's office.", marker: at('sheriff'), talk: 'sheriff',
      done: async () => {
        await D([say('Sheriff Brandt', 'Calloway. I knew your father. Stubborn as a fence post, and about as easy to bribe.'),
          say('Sheriff Brandt', "I can't touch Thorne. The judge dines at his table. The Ash Riders are another matter. Wanted in three counties, and everybody knows who pays for their whiskey."),
          say('Sheriff Brandt', "They're holed up at Vulture Gulch, north-west past the Finch place. Six guns, maybe. Clear them out and bring me anything with Thorne's name on it."),
          say('Sheriff Brandt', 'Take this rifle. County property. Try to bring it back with the same number of holes.')]);
        G.weaponsOwned.rifle = true; addItem('rifleAmmo', 25);
        G.ui.toast('Received the Repeater Rifle. Press 3 to draw it.', 'good');
        G.ui.toast('Press Q with a weapon drawn to slow time with Focus.');
      },
    }, {
      obj: 'Ride to Vulture Gulch and clear out the Ash Riders. Right mouse aims, left mouse fires.', marker: () => SITES.gulch,
      enter: () => { if (!aliveTagged('gulch').length) spawnGang('gulch', SITES.gulch.x, SITES.gulch.z, 6, 'bandit', { spread: 14 }); },
      check: () => !aliveTagged('gulch').length,
      done: () => { G.ui.toast('The gulch is quiet. Search their strongbox by the crates.', 'good'); },
    }, {
      obj: 'Open the strongbox in the outlaw camp.', marker: () => ({ x: SITES.gulch.x + 2.2, z: SITES.gulch.z - 5.5 }),
      done: async () => {
        await D([N("Inside the strongbox: forty dollars in rail scrip and a pay chit."), N("“Rec'd of the T. C. & R. Co. depot office, for night work at Sorrel Flats.” It is dated the night of the fire.")]);
        addMoney(40); addItem('payChit'); sfx.coin();
      },
    }, {
      obj: 'Bring the pay chit to Sheriff Brandt.', marker: at('sheriff'), talk: 'sheriff',
      done: async () => {
        await D([say('Sheriff Brandt', 'A pay chit for the night of the fire. That is the first real thread anybody has pulled.'),
          say('Sheriff Brandt', 'But a chit is a scrap. It points at a ledger. The depot office keeps one for every dollar that moves, and that book would hang him.'),
          say('Sheriff Brandt', "I can't send a deputy onto rail property without a warrant, and I can't get a warrant without the book. You see my trouble."),
          say(WREN, "I'm not a deputy."),
          say('Sheriff Brandt', 'No. You are not. The depot is south of town. I would go after dark, and I would go quiet.')]);
        addItem('payChit', -1); addMoney(60); addHonor(10); sfx.coin();
        G.ui.toast('Received $60.00. The bounty board by the office now has work for you too.', 'good');
      },
    }],
  },
  {
    title: 'The Ledger', recap: "You took Thorne's ledger from the rail depot.",
    steps: [{
      obj: "Travel to the Thorne Rail Depot, south of town. Night and a crouch (C) keep you hidden; a bow kills quietly.", marker: () => SITES.depot, goto: { x: SITES.depot.x, z: SITES.depot.z, r: 85 },
      enter: () => { if (!aliveTagged('depot').length) spawnGang('depot', SITES.depot.x, SITES.depot.z + 12, 5, 'thorne', { spread: 20, detect: 34, hp: 100 }); },
      done: () => { G.ui.toast("Company guards patrol the platform. The office door faces the tracks."); },
    }, {
      obj: 'Reach the office door on the platform side of the depot and take the ledger.', marker: () => ({ x: SITES.depot.x, z: SITES.depot.z + 8.4 }),
      enter: () => { if (!aliveTagged('depot').length && !S.flags.depotSeen) { S.flags.depotSeen = 1; spawnGang('depot', SITES.depot.x, SITES.depot.z + 12, 5, 'thorne', { spread: 20, detect: 34, hp: 100 }); } },
      done: async () => {
        await D([N('The office ledger. Page after page in a clerk\'s neat hand: surveyors, judges, and one line that stops your breath.'), N('“Night work — Sorrel Flats — $400.” Signed, S. Thorne.')]);
        addItem('ledger');
        G.ui.toast('You have the ledger. Get out before more guns arrive.', 'good');
      },
    }, {
      obj: 'Take the ledger to Sheriff Brandt — or hear what Mr. Pruitt at the telegraph office would pay for it.', marker: at('sheriff'), talk: ['sheriff', 'clerk'],
      done: async (a) => {
        if (a.id === 'clerk') {
          const c = await D([say('Mr. Pruitt', "That wouldn't be a rail company ledger under your coat? No, don't answer. I read other people's telegrams for a living. I know a secret by its shape."),
            say('Mr. Pruitt', 'The sheriff will give you a handshake for it. I know a gentleman in Carrow City who would give three hundred dollars, and Thorne would pay him double to keep it quiet. Everybody profits.')],
          ['Sell the ledger for $300', 'Keep it. This goes to the sheriff.']);
          if (c !== 0) { await D([say('Mr. Pruitt', 'Principles. How expensive for you.')]); return false; }
          addItem('ledger', -1); addMoney(300); addHonor(-30); S.flags.sold = 1; sfx.coin();
          await D([say('Mr. Pruitt', 'A pleasure. I was never here, and neither were you.'), N('By morning Thorne knows exactly who held his book. A rider brings word: come to the ranch and settle it.')]);
        } else {
          await D([say('Sheriff Brandt', "…By God. It's all here. Every bribe. Every name."),
            say('Sheriff Brandt', "I'll wire the territorial marshal tonight. But he is a week away, and Thorne will know by breakfast. He'll run, or he'll come for you."),
            say('Sheriff Brandt', 'Thorne Ranch is east, over the Sorrel bridge. If you ride out there, I never said this: bring him back breathing and he hangs legal.')]);
          addItem('ledger', -1); addMoney(50); addHonor(20); sfx.coin();
        }
      },
    }],
  },
  {
    title: 'Reckoning at Thorne Ranch', recap: 'You faced Silas Thorne.',
    steps: [{
      obj: 'Ride east across the Sorrel bridge to Thorne Ranch.', marker: () => SITES.thorne, goto: { x: SITES.thorne.x, z: SITES.thorne.z, r: 120 },
      enter: spawnThorneGuards,
      done: () => { G.ui.toast("Thorne's hired guns hold the yard. There is no quiet way in.", 'bad'); },
    }, {
      obj: "Fight through Thorne's hired guns.", marker: () => SITES.thorne, enter: spawnThorneGuards,
      check: () => !aliveTagged('thorneGuard').length,
      done: () => { G.ui.toast('The yard falls silent. A man in a white coat steps out onto the porch.', 'good'); },
    }, {
      obj: 'Face Silas Thorne in front of the house.', marker: at('thorne'), talk: 'thorne',
      enter: () => {
        if (actor('thorne')) return;
        const c = SITES.thorne;
        spawnHuman({ id: 'thorne', name: 'Silas Thorne', faction: 'vendor', essential: true, x: c.x + 5, z: c.z - 3.5, heading: 0, look: { shirt: 0xe9e4d6, vest: 0x7a2318, coat: 0xe9e4d6, hat: 0xe9e4d6, pants: 0xd9d2bd, beard: true, hair: 0x8a8a84, skin: 0xffdbac } });
      },
      done: async (th) => {
        await D([say('Silas Thorne', "Calloway's child. You have your father's talent for standing where you are not wanted."),
          say('Silas Thorne', 'I built this basin. Rail, water, beef. One stubborn dirt farmer was not going to stand in front of that.'),
          say(WREN, 'You burned him out for a creek.'),
          say('Silas Thorne', 'I offered him a fair price. He chose the fire. Now. I was a fair shot before I was a rich man. Let us finish it the old way.')]);
        await runDuel(th);
        th.state = 'cower'; th.t = 9999;
        const c = await D([N('Thorne is down on one knee, his pistol in the dust, a hand pressed to his shoulder.'), say('Silas Thorne', "Well? Your father wouldn't have.")], ['Lower the gun. He hangs legal.', 'Finish it.']);
        const good = c === 0;
        if (good) addHonor(30);
        else { addHonor(-20); th.essential = false; damageActor(th, 999, { byPlayer: false }); sfx.shot(1); addMoney(200); }
        S.flags.spared = good ? 1 : 0;
        const lines = [];
        if (good) lines.push(N('You holster the revolver. By noon Sheriff Brandt has him in irons, and the whole of Marrow Creek comes out to watch him ride past.'));
        else lines.push(N('One shot rolls across the yard and is gone. You take two hundred dollars from his coat. It weighs more than it should.'));
        if (S.flags.sold) lines.push(N('The ledger is in Carrow City now, in a stranger\'s safe. The truth of Sorrel Flats will stay a rumour. But you know.'));
        else lines.push(N('The marshal reads the ledger aloud in open court. Three judges resign. The rail company sells the Flats back for a dollar.'));
        lines.push(N(G.honor >= 20 ? 'They will say a Calloway kept the basin honest. Tobias sets a second chair on the store porch and never says who it is for.' : 'They will say a Calloway settled the basin with a gun. Folk tip their hats, and step off the boardwalk when you pass.'));
        lines.push(N('The story is told. The basin is still yours to ride: take bounties, hunt, fish, and play cards at the Gilded Mule.'));
        await D(lines);
        G.ui.banner('The End', 'Dustfall');
      },
    }],
  },
];
function spawnThorneGuards() {
  if (S.flags.yardCleared || aliveTagged('thorneGuard').length) return;
  spawnGang('thorneGuard', SITES.thorne.x, SITES.thorne.z + 10, 7, 'thorne', { spread: 24, hp: 100, acc: 1, detect: 55 });
}

let autoT = 120;
const S = {
  m: 0, s: 0, flags: {}, busy: false, missions: MISSIONS,
  is(m, s) { return this.m === m && this.s === s && !this.busy; },
  cur() { const M = MISSIONS[this.m]; return M ? M.steps[this.s] : null; },
  marker() {
    const st = this.cur();
    let mk = st && st.marker ? st.marker() : null;
    if (!mk && G.bounty) mk = G.bounty.state === 'done' ? at('sheriff')() : G.bounty;
    return mk ? { x: mk.x, z: mk.z } : null;
  },
  canCalm() { return this.is(1, 1); },
  onCalmed() { this.complete(); },
  onKill(a) {
    if (a.tags.includes('bountyTarget') && G.bounty) { G.bounty.state = 'done'; G.ui.toast(`${G.bounty.name} is finished. Collect ${fmt(G.bounty.reward)} from Sheriff Brandt.`, 'good'); }
    if (a.tags.includes('thorneGuard') && !aliveTagged('thorneGuard').length) this.flags.yardCleared = 1;
  },
  async complete(arg) {
    if (this.busy) return;
    const st = this.cur(); if (!st) return;
    this.busy = true;
    let r;
    try { r = st.done ? await st.done(arg) : true; } catch (e) { console.error(e); }
    if (r === false) { this.busy = false; return; }
    const M = MISSIONS[this.m];
    this.s++;
    if (this.s >= M.steps.length) { this.m++; this.s = 0; if (this.m < MISSIONS.length || M !== MISSIONS[MISSIONS.length - 1]) G.ui.banner('Chapter Complete', M.title); addHonor(2); }
    this.busy = false;
    this.enter(); G.save();
  },
  enter() {
    const st = this.cur();
    if (st) { if (st.enter) st.enter(); G.ui.setObjective(`${this.m + 1} · ${tx(MISSIONS[this.m].title)}`, st.obj); }
    else G.ui.setObjective('Free Roam', G.bounty ? (G.bounty.state === 'done' ? 'Collect your bounty reward from Sheriff Brandt.' : `Bring in ${G.bounty.name}, last seen near ${G.bounty.place}.`) : 'Take a warrant from the bounty board, hunt, fish, or try the tables.');
  },
  update(dt) {
    const st = this.cur(), p = G.player;
    if (st && !this.busy && p.alive) {
      if (st.goto) { if (dist2(p.pos.x, p.pos.z, st.goto.x, st.goto.z) < st.goto.r) this.complete(); }
      else if (st.check && st.check()) this.complete();
    }
    autoT -= dt;
    if (autoT <= 0) { autoT = 120; if (G.combatT > 20 && !G.law.wanted && p.alive) G.save(); }
  },
  updateDuel,
  async talkTo(a) {
    if (this.busy) return;
    const st = this.cur();
    if (st && st.talk && [].concat(st.talk).includes(a.id)) return this.complete(a);
    if (a.id === 'sheriff') {
      if (G.law.bounty > 0) return D([say(a.name, "There's a price on your head, Calloway. Settle it with Pruitt at the telegraph office before I have to notice.")]);
      if (G.bounty && G.bounty.state === 'done') {
        await D([say(a.name, `${G.bounty.name}. The basin sleeps easier. Here is your ${fmt(G.bounty.reward)}, and my thanks.`)]);
        addMoney(G.bounty.reward); addHonor(6); sfx.coin(); G.bounty = null; this.enter(); G.save(); return;
      }
      return D([say(a.name, pick(['Keep your nose clean, Calloway. The board has paper on it if you want honest work.', "Thorne's shadow is long. Mind where you stand.", 'If you shoot in my town, you had better have a reason I like.']))]);
    }
    if (a.id === 'clerk') {
      if (G.law.bounty > 0) {
        const b = G.law.bounty;
        const c = await D([say(a.name, `Ah. I have a wire here with your description on it. ${fmt(b)} would make it disappear, all quite legal.`)], [`Pay ${fmt(b)}`, 'Not today']);
        if (c === 0) { if (G.money >= b) { addMoney(-b); G.law.bounty = 0; G.law.wanted = false; sfx.coin(); G.ui.toast('Your bounty is paid. You are a free citizen again.', 'good'); } else G.ui.toast("You can't afford it.", 'bad'); }
        return;
      }
      return D([say(a.name, pick(['No telegrams for you today. Should there be?', 'Everything that happens in this basin passes over my wire sooner or later.', 'Bounties are settled here. Discreetly.']))]);
    }
    if (a.id === 'june') return D([say(a.name, G.horse.owned ? `How is ${G.horse.name} treating you? Feed her oats and she'll run till sundown.` : 'The mare is in the corral. Slow and gentle.')]);
    if (a.id === 'thorne') return D([say(a.name, this.flags.spared ? 'Enjoy it, Calloway. Men like me are never gone for long.' : '…')]);
    if (a.talkFn) return a.talkFn(a);
    if (a.shop) return G.ui.openShop(SHOPS[a.shop]);
    if (a.faction === 'law') return G.ui.toast(`"${G.law.bounty > 0 ? 'I know that face from somewhere…' : 'Move along, citizen.'}"`);
    if (G.honor < -40) return G.ui.toast(`${a.name} looks away and says nothing.`);
    if (a.greeted !== G.day) { a.greeted = G.day; addHonor(0.5); }
    G.ui.toast(`${a.name}: "${pick(GREETS)}"`);
  },
};

// ---------- save / load ----------
const KEY = 'dustfall-save-v1';
G.hasSave = () => { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } };
G.save = () => {
  const p = G.player, h = G.horse;
  if (!p || !p.alive || G.mode === 'title') return;
  const d = {
    v: 1, time: G.time, day: G.day, weather: G.weather.type, money: G.money, honor: G.honor, inv: G.inv, weapons: G.weaponsOwned, stats: G.stats, settings: G.settings,
    lawBounty: G.law.bounty, job: G.bounty, story: { m: S.m, s: S.s, flags: S.flags },
    p: { x: p.pos.x, z: p.pos.z, yaw: p.yaw, hp: p.hp, stamina: p.stamina, focus: p.focus, hunger: p.hunger, clip: p.clip },
    h: { x: h.pos.x, z: h.pos.z, heading: h.heading, owned: h.owned, bond: h.bond, name: h.name, saddle: h.saddle },
  };
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage unavailable */ }
};
function load() {
  let d; try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { return false; }
  if (!d || d.v !== 1) return false;
  const p = G.player, h = G.horse;
  G.time = d.time; G.day = d.day; G.weather.type = d.weather || 'clear'; G.money = d.money; G.honor = d.honor; G.inv = d.inv || {}; G.weaponsOwned = d.weapons || { revolver: true };
  Object.assign(G.stats, d.stats); Object.assign(G.settings, d.settings); G.law.bounty = d.lawBounty || 0; G.bounty = d.job || null;
  S.m = d.story.m; S.s = d.story.s; S.flags = d.story.flags || {};
  p.pos.set(d.p.x, groundHeight(d.p.x, d.p.z), d.p.z); p.yaw = d.p.yaw; p.heading = d.p.yaw; p.hp = Math.max(20, d.p.hp); p.stamina = d.p.stamina; p.focus = d.p.focus; p.hunger = d.p.hunger; Object.assign(p.clip, d.p.clip);
  h.pos.set(d.h.x, groundHeight(d.h.x, d.h.z), d.h.z); h.heading = d.h.heading; h.owned = d.h.owned; h.bond = d.h.bond; h.name = d.h.name; h.saddle = d.h.saddle || 0;
  return true;
}

export function initStory() {
  G.story = S;
  populate();
  G.onNewDay = reviveTown;
  G.startGame = async (cont) => {
    if (G.mode !== 'title') return;
    const loaded = cont && load();
    G.ui.hideTitle(); G.ui.showHud(true);
    if (!loaded) { G.time = 7.5; G.day = 1; addItem('revolverAmmo', 18); addItem('bread', 1); }
    // standing guards for places the story has not reached yet
    if (S.m < 4) spawnGang('depot', SITES.depot.x, SITES.depot.z + 12, 5, 'thorne', { spread: 20, detect: 34, hp: 100 });
    if (S.m < 5) spawnThorneGuards();
    if (G.bounty) spawnBounty();
    G.mode = 'play'; S.enter(); requestLock();
    if (!loaded) {
      await D([N('Sorrel Basin, 1887.'),
        N('Three weeks ago the Calloway homestead burned. The papers called it a lamp fire. You were two hundred miles away, riding courier for the same rail company that wanted your father\'s water.'),
        N('You came home to ash, one grave, and a name folk only say quietly: Silas Thorne.'),
        N("Your father's oldest friend keeps the general store in Marrow Creek, just up the road. Start there.")]);
      G.ui.toast('W A S D to walk, Shift to run, mouse to look. Follow the gold star on your map.');
    } else G.ui.toast('Welcome back to the basin.', 'good');
  };
}
