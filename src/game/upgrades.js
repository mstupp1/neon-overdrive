// Roguelike upgrade pool: stats, defensive perks and weapon modules.
// Player stats are always recomputed from upgrade levels (no drift).

import { weightedPick } from '../core/math.js';
import { WEAPONS } from './ships.js';
import { applyParts } from './parts.js';
import { applyPassives } from './pilot.js';
import { profile, saveProfile } from '../core/storage.js';

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
  salvage: svg('<path d="M4 7h16l-2 13H6z"/><path d="M9 7V4h6v3M9 12l3 3 3-3"/>'),
  chainlink: svg('<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>'),
  grazer: svg('<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6" stroke-dasharray="2 3"/><path d="M3 4l5 4M21 20l-5-4"/>'),
  prospector: svg('<path d="M4 20l7-7M14 4l6 6-3 3-6-6z"/><circle cx="18" cy="18" r="2.5"/>'),
  overload: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="8" stroke-dasharray="1 4"/>'),
  splinter: svg('<path d="M3 12h9"/><path d="M12 12l8-6M12 12l8 6M12 12h9"/>'),
  redline: svg('<path d="M4 18a8 8 0 0116 0"/><path d="M12 18l5-7"/><path d="M17 8l2-2"/>'),
  blink: svg('<path d="M3 12h4M17 12h4"/><path d="M8 7l4 5-4 5M13 7l4 5-4 5" stroke-dasharray="2 2"/>'),
  leech: svg('<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/><path d="M9 11h6M12 8v6"/>'),
  bounty: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/>'),
  mines: svg('<circle cx="12" cy="13" r="5"/><path d="M12 2v6M6 8l2 2M18 8l-2 2M5 19l2-2M19 19l-2-2"/>'),
  secondWind: svg('<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/><path d="M13 7l-3 5h4l-3 5"/>'),
  cull: svg('<path d="M20 4C10 4 4 10 4 20"/><path d="M20 4l-6 2M20 4l-2 6"/><path d="M9 15l-5 5"/>'),
  echoFire: svg('<path d="M8 3v12M16 6v12"/><path d="M5 18h6M13 21h6" stroke-dasharray="2 2"/>'),
  static: svg('<path d="M4 12l4-4 4 4 4-4 4 4"/><path d="M4 18l4-4 4 4 4-4 4 4"/><circle cx="12" cy="5" r="1.5"/>'),
  saw: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2l2 4h-4zM22 12l-4 2v-4zM12 22l-2-4h4zM2 12l4-2v4z"/><circle cx="12" cy="12" r="7"/>'),
  stasis: svg('<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9"/>'),
  perpetual: svg('<path d="M7 8a4 4 0 100 8c3 0 7-8 10-8a4 4 0 110 8c-3 0-7-8-10-8z"/>'),
  prism: svg('<path d="M12 3l8 15H4z"/><path d="M2 11h7M15 10l7-3M15 13l7 0M15 16l7 3"/>'),
  starfall: svg('<path d="M12 2l1.8 4.2L18 8l-4.2 1.8L12 14l-1.8-4.2L6 8l4.2-1.8z"/><path d="M5 22l3-5M12 22v-5M19 22l-3-5"/>'),
  nullField: svg('<circle cx="12" cy="12" r="9" stroke-dasharray="3 2"/><path d="M6 18L18 6"/><circle cx="12" cy="12" r="3"/>'),
  supernova: svg('<circle cx="12" cy="12" r="4"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5M4 4l3.5 3.5M16.5 16.5L20 20M4 20l3.5-3.5M16.5 7.5L20 4"/>'),
  phalanx: svg('<path d="M3 10l3-6 3 6-3-1.5zM9 16l3-6 3 6-3-1.5zM15 10l3-6 3 6-3-1.5z"/><path d="M6 13v4M18 13v4M12 19v3"/>'),
  eventHorizon: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3a9 9 0 019 9M21 12a9 9 0 01-9 9M12 21a9 9 0 01-9-9M3 12a9 9 0 019-9"/><path d="M5 5l3 3M19 19l-3-3"/>'),
  mirrorstorm: svg('<path d="M4 17a8 8 0 0116 0"/><path d="M12 15V6M8 9l4-4 4 4M5 10l3 1M19 10l-3 1"/>'),
  credits: svg('<circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.8-1-2-1.5-3-1.5-1.7 0-3 1-3 2.5s1.3 2 3 2.5 3 1 3 2.5-1.3 2.5-3 2.5c-1 0-2.2-.5-3-1.5M12 5v2M12 17v2"/>'),
  repair: svg('<path d="M12 5v14M5 12h14"/>'),
};

