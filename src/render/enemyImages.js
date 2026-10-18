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
// aura: draw each piece's baked elite rim (eliteAura) in place of the piece itself, under the same transforms.
export function drawEnemyHull(ctx, sprite, enemy, mode = 'top', k = 1, ox = 0, oy = 0, scale = enemy.elite ? 1.2 : 1, visualTime, aura = false) {
  const spr = enemySpriteForView(sprite, mode);
  const projectedSpinner = spr.generated && spr.enemyImageId === 'spinner' && mode !== 'top';
  const angle = spr.generated && (mode === 'chase' || projectedSpinner) ? 0 : (enemy.rot || 0);
  const t = Number.isFinite(enemy.t) ? enemy.t : 0;
  const size = (spr.size || sprite.size) * scale;
  const c = Math.cos(angle), s = Math.sin(angle);
  ctx.setTransform(c * k, s * k, -s * k, c * k, enemy.x * k + ox, enemy.y * k + oy);
  const piece = (img, w) => {
    if (!aura) return ctx.drawImage(img, -w / 2, -w / 2, w, w);
    const a = eliteAura(img, spr.size || sprite.size);
    ctx.drawImage(a.img, -w * a.k / 2, -w * a.k / 2, w * a.k, w * a.k);
  };
  piece(aura || !(enemy.flash > 0) ? spr.img : spr.flash, size);
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
      piece(aura || !(enemy.flash > 0) ? layer.img : layer.flash, w);
      ctx.restore();
    }
  }
}

// Elite marker: a gold rim traced around the hull's own silhouette (plus a soft outer glow), baked once per hull
// image and drawn under the enemy with a slow pulse. Pixels under ~35% alpha count as outside so baked glow halos
// don't bloat the outline.
const auras = new WeakMap();
const ELITE_PAD = 9; // logical units of margin per side for the rim and its glow
function eliteAura(img, size) {
  let a = auras.get(img);
  if (a) return a;
  const w = img.width, h = img.height;
  const res = w / size; // canvas pixels per logical unit
  const pad = Math.ceil(ELITE_PAD * res);
  const src = document.createElement('canvas');
  src.width = w; src.height = h;
  const sg = src.getContext('2d', { willReadFrequently: true });
  sg.drawImage(img, 0, 0);
  const alpha = sg.getImageData(0, 0, w, h).data;
  // Solid silhouette: everything not reachable from the border through faint pixels, so line-art hulls with glassy,
  // see-through bodies still get one outline around the outside instead of rims along every inner stroke.
  const out = new Uint8Array(w * h);
  const stack = [];
  const seed = (i) => { if (!out[i] && alpha[i * 4 + 3] <= 90) { out[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (i >= w) seed(i - w);
    if (i < w * (h - 1)) seed(i + w);
  }
  // One flat silhouette per colour: the gold body of the rim and a pale hot line on its inner edge.
  const silhouette = (r, gr, b) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cg = c.getContext('2d');
    const px = cg.createImageData(w, h);
    const d = px.data;
    for (let i = 0; i < d.length; i += 4) {
      if (out[i >> 2]) continue;
      d[i] = r; d[i + 1] = gr; d[i + 2] = b; d[i + 3] = 255;
    }
    cg.putImageData(px, 0, 0);
    return c;
  };
  const gold = silhouette(255, 200, 60);
  const pale = silhouette(255, 246, 200);
  const c = document.createElement('canvas');
  c.width = w + pad * 2; c.height = h + pad * 2;
  const g = c.getContext('2d');
  const rim = (sil, r, blur) => {
    g.shadowColor = '#ffb31a'; g.shadowBlur = blur;
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      g.drawImage(sil, pad + Math.cos(t) * r, pad + Math.sin(t) * r);
    }
    g.shadowBlur = 0;
  };
  rim(gold, 2.4 * res, 6 * res);
  rim(pale, 1 * res, 0);
  // Cut the hull itself out so only the rim and glow remain around it.
  g.globalCompositeOperation = 'destination-out';
  g.drawImage(gold, pad, pad);
  a = { img: c, k: c.width / w };
  auras.set(img, a);
  return a;
}

// The elite rim, drawn under the enemy with a slow pulse. It reuses drawEnemyHull's placement, so it hugs the hull and
// every moving part in each camera view.
export function drawEliteAura(ctx, sprite, enemy, mode = 'top', k = 1, ox = 0, oy = 0, scale = 1.2, time = 0) {
  if (!enemySpriteForView(sprite, mode)?.img) return;
  const prevA = ctx.globalAlpha;
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = prevA * (0.8 + 0.2 * Math.sin(time * 4.2 + (enemy.ph || 0)));
  drawEnemyHull(ctx, sprite, enemy, mode, k, ox, oy, scale, time, true);
  ctx.globalAlpha = prevA;
  ctx.globalCompositeOperation = prevOp;
}
