// Sector flow and wave spawning: intro → waves → (boss) → clear → reward draft.

import { G, view, field, sectorDifficulty, sectorInfo, isBossSector } from './state.js';
import { applyModifiers, patternMul, MODIFIERS } from './modifiers.js';
import { applyHeat } from './core.js';
import { rand, chance, weightedPick, randInt } from '../core/math.js';
import { spawnEnemy, spawnWeavers, blinkSpot, killEnemy, withdrawEnemy } from './enemies.js';
import { spawnBoss, bossVariant, bossIndex, BOSS_IDS } from './bosses.js';
import { miniById } from './minibosses.js';
import { banner, floatText, flash, addShake, explosion, ring } from './fx.js';
import { vacuumAll } from './pickups.js';
import { sectorPayout } from './economy.js';
import { onSectorClear as onPilotSectorClear } from './pilot.js';
import { bg } from '../render/background.js';
import { cine, lateFinisher } from './cinematic.js';
import { sfx, music } from '../core/audio.js';
import { sv, viewName } from './stageview.js';
import { rollField, spawnFormation, clearObstacles } from './obstacles.js';
import { cruising } from './boost.js';
import { topdownTargetY } from './topdownGeometry.js';

export function createDirector() {
  return {
    state: 'intro', t: 0, sectorT: 0, duration: 40, spawnT: 0, queue: [],
    diff: sectorDifficulty(1, 0), spec: null, last: null, progress: 0, onClear: null, onWarn: null, fields: [], obst: null, obstT: 0,
  };
}

function later(delay, fn) {
  G.director.queue.push({ at: G.director.t + delay, fn });
}

const W = () => view.W;
const H = () => view.H;
const top = () => view.safeTop;
const targetY = (y) => !field.ow && !sv.active
  ? topdownTargetY(y, H(), view.safeTop, view.safeBottom)
  : y;

