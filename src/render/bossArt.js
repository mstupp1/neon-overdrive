// Boss illustrations. The static bodies are baked once per colour (with a white hit-flash copy) and the bosses.js
// draw functions layer the moving pieces on top: Warden's legs, turrets and reactor, Hydra's tentacles and eye,
// Omega's rotating rings, nodes and tethers. Coordinates are logical units around the boss centre; the hitbox
// parts in bosses.js (`parts(e)`) are unchanged and the art is drawn to sit on them.

import { TAU } from '../core/math.js';
import { makeSprite, S } from './sprites.js';
import {
  poly, mirror, flipX, regular, part, halo, seams, seamsM, vents, rivets, lit, nozzle, barrel, canopy, dashRing,
  glowStroke, shade, rgba,
} from './ink.js';

const cache = new Map();
function cached(key, build) {
  let s = cache.get(key);
  if (!s) cache.set(key, (s = build()));
  return s;
}

function pair(g, half, color, o = {}) {
  part(g, poly(half), color, o);
  part(g, poly(flipX(half)), color, { ...o, sx: -(o.sx ?? -6) });
}

// --- WARDEN: siege mech. Hull r42 at the centre, missile pods (r20) at ±62, 4; it faces down at the player. ------

export function wardenBody(c) {
  return cached('warden' + c, () => makeSprite(230, (g) => {
    const hull = mirror([[0, -48], [20, -48], [40, -40], [54, -18], [54, 6], [42, 34], [26, 46], [0, 50]]);
    const plate = mirror([[0, -36], [16, -36], [30, -30], [40, -14], [40, 4], [30, 26], [18, 34], [0, 37]]);
    const claw = [[14, 40], [30, 50], [38, 70], [33, 84], [27, 74], [26, 62], [12, 54]];
    const pod = [[46, -24], [74, -24], [80, -16], [80, 30], [74, 36], [46, 36], [42, 28], [42, -16]];
    halo(g, c, (k) => { poly(hull)(k); poly(mirror(pod))(k); }, 26, 0.16);
    // siege claws (behind the hull), serrated inner edge
    pair(g, claw, c, { y0: 40, y1: 84, tint: 0.34, lw: 2.2, blur: 10, sheen: 0.15 });
    seamsM(g, [[20, 52, 26, 50], [24, 58, 28, 56], [27, 64, 31, 63], [29, 52, 34, 70]], c, 0.6, 0.8);
    lit(g, 33, 82, 1.4, '#fff', 8);
    lit(g, -33, 82, 1.4, '#fff', 8);
    // hull
    part(g, poly(hull), c, { y0: -48, y1: 50, tint: 0.3, lw: 3, blur: 14, sx: -14, sy: -24, sr: 60 });
    part(g, poly(plate), c, { y0: -36, y1: 37, tint: 0.2, dark: 0.35, lw: 1.4, blur: 5, passes: 1, core: 0.4, sheen: 0 });
    // spine armour plates down the centre
    for (const y of [-42, -32, 28, 36]) part(g, poly([[-9, y - 3.6], [9, y - 3.6], [7, y + 3.6], [-7, y + 3.6]]), c, { tint: 0.45, lw: 1, blur: 3, passes: 1, sheen: 0, y0: y - 4, y1: y + 4 });
    seams(g, [[-40, -14, -26, -6], [40, -14, 26, -6], [-30, 26, -22, 16], [30, 26, 22, 16], [-54, 6, -40, 4], [54, 6, 40, 4]], c, 0.55, 0.9);
    rivets(g, [[-34, -34], [34, -34], [-48, -14], [48, -14], [-48, 2], [48, 2], [-36, 30], [36, 30], [-20, 42], [20, 42], [-14, -44], [14, -44]], c, 1);
    // rear exhaust stacks
    vents(g, -24, -40, 12, 6, 4, c, 0.6);
    vents(g, 24, -40, 12, 6, 4, c, 0.6);
    // hazard chevrons over the reactor housing
    seams(g, (k) => { for (const y of [18, 23]) { k.moveTo(-10, y + 4); k.lineTo(0, y); k.lineTo(10, y + 4); } }, c, 0.8, 1.2);
    // reactor housing ring (the glowing core is drawn per frame)
    part(g, (k) => k.arc(0, 0, 16, 0, TAU), c, { y0: -16, y1: 16, tint: 0.2, dark: 0.85, lw: 2, blur: 8, sheen: 0 });
    seams(g, (k) => { for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; k.moveTo(Math.cos(a) * 16, Math.sin(a) * 16); k.lineTo(Math.cos(a) * 20, Math.sin(a) * 20); } }, c, 0.7, 1);
    // turret rings
    for (const s of [-1, 1]) part(g, (k) => k.arc(s * 36, -16, 10, 0, TAU), c, { tint: 0.2, dark: 0.9, lw: 1.4, blur: 5, passes: 1, sheen: 0, y0: -26, y1: -6 });
    // missile pods: armoured boxes with a 2 x 3 rack of lit tubes
    pair(g, pod, c, { y0: -24, y1: 36, tint: 0.32, lw: 2.4, blur: 10, sx: 56, sy: -16, sr: 30 });
    for (const s of [-1, 1]) {
      for (let r = 0; r < 3; r++) {
        for (let q = 0; q < 2; q++) {
          const x = s * (55 + q * 14);
          const y = -12 + r * 13;
          part(g, (k) => k.arc(x, y, 4.6, 0, TAU), c, { tint: 0.1, dark: 0.95, lw: 1, blur: 3, passes: 1, sheen: 0, y0: y - 5, y1: y + 5 });
          lit(g, x, y, 1.6, shade(c, 0.3), 5);
        }
      }
      vents(g, s * 62, 30, 24, 3, 3, c, 0.6);
      rivets(g, [[s * 46, -20], [s * 78, -20], [s * 46, 32], [s * 78, 32]], c, 0.9);
    }
  }, true));
}

