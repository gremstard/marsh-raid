// ---------- DOM UI: lobby & areas, raid inventory/loot, results, pause, touch controls ----------
const UI = {
  el: null, lootOpen: false, invOpen: false, paused: false, mapOpen: false, menu: null, screen: 'lobby', touch: { move: null, aim: null, buttons: [] }, lootC: null, tab: {},
  init() {
    this.el = document.getElementById('ui');
    this.el.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; e.preventDefault(); SFX.init(); SFX.ui(); this.act(b.dataset.act, b.dataset); });
    this.el.addEventListener('touchstart', e => { e.stopPropagation(); }, { passive: true });
    this.el.addEventListener('mousedown', e => { e.stopPropagation(); });
    INV.bind(this.el); INV.onChange = () => this.sync(); INV.onMenu = (src, x, y) => this.itemMenu(src, x, y);
  },
  show(html, cls = '') { INV.closeMenu(); this.el.innerHTML = `<div class="screen ${cls}">${html}</div>`; this.el.style.pointerEvents = 'auto'; },
  hide() { INV.reset(); INV.closeMenu(); this.el.innerHTML = ''; this.el.style.pointerEvents = 'none'; this.lootOpen = this.invOpen = this.paused = false; this.menu = null; },
  toggleMap() { this.mapOpen = !this.mapOpen; SFX.ui(); },
  btn(act, label, extra = '', cls = '') { return `<button class="b ${cls}" data-act="${act}" ${extra}>${label}</button>`; },
  swatch(id) { return `<i class="sw" style="background:${ITEMS[id].col}"></i>`; },
  topbar(title, sub) { const s = G.save; return `<div class="top">${this.btn('lobby', '← Hideout')}<h1>${title}</h1><span class="dim">${sub || ''}</span><span class="sp"></span><span>Lv <b>${G.level()}</b></span><span class="money">${fmtMoney(s.money)}</span></div>`; },
  // ================= LOBBY =================
  lobby() {
    INV.reset(); this.screen = 'lobby'; G.state = 'hub'; const s = G.save, st = s.stats; const L = s.loadout; const ready = L.w1 || L.w2;
    const stance = s.stance === 'solo' ? 'Solo' : (s.stance.startsWith('ally:') ? 'Allied with ' : 'Hired by ') + FACTIONS[s.stance.slice(5)].name;
    const questsReady = QUESTS.filter(q => !s.quests.done.includes(q.id) && activeQuestFor(q.npc) === q && questReady(q)).length;
    this.show(`<div class="lobby">
      <header><div><h1>MARSH RAID</h1><div class="dim small">Hideout · Level ${G.level()} · ${s.xp}/${(G.level() + 1) ** 2 * 100} XP · Raids ${st.raids} · Extracted ${st.extracts} · KIA ${st.deaths}</div></div>
        <div style="display:flex;gap:10px;align-items:center"><span class="money">${fmtMoney(s.money)}</span>${this.btn('toggleSound', SFX.muted ? '🔇' : '🔊', '', 'icon')}${this.btn('help', '?', '', 'icon')}</div></header>
      <div class="areas">
        <div class="area" data-act="go" data-s="stash"><span class="ic">▦</span><b>STASH &amp; CRAFTING</b><small>${s.stash.items.length} items · ${fmtMoney(gridValue(s.stash))} · ${gridFree(s.stash)} cells free</small><small>Workbench L${s.hideout.workbench} · Med Station L${s.hideout.medstation}</small></div>
        <div class="area" data-act="go" data-s="merchants"><span class="ic">⚖</span><b>MERCHANTS</b><small>Old Mallard, Doc Teal, Gus Gander, The Hermit</small><small>${questsReady ? `<span class="warn">${questsReady} quest${questsReady > 1 ? 's' : ''} ready to turn in</span>` : 'Buy, sell, quests'}</small></div>
        <div class="area" data-act="go" data-s="factions"><span class="ic">⚑</span><b>FACTIONS</b><small>${FACTION_IDS.map(f => `${FACTIONS[f].short}: ${repLabel(s.rep[f])}`).join(' · ')}</small><small>Stance: ${stance}</small></div>
        <div class="area" data-act="go" data-s="hideout"><span class="ic">🏚</span><b>HIDEOUT UPGRADES</b><small>Stash L${s.hideout.stash} · Workbench L${s.hideout.workbench} · Med Station L${s.hideout.medstation}</small></div>
        <div class="area deploy" data-act="go" data-s="deploy"><span class="ic">➤</span><b>DEPLOY</b><small>${MAPS[s.map].name} · ${WEATHER[forecast(s.map)].icon} ${WEATHER[forecast(s.map)].name} · ${stance}</small><small>${ready ? 'Loadout: ' + [L.w1, L.w2].filter(Boolean).map(w => ITEMS[w.id].name).join(', ') : '<span class="warn">⚠ unarmed — set a loadout</span>'}</small></div>
      </div>
      <footer class="dim small">${IS_TOUCH ? 'Drag items between grids · tap an item for actions' : 'Drag items between grids · R rotates while dragging · click an item for actions'} · ${this.btn('reset', 'Reset progress', '', 'link')}</footer>
    </div>`, 'hubscreen');
  },
  // ================= STASH & CRAFTING =================
  stashScreen() {
    INV.reset(); this.screen = 'stash'; const s = G.save; const t = this.tab.stash || 'workbench'; const lvl = s.hideout[t];
    const recipes = RECIPES.filter(r => r.station === t).map(r => { const ok = r.lvl <= lvl; const can = ok && r.in.every(([id, n]) => stashCount(id) >= n); return `<div class="row ${ok ? '' : 'lock'}"><span class="nm">${this.swatch(r.out[0])}${esc(ITEMS[r.out[0]].name)}${r.out[1] > 1 ? ' ×' + r.out[1] : ''}<small>${r.in.map(([id, n]) => `${ITEMS[id].name} ${Math.min(n, stashCount(id))}/${n}`).join(' · ')}${ok ? '' : ' · needs level ' + r.lvl}</small></span><span class="acts">${ok ? this.btn('craft', 'Craft', `data-i="${RECIPES.indexOf(r)}"`, can ? '' : 'dis') : ''}</span></div>`; }).join('');
    this.show(`<div class="scr">${this.topbar('Stash & Crafting', `${gridFree(s.stash)} of ${s.stash.w * s.stash.h} cells free`)}
      <div class="body">
        <section class="grow"><h2>Stash <small>${fmtMoney(gridValue(s.stash))} · click an item to sell, repair or split</small></h2><div style="overflow:auto">${INV.grid('stash', s.stash)}</div></section>
        <section class="fit" style="width:420px;max-width:100%"><h2>Crafting</h2><nav class="tabs" style="display:flex">${['workbench', 'medstation'].map(k => `<button class="tab ${t === k ? 'on' : ''}" data-act="stab" data-t="${k}">${HIDEOUT[k].icon} ${HIDEOUT[k].name} L${s.hideout[k]}</button>`).join('')}</nav>
          ${lvl === 0 ? `<p class="dim">Not built yet. Upgrade it in <b>Hideout Upgrades</b>.</p>` : ''}<div class="list">${recipes}</div>
          ${t === 'workbench' && lvl >= 2 ? '<p class="dim small">Armor repair: click a vest in the stash.</p>' : ''}</section>
      </div></div>`, 'hubscreen');
  },
  // ================= MERCHANTS =================
  merchantsScreen() {
    INV.reset(); this.screen = 'merchants'; const s = G.save; const who = this.tab.merch || 'mallard'; const lvl = G.level();
    const people = [...Object.keys(NPCS).map(k => ({ k, name: NPCS[k].name, col: NPCS[k].col })), ...FACTION_IDS.map(f => ({ k: 'f:' + f, name: FACTIONS[f].merchant, col: FACTIONS[f].col }))];
    const tabs = people.map(p => `<button class="tab ${who === p.k ? 'on' : ''}" data-act="mtab" data-t="${p.k}" style="border-left:4px solid ${p.col}">${esc(p.name)}</button>`).join('');
    let body = '';
    const stockRow = (id, price, ok, why) => { const d = ITEMS[id]; return `<div class="row ${ok ? '' : 'lock'}"><span class="nm">${this.swatch(id)}${esc(d.name)}${d.type === 'ammo' ? ` ×${d.stack}` : ''}<small>${esc(d.desc || '')} · ${d.w}×${d.h}</small></span><span class="vl">${fmtMoney(price)}</span><span class="acts">${ok ? this.btn('buy', 'Buy', `data-id="${id}" data-price="${price}"`, s.money >= price ? '' : 'dis') : `<span class="dim">${why}</span>`}</span></div>`; };
    if (who.startsWith('f:')) {
      const f = who.slice(2), F = FACTIONS[f]; const rep = s.rep[f]; const disc = clamp(rep / 400, 0, 0.2);
      body = `<p class="dim">“${esc(F.greet)}”</p><p class="small">Standing: <b>${repLabel(rep)}</b> (${rep}) · discount ${Math.round(disc * 100)}%</p><div class="list">${F.stock.map(([id, req]) => stockRow(id, Math.round(buyPrice(id) * (1 - disc)), rep >= req, 'rep ' + req)).join('')}</div>`;
    } else {
      const n = NPCS[who]; const q = activeQuestFor(who); const doneN = QUESTS.filter(x => x.npc === who && s.quests.done.includes(x.id)).length, total = QUESTS.filter(x => x.npc === who).length;
      let qh; if (!q) qh = '<p class="dim">No more work for now.</p>'; else { const ready = questReady(q); const prog = q.type === 'bring' ? q.items.map(([iid, cnt]) => `${ITEMS[iid].name} ${Math.min(cnt, stashCount(iid))}/${cnt}`).join(', ') : `${questProgress(q)}/${q.count}`; const rw = [q.reward.money ? fmtMoney(q.reward.money) : '', q.reward.xp ? q.reward.xp + ' XP' : '', ...(q.reward.items || []).map(([iid, cnt]) => ITEMS[iid].name + (cnt > 1 ? ' ×' + cnt : '')), q.reward.unlock ? 'unlocks ' + ITEMS[q.reward.unlock].name : ''].filter(Boolean).join(' · '); qh = `<div class="npc" style="border-color:${n.col}"><b class="qt">${esc(q.title)}</b><p>${esc(q.desc)}</p><p class="dim small">Progress: ${esc(prog)}</p><p class="small">Reward: ${esc(rw)}</p>${ready ? this.btn('turnin', 'Turn in ✔', `data-q="${q.id}"`, 'go') : ''}</div>`; }
      body = `<p class="dim">“${esc(n.greet)}” <small>· ${n.role} · ${doneN}/${total} quests done</small></p>${qh}`;
      if (who === 'mallard') body += `<h3>Stock</h3><div class="list">${TRADER_STOCK.map(id => stockRow(id, buyPrice(id), traderUnlocked(id, lvl), 'Lv ' + TRADER_REQ[id] + ' or quest')).join('')}</div>`;
    }
    this.show(`<div class="scr">${this.topbar('Merchants', 'sell from the stash with a click')}
      <div class="body"><section class="fit" style="width:220px"><nav class="tabs" style="display:flex;flex-direction:column">${tabs}</nav></section>
      <section class="grow">${body}</section>
      <section class="grow"><h2>Stash <small>click an item → Sell</small></h2><div style="overflow:auto">${INV.grid('stash', s.stash)}</div></section></div></div>`, 'hubscreen');
  },
  // ================= FACTIONS =================
  factionsScreen() {
    INV.reset(); this.screen = 'factions'; const s = G.save;
    const cards = FACTION_IDS.map(f => { const F = FACTIONS[f]; const rep = s.rep[f]; const pct = (rep + 100) / 2; const ally = s.stance === 'ally:' + f, merc = s.stance === 'merc:' + f; const ct = makeContract(f, s.map);
      return `<div class="fcard" style="border-color:${F.col}"><h2>${esc(F.name)} <small>${F.types.map(t => ENEMY_TYPES[t].name).join(', ')} · merchant ${esc(F.merchant)}</small></h2><p class="small">${esc(F.desc)}</p>
        <div class="bar"><i style="width:${pct}%;background:${rep >= 0 ? '#6c6' : '#c66'}"></i></div><p class="small"><b>${repLabel(rep)}</b> (${rep}) · kill them −8, kill their enemies +3, extract as ally +3, contracts +12</p>
        <div class="stance">${this.btn('stance', 'Ally', `data-v="ally:${f}"`, (ally ? 'on ' : '') + (rep >= 0 ? '' : 'dis'))}${this.btn('stance', `Mercenary contract`, `data-v="merc:${f}"`, (merc ? 'on ' : '') + (rep >= 15 ? '' : 'dis'))}</div>
        <p class="dim small">${rep < 0 ? 'Need Neutral (0) to ally. ' : ''}${rep < 15 ? 'Need Friendly (15) for contracts. ' : ''}Contract on ${MAPS[s.map].name}: kill ${ct.count} ${FACTIONS[ct.target].short} for ${fmtMoney(ct.pay)} and +${ct.rep} rep.</p></div>`; }).join('');
    this.show(`<div class="scr">${this.topbar('Factions', 'three gangs, one marsh')}
      <div class="body"><section class="grow"><div class="fcard" style="border-color:#f2d84a"><h2>Going solo</h2><p class="small">Everyone is hostile and they will team up on you. In return nothing on the map is touched before you get there: every crate is yours.</p><div class="stance">${this.btn('stance', 'Solo', 'data-v="solo"', s.stance === 'solo' ? 'on' : '')}</div></div>
        <p class="dim small">Allied: two of their fighters escort you and the faction ignores you unless you shoot them. They search containers near them first, so you share the loot. Mercenary: same, plus a kill contract paid on extraction.</p></section>
        <section class="grow">${cards}</section></div></div>`, 'hubscreen');
  },
  // ================= HIDEOUT UPGRADES =================
  hideoutScreen() {
    INV.reset(); this.screen = 'hideout'; const s = G.save;
    const cards = Object.entries(HIDEOUT).map(([k, h]) => { const lvl = s.hideout[k]; const next = h.levels[lvl + 1]; const can = next && canAfford(next.cost, next.items);
      const cur = k === 'stash' ? `${h.levels[lvl].rows} rows (${10 * h.levels[lvl].rows} cells)` : lvl === 0 ? 'not built' : `level ${lvl}`;
      return `<div class="fcard" style="border-color:#3b5a44"><h2>${h.icon} ${h.name} <small>${cur}</small></h2><p class="small">${esc(h.desc)}</p>
        ${next ? `<p class="small">Next: ${fmtMoney(next.cost)} + ${next.items.map(([id, n]) => `${ITEMS[id].name} ${Math.min(n, stashCount(id))}/${n}`).join(', ')}${k === 'stash' ? ` → ${next.rows} rows` : ''}</p>${this.btn('upgrade', 'Upgrade', `data-k="${k}"`, can ? 'go' : 'dis')}` : '<p class="dim small">Maxed out.</p>'}</div>`; }).join('');
    this.show(`<div class="scr">${this.topbar('Hideout Upgrades', 'spend money and scrap to build')}<div class="body"><section class="grow">${cards}</section></div></div>`, 'hubscreen');
  },
  // ================= DEPLOY =================
  deployScreen() {
    INV.reset(); this.screen = 'deploy'; const s = G.save, L = s.loadout;
    const maps = Object.entries(MAPS).map(([id, m]) => { const wt = WEATHER[forecast(id)]; return `<div class="map ${s.map === id ? 'on' : ''}" style="border-color:${m.color};${s.map === id ? 'outline:2px solid #f2d84a' : ''}" data-act="pickmap" data-map="${id}"><b>${m.name}</b><small>${m.sub} · ${wt.icon} ${wt.name}</small><p>${m.desc}</p><p class="dim">${m.w}×${m.h} · ${fmtTime(m.time)} · ${Object.values(ROSTER[id]).reduce((a, b) => a + b, 0) + (m.boss || 0)} hostiles · key: ${ITEMS[m.key].name}</p></div>`; }).join('');
    const stance = s.stance === 'solo' ? 'Solo' : (s.stance.startsWith('ally:') ? 'Allied with ' : 'Hired by ') + FACTIONS[s.stance.slice(5)].name;
    this.show(`<div class="scr">${this.topbar('Deploy', 'drag gear from the stash into your loadout')}
      <div class="body">
        <section class="grow"><h2>Stash</h2><div style="overflow:auto">${INV.grid('stash', s.stash)}</div></section>
        <section class="fit" style="width:${5 * CELL + 60}px;max-width:100%"><h2>Loadout</h2>
          <div class="eq">${INV.slot('w1', L.w1, 'Primary', ['weapon'], 5, 2)}${INV.slot('w2', L.w2, 'Secondary', ['weapon'], 5, 2)}</div>
          <div class="eq">${INV.slot('armor', L.armor, 'Armor', ['armor'], 3, 3)}${INV.slot('bag', L.bag, 'Backpack', ['backpack'], 3, 3)}</div>
          <h3>Pockets <small>1×1 items only</small></h3>${INV.grid('pockets', L.pockets, { only11: true })}
          ${L.bag ? `<h3>${ITEMS[L.bag.id].name}</h3>${INV.grid('bag', bagGrid(L.bag), { isBag: true })}` : '<p class="dim small">No backpack. Pockets only.</p>'}
        </section>
        <section class="fit" style="width:300px;max-width:100%"><h2>Where</h2><div class="maps">${maps}</div>
          <p class="small">Stance: <b>${stance}</b> ${this.btn('go', 'change', 'data-s="factions"', 'link')}</p>
          <p class="dim small">${WEATHER[forecast(s.map)].desc}</p>
          ${!L.w1 && !L.w2 ? '<p class="warn">⚠ You are unarmed.</p>' : ''}${this.btn('raid', 'DEPLOY →', '', 'go')}</section>
      </div></div>`, 'hubscreen');
  },
  // ================= RAID: INVENTORY & LOOT =================
  playerGrids(p) { return `<h3>Pockets</h3>${INV.grid('pockets', p.pockets, { only11: true })}${p.bag ? `<h3>${ITEMS[p.bag.id].name}</h3>${INV.grid('bag', bagGrid(p.bag), { isBag: true })}` : '<p class="dim small">No backpack.</p>'}`; },
  inventory() {
    INV.reset(); const p = G.player; this.invOpen = true;
    this.show(`<div class="panel inv"><h2>Inventory <small>${p.totalCells() - p.freeCells()}/${p.totalCells()} cells · worth ${fmtMoney(G.carriedValue())}</small>${this.btn('close', '✕', '', 'x')}</h2>
      <div class="eq">${INV.slot('w1', p.weapons[0], 'Primary', ['weapon'], 5, 2)}${INV.slot('w2', p.weapons[1], 'Secondary', ['weapon'], 5, 2)}${INV.slot('armor', p.armor, 'Armor', ['armor'], 3, 3)}${INV.slot('bag', p.bag, 'Backpack', ['backpack'], 3, 3)}</div>
      ${this.playerGrids(p)}<p class="dim small">Click an item: use, drop. Drag to move.</p></div>`);
  },
  loot(c) {
    INV.reset(); const p = G.player; this.lootOpen = true; this.lootC = c; const d = CONTAINER_DEF[c.type];
    this.show(`<div class="panel loot"><h2>${esc(d.name)}${this.btn('close', '✕', '', 'x')}</h2>
      <div class="two"><div><h3>Contents ${c.grid.items.length ? this.btn('takeall', 'Take all') : ''}</h3>${INV.grid('cont', c.grid)}</div><div>${this.playerGrids(p)}</div></div></div>`);
  },
  // sync equipment slots / grids back into game state after a drag-drop
  sync() {
    const sl = INV.slots;
    if (G.state === 'raid') { const p = G.player; if (sl.w1) p.weapons[0] = sl.w1.it; if (sl.w2) p.weapons[1] = sl.w2.it; if (sl.armor) p.armor = sl.armor.it; if (sl.bag) p.bag = sl.bag.it; if (!p.weapons[p.wi]) p.wi = p.weapons[1 - p.wi] ? 1 - p.wi : p.wi; p.magInfo = null; if (this.lootOpen) { const c = this.lootC; if (!c.grid.items.length) c.searched = true; else c.searched = false; this.loot(c); } else this.inventory(); return; }
    const L = G.save.loadout; if (sl.w1) L.w1 = sl.w1.it; if (sl.w2) L.w2 = sl.w2.it; if (sl.armor) L.armor = sl.armor.it; if (sl.bag) L.bag = sl.bag.it;
    G.persist(); this.refresh();
  },
  refresh() { ({ lobby: () => this.lobby(), stash: () => this.stashScreen(), merchants: () => this.merchantsScreen(), factions: () => this.factionsScreen(), hideout: () => this.hideoutScreen(), deploy: () => this.deployScreen() })[this.screen](); },
  itemMenu(src, x, y) {
    const it = src.it, d = ITEMS[it.id]; const acts = []; const s = G.save;
    if (G.state === 'raid') {
      const p = G.player;
      if (src.key === 'cont') acts.push({ label: 'Take', fn: () => { if (p.addItem(it)) { gridRemove(this.lootC.grid, it); SFX.ui(); } else G.toast('No room'); this.sync(); } });
      else {
        if (d.type === 'med') acts.push({ label: 'Use', fn: () => { p.use(it); this.hide(); } });
        if (this.lootOpen && src.kind === 'grid') acts.push({ label: 'Put in ' + CONTAINER_DEF[this.lootC.type].name, fn: () => { if (gridAdd(this.lootC.grid, it)) { if (src.kind === 'grid') gridRemove(src.g, it); } this.sync(); } });
        if (d.type === 'weapon' && src.kind === 'grid') acts.push({ label: 'Equip', fn: () => { const i = !p.weapons[0] ? 0 : !p.weapons[1] ? 1 : p.wi; const old = p.weapons[i]; gridRemove(src.g, it); p.weapons[i] = it; if (old && !p.addItem(old)) this.dropItem(old); p.wi = i; p.magInfo = null; this.sync(); } });
        if (d.type === 'armor' && src.kind === 'grid') acts.push({ label: 'Wear', fn: () => { const old = p.armor; gridRemove(src.g, it); p.armor = it; if (old && !p.addItem(old)) this.dropItem(old); this.sync(); } });
        acts.push({ label: 'Drop', fn: () => { if (src.kind === 'grid') gridRemove(src.g, it); else INV.slots[src.key].it = null; this.dropItem(it); this.sync(); } });
      }
    } else {
      if (src.key === 'stash') {
        acts.push({ label: `Sell for ${fmtMoney(itemValue(it))}`, fn: () => { gridRemove(s.stash, it); s.money += itemValue(it); s.stats.earned += itemValue(it); G.persist(); this.refresh(); } });
        if (d.type === 'armor' && it.dur < d.dur && s.hideout.workbench >= 2) { const cost = Math.round((1 - it.dur / d.dur) * d.value * 0.5); acts.push({ label: `Repair for ${fmtMoney(cost)}`, fn: () => { if (s.money < cost) return; s.money -= cost; it.dur = d.dur; G.persist(); this.refresh(); } }); }
        if (d.type === 'weapon' && it.ammo < d.mag && stashCount(d.ammo) > 0) acts.push({ label: 'Load mag from stash', fn: () => { let need = d.mag - it.ammo; for (const a of s.stash.items.slice()) { if (a.id !== d.ammo || need <= 0) continue; const t = Math.min(need, a.n); a.n -= t; need -= t; it.ammo += t; if (a.n <= 0) gridRemove(s.stash, a); } G.persist(); this.refresh(); } });
        if (this.screen === 'deploy') { const L = s.loadout; if (d.type === 'weapon') acts.push({ label: 'Equip', fn: () => { const k = !L.w1 ? 'w1' : !L.w2 ? 'w2' : 'w1'; gridRemove(s.stash, it); if (L[k]) gridAdd(s.stash, L[k]); L[k] = it; G.persist(); this.refresh(); } }); if (d.type === 'armor' || d.type === 'backpack') acts.push({ label: 'Equip', fn: () => { const k = d.type === 'armor' ? 'armor' : 'bag'; gridRemove(s.stash, it); if (L[k]) gridAdd(s.stash, L[k]); L[k] = it; G.persist(); this.refresh(); } }); if (d.w === 1 && d.h === 1) acts.push({ label: 'To pockets', fn: () => { if (gridAdd(L.pockets, it)) gridRemove(s.stash, it); G.persist(); this.refresh(); } }); if (L.bag && d.type !== 'backpack') acts.push({ label: 'To backpack', fn: () => { if (gridAdd(bagGrid(L.bag), it)) gridRemove(s.stash, it); G.persist(); this.refresh(); } }); }
      } else if (src.kind === 'grid') acts.push({ label: 'To stash', fn: () => { if (gridAdd(s.stash, it)) gridRemove(src.g, it); else G.toast('Stash full'); G.persist(); this.refresh(); } });
      else acts.push({ label: 'Unequip', fn: () => { if (gridAdd(s.stash, it)) { INV.slots[src.key].it = null; this.sync(); } } });
      if (it.n > 1) acts.push({ label: 'Split stack', fn: () => { const g = src.kind === 'grid' ? src.g : null; if (!g) return; const half = Math.floor(it.n / 2); const nu = splitStack(it, half); if (!gridAdd(g, nu)) it.n += half; G.persist(); this.refresh(); } });
    }
    if (!acts.length) return; INV.showMenu(x, y, acts);
  },
  dropItem(it) { const p = G.player; const c = { x: p.x + rand(-20, 20), y: p.y + rand(-20, 20), type: 'stash', items: [it], opened: true, searched: false, rot: rand(-0.3, 0.3) }; G.openContainer(c, true); G.world.containers.push(c); },
  help() { this.menu = 'help'; this.show(`<div class="panel"><h2>How to play</h2>
    <p><b>Goal:</b> deploy, loot, survive, reach an <b>open extraction</b> and stand in it for 6 seconds. What you extract with goes to your stash. Die or time out and you lose everything you brought.</p>
    <p><b>Seeing:</b> your flashlight (F) lights what you face; walls and trees cast shadows. Scavs see you from twice as far with it on. Turn it off to sneak.</p>
    <p><b>Not knowing:</b> no hit markers, no enemy health, no mag counter. Check your mag with C. White rings are footsteps you hear, orange rings are gunshots.</p>
    <p><b>Factions:</b> three gangs fight each other. Go solo and everything on the map is yours but everyone hunts you. Ally with a faction (needs Neutral rep) and two of them escort you, but they loot too. Take a mercenary contract (Friendly rep) to get paid for kills on extraction.</p>
    <p><b>Keys:</b> each map has locked rooms with the best loot. Keys drop from lockers, safes and bodies, or faction merchants sell them at high rep. 3 uses each.</p>
    <p><b>Weather</b> changes every 10 minutes: fog shortens your light, rain muffles sound, storms light up the whole marsh with every lightning strike.</p>
    <p><b>Controls:</b> ${IS_TOUCH ? 'left stick move, right stick aim (push far to fire). Buttons: R reload, ⇄ swap, ▦ inventory, E search/unlock, ? check mag, 🔦 flashlight, ⌖ map.' : 'WASD move, mouse aim, click fire, R reload, C check mag, E search / unlock, Q swap, F flashlight, M map, Tab inventory, Shift sprint, Esc pause. In inventories drag items; R rotates while dragging.'}</p>
    ${this.btn('lobby', 'Back')}</div>`); },
  pause() { this.paused = true; this.show(`<div class="panel"><h2>Paused</h2><p class="dim">The marsh waits.</p>${this.btn('resume', 'Resume', '', 'go')} ${this.btn('toggleSound', SFX.muted ? 'Unmute' : 'Mute')} ${this.btn('abandon', 'Abandon raid (counts as death)', '', 'sell')}</div>`); },
  results(kind, data) {
    const title = kind === 'extract' ? 'EXTRACTED' : kind === 'mia' ? 'MISSING IN ACTION' : 'KILLED IN ACTION'; const col = kind === 'extract' ? '#7f7' : '#f77';
    const items = data.items.length ? `<div class="list">${data.items.map(it => `<div class="row"><span class="nm">${this.swatch(it.id)}${esc(itemLabel(it))}</span><span class="vl">${fmtMoney(itemValue(it))}</span></div>`).join('')}</div>` : '<p class="dim">Nothing.</p>';
    this.show(`<div class="panel res"><h2 style="color:${col}">${title}</h2><p>${esc(data.msg)}</p>
      <div class="stats"><span>Kills <b>${data.kills}</b></span><span>XP <b>+${data.xp}</b></span><span>Time <b>${fmtTime(data.time)}</b></span><span>${kind === 'extract' ? 'Loot value' : 'Lost'} <b>${fmtMoney(data.value)}</b></span></div>
      <h3>${kind === 'extract' ? 'Brought home' : 'Lost'}</h3>${items}${data.charity ? '<p class="warn">Old Mallard took pity and left a pistol, some ammo and a bandage in your stash.</p>' : ''}
      ${this.btn('lobby', 'Return to hideout', '', 'go')}</div>`);
  },
  // ================= actions =================
  act(a, ds) {
    const s = G.save, p = G.player;
    switch (a) {
      case 'lobby': this.hide(); this.lobby(); break;
      case 'go': this.hide(); ({ stash: () => this.stashScreen(), merchants: () => this.merchantsScreen(), factions: () => this.factionsScreen(), hideout: () => this.hideoutScreen(), deploy: () => this.deployScreen() })[ds.s](); break;
      case 'help': this.help(); break;
      case 'stab': this.tab.stash = ds.t; this.stashScreen(); break;
      case 'mtab': this.tab.merch = ds.t; this.merchantsScreen(); break;
      case 'toggleSound': SFX.setMuted(!SFX.muted); if (G.state === 'hub') this.refresh(); else this.pause(); break;
      case 'reset': if (confirm('Delete all progress and start over?')) { G.newSave(); this.lobby(); } break;
      case 'buy': { const price = +ds.price; if (s.money < price) break; const d = ITEMS[ds.id]; const it = mk(ds.id, d.type === 'ammo' ? d.stack : 1); if (!gridAdd(s.stash, it)) { alert('Stash is full.'); break; } s.money -= price; G.persist(); this.refresh(); break; }
      case 'craft': { const r = RECIPES[+ds.i]; if (!r || s.hideout[r.station] < r.lvl || !r.in.every(([id, n]) => stashCount(id) >= n)) break; const out = mk(r.out[0], r.out[1]); for (const [id, n] of r.in) stashTake(id, n); if (!gridAdd(s.stash, out)) { s.money += itemValue(out); alert('Stash full: crafted item was sold instead.'); } SFX.extractDone(); G.persist(); this.refresh(); break; }
      case 'upgrade': { const h = HIDEOUT[ds.k]; const lvl = s.hideout[ds.k]; const next = h.levels[lvl + 1]; if (!next || !canAfford(next.cost, next.items)) break; s.money -= next.cost; for (const [id, n] of next.items) stashTake(id, n); s.hideout[ds.k] = lvl + 1; if (ds.k === 'stash') s.stash.h = next.rows; SFX.extractDone(); G.persist(); this.refresh(); break; }
      case 'turnin': { const q = QUEST_BY_ID[ds.q]; if (q && turnInQuest(q)) SFX.extractDone(); this.refresh(); break; }
      case 'stance': { const v = ds.v; if (v.startsWith('ally:') && s.rep[v.slice(5)] < 0) break; if (v.startsWith('merc:') && s.rep[v.slice(5)] < 15) break; s.stance = v; G.persist(); this.refresh(); break; }
      case 'pickmap': s.map = ds.map; G.persist(); this.refresh(); break;
      case 'raid': G.startRaid(s.map); break;
      // raid
      case 'close': this.hide(); break;
      case 'resume': this.hide(); break;
      case 'abandon': this.hide(); p.die('abandoning the raid'); break;
      case 'takeall': { const c = this.lootC; for (const it of c.grid.items.slice().sort((a, b) => itemValue(b) - itemValue(a))) { if (p.addItem(it)) gridRemove(c.grid, it); else { G.toast('No room'); break; } } this.sync(); break; }
    }
  },
  // ---------- touch controls ----------
  touchLayout(W, H) {
    const r = 28, y = H - 34, cx = W / 2;
    this.buttons = [
      { id: 'reload', label: 'R', x: cx - 100, y, r }, { id: 'swap', label: '⇄', x: cx - 34, y, r },
      { id: 'inv', label: '▦', x: cx + 34, y, r }, { id: 'interact', label: 'E', x: cx + 100, y, r },
      { id: 'sprint', label: '»', x: 110, y: H - 240, r: 26, toggle: true }, { id: 'pause', label: '≡', x: W - 36, y: 36, r: 24 },
      { id: 'light', label: '🔦', x: W - 36, y: 100, r: 24 }, { id: 'map', label: '⌖', x: W - 36, y: 152, r: 24 }, { id: 'check', label: '?', x: cx + 166, y, r },
    ];
    return this.buttons;
  },
  drawTouch(x, W, H) {
    const t = this.touch; x.save(); x.lineWidth = 2;
    const stick = (s, cx, cy) => { x.fillStyle = 'rgba(255,255,255,0.12)'; x.strokeStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.arc(cx, cy, 60, 0, TAU); x.fill(); x.stroke(); const kx = cx + (s ? s.dx : 0) * 60, ky = cy + (s ? s.dy : 0) * 60; x.fillStyle = 'rgba(255,255,255,0.45)'; x.beginPath(); x.arc(kx, ky, 26, 0, TAU); x.fill(); };
    stick(t.move, t.move ? t.move.ox : 110, t.move ? t.move.oy : H - 140); stick(t.aim, t.aim ? t.aim.ox : W - 110, t.aim ? t.aim.oy : H - 140);
    for (const b of this.touchLayout(W, H)) { if (b.id === 'interact' && !G.nearestContainer() && !G.nearestLocked()) continue; const on = (b.id === 'sprint' && G.input.sprintToggle) || (b.id === 'light' && G.player.light) || (b.id === 'map' && this.mapOpen); x.fillStyle = on ? 'rgba(255,220,80,0.5)' : 'rgba(0,0,0,0.4)'; x.strokeStyle = 'rgba(255,255,255,0.5)'; x.beginPath(); x.arc(b.x, b.y, b.r, 0, TAU); x.fill(); x.stroke(); x.fillStyle = '#fff'; x.font = 'bold 20px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(b.label, b.x, b.y); }
    x.restore(); x.textBaseline = 'alphabetic';
  },
};