const PATTERNS = [
  {
    id: 'dartLine', min: 1, w: (s) => Math.max(0.6, 3 - s * 0.3), cost: 1,
    run() {
      const n = 5;
      const shots = G.sector >= 4 ? 2 : G.sector > 1 ? 1 : chance(0.5) ? 1 : 0;
      for (let i = 0; i < n; i++) {
        later(i * 0.1, () => spawnEnemy('dart', 60 + (i * (W() - 120)) / (n - 1), -20, { mv: 'down', speed: 115, shots }));
      }
    },
  },
  {
    id: 'dartV', min: 1, w: () => 2.4, cost: 1.3,
    run() {
      const cx = rand(130, W() - 130);
      for (let k = -3; k <= 3; k++) {
        later(Math.abs(k) * 0.16, () => spawnEnemy('dart', cx + k * 34, -20, { mv: 'down', speed: 125, wa: 25, wf: 1.8, ph: 0, shots: k % 2 ? 1 : 0 }));
      }
    },
  },
  {
    id: 'dartWeave', min: 1, w: () => 2, cost: 1.1,
    run() {
      const x = rand(110, W() - 110);
      for (let i = 0; i < 7; i++) {
        later(i * 0.22, () => spawnEnemy('dart', x, -20, { mv: 'down', speed: 140, wa: 85, wf: 2.2, ph: 0, shots: i % 3 === 0 ? 1 : 0 }));
      }
    },
  },
  {
    id: 'dartDive', min: 2, w: () => 1.8, cost: 1.4,
    run() {
      const n = 4 + Math.min(2, Math.floor(G.sector / 3));
      for (let i = 0; i < n; i++) {
        const tx = 50 + (i * (W() - 100)) / (n - 1);
        later(i * 0.12, () => spawnEnemy('dart', tx, -20, { mv: 'dive', tx, ty: targetY(rand(90, 190) + top()), shots: 0 }));
      }
    },
  },
  {
    id: 'swarmSweep', min: 1, w: () => 2.2, cost: 1,
    run() {
      const left = chance(0.5);
      const y = rand(100, 260) + top();
      const n = 8 + Math.min(6, G.sector);
      for (let i = 0; i < n; i++) {
        later(i * 0.12, () => spawnEnemy('swarm', left ? -15 : W() + 15, y, {
          mv: 'sweep', vx: left ? 250 : -250, vy: -10, curve: 90,
        }));
      }
    },
  },
  {
    id: 'swarmRain', min: 2, w: () => 1.6, cost: 1.2,
    run() {
      const n = 10 + Math.min(8, G.sector);
      for (let i = 0; i < n; i++) later(i * 0.16, () => spawnEnemy('swarm', rand(30, W() - 30), -15, { mv: 'home', speed: rand(150, 200) }));
    },
  },
  {
    id: 'spinner', min: 2, w: () => 1.7, cost: 2,
    run() {
      const n = G.sector >= 5 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const tx = n === 1 ? rand(100, W() - 100) : i === 0 ? rand(80, W() / 2 - 40) : rand(W() / 2 + 40, W() - 80);
        later(i * 0.5, () => spawnEnemy('spinner', tx, -30, { mv: 'hover', tx, ty: targetY(rand(110, 250) + top()), stay: 7, fireDelay: 0.8 }));
      }
    },
  },
  {
    id: 'dashers', min: 3, w: () => 1.6, cost: 1.8,
    run() {
      const n = G.sector >= 6 ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const tx = 60 + (i * (W() - 120)) / (n - 1);
        later(i * 0.45, () => spawnEnemy('dasher', tx, -20, { tx, ty: targetY(rand(90, 170) + top()) }));
      }
    },
  },
  {
    id: 'snake', min: 4, w: () => 1.2, cost: 2.4,
    run() {
      spawnEnemy('snake', rand(130, W() - 130), -20, { wa: rand(80, 120) });
    },
  },
  {
    id: 'snipers', min: 3, w: () => 1.4, cost: 2,
    run() {
      const n = G.sector >= 7 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        later(i * 0.6, () => spawnEnemy('sniper', rand(40, W() - 40), -20, {
          tx: rand(50, W() - 50), ty: targetY(rand(H() * 0.12, H() * 0.32) + top()), shots: 3,
        }));
      }
    },
  },
  {
    id: 'tank', min: 5, w: () => 1, cost: 3.4,
    run() {
      spawnEnemy('tank', W() / 2 + rand(-80, 80), -40, { mv: 'hover', tx: W() / 2 + rand(-90, 90), ty: targetY(140 + top()), stay: 12, fireDelay: 1 });
      later(1, () => PATTERNS[0].run());
    },
  },
  {
    id: 'splitters', min: 2, w: () => 1.3, cost: 1.6,
    run() {
      const n = 3;
      for (let i = 0; i < n; i++) {
        later(i * 0.4, () => spawnEnemy('splitter', 70 + i * ((W() - 140) / (n - 1)), -20, { mv: 'down', speed: 80, wa: 40, wf: 1.4 }));
      }
    },
  },
  {
    id: 'mines', min: 4, w: () => 1.1, cost: 1.5,
    run() {
      for (let i = 0; i < 5; i++) later(i * 0.3, () => spawnEnemy('mine', rand(40, W() - 40), -15));
    },
  },
  {
    id: 'pincer', min: 6, w: () => 1.2, cost: 2.6,
    run() {
      for (const left of [true, false]) {
        const y = rand(90, 200) + top();
        for (let i = 0; i < 8; i++) {
          later(i * 0.12 + (left ? 0 : 0.5), () => spawnEnemy('swarm', left ? -15 : W() + 15, y, { mv: 'sweep', vx: left ? 240 : -240, vy: 0, curve: 110 }));
        }
      }
      later(0.8, () => spawnEnemy('spinner', W() / 2, -30, { mv: 'hover', tx: W() / 2, ty: targetY(200 + top()), stay: 6 }));
    },
  },
  {
    id: 'carrier', min: 2, w: (s) => (s < 3 ? 0.55 : 1.1), cost: 2.8,
    run() {
      spawnEnemy('carrier', rand(120, W() - 120), -40, { ty: targetY(rand(110, 170) + top()) });
    },
  },
  {
    id: 'shielder', min: 4, w: () => 1.2, cost: 3,
    run() {
      // Shielder with spinner escorts close enough to be tethered (link radius 210).
      const cx = rand(130, W() - 130);
      const tys = 118 + top();
      spawnEnemy('shielder', cx, -30, { mv: 'hover', tx: cx, ty: targetY(tys), stay: 13, fireDelay: 2 });
      const xs = G.sector + G.loop * 9 >= 7 ? [-100, 0, 100] : [-95, 95];
      xs.forEach((dx, i) => {
        const tx = Math.max(50, Math.min(W() - 50, cx + dx));
        later(0.5 + i * 0.3, () => spawnEnemy('spinner', tx, -30, { mv: 'hover', tx, ty: targetY(tys + (dx === 0 ? 120 : 75)), stay: 11, fireDelay: 1 + i * 0.4 }));
      });
    },
  },
  {
    id: 'weavers', min: 5, w: () => 1.2, cost: 2.4,
    run() {
      const gap = rand(170, 240);
      spawnWeavers(rand(gap / 2 + 50, W() - gap / 2 - 50), -20, gap);
    },
  },
  {
    id: 'blinkers', min: 6, w: () => 1.1, cost: 2.2,
    run() {
      const n = G.sector + G.loop * 9 >= 8 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        later(i * 0.9, () => {
          const b = spawnEnemy('blinker', 0, 0, { shots: randInt(2, 3) });
          blinkSpot(b);
        });
      }
    },
  },
];

