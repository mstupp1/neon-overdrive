// Sector flow and wave spawning: intro → waves → (boss) → clear → reward draft.

import { G, view, sectorDifficulty, sectorInfo, isBossSector } from './state.js';
import { applyModifiers, patternMul } from './modifiers.js';
import { applyHeat } from './core.js';
import { rand, chance, weightedPick, randInt } from '../core/math.js';
import { spawnEnemy, spawnWeavers, blinkSpot } from './enemies.js';
import { spawnBoss, bossById, bossIndex, BOSS_IDS } from './bosses.js';
import { banner, floatText } from './fx.js';
import { vacuumAll } from './pickups.js';
import { sectorPayout } from './economy.js';
import { onSectorClear as onPilotSectorClear } from './pilot.js';
import { bg } from '../render/background.js';
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
  d.duration = spec.duration;
  bg.setHue(spec.hue);
  bg.setTheme(G.run && G.run.mode === 'campaign' ? G.run.system.id : null);
  G.vacuum = false;
  if (G.mode === 'run') {
    // Campaign banners count route rows (spec.row), not sectors fought.
    banner(`SECTOR ${spec.row != null ? spec.row + 1 : spec.index}`, spec.name + (spec.loop ? `  ·  LOOP ${spec.loop + 1}` : ''), `hsl(${spec.hue},100%,70%)`, 2.6);
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
        const pat = weightedPick(pool, (p) => p.w(local) * patternMul(spec.modifiers, p.id));
        d.last = pat.id;
        pat.run();
        d.spawnT = pat.cost * 1.35 * d.diff.spawn + rand(0, 0.5);
      }
      if (d.sectorT >= d.duration) {
        d.state = 'clearing';
        d.t = 0;
      }
      break;
    }
    case 'clearing':
      d.progress = 1;
      // The Hunter never times out: the sector only clears once it is dead.
      if ((aliveEnemies() === 0 && !d.queue.length) || (d.t > 7 && !(d.hunter && !d.hunter.dead))) {
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
      if (d.t > 1.4) {
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
    banner('SECTOR CLEAR', `+${(1000 * G.sector).toLocaleString()} BONUS` + (cr ? `  ·  +${cr} CREDITS` : ''), '#7dff6b', 2.2);
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
