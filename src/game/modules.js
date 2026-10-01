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
  p.mod = { missT: 1, arcT: 1.2, novaT: 2, railT: 2, orbA: 0, droneT: 0.2, gravT: 2.5, reflT: 3, flakT: 0.6, wells: [], flaks: [], refl: 0, reflMax: 0 };
  p.drones = [];
}

const MAX_PBULLETS = 520; // new-module spawns respect this cap (reflections just erase the bullet when full)
const evo = (p, id) => (p.up[id] || 0) > 0;
const REFL_R = [52, 58, 65, 72, 80];

// Razor Orbit geometry (Storm Halo: +3 blades, a pulsing radius, a wider erase field).
const orbitBlades = (p) => p.up.orbitals + 1 + (evo(p, 'stormhalo') ? 3 : 0);
const orbitRadius = (p) => 50 + p.up.orbitals * 3 + (evo(p, 'stormhalo') ? 12 + 14 * Math.sin(G.time * 2.6) : 0);

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
      const hell = evo(p, 'hellfire'); // Hellfire Swarm: double salvo, bigger blasts, missiles always crit
      const n = lvl([2, 2, 3, 4, 5], lv) * (hell ? 2 : 1);
      const step = hell ? 0.2 : 0.35;
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        const a = -Math.PI / 2 + side * (0.9 + Math.floor(i / 2) * step);
        playerBullet(p.x + side * 10, p.y + 4, a, 240, (4.4 + 1.35 * lv) * dm, S.missile, {
          homing: 5.5, kind: 'missile', life: 2.6, aoe: (40 + lv * 4) * (hell ? 1.7 : 1), r: 6, alpha: 1, crit: hell,
        });
      }
      sfx.missile();
    }
  }

  // Razor orbit
  if (up.orbitals) {
    const lv = up.orbitals;
    const n = orbitBlades(p);
    const radius = orbitRadius(p);
    const erase = evo(p, 'stormhalo') ? 17 : 9;
    m.orbA += dt * (3.2 + lv * 0.2);
    const halo = evo(p, 'stormhalo');
    const dmg = (4 + 1.8 * lv) * dm * (halo ? 1.4 : 1);
    for (let i = 0; i < n; i++) {
      const a = m.orbA + (i / n) * TAU;
      const bx = p.x + Math.cos(a) * radius;
      const by = p.y + Math.sin(a) * radius;
      for (const e of G.enemies) {
        if (e.dead || !e.entered) continue;
        const rr = e.r + (halo ? 14 : 10);
        if (dist2(bx, by, e.x, e.y) < rr * rr && (e.orbCd || 0) <= G.time) {
          e.orbCd = G.time + 0.2;
          sparks(bx, by, '#ff3df2', 3, 200);
          damageEnemy(e, dmg, bx, by);
        }
      }
      for (const b of G.eBullets) {
        if (b.dead || b.type === 'torpedo' || (b.type === 'big' && lv < 3)) continue;
        const rr = b.r + erase;
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
      const dmg = lvl([2.2, 2.6, 3.0, 3.5, 4.0], lv) * dm;
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
        const tesla = evo(p, 'teslastorm'); // Tesla Storm: twice as often, +3 chains, non-stop during the ultimate
        const storm = tesla && p.odT > 0;
        m.arcT = storm ? 0.2 : lvl([1.6, 1.4, 1.2, 1.0, 0.8], lv) * (tesla ? 0.5 : 1);
        const chains = 2 + lv + (tesla ? 3 : 0);
        const dmg = (7 + 3 * lv) * dm * (storm ? 0.6 : 1);
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
      m.novaT = lvl([2.3, 1.95, 1.65, 1.4, 1.2], lv);
      const n = 12 + 3 * lv;
      const off = rand(0, TAU);
      for (let i = 0; i < n; i++) {
        playerBullet(p.x, p.y, off + (i / n) * TAU, 430, (3.4 + 0.9 * lv) * dm, S.pb_nova, { life: 0.8, r: 5, pierce: 1, alpha: 1 });
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
      const ann = evo(p, 'annihilator'); // Annihilator: huge beam, twice as often, 0.5s afterglow
      m.railT = lvl([3.2, 2.8, 2.4, 2.1, 1.8], lv) * (ann ? 0.5 : 1);
      const w = (12 + 5 * lv) * (ann ? 2.4 : 1);
      G.beams.push({
        owner: 'player', x: p.x, w, life: 0.3, max: 0.3,
        dmg: (20 + 10 * lv) * dm, hit: new Set(),
      });
      if (ann) {
        G.beams.push({ owner: 'afterglow', x: p.x, y: p.y - 18, w: w * 0.9, life: 0.8, max: 0.8, age: 0, tick: 0, dmg: (4 + 2 * lv) * dm });
      }
      sfx.rail();
    }
  }

  // Gravity well: drops a singularity on the densest cluster that drags enemies and bullets in.
  const wells = m.wells;
  if (up.gravity) {
    const lv = up.gravity;
    m.gravT -= dt * rate;
    if (m.gravT <= 0) {
      let tx = p.x;
      let ty = Math.max(view.safeTop + 120, p.y - 220);
      let best = 0;
      for (const e of G.enemies) {
        if (e.dead || !e.entered || e.boss || e.y > p.y - 40) continue;
        let n = 0;
        for (const o of G.enemies) if (!o.dead && o.entered && dist2(e.x, e.y, o.x, o.y) < 90 * 90) n++;
        if (n > best) { best = n; tx = e.x; ty = e.y; }
      }
      if (!best && !G.enemies.length && G.eBullets.length < 6) {
        m.gravT = 0.5; // nothing to drag in yet
      } else {
        m.gravT = lvl([7.5, 6.6, 5.8, 5.0, 4.3], lv);
        wells.push({ x: tx, y: ty, r: lvl([95, 105, 115, 126, 140], lv), life: 2.5, max: 2.5, tick: 0 });
        ring(tx, ty, 50, '#b86bff', 0.4);
        sfx.nova();
      }
    }
  }
  for (const w of wells) {
    w.life -= dt;
    w.tick -= dt;
    const tickNow = w.tick <= 0;
    if (tickNow) w.tick = 0.2;
    const lv = up.gravity || 1;
    const pull = lvl([55, 62, 70, 78, 88], lv);
    const r2 = w.r * w.r;
    const dmg = lvl([1.6, 2.0, 2.4, 2.9, 3.5], lv) * dm;
    for (const e of G.enemies) {
      if (e.dead || !e.entered) continue;
      const dx = w.x - e.x;
      const dy = w.y - e.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      if (!e.boss && !e.parts && d2 > 1) {
        const d = Math.sqrt(d2);
        const f = Math.min(d, pull * dt * (0.4 + 0.6 * (1 - d / w.r)));
        e.x += (dx / d) * f;
        e.y += (dy / d) * f;
      }
      if (tickNow) damageEnemy(e, dmg, e.x, e.y);
    }
    for (const b of G.eBullets) {
      if (b.dead || b.delay > 0) continue;
      const dx = w.x - b.x;
      const dy = w.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2 * 1.3) continue;
      if (d2 < 15 * 15 && !b.hp) {
        b.dead = true;
        sparks(b.x, b.y, '#d9a8ff', 2, 120);
        continue;
      }
      const d = Math.sqrt(d2) || 1;
      const a = (b.hp ? 400 : 1000) * (1 - Math.min(1, d / (w.r * 1.15)) * 0.5) * dt;
      b.vx += (dx / d) * a;
      b.vy += (dy / d) * a;
    }
  }
  if (wells.length) {
    let ww = 0;
    for (const w of wells) if (w.life > 0) wells[ww++] = w;
    wells.length = ww;
  }

  // Reflector: a brief bubble that turns enemy bullets into player bullets.
  if (up.reflector) {
    const lv = up.reflector;
    if (m.refl > 0) {
      m.refl -= dt;
      const R = lvl(REFL_R, lv);
      const dmg = lvl([4.5, 5.5, 6.5, 7.6, 9], lv) * dm;
      // The bubble itself burns whatever drifts inside it (a few ticks per pulse).
      m.reflHit = (m.reflHit || 0) - dt;
      if (m.reflHit <= 0) {
        m.reflHit = 0.25;
        const touch = lvl([6, 8, 10, 12, 15], lv) * dm;
        for (const e of G.enemies) {
          if (e.dead || !e.entered || e.invuln) continue;
          if (dist2(p.x, p.y, e.x, e.y) < (R + e.r) * (R + e.r)) damageEnemy(e, touch, e.x, e.y);
        }
      }
      for (const b of G.eBullets) {
        if (b.dead || b.delay > 0 || b.hp) continue;
        if (dist2(p.x, p.y, b.x, b.y) > (R + b.r) * (R + b.r)) continue;
        b.dead = true;
        sparks(b.x, b.y, '#7fffe6', 3, 160);
        if (G.pBullets.length >= MAX_PBULLETS) continue;
        const t = nearestEnemy(b.x, b.y, 1e9);
        const a = t ? Math.atan2(t.y - b.y, t.x - b.x) : -Math.PI / 2;
        playerBullet(b.x, b.y, a, 720, dmg, S.pb_refl, { life: 1.3, r: 4.5, alpha: 1 });
      }
    } else {
      m.reflT -= dt * rate;
      if (m.reflT <= 0) {
        m.reflT = lvl([8, 7.2, 6.4, 5.6, 4.8], lv);
        m.refl = m.reflMax = 0.9 + 0.1 * lv;
        ring(p.x, p.y, lvl(REFL_R, lv), '#7fffe6', 0.3);
        sfx.shield();
      }
    }
  }

  // Flak burst: slow shells airburst into fragment rings near enemies.
  if (up.flak) {
    const lv = up.flak;
    m.flakT -= dt * rate;
    if (m.flakT <= 0) {
      m.flakT = lvl([1.7, 1.5, 1.35, 1.2, 1.05], lv);
      const shells = lv >= 4 ? 2 : 1;
      const t = nearestEnemy(p.x, p.y, 520 * 520);
      let base = -Math.PI / 2;
      if (t) base = Math.max(-Math.PI / 2 - 0.5, Math.min(-Math.PI / 2 + 0.5, Math.atan2(t.y - p.y, t.x - p.x)));
      for (let i = 0; i < shells; i++) {
        const a = base + (shells > 1 ? (i ? 0.18 : -0.18) : 0);
        m.flaks.push({ x: p.x, y: p.y - 14, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, life: 1.9 });
      }
      sfx.missile();
    }
  }
  if (m.flaks.length) {
    const lv = up.flak || 1;
    const n = lvl([8, 9, 10, 12, 14], lv);
    const dmg = lvl([2.8, 3.3, 3.8, 4.4, 5.0], lv) * dm;
    let w = 0;
    for (const f of m.flaks) {
      f.life -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      let burst = false;
      for (const e of G.enemies) {
        if (e.dead || !e.entered || e.untargetable) continue;
        const rr = 36 + e.r * 0.5;
        if (dist2(f.x, f.y, e.x, e.y) < rr * rr) { burst = true; break; }
      }
      if (burst) {
        const off = rand(0, TAU);
        const room = G.pBullets.length < MAX_PBULLETS;
        for (let i = 0; room && i < n; i++) {
          playerBullet(f.x, f.y, off + (i / n) * TAU, 360, dmg, S.pb_frag, { life: 0.45, r: 4, alpha: 0.95 });
        }
        ring(f.x, f.y, 34, '#ffb066', 0.25);
        sparks(f.x, f.y, '#ffcf6b', 6, 220);
        sfx.nova();
        continue;
      }
      if (f.life > 0 && f.y > -20 && f.x > -20 && f.x < view.W + 20) m.flaks[w++] = f;
    }
    m.flaks.length = w;
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
    if (b.dead) continue;
    const dt = b.owner === 'enemy' ? rawDt * G.enemyTimeScale : rawDt; // Phase Shift slows enemy beams too
    if (b.owner === 'afterglow') {
      // Annihilator afterglow: stays where the beam fired and ticks damage once the main beam has faded.
      b.life -= dt;
      b.age += dt;
      b.tick -= dt;
      if (b.age > 0.25 && b.tick <= 0) {
        b.tick = 0.1;
        for (const e of G.enemies) {
          if (e.dead || !e.entered || e.state === 'dying') continue;
          for (const pt of e.parts || [e]) {
            if (pt.y < b.y && Math.abs(pt.x - b.x) < b.w / 2 + pt.r) { damageEnemy(e, b.dmg, pt.x, pt.y); break; }
          }
        }
      }
      if (b.life > 0) G.beams[w++] = b;
      continue;
    }
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
    const n = orbitBlades(p);
    const radius = orbitRadius(p);
    const bs = evo(p, 'stormhalo') ? 1.3 : 1;
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
      ctx.drawImage(s.img, -s.half * bs, -s.half * bs, s.size * bs, s.size * bs);
    }
    ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
    ctx.globalCompositeOperation = 'source-over';
  }
  drawGearV2(ctx, k, p);
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
    if (b.dead) continue;
    const t = b.life / b.max;
    if (b.owner === 'afterglow') {
      ctx.globalAlpha = Math.min(1, t * 1.6) * 0.8;
      const gw = b.w * (0.8 + 0.2 * t);
      ctx.drawImage(S.afterglow.img, b.x - gw / 2, 0, gw, b.y);
    } else if (b.owner === 'player') {
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

// Gravity wells, the Reflector bubble and flak shells.
function drawGearV2(ctx, k, p) {
  const m = p.mod;
  ctx.globalCompositeOperation = 'lighter';
  for (const w of m.wells) {
    const t = Math.min(1, w.life / 0.4, (w.max - w.life) / 0.2 + 0.2);
    const sz = w.r * 2.3;
    const rot = G.time * 3;
    const c = Math.cos(rot) * k;
    const sn = Math.sin(rot) * k;
    ctx.globalAlpha = t * 0.9;
    ctx.setTransform(c, sn, -sn, c, w.x * k + view.ox, w.y * k + view.oy);
    ctx.drawImage(S.gwell.img, -sz / 2, -sz / 2, sz, sz);
    ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
    ctx.globalAlpha = t * 0.25;
    ctx.strokeStyle = '#b86bff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, TAU);
    ctx.stroke();
  }
  if (m.refl > 0) {
    const R = REFL_R[Math.min(5, p.up.reflector) - 1];
    const t = m.refl / m.reflMax;
    const sz = R * 2.4 * (1 + (1 - t) * 0.05);
    ctx.globalAlpha = Math.min(1, t * 4) * (0.7 + Math.sin(G.time * 40) * 0.2);
    ctx.drawImage(S.reflect.img, p.x - sz / 2, p.y - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
  for (const f of m.flaks) {
    const s = S.flak;
    ctx.drawImage(s.img, f.x - s.half, f.y - s.half, s.size, s.size);
  }
  ctx.globalCompositeOperation = 'source-over';
}
