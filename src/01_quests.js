// ---------- hideout NPCs & quest chains ----------
// Each NPC has an ordered chain. The first unfinished quest is always the active one.
// type: kill | search | extract | bring | loot | closecall | earn
const NPCS = {
  mallard: { name: 'Old Mallard', role: 'Trader', col: '#d9a520', greet: 'Everything has a price, kid. Even you.' },
  teal:    { name: 'Doc Teal',    role: 'Medic',  col: '#e8e8e8', greet: 'Bring me supplies and I will keep you breathing.' },
  gander:  { name: 'Gus Gander',  role: 'Gunsmith', col: '#6f7c8a', greet: 'Guns do not kill scavs. Ducks with guns do.' },
  hermit:  { name: 'The Hermit',  role: 'Guide', col: '#5a7a5a', greet: 'The marsh remembers every footstep.' },
};
const QUESTS = [
  // --- Old Mallard: loot & economy ---
  { id: 'm1', npc: 'mallard', title: 'First Pickings', desc: 'Search 5 containers in any raid.', type: 'search', count: 5, reward: { money: 300, xp: 80, items: [['bandage', 2]] } },
  { id: 'm2', npc: 'mallard', title: 'Scrap Run', desc: 'Bring me 3 Copper Wire and 3 Bolts.', type: 'bring', items: [['wires', 3], ['bolts', 3]], reward: { money: 600, xp: 150, items: [['bag_small', 1]] } },
  { id: 'm3', npc: 'mallard', title: 'Big Haul', desc: 'Extract from a raid carrying loot worth at least ₵2,500.', type: 'loot', count: 2500, reward: { money: 900, xp: 250, unlock: 'bag_big' } },
  { id: 'm4', npc: 'mallard', title: 'Shiny Things', desc: 'Bring me a Gold Watch and a Signet Ring.', type: 'bring', items: [['watch', 1], ['ring', 1]], reward: { money: 2500, xp: 400, items: [['vest_light', 1]] } },
  { id: 'm5', npc: 'mallard', title: 'The Ledger', desc: 'The Drake keeps a smuggler ledger at the Depot. Bring it to me.', type: 'bring', items: [['ledger', 1]], reward: { money: 8000, xp: 1200, items: [['goldbar', 1]] } },
  // --- Doc Teal: meds & survival ---
  { id: 't1', npc: 'teal', title: 'Supply Line', desc: 'Bring me 3 Bandages.', type: 'bring', items: [['bandage', 3]], reward: { money: 250, xp: 80, items: [['medkit', 1]], unlock: 'medkit' } },
  { id: 't2', npc: 'teal', title: 'Close Call', desc: 'Extract from a raid with less than 30 HP.', type: 'closecall', count: 1, reward: { money: 500, xp: 200, items: [['painkiller', 3]] } },
  { id: 't3', npc: 'teal', title: 'Field Research', desc: 'Bring me 2 Field Medkits and 2 Painkillers.', type: 'bring', items: [['medkit', 2], ['painkiller', 2]], reward: { money: 1200, xp: 300, items: [['vest_heavy', 1]], unlock: 'vest_heavy' } },
  { id: 't4', npc: 'teal', title: 'Iron Lungs', desc: 'Extract 5 times in total.', type: 'extract', count: 5, reward: { money: 2000, xp: 500, items: [['medkit', 3]] } },
  // --- Gus Gander: combat ---
  { id: 'g1', npc: 'gander', title: 'Pest Control', desc: 'Kill 5 scavs.', type: 'kill', who: 'scav', count: 5, reward: { money: 400, xp: 120, items: [['ammo_9', 60]], unlock: 'smg' } },
  { id: 'g2', npc: 'gander', title: 'Shotgun Wedding', desc: 'Kill 8 enemies with the Marsh 12 shotgun.', type: 'kill', weapon: 'shotgun', count: 8, reward: { money: 800, xp: 250, items: [['ammo_12', 30]] } },
  { id: 'g3', npc: 'gander', title: 'Guard Duty', desc: 'Kill 6 Guards at Old Mill or the Depot.', type: 'kill', who: 'guard', count: 6, reward: { money: 1500, xp: 400, items: [['rifle', 1], ['ammo_556', 60]], unlock: 'rifle' } },
  { id: 'g4', npc: 'gander', title: 'Long Shot', desc: 'Kill 10 enemies with the Heron DMR.', type: 'kill', weapon: 'dmr', count: 10, reward: { money: 3000, xp: 700, unlock: 'dmr' } },
  { id: 'g5', npc: 'gander', title: 'Duck Hunt', desc: 'Kill The Drake at the Depot.', type: 'kill', who: 'boss', count: 1, reward: { money: 6000, xp: 1500, items: [['dmr', 1], ['ammo_762', 40]] } },
  // --- The Hermit: exploration ---
  { id: 'h1', npc: 'hermit', title: 'Get Your Feet Wet', desc: 'Extract from Reedbanks.', type: 'extract', map: 'reedbanks', count: 1, reward: { money: 300, xp: 100 } },
  { id: 'h2', npc: 'hermit', title: 'Timing Is Everything', desc: 'Extract through a timed extract (North Fence, East Road or South Culvert).', type: 'extract', timed: true, count: 1, reward: { money: 700, xp: 250, items: [['painkiller', 2]] } },
  { id: 'h3', npc: 'hermit', title: 'The Mill', desc: 'Extract from Old Mill twice.', type: 'extract', map: 'oldmill', count: 2, reward: { money: 1200, xp: 400, items: [['bag_big', 1]] } },
  { id: 'h4', npc: 'hermit', title: 'Night Shift', desc: 'Search 40 containers in total.', type: 'search', count: 40, reward: { money: 1500, xp: 500, items: [['drive', 1]] } },
  { id: 'h5', npc: 'hermit', title: 'Into the Depot', desc: 'Extract from The Depot.', type: 'extract', map: 'depot', count: 1, reward: { money: 4000, xp: 1000, items: [['gpu', 1]] } },
];
const QUEST_BY_ID = Object.fromEntries(QUESTS.map(q => [q.id, q]));
function activeQuestFor(npc) { const s = G.save; return QUESTS.find(q => q.npc === npc && !s.quests.done.includes(q.id)); }
function questProgress(q) { const s = G.save; return s.quests.progress[q.id] || 0; }
function questReady(q) {
  const s = G.save;
  if (q.type === 'bring') return q.items.every(([id, n]) => stashCount(id) >= n);
  return questProgress(q) >= q.count;
}
// called from gameplay: type + details
function questEvent(type, d) {
  const s = G.save; let changed = false;
  for (const npc of Object.keys(NPCS)) {
    const q = activeQuestFor(npc); if (!q || q.type !== type) continue;
    if (q.type === 'kill' && ((q.who && d.who !== q.who) || (q.weapon && d.weapon !== q.weapon))) continue;
    if (q.type === 'extract' && ((q.map && d.map !== q.map) || (q.timed && !d.timed))) continue;
    if (q.type === 'loot' && d.value < q.count) continue;
    if (q.type === 'closecall' && d.hp >= 30) continue;
    const before = questProgress(q); const inc = (q.type === 'loot' || q.type === 'closecall') ? q.count : 1;
    s.quests.progress[q.id] = Math.min(q.count, before + inc); changed = true;
    if (before < q.count && s.quests.progress[q.id] >= q.count) G.toast(`✔ ${q.title} — turn in at ${NPCS[npc].name}`);
  }
  if (changed) G.persist();
}
function turnInQuest(q) {
  const s = G.save; if (!questReady(q) || s.quests.done.includes(q.id)) return false;
  if (q.type === 'bring') for (const [id, n] of q.items) stashTake(id, n);
  s.quests.done.push(q.id); const r = q.reward; s.money += r.money || 0; s.xp += r.xp || 0;
  for (const [id, n] of (r.items || [])) G.stashAdd(mk(id, n));
  if (r.unlock) { if (!s.unlocks.includes(r.unlock)) s.unlocks.push(r.unlock); }
  G.persist(); return true;
}
