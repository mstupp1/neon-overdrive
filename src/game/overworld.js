// Overworld: between nodes the run flies through open space, one zone per leg of the route (campaign only).
// A leg runs from the node just cleared (or the system's entry) to the next row. Its zone holds that row's reachable
// nodes as exits, placed generally upward (up, up-left or up-right) and hidden until the ship comes close. Taking an
// exit starts that node (main.js pickRouteNode), so picking one closes the others, and the next leg is a fresh zone.
// The ship flies with its whole fight loadout: world.js step() runs with field.ow set (state.js), so the main gun,
// modules, dash, ultimate and passives all work, aimed along the ship's facing. The ship turns to the nearest awake
// enemy in range while you steer anywhere; Shift (pad shoulder) locks onto that target, or holds the facing when there
// is none, and with a mouse Shift aims at the cursor. The right stick aims as well. With no target it faces the flight.
// Packs of the levels' own enemy types sleep around the zone and wake when the ship comes near (owAI below drives
// them instead of the fight behaviours), and stragglers roam in from off screen the longer a leg takes. Debris fields
// block ships and shots. Sites: salvage, data caches, repair beacons, distress signals (an anomaly event) and guarded
// caches. M / the MAP button lays a fogged map of the zone and the system route over the screen while you keep flying.
// State lives on G.run.ow (the current leg); the leg's enemies live in G.enemies while the run is in it.

import { G, view, field, inField, sectorDifficulty, enemyHit } from './state.js';
import { input, readDirection } from '../core/input.js';
import { sfx } from '../core/audio.js';
import { beat } from '../core/beat.js';
import { S, glow } from '../render/sprites.js';
import { TAU, clamp, lerp, damp, dist2, turnToward, mulberry32, easeOutCubic, rand } from '../core/math.js';
import { NODE_TYPES, REWARDS, reachableNodes, nodeLevel } from './campaign.js';
import { miniById } from './minibosses.js';
import { MODIFIERS } from './modifiers.js';
import { applyHeat } from './core.js';
import { foesAt, zoneCount } from './director.js';
import { viewName } from './stageview.js';
import { bossById } from './bosses.js';
import { step, renderWorld } from './world.js';
import { spawnEnemy, spawnWeavers, setOverworldAI, relink, weaverBeam, snakeBody } from './enemies.js';
import { shoot, ring, fan, aimAt } from './bullets.js';
import { dropCredit } from './pickups.js';
import { sparks, explosion, floatText, flash } from './fx.js';
import { gainXp, collectPickup } from './player.js';
import { resetModules } from './modules.js';
import { gainCredits, payUnit } from './economy.js';
import { drawGauges, drawHull } from '../render/hud.js';
import { NODE_ICONS } from '../ui/meta.js';

const FONT = 'Orbitron, "Segoe UI", sans-serif';
const FONT2 = 'Rajdhani, "Segoe UI", sans-serif';
const UP = -Math.PI / 2;

const ZONE_W = 2800; // zone size (world units); the boss approach is shorter
const ZONE_H = 3600;
const ZOOM = 0.72; // camera zoom (world units -> logical px)
const ZOOM_IN = 1.35; // camera zoom at the start of the entry ease
const EASE = 1.1; // seconds of entry ease
const ENGAGE_R = 58; // exit trigger radius
const DWELL = 0.85; // seconds holding inside an exit to take it
const SEE = 520; // exits and sites are found within this
const AGGRO = 400; // a pack wakes when the ship is this close to its centre (or when it is shot)
const LEASH = 1250; // and goes back to sleep past this
const AIM_R = 460; // the ship auto-faces the nearest awake enemy this close
const LOCK_R = 720; // a Shift lock breaks past this
const WAKE = 1500; // asleep enemies further than this are frozen
const FOG = 160; // map fog cell
const FOG_R = 560; // the ship uncovers the map this far around it
const HP = 0.6; // overworld enemy HP vs. a fight at the same level
const XP = 0.75; // and XP

// Site kinds: one-shot pickups (touch) or engage sites (dwell, opens a screen).
const SITES = {
  signal: { name: 'DISTRESS SIGNAL', sub: 'UNKNOWN SOURCE · OPENS AN ANOMALY', color: '#b48bff', icon: 'anomaly', engage: true },
  repair: { name: 'REPAIR BEACON', sub: 'RESTORES 1 HULL', color: '#7dff6b', icon: 'dock' },
  wreck: { name: 'SALVAGE', sub: 'DRIFTING WRECK · CREDITS', color: '#ffd24a', icon: 'vault' },
  data: { name: 'DATA CACHE', sub: 'ENCRYPTED LOGS · XP', color: '#3ff6ff', icon: 'combat' },
  cache: { name: 'GUARDED CACHE', sub: 'ELITE GUARDS · CREDITS AND XP', color: '#ff3df2', icon: 'elite' },
};

// What each stop is, for the exit card (fights list their reward, hazards and hostiles instead).
const STOP_DESC = {
  market: 'Black Market: spend credits on upgrades, repairs and gear.',
  dock: 'Rest stop: repair, reinforce the hull or overclock an upgrade.',
  anomaly: 'Unknown signal: an event with a choice. Risk for reward.',
  vault: 'Vault: a free draft where each pick installs 2 levels, plus credits.', // unguarded (mini-boss vaults show a fight card)
  rift: 'Chaos rift: dive in for 3 upgrade levels. Hazards follow you out.',
};

const FOE_NAMES = {
  dart: 'DARTS', swarm: 'SWARMS', spinner: 'SPINNERS', dasher: 'DASHERS', snake: 'SERPENTS', sniper: 'SNIPERS', tank: 'TANKS',
  splitter: 'SPLITTERS', mine: 'MINES', carrier: 'CARRIERS', shielder: 'SHIELDERS', weaver: 'WEAVERS', blinker: 'BLINKERS',
};

// Pack kinds: `need` must be in the level's roster (director foesAt). make(n) lists member types; n grows with level.
const times = (t, n) => Array.from({ length: n }, () => t);
const PACKS = [
  { need: 'dart', w: 4, make: (n) => times('dart', 4 + n) },
  { need: 'swarm', w: 3, make: (n) => times('swarm', 7 + 2 * n) },
  { need: 'splitter', w: 2, make: (n) => [...times('splitter', 2 + (n >> 1)), 'dart', 'dart'] },
  { need: 'spinner', w: 2, make: (n) => ['spinner', ...times('dart', 2 + (n >> 1))] },
  { need: 'dasher', w: 2, make: (n) => times('dasher', 3 + (n >> 1)) },
  { need: 'sniper', w: 1.6, make: (n) => [...times('sniper', 2 + (n >> 1)), 'dart'] },
  { need: 'mine', w: 1.4, make: (n) => times('mine', 7 + n) },
  { need: 'carrier', w: 1, make: () => ['carrier', 'dart', 'dart'] },
  { need: 'tank', w: 1, make: () => ['tank', ...times('swarm', 4)] },
  { need: 'shielder', w: 1.2, make: () => ['shielder', 'spinner', 'dart', 'dart', 'dart'] },
  { need: 'snake', w: 1, make: () => ['snake'] },
  { need: 'weaver', w: 1, make: () => ['weaver'] }, // spawns the linked pair
  { need: 'blinker', w: 1, make: () => ['blinker', 'blinker'] },
];

let ow = null; // current leg (also G.run.ow)
let hooks = { engage() {}, signal() {}, levelUp() {}, dead() {} };
const icons = {}; // `${type}|${color}` -> Image
const ctrl = { mode: 'dir', dx: 0, dy: 0, tx: 0, ty: 0, dash: false, od: false, focus: false, shift: null };

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

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// --- Build ------------------------------------------------------------------------------