// Enemy types each pattern brings (what a level can field: the overworld's packs and its node previews).
const PATTERN_FOES = {
  dartLine: ['dart'], dartV: ['dart'], dartWeave: ['dart'], dartDive: ['dart'], swarmSweep: ['swarm'], swarmRain: ['swarm'],
  spinner: ['spinner'], dashers: ['dasher'], snake: ['snake'], snipers: ['sniper'], tank: ['tank', 'dart'], splitters: ['splitter'],
  mines: ['mine'], pincer: ['swarm', 'spinner'], carrier: ['carrier', 'swarm'], shielder: ['shielder', 'spinner'], weavers: ['weaver'], blinkers: ['blinker'],
};

// Enemy types the director can spawn at a level, in roster order (patterns unlock by `min` level, like updateDirector).
export function foesAt(level, loop = 0) {
  const out = [];
  for (const p of PATTERNS) if (p.min <= level + loop * 9) for (const t of PATTERN_FOES[p.id]) if (!out.includes(t)) out.push(t);
  return out;
}

// Spec for endless mode: sector n → 9-sector cycle (boss every 3rd) that loops harder.
export function endlessSpec(n) {
  const local = ((n - 1) % 9) + 1;
  const info = sectorInfo(n);
  const base = 36 + Math.min(6, local) * 4;
  const boss = isBossSector(local) ? BOSS_IDS[(Math.floor(local / 3) - 1) % BOSS_IDS.length] : null;
  return {
    index: n, level: local, loop: Math.floor((n - 1) / 9), boss, elite: false, modifiers: [],
    hue: info.hue, name: info.name, duration: boss ? base * 0.7 : base,
  };
}

// Zones: a campaign node is fought in 2-3 zones with a break between them; the jet flies to the next one on a
// fly-through camera (cine.transit). Each zone has its own name, a hue shift and two favoured spawn patterns.
// Boss nodes fight one zone, then fly into the boss arena before the WARNING.
const ZONES = {
  genesis: ['OUTER LATTICE', 'RELAY SPIRES', 'DATA CANYON', 'SIGNAL ARRAY', 'GATE APPROACH'],
  crimson: ['BLOOD REEF', 'SPORE FIELDS', 'HIVE TRENCH', 'MARROW DEPTHS', 'THE MAW'],
  cyclone: ['STORM SHELF', 'ION CURRENTS', 'EYEWALL', 'STATIC FRONT', 'THE EYE'],
  void: ['EVENT HORIZON', 'NULL DRIFT', 'SHATTERED ORBIT', 'DARK TIDE', 'THE ABYSS'],
};
const HUE_SHIFT = [0, 16, -14];
// Capital ship assault (campaign.js nodeSpec): fixed zones, then the reactor arena. CORE_TIME = seconds to crack the
// core once it opens fire; ASSAULT_GATES = how much sooner the trench's laser gates come than a normal pursuit zone's.
const ASSAULT_ZONES = ['HULL RUN', 'THE TRENCH'];
const ASSAULT_ARENA = 'REACTOR CORE';
const ASSAULT_FOCUS = [['snipers', 'spinner', 'tank', 'carrier'], ['dartDive', 'swarmRain', 'dashers', 'mines']];
export const CORE_TIME = 45;
const ASSAULT_GATES = 0.6;

