// Particles, floating text, screen shake, flashes and banners.

import { G, view, field } from './state.js';
import { rand, TAU } from '../core/math.js';
import { glow, shockSpr, flareSpr, glintSpr } from '../render/sprites.js';
import { profile } from '../core/storage.js';
import { bg } from '../render/background.js';

const free = [];
const MAX_PARTICLES = 900;

function spawn() {
  if (G.particles.length >= MAX_PARTICLES * view.quality) return null;
  const p = free.pop() || {};
  G.particles.push(p);
  return p;
}

// kind: spark (streak), dot (glow blob), ring (expanding circle), flash (big glow), shard (tumbling debris),
// shock (soft shockwave band), flare (cross lens flare), ember (flickering drifting glow), glint (twinkle star),
// bolt (lightning crackle from x, y outward along vx, vy; size = length). Returns the particle (or null at the cap).
export function particle(kind, x, y, vx, vy, life, size, color, drag = 3) {
  const p = spawn();
  if (!p) return;
  p.kind = kind;
  p.x = x;
  p.y = y;
  p.vx = vx;
  p.vy = vy;
  p.life = life;
  p.max = life;
  p.size = size;
  p.color = color;
  p.drag = drag;
  p.rot = 0;
  p.spin = 0;
  if (kind === 'bolt') {
    // Jagged polyline baked at spawn (offsets from x, y), reused across the pool.
    const pts = p.pts || (p.pts = []);
    pts.length = 0;
    const len = size;
    const a = Math.atan2(vy, vx);
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const n = 5;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const off = i === 0 ? 0 : rand(-0.22, 0.22) * len * (1 - t * 0.4);
      pts.push(c * len * t - sn * off, sn * len * t + c * off);
    }
    p.vx = p.vy = 0;
  }
  return p;
}

export function explosion(x, y, color, size = 1) {
  const q = view.quality;
  bg.blast(x, y, size, color);
  particle('flash', x, y, 0, 0, 0.18 + size * 0.05, 50 * size, color, 0);
  particle('flash', x, y, 0, 0, 0.12, 26 * size, '#ffffff', 0);
  // Anime-style hit star: a cross flare over the core, turned a little each time.
  const fl = particle('flare', x, y, 0, 0, 0.16 + size * 0.06, 34 + 30 * size, color, 0);
  if (fl) fl.rot = rand(-0.5, 0.5);
  particle('shock', x, y, 0, 0, 0.26 + size * 0.08, 16 + 30 * size, color, 0);
  const n = Math.round((8 + 10 * size) * q);
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU);
    const s = rand(80, 380) * (0.6 + size * 0.4);
    particle('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.25, 0.55), rand(1.2, 2.4), i % 3 ? color : '#ffffff', 4);
  }
  // Hull debris: tumbling neon shards of the wreck.
  const sh = Math.round((3 + 3 * size) * q);
  for (let i = 0; i < sh; i++) {
    const a = rand(0, TAU);
    const s = rand(60, 220) * (0.7 + size * 0.3);
    const p = particle('shard', x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.45, 0.85), rand(2.5, 5.5) * Math.min(1.6, 0.7 + size * 0.3), color, 1.8);
    if (p) {
      p.rot = rand(0, TAU);
      p.spin = rand(-14, 14);
    }
  }
  const d = Math.round((2 + 3 * size) * q);
  for (let i = 0; i < d; i++) {
    const a = rand(0, TAU);
    const s = rand(20, 140) * size;
    particle('dot', x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.4, 0.9), rand(8, 16) * Math.min(2, size), color, 2);
  }
  // Embers drift out and flicker after the flash; glints twinkle in the cloud.
  const em = Math.round((3 + 4 * size) * q);
  for (let i = 0; i < em; i++) {
    const a = rand(0, TAU);
    const s = rand(30, 120) * (0.6 + size * 0.4);
    const p = particle('ember', x + rand(-6, 6) * size, y + rand(-6, 6) * size, Math.cos(a) * s, Math.sin(a) * s, rand(0.5, 1.1), rand(3, 5.5), i % 2 ? color : '#ffffff', 1.6);
    if (p) p.rot = rand(0, TAU);
  }
  const gl = Math.round((1 + 2 * size) * q);
  for (let i = 0; i < gl; i++) {
    const a = rand(0, TAU);
    const r = rand(6, 26) * size;
    particle('glint', x + Math.cos(a) * r, y + Math.sin(a) * r, 0, 0, rand(0.25, 0.45), rand(8, 14) * Math.min(1.5, size), i % 2 ? '#ffffff' : color, 0);
  }
  // Big blasts crackle with ki lightning.
  if (size >= 1.2) {
    const nb = Math.round(Math.min(5, 1 + size * 1.5) * q);
    for (let i = 0; i < nb; i++) {
      const a = rand(0, TAU);
      particle('bolt', x, y, Math.cos(a), Math.sin(a), rand(0.12, 0.22), rand(26, 46) * Math.min(2.2, size), i % 2 ? color : '#ffffff', 0);
    }
  }
}

