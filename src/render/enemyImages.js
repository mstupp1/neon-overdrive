// Generated enemy hulls are decoded and baked once. Each camera view switches
// only after its base image and every declared moving part have loaded.
import { ENEMY_IMAGE_SPECS } from './enemyImageSpecs.js';

export { ENEMY_IMAGE_SPECS };

const MODES = ['top', 'side', 'chase'];
const images = new Map();
const box = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * 3));
  c.height = Math.max(1, Math.ceil(h * 3));
  return c;
};

function load(src) {
  if (!images.has(src)) images.set(src, new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = new URL(src, import.meta.url).href;
  }));
  return images.get(src);
}

function bake(image, part, fallbackSize, mode) {
  const width = part.width || fallbackSize;
  const height = part.height || fallbackSize;
  const canvas = box(fallbackSize, fallbackSize);
  const g = canvas.getContext('2d');
  g.scale(3, 3);
  if (mode === 'side') {
    g.translate(fallbackSize / 2, fallbackSize / 2);
    g.rotate(-Math.PI / 2); // compensate for stageview's clockwise world turn
    g.translate(-fallbackSize / 2, -fallbackSize / 2);
  }
  const rawAnchor = part.anchor || [0.5, 0.5];
  const anchor = rawAnchor.some(value => Math.abs(value) > 1)
    ? [rawAnchor[0] / image.naturalWidth, rawAnchor[1] / image.naturalHeight]
    : rawAnchor;
  g.drawImage(image, fallbackSize / 2 - width * anchor[0], fallbackSize / 2 - height * anchor[1], width, height);
  const flash = box(fallbackSize, fallbackSize);
  const f = flash.getContext('2d');
  f.drawImage(canvas, 0, 0);
  f.globalCompositeOperation = 'source-atop';
  f.fillStyle = 'rgba(255,255,255,0.92)';
  f.fillRect(0, 0, flash.width, flash.height);
  return { img: canvas, flash, size: fallbackSize, half: fallbackSize / 2 };
}

async function bakeView(view, fallbackSize) {
  const baseImage = await load(view.src);
  if (!baseImage) return null;
  const base = bake(baseImage, view, fallbackSize, view.mode);
  const layers = {};
  for (const [name, part] of Object.entries(view.layers || {})) {
    const image = await load(part.src);
    if (!image) return null;
    const sourcePivot = part.pivot || [0.5, 0.5];
    const pivot = view.mode === 'side' ? [sourcePivot[1], 1 - sourcePivot[0]] : sourcePivot;
    layers[name] = { ...bake(image, part, fallbackSize, view.mode), pivot, anchor: part.anchor || [0.5, 0.5], spinAspect: part.spinAspect };
  }
  return { ...base, layers, layerList: Object.entries(layers) };
}

export function withEnemyImages(id, fallback) {
  const spec = ENEMY_IMAGE_SPECS[id];
  if (!spec) return fallback;
  const sprite = { ...fallback, procedural: fallback, views: {}, enemyImageId: id };
  // Each camera swaps atomically: its base and every declared moving part must
  // load and bake before any of that camera's generated layers are exposed.
  sprite.ready = Promise.all(MODES.map(async mode => {
    const view = spec.views?.[mode];
    if (!view) return null;
    let baked;
    try { baked = await bakeView({ ...view, mode }, fallback.size); }
    catch { return null; } // a failed camera must not short-circuit the other loads
    if (!baked) return null;
    baked.generated = true;
    baked.enemyImageId = id;
    sprite.views[mode] = baked;
    if (mode === 'top') Object.assign(sprite, baked);
    return [mode, baked];
  })).then(results => {
    sprite.generated = results.every(result => result && result[1]);
    return sprite;
  }).catch(() => sprite);
  return sprite;
}

export function enemySpriteForView(sprite, mode = 'top') {
  if (!sprite?.enemyImageId) return sprite;
  return sprite.views?.[mode] || sprite.procedural || sprite;
}

// Draw the base image and its separately animated generated details. Angles
// stay in virtual-world coordinates; stageview applies the side quarter-turn.
export function drawEnemyHull(ctx, sprite, enemy, mode = 'top', k = 1, ox = 0, oy = 0, scale = enemy.elite ? 1.2 : 1, visualTime) {
  const spr = enemySpriteForView(sprite, mode);
  const projectedSpinner = spr.generated && spr.enemyImageId === 'spinner' && mode !== 'top';
  const angle = spr.generated && (mode === 'chase' || projectedSpinner) ? 0 : (enemy.rot || 0);
  const t = Number.isFinite(enemy.t) ? enemy.t : 0;
  const size = (spr.size || sprite.size) * scale;
  const c = Math.cos(angle), s = Math.sin(angle);
  ctx.setTransform(c * k, s * k, -s * k, c * k, enemy.x * k + ox, enemy.y * k + oy);
  const base = enemy.flash > 0 ? spr.flash : spr.img;
  ctx.drawImage(base, -size / 2, -size / 2, size, size);
  if (spr.layers) {
    for (const [name, layer] of (spr.layerList || Object.entries(spr.layers))) {
      let a = 0;
      // The whole sprite already follows the spinner's existing rotation. Only
      // offset the top-view core gently; spinning a foreshortened side/front
      // image in the canvas plane would turn its perspective on its side.
      if (name === 'core' && mode === 'top') a = -t * 0.35;
      const px = (layer.pivot[0] - 0.5) * size;
      const py = (layer.pivot[1] - 0.5) * size;
      ctx.save();
      ctx.translate(px, py);
      if (name === 'rotor' && projectedSpinner && layer.spinAspect) {
        // Rotate in the rotor's own plane, retaining its authored foreshortening.
        const sx = mode === 'side' ? layer.spinAspect : 1;
        const sy = mode === 'chase' ? layer.spinAspect : 1;
        ctx.scale(sx, sy); ctx.rotate(enemy.rot || 0); ctx.scale(1 / sx, 1 / sy);
      } else ctx.rotate(a);
      ctx.translate(-px, -py);
      const w = size;
      const sinceShot = (visualTime ?? enemy.visualTime ?? t) - (Number.isFinite(enemy.lastShotAt) ? enemy.lastShotAt : -1);
      const recoil = name === 'carriage' && sinceShot >= 0 && sinceShot < 0.08 ? -3 * (1 - sinceShot / 0.08) : 0;
      const opening = 4 * scale * (enemy.carrierDoors || 0);
      // Side baking puts the enemy nose back on virtual +y. The stage's turn
      // then maps backwards recoil to screen-right and bay travel to vertical.
      if (name === 'doorLeft') ctx.translate(-opening, 0);
      else if (name === 'doorRight') ctx.translate(opening, 0);
      ctx.translate(0, recoil * scale);
      ctx.drawImage(enemy.flash > 0 ? layer.flash : layer.img, -w / 2, -w / 2, w, w);
      ctx.restore();
    }
  }
}
