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
    damageNumbers: true,
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
  endlessBest: 0,
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

const grantShips = (p) => {
  // Union: legacy unlock conditions top up ownership but never remove bought ships.
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
