import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const moduleUrl = new URL('../src/render/backgroundLayers.js', import.meta.url);

class MockImage {
  static instances = [];

  constructor() {
    this.width = 360;
    this.height = 360;
    this.onload = null;
    this.onerror = null;
    this._src = '';
    this.decodeError = null;
    MockImage.instances.push(this);
  }

  set src(value) { this._src = value; }
  get src() { return this._src; }
  decode() { return this.decodeError ? Promise.reject(this.decodeError) : Promise.resolve(); }
  succeed() { this.onload?.(); }
  fail() { this.onerror?.(); }
}

function context() {
  return {
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    globalCompositeOperation: 'source-over',
    calls: [],
    alphaAtDraw: [],
    stack: [],
    clipCalls: [],
    save() { this.stack.push([this.globalAlpha, this.imageSmoothingEnabled, this.globalCompositeOperation, this.clipRect, this.clipped]); },
    restore() { [this.globalAlpha, this.imageSmoothingEnabled, this.globalCompositeOperation, this.clipRect, this.clipped] = this.stack.pop(); },
    beginPath() {},
    translate() {},
    rotate() {},
    rect(...args) { this.clipRect = args; },
    clip() { this.clipped = true; this.clipCalls.push(this.clipRect); },
    drawImage(...args) { this.calls.push(args); this.alphaAtDraw.push(this.globalAlpha); },
  };
}

