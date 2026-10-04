// Tooltips for menu items: any element with data-tip (body lines, '\n'-separated) and optionally data-tip-t (title)
// and data-tip-c (title colour). One floating box over the menus, placed above the item (below when there is no room).
//  - mouse: hovering an item shows its tip, leaving hides it
//  - keys / pad: the focused item shows its tip (screens.js dispatches 'menufocus' when focus moves)
//  - touch: tapping a tip-only item (no data-act) toggles its tip; any other tap hides it
// The box is absolutely positioned outside the screens, so it never moves or resizes anything in the menu.

let box = null;
let app = null;
let owner = null;
let touchAt = -1e9; // last touch contact: its focus moves are handled by the tap toggle, not 'menufocus'

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Attribute string for an element's tip: tip('Plasma Core', '+15% damage', '#ffe14d').
export function tip(title, body = '', color = '') {
  const lines = Array.isArray(body) ? body.filter(Boolean).join('\n') : body;
  return ` data-tip-t="${esc(title || '')}" data-tip="${esc(lines)}"${color ? ` data-tip-c="${esc(color)}"` : ''}`;
}

export function initTips() {
  app = document.getElementById('app');
  box = document.createElement('div');
  box.className = 'tip';
  box.setAttribute('role', 'tooltip');
  box.hidden = true;
  app.appendChild(box);

  // Capture: the screens' own pointerover (focus follows the pointer) runs after this, so a tap's focus move is skipped.
  const touched = (e) => e.pointerType === 'touch' && (touchAt = performance.now());
  app.addEventListener('pointerover', touched, true);
  app.addEventListener('pointerdown', touched, true);
  app.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const el = e.target.closest('[data-tip]');
    if (el) showTip(el);
  });
  app.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'touch' || !owner) return;
    if (!owner.contains(e.relatedTarget)) hideTip();
  });
  app.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    const el = e.target.closest('[data-tip]');
    if (el && !el.dataset.act && el !== owner) showTip(el);
    else hideTip();
  });
  // Keyboard / pad focus (and mouse hover, which moves the focus too).
  app.addEventListener('menufocus', (e) => {
    if (performance.now() - touchAt < 500) return;
    if (e.target.dataset.tip != null) showTip(e.target);
    else hideTip();
  });
  window.addEventListener('resize', hideTip);
}

export function showTip(el) {
  if (!box || !el.isConnected) return;
  owner = el;
  box.innerHTML = '';
  const t = el.dataset.tipT;
  if (t) {
    const h = document.createElement('b');
    h.textContent = t;
    if (el.dataset.tipC) h.style.color = el.dataset.tipC;
    box.appendChild(h);
  }
  for (const line of (el.dataset.tip || '').split('\n')) {
    if (!line) continue;
    const p = document.createElement('span');
    p.textContent = line;
    box.appendChild(p);
  }
  box.style.setProperty('--c', el.dataset.tipC || 'var(--cyan)');
  box.hidden = false;
  place(el);
}

export function hideTip() {
  owner = null;
  if (box) box.hidden = true;
}

function place(el) {
  const a = app.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  box.style.left = '0px';
  box.style.top = '0px';
  const w = box.offsetWidth;
  const h = box.offsetHeight;
  const gap = 6;
  const pad = 4;
  let x = r.left - a.left + r.width / 2 - w / 2;
  x = Math.max(pad, Math.min(a.width - w - pad, x));
  let y = r.top - a.top - h - gap;
  if (y < pad) y = r.bottom - a.top + gap; // no room above: below the item
  y = Math.max(pad, Math.min(a.height - h - pad, y));
  box.style.left = `${Math.round(x)}px`;
  box.style.top = `${Math.round(y)}px`;
}
