// Generated hulls are decoded and painted once; combat still draws cached canvases.
// Anchor coordinates refer to the complete source image, including transparent margins.
import { SHIP_ART } from './shipImageSpecs.js';
import { shipPaint } from './shipPaint.js';
import { exportedShipPoint } from './shipAssetGeometry.js';
export { SHIP_ART };
export const VECTOR_ART = SHIP_ART.vector;

const BOX = 80;
const sources = new Map();
const variants = new Map();
function load(id, file) {
  const key = `${id}/${file}`;
  if (!sources.has(key)) {
    sources.set(key, new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = new URL(`../assets/ships/${key}`, import.meta.url).href;
    }));
  }
  return sources.get(key);
}

function bake(image, spec, mode, color, stock) {
  const source = document.createElement('canvas');
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const g = source.getContext('2d', { willReadFrequently: true });
  g.drawImage(image, 0, 0);
  const pixels = g.getImageData(0, 0, source.width, source.height);
  const data = pixels.data;
  let x0 = source.width, y0 = source.height, x1 = 0, y1 = 0;
  const repaint = shipPaint(stock, color);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    const i = (y * source.width + x) * 4;
    if (data[i + 3] > 32) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y);
      x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
    }
    if (repaint && data[i + 3]) {
      const rgb = repaint(data[i], data[i + 1], data[i + 2]);
      for (let j = 0; j < 3; j++) data[i + j] = rgb[j];
    }
  }
  if (x1 <= x0 || y1 <= y0) return null;
  g.putImageData(pixels, 0, 0);
  const scale = Math.min(spec.width / (x1 - x0), spec.height / (y1 - y0));
  const cx = spec.cx || 0, cy = spec.cy || 0;
  const dx = cx - (x0 + x1) * scale / 2;
  const dy = cy - (y0 + y1) * scale / 2;
  const point = ([x, y]) => {
    [x, y] = exportedShipPoint([x, y], spec.sourceSize, [source.width, source.height], spec.contentBox);
    x = x * scale + dx;
    y = y * scale + dy;
    // Stageview rotates the whole side-scrolling world clockwise a quarter turn.
    return mode === 'side' ? [y, -x] : [x, y];
  };
  // Hulls are fitted to their footprint box, which can exceed the procedural 64-unit sprite,
  // so the baked canvas is BOX units square (3 px per unit, close to the 256 px export).
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = BOX * 3;
  const ctx = canvas.getContext('2d');
  ctx.scale(3, 3);
  ctx.translate(BOX / 2, BOX / 2);
  if (mode === 'side') ctx.rotate(-Math.PI / 2);
  ctx.drawImage(source, dx, dy, source.width * scale, source.height * scale);
  // Exhaust and the shield ring follow the hull's drawn size instead of fixed widths.
  const long = Math.max(x1 - x0, y1 - y0) * scale;
  const flameW = Math.min(5.2, Math.max(3.6, long * 0.085));
  return { img: canvas, size: BOX, half: BOX / 2, generated: true, reach: long / 2,
    muzzles: spec.muzzles.map(point), engines: spec.engines.map(p => [...point(p), flameW]) };
}

export function withShipImages(id, color, fallback) {
  const art = SHIP_ART[id];
  if (!art) return fallback;
  const key = `${id}/${color.toLowerCase()}`;
  if (variants.has(key)) return variants.get(key);
  const sprite = { ...fallback, procedural: fallback, views: {} };
  variants.set(key, sprite);
  const pending = [];
  for (const mode of ['top', 'side', 'chase']) {
    const spec = art[mode];
    pending.push(load(id, spec.file).then(image => {
      if (!image) return;
      const baked = bake(image, spec, mode, color, art.color);
      if (!baked) return;
      if (mode === 'top') Object.assign(sprite, baked);
      else sprite.views[mode] = baked;
    }));
  }
  sprite.ready = Promise.all(pending).then(() => sprite);
  return sprite;
}

export function shipSpriteForView(sprite, mode = 'top') {
  return mode === 'top' ? sprite : sprite.views?.[mode] || sprite.procedural || sprite;
}