test('Genesis deck projects with shared grid phase, bounded source strips, and restored canvas state', async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?success`);
  const pending = layers.loadGenesisLayers();
  assert.equal(MockImage.instances.length, 5);
  assert.equal(layers.genesisLayersReady(), false);

  MockImage.instances.slice(0, 4).forEach((image) => image.succeed());
  await Promise.resolve();
  assert.equal(layers.genesisLayersReady(), false, 'partial image set must stay unavailable');
  MockImage.instances[4].succeed();
  const loaded = await pending;
  assert.equal(Object.keys(loaded).length, 5);
  assert.equal(layers.genesisLayersReady(), true);

  const ctx = context();
  ctx.globalAlpha = 0.43;
  layers.drawGenesisHorizon(ctx, 450, 96, 2);
  assert.equal(ctx.calls.length, 3);
  for (const [, x, , width] of ctx.calls) {
    assert.ok(Math.abs(x + width / 2 - 225) <= 9, 'horizon layer stays centered within its sway');
  }
  assert.equal(ctx.globalAlpha, 0.43, 'horizon drawing restores caller canvas alpha');

  ctx.calls.length = 0;
  ctx.globalAlpha = 0.7;
  assert.equal(layers.drawGenesisDeck(ctx, 450, 896, 96, 0), true);
  assert.deepEqual(ctx.clipCalls.at(-1), [0, 96, 450, 800], 'deck applies its playfield clip');
  assert.equal(ctx.clipped, undefined, 'deck restores the caller clip state');
  assert.equal(ctx.clipRect, undefined);
  assert.equal(ctx.globalAlpha, 0.7, 'deck drawing restores caller canvas alpha');
  assert.equal(ctx.imageSmoothingEnabled, true, 'deck drawing restores source smoothing');
  assert.ok(ctx.calls.length > 300 && ctx.calls.length <= 325, '160 strips per layer plus at most five wrap splits');

  const deckImages = [MockImage.instances[3], MockImage.instances[4]];
  for (const image of deckImages) {
    const calls = ctx.calls.filter((call) => call[0] === image);
    assert.ok(calls.length >= 160 && calls.length <= 163);
    for (const call of calls) {
      const [, sx, sy, sw, sh, dx, dy, dw, dh] = call;
      assert.equal(sx, 0);
      assert.equal(sw, image.width);
      assert.ok(sy >= 0 && sh > 0 && sy + sh <= image.height + 1e-6, 'source strip stays within image bounds');
      assert.ok(dx >= 0 && dw > 0 && dx + dw <= 450 + 1e-6);
      assert.ok(dy >= 96 && dh > 0 && dy <= 896);
      assert.ok(Math.abs(dx + dw / 2 - 225) < 1e-6, 'each projected strip stays centered');
    }
    const widths = calls.map((call) => call[7]);
    assert.ok(Math.min(...widths) < 40, 'strips narrow toward the horizon');
    assert.ok(Math.max(...widths) > 440, 'strips widen toward the ship');
    assert.ok(calls[0][0] === image && calls[0].length === 9, 'uses cropped source and destination rectangles');
    assert.ok(calls[0].globalAlpha === undefined, 'Canvas alpha is applied on the context, not as an image argument');
  }
  assert.ok(ctx.calls[0][4] < 360, 'the horizon strip samples only a fraction of the source texture');

  const phaseZeroSources = deckImages.map((image) => ctx.calls.filter((call) => call[0] === image).map((call) => call[2]));
  ctx.calls.length = 0;
  ctx.alphaAtDraw.length = 0;
  layers.drawGenesisDeck(ctx, 450, 896, 96, 4);
  const phaseAdvancedSourceY = ctx.calls.find((call) => call[0] === deckImages[0])[2];
  assert.notEqual(phaseAdvancedSourceY, phaseZeroSources[0][0], 'source texture advances with the shared background grid phase');
  assert.ok(phaseAdvancedSourceY >= 0 && phaseAdvancedSourceY < 360);

  const firstLayer = ctx.calls.filter((call) => call[0] === deckImages[0]);
  const lastLayer = ctx.calls.filter((call) => call[0] === deckImages[1]);
  const farAlpha = ctx.calls.map((call, i) => call[0] === deckImages[0] ? ctx.alphaAtDraw[i] : null).filter((a) => a !== null);
  const nearAlpha = ctx.calls.map((call, i) => call[0] === deckImages[1] ? ctx.alphaAtDraw[i] : null).filter((a) => a !== null);
  assert.ok(farAlpha.at(-1) > farAlpha[0], 'far deck alpha fades in toward the ship');
  assert.ok(nearAlpha.at(-1) > nearAlpha[0], 'near deck alpha fades in toward the ship');

  ctx.calls.length = 0;
  layers.drawGenesisDeck(ctx, 450, 896, 96, 16);
  const wrappedSources = deckImages.map((image) => ctx.calls.filter((call) => call[0] === image).map((call) => call[2]));
  assert.deepEqual(wrappedSources, phaseZeroSources, 'texture phase wraps cleanly at one full grid cycle');

  layers.setGenesisLayersEnabled(false);
  assert.equal(layers.drawGenesisHorizon(ctx, 450, 96, 2), false);
  ctx.calls.length = 0;
  assert.equal(layers.drawGenesisDeck(ctx, 450, 896, 96, 4), false);
  assert.equal(ctx.calls.length, 0, 'disabled generated layers leave drawing to procedural fallback');
  layers.setGenesisLayersEnabled(true);
});

test('a failed image leaves the whole Genesis layer set unavailable', async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?failure`);
  const pending = layers.loadGenesisLayers();
  MockImage.instances[2].fail();
  assert.equal(await pending, null);
  assert.equal(layers.genesisLayersReady(), false);
  const ctx = context();
  assert.equal(layers.drawGenesisHorizon(ctx, 450, 100, 0), false);
  assert.equal(layers.drawGenesisDeck(ctx, 450, 800, 100), false);
  assert.equal(ctx.calls.length, 0);
});

test('a decode failure leaves the whole Genesis layer set unavailable', async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?decode-failure`);
  const pending = layers.loadGenesisLayers();
  MockImage.instances[1].decodeError = new Error('decode failed');
  MockImage.instances[1].succeed();
  assert.equal(await pending, null);
  assert.equal(layers.genesisLayersReady(), false);
  const ctx = context();
  assert.equal(layers.drawGenesisHorizon(ctx, 450, 100, 0), false);
  assert.equal(ctx.calls.length, 0);
});

test('fractional grid phases never stall the projected deck loop', { timeout: 5000 }, async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?fractional-phases`);
  const pending = layers.loadGenesisLayers();
  MockImage.instances.forEach((image) => image.succeed());
  assert.ok(await pending);

  const ctx = context();
  for (let i = 0; i < 1000; i++) {
    ctx.calls.length = 0;
    const scroll = i * 0.037 + i * 0.78;
    assert.equal(layers.drawGenesisDeck(ctx, 450, 896, 96, scroll), true);
    assert.ok(ctx.calls.length <= 325, `phase ${i} stays within the strip-call bound`);
    for (const call of ctx.calls) {
      const [, sx, sy, sw, sh, dx, dy, dw, dh] = call;
      assert.ok([sx, sy, sw, sh, dx, dy, dw, dh].every(Number.isFinite), `phase ${i} has finite draw coordinates`);
      assert.ok(sh > 0 && sy >= 0 && sy + sh <= 360 + 1e-6, `phase ${i} stays within source texture bounds`);
    }
  }
});

