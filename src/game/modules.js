// Weapon modules picked up from upgrade drafts.

import { G, view } from './state.js';
import { S, glow } from '../render/sprites.js';
import { TAU, damp, dist2, rand } from '../core/math.js';
import { playerBullet, nearestEnemy, clearBullets } from './bullets.js';
import { damageEnemy } from './enemies.js';
import { ring, sparks } from './fx.js';
import { sfx } from '../core/audio.js';
import { boosted, fortressOn } from './pilot.js';

const lvl = (arr, lv) => arr[Math.min(arr.length, lv) - 1];
const TEMP_SLOTS = [[-62, 30], [62, 30]];

export function resetModules(p) {
  p.mod = { missT: 1, arcT: 1.2, novaT: 2, railT: 2, orbA: 0, droneT: 0.2 };
  p.drones = [];
}

function dmgMul(p) {
  return p.st.dmg * p.pdm * p.st.modDmg * (boosted(p) ? 1.5 : 1);
}

function rateMul(p) {
  return p.st.rate * (boosted(p) ? 1.4 : 1);
}

export function updateModules(p, dt) {
  if (p.dead) return;
  const up = p.up;
  const m = p.mod;
  const rate = rateMul(p);
  const dm = dmgMul(p);

  // Swarm missiles
  if (up.missiles) {
    const lv = up.missiles;
    m.missT -= dt * rate;
    if (m.missT <= 0) {
      m.missT = lvl([1.6, 1.4, 1.2, 1.0, 0.85], lv);
      const n = lvl([2, 2, 3, 4, 5], lv);
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        const a = -Math.PI / 2 + side * (0.9 + Math.floor(i / 2) * 0.35);
        playerBullet(p.x + side * 10, p.y + 4, a, 240, (5 + 1.5 * lv) * dm, S.missile, {
          homing: 5.5, kind: 'missile', life: 2.6, aoe: 40 + lv * 4, r: 6, alpha: 1,
        });
      }
      sfx.missile();
    }
  }

  // Razor orbit
  if (up.orbitals) {
    const lv = up.orbitals;
    const n = lv + 1;
    const radius = 50 + lv * 3;
    m.orbA += dt * (3.2 + lv * 0.2);
    const dmg = (2.5 + lv) * dm;
    for (let i = 0; i < n; i++) {
      const a = m.orbA + (i / n) * TAU;
      const bx = p.x + Math.cos(a) * radius;
      const by = p.y + Math.sin(a) * radius;
      for (const e of G.enemies) {
        if (e.dead || !e.entered) continue;
        const rr = e.r + 10;
        if (dist2(bx, by, e.x, e.y) < rr * rr && (e.orbCd || 0) <= G.time) {
          e.orbCd = G.time + 0.22;
          sparks(bx, by, '#ff3df2', 3, 200);
          damageEnemy(e, dmg, bx, by);
        }
      }
      for (const b of G.eBullets) {
        if (b.dead || b.type === 'torpedo' || (b.type === 'big' && lv < 3)) continue;
        const rr = b.r + 9;
        if (dist2(bx, by, b.x, b.y) < rr * rr) {
          b.dead = true;
          sparks(b.x, b.y, '#ff9ad5', 3, 140);
        }
      }
    }
  }

  // Wingmen. Fortress Protocol adds 2 temporary drones (aimed like level-3 wingmen when you own no module).
  const fort = fortressOn(p);
  if (up.drones || fort) {
    const lv = up.drones || 3;
    const nPerm = up.drones ? (lv >= 5 ? 3 : 2) : 0;
    const n = nPerm + (fort ? 2 : 0);
    while (p.drones.length < n) p.drones.push({ x: p.x, y: p.y + 20, ang: -Math.PI / 2 });
    p.drones.length = n;
    const slots = nPerm === 3 ? [[-36, 14], [36, 14], [0, 34]] : [[-34, 12], [34, 12]];
    p.drones.forEach((d, i) => {
      const sl = i < nPerm ? slots[i] : TEMP_SLOTS[i - nPerm];
      d.x = damp(d.x, p.x + sl[0], 9, dt);
      d.y = damp(d.y, p.y + sl[1], 9, dt);
    });
    m.droneT -= dt * rate;
    if (m.droneT <= 0) {
      m.droneT = lvl([0.42, 0.36, 0.3, 0.26, 0.22], lv);
      const dmg = lvl([1.3, 1.5, 1.7, 2.0, 2.3], lv) * dm;
      for (const d of p.drones) {
        let a = -Math.PI / 2;
        if (lv >= 3) {
          const t = nearestEnemy(d.x, d.y, 380 * 380);
          if (t) a = Math.atan2(t.y - d.y, t.x - d.x);
        }
        d.ang = a;
        playerBullet(d.x, d.y - 6, a, 900, dmg, S.pb_drone, { r: 3.5, life: 1, alpha: 0.9 });
      }
    }
  } else if (p.drones.length) p.drones.length = 0;

  // Arc coil
  if (up.arc) {
    const lv = up.arc;
    m.arcT -= dt * rate;
    if (m.arcT <= 0) {
      const first = nearestEnemy(p.x, p.y, 320 * 320);
      if (first) {
        m.arcT = lvl([1.6, 1.4, 1.2, 1.0, 0.8], lv);
        const chains = 2 + lv;
        const dmg = (7 + 3 * lv) * dm;
        const pts = [p.x, p.y - 6];
        const hit = new Set();
        let cur = first;
        for (let i = 0; i <= chains && cur; i++) {
          hit.add(cur);
          pts.push(cur.x, cur.y);
          damageEnemy(cur, dmg, cur.x, cur.y);
          sparks(cur.x, cur.y, '#bff8ff', 4, 180);
          let next = null;
          let bd = 160 * 160;
          for (const e of G.enemies) {
            if (e.dead || hit.has(e) || !e.entered) continue;
            const d = dist2(cur.x, cur.y, e.x, e.y);
            if (d < bd) { bd = d; next = e; }
          }
          cur = next;
        }
        G.bolts.push({ pts: jagged(pts), life: 0.2, max: 0.2 });
        sfx.zap();
      } else m.arcT = 0.2;
    }
  }

  // Pulse nova
  if (up.nova) {
    const lv = up.nova;
    m.novaT -= dt * rate;
    if (m.novaT <= 0) {
      m.novaT = lvl([2.8, 2.4, 2.1, 1.8, 1.5], lv);
      const n = 10 + 3 * lv;
      const off = rand(0, TAU);
      for (let i = 0; i < n; i++) {
        playerBullet(p.x, p.y, off + (i / n) * TAU, 430, (1.8 + 0.4 * lv) * dm, S.pb_nova, { life: 0.8, r: 5, pierce: 1, alpha: 1 });
      }
      ring(p.x, p.y, 60, '#ff3df2', 0.35);
      sfx.nova();
    }
  }

  // Rail lance
  if (up.rail) {
    const lv = up.rail;
    m.railT -= dt * rate;
    if (m.railT <= 0) {
      m.railT = lvl([3.2, 2.8, 2.4, 2.1, 1.8], lv);
      G.beams.push({
        owner: 'player', x: p.x, w: 12 + 5 * lv, life: 0.3, max: 0.3,
        dmg: (20 + 10 * lv) * dm, hit: new Set(),
      });
      sfx.rail();
    }
  }
}

