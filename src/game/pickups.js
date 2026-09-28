// XP gems and power-up pickups with magnet behaviour.

import { G, view } from './state.js';
import { S } from '../render/sprites.js';
import { rand, TAU, dist2 } from '../core/math.js';
import { collectPickup } from './player.js';

const free = [];

function make(type, x, y, val) {
  const p = free.pop() || {};
  const a = rand(0, TAU);
  const s = rand(40, 140);
  p.type = type;
  p.x = x;
  p.y = y;
  p.vx = Math.cos(a) * s;
  p.vy = Math.sin(a) * s - 40;
  p.val = val;
  p.t = 0;
  p.pull = false;
  p.dead = false;
  p.life = type === 'xp' ? 14 : 12;
  if (type === 'xp') p.spr = val >= 20 ? S.gem4 : val >= 8 ? S.gem3 : val >= 3 ? S.gem2 : S.gem1;
  else p.spr = S[type];
  G.pickups.push(p);
  return p;
}

// Split an XP amount into a handful of gems.
export function dropXp(x, y, amount) {
  if (G.pickups.length > 260) {
    // Too many on screen: merge into a single dense gem.
    make('xp', x, y, amount);
    return;
  }
  let pieces = amount <= 2 ? 1 : amount <= 6 ? 2 : amount <= 20 ? 3 : amount <= 60 ? 5 : 8;
  const each = Math.floor(amount / pieces);
  let rem = amount - each * pieces;
  for (let i = 0; i < pieces; i++) {
    make('xp', x + rand(-6, 6), y + rand(-6, 6), each + (rem-- > 0 ? 1 : 0));
  }
}

export function dropPickup(x, y, type) {
  const p = make(type, x, y, 0);
  p.vy = -60;
  p.vx = rand(-40, 40);
  return p;
}

export function vacuumAll() {
  for (const p of G.pickups) p.pull = true;
}

export function updatePickups(dt) {
  const pl = G.player;
  const arr = G.pickups;
  const magR2 = pl.st.magnet * pl.st.magnet;
  const allPull = pl.odT > 0 || G.vacuum;
  let w = 0;
  for (const p of arr) {
    p.t += dt;
    if (!p.dead) {
      const d2 = dist2(p.x, p.y, pl.x, pl.y);
      if (!p.pull && (allPull && p.type === 'xp' ? true : d2 < magR2) && !pl.dead) p.pull = true;
      if (p.pull && !pl.dead) {
        const d = Math.sqrt(d2) || 1;
        const sp = 260 + p.t * 40 + Math.max(0, 600 - d);
        const k = Math.min(1, 12 * dt);
        p.vx += ((pl.x - p.x) / d * sp - p.vx) * k;
        p.vy += ((pl.y - p.y) / d * sp - p.vy) * k;
      } else {
        p.vx *= 1 - 2.5 * dt;
        p.vy += (35 - p.vy) * 2 * dt; // gentle downward drift
        p.life -= dt;
        if (p.life <= 0) p.dead = true;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 8) { p.x = 8; p.vx = Math.abs(p.vx); }
      if (p.x > view.W - 8) { p.x = view.W - 8; p.vx = -Math.abs(p.vx); }
      if (p.y > view.H + 20) p.dead = true;
      if (!pl.dead && d2 < 20 * 20) {
        p.dead = true;
        collectPickup(p);
      }
    }
    if (p.dead) {
      free.push(p);
      continue;
    }
    arr[w++] = p;
  }
  arr.length = w;
}

export function drawPickups(ctx) {
  ctx.globalCompositeOperation = 'lighter';
  const time = G.time;
  for (const p of G.pickups) {
    const s = p.spr;
    let a = 1;
    if (!p.pull && p.life < 3) a = Math.sin(p.life * 18) > 0 ? 0.9 : 0.25;
    ctx.globalAlpha = a;
    let sz = s.size;
    if (p.type !== 'xp') sz *= 1 + Math.sin(time * 6) * 0.08;
    ctx.drawImage(s.img, p.x - sz / 2, p.y - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
