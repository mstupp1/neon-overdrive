// Bosses: WARDEN (sector 3), HYDRA (sector 6), OMEGA (sector 9). They repeat
// with scaling on later loops. Each has three phases and an attack rotation.

import { G, view } from './state.js';
import { glow } from '../render/sprites.js';
import { TAU, damp, rand, clamp } from '../core/math.js';
import { shoot, ring, fan, aimAt, clearBullets } from './bullets.js';
import { explosion, addShake, flash, floatText, slowmo, hitstop } from './fx.js';
import { spawnEnemy } from './enemies.js';
import { dropXp, dropPickup } from './pickups.js';
import { sfx } from '../core/audio.js';
import { addScore } from './player.js';

const BOSSES = [
  { id: 'warden', name: 'WARDEN', title: 'Siege Mech', hp: 2400, r: 40, color: '#ff7a18', homeY: 165 },
  { id: 'hydra', name: 'HYDRA', title: 'Bio-Leviathan', hp: 7500, r: 46, color: '#6dff4d', homeY: 200 },
  { id: 'omega', name: 'OMEGA', title: 'Core Intelligence', hp: 17000, r: 36, color: '#3ff6ff', homeY: 210 },
];

export const BOSS_IDS = BOSSES.map((b) => b.id);
export const bossById = (id) => BOSSES.find((b) => b.id === id) || BOSSES[BOSSES.length - 1];
// Music track index per boss (unknown ids fall back to the last).
export const bossIndex = (id) => (BOSS_IDS.includes(id) ? BOSS_IDS.indexOf(id) : BOSSES.length - 1);

export function spawnBoss(id, level, loop) {
  const def = bossById(id);
  const hp = def.hp * Math.pow(3.2, loop) * (1 + 0.15 * loop);
  const e = {
    type: 'boss', boss: true, kind: def.id, name: def.name, title: def.title,
    x: view.W / 2, y: -160, vx: 0, vy: 0, r: def.r, hp, maxHp: hp, color: def.color,
    t: 0, flash: 0, rot: 0, dead: false, entered: true, invuln: true,
    state: 'enter', phase: 1, atk: null, gap: 1.2, cycle: 0, parts: [],
    xp: 80, score: 30000, barFill: 0, anim: 0, homeY: def.homeY,
  };
  G.enemies.push(e);
  G.boss = e;
  computeParts(e);
  return e;
}

const speedFor = (e) => [1, 1.15, 1.32][e.phase - 1] * (1 + G.loop * 0.12);

function every(a, dt, interval, fn) {
  a.acc = (a.acc ?? 0) - dt;
  while (a.acc <= 0) {
    a.acc += interval;
    fn(a.n++);
  }
}

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
    if (e.phaseT > 0) {
      e.phaseT -= dt;
      if (e.phaseT <= 0) e.invuln = false;
    } else if (e.atk) {
      if (set[e.atk.name](e, e.atk, dt, speedFor(e))) {
        e.atk = null;
        e.gap = 0.85 / speedFor(e);
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
  G.beams = G.beams.filter((b) => b.src !== e);
}

function phaseShift(e) {
  e.phase++;
  e.atk = null;
  e.cycle = 0;
  e.invuln = true;
  e.phaseT = 1.1;
  e.gap = 0.4;
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
  removeBossBeams(e);
  clearBullets(0, 0, Infinity, () => addScore(20));
  slowmo(1.3);
  hitstop(0.2);
  flash('255,255,255', 0.6);
  sfx.bossDie();
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
  floatText(e.x, e.y, `${e.name} DESTROYED`, '#ffe14d', 18, 2);
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
