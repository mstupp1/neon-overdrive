// Shared mutable game state. Everything lives on `G` so systems stay decoupled
// and an external agent/debugger can inspect the world (window.NEON).

export const view = {
  W: 450, // logical playfield width (fixed)
  H: 800, // logical height (depends on aspect)
  scale: 1, // css px per logical unit
  dpr: 1,
  rect: { left: 0, top: 0, width: 450, height: 800 },
  safeTop: 0,
  safeBottom: 0,
  quality: 1, // 1 = full, lowered automatically if frames are slow
};

export const G = {
  mode: 'attract', // 'attract' (bot demo behind menus) | 'run'
  screen: 'title', // title | campaign | hangar | parts | pilot | tree | help | settings | route | market | dock | event | comms | play | pause | pause-settings | draft | extract | gameover
  time: 0, // simulation time (seconds)
  realTime: 0,
  slowmo: 0, // seconds of slow motion remaining
  hitstop: 0,

  player: null,
  enemies: [],
  pBullets: [],
  eBullets: [],
  pickups: [],
  particles: [],
  texts: [],
  beams: [], // transient damaging beams (rail, boss lasers)
  bolts: [], // lightning visuals
  boss: null,

  sector: 1,
  loop: 0,
  score: 0,
  displayScore: 0,
  combo: 0,
  comboTimer: 0,
  maxCombo: 0,
  kills: 0,
  grazes: 0,
  bossKills: 0,
  runTime: 0,
  rerolls: 1,
  pendingLevels: 0,
  supplyLeft: 0, // campaign supply-drop drafts still to claim at system start
  director: null,

  shake: 0,
  flash: 0,
  flashColor: '255,255,255',
  banner: null, // { title, sub, t, dur, color }
  pulse: 0, // ult shockwave visual radius
  pulseMax: 1100,
  pulseColor: '#ff3df2',
  enemyTimeScale: 1, // Phase Shift: scales enemies, bosses, enemy bullets and enemy beams (not the player)

  run: null, // campaign / endless run record (see agents.md); null in attract
  autopilot: false, // debug: the bot flies the player
  vacuum: false, // sector clear: pickups fly to the player
  deathT: 0, // delay before the game-over screen
};

export function sectorDifficulty(sector, loop) {
  const s = sector - 1;
  const loopMul = Math.pow(3, loop);
  return {
    hp: (1 + 0.5 * s + 0.12 * s * s) * loopMul,
    bulletSpeed: Math.min(1.55, 1 + 0.045 * s + loop * 0.15),
    fireRate: Math.min(2.2, 1 + 0.1 * s + loop * 0.25),
    spawn: Math.max(0.4, 1 - 0.065 * s - loop * 0.1),
    xp: 1 + 0.22 * s + loop * 1.5,
    score: 1 + 0.25 * s + loop * 2,
  };
}

export const SECTORS = [
  { name: 'NEON GENESIS', hue: 215 },
  { name: 'VIOLET VORTEX', hue: 270 },
  { name: 'CRIMSON TIDE', hue: 345 },
  { name: 'SOLAR FLARE', hue: 28 },
  { name: 'TOXIC WASTE', hue: 115 },
  { name: 'CYAN CYCLONE', hue: 185 },
  { name: 'MAGENTA MADNESS', hue: 305 },
  { name: 'VOID WALKER', hue: 245 },
  { name: 'OMEGA OVERDRIVE', hue: 0 },
];

export function sectorInfo(sector) {
  return SECTORS[(sector - 1) % SECTORS.length];
}

export const isBossSector = (sector) => sector % 3 === 0;
