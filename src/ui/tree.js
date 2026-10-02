// Passive tree screen (opened from PILOT): a pan / zoom canvas of one class's node wheel, a fixed detail panel and
// class tabs. Rules (points, linking, refunds) live in game/tree.js.
// Input: mouse hover selects and click allocates / refunds; touch taps select, a second tap on the selected node
// toggles it; drag pans; wheel / pinch / the corner buttons zoom. Keys and pad: while the view is focused the arrows
// walk between nodes (an arrow with no node that way moves focus out as usual) and confirm toggles; +/- zoom.

import { G } from '../game/state.js';
import { input } from '../core/input.js';
import { sfx } from '../core/audio.js';
import { CLASSES, classById, activeClass, classUnlocked } from '../game/pilot.js';
import { THEMES, treeFor, allocated, treePoints, pointsLeft, canAllocate, canRefund, allocate, refund, resetTree, coreExpand, sumMods, describe } from '../game/tree.js';
import { rankFor } from '../game/economy.js';
import { profile } from '../core/storage.js';
import { ui, $ } from './screens.js';

const lockSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
const RIM = 8.3; // the fit zoom shows everything inside this ring
const MIN_Z = 0.8;
const MAX_Z = 3.2;

let cls = 'striker';
let onBack = null;
let cursor = null; // selected node id
let note = ''; // transient state line (a refused action)
let noteT = 0;
const cam = { x: 0, y: 0, z: 1 }; // centre (ring units) and zoom (1 = fit)
let rafOn = false;
let viewEl = null;
let cv = null;
let ctx = null;

// --- Geometry ----------------------------------------------------------------------------------------------------------

const pos = (n) => {
  const a = (n.ang * Math.PI) / 180;
  return { x: n.ring * Math.cos(a), y: n.ring * Math.sin(a) };
};
const radius = (n) => (n.kind === 'root' ? 0.4 : n.kind === 'key' ? 0.42 : n.kind === 'notable' ? 0.31 : 0.2);
const colorOf = (n) => (n.theme ? THEMES[n.theme].color : classById(cls).color);

function scale() {
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  return (Math.min(w, h) / 2 / RIM) * cam.z;
}

function toScreen(x, y) {
  const s = scale();
  return { x: cv.clientWidth / 2 + (x - cam.x) * s, y: cv.clientHeight / 2 + (y - cam.y) * s };
}

function toWorld(sx, sy) {
  const s = scale();
  return { x: (sx - cv.clientWidth / 2) / s + cam.x, y: (sy - cv.clientHeight / 2) / s + cam.y };
}

function clampCam() {
  const lim = RIM * Math.max(0, 1 - 1 / cam.z) + 0.6;
  cam.x = Math.max(-lim, Math.min(lim, cam.x));
  cam.y = Math.max(-lim, Math.min(lim, cam.y));
}

function zoomAt(f, sx, sy) {
  const before = toWorld(sx, sy);
  cam.z = Math.max(MIN_Z, Math.min(MAX_Z, cam.z * f));
  const after = toWorld(sx, sy);
  cam.x += before.x - after.x;
  cam.y += before.y - after.y;
  clampCam();
}

function nodeAt(sx, sy) {
  const t = treeFor(cls);
  const s = scale();
  let best = null;
  let bd = Infinity;
  for (const n of t.list) {
    const p = toScreen(pos(n).x, pos(n).y);
    const r = Math.max(radius(n) * s, 7) + 5;
    const d = Math.hypot(p.x - sx, p.y - sy);
    if (d < r && d < bd) {
      bd = d;
      best = n;
    }
  }
  return best;
}

// Keep the selected node inside the view (keys / pad walk).
function follow(n) {
  const p = toScreen(pos(n).x, pos(n).y);
  const m = 40;
  const s = scale();
  if (p.x < m) cam.x -= (m - p.x) / s;
  if (p.x > cv.clientWidth - m) cam.x += (p.x - cv.clientWidth + m) / s;
  if (p.y < m) cam.y -= (m - p.y) / s;
  if (p.y > cv.clientHeight - m) cam.y += (p.y - cv.clientHeight + m) / s;
  clampCam();
}

