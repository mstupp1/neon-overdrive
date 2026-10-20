// Path modules: one weapon module for each build path that had none of its own (upgrades.js UP_TAGS).
// Shield Plates (Tank, barrier family), Wake Blades (Mobility), Marksman Drone (Crit), Tesla Pylons (Modules),
// Harpoon (Firepower), Sentry Turret (Modules), Capacitor Bloom (Overdrive) and Salvage Drone (Greed).
// updateExtModules / drawExtModules run from modules.js with its damage and fire-rate multipliers. State lives on p.mod.x.

import { G } from './state.js';
import { S } from '../render/sprites.js';
import { TAU, damp, dist2, rand } from '../core/math.js';
import { playerBullet, nearestEnemy, isHeavy } from './bullets.js';
import { damageEnemy } from './enemies.js';
import { ring, sparks } from './fx.js';
import { sfx } from '../core/audio.js';
import { ultCap } from './pilot.js';
import { dropSalvage } from './economy.js';

const lvl = (arr, lv) => arr[Math.min(arr.length, lv) - 1];
const evo = (p, id) => (p.up[id] || 0) > 0;
const MAX_PBULLETS = 520;

export function resetExtModules(p) {
  p.mod.x = {
    plateA: 0, plates: [], wake: [], wakeT: 0, wakeTick: 0, wakeX: p.x, wakeY: p.y,
    markT: 1.5, mark: null, tracer: null, pylonT: 0.5, pylons: [], pylonTick: 0, harpT: 1,
    sentryT: 1, sentries: [], bloomT: 1.2, salv: [],
  };
}

// The toughest live enemy (bosses and elites first), for the Marksman and the Harpoon.
function toughest() {
  let best = null;
  let bv = 0;
  for (const e of G.enemies) {
    if (e.dead || !e.entered || e.untargetable || e.state === 'dying') continue;
    const v = e.maxHp * (e.boss ? 4 : e.elite || e.hunter ? 2 : 1);
    if (v > bv) { bv = v; best = e; }
  }
  return best;
}

// Distance² from point to segment.
function segD2(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  const qx = ax + dx * t - px;
  const qy = ay + dy * t - py;
  return qx * qx + qy * qy;
}

const PLATE_R = 34;
const PLATE_CD = [4, 3.6, 3.2, 2.8, 2.4]; // seconds a plate recharges after blocking a bullet
const platesOf = (p) => lvl([3, 3, 4, 4, 5], p.up.shieldPlates) + (evo(p, 'citadel') ? 2 : 0);

