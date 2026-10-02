// Bosses: WARDEN (sector 3), HYDRA (sector 6), OMEGA (sector 9) and ECLIPSE (campaign system 4 only). They repeat
// with scaling on later loops. Each has three phases and an attack rotation.

import { G, view } from './state.js';
import { glow, S } from '../render/sprites.js';
import { TAU, damp, rand, clamp } from '../core/math.js';
import { shoot, ring, fan, aimAt, clearBullets } from './bullets.js';
import { explosion, addShake, flash, floatText, slowmo, hitstop, sparks } from './fx.js';
import { cine } from './cinematic.js';
import { spawnEnemy, killEnemy } from './enemies.js';
import { dropXp, dropPickup } from './pickups.js';
import { bossPayout } from './economy.js';
import { rollRelicDrop } from './collectables.js';
import { sfx } from '../core/audio.js';
import { addScore } from './player.js';

const BOSSES = [
  { id: 'warden', name: 'WARDEN', title: 'Siege Mech', hp: 2400, r: 40, color: '#ff7a18', homeY: 165 },
  { id: 'hydra', name: 'HYDRA', title: 'Bio-Leviathan', hp: 7500, r: 46, color: '#6dff4d', homeY: 200 },
  { id: 'omega', name: 'OMEGA', title: 'Core Intelligence', hp: 17000, r: 36, color: '#3ff6ff', homeY: 210 },
  // Campaign-only final boss: not part of the endless boss rotation (see endlessSpec: it only indexes the first 3).
  { id: 'eclipse', name: 'ECLIPSE', title: 'The Dark Signal', hp: 26000, r: 34, color: '#c23bff', homeY: 190 },
];

export const BOSS_IDS = BOSSES.map((b) => b.id);
export const bossById = (id) => BOSSES.find((b) => b.id === id) || BOSSES[BOSSES.length - 1];
// Music track index per boss (unknown ids fall back to the last).
export const bossIndex = (id) => (BOSS_IDS.includes(id) ? BOSS_IDS.indexOf(id) : BOSSES.length - 1);

export function spawnBoss(id, level, loop, hpMul = 1) {
  const def = bossById(id);
  const hp = def.hp * hpMul * Math.pow(3.2, loop) * (1 + 0.15 * loop);
  const e = {
    type: 'boss', boss: true, kind: def.id, name: def.name, title: def.title,
    x: view.W / 2, y: -160, vx: 0, vy: 0, r: def.r, hp, maxHp: hp, color: def.color,
    t: 0, flash: 0, rot: 0, dead: false, entered: true, invuln: true,
    state: 'enter', phase: 1, atk: null, gap: 1.2, cycle: 0, parts: [],
    xp: 80, score: 30000, barFill: 0, anim: 0, homeY: def.homeY,
  };
  if (def.id === 'eclipse') {
    e.alpha = 1;
    e.trail = [];
    e.drones = [];
  }
  G.enemies.push(e);
  G.boss = e;
  computeParts(e);
  return e;
}

const speedFor = (e) => (e.kind === 'eclipse' ? [1.08, 1.25, 1.45] : [1, 1.15, 1.32])[e.phase - 1] * (1 + G.loop * 0.12);

export function every(a, dt, interval, fn) {
  a.acc = (a.acc ?? 0) - dt;
  while (a.acc <= 0) {
    a.acc += interval;
    fn(a.n++);
  }
}

// --- ECLIPSE phase-3 ult copies (one per player class) ----------------------------------------------

function announceCopy(e, name) {
  floatText(e.x, e.y + 100, name, '#ff3df2', 17, 1.9);
  flash('194,59,255', 0.3);
  sfx.warn();
  addShake(0.25);
}

function slowPlayerBulletsNear(e, dt) {
  const r2 = 165 * 165;
  const f = Math.max(0, 1 - 7 * dt);
  for (const b of G.pBullets) {
    if (b.dead || b.speed < 110) continue;
    const dx = b.x - e.x;
    const dy = b.y - e.y;
    if (dx * dx + dy * dy > r2) continue;
    b.speed *= f;
    b.vx *= f;
    b.vy *= f;
  }
}

