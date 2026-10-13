// Optional sector-overworld art. Each file is cached independently so one bad
// export never hides the other layers or leaves art from the previous system.
const THEMES = ['genesis', 'crimson', 'cyclone', 'void'];
const LAYERS = ['gate', 'overworld-far', 'overworld-near', 'obstacle-1', 'obstacle-2', 'obstacle-3', 'obstacle-4'];
const cache = Object.fromEntries(THEMES.map((theme) => [theme, Object.fromEntries(LAYERS.map((key) => [key, { image: null, loading: null, failed: false }]))]));
const enabled = Object.fromEntries(THEMES.map((theme) => [theme, true]));
const placements = new WeakMap();

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function loadImage(theme, key) {
  const slot = cache[theme]?.[key];
  if (!slot || slot.image || slot.failed) return Promise.resolve(slot?.image || null);
  if (slot.loading) return slot.loading;
  const file = key === 'gate' ? 'gate-v1.png' : `${key}-v1.png`;
  const src = new URL(`../assets/backgrounds/${theme}/${file}`, import.meta.url).href;
  slot.loading = new Promise((resolve) => {
    const image = new Image();
    image.onload = async () => {
      try { if (image.decode) await image.decode(); slot.image = image; resolve(image); }
      catch { slot.failed = true; resolve(null); }
    };
    image.onerror = () => { slot.failed = true; resolve(null); };
    image.src = src;
  }).finally(() => { slot.loading = null; });
  return slot.loading;
}

export function loadOverworldLayers(theme) {
  if (!cache[theme]) return Promise.resolve(null);
  return Promise.all(LAYERS.map((key) => loadImage(theme, key))).then(() => getOverworldLayerImages(theme));
}

export function getOverworldLayerImages(theme) {
  if (!cache[theme]) return null;
  return Object.fromEntries(LAYERS.map((key) => [key, cache[theme][key].image]));
}

export function overworldLayersReady(theme) {
  return !!cache[theme] && LAYERS.every((key) => !!cache[theme][key].image);
}

export function setOverworldLayersEnabled(theme, on) {
  if (theme in enabled) enabled[theme] = !!on;
}

function cosmeticPlacement(ow, layer) {
  const key = `${ow.seed}|${ow.leg}|${ow.W}|${ow.H}|${layer}`;
  let entry = placements.get(ow);
  if (!entry || entry.signature !== `${ow.seed}|${ow.leg}|${ow.W}|${ow.H}`) {
    entry = { signature: `${ow.seed}|${ow.leg}|${ow.W}|${ow.H}`, layers: new Map() };
    placements.set(ow, entry);
  }
  if (entry.layers.has(layer)) return entry.layers.get(layer);
  const rnd = (() => {
    let a = hashString(key) || 1;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  })();
  const items = [];
  const factor = layer === 'overworld-far' ? 0.22 : 0.45;
  // A fixed decorative point is seen along the route only when it lies in the
  // camera's parallax travel band (factor * zone size), plus viewport padding.
  for (let i = 0; i < 48; i++) items.push({
    x: rnd() * (factor * ow.W + 1000) - 500,
    y: rnd() * (factor * ow.H + 1000) - 500,
    s: 120 + rnd() * 240, a: 0.15 + rnd() * 0.22,
  });
  entry.layers.set(layer, items);
  return items;
}

// Called under the overworld world transform. Bounds are {x0,y0,x1,y1} in world units.
export function drawOverworldBackground(ctx, theme, ow, viewBounds, zoom, quality = 1) {
  const images = cache[theme];
  if (!images || !enabled[theme] || !ow || !viewBounds) return false;
  const cam = ow.cam;
  const low = quality <= 0.75;
  let drawn = false;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  const gate = images.gate.image;
  if (gate) {
    const w = Math.min(1000, ow.W * 0.58);
    const h = w * gate.height / gate.width;
    // Keep the distant landmark near the camera's screen origin while its
    // apparent drift remains only eight percent of camera movement.
    const worldX = ow.W * 0.5 * 0.08 - w * 0.5;
    const worldY = ow.H * 0.13 * 0.08 - h * 0.5;
    const x = worldX + cam.x * 0.92;
    const y = worldY + cam.y * 0.92;
    if (x + w >= viewBounds.x0 && x <= viewBounds.x1 && y + h >= viewBounds.y0 && y <= viewBounds.y1) {
      ctx.globalAlpha = 0.34;
      ctx.drawImage(gate, x, y, w, h);
      drawn = true;
    }
  }
  const max = low ? 12 : 24;
  let count = 0;
  const layers = [
    { key: 'overworld-far', factor: 0.22, budget: low ? 6 : 12 },
    { key: 'overworld-near', factor: 0.45, budget: low ? 6 : 12 },
  ];
  for (const layer of layers) {
    const image = images[layer.key].image;
    if (!image) continue;
    const items = cosmeticPlacement(ow, layer.key);
    let layerCount = 0;
    for (const p of items) {
      const size = p.s * (layer.key === 'overworld-far' ? 1.45 : 1);
      const x = p.x + cam.x * (1 - layer.factor);
      const y = p.y + cam.y * (1 - layer.factor);
      const half = size * 0.5;
      if (x + half < viewBounds.x0 || x - half > viewBounds.x1 || y + half < viewBounds.y0 || y - half > viewBounds.y1) continue;
      ctx.globalAlpha = p.a * (layer.key === 'overworld-far' ? 0.65 : 1);
      ctx.drawImage(image, x - half, y - half, size, size);
      drawn = true;
      count++;
      if (++layerCount >= layer.budget || count >= max) break;
    }
  }
  ctx.restore();
  return drawn;
}

export function obstacleVariant(rock, index = 0) {
  return hashString(`${Math.round(rock.x * 10)}:${Math.round(rock.y * 10)}:${index}`) % 4;
}

export function drawOverworldRock(ctx, theme, rock, variant, angle = 0) {
  if (!enabled[theme]) return false;
  const image = cache[theme]?.[`obstacle-${(variant % 4 + 4) % 4 + 1}`]?.image;
  if (!image) return false;
  // Export padding and the generated silhouette's margin leave about 90% of
  // the image occupied; this fits the visible body to the .92r collision radius.
  const size = rock.r * 2.05;
  ctx.save();
  ctx.translate(rock.x, rock.y);
  ctx.rotate(angle);
  ctx.drawImage(image, -size / 2, -size / 2, size, size);
  ctx.restore();
  return true;
}
