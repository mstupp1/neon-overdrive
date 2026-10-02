// Overworld: each star system's route as open space you fly around in (campaign only).
// The route graph (campaign.js generateRoute) is laid out bottom to top as beacons joined by lanes; flying into a lit
// beacon (a node reachable next) and holding there, or pressing confirm, starts it through main.js pickRouteNode.
// Between the rows sit enemy patrols (simple chase / shoot AI, paid in XP and credits) and one-shot sites: salvage,
// data caches, a repair beacon and a distress signal that opens an anomaly event. The camera follows the ship
// (top-down, zoomed out), and M / the MAP button lays the whole route over the screen while you keep flying.
// State lives on G.run.ow and survives the screens a node opens; a new route (next system) builds a fresh overworld.

import { G, view, sectorDifficulty } from './state.js';
import { input, readDirection } from '../core/input.js';
import { sfx } from '../core/audio.js';
import { S, glow } from '../render/sprites.js';
import { TAU, clamp, lerp, damp, dist2, turnToward, mulberry32, easeOutCubic } from '../core/math.js';
import { NODE_TYPES, REWARDS, reachableNodes, nodeLevel } from './campaign.js';
import { MODIFIERS } from './modifiers.js';
import { heatScale } from './core.js';
import { WEAPONS, weaponStreams } from './ships.js';
import { particle, sparks, flash, updateParticles, drawParticles } from './fx.js';
import { hurtPlayer, gainXp } from './player.js';
import { gainCredits } from './economy.js';
import { NODE_ICONS } from '../ui/meta.js';

const FONT = 'Orbitron, "Segoe UI", sans-serif';
const FONT2 = 'Rajdhani, "Segoe UI", sans-serif';

const WW = 1400; // world width
const ROW_GAP = 470; // world distance between route rows
const TOP = 380; // margin above the boss beacon
const BOTTOM = 560; // margin below row 0 (the ship starts in it)
const ZOOM = 0.8; // camera zoom (world units -> logical px)
const ZOOM_IN = 1.45; // camera zoom at the start of the entry ease
const EASE = 1.1; // seconds of entry ease
const ENGAGE_R = 52; // beacon trigger radius
const DWELL = 0.85; // seconds holding inside a beacon to engage it
const AGGRO = 300; // patrol wakes when the ship is this close to its centre
const LEASH = 820; // and gives up past this
const SPEED = 300; // cruise speed at st.speed 1

// Site kinds: one-shot pickups (touch) or engage sites (dwell, opens a screen).
const SITES = {
  signal: { name: 'DISTRESS SIGNAL', sub: 'UNKNOWN SOURCE · OPENS AN ANOMALY', color: '#b48bff', icon: 'anomaly', engage: true },
  repair: { name: 'REPAIR BEACON', sub: 'RESTORES 1 HULL', color: '#7dff6b', icon: 'dock' },
  wreck: { name: 'SALVAGE', sub: 'DRIFTING WRECK · CREDITS', color: '#ffd24a', icon: 'vault' },
  data: { name: 'DATA CACHE', sub: 'ENCRYPTED LOGS · XP', color: '#3ff6ff', icon: 'combat' },
};

// Patrol enemies (sprites from sprites.js). hp is scaled by the patrol's route level like a fight.
const FOES = {
  dart: { hp: 3, r: 12, speed: 175, xp: 2, spr: 'dart' },
  sniper: { hp: 11, r: 15, speed: 120, xp: 4, spr: 'sniper', range: 230, fire: 2.1 },
  spinner: { hp: 24, r: 20, speed: 55, xp: 6, spr: 'spinner', fire: 3.1 },
};

let ow = null; // current overworld (also G.run.ow)
let hooks = { engage() {}, signal() {}, levelUp() {}, dead() {} };
const icons = {}; // `${type}|${color}` -> Image

function icon(type, color) {
  const key = type + '|' + color;
  let img = icons[key];
  if (!img) {
    img = new Image();
    const src = NODE_ICONS[type].replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" `).replace('currentColor', color);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
    icons[key] = img;
  }
  return img;
}

const hue = () => (G.run && G.run.system ? G.run.system.hue : 200);
const hsl = (h, l = 60, a = 1) => `hsla(${h},100%,${l}%,${a})`;

// --- Build ------------------------------------------------------------------------------

function build(run) {
  const route = run.route;
  const sys = run.system;
  const rnd = mulberry32((route.seed ^ 0x5f3759df) >>> 0);
  const rows = route.rows.length; // includes the boss row
  const WH = TOP + (rows - 1) * ROW_GAP + BOTTOM;
  const rowY = (r) => WH - BOTTOM - r * ROW_GAP;
  const pos = {};
  for (const n of route.nodes) {
    pos[n.id] = n.type === 'boss'
      ? { x: WW / 2, y: rowY(n.row) }
      : { x: n.x * WW + (rnd() - 0.5) * 110, y: rowY(n.row) + (rnd() - 0.5) * 90 };
  }
  const start = { x: WW / 2, y: WH - BOTTOM + 300 };
  const taken = [start, ...Object.values(pos)];
  const free = (x, y, d) => taken.every((q) => dist2(x, y, q.x, q.y) > d * d);
  const place = (y0, y1, d) => {
    for (let k = 0; k < 16; k++) {
      const x = 170 + rnd() * (WW - 340);
      const y = y0 + rnd() * (y1 - y0);
      if (free(x, y, d)) return { x, y };
    }
    return null;
  };

  // Patrols: in the gaps between rows, more of them (and bigger) further up.
  const clusters = [];
  const foes = [];
  for (let r = 0; r < rows - 2; r++) {
    const n = (r === 0 ? 1 : rnd() < 0.7 ? 1 : 0) + (r >= 3 && rnd() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const at = place(rowY(r + 1) + 120, rowY(r) - 120, 190);
      if (!at) continue;
      taken.push(at);
      const level = nodeLevel(sys, r) + 0.5;
      const c = { id: clusters.length, x: at.x, y: at.y, level, aggro: false, cleared: false, size: 0 };
      clusters.push(c);
      const count = 3 + Math.floor(r / 3) + (rnd() < 0.5 ? 1 : 0);
      for (let k = 0; k < count; k++) {
        const w = [['dart', 5], ['sniper', r >= 1 ? 3 : 1], ['spinner', r >= 3 ? 2 : 0]];
        let x = rnd() * w.reduce((a, b) => a + b[1], 0);
        let type = 'dart';
        for (const [t, q] of w) if ((x -= q) <= 0 && q > 0) { type = t; break; }
        foes.push(makeFoe(type, c, k, count, rnd, run));
        c.size++;
      }
    }
  }

  // Sites: one signal and one repair beacon per system, plus salvage and data caches.
  const sites = [];
  for (const kind of ['signal', 'repair', 'wreck', 'wreck', 'data', 'data']) {
    const at = place(rowY(rows - 2) + 60, rowY(0) + 140, 170);
    if (!at) continue;
    taken.push(at);
    sites.push({ id: `ow-${kind}-${sites.length}`, kind, x: at.x, y: at.y, done: false, t: rnd() * 10 });
  }

  // Background dressing: a few nebula glows in the system's hue.
  const nebulae = [];
  for (let i = 0; i < 7; i++) nebulae.push({ x: rnd() * WW, y: rnd() * WH, s: 500 + rnd() * 600, h: hue() + (rnd() - 0.5) * 60, a: 0.07 + rnd() * 0.07 });

  return {
    seed: route.seed, W: WW, H: WH, pos, start, clusters, foes, sites, nebulae,
    ship: { x: start.x, y: start.y, vx: 0, vy: 0, a: 0, boostT: 0, boostCd: 0, fireT: 0, trailT: 0 },
    cam: { x: start.x, y: start.y - 160 },
    at: null, // the node the ship last returned from
    dest: null, // mouse destination (world)
    dwell: 0, dwellId: null,
    pb: [], eb: [], gems: [], texts: [],
    map: false, mapA: 0, ease: 0, t: 0, busy: false, levelT: 0, hintT: 0,
  };
}

