import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ENEMY_IMAGE_SPECS, withEnemyImages, enemySpriteForView, drawEnemyHull } from '../src/render/enemyImages.js';

const IDS = ['dart','swarm','spinner','dasher','snakeHead','snakeSeg','sniper','tank','splitter','mine','carrier','shielder','weaver','blinker','eclipseDrone'];
const MODES = ['top','side','chase'];
const noop = () => {};
const REQUIRED_LAYERS = { spinner: ['core','rotor'], tank: ['carriage'], carrier: ['doorLeft','doorRight'] };

function installSyntheticSpecs(ids = IDS) {
  const original = Object.fromEntries(ids.map(id => [id, ENEMY_IMAGE_SPECS[id]]));
  for (const id of ids) {
    const layers = Object.fromEntries((REQUIRED_LAYERS[id] || []).map(name => [name, {
      src: `../test-fixtures/${id}/layers/{mode}/${name}.png`, width: 40, height: 40,
      anchor: [0.5,0.5], pivot: [0.5,0.5],
    }]));
    ENEMY_IMAGE_SPECS[id] = { tint: '#fff', views: Object.fromEntries(MODES.map(mode => [mode, {
      src: `../test-fixtures/${id}/${mode}.png`, width: 40, height: 40,
      sourceSize: { width: 256, height: 256 }, anchor: [0.5,0.5],
      layers: Object.fromEntries(Object.entries(layers).map(([name, layer]) => [name, { ...layer, src: layer.src.replace('{mode}', mode) }])),
    }])) };
  }
  return () => { for (const id of ids) { if (original[id]) ENEMY_IMAGE_SPECS[id] = original[id]; else delete ENEMY_IMAGE_SPECS[id]; } };
}

function installImageHarness(failSrc = null) {
  const originalImage = globalThis.Image, originalDocument = globalThis.document;
  const requests = [];
  globalThis.Image = class {
    set src(value) {
      this.url = value; requests.push(this);
      queueMicrotask(() => value.includes(failSrc || '\0') ? this.onerror?.() : this.onload?.());
    }
  };
  globalThis.document = { createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({ scale: noop, drawImage: noop, save: noop, restore: noop, translate: noop, rotate: noop, setTransform: noop, fillRect: noop }),
  }) };
  return { requests, restore() { globalThis.Image = originalImage; globalThis.document = originalDocument; } };
}

test('generated asset specs and manifests cover every regular enemy and exclude the Hunter', () => {
  assert.deepEqual(Object.keys(ENEMY_IMAGE_SPECS).sort(), [...IDS].sort());
  assert.ok(!Object.hasOwn(ENEMY_IMAGE_SPECS, 'hunter'));
  for (const id of IDS) {
    const spec = ENEMY_IMAGE_SPECS[id];
    assert.ok(spec.tint, `${id} has a stock tint`);
    assert.deepEqual(Object.keys(spec.views).sort(), [...MODES].sort(), `${id} has all three camera views`);
    for (const mode of MODES) {
      const view = spec.views[mode];
      assert.match(view.src, new RegExp(`/enemies/${id}/`));
      assert.ok(view.width > 0 && view.height > 0);
      assert.deepEqual(view.anchor, [0.5, 0.5]);
      assert.ok(view.sourceSize?.width > 0 && view.sourceSize?.height > 0);
    }
  }
});

test('loader preserves exact sprite identity and selects all three generated camera views', async () => {
  const restoreSpecs = installSyntheticSpecs();
  const harness = installImageHarness();
  try {
    const fallback = { img: { kind: 'procedural' }, flash: {}, size: 40, half: 20 };
    for (const id of IDS) {
      const sprite = withEnemyImages(id, fallback);
      assert.equal(sprite.enemyImageId, id, `${id} remains attached to its runtime sprite identity`);
      assert.equal(enemySpriteForView(sprite, 'top'), fallback, 'the undecoded image starts with procedural art');
      await sprite.ready;
      assert.equal(sprite.generated, true, `${id} is available after its required artwork loads`);
      for (const mode of MODES) {
        const selected = enemySpriteForView(sprite, mode);
        assert.ok(selected.img, `${id}/${mode} returns decoded artwork`);
        assert.equal(sprite.views[mode], selected);
      }
    }
  } finally { harness.restore(); restoreSpecs(); }
});

