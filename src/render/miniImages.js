// Generated miniboss images use cached decoded sources and baked camera/tint
// variants. A view is available only when its body and every declared moving
// component have decoded successfully, preserving atomic procedural fallback.
import { MINI_ART } from './miniImageSpecs.js';

const loaded = new Map();
const baked = new Map();
const pending = new Set();
const failed = new Set();
const PART_SIZES = { scythe: 48, node: 50, turret: 34 };

function load(file) {
  if (!loaded.has(file)) loaded.set(file, new Promise(resolve => {
    if (typeof Image === 'undefined') return resolve(null);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = new URL(`../assets/minibosses/${file}`, import.meta.url).href;
  }));
  return loaded.get(file);
}
function hue(color) {
  const m = /^#([\da-f]{6})$/i.exec(color || '');
  if (!m) return null;
  const n = Number.parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  return ((max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
}
function tint(ctx, w, h, base, target) {
  const bh = hue(base), th = hue(target);
  if (bh === null || th === null || bh === th) return;
  const pixels = ctx.getImageData(0, 0, w, h), d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 24) continue;
    let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const hi = Math.max(r, g, b), lo = Math.min(r, g, b), delta = hi - lo, l = (hi + lo) / 2;
    if (!delta) continue;
    const s = delta / (1 - Math.abs(2 * l - 1));
    if (s < .28) continue;
    const ph = (((hi === r ? ((g - b) / delta) % 6 : hi === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60) + 360) % 360;
    let off = ph - bh; if (off > 180) off -= 360; if (off < -180) off += 360;
    if (Math.abs(off) > 42) continue;
    const h2 = ((th + off + 360) % 360) / 60, c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(h2 % 2 - 1));
    const rgb = h2 < 1 ? [c,x,0] : h2 < 2 ? [x,c,0] : h2 < 3 ? [0,c,x] : h2 < 4 ? [0,x,c] : h2 < 5 ? [x,0,c] : [c,0,x];
    d[i] = Math.round((rgb[0] + l - c / 2) * 255); d[i + 1] = Math.round((rgb[1] + l - c / 2) * 255); d[i + 2] = Math.round((rgb[2] + l - c / 2) * 255);
  }
  ctx.putImageData(pixels, 0, 0);
}
function bake(image, size, mode, base, color) {
  const res = 2, canvas = document.createElement('canvas'); canvas.width = canvas.height = Math.ceil(size * res);
  const ctx = canvas.getContext('2d'); ctx.scale(res, res); ctx.translate(size / 2, size / 2);
  if (mode === 'side') ctx.rotate(-Math.PI / 2);
  ctx.drawImage(image, -size / 2, -size / 2, size, size); tint(ctx, canvas.width, canvas.height, base, color);
  const flash = document.createElement('canvas'); flash.width = canvas.width; flash.height = canvas.height;
  const fg = flash.getContext('2d'); fg.drawImage(canvas, 0, 0); fg.globalCompositeOperation = 'source-atop'; fg.fillStyle = '#fff'; fg.fillRect(0, 0, flash.width, flash.height);
  return { img: canvas, flash, size, half: size / 2, generated: true };
}
function bakePart(image, name, base, color) {
  const size = PART_SIZES[name], canvas = document.createElement('canvas'); canvas.width = canvas.height = size * 2;
  const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); tint(ctx, canvas.width, canvas.height, base, color);
  const flash = document.createElement('canvas'); flash.width = canvas.width; flash.height = canvas.height;
  const fg = flash.getContext('2d'); fg.drawImage(canvas, 0, 0); fg.globalCompositeOperation = 'source-atop'; fg.fillStyle = '#fff'; fg.fillRect(0, 0, flash.width, flash.height);
  return { img: canvas, flash, size, half: size / 2, generated: true };
}
function getBody(id, mode, color) {
  const art = MINI_ART[id], view = art?.views[mode] ? mode : 'top';
  if (!art || typeof document === 'undefined') return null;
  const key = `${id}/${view}/${color}`;
  if (baked.has(key)) return baked.get(key);
  if (!pending.has(key) && !failed.has(key)) {
    pending.add(key);
    const files = [art.views[view], ...Object.values(art.parts || {})];
    Promise.all(files.map(load)).then(images => {
      if (images.some(x => !x)) { failed.add(key); return; }
      const body = bake(images[0], art.size, view, art.color, color);
      const parts = {};
      for (const [i, name] of Object.keys(art.parts || {}).entries()) parts[name] = bakePart(images[i + 1], name, art.color, color);
      // Publish the bundle only after every selected image has baked cleanly.
      baked.set(`${key}/parts`, parts);
      baked.set(key, body);
    }).catch(() => failed.add(key)).finally(() => pending.delete(key));
  }
  return null;
}
export function miniImage(id, mode, fallback, color = null) {
  const art = MINI_ART[id]; if (!art) return fallback;
  const tintColor = color || art.color, sprite = getBody(id, mode, tintColor);
  return sprite || fallback;
}
export function miniPart(id, name, mode, fallback, color = null) {
  const art = MINI_ART[id]; if (!art?.parts?.[name]) return fallback;
  const tintColor = color || art.color, view = art.views[mode] ? mode : 'top';
  getBody(id, view, tintColor);
  return baked.get(`${id}/${view}/${tintColor}/parts`)?.[name] || fallback;
}
export function miniVisualPoints(id, mode, layer, fallback, sprite) {
  if (!sprite?.generated) return fallback;
  return MINI_ART[id]?.anchors?.[mode]?.[layer] ?? fallback;
}
export function prewarmMiniImages() {
  for (const [id, art] of Object.entries(MINI_ART)) {
    for (const mode of ['top', 'side', 'chase']) {
      miniImage(id, mode, null, art.color);
      miniImage(id, mode, null, art.phaseColor);
    }
  }
}