function makeFoe(type, c, k, count, rnd, run) {
  const f = FOES[type];
  const hp = f.hp * sectorDifficulty(c.level, 0).hp * heatScale(run.tier || 0, run.deep || 0).hp * 0.6;
  const ph = (k / count) * TAU;
  return {
    type, c, hp, max: hp, r: f.r, x: c.x + Math.cos(ph) * 70, y: c.y + Math.sin(ph) * 70,
    vx: 0, vy: 0, ph, orbit: 50 + rnd() * 50, fireT: (f.fire || 0) * (0.5 + rnd()), flash: 0, a: 0, dead: false,
  };
}

// --- Helpers ----------------------------------------------------------------------------

function zoom() {
  return lerp(ZOOM_IN, ZOOM, easeOutCubic(clamp(ow.ease / EASE, 0, 1)));
}

const toScreen = (x, y, z = zoom()) => ({ x: (x - ow.cam.x) * z + view.W / 2, y: (y - ow.cam.y) * z + view.H / 2 });
const toWorld = (sx, sy, z = zoom()) => ({ x: (sx - view.W / 2) / z + ow.cam.x, y: (sy - view.H / 2) / z + ow.cam.y });

function say(x, y, text, color = '#fff', size = 12, life = 1.1) {
  if (ow.texts.length > 24) ow.texts.shift();
  ow.texts.push({ x, y, text, color, size, life, max: life });
}

function burst(x, y, color, size = 1) {
  particle('flash', x, y, 0, 0, 0.2, 46 * size, color, 0);
  particle('ring', x, y, 0, 0, 0.4, 20 + 24 * size, color, 0);
  const n = Math.round((7 + 8 * size) * view.quality);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const s = (80 + Math.random() * 260) * (0.6 + size * 0.4);
    particle('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, 0.25 + Math.random() * 0.3, 1.2 + Math.random(), i % 3 ? color : '#ffffff', 4);
  }
}

// Credit unit for the patrol's level (economy.js unit(), without a live sector).
function creditUnit(level) {
  return Math.max(0.8, 0.95 * level - 0.1) * ((G.run.system && G.run.system.pay) || 1);
}

function reach() {
  return new Set(reachableNodes(G.run.route, G.run.nodeId).map((n) => n.id));
}

// --- Public -----------------------------------------------------------------------------

export const overworld = {
  get state() {
    return ow;
  },
  get mapOpen() {
    return !!(ow && ow.map);
  },

  init(h) {
    hooks = { ...hooks, ...h };
  },

  // Show the overworld for the run's current route: builds it for a new route, else resumes. Coming back from a node
  // puts the ship on that node's beacon and settles the patrols back at home.
  enter(run) {
    let fresh = false;
    if (!run.ow || run.ow.seed !== run.route.seed) {
      run.ow = build(run);
      fresh = true;
    }
    ow = run.ow;
    const back = run.nodeId && ow.at !== run.nodeId;
    if (back) {
      ow.at = run.nodeId;
      const q = ow.pos[run.nodeId];
      Object.assign(ow.ship, { x: q.x, y: q.y, vx: 0, vy: 0 });
      for (const c of ow.clusters) c.aggro = false;
      for (const f of ow.foes) if (!f.dead) {
        f.x = f.c.x + Math.cos(f.ph) * f.orbit;
        f.y = f.c.y + Math.sin(f.ph) * f.orbit;
      }
      ow.eb.length = 0;
    }
    if (fresh || back) {
      ow.ease = 0;
      ow.hintT = 0;
      ow.cam.x = ow.ship.x;
      ow.cam.y = ow.ship.y - 120;
    }
    ow.busy = false;
    ow.dwell = 0;
    ow.dest = null;
    ow.levelT = 0.35;
    ow.pb.length = 0;
    G.particles.length = 0;
    G.texts.length = 0;
    const p = G.player;
    p.x = ow.ship.x;
    p.y = ow.ship.y;
    input.ox = 0;
    input.oy = 0;
    input.holding = false;
  },

  // Leaving for a fight: the ship goes back to its spot in the fight playfield.
  leave() {
    const p = G.player;
    p.x = view.W / 2;
    p.y = view.H * 0.78;
    p.vx = 0;
    p.vy = 0;
    if (ow) {
      ow.map = false;
      ow.eb.length = 0;
      ow.pb.length = 0;
    }
    G.particles.length = 0;
  },

  toggleMap() {
    if (!ow) return;
    ow.map = !ow.map;
    sfx.ui();
  },

  // The ship's screen position (touch steering anchors on it).
  anchor() {
    return ow ? toScreen(ow.ship.x, ow.ship.y) : { x: view.W / 2, y: view.H / 2 };
  },

  // Debug: put the ship at world x, y or on node id.
  warp(x, y) {
    if (!ow) return;
    if (typeof x === 'string') ({ x, y } = ow.pos[x]);
    Object.assign(ow.ship, { x, y, vx: 0, vy: 0 });
    ow.cam.x = x;
    ow.cam.y = y;
  },

  update(raw) {
    if (!ow) return;
    const p = G.player;
    let dt = raw;
    if (G.hitstop > 0) {
      G.hitstop -= raw;
      dt = 0;
    }
    if (G.slowmo > 0) {
      G.slowmo -= raw;
      dt *= 0.3;
    }
    ow.t += dt;
    ow.ease += raw;
    ow.hintT += raw;
    ow.mapA = damp(ow.mapA, ow.map ? 1 : 0, 14, raw);
    if (input.consume('map')) this.toggleMap();

    if (p.dead) {
      updateParticles(dt);
      G.deathT -= raw;
      if (G.deathT <= 0 && !ow.busy) {
        ow.busy = true;
        hooks.dead();
      }
      return;
    }
    p.iframes = Math.max(0, p.iframes - dt);
    p.hurtT = Math.max(0, (p.hurtT || 0) - dt);

    steer(p, dt);
    camera(dt);
    fire(p, dt);
    updateFoes(p, dt);
    updateShots(p, dt);
    updateGems(p, dt);
    updateParticles(dt);
    for (const t of ow.texts) {
      t.life -= raw;
      t.y -= 34 * raw;
    }
    ow.texts = ow.texts.filter((t) => t.life > 0);
    if (p.dead || ow.busy) return;
    interact(p, dt);
    if (ow.busy) return;
    // Level-ups found out here open their draft straight away (back to the overworld after).
    if (G.pendingLevels > 0 && (ow.levelT -= raw) <= 0) {
      ow.busy = true;
      hooks.levelUp();
    }
  },

  drawWorld(ctx, k) {
    if (ow) drawWorld(ctx, k);
  },

  drawHud(ctx, live) {
    if (ow) drawHud(ctx, live);
  },
};

