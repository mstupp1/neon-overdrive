// The player ship: movement, primary fire, dash, overdrive, damage and rewards.

import { G, view, field } from './state.js';
import { S, glow, flame } from '../render/sprites.js';
import { SHIP_ENGINES } from '../render/shipArt.js';
import { shipSpriteForView, drawPosedHull } from '../render/shipImages.js';
import { cannonMount, worldShipMount, shipPoseLocal, SIDE_TILT } from '../render/shipMounts.js';
import { clamp, damp, rand, TAU, wrapAngle } from '../core/math.js';
import { WEAPONS, weaponStreams, weaponDamageScale, activePaint } from './ships.js';
import { equippedParts, itemTags } from './parts.js';
import { profile } from '../core/storage.js';
import { recomputeStats, familyLocked, upgradeById } from './upgrades.js';
import { playerBullet, clearBullets } from './bullets.js';
import { gainCredits } from './economy.js';
import { particle, explosion, ring, sparks, floatText, addShake, flash, hitstop, slowmo, grazeLabel } from './fx.js';
import { sfx } from '../core/audio.js';
import { input, readDirection } from '../core/input.js';
import { botControl } from './bot.js';
import { vacuumAll } from './pickups.js';
import { dashNova, resetModules, staticDischarge } from './modules.js';
import { collectRelic } from './collectables.js';
import { achEvent } from './achievements.js';
import { CLASSES, activeClass, equippedPassives, passiveById, initPilot, castUlt, endUlt, boosted, phasing, fortressOn, bloodrush, onEliteKilled, updatePilot, spawnEchoes, ULT_CELL, ULT_LEVELS, ULT_LV, ultCap, ultCells, ultCastLevel, ultDmg, ultRate, ultScore, ultSpeed, ultDodge, intangible, domeR } from './pilot.js';
import { cine } from './cinematic.js';
import { treeForRun, treeOnKill, treeOnDash } from './tree.js';
import { sv } from './stageview.js';
import { updateBoost, resetBoost, boostSpeed, boostScore, drawBoostShip, boostLen } from './boost.js';
import { rollBurst, BURST_GAP } from './status.js';
import { topdownCombatTop } from './topdownGeometry.js';
import { bg } from '../render/background.js';

// Handling feel (keyboard/gamepad; pointer steering keeps its own rates). Rates are damp() constants: higher = snappier.
const REVERSE_SCALE = 0.65; // top speed going backward, relative to forward
const RATE_THRUST = 8; // speeding up while pushing forward (~0.3s to full speed)
const RATE_SIDE = 11; // speeding up sideways / backward
const RATE_COAST = 5; // no input: glide to a stop
const RATE_TURN = 15; // pushing against the current motion
const PUSH_MAX = 0.35; // extra backdrop scroll at full forward speed (visual only)

// The opening cost makes the first few drafts earned milestones. Its relative
// impact fades at higher levels, where quadratic growth controls progression.
export const xpFor = (l) => Math.floor(44 + 7 * l + 1.4 * l * l);