export function zoneCount(spec) {
  if (spec.assault) return spec.zones || ASSAULT_ZONES.length;
  if (!(G.mode === 'run' && G.run && G.run.mode === 'campaign' && spec.row != null) || spec.boss || spec.mini) return 1;
  if (spec.zones) return spec.zones; // a node type may set its own count
  return spec.elite || spec.row >= 2 ? 3 : 2;
}

function setZone(d, i) {
  const spec = d.spec;
  const names = ZONES[G.run && G.run.system && G.run.system.id] || ZONES.genesis;
  const pool = PATTERNS.filter((p) => p.min <= spec.level + spec.loop * 9).map((p) => p.id);
  const focus = [];
  // An assault's zones favour its own threats: hull turrets and gunships along the hull, divers and mines in the trench.
  if (spec.assault) for (const id of ASSAULT_FOCUS[i % ASSAULT_FOCUS.length]) if (focus.length < 2 && pool.includes(id)) focus.push(id);
  while (focus.length < 2 && pool.length) focus.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  // The last name of each list is the boss arena; ordinary zones draw from the rest.
  d.zone = { i, name: zoneName(d, i), focus, hue: spec.hue + HUE_SHIFT[i % HUE_SHIFT.length] };
  d.obst = d.fields[i] || null;
  d.obstT = 2.5;
  bg.setZone(d.zone.name);
  bg.setHue(d.zone.hue);
}

function zoneName(d, i) {
  if (d.spec.assault) return ASSAULT_ZONES[i % ASSAULT_ZONES.length];
  const names = ZONES[G.run && G.run.system && G.run.system.id] || ZONES.genesis;
  return names[(d.zoneBase + i) % (names.length - 1)];
}

// Obstacle fields (obstacles.js), rolled per zone up front so the cards can name them. Top-down zones only.
const FIELD_NAME = 'DEBRIS FIELD';
// spec.obstacles (debug): true makes every top-down zone a field, false none.
function rollFields(d, spec) {
  const force = spec.obstacles;
  const lvl = force ? Math.max(2, spec.level + spec.loop * 9) : spec.level + spec.loop * 9;
  d.fields = [];
  for (let i = 0; i < d.zones; i++) {
    const v = spec.view || (d.views && d.views[i]) || 'top';
    d.fields.push(v === 'top' && force !== false ? rollField(lvl, force ? () => 0 : Math.random) : null);
  }
}

const zoneMul = (d, id) => (d.zone && d.zone.focus.includes(id) ? 2.5 : 1);

