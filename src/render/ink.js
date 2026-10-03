// Line-art kit shared by the ship, enemy and boss art: layered hull parts (dark glass, colour tint, glowing rim), panel
// seams, vents, rivets, nav lights, engine nozzles and canopies. Everything here runs once at bake time inside
// makeSprite, so it can afford shadowBlur and gradients.

import { TAU } from '../core/math.js';

// shadowBlur is measured in canvas pixels, not logical units; sprites set g.blurK so glow reads the same at any RES.
const bk = (g) => g.blurK || 1;

export function withAlpha(color, a) {
  if (color.startsWith('hsl(')) return color.replace('hsl(', 'hsla(').replace(')', `,${a})`);
  if (color.startsWith('#')) {
    let h = color.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  return color;
}

// Normalise any CSS colour to [r, g, b] (canvas fillStyle reads back as #rrggbb).
let probe = null;
export function rgbOf(color) {
  if (!probe) probe = document.createElement('canvas').getContext('2d');
  probe.fillStyle = '#000';
  probe.fillStyle = color;
  const h = probe.fillStyle;
  if (h.startsWith('#')) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = h.match(/[\d.]+/g) || [0, 0, 0];
  return [+m[0], +m[1], +m[2]];
}

// Blend toward white (k > 0) or black (k < 0).
export function shade(color, k) {
  const [r, g, b] = rgbOf(color);
  const t = k > 0 ? 255 : 0;
  const a = Math.abs(k);
  const f = (v) => Math.round(v + (t - v) * a);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function rgba(color, a) {
  const [r, g, b] = rgbOf(color);
  return `rgba(${r},${g},${b},${a})`;
}

export function poly(points) {
  return (g) => {
    g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.closePath();
  };
}

export function regular(n, r, rot = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

// Right half (x >= 0, listed from the centre line round to the centre line) → full symmetric outline.
export function mirror(half) {
  const out = half.slice();
  for (let i = half.length - 1; i >= 0; i--) {
    const [x, y] = half[i];
    if (x !== 0) out.push([-x, y]);
  }
  return out;
}

export const flipX = (pts) => pts.map(([x, y]) => [-x, y]);
export const flipY = (pts) => pts.map(([x, y]) => [x, -y]);
export const scalePts = (pts, k, ox = 0, oy = 0) => pts.map(([x, y]) => [x * k + ox, y * k + oy]);

export function glowStroke(g, color, width, blur, pathFn, passes = 2, core = 0.85) {
  g.save();
  g.strokeStyle = color;
  g.shadowColor = color;
  g.lineWidth = width;
  for (let i = 0; i < passes; i++) {
    g.shadowBlur = blur * (i + 1) * 0.6 * bk(g);
    g.beginPath();
    pathFn(g);
    g.stroke();
  }
  g.shadowBlur = 0;
  if (core > 0) {
    g.lineWidth = Math.max(0.6, width * 0.42);
    g.strokeStyle = `rgba(255,255,255,${core})`;
    g.beginPath();
    pathFn(g);
    g.stroke();
  }
  g.restore();
}

// Soft coloured bloom under a whole silhouette.
export function halo(g, color, pathFn, blur = 16, alpha = 0.18) {
  g.save();
  g.shadowColor = color;
  g.shadowBlur = blur * bk(g);
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.beginPath();
  pathFn(g);
  g.fill();
  g.restore();
}

// One armoured hull piece: dark glass base, a colour wash running y0 → y1, a specular sheen from the upper left,
// then the glowing neon rim.
export function part(g, pathFn, color, o = {}) {
  const { dark = 0.72, tint = 0.34, y0 = -24, y1 = 20, lw = 2, blur = 9, passes = 2, core = 0.8, sheen = 0.22 } = o;
  g.save();
  g.beginPath();
  pathFn(g);
  g.fillStyle = `rgba(5,3,14,${dark})`;
  g.fill();
  const grd = g.createLinearGradient(0, y0, 0, y1);
  grd.addColorStop(0, rgba(color, tint));
  grd.addColorStop(0.55, rgba(color, tint * 0.35));
  grd.addColorStop(1, rgba(color, tint * 0.75));
  g.fillStyle = grd;
  g.fill();
  if (sheen > 0) {
    g.clip();
    const sx = o.sx ?? -6;
    const sy = o.sy ?? y0 * 0.5;
    const sr = o.sr ?? Math.abs(y1 - y0) * 0.7;
    const sg = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
    sg.addColorStop(0, `rgba(255,255,255,${sheen})`);
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sg;
    g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }
  g.restore();
  if (lw > 0) glowStroke(g, color, lw, blur, pathFn, passes, core);
}

// Thin panel lines: segs = [[x1, y1, x2, y2], ...] or a path function.
export function seams(g, segs, color, alpha = 0.55, w = 0.7) {
  g.save();
  g.strokeStyle = rgba(shade(color, 0.45), alpha);
  g.lineWidth = w;
  g.beginPath();
  if (typeof segs === 'function') segs(g);
  else for (const [x1, y1, x2, y2] of segs) { g.moveTo(x1, y1); g.lineTo(x2, y2); }
  g.stroke();
  g.restore();
}

// Mirrored seams (each segment and its x-flip).
export function seamsM(g, segs, color, alpha, w) {
  const all = [];
  for (const [x1, y1, x2, y2] of segs) { all.push([x1, y1, x2, y2]); if (x1 || x2) all.push([-x1, y1, -x2, y2]); }
  seams(g, all, color, alpha, w);
}

// A line of short slats (vents / heat sinks), centred at x, y.
export function vents(g, x, y, w, h, n, color, alpha = 0.6, horizontal = true) {
  const segs = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    if (horizontal) segs.push([x - w / 2, y + t * h, x + w / 2, y + t * h]);
    else segs.push([x + t * w, y - h / 2, x + t * w, y + h / 2]);
  }
  seams(g, segs, color, alpha, 0.6);
}

export function rivets(g, pts, color, r = 0.55, alpha = 0.8) {
  g.save();
  g.fillStyle = rgba(shade(color, 0.6), alpha);
  for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  g.restore();
}

// Bright light with a coloured bloom (eyes, nav lights, cores).
export function lit(g, x, y, r, color, blur = 6) {
  g.save();
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = blur * bk(g);
  g.beginPath();
  g.arc(x, y, r * 1.5, 0, TAU);
  g.globalAlpha = 0.55;
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = '#fff';
  g.shadowBlur = blur * 0.5 * bk(g);
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.restore();
}

// Engine bell seen from above: dark nozzle, coloured rim, white-hot throat at the exhaust end (dir +1 = down).
export function nozzle(g, x, y, w, color, dir = 1, len = w * 0.9) {
  const h = len;
  const p = (c) => {
    c.moveTo(x - w * 0.36, y - dir * h * 0.5);
    c.lineTo(x + w * 0.36, y - dir * h * 0.5);
    c.lineTo(x + w * 0.5, y + dir * h * 0.5);
    c.lineTo(x - w * 0.5, y + dir * h * 0.5);
    c.closePath();
  };
  g.save();
  g.fillStyle = 'rgba(4,2,10,0.95)';
  g.beginPath(); p(g); g.fill();
  g.restore();
  glowStroke(g, color, 0.9, 4, p, 1, 0.5);
  g.save();
  g.fillStyle = '#fff';
  g.shadowColor = color;
  g.shadowBlur = 7 * bk(g);
  g.beginPath();
  g.ellipse(x, y + dir * h * 0.42, w * 0.34, Math.max(0.6, h * 0.16), 0, 0, TAU);
  g.fill();
  g.restore();
}

// Gun barrel from (x, y0) to (x, y1) with a bright muzzle ring at y1.
export function barrel(g, x, y0, y1, w, color) {
  g.save();
  g.lineCap = 'butt';
  g.strokeStyle = 'rgba(4,2,10,0.95)';
  g.lineWidth = w + 1.2;
  g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
  g.strokeStyle = rgba(color, 0.95);
  g.shadowColor = color;
  g.shadowBlur = 4 * bk(g);
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(x - w / 2, y0); g.lineTo(x - w / 2, y1);
  g.moveTo(x + w / 2, y0); g.lineTo(x + w / 2, y1);
  g.stroke();
  g.lineWidth = 1.3;
  g.strokeStyle = '#fff';
  g.beginPath(); g.moveTo(x - w / 2 - 0.4, y1); g.lineTo(x + w / 2 + 0.4, y1); g.stroke();
  g.restore();
}

// Glass canopy: white-to-colour gradient, a dark frame line and a small glint.
export function canopy(g, cx, cy, rx, ry, color) {
  g.save();
  const cg = g.createLinearGradient(0, cy - ry, 0, cy + ry);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(0.5, rgba(shade(color, 0.6), 0.95));
  cg.addColorStop(1, rgba(shade(color, -0.3), 0.95));
  g.fillStyle = cg;
  g.shadowColor = color;
  g.shadowBlur = 7 * bk(g);
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(5,3,14,0.75)';
  g.lineWidth = 0.6;
  g.beginPath();
  g.moveTo(cx - rx * 0.92, cy + ry * 0.15);
  g.quadraticCurveTo(cx, cy - ry * 0.25, cx + rx * 0.92, cy + ry * 0.15);
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.ellipse(cx - rx * 0.35, cy - ry * 0.45, rx * 0.22, ry * 0.2, -0.4, 0, TAU);
  g.fill();
  g.restore();
}

// Dashed ring (scanner sweeps, drone rails, shields).
export function dashRing(g, r, color, dash, alpha = 0.7, w = 1.1, y = 0) {
  g.save();
  g.strokeStyle = rgba(color, alpha);
  g.shadowColor = color;
  g.shadowBlur = 5 * bk(g);
  g.lineWidth = w;
  g.setLineDash(dash);
  g.beginPath();
  g.arc(0, y, r, 0, TAU);
  g.stroke();
  g.restore();
}
