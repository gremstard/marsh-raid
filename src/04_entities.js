// ---------- entities ----------
const PLAYER_SPEED = 215, SPRINT_MULT = 1.5;

class Player {
  constructor(x, y, loadout) {
    this.x = x; this.y = y; this.r = 15; this.ang = 0; this.hp = 100; this.maxHp = 100; this.dead = false;
    this.bleed = 0; this.stamina = 100; this.sprinting = false; this.moving = false; this.vx = 0; this.vy = 0;
    this.weapons = [loadout.w1 || null, loadout.w2 || null]; this.wi = this.weapons[0] ? 0 : (this.weapons[1] ? 1 : 0);
    this.armor = loadout.armor || null; this.bag = loadout.bag || null;
    this.inv = loadout.carry.map(i => ({ ...i }));
    this.fireT = 0; this.reloadT = 0; this.useT = 0; this.useItem = null; this.stepT = 0; this.hurtT = 0; this.noiseT = 0; this.kills = 0; this.lootValue = 0;
    this.searching = null; // {container, t}
    this.extracting = null; // {extract, t}
    this.heartT = 0; this.light = true; this.magInfo = 'full'; this.checkT = 0;
  }
  get capacity() { return 4 + (this.bag ? ITEMS[this.bag.id].slots : 0); }
  get weapon() { return this.weapons[this.wi]; }
  get wdef() { return this.weapon ? ITEMS[this.weapon.id] : null; }
  speed() { let s = PLAYER_SPEED; if (this.armor) s *= 1 - ITEMS[this.armor.id].slow; if (this.sprinting && this.stamina > 0) s *= SPRINT_MULT; if (this.hp < 30) s *= 0.9; return s; }
  reserveAmmo(ammoId) { return this.inv.filter(i => i.id === ammoId).reduce((a, i) => a + i.n, 0); }
  addItem(it) { // returns false if no room
    const d = ITEMS[it.id];
    if (d.stack) { for (const s of this.inv) { if (s.id === it.id && s.n < d.stack) { const take = Math.min(d.stack - s.n, it.n); s.n += take; it.n -= take; if (it.n <= 0) return true; } } }
    if (this.inv.length >= this.capacity) return false;
    this.inv.push(it); return true;
  }
  removeItem(it) { const i = this.inv.indexOf(it); if (i >= 0) this.inv.splice(i, 1); }
  update(dt, inp) {
    if (this.dead) return;
    const w = G.world;
    // movement
    let mx = inp.mx, my = inp.my; const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
    this.moving = len > 0.1;
    this.sprinting = inp.sprint && this.moving && this.stamina > 0 && !this.searching && !this.extracting;
    if (this.sprinting) this.stamina = Math.max(0, this.stamina - 28 * dt); else this.stamina = Math.min(100, this.stamina + (this.moving ? 12 : 22) * dt);
    const sp = this.speed() * (this.useItem ? 0.6 : 1);
    this.vx = mx * sp; this.vy = my * sp;
    w.moveCircle(this, this.vx * dt, this.vy * dt);
    this.ang = inp.aim;
    // footsteps / noise
    if (this.moving) { this.stepT -= dt * (this.sprinting ? 1.6 : 1); if (this.stepT <= 0) { this.stepT = 0.36; SFX.step(undefined, undefined, this.sprinting); G.emitNoise(this.x, this.y, this.sprinting ? 300 : 120, 'step'); } }
    // weapon
    this.fireT -= dt;
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) this.finishReload(); }
    else if (inp.fire && this.weapon && !this.useItem && !this.searching && !this.extracting) {
      const wd = this.wdef;
      if (this.fireT <= 0 && (wd.auto || !inp.fireHeld)) {
        if (this.weapon.ammo > 0) { this.shoot(); } else { if (!inp.fireHeld) { SFX.empty(); this.magInfo = 'empty'; this.reload(); } }
      }
    }
    if (inp.reload) this.reload();
    // med use
    if (this.useItem) { this.useT -= dt; if (this.useT <= 0) this.finishUse(); }
    // bleeding
    if (this.bleed > 0) { this.hp -= 1.6 * dt; this.hurtT = Math.max(this.hurtT, 0.05); if (this.hp <= 0) this.die('bled out'); }
    this.hurtT = Math.max(0, this.hurtT - dt); this.checkT = Math.max(0, this.checkT - dt);
    // heartbeat when low
    if (this.hp < 35) { this.heartT -= dt; if (this.heartT <= 0) { this.heartT = lerp(0.6, 1.1, this.hp / 35); SFX.heartbeat(); } }
    // searching container
    if (this.searching) { const c = this.searching.c; if (dist(this.x, this.y, c.x, c.y) > 70 || inp.fire) this.searching = null; else { this.searching.t += dt; if (Math.floor(this.searching.t * 6) !== Math.floor((this.searching.t - dt) * 6)) SFX.tick(); if (this.searching.t >= CONTAINER_DEF[c.type].time) { c.opened = true; if (!c.items) c.items = rollLoot(c.type); G.openLoot(c); this.searching = null; SFX.open(); questEvent('search', {}); } } }
    // extracting
    if (this.extracting) { const e = this.extracting.e; if (dist(this.x, this.y, e.x, e.y) > e.r || !G.extractOpen(e)) { this.extracting = null; } else { this.extracting.t += dt; if (Math.floor(this.extracting.t) !== Math.floor(this.extracting.t - dt)) SFX.chime(Math.floor(this.extracting.t)); if (this.extracting.t >= 6) G.extract(e); } }
    else { for (const e of w.extracts) if (G.extractOpen(e) && dist(this.x, this.y, e.x, e.y) < e.r) { this.extracting = { e, t: 0 }; } }
  }
  shoot() {
    const wd = this.wdef; this.weapon.ammo--; this.fireT = wd.rof; this.magInfo = null;
    const mx = this.x + Math.cos(this.ang) * 26, my = this.y + Math.sin(this.ang) * 26;
    for (let i = 0; i < wd.pellets; i++) { const a = this.ang + (rand() - 0.5) * 2 * wd.spread * Math.PI / 180 * (this.moving ? 1.4 : 1); G.bullets.push(new Bullet(mx, my, a, wd, this)); }
    G.flash(mx, my, 0.06); G.shake(wd.noise / 200); SFX.shot(this.weapon.id);
    G.emitNoise(this.x, this.y, wd.noise * 2.2, 'shot');
    for (let i = 0; i < 3; i++) G.particles.push(new Particle(mx, my, this.ang + rand(-0.4, 0.4), rand(80, 200), 0.15, '#ffd070', 2));
  }
  reload() {
    if (!this.weapon || this.reloadT > 0) return; const wd = this.wdef; if (this.weapon.ammo >= wd.mag) return;
    if (this.reserveAmmo(wd.ammo) <= 0) { G.toast('No ' + ITEMS[wd.ammo].name); return; }
    this.reloadT = wd.reload; SFX.reload();
  }
  finishReload() {
    const wd = this.wdef; if (!wd) return; let need = wd.mag - this.weapon.ammo;
    for (const s of this.inv.slice()) { if (s.id !== wd.ammo) continue; const take = Math.min(need, s.n); s.n -= take; need -= take; this.weapon.ammo += take; if (s.n <= 0) this.removeItem(s); if (need <= 0) break; }
    this.magInfo = this.weapon.ammo >= wd.mag ? 'full' : 'partial';
  }
  checkMag() { if (!this.weapon || this.reloadT > 0) return; this.checkT = 2.5; SFX.tick(); }
  switchWeapon(i) { if (i === undefined) i = 1 - this.wi; if (this.weapons[i]) { this.wi = i; this.reloadT = 0; this.fireT = 0.25; this.magInfo = null; this.checkT = 0; SFX.ui(); } }
  use(it) { const d = ITEMS[it.id]; if (d.type !== 'med' || this.useItem) return; this.useItem = it; this.useT = d.time; this.reloadT = 0; }
  finishUse() {
    const it = this.useItem, d = ITEMS[it.id]; this.useItem = null;
    if (!this.inv.includes(it)) return;
    this.hp = Math.min(this.maxHp, this.hp + d.heal); if (d.stopBleed) this.bleed = 0;
    it.n = (it.n || 1) - 1; if (it.n <= 0) this.removeItem(it); SFX.chime(2); G.toast(d.name + ' used');
  }
  damage(dmg, from, wid) {
    if (this.dead) return;
    if (this.armor && this.armor.dur > 0) { const ad = ITEMS[this.armor.id]; const absorbed = Math.min(dmg * ad.reduce, this.armor.dur); this.armor.dur -= absorbed * 0.8; dmg -= absorbed; if (this.armor.dur <= 0) G.toast('Armor destroyed!'); }
    this.hp -= dmg; this.hurtT = 0.35; SFX.hurt(); G.shake(6);
    if (chance(0.35)) this.bleed = 1;
    for (let i = 0; i < 6; i++) G.particles.push(new Particle(this.x, this.y, rand(TAU), rand(60, 160), 0.6, '#f8f0d0', 3));
    if (this.hp <= 0) this.die(from);
  }
  die(from) { if (this.dead) return; this.dead = true; this.hp = 0; SFX.death(); G.onPlayerDeath(from); }
}

