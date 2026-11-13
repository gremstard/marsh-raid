// ---------- item & weapon definitions ----------
// value = sell price at the trader; buy price = value * TRADER_MARKUP
const TRADER_MARKUP = 1.7;
const ITEMS = {
  // weapons
  pistol:  { name: 'P9 Pistol',    type: 'weapon', ammo: 'ammo_9',   dmg: 18, mag: 12, rof: 0.20, spread: 4,  speed: 980,  range: 520, reload: 1.2, auto: false, noise: 420, pellets: 1, value: 260,  col: '#9aa3ad', desc: 'Reliable sidearm. Quiet-ish.' },
  smg:     { name: 'Reed SMG',     type: 'weapon', ammo: 'ammo_9',   dmg: 14, mag: 30, rof: 0.085, spread: 7, speed: 980,  range: 480, reload: 1.8, auto: true,  noise: 480, pellets: 1, value: 800,  col: '#6f7c8a', desc: 'Sprays 9mm. Great up close.' },
  shotgun: { name: 'Marsh 12',     type: 'weapon', ammo: 'ammo_12',  dmg: 9,  mag: 6,  rof: 0.85, spread: 11, speed: 900,  range: 330, reload: 2.4, auto: false, noise: 700, pellets: 7, value: 700,  col: '#8a6a4a', desc: 'Seven pellets of bad news.' },
  rifle:   { name: 'AK-Duck',      type: 'weapon', ammo: 'ammo_556', dmg: 27, mag: 30, rof: 0.11, spread: 3.5, speed: 1200, range: 700, reload: 2.2, auto: true,  noise: 620, pellets: 1, value: 1600, col: '#5c4a3a', desc: 'Full auto. Loud.' },
  dmr:     { name: 'Heron DMR',    type: 'weapon', ammo: 'ammo_762', dmg: 58, mag: 10, rof: 0.55, spread: 1.2, speed: 1500, range: 1000, reload: 2.6, auto: false, noise: 820, pellets: 1, value: 2300, col: '#3f4a3a', desc: 'One shot, one duck. Very loud.' },
  // ammo
  ammo_9:   { name: '9mm Rounds',   type: 'ammo', stack: 60, value: 1.2, col: '#d9b84a' },
  ammo_12:  { name: '12g Shells',   type: 'ammo', stack: 30, value: 3.0, col: '#c8503a' },
  ammo_556: { name: '5.56 Rounds',  type: 'ammo', stack: 60, value: 2.2, col: '#c9c05a' },
  ammo_762: { name: '7.62 Rounds',  type: 'ammo', stack: 40, value: 4.0, col: '#b48a3a' },
  // meds
  bandage:    { name: 'Bandage',    type: 'med', heal: 15, time: 1.5, stopBleed: true,  stack: 5, value: 45,  col: '#f0e6d8', desc: 'Stops bleeding. +15 HP.' },
  medkit:     { name: 'Field Medkit', type: 'med', heal: 65, time: 3.0, stopBleed: true, stack: 1, value: 220, col: '#e8e8e8', desc: 'Stops bleeding. +65 HP.' },
  painkiller: { name: 'Painkillers', type: 'med', heal: 30, time: 1.0, stopBleed: false, stack: 3, value: 90, col: '#f0a040', desc: 'Quick +30 HP. Does not stop bleeding.' },
  // armor
  vest_light: { name: 'Light Vest',  type: 'armor', dur: 40, reduce: 0.35, slow: 0.0,  value: 420,  col: '#5a7a5a', desc: 'Absorbs 35% of damage until worn out.' },
  vest_heavy: { name: 'Heavy Plate', type: 'armor', dur: 80, reduce: 0.55, slow: 0.10, value: 1100, col: '#3a4a5a', desc: 'Absorbs 55%. 10% slower.' },
  // backpacks
  bag_small: { name: 'Scout Pack', type: 'backpack', slots: 6,  value: 300, col: '#7a6a4a', desc: '+6 slots.' },
  bag_big:   { name: 'Raider Pack', type: 'backpack', slots: 12, value: 850, col: '#4a5a3a', desc: '+12 slots.' },
  // valuables & junk
  watch:    { name: 'Gold Watch',   type: 'loot', value: 650,  col: '#e8c04a' },
  ring:     { name: 'Signet Ring',  type: 'loot', value: 900,  col: '#f0d060' },
  gpu:      { name: 'Graphics Card', type: 'loot', value: 2400, col: '#4a9a6a' },
  drive:    { name: 'Flash Drive',  type: 'loot', value: 1500, col: '#4a6ae0' },
  goldbar:  { name: 'Gold Bar',     type: 'loot', value: 4200, col: '#ffcc33' },
  ledger:   { name: 'Smuggler Ledger', type: 'loot', value: 3000, col: '#8a4a3a' },
  canfood:  { name: 'Canned Beans', type: 'loot', value: 55,   col: '#7a9a5a', stack: 4 },
  wires:    { name: 'Copper Wire',  type: 'loot', value: 110,  col: '#c8783a', stack: 4 },
  bolts:    { name: 'Bolts',        type: 'loot', value: 70,   col: '#8a8a8a', stack: 6 },
  battery:  { name: 'Car Battery',  type: 'loot', value: 260,  col: '#2a2a2a' },
  lighter:  { name: 'Zippo',        type: 'loot', value: 95,   col: '#c0c0c0' },
  tape:     { name: 'Duct Tape',    type: 'loot', value: 60,   col: '#6a6a7a', stack: 3 },
  bread:    { name: 'Stale Bread',  type: 'loot', value: 20,   col: '#c8a060', stack: 3 },
};
for (const k in ITEMS) ITEMS[k].id = k;
const WEAPON_IDS = ['pistol', 'smg', 'shotgun', 'rifle', 'dmr'];
function itemDef(it) { return ITEMS[it.id]; }
function mk(id, n) { const d = ITEMS[id]; const it = { id, uid: Math.floor(Math.random() * 1e9) }; if (d.type === 'weapon') it.ammo = d.mag; else if (d.type === 'armor') it.dur = d.dur; else if (d.stack) it.n = n || 1; return it; }
function itemLabel(it) { const d = ITEMS[it.id]; let s = d.name; if (it.n > 1) s += ' ×' + it.n; if (d.type === 'weapon') s += ` [${it.ammo}/${d.mag}]`; if (d.type === 'armor') s += ` (${Math.ceil(it.dur)}/${d.dur})`; return s; }
function itemValue(it) { const d = ITEMS[it.id]; let v = d.value * (it.n || 1); if (d.type === 'armor') v *= 0.3 + 0.7 * (it.dur / d.dur); return Math.round(v); }
function buyPrice(id) { const d = ITEMS[id]; return Math.round(d.value * TRADER_MARKUP * (d.type === 'ammo' ? d.stack : 1)); }

