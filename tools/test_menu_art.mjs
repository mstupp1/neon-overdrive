import test from 'node:test';
import assert from 'node:assert/strict';
import { menuArtwork } from '../src/ui/menu-art.js';

function withCanvasDocument(run) {
  const previous = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      return {
        tag, children: [], calls: [], setAttribute() {},
        append(...children) { this.children.push(...children); },
        getContext() {
          return {
            clearRect: (...args) => this.calls.push(['clear', ...args]),
            drawImage: (...args) => this.calls.push(['draw', ...args]),
          };
        },
      };
    },
  };
  try { run(); } finally { globalThis.document = previous; }
}

test('menu ship previews preserve aspect ratio at both display resolutions', () => {
  withCanvasDocument(() => {
    const source = { width: 200, height: 100 };
    const art = menuArtwork(source, 112, 64);
    const [original, pixel] = art.children;
    assert.deepEqual(original.calls.at(-1), ['draw', source, 0, 28, 112, 56]);
    assert.deepEqual(pixel.calls.at(-1), ['draw', source, 0, 16, 64, 32]);
  });
});

test('late portrait loading replaces the fallback at both resolutions and clears old pixels', () => {
  withCanvasDocument(() => {
    let onLoad;
    const source = { complete: false, naturalWidth: 0, addEventListener(type, fn) { assert.equal(type, 'load'); onLoad = fn; } };
    const fallback = { width: 192, height: 192 };
    const art = menuArtwork(source, 160, 96, fallback);
    assert.equal(art.children[0].calls.at(-1)[1], fallback);
    source.complete = true;
    source.naturalWidth = source.naturalHeight = 256;
    onLoad();
    for (const canvas of art.children) {
      assert.deepEqual(canvas.calls.at(-2), ['clear', 0, 0, canvas.width, canvas.height]);
      assert.equal(canvas.calls.at(-1)[1], source);
    }
  });
});

test('unavailable portrait artwork keeps a visible fallback', () => {
  withCanvasDocument(() => {
    const source = { complete: true, naturalWidth: 0, addEventListener() {} };
    const fallback = { width: 192, height: 192 };
    const art = menuArtwork(source, 160, 96, fallback);
    for (const canvas of art.children) assert.equal(canvas.calls.at(-1)[1], fallback);
  });
});

test('late generated ship baking refreshes both menu resolutions after the fallback', async () => {
  const previous = globalThis.document;
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  try {
    globalThis.document = { createElement() {
      const element = { children: [], calls: [], setAttribute() {}, append(...nodes) { this.children.push(...nodes); },
        getContext() { return { clearRect: (...args) => this.calls.push(['clear', ...args]), drawImage: (...args) => this.calls.push(['draw', ...args]) }; } };
      return element;
    } };
    const fallback = { width: 192, height: 192 }, baked = { width: 192, height: 192 };
    const art = menuArtwork(fallback, 112, 64, fallback, ready);
    assert.equal(art.children[0].calls.at(-1)[1], fallback);
    release(baked); await ready; await Promise.resolve();
    for (const canvas of art.children) {
      assert.deepEqual(canvas.calls.at(-2), ['clear', 0, 0, canvas.width, canvas.height]);
      assert.equal(canvas.calls.at(-1)[1], baked);
    }
  } finally { globalThis.document = previous; }
});