test('all four theme sets load atomically and independently', async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?four-theme-atomic`);
  const themes = ['genesis', 'crimson', 'cyclone', 'void'];
  const pending = themes.map((theme) => layers.loadThemeLayers(theme));
  assert.equal(MockImage.instances.length, 20, 'each theme loads its own five images');
  assert.deepEqual(MockImage.instances.map((image) => new URL(image.src).pathname.split('/').slice(-3, -1).join('/')),
    themes.flatMap((theme) => Array(5).fill(`backgrounds/${theme}`)));

  MockImage.instances.slice(0, 4).forEach((image) => image.succeed());
  await Promise.resolve();
  assert.equal(layers.themeLayersReady('genesis'), false, 'a partial theme is never published');
  assert.equal(layers.themeLayerImages('genesis'), null, 'chase renderer cannot observe a partial set');
  assert.equal(layers.themeLayersReady('crimson'), false, 'other themes remain independently pending');
  MockImage.instances.slice(4).forEach((image) => image.succeed());
  const loaded = await Promise.all(pending);
  for (let i = 0; i < themes.length; i++) {
    assert.equal(Object.keys(loaded[i]).length, 5);
    assert.equal(layers.themeLayersReady(themes[i]), true);
    assert.equal(layers.themeLayerImages(themes[i]), loaded[i], 'chase renderer receives the complete selected set');
    assert.equal(Object.values(loaded[i]).every((image) => MockImage.instances.includes(image)), true);
  }
});

test('failed theme falls back without poisoning other themes or retaining stale imagery', async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?theme-failure-switch`);
  const failed = layers.loadThemeLayers('crimson');
  const healthy = layers.loadThemeLayers('void');
  MockImage.instances[2].fail();
  MockImage.instances.slice(5).forEach((image) => image.succeed());
  assert.equal(await failed, null);
  const voidImages = await healthy;
  assert.equal(layers.themeLayersReady('crimson'), false);
  assert.equal(layers.themeLayersReady('void'), true);

  const ctx = context();
  ctx.globalAlpha = 0.37;
  assert.equal(layers.drawThemeHorizon(ctx, 'crimson', 450, 96, 3), false);
  assert.equal(ctx.calls.length, 0, 'failed set leaves the procedural fallback available');
  assert.equal(layers.drawThemeHorizon(ctx, 'void', 450, 96, 3), true);
  assert.ok(ctx.calls.length > 0);
  assert.ok(ctx.calls.every((call) => Object.values(voidImages).includes(call[0])), 'switch draws only the selected theme assets');
  assert.equal(ctx.globalAlpha, 0.37, 'horizon restores caller alpha');
  ctx.calls.length = 0;
  assert.equal(layers.drawThemeHorizon(ctx, 'crimson', 450, 96, 3), false);
  assert.equal(ctx.calls.length, 0, 'switching back cannot reuse the previously drawn theme');
});

