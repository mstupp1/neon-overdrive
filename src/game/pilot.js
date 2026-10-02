// Pilot classes: each replaces the Overdrive with its own ultimate and offers 4 passives (2 equipped).
// - CLASSES[id].ult is cast through castUlt(p) (called by player.js activateOverdrive after the shared meter logic).
//   The ult timer is p.odT for every class; `p.cls` says which effect runs while it is > 0.
// - Passives: numeric ones change `st` in applyPassives(st, p) (called at the end of recomputeStats);
//   behavioural ones just set st flags (killstreak, exec, bloodrush, nanorepair, riposte, afterimage, slipstream)
//   that the existing hook points check.
// - G.enemyTimeScale (Phase Shift) scales enemy / boss / enemy-bullet / enemy-beam time. Player and pickups run at 1.

import { G } from './state.js';
import { profile, saveProfile } from '../core/storage.js';
import { clamp, dist2 } from '../core/math.js';
import { rankFor } from './economy.js';
import { MAX_MODULES } from './upgrades.js';
import { clearBullets, nearestEnemy } from './bullets.js';
import { damageEnemy } from './enemies.js';
import { vacuumAll } from './pickups.js';
import { comboMult, addScore, playfieldBounds } from './player.js';
import { ring, sparks, floatText } from './fx.js';
import { sfx } from '../core/audio.js';

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const DOME_R = 85;
const PHASE_SCALE = 0.4;