test('production sprite construction attaches each generated loader to the matching enemy sprite', async () => {
  const restoreSpecs = installSyntheticSpecs();
  const harness = installImageHarness();
  const gradient = { addColorStop: noop };
  const context = new Proxy({}, {
    get: (target, key) => key in target ? target[key] : (key === 'createLinearGradient' || key === 'createRadialGradient' ? () => gradient : noop),
    set: (target, key, value) => { target[key] = value; return true; },
  });
  globalThis.document.createElement = () => ({ width: 0, height: 0, getContext: () => context });
  try {
    const { S, buildEnemySpritesV2 } = await import('../src/render/sprites.js');
    buildEnemySpritesV2();
    for (const id of IDS) assert.equal(S[id]?.enemyImageId, id, `${id} runtime sprite uses its own generated art identity`);
    await Promise.all(IDS.map(id => S[id].ready));
    for (const id of IDS) assert.equal(S[id].generated, true, `${id} production sprite finishes image loading`);
  } finally { harness.restore(); restoreSpecs(); }
});

test('each required animated layer is atomic within its camera view', async () => {
  const restoreSpecs = installSyntheticSpecs(['carrier']);
  const view = ENEMY_IMAGE_SPECS.carrier.views.top;
  const original = view.layers;
  const failedView = '../test-fixtures/carrier/layers/top/missing-required-test-layer.png';
  view.layers = { ...original, testRequired: { src: failedView, width: 40, height: 40, anchor: [0.5,0.5], pivot: [0.5,0.5] } };
  const harness = installImageHarness('missing-required-test-layer.png');
  try {
    const fallback = { img: { kind: 'fallback' }, flash: {}, size: 84, half: 42 };
    const sprite = withEnemyImages('carrier', fallback);
    await sprite.ready;
    assert.equal(sprite.generated, false);
    assert.equal(enemySpriteForView(sprite, 'top'), fallback);
    for (const mode of ['side','chase']) assert.equal(enemySpriteForView(sprite, mode), sprite.views[mode]);
    assert.equal(sprite.views.side.generated, true);
    assert.equal(sprite.views.chase.generated, true);
  } finally { view.layers = original; harness.restore(); restoreSpecs(); }
});

test('production specs include all required animated layers in each camera', () => {
  for (const [id, names] of Object.entries(REQUIRED_LAYERS)) {
    for (const mode of MODES) assert.deepEqual(Object.keys(ENEMY_IMAGE_SPECS[id].views[mode].layers || {}).sort(), [...names].sort(), `${id}/${mode} layers`);
  }
});

test('a failed camera bake still waits for other camera views and retains its fallback', async () => {
  const restoreSpecs = installSyntheticSpecs(['decodeProbe']);
  const harness = installImageHarness();
  const createCanvas = document.createElement;
  let first = true;
  document.createElement = (...args) => {
    if (first) { first = false; throw Error('simulated canvas decode/bake failure'); }
    return createCanvas(...args);
  };
  try {
    const fallback = { img: {}, flash: {}, size: 40, half: 20 };
    const sprite = withEnemyImages('decodeProbe', fallback);
    await sprite.ready;
    assert.equal(enemySpriteForView(sprite, 'top'), fallback);
    assert.equal(sprite.views.side.generated, true);
    assert.equal(sprite.views.chase.generated, true);
    assert.equal(sprite.generated, false);
  } finally { harness.restore(); restoreSpecs(); }
});

