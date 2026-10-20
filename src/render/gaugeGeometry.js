// Meter geometry is independent of artwork and never bakes in a charge count.
const TAU = Math.PI * 2;
export const unitFill = (value, cap) => cap > 0 ? Math.max(0, Math.min(1, value / cap)) : 0;
export function chargeArc(index, count) {
  const span = TAU / Math.max(1, count);
  const gap = Math.min(0.12, span * 0.16);
  return { start: -Math.PI / 2 + index * span + gap, end: -Math.PI / 2 + (index + 1) * span - gap };
}
export function chargeFill(index, full, partial = 0) {
  return index < full ? 1 : index === full ? unitFill(partial, 1) : 0;
}
