// Beat clock: follows the playing music track through its pre-analysed beat map (tools/beatmap.py) and exposes a
// soft pulse for purely cosmetic visuals (floor grid, horizon, bloom, HUD accents). Nothing in gameplay reads it.
// The pulse scales with the music's actual output volume, so it fades with the Music slider, ducking and fades, and
// is gone when the music is off.

import { music } from './audio.js';
import { profile } from './storage.js';
import { BEATMAP } from '../audio/beatmap.js';

const DECAY = 0.16; // seconds for the pulse to fall to ~37%
const FULL_AT = 0.45; // music output volume (0..1) at which the pulse reaches full strength

// Decode lazily, once per track: times[] (seconds) and str[] (0..1).
const decoded = new Map();
function track(name) {
  if (decoded.has(name)) return decoded.get(name);
  const m = BEATMAP[name];
  let tr = null;
  if (m) {
    const n = m.d.length / 3;
    const times = new Float32Array(n);
    const str = new Float32Array(n);
    let t = m.t0;
    for (let i = 0; i < n; i++) {
      times[i] = t;
      str[i] = +m.d[i * 3 + 2] / 9;
      t += parseInt(m.d.substr(i * 3, 2), 36) / 100;
    }
    tr = { times, str };
  }
  decoded.set(name, tr);
  return tr;
}

export const beat = {
  pulse: 0, // 0..1, peaks on each beat and decays; already scaled by music volume and the setting
  phase: 0, // 0..1 progress through the current beat (0 = on the beat)
  count: 0, // beats seen since load; bumps once per beat
  idx: -1,
  name: null,

  update() {
    this.pulse = 0;
    const el = music.el;
    if (profile.settings.beat === false || !el || el.paused || !music.current) return;
    const tr = track(music.current);
    if (!tr) return;
    const t = el.currentTime;
    const { times, str } = tr;
    // Walk the index forward from last frame; restart the search on a track change or a backwards jump (loop/seek).
    let i = this.idx;
    if (this.name !== music.current || i < 0 || i >= times.length || times[i] > t) {
      this.name = music.current;
      i = -1;
    }
    while (i + 1 < times.length && times[i + 1] <= t) i++;
    if (i !== this.idx && i >= 0) this.count++;
    this.idx = i;
    if (i < 0) return;
    const since = t - times[i];
    const len = i + 1 < times.length ? times[i + 1] - times[i] : 0.5;
    if (since > 2) return; // past the last beat or in a long gap
    this.phase = Math.min(1, since / len);
    const vol = Math.min(1, el.volume / FULL_AT);
    this.pulse = str[i] * Math.exp(-since / DECAY) * vol;
  },
};
