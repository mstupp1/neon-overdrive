// Optional decoded layer sets. A theme is published only after all five files decode;
// render paths never create Image objects or wait for I/O.
const THEMES = ['genesis', 'crimson', 'cyclone', 'void'];
const KEYS = ['gate', 'skylineFar', 'skylineNear', 'deckFar', 'deckNear'];
const GRID_ROWS = { genesis: 16, crimson: 14, cyclone: 16, void: 9 };
const HORIZON = [
  { key: 'gate', w: 360, h: 240, sway: 3, alpha: 0.72 },
  { key: 'skylineFar', w: 500, h: 140, sway: 6, alpha: 0.66 },
  { key: 'skylineNear', w: 510, h: 90, sway: 9, alpha: 0.78 },
];
const DECK = [
  { key: 'deckFar', alpha: 0.42, repeats: 3, phase: 0 },
  { key: 'deckNear', alpha: 0.58, repeats: 2, phase: 0.35 },
];
const MAX_STRIPS = 160;
const sets = Object.fromEntries(THEMES.map((theme) => [theme, { images: null, loading: null, failed: false, enabled: true }]));
// Zone variants only replace the two near scenery bands. Keep their decoded
// pairs and merged sets cached so render calls never allocate layer objects.
const ZONES = {
  crimson: ['spore-fields', 'hive-trench'],
  void: ['shattered-orbit'],
};
const zoneSets = new Map();
const selectedZones = Object.fromEntries(THEMES.map((theme) => [theme, null]));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = async () => {
      try { if (image.decode) await image.decode(); resolve(image); }
      catch (error) { reject(error); }
    };
    image.onerror = () => reject(new Error(`Could not load background layer: ${src}`));
    image.src = src;
  });
}

export function loadThemeLayers(theme) {
  const set = sets[theme];
  if (!set) return Promise.resolve(null);
  if (set.images) return Promise.resolve(set.images);
  if (set.loading) return set.loading;
  if (set.failed) return Promise.resolve(null);
  set.loading = Promise.all(KEYS.map(async (key) => {
    const file = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    const src = new URL(`../assets/backgrounds/${theme}/${file}-v1.png`, import.meta.url).href;
    return [key, await loadImage(src)];
  })).then((entries) => { set.images = Object.fromEntries(entries); return set.images; })
    .catch(() => { set.failed = true; return null; })
    .finally(() => { set.loading = null; });
  return set.loading;
}

const zoneKey = (theme, zone) => `${theme}/${zone}`;

export function loadZoneLayers(theme, zone) {
  if (!ZONES[theme]?.includes(zone)) return Promise.resolve(null);
  const key = zoneKey(theme, zone);
  let zoneSet = zoneSets.get(key);
  if (!zoneSet) {
    zoneSet = { images: null, merged: null, loading: null, failed: false };
    zoneSets.set(key, zoneSet);
  }
  if (zoneSet.merged) return Promise.resolve(zoneSet.merged);
  if (zoneSet.loading) return zoneSet.loading;
  if (zoneSet.failed) return Promise.resolve(null);
  zoneSet.loading = Promise.all([
    loadThemeLayers(theme),
    ...['skyline-near', 'deck-near'].map((file) => loadImage(
      new URL(`../assets/backgrounds/${theme}/${zone}/${file}-v1.png`, import.meta.url).href,
    )),
  ]).then(([baseImages, skylineNear, deckNear]) => {
    if (!baseImages) return null;
    zoneSet.images = { skylineNear, deckNear };
    zoneSet.merged = { ...baseImages, skylineNear, deckNear };
    return zoneSet.merged;
  }).catch(() => { zoneSet.failed = true; return null; })
    .finally(() => { zoneSet.loading = null; });
  return zoneSet.loading;
}

export function setThemeZone(theme, zone = null) {
  for (const id of THEMES) selectedZones[id] = null;
  if (!ZONES[theme]?.includes(zone)) return;
  selectedZones[theme] = zone;
  loadZoneLayers(theme, zone);
}

