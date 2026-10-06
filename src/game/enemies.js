// Enemy roster: spawning, behaviours, damage and death rewards.

import { G, view, field } from './state.js';
import { S, ENEMY_COLORS } from '../render/sprites.js';
import { rand, damp, TAU, clamp, chance, dist2 } from '../core/math.js';
import { shoot, ring, fan, aimAt } from './bullets.js';
import { explosion, sparks, damageNumber, addShake, floatText, hitstop, ring as fxRing } from './fx.js';
import { dropXp, dropPickup } from './pickups.js';
import { dropKillCredits } from './economy.js';
import { rollRelicDrop } from './collectables.js';
import { rollGearDrop } from './loot.js';
import { sfx } from '../core/audio.js';
import { onEnemyKilled } from './player.js';
import { onKill as cineOnKill } from './cinematic.js';
import { onEliteKilled } from './pilot.js';
import { bossDamaged, updateBoss, every } from './bosses.js';
import { armorOf, onPlayerHit, slowOf, updateStatus, applyStatus } from './status.js';

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
  // Step 6a roster. `keep` = never despawned for lingering / leaving the screen; `plain` = no elite roll.
  carrier: { hp: 60, r: 26, xp: 12, score: 1200, spr: 'carrier' },
  shielder: { hp: 18, r: 15, xp: 5, score: 500, spr: 'shielder' },
  weaver: { hp: 12, r: 13, xp: 4, score: 400, spr: 'weaver', plain: true },
  blinker: { hp: 10, r: 13, xp: 4, score: 450, spr: 'blinker' },
  hunter: { hp: 110, r: 24, xp: 40, score: 6000, spr: 'hunter', keep: true, plain: true }, // elite-node mini-boss; hp scales with the sector level, not diff.hp (see spawnEnemy)
  eclipsedrone: { hp: 30, r: 11, xp: 3, score: 500, spr: 'eclipseDrone', keep: true, plain: true }, // ECLIPSE's Dark Fortress turrets
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
  // The Hunter is a mini-boss: ~15-25s to kill with a typical build, so it scales very gently with level (+3% per level) instead of diff.hp.
  let hp = type === 'hunter' ? def.hp * (1 + 0.03 * (G.director.spec ? G.director.spec.level : 1)) : def.hp * d.hp;
  if (opts.elite || (!opts.plain && type !== 'swarm' && type !== 'mine' && !def.plain && G.sector + G.loop * 9 >= 2 && chance(0.04 + 0.008 * G.sector + (d.eliteBonus || 0)))) {
    e.elite = true;
    hp *= 3.2;
    e.r *= 1.2;
    e.xp *= 5;
    e.score *= 4;
  }
  e.hp = hp;
  e.maxHp = hp;
  if (def.keep) e.keep = true;
  if (type === 'hunter') {
    e.hunter = true;
    e.name = 'HUNTER';
    e.gap = 1;
    e.cycle = 0;
  } else if (type === 'blinker') {
    e.alpha = 0; // fades in
    e.state = 'in';
    e.invuln = true;
    e.sp = false;
  } else if (type === 'carrier') {
    e.launches = 0;
  }
  if (type === 'snake') {
    e.trail = [];
    e.parts = [];
    for (let i = 0; i < 9; i++) e.parts.push({ x, y, r: i === 0 ? e.r : 9 });
  }
  if (field.ow) {
    // Overworld enemy: overworld.js drives it (owAI) instead of the fight behaviours.
    e.ow = true;
    e.state = 'idle';
    e.alpha = undefined;
    e.invuln = false;
  }
  G.enemies.push(e);
  return e;
}