export function updateExtModules(p, dt, rate, dm) {
  const up = p.up;
  if (!p.mod.x) resetExtModules(p);
  const x = p.mod.x;

  // Shield Plates (barrier): each plate blocks one bullet, then recharges. No fire-rate scaling, never heavy shots.
  if (up.shieldPlates) {
    const lv = up.shieldPlates;
    const n = platesOf(p);
    const cit = evo(p, 'citadel'); // Citadel Plates: +2 plates, faster recharge, blocks send out a shockwave
    while (x.plates.length < n) x.plates.push({ cd: 0, hitT: 0 });
    x.plates.length = n;
    x.plateA += dt * 2.2;
    const touch = lvl([3, 4, 5, 6, 7], lv) * dm;
    x.plates.forEach((pl, i) => {
      if (pl.cd > 0) pl.cd -= dt;
      const a = x.plateA + (i / n) * TAU;
      pl.x = p.x + Math.cos(a) * PLATE_R;
      pl.y = p.y + Math.sin(a) * PLATE_R;
      if (pl.cd > 0) return;
      for (const b of G.eBullets) {
        if (b.dead || b.delay > 0 || isHeavy(b)) continue;
        const rr = b.r + 9;
        if (dist2(pl.x, pl.y, b.x, b.y) > rr * rr) continue;
        b.dead = true;
        pl.cd = lvl(PLATE_CD, lv) * (cit ? 0.7 : 1);
        sparks(pl.x, pl.y, '#7dff6b', 5, 160);
        if (cit) {
          ring(pl.x, pl.y, 60, '#7dff6b', 0.3);
          for (const e of G.enemies) if (!e.dead && e.entered && dist2(pl.x, pl.y, e.x, e.y) < (60 + e.r) ** 2) damageEnemy(e, 8 * dm, e.x, e.y);
        }
        break;
      }
      if (pl.cd > 0) return;
      for (const e of G.enemies) {
        if (e.dead || !e.entered || (e.plateCd || 0) > G.time) continue;
        if (dist2(pl.x, pl.y, e.x, e.y) < (e.r + 8) ** 2) {
          e.plateCd = G.time + 0.25;
          damageEnemy(e, touch, pl.x, pl.y);
        }
      }
    });
  } else if (x.plates.length) x.plates.length = 0;

  // Wake Blades: a cutting trail behind the ship. Twice as sharp while boosting or dashing.
  if (up.wakeBlades) {
    const lv = up.wakeBlades;
    const comet = evo(p, 'comettrail'); // Comet Trail: longer, wider trail
    const life = (0.55 + 0.05 * lv) * (comet ? 2 : 1);
    x.wakeT -= dt;
    if (x.wakeT <= 0) {
      x.wakeT = 0.05;
      if (dist2(p.x, p.y, x.wakeX, x.wakeY) > 9) x.wake.push({ x0: x.wakeX, y0: x.wakeY, x1: p.x, y1: p.y, life, max: life, hot: p.boosting || p.dashT > 0 });
      x.wakeX = p.x;
      x.wakeY = p.y;
      if (x.wake.length > 60) x.wake.splice(0, x.wake.length - 60);
    }
    x.wakeTick -= dt;
    if (x.wakeTick <= 0) {
      x.wakeTick = 0.15;
      const w = comet ? 20 : 13;
      const dmg = lvl([2, 2.6, 3.2, 3.9, 4.6], lv) * dm;
      for (const e of G.enemies) {
        if (e.dead || !e.entered) continue;
        let hot = -1;
        for (const s of x.wake) {
          if (segD2(e.x, e.y, s.x0, s.y0, s.x1, s.y1) < (w + e.r) ** 2) { hot = Math.max(hot, s.hot ? 1 : 0); if (hot) break; }
        }
        if (hot >= 0) damageEnemy(e, dmg * (hot ? 2 : 1), e.x, e.y);
      }
    }
  }
  if (x.wake.length) {
    let n = 0;
    for (const s of x.wake) if ((s.life -= dt) > 0) x.wake[n++] = s;
    x.wake.length = n;
  }

  // Marksman Drone: a sight line, then a hitscan shot at the toughest enemy that always crits.
  if (up.marksman) {
    const lv = up.marksman;
    const dead = evo(p, 'deadshot'); // Deadshot: twice as often; non-boss targets left under 25% hull are finished
    x.mpos = x.mpos || { x: p.x, y: p.y };
    x.mpos.x = damp(x.mpos.x, p.x - 30, 8, dt);
    x.mpos.y = damp(x.mpos.y, p.y + 18, 8, dt);
    x.markT -= dt * rate;
    if (x.markT < 0.45 && (!x.mark || x.mark.dead)) x.mark = toughest();
    if (x.markT <= 0) {
      const t = x.mark && !x.mark.dead ? x.mark : toughest();
      x.markT = lvl([2.6, 2.3, 2, 1.8, 1.5], lv) * (dead ? 0.5 : 1);
      x.mark = null;
      if (t) {
        const dmg = lvl([14, 18, 23, 29, 36], lv) * dm * p.st.critMul;
        damageEnemy(t, dmg, t.x, t.y, true);
        if (dead && !t.boss && !t.dead && t.hp < t.maxHp * 0.25) damageEnemy(t, t.hp + 1, t.x, t.y, true);
        x.tracer = { x0: x.mpos.x, y0: x.mpos.y, x1: t.x, y1: t.y, life: 0.14 };
        sparks(t.x, t.y, '#ffe14d', 6, 220);
        sfx.zap();
      } else x.markT = 0.3;
    }
  }
  if (x.tracer && (x.tracer.life -= dt) <= 0) x.tracer = null;

  // Tesla Pylons: pylons dropped where you fly, linked by lightning beams (and to the ship from level 3).
  if (up.teslaPylons) {
    const lv = up.teslaPylons;
    const grid = evo(p, 'stormgrid'); // Storm Grid: every pylon links to every other, and they last longer
    x.pylonT -= dt * rate;
    if (x.pylonT <= 0) {
      x.pylonT = lvl([3.2, 2.9, 2.6, 2.3, 2], lv);
      const max = lvl([2, 3, 3, 4, 4], lv);
      x.pylons.push({ x: p.x, y: p.y, life: 7 * (grid ? 1.5 : 1) });
      if (x.pylons.length > max) x.pylons.shift();
      ring(p.x, p.y, 18, '#9fe9ff', 0.25);
    }
    x.pylonTick -= dt;
    if (x.pylonTick <= 0) {
      x.pylonTick = 0.2;
      const dmg = lvl([3, 3.8, 4.6, 5.5, 6.5], lv) * dm * (up.shock ? 1.3 : 1);
      const segs = pylonLinks(p, x, lv, grid);
      for (const e of G.enemies) {
        if (e.dead || !e.entered) continue;
        for (const [ax, ay, bx, by] of segs) {
          if (segD2(e.x, e.y, ax, ay, bx, by) < (10 + e.r) ** 2) {
            damageEnemy(e, dmg, e.x, e.y);
            break;
          }
        }
      }
    }
  }
  if (x.pylons.length) {
    let n = 0;
    for (const py of x.pylons) if ((py.life -= dt) > 0) x.pylons[n++] = py;
    x.pylons.length = n;
  }

  // Harpoon: a heavy homing spear at the toughest enemy, made for bosses.
  if (up.harpoon) {
    const lv = up.harpoon;
    const lev = evo(p, 'leviathan'); // Leviathan: three spears a volley, +25% damage
    x.harpT -= dt * rate;
    if (x.harpT <= 0) {
      const t = toughest();
      if (t && G.pBullets.length < MAX_PBULLETS) {
        x.harpT = lvl([3.4, 3.1, 2.8, 2.5, 2.2], lv);
        const a = Math.atan2(t.y - p.y, t.x - p.x);
        const dmg = lvl([30, 38, 47, 57, 68], lv) * dm * (lev ? 1.25 : 1);
        for (const s of lev ? [-0.25, 0, 0.25] : [0]) {
          playerBullet(p.x, p.y - 8, a + s, 1100, dmg, S.pb_harpoon, { r: 6, life: 1.6, homing: 4, kind: 'harpoon', alpha: 1 }).target = t;
        }
        sfx.missile();
      } else x.harpT = 0.3;
    }
  }

  // Sentry Turret: planted where you stood, fires at the nearest enemy for a while.
  if (up.sentry) {
    const lv = up.sentry;
    const net = evo(p, 'sentrynet'); // Sentry Net: twin barrels, turrets last twice as long
    x.sentryT -= dt * rate;
    if (x.sentryT <= 0) {
      x.sentryT = lvl([7, 6.5, 6, 5.5, 5], lv);
      x.sentries.push({ x: p.x, y: p.y, life: 8 * (net ? 2 : 1), t: 0.3, ang: p.aim });
      const max = lvl([1, 1, 2, 2, 3], lv);
      if (x.sentries.length > max) x.sentries.shift();
      ring(p.x, p.y, 22, '#ff8a3d', 0.3);
    }
    const dmg = lvl([3, 3.6, 4.3, 5, 6], lv) * dm;
    const gap = lvl([0.45, 0.4, 0.36, 0.32, 0.28], lv);
    for (const s of x.sentries) {
      s.t -= dt * rate;
      if (s.t > 0 || G.pBullets.length >= MAX_PBULLETS) continue;
      const t = nearestEnemy(s.x, s.y, 360 * 360);
      s.t = t ? gap : 0.15;
      if (!t) continue;
      s.ang = Math.atan2(t.y - s.y, t.x - s.x);
      for (const o of net ? [-5, 5] : [0]) playerBullet(s.x + Math.cos(s.ang + Math.PI / 2) * o, s.y + Math.sin(s.ang + Math.PI / 2) * o, s.ang, 820, dmg, S.pb_sentry, { r: 3.5, life: 0.8, alpha: 0.95 });
    }
  }
  if (x.sentries.length) {
    let n = 0;
    for (const s of x.sentries) if ((s.life -= dt) > 0) x.sentries[n++] = s;
    x.sentries.length = n;
  }

  // Capacitor Bloom: a ring of shots that grows with your ult meter, and doubles up during your ult.
  if (up.capBloom) {
    const lv = up.capBloom;
    const over = evo(p, 'overbloom'); // Overbloom: the shots home in
    const ult = p.odT > 0;
    x.bloomT -= dt * rate * (ult ? 2 : 1);
    if (x.bloomT <= 0) {
      x.bloomT = lvl([2.4, 2.2, 2, 1.8, 1.6], lv);
      const fill = ult ? 1 : Math.min(1, p.od / ultCap(p));
      const n = 6 + Math.round(10 * fill);
      const dmg = lvl([3, 3.6, 4.2, 5, 5.8], lv) * dm * (0.6 + 0.8 * fill);
      const off = rand(0, TAU);
      for (let i = 0; i < n && G.pBullets.length < MAX_PBULLETS; i++) {
        playerBullet(p.x, p.y, off + (i / n) * TAU, 420, dmg, S.pb_bloom, { r: 4.5, life: 0.9, homing: over ? 3 : 0, alpha: 1 });
      }
      ring(p.x, p.y, 30 + 30 * fill, '#b48bff', 0.3);
    }
  }

  // Salvage Drone: fetches drops for you, rams enemies, and its kills drop a credit chip.
  if (up.salvageDrone) {
    const lv = up.salvageDrone;
    const scrap = evo(p, 'scrapper'); // Scrapper: three drones, harder rams, two chips per kill
    const n = scrap ? 3 : lv >= 4 ? 2 : 1;
    while (x.salv.length < n) x.salv.push({ x: p.x, y: p.y, tgt: null, ang: 0 });
    x.salv.length = n;
    const speed = lvl([260, 290, 320, 350, 380], lv);
    const ram = lvl([5, 6.5, 8, 9.5, 11], lv) * dm * (scrap ? 1.5 : 1);
    x.salv.forEach((d, i) => {
      let tx = p.x + (i - (n - 1) / 2) * 30;
      let ty = p.y + 30;
      let best = null;
      let bd = 300 * 300;
      for (const pk of G.pickups) {
        if (pk.dead || pk.pull || x.salv.some((o) => o !== d && o.tgt === pk)) continue;
        const dd = dist2(d.x, d.y, pk.x, pk.y);
        if (dd < bd) { bd = dd; best = pk; }
      }
      d.tgt = best;
      if (best) { tx = best.x; ty = best.y; } else {
        const e = nearestEnemy(p.x, p.y, 260 * 260);
        if (e) { tx = e.x; ty = e.y; }
      }
      const dx = tx - d.x;
      const dy = ty - d.y;
      const dl = Math.hypot(dx, dy) || 1;
      const step = Math.min(dl, speed * dt);
      d.x += (dx / dl) * step;
      d.y += (dy / dl) * step;
      d.ang = Math.atan2(dy, dx);
      if (best && dl < 14) best.pull = true; // caught: it flies home to you
      for (const e of G.enemies) {
        if (e.dead || !e.entered || (e.salvCd || 0) > G.time) continue;
        if (dist2(d.x, d.y, e.x, e.y) > (e.r + 8) ** 2) continue;
        e.salvCd = G.time + 0.35;
        damageEnemy(e, ram, d.x, d.y);
        sparks(d.x, d.y, '#ffd24a', 3, 160);
        if (e.dead && !e.boss) dropSalvage(e, scrap ? 2 : 1);
      }
    });
  } else if (x.salv.length) x.salv.length = 0;
}