test('camera drawing selects generated views and applies hit flashes to their separate flash layers', async () => {
  const restoreSpecs = installSyntheticSpecs(['spinner']);
  const harness = installImageHarness();
  const calls = [];
  try {
    const sprite = withEnemyImages('spinner', { img: {}, flash: {}, size: 60, half: 30 });
    await sprite.ready;
    const ctx = {
      setTransform: (...v) => calls.push(['transform', ...v]),
      drawImage: (...args) => calls.push(['image', ...args]),
      save: noop, restore: noop, translate: noop, rotate: angle => calls.push(['rotate', angle]),
    };
    for (const mode of MODES) {
      calls.length = 0;
      drawEnemyHull(ctx, sprite, { x: 2, y: 3, rot: 0.2, t: 1, flash: 0 }, mode);
      assert.ok(calls.some(call => call[0] === 'image' && call[1] === sprite.views[mode].img), `${mode} camera draws its selected base`);
    }
    calls.length = 0;
    drawEnemyHull(ctx, sprite, { x: 2, y: 3, rot: 0.2, t: 1, flash: 1 }, 'top');
    assert.ok(calls.some(call => call[0] === 'image' && call[1] === sprite.views.top.flash), 'hit flash selects baked white flash');
    for (const layer of Object.values(sprite.views.top.layers)) assert.ok(calls.some(call => call[0] === 'image' && call[1] === layer.flash), 'hit flash covers each animated layer');
    calls.length = 0;
    drawEnemyHull(ctx, sprite, { x: 2, y: 3, rot: 0.2, t: 1, flash: 0, elite: true }, 'top');
    assert.equal(calls.find(call => call[0] === 'image' && call[1] === sprite.views.top.img)[4], 72, 'elite hull uses the enlarged gameplay scale');
    const rotations = [];
    for (const t of [1, 2]) {
      calls.length = 0;
      drawEnemyHull(ctx, sprite, { x: 2, y: 3, rot: 0.2, t, flash: 0 }, 'top');
      rotations.push(calls.filter(call => call[0] === 'rotate').map(call => call[1]));
    }
    assert.notDeepEqual(rotations[0], rotations[1], 'moving enemy layers change angle over time');
    calls.length = 0;
    drawEnemyHull(ctx, sprite, { x: 2, y: 3, rot: 0.2, flash: 0 }, 'top');
    assert.ok(calls.filter(call => call[0] === 'rotate').every(call => Number.isFinite(call[1])), 'missing enemy time uses a finite animation phase');
  } finally { harness.restore(); restoreSpecs(); }
});

test('visual recoil uses the firing clock and camera axes; carrier doors travel outwards', () => {
  const calls = [];
  const ctx = { setTransform: noop, drawImage: noop, save: noop, restore: noop,
    rotate: noop, translate: (...args) => calls.push(args) };
  const layer = { img: {}, flash: {}, pivot: [0.5, 0.5] };
  const spr = { img: {}, flash: {}, generated: true, size: 78, layers: { carriage: layer }, layerList: [['carriage', layer]] };
  const enemy = { x: 0, y: 0, rot: 0, t: 3, lastShotAt: 10 };
  drawEnemyHull(ctx, spr, enemy, 'top', 1, 0, 0, 1, 10);
  assert.ok(calls.some(([x, y]) => x === 0 && y === -3));
  calls.length = 0;
  drawEnemyHull(ctx, spr, enemy, 'side', 1, 0, 0, 1, 10);
  assert.ok(calls.some(([x, y]) => x === 0 && y === -3), 'side stage maps virtual backwards recoil to screen-right');
  calls.length = 0;
  drawEnemyHull(ctx, spr, enemy, 'top', 1, 0, 0, 1, 10.081);
  assert.ok(calls.every(([x, y]) => x === 0 && y === 0), 'recoil ends after 80ms of simulation time');
  const doors = { ...spr, layerList: [['doorLeft', layer], ['doorRight', layer]] };
  calls.length = 0;
  drawEnemyHull(ctx, doors, { ...enemy, carrierDoors: 1 }, 'top');
  assert.ok(calls.some(([x, y]) => x === -4 && y === 0));
  assert.ok(calls.some(([x, y]) => x === 4 && y === 0));
  calls.length = 0;
  drawEnemyHull(ctx, doors, { ...enemy, carrierDoors: 1 }, 'side');
  assert.ok(calls.some(([x, y]) => x === -4 && y === 0), 'side stage maps bay movement to screen vertical');
  assert.ok(calls.some(([x, y]) => x === 4 && y === 0));
});

test('foreshortened spinner rotors rotate in their own plane without tumbling the side hull', () => {
  const calls = [];
  const ctx = { setTransform: (...args) => calls.push(['transform', ...args]), drawImage: noop,
    save: noop, restore: noop, translate: noop,
    scale: (...args) => calls.push(['scale', ...args]), rotate: a => calls.push(['rotate', a]) };
  const layer = { img: {}, flash: {}, pivot: [0.5, 0.5], spinAspect: 0.4 };
  const sprite = { img: {}, flash: {}, size: 60, generated: true, enemyImageId: 'spinner', layers: { rotor: layer }, layerList: [['rotor', layer]] };
  for (const mode of ['side', 'chase']) {
    calls.length = 0;
    drawEnemyHull(ctx, sprite, { x: 0, y: 0, rot: 1.2, t: 2 }, mode);
    assert.deepEqual(calls[0].slice(1, 5), [1, 0, -0, 1], 'hull preserves the authored camera');
    assert.ok(calls.some(c => c[0] === 'rotate' && c[1] === 1.2), 'rotor follows the gameplay rotation');
    const scales = calls.filter(c => c[0] === 'scale');
    assert.equal(scales.length, 2);
    assert.equal(scales[0][1] * scales[1][1], 1);
    assert.equal(scales[0][2] * scales[1][2], 1);
    assert.equal(mode === 'side' ? scales[0][1] : scales[0][2], 0.4);
  }
});

