// Synthesized sound effects (Web Audio) and a streaming music player.

import { profile } from './storage.js';
import { rand, shuffle } from './math.js';

let ac = null;
let sfxBus = null;
let noiseBuf = null;
let muted = false; // attract mode / hidden tab

export function unlockAudio() {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  if (!ac) {
    ac = new Ctor();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 6;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;
    comp.connect(ac.destination);
    sfxBus = ac.createGain();
    sfxBus.gain.value = profile.settings.sfx;
    sfxBus.connect(comp);

    const len = ac.sampleRate;
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
  music.unlock();
}

export function setSfxVolume(v) {
  profile.settings.sfx = v;
  if (sfxBus) sfxBus.gain.value = v;
}

export function setSfxMuted(m) {
  muted = m;
}

// Per-sound rate limiting so dense moments don't turn into noise.
const lastPlayed = new Map();
function gate(name, ms) {
  const now = performance.now();
  const t = lastPlayed.get(name) || 0;
  if (now - t < ms) return false;
  lastPlayed.set(name, now);
  return true;
}

function ready() {
  return ac && !muted && ac.state === 'running' && profile.settings.sfx > 0.001;
}

function tone({ type = 'sine', f0 = 440, f1 = f0, dur = 0.1, vol = 0.2, attack = 0.004, delay = 0, curve = 'exp', q = 0, filter = 0 }) {
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) {
    if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    else osc.frequency.linearRampToValueAtTime(f1, t + dur);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc;
  if (filter) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    f.Q.value = q;
    osc.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(sfxBus);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, vol = 0.2, f0 = 3000, f1 = 300, q = 0.8, type = 'lowpass', delay = 0, attack = 0.002 }) {
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = rand(0.8, 1.2);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(sfxBus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

let pickupChain = 0;
let pickupChainTime = 0;

export const sfx = {
  shoot() {
    if (!ready() || !gate('shoot', 70)) return;
    tone({ type: 'square', f0: rand(820, 900), f1: 240, dur: 0.05, vol: 0.018, filter: 3200 });
  },
  hit() {
    if (!ready() || !gate('hit', 45)) return;
    tone({ type: 'triangle', f0: rand(300, 360), f1: 120, dur: 0.05, vol: 0.05 });
  },
  explode(size = 1) {
    if (!ready() || !gate('explode' + (size > 1.5 ? 'L' : 'S'), size > 1.5 ? 60 : 35)) return;
    const s = Math.min(3, size);
    noise({ dur: 0.18 + s * 0.14, vol: 0.12 + s * 0.06, f0: 2600 + s * 600, f1: 120, q: 0.6 });
    tone({ type: 'sine', f0: 170 - s * 25, f1: 38, dur: 0.16 + s * 0.12, vol: 0.14 + s * 0.08 });
  },
  playerHit() {
    if (!ready()) return;
    noise({ dur: 0.45, vol: 0.35, f0: 1800, f1: 80, q: 1.2 });
    tone({ type: 'sawtooth', f0: 220, f1: 40, dur: 0.4, vol: 0.2, filter: 900 });
  },
  shield() {
    if (!ready()) return;
    tone({ type: 'sawtooth', f0: 1400, f1: 180, dur: 0.3, vol: 0.12, filter: 2500 });
    noise({ dur: 0.25, vol: 0.12, f0: 6000, f1: 800, type: 'bandpass', q: 2 });
  },
  pickup() {
    if (!ready() || !gate('pickup', 28)) return;
    const now = performance.now();
    pickupChain = now - pickupChainTime < 350 ? Math.min(pickupChain + 1, 24) : 0;
    pickupChainTime = now;
    const f = 660 * Math.pow(2, pickupChain / 12);
    tone({ type: 'sine', f0: f, f1: f * 1.5, dur: 0.07, vol: 0.05 });
  },
  coin() {
    if (!ready() || !gate('coin', 40)) return;
    const f = rand(1500, 1700);
    tone({ type: 'triangle', f0: f, dur: 0.05, vol: 0.035 });
    tone({ type: 'triangle', f0: f * 1.5, dur: 0.09, vol: 0.03, delay: 0.045 });
  },
  levelUp() {
    if (!ready()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.18, vol: 0.12, delay: i * 0.06 }));
    tone({ type: 'sine', f0: 2093, dur: 0.5, vol: 0.05, delay: 0.24 });
  },
  dash() {
    if (!ready()) return;
    noise({ dur: 0.22, vol: 0.14, f0: 800, f1: 5000, type: 'bandpass', q: 1.5 });
  },
  graze() {
    if (!ready() || !gate('graze', 55)) return;
    tone({ type: 'sine', f0: rand(2300, 2600), dur: 0.035, vol: 0.025 });
  },
  odReady() {
    if (!ready()) return;
    [880, 1320, 1760].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.25, vol: 0.08, delay: i * 0.07 }));
  },
  overdrive() {
    if (!ready()) return;
    noise({ dur: 1.1, vol: 0.3, f0: 200, f1: 8000, type: 'bandpass', q: 0.8 });
    tone({ type: 'sawtooth', f0: 55, f1: 440, dur: 0.9, vol: 0.14, filter: 1600 });
    tone({ type: 'sine', f0: 90, f1: 30, dur: 0.9, vol: 0.35, delay: 0.05 });
  },
  zap() {
    if (!ready() || !gate('zap', 90)) return;
    noise({ dur: 0.12, vol: 0.09, f0: 7000, f1: 2000, type: 'bandpass', q: 3 });
  },
  missile() {
    if (!ready() || !gate('missile', 110)) return;
    noise({ dur: 0.16, vol: 0.06, f0: 400, f1: 2400, type: 'bandpass', q: 2 });
  },
  rail() {
    if (!ready()) return;
    tone({ type: 'sawtooth', f0: 1800, f1: 90, dur: 0.35, vol: 0.1, filter: 4000 });
    noise({ dur: 0.3, vol: 0.12, f0: 5000, f1: 400 });
  },
  nova() {
    if (!ready() || !gate('nova', 120)) return;
    tone({ type: 'triangle', f0: 200, f1: 900, dur: 0.18, vol: 0.08 });
  },
  warn() {
    if (!ready()) return;
    for (let i = 0; i < 3; i++) {
      tone({ type: 'square', f0: 440, f1: 330, dur: 0.32, vol: 0.07, delay: i * 0.55, filter: 1800 });
    }
  },
  bossDie() {
    if (!ready()) return;
    for (let i = 0; i < 6; i++) noise({ dur: 0.5, vol: 0.25, f0: 3000, f1: 80, delay: i * 0.18 });
    tone({ type: 'sine', f0: 120, f1: 25, dur: 2.2, vol: 0.4, delay: 0.1 });
  },
  heal() {
    if (!ready()) return;
    [660, 880].forEach((f, i) => tone({ type: 'sine', f0: f, f1: f * 1.02, dur: 0.2, vol: 0.1, delay: i * 0.08 }));
  },
  ui() {
    if (!ready() || !gate('ui', 40)) return;
    tone({ type: 'sine', f0: 1200, dur: 0.035, vol: 0.04 });
  },
  select() {
    if (!ready()) return;
    tone({ type: 'triangle', f0: 700, f1: 1400, dur: 0.12, vol: 0.09 });
  },
  sector() {
    if (!ready()) return;
    [392, 523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.3, vol: 0.09, delay: i * 0.09 }));
  },
};

