// Mini boss illustrations (minibosses.js), in the boss art style: static bodies baked once with the ink.js kit (dark
// glass hull parts, colour wash, glowing rims, seams, vents, rivets, lights) plus a white hit-flash copy, and the moving
// pieces drawn per frame (engine flames, gun muzzles, legs, orbiting nodes, the CITADEL shield). Bodies face +y, at
// the player. Coordinates are logical units around the centre and sit on the hitbox parts in minibosses.js.

import { TAU } from '../core/math.js';
import { makeSprite, flame, glow } from './sprites.js';
import { poly, mirror, flipX, regular, part, halo, seams, seamsM, vents, rivets, lit, nozzle, barrel, canopy, dashRing, glowStroke, shade, rgba } from './ink.js';
import { G } from '../game/state.js';
import { SHIELD_SPAN, SHIELD_R } from '../game/minibosses.js';

const cache = new Map();
function cached(key, build) {
  let s = cache.get(key);
  if (!s) cache.set(key, (s = build()));
  return s;
}
const RES = 2; // like the boss bodies
const bake = (key, size, draw) => cached(key, () => makeSprite(size, draw, true, RES));

function pair(g, half, color, o = {}) {
  part(g, poly(half), color, o);
  part(g, poly(flipX(half)), color, { ...o, sx: -(o.sx ?? -6) });
}

// --- RAZORWING: forward fuselage, swept blade wings (wingtips at ±34, -6), twin engines at the rear. -------------------

function razorBody(c) {
  return bake('razorwing' + c, 150, (g) => {
    const fus = mirror([[0, -34], [8, -31], [12, -18], [11, 4], [7, 24], [0, 36]]);
    const wing = [[9, -8], [28, -16], [52, -34], [47, -18], [40, 2], [24, 10], [10, 8]];
    const canard = [[8, 16], [20, 14], [24, 20], [10, 24]];
    halo(g, c, (k) => { poly(fus)(k); poly(wing)(k); poly(flipX(wing))(k); }, 22, 0.16);
    pair(g, wing, c, { y0: -34, y1: 10, tint: 0.34, lw: 2.2, blur: 10, sx: 30, sy: -12, sr: 26 });
    // blade leading edges: hot white lines
    for (const s of [-1, 1]) glowStroke(g, '#ffffff', 1, 6, (k) => { k.moveTo(s * 9, -8); k.lineTo(s * 28, -16); k.lineTo(s * 52, -34); }, 1, 0.9);
    seamsM(g, [[14, -6, 40, -22], [18, 4, 44, -12], [24, 10, 40, 2]], c, 0.55, 0.8);
    pair(g, canard, c, { y0: 14, y1: 24, tint: 0.3, lw: 1.4, blur: 5, passes: 1, sheen: 0 });
    part(g, poly(fus), c, { y0: -34, y1: 36, tint: 0.3, lw: 2.6, blur: 12, sx: -4, sy: -10, sr: 30 });
    part(g, poly(mirror([[0, -24], [5, -22], [7, -8], [5, 10], [0, 14]])), c, { tint: 0.2, dark: 0.4, lw: 1, blur: 3, passes: 1, sheen: 0, y0: -24, y1: 14 });
    seams(g, [[-11, -10, 11, -10], [-10, 2, 10, 2], [0, -30, 0, -22]], c, 0.6, 0.8);
    rivets(g, [[-8, -26], [8, -26], [-9, -4], [9, -4], [-6, 18], [6, 18]], c, 0.8);
    canopy(g, 0, 20, 4.4, 8, c);
    for (const s of [-1, 1]) {
      nozzle(g, s * 6, -33, 7, c, -1);
      lit(g, s * 51, -32, 1.5, '#fff', 7);
      lit(g, s * 30, -15, 1, shade(c, 0.4), 5);
    }
  });
}