// --- State helpers -----------------------------------------------------------------------------------------------------

const owned = () => classUnlocked(classById(cls));

function stateOf(n, have) {
  if (n.kind === 'root') return 'root';
  if (have.has(n.id)) return 'on';
  const t = treeFor(cls);
  return n.links.some((l) => l === t.root.id || have.has(l)) ? 'open' : 'off';
}

function verb() {
  return input.device === 'touch' ? 'TAP AGAIN' : input.device === 'mouse' ? 'CLICK' : input.device === 'pad' ? 'PRESS A' : 'PRESS ENTER';
}

function setNote(text) {
  note = text;
  noteT = performance.now() + 1800;
}

function toggle(id) {
  if (!owned()) {
    setNote('UNLOCK THIS CLASS TO USE ITS TREE');
    sfx.ui();
    return renderDetail();
  }
  const have = new Set(allocated(cls));
  if (have.has(id)) {
    const err = refund(cls, id);
    if (err) {
      setNote('IN USE · REFUND THE NODES PAST IT FIRST');
      sfx.ui();
    } else sfx.select();
  } else {
    const err = canAllocate(cls, id);
    if (err === 'NO POINTS') setNote('NO POINTS LEFT · RANK UP OR EXPAND THE FLUX CORE');
    else if (err === 'NOT CONNECTED') setNote('LINK A NEIGHBOURING NODE FIRST');
    if (err) sfx.ui();
    else {
      allocate(cls, id);
      sfx.levelUp();
    }
  }
  renderTop();
  renderDetail();
}

// --- DOM parts ---------------------------------------------------------------------------------------------------------

function renderTop() {
  const act = activeClass();
  $('#tree-tabs').innerHTML = CLASSES.map((c) => {
    const open = classUnlocked(c);
    return `<button class="cls-tab${act.id === c.id ? ' cur' : ''}${cls === c.id ? ' view' : ''}${open ? '' : ' locked'}" data-act="treeCls" data-id="${c.id}" style="--c:${c.color}" aria-pressed="${cls === c.id}"><span class="cls-ico">${open ? c.icon : lockSvg}</span><b>${c.name}</b></button>`;
  }).join('');
  const c = classById(cls);
  const used = allocated(cls).length;
  const total = treePoints();
  const left = pointsLeft(cls);
  const el = $('#tree-points');
  el.style.setProperty('--c', c.color);
  const src = `RANK ${rankFor(profile.rankXp).rank}${coreExpand() ? ` + ${coreExpand()} FLUX` : ''}`;
  el.innerHTML = `<span>POINTS <b>${used} / ${total}</b> · ${src}</span><span class="${left > 0 ? 'free' : ''}">${owned() ? (left > 0 ? `${left} UNSPENT` : 'ALL SPENT') : 'CLASS LOCKED'}</span>`;
  viewEl.style.setProperty('--c', c.color);
  $('#tree-reset').disabled = !used;
}

