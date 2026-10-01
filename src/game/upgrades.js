// Roguelike upgrade pool: stats, defensive perks and weapon modules.
// Player stats are always recomputed from upgrade levels (no drift).

import { weightedPick } from '../core/math.js';
import { WEAPONS } from './ships.js';
import { applyParts } from './parts.js';
import { applyPassives } from './pilot.js';

export const MAX_MODULES = 4;

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const ICONS = {
  main: svg('<path d="M12 3v14M7 7v10M17 7v10M5 21h14"/>'),
  power: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  rate: svg('<path d="M3 12h4l3-7 4 14 3-7h4"/>'),
  thrusters: svg('<path d="M6 13l6-6 6 6M6 19l6-6 6 6"/>'),
  hull: svg('<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/>'),
  magnet: svg('<path d="M6 4v8a6 6 0 0012 0V4M6 8h4M14 8h4"/>'),
  crit: svg('<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>'),
  pierce: svg('<path d="M3 12h16M14 6l6 6-6 6M8 7v10"/>'),
  capacitor: svg('<path d="M12 2l8 5v10l-8 5-8-5V7z"/><path d="M13 7l-3 5h4l-3 5"/>'),
  aegis: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
  dashes: svg('<path d="M4 18l6-6-6-6M12 18l6-6-6-6"/>'),
  missiles: svg('<path d="M12 2c3 3 4 7 4 11l-4 3-4-3c0-4 1-8 4-11z"/><path d="M8 16l-3 5M16 16l3 5M12 18v4"/>'),
  orbitals: svg('<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><circle cx="21" cy="12" r="1"/><circle cx="3" cy="12" r="1"/>'),
  drones: svg('<path d="M6 10l3-6 3 6-3-1.5zM12 20l3-6 3 6-3-1.5z"/><path d="M9 14v3M15 5v4"/>'),
  arc: svg('<path d="M13 2L6 12h5l-2 10 8-12h-5l3-8z"/>'),
  nova: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/>'),
  rail: svg('<path d="M12 2v20M8 6v16M16 6v16M8 6l4-4 4 4"/>'),
  shrapnel: svg('<circle cx="12" cy="12" r="2"/><path d="M12 5v2M12 17v2M5 12h2M17 12h2M7 7l1.5 1.5M15.5 15.5L17 17M7 17l1.5-1.5M15.5 8.5L17 7"/>'),
  dashNova: svg('<path d="M4 20L14 10"/><path d="M14 4l1.5 4.5L20 10l-4.5 1.5L14 16l-1.5-4.5L8 10l4.5-1.5z"/>'),
  gravity: svg('<circle cx="12" cy="12" r="2.2"/><path d="M12 3a9 9 0 019 9M21 12a9 9 0 01-9 9M12 21a9 9 0 01-9-9M3 12a9 9 0 019-9" stroke-dasharray="3 3"/><path d="M12 7a5 5 0 015 5"/>'),
  reflector: svg('<path d="M4 17a8 8 0 0116 0"/><path d="M9 11l3-3 3 3M12 8v9"/>'),
  flak: svg('<circle cx="12" cy="13" r="3"/><path d="M12 2v5M12 19v3M4 13h3M17 13h3M6 7l2 2M18 7l-2 2M6 19l2-2M18 19l-2-2"/>'),
  hellfire: svg('<path d="M12 2c3 3 4 7 4 11l-4 3-4-3c0-4 1-8 4-11z"/><path d="M5 8c0 3 1 5 3 7M19 8c0 3-1 5-3 7M12 17v5"/>'),
  stormhalo: svg('<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="8" stroke-dasharray="4 3"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>'),
  teslastorm: svg('<path d="M13 2L6 12h5l-2 10 8-12h-5l3-8z"/><path d="M4 5l2 2M20 5l-2 2M3 16l3-1M21 16l-3-1"/>'),
  annihilator: svg('<path d="M12 2v20M7 6v16M17 6v16M3 10v12M21 10v12"/>'),
  credits: svg('<circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.8-1-2-1.5-3-1.5-1.7 0-3 1-3 2.5s1.3 2 3 2.5 3 1 3 2.5-1.3 2.5-3 2.5c-1 0-2.2-.5-3-1.5M12 5v2M12 17v2"/>'),
  repair: svg('<path d="M12 5v14M5 12h14"/>'),
};

