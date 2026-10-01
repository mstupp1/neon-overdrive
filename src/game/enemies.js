// Enemy roster: spawning, behaviours, damage and death rewards.

import { G, view } from './state.js';
import { S, ENEMY_COLORS } from '../render/sprites.js';
import { rand, damp, TAU, clamp, chance, dist2 } from '../core/math.js';
import { shoot, ring, fan, aimAt } from './bullets.js';
import { explosion, sparks, damageNumber, addShake, floatText, hitstop } from './fx.js';
import { dropXp, dropPickup } from './pickups.js';
import { dropKillCredits } from './economy.js';
import { sfx } from '../core/audio.js';
import { onEnemyKilled } from './player.js';
import { bossDamaged, updateBoss } from './bosses.js';

export const TYPES = {
  dart: { hp: 3, r: 12, xp: 1, score: 100, spr: 'dart' },
  swarm: { hp: 1.3, r: 9, xp: 1, score: 60, spr: 'swarm' },
  spinner: { hp: 24, r: 20, xp: 5, score: 450, spr: 'spinner' },
  dasher: { hp: 7, r: 13, xp: 2, score: 250, spr: 'dasher' },
  snake: { hp: 40, r: 13, xp: 9, score: 900, spr: 'snakeHead' },
  sniper: { hp: 11, r: 15, xp: 3, score: 350, spr: 'sniper' },
  tank: { hp: 80, r: 27, xp: 14, score: 1400, spr: 'tank' },
  splitter: { hp: 15, r: 16, xp: 3, score: 300, spr: 'splitter' },
  mine: { hp: 5, r: 11, xp: 1, score: 120, spr: 'mine' },
};

export function spawnEnemy(type, x, y, opts = {}) {
  const def = TYPES[type];
  const d = G.director.diff;
  const e = {};
  e.type = type;
  e.x = x;
  e.y = y;
  e.vx = opts.vx || 0;
  e.vy = opts.vy || 0;
  e.r = def.r;
  e.spr = S[def.spr];
  e.color = ENEMY_COLORS[type];
  e.t = 0;
  e.flash = 0;
  e.rot = 0;
  e.dead = false;
  e.entered = false;
  e.elite = false;
  e.xp = def.xp;
  e.score = def.score;
  e.mv = opts.mv || 'down';
  e.fireT = opts.fireDelay ?? rand(0.6, 1.4);
  e.shots = opts.shots ?? 1;
  e.x0 = x;
  e.y0 = y;
  e.tx = opts.tx ?? x;
  e.ty = opts.ty ?? view.H * 0.3;
  e.stay = opts.stay ?? 6;
  e.wa = opts.wa ?? 0;
  e.wf = opts.wf ?? 2;
  e.ph = opts.ph ?? rand(0, TAU);
  e.speed = opts.speed ?? 120;
  e.curve = opts.curve || 0;
  e.state = 'enter';
  e.parts = null;
  let hp = def.hp * d.hp;
  if (opts.elite || (type !== 'swarm' && type !== 'mine' && G.sector + G.loop * 9 >= 2 && chance(0.04 + 0.008 * G.sector + (d.eliteBonus || 0)))) {
    e.elite = true;
    hp *= 3.2;
    e.r *= 1.2;
    e.xp *= 5;
    e.score *= 4;
  }
  e.hp = hp;
  e.maxHp = hp;
  if (type === 'snake') {
    e.trail = [];
    e.parts = [];
    for (let i = 0; i < 9; i++) e.parts.push({ x, y, r: i === 0 ? e.r : 9 });
  }
  G.enemies.push(e);
  return e;
}

// --- Behaviours -------------------------------------------------------------------

function inBounds(e, m = 0) {
  return e.x > -m && e.x < view.W + m && e.y > -m && e.y < view.H + m;
}

