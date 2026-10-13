// Title sequence + PRESS START: plays on every launch (after the boot intro on first boot), over the live title demo.
// The whole sequence is CSS keyframes keyed off one class (.play), so nothing restyles per frame; this module only
// tracks when PRESS START is ready and listens for presses.
// A press during the sequence jumps to PRESS START; a press there starts the game and hands over to the title menu.
// Any key, click / tap or gamepad button counts.

import { input } from '../core/input.js';
import { sfx } from '../core/audio.js';

const READY = 2.7; // seconds until PRESS START shows (matches the CSS delays)
const GO = 0.45; // fast-blink after the press, before the menu opens

let el = null;
let s = null; // { t, ready, go, padHeld, onDone }

function dom() {
  if (el) return;
  el = document.getElementById('press');
  window.addEventListener('pointerdown', () => press());
  window.addEventListener('keydown', (e) => {
    if (!e.repeat) press();
  });
}

function press() {
  if (!s || s.go >= 0) return;
  if (s.t < 0.2) return; // the press that ended the boot intro / a quit
  if (!s.ready) return skip();
  s.go = 0;
  el.classList.add('go');
  sfx.start();
}

// Jump straight to the finished logo with PRESS START up.
function skip() {
  s.ready = true;
  el.classList.add('done');
}

export const pressStart = {
  get active() {
    return !!s;
  },
  // done() opens the title menu. instant: skip the sequence (the boot intro already ended on the logo).
  start({ done, instant = false }) {
    dom();
    s = { t: 0, ready: false, go: -1, padHeld: true, onDone: done };
    el.classList.remove('play', 'done', 'go', 'out');
    el.hidden = false;
    void el.offsetWidth; // restart the keyframes
    el.classList.add('play');
    if (instant) skip();
    input.clear();
  },
  // Drops the screen without opening the menu (a run started from the debug hook).
  stop() {
    if (!s) return;
    s = null;
    el.hidden = true;
  },
  update(dt) {
    if (!s) return;
    s.t += dt;
    if (!s.ready && s.t >= READY) s.ready = true;
    // Gamepad: any button (rising edge; keys and pointers come through the listeners above).
    const held = input.device === 'pad' && input.anyHeld();
    if (held && !s.padHeld) press();
    s.padHeld = held;
    if (s.go >= 0 && (s.go += dt) >= GO) {
      const done = s.onDone;
      s = null;
      input.clear();
      el.classList.add('out');
      setTimeout(() => {
        if (!s) el.hidden = true;
      }, 400);
      done();
    }
  },
};
