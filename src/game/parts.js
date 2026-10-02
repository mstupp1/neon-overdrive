// Equipment: 3 slots per ship. Gear is loot: every piece is an item instance in profile.gear
// ({uid, base, slot, r, il, mods: [[affixId, value]]}) rolled from a base type (or a legendary), a rarity (rarity.js),
// an item level and random modifiers. Rarer pieces scale their base effect harder and roll more modifiers;
// legendaries add a unique passive. Items are rolled in the Fabricator (hangar) or dropped by elites / bosses (loot.js).
// itemEffect(item) turns an item into {apply(st, p), start} for recomputeStats (run at the end, after upgrades).

import { applyCore } from './core.js';
import { RARITY, LEGENDARY } from './rarity.js';

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const SLOTS = ['core', 'plating', 'thrusters'];
export const SLOT_INFO = {
  core: { name: 'CORE', color: '#ff3df2' },
  plating: { name: 'PLATING', color: '#ffd23f' },
  thrusters: { name: 'THRUSTERS', color: '#3ff6ff' },
};
export const SLOT_CAP = 8; // inventory tiles per slot

// Build paths. Every base, modifier and legendary carries one; equipped tags steer level-up drafts (upgrades.js).
export const TAGS = {
  firepower: { name: 'FIREPOWER', color: '#ff5470' },
  crit: { name: 'CRIT', color: '#ffe14d' },
  modules: { name: 'MODULES', color: '#ff3df2' },
  mobility: { name: 'MOBILITY', color: '#3ff6ff' },
  overdrive: { name: 'OVERDRIVE', color: '#b48bff' },
  tank: { name: 'TANK', color: '#7dff6b' },
  greed: { name: 'GREED', color: '#ffd24a' },
};

// Stat effects. v is the benefit: positive = good, negative = a drawback (dash `dashCd: -0.15` = 15% slower recharge).
// flat stats are whole numbers and never scale with rarity.
const P = (v) => `${Math.round(Math.abs(v) * 100)}%`;
const sg = (v) => (v < 0 ? '-' : '+');
export const STATS = {
  dmg: { apply: (st, v) => (st.dmg *= 1 + v), text: (v) => `${sg(v)}${P(v)} damage` },
  rate: { apply: (st, v) => (st.rate *= 1 + v), text: (v) => `${sg(v)}${P(v)} fire rate` },
  bounty: { apply: (st, v) => (st.bounty += v), text: (v) => `+${P(v)} damage to elites and bosses` },
  pierce: { flat: true, apply: (st, v) => (st.pierce += v), text: (v) => `Primary shots pierce +${v}` },
  crit: { apply: (st, v) => (st.crit += v), text: (v) => `${sg(v)}${P(v)} crit chance` },
  critMul: { apply: (st, v) => (st.critMul += v), text: (v) => `+${P(v)} crit damage` },
  mod: { apply: (st, v) => (st.modDmg *= 1 + v), text: (v) => `${sg(v)}${P(v)} module damage` },
  slots: { flat: true, apply: (st, v) => (st.maxModules += v), text: (v) => `${sg(v)}${Math.abs(v)} module slot` },
  speed: { apply: (st, v) => (st.speed *= 1 + v), text: (v) => `${sg(v)}${P(v)} move speed` },
  dashCd: { apply: (st, v) => (st.dashRecharge *= 1 - v), text: (v) => `Dashes recharge ${P(v)} ${v < 0 ? 'slower' : 'faster'}` },
  dashLen: { apply: (st, v) => (st.dashDur *= 1 + v), text: (v) => `${sg(v)}${P(v)} dash length and i-frames` },
  dashes: { flat: true, apply: (st, v) => (st.maxCharges += v), text: (v) => `${sg(v)}${Math.abs(v)} dash charge` },
  od: { apply: (st, v) => (st.odGain *= 1 + v), text: (v) => `${sg(v)}${P(v)} ultimate charge` },
  odDur: { apply: (st, v) => (st.odDur += v), text: (v) => `+${v.toFixed(1)}s ultimate duration` },
  grazeR: { apply: (st, v) => (st.grazeR *= 1 + v), text: (v) => `+${P(v)} graze radius` },
  grazeOd: { apply: (st, v) => (st.grazeOd *= 1 + v), text: (v) => `+${P(v)} ultimate charge from grazes` },
  hull: { flat: true, apply: (st, v) => (st.maxHp += v), text: (v) => `${sg(v)}${Math.abs(v)} max hull` },
  shield: { apply: (st, v) => (st.shieldInterval *= 1 - v), text: (v) => `Aegis Shield recharges ${P(v)} faster` },
  magnet: { apply: (st, v) => (st.magnet *= 1 + v), text: (v) => `${sg(v)}${P(v)} pickup range` },
  xp: { apply: (st, v) => (st.xpMul *= 1 + v), text: (v) => `${sg(v)}${P(v)} XP` },
  credits: { apply: (st, v) => (st.creditMul *= 1 + v), text: (v) => `${sg(v)}${P(v)} credits` },
  find: { apply: (st, v) => (st.find += v), text: (v) => `+${P(v)} rarity find` },
};