export const CLASSES = [
  {
    id: 'striker', name: 'STRIKER', role: 'Assault', color: '#ff3df2', rgb: '255,61,242',
    desc: 'Raw firepower. Chain kills, then burst everything down.',
    icon: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
    ult: { id: 'overdrive', name: 'OVERDRIVE', short: 'OVERDRIVE', desc: 'Erase every bullet, blast all enemies, and double fire, damage and score.' },
    passives: [
      { id: 'killstreak', name: 'Killstreak', r: 0, desc: '+2% damage per 10 combo, up to +20%.', icon: svg('<path d="M4 20V10M10 20V6M16 20V12M22 20V3"/>'), apply(st) { st.killstreak = true; } },
      { id: 'hairtrigger', name: 'Hair Trigger', r: 1, desc: 'Critical hits deal +0.75x more.', icon: svg('<circle cx="12" cy="12" r="6"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>'), apply(st) { st.critMul += 0.75; } },
      { id: 'executioner', name: 'Executioner', r: 2, desc: '+40% damage to enemies under 30% hull. Bosses take +10%.', icon: svg('<path d="M5 4l14 16M19 4L5 20"/><circle cx="12" cy="12" r="3"/>'), apply(st) { st.exec = true; } },
      { id: 'bloodrush', name: 'Bloodrush', r: 3, desc: 'Kills during Overdrive extend it by 0.15s (max +4s).', icon: svg('<path d="M12 3s6 6 6 11a6 6 0 01-12 0c0-5 6-11 6-11z"/>'), apply(st) { st.bloodrush = true; } },
      { id: 'gunsmith', name: 'Gunsmith', r: 1, desc: 'Start every run with Main Cannon +1.', start: { main: 1 }, icon: svg('<path d="M12 3v14M7 7v10M17 7v10M5 21h14"/>') },
      { id: 'warlord', name: 'Warlord', r: 4, desc: '+20% damage, and your ultimate lasts 2s longer.', icon: svg('<path d="M4 20l4-12 4 6 4-6 4 12z"/><path d="M4 20h16"/>'), apply(st) { st.dmg *= 1.2; st.odDur += 2; } },
    ],
  },
  {
    id: 'engineer', name: 'ENGINEER', role: 'Support', color: '#ffb02e', rgb: '255,176,46',
    desc: 'Fortifies the battlefield. Domes, drones and a deep module bay.',
    icon: svg('<path d="M4 20v-5a8 8 0 0116 0v5z"/><path d="M12 7v4M9 20v-3h6v3"/>'),
    ult: { id: 'fortress', name: 'FORTRESS PROTOCOL', short: 'FORTRESS', desc: 'A dome erases enemy bullets and two extra wingmen fire. Opens with a blast.' },
    passives: [
      { id: 'salvager', name: 'Salvager', r: 0, desc: '+25% credits from everything.', icon: svg('<circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.8-1-2-1.5-3-1.5-1.7 0-3 1-3 2.5s1.3 2 3 2.5 3 1 3 2.5-1.3 2.5-3 2.5c-1 0-2.2-.5-3-1.5"/>'), apply(st) { st.creditMul *= 1.25; } },
      { id: 'overflow', name: 'Overflow', r: 2, desc: '+1 weapon module slot.', icon: svg('<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><path d="M16.5 14v6M13.5 17h6"/>'), apply(st) { st.maxModules += 1; } },
      { id: 'dronelink', name: 'Drone Link', r: 1, desc: '+25% damage from weapon modules.', icon: svg('<path d="M6 10l3-6 3 6-3-1.5zM12 20l3-6 3 6-3-1.5z"/><path d="M9 14v3M15 5v4"/>'), apply(st) { st.modDmg *= 1.25; } },
      { id: 'nanorepair', name: 'Nanorepair', r: 3, desc: 'Repair 1 hull after a sector with an elite kill, and after bosses.', icon: svg('<path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9"/>'), apply(st) { st.nanorepair = true; } },
      { id: 'fieldkit', name: 'Field Kit', r: 1, desc: 'Start every run with Wingmen 1.', start: { drones: 1 }, icon: svg('<path d="M4 8h16v12H4z"/><path d="M9 8V5h6v3M12 11v6M9 14h6"/>') },
      { id: 'architect', name: 'Architect', r: 4, desc: 'Every new module installs at level 2.', icon: svg('<path d="M3 21h18M5 21V10l7-6 7 6v11"/><path d="M9 21v-6h6v6"/>'), apply(st) { st.architect = true; } },
    ],
  },
  {
    id: 'ghost', name: 'GHOST', role: 'Evasion', color: '#9d7bff', rgb: '157,123,255',
    desc: 'Lives on the edge of the bullet curtain. Graze, dash, strike.',
    icon: svg('<path d="M5 21V10a7 7 0 0114 0v11l-3-2-2 2-2-2-2 2-2-2z"/><circle cx="10" cy="11" r="1"/><circle cx="14" cy="11" r="1"/>'),
    ult: { id: 'phase', name: 'PHASE SHIFT', short: 'PHASE SHIFT', desc: 'Enemies and bullets slow to 40%. You are intangible, and grazes strike back.' },
    passives: [
      { id: 'widegraze', name: 'Wide Graze', r: 0, desc: '+50% graze radius.', icon: svg('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/>'), apply(st) { st.grazeR *= 1.5; } },
      { id: 'slipstream', name: 'Slipstream', r: 1, desc: '+15% move speed for 1.5s after a graze.', icon: svg('<path d="M3 8h12M3 12h18M3 16h12"/>'), apply(st) { st.slipstream = true; } },
      { id: 'riposte', name: 'Riposte', r: 2, desc: 'Grazing mid-dash refunds half a dash charge (1s cooldown).', icon: svg('<path d="M20 12a8 8 0 11-3-6.2M20 4v5h-5"/>'), apply(st) { st.riposte = true; } },
      { id: 'afterimage', name: 'Afterimage', r: 3, desc: 'Dashes leave 3 echoes that detonate after 0.3s.', icon: svg('<path d="M4 18l5-6-5-6M11 18l5-6-5-6M18 18l3-6-3-6"/>'), apply(st) { st.afterimage = true; } },
      { id: 'shade', name: 'Shade', r: 1, desc: '+20% dash length, +10% move speed.', icon: svg('<path d="M5 21V10a7 7 0 0114 0v11"/><path d="M9 14h6" stroke-dasharray="2 2"/>'), apply(st) { st.dashDur *= 1.2; st.speed *= 1.1; } },
      { id: 'wraithborn', name: 'Wraithborn', r: 4, desc: 'Dashes recharge 30% faster, grazes charge your ultimate 50% more.', icon: svg('<path d="M12 2l3 7h7l-6 4 2 8-6-5-6 5 2-8-6-4h7z"/>'), apply(st) { st.dashRecharge *= 0.7; st.grazeOd *= 1.5; } },
    ],
  },
];

const byClass = new Map(CLASSES.map((c) => [c.id, c]));
const byPassive = new Map();
for (const c of CLASSES) for (const ps of c.passives) byPassive.set(ps.id, ps);
export const classById = (id) => byClass.get(id);

// --- Profile: found classes / abilities, rank-gated slots -----------------------------------
// Classes and abilities are found (boss / elite drops, rank-ups: loot.js). Rank sets how many abilities a class can
// equip at once (ABILITY_SLOTS) and the rarest one it can equip (RARITY_CAP). Abilities have a rarity (rarity.js).

