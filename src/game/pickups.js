// XP gems and power-up pickups with magnet behaviour.
//
// Drops are meant to be missable: in a fight they fall back past the ship with the scroll, and every drop expires.
// Over its last WARN seconds a drop blinks, faster and faster, flashing brighter and bigger on each blink, then winks
// out. Once the magnet (pickup range) catches a drop it is yours: it no longer falls or expires.

import { G, view, field } from './state.js';
import { S, glow } from '../render/sprites.js';
import { rand, TAU, dist2 } from '../core/math.js';
import { collectPickup } from './player.js';
import { sparks } from './fx.js';

const free = [];

const DRIFT = 115; // fall speed (px/s) in an 800-deep field; deeper fields (chase view) scale it to cross in the same time
const WARN = 2.5; // seconds of blinking before a drop expires
const LIFE = { xp: 7, credit: 8, relic: 14 }; // seconds; power-ups (heart, magnet, cell) get LIFE_POWER
const LIFE_POWER = 9;
const SLOW = { relic: 0.5 }; // relic caches fall at half speed so a rare find is not gone in a blink

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
  p.life = LIFE[type] || LIFE_POWER;
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

// Gold credit chip; `val` is the raw amount (multipliers apply on collection).
export function dropCredit(x, y, val) {
  if (G.pickups.length > 300) return;
  return make('credit', x + rand(-6, 6), y + rand(-6, 6), val);
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
  const fall = DRIFT * (view.H / 800);
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
        if (field.ow) p.vy *= 1 - 2.5 * dt; // open space: no scroll to drift with
        else p.vy += (fall * (SLOW[p.type] || 1) - p.vy) * 2 * dt; // falls back with the scroll
        p.life -= dt;
        if (p.life <= 0) {
          p.dead = true;
          sparks(p.x, p.y, p.type === 'xp' ? '#9ffcff' : '#ffffff', 3, 90); // winks out
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (!field.ow) {
        if (p.x < 8) { p.x = 8; p.vx = Math.abs(p.vx); }
        if (p.x > view.W - 8) { p.x = view.W - 8; p.vx = -Math.abs(p.vx); }
        if (p.y > view.H + 20) p.dead = true;
      }
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

export function drawPickups(ctx, list = G.pickups) {
  ctx.globalCompositeOperation = 'lighter';
  const time = G.time;
  for (const p of list) {
    const s = p.spr;
    let a = 1;
    let sz = s.size;
    let hot = 0; // expiry flash, 0..1
    if (!p.pull && p.life < WARN) {
      // Blink faster as it runs out (about 3 to 9 blinks a second); each blink flares bright and a little bigger.
      const u = 1 - p.life / WARN;
      const on = Math.sin(p.t * (18 + 40 * u)) > 0;
      a = on ? 1 : 0.22;
      hot = on ? 0.55 + 0.45 * u : 0;
      sz *= 1 + hot * 0.3;
      if (p.life < 0.25) sz *= p.life / 0.25; // shrink away at the very end
    }
    ctx.globalAlpha = a;
    if (p.type !== 'xp' && p.type !== 'credit') sz *= 1 + Math.sin(time * 6) * 0.08;
    if (hot > 0) {
      const g = glow('#ffffff', 48);
      const gs = sz * 1.7;
      ctx.globalAlpha = hot * 0.32;
      ctx.drawImage(g.img, p.x - gs / 2, p.y - gs / 2, gs, gs);
      ctx.globalAlpha = a;
    }
    if (p.type === 'relic') {
      // Relic cache: a slow golden beacon so it reads as loot, not a gem.
      const g = glow('#ffd24a', 64);
      ctx.globalAlpha = a * (0.55 + 0.25 * Math.sin(time * 3));
      ctx.drawImage(g.img, p.x - 32, p.y - 32, 64, 64);
      ctx.globalAlpha = a;
    }
    ctx.drawImage(s.img, p.x - sz / 2, p.y - sz / 2, sz, sz);
    if (hot > 0) {
      // A second additive pass makes the blink read brighter, not just bigger.
      ctx.globalAlpha = hot * 0.8;
      ctx.drawImage(s.img, p.x - sz / 2, p.y - sz / 2, sz, sz);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