function build(run) {
  const route = run.route;
  const sys = run.system;
  const from = run.nodeId || null;
  const leg = from || 'start';
  const rnd = mulberry32((route.seed ^ hashStr(leg) ^ 0x5f3759df) >>> 0);
  const nodes = reachableNodes(route, from).slice().sort((a, b) => a.col - b.col);
  const bossLeg = nodes.length === 1 && nodes[0].type === 'boss';
  const W = bossLeg ? 2200 : ZONE_W;
  const H = bossLeg ? 2600 : ZONE_H;
  const row = nodes[0].row;
  const level = Math.max(1, nodeLevel(sys, row) - 0.3);
  const start = { x: W * (0.35 + rnd() * 0.3), y: H - 240 };

  // Exits: the next row's nodes, left to right as on the route map, somewhere in the upper half.
  const exits = [];
  const n = nodes.length;
  nodes.forEach((node, i) => {
    let at = null;
    for (let k = 0; k < 40 && !at; k++) {
      const b0 = n === 1 ? 0.15 : i / n;
      const b1 = n === 1 ? 0.85 : (i + 1) / n;
      const x = bossLeg ? W * (0.3 + rnd() * 0.4) : 220 + (W - 440) * (b0 + rnd() * (b1 - b0));
      const y = bossLeg ? 300 : 260 + rnd() * (H * 0.5 - 260);
      if (k < 30 && exits.some((e) => dist2(x, y, e.x, e.y) < 760 * 760)) continue;
      at = { x, y };
    }
    exits.push({ id: node.id, node, x: at.x, y: at.y, seen: false });
  });
  const keep = [start, ...exits]; // spots debris and packs stay clear of

  // Debris: fields of rocks, plus a scatter of loose ones. Gaps of 70+ between rocks keep every path open.
  const rocks = [];
  const fits = (x, y, r) => x > r + 40 && x < W - r - 40 && y > r + 40 && y < H - r - 40
    && keep.every((q) => dist2(x, y, q.x, q.y) > (r + 230) * (r + 230))
    && rocks.every((o) => dist2(x, y, o.x, o.y) > (r + o.r + 70) * (r + o.r + 70));
  const addRock = (x, y, r) => {
    const pts = [];
    const m = 9 + Math.floor(rnd() * 5);
    for (let i = 0; i < m; i++) pts.push(0.82 + rnd() * 0.22);
    rocks.push({ x, y, r, pts, rot: rnd() * TAU, spin: (rnd() - 0.5) * 0.15 });
  };
  const fields = Math.round((bossLeg ? 5 : 8) + rnd() * 4);
  for (let f = 0; f < fields; f++) {
    const cx = 200 + rnd() * (W - 400);
    const cy = 200 + rnd() * (H - 400);
    const k = 3 + Math.floor(rnd() * 6);
    for (let i = 0; i < k; i++) {
      const r = 28 + rnd() * rnd() * 115;
      const a = rnd() * TAU;
      const d = rnd() * 280;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      if (fits(x, y, r)) addRock(x, y, r);
    }
  }
  for (let i = 0; i < (bossLeg ? 8 : 16); i++) {
    const r = 18 + rnd() * 30;
    const x = rnd() * W;
    const y = rnd() * H;
    if (fits(x, y, r)) addRock(x, y, r);
  }
  const open = (x, y, m) => x > 120 && x < W - 120 && y > 120 && y < H - 120 && rocks.every((o) => dist2(x, y, o.x, o.y) > (o.r + m) * (o.r + m));
  const place = (minStart, gap, taken) => {
    for (let k = 0; k < 30; k++) {
      const x = 140 + rnd() * (W - 280);
      const y = 140 + rnd() * (H - 280);
      if (!open(x, y, 90) || dist2(x, y, start.x, start.y) < minStart * minStart) continue;
      if (exits.some((e) => dist2(x, y, e.x, e.y) < 260 * 260)) continue;
      if (taken.some((q) => dist2(x, y, q.x, q.y) < gap * gap)) continue;
      return { x, y };
    }
    return null;
  };

  // Sites
  const sites = [];
  const kinds = ['wreck', 'data'];
  if (rnd() < 0.55) kinds.push('wreck');
  if (rnd() < 0.3) kinds.push('repair');
  if (rnd() < 0.35 && !bossLeg) kinds.push('signal');
  if (row >= 1 && !bossLeg) kinds.push('cache');
  for (const kind of kinds) {
    const at = place(500, 380, sites);
    if (at) sites.push({ id: `ow-${kind}-${sites.length}`, kind, x: at.x, y: at.y, done: false, seen: false, t: rnd() * 10, guard: null });
  }

  // Packs: the level's roster, more and bigger further up the route. One guards each exit, one (elite) a cache.
  const roster = foesAt(level);
  const kindsOk = PACKS.filter((k) => roster.includes(k.need));
  const pickKind = () => {
    let x = rnd() * kindsOk.reduce((a, k) => a + k.w, 0);
    for (const k of kindsOk) if ((x -= k.w) <= 0) return k;
    return kindsOk[0];
  };
  const packs = [];
  const sizeUp = Math.floor(level / 3);
  const addPack = (x, y, elite = false) => {
    const p = { id: packs.length, x, y, members: pickKind().make(sizeUp), elite, awake: false, cleared: false, alive: 0, lx: x, ly: y };
    packs.push(p);
    return p;
  };
  for (const e of exits) {
    for (let k = 0; k < 12; k++) {
      const a = Math.atan2(start.y - e.y, start.x - e.x) + (rnd() - 0.5) * 1.6;
      const d = 270 + rnd() * 140;
      const x = e.x + Math.cos(a) * d;
      const y = e.y + Math.sin(a) * d;
      if (open(x, y, 90)) {
        addPack(x, y);
        break;
      }
    }
  }
  const cache = sites.find((s) => s.kind === 'cache');
  if (cache) cache.guard = addPack(cache.x + 40, cache.y + 40, true).id;
  const count = Math.round(clamp(15 + level * 0.9 + rnd() * 4, 15, 30) * (bossLeg ? 0.65 : 1) * (row === 0 ? 0.8 : 1));
  for (let i = packs.length; i < count; i++) {
    const at = place(640, 300, [...packs, ...sites]);
    if (at) addPack(at.x, at.y);
  }

  const nebulae = [];
  for (let i = 0; i < 14; i++) nebulae.push({ x: rnd() * W, y: rnd() * H, s: 600 + rnd() * 700, h: hue() + (rnd() - 0.5) * 60, a: 0.07 + rnd() * 0.07 });
  const fc = Math.ceil(W / FOG);
  const fr = Math.ceil(H / FOG);

  return {
    leg, seed: route.seed, from, row, level, W, H, start, exits, rocks, sites, packs, nebulae, bossLeg,
    fog: new Uint8Array(fc * fr), fc, fr,
    cam: { x: start.x, y: start.y - 160 },
    spawned: false, // enemies are in G.enemies
    dest: null, // mouse destination (world)
    dwell: 0, dwellId: null, card: null,
    map: false, mapA: 0, ease: 0, t: 0, legT: 0, ambT: 9, packT: 0, busy: false, levelT: 0, hintT: 0, mouseWas: false,
  };
}

// The overworld's director stand-in: what spawnEnemy, kill rewards and credits read while flying.
function setDirector(run) {
  const d = G.director;
  const sys = run.system;
  const diff = sectorDifficulty(ow.level, 0);
  diff.credits = 1;
  diff.eliteBonus = 0;
  applyHeat(diff, { tier: run.tier || 0, deep: run.deep || 0 });
  diff.hp *= HP;
  diff.xp *= XP;
  d.diff = diff;
  d.spec = {
    index: G.sector, row: ow.row, level: ow.level, loop: 0, boss: null, elite: false, modifiers: [], hue: sys.hue, name: sys.name,
    duration: 0, pay: sys.pay, reward: null, tier: run.tier || 0, deep: run.deep || 0, overworld: true,
  };
  d.state = 'overworld';
  d.queue.length = 0;
  d.hunter = null;
  d.zones = 1;
  d.zone = null;
  d.progress = 0;
}

function spawnPacks() {
  for (const pk of ow.packs) {
    if (pk.cleared) continue;
    const list = pk.members;
    list.forEach((type, i) => {
      const a = (i / list.length) * TAU + Math.random() * 0.5;
      const d = list.length > 1 ? 45 + Math.random() * 70 : 0;
      const x = pk.x + Math.cos(a) * d;
      const y = pk.y + Math.sin(a) * d;
      const opts = { plain: true, elite: pk.elite && i === 0 };
      const made = type === 'weaver' ? spawnWeavers(x, y, 200) : [spawnEnemy(type, x, y, opts)];
      for (const e of made) {
        e.pack = pk;
        e.hx = e.x;
        e.hy = e.y;
        e.gap = 200;
      }
    });
  }
  ow.spawned = true;
}

// --- Helpers ----------------------------------------------------------------------------

function zoom() {
  return lerp(ZOOM_IN, ZOOM, easeOutCubic(clamp(ow.ease / EASE, 0, 1)));
}

const toScreen = (x, y, z = zoom()) => ({ x: (x - ow.cam.x) * z + view.W / 2, y: (y - ow.cam.y) * z + view.H / 2 });
const toWorld = (sx, sy, z = zoom()) => ({ x: (sx - view.W / 2) / z + ow.cam.x, y: (sy - view.H / 2) / z + ow.cam.y });

function syncField() {
  const z = zoom();
  field.ow = true;
  field.z = ZOOM; // labels are sized for the settled zoom, not the entry ease
  field.W = ow.W;
  field.H = ow.H;
  field.x0 = ow.cam.x - view.W / 2 / z;
  field.x1 = ow.cam.x + view.W / 2 / z;
  field.y0 = ow.cam.y - view.H / 2 / z;
  field.y1 = ow.cam.y + view.H / 2 / z;
}

// Credit unit for the zone's level (economy.js unit(), without a live sector).
function creditUnit(level) {
  return payUnit(level, (G.run.system && G.run.system.pay) || 1);
}

// Clears the fight leftovers (or the last leg's) and puts the ship's gear back around it.
function resetField(collect) {
  const p = G.player;
  if (collect) for (const pk of G.pickups) if (!pk.dead) collectPickup(pk);
  G.enemies.length = 0;
  G.pBullets.length = 0;
  G.eBullets.length = 0;
  G.pickups.length = 0;
  G.beams.length = 0;
  G.bolts.length = 0;
  G.obstacles.length = 0;
  G.particles.length = 0;
  G.texts.length = 0;
  G.boss = null;
  G.pulse = 0;
  p.vx = 0;
  p.vy = 0;
  p.ghosts.length = 0;
  const m = p.mod;
  if (m) {
    m.mines.length = 0;
    m.saws.length = 0;
    m.flaks.length = 0;
    m.wells.length = 0;
    m.prism.length = 0;
  }
  for (const d of p.drones) {
    d.x = p.x;
    d.y = p.y;
  }
}

