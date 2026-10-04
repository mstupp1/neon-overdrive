// Top-down obstacle fields: hard structures that drift down with the scroll in some zones (the chase view's gates,
// brought to the regular levels). Three kinds, all axis-aligned boxes:
//  - block: an armoured bulkhead. Can't be destroyed; soaks shots from both sides (cover) and shoves the ship aside.
//    It only hurts if it pins the ship against the bottom of the field.
//  - crate: a barricade with HP. Blocks shots both ways until it is shot apart (a little XP and score).
//  - cell: a volatile crate. Breaking it sets off a blast that hurts nearby enemies and wipes nearby enemy shots.
// The director (director.js) decides which zones are obstacle fields (rollField) and asks for formations
// (spawnFormation) while the waves run; they only ever exist in the top-down view.

import { G, view } from './state.js';
import { rand, randInt, chance, clamp, TAU, dist2, weightedPick } from '../core/math.js';
import { sparks, explosion, ring, addShake, floatText } from './fx.js';
import { damageEnemy } from './enemies.js';
import { hurtPlayer, addScore, playfieldBounds } from './player.js';
import { dropXp } from './pickups.js';
import { clearBullets } from './bullets.js';
import { bg } from '../render/background.js';
import { sfx } from '../core/audio.js';

const list = G.obstacles;
const BODY = 11; // the ship's solid size against obstacles (its bullet hitbox is far smaller)
const SPEED = 64; // px/s at cruise; Boost speeds the scroll and these with it
const COL = { crate: '#ffb02e', cell: '#ff4d3d' };
const CELL_R = 96;

// --- Fields ------------------------------------------------------------------------------------------------------

// Whether a zone is an obstacle field, and how busy. Never on the first level; then a minority of zones, more often
// (and with more kinds) the deeper the run goes. lvl = sector level + 9 per loop.
export function rollField(lvl, rng = Math.random) {
  if (lvl < 2) return null;
  const odds = Math.min(0.42, 0.1 + 0.045 * lvl);
  if (rng() >= odds) return null;
  return { lvl, every: Math.max(6.2, 10.5 - lvl * 0.45) };
}

const FORMATIONS = [
  { id: 'pillars', min: 2, w: 3 },
  { id: 'crates', min: 2, w: 3 },
  { id: 'barricade', min: 3, w: 2 },
  { id: 'wall', min: 4, w: 1.6 },
  { id: 'lockedWall', min: 5, w: 1.4 },
  { id: 'cells', min: 4, w: 1.6 },
];

function add(kind, x, y, w, h, hp = 0) {
  const o = { kind, x, y: y - h / 2, w, h, hp, maxHp: hp, flash: 0, t: 0, ghost: 0, seed: rand(0, 100), dead: false };
  list.push(o);
  return o;
}

const crateHp = (lvl) => 9 * Math.sqrt(G.director.diff.hp) * (1 + 0.04 * lvl);

// A wall across the field with one gap, placed within a comfortable swing of the ship.
function gapRow(kind, lvl, y, gapW, fillGap = null) {
  const W = view.W;
  const p = G.player;
  const gx = clamp((p ? p.x : W / 2) + rand(-150, 150), gapW / 2 + 20, W - gapW / 2 - 20);
  const segs = [
    [0, gx - gapW / 2],
    [gx + gapW / 2, W],
  ];
  const h = kind === 'block' ? 26 : 30;
  for (const [a, b] of segs) {
    const len = b - a;
    if (len < 12) continue;
    const n = Math.max(1, Math.round(len / 78));
    for (let i = 0; i < n; i++) {
      const x0 = a + (i * len) / n;
      const x1 = a + ((i + 1) * len) / n;
      add(kind, (x0 + x1) / 2, y, x1 - x0 - 4, h, kind === 'block' ? 0 : crateHp(lvl));
    }
  }
  if (fillGap) add(fillGap, gx, y, gapW - 4, 30, crateHp(lvl) * 1.3);
}

