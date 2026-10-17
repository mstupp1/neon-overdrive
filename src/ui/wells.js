// Text wells: fixed-height text boxes for copy whose length varies between items (ship blurbs, ability / relic / node
// descriptions, draft cards). A well never grows or shrinks with its text, so browsing items can't move the layout.
//   <p class="well" style="--lines:3">…</p>   reserves exactly 3 lines (line-height --lh, default 1.25).
// Copy that fits sits still. Copy that doesn't gets edge fades and scrolls itself like a console ticker: a beat at the
// top, a slow roll to the end, a beat there, back to the top. The mouse wheel, a touch drag and the pad's right stick
// scroll it by hand (the ticker waits while you do).

import { input } from '../core/input.js';

const HOLD_TOP = 1600; // ms before rolling
const HOLD_END = 2200; // ms parked at the end
const SPEED = 0.9; // lines per second
const MANUAL = 3500; // ms the ticker waits after a hand scroll

const state = new WeakMap(); // well → {t0, max, manual}
let dirty = true;

function measure(root) {
  dirty = false;
  root.querySelectorAll('.well').forEach((el) => {
    const max = el.scrollHeight - el.clientHeight;
    const over = max > 1;
    const s = state.get(el);
    const key = el.textContent;
    if (!s || s.key !== key) {
      // New copy: start again from the top.
      state.set(el, { t0: performance.now(), max, manual: 0, key });
      el.scrollTop = 0;
    } else s.max = max;
    el.classList.toggle('over', over);
    edges(el);
  });
}

function edges(el) {
  const max = el.scrollHeight - el.clientHeight;
  el.classList.toggle('at-top', el.scrollTop <= 0.5);
  el.classList.toggle('at-end', el.scrollTop >= max - 0.5);
}

function hand(e) {
  const el = e.target.closest && e.target.closest('.well.over');
  if (!el) return;
  const s = state.get(el);
  if (s) s.manual = performance.now() + MANUAL;
}

export function initWells(app) {
  new MutationObserver(() => (dirty = true)).observe(app, { childList: true, subtree: true, characterData: true });
  addEventListener('resize', () => (dirty = true));
  app.addEventListener('wheel', hand, { passive: true, capture: true });
  app.addEventListener('touchstart', hand, { passive: true, capture: true });
  app.addEventListener('scroll', (e) => e.target.classList?.contains('well') && edges(e.target), true);
}

// Every frame while a menu is open.
export function tickWells(root) {
  if (dirty) measure(root);
  const now = performance.now();
  const stick = Math.abs(input.aimY) > 0.35 ? input.aimY : 0;
  root.querySelectorAll('.well.over').forEach((el) => {
    const s = state.get(el);
    if (!s || el.offsetParent === null) return;
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 16;
    if (stick) {
      el.scrollTop += stick * lh * 0.25;
      s.manual = now + MANUAL;
      return;
    }
    if (now < s.manual) return;
    if (s.manual) {
      // Resume the ticker from wherever the hand left it.
      s.t0 = now - HOLD_TOP - (el.scrollTop / (lh * SPEED)) * 1000;
      s.manual = 0;
    }
    const roll = (s.max / (lh * SPEED)) * 1000;
    const t = (now - s.t0) % (HOLD_TOP + roll + HOLD_END);
    const y = t < HOLD_TOP ? 0 : t < HOLD_TOP + roll ? ((t - HOLD_TOP) / roll) * s.max : s.max;
    if (Math.abs(el.scrollTop - y) > 0.25) el.scrollTop = y;
  });
}