// Random modifiers: [stat, tag, lo, hi, minRarity, weight]. Values grow with item level; rarer items roll higher.
export const AFFIXES = [
  ['dmg', 'firepower', 0.03, 0.08], ['rate', 'firepower', 0.03, 0.07], ['bounty', 'firepower', 0.05, 0.12],
  ['pierce', 'firepower', 1, 1, 3, 0.4],
  ['crit', 'crit', 0.02, 0.05], ['critMul', 'crit', 0.15, 0.4],
  ['mod', 'modules', 0.05, 0.12], ['slots', 'modules', 1, 1, 4, 0.25],
  ['speed', 'mobility', 0.03, 0.07], ['dashCd', 'mobility', 0.05, 0.12], ['dashLen', 'mobility', 0.08, 0.18],
  ['od', 'overdrive', 0.06, 0.14], ['grazeR', 'overdrive', 0.1, 0.22], ['odDur', 'overdrive', 0.4, 1],
  ['hull', 'tank', 1, 1, 2, 0.5], ['shield', 'tank', 0.08, 0.18],
  ['magnet', 'greed', 0.15, 0.35], ['xp', 'greed', 0.04, 0.1], ['credits', 'greed', 0.06, 0.15], ['find', 'greed', 0.05, 0.15],
].map(([stat, tag, lo, hi, minR = 0, weight = 1]) => ({ id: stat, stat, tag, lo, hi, minR, weight }));
const affixById = new Map(AFFIXES.map((a) => [a.id, a]));
export const affixTag = (id) => (affixById.get(id) || {}).tag;

// Per-rarity tuning: base-effect multiplier, modifier count (+1 with `extra` chance), modifier roll floor, sell value.
export const RARITY_GEAR = [
  { k: 1, mods: 0, extra: 0.25, q: 0, sell: 15 },
  { k: 1.15, mods: 1, extra: 0.25, q: 0.15, sell: 35 },
  { k: 1.3, mods: 2, extra: 0.3, q: 0.3, sell: 80 },
  { k: 1.5, mods: 3, extra: 0.35, q: 0.45, sell: 180 },
  { k: 1.6, mods: 3, extra: 0.4, q: 0.6, sell: 400 },
];