function aliveIn(pk) {
  return pk.alive > 0;
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
    setOverworldAI(owAI);
  },

  // Show the overworld for the run's current place: a new leg (a node was just taken, or a new system) builds a fresh
  // zone with the ship at its bottom; otherwise (back from a level-up draft, an event, pause) it resumes as it was.
  enter(run) {
    const leg = run.nodeId || 'start';
    const fresh = !run.ow || run.ow.leg !== leg || run.ow.seed !== run.route.seed;
    if (fresh) run.ow = build(run);
    ow = run.ow;
    const p = G.player;
    if (fresh) {
      p.x = ow.start.x;
      p.y = ow.start.y;
      p.aim = UP;
      resetField(true);
      ow.cam.x = p.x;
      ow.cam.y = p.y - 120;
      ow.ease = 0;
      ow.hintT = 0;
    }
    setDirector(run);
    syncField();
    if (!ow.spawned) spawnPacks();
    G.scriptCtrl = ctrlFn;
    ow.busy = false;
    ow.dwell = 0;
    ow.dest = null;
    ow.levelT = 0.35;
    ow.mouseWas = input.mouseDown;
    input.ox = 0;
    input.oy = 0;
    input.holding = false;
  },

  // Leaving for a fight: the ship goes back to its spot in the fight playfield, facing up, with the field cleared.
  leave() {
    const p = G.player;
    this.exit();
    p.x = view.W / 2;
    p.y = view.H * 0.78;
    p.aim = UP;
    resetField(true);
    if (ow) ow.map = false;
  },

  // Out of the overworld (into a fight, or the run ended): the fight systems go back to the screen playfield.
  exit() {
    field.ow = false;
    if (G.scriptCtrl === ctrlFn) G.scriptCtrl = null;
    if (G.player) G.player.aim = UP;
  },

  toggleMap() {
    if (!ow) return;
    ow.map = !ow.map;
    sfx.ui();
  },

  // The ship's screen position (touch steering anchors on it).
  anchor() {
    return ow && G.player ? toScreen(G.player.x, G.player.y) : { x: view.W / 2, y: view.H / 2 };
  },

  // Debug: put the ship at world x, y or on exit / node id.
  warp(x, y) {
    if (!ow) return;
    if (typeof x === 'string') {
      const e = ow.exits.find((q) => q.id === x);
      if (!e) return;
      ({ x, y } = e);
    }
    const p = G.player;
    Object.assign(p, { x, y, vx: 0, vy: 0 });
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

    if (!p.dead) {
      ow.legT += dt;
      control(p, dt);
    }
    G.scriptCtrl = ctrlFn;
    let left = dt;
    while (left > 0) {
      const s = Math.min(left, 1 / 60);
      camera(s);
      syncField();
      step(s, true);
      solids(p);
      left -= s;
    }
    reveal(p);
    if (p.dead) {
      G.deathT -= raw;
      if (G.deathT <= 0 && !ow.busy) {
        ow.busy = true;
        hooks.dead();
      }
      return;
    }
    packs(dt);
    ambient(dt);
    if (ow.busy) return;
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

const ctrlFn = () => ctrl;

// --- Update -----------------------------------------------------------------------------

// Reads the input into `ctrl` (player.js control() returns it through G.scriptCtrl) and turns the ship's facing.
function control(p, dt) {
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
      const a = toScreen(p.x, p.y);
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
    // Diablo style: click or hold the left button to fly to the cursor. The click itself is not a dash.
    if (input.mouseDown) ow.dest = toWorld(input.tx, input.ty);
    if (input.mouseDown && !ow.mouseWas) input.consume('dash');
    if (ow.dest) {
      const vx = ow.dest.x - p.x;
      const vy = ow.dest.y - p.y;
      const d = Math.hypot(vx, vy);
      if (d < 10) ow.dest = null;
      else {
        const m = Math.min(1, d / 70);
        dx = (vx / d) * m;
        dy = (vy / d) * m;
      }
    }
  }
  ow.mouseWas = input.mouseDown;
  // Space / A is both dash and confirm: inside an exit it takes the exit instead of dashing.
  const dash = input.consume('dash');
  ctrl.mode = 'dir';
  ctrl.dx = dx;
  ctrl.dy = dy;
  ctrl.dash = dash && !(conf && ow.dwellId);
  ctrl.od = input.consume('od');
  ctrl.focus = false; // Shift strafes out here instead of slowing the ship

  // Facing: the right stick aims; with a mouse Shift aims at the cursor. Otherwise the ship turns to the nearest awake
  // enemy in range (it keeps flying wherever you steer) and Shift locks onto that target until it dies or gets away.
  // With nothing to aim at it faces the flight, and Shift holds the facing.
  const hold = input.down('focus');
  const stick = !!(input.aimX || input.aimY);
  const cursor = hold && input.device === 'mouse';
  pickTarget(p, hold && !cursor);
  const t = stick || cursor ? null : ow.lock || ow.target;
  let want = null;
  if (stick) want = Math.atan2(input.aimY, input.aimX);
  else if (cursor) {
    const c = toWorld(input.tx, input.ty);
    if (dist2(c.x, c.y, p.x, p.y) > 20 * 20) want = Math.atan2(c.y - p.y, c.x - p.x);
  } else if (t) want = Math.atan2(t.y - p.y, t.x - p.x);
  else if (!hold && Math.hypot(dx, dy) > 0.15) want = Math.atan2(dy, dx);
  ow.aimAt = t;
  ow.strafe = hold || stick || !!t;
  if (want !== null) p.aim = turnToward(p.aim, want, (ow.strafe ? 16 : 9) * dt);
}