// --- Update -----------------------------------------------------------------------------

function steer(p, dt) {
  const s = ow.ship;
  readDirection();
  let dx = 0;
  let dy = 0;
  const conf = input.consume('confirm');
  ow.confirm = conf;
  if (input.mode === 'dir') {
    dx = input.dx;
    dy = input.dy;
    ow.dest = null;
  } else if (input.device === 'touch') {
    if (input.touch) {
      const a = toScreen(s.x, s.y);
      const vx = input.tx - a.x;
      const vy = input.ty - a.y;
      const d = Math.hypot(vx, vy);
      if (d > 6) {
        const m = Math.min(1, (d - 6) / 55);
        dx = (vx / d) * m;
        dy = (vy / d) * m;
      }
    }
  } else if (input.device === 'mouse') {
    // Diablo style: click or hold the left button to fly to the cursor.
    if (input.mouseDown) ow.dest = toWorld(input.tx, input.ty);
    if (ow.dest) {
      const vx = ow.dest.x - s.x;
      const vy = ow.dest.y - s.y;
      const d = Math.hypot(vx, vy);
      if (d < 8) ow.dest = null;
      else {
        const m = Math.min(1, d / 70);
        dx = (vx / d) * m;
        dy = (vy / d) * m;
      }
    }
    input.consume('dash'); // the click itself
    input.consume('od');
  }
  // Boost (the dash input): a short burst of speed with the dash's invulnerability.
  s.boostCd -= dt;
  s.boostT -= dt;
  // Space is both dash and confirm: inside a beacon it jumps in (interact), anywhere else it boosts.
  if (input.consume('dash') && s.boostCd <= 0 && !(conf && ow.dwellId)) {
    s.boostT = 0.32;
    s.boostCd = 0.9;
    p.iframes = Math.max(p.iframes, 0.32);
    sfx.dash();
    if (!dx && !dy) {
      dx = Math.sin(s.a);
      dy = -Math.cos(s.a);
    }
  }
  input.consume('od');
  const max = SPEED * (p.st.speed || 1) * (s.boostT > 0 ? 2.4 : 1);
  s.vx = damp(s.vx, dx * max, s.boostT > 0 ? 14 : 6, dt);
  s.vy = damp(s.vy, dy * max, s.boostT > 0 ? 14 : 6, dt);
  s.x = clamp(s.x + s.vx * dt, 40, ow.W - 40);
  s.y = clamp(s.y + s.vy * dt, 40, ow.H - 40);
  const sp = Math.hypot(s.vx, s.vy);
  if (sp > 25) s.a = turnToward(s.a, Math.atan2(s.vx, -s.vy), 9 * dt);
  p.x = s.x;
  p.y = s.y;
  // Engine trail.
  if ((s.trailT -= dt) <= 0 && sp > 40) {
    s.trailT = s.boostT > 0 ? 0.012 : 0.03;
    const bx = s.x - Math.sin(s.a) * 14;
    const by = s.y + Math.cos(s.a) * 14;
    particle('dot', bx, by, -s.vx * 0.2 + (Math.random() - 0.5) * 30, -s.vy * 0.2 + (Math.random() - 0.5) * 30, 0.35, s.boostT > 0 ? 9 : 6, p.color, 3);
  }
}

function camera(dt) {
  const s = ow.ship;
  const z = zoom();
  const hw = view.W / 2 / z;
  const hh = view.H / 2 / z;
  // Lead a little ahead of the ship, a touch more upward (the route climbs).
  let tx = s.x + s.vx * 0.32;
  let ty = s.y + s.vy * 0.32 - 70;
  tx = ow.W > hw * 2 ? clamp(tx, hw - 60, ow.W - hw + 60) : ow.W / 2;
  ty = clamp(ty, hh - 60, ow.H - hh + 60);
  ow.cam.x = damp(ow.cam.x, tx, 4.5, dt);
  ow.cam.y = damp(ow.cam.y, ty, 4.5, dt);
}