// Four walker legs, stepping in diagonal pairs (drawn per frame behind the hull).
export function wardenLegs(ctx, x, y, c, t, moving) {
  const hips = [[-34, -30, -1, -1], [34, -30, 1, -1], [-36, 22, -1, 1], [36, 22, 1, 1]];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < 4; i++) {
    const [hx, hy, sx, sy] = hips[i];
    const ph = t * (moving ? 5 : 2.4) + (i === 0 || i === 3 ? 0 : Math.PI);
    const lift = Math.max(0, Math.sin(ph));
    const fx = x + hx + sx * (40 - lift * 6);
    const fy = y + hy + sy * 26 + Math.cos(ph) * 8;
    const kx = x + hx + sx * (30 + lift * 6);
    const ky = y + hy + sy * 2 - lift * 4;
    const leg = () => {
      ctx.beginPath();
      ctx.moveTo(x + hx, y + hy);
      ctx.lineTo(kx, ky);
      ctx.lineTo(fx, fy);
    };
    leg();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = c;
    ctx.lineWidth = 15;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.strokeStyle = '#12070b';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = rgba(c, 0.6);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.6;
    // knee joint + foot claw
    ctx.fillStyle = '#12070b';
    ctx.beginPath(); ctx.arc(kx, ky, 4.4, 0, TAU); ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fx - 5, fy + sy * 4); ctx.lineTo(fx, fy); ctx.lineTo(fx + 5, fy + sy * 4);
    ctx.stroke();
  }
}

// --- HYDRA: bio-leviathan. Body r48, six tentacles with r12 tip pods (drawn per frame). ------------------------------

