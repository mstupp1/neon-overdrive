// Stage views: some zones of a node (and some boss arenas) are flown from a different camera. Top-down stays the
// main view; the others are:
//  - side:  a side-scroller. The jet always faces right, threats come in from the right, and neon terrain closes in
//           from above and below (touching it costs hull).
//  - chase: a pseudo-3D view from behind and above the jet. Threats come out of the distance toward the camera, and
//           laser gates rush in that you have to fly through the gaps of (threading one charges the ult).
//
// How it works: every fight system keeps running in its usual top-down frame ("virtual" playfield: forward = -y,
// enemies enter at the top), so patterns, bosses, modules and collisions need no changes. While a non-top view is
// live, world.js step() and the world render run with view.W / view.H swapped to the virtual playfield's size
// (push / pop). main.js renders that frame into an offscreen canvas and this module maps it onto the screen: rotated
// a quarter turn for the side view (virtual forward = screen right), or warped onto a receding floor plane in strips
// for the chase view (virtual top = the horizon). Pointer / key input and HUD positions are mapped back the other way.
// The view changes at the midpoint of a zone fly-through (director.js), behind a flash.

import { G, view } from './state.js';
import { clamp, rand } from '../core/math.js';
import { glow } from '../render/sprites.js';
import { bg } from '../render/background.js';
import { beat } from '../core/beat.js';
import { input } from '../core/input.js';
import { hurtPlayer, gainOverdrive, addScore } from './player.js';
import { phasing } from './pilot.js';
import { sparks, floatText, flash, addShake, ring } from './fx.js';
import { sfx } from '../core/audio.js';

export const VIEWS = {
  top: { id: 'top', name: 'TOP-DOWN', color: '#3ff6ff' },
  side: { id: 'side', name: 'SIDESCROLL', color: '#ffb13d' },
  chase: { id: 'chase', name: 'PURSUIT', color: '#3ff6ff' },
};
export const viewName = (id) => (VIEWS[id] ? VIEWS[id].name : '');


const SZ = 0.8; // side view zoom (screen units per virtual unit): a little smaller so the short axis has room
const CW = 450; // chase playfield width (virtual)
const CH = 1100; // chase playfield depth (virtual)
const CHASE_HOME = 150; // the jet's resting distance from the near edge (virtual)
const FOG = 260; // chase: virtual depth over which things fade in from the far edge
// Chase depth cues: ships fly at this height over the floor (in virtual units; screen lift = HOVER * local scale),
// so their lit shadows sit visibly below them and the floor reads as a ground plane rather than the play surface.
const HOVER = 24;

// Real (screen) metrics, saved while the view is swapped.
const R = { W: 450, H: 800, top: 0, bottom: 0 };
function real() {
  if (!sv.swapped) {
    R.W = view.W;
    R.H = view.H;
    R.top = view.safeTop;
    R.bottom = view.safeBottom;
  }
  return R;
}

// Chase projection (logical screen units). A virtual point at depth d = Yc - vy lands at
// x = W/2 + (vx - CW/2) * f / d, y = hy + A / d. Solved from the screen height so the jet sits at ~80% height at
// about natural size, seen from roughly 40 degrees above.
const P = { hy: 200, f: 500, A: 2e5, Yc: CH + 400, yFar: 360, H: 0 };
function chaseProj() {
  const r = real();
  if (P.H === r.H && P.top === r.top) return P;
  P.H = r.H;
  P.top = r.top;
  P.hy = r.top + r.H * 0.25; // horizon
  const yp = r.H * 0.8; // the jet's home row
  const sp = 0.95; // scale at the jet
  const rp = 0.85; // vertical squash at the jet
  const dp = (yp - P.hy) / (rp * sp);
  P.f = sp * dp;
  P.A = rp * dp * P.f;
  P.Yc = CH - CHASE_HOME + dp;
  P.yFar = P.hy + P.A / P.Yc;
  // The air plane (where ships fly): the same projection lifted by HOVER * scale, i.e. y = hy + (A - HOVER f) / d.
  P.Aair = P.A - HOVER * P.f;
  P.yFarAir = P.hy + P.Aair / P.Yc;
  return P;
}
// A virtual point on the chase floor (shadows, gates, lane furniture) → screen.
function floorPt(x, y, out = {}) {
  const Pp = chaseProj();
  const d = Math.max(30, Pp.Yc - y);
  const s = Pp.f / d;
  out.x = real().W / 2 + (x - CW / 2) * s;
  out.y = Pp.hy + Pp.A / d;
  out.s = s;
  return out;
}

const off = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const octx = off ? off.getContext('2d') : null;

