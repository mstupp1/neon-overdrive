// Decode module masters once and bake camera-ready canvases before the combat draw path.
import { MODULE_ART } from './moduleImageSpecs.js';

const cache = new Map();

function bake(image, id, view) {
  const spec = MODULE_ART[id];
  const size = spec.size;
  const res = 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.ceil(size * res);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(res, res);
  ctx.translate(size / 2, size / 2);
  // Side art faces right in source; compensate for the stage's clockwise quarter-turn.
  if (view === 'side') ctx.rotate(-Math.PI / 2);
  // Exported masters frame the visible footprint with transparent padding; map the full
  // square source onto the complete logical box so that padding remains meaningful.
  ctx.drawImage(image, -size / 2, -size / 2, size, size);
  return { img: canvas, size, half: size / 2, generated: true, spinAspect: spec.spinAspect };
}

function loadView(id, view) {
  const key = `${id}/${view}`;
  if (!cache.has(key)) {
    const entry = { current: null, promise: null };
    entry.promise = new Promise(resolve => {
      if (typeof Image === 'undefined' || typeof document === 'undefined') return resolve(null);
      try {
        const image = new Image();
        image.onload = () => {
          try { entry.current = bake(image, id, view); }
          catch { entry.current = null; }
          resolve(entry.current);
        };
        image.onerror = () => resolve(null);
        const revision = MODULE_ART[id].revisions?.[view] || 1;
        image.src = new URL(`../assets/modules/${id}/${view}-v${revision}.png`, import.meta.url).href;
      } catch { resolve(null); }
    });
    cache.set(key, entry);
  }
  return cache.get(key);
}

export function prewarmModuleImages() {
  if (typeof Image === 'undefined' || typeof document === 'undefined') return Promise.resolve([]);
  return Promise.all(Object.entries(MODULE_ART).flatMap(([id, spec]) => spec.views.map(view => loadView(id, view).promise)));
}

export function moduleImage(id, view, procedural) {
  const entry = cache.get(`${id}/${view}`);
  if (!entry) return procedural || null;
  return entry.current || procedural || null;
}

// Rotate physical module art inside its authored foreshortened plane. This is
// the P·R·P⁻¹ transform, so the projection remains stable while the part spins.
export function moduleSpinMatrix(angle, view, aspect = 0.42) {
  const c = Math.cos(angle), s = Math.sin(angle);
  if (view === 'side') return [c, s / aspect, -s * aspect, c];
  if (view === 'chase') return [c, s * aspect, -s / aspect, c];
  return [c, s, -s, c];
}