function jagged(pts) {
  const out = [pts[0], pts[1]];
  for (let i = 2; i < pts.length; i += 2) {
    const ax = pts[i - 2];
    const ay = pts[i - 1];
    const bx = pts[i];
    const by = pts[i + 1];
    const segs = 4;
    for (let s = 1; s < segs; s++) {
      const t = s / segs;
      out.push(ax + (bx - ax) * t + rand(-10, 10), ay + (by - ay) * t + rand(-10, 10));
    }
    out.push(bx, by);
  }
  return out;
}

export function dashNova(p) {
  const lv = p.up.dashNova;
  const n = 6 + 2 * lv;
  const dm = dmgMul(p);
  for (let i = 0; i < n; i++) {
    playerBullet(p.x, p.y, (i / n) * TAU, 480, (3 + 1.2 * lv) * dm, S.blade, { life: 0.5, r: 7, pierce: 2, scale: 0.7, alpha: 1 });
  }
  clearBullets(p.x, p.y, 55 + 15 * lv);
  ring(p.x, p.y, 55 + 15 * lv, '#ff3df2', 0.35);
}

export function updateBeams(rawDt) {
  const p = G.player;
  let w = 0;
  for (const b of G.beams) {
    const dt = b.owner === 'enemy' ? rawDt * G.enemyTimeScale : rawDt; // Phase Shift slows enemy beams too
    if (b.owner === 'enemy') {
      if (b.src) {
        if (b.src.dead) continue;
        b.x = b.src.x + (b.ox || 0);
        b.y = b.src.y + (b.oy || 0);
      }
      if (b.tele > 0) {
        b.tele -= dt;
        if (b.aimSpin) b.ang += b.aimSpin * dt;
        G.beams[w++] = b;
        continue;
      }
      b.ang += (b.spin || 0) * dt;
    }
    b.life -= dt;
    if (b.life <= 0) continue;
    if (b.owner === 'player' && p) b.x = p.x;
    G.beams[w++] = b;
  }
  G.beams.length = w;
  let bw = 0;
  for (const bolt of G.bolts) {
    bolt.life -= rawDt;
    if (bolt.life > 0) G.bolts[bw++] = bolt;
  }
  G.bolts.length = bw;
}

