// Artwork lives beside the game's ES modules, so hosting under a subpath works.
export function assetIcon(group, id, fallback = '') {
  const url = new URL(`../assets/icons/${group}/${id}.png`, import.meta.url).href;
  return `<span class="asset-icon"><img src="${url}" alt="" decoding="async" draggable="false"><span class="asset-icon-fallback">${fallback}</span></span>`;
}

// Downsample artwork once per URL, then reuse the tiny bitmap across menu icons.
// Keep the original image in place so switching the look never reloads artwork.
const PIXEL_ICON_SIZE = 48;
const pixelBitmaps = new Map();
let pixelIconsEnabled = false;

function preparePixelIcon(img) {
  const wrapper = img.parentElement;
  if (!img.complete || !img.naturalWidth || wrapper.querySelector('canvas')) return;
  let bitmap = pixelBitmaps.get(img.src);
  if (!bitmap) {
    bitmap = document.createElement('canvas');
    bitmap.width = bitmap.height = PIXEL_ICON_SIZE;
    const ctx = bitmap.getContext('2d');
    if (!ctx) return;
    // Fit without stretching, including any transparent padding in the source.
    const scale = PIXEL_ICON_SIZE / Math.max(img.naturalWidth, img.naturalHeight);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, Math.floor((PIXEL_ICON_SIZE - w) / 2), Math.floor((PIXEL_ICON_SIZE - h) / 2), w, h);
    pixelBitmaps.set(img.src, bitmap);
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PIXEL_ICON_SIZE;
  canvas.className = 'asset-icon-pixel';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(bitmap, 0, 0);
  wrapper.append(canvas);
  wrapper.classList.add('asset-icon-pixel-ready');
}

export function setPixelIconsEnabled(on) {
  pixelIconsEnabled = on;
  if (on) document.querySelectorAll('.asset-icon > img').forEach(preparePixelIcon);
}

// The overworld paints the same destination artwork onto Canvas.
export function iconImage(markup, color) {
  const img = new Image();
  const svg = markup.match(/<svg\b[\s\S]*?<\/svg>/)?.[0];
  const fallback = svg && 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" ').replaceAll('currentColor', color)
  );
  const png = markup.match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1];
  if (png && fallback) img.onerror = () => { img.onerror = null; img.src = fallback; };
  img.src = png || fallback || '';
  return img;
}

// Failed artwork requests retain the original glyph without inline handlers.
if (typeof document !== 'undefined') {
  document.addEventListener('load', (event) => {
    const img = event.target;
    if (pixelIconsEnabled && img?.matches?.('.asset-icon > img')) preparePixelIcon(img);
  }, true);
  document.addEventListener('error', (event) => {
    const img = event.target;
    if (img?.matches?.('.asset-icon > img')) img.parentElement.classList.add('asset-icon-missing');
  }, true);
}
