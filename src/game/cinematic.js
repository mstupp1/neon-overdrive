// Cinematic camera beats (campaign / run mode only, never attract):
//  - finisher(target, tier): the killing blow on a node's last enemy, a Hunter or a boss freezes for a beat, then the
//    camera zooms onto it in deep slow motion with letterbox bars and speed lines, and eases back out. Bigger tiers zoom
//    harder and hold longer; `hold` tiers (bosses) stay zoomed while the target plays its death and release once it is
//    gone. While one runs, the director holds the sector-clear beat and the level-up slow-down waits (see main.js).
//  - nodeStart(): the opening of a fighting node: the camera settles in from a slight push and the bars retract.
//  - transit(kicker, name): between a node's zones (and into a boss arena) the jet is flown on a swooping path while the
//    camera rolls, zooms and squashes into a low angle, the backdrop rushes past, and the next area's name comes up.
//    The rolled camera is drawn by main.js through an offscreen copy (sprites set their own axis-aligned transforms).
// Everything runs on real seconds (update gets the frame's raw dt; simulate passes its fixed step).
// main.js reads timeScale() for the world clock, camera() for the zoom and draws overlay() after bloom.

import { G, view } from './state.js';
import { lerp, clamp, easeOutCubic, easeInOut, TAU } from '../core/math.js';
import { flash, addShake, ring, sparks } from './fx.js';
import { bg } from '../render/background.js';
import { sfx, music } from '../core/audio.js';
import { input } from '../core/input.js';

// zoom: peak camera zoom. slow: world time scale while zoomed. hold: seconds at peak (boss tiers: after the target dies).
// bars: letterbox height (fraction of the screen). lines: speed-line count. rank: a finisher only replaces a weaker one.
const TIERS = {
  hunter: { rank: 1, zoom: 1.22, slow: 0.2, freeze: 0.06, inT: 0.22, hold: 0.25, outT: 0.4, bars: 0.05, lines: 14, flash: 0.25, shake: 0.35, boom: 1.6 },
  node: { rank: 2, zoom: 1.34, slow: 0.12, freeze: 0.1, inT: 0.3, hold: 0.42, outT: 0.5, bars: 0.07, lines: 22, flash: 0.35, shake: 0.45, boom: 2 },
  elite: { rank: 3, zoom: 1.5, slow: 0.1, freeze: 0.12, inT: 0.32, hold: 0.7, outT: 0.6, bars: 0.085, lines: 30, flash: 0.45, shake: 0.6, boom: 2.6 },
  boss: { rank: 4, zoom: 1.72, slow: 0.55, freeze: 0.16, inT: 0.45, hold: 0.85, outT: 0.9, bars: 0.1, lines: 40, flash: 0.6, shake: 0.9, boom: 3.5, waitDeath: true },
  final: { rank: 5, zoom: 1.95, slow: 0.45, freeze: 0.2, inT: 0.55, hold: 0.9, outT: 1.1, bars: 0.115, lines: 52, flash: 0.7, shake: 1, boom: 4, waitDeath: true },
};
const MAX_WAIT = 6; // real-seconds cap on a boss's death hold
const START_DUR = 1.25; // node opening settle
const START_ZOOM = 1.07;
const START_BARS = 0.06;

const fin = { on: false, tier: null, def: null, t: 0, outAt: 0, target: null, x: 0, y: 0, color: '#ffffff', seed: 0 };
const start = { t: -1 };

const cam = { z: 1, x: 0, y: 0, rot: 0, sy: 1, skew: 0, fx: 0, fy: 0, px: 0, py: 0 };
// zoom and world-to-screen offset in logical units (screen = world * z + x). When rot is set (transit) the frame is
// instead: screen = pivot (px, py) + rotate(rot) * [z, skew*z; 0, z*sy] * (world - focus (fx, fy)).

const TRANSIT = 2.7; // real seconds
const tr = { on: false, t: 0, kicker: '', name: '', boss: false, p0: { x: 0, y: 0 }, p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 }, seed: 0 };

// Transit envelope: eases in over the first quarter, out over the last.
function trAmount() {
  if (!tr.on) return 0;
  const u = tr.t / TRANSIT;
  if (u < 0.22) return easeInOut(u / 0.22);
  if (u > 0.78) return 1 - easeInOut((u - 0.78) / 0.22);
  return 1;
}