// Ki splash where a player shot lands: a quick bright pop in the shot's colour (plus a shock ring for heavy rounds).
export function impact(x, y, color, size, heavy = false) {
  particle('flash', x, y, 0, 0, 0.09, size, color, 0);
  if (heavy) {
    particle('shock', x, y, 0, 0, 0.28, size * 1.1, color, 0);
    const fl = particle('flare', x, y, 0, 0, 0.14, size * 1.2, color, 0);
    if (fl) fl.rot = rand(-0.4, 0.4);
  } else if (Math.random() < 0.35) particle('glint', x + rand(-4, 4), y + rand(-4, 4), 0, 0, 0.16, size * 0.7, '#ffffff', 0);
}

export function sparks(x, y, color, n = 4, speed = 220, angle = null, spread = TAU) {
  for (let i = 0; i < n; i++) {
    const a = angle === null ? rand(0, TAU) : angle + rand(-spread / 2, spread / 2);
    const s = rand(0.4, 1) * speed;
    particle('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.12, 0.3), rand(1, 1.8), color, 5);
  }
}

export function ring(x, y, radius, color, life = 0.4) {
  particle('ring', x, y, 0, 0, life, radius, color, 0);
}

export function updateParticles(dt) {
  const arr = G.particles;
  let w = 0;
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    p.life -= dt;
    if (p.life <= 0) {
      free.push(p);
      continue;
    }
    const k = Math.max(0, 1 - p.drag * dt);
    p.vx *= k;
    p.vy *= k;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'shard') p.rot += p.spin * dt;
    else if (p.kind === 'ember') p.vy += 40 * dt; // embers fall back with the scroll
    arr[w++] = p;
  }
  arr.length = w;
}