export const zoneLayersReady = (theme, zone) => !!zoneSets.get(zoneKey(theme, zone))?.merged;

// Historical Genesis exports stay available to existing callers and previews.
export const loadGenesisLayers = () => loadThemeLayers('genesis');
export const genesisLayersReady = () => sets.genesis.images !== null;
export const setGenesisLayersEnabled = (on) => { sets.genesis.enabled = !!on; };
export const themeLayersReady = (theme) => !!sets[theme]?.images;
export const themeLayerImages = (theme) => {
  const zone = selectedZones[theme];
  return zoneSets.get(zoneKey(theme, zone))?.merged || sets[theme]?.images || null;
};
export const setThemeLayersEnabled = (theme, on) => { if (sets[theme]) sets[theme].enabled = !!on; };

function drawLandmark(ctx, image, x, y, width, height, theme, t) {
  ctx.save();
  if (theme === 'cyclone') {
    const cx = x + width * 0.5;
    const cy = y + height * 0.5;
    ctx.translate(cx, cy);
    ctx.rotate((t * 0.025) % (Math.PI * 2));
    ctx.translate(-cx, -cy);
  }
  ctx.drawImage(image, x, y, width, height);
  ctx.restore();
}

export function drawThemeHorizon(ctx, theme, W, horizon, t) {
  const set = sets[theme];
  const images = themeLayerImages(theme);
  if (!set?.enabled || !images) return false;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  for (const layer of HORIZON) {
    const image = images[layer.key];
    // Fit the gate inside its authored frame without stretching it. The
    // skyline bands keep their existing wide framing and deck/grid alignment.
    let width = layer.w;
    let height = layer.h;
    if (layer.key === 'gate' && image?.width && image?.height) {
      const scale = Math.min(layer.w / image.width, layer.h / image.height);
      width = image.width * scale;
      height = image.height * scale;
    }
    const x = (W - width) * 0.5 + Math.sin(t * 0.05) * layer.sway;
    let y = horizon - height + 6;
    // Match the original per-system silhouettes: the Genesis gate sits high,
    // while the planet/storm/void landmarks are framed lower in the sky.
    if (layer.key === 'gate') {
      if (theme === 'crimson' || theme === 'void') y = 6;
      else if (theme === 'cyclone') y = -10;
    }
    y += Math.sin(t * 0.035) * layer.sway * 0.6;
    ctx.globalAlpha = layer.alpha;
    // Celestial landmarks rise behind the skyline, never over the combat floor.
    // Mask only the landmark; the two scenery bands keep their existing framing.
    const masked = layer.key === 'gate' && theme !== 'genesis';
    if (masked) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, -height, W, horizon + height);
      ctx.clip();
    }
    if (layer.key === 'gate') {
      // Clip in screen space first, then turn the storm around its hidden eye.
      drawLandmark(ctx, image, x, y, width, height, theme, t);
    } else {
      ctx.drawImage(image, x, y, width, height);
    }
    if (masked) ctx.restore();
  }
  ctx.restore();
  return true;
}
export const drawGenesisHorizon = (ctx, W, horizon, t) => drawThemeHorizon(ctx, 'genesis', W, horizon, t);