function renderDetail() {
  const t = treeFor(cls);
  const n = t.nodes.get(cursor) || t.root;
  const el = $('#tree-detail');
  el.style.setProperty('--c', colorOf(n));
  const have = new Set(allocated(cls));
  const st = stateOf(n, have);
  let tag;
  let name = n.name;
  let desc = n.desc;
  if (n.kind === 'root') {
    const c = classById(cls);
    name = `${c.name} CORE`;
    tag = allocated(cls).length ? 'BUILD TOTAL' : c.role.toUpperCase();
    const ids = allocated(cls);
    const keys = ids.map((id) => t.nodes.get(id)).filter((x) => x.kind === 'key').map((x) => x.name);
    desc = ids.length ? `${keys.length ? `${keys.join(', ')}. ` : ''}${describe(sumMods(cls, ids))}` : 'Every path starts here. Spend points on linked nodes and work outward; refunds are free.';
  } else if (n.bridge) tag = 'LINK';
  else if (n.kind === 'key') tag = `KEYSTONE · ${THEMES[n.theme].name}`;
  else if (n.kind === 'notable') tag = `NOTABLE · ${THEMES[n.theme].name}`;
  else {
    name = THEMES[n.theme].name;
    tag = 'NODE';
  }
  let line;
  let go = false;
  if (performance.now() < noteT) line = note;
  else if (st === 'root') line = owned() ? `${pointsLeft(cls)} POINTS TO SPEND` : 'UNLOCK THIS CLASS TO USE ITS TREE';
  else if (st === 'on') line = canRefund(cls, n.id) ? 'ALLOCATED · IN USE BY NODES PAST IT' : `ALLOCATED · ${verb()} TO REFUND`;
  else if (st === 'open') {
    go = owned() && pointsLeft(cls) > 0;
    line = !owned() ? 'UNLOCK THIS CLASS TO USE ITS TREE' : go ? `${verb()} TO ALLOCATE · 1 POINT` : 'NO POINTS LEFT · RANK UP OR EXPAND THE FLUX CORE';
  } else line = 'NOT LINKED YET · ALLOCATE A NEIGHBOUR FIRST';
  el.innerHTML = `<div class="td-top"><b>${name}</b><em>${tag}</em></div><span>${desc}</span><i class="${go ? 'go' : ''}">${line}</i>`;
}

// --- Canvas ------------------------------------------------------------------------------------------------------------

function hexPath(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    c[i ? 'lineTo' : 'moveTo'](x + r * Math.cos(a), y + r * Math.sin(a));
  }
  c.closePath();
}

