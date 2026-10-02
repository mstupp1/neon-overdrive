// Persistent profile: settings, records and unlocks. Always wrapped in
// try/catch because storage can be unavailable (private mode, blocked).

import { SHIPS, isUnlocked } from '../game/ships.js';

const KEY = 'neon-overdrive/profile/v3';
const OLD_KEY = 'neon-overdrive/profile/v2';

const DEFAULTS = {
  settings: {
    music: 0.6,
    sfx: 0.8,
    shake: true,
    flashes: true,
    bloom: true,
    damageNumbers: true,
    story: true,
  },
  best: 0,
  bestSector: 0,
  bestCombo: 0,
  bossKills: 0,
  runs: 0,
  kills: 0,
  lastShip: 'vector',
  seenHelp: false,
  credits: 0,
  rankXp: 0,
  campaign: { cleared: [], seenStory: {}, bestSys: -1, bestRow: -1 }, // best*: furthest system index / route row any run reached
  ownedShips: [],
  ownedParts: [],
  equip: {}, // shipId → { core, plating, thrusters }
  paint: {}, // shipId → palette index
  paintsOwned: {}, // shipId → [owned palette indices] (0 = stock, always owned)
  pilot: { cls: 'striker', passives: {} }, // passives: cls → [ids]
  relics: [], // owned relic ids (collectables.js)
  relicNew: [], // owned but not yet seen in the gallery
  ach: {}, // achievement id → unlock timestamp
  stats: {}, // lifetime counters for achievements (swarm, capsules, ...)
  tech: [], // upgrade ids ever seen in a draft / market / event (upgrades.js discovery)
  flux: 0, // endgame currency (core.js): drops on Overdrive tiers / in the Deep Grid, always banked in full
  core: {}, // Flux Core node id → level
  tier: 0, // Overdrive tier picked for the next launch
  tierMax: 0, // highest tier unlocked (clearing THE VOID at tier t unlocks t + 1)
  bestDeep: 0, // deepest Deep Grid cycle reached
};

// Upgrades that existed before discovery was tracked: saves that had already played get them as discovered,
// so nothing they could already draft gets locked behind a later system.
const LEGACY_TECH = [
  'main', 'power', 'rate', 'crit', 'pierce', 'thrusters', 'magnet', 'capacitor', 'hull', 'aegis', 'dashes',
  'missiles', 'orbitals', 'drones', 'arc', 'nova', 'rail', 'shrapnel', 'dashNova', 'gravity', 'reflector', 'flak',
  'hellfire', 'stormhalo', 'teslastorm', 'annihilator',
];

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function merge(base, extra) {
  const out = JSON.parse(JSON.stringify(base)); // deep copy so defaults are never shared
  if (!extra || typeof extra !== 'object') return out;
  for (const k of Object.keys(base)) {
    if (!(k in extra)) continue;
    if (Array.isArray(base[k])) {
      if (Array.isArray(extra[k])) out[k] = extra[k];
    } else if (isObj(base[k])) {
      // Empty-object defaults are dynamic-key maps: take as-is.
      if (isObj(extra[k])) out[k] = Object.keys(base[k]).length ? merge(base[k], extra[k]) : extra[k];
    } else if (typeof extra[k] === typeof base[k]) {
      out[k] = extra[k];
    }
  }
  return out;
}

// One-time v2 → v3: keep records/settings, grant ships the player had unlocked.
function migrate(old) {
  const p = merge(DEFAULTS, {
    tech: old.runs > 0 ? LEGACY_TECH : [],
    settings: old.settings, best: old.best, bestSector: old.bestSector, bestCombo: old.bestCombo,
    bossKills: old.bossKills, runs: old.runs, kills: old.kills, lastShip: old.lastShip, seenHelp: old.seenHelp,
  });
  return grantShips(p);
}

// Hand-edited / corrupt saves: coerce every collection and counter to a safe shape (types are only checked shallowly by merge).
function sanitize(p) {
  const strs = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []);
  const num = (v) => (Number.isFinite(v) ? Math.max(0, v) : 0);
  p.credits = num(p.credits);
  p.rankXp = num(p.rankXp);
  p.ownedParts = strs(p.ownedParts);
  p.ownedShips = strs(p.ownedShips);
  p.campaign.cleared = strs(p.campaign.cleared);
  if (!isObj(p.campaign.seenStory)) p.campaign.seenStory = {};
  for (const k of ['bestSys', 'bestRow']) if (!Number.isInteger(p.campaign[k]) || p.campaign[k] < -1) p.campaign[k] = -1;
  for (const k of Object.keys(p.equip)) if (!isObj(p.equip[k])) delete p.equip[k];
  for (const k of Object.keys(p.paint)) if (!Number.isFinite(p.paint[k])) delete p.paint[k];
  for (const k of Object.keys(p.paintsOwned)) p.paintsOwned[k] = Array.isArray(p.paintsOwned[k]) ? p.paintsOwned[k].filter(Number.isFinite) : [];
  for (const k of Object.keys(p.pilot.passives)) p.pilot.passives[k] = strs(p.pilot.passives[k]);
  p.relics = [...new Set(strs(p.relics))];
  p.relicNew = strs(p.relicNew);
  p.tech = [...new Set(strs(p.tech))];
  for (const m of [p.ach, p.stats, p.core]) for (const k of Object.keys(m)) if (!Number.isFinite(m[k])) delete m[k];
  p.flux = num(p.flux);
  p.bestDeep = num(p.bestDeep);
  p.tierMax = Math.min(10, Math.floor(num(p.tierMax)));
  p.tier = Math.min(p.tierMax, Math.floor(num(p.tier)));
  return p;
}

const grantShips = (p) => {
  // Union: legacy unlock conditions top up ownership but never remove bought ships.
  sanitize(p);
  p.ownedShips = [...new Set([...p.ownedShips, ...SHIPS.filter((s) => (s.unlock ? isUnlocked(s, p) : !s.price)).map((s) => s.id)])];
  return p;
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const p = grantShips(merge(DEFAULTS, saved));
      if (isObj(saved) && !('tech' in saved) && p.runs > 0) p.tech = [...LEGACY_TECH];
      return p;
    }
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const p = migrate(JSON.parse(old));
      localStorage.setItem(KEY, JSON.stringify(p));
      return p;
    }
  } catch (e) {
    /* storage unavailable */
  }
  return grantShips(merge(DEFAULTS, {}));
}

export const profile = load();

export function saveProfile() {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch (e) {
    /* storage unavailable */
  }
}

export function resetProfile() {
  const settings = { ...profile.settings };
  Object.assign(profile, grantShips(merge(DEFAULTS, {})));
  profile.settings = settings;
  saveProfile();
}
