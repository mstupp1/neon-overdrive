// Autopilot used for the attract-mode demo behind the menus (and handy for
// automated smoke tests). Steers away from threats and lines up shots.

import { G, view } from './state.js';
import { clamp, segDist2 } from '../core/math.js';
import { sv } from './stageview.js';

export function botControl() {
  const p = G.player;
  let fx = 0;
  let fy = 0;
  let danger = 0;
  let dash = false;

  for (const b of G.eBullets) {
    if (b.dead || b.delay > 0) continue;
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 130 * 130) continue;
    // Weight bullets that are heading toward us more heavily.
    const approaching = dx * b.vx + dy * b.vy > 0 ? 1.8 : 0.6;
    const w = (approaching * 1600) / (d2 + 60);
    fx += dx * w * 0.02;
    fy += dy * w * 0.02;
    danger += w;
    if (d2 < 16 * 16 && approaching > 1) dash = true;
  }
  // Enemy beams (lasers, lanes, weaver tripwires): push away from the segment once lethal or about to be.
  for (const bm of G.beams) {
    if (bm.owner !== 'enemy' || bm.tele > 0.25 || bm.dead) continue;
    const L = bm.len || 1400;
    const ex = bm.x + Math.cos(bm.ang) * L;
    const ey = bm.y + Math.sin(bm.ang) * L;
    const d2 = segDist2(p.x, p.y, bm.x, bm.y, ex, ey);
    const lim = bm.w * 0.8 + 62;
    if (d2 > lim * lim) continue;
    // Closest point on the segment, to know which way is "away".
    const vx = ex - bm.x;
    const vy = ey - bm.y;
    const t = clamp(((p.x - bm.x) * vx + (p.y - bm.y) * vy) / (vx * vx + vy * vy || 1), 0, 1);
    const cx = bm.x + vx * t;
    const cy = bm.y + vy * t;
    let dx = p.x - cx;
    let dy = p.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    const w = 1 + (lim - d) / lim * 2.5;
    fx += dx * w;
    fy += dy * w;
    danger += w;
    if (bm.tele <= 0 && d < bm.w * 0.8 + p.r + 6) dash = true;
  }
  let target = null;
  let best = Infinity;
  for (const e of G.enemies) {
    if (e.dead || !e.entered) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d2 = dx * dx + dy * dy;
    const rr = (e.r + 70) * (e.r + 70);
    if (d2 < rr) {
      const w = 900 / (d2 + 50);
      fx += dx * w * 0.05;
      fy += dy * w * 0.05;
      danger += w;
    }
    if (e.y < p.y - 60) {
      const score = Math.abs(dx) + (e.boss ? -200 : 0) + (e.invuln ? 600 : 0); // shoot the Dark Fortress drones, not the dome
      if (score < best) {
        best = score;
        target = e;
      }
    }
  }
  const homeY = view.H * (p.ship && p.ship.weapon === 'scatter' ? 0.6 : 0.8); // the shotgun has to get close, like a human would
  if (target) fx += clamp((target.x - p.x) * 0.012, -1, 1);
  else fx += clamp((view.W / 2 - p.x) * 0.004, -0.5, 0.5);
  fy += clamp((homeY - p.y) * 0.01, -1, 1);
  // Other stage views: line up with the next laser gate's gap, keep off the terrain (stageview.js).
  const hint = sv.botHint(p);
  if (hint) {
    fx += hint.x;
    fy += hint.y;
  }
  // Stay off the walls.
  if (p.x < 50) fx += (50 - p.x) * 0.03;
  if (p.x > view.W - 50) fx -= (p.x - (view.W - 50)) * 0.03;

  // Grab nearby pickups when it is calm.
  if (danger < 0.5) {
    for (const pk of G.pickups) {
      const dx = pk.x - p.x;
      const dy = pk.y - p.y;
      if (dx * dx + dy * dy < 160 * 160) {
        fx += dx * 0.004;
        fy += dy * 0.004;
      }
    }
  }

  const m = Math.hypot(fx, fy);
  if (m > 1) {
    fx /= m;
    fy /= m;
  }
  const busy = G.enemies.length > 6 || G.boss;
  return {
    mode: 'dir',
    dx: fx,
    dy: fy,
    tx: 0,
    ty: 0,
    dash,
    od: p.od >= 100 && (busy || danger > 3),
    focus: danger > 2.5,
  };
}
