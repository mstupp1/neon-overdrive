// Playable ships. Each has a distinct primary weapon and a starting kit.
// `price` (credits) buys a ship in the Hangar; `unlock` is the legacy free grant. No price + no unlock = owned from the start.

export const SHIPS = [
  {
    id: 'vector',
    path: 'firepower',
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
    path: 'crit',
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
    price: 600,
    unlock: { kind: 'bossKills', n: 1, text: 'Defeat any boss' },
  },
  {
    id: 'bulwark',
    path: 'tank',
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
    price: 900,
    unlock: { kind: 'bestSector', n: 5, text: 'Fight 5 sectors in one run' },
  },
  {
    id: 'phantom',
    path: 'overdrive',
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
    price: 1400,
    unlock: { kind: 'bestSector', n: 8, text: 'Fight 8 sectors in one run' },
  },
  {
    id: 'corsair',
    path: 'firepower',
    name: 'CORSAIR',
    role: 'Skirmisher',
    desc: 'Angled bolts ricochet off the side walls. Fans wider with every weapon level.',
    color: '#ff8a3d',
    bullet: '#ffb066',
    weapon: 'ricochet',
    hp: 3,
    speed: 1.08,
    dashes: 2,
    start: { thrusters: 1 },
    price: 1100,
    unlock: null,
  },
  {
    id: 'monolith',
    path: 'tank',
    name: 'MONOLITH',
    role: 'Siege',
    desc: 'Slow, heavy charge cannon. Huge piercing orbs that grow with every weapon level.',
    color: '#6f8bff',
    bullet: '#a9bbff',
    weapon: 'charge',
    hp: 5,
    speed: 0.85,
    dashes: 1,
    start: { power: 1 },
    price: 1600,
    unlock: null,
  },
  {
    id: 'wraith',
    path: 'mobility',
    name: 'WRAITH',
    role: 'Duelist',
    desc: 'Twin lances weave in a sine pattern and pierce. Light, fast, built around the dash.',
    color: '#5effd8',
    bullet: '#a8fff0',
    weapon: 'wave',
    hp: 3,
    speed: 1.1,
    dashes: 2,
    start: { blink: 1 },
    trait: { text: 'TRAIT: dashes recharge 15% faster.', apply(st) { st.dashRecharge *= 0.85; } },
    price: 1300,
    unlock: null,
  },
  {
    id: 'talon',
    path: 'crit',
    name: 'TALON',
    role: 'Marksman',
    desc: 'Fires tight three-round bursts of needle rounds. Fragile, but every shot is a crit chance.',
    color: '#ff5a7a',
    bullet: '#ffb3c2',
    weapon: 'burst',
    hp: 2,
    speed: 1.06,
    dashes: 2,
    start: { crit: 1 },
    trait: { text: 'TRAIT: crits deal +0.5x damage.', apply(st) { st.critMul += 0.5; } },
    price: 1500,
    unlock: null,
  },
  {
    id: 'halo',
    path: 'modules',
    name: 'HALO',
    role: 'Carrier',
    desc: 'A weak spray of homing sparks, but a huge module bay. Launches with Wingmen.',
    color: '#ff9df0',
    bullet: '#ffd1f7',
    weapon: 'spark',
    hp: 3,
    speed: 0.95,
    dashes: 2,
    start: { drones: 1 },
    trait: { text: 'TRAIT: +1 module slot, +10% module damage.', apply(st) { st.maxModules += 1; st.modDmg *= 1.1; } },
    price: 1800,
    unlock: null,
  },
  {
    id: 'magnate',
    path: 'greed',
    name: 'MAGNATE',
    role: 'Salvager',
    desc: 'Heavy shard rounds that splinter on impact. Armored, slow, and it finds better loot.',
    color: '#e8c66a',
    bullet: '#ffe7a3',
    weapon: 'shard',
    hp: 4,
    speed: 0.95,
    dashes: 1,
    start: { magnet: 1 },
    trait: { text: 'TRAIT: +25% credits, +25% rarity find, 15% of hits splinter.', apply(st) { st.creditMul *= 1.25; st.find += 0.25; st.splinter += 0.15; } },
    price: 2000,
    unlock: null,
  },
];