// ---------------------------------------------------------------------------
// Music: shuffled playlist with smooth fades, boss/late-game sets and ducking.

const DIR = 'src/audio/music/';
const NORMAL = [
  'Pulse Collider 1', 'Pulse Collider 2', 'Laser Beam 1', 'Laser Beam 2', 'Heavy Gravity 1',
  'Heavy Gravity 2', 'Nebula Ghosts 1', 'Nebula Ghosts 2', 'Rocket Jungle 1', 'Rocket Jungle 2',
  'Galactic Shadows 1', 'Galactic Shadows 2', 'Neon Horizons 1', 'Neon Horizons 2', 'Neon Shadows 1',
  'Neon Shadows 2', 'Photon Drift 1', 'Photon Drift 2', 'Star Echoes 1', 'Star Echoes 2',
  'Space Crossfire 1', 'Space Crossfire 2', 'Cosmic Waves 1', 'Cosmic Waves 2', 'Galactic Frenzy 1',
  'Galactic Frenzy 2', 'Galactic Showdown 1', 'Galactic Showdown 2', 'Starfire Rumble 1', 'Starfire Rumble 2',
];
const LATE = ["The Tyrant's March", 'The Final Shadow', 'Galactic Showdown 1', 'Galactic Frenzy 2', 'Starfire Rumble 1'];
const BOSS = ['Starlover', "The Tyrant's March", 'The Final Shadow'];

