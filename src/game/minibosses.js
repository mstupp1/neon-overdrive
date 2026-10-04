// Mini bosses: the guards of each system's halfway Vault (campaign.js gives the middle-row vaults a `mini`). Beating one
// is how the run earns that system's Main Cannon +1 (main.js), then the Vault opens. They run on the boss framework in
// bosses.js (spawnBoss / updateBoss / parts / phase shift / death) with `e.mini = true`: two phases (ENRAGED below
// half HP), a compact attack rotation each, and a body drawn by render/miniArt.js.

import { G, view } from './state.js';
import { TAU, damp, rand, clamp } from '../core/math.js';
import { shoot, ring, fan, aimAt } from './bullets.js';
import { sparks, explosion, addShake } from './fx.js';
import { spawnEnemy } from './enemies.js';
import { sfx } from '../core/audio.js';

// hp is the base at Genesis (x SYSTEMS[].miniHp per system, x heat).
export const MINIS = [
  { id: 'razorwing', name: 'RAZORWING', title: 'Blade Interceptor', hp: 900, r: 24, color: '#ffb02e', homeY: 150 },
  { id: 'mauler', name: 'MAULER', title: 'Assault Frigate', hp: 1150, r: 28, color: '#ff4a3d', homeY: 140 },
  { id: 'broodmother', name: 'BROODMOTHER', title: 'Hive Carrier', hp: 1100, r: 30, color: '#ff4fd8', homeY: 150 },
  { id: 'specter', name: 'SPECTER', title: 'Phase Stalker', hp: 750, r: 22, color: '#9b7bff', homeY: 170 },
  { id: 'arclight', name: 'ARCLIGHT', title: 'Tesla Pylon', hp: 1250, r: 24, color: '#4fd6ff', homeY: 165 },
  { id: 'citadel', name: 'CITADEL', title: 'Bastion Turret', hp: 1100, r: 30, color: '#ffe14d', homeY: 150 },
];
export const MINI_IDS = MINIS.map((m) => m.id);
export const miniById = (id) => MINIS.find((m) => m.id === id) || null;

// Same contract as bosses.js every(): run fn every `interval` seconds, counting calls in a.n.
function every(a, dt, interval, fn) {
  a.acc = (a.acc ?? 0) - dt;
  while (a.acc <= 0) {
    a.acc += interval;
    fn(a.n++);
  }
}
const sub = (a, k) => a[k] || (a[k] = { n: 0 });
const top = () => view.safeTop;
const hpShell = (k) => k * Math.sqrt(G.director.diff.hp);

