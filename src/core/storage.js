// Persistent profile: settings, records and unlocks. Always wrapped in
// try/catch because storage can be unavailable (private mode, blocked).

const KEY = 'neon-overdrive/profile/v2';

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
};

function merge(base, extra) {
  const out = { ...base };
  if (!extra || typeof extra !== 'object') return out;
  for (const k of Object.keys(base)) {
    if (!(k in extra)) continue;
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = merge(base[k], extra[k]);
    } else if (typeof extra[k] === typeof base[k]) {
      out[k] = extra[k];
    }
  }
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(DEFAULTS, JSON.parse(raw));
  } catch (e) {
    /* storage unavailable */
  }
  return merge(DEFAULTS, {});
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
  Object.assign(profile, merge(DEFAULTS, {}));
  profile.settings = settings;
  saveProfile();
}