function moveCommon(e, dt) {
  const p = G.player;
  switch (e.mv) {
    case 'down': {
      e.y += e.speed * dt;
      e.x = e.x0 + Math.sin(e.t * e.wf + e.ph) * e.wa;
      e.vx = Math.cos(e.t * e.wf + e.ph) * e.wa * e.wf;
      e.vy = e.speed;
      break;
    }
    case 'home': {
      // Kamikaze: fall while steering toward the player horizontally.
      e.vy = e.speed;
      e.vx = damp(e.vx, clamp((p.x - e.x) * 2, -150, 150), 2, dt);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      break;
    }
    case 'sweep': {
      e.vy += e.curve * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      break;
    }
    case 'burst': {
      e.vx *= 1 - 2.5 * dt;
      e.vy = damp(e.vy, 160, 2.5, dt);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      break;
    }
    case 'hover': {
      if (e.state === 'enter') {
        e.x = damp(e.x, e.tx, 2.6, dt);
        e.y = damp(e.y, e.ty, 2.6, dt);
        if (Math.abs(e.y - e.ty) < 4) e.state = 'hold';
      } else if (e.state === 'hold') {
        e.stay -= dt;
        e.x += Math.sin(e.t * 0.9 + e.ph) * 12 * dt;
        if (e.stay <= 0) e.state = 'leave';
      } else if (e.state === 'leave') {
        e.vy += 260 * dt;
        e.y += e.vy * dt;
      }
      break;
    }
    case 'dive': {
      if (e.state === 'enter') {
        e.x = damp(e.x, e.tx, 3, dt);
        e.y = damp(e.y, e.ty, 3, dt);
        if (Math.abs(e.y - e.ty) < 5) {
          e.state = 'aim';
          e.timer = 0.45;
        }
      } else if (e.state === 'aim') {
        e.timer -= dt;
        e.rot = Math.atan2(p.y - e.y, p.x - e.x) - Math.PI / 2;
        if (e.timer <= 0) {
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          e.vx = Math.cos(a) * 60;
          e.vy = Math.sin(a) * 60;
          e.state = 'go';
        }
      } else {
        const sp = Math.hypot(e.vx, e.vy);
        const ns = Math.min(430, sp + 700 * dt);
        e.vx *= ns / sp;
        e.vy *= ns / sp;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      }
      break;
    }
  }
}