export function spawnFormation(field) {
  const lvl = field.lvl;
  const W = view.W;
  const pool = FORMATIONS.filter((f) => f.min <= lvl);
  const f = weightedPick(pool, (q) => q.w);
  const top = -30;
  switch (f.id) {
    case 'pillars': {
      // 2-3 bulkheads in staggered columns.
      const n = lvl >= 5 ? 3 : 2;
      const lanes = [0.18, 0.5, 0.82].sort(() => Math.random() - 0.5).slice(0, n);
      lanes.forEach((u, i) => add('block', clamp(W * u + rand(-30, 30), 50, W - 50), top - i * 120, rand(52, 78), rand(44, 70)));
      break;
    }
    case 'crates': {
      // A loose cluster of barricades, sometimes with a volatile cell in it.
      const cx = rand(110, W - 110);
      const n = randInt(3, 4 + Math.min(2, Math.floor(lvl / 4)));
      for (let i = 0; i < n; i++) {
        const kind = lvl >= 4 && i === 0 && chance(0.5) ? 'cell' : 'crate';
        add(kind, clamp(cx + rand(-90, 90), 30, W - 30), top - rand(0, 110), 34, 34, crateHp(lvl) * (kind === 'cell' ? 0.6 : 1));
      }
      break;
    }
    case 'barricade': {
      // A full row of crates: shoot a hole through it (or go round the slower way, when there is room).
      const n = 6;
      const w = W / n;
      for (let i = 0; i < n; i++) add(i === randInt(0, n - 1) && lvl >= 4 ? 'cell' : 'crate', w * (i + 0.5), top, w - 6, 30, crateHp(lvl));
      break;
    }
    case 'wall':
      gapRow('block', lvl, top, rand(120, 150));
      break;
    case 'lockedWall':
      // A bulkhead wall whose only way through is a crate that has to be shot open.
      gapRow('block', lvl, top, 110, 'crate');
      break;
    case 'cells': {
      // Volatile cells drifting through: pop them when enemies pass by.
      const n = 2 + (lvl >= 7 ? 1 : 0);
      for (let i = 0; i < n; i++) add('cell', rand(50, W - 50), top - i * 90, 30, 30, crateHp(lvl) * 0.6);
      break;
    }
  }
}

export function clearObstacles(burst = false) {
  if (burst) for (const o of list) if (o.y + o.h > 0 && o.y < view.H) sparks(o.x, o.y + o.h / 2, o.kind === 'block' ? '#9fd8ff' : COL[o.kind], 4, 160);
  list.length = 0;
}

// --- Simulation -------------------------------------------------------------------------------------------------

export function updateObstacles(dt) {
  if (!list.length) return;
  const vy = SPEED * (bg.boost || 1);
  let w = 0;
  for (const o of list) {
    if (o.dead) continue;
    o.t += dt;
    o.y += vy * dt;
    if (o.flash > 0) o.flash -= dt;
    if (o.ghost > 0) o.ghost -= dt;
    if (o.y > view.H + 40) continue;
    list[w++] = o;
  }
  list.length = w;
}

const inBox = (o, x, y, r) => x > o.x - o.w / 2 - r && x < o.x + o.w / 2 + r && y > o.y - r && y < o.y + o.h + r;

function breakCrate(o) {
  o.dead = true;
  const cx = o.x;
  const cy = o.y + o.h / 2;
  explosion(cx, cy, COL[o.kind], o.kind === 'cell' ? 1.3 : 0.8);
  sfx.explode(o.kind === 'cell' ? 1.2 : 0.7);
  addScore(o.kind === 'cell' ? 250 : 120);
  dropXp(cx, cy, Math.max(1, Math.round(1.5 * G.director.diff.xp)));
  if (o.kind !== 'cell') return;
  // Volatile cell: a blast that hits enemies (and other obstacles' crates) and wipes the enemy shots around it.
  ring(cx, cy, CELL_R, COL.cell, 0.45);
  addShake(0.35);
  clearBullets(cx, cy, CELL_R);
  const dmg = 22 * Math.sqrt(G.director.diff.hp);
  for (const e of G.enemies) {
    if (e.dead || !e.entered || e.boss) continue;
    if (dist2(cx, cy, e.x, e.y) < (CELL_R + e.r) * (CELL_R + e.r)) damageEnemy(e, dmg, e.x, e.y);
  }
  for (const q of list) {
    if (q.dead || q.kind === 'block' || q === o) continue;
    if (dist2(cx, cy, q.x, q.y + q.h / 2) < CELL_R * CELL_R) hitCrate(q, q.maxHp * 0.7);
  }
  floatText(cx, cy - 20, 'BLAST', COL.cell, 11, 0.7);
}

