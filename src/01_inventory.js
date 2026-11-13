// ---------- grid inventories (Tarkov-style) ----------
// A grid is { w, h, items: [item] } where each item carries x, y, rot (0|1).
const CELL = 44;
function itemSize(it) { const d = ITEMS[it.id]; return it.rot ? [d.h, d.w] : [d.w, d.h]; }
function gridMake(w, h, items) { return { w, h, items: items || [] }; }
function gridFits(g, it, x, y, rot, ignore) {
  const d = ITEMS[it.id]; const w = rot ? d.h : d.w, h = rot ? d.w : d.h;
  if (x < 0 || y < 0 || x + w > g.w || y + h > g.h) return false;
  for (const o of g.items) { if (o === ignore || o.uid === it.uid) continue; const [ow, oh] = itemSize(o); if (x < o.x + ow && x + w > o.x && y < o.y + oh && y + h > o.y) return false; }
  return true;
}
function gridFind(g, it) { // first fit, tries both rotations
  const d = ITEMS[it.id];
  for (let rot = 0; rot < (d.w === d.h ? 1 : 2); rot++) for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (gridFits(g, it, x, y, rot, it)) return { x, y, rot };
  return null;
}
function gridPlace(g, it, x, y, rot) { it.x = x; it.y = y; it.rot = rot || 0; if (!g.items.includes(it)) g.items.push(it); return it; }
function gridRemove(g, it) { const i = g.items.indexOf(it); if (i >= 0) g.items.splice(i, 1); }
// add with stacking; returns true if fully added
function gridAdd(g, it) {
  const d = ITEMS[it.id];
  if (d.stack) { for (const o of g.items) { if (o.id === it.id && o.n < d.stack) { const take = Math.min(d.stack - o.n, it.n); o.n += take; it.n -= take; if (it.n <= 0) return true; } } }
  const p = gridFind(g, it); if (!p) return false; gridPlace(g, it, p.x, p.y, p.rot); return true;
}
function gridCount(g, id) { return g.items.filter(i => i.id === id).reduce((a, i) => a + (i.n || 1), 0); }
function gridValue(g) { return g.items.reduce((a, i) => a + itemValue(i), 0); }
function gridFree(g) { let used = 0; for (const o of g.items) { const [w, h] = itemSize(o); used += w * h; } return g.w * g.h - used; }
function bagGrid(bag) { const d = ITEMS[bag.id]; if (!bag.items) bag.items = []; return { w: d.gw, h: d.gh, items: bag.items }; }
// take `n` of a stack out as a new item (for splitting / partial moves)
function splitStack(it, n) { const nu = { ...it, uid: Math.floor(Math.random() * 1e9), n }; it.n -= n; return nu; }

