// Shared screen-space geometry for the standard top-down camera. The helpers
// are pure so gameplay, background rendering, and wave placement use one frame.
export function topdownHorizon(H) {
  return H * 0.25;
}

export function topdownCombatTop(H, safeTop = 0) {
  return Math.max(safeTop + 84, topdownHorizon(H) + 24);
}

// Translate a point from the old full-height top-down frame into the floor
// below the horizon, then keep its full radius inside the combat bounds.
export function topdownTargetY(y, H, safeTop = 0, safeBottom = 0, r = 24) {
  const horizon = topdownHorizon(H);
  const remainingHeight = Math.max(0, H - horizon - safeBottom);
  const mapped = horizon + (y - safeTop) * remainingHeight / Math.max(1, H);
  const radius = Math.max(0, r);
  const low = topdownCombatTop(H, safeTop) + radius;
  const high = H - safeBottom - radius;
  if (high <= low) return Math.max(0, Math.min(H, (low + high) * 0.5));
  return Math.max(low, Math.min(high, mapped));
}