export const MINI_ATTACKS = {
  // --- RAZORWING: a blade interceptor. Crescent fans from the wingtips and telegraphed dives straight through you.
  razorwing: {
    cycles: [['crescent', 'dive', 'crescent', 'wingmen'], ['dive', 'crescent', 'dive', 'wingmen', 'crescent']],
    crescent(e, a, dt, sp) {
      every(a, dt, 0.5 / sp, (n) => {
        for (const s of [-1, 1]) {
          const x = e.x + s * 34;
          const y = e.y - 2;
          fan(x, y, aimAt(x, y) + s * 0.12, e.phase > 1 ? 5 : 4, 0.8, 175, 'needle', { acc: 90, maxSpeed: 300 });
        }
        if (n % 2) ring(e.x, e.y, 10, 105, 'small', n * 0.3);
      });
      return a.n >= (e.phase > 1 ? 5 : 4);
    },
    // Lock on (the line tracks you, then freezes), dash through the spot leaving a wake of slow shots, then fly home.
    // Phase 2 dives twice.
    dive(e, a, dt, sp) {
      const p = G.player;
      a.t2 = (a.t2 || 0) + dt;
      if (!a.st) {
        a.st = 'aim';
        a.t2 = 0;
        a.left = e.phase > 1 ? 2 : 1;
        e.hold = true;
        sfx.warn();
      }
      if (a.st === 'aim') {
        if (a.t2 < 0.5) {
          a.tx = p.x;
          a.ty = clamp(p.y, top() + 80, view.H - 40);
        }
        e.dive = { x0: e.x, y0: e.y, x1: a.tx, y1: a.ty, t: a.t2 / 0.8 };
        e.x += rand(-1, 1);
        if (a.t2 >= 0.8 / Math.sqrt(sp)) {
          a.st = 'go';
          a.t2 = 0;
          const L = Math.hypot(a.tx - e.x, a.ty - e.y) || 1;
          // Overshoot past the locked spot so standing still is never safe.
          a.vx = ((a.tx - e.x) / L) * 760;
          a.vy = ((a.ty - e.y) / L) * 760;
          a.go = Math.min(1.1, (L + 120) / 760);
          e.dive = null;
          addShake(0.2);
          sparks(e.x, e.y, e.color, 12, 260);
        }
      } else if (a.st === 'go') {
        e.x += a.vx * dt;
        e.y += a.vy * dt;
        e.rot = Math.atan2(a.vy, a.vx) - Math.PI / 2;
        every(sub(a, 'w'), dt, 0.045, () => {
          const ang = Math.atan2(a.vy, a.vx);
          for (const s of [-1, 1]) shoot(e.x, e.y, ang + s * Math.PI / 2, 38, 'small', { acc: 40, maxSpeed: 90 });
        });
        if (a.t2 >= a.go || e.y > view.H - 30 || e.x < 20 || e.x > view.W - 20) {
          a.st = 'back';
          a.t2 = 0;
          ring(e.x, e.y, e.phase > 1 ? 14 : 10, 120, 'orb', rand(0, TAU));
        }
      } else if (a.st === 'back') {
        e.x = damp(e.x, view.W / 2 + Math.sin(e.t * 0.9) * view.W * 0.3, 4, dt);
        e.y = damp(e.y, e.homeY + top(), 4, dt);
        e.rot = damp(e.rot, 0, 6, dt);
        if (a.t2 > 0.9) {
          if (--a.left > 0) {
            a.st = 'aim';
            a.t2 = 0;
            sfx.warn();
          } else {
            e.hold = false;
            e.rot = 0;
            return true;
          }
        }
      }
      return false;
    },
    wingmen(e, a, dt) {
      if (!a.done) {
        a.done = true;
        const n = e.phase > 1 ? 4 : 2;
        for (let i = 0; i < n; i++) {
          const s = i % 2 ? 1 : -1;
          spawnEnemy('swarm', e.x + s * 40, e.y, { mv: 'home', speed: 165 }).entered = true;
        }
        ring(e.x, e.y, 14, 115, 'small', rand(0, TAU));
      }
      a.t2 = (a.t2 || 0) + dt;
      return a.t2 > 1;
    },
    move(e, dt) {
      if (e.hold) return;
      e.x = damp(e.x, view.W / 2 + Math.sin(e.t * 0.9) * view.W * 0.3, 2.5, dt);
      e.y = damp(e.y, e.homeY + top() + Math.sin(e.t * 1.7) * 12, 3, dt);
    },
    parts: () => [[0, 0, 22], [-34, -6, 12], [34, -6, 12]],
  },

  // --- MAULER: an assault frigate. Twin gatling sponsons, a shootable torpedo salvo, broadside walls.
  mauler: {
    cycles: [['gatling', 'salvo', 'broadside'], ['salvo', 'gatling', 'broadside', 'gatling']],
    gatling(e, a, dt, sp) {
      a.t2 = (a.t2 || 0) + dt;
      every(a, dt, 0.075 / sp, (n) => {
        for (const s of [-1, 1]) {
          const ang = Math.PI / 2 + s * (0.15 + 0.55 * (0.5 + 0.5 * Math.sin(a.t2 * 2.1 + (s > 0 ? Math.PI : 0))));
          shoot(e.x + s * 46, e.y + 40, ang, 215, 'small');
        }
        e.muz = 0.05;
      });
      return a.t2 > (e.phase > 1 ? 3.2 : 2.6);
    },
    salvo(e, a, dt, sp) {
      if (!a.done) {
        a.done = true;
        const n = e.phase > 1 ? 6 : 4;
        for (let i = 0; i < n; i++) {
          const s = i % 2 ? 1 : -1;
          const k = Math.floor(i / 2);
          shoot(e.x + s * (12 + k * 8), e.y + 4, -Math.PI / 2 + s * (0.5 + k * 0.35), 120, 'torpedo', {
            hp: hpShell(6), turn: 1.5, turnTime: 3.2, acc: 40, maxSpeed: 175, delay: k * 0.15,
          });
        }
        sfx.warn();
      }
      every(a, dt, 0.5 / sp, () => fan(e.x, e.y + 30, aimAt(e.x, e.y + 30), 3, 0.3, 200, 'needle', { acc: 80, maxSpeed: 300 }));
      return a.n >= 4;
    },
    broadside(e, a, dt, sp) {
      every(a, dt, 0.55 / sp, (n) => {
        for (const s of [-1, 1]) fan(e.x + s * 46, e.y + 36, Math.PI / 2 + s * 0.35, 7, 1.1, 118, 'orb', { delay: n % 2 ? 0.12 : 0 });
        e.muz = 0.08;
      });
      return a.n >= (e.phase > 1 ? 5 : 4);
    },
    move(e, dt) {
      e.x = damp(e.x, view.W / 2 + Math.sin(e.t * 0.42) * view.W * 0.2, 2, dt);
      e.y = damp(e.y, e.homeY + top() + Math.sin(e.t * 0.9) * 10, 2, dt);
      if (e.muz > 0) e.muz -= dt;
    },
    parts: () => [[0, 0, 28], [-46, 12, 14], [46, 12, 14]],
  },

  // --- BROODMOTHER: a hive carrier. Lobs shootable egg shells that burst if left alone, spits, hatches swarms.
  broodmother: {
    cycles: [['spit', 'eggs', 'brood'], ['eggs', 'weep', 'spit', 'brood', 'eggs']],
    spit(e, a, dt, sp) {
      every(a, dt, 0.6 / sp, () => fan(e.x, e.y + 34, aimAt(e.x, e.y + 34), 7, 1.1, 125, 'wobble', { wob: 16, wobF: 5 }));
      return a.n >= 4;
    },
    eggs(e, a, dt, sp) {
      every(a, dt, 0.32 / sp, () => {
        const ang = aimAt(e.x, e.y + 34) + rand(-0.55, 0.55);
        shoot(e.x, e.y + 34, ang, rand(120, 160), 'shell', { hp: hpShell(4), acc: -60, fuse: 2.4, burst: e.phase > 1 ? 12 : 10 });
        e.pump = 0.25;
      });
      return a.n >= (e.phase > 1 ? 5 : 3);
    },
    brood(e, a, dt) {
      if (!a.done) {
        a.done = true;
        const n = e.phase > 1 ? 5 : 3;
        for (let i = 0; i < n; i++) spawnEnemy('swarm', e.x + (i - (n - 1) / 2) * 16, e.y + 30, { mv: 'home', speed: 150 }).entered = true;
        ring(e.x, e.y, 14, 90, 'orb', rand(0, TAU));
        e.pump = 0.4;
      }
      a.t2 = (a.t2 || 0) + dt;
      return a.t2 > 1.2;
    },
    // Phase 2: it weeps a curtain of slow drops from its flanks.
    weep(e, a, dt, sp) {
      a.t2 = (a.t2 || 0) + dt;
      every(a, dt, 0.06 / sp, (n) => {
        const s = n % 2 ? 1 : -1;
        shoot(e.x + s * rand(20, 40), e.y + 10, Math.PI / 2 + s * rand(0.1, 0.9), rand(90, 140), 'small');
      });
      return a.t2 > 2.4;
    },
    move(e, dt) {
      e.x = damp(e.x, view.W / 2 + Math.sin(e.t * 0.5) * view.W * 0.25, 2, dt);
      e.y = damp(e.y, e.homeY + top() + Math.sin(e.t * 1.0) * 20, 2, dt);
      if (e.pump > 0) e.pump -= dt;
    },
    parts: () => [[0, -4, 30], [0, 26, 14]],
  },

  // --- SPECTER: a phase stalker. Blinks around the field (untouchable while faded), scythe spirals, aimed lances.
  specter: {
    cycles: [['blink', 'scythe', 'lance'], ['blink', 'lance', 'scythe', 'blink', 'lance']],
    blink(e, a, dt, sp) {
      a.bt = (a.bt ?? 0.3) - dt;
      a.t2 = (a.t2 || 0) + dt;
      if (a.bt <= 0 && a.n < (e.phase > 1 ? 4 : 3)) {
        a.n++;
        a.bt = 0.85 / sp;
        e.ghost = { x: e.x, y: e.y, t: 0.5 };
        sparks(e.x, e.y, e.color, 14, 240);
        const ox = e.x;
        for (let g = 0; g < 8; g++) {
          e.ax = rand(70, view.W - 70);
          if (Math.abs(e.ax - ox) > 110) break;
        }
        e.ay = e.homeY + rand(-40, 110);
        e.x = e.ax;
        e.y = e.ay + top();
        e.alpha = 0.15;
        e.invuln = true;
        a.fire = 0.3;
        sparks(e.x, e.y, '#ffffff', 10, 220);
      }
      if (a.fire > 0) {
        a.fire -= dt;
        if (a.fire <= 0) {
          e.invuln = false;
          ring(e.x, e.y, e.phase > 1 ? 14 : 12, 112, 'orb', rand(0, TAU));
          fan(e.x, e.y, aimAt(e.x, e.y), 3, 0.35, 185, 'needle', { acc: 90, maxSpeed: 300 });
        }
      }
      return a.n >= (e.phase > 1 ? 4 : 3) && a.bt <= 0.2 && !(a.fire > 0);
    },
    scythe(e, a, dt, sp) {
      a.t2 = (a.t2 || 0) + dt;
      const arms = e.phase > 1 ? 3 : 2;
      every(a, dt, 0.085 / sp, () => {
        for (let i = 0; i < arms; i++) shoot(e.x, e.y, a.t2 * 2.3 + (i / arms) * TAU, 145, 'needle', { curve: 0.5 });
      });
      return a.t2 > 2.8;
    },
    lance(e, a, dt, sp) {
      if (!a.started) {
        a.started = true;
        a.t2 = 0;
        const base = aimAt(e.x, e.y);
        const set = e.phase > 1 ? [0, -0.42, 0.42] : [0];
        for (const s of set) G.beams.push({ owner: 'enemy', boss: e, src: e, x: e.x, y: e.y, ang: base + s, w: 10, tele: 0.85, life: 0.55, spin: 0, aimSpin: 0 });
        sfx.warn();
      }
      a.t2 += dt;
      if (a.t2 > 0.9) every(a, dt, 0.4 / sp, (n) => ring(e.x, e.y, 10, 120, 'small', n * 0.3));
      return a.t2 > 2;
    },
    move(e, dt) {
      if (e.ax === undefined) {
        e.ax = view.W / 2;
        e.ay = e.homeY;
      }
      e.x = damp(e.x, e.ax + Math.sin(e.t * 1.3) * 26, 2, dt);
      e.y = damp(e.y, e.ay + top() + Math.sin(e.t * 2.1) * 10, 2, dt);
      if (e.alpha < 1) e.alpha = Math.min(1, e.alpha + dt * 2.6);
      if (e.ghost && (e.ghost.t -= dt) <= 0) e.ghost = null;
    },
    parts: () => [[0, 0, 22]],
  },

  // --- ARCLIGHT: a tesla pylon. Two orbiting nodes; it stretches a sweeping arc between them, chains rings off them
  // and calls lightning down on your lane.
  arclight: {
    cycles: [['chain', 'arc', 'storm'], ['arc', 'storm', 'chain', 'arc', 'storm']],
    chain(e, a, dt, sp) {
      every(a, dt, 0.45 / sp, (n) => {
        for (const nd of nodes(e)) ring(nd.x, nd.y, e.phase > 1 ? 9 : 8, 120, 'small', n * 0.2);
      });
      return a.n >= 5;
    },
    arc(e, a, dt, sp) {
      a.t2 = (a.t2 || 0) + dt;
      if (!a.beam) {
        e.armT = e.phase > 1 ? 150 : 130;
        e.spinT = (a.dir = Math.random() < 0.5 ? -1 : 1) * (e.phase > 1 ? 1.25 : 1) * sp;
        a.beam = { owner: 'enemy', boss: e, x: e.x, y: e.y, ang: 0, len: 1, w: 8, tele: 1, life: 3.2, spin: 0, aimSpin: 0 };
        G.beams.push(a.beam);
        sfx.warn();
      }
      const [n1, n2] = nodes(e);
      a.beam.x = n1.x;
      a.beam.y = n1.y;
      a.beam.ang = Math.atan2(n2.y - n1.y, n2.x - n1.x);
      a.beam.len = Math.hypot(n2.x - n1.x, n2.y - n1.y);
      if (a.t2 > 1) every(a, dt, 0.6 / sp, () => ring(e.x, e.y, 10, 105, 'orb', rand(0, TAU)));
      if (a.t2 > 4.2) {
        a.beam.dead = true;
        e.armT = 56;
        e.spinT = 0.7;
        return true;
      }
      return false;
    },
    storm(e, a, dt, sp) {
      if (!a.xs) {
        const p = G.player;
        const n = e.phase > 1 ? 5 : 3;
        a.xs = [];
        for (let i = 0; i < n; i++) a.xs.push(clamp(p.x + (i - (n - 1) / 2) * 78 + rand(-12, 12), 24, view.W - 24));
        a.t2 = 0;
        sfx.warn();
      }
      a.t2 += dt;
      every(sub(a, 'b'), dt, 0.18 / sp, (n) => {
        if (n >= a.xs.length) return;
        G.beams.push({ owner: 'enemy', boss: e, x: a.xs[n], y: -20, ang: Math.PI / 2, w: 13, tele: 0.85, life: 0.4, spin: 0, aimSpin: 0 });
      });
      if (a.t2 > 1.2) every(a, dt, 0.5 / sp, () => fan(e.x, e.y, aimAt(e.x, e.y), 5, 0.6, 150, 'small'));
      return a.t2 > 2.6;
    },
    move(e, dt) {
      if (e.arm === undefined) {
        e.arm = 56;
        e.armT = 56;
        e.spinT = 0.7;
        e.spin = 0.7;
      }
      e.arm = damp(e.arm, e.armT, 3, dt);
      e.spin = damp(e.spin, e.spinT, 3, dt);
      e.anim += e.spin * dt;
      e.x = damp(e.x, view.W / 2 + Math.sin(e.t * 0.45) * view.W * 0.18, 2, dt);
      e.y = damp(e.y, e.homeY + top() + Math.sin(e.t * 0.8) * 14, 2, dt);
    },
    parts(e) {
      const out = [[0, 0, 24]];
      for (const nd of nodes(e, true)) out.push([nd.x, nd.y, 12]);
      return out;
    },
  },

  // --- CITADEL: a bastion turret behind a turning shield arc that eats your shots: hit it through the open side.
  citadel: {
    cycles: [['flak', 'mortar', 'spin'], ['mortar', 'spin', 'flak', 'mortar', 'spin']],
    flak(e, a, dt, sp) {
      every(a, dt, 0.7 / sp, () => fan(e.x, e.y, aimAt(e.x, e.y), e.phase > 1 ? 9 : 7, 0.9, 112, 'big'));
      return a.n >= 3;
    },
    mortar(e, a, dt, sp) {
      every(a, dt, 0.35 / sp, () => {
        const p = G.player;
        const tx = clamp(p.x + rand(-110, 110), 30, view.W - 30);
        const ty = p.y - rand(40, 160);
        const ang = Math.atan2(ty - e.y, tx - e.x);
        shoot(e.x, e.y, ang, 175, 'shell', { hp: hpShell(4.5), acc: -75, fuse: 2.2, burst: e.phase > 1 ? 12 : 10 });
      });
      return a.n >= (e.phase > 1 ? 4 : 3);
    },
    spin(e, a, dt, sp) {
      a.t2 = (a.t2 || 0) + dt;
      every(a, dt, 0.11 / sp, () => {
        for (let k = 0; k < 4; k++) shoot(e.x, e.y, a.t2 * 1.1 * (e.phase > 1 ? -1 : 1) + (k / 4) * TAU, 120, 'orb');
      });
      return a.t2 > 2.8;
    },
    move(e, dt) {
      if (e.shA === undefined) e.shA = Math.PI / 2;
      e.shA += dt * (e.phase > 1 ? -1.25 : 1.05);
      e.x = damp(e.x, view.W / 2 + Math.sin(e.t * 0.35) * view.W * 0.14, 2, dt);
      e.y = damp(e.y, e.homeY + top() + Math.sin(e.t * 0.7) * 10, 2, dt);
      if (e.state === 'fight') shieldBlock(e);
      if (e.shHit > 0) e.shHit -= dt;
    },
    parts: () => [[0, 0, 30]],
  },
};