// Side terrain: a low-poly ceiling and floor that scroll toward the jet. World coordinate c runs along the flight; a
// point at c sits at virtual y = S - c. Depths are measured in from the playfield edge (virtual x).
const SEG = 46;
const terrain = { S: 0, speed: 150, c0: 0, seed: 1, rnd: null, ceil: new Map(), floor: new Map(), calm: 0 };
function segDepth(map, i, salt) {
  let v = map.get(i);
  if (v === undefined) {
    // Hashed value noise, smoothed over neighbours so the walls read as ridges rather than spikes.
    const h = (n) => {
      const s = Math.sin((n + salt * 131.7 + terrain.seed * 0.37) * 12.9898) * 43758.5453;
      return s - Math.floor(s);
    };
    v = (h(i) * 0.5 + h(i - 1) * 0.25 + h(i + 1) * 0.25) * 0.75 + 0.25 * (0.5 + 0.5 * Math.sin(i * 0.31 + salt));
    map.set(i, v);
    if (map.size > 400) map.delete(map.keys().next().value);
  }
  return v;
}
// Depth of the ceiling / floor (virtual x units in from the top / bottom edge) at world coordinate c.
function wallDepth(c, top) {
  const r = real();
  const base = top ? (r.top + 34) / SZ : 12 / SZ;
  const amp = (top ? 150 : 140) / SZ;
  const ramp = clamp((c - terrain.c0) / 420, 0, 1) * (1 - terrain.calm);
  const i = Math.floor(c / SEG);
  const u = c / SEG - i;
  const map = top ? terrain.ceil : terrain.floor;
  const salt = top ? 1 : 2;
  const a = segDepth(map, i, salt);
  const b = segDepth(map, i + 1, salt);
  return base + amp * ramp * (a + (b - a) * u);
}

// Chase laser gates: walls across the lane with one gap, rushing at the camera.
const gates = [];
let gateT = 0;

