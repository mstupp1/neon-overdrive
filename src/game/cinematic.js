// Cinematic camera beats (campaign / run mode only, never attract):
//  - finisher(target, tier): the killing blow on a node's last enemy, a Hunter or a boss freezes for a beat, then the
//    camera zooms onto it in deep slow motion with letterbox bars and speed lines, and eases back out. Bigger tiers zoom
//    harder and hold longer; `hold` tiers (bosses) stay zoomed while the target plays its death and release once it is
//    gone. While one runs, the director holds the sector-clear beat and the level-up slow-down waits (see main.js).
//  - nodeStart(): the opening of a fighting node: the camera settles in from a slight push and the bars retract.
// Everything runs on real seconds (update gets the frame's raw dt; simulate passes its fixed step).
// main.js reads timeScale() for the world clock, camera() for the zoom and draws overlay() after bloom.

import { G, view } from './state.js';
import { lerp, clamp, easeOutCubic, easeInOut, TAU } from '../core/math.js';
import { flash, addShake, ring, sparks } from './fx.js';
import { bg } from '../render/background.js';
import { sfx, music } from '../core/audio.js';

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

const cam = { z: 1, x: 0, y: 0 }; // zoom and world-to-screen offset in logical units (screen = world * z + x)

export const cine = {
  get on() {
    return fin.on;
  },
  // Held beats (director: no sector clear while true).
  get busy() {
    return fin.on;
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
    start.t = -1;
    cam.z = 1;
  },

  update(dt) {
    if (start.t >= 0) {
      start.t += dt;
      if (start.t >= START_DUR) start.t = -1;
    }
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
    return 1 - 0.85 * this.amount();
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
  },
};

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