let owAI = null; // (e, dt) => void, set by overworld.js
export function setOverworldAI(fn) {
  owAI = fn;
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

// Snake body: segments follow the head's trail at fixed spacing (the fight and the overworld both move the head).
export function snakeBody(e) {
  e.trail.unshift(e.x, e.y);
  if (e.trail.length > 400) e.trail.length = 400;
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
    snakeBody(e);
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
          // Later sectors: also lob a shootable shell that bursts into a ring if it is left alone.
          if (e.elite || G.sector + G.loop * 9 >= 3) {
            shoot(e.x, e.y, aimAt(e.x, e.y), 105, 'shell', { hp: 3.5 * Math.sqrt(G.director.diff.hp), acc: -50, fuse: 2.6, burst: e.elite ? 12 : 9 });
          }
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

// --- Step 6a behaviours -------------------------------------------------------------

// Carrier: creeps down to a hover, then opens its bays (telegraphed by flashing) and launches 3 swarm pods that dive.
BEHAVIOR.carrier = function carrier(e, dt) {
  const fr = Math.sqrt(G.director.diff.fireRate);
  if (e.state === 'enter') {
    e.y += 42 * dt;
    e.x += Math.sin(e.t * 0.6 + e.ph) * 10 * dt;
    if (e.y >= e.ty) {
      e.state = 'hold';
      e.fireT = 1.4;
    }
  } else if (e.state === 'hold') {
    e.x = clamp(e.x + Math.sin(e.t * 0.6 + e.ph) * 16 * dt, 40, view.W - 40);
    e.fireT -= dt * fr;
    if (e.fireT < 0.5) e.flash = Math.sin(e.t * 45) > 0 ? 0.05 : 0; // bay-open warning
    if (e.fireT <= 0) {
      e.fireT = 3.8;
      e.launches++;
      for (let i = -1; i <= 1; i++) {
        const tx = clamp(e.x + i * 40, 20, view.W - 20);
        const pod = spawnEnemy('swarm', e.x + i * 10, e.y + 18, { mv: 'dive', tx, ty: e.y + 62 + Math.abs(i) * 10 });
        pod.entered = true;
      }
      sparks(e.x, e.y + 20, e.color, 10, 190, Math.PI / 2, 1.6);
      sfx.zap();
      if (e.launches >= (e.elite ? 4 : 3)) e.state = 'leave';
    }
  } else {
    e.vy += 120 * dt;
    e.y += e.vy * dt;
  }
};

const LINK_R = 210;

export function relink(e) {
  const L = e.links || (e.links = []);
  for (let i = L.length - 1; i >= 0; i--) {
    const o = L[i];
    if (o.dead || dist2(e.x, e.y, o.x, o.y) > (LINK_R + 40) * (LINK_R + 40)) {
      if (o.shieldedBy === e) o.shieldedBy = null;
      L.splice(i, 1);
    }
  }
  if (L.length >= 3) return;
  let cand = null;
  for (const o of G.enemies) {
    if (o === e || o.dead || o.boss || o.hunter || o.type === 'shielder' || o.shieldedBy || !o.entered) continue;
    const d2 = dist2(e.x, e.y, o.x, o.y);
    if (d2 > LINK_R * LINK_R) continue;
    (cand || (cand = [])).push({ o, d2 });
  }
  if (!cand) return;
  cand.sort((a, b) => a.d2 - b.d2);
  for (let i = 0; i < cand.length && L.length < 3; i++) {
    cand[i].o.shieldedBy = e;
    L.push(cand[i].o);
  }
}

// Shielder: hovers and tethers a shield to up to 3 nearby enemies (-80% damage) for as long as it lives.
BEHAVIOR.shielder = function shielder(e, dt) {
  moveCommon(e, dt);
  e.rot += dt * 1.1;
  e.linkT = (e.linkT || 0) - dt;
  if (e.linkT <= 0) {
    e.linkT = 0.35;
    relink(e);
  }
  if (e.state === 'hold') {
    e.fireT -= dt * G.director.diff.fireRate;
    if (e.fireT <= 0) {
      e.fireT = 3;
      fan(e.x, e.y, aimAt(e.x, e.y), 3, 0.5, 125, 'small');
    }
  }
};

// Weaver: a pair of nodes (partner links them) drift down in parallel; the lead node owns the tripwire beam.
export function spawnWeavers(cx, y, gap = 200) {
  const o = { mv: 'down', speed: 66, wa: 34, wf: 1.1, ph: 0 };
  const a = spawnEnemy('weaver', cx - gap / 2, y, o);
  const b = spawnEnemy('weaver', cx + gap / 2, y, o);
  a.partner = b;
  b.partner = a;
  a.lead = true;
  return [a, b];
}

BEHAVIOR.weaver = function weaver(e, dt) {
  moveCommon(e, dt);
  e.rot += dt * 2.4;
  weaverBeam(e);
};

// The lead node's tripwire to its partner (fight and overworld).
export function weaverBeam(e) {
  if (!e.lead) return;
  const o = e.partner;
  const bm = e.beam;
  if (!bm) {
    if (o && !o.dead && e.y > 14 && o.y > 14 && !e.cut) {
      // Thin flickering telegraph for 0.6s (updateBeams counts `tele` down), then it is lethal.
      e.beam = { owner: 'enemy', src: e, x: e.x, y: e.y, ox: 0, oy: 0, ang: 0, len: 1, w: 5, tele: 0.6, life: 9999, spin: 0, aimSpin: 0 };
      G.beams.push(e.beam);
      sfx.warn();
    }
  } else if (!o || o.dead) {
    bm.tele = 0;
    bm.life = 0; // updateBeams drops it
    e.beam = null;
    e.cut = true;
  } else {
    bm.ang = Math.atan2(o.y - e.y, o.x - e.x);
    bm.len = Math.hypot(o.x - e.x, o.y - e.y);
  }
}

// Blinker spot: near-but-not-on the player (>= 140px away), inside the upper play area.
function blinkSpot(e) {
  const p = G.player;
  for (let i = 0; i < 12; i++) {
    const a = rand(0, TAU);
    const d = rand(150, 250);
    const x = clamp(p.x + Math.cos(a) * d, 40, view.W - 40);
    const y = clamp(p.y + Math.sin(a) * d, view.safeTop + 70, view.H * 0.62);
    if (dist2(x, y, p.x, p.y) >= 140 * 140) {
      e.x = x;
      e.y = y;
      return;
    }
  }
  e.x = clamp(p.x + (p.x < view.W / 2 ? 170 : -170), 40, view.W - 40);
  e.y = view.safeTop + 110;
}
export { blinkSpot };

// Blinker: fade in → telegraph 0.5s → ring of 10-14 → fade out and teleport near the player; repeats `shots` times then leaves.
BEHAVIOR.blinker = function blinker(e, dt) {
  e.rot += dt * 1.6;
  if (e.state === 'in') {
    if (!e.sp) {
      e.sp = true;
      sparks(e.x, e.y, e.color, 12, 200);
    }
    e.alpha = Math.min(1, e.alpha + dt * 4);
    e.invuln = e.alpha < 0.7;
    if (e.alpha >= 1) {
      e.state = 'tele';
      e.timer = 0.5;
    }
  } else if (e.state === 'tele') {
    e.timer -= dt;
    if (e.timer <= 0) {
      const n = 10 + Math.min(4, Math.floor(G.director.spec.level / 3)) + (e.elite ? 2 : 0);
      ring(e.x, e.y, Math.min(n, 14), 120, 'orb', rand(0, TAU));
      sparks(e.x, e.y, e.color, 8, 180);
      sfx.zap();
      e.shots--;
      e.state = 'rest';
      e.timer = 0.55;
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
      if (e.shots > 0) {
        blinkSpot(e);
        e.state = 'in';
        e.sp = false;
      } else {
        e.dead = true; // leaves without a reward
      }
    }
  }
};

// Hunter attack patterns (boss-style: return true when finished).
const HUNTER_ATK = {
  needles(e, a, dt, fr) {
    every(a, dt, 0.42 / fr, () => fan(e.x, e.y + 16, aimAt(e.x, e.y + 16), 3, 0.26, 235, 'needle', { acc: 150, maxSpeed: 380 }));
    return a.n >= 6;
  },
  spiral(e, a, dt, fr) {
    a.t2 = (a.t2 || 0) + dt;
    every(a, dt, 0.075 / fr, () => {
      shoot(e.x, e.y, a.t2 * 3.2, 125, 'small');
      shoot(e.x, e.y, a.t2 * 3.2 + Math.PI, 125, 'small');
    });
    return a.t2 > 2.4;
  },
};
const HUNTER_CYCLE = ['needles', 'spiral'];

// Hunter: strafes across the top and alternates aimed needle bursts with a spiral.
BEHAVIOR.hunter = function hunter(e, dt) {
  const px = e.x;
  const fr = Math.min(1.6, G.director.diff.fireRate) * (e.hp < e.maxHp * 0.5 ? 1.25 : 1);
  if (e.state === 'enter') {
    e.y = damp(e.y, e.ty, 1.8, dt);
    e.x = damp(e.x, view.W / 2, 1.8, dt);
    if (Math.abs(e.y - e.ty) < 8) e.state = 'fight';
  } else {
    e.x = damp(e.x, view.W / 2 + Math.sin(e.t * 0.75) * view.W * 0.34, 3, dt);
    e.y = damp(e.y, e.ty + Math.sin(e.t * 1.4) * 12, 3, dt);
    if (e.atk) {
      if (HUNTER_ATK[e.atk.name](e, e.atk, dt, fr)) {
        e.atk = null;
        e.gap = 0.9 / fr;
      }
    } else {
      e.gap -= dt;
      if (e.gap <= 0) e.atk = { name: HUNTER_CYCLE[e.cycle++ % HUNTER_CYCLE.length], n: 0 };
    }
  }
  e.rot = clamp((px - e.x) * 0.12, -0.4, 0.4);
};

// ECLIPSE's Dark Fortress turret drone: orbits its owner and takes potshots; dies with it.
BEHAVIOR.eclipsedrone = function eclipsedrone(e, dt) {
  const o = e.owner;
  if (!o || o.dead || o.state === 'dying') {
    killEnemy(e, true);
    return;
  }
  e.oa += dt * 1.5 * e.dir;
  const R = 96 + Math.sin(e.t * 2 + e.ph) * 6;
  e.x = o.x + Math.cos(e.oa) * R;
  e.y = o.y + Math.sin(e.oa) * R * 0.78;
  e.rot = aimAt(e.x, e.y) - Math.PI / 2;
  e.fireT -= dt * G.director.diff.fireRate;
  if (e.fireT <= 0) {
    e.fireT = 1.6;
    fan(e.x, e.y, aimAt(e.x, e.y), 2, 0.16, 190, 'needle', { acc: 90, maxSpeed: 300 });
  }
};

export function updateEnemies(dt) {
  const arr = G.enemies;
  for (const e of arr) {
    if (e.dead) continue;
    if (e.fx || e.frozenT > 0) {
      updateStatus(e, dt, damageEnemy);
      if (e.dead) continue;
    }
    const real = dt;
    if (e.fx || e.frozenT > 0) dt = real * slowOf(e); // Freeze: slowed (or locked) behaviour clock
    e.t += dt;
    if (e.flash > 0) e.flash -= real;
    if (e.boss) updateBoss(e, dt);
    else if (e.ow) {
      owAI(e, dt); // sets e.entered (on camera) and handles its own despawning
      dt = real;
      continue;
    } else BEHAVIOR[e.type](e, dt);
    dt = real;
    if (!e.entered && inBounds(e, -e.r * 0.5)) e.entered = true;
    // Despawn once they leave the play area (after having entered), or if stuck off-screen.
    if (!e.boss && !e.keep && ((e.entered && !inBounds(e, 70)) || e.t > 30 || (!e.entered && e.t > 9))) e.dead = true;
  }
  let w = 0;
  for (const e of arr) {
    if (!e.dead) arr[w++] = e;
  }
  arr.length = w;
}

// --- Damage & death -----------------------------------------------------------------

// `src` marks damage that comes from a shared system, not a direct hit: 'dot' (burn: ignores armor and shields, no procs),
// 'pct' (% hull) and 'det' (detonation) take armor but never trigger procs themselves.
export function damageEnemy(e, dmg, x, y, crit = false, src = '') {
  if (e.dead || e.invuln) return false;
  if (e.shieldedBy && src !== 'dot') {
    // Shielder link: -80% damage while the shielder lives.
    if (e.shieldedBy.dead) e.shieldedBy = null;
    else {
      dmg *= 0.2;
      sparks(x ?? e.x, y ?? e.y, '#7aa7ff', 2, 110);
    }
  }
  const pl = G.player;
  if (pl) {
    const st = pl.st;
    if (st.exec) dmg *= e.boss ? 1.1 : e.hp < e.maxHp * 0.3 ? 1.4 : 1; // Executioner
    if (st.redline) dmg *= 1 + st.redline * Math.max(0, pl.maxHp - pl.hp);
    if (st.bounty && (e.boss || e.elite || e.hunter)) dmg *= 1 + st.bounty;
    if (st.chainDmg) dmg *= 1 + st.chainDmg * Math.min(14, Math.floor(G.combo / 12)); // Chain Link: per x0.5 combo step
    if (st.shatter && (e.frozenT > 0 || (e.fx && e.fx.freeze))) dmg *= 1 + st.shatter; // Cryostasis: +50% vs frozen
  }
  if (pl && src !== 'dot') dmg *= 1 - armorOf(e, pl.st); // armor (Armor Piercing and Corrosive lower it)
  e.hp -= dmg;
  e.flash = 0.06;
  damageNumber(x ?? e.x, y ?? e.y, dmg, crit, e);
  if (pl && !src) onPlayerHit(e, dmg, x ?? e.x, y ?? e.y, damageEnemy); // statuses, marks, % hull
  if (e.boss) {
    bossDamaged(e, dmg);
    return false;
  }
  if (pl && pl.st.cull && e.hp > 0 && e.hp < e.maxHp * pl.st.cull) {
    // Culling Edge
    e.hp = 0;
    sparks(e.x, e.y, '#ffe14d', 6, 220);
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
  rollRelicDrop(e);
  rollGearDrop(e);
  if (e.hunter) {
    dropPickup(e.x - 10, e.y, 'heart');
    dropPickup(e.x + 10, e.y, chance(0.5) ? 'magnet' : 'cell');
    floatText(e.x, e.y - 24, 'HUNTER DOWN', '#ff3b3b', 16, 1.6);
    addShake(0.4);
    if (G.player) onEliteKilled(G.player);
  } else if (e.elite) {
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
  if (G.player && G.player.st.cinder && e.fx && e.fx.burn) {
    const stacks = Math.max(1, e.fx.burn.n);
    fxRing(e.x, e.y, 80, '#ff8a2b', 0.35);
    sparks(e.x, e.y, '#ff8a2b', 8, 160);
    for (const o of G.enemies) {
      if (o !== e && !o.dead && dist2(e.x, e.y, o.x, o.y) < 80 * 80) {
        applyStatus(o, 'burn', stacks);
      }
    }
  }
  onEnemyKilled(e);
  cineOnKill(e); // last enemy of the node / a Hunter: finisher cam
}
