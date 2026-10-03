// Player ship illustrations (nose up, origin at the hull centre, about ±26 units). Each ship is built from separate
// armoured parts drawn back to front, then weapons, seams, engines and the canopy, all from one paint colour so the
// hangar's paint jobs re-bake cleanly. SHIP_ENGINES[id] = [[x, y, width]] also drives the live engine flames.

import { TAU } from '../core/math.js';
import {
  poly, mirror, flipX, part, halo, seams, seamsM, vents, rivets, lit, nozzle, barrel, canopy, dashRing,
  glowStroke, shade, rgba,
} from './ink.js';

export const SHIP_ENGINES = {
  vector: [[-8, 15, 3.6], [8, 15, 3.6]],
  needle: [[0, 18, 4.2]],
  bulwark: [[-5, 16, 3.4], [5, 16, 3.4], [-15.5, 16, 3], [15.5, 16, 3]],
  phantom: [[-5, 13.5, 3], [5, 13.5, 3]],
  corsair: [[-3.6, 15.5, 3.2], [3.6, 15.5, 3.2]],
  monolith: [[-7, 18.5, 3.4], [0, 19, 3.8], [7, 18.5, 3.4]],
  wraith: [[-8, 15, 3], [8, 15, 3]],
  talon: [[-3.2, 16.5, 3], [3.2, 16.5, 3]],
  halo: [[-3.4, 17, 3], [3.4, 17, 3]],
  magnate: [[-4.5, 18, 3.6], [4.5, 18, 3.6], [-15, 16.5, 3], [15, 16.5, 3]],
};

// Both sides of a right-hand part.
function pair(g, half, color, o) {
  part(g, poly(half), color, o);
  part(g, poly(flipX(half)), color, { ...o, sx: -(o?.sx ?? -6) });
}

function engines(g, id, color) {
  for (const [x, y, w] of SHIP_ENGINES[id]) nozzle(g, x, y - 1.2, w, color, 1, w * 0.8);
}