const BEHAVIOR = {
  dart(e, dt) {
    moveCommon(e, dt);
    if (e.mv !== 'dive' || e.state !== 'aim') e.rot = Math.atan2(e.vy, e.vx) - Math.PI / 2;
    if (e.shots > 0 && e.y > 30 && e.y < view.H * 0.6) {
      e.fireT -= dt * G.director.diff.fireRate;
      if (e.fireT <= 0) {
        e.shots--;
        e.fireT = 1.2;
        shoot(e.x, e.y, aimAt(e.x, e.y), 175);
      }
    }
  },
  swarm(e, dt) {
    moveCommon(e, dt);
    e.rot = Math.atan2(e.vy, e.vx) - Math.PI / 2;
  },
  spinner(e, dt) {
    moveCommon(e, dt);
    e.rot += dt * 1.6;
    if (e.state === 'hold') {
      e.fireT -= dt * G.director.diff.fireRate;
      if (e.fireT <= 0) {
        e.fireT = 2.3;
        const n = 8 + Math.min(6, Math.floor(G.sector / 2)) + (e.elite ? 4 : 0);
        ring(e.x, e.y, n, 125, 'orb', e.t * 0.7);
        sparks(e.x, e.y, e.color, 6, 160);
      }
    }
  },
  dasher(e, dt) {
    const p = G.player;
    if (e.state === 'enter' || e.state === 'hold') {
      e.x = damp(e.x, e.tx, 3, dt);
      e.y = damp(e.y, e.ty, 3, dt);
      e.rot = Math.atan2(p.y - e.y, p.x - e.x) - Math.PI / 2;
      if (Math.abs(e.y - e.ty) < 6 && e.state === 'enter') {
        e.state = 'tele';
        e.timer = 0.75;
      }
    } else if (e.state === 'tele') {
      e.timer -= dt;
      if (e.timer > 0.2) e.aim = Math.atan2(p.y - e.y, p.x - e.x);
      e.rot = e.aim - Math.PI / 2;
      e.x += rand(-1, 1);
      if (e.timer <= 0) {
        e.state = 'dash';
        e.vx = Math.cos(e.aim) * 640;
        e.vy = Math.sin(e.aim) * 640;
        if (G.sector + G.loop * 9 >= 5) fan(e.x, e.y, e.aim + Math.PI, 3, 0.9, 110, 'small');
      }
    } else {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (G.particles.length < 500 && Math.random() < 0.6) sparks(e.x, e.y, e.color, 1, 60);
    }
  },
  snake(e, dt) {
    e.y += 62 * dt;
    e.x = e.x0 + Math.sin(e.t * 1.5 + e.ph) * e.wa;
    e.trail.unshift(e.x, e.y);
    if (e.trail.length > 400) e.trail.length = 400;
    // Place body segments along the trail at fixed spacing.
    const parts = e.parts;
    parts[0].x = e.x;
    parts[0].y = e.y;
    let seg = 1;
    let acc = 0;
    const spacing = 15;
    for (let i = 2; i < e.trail.length && seg < parts.length; i += 2) {
      acc += Math.hypot(e.trail[i] - e.trail[i - 2], e.trail[i + 1] - e.trail[i - 1]);
      if (acc >= spacing * seg) {
        parts[seg].x = e.trail[i];
        parts[seg].y = e.trail[i + 1];
        seg++;
      }
    }
    for (; seg < parts.length; seg++) {
      parts[seg].x = parts[seg - 1].x;
      parts[seg].y = parts[seg - 1].y - 1;
    }
    e.rot = Math.atan2(e.y - parts[1].y, e.x - parts[1].x) - Math.PI / 2;
    if (e.y > 20 && e.y < view.H * 0.65) {
      e.fireT -= dt * G.director.diff.fireRate;
      if (e.fireT <= 0) {
        e.fireT = 1.9;
        fan(e.x, e.y, aimAt(e.x, e.y), 3, 0.5, 120, 'wobble', { wob: 22, wobF: 5 });
      }
    }
  },
  sniper(e, dt) {
    const p = G.player;
    if (e.state === 'enter') {
      e.x = damp(e.x, e.tx, 3, dt);
      e.y = damp(e.y, e.ty, 3, dt);
      if (Math.abs(e.x - e.tx) < 6 && Math.abs(e.y - e.ty) < 6) {
        e.state = 'aim';
        e.timer = 1.15 / Math.sqrt(G.director.diff.fireRate);
        e.aimMax = e.timer;
      }
    } else if (e.state === 'aim') {
      e.timer -= dt;
      if (e.timer > 0.28) e.aim = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.timer <= 0) {
        shoot(e.x, e.y, e.aim, 300, 'needle', { acc: 500, maxSpeed: 620 });
        if (e.elite) fan(e.x, e.y, e.aim, 3, 0.35, 280, 'needle', { acc: 400, maxSpeed: 560 });
        sparks(e.x, e.y, e.color, 8, 200, e.aim, 0.7);
        e.shots--;
        if (e.shots <= 0) {
          e.state = 'leave';
        } else {
          e.state = 'enter';
          e.tx = rand(50, view.W - 50);
          e.ty = rand(view.H * 0.12, view.H * 0.35);
        }
      }
    } else {
      e.vy -= 300 * dt;
      e.y += e.vy * dt;
    }
    e.rot += dt;
  },
  tank(e, dt) {
    moveCommon(e, dt);
    e.rot += dt * 0.4;
    if (e.state === 'hold') {
      e.fireT -= dt * G.director.diff.fireRate;
      if (e.fireT <= 0) {
        e.fireT = 0.11;
        e.burst = (e.burst || 0) + 1;
        const a = e.t * 2.2;
        const arms = e.elite ? 4 : 3;
        for (let i = 0; i < arms; i++) shoot(e.x, e.y, a + (i / arms) * TAU, 120, 'orb');
        if (e.burst >= 18) {
          e.burst = 0;
          e.fireT = 1.6;
          fan(e.x, e.y, aimAt(e.x, e.y), 5, 0.7, 150, 'big');
        }
      }
    }
  },
  splitter(e, dt) {
    moveCommon(e, dt);
    e.rot += dt * 2;
  },
  mine(e, dt) {
    const p = G.player;
    if (e.state === 'enter') {
      e.y += 55 * dt;
      e.x += Math.sin(e.t * 1.3 + e.ph) * 15 * dt;
      if (e.t > 3.5 && e.y > 60 && (dist2(e.x, e.y, p.x, p.y) < 110 * 110 || e.t > 6.5)) {
        e.state = 'arm';
        e.timer = 0.75;
      }
    } else if (e.state === 'arm') {
      e.timer -= dt;
      e.flash = Math.sin(e.timer * 40) > 0 ? 0.05 : 0;
      if (e.timer <= 0) {
        ring(e.x, e.y, 10 + (e.elite ? 6 : 0), 140, 'small', rand(0, TAU));
        explosion(e.x, e.y, e.color, 0.8);
        e.dead = true;
      }
    }
    e.rot += dt * 2;
  },
};

