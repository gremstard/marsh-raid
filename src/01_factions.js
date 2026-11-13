// ---------- factions, hideout upgrades, crafting, weather ----------
const FACTIONS = {
  scavs: { name: 'Marsh Scavs', short: 'Scavs', col: '#8a8a7a', types: ['scav'], startRep: 0,
    desc: 'Loose gangs of looters. Cheap to befriend, quick to forget.', merchant: 'Rook', greet: 'Got anything shiny? No? Then why are we talking.',
    stock: [['ammo_9', 0], ['bandage', 0], ['shotgun', 10], ['painkiller', 10], ['bag_small', 20], ['key_reedbanks', 30]] },
  flock: { name: 'The Flock', short: 'Flock', col: '#5a7a5a', types: ['guard'], startRep: -5,
    desc: 'Disciplined militia. They hold the villages and shoot looters on sight.', merchant: 'Sergeant Pintail', greet: 'Prove you are not a scav and we might talk.',
    stock: [['ammo_556', 0], ['vest_light', 10], ['medkit', 15], ['rifle', 25], ['key_oldmill', 35]] },
  crew: { name: "Drake's Crew", short: 'Crew', col: '#8a3a3a', types: ['crew', 'boss'], startRep: -20,
    desc: 'The Drake’s smugglers. They run the Depot and everything that passes through it.', merchant: 'Mallory', greet: 'The Drake does not forgive. He does, however, sell.',
    stock: [['ammo_762', 0], ['smg', 10], ['ammo_12', 10], ['vest_heavy', 25], ['dmr', 40], ['key_depot', 45]] },
};
const FACTION_IDS = Object.keys(FACTIONS);
function repLabel(r) { return r >= 40 ? 'Trusted' : r >= 15 ? 'Friendly' : r >= 0 ? 'Neutral' : r >= -20 ? 'Disliked' : 'Hunted'; }
function factionOf(type) { for (const f of FACTION_IDS) if (FACTIONS[f].types.includes(type)) return f; return 'scavs'; }
// per-map roster: how many of each faction spawn
const ROSTER = {
  reedbanks: { scavs: 9, flock: 2, crew: 2 },
  oldmill:   { scavs: 7, flock: 8, crew: 4 },
  depot:     { scavs: 6, flock: 6, crew: 10 },
};
function makeContract(f, mapId) {
  const others = FACTION_IDS.filter(x => x !== f); const target = others[Math.floor(hash2(Math.floor(Date.now() / 600000), f.length) * others.length)];
  const base = { reedbanks: 3, oldmill: 4, depot: 5 }[mapId]; return { faction: f, target, count: base, pay: base * 350 + 200, rep: 12 };
}

// ---------- hideout ----------
const HIDEOUT = {
  stash:      { name: 'Stash', icon: '▦', desc: 'Shelving for your loot. Bigger stash, more hoarding.', levels: [{ rows: 6 }, { rows: 10, cost: 1500, items: [['bolts', 4], ['tape', 2]] }, { rows: 16, cost: 4000, items: [['wires', 6], ['tape', 3], ['battery', 1]] }, { rows: 26, cost: 9000, items: [['battery', 2], ['gpu', 1]] }] },
  workbench:  { name: 'Workbench', icon: '🔧', desc: 'Craft ammo and gear from scrap. Level 2 repairs armor.', levels: [{}, { cost: 1200, items: [['bolts', 6], ['tape', 2]] }, { cost: 5000, items: [['battery', 1], ['wires', 8], ['lighter', 1]] }] },
  medstation: { name: 'Med Station', icon: '✚', desc: 'Turn scraps into meds. Level 2 makes field medkits.', levels: [{}, { cost: 1000, items: [['bandage', 3], ['canfood', 2]] }, { cost: 4500, items: [['medkit', 1], ['battery', 1]] }] },
};
function stashRows() { return HIDEOUT.stash.levels[G.save.hideout.stash].rows; }
const RECIPES = [
  { station: 'workbench', lvl: 1, in: [['bolts', 3], ['tape', 1]], out: ['ammo_9', 30] },
  { station: 'workbench', lvl: 1, in: [['bolts', 4], ['wires', 1]], out: ['ammo_12', 15] },
  { station: 'workbench', lvl: 2, in: [['bolts', 4], ['wires', 2]], out: ['ammo_556', 30] },
  { station: 'workbench', lvl: 2, in: [['wires', 3], ['battery', 1]], out: ['ammo_762', 20] },
  { station: 'workbench', lvl: 2, in: [['tape', 3], ['wires', 4], ['bolts', 6]], out: ['vest_light', 1] },
  { station: 'medstation', lvl: 1, in: [['tape', 1], ['canfood', 1]], out: ['bandage', 2] },
  { station: 'medstation', lvl: 1, in: [['bandage', 3], ['lighter', 1]], out: ['painkiller', 2] },
  { station: 'medstation', lvl: 2, in: [['bandage', 4], ['painkiller', 1], ['tape', 1]], out: ['medkit', 1] },
];
function stashCount(id) { return gridCount(G.save.stash, id); }
function stashTake(id, n) { const s = G.save.stash.items; let need = n; for (const it of s.slice()) { if (it.id !== id || need <= 0) continue; const take = Math.min(need, it.n || 1); need -= take; if (it.n) { it.n -= take; if (it.n <= 0) s.splice(s.indexOf(it), 1); } else s.splice(s.indexOf(it), 1); } return need <= 0; }
function canAfford(cost, items) { return G.save.money >= (cost || 0) && (items || []).every(([id, n]) => stashCount(id) >= n); }

// ---------- weather ----------
const WEATHER = {
  clear: { name: 'Clear', icon: '☾', view: 1.0, hear: 1.0, fog: 'rgba(4,6,14,0.93)', desc: 'Still night. You see far, and so do they.' },
  fog:   { name: 'Fog',   icon: '≋', view: 0.55, hear: 1.1, fog: 'rgba(70,80,90,0.94)', desc: 'Your flashlight dies in the mist. Sounds carry.' },
  rain:  { name: 'Rain',  icon: '☂', view: 0.85, hear: 0.6, fog: 'rgba(8,12,24,0.93)', rain: true, desc: 'Rain masks footsteps and gunfire. Good for sneaking. Bad for hearing.' },
  storm: { name: 'Storm', icon: '⚡', view: 0.7, hear: 0.5, fog: 'rgba(6,8,20,0.94)', rain: true, lightning: true, desc: 'Lightning lights up the whole marsh for a heartbeat. Everyone sees everyone.' },
};
function forecast(mapId) { // changes every 10 minutes of real time, per map
  const slot = Math.floor(Date.now() / 600000); const r = hash2(slot, mapId.length * 7 + 1);
  return r < 0.4 ? 'clear' : r < 0.6 ? 'fog' : r < 0.82 ? 'rain' : 'storm';
}