// ARCLIGHT's two nodes, world space (rel: offsets from the core).
function nodes(e, rel = false) {
  const arm = e.arm ?? 56;
  const out = [];
  for (let i = 0; i < 2; i++) {
    const a = e.anim + i * Math.PI;
    const x = Math.cos(a) * arm;
    const y = Math.sin(a) * arm * 0.8;
    out.push(rel ? { x, y } : { x: e.x + x, y: e.y + y });
  }
  return out;
}

// CITADEL's shield: SHIELD_SPAN of arc around e.shA, radius SHIELD_R0..R1. Player shots crossing it are absorbed
// (beams pass: the rail lance is the hard counter).
export const SHIELD_SPAN = 2.0;
export const SHIELD_R = 52;
function shieldBlock(e) {
  const r0 = 34;
  const r1 = SHIELD_R + 14;
  for (const b of G.pBullets) {
    if (b.dead) continue;
    const dx = b.x - e.x;
    const dy = b.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r1 * r1 || d2 < r0 * r0) continue;
    let da = Math.atan2(dy, dx) - e.shA;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > SHIELD_SPAN / 2) continue;
    b.dead = true;
    e.shHit = 0.12;
    if (Math.random() < 0.4) sparks(b.x, b.y, e.color, 2, 140);
  }
}

// Clean up per-attack state on a phase shift or death.
export function resetMini(e) {
  e.hold = false;
  e.dive = null;
  e.rot = 0;
  e.alpha = 1;
  e.ghost = null;
  if (e.kind === 'arclight') {
    e.armT = 56;
    e.spinT = 0.7;
  }
}

// One-off flourish when a mini boss goes down (bosses.js finishBoss handles the rest).
export function miniBurst(e) {
  explosion(e.x, e.y, e.color, 3);
  explosion(e.x, e.y, '#ffffff', 2);
  for (let i = 0; i < 6; i++) explosion(e.x + rand(-50, 50), e.y + rand(-40, 40), e.color, rand(0.8, 1.5));
}
