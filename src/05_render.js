// ---------- rendering ----------
const R = {
  cv: null, ctx: null, fog: null, fctx: null, map: null, W: 0, H: 0, dpr: 1, scale: 1, cam: { x: 0, y: 0 }, shakeT: 0, shakeA: 0, flashes: [], flinchT: 0, mini: null, miniT: 0,
  init() {
    this.cv = document.getElementById('game'); this.ctx = this.cv.getContext('2d');
    this.fog = document.createElement('canvas'); this.fctx = this.fog.getContext('2d');
    window.addEventListener('resize', () => this.resize()); this.resize();
  },
  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1); this.W = window.innerWidth; this.H = window.innerHeight;
    this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr; this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
    this.fog.width = this.cv.width; this.fog.height = this.cv.height;
    // visible world width ~ 1150 units on desktop, tighter on phones
    this.scale = Math.max(this.W / 1150, this.H / 720) * this.dpr; if (IS_TOUCH && Math.min(this.W, this.H) < 700) this.scale = Math.min(this.W, this.H) / 560 * this.dpr;
  },
  prerenderMap(w) {
    const c = document.createElement('canvas'); c.width = w.w * TILE; c.height = w.h * TILE; const x = c.getContext('2d');
    const cols = { [T.GRASS]: '#5f8f3f', [T.WATER]: '#3f6fa8', [T.ROAD]: '#8b8068', [T.WALL]: '#4a4350', [T.FLOOR]: '#9a8a70', [T.TREE]: '#5f8f3f', [T.MUD]: '#6f6a3f', [T.FENCE]: '#5f8f3f' };
    for (let ty = 0; ty < w.h; ty++) for (let tx = 0; tx < w.w; tx++) {
      const t = w.get(tx, ty); const px = tx * TILE, py = ty * TILE; const hv = hash2(tx, ty);
      x.fillStyle = cols[t]; x.fillRect(px, py, TILE, TILE);
      if (t === T.GRASS || t === T.TREE || t === T.FENCE) { x.fillStyle = hv < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'; x.fillRect(px, py, TILE, TILE); x.fillStyle = 'rgba(40,90,30,0.35)'; for (let i = 0; i < 3; i++) { const gx = px + hash2(tx * 7 + i, ty) * TILE, gy = py + hash2(tx, ty * 5 + i) * TILE; x.fillRect(gx, gy, 3, 6); } }
      if (t === T.WATER) { x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(px + 6, py + 10 + hv * 20, 22, 3); const nb = [w.get(tx - 1, ty), w.get(tx + 1, ty), w.get(tx, ty - 1), w.get(tx, ty + 1)].some(n => n !== T.WATER && n !== T.WALL); if (nb) { x.strokeStyle = 'rgba(200,230,255,0.35)'; x.lineWidth = 3; x.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3); } }
      if (t === T.MUD) { x.fillStyle = 'rgba(0,0,0,0.12)'; x.beginPath(); x.ellipse(px + 24, py + 24, 14, 9, hv * 3, 0, TAU); x.fill(); }
      if (t === T.ROAD) { x.fillStyle = 'rgba(0,0,0,0.08)'; if (hv < 0.3) x.fillRect(px + hv * 30, py + 20, 10, 4); }
      if (t === T.FLOOR) { x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 1; for (let i = 0; i < 4; i++) x.strokeRect(px + 0.5, py + i * 12 + 0.5, TILE - 1, 12); }
    }
    // walls drawn with top highlight & outline; fences; trees last (canopies overlap)
    for (let ty = 0; ty < w.h; ty++) for (let tx = 0; tx < w.w; tx++) {
      const t = w.get(tx, ty); const px = tx * TILE, py = ty * TILE;
      if (t === T.WALL) { x.fillStyle = '#4a4350'; x.fillRect(px, py, TILE, TILE); x.fillStyle = '#6a6272'; x.fillRect(px + 4, py + 4, TILE - 8, TILE - 8); x.strokeStyle = '#2a2530'; x.lineWidth = 3; x.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3); }
      if (t === T.FENCE) { x.fillStyle = '#7a5a3a'; x.fillRect(px, py + 18, TILE, 6); x.fillRect(px, py + 30, TILE, 6); x.fillRect(px + 8, py + 10, 8, 30); x.fillRect(px + 32, py + 10, 8, 30); x.strokeStyle = '#3a2a1a'; x.lineWidth = 2; x.strokeRect(px + 8, py + 10, 8, 30); x.strokeRect(px + 32, py + 10, 8, 30); }
    }
    for (let ty = 0; ty < w.h; ty++) for (let tx = 0; tx < w.w; tx++) {
      if (w.get(tx, ty) !== T.TREE) continue; const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2; const hv = hash2(tx, ty); const rr = 22 + hv * 8;
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(cx + 6, cy + 8, rr, rr * 0.8, 0, 0, TAU); x.fill();
      x.fillStyle = hv < 0.5 ? '#3f7a2f' : '#4a8a35'; x.strokeStyle = '#1e3f15'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, rr, 0, TAU); x.fill(); x.stroke();
      x.fillStyle = 'rgba(255,255,255,0.12)'; x.beginPath(); x.arc(cx - rr * 0.3, cy - rr * 0.3, rr * 0.45, 0, TAU); x.fill();
    }
    this.map = c;
  },
  shake(a) { this.shakeA = Math.min(14, this.shakeA + a); },
  flinch(t) { this.flinchT = Math.max(this.flinchT, t); },
  worldToScreen(x, y) { return [(x - this.cam.x) * this.scale + this.cv.width / 2, (y - this.cam.y) * this.scale + this.cv.height / 2]; },
  screenToWorld(sx, sy) { return [(sx * this.dpr - this.cv.width / 2) / this.scale + this.cam.x, (sy * this.dpr - this.cv.height / 2) / this.scale + this.cam.y]; },

  drawDuck(x, e, col, beak, big) {
    const r = e.r; x.save(); x.translate(e.x, e.y);
    // shadow
    x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(3, 5, r + 2, r * 0.8, 0, 0, TAU); x.fill();
    x.rotate(e.ang);
    // gun
    const wid = e instanceof Player ? (e.weapon && e.weapon.id) : e.weaponId;
    if (wid) { const wd = ITEMS[wid]; const L = wid === 'pistol' ? 18 : wid === 'smg' ? 24 : wid === 'dmr' ? 40 : 32; x.fillStyle = '#222'; x.fillRect(r - 4, -3.5, L, 7); x.fillStyle = wd.col; x.fillRect(r - 2, -2.5, L - 4, 5); }
    // hands
    x.fillStyle = beak; x.strokeStyle = '#2a1a0a'; x.lineWidth = 2.5;
    x.beginPath(); x.arc(r - 2, -8, 5.5, 0, TAU); x.fill(); x.stroke(); x.beginPath(); x.arc(r + 6, 2, 5.5, 0, TAU); x.fill(); x.stroke();
    // body
    x.fillStyle = col; x.strokeStyle = '#1d1a16'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, r, 0, TAU); x.fill(); x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.arc(-r * 0.3, -r * 0.3, r * 0.5, 0, TAU); x.fill();
    // beak + eyes
    x.fillStyle = beak; x.strokeStyle = '#2a1a0a'; x.lineWidth = 2; x.beginPath(); x.moveTo(r * 0.45, -6); x.lineTo(r + 7, 0); x.lineTo(r * 0.45, 6); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#111'; x.beginPath(); x.arc(r * 0.35, -7, 2.6, 0, TAU); x.arc(r * 0.35, 7, 2.6, 0, TAU); x.fill();
    if (big) { x.fillStyle = '#222'; x.fillRect(-r * 0.6, -r - 6, r * 1.2, 6); x.fillRect(-r * 0.35, -r - 14, r * 0.7, 9); } // boss hat
    x.restore();
  },
  drawContainer(x, c) {
    const d = CONTAINER_DEF[c.type]; x.save(); x.translate(c.x, c.y); x.rotate(c.rot);
    x.fillStyle = 'rgba(0,0,0,0.28)'; x.beginPath(); x.ellipse(3, 5, d.w / 2 + 3, d.h / 2 + 2, 0, 0, TAU); x.fill();
    if (c.type === 'body') { // dead duck
      const col = c.who ? ENEMY_TYPES[c.who].col : '#888'; x.fillStyle = col; x.strokeStyle = '#1d1a16'; x.lineWidth = 3; x.beginPath(); x.ellipse(0, 0, 17, 13, 0, 0, TAU); x.fill(); x.stroke();
      x.fillStyle = '#d08030'; x.beginPath(); x.moveTo(10, -5); x.lineTo(24, 0); x.lineTo(10, 5); x.closePath(); x.fill(); x.stroke();
      x.strokeStyle = '#111'; x.lineWidth = 2; x.beginPath(); x.moveTo(2, -7); x.lineTo(8, -1); x.moveTo(8, -7); x.lineTo(2, -1); x.moveTo(2, 7); x.lineTo(8, 1); x.moveTo(8, 7); x.lineTo(2, 1); x.stroke();
      if (c.searched) { x.globalAlpha = 0.5; }
    } else {
      x.fillStyle = d.col; x.strokeStyle = '#1d1a16'; x.lineWidth = 3; x.fillRect(-d.w / 2, -d.h / 2, d.w, d.h); x.strokeRect(-d.w / 2, -d.h / 2, d.w, d.h);
      if (c.type === 'crate') { x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(-d.w / 2, -d.h / 2); x.lineTo(d.w / 2, d.h / 2); x.moveTo(d.w / 2, -d.h / 2); x.lineTo(-d.w / 2, d.h / 2); x.stroke(); }
      if (c.type === 'medbox') { x.fillStyle = '#d03030'; x.fillRect(-3, -8, 6, 16); x.fillRect(-8, -3, 16, 6); }
      if (c.type === 'safe') { x.strokeStyle = '#aaa'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 7, 0, TAU); x.stroke(); }
      if (c.type === 'locker') { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(-1, -d.h / 2 + 4, 2, d.h - 8); x.fillRect(4, -2, 5, 4); }
      if (c.type === 'weaponbox') { x.fillStyle = '#6a7a5a'; x.fillRect(-d.w / 2 + 4, -3, d.w - 8, 6); }
      if (c.type === 'scrap') { x.fillStyle = '#8a8a7a'; x.beginPath(); x.arc(-8, -4, 7, 0, TAU); x.arc(6, 5, 9, 0, TAU); x.arc(9, -8, 5, 0, TAU); x.fill(); }
      if (c.opened) { x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(-d.w / 2 + 3, -d.h / 2 + 3, d.w - 6, d.h - 6); }
    }
    x.restore();
    if (c.searched) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.font = 'bold 11px sans-serif'; x.textAlign = 'center'; x.fillText('empty', c.x, c.y - d.h / 2 - 6); }
  },

  frame(dt) {
    const x = this.ctx, g = G, p = g.player, w = g.world; const cw = this.cv.width, ch = this.cv.height;
    // camera
    const [mxw, myw] = this.screenToWorld(g.input.mouse.x, g.input.mouse.y);
    const lookX = IS_TOUCH ? Math.cos(p.ang) * 90 : clamp((mxw - p.x) * 0.25, -140, 140), lookY = IS_TOUCH ? Math.sin(p.ang) * 90 : clamp((myw - p.y) * 0.25, -140, 140);
    this.cam.x = lerp(this.cam.x, p.x + lookX, 1 - Math.pow(0.001, dt)); this.cam.y = lerp(this.cam.y, p.y + lookY, 1 - Math.pow(0.001, dt));
    this.shakeA *= Math.pow(0.02, dt); const shx = (Math.random() - 0.5) * this.shakeA, shy = (Math.random() - 0.5) * this.shakeA;
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#1a2a14'; x.fillRect(0, 0, cw, ch);
    x.setTransform(this.scale, 0, 0, this.scale, cw / 2 - (this.cam.x + shx) * this.scale, ch / 2 - (this.cam.y + shy) * this.scale);
    // visible world bounds
    const vw = cw / this.scale, vh = ch / this.scale; const vx0 = this.cam.x - vw / 2 - 60, vy0 = this.cam.y - vh / 2 - 60, vx1 = this.cam.x + vw / 2 + 60, vy1 = this.cam.y + vh / 2 + 60;
    const inView = (ex, ey, m = 0) => ex > vx0 - m && ex < vx1 + m && ey > vy0 - m && ey < vy1 + m;
    // map
    const sx = clamp(Math.floor(vx0), 0, this.map.width), sy = clamp(Math.floor(vy0), 0, this.map.height), ex2 = clamp(Math.ceil(vx1), 0, this.map.width), ey2 = clamp(Math.ceil(vy1), 0, this.map.height);
    if (ex2 > sx && ey2 > sy) x.drawImage(this.map, sx, sy, ex2 - sx, ey2 - sy, sx, sy, ex2 - sx, ey2 - sy);
    // extracts
    for (const e of w.extracts) { if (!inView(e.x, e.y, 100)) continue; const open = g.extractOpen(e); x.save(); x.strokeStyle = open ? 'rgba(90,255,120,0.9)' : 'rgba(255,90,90,0.7)'; x.fillStyle = open ? 'rgba(90,255,120,0.12)' : 'rgba(255,90,90,0.06)'; x.lineWidth = 4; x.setLineDash([14, 10]); x.lineDashOffset = -g.time * 40; x.beginPath(); x.arc(e.x, e.y, e.r, 0, TAU); x.fill(); x.stroke(); x.restore(); x.fillStyle = open ? '#9f9' : '#f99'; x.font = 'bold 14px sans-serif'; x.textAlign = 'center'; x.fillText(e.name.toUpperCase(), e.x, e.y - e.r - 10); x.font = '12px sans-serif'; x.fillText(open ? 'EXTRACT' : (g.time < e.openAt ? 'opens ' + fmtTime(e.openAt - g.time) : 'CLOSED'), e.x, e.y + 5); }
    // containers
    for (const c of w.containers) if (inView(c.x, c.y)) this.drawContainer(x, c);
    // particles (feathers)
    for (const pt of g.particles) { x.globalAlpha = clamp(pt.life / pt.max, 0, 1); x.fillStyle = pt.col; x.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size); } x.globalAlpha = 1;
    // bullets
    x.lineCap = 'round'; for (const b of g.bullets) { x.strokeStyle = b.owner instanceof Player ? '#fff0a0' : '#ffb0a0'; x.lineWidth = 3; x.beginPath(); x.moveTo(b.px, b.py); x.lineTo(b.x, b.y); x.stroke(); }
    // enemies (only when seen)
    for (const e of g.enemies) { if (e.dead || !inView(e.x, e.y)) continue; if (!g.canPlayerSee(e)) continue; this.drawDuck(x, e, e.d.col, e.d.beak, e.d.big); }
    // player
    if (!p.dead) this.drawDuck(x, p, '#f2d84a', '#f08a30', false);
    // sound pings (heard but unseen)
    for (const pg of g.pings) { const a = pg.t / pg.max; x.strokeStyle = pg.shot ? `rgba(255,120,80,${a * 0.9})` : `rgba(255,255,255,${a * 0.5})`; x.lineWidth = pg.shot ? 4 : 2; x.beginPath(); x.arc(pg.x, pg.y, (1 - a) * (pg.shot ? 90 : 36) + 6, 0, TAU); x.stroke(); }
    // muzzle flashes in world
    for (const f of this.flashes) { x.fillStyle = `rgba(255,220,120,${f.t / 0.06})`; x.beginPath(); x.arc(f.x, f.y, 14, 0, TAU); x.fill(); }
    // interaction prompt
    const near = g.nearestContainer(); if (near && !p.searching && !g.ui.lootOpen) { const d = CONTAINER_DEF[near.type]; x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(near.x - 60, near.y - d.h / 2 - 32, 120, 20); x.fillStyle = '#fff'; x.font = 'bold 12px sans-serif'; x.textAlign = 'center'; x.fillText((IS_TOUCH ? 'TAP' : '[E]') + ' ' + (near.searched ? 'Open ' : 'Search ') + d.name, near.x, near.y - d.h / 2 - 18); }
    if (p.searching) { const c = p.searching.c; const t = p.searching.t / CONTAINER_DEF[c.type].time; x.fillStyle = '#000a'; x.fillRect(c.x - 30, c.y + 28, 60, 8); x.fillStyle = '#ffd04a'; x.fillRect(c.x - 30, c.y + 28, 60 * t, 8); }
    // fog of war
    this.drawFog(p, w);
    // HUD
    this.drawHUD(p, w, g);
    this.flashes = this.flashes.filter(f => (f.t -= dt) > 0);
  },
  drawFog(p, w) {
    const f = this.fctx, cw = this.cv.width, ch = this.cv.height;
    f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-over'; f.fillStyle = G.cfg.fog || 'rgba(4,6,14,0.93)'; f.fillRect(0, 0, cw, ch);
    f.globalCompositeOperation = 'destination-out';
    const [psx, psy] = this.worldToScreen(p.x, p.y);
    const shortR = G.VIEW_SHORT, longR = G.VIEW_LONG, half = G.CONE_HALF;
    const poly = (rays, radius) => { f.beginPath(); f.moveTo(psx, psy); for (const [a, d] of rays) { const [sx, sy] = this.worldToScreen(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d); f.lineTo(sx, sy); } f.closePath(); const gr = f.createRadialGradient(psx, psy, 0, psx, psy, radius * this.scale); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.92)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); f.fillStyle = gr; f.fill(); };
    this.flinchT = Math.max(0, this.flinchT - 1 / 60);
    if (!p.dead) {
      const fl = 1 - 0.45 * Math.min(1, this.flinchT / 0.35);
      if (p.light) { // flashlight cone: dense rays, walls/trees cast shadows
        const rays2 = []; const N2 = 160; const LR = longR * fl; for (let i = 0; i <= N2; i++) { const a = p.ang - half + i / N2 * half * 2; rays2.push([a, w.raycast(p.x, p.y, a, LR) + 6]); } poly(rays2, LR * 1.02);
        if (G.explored && (G.frameN & 3) === 0) { const ex = G.explored, W = w.w; for (let i = 0; i < rays2.length; i += 2) { const [a, d] = rays2[i]; for (let t = 0; t < d; t += TILE * 0.6) { const tx = Math.floor((p.x + Math.cos(a) * t) / TILE), ty = Math.floor((p.y + Math.sin(a) * t) / TILE); ex[ty * W + tx] = 1; } } }
      }
      // small ambient glow around the player (you can always see your feet)
      const rays1 = []; const N1 = 72; const SR = shortR * (p.light ? 1 : 1.15); for (let i = 0; i <= N1; i++) { const a = i / N1 * TAU; rays1.push([a, w.raycast(p.x, p.y, a, SR) + 6]); }
      f.beginPath(); f.moveTo(psx, psy); for (const [a, d] of rays1) { const [sx, sy] = this.worldToScreen(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d); f.lineTo(sx, sy); } f.closePath();
      const gr = f.createRadialGradient(psx, psy, 0, psx, psy, SR * this.scale); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); f.fillStyle = gr; f.fill();
      if (G.explored) { const ex = G.explored, W = w.w, tx0 = Math.floor(p.x / TILE), ty0 = Math.floor(p.y / TILE); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) ex[(ty0 + dy) * W + tx0 + dx] = 1; }
    }
    // muzzle flashes light up surroundings
    for (const fl of this.flashes) { const [sx, sy] = this.worldToScreen(fl.x, fl.y); const gr = f.createRadialGradient(sx, sy, 0, sx, sy, 130 * this.scale); gr.addColorStop(0, `rgba(0,0,0,${fl.t / 0.06 * 0.9})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); f.fillStyle = gr; f.beginPath(); f.arc(sx, sy, 130 * this.scale, 0, TAU); f.fill(); }
    // extract beacons faintly visible
    for (const e of w.extracts) { if (!G.extractOpen(e)) continue; const [sx, sy] = this.worldToScreen(e.x, e.y); const gr = f.createRadialGradient(sx, sy, 0, sx, sy, 110 * this.scale); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); f.fillStyle = gr; f.beginPath(); f.arc(sx, sy, 110 * this.scale, 0, TAU); f.fill(); }
    const x = this.ctx; x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(this.fog, 0, 0);
  },
  drawHUD(p, w, g) {
    const x = this.ctx; const d = this.dpr; x.setTransform(d, 0, 0, d, 0, 0); const W = this.W, H = this.H;
    // damage vignette / low hp
    if (p.hurtT > 0 || p.hp < 35) { const a = Math.min(0.7, p.hurtT * 1.5 + (p.hp < 35 ? (0.35 - p.hp / 100) * (0.7 + 0.3 * Math.sin(g.time * 6)) : 0)); const gr = x.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8); gr.addColorStop(0, 'rgba(120,0,0,0)'); gr.addColorStop(1, `rgba(140,0,0,${a})`); x.fillStyle = gr; x.fillRect(0, 0, W, H); }
    const pad = 14; const exH = 16 * w.extracts.length + 10; const bottom = IS_TOUCH ? 10 + exH + 66 : H - 24; const wTop = IS_TOUCH ? 50 + 56 : bottom;
    // health & armor & stamina
    x.font = 'bold 13px sans-serif'; x.textAlign = 'left';
    const bar = (bx, by, bw, bh, t, col, label, bg = '#000a') => { x.fillStyle = bg; x.fillRect(bx, by, bw, bh); x.fillStyle = col; x.fillRect(bx + 2, by + 2, (bw - 4) * clamp(t, 0, 1), bh - 4); x.fillStyle = '#fff'; x.fillText(label, bx + 8, by + bh - 6); };
    bar(pad, bottom - 56, 220, 22, p.hp / p.maxHp, p.hp < 35 ? '#e03030' : '#d04848', `HP ${Math.ceil(p.hp)}` + (p.bleed ? '   ⚠ BLEEDING' : ''));
    if (p.armor) bar(pad, bottom - 30, 220, 12, p.armor.dur / ITEMS[p.armor.id].dur, '#4a7ad0', '');
    bar(pad, bottom - 14, 220, 8, p.stamina / 100, '#d0c040', '');
    // weapon
    x.textAlign = 'right'; x.fillStyle = '#000a'; x.fillRect(W - pad - 230, wTop - 56, 230, 50);
    if (p.weapon) { const wd = p.wdef; x.fillStyle = '#fff'; x.font = 'bold 16px sans-serif'; x.fillText(wd.name, W - pad - 10, wTop - 34); x.font = 'bold 18px sans-serif';
      let mag; const ratio = p.weapon.ammo / wd.mag; if (p.reloadT > 0) mag = 'RELOADING'; else if (p.checkT > 0) mag = ratio === 0 ? 'EMPTY' : ratio < 0.2 ? 'NEARLY EMPTY' : ratio < 0.45 ? 'LESS THAN HALF' : ratio < 0.7 ? 'ABOUT HALF' : ratio < 1 ? 'NEARLY FULL' : 'FULL'; else if (p.magInfo === 'full') mag = 'FULL MAG'; else if (p.magInfo === 'empty') mag = 'EMPTY'; else if (p.magInfo === 'partial') mag = 'PARTIAL MAG'; else mag = '?';
      x.fillStyle = mag === 'EMPTY' || mag === 'NEARLY EMPTY' ? '#f66' : '#ffd04a'; x.fillText(mag, W - pad - 10, wTop - 12); x.font = '11px sans-serif'; x.fillStyle = '#bbb'; x.fillText(`${p.reserveAmmo(wd.ammo)} spare` + (IS_TOUCH || p.checkT > 0 ? '' : '  ·  [C] check mag'), W - pad - 10, wTop + 8 + (IS_TOUCH ? 14 : 0)); }
    else { x.fillStyle = '#f88'; x.font = 'bold 16px sans-serif'; x.fillText('UNARMED', W - pad - 10, wTop - 24); }
    const other = p.weapons[1 - p.wi]; if (other) { x.font = '11px sans-serif'; x.fillStyle = '#bbb'; x.fillText((IS_TOUCH ? '' : '[Q] ') + ITEMS[other.id].name, W - pad - 10, wTop + (IS_TOUCH ? 8 : -60)); }
    if (!p.light) { x.font = 'bold 11px sans-serif'; x.fillStyle = '#9ab'; x.fillText('FLASHLIGHT OFF', W - pad - 10, wTop + (IS_TOUCH ? 36 : 22)); }
    if (p.reloadT > 0) { const wd = p.wdef; x.fillStyle = '#ffd04a'; x.fillRect(W - pad - 230, wTop - 6, 230 * (1 - p.reloadT / wd.reload), 3); }
    if (p.useItem) { x.fillStyle = '#000a'; x.fillRect(W / 2 - 80, H / 2 + 50, 160, 22); x.fillStyle = '#6f6'; x.fillRect(W / 2 - 78, H / 2 + 52, 156 * (1 - p.useT / ITEMS[p.useItem.id].time), 18); x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = 'bold 12px sans-serif'; x.fillText('Using ' + ITEMS[p.useItem.id].name, W / 2, H / 2 + 66); }
    // timer & extracts
    x.textAlign = 'center'; x.fillStyle = '#000a'; x.fillRect(W / 2 - 60, 10, 120, 30); x.fillStyle = g.timeLeft < 60 ? '#f66' : '#fff'; x.font = 'bold 20px sans-serif'; x.fillText(fmtTime(g.timeLeft), W / 2, 33);
    x.textAlign = 'left'; x.font = 'bold 12px sans-serif'; let ey = 18;
    x.fillStyle = '#000a'; x.fillRect(pad, 10, 210, 16 * w.extracts.length + 10);
    for (const e of w.extracts) { const open = g.extractOpen(e); x.fillStyle = open ? '#8f8' : '#f99'; x.fillText(`${open ? '●' : '○'} ${e.name}  ${open ? 'OPEN' : (g.time < e.openAt ? fmtTime(e.openAt - g.time) : 'closed')}`, pad + 8, ey + 4); ey += 16; }
    // compass arrows for open extracts
    for (const e of w.extracts) { if (!g.extractOpen(e)) continue; const [sx, sy] = this.worldToScreen(e.x, e.y); const fx = sx / d, fy = sy / d; if (fx > 0 && fx < W && fy > 0 && fy < H) continue; const a = Math.atan2(e.y - p.y, e.x - p.x); const rr = Math.min(W, H) * 0.42; const ax = W / 2 + Math.cos(a) * rr, ay = H / 2 + Math.sin(a) * rr; x.save(); x.translate(ax, ay); x.rotate(a); x.fillStyle = 'rgba(90,255,120,0.85)'; x.beginPath(); x.moveTo(12, 0); x.lineTo(-8, -8); x.lineTo(-8, 8); x.closePath(); x.fill(); x.restore(); x.fillStyle = '#9f9'; x.font = '10px sans-serif'; x.textAlign = 'center'; x.fillText(Math.round(dist(p.x, p.y, e.x, e.y) / TILE) + 'm', ax, ay + 22); }
    // extraction progress
    if (p.extracting) { x.fillStyle = '#000a'; x.fillRect(W / 2 - 150, H / 2 - 120, 300, 40); x.fillStyle = '#3c3'; x.fillRect(W / 2 - 146, H / 2 - 116, 292 * (p.extracting.t / 6), 32); x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = 'bold 16px sans-serif'; x.fillText('EXTRACTING… stay in the zone', W / 2, H / 2 - 96); }
    // kills / loot
    x.textAlign = 'right'; x.font = 'bold 12px sans-serif'; x.fillStyle = '#000a'; x.fillRect(W - pad - 150, 10, 150, 36); x.fillStyle = '#fff'; x.fillText(`Kills ${p.kills}`, W - pad - 8, 24); x.fillStyle = '#ffd04a'; x.fillText(`Loot ${fmtMoney(g.carriedValue())}  ${p.inv.length}/${p.capacity}`, W - pad - 8, 40);
    // toasts
    x.textAlign = 'center'; let ty = IS_TOUCH ? H * 0.5 - 90 : H * 0.72; for (const t of g.toasts) { x.globalAlpha = clamp(t.t, 0, 1); x.fillStyle = '#000b'; const tw = x.measureText(t.msg).width + 24; x.fillRect(W / 2 - tw / 2, ty - 16, tw, 24); x.fillStyle = '#ffe'; x.font = 'bold 14px sans-serif'; x.fillText(t.msg, W / 2, ty + 1); ty -= 30; } x.globalAlpha = 1;
    // crosshair
    if (!IS_TOUCH && !p.dead) { const m = g.input.mouse; x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.beginPath(); x.arc(m.x, m.y, 7, 0, TAU); x.stroke(); x.fillStyle = '#fff'; x.fillRect(m.x - 1, m.y - 1, 2, 2); }
    // minimap (explored area only, no enemies)
    if (!UI.mapOpen) this.drawMinimap(x, W, H, p, w, g);
    if (UI.mapOpen) this.drawFullMap(x, W, H, p, w, g);
    if (IS_TOUCH) g.ui.drawTouch(x, W, H);
  },
  // explored map composite at 6px per tile, refreshed every 0.5s
  exploredMap(w) {
    const S = 6; if (!this.mini || this.mini.width !== w.w * S) { this.mini = document.createElement('canvas'); this.mini.width = w.w * S; this.mini.height = w.h * S; this.mask = document.createElement('canvas'); this.mask.width = w.w; this.mask.height = w.h; }
    const m = this.mini.getContext('2d'); m.globalCompositeOperation = 'source-over'; m.clearRect(0, 0, this.mini.width, this.mini.height); m.drawImage(this.map, 0, 0, this.mini.width, this.mini.height);
    const mk2 = this.mask.getContext('2d'); const img = mk2.createImageData(w.w, w.h); const ex = G.explored; for (let i = 0; i < ex.length; i++) { img.data[i * 4 + 3] = ex[i] ? 255 : 0; } mk2.putImageData(img, 0, 0);
    m.globalCompositeOperation = 'destination-in'; m.imageSmoothingEnabled = false; m.drawImage(this.mask, 0, 0, this.mini.width, this.mini.height); m.globalCompositeOperation = 'source-over';
    return S;
  },
  drawMinimap(x, W, H, p, w, g) {
    this.miniT -= 1 / 60; if (this.miniT <= 0 || !this.mini) { this.miniT = 0.5; this.exploredMap(w); }
    const size = IS_TOUCH ? 110 : 150, S = 6, px = W - size - 14, py = IS_TOUCH ? 190 : 56; const view = 14; // tiles radius
    x.save(); x.fillStyle = '#000c'; x.fillRect(px - 3, py - 3, size + 6, size + 6); x.beginPath(); x.rect(px, py, size, size); x.clip();
    const sc = size / (view * 2 * S); x.translate(px + size / 2, py + size / 2); x.scale(sc, sc); x.translate(-p.x / TILE * S, -p.y / TILE * S);
    x.imageSmoothingEnabled = true; x.drawImage(this.mini, 0, 0);
    for (const m of g.objectiveMarkers()) { const mx = m.x / TILE * S, my = m.y / TILE * S; x.fillStyle = m.col; x.beginPath(); x.arc(mx, my, 7, 0, TAU); x.fill(); x.strokeStyle = '#000'; x.lineWidth = 2; x.stroke(); }
    x.translate(p.x / TILE * S, p.y / TILE * S); x.rotate(p.ang); x.fillStyle = '#f2d84a'; x.beginPath(); x.moveTo(10, 0); x.lineTo(-6, -6); x.lineTo(-6, 6); x.closePath(); x.fill();
    x.restore(); x.strokeStyle = '#fff6'; x.lineWidth = 1; x.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    x.fillStyle = '#9ab'; x.font = '10px sans-serif'; x.textAlign = 'right'; x.fillText(IS_TOUCH ? 'map' : '[M] map', px + size - 4, py + size + 12);
  },
  drawFullMap(x, W, H, p, w, g) {
    const S = this.exploredMap(w); const margin = 40; const sc = Math.min((W - margin * 2) / this.mini.width, (H - margin * 2) / this.mini.height);
    x.save(); x.fillStyle = 'rgba(5,8,12,0.92)'; x.fillRect(0, 0, W, H);
    const ox = (W - this.mini.width * sc) / 2, oy = (H - this.mini.height * sc) / 2; x.translate(ox, oy); x.scale(sc, sc);
    x.fillStyle = '#0d1510'; x.fillRect(0, 0, this.mini.width, this.mini.height); x.drawImage(this.mini, 0, 0);
    x.strokeStyle = '#fff3'; x.lineWidth = 1 / sc; x.strokeRect(0, 0, this.mini.width, this.mini.height);
    const F = 12 / sc; x.font = `bold ${F}px sans-serif`; x.textAlign = 'center';
    for (const m of g.objectiveMarkers()) { const mx = m.x / TILE * S, my = m.y / TILE * S; x.fillStyle = m.col; x.beginPath(); x.arc(mx, my, 6 / sc, 0, TAU); x.fill(); x.strokeStyle = '#000'; x.lineWidth = 2 / sc; x.stroke(); x.fillStyle = '#fff'; x.strokeStyle = '#000a'; x.lineWidth = 3 / sc; x.strokeText(m.label, mx, my - 10 / sc); x.fillText(m.label, mx, my - 10 / sc); }
    x.translate(p.x / TILE * S, p.y / TILE * S); x.rotate(p.ang); x.fillStyle = '#f2d84a'; x.strokeStyle = '#000'; x.lineWidth = 2 / sc; x.beginPath(); x.moveTo(12 / sc, 0); x.lineTo(-8 / sc, -8 / sc); x.lineTo(-8 / sc, 8 / sc); x.closePath(); x.fill(); x.stroke();
    x.restore();
    x.fillStyle = '#fff'; x.font = 'bold 16px sans-serif'; x.textAlign = 'center'; x.fillText(`${g.cfg.name} — ${fmtTime(g.timeLeft)} left`, W / 2, 26);
    x.font = '12px sans-serif'; x.fillStyle = '#9ab'; x.fillText(IS_TOUCH ? 'tap map button to close' : 'M or Esc to close · the raid keeps running', W / 2, H - 14);
  },
};
