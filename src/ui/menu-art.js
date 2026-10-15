// Menu artwork keeps both resolutions ready, so the CSS mode switch is instant.
// This is separate from gameplay sprites: changing the menu look never changes combat art.
export function menuArtwork(source, fullSize, pixelSize, fallback = source, ready = null) {
  const wrapper = document.createElement('span');
  wrapper.className = 'menu-art';
  wrapper.setAttribute('aria-hidden', 'true');
  const original = document.createElement('canvas');
  original.width = original.height = fullSize;
  original.className = 'menu-art-original';
  const pixelated = document.createElement('canvas');
  pixelated.width = pixelated.height = pixelSize;
  pixelated.className = 'menu-art-pixel';
  wrapper.append(original, pixelated);
  const paint = (image) => {
    for (const canvas of [original, pixelated]) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingQuality = 'high';
      const w = image.naturalWidth || image.width;
      const h = image.naturalHeight || image.height;
      const scale = canvas.width / Math.max(w, h);
      const dw = Math.max(1, Math.round(w * scale));
      const dh = Math.max(1, Math.round(h * scale));
      ctx.drawImage(image, Math.floor((canvas.width - dw) / 2), Math.floor((canvas.height - dh) / 2), dw, dh);
    }
  };
  if (source.complete === false || source.naturalWidth === 0) {
    paint(fallback);
    source.addEventListener('load', () => paint(source), { once: true });
  } else paint(source);
  if (ready) ready.then(image => { if (image) paint(image); });
  return wrapper;
}
