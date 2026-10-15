import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cannonMount, posedShipPoint, worldShipMount, ROLL_PERSPECTIVE } from '../src/render/shipMounts.js';
import { withShipImages, shipSpriteForView, SHIP_ART } from '../src/render/shipImages.js';
import { SHIPS, weaponStreams } from '../src/game/ships.js';
import { shipPaint } from '../src/render/shipPaint.js';
import { exportedShipPoint } from '../src/render/shipAssetGeometry.js';

const mounts = [[-3, -17], [3, -17]];
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} should equal ${b}`);

test('portrait and landscape master anchors follow centered export padding', () => {
  assert.deepEqual(exportedShipPoint([0.5, 0.5], [1024, 1536], [256, 256]), [127.5, 128]);
  assert.deepEqual(exportedShipPoint([1, 0], [2048, 683], [256, 256]), [256, 85]);
  assert.deepEqual(exportedShipPoint([0.5, 0.5], [1254, 1254], [256, 256]), [128, 128]);
  assert.deepEqual(exportedShipPoint([0.5, 0.5], [1000, 300], [256, 256], [0, 90, 256, 76]), [128, 128]);
});

test('ship paint preserves neutral armor and changes accents across the stock palettes', () => {
  for (const stock of ['#3ff6ff', '#8dff5a', '#ffd23f', '#c77dff', '#ff8a3d', '#6f8bff', '#5effd8', '#ff5a7a', '#ff9df0', '#e8c66a']) {
    assert.equal(shipPaint(stock, stock), null);
    const repaint = shipPaint(stock, '#ff3b5c');
    for (const gray of [15, 80, 160, 245]) assert.deepEqual(repaint(gray, gray, gray), [gray, gray, gray]);
    const pixel = stock.match(/[\da-f]{2}/gi).map(v => parseInt(v, 16));
    const result = repaint(...pixel);
    assert.ok(result[0] > result[1] + 20 && result[0] > result[2] + 20, `${stock} stock accent should become crimson`);
    for (const [i, channel] of [255, 59, 92].entries()) assert.ok(Math.abs(result[i] - channel) <= 1, 'stock shade maps to the selected paint');
  }
  assert.deepEqual(shipPaint('#3ff6ff', '#ff3b5c')(240, 150, 30), [240, 150, 30], 'unrelated gold detail stays gold');
  const ghost = shipPaint('#8dff5a', '#e4f2ff')(141, 255, 90);
  assert.ok(Math.min(...ghost) >= 227 && ghost[2] >= ghost[0], 'ghost paint becomes pale rather than saturated blue');
});

test('selected source/export hashes and measured anchors agree with the runtime', () => {
  const root = new URL('../', import.meta.url);
  assert.deepEqual(Object.keys(SHIP_ART).sort(), SHIPS.map(ship => ship.id).sort());
  for (const ship of SHIPS) {
  const art = SHIP_ART[ship.id];
  assert.equal(art.color, ship.color);
  const manifest = JSON.parse(readFileSync(new URL(`art/ships/${ship.id}/manifest.json`, root)));
  assert.equal(manifest.assets.length, 3);
  for (const asset of manifest.assets) {
    const spec = art[asset.view === 'pursuit' ? 'chase' : asset.view];
    assert.ok(asset.runtime.endsWith('/' + spec.file));
    if (spec.sourceSize) assert.deepEqual(spec.sourceSize, asset.source_size);
    else assert.equal(asset.source_size[0], asset.source_size[1], 'non-square masters require sourceSize');
    if (asset.content_box) assert.deepEqual(spec.contentBox, asset.content_box);
    for (const kind of ['source', 'runtime']) {
      const bytes = readFileSync(new URL(asset[kind], root));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), asset[kind + '_sha256']);
    }
    for (const [field, points] of [['muzzles', asset.source_muzzle_pixels], ['engines', asset.source_engine_pixels]]) {
      assert.deepEqual(spec[field], points.map(([x, y]) => [x / asset.source_size[0], y / asset.source_size[1]]));
    }
  }
  }
});

test('all eight pulse levels fire every stream from a physical cannon', () => {
  const counts = [2, 3, 5, 6, 8, 8, 9, 11];
  for (let level = 1; level <= 8; level++) {
    const streams = weaponStreams('pulse', level);
    assert.equal(streams.length, counts[level - 1]);
    for (const [i, [offset]] of streams.entries()) {
      assert.ok(mounts.includes(cannonMount(mounts, offset, i)));
      if (offset) assert.equal(Math.sign(cannonMount(mounts, offset, i)[0]), Math.sign(offset));
    }
  }
});

test('barrel points follow banking, pitch and arbitrary free-flight headings', () => {
  // Full right bank: the left (rising) wing foreshortens across but grows toward the overhead camera.
  const rolled = posedShipPoint([-4, -12], 1, 1);
  close(rolled[0], -4 * Math.cos(0.6)); close(rolled[1], -12 * (1 + 4 * Math.sin(0.6) * ROLL_PERSPECTIVE) * 1.06);
  const dipping = posedShipPoint([4, -12], 1, 0);
  assert.ok(Math.abs(dipping[1]) < 12 && Math.abs(posedShipPoint([-4, -12], 1, 0)[1]) > 12);
  // Side view: diving (bank > 0 moves down the screen) turns the nose clockwise, i.e. down on screen.
  const nose = posedShipPoint([0, -30], 1, 0, null, 'side');
  assert.ok(nose[0] > 0); close(Math.hypot(...nose), 30);
  // Pursuit keeps the old boolean flag working.
  assert.deepEqual(posedShipPoint([3, -9], 0.5, 0.2, null, true), posedShipPoint([3, -9], 0.5, 0.2, null, 'chase'));
  const point = posedShipPoint([-4, -12], 0, 0, 0);
  close(point[0], 12); close(point[1], -4);
  const p = { x: 120, y: 300, bank: 0, pitch: 0, aim: Math.PI / 3 };
  const world = worldShipMount(mounts[0], p, 'top', true);
  const delta = posedShipPoint(mounts[0], 0, 0, p.aim);
  close(world.x - p.x, delta[0]); close(world.y - p.y, delta[1]);
});

test('side-world quarter turn leaves the authored right-facing muzzle in place', () => {
  // Authored side point (12, -4) is cached after a counter-clockwise quarter turn.
  const point = [-4, -12];
  const p = { x: 200, y: 400, bank: 0, pitch: 0 };
  const result = worldShipMount(point, p, 'side', false);
  close(-(result.y - p.y), 12);
  close(result.x - p.x, -4);
});

test('pursuit projected firing origins meet banked standee cannon tips at different depths', () => {
  const camera = {
    toScreen(x, y) { const s = 600 / (1300 - y); return { x: 225 + (x - 225) * s, y: 100 + 90000 / (1300 - y), s }; },
    toVirtual(x, y) { const d = 90000 / (y - 100); return { x: 225 + (x - 225) * d / 600, y: 1300 - d }; },
  };
  for (const y of [660, 950, 1040]) for (const bank of [-1, 0, 1]) {
    const p = { x: 125, y, bank, pitch: 0.5 };
    for (const mount of mounts) {
      const result = camera.toScreen(...Object.values(worldShipMount(mount, p, 'chase', false, camera)));
      const q = camera.toScreen(p.x, p.y);
      const posed = posedShipPoint(mount, bank, p.pitch, null, true);
      close(result.x, q.x + posed[0] * q.s);
      close(result.y, q.y + posed[1] * q.s);
    }
  }
});

test('pursuit muzzle inversion follows cinematic zoom, translation and near/far cutout scale', () => {
  const camera = {
    toScreen(x, y) { const s = 600 / (1300 - y); return { x: 225 + (x - 225) * s, y: 100 + 90000 / (1300 - y), s }; },
    toVirtual(x, y) { const d = 90000 / (y - 100); return { x: 225 + (x - 225) * d / 600, y: 1300 - d }; },
  };
  const scenarios = [
    { frame: { z: 1.28, x: -71, y: 58 }, y: 80 }, // far cutout
    { frame: { z: 1.16, x: -35, y: 22 }, y: 520 }, // fog transition
    { frame: { z: 1.34, x: -91, y: 104 }, y: 980 }, // near cutout
  ];
  for (const { frame, y } of scenarios) {
    const p = { x: 125, y, bank: 0.7, pitch: 0.5 };
    for (const mount of mounts) {
      const result = worldShipMount(mount, p, 'chase', false, camera, frame);
      const projected = camera.toScreen(result.x * frame.z + frame.x, result.y * frame.z + frame.y);
      const center = camera.toScreen(p.x * frame.z + frame.x, p.y * frame.z + frame.y);
      const stageY = p.y * frame.z + frame.y;
      const fog = Math.max(0, Math.min(1, (stageY + 20) / 260));
      const scale = frame.z * (0.4 + 0.6 * fog);
      const posed = posedShipPoint(mount, p.bank, p.pitch, null, true);
      close(projected.x, center.x + posed[0] * center.s * scale);
      close(projected.y, center.y + posed[1] * center.s * scale);
    }
  }
});

test('loading and failed generated views preserve the procedural hull; other ships are unchanged', async () => {
  const original = globalThis.Image;
  const pending = [];
  globalThis.Image = class { constructor() { pending.push(this); } };
  try {
    const fallback = { img: {}, size: 64, half: 32 };
    assert.equal(withShipImages('unknown', '#3ff6ff', fallback), fallback);
    const ship = withShipImages('vector', '#3ff6ff', fallback);
    assert.equal(ship.img, fallback.img);
    for (const mode of ['side', 'chase']) assert.equal(shipSpriteForView(ship, mode), fallback);
    pending.forEach(image => image.onerror());
    await Promise.resolve();
    assert.equal(ship.img, fallback.img);
    assert.equal(shipSpriteForView(ship, 'chase'), fallback);
  } finally { globalThis.Image = original; }
});
