// Boost comet aura (boost.js drawBoostShip): an anime ki-dash look. A white-hot head wraps the ship, a hairy flame
// fringe licks back off its rim, and long tapered wisps stream behind. Everything here is baked once per colour into
// a few flicker frames (cycled per frame); the only per-frame work is drawing them scaled plus a handful of lines.
//
// Sprite space: forward is -y (the virtual playfield's forward), head centre at (C, HY), head radius R (canvas px).

import { rand, TAU } from '../core/math.js';
import { withAlpha, shade } from './ink.js';

export const COMET_R = 40; // head radius in sprite px
const C = COMET_R * 2; // head centre x (sprite is 4R wide)
const HY = COMET_R * 1.5; // head centre y
const W = COMET_R * 4;
const H = Math.round(COMET_R * 9.5);
export const COMET_FRAMES = 3;

// Tapered streak from (x0, y0) along (dx, dy): wide at the start, needle-thin at the end, fading out.
function streak(g, x0, y0, dx, dy, w, col, a) {
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const grd = g.createLinearGradient(x0, y0, x0 + dx, y0 + dy);
  grd.addColorStop(0, withAlpha(col, a));
  grd.addColorStop(0.45, withAlpha(col, a * 0.55));
  grd.addColorStop(1, withAlpha(col, 0));
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(x0 + nx * w, y0 + ny * w);
  g.quadraticCurveTo(x0 + dx * 0.5 + nx * w * 0.45, y0 + dy * 0.5 + ny * w * 0.45, x0 + dx, y0 + dy);
  g.quadraticCurveTo(x0 + dx * 0.5 - nx * w * 0.45, y0 + dy * 0.5 - ny * w * 0.45, x0 - nx * w, y0 - ny * w);
  g.closePath();
  g.fill();
}

function bake(color) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.globalCompositeOperation = 'lighter';
  const R = COMET_R;
  const pale = shade(color, 0.3);
  const hot = shade(color, 0.65);

  // Soft body glow under everything: the tail's haze narrowing behind the head.
  const body = g.createLinearGradient(0, HY, 0, H);
  body.addColorStop(0, withAlpha(color, 0.16));
  body.addColorStop(0.5, withAlpha(color, 0.05));
  body.addColorStop(1, withAlpha(color, 0));
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(C - R * 0.95, HY);
  g.quadraticCurveTo(C - R * 0.7, HY + R * 4, C, H);
  g.quadraticCurveTo(C + R * 0.7, HY + R * 4, C + R * 0.95, HY);
  g.closePath();
  g.fill();

  // Tail wisps: long and thin near the centre line, shorter and drifting inward at the sides (the reference's
  // tapering spray). A few white-hot ones run down the core.
  for (let i = 0; i < 90; i++) {
    const u = Math.sign(Math.random() - 0.5) * Math.pow(Math.random(), 1.4); // -1..1, packed to the middle
    const x0 = C + u * R * 0.92;
    const y0 = HY + Math.sqrt(1 - u * u) * R * rand(-0.1, 0.55);
    const len = R * (1.6 + rand(0, 6.2) * (1 - Math.abs(u) * 0.6));
    const dx = -u * R * rand(0.15, 0.55);
    const w = R * rand(0.025, 0.11) * (1.2 - Math.abs(u) * 0.5);
    const white = Math.random() < 0.12 && Math.abs(u) < 0.5;
    streak(g, x0, y0, dx, len, w, white ? hot : Math.random() < 0.3 ? pale : color, white ? rand(0.25, 0.45) : rand(0.1, 0.28));
  }

  // Flame fringe: short licks off the rim, pointing out at the front and sweeping back along the sides.
  for (let i = 0; i < 70; i++) {
    const a = -Math.PI / 2 + rand(-1, 1) * Math.PI * 0.62; // around the front and sides of the head
    const rx = R * 1.0;
    const ry = R * 1.08;
    const x0 = C + Math.cos(a) * rx * 0.86;
    const y0 = HY + Math.sin(a) * ry * 0.86;
    const side = Math.abs(Math.cos(a)); // 0 at the nose, 1 at the flanks
    const out = R * rand(0.14, 0.42) * (1 - side * 0.3);
    const back = R * rand(0.2, 0.9) * side;
    streak(g, x0, y0, Math.cos(a) * out, Math.sin(a) * out + back, R * rand(0.03, 0.08), Math.random() < 0.35 ? pale : color, rand(0.2, 0.45));
  }

  // Head: an energy shell, clear-ish in the middle so the hull reads, hot toward its rim, a touch egg-shaped (blunt front, longer behind).
  const head = (rx, ry, oy, stops) => {
    g.save();
    g.translate(C, HY + oy);
    g.scale(rx / R, ry / R);
    const grd = g.createRadialGradient(0, -R * 0.12, 0, 0, 0, R);
    for (const [t, col] of stops) grd.addColorStop(t, col);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.fill();
    g.restore();
  };
  head(R * 1.12, R * 1.3, R * 0.12, [
    [0, withAlpha(color, 0.22)],
    [0.6, withAlpha(color, 0.16)],
    [1, withAlpha(color, 0)],
  ]);
  head(R * 0.88, R * 0.98, 0, [
    [0, withAlpha(pale, 0.1)],
    [0.55, withAlpha(pale, 0.26)],
    [0.82, withAlpha(pale, 0.28)],
    [1, withAlpha(pale, 0)],
  ]);
  // A crisp bright bow along the leading edge.
  g.lineCap = 'round';
  for (let j = 0; j < 2; j++) {
    g.strokeStyle = withAlpha(j ? pale : '#ffffff', j ? 0.4 : 0.75);
    g.lineWidth = j ? R * 0.14 : R * 0.06;
    g.beginPath();
    g.ellipse(C, HY, R * 0.86, R * 0.9, 0, Math.PI * 1.12, Math.PI * 1.88);
    g.stroke();
  }
  return c;
}

const cache = new Map();
// The flicker frames for a colour (baked on first use).
export function cometFrames(color) {
  let f = cache.get(color);
  if (!f) {
    f = [];
    for (let i = 0; i < COMET_FRAMES; i++) f.push(bake(color));
    cache.set(color, f);
  }
  return f;
}

// Draw the comet with its head centre at (x, y), head radius r (logical units), tail stretched by `len` (1 = baked
// length) and widened by `wide`. Forward is -y; callers rotate the canvas for other facings.
export function drawComet(ctx, color, x, y, r, len, wide, alpha, t) {
  const frames = cometFrames(color);
  const k = r / COMET_R;
  const fi = Math.floor(t * 22) % COMET_FRAMES;
  const sx = k * wide;
  const tail = k * len;
  // Head rows (0 .. 2.6R) keep their scale; the tail below stretches with speed. Two draws, one image.
  const cut = HY + COMET_R * 1.1;
  const dw = W * sx;
  const x0 = x - C * sx;
  const y0 = y - HY * k;
  const hh = cut * k;
  for (let j = 0; j < 2; j++) {
    const img = frames[(fi + j) % COMET_FRAMES];
    ctx.globalAlpha = alpha * (j ? 0.25 : 0.62);
    ctx.drawImage(img, 0, 0, W, cut, x0, y0, dw, hh);
    ctx.drawImage(img, 0, cut, W, H - cut, x0, y0 + hh, dw, (H - cut) * tail);
  }
}
