// The player ship: movement, primary fire, dash, overdrive, damage and rewards.

import { G, view, field } from './state.js';
import { S, glow, flame } from '../render/sprites.js';
import { SHIP_ENGINES } from '../render/shipArt.js';
import { clamp, damp, rand, TAU } from '../core/math.js';
import { WEAPONS, weaponStreams, weaponDamageScale, activePaint } from './ships.js';
import { equippedParts, itemTags } from './parts.js';
import { profile } from '../core/storage.js';
import { recomputeStats } from './upgrades.js';
import { playerBullet, clearBullets } from './bullets.js';
import { gainCredits } from './economy.js';
import { particle, explosion, ring, sparks, floatText, addShake, flash, hitstop, slowmo } from './fx.js';
import { sfx } from '../core/audio.js';
import { input, readDirection } from '../core/input.js';
import { botControl } from './bot.js';
import { vacuumAll } from './pickups.js';
import { dashNova, resetModules, staticDischarge } from './modules.js';
import { collectRelic } from './collectables.js';
import { achEvent } from './achievements.js';
import { CLASSES, activeClass, equippedPassives, passiveById, initPilot, castUlt, boosted, phasing, fortressOn, bloodrush, onEliteKilled, updatePilot, spawnEchoes } from './pilot.js';
import { cine } from './cinematic.js';
import { treeForRun, treeOnKill, treeOnDash } from './tree.js';
import { sv } from './stageview.js';
import { updateBoost, resetBoost, boostSpeed, boostScore, drawBoostShip, boostLen } from './boost.js';

export const xpFor = (l) => Math.floor(5 + 4.5 * l + 0.9 * l * l);

// gear=false (attract mode): no hangar parts. The paint is cosmetic and always applies.
export function createPlayer(ship, gear = true) {
  const p = {
    ship,
    color: activePaint(profile, ship).color,
    parts: gear ? equippedParts(profile, ship.id) : [],
    fluxCore: gear ? { ...profile.core } : null, // Flux Core levels (core.js)
    x: view.W / 2,
    y: view.H * 0.78,
    vx: 0,
    vy: 0,
    r: 3.5,
    aim: -Math.PI / 2, // facing (radians); always straight up in a fight, free in the overworld
    bank: 0,
    hp: ship.hp,
    maxHp: ship.hp,
    shield: 0,
    shieldT: 0,
    iframes: 0,
    dashT: 0,
    dashDx: 0,
    dashDy: -1,
    charges: ship.dashes,
    maxCharges: ship.dashes,
    rechargeT: 0,
    fireT: 0,
    level: 1,
    xp: 0,
    xpNeed: xpFor(1),
    od: 0,
    odT: 0,
    odReady: false,
    up: {},
    st: {},
    ghosts: [],
    ghostT: 0,
    pitch: 0,
    trailT: 0,
    muzzle: 0,
    dead: false,
    focus: false,
    god: false,
    hurtT: 0,
    echoT: 0, // Echo Fire: delay before the repeated volley
    leechN: 0, // Leech Protocol kill counter
    swUsed: 0, // Second Wind charges spent this run
    burstN: 0, // burst weapons: shots left in the current burst
    burstT: 0,
  };
  const cls = gear ? activeClass() : CLASSES[0];
  initPilot(p, cls, gear ? equippedPassives(cls.id).map((x) => x.id) : []);
  p.tree = treeForRun(cls.id, gear); // passive tree node ids (tree.js)
  for (const [id, lv] of Object.entries(ship.start)) p.up[id] = lv;
  for (const part of p.parts) for (const [id, lv] of Object.entries(part.start || {})) p.up[id] = Math.max(p.up[id] || 0, lv); // free levels (max-capped by the upgrade pool)
  for (const id of p.passives) for (const [uid, lv] of Object.entries(passiveById(id).start || {})) p.up[uid] = (p.up[uid] || 0) + lv; // Gunsmith / Field Kit
  p.tags = {}; // build-path weights of the equipped gear (upgrades.js synergy)
  for (const part of p.parts) for (const [t, n] of Object.entries(itemTags(part.item))) p.tags[t] = (p.tags[t] || 0) + n;
  if (ship.path) p.tags[ship.path] = (p.tags[ship.path] || 0) + 1;
  p.runMods = []; // bonus modifiers from rare level-up cards
  recomputeStats(p);
  p.st0 = { ...p.st }; // stats at launch (run details shows the change since)
  p.hp = p.maxHp;
  p.charges = p.maxCharges;
  resetBoost(p);
  if (p.up.aegis) p.shield = 1;
  resetModules(p);
  return p;
}

