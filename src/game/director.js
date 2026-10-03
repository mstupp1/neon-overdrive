// Sector flow and wave spawning: intro → waves → (boss) → clear → reward draft.

import { G, view, sectorDifficulty, sectorInfo, isBossSector } from './state.js';
import { applyModifiers, patternMul, MODIFIERS } from './modifiers.js';
import { applyHeat } from './core.js';
import { rand, chance, weightedPick, randInt } from '../core/math.js';
import { spawnEnemy, spawnWeavers, blinkSpot, killEnemy } from './enemies.js';
import { spawnBoss, bossById, bossIndex, BOSS_IDS } from './bosses.js';
import { banner, floatText } from './fx.js';
import { vacuumAll } from './pickups.js';
import { sectorPayout } from './economy.js';
import { onSectorClear as onPilotSectorClear } from './pilot.js';
import { bg } from '../render/background.js';
import { cine, lateFinisher } from './cinematic.js';
import { sfx, music } from '../core/audio.js';

export function createDirector() {
  return {
    state: 'intro', t: 0, sectorT: 0, duration: 40, spawnT: 0, queue: [],
    diff: sectorDifficulty(1, 0), spec: null, last: null, progress: 0, onClear: null, onWarn: null,
  };
}

function later(delay, fn) {
  G.director.queue.push({ at: G.director.t + delay, fn });
}