// gear=false (attract mode): no hangar parts. The paint is cosmetic and always applies.
export function createPlayer(ship, gear = true) {
  const p = {
    ship,
    color: activePaint(profile, ship).color,
    bulletColor: activePaint(profile, ship).bullet,
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
    od: 0, // ult meter: ULT_CELL per banked cell (pilot.js)
    odT: 0,
    odDurMax: 0, // full duration of the running ult (HUD)
    odReady: false, // at least one cell banked
    odSeen: 0, // banked cells already announced
    up: {},
    st: {},
    ghosts: [],
    grazeArcs: [], // graze feedback: bright arcs on the graze ring where a bullet scraped by (world.js)
    grazeFx: 0,
    grazeRad: 24,
    grazeChain: 0,
    grazeChainT: 0,
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
    fxBurstN: 0, // Burst Fire (status.js): extra volleys left in the current burst
    fxBurstT: 0,
  };
  const cls = gear ? activeClass() : CLASSES[0];
  initPilot(p, cls, gear ? equippedPassives(cls.id).map((x) => x.id) : []);
  p.tree = treeForRun(cls.id, gear); // passive tree node ids (tree.js)
  for (const [id, lv] of Object.entries(ship.start)) p.up[id] = lv;
  for (const part of p.parts) {
    for (const [id, lv] of Object.entries(part.start || {})) {
      if (familyLocked(p, upgradeById(id))) continue; // e.g. two ammo cores: the first one fitted wins
      p.up[id] = Math.max(p.up[id] || 0, lv); // free levels (max-capped by the upgrade pool)
    }
  }
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
    focus: false, // Shift is Boost (the autopilot still uses focus to slow down)
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
    top: topdownCombatTop(view.H, view.safeTop),
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
  const maxSpeed = 340 * st.speed * (c.focus ? 0.45 : 1) * ultSpeed(p) * (p.slipT > 0 ? 1.15 : 1) * boostSpeed(p);
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
  // Reverse is slower than forward. "Forward" is screen-up in a fight and the nose heading in free flight.
  const fwx = field.ow ? Math.cos(p.aim) : 0;
  const fwy = field.ow ? Math.sin(p.aim) : -1;
  const along = tvx * fwx + tvy * fwy;
  if (along < 0) {
    tvx -= along * fwx * (1 - REVERSE_SCALE);
    tvy -= along * fwy * (1 - REVERSE_SCALE);
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
    if (st.dashOd) gainOverdrive(st.dashOd); // PHANTOM
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
    // Thrust: spools up (~0.3s), glides when input is released, brakes hard only when reversing against the current motion.
    const v2 = p.vx * p.vx + p.vy * p.vy;
    const tv2 = tvx * tvx + tvy * tvy;
    const target = c.mode === 'target';
    let rate;
    if (tv2 < 400) rate = target ? 9 : RATE_COAST; // no input: slide to a stop
    else if (tvx * p.vx + tvy * p.vy < v2 * 0.2) rate = target ? 26 : RATE_TURN; // reversing: bite hard
    else rate = target ? 13 : (tvx * fwx + tvy * fwy) > 0 ? RATE_THRUST : RATE_SIDE;
    p.vx = damp(p.vx, tvx, rate, dt);
    p.vy = damp(p.vy, tvy, rate, dt);
  }
  // Backdrop rush: forward speed pushes the stars and grid (visual only; bg.boost drives obstacle speed).
  if (!field.ow && !auto) bg.pushT = Math.max(0, p.vx * fwx + p.vy * fwy) / 340 * PUSH_MAX - Math.max(0, -(p.vx * fwx + p.vy * fwy)) / 340 * 0.15;
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
  // Bank and pitch read the motion in the ship's own frame: sideways speed banks, speed along the nose pitches.
  // In free flight the hull banks into the curve of its flight path, as a plane does, and half as much into a
  // sideways slide while strafing a target.
  let side = p.vx, fwd = -p.vy, curve = 0;
  if (field.ow) {
    const c = Math.cos(p.aim), sn = Math.sin(p.aim);
    side = (-p.vx * sn + p.vy * c) * 0.5;
    fwd = p.vx * c + p.vy * sn;
    const speed = Math.hypot(p.vx, p.vy), heading = Math.atan2(p.vy, p.vx);
    if (dt > 0 && speed > 40 && p.pathPrev !== undefined) curve = (wrapAngle(heading - p.pathPrev) / dt) * Math.min(1, speed / 220);
    p.pathPrev = speed > 40 ? heading : undefined;
  } else p.pathPrev = undefined;
  p.bank = damp(p.bank, clamp(side / 340 + curve * 0.35, -1, 1), 12, dt);
  p.pitch = damp(p.pitch, clamp(fwd / 340, -1, 1), 12, dt); // nose-forward stretch when climbing

  for (const g of p.ghosts) {
    g.life -= dt;
    if (g.boost && !field.ow) g.y += 720 * dt; // boost trail streams back like the stage
  }
  while (p.ghosts.length && p.ghosts[0].life <= 0) p.ghosts.shift();

  for (const a of p.grazeArcs) a.t -= dt;
  while (p.grazeArcs.length && p.grazeArcs[0].t <= 0) p.grazeArcs.shift();
  if (p.grazeFx > 0) p.grazeFx = Math.max(0, p.grazeFx - dt * 2.5);
  if (p.grazeChainT > 0 && (p.grazeChainT -= dt) <= 0) p.grazeChain = 0;

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
      endUlt(p);
    }
  } else if (c.od && ultCells(p) >= 1) {
    activateOverdrive(p);
  }
  // Each newly banked cell is announced: the level a cast would now fire at, or a reserve cell past level 3.
  const cells = ultCells(p);
  p.odReady = cells >= 1;
  if (cells > p.odSeen && p.odT <= 0) {
    G.texts = G.texts.filter((t) => !t.text.endsWith(' READY') && !t.text.startsWith('ULT LV'));
    sfx.odReady();
    const lv = Math.min(ULT_LEVELS, cells);
    floatText(p.x, p.y - 34, cells > ULT_LEVELS ? `ULT LV${lv} +${cells - ULT_LEVELS} BANKED` : lv === 1 ? `${ultOf(p).short} READY` : `ULT LV${lv}`, p.ucol, lv === ULT_LEVELS ? 12 : 11, 1.1);
  }
  p.odSeen = cells;

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
  const rate = st.rate * ultRate(p);
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
    if (!(p.fxBurstN > 0)) {
      const extra = rollBurst(st); // Burst Fire: extra volleys right behind this one
      if (extra) {
        p.fxBurstN = extra;
        p.fxBurstT = BURST_GAP;
      }
    }
  }
  if (p.fxBurstN > 0) {
    p.fxBurstT -= dt;
    if (p.fxBurstT <= 0) {
      firePrimary(p, w);
      p.fxBurstN--;
      p.fxBurstT += BURST_GAP;
    }
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

// Pursuit hulls stand above the projected flight plane. Invert the camera at the
// visible barrel tip so the shot starts on that tip rather than behind the hull.
function primaryMuzzle(p, ox, index, c, sn) {
  const sprite = shipSpriteForView(S['ship_' + p.ship.id], field.ow ? 'top' : sv.mode);
  const mount = cannonMount(sprite.muzzles, ox, index);
  if (!mount) return { x: p.x + ox * c + 12 * sn, y: p.y + ox * sn - 12 * c };
  const chaseFrame = !field.ow && sv.mode === 'chase' ? cine.camera() : null;
  return worldShipMount(mount, p, sv.mode, field.ow, sv, chaseFrame);
}

function firePrimary(p, w) {
  const lv = p.st.mainLv;
  const streams = weaponStreams(p.ship.weapon, lv);
  const od = boosted(p);
  const dmg = w.dmg * p.st.dmg * p.pdm * weaponDamageScale(p.ship.weapon, lv) * ultDmg(p);
  const spr = od ? S.pb_od : S['pb_' + p.ship.id];
  const charge = p.ship.weapon === 'charge';
  const grow = charge ? 1 + (lv - 1) * 0.1 : 1; // charge orbs swell with weapon level
  // Muzzle frame: x across the nose, -y out of it (straight up in a fight).
  const c = Math.cos(p.aim + Math.PI / 2);
  const sn = Math.sin(p.aim + Math.PI / 2);
  const wn = field.ow ? [c, sn] : null;
  for (const [index, [ox, a, ph]] of streams.entries()) {
    const muzzle = primaryMuzzle(p, ox, index, c, sn);
    playerBullet(muzzle.x, muzzle.y, p.aim + a, w.speed, dmg, spr, {
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
    const muzzle = primaryMuzzle(p, 0, 0, c, sn);
    ring(muzzle.x, muzzle.y, 26, p.bulletColor, 0.18);
    sparks(muzzle.x, muzzle.y, p.bulletColor, 6, 220, p.aim, 1.2);
  }
  p.muzzle = 0.05;
  sfx.shoot();
}

// Grazing a bullet (world.js): light the arc of the graze ring it scraped, and count the streak under the ship.
export const GRAZE_COL = '#c9b8ff';
const GRAZE_ARC_T = 0.35;
export function grazeFeedback(p, angle, rad) {
  p.grazeRad = rad;
  p.grazeFx = 1;
  if (p.grazeArcs.length < 8) p.grazeArcs.push({ a: angle, t: GRAZE_ARC_T });
  p.grazeChain = p.grazeChainT > 0 ? p.grazeChain + 1 : 1;
  p.grazeChainT = 1;
  grazeLabel(p, p.grazeChain);
}

const ultOf = (p) => CLASSES.find((x) => x.id === p.cls).ult;

// Shared ult meter logic; the class-specific effect lives in pilot.js (castUlt). A cast spends up to ULT_LEVELS banked
// cells and fires at that level; each spent cell may be kept (st.ultSave). Partial progress toward the next cell stays.
export function activateOverdrive(p) {
  if (p.dead || p.odT > 0) return;
  const lv = ultCastLevel(p);
  if (lv < 1) return;
  let kept = 0;
  for (let i = 0; i < lv; i++) if (p.st.ultSave && Math.random() < p.st.ultSave) kept++;
  p.od = Math.max(0, p.od - (lv - kept) * ULT_CELL);
  p.odSeen = ultCells(p);
  p.ultLv = lv;
  p.odT = p.odDurMax = p.st.odDur * ULT_LV[p.cls in ULT_LV ? p.cls : 'striker'][lv].dur;
  G.texts = G.texts.filter((t) => !t.text.endsWith(' READY') && !t.text.startsWith('ULT LV'));
  p.odReady = p.odSeen >= 1;
  p.iframes = Math.max(p.iframes, p.cls === 'ghost' ? 0.5 : lv === 1 ? 0.6 : 1);
  const cls = CLASSES.find((x) => x.id === p.cls);
  G.pulseColor = cls.color;
  castUlt(p);
  sfx.overdrive();
  flash(cls.rgb, 0.25 + 0.1 * lv);
  addShake(0.2 + 0.13 * lv);
  hitstop(lv === ULT_LEVELS ? 0.08 : 0.04);
  floatText(p.x, p.y - 40, `${cls.ult.short} LV${lv}!`, cls.color, 12 + 2 * lv, 1.2);
  if (kept) floatText(p.x, p.y - 58, kept > 1 ? `${kept} CELLS SAVED` : 'CELL SAVED', '#ffffff', 10, 1);
}

export function comboMult() {
  return Math.min(8, 1 + Math.floor(G.combo / 12) * 0.5);
}

export function addScore(base) {
  const p = G.player;
  G.score += base * comboMult() * ultScore(p) * boostScore(p) * G.director.diff.score * ((p && p.st.scoreMul) || 1);
}

// BULWARK: a breaking shield shoves nearby enemies away (bosses and multi-part enemies hold their ground).
function shieldKnock(p) {
  for (const e of G.enemies) {
    if (e.dead || !e.entered || e.boss || e.parts) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 150) continue;
    e.x += (dx / d) * 70;
    e.y += (dy / d) * 70;
  }
  ring(p.x, p.y, 150, '#ffd23f', 0.4);
}

export function gainOverdrive(amount) {
  const p = G.player;
  if (!p || p.odT > 0 || p.dead) return;
  // Slower baseline for kills, grazes, cells and passive charge; build bonuses still multiply it.
  p.od = Math.min(ultCap(p), p.od + amount * 0.5 * p.st.odGain);
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

// Hull lost per enemy hit right now (state.js enemyHit, folded into the director difficulty).
export const hitDamage = () => (G.director && G.director.diff && G.director.diff.hit) || 1;

// dmg: hull a hit takes (default: the sector's hitDamage). solid: dashing doesn't pass through it (pursuit gates).
export function hurtPlayer(p, dmg = hitDamage(), solid = false) {
  if (p.dead || p.iframes > 0 || (p.dashT > 0 && !solid) || p.god || G.mode === 'attract' || intangible(p) || cine.on) return;
  const ud = ultDodge(p); // Phase Shift levels 1-2
  const dodge = 1 - (1 - (p.st.dodge || 0)) * (1 - ud);
  if (dodge > 0 && Math.random() < dodge) {
    // Lucky Dodge: the shot misses. A brief grace so one bullet cluster can't roll it twice.
    p.iframes = p.st.dodgePulse ? 1.0 : 0.35;
    const col = ud ? '#d4c4ff' : '#9dffb0';
    floatText(p.x, p.y - 30, ud ? 'PHASED' : 'DODGE', col, 11, 0.7);
    ring(p.x, p.y, p.st.dodgePulse ? 90 : 34, col, 0.4);
    if (p.st.dodgePulse) {
      clearBullets(p.x, p.y, 130);
      sparks(p.x, p.y, '#9dffb0', 14, 240);
    }
    return;
  }
  if (p.shield) {
    p.shield = 0;
    p.shieldT = 0;
    p.iframes = 1.2;
    if (p.st.aegisOd) gainOverdrive(p.st.aegisOd); // Aegis Prime
    sfx.shield();
    ring(p.x, p.y, 70, '#3ff6ff', 0.45);
    sparks(p.x, p.y, '#3ff6ff', 16, 300);
    clearBullets(p.x, p.y, 110);
    if (p.st.shieldKnock) shieldKnock(p); // BULWARK
    addShake(0.35);
    hitstop(0.06);
    floatText(p.x, p.y - 30, 'SHIELD BROKEN', '#3ff6ff', 11, 0.9);
    return;
  }
  if (p.hp <= dmg && p.swUsed < p.st.secondWind) {
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
  p.hp = Math.max(0, p.hp - dmg);
  p.hurtT = 0.4;
  if (dmg > 1) floatText(p.x, p.y - 30, `-${dmg} HULL`, '#ff3b5c', 15, 1.1); // heavy hits read at a glance
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
function drawFlames(ctx, p, alpha, od, sprite, pose) {
  const eng = sprite.engines || SHIP_ENGINES[p.ship.id];
  if (!eng) return;
  const fl = flame(od ? p.ucol : p.color);
  const speed = Math.min(1, Math.hypot(p.vx, p.vy) / 320);
  const push = field.ow ? speed : Math.max(0, p.pitch) - Math.max(0, -p.pitch) * 0.4;
  const len = (0.9 + push * 0.7) * (p.dashT > 0 ? 1.7 : 1) * (od ? 1.25 : 1) * boostLen(p);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < eng.length; i++) {
    const [x, y] = pose(eng[i]);
    const w = eng[i][2];
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
  const spr = shipSpriteForView(S['ship_' + p.ship.id], field.ow ? 'top' : sv.mode);
  const od = p.odT > 0;
  const ph = phasing(p);

  // Afterimages
  ctx.globalCompositeOperation = 'lighter';
  for (const g of p.ghosts) {
    ctx.globalAlpha = g.boost ? (g.life / 0.22) * 0.2 : (g.life / 0.22) * (ph ? 0.5 : 0.35);
    ctx.drawImage(spr.img, g.x - spr.half, g.y - spr.half, spr.size, spr.size);
  }
  drawBoostShip(ctx, p, spr);
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
  if (p.grazeFx > 0) {
    // Graze: the graze ring shows faintly for a moment, with a bright arc where each bullet scraped past.
    ctx.strokeStyle = GRAZE_COL;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.22 * p.grazeFx;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.grazeRad, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#efe8ff';
    ctx.lineWidth = 2.2;
    for (const a of p.grazeArcs) {
      const t = a.t / GRAZE_ARC_T;
      ctx.globalAlpha = 0.95 * t;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.grazeRad + (1 - t) * 4, a.a - 0.5, a.a + 0.5);
      ctx.stroke();
    }
  }
  const nx = Math.cos(p.aim); // nose direction
  const ny = Math.sin(p.aim);
  if (p.muzzle > 0 && !spr.muzzles) {
    // Muzzle flash: a ki flare in the shot colour around a white pop.
    ctx.globalAlpha = 0.55;
    const cg = glow(boosted(p) ? '#ffd23f' : p.bulletColor, 64);
    ctx.drawImage(cg.img, p.x + nx * 16 - 16, p.y + ny * 16 - 16, 32, 32);
    ctx.globalAlpha = 0.75;
    const mg = glow('#ffffff', 32);
    ctx.drawImage(mg.img, p.x + nx * 16 - 10, p.y + ny * 16 - 10, 20, 20);
  }
  if (p.ship.weapon === 'charge' && G.mode !== 'attract' && !spr.muzzles) {
    // Charge-up orb at the muzzle: grows as the next shot comes online.
    const w = WEAPONS.charge;
    const t = Math.max(0, Math.min(1, 1 - p.fireT / w.interval));
    const cg = glow(p.bulletColor, 64);
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
  // Ship space, posed for movement (shipMounts.js): free flight turns to the facing, the side view pitches the
  // nose, the chase view's roll comes from stageview's cutout tilt, and top-down rolls the hull in drawPosedHull.
  const mode = field.ow ? 'top' : sv.mode;
  let rot = 0;
  if (field.ow) rot = p.aim + Math.PI / 2; // the sprite points up at aim -90 degrees
  else if (mode === 'side') rot = p.bank * SIDE_TILT;
  const c = Math.cos(rot) * k;
  const sn = Math.sin(rot) * k;
  ctx.setTransform(c, sn, -sn, c, p.x * k + view.ox, p.y * k + view.oy);
  const pose = mode === 'side' ? ([x, y]) => [x, y * (1 + p.pitch * 0.04)] : (pt) => shipPoseLocal(pt, p.bank, p.pitch, mode);
  drawFlames(ctx, p, alpha, od, spr, pose);
  drawPosedHull(ctx, spr, p.bank, p.pitch, mode, alpha);
  if (p.ship.weapon === 'charge' && G.mode !== 'attract' && spr.muzzles) {
    const t = Math.max(0, Math.min(1, 1 - p.fireT / WEAPONS.charge.interval));
    const orb = glow(p.bulletColor, 64), size = 8 + t * 26;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * (0.25 + t * 0.55);
    for (const m of spr.muzzles) {
      const [x, y] = pose(m);
      ctx.drawImage(orb.img, x - size / 2, y - size / 2, size, size);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
  }
  if (p.muzzle > 0 && spr.muzzles) {
    ctx.globalCompositeOperation = 'lighter';
    const muzzle = glow(boosted(p) ? '#ffd23f' : p.bulletColor, 32);
    const core = glow('#ffffff', 32);
    for (const m of spr.muzzles) {
      const [x, y] = pose(m);
      ctx.globalAlpha = alpha * 0.75;
      ctx.drawImage(muzzle.img, x - 5, y - 5, 10, 10);
      ctx.drawImage(core.img, x - 2, y - 2, 4, 4);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
  ctx.globalAlpha = 1;

  // Fortress dome (pre-baked ring sprite, scaled; no per-frame blur)
  if (fortressOn(p)) {
    const left = p.odT;
    const blink = left < 1 && Math.floor(G.time * 12) % 2 === 0 ? 0.4 : 1;
    const pulse = 1 + Math.sin(G.time * 5) * 0.015 + (p.domeFlare > 0 ? 0.04 : 0);
    const d = S.dome;
    const sz = d.size * pulse * (domeR(p) / 85); // the sprite is baked at the level-3 radius
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
    ctx.arc(p.x, p.y, Math.max(25, (spr.reach || 0) + 4), 0, TAU);
    ctx.stroke();
  }

}