export const cine = {
  get on() {
    return fin.on || tr.on;
  },
  // Held beats (director: no sector clear / next zone while true).
  get busy() {
    return fin.on || tr.on;
  },
  get transiting() {
    return tr.on;
  },

  // Fly-through to the next area. boss: into the boss arena (a longer climb toward the top of the field).
  transit(kicker, name, boss = false) {
    const p = G.player;
    if (G.mode !== 'run' || !p || p.dead) return false;
    const W = view.W;
    const H = view.H;
    const right = p.x < W / 2;
    Object.assign(tr, { on: true, t: 0, kicker, name, boss, seed: Math.random() * 1000 });
    tr.p0 = { x: p.x, y: p.y };
    tr.p1 = { x: right ? W * 1.1 : -W * 0.1, y: boss ? H * 0.3 : H * 0.42 }; // control point: the curve swings wide
    tr.p2 = { x: W / 2, y: H * 0.78 };
    G.eBullets.length = 0;
    sfx.warp();
    music.setDuck(0.75);
    return true;
  },
  get tier() {
    return fin.on ? fin.tier : null;
  },

  // target: anything with x, y (a live enemy or boss; followed while it moves). color: tint for the lines and edge.
  finisher(target, tier = 'node', color = null) {
    if (G.mode !== 'run' || !G.player || G.player.dead) return false;
    const def = TIERS[tier];
    if (!def) return false;
    if (fin.on && fin.def.rank > def.rank) return false;
    Object.assign(fin, {
      on: true, tier, def, t: 0, target, x: target.x, y: target.y, color: color || target.color || '#ffffff',
      outAt: def.waitDeath ? Infinity : def.inT + def.hold, seed: Math.random() * 1000,
    });
    start.t = -1;
    flash('255,255,255', def.flash);
    addShake(def.shake);
    ring(target.x, target.y, 60 + 30 * def.rank, fin.color, 0.5 + 0.15 * def.rank);
    ring(target.x, target.y, 30 + 12 * def.rank, '#ffffff', 0.35 + 0.1 * def.rank);
    sparks(target.x, target.y, '#ffffff', 10 + 4 * def.rank, 260 + 60 * def.rank);
    bg.blast(target.x, target.y, def.boom, fin.color);
    sfx.finisher(def.rank);
    music.setDuck(0.45);
    return true;
  },

  nodeStart() {
    if (G.mode !== 'run') return;
    start.t = 0;
  },

  clear() {
    fin.on = false;
    fin.target = null;
    tr.on = false;
    if (G.player) G.player.auto = null;
    start.t = -1;
    cam.z = 1;
  },

  update(dt) {
    if (start.t >= 0) {
      start.t += dt;
      if (start.t >= START_DUR) start.t = -1;
    }
    if (tr.on) updateTransit(dt);
    if (!fin.on) return;
    fin.t += dt;
    const d = fin.def;
    const tg = fin.target;
    if (tg) {
      // Follow the target smoothly (bosses shake while dying).
      fin.x = lerp(fin.x, tg.x, Math.min(1, dt * 6));
      fin.y = lerp(fin.y, tg.y, Math.min(1, dt * 6));
    }
    if (d.waitDeath && fin.outAt === Infinity) {
      const gone = !tg || tg.dead || (tg.boss && G.boss !== tg);
      if (gone || fin.t > MAX_WAIT) fin.outAt = Math.max(fin.t, d.inT) + d.hold;
    }
    if (fin.t >= fin.outAt + d.outT || (G.player && G.player.dead)) {
      fin.on = false;
      fin.target = null;
      if (G.screen === 'play') music.setDuck(1);
    }
  },

  // 0..1 strength of the finisher (in, hold, out).
  amount() {
    if (!fin.on) return 0;
    const d = fin.def;
    if (fin.t < d.inT) return easeOutCubic(fin.t / d.inT);
    if (fin.t < fin.outAt) return 1;
    return 1 - easeInOut(clamp((fin.t - fin.outAt) / d.outT, 0, 1));
  },

  // World clock multiplier.
  timeScale() {
    if (!fin.on) return 1;
    const d = fin.def;
    if (fin.t < d.freeze) return 0.02; // the freeze frame on the hit
    if (fin.t < fin.outAt) return d.slow;
    return lerp(d.slow, 1, easeInOut(clamp((fin.t - fin.outAt) / d.outT, 0, 1)));
  },

  // Camera for this frame: { z, x, y } with screen = world * z + (x, y), clamped so the view never leaves the field.
  camera() {
    const W = view.W;
    const H = view.H;
    cam.rot = 0;
    if (tr.on && !fin.on) {
      const a = trAmount();
      const u = tr.t / TRANSIT;
      const p = G.player;
      cam.z = 1 + 0.42 * a + 0.08 * Math.sin(u * TAU) * a;
      cam.rot = 0.16 * Math.sin(u * TAU) * a + 1e-6; // swing one way, then the other
      cam.sy = 1 - 0.12 * a; // low angle: the field squashes toward the horizon
      cam.skew = 0.07 * Math.sin(u * TAU + 1.2) * a;
      cam.fx = lerp(W / 2, p.x, 0.8 * a);
      cam.fy = lerp(H / 2, p.y - 90, 0.8 * a); // look ahead of the jet
      cam.px = W / 2;
      cam.py = lerp(H / 2, H * 0.6, a);
      coverField(W, H);
      return cam;
    }
    let z = 1;
    let fx = W / 2;
    let fy = H / 2;
    let sx = fx;
    let sy = fy;
    const a = this.amount();
    if (a > 0) {
      z = 1 + (fin.def.zoom - 1) * a;
      fx = fin.x;
      fy = fin.y;
      // Pull the target toward the middle as the camera closes in.
      sx = lerp(fx, W / 2, 0.65 * a);
      sy = lerp(fy, H * 0.46, 0.65 * a);
    } else if (start.t >= 0) {
      const s = 1 - easeOutCubic(start.t / START_DUR);
      z = 1 + (START_ZOOM - 1) * s;
      fy = sy = H * 0.55;
    }
    cam.z = z;
    cam.x = clamp(sx - fx * z, W - W * z, 0);
    cam.y = clamp(sy - fy * z, H - H * z, 0);
    return cam;
  },

  // HUD opacity (the HUD steps aside for the shot).
  hudAlpha() {
    return 1 - 0.85 * Math.max(this.amount(), trAmount());
  },

  // Backdrop speed (bg.update boost): the transit rushes the stars and the grid.
  boost() {
    return 1 + 6 * trAmount();
  },

  // Screen-space overlay (logical units, identity camera): vignette on the target, speed lines, letterbox bars.
  overlay(ctx) {
    const W = view.W;
    const H = view.H;
    const a = this.amount();
    let bars = 0;
    let edge = 0;
    let col = fin.color;
    if (a > 0) {
      const d = fin.def;
      const px = fin.x * cam.z + cam.x;
      const py = fin.y * cam.z + cam.y;
      // Vignette: darken the field around the target.
      const vg = ctx.createRadialGradient(px, py, 40, px, py, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(3,2,10,0)');
      vg.addColorStop(1, `rgba(3,2,10,${0.6 * a})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      // Speed lines converging on the target (rerolled every few frames so they flicker like ink).
      const n = d.lines;
      if (n) {
        let s = fin.seed + Math.floor(G.realTime * 24);
        const rnd = () => ((s = (s * 16807 + 11) % 2147483647) / 2147483647);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.32 * a;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const far = Math.hypot(W, H);
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * TAU + rnd() * 0.25;
          const r0 = 95 + rnd() * 120 + (1 - a) * 200;
          const r1 = r0 + 120 + rnd() * far * 0.5;
          const c = Math.cos(ang);
          const sn = Math.sin(ang);
          ctx.moveTo(px + c * r0, py + sn * r0);
          ctx.lineTo(px + c * r1, py + sn * r1);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      bars = d.bars * a;
      edge = a;
    } else if (start.t >= 0) {
      const s = 1 - easeOutCubic(start.t / START_DUR);
      bars = START_BARS * s;
      edge = s;
      col = G.director && G.director.spec ? `hsl(${G.director.spec.hue},100%,70%)` : '#3ff6ff';
    }
    const ta = trAmount();
    if (ta > 0 && !fin.on) {
      // Speed streaks raking past at the camera's roll, and the destination title as a lower third.
      let s = tr.seed + Math.floor(G.realTime * 30);
      const rnd = () => ((s = (s * 16807 + 11) % 2147483647) / 2147483647);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-cam.rot * 0.6);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(200,240,255,1)';
      ctx.globalAlpha = 0.22 * ta;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 26; i++) {
        const x = (rnd() - 0.5) * W * 1.3;
        const y = (rnd() - 0.5) * H * 1.3;
        const len = 60 + rnd() * 160;
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + len);
      }
      ctx.stroke();
      ctx.restore();
      bars = Math.max(bars, 0.075 * ta);
      edge = Math.max(edge, ta);
      col = `hsl(${G.director && G.director.spec ? G.director.spec.hue : 200},100%,70%)`;
    }
    if (bars > 0.001) {
      const h = bars * H;
      ctx.fillStyle = '#020108';
      ctx.fillRect(0, 0, W, h);
      ctx.fillRect(0, H - h, W, h);
      ctx.globalAlpha = 0.85 * edge;
      ctx.fillStyle = col;
      ctx.fillRect(0, h - 1, W, 1.5);
      ctx.fillRect(0, H - h - 0.5, W, 1.5);
      ctx.globalAlpha = 1;
    }
    if (ta > 0 && !fin.on) drawLowerThird(ctx, W, H, col);
  },
};

// Keep the rolled view inside the playfield: map the screen corners back to the world and slide the focus (or zoom in
// a touch) until none of them lands off the field, so no empty edge shows.
function coverField(W, H) {
  for (let pass = 0; pass < 4; pass++) {
    const c = Math.cos(-cam.rot);
    const s = Math.sin(-cam.rot);
    const z = cam.z;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [sx, sy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
      const dx = sx - cam.px;
      const dy = sy - cam.py;
      const rx = c * dx - s * dy; // un-roll
      const ry = s * dx + c * dy;
      const wy = ry / (z * cam.sy); // un-squash / un-skew (A = [z, skew*z; 0, z*sy])
      const wx = (rx - cam.skew * z * wy) / z;
      x0 = Math.min(x0, wx);
      x1 = Math.max(x1, wx);
      y0 = Math.min(y0, wy);
      y1 = Math.max(y1, wy);
    }
    if (x1 - x0 > W || y1 - y0 > H) {
      cam.z *= 1.06;
      continue;
    }
    cam.fx = clamp(cam.fx, -x0, W - x1);
    cam.fy = clamp(cam.fy, -y0, H - y1);
    return;
  }
}

function updateTransit(dt) {
  tr.t += dt;
  const p = G.player;
  if (!p || p.dead) {
    tr.on = false;
    if (p) p.auto = null;
    return;
  }
  // Quadratic curve start → side swing → home spot, eased; the player steers toward it (player.js p.auto).
  const k = easeInOut(clamp((tr.t / TRANSIT - 0.06) / 0.8, 0, 1));
  const a = tr.p0;
  const b = tr.p1;
  const c = tr.p2;
  const m = 1 - k;
  p.auto = { x: m * m * a.x + 2 * m * k * b.x + k * k * c.x, y: m * m * a.y + 2 * m * k * b.y + k * k * c.y };
  if (tr.t >= TRANSIT) {
    tr.on = false;
    p.auto = null;
    input.holdTarget(); // pointer steering resumes from where the jet landed
    if (G.screen === 'play') music.setDuck(1);
  }
}

// Destination title in the lower bar: kicker + area name, wiping in mid-flight.
function drawLowerThird(ctx, W, H, col) {
  const u = tr.t / TRANSIT;
  const a = clamp((u - 0.32) / 0.12, 0, 1) * clamp((0.98 - u) / 0.1, 0, 1);
  if (a <= 0) return;
  const y = view.safeTop + H * 0.2; // upper field, clear of the jet
  const wipe = easeOutCubic(clamp((u - 0.32) / 0.2, 0, 1));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(3,2,10,0.6)';
  ctx.fillRect(0, y - 34, W * wipe, 62);
  ctx.fillStyle = col;
  ctx.fillRect(0, y - 34, W * wipe, 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '700 11px Orbitron, sans-serif';
  ctx.fillStyle = col;
  ctx.fillText(tr.kicker.split('').join(String.fromCharCode(8202)), 22, y - 16);
  ctx.font = '900 26px Orbitron, sans-serif';
  const tw = ctx.measureText(tr.name).width;
  const fit = Math.min(1, (W - 44) / tw);
  ctx.translate(22 + (1 - wipe) * -40, y + 10);
  ctx.scale(fit, fit);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(tr.name, 0, 0);
  ctx.restore();
}

// Debug: tier table (agents.md).
export const CINE_TIERS = TIERS;

const lastKill = { x: 0, y: 0, color: '#ffffff', t: -9, dead: true };
const LATE = 1.5; // sim seconds: a kill this recent still counts as the node's last one

// An enemy just died (enemies.js killEnemy). Fires the node finisher when nothing else is left to fight.
export function onKill(e) {
  if (G.mode !== 'run' || e.boss) return;
  const d = G.director;
  if (!d || !d.spec || d.spec.boss) return;
  Object.assign(lastKill, { x: e.x, y: e.y, color: e.color || '#ffffff', t: G.time });
  const last = d.state === 'clearing' && !d.queue.length && !G.enemies.some((o) => !o.dead && !o.boss);
  if (last) {
    d.finished = true;
    cine.finisher(e, d.spec.elite ? 'elite' : 'node', e.hunter ? '#ff3b3b' : null);
  } else if (e.hunter) cine.finisher(e, 'hunter', '#ff3b3b');
}

// Director, about to clear a node whose last enemy died a moment before the wave timer ran out (or whose stragglers
// flew off): play the finisher on that kill instead. Returns true when a shot started (the clear waits for it).
export function lateFinisher() {
  const d = G.director;
  if (G.mode !== 'run' || d.finished || !d.spec || d.spec.boss) return false;
  d.finished = true;
  if (G.time - lastKill.t > LATE) return false;
  return cine.finisher({ ...lastKill }, d.spec.elite ? 'elite' : 'node');
}
