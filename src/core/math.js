// Small math helpers shared across the game.

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
export const chance = (p) => Math.random() < p;
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const sign = (v) => (v < 0 ? -1 : 1);

// Frame-rate independent exponential smoothing toward a target.
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

export function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

// Rotate `a` toward `b` by at most `step` radians.
export function turnToward(a, b, step) {
  const d = wrapAngle(b - a);
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
}

export function weightedPick(items, weightFn) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightFn(it));
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, weightFn(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Distance from point to segment, squared.
export function segDist2(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const len = abx * abx + aby * aby || 1;
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / len, 0, 1);
  return dist2(px, py, ax + abx * t, ay + aby * t);
}

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function formatScore(n) {
  return Math.floor(n).toLocaleString('en-US');
}

export function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Small seeded PRNG (mulberry32): returns () → [0, 1).
export function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