export const ABILITY_SLOTS = [[1, 1], [3, 2], [6, 3], [10, 4]]; // [rank, slots]
export const RARITY_CAP = [[1, 1], [3, 2], [6, 3], [10, 4]]; // [rank, highest rarity]
const byRank = (table, rank) => table.reduce((v, [r, x]) => (rank >= r ? x : v), table[0][1]);

const currentRank = () => rankFor(profile.rankXp).rank;
export const abilitySlots = (rank = currentRank()) => byRank(ABILITY_SLOTS, rank);
export const rarityCap = (rank = currentRank()) => byRank(RARITY_CAP, rank);
// Rank needed to equip a rarity / to get `n` slots.
export const rankForRarity = (r) => (RARITY_CAP.find(([, x]) => x >= r) || [99])[0];
export const nextSlotRank = () => (ABILITY_SLOTS.find(([r]) => r > currentRank()) || [0])[0];

export const classUnlocked = (c) => profile.pilot.classes.includes(c.id);
export const passiveFound = (ps) => profile.pilot.found.includes(ps.id);
export const passiveUnlocked = (c, ps) => classUnlocked(c) && passiveFound(ps) && ps.r <= rarityCap();
export const passiveById = (id) => byPassive.get(id);
export const classOfPassive = (id) => CLASSES.find((c) => c.passives.some((ps) => ps.id === id));
export const ALL_PASSIVES = CLASSES.flatMap((c) => c.passives);

// Saves from before abilities were found: grant what the old rank gates had opened (classes 1/3/6, old passive ranks).
const OLD_GATES = { striker: 1, engineer: 3, ghost: 6, killstreak: 1, hairtrigger: 2, executioner: 4, bloodrush: 5, salvager: 3, overflow: 4, dronelink: 5, nanorepair: 7, widegraze: 6, slipstream: 7, riposte: 8, afterimage: 10 };
export function initPilotProfile() {
  const pl = profile.pilot;
  if (!pl.legacy) return;
  delete pl.legacy;
  const rank = currentRank();
  for (const c of CLASSES) {
    if (rank < OLD_GATES[c.id]) continue;
    if (!pl.classes.includes(c.id)) pl.classes.push(c.id);
    for (const ps of c.passives) if (OLD_GATES[ps.id] && rank >= OLD_GATES[ps.id] && !pl.found.includes(ps.id)) pl.found.push(ps.id);
  }
  saveProfile();
}

// Unlocks a found class / ability; returns true when it was new.
export function findClass(id) {
  if (!classById(id) || profile.pilot.classes.includes(id)) return false;
  profile.pilot.classes.push(id);
  saveProfile();
  return true;
}
export function findPassive(id) {
  if (!byPassive.has(id) || profile.pilot.found.includes(id)) return false;
  profile.pilot.found.push(id);
  saveProfile();
  return true;
}

export function activeClass() {
  const c = classById(profile.pilot.cls);
  return c && classUnlocked(c) ? c : CLASSES[0];
}

// Equipped passive defs for a class: found, within the rarity cap, at most abilitySlots().
export function equippedPassives(clsId) {
  const c = classById(clsId);
  if (!c || !classUnlocked(c)) return [];
  const ids = profile.pilot.passives[clsId] || [];
  const out = [];
  for (const id of ids) {
    const ps = c.passives.find((x) => x.id === id);
    if (ps && passiveUnlocked(c, ps) && !out.includes(ps)) out.push(ps);
  }
  return out.slice(0, abilitySlots());
}

const lockReason = (c, ps) => (!classUnlocked(c) ? 'CLASS NOT FOUND' : !passiveFound(ps) ? 'NOT FOUND' : `RANK ${rankForRarity(ps.r)}`);

// All of these return '' on success, else a reason.
export function setClass(id) {
  const c = classById(id);
  if (!c) return 'UNKNOWN CLASS';
  if (!classUnlocked(c)) return 'NOT FOUND';
  profile.pilot.cls = id;
  saveProfile();
  return '';
}

export function togglePassive(clsId, id) {
  const c = classById(clsId);
  const ps = c && c.passives.find((x) => x.id === id);
  if (!ps) return 'UNKNOWN PASSIVE';
  if (!passiveUnlocked(c, ps)) return lockReason(c, ps);
  const ids = equippedPassives(clsId).map((x) => x.id);
  const i = ids.indexOf(id);
  if (i >= 0) ids.splice(i, 1);
  else if (ids.length >= abilitySlots()) return 'SLOTS FULL';
  else ids.push(id);
  profile.pilot.passives[clsId] = ids;
  saveProfile();
  return '';
}

