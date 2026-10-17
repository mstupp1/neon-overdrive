import assert from 'node:assert/strict';
import test from 'node:test';

const moduleUrl = new URL('../src/render/bossImages.js', import.meta.url);

class MockImage {
  static instances = [];
  constructor() {
    this.onload = null;
    this.onerror = null;
    this.width = 512;
    this.height = 512;
    MockImage.instances.push(this);
  }
  set src(value) { this._src = value; }
  get src() { return this._src; }
  succeed() { this.onload?.(); }
  fail() { this.onerror?.(); }
}

function installCanvas({ drawError = false } = {}) {
  const contexts = [];
  globalThis.Image = MockImage;
  globalThis.document = {
    createElement(name) {
      assert.equal(name, 'canvas');
      const calls = { draws: [], rotations: [], fills: [], pixelReads: 0 };
      const ctx = {
        globalCompositeOperation: 'source-over',
        fillStyle: '',
        filter: 'none',
        scale() {},
        translate() {},
        rotate(value) { calls.rotations.push(value); },
        drawImage(...args) {
          if (drawError) throw new Error('mock draw failure');
          calls.draws.push(args);
        },
        fillRect(...args) { calls.fills.push(args); },
        getImageData(x, y, width, height) {
          calls.pixelReads++;
          return { data: new Uint8ClampedArray(width * height * 4) };
        },
        putImageData() {},
      };
      contexts.push({ ctx, calls });
      return { width: 0, height: 0, getContext: () => ctx };
    },
  };
  return contexts;
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

test('boss body loads the selected camera into its fallback box and bakes a white flash', async () => {
  MockImage.instances = [];
  const contexts = installCanvas();
  const images = await import(`${moduleUrl.href}?body-success`);
  const fallback = { size: 230, half: 115, img: {} };

  assert.equal(images.bossImage('warden', 'side', fallback), fallback);
  assert.equal(MockImage.instances.length, 1);
  assert.match(MockImage.instances[0].src, /assets\/bosses\/warden\/side-v1\.png$/);
  MockImage.instances[0].succeed();
  await settle();

  const sprite = images.bossImage('warden', 'side', fallback);
  assert.equal(sprite.generated, true);
  assert.equal(sprite.size, 230);
  assert.equal(sprite.img.width, 460);
  assert.equal(sprite.img.height, 460);
  assert.ok(contexts[0].calls.rotations.includes(-Math.PI / 2));
  assert.equal(sprite.flash.width, 460);
  assert.equal(contexts[1].ctx.globalCompositeOperation, 'source-atop');
  assert.equal(contexts[1].ctx.fillStyle, '#fff');
});

test('missing images keep the procedural fallback and are not retried every frame', async () => {
  MockImage.instances = [];
  installCanvas();
  const images = await import(`${moduleUrl.href}?body-failure`);
  const fallback = { size: 250, img: {} };
  assert.equal(images.bossImage('hydra', 'chase', fallback), fallback);
  MockImage.instances[0].fail();
  await settle();
  assert.equal(images.bossImage('hydra', 'chase', fallback), fallback);
  assert.equal(images.bossImage('hydra', 'chase', fallback), fallback);
  assert.equal(MockImage.instances.length, 1);
});

test('radial parts use one camera-neutral baked orientation', async () => {
  MockImage.instances = [];
  const contexts = installCanvas();
  const images = await import(`${moduleUrl.href}?part-neutral`);
  const fallback = { size: 40, img: {} };
  assert.equal(images.bossPart('hydra', 'pod', 'side', fallback), fallback);
  assert.match(MockImage.instances[0].src, /assets\/bosses\/components\/hydraPod-v1\.png$/);
  MockImage.instances[0].succeed();
  await settle();
  const sprite = images.bossPart('hydra', 'pod', 'chase', fallback);
  assert.equal(sprite.generated, true);
  assert.equal(sprite.size, 40);
  assert.deepEqual(contexts[0].calls.rotations, []);
});

test('measured visual anchors apply only to generated camera art', async () => {
  const images = await import(`${moduleUrl.href}?anchor-selection`);
  const fallback = [[-36, -16], [36, -16]];
  assert.equal(images.bossVisualPoints('warden', 'top', 'turrets', fallback, { generated: false }), fallback);
  assert.deepEqual(
    images.bossVisualPoints('warden', 'top', 'turrets', fallback, { generated: true }),
    [[-27.1, -18.6], [27.1, -18.6]],
  );
  assert.deepEqual(
    images.bossVisualPoints('warden', 'chase', 'engines', fallback, { generated: true }),
    [],
  );
});

test('Omega node phase tint is baked once and cached', async () => {
  MockImage.instances = [];
  const contexts = installCanvas();
  const images = await import(`${moduleUrl.href}?omega-node-tint`);
  const fallback = { size: 36, img: {} };
  assert.equal(images.bossPart('omega', 'node', 'side', fallback, '#ff3df2'), fallback);
  assert.match(MockImage.instances[0].src, /assets\/bosses\/components\/omegaNode-v1\.png$/);
  MockImage.instances[0].succeed();
  await settle();

  const node = images.bossPart('omega', 'node', 'chase', fallback, '#ff3df2');
  assert.equal(node.generated, true);
  assert.equal(node.size, 36);
  assert.ok(contexts[0].calls.pixelReads > 0, 'only selected emissive pixels are checked for recoloring');
  assert.equal(images.bossPart('omega', 'node', 'top', fallback, '#ff3df2'), node);
  assert.equal(MockImage.instances.length, 1);
});

test('canvas bake errors settle to fallback instead of leaving a stuck pending load', async () => {
  MockImage.instances = [];
  installCanvas({ drawError: true });
  const images = await import(`${moduleUrl.href}?bake-error`);
  const fallback = { size: 120, img: {} };
  assert.equal(images.bossImage('omega', 'top', fallback), fallback);
  MockImage.instances[0].succeed();
  await settle();
  assert.equal(images.bossImage('omega', 'top', fallback), fallback);
  assert.equal(images.bossImage('omega', 'top', fallback), fallback);
  assert.equal(MockImage.instances.length, 1);
});
