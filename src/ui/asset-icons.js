// Artwork lives beside the game's ES modules, so hosting under a subpath works.
export function assetIcon(group, id, fallback = '') {
  const url = new URL(`../assets/icons/${group}/${id}.png`, import.meta.url).href;
  return `<span class="asset-icon"><img src="${url}" alt="" decoding="async" draggable="false"><span class="asset-icon-fallback">${fallback}</span></span>`;
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
  document.addEventListener('error', (event) => {
    const img = event.target;
    if (img?.matches?.('.asset-icon > img')) img.parentElement.classList.add('asset-icon-missing');
  }, true);
}
