// Endgame: Overdrive tiers (difficulty picked before launch), the Deep Grid (the run loops on after THE VOID) and the
// Flux Core (permanent, uncapped stat levels bought with Flux, the endgame currency).
// Heat = tier + deep cycle. It scales enemies (applyHeat) and the rewards; Flux only drops while heat > 0.

export const TIER_CAP = 10;

// Enemy / reward scaling for a sector spec with `tier` and `deep`.
export function heatScale(tier = 0, deep = 0) {
  const h = tier + deep;
  return {
    hp: Math.pow(1.4, tier) * Math.pow(1.8, deep),
    bullet: Math.min(1.35, 1 + 0.04 * h),
    fire: Math.min(1.5, 1 + 0.05 * h),
    spawn: Math.max(0.75, 1 - 0.03 * h),
    reward: 1 + 0.25 * h, // credits and XP
  };
}

// Folds heat into a director difficulty (after modifiers).
export function applyHeat(diff, spec) {
  if (!spec.tier && !spec.deep) return diff;
  const k = heatScale(spec.tier, spec.deep);
  diff.hp *= k.hp;
  diff.bulletSpeed *= k.bullet;
  diff.fireRate *= k.fire;
  diff.spawn *= k.spawn;
  diff.credits = (diff.credits || 1) * k.reward;
  diff.xp *= k.reward;
  return diff;
}

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

// Flux Core nodes: no level cap; cost = base × growth^level.
export const CORE = [
  { id: 'dmg', name: 'Damage Lattice', base: 8, growth: 1.22, color: '#ff4d6d', icon: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'), desc: (lv) => `+5% damage per level (now +${5 * lv}%).`, apply: (st, lv) => (st.dmg *= 1 + 0.05 * lv) },
  { id: 'rate', name: 'Cycle Accelerator', base: 8, growth: 1.22, color: '#3ff6ff', icon: svg('<path d="M3 12h4l3-7 4 14 3-7h4"/>'), desc: (lv) => `+3% fire rate per level (now +${3 * lv}%).`, apply: (st, lv) => (st.rate *= 1 + 0.03 * lv) },
  { id: 'crit', name: 'Predictive Optics', base: 10, growth: 1.25, color: '#ffe14d', icon: svg('<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>'), desc: (lv) => `+1% critical chance per level (now +${lv}%).`, apply: (st, lv) => (st.crit += 0.01 * lv) },
  { id: 'hull', name: 'Hull Weave', base: 20, growth: 1.6, color: '#7dff6b', icon: svg('<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/>'), desc: (lv) => `+1 max hull per level (now +${lv}).`, apply: (st, lv) => (st.maxHp += lv) },
  { id: 'od', name: 'Overdrive Feed', base: 6, growth: 1.2, color: '#ff3df2', icon: svg('<path d="M12 2l8 5v10l-8 5-8-5V7z"/><path d="M13 7l-3 5h4l-3 5"/>'), desc: (lv) => `+6% Overdrive / ultimate charge per level (now +${6 * lv}%).`, apply: (st, lv) => (st.odGain *= 1 + 0.06 * lv) },
  { id: 'xp', name: 'Neural Uplink', base: 6, growth: 1.2, color: '#b48bff', icon: svg('<path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.4l6-.8z"/>'), desc: (lv) => `+5% XP per level (now +${5 * lv}%).`, apply: (st, lv) => (st.xpMul *= 1 + 0.05 * lv) },
  { id: 'credits', name: 'Salvage Protocol', base: 6, growth: 1.2, color: '#ffd24a', icon: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l3.5 4.5-3.5 4.5-3.5-4.5z"/>'), desc: (lv) => `+5% credits per level (now +${5 * lv}%).`, apply: (st, lv) => (st.creditMul *= 1 + 0.05 * lv) },
];

export const coreCost = (node, lv) => Math.round(node.base * Math.pow(node.growth, lv));

// Applied from applyParts (real runs only: the player's `core` is null in attract).
export function applyCore(st, levels) {
  for (const n of CORE) {
    const lv = levels[n.id] || 0;
    if (lv > 0) n.apply(st, lv);
  }
}