const COPY = {
  // STRIKER -> DARK OVERDRIVE: a burst of fast radial needles, then a frenzy of dense rings.
  striker(e, a, dt, sp) {
    if (!a.started) {
      a.started = true;
      a.t2 = 0;
      a.b = { n: 0 };
      e.frenzy = true;
      announceCopy(e, 'DARK OVERDRIVE');
      ring(e.x, e.y, 30, 235, 'needle', rand(0, TAU), { acc: 60, maxSpeed: 300 });
      explosion(e.x, e.y, '#ff3df2', 1.6);
    }
    a.t2 += dt;
    every(a, dt, 0.17 / sp, (n) => ring(e.x, e.y, 10, 150, 'small', a.t2 * 2.4 + n * 0.3));
    every(a.b, dt, 0.42, () => fan(e.x, e.y + 30, aimAt(e.x, e.y + 30), 5, 0.5, 215, 'needle', { acc: 100, maxSpeed: 330 }));
    if (a.t2 > 3.4) {
      e.frenzy = false;
      return true;
    }
    return false;
  },
  // ENGINEER -> DARK FORTRESS: 2 orbiting turret drones and a dome that makes ECLIPSE invulnerable until they die.
  engineer(e, a, dt, sp) {
    if (!a.started) {
      a.started = true;
      a.t2 = 0;
      announceCopy(e, 'DARK FORTRESS');
      e.drones = e.drones.filter((d) => !d.dead);
      if (!e.drones.length && (e.domes || 0) < 2) {
        e.domes = (e.domes || 0) + 1;
        for (let i = 0; i < 2; i++) {
          const d = spawnEnemy('eclipsedrone', e.x, e.y, {});
          d.entered = true;
          d.owner = e;
          d.oa = i * Math.PI;
          d.dir = 1;
          d.fireT = 0.9 + i * 0.6;
          e.drones.push(d);
        }
        e.dome = true;
        e.domeT = 0;
        e.invuln = true;
        explosion(e.x, e.y, '#c23bff', 1.4);
      }
    }
    a.t2 += dt;
    every(a, dt, 0.5 / sp, (n) => ring(e.x, e.y, 12, 125, 'orb', n * 0.4));
    return a.t2 > 1.7;
  },
  // GHOST -> DARK PHASE: time-warp (player bullets crawl near it) while it blinks around firing from each spot.
  ghost(e, a, dt, sp) {
    if (!a.started) {
      a.started = true;
      a.t2 = 0;
      a.bt = 0;
      e.blinkMode = true;
      e.warp = true;
      announceCopy(e, 'DARK PHASE');
    }
    a.t2 += dt;
    a.bt -= dt;
    if (a.bt <= 0) {
      a.bt = 0.95 / sp;
      sparks(e.x, e.y, '#c23bff', 12, 240);
      const oldX = e.x;
      for (let g = 0; g < 8; g++) {
        e.x = rand(70, view.W - 70);
        if (Math.abs(e.x - oldX) > 110) break;
      }
      e.y = e.homeY + view.safeTop + rand(-50, 90);
      sparks(e.x, e.y, '#ff3df2', 14, 260);
      fan(e.x, e.y + 30, aimAt(e.x, e.y + 30), 5, 0.6, 195, 'needle', { acc: 100, maxSpeed: 320 });
      ring(e.x, e.y, 10, 112, 'orb', rand(0, TAU));
      e.alpha = 0.3; // fades back in
    }
    if (a.t2 > 5) {
      e.blinkMode = false;
      e.warp = false;
      return true;
    }
    return false;
  },
};

// --- Attack sets ------------------------------------------------------------------