// Pursuit has only a shallow sky above the reciprocal floor. Reframe the art into
// that band: preserve the landmark's source aspect, scale it to the available sky,
// and clip every horizon layer at the floor boundary.
export function drawThemeChaseHorizon(ctx, theme, W, horizon, t) {
  const set = sets[theme];
  const images = themeLayerImages(theme);
  if (!set?.enabled || !images || W <= 0 || horizon <= 0) return false;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath(); ctx.rect(0, 0, W, horizon); ctx.clip();
  const gate = images.gate;
  const gateH = Math.min(horizon * 0.95, W * gate.height / gate.width);
  const gateW = gateH * gate.width / gate.height;
  const gateX = (W - gateW) * 0.5 + Math.sin(t * 0.025) * W * 0.025;
  ctx.globalAlpha = 0.58;
  drawLandmark(ctx, gate, gateX, horizon - gateH, gateW, gateH, theme, t);
  for (const [key, targetFrac, alpha, speed] of [
    ['skylineFar', 0.48, 0.48, 0.012],
    ['skylineNear', 0.3, 0.62, 0.03],
  ]) {
    const image = images[key];
    const height = Math.min(horizon * targetFrac, horizon - 1);
    const width = height * image.width / image.height;
    const offset = ((t * speed * width) % width + width) % width;
    ctx.globalAlpha = alpha;
    for (let x = -width - offset; x < W + width; x += width - 2) {
      ctx.drawImage(image, x, horizon - height, width, height);
    }
  }
  ctx.restore();
  return true;
}