export function drawParticles(ctx) {
  ctx.globalCompositeOperation = 'lighter';
  for (const p of G.particles) {
    const t = p.life / p.max;
    if (p.kind === 'spark') {
      ctx.globalAlpha = t;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
      ctx.stroke();
    } else if (p.kind === 'shard') {
      const cx = Math.cos(p.rot) * p.size;
      const cy = Math.sin(p.rot) * p.size;
      ctx.globalAlpha = Math.min(1, t * 1.6);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(p.x - cx, p.y - cy);
      ctx.lineTo(p.x + cx, p.y + cy);
      ctx.lineTo(p.x + cx * 0.2 - cy * 0.6, p.y + cy * 0.2 + cx * 0.6);
      ctx.stroke();
    } else if (p.kind === 'dot') {
      const s = glow(p.color, 32);
      const sz = p.size * (0.5 + t * 0.5);
      ctx.globalAlpha = t * 0.8;
      ctx.drawImage(s.img, p.x - sz, p.y - sz, sz * 2, sz * 2);
    } else if (p.kind === 'flash') {
      const s = glow(p.color, 64);
      const sz = p.size * (1.3 - t * 0.3);
      ctx.globalAlpha = t;
      ctx.drawImage(s.img, p.x - sz, p.y - sz, sz * 2, sz * 2);
    } else if (p.kind === 'shock') {
      const s = shockSpr(p.color);
      const r = p.size * (1 - t * t * 0.8) * (64 / 56); // ring radius 28 of the 64 box
      ctx.globalAlpha = Math.min(1, t * t * 1.5);
      ctx.drawImage(s.img, p.x - r, p.y - r, r * 2, r * 2);
    } else if (p.kind === 'flare') {
      const s = flareSpr(p.color);
      const r = p.size * (0.6 + 0.4 * t);
      ctx.globalAlpha = t;
      if (p.rot) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.drawImage(s.img, -r, -r, r * 2, r * 2);
        ctx.restore();
      } else ctx.drawImage(s.img, p.x - r, p.y - r, r * 2, r * 2);
    } else if (p.kind === 'ember') {
      const s = glow(p.color, 32);
      const sz = p.size * (0.4 + 0.6 * t);
      ctx.globalAlpha = t * (0.55 + 0.45 * Math.sin(p.life * 38 + p.rot));
      ctx.drawImage(s.img, p.x - sz, p.y - sz, sz * 2, sz * 2);
    } else if (p.kind === 'glint') {
      const s = glintSpr(p.color);
      const sz = p.size * Math.sin(t * Math.PI);
      ctx.globalAlpha = 1;
      ctx.drawImage(s.img, p.x - sz, p.y - sz, sz * 2, sz * 2);
    } else if (p.kind === 'bolt') {
      const pts = p.pts;
      ctx.globalAlpha = t;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(p.x + pts[0], p.y + pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(p.x + pts[i], p.y + pts[i + 1]);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    } else if (p.kind === 'ring') {
      const r = p.size * (1 - t * t * 0.85);
      ctx.globalAlpha = t * 0.9;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1 + 3 * t;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// --- Floating text --------------------------------------------------------------

export function floatText(x, y, text, color = '#fff', size = 12, life = 0.7) {
  if (G.texts.length > 70) G.texts.shift();
  // Keep labels fully on screen. The overworld camera is zoomed out, so its labels are drawn larger to read the same.
  if (field.ow) size /= field.z;
  const x0 = field.ow ? field.x0 : 0;
  const x1 = field.ow ? field.x1 : view.W;
  const half = Math.min((x1 - x0) / 2, text.length * size * 0.42);
  x = Math.max(x0 + half + 4, Math.min(x1 - half - 4, x));
  G.texts.push({ x, y, text, color, size, life, max: life, vy: -50 });
}

export function damageNumber(x, y, amount, crit) {
  if (!profile.settings.damageNumbers || G.mode === 'attract') return;
  // Only meaningful hits get a number, so the screen stays readable.
  if (!crit && amount < 4) return;
  const v = amount >= 10 ? Math.round(amount) : Math.round(amount * 10) / 10;
  floatText(x + rand(-6, 6), y - 6, crit ? `${v}!` : `${v}`, crit ? '#ffe14d' : 'rgba(255,255,255,0.8)', crit ? 13 : 9, 0.45);
}

export function updateTexts(dt) {
  const arr = G.texts;
  let w = 0;
  for (const t of arr) {
    t.life -= dt;
    if (t.life <= 0) continue;
    t.y += t.vy * dt;
    t.vy *= 1 - 3 * dt;
    arr[w++] = t;
  }
  arr.length = w;
}

// map(x, y, out): optional world → screen mapping (other stage views draw the numbers upright on the screen).
const tq = {};
export function drawTexts(ctx, map = null) {
  // In fights, numbers fade out as they rise into the top HUD band instead of drawing through it.
  const band = field.ow ? -1e9 : view.safeTop + 40;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let lastFont = '';
  for (const t of G.texts) {
    const k = t.life / t.max;
    const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
    const font = `700 ${Math.round(t.size * pop)}px Orbitron, sans-serif`;
    if (font !== lastFont) {
      ctx.font = font;
      lastFont = font;
    }
    const q = map ? map(t.x, t.y, tq) : t;
    const a = Math.min(1, k * 2, (q.y - band) / 24);
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(t.text, q.x + 1, q.y + 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, q.x, q.y);
  }
  ctx.globalAlpha = 1;
}

// --- Camera feedback ------------------------------------------------------------

export function addShake(amount) {
  if (!profile.settings.shake) return;
  G.shake = Math.min(1, G.shake + amount);
}

export function flash(color = '255,255,255', amount = 0.5) {
  const a = profile.settings.flashes ? amount : amount * 0.25;
  G.flash = Math.max(G.flash, a);
  G.flashColor = color;
}

export function hitstop(sec) {
  G.hitstop = Math.max(G.hitstop, sec);
}

export function slowmo(sec) {
  G.slowmo = Math.max(G.slowmo, sec);
}

// kind: null (plain) | 'start' (node opening) | 'clear' (node end) | 'secured' (system boss down); kicker: small line above.
export function banner(title, sub = '', color = '#3ff6ff', dur = 2.2, kind = null, kicker = '') {
  G.banner = { title, sub, color, t: 0, dur, kind, kicker };
}
