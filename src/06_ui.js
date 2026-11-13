// ---------- DOM UI: hub, inventory, loot, results, pause, touch controls ----------
const UI = {
  el: null, lootOpen: false, invOpen: false, paused: false, mapOpen: false, menu: null, touch: { move: null, aim: null, buttons: [] },
  init() {
    this.el = document.getElementById('ui');
    this.el.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; e.preventDefault(); SFX.init(); SFX.ui(); this.act(b.dataset.act, b.dataset); });
    this.el.addEventListener('touchstart', e => { e.stopPropagation(); }, { passive: true });
    this.el.addEventListener('mousedown', e => { e.stopPropagation(); });
  },
  show(html, cls = '') { this.el.innerHTML = `<div class="screen ${cls}">${html}</div>`; this.el.style.pointerEvents = 'auto'; },
  hide() { this.el.innerHTML = ''; this.el.style.pointerEvents = 'none'; this.lootOpen = this.invOpen = this.paused = false; this.menu = null; },
  toggleMap() { this.mapOpen = !this.mapOpen; SFX.ui(); },
  swatch(id) { return `<i class="sw" style="background:${ITEMS[id].col}"></i>`; },
  row(it, actions) { const d = ITEMS[it.id]; return `<div class="row"><span class="nm">${this.swatch(it.id)}${esc(itemLabel(it))}</span><span class="vl">${fmtMoney(itemValue(it))}</span><span class="acts">${actions}</span></div>`; },
  btn(act, label, extra = '', cls = '') { return `<button class="b ${cls}" data-act="${act}" ${extra}>${label}</button>`; },
  // ---------- HUB ----------
  hub(tab) {
    const s = G.save, L = s.loadout; this.tab = tab || this.tab || 'stash';
    const cap = 4 + (L.bag ? ITEMS[L.bag.id].slots : 0); const lvl = G.level(); const nextXp = (lvl + 1) ** 2 * 100;
    const slot = (name, it, key) => `<div class="slot"><b>${name}</b>${it ? `<span>${this.swatch(it.id)}${esc(itemLabel(it))}</span>${this.btn('unequip', 'Unequip', `data-key="${key}"`)}` : '<span class="dim">— empty —</span>'}</div>`;
    const stash = s.stash.slice().sort((a, b) => ITEMS[a.id].type.localeCompare(ITEMS[b.id].type) || itemValue(b) - itemValue(a));
    const stashHtml = stash.length ? stash.map(it => { const d = ITEMS[it.id]; let a = ''; if (d.type === 'weapon' || d.type === 'armor' || d.type === 'backpack') a += this.btn('equip', 'Equip', `data-uid="${it.uid}"`); else a += this.btn('carry', 'Carry', `data-uid="${it.uid}"`); a += this.btn('sell', 'Sell', `data-uid="${it.uid}"`, 'sell'); return this.row(it, a); }).join('') : '<p class="dim">Your stash is empty. Buy gear from the trader, or go find some.</p>';
    const carryHtml = L.carry.length ? L.carry.map(it => this.row(it, this.btn('uncarry', 'Stash', `data-uid="${it.uid}"`))).join('') : '<p class="dim">Nothing packed. Carry meds and ammo from the stash.</p>';
    const trader = TRADER_STOCK.map(id => { const d = ITEMS[id]; const ok = traderUnlocked(id, lvl); const price = buyPrice(id); return `<div class="row ${ok ? '' : 'lock'}"><span class="nm">${this.swatch(id)}${esc(d.name)}${d.type === 'ammo' ? ` ×${d.stack}` : ''}<small>${esc(d.desc || '')}</small></span><span class="vl">${fmtMoney(price)}</span><span class="acts">${ok ? this.btn('buy', 'Buy', `data-id="${id}"`, s.money >= price ? '' : 'dis') : `<span class="dim">Lv ${TRADER_REQ[id]} or quest</span>`}</span></div>`; }).join('');
    const maps = Object.entries(MAPS).map(([id, m]) => `<div class="map" style="border-color:${m.color}"><b>${m.name}</b><small>${m.sub}</small><p>${m.desc}</p><p class="dim">${m.w}×${m.h} · ${fmtTime(m.time)} · ${m.scavs + m.guards + m.boss} hostiles</p>${this.btn('raid', 'DEPLOY →', `data-map="${id}"`, 'go')}</div>`).join('');
    const questsHtml = Object.entries(NPCS).map(([id, n]) => { const q = activeQuestFor(id); const doneN = QUESTS.filter(x => x.npc === id && s.quests.done.includes(x.id)).length; const total = QUESTS.filter(x => x.npc === id).length; let body; if (!q) body = '<p class="dim">No more work for now. Thanks, kid.</p>'; else { const ready = questReady(q); const prog = q.type === 'bring' ? q.items.map(([iid, cnt]) => `${ITEMS[iid].name} ${Math.min(cnt, s.stash.filter(i => i.id === iid).reduce((a, i) => a + (i.n || 1), 0))}/${cnt}`).join(', ') : `${questProgress(q)}/${q.count}`; const rw = [q.reward.money ? fmtMoney(q.reward.money) : '', q.reward.xp ? q.reward.xp + ' XP' : '', ...(q.reward.items || []).map(([iid, cnt]) => ITEMS[iid].name + (cnt > 1 ? ' ×' + cnt : '')), q.reward.unlock ? 'unlocks ' + ITEMS[q.reward.unlock].name : ''].filter(Boolean).join(' · '); body = `<b class="qt">${esc(q.title)}</b><p>${esc(q.desc)}</p><p class="dim small">Progress: ${esc(prog)}</p><p class="small">Reward: ${esc(rw)}</p>${ready ? this.btn('turnin', 'Turn in ✔', `data-q="${q.id}"`, 'go') : ''}`; } return `<div class="npc" style="border-color:${n.col}"><div class="nh"><i class="sw" style="background:${n.col}"></i><b>${n.name}</b><small>${n.role} · ${doneN}/${total} done</small></div><p class="dim small">“${esc(n.greet)}”</p>${body}</div>`; }).join('');
    const st = s.stats;
    const tabs = ['stash', 'loadout', 'trader', 'quests', 'deploy'].map(t => `<button class="tab ${this.tab === t ? 'on' : ''}" data-act="tab" data-tab="${t}">${t.toUpperCase()}</button>`).join('');
    this.show(`<div class="hub">
      <header><h1>MARSH RAID</h1><div class="meta"><span>Level <b>${lvl}</b> <small>${s.xp}/${nextXp} XP</small></span><span class="money">${fmtMoney(s.money)}</span><span class="dim">Raids ${st.raids} · Extracted ${st.extracts} · KIA ${st.deaths} · Kills ${st.kills}</span>${this.btn('toggleSound', SFX.muted ? '🔇' : '🔊', '', 'icon')}${this.btn('help', '?', '', 'icon')}</div></header>
      <nav class="tabs">${tabs}</nav>
      <div class="cols">
        <section class="${this.tab === 'stash' ? 'on' : ''}"><h2>Stash <small>${s.stash.length} items · worth ${fmtMoney(s.stash.reduce((a, i) => a + itemValue(i), 0))}</small></h2><div class="list">${stashHtml}</div></section>
        <section class="${this.tab === 'loadout' ? 'on' : ''}"><h2>Loadout</h2>
          ${slot('Primary', L.w1, 'w1')}${slot('Secondary', L.w2, 'w2')}${slot('Armor', L.armor, 'armor')}${slot('Backpack', L.bag, 'bag')}
          <h2>Carry <small>${L.carry.length}/${cap} slots</small></h2><div class="list">${carryHtml}</div></section>
        <section class="${this.tab === 'trader' ? 'on' : ''}"><h2>Trader <small>Old Mallard</small></h2><div class="list">${trader}</div></section>
        <section class="${this.tab === 'quests' ? 'on' : ''}"><h2>Hideout <small>quests &amp; people</small></h2><div class="list">${questsHtml}</div></section>
        <section class="${this.tab === 'deploy' ? 'on' : ''}"><h2>Deploy</h2><div class="maps">${maps}</div>${!L.w1 && !L.w2 ? '<p class="warn">⚠ You are unarmed. Equip a weapon first.</p>' : ''}<p class="dim small">Die and you lose everything you brought. Extract and you keep it all. Sell loot at the trader.</p></section>
      </div>
      <footer class="dim small">${IS_TOUCH ? 'Left stick move · right stick aim (push far to fire) · E to search · 🔦 flashlight · ⌖ map · ? check mag' : 'WASD move · mouse aim · LMB fire · R reload · C check mag · E search · Q swap · F flashlight · M map · Tab inventory · Shift sprint · Esc pause'} · ${this.btn('reset', 'Reset progress', '', 'link')}</footer>
    </div>`, 'hubscreen');
  },
  help() { this.menu = 'help'; this.show(`<div class="panel"><h2>How to play</h2>
    <p><b>Goal:</b> deploy into a raid, search containers, kill or avoid scavs, reach an <b>open extraction</b> and stand in it for 6 seconds. Everything you extract with goes to your stash. If you die or the timer runs out you lose everything you brought.</p>
    <p><b>Suspense rules:</b> you only see what's in your flashlight cone and a small radius. Enemies you can't see still make noise: white rings are footsteps, orange rings are gunshots. Your gunshots attract scavs from far away. Sprinting is loud.</p>
    <p><b>Health:</b> hits can make you <b>bleed</b> (steady HP loss). Bandages and medkits stop it. Armor absorbs damage until it wears out.</p>
    <p><b>Extracts:</b> the far one is always open. Others open and close on timers shown in the top-left. The map (M) shows what you've explored, extracts and quest markers.</p>
    <p><b>No hand-holding:</b> there are no hit markers or enemy health bars. You don't know how many rounds are in your mag unless you check it (C) or reload. Your flashlight (F) lets you see far, and lets scavs see you from twice as far. Turn it off to sneak.</p>
    <p><b>Controls:</b> ${IS_TOUCH ? 'left stick move, right stick aim (push far to fire), buttons for reload / swap / inventory / sprint. Tap near a crate to search it.' : 'WASD move, mouse aim, click to fire, R reload, C check mag, E search / open, Q or 1/2 swap weapon, F flashlight, M map, Tab inventory, Shift sprint, Esc pause.'}</p>
    ${this.btn('hub', 'Back')}</div>`); },
  // ---------- IN-RAID INVENTORY ----------
  inventory() {
    const p = G.player; this.invOpen = true;
    const rows = p.inv.map(it => { const d = ITEMS[it.id]; let a = ''; if (d.type === 'med') a += this.btn('use', 'Use', `data-uid="${it.uid}"`); if (d.type === 'weapon') a += this.btn('equipw', 'Equip', `data-uid="${it.uid}"`); if (d.type === 'armor') a += this.btn('equipa', 'Wear', `data-uid="${it.uid}"`); if (d.type === 'backpack') a += this.btn('equipb', 'Wear', `data-uid="${it.uid}"`); a += this.btn('drop', 'Drop', `data-uid="${it.uid}"`, 'sell'); return this.row(it, a); }).join('') || '<p class="dim">Empty.</p>';
    const ws = p.weapons.map((wp, i) => `<div class="slot ${i === p.wi ? 'act' : ''}"><b>${i === 0 ? 'Primary' : 'Secondary'}</b>${wp ? `<span>${this.swatch(wp.id)}${esc(itemLabel(wp))}</span>${this.btn('unequipw', 'Stow', `data-i="${i}"`)}` : '<span class="dim">— empty —</span>'}</div>`).join('');
    this.show(`<div class="panel inv"><h2>Inventory <small>${p.inv.length}/${p.capacity} · worth ${fmtMoney(G.carriedValue())}</small>${this.btn('close', '✕', '', 'x')}</h2>
      ${ws}<div class="slot"><b>Armor</b>${p.armor ? `<span>${this.swatch(p.armor.id)}${esc(itemLabel(p.armor))}</span>` : '<span class="dim">— none —</span>'}</div><div class="slot"><b>Backpack</b>${p.bag ? `<span>${this.swatch(p.bag.id)}${esc(itemLabel(p.bag))}</span>` : '<span class="dim">— pockets only —</span>'}</div>
      <div class="list">${rows}</div></div>`);
  },
  // ---------- LOOT PANEL ----------
  loot(c) {
    const p = G.player; this.lootOpen = true; this.lootC = c; const d = CONTAINER_DEF[c.type];
    const rows = c.items.map((it, i) => this.row(it, this.btn('take', 'Take', `data-i="${i}"`))).join('') || '<p class="dim">Nothing left.</p>';
    const mine = p.inv.map(it => this.row(it, this.btn('stow', 'Put', `data-uid="${it.uid}"`))).join('') || '<p class="dim">Empty.</p>';
    this.show(`<div class="panel loot"><h2>${esc(d.name)}${this.btn('close', '✕', '', 'x')}</h2>
      <div class="two"><div><h3>Contents ${c.items.length ? this.btn('takeall', 'Take all') : ''}</h3><div class="list">${rows}</div></div><div><h3>Your bag <small>${p.inv.length}/${p.capacity}</small></h3><div class="list">${mine}</div></div></div></div>`);
  },
  pause() { this.paused = true; this.show(`<div class="panel"><h2>Paused</h2><p class="dim">The marsh waits.</p>${this.btn('resume', 'Resume', '', 'go')} ${this.btn('toggleSound', SFX.muted ? 'Unmute' : 'Mute')} ${this.btn('abandon', 'Abandon raid (counts as death)', '', 'sell')}</div>`); },
  results(kind, data) {
    const title = kind === 'extract' ? 'EXTRACTED' : kind === 'mia' ? 'MISSING IN ACTION' : 'KILLED IN ACTION';
    const col = kind === 'extract' ? '#7f7' : '#f77';
    const items = data.items.length ? `<div class="list">${data.items.map(it => this.row(it, '')).join('')}</div>` : '<p class="dim">Nothing.</p>';
    this.show(`<div class="panel res"><h2 style="color:${col}">${title}</h2><p>${esc(data.msg)}</p>
      <div class="stats"><span>Kills <b>${data.kills}</b></span><span>XP <b>+${data.xp}</b></span><span>Time <b>${fmtTime(data.time)}</b></span>${kind === 'extract' ? `<span>Loot value <b>${fmtMoney(data.value)}</b></span>` : `<span>Lost <b>${fmtMoney(data.value)}</b></span>`}</div>
      <h3>${kind === 'extract' ? 'Brought home' : 'Lost'}</h3>${items}${data.charity ? '<p class="warn">Old Mallard took pity and left a pistol, some ammo and a bandage in your stash.</p>' : ''}
      ${this.btn('hub', 'Return to hideout', '', 'go')}</div>`);
  },
  // ---------- actions ----------
  act(a, ds) {
    const s = G.save, L = s && s.loadout, p = G.player;
    const findStash = uid => s.stash.find(i => String(i.uid) === uid);
    switch (a) {
      case 'tab': this.hub(ds.tab); break;
      case 'hub': G.state = 'hub'; this.hub(); break;
      case 'help': this.help(); break;
      case 'toggleSound': SFX.setMuted(!SFX.muted); if (G.state === 'hub') this.hub(); else this.pause(); break;
      case 'reset': if (confirm('Delete all progress and start over?')) { G.newSave(); this.hub(); } break;
      case 'equip': { const it = findStash(ds.uid); if (!it) break; const d = ITEMS[it.id]; let key = d.type === 'weapon' ? (!L.w1 ? 'w1' : !L.w2 ? 'w2' : 'w1') : d.type === 'armor' ? 'armor' : 'bag'; if (L[key]) s.stash.push(L[key]); L[key] = it; s.stash.splice(s.stash.indexOf(it), 1); this.trimCarry(); G.persist(); this.hub(); break; }
      case 'unequip': { const it = L[ds.key]; if (!it) break; s.stash.push(it); L[ds.key] = null; this.trimCarry(); G.persist(); this.hub(); break; }
      case 'carry': { const it = findStash(ds.uid); if (!it) break; const cap = 4 + (L.bag ? ITEMS[L.bag.id].slots : 0); const d = ITEMS[it.id]; if (d.stack) { const ex = L.carry.find(c => c.id === it.id && c.n < d.stack); if (ex) { const take = Math.min(d.stack - ex.n, it.n); ex.n += take; it.n -= take; if (it.n <= 0) s.stash.splice(s.stash.indexOf(it), 1); G.persist(); this.hub(); break; } } if (L.carry.length >= cap) { alert('No room. Get a bigger backpack.'); break; } L.carry.push(it); s.stash.splice(s.stash.indexOf(it), 1); G.persist(); this.hub(); break; }
      case 'uncarry': { const it = L.carry.find(i => String(i.uid) === ds.uid); if (!it) break; L.carry.splice(L.carry.indexOf(it), 1); this.stashAdd(it); G.persist(); this.hub(); break; }
      case 'sell': { const it = findStash(ds.uid); if (!it) break; s.money += itemValue(it); s.stats.earned += itemValue(it); s.stash.splice(s.stash.indexOf(it), 1); G.persist(); this.hub(); break; }
      case 'buy': { const price = buyPrice(ds.id); if (s.money < price) break; s.money -= price; const d = ITEMS[ds.id]; this.stashAdd(mk(ds.id, d.type === 'ammo' ? d.stack : 1)); G.persist(); this.hub(); break; }
      case 'raid': G.startRaid(ds.map); break;
      case 'turnin': { const q = QUEST_BY_ID[ds.q]; if (q && turnInQuest(q)) { SFX.extractDone(); } this.hub(); break; }
      // raid
      case 'close': this.hide(); break;
      case 'resume': this.hide(); break;
      case 'abandon': this.hide(); p.die('abandoned the raid'); break;
      case 'use': { const it = p.inv.find(i => String(i.uid) === ds.uid); if (it) { p.use(it); this.hide(); } break; }
      case 'drop': { const it = p.inv.find(i => String(i.uid) === ds.uid); if (!it) break; p.removeItem(it); G.world.containers.push({ x: p.x + rand(-20, 20), y: p.y + rand(-20, 20), type: 'crate', items: [it], opened: true, searched: false, rot: rand(-0.3, 0.3) }); this.inventory(); break; }
      case 'equipw': { const it = p.inv.find(i => String(i.uid) === ds.uid); if (!it) break; p.removeItem(it); const slot = !p.weapons[0] ? 0 : !p.weapons[1] ? 1 : p.wi; if (p.weapons[slot]) p.inv.push(p.weapons[slot]); p.weapons[slot] = it; p.wi = slot; p.reloadT = 0; this.inventory(); break; }
      case 'unequipw': { const i = +ds.i; const wp = p.weapons[i]; if (!wp) break; if (p.inv.length >= p.capacity) { alert('Bag is full.'); break; } p.inv.push(wp); p.weapons[i] = null; if (p.wi === i) p.wi = p.weapons[1 - i] ? 1 - i : i; this.inventory(); break; }
      case 'equipa': { const it = p.inv.find(i => String(i.uid) === ds.uid); if (!it) break; p.removeItem(it); if (p.armor) p.inv.push(p.armor); p.armor = it; this.inventory(); break; }
      case 'equipb': { const it = p.inv.find(i => String(i.uid) === ds.uid); if (!it) break; const old = p.bag; p.removeItem(it); p.bag = it; if (old) { if (p.inv.length < p.capacity) p.inv.push(old); else G.world.containers.push({ x: p.x, y: p.y + 30, type: 'crate', items: [old], opened: true, searched: false, rot: 0 }); } while (p.inv.length > p.capacity) { const ov = p.inv.pop(); G.world.containers.push({ x: p.x + rand(-20, 20), y: p.y + rand(-20, 20), type: 'crate', items: [ov], opened: true, searched: false, rot: 0 }); } this.inventory(); break; }
      case 'take': { const c = this.lootC; const it = c.items[+ds.i]; if (!it) break; if (p.addItem({ ...it })) { c.items.splice(+ds.i, 1); G.toast('+ ' + ITEMS[it.id].name); } else G.toast('Bag full'); if (!c.items.length) c.searched = true; this.loot(c); break; }
      case 'takeall': { const c = this.lootC; for (const it of c.items.slice()) { if (p.addItem({ ...it })) c.items.splice(c.items.indexOf(it), 1); else { G.toast('Bag full'); break; } } if (!c.items.length) c.searched = true; this.loot(c); break; }
      case 'stow': { const c = this.lootC; const it = p.inv.find(i => String(i.uid) === ds.uid); if (!it) break; p.removeItem(it); c.items.push(it); c.searched = false; this.loot(c); break; }
    }
  },
  stashAdd(it) { const s = G.save; const d = ITEMS[it.id]; if (d.stack) { for (const o of s.stash) { if (o.id === it.id && o.n < d.stack) { const take = Math.min(d.stack - o.n, it.n); o.n += take; it.n -= take; if (it.n <= 0) return; } } } s.stash.push(it); },
  trimCarry() { const s = G.save, L = s.loadout; const cap = 4 + (L.bag ? ITEMS[L.bag.id].slots : 0); while (L.carry.length > cap) s.stash.push(L.carry.pop()); },
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
    for (const b of this.touchLayout(W, H)) { if (b.id === 'interact' && !G.nearestContainer()) continue; const on = (b.id === 'sprint' && G.input.sprintToggle) || (b.id === 'light' && G.player.light) || (b.id === 'map' && this.mapOpen); x.fillStyle = on ? 'rgba(255,220,80,0.5)' : 'rgba(0,0,0,0.4)'; x.strokeStyle = 'rgba(255,255,255,0.5)'; x.beginPath(); x.arc(b.x, b.y, b.r, 0, TAU); x.fill(); x.stroke(); x.fillStyle = '#fff'; x.font = 'bold 20px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(b.label, b.x, b.y); }
    x.restore(); x.textBaseline = 'alphabetic';
  },
};
