import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_ART } from '../src/render/moduleImageSpecs.js';
const url = new URL('../src/render/moduleImages.js', import.meta.url);
class MockImage {
  static all = [];
  static failUrl = null;
  constructor() { MockImage.all.push(this); }
  set src(value) { this.url = value; queueMicrotask(() => (MockImage.failUrl && value.includes(MockImage.failUrl)) ? this.onerror?.() : this.onload?.()); }
}
function harness({ noContext = false } = {}) {
  const originalImage = globalThis.Image, originalDocument = globalThis.document, canvases = [];
  globalThis.Image = MockImage;
  globalThis.document = { createElement() {
    const record = { width: 0, height: 0, transforms: [], draws: [] };
    const ctx = noContext ? null : {
      scale(...args) { record.transforms.push(['scale', ...args]); },
      translate(...args) { record.transforms.push(['translate', ...args]); },
      rotate(...args) { record.transforms.push(['rotate', ...args]); },
      drawImage(...args) { record.draws.push(args); },
    };
    const canvas = { get width() { return record.width; }, set width(v) { record.width = v; }, get height() { return record.height; }, set height(v) { record.height = v; }, getContext: () => ctx };
    canvases.push(record); return canvas;
  } };
  return { canvases, restore() { globalThis.Image = originalImage; globalThis.document = originalDocument; } };
}

test('module registry loads generated views and bakes the full logical footprint', async () => {
  MockImage.all = []; MockImage.failUrl = null; const h = harness();
  try {
    const m = await import(`${url.href}?module-footprint`), fallback = { img: { procedural: true }, size: 30 };
    assert.deepEqual(Object.keys(MODULE_ART).sort(), ['blade', 'drone', 'interceptor', 'mine', 'saw']);
    assert.equal(m.moduleImage('blade', 'top', fallback), fallback);
    assert.equal(m.moduleImage('unknown', 'top', fallback), fallback);
    await m.prewarmModuleImages();
    for (const [id, spec] of Object.entries(MODULE_ART)) for (const view of spec.views) {
      const sprite = m.moduleImage(id, view, fallback);
      assert.equal(sprite.generated, true, `${id}/${view}`);
      assert.equal(sprite.size, spec.size);
      assert.equal(sprite.spinAspect, spec.spinAspect, `${id}/${view} carries its registered spin aspect`);
      assert.deepEqual([sprite.img.width, sprite.img.height], [spec.size * 2, spec.size * 2]);
      const revision = spec.revisions?.[view] || 1;
      const assetPath = `/${id}/${view}-v${revision}.png`;
      const record = h.canvases.find(canvas => canvas.width === spec.size * 2 && canvas.draws.some(draw => draw[0] instanceof MockImage && draw[0].url.endsWith(assetPath)));
      assert.ok(record, `${id}/${view} has a baked canvas`);
      const draw = record.draws.find(call => call[0] instanceof MockImage && call[0].url.endsWith(assetPath));
      assert.deepEqual(draw.slice(1), [-spec.size / 2, -spec.size / 2, spec.size, spec.size], `${id}/${view} fills its logical box`);
      if (view === 'side') assert.ok(record.transforms.some(call => call[0] === 'rotate' && call[1] === -Math.PI / 2));
    }
    assert.equal(MockImage.all.length, 15);
  } finally { h.restore(); }
});

test('module decode failure and bake failure both keep the affected camera fallback', async () => {
  MockImage.all = []; MockImage.failUrl = 'mine/side'; const h = harness();
  try {
    const m = await import(`${url.href}?module-decode-failure`), fallback = { img: { procedural: true }, size: 24 };
    await m.prewarmModuleImages();
    assert.equal(m.moduleImage('mine', 'side', fallback), fallback);
    assert.equal(m.moduleImage('mine', 'top', fallback).generated, true);
    assert.equal(MockImage.all.length, 15, 'prewarming caches both successful and failed camera attempts');
  } finally { h.restore(); }
  MockImage.all = []; const broken = harness({ noContext: true });
  try {
    MockImage.failUrl = null; const m = await import(`${url.href}?module-bake-failure`), fallback = { img: { procedural: true }, size: 30 };
    await m.prewarmModuleImages();
    assert.equal(m.moduleImage('blade', 'top', fallback), fallback);
    assert.equal(MockImage.all.length, 15, 'bake failures do not trigger render-loop reloads');
  } finally { broken.restore(); }
});

test('module dimensions and mine visible artwork preserve gameplay scale', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(MODULE_ART).map(([id, spec]) => [id, spec.size])), { blade: 30, drone: 26, interceptor: 22, mine: 24, saw: 30 });
  assert.equal(MODULE_ART.mine.visible, 14);
});

test('module spin matrices rotate within each camera projection', async () => {
  const { moduleSpinMatrix } = await import(`${url.href}?spin-projection`), aspect = .42;
  const approx = (actual, expected) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-12));
  approx(moduleSpinMatrix(0, 'top'), [1, 0, 0, 1]);
  approx(moduleSpinMatrix(0, 'side', aspect), [1, 0, 0, 1]);
  approx(moduleSpinMatrix(0, 'chase', aspect), [1, 0, 0, 1]);
  const angle = .73, c = Math.cos(angle), s = Math.sin(angle);
  approx(moduleSpinMatrix(angle, 'top'), [c, s, -s, c]);
  approx(moduleSpinMatrix(angle, 'side', aspect), [c, s / aspect, -s * aspect, c]);
  approx(moduleSpinMatrix(angle, 'chase', aspect), [c, s * aspect, -s / aspect, c]);
  for (const view of ['top', 'side', 'chase']) {
    const [a, b, cc, d] = moduleSpinMatrix(angle, view, aspect);
    assert.ok(Math.abs(a * d - b * cc - 1) < 1e-12, `${view} projected spin preserves area`);
  }
});