function drawRazor(ctx, e, hot) {
  const c = e.phase > 1 ? '#ff6a2b' : e.color;
  if (e.dive) {
    // Lock-on line: tracks you, then freezes and flashes white just before the dash.
    const t = Math.min(1, e.dive.t);
    ctx.save();
    ctx.globalAlpha = 0.25 + t * 0.55;
    ctx.strokeStyle = t > 0.62 ? (Math.sin(G.time * 50) > 0 ? '#ffffff' : c) : c;
    ctx.lineWidth = 1 + t * 2.5;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -G.time * 60;
    ctx.beginPath();
    ctx.moveTo(e.dive.x0, e.dive.y0);
    ctx.lineTo(e.dive.x1, e.dive.y1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(e.dive.x1, e.dive.y1, 18 - t * 8, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.rot) ctx.rotate(e.rot);
  const fl = flame(c);
  ctx.globalCompositeOperation = 'lighter';
  const boost = e.hold ? 1.8 : 1;
  for (const s of [-1, 1]) {
    const h = (20 + Math.sin(G.time * 37 + s) * 4) * boost;
    ctx.globalAlpha = 0.6;
    ctx.save();
    ctx.translate(s * 6, -37);
    ctx.scale(1, -1);
    ctx.drawImage(fl.img, -5, 0, 10, h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  blitAt(ctx, razorBody(c), hot);
  ctx.restore();
}

// --- MAULER: armoured frigate hull r28, gatling sponsons (r14) at ±46, 12 firing down. --------------------------------

function maulerBody(c) {
  return bake('mauler' + c, 170, (g) => {
    const hull = mirror([[0, -36], [18, -36], [30, -28], [34, -8], [31, 18], [18, 32], [0, 38]]);
    const deck = mirror([[0, -26], [12, -26], [21, -20], [24, -6], [21, 12], [12, 22], [0, 26]]);
    const spon = [[34, -4], [56, -4], [60, 2], [60, 28], [55, 34], [37, 34], [33, 26], [33, 2]];
    const strut = [[26, 4], [36, 0], [36, 14], [26, 16]];
    halo(g, c, (k) => { poly(hull)(k); poly(spon)(k); poly(flipX(spon))(k); }, 24, 0.16);
    pair(g, strut, c, { tint: 0.3, lw: 1.2, blur: 4, passes: 1, sheen: 0, y0: 0, y1: 16 });
    part(g, poly(hull), c, { y0: -36, y1: 38, tint: 0.3, lw: 2.8, blur: 13, sx: -10, sy: -16, sr: 40 });
    part(g, poly(deck), c, { y0: -26, y1: 26, tint: 0.18, dark: 0.4, lw: 1.2, blur: 4, passes: 1, sheen: 0, core: 0.4 });
    // bridge and the missile hatches (lit tubes)
    canopy(g, 0, -14, 7, 5, c);
    for (const x of [-9, 9]) {
      for (const y of [4, 13]) {
        part(g, (k) => k.rect(x - 4, y - 3.4, 8, 6.8), c, { tint: 0.1, dark: 0.95, lw: 0.9, blur: 3, passes: 1, sheen: 0, y0: y - 4, y1: y + 4 });
        lit(g, x, y, 1.3, shade(c, 0.3), 5);
      }
    }
    seams(g, [[-30, -8, -20, -4], [30, -8, 20, -4], [-24, 22, -14, 18], [24, 22, 14, 18], [0, -36, 0, -26], [0, 26, 0, 38]], c, 0.55, 0.9);
    rivets(g, [[-26, -28], [26, -28], [-32, 6], [32, 6], [-16, 30], [16, 30], [-12, -32], [12, -32]], c, 0.9);
    vents(g, 0, -31, 16, 4, 3, c, 0.6);
    for (const s of [-1, 1]) {
      part(g, poly(s > 0 ? spon : flipX(spon)), c, { y0: -4, y1: 34, tint: 0.34, lw: 2.2, blur: 9, sx: s * 46, sy: 4, sr: 20 });
      vents(g, s * 46, 6, 18, 6, 4, c, 0.55);
      rivets(g, [[s * 37, 0], [s * 57, 0], [s * 37, 30], [s * 57, 30]], c, 0.8);
      barrel(g, s * 42, 30, 46, 3.2, c);
      barrel(g, s * 50, 30, 46, 3.2, c);
      nozzle(g, s * 16, -37, 8, c, -1);
    }
  });
}

function drawMauler(ctx, e, hot) {
  const c = e.phase > 1 ? '#ff2e55' : e.color;
  const fl = flame(c);
  ctx.globalCompositeOperation = 'lighter';
  for (const s of [-1, 1]) {
    const h = 22 + Math.sin(G.time * 29 + s) * 4;
    ctx.globalAlpha = 0.55;
    ctx.save();
    ctx.translate(e.x + s * 16, e.y - 40);
    ctx.scale(1, -1);
    ctx.drawImage(fl.img, -6, 0, 12, h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  blit(ctx, maulerBody(c), e.x, e.y, hot);
  if (e.muz > 0) {
    const gl = glow('#ffffff', 64);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8;
    for (const s of [-1, 1]) ctx.drawImage(gl.img, e.x + s * 46 - 12, e.y + 46 - 12, 24, 24);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// --- BROODMOTHER: chitin body r30 with an egg sac (r14) slung under it, six spindly legs. -------------------------

function broodBody(c) {
  return bake('brood' + c, 170, (g) => {
    const Y = '#ffb3f0';
    const body = (k) => {
      for (let i = 0; i <= 56; i++) {
        const a = (i / 56) * TAU;
        const wob = 1 + Math.sin(a * 6) * 0.03;
        const x = Math.cos(a) * 32 * wob;
        const y = -4 + Math.sin(a) * 30 * wob;
        if (i) k.lineTo(x, y); else k.moveTo(x, y);
      }
      k.closePath();
    };
    halo(g, c, body, 26, 0.18);
    // mandibles at the front (+y), behind the sac
    for (const s of [-1, 1]) {
      const m = (k) => { k.moveTo(s * 10, 22); k.quadraticCurveTo(s * 26, 34, s * 18, 48); k.quadraticCurveTo(s * 14, 36, s * 4, 30); k.closePath(); };
      part(g, m, c, { tint: 0.36, lw: 1.6, blur: 6, sheen: 0, y0: 22, y1: 48 });
    }
    part(g, body, c, { y0: -34, y1: 26, tint: 0.28, lw: 2.6, blur: 12, sx: -10, sy: -18, sr: 34 });
    // chitin plates across the back
    for (let i = 0; i < 4; i++) {
      const y = -26 + i * 9;
      const w = 22 - Math.abs(i - 1.5) * 3;
      part(g, (k) => { k.moveTo(-w, y + 4); k.quadraticCurveTo(0, y - 6, w, y + 4); k.quadraticCurveTo(0, y, -w, y + 4); k.closePath(); }, c, { tint: 0.4, lw: 1, blur: 3, passes: 1, sheen: 0, y0: y - 6, y1: y + 4 });
    }
    seams(g, (k) => { for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { k.moveTo(s * 30, -14 + i * 10); k.quadraticCurveTo(s * 22, -10 + i * 10, s * 20, -4 + i * 10); } }, c, 0.5, 0.9);
    for (const [x, y] of [[-20, 6], [20, 6], [-12, 14], [12, 14], [-26, -6], [26, -6]]) lit(g, x, y, 1.2, Y, 6);
    // the sac: translucent, veined
    const sac = (k) => k.ellipse(0, 26, 15, 13, 0, 0, TAU);
    part(g, sac, Y, { y0: 13, y1: 39, tint: 0.4, dark: 0.55, lw: 1.8, blur: 8, sx: -4, sy: 20, sr: 12 });
    seams(g, (k) => { k.moveTo(-10, 20); k.quadraticCurveTo(-4, 26, -8, 34); k.moveTo(10, 20); k.quadraticCurveTo(4, 26, 8, 34); k.moveTo(0, 14); k.lineTo(0, 38); }, Y, 0.6, 0.8);
    // eyes
    for (const s of [-1, 1]) lit(g, s * 7, 16, 1.6, '#ffffff', 7);
  });
}

function drawBrood(ctx, e, hot) {
  const c = e.phase > 1 ? '#ff2e9a' : e.color;
  // legs: three a side, stepping
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const ph = G.time * 3.2 + i * 2.1 + (s > 0 ? Math.PI : 0);
      const hx = e.x + s * 24;
      const hy = e.y - 14 + i * 12;
      const kx = hx + s * (24 + Math.sin(ph) * 4);
      const ky = hy - 10 + i * 4;
      const fx = kx + s * (12 + Math.cos(ph) * 3);
      const fy = ky + 24 + Math.sin(ph) * 5;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(kx, ky);
      ctx.lineTo(fx, fy);
      ctx.strokeStyle = rgba(c, 0.3);
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = '#14060f';
      ctx.lineWidth = 3.4;
      ctx.stroke();
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
  }
  blit(ctx, broodBody(c), e.x, e.y, hot);
  // sac pulse (brighter when it pumps out eggs or swarms)
  const gl = glow('#ffb3f0', 64);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.35 + 0.15 * Math.sin(G.time * 5) + (e.pump > 0 ? 0.5 : 0);
  ctx.drawImage(gl.img, e.x - 20, e.y + 6, 40, 40);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// --- SPECTER: a hooded wraith r22 with a single eye, two scythe blades orbiting it. -------------------------------------

function specterBody(c) {
  return bake('specter' + c, 140, (g) => {
    const cloak = mirror([[0, -32], [12, -28], [22, -12], [26, 8], [30, 26], [20, 18], [14, 32], [6, 22], [0, 30]]);
    const hood = mirror([[0, -24], [10, -20], [15, -6], [12, 8], [0, 12]]);
    halo(g, c, poly(cloak), 24, 0.2);
    part(g, poly(cloak), c, { y0: -32, y1: 32, tint: 0.3, lw: 2.4, blur: 12, sx: -6, sy: -16, sr: 30 });
    seams(g, (k) => { for (const s of [-1, 1]) { k.moveTo(s * 6, 10); k.quadraticCurveTo(s * 16, 16, s * 18, 26); k.moveTo(s * 12, 4); k.quadraticCurveTo(s * 22, 10, s * 26, 22); } }, c, 0.6, 0.9);
    part(g, poly(hood), c, { y0: -24, y1: 12, tint: 0.16, dark: 0.92, lw: 1.4, blur: 5, passes: 1, sheen: 0 });
    // eye and its tear streaks
    lit(g, 0, -4, 3, c, 10);
    lit(g, 0, -4, 1.6, '#ffffff', 6);
    seams(g, [[-3, 0, -4, 8], [3, 0, 4, 8]], c, 0.8, 0.8);
    rivets(g, [[-18, -10], [18, -10], [-22, 6], [22, 6]], c, 0.8);
  });
}
function scythe(c) {
  return bake('scythe' + c, 48, (g) => {
    const blade = (k) => { k.moveTo(-2, 14); k.quadraticCurveTo(-4, -8, 16, -16); k.quadraticCurveTo(4, -6, 4, 14); k.closePath(); };
    part(g, blade, c, { y0: -16, y1: 14, tint: 0.4, lw: 1.4, blur: 6, sheen: 0.2 });
    glowStroke(g, '#ffffff', 0.8, 4, (k) => { k.moveTo(-2, 10); k.quadraticCurveTo(-4, -8, 16, -16); }, 1, 0.9);
  });
}

function drawSpecter(ctx, e, hot) {
  const c = e.phase > 1 ? '#c23bff' : e.color;
  const body = specterBody(c);
  if (e.ghost) {
    // after-image left where it blinked out
    ctx.globalAlpha = Math.max(0, e.ghost.t * 0.9);
    ctx.drawImage(body.img, e.ghost.x - body.half, e.ghost.y - body.half, body.size, body.size);
  }
  const a = e.alpha ?? 1;
  ctx.globalAlpha = a;
  const sc = scythe(c);
  for (let i = 0; i < 2; i++) {
    const ang = G.time * 2.4 + i * Math.PI;
    ctx.save();
    ctx.translate(e.x + Math.cos(ang) * 34, e.y + Math.sin(ang) * 28);
    ctx.rotate(ang + Math.PI / 2);
    ctx.drawImage(sc.img, -sc.half, -sc.half, sc.size, sc.size);
    ctx.restore();
  }
  ctx.drawImage(body.img, e.x - body.half, e.y - body.half + Math.sin(G.time * 2) * 2, body.size, body.size);
  if (hot && body.flash) {
    ctx.globalAlpha = 0.2 * a;
    ctx.drawImage(body.flash, e.x - body.half, e.y - body.half, body.size, body.size);
  }
  ctx.globalAlpha = 1;
}

// --- ARCLIGHT: hex pylon core r24 with coils, two diamond nodes (r12) on lightning tethers. ----------------------------

function arcCore(c) {
  return bake('arclight' + c, 130, (g) => {
    const hex = poly(regular(6, 26, Math.PI / 6));
    halo(g, c, hex, 22, 0.2);
    // coil fins between the faces
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const fin = poly([[Math.cos(a - 0.12) * 24, Math.sin(a - 0.12) * 24], [Math.cos(a) * 36, Math.sin(a) * 36], [Math.cos(a + 0.12) * 24, Math.sin(a + 0.12) * 24]]);
      part(g, fin, c, { tint: 0.35, lw: 1.2, blur: 5, passes: 1, sheen: 0, y0: -36, y1: 36 });
      lit(g, Math.cos(a) * 34, Math.sin(a) * 34, 1, '#ffffff', 5);
    }
    part(g, hex, c, { y0: -26, y1: 26, tint: 0.3, lw: 2.6, blur: 12, sx: -8, sy: -12, sr: 26 });
    part(g, poly(regular(6, 17, Math.PI / 6)), c, { tint: 0.2, dark: 0.85, lw: 1.4, blur: 5, passes: 1, sheen: 0, y0: -17, y1: 17 });
    // coil windings
    seams(g, (k) => { for (let r = 9; r <= 15; r += 3) { k.moveTo(r, 0); k.arc(0, 0, r, 0, TAU); } }, c, 0.5, 0.7);
    rivets(g, regular(6, 21, 0), c, 0.9);
  });
}
function arcNode(c) {
  return bake('arcnode' + c, 50, (g) => {
    const d = poly([[0, -14], [10, 0], [0, 14], [-10, 0]]);
    halo(g, c, d, 12, 0.25);
    part(g, d, c, { y0: -14, y1: 14, tint: 0.4, lw: 1.8, blur: 7, sheen: 0.25, sx: -3, sy: -6, sr: 10 });
    seams(g, [[-10, 0, 10, 0], [0, -14, 0, 14]], c, 0.5, 0.7);
    lit(g, 0, 0, 2.2, '#ffffff', 8);
  });
}
function zap(ctx, x0, y0, x1, y1, c, w) {
  const n = 7;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const j = (Math.random() - 0.5) * 12;
    ctx.lineTo(x0 + dx * t + nx * j, y0 + dy * t + ny * j);
  }
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = c;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = w * 0.35;
  ctx.stroke();
}

function drawArc(ctx, e, hot) {
  const c = e.phase > 1 ? '#9ffcff' : e.color;
  const ns = [];
  for (const pt of e.parts.slice(1)) ns.push(pt);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.7;
  for (const n of ns) zap(ctx, e.x, e.y, n.x, n.y, c, 2.2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  blit(ctx, arcCore(c), e.x, e.y, hot, e.anim * -0.4);
  const nd = arcNode(c);
  for (const n of ns) blit(ctx, nd, n.x, n.y, hot, G.time * 3);
}

// --- CITADEL: octagonal bastion r30, a central mortar, a rotating turret ring and a turning shield arc. -----------------

function citadelBody(c) {
  return bake('citadel' + c, 150, (g) => {
    const oct = poly(regular(8, 32, Math.PI / 8));
    halo(g, c, oct, 22, 0.18);
    // buttresses on the diagonals
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i / 4) * TAU;
      const b = poly([[Math.cos(a - 0.3) * 28, Math.sin(a - 0.3) * 28], [Math.cos(a - 0.12) * 42, Math.sin(a - 0.12) * 42], [Math.cos(a + 0.12) * 42, Math.sin(a + 0.12) * 42], [Math.cos(a + 0.3) * 28, Math.sin(a + 0.3) * 28]]);
      part(g, b, c, { tint: 0.34, lw: 1.6, blur: 6, passes: 1, sheen: 0, y0: -42, y1: 42 });
      lit(g, Math.cos(a) * 39, Math.sin(a) * 39, 1.2, '#ffffff', 5);
    }
    part(g, oct, c, { y0: -32, y1: 32, tint: 0.3, lw: 2.8, blur: 13, sx: -10, sy: -14, sr: 30 });
    part(g, poly(regular(8, 22, Math.PI / 8)), c, { tint: 0.18, dark: 0.5, lw: 1.2, blur: 4, passes: 1, sheen: 0, y0: -22, y1: 22 });
    seams(g, (k) => { for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i / 8) * TAU; k.moveTo(Math.cos(a) * 22, Math.sin(a) * 22); k.lineTo(Math.cos(a) * 32, Math.sin(a) * 32); } }, c, 0.6, 0.9);
    rivets(g, regular(8, 27, 0), c, 0.9);
    // mortar well
    part(g, (k) => k.arc(0, 0, 11, 0, TAU), c, { tint: 0.1, dark: 0.95, lw: 1.6, blur: 6, passes: 1, sheen: 0, y0: -11, y1: 11 });
    dashRing(g, 15, c, [3, 3], 0.7, 1);
  });
}

function drawCitadel(ctx, e, hot) {
  const c = e.phase > 1 ? '#ff9e3d' : e.color;
  blit(ctx, citadelBody(c), e.x, e.y, hot);
  // turret ring: four short barrels turning with the shield's gap
  const ta = (e.shA ?? Math.PI / 2) + Math.PI;
  ctx.strokeStyle = c;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = ta + (i / 4) * TAU + Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14);
    ctx.lineTo(e.x + Math.cos(a) * 22, e.y + Math.sin(a) * 22);
    ctx.stroke();
  }
  const core = glow(c, 64);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.6 + 0.3 * Math.sin(G.time * 6);
  ctx.drawImage(core.img, e.x - 14, e.y - 14, 28, 28);
  // shield: segmented arc plates, flaring when it eats a shot
  if (e.state !== 'enter' && e.state !== 'dying') {
    const a0 = (e.shA ?? Math.PI / 2) - SHIELD_SPAN / 2;
    const seg = 7;
    const hitK = e.shHit > 0 ? 1 : 0;
    for (let i = 0; i < seg; i++) {
      const s0 = a0 + (i / seg) * SHIELD_SPAN + 0.03;
      const s1 = a0 + ((i + 1) / seg) * SHIELD_SPAN - 0.03;
      ctx.beginPath();
      ctx.arc(e.x, e.y, SHIELD_R, s0, s1);
      ctx.globalAlpha = 0.3 + hitK * 0.25;
      ctx.strokeStyle = c;
      ctx.lineWidth = 11;
      ctx.stroke();
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = hitK ? '#ffffff' : shade(c, 0.35);
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// --- shared ---------------------------------------------------------------------------------------------------------

function blit(ctx, spr, x, y, hot, a = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (a) ctx.rotate(a);
  blitAt(ctx, spr, hot);
  ctx.restore();
}
function blitAt(ctx, spr, hot) {
  const h = spr.half;
  ctx.drawImage(spr.img, -h, -h, spr.size, spr.size);
  if (hot && spr.flash) {
    ctx.globalAlpha = 0.2;
    ctx.drawImage(spr.flash, -h, -h, spr.size, spr.size);
    ctx.globalAlpha = 1;
  }
}

const DRAW = { razorwing: drawRazor, mauler: drawMauler, broodmother: drawBrood, specter: drawSpecter, arclight: drawArc, citadel: drawCitadel };
export function drawMini(ctx, e, hot) {
  (DRAW[e.kind] || drawRazor)(ctx, e, hot);
}

// Bake every body up front (boss art does the same) so the first meeting never hitches.
export function prewarmMiniArt() {
  for (const [c, c2] of [['#ffb02e', '#ff6a2b']]) { razorBody(c); razorBody(c2); }
  maulerBody('#ff4a3d'); maulerBody('#ff2e55');
  broodBody('#ff4fd8'); broodBody('#ff2e9a');
  specterBody('#9b7bff'); specterBody('#c23bff'); scythe('#9b7bff'); scythe('#c23bff');
  arcCore('#4fd6ff'); arcCore('#9ffcff'); arcNode('#4fd6ff'); arcNode('#9ffcff');
  citadelBody('#ffe14d'); citadelBody('#ff9e3d');
}