export function hydraBody() {
  return cached('hydra', () => makeSprite(250, (g) => {
    const G = '#6dff4d';
    const P = '#c04dff';
    const Y = '#ffe14d';
    // crown of spines behind the head
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + 0.25 + (i / 8) * (Math.PI - 0.5);
      const r0 = 46;
      const r1 = 66 + (i % 2 ? 0 : 10) - Math.abs(i - 4) * 2;
      const w = 0.12;
      const sp = poly([[Math.cos(a - w) * r0, Math.sin(a - w) * r0 * 1.1], [Math.cos(a) * r1, Math.sin(a) * r1 * 1.1 - 4], [Math.cos(a + w) * r0, Math.sin(a + w) * r0 * 1.1]]);
      part(g, sp, G, { tint: 0.35, lw: 1.4, blur: 5, passes: 1, sheen: 0, y0: -80, y1: -40 });
    }
    // horns: curved and ridged
    for (const s of [-1, 1]) {
      const horn = (k) => {
        k.moveTo(s * 28, -38);
        k.quadraticCurveTo(s * 60, -60, s * 62, -96);
        k.quadraticCurveTo(s * 44, -66, s * 12, -52);
        k.closePath();
      };
      part(g, horn, Y, { tint: 0.34, lw: 2, blur: 8, sheen: 0.2, y0: -96, y1: -38, sx: s * 40, sy: -60, sr: 30 });
      seams(g, (k) => { for (let i = 1; i < 6; i++) { const t = i / 6; const x = s * (20 + t * 40); const y = -46 - t * 44; k.moveTo(x - s * 5, y + 4); k.lineTo(x + s * 4, y - 2); } }, Y, 0.6, 0.9);
    }
    const body = (k) => {
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * TAU;
        const wob = 1 + Math.sin(a * 7) * 0.025 + Math.sin(a * 3 + 0.7) * 0.02;
        const x = Math.cos(a) * 48 * wob;
        const y = Math.sin(a) * 58 * wob;
        if (i) k.lineTo(x, y); else k.moveTo(x, y);
      }
      k.closePath();
    };
    halo(g, G, body, 28, 0.18);
    part(g, body, G, { y0: -58, y1: 58, tint: 0.26, lw: 2.8, blur: 13, sx: -16, sy: -20, sr: 50 });
    // armoured belly scales
    seams(g, (k) => {
      for (let r = 0; r < 5; r++) {
        const y = 10 + r * 9;
        const hw = 38 - r * 6;
        for (let x = -hw; x < hw - 1; x += 9) { k.moveTo(x, y); k.quadraticCurveTo(x + 4.5, y + 6, x + 9, y); }
      }
    }, G, 0.55, 0.9);
    // flank ribs
    seams(g, (k) => {
      for (let i = 0; i < 4; i++) {
        const y = -30 + i * 14;
        for (const s of [-1, 1]) { k.moveTo(s * 44, y); k.quadraticCurveTo(s * 34, y + 4, s * 30, y + 12); }
      }
    }, G, 0.5, 1);
    // bioluminescent spots
    for (const [x, y] of [[-38, -6], [38, -6], [-34, 14], [34, 14], [-26, 34], [26, 34], [-40, -24], [40, -24]]) lit(g, x, y, 1.3, '#7dffe0', 6);
    // head plate (purple) with veins
    const head = (k) => k.ellipse(0, -14, 30, 34, 0, 0, TAU);
    part(g, head, P, { y0: -48, y1: 20, tint: 0.34, lw: 2, blur: 9, sx: -10, sy: -30, sr: 30 });
    seams(g, (k) => {
      k.moveTo(-26, -24); k.quadraticCurveTo(-16, -22, -14, -12);
      k.moveTo(26, -24); k.quadraticCurveTo(16, -22, 14, -12);
      k.moveTo(-20, 4); k.quadraticCurveTo(-12, 0, -12, -4);
      k.moveTo(20, 4); k.quadraticCurveTo(12, 0, 12, -4);
      k.moveTo(0, -46); k.lineTo(0, -26);
    }, P, 0.65, 1);
    // maw under the eye: jagged teeth and a violet throat
    const maw = (k) => { k.moveTo(-16, 20); k.quadraticCurveTo(0, 12, 16, 20); k.quadraticCurveTo(0, 38, -16, 20); k.closePath(); };
    g.save();
    g.fillStyle = 'rgba(8,0,14,0.95)';
    g.beginPath(); maw(g); g.fill();
    const tg = g.createRadialGradient(0, 24, 0, 0, 24, 12);
    tg.addColorStop(0, rgba(P, 0.8));
    tg.addColorStop(1, rgba(P, 0));
    g.fillStyle = tg;
    g.fill();
    g.restore();
    glowStroke(g, G, 1.6, 6, maw, 1, 0.7);
    g.save();
    g.fillStyle = '#f4fff0';
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const x = -12 + i * 4.8;
      const yt = 16 + Math.abs(x) * 0.12;
      g.moveTo(x - 1.8, yt); g.lineTo(x, yt + 4.6); g.lineTo(x + 1.8, yt);
    }
    for (let i = 0; i < 5; i++) {
      const x = -9.6 + i * 4.8;
      const yb = 30 - Math.abs(x) * 0.3;
      g.moveTo(x - 1.6, yb); g.lineTo(x, yb - 4); g.lineTo(x + 1.6, yb);
    }
    g.fill();
    g.restore();
    // eye socket (pupil drawn per frame)
    g.save();
    g.fillStyle = '#000';
    g.beginPath(); g.ellipse(0, -8, 17, 12.6, 0, 0, TAU); g.fill();
    g.restore();
    glowStroke(g, Y, 1.6, 7, (k) => k.ellipse(0, -8, 17, 12.6, 0, 0, TAU), 1, 0.6);
    seams(g, (k) => { for (const s of [-1, 1]) { k.moveTo(s * 17, -8); k.lineTo(s * 24, -10); k.moveTo(s * 15, -2); k.lineTo(s * 21, 2); } }, Y, 0.6, 0.9);
  }, true));
}