const ENEMY_TYPES = {
  scav:  { name: 'Scav',  hp: 55,  speed: 150, col: '#8a8a7a', beak: '#d08030', weapons: [['pistol', 5], ['shotgun', 3], ['smg', 2]], accuracy: 11, reaction: 0.55, view: 440, armor: null,         burst: [2, 4], pause: [0.5, 1.2], xp: 30 },
  guard: { name: 'Guard', hp: 95,  speed: 160, col: '#5a7a5a', beak: '#d08030', weapons: [['rifle', 4], ['smg', 2], ['shotgun', 1]], accuracy: 8, reaction: 0.4, view: 520, armor: 'vest_light', burst: [3, 6], pause: [0.4, 0.9], xp: 60 },
  boss:  { name: 'The Drake', hp: 320, speed: 170, col: '#6a2a2a', beak: '#f0c040', weapons: [['dmr', 1], ['rifle', 2]], accuracy: 6, reaction: 0.3, view: 600, armor: 'vest_heavy', burst: [4, 7], pause: [0.3, 0.7], xp: 250, big: true },
};

class Enemy {
  constructor(x, y, type, home) {
    const d = ENEMY_TYPES[type]; this.type = type; this.d = d; this.x = x; this.y = y; this.r = d.big ? 19 : 15; this.ang = rand(TAU);
    this.hp = d.hp; this.maxHp = d.hp; this.dead = false; this.home = home;
    this.weaponId = weightedPick(d.weapons); this.ammo = ITEMS[this.weaponId].mag; this.reloadT = 0;
    this.armor = d.armor ? mk(d.armor) : null;
    this.state = 'patrol'; this.path = null; this.pathT = 0; this.waitT = rand(0.5, 3); this.target = null; this.lastSeen = null; this.lostT = 0;
    this.fireT = 0; this.burst = 0; this.react = 0; this.stepT = 0; this.alertT = 0; this.strafe = 0; this.strafeT = 0; this.hurtT = 0; this.vx = 0; this.vy = 0; this.quackT = rand(5, 20);
    this.loot = rollLoot(chance(0.4) ? 'crate' : 'locker'); if (type === 'boss') this.loot.push(mk('goldbar'), mk(pick(['gpu', 'ledger', 'drive']))); if (type === 'guard' && chance(0.4)) this.loot.push(mk(pick(['watch', 'drive'])));
  }
  canSee(p) {
    const d = dist(this.x, this.y, p.x, p.y); const range = this.d.view * (p.light ? 1.25 : 0.65) * (p.sprinting ? 1.15 : 1); if (d > range) return false;
    const a = Math.atan2(p.y - this.y, p.x - this.x); if (d > 70 && Math.abs(angleDiff(this.ang, a)) > 1.25) return false;
    return G.world.los(this.x, this.y, p.x, p.y);
  }
  hear(x, y, radius, src) {
    if (this.dead) return; const d = dist(this.x, this.y, x, y); if (d > radius) return;
    if (this.state === 'chase') return;
    // approximate position knowledge: error grows with distance
    const err = d * 0.25; this.target = { x: x + rand(-err, err), y: y + rand(-err, err) }; this.state = 'alert'; this.path = null; this.pathT = 0; this.waitT = 0; this.alertT = src === 'shot' ? 12 : 6;
  }
  setPath(tx, ty) { const w = G.world; this.path = w.astar(Math.floor(this.x / TILE), Math.floor(this.y / TILE), Math.floor(tx / TILE), Math.floor(ty / TILE)); this.pathT = rand(0.5, 0.8); if (this.path && this.path.length) this.path.push({ x: tx, y: ty }); }
  followPath(dt, speed) {
    if (!this.path || !this.path.length) return true;
    let wp = this.path[0]; while (this.path.length > 1 && dist(this.x, this.y, wp.x, wp.y) < 20) { this.path.shift(); wp = this.path[0]; }
    const d = dist(this.x, this.y, wp.x, wp.y); if (d < 12 && this.path.length === 1) { this.path = []; return true; }
    const a = Math.atan2(wp.y - this.y, wp.x - this.x); this.moveDir(a, speed, dt); this.faceToward(a, dt, 8);
    return false;
  }
  moveDir(a, speed, dt) { this.vx = Math.cos(a) * speed; this.vy = Math.sin(a) * speed; G.world.moveCircle(this, this.vx * dt, this.vy * dt); this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.4; SFX.step(this.x, this.y, false); G.pings.push({ x: this.x, y: this.y, t: 0.5, max: 0.5 }); } }
  faceToward(a, dt, rate) { const diff = angleDiff(this.ang, a); this.ang += clamp(diff, -rate * dt, rate * dt); }
  update(dt, p) {
    if (this.dead) return;
    const w = G.world; this.hurtT = Math.max(0, this.hurtT - dt); this.fireT -= dt; this.pathT -= dt; this.vx = this.vy = 0;
    const see = !p.dead && this.canSee(p);
    if (see) { this.lastSeen = { x: p.x, y: p.y }; this.lostT = 0; if (this.state !== 'chase') { this.state = 'chase'; this.react = this.d.reaction + rand(0, 0.3); this.path = null; SFX.quack(this.x, this.y, this.d.big ? 0.6 : 1); G.emitNoise(this.x, this.y, 380, 'quack'); } }
    else if (this.state === 'chase') { this.lostT += dt; if (this.lostT > 1.2) { this.state = 'search'; this.target = this.lastSeen; this.path = null; this.pathT = 0; this.waitT = 0; this.alertT = 10; } }
    this.quackT -= dt; if (this.quackT <= 0 && this.state === 'patrol') { this.quackT = rand(12, 35); SFX.quack(this.x, this.y, 0.9 + rand(0.2)); }
    switch (this.state) {
      case 'patrol': {
        if (this.waitT > 0) { this.waitT -= dt; if (chance(dt * 0.4)) this.ang += rand(-1, 1); break; }
        if (!this.path || !this.path.length) {
          const hx = this.home ? (this.home.x + this.home.w / 2) * TILE : this.x, hy = this.home ? (this.home.y + this.home.h / 2) * TILE : this.y;
          const range = this.home ? 7 * TILE : 12 * TILE; const tx = clamp(hx + rand(-range, range), TILE * 2, (w.w - 2) * TILE), ty = clamp(hy + rand(-range, range), TILE * 2, (w.h - 2) * TILE);
          if (!w.solidAt(tx, ty)) this.setPath(tx, ty); if (!this.path) { this.waitT = rand(1, 3); break; }
          this.waitT = 0;
        }
        if (this.followPath(dt, this.d.speed * 0.5)) { this.path = null; this.waitT = rand(1.5, 5); }
        break;
      }
      case 'alert': case 'search': {
        this.alertT -= dt; if (this.alertT <= 0 || !this.target) { this.state = 'patrol'; this.path = null; this.waitT = 1; break; }
        if (this.waitT > 0) { this.waitT -= dt; this.ang += Math.sin(G.time * 2.5) * dt * 2.2; if (this.waitT <= 0) { this.state = 'patrol'; this.path = null; this.waitT = 0.5; } break; }
        if (!this.path && this.pathT <= 0) this.setPath(this.target.x, this.target.y);
        if (!this.path) { this.waitT = 2; break; }
        if (this.followPath(dt, this.d.speed * 0.85)) { this.path = null; this.waitT = rand(2.5, 4); }
        break;
      }
      case 'chase': {
        const tgt = see ? p : this.lastSeen; const d = dist(this.x, this.y, tgt.x, tgt.y);
        const a = Math.atan2(tgt.y - this.y, tgt.x - this.x); this.faceToward(a, dt, see ? 10 : 5);
        const wd = ITEMS[this.weaponId]; const pref = wd.range * 0.45;
        this.react -= dt; this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = rand(0.6, 1.6); this.strafe = pick([-1, 0, 0, 1]); }
        if (see) {
          if (d > pref) { if (!this.path || this.pathT <= 0) this.setPath(p.x, p.y); if (this.path && this.path.length > 2) this.followPath(dt, this.d.speed); else this.moveDir(a, this.d.speed, dt); this.faceToward(a, dt, 10); }
          else if (d < pref * 0.5 && wd.pellets === 1) this.moveDir(a + Math.PI, this.d.speed * 0.6, dt);
          else if (this.strafe) this.moveDir(a + this.strafe * Math.PI / 2, this.d.speed * 0.55, dt);
          // shooting
          if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) this.ammo = wd.mag; }
          else if (this.react <= 0 && this.fireT <= 0) {
            if (this.ammo <= 0) { this.reloadT = wd.reload * 1.2; }
            else if (this.burst > 0) { this.shoot(p, wd); this.burst--; if (this.burst === 0) this.fireT = rand(this.d.pause[0], this.d.pause[1]); }
            else { this.burst = randi(this.d.burst[0], this.d.burst[1]); if (!wd.auto) this.burst = Math.min(this.burst, 2); }
          }
        } else { if (!this.path || this.pathT <= 0) this.setPath(tgt.x, tgt.y); this.followPath(dt, this.d.speed); }
        break;
      }
    }
  }
  shoot(p, wd) {
    this.ammo--; this.fireT = wd.rof * 1.25;
    const mx = this.x + Math.cos(this.ang) * 26, my = this.y + Math.sin(this.ang) * 26;
    const d = dist(this.x, this.y, p.x, p.y); const lead = 0; // keep them honest
    for (let i = 0; i < wd.pellets; i++) { const a = Math.atan2(p.y - my, p.x - mx) + (rand() - 0.5) * 2 * (this.d.accuracy + wd.spread) * Math.PI / 180 * (1 + d / 900); G.bullets.push(new Bullet(mx, my, a, wd, this)); }
    G.flash(mx, my, 0.06); SFX.shot(this.weaponId, this.x, this.y); G.emitNoise(this.x, this.y, 600, 'eshot');
    if (!G.canPlayerSee(this)) G.pings.push({ x: this.x, y: this.y, t: 1.2, max: 1.2, shot: true });
  }
  damage(dmg, from, wid) {
    if (this.dead) return;
    if (this.armor && this.armor.dur > 0) { const ad = ITEMS[this.armor.id]; const ab = Math.min(dmg * ad.reduce, this.armor.dur); this.armor.dur -= ab; dmg -= ab; }
    this.hp -= dmg; this.hurtT = 0.2; SFX.hit(this.x, this.y);
    for (let i = 0; i < 5; i++) G.particles.push(new Particle(this.x, this.y, rand(TAU), rand(50, 140), 0.5, '#e8e0d0', 3));
    if (this.state !== 'chase') { this.state = 'chase'; this.lastSeen = { x: from.x, y: from.y }; this.react = 0.2; }
    if (this.hp <= 0) this.die(from, wid);
  }
  die(from, wid) {
    this.dead = true; G.pings = G.pings.filter(pg => pg !== this);
    for (let i = 0; i < 16; i++) G.particles.push(new Particle(this.x, this.y, rand(TAU), rand(40, 220), rand(0.6, 1.4), '#f0ece0', 4));
    // body container with weapon + ammo + loot
    const items = [mk(this.weaponId)]; items[0].ammo = Math.max(0, this.ammo); const am = mk(ITEMS[this.weaponId].ammo, randi(8, 30)); items.push(am); if (this.armor && this.armor.dur > 5) items.push(this.armor); items.push(...this.loot);
    G.world.containers.push({ x: this.x, y: this.y, type: 'body', items, opened: true, searched: false, rot: this.ang, who: this.type });
    if (from === G.player) { G.player.kills++; G.xpGain(this.d.xp); questEvent('kill', { who: this.type, weapon: wid }); }
    SFX.quack(this.x, this.y, 0.5);
  }
}

