// Sector intro: plays when a campaign run enters a star system, before its dialogue and route map.
// Warp streaks rush out of the centre, the ship drops out of hyperspace with a flash into the system's backdrop, then the
// system's own motif draws behind its title card (GENESIS lattice, CRIMSON tide, CYCLONE vortex, VOID collapse).
// Canvas only (logical units, identity camera); main.js owns the screen ('sector-intro'), input and the callback.

import { G, view } from '../game/state.js';
import { TAU, clamp, lerp, easeOutCubic, easeInOut } from '../core/math.js';
import { bg } from './background.js';
import { sfx } from '../core/audio.js';

const FONT = 'Orbitron, "Segoe UI", sans-serif';
const FONT2 = 'Rajdhani, "Segoe UI", sans-serif';
const DROP = 0.95; // end of the warp
const OUT = 3.25; // start of the fade out
const DUR = 3.75;
const GLYPHS = '#%/<>01X=+';

const st = { on: false, t: 0, sys: null, idx: 0, stars: [], dropped: false, blurb: null };

function hue(a, l = 70, s = 100) {
  return `hsla(${st.sys.hue},${s}%,${l}%,${a})`;
}

export const sectorIntro = {
  get on() {
    return st.on;
  },
  // sys: a campaign SYSTEMS entry; idx: its 0-based order (the SECTOR number).
  start(sys, idx) {
    Object.assign(st, { on: true, t: 0, sys, idx, dropped: false, blurb: null });
    st.stars.length = 0;
    const n = Math.round(160 * Math.max(0.5, view.quality));
    for (let i = 0; i < n; i++) st.stars.push({ a: Math.random() * TAU, r: 4 + Math.random() * 60, v: 0.6 + Math.random() * 0.9, w: Math.random() < 0.2 ? 2 : 1 });
    bg.setTheme(sys.id);
    bg.setHue(sys.hue);
    sfx.warp();
  },
  // Jump to the fade out (confirm / tap).
  skip() {
    if (st.on && st.t < OUT) {
      if (!st.dropped) drop();
      st.t = OUT;
    }
  },
  stop() {
    st.on = false;
  },
  // Returns true on the frame the intro finishes.
  update(dt) {
    if (!st.on) return false;
    st.t += dt;
    const warp = clamp(st.t / DROP, 0, 1);
    const speed = 0.5 + 14 * warp * warp * warp + 2 * warp;
    for (const s of st.stars) {
      s.r += s.r * s.v * speed * dt + 30 * dt;
      if (s.r > 700) s.r = 4 + Math.random() * 20;
    }
    if (!st.dropped && st.t >= DROP) drop();
    if (st.t >= DUR) {
      st.on = false;
      return true;
    }
    return false;
  },
  // Backdrop boost: full rush while warping, then the system's grid decelerates out of the drop.
  boost() {
    if (!st.on) return 1;
    if (st.t < DROP) return 9;
    return 1 + 8 * Math.exp(-2.6 * (st.t - DROP));
  },
  draw(ctx) {
    if (!st.on) return;
    const W = view.W;
    const H = view.H;
    const t = st.t;
    const cx = W / 2;
    const cy = H * 0.42;
    const fade = t > OUT ? 1 - easeInOut(clamp((t - OUT) / (DUR - OUT), 0, 1)) : 1;
    if (t < DROP) {
      drawWarp(ctx, W, H, cx, cy, t / DROP);
    } else {
      bg.draw(ctx);
      ctx.fillStyle = `rgba(3,2,10,${lerp(0.25, 0.55, fade)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.globalAlpha = fade;
      const m = t - DROP;
      drawMotif(ctx, st.sys.id, cx, cy, m, W, H);
      drawCard(ctx, W, cx, cy, m, t > OUT ? 1 + 0.08 * (1 - fade) : 1);
      ctx.restore();
      // The drop flash.
      const f = 1 - clamp(m / 0.45, 0, 1);
      if (f > 0) {
        ctx.fillStyle = `rgba(255,255,255,${0.85 * f * f})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
    // Skip hint
    if (t > 0.5 && t < OUT) {
      ctx.globalAlpha = 0.5 * clamp((t - 0.5) / 0.4, 0, 1);
      ctx.font = `700 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('TAP  ·  ENTER  TO  SKIP', cx, H - view.safeBottom - 28);
      ctx.globalAlpha = 1;
    }
  },
};

function drop() {
  st.dropped = true;
  if (st.t < DROP) st.t = DROP;
  sfx.warpOut();
  bg.blast(view.W / 2, view.H * 0.42, 4, `hsl(${st.sys.hue},100%,65%)`);
}

function drawWarp(ctx, W, H, cx, cy, k) {
  ctx.fillStyle = '#020108';
  ctx.fillRect(0, 0, W, H);
  // Core glow swelling toward the drop.
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60 + 260 * k);
  g.addColorStop(0, hue(0.35 + 0.5 * k, 80));
  g.addColorStop(1, hue(0, 50));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const stretch = 0.05 + 1.3 * k * k * k + 0.25 * k;
  for (const w of [1, 2]) {
    ctx.lineWidth = w * 1.2;
    ctx.strokeStyle = w === 1 ? hue(0.75, 80) : 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    for (const s of st.stars) {
      if (s.w !== w) continue;
      const c = Math.cos(s.a);
      const sn = Math.sin(s.a);
      const r1 = s.r * (1 + stretch);
      ctx.moveTo(cx + c * s.r, cy + sn * s.r);
      ctx.lineTo(cx + c * r1, cy + sn * r1);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// Per-system motif behind the title. m = seconds since the drop.
function drawMotif(ctx, id, cx, cy, m, W, H) {
  const a = clamp(m / 0.5, 0, 1);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 2;
  if (id === 'crimson') {
    // Tide: sine bands sweeping across the card.
    for (let b = 0; b < 6; b++) {
      const y0 = cy - 125 + b * 50;
      const amp = 10 + 16 * Math.sin(m * 1.7 + b);
      ctx.strokeStyle = hue(0.42 * a * (1 - Math.abs(b - 2.5) / 4), 60);
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) {
        const x = (i / 30) * W;
        const y = y0 + Math.sin(i * 0.42 + m * 3.2 + b * 0.9) * amp;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  } else if (id === 'cyclone') {
    // Vortex: spiral arms winding around the centre.
    const arms = 6;
    ctx.strokeStyle = hue(0.45 * a, 65);
    ctx.beginPath();
    for (let k = 0; k < arms; k++) {
      for (let j = 0; j <= 22; j++) {
        const r = 14 + j * (11 + 3 * easeOutCubic(a));
        const ang = (k / arms) * TAU + j * 0.27 - m * 2.4;
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r * 0.82;
        if (j) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  } else if (id === 'void') {
    // Collapse: rings falling into a dark core, debris spiralling in.
    for (let i = 0; i < 5; i++) {
      const f = (m * 0.55 + i / 5) % 1;
      const r = 300 * (1 - f) + 34;
      ctx.strokeStyle = hue(0.5 * a * f, 65);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = hue(0.8 * a, 80);
    for (let i = 0; i < 36; i++) {
      const f = (m * 0.4 + i / 36) % 1;
      const r = 260 * (1 - f) + 36;
      const ang = i * 2.4 + f * 5;
      ctx.fillRect(cx + Math.cos(ang) * r - 1, cy + Math.sin(ang) * r - 1, 2, 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(2,1,8,0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, 34 * a, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hue(0.9 * a, 75);
    ctx.beginPath();
    ctx.arc(cx, cy, 34 * a, 0, TAU);
    ctx.stroke();
  } else {
    // Genesis lattice: square frames expanding out of the centre, and the grid axes drawing in.
    for (let i = 0; i < 6; i++) {
      const f = (m * 0.35 + i / 6) % 1;
      const s = 30 + f * 340;
      ctx.strokeStyle = hue(0.5 * a * (1 - f), 70);
      ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
    }
    const L = easeOutCubic(clamp(m / 0.8, 0, 1));
    ctx.strokeStyle = hue(0.35 * a, 70);
    ctx.beginPath();
    ctx.moveTo(cx - (W / 2) * L, cy);
    ctx.lineTo(cx + (W / 2) * L, cy);
    // Vertical axis stops short of the title band.
    ctx.moveTo(cx, cy - 70 - (H / 2) * L);
    ctx.lineTo(cx, cy - 70);
    ctx.moveTo(cx, cy + 86);
    ctx.lineTo(cx, cy + 86 + (H / 2) * L);
    ctx.stroke();
  }
  ctx.restore();
}

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [''];
  for (const w of words) {
    const tryL = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w;
    if (ctx.measureText(tryL).width > maxW && lines[lines.length - 1]) lines.push(w);
    else lines[lines.length - 1] = tryL;
  }
  return lines;
}

// Title card: SECTOR 0N kicker, scrambled-in system name, a rule and the blurb.
function drawCard(ctx, W, cx, cy, m, scale) {
  const sys = st.sys;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Backing band (plain, square).
  const ba = clamp((m - 0.05) / 0.3, 0, 1);
  ctx.fillStyle = `rgba(3,2,10,${0.55 * ba})`;
  ctx.fillRect(0, cy - 66, W, 150);
  // Kicker
  const ka = clamp((m - 0.1) / 0.3, 0, 1);
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = hue(ka, 72);
  const kick = `SECTOR ${String(st.idx + 1).padStart(2, '0')}  ·  ACT ${sys.act}`;
  ctx.fillText(kick.split('').join(String.fromCharCode(8202)), cx - (1 - easeOutCubic(ka)) * 40, cy - 44);
  // Name: glyphs settle into letters left to right.
  const reveal = clamp((m - 0.2) / 0.7, 0, 1);
  if (reveal > 0) {
    const name = sys.name;
    const n = Math.floor(name.length * reveal);
    let out = '';
    const tick = Math.floor(G.realTime * 30);
    for (let i = 0; i < name.length; i++) {
      if (i < n || name[i] === ' ') out += name[i];
      else if (i < n + 3) out += GLYPHS[(i * 7 + tick) % GLYPHS.length];
      else out += ' ';
    }
    ctx.font = `900 36px ${FONT}`;
    const fw = ctx.measureText(name).width;
    const fit = Math.min(1, (W - 36) / fw);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(fit, fit);
    // Left-anchored at the final name's edge so the line doesn't wobble while glyphs settle.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(out, -fw / 2 + 2, 2);
    ctx.shadowColor = hue(1, 60);
    ctx.shadowBlur = 18;
    ctx.fillStyle = reveal >= 1 ? '#ffffff' : hue(1, 80);
    ctx.fillText(out, -fw / 2, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.textAlign = 'center';
  }
  // Rule
  const ra = easeOutCubic(clamp((m - 0.4) / 0.6, 0, 1));
  ctx.fillStyle = hue(0.95, 65);
  const rw = (W - 60) * ra;
  ctx.fillRect(cx - rw / 2, cy + 28, rw, 2);
  // Blurb
  const la = clamp((m - 0.9) / 0.5, 0, 1);
  if (la > 0) {
    ctx.font = `600 15px ${FONT2}`;
    if (!st.blurb) st.blurb = wrap(ctx, sys.blurb, W - 60);
    ctx.fillStyle = `rgba(255,255,255,${0.85 * la})`;
    st.blurb.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, cx, cy + 50 + i * 19));
  }
  ctx.restore();
}
