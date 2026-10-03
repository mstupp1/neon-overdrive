// Boot intro: a short in-engine cinematic before the title menu.
// Beats: the night the Grid fell (ECHO's squadron holds the Genesis gate and is deleted by the Signal), MAG wakes
// ECHO from cold storage, a hero reveal, then one burst of real combat that ends in an Overdrive and the logo.
// Everything on the field is the live engine (attract mode: immortal ship, director waves); this module only scripts
// the ship (G.scriptCtrl), draws the squadron and the aura, and drives the #intro text overlay.
// Skipping: Esc / Back skips at once; any other key, click or tap arms a "press again" prompt (that first press also
// unlocks audio, so the rest plays with sound) and a second press skips.

import { G, view } from './state.js';
import { S, glow } from '../render/sprites.js';
import { TAU, rand, clamp, easeOutCubic } from '../core/math.js';
import { bg } from '../render/background.js';
import { explosion, ring, sparks, particle, flash, addShake, slowmo, hitstop } from './fx.js';
import { startSector, endlessSpec } from './director.js';
import { playerBullet } from './bullets.js';
import { applyUpgrade } from './upgrades.js';
import { damageEnemy, spawnEnemy } from './enemies.js';
import { SHIPS } from './ships.js';
import { input } from '../core/input.js';
import { music, sfx, setSfxMuted } from '../core/audio.js';

const END = 19.35; // seconds
const SQUAD = ['vector', 'needle', 'bulwark', 'phantom', 'corsair', 'monolith'];
const SIGNAL_RED = '#ff3d6e';

// Text cues: [start, end, slot, text, opts]. slot: kicker | cap | mag | name. opts.signal = red glitch style.
const CUES = [
  [0.5, 4.4, 'kicker', 'CYCLE 0 · GENESIS GATE'],
  [0.9, 2.9, 'cap', 'THE NIGHT THE GRID FELL'],
  [3.0, 4.5, 'cap', 'SIX PILOTS HELD THE GATE'],
  [4.6, 6.7, 'cap', 'I SEE ALL OF YOU.', { signal: true }],
  [7.5, 8.9, 'cap', 'ONE WAS OFFLINE.'],
  [9.0, 10.8, 'mag', 'ECHO. Wake up. You\'re the last pilot I have.'],
  [11.6, 14.0, 'name', 'ECHO'],
  [14.2, 15.9, 'cap', 'ONE SIGNATURE LEFT. DELETE IT.', { signal: true }],
];

let el = null;
let parts = null;
let s = null; // { t, done, squad[], armed, armT, cues: Map(slot → index), ult, chain[] }

function dom() {
  if (el) return;
  el = document.getElementById('intro');
  parts = {
    black: el.querySelector('.in-black'),
    kicker: el.querySelector('.in-kicker'),
    cap: el.querySelector('.in-cap'),
    mag: el.querySelector('.in-mag'),
    face: el.querySelector('.in-face'),
    name: el.querySelector('.in-name'),
    skip: el.querySelector('.in-skip'),
  };
  const fc = parts.face.getContext('2d');
  if (S.portrait_mag) fc.drawImage(S.portrait_mag.img, 0, 0, parts.face.width, parts.face.height);
  // Clicks / taps anywhere on the page arm / skip (the overlay also keeps them off the canvas steering).
  window.addEventListener('pointerdown', () => press(false));
  window.addEventListener('keydown', (e) => {
    if (!s || s.done || e.repeat) return;
    press(e.code === 'Escape' || e.code === 'Backspace');
  });
}

// A press: Esc / Back skips; anything else arms the skip prompt, a second press within the window skips.
function press(hard) {
  if (!s || s.done) return;
  if (s.t < 0.25) return; // the key that opened a replay from Settings
  if (hard || s.armT > 0) return finish(true);
  s.armT = 2.6;
  parts.skip.classList.add('armed');
  startMusic();
}

function startMusic() {
  if (s.music || !music.unlocked) return;
  s.music = true;
  music.setDuck(1);
  music.switchTo('Game World Theme 1', false);
}

// Ship control used by the player while the intro runs (player.js control()).
function ctrl() {
  const t = s.t;
  const p = G.player;
  let tx = view.W / 2;
  let ty = view.H * 0.62;
  let dash = false;
  let od = false;
  if (t >= 14.2) {
    const a = t - 14.2;
    tx = view.W / 2 + Math.sin(a * 1.7) * 120;
    ty = view.H * 0.7 + Math.sin(a * 2.6) * 34;
    for (const at of [15.3, 16.5]) if (!s.dashed[at] && t >= at) dash = s.dashed[at] = true;
    if (!s.ult && t >= 17.6) {
      s.ult = true;
      p.od = 100;
      od = true;
    }
  } else if (t >= 10.8) {
    const k = easeOutCubic(clamp((t - 10.8) / 2.2, 0, 1));
    ty = view.H * (0.8 - 0.18 * k);
  }
  return { mode: 'target', dx: 0, dy: 0, tx, ty, dash, od, focus: false };
}