export function startSector(spec) {
  const d = G.director;
  d.spec = spec;
  G.sector = spec.index;
  G.loop = spec.loop;
  const diff = sectorDifficulty(spec.level, spec.loop);
  diff.credits = 1;
  diff.eliteBonus = 0;
  if (spec.elite) {
    diff.hp *= 1.1;
    diff.eliteBonus = 0.12;
  }
  d.diff = applyHeat(applyModifiers(diff, spec.modifiers), spec);
  d.state = 'intro';
  d.t = 0;
  d.sectorT = 0;
  d.queue.length = 0;
  d.spawnT = 1.4;
  d.progress = 0;
  d.hunter = null;
  d.hunterSpawned = false;
  d.finished = false; // the node's finisher shot has played (or been ruled out)
  d.mopping = false;
  d.zones = zoneCount(spec);
  d.zoneBase = randInt(0, 3);
  d.zone = null;
  d.arena = false;
  d.duration = spec.duration;
  // Stage views: spec.views = a view per zone (campaign rolls, campaign.js), spec.arenaView = the boss arena's view,
  // spec.view = the whole sector in one view (debug). Every node opens top-down unless told otherwise.
  d.views = spec.views || null;
  d.swapTo = null;
  d.core = null; // assault: { t: seconds left, state: 'live' | 'down' | 'sealed' }
  d.escaped = false;
  d.gateRate = spec.assault ? ASSAULT_GATES : 1;
  sv.reset();
  sv.trench = !!spec.assault;
  // Assaults open on the hull, side-on; every other node opens top-down.
  const v0 = spec.view || (d.views && d.views[0]);
  if (v0 && v0 !== 'top') sv.enter(v0);
  bg.setHue(spec.hue);
  bg.setTheme(G.run && G.run.mode === 'campaign' ? G.run.system.id : null);
  clearObstacles();
  rollFields(d, spec);
  d.obst = d.fields[0] || null;
  d.obstT = 2.5;
  if (d.zones > 1) setZone(d, 0);
  G.vacuum = false;
  if (G.mode === 'run') {
    const camp = G.run && G.run.mode === 'campaign' && spec.row != null;
    if (camp) {
      // Node opening: the camera settles in, and the card names the node (route row), its type and its modifiers.
      const rows = G.run.route ? G.run.route.rows.length : 0;
      const type = spec.boss ? 'BOSS NODE' : spec.assault ? 'CAPITAL SHIP ASSAULT' : spec.mini ? 'GUARDED VAULT' : spec.elite ? 'ELITE NODE' : 'COMBAT';
      const mods = spec.modifiers.map((id) => MODIFIERS[id] && MODIFIERS[id].name).filter(Boolean).join('  ·  ');
      const col = spec.boss ? '#ff2e55' : spec.assault ? '#ff8a2a' : spec.mini ? '#ffb300' : spec.elite ? '#ff3df2' : `hsl(${spec.hue},100%,70%)`;
      const where = d.zone ? `ZONE 1 / ${d.zones}  ·  ${d.zone.name}` + (sv.active ? `  ·  ${viewName(sv.mode)}` : '') : '';
      const debris = d.obst ? FIELD_NAME : '';
      const guard = spec.assault ? 'CRACK ITS REACTOR CORE' : spec.mini ? `GUARDED BY ${miniById(spec.mini).name}` : '';
      const heavy = d.diff.hit > 1 ? `HITS COST ${d.diff.hit} HULL` : '';
      banner(`NODE ${spec.row + 1}${rows ? ' / ' + rows : ''}`, [heavy, guard, where, debris, mods].filter(Boolean).join('  ·  ') || 'HOSTILES INBOUND', col, 2.4, 'start', `${G.run.system.short}  ·  ${type}`);
      cine.nodeStart();
    } else {
      banner(`SECTOR ${spec.index}`, spec.name + (spec.loop ? `  ·  LOOP ${spec.loop + 1}` : ''), `hsl(${spec.hue},100%,70%)`, 2.6);
    }
    music.setSet(spec.level >= 7 ? 'late' : 'normal');
  }
}

function aliveEnemies() {
  let n = 0;
  for (const e of G.enemies) if (!e.dead && !e.boss) n++;
  return n;
}

// Mop-up: when a zone's or node's wave clock runs out, whatever is still on screen has to be fought. Only after MOPUP
// seconds of actual fighting (real time: boost cruise doesn't speed it up) do the stragglers give up and withdraw
// (enemies.js), and the fight moves on once they are off screen. The Hunter never withdraws.
const MOPUP = { break: 9, clearing: 12, mini: 8 };
const WITHDRAW = 3; // s the withdrawing stragglers get to leave before any left are dropped quietly

function startMopUp(d) {
  d.mopT = 0;
  d.withdraw = -1;
  d.mopping = true; // boost.js: boost costs meter again until the stragglers are dealt with
}

function strays() {
  let n = 0;
  for (const e of G.enemies) if (!e.dead && !e.boss && !e.hunter) n++;
  return n;
}

// True once the zone / node can move on: everything is dead, or the stragglers have withdrawn (and the Hunter is dead).
function mopUp(d, dt, limit) {
  const done = mopDone(d, dt, limit);
  d.mopping = !done;
  return done;
}

function mopDone(d, dt, limit) {
  if (aliveEnemies() === 0 && !d.queue.length) return true;
  d.mopT += dt;
  if (d.withdraw < 0 && d.mopT >= limit) {
    d.withdraw = d.mopT;
    d.queue.length = 0;
    let n = 0;
    for (const e of G.enemies) {
      if (!e.dead && !e.boss && !e.hunter) {
        withdrawEnemy(e);
        n++;
      }
    }
    if (n && G.mode === 'run') banner('HOSTILES WITHDRAWING', 'SHOOT THEM DOWN BEFORE THEY ESCAPE', '#9fb8ff', 1.6);
  }
  if (d.withdraw < 0) return false;
  if (strays() && d.mopT - d.withdraw < WITHDRAW) return false;
  for (const e of G.enemies) if (!e.dead && !e.boss && !e.hunter) e.dead = true; // stuck off screen: just gone
  return !(d.hunter && !d.hunter.dead);
}