const pct = (v) => `${Math.round(v * 100)}%`;

// cat: weapon | module | stat | defense | evolution
// tier: the system a run must reach before the option can turn up (0 Genesis, 1 Crimson, 2 Cyclone, 3 Void).
// Once an option has been seen in any draft it is "discovered" (profile.tech) and can turn up from Genesis on in later runs.
export const UPGRADES = [
  {
    id: 'main', name: 'Main Cannon', cat: 'weapon', max: 7, weight: 1.35, tier: 0,
    desc: (lv) => (lv < 5 ? 'More barrels. Wider, denser primary fire.' : 'Heavier rounds: +14% primary damage & extra barrels.'),
  },
  { id: 'power', name: 'Plasma Core', cat: 'stat', max: 6, weight: 1.1, tier: 0, desc: () => '+15% damage for all weapons.' },
  { id: 'rate', name: 'Overclock', cat: 'stat', max: 6, weight: 1.1, tier: 0, desc: () => '+12% fire rate for all weapons.' },
  { id: 'crit', name: 'Targeting AI', cat: 'stat', max: 5, weight: 0.8, tier: 0, desc: (lv) => `+7% critical chance (${pct(0.07 * lv)}). Crits deal 2.5x.` },
  { id: 'pierce', name: 'Phase Rounds', cat: 'stat', max: 3, weight: 0.7, tier: 0, desc: () => 'Primary shots pierce +1 enemy.' },
  { id: 'thrusters', name: 'Thrusters', cat: 'stat', max: 4, weight: 0.8, tier: 0, desc: () => '+8% move speed, dashes recharge 12% faster.' },
  { id: 'magnet', name: 'Tractor Field', cat: 'stat', max: 4, weight: 0.7, tier: 0, desc: () => '+55% pickup range.' },
  { id: 'capacitor', name: 'Capacitor', cat: 'stat', max: 4, weight: 0.8, tier: 0, desc: () => '+25% Overdrive charge, +1s duration.' },
  { id: 'salvage', name: 'Salvage Protocol', cat: 'stat', max: 3, weight: 0.6, tier: 0, desc: () => '+15% XP from data shards.' },
  { id: 'chainlink', name: 'Chain Link', cat: 'stat', max: 3, weight: 0.6, tier: 0, desc: () => 'Combo lasts 0.8s longer. +1% damage per combo multiplier step.' },
  { id: 'grazer', name: 'Graze Field', cat: 'stat', max: 3, weight: 0.6, tier: 0, desc: () => '+30% graze radius, +35% Overdrive from grazes.' },
  { id: 'prospector', name: 'Prospector', cat: 'stat', max: 3, weight: 0.5, tier: 0, desc: () => '+20% credits from kills and drops.' },
  { id: 'hull', name: 'Reinforced Hull', cat: 'defense', max: 4, weight: 0.9, tier: 0, desc: () => '+1 max hull and repair 1.' },
  { id: 'aegis', name: 'Aegis Shield', cat: 'defense', max: 4, weight: 0.8, tier: 0, desc: (lv) => `Regenerating shield absorbs a hit. Recharge ${16 - 3 * lv}s.` },
  { id: 'dashes', name: 'Afterburner', cat: 'defense', max: 2, weight: 0.6, tier: 0, desc: () => '+1 dash charge.' },

  { id: 'missiles', name: 'Swarm Missiles', cat: 'module', max: 5, weight: 1, tier: 0, desc: (lv) => (lv === 1 ? 'Launch homing missiles that explode on impact.' : 'More missiles, faster launches.') },
  { id: 'orbitals', name: 'Razor Orbit', cat: 'module', max: 5, weight: 1, tier: 0, desc: (lv) => (lv === 1 ? 'Blades orbit your ship, shredding enemies and bullets.' : '+1 blade, more damage.') },
  { id: 'drones', name: 'Wingmen', cat: 'module', max: 5, weight: 1, tier: 0, desc: (lv) => (lv === 1 ? 'Two drones fly escort and fire with you.' : lv === 3 ? 'Drones auto-aim at enemies. Faster fire.' : 'Faster, harder-hitting drones.') },
  { id: 'arc', name: 'Arc Coil', cat: 'module', max: 5, weight: 1, tier: 0, desc: (lv) => (lv === 1 ? 'Lightning periodically chains between enemies.' : '+1 chain, faster, more damage.') },
  { id: 'nova', name: 'Pulse Nova', cat: 'module', max: 5, weight: 0.9, tier: 0, desc: (lv) => (lv === 1 ? 'Emit a ring of energy shots around you.' : 'Denser, more frequent rings.') },
  { id: 'shrapnel', name: 'Shrapnel', cat: 'module', max: 5, weight: 0.8, tier: 0, desc: () => 'Destroyed enemies burst into damaging fragments.' },
  { id: 'dashNova', name: 'Shock Dash', cat: 'module', max: 5, weight: 0.8, tier: 0, desc: (lv) => (lv === 1 ? 'Dashing unleashes blades and erases nearby bullets.' : 'More blades, larger erase radius.') },
  { id: 'flak', name: 'Flak Burst', cat: 'module', max: 5, weight: 0.85, tier: 0, desc: (lv) => (lv === 1 ? 'Slow flak shells airburst near enemies into shrapnel rings.' : 'More fragments and damage per burst.') },

  // --- Crimson tech ---
  { id: 'overload', name: 'Overload Rounds', cat: 'stat', max: 3, weight: 0.7, tier: 1, desc: () => 'Critical hits detonate, splashing nearby enemies.' },
  { id: 'splinter', name: 'Splinter Rounds', cat: 'stat', max: 3, weight: 0.7, tier: 1, desc: (lv) => `${[0, 12, 22, 32][lv]}% of primary hits split into two fragments.` },
  { id: 'redline', name: 'Redline', cat: 'stat', max: 3, weight: 0.6, tier: 1, desc: (lv) => `+${12 * lv}% damage for every missing hull point.` },
  { id: 'bounty', name: 'Bounty Hunter', cat: 'stat', max: 3, weight: 0.6, tier: 1, desc: () => '+15% damage to elites and bosses.' },
  { id: 'blink', name: 'Blink Drive', cat: 'defense', max: 2, weight: 0.6, tier: 1, desc: () => 'Dashes travel 20% further with 20% longer invulnerability.' },
  { id: 'leech', name: 'Leech Protocol', cat: 'defense', max: 3, weight: 0.6, tier: 1, desc: (lv) => `Repair 1 hull every ${[0, 90, 70, 50][lv]} kills.` },
  { id: 'rail', name: 'Rail Lance', cat: 'module', max: 5, weight: 0.9, tier: 1, desc: (lv) => (lv === 1 ? 'Fire a massive piercing beam forward.' : 'Wider beam, more damage, faster charge.') },
  { id: 'reflector', name: 'Reflector', cat: 'module', max: 5, weight: 0.85, tier: 1, desc: (lv) => (lv === 1 ? 'A pulsing shield bubble turns enemy bullets back on their owners.' : 'Wider bubble, more frequent, harder-hitting returns.') },
  { id: 'mines', name: 'Proximity Mines', cat: 'module', max: 5, weight: 0.85, tier: 1, desc: (lv) => (lv === 1 ? 'Drop mines in your wake that blow when enemies come close.' : 'More mines, bigger blasts.') },

  // --- Cyclone tech ---
  { id: 'cull', name: 'Culling Edge', cat: 'stat', max: 3, weight: 0.6, tier: 2, desc: (lv) => `Enemies below ${4 + 4 * lv}% hull are destroyed outright. Not bosses.` },
  { id: 'echoFire', name: 'Echo Fire', cat: 'stat', max: 3, weight: 0.6, tier: 2, desc: (lv) => `${[0, 12, 22, 32][lv]}% of primary volleys fire a second time.` },
  { id: 'static', name: 'Static Discharge', cat: 'stat', max: 3, weight: 0.6, tier: 2, desc: (lv) => `Kills arc lightning into ${lv} nearby ${lv === 1 ? 'enemy' : 'enemies'}.` },
  { id: 'secondWind', name: 'Second Wind', cat: 'defense', max: 2, weight: 0.5, tier: 2, desc: (lv) => `A killing blow leaves you at 1 hull instead (${lv === 1 ? 'once' : 'twice'} per run).` },
  { id: 'gravity', name: 'Gravity Well', cat: 'module', max: 5, weight: 0.85, tier: 2, desc: (lv) => (lv === 1 ? 'Drop a singularity that drags enemies and bullets in and crushes them.' : 'Bigger, stronger, more frequent wells.') },
  { id: 'saw', name: 'Buzzsaw', cat: 'module', max: 5, weight: 0.85, tier: 2, desc: (lv) => (lv === 1 ? 'Hurl a saw that carves through enemies and boomerangs back.' : lv === 3 ? 'Throw two saws at once.' : 'Bigger, faster, harder-hitting saws.') },
  { id: 'stasis', name: 'Stasis Pulse', cat: 'module', max: 5, weight: 0.8, tier: 2, desc: (lv) => (lv === 1 ? 'A pulse freezes nearby bullets to a crawl and shocks enemies.' : 'Wider, more frequent pulses.') },

  // --- Void tech ---
  { id: 'perpetual', name: 'Perpetual Engine', cat: 'stat', max: 3, weight: 0.55, tier: 3, desc: () => 'Your ultimate meter slowly charges on its own.' },
  { id: 'nullField', name: 'Null Field', cat: 'defense', max: 3, weight: 0.55, tier: 3, desc: () => 'Enemy bullets that come close slow down. Wider each level.' },
  { id: 'prism', name: 'Prism Beam', cat: 'module', max: 5, weight: 0.8, tier: 3, desc: (lv) => (lv === 1 ? 'A locked-on beam burns the nearest enemy.' : lv === 3 || lv === 5 ? 'The beam splits to one more target.' : 'Hotter beam, longer reach.') },
  { id: 'starfall', name: 'Starfall', cat: 'module', max: 5, weight: 0.8, tier: 3, desc: (lv) => (lv === 1 ? 'Call down falling stars that blast enemies from above.' : 'More stars, bigger impacts.') },

  // Evolutions: cat 'evolution', unlocked by a maxed module plus an owned partner stat (mod / stat). Never sold in the market.
  { id: 'hellfire', name: 'Hellfire Swarm', cat: 'evolution', max: 1, weight: 7, tier: 0, mod: 'missiles', stat: 'crit', desc: () => 'Missiles: double the salvo, bigger blasts, and missile hits always crit.' },
  { id: 'stormhalo', name: 'Storm Halo', cat: 'evolution', max: 1, weight: 7, tier: 0, mod: 'orbitals', stat: 'thrusters', desc: () => 'Orbit: +3 blades, a pulsing orbit radius and a wider bullet-shredding field.' },
  { id: 'teslastorm', name: 'Tesla Storm', cat: 'evolution', max: 1, weight: 7, tier: 0, mod: 'arc', stat: 'capacitor', desc: () => 'Arc: fires twice as often, +3 chains, and never stops during your ultimate.' },
  { id: 'supernova', name: 'Supernova', cat: 'evolution', max: 1, weight: 7, tier: 1, mod: 'nova', stat: 'power', desc: () => 'Nova: denser rings that pierce deep, and every ring wipes bullets around you.' },
  { id: 'phalanx', name: 'Phalanx', cat: 'evolution', max: 1, weight: 7, tier: 1, mod: 'drones', stat: 'rate', desc: () => 'Wingmen: five drones in formation, firing faster.' },
  { id: 'annihilator', name: 'Annihilator', cat: 'evolution', max: 1, weight: 7, tier: 1, mod: 'rail', stat: 'pierce', desc: () => 'Rail: a huge beam, twice as often, leaving a burning afterglow.' },
  { id: 'mirrorstorm', name: 'Mirror Storm', cat: 'evolution', max: 1, weight: 7, tier: 2, mod: 'reflector', stat: 'aegis', desc: () => 'Reflector: pulses twice as often and every returned shot splits in three.' },
  { id: 'eventHorizon', name: 'Event Horizon', cat: 'evolution', max: 1, weight: 7, tier: 2, mod: 'gravity', stat: 'magnet', desc: () => 'Gravity: huge, long-lived wells that collapse in a crushing blast.' },
];

