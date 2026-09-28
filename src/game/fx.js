// Particles, floating text, screen shake, flashes and banners.

import { G, view } from './state.js';
import { rand, TAU } from '../core/math.js';
import { glow } from '../render/sprites.js';
import { profile } from '../core/storage.js';

const free = [];
const MAX_PARTICLES = 900;

function spawn() {
  if (G.particles.length >= MAX_PARTICLES * view.quality) return null;
  const p = free.pop() || {};
  G.particles.push(p);
  return p;
}

// kind: spark (streak), dot (glow blob), ring (expanding circle), flash (big glow)
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
}

export function explosion(x, y, color, size = 1) {
  const q = view.quality;
  particle('flash', x, y, 0, 0, 0.18 + size * 0.05, 50 * size, color, 0);
  particle('flash', x, y, 0, 0, 0.12, 26 * size, '#ffffff', 0);
  particle('ring', x, y, 0, 0, 0.35 + size * 0.1, 14 + 26 * size, color, 0);
  const n = Math.round((8 + 10 * size) * q);
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU);
    const s = rand(80, 380) * (0.6 + size * 0.4);
    particle('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.25, 0.55), rand(1.2, 2.4), i % 3 ? color : '#ffffff', 4);
  }
  const d = Math.round((3 + 4 * size) * q);
  for (let i = 0; i < d; i++) {
    const a = rand(0, TAU);
    const s = rand(20, 140) * size;
    particle('dot', x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.4, 0.9), rand(8, 16) * Math.min(2, size), color, 2);
  }
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
  // Keep labels fully on screen.
  const half = Math.min(view.W / 2, text.length * size * 0.42);
  x = Math.max(half + 4, Math.min(view.W - half - 4, x));
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

export function drawTexts(ctx) {
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
    ctx.globalAlpha = Math.min(1, k * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(t.text, t.x + 1, t.y + 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
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

export function banner(title, sub = '', color = '#3ff6ff', dur = 2.2) {
  G.banner = { title, sub, color, t: 0, dur };
}