test('side and top-down layer draws restore canvas state and bound fractional wrap work', async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?side-fractional`);
  const pending = layers.loadThemeLayers('cyclone');
  MockImage.instances.forEach((image) => image.succeed());
  const images = await pending;
  const ctx = context();

  for (let i = 0; i < 500; i++) {
    const t = i * 0.037 + i * 0.78;
    for (const draw of [
      () => layers.drawThemeHorizon(ctx, 'cyclone', 450, 96, t),
      () => layers.drawThemeDeck(ctx, 'cyclone', 450, 896, 96, t),
      () => layers.drawThemeSideHorizon(ctx, 'cyclone', 450, 896, 100, t),
      () => layers.drawThemeSideDeck(ctx, 'cyclone', 450, 896, 100, t),
    ]) {
      ctx.calls.length = 0;
      ctx.globalAlpha = 0.41;
      ctx.imageSmoothingEnabled = true;
      assert.equal(draw(), true);
      assert.equal(ctx.globalAlpha, 0.41, `phase ${i} restores alpha`);
      assert.equal(ctx.imageSmoothingEnabled, true, `phase ${i} restores smoothing`);
      assert.equal(ctx.stack.length, 0, `phase ${i} balances save/restore`);
      assert.ok(ctx.calls.length <= 400, `phase ${i} stays within a bounded draw-call budget (${ctx.calls.length})`);
      for (const call of ctx.calls) {
        assert.ok(Object.values(images).includes(call[0]), `phase ${i} draws only the selected theme`);
        assert.ok(call.slice(1).every(Number.isFinite), `phase ${i} has finite draw coordinates`);
      }
    }
  }
});

test('expanded side horizon keeps authored scale, aspect, sky clipping, and continuous parallax', async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?expanded-side-horizon`);
  const pending = layers.loadThemeLayers('crimson');
  MockImage.instances.forEach((image) => image.succeed());
  const images = await pending;
  const ctx = context();
  const W = 450;
  const H = 896;
  const horizon = H * 0.7;

  assert.equal(layers.drawThemeSideHorizon(ctx, 'crimson', W, H, horizon, 12.25), true);
  assert.deepEqual(ctx.clipCalls, [[0, 0, W, horizon]], 'all enlarged side scenery is clipped at the floor');
  assert.equal(ctx.stack.length, 0, 'side horizon restores its clip');
  const [gate] = ctx.calls.filter((call) => call[0] === images.gate);
  assert.equal(gate[3], 390, 'side landmark width is enlarged by 1.5x');
  assert.ok(Math.abs(gate[3] / gate[4] - images.gate.width / images.gate.height) < 1e-9, 'landmark aspect ratio is preserved');
  const oldGateCenter = W * 0.46 + Math.sin(12.25 * 0.00011) * W * 0.08 + 130;
  assert.ok(Math.abs(gate[1] + gate[3] * 0.5 - oldGateCenter) < 1e-9, 'enlargement preserves the landmark center');
  assert.ok(Math.abs(gate[2] + gate[4] - horizon) < 1e-9, 'landmark bottom meets the horizon before clipping');

  for (const [key, width, height] of [['skylineFar', 750, 210], ['skylineNear', 765, 135]]) {
    const calls = ctx.calls.filter((call) => call[0] === images[key]);
    assert.ok(calls.length >= 2, `${key} repeats across the screen`);
    assert.ok(calls.every((call) => call[3] === width && call[4] === height && call[2] === horizon - height));
    for (let i = 1; i < calls.length; i++) {
      assert.equal(calls[i][1] - calls[i - 1][1], width - 2, `${key} repeats with its hidden-edge overlap`);
    }
  }

  ctx.calls.length = 0;
  layers.drawThemeSideHorizon(ctx, 'crimson', W, H, horizon, 12.75);
  const farImage = images.skylineFar;
  const firstFarX = ctx.calls.find((call) => call[0] === farImage)[1];
  const expectedTravel = -0.5 * 0.012 * 500 / 140;
  const ctxNext = context();
  layers.drawThemeSideHorizon(ctxNext, 'crimson', W, H, horizon, 13.25);
  const nextFarX = ctxNext.calls.find((call) => call[0] === farImage)[1];
  assert.ok(Math.abs((nextFarX - firstFarX) - expectedTravel) < 1e-8, 'parallax speed uses the original world-travel scale');

  const wrapped = context();
  layers.drawThemeSideHorizon(wrapped, 'crimson', W, H, horizon, 9876.54321);
  assert.ok(wrapped.calls.length <= 20, 'fractional wrap stays bounded at enlarged tile widths');
  assert.deepEqual(wrapped.clipCalls, [[0, 0, W, horizon]]);
});

