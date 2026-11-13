// ---------- world: map generation, collision, LOS, pathfinding ----------
const T = { GRASS: 0, WATER: 1, ROAD: 2, WALL: 3, FLOOR: 4, TREE: 5, MUD: 6, FENCE: 7 };
const SOLID = new Set([T.WATER, T.WALL, T.TREE, T.FENCE]);
const OPAQUE = new Set([T.WALL, T.TREE]);

class World {
  constructor(cfg, seed) {
    this.cfg = cfg; this.w = cfg.w; this.h = cfg.h; this.seed = seed;
    rng = mulberry32(seed);
    this.tiles = new Uint8Array(this.w * this.h);
    this.buildings = []; this.containers = []; this.extracts = []; this.enemySpawns = [];
    this.generate();
    rng = Math.random;
  }
  idx(x, y) { return y * this.w + x; }
  get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return T.WALL; return this.tiles[y * this.w + x]; }
  set(x, y, v) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.tiles[y * this.w + x] = v; }
  solid(x, y) { return SOLID.has(this.get(x, y)); }
  opaque(x, y) { return OPAQUE.has(this.get(x, y)); }
  solidAt(px, py) { return this.solid(Math.floor(px / TILE), Math.floor(py / TILE)); }

  // --- generation ---
  noise(x, y, s) { // smooth value noise
    const xi = Math.floor(x / s), yi = Math.floor(y / s), fx = (x / s) - xi, fy = (y / s) - yi;
    const sm = t => t * t * (3 - 2 * t); const u = sm(fx), v = sm(fy);
    const a = hash2(xi + this.seed, yi), b = hash2(xi + 1 + this.seed, yi), c = hash2(xi + this.seed, yi + 1), d = hash2(xi + 1 + this.seed, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  generate() {
    const { w, h, cfg } = this;
    // base terrain
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = this.noise(x, y, 7) * 0.7 + this.noise(x + 100, y, 3) * 0.3;
      let t = T.GRASS;
      if (n < 0.30 * cfg.water) t = T.WATER; else if (n < 0.30 * cfg.water + 0.06) t = T.MUD;
      this.set(x, y, t);
    }
    // border walls (world edge)
    for (let x = 0; x < w; x++) { this.set(x, 0, T.WALL); this.set(x, h - 1, T.WALL); }
    for (let y = 0; y < h; y++) { this.set(0, y, T.WALL); this.set(w - 1, y, T.WALL); }
    // roads: one horizontal, one vertical, slightly wobbly
    const ry = randi(Math.floor(h * 0.3), Math.floor(h * 0.7)); const rx = randi(Math.floor(w * 0.3), Math.floor(w * 0.7));
    let yy = ry; for (let x = 1; x < w - 1; x++) { if (chance(0.15)) yy += randi(-1, 1); yy = clamp(yy, 3, h - 4); this.set(x, yy, T.ROAD); this.set(x, yy + 1, T.ROAD); }
    let xx = rx; for (let y = 1; y < h - 1; y++) { if (chance(0.15)) xx += randi(-1, 1); xx = clamp(xx, 3, w - 4); this.set(xx, y, T.ROAD); this.set(xx + 1, y, T.ROAD); }
    // buildings
    let tries = 0;
    while (this.buildings.length < cfg.buildings && tries++ < 600) {
      const bw = randi(5, 11), bh = randi(5, 9); const bx = randi(3, w - bw - 4), by = randi(3, h - bh - 4);
      if (!this.areaFree(bx - 2, by - 2, bw + 4, bh + 4)) continue;
      this.placeBuilding(bx, by, bw, bh);
    }
    // trees
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
      if (this.get(x, y) === T.GRASS && this.noise(x + 500, y + 500, 5) > 0.55 && chance(cfg.trees * 6)) this.set(x, y, T.TREE);
      else if (this.get(x, y) === T.GRASS && chance(cfg.trees * 0.4)) this.set(x, y, T.TREE);
    }
    // player spawn & extracts on edges
    const edges = [
      { x: 2, y: Math.floor(h / 2), name: 'West Marsh' }, { x: w - 3, y: Math.floor(h / 2), name: 'East Road' },
      { x: Math.floor(w / 2), y: 2, name: 'North Fence' }, { x: Math.floor(w / 2), y: h - 3, name: 'South Culvert' },
    ];
    const si = randi(0, 3); const sp = edges[si];
    this.spawn = this.nearestWalkable(sp.x, sp.y, true);
    const others = edges.filter((_, i) => i !== si);
    others.forEach((e, i) => {
      const p = this.nearestWalkable(e.x, e.y, true);
      // the farthest extract is always open; others open at a random time window
      const far = Math.abs(e.x - sp.x) + Math.abs(e.y - sp.y);
      this.extracts.push({ x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2, name: e.name, far, openAt: 0, closeAt: 1e9, r: 70 });
    });
    this.extracts.sort((a, b) => b.far - a.far);
    this.extracts[1].openAt = rand(0.2, 0.45) * cfg.time; this.extracts[1].closeAt = this.extracts[1].openAt + rand(0.25, 0.4) * cfg.time;
    this.extracts[2].openAt = rand(0.45, 0.7) * cfg.time;
    // extra extract on hard maps: one that needs a loud flare (closes quickly) – keep simple: fixed windows
    // containers: inside buildings and scattered
    for (const b of this.buildings) {
      const n = randi(2, 4);
      for (let i = 0; i < n; i++) {
        const cx = randi(b.x + 1, b.x + b.w - 2), cy = randi(b.y + 1, b.y + b.h - 2);
        if (this.get(cx, cy) !== T.FLOOR || this.containerAt(cx, cy)) continue;
        const type = weightedPick([['crate', 6], ['locker', 5], ['medbox', 3], ['weaponbox', 2 + cfg.lootMul], ['safe', 0.6 + cfg.lootMul * 0.6]]);
        this.addContainer(cx, cy, type);
      }
      // enemies gather at buildings
      const en = randi(1, 2);
      for (let i = 0; i < en; i++) this.enemySpawns.push({ x: (b.x + b.w / 2) * TILE + rand(-80, 80), y: (b.y + b.h / 2) * TILE + rand(-80, 80), home: b });
    }
    for (let i = 0; i < Math.floor(w * h / 110 * cfg.lootMul); i++) {
      const cx = randi(2, w - 3), cy = randi(2, h - 3);
      if (this.get(cx, cy) !== T.GRASS && this.get(cx, cy) !== T.ROAD && this.get(cx, cy) !== T.MUD) continue;
      if (this.containerAt(cx, cy)) continue;
      this.addContainer(cx, cy, weightedPick([['crate', 6], ['scrap', 5], ['medbox', 1], ['weaponbox', 0.5]]));
    }
    // roaming enemies anywhere walkable, away from spawn
    for (let i = 0; i < 40; i++) {
      const cx = randi(3, w - 4), cy = randi(3, h - 4);
      if (this.solid(cx, cy)) continue; if (Math.abs(cx - this.spawn.x) + Math.abs(cy - this.spawn.y) < 14) continue;
      this.enemySpawns.push({ x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2, home: null });
    }
    // clear area around spawn
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = this.spawn.x + dx, y = this.spawn.y + dy; if (x > 0 && y > 0 && x < w - 1 && y < h - 1 && this.get(x, y) !== T.FLOOR) this.set(x, y, T.GRASS); }
    for (const e of this.extracts) { const ex = Math.floor(e.x / TILE), ey = Math.floor(e.y / TILE); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = ex + dx, y = ey + dy; if (x > 0 && y > 0 && x < w - 1 && y < h - 1 && this.get(x, y) !== T.FLOOR) this.set(x, y, T.GRASS); } }
    this.ensureConnectivity();
  }
  areaFree(x, y, w, h) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const t = this.get(i, j); if (t === T.WATER || t === T.WALL || t === T.FLOOR || t === T.ROAD) return false; } return true; }
  placeBuilding(bx, by, bw, bh) {
    for (let j = by; j < by + bh; j++) for (let i = bx; i < bx + bw; i++) this.set(i, j, (i === bx || j === by || i === bx + bw - 1 || j === by + bh - 1) ? T.WALL : T.FLOOR);
    // doors: 1-3 on different sides
    const sides = [0, 1, 2, 3].sort(() => rng() - 0.5).slice(0, randi(1, 3));
    for (const s of sides) {
      if (s === 0) this.set(randi(bx + 1, bx + bw - 2), by, T.FLOOR); if (s === 1) this.set(randi(bx + 1, bx + bw - 2), by + bh - 1, T.FLOOR);
      if (s === 2) this.set(bx, randi(by + 1, by + bh - 2), T.FLOOR); if (s === 3) this.set(bx + bw - 1, randi(by + 1, by + bh - 2), T.FLOOR);
    }
    // interior wall
    if (bw >= 8 && chance(0.7)) { const ix = randi(bx + 3, bx + bw - 4); const gap = randi(by + 1, by + bh - 2); for (let j = by + 1; j < by + bh - 1; j++) if (j !== gap && j !== gap + 1) this.set(ix, j, T.WALL); }
    else if (bh >= 8 && chance(0.7)) { const iy = randi(by + 3, by + bh - 4); const gap = randi(bx + 1, bx + bw - 2); for (let i = bx + 1; i < bx + bw - 1; i++) if (i !== gap && i !== gap + 1) this.set(i, iy, T.WALL); }
    // a bit of fence/yard
    if (chance(0.4)) { const fy = by + bh + 1; for (let i = bx; i < bx + bw; i++) if (i !== bx + Math.floor(bw / 2) && this.get(i, fy) === T.GRASS) this.set(i, fy, T.FENCE); }
    this.buildings.push({ x: bx, y: by, w: bw, h: bh });
  }
  containerAt(tx, ty) { return this.containers.find(c => Math.floor(c.x / TILE) === tx && Math.floor(c.y / TILE) === ty); }
  addContainer(tx, ty, type) { this.containers.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, type, items: null, opened: false, searched: false, rot: rand(-0.15, 0.15) }); }
  nearestWalkable(tx, ty, avoidInterior) {
    for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = tx + dx, y = ty + dy; if (x < 1 || y < 1 || x >= this.w - 1 || y >= this.h - 1) continue;
      const t = this.get(x, y); if (!SOLID.has(t) && (!avoidInterior || t !== T.FLOOR)) return { x, y };
    }
    return { x: tx, y: ty };
  }
  // flood-fill from spawn; carve paths to unreachable extracts / fix isolated areas by converting water to mud bridges
  ensureConnectivity() {
    const reach = this.reachable(this.spawn.x, this.spawn.y);
    for (const e of this.extracts) {
      const ex = Math.floor(e.x / TILE), ey = Math.floor(e.y / TILE);
      if (!reach[this.idx(ex, ey)]) this.carve(this.spawn.x, this.spawn.y, ex, ey);
    }
    for (const b of this.buildings) { const cx = b.x + Math.floor(b.w / 2), cy = b.y + Math.floor(b.h / 2); if (!reach[this.idx(cx, cy)]) { const r2 = this.reachable(this.spawn.x, this.spawn.y); if (!r2[this.idx(cx, cy)]) this.carve(this.spawn.x, this.spawn.y, cx, cy); } }
    // drop enemy spawns / containers that are unreachable
    const r = this.reachable(this.spawn.x, this.spawn.y);
    this.enemySpawns = this.enemySpawns.filter(s => r[this.idx(Math.floor(s.x / TILE), Math.floor(s.y / TILE))]);
    this.containers = this.containers.filter(c => r[this.idx(Math.floor(c.x / TILE), Math.floor(c.y / TILE))]);
  }
  reachable(sx, sy) {
    const seen = new Uint8Array(this.w * this.h); const st = [[sx, sy]]; seen[this.idx(sx, sy)] = 1;
    while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue; const i = this.idx(nx, ny); if (seen[i] || this.solid(nx, ny)) continue; seen[i] = 1; st.push([nx, ny]); } }
    return seen;
  }
  carve(x0, y0, x1, y1) { // L-shaped path converting water->mud, trees->grass, walls (not building perimeters)->door
    let x = x0, y = y0;
    const step = (x, y) => { const t = this.get(x, y); if (t === T.WATER) this.set(x, y, T.MUD); else if (t === T.TREE || t === T.FENCE) this.set(x, y, T.GRASS); else if (t === T.WALL && x > 0 && y > 0 && x < this.w - 1 && y < this.h - 1) this.set(x, y, T.FLOOR); };
    while (x !== x1) { x += Math.sign(x1 - x); step(x, y); step(x, y + 1); }
    while (y !== y1) { y += Math.sign(y1 - y); step(x, y); step(x + 1, y); }
  }

  // --- collision: move a circle, sliding along tiles ---
  moveCircle(ent, dx, dy) {
    const r = ent.r;
    ent.x += dx; if (this.circleHits(ent.x, ent.y, r)) { ent.x -= dx; const s = Math.sign(dx); for (let i = 0; i < 4; i++) { if (!this.circleHits(ent.x + s * 0.5, ent.y, r)) ent.x += s * 0.5; else break; } }
    ent.y += dy; if (this.circleHits(ent.x, ent.y, r)) { ent.y -= dy; const s = Math.sign(dy); for (let i = 0; i < 4; i++) { if (!this.circleHits(ent.x, ent.y + s * 0.5, r)) ent.y += s * 0.5; else break; } }
  }
  circleHits(x, y, r) {
    const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE), y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!this.solid(tx, ty)) continue;
      const t = this.get(tx, ty);
      if (t === T.TREE) { if (dist(x, y, tx * TILE + TILE / 2, ty * TILE + TILE / 2) < r + 14) return true; continue; }
      const cx = clamp(x, tx * TILE, tx * TILE + TILE), cy = clamp(y, ty * TILE, ty * TILE + TILE);
      if ((cx - x) ** 2 + (cy - y) ** 2 < r * r) return true;
    }
    return false;
  }
  // --- raycast through opaque tiles; returns distance travelled (<= maxD) ---
  raycast(x, y, ang, maxD) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
    let tMaxX = dx !== 0 ? (((dx > 0 ? (tx + 1) * TILE : tx * TILE) - x) / dx) : 1e9;
    let tMaxY = dy !== 0 ? (((dy > 0 ? (ty + 1) * TILE : ty * TILE) - y) / dy) : 1e9;
    const tDX = dx !== 0 ? Math.abs(TILE / dx) : 1e9, tDY = dy !== 0 ? Math.abs(TILE / dy) : 1e9;
    let t = 0;
    for (let i = 0; i < 200; i++) {
      if (tMaxX < tMaxY) { t = tMaxX; tMaxX += tDX; tx += stepX; } else { t = tMaxY; tMaxY += tDY; ty += stepY; }
      if (t >= maxD) return maxD;
      if (this.opaque(tx, ty)) {
        if (this.get(tx, ty) === T.TREE) { // trees: canopy blocks sight when the ray passes through it
          const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2; const perp = Math.abs((cx - x) * dy - (cy - y) * dx);
          if (perp > 21) continue;
        }
        return t;
      }
    }
    return maxD;
  }
  los(x0, y0, x1, y1) { const d = dist(x0, y0, x1, y1); return this.raycast(x0, y0, Math.atan2(y1 - y0, x1 - x0), d) >= d - 0.01; }
  // bullet-level blocking: walls, trees (trunk), fences block bullets too
  bulletBlocked(px, py) { const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE); const t = this.get(tx, ty); if (t === T.WALL || t === T.FENCE) return true; if (t === T.TREE) return dist(px, py, tx * TILE + TILE / 2, ty * TILE + TILE / 2) < 15; return false; }

  // --- A* on tile grid (8-neighbour, no corner cutting) ---
  astar(sx, sy, tx, ty, maxNodes = 2500) {
    if (this.solid(tx, ty)) { const n = this.nearestWalkable(tx, ty, false); tx = n.x; ty = n.y; }
    if (sx === tx && sy === ty) return [];
    const W = this.w; const key = (x, y) => y * W + x;
    const g = new Map(), came = new Map(); const open = []; const closed = new Set();
    const h = (x, y) => Math.hypot(x - tx, y - ty);
    g.set(key(sx, sy), 0); open.push({ x: sx, y: sy, f: h(sx, sy) });
    let n = 0;
    while (open.length && n++ < maxNodes) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      const ck = key(cur.x, cur.y); if (closed.has(ck)) continue; closed.add(ck);
      if (cur.x === tx && cur.y === ty) { const path = []; let k = ck; while (came.has(k)) { path.push({ x: (k % W) * TILE + TILE / 2, y: Math.floor(k / W) * TILE + TILE / 2 }); k = came.get(k); } return path.reverse(); }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const nx = cur.x + dx, ny = cur.y + dy;
        if (this.solid(nx, ny)) continue; if (dx && dy && (this.solid(cur.x + dx, cur.y) || this.solid(cur.x, cur.y + dy))) continue;
        const nk = key(nx, ny); if (closed.has(nk)) continue;
        const cost = g.get(ck) + (dx && dy ? 1.414 : 1) + (this.get(nx, ny) === T.MUD ? 0.6 : 0) + (this.get(nx, ny) === T.FLOOR ? 0 : 0);
        if (cost < (g.get(nk) ?? 1e9)) { g.set(nk, cost); came.set(nk, ck); open.push({ x: nx, y: ny, f: cost + h(nx, ny) }); }
      }
    }
    return null;
  }
}