// Trader stock: [id, count for stackables]
const TRADER_STOCK = ['pistol', 'smg', 'shotgun', 'rifle', 'dmr', 'ammo_9', 'ammo_12', 'ammo_556', 'ammo_762', 'bandage', 'medkit', 'painkiller', 'vest_light', 'vest_heavy', 'bag_small', 'bag_big'];
const TRADER_REQ = { rifle: 4, dmr: 7, vest_heavy: 5, bag_big: 3, smg: 2, medkit: 2 };
function traderUnlocked(id, level) { return (TRADER_REQ[id] || 0) <= level || (G.save && G.save.unlocks.includes(id)); }

// Loot tables: [id, weight]
const LOOT = {
  crate:   [['canfood', 8], ['bolts', 8], ['wires', 5], ['tape', 6], ['bread', 6], ['bandage', 5], ['ammo_9', 6], ['ammo_12', 3], ['ammo_556', 2], ['lighter', 3], ['painkiller', 2], ['watch', 1]],
  locker:  [['bandage', 5], ['ammo_9', 5], ['ammo_556', 3], ['ammo_762', 2], ['pistol', 3], ['vest_light', 2], ['tape', 3], ['lighter', 3], ['watch', 2], ['canfood', 3], ['bag_small', 1]],
  medbox:  [['bandage', 8], ['painkiller', 5], ['medkit', 3]],
  weaponbox: [['pistol', 5], ['shotgun', 4], ['smg', 3], ['rifle', 2], ['dmr', 1], ['ammo_9', 5], ['ammo_12', 4], ['ammo_556', 4], ['ammo_762', 2], ['vest_light', 2], ['vest_heavy', 1]],
  safe:    [['watch', 5], ['ring', 5], ['drive', 4], ['gpu', 2], ['goldbar', 1], ['ledger', 1]],
  scrap:   [['bolts', 6], ['wires', 6], ['battery', 3], ['tape', 4], ['lighter', 2], ['gpu', 1]],
};
const CONTAINER_DEF = {
  crate:     { name: 'Supply Crate', time: 1.4, rolls: [1, 3], w: 36, h: 30, col: '#8a6a3a' },
  locker:    { name: 'Locker',       time: 1.8, rolls: [1, 3], w: 26, h: 40, col: '#5a6a7a' },
  medbox:    { name: 'Med Box',      time: 1.2, rolls: [1, 2], w: 30, h: 24, col: '#e8e8e8' },
  weaponbox: { name: 'Weapon Case',  time: 2.4, rolls: [1, 2], w: 44, h: 24, col: '#2a3a2a' },
  safe:      { name: 'Safe',         time: 3.5, rolls: [1, 2], w: 32, h: 32, col: '#3a3a44' },
  scrap:     { name: 'Scrap Pile',   time: 1.2, rolls: [1, 2], w: 40, h: 34, col: '#6a6a5a' },
  body:      { name: 'Body',         time: 1.0, rolls: [0, 0], w: 40, h: 40, col: '#777' },
};
function rollLoot(type) {
  const def = CONTAINER_DEF[type]; const out = [];
  const n = randi(def.rolls[0], def.rolls[1]);
  for (let i = 0; i < n; i++) {
    const id = weightedPick(LOOT[type]); const d = ITEMS[id];
    let cnt = 1; if (d.type === 'ammo') cnt = randi(Math.floor(d.stack * 0.25), Math.floor(d.stack * 0.7)); else if (d.stack) cnt = randi(1, Math.min(d.stack, 3));
    const existing = out.find(o => o.id === id && d.stack); if (existing) existing.n = Math.min(d.stack, existing.n + cnt); else out.push(mk(id, cnt));
  }
  return out;
}

// ---------- maps ----------
const MAPS = {
  reedbanks: { name: 'Reedbanks', sub: 'Marshland · Easy', w: 46, h: 46, time: 10 * 60, buildings: 7, scavs: 9, guards: 0, boss: 0, trees: 0.07, water: 0.5, lootMul: 1.0, desc: 'Flat wetlands with scattered sheds. Scavs patrol in small groups.', color: '#4a7a3a' },
  oldmill:   { name: 'Old Mill',  sub: 'Village · Medium', w: 56, h: 56, time: 12 * 60, buildings: 12, scavs: 14, guards: 4, boss: 0, trees: 0.05, water: 0.35, lootMul: 1.3, desc: 'A ruined village around a mill. Armed guards hold the center.', color: '#7a6a3a' },
  depot:     { name: 'The Depot', sub: 'Industrial · Hard', w: 64, h: 64, time: 15 * 60, buildings: 16, scavs: 18, guards: 7, boss: 1, trees: 0.03, water: 0.25, lootMul: 1.7, desc: 'Warehouses full of loot. The Drake and his crew run the place.', color: '#5a4a5a' },
};
