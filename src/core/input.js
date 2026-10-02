// Unified input: keyboard, mouse, touch (relative drag + buttons) and gamepad.
// Presses are buffered briefly so a dash pressed a hair early still fires.

import { view } from '../game/state.js';

const BIND = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  dash: ['Space', 'KeyK', 'KeyJ', 'KeyX'],
  od: ['KeyE', 'KeyL', 'KeyQ', 'KeyC'],
  focus: ['ShiftLeft', 'ShiftRight'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'NumpadEnter', 'Space'],
  back: ['Escape', 'Backspace'],
  reroll: ['KeyR'],
  one: ['Digit1', 'Numpad1'],
  two: ['Digit2', 'Numpad2'],
  three: ['Digit3', 'Numpad3'],
  map: ['KeyM', 'Tab'], // overworld route map overlay
};

const codeToActions = new Map();
for (const [action, codes] of Object.entries(BIND)) {
  for (const c of codes) {
    if (!codeToActions.has(c)) codeToActions.set(c, []);
    codeToActions.get(c).push(action);
  }
}

const held = new Set(); // actions currently held (keyboard)
const padHeld = new Set();
const pressedAt = new Map(); // action -> timestamp of last press

export const input = {
  device: 'keyboard', // keyboard | mouse | touch | pad
  // Movement: either a direction vector (keys/pad) or an absolute target (mouse/touch).
  mode: 'dir',
  dx: 0,
  dy: 0,
  tx: 0,
  ty: 0,
  hasTarget: false,
  touch: null, // { id, sx, sy, ax, ay }
  // Mouse: the target is the cursor plus this offset. A dash shifts it so the ship
  // doesn't snap back to the cursor; it bleeds off as the mouse moves.
  ox: 0,
  oy: 0,
  holding: false,
  mouseDown: false, // left mouse button held (overworld click-to-fly)
  padX: 0,
  padY: 0,
  getAnchor: () => ({ x: view.W / 2, y: view.H * 0.8 }),
  onAnyGesture: null,
  onDeviceChange: null,
  isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,

  press(action) {
    pressedAt.set(action, performance.now());
  },
  consume(action, windowMs = 140) {
    const t = pressedAt.get(action);
    if (t === undefined) return false;
    pressedAt.delete(action);
    return performance.now() - t <= windowMs;
  },
  clear() {
    pressedAt.clear();
  },
  down(action) {
    return held.has(action) || padHeld.has(action);
  },
  // Any key / pad button held or stick deflected (menus wait for this to clear).
  anyHeld() {
    return held.size > 0 || padHeld.size > 0 || Math.hypot(this.padX || 0, this.padY || 0) > 0.3;
  },
  // Move the steering target with the ship (dash), so pointer steering keeps the new position.
  shiftTarget(dx, dy) {
    this.tx += dx;
    this.ty += dy;
    if (this.touch) {
      this.touch.ax += dx;
      this.touch.ay += dy;
    } else if (this.device === 'mouse') {
      this.ox += dx;
      this.oy += dy;
    }
  },
  // Steer toward the ship's current position until the pointer moves again.
  holdTarget() {
    const a = this.getAnchor();
    this.tx = a.x;
    this.ty = a.y;
    this.ox = 0;
    this.oy = 0;
    this.holding = this.device === 'mouse';
  },
  setDevice(d) {
    if (this.device !== d) {
      this.device = d;
      if (this.onDeviceChange) this.onDeviceChange(d);
    }
  },
};

function gesture() {
  if (input.onAnyGesture) input.onAnyGesture();
}

window.addEventListener('keydown', (e) => {
  const actions = codeToActions.get(e.code);
  gesture();
  if (!actions) return;
  // Keep the page from scrolling / buttons from double-activating.
  // Menus are driven by our own navigation, so native button activation and
  // page scrolling are suppressed.
  if (['Space', 'Enter', 'NumpadEnter', 'Backspace', 'Tab'].includes(e.code) || e.code.startsWith('Arrow')) e.preventDefault();
  input.setDevice('keyboard');
  for (const a of actions) {
    if (!e.repeat) input.press(a);
    held.add(a);
  }
  if (['up', 'down', 'left', 'right'].some((a) => actions.includes(a))) input.mode = 'dir';
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') e.preventDefault();
  const actions = codeToActions.get(e.code);
  if (!actions) return;
  for (const a of actions) held.delete(a);
});

window.addEventListener('blur', () => {
  input.mouseDown = false;
  held.clear();
  padHeld.clear();
});

// --- Pointer (mouse + touch) -------------------------------------------------

function toLogical(clientX, clientY) {
  const r = view.rect;
  return { x: (clientX - r.left) / view.scale, y: (clientY - r.top) / view.scale };
}

function mouseTarget(e, moved) {
  const p = toLogical(e.clientX, e.clientY);
  if (input.holding) {
    // First move after holdTarget: re-anchor so the ship follows from where it is.
    input.holding = false;
    input.ox = input.tx - p.x;
    input.oy = input.ty - p.y;
  }
  const k = Math.exp(-moved / 140);
  input.ox *= k;
  input.oy *= k;
  input.mode = 'target';
  input.tx = Math.max(0, Math.min(view.W, p.x + input.ox));
  input.ty = Math.max(0, Math.min(view.H, p.y + input.oy));
  input.ox = input.tx - p.x;
  input.oy = input.ty - p.y;
  input.hasTarget = true;
}

