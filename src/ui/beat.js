// Menu titles glow with the music beat. The beat part of the glow lives on its own layer: a .beat-glow copy of the
// title's text that draws only its shadow, faded by opacity alone. Animating the big blurred text-shadows themselves
// (the old --beat on <body>) restyled the whole page and re-rastered the glows on every frame, which made the title
// demo stutter while music played; an opacity change is handled by the compositor without repainting.
const SEL = '.logo-top, .logo-bottom, .screen-title';
let root = null;
let glows = [];
let last = -1;

function glowFor(el) {
  let g = el.querySelector(':scope > .beat-glow');
  if (!g) {
    g = document.createElement('b');
    g.className = 'beat-glow';
    g.setAttribute('aria-hidden', 'true');
    el.append(g);
  }
  const text = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('');
  if (g.textContent !== text) g.textContent = text;
  return g;
}

// screen: the open menu's element (or null); v: beat pulse 0..1. Only writes when something changed.
export function setMenuBeat(screen, v) {
  v = Math.round(v * 50) / 50;
  // A title rewritten with textContent drops its glow copy: rebuild for the new text.
  if (screen !== root || glows.some((g) => !g.isConnected)) {
    for (const g of glows) if (g.isConnected) g.style.opacity = '';
    root = screen;
    glows = root ? [...root.querySelectorAll(SEL)].map(glowFor) : [];
    last = -1;
  }
  if (v === last) return;
  last = v;
  for (const g of glows) g.style.opacity = v;
}