// Starts the intro. setup() builds a fresh attract world and returns nothing; done() goes to the title.
function start({ setup, done }) {
  dom();
  setup();
  s = { t: 0, done: false, armT: 0, cues: new Map(), dashed: {}, ult: false, chain: [], music: false, onDone: done, dark: 1, squad: [] };
  G.screen = 'intro';
  G.scriptCtrl = ctrl;
  setSfxMuted(false);
  input.clear();
  const p = G.player;
  p.dead = true; // hidden until the reveal
  p.x = view.W / 2;
  p.y = view.H * 0.8;
  // The squadron: six wingmen in a V, one per ship, flying up from below.
  SQUAD.forEach((id, i) => {
    const side = i % 2 ? 1 : -1;
    const rank = Math.floor(i / 2);
    s.squad.push({
      id, alive: true, fireT: rand(0, 0.15), ph: rand(0, TAU),
      ox: side * (40 + rank * 52), oy: rank * 34 - 20, x: view.W / 2 + side * (40 + rank * 52), y: view.H + 60 + rank * 30,
    });
  });
  // Fast, low-level waves while the squadron fights.
  startSector({ ...endlessSpec(1), level: 2, duration: 999 });
  G.director.state = 'waves';
  G.director.spawnT = 0.5;
  G.director.diff.spawn *= 0.55;
  bg.setTheme('genesis');
  el.hidden = false;
  el.classList.remove('out');
  parts.skip.classList.remove('armed');
  const touch = input.isTouchDevice && input.device !== 'keyboard';
  parts.skip.querySelector('.soft').textContent = touch ? 'TAP TO SKIP' : 'PRESS ANY KEY TO SKIP';
  parts.skip.querySelector('.hard').textContent = touch ? 'TAP AGAIN TO SKIP' : 'PRESS AGAIN TO SKIP';
  for (const k of ['kicker', 'cap', 'mag', 'name']) parts[k].classList.remove('on', 'signal');
  startMusic();
}

function finish(skipped) {
  if (!s || s.done) return;
  s.done = true;
  G.scriptCtrl = null;
  el.classList.add('out');
  setTimeout(() => {
    if (el.classList.contains('out')) el.hidden = true;
  }, 400);
  if (skipped) flash('255,255,255', 0.35);
  const cb = s.onDone;
  cb(skipped);
}

const lineOf = (slot) => parts[slot].querySelector('.in-line');
const TYPED = { cap: 34, mag: 46 }; // typewriter speed (chars / second); other slots animate in CSS

function cue(slot, i) {
  const [, , , text, opts = {}] = CUES[i];
  const box = parts[slot];
  const line = lineOf(slot);
  box.classList.toggle('signal', !!opts.signal);
  line.textContent = TYPED[slot] ? '' : text;
  line.dataset.text = text;
  box.classList.remove('on');
  void box.offsetWidth; // restart the CSS entrance
  box.classList.add('on');
  s.cues.set(slot, { i, chars: 0, text });
  if (opts.signal) sfx.warn();
}

function typeOn(slot, dt) {
  const c = s.cues.get(slot);
  if (!c || c.chars >= c.text.length) return;
  const n = Math.floor(c.chars);
  c.chars = Math.min(c.text.length, c.chars + dt * TYPED[slot]);
  if (Math.floor(c.chars) !== n) lineOf(slot).textContent = c.text.slice(0, Math.floor(c.chars));
}