const W = () => view.W;
const H = () => view.H;
const top = () => view.safeTop;

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
        later(i * 0.12, () => spawnEnemy('dart', tx, -20, { mv: 'dive', tx, ty: rand(90, 190) + top(), shots: 0 }));
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
        later(i * 0.5, () => spawnEnemy('spinner', tx, -30, { mv: 'hover', tx, ty: rand(110, 250) + top(), stay: 7, fireDelay: 0.8 }));
      }
    },
  },
  {
    id: 'dashers', min: 3, w: () => 1.6, cost: 1.8,
    run() {
      const n = G.sector >= 6 ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const tx = 60 + (i * (W() - 120)) / (n - 1);
        later(i * 0.45, () => spawnEnemy('dasher', tx, -20, { tx, ty: rand(90, 170) + top() }));
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
          tx: rand(50, W() - 50), ty: rand(H() * 0.12, H() * 0.32) + top(), shots: 3,
        }));
      }
    },
  },
  {
    id: 'tank', min: 5, w: () => 1, cost: 3.4,
    run() {
      spawnEnemy('tank', W() / 2 + rand(-80, 80), -40, { mv: 'hover', tx: W() / 2 + rand(-90, 90), ty: 140 + top(), stay: 12, fireDelay: 1 });
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
      later(0.8, () => spawnEnemy('spinner', W() / 2, -30, { mv: 'hover', tx: W() / 2, ty: 200 + top(), stay: 6 }));
    },
  },
  {
    id: 'carrier', min: 2, w: (s) => (s < 3 ? 0.55 : 1.1), cost: 2.8,
    run() {
      spawnEnemy('carrier', rand(120, W() - 120), -40, { ty: rand(110, 170) + top() });
    },
  },
  {
    id: 'shielder', min: 4, w: () => 1.2, cost: 3,
    run() {
      // Shielder with spinner escorts close enough to be tethered (link radius 210).
      const cx = rand(130, W() - 130);
      const tys = 118 + top();
      spawnEnemy('shielder', cx, -30, { mv: 'hover', tx: cx, ty: tys, stay: 13, fireDelay: 2 });
      const xs = G.sector + G.loop * 9 >= 7 ? [-100, 0, 100] : [-95, 95];
      xs.forEach((dx, i) => {
        const tx = Math.max(50, Math.min(W() - 50, cx + dx));
        later(0.5 + i * 0.3, () => spawnEnemy('spinner', tx, -30, { mv: 'hover', tx, ty: tys + (dx === 0 ? 120 : 75), stay: 11, fireDelay: 1 + i * 0.4 }));
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

export function zoneCount(spec) {
  if (!(G.mode === 'run' && G.run && G.run.mode === 'campaign' && spec.row != null) || spec.boss) return 1;
  if (spec.zones) return spec.zones; // a node type may set its own count
  return spec.elite || spec.row >= 2 ? 3 : 2;
}

function setZone(d, i) {
  const spec = d.spec;
  const names = ZONES[G.run && G.run.system && G.run.system.id] || ZONES.genesis;
  const pool = PATTERNS.filter((p) => p.min <= spec.level + spec.loop * 9).map((p) => p.id);
  const focus = [];
  while (focus.length < 2 && pool.length) focus.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  // The last name of each list is the boss arena; ordinary zones draw from the rest.
  d.zone = { i, name: names[(d.zoneBase + i) % (names.length - 1)], focus, hue: spec.hue + HUE_SHIFT[i % HUE_SHIFT.length] };
  bg.setHue(d.zone.hue);
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
  d.zones = zoneCount(spec);
  d.zoneBase = randInt(0, 3);
  d.zone = null;
  d.arena = false;
  d.duration = spec.duration;
  bg.setHue(spec.hue);
  if (d.zones > 1) setZone(d, 0);
  bg.setTheme(G.run && G.run.mode === 'campaign' ? G.run.system.id : null);
  G.vacuum = false;
  if (G.mode === 'run') {
    const camp = G.run && G.run.mode === 'campaign' && spec.row != null;
    if (camp) {
      // Node opening: the camera settles in, and the card names the node (route row), its type and its modifiers.
      const rows = G.run.route ? G.run.route.rows.length : 0;
      const type = spec.boss ? 'BOSS NODE' : spec.elite ? 'ELITE NODE' : 'COMBAT';
      const mods = spec.modifiers.map((id) => MODIFIERS[id] && MODIFIERS[id].name).filter(Boolean).join('  ·  ');
      const col = spec.boss ? '#ff2e55' : spec.elite ? '#ff3df2' : `hsl(${spec.hue},100%,70%)`;
      const where = d.zone ? `ZONE 1 / ${d.zones}  ·  ${d.zone.name}` : '';
      banner(`NODE ${spec.row + 1}${rows ? ' / ' + rows : ''}`, [where, mods].filter(Boolean).join('  ·  ') || 'HOSTILES INBOUND', col, 2.4, 'start', `${G.run.system.short}  ·  ${type}`);
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

// Elite nodes: one Hunter mini-boss late in the sector (HUD draws its compact bar from d.hunter).
function spawnHunter() {
  const d = G.director;
  d.hunterSpawned = true;
  d.hunter = spawnEnemy('hunter', W() / 2, -50, { ty: 135 + top() });
  if (G.mode === 'run') {
    banner('HUNTER', 'ELITE TARGET INBOUND', '#ff3b3b', 2);
    sfx.warn();
  }
}

export function updateDirector(dt) {
  const d = G.director;
  d.t += dt;

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

  const spec = d.spec;
  const local = spec.level;
  switch (d.state) {
    case 'intro':
      if (d.t > 1.2) d.state = 'waves';
      break;
    case 'waves': {
      d.sectorT += dt;
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
      if (d.zone && d.zone.i < d.zones - 1 && d.sectorT >= (d.duration * (d.zone.i + 1)) / d.zones) {
        d.state = 'break'; // zone done: no new spawns, finish what's left, then fly on
        d.t = 0;
      } else if (d.sectorT >= d.duration) {
        d.state = 'clearing';
        d.t = 0;
      }
      break;
    }
    case 'break':
      // Like clearing, but stragglers burn out after 3.5 s (the Hunter still has to die).
      if (cine.busy) break;
      if ((aliveEnemies() === 0 && !d.queue.length) || (d.t > 3.5 && !(d.hunter && !d.hunter.dead))) {
        d.queue.length = 0;
        for (const e of G.enemies) if (!e.dead && !e.boss && !e.hunter) killEnemy(e, true);
        G.vacuum = true;
        vacuumAll();
        const next = d.zone.i + 1;
        const names = ZONES[G.run.system.id] || ZONES.genesis;
        const nextName = names[(d.zoneBase + next) % (names.length - 1)];
        if (cine.transit(`ZONE ${next + 1} / ${d.zones}`, nextName)) d.state = 'transit';
        else nextZone(d);
      }
      break;
    case 'transit':
      if (!cine.busy) nextZone(d);
      break;
    case 'clearing':
      d.progress = 1;
      if (cine.busy) break; // the finisher shot plays out before the clear
      // The Hunter never times out: the sector only clears once it is dead.
      if ((aliveEnemies() === 0 && !d.queue.length) || (d.t > 7 && !(d.hunter && !d.hunter.dead))) {
        if (lateFinisher()) break;
        // Boss node (campaign): fly into the arena first.
        if (spec.boss && !d.arena && G.mode === 'run' && G.run && G.run.mode === 'campaign') {
          d.arena = true;
          const names = ZONES[G.run.system.id] || ZONES.genesis;
          G.vacuum = true;
          vacuumAll();
          if (cine.transit('BOSS ARENA', names[names.length - 1], true)) break;
        }
        if (d.arena) G.vacuum = false;
        d.t = 0;
        if (spec.boss) {
          d.state = 'warn';
          if (G.mode === 'run') {
            const b = bossById(spec.boss);
            banner('WARNING', 'BOSS INCOMING', '#ff2e55', 3);
            if (d.onWarn) d.onWarn(b, spec);
            sfx.warn();
            music.bossTrack(bossIndex(spec.boss));
          }
        } else {
          sectorClear();
        }
      }
      break;
    case 'warn':
      if (d.t > 3) {
        spawnBoss(spec.boss, spec.level, spec.loop, spec.bossHp || 1);
        d.state = 'boss';
        d.t = 0;
      }
      break;
    case 'boss':
      if (!G.boss) {
        d.state = 'bossDown';
        d.t = 0;
      }
      break;
    case 'bossDown':
      if (d.t > 1.4 && !cine.busy) {
        if (G.mode === 'run') music.setSet(local >= 6 ? 'late' : 'normal');
        sectorClear();
      }
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
    } else if (run) banner('NODE CLEAR', sub, '#7dff6b', 2.2, 'clear', `${run.system.short}  ·  NODE ${(d.spec.row ?? 0) + 1}`);
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