// Auto-aim targets: visible, live enemies. Asleep packs are skipped (the gun would wake them) unless Shift locks on.
const aimable = (e) => !e.dead && !(e.alpha < 0.6);
function nearestFoe(p, r, sleepers) {
  let best = null;
  let bd = r * r;
  for (const e of G.enemies) {
    if (!aimable(e) || (!sleepers && e.pack && !e.pack.awake)) continue;
    const d = dist2(e.x, e.y, p.x, p.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

function pickTarget(p, lock) {
  const keep = (e, r) => e && aimable(e) && G.enemies.includes(e) && dist2(e.x, e.y, p.x, p.y) < r * r;
  if (!lock) ow.lock = null;
  else if (!keep(ow.lock, LOCK_R)) ow.lock = keep(ow.target, AIM_R) ? ow.target : nearestFoe(p, AIM_R, true);
  if (ow.lock) {
    ow.target = ow.lock;
    return;
  }
  // Stay on the current target unless another is clearly closer, so the nose doesn't flick between two.
  const best = nearestFoe(p, AIM_R, false);
  const cur = keep(ow.target, AIM_R) && !(ow.target.pack && !ow.target.pack.awake) ? ow.target : null;
  if (!cur || (best && dist2(best.x, best.y, p.x, p.y) < dist2(cur.x, cur.y, p.x, p.y) * 0.6)) ow.target = best;
}

function camera(dt) {
  const p = G.player;
  const z = zoom();
  const hw = view.W / 2 / z;
  const hh = view.H / 2 / z;
  // Lead a little ahead of the ship and along its facing.
  let tx = p.x + p.vx * 0.25 + Math.cos(p.aim) * 50;
  let ty = p.y + p.vy * 0.25 + Math.sin(p.aim) * 50;
  tx = clamp(tx, hw - 80, ow.W - hw + 80);
  ty = clamp(ty, hh - 80, ow.H - hh + 80);
  ow.cam.x = damp(ow.cam.x, tx, 4.5, dt);
  ow.cam.y = damp(ow.cam.y, ty, 4.5, dt);
}

// Rocks near the camera (all collision work only looks at these).
let near = [];
function nearRocks(m) {
  near = ow.rocks.filter((r) => inField(r.x, r.y, r.r + m));
  return near;
}

function pushOut(o, r0) {
  for (const k of near) {
    const R = k.r * 0.92 + r0;
    const dx = o.x - k.x;
    const dy = o.y - k.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R * R || d2 === 0) continue;
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const ny = dy / d;
    o.x = k.x + nx * R;
    o.y = k.y + ny * R;
    const vn = (o.vx || 0) * nx + (o.vy || 0) * ny;
    if (vn < 0 && o.vx !== undefined) {
      o.vx -= vn * nx;
      o.vy -= vn * ny;
    }
  }
}

const inRock = (x, y, m = 0) => near.some((k) => dist2(x, y, k.x, k.y) < (k.r * 0.92 + m) * (k.r * 0.92 + m));

// Debris against the ship, enemies, shots and pickups; enemies also keep a little space between them.
function solids(p) {
  nearRocks(300);
  if (!p.dead) pushOut(p, 10);
  const awake = [];
  for (const e of G.enemies) {
    if (e.dead || e.boss || !inField(e.x, e.y, 300)) continue;
    if (!e.parts) pushOut(e, e.r * 0.8);
    if (e.ow && e.state !== 'dash') awake.push(e);
  }
  for (let i = 0; i < awake.length; i++) {
    const a = awake[i];
    for (let j = i + 1; j < awake.length; j++) {
      const b = awake[j];
      const R = (a.r + b.r) * 0.8;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= R * R || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (R - d) * 0.5;
      a.x -= (dx / d) * push;
      a.y -= (dy / d) * push;
      b.x += (dx / d) * push;
      b.y += (dy / d) * push;
    }
  }
  if (!near.length) return;
  for (const b of G.pBullets) {
    if (!b.dead && inRock(b.x, b.y, b.r)) {
      b.dead = true;
      sparks(b.x, b.y, '#ffffff', 2, 120);
    }
  }
  for (const b of G.eBullets) if (!b.dead && b.delay <= 0 && inRock(b.x, b.y, b.r)) b.dead = true;
  for (const pk of G.pickups) if (!pk.dead) pushOut(pk, 6);
}

// Map fog: cells around the ship are uncovered.
function reveal(p) {
  const r = Math.ceil(FOG_R / FOG);
  const cx = Math.floor(p.x / FOG);
  const cy = Math.floor(p.y / FOG);
  for (let y = Math.max(0, cy - r); y <= Math.min(ow.fr - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x <= Math.min(ow.fc - 1, cx + r); x++) {
      if (dist2((x + 0.5) * FOG, (y + 0.5) * FOG, p.x, p.y) < FOG_R * FOG_R) ow.fog[y * ow.fc + x] = 1;
    }
  }
}
const seenAt = (x, y) => !!ow.fog[clamp(Math.floor(y / FOG), 0, ow.fr - 1) * ow.fc + clamp(Math.floor(x / FOG), 0, ow.fc - 1)];

// Packs: wake / leash, and a clear bonus when the last member falls.
function packs(dt) {
  const p = G.player;
  for (const pk of ow.packs) {
    if (pk.cleared) continue;
    const d2 = dist2(p.x, p.y, pk.lx, pk.ly);
    if (!pk.awake && d2 < AGGRO * AGGRO) wake(pk);
    else if (pk.awake && d2 > LEASH * LEASH) pk.awake = false;
  }
  if ((ow.packT -= dt) > 0) return;
  ow.packT = 0.2;
  for (const pk of ow.packs) {
    pk.alive = 0;
    pk.sx = 0;
    pk.sy = 0;
  }
  for (const e of G.enemies) {
    const pk = e.pack;
    if (!pk || e.dead) continue;
    pk.alive++;
    pk.sx += e.x;
    pk.sy += e.y;
  }
  for (const pk of ow.packs) {
    if (pk.cleared) continue;
    if (aliveIn(pk)) {
      pk.lx = pk.sx / pk.alive;
      pk.ly = pk.sy / pk.alive;
      continue;
    }
    pk.cleared = true;
    pk.awake = false;
    const n = Math.round(creditUnit(ow.level) * (2 + pk.members.length * 0.5) * (pk.elite ? 3 : 1));
    for (let i = 0; i < 4; i++) dropCredit(pk.lx, pk.ly, n / 4);
    floatText(pk.lx, pk.ly - 40, pk.elite ? 'GUARDS DOWN' : 'PACK CLEARED', pk.elite ? '#ff3df2' : '#ffd24a', 12, 1.4);
    sfx.levelUp();
  }
}

function wake(pk) {
  if (pk.awake || pk.cleared) return;
  pk.awake = true;
  floatText(pk.lx, pk.ly - 60, pk.elite ? 'ELITE GUARDS' : 'HOSTILES', '#ff4d6d', 11, 1.1);
  sfx.select();
}

// Stragglers: small groups roam in from off screen, more often the longer the leg takes.
function ambient(dt) {
  if ((ow.ambT -= dt) > 0) return;
  ow.ambT = Math.max(3.5, 9 - ow.legT / 25) * (0.8 + Math.random() * 0.4);
  let n = 0;
  for (const e of G.enemies) if (!e.dead && e.ow && !e.pack) n++;
  if (n > 10 + ow.level) return;
  const p = G.player;
  const roster = foesAt(ow.level);
  const type = roster.includes('swarm') && Math.random() < 0.6 ? 'swarm' : 'dart';
  const count = type === 'swarm' ? 5 + Math.floor(ow.level / 2) : 3 + Math.floor(ow.level / 4);
  const R = Math.hypot(field.x1 - field.x0, field.y1 - field.y0) / 2 + 90;
  for (let k = 0; k < 10; k++) {
    const a = Math.random() * TAU;
    const x = p.x + Math.cos(a) * R;
    const y = p.y + Math.sin(a) * R;
    if (x < 60 || x > ow.W - 60 || y < 60 || y > ow.H - 60) continue;
    if (ow.rocks.some((r) => dist2(x, y, r.x, r.y) < (r.r + 60) * (r.r + 60))) continue;
    for (let i = 0; i < count; i++) {
      const e = spawnEnemy(type, x + rand(-50, 50), y + rand(-50, 50), { plain: true });
      e.pack = null;
    }
    return;
  }
}

// Exits and sites: found when close, taken / collected when the ship is on them.
function interact(p, dt) {
  let target = null;
  let card = null;
  let cd = 700 * 700;
  for (const e of ow.exits) {
    const d2 = dist2(p.x, p.y, e.x, e.y);
    if (!e.seen && (d2 < SEE * SEE || inField(e.x, e.y, -30))) {
      e.seen = true;
      const info = NODE_TYPES[e.node.type];
      floatText(e.x, e.y - 70, `EXIT FOUND · ${info.name}`, info.color, 12, 1.8);
      sfx.select();
    }
    if (e.seen && d2 < cd) {
      cd = d2;
      card = e;
    }
    if (d2 < ENGAGE_R * ENGAGE_R) target = { id: e.id, node: e.node };
  }
  ow.card = card;
  for (const site of ow.sites) {
    if (site.done) continue;
    const d2 = dist2(p.x, p.y, site.x, site.y);
    if (!site.seen && (d2 < SEE * SEE || inField(site.x, site.y, -30))) site.seen = true;
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
  const def = SITES[site.kind];
  if (site.kind === 'cache') {
    const g = ow.packs[site.guard];
    if (g && !g.cleared) {
      if ((site.warnT || 0) <= ow.t) {
        site.warnT = ow.t + 2;
        floatText(site.x, site.y - 34, 'CLEAR THE GUARDS FIRST', def.color, 12, 1.2);
        if (g) wake(g);
      }
      return;
    }
  }
  site.done = true;
  explosion(site.x, site.y, def.color, 1.1);
  const lvl = ow.level;
  if (site.kind === 'wreck') {
    const n = gainCredits(Math.round(creditUnit(lvl) * 8));
    floatText(site.x, site.y - 30, `SALVAGE +${n}`, def.color, 13, 1.4);
    sfx.coin();
  } else if (site.kind === 'data') {
    gainXp(p, p.xpNeed * 0.3);
    floatText(site.x, site.y - 30, 'DATA DECRYPTED +XP', def.color, 13, 1.4);
    sfx.pickup();
  } else if (site.kind === 'cache') {
    const n = gainCredits(Math.round(creditUnit(lvl) * 18));
    gainXp(p, p.xpNeed * 0.4);
    floatText(site.x, site.y - 30, `CACHE +${n} · +XP`, def.color, 13, 1.6);
    sfx.coin();
  } else if (site.kind === 'repair') {
    if (p.hp < p.maxHp) {
      p.hp++;
      floatText(site.x, site.y - 30, '+1 HULL', def.color, 13, 1.4);
    } else {
      gainXp(p, p.xpNeed * 0.2);
      floatText(site.x, site.y - 30, 'HULL FULL · +XP', def.color, 13, 1.4);
    }
    sfx.heal();
  }
}

// --- Enemy AI (overworld) ---------------------------------------------------------------
// The levels' enemy types, re-cut for open space: they sleep near their pack's home until it wakes, then chase,
// keep range, telegraph and shoot at the ship. Firing needs the enemy on camera (e.entered).

function seek(e, tx, ty, speed, dt, k = 4) {
  const mx = tx - e.x;
  const my = ty - e.y;
  const md = Math.hypot(mx, my) || 1;
  const v = Math.min(speed, md * 3);
  e.vx = damp(e.vx, (mx / md) * v, k, dt);
  e.vy = damp(e.vy, (my / md) * v, k, dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

// Hold a distance band from the ship, circling it a little.
function hover(e, d, dx, dy, lo, hi, speed, dt) {
  const k = d > hi ? 1 : d < lo ? -1 : 0;
  const s = e.ph > Math.PI ? 1 : -1;
  seek(e, e.x + (dx / d) * 80 * k - (dy / d) * 40 * s, e.y + (dy / d) * 80 * k + (dx / d) * 40 * s, speed, dt, 3);
}

const faceMove = (e) => (e.rot = Math.atan2(e.vy, e.vx) - Math.PI / 2);

function owAI(e, dt) {
  const p = G.player;
  const pk = e.pack;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d2 = dx * dx + dy * dy;
  const awake = pk ? pk.awake : true;
  if (!pk && d2 > 1800 * 1800) {
    e.dead = true; // a straggler left behind
    return;
  }
  if (!awake && d2 > WAKE * WAKE) {
    e.entered = false;
    return;
  }
  e.entered = inField(e.x, e.y, 40);
  if (pk && !awake && e.flash > 0) wake(pk); // shot while asleep
  const d = Math.sqrt(d2) || 1;
  const fr = G.director.diff.fireRate;
  const fire = (cd) => {
    e.fireT -= dt * fr;
    if (e.fireT > 0 || !e.entered) return false;
    e.fireT = cd;
    return true;
  };
  e.x = clamp(e.x, 30, ow.W - 30);
  e.y = clamp(e.y, 30, ow.H - 30);

  if (!awake) {
    // Asleep: drift around home.
    if (e.type === 'blinker') e.alpha = 1;
    if (e.type === 'mine' || e.type === 'weaver') {
      e.rot += dt * 1.2;
      if (e.type === 'weaver') weaverBeam(e);
      return;
    }
    const a = e.t * 0.4 + e.ph;
    seek(e, e.hx + Math.cos(a) * 30, e.hy + Math.sin(a) * 30, 40, dt, 2);
    if (e.type === 'snake') snakeBody(e);
    else if (e.type === 'dart' || e.type === 'swarm' || e.type === 'dasher') faceMove(e);
    else e.rot += dt;
    if (e.type === 'shielder' && (e.linkT = (e.linkT || 0) - dt) <= 0) {
      e.linkT = 0.35;
      relink(e);
    }
    return;
  }

  switch (e.type) {
    case 'dart':
      seek(e, p.x, p.y, 175, dt);
      faceMove(e);
      if (d < 460 && fire(2.6)) shoot(e.x, e.y, aimAt(e.x, e.y), 175, 'small');
      break;
    case 'swarm':
      seek(e, p.x + Math.sin(e.t * 3 + e.ph) * 40, p.y + Math.cos(e.t * 3 + e.ph) * 40, 215, dt, 3);
      faceMove(e);
      break;
    case 'splitter':
      seek(e, p.x, p.y, 105, dt);
      e.rot += dt * 2;
      break;
    case 'dasher':
      if (e.state === 'tele') {
        e.timer -= dt;
        if (e.timer > 0.2) e.aim = Math.atan2(dy, dx);
        e.rot = e.aim - Math.PI / 2;
        e.vx *= 1 - 6 * dt;
        e.vy *= 1 - 6 * dt;
        if (e.timer <= 0) {
          e.state = 'dash';
          e.timer = 0.5;
          e.vx = Math.cos(e.aim) * 640;
          e.vy = Math.sin(e.aim) * 640;
        }
      } else if (e.state === 'dash') {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (G.particles.length < 500 && Math.random() < 0.6) sparks(e.x, e.y, e.color, 1, 60);
        if ((e.timer -= dt) <= 0) {
          e.state = 'move';
          e.cd = 1.1;
          e.vx *= 0.2;
          e.vy *= 0.2;
        }
      } else {
        e.cd = (e.cd || 0) - dt;
        hover(e, d, dx, dy, 200, 280, 160, dt);
        e.rot = Math.atan2(dy, dx) - Math.PI / 2;
        if (e.cd <= 0 && d < 330 && e.entered) {
          e.state = 'tele';
          e.timer = 0.75;
          e.aim = Math.atan2(dy, dx);
        }
      }
      break;
    case 'sniper':
      if (e.state === 'aim') {
        e.timer -= dt;
        e.vx *= 1 - 5 * dt;
        e.vy *= 1 - 5 * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.timer > 0.28) e.aim = Math.atan2(dy, dx);
        if (e.timer <= 0) {
          shoot(e.x, e.y, e.aim, 300, 'needle', { acc: 500, maxSpeed: 620 });
          if (e.elite) fan(e.x, e.y, e.aim, 3, 0.35, 280, 'needle', { acc: 400, maxSpeed: 560 });
          sparks(e.x, e.y, e.color, 8, 200, e.aim, 0.7);
          e.state = 'move';
          e.fireT = 1.5;
        }
      } else {
        hover(e, d, dx, dy, 300, 400, 125, dt);
        if (fire(1.5)) {
          e.state = 'aim';
          e.timer = 1.15 / Math.sqrt(fr);
          e.aim = Math.atan2(dy, dx);
          e.fireT = 0;
        }
      }
      e.rot += dt;
      break;
    case 'spinner':
      hover(e, d, dx, dy, 200, 280, 60, dt);
      e.rot += dt * 1.6;
      if (fire(2.3)) {
        ring(e.x, e.y, 8 + Math.min(6, Math.floor(ow.level / 2)) + (e.elite ? 4 : 0), 125, 'orb', e.t * 0.7);
        sparks(e.x, e.y, e.color, 6, 160);
      }
      break;
    case 'tank':
      hover(e, d, dx, dy, 240, 320, 45, dt);
      e.rot += dt * 0.4;
      if (e.entered) {
        e.fireT -= dt * fr;
        if (e.fireT <= 0) {
          e.fireT = 0.11;
          e.burst = (e.burst || 0) + 1;
          const a = e.t * 2.2;
          const arms = e.elite ? 4 : 3;
          for (let i = 0; i < arms; i++) shoot(e.x, e.y, a + (i / arms) * TAU, 120, 'orb');
          if (e.burst >= 18) {
            e.burst = 0;
            e.fireT = 1.8;
            fan(e.x, e.y, aimAt(e.x, e.y), 5, 0.7, 150, 'big');
          }
        }
      }
      break;
    case 'carrier':
      hover(e, d, dx, dy, 280, 380, 40, dt);
      e.rot = Math.sin(e.t * 0.6) * 0.15;
      if (e.entered) {
        e.fireT -= dt * Math.sqrt(fr);
        if (e.fireT < 0.5) e.flash = Math.sin(e.t * 45) > 0 ? 0.05 : 0; // bay-open warning
        if (e.fireT <= 0) {
          e.fireT = 3.8;
          for (let i = -1; i <= 1; i++) {
            const pod = spawnEnemy('swarm', e.x + i * 12, e.y + 18, { plain: true, vx: i * 120 + dx / d * 160, vy: dy / d * 160 });
            pod.pack = null;
          }
          sparks(e.x, e.y, e.color, 10, 190);
          sfx.zap();
        }
      }
      break;
    case 'shielder':
      // Stays with its pack, a little behind it, and tethers shields to the nearest members.
      seek(e, (pk ? pk.lx : e.x) - (dx / d) * 90, (pk ? pk.ly : e.y) - (dy / d) * 90, 90, dt, 2);
      e.rot += dt * 1.1;
      if ((e.linkT = (e.linkT || 0) - dt) <= 0) {
        e.linkT = 0.35;
        relink(e);
      }
      if (fire(3)) fan(e.x, e.y, aimAt(e.x, e.y), 3, 0.5, 125, 'small');
      break;
    case 'weaver': {
      // The pair sweeps at the ship side by side, the tripwire strung between them.
      const o = e.partner && !e.partner.dead ? e.partner : null;
      const mx = o ? (e.x + o.x) / 2 : e.x;
      const my = o ? (e.y + o.y) / 2 : e.y;
      const ux = p.x - mx;
      const uy = p.y - my;
      const ud = Math.hypot(ux, uy) || 1;
      const side = e.lead ? 1 : -1;
      const gap = o ? e.gap / 2 : 0;
      seek(e, mx + (ux / ud) * 60 - (uy / ud) * gap * side, my + (uy / ud) * 60 + (ux / ud) * gap * side, 75, dt, 2);
      e.rot += dt * 2.4;
      weaverBeam(e);
      break;
    }
    case 'blinker':
      blinker(e, p, dt);
      break;
    case 'snake':
      seek(e, p.x + Math.sin(e.t * 1.5 + e.ph) * 90, p.y + Math.cos(e.t * 1.5 + e.ph) * 90, 95, dt, 2);
      snakeBody(e);
      if (fire(1.9)) fan(e.x, e.y, aimAt(e.x, e.y), 3, 0.5, 120, 'wobble', { wob: 22, wobF: 5 });
      break;
    case 'mine':
      e.rot += dt * 2;
      if (e.state === 'arm') {
        e.timer -= dt;
        e.flash = Math.sin(e.timer * 40) > 0 ? 0.05 : 0;
        if (e.timer <= 0) {
          ring(e.x, e.y, 10 + (e.elite ? 6 : 0), 140, 'small', Math.random() * TAU);
          explosion(e.x, e.y, e.color, 0.8);
          e.dead = true;
        }
      } else if (d < 130) {
        e.state = 'arm';
        e.timer = 0.75;
      }
      break;
    default:
      seek(e, p.x, p.y, 120, dt);
  }
}

// Blinker: fade in, telegraph, ring burst, fade out and reappear near the ship; repeats while its pack is awake.
function blinker(e, p, dt) {
  e.rot += dt * 1.6;
  if (e.state === 'idle') {
    e.state = 'out';
    e.alpha = 1;
  }
  if (e.state === 'in') {
    e.alpha = Math.min(1, (e.alpha || 0) + dt * 4);
    e.invuln = e.alpha < 0.7;
    if (e.alpha >= 1) {
      e.state = 'tele';
      e.timer = 0.5;
    }
  } else if (e.state === 'tele') {
    e.timer -= dt;
    if (e.timer <= 0) {
      ring(e.x, e.y, Math.min(14, 10 + Math.floor(ow.level / 3) + (e.elite ? 2 : 0)), 120, 'orb', Math.random() * TAU);
      sparks(e.x, e.y, e.color, 8, 180);
      sfx.zap();
      e.state = 'rest';
      e.timer = 0.9;
    }
  } else if (e.state === 'rest') {
    e.timer -= dt;
    if (e.timer <= 0) {
      e.state = 'out';
      sparks(e.x, e.y, e.color, 12, 200);
    }
  } else {
    e.alpha = Math.max(0, e.alpha - dt * 5);
    e.invuln = e.alpha < 0.7;
    if (e.alpha <= 0) {
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * TAU;
        const r = 160 + Math.random() * 100;
        const x = p.x + Math.cos(a) * r;
        const y = p.y + Math.sin(a) * r;
        if (x < 40 || x > ow.W - 40 || y < 40 || y > ow.H - 40 || inRock(x, y, 30)) continue;
        e.x = x;
        e.y = y;
        break;
      }
      e.state = 'in';
      sparks(e.x, e.y, e.color, 12, 200);
    }
  }
}

// --- Draw: world ------------------------------------------------------------------------

function drawWorld(ctx, k) {
  const z = zoom();
  const h = hue();
  const W = view.W;
  const H = view.H;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = '#05030d';
  ctx.fillRect(0, 0, W, H);
  drawStars(ctx, z, h);

  // World transform. view.ox / oy carry the screen shake; the fight renderer reads them for its own transforms.
  const sx = view.ox;
  const sy = view.oy;
  const kz = k * z;
  view.ox = (W / 2 - ow.cam.x * z) * k + sx;
  view.oy = (H / 2 - ow.cam.y * z) * k + sy;
  ctx.setTransform(kz, 0, 0, kz, view.ox, view.oy);
  const vis = (x, y, m = 0) => inField(x, y, m + 60);

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
  const vx0 = field.x0 - 60;
  const vx1 = field.x1 + 60;
  const vy0 = field.y0 - 60;
  const vy1 = field.y1 + 60;
  ctx.lineWidth = 1 / z;
  const bp = beat.pulse; // music beat, cosmetic only
  for (const major of [false, true]) {
    const st = major ? G0 * 5 : G0;
    ctx.strokeStyle = hsl(h, 62, major ? 0.13 + bp * 0.14 : 0.055 + bp * 0.05);
    ctx.beginPath();
    for (let x = Math.max(0, Math.ceil(vx0 / st) * st); x <= Math.min(ow.W, vx1); x += st) {
      ctx.moveTo(x, Math.max(0, vy0));
      ctx.lineTo(x, Math.min(ow.H, vy1));
    }
    for (let y = Math.max(0, Math.ceil(vy0 / st) * st); y <= Math.min(ow.H, vy1); y += st) {
      ctx.moveTo(Math.max(0, vx0), y);
      ctx.lineTo(Math.min(ow.W, vx1), y);
    }
    ctx.stroke();
  }
  // Zone edge
  ctx.strokeStyle = hsl(h, 65, 0.45);
  ctx.lineWidth = 2 / z;
  ctx.strokeRect(0, 0, ow.W, ow.H);

  drawRocks(ctx, vis, h);
  drawStart(ctx, vis);
  drawSites(ctx, vis);
  for (const e of ow.exits) if (vis(e.x, e.y, 160)) drawExit(ctx, e);

  // The fight renderer: pickups, enemies, beams, shots, modules, the ship, particles, labels.
  renderWorld(ctx, kz);
  drawTarget(ctx, z, h);

  view.ox = sx;
  view.oy = sy;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
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

function rockPath(ctx, r) {
  const n = r.pts.length;
  const a0 = r.rot + ow.t * r.spin;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    const rr = r.r * r.pts[i];
    if (i) ctx.lineTo(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr);
    else ctx.moveTo(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

// Auto-aim target: a thin square; a Shift lock is brighter with a second square that tightens in.
function drawTarget(ctx, z, h) {
  const p = G.player;
  const e = ow.aimAt;
  if (!e || p.dead || !aimable(e)) return;
  const s = e.r + 9;
  ctx.lineWidth = 1.5 / z;
  if (ow.lock === e) {
    const q = (G.time * 2) % 1;
    ctx.strokeStyle = hsl(h, 80, 0.95);
    ctx.strokeRect(e.x - s, e.y - s, s * 2, s * 2);
    const s2 = s + 10 * (1 - q);
    ctx.strokeStyle = hsl(h, 70, 0.5 * q);
    ctx.strokeRect(e.x - s2, e.y - s2, s2 * 2, s2 * 2);
  } else {
    ctx.strokeStyle = hsl(h, 70, 0.4);
    ctx.strokeRect(e.x - s, e.y - s, s * 2, s * 2);
  }
}

function drawRocks(ctx, vis, h) {
  ctx.lineJoin = 'round';
  for (const r of ow.rocks) {
    if (!vis(r.x, r.y, r.r)) continue;
    rockPath(ctx, r);
    ctx.fillStyle = 'rgba(8,5,20,0.92)';
    ctx.fill();
    ctx.strokeStyle = hsl(h, 62, 0.55);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = hsl(h, 70, 0.14);
    ctx.lineWidth = 7;
    ctx.stroke();
  }
}

// Where the ship came in: the node just cleared (or the system's entry).
function drawStart(ctx, vis) {
  const q = ow.start;
  if (!vis(q.x, q.y, 80)) return;
  const node = ow.from && G.run.route.nodes.find((n) => n.id === ow.from);
  const col = node ? NODE_TYPES[node.type].color : hsl(hue(), 70);
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.strokeRect(q.x - 22, q.y - 22, 44, 44);
  const ic = icon(node ? 'check' : 'combat', node ? '#ffffff' : col);
  if (ic.complete) ctx.drawImage(ic, q.x - 12, q.y - 12, 24, 24);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `700 ${12 / ZOOM}px ${FONT2}`;
  ctx.fillStyle = col;
  ctx.fillText(node ? `${NODE_TYPES[node.type].name} · CLEARED` : 'SYSTEM ENTRY', q.x, q.y + 32);
  ctx.globalAlpha = 1;
}

function drawExit(ctx, e) {
  const n = e.node;
  const info = NODE_TYPES[n.type];
  const boss = n.type === 'boss';
  const col = info.color;
  const pulse = 0.5 + Math.sin(ow.t * 3 + e.x) * 0.5;
  // Light column: a tall soft glow, so an exit reads from the edge of the screen.
  ctx.globalCompositeOperation = 'lighter';
  const g = glow(col, 64);
  const gs = (boss ? 300 : 210) * (1 + pulse * 0.12);
  ctx.globalAlpha = 0.45;
  ctx.drawImage(g.img, e.x - gs / 2, e.y - gs / 2, gs, gs);
  ctx.globalAlpha = 0.18;
  ctx.drawImage(g.img, e.x - gs * 0.25, e.y - gs * 1.6, gs * 0.5, gs * 1.6);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // Square frame, a breathing outer square and the engage ring (fills while you hold inside)
  const half = boss ? 34 : 26;
  ctx.fillStyle = 'rgba(5,3,13,0.75)';
  ctx.fillRect(e.x - half, e.y - half, half * 2, half * 2);
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(e.x - half, e.y - half, half * 2, half * 2);
  const o = half + 8 + pulse * 5;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(e.x - o, e.y - o, o * 2, o * 2);
  ctx.globalAlpha = 0.5;
  ctx.setLineDash([8, 10]);
  ctx.lineDashOffset = -ow.t * 20;
  ctx.beginPath();
  ctx.arc(e.x, e.y, ENGAGE_R + 6, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  if (ow.dwellId === e.id && ow.dwell > 0) {
    ctx.globalAlpha = 1;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, ENGAGE_R + 6, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(ow.dwell / DWELL, 0, 1));
    ctx.stroke();
  }
  const ic = icon(n.type, col);
  const is = boss ? 36 : 28;
  ctx.globalAlpha = 1;
  if (ic.complete) ctx.drawImage(ic, e.x - is / 2, e.y - is / 2, is, is);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `700 ${(boss ? 15 : 13) / ZOOM}px ${FONT}`;
  ctx.fillStyle = col;
  const ly = e.y + half + 12;
  ctx.fillText(boss ? `${info.name} · ${bossById(G.run.system.boss).name}` : n.mini ? `${info.name} · ${miniById(n.mini).name}` : info.name, e.x, ly);
  const rw = n.reward ? REWARDS[n.reward] : null;
  const subs = [];
  if (rw) subs.push([rw.name, rw.color]);
  for (const m of n.modifiers) if (MODIFIERS[m]) subs.push([MODIFIERS[m].name, MODIFIERS[m].color]);
  ctx.font = `700 ${13 / ZOOM}px ${FONT2}`;
  subs.forEach(([t, c], i) => {
    ctx.fillStyle = c;
    ctx.fillText(t, e.x, ly + 22 + i * 18);
  });
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

// --- Draw: HUD, exit card and map overlay -------------------------------------------------

function text(ctx, str, x, y, size, color, align = 'left', weight = 700, font = FONT) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// Text cut to a width with an ellipsis (the card never grows or wraps).
function fitText(ctx, str, w) {
  if (ctx.measureText(str).width <= w) return str;
  while (str.length > 1 && ctx.measureText(str + '…').width > w) str = str.slice(0, -1);
  return str + '…';
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

  // Top scrim, so bullets and the world don't run through the readouts
  const grd = ctx.createLinearGradient(0, 0, 0, top + 72);
  grd.addColorStop(0, 'rgba(3,2,10,0.85)');
  grd.addColorStop(0.65, 'rgba(3,2,10,0.65)');
  grd.addColorStop(1, 'rgba(3,2,10,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, top + 72);

  // Left zone (x 12-140; the centre text starts past it): hull, then LV + XP, then credits
  drawHull(ctx, 12, top + 19, 128, p, 1, 18, 17);
  text(ctx, `LV ${p.level}`, 14, top + 40, 11, '#3ff6ff');
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(60, top + 37, 76, 5);
  ctx.fillStyle = '#3ff6ff';
  ctx.fillRect(60, top + 37, 76 * clamp(p.xp / p.xpNeed, 0, 1), 5);
  ctx.font = `700 11px ${FONT}`;
  text(ctx, fitText(ctx, `${Math.floor(run.wallet || 0).toLocaleString()} CR`, 126), 14, top + 56, 11, '#ffd24a');

  // System, route position and exits found
  const total = run.route.rows.length;
  const next = ow.row;
  text(ctx, run.deep ? `DEEP ${run.deep} · ${run.system.short}` : run.system.name, W / 2, top + 20, 12, hsl(hue(), 72), 'center', 900);
  text(ctx, next >= total - 1 ? 'BOSS SECTOR NEXT' : `SECTOR ${next + 1} · ${total - 1 - next} TO THE BOSS`, W / 2, top + 37, 12, 'rgba(255,255,255,0.7)', 'center', 700, FONT2);
  const found = ow.exits.filter((e) => e.seen).length;
  text(ctx, `EXITS FOUND ${found} / ${ow.exits.length}`, W / 2, top + 54, 12, found ? '#ffffff' : 'rgba(255,255,255,0.55)', 'center', 700, FONT2);

  if (live) drawArrows(ctx);

  const sp = toScreen(p.x, p.y);
  if (ow.mapA < 0.5) {
    drawGauges(ctx, sp.x, sp.y);
    drawCard(ctx, live);
  }
  if (ow.mapA > 0.01) drawMap(ctx, ow.mapA);
}

// Threat pips (1-5) for a node, from its level within the system (elites +1, the boss 5).
function threat(n) {
  if (n.type === 'boss') return 5;
  const sys = G.run.system;
  const t = (n.row / Math.max(1, sys.rows - 1)) * 3 + 1 + (n.type === 'elite' || n.mini ? 1 : 0);
  return clamp(Math.round(t), 1, 5);
}

// The exit card: what a node holds, shown for the nearest exit found (fixed size, so nothing shifts).
function drawCard(ctx, live) {
  const W = view.W;
  const H = view.H;
  const bw = W - 24;
  const bx = 12;
  const bh = 108;
  const by = H - view.safeBottom - 84 - bh;
  const e = ow.card;
  const site = !e && nearSite();
  if (!e && !site) {
    const a = ow.hintT < 10 ? 0.85 : 0.5;
    const go = input.device === 'touch' ? 'DRAG TO FLY' : input.device === 'mouse' ? 'CLICK TO FLY · SHIFT AIMS' : input.device === 'pad' ? 'AUTO-AIM · SHOULDER LOCKS ON' : 'AUTO-AIM · SHIFT LOCKS ON';
    text(ctx, `FIND AN EXIT  ·  ${go}  ·  ${mapKey()} MAP`, W / 2, by + bh - 8, 12, `rgba(255,255,255,${a})`, 'center', 700, FONT2);
    return;
  }
  ctx.fillStyle = 'rgba(5,3,13,0.84)';
  ctx.fillRect(bx, by, bw, bh);
  const lx = bx + 12;
  const tw = bw - 24;
  if (site) {
    const def = SITES[site.kind];
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, bh);
    text(ctx, def.name, lx, by + 16, 13, def.color, 'left', 900);
    ctx.font = `700 12px ${FONT2}`;
    text(ctx, fitText(ctx, def.sub, tw), lx, by + 38, 12, 'rgba(255,255,255,0.85)', 'left', 700, FONT2);
    const g = site.kind === 'cache' && ow.packs[site.guard];
    const how = def.engage ? (ow.dwellId === site.id ? 'HOLD POSITION OR PRESS ENTER TO ANSWER' : 'FLY INTO THE SIGNAL TO ANSWER') : g && !g.cleared ? 'CLEAR THE ELITE GUARDS, THEN FLY THROUGH' : 'FLY THROUGH TO COLLECT';
    text(ctx, how, lx, by + bh - 16, 12, 'rgba(255,255,255,0.6)', 'left', 700, FONT2);
    if (def.engage && ow.dwellId === site.id) {
      ctx.fillStyle = def.color;
      ctx.fillRect(bx, by + bh - 3, bw * clamp(ow.dwell / DWELL, 0, 1), 3);
    }
    return;
  }
  const n = e.node;
  const info = NODE_TYPES[n.type];
  const inside = ow.dwellId === e.id;
  ctx.strokeStyle = info.color;
  ctx.lineWidth = inside ? 2.5 : 1.5;
  ctx.strokeRect(bx, by, bw, bh);
  const boss = n.type === 'boss';
  text(ctx, boss ? `BOSS · ${bossById(G.run.system.boss).name}` : `${n.mini ? 'GUARDED VAULT' : info.name}  ·  SECTOR ${n.row + 1}`, lx, by + 16, 13, info.color, 'left', 900);
  // Threat pips (square)
  const pips = threat(n);
  text(ctx, 'THREAT', bx + bw - 12 - 5 * 11 - 6, by + 16, 11, 'rgba(255,255,255,0.6)', 'right', 700, FONT2);
  const hit = n.type === 'combat' || n.type === 'elite' || boss || n.mini ? enemyHit(nodeLevel(G.run.system, n.row), 0, (G.run.tier || 0) + (G.run.deep || 0)) : 1;
  if (hit > 1) {
    // Heavy hits: hull per hit, left of the threat label
    ctx.font = `700 11px ${FONT2}`;
    text(ctx, `${hit} HULL / HIT`, bx + bw - 12 - 5 * 11 - 14 - ctx.measureText('THREAT').width, by + 16, 11, '#ff4d6d', 'right', 700, FONT2);
  }
  for (let i = 0; i < 5; i++) {
    const x = bx + bw - 12 - (5 - i) * 11 + 2;
    ctx.strokeStyle = i < pips ? '#ff4d6d' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, by + 11, 8, 8);
    if (i < pips) {
      ctx.fillStyle = '#ff4d6d';
      ctx.fillRect(x + 2, by + 13, 4, 4);
    }
  }
  const fight = n.type === 'combat' || n.type === 'elite' || boss;
  const lines = [];
  if (n.mini) {
    const m = miniById(n.mini);
    lines.push(['REWARD', 'MAIN CANNON +1, then a Vault draft: 2 levels a pick', '#3ff6ff']);
    lines.push(['HAZARD', 'None', 'rgba(255,255,255,0.6)']);
    lines.push(['HOSTILES', `MINI BOSS ${m.name}: ${m.title}  ·  1 ZONE`, m.color]);
  } else if (fight) {
    const rw = n.reward ? REWARDS[n.reward] : null;
    lines.push(['REWARD', rw ? `${rw.name}: ${rw.desc}` : boss ? 'The system boss. Beat it to move on.' : 'Sector draft', rw ? rw.color : '#ffffff']);
    const mods = n.modifiers.filter((m) => MODIFIERS[m]);
    lines.push(['HAZARD', mods.length ? mods.map((m) => `${MODIFIERS[m].name}: ${MODIFIERS[m].desc}`).join('  ') : 'None', mods.length ? MODIFIERS[mods[0]].color : 'rgba(255,255,255,0.6)']);
    const lvl = nodeLevel(G.run.system, n.row);
    const foes = foesAt(lvl).map((t) => FOE_NAMES[t]).filter(Boolean);
    // A stage in another view (stageview.js) is named with the zones; fewer foe names make room for it.
    const vi = n.views ? n.views.findIndex((v) => v !== 'top') : -1;
    const shown = foes.slice(vi >= 0 || n.arenaView ? -3 : -4).reverse();
    const extra = foes.length - shown.length;
    const zones = boss
      ? 'BOSS ARENA' + (n.arenaView ? ` · ${viewName(n.arenaView)}` : '')
      : `${zoneCount({ row: n.row, elite: n.type === 'elite', boss: null })} ZONES` + (vi >= 0 ? ` · ZONE ${vi + 1} ${viewName(n.views[vi])}` + (n.views.filter((v) => v !== 'top').length > 1 ? ' +1' : '') : '');
    lines.push(['HOSTILES', `${n.type === 'elite' ? 'HUNTER + ' : ''}${shown.join(' · ')}${extra > 0 ? ` +${extra}` : ''}  ·  ${zones}`, '#ff8aa0']);
  } else {
    lines.push(['STOP', STOP_DESC[n.type] || '', info.color]);
    lines.push(['HAZARD', 'None. No fighting at this stop.', 'rgba(255,255,255,0.6)']);
    lines.push(['', '', '']);
  }
  lines.forEach(([label, body, col], i) => {
    if (!label) return;
    const y = by + 38 + i * 18;
    text(ctx, label, lx, y, 11, 'rgba(255,255,255,0.55)', 'left', 700, FONT);
    ctx.font = `700 12px ${FONT2}`;
    text(ctx, fitText(ctx, body, tw - 74), lx + 74, y, 12, col, 'left', 700, FONT2);
  });
  const key = input.device === 'pad' ? 'A' : input.device === 'touch' ? '' : 'ENTER';
  const how = inside ? `HOLD POSITION${key ? ' OR PRESS ' + key : ''} TO JUMP IN` : `FLY INTO THE BEACON TO JUMP IN${ow.exits.length > 1 ? ' · THE OTHER EXITS CLOSE' : ''}`;
  text(ctx, how, lx, by + bh - 14, 12, inside ? '#ffffff' : 'rgba(255,255,255,0.6)', 'left', 700, FONT2);
  if (inside) {
    ctx.fillStyle = info.color;
    ctx.fillRect(bx, by + bh - 3, bw * clamp(ow.dwell / DWELL, 0, 1), 3);
  }
}

// A site the ship is close to (when no exit card is up).
function nearSite() {
  const p = G.player;
  let best = null;
  let bd = 170 * 170;
  for (const s of ow.sites) {
    if (s.done) continue;
    const d = dist2(p.x, p.y, s.x, s.y);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

// Edge chevrons toward exits found that are off screen.
function drawArrows(ctx) {
  const z = zoom();
  const m = 26;
  const top = view.safeTop + 58;
  const bottom = view.H - view.safeBottom - 210;
  const labels = [];
  for (const e of ow.exits) {
    if (!e.seen) continue;
    const sp = toScreen(e.x, e.y, z);
    if (sp.x > 0 && sp.x < view.W && sp.y > top && sp.y < bottom) continue;
    const cx = view.W / 2;
    const cy = (top + bottom) / 2;
    const dx = sp.x - cx;
    const dy = sp.y - cy;
    const t = Math.min((view.W / 2 - m) / Math.abs(dx || 1e-3), ((bottom - top) / 2 - 8) / Math.abs(dy || 1e-3));
    const x = cx + dx * t;
    const y = cy + dy * t;
    const a = Math.atan2(dy, dx);
    const col = NODE_TYPES[e.node.type].color;
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
    text(ctx, NODE_TYPES[e.node.type].name, lx, ly, 11, col, 'center', 700);
  }
}

// The map: this zone (fogged until flown through) above the system route. Flying continues under it.
function drawMap(ctx, a) {
  const W = view.W;
  const x0 = 16;
  const y0 = view.safeTop + 56;
  const w = W - 32;
  const h = view.H - y0 - view.safeBottom - 100;
  const h0 = hue();
  const run = G.run;
  ctx.globalAlpha = a;
  ctx.fillStyle = '#05030d';
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = hsl(h0, 65);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0, y0, w, h);
  ctx.textBaseline = 'middle';
  text(ctx, 'ZONE MAP', x0 + 14, y0 + 18, 12, hsl(h0, 72), 'left', 900);
  text(ctx, `EXITS FOUND ${ow.exits.filter((e) => e.seen).length} / ${ow.exits.length}`, x0 + w - 14, y0 + 18, 12, 'rgba(255,255,255,0.7)', 'right', 700, FONT2);

  // Zone area (aspect kept), above the route strip.
  const routeH = 118;
  const ax0 = x0 + 14;
  const ay0 = y0 + 34;
  const aw = w - 28;
  const ah = h - 34 - routeH - 34;
  const s = Math.min(aw / ow.W, ah / ow.H);
  const zx = ax0 + (aw - ow.W * s) / 2;
  const zy = ay0 + (ah - ow.H * s) / 2;
  const mx = (x) => zx + x * s;
  const my = (y) => zy + y * s;
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.fillRect(mx(0), my(0), ow.W * s, ow.H * s);
  // Explored cells
  ctx.fillStyle = hsl(h0, 60, 0.12);
  const cs = FOG * s;
  for (let y = 0; y < ow.fr; y++) {
    for (let x = 0; x < ow.fc; x++) if (ow.fog[y * ow.fc + x]) ctx.fillRect(mx(x * FOG), my(y * FOG), cs + 0.5, cs + 0.5);
  }
  ctx.strokeStyle = hsl(h0, 65, 0.5);
  ctx.lineWidth = 1;
  ctx.strokeRect(mx(0), my(0), ow.W * s, ow.H * s);
  // Rocks, packs and sites in explored space
  ctx.fillStyle = hsl(h0, 50, 0.45);
  for (const r of ow.rocks) {
    if (!seenAt(r.x, r.y)) continue;
    ctx.beginPath();
    ctx.arc(mx(r.x), my(r.y), Math.max(1, r.r * s), 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ff4d6d';
  for (const pk of ow.packs) {
    if (pk.cleared || !seenAt(pk.lx, pk.ly)) continue;
    const sz = pk.elite ? 6 : 4;
    ctx.fillRect(mx(pk.lx) - sz / 2, my(pk.ly) - sz / 2, sz, sz);
  }
  for (const st of ow.sites) {
    if (st.done || !st.seen) continue;
    ctx.strokeStyle = SITES[st.kind].color;
    ctx.strokeRect(mx(st.x) - 3.5, my(st.y) - 3.5, 7, 7);
  }
  // Entry and exits
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.strokeRect(mx(ow.start.x) - 4, my(ow.start.y) - 4, 8, 8);
  for (const e of ow.exits) {
    const col = NODE_TYPES[e.node.type].color;
    const x = mx(e.x);
    const y = my(e.y);
    if (!e.seen) continue;
    ctx.fillStyle = '#05030d';
    ctx.fillRect(x - 9, y - 9, 18, 18);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 9, y - 9, 18, 18);
    const ic = icon(e.node.type, col);
    if (ic.complete) ctx.drawImage(ic, x - 7, y - 7, 14, 14);
    text(ctx, NODE_TYPES[e.node.type].name, x, y + 18, 11, col, 'center', 700, FONT2);
  }
  // Ship marker
  const p = G.player;
  ctx.save();
  ctx.translate(mx(p.x), my(p.y));
  ctx.rotate(p.aim + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  drawRoute(ctx, x0 + 14, y0 + h - routeH - 30, w - 28, routeH, a);

  // Legend
  const ly = y0 + h - 14;
  let lx = x0 + 14;
  for (const [label, col] of [['YOU', '#ffffff'], ['PACK', '#ff4d6d'], ['SITE', '#b48bff'], ['EXIT', '#3ff6ff']]) {
    ctx.fillStyle = col;
    ctx.fillRect(lx, ly - 3, 6, 6);
    text(ctx, label, lx + 10, ly, 12, 'rgba(255,255,255,0.7)', 'left', 700, FONT2);
    lx += 10 + ctx.measureText(label).width + 16;
  }
  text(ctx, `${mapKey()} CLOSE`, x0 + w - 14, ly, 12, 'rgba(255,255,255,0.7)', 'right', 700, FONT2);
  ctx.globalAlpha = 1;
}

// The system route as a strip, left (entry) to right (boss): where this leg sits and where its exits lead.
function drawRoute(ctx, x0, y0, w, h, a) {
  const run = G.run;
  const route = run.route;
  const h0 = hue();
  const rows = route.rows.length;
  ctx.strokeStyle = hsl(h0, 60, 0.35);
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, w, h);
  text(ctx, 'ROUTE', x0 + 8, y0 + 12, 11, hsl(h0, 72), 'left', 900);
  const px = (row) => x0 + 22 + (row / (rows - 1)) * (w - 44);
  const py = (n) => (n.type === 'boss' ? y0 + h / 2 + 6 : y0 + 26 + n.x * (h - 36));
  const visited = new Set(run.visited);
  const next = new Set(ow.exits.map((e) => e.id));
  ctx.lineWidth = 1.2;
  for (const n of route.nodes) {
    for (const id of n.links) {
      const t = route.nodes.find((m) => m.id === id);
      const trav = visited.has(n.id) && visited.has(id);
      const open = n.id === run.nodeId && next.has(id);
      ctx.strokeStyle = trav ? hsl(h0, 70, 0.8) : open ? 'rgba(255,255,255,0.85)' : hsl(h0, 60, 0.2);
      ctx.beginPath();
      ctx.moveTo(px(n.row), py(n));
      ctx.lineTo(px(t.row), py(t));
      ctx.stroke();
    }
  }
  for (const n of route.nodes) {
    const x = px(n.row);
    const y = py(n);
    const col = NODE_TYPES[n.type].color;
    const cur = n.id === run.nodeId;
    const nx = next.has(n.id);
    const done = visited.has(n.id);
    const half = n.type === 'boss' ? 7 : 5;
    ctx.globalAlpha = a * (nx ? 1 : cur ? 1 : done ? 0.45 : 0.5);
    ctx.fillStyle = done && !cur ? '#ffffff' : '#05030d';
    ctx.fillRect(x - half, y - half, half * 2, half * 2);
    ctx.strokeStyle = cur ? '#ffffff' : col;
    ctx.lineWidth = nx ? 2 : 1.2;
    ctx.strokeRect(x - half, y - half, half * 2, half * 2);
    if (nx) {
      const o = half + 3 + Math.sin(ow.t * 4) * 1.2;
      ctx.strokeRect(x - o, y - o, o * 2, o * 2);
    }
  }
  ctx.globalAlpha = a;
}