function update(raw) {
  if (!s || s.done) return;
  const t0 = s.t;
  const t = (s.t += raw);
  const at = (x) => t0 < x && t >= x;
  if (s.armT > 0 && (s.armT -= raw) <= 0) parts.skip.classList.remove('armed');
  // Gamepad / mapped keys: confirm or back count as presses too (keyboard is handled by the listener).
  if (input.device === 'pad') {
    if (input.consume('back')) press(true);
    else if (input.consume('confirm') || input.consume('dash')) press(false);
  }
  input.clear();
  startMusic();

  // Captions
  CUES.forEach(([a, b, slot], i) => {
    if (at(a)) cue(slot, i);
    if (at(b) && s.cues.get(slot) && s.cues.get(slot).i === i) parts[slot].classList.remove('on');
  });
  typeOn('cap', raw);
  typeOn('mag', raw);

  // Black fades: in from black, a hard cut after the squadron dies, back out for the reveal.
  const dark = t < 1.2 ? 1 - t / 1.2 : t < 6.9 ? 0 : t < 7.3 ? (t - 6.9) / 0.4 : t < 10.6 ? 1 : t < 11 ? 1 - (t - 10.6) / 0.4 : 0;
  if (Math.abs(dark - s.dark) > 0.004) parts.black.style.opacity = (s.dark = dark).toFixed(3);

  updateSquad(raw, t, at);
  const p = G.player;

  if (at(7.3)) {
    // Blackout: clear the field and park the director until the action beat.
    G.enemies.length = 0;
    G.eBullets.length = 0;
    G.pBullets.length = 0;
    G.pickups.length = 0;
    G.particles.length = 0;
    G.texts.length = 0;
    G.director.state = 'await';
    G.director.queue.length = 0;
  }
  if (at(10.75)) {
    // Reveal: ECHO materialises at the bottom of the gate and rises.
    p.dead = false;
    p.x = view.W / 2;
    p.y = view.H * 0.8;
    p.vx = p.vy = 0;
    p.fireT = 1e9; // hold fire during the pose
    for (const id of ['main', 'main', 'main', 'orbitals', 'orbitals']) applyUpgrade(p, id, G);
    explosion(p.x, p.y, p.ucol, 2.2);
    ring(p.x, p.y, 120, p.ucol, 0.7);
    bg.blast(p.x, p.y, 3, p.ucol);
    flash('255,255,255', 0.5);
    addShake(0.4);
    slowmo(0.5);
    sfx.overdrive();
  }
  if (t >= 10.75 && t < 14.2 && Math.random() < raw * 40) {
    // Motes rising off the ship while it holds the pose.
    particle('dot', p.x + rand(-26, 26), p.y + rand(-10, 20), rand(-8, 8), rand(-160, -60), rand(0.5, 0.9), rand(3, 6), p.ucol, 0.5);
  }
  if (at(12.6)) {
    ring(p.x, p.y, 90, p.ucol, 0.6);
    bg.blast(p.x, p.y, 2, p.ucol);
    sfx.odReady();
  }
  if (at(14.2)) {
    // Action: open fire, the Signal throws everything at the last pilot.
    p.fireT = 0;
    applyUpgrade(p, 'missiles', G);
    applyUpgrade(p, 'missiles', G);
    startSector({ ...endlessSpec(1), level: 6, duration: 999 });
    G.director.state = 'waves';
    G.director.spawnT = 0;
    G.director.diff.spawn *= 0.4;
  }
  // Scripted waves on top of the director so the action beat is always dense.
  const W = view.W;
  if (at(14.3)) for (let k = -3; k <= 3; k++) spawnEnemy('dart', W / 2 + k * 40, -20 - Math.abs(k) * 22, { mv: 'down', speed: 150, wa: 20, wf: 1.8, ph: 0, shots: k % 2 ? 1 : 0 });
  if (at(15.0)) for (let i = 0; i < 10; i++) spawnEnemy('swarm', 40 + (i * (W - 80)) / 9, -20 - (i % 2) * 26, { mv: 'down', speed: 170, wa: 30, wf: 3, shots: 0 });
  if (at(15.7)) for (const x of [W * 0.25, W * 0.75]) spawnEnemy('spinner', x, -30, { mv: 'down', speed: 90 });
  if (at(16.3)) for (let i = 0; i < 6; i++) spawnEnemy('dart', 50 + (i * (W - 100)) / 5, -20, { mv: 'down', speed: 160, wa: 60, wf: 2.2, ph: i, shots: 1 });
  if (at(16.9)) for (let i = 0; i < 12; i++) spawnEnemy('swarm', W / 2 + Math.cos((i / 12) * TAU) * 150, 120 + Math.sin((i / 12) * TAU) * 60 - 200, { mv: 'down', speed: 200, wa: 15, wf: 4, shots: 0 });
  if (at(17.62)) {
    // After the Overdrive pulse: everything still alive goes off in a staggered chain.
    slowmo(0.9);
    const left = G.enemies.filter((e) => !e.dead && !e.boss).sort((a, b) => b.y - a.y);
    s.chain = left.map((e, i) => ({ e, at: 17.7 + i * 0.045 }));
    G.director.state = 'await';
    G.director.queue.length = 0;
  }
  for (const c of s.chain) {
    if (!c.done && t >= c.at) {
      c.done = true;
      if (!c.e.dead) damageEnemy(c.e, 1e6, c.e.x, c.e.y, true);
    }
  }
  if (at(19.2)) {
    // White-out that covers the cut to the title.
    flash('255,255,255', 1);
    addShake(0.5);
  }
  if (t >= END) finish(false);
}