function control() {
  if (G.scriptCtrl) return G.scriptCtrl(); // boot intro (intro.js)
  if (G.mode === 'attract' || G.autopilot) return botControl();
  readDirection();
  return sv.mapControl({
    mode: input.mode,
    dx: input.dx,
    dy: input.dy,
    tx: input.tx,
    ty: input.ty,
    dash: input.consume('dash'),
    od: input.consume('od'),
    focus: false, // Shift is Boost in fights (the autopilot still uses focus to slow down)
    boost: input.down('focus'),
    shift: (dx, dy) => input.shiftTarget(dx, dy),
  });
}

export function playfieldBounds() {
  if (field.ow) return { left: 30, right: field.W - 30, top: 30, bottom: field.H - 30 };
  if (sv.active) return sv.bounds(); // side / chase stage (virtual frame)
  return {
    left: 14,
    right: view.W - 14,
    top: view.safeTop + 84,
    bottom: view.H - 18 - view.safeBottom,
  };
}

export function updatePlayer(p, dt) {
  if (p.dead) return;
  const c = control();
  const st = p.st;
  p.focus = c.focus;
  updateBoost(p, dt, !!c.boost);

  // --- Movement ---
  const maxSpeed = 340 * st.speed * (c.focus ? 0.45 : 1) * (boosted(p) ? 1.1 : 1) * (p.slipT > 0 ? 1.15 : 1) * boostSpeed(p);
  let tvx;
  let tvy;
  let mvx = 0;
  let mvy = 0;
  if (c.mode === 'target') {
    const b = playfieldBounds();
    const dx = clamp(c.tx, b.left, b.right) - p.x;
    const dy = clamp(c.ty, b.top, b.bottom) - p.y;
    // Ease in near the target, but never outrun the keyboard top speed.
    const cap = maxSpeed;
    tvx = dx * 16;
    tvy = dy * 16;
    const m = Math.hypot(tvx, tvy);
    if (m > cap) {
      tvx *= cap / m;
      tvy *= cap / m;
    }
    const d = Math.hypot(dx, dy);
    if (d > 6) {
      mvx = dx / d;
      mvy = dy / d;
    }
  } else {
    tvx = c.dx * maxSpeed;
    tvy = c.dy * maxSpeed;
    mvx = c.dx;
    mvy = c.dy;
  }

  // Cinematic fly-through (cinematic.js transit): the jet follows a scripted point, no dashing.
  const auto = p.auto;
  if (auto) {
    tvx = (auto.x - p.x) * 12;
    tvy = (auto.y - p.y) * 12;
    const m = Math.hypot(tvx, tvy);
    if (m > 900) {
      tvx *= 900 / m;
      tvy *= 900 / m;
    }
  }

  // --- Dash ---
  if (c.dash && !auto && p.charges > 0 && p.dashT <= 0) {
    let dx = mvx;
    let dy = mvy;
    const m = Math.hypot(dx, dy);
    if (m < 0.2) {
      const vm = Math.hypot(p.vx, p.vy);
      if (vm > 40) { dx = p.vx / vm; dy = p.vy / vm; } else if (p.aim === -Math.PI / 2) { dx = 0; dy = -1; } else { dx = Math.cos(p.aim); dy = Math.sin(p.aim); }
    } else { dx /= m; dy /= m; }
    p.dashDx = dx;
    p.dashDy = dy;
    p.dashT = 0.13 * st.dashDur;
    p.charges--;
    p.iframes = Math.max(p.iframes, 0.24 * st.dashDur);
    sfx.dash();
    ring(p.x, p.y, 34, p.color, 0.3);
    if (p.up.dashNova) dashNova(p);
    if (st.afterimage) spawnEchoes(p, dx, dy);
    treeOnDash(p);
  }
  const dashing = p.dashT > 0;
  if (dashing) {
    p.dashT -= dt;
    p.vx = p.dashDx * 1150;
    p.vy = p.dashDy * 1150;
    p.ghosts.push({ x: p.x, y: p.y, life: 0.22, bank: p.bank });
    if (p.dashT <= 0) {
      p.vx *= 0.3;
      p.vy *= 0.3;
    }
  } else if (auto) {
    p.vx = damp(p.vx, tvx, 26, dt);
    p.vy = damp(p.vy, tvy, 26, dt);
  } else {
    // A little thrust: the ship spools up to speed (~0.18s) but brakes and turns hard, so it carries without drifting.
    // Braking = the wanted velocity is slower than, or turned away from, the current one. Same for keys, mouse and touch.
    const v2 = p.vx * p.vx + p.vy * p.vy;
    const rate = tvx * p.vx + tvy * p.vy < v2 ? (c.mode === 'target' ? 26 : 22) : 13;
    p.vx = damp(p.vx, tvx, rate, dt);
    p.vy = damp(p.vy, tvy, rate, dt);
  }
  if (p.charges < p.maxCharges) {
    p.rechargeT += dt;
    if (p.rechargeT >= st.dashRecharge) {
      p.rechargeT = 0;
      p.charges++;
    }
  } else p.rechargeT = 0;

  const px = p.x;
  const py = p.y;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  const b = playfieldBounds();
  p.x = clamp(p.x, b.left, b.right);
  p.y = clamp(p.y, b.top, b.bottom);
  // Pointer steering: carry the target along with a dash so the ship stays where it dashed to.
  if (dashing && c.mode === 'target' && c.shift) c.shift(p.x - px, p.y - py);
  p.bank = damp(p.bank, clamp(p.vx / 380, -1, 1), 12, dt);
  p.pitch = damp(p.pitch, clamp(-p.vy / 380, -1, 1), 12, dt); // nose-forward stretch when climbing

  for (const g of p.ghosts) {
    g.life -= dt;
    if (g.boost) g.y += 720 * dt; // boost trail streams back like the stage
  }
  while (p.ghosts.length && p.ghosts[0].life <= 0) p.ghosts.shift();

  // --- Timers ---
  if (p.iframes > 0) p.iframes -= dt;
  if (p.hurtT > 0) p.hurtT -= dt;
  if (p.muzzle > 0) p.muzzle -= dt;
  if (st.shieldInterval && !p.shield) {
    p.shieldT += dt;
    if (p.shieldT >= st.shieldInterval) {
      p.shield = 1;
      p.shieldT = 0;
      ring(p.x, p.y, 30, '#3ff6ff', 0.4);
      sfx.heal();
    }
  }

  // --- Overdrive ---
  if (p.odT > 0) {
    p.odT -= dt;
    if (p.odT <= 0) {
      p.odT = 0;
      floatText(p.x, p.y - 30, `${CLASSES.find((x) => x.id === p.cls).ult.short} END`, p.ucol, 10, 0.8);
    }
  } else if (c.od && p.od >= 100) {
    activateOverdrive(p);
  }
  if (p.od >= 100 && !p.odReady) {
    p.odReady = true;
    sfx.odReady();
    floatText(p.x, p.y - 34, `${ultOf(p).short} READY`, p.ucol, 11, 1.1);
  }

  updatePilot(p, dt);

  // --- Engine trail ---
  // Throttle: climbing (and the fly-through) burns hotter, with a longer, faster plume.
  const thr = p.auto ? 2.2 : 1 + Math.max(0, p.pitch) * 0.8;
  p.trailT -= dt * thr;
  if (p.trailT <= 0) {
    p.trailT = 0.025;
    const col = p.odT > 0 ? p.ucol : p.color;
    if (field.ow) {
      // Free flight: the plume leaves the tail, whichever way the ship faces.
      const fx = Math.cos(p.aim);
      const fy = Math.sin(p.aim);
      const j = rand(-3, 3);
      const sp = rand(160, 240) * thr;
      particle('dot', p.x - fx * 15 - fy * j, p.y - fy * 15 + fx * j, -fx * sp + p.vx * 0.3, -fy * sp + p.vy * 0.3, 0.22, rand(5, 8) * Math.min(1.5, thr), col, 1);
    } else particle('dot', p.x + rand(-3, 3), p.y + 15, rand(-15, 15) - p.vx * 0.1, rand(160, 240) * thr, 0.22, rand(5, 8) * Math.min(1.5, thr), col, 1);
  }
  // Fly-through afterimages.
  if (p.auto && (p.ghostT -= dt) <= 0) {
    p.ghostT = 0.035;
    p.ghosts.push({ x: p.x, y: p.y, life: 0.2, bank: p.bank });
  }

  // --- Primary fire ---
  const w = WEAPONS[p.ship.weapon];
  const rate = st.rate * (boosted(p) ? 1.6 : 1);
  p.fireT -= dt * rate;
  if (p.fireT < -w.interval) p.fireT = 0;
  while (p.fireT <= 0) {
    firePrimary(p, w);
    if (w.burst) {
      p.burstN = w.burst - 1; // TALON: the rest of the burst follows `gap` apart
      p.burstT = w.gap;
    }
    p.fireT += w.interval;
    if (st.echo && p.echoT <= 0 && Math.random() < st.echo) p.echoT = Math.min(0.07, w.interval * 0.5); // Echo Fire
  }
  if (p.burstN > 0) {
    p.burstT -= dt * rate;
    if (p.burstT <= 0) {
      firePrimary(p, w);
      p.burstN--;
      p.burstT += w.gap;
    }
  }
  if (p.echoT > 0) {
    p.echoT -= dt;
    if (p.echoT <= 0) firePrimary(p, w);
  }
  if (st.perpetual && p.odT <= 0) gainOverdrive(st.perpetual * dt); // Perpetual Engine
}

