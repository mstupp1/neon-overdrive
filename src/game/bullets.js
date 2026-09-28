// Player and enemy projectiles (pooled).

import { G, view } from './state.js';
import { S } from '../render/sprites.js';
import { TAU, turnToward, dist2 } from '../core/math.js';
import { sparks } from './fx.js';

const pFree = [];
const eFree = [];
const MAX_ENEMY_BULLETS = 650;

// --- Player bullets -------------------------------------------------------------

export function playerBullet(x, y, angle, speed, dmg, spr, opts = {}) {
  const b = pFree.pop() || { hits: [] };
  b.x = x;
  b.y = y;
  b.vx = Math.cos(angle) * speed;
  b.vy = Math.sin(angle) * speed;
  b.speed = speed;
  b.dmg = dmg;
  b.spr = spr;
  b.r = opts.r || 4;
  b.scale = opts.scale || 1;
  b.life = opts.life || 2;
  b.pierce = opts.pierce || 0;
  b.homing = opts.homing || 0;
  b.target = null;
  b.aoe = opts.aoe || 0;
  b.kind = opts.kind || 'bullet';
  b.alpha = opts.alpha || 0.9;
  b.hits.length = 0;
  b.dead = false;
  G.pBullets.push(b);
  return b;
}

function nearestEnemy(x, y, maxD2 = Infinity) {
  let best = null;
  let bd = maxD2;
  for (const e of G.enemies) {
    if (e.dead || !e.entered || e.untargetable) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}
export { nearestEnemy };

export function updatePlayerBullets(dt) {
  const arr = G.pBullets;
  let w = 0;
  for (const b of arr) {
    if (!b.dead) {
      b.life -= dt;
      if (b.homing) {
        if (!b.target || b.target.dead) b.target = nearestEnemy(b.x, b.y, 420 * 420);
        if (b.target) {
          const a = Math.atan2(b.vy, b.vx);
          const want = Math.atan2(b.target.y - b.y, b.target.x - b.x);
          const na = turnToward(a, want, b.homing * dt);
          if (b.kind === 'missile') b.speed = Math.min(760, b.speed + 900 * dt);
          b.vx = Math.cos(na) * b.speed;
          b.vy = Math.sin(na) * b.speed;
        } else if (b.kind === 'missile') {
          b.speed = Math.min(760, b.speed + 900 * dt);
          const a = Math.atan2(b.vy, b.vx);
          const na = turnToward(a, -Math.PI / 2, 3 * dt);
          b.vx = Math.cos(na) * b.speed;
          b.vy = Math.sin(na) * b.speed;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.y < -30 || b.y > view.H + 30 || b.x < -30 || b.x > view.W + 30) b.dead = true;
    }
    if (b.dead) {
      pFree.push(b);
      continue;
    }
    arr[w++] = b;
  }
  arr.length = w;
}

export function drawPlayerBullets(ctx, k) {
  ctx.globalCompositeOperation = 'lighter';
  for (const b of G.pBullets) {
    const s = b.spr;
    const sz = s.size * b.scale;
    ctx.globalAlpha = b.alpha;
    if (b.vx === 0 || b.kind === 'orb') {
      ctx.drawImage(s.img, b.x - sz / 2, b.y - sz / 2, sz, sz);
    } else {
      const a = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      const c = Math.cos(a) * k;
      const sn = Math.sin(a) * k;
      ctx.setTransform(c, sn, -sn, c, b.x * k + view.ox, b.y * k + view.oy);
      ctx.drawImage(s.img, -sz / 2, -sz / 2, sz, sz);
    }
  }
  ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// --- Enemy bullets ----------------------------------------------------------------

const EB = {
  orb: { r: 4.6, spr: 'eb_orb' },
  small: { r: 3.4, spr: 'eb_small' },
  big: { r: 8.5, spr: 'eb_big' },
  wobble: { r: 4.6, spr: 'eb_wobble' },
  needle: { r: 3.4, spr: 'eb_needle', rotate: true },
  torpedo: { r: 8, spr: 'eb_torpedo', rotate: true },
};

// speed is multiplied by the current sector's bullet-speed modifier.
export function shoot(x, y, angle, speed, type = 'orb', opts = {}) {
  if (G.eBullets.length >= MAX_ENEMY_BULLETS) return null;
  const def = EB[type];
  const mul = G.director ? G.director.diff.bulletSpeed : 1;
  const b = eFree.pop() || {};
  const sp = speed * mul;
  b.x = x;
  b.y = y;
  b.vx = Math.cos(angle) * sp;
  b.vy = Math.sin(angle) * sp;
  b.type = type;
  b.r = def.r;
  b.spr = S[def.spr];
  b.rotate = !!def.rotate;
  b.t = 0;
  b.acc = (opts.acc || 0) * mul;
  b.maxSpeed = (opts.maxSpeed || 0) * mul;
  b.wob = opts.wob || 0;
  b.wobF = opts.wobF || 6;
  b.turn = opts.turn || 0;
  b.turnTime = opts.turnTime || 0;
  b.hp = opts.hp || 0;
  b.flash = 0;
  b.grazed = false;
  b.dead = false;
  b.delay = opts.delay || 0;
  b.curve = opts.curve || 0;
  G.eBullets.push(b);
  return b;
}

export function ring(x, y, n, speed, type = 'orb', offset = 0, opts) {
  for (let i = 0; i < n; i++) shoot(x, y, offset + (i / n) * TAU, speed, type, opts);
}

export function fan(x, y, angle, n, spread, speed, type = 'orb', opts) {
  if (n === 1) return shoot(x, y, angle, speed, type, opts);
  for (let i = 0; i < n; i++) shoot(x, y, angle - spread / 2 + (spread * i) / (n - 1), speed, type, opts);
}

export function aimAt(x, y) {
  const p = G.player;
  return Math.atan2(p.y - y, p.x - x);
}

export function updateEnemyBullets(dt) {
  const arr = G.eBullets;
  const p = G.player;
  let w = 0;
  for (const b of arr) {
    if (!b.dead) {
      if (b.delay > 0) {
        b.delay -= dt;
        arr[w++] = b;
        continue;
      }
      b.t += dt;
      if (b.flash > 0) b.flash -= dt;
      if (b.acc) {
        const sp = Math.hypot(b.vx, b.vy);
        const ns = b.maxSpeed ? Math.min(b.maxSpeed, sp + b.acc * dt) : sp + b.acc * dt;
        const k = sp > 0 ? ns / sp : 1;
        b.vx *= k;
        b.vy *= k;
      }
      if (b.curve) {
        const c = Math.cos(b.curve * dt);
        const s = Math.sin(b.curve * dt);
        const vx = b.vx * c - b.vy * s;
        b.vy = b.vx * s + b.vy * c;
        b.vx = vx;
      }
      if (b.turn && p && b.t < b.turnTime) {
        const sp = Math.hypot(b.vx, b.vy);
        const a = turnToward(Math.atan2(b.vy, b.vx), Math.atan2(p.y - b.y, p.x - b.x), b.turn * dt);
        b.vx = Math.cos(a) * sp;
        b.vy = Math.sin(a) * sp;
      }
      let x = b.x + b.vx * dt;
      if (b.wob) {
        // Lateral sine wobble perpendicular to travel direction.
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const off = Math.cos(b.t * b.wobF) * b.wob * b.wobF * dt;
        x += (-b.vy / sp) * off;
        b.y += (b.vx / sp) * off;
      }
      b.x = x;
      b.y += b.vy * dt;
      if (b.x < -40 || b.x > view.W + 40 || b.y < -60 || b.y > view.H + 40) b.dead = true;
    }
    if (b.dead) {
      eFree.push(b);
      continue;
    }
    arr[w++] = b;
  }
  arr.length = w;
}

export function drawEnemyBullets(ctx, k) {
  for (const b of G.eBullets) {
    if (b.delay > 0) continue;
    const s = b.flash > 0 && b.type === 'torpedo' ? S.eb_torpedo_flash : b.spr;
    if (b.rotate) {
      const a = Math.atan2(b.vy, b.vx) - Math.PI / 2;
      const c = Math.cos(a) * k;
      const sn = Math.sin(a) * k;
      ctx.setTransform(c, sn, -sn, c, b.x * k + view.ox, b.y * k + view.oy);
      ctx.drawImage(s.img, -s.half, -s.half, s.size, s.size);
    } else {
      // Spawn-in pop so new bullets are noticeable.
      const grow = b.t < 0.08 ? 0.6 + b.t * 5 : 1;
      const sz = s.size * grow;
      ctx.drawImage(s.img, b.x - sz / 2, b.y - sz / 2, sz, sz);
    }
  }
  ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
}

// Turn bullets near a point into sparks (and optionally score/XP via callback).
export function clearBullets(x, y, radius, onClear) {
  const r2 = radius * radius;
  for (const b of G.eBullets) {
    if (b.dead || b.delay > 0) continue;
    if (radius === Infinity || dist2(x, y, b.x, b.y) < r2) {
      b.dead = true;
      sparks(b.x, b.y, '#ff9ad5', 2, 120);
      if (onClear) onClear(b);
    }
  }
}