const ATTACKS = {
  warden: {
    cycles: [['fan', 'rings', 'torpedo'], ['spiral', 'fan', 'rings', 'torpedo'], ['spiral', 'rings', 'fan', 'torpedo', 'rings']],
    fan(e, a, dt, sp) {
      every(a, dt, 0.4 / sp, () => fan(e.x, e.y + 30, aimAt(e.x, e.y + 30), e.phase >= 2 ? 7 : 5, 0.8, 170));
      return a.n >= 5;
    },
    rings(e, a, dt, sp) {
      every(a, dt, 0.5 / sp, (n) => {
        const fast = e.phase === 3 && n % 2;
        ring(e.x, e.y, 14 + e.phase * 2, fast ? 155 : 120, fast ? 'small' : 'orb', n * 0.12);
      });
      return a.n >= 5;
    },
    torpedo(e, a, dt, sp) {
      if (a.n === undefined || a.n === 0) {
        a.n = 1;
        const hp = 9 * Math.sqrt(G.director.diff.hp);
        for (const s of [-1, 1]) shoot(e.x + s * 62, e.y + 20, Math.PI / 2 + s * 0.35, 80, 'torpedo', { hp, turn: 1.3, turnTime: 3.5, acc: 30, maxSpeed: 165 });
        a.acc = 0.5;
      }
      every(a, dt, 0.32 / sp, () => shoot(e.x, e.y + 30, aimAt(e.x, e.y + 30), 210, 'needle', { acc: 120, maxSpeed: 320 }));
      return a.n >= 6;
    },
    spiral(e, a, dt, sp) {
      a.t2 = (a.t2 || 0) + dt;
      every(a, dt, 0.065 / sp, (n) => {
        const ang = a.t2 * 3.1;
        shoot(e.x - 62, e.y + 10, ang, 135, 'small');
        shoot(e.x + 62, e.y + 10, -ang + Math.PI, 135, 'small');
      });
      return a.t2 > 2.8;
    },
    move(e, dt) {
      e.x = damp(e.x, view.W / 2 + Math.sin(e.t * 0.55) * view.W * 0.26, 3, dt);
      e.y = damp(e.y, e.homeY + view.safeTop + Math.sin(e.t * 1.1) * 16, 3, dt);
    },
    parts(e) {
      return [[0, 0, 42], [-62, 4, 20], [62, 4, 20]];
    },
  },

  hydra: {
    cycles: [['wobbleFan', 'flower', 'tips'], ['flower', 'brood', 'wobbleFan', 'tips'], ['rain', 'flower', 'tips', 'brood', 'wobbleFan']],
    wobbleFan(e, a, dt, sp) {
      every(a, dt, 0.6 / sp, () => fan(e.x, e.y + 40, aimAt(e.x, e.y + 40), 7, 1.15, 130, 'wobble', { wob: 18, wobF: 5 }));
      return a.n >= 3;
    },
    flower(e, a, dt, sp) {
      a.t2 = (a.t2 || 0) + dt;
      const arms = e.phase === 3 ? 6 : 5;
      every(a, dt, 0.1 / sp, () => {
        for (let i = 0; i < arms; i++) shoot(e.x, e.y, a.t2 * 1.25 + (i / arms) * TAU, 125, 'orb');
        if (e.phase >= 2) for (let i = 0; i < arms; i++) shoot(e.x, e.y, -a.t2 * 0.9 + (i / arms) * TAU, 95, 'small');
      });
      return a.t2 > 3.2;
    },
    tips(e, a, dt, sp) {
      every(a, dt, 0.16 / sp, (n) => {
        const tip = e.tips[n % e.tips.length];
        fan(tip.x, tip.y, aimAt(tip.x, tip.y), 3, 0.3, 190, 'needle', { acc: 80, maxSpeed: 300 });
      });
      return a.n >= e.tips.length * 2;
    },
    brood(e, a, dt) {
      if (!a.done) {
        a.done = true;
        for (let i = 0; i < 4; i++) {
          const tip = e.tips[(i * 2) % e.tips.length];
          spawnEnemy('swarm', tip.x, tip.y, { mv: 'home', speed: 150 }).entered = true;
        }
        ring(e.x, e.y, 10, 85, 'big', rand(0, TAU));
      }
      a.t2 = (a.t2 || 0) + dt;
      return a.t2 > 1.2;
    },
    rain(e, a, dt, sp) {
      a.t2 = (a.t2 || 0) + dt;
      every(a, dt, 0.05 / sp, (n) => {
        const tip = e.tips[n % e.tips.length];
        shoot(tip.x, tip.y, Math.PI / 2 + rand(-0.5, 0.5), rand(110, 170), 'small');
      });
      return a.t2 > 2.6;
    },
    move(e, dt) {
      e.x = damp(e.x, view.W / 2 + Math.sin(e.t * 0.4) * view.W * 0.2, 2, dt);
      e.y = damp(e.y, e.homeY + view.safeTop + Math.sin(e.t * 0.8) * 24, 2, dt);
      // Procedural tentacles.
      if (!e.tentacles) e.tentacles = Array.from({ length: 6 }, () => []);
      e.tips = e.tips || [];
      e.tentacles.forEach((joints, i) => {
        const base = Math.PI * 0.12 + (i / 5) * Math.PI * 0.76;
        let x = e.x + Math.cos(base) * 40;
        let y = e.y + Math.sin(base) * 50;
        joints.length = 0;
        joints.push(x, y);
        for (let j = 1; j <= 12; j++) {
          const ang = base + Math.sin(e.t * 1.7 + j * 0.45 + i * 1.3) * 0.5 * (j / 12) + Math.sin(e.t * 0.6 + i) * 0.25;
          x += Math.cos(ang) * 12;
          y += Math.sin(ang) * 12;
          joints.push(x, y);
        }
        e.tips[i] = { x, y };
      });
    },
    parts(e) {
      const out = [[0, 0, 48]];
      if (e.tips) for (const t of e.tips) out.push([t.x - e.x, t.y - e.y, 12]);
      return out;
    },
  },

  omega: {
    cycles: [['doubleSpiral', 'laser', 'wall', 'burst'], ['laser', 'doubleSpiral', 'wall', 'burst'], ['chaos', 'laser', 'wall', 'doubleSpiral', 'burst']],
    doubleSpiral(e, a, dt, sp) {
      a.t2 = (a.t2 || 0) + dt;
      every(a, dt, 0.09 / sp, () => {
        for (let i = 0; i < 3; i++) {
          shoot(e.x, e.y, a.t2 * 1.5 + (i / 3) * TAU, 130, 'orb');
          shoot(e.x, e.y, -a.t2 * 1.5 + (i / 3) * TAU + 0.5, 115, 'small');
        }
      });
      return a.t2 > 3.6;
    },
    laser(e, a, dt, sp) {
      if (!a.started) {
        a.started = true;
        const base = aimAt(e.x, e.y);
        const pair = e.phase >= 2 ? [-1, 1, 0] : [-1, 1];
        for (const s of pair) {
          G.beams.push({
            owner: 'enemy', src: e, x: e.x, y: e.y, ang: base + s * 0.95, w: 9,
            tele: 1.0, life: 1.9, spin: -s * 0.42 * sp, aimSpin: 0,
          });
        }
        sfx.warn();
      }
      a.t2 = (a.t2 || 0) + dt;
      if (a.t2 > 1.1) every(a, dt, 0.45 / sp, () => fan(e.x, e.y, aimAt(e.x, e.y), 3, 0.5, 150, 'small'));
      return a.t2 > 3.1;
    },
    wall(e, a, dt, sp) {
      if (a.gx === undefined) a.gx = view.W / 2;
      every(a, dt, 0.62 / sp, () => {
        a.gx = clamp(a.gx + rand(-90, 90), 70, view.W - 70);
        const gap = 104 - e.phase * 6;
        for (let x = 12; x < view.W; x += 32) {
          if (Math.abs(x - a.gx) < gap / 2) continue;
          shoot(x, -10, Math.PI / 2, 115, 'big');
        }
      });
      return a.n >= 5;
    },
    burst(e, a, dt, sp) {
      every(a, dt, 0.5 / sp, (n) => ring(e.x, e.y, 22, 110, 'needle', n * 0.07 + aimAt(e.x, e.y), { acc: 90, maxSpeed: 260 }));
      return a.n >= 3;
    },
    chaos(e, a, dt, sp) {
      a.t2 = (a.t2 || 0) + dt;
      a.b = a.b || { n: 0 };
      every(a, dt, 0.12 / sp, () => {
        for (let i = 0; i < 4; i++) shoot(e.x, e.y, a.t2 * 2 + (i / 4) * TAU, 120, 'orb');
      });
      every(a.b, dt, 0.7, () => fan(e.x, e.y, aimAt(e.x, e.y), 5, 0.6, 170, 'needle'));
      return a.t2 > 3.6;
    },
    move(e, dt) {
      e.x = damp(e.x, view.W / 2 + Math.sin(e.t * 0.35) * view.W * 0.15, 2, dt);
      e.y = damp(e.y, e.homeY + view.safeTop + Math.sin(e.t * 0.7) * 14, 2, dt);
      e.anim += dt * (0.8 + e.phase * 0.35);
    },
    parts(e) {
      const out = [[0, 0, 38]];
      for (let i = 0; i < 6; i++) {
        const a = e.anim + (i / 6) * TAU;
        out.push([Math.cos(a) * 66, Math.sin(a) * 66, 11]);
      }
      return out;
    },
  },

  eclipse: {
    cycles: [
      ['mirrorFan', 'ring', 'dashLanes', 'mirrorFan'],
      ['mirrorFan', 'dashLanes', 'overdriveWave', 'ring', 'dashLanes'],
      ['copyUlt', 'dashLanes', 'mirrorFan', 'overdriveWave', 'ring'],
    ],
    // Aimed fans of needles/orbs; from phase 2 a ghostly mirror image (drawn) fires a second fan.
    mirrorFan(e, a, dt, sp) {
      every(a, dt, 0.46 / sp, (n) => {
        const cnt = e.phase >= 2 ? 7 : 5;
        const type = n % 2 ? 'orb' : 'needle';
        const opts = type === 'needle' ? { acc: 110, maxSpeed: 310 } : undefined;
        fan(e.x, e.y + 30, aimAt(e.x, e.y + 30), cnt, 0.8, type === 'needle' ? 185 : 150, type, opts);
        if (e.phase >= 2) {
          const mx = view.W - e.x;
          fan(mx, e.y + 30, aimAt(mx, e.y + 30), 3, 0.4, 170, 'small');
        }
      });
      return a.n >= 6;
    },
    ring(e, a, dt, sp) {
      every(a, dt, 0.56 / sp, (n) => ring(e.x, e.y, 16 + e.phase * 2, n % 2 ? 150 : 118, n % 2 ? 'small' : 'orb', n * 0.31));
      return a.n >= 5;
    },
    // Lanes are telegraphed for 0.8s, then ECLIPSE dashes lane to lane and each lane erupts as a lethal beam.
    dashLanes(e, a, dt, sp) {
      const TELE = 0.8;
      const STEP = 0.34 / sp;
      if (!a.lanes) {
        const n = e.phase + 1; // 2 / 3 / 4 lanes
        const p = G.player;
        const xs = [clamp(p.x + rand(-40, 40), 50, view.W - 50)];
        for (let g = 0; xs.length < n && g < 60; g++) {
          const x = rand(50, view.W - 50);
          if (xs.every((q) => Math.abs(q - x) > (n > 3 ? 92 : 120))) xs.push(x);
        }
        xs.sort((m, k) => Math.abs(m - e.x) - Math.abs(k - e.x));
        a.lanes = xs.map((x) => ({ x, dash: false, fired: false, t: 0 }));
        e.lanes = a.lanes;
        a.t2 = 0;
        e.dashX = a.lanes[0].x;
        e.dashSp = 420;
        sfx.warn();
      }
      a.t2 += dt;
      e.laneT = Math.min(1, a.t2 / TELE);
      let allFired = true;
      for (let i = 0; i < a.lanes.length; i++) {
        const ln = a.lanes[i];
        if (ln.fired) {
          ln.t += dt;
          continue;
        }
        allFired = false;
        if (!ln.dash && a.t2 >= TELE + i * STEP) {
          ln.dash = true;
          e.dashX = ln.x;
          e.dashSp = 1600;
          ln.at = a.t2;
        }
        if (ln.dash && (Math.abs(e.x - ln.x) < 16 || a.t2 > ln.at + 0.25)) {
          ln.fired = true;
          G.beams.push({ owner: 'enemy', boss: e, x: ln.x, y: -20, ang: Math.PI / 2, w: 18, tele: 0, life: 0.4, spin: 0, aimSpin: 0 });
          sparks(ln.x, e.y, '#ff3df2', 10, 260);
          addShake(0.15);
          fan(e.x, e.y + 30, aimAt(e.x, e.y + 30), 3, 0.5, 190, 'small');
        }
      }
      if (allFired && a.lanes[a.lanes.length - 1].t > 0.55) {
        e.lanes = null;
        e.dashX = undefined;
        return true;
      }
      return false;
    },
    // Phase 2+: pulse (telegraph), then a dense expanding ring with gaps placed either side of the player.
    overdriveWave(e, a, dt, sp) {
      const CHARGE = 0.95;
      const waves = e.phase === 3 ? 2 : 1;
      a.t2 = (a.t2 || 0) + dt;
      if (a.t2 < CHARGE) {
        if (!a.warned) {
          a.warned = true;
          sfx.warn();
        }
        e.pulse = a.t2 / CHARGE;
        return false;
      }
      e.pulse = 0;
      const k = a.fired || 0;
      if (k < waves && a.t2 >= CHARGE + k * 0.95) {
        a.fired = k + 1;
        const aim = aimAt(e.x, e.y);
        const dist = Math.max(120, Math.hypot(G.player.x - e.x, G.player.y - e.y));
        const half = clamp(46 / dist, 0.1, 0.34);
        const sgn = Math.random() < 0.5 ? -1 : 1;
        const gaps = [aim + sgn * rand(0.28, 0.55)];
        if (e.phase === 2) gaps.push(aim - sgn * rand(0.3, 0.6));
        const N = 84;
        const type = k % 2 ? 'small' : 'orb';
        for (let i = 0; i < N; i++) {
          const ang = (i / N) * TAU;
          let skip = false;
          for (const g of gaps) {
            let d = Math.abs(ang - ((g % TAU) + TAU) % TAU);
            if (d > Math.PI) d = TAU - d;
            if (d < half) skip = true;
          }
          if (!skip) shoot(e.x, e.y, ang, 138, type);
        }
        flash('194,59,255', 0.25);
        addShake(0.3);
        sfx.explode(1.5);
      }
      return a.t2 > CHARGE + waves * 0.95 + 0.3;
    },
    // Phase 3: copies the player's class ultimate.
    copyUlt(e, a, dt, sp) {
      const f = COPY[(G.player && G.player.cls) || 'striker'] || COPY.striker;
      return f(e, a, dt, sp);
    },
    move(e, dt) {
      if (e.blinkMode) return; // Dark Phase teleports it around
      for (let i = e.trail.length - 1; i >= 0; i--) {
        e.trail[i].a -= dt * 3.5;
        if (e.trail[i].a <= 0) e.trail.splice(i, 1);
      }
      if (e.dashX !== undefined) {
        const step = (e.dashSp || 1300) * dt;
        e.x += clamp(e.dashX - e.x, -step, step);
        e.y = damp(e.y, e.homeY + view.safeTop, 6, dt);
        e.trailT = (e.trailT || 0) - dt;
        if (e.trailT <= 0 && e.dashSp > 800) {
          e.trailT = 0.03;
          if (e.trail.length < 10) e.trail.push({ x: e.x, y: e.y, a: 0.55 });
        }
        return;
      }
      e.x = damp(e.x, view.W / 2 + Math.sin(e.t * 0.5) * view.W * 0.28, 2.4, dt);
      e.y = damp(e.y, e.homeY + view.safeTop + Math.sin(e.t * 0.9) * 14, 2.4, dt);
    },
    parts(e) {
      return [[0, 0, 34], [-52, -30, 17], [52, -30, 17]];
    },
  },
};

