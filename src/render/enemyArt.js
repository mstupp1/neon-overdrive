// Enemy illustrations. Directional enemies face +y (the sprite's down axis follows their heading); spinners are
// radial so they read at any angle. Box sizes match the old sprites so on-screen scale and hitboxes are unchanged.

import { TAU } from '../core/math.js';
import {
  poly, mirror, flipX, regular, part, halo, seams, seamsM, vents, rivets, lit, nozzle, barrel, canopy, dashRing,
  glowStroke, shade, rgba,
} from './ink.js';

const RES = 3;

function pair(g, half, color, o = {}) {
  part(g, poly(half), color, o);
  part(g, poly(flipX(half)), color, { ...o, sx: -(o.sx ?? -6) });
}

// Rotate a point list by a.
const rot = (pts, a) => pts.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);

// Hostile eye: a dark socket, a coloured iris and a white-hot pupil.
function eye(g, x, y, rx, ry, color, a = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.fillStyle = 'rgba(2,0,6,0.95)';
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill();
  g.restore();
  lit(g, x, y, Math.min(rx, ry) * 0.6, color, 7);
}

export function buildEnemyArt(S, makeSprite, E) {
  const mk = (size, fn) => makeSprite(size, fn, true, RES);

  S.dart = mk(40, (g) => {
    const c = E.dart;
    const body = mirror([[0, 15], [2.6, 8], [3.6, -2], [2.8, -9], [0, -11.5]]);
    const wing = [[3, 3], [12.5, -7.5], [13.6, -11.5], [9, -8.4], [3.2, -4.4]];
    halo(g, c, (k) => { poly(body)(k); poly(mirror(wing))(k); }, 12);
    pair(g, wing, c, { y0: -11, y1: 3, tint: 0.3, lw: 1.7, blur: 7 });
    barrel(g, 4.6, 0, 9, 1.4, c);
    barrel(g, -4.6, 0, 9, 1.4, c);
    part(g, poly(body), c, { y0: 15, y1: -11, lw: 1.9, blur: 8, sy: 6, sr: 12 });
    seamsM(g, [[4.5, -3, 11, -8.4], [3, -6, 7, -6.4]], c, 0.5);
    seams(g, [[0, -8, 0, 2]], c, 0.45);
    nozzle(g, 0, -11.2, 3, c, -1, 2.4);
    eye(g, 0, 7.5, 1.7, 2.6, c);
    lit(g, 13.1, -10.6, 0.6, shade(c, 0.4), 4);
    lit(g, -13.1, -10.6, 0.6, shade(c, 0.4), 4);
  });

  S.swarm = mk(30, (g) => {
    const c = E.swarm;
    // gauzy wings behind the shell
    for (const s of [-1, 1]) {
      g.save();
      g.fillStyle = rgba(c, 0.16);
      g.strokeStyle = rgba(shade(c, 0.4), 0.55);
      g.lineWidth = 0.6;
      g.beginPath(); g.ellipse(s * 7.5, -2.5, 3.6, 7, s * 0.55, 0, TAU); g.fill(); g.stroke();
      g.restore();
    }
    const shell = [[0.5, -7.5], [4.4, -6], [6.4, -1], [5.2, 5], [0.5, 7]];
    pair(g, shell, c, { y0: -8, y1: 7, tint: 0.45, lw: 1.5, blur: 6, sheen: 0.3, sx: -4, sr: 7 });
    part(g, poly(mirror([[0, 6.5], [3.2, 7.4], [2.6, 10.2], [0, 11]])), c, { y0: 6, y1: 11, tint: 0.5, lw: 1.1, blur: 4, passes: 1, sheen: 0 });
    glowStroke(g, c, 0.9, 4, (k) => { k.moveTo(2, 10.4); k.quadraticCurveTo(4.4, 12.6, 2.6, 14); k.moveTo(-2, 10.4); k.quadraticCurveTo(-4.4, 12.6, -2.6, 14); }, 1, 0.6);
    seams(g, [[-3.6, -1, -1.5, 3], [3.6, -1, 1.5, 3]], c, 0.5, 0.6);
    lit(g, 1.4, 8.8, 0.7, '#fff', 4);
    lit(g, -1.4, 8.8, 0.7, '#fff', 4);
  });

  S.spinner = mk(60, (g) => {
    const c = E.spinner;
    const blade = [[6.5, -4], [13.5, -7.4], [21.5, -3.6], [24, 1.4], [16, 0.6], [7.4, 4]];
    const all = (k) => { for (let i = 0; i < 4; i++) poly(rot(blade, (i / 4) * TAU))(k); k.arc(0, 0, 9.5, 0, TAU); };
    halo(g, c, all, 16, 0.2);
    for (let i = 0; i < 4; i++) {
      const b = rot(blade, (i / 4) * TAU);
      part(g, poly(b), c, { y0: -22, y1: 22, tint: 0.32, lw: 1.9, blur: 8, sx: 0, sy: 0, sr: 24, sheen: 0.18 });
      const [a1, a2] = [rot([[9, -2.4]], (i / 4) * TAU)[0], rot([[19.5, -1.6]], (i / 4) * TAU)[0]];
      seams(g, [[a1[0], a1[1], a2[0], a2[1]]], c, 0.6, 0.7);
      const tip = rot([[22.5, 0.4]], (i / 4) * TAU)[0];
      lit(g, tip[0], tip[1], 0.6, shade(c, 0.5), 4);
    }
    part(g, (k) => k.arc(0, 0, 9.5, 0, TAU), c, { y0: -10, y1: 10, tint: 0.4, lw: 2, blur: 8, sx: -3, sy: -3, sr: 8 });
    glowStroke(g, c, 1, 4, (k) => k.arc(0, 0, 6, 0, TAU), 1, 0.5);
    rivets(g, regular(8, 7.8, Math.PI / 8), c, 0.6);
    lit(g, 0, 0, 2.6, c, 10);
  });

  S.dasher = mk(44, (g) => {
    const c = E.dasher;
    const body = mirror([[0, 17.5], [2.2, 12], [5, 3], [6.2, -4], [4.4, -10.5], [0, -12.5]]);
    const fin = [[5, 0], [13.5, -9.5], [15, -13.5], [9, -10], [5.6, -6]];
    const dorsal = mirror([[0, -2], [1.4, -7], [0.8, -15], [0, -16]]);
    halo(g, c, (k) => { poly(body)(k); poly(mirror(fin))(k); }, 12);
    pair(g, fin, c, { y0: -13, y1: 0, tint: 0.32, lw: 1.7, blur: 7 });
    part(g, poly(dorsal), c, { tint: 0.5, lw: 1, blur: 4, passes: 1, sheen: 0 });
    part(g, poly(body), c, { y0: 17, y1: -12, lw: 2, blur: 9, sy: 8, sr: 14 });
    // ram blade: a white-hot edge on the nose
    glowStroke(g, shade(c, 0.5), 1.2, 6, (k) => { k.moveTo(-3.6, 8); k.lineTo(0, 16.6); k.lineTo(3.6, 8); }, 1, 0.95);
    seamsM(g, [[3, 4, 5.4, -3], [6, -2, 12.4, -10.6], [1.6, -4, 3.4, -9]], c, 0.5);
    eye(g, 2.8, 5.5, 1, 2, c, -0.5);
    eye(g, -2.8, 5.5, 1, 2, c, 0.5);
    nozzle(g, 2.4, -11.4, 2.6, c, -1, 2);
    nozzle(g, -2.4, -11.4, 2.6, c, -1, 2);
  });

  S.snakeHead = mk(40, (g) => {
    const c = E.snake;
    const skull = mirror([[0, 12.5], [4.4, 10.6], [8.4, 4.6], [9.4, -3.4], [6.6, -10], [0, -12.4]]);
    const fang = [[5, 9], [8.6, 12.6], [7.4, 17], [5.6, 13.4], [3.4, 11.6]];
    const crest = mirror([[0, -3], [3, -6], [2.4, -12.5], [0, -14.6]]);
    halo(g, c, (k) => { poly(skull)(k); poly(mirror(fang))(k); }, 12);
    pair(g, fang, shade(c, 0.25), { tint: 0.5, lw: 1.3, blur: 5, sheen: 0, y0: 9, y1: 17 });
    part(g, poly(skull), c, { y0: 12, y1: -12, lw: 2, blur: 9, sy: 4, sr: 13 });
    part(g, poly(crest), c, { tint: 0.5, lw: 1.1, blur: 4, passes: 1, sheen: 0 });
    // scale plates
    seams(g, (k) => {
      for (const y of [-6, -1, 4]) { k.moveTo(-7.4, y); k.quadraticCurveTo(0, y + 3.4, 7.4, y); }
    }, c, 0.45, 0.6);
    seams(g, [[-1.2, 10, -0.6, 8], [1.2, 10, 0.6, 8]], c, 0.7, 0.6);
    eye(g, 4.4, 4.5, 1.7, 2.6, '#ffffff', -0.5);
    eye(g, -4.4, 4.5, 1.7, 2.6, '#ffffff', 0.5);
    lit(g, 4.4, 4.5, 0.9, c, 6);
    lit(g, -4.4, 4.5, 0.9, c, 6);
  });

  S.snakeSeg = mk(30, (g) => {
    const c = E.snake;
    const hex = regular(6, 8.6, Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 2 + (i / 6) * TAU + Math.PI / 6;
      glowStroke(g, c, 1.1, 4, (k) => { k.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); k.lineTo(Math.cos(a) * 11.6, Math.sin(a) * 11.6); }, 1, 0.5);
    }
    part(g, poly(hex), c, { y0: -9, y1: 9, tint: 0.34, lw: 1.7, blur: 6, sr: 8 });
    seams(g, (k) => poly(regular(6, 5, Math.PI / 2))(k), c, 0.55, 0.7);
    seams(g, [[0, -8.6, 0, -5], [0, 5, 0, 8.6]], c, 0.5, 0.6);
    lit(g, 0, 0, 1.3, c, 5);
  });

  S.sniper = mk(46, (g) => {
    const c = E.sniper;
    for (let i = 0; i < 3; i++) {
      const leg = rot([[-2.2, 10], [2.2, 10], [3.4, 19], [0, 21.5], [-3.4, 19]], (i / 3) * TAU);
      part(g, poly(leg), c, { tint: 0.45, lw: 1.3, blur: 5, sheen: 0, y0: -20, y1: 20 });
      const tip = rot([[0, 19.4]], (i / 3) * TAU)[0];
      lit(g, tip[0], tip[1], 0.7, shade(c, 0.4), 4);
    }
    const hex = poly(regular(6, 13.4, 0));
    halo(g, c, hex, 12);
    part(g, hex, c, { y0: -14, y1: 14, lw: 2, blur: 8, sr: 12 });
    rivets(g, regular(6, 11, Math.PI / 6), c, 0.6);
    // scope lens: rings, crosshair, glowing pupil
    glowStroke(g, c, 1.4, 6, (k) => k.arc(0, 0, 7.4, 0, TAU), 1, 0.6);
    g.save();
    g.fillStyle = 'rgba(2,0,6,0.92)';
    g.beginPath(); g.arc(0, 0, 6.4, 0, TAU); g.fill();
    g.restore();
    seams(g, [[-6, 0, -2.6, 0], [2.6, 0, 6, 0], [0, -6, 0, -2.6], [0, 2.6, 0, 6]], c, 0.8, 0.6);
    glowStroke(g, shade(c, 0.3), 0.8, 3, (k) => k.arc(0, 0, 4.4, 0, TAU), 1, 0.4);
    lit(g, 0, 0, 2, c, 9);
  });

  S.tank = mk(78, (g) => {
    const c = E.tank;
    const oct = regular(8, 28.5, Math.PI / 8);
    halo(g, c, poly(oct), 16, 0.18);
    // three heavy turrets (it fires three arms)
    part(g, poly(oct), c, { y0: -28, y1: 28, tint: 0.26, lw: 2.6, blur: 11, sr: 30 });
    // armour plates: inner octagon + radial plate seams + rivets
    seams(g, (k) => poly(regular(8, 20, Math.PI / 8))(k), c, 0.6, 0.9);
    const segs = [];
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i / 8) * TAU;
      segs.push([Math.cos(a) * 20, Math.sin(a) * 20, Math.cos(a) * 28, Math.sin(a) * 28]);
    }
    seams(g, segs, c, 0.5, 0.7);
    rivets(g, regular(8, 24.4, 0), c, 0.8);
    rivets(g, regular(16, 17.4, 0), c, 0.5, 0.6);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      g.save();
      g.rotate(a + Math.PI / 2);
      seams(g, [[-3, -23, 3, -23], [-2.4, -21.4, 2.4, -21.4]], c, 0.45, 0.5);
      g.restore();
    }
    for (let i = 0; i < 3; i++) {
      g.save();
      g.rotate((i / 3) * TAU);
      barrel(g, -2.4, -10, -31, 2, c);
      barrel(g, 2.4, -10, -31, 2, c);
      part(g, poly([[-6, -9], [6, -9], [5, -16], [-5, -16]]), c, { tint: 0.5, lw: 1.3, blur: 5, passes: 1, sheen: 0, y0: -16, y1: -9 });
      g.restore();
    }
    // reactor
    part(g, (k) => k.arc(0, 0, 10, 0, TAU), c, { y0: -10, y1: 10, tint: 0.4, lw: 1.8, blur: 7, sr: 10 });
    g.save();
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, 7.6);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(0.4, rgba(shade(c, 0.4), 0.95));
    rg.addColorStop(1, rgba(c, 0));
    g.fillStyle = rg;
    g.beginPath(); g.arc(0, 0, 7.6, 0, TAU); g.fill();
    g.restore();
    seams(g, (k) => { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; k.moveTo(Math.cos(a) * 3.6, Math.sin(a) * 3.6); k.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); } }, c, 0.35, 0.6);
  });

  S.splitter = mk(48, (g) => {
    const c = E.splitter;
    const membrane = (k) => {
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * TAU;
        const r = 16 + Math.sin(a * 5) * 1.1 + Math.sin(a * 3 + 1) * 0.6;
        if (i) k.lineTo(Math.cos(a) * r, Math.sin(a) * r); else k.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      k.closePath();
    };
    halo(g, c, membrane, 14, 0.2);
    part(g, membrane, c, { y0: -16, y1: 16, tint: 0.24, lw: 2.2, blur: 9, sr: 16 });
    glowStroke(g, c, 0.8, 3, (k) => k.arc(0, 0, 12.6, 0, TAU), 1, 0.3);
    // three nuclei: the pieces it splits into
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i / 3) * TAU;
      const x = Math.cos(a) * 7.4;
      const y = Math.sin(a) * 7.4;
      part(g, (k) => k.arc(x, y, 4.2, 0, TAU), c, { y0: y - 4, y1: y + 4, tint: 0.6, lw: 1.3, blur: 5, passes: 1, sx: x - 1.4, sy: y - 1.4, sr: 4, sheen: 0.4 });
      lit(g, x, y, 1.2, '#fff', 4);
    }
    rivets(g, [[0, 0], [5, 4], [-5, 4], [0, -4.4], [9, -9], [-10, -8], [11, 7], [-10, 9], [2, 12.4]], c, 0.6, 0.6);
    glowStroke(g, c, 0.7, 3, (k) => { k.moveTo(0, -3); k.lineTo(0, 3); k.moveTo(-2.6, 1.5); k.lineTo(2.6, -1.5); k.moveTo(-2.6, -1.5); k.lineTo(2.6, 1.5); }, 1, 0.4);
  });

  S.mine = mk(34, (g) => {
    const c = E.mine;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const x1 = Math.cos(a) * 9;
      const y1 = Math.sin(a) * 9;
      const x2 = Math.cos(a) * 14.4;
      const y2 = Math.sin(a) * 14.4;
      glowStroke(g, c, 1.5, 5, (k) => { k.moveTo(x1, y1); k.lineTo(x2, y2); }, 1, 0.6);
      lit(g, x2, y2, 0.9, shade(c, 0.4), 4);
    }
    part(g, (k) => k.arc(0, 0, 9.4, 0, TAU), c, { y0: -9, y1: 9, tint: 0.38, lw: 1.9, blur: 7, sx: -3, sy: -3, sr: 9, sheen: 0.3 });
    seams(g, (k) => { k.ellipse(0, 0, 9.2, 3.2, 0, 0, TAU); k.moveTo(0, -9.2); k.lineTo(0, 9.2); }, c, 0.5, 0.6);
    lit(g, 0, 0, 2.2, c, 8);
  });

  S.carrier = mk(84, (g) => {
    const c = E.carrier;
    const hull = mirror([[0, 26.5], [9, 23.5], [20, 14], [29.5, 1], [28, -11], [19, -19.5], [9, -23.5], [0, -22]]);
    const pylon = [[20, -2], [31, -6], [33.5, -1], [31, 6], [22, 6]];
    halo(g, c, poly(hull), 18, 0.18);
    pair(g, pylon, c, { tint: 0.38, lw: 1.5, blur: 5, sheen: 0, y0: -6, y1: 6 });
    for (const s of [-1, 1]) lit(g, s * 32.6, -1, 0.9, '#fff', 5);
    part(g, poly(hull), c, { y0: 26, y1: -22, lw: 2.5, blur: 11, sy: 6, sr: 28 });
    // launch bays with lit runway markers
    for (const s of [-1, 1]) {
      const bay = poly([[s * 7, 16], [s * 18, 11], [s * 18, -8], [s * 7, -8]]);
      part(g, bay, c, { tint: 0.1, dark: 0.92, lw: 1.3, blur: 4, passes: 1, sheen: 0, y0: -8, y1: 16 });
      for (const y of [-4, 0, 4, 8]) lit(g, s * 12.5, y, 0.5, shade(c, 0.4), 3);
      vents(g, s * 12.5, 12.6, 6, 1.4, 2, c, 0.6);
    }
    // command bridge
    part(g, poly(mirror([[0, 23], [5, 20], [5.6, 14], [3, 11], [0, 11]])), c, { tint: 0.5, lw: 1.2, blur: 4, passes: 1, sheen: 0.3, y0: 11, y1: 23 });
    canopy(g, 0, 17.5, 2.6, 2.4, c);
    seams(g, [[0, -21, 0, -10], [-18, -12, 18, -12], [-22, -3, -18, -3], [22, -3, 18, -3]], c, 0.5);
    seamsM(g, [[21, 4, 27, -4], [20, 12, 23, 9]], c, 0.5);
    rivets(g, [[-24, -10], [24, -10], [-15, 18], [15, 18], [-6, -18], [6, -18], [-25, 2], [25, 2]], c);
    lit(g, 0, 2, 3, c, 10);
    for (const x of [-9, 0, 9]) nozzle(g, x, -22, 4, c, -1, 3);
  });

  S.shielder = mk(52, (g) => {
    const c = E.shielder;
    for (let i = 0; i < 3; i++) {
      g.save();
      g.rotate(-Math.PI / 2 + (i / 3) * TAU + Math.PI / 2);
      part(g, poly([[-2.2, -11], [2.2, -11], [1.6, -19], [-1.6, -19]]), c, { tint: 0.45, lw: 1.1, blur: 4, passes: 1, sheen: 0, y0: -19, y1: -11 });
      glowStroke(g, c, 1.6, 6, (k) => k.arc(0, -16, 7, Math.PI * 1.25, Math.PI * 1.75), 2, 0.9);
      lit(g, 0, -20.6, 0.9, '#fff', 6);
      g.restore();
    }
    const hex = poly(regular(6, 14, Math.PI / 2));
    halo(g, c, hex, 12);
    part(g, hex, c, { y0: -14, y1: 14, lw: 2, blur: 8, sr: 12 });
    seams(g, (k) => poly(regular(6, 9.6, Math.PI / 2))(k), c, 0.5);
    rivets(g, regular(6, 11.8, 0), c, 0.55);
    glowStroke(g, c, 1.2, 5, (k) => k.arc(0, 0, 6, 0, TAU), 1, 0.6);
    dashRing(g, 4, '#ffffff', [1.2, 1.2], 0.5, 0.6);
    lit(g, 0, 0, 2.2, c, 8);
  });

  S.weaver = mk(40, (g) => {
    const c = E.weaver;
    // four loom tines around a faceted shuttle
    for (let i = 0; i < 4; i++) {
      g.save();
      g.rotate((i / 4) * TAU + Math.PI / 4);
      part(g, poly([[0, -9], [2.6, -12], [1.2, -17], [-1.2, -17], [-2.6, -12]]), c, { tint: 0.5, lw: 1.1, blur: 4, passes: 1, sheen: 0, y0: -17, y1: -9 });
      lit(g, 0, -16.4, 0.6, shade(c, 0.5), 3);
      g.restore();
    }
    const d = poly([[0, 13], [11.4, 0], [0, -13], [-11.4, 0]]);
    halo(g, c, d, 12);
    part(g, d, c, { y0: -13, y1: 13, lw: 2, blur: 8, sr: 11 });
    seams(g, [[0, -13, 0, 13], [-11.4, 0, 11.4, 0], [-5.7, -6.5, 5.7, 6.5], [5.7, -6.5, -5.7, 6.5]], c, 0.35, 0.6);
    glowStroke(g, c, 1.2, 5, poly([[0, 6], [5, 0], [0, -6], [-5, 0]]), 1, 0.7);
    lit(g, 0, 0, 2, '#fff', 7);
  });

  S.blinker = mk(44, (g) => {
    const c = E.blinker;
    const star = poly([[0, -16], [3.4, -3.4], [16, 0], [3.4, 3.4], [0, 16], [-3.4, 3.4], [-16, 0], [-3.4, -3.4]]);
    halo(g, c, star, 14, 0.22);
    // phase afterimage frame
    glowStroke(g, rgba(c, 0.5), 0.8, 4, poly(regular(4, 13, 0)), 1, 0.25);
    part(g, star, c, { y0: -16, y1: 16, tint: 0.3, lw: 1.8, blur: 8, sx: -3, sy: -3, sr: 12 });
    seams(g, [[0, -14, 0, -6], [0, 6, 0, 14], [-14, 0, -8, 0], [8, 0, 14, 0]], c, 0.6, 0.6);
    // almond eye
    const al = (k) => { k.moveTo(-7.6, 0); k.quadraticCurveTo(0, -7, 7.6, 0); k.quadraticCurveTo(0, 7, -7.6, 0); k.closePath(); };
    g.save();
    g.fillStyle = 'rgba(2,0,8,0.95)';
    g.beginPath(); al(g); g.fill();
    g.restore();
    glowStroke(g, c, 1.2, 5, al, 1, 0.8);
    glowStroke(g, '#b98cff', 1, 4, (k) => k.arc(0, 0, 2.8, 0, TAU), 1, 0.4);
    lit(g, 0, 0, 1.4, '#fff', 6);
    for (const [x, y] of [[0, -15], [15, 0], [0, 15], [-15, 0]]) lit(g, x, y, 0.6, '#fff', 4);
  });

  S.hunter = mk(84, (g) => {
    const c = E.hunter;
    const body = mirror([[0, 29], [3.6, 22], [7.6, 10], [9, -6], [7, -19], [3.6, -24], [0, -24.5]]);
    const wing = [[8.4, 4], [22, -4], [33, -14], [35, -22], [28, -20], [17, -15], [8.6, -14]];
    const fang = [[22, -4], [25, 6], [23.4, 9], [20, -2]];
    halo(g, c, (k) => { poly(body)(k); poly(mirror(wing))(k); }, 18, 0.2);
    pair(g, fang, shade(c, 0.2), { tint: 0.5, lw: 1.3, blur: 5, sheen: 0, y0: -4, y1: 9 });
    pair(g, wing, c, { y0: -22, y1: 4, tint: 0.3, lw: 2.2, blur: 10, sx: 18, sy: -12, sr: 16 });
    // wing cannons
    barrel(g, 15, -6, 12, 2.4, c);
    barrel(g, -15, -6, 12, 2.4, c);
    part(g, poly(body), c, { y0: 29, y1: -24, lw: 2.5, blur: 11, sy: 8, sr: 22 });
    seamsM(g, [[10, -3, 30, -17], [12, -11, 24, -17.4], [9, -6, 9, -14], [3.6, 20, 6, 8], [5, -16, 8, -6]], c, 0.5);
    rivets(g, [[20, -10], [-20, -10], [26, -15], [-26, -15], [6, 0], [-6, 0]], c);
    vents(g, 0, -15, 6, 4, 3, c, 0.55);
    // targeting reticle and the cockpit up front
    glowStroke(g, c, 1.4, 5, (k) => k.arc(0, 2, 6.6, 0, TAU), 1, 0.7);
    seams(g, [[0, -6, 0, -1], [0, 5, 0, 10], [-8.6, 2, -3.4, 2], [3.4, 2, 8.6, 2]], c, 0.9, 0.7);
    lit(g, 0, 2, 1.8, '#fff', 8);
    canopy(g, 0, 17, 2.6, 4.4, c);
    for (const s of [-1, 1]) lit(g, s * 34, -21, 0.9, '#fff', 5);
    nozzle(g, -4.4, -23.2, 3.6, c, -1, 3);
    nozzle(g, 4.4, -23.2, 3.6, c, -1, 3);
  });

  S.eclipseDrone = mk(36, (g) => {
    const c = E.eclipsedrone;
    const p = poly([[0, 12], [9.6, -7], [4, -4.4], [0, -9], [-4, -4.4], [-9.6, -7]]);
    halo(g, c, p, 12, 0.3);
    part(g, p, c, { dark: 0.95, tint: 0.12, lw: 1.9, blur: 9, sheen: 0, y0: 12, y1: -9 });
    seams(g, [[0, -6, 0, 8], [-6, -5, -2, 2], [6, -5, 2, 2]], '#ff3df2', 0.5);
    lit(g, 0, 2, 2, '#ff3df2', 8);
  });
}
