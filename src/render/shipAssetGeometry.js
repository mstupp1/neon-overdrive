// Source masters may be portrait or landscape; runtime PNGs are padded squares.
// Keep attachments in master-image coordinates and apply the export's placement.
export function exportedShipPoint([x, y], sourceSize, runtimeSize, contentBox = null) {
  const [rw, rh] = runtimeSize;
  if (!sourceSize) return [x * rw, y * rh];
  const [sw, sh] = sourceSize;
  const scale = Math.min(1, rw / sw, rh / sh);
  const w = Math.round(sw * scale), h = Math.round(sh * scale);
  const [left, top, width, height] = contentBox || [Math.floor((rw - w) / 2), Math.floor((rh - h) / 2), w, h];
  return [left + x * width, top + y * height];
}