function computeParts(e) {
  const def = ATTACKS[e.kind].parts(e);
  e.parts.length = def.length;
  for (let i = 0; i < def.length; i++) {
    const p = e.parts[i] || (e.parts[i] = {});
    p.x = e.x + def[i][0];
    p.y = e.y + def[i][1];
    p.r = def[i][2];
  }
}

// Per-frame ECLIPSE bookkeeping: Dark Fortress dome, Dark Phase time-warp, blink fade-in.
function eclipseTick(e, dt) {
  if (e.alpha < 1) e.alpha = Math.min(1, e.alpha + dt * 3);
  if (e.warp) slowPlayerBulletsNear(e, dt);
  if (e.dome) {
    e.domeT = (e.domeT || 0) + dt;
    // Safety valve: drones the player cannot reach (or a bot that ignores them) must not make ECLIPSE invulnerable forever.
    if (e.domeT > 14) for (const d of e.drones) if (!d.dead) killEnemy(d, true);
    let alive = 0;
    for (const d of e.drones) if (!d.dead) alive++;
    if (!alive) {
      e.dome = false;
      e.invuln = false;
      explosion(e.x, e.y, '#c23bff', 2);
      floatText(e.x, e.y + 80, 'DOME DOWN', '#ffffff', 14, 1.2);
      flash('255,255,255', 0.3);
      addShake(0.4);
    }
  }
}

