// Bloom post pass. The finished world frame is shrunk into a small mip chain (1/4, 1/8, 1/16), squared with a
// self-multiply so only bright lines survive (a soft threshold), then added back on top. Bilinear upscaling of the
// tiny layers does the blurring, so there is no ctx.filter (Safari-safe) and the cost is a handful of small drawImages.

import { view } from '../game/state.js';
import { profile } from '../core/storage.js';
import { beat } from '../core/beat.js';

const LEVELS = [
  { div: 4, a: 0.45 },
  { div: 8, a: 0.5 },
  { div: 16, a: 0.55 },
];
const mips = LEVELS.map(() => {
  const c = document.createElement('canvas');
  return { c, g: c.getContext('2d') };
});

function fit(m, w, h) {
  if (m.c.width !== w || m.c.height !== h) {
    m.c.width = w;
    m.c.height = h;
    m.g.imageSmoothingEnabled = true;
    m.g.imageSmoothingQuality = 'low';
  }
}

export function bloom(ctx, strength = 1) {
  if (!profile.settings.bloom || view.quality < 0.5 || strength <= 0) return;
  strength *= 1 + 0.3 * beat.pulse; // a glow swell on the music's beat
  const src = ctx.canvas;
  const W = src.width;
  const H = src.height;
  let prev = src;
  for (let i = 0; i < LEVELS.length; i++) {
    const m = mips[i];
    const w = Math.max(1, Math.round(W / LEVELS[i].div));
    const h = Math.max(1, Math.round(H / LEVELS[i].div));
    fit(m, w, h);
    m.g.globalCompositeOperation = 'copy';
    m.g.drawImage(prev, 0, 0, w, h);
    if (i === 0) {
      // x*x: dark sky and dim grid fall away, neon cores stay bright.
      m.g.globalCompositeOperation = 'multiply';
      m.g.drawImage(m.c, 0, 0);
    }
    prev = m.c;
  }
  // Fold the smaller levels into the 1/4 layer so the full-size canvas only takes one additive blit.
  const base = mips[0];
  base.g.globalCompositeOperation = 'lighter';
  for (let i = 1; i < LEVELS.length; i++) {
    base.g.globalAlpha = LEVELS[i].a / LEVELS[0].a;
    base.g.drawImage(mips[i].c, 0, 0, base.c.width, base.c.height);
  }
  base.g.globalAlpha = 1;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, LEVELS[0].a * strength);
  ctx.drawImage(base.c, 0, 0, W, H);
  ctx.restore();
}
