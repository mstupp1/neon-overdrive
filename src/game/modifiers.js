// Sector modifiers: each tweaks the difficulty object and/or pattern weights.
// `apply(diff)` mutates; `patternWeight(patternId)` returns a multiplier.

export const MODIFIERS = {
  ionStorm: {
    name: 'ION STORM', desc: 'Faster bullets. +50% credits.', color: '#7dd3ff',
    apply(d) {
      d.bulletSpeed *= 1.15;
      d.credits *= 1.5;
    },
  },
  swarmFront: {
    name: 'SWARM FRONT', desc: 'Swarms everywhere.', color: '#ff9d3f',
    apply(d) {
      d.spawn *= 0.9;
    },
    patternWeight: (id) => (id === 'swarmSweep' || id === 'swarmRain' || id === 'pincer' ? 2.6 : 1),
  },
  minefield: {
    name: 'MINEFIELD', desc: 'Drifting mines fill the lanes.', color: '#ff5a5a',
    patternWeight: (id) => (id === 'mines' ? 4 : 1),
  },
  blackout: {
    name: 'BLACKOUT', desc: 'Lights out. Enemies glow.', color: '#b48bff',
    apply(d) {
      d.blackout = true;
    },
  },
  overclocked: {
    name: 'OVERCLOCKED', desc: 'Enemies fire faster. +30% XP.', color: '#ffe14a',
    apply(d) {
      d.fireRate *= 1.3;
      d.xp *= 1.3;
    },
  },
  bounty: {
    name: 'BOUNTY', desc: 'Elites drop extra credits.', color: '#ffd24a',
    apply(d) {
      d.eliteCredits = 2;
    },
  },
};

// Applies a spec's modifiers to a fresh difficulty object.
export function applyModifiers(diff, ids) {
  for (const id of ids || []) MODIFIERS[id]?.apply?.(diff);
  return diff;
}

// Combined pattern-weight multiplier for a spec's modifiers.
export function patternMul(ids, patternId) {
  let m = 1;
  for (const id of ids || []) m *= MODIFIERS[id]?.patternWeight?.(patternId) ?? 1;
  return m;
}