const urlFor = (name) => DIR + encodeURIComponent(name) + '.mp3';

export const music = {
  el: null,
  unlocked: false,
  set: 'normal',
  queue: [],
  last: null,
  current: null,
  vol: 0, // current applied gain (0..1 before settings)
  target: 1,
  duck: 1,
  pending: null,
  onTrack: null,
  paused: false,

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.el = new Audio();
    this.el.preload = 'auto';
    this.el.addEventListener('ended', () => {
      if (this.set !== 'boss') this.next();
    });
    this.el.addEventListener('error', () => {
      // Skip unplayable tracks rather than stalling the playlist.
      setTimeout(() => this.next(), 500);
    });
    this.next();
  },

  refill() {
    const src = this.set === 'late' ? LATE : NORMAL;
    this.queue = shuffle([...src]);
    if (this.queue[0] === this.last && this.queue.length > 1) this.queue.push(this.queue.shift());
  },

  next() {
    if (!this.unlocked) return;
    if (!this.queue.length) this.refill();
    this.switchTo(this.queue.shift(), false);
  },

  switchTo(name, loop) {
    if (!this.unlocked) return;
    this.pending = { name, loop };
    // If nothing is audible yet, switch immediately.
    if (this.vol < 0.02 || this.el.paused) this.applyPending();
  },

  applyPending() {
    const { name, loop } = this.pending;
    this.pending = null;
    this.last = name;
    this.current = name;
    this.el.src = urlFor(name);
    this.el.loop = loop;
    this.vol = 0;
    this.el.volume = 0;
    const p = this.el.play();
    if (p && p.catch) p.catch(() => {});
    if (this.onTrack) this.onTrack(name);
  },

  setSet(set) {
    if (this.set === set) return;
    const wasBoss = this.set === 'boss';
    this.set = set;
    if (set === 'boss') {
      const name = BOSS[(Math.random() * BOSS.length) | 0];
      this.switchTo(name, true);
    } else {
      this.refill();
      if (wasBoss || set === 'late') this.next();
    }
  },

  bossTrack(index) {
    this.set = 'boss';
    this.switchTo(BOSS[index % BOSS.length], true);
  },

  setDuck(d) {
    this.duck = d;
  },

  update(dt) {
    if (!this.unlocked || !this.el) return;
    const want = this.pending ? 0 : this.target * this.duck;
    const speed = this.pending ? 1.6 : 0.8; // fade-out faster than fade-in
    if (this.vol < want) this.vol = Math.min(want, this.vol + dt * speed);
    else this.vol = Math.max(want, this.vol - dt * speed);
    if (this.pending && this.vol <= 0.01) this.applyPending();
    const v = Math.max(0, Math.min(1, this.vol * profile.settings.music));
    if (Math.abs(this.el.volume - v) > 0.001) this.el.volume = v;
  },

  suspend(s) {
    if (!this.el) return;
    if (s) this.el.pause();
    else if (!this.pending && this.el.src) {
      const p = this.el.play();
      if (p && p.catch) p.catch(() => {});
    }
  },
};
