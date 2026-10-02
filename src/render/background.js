// Scrolling synthwave backdrop: gradient sky, nebula glows, perspective grid, stars.

import { view, G } from '../game/state.js';
import { glow } from './sprites.js';
import { rand, damp, wrapAngle, mulberry32, TAU } from '../core/math.js';

// --- Per-system themes (campaign) ---------------------------------------------------
// Each theme bakes ONE offscreen silhouette layer the first time it is used (never again), drawn behind the grid with a
// single drawImage per frame, plus a grid variant (rows/cols/line width, curved or waved lines). null = the classic look.

const BAKE_W = 450; // logical width of every baked layer (view.W is fixed at 450)
const BAKE_RES = 1.5;

function bake(h, draw) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(BAKE_W * BAKE_RES);
  c.height = Math.ceil(h * BAKE_RES);
  const g = c.getContext('2d');
  g.scale(BAKE_RES, BAKE_RES);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  return c;
}

// Genesis: a megastructure gate ringed in neon behind a skyline of distant city towers.
function bakeGenesis(g, h) {
  const rnd = mulberry32(11);
  const base = h - 4;
  // gate ring behind the skyline
  g.strokeStyle = 'rgba(63,246,255,0.55)';
  g.shadowColor = '#3ff6ff';
  g.shadowBlur = 14;
  g.lineWidth = 3;
  g.beginPath(); g.arc(225, base - 40, 118, 0, TAU); g.stroke();
  g.lineWidth = 1.2; g.shadowBlur = 6; g.globalAlpha = 0.6;
  g.beginPath(); g.arc(225, base - 40, 132, 0, TAU); g.stroke();
  g.setLineDash([4, 10]);
  g.beginPath(); g.arc(225, base - 40, 150, 0, TAU); g.stroke();
  g.setLineDash([]);
  g.globalAlpha = 1;
  // towers: two depth rows
  for (let row = 0; row < 2; row++) {
    const far = row === 0;
    let x = -10;
    while (x < BAKE_W + 10) {
      const w = 14 + rnd() * 26;
      const th = (far ? 45 : 30) + rnd() * (far ? 85 : 70);
      g.shadowBlur = 0;
      g.fillStyle = far ? '#0a1233' : '#060a22';
      g.fillRect(x, base - th, w, th + 4);
      g.shadowBlur = far ? 3 : 6;
      g.shadowColor = far ? '#3a7bff' : '#3ff6ff';
      g.strokeStyle = far ? 'rgba(80,140,255,0.5)' : 'rgba(63,246,255,0.75)';
      g.lineWidth = 1;
      g.strokeRect(x + 0.5, base - th + 0.5, w - 1, th);
      // windows
      g.shadowBlur = 0;
      for (let wy = base - th + 6; wy < base - 4; wy += 7) {
        for (let wx = x + 3; wx < x + w - 3; wx += 5) {
          if (rnd() < 0.22) {
            g.fillStyle = rnd() < 0.2 ? 'rgba(255,61,242,0.8)' : far ? 'rgba(110,170,255,0.55)' : 'rgba(63,246,255,0.7)';
            g.fillRect(wx, wy, 2, 3);
          }
        }
      }
      if (!far && rnd() < 0.25) {
        g.strokeStyle = 'rgba(63,246,255,0.8)';
        g.beginPath(); g.moveTo(x + w / 2, base - th); g.lineTo(x + w / 2, base - th - 18); g.stroke();
        g.fillStyle = '#ff3d6e'; g.fillRect(x + w / 2 - 1, base - th - 20, 2, 2);
      }
      x += w + (far ? 2 : 4 + rnd() * 10);
    }
  }
}