function firePrimary(p, w) {
  const lv = p.st.mainLv;
  const streams = weaponStreams(p.ship.weapon, lv);
  const od = boosted(p);
  const dmg = w.dmg * p.st.dmg * p.pdm * weaponDamageScale(lv) * (od ? 1.5 : 1);
  const spr = od ? S.pb_od : S['pb_' + p.ship.id];
  const charge = p.ship.weapon === 'charge';
  const grow = charge ? 1 + (lv - 1) * 0.1 : 1; // charge orbs swell with weapon level
  // Muzzle frame: x across the nose, -y out of it (straight up in a fight).
  const c = Math.cos(p.aim + Math.PI / 2);
  const sn = Math.sin(p.aim + Math.PI / 2);
  const wn = field.ow ? [c, sn] : null;
  for (const [ox, a, ph] of streams) {
    playerBullet(p.x + ox * c + 12 * sn, p.y + ox * sn - 12 * c, p.aim + a, w.speed, dmg, spr, {
      wn,
      wave: w.wave ? w.wave * (1 + (lv - 1) * 0.06) : 0,
      wphase: ph || 0,
      wfreq: w.freq || 0,
      pierce: p.st.pierce,
      homing: w.homing || 0,
      life: w.life || 1.2,
      r: w.r * grow,
      scale: charge ? grow * 1.5 : 1,
      bounce: w.bounce || 0,
      kind: charge ? 'orb' : 'bullet',
      primary: true,
      alpha: G.mode === 'attract' ? 0.6 : 0.85,
    });
  }
  if (charge) {
    ring(p.x + 14 * sn, p.y - 14 * c, 26, p.ship.bullet, 0.18);
    sparks(p.x + 16 * sn, p.y - 16 * c, p.ship.bullet, 6, 220, p.aim, 1.2);
  }
  p.muzzle = 0.05;
  sfx.shoot();
}

