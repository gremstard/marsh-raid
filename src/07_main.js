// ---------- game core: state, input, loop, persistence ----------
const SAVE_KEY = 'marshraid_save_v1';
const G = {
  VIEW_SHORT: 3.2 * TILE, VIEW_LONG: 14 * TILE, CONE_HALF: 0.62,
  state: 'hub', save: null, world: null, player: null, enemies: [], bullets: [], particles: [], pings: [], toasts: [], time: 0, timeLeft: 0, cfg: null, ui: UI,
  input: { keys: new Set(), mouse: { x: 0, y: 0, down: false, wasDown: false }, sprintToggle: false, edge: {} },
  init() {
    R.init(); UI.init(); this.load(); this.bindInput(); UI.hub();
    this.last = performance.now(); requestAnimationFrame(ts => this.loop(ts));
  },
  // ----- persistence -----
  newSave() {
    this.save = { money: 900, stash: [mk('ammo_9', 36), mk('bandage', 2), mk('painkiller', 1)], loadout: { w1: mk('pistol'), w2: null, armor: null, bag: null, carry: [mk('ammo_9', 24), mk('bandage', 1)] }, xp: 0, stats: { raids: 0, extracts: 0, deaths: 0, kills: 0, earned: 0 }, quests: { progress: {}, done: [] }, unlocks: [] };
    this.persist();
  },
  load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.loadout && s.stats) { s.quests = s.quests || { progress: {}, done: [] }; s.unlocks = s.unlocks || []; this.save = s; return; } } catch (e) { } this.newSave(); },
  persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (e) { } },
  level() { return Math.floor(Math.sqrt(this.save.xp / 100)); },
  xpGain(n) { this.save.xp += n; this.raidXp = (this.raidXp || 0) + n; },
  // ----- raid lifecycle -----
  startRaid(mapId) {
    SFX.init(); SFX.startAmbient();
    const cfg = MAPS[mapId]; this.cfg = cfg; this.mapId = mapId; const L = this.save.loadout;
    const seed = Math.floor(Math.random() * 1e9); this.world = new World(cfg, seed); R.prerenderMap(this.world); this.explored = new Uint8Array(this.world.w * this.world.h); this.frameN = 0; R.mini = null; UI.mapOpen = false;
    const sp = this.world.spawn; this.player = new Player(sp.x * TILE + TILE / 2, sp.y * TILE + TILE / 2, { w1: L.w1 && { ...L.w1 }, w2: L.w2 && { ...L.w2 }, armor: L.armor && { ...L.armor }, bag: L.bag && { ...L.bag }, carry: L.carry });
    this.player.ang = Math.atan2(this.world.h / 2 * TILE - this.player.y, this.world.w / 2 * TILE - this.player.x);
    R.cam.x = this.player.x; R.cam.y = this.player.y;
    // spawn enemies
    this.enemies = []; this.bullets = []; this.particles = []; this.pings = []; this.toasts = []; this.time = 0; this.timeLeft = cfg.time; this.raidXp = 0; this.startValue = this.carriedValue();
    const spawns = this.world.enemySpawns.slice().sort(() => Math.random() - 0.5);
    const far = s => dist(s.x, s.y, this.player.x, this.player.y);
    const bldg = spawns.filter(s => s.home), roam = spawns.filter(s => !s.home);
    if (cfg.boss) { const b = bldg.slice().sort((a, b2) => far(b2) - far(a))[0]; if (b) { this.enemies.push(new Enemy(b.x, b.y, 'boss', b.home)); bldg.splice(bldg.indexOf(b), 1); this.enemies.push(new Enemy(b.x + 50, b.y, 'guard', b.home), new Enemy(b.x - 50, b.y, 'guard', b.home)); } }
    for (let i = 0; i < cfg.guards; i++) { const s = bldg.length ? bldg.splice(Math.floor(Math.random() * bldg.length), 1)[0] : roam.pop(); if (s) this.enemies.push(new Enemy(s.x, s.y, 'guard', s.home)); }
    for (let i = 0; i < cfg.scavs; i++) { const pool = (i % 2 === 0 && bldg.length) ? bldg : roam; const s = pool.length ? pool.splice(Math.floor(Math.random() * pool.length), 1)[0] : null; if (s) this.enemies.push(new Enemy(s.x + rand(-30, 30), s.y + rand(-30, 30), 'scav', s.home)); }
    this.save.stats.raids++; this.persist();
    this.state = 'raid'; UI.hide(); this.toast(cfg.name); setTimeout(() => this.toast('Stay quiet. Watch the rings.'), 2500);
  },
  extractOpen(e) { return this.time >= e.openAt && this.time < e.closeAt; },
  carriedValue() { const p = this.player; if (!p) return 0; let v = p.inv.reduce((a, i) => a + itemValue(i), 0); for (const wp of p.weapons) if (wp) v += itemValue(wp); if (p.armor) v += itemValue(p.armor); if (p.bag) v += itemValue(p.bag); return v; },
  extract(e) {
    if (this.state !== 'raid') return; const p = this.player; p.extracting = null; R.flashes = []; const items = [...p.inv, ...p.weapons.filter(Boolean)]; if (p.armor) items.push(p.armor); if (p.bag) items.push(p.bag);
    const value = this.carriedValue(); const xp = 100 + Math.round(Math.max(0, value - this.startValue) / 25) + p.kills * 5; this.xpGain(xp);
    const s = this.save; for (const i of items) UI.stashAdd({ ...i, uid: Math.floor(Math.random() * 1e9) }); s.loadout = { w1: null, w2: null, armor: null, bag: null, carry: [] };
    s.stats.extracts++; s.stats.kills += p.kills; this.persist(); SFX.extractDone(); SFX.stopAmbient();
    questEvent('extract', { map: this.mapId, timed: e.openAt > 0 }); questEvent('loot', { value }); questEvent('closecall', { hp: p.hp });
    this.state = 'result'; UI.results('extract', { msg: `You slipped out through ${e.name}.`, items, kills: p.kills, xp: this.raidXp, time: this.time, value });
  },
  onPlayerDeath(from) {
    if (this.state !== 'raid') return; const p = this.player; R.flashes = []; this.state = 'dying'; const items = [...p.inv, ...p.weapons.filter(Boolean)]; if (p.armor) items.push(p.armor); if (p.bag) items.push(p.bag);
    const value = this.carriedValue(); const s = this.save; s.loadout = { w1: null, w2: null, armor: null, bag: null, carry: [] }; s.stats.deaths++; s.stats.kills += p.kills;
    let charity = false; if (!s.stash.some(i => ITEMS[i.id].type === 'weapon') && s.money < buyPrice('pistol') + buyPrice('ammo_9')) { s.stash.push(mk('pistol'), mk('ammo_9', 24), mk('bandage', 1)); charity = true; }
    this.persist(); SFX.stopAmbient();
    const kind = from === 'timeout' ? 'mia' : 'kia';
    setTimeout(() => { if (this.player !== p) return; this.state = 'result'; UI.results(kind, { msg: from === 'timeout' ? 'The raid timer ran out. Nobody came looking.' : `Killed by ${from}.`, items, kills: p.kills, xp: this.raidXp, time: this.time, value, charity }); }, kind === 'mia' ? 100 : 1600);
  },
  // ----- helpers used by entities/render -----
  emitNoise(x, y, radius, src) { for (const e of this.enemies) if (e !== src) e.hear(x, y, radius, src); },
  flash(x, y, t) { R.flashes.push({ x, y, t }); },
  shake(a) { R.shake(a); },
  toast(msg) { this.toasts.unshift({ msg, t: 3.5 }); if (this.toasts.length > 4) this.toasts.pop(); },
  canPlayerSee(e) {
    const p = this.player; const d = dist(p.x, p.y, e.x, e.y); if (d > this.VIEW_LONG) return false;
    if (d > this.VIEW_SHORT * 0.9) { const a = Math.atan2(e.y - p.y, e.x - p.x); if (Math.abs(angleDiff(p.ang, a)) > this.CONE_HALF + 0.06) return false; }
    return this.world.los(p.x, p.y, e.x, e.y);
  },
  nearestContainer() { const p = this.player; let best = null, bd = 64; for (const c of this.world.containers) { const d = dist(p.x, p.y, c.x, c.y); if (d < bd) { bd = d; best = c; } } return best; },
  openLoot(c) { UI.loot(c); },
  objectiveMarkers() {
    const out = []; const w = this.world, s = this.save, ex = this.explored;
    const seen = (x, y) => ex[Math.floor(y / TILE) * w.w + Math.floor(x / TILE)];
    for (const e of w.extracts) out.push({ x: e.x, y: e.y, col: this.extractOpen(e) ? '#6f6' : '#f66', label: e.name + (this.extractOpen(e) ? '' : ' (closed)') });
    for (const npc of Object.keys(NPCS)) {
      const q = activeQuestFor(npc); if (!q || questReady(q)) continue;
      if (q.type === 'kill' && q.who === 'boss') { const b = this.enemies.find(e => e.type === 'boss'); if (b && b.home) out.push({ x: (b.home.x + b.home.w / 2) * TILE, y: (b.home.y + b.home.h / 2) * TILE, col: '#f4a', label: "The Drake's warehouse" }); }
      if (q.type === 'bring') { const want = q.items.map(i => i[0]); for (const c of w.containers) { if (c.searched || !seen(c.x, c.y) || c.type === 'body') continue; const table = LOOT[c.type]; if (table && table.some(t => want.includes(t[0]))) out.push({ x: c.x, y: c.y, col: '#fd4', label: CONTAINER_DEF[c.type].name }); } }
    }
    return out;
  },
  interact() {
    const p = this.player; if (p.dead) return; const c = this.nearestContainer(); if (!c) return;
    if (c.opened) { if (!c.items) c.items = rollLoot(c.type); UI.loot(c); } else if (!p.searching) p.searching = { c, t: 0 };
  },
  // ----- input -----
  bindInput() {
    const I = this.input; const cv = R.cv;
    window.addEventListener('keydown', e => {
      if (e.repeat) return; const k = e.key.toLowerCase(); I.keys.add(k); if (['tab', ' '].includes(k)) e.preventDefault();
      if (this.state !== 'raid') return;
      if (k === 'escape') { if (UI.mapOpen) UI.mapOpen = false; else if (UI.lootOpen || UI.invOpen || UI.menu) UI.hide(); else if (UI.paused) UI.hide(); else UI.pause(); }
      if (UI.paused) return;
      if (k === 'tab' || k === 'i') { if (UI.invOpen) UI.hide(); else { UI.hide(); UI.inventory(); } }
      if (k === 'e') { if (UI.lootOpen) UI.hide(); else this.interact(); }
      if (k === 'f') { this.player.light = !this.player.light; SFX.tick(); }
      if (k === 'c') this.player.checkMag();
      if (k === 'q') this.player.switchWeapon(); if (k === '1') this.player.switchWeapon(0); if (k === '2') this.player.switchWeapon(1);
      if (k === 'r') this.player.reload();
      if (k === 'm') UI.toggleMap();
      if (k >= '3' && k <= '6') { const meds = this.player.inv.filter(i => ITEMS[i.id].type === 'med'); const it = meds[+k - 3]; if (it) this.player.use(it); }
    });
    window.addEventListener('keyup', e => I.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => I.keys.clear());
    window.addEventListener('mousemove', e => { I.mouse.x = e.clientX; I.mouse.y = e.clientY; });
    cv.addEventListener('mousedown', e => { SFX.init(); if (e.button === 0) I.mouse.down = true; if (e.button === 2) this.interact(); });
    window.addEventListener('mouseup', e => { if (e.button === 0) I.mouse.down = false; });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => { if (this.state === 'raid' && this.player) this.player.switchWeapon(); }, { passive: true });
    // touch
    const T2 = UI.touch; const findTouch = id => (T2.move && T2.move.id === id) ? 'move' : (T2.aim && T2.aim.id === id) ? 'aim' : null;
    cv.addEventListener('touchstart', e => {
      SFX.init(); e.preventDefault(); if (this.state !== 'raid') return;
      for (const t of e.changedTouches) {
        const x = t.clientX, y = t.clientY; let hit = false;
        for (const b of UI.touchLayout(R.W, R.H)) { if (dist(x, y, b.x, b.y) < b.r + 8) { hit = true; this.touchButton(b.id); break; } }
        if (hit) continue;
        if (x < R.W / 2 && !T2.move) T2.move = { id: t.identifier, ox: x, oy: y, dx: 0, dy: 0 };
        else if (x >= R.W / 2 && !T2.aim) T2.aim = { id: t.identifier, ox: x, oy: y, dx: 0, dy: 0, mag: 0 };
      }
    }, { passive: false });
    cv.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) { const k = findTouch(t.identifier); if (!k) continue; const s = T2[k]; let dx = (t.clientX - s.ox) / 60, dy = (t.clientY - s.oy) / 60; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } s.dx = dx; s.dy = dy; s.mag = Math.min(1, m); if (m > 0.2) s.ang = Math.atan2(dy, dx); } }, { passive: false });
    const endT = e => { for (const t of e.changedTouches) { const k = findTouch(t.identifier); if (k) T2[k] = null; } };
    cv.addEventListener('touchend', endT); cv.addEventListener('touchcancel', endT);
  },
  touchButton(id) {
    const p = this.player; if (!p) return;
    if (id === 'reload') p.reload(); if (id === 'swap') p.switchWeapon(); if (id === 'inv') { if (UI.invOpen) UI.hide(); else { UI.hide(); UI.inventory(); } }
    if (id === 'sprint') this.input.sprintToggle = !this.input.sprintToggle; if (id === 'interact') this.interact(); if (id === 'pause') { if (UI.paused) UI.hide(); else UI.pause(); }
    if (id === 'light') { p.light = !p.light; SFX.tick(); } if (id === 'map') UI.toggleMap(); if (id === 'check') p.checkMag();
  },
  readInput() {
    const I = this.input, k = I.keys, p = this.player, T2 = UI.touch; const inp = { mx: 0, my: 0, aim: p.ang, fire: false, fireHeld: false, sprint: false, reload: false };
    if (k.has('w') || k.has('arrowup')) inp.my -= 1; if (k.has('s') || k.has('arrowdown')) inp.my += 1; if (k.has('a') || k.has('arrowleft')) inp.mx -= 1; if (k.has('d') || k.has('arrowright')) inp.mx += 1;
    inp.sprint = k.has('shift');
    if (!IS_TOUCH || I.mouse.down) { const [wx, wy] = R.screenToWorld(I.mouse.x, I.mouse.y); if (!IS_TOUCH) inp.aim = Math.atan2(wy - p.y, wx - p.x); }
    if (I.mouse.down) { inp.fire = true; inp.fireHeld = I.mouse.wasDown; } I.mouse.wasDown = I.mouse.down;
    if (T2.move) { inp.mx = T2.move.dx; inp.my = T2.move.dy; }
    if (T2.aim) { if (T2.aim.ang !== undefined) inp.aim = T2.aim.ang; if (T2.aim.mag > 0.75) { inp.fire = true; inp.fireHeld = !!I.touchFiring; I.touchFiring = true; } else I.touchFiring = false; } else I.touchFiring = false;
    if (IS_TOUCH) inp.sprint = I.sprintToggle && (inp.mx || inp.my); if (IS_TOUCH && !(inp.mx || inp.my)) I.sprintToggle = false;
    if (UI.lootOpen || UI.invOpen) { inp.fire = false; }
    return inp;
  },
  // ----- loop -----
  loop(ts) {
    requestAnimationFrame(t => this.loop(t));
    let dt = Math.min(0.05, (ts - this.last) / 1000); this.last = ts;
    if (this.state === 'raid' || this.state === 'dying') { if (!UI.paused) this.update(dt); R.frame(dt); }
    else if (this.state === 'result' && this.world) { R.frame(0.0001); }
    else { const x = R.ctx; x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#14201a'; x.fillRect(0, 0, R.cv.width, R.cv.height); }
  },
  update(dt) {
    if (this.state !== 'raid' && this.state !== 'dying') return; const p = this.player, w = this.world; this.time += dt; this.timeLeft = this.cfg.time - this.time;
    SFX.listener.x = p.x; SFX.listener.y = p.y;
    if (this.timeLeft <= 0 && !p.dead) { p.dead = true; this.onPlayerDeath('timeout'); return; }
    const inp = this.readInput(); if (!p.dead) p.update(dt, inp);
    for (const e of this.enemies) e.update(dt, p);
    for (const b of this.bullets) b.update(dt); this.bullets = this.bullets.filter(b => !b.dead);
    for (const pt of this.particles) pt.update(dt); this.particles = this.particles.filter(pt => pt.life > 0);
    for (const pg of this.pings) pg.t -= dt; this.pings = this.pings.filter(pg => pg.t > 0);
    for (const t of this.toasts) t.t -= dt; this.toasts = this.toasts.filter(t => t.t > 0);
    // extract announcements
    for (const e of w.extracts) { if (!e._ann && this.time >= e.openAt && this.time < e.closeAt) { e._ann = true; if (this.time > 1) { this.toast(`${e.name} extract is OPEN`); SFX.chime(1); } } if (e._ann && !e._cl && this.time >= e.closeAt) { e._cl = true; this.toast(`${e.name} extract has CLOSED`); } }
    if (this.timeLeft < 60 && !this._warn) { this._warn = true; this.toast('ONE MINUTE LEFT'); }
  },
};
window.addEventListener('load', () => G.init());