export const sv = {
  mode: 'top',
  W: 450, // virtual playfield (valid for non-top views)
  H: 800,
  swapped: false,
  t: 0,
  intro: 0, // seconds since the view came in (entry effect)

  get active() {
    return this.mode !== 'top';
  },

  // Swap view.W / H (and the safe insets) to the virtual playfield. Returns true if it swapped.
  push() {
    if (this.mode === 'top' || this.swapped) return false;
    const r = real();
    if (this.mode === 'side') {
      this.W = r.H / SZ;
      this.H = r.W / SZ;
    } else {
      chaseProj();
      this.W = CW;
      this.H = CH;
    }
    this.swapped = true;
    view.W = this.W;
    view.H = this.H;
    view.safeTop = 0;
    view.safeBottom = 0;
    return true;
  },
  pop() {
    if (!this.swapped) return;
    this.swapped = false;
    view.W = R.W;
    view.H = R.H;
    view.safeTop = R.top;
    view.safeBottom = R.bottom;
  },

  // Change view now (mid fly-through, behind its flash). Works inside or outside a swapped step.
  enter(mode) {
    const was = this.swapped;
    this.pop();
    this.mode = VIEWS[mode] ? mode : 'top';
    this.t = 0;
    this.intro = 0;
    gates.length = 0;
    gateT = 2.6;
    terrain.ceil.clear();
    terrain.floor.clear();
    terrain.seed = Math.random() * 1000;
    terrain.S = 0;
    terrain.c0 = 0;
    terrain.calm = 0;
    this.push();
    const p = G.player;
    if (p) {
      const h = this.home();
      p.x = h.x;
      p.y = h.y;
      p.vx = 0;
      p.vy = 0;
      p.bank = 0;
      p.pitch = 0;
      if (p.ghosts) p.ghosts.length = 0;
      if (p.echoes) p.echoes.length = 0;
      if (p.auto) p.auto = { x: h.x, y: h.y };
      for (const pk of G.pickups) {
        pk.x = h.x;
        pk.y = h.y;
      }
    }
    // Everything still in flight belongs to the old frame.
    G.eBullets.length = 0;
    G.pBullets.length = 0;
    G.particles.length = 0;
    G.texts.length = 0;
    for (const b of G.beams) if (b.owner === 'enemy') b.dead = true;
    if (!was) this.pop();
    input.holdTarget();
  },
  reset() {
    if (this.mode === 'top' && !this.swapped) return;
    this.pop();
    this.mode = 'top';
    gates.length = 0;
  },

  // Where the jet rests in this view (current view dims; virtual when swapped).
  home() {
    const r = real();
    if (this.mode === 'side') return { x: this.W / 2, y: this.H - (r.W * 0.2) / SZ };
    if (this.mode === 'chase') return { x: CW / 2, y: CH - CHASE_HOME };
    return { x: view.W / 2, y: view.H * 0.78 };
  },

  // Player movement box (virtual units, called while swapped).
  bounds() {
    const r = real();
    if (this.mode === 'side') {
      return { left: (r.top + 80) / SZ, right: (r.H - r.bottom - 22) / SZ, top: this.H - (r.W * 0.56) / SZ, bottom: this.H - 20 / SZ };
    }
    return { left: 26, right: CW - 26, top: CH * 0.6, bottom: CH - 60 };
  },

  // Screen point the stage flows out of (boost streaks): the chase horizon; top-down / side have none (null).
  vanish() {
    if (this.mode !== 'chase') return null;
    return { x: real().W / 2, y: chaseProj().hy };
  },

  // Virtual → screen (logical). Also returns the local scale s (chase depth).
  toScreen(x, y, out = {}) {
    if (this.mode === 'side') {
      const r = real();
      out.x = r.W - y * SZ;
      out.y = x * SZ;
      out.s = SZ;
    } else if (this.mode === 'chase') {
      const r = real();
      const Pp = chaseProj();
      const d = Math.max(30, Pp.Yc - y);
      const s = Pp.f / d;
      out.x = r.W / 2 + (x - CW / 2) * s;
      out.y = Pp.hy + Pp.Aair / d; // where ships are drawn (the air plane, above their shadows)
      out.s = s;
    } else {
      out.x = x;
      out.y = y;
      out.s = 1;
    }
    return out;
  },
  // Screen (logical) → virtual.
  toVirtual(x, y, out = {}) {
    if (this.mode === 'side') {
      const r = real();
      out.x = y / SZ;
      out.y = (r.W - x) / SZ;
    } else if (this.mode === 'chase') {
      const r = real();
      const Pp = chaseProj();
      const d = Pp.Aair / Math.max(4, y - Pp.hy);
      out.x = CW / 2 + ((x - r.W / 2) * d) / Pp.f;
      out.y = Pp.Yc - d;
    } else {
      out.x = x;
      out.y = y;
    }
    return out;
  },

  // Human control (player.js): keys / stick are screen directions, pointer targets are screen points.
  mapControl(c) {
    if (this.mode === 'top') return c;
    if (this.mode === 'side') {
      const dx = c.dx;
      c.dx = c.dy;
      c.dy = -dx;
    }
    if (c.mode === 'target') {
      const v = this.toVirtual(c.tx, c.ty);
      c.tx = v.x;
      c.ty = v.y;
      const shift = c.shift;
      // Dash carry: a virtual move becomes the matching screen move of the pointer target.
      if (shift) {
        c.shift = (vx, vy) => {
          if (this.mode === 'side') shift(-vy * SZ, vx * SZ);
          else {
            const p = G.player;
            const a = this.toScreen(p.x - vx, p.y - vy);
            const b = this.toScreen(p.x, p.y);
            shift(b.x - a.x, b.y - a.y);
          }
        };
      }
    }
    return c;
  },

  // --- Per-step hazards (inside the swapped step, after the player moved) ---------------------------------------
  update(dt) {
    if (this.mode === 'top') return;
    this.t += dt;
    this.intro += dt;
    const p = G.player;
    const d = G.director;
    const fighting = d && (d.state === 'waves' || d.state === 'boss' || d.state === 'warn');
    if (this.mode === 'side') {
      const et = dt * G.enemyTimeScale;
      terrain.S += terrain.speed * et;
      // The walls settle flat for fly-throughs and node ends, and stay low for boss fights.
      const want = !fighting && d && d.state !== 'intro' ? 1 : d && (d.state === 'boss' || d.state === 'warn') ? 0.45 : 0;
      terrain.calm += (want - terrain.calm) * Math.min(1, dt * 1.2);
      if (p && !p.dead) sideWalls(p);
    } else if (this.mode === 'chase') {
      const et = dt * G.enemyTimeScale;
      if (d && d.state === 'waves' && !d.noGates) {
        gateT -= et;
        if (gateT <= 0) {
          spawnGate();
          gateT = rand(4.4, 5.8);
        }
      }
      for (const g of gates) {
        g.y += g.sp * et;
        if (!g.done && p && !p.dead && g.y >= p.y) {
          g.done = true;
          passGate(g, p);
        }
      }
      let w = 0;
      for (const g of gates) if (g.y < CH + 80) gates[w++] = g;
      gates.length = w;
    }
  },

  // Boss attacks (bosses.js): a gate with its gap at gx (virtual), width gw.
  gate(gx, gw = 130, sp = 300) {
    const gl = Math.max(gw / 2 + 20, Math.min(CW - gw / 2 - 20, gx));
    gates.push({ y: -20, gx: gl, gw, sp, done: false, t: 0 });
  },
  gateCount() {
    return gates.length;
  },

  // Autopilot (bot.js): a steering nudge {x, y} for this view's hazards, or null.
  botHint(p) {
    if (this.mode === 'chase') {
      let g = null;
      for (const o of gates) if (!o.done && o.y > p.y - 520 && (!g || o.y > g.y)) g = o;
      if (!g) return null;
      const urgency = clamp(1 - (p.y - g.y) / 520, 0.3, 1);
      return { x: clamp((g.gx - p.x) * 0.03, -2, 2) * urgency, y: 0 };
    }
    if (this.mode === 'side') {
      const c = terrain.S - p.y;
      const top = wallDepth(c, true);
      const bot = this.W - wallDepth(c, false);
      let x = 0;
      if (p.x < top + 70) x += (top + 70 - p.x) * 0.04;
      if (p.x > bot - 70) x -= (p.x - (bot - 70)) * 0.04;
      return x ? { x, y: 0 } : null;
    }
    return null;
  },

  // --- Rendering -------------------------------------------------------------------------------------------------

  // Draw the world for this view. main.js passes renderWorld and the shake offset; cam is cine.camera() read inside
  // the virtual frame by the caller (getCam).
  render(ctx, k, renderWorld, getCam) {
    const r = real();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (this.mode === 'side') {
      drawSideBack(ctx, r);
      drawSideGlow(ctx, r);
    }
    else drawChaseBack(ctx, r);
    const shakeX = view.ox || 0;
    const shakeY = view.oy || 0;
    this.push();
    const cam = getCam();
    const kk = k * (this.mode === 'side' ? SZ : 1.15);
    const w = Math.round(this.W * kk);
    const h = Math.round(this.H * kk);
    if (off.width !== w || off.height !== h) {
      off.width = w;
      off.height = h;
    } else {
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.clearRect(0, 0, w, h);
    }
    const z = cam ? cam.z : 1;
    view.ox = cam ? cam.x * kk : 0;
    view.oy = cam ? cam.y * kk : 0;
    octx.setTransform(kk * z, 0, 0, kk * z, view.ox, view.oy);
    renderWorld(octx, kk * z);
    view.ox = shakeX;
    view.oy = shakeY;
    this.pop();
    if (this.mode === 'side') {
      // Quarter turn: virtual (u, v) device px → screen (W*k - v + shake, u + shake).
      ctx.setTransform(0, 1, -1, 0, r.W * k + shakeX, shakeY);
      ctx.drawImage(off, 0, 0);
    } else {
      // Depth cues before the ships: lane pylons standing up off the floor, then each ship's shadow and the light it
      // casts on the floor. The world itself is laid on the air plane, lifted above those shadows.
      ctx.setTransform(k, 0, 0, k, shakeX, shakeY);
      drawPylons(ctx, r);
      drawShadows(ctx);
      drawChaseFloor(ctx, k, kk, r, shakeX, shakeY);
      ctx.setTransform(k, 0, 0, k, shakeX, shakeY);
      drawHaze(ctx, r);
    }
    ctx.setTransform(k, 0, 0, k, shakeX, shakeY);
    if (this.mode === 'chase') drawGates(ctx, r);
    // Entry flourish: a bright frame wipe as the new camera settles.
    if (this.intro < 0.8) {
      const a = 1 - this.intro / 0.8;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = VIEWS[this.mode].color;
      ctx.globalAlpha = 0.5 * a;
      ctx.lineWidth = 2;
      const m = 10 + (1 - a) * 30;
      ctx.strokeRect(m, m + r.top, r.W - 2 * m, r.H - 2 * m - r.top - r.bottom);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  },

  // In the virtual frame (renderWorld, after the backdrop): the side view's walls.
  drawWorld(ctx) {
    if (this.mode === 'side') drawWalls(ctx);
  },
};

// --- Side view -----------------------------------------------------------------------------------------------------

function sideWalls(p) {
  const c = terrain.S - p.y;
  const top = wallDepth(c, true);
  const bot = sv.W - wallDepth(c, false);
  const pad = p.r * 0.7;
  let hit = false;
  if (p.x - pad < top) {
    p.x = top + pad + 1;
    p.vx = Math.max(p.vx, 160);
    hit = true;
  } else if (p.x + pad > bot) {
    p.x = bot - pad - 1;
    p.vx = Math.min(p.vx, -160);
    hit = true;
  }
  if (hit && p.iframes <= 0 && p.dashT <= 0 && !phasing(p)) {
    sparks(p.x, p.y, '#ffb13d', 10, 260);
    hurtPlayer(p);
  }
}

function drawWalls(ctx) {
  const h = Math.round(bg.hue);
  const col = `hsl(${(h + 30) % 360},100%,62%)`;
  const W = sv.W;
  const H = sv.H;
  const step = SEG / 2;
  const y0 = -40;
  const y1 = H + 40;
  // Vanishing point (virtual): screen (W/2, 0.7H), where drawSideBack puts the horizon.
  const r = real();
  const vpx = (r.H * 0.7) / SZ;
  const vpy = (r.W * 0.5) / SZ;
  const DEPTH = 0.085;
  for (const top of [true, false]) {
    const pts = [];
    for (let y = y0; y <= y1 + step; y += step) {
      const c = terrain.S - y;
      const dpt = wallDepth(c, top);
      pts.push(top ? dpt : W - dpt, y);
    }
    const edge = top ? -20 : W + 20;
    // Solid depth: the rock's far rim, pulled toward the backdrop's vanishing point (the horizon, mid screen), and
    // the receding face between the two rims (the ceiling's underside, the floor's top). As the terrain scrolls past,
    // the face swings like a real extruded shape.
    const back = [];
    for (let i = 0; i < pts.length; i += 2) back.push(pts[i] + (vpx - pts[i]) * DEPTH, pts[i + 1] + (vpy - pts[i + 1]) * DEPTH);
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, pts[i], pts[i + 1]);
    for (let i = back.length - 2; i >= 0; i -= 2) ctx.lineTo(back[i], back[i + 1]);
    ctx.closePath();
    ctx.fillStyle = `hsla(${(h + 20) % 360},60%,15%,0.92)`;
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      ctx.moveTo(pts[i], pts[i + 1]);
      ctx.lineTo(back[i], back[i + 1]);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    for (let i = 0; i < back.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, back[i], back[i + 1]);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // Dark rock body
    ctx.beginPath();
    ctx.moveTo(edge, y0);
    for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.lineTo(edge, pts[pts.length - 1]);
    ctx.closePath();
    ctx.fillStyle = `hsla(${h},60%,6%,0.92)`;
    ctx.fill();
    // Inner strata: a second rim set back into the rock
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i] + (top ? -18 : 18);
      if (i === 0) ctx.moveTo(x, pts[i + 1]);
      else ctx.lineTo(x, pts[i + 1]);
    }
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Glowing rim
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      if (i === 0) ctx.moveTo(pts[i], pts[i + 1]);
      else ctx.lineTo(pts[i], pts[i + 1]);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 + beat.pulse * 0.1;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Vertex studs
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < pts.length; i += 4) ctx.fillRect(pts[i] - 1.5, pts[i + 1] - 1.5, 3, 3);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}

