import assert from 'node:assert/strict';
import test from 'node:test';

const moduleUrl = new URL('../src/render/overworldLayers.js', import.meta.url);

class MockImage {
  static instances = [];

  constructor() {
    this.width = 400;
    this.height = 240;
    this.onload = null;
    this.onerror = null;
    this._src = '';
    MockImage.instances.push(this);
  }

  set src(value) { this._src = value; }
  get src() { return this._src; }
  decode() { return Promise.resolve(); }
  succeed() { this.onload?.(); }
  fail() { this.onerror?.(); }
}

function context() {
  return {
    globalAlpha: 1,
    globalCompositeOperation: 'lighter',
    calls: [],
    stack: [],
    save() { this.stack.push([this.globalAlpha, this.globalCompositeOperation]); },
    restore() { [this.globalAlpha, this.globalCompositeOperation] = this.stack.pop(); },
    drawImage(...args) { this.calls.push(args); },
    translate() {}, rotate() {}, beginPath() {}, arc() {}, clip() {},
  };
}

async function loadAll(layers, themes) {
  const pending = themes.map((theme) => layers.loadOverworldLayers(theme));
  MockImage.instances.forEach((image) => image.succeed());
  return Promise.all(pending);
}

test('overworld asset failures are isolated by theme and asset', async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?asset-failure-isolation`);
  const crimson = layers.loadOverworldLayers('crimson');
  const voidTheme = layers.loadOverworldLayers('void');
  const failed = MockImage.instances.find((image) => image.src.includes('/crimson/overworld-far-'));
  assert.ok(failed, 'the test locates one optional layer in the failing theme');
  failed.fail();
  MockImage.instances.filter((image) => image !== failed).forEach((image) => image.succeed());

  const [crimsonImages, voidImages] = await Promise.all([crimson, voidTheme]);
  assert.equal(crimsonImages['overworld-far'], null);
  assert.ok(crimsonImages.gate, 'the rest of the failing theme still loads');
  assert.equal(layers.overworldLayersReady('crimson'), false);
  assert.equal(layers.overworldLayersReady('void'), true);
  assert.ok(Object.values(voidImages).every(Boolean));

  const ctx = context();
  const ow = { seed: 17, leg: 'leg-a', W: 1800, H: 1200, cam: { x: 0, y: 0 } };
  assert.equal(layers.drawOverworldBackground(ctx, 'crimson', ow, { x0: 0, y0: 0, x1: 1800, y1: 1200 }, 1), true);
  assert.ok(ctx.calls.every(([image]) => image !== failed), 'successful assets in the failed theme remain usable');
  assert.equal(layers.drawOverworldBackground(ctx, 'void', ow, { x0: 0, y0: 0, x1: 1800, y1: 1200 }, 1), true);
  assert.ok(ctx.calls.some(([image]) => Object.values(voidImages).includes(image)));
});

test('cosmetic placement is deterministic without consuming gameplay randomness', async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?cosmetic-rng-isolation`);
  await loadAll(layers, ['genesis']);
  const originalRandom = Math.random;
  Math.random = () => { throw new Error('overworld cosmetics must not consume gameplay RNG'); };
  try {
    const ow = { seed: 123456, leg: 'leg-c', W: 1800, H: 1200, cam: { x: 0, y: 0 } };
    const bounds = { x0: 0, y0: 0, x1: 1800, y1: 1200 };
    const first = context();
    assert.equal(layers.drawOverworldBackground(first, 'genesis', ow, bounds, 1), true);
    const repeated = context();
    assert.equal(layers.drawOverworldBackground(repeated, 'genesis', ow, bounds, 1), true);
    assert.deepEqual(repeated.calls, first.calls, 'same route seed and leg produce the same decoration layout');
  } finally {
    Math.random = originalRandom;
  }
});