export function drawThemeDeck(ctx, theme, W, H, horizon, scroll = 0) {
  const set = sets[theme];
  const images = themeLayerImages(theme);
  if (!set?.enabled || !images) return false;
  const depth = H - horizon;
  if (depth <= 0) return true;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false;
  ctx.beginPath(); ctx.rect(0, horizon, W, depth); ctx.clip();
  const strips = Math.min(MAX_STRIPS, Math.ceil(depth / 4));
  const travel = (scroll / GRID_ROWS[theme]) % 1;
  for (const layer of DECK) {
    const image = images[layer.key];
    for (let strip = 0; strip < strips; strip++) {
      let f = Math.sqrt(strip / strips);
      const end = Math.sqrt((strip + 1) / strips);
      while (f < end - 1e-9) {
        let v = (((f - travel) * layer.repeats + layer.phase) % 1 + 1) % 1;
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
export const drawGenesisDeck = (ctx, W, H, horizon, scroll = 0) => drawThemeDeck(ctx, 'genesis', W, H, horizon, scroll);

// Side view: transparent skyline bands repeat with hidden-edge overlaps; the gate drifts
// at a slower rate and is deliberately placed outside the repeat cycle.
export function drawThemeSideHorizon(ctx, theme, W, H, horizon, scroll = 0, t = 0) {
  const set = sets[theme];
  const images = themeLayerImages(theme);
  if (!set?.enabled || !images) return false;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  // Keep expanded parallax scenery above the reciprocal side-view floor.
  ctx.beginPath(); ctx.rect(0, 0, W, horizon); ctx.clip();
  const gate = images.gate;
  const baseGateWidth = 260;
  const gateWidth = 390;
  const gateHeight = gateWidth * gate.height / gate.width;
  ctx.globalAlpha = 0.34;
  const gateX = W * 0.46 + Math.sin(scroll * 0.00011) * W * 0.08 - (gateWidth - baseGateWidth) * 0.5;
  drawLandmark(ctx, gate, gateX,
    horizon - gateHeight, gateWidth, gateHeight, theme, t);
  for (const [key, width, height, baseWidth, speed, alpha] of [
    ['skylineFar', 750, 210, 500, 0.012, 0.46], ['skylineNear', 765, 135, 510, 0.03, 0.56],
  ]) {
    const image = images[key];
    // scroll is the side view's logical parallax distance (bg.scroll * 140).
    const offset = ((scroll * speed * baseWidth / 140) % width + width) % width;
    ctx.globalAlpha = alpha;
    for (let x = -width - offset; x < W + width; x += width - 2) {
      ctx.drawImage(image, x, horizon - height, width, height);
    }
  }
  ctx.restore();
  return true;
}

export function drawThemeSideDeck(ctx, theme, W, H, horizon, scroll = 0) {
  const set = sets[theme];
  const images = themeLayerImages(theme);
  if (!set?.enabled || !images) return false;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath(); ctx.rect(0, horizon, W, H - horizon); ctx.clip();
  for (const [key, alpha, scale, speed] of [['deckFar', 0.22, 0.42, 0.12], ['deckNear', 0.3, 0.55, 0.3]]) {
    const image = images[key];
    const w = W * scale;
    const h = w * image.height / image.width;
    const phase = ((scroll * speed) % w + w) % w;
    ctx.globalAlpha = alpha;
    for (let x = -w - phase; x < W + w; x += w - 1) ctx.drawImage(image, x, horizon + 8, w, h);
  }
  ctx.restore();
  return true;
}

// Project one repeating floor texture into the reciprocal chase plane. Source rows
// follow virtual depth and travel, so the art converges with the grid instead of
// being stretched as a screen-space trapezoid.
export function drawChaseDeckLayer(ctx, image, W, H, projection, travel = 0, options = {}) {
  const { hy, A, Yc, f, CW, CH } = projection || {};
  // cx: the virtual x the camera is centred on (the chase camera slides after the jet); the lane centre by default.
  const pan = Number.isFinite(projection?.cx) ? CW / 2 - projection.cx : 0;
  const alpha = options.alpha ?? 0.42;
  const repeats = options.repeats ?? 2;
  const maxStrips = Math.min(160, Math.max(1, Math.floor(options.maxStrips ?? 160)));
  if (!image || !image.width || !image.height || ![W, H, hy, A, Yc, f, CW, CH, travel, alpha, repeats].every(Number.isFinite)
    || A <= 0 || Yc <= 0 || f <= 0 || CW <= 0 || CH <= 0 || repeats <= 0 || W <= 0 || H <= 0) return false;

  const yFloor = (v) => hy + A / (Yc - v);
  const inverse = (y) => Yc - A / (y - hy);
  // Start at the visible floor horizon and stop at the screen bottom / field edge.
  const v0 = Math.max(0, inverse(hy + 1));
  const v1 = Math.min(CH + 200, inverse(H));
  if (!Number.isFinite(v0) || !Number.isFinite(v1) || v1 <= v0 || Yc <= v1) return true;

  const tileDepth = CH / repeats;
  const sy0 = yFloor(v0);
  const sy1 = yFloor(v1);
  const screenBands = Math.max(1, Math.min(128, Math.ceil((sy1 - sy0) / 4)));
  const screenStep = (sy1 - sy0) / screenBands;
  const phase = ((travel % tileDepth) + tileDepth) % tileDepth;
  let strips = 0;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false;
  let sy = sy0;
  while (sy < sy1 - 1e-7 && strips < maxStrips) {
    const v = clamp(inverse(sy), v0, v1);
    let u = ((v - phase) % tileDepth + tileDepth) % tileDepth;
    let toWrap = tileDepth - u;
    if (toWrap < 1e-7) {
      // Floating point modulo can leave a source row at height - epsilon. Snap
      // the seam cleanly to row zero instead of drawing a near-empty slice.
      u = 0;
      toWrap = tileDepth;
    }
    const wrapV = v + toWrap;
    const wrapY = wrapV < v1 && wrapV > v ? yFloor(wrapV) : sy1;
    const nextSy = Math.min(sy1, sy + screenStep, wrapY);
    if (!(nextSy > sy)) break;
    const nextV = clamp(inverse(nextSy), v, v1);
    const vm = clamp(inverse((sy + nextSy) * 0.5), v, nextV);
    const width = CW * f / (Yc - vm);
    const srcY = (u / tileDepth) * image.height;
    const srcH = Math.min(((nextV - v) / tileDepth) * image.height, image.height - srcY);
    const fade = 0.2 + 0.8 * Math.min(1, Math.max(0, vm / (CH * 0.35)));
    if ([sy, nextSy, width, srcY, srcH].every(Number.isFinite) && nextSy > sy && width > 0 && srcH > 0) {
      ctx.globalAlpha = alpha * fade;
      ctx.drawImage(image, 0, srcY, image.width, srcH, W * 0.5 + (pan / CW - 0.5) * width, sy, width, nextSy - sy + 0.4);
      strips++;
    }
    sy = nextSy;
  }
  ctx.restore();
  return true;
}
