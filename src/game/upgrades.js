// Roguelike upgrade pool: stats, defensive perks and weapon modules.
// Player stats are always recomputed from upgrade levels (no drift).

import { weightedPick } from '../core/math.js';
import { WEAPONS } from './ships.js';
import { applyParts } from './parts.js';
import { applyPassives, resetPilotStats } from './pilot.js';
import { STATS, rollMods, itemLevel, TAGS, PATH_KIN, affixTag } from './parts.js';
import { RARITY, rollRarity } from './rarity.js';
import { profile, saveProfile } from '../core/storage.js';
import { applyTree } from './tree.js';

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
  boostTank: svg('<circle cx="12" cy="12" r="8"/><path d="M12 12V4"/><path d="M12 12l5 3" stroke-dasharray="2 2"/><path d="M8 20h8"/>'),
  ramScoop: svg('<path d="M4 8c4 0 6 2 8 4s4 4 8 4"/><path d="M4 14h5M4 18h8"/><path d="M17 4l3 4-4 1"/>'),
  injector: svg('<path d="M9 3h6M12 3v4"/><rect x="8" y="7" width="8" height="9"/><path d="M12 16v5M10 19l2 2 2-2"/>'),
  overthrust: svg('<path d="M3 6l6 6-6 6M10 6l6 6-6 6M17 6l4 6-4 6"/>'),
  projSize: svg('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3"/>'),
  projSpeed: svg('<path d="M3 8h8M3 12h12M3 16h8"/><path d="M15 6l6 6-6 6"/>'),
  gameSpeed: svg('<circle cx="12" cy="13" r="8"/><path d="M12 13l4-4M9 2h6"/><path d="M12 7v1" stroke-dasharray="1 2"/>'),
  dodge: svg('<path d="M14 4a3 3 0 100 6M9 21l2-7 4 3 2-6"/><path d="M3 10l3-2M3 15l4-1" stroke-dasharray="2 2"/>'),
  armorPierce: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M4 12h16M15 8l5 4-5 4"/>'),
  burstFire: svg('<path d="M7 3v10M12 3v14M17 3v10"/><path d="M5 20h14" stroke-dasharray="2 2"/>'),
  cryo: svg('<path d="M12 2v20M4 7l16 10M20 7L4 17"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/>'),
  deepFreeze: svg('<path d="M12 2v20M4 7l16 10M20 7L4 17"/><circle cx="12" cy="12" r="9" stroke-dasharray="2 3"/>'),
  incendiary: svg('<path d="M12 2c1 4 6 6 6 12a6 6 0 01-12 0c0-3 2-4 3-7 1 1 2 2 3-5z"/>'),
  accelerant: svg('<path d="M12 2c1 4 6 6 6 12a6 6 0 01-12 0c0-3 2-4 3-7 1 1 2 2 3-5z"/><path d="M10 15l2 2 2-2"/>'),
  corrosive: svg('<path d="M12 3c3 4 6 7 6 11a6 6 0 01-12 0c0-4 3-7 6-11z"/><path d="M9 15h6"/>'),
  acidEtch: svg('<path d="M12 3c3 4 6 7 6 11a6 6 0 01-12 0c0-4 3-7 6-11z"/><path d="M9 13l6 4M15 13l-6 4"/>'),
  resonance: svg('<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="10" stroke-dasharray="3 3"/>'),
  sundering: svg('<path d="M12 2l3 7-3 3 3 3-3 7"/><path d="M5 8h4M15 16h4"/>'),
  flamethrower: svg('<path d="M5 19l4-4M3 21l2-2"/><path d="M9 15c2-4 6-5 9-9-1 5 1 7 4 9-4 1-5 4-6 7-2-2-4-2-7-7z"/>'),
  droneSwarm: svg('<path d="M4 10l3-4 3 4-3-1zM14 6l3-4 3 4-3-1zM9 18l3-4 3 4-3-1z"/><path d="M12 12v3M7 8l2 2M17 8l-2 2" stroke-dasharray="2 2"/>'),
  cryoSpike: svg('<path d="M12 2l3 9-3 11-3-11z"/><path d="M7 6l2 6-2 7-2-7zM17 6l2 6-2 7-2-7z"/><path d="M3 12h18" stroke-dasharray="2 2"/>'),
  causticSlag: svg('<path d="M9 3h6v4H9z"/><path d="M8 7h8l-1 8H9z"/><path d="M3 20c3-2 6 2 9 0s6 2 9 0"/><circle cx="12" cy="11" r="1.5"/>'),
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
  { id: 'boostTank', name: 'Boost Tank', cat: 'stat', max: 3, weight: 0.7, tier: 0, desc: (lv) => `+25% boost capacity (${pct(0.25 * lv)}).` },
  { id: 'ramScoop', name: 'Ram Scoop', cat: 'stat', max: 3, weight: 0.7, tier: 0, desc: (lv) => `Boost refills 30% faster (${pct(0.3 * lv)}).` },

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
  { id: 'injector', name: 'Fuel Injector', cat: 'stat', max: 3, weight: 0.6, tier: 1, desc: (lv) => `Boost drains slower: burns ${pct(0.25 * lv)} longer.` },
  { id: 'overthrust', name: 'Overthrust', cat: 'stat', max: 3, weight: 0.55, tier: 1, desc: (lv) => `Boost rushes the stage faster (x${(1.6 + 0.15 * lv).toFixed(2)}) for a bigger score bonus (x${(1 + 0.8 * (0.6 + 0.15 * lv)).toFixed(2)}).` },
  { id: 'leech', name: 'Leech Protocol', cat: 'defense', max: 3, weight: 0.6, tier: 1, desc: (lv) => `Repair 1 hull every ${[0, 90, 70, 50][lv]} kills.` },
  { id: 'rail', name: 'Rail Lance', cat: 'module', max: 5, weight: 0.9, tier: 1, desc: (lv) => (lv === 1 ? 'Fire a massive piercing beam forward.' : 'Wider beam, more damage, faster charge.') },
  { id: 'reflector', name: 'Reflector', cat: 'module', max: 5, weight: 0.85, tier: 1, desc: (lv) => (lv === 1 ? 'A pulsing shield bubble turns enemy bullets back on their owners.' : 'Wider bubble, more frequent, harder-hitting returns.') },
  { id: 'mines', name: 'Proximity Mines', cat: 'module', max: 5, weight: 0.85, tier: 1, desc: (lv) => (lv === 1 ? 'Drop mines in your wake that blow when enemies come close.' : 'More mines, bigger blasts.') },
  { id: 'flamethrower', name: 'Flamethrower', cat: 'module', max: 5, weight: 0.85, tier: 1, desc: (lv) => (lv === 1 ? 'A continuous flame cone extends from your ship, scorching enemies with stacking burn.' : lv === 3 ? 'Wider whip cone, hotter flames and faster burn.' : 'Longer reach, wider cone and scorching burn.') },
  { id: 'cryoSpike', name: 'Glacial Spike', cat: 'module', max: 5, weight: 0.85, tier: 1, desc: (lv) => (lv === 1 ? 'Launch heavy ice spikes that pierce enemies and shatter into chilling shrapnel.' : lv === 3 ? 'Twin spikes per salvo.' : 'Triple barrage of massive spikes that shatter into freezing blasts.') },

  // --- Cyclone tech ---
  { id: 'cull', name: 'Culling Edge', cat: 'stat', max: 3, weight: 0.6, tier: 2, desc: (lv) => `Enemies below ${4 + 4 * lv}% hull are destroyed outright. Not bosses.` },
  { id: 'echoFire', name: 'Echo Fire', cat: 'stat', max: 3, weight: 0.6, tier: 2, desc: (lv) => `${[0, 12, 22, 32][lv]}% of primary volleys fire a second time.` },
  { id: 'static', name: 'Static Discharge', cat: 'stat', max: 3, weight: 0.6, tier: 2, desc: (lv) => `Kills arc lightning into ${lv} nearby ${lv === 1 ? 'enemy' : 'enemies'}.` },
  { id: 'secondWind', name: 'Second Wind', cat: 'defense', max: 2, weight: 0.5, tier: 2, desc: (lv) => `A killing blow leaves you at 1 hull instead (${lv === 1 ? 'once' : 'twice'} per run).` },
  { id: 'gravity', name: 'Gravity Well', cat: 'module', max: 5, weight: 0.85, tier: 2, desc: (lv) => (lv === 1 ? 'Drop a singularity that drags enemies and bullets in and crushes them.' : 'Bigger, stronger, more frequent wells.') },
  { id: 'saw', name: 'Buzzsaw', cat: 'module', max: 5, weight: 0.85, tier: 2, desc: (lv) => (lv === 1 ? 'Hurl a saw that carves through enemies and boomerangs back.' : lv === 3 ? 'Throw two saws at once.' : 'Bigger, faster, harder-hitting saws.') },
  { id: 'stasis', name: 'Stasis Pulse', cat: 'module', max: 5, weight: 0.8, tier: 2, desc: (lv) => (lv === 1 ? 'A pulse freezes nearby bullets to a crawl and shocks enemies.' : 'Wider, more frequent pulses.') },
  { id: 'droneSwarm', name: 'Drone Swarm', cat: 'module', max: 5, weight: 0.85, tier: 2, desc: (lv) => (lv === 1 ? 'Autonomous interceptors launch from your hull, strafe enemies, and return to recharge.' : lv === 3 ? 'Interceptors fly faster and fire twin bursts.' : '+2 interceptors and faster recharges.') },
  { id: 'causticSlag', name: 'Caustic Slag', cat: 'module', max: 5, weight: 0.85, tier: 2, desc: (lv) => (lv === 1 ? 'Lob volatile acid canisters that detonate into lingering corrosive pools.' : lv === 3 ? 'Lob two canisters per salvo with wider pools.' : 'Three canisters creating massive pools that dissolve enemy armor.') },

  // --- Void tech ---
  { id: 'perpetual', name: 'Perpetual Engine', cat: 'stat', max: 3, weight: 0.55, tier: 3, desc: () => 'Your ultimate meter slowly charges on its own.' },
  { id: 'nullField', name: 'Null Field', cat: 'defense', max: 3, weight: 0.55, tier: 3, desc: () => 'Enemy bullets that come close slow down. Wider each level.' },
  { id: 'prism', name: 'Prism Beam', cat: 'module', max: 5, weight: 0.8, tier: 3, desc: (lv) => (lv === 1 ? 'A locked-on beam burns the nearest enemy.' : lv === 3 || lv === 5 ? 'The beam splits to one more target.' : 'Hotter beam, longer reach.') },
  { id: 'starfall', name: 'Starfall', cat: 'module', max: 5, weight: 0.8, tier: 3, desc: (lv) => (lv === 1 ? 'Call down falling stars that blast enemies from above.' : 'More stars, bigger impacts.') },

  // --- Shared-system cards (status.js). `req`: only offered once that card is owned. ---
  { id: 'projSize', name: 'Wide Rounds', cat: 'stat', max: 4, weight: 0.7, tier: 0, desc: () => '+15% projectile size, for every weapon.' },
  { id: 'projSpeed', name: 'Accelerator Coils', cat: 'stat', max: 4, weight: 0.7, tier: 0, desc: () => '+12% projectile speed, for every weapon.' },
  { id: 'gameSpeed', name: 'Hyperflow', cat: 'stat', max: 3, weight: 0.5, tier: 0, desc: () => 'The whole battle runs 8% faster for good. +20% score, +10% credits.' },
  { id: 'dodge', name: 'Lucky Dodge', cat: 'defense', max: 4, weight: 0.6, tier: 0, desc: () => '+6% chance to slip past a shot that would have hit you.' },
  { id: 'armorPierce', name: 'Armor Piercing', cat: 'stat', max: 4, weight: 0.7, tier: 1, desc: () => 'Your shots ignore 8% of enemy armor.' },
  { id: 'burstFire', name: 'Burst Fire', cat: 'stat', max: 4, weight: 0.7, tier: 1, desc: (lv) => (lv === 3 ? '+8% burst chance, and bursts fire one more extra volley.' : '+8% chance for a volley to burst. Scales with fire rate.') },
  { id: 'cryo', name: 'Cryo Rounds', cat: 'stat', max: 3, weight: 0.6, tier: 1, desc: () => '+12% chance per hit to chill. Chill stacks slow enemies; a full stack freezes them.' },
  { id: 'deepFreeze', name: 'Deep Freeze', cat: 'stat', max: 3, weight: 0.5, tier: 1, req: 'cryo', desc: () => '+25% slow from every chill stack.' },
  { id: 'incendiary', name: 'Incendiary Rounds', cat: 'stat', max: 3, weight: 0.6, tier: 1, desc: () => '+12% chance per hit to ignite. Burn stacks deal damage over time and ignore armor.' },
  { id: 'accelerant', name: 'Accelerant', cat: 'stat', max: 3, weight: 0.5, tier: 1, req: 'incendiary', desc: () => '+25% burn damage per stack.' },
  { id: 'corrosive', name: 'Corrosive Rounds', cat: 'stat', max: 3, weight: 0.6, tier: 1, desc: () => '+12% chance per hit to corrode. Each stack strips enemy armor (and lowers it below zero).' },
  { id: 'acidEtch', name: 'Acid Etch', cat: 'stat', max: 3, weight: 0.5, tier: 1, req: 'corrosive', desc: () => '+25% armor stripped per corrosion stack.' },
  { id: 'resonance', name: 'Resonance Rounds', cat: 'stat', max: 3, weight: 0.6, tier: 2, desc: (lv) => `Every ${[0, 6, 5, 4][lv]}th hit on an enemy detonates for ${3 + lv}x damage, splashing neighbours.` },
  { id: 'sundering', name: 'Sundering Rounds', cat: 'stat', max: 3, weight: 0.6, tier: 2, desc: () => "Hits deal +0.3% of the target's max hull. Bosses take a fraction." },

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
  st.find = 0; // rarity find (gear / ship traits, rarity.js luckFor)
  // Shared combat systems (status.js): neutral until a card, gear modifier or passive raises them.
  st.armorPierce = 0.08 * lv('armorPierce'); // armor fraction ignored on enemies
  st.freezeChance = 0.12 * lv('cryo'); // chance per hit to add one stack
  st.burnChance = 0.12 * lv('incendiary');
  st.corrodeChance = 0.12 * lv('corrosive');
  st.freezePot = 1 + 0.25 * lv('deepFreeze'); // status potency multipliers (slow / burn damage / armor shaved)
  st.burnPot = 1 + 0.25 * lv('accelerant');
  st.corrodePot = 1 + 0.25 * lv('acidEtch');
  st.pctHp = 0.003 * lv('sundering'); // % of the target's max hull dealt as extra damage per hit (bosses take 15% of it)
  st.detHits = [0, 6, 5, 4][lv('resonance')]; // every (detHits+1)th hit on an enemy detonates; 0 = off
  st.detMul = lv('resonance') ? 3 + lv('resonance') : 4; // detonation damage as a multiple of the triggering hit
  st.detR = 70; // detonation radius (neighbours take half)
  st.burstChance = 0.08 * lv('burstFire'); // chance a volley is followed by extra volleys (scales with fire rate)
  st.burstExtra = lv('burstFire') >= 3 ? 2 : 1; // how many extra volleys a burst adds
  st.projSize = 1 + 0.15 * lv('projSize'); // player projectile size / speed (bullets.js playerBullet)
  st.projSpeed = 1 + 0.12 * lv('projSpeed');
  st.gameSpeed = 1 + 0.08 * lv('gameSpeed'); // battle clock (main.js); paid for with score and credits
  st.scoreMul = 1 + 0.2 * lv('gameSpeed');
  st.dodge = 0.06 * lv('dodge'); // chance to negate a hit (player.js hurtPlayer)
  st.shatter = 0; // bonus damage against frozen enemies (Cryostasis legendary)
  st.cinder = 0; // death burns spread to nearby enemies (Pyre Mantle legendary)
  st.dodgePulse = false; // dodges emit an erase pulse and extend iframes (Phase Shroud legendary)
  st.modRate = 1; // module fire rate (gear modifiers; modules.js rateMul)
  st.hitIfr = 1; // invulnerability after a hit (gear modifiers, passive tree)
  st.rerolls = 0; // extra draft rerolls at the start of a run (gear, passive tree, Flux Core; main.js newWorld)
  st.aegisOd = 0; // ultimate meter per shield break (Aegis Prime)
  // Boost (boost.js): capacity, refill rate, burn time (drain ÷ eff) and stage-flow speed.
  st.boostCap = 1 + 0.25 * lv('boostTank');
  st.boostRegen = 1 + 0.3 * lv('ramScoop');
  st.boostEff = 1 + 0.25 * lv('injector');
  st.boostFlow = 1.6 + 0.15 * lv('overthrust');
  resetPilotStats(st);
  if (p.ship.trait) p.ship.trait.apply(st, p);
  for (const [stat, v] of p.runMods || []) STATS[stat].apply(st, v); // bonus modifiers from rare cards and level-up tunes
  applyMastery(st, p);
  applyParts(st, p);
  applyPassives(st, p);
  applyTree(st, p);
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
  const u = byId.get(id);
  if (p.st.architect && u.cat === 'module' && p.up[id] === 1 && u.max > 1) p.up[id] = 2; // Architect: new modules start at 2
  updateSpec(p);
  recomputeStats(p);
  if (id === 'hull') p.hp = Math.min(p.maxHp, p.hp + 1);
  if (id === 'aegis' && p.up.aegis === 1) p.shield = 1;
  if (id === 'dashes') p.charges = Math.min(p.maxCharges, p.charges + 1);
}

