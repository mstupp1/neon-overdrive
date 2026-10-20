// Decode and bake static housings once. Draws only read the cache, including on failure.
const KINDS = ['dash', 'od', 'boost'];
const cache = new Map();

export function prewarmGaugeImages() {
  return Promise.all(KINDS.map(kind => {
    if (cache.has(kind)) return cache.get(kind).promise;
    const entry = { image: null, promise: null };
    cache.set(kind, entry);
    entry.promise = new Promise(resolve => {
      if (typeof Image === 'undefined' || typeof document === 'undefined') return resolve(null);
      const source = new Image();
      source.onerror = () => resolve(null);
      source.onload = async () => {
        try {
          await source.decode();
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 204; // 3x logical size; includes generated, baked rim light.
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(source, 0, 0, 204, 204);
            entry.image = canvas;
          }
        } catch { /* Procedural meters remain usable on decode/bake failure. */ }
        resolve(entry.image);
      };
      source.src = new URL(`../assets/hud/${kind}-gauge-v1.png`, import.meta.url).href;
    });
    return entry.promise;
  }));
}

export const gaugeImage = kind => cache.get(kind)?.image || null;
