// Playable ships. Each has a distinct primary weapon and a starting kit.

export const SHIPS = [
  {
    id: 'vector',
    name: 'VECTOR',
    role: 'All-rounder',
    desc: 'Twin pulse cannons that fan out as they level. Forgiving and fast.',
    color: '#3ff6ff',
    bullet: '#3ff6ff',
    weapon: 'pulse',
    hp: 3,
    speed: 1,
    dashes: 2,
    start: {},
    unlock: null,
  },
  {
    id: 'needle',
    name: 'NEEDLE',
    role: 'Glass cannon',
    desc: 'Piercing lances punch through whole formations. Quick, but only 2 hull.',
    color: '#8dff5a',
    bullet: '#8dff5a',
    weapon: 'lance',
    hp: 2,
    speed: 1.14,
    dashes: 2,
    start: { pierce: 1 },
    unlock: { kind: 'bossKills', n: 1, text: 'Defeat any boss' },
  },
  {
    id: 'bulwark',
    name: 'BULWARK',
    role: 'Heavy',
    desc: 'Wide scatter blasts and thick armor. Starts with a regenerating shield.',
    color: '#ffd23f',
    bullet: '#ffd23f',
    weapon: 'scatter',
    hp: 4,
    speed: 0.9,
    dashes: 1,
    start: { aegis: 1 },
    unlock: { kind: 'bestSector', n: 5, text: 'Reach Sector 5' },
  },
  {
    id: 'phantom',
    name: 'PHANTOM',
    role: 'Trickster',
    desc: 'Seeking crescents, three dashes that erupt in blades, faster Overdrive.',
    color: '#c77dff',
    bullet: '#d59bff',
    weapon: 'phase',
    hp: 3,
    speed: 1.05,
    dashes: 3,
    start: { dashNova: 1, capacitor: 1 },
    unlock: { kind: 'bestSector', n: 8, text: 'Reach Sector 8' },
  },
];

export function isUnlocked(ship, profile) {
  if (!ship.unlock) return true;
  const u = ship.unlock;
  return (profile[u.kind] || 0) >= u.n;
}

export const shipById = (id) => SHIPS.find((s) => s.id === id) || SHIPS[0];

// Primary weapon tuning. `interval` is seconds between volleys at 1x fire rate.
export const WEAPONS = {
  pulse: { interval: 0.1, dmg: 1, speed: 980, r: 4 },
  lance: { interval: 0.15, dmg: 2.1, speed: 1300, r: 3.5, pierce: 1 },
  scatter: { interval: 0.19, dmg: 0.85, speed: 780, r: 4, life: 0.62 },
  phase: { interval: 0.12, dmg: 1.05, speed: 820, r: 5, homing: 3.2 },
};

// Returns an array of [xOffset, angleOffsetRadians] streams for a weapon level (1..8).
export function weaponStreams(weapon, lv) {
  const out = [];
  const deg = Math.PI / 180;
  if (weapon === 'pulse') {
    const straight = [2, 3, 3, 4, 4, 4, 5, 5][lv - 1];
    const pairs = [0, 0, 1, 1, 2, 2, 2, 3][lv - 1];
    const gap = 8;
    for (let i = 0; i < straight; i++) out.push([(i - (straight - 1) / 2) * gap, 0]);
    for (let i = 1; i <= pairs; i++) {
      out.push([-10, -i * 7 * deg]);
      out.push([10, i * 7 * deg]);
    }
  } else if (weapon === 'lance') {
    const straight = [1, 2, 2, 3, 3, 3, 4, 4][lv - 1];
    const pairs = [0, 0, 1, 1, 1, 2, 2, 2][lv - 1];
    for (let i = 0; i < straight; i++) out.push([(i - (straight - 1) / 2) * 9, 0]);
    for (let i = 1; i <= pairs; i++) {
      out.push([-8, -i * 3.5 * deg]);
      out.push([8, i * 3.5 * deg]);
    }
  } else if (weapon === 'scatter') {
    const n = [5, 6, 7, 8, 9, 10, 11, 13][lv - 1];
    const spread = [36, 40, 46, 52, 58, 62, 66, 72][lv - 1] * deg;
    for (let i = 0; i < n; i++) out.push([0, -spread / 2 + (spread * i) / (n - 1)]);
  } else if (weapon === 'phase') {
    const n = [2, 2, 3, 3, 4, 4, 5, 6][lv - 1];
    const spread = [16, 22, 28, 34, 40, 46, 52, 60][lv - 1] * deg;
    for (let i = 0; i < n; i++) out.push([(i - (n - 1) / 2) * 7, n > 1 ? -spread / 2 + (spread * i) / (n - 1) : 0]);
  }
  return out;
}

export function weaponDamageScale(lv) {
  return 1 + Math.max(0, lv - 5) * 0.14;
}