function hitCrate(o, dmg) {
  if (o.dead) return;
  o.hp -= dmg;
  o.flash = 0.06;
  if (o.hp <= 0) breakCrate(o);
}

// Called from world.js collide() in the top-down view: shots against obstacles, then the ship against them.
export function collideObstacles(p) {
  if (!list.length) return;
  for (const b of G.pBullets) {
    if (b.dead) continue;
    for (const o of list) {
      if (o.dead || !inBox(o, b.x, b.y, b.r * 0.5)) continue;
      b.dead = true;
      if (o.kind === 'block') sparks(b.x, b.y, '#cfe9ff', 1, 120, Math.atan2(-b.vy, -b.vx), 1.4);
      else {
        sparks(b.x, b.y, COL[o.kind], 2, 150, Math.atan2(-b.vy, -b.vx), 1.4);
        hitCrate(o, b.dmg);
      }
      break;
    }
  }
  for (const b of G.eBullets) {
    if (b.dead || b.delay > 0) continue;
    for (const o of list) {
      if (o.dead || !inBox(o, b.x, b.y, 0)) continue;
      b.dead = true;
      sparks(b.x, b.y, '#ffffff', 1, 90);
      break;
    }
  }
  if (!p || p.dead) return;
  const lim = playfieldBounds();
  for (const o of list) {
    if (o.dead || o.ghost > 0) continue;
    // Circle vs box: the nearest point of the box, and the push out of it.
    const x0 = o.x - o.w / 2;
    const x1 = o.x + o.w / 2;
    const y0 = o.y;
    const y1 = o.y + o.h;
    const nx = clamp(p.x, x0, x1);
    const ny = clamp(p.y, y0, y1);
    let dx = p.x - nx;
    let dy = p.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= BODY * BODY) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      p.x += (dx / d) * (BODY - d);
      p.y += (dy / d) * (BODY - d);
    } else {
      // Centre inside the box: out the nearest side.
      const opts = [
        [x0 - BODY - p.x, 0],
        [x1 + BODY - p.x, 0],
        [0, y1 + BODY - p.y],
        [0, y0 - BODY - p.y],
      ];
      opts.sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) - Math.abs(b[0]) - Math.abs(b[1]));
      p.x += opts[0][0];
      p.y += opts[0][1];
    }
    p.x = clamp(p.x, lim.left, lim.right);
    if (p.y > lim.bottom) {
      // Pinned against the bottom: it scrapes through, at a cost.
      p.y = lim.bottom;
      o.ghost = 1.4;
      if (!(p.iframes > 0 || p.dashT > 0)) {
        sparks(p.x, p.y, '#ff3d7a', 12, 260);
        hurtPlayer(p);
      }
    }
  }
}

// --- Rendering ---------------------------------------------------------------------------------------------------

function rectPath(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
}