export function setPassives(clsId, ids) {
  const c = classById(clsId);
  if (!c) return 'UNKNOWN CLASS';
  if (ids.length > abilitySlots()) return 'SLOTS FULL';
  for (const id of ids) {
    const ps = c.passives.find((x) => x.id === id);
    if (!ps) return 'UNKNOWN PASSIVE';
    if (!passiveUnlocked(c, ps)) return lockReason(c, ps);
  }
  profile.pilot.passives[clsId] = [...new Set(ids)];
  saveProfile();
  return '';
}

// --- Stats --------------------------------------------------------------------------------

const FLAGS = ['killstreak', 'exec', 'bloodrush', 'nanorepair', 'riposte', 'afterimage', 'slipstream', 'architect'];

// Neutral values for the fields passives and gear touch; recomputeStats runs this before applyParts.
export function resetPilotStats(st) {
  for (const f of FLAGS) st[f] = false;
  st.modDmg = 1;
  st.maxModules = MAX_MODULES;
}

// Runs right after applyParts in recomputeStats. p.passives = ids (empty for attract / stat previews).
export function applyPassives(st, p) {
  if (!p.passives) return;
  for (const id of p.passives) {
    const ps = byPassive.get(id);
    if (ps && ps.apply) ps.apply(st, p);
  }
}

// --- Per-player run state -----------------------------------------------------------------

export function initPilot(p, cls, passives) {
  p.cls = cls.id;
  p.ucol = cls.color;
  p.passives = passives;
  p.pdm = 1; // pilot damage multiplier (Killstreak)
  p.odExt = 0; // seconds Bloodrush has added to the current ult
  p.elites = 0; // elites killed this sector (Nanorepair)
  p.slipT = 0;
  p.ripT = 0;
  p.ghostT = 0;
  p.tsc = 1; // smoothed enemy time scale
  p.domeFlare = 0;
  p.domeSfx = 0;
  p.echoI = 0;
  p.echoes = [];
  for (let i = 0; i < 6; i++) p.echoes.push({ x: 0, y: 0, t: 0 });
}

// True while the Striker's fire / damage boost applies (other classes only get their own ult effect).
export const boosted = (p) => p.odT > 0 && p.cls === 'striker';
export const phasing = (p) => p.odT > 0 && p.cls === 'ghost';
export const fortressOn = (p) => p.odT > 0 && p.cls === 'engineer';

// --- Ultimates ------------------------------------------------------------------------------

function blastNear(p, radius) {
  const r2 = radius * radius;
  for (const e of G.enemies) {
    if (e.dead || !e.entered || dist2(p.x, p.y, e.x, e.y) > r2) continue;
    damageEnemy(e, e.boss ? e.maxHp * 0.02 : 30 * p.st.dmg * G.director.diff.hp * 0.35, e.x, e.y, true);
  }
}

// Each takes the caster (the player; step 6's ECLIPSE can call these with a boss-shaped caster).
const ULTS = {
  striker(p) {
    G.pulse = 0.001;
    G.pulseMax = 1100;
    let cleared = 0;
    clearBullets(p.x, p.y, Infinity, () => cleared++);
    if (cleared) G.score += cleared * 25 * comboMult();
    for (const e of G.enemies) {
      if (e.dead || !e.entered) continue;
      damageEnemy(e, e.boss ? e.maxHp * 0.03 : 30 * p.st.dmg * G.director.diff.hp * 0.35, e.x, e.y, true);
    }
    vacuumAll();
  },
  engineer(p) {
    G.pulse = 0.001;
    G.pulseMax = 320;
    let cleared = 0;
    clearBullets(p.x, p.y, 260, () => cleared++);
    if (cleared) G.score += cleared * 25 * comboMult();
    blastNear(p, 260);
    ring(p.x, p.y, DOME_R, '#ffb02e', 0.5);
  },
  ghost(p) {
    G.pulse = 0.001;
    G.pulseMax = 520;
    p.ghostT = 0;
  },
};

// Class-specific part of activateOverdrive (the meter, i-frames, sfx and floatText live in player.js).
export function castUlt(p) {
  p.odExt = 0;
  p.domeFlare = 0;
  (ULTS[p.cls] || ULTS.striker)(p);
}