// Tentacle tip pod: a petalled bulb (points up its own -y, rotated along the tentacle per frame).
export function hydraPod() {
  return cached('hydraPod', () => makeSprite(40, (g) => {
    const P = '#c04dff';
    for (let i = 0; i < 5; i++) {
      g.save();
      g.rotate(-0.9 + (i / 4) * 1.8);
      part(g, poly([[-2.4, 2], [0, -14], [2.4, 2]]), '#6dff4d', { tint: 0.4, lw: 1, blur: 3, passes: 1, sheen: 0, y0: -14, y1: 2 });
      g.restore();
    }
    part(g, (k) => k.ellipse(0, 2, 7, 8.4, 0, 0, TAU), P, { tint: 0.5, lw: 1.6, blur: 6, sx: -2, sy: -1, sr: 7, sheen: 0.35, y0: -6, y1: 10 });
    seams(g, (k) => { k.moveTo(-4, 4); k.quadraticCurveTo(0, 0, 4, 4); k.moveTo(-3, 8); k.quadraticCurveTo(0, 5, 3, 8); }, P, 0.6, 0.7);
    lit(g, 0, -1, 2, '#ff9cff', 8);
  }, true, 3));
}

// --- OMEGA: core intelligence. Core r38, six node pods (r11) orbiting at r66, shard ring at r96. ---------------------

export function omegaCore(c) {
  return cached('omegaCore' + c, () => makeSprite(120, (g) => {
    const oct = regular(8, 40, Math.PI / 8);
    halo(g, c, poly(oct), 22, 0.2);
    part(g, poly(oct), c, { y0: -40, y1: 40, tint: 0.24, lw: 2.8, blur: 12, sx: -14, sy: -14, sr: 40 });
    seams(g, (k) => poly(regular(8, 33, Math.PI / 8))(k), c, 0.6, 0.9);
    // circuit traces from each facet into the iris, ending in pads
    seams(g, (k) => {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const b = a + 0.22;
        k.moveTo(Math.cos(a) * 33, Math.sin(a) * 33);
        k.lineTo(Math.cos(a) * 27, Math.sin(a) * 27);
        k.lineTo(Math.cos(b) * 23, Math.sin(b) * 23);
      }
    }, c, 0.7, 0.8);
    rivets(g, regular(8, 23, 0.22), c, 1.1, 0.9);
    rivets(g, regular(8, 36.4, 0), c, 0.8, 0.7);
    // iris: eight shutter blades round a dark lens
    for (let i = 0; i < 8; i++) {
      g.save();
      g.rotate((i / 8) * TAU);
      part(g, poly([[-6.6, -20], [6.6, -20], [5, -12.6], [-3, -12.6]]), c, { tint: 0.45, lw: 1, blur: 3, passes: 1, sheen: 0, y0: -20, y1: -12 });
      g.restore();
    }
    g.save();
    g.fillStyle = 'rgba(1,4,10,0.95)';
    g.beginPath(); g.arc(0, 0, 12.6, 0, TAU); g.fill();
    g.restore();
    glowStroke(g, c, 1.4, 6, (k) => k.arc(0, 0, 12.6, 0, TAU), 1, 0.7);
  }, true));
}

export function omegaRing(c) {
  return cached('omegaRing' + c, () => makeSprite(200, (g) => {
    glowStroke(g, c, 1.2, 6, (k) => k.arc(0, 0, 66, 0, TAU), 1, 0.25);
    dashRing(g, 58, c, [10, 4, 2, 4], 0.45, 1);
    dashRing(g, 74, c, [1.5, 5], 0.6, 1.4);
    seams(g, (k) => {
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * TAU;
        const r1 = i % 4 ? 68 : 71;
        k.moveTo(Math.cos(a) * 64, Math.sin(a) * 64);
        k.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      }
    }, c, 0.5, 0.8);
  }));
}

export function omegaNode(c) {
  return cached('omegaNode' + c, () => makeSprite(36, (g) => {
    const hex = poly(regular(6, 11.4, 0));
    halo(g, c, hex, 10, 0.25);
    part(g, hex, c, { y0: -11, y1: 11, tint: 0.3, lw: 1.8, blur: 7, sr: 10 });
    seams(g, (k) => poly(regular(6, 7.4, 0))(k), c, 0.6, 0.7);
    glowStroke(g, '#ff3df2', 1, 4, poly(regular(3, 4.8, -Math.PI / 2)), 1, 0.6);
    lit(g, 0, 0, 1.4, '#fff', 5);
  }, true, 3));
}