// --- Discovery -------------------------------------------------------------------------
// profile.tech lists every option ever seen in a draft, market or event. An option shows up once the run has reached its
// tier, or from the start of any run once it is discovered.
const known = () => new Set(profile.tech);
export const isDiscovered = (id) => profile.tech.includes(id);

// Marks the given option ids as seen; returns the ones that were never seen before (and saves when there are any).
export function discover(ids) {
  const k = known();
  const fresh = [];
  for (const id of ids) {
    if (!byId.has(id) || k.has(id)) continue;
    k.add(id);
    profile.tech.push(id);
    fresh.push(id);
  }
  if (fresh.length) saveProfile();
  return fresh;
}

const available = (p, u, k) => (u.tier || 0) <= (p.techTier || 0) || k.has(u.id);

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

// An evolution is offered once its module is maxed, its partner stat is owned and it has not been taken.
function evolutionReady(p, u) {
  return u.cat === 'evolution' && !p.up[u.id] && (p.up[u.mod] || 0) >= byId.get(u.mod).max && (p.up[u.stat] || 0) >= 1;
}

function moduleCount(p) {
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
  st.xpMul = 1 + 0.15 * lv('salvage');
  st.creditMul = 1 + 0.2 * lv('prospector');
  st.grazeR = 1 + 0.3 * lv('grazer');
  st.grazeOd = 1 + 0.35 * lv('grazer');
  st.dashDur = 1 + 0.2 * lv('blink');
  st.critMul = 2.5;
  // Behavioural upgrades read by their hook points (world.js, enemies.js, player.js, modules.js).
  st.comboT = 2.6 + 0.8 * lv('chainlink');
  st.chainDmg = 0.01 * lv('chainlink');
  st.overload = lv('overload');
  st.splinter = [0, 0.12, 0.22, 0.32][lv('splinter')];
  st.redline = 0.12 * lv('redline');
  st.bounty = 0.15 * lv('bounty');
  st.leech = [0, 90, 70, 50][lv('leech')];
  st.cull = lv('cull') ? 0.04 + 0.04 * lv('cull') : 0;
  st.echo = [0, 0.12, 0.22, 0.32][lv('echoFire')];
  st.static = lv('static');
  st.secondWind = lv('secondWind');
  st.perpetual = 1.2 * lv('perpetual');
  st.nullR = lv('nullField') ? 55 + 15 * lv('nullField') : 0;
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
  const k = known();
  const pool = UPGRADES.filter((u) => {
    const l = p.up[u.id] || 0;
    if (!l && !available(p, u, k)) return false;
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
    if (!k.has(u.id)) wgt *= 1.4; // undiscovered tech surfaces a little sooner
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
  // fresh: never seen in any run before this draft (discover() has not run for it yet).
  return { id, name: u.name, cat: u.cat, icon: ICONS[id], desc: u.desc(lv + 1), lv, max: u.max, evo: u.cat === 'evolution', fresh: !isDiscovered(id) };
}