const pct = (v) => `${Math.round(v * 100)}%`;

// cat: weapon | module | stat | defense
export const UPGRADES = [
  {
    id: 'main', name: 'Main Cannon', cat: 'weapon', max: 7, weight: 1.35,
    desc: (lv) => (lv < 5 ? 'More barrels. Wider, denser primary fire.' : 'Heavier rounds: +14% primary damage & extra barrels.'),
  },
  { id: 'power', name: 'Plasma Core', cat: 'stat', max: 6, weight: 1.1, desc: () => '+15% damage for all weapons.' },
  { id: 'rate', name: 'Overclock', cat: 'stat', max: 6, weight: 1.1, desc: () => '+12% fire rate for all weapons.' },
  { id: 'crit', name: 'Targeting AI', cat: 'stat', max: 5, weight: 0.8, desc: (lv) => `+7% critical chance (${pct(0.07 * lv)}). Crits deal 2.5x.` },
  { id: 'pierce', name: 'Phase Rounds', cat: 'stat', max: 3, weight: 0.7, desc: () => 'Primary shots pierce +1 enemy.' },
  { id: 'thrusters', name: 'Thrusters', cat: 'stat', max: 4, weight: 0.8, desc: () => '+8% move speed, dashes recharge 12% faster.' },
  { id: 'magnet', name: 'Tractor Field', cat: 'stat', max: 4, weight: 0.7, desc: () => '+55% pickup range.' },
  { id: 'capacitor', name: 'Capacitor', cat: 'stat', max: 4, weight: 0.8, desc: () => '+25% Overdrive charge, +1s duration.' },
  { id: 'hull', name: 'Reinforced Hull', cat: 'defense', max: 4, weight: 0.9, desc: () => '+1 max hull and repair 1.' },
  { id: 'aegis', name: 'Aegis Shield', cat: 'defense', max: 4, weight: 0.8, desc: (lv) => `Regenerating shield absorbs a hit. Recharge ${16 - 3 * lv}s.` },
  { id: 'dashes', name: 'Afterburner', cat: 'defense', max: 2, weight: 0.6, desc: () => '+1 dash charge.' },

  { id: 'missiles', name: 'Swarm Missiles', cat: 'module', max: 5, weight: 1, desc: (lv) => (lv === 1 ? 'Launch homing missiles that explode on impact.' : 'More missiles, faster launches.') },
  { id: 'orbitals', name: 'Razor Orbit', cat: 'module', max: 5, weight: 1, desc: (lv) => (lv === 1 ? 'Blades orbit your ship, shredding enemies and bullets.' : '+1 blade, more damage.') },
  { id: 'drones', name: 'Wingmen', cat: 'module', max: 5, weight: 1, desc: (lv) => (lv === 1 ? 'Two drones fly escort and fire with you.' : lv === 3 ? 'Drones auto-aim at enemies. Faster fire.' : 'Faster, harder-hitting drones.') },
  { id: 'arc', name: 'Arc Coil', cat: 'module', max: 5, weight: 1, desc: (lv) => (lv === 1 ? 'Lightning periodically chains between enemies.' : '+1 chain, faster, more damage.') },
  { id: 'nova', name: 'Pulse Nova', cat: 'module', max: 5, weight: 0.9, desc: (lv) => (lv === 1 ? 'Emit a ring of energy shots around you.' : 'Denser, more frequent rings.') },
  { id: 'rail', name: 'Rail Lance', cat: 'module', max: 5, weight: 0.9, desc: (lv) => (lv === 1 ? 'Fire a massive piercing beam forward.' : 'Wider beam, more damage, faster charge.') },
  { id: 'shrapnel', name: 'Shrapnel', cat: 'module', max: 5, weight: 0.8, desc: () => 'Destroyed enemies burst into damaging fragments.' },
  { id: 'dashNova', name: 'Shock Dash', cat: 'module', max: 5, weight: 0.8, desc: (lv) => (lv === 1 ? 'Dashing unleashes blades and erases nearby bullets.' : 'More blades, larger erase radius.') },
  { id: 'gravity', name: 'Gravity Well', cat: 'module', max: 5, weight: 0.85, desc: (lv) => (lv === 1 ? 'Drop a singularity that drags enemies and bullets in and crushes them.' : 'Bigger, stronger, more frequent wells.') },
  { id: 'reflector', name: 'Reflector', cat: 'module', max: 5, weight: 0.85, desc: (lv) => (lv === 1 ? 'A pulsing shield bubble turns enemy bullets back on their owners.' : 'Wider bubble, more frequent, harder-hitting returns.') },
  { id: 'flak', name: 'Flak Burst', cat: 'module', max: 5, weight: 0.85, desc: (lv) => (lv === 1 ? 'Slow flak shells airburst near enemies into shrapnel rings.' : 'More fragments and damage per burst.') },

  // Evolutions: cat 'evolution', unlocked by a maxed module plus an owned partner stat (mod / stat). Never sold in the market.
  { id: 'hellfire', name: 'Hellfire Swarm', cat: 'evolution', max: 1, weight: 7, mod: 'missiles', stat: 'crit', desc: () => 'Missiles: double the salvo, bigger blasts, and missile hits always crit.' },
  { id: 'stormhalo', name: 'Storm Halo', cat: 'evolution', max: 1, weight: 7, mod: 'orbitals', stat: 'thrusters', desc: () => 'Orbit: +3 blades, a pulsing orbit radius and a wider bullet-shredding field.' },
  { id: 'teslastorm', name: 'Tesla Storm', cat: 'evolution', max: 1, weight: 7, mod: 'arc', stat: 'capacitor', desc: () => 'Arc: fires twice as often, +3 chains, and never stops during your ultimate.' },
  { id: 'annihilator', name: 'Annihilator', cat: 'evolution', max: 1, weight: 7, mod: 'rail', stat: 'pierce', desc: () => 'Rail: a huge beam, twice as often, leaving a burning afterglow.' },
];