export function omegaShard() {
  return cached('omegaShard', () => makeSprite(18, (g) => {
    const d = poly([[0, -6.4], [2.6, 0], [0, 6.4], [-2.6, 0]]);
    part(g, d, '#ff3df2', { tint: 0.7, lw: 1.1, blur: 6, passes: 1, sheen: 0.4, y0: -6, y1: 6, sx: -1, sy: -2, sr: 5 });
    lit(g, 0, 0, 0.7, '#fff', 3);
  }, false, 3));
}

// --- ECLIPSE: a black-hulled dark mirror of the VECTOR, nose down. Core r34, wing pods (r17) at ±52, -30. --------

export function buildEclipse() {
  S.eclipse = makeSprite(210, (g) => {
    const K = 4.2;
    const T = (pts) => pts.map(([x, y]) => [x * K, -y * K - 12]);
    const M = '#ff3df2';
    const V = '#c23bff';
    const body = T(mirror([[0, -23], [2.4, -18], [4.2, -10], [5.2, 2], [4.4, 12], [2.6, 15]]));
    const wing = T([[4.5, -4], [17, 7], [19.5, 11.5], [14, 12.5], [5, 9]]);
    const nac = T([[6, 3], [9, 1], [10.6, 4], [10.6, 14], [5.6, 14]]);
    const can = T([[4, -12], [8.5, -7], [8, -5.5], [4.4, -7]]);
    const dark = { dark: 0.97, tint: 0.14, sheen: 0.06 };
    g.save();
    g.shadowColor = V;
    g.shadowBlur = 30;
    g.fillStyle = '#06000d';
    g.beginPath(); poly(body)(g); poly(wing)(g); poly(flipX(wing))(g); g.fill();
    g.restore();
    pair(g, wing, M, { ...dark, y0: 0, y1: -70, lw: 3, blur: 16 });
    pair(g, can, V, { ...dark, lw: 1.6, blur: 6 });
    pair(g, nac, M, { ...dark, y0: -70, y1: 0, lw: 2, blur: 8 });
    part(g, poly(body), M, { ...dark, y0: 90, y1: -76, lw: 3.2, blur: 16, sx: 0, sy: 40, sr: 60 });
    // violet circuitry etched into the hull
    seams(g, (k) => {
      k.moveTo(0, 60); k.lineTo(0, 28);
      k.moveTo(0, -24); k.lineTo(0, -56);
      for (const s of [-1, 1]) {
        k.moveTo(s * 27, -12); k.lineTo(s * 66, -44); k.lineTo(s * 72, -44);
        k.moveTo(s * 38, -30); k.lineTo(s * 56, -46);
        k.moveTo(s * 14, 22); k.lineTo(s * 18, -6); k.lineTo(s * 12, -20);
        k.moveTo(s * 31, -26); k.lineTo(s * 31, -64);
      }
      k.moveTo(-14, -44); k.lineTo(14, -44);
      k.moveTo(-12, -32); k.lineTo(12, -32);
    }, V, 0.75, 1.2);
    // wing cannon pods (hit parts)
    for (const s of [-1, 1]) {
      part(g, (k) => k.arc(s * 52, -30, 11, 0, TAU), V, { dark: 0.95, tint: 0.25, lw: 2, blur: 9, sheen: 0, y0: -41, y1: -19 });
      lit(g, s * 52, -30, 3.4, M, 12);
      barrel(g, s * 52, -38, -20, 3.4, M);
      barrel(g, s * 66, -48, -36, 2.4, M);
    }
    // engines at the top (it flies nose down)
    for (const s of [-1, 1]) nozzle(g, s * 33.6, -68, 13, M, -1, 10);
    // dark core eye
    g.save();
    g.fillStyle = '#000';
    g.beginPath(); g.ellipse(0, -2, 11, 17, 0, 0, TAU); g.fill();
    g.restore();
    glowStroke(g, '#ffffff', 1.8, 8, (k) => k.ellipse(0, -2, 11, 17, 0, 0, TAU), 1);
    glowStroke(g, M, 1, 5, (k) => k.ellipse(0, -2, 15, 22, 0, 0, TAU), 1, 0.3);
    canopy(g, 0, 26, 8, 14, V);
  }, true);
}

export function prewarmBossArt() {
  buildEclipse();
  for (const c of ['#ff7a18', '#ff3b3b']) wardenBody(c);
  hydraBody();
  hydraPod();
  for (const c of ['#3ff6ff', '#ff3df2']) { omegaCore(c); omegaRing(c); omegaNode(c); }
  omegaShard();
}