function draw() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  const c = ctx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  const t = treeFor(cls);
  const s = scale();
  const have = new Set(allocated(cls));
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
  const canSpend = owned() && pointsLeft(cls) > 0;
  const O = toScreen(0, 0);

  // Wedge guides: faint rings and theme labels at the rim.
  c.lineWidth = 1;
  c.strokeStyle = 'rgba(63, 246, 255, 0.07)';
  for (let r = 1; r <= 7; r++) {
    c.beginPath();
    c.arc(O.x, O.y, r * s, 0, Math.PI * 2);
    c.stroke();
  }
  const fs = Math.max(9, Math.min(15, s * 0.42));
  c.font = `700 ${fs}px Orbitron, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (const n of t.list) {
    if (n.kind !== 'key') continue;
    // Above the keystone in the top half, below it in the bottom half (side labels then never sit on a node).
    const k = pos(n);
    const up = k.y < 0 ? -1 : 1;
    const p = toScreen(k.x, k.y);
    p.y += up * (Math.max(5, radius(n) * s) + fs * 0.9);
    const label = THEMES[n.theme].name;
    const half = c.measureText(label).width / 2 + 6;
    c.fillStyle = THEMES[n.theme].color;
    c.globalAlpha = 0.75;
    c.fillText(label, Math.max(half, Math.min(w - half, p.x)), Math.max(fs, Math.min(h - fs, p.y))); // kept inside the frame
  }
  c.globalAlpha = 1;

  // Links.
  for (const n of t.list) {
    for (const id of n.links) {
      if (id < n.id) continue; // each pair once
      const m = t.nodes.get(id);
      const a = toScreen(pos(n).x, pos(n).y);
      const b = toScreen(pos(m).x, pos(m).y);
      const onA = n.kind === 'root' || have.has(n.id);
      const onB = m.kind === 'root' || have.has(m.id);
      const col = n.kind === 'root' ? colorOf(m) : colorOf(n);
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      if (onA && onB) {
        c.strokeStyle = col;
        c.lineWidth = Math.max(2, s * 0.08);
        c.shadowColor = col;
        c.shadowBlur = 8;
        c.globalAlpha = 1;
      } else if (onA || onB) {
        c.strokeStyle = col;
        c.lineWidth = Math.max(1.5, s * 0.05);
        c.shadowBlur = 0;
        c.globalAlpha = canSpend ? 0.35 + 0.25 * pulse : 0.3;
      } else {
        c.strokeStyle = 'rgba(233, 244, 255, 0.16)';
        c.lineWidth = Math.max(1, s * 0.035);
        c.shadowBlur = 0;
        c.globalAlpha = 1;
      }
      c.stroke();
    }
  }
  c.shadowBlur = 0;
  c.globalAlpha = 1;

  // Nodes.
  for (const n of t.list) {
    const p = toScreen(pos(n).x, pos(n).y);
    const r = Math.max(n.kind === 'small' ? 3.5 : 5, radius(n) * s);
    const col = colorOf(n);
    const st = stateOf(n, have);
    const shape = () => {
      if (n.kind === 'key') hexPath(c, p.x, p.y, r);
      else {
        c.beginPath();
        c.arc(p.x, p.y, r, 0, Math.PI * 2);
      }
    };
    shape();
    if (st === 'on' || st === 'root') {
      c.fillStyle = col;
      c.shadowColor = col;
      c.shadowBlur = 12;
      c.fill();
      c.shadowBlur = 0;
      if (n.kind !== 'small') {
        c.fillStyle = 'rgba(5, 3, 13, 0.55)';
        if (n.kind === 'key') hexPath(c, p.x, p.y, r * 0.5);
        else {
          c.beginPath();
          c.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2);
        }
        c.fill();
      }
    } else {
      c.fillStyle = '#07051a';
      c.fill();
      c.lineWidth = n.kind === 'small' ? 1.5 : 2;
      c.strokeStyle = col;
      c.globalAlpha = st === 'open' ? (canSpend ? 0.6 + 0.4 * pulse : 0.6) : 0.35;
      c.stroke();
      if (n.kind === 'notable') {
        c.beginPath();
        c.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2);
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    if (n.id === cursor) {
      c.lineWidth = 2;
      c.strokeStyle = '#ffffff';
      c.shadowColor = '#ffffff';
      c.shadowBlur = 8;
      c.beginPath();
      c.arc(p.x, p.y, r + 4 + pulse * 1.5, 0, Math.PI * 2);
      c.stroke();
      c.shadowBlur = 0;
    }
  }
}

function loop() {
  if (G.screen !== 'tree') {
    rafOn = false;
    return;
  }
  if (noteT && performance.now() >= noteT) {
    noteT = 0;
    renderDetail();
  }
  draw();
  requestAnimationFrame(loop);
}

// --- Input -------------------------------------------------------------------------------------------------------------

// Arrow / d-pad walk: the closest node roughly in that direction (screen space).
function walk(dx, dy) {
  const t = treeFor(cls);
  const from = t.nodes.get(cursor) || t.root;
  const a = pos(from);
  let best = null;
  let bs = Infinity;
  for (const n of t.list) {
    if (n === from) continue;
    const b = pos(n);
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const d = Math.hypot(vx, vy);
    const cos = (vx * dx + vy * dy) / d;
    if (cos < 0.5) continue;
    const score = d * (1 + 2.5 * (1 - cos));
    if (score < bs) {
      bs = score;
      best = n;
    }
  }
  return best;
}

function select(n) {
  if (!n || n.id === cursor) return;
  cursor = n.id;
  noteT = 0;
  renderDetail();
}

// Called by ui.update while the view is focused: handles what it can and re-queues the rest for the menu.
function keys() {
  const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  for (const [k, [dx, dy]] of Object.entries(dirs)) {
    if (!input.consume(k)) continue;
    const n = walk(dx, dy);
    if (n) {
      select(n);
      follow(n);
      sfx.ui();
    } else input.press(k); // nothing that way: let the menu move focus out of the view
  }
}

function bindView() {
  viewEl = $('#tree-view');
  cv = $('#tree-canvas');
  ctx = cv.getContext('2d');
  viewEl._keys = keys;
  const pts = new Map(); // active pointers: id → {x, y}
  let drag = null; // {x, y, moved, node, touch}
  let pinch = 0;
  const local = (e) => {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // Synthetic clicks (keyboard / pad confirm via ui.update) toggle the selected node; real clicks are handled below.
  viewEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-zoom]')) {
      const z = +e.target.closest('[data-zoom]').dataset.zoom;
      if (z) zoomAt(z > 0 ? 1.35 : 1 / 1.35, cv.clientWidth / 2, cv.clientHeight / 2);
      else Object.assign(cam, { x: 0, y: 0, z: 1 });
      sfx.ui();
      return;
    }
    if (e.detail === 0 && cursor) toggle(cursor);
  });
  viewEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('[data-zoom]')) return;
    const p = local(e);
    pts.set(e.pointerId, p);
    viewEl.setPointerCapture(e.pointerId);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
      drag = null;
    } else drag = { x: p.x, y: p.y, moved: 0, node: nodeAt(p.x, p.y), touch: e.pointerType === 'touch' };
    e.preventDefault();
  });
  viewEl.addEventListener('pointermove', (e) => {
    const p = local(e);
    if (pts.has(e.pointerId)) {
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, p);
      if (pts.size >= 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomAt(d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch = d;
        return;
      }
      if (drag) {
        drag.moved += Math.hypot(p.x - prev.x, p.y - prev.y);
        if (drag.moved > 6) {
          viewEl.classList.add('drag');
          const s = scale();
          cam.x -= (p.x - prev.x) / s;
          cam.y -= (p.y - prev.y) / s;
          clampCam();
        }
      }
    } else if (e.pointerType === 'mouse') {
      const n = nodeAt(p.x, p.y);
      if (n) select(n);
    }
  });
  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    viewEl.classList.remove('drag');
    if (pts.size < 2) pinch = 0;
    if (e.type === 'pointerup' && drag && drag.moved <= 6 && drag.node) {
      const n = drag.node;
      // Touch: the first tap selects, a tap on the selected node toggles. Mouse: hover already selected it.
      if (drag.touch && n.id !== cursor) {
        select(n);
        sfx.ui();
      } else if (n.kind !== 'root') {
        select(n);
        toggle(n.id);
      }
    }
    drag = null;
  };
  viewEl.addEventListener('pointerup', end);
  viewEl.addEventListener('pointercancel', end);
  viewEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = local(e);
    zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (G.screen !== 'tree') return;
    if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomAt(1.25, cv.clientWidth / 2, cv.clientHeight / 2);
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomAt(0.8, cv.clientWidth / 2, cv.clientHeight / 2);
  });
}

// --- Screen ------------------------------------------------------------------------------------------------------------

function show(focus) {
  G.screen = 'tree';
  renderTop();
  renderDetail();
  const el = typeof focus === 'string' ? document.querySelector(`#scr-tree ${focus}`) : focus;
  ui.show('tree', { focus: el || viewEl });
  if (!rafOn) {
    rafOn = true;
    requestAnimationFrame(loop);
  }
}