const ultOf = (p) => CLASSES.find((x) => x.id === p.cls).ult;

// Shared Overdrive meter logic; the class-specific effect lives in pilot.js (castUlt).
export function activateOverdrive(p) {
  p.odT = p.st.odDur;
  p.od = 0;
  G.texts = G.texts.filter((t) => !t.text.endsWith(' READY'));
  p.odReady = false;
  p.iframes = Math.max(p.iframes, p.cls === 'ghost' ? 0.5 : 1);
  const cls = CLASSES.find((x) => x.id === p.cls);
  G.pulseColor = cls.color;
  castUlt(p);
  sfx.overdrive();
  flash(cls.rgb, 0.55);
  addShake(0.6);
  hitstop(0.08);
  floatText(p.x, p.y - 40, `${cls.ult.short}!`, cls.color, 18, 1.2);
}

export function comboMult() {
  return Math.min(8, 1 + Math.floor(G.combo / 12) * 0.5);
}

export function addScore(base) {
  const p = G.player;
  G.score += base * comboMult() * (p && p.odT > 0 ? 2 : 1) * boostScore(p) * G.director.diff.score;
}

export function gainOverdrive(amount) {
  const p = G.player;
  if (!p || p.odT > 0 || p.dead) return;
  p.od = Math.min(100, p.od + amount * p.st.odGain);
}

