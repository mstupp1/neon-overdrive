// Player and enemy projectiles (pooled).

import { G, view, field, inField } from './state.js';
import { S } from '../render/sprites.js';
import { TAU, turnToward, dist2 } from '../core/math.js';
import { sparks, explosion } from './fx.js';

const pFree = [];
const eFree = [];
const MAX_ENEMY_BULLETS = 650;

// --- Player bullets -------------------------------------------------------------

export function playerBullet(x, y, angle, speed, dmg, spr, opts = {}) {
  const b = pFree.pop() || { hits: [] };
  const st = G.player && G.player.st;
  const pz = (st && st.projSize) || 1; // Wide Rounds
  speed *= (st && st.projSpeed) || 1; // Accelerator Coils
  b.x = x;
  b.y = y;
  b.vx = Math.cos(angle) * speed;
  b.vy = Math.sin(angle) * speed;
  b.speed = speed;
  b.dmg = dmg;
  b.spr = spr;
  b.r = (opts.r || 4) * pz;
  b.scale = (opts.scale || 1) * pz;
  b.life = opts.life || 2;
  b.pierce = opts.pierce || 0;
  b.homing = opts.homing || 0;
  b.target = null;
  b.aoe = opts.aoe || 0;
  b.bounce = opts.bounce || 0;
  b.crit = !!opts.crit; // always crits on hit
  b.kind = opts.kind || 'bullet';
  b.primary = !!opts.primary; // main-gun shot (Splinter Rounds)
  b.alpha = opts.alpha || 0.9;
  b.wave = opts.wave || 0; // sine weave amplitude (WRAITH), px
  b.wph = opts.wphase || 0;
  b.wf = opts.wfreq || 0;
  b.wt = 0;
  b.woff = 0;
  b.wnx = opts.wn ? opts.wn[0] : 1; // weave axis (sideways to the ship's facing)
  b.wny = opts.wn ? opts.wn[1] : 0;
  b.home = opts.home ?? -Math.PI / 2; // heading a missile settles on with nothing to chase
  b.age = 0;
  b.seed = Math.random() * 64; // offsets the animation cycle so a volley doesn't flicker in lockstep
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
      b.age += dt;
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
          const na = turnToward(a, b.home, 3 * dt);
          b.vx = Math.cos(na) * b.speed;
          b.vy = Math.sin(na) * b.speed;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.wave) {
        b.wt += dt;
        const off = b.wave * Math.sin(b.wt * b.wf + b.wph) * Math.min(1, b.wt * 8); // eases in from the muzzle
        b.x += (off - b.woff) * b.wnx;
        b.y += (off - b.woff) * b.wny;
        b.woff = off;
      }
      const L = field.ow ? field.x0 : 0;
      const R = field.ow ? field.x1 : view.W;
      if (b.bounce > 0 && (b.x < L || b.x > R)) {
        b.bounce--;
        b.vx = -b.vx;
        b.x = b.x < L ? 2 * L - b.x : 2 * R - b.x;
        b.hits.length = 0;
        sparks(b.x < (L + R) / 2 ? L : R, b.y, '#ffb066', 3, 140);
      }
      if (b.life <= 0 || !inField(b.x, b.y, 30)) b.dead = true;
    }
    if (b.dead) {
      pFree.push(b);
      continue;
    }
    arr[w++] = b;
  }
  arr.length = w;
}

