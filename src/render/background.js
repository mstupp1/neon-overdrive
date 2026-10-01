// Scrolling synthwave backdrop: gradient sky, nebula glows, perspective grid, stars.

import { view } from '../game/state.js';
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

export const bg = {
  hue: 215,
  target: 215,
  t: 0,
  scroll: 0,
  boost: 1,
  stars: [],
  nebula: [],
  theme: null, // system id (campaign) or null (endless / attract: the classic look)
  dark: 0, // blackout darkness 0..1 (smoothed toward darkTarget)
  darkTarget: 0,

  init() {
    this.stars.length = 0;
    const layers = [
      { n: 60, speed: 18, size: 1, a: 0.35 },
      { n: 34, speed: 45, size: 1.4, a: 0.55 },
      { n: 14, speed: 110, size: 2, a: 0.9 },
    ];
    for (const L of layers) {
      for (let i = 0; i < L.n; i++) {
        this.stars.push({ x: rand(0, 1), y: rand(0, 1), speed: L.speed * rand(0.8, 1.2), size: L.size, a: L.a * rand(0.6, 1) });
      }
    }
    this.nebula = [
      { x: 0.2, y: 0.25, r: 0.9, h: 0, s: 0.004 },
      { x: 0.85, y: 0.6, r: 1.1, h: 50, s: 0.006 },
      { x: 0.4, y: 0.95, r: 0.8, h: -40, s: 0.005 },
    ];
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
    this.boost = damp(this.boost, boost, 3, dt);
    this.dark = damp(this.dark, this.darkTarget, 2.5, dt);
    this.t += dt;
    this.scroll += dt * 0.55 * this.boost;
    for (const s of this.stars) {
      s.y += (s.speed * this.boost * dt) / view.H;
      if (s.y > 1) {
        s.y -= 1;
        s.x = Math.random();
      }
    }
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

    // Perspective grid
    const depth = H - horizon;
    const lineCol = `hsl(${h},100%,62%)`;
    ctx.strokeStyle = lineCol;
    ctx.lineWidth = GR.lw;
    const rows = GR.rows;
    const phase = this.scroll % 1;
    const bend = GR.bend || 0;
    const wave = GR.wave || 0;
    for (let i = 0; i < rows; i++) {
      const f = (i + phase) / rows;
      const y = horizon + depth * f * f;
      ctx.globalAlpha = (0.04 + f * 0.14) * GR.a;
      ctx.beginPath();
      ctx.moveTo(0, y);
      if (bend) ctx.quadraticCurveTo(W / 2, y + bend * (1 - f), W, y);
      else if (wave) {
        const a = wave * (0.3 + f) * Math.sin(this.t * 0.8 + i * 0.7);
        ctx.quadraticCurveTo(W * 0.25, y + a, W * 0.5, y);
        ctx.quadraticCurveTo(W * 0.75, y - a, W, y);
      } else ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.09 * GR.a;
    ctx.beginPath();
    const cols = GR.cols;
    const colW = W / (cols / 2);
    for (let i = -cols; i <= cols; i++) {
      const bx = W / 2 + i * colW;
      ctx.moveTo(W / 2 + (bx - W / 2) * 0.06, horizon);
      ctx.lineTo(bx, H);
    }
    ctx.stroke();

    // Horizon glow line
    const hg = glow(`hsl(${Math.round(h / 10) * 10},100%,60%)`, 64);
    ctx.globalAlpha = 0.25;
    ctx.drawImage(hg.img, -W * 0.2, horizon - 30, W * 1.4, 60);

    // Stars (streak when boosting)
    ctx.fillStyle = '#ffffff';
    const streak = Math.max(0, this.boost - 1.2) * 14;
    for (const s of this.stars) {
      ctx.globalAlpha = s.a;
      const len = s.size + streak * (s.speed / 110);
      ctx.fillRect(s.x * W, s.y * H, s.size, len);
    }
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