export function drawModules(ctx, k) {
  const p = G.player;
  if (!p || p.dead) return;
  // Orbit blades
  if (p.up.orbitals) {
    const lv = p.up.orbitals;
    const n = lv + 1;
    const radius = 50 + lv * 3;
    const s = S.blade;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const a = p.mod.orbA + (i / n) * TAU;
      const x = p.x + Math.cos(a) * radius;
      const y = p.y + Math.sin(a) * radius;
      const r = G.time * 12;
      const c = Math.cos(r) * k;
      const sn = Math.sin(r) * k;
      ctx.setTransform(c, sn, -sn, c, x * k + view.ox, y * k + view.oy);
      ctx.drawImage(s.img, -s.half, -s.half, s.size, s.size);
    }
    ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
    ctx.globalCompositeOperation = 'source-over';
  }
  // Drones
  for (const d of p.drones) {
    const s = S.drone;
    const a = (d.ang || -Math.PI / 2) + Math.PI / 2;
    const c = Math.cos(a) * k;
    const sn = Math.sin(a) * k;
    ctx.setTransform(c, sn, -sn, c, d.x * k + view.ox, d.y * k + view.oy);
    ctx.drawImage(s.img, -s.half, -s.half, s.size, s.size);
  }
  ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
}

export function drawBeams(ctx) {
  const p = G.player;
  ctx.globalCompositeOperation = 'lighter';
  for (const b of G.beams) {
    const t = b.life / b.max;
    if (b.owner === 'player') {
      const top = 0;
      const bottom = p ? p.y - 18 : view.H;
      ctx.globalAlpha = t * 0.5;
      ctx.fillStyle = '#ff3df2';
      ctx.fillRect(b.x - b.w, top, b.w * 2, bottom - top);
      ctx.globalAlpha = t;
      ctx.fillStyle = '#9ffcff';
      ctx.fillRect(b.x - b.w / 2, top, b.w, bottom - top);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - b.w / 5, top, b.w / 2.5, bottom - top);
      const g = glow('#ff3df2', 64);
      ctx.drawImage(g.img, b.x - 40, bottom - 40, 80, 80);
    } else {
      // Enemy laser: telegraph thin line, then thick beam.
      const L = b.len || 1400; // weaver tripwires are finite segments
      const ex = b.x + Math.cos(b.ang) * L;
      const ey = b.y + Math.sin(b.ang) * L;
      if (b.tele > 0) {
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(G.time * 30);
        ctx.strokeStyle = '#ff2e88';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      } else {
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#ff2e88';
        ctx.lineWidth = b.w * 2.2;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffd0ea';
        ctx.lineWidth = b.w * 0.8;
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
  // Lightning
  for (const bolt of G.bolts) {
    const t = bolt.life / bolt.max;
    ctx.globalAlpha = t;
    ctx.strokeStyle = '#7ff3ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bolt.pts[0], bolt.pts[1]);
    for (let i = 2; i < bolt.pts.length; i += 2) ctx.lineTo(bolt.pts[i], bolt.pts[i + 1]);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