// Elite nodes: one Hunter mini-boss late in the sector (HUD draws its compact bar from d.hunter).
function spawnHunter() {
  const d = G.director;
  d.hunterSpawned = true;
  d.hunter = spawnEnemy('hunter', W() / 2, -50, { ty: targetY(135 + top()) });
  if (G.mode === 'run') {
    banner('HUNTER', 'ELITE TARGET INBOUND', '#ff3b3b', 2);
    sfx.warn();
  }
}

export function updateDirector(dt) {
  const d = G.director;
  const realDt = dt;
  d.t += dt * (cruising() ? G.player.flow : 1); // boost cruises through transitions (boost.js)

  // Run delayed spawns.
  if (d.queue.length) {
    for (let i = d.queue.length - 1; i >= 0; i--) {
      if (d.queue[i].at <= d.t) {
        const q = d.queue[i];
        d.queue.splice(i, 1);
        q.fn();
      }
    }
  }

  // A view change rides the middle of its fly-through (behind the flash).
  if (d.swapTo && (!cine.transiting || cine.transitU >= 0.42)) changeView(d);

  const spec = d.spec;
  const local = spec.level;
  switch (d.state) {
    case 'intro':
      if (d.t > 1.2) d.state = 'waves';
      break;
    case 'waves': {
      d.sectorT += dt * ((G.player && G.player.flow) || 1); // Boost (boost.js) runs the node clock faster
      d.progress = Math.min(1, d.sectorT / d.duration);
      d.spawnT -= dt * G.enemyTimeScale; // Phase Shift slows the wave timer too
      if (spec.elite && !d.hunterSpawned && d.progress > 0.6) spawnHunter();
      const alive = aliveEnemies();
      if (alive === 0 && !d.queue.length) d.spawnT = Math.min(d.spawnT, 0.4);
      const cap = 16 + local * 2 + spec.loop * 6;
      if (d.spawnT <= 0 && alive < cap) {
        const pool = PATTERNS.filter((p) => p.min <= local + spec.loop * 9 && p.id !== d.last);
        const pat = weightedPick(pool, (p) => p.w(local) * patternMul(spec.modifiers, p.id) * zoneMul(d, p.id));
        d.last = pat.id;
        pat.run();
        d.spawnT = pat.cost * 1.35 * d.diff.spawn + rand(0, 0.5);
      }
      if (d.obst && !sv.active) {
        d.obstT -= dt;
        if (d.obstT <= 0) {
          spawnFormation(d.obst);
          d.obstT = d.obst.every * rand(0.85, 1.2);
        }
      }
      if (d.zone && d.zone.i < d.zones - 1 && d.sectorT >= (d.duration * (d.zone.i + 1)) / d.zones) {
        d.state = 'break'; // zone done: no new spawns, finish what's left, then fly on
        d.t = 0;
        startMopUp(d);
      } else if (d.sectorT >= d.duration) {
        d.state = 'clearing';
        d.t = 0;
        startMopUp(d);
      }
      break;
    }
    case 'break':
      // Like clearing: fight what's left; stragglers withdraw after a while (the Hunter still has to die).
      if (cine.busy) break;
      if (mopUp(d, realDt, MOPUP.break)) {
        d.queue.length = 0;
        for (const e of G.enemies) if (!e.dead && !e.boss && !e.hunter) killEnemy(e, true);
        clearObstacles(true);
        G.vacuum = true;
        vacuumAll();
        const next = d.zone.i + 1;
        const nextName = zoneName(d, next);
        const nv = (d.views && d.views[next]) || 'top';
        const swap = nv !== sv.mode ? nv : null;
        const kicker = `ZONE ${next + 1} / ${d.zones}` + (swap && nv !== 'top' ? `  ·  ${viewName(nv)}` : '') + (d.fields[next] ? `  ·  ${FIELD_NAME}` : '');
        if (cine.transit(kicker, nextName, false, !!swap)) {
          d.state = 'transit';
          d.swapTo = swap;
        } else {
          if (swap) sv.enter(swap);
          nextZone(d);
        }
      }
      break;
    case 'transit':
      if (!cine.busy) {
        if (d.swapTo) changeView(d);
        nextZone(d);
      }
      break;
    case 'clearing':
      d.progress = 1;
      if (cine.busy) break; // the finisher shot plays out before the clear
      // The Hunter never times out: the sector only clears once it is dead.
      if (mopUp(d, realDt, spec.mini ? MOPUP.mini : MOPUP.clearing)) {
        if (lateFinisher()) break;
        // Boss node (campaign): fly into the arena first. An assault flies on down the trench to its reactor.
        if ((spec.boss || spec.assault) && !d.arena && G.mode === 'run' && G.run && G.run.mode === 'campaign') {
          d.arena = true;
          const names = ZONES[G.run.system.id] || ZONES.genesis;
          G.vacuum = true;
          vacuumAll();
          clearObstacles(true);
          const av = spec.arenaView || 'top';
          const swap = av !== sv.mode ? av : null;
          const kicker = (spec.assault ? 'CORE APPROACH' : 'BOSS ARENA') + (swap && av !== 'top' ? `  ·  ${viewName(av)}` : '');
          if (spec.assault) for (const e of G.enemies) if (!e.dead && !e.boss) killEnemy(e, true);
          if (cine.transit(kicker, spec.assault ? ASSAULT_ARENA : names[names.length - 1], true, !!swap)) {
            d.swapTo = swap;
            break;
          }
          if (swap) sv.enter(swap);
        }
        if (d.arena) G.vacuum = false;
        d.t = 0;
        if (spec.boss) {
          d.state = 'warn';
          if (G.mode === 'run') {
            const b = bossVariant(spec.boss, sv.mode);
            banner('WARNING', 'BOSS INCOMING', '#ff2e55', 3);
            if (d.onWarn) d.onWarn(b, spec);
            sfx.warn();
            music.bossTrack(bossIndex(spec.boss));
          }
        } else if (spec.mini) {
          // Guarded Vault: its mini boss drops in (no arena fly-through, no boss track).
          d.state = 'warn';
          d.queue.length = 0;
          for (const e of G.enemies) if (!e.dead && !e.boss) killEnemy(e, true);
          clearObstacles(true);
          G.vacuum = true;
          vacuumAll();
          if (G.mode === 'run') {
            const m = miniById(spec.mini);
            if (spec.assault) banner('REACTOR CORE', `DESTROY IT IN ${CORE_TIME}s BEFORE IT SEALS`, m.color, 2.4, 'start', 'CAPITAL SHIP  ·  CORE EXPOSED');
            else banner('WARNING', `MINI BOSS  ·  ${m.name}`, m.color, 2.4);
            if (d.onWarn) d.onWarn(m, spec);
            sfx.warn();
          }
        } else {
          sectorClear();
        }
      }
      break;
    case 'warn':
      if (d.t > (spec.mini ? 2.2 : 3)) {
        G.vacuum = false;
        if (spec.mini) spawnBoss(spec.mini, spec.level, spec.loop, spec.miniHp || 1);
        else spawnBoss(spec.boss, spec.level, spec.loop, spec.bossHp || 1);
        if (spec.assault) d.core = { t: CORE_TIME, state: 'live' };
        d.state = 'boss';
        d.t = 0;
      }
      break;
    case 'boss':
      // Assault: the countdown runs while the core fights back; at zero its shutters seal it and the bonus is gone.
      if (d.core && d.core.state === 'live' && G.boss && G.boss.state === 'fight') {
        d.core.t -= dt;
        G.boss.seal = d.core.t / CORE_TIME; // miniArt.js closes the shutter plates with it
        if (d.core.t <= 0) sealCore(d);
      }
      if (!G.boss) {
        if (d.core && d.core.state === 'live') d.core.state = 'down';
        d.state = 'bossDown';
        d.t = 0;
      }
      break;
    case 'bossDown':
      if (d.t > 1.4 && !cine.busy) {
        if (G.mode === 'run' && spec.boss) music.setSet(local >= 6 ? 'late' : 'normal');
        if (spec.assault && !d.escaped && escape(d)) break;
        sectorClear();
      }
      break;
    case 'escape':
      if (sv.blast >= 0) sv.blast += realDt;
      // The ship blows behind you while you fly out (the fly-through); the clear comes once you're out.
      if (d.core && d.core.state === 'down' && d.t < 2.4 && Math.random() < dt * 14) {
        const x = rand(0, W());
        const y = rand(0, H() * 0.7);
        explosion(x, y, chance(0.5) ? '#ff8a2a' : '#ffffff', rand(1, 2.4));
        addShake(0.15);
      }
      if (!cine.busy) sectorClear();
      break;
    case 'clear':
      if (d.t > 2.4) {
        d.state = 'await';
        if (d.onClear) d.onClear();
      }
      break;
    default:
      break;
  }
}