export function onEnemyKilled(e) {
  const p = G.player;
  G.kills++;
  const before = comboMult();
  G.combo++;
  G.comboTimer = p.st.comboT || 2.6;
  if (G.combo > G.maxCombo) G.maxCombo = G.combo;
  const after = comboMult();
  if (after > before && G.mode === 'run') {
    floatText(p.x, p.y - 36, `x${after} COMBO`, '#ffe14d', 12, 0.9);
  }
  addScore(e.score);
  achEvent('kill', e);
  bloodrush(p);
  treeOnKill(p);
  if (e.elite) onEliteKilled(p);
  gainOverdrive(e.elite ? 10 : e.type === 'swarm' ? 0.8 : 1.6);
  if (p.st.leech && !p.dead && ++p.leechN >= p.st.leech) {
    // Leech Protocol
    p.leechN = 0;
    if (p.hp < p.maxHp) {
      p.hp++;
      floatText(p.x, p.y - 30, '+1 HULL', '#ff4d6d', 11, 0.9);
      ring(p.x, p.y, 36, '#ff4d6d', 0.35);
    }
  }
  if (p.st.static) staticDischarge(p, e);
  if (p.up.shrapnel) {
    const lv = p.up.shrapnel;
    const n = 2 + lv;
    const dmg = (1.4 + 0.5 * lv) * p.st.dmg;
    const off = rand(0, TAU);
    for (let i = 0; i < n; i++) {
      playerBullet(e.x, e.y, off + (i / n) * TAU, 380, dmg, S.pb_frag, { life: 0.45, r: 4, pierce: 0, alpha: 0.9 });
    }
  }
}

export function hurtPlayer(p) {
  if (p.dead || p.iframes > 0 || p.dashT > 0 || p.god || G.mode === 'attract' || phasing(p) || cine.on) return;
  if (p.shield) {
    p.shield = 0;
    p.shieldT = 0;
    p.iframes = 1.2;
    if (p.st.aegisOd) gainOverdrive(p.st.aegisOd); // Aegis Prime
    sfx.shield();
    ring(p.x, p.y, 70, '#3ff6ff', 0.45);
    sparks(p.x, p.y, '#3ff6ff', 16, 300);
    clearBullets(p.x, p.y, 110);
    addShake(0.35);
    hitstop(0.06);
    floatText(p.x, p.y - 30, 'SHIELD BROKEN', '#3ff6ff', 11, 0.9);
    return;
  }
  if (p.hp <= 1 && p.swUsed < p.st.secondWind) {
    // Second Wind: the killing blow is shrugged off.
    p.swUsed++;
    p.hp = 1;
    p.iframes = 2.5;
    G.combo = 0;
    G.comboTimer = 0;
    sfx.shield();
    flash('255,255,255', 0.5);
    addShake(0.6);
    hitstop(0.12);
    ring(p.x, p.y, 160, '#ff4d6d', 0.6);
    clearBullets(p.x, p.y, 220);
    floatText(p.x, p.y - 34, 'SECOND WIND', '#ff4d6d', 14, 1.3);
    return;
  }
  p.hp--;
  p.hurtT = 0.4;
  if (G.combo >= 12) floatText(p.x, p.y - 42, 'COMBO LOST', '#ff4d6d', 11, 0.9);
  G.combo = 0;
  G.comboTimer = 0;
  sfx.playerHit();
  flash('255,40,80', 0.45);
  addShake(0.7);
  hitstop(0.12);
  explosion(p.x, p.y, '#ff4d6d', 1);
  clearBullets(p.x, p.y, 150);
  if (p.hp <= 0) {
    killPlayer(p);
  } else {
    p.iframes = 1.8 * p.st.hitIfr;
  }
}

function killPlayer(p) {
  p.dead = true;
  explosion(p.x, p.y, p.color, 3);
  explosion(p.x, p.y, '#ffffff', 1.5);
  slowmo(1.6);
  addShake(1);
  flash('255,255,255', 0.8);
  sfx.bossDie();
  G.deathT = 2.0;
}

