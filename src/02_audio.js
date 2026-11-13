// ---------- procedural audio (no asset files) ----------
const SFX = {
  ctx: null, master: null, ambient: null, listener: { x: 0, y: 0 }, muted: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext; this.ctx = new C();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(this.ctx.destination);
      const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6; this.master.disconnect(); this.master.connect(comp); comp.connect(this.ctx.destination);
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { console.warn('audio unavailable', e); }
  },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.7; },
  // spatial helper: returns {gain, pan} for a world position relative to listener
  spatial(x, y, radius) {
    if (x === undefined) return { gain: 1, pan: 0 };
    const dx = x - this.listener.x, dy = y - this.listener.y; const d = Math.hypot(dx, dy);
    const gain = clamp(1 - d / radius, 0, 1) ** 1.4; const pan = clamp(dx / 500, -0.9, 0.9);
    return { gain, pan };
  },
  out(gainVal, pan, t0, dur) {
    const g = this.ctx.createGain(); g.gain.value = gainVal; const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; g.connect(p); p.connect(this.master); } else g.connect(this.master);
    return g;
  },
  noise(dur, filterType, freq, q, gainVal, pan, attack = 0.002, decay) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true; src.playbackRate.value = 1;
    const f = this.ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q || 1;
    const g = this.out(0, pan); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gainVal, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + (decay || dur));
    src.connect(f); f.connect(g); src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  },
  tone(freq, dur, type, gainVal, pan, slide) {
    if (!this.ctx) return; const t = this.ctx.currentTime; const o = this.ctx.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    const g = this.out(0, pan || 0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gainVal, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.05);
  },
  shot(weaponId, x, y) {
    if (!this.ctx) return; const s = this.spatial(x, y, 1900); if (s.gain <= 0.01) return;
    const w = ITEMS[weaponId]; const big = w.noise / 820;
    this.noise(0.08 + big * 0.12, 'lowpass', 1800 + 1500 * (1 - big), 0.7, 0.9 * s.gain, s.pan, 0.001);
    this.noise(0.25 + big * 0.3, 'bandpass', 250 + 200 * big, 0.8, 0.5 * s.gain, s.pan, 0.005);
    this.tone(90 + 60 * big, 0.12 + big * 0.1, 'sine', 0.6 * s.gain, s.pan, 40);
    if (s.gain < 0.5) this.noise(0.5, 'lowpass', 400, 0.5, 0.25 * (1 - s.gain), s.pan, 0.05); // distant rumble
  },
  step(x, y, loud) {
    if (!this.ctx) return; const s = this.spatial(x, y, loud ? 520 : 380); if (s.gain <= 0.02) return;
    this.noise(0.07, 'bandpass', 900 + Math.random() * 500, 1.5, (loud ? 0.22 : 0.12) * s.gain, s.pan, 0.002);
  },
  hit(x, y) { const s = this.spatial(x, y, 900); this.noise(0.06, 'bandpass', 2500, 2, 0.35 * s.gain, s.pan); this.tone(300, 0.08, 'triangle', 0.25 * s.gain, s.pan, 120); },
  whizz() { this.noise(0.12, 'bandpass', 3200 + Math.random() * 1500, 3, 0.35, Math.random() - 0.5, 0.002); },
  thunder() { this.noise(1.6, 'lowpass', 180, 0.7, 0.9, Math.random() - 0.5, 0.05); this.tone(45, 1.2, 'sine', 0.5, 0, 25); },
  hurt() { this.noise(0.15, 'lowpass', 600, 1, 0.6, 0); this.tone(180, 0.2, 'sawtooth', 0.25, 0, 60); },
  ricochet(x, y) { const s = this.spatial(x, y, 800); this.tone(1800 + Math.random() * 800, 0.12, 'square', 0.08 * s.gain, s.pan, 300); },
  quack(x, y, pitch = 1) { const s = this.spatial(x, y, 700); if (s.gain < 0.02) return; this.tone(420 * pitch, 0.14, 'sawtooth', 0.14 * s.gain, s.pan, 220 * pitch); },
  heartbeat() { this.tone(55, 0.15, 'sine', 0.8, 0, 40); setTimeout(() => this.tone(50, 0.18, 'sine', 0.6, 0, 35), 160); },
  tick() { this.tone(1200, 0.03, 'square', 0.05, 0); },
  open() { this.noise(0.2, 'lowpass', 900, 1, 0.3, 0); this.tone(220, 0.15, 'triangle', 0.2, 0, 180); },
  reload() { this.tone(500, 0.05, 'square', 0.12, 0, 350); setTimeout(() => this.tone(700, 0.05, 'square', 0.12, 0, 900), 120); },
  empty() { this.tone(900, 0.04, 'square', 0.1, 0, 600); },
  chime(n = 0) { const f = [523, 659, 784, 1047][n % 4]; this.tone(f, 0.5, 'sine', 0.25, 0); },
  extractDone() { [0, 1, 2, 3].forEach((i) => setTimeout(() => this.chime(i), i * 130)); },
  death() { this.tone(200, 1.2, 'sawtooth', 0.4, 0, 30); this.noise(1.0, 'lowpass', 300, 1, 0.5, 0, 0.1); },
  ui() { this.tone(800, 0.05, 'sine', 0.12, 0); },
  startAmbient() {
    if (!this.ctx || this.ambient) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; f.Q.value = 0.5;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.13; const lg = this.ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    const g = this.ctx.createGain(); g.gain.value = 0.16; src.connect(f); f.connect(g); g.connect(this.master); src.start();
    this.ambient = { src, g, lfo };
    this.crickets = setInterval(() => { if (Math.random() < 0.5) this.tone(3800 + Math.random() * 600, 0.05, 'sine', 0.012, Math.random() * 1.4 - 0.7); }, 220);
  },
  stopAmbient() { if (!this.ambient) return; try { this.ambient.src.stop(); this.ambient.lfo.stop(); } catch (e) { } clearInterval(this.crickets); this.ambient = null; },
};
