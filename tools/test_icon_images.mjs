import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assetIcon, iconImage } from '../src/ui/asset-icons.js';
import { BASES, LEGENDARIES, gearDef, itemEffect } from '../src/game/parts.js';

const glyph = '<svg viewBox="0 0 24 24" stroke="currentColor"><path fill="currentColor" d="M0 0h24v24z"/></svg>';

test('every upgrade and gear artwork reference has a runtime export', () => {
  const upgrades = readFileSync(new URL('../src/game/upgrades.js', import.meta.url), 'utf8');
  for (const [, group, id] of upgrades.matchAll(/assetIcon\('([^']+)', '([^']+)'/g)) {
    assert.ok(existsSync(new URL(`../src/assets/icons/${group}/${id}.png`, import.meta.url)), `${group}/${id}`);
  }
  for (const def of [...BASES, ...LEGENDARIES]) {
    const url = def.icon.match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1];
    assert.ok(url && existsSync(new URL(url)), `${def.id} exported artwork`);
  }
});

test('path-module icons retain selected sources, exact prompts and reference provenance', () => {
  const manifests = ['mobility', 'turrets', 'energy'].map(group =>
    new URL(`../art/icons/upgrades/path-modules/manifest-${group}.json`, import.meta.url));
  manifests.push(new URL('../art/icons/items/shockcore-manifest.json', import.meta.url));
  const ids = new Set();
  const hash = path => createHash('sha256').update(readFileSync(new URL(`../${path}`, import.meta.url))).digest('hex');
  for (const file of manifests) {
    for (const asset of JSON.parse(readFileSync(file, 'utf8')).assets) {
      assert.ok(!ids.has(asset.id), `${asset.id} has one selected record`);
      ids.add(asset.id);
      for (const key of ['source', 'runtime', 'prompt']) {
        assert.equal(hash(asset[key]), asset[`${key}_sha256`], `${asset.id} ${key} hash`);
      }
      assert.ok(asset.references.length, `${asset.id} has an accepted visual reference`);
      for (const reference of asset.references) assert.equal(hash(reference.path), reference.sha256);
    }
  }
  assert.equal(ids.size, 19);
});

test('Hangar definitions and equipped summaries share one artwork wrapper', () => {
  for (const def of [...BASES, ...LEGENDARIES]) {
    assert.ok(gearDef(def.id).icon.includes('/assets/icons/items/' + def.id + '.png'));
    const effect = itemEffect({ uid: 'preview', base: def.id, r: 0, il: 1, mods: [] });
    assert.equal(effect.icon, def.icon);
    assert.equal((effect.icon.match(/<img\b/g) || []).length, 1);
    assert.ok(effect.icon.includes('<svg '));
  }
});

test('Canvas destinations load raster artwork instead of treating HTML as SVG', () => {
  const original = globalThis.Image;
  globalThis.Image = class {};
  try {
    const img = iconImage(assetIcon('choices', 'combat', glyph), '#3ff6ff');
    assert.equal(img.src, new URL('../src/assets/icons/choices/combat.png', import.meta.url).href);
    assert.equal(typeof img.onerror, 'function');
  } finally { globalThis.Image = original; }
});

test('Missing raster destinations fall back once to a valid tinted SVG', () => {
  const original = globalThis.Image;
  globalThis.Image = class {};
  try {
    const img = iconImage(assetIcon('choices', 'missing', glyph), '#7dff6b');
    img.onerror();
    const fallback = decodeURIComponent(img.src.split(',')[1]);
    assert.ok(fallback.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(!fallback.includes('<span'));
    assert.ok(!fallback.includes('currentColor'));
    assert.ok(fallback.includes('stroke="#7dff6b"'));
    assert.ok(fallback.includes('fill="#7dff6b"'));
    assert.equal(img.onerror, null);
  } finally { globalThis.Image = original; }
});

test('Control glyphs retain their direct SVG canvas loading path', () => {
  const original = globalThis.Image;
  globalThis.Image = class {};
  try {
    const img = iconImage(glyph, '#fff');
    assert.ok(img.src.startsWith('data:image/svg+xml;charset=utf-8,'));
    assert.equal(img.onerror, undefined);
  } finally { globalThis.Image = original; }
});