function setView(id) {
  cls = classById(id) ? id : activeClass().id;
  const t = treeFor(cls);
  cursor = t.root.id;
  Object.assign(cam, { x: 0, y: 0, z: 1 });
  noteT = 0;
}

// Opens the tree of class `id` (default: the active class); `back` runs on BACK.
export function openTree(id, back) {
  if (!viewEl) bindView();
  onBack = back;
  setView(id);
  show();
}

// Label for the PILOT screen's tree button.
export function treeLabel(id) {
  const c = classById(id);
  const left = c && classUnlocked(c) ? pointsLeft(id) : 0;
  return left > 0 ? `PASSIVE TREE · ${left} POINT${left === 1 ? '' : 'S'}` : 'PASSIVE TREE';
}

export const treeActs = {
  treeCls(btn) {
    setView(btn.dataset.id);
    sfx.ui();
    show(`.cls-tab[data-id="${cls}"]`);
  },
  treeReset() {
    if (resetTree(cls)) return;
    sfx.ui();
    show('#tree-view');
  },
  leaveTree: () => onBack && onBack(),
};

// Debug / tests (NEON.tree): the selected class and node.
export const treeView = {
  get cls() {
    return cls;
  },
  get cursor() {
    return cursor;
  },
  select(id) {
    const n = treeFor(cls).nodes.get(id);
    if (n) select(n);
  },
};