// Screen-space backdrop for the side view: sky, skyline, a floor grid running into depth, stars streaking left.
function drawSideBack(ctx, r) {
  const W = r.W;
  const H = r.H;
  const h = Math.round(bg.hue);
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, `hsl(${h},55%,5%)`);
  grd.addColorStop(0.6, `hsl(${(h + 25) % 360},60%,8%)`);
  grd.addColorStop(1, `hsl(${(h + 40) % 360},70%,11%)`);
  ctx.fillStyle = grd;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  const sc = bg.scroll * 140; // backdrop scroll (logical px)
  ctx.globalCompositeOperation = 'lighter';
  // Nebula drifting left
  for (const n of bg.nebula) {
    const nh = (Math.round((h + n.h) / 10) * 10 + 360) % 360;
    const s = glow(`hsl(${nh},90%,45%)`, 128);
    const rr = n.r * W * 1.2;
    const x = ((((n.y * W * 1.6 - sc * 0.05) % (W * 1.6)) + W * 1.6) % (W * 1.6)) - W * 0.3;
    const y = n.x * H;
    ctx.globalAlpha = 0.14;
    ctx.drawImage(s.img, x - rr, y - rr, rr * 2, rr * 2);
  }
  // Stars streaking right-to-left
  ctx.fillStyle = `hsl(${(h + 20) % 360},60%,82%)`;
  const streak = Math.min(70, Math.max(0, bg.boost - 1.2) * 14);
  for (const s of bg.stars) {
    ctx.globalAlpha = s.a;
    const len = s.size + streak * (s.speed / 110);
    ctx.fillRect((1 - s.y) * W, s.x * H, len, s.size);
  }
  // Far skyline (two parallax ridges)
  const hor = H * 0.7;
  for (const [k, amp, a, sp] of [[0.004, 70, 0.22, 0.12], [0.009, 40, 0.35, 0.3]]) {
    ctx.beginPath();
    for (let x = -10; x <= W + 10; x += 10) {
      const u = x + sc * sp;
      const y = hor - amp * (0.5 + 0.3 * Math.sin(u * k) + 0.2 * Math.sin(u * k * 2.7 + 1.3));
      if (x === -10) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `hsl(${(h + 15) % 360},100%,60%)`;
    ctx.globalAlpha = a;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  // Horizon glow and a floor grid below it (lines run into depth and slide left)
  const hg = glow(`hsl(${Math.round(h / 10) * 10},100%,60%)`, 64);
  ctx.globalAlpha = 0.22 + beat.pulse * 0.1;
  ctx.drawImage(hg.img, -W * 0.2, hor - 26, W * 1.4, 52);
  ctx.strokeStyle = `hsl(${h},100%,62%)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const depth = H - hor;
  for (let i = 1; i < 9; i++) {
    const f = i / 9;
    const y = hor + depth * f * f;
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.globalAlpha = 0.1 + beat.pulse * 0.05;
  ctx.stroke();
  ctx.beginPath();
  const gap = 60;
  const ph = (sc * 1.4) % gap;
  for (let x = -W; x <= W * 2; x += gap) {
    const bx = x - ph;
    const vx = W / 2 + (bx - W / 2) * 0.12;
    ctx.moveTo(vx, hor);
    ctx.lineTo(bx, H);
  }
  ctx.globalAlpha = 0.1;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (bg.dark > 0.01) {
    ctx.globalAlpha = 0.74 * bg.dark;
    ctx.fillStyle = '#000';
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.globalAlpha = 1;
  }
}

// Each ship's light thrown down onto the backdrop's floor grid below it: brighter and tighter the lower it flies,
// so ships read as hanging in front of the scenery instead of being painted on it. (Projectiles get none.)
function drawSideGlow(ctx, r) {
  const hor = r.H * 0.7;
  const fy = hor + (r.H - hor) * 0.3;
  const q = {};
  ctx.globalCompositeOperation = 'lighter';
  const one = (x, y, rad, color, w) => {
    sv.toScreen(x, y, q);
    if (q.x < -60 || q.x > r.W + 60) return;
    const near = clamp(q.y / fy, 0, 1); // 0 at the top of the screen, 1 down at the floor
    const rx = rad * SZ * (2.6 - near);
    ctx.globalAlpha = 0.1 + 0.28 * near * near * w;
    const g = glow(color, 64);
    ctx.drawImage(g.img, q.x - rx * 1.6, fy - rx * 0.3, rx * 3.2, rx * 0.6);
  };
  for (const e of G.enemies) if (!e.dead && e.r) one(e.x, e.y, Math.min(e.r, 120), e.color || '#ff3d7a', e.r > 40 ? 0.7 : 1);
  const p = G.player;
  if (p && !p.dead) one(p.x, p.y, Math.max(16, p.r * 1.6), p.color || '#3ff6ff', 1.2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// --- Chase view ----------------------------------------------------------------------------------------------------

function spawnGate() {
  const p = G.player;
  // Keep the gap reachable: within a comfortable swing of where the jet is.
  const gx = clamp((p ? p.x : CW / 2) + rand(-170, 170), 90, CW - 90);
  sv.gate(gx, rand(120, 150), 290);
}

function passGate(g, p) {
  const inGap = Math.abs(p.x - g.gx) < g.gw / 2 - p.r * 0.4;
  if (inGap) {
    // Threading the needle: a little meter and score, like a graze.
    gainOverdrive(4 * (p.st.grazeOd || 1));
    addScore(200);
    floatText(p.x, p.y - 34, 'THREADED', '#3ff6ff', 11, 0.8);
    ring(p.x, p.y, 40, '#3ff6ff', 0.3);
    sfx.graze();
    return;
  }
  g.hit = true;
  if (p.iframes > 0 || p.dashT > 0 || phasing(p)) return;
  sparks(p.x, p.y, '#ff3d7a', 14, 300);
  flash('255,61,122', 0.25);
  addShake(0.3);
  hurtPlayer(p);
}

function drawChaseBack(ctx, r) {
  const W = r.W;
  const H = r.H;
  const Pp = chaseProj();
  const h = Math.round(bg.hue);
  const hy = Pp.hy;
  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, hy);
  sky.addColorStop(0, `hsl(${h},55%,4%)`);
  sky.addColorStop(1, `hsl(${(h + 30) % 360},70%,12%)`);
  ctx.fillStyle = sky;
  ctx.fillRect(-20, -20, W + 40, hy + 21);
  // Floor
  const fl = ctx.createLinearGradient(0, hy, 0, H);
  fl.addColorStop(0, `hsl(${(h + 30) % 360},70%,10%)`);
  fl.addColorStop(1, `hsl(${(h + 40) % 360},60%,5%)`);
  ctx.fillStyle = fl;
  ctx.fillRect(-20, hy, W + 40, H - hy + 20);
  ctx.globalCompositeOperation = 'lighter';
  // Stars above the horizon drifting outward from the vanishing point
  ctx.fillStyle = `hsl(${(h + 20) % 360},60%,82%)`;
  for (const s of bg.stars) {
    const x = W / 2 + (s.x - 0.5) * W * (0.6 + s.y * 0.9);
    const y = hy - (1 - s.y) * hy * 0.95;
    if (y < r.top) continue;
    ctx.globalAlpha = s.a * (0.4 + s.y * 0.6);
    ctx.fillRect(x, y, s.size, s.size);
  }
  // A core glow sitting on the horizon, the floor grid running into it
  const sun = glow(`hsl(${Math.round(((h + 330) % 360) / 10) * 10},100%,60%)`, 128);
  ctx.globalAlpha = 0.45 + beat.pulse * 0.15;
  ctx.drawImage(sun.img, W / 2 - 150, hy - 120, 300, 200);
  const hg = glow(`hsl(${Math.round(h / 10) * 10},100%,60%)`, 64);
  ctx.globalAlpha = 0.35 + beat.pulse * 0.12;
  ctx.drawImage(hg.img, -W * 0.3, hy - 24, W * 1.6, 48);
  ctx.strokeStyle = `hsl(${h},100%,62%)`;
  ctx.lineWidth = 1;
  // Cross lines at fixed world depths sliding toward the camera
  const gap = 90;
  const ph = (bg.scroll * 260) % gap;
  ctx.beginPath();
  for (let vy = -900 - gap; vy < CH + gap; vy += gap) {
    const y = vy + ph;
    const d = Pp.Yc - y;
    if (d < 40) continue;
    const sy = hy + Pp.A / d;
    if (sy > H + 2) continue;
    ctx.moveTo(-10, sy);
    ctx.lineTo(W + 10, sy);
  }
  ctx.globalAlpha = 0.16 + beat.pulse * 0.06;
  ctx.stroke();
  // Long lines converging on the vanishing point
  ctx.beginPath();
  for (let vx = -CW * 2; vx <= CW * 3; vx += 56) {
    const near = floorPt(vx, CH + 200);
    ctx.moveTo(W / 2, hy);
    ctx.lineTo(near.x, near.y);
  }
  ctx.globalAlpha = 0.12;
  ctx.stroke();
  // Lane edges: the playfield's sides, brighter
  ctx.beginPath();
  for (const vx of [0, CW]) {
    const a = floorPt(vx, 0);
    const b = floorPt(vx, CH + 200);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.strokeStyle = `hsl(${(h + 30) % 360},100%,66%)`;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.35 + beat.pulse * 0.15;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (bg.dark > 0.01) {
    ctx.globalAlpha = 0.74 * bg.dark;
    ctx.fillStyle = '#000';
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.globalAlpha = 1;
  }
}

// The virtual frame laid on the air plane (the floor projection lifted by HOVER), one thin screen row band at a
// time (far to near).
function drawChaseFloor(ctx, k, kk, r, sx, sy) {
  const Pp = chaseProj();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const H = r.H;
  const step = 2;
  const A = Pp.Aair;
  let y = Math.max(Pp.yFarAir, Pp.hy + 1);
  const srcW = CW * kk;
  while (y < H) {
    const y1 = Math.min(H, y + step);
    const d0 = A / (y - Pp.hy);
    const d1 = A / (y1 - Pp.hy);
    let v0 = Pp.Yc - d0;
    const v1 = Pp.Yc - d1;
    if (v1 > 0) {
      v0 = Math.max(0, v0);
      const s = Pp.f / ((d0 + d1) / 2);
      const dw = CW * s;
      const dx = r.W / 2 - dw / 2;
      // Fog: the far band fades in so things emerge from the distance instead of popping.
      const fog = clamp((v0 + 20) / FOG, 0, 1);
      if (fog > 0.01) {
        ctx.globalAlpha = fog;
        ctx.drawImage(off, 0, v0 * kk, srcW, Math.max(1, (v1 - v0) * kk), dx * k + sx, y * k + sy, dw * k, (y1 - y) * k + 0.75);
      }
    }
    y = y1;
  }
  ctx.globalAlpha = 1;
}

function drawGates(ctx, r) {
  if (!gates.length) return;
  const q = {};
  // Far first, so nearer walls overlap farther ones.
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i];
    if (g.y < -20) continue;
    const fog = clamp((g.y + 20) / FOG, 0, 1);
    floorPt(0, g.y, q);
    const s = q.s;
    const base = q.y;
    const hh = 58 * s;
    const xl = q.x;
    const xr = floorPt(CW, g.y).x;
    const ga = floorPt(g.gx - g.gw / 2, g.y).x;
    const gb = floorPt(g.gx + g.gw / 2, g.y).x;
    const col = g.hit ? '#ffffff' : '#ff3d7a';
    const passed = g.done ? clamp(1 - (g.y - G.player.y) / 120, 0, 1) : 1;
    const a = fog * passed;
    if (a <= 0.01) continue;
    // Translucent wall panels either side of the gap
    ctx.globalAlpha = 0.22 * a;
    ctx.fillStyle = col;
    ctx.fillRect(xl, base - hh, ga - xl, hh);
    ctx.fillRect(gb, base - hh, xr - gb, hh);
    // Scan bars
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 * a;
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.beginPath();
    for (const f of [0.33, 0.66]) {
      ctx.moveTo(xl, base - hh * f);
      ctx.lineTo(ga, base - hh * f);
      ctx.moveTo(gb, base - hh * f);
      ctx.lineTo(xr, base - hh * f);
    }
    ctx.stroke();
    // Bright top and base rails, and the gate posts
    ctx.globalAlpha = 0.95 * a;
    ctx.lineWidth = Math.max(1.2, 2.4 * s);
    ctx.beginPath();
    ctx.moveTo(xl, base - hh);
    ctx.lineTo(ga, base - hh);
    ctx.moveTo(gb, base - hh);
    ctx.lineTo(xr, base - hh);
    ctx.moveTo(xl, base);
    ctx.lineTo(ga, base);
    ctx.moveTo(gb, base);
    ctx.lineTo(xr, base);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.5, 3.5 * s);
    ctx.beginPath();
    ctx.moveTo(ga, base + 2 * s);
    ctx.lineTo(ga, base - hh * 1.25);
    ctx.moveTo(gb, base + 2 * s);
    ctx.lineTo(gb, base - hh * 1.25);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}

// Neon pylons along both lane edges: vertical billboards scrolling with the floor grid, so there is something with
// height in the scene to measure the ships' hover and speed against.
const PYLON_GAP = 180;
function drawPylons(ctx, r) {
  const h = Math.round(bg.hue);
  const col = `hsl(${(h + 30) % 360},100%,66%)`;
  const cap = glow(`hsl(${Math.round(((h + 30) % 360) / 10) * 10},100%,62%)`, 64);
  const ph = (bg.scroll * 260) % PYLON_GAP;
  const P0 = chaseProj();
  const q = {};
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = col;
  // Far to near, so near posts draw over far ones.
  for (let vy = -720; vy < CH + PYLON_GAP; vy += PYLON_GAP) {
    const y = vy + ph;
    if (P0.Yc - y < 60) continue;
    const a = clamp((y + 720) / 520, 0, 1) * (0.55 + beat.pulse * 0.2);
    if (a < 0.02) continue;
    for (const vx of [-34, CW + 34]) {
      floorPt(vx, y, q);
      if (q.y > r.H + 40) continue;
      const s = q.s;
      const top = q.y - 118 * s;
      ctx.globalAlpha = a * 0.35;
      ctx.lineWidth = Math.max(1, 6 * s);
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(q.x, top);
      ctx.stroke();
      ctx.globalAlpha = a;
      ctx.lineWidth = Math.max(0.8, 1.6 * s);
      ctx.stroke();
      // Cap light, and its pool on the floor
      const cs = 30 * s;
      ctx.globalAlpha = a * 0.9;
      ctx.drawImage(cap.img, q.x - cs / 2, top - cs / 2, cs, cs);
      ctx.globalAlpha = a * 0.35;
      ctx.drawImage(cap.img, q.x - cs, q.y - cs * 0.3, cs * 2, cs * 0.6);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// Under every ship: a dark core shadow and a pool of its own colour lit on the floor. With the ships lifted onto the
// air plane, the gap between a ship and its shadow is what sells the height. (Projectiles get none.)
function drawShadows(ctx) {
  const q = {};
  const one = (x, y, rad, color, w) => {
    if (y < -40) return;
    const fog = clamp((y + 20) / FOG, 0, 1);
    if (fog < 0.02) return;
    floorPt(x, y, q);
    const s = q.s;
    const rx = rad * s * 1.15;
    const ry = rx * 0.42;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3 * fog * w;
    const g = glow(color, 64);
    ctx.drawImage(g.img, q.x - rx * 2.4, q.y - ry * 2.4, rx * 4.8, ry * 4.8);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.6 * fog;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(q.x, q.y, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const e of G.enemies) {
    if (e.dead || !e.r) continue;
    one(e.x, e.y, Math.min(e.r, 120), e.color || '#ff3d7a', e.r > 40 ? 0.7 : 1);
  }
  const p = G.player;
  if (p && !p.dead) one(p.x, p.y, Math.max(16, p.r * 1.6), p.color || '#3ff6ff', 1.2);
  ctx.globalAlpha = 1;
}

// Aerial perspective: a horizon-coloured haze over the far rows, so distant ships sink into the glow.
function drawHaze(ctx, r) {
  const P0 = chaseProj();
  const h = Math.round(bg.hue);
  const y1 = P0.hy + (r.H * 0.8 - P0.hy) * 0.42;
  const grd = ctx.createLinearGradient(0, P0.hy, 0, y1);
  grd.addColorStop(0, `hsla(${(h + 30) % 360},70%,12%,0.55)`);
  grd.addColorStop(1, `hsla(${(h + 30) % 360},70%,12%,0)`);
  ctx.fillStyle = grd;
  ctx.fillRect(-20, P0.hy, r.W + 40, y1 - P0.hy);
}
