// Optional image layers for the Genesis top-down scene. Loading is started by setTheme,
// never by draw(), and the set is committed only after every image has decoded.

const ROOT = '../assets/backgrounds/genesis/';
const SOURCES = {
  gate: new URL(`${ROOT}gate-v1.png`, import.meta.url).href,
  skylineFar: new URL(`${ROOT}skyline-far-v1.png`, import.meta.url).href,
  skylineNear: new URL(`${ROOT}skyline-near-v1.png`, import.meta.url).href,
  deckFar: new URL(`${ROOT}deck-far-v1.png`, import.meta.url).href,
  deckNear: new URL(`${ROOT}deck-near-v1.png`, import.meta.url).href,
};

const HORIZON = [
  { key: 'gate', w: 360, h: 240, sway: 3, alpha: 0.72 },
  { key: 'skylineFar', w: 500, h: 140, sway: 6, alpha: 0.66 },
  { key: 'skylineNear', w: 510, h: 90, sway: 9, alpha: 0.78 },
];
const DECK = [
  { key: 'deckFar', alpha: 0.42, repeats: 3, phase: 0 },
  { key: 'deckNear', alpha: 0.58, repeats: 2, phase: 0.35 },
];
// Genesis grid rows use y = horizon + depth * f² and advance f by scroll / 16.
// Its columns interpolate from 6% width at the horizon to full width at the bottom.
const GRID_ROWS = 16;
const MAX_STRIPS = 160;

let images = null;
let loading = null;
let failed = false;
let enabled = true;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = async () => {
      try {
        if (image.decode) await image.decode();
        resolve(image);
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error(`Could not load Genesis background: ${src}`));
    image.src = src;
  });
}

export function loadGenesisLayers() {
  if (images) return Promise.resolve(images);
  if (loading) return loading;
  if (failed) return Promise.resolve(null);
  loading = Promise.all(Object.entries(SOURCES).map(async ([key, src]) => [key, await loadImage(src)]))
    .then((entries) => {
      images = Object.fromEntries(entries);
      return images;
    })
    .catch(() => {
      failed = true;
      return null;
    })
    .finally(() => { loading = null; });
  return loading;
}

export function genesisLayersReady() {
  return images !== null;
}

// Local preview hook: turn the generated layer draw path off to compare the procedural fallback.
export function setGenesisLayersEnabled(on) {
  enabled = !!on;
}

// Horizon sprites are transparent, bottom-aligned artwork whose common baseline meets the grid.
export function drawGenesisHorizon(ctx, W, horizon, t) {
  if (!enabled || !images) return false;
  ctx.save();
  for (const layer of HORIZON) {
    const x = (W - layer.w) * 0.5 + Math.sin(t * 0.05) * layer.sway;
    const y = horizon - layer.h + 6 + Math.sin(t * 0.035) * layer.sway * 0.6;
    ctx.globalAlpha = layer.alpha;
    ctx.drawImage(images[layer.key], x, y, layer.w, layer.h);
  }
  ctx.restore();
  return true;
}

// Project the two overhead textures onto the grid plane in thin horizontal strips.
// Advancing the shared grid phase makes details grow and travel outward toward the
// ship instead of sliding down as fixed-size screen-space wallpaper. Different repeat
// counts change footprint size, not ground speed: both layers belong to the same floor.
export function drawGenesisDeck(ctx, W, H, horizon, scroll = 0) {
  if (!enabled || !images) return false;
  const depth = H - horizon;
  if (depth <= 0) return true;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.beginPath();
  ctx.rect(0, horizon, W, depth);
  ctx.clip();
  const strips = Math.min(MAX_STRIPS, Math.ceil(depth / 4));
  // Wrap before multiplying so long sessions retain subpixel precision.
  const travel = (scroll / GRID_ROWS) % 1;
  for (let index = 0; index < DECK.length; index++) {
    const layer = DECK[index];
    const image = images[layer.key];
    for (let strip = 0; strip < strips; strip++) {
      let f = Math.sqrt(strip / strips);
      const end = Math.sqrt((strip + 1) / strips);
      // Split at texture wraps; never stretch the last source row across a seam.
      while (f < end - 1e-9) {
        let v = (((f - travel) * layer.repeats + layer.phase) % 1 + 1) % 1;
        // At a wrap, rounding can produce 1 - epsilon instead of zero. The tiny
        // remaining distance may round back to f and stall this loop. Snap that
        // boundary to the next tile before calculating the next interval.
        if (v > 1 - 1e-8) v = 0;
        const next = Math.min(end, f + (1 - v) / layer.repeats);
        const mid = (f + next) * 0.5;
        const width = W * (0.06 + 0.94 * mid * mid);
        const y = horizon + depth * f * f;
        const bottom = horizon + depth * next * next;
        ctx.globalAlpha = layer.alpha * (0.2 + 0.8 * mid);
        ctx.drawImage(image, 0, v * image.height, image.width,
          Math.min(image.height * (next - f) * layer.repeats, image.height * (1 - v)),
          (W - width) * 0.5, y, width, bottom - y + 0.35);
        f = next;
      }
    }
  }
  ctx.restore();
  return true;
}