class Bullet {
  constructor(x, y, a, wd, owner) { this.wid = wd.id; this.x = x; this.y = y; this.px = x; this.py = y; this.vx = Math.cos(a) * wd.speed; this.vy = Math.sin(a) * wd.speed; this.dmg = wd.dmg; this.owner = owner; this.life = wd.range / wd.speed; this.dead = false; this.tracer = wd.pellets === 1; }
  update(dt) {
    this.life -= dt; if (this.life <= 0) { this.dead = true; return; }
    const steps = Math.ceil(Math.hypot(this.vx, this.vy) * dt / 12); const sx = this.vx * dt / steps, sy = this.vy * dt / steps;
    this.px = this.x; this.py = this.y;
    for (let i = 0; i < steps; i++) {
      this.x += sx; this.y += sy;
      if (G.world.bulletBlocked(this.x, this.y)) { this.dead = true; G.particles.push(new Particle(this.x, this.y, Math.atan2(-sy, -sx) + rand(-1, 1), rand(40, 120), 0.3, '#ccc', 2)); SFX.ricochet(this.x, this.y); return; }
      if (this.owner instanceof Player) {
        for (const e of G.enemies) { if (e.dead) continue; if ((e.x - this.x) ** 2 + (e.y - this.y) ** 2 < (e.r + 3) ** 2) { e.damage(this.dmg, this.owner, this.wid); this.dead = true; return; } }
      } else {
        const p = G.player; const dd = (p.x - this.x) ** 2 + (p.y - this.y) ** 2; if (!p.dead && dd < (p.r + 3) ** 2) { p.damage(this.dmg, this.owner.d.name); this.dead = true; return; } if (!this.whizzed && dd < 70 * 70) { this.whizzed = true; SFX.whizz(); R.flinch(0.35); G.shake(3); }
      }
    }
  }
}

class Particle {
  constructor(x, y, a, sp, life, col, size) { this.x = x; this.y = y; this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp; this.life = life; this.max = life; this.col = col; this.size = size; }
  update(dt) { this.life -= dt; this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= 0.9; this.vy *= 0.9; }
}