export function bindPointer(surface) {
  surface.addEventListener('contextmenu', (e) => e.preventDefault());

  surface.addEventListener('pointerdown', (e) => {
    gesture();
    if (e.pointerType === 'touch') {
      input.setDevice('touch');
      if (!input.touch) {
        const a = input.getAnchor();
        const p = toLogical(e.clientX, e.clientY);
        input.touch = { id: e.pointerId, sx: p.x, sy: p.y, ax: a.x, ay: a.y };
        input.mode = 'target';
        input.tx = a.x;
        input.ty = a.y;
        input.hasTarget = true;
      } else {
        // A second finger anywhere on the field dashes.
        input.press('dash');
      }
      e.preventDefault();
    } else {
      input.setDevice('mouse');
      if (e.button === 0) {
        input.press('dash');
        input.mouseDown = true;
      }
      else if (e.button === 2) input.press('od');
      mouseTarget(e, 0);
    }
  }, { passive: false });

  surface.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') {
      const t = input.touch;
      if (!t || t.id !== e.pointerId) return;
      const p = toLogical(e.clientX, e.clientY);
      const sens = 1.35;
      input.tx = t.ax + (p.x - t.sx) * sens;
      input.ty = t.ay + (p.y - t.sy) * sens;
      // Re-anchor when the finger drags the target past the playfield edge so
      // reversing direction responds immediately.
      const cx = Math.max(0, Math.min(view.W, input.tx));
      const cy = Math.max(0, Math.min(view.H, input.ty));
      if (cx !== input.tx || cy !== input.ty) {
        t.ax = cx;
        t.ay = cy;
        t.sx = p.x;
        t.sy = p.y;
        input.tx = cx;
        input.ty = cy;
      }
      e.preventDefault();
    } else {
      if (e.movementX === 0 && e.movementY === 0) return;
      if (input.device !== 'mouse' && Math.abs(e.movementX) + Math.abs(e.movementY) < 3) return;
      input.setDevice('mouse');
      mouseTarget(e, Math.hypot(e.movementX, e.movementY) / view.scale);
    }
  }, { passive: false });

  const end = (e) => {
    if (e.pointerType !== 'touch' && e.button === 0) input.mouseDown = false;
    if (input.touch && input.touch.id === e.pointerId) {
      input.touch = null;
      // Hold position where the ship is.
      const a = input.getAnchor();
      input.tx = a.x;
      input.ty = a.y;
    }
  };
  surface.addEventListener('pointerup', end);
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch' && e.button === 0) input.mouseDown = false; // released off the canvas
  });
  surface.addEventListener('pointercancel', end);
}

// --- Gamepad -----------------------------------------------------------------

const padPrev = [];
const PAD_BUTTONS = {
  0: ['dash', 'confirm'],
  1: ['od', 'back'],
  2: ['od'],
  3: ['reroll'],
  4: ['focus'],
  5: ['focus'],
  6: ['focus'],
  7: ['dash'],
  8: ['back', 'map'],
  9: ['pause'],
  12: ['up'],
  13: ['down'],
  14: ['left'],
  15: ['right'],
};
let stickLatch = { x: 0, y: 0 };

export function pollGamepads() {
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  let pad = null;
  for (const p of pads) if (p && p.connected) { pad = p; break; }
  padHeld.clear();
  if (!pad) {
    input.padX = 0;
    input.padY = 0;
    return;
  }

  let active = false;
  for (const [idx, actions] of Object.entries(PAD_BUTTONS)) {
    const b = pad.buttons[idx];
    const pressed = !!(b && (b.pressed || b.value > 0.5));
    if (pressed) {
      active = true;
      for (const a of actions) padHeld.add(a);
      if (!padPrev[idx]) for (const a of actions) input.press(a);
    }
    padPrev[idx] = pressed;
  }

  let ax = pad.axes[0] || 0;
  let ay = pad.axes[1] || 0;
  const mag = Math.hypot(ax, ay);
  if (mag < 0.2) { ax = 0; ay = 0; } else {
    const scaled = Math.min(1, (mag - 0.2) / 0.75);
    ax = (ax / mag) * scaled;
    ay = (ay / mag) * scaled;
    active = true;
  }
  if (padHeld.has('left')) ax = -1;
  if (padHeld.has('right')) ax = 1;
  if (padHeld.has('up')) ay = -1;
  if (padHeld.has('down')) ay = 1;

  // Menu navigation from the stick (edge triggered).
  const sx = Math.abs(pad.axes[0] || 0) > 0.6 ? Math.sign(pad.axes[0]) : 0;
  const sy = Math.abs(pad.axes[1] || 0) > 0.6 ? Math.sign(pad.axes[1]) : 0;
  if (sx !== stickLatch.x && sx !== 0) input.press(sx < 0 ? 'left' : 'right');
  if (sy !== stickLatch.y && sy !== 0) input.press(sy < 0 ? 'up' : 'down');
  stickLatch = { x: sx, y: sy };

  if (active) {
    input.setDevice('pad');
    input.mode = 'dir';
    gesture();
  }
  input.padX = ax;
  input.padY = ay;
}

// Direction from keyboard + pad (only meaningful in 'dir' mode).
export function readDirection() {
  let x = 0;
  let y = 0;
  if (held.has('left')) x -= 1;
  if (held.has('right')) x += 1;
  if (held.has('up')) y -= 1;
  if (held.has('down')) y += 1;
  if (input.device === 'pad') {
    x = input.padX || 0;
    y = input.padY || 0;
  }
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  input.dx = x;
  input.dy = y;
  return input;
}
