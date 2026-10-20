// One logical-coordinate layout drives both Canvas instruments and DOM hit targets.
export function abilityLayout(view, side = 'right') {
  const scale = Math.max(0.1, view.scale || 1);
  const target = Math.max(64, 44 / scale);
  const step = Math.max(84, target + 12);
  const inset = Math.max(44, target / 2 + 8);
  const left = side === 'left';
  const x = left ? (view.safeLeft || 0) + inset : view.W - (view.safeRight || 0) - inset;
  const y = view.H - (view.safeBottom || 0) - Math.max(52, target / 2 + 8);
  return {
    dash: { x: x + (left ? step : -step), y, target },
    od: { x, y: y - step, target },
    boost: { x, y, target },
  };
}

export function placeAbilityTargets(root, spots, scale) {
  for (const [kind, spot] of Object.entries(spots)) {
    const el = root.querySelector(`#touch-${kind}`);
    if (!el) continue;
    Object.assign(el.style, {
      left: `${(spot.x - spot.target / 2) * scale}px`,
      top: `${(spot.y - spot.target / 2) * scale}px`,
      width: `${spot.target * scale}px`,
      height: `${spot.target * scale}px`,
    });
  }
}

// Include the housing footprint when reserving room for cards and notifications.
export function abilityClusterTop(spots) {
  return Math.min(...Object.values(spots).map(spot => spot.y - Math.max(34, spot.target / 2)));
}