export function collectPickup(pk) {
  const p = G.player;
  if (pk.type === 'xp') {
    gainXp(p, pk.val);
    G.score += pk.val * 5;
    sfx.pickup();
  } else if (pk.type === 'credit') {
    gainCredits(pk.val, pk);
    G.score += 10;
    sfx.coin();
  } else if (pk.type === 'heart') {
    if (p.hp < p.maxHp) {
      p.hp++;
      floatText(p.x, p.y - 30, '+1 HULL', '#ff3b6b', 12, 1);
    } else {
      addScore(2500);
      floatText(p.x, p.y - 30, '+2500', '#ff3b6b', 12, 1);
      achEvent('heartFull');
    }
    sfx.heal();
    ring(p.x, p.y, 40, '#ff3b6b', 0.4);
  } else if (pk.type === 'magnet') {
    vacuumAll();
    sfx.select();
    ring(p.x, p.y, 120, '#3ff6ff', 0.5);
  } else if (pk.type === 'cell') {
    gainOverdrive(30);
    sfx.select();
    floatText(p.x, p.y - 30, `+${ultOf(p).short}`, p.ucol, 11, 1);
  } else if (pk.type === 'relic') {
    collectRelic(pk);
  }
}

const REROLL_EVERY = 5; // levels per free draft reroll

export function gainXp(p, v) {
  p.xp += v * p.st.xpMul;
  while (p.xp >= p.xpNeed) {
    p.xp -= p.xpNeed;
    p.level++;
    p.xpNeed = xpFor(p.level);
    G.pendingLevels++;
    if (p.level % REROLL_EVERY === 0) {
      G.rerolls++; // a trickle of rerolls through the run
      floatText(p.x, p.y - 44, '+1 REROLL', '#5dff6a', 11, 1);
    }
  }
}

// Engine flames in ship space (under the hull sprite): longer when climbing or dashing, flickering per nozzle.
function drawFlames(ctx, p, alpha, od) {
  const eng = SHIP_ENGINES[p.ship.id];
  if (!eng) return;
  const fl = flame(od ? p.ucol : p.color);
  const speed = Math.min(1, Math.hypot(p.vx, p.vy) / 320);
  const push = field.ow ? speed : Math.max(0, p.pitch) - Math.max(0, -p.pitch) * 0.4;
  const len = (0.9 + push * 0.7) * (p.dashT > 0 ? 1.7 : 1) * (od ? 1.25 : 1) * boostLen(p);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < eng.length; i++) {
    const [x, y, w] = eng[i];
    const flick = 0.85 + 0.15 * Math.sin(G.time * 53 + i * 2.1) + 0.08 * Math.sin(G.time * 97 + i);
    const h = w * 3.4 * len * flick;
    ctx.globalAlpha = alpha * 0.95;
    ctx.drawImage(fl.img, x - w * 0.8, y - 0.6, w * 1.6, h);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = alpha;
}