// Crimson: a huge ringed red planet and a small moon.
function bakeCrimson(g, h) {
  const cx = 305;
  const cy = 175;
  const R = 128;
  const ring = (alpha, lo, hi) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.32);
    g.shadowColor = '#ff3d6e';
    g.shadowBlur = 8;
    for (const [rx, lw, a] of [[R * 1.55, 7, 0.38], [R * 1.78, 3, 0.45], [R * 2.0, 1.5, 0.5]]) {
      g.strokeStyle = `rgba(255,90,110,${a * alpha})`;
      g.lineWidth = lw;
      g.beginPath(); g.ellipse(0, 0, rx, rx * 0.2, 0, lo, hi); g.stroke();
    }
    g.restore();
  };
  ring(0.8, Math.PI, TAU); // back half
  const body = g.createRadialGradient(cx - 45, cy - 50, 8, cx, cy, R);
  body.addColorStop(0, '#9c1a3a');
  body.addColorStop(0.55, '#450a22');
  body.addColorStop(1, '#10020a');
  g.fillStyle = body;
  g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
  // cloud bands, clipped to the disc
  g.save();
  g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
  for (let i = 0; i < 9; i++) {
    g.strokeStyle = `rgba(255,70,100,${0.05 + (i % 3) * 0.03})`;
    g.lineWidth = 6 + (i % 4) * 4;
    g.beginPath();
    g.moveTo(cx - R, cy - R + i * 30 + 8);
    g.bezierCurveTo(cx - 40, cy - R + i * 30 - 12, cx + 40, cy - R + i * 30 + 24, cx + R, cy - R + i * 30);
    g.stroke();
  }
  g.restore();
  // rim light
  g.shadowColor = '#ff3d6e';
  g.shadowBlur = 16;
  g.strokeStyle = 'rgba(255,90,120,0.8)';
  g.lineWidth = 2.5;
  g.beginPath(); g.arc(cx, cy, R, Math.PI * 0.95, Math.PI * 1.65); g.stroke();
  g.shadowBlur = 0;
  ring(1, 0, Math.PI); // front half
  // moon
  g.fillStyle = '#1a0511';
  g.beginPath(); g.arc(78, 300, 15, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,90,120,0.6)'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(78, 300, 15, Math.PI * 0.9, Math.PI * 1.6); g.stroke();
}