test('theme decks use each system grid period and horizon layers restore composite mode', async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?theme-grid-periods`);
  const themes = ['genesis', 'crimson', 'cyclone', 'void'];
  const pending = themes.map((theme) => layers.loadThemeLayers(theme));
  MockImage.instances.forEach((image) => image.succeed());
  await Promise.all(pending);

  const phases = {};
  for (const theme of themes) {
    const ctx = context();
    ctx.globalCompositeOperation = 'lighter';
    assert.equal(layers.drawThemeDeck(ctx, theme, 450, 896, 96, 3.25), true);
    assert.equal(ctx.globalCompositeOperation, 'lighter', `${theme} deck restores composite mode`);
    assert.equal(ctx.imageSmoothingEnabled, true, `${theme} deck restores smoothing`);
    phases[theme] = ctx.calls.find((call) => call[0] === layers.themeLayerImages(theme).deckFar)?.[2];

    ctx.calls.length = 0;
    ctx.globalCompositeOperation = 'lighter';
    assert.equal(layers.drawThemeHorizon(ctx, theme, 450, 96, 2), true);
    assert.equal(ctx.globalCompositeOperation, 'lighter', `${theme} horizon restores composite mode`);
  }
  assert.notEqual(phases.genesis, phases.crimson, 'Crimson follows its 14-row grid period');
  assert.notEqual(phases.genesis, phases.void, 'Void follows its 9-row grid period');
  assert.notEqual(phases.crimson, phases.void, 'distinct grid periods produce distinct source phases');
});

test('chase deck projects reciprocal strips, wraps fractional travel safely, and restores canvas state', async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?chase-projection`);
  const image = new MockImage();
  const projection = { hy: 120, A: 180000, Yc: 1500, f: 700, CW: 450, CH: 1100 };
  const W = 450;
  const H = 800;
  const ctx = context();

  for (let i = 0; i < 600; i++) {
    const travel = i * 0.37 + i * 3.19;
    ctx.calls.length = 0;
    ctx.alphaAtDraw.length = 0;
    ctx.globalAlpha = 0.39;
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    assert.equal(layers.drawChaseDeckLayer(ctx, image, W, H, projection, travel, { alpha: 0.3, repeats: 2 }), true);
    assert.ok(ctx.calls.length > 0 && ctx.calls.length <= 160, `phase ${i} has bounded strip count (${ctx.calls.length})`);
    assert.equal(ctx.globalAlpha, 0.39, `phase ${i} restores alpha`);
    assert.equal(ctx.globalCompositeOperation, 'lighter', `phase ${i} restores composite mode`);
    assert.equal(ctx.imageSmoothingEnabled, true, `phase ${i} restores smoothing`);
    assert.equal(ctx.stack.length, 0, `phase ${i} balances save/restore`);

    for (const call of ctx.calls) {
      const [, sx, sy, sw, sh, dx, dy, dw, dh] = call;
      assert.deepEqual([sx, sw], [0, image.width]);
      assert.ok([sy, sh, dx, dy, dw, dh].every(Number.isFinite), `phase ${i} coordinates stay finite`);
      assert.ok(sy >= 0 && sh > 0 && sy + sh <= image.height + 1e-6, `phase ${i} source crop stays in tile bounds`);
      assert.ok(dy >= projection.hy && dh > 0 && dy + dh <= H + 1, `phase ${i} draw stays on the visible floor`);
      assert.ok(dh <= (H - projection.hy - 1) / 128 + 0.41 + 1e-6, `phase ${i} uses bounded screen-space bands`);
      assert.ok(dx < W / 2 && dx + dw > W / 2, 'each projected floor strip remains centered on the lane');

      const v0 = projection.Yc - projection.A / (dy - projection.hy);
      const v1 = projection.Yc - projection.A / (dy + dh - 0.4 - projection.hy);
      const vm = (v0 + v1) * 0.5;
      const expectedWidth = projection.CW * projection.f / (projection.Yc - vm);
      assert.ok(Math.abs(dw - expectedWidth) < 2, 'strip width follows reciprocal depth projection');
    }
  }

  ctx.calls.length = 0;
  assert.equal(layers.drawChaseDeckLayer(ctx, image, W, H, projection, 9.25, { maxStrips: 7 }), true);
  assert.ok(ctx.calls.length <= 7, 'caller can lower the strip budget');
  const phaseA = ctx.calls[0][2];
  ctx.calls.length = 0;
  layers.drawChaseDeckLayer(ctx, image, W, H, projection, 10.75, { maxStrips: 7 });
  assert.notEqual(ctx.calls[0][2], phaseA, 'fractional travel advances the texture source phase');
  assert.equal(layers.drawChaseDeckLayer(ctx, image, W, H, { ...projection, A: 0 }, 1), false, 'degenerate projection is rejected');

  for (const travel of [-1e-7, 0, 1e-7, 549.9999999, 550, 550.0000001]) {
    ctx.calls.length = 0;
    assert.equal(layers.drawChaseDeckLayer(ctx, image, W, H, projection, travel, { repeats: 2 }), true);
    assert.ok(ctx.calls.length > 0 && ctx.calls.length <= 160, `seam travel ${travel} remains bounded`);
    for (const [, , sy, sw, sh, , dy, , dh] of ctx.calls) {
      assert.ok(sh > 1e-4, `seam travel ${travel} avoids near-zero source slices`);
      assert.ok(sy >= 0 && sy + sh <= image.height + 1e-6);
      assert.ok(dh <= (H - projection.hy - 1) / 128 + 0.41 + 1e-6, `seam travel ${travel} remains in screen-space bands`);
    }
  }
});