export const CAT_COLORS = {
  weapon: '#3ff6ff',
  module: '#ff3df2',
  stat: '#ffe14d',
  defense: '#ff4d6d',
  bonus: '#7dff6b',
  evolution: '#ffb300',
};

const byId = new Map(UPGRADES.map((u) => [u.id, u]));
export const upgradeById = (id) => byId.get(id);

export const evolved = (p, id) => (p.up[id] || 0) > 0;

// An evolution is offered once its module is maxed, its partner stat is owned and it has not been taken.
export function evolutionReady(p, u) {
  return u.cat === 'evolution' && !p.up[u.id] && (p.up[u.mod] || 0) >= byId.get(u.mod).max && (p.up[u.stat] || 0) >= 1;
}

export function moduleCount(p) {
  let n = 0;
  for (const u of UPGRADES) if (u.cat === 'module' && (p.up[u.id] || 0) > 0) n++;
  return n;
}

export function recomputeStats(p) {
  const up = p.up;
  const lv = (id) => up[id] || 0;
  const w = WEAPONS[p.ship.weapon];
  const st = p.st;
  st.mainLv = 1 + lv('main');
  st.dmg = (1 + 0.15 * lv('power')) * (p.dmgMod || 1); // dmgMod: Overcharged Reactor event
  st.rate = 1 + 0.12 * lv('rate');
  st.crit = 0.07 * lv('crit');
  st.pierce = (w.pierce || 0) + lv('pierce');
  st.speed = p.ship.speed * (1 + 0.08 * lv('thrusters'));
  st.dashRecharge = 1.5 * Math.pow(0.88, lv('thrusters'));
  st.magnet = 80 * (1 + 0.55 * lv('magnet'));
  st.odGain = 1 + 0.25 * lv('capacitor');
  st.odDur = 6 + lv('capacitor');
  st.maxHp = Math.max(1, p.ship.hp + lv('hull') + (p.hullMod || 0)); // hullMod: dock reinforcement (+) / contraband (-)
  st.shieldInterval = lv('aegis') ? 16 - 3 * lv('aegis') : 0;
  st.maxCharges = p.ship.dashes + lv('dashes');
  // Neutral defaults for fields only parts / pilots touch (attract mode and later steps rely on these).
  st.xpMul = 1;
  st.creditMul = 1;
  st.grazeR = 1;
  st.grazeOd = 1;
  st.dashDur = 1;
  st.critMul = 2.5;
  applyParts(st, p);
  applyPassives(st, p);
  st.maxHp = Math.max(1, st.maxHp);
  p.maxHp = st.maxHp;
  p.maxCharges = st.maxCharges;
}