function nearestFoe(x, y, r) {
  let best = null;
  let bd = r * r;
  for (const f of ow.foes) {
    if (f.dead) continue;
    const d = dist2(x, y, f.x, f.y);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}

// Auto-fire at the nearest patrol in range: the main gun's damage per second, in up to three bolts.
function fire(p, dt) {
  const s = ow.ship;
  if ((s.fireT -= dt) > 0) return;
  const f = nearestFoe(s.x, s.y, 340);
  if (!f) return;
  const w = WEAPONS[p.ship.weapon] || WEAPONS.pulse;
  const streams = weaponStreams(p.ship.weapon, Math.min(8, p.st.mainLv || 1)).length || 1;
  const interval = Math.max(0.09, w.interval / (p.st.rate || 1));
  s.fireT = interval;
  const total = w.dmg * streams * (p.st.dmg || 1);
  const n = Math.min(3, streams);
  const a0 = Math.atan2(f.y - s.y, f.x - s.x);
  for (let i = 0; i < n; i++) {
    const a = a0 + (i - (n - 1) / 2) * 0.07;
    ow.pb.push({ x: s.x, y: s.y, vx: Math.cos(a) * 820, vy: Math.sin(a) * 820, a, life: 0.5, dmg: total / n, crit: Math.random() < (p.st.crit || 0) });
  }
  if (Math.random() < 0.5) sfx.shoot();
}

function updateFoes(p, dt) {
  const s = ow.ship;
  for (const c of ow.clusters) {
    if (c.cleared) continue;
    const d2 = dist2(s.x, s.y, c.x, c.y);
    if (!c.aggro && d2 < AGGRO * AGGRO) {
      c.aggro = true;
      say(c.x, c.y - 90, 'PATROL ENGAGED', '#ff4d6d', 12, 1.3);
      sfx.select();
    } else if (c.aggro && d2 > LEASH * LEASH) c.aggro = false;
  }
  for (const f of ow.foes) {
    if (f.dead) continue;
    const def = FOES[f.type];
    f.flash = Math.max(0, f.flash - dt);
    let tx;
    let ty;
    let sp = def.speed;
    const dx = s.x - f.x;
    const dy = s.y - f.y;
    const d = Math.hypot(dx, dy) || 1;
    if (!f.c.aggro) {
      // Idle: circle the patrol's centre.
      const a = ow.t * 0.45 + f.ph;
      tx = f.c.x + Math.cos(a) * f.orbit;
      ty = f.c.y + Math.sin(a) * f.orbit;
      sp = 70;
      f.a = turnToward(f.a, Math.atan2(ty - f.y, tx - f.x), 3 * dt);
    } else {
      f.a = turnToward(f.a, Math.atan2(dy, dx), 5 * dt);
      if (f.type === 'sniper') {
        const k = d > def.range + 30 ? 1 : d < def.range - 40 ? -1 : 0;
        tx = f.x + (dx / d) * 60 * k + (-dy / d) * 30;
        ty = f.y + (dy / d) * 60 * k + (dx / d) * 30;
      } else {
        tx = s.x;
        ty = s.y;
      }
      if (def.fire && (f.fireT -= dt) <= 0) {
        f.fireT = def.fire * (0.85 + Math.random() * 0.3);
        shoot(f, dx / d, dy / d);
      } else if (def.fire && f.fireT < 0.35) f.flash = Math.sin(f.fireT * 50) > 0 ? 0.05 : 0;
    }
    const mx = tx - f.x;
    const my = ty - f.y;
    const md = Math.hypot(mx, my) || 1;
    const v = Math.min(sp, md * 3);
    f.vx = damp(f.vx, (mx / md) * v, 4, dt);
    f.vy = damp(f.vy, (my / md) * v, 4, dt);
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    // Darts ram.
    if (f.c.aggro && f.type === 'dart' && d < f.r + 9) {
      hurt(p);
      kill(f, false);
    }
  }
}

function shoot(f, ux, uy) {
  if (f.type === 'spinner') {
    const n = 8;
    const off = Math.random() * TAU;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * TAU;
      ow.eb.push({ x: f.x, y: f.y, vx: Math.cos(a) * 125, vy: Math.sin(a) * 125, life: 3.4, r: 5.2, spr: 'eb_orb' });
    }
  } else ow.eb.push({ x: f.x, y: f.y, vx: ux * 210, vy: uy * 210, life: 3, r: 5.2, spr: 'eb_small' });
}

function hurt(p) {
  const s = ow.ship;
  p.x = s.x;
  p.y = s.y;
  hurtPlayer(p);
  ow.eb = ow.eb.filter((b) => dist2(b.x, b.y, s.x, s.y) > 150 * 150);
}

function kill(f, reward = true) {
  f.dead = true;
  burst(f.x, f.y, '#ff4d6d', f.r > 18 ? 1.3 : 0.8);
  sfx.explode(f.r > 18 ? 1 : 0.6);
  G.kills++;
  if (reward) {
    const xp = FOES[f.type].xp * (1 + 0.12 * f.c.level);
    for (let i = 0; i < 2; i++) ow.gems.push({ x: f.x, y: f.y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, val: xp / 2, kind: 'xp', t: 0 });
  }
  const c = f.c;
  if (ow.foes.every((o) => o.c !== c || o.dead)) {
    c.cleared = true;
    c.aggro = false;
    const n = Math.round(creditUnit(c.level) * (3 + c.size * 0.6));
    for (let i = 0; i < 5; i++) ow.gems.push({ x: f.x, y: f.y, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220, val: n / 5, kind: 'cr', t: 0 });
    say(c.x, c.y - 60, 'PATROL CLEARED', '#ffd24a', 13, 1.5);
    sfx.levelUp();
  }
}

function updateShots(p, dt) {
  const s = ow.ship;
  for (const b of ow.pb) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    for (const f of ow.foes) {
      if (f.dead || dist2(b.x, b.y, f.x, f.y) > (f.r + 4) ** 2) continue;
      const dmg = b.dmg * (b.crit ? p.st.critMul || 2.5 : 1);
      f.hp -= dmg;
      f.flash = 0.06;
      f.c.aggro = true;
      b.life = 0;
      sparks(b.x, b.y, '#ffffff', 2, 160);
      if (b.crit) say(f.x, f.y - 16, `${Math.round(dmg)}!`, '#ffe14d', 11, 0.5);
      if (f.hp <= 0) kill(f);
      break;
    }
  }
  ow.pb = ow.pb.filter((b) => b.life > 0);
  const hr = (p.r || 3.5) + 2;
  for (const b of ow.eb) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life > 0 && dist2(b.x, b.y, s.x, s.y) < (hr + b.r * 0.75) ** 2) {
      b.life = 0;
      hurt(p);
    }
  }
  ow.eb = ow.eb.filter((b) => b.life > 0);
}

function updateGems(p, dt) {
  const s = ow.ship;
  const mag = (p.st.magnet || 80) * 1.6;
  let got = false;
  for (const g of ow.gems) {
    g.t += dt;
    const dx = s.x - g.x;
    const dy = s.y - g.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < mag && g.t > 0.25) {
      const v = 260 + (1 - d / mag) * 500;
      g.vx = damp(g.vx, (dx / d) * v, 8, dt);
      g.vy = damp(g.vy, (dy / d) * v, 8, dt);
    } else {
      g.vx *= 1 - 3 * dt;
      g.vy *= 1 - 3 * dt;
    }
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    if (d < 16 && g.t > 0.25) {
      g.done = true;
      if (g.kind === 'xp') gainXp(p, g.val);
      else {
        const n = gainCredits(g.val);
        if (n) say(s.x, s.y - 30, `+${n}`, '#ffd24a', 11, 0.8);
      }
      got = true;
    }
  }
  if (got) sfx.pickup();
  ow.gems = ow.gems.filter((g) => !g.done);
}

// Beacons and sites under the ship.
function interact(p, dt) {
  const s = ow.ship;
  const can = reach();
  let target = null;
  for (const n of G.run.route.nodes) {
    if (!can.has(n.id)) continue;
    const q = ow.pos[n.id];
    if (dist2(s.x, s.y, q.x, q.y) < ENGAGE_R * ENGAGE_R) {
      target = { id: n.id, node: n };
      break;
    }
  }
  for (const site of ow.sites) {
    if (site.done) continue;
    const d2 = dist2(s.x, s.y, site.x, site.y);
    const def = SITES[site.kind];
    if (def.engage) {
      if (!target && d2 < ENGAGE_R * ENGAGE_R) target = { id: site.id, site };
    } else if (d2 < 44 * 44) collect(site, p);
  }
  if (target && target.id === ow.dwellId) ow.dwell += dt;
  else ow.dwell = target ? dt : 0;
  ow.dwellId = target ? target.id : null;
  if (target && (ow.dwell >= DWELL || ow.confirm)) {
    ow.busy = true;
    ow.dwell = 0;
    ow.map = false;
    sfx.warp();
    flash('255,255,255', 0.35);
    if (target.node) hooks.engage(target.node);
    else {
      target.site.done = true;
      hooks.signal(target.site);
    }
  }
}

