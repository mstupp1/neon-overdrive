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
  campaign: { cleared: [], seenStory: {} },
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
};

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
  for (const k of Object.keys(p.equip)) if (!isObj(p.equip[k])) delete p.equip[k];
  for (const k of Object.keys(p.paint)) if (!Number.isFinite(p.paint[k])) delete p.paint[k];
  for (const k of Object.keys(p.paintsOwned)) p.paintsOwned[k] = Array.isArray(p.paintsOwned[k]) ? p.paintsOwned[k].filter(Number.isFinite) : [];
  for (const k of Object.keys(p.pilot.passives)) p.pilot.passives[k] = strs(p.pilot.passives[k]);
  p.relics = [...new Set(strs(p.relics))];
  p.relicNew = strs(p.relicNew);
  for (const m of [p.ach, p.stats]) for (const k of Object.keys(m)) if (!Number.isFinite(m[k])) delete m[k];
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
    if (raw) return grantShips(merge(DEFAULTS, JSON.parse(raw)));
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