export function updateBoss(e, dt) {
  const set = ATTACKS[e.kind];
  if (e.state === 'enter') {
    e.y = damp(e.y, e.homeY + view.safeTop, 1.4, dt);
    e.barFill = Math.min(1, e.barFill + dt * 0.6);
    if (e.kind === 'omega') e.anim += dt;
    if (e.y > e.homeY - 12 + view.safeTop && e.barFill >= 1) {
      e.state = 'fight';
      e.invuln = false;
      e.gap = 0.6;
    }
  } else if (e.state === 'fight') {
    set.move(e, dt);
    if (e.kind === 'eclipse') eclipseTick(e, dt);
    if (e.phaseT > 0) {
      e.phaseT -= dt;
      if (e.phaseT <= 0) e.invuln = false;
    } else if (e.atk) {
      if (set[e.atk.name](e, e.atk, dt, speedFor(e))) {
        e.atk = null;
        e.gap = (e.kind === 'eclipse' ? 0.6 : 0.85) / speedFor(e);
      }
    } else {
      e.gap -= dt;
      if (e.gap <= 0) {
        const cyc = set.cycles[e.phase - 1];
        e.atk = { name: cyc[e.cycle % cyc.length], n: 0 };
        e.cycle++;
      }
    }
  } else if (e.state === 'dying') {
    e.dieT -= dt;
    e.x += rand(-1.5, 1.5);
    e.boomT = (e.boomT || 0) - dt;
    if (e.boomT <= 0) {
      e.boomT = 0.12;
      const pt = e.parts[(Math.random() * e.parts.length) | 0];
      explosion(pt.x + rand(-30, 30), pt.y + rand(-30, 30), Math.random() < 0.5 ? e.color : '#ffffff', rand(0.8, 1.6));
      sfx.explode(1.2);
      addShake(0.2);
    }
    if (e.dieT <= 0) finishBoss(e);
  }
  if (e.kind === 'hydra' && e.state !== 'fight') set.move(e, dt * 0.2);
  computeParts(e);
}