export function isUnlocked(ship, profile) {
  if (!ship.unlock) return true;
  const u = ship.unlock;
  return (profile[u.kind] || 0) >= u.n;
}

// Owned = bought, legacy-unlocked (both land in profile.ownedShips), or the free starter.
export function ownsShip(profile, ship) {
  return profile.ownedShips.includes(ship.id) || (!ship.price && !ship.unlock);
}

// Paint palettes: index 0 is the stock colour (free); the rest are bought in the Hangar.
const PAINT_SETS = {
  vector: [['CRIMSON', '#ff3b5c'], ['GOLD', '#ffc933'], ['ULTRAVIOLET', '#9a6bff']],
  needle: [['CRIMSON', '#ff3b5c'], ['GHOST', '#e4f2ff'], ['ULTRAVIOLET', '#9a6bff']],
  bulwark: [['CRIMSON', '#ff3b5c'], ['GHOST', '#e4f2ff'], ['TOXIC', '#b6ff00']],
  phantom: [['CRIMSON', '#ff3b5c'], ['GOLD', '#ffc933'], ['TOXIC', '#b6ff00']],
  corsair: [['ICE', '#9fe9ff'], ['TOXIC', '#b6ff00'], ['ULTRAVIOLET', '#9a6bff']],
  monolith: [['CRIMSON', '#ff3b5c'], ['GOLD', '#ffc933'], ['GHOST', '#e4f2ff']],
  wraith: [['ULTRAVIOLET', '#9a6bff'], ['GHOST', '#e4f2ff'], ['CRIMSON', '#ff3b5c']],
  talon: [['ICE', '#9fe9ff'], ['GOLD', '#ffc933'], ['TOXIC', '#b6ff00']],
  halo: [['ICE', '#9fe9ff'], ['TOXIC', '#b6ff00'], ['GOLD', '#ffc933']],
  magnate: [['CRIMSON', '#ff3b5c'], ['ULTRAVIOLET', '#9a6bff'], ['GHOST', '#e4f2ff']],
};
const FALLBACK_PAINTS = [['CRIMSON', '#ff3b5c'], ['GOLD', '#ffc933'], ['GHOST', '#e4f2ff']];
const PAINT_PRICE = 120;

export function paintsFor(ship) {
  return [
    { name: 'STOCK', color: ship.color, bullet: ship.bullet, price: 0 },
    ...(PAINT_SETS[ship.id] || FALLBACK_PAINTS).map(([name, c]) => ({ name, color: c, bullet: c, price: PAINT_PRICE })),
  ];
}

// The equipped paint (owned only) for a ship.
export function activePaint(profile, ship) {
  const list = paintsFor(ship);
  const i = (profile.paint && profile.paint[ship.id]) || 0;
  const owned = i === 0 || ((profile.paintsOwned && profile.paintsOwned[ship.id]) || []).includes(i);
  return list[owned && list[i] ? i : 0];
}

export const shipById = (id) => SHIPS.find((s) => s.id === id) || SHIPS[0];