// ---------- DOM renderer + drag/drop ----------
const INV = {
  drag: null, grids: {}, slots: {}, onChange: null, menuEl: null,
  // html for a grid; key identifies it for drops
  grid(key, g, opts = {}) {
    this.grids[key] = { g, opts };
    const cells = `<div class="gcells" style="width:${g.w * CELL}px;height:${g.h * CELL}px"></div>`;
    const items = g.items.map(it => this.itemHtml(it, key)).join('');
    return `<div class="grid" data-grid="${key}" style="width:${g.w * CELL}px;height:${g.h * CELL}px">${cells}${items}</div>`;
  },
  itemHtml(it, key, extraStyle = '') {
    const d = ITEMS[it.id]; const [w, h] = itemSize(it);
    let badge = ''; if (it.n > 1) badge = it.n; else if (d.type === 'weapon') badge = `${it.ammo}/${d.mag}`; else if (d.type === 'armor') badge = Math.ceil(it.dur / d.dur * 100) + '%'; else if (d.type === 'key') badge = it.uses + '×'; else if (d.type === 'backpack' && it.items && it.items.length) badge = '●';
    const label = d.name.length > w * 7 ? d.name.split(' ')[0] : d.name;
    return `<div class="gitem t-${d.type}" data-uid="${it.uid}" data-grid="${key}" style="left:${it.x * CELL}px;top:${it.y * CELL}px;width:${w * CELL}px;height:${h * CELL}px;--c:${d.col};${extraStyle}" title="${esc(itemLabel(it))} · ${fmtMoney(itemValue(it))}"><span class="gl">${esc(label)}</span>${badge !== '' ? `<span class="gb">${badge}</span>` : ''}</div>`;
  },
  // equipment slot: accepts item types
  slot(key, it, label, accept, w = 4, h = 2) {
    this.slots[key] = { it, accept };
    const inner = it ? this.itemHtml({ ...it, x: 0, y: 0 }, 'slot:' + key, 'position:relative') : `<span class="sl">${label}</span>`;
    return `<div class="eslot ${it ? 'has' : ''}" data-slot="${key}" style="width:${w * CELL}px;height:${h * CELL}px">${inner}</div>`;
  },
  reset() { this.grids = {}; this.slots = {}; },
  // resolve item by uid from any registered grid or slot
  locate(uid) {
    for (const k in this.grids) { const it = this.grids[k].g.items.find(i => String(i.uid) === uid); if (it) return { kind: 'grid', key: k, g: this.grids[k].g, it }; }
    for (const k in this.slots) { const it = this.slots[k].it; if (it && String(it.uid) === uid) return { kind: 'slot', key: k, it }; }
    return null;
  },
  bind(root) {
    root.addEventListener('pointerdown', e => {
      const el = e.target.closest('.gitem'); if (!el) { this.closeMenu(); return; }
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const src = this.locate(el.dataset.uid); if (!src) return; e.preventDefault(); this.closeMenu();
      const r = el.getBoundingClientRect();
      this.drag = { src, el, startX: e.clientX, startY: e.clientY, offX: e.clientX - r.left, offY: e.clientY - r.top, rot: src.it.rot || 0, moved: false, ghost: null, id: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch (x) { }
    });
    root.addEventListener('pointermove', e => {
      const dg = this.drag; if (!dg) return;
      if (!dg.moved && Math.hypot(e.clientX - dg.startX, e.clientY - dg.startY) < 6) return;
      if (!dg.moved) { dg.moved = true; dg.ghost = dg.el.cloneNode(true); dg.ghost.classList.add('ghost'); dg.ghost.style.position = 'fixed'; dg.ghost.style.zIndex = 1000; dg.ghost.style.pointerEvents = 'none'; document.body.appendChild(dg.ghost); dg.el.style.opacity = 0.35; }
      this.applyRot(); dg.ghost.style.left = (e.clientX - dg.offX) + 'px'; dg.ghost.style.top = (e.clientY - dg.offY) + 'px';
      this.highlight(e.clientX - dg.offX + CELL / 2, e.clientY - dg.offY + CELL / 2);
    });
    const up = e => {
      const dg = this.drag; if (!dg) return; this.drag = null;
      if (dg.ghost) dg.ghost.remove(); dg.el.style.opacity = '';
      root.querySelectorAll('.gcell-hl').forEach(h => h.remove());
      if (!dg.moved) { this.openMenu(dg.src, e.clientX, e.clientY); return; }
      this.drop(dg, e.clientX - dg.offX + CELL / 2, e.clientY - dg.offY + CELL / 2);
    };
    root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
    window.addEventListener('keydown', e => { if (this.drag && this.drag.moved && e.key.toLowerCase() === 'r') { this.drag.rot ^= 1; this.applyRot(); } });
  },
  applyRot() { const dg = this.drag; if (!dg || !dg.ghost) return; const d = ITEMS[dg.src.it.id]; const w = dg.rot ? d.h : d.w, h = dg.rot ? d.w : d.h; dg.ghost.style.width = w * CELL + 'px'; dg.ghost.style.height = h * CELL + 'px'; },
  rotateDrag() { if (this.drag && this.drag.moved) { this.drag.rot ^= 1; this.applyRot(); } },
  targetAt(px, py) {
    const els = document.elementsFromPoint(px, py);
    for (const el of els) { if (el.classList && el.classList.contains('grid')) { const r = el.getBoundingClientRect(); return { kind: 'grid', key: el.dataset.grid, x: Math.floor((px - r.left) / CELL), y: Math.floor((py - r.top) / CELL), el }; } if (el.classList && el.classList.contains('eslot')) return { kind: 'slot', key: el.dataset.slot, el }; }
    return null;
  },
  highlight(px, py) {
    const dg = this.drag; const t = this.targetAt(px, py); document.querySelectorAll('.gcell-hl').forEach(h => h.remove()); if (!t) return;
    const d = ITEMS[dg.src.it.id]; const w = dg.rot ? d.h : d.w, h = dg.rot ? d.w : d.h;
    const hl = document.createElement('div'); hl.className = 'gcell-hl';
    if (t.kind === 'grid') { const g = this.grids[t.key].g; const ok = gridFits(g, dg.src.it, t.x, t.y, dg.rot, dg.src.it); hl.style.cssText = `left:${t.x * CELL}px;top:${t.y * CELL}px;width:${w * CELL}px;height:${h * CELL}px;background:${ok ? 'rgba(80,255,120,0.35)' : 'rgba(255,80,80,0.35)'}`; t.el.appendChild(hl); }
    else { const s = this.slots[t.key]; const ok = s.accept.includes(d.type) && !s.it; hl.style.cssText = `inset:0;background:${ok ? 'rgba(80,255,120,0.35)' : 'rgba(255,80,80,0.35)'}`; t.el.appendChild(hl); }
  },
  drop(dg, px, py) {
    const t = this.targetAt(px, py); if (!t) return; const it = dg.src.it; const d = ITEMS[it.id];
    const take = () => { if (dg.src.kind === 'grid') gridRemove(dg.src.g, it); else this.slots[dg.src.key].it = null; };
    if (t.kind === 'grid') {
      const g = this.grids[t.key].g; const opts = this.grids[t.key].opts;
      if (opts.accept && !opts.accept.includes(d.type)) return;
      if (opts.only11 && (d.w > 1 || d.h > 1)) return;
      if (it.id && d.type === 'backpack' && opts.isBag) return; // no bags inside bags
      // stack merge onto same item?
      const under = g.items.find(o => o !== it && o.id === it.id && d.stack && o.n < d.stack && t.x >= o.x && t.x < o.x + itemSize(o)[0] && t.y >= o.y && t.y < o.y + itemSize(o)[1]);
      if (under) { const n = Math.min(d.stack - under.n, it.n); under.n += n; it.n -= n; if (it.n <= 0) take(); this.changed(dg.src.key, t.key); return; }
      if (!gridFits(g, it, t.x, t.y, dg.rot, it)) return;
      take(); gridPlace(g, it, t.x, t.y, dg.rot); this.changed(dg.src.key, t.key);
    } else {
      const s = this.slots[t.key]; if (!s.accept.includes(d.type)) return;
      if (s.it) { // swap: old slot item goes back to source grid if it fits
        if (dg.src.kind !== 'grid') return; const old = s.it; gridRemove(dg.src.g, it); const p = gridFind(dg.src.g, old); if (!p) { gridPlace(dg.src.g, it, it.x, it.y, it.rot); return; } gridPlace(dg.src.g, old, p.x, p.y, p.rot); s.it = it; this.changed(dg.src.key, t.key); return;
      }
      take(); s.it = it; this.changed(dg.src.key, t.key);
    }
  },
  changed(from, to) { if (this.onChange) this.onChange(from, to); },
  openMenu(src, x, y) { if (this.onMenu) this.onMenu(src, x, y); },
  closeMenu() { if (this.menuEl) { this.menuEl.remove(); this.menuEl = null; } },
  showMenu(x, y, actions) { // actions: [{label, fn}]
    this.closeMenu(); const m = document.createElement('div'); m.className = 'imenu'; m.style.left = Math.min(x, window.innerWidth - 170) + 'px'; m.style.top = Math.min(y, window.innerHeight - actions.length * 34 - 10) + 'px';
    m.innerHTML = actions.map((a, i) => `<button data-i="${i}">${a.label}</button>`).join('');
    m.addEventListener('pointerdown', e => e.stopPropagation()); m.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const a = actions[+b.dataset.i]; this.closeMenu(); a.fn(); });
    document.body.appendChild(m); this.menuEl = m;
  },
};
