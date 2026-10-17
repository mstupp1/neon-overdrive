import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { BOSS_ART } from '../src/render/bossImageSpecs.js';
import { bossImage, bossPart } from '../src/render/bossImages.js';

const root = new URL('../', import.meta.url);
const ids = ['warden', 'hydra', 'omega', 'eclipse'];
const views = ['top', 'side', 'chase'];
const assetPath = file => new URL(`src/assets/bosses/${file}`, root);
const manifestPath = id => new URL(`art/bosses/${id}/manifest.json`, root);

function pngInfo(bytes) {
  assert.equal(bytes.toString('hex', 0, 8), '89504e470d0a1a0a', 'registered art must be a PNG');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20), colorType = bytes[25];
  const channels = ({ 0: 1, 2: 3, 4: 2, 6: 4 })[colorType];
  assert.ok(channels, `unsupported PNG color type ${colorType}`);
  const idat = [];
  for (let p = 8; p < bytes.length;) {
    const size = bytes.readUInt32BE(p); const type = bytes.toString('ascii', p + 4, p + 8);
    if (type === 'IDAT') idat.push(bytes.subarray(p + 8, p + 8 + size));
    p += 12 + size;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rows = [];
  let offset = 0, prev = Buffer.alloc(stride);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < height; y++) {
    const filter = raw[offset++], row = Buffer.from(raw.subarray(offset, offset + stride)); offset += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0, b = prev[x], c = x >= channels ? prev[x - channels] : 0;
      if (filter === 1) row[x] = (row[x] + a) & 255;
      else if (filter === 2) row[x] = (row[x] + b) & 255;
      else if (filter === 3) row[x] = (row[x] + Math.floor((a + b) / 2)) & 255;
      else if (filter === 4) row[x] = (row[x] + paeth(a, b, c)) & 255;
      else assert.equal(filter, 0, `unknown PNG filter ${filter}`);
    }
    rows.push(row); prev = row;
  }
  if (colorType === 4 || colorType === 6) {
    let clear = false, solid = false;
    const ai = channels - 1;
    for (const row of rows) for (let p = ai; p < row.length; p += channels) { clear ||= row[p] === 0; solid ||= row[p] > 0; }
    assert.ok(clear, 'transparent artwork margins should remain alpha zero');
    assert.ok(solid, 'artwork should contain visible pixels');
  } else {
    assert.fail('boss art must preserve transparency using RGBA or grayscale-alpha PNG');
  }
  return { width, height };
}

function verifyManifest(id, manifest) {
  const entries = Array.isArray(manifest) ? manifest : manifest.assets;
  if (!Array.isArray(entries)) return;
  for (const asset of entries) {
    for (const kind of ['source', 'runtime']) {
      if (!asset[kind]) continue;
      const digestField = `${kind}_sha256`;
      if (!asset[digestField]) continue;
      const bytes = readFileSync(new URL(asset[kind], root));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), asset[digestField], `${id} ${kind} hash`);
      if (kind === 'runtime') pngInfo(bytes);
    }
  }
}

test('registry covers each main boss and all three camera views', () => {
  assert.deepEqual(Object.keys(BOSS_ART).sort(), ids.slice().sort());
  for (const id of ids) {
    assert.ok(BOSS_ART[id].color, `${id} stock accent color`);
    assert.ok(BOSS_ART[id].size > 0, `${id} logical sprite size`);
    assert.deepEqual(Object.keys(BOSS_ART[id].views).sort(), views.slice().sort());
    for (const mode of views) assert.match(BOSS_ART[id].views[mode], new RegExp(`^${id}/${mode}-v\\d+\\.png$`));
  }
  assert.deepEqual(Object.keys(BOSS_ART.hydra.parts), ['pod']);
  assert.deepEqual(Object.keys(BOSS_ART.omega.parts).sort(), ['node', 'shard']);
});

test('image selectors retain procedural fallbacks while browser decoding is unavailable', () => {
  const fallback = { img: {}, size: 64, half: 32 };
  assert.equal(bossImage('warden', 'top', fallback), fallback);
  assert.equal(bossImage('warden', 'unknown-camera', fallback), fallback);
  assert.equal(bossImage('missing', 'top', fallback), fallback);
  assert.equal(bossPart('hydra', 'pod', 'top', fallback), fallback);
  assert.equal(bossPart('missing', 'pod', 'top', fallback), fallback);
});

test('all registered bodies and components exist and preserve genuine alpha', () => {
  const files = ids.flatMap(id => views.map(mode => BOSS_ART[id].views[mode]).concat(Object.values(BOSS_ART[id].parts || {})));
  for (const file of files) assert.ok(existsSync(assetPath(file)), `missing runtime art: ${file}`);
  const runtime = files.map(file => [file, assetPath(file)]);
  const source = [];
  for (const id of ids) {
    const dir = new URL(`art/bosses/${id}/sources/`, root);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter(file => file.endsWith('.png'))) source.push([`${id}/sources/${file}`, new URL(file, dir)]);
  }
  const present = [...source, ...runtime];
  for (const [label, path] of present) {
    const { width, height } = pngInfo(readFileSync(path));
    if (!label.includes('/sources/')) { assert.equal(width, height, `${label} runtime canvas must be square`); assert.ok(width >= 128); }
    else assert.ok(width > 0 && height > 0, `${label} source dimensions`);
  }
});

test('all selected boss manifests validate source, runtime, prompts and reference hashes', () => {
  for (const id of ids) {
    assert.ok(existsSync(manifestPath(id)), `${id} manifest missing`);
    const manifest = JSON.parse(readFileSync(manifestPath(id), 'utf8'));
    assert.equal(manifest.assets.length, 3);
    for (const asset of manifest.assets) {
      for (const key of ['source','runtime','prompt']) {
        assert.ok(asset[`${key}_sha256`], `${id} ${key} hash required`);
        assert.equal(createHash('sha256').update(readFileSync(new URL(asset[key],root))).digest('hex'),asset[`${key}_sha256`]);
      }
      for (const reference of asset.references) assert.equal(createHash('sha256').update(readFileSync(new URL(reference.path,root))).digest('hex'),reference.sha256);
    }
    verifyManifest(id, manifest);
  }
  const components = JSON.parse(readFileSync(new URL('art/bosses/components/manifest.json',root),'utf8'));
  for (const [id, asset] of Object.entries(components.assets)) {
    for (const kind of ['source','runtime','prompt']) {
      assert.equal(createHash('sha256').update(readFileSync(new URL(asset[kind],root))).digest('hex'),asset[`${kind}Sha256`],`${id} ${kind} provenance`);
    }
  }
});