// Base types. fx: [[stat, v]]: positive values scale with rarity and item level, drawbacks stay fixed.
export const BASES = [
  // --- Core ---
  { id: 'glass', slot: 'core', name: 'Glass Reactor', tag: 'firepower', fx: [['dmg', 0.3], ['hull', -1]], icon: svg('<path d="M12 2l7 5v10l-7 5-7-5V7z"/><path d="M12 7l-3 5 3 5 3-5z"/>') },
  { id: 'cycler', slot: 'core', name: 'Rapid Cycler', tag: 'firepower', fx: [['rate', 0.2], ['dmg', -0.1]], icon: svg('<path d="M20 12a8 8 0 11-3-6.2M20 4v5h-5"/><path d="M12 8v4l3 2"/>') },
  { id: 'breach', slot: 'core', name: 'Breach Core', tag: 'firepower', fx: [['pierce', 1], ['bounty', 0.1], ['rate', -0.08]], icon: svg('<path d="M3 12h14M13 6l6 6-6 6"/><path d="M7 8v8"/>') },
  { id: 'optics', slot: 'core', name: 'Hunter Optics', tag: 'crit', fx: [['crit', 0.1], ['critMul', 0.5], ['rate', -0.08]], icon: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="9"/>') },
  { id: 'swarmcpu', slot: 'core', name: 'Swarm Processor', tag: 'modules', fx: [['mod', 0.2], ['rate', -0.1]], icon: svg('<rect x="6" y="6" width="12" height="12"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>') },
  { id: 'fluxcap', slot: 'core', name: 'Flux Capacitor', tag: 'overdrive', fx: [['od', 0.25], ['dmg', -0.05]], icon: svg('<path d="M12 2l8 5v10l-8 5-8-5V7z"/><path d="M13 7l-3 5h4l-3 5"/>') },
  { id: 'siphon', slot: 'core', name: 'Data Siphon', tag: 'greed', fx: [['xp', 0.25], ['dmg', -0.05]], icon: svg('<path d="M5 4h14l-5 7v8l-4 2v-10z"/>') },
  // --- Plating ---
  { id: 'reactive', slot: 'plating', name: 'Reactive Armor', tag: 'tank', fx: [['hull', 1], ['speed', -0.08]], icon: svg('<path d="M4 6l8-3 8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9z"/><path d="M9 12h6M12 9v6"/>') },
  { id: 'aegisPlate', slot: 'plating', name: 'Aegis Emitter', tag: 'tank', fx: [['dashCd', -0.15]], start: { aegis: 1 }, note: 'Start every run with Aegis Shield 1', icon: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8 11c2-2 6-2 8 0"/>') },
  { id: 'ablative', slot: 'plating', name: 'Ablative Weave', tag: 'tank', fx: [['shield', 0.25], ['dmg', -0.05]], icon: svg('<path d="M4 7h16M4 12h16M4 17h16"/><path d="M8 4v16M16 4v16" stroke-dasharray="2 2"/>') },
  { id: 'huntplate', slot: 'plating', name: "Hunter's Plating", tag: 'crit', fx: [['bounty', 0.15], ['crit', 0.04], ['magnet', -0.15]], icon: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><circle cx="12" cy="11" r="3"/>') },
  { id: 'baymount', slot: 'plating', name: 'Expanded Bay', tag: 'modules', fx: [['slots', 1], ['mod', 0.05], ['hull', -1]], icon: svg('<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><path d="M16.5 14v6M13.5 17h6"/>') },
  { id: 'graze', slot: 'plating', name: 'Graze Mesh', tag: 'overdrive', fx: [['grazeR', 0.4], ['grazeOd', 0.3], ['dmg', -0.06]], icon: svg('<path d="M3 12h18M3 6h18M3 18h18M7 3v18M12 3v18M17 3v18"/>') },
  { id: 'salvage', slot: 'plating', name: 'Salvage Hull', tag: 'greed', fx: [['credits', 0.3], ['dmg', -0.1]], icon: svg('<circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.8-1-2-1.5-3-1.5-1.7 0-3 1-3 2.5s1.3 2 3 2.5 3 1 3 2.5-1.3 2.5-3 2.5c-1 0-2.2-.5-3-1.5M12 5v2M12 17v2"/>') },
  // --- Thrusters ---
  { id: 'afterburner', slot: 'thrusters', name: 'Afterburner Kit', tag: 'mobility', fx: [['dashes', 1], ['dashCd', -0.2]], icon: svg('<path d="M4 18l6-6-6-6M12 18l6-6-6-6"/><path d="M20 6v12"/>') },
  { id: 'fins', slot: 'thrusters', name: 'Vector Fins', tag: 'mobility', fx: [['speed', 0.12], ['dashCd', -0.15]], icon: svg('<path d="M12 3v18M12 8L5 20M12 8l7 12"/>') },
  { id: 'phase', slot: 'thrusters', name: 'Phase Drive', tag: 'mobility', fx: [['dashLen', 0.4], ['speed', -0.05]], icon: svg('<path d="M3 12h6M11 12h2M15 12h6"/><circle cx="12" cy="12" r="6" stroke-dasharray="3 3"/>') },
  { id: 'iontrail', slot: 'thrusters', name: 'Ion Trail', tag: 'overdrive', fx: [['grazeOd', 0.3], ['grazeR', 0.2], ['speed', -0.05]], icon: svg('<path d="M4 20c4-2 6-6 8-16 2 10 4 14 8 16"/><path d="M8 20h8" stroke-dasharray="2 2"/>') },
  { id: 'surge', slot: 'thrusters', name: 'Surge Thrusters', tag: 'overdrive', fx: [['odDur', 1], ['dashCd', -0.1]], icon: svg('<path d="M6 13l6-6 6 6M6 19l6-6 6 6"/><path d="M12 2v3"/>') },
  { id: 'tether', slot: 'thrusters', name: 'Drone Tether', tag: 'modules', fx: [['mod', 0.12], ['speed', -0.06]], icon: svg('<circle cx="12" cy="17" r="3"/><path d="M12 14V8"/><path d="M6 8l3-5 3 5-3-1.5zM12 8l3-5 3 5-3-1.5z"/>') },
  { id: 'coil', slot: 'thrusters', name: 'Magnet Coil', tag: 'greed', fx: [['magnet', 0.6], ['speed', -0.05]], icon: svg('<path d="M6 4v8a6 6 0 0012 0V4M6 8h4M14 8h4"/>') },
];

// Legendaries: fixed base effect + a unique passive (`unique` text, `apply`, optional `start` levels). They roll
// modifiers like any epic, and count double for their build path.
export const LEGENDARIES = [
  // --- Core ---
  {
    id: 'hellheart', slot: 'core', name: 'Hellheart Reactor', tag: 'crit', fx: [['crit', 0.1]],
    unique: 'Every crit detonates (Overload Rounds +2) and crits deal +0.5x.',
    apply(st) { st.overload += 2; st.critMul += 0.5; },
    icon: svg('<path d="M12 2l7 5v10l-7 5-7-5V7z"/><path d="M12 7c2 2 3 4 0 8-3-4-2-6 0-8z"/>'),
  },
  {
    id: 'hydra', slot: 'core', name: 'Hydra Core', tag: 'firepower', fx: [['dmg', 0.1]],
    unique: '25% of primary hits split in two and 15% of volleys fire twice.',
    apply(st) { st.splinter += 0.25; st.echo += 0.15; },
    icon: svg('<path d="M12 21V11M12 11L6 4M12 11l6-7M12 11V3"/><circle cx="12" cy="11" r="2"/>'),
  },
  {
    id: 'conductor', slot: 'core', name: 'Conductor Core', tag: 'modules', fx: [['mod', 0.15]],
    unique: 'Kills arc lightning into 2 more enemies. +1 module slot.',
    apply(st) { st.static += 2; st.maxModules += 1; },
    icon: svg('<rect x="6" y="6" width="12" height="12"/><path d="M13 7l-3 5h4l-3 5"/>'),
  },
  {
    id: 'bloodreactor', slot: 'core', name: 'Blood Reactor', tag: 'firepower', fx: [['dmg', 0.08]],
    unique: '+15% damage per missing hull. Repair 1 hull every 45 kills.',
    apply(st) { st.redline += 0.15; st.leech = st.leech ? Math.min(st.leech, 45) : 45; },
    icon: svg('<path d="M12 3s6 6 6 11a6 6 0 01-12 0c0-5 6-11 6-11z"/><path d="M9 14h6"/>'),
  },
  // --- Plating ---
  {
    id: 'phoenix', slot: 'plating', name: 'Phoenix Plate', tag: 'tank', fx: [['hull', 1]],
    unique: 'One more Second Wind per run: a killing blow leaves you at 1 hull.',
    apply(st) { st.secondWind += 1; },
    icon: svg('<path d="M12 21c-4-3-7-6-7-10 3 1 5 3 7 6 2-3 4-5 7-6 0 4-3 7-7 10z"/><path d="M12 3v8"/>'),
  },
  {
    id: 'aegisprime', slot: 'plating', name: 'Aegis Prime', tag: 'tank', fx: [['shield', 0.2]], start: { aegis: 2 },
    unique: 'Start every run with Aegis Shield 2. Shield breaks pulse the ultimate meter +15.',
    apply(st) { st.aegisOd = (st.aegisOd || 0) + 15; },
    icon: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 7v10M7 12h10"/>'),
  },
  {
    id: 'nullmantle', slot: 'plating', name: 'Null Mantle', tag: 'overdrive', fx: [['grazeR', 0.2]],
    unique: 'Enemy bullets slow down near you (Null Field). Grazes charge the ultimate 50% more.',
    apply(st) { st.nullR = Math.max(st.nullR, 70) + 20; st.grazeOd *= 1.5; },
    icon: svg('<circle cx="12" cy="12" r="9" stroke-dasharray="3 2"/><path d="M6 18L18 6"/>'),
  },
  {
    id: 'midas', slot: 'plating', name: 'Midas Lattice', tag: 'greed', fx: [['magnet', 0.3]],
    unique: '+40% credits and +40% rarity find.',
    apply(st) { st.creditMul *= 1.4; st.find += 0.4; },
    icon: svg('<path d="M3 9l9-6 9 6-9 12z"/><path d="M3 9h18M9 9l3 12 3-12"/>'),
  },
  // --- Thrusters ---
  {
    id: 'riftwalker', slot: 'thrusters', name: 'Rift Walker', tag: 'mobility', fx: [['dashes', 1]], start: { dashNova: 2 },
    unique: 'Start every run with Shock Dash 2: dashes unleash blades and erase bullets.',
    icon: svg('<path d="M4 20L14 10"/><path d="M14 4l1.5 4.5L20 10l-4.5 1.5L14 16l-1.5-4.5L8 10l4.5-1.5z"/>'),
  },
  {
    id: 'echodrive', slot: 'thrusters', name: 'Echo Drive', tag: 'mobility', fx: [['dashCd', 0.15]],
    unique: 'Dashes leave 3 echoes that detonate after 0.3s.',
    apply(st) { st.afterimage = true; },
    icon: svg('<path d="M4 18l5-6-5-6M11 18l5-6-5-6M18 18l3-6-3-6"/>'),
  },
  {
    id: 'slipvanes', slot: 'thrusters', name: 'Slipstream Vanes', tag: 'overdrive', fx: [['grazeR', 0.25]],
    unique: 'Grazes give a burst of speed, and grazing mid-dash refunds half a dash.',
    apply(st) { st.slipstream = true; st.riposte = true; },
    icon: svg('<path d="M3 8h12M3 12h18M3 16h12"/><path d="M17 5l3 3-3 3"/>'),
  },
  {
    id: 'turbine', slot: 'thrusters', name: 'Perpetual Turbine', tag: 'overdrive', fx: [['odDur', 1.5]],
    unique: 'Your ultimate meter charges on its own.',
    apply(st) { st.perpetual += 2.4; },
    icon: svg('<path d="M7 8a4 4 0 100 8c3 0 7-8 10-8a4 4 0 110 8c-3 0-7-8-10-8z"/>'),
  },
];

const defById = new Map([...BASES, ...LEGENDARIES].map((d) => [d.id, d]));
export const gearDef = (id) => defById.get(id);
export const isLegendary = (item) => item && item.r === LEGENDARY;

// Item level from where it dropped: system (0-3), Overdrive tier and Deep Grid cycle.
export const itemLevel = ({ sys = 0, tier = 0, deep = 0 } = {}) => Math.min(20, 1 + sys + 4 * deep + Math.floor(tier / 2));

// Base-effect multiplier for a rarity / item level.
const kOf = (r, il) => RARITY_GEAR[r].k * (1 + 0.03 * (il - 1));
const scaled = (stat, v, k) => (v > 0 && !STATS[stat].flat ? v * k : v);

function weightedPick(list, w, rng) {
  let t = 0;
  for (const x of list) t += w(x);
  let x = rng() * t;
  for (const it of list) if ((x -= w(it)) <= 0) return it;
  return list[list.length - 1];
}

// Rolls `n` modifiers for rarity r at item level il. `scale` < 1 makes them weaker (level-up card bonuses).
export function rollMods(r, il, n, rng = Math.random, scale = 1, avoid = []) {
  const out = [];
  const used = new Set(avoid);
  for (let i = 0; i < n; i++) {
    const pool = AFFIXES.filter((a) => a.minR <= r && !used.has(a.id) && !(scale < 1 && STATS[a.stat].flat));
    if (!pool.length) break;
    const a = weightedPick(pool, (x) => x.weight, rng);
    used.add(a.id);
    let v = a.lo;
    if (!STATS[a.stat].flat) {
      const q = RARITY_GEAR[r].q + rng() * (1 - RARITY_GEAR[r].q);
      v = (a.lo + (a.hi - a.lo) * q) * (1 + 0.06 * (il - 1)) * scale;
      v = a.stat === 'odDur' ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
      v = Math.max(a.stat === 'odDur' ? 0.1 : 0.01, v);
    }
    out.push([a.id, v]);
  }
  return out;
}

// A fresh item (no uid yet). Legendary rarity picks one of the slot's legendaries.
export function makeItem(slot, r, il, rng = Math.random, baseId = null) {
  let def = baseId ? gearDef(baseId) : null;
  if (!def) {
    const pool = r === LEGENDARY ? LEGENDARIES.filter((d) => d.slot === slot) : BASES.filter((d) => d.slot === slot);
    def = pool[Math.floor(rng() * pool.length)];
  }
  const g = RARITY_GEAR[r];
  const n = g.mods + (rng() < g.extra ? 1 : 0);
  return { base: def.id, slot: def.slot, r, il, mods: rollMods(r, il, n, rng) };
}

export function itemName(item) {
  return gearDef(item.base).name;
}

// Display lines: base effects (scaled), unique, modifiers. [{text, kind: 'base'|'start'|'unique'|'mod', tag?}]
export function itemLines(item) {
  const def = gearDef(item.base);
  const k = kOf(item.r, item.il);
  const out = [];
  if (def.note) out.push({ text: def.note, kind: 'base' });
  for (const [stat, v] of def.fx) out.push({ text: STATS[stat].text(scaled(stat, v, k)), kind: v < 0 ? 'drawback' : 'base' });
  if (def.unique) out.push({ text: def.unique, kind: 'unique' });
  for (const [id, v] of item.mods) out.push({ text: STATS[affixById.get(id).stat].text(v), kind: 'mod', tag: affixById.get(id).tag });
  return out;
}

// Build-path weights of one item: base tag 1 (legendary 2), each modifier 1.
export function itemTags(item) {
  const def = gearDef(item.base);
  const t = {};
  t[def.tag] = def.unique ? 2 : 1;
  for (const [id] of item.mods) {
    const tag = affixTag(id);
    if (tag) t[tag] = (t[tag] || 0) + 1;
  }
  return t;
}

export function sellValue(item) {
  return Math.round((RARITY_GEAR[item.r].sell * (1 + 0.1 * (item.il - 1))) / 5) * 5;
}

// Rough power score for sorting / auto-salvage: rarity first, then item level.
export const itemScore = (item) => item.r * 100 + item.il * 3 + item.mods.length;

// recomputeStats-ready effect for an item.
export function itemEffect(item) {
  const def = gearDef(item.base);
  const k = kOf(item.r, item.il);
  return {
    uid: item.uid, slot: def.slot, name: def.name, icon: def.icon, r: item.r, start: def.start, item,
    apply(st, p) {
      for (const [stat, v] of def.fx) STATS[stat].apply(st, scaled(stat, v, k));
      for (const [id, v] of item.mods) STATS[affixById.get(id).stat].apply(st, v);
      if (def.apply) def.apply(st, p);
    },
  };
}

// --- Profile inventory ----------------------------------------------------------------

export const gearByUid = (profile, uid) => profile.gear.find((g) => g.uid === uid) || null;
export const gearInSlot = (profile, slot) => profile.gear.filter((g) => g.slot === slot);

// Equipped item effects for a ship (one per slot).
export function equippedParts(profile, shipId) {
  const eq = (profile.equip && profile.equip[shipId]) || {};
  const out = [];
  for (const slot of SLOTS) {
    const item = gearByUid(profile, eq[slot]);
    if (item && item.slot === slot && gearDef(item.base)) out.push(itemEffect(item));
  }
  return out;
}

// Ships an item is equipped on.
export function equippedOn(profile, uid) {
  return Object.keys(profile.equip).filter((s) => SLOTS.some((sl) => profile.equip[s][sl] === uid));
}

export function applyParts(st, p) {
  for (const part of p.parts || []) part.apply(st, p);
  if (p.fluxCore) applyCore(st, p.fluxCore); // Flux Core levels (endgame), real runs only
}

// Legacy fixed parts (owned before gear was loot) → one Rare item each, keeping what was equipped.
export function migrateParts(profile) {
  if (profile.gearMigrated) return;
  profile.gearMigrated = true;
  const map = {};
  for (const id of profile.ownedParts) {
    const def = gearDef(id);
    if (!def || def.unique) continue;
    const item = { ...makeItem(def.slot, 2, 2, Math.random, id), uid: 'g' + ++profile.gearSeq };
    profile.gear.push(item);
    map[id] = item.uid;
  }
  for (const eq of Object.values(profile.equip)) for (const sl of SLOTS) if (eq[sl] && map[eq[sl]]) eq[sl] = map[eq[sl]];
  profile.ownedParts = [];
}
