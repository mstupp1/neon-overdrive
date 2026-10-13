import test from 'node:test';
import assert from 'node:assert/strict';
import { assetIcon, iconImage } from '../src/ui/asset-icons.js';
import { BASES, LEGENDARIES, gearDef, itemEffect } from '../src/game/parts.js';

const glyph = '<svg viewBox="0 0 24 24" stroke="currentColor"><path fill="currentColor" d="M0 0h24v24z"/></svg>';

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