export function bossDamaged(e, dmg) {
  addScore(dmg * 1.5);
  if (e.state !== 'fight') return;
  const f = e.hp / e.maxHp;
  if ((e.phase === 1 && f < 0.66) || (e.phase === 2 && f < 0.33)) {
    if (e.hp > 0) {
      phaseShift(e);
      return;
    }
  }
  if (e.hp <= 0) startDeath(e);
}

function removeBossBeams(e) {
  // Flag in place (never reassign G.beams: callers may be mid-iteration or compacting it, e.g. an afterglow tick killing the boss).
  for (const b of G.beams) if (b.src === e || b.boss === e) b.dead = true;
}

// Drop any transient attack state (ECLIPSE lanes / dash / dome / warp) on a phase shift or death.
function resetAttackState(e) {
  if (e.kind !== 'eclipse') return;
  e.lanes = null;
  e.dashX = undefined;
  e.blinkMode = false;
  e.warp = false;
  e.frenzy = false;
  e.pulse = 0;
  e.alpha = 1;
  if (e.dome) {
    e.dome = false;
    for (const d of e.drones) if (!d.dead) killEnemy(d, true);
  }
}

function phaseShift(e) {
  e.phase++;
  e.atk = null;
  e.cycle = 0;
  e.invuln = true;
  e.phaseT = 1.1;
  e.gap = 0.4;
  resetAttackState(e);
  removeBossBeams(e);
  clearBullets(0, 0, Infinity, () => addScore(10));
  explosion(e.x, e.y, e.color, 2.5);
  flash('255,255,255', 0.4);
  addShake(0.6);
  hitstop(0.1);
  sfx.explode(3);
  floatText(e.x, e.y + 80, e.phase === 3 ? 'FINAL PHASE' : 'PHASE ' + e.phase, e.color, 16, 1.4);
}

function startDeath(e) {
  e.hp = 0;
  e.state = 'dying';
  e.invuln = true;
  e.dieT = 2.4;
  e.atk = null;
  resetAttackState(e);
  removeBossBeams(e);
  clearBullets(0, 0, Infinity, () => addScore(20));
  slowmo(1.3);
  hitstop(0.2);
  flash('255,255,255', 0.6);
  sfx.bossDie();
  // Finisher cam: holds on the boss through its death throes (ECLIPSE, the last boss, gets the biggest shot).
  // The throes are shortened so the slow-motion hold stays around 2.5 real seconds.
  if (cine.finisher(e, e.kind === 'eclipse' ? 'final' : 'boss', e.color)) e.dieT = 1.3;
}

function finishBoss(e) {
  e.dead = true;
  G.boss = null;
  G.bossKills++;
  G.rerolls++;
  explosion(e.x, e.y, e.color, 4);
  explosion(e.x, e.y, '#ffffff', 3);
  for (let i = 0; i < 10; i++) explosion(e.x + rand(-90, 90), e.y + rand(-70, 70), e.color, rand(1, 2));
  flash('255,255,255', 0.9);
  addShake(1);
  sfx.explode(3);
  addScore(e.score * (1 + G.loop));
  dropXp(e.x, e.y, Math.round(e.xp * G.director.diff.xp));
  dropPickup(e.x - 20, e.y, 'heart');
  dropPickup(e.x + 20, e.y, 'heart');
  rollRelicDrop(e);
  floatText(e.x, e.y, `${e.name} DESTROYED`, '#ffe14d', 18, 2);
  const bp = bossPayout();
  if (bp) floatText(e.x, e.y + 24, `+${bp} CREDITS`, '#ffd24a', 12, 2);
}

// --- Drawing ------------------------------------------------------------------------

function neon(ctx, color, lw, alphaGlow = 0.28) {
  ctx.save();
  ctx.globalAlpha *= alphaGlow;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw * 3.2;
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function path(ctx, pts, ox = 0, oy = 0) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0] + ox, pts[0][1] + oy);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + ox, pts[i][1] + oy);
  ctx.closePath();
}

