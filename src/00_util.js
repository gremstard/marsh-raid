'use strict';
// ---------- utilities ----------
const TILE = 48;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const angleDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let rng = Math.random;
const rand = (a = 1, b) => (b === undefined ? rng() * a : a + rng() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(rng() * arr.length)];
const chance = p => rng() < p;
function weightedPick(table) { let tot = 0; for (const e of table) tot += e[1]; let r = rng() * tot; for (const e of table) { r -= e[1]; if (r <= 0) return e[0]; } return table[table.length - 1][0]; }
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function fmtMoney(n) { return '₵' + Math.round(n).toLocaleString('en-US'); }
function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
