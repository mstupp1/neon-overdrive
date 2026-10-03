// Boost (fights only: top-down, side and chase; the overworld keeps Shift as strafe / lock-on).
// Holding Shift / a pad shoulder / the touch BOOST button burns the boost meter and speeds up the stage flow: the
// node timer, the wave timer, enemies, their bullets and beams, the side terrain and the chase gates all run
// `p.flow` times faster (folded into G.enemyTimeScale by pilot.js pilotTimeScale). The player keeps real time (and gets
// a little extra top speed), so a boost clears a node sooner and scores more (scoreMul) at the price of everything
// arriving faster. Boost only works while the director is in `waves` (not in boss fights, breaks, fly-throughs).
// Meter: p.boost (0..cap). It drains while boosting, refills after a short pause, and needs `MIN` to ignite; burning it
// empty locks it until the button is released.
// Stats (recomputeStats defaults, then gear / tree / Flux Core / level-ups): st.boostCap (x capacity),
// st.boostRegen (x refill rate), st.boostEff (x burn time: the drain is divided by it), st.boostFlow (stage speed).

import { G, view, field } from './state.js';
import { damp, rand, TAU } from '../core/math.js';
import { ring, sparks, addShake } from './fx.js';
import { sfx } from '../core/audio.js';
import { sv } from './stageview.js';

export const BOOST = {
  cap: 100, // meter units at boostCap 1
  drain: 30, // units / s while boosting (÷ boostEff): ~3.3 s of burn from full
  regen: 14, // units / s (x boostRegen): ~7 s to refill from empty
  delay: 0.9, // s after a burn before the meter refills
  min: 18, // units needed to ignite
  flow: 1.6, // base stage-flow multiplier (st.boostFlow)
  speed: 0.2, // player top speed bonus per unit of extra flow
  score: 0.8, // score bonus per unit of extra flow (x1.48 at flow 1.6)
};

export const boostCap = (p) => BOOST.cap * (p.st.boostCap || 1);
export const boostScore = (p) => (p && p.boosting ? 1 + BOOST.score * ((p.st.boostFlow || BOOST.flow) - 1) : 1);
export const boostSpeed = (p) => 1 + BOOST.speed * Math.max(0, (p.flow || 1) - 1);

// Can a boost run right now? (Fights only, while waves are flowing.)
export function boostAllowed(p) {
  if (field.ow || p.dead || p.auto || G.mode !== 'run') return false;
  const d = G.director;
  return !!(d && d.state === 'waves');
}

export function resetBoost(p) {
  p.boost = boostCap(p);
  p.boosting = false;
  p.boostLock = false;
  p.boostIdle = 9;
  p.flow = 1;
  p.boostV = 0; // visual amount 0..1 (smoothed)
  p.boostKick = 0; // ignition flash timer
  p.boostTrail = 0;
}

// Called from updatePlayer every step with whether the boost control is held.
export function updateBoost(p, dt, want) {
  if (p.boost === undefined) resetBoost(p);
  const st = p.st;
  const cap = boostCap(p);
  const ok = boostAllowed(p);
  if (!want) p.boostLock = false;
  if (p.boosting) {
    if (!want || !ok || p.boost <= 0) stop(p, p.boost <= 0 && want && ok);
  } else if (want && ok && !p.boostLock && p.boost >= BOOST.min) start(p);

  if (p.boosting) {
    p.boost = Math.max(0, p.boost - (BOOST.drain / (st.boostEff || 1)) * dt);
    p.boostIdle = 0;
  } else {
    p.boostIdle += dt;
    if (p.boostIdle > BOOST.delay) p.boost = Math.min(cap, p.boost + BOOST.regen * (st.boostRegen || 1) * dt);
  }
  p.boost = Math.min(p.boost, cap);
  const target = p.boosting ? st.boostFlow || BOOST.flow : 1;
  p.flow = damp(p.flow, target, target > p.flow ? 7 : 3.5, dt);
  if (Math.abs(p.flow - target) < 0.005) p.flow = target;
  p.boostV = damp(p.boostV, p.boosting ? 1 : 0, p.boosting ? 9 : 3, dt);
  if (p.boostV < 0.003) p.boostV = 0;
  if (p.boostKick > 0) p.boostKick = Math.max(0, p.boostKick - dt);
  if (p.boosting) {
    // Afterimage trail (the dash's ghosts, lighter and denser).
    p.boostTrail -= dt;
    if (p.boostTrail <= 0) {
      p.boostTrail = 0.035;
      p.ghosts.push({ x: p.x, y: p.y, life: 0.22, bank: p.bank, boost: true });
    }
  }
}

function start(p) {
  p.boosting = true;
  p.boostKick = 0.35;
  sfx.boost();
  addShake(0.18);
  ring(p.x, p.y, 46, '#ffb13d', 0.3);
  ring(p.x, p.y, 26, '#ffffff', 0.18);
  sparks(p.x, p.y + 14, '#ffd27a', 10, 420, Math.PI / 2, 0.9);
}

