import { S } from '../render/sprites.js';
import { menuArtwork } from './menu-art.js';

const images = new Map();

// Generated art loads once per character. Procedural portraits remain the fallback.
export function portraitArtwork(id, size = 160) {
  if (!images.has(id)) {
    const image = new Image();
    image.src = new URL(`../assets/portraits/${id}.png`, import.meta.url).href;
    images.set(id, image);
  }
  return menuArtwork(images.get(id), size, 96, S['portrait_' + id].img);
}