// Rolls up to n distinct upgrade ids from the current pool (weighted). `kind` is 'level' or 'sector'.
// `evo` lets eligible Evolutions into the pool (drafts only; the Black Market and Contraband leave it off).
// `only(u)` optionally narrows the pool (campaign reward drafts by category).
export function rollUpgradeIds(p, kind, n = 3, rng = Math.random, evo = false, only = null) {
  const mods = moduleCount(p);
  const k = known();
  const ranks = pathRanks(p);
  const spec = p.spec || [];
  const pool = UPGRADES.filter((u) => {
    if (u.cat === 'weapon') return false; // the Main Cannon grows with the run (main.js weaponStep), never from a card
    if (only && !only(u)) return false;
    const l = p.up[u.id] || 0;
    if (!l && !available(p, u, k)) return false;
    if (u.req && !p.up[u.req]) return false;
    if (u.cat === 'evolution') return evo && evolutionReady(p, u);
    if (l >= u.max) return false;
    if (u.cat === 'module' && l === 0 && mods >= p.st.maxModules) return false;
    if (pathRoom(p, u.id, ranks) <= 0) return false; // specialization: off-path tech is capped once two paths are locked in
    return true;
  });
  const choices = [];
  const weight = (u) => {
    const l = p.up[u.id] || 0;
    let wgt = u.weight;
    if (u.cat === 'module') {
      if (l > 0) wgt *= 1.25; // lean toward building up what you own
      else if (kind === 'sector') wgt *= 1.6;
      if (mods === 0 && p.level >= 2) wgt *= 1.6; // first module comes early
    }
    if (u.id === 'hull' && p.hp < p.maxHp) wgt *= 1.3;
    if (!k.has(u.id)) wgt *= 1.4; // undiscovered tech surfaces a little sooner
    wgt *= 1 + 0.15 * Math.min(4, synergy(p, u.id)); // equipped gear's build paths pull matching tech forward
    if (spec.includes(pathOf(u.id))) wgt *= 1.25; // your specializations come up a little more often
    else if (spec.length >= SPEC_MAX) wgt *= 0.85; // splash picks stay common
    if ((p.recent || []).includes(u.id)) wgt *= 0.3; // shown in the last two drafts: let something else through
    if (kind === 'sector' && !l) wgt *= 1.3; // rewards are where new tech arrives
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

// --- Build paths ---------------------------------------------------------------------------
// Each option belongs to one build path (parts.js TAGS). p.tags = summed path weights of the equipped gear (player.js).
export const UP_TAGS = {
  main: 'firepower', power: 'firepower', rate: 'firepower', pierce: 'firepower', splinter: 'firepower', echoFire: 'firepower', redline: 'firepower',
  crit: 'crit', overload: 'crit', cull: 'crit', bounty: 'crit',
  missiles: 'modules', orbitals: 'modules', drones: 'modules', arc: 'modules', nova: 'modules', rail: 'modules', shrapnel: 'modules', flak: 'modules',
  gravity: 'modules', reflector: 'modules', mines: 'modules', saw: 'modules', stasis: 'modules', prism: 'modules', starfall: 'modules', static: 'modules',
  flamethrower: 'modules', droneSwarm: 'modules', cryoSpike: 'modules', causticSlag: 'modules',
  thrusters: 'mobility', dashes: 'mobility', blink: 'mobility', dashNova: 'mobility',
  boostTank: 'mobility', ramScoop: 'mobility', injector: 'mobility', overthrust: 'mobility',
  capacitor: 'overdrive', grazer: 'overdrive', perpetual: 'overdrive', nullField: 'overdrive', chainlink: 'overdrive',
  hull: 'tank', aegis: 'tank', leech: 'tank', secondWind: 'tank',
  magnet: 'greed', salvage: 'greed', prospector: 'greed',
  projSize: 'firepower', projSpeed: 'firepower', armorPierce: 'firepower', burstFire: 'firepower', resonance: 'firepower',
  sundering: 'crit', gameSpeed: 'mobility', dodge: 'tank',
  cryo: 'modules', deepFreeze: 'modules', incendiary: 'modules', accelerant: 'modules', corrosive: 'modules', acidEtch: 'modules',
};
export const synergy = (p, id) => (p.tags && UP_TAGS[id] ? p.tags[UP_TAGS[id]] || 0 : 0);
export const SYNERGY_MIN = 2; // path weight at which a card shows its SYNERGY mark

// --- Card rarity ------------------------------------------------------------------------------
// Every regular card in a draft rolls a rarity (rarity.js, luck from the run). Rarer cards install more levels and
// add bonus modifiers for the rest of the run (p.runMods, half-strength gear modifiers). Bonus / evolution cards stay plain.
export const CARD_RARITY = [
  { levels: 1, mods: 0 },
  { levels: 1, mods: 1 },
  { levels: 2, mods: 1 },
  { levels: 2, mods: 2 },
  { levels: 3, mods: 2 },
];

export function rollCard(p, id, luck = 0, rng = Math.random, floor = 0) {
  const u = byId.get(id);
  if (!u || u.cat === 'evolution') return null;
  const r = rollRarity(luck, rng, floor);
  const il = itemLevel({ sys: Math.max(0, Math.floor(luck)) });
  const room = Math.min(u.max - (p.up[id] || 0), pathRoom(p, id)); // splash room counts like the level cap
  const levels = Math.max(1, Math.min(CARD_RARITY[r].levels, room));
  const extra = CARD_RARITY[r].levels - levels; // levels past the cap turn into one more modifier each
  return { r, levels, mods: rollMods(r, il, CARD_RARITY[r].mods + extra, rng, 0.5, [], UP_TAGS[id] || null) };
}

// Installs a picked card: its levels, then its modifiers. A tune card is just its one modifier.
export function applyCard(p, id, roll, G) {
  if (isTune(id)) {
    if (roll && roll.tune) (p.runMods ||= []).push(roll.tune);
    recomputeStats(p);
    return;
  }
  applyUpgrade(p, id, G);
  if (!roll) return;
  for (let i = 1; i < roll.levels; i++) if ((p.up[id] || 0) < byId.get(id).max && pathRoom(p, id) > 0) applyUpgrade(p, id, G);
  if (roll.mods.length) {
    (p.runMods ||= []).push(...roll.mods);
    recomputeStats(p);
  }
}

export const modText = ([id, v]) => STATS[id].text(v);
export { RARITY };

// Build a draft of 3 choices. `kind` is 'level' (micro: owned upgrades +1 and tunes) or 'sector' (macro: anything).
export function rollDraft(p, kind, only = null) {
  if (kind === 'level') return rollLevelDraft(p, only);
  const choices = rollUpgradeIds(p, kind, 3, Math.random, true, only);
  remember(p, choices);
  if (choices.length < 3 && p.hp < p.maxHp) choices.push('repair');
  while (choices.length < 3) choices.push('credits');
  return choices;
}

export function cardInfo(p, id, roll = null) {
  if (id === 'credits') {
    return { id, name: 'Data Cache', cat: 'bonus', icon: ICONS.credits, desc: 'Bank bonus score and +25% Overdrive.', lv: 0, max: 0 };
  }
  if (id === 'repair') {
    return { id, name: 'Field Repair', cat: 'bonus', icon: ICONS.repair, desc: 'Repair 2 hull.', lv: 0, max: 0 };
  }
  if (isTune(id)) {
    const [stat, v] = roll.tune;
    const path = affixPath(stat);
    return {
      id, name: TUNE_NAMES[path] || 'Tuning', cat: 'tune', color: TAGS[path].color, icon: ICONS[TUNE_ICONS[stat]] || ICONS.rate,
      desc: `${STATS[stat].text(v)} for the rest of the run.`, lv: 0, max: 0, tune: true, path, note: pathNote(p, null, 0, path),
    };
  }
  const u = byId.get(id);
  const lv = p.up[id] || 0;
  // fresh: never seen in any run before this draft (discover() has not run for it yet).
  const syn = synergy(p, id) >= SYNERGY_MIN ? UP_TAGS[id] : null;
  const r = roll ? roll.r : null;
  const levels = roll ? roll.levels : 1;
  return {
    id, name: u.name, cat: u.cat, icon: ICONS[id], desc: u.desc(lv + 1), lv, max: u.max, evo: u.cat === 'evolution', fresh: !isDiscovered(id),
    r, levels, mods: roll ? roll.mods.map(modText) : [], syn, path: pathOf(id), note: u.cat === 'evolution' ? null : pathNote(p, id, levels),
  };
}

// --- Specialization ---------------------------------------------------------------------------
// Every upgrade level counts toward its build path's rank. The first two paths to reach SPEC_AT become your
// specializations (p.spec, in the order they locked in). From then on the other five paths share SPLASH_CAP levels
// between them (levels taken before locking in count), and no off-path rank can reach SPEC_AT. Specializations earn a
// mastery bonus at each MASTERY_AT rank, so going deep pays more than spreading out.
export const SPEC_AT = 5;
export const SPEC_MAX = 2;
export const SPLASH_CAP = 10;
export const MASTERY_AT = [5, 10, 15];
export const MASTERY = {
  firepower: ['dmg', 0.06],
  crit: ['critMul', 0.3],
  modules: ['mod', 0.08],
  mobility: ['speed', 0.05],
  overdrive: ['od', 0.1],
  tank: ['hull', 1],
  greed: ['find', 0.1],
};
const ROMAN = ['', 'I', 'II', 'III'];

// Evolutions count toward the path of the module they evolve.
export const pathOf = (id) => {
  if (UP_TAGS[id]) return UP_TAGS[id];
  const u = byId.get(id);
  return u && u.cat === 'evolution' ? UP_TAGS[u.mod] : null;
};

export function pathRanks(p) {
  const out = {};
  for (const t of Object.keys(TAGS)) out[t] = 0;
  for (const [id, l] of Object.entries(p.up || {})) {
    if (id === 'main') continue; // run milestones level it for everyone, so it never pushes a path
    const t = pathOf(id);
    if (t) out[t] += l;
  }
  return out;
}

export const masteryTier = (rank) => MASTERY_AT.filter((r) => rank >= r).length;

export function splashUsed(p, ranks = pathRanks(p)) {
  const spec = p.spec || [];
  let n = 0;
  for (const [t, r] of Object.entries(ranks)) if (!spec.includes(t)) n += r;
  return n;
}

// How many more levels the specialization rules allow for an option (Infinity while a spec slot is open).
export function pathRoom(p, id, ranks = pathRanks(p)) {
  const t = pathOf(id);
  const spec = p.spec || [];
  if (!t || spec.includes(t) || spec.length < SPEC_MAX) return Infinity;
  return Math.max(0, Math.min(SPEC_AT - 1 - ranks[t], SPLASH_CAP - splashUsed(p, ranks)));
}

// Locks in any path that just reached SPEC_AT while a slot is open (highest rank first).
export function updateSpec(p) {
  p.spec ||= [];
  if (p.spec.length >= SPEC_MAX) return;
  const ranks = pathRanks(p);
  const ready = Object.keys(ranks).filter((t) => ranks[t] >= SPEC_AT && !p.spec.includes(t)).sort((a, b) => ranks[b] - ranks[a]);
  for (const t of ready) if (p.spec.length < SPEC_MAX) p.spec.push(t);
}

function applyMastery(st, p) {
  if (!p.spec || !p.spec.length) return;
  const ranks = pathRanks(p);
  for (const t of p.spec) {
    const [stat, v] = MASTERY[t];
    for (let i = masteryTier(ranks[t]); i > 0; i--) STATS[stat].apply(st, v);
  }
}

// The path line on a card: what picking it does to your specialization. kind: commit | mastery | spec | splash | syn | plain.
export function pathNote(p, id, levels = 1, path = pathOf(id)) {
  if (!path) return null;
  const T = TAGS[path].name;
  const spec = p.spec || [];
  const ranks = pathRanks(p);
  if (id === null) return { path, kind: spec.includes(path) ? 'spec' : 'plain', text: T }; // tunes never move ranks
  const after = ranks[path] + levels;
  if (!spec.includes(path) && spec.length < SPEC_MAX && after >= SPEC_AT) return { path, kind: 'commit', text: `SPECIALIZE ${T}` };
  if (spec.includes(path)) {
    const tier = masteryTier(after);
    if (tier > masteryTier(ranks[path])) return { path, kind: 'mastery', text: `${T} MASTERY ${ROMAN[tier]}` };
    return { path, kind: 'spec', text: `${T} ${ranks[path]}` };
  }
  if (spec.length >= SPEC_MAX) return { path, kind: 'splash', text: `SPLASH ${Math.min(SPLASH_CAP, splashUsed(p, ranks) + levels)}/${SPLASH_CAP}` };
  if (synergy(p, id) >= SYNERGY_MIN) return { path, kind: 'syn', text: `${T} SYNERGY` };
  return { path, kind: 'plain', text: `${T} ${ranks[path]}` };
}

// --- Level-up drafts (micro) -------------------------------------------------------------------
// Levels strengthen what you already fly: +1 to a stat or defense you own (never a module, never rarer, never new tech),
// or a tune: one small run modifier from your paths. New tech, rarity and evolutions come from rewards (sector clears,
// bosses, vaults). Tunes never run out, so long runs keep a pick at every level without maxing every stat.
export const TUNE_SCALE = 0.55; // x a gear modifier's value (rarity Common)
const TUNE_NAMES = {
  firepower: 'Gun Tuning', crit: 'Optics Tuning', modules: 'Module Tuning', mobility: 'Engine Tuning',
  overdrive: 'Core Tuning', tank: 'Hull Tuning', greed: 'Scanner Tuning',
};
const TUNE_ICONS = {
  dmg: 'power', rate: 'rate', bounty: 'bounty', crit: 'crit', critMul: 'crit', mod: 'drones', modRate: 'arc', speed: 'thrusters',
  dashCd: 'dashes', dashLen: 'blink', od: 'capacitor', odDur: 'capacitor', grazeR: 'grazer', grazeOd: 'grazer', shield: 'aegis',
  iframes: 'hull', magnet: 'magnet', xp: 'salvage', credits: 'prospector', find: 'prospector', boostCap: 'boostTank',
  boostRegen: 'ramScoop', boostEff: 'injector',
  projSize: 'projSize', projSpeed: 'projSpeed', armorPierce: 'armorPierce', burst: 'burstFire', burstN: 'burstFire',
  freeze: 'cryo', freezePot: 'deepFreeze', burn: 'incendiary', burnPot: 'accelerant', corrode: 'corrosive', corrodePot: 'acidEtch',
  sunder: 'sundering', dodge: 'dodge',
};
const affixPath = (stat) => affixTag(stat);
export const isTune = (id) => typeof id === 'string' && id.startsWith('tune:');

// The path a tune comes from: one of your specializations (by rank), 25% its kin, 20% any path; before you lock in, any
// path you have levels in (or the ship's own path), weighted by rank.
function tunePath(p, rng) {
  const ranks = pathRanks(p);
  const spec = p.spec || [];
  if (spec.length) {
    const t = weightedPick(spec, (x) => 1 + ranks[x], rng);
    const r = rng();
    if (r < 0.25) return PATH_KIN[t];
    if (r < 0.45) return weightedPick(Object.keys(ranks), () => 1, rng); // any path, now and then
    return t;
  }
  const opts = Object.keys(ranks).filter((t) => ranks[t] > 0 || (p.ship && p.ship.path === t));
  if (!opts.length) return weightedPick(Object.keys(ranks), () => 1, rng);
  return weightedPick(opts, (x) => 1 + ranks[x], rng);
}

export function rollTune(p, il = 1, avoid = [], rng = Math.random) {
  const path = tunePath(p, rng);
  const [mod] = rollMods(0, il, 1, rng, TUNE_SCALE, [...avoid, ...(p.recentTunes || [])], path); // no repeat of the last few tunes
  if (!mod) return null;
  p.recentTunes = [mod[0], ...(p.recentTunes || [])].slice(0, 4);
  return { tune: mod };
}

// Recently shown options (the last two drafts) weigh less, so the same cards stop popping up back to back.
function remember(p, ids) {
  p.recentDrafts = [ids.filter((id) => byId.has(id)), ...(p.recentDrafts || [])].slice(0, 2);
  p.recent = p.recentDrafts.flat();
}

let tuneSeq = 0;
function rollLevelDraft(p, keep = null) {
  // Weapons (modules) level only from rewards; level-ups raise stats and defenses (owned ones, or a new one).
  const owned = (u) => (u.cat === 'stat' || u.cat === 'defense') && (!keep || keep(u));
  const ids = rollUpgradeIds(p, 'level', 2, Math.random, false, owned);
  remember(p, ids);
  while (ids.length < 3) ids.push(`tune:${tuneSeq++}`); // unique ids, so a locked tune survives a reroll
  if (p.hp < p.maxHp && p.hp <= p.maxHp / 2) ids[ids.length - 1] = 'repair'; // badly hurt: a patch-up is on offer
  return ids;
}