// Extra Overdrive time from Bloodrush kills (called from onEnemyKilled).
export function bloodrush(p) {
  if (!p.st.bloodrush || !boosted(p) || p.odExt >= 4) return;
  const add = Math.min(0.15, 4 - p.odExt);
  p.odT += add;
  p.odExt += add;
}

export function onEliteKilled(p) {
  p.elites++;
}

// Called by the director when a sector clears.
export function onSectorClear(p, bossSector) {
  if (p.st.nanorepair && (p.elites > 0 || bossSector) && !p.dead && p.hp < p.maxHp) {
    p.hp++;
    floatText(p.x, p.y - 44, '+1 NANOREPAIR', '#ffb02e', 11, 1.2);
    ring(p.x, p.y, 40, '#ffb02e', 0.4);
    sfx.heal();
  }
  p.elites = 0;
}

// --- Frame hooks ----------------------------------------------------------------------------

// G.enemyTimeScale for this step (smoothed; 0.4 while phasing). Call before updating enemies.
export function pilotTimeScale(p, dt) {
  const target = p && !p.dead && phasing(p) ? PHASE_SCALE : 1;
  if (!p) return (G.enemyTimeScale = 1);
  p.tsc += (target - p.tsc) * Math.min(1, 14 * dt);
  if (Math.abs(p.tsc - target) < 0.012) p.tsc = target;
  G.enemyTimeScale = p.tsc;
  return p.tsc;
}

function detonate(p, e) {
  const R = 48;
  ring(e.x, e.y, R, '#9d7bff', 0.35);
  sparks(e.x, e.y, '#d4c4ff', 10, 260);
  const dmg = 9 * p.st.dmg * p.pdm;
  for (const en of G.enemies) {
    if (en.dead || !en.entered) continue;
    const rr = R + en.r;
    if (dist2(e.x, e.y, en.x, en.y) < rr * rr) damageEnemy(en, dmg, en.x, en.y);
  }
  sfx.zap();
}

export function updatePilot(p, dt) {
  const st = p.st;
  p.pdm = st.killstreak ? 1 + Math.min(0.2, Math.floor(G.combo / 10) * 0.02) : 1;
  if (p.slipT > 0) p.slipT -= dt;
  if (p.ripT > 0) p.ripT -= dt;
  if (p.domeFlare > 0) p.domeFlare -= dt;
  if (p.domeSfx > 0) p.domeSfx -= dt;
  for (const e of p.echoes) {
    if (e.t <= 0) continue;
    e.t -= dt;
    if (e.t <= 0) detonate(p, e);
  }
  if (phasing(p)) {
    p.ghostT -= dt;
    if (p.ghostT <= 0) {
      p.ghostT = 0.045;
      p.ghosts.push({ x: p.x, y: p.y, life: 0.22, bank: p.bank });
    }
  }
}

// Afterimage: 3 echoes along the dash path, each detonating 0.3s later.
export function spawnEchoes(p, dx, dy) {
  const b = playfieldBounds();
  const len = 1150 * 0.13 * p.st.dashDur;
  for (let i = 1; i <= 3; i++) {
    const e = p.echoes[p.echoI++ % p.echoes.length];
    e.x = clamp(p.x + dx * len * (i / 3), b.left, b.right);
    e.y = clamp(p.y + dy * len * (i / 3), b.top, b.bottom);
    e.t = 0.3;
  }
}

// Fortress dome: runs after bullets have moved and before they are tested against the player.
export function domeErase(p) {
  if (!fortressOn(p) || p.dead) return;
  let n = 0;
  clearBullets(p.x, p.y, DOME_R, () => n++);
  if (n) {
    for (let i = 0; i < n; i++) addScore(25);
    p.domeFlare = 0.18;
    if (p.domeSfx <= 0) {
      p.domeSfx = 0.09;
      sfx.graze();
    }
  }
}

// A graze happened (world.js). Slipstream, Riposte and Phase Shift's graze strike.
export function onGraze(p) {
  const st = p.st;
  if (st.slipstream) p.slipT = 1.5;
  if (st.riposte && p.dashT > 0 && p.ripT <= 0 && p.charges < p.maxCharges) {
    p.ripT = 1;
    p.rechargeT += st.dashRecharge * 0.5;
    floatText(p.x, p.y - 28, '+½ DASH', '#9d7bff', 10, 0.7);
  }
  if (phasing(p)) {
    const e = nearestEnemy(p.x, p.y);
    if (e) {
      damageEnemy(e, 8 * st.dmg * p.pdm, e.x, e.y);
      sparks(e.x, e.y, '#d4c4ff', 3, 180);
    }
  }
}