test('overworld decoration work stays bounded, culls offscreen art, and restores canvas state', async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?culling-work-bound`);
  await loadAll(layers, ['cyclone']);
  const ow = { seed: 44, leg: 'leg-b', W: 1800, H: 1200, cam: { x: 0, y: 0 } };
  const ctx = context();
  const fullBounds = { x0: 0, y0: 0, x1: 1800, y1: 1200 };
  ctx.globalAlpha = 0.37;
  assert.equal(layers.drawOverworldBackground(ctx, 'cyclone', ow, fullBounds, 1), true);
  assert.ok(ctx.calls.length <= 25, `decoration draw calls stay under budget (${ctx.calls.length})`);
  assert.equal(ctx.globalAlpha, 0.37);
  assert.equal(ctx.globalCompositeOperation, 'lighter');
  assert.equal(ctx.stack.length, 0, 'all save calls are balanced');

  const low = context();
  layers.drawOverworldBackground(low, 'cyclone', ow, fullBounds, 1, 0.75);
  assert.ok(low.calls.length <= 13, 'adaptive quality halves the decoration budget, plus one landmark');

  ctx.calls.length = 0;
  assert.equal(layers.drawOverworldBackground(ctx, 'cyclone', ow, { x0: 1e6, y0: 1e6, x1: 1e6 + 20, y1: 1e6 + 20 }, 1), false);
  assert.equal(ctx.calls.length, 0, 'offscreen layers are culled before drawImage');
});

test('decoration world positions remain stable as the camera moves', async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?camera-stability`);
  const images = await loadAll(layers, ['void']);
  const ow = { seed: 88, leg: 'leg-d', W: 1800, H: 1200, cam: { x: 0, y: 0 } };
  const bounds = { x0: -500, y0: -500, x1: 2400, y1: 1700 };
  const atOrigin = context();
  layers.drawOverworldBackground(atOrigin, 'void', ow, bounds, 1);
  const far = images[0]['overworld-far'];
  const farBefore = atOrigin.calls.find((call) => call[0] === far);
  assert.ok(farBefore, 'far layer has visible landmarks');

  ow.cam = { x: 100, y: 60 };
  const moved = context();
  layers.drawOverworldBackground(moved, 'void', ow, bounds, 1);
  const farAfter = moved.calls.find((call) => call[0] === far);
  assert.ok(farAfter);
  assert.ok(Math.abs((farAfter[1] - farBefore[1]) - 78) < 1e-9, 'local draw coordinate compensates for full camera transform');
  assert.ok(Math.abs((farAfter[2] - farBefore[2]) - 46.8) < 1e-9, 'local draw coordinate compensates for vertical camera transform');
  assert.ok(Math.abs(((farAfter[1] - 100) - farBefore[1]) + 22) < 1e-9, 'far landmark keeps its intended 0.22 screen parallax');
  assert.ok(Math.abs(((farAfter[2] - 60) - farBefore[2]) + 13.2) < 1e-9, 'vertical screen position follows the same parallax factor');
});

test('culling uses the camera-centered field bounds from the live overworld renderer', async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?live-camera-bounds`);
  const [images] = await loadAll(layers, ['genesis']);
  const ow = { seed: 17, leg: 'leg-a', W: 1800, H: 1200, cam: { x: 900, y: 600 } };
  // Mirrors syncField(): the visible logical-world bounds are centered on ow.cam.
  const bounds = { x0: 500, y0: 300, x1: 1300, y1: 900 };
  const ctx = context();
  assert.equal(layers.drawOverworldBackground(ctx, 'genesis', ow, bounds, 1), true);
  assert.ok(ctx.calls.some(([image]) => image === images.gate), 'the camera-centered gate landmark remains visible');
  const farCalls = ctx.calls.filter(([image]) => image === images['overworld-far']);
  assert.ok(farCalls.length > 0, 'far decorations inside the actual viewport survive culling');
  for (const [image, x, y, width, height] of ctx.calls) {
    assert.ok(x + width >= bounds.x0 && x <= bounds.x1, `${image.src} intersects horizontal field bounds`);
    assert.ok(y + height >= bounds.y0 && y <= bounds.y1, `${image.src} intersects vertical field bounds`);
  }
});

test('disabling theme art leaves obstacle rendering to its procedural fallback', async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?disabled-obstacle-fallback`);
  const [images] = await loadAll(layers, ['crimson']);
  const rock = { x: 420, y: 260, r: 48 };
  const ctx = context();
  layers.setOverworldLayersEnabled('crimson', false);
  assert.equal(layers.drawOverworldRock(ctx, 'crimson', rock, 2, 0.4), false);
  assert.equal(ctx.calls.length, 0, 'disabled optional art does not consume the fallback draw');
  layers.setOverworldLayersEnabled('crimson', true);
  assert.equal(layers.drawOverworldRock(ctx, 'crimson', rock, 2, 0.4), true);
  assert.equal(ctx.calls[0][0], images['obstacle-3']);
  assert.equal(ctx.globalAlpha, 1);
  assert.equal(ctx.globalCompositeOperation, 'lighter');
  assert.equal(ctx.stack.length, 0, 'rock transform restores caller canvas state');
});

test('placement cache refreshes when a reused overworld object advances to another leg', async () => {
  globalThis.Image = MockImage;
  MockImage.instances = [];
  const layers = await import(`${moduleUrl.href}?placement-cache-leg`);
  const [images] = await loadAll(layers, ['cyclone']);
  const ow = { seed: 502, leg: 'leg-one', W: 1800, H: 1200, cam: { x: 0, y: 0 } };
  const bounds = { x0: 0, y0: 0, x1: 1800, y1: 1200 };
  const before = context();
  layers.drawOverworldBackground(before, 'cyclone', ow, bounds, 1);
  ow.leg = 'leg-two';
  const after = context();
  layers.drawOverworldBackground(after, 'cyclone', ow, bounds, 1);
  const coordinates = (calls) => calls.filter(([image]) => image === images['overworld-far']).map(([, x, y]) => [x, y]);
  assert.notDeepEqual(coordinates(after.calls), coordinates(before.calls), 'new route leg receives its own seeded cosmetic layout');
});
