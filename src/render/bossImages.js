// Generated boss bodies and optional component sprites. Images decode and bake
// once outside the frame loop; callers receive their existing procedural
// sprite until the selected camera image is ready or if it fails to load.
import { BOSS_ART } from './bossImageSpecs.js';

const sources = new Map();
const baked = new Map();
const pending = new Set();
const failed = new Set();

function source(file) {
  if (!sources.has(file)) {
    sources.set(file, new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = new URL(`../assets/bosses/${file}`, import.meta.url).href;
    }));
  }
  return sources.get(file);
}

function hue(color) {
  const m = /^#([\da-f]{6})$/i.exec(color || '');
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, s, l];
}

function rgbFromHsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgb.map(v => Math.round((v + m) * 255));
}

function tintEmissive(ctx, width, height, baseColor, tintColor) {
  const baseHue = hue(baseColor), targetHue = hue(tintColor);
  if (baseHue === null || targetHue === null || baseHue === targetHue) return;
  const pixels = ctx.getImageData(0, 0, width, height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 24) continue;
    const [pixelHue, saturation, lightness] = hsl(data[i], data[i + 1], data[i + 2]);
    if (saturation < 0.28) continue;
    let distance = pixelHue - baseHue;
    if (distance > 180) distance -= 360;
    if (distance < -180) distance += 360;
    if (Math.abs(distance) > 42) continue;
    const [r, g, b] = rgbFromHsl((targetHue + distance + 360) % 360, saturation, lightness);
    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }
  ctx.putImageData(pixels, 0, 0);
}

function bake(image, size, mode, baseColor, tintColor) {
  // Boss source images are square and framed against the existing sprite box.
  // Keep the same logical box and 2 texels/unit as the procedural sprite cache.
  const res = 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.ceil(size * res);
  const ctx = canvas.getContext('2d');
  ctx.scale(res, res);
  ctx.translate(size / 2, size / 2);
  // The side world is rotated clockwise by stageview when composited. Rotate
  // side-source art back here so it reads upright in the resulting view.
  if (mode === 'side') ctx.rotate(-Math.PI / 2);
  ctx.drawImage(image, -size / 2, -size / 2, size, size);
  tintEmissive(ctx, canvas.width, canvas.height, baseColor, tintColor);

  const flash = document.createElement('canvas');
  flash.width = canvas.width;
  flash.height = canvas.height;
  const fg = flash.getContext('2d');
  fg.drawImage(canvas, 0, 0);
  fg.globalCompositeOperation = 'source-atop';
  fg.fillStyle = '#fff';
  fg.fillRect(0, 0, flash.width, flash.height);
  return { img: canvas, flash, size, half: size / 2, generated: true };
}

function get(file, key, size, mode, baseColor, tintColor) {
  if (!file || typeof Image === 'undefined' || typeof document === 'undefined') return null;
  let sprite = baked.get(key);
  if (sprite) return sprite;
  if (failed.has(key)) return null;
  if (pending.has(key)) return null;
  // Store a pending marker so repeated frame calls do not queue work.
  pending.add(key);
  source(file).then(image => {
    try {
      if (!image) failed.add(key);
      else baked.set(key, bake(image, size, mode, baseColor, tintColor));
    } catch {
      failed.add(key);
    } finally {
      pending.delete(key);
    }
  });
  return null;
}

export function bossImage(id, mode = 'top', fallback = null, tintColor = null) {
  const art = BOSS_ART[id];
  if (!art) return fallback;
  const view = art.views[mode] ? mode : 'top';
  const tint = tintColor || art.color;
  return get(art.views[view], `${id}/${view}/${tint}`, art.size, view, art.color, tint) || fallback;
}

// Radial pieces retain one camera-neutral source. They still use the same
// loading, white-flash and procedural-fallback behavior as body images.
const PART_SIZES = { pod: 40, node: 36, shard: 18 };
export function bossPart(id, part, mode = 'top', fallback = null, tintColor = null) {
  const art = BOSS_ART[id];
  const file = art?.parts?.[part];
  if (!file) return fallback;
  const size = PART_SIZES[part];
  const baseColor = art.color;
  const tint = tintColor || baseColor;
  // These components are radial, camera-neutral assets. Keep one orientation
  // regardless of which view first requests them.
  return get(file, `${id}/part/${part}/${tint}`, size, 'top', baseColor, tint) || fallback;
}

// Measured locations for visual layers over generated camera art. Procedural
// sprites keep their original hard-coded positions to preserve their layout.
export function bossVisualPoints(id, mode, layer, fallback, sprite) {
  if (!sprite?.generated) return fallback;
  return BOSS_ART[id]?.anchors?.[mode]?.[layer] ?? fallback;
}

export function prewarmBossImages() {
  for (const [id, art] of Object.entries(BOSS_ART)) {
    for (const mode of ['top', 'side', 'chase']) {
      bossImage(id, mode);
      if (id === 'warden' || id === 'omega') {
        bossImage(id, mode, null, id === 'warden' ? '#ff3b3b' : '#ff3df2');
      }
    }
    for (const part of Object.keys(art.parts || {})) {
      bossPart(id, part);
      if (id === 'omega' && part === 'node') bossPart(id, part, 'top', null, '#ff3df2');
    }
  }
}