function collect(site, p) {
  site.done = true;
  const def = SITES[site.kind];
  burst(site.x, site.y, def.color, 1.1);
  const lvl = nodeLevel(G.run.system, Math.max(0, G.run.row));
  if (site.kind === 'wreck') {
    const n = gainCredits(Math.round(creditUnit(lvl) * 8));
    say(site.x, site.y - 30, `SALVAGE +${n}`, def.color, 13, 1.4);
    sfx.coin();
  } else if (site.kind === 'data') {
    gainXp(p, p.xpNeed * 0.3);
    say(site.x, site.y - 30, 'DATA DECRYPTED +XP', def.color, 13, 1.4);
    sfx.pickup();
  } else if (site.kind === 'repair') {
    if (p.hp < p.maxHp) {
      p.hp++;
      say(site.x, site.y - 30, '+1 HULL', def.color, 13, 1.4);
    } else {
      gainXp(p, p.xpNeed * 0.2);
      say(site.x, site.y - 30, 'HULL FULL · +XP', def.color, 13, 1.4);
    }
    sfx.heal();
  }
}

// --- Draw: world ------------------------------------------------------------------------

function nodeState(n, can, visited) {
  if (n.id === G.run.nodeId) return 'cur';
  if (can.has(n.id)) return 'reach';
  if (visited.has(n.id)) return 'done';
  return 'lock';
}