export function applyUpgrade(p, id, G) {
  if (id === 'credits') {
    G.score += 2500 * (G.sector + G.loop * 9);
    p.od = Math.min(100, p.od + 25);
    return;
  }
  if (id === 'repair') {
    p.hp = Math.min(p.maxHp, p.hp + 2);
    return;
  }
  p.up[id] = (p.up[id] || 0) + 1;
  recomputeStats(p);
  if (id === 'hull') p.hp = Math.min(p.maxHp, p.hp + 1);
  if (id === 'aegis' && p.up.aegis === 1) p.shield = 1;
  if (id === 'dashes') p.charges = Math.min(p.maxCharges, p.charges + 1);
}

// Rolls up to n distinct upgrade ids from the current pool (weighted). `kind` is 'level' or 'sector'.
// `evo` lets eligible Evolutions into the pool (drafts only; the Black Market and Contraband leave it off).
export function rollUpgradeIds(p, kind, n = 3, rng = Math.random, evo = false) {
  const mods = moduleCount(p);
  const pool = UPGRADES.filter((u) => {
    const l = p.up[u.id] || 0;
    if (u.cat === 'evolution') return evo && evolutionReady(p, u);
    if (l >= u.max) return false;
    if (u.cat === 'module' && l === 0 && mods >= p.st.maxModules) return false;
    return true;
  });
  const choices = [];
  const weight = (u) => {
    const l = p.up[u.id] || 0;
    let wgt = u.weight;
    if (u.cat === 'module') {
      if (l > 0) wgt *= 1.5; // encourage building up what you own
      else if (kind === 'sector') wgt *= 1.6;
      if (mods === 0 && p.level >= 2) wgt *= 1.6; // first module comes early
    }
    if (u.id === 'main' && l < 3) wgt *= 1.5;
    if (u.id === 'hull' && p.hp < p.maxHp) wgt *= 1.3;
    return wgt;
  };
  const remaining = [...pool];
  while (choices.length < n && remaining.length) {
    const u = weightedPick(remaining, weight, rng);
    choices.push(u.id);
    remaining.splice(remaining.indexOf(u), 1);
    if (u.cat === 'evolution') for (let i = remaining.length - 1; i >= 0; i--) if (remaining[i].cat === 'evolution') remaining.splice(i, 1); // at most one per draft
  }
  return choices;
}

// Build a draft of 3 choices. `kind` is 'level' or 'sector'.
export function rollDraft(p, kind) {
  const choices = rollUpgradeIds(p, kind, 3, Math.random, true);
  if (choices.length < 3 && p.hp < p.maxHp) choices.push('repair');
  while (choices.length < 3) choices.push('credits');
  return choices;
}

export function cardInfo(p, id) {
  if (id === 'credits') {
    return { id, name: 'Data Cache', cat: 'bonus', icon: ICONS.credits, desc: 'Bank bonus score and +25% Overdrive.', lv: 0, max: 0 };
  }
  if (id === 'repair') {
    return { id, name: 'Field Repair', cat: 'bonus', icon: ICONS.repair, desc: 'Repair 2 hull.', lv: 0, max: 0 };
  }
  const u = byId.get(id);
  const lv = p.up[id] || 0;
  return { id, name: u.name, cat: u.cat, icon: ICONS[id], desc: u.desc(lv + 1), lv, max: u.max, evo: u.cat === 'evolution' };
}