export function updateEnemies(dt) {
  const arr = G.enemies;
  for (const e of arr) {
    if (e.dead) continue;
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.boss) updateBoss(e, dt);
    else BEHAVIOR[e.type](e, dt);
    if (!e.entered && inBounds(e, -e.r * 0.5)) e.entered = true;
    // Despawn once they leave the play area (after having entered), or if stuck off-screen.
    if (!e.boss && ((e.entered && !inBounds(e, 70)) || e.t > 30 || (!e.entered && e.t > 9))) e.dead = true;
  }
  let w = 0;
  for (const e of arr) {
    if (!e.dead) arr[w++] = e;
  }
  arr.length = w;
}

// --- Damage & death -----------------------------------------------------------------

export function damageEnemy(e, dmg, x, y, crit = false) {
  if (e.dead || e.invuln) return false;
  const pl = G.player;
  if (pl && pl.st.exec) dmg *= e.boss ? 1.1 : e.hp < e.maxHp * 0.3 ? 1.4 : 1; // Executioner
  e.hp -= dmg;
  e.flash = 0.06;
  damageNumber(x ?? e.x, y ?? e.y, dmg, crit);
  if (e.boss) {
    bossDamaged(e, dmg);
    return false;
  }
  if (e.hp <= 0) {
    killEnemy(e);
    return true;
  }
  return false;
}

export function killEnemy(e, silent = false) {
  if (e.dead) return;
  e.dead = true;
  const big = e.r > 20 || e.elite;
  const size = e.type === 'tank' ? 2 : big ? 1.4 : e.type === 'swarm' ? 0.6 : 0.9;
  explosion(e.x, e.y, e.color, size);
  if (e.parts) for (let i = 1; i < e.parts.length; i += 2) explosion(e.parts[i].x, e.parts[i].y, e.color, 0.5);
  if (silent) return;
  sfx.explode(size);
  if (big) {
    addShake(0.25);
    hitstop(0.035);
  }
  const d = G.director.diff;
  dropXp(e.x, e.y, Math.max(1, Math.round(e.xp * d.xp)));
  dropKillCredits(e);
  if (e.elite) {
    dropPickup(e.x, e.y, chance(0.3) ? 'heart' : chance(0.5) ? 'magnet' : 'cell');
    floatText(e.x, e.y - 20, 'ELITE DOWN', '#ffd84d', 12, 1);
  } else if (chance(0.006)) dropPickup(e.x, e.y, 'heart');
  else if (chance(0.006)) dropPickup(e.x, e.y, 'magnet');
  else if (chance(0.01)) dropPickup(e.x, e.y, 'cell');

  if (e.type === 'splitter') {
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i / 3) * TAU + rand(-0.2, 0.2);
      spawnEnemy('swarm', e.x, e.y, { mv: 'burst', vx: Math.cos(a) * 240, vy: Math.sin(a) * 240 }).entered = true;
    }
  }
  onEnemyKilled(e);
}