export function drawObstacles(ctx) {
  if (!list.length) return;
  const hue = Math.round(bg.hue || 215);
  const t = G.time;
  for (const o of list) {
    if (o.dead) continue;
    const x = o.x - o.w / 2;
    const y = o.y;
    const { w, h } = o;
    if (y > view.H + 10 || y + h < -10) continue;
    const hit = o.flash > 0;
    if (o.kind === 'block') {
      const edge = `hsl(${hue},60%,78%)`;
      // Dark armoured body with hazard hatching, so it reads as solid against the grid.
      ctx.fillStyle = `hsla(${hue},45%,7%,0.92)`;
      ctx.fillRect(x, y, w, h);
      ctx.save();
      rectPath(ctx, x, y, w, h);
      ctx.clip();
      ctx.strokeStyle = `hsla(${hue},70%,60%,0.16)`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let s = -h; s < w; s += 14) {
        ctx.moveTo(x + s, y + h);
        ctx.lineTo(x + s + h, y);
      }
      ctx.stroke();
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `hsla(${hue},90%,60%,0.25)`;
      ctx.lineWidth = 6;
      rectPath(ctx, x, y, w, h);
      ctx.stroke();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // Inner frame and corner bolts
      ctx.strokeStyle = `hsla(${hue},80%,70%,0.35)`;
      ctx.lineWidth = 1;
      rectPath(ctx, x + 4, y + 4, w - 8, h - 8);
      ctx.stroke();
      ctx.fillStyle = edge;
      for (const [bx, by] of [[x + 4, y + 4], [x + w - 6, y + 4], [x + 4, y + h - 6], [x + w - 6, y + h - 6]]) ctx.fillRect(bx, by, 2, 2);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      const col = COL[o.kind];
      const k = o.hp / o.maxHp;
      ctx.fillStyle = hit ? 'rgba(90,52,20,0.92)' : 'rgba(20,10,4,0.88)';
      ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 6;
      rectPath(ctx, x, y, w, h);
      ctx.stroke();
      ctx.globalAlpha = 0.55 + 0.45 * k;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      if (o.kind === 'crate') {
        // Cross bracing in square bays; cracks open up as it takes damage.
        rectPath(ctx, x + 4, y + 4, w - 8, h - 8);
        ctx.stroke();
        const bays = Math.max(1, Math.round((w - 8) / (h - 8)));
        const bw = (w - 8) / bays;
        ctx.beginPath();
        for (let i = 0; i < bays; i++) {
          const bx = x + 4 + i * bw;
          if (i) {
            ctx.moveTo(bx, y + 4);
            ctx.lineTo(bx, y + h - 4);
          }
          ctx.moveTo(bx, y + 4);
          ctx.lineTo(bx + bw, y + h - 4);
          ctx.moveTo(bx + bw, y + 4);
          ctx.lineTo(bx, y + h - 4);
        }
        ctx.stroke();
        if (k < 0.66) {
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = '#fff1c9';
          ctx.beginPath();
          const cx = x + w * (0.3 + (o.seed % 0.4));
          ctx.moveTo(cx, y);
          ctx.lineTo(cx + 5, y + h * 0.35);
          ctx.lineTo(cx - 3, y + h * 0.6);
          if (k < 0.33) {
            ctx.lineTo(cx + 6, y + h);
            ctx.moveTo(cx + 5, y + h * 0.35);
            ctx.lineTo(cx + 14, y + h * 0.45);
          }
          ctx.stroke();
        }
      } else {
        // Volatile cell: a pulsing core under a hazard triangle.
        const pulse = 0.5 + 0.5 * Math.sin(t * 7 + o.seed);
        const cx = x + w / 2;
        const cy = y + h / 2;
        ctx.globalAlpha = 0.35 + 0.4 * pulse;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(w, h) * 0.32, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = '#ffe0c2';
        ctx.beginPath();
        const s = Math.min(w, h) * 0.3;
        ctx.moveTo(cx, cy - s);
        ctx.lineTo(cx + s, cy + s * 0.75);
        ctx.lineTo(cx - s, cy + s * 0.75);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (k < 1) {
        // Thin HP bar along the base.
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x + 3, y + h - 4, w - 6, 2);
        ctx.fillStyle = col;
        ctx.fillRect(x + 3, y + h - 4, (w - 6) * k, 2);
      }
    }
  }
}

// Autopilot (bot.js): a sideways nudge away from obstacles coming down on the ship.
export function obstacleSteer(p) {
  let fx = 0;
  const fy = 0;
  for (const o of list) {
    if (o.dead || o.ghost > 0) continue;
    const below = p.y - (o.y + o.h);
    if (below < -8 || below > 150) continue;
    const half = o.w / 2 + 22;
    const dx = p.x - o.x;
    if (Math.abs(dx) > half) continue;
    // Crates get shot instead, unless they are close.
    const w = (o.kind === 'block' ? 1.6 : below < 60 ? 0.9 : 0) * (1 - below / 160);
    // Head for whichever side is clear (and inside the field).
    let dir = dx >= 0 ? 1 : -1;
    if (o.x + dir * half > view.W - 20) dir = -1;
    if (o.x + dir * half < 20) dir = 1;
    fx += dir * w;
  }
  return { fx, fy };
}