// Cyclone: a storm-eye ring structure with spiral cloud arms (rotated slowly at draw time).
function bakeCyclone(g, h) {
  const cx = 225;
  const cy = 225;
  g.shadowColor = '#3ff6ff';
  for (let arm = 0; arm < 5; arm++) {
    const a0 = (arm / 5) * TAU;
    for (let pass = 0; pass < 2; pass++) {
      g.strokeStyle = `rgba(63,246,255,${pass ? 0.5 : 0.16})`;
      g.lineWidth = pass ? 1.2 : 7;
      g.shadowBlur = pass ? 6 : 0;
      g.beginPath();
      for (let t = 0; t <= 1; t += 0.04) {
        const r = 30 + t * 190;
        const a = a0 + t * 2.6;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (t === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  // ring structure
  g.shadowBlur = 8;
  for (const [r, lw, a, dash] of [[70, 2, 0.8, []], [96, 1.2, 0.5, [3, 9]], [128, 2.4, 0.4, [26, 12]], [166, 1.2, 0.35, [2, 14]]]) {
    g.strokeStyle = `rgba(63,246,255,${a})`;
    g.lineWidth = lw;
    g.setLineDash(dash);
    g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
  }
  g.setLineDash([]);
  // the eye
  const eye = g.createRadialGradient(cx, cy, 2, cx, cy, 52);
  eye.addColorStop(0, 'rgba(230,255,255,0.95)');
  eye.addColorStop(0.25, 'rgba(63,246,255,0.5)');
  eye.addColorStop(1, 'rgba(63,246,255,0)');
  g.fillStyle = eye;
  g.beginPath(); g.arc(cx, cy, 52, 0, TAU); g.fill();
}

// Void: a black hole with an accretion disc and a lensed arc over the top.
function bakeVoid(g, h) {
  const cx = 225;
  const cy = 215;
  const disc = (lo, hi) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.16);
    for (let k = 0; k < 14; k++) {
      const rx = 64 + k * 11;
      const t = k / 13;
      const col = t < 0.2 ? '255,236,190' : t < 0.5 ? '255,150,60' : t < 0.8 ? '220,70,200' : '120,70,255';
      g.strokeStyle = `rgba(${col},${0.8 - t * 0.55})`;
      g.shadowColor = `rgb(${col})`;
      g.shadowBlur = 8;
      g.lineWidth = 3.5 - t * 1.5;
      g.beginPath(); g.ellipse(0, 0, rx, rx * 0.2, 0, lo, hi); g.stroke();
    }
    g.restore();
  };
  disc(Math.PI, TAU); // far side of the disc
  // lensed light bending over the top
  g.save();
  g.translate(cx, cy);
  g.strokeStyle = 'rgba(255,170,90,0.55)';
  g.shadowColor = '#ff9a4a';
  g.shadowBlur = 12;
  g.lineWidth = 3;
  g.beginPath(); g.ellipse(0, 0, 62, 66, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
  g.restore();
  // the hole
  g.shadowColor = '#b46bff';
  g.shadowBlur = 24;
  g.fillStyle = '#000';
  g.beginPath(); g.arc(cx, cy, 52, 0, TAU); g.fill();
  g.shadowBlur = 10;
  g.strokeStyle = 'rgba(255,200,150,0.9)';
  g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, 53, 0, TAU); g.stroke();
  g.shadowBlur = 0;
  disc(0, Math.PI); // near side crosses in front
}

// anchor: 'horizon' sits the layer's bottom edge on the grid horizon, a number is its top y. neb: nebula alpha multiplier.
// grid: rows, cols (vertical line pairs), lw (line width), a (alpha mul), bend (horizontal lines sag, void), wave (cyclone).
const THEMES = {
  genesis: { h: 300, anchor: 'horizon', alpha: 0.95, drift: 6, neb: 1, grid: { rows: 16, cols: 14, lw: 1, a: 1 }, bake: bakeGenesis },
  crimson: { h: 400, anchor: 6, alpha: 0.9, drift: 10, neb: 1.15, grid: { rows: 14, cols: 12, lw: 1.5, a: 1.05 }, bake: bakeCrimson },
  cyclone: { h: 450, anchor: -10, alpha: 0.7, drift: 0, spin: 0.025, neb: 0.8, grid: { rows: 16, cols: 14, lw: 1, a: 0.95, wave: 7 }, bake: bakeCyclone },
  void: { h: 430, anchor: 6, alpha: 0.85, drift: 8, neb: 0.5, grid: { rows: 9, cols: 8, lw: 1, a: 0.8, bend: -30 }, bake: bakeVoid },
};
const DEFAULT_GRID = { rows: 16, cols: 14, lw: 1, a: 1 };
const baked = {};


// --- Reactive grid ------------------------------------------------------------------
// A screen-space lattice of spring nodes under the floor grid. Explosions kick nodes outward, gravity wells pull them
// in, the ult shockwave rides across them; springs pull every node home and neighbours drag on each other so dents
// ripple outward. Grid lines are drawn through the displaced lattice only while it is moving (at rest: the old path).

const CELL = 30;
const PAD = 30; // lattice reaches past the screen edges so line ends move too
const STIFF = 34; // spring back to rest
const COUPLE = 26; // pull toward the neighbours' average (spreads the ripple)
const DAMP = 4.2;
const MAX_D = 36; // displacement clamp (logical px)

const field = {
  cols: 0,
  rows: 0,
  x0: 0,
  y0: 0,
  dx: null, // displacement
  dy: null,
  vx: null, // velocity
  vy: null,
  energy: 0, // rough motion level, 0 = at rest (fast path)
  lights: [], // light pools on the floor: {x, y, color, size, life, max}

  fit(W, H, top) {
    const cols = Math.ceil((W + PAD * 2) / CELL) + 1;
    const rows = Math.ceil((H - top + PAD * 2) / CELL) + 1;
    if (cols === this.cols && rows === this.rows && this.y0 === top - PAD) return;
    this.cols = cols;
    this.rows = rows;
    this.x0 = -PAD;
    this.y0 = top - PAD;
    const n = cols * rows;
    this.dx = new Float32Array(n);
    this.dy = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.energy = 0;
  },

  // Radial kick: force > 0 pushes away from (x, y), < 0 pulls in. Strongest at the centre, zero at radius.
  kick(x, y, radius, force) {
    if (!this.dx) return;
    const c0 = Math.max(0, Math.floor((x - radius - this.x0) / CELL));
    const c1 = Math.min(this.cols - 1, Math.ceil((x + radius - this.x0) / CELL));
    const r0 = Math.max(0, Math.floor((y - radius - this.y0) / CELL));
    const r1 = Math.min(this.rows - 1, Math.ceil((y + radius - this.y0) / CELL));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const ox = this.x0 + c * CELL - x;
        const oy = this.y0 + r * CELL - y;
        const d = Math.hypot(ox, oy);
        if (d >= radius) continue;
        const k = (1 - d / radius) * force / (d + 8);
        const i = r * this.cols + c;
        this.vx[i] += ox * k;
        this.vy[i] += oy * k;
      }
    }
    this.energy = Math.max(this.energy, 1);
  },

  // Outward push on the band of nodes just inside a ring of radius r (an expanding shockwave front).
  ring(x, y, r, band, force) {
    if (!this.dx) return;
    for (let row = 0; row < this.rows; row++) {
      const oy = this.y0 + row * CELL - y;
      for (let c = 0; c < this.cols; c++) {
        const ox = this.x0 + c * CELL - x;
        const d = Math.hypot(ox, oy);
        const t = r - d;
        if (t < 0 || t > band || d < 1) continue;
        const k = (force * (1 - t / band)) / d;
        const i = row * this.cols + c;
        this.vx[i] += ox * k;
        this.vy[i] += oy * k;
      }
    }
    this.energy = Math.max(this.energy, 1);
  },

  step(dt) {
    if (this.energy <= 0 || !this.dx) return;
    const { cols, rows, dx, dy, vx, vy } = this;
    let e = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        // neighbour average (missing neighbours count as rest)
        const nx = (c > 0 ? dx[i - 1] : 0) + (c < cols - 1 ? dx[i + 1] : 0) + (r > 0 ? dx[i - cols] : 0) + (r < rows - 1 ? dx[i + cols] : 0);
        const ny = (c > 0 ? dy[i - 1] : 0) + (c < cols - 1 ? dy[i + 1] : 0) + (r > 0 ? dy[i - cols] : 0) + (r < rows - 1 ? dy[i + cols] : 0);
        const ax = -STIFF * dx[i] + COUPLE * (nx * 0.25 - dx[i]) - DAMP * vx[i];
        const ay = -STIFF * dy[i] + COUPLE * (ny * 0.25 - dy[i]) - DAMP * vy[i];
        vx[i] += ax * dt;
        vy[i] += ay * dt;
      }
    }
    for (let i = 0; i < dx.length; i++) {
      let x = dx[i] + vx[i] * dt;
      let y = dy[i] + vy[i] * dt;
      if (x > MAX_D) x = MAX_D; else if (x < -MAX_D) x = -MAX_D;
      if (y > MAX_D) y = MAX_D; else if (y < -MAX_D) y = -MAX_D;
      dx[i] = x;
      dy[i] = y;
      const m = Math.abs(x) + Math.abs(y) + (Math.abs(vx[i]) + Math.abs(vy[i])) * 0.05;
      if (m > e) e = m;
    }
    if (e < 0.05) {
      dx.fill(0); dy.fill(0); vx.fill(0); vy.fill(0);
      this.energy = 0;
    } else this.energy = e;
  },

  // Bilinear displacement at (x, y) into out[0], out[1].
  sample(x, y, out) {
    let fc = (x - this.x0) / CELL;
    let fr = (y - this.y0) / CELL;
    fc = fc < 0 ? 0 : fc > this.cols - 1.001 ? this.cols - 1.001 : fc;
    fr = fr < 0 ? 0 : fr > this.rows - 1.001 ? this.rows - 1.001 : fr;
    const c = fc | 0;
    const r = fr | 0;
    const tx = fc - c;
    const ty = fr - r;
    const i = r * this.cols + c;
    const j = i + this.cols;
    const { dx, dy } = this;
    out[0] = (dx[i] * (1 - tx) + dx[i + 1] * tx) * (1 - ty) + (dx[j] * (1 - tx) + dx[j + 1] * tx) * ty;
    out[1] = (dy[i] * (1 - tx) + dy[i + 1] * tx) * (1 - ty) + (dy[j] * (1 - tx) + dy[j + 1] * tx) * ty;
  },
};
const tmp = [0, 0];
const HSEG = 18; // samples per horizontal line while the grid is moving
const VSEG = 14; // samples per vertical line