function drawWorld(ctx, k) {
  const z = zoom();
  const h = hue();
  const W = view.W;
  const H = view.H;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = '#05030d';
  ctx.fillRect(0, 0, W, H);
  drawStars(ctx, z, h);

  const ox = (W / 2 - ow.cam.x * z) * k + view.ox;
  const oy = (H / 2 - ow.cam.y * z) * k + view.oy;
  ctx.setTransform(k * z, 0, 0, k * z, ox, oy);
  const vx0 = ow.cam.x - W / 2 / z - 60;
  const vx1 = ow.cam.x + W / 2 / z + 60;
  const vy0 = ow.cam.y - H / 2 / z - 60;
  const vy1 = ow.cam.y + H / 2 / z + 60;
  const vis = (x, y, m = 0) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

  // Nebulae
  ctx.globalCompositeOperation = 'lighter';
  for (const nb of ow.nebulae) {
    if (!vis(nb.x, nb.y, nb.s / 2)) continue;
    const g = glow(`hsl(${Math.round(nb.h)},100%,55%)`, 128); // plain hsl(): glow() fades it
    ctx.globalAlpha = nb.a;
    ctx.drawImage(g.img, nb.x - nb.s / 2, nb.y - nb.s / 2, nb.s, nb.s);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // Grid: minor and major lines, only what's on screen.
  const G0 = 80;
  ctx.lineWidth = 1 / z;
  for (const major of [false, true]) {
    const step = major ? G0 * 5 : G0;
    ctx.strokeStyle = hsl(h, 62, major ? 0.13 : 0.055);
    ctx.beginPath();
    for (let x = Math.max(0, Math.ceil(vx0 / step) * step); x <= Math.min(ow.W, vx1); x += step) {
      ctx.moveTo(x, Math.max(0, vy0));
      ctx.lineTo(x, Math.min(ow.H, vy1));
    }
    for (let y = Math.max(0, Math.ceil(vy0 / step) * step); y <= Math.min(ow.H, vy1); y += step) {
      ctx.moveTo(Math.max(0, vx0), y);
      ctx.lineTo(Math.min(ow.W, vx1), y);
    }
    ctx.stroke();
  }
  // World edge
  ctx.strokeStyle = hsl(h, 65, 0.45);
  ctx.lineWidth = 2 / z;
  ctx.strokeRect(0, 0, ow.W, ow.H);

  const route = G.run.route;
  const can = reach();
  const visited = new Set(G.run.visited);

  // Lanes
  ctx.lineWidth = 3;
  const lane = (a, b, style) => {
    if (!vis(a.x, a.y, 600) && !vis(b.x, b.y, 600)) return;
    ctx.strokeStyle = style.color;
    ctx.globalAlpha = style.a;
    ctx.setLineDash(style.dash || []);
    ctx.lineDashOffset = style.dash ? -ow.t * 46 : 0;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  for (const n of route.nodes) {
    for (const id of n.links) {
      const t = route.nodes.find((m) => m.id === id);
      const trav = visited.has(n.id) && visited.has(id);
      const open = n.id === G.run.nodeId && can.has(id);
      lane(ow.pos[n.id], ow.pos[id], trav ? { color: hsl(h, 70), a: 0.55 } : open ? { color: NODE_TYPES[t.type].color, a: 0.8, dash: [18, 14] } : { color: hsl(h, 60), a: 0.16, dash: [6, 16] });
    }
  }
  if (!G.run.nodeId) for (const n of route.rows[0]) lane(ow.start, ow.pos[n.id], { color: NODE_TYPES[n.type].color, a: 0.8, dash: [18, 14] });
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Patrol zones (faint warning circles while they live)
  for (const c of ow.clusters) {
    if (c.cleared || !vis(c.x, c.y, 160)) continue;
    ctx.strokeStyle = '#ff4d6d';
    ctx.globalAlpha = c.aggro ? 0.22 : 0.12 + Math.sin(ow.t * 2 + c.id) * 0.04;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 12]);
    ctx.lineDashOffset = ow.t * 12;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 135, 0, TAU);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  drawSites(ctx, vis);
  for (const n of route.nodes) {
    const q = ow.pos[n.id];
    if (vis(q.x, q.y, 120)) drawBeacon(ctx, n, q, nodeState(n, can, visited));
  }

  // Gems
  for (const g of ow.gems) {
    if (!vis(g.x, g.y)) continue;
    const spr = g.kind === 'xp' ? S.gem2 : S.credit;
    ctx.drawImage(spr.img, g.x - spr.half * 0.8, g.y - spr.half * 0.8, spr.size * 0.8, spr.size * 0.8);
  }

  // Patrols
  for (const f of ow.foes) {
    if (f.dead || !vis(f.x, f.y, 40)) continue;
    const spr = S[FOES[f.type].spr];
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.a - Math.PI / 2);
    ctx.drawImage(f.flash > 0 && spr.flash ? spr.flash : spr.img, -spr.half, -spr.half, spr.size, spr.size);
    ctx.restore();
    if (f.hp < f.max) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(f.x - 14, f.y - f.r - 9, 28, 3);
      ctx.fillStyle = '#ff4d6d';
      ctx.fillRect(f.x - 14, f.y - f.r - 9, 28 * clamp(f.hp / f.max, 0, 1), 3);
    }
  }

  // Player bolts
  const pspr = S['pb_' + G.player.ship.id] || S.pb_drone;
  for (const b of ow.pb) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.a + Math.PI / 2);
    ctx.drawImage(pspr.img, -pspr.half, -pspr.half, pspr.size, pspr.size);
    ctx.restore();
  }

  drawShip(ctx);
  drawParticles(ctx);

  for (const b of ow.eb) {
    const spr = S[b.spr];
    ctx.drawImage(spr.img, b.x - spr.half, b.y - spr.half, spr.size, spr.size);
  }

  // Floating labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of ow.texts) {
    ctx.globalAlpha = Math.min(1, (t.life / t.max) * 2);
    ctx.font = `700 ${t.size / z}px ${FONT}`;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(t.text, t.x + 1, t.y + 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

// Parallax star layers in screen space (seeded tiles).
const STAR_TILE = 512;
let starTiles = null;
function drawStars(ctx, z, h) {
  if (!starTiles) {
    const rnd = mulberry32(7);
    starTiles = [0.12, 0.3, 0.55].map((f) => ({ f, stars: Array.from({ length: 34 }, () => ({ x: rnd() * STAR_TILE, y: rnd() * STAR_TILE, s: 0.6 + rnd() * 1.4, a: 0.25 + rnd() * 0.5 })) }));
  }
  for (const L of starTiles) {
    const offX = -((ow.cam.x * z * L.f) % STAR_TILE) - STAR_TILE;
    const offY = -((ow.cam.y * z * L.f) % STAR_TILE) - STAR_TILE;
    ctx.fillStyle = L.f > 0.5 ? hsl(h, 85, 0.9) : '#ffffff';
    for (let tx = offX; tx < view.W; tx += STAR_TILE) {
      for (let ty = offY; ty < view.H; ty += STAR_TILE) {
        for (const st of L.stars) {
          const x = tx + st.x;
          const y = ty + st.y;
          if (x < -2 || y < -2 || x > view.W + 2 || y > view.H + 2) continue;
          ctx.globalAlpha = st.a * (0.5 + L.f);
          ctx.fillRect(x, y, st.s, st.s);
        }
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawBeacon(ctx, n, q, state) {
  const info = NODE_TYPES[n.type];
  const boss = n.type === 'boss';
  const col = info.color;
  const reachN = state === 'reach';
  const a = reachN ? 1 : state === 'cur' ? 0.75 : state === 'done' ? 0.4 : 0.32;
  const pulse = reachN ? 0.5 + Math.sin(ow.t * 3 + q.x) * 0.5 : 0;
  // Glow pool
  ctx.globalCompositeOperation = 'lighter';
  const g = glow(col, 64);
  const gs = (boss ? 260 : 170) * (reachN ? 1 + pulse * 0.12 : 0.7);
  ctx.globalAlpha = reachN ? 0.42 : 0.12;
  ctx.drawImage(g.img, q.x - gs / 2, q.y - gs / 2, gs, gs);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = a;
  // Square frame
  const half = boss ? 34 : 24;
  ctx.fillStyle = 'rgba(5,3,13,0.7)';
  ctx.fillRect(q.x - half, q.y - half, half * 2, half * 2);
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(q.x - half, q.y - half, half * 2, half * 2);
  if (reachN) {
    // Outer square that breathes, and the engage ring (fills while you hold inside)
    const o = half + 8 + pulse * 5;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(q.x - o, q.y - o, o * 2, o * 2);
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([8, 10]);
    ctx.lineDashOffset = -ow.t * 20;
    ctx.beginPath();
    ctx.arc(q.x, q.y, ENGAGE_R + 6, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    if (ow.dwellId === n.id && ow.dwell > 0) {
      ctx.globalAlpha = 1;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(q.x, q.y, ENGAGE_R + 6, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(ow.dwell / DWELL, 0, 1));
      ctx.stroke();
    }
  }
  const ic = icon(state === 'done' ? 'check' : n.type, state === 'done' ? '#ffffff' : col);
  const is = boss ? 36 : 26;
  ctx.globalAlpha = a;
  if (ic.complete) ctx.drawImage(ic, q.x - is / 2, q.y - is / 2, is, is);
  // Label
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `700 ${(boss ? 15 : 12.5) / ZOOM}px ${FONT}`;
  ctx.fillStyle = col;
  const ly = q.y + half + 10;
  ctx.fillText(boss ? `${info.name} · ${G.run.system.short}` : info.name, q.x, ly);
  if (state !== 'done') {
    const subs = [];
    const rw = n.reward ? REWARDS[n.reward] : null;
    if (rw) subs.push([rw.name, rw.color]);
    for (const m of n.modifiers) if (MODIFIERS[m]) subs.push([MODIFIERS[m].name, MODIFIERS[m].color]);
    ctx.font = `700 ${13 / ZOOM}px ${FONT2}`;
    subs.forEach(([t, c], i) => {
      ctx.fillStyle = c;
      ctx.fillText(t, q.x, ly + 20 + i * 17);
    });
  }
  ctx.globalAlpha = 1;
}

function drawSites(ctx, vis) {
  for (const site of ow.sites) {
    if (site.done || !vis(site.x, site.y, 80)) continue;
    const def = SITES[site.kind];
    const t = ow.t + site.t;
    ctx.globalCompositeOperation = 'lighter';
    const g = glow(def.color, 64);
    ctx.globalAlpha = 0.28 + Math.sin(t * 2.4) * 0.08;
    ctx.drawImage(g.img, site.x - 60, site.y - 60, 120, 120);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    if (site.kind === 'signal') {
      for (let i = 0; i < 2; i++) {
        const r = ((t * 0.6 + i * 0.5) % 1) * 70;
        ctx.globalAlpha = 1 - r / 70;
        ctx.beginPath();
        ctx.arc(site.x, site.y, r + 10, 0, TAU);
        ctx.stroke();
      }
      if (ow.dwellId === site.id && ow.dwell > 0) {
        ctx.globalAlpha = 1;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(site.x, site.y, ENGAGE_R + 6, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(ow.dwell / DWELL, 0, 1));
        ctx.stroke();
        ctx.lineWidth = 2;
      }
    }
    // A small square that bobs, with the kind's icon.
    const half = 15;
    const by = site.y + Math.sin(t * 2) * 3;
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = 'rgba(5,3,13,0.7)';
    ctx.fillRect(site.x - half, by - half, half * 2, half * 2);
    ctx.strokeRect(site.x - half, by - half, half * 2, half * 2);
    const ic = icon(def.icon, def.color);
    if (ic.complete) ctx.drawImage(ic, site.x - 10, by - 10, 20, 20);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `700 ${11.5 / ZOOM}px ${FONT}`;
    ctx.fillStyle = def.color;
    ctx.fillText(def.name, site.x, by + half + 7);
    ctx.globalAlpha = 1;
  }
}

function drawShip(ctx) {
  const p = G.player;
  if (!p || p.dead) return;
  const s = ow.ship;
  const spr = S['ship_' + p.ship.id];
  ctx.globalCompositeOperation = 'lighter';
  const gl = glow(p.color, 64);
  ctx.globalAlpha = s.boostT > 0 ? 0.6 : 0.3;
  const gs = s.boostT > 0 ? 70 : 46;
  ctx.drawImage(gl.img, s.x - gs / 2, s.y - gs / 2, gs, gs);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = p.iframes > 0 && s.boostT <= 0 && Math.floor(ow.t * 20) % 2 === 0 ? 0.35 : 1;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.a);
  ctx.drawImage(spr.img, -spr.half, -spr.half, spr.size, spr.size);
  ctx.restore();
  ctx.globalAlpha = 1;
  if (p.shield) {
    ctx.strokeStyle = 'rgba(63,246,255,' + (0.45 + Math.sin(ow.t * 5) * 0.15) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 25, 0, TAU);
    ctx.stroke();
  }
}

// --- Draw: HUD and map overlay ------------------------------------------------------------

function text(ctx, str, x, y, size, color, align = 'left', weight = 700, font = FONT) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function mapKey() {
  const d = input.device;
  return d === 'pad' ? 'SELECT' : d === 'touch' ? 'MAP' : 'M';
}

function drawHud(ctx, live) {
  const p = G.player;
  const run = G.run;
  const W = view.W;
  const H = view.H;
  const top = view.safeTop;
  ctx.textBaseline = 'middle';

  // Hull
  for (let i = 0; i < p.maxHp; i++) {
    const spr = i < p.hp ? S.hudHeart : S.hudHeartEmpty;
    ctx.drawImage(spr.img, 12 + i * 19, top + 10, 18, 18);
  }
  if (p.shield) ctx.drawImage(S.hudShield.img, 12 + p.maxHp * 19 + 2, top + 10, 18, 18);
  // Level, XP and credits
  text(ctx, `LV ${p.level}`, 14, top + 40, 11, '#3ff6ff');
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(56, top + 37, 70, 5);
  ctx.fillStyle = '#3ff6ff';
  ctx.fillRect(56, top + 37, 70 * clamp(p.xp / p.xpNeed, 0, 1), 5);
  text(ctx, `${Math.floor(run.wallet || 0).toLocaleString()} CR`, 136, top + 40, 11, '#ffd24a');

  // System and route position
  const total = run.route.rows.length;
  const next = run.row + 1;
  text(ctx, run.deep ? `DEEP ${run.deep} · ${run.system.short}` : run.system.name, W / 2, top + 20, 12, hsl(hue(), 72), 'center', 900);
  text(ctx, next >= total - 1 ? 'BOSS SECTOR NEXT' : `SECTOR ${next + 1} · ${total - 1 - next} TO THE BOSS`, W / 2, top + 37, 12, 'rgba(255,255,255,0.7)', 'center', 700, FONT2);

  if (live) drawArrows(ctx);

  // Lower third: what's under / near the ship.
  const near = nearInfo();
  const by = H - view.safeBottom - 64;
  if (near && ow.mapA < 0.5) {
    // Fixed size box (three lines, the detail line may be empty) so nothing shifts as the ship moves between beacons.
    const bw = Math.min(W - 32, 380);
    const bx = (W - bw) / 2;
    const y0 = by - 34;
    ctx.fillStyle = 'rgba(5,3,13,0.8)';
    ctx.fillRect(bx, y0, bw, 66);
    ctx.strokeStyle = near.color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, y0, bw, 66);
    text(ctx, near.title, W / 2, y0 + 15, 13, near.color, 'center', 900);
    if (near.detail) text(ctx, near.detail, W / 2, y0 + 33, 12, 'rgba(255,255,255,0.85)', 'center', 700, FONT2);
    text(ctx, near.sub, W / 2, y0 + 51, 12, near.subColor || 'rgba(255,255,255,0.6)', 'center', 700, FONT2);
    if (near.engage) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(bx, y0 + 63, bw, 3);
      ctx.fillStyle = near.color;
      ctx.fillRect(bx, y0 + 63, bw * clamp(ow.dwell / DWELL, 0, 1), 3);
    }
  } else if (ow.mapA < 0.5) {
    const a = ow.hintT < 8 ? 0.85 : 0.45;
    const go = input.device === 'touch' ? 'DRAG TO FLY' : input.device === 'mouse' ? 'CLICK TO FLY' : 'FLY';
    text(ctx, `${go} TO A LIT BEACON  ·  ${mapKey()} MAP`, W / 2, by + 8, 12, `rgba(255,255,255,${a})`, 'center', 700, FONT2);
  }

  if (ow.mapA > 0.01) drawMap(ctx, ow.mapA);
}

// The beacon or site the ship is at (or close to), for the lower third.
function nearInfo() {
  const s = ow.ship;
  const can = reach();
  const visited = new Set(G.run.visited);
  let best = null;
  let bd = 150 * 150;
  for (const n of G.run.route.nodes) {
    const q = ow.pos[n.id];
    const d = dist2(s.x, s.y, q.x, q.y);
    if (d < bd) {
      bd = d;
      best = { n };
    }
  }
  for (const site of ow.sites) {
    if (site.done) continue;
    const d = dist2(s.x, s.y, site.x, site.y);
    if (d < bd) {
      bd = d;
      best = { site };
    }
  }
  if (!best) return null;
  if (best.site) {
    const def = SITES[best.site.kind];
    const inside = ow.dwellId === best.site.id;
    return { title: def.name, detail: def.sub, sub: def.engage ? (inside ? 'HOLD POSITION OR PRESS ENTER TO ANSWER' : 'FLY INTO THE SIGNAL TO ANSWER') : 'FLY THROUGH TO COLLECT', color: def.color, engage: def.engage && inside };
  }
  const n = best.n;
  const info = NODE_TYPES[n.type];
  const st = nodeState(n, can, visited);
  const rw = n.reward && st !== 'done' ? REWARDS[n.reward] : null;
  const mods = n.modifiers.map((m) => MODIFIERS[m] && MODIFIERS[m].name).filter(Boolean);
  const detail = [rw ? `${rw.name}: ${rw.desc}` : '', ...mods].filter(Boolean).join('  ·  ');
  const title = `${info.name}  ·  SECTOR ${n.row + 1}`;
  if (st === 'reach') {
    const inside = ow.dwellId === n.id;
    const key = input.device === 'pad' ? 'A' : input.device === 'touch' ? '' : 'ENTER';
    return { title, detail, sub: inside ? `HOLD POSITION${key ? ' OR PRESS ' + key : ''} TO JUMP IN` : 'FLY INTO THE BEACON TO JUMP IN', color: info.color, engage: inside };
  }
  if (st === 'cur') return { title, detail: '', sub: 'CLEARED · YOUR LAST JUMP', color: info.color };
  if (st === 'done') return { title, detail: '', sub: 'VISITED', color: 'rgba(255,255,255,0.6)' };
  return { title, detail, sub: 'NOT ON YOUR ROUTE FROM HERE', color: info.color, subColor: '#ff4d6d' };
}

// Edge chevrons toward reachable beacons that are off screen.
function drawArrows(ctx) {
  const z = zoom();
  const m = 26;
  const top = view.safeTop + 58;
  const bottom = view.H - view.safeBottom - 104;
  const labels = [];
  for (const n of reachableNodes(G.run.route, G.run.nodeId)) {
    const q = ow.pos[n.id];
    const sp = toScreen(q.x, q.y, z);
    if (sp.x > 0 && sp.x < view.W && sp.y > top && sp.y < bottom) continue;
    const cx = view.W / 2;
    const cy = (top + bottom) / 2;
    const dx = sp.x - cx;
    const dy = sp.y - cy;
    const t = Math.min((view.W / 2 - m) / Math.abs(dx || 1e-3), ((bottom - top) / 2 - 8) / Math.abs(dy || 1e-3));
    const x = cx + dx * t;
    const y = cy + dy * t;
    const a = Math.atan2(dy, dx);
    const col = NODE_TYPES[n.type].color;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.75 + Math.sin(ow.t * 4) * 0.2;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -8);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    const lx = clamp(x - Math.cos(a) * 30, 44, view.W - 44);
    const ly = clamp(y - Math.sin(a) * 18, top, bottom);
    if (labels.some((l) => Math.abs(l.x - lx) < 80 && Math.abs(l.y - ly) < 16)) continue;
    labels.push({ x: lx, y: ly });
    ctx.textBaseline = 'middle';
    text(ctx, NODE_TYPES[n.type].name, lx, ly, 11, col, 'center', 700);
  }
}

// The route map over the screen (what the old route screen showed), with the ship's position. Flying continues.
function drawMap(ctx, a) {
  const W = view.W;
  const x0 = 16;
  const y0 = view.safeTop + 56;
  const w = W - 32;
  const h = view.H - y0 - view.safeBottom - 100;
  const h0 = hue();
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(5,3,13,0.86)';
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = hsl(h0, 65);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0, y0, w, h);
  ctx.textBaseline = 'middle';
  const run = G.run;
  text(ctx, 'ROUTE MAP', x0 + 14, y0 + 18, 12, hsl(h0, 72), 'left', 900);
  text(ctx, `${new Set(run.visited).size} / ${run.route.rows.length} NODES`, x0 + w - 14, y0 + 18, 12, 'rgba(255,255,255,0.7)', 'right', 700, FONT2);
  // Map area
  const mx0 = x0 + 26;
  const mx1 = x0 + w - 26;
  const my0 = y0 + 44;
  const my1 = y0 + h - 34;
  const mpX = (x) => mx0 + (x / ow.W) * (mx1 - mx0);
  const mpY = (y) => my0 + (y / ow.H) * (my1 - my0);
  const route = run.route;
  const can = reach();
  const visited = new Set(run.visited);
  // Camera view
  const z = zoom();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mpX(ow.cam.x - W / 2 / z), mpY(ow.cam.y - view.H / 2 / z), (W / z / ow.W) * (mx1 - mx0), (view.H / z / ow.H) * (my1 - my0));
  // Links
  ctx.lineWidth = 1.5;
  for (const n of route.nodes) {
    for (const id of n.links) {
      const p0 = ow.pos[n.id];
      const p1 = ow.pos[id];
      const trav = visited.has(n.id) && visited.has(id);
      const open = n.id === run.nodeId && can.has(id);
      ctx.strokeStyle = trav ? hsl(h0, 70, 0.8) : open ? 'rgba(255,255,255,0.85)' : hsl(h0, 60, 0.22);
      ctx.beginPath();
      ctx.moveTo(mpX(p0.x), mpY(p0.y));
      ctx.lineTo(mpX(p1.x), mpY(p1.y));
      ctx.stroke();
    }
  }
  if (!run.nodeId) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    for (const n of route.rows[0]) {
      ctx.beginPath();
      ctx.moveTo(mpX(ow.start.x), mpY(ow.start.y));
      ctx.lineTo(mpX(ow.pos[n.id].x), mpY(ow.pos[n.id].y));
      ctx.stroke();
    }
  }
  // Patrols and sites
  for (const c of ow.clusters) {
    if (c.cleared) continue;
    ctx.fillStyle = '#ff4d6d';
    ctx.globalAlpha = a * 0.8;
    ctx.fillRect(mpX(c.x) - 3, mpY(c.y) - 3, 6, 6);
  }
  for (const s of ow.sites) {
    if (s.done) continue;
    ctx.strokeStyle = SITES[s.kind].color;
    ctx.globalAlpha = a * 0.9;
    ctx.strokeRect(mpX(s.x) - 3.5, mpY(s.y) - 3.5, 7, 7);
  }
  ctx.globalAlpha = a;
  // Nodes
  for (const n of route.nodes) {
    const q = ow.pos[n.id];
    const x = mpX(q.x);
    const y = mpY(q.y);
    const st = nodeState(n, can, visited);
    const col = NODE_TYPES[n.type].color;
    const half = n.type === 'boss' ? 13 : 10;
    ctx.globalAlpha = a * (st === 'reach' ? 1 : st === 'cur' ? 0.9 : st === 'done' ? 0.45 : 0.55);
    ctx.fillStyle = '#05030d';
    ctx.fillRect(x - half, y - half, half * 2, half * 2);
    ctx.strokeStyle = st === 'cur' ? '#ffffff' : col;
    ctx.lineWidth = st === 'reach' ? 2 : 1.2;
    ctx.strokeRect(x - half, y - half, half * 2, half * 2);
    if (st === 'reach') {
      const o = half + 3 + Math.sin(ow.t * 4) * 1.5;
      ctx.strokeRect(x - o, y - o, o * 2, o * 2);
    }
    const ic = icon(st === 'done' ? 'check' : n.type, st === 'done' ? '#ffffff' : col);
    if (ic.complete) ctx.drawImage(ic, x - half * 0.75, y - half * 0.75, half * 1.5, half * 1.5);
    if (st === 'reach' && n.reward) {
      const rw = REWARDS[n.reward];
      text(ctx, rw.name, x, y + half + 10, 12, rw.color, 'center', 700, FONT2);
    }
  }
  // Ship marker
  const s = ow.ship;
  ctx.globalAlpha = a;
  ctx.save();
  ctx.translate(mpX(s.x), mpY(s.y));
  ctx.rotate(s.a);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Legend
  const ly = y0 + h - 16;
  ctx.textBaseline = 'middle';
  let lx = x0 + 14;
  for (const [label, col] of [['YOU', '#ffffff'], ['PATROL', '#ff4d6d'], ['SITE', '#b48bff'], ['NEXT JUMP', '#3ff6ff']]) {
    ctx.fillStyle = col;
    ctx.fillRect(lx, ly - 3, 6, 6);
    text(ctx, label, lx + 10, ly, 12, 'rgba(255,255,255,0.7)', 'left', 700, FONT2);
    lx += 10 + ctx.measureText(label).width + 16;
  }
  text(ctx, `${mapKey()} CLOSE`, x0 + w - 14, ly, 12, 'rgba(255,255,255,0.7)', 'right', 700, FONT2);
  ctx.globalAlpha = 1;
}