// Styled shots (render/shots.js) draw a trail strip behind an animated head; plain sprites (missiles, blades) draw as
// before. In the rotated frame local -y points along the flight, so the trail runs down +y.
export function drawPlayerBullets(ctx, k) {
  ctx.globalCompositeOperation = 'lighter';
  const T = G.time;
  const ox = view.ox;
  const oy = view.oy;
  for (const b of G.pBullets) {
    const s = b.spr;
    const sz = s.size * b.scale;
    const v2 = b.vx * b.vx + b.vy * b.vy;
    ctx.globalAlpha = b.alpha;
    let c = 1;
    let sn = 0;
    if (v2 > 0) {
      const inv = 1 / Math.sqrt(v2);
      c = -b.vy * inv;
      sn = b.vx * inv;
    }
    const tx = b.x * k + ox;
    const ty = b.y * k + oy;
    const fi = s.frames ? (T * s.fps + b.seed) | 0 : 0;
    if (s.trails && v2 > 0) {
      const len = s.tl * b.scale * Math.min(1, b.age * 12 + 0.2); // grows out of the muzzle
      const w = s.tw * b.scale;
      ctx.setTransform(c * k, sn * k, -sn * k, c * k, tx, ty);
      ctx.drawImage(s.trails[fi % s.nt], -w / 2, -1, w, len);
    }
    const img = s.frames ? s.frames[fi % s.nf] : s.img;
    if (s.spin) {
      const a = T * s.spin + b.seed;
      const rc = Math.cos(a) * k;
      const rs = Math.sin(a) * k;
      ctx.setTransform(rc, rs, -rs, rc, tx, ty);
    } else if (v2 === 0 || (b.kind === 'orb' && !s.frames)) {
      ctx.setTransform(k, 0, 0, k, ox, oy);
      ctx.drawImage(img, b.x - sz / 2, b.y - sz / 2, sz, sz);
      continue;
    } else ctx.setTransform(c * k, sn * k, -sn * k, c * k, tx, ty);
    ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
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
  shell: { r: 7.5, spr: 'eb_shell' }, // armoured fuse bomb (tanks): bursts into `burst` small shots at `fuse` s
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
  b.hp = opts.hp || 0; // > 0: shootable (world.js collide), drawn armoured with a target ring and HP arc
  b.maxHp = b.hp;
  b.fuse = opts.fuse || 0;
  b.burst = opts.burst || 8;
  b.seed = Math.random() * 6;
  b.flash = 0;
  b.grazed = false;
  b.slowed = false; // Stasis Pulse / Null Field already applied
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
      if (b.fuse && b.t >= b.fuse) {
        // Fuse ran out: the shell bursts (shots pushed now are picked up later in this same pass).
        explosion(b.x, b.y, '#ff6a2b', 0.55);
        ring(b.x, b.y, b.burst, 120, 'small', b.seed);
        b.dead = true;
        eFree.push(b);
        continue;
      }
      if (b.acc) {
        const sp = Math.hypot(b.vx, b.vy);
        const ns = Math.max(0, b.maxSpeed ? Math.min(b.maxSpeed, sp + b.acc * dt) : sp + b.acc * dt);
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
      if (field.ow ? !inField(b.x, b.y, 120) : b.x < -40 || b.x > view.W + 40 || b.y < -60 || b.y > view.H + 40) b.dead = true;
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
  let rotated = false;
  let armored = 0;
  const T = G.time;
  for (const b of G.eBullets) {
    if (b.delay > 0) continue;
    if (b.hp > 0) {
      armored++; // drawn on top, below
      continue;
    }
    const s = b.spr;
    if (b.rotate) {
      const a = Math.atan2(b.vy, b.vx) - Math.PI / 2;
      const c = Math.cos(a) * k;
      const sn = Math.sin(a) * k;
      ctx.setTransform(c, sn, -sn, c, b.x * k + view.ox, b.y * k + view.oy);
      ctx.drawImage(s.img, -s.half, -s.half, s.size, s.size);
      rotated = true;
    } else {
      // Undo the last needle's per-bullet transform, or this bullet is drawn offset by that one's position.
      if (rotated) {
        ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
        rotated = false;
      }
      // Spawn-in pop so new bullets are noticeable, then a faint menacing throb.
      const grow = b.t < 0.08 ? 0.6 + b.t * 5 : 1 + 0.07 * Math.sin(T * 13 + b.seed);
      const sz = s.size * grow;
      ctx.drawImage(s.img, b.x - sz / 2, b.y - sz / 2, sz, sz);
    }
  }
  ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
  if (armored) drawArmored(ctx, k, T);
}

// Shootable projectiles: armoured body (white on a hit), a turning lime target ring, an HP arc, and for shells a fuse
// light that blinks faster as it runs out.
function drawArmored(ctx, k, T) {
  const tgt = S.eb_target;
  for (const b of G.eBullets) {
    if (b.delay > 0 || !(b.hp > 0)) continue;
    const flashed = b.flash > 0;
    const s = b.type === 'torpedo' ? (flashed ? S.eb_torpedo_flash : b.spr) : b.spr;
    const a = b.rotate ? Math.atan2(b.vy, b.vx) - Math.PI / 2 : T * 1.4 + b.seed;
    let c = Math.cos(a) * k;
    let sn = Math.sin(a) * k;
    ctx.setTransform(c, sn, -sn, c, b.x * k + view.ox, b.y * k + view.oy);
    ctx.drawImage(s.img, -s.half, -s.half, s.size, s.size);
    if (flashed && b.type === 'shell') ctx.drawImage(S.eb_shell_flash.img, -s.half, -s.half, s.size, s.size);
    // Target ring, scaled to the body and turning the other way.
    const rs = (b.r + 7) / 17;
    const ra = -T * 2 + b.seed;
    c = Math.cos(ra) * k * rs;
    sn = Math.sin(ra) * k * rs;
    ctx.setTransform(c, sn, -sn, c, b.x * k + view.ox, b.y * k + view.oy);
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(T * 9 + b.seed);
    ctx.drawImage(tgt.img, -tgt.half, -tgt.half, tgt.size, tgt.size);
    ctx.globalAlpha = 1;
  }
  ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
  // HP arcs and fuse lights in one pass, plain transform.
  ctx.lineCap = 'round';
  for (const b of G.eBullets) {
    if (b.delay > 0 || !(b.hp > 0)) continue;
    const R = b.r + 11;
    const f = Math.max(0, b.hp / b.maxHp);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(b.x, b.y, R, -Math.PI / 2, -Math.PI / 2 + TAU * f);
    ctx.stroke();
    ctx.strokeStyle = f > 0.5 ? '#b4ff3a' : f > 0.25 ? '#ffe14d' : '#ff4d4d';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    if (b.fuse) {
      const left = Math.max(0, b.fuse - b.t);
      const on = Math.sin((b.fuse - left) * (8 + (1 - left / b.fuse) * 30)) > 0;
      ctx.fillStyle = on ? '#ffffff' : '#ff6a2b';
      ctx.beginPath();
      ctx.arc(b.x, b.y, on ? 2.6 : 1.8, 0, TAU);
      ctx.fill();
    }
  }
  ctx.lineCap = 'butt';
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