// Beam segments between pylons: in a chain (Storm Grid: all pairs), plus the newest to the ship from level 3.
function pylonLinks(p, x, lv, grid) {
  const out = [];
  const ps = x.pylons;
  if (grid) {
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) out.push([ps[i].x, ps[i].y, ps[j].x, ps[j].y]);
  } else for (let i = 1; i < ps.length; i++) out.push([ps[i - 1].x, ps[i - 1].y, ps[i].x, ps[i].y]);
  if (lv >= 3 && ps.length) out.push([ps[ps.length - 1].x, ps[ps.length - 1].y, p.x, p.y]);
  return out;
}

const spr = (ctx, s, x, y, a = 0, alpha = 1) => {
  ctx.globalAlpha = alpha;
  ctx.save();
  ctx.translate(x, y);
  if (a) ctx.rotate(a);
  ctx.drawImage(s.img, -s.half, -s.half, s.size, s.size);
  ctx.restore();
};

export function drawExtModules(ctx, p) {
  const x = p.mod.x;
  if (!x) return;
  ctx.globalCompositeOperation = 'lighter';
  // Wake Blades
  if (x.wake.length) {
    ctx.lineCap = 'round';
    for (const s of x.wake) {
      const t = s.life / s.max;
      ctx.globalAlpha = 0.55 * t;
      ctx.strokeStyle = s.hot ? '#ffffff' : '#3ff6ff';
      ctx.lineWidth = (evo(p, 'comettrail') ? 9 : 5) * (0.4 + 0.6 * t);
      ctx.beginPath();
      ctx.moveTo(s.x0, s.y0);
      ctx.lineTo(s.x1, s.y1);
      ctx.stroke();
    }
  }
  // Tesla Pylons and their beams
  if (x.pylons.length) {
    const segs = pylonLinks(p, x, p.up.teslaPylons || 1, evo(p, 'stormgrid'));
    for (const [ax, ay, bx, by] of segs) {
      ctx.globalAlpha = 0.35 + Math.random() * 0.35;
      ctx.strokeStyle = '#bff8ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      const mx = (ax + bx) / 2 + rand(-6, 6);
      const my = (ay + by) / 2 + rand(-6, 6);
      ctx.lineTo(mx, my);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    for (const py of x.pylons) spr(ctx, S.pylon, py.x, py.y, 0, Math.min(1, py.life * 2));
  }
  // Sentries
  for (const s of x.sentries) spr(ctx, S.sentry, s.x, s.y, s.ang + Math.PI / 2, Math.min(1, s.life * 2));
  // Shield Plates (dim while recharging)
  for (const pl of x.plates) if (pl.x !== undefined) spr(ctx, S.plate, pl.x, pl.y, Math.atan2(pl.y - p.y, pl.x - p.x) + Math.PI / 2, pl.cd > 0 ? 0.25 : 1);
  // Marksman Drone, its sight line and its tracer
  if (p.up.marksman && x.mpos) {
    spr(ctx, S.marksman, x.mpos.x, x.mpos.y);
    if (x.mark && !x.mark.dead) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(x.mpos.x, x.mpos.y);
      ctx.lineTo(x.mark.x, x.mark.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (x.tracer) {
      ctx.globalAlpha = x.tracer.life / 0.14;
      ctx.strokeStyle = '#fff6b0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x.tracer.x0, x.tracer.y0);
      ctx.lineTo(x.tracer.x1, x.tracer.y1);
      ctx.stroke();
    }
  }
  // Salvage Drones
  for (const d of x.salv) spr(ctx, S.salvager, d.x, d.y, d.ang + Math.PI / 2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