const DRAW = {
  vector(g, c) {
    const wing = [[4.5, -4], [17, 7], [19.5, 11.5], [14, 12.5], [5, 9]];
    const nac = [[6, 3], [9, 1], [10.6, 4], [10.6, 14], [5.6, 14]];
    const can = [[4, -12], [8.5, -7], [8, -5.5], [4.4, -7]];
    const body = mirror([[0, -23], [2.4, -18], [4.2, -10], [5.2, 2], [4.4, 12], [2.6, 15]]);
    halo(g, c, (k) => { poly(body)(k); poly(mirror(wing.concat([[0, 9]])))(k); });
    pair(g, wing, c, { tint: 0.3, y0: -4, y1: 13, lw: 1.8 });
    pair(g, can, c, { tint: 0.45, lw: 1.2, blur: 5, passes: 1 });
    // wingtip pulse cannons
    barrel(g, 15.5, 6, -5, 1.8, c);
    barrel(g, -15.5, 6, -5, 1.8, c);
    pair(g, nac, c, { tint: 0.4, y0: 1, y1: 14, lw: 1.4, blur: 6 });
    part(g, poly(body), c, { y0: -23, y1: 15 });
    seams(g, [[0, -17, 0, -12], [0, -4, 0, 11], [-3, 2, 3, 2], [-3.2, 7, 3.2, 7]], c);
    seamsM(g, [[6.5, 0, 16, 9], [9, 6, 13.5, 10], [7.5, 5, 7.5, 13]], c, 0.45);
    vents(g, 0, 9.5, 4.4, 3, 3, c, 0.5);
    lit(g, 19, 11.3, 0.8, shade(c, 0.5));
    lit(g, -19, 11.3, 0.8, shade(c, 0.5));
    engines(g, 'vector', c);
    canopy(g, 0, -9, 2.4, 4.8, c);
  },

  needle(g, c) {
    const body = mirror([[0, -28], [1.2, -22], [2.6, -12], [4, 0], [4.4, 8], [3.6, 14], [2.4, 17]]);
    const delta = [[3.6, 0], [13, 11], [12.6, 15], [8, 15.5], [3.8, 12]];
    const fin = [[3, -6], [7, -2], [7, 0.5], [3.6, -0.5]];
    halo(g, c, (k) => { poly(body)(k); poly(mirror(delta.concat([[0, 14]])))(k); });
    pair(g, delta, c, { tint: 0.32, y0: 0, y1: 16, lw: 1.6 });
    pair(g, fin, c, { tint: 0.4, lw: 1.1, blur: 5, passes: 1 });
    part(g, poly(body), c, { y0: -28, y1: 17, sr: 18 });
    // lance rails and the focusing coils down the nose
    seams(g, [[-1.6, -21, -2.8, -6], [1.6, -21, 2.8, -6]], c, 0.7, 0.6);
    for (const y of [-17, -13.5, -10]) {
      const w = 1.4 + (y + 22) * 0.12;
      glowStroke(g, c, 0.9, 4, (k) => { k.moveTo(-w, y); k.lineTo(w, y); }, 1, 0.9);
    }
    lit(g, 0, -25.5, 0.9, shade(c, 0.5), 8);
    seamsM(g, [[5, 5, 11, 13], [4.4, 4, 4.4, 13]], c, 0.45);
    seams(g, [[0, 4, 0, 13]], c, 0.4);
    lit(g, 12.6, 14.2, 0.7, shade(c, 0.5));
    lit(g, -12.6, 14.2, 0.7, shade(c, 0.5));
    engines(g, 'needle', c);
    canopy(g, 0, -3, 1.9, 4.4, c);
  },

  bulwark(g, c) {
    const body = mirror([[0, -18], [4.5, -16.5], [8, -10], [8.4, 10], [6.4, 15]]);
    const wing = [[8, -7], [16, -3], [21.5, 4], [21.5, 12.5], [18, 15.5], [13, 15.5], [8, 12]];
    const shield = [[8.6, -11], [15, -8.5], [20, -2], [16, -2.6], [9, -6]];
    const pod = [[12.6, 8], [18.4, 8], [18.4, 16.5], [12.6, 16.5]];
    halo(g, c, (k) => { poly(body)(k); poly(mirror(wing.concat([[0, 12]])))(k); });
    pair(g, wing, c, { tint: 0.32, y0: -7, y1: 16, lw: 1.9 });
    pair(g, shield, c, { tint: 0.55, lw: 1.5, blur: 6, sheen: 0.35 });
    pair(g, pod, c, { tint: 0.4, lw: 1.1, blur: 4, passes: 1, sheen: 0 });
    part(g, poly(body), c, { y0: -18, y1: 15 });
    // scatter muzzle block at the nose
    part(g, poly([[-4.6, -21.5], [4.6, -21.5], [5.2, -16.5], [-5.2, -16.5]]), c, { tint: 0.5, lw: 1.1, blur: 4, passes: 1, sheen: 0 });
    for (const x of [-3, 0, 3]) lit(g, x, -21, 0.65, shade(c, 0.5), 4);
    seams(g, [[0, -14, 0, -9], [0, 0, 0, 13], [-8, 2, 8, 2], [-6, 9, 6, 9]], c);
    seamsM(g, [[10, -1, 20, 7], [9.6, 4, 12.6, 8], [14, 0, 14, 8]], c, 0.5);
    rivets(g, [[17, 3], [19.5, 6], [-17, 3], [-19.5, 6], [11, 0], [-11, 0], [5.5, -12], [-5.5, -12], [6.6, 5], [-6.6, 5]], c);
    vents(g, 15.5, 12.5, 4, 5, 3, c, 0.5);
    vents(g, -15.5, 12.5, 4, 5, 3, c, 0.5);
    engines(g, 'bulwark', c);
    canopy(g, 0, -6, 3.2, 4, c);
  },

  phantom(g, c) {
    const wing = mirror([[0, -22], [3, -13], [7.5, -7], [20, -6], [24, -0.5], [16, 1.5], [11.5, 5], [13.5, 16], [7.5, 10.5], [3.6, 13.5]]);
    const spine = mirror([[0, -18], [2.6, -11], [3.4, 2], [2.4, 11]]);
    halo(g, c, poly(wing), 18, 0.2);
    part(g, poly(wing), c, { y0: -22, y1: 16, tint: 0.3, sr: 24 });
    part(g, poly(spine), c, { tint: 0.5, lw: 1.1, blur: 5, passes: 1, y0: -18, y1: 11, sheen: 0.3 });
    // phase crescent emblem
    glowStroke(g, shade(c, 0.35), 1.5, 7, (k) => k.arc(0, 6, 7.2, Math.PI * 1.15, Math.PI * 1.85), 2, 0.9);
    seamsM(g, [[7.5, -7, 13, 2], [12, -5.5, 20, -2], [9, 4, 12, 13], [4, -4, 7.5, -7]], c, 0.5);
    seams(g, [[0, -1, 0, 8]], c, 0.4);
    lit(g, 23, -0.6, 0.8, shade(c, 0.6));
    lit(g, -23, -0.6, 0.8, shade(c, 0.6));
    lit(g, 13, 14.8, 0.6, shade(c, 0.5));
    lit(g, -13, 14.8, 0.6, shade(c, 0.5));
    engines(g, 'phantom', c);
    canopy(g, 0, -9.5, 2.2, 4.6, c);
  },

  corsair(g, c) {
    const body = mirror([[0, -24], [2.8, -16], [5, -6], [6, 6], [4.4, 13], [2.6, 15]]);
    const wing = [[5, -1], [14, -13], [20.5, -16], [20, -11], [15, 1], [7.4, 8]];
    const fin = [[5.4, 8], [10, 15.5], [8, 16.2], [4.4, 14]];
    halo(g, c, (k) => { poly(body)(k); poly(mirror(wing.concat([[0, 8]])))(k); });
    pair(g, fin, c, { tint: 0.38, lw: 1.2, blur: 5, passes: 1 });
    pair(g, wing, c, { tint: 0.32, y0: -16, y1: 8, lw: 1.9, sy: -12 });
    // angled ricochet launchers on the wing roots, toed outward
    for (const s of [-1, 1]) {
      g.save();
      g.translate(s * 17.5, -14);
      g.rotate(s * 0.35);
      barrel(g, 0, 2, -6, 1.8, c);
      g.restore();
    }
    part(g, poly(body), c, { y0: -24, y1: 15 });
    seams(g, [[0, -15, 0, -12], [0, -3, 0, 12], [-4.6, 4, 4.6, 4]], c);
    seamsM(g, [[7, 0, 16, -11], [9, 3, 18, -12], [6, 9, 8.6, 14]], c, 0.5);
    // skull-and-bolt hull stripe
    seamsM(g, [[2, 7, 4, 9.5], [2, 9.5, 4, 7]], c, 0.6, 0.6);
    lit(g, 20.3, -14, 0.8, shade(c, 0.5));
    lit(g, -20.3, -14, 0.8, shade(c, 0.5));
    engines(g, 'corsair', c);
    canopy(g, 0, -8.5, 2.5, 5, c);
  },

  monolith(g, c) {
    const hull = mirror([[0, -15], [8, -16.5], [13, -12.5], [14, 10], [10.5, 17.5], [5, 18]]);
    const spon = [[14, -6], [17.6, -4.5], [17.6, 11], [14, 13.5]];
    const gun = mirror([[0, -27.5], [2.6, -27.5], [3.4, -15], [4.6, -13]]);
    halo(g, c, (k) => { poly(hull)(k); poly(mirror(spon))(k); poly(gun)(k); }, 18);
    pair(g, spon, c, { tint: 0.42, lw: 1.3, blur: 5, sheen: 0.15 });
    part(g, poly(hull), c, { y0: -16, y1: 18, sr: 22 });
    part(g, poly(gun), c, { tint: 0.5, lw: 1.4, blur: 6, y0: -28, y1: -13, sheen: 0.3, sx: -1.5 });
    // charge coils on the barrel and the reactor that feeds it
    for (const y of [-25, -22, -19]) glowStroke(g, shade(c, 0.4), 1, 5, (k) => { k.moveTo(-3.2, y); k.lineTo(3.2, y); }, 1, 0.9);
    lit(g, 0, -27.3, 1, '#fff', 8);
    glowStroke(g, c, 1.2, 6, (k) => k.arc(0, 2, 5, 0, TAU), 1, 0.6);
    g.save();
    const rg = g.createRadialGradient(0, 2, 0, 0, 2, 4.4);
    rg.addColorStop(0, '#fff');
    rg.addColorStop(0.5, rgba(shade(c, 0.4), 0.9));
    rg.addColorStop(1, rgba(c, 0));
    g.fillStyle = rg;
    g.beginPath(); g.arc(0, 2, 4.4, 0, TAU); g.fill();
    g.restore();
    seams(g, [[-13, -4, -5, -4], [5, -4, 13, -4], [-13.6, 8, -5, 8], [5, 8, 13.6, 8], [-9, -12, -9, 15], [9, -12, 9, 15]], c, 0.5);
    rivets(g, [[-11, -10], [11, -10], [-11, 12], [11, 12], [-15.8, -2], [15.8, -2], [-15.8, 9], [15.8, 9]], c);
    vents(g, -11.5, 2, 3, 6, 4, c, 0.55);
    vents(g, 11.5, 2, 3, 6, 4, c, 0.55);
    engines(g, 'monolith', c);
    canopy(g, 0, -9.5, 2.6, 3, c);
  },

  wraith(g, c) {
    const body = mirror([[0, -25], [2.4, -15], [3.8, -4], [3.4, 8], [2, 12]]);
    const wing = [[3.6, -3], [21.5, 9], [22, 12.5], [10, 9.5], [3.4, 6]];
    const boom = [[6.2, -11], [8, -14], [9.8, -11], [9.8, 13.5], [8, 15], [6.2, 13.5]];
    halo(g, c, (k) => { poly(body)(k); poly(mirror(wing))(k); });
    pair(g, wing, c, { tint: 0.28, y0: -3, y1: 13, lw: 1.6 });
    pair(g, boom, c, { tint: 0.45, y0: -14, y1: 15, lw: 1.4, blur: 6, sheen: 0.3, sx: 7, sr: 10 });
    part(g, poly(body), c, { y0: -25, y1: 12, sr: 16 });
    // wave-lance emitters at the boom tips
    lit(g, 8, -13, 1, '#fff', 8);
    lit(g, -8, -13, 1, '#fff', 8);
    seamsM(g, [[8, -9, 8, 11], [11, 3, 20, 10], [4, 1, 6.2, 1]], c, 0.5);
    seams(g, [[0, -16, 0, -13], [0, -2, 0, 9]], c, 0.45);
    lit(g, 21.6, 11.2, 0.7, shade(c, 0.5));
    lit(g, -21.6, 11.2, 0.7, shade(c, 0.5));
    engines(g, 'wraith', c);
    canopy(g, 0, -7, 2.1, 5, c);
  },

  talon(g, c) {
    const body = mirror([[0, -26], [2.6, -16], [4.6, -3], [4.2, 10], [2.4, 16]]);
    const claw = [[4.4, 1], [12, -6], [17, -11], [21, -11], [18.4, -8], [16.6, -4], [10.5, 9], [4.4, 10]];
    const stab = [[3.6, 9], [9.4, 15], [8.6, 16.5], [3.8, 15.5]];
    halo(g, c, (k) => { poly(body)(k); poly(mirror(claw))(k); });
    pair(g, stab, c, { tint: 0.38, lw: 1.1, blur: 4, passes: 1 });
    pair(g, claw, c, { tint: 0.32, y0: -11, y1: 10, lw: 1.8, sy: -6 });
    part(g, poly(body), c, { y0: -26, y1: 16, sr: 18 });
    // long marksman barrel with a scope rail
    barrel(g, 0, -20, -29, 1.4, c);
    seams(g, [[-1.8, -22, -1.8, -15], [1.8, -22, 1.8, -15]], c, 0.6, 0.5);
    lit(g, 0, -15, 0.8, shade(c, 0.4), 6);
    seamsM(g, [[6, -1, 16, -9], [7, 4, 11.5, 7], [4.4, 3, 4.4, 9]], c, 0.5);
    seams(g, [[0, -1, 0, 13]], c, 0.4);
    // claw hooks
    glowStroke(g, shade(c, 0.3), 1.1, 4, (k) => { k.moveTo(21, -11); k.quadraticCurveTo(23, -15, 20, -18); k.moveTo(-21, -11); k.quadraticCurveTo(-23, -15, -20, -18); }, 1, 0.8);
    engines(g, 'talon', c);
    canopy(g, 0, -6, 2.3, 5.4, c);
  },

  halo(g, c) {
    const body = mirror([[0, -19], [3.8, -15], [6, -5], [7, 7], [5.4, 15]]);
    const wing = [[6, -1], [12.6, 3], [14, 9], [6.6, 10.6]];
    // drone rail with four docked wingmen
    dashRing(g, 21, c, [2.6, 2], 0.55, 1.1, 1);
    g.save();
    g.strokeStyle = rgba(c, 0.25);
    g.lineWidth = 3;
    g.beginPath(); g.arc(0, 1, 21, 0, TAU); g.stroke();
    g.restore();
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i / 4) * TAU;
      const x = Math.cos(a) * 21;
      const y = 1 + Math.sin(a) * 21;
      const d = poly([[x, y - 3], [x + 2.6, y], [x, y + 3], [x - 2.6, y]]);
      part(g, d, c, { tint: 0.6, lw: 1, blur: 4, passes: 1, sheen: 0, y0: y - 3, y1: y + 3 });
      lit(g, x, y, 0.6, '#fff', 4);
    }
    halo(g, c, (k) => { poly(body)(k); poly(mirror(wing))(k); });
    pair(g, wing, c, { tint: 0.34, y0: -1, y1: 11, lw: 1.5 });
    part(g, poly(body), c, { y0: -19, y1: 15 });
    // launch bay doors
    part(g, poly([[-3.4, 0], [3.4, 0], [3.8, 9], [-3.8, 9]]), c, { tint: 0.15, dark: 0.9, lw: 0.9, blur: 3, passes: 1, sheen: 0 });
    seams(g, (k) => { for (const y of [2.4, 5, 7.6]) { k.moveTo(-2.4, y + 1); k.lineTo(0, y - 0.6); k.lineTo(2.4, y + 1); } }, c, 0.7, 0.7);
    seamsM(g, [[7, 2, 12.4, 5], [6.6, 7, 13.4, 8.4]], c, 0.5);
    lit(g, 13.6, 8.6, 0.7, shade(c, 0.5));
    lit(g, -13.6, 8.6, 0.7, shade(c, 0.5));
    engines(g, 'halo', c);
    canopy(g, 0, -8, 2.6, 4.4, c);
  },

  magnate(g, c) {
    const hull = mirror([[0, -15], [6, -15], [9.4, -9], [10, 9], [7.4, 17]]);
    const pod = [[10, -5], [16.6, -5], [19.6, -1], [19.6, 12], [16.6, 15.5], [10, 13]];
    const arm = [[4.6, -14.5], [7.6, -21], [6.6, -25.5], [4.6, -26], [5.4, -21.4], [3, -16]];
    halo(g, c, (k) => { poly(hull)(k); poly(mirror(pod))(k); poly(arm)(k); poly(flipX(arm))(k); });
    pair(g, arm, c, { tint: 0.5, lw: 1.3, blur: 5, sheen: 0.2, y0: -26, y1: -14 });
    pair(g, pod, c, { tint: 0.36, y0: -5, y1: 15, lw: 1.7, sx: 15, sr: 12 });
    part(g, poly(hull), c, { y0: -15, y1: 17 });
    // shard crystal held in the salvage claws
    const shard = poly([[0, -24.5], [2.2, -21], [0, -16.5], [-2.2, -21]]);
    part(g, shard, shade(c, 0.35), { tint: 0.7, lw: 1, blur: 7, passes: 1, sheen: 0.5, y0: -25, y1: -16, sx: -1, sy: -23, sr: 4 });
    seams(g, [[-9.4, -2, 9.4, -2], [-9.8, 6, 9.8, 6], [0, -2, 0, 14]], c, 0.5);
    seamsM(g, [[10, 3, 19.6, 3], [13.4, -5, 13.4, 14.4]], c, 0.5);
    rivets(g, [[11.6, -3], [18, 1], [18, 11], [11.6, 11.4], [-11.6, -3], [-18, 1], [-18, 11], [-11.6, 11.4], [7.6, -7], [-7.6, -7]], c);
    // cargo hazard stripes
    seamsM(g, [[15, 7, 17.4, 4.6], [15, 9.6, 17.4, 7.2]], c, 0.7, 0.8);
    vents(g, 0, 10.5, 6, 3, 3, c, 0.5);
    engines(g, 'magnate', c);
    canopy(g, 0, -9, 2.8, 3.8, c);
  },
};

export function drawShip(g, id, color) {
  (DRAW[id] || DRAW.vector)(g, color);
}

export function hasShipArt(id) {
  return !!DRAW[id];
}