export const bg = {
  hue: 215,
  target: 215,
  t: 0,
  scroll: 0,
  boost: 1,
  stars: [],
  rush: [], // speed lines: faint at cruise and kept to the side lanes, raking the whole field when boosting
  nebula: [],
  theme: null, // system id (campaign) or null (endless / attract: the classic look)
  dark: 0, // blackout darkness 0..1 (smoothed toward darkTarget)
  darkTarget: 0,

  init() {
    this.stars.length = 0;
    const layers = [
      { n: 60, speed: 18, size: 1, a: 0.3 },
      { n: 34, speed: 45, size: 1.2, a: 0.32 },
      { n: 14, speed: 110, size: 1.5, a: 0.45 },
    ];
    for (const L of layers) {
      for (let i = 0; i < L.n; i++) {
        this.stars.push({ x: rand(0, 1), y: rand(0, 1), speed: L.speed * rand(0.8, 1.2), size: L.size, a: L.a * rand(0.6, 1) });
      }
    }
    this.rush.length = 0;
    for (let i = 0; i < 14; i++) this.rush.push({ x: Math.random(), y: Math.random(), v: rand(0.8, 1.25), len: rand(0.6, 1.3) });
    this.nebula = [
      { x: 0.2, y: 0.25, r: 0.9, h: 0, s: 0.004 },
      { x: 0.85, y: 0.6, r: 1.1, h: 50, s: 0.006 },
      { x: 0.4, y: 0.95, r: 0.8, h: -40, s: 0.005 },
    ];
  },

  // Grid reactions (world coordinates = screen logical coordinates). size ~ explosion size.
  blast(x, y, size = 1, color = null) {
    field.kick(x, y, 70 + 45 * size, 300 * Math.min(3, size));
    if (color) this.light(x, y, color, 70 + 50 * Math.min(3, size), 0.35 + 0.12 * size);
  },

  // A coloured light pool on the floor (drawn under the grid lines, so the fight lights the arena).
  light(x, y, color, size, life) {
    const L = field.lights;
    if (L.length >= 24) L.shift();
    L.push({ x, y, color, size, life, max: life });
  },

  setHue(h) {
    this.target = h;
  },

  // Campaign system id (genesis | crimson | cyclone | void) or null. Layers bake lazily, once per theme.
  setTheme(id) {
    this.theme = THEMES[id] ? id : null;
    const T = THEMES[this.theme];
    if (T && !baked[this.theme]) baked[this.theme] = bake(T.h, (g) => T.bake(g, T.h));
  },

  // Blackout modifier: darken the sky and grid (enemies and bullets are drawn afterwards, so they stay bright).
  setDark(on) {
    this.darkTarget = on ? 1 : 0;
  },

  update(dt, boost = 1) {
    // Shortest way around the colour wheel.
    const diff = wrapAngle(((this.target - this.hue) * Math.PI) / 180) * (180 / Math.PI);
    this.hue = (this.hue + diff * Math.min(1, dt * 1.5) + 360) % 360;
    this.boost = damp(this.boost, boost, boost > this.boost ? 7 : 2.2, dt); // kicks in fast, coasts down
    this.dark = damp(this.dark, this.darkTarget, 2.5, dt);
    this.t += dt;
    this.scroll += dt * 0.78 * this.boost;
    this.updateField(dt);
    for (const s of this.stars) {
      s.y += (s.speed * this.boost * dt) / view.H;
      if (s.y > 1) {
        s.y -= 1;
        s.x = Math.random();
      }
    }
    for (const r of this.rush) {
      r.y += (r.v * (1.6 + 0.9 * this.boost) * dt);
      if (r.y > 1.3) {
        r.y -= 1.5;
        r.x = Math.random();
      }
    }
  },

  updateField(dt) {
    field.fit(view.W, view.H, view.H * 0.12);
    // Continuous sources: gravity wells drag the floor in, the ult shockwave rides outward across it.
    const p = G.player;
    if (p && dt > 0) {
      if (p.mod && p.mod.wells) for (const w of p.mod.wells) if (w.life > 0) field.kick(w.x, w.y, w.r * 1.3, -1800 * dt);
      if (G.pulse > 0) field.ring(p.x, p.y, G.pulse, 60, 22000 * dt * (1 - G.pulse / G.pulseMax));
    }
    // Sub-step so stiff springs stay stable through long frames.
    let left = Math.min(dt, 0.1);
    while (left > 1e-4) {
      const s = Math.min(left, 1 / 60);
      field.step(s);
      left -= s;
    }
    const L = field.lights;
    let w = 0;
    for (const l of L) {
      l.life -= dt;
      if (l.life > 0) L[w++] = l;
    }
    L.length = w;
  },

  draw(ctx) {
    const W = view.W;
    const H = view.H;
    const h = Math.round(this.hue);
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, `hsl(${h},55%,5%)`);
    grd.addColorStop(0.55, `hsl(${(h + 25) % 360},60%,7%)`);
    grd.addColorStop(1, `hsl(${(h + 40) % 360},70%,10%)`);
    ctx.fillStyle = grd;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    const T = THEMES[this.theme] || null;
    const GR = T ? T.grid : DEFAULT_GRID;
    // Nebula clouds (hue quantised so the glow cache stays small)
    ctx.globalCompositeOperation = 'lighter';
    for (const n of this.nebula) {
      const nh = (Math.round((h + n.h) / 10) * 10 + 360) % 360;
      const s = glow(`hsl(${nh},90%,45%)`, 128);
      const r = n.r * W;
      const x = n.x * W + Math.sin(this.t * n.s * 20) * 30;
      const y = ((n.y + this.scroll * 0.03) % 1.4) * H - 0.2 * H;
      ctx.globalAlpha = 0.16 * (T ? T.neb : 1);
      ctx.drawImage(s.img, x - r, y - r, r * 2, r * 2);
    }

    // Themed silhouette layer (one drawImage), slow parallax
    const horizon = H * 0.12;
    if (T) {
      const img = baked[this.theme];
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = T.alpha;
      const y = T.anchor === 'horizon' ? horizon - T.h + 6 : T.anchor;
      const x = (W - BAKE_W) / 2 + Math.sin(this.t * 0.05) * T.drift;
      const yy = y + Math.sin(this.t * 0.035) * T.drift * 0.6;
      if (T.spin) {
        ctx.save();
        ctx.translate(x + 225, yy + 225);
        ctx.rotate(this.t * T.spin);
        ctx.drawImage(img, -225, -225, BAKE_W, T.h);
        ctx.restore();
      } else ctx.drawImage(img, x, yy, BAKE_W, T.h);
      ctx.globalCompositeOperation = 'lighter';
    }

    // Light pools on the floor (under the lines)
    for (const l of field.lights) {
      const t = l.life / l.max;
      ctx.globalAlpha = 0.32 * t * t;
      const gs = glow(l.color, 64);
      const sz = l.size * (1.25 - 0.25 * t);
      ctx.drawImage(gs.img, l.x - sz, l.y - sz * 0.8, sz * 2, sz * 1.6);
    }

    // Perspective grid (bent through the reactive lattice while it is moving)
    const depth = H - horizon;
    const lineCol = `hsl(${h},100%,62%)`;
    ctx.strokeStyle = lineCol;
    ctx.lineWidth = GR.lw;
    const rows = GR.rows;
    const phase = this.scroll % 1;
    const bend = GR.bend || 0;
    const wave = GR.wave || 0;
    const live = field.energy > 0;
    // Displacement fades out toward the horizon so the far grid stays calm.
    const fade = (y) => Math.min(1, Math.max(0, (y - horizon) / (depth * 0.35)));
    for (let i = 0; i < rows; i++) {
      const f = (i + phase) / rows;
      const y = horizon + depth * f * f;
      const baseA = (0.04 + f * 0.14) * GR.a;
      const wa = wave ? wave * (0.3 + f) * Math.sin(this.t * 0.8 + i * 0.7) : 0;
      ctx.beginPath();
      if (live) {
        // y of the undisturbed line at x (same curves as the fast path below)
        let disturb = 0;
        const k = fade(y);
        for (let s = 0; s <= HSEG; s++) {
          const x = (s / HSEG) * W;
          let yy = y;
          if (bend) {
            const u = x / W;
            yy = y + bend * (1 - f) * 2 * u * (1 - u);
          } else if (wave) {
            const u = x / W;
            yy = y + (u < 0.5 ? wa * 2 * (2 * u) * (1 - 2 * u) : -wa * 2 * (2 * u - 1) * (2 - 2 * u));
          }
          field.sample(x, yy, tmp);
          const ox = tmp[0] * k;
          const oy = tmp[1] * k;
          disturb += Math.abs(ox) + Math.abs(oy);
          if (s === 0) ctx.moveTo(x + ox, yy + oy);
          else ctx.lineTo(x + ox, yy + oy);
        }
        // disturbed lines glow brighter
        ctx.globalAlpha = Math.min(0.6, baseA + (disturb / (HSEG + 1)) * 0.03);
      } else {
        ctx.globalAlpha = baseA;
        ctx.moveTo(0, y);
        if (bend) ctx.quadraticCurveTo(W / 2, y + bend * (1 - f), W, y);
        else if (wave) {
          ctx.quadraticCurveTo(W * 0.25, y + wa, W * 0.5, y);
          ctx.quadraticCurveTo(W * 0.75, y - wa, W, y);
        } else ctx.lineTo(W, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 0.09 * GR.a;
    ctx.beginPath();
    const cols = GR.cols;
    const colW = W / (cols / 2);
    for (let i = -cols; i <= cols; i++) {
      const bx = W / 2 + i * colW;
      const tx = W / 2 + (bx - W / 2) * 0.06;
      if (live) {
        // Only the stretch that is on screen matters; lines far off the sides are skipped.
        if (bx < -W * 1.5 || bx > W * 2.5) continue;
        for (let s = 0; s <= VSEG; s++) {
          const u = s / VSEG;
          const x = tx + (bx - tx) * u;
          const y = horizon + depth * u;
          field.sample(x, y, tmp);
          const k = fade(y);
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x + tmp[0] * k, y + tmp[1] * k);
        }
      } else {
        ctx.moveTo(tx, horizon);
        ctx.lineTo(bx, H);
      }
    }
    ctx.stroke();

    // Horizon glow line
    const hg = glow(`hsl(${Math.round(h / 10) * 10},100%,60%)`, 64);
    ctx.globalAlpha = 0.25;
    ctx.drawImage(hg.img, -W * 0.2, horizon - 30, W * 1.4, 60);

    // Stars (streak when boosting). Tinted toward the sky and kept dim so they read as backdrop, not as pickups.
    ctx.fillStyle = `hsl(${(h + 20) % 360},60%,82%)`;
    // Capped and faded at high boost so a fly-through reads as rush, not rain (the speed lines carry the rest).
    const streak = Math.min(70, Math.max(0, this.boost - 1.2) * 14);
    const sa = 1 / (1 + 0.07 * Math.max(0, this.boost - 1));
    for (const s of this.stars) {
      ctx.globalAlpha = s.a * sa;
      const len = s.size + streak * (s.speed / 110);
      ctx.fillRect(s.x * W, s.y * H, s.size, len);
    }
    // Speed lines. At cruise only the outer lanes carry a few faint ones (the middle stays clean for bullets); boosting
    // fades them up, stretches them and lets them sweep across the whole field.
    const b = Math.max(0, this.boost - 1);
    const lane = Math.min(1, b / 3);
    const ra = 0.07 + 0.2 * Math.min(1, b / 6);
    const rl = 46 + 26 * Math.min(b, 10);
    ctx.strokeStyle = `hsl(${(h + 20) % 360},70%,80%)`;
    ctx.lineWidth = 1;
    ctx.globalAlpha = ra;
    ctx.beginPath();
    for (const r of this.rush) {
      // x in 0..1 → the outer 16% each side at cruise, spread over the whole width at speed
      const side = r.x < 0.5 ? r.x * 2 : (r.x - 0.5) * 2;
      const w = 0.16 + 0.34 * lane;
      const x = (r.x < 0.5 ? side * w : 1 - side * w) * W;
      const y = r.y * H;
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - rl * r.len);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (this.dark > 0.01) {
      ctx.globalAlpha = 0.74 * this.dark;
      ctx.fillStyle = '#000';
      ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.globalAlpha = 1;
    }
  },
};