export function drawBoss(ctx, e) {
  const g = glow(e.color, 64);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.35 + Math.sin(G.time * 3) * 0.08;
  ctx.drawImage(g.img, e.x - 130, e.y - 130, 260, 260);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  const hot = e.flash > 0;
  if (e.kind === 'warden') drawWarden(ctx, e, hot);
  else if (e.kind === 'hydra') drawHydra(ctx, e, hot);
  else if (e.kind === 'eclipse') drawEclipse(ctx, e, hot);
  else drawOmega(ctx, e, hot);
}

function drawWarden(ctx, e, hot) {
  const { x, y } = e;
  const c = e.phase === 3 ? '#ff3b3b' : e.color;
  const fill = hot ? '#3a1a22' : '#160a10';
  // Pods
  for (const s of [-1, 1]) {
    ctx.fillStyle = hot ? '#3a1a14' : '#1d0e0a';
    ctx.beginPath();
    ctx.roundRect(x + s * 62 - 16, y - 26, 32, 58, 6);
    ctx.fill();
    neon(ctx, c, 2);
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(G.time * 8 + s);
    ctx.fillRect(x + s * 62 - 6, y + 22, 12, 4);
    ctx.globalAlpha = 1;
  }
  // Hull
  const hull = [[-48, -40], [48, -40], [62, -4], [36, 44], [-36, 44], [-62, -4]];
  ctx.fillStyle = fill;
  path(ctx, hull, x, y);
  ctx.fill();
  neon(ctx, c, 2.6);
  // Mandibles
  for (const s of [-1, 1]) {
    path(ctx, [[s * 22, 40], [s * 34, 76], [s * 12, 58]], x, y);
    ctx.fillStyle = fill;
    ctx.fill();
    neon(ctx, c, 2);
  }
  // Panel lines
  ctx.strokeStyle = 'rgba(255,122,24,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 40, y - 22); ctx.lineTo(x + 40, y - 22);
  ctx.moveTo(x - 30, y + 30); ctx.lineTo(x + 30, y + 30);
  ctx.stroke();
  // Core
  const pulse = 0.6 + 0.4 * Math.sin(G.time * (4 + e.phase * 2));
  const cg = glow(e.phase === 3 ? '#ffffff' : c, 64);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = pulse;
  ctx.drawImage(cg.img, x - 36, y - 36, 72, 72);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y, 8 + pulse * 3, 0, TAU);
  ctx.fill();
  // Turrets tracking player
  const p = G.player;
  for (const s of [-1, 1]) {
    const tx = x + s * 36;
    const ty = y - 16;
    const a = p ? Math.atan2(p.y - ty, p.x - tx) : Math.PI / 2;
    ctx.strokeStyle = c;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + Math.cos(a) * 16, ty + Math.sin(a) * 16);
    ctx.stroke();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(tx, ty, 7, 0, TAU);
    ctx.fill();
    neon(ctx, c, 1.5);
  }
}

function drawHydra(ctx, e, hot) {
  const c = e.color;
  // Tentacles
  if (e.tentacles) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    e.tentacles.forEach((j, i) => {
      ctx.beginPath();
      ctx.moveTo(j[0], j[1]);
      for (let k = 2; k < j.length; k += 2) ctx.lineTo(j[k], j[k + 1]);
      ctx.strokeStyle = `hsla(${110 + i * 12},90%,25%,0.9)`;
      ctx.lineWidth = 11;
      ctx.stroke();
      ctx.strokeStyle = hot ? `hsl(${110 + i * 12},90%,75%)` : `hsl(${110 + i * 12},90%,55%)`;
      ctx.lineWidth = 3;
      ctx.stroke();
      const tx = j[j.length - 2];
      const ty = j[j.length - 1];
      ctx.fillStyle = '#c04dff';
      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, TAU);
      ctx.fill();
    });
  }
  // Body
  ctx.fillStyle = hot ? '#1d3a1e' : '#0b1f0c';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y, 48, 58, 0, 0, TAU);
  ctx.fill();
  neon(ctx, c, 2.6);
  ctx.fillStyle = hot ? '#3d1a55' : '#26083a';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y - 14, 30, 34, 0, 0, TAU);
  ctx.fill();
  neon(ctx, '#c04dff', 1.8);
  // Horns
  for (const s of [-1, 1]) {
    path(ctx, [[s * 30, -40], [s * 58, -86], [s * 14, -54]], e.x, e.y);
    ctx.fillStyle = hot ? '#45450f' : '#2a2a05';
    ctx.fill();
    neon(ctx, '#ffe14d', 1.8);
  }
  // Eye tracks the player
  const p = G.player;
  const a = p ? Math.atan2(p.y - e.y, p.x - e.x) : Math.PI / 2;
  const blink = e.phase === 3 ? '#ff3b3b' : '#ffe14d';
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y - 8, 16, 12, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = blink;
  ctx.beginPath();
  ctx.arc(e.x + Math.cos(a) * 7, e.y - 8 + Math.sin(a) * 5, 6, 0, TAU);
  ctx.fill();
}