function stop(p, empty) {
  p.boosting = false;
  if (empty) {
    p.boostLock = true;
    sfx.boostOut();
    sparks(p.x, p.y + 12, '#ff6a2b', 6, 200, Math.PI / 2, 1.4);
  }
}

// --- Screen-space overlay (main.js render, after bloom, before the HUD) ---------------------------------------------
// Warp streaks that follow the current view's flow (top: falling; side: right → left; chase: out of the vanishing
// point), a hot edge glow and the ignition punch.

const streaks = [];
function spawnStreak(s, mode, W, H, vp, fresh) {
  s.len = rand(50, 150);
  s.w = rand(1, 2.2);
  s.hot = Math.random() < 0.25;
  if (mode === 'chase') {
    s.a = rand(0, TAU);
    s.r = fresh ? rand(20, Math.max(W, H)) : rand(10, 60);
    s.v = rand(500, 900);
    s.cx = vp.x;
    s.cy = vp.y;
  } else {
    // Keep most streaks off the middle lane so bullets stay readable.
    let u = Math.random();
    if (Math.abs(u - 0.5) < 0.2 && Math.random() < 0.65) u = u < 0.5 ? rand(0, 0.3) : rand(0.7, 1);
    s.u = u;
    s.v = rand(1500, 2600);
    s.d = fresh ? rand(0, mode === 'side' ? W : H) : -s.len;
  }
}

export function drawBoostFx(ctx) {
  const p = G.player;
  if (!p || !p.boostV) {
    streaks.length = 0;
    return;
  }
  const V = p.boostV;
  const W = view.W;
  const H = view.H;
  const mode = sv.mode;
  const vp = sv.vanish() || { x: W / 2, y: H * 0.25 };
  const dt = Math.min(0.05, G.frameDt || 1 / 60);
  const want = Math.round(48 * (view.quality || 1));
  while (streaks.length < want) {
    const s = {};
    spawnStreak(s, mode, W, H, vp, true);
    s.mode = mode;
    streaks.push(s);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const top = view.safeTop;
  for (const s of streaks) {
    if (s.mode !== mode) {
      spawnStreak(s, mode, W, H, vp, true);
      s.mode = mode;
    }
    let x0, y0, x1, y1;
    if (mode === 'chase') {
      s.r += s.v * (0.4 + s.r / 220) * dt;
      const L = s.len * (0.25 + s.r / 400);
      const c = Math.cos(s.a);
      const n = Math.sin(s.a);
      x0 = s.cx + c * s.r;
      y0 = s.cy + n * s.r;
      x1 = s.cx + c * Math.max(0, s.r - L);
      y1 = s.cy + n * Math.max(0, s.r - L);
      if (s.r - L > Math.hypot(W, H)) spawnStreak(s, mode, W, H, vp, false);
    } else if (mode === 'side') {
      s.d += s.v * dt;
      x0 = W - s.d;
      x1 = x0 + s.len;
      y0 = y1 = top + s.u * (H - top);
      if (s.d - s.len > W) spawnStreak(s, mode, W, H, vp, false);
    } else {
      s.d += s.v * dt;
      y0 = s.d;
      y1 = y0 - s.len;
      x0 = x1 = s.u * W;
      if (s.d - s.len > H) spawnStreak(s, mode, W, H, vp, false);
    }
    ctx.globalAlpha = V * (s.hot ? 0.55 : 0.3);
    ctx.strokeStyle = s.hot ? '#fff3d6' : '#9ffcff';
    ctx.lineWidth = s.w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  // Hot edges: the frame burns amber at the rim, pulsing a little.
  const pulse = 0.85 + 0.15 * Math.sin(G.realTime * 18);
  const g = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(255,140,40,0)');
  g.addColorStop(1, `rgba(255,140,40,${0.42 * V * pulse})`);
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Ignition punch: a white flash and a ring from the ship.
  if (p.boostKick > 0) {
    const k = p.boostKick / 0.35;
    const sp = sv.active ? sv.toScreen(p.x, p.y) : p;
    ctx.globalAlpha = 0.18 * k;
    ctx.fillStyle = '#fff3d6';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.8 * k;
    ctx.strokeStyle = '#ffd27a';
    ctx.lineWidth = 3 * k + 1;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 30 + (1 - k) * 260, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

// Ship-side boost visuals (drawPlayer, in the fight frame): a shock cone ahead of the nose.
export function drawBoostShip(ctx, p) {
  const V = p.boostV;
  if (!V) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const fl = 0.8 + 0.2 * Math.sin(G.time * 40);
  for (let i = 0; i < 3; i++) {
    const r = 20 + i * 7;
    ctx.globalAlpha = V * (0.55 - i * 0.15) * fl;
    ctx.strokeStyle = i ? '#ffb13d' : '#fff3d6';
    ctx.lineWidth = 2 - i * 0.4;
    ctx.beginPath();
    ctx.arc(p.x, p.y + 4 + i * 5, r, -Math.PI / 2 - 0.75 + i * 0.12, -Math.PI / 2 + 0.75 - i * 0.12);
    ctx.stroke();
  }
  ctx.restore();
}

export const boostLen = (p) => 1 + 1.3 * (p.boostV || 0); // engine flame stretch