// Primary weapon tuning. `interval` is seconds between volleys at 1x fire rate.
export const WEAPONS = {
  pulse: { interval: 0.1, dmg: 1, speed: 980, r: 4 },
  lance: { interval: 0.15, dmg: 2.1, speed: 1300, r: 3.5, pierce: 1 },
  scatter: { interval: 0.19, dmg: 1.05, speed: 780, r: 4, life: 0.8, homing: 1.8 },
  phase: { interval: 0.12, dmg: 1.45, speed: 820, r: 5, homing: 3.2 },
  ricochet: { interval: 0.11, dmg: 1.6, speed: 900, r: 4, life: 1.5, bounce: 1 },
  charge: { interval: 0.5, dmg: 12, speed: 620, r: 9, life: 1.6, pierce: 4 },
  wave: { interval: 0.13, dmg: 1.15, speed: 840, r: 4, life: 1.3, pierce: 1, wave: 16, freq: 13 },
  burst: { interval: 0.42, dmg: 2.4, speed: 1250, r: 3.5, burst: 3, gap: 0.05 },
  spark: { interval: 0.12, dmg: 0.8, speed: 700, r: 3.5, life: 1.4, homing: 4.2 },
  shard: { interval: 0.16, dmg: 1.5, speed: 900, r: 4.5 },
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
    const spread = [30, 33, 37, 41, 45, 49, 53, 58][lv - 1] * deg;
    for (let i = 0; i < n; i++) out.push([0, -spread / 2 + (spread * i) / (n - 1)]);
  } else if (weapon === 'phase') {
    const n = [2, 2, 3, 3, 4, 4, 5, 6][lv - 1];
    const spread = [16, 22, 28, 34, 40, 46, 52, 60][lv - 1] * deg;
    for (let i = 0; i < n; i++) out.push([(i - (n - 1) / 2) * 7, n > 1 ? -spread / 2 + (spread * i) / (n - 1) : 0]);
  } else if (weapon === 'ricochet') {
    // Angled bolts only (no straight stream): the fan widens with level and the walls fold it back in.
    const n = [2, 3, 4, 5, 6, 6, 7, 8][lv - 1];
    const spread = [18, 26, 34, 40, 46, 52, 58, 64][lv - 1] * deg;
    for (let i = 0; i < n; i++) out.push([(i - (n - 1) / 2) * 4, -spread / 2 + (spread * i) / (n - 1)]);
  } else if (weapon === 'wave') {
    // Mirrored pairs: [x, angle, wave phase]. Each pair crosses over in a braid.
    const pairs = [1, 1, 2, 2, 2, 3, 3, 3][lv - 1];
    const fan = [0, 0, 0, 1, 1, 1, 2, 2][lv - 1];
    for (let i = 0; i < pairs; i++) {
      const x = (i - (pairs - 1) / 2) * 14;
      out.push([x - 3, 0, 0], [x + 3, 0, Math.PI]);
    }
    for (let i = 1; i <= fan; i++) out.push([-8, -i * 6 * deg, 0], [8, i * 6 * deg, Math.PI]);
  } else if (weapon === 'burst') {
    const straight = [1, 1, 2, 2, 2, 3, 3, 3][lv - 1];
    const pairs = [0, 1, 0, 1, 1, 1, 2, 2][lv - 1];
    for (let i = 0; i < straight; i++) out.push([(i - (straight - 1) / 2) * 7, 0]);
    for (let i = 1; i <= pairs; i++) out.push([-6, -i * 4 * deg], [6, i * 4 * deg]);
  } else if (weapon === 'spark') {
    const n = [2, 3, 3, 4, 4, 5, 6, 6][lv - 1];
    const spread = [40, 46, 52, 58, 64, 70, 76, 84][lv - 1] * deg;
    for (let i = 0; i < n; i++) out.push([(i - (n - 1) / 2) * 5, -spread / 2 + (spread * i) / (n - 1)]);
  } else if (weapon === 'shard') {
    const straight = [2, 2, 3, 3, 3, 4, 4, 5][lv - 1];
    const pairs = [0, 1, 1, 1, 2, 2, 2, 2][lv - 1];
    for (let i = 0; i < straight; i++) out.push([(i - (straight - 1) / 2) * 10, 0]);
    for (let i = 1; i <= pairs; i++) out.push([-10, -i * 9 * deg], [10, i * 9 * deg]);
  } else if (weapon === 'charge') {
    const n = [1, 1, 2, 2, 2, 3, 3, 3][lv - 1];
    for (let i = 0; i < n; i++) out.push([(i - (n - 1) / 2) * 20, (i - (n - 1) / 2) * 0.05]);
  }
  return out;
}

export function weaponDamageScale(lv) {
  return 1 + Math.max(0, lv - 5) * 0.14;
}