// Assault: the countdown ran out. The core drops behind its shutters (no kill, no bonus) and the run pulls out.
function sealCore(d) {
  const e = G.boss;
  d.core.state = 'sealed';
  d.core.t = 0;
  if (!e) return;
  e.dead = true;
  G.boss = null;
  for (const b of G.beams) if (b.owner === 'enemy') b.dead = true;
  G.eBullets.length = 0;
  ring(e.x, e.y, 120, '#ff8a2a', 0.5);
  flash('255,138,42', 0.5);
  addShake(0.5);
  sfx.warn();
  if (G.mode === 'run') banner('CORE SEALED', 'BONUS LOST  ·  PULL OUT', '#ff8a2a', 2);
}

// Assault: fly out of the capital ship. A destroyed core blows it up behind you. Returns false if no fly-through runs.
function escape(d) {
  d.escaped = true;
  const down = d.core && d.core.state === 'down';
  for (const e of G.enemies) if (!e.dead && !e.boss) killEnemy(e, true);
  G.vacuum = true;
  vacuumAll();
  if (!cine.transit(down ? 'CORE BREACH  ·  GET OUT' : 'SHUTTERS DOWN', down ? 'ESCAPE' : 'PULL OUT', true, false)) return false;
  if (down) {
    flash('255,180,90', 0.9);
    addShake(1);
    sfx.explode(3);
    sv.blast = 0;
  }
  d.state = 'escape';
  d.t = 0;
  return true;
}

