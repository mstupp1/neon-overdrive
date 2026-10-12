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
    calls: [],
    alphaAtDraw: [],
    stack: [],
    save() { this.stack.push([this.globalAlpha, this.imageSmoothingEnabled]); },
    restore() { [this.globalAlpha, this.imageSmoothingEnabled] = this.stack.pop(); },
    beginPath() {},
    rect(...args) { this.clipRect = args; },
    clip() { this.clipped = true; },
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
  assert.equal(ctx.clipped, true);
  assert.deepEqual(ctx.clipRect, [0, 96, 450, 800]);
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
