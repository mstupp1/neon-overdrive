import test from 'node:test';
import assert from 'node:assert/strict';
import { MINI_ART } from '../src/render/miniImageSpecs.js';

const url = new URL('../src/render/miniImages.js', import.meta.url);
class MockImage {
  static all = [];
  constructor() { this.width = this.height = 512; MockImage.all.push(this); }
  set src(value) { this.url = value; }
  succeed() { this.onload?.(); }
  fail() { this.onerror?.(); }
}
function harness({ drawFailure = null } = {}) {
  const originalImage = globalThis.Image, originalDocument = globalThis.document;
  const records = [];
  globalThis.Image = MockImage;
  globalThis.document = { createElement() {
    const record = { draws: [], rotations: [], width: 0, height: 0 };
    const ctx = {
      scale() {}, translate() {}, rotate(value) { record.rotations.push(value); },
      drawImage(image, ...args) {
        record.draws.push([image, ...args]);
        if (drawFailure?.(image, record)) throw Error('simulated art bake failure');
      },
      getImageData(_x, _y, w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
      putImageData() {}, fillRect() {},
    };
    const canvas = { get width() { return record.width; }, set width(value) { record.width = value; }, get height() { return record.height; }, set height(value) { record.height = value; }, getContext: () => ctx };
    records.push(record); return canvas;
  } };
  return { records, restore() { globalThis.Image = originalImage; globalThis.document = originalDocument; } };
}
const settle = async (count = 6) => { while (count--) await Promise.resolve(); };

test('mini selector loads one requested camera, retains size, and bakes a flash copy', async () => {
  MockImage.all = []; const h = harness();
  try {
    const m = await import(`${url.href}?body-success`), fallback = { size: 80, img: {} };
    assert.equal(m.miniImage('razorwing', 'top', fallback), fallback);
    assert.match(MockImage.all[0].url, /assets\/minibosses\/razorwing\/top-v1\.png$/);
    MockImage.all[0].succeed(); await settle();
    const sprite = m.miniImage('razorwing', 'top', fallback);
    assert.equal(sprite.generated, true); assert.equal(sprite.size, MINI_ART.razorwing.size); assert.ok(sprite.flash);
    assert.equal(h.records[0].width, MINI_ART.razorwing.size * 2);
    assert.equal(h.records[1].draws.length, 1, 'flash canvas copies the decoded body before tinting white');
    assert.equal(MockImage.all.length, 1, 'only the requested view loads');
    assert.equal(m.miniImage('razorwing', 'side', fallback), fallback);
    assert.equal(MockImage.all.length, 2);
  } finally { h.restore(); }
});

test('mini source failures retain the procedural fallback and do not retry each draw', async () => {
  MockImage.all = []; const h = harness();
  try {
    const m = await import(`${url.href}?body-failure`), fallback = { img: {} };
    assert.equal(m.miniImage('mauler', 'chase', fallback), fallback);
    MockImage.all[0].fail(); await settle();
    assert.equal(m.miniImage('mauler', 'chase', fallback), fallback);
    assert.equal(m.miniImage('unknown', 'top', fallback), fallback);
    assert.equal(MockImage.all.length, 1);
  } finally { h.restore(); }
});

test('a moving component load failure keeps the whole mini camera on procedural art', async () => {
  MockImage.all = []; const h = harness();
  try {
    const m = await import(`${url.href}?component-load-failure`), fallback = { img: { procedural: true } };
    assert.equal(m.miniImage('specter', 'top', fallback), fallback);
    assert.equal(MockImage.all.length, 2, 'body and scythe are loaded as one camera bundle');
    MockImage.all.find(image => image.url.includes('specter-scythe')).fail();
    MockImage.all.find(image => image.url.includes('specter/top')).succeed();
    await settle();
    assert.equal(m.miniImage('specter', 'top', fallback), fallback);
    assert.equal(m.miniPart('specter', 'scythe', 'top', fallback), fallback);
    assert.equal(h.records.length, 0, 'no partial bundle is baked or published');
    assert.equal(MockImage.all.length, 2, 'a failed camera bundle is not retried every frame');
  } finally { h.restore(); }
});

test('a component bake exception also prevents publication of the mini body', async () => {
  MockImage.all = []; const h = harness({ drawFailure: image => image?.url?.includes('specter-scythe') });
  try {
    const m = await import(`${url.href}?component-bake-failure`), fallback = { img: { procedural: true } };
    assert.equal(m.miniImage('specter', 'top', fallback), fallback);
    MockImage.all.forEach(image => image.succeed()); await settle();
    assert.equal(m.miniImage('specter', 'top', fallback), fallback);
    assert.equal(m.miniPart('specter', 'scythe', 'top', fallback), fallback);
    assert.equal(MockImage.all.length, 2);
  } finally { h.restore(); }
});

test('mini phase prewarming covers both tints and selectors reuse the baked phase cache', async () => {
  MockImage.all = []; const h = harness();
  try {
    const m = await import(`${url.href}?phase-prewarm`), fallback = { img: {} };
    m.prewarmMiniImages();
    assert.equal(MockImage.all.length, 21, 'three views per mini plus each unique moving component source');
    MockImage.all.forEach(image => image.succeed()); await settle(12);
    const before = h.records.length;
    assert.equal(m.miniImage('razorwing', 'top', fallback, MINI_ART.razorwing.phaseColor).generated, true);
    assert.equal(m.miniImage('razorwing', 'top', fallback, MINI_ART.razorwing.color).generated, true);
    assert.ok(h.records.length >= before);
    assert.equal(MockImage.all.length, 21, 'phase selection reuses decoded sources without new requests');
  } finally { h.restore(); }
});