test('chase horizon keeps every landmark above the horizon and restores clip and canvas state', async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?chase-horizon`);
  const pending = layers.loadThemeLayers('void');
  MockImage.instances.forEach((image) => image.succeed());
  const images = await pending;
  const ctx = context();
  const previousClip = [3, 4, 5, 6];
  ctx.globalAlpha = 0.27;
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.clipRect = previousClip;
  ctx.clipped = true;

  const W = 450;
  const horizon = 145;
  assert.equal(layers.drawThemeChaseHorizon(ctx, 'void', W, horizon, 8.5), true);
  assert.ok(ctx.calls.length > 3);
  assert.deepEqual(ctx.clipCalls, [[0, 0, W, horizon]], 'chase horizon art is clipped above the floor');
  assert.equal(ctx.globalAlpha, 0.27);
  assert.equal(ctx.globalCompositeOperation, 'lighter');
  assert.equal(ctx.imageSmoothingEnabled, true);
  assert.deepEqual(ctx.clipRect, previousClip, 'caller clip rectangle is restored');
  assert.equal(ctx.clipped, true, 'caller clip state is restored');
  assert.equal(ctx.stack.length, 0);

  for (let i = 0; i < ctx.calls.length; i++) {
    const [image, x, y, width, height] = ctx.calls[i];
    assert.ok(Object.values(images).includes(image), 'draw uses the selected theme only');
    assert.ok([x, y, width, height].every(Number.isFinite));
    assert.ok(y >= -1e-6 && y + height <= horizon + 1e-6, 'no horizon artwork extends into the floor');
    if (i === 0) {
      assert.ok(Math.abs(y + height - horizon) < 1e-6, 'gate bottom is aligned to the horizon');
      assert.ok(Math.abs(width / height - image.width / image.height) < 1e-6, 'gate source aspect ratio is preserved');
    }
  }
});

test('preview storage copies real values and keeps every mutation in memory', async () => {
  const source = await readFile(new URL('./background-preview-storage.js', import.meta.url), 'utf8');
  const realValues = new Map([['profile', '{"lastShip":"vector"}'], ['other', 'kept']]);
  const writes = [];
  const realStorage = {
    getItem(key) { return realValues.get(String(key)) ?? null; },
    setItem(key, value) { writes.push(['setItem', String(key), String(value)]); realValues.set(String(key), String(value)); },
    removeItem(key) { writes.push(['removeItem', String(key)]); realValues.delete(String(key)); },
    clear() { writes.push(['clear']); realValues.clear(); },
    key(index) { return [...realValues.keys()][index] ?? null; },
    get length() { return realValues.size; },
  };
  const window = { localStorage: realStorage };
  vm.runInNewContext(source, { window, Map, Object });

  const isolated = window.localStorage;
  assert.notEqual(isolated, realStorage);
  assert.equal(isolated.getItem('profile'), '{"lastShip":"vector"}');
  assert.equal(isolated.length, 2);
  isolated.setItem('profile', '{"lastShip":"phantom"}');
  isolated.removeItem('other');
  isolated.clear();

  assert.deepEqual(writes, []);
  assert.equal(realValues.get('profile'), '{"lastShip":"vector"}');
  assert.equal(realValues.get('other'), 'kept');
});