test('every declared source and runtime export has matching manifest hashes and transparent RGBA coverage', () => {
  for (const id of IDS) {
    const manifestPath = new URL(`../art/enemies/${id}/manifest.json`, import.meta.url);
    assert.ok(existsSync(manifestPath), `${id} manifest is present`);
    const manifest = JSON.parse(readFileSync(manifestPath));
    assert.equal(manifest.subject, id);
    assert.deepEqual(Object.keys(manifest.views).sort(), [...MODES].sort());
    for (const mode of MODES) {
      const asset = manifest.views[mode];
      assert.ok(asset.alpha, `${id}/${mode} records alpha`);
      const view = ENEMY_IMAGE_SPECS[id].views[mode];
      const records = [[asset, view, 'base'], ...Object.entries(asset.layers || {}).map(([key, record]) => [record, view.layers?.[key], key])];
      assert.deepEqual(Object.keys(asset.layers || {}).sort(), Object.keys(view.layers || {}).sort(), `${id}/${mode} layer provenance matches runtime specs`);
      for (const [record, spec, part] of records) {
        assert.ok(spec, `${id}/${mode}/${part} runtime spec exists`);
        assert.ok(record.alpha, `${id}/${mode}/${part} records alpha`);
        for (const [pathField, hashField] of [['source','sourceSha256'],['output','outputSha256']]) {
          const fullPath = new URL(`../${record[pathField]}`, import.meta.url);
          const bytes = readFileSync(fullPath);
          assert.equal(createHash('sha256').update(bytes).digest('hex'), record[hashField], `${id}/${mode}/${part} ${pathField} hash`);
        }
        const alpha = execFileSync('python3', ['-c', 'from PIL import Image; import sys; print(" ".join(str(int((lambda e: e[0] == 0 and e[1] > 0)(Image.open(p).convert("RGBA").getchannel("A").getextrema()))) for p in sys.argv[1:]))', new URL(`../${record.source}`, import.meta.url).pathname, new URL(`../${record.output}`, import.meta.url).pathname], { encoding: 'utf8' }).trim();
        assert.deepEqual(alpha.split(/\s+/), ['1','1'], `${id}/${mode}/${part} source and runtime PNG preserve transparent edges and visible pixels`);
        const margin = execFileSync('python3', ['-c', 'from PIL import Image; import sys; a=Image.open(sys.argv[1]).convert("RGBA").getchannel("A"); b=a.point(lambda x:255 if x>32 else 0).getbbox(); print(int(bool(b) and b[0]>0 and b[1]>0 and b[2]<a.width and b[3]<a.height))', new URL(`../${record.source}`, import.meta.url).pathname], { encoding: 'utf8' }).trim();
        assert.equal(margin, '1', `${id}/${mode}/${part} selected source does not clip its opaque silhouette at a canvas edge`);
        assert.equal(spec.src.replace('../assets/', 'src/assets/'), record.output);
        assert.equal(record.sourceSize.width, spec.sourceSize.width);
        assert.equal(record.sourceSize.height, spec.sourceSize.height);
        assert.deepEqual(record.exportSize, { width: 256, height: 256 });
      }
    }
  }
});

test('preview exposes the procedural comparison, backgrounds, pixel mode, opacity and isolated live sample', () => {
  const html = readFileSync(new URL('./enemy-art-preview.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('./enemy-art-preview.js', import.meta.url), 'utf8');
  for (const id of ['background','pixel','flash','elite','opacity','roster']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(js, /enemySpriteForView/);
  assert.match(js, /procedural fallback/);
  assert.match(js, /background-preview-storage\.js/);
  assert.match(js, /pixel-game/);
});