function drawOmega(ctx, e, hot) {
  const c = e.phase === 3 ? '#ff3df2' : e.color;
  // Outer ring
  ctx.strokeStyle = 'rgba(63,246,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(e.x, e.y, 96, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = -e.anim * 0.7 + (i / 12) * TAU;
    const px = e.x + Math.cos(a) * 96;
    const py = e.y + Math.sin(a) * 96;
    path(ctx, [[0, -5], [5, 0], [0, 5], [-5, 0]], px, py);
    ctx.fillStyle = '#ff3df2';
    ctx.fill();
  }
  // Inner ring nodes (hittable)
  ctx.beginPath();
  ctx.arc(e.x, e.y, 66, 0, TAU);
  neon(ctx, c, 1.2, 0.2);
  for (let i = 0; i < 6; i++) {
    const a = e.anim + (i / 6) * TAU;
    const px = e.x + Math.cos(a) * 66;
    const py = e.y + Math.sin(a) * 66;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const b = (k / 6) * TAU + e.anim;
      ctx.lineTo(px + Math.cos(b) * 11, py + Math.sin(b) * 11);
    }
    ctx.closePath();
    ctx.fillStyle = hot ? '#14343f' : '#06141a';
    ctx.fill();
    neon(ctx, c, 1.8);
  }
  // Core
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const b = (k / 8) * TAU - e.anim * 0.5;
    ctx.lineTo(e.x + Math.cos(b) * 38, e.y + Math.sin(b) * 38);
  }
  ctx.closePath();
  ctx.fillStyle = hot ? '#132640' : '#050b14';
  ctx.fill();
  neon(ctx, c, 2.6);
  const pulse = 0.6 + 0.4 * Math.sin(G.time * 5);
  const cg = glow(c, 64);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = pulse;
  ctx.drawImage(cg.img, e.x - 40, e.y - 40, 80, 80);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(e.x, e.y, 9 + pulse * 3, 0, TAU);
  ctx.fill();
}

function drawEclipse(ctx, e, hot) {
  const spr = S.eclipse;
  const sz = spr.size;
  const p3 = e.phase === 3;
  // Lane telegraphs (before the lethal beam takes over).
  if (e.lanes) {
    ctx.globalCompositeOperation = 'lighter';
    for (const ln of e.lanes) {
      if (ln.fired) continue;
      const t = e.laneT || 0;
      ctx.globalAlpha = 0.07 + t * 0.14 + (t > 0.7 ? 0.1 * Math.sin(G.time * 40) : 0);
      ctx.fillStyle = '#ff3df2';
      ctx.fillRect(ln.x - 22, 0, 44, view.H);
      ctx.globalAlpha = 0.25 + t * 0.55;
      ctx.strokeStyle = '#ffd0f8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ln.x - 22, 0); ctx.lineTo(ln.x - 22, view.H);
      ctx.moveTo(ln.x + 22, 0); ctx.lineTo(ln.x + 22, view.H);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // Dash afterimages
  for (const t of e.trail) {
    ctx.globalAlpha = t.a * 0.5;
    ctx.drawImage(spr.img, t.x - sz / 2, t.y - sz / 2, sz, sz);
  }
  // Mirror image (mirrorFan, phase 2+)
  if (e.phase >= 2 && e.atk && e.atk.name === 'mirrorFan') {
    ctx.globalAlpha = 0.3 + 0.1 * Math.sin(G.time * 12);
    ctx.drawImage(spr.img, view.W - e.x - sz / 2, e.y - sz / 2, sz, sz);
  }
  // Body
  ctx.globalAlpha = (e.alpha ?? 1) * (e.state === 'dying' ? 0.7 + 0.3 * Math.sin(G.time * 40) : 1);
  ctx.drawImage(spr.img, e.x - sz / 2, e.y - sz / 2, sz, sz);
  if (hot) {
    // Soft hit flash so the black hull stays readable under sustained fire.
    ctx.globalAlpha *= 0.4;
    ctx.drawImage(spr.flash, e.x - sz / 2, e.y - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
  // Pulsing dark core
  const pulse = 0.5 + 0.5 * Math.sin(G.time * (4 + e.phase * 2));
  const cg = glow(p3 ? '#ffffff' : '#ff3df2', 64);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.25 + pulse * 0.35 + (e.frenzy ? 0.3 : 0);
  ctx.drawImage(cg.img, e.x - 30, e.y - 34, 60, 60);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // Overdrive-wave charge pulse
  if (e.pulse > 0) {
    const t = e.pulse;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const k = (t * 2.2 + i / 3) % 1;
      ctx.globalAlpha = (1 - k) * (0.35 + t * 0.5);
      ctx.strokeStyle = i % 2 ? '#ffffff' : '#ff3df2';
      ctx.lineWidth = 2 + (1 - k) * 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 150 * (1 - k) + 24, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // Frenzy aura (Dark Overdrive)
  if (e.frenzy) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(G.time * 30);
    ctx.strokeStyle = '#ff2e88';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 84 + Math.sin(G.time * 24) * 4, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // Dark Fortress dome
  if (e.dome) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#7a1fd0';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 74, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.7 + 0.2 * Math.sin(G.time * 6);
    ctx.strokeStyle = '#d58bff';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 74, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // Dark Phase time-warp field
  if (e.warp) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(G.time * 8);
    ctx.strokeStyle = '#9d7bff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = -G.time * 30;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 165, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
