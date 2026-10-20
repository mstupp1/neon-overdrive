import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { abilityLayout, placeAbilityTargets, abilityClusterTop } from '../src/ui/ability-layout.js';
import { chargeArc, chargeFill, unitFill } from '../src/render/gaugeGeometry.js';

test('phone and landscape targets stay >=44px, mirrored, clear of insets and each other', () => {
  for (const [width, height] of [[320,568],[375,667],[390,844],[844,390]]) {
    const scale = Math.min(width, height * .66) / 450;
    const view = { W:450, H:height/scale, scale, safeBottom:34/scale, safeLeft:12/scale, safeRight:12/scale };
    const right = abilityLayout(view);
    const left = abilityLayout(view, 'left');
    for (const kind of ['dash','od','boost']) {
      const spot = right[kind];
      assert.equal(spot.y, left[kind].y);
      assert.ok(Math.abs(spot.x + left[kind].x - 450) < 1e-6);
      assert.ok(spot.target * scale >= 44 - 1e-6);
      assert.ok(spot.x - spot.target/2 >= view.safeLeft);
      assert.ok(spot.x + spot.target/2 <= 450 - view.safeRight);
      assert.ok(spot.y + Math.max(spot.target/2,49) < view.H - view.safeBottom);
    }
    assert.ok(abilityClusterTop(right) <= right.od.y - 34);
    assert.equal(right.od.x, right.boost.x);
    assert.equal(right.dash.y, right.boost.y);
    assert.ok(right.dash.x + right.dash.target/2 < right.boost.x - right.boost.target/2);
    assert.ok(right.od.y + right.od.target/2 < right.boost.y - right.boost.target/2);
    const buttons = Object.fromEntries(['dash','od','boost'].map(k=>[`#touch-${k}`,{style:{}}]));
    placeAbilityTargets({querySelector:sel=>buttons[sel]},right,scale);
    for (const [kind, spot] of Object.entries(right)) {
      const style = buttons[`#touch-${kind}`].style;
      assert.ok(Math.abs(parseFloat(style.left)+parseFloat(style.width)/2-spot.x*scale)<1e-6);
      assert.ok(Math.abs(parseFloat(style.top)+parseFloat(style.height)/2-spot.y*scale)<1e-6);
    }
  }
});

test('charge arcs retain positive spans and gaps for variable capacities', () => {
  for (const n of [1,2,3,4,5,12,32,100]) {
    let end = -Infinity;
    for (let i=0;i<n;i++) {
      const arc = chargeArc(i,n);
      assert.ok(arc.start > end);
      assert.ok(arc.end > arc.start);
      end=arc.end;
      assert.equal(chargeFill(i,0),0);
      assert.equal(chargeFill(i,n),1);
    }
  }
  assert.equal(chargeFill(2,2,.4),.4);
  assert.equal(chargeFill(3,2,.4),0);
  assert.equal(chargeFill(2,2,4),1);
});

test('boost and recharge fractions normalize to actual capacity and clamp',()=>{
  assert.equal(unitFill(100,200),.5);
  assert.equal(unitFill(-1,100),0);
  assert.equal(unitFill(240,200),1);
  assert.equal(unitFill(4,0),0);
});

test('selected art is versioned and matches provenance hashes',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../art/hud/ability-gauges/manifest.json',import.meta.url)));
  for(const spec of Object.values(manifest.assets)) {
    const bytes=readFileSync(new URL('../'+spec.runtime,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),spec.runtimeSha256);
    assert.equal(bytes.readUInt32BE(16),256);
    assert.equal(bytes.readUInt32BE(20),256);
    assert.equal(bytes[25],6); // RGBA
  }
});

test('art loader caches successful decodes and permanently falls back on load/decode failure',async()=>{
  const originalImage=globalThis.Image,originalDocument=globalThis.document;
  const images=[];
  globalThis.Image=class {
    constructor(){images.push(this);}
    decode(){return this.src.includes('/od-') ? Promise.reject(new Error('bad decode')) : Promise.resolve();}
  };
  globalThis.document={createElement:()=>({getContext:()=>({drawImage(){}})})};
  try {
    const {prewarmGaugeImages,gaugeImage}=await import('../src/render/gaugeImages.js');
    assert.equal(gaugeImage('dash'),null);
    const ready=prewarmGaugeImages();
    assert.equal(images.length,3);
    images[0].onload(); images[1].onload(); images[2].onerror();
    await ready;
    assert.ok(gaugeImage('dash'));
    assert.equal(gaugeImage('od'),null);
    assert.equal(gaugeImage('boost'),null);
    await prewarmGaugeImages();
    assert.equal(images.length,3);
  } finally {globalThis.Image=originalImage;globalThis.document=originalDocument;}
});