// Switch the camera to d.swapTo (stageview.js): the jet is moved to the new view's home spot and the fly-through
// finishes there.
function changeView(d) {
  clearObstacles();
  sv.enter(d.swapTo);
  d.swapTo = null;
  cine.retarget(sv.home());
  flash('255,255,255', 0.85);
  addShake(0.25);
  if (d.onView) d.onView(sv.mode);
}

// Arrive in the next zone (its name was shown by the fly-through): new hue and pattern focus; waves pick up quickly.
function nextZone(d) {
  setZone(d, d.zone.i + 1);
  G.vacuum = false;
  d.state = 'waves';
  d.t = 0;
  d.spawnT = 0.6;
}

function sectorClear() {
  const d = G.director;
  d.state = 'clear';
  d.t = 0;
  G.vacuum = true;
  vacuumAll();
  const p = G.player;
  if (p) onPilotSectorClear(p, !!(d.spec && d.spec.boss));
  if (G.mode === 'run') {
    const cr = sectorPayout();
    const sub = `+${(1000 * G.sector).toLocaleString()} BONUS` + (cr ? `  ·  +${cr} CREDITS` : '');
    const run = G.run && G.run.mode === 'campaign' ? G.run : null;
    if (run && d.spec.boss) {
      // System boss down: the end of the whole sector gets its own, bigger beat.
      const i = run.system.act;
      banner('SECTOR SECURED', sub, `hsl(${d.spec.hue},100%,72%)`, 2.4, 'secured', `SECTOR ${String(i).padStart(2, '0')}  ·  ${run.system.name}`);
    } else if (run && d.spec.assault) {
      const down = d.core && d.core.state === 'down';
      banner(down ? 'CAPITAL SHIP DOWN' : 'ASSAULT OVER', sub, down ? '#ff8a2a' : '#9fb8ff', 2.4, 'clear', `${run.system.short}  ·  NODE ${(d.spec.row ?? 0) + 1}`);
    } else if (run && d.spec.mini) banner('VAULT UNLOCKED', sub, '#ffb300', 2.2, 'clear', `${run.system.short}  ·  NODE ${(d.spec.row ?? 0) + 1}`);
    else if (run) banner('NODE CLEAR', sub, '#7dff6b', 2.2, 'clear', `${run.system.short}  ·  NODE ${(d.spec.row ?? 0) + 1}`);
    else banner('SECTOR CLEAR', sub, '#7dff6b', 2.2);
    G.score += 1000 * G.sector * (1 + G.loop);
    sfx.sector();
    if (p && !p.dead && p.hp < p.maxHp) {
      p.hp++;
      floatText(p.x, p.y - 30, '+1 HULL', '#ff3b6b', 12, 1.2);
    }
  }
}

export function nextSector() {
  startSector(endlessSpec(G.sector + 1));
}