export function drawPlayer(ctx, k) {
  const p = G.player;
  if (!p || p.dead) return;
  const spr = S['ship_' + p.ship.id];
  const od = p.odT > 0;
  const ph = phasing(p);

  // Afterimages
  ctx.globalCompositeOperation = 'lighter';
  for (const g of p.ghosts) {
    ctx.globalAlpha = g.boost ? (g.life / 0.22) * 0.2 : (g.life / 0.22) * (ph ? 0.5 : 0.35);
    ctx.drawImage(spr.img, g.x - spr.half, g.y - spr.half, spr.size, spr.size);
  }
  drawBoostShip(ctx, p);
  // Afterimage passive: pending echoes
  if (p.st.afterimage) {
    for (const e of p.echoes) {
      if (e.t <= 0) continue;
      const t = 1 - e.t / 0.3;
      ctx.globalAlpha = 0.25 + t * 0.4;
      ctx.drawImage(spr.img, e.x - spr.half, e.y - spr.half, spr.size, spr.size);
      const eg = glow('#9d7bff', 64);
      const es = 40 + t * 40;
      ctx.drawImage(eg.img, e.x - es / 2, e.y - es / 2, es, es);
    }
  }
  // Engine / aura glow
  const gl = glow(od ? p.ucol : p.color, 64);
  ctx.globalAlpha = od ? 0.55 + Math.sin(G.time * 20) * 0.15 : 0.28;
  const gs = od ? 70 : 42;
  ctx.drawImage(gl.img, p.x - gs / 2, p.y - gs / 2 + 4, gs, gs);
  const nx = Math.cos(p.aim); // nose direction
  const ny = Math.sin(p.aim);
  if (p.muzzle > 0) {
    // Muzzle flash: a ki flare in the shot colour around a white pop.
    ctx.globalAlpha = 0.55;
    const cg = glow(boosted(p) ? '#ffd23f' : p.ship.bullet, 64);
    ctx.drawImage(cg.img, p.x + nx * 16 - 16, p.y + ny * 16 - 16, 32, 32);
    ctx.globalAlpha = 0.75;
    const mg = glow('#ffffff', 32);
    ctx.drawImage(mg.img, p.x + nx * 16 - 10, p.y + ny * 16 - 10, 20, 20);
  }
  if (p.ship.weapon === 'charge' && G.mode !== 'attract') {
    // Charge-up orb at the muzzle: grows as the next shot comes online.
    const w = WEAPONS.charge;
    const t = Math.max(0, Math.min(1, 1 - p.fireT / w.interval));
    const cg = glow(p.ship.bullet, 64);
    const cs = 8 + t * 26;
    ctx.globalAlpha = 0.25 + t * 0.55;
    ctx.drawImage(cg.img, p.x + nx * 20 - cs / 2, p.y + ny * 20 - cs / 2, cs, cs);
  }
  ctx.globalCompositeOperation = 'source-over';

  // Ship (banking squash for a roll feel)
  let alpha = 1;
  if (p.iframes > 0 && p.dashT <= 0 && Math.floor(G.time * 20) % 2 === 0) alpha = 0.35;
  if (ph) alpha = 0.5 + Math.sin(G.time * 14) * 0.12;
  ctx.globalAlpha = alpha;
  if (field.ow) {
    // Free flight: the sprite turns to the facing (it points up at aim -90 degrees).
    const a = p.aim + Math.PI / 2;
    const c = Math.cos(a) * k;
    const sn = Math.sin(a) * k;
    ctx.setTransform(c, sn, -sn, c, p.x * k + view.ox, p.y * k + view.oy);
  } else {
    const sx = 1 - Math.abs(p.bank) * 0.28;
    const sy = 1 + p.pitch * 0.06;
    ctx.setTransform(k * sx, 0, 0, k * sy, p.x * k + view.ox, p.y * k + view.oy); // (chase: stageview.js tilts it)
  }
  drawFlames(ctx, p, alpha, od);
  ctx.drawImage(spr.img, -spr.half, -spr.half, spr.size, spr.size);
  ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
  ctx.globalAlpha = 1;

  // Fortress dome (pre-baked ring sprite, scaled; no per-frame blur)
  if (fortressOn(p)) {
    const left = p.odT;
    const blink = left < 1 && Math.floor(G.time * 12) % 2 === 0 ? 0.4 : 1;
    const pulse = 1 + Math.sin(G.time * 5) * 0.015 + (p.domeFlare > 0 ? 0.04 : 0);
    const d = S.dome;
    const sz = d.size * pulse;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (0.75 + (p.domeFlare > 0 ? 0.25 : 0)) * blink;
    ctx.drawImage(d.img, p.x - sz / 2, p.y - sz / 2, sz, sz);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // Shield bubble
  if (p.shield) {
    ctx.strokeStyle = 'rgba(63,246,255,' + (0.45 + Math.sin(G.time * 5) * 0.15) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 25, 0, TAU);
    ctx.stroke();
  }

  // Hitbox core — always visible; stronger while focusing.
  const hb = p.focus ? 1 : 0.75;
  ctx.fillStyle = `rgba(255,255,255,${hb})`;
  ctx.beginPath();
  ctx.arc(p.x, p.y + 1, p.r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = p.hurtT > 0 ? '#ff4d6d' : od ? p.ucol : p.color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y + 1, p.r + 2, 0, TAU);
  ctx.stroke();
  if (p.focus) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(p.x, p.y + 1, 22, 0, TAU);
    ctx.stroke();
  }
}
