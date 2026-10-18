// Comms overlay: portrait + speaker name + typewriter line, in two modes.
//  - blocking (between nodes / screens): confirm or tap finishes the line, then advances; back / Esc skips everything.
//    While blocking, main.js does not run ui.update, so menu navigation never sees these key presses.
//  - non-blocking (in play): auto-advances on a timer near the top of the field, steals no input and never pauses.
// play(lines, { blocking, onDone }) runs onDone exactly once (also when skipped or cleared). clear() drops silently.
// The box never changes size: the text area holds a fixed number of lines (3 blocking, 2 live), and a line too long
// for it is split into pages, preferably at a sentence end, else at a clause break, else between words. Each page
// types out and advances like a line of its own.

import { input } from '../core/input.js';
import { portraitArtwork } from './portraits.js';
import { sfx } from '../core/audio.js';
import { SPEAKERS } from '../game/story.js';
import { activeClass } from '../game/pilot.js';

const CPS = 52; // typewriter speed (characters / second)
const HOLD = 1.5; // non-blocking: seconds a finished line stays up (+ per character)
const LOCK = 0.3; // blocking: ignore input briefly so the press that opened the dialogue does not skip it

let el = null;
let face = null;
let nameEl = null;
let lineEl = null;
let hintEl = null;
let q = null; // { lines, i, pages, p, chars, shown, blocking, onDone, hold, age }

function init() {
  if (el) return;
  el = document.getElementById('comms');
  face = el.querySelector('.comms-face');
  nameEl = el.querySelector('.comms-name');
  lineEl = el.querySelector('.comms-line');
  hintEl = el.querySelector('.comms-hint');
  el.addEventListener('click', () => {
    if (q && q.blocking && q.age >= LOCK) comms.advance();
  });
}

function showLine() {
  const ln = q.lines[q.i];
  const sp = SPEAKERS[ln.who] || SPEAKERS.MAG;
  const col = sp.color === 'class' ? activeClass().color : sp.color;
  el.style.setProperty('--c', col);
  el.classList.toggle('glitchy', !!sp.glitch);
  nameEl.textContent = sp.name;
  const portrait = portraitArtwork(sp.portrait.replace('portrait_', ''), 256);
  portrait.classList.add('comms-face');
  face.replaceWith(portrait);
  face = portrait;
  q.pages = paginate(ln.text);
  q.p = 0;
  showPage();
}

function showPage() {
  q.chars = 0;
  q.shown = -1;
  q.hold = 0;
  lineEl.textContent = '';
  hintEl.hidden = true;
}

const page = () => q.pages[q.p];
const typed = () => q.chars >= page().length;

function fits(text) {
  lineEl.textContent = text;
  return lineEl.scrollHeight <= lineEl.clientHeight + 1;
}

const SENTENCE = /[.!?…]["'”’)\]]*$/;
const CLAUSE = /[,;:—–]["'”’)\]]*$/;

// Splits text into pages that each fit the fixed text area.
function paginate(text) {
  const pages = [];
  let words = text.trim().split(/\s+/);
  while (words.length) {
    if (fits(words.join(' '))) {
      pages.push(words.join(' '));
      break;
    }
    let n = 1; // most words that fit (at least one, even if it alone overflows)
    while (n < words.length && fits(words.slice(0, n + 1).join(' '))) n++;
    // End the page on a sentence, else a clause, as long as that keeps at least half of it.
    const at = (re) => {
      for (let k = n; k >= Math.ceil(n / 2); k--) if (re.test(words[k - 1])) return k;
      return 0;
    };
    const k = (n < words.length && (at(SENTENCE) || at(CLAUSE))) || n;
    pages.push(words.slice(0, k).join(' '));
    words = words.slice(k);
  }
  lineEl.textContent = '';
  return pages;
}

function hintText() {
  const go = input.device === 'touch' ? 'TAP' : input.device === 'pad' ? 'A' : 'ENTER';
  const skip = input.device === 'touch' ? '' : input.device === 'pad' ? ' · B SKIP' : ' · ESC SKIP';
  return `${go} ▸${skip}`;
}

export const comms = {
  get blocking() {
    return !!q && q.blocking;
  },
  get active() {
    return !!q;
  },

  play(lines, { blocking = true, onDone = null } = {}) {
    init();
    if (q) this.finish(true);
    if (!lines || !lines.length) {
      if (onDone) onDone();
      return;
    }
    q = { lines, i: 0, chars: 0, shown: -1, blocking, onDone, hold: 0, age: 0 };
    el.classList.toggle('block', blocking);
    el.classList.toggle('live', !blocking);
    el.classList.remove('hold');
    el.hidden = false;
    // Force a reflow so the entry animation restarts for each play().
    void el.offsetWidth;
    el.classList.add('on');
    if (blocking) input.clear();
    showLine();
  },

  // Finishes the typewriter, or moves to the next line / ends the dialogue.
  advance() {
    if (!q) return;
    if (!typed()) {
      q.chars = page().length;
      return;
    }
    if (q.blocking) sfx.ui();
    if (q.p + 1 < q.pages.length) {
      q.p++;
      showPage();
    } else if (q.i + 1 < q.lines.length) {
      q.i++;
      showLine();
    } else this.finish(true);
  },

  skipAll() {
    if (q) this.finish(true);
  },

  // run = call onDone.
  finish(run) {
    if (!q) return;
    const cb = q.onDone;
    const blocking = q.blocking;
    q = null;
    el.classList.remove('on', 'block', 'live', 'hold');
    el.hidden = true;
    if (blocking) input.clear();
    if (run && cb) cb();
  },

  clear() {
    this.finish(false);
  },

  // Called once per frame. `playing`: the game is in G.screen === 'play' (non-blocking lines only run then).
  update(dt, playing) {
    if (!q) return;
    q.age += dt;
    if (q.blocking) {
      if (q.age >= LOCK) {
        if (input.consume('back')) return this.skipAll();
        if (input.consume('confirm')) this.advance();
        if (!q) return;
      }
    } else {
      el.classList.toggle('hold', !playing); // hidden while paused / in menus
      if (!playing) return;
    }
    const text = page();
    if (!typed()) q.chars = Math.min(text.length, q.chars + CPS * dt);
    const n = Math.floor(q.chars);
    if (n !== q.shown) {
      q.shown = n;
      lineEl.textContent = text.slice(0, n);
    }
    if (typed()) {
      if (q.blocking) {
        if (hintEl.hidden) {
          hintEl.textContent = hintText();
          hintEl.hidden = false;
        }
      } else {
        q.hold += dt;
        if (q.hold > HOLD + text.length * 0.025) this.advance();
      }
    }
  },
};