function updateSquad(dt, t, at) {
  const p = G.player;
  for (const w of s.squad) {
    if (!w.alive) continue;
    const tx = view.W / 2 + w.ox + Math.sin(t * 1.3 + w.ph) * 14;
    const ty = view.H * 0.8 + w.oy + Math.cos(t * 1.1 + w.ph) * 8;
    const k = 1 - Math.exp(-dt * (t < 2 ? 2.4 : 5));
    const px = w.x;
    w.x += (tx - w.x) * k;
    w.y += (ty - w.y) * k;
    w.bank = clamp((w.x - px) / (dt * 420 || 1), -1, 1);
    if (t > 0.9 && (w.fireT -= dt) <= 0) {
      w.fireT = 0.11;
      playerBullet(w.x, w.y - 12, -Math.PI / 2 + rand(-0.03, 0.03), 900, 2.5, S['pb_' + w.id], { r: 4, life: 1.2, alpha: 0.75 });
    }
  }
  // Enemy fire aims at the player; park the (hidden) player in the middle of the formation.
  if (p.dead) {
    p.x = view.W / 2;
    p.y = view.H * 0.8;
  }
  if (at(4.6)) {
    flash('255,61,110', 0.45);
    addShake(0.5);
    bg.blast(view.W / 2, view.H * 0.45, 3, SIGNAL_RED);
  }
  // The Signal deletes the squadron one ship at a time, from the wings inward.
  const order = [5, 4, 3, 2, 1, 0];
  order.forEach((idx, n) => {
    const tt = 5.0 + n * 0.3;
    const w = s.squad[idx];
    if (at(tt - 0.16)) w.bolt = 0.22;
    if (at(tt) && w.alive) {
      w.alive = false;
      explosion(w.x, w.y, SIGNAL_RED, 1.6);
      sparks(w.x, w.y, '#ffffff', 10, 360);
      addShake(0.3);
      hitstop(0.04);
      sfx.explode(1.4);
    }
  });
  for (const w of s.squad) if (w.bolt > 0) w.bolt -= dt;
}

// Drawn right after renderWorld (so bloom catches it): the squadron, the Signal bolts and the hero aura.
function draw(ctx, k) {
  if (!s || s.done) return;
  const t = s.t;
  for (const w of s.squad) {
    if (w.bolt > 0) {
      // A jagged red bolt from the top of the screen into the ship.
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = SIGNAL_RED;
      ctx.globalAlpha = Math.min(1, w.bolt / 0.1);
      ctx.lineWidth = 3;
      ctx.beginPath();
      let x = w.x + rand(-40, 40);
      ctx.moveTo(x, 0);
      for (let y = 0; y < w.y; y += 40) {
        x += (w.x - x) * 0.35 + rand(-16, 16);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w.x, w.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (!w.alive) continue;
    const spr = S['ship_' + w.id];
    const sh = SHIPS.find((x) => x.id === w.id);
    const g = glow(sh ? sh.color : '#3ff6ff', 64);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25;
    ctx.drawImage(g.img, w.x - 21, w.y - 17, 42, 42);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const sx = 1 - Math.abs(w.bank || 0) * 0.28;
    ctx.setTransform(k * sx, 0, 0, k, w.x * k + view.ox, w.y * k + view.oy);
    ctx.drawImage(spr.img, -spr.half, -spr.half, spr.size, spr.size);
    ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
  }

  // Hero aura: a light pillar and two counter-rotating rings around the ship while it holds the pose.
  const p = G.player;
  if (!p.dead && t >= 10.75 && t < 14.6) {
    const a = clamp((t - 10.75) / 0.6, 0, 1) * clamp((14.6 - t) / 0.6, 0, 1);
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createLinearGradient(0, 0, 0, view.H);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(0.6, p.ucol);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.16 * a;
    ctx.fillStyle = gr;
    const pw = 70 + Math.sin(t * 3) * 6;
    ctx.fillRect(p.x - pw / 2, 0, pw, view.H);
    ctx.globalAlpha = 0.45 * a;
    const g = glow(p.ucol, 64);
    const gs = 150 + Math.sin(t * 4) * 12;
    ctx.drawImage(g.img, p.x - gs / 2, p.y - gs / 2, gs, gs);
    ctx.strokeStyle = p.ucol;
    ctx.lineWidth = 2;
    for (const [r, sp, arc] of [[44, 1.6, 4.2], [62, -1.1, 3.4]]) {
      ctx.globalAlpha = 0.75 * a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, t * sp, t * sp + arc);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

export const intro = {
  start,
  update,
  draw,
  skip: () => finish(true),
  // Ends the intro without going to the title (a run started over it, e.g. the debug hooks).
  abort() {
    if (!s || s.done) return;
    s.done = true;
    G.scriptCtrl = null;
    el.hidden = true;
  },
  get active() {
    return !!s && !s.done;
  },
  get t() {
    return s ? s.t : 0;
  },
};
