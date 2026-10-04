// In-canvas HUD: hull, score & combo, XP, sector progress, boss bar, gauges, banners.

import { G, view, sectorInfo } from '../game/state.js';
import { S, withAlpha } from './sprites.js';
import { TAU, clamp, easeOutCubic } from '../core/math.js';
import { comboMult } from '../game/player.js';
import { CLASSES } from '../game/pilot.js';
import { input } from '../core/input.js';
import { sv } from '../game/stageview.js';
import { profile } from '../core/storage.js';
import { BOOST, boostAllowed, boostCap, boostScore } from '../game/boost.js';

const FONT = 'Orbitron, "Segoe UI", sans-serif';
const FONT2 = 'Rajdhani, "Segoe UI", sans-serif';

function text(ctx, str, x, y, size, color, align = 'left', weight = 700, font = FONT) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function bar(ctx, x, y, w, h, t, color, back = 'rgba(255,255,255,0.12)') {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(t, 0, 1), h);
}

function keyHint(kind) {
  const d = input.device;
  if (kind === 'boost') return d === 'pad' ? 'LB' : d === 'touch' ? '' : 'SHIFT';
  if (d === 'pad') return kind === 'dash' ? 'A' : 'B';
  if (d === 'mouse') return kind === 'dash' ? 'LMB' : 'RMB';
  if (d === 'touch') return '';
  return kind === 'dash' ? 'SPACE' : 'E';
}

// Largest font size (<= size) at which str fits in w.
function fitSize(ctx, str, w, size, weight = 700, font = FONT) {
  ctx.font = `${weight} ${size}px ${font}`;
  const m = ctx.measureText(str).width;
  return m <= w ? size : Math.max(6, Math.floor(size * (w / m) * 10) / 10);
}

// Hull readout starting at x (vertical centre y) within width w: a heart per hull point while they fit (one slot is
// kept for the shield so it never reflows), else one heart with HP / MAX. Shared with the overworld HUD.
export function drawHull(ctx, x, y, w, p, a = 1, sz = 22, step = 19) {
  const low = p.hp === 1;
  const pulse = low ? 1 + Math.sin(G.realTime * 10) * 0.12 : 1;
  let sx;
  if ((p.maxHp + 1) * step <= w) {
    let hx = x + step / 2;
    for (let i = 0; i < p.maxHp; i++) {
      const full = i < p.hp;
      const s = full && low ? sz * pulse : sz;
      ctx.drawImage((full ? S.hudHeart : S.hudHeartEmpty).img, hx - s / 2, y - s / 2, s, s);
      hx += step;
    }
    sx = hx;
  } else {
    const s = sz * pulse;
    ctx.drawImage((p.hp > 0 ? S.hudHeart : S.hudHeartEmpty).img, x + step / 2 - s / 2, y - s / 2, s, s);
    const hs = `${p.hp}`;
    const ms = `/${p.maxHp}`;
    text(ctx, hs, x + step + 4, y + 1, 15, low ? '#ff5a7a' : '#ffffff', 'left', 700);
    const hw = ctx.measureText(hs).width;
    const room = ctx.measureText(`${p.maxHp}`).width; // fixed width, so the shield doesn't hop as hull changes
    text(ctx, ms, x + step + 4 + hw, y + 1, 11, 'rgba(255,255,255,0.55)', 'left', 700);
    sx = x + step + 4 + room + ctx.measureText(ms).width + 6 + step / 2;
  }
  if (p.shield) {
    ctx.drawImage(S.hudShield.img, sx - sz / 2, y - sz / 2, sz, sz);
  } else if (p.st.shieldInterval) {
    ctx.globalAlpha = 0.3 * a;
    ctx.drawImage(S.hudShield.img, sx - sz / 2, y - sz / 2, sz, sz);
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#3ff6ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, y, sz / 2 + 1, -Math.PI / 2, -Math.PI / 2 + TAU * (p.shieldT / p.st.shieldInterval));
    ctx.stroke();
  }
}

let hudA = 1; // overall HUD opacity (the finisher cam fades it out)

// alpha: HUD opacity (banners always draw at full strength).
export function drawHud(ctx, alpha = 1) {
  const p = G.player;
  if (!p) return;
  hudA = alpha;
  if (alpha < 0.02) return drawBanner(ctx);
  const W = view.W;
  const y0 = view.safeTop + 10;
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = alpha;

  // Fixed zones, so nothing collides however big the hull, score or labels get:
  //   left  [L0, L1]  hull · LV + XP
  //   mid   [M0, M1]  score · chain
  //   right [R0, R1]  sector · progress (the pause button sits right of R1)
  //   row 3 [R0, W-12] wallet + clock, below the pause button
  const L0 = 12, L1 = 150, M0 = 158, M1 = 292, R0 = 300, R1 = W - 56;
  const boss = G.boss;
  const hu = G.director.hunter;
  const tall = (boss && !boss.dead) || (hu && !hu.dead);

  // Top scrim (solid behind the readouts, so the world and its numbers never compete with them)
  const sh = y0 + (tall ? 74 : 60);
  const grd = ctx.createLinearGradient(0, 0, 0, sh);
  grd.addColorStop(0, 'rgba(3,2,10,0.88)');
  grd.addColorStop(0.62, 'rgba(3,2,10,0.7)');
  grd.addColorStop(1, 'rgba(3,2,10,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, sh);

  // Hull
  drawHull(ctx, L0, y0 + 10, L1 - L0, p, hudA);

  // Level + XP
  text(ctx, `LV ${p.level}`, L0, y0 + 31, 12, '#9ffcff', 'left', 700);
  ctx.font = `700 12px ${FONT}`;
  const xx = L0 + Math.max(46, ctx.measureText(`LV ${p.level}`).width + 8);
  bar(ctx, xx, y0 + 28.5, L1 - xx, 5, p.xp / p.xpNeed, '#3ff6ff');

  // Score (rolling; shrinks to fit the middle zone)
  G.displayScore += (G.score - G.displayScore) * Math.min(1, 0.2);
  if (Math.abs(G.score - G.displayScore) < 1) G.displayScore = G.score;
  const sc = Math.floor(G.displayScore).toString().padStart(8, '0');
  ctx.shadowColor = 'transparent';
  text(ctx, sc, (M0 + M1) / 2, y0 + 11, fitSize(ctx, sc, M1 - M0, 20, 700), '#ffffff', 'center', 700);

  // Combo
  const mult = comboMult();
  if (G.combo > 0) {
    const col = mult >= 5 ? '#ff3df2' : mult >= 3 ? '#ffe14d' : '#9ffcff';
    const cs = `x${mult} · ${G.combo} CHAIN`;
    text(ctx, cs, (M0 + M1) / 2, y0 + 30, fitSize(ctx, cs, M1 - M0, 11, 700), col, 'center', 700);
    bar(ctx, (M0 + M1) / 2 - 40, y0 + 38, 80, 2, G.comboTimer / 2.6, col, 'rgba(255,255,255,0.08)');
  }

  // Sector + progress (left of the pause button)
  const d = G.director;
  const run = G.run;
  const hue = `hsl(${d.spec ? d.spec.hue : sectorInfo(G.sector).hue},100%,72%)`;
  const camp = run && run.mode === 'campaign';
  const name = camp ? run.system.short : 'SECTOR';
  const pos = camp ? `${run.row + 1}/${run.route.rows.length}` : `${G.sector}`;
  const ps = fitSize(ctx, pos, 40, 12, 700);
  ctx.font = `700 ${ps}px ${FONT}`;
  const pw = ctx.measureText(pos).width;
  text(ctx, pos, R1, y0 + 9, ps, hue, 'right', 700);
  text(ctx, name, R0, y0 + 9, fitSize(ctx, name, R1 - R0 - pw - 6, 12, 700), hue, 'left', 700);
  const bossSector = !!(d.spec && (d.spec.boss || d.spec.mini));
  const pbw = R1 - R0 - (bossSector ? 10 : 0);
  bar(ctx, R0, y0 + 23, pbw, 4, d.progress, hue);
  if (d.zones > 1) {
    // Zone breaks on the progress bar.
    ctx.fillStyle = 'rgba(3,2,10,0.9)';
    for (let i = 1; i < d.zones; i++) ctx.fillRect(R0 + (pbw * i) / d.zones - 1, y0 + 22, 2, 6);
  }
  if (bossSector) {
    ctx.fillStyle = '#ff2e55';
    ctx.beginPath();
    ctx.arc(R1 - 4, y0 + 25, 4, 0, TAU);
    ctx.fill();
  }
  // Credits wallet and the run clock (row 3, under the pause button)
  const clock = `${Math.floor(G.runTime / 60)}:${Math.floor(G.runTime % 60).toString().padStart(2, '0')}`;
  text(ctx, clock, W - 12, y0 + 44, 12, 'rgba(255,255,255,0.65)', 'right', 600, FONT2);
  if (run) {
    const flash = G.realTime - (run.flash || -9) < 0.25;
    const ws = Math.floor(run.wallet || 0).toLocaleString();
    ctx.font = `600 12px ${FONT2}`;
    const room = W - 12 - ctx.measureText(clock).width - 10 - (R0 + 18);
    ctx.drawImage(S.credit.img, R0, y0 + 37, 14, 14);
    text(ctx, ws, R0 + 18, y0 + 44.5, fitSize(ctx, ws, room, 11, 700), flash ? '#fff' : '#ffd24a', 'left', 700);
  }

  // Boss bar
  if (boss && !boss.dead) {
    const by = y0 + 64;
    const bw = W - 32;
    const fill = boss.state === 'enter' ? easeOutCubic(boss.barFill) : boss.hp / boss.maxHp;
    text(ctx, boss.name, 16, by - 8, 12, boss.color, 'left', 900);
    const ph = boss.mini ? (boss.phase > 1 ? 'MINI BOSS · ENRAGED' : 'MINI BOSS') : boss.phase === 3 ? 'FINAL PHASE' : `PHASE ${boss.phase}`;
    text(ctx, ph, W - 16, by - 8, 10, 'rgba(255,255,255,0.8)', 'right', 700);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(16, by, bw, 6);
    ctx.fillStyle = boss.flash > 0 ? '#ffffff' : boss.color;
    ctx.fillRect(16, by, bw * clamp(fill, 0, 1), 6);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    if (boss.mini) ctx.fillRect(16 + bw * 0.5, by, 2, 6);
    else {
      ctx.fillRect(16 + bw * 0.66, by, 2, 6);
      ctx.fillRect(16 + bw * 0.33, by, 2, 6);
    }
  }

  // Hunter (elite-node mini-boss): compact bar under the sector info
  if (hu && !hu.dead && !(boss && !boss.dead)) {
    const hy = y0 + 64;
    const hw = Math.min(190, W - 120);
    const hx = (W - hw) / 2;
    const fill = clamp(hu.hp / hu.maxHp, 0, 1);
    text(ctx, 'HUNTER', hx, hy - 7, 11, '#ff3b3b', 'left', 900);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(hx, hy, hw, 4);
    ctx.fillStyle = hu.flash > 0 ? '#ffffff' : '#ff3b3b';
    ctx.fillRect(hx, hy, hw * fill, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(hx + hw * 0.5, hy, 2, 4);
  }

  // Gauges (fade when the ship flies near them)
  const sp = sv.active ? sv.toScreen(p.x, p.y) : p; // where the ship is on screen (other stage views map it)
  drawBothGauges(ctx, p, sp.x, sp.y, true);
  ctx.globalAlpha = 1;

  drawBanner(ctx);
}

// Overworld HUD: the ult and dash gauges (the ship is at screen sx, sy; they fade when it flies near).
export function drawGauges(ctx, sx, sy) {
  const p = G.player;
  if (!p) return;
  hudA = 1;
  ctx.textBaseline = 'middle';
  drawBothGauges(ctx, p, sx, sy);
  ctx.globalAlpha = 1;
}

// Touch buttons side (Settings): both gauges sit in one bottom corner, dash in the corner and the ult beside it,
// so one thumb works them and the other hand steers. The #touch-ui buttons sit on top (style.css, side-left).
export function buttonSide() {
  return profile.settings.touchSide === 'left' ? 'left' : 'right';
}

export function gaugeSpots() {
  const y = view.H - view.safeBottom - 46;
  const left = buttonSide() === 'left';
  const at = (d) => (left ? d : view.W - d);
  return { dash: { x: at(44), y }, od: { x: at(120), y }, boost: { x: at(44), y: y - 74 } };
}

// boost: fights only (the overworld keeps Shift as lock-on, so it has no boost gauge).
function drawBothGauges(ctx, p, sx, sy, boost = false) {
  const g = gaugeSpots();
  drawGauge(ctx, g.od.x, g.od.y, p, 'od', sx, sy);
  drawGauge(ctx, g.dash.x, g.dash.y, p, 'dash', sx, sy);
  if (boost) drawBoostGauge(ctx, g.boost.x, g.boost.y, p, sx, sy);
}

// Boost meter: a ring that drains while boosting and refills after a pause. Dim when boost can't run (boss fights,
// fly-throughs), red while it is locked after burning empty. While boosting the centre shows the score bonus.
function drawBoostGauge(ctx, x, y, p, sx, sy) {
  const near = Math.hypot(sx - x, sy - y) < 90;
  const ok = boostAllowed(p);
  ctx.globalAlpha = (near ? 0.25 : ok ? 0.9 : 0.4) * hudA;
  const r = 24;
  const cap = boostCap(p);
  const t = clamp((p.boost ?? cap) / cap, 0, 1);
  const on = p.boosting;
  const low = !on && (p.boostLock || (p.boost ?? cap) < BOOST.min);
  const col = low ? '#ff4d6d' : '#ffb13d';
  ctx.fillStyle = on ? 'rgba(40,18,4,0.7)' : 'rgba(5,3,15,0.55)';
  ctx.beginPath();
  ctx.arc(x, y, r + 4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = withAlpha(col, 0.2);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  // Ignition threshold tick
  const ma = -Math.PI / 2 + TAU * (BOOST.min / cap);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(ma) * (r - 4), y + Math.sin(ma) * (r - 4));
  ctx.lineTo(x + Math.cos(ma) * (r + 4), y + Math.sin(ma) * (r + 4));
  ctx.stroke();
  ctx.strokeStyle = on ? '#fff3d6' : col;
  ctx.lineWidth = on ? 5 + Math.sin(G.realTime * 30) * 1 : 4;
  if (on) {
    ctx.shadowColor = '#ffb13d';
    ctx.shadowBlur = 10;
  }
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * t);
  ctx.stroke();
  ctx.shadowBlur = 0;
  const hint = keyHint('boost');
  const label = on ? `x${boostScore(p).toFixed(1)}` : hint || 'HOLD';
  text(ctx, label, x, y - 1, fitSize(ctx, label, r * 1.6, 11, 700), on ? '#ffffff' : withAlpha(col, 0.9), 'center', 700);
  text(ctx, 'BOOST', x, y + r + 13, 9, col, 'center', 700);
  ctx.globalAlpha = hudA;
}

function drawGauge(ctx, x, y, p, kind, sx = p.x, sy = p.y) {
  const near = Math.hypot(sx - x, sy - y) < 90;
  ctx.globalAlpha = (near ? 0.25 : 0.9) * hudA;
  const r = 24;
  ctx.fillStyle = 'rgba(5,3,15,0.55)';
  ctx.beginPath();
  ctx.arc(x, y, r + 4, 0, TAU);
  ctx.fill();
  if (kind === 'od') {
    const active = p.odT > 0;
    const t = clamp(active ? p.odT / p.st.odDur : p.od / 100, 0, 1);
    const ready = p.od >= 100 && !active;
    const cls = CLASSES.find((c) => c.id === p.cls) || CLASSES[0];
    const col = cls.color;
    ctx.strokeStyle = withAlpha(col, 0.2);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = active || ready ? col : withAlpha(col, 0.7);
    ctx.lineWidth = ready ? 5 + Math.sin(G.realTime * 8) * 1.5 : 4;
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * t);
    ctx.stroke();
    const label = active ? 'ON' : ready ? keyHint('od') || 'TAP' : `${Math.floor(p.od)}%`;
    text(ctx, label, x, y - 1, ready || active ? 11 : 10, ready || active ? '#ffffff' : withAlpha(col, 0.85), 'center', 700);
    text(ctx, cls.ult.short, x, y + r + 13, 9, col, 'center', 700);
  } else {
    const n = p.maxCharges;
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + (i / n) * TAU + 0.12;
      const a1 = -Math.PI / 2 + ((i + 1) / n) * TAU - 0.12;
      ctx.strokeStyle = 'rgba(63,246,255,0.18)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, r, a0, a1);
      ctx.stroke();
      let fill = 0;
      if (i < p.charges) fill = 1;
      else if (i === p.charges) fill = p.rechargeT / p.st.dashRecharge;
      if (fill > 0) {
        ctx.strokeStyle = fill >= 1 ? '#3ff6ff' : 'rgba(63,246,255,0.5)';
        ctx.beginPath();
        ctx.arc(x, y, r, a0, a0 + (a1 - a0) * fill);
        ctx.stroke();
      }
    }
    const hint = keyHint('dash');
    text(ctx, hint || 'DASH', x, y - 1, hint.length > 3 ? 9 : 11, p.charges ? '#ffffff' : 'rgba(255,255,255,0.4)', 'center', 700);
    text(ctx, 'DASH', x, y + r + 13, 9, '#9ffcff', 'center', 700);
  }
  ctx.globalAlpha = hudA;
}

function drawBanner(ctx) {
  const b = G.banner;
  if (!b) return;
  if (b.kind) return drawBeat(ctx, b);
  const fade = hudA;
  const inT = Math.min(1, b.t / 0.25);
  const outT = Math.min(1, (b.dur - b.t) / 0.35);
  const a = Math.min(inT, outT) * fade;
  const cy = view.H * 0.38;
  ctx.globalAlpha = a;
  if (b.title === 'WARNING') {
    // Hazard stripes
    ctx.fillStyle = 'rgba(255,30,70,0.18)';
    ctx.fillRect(0, cy - 42, view.W, 84);
    ctx.fillStyle = 'rgba(255,30,70,0.8)';
    const off = (G.realTime * 80) % 24;
    for (let x = -24; x < view.W + 24; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x + off, cy - 42);
      ctx.lineTo(x + off + 12, cy - 42);
      ctx.lineTo(x + off + 4, cy - 34);
      ctx.lineTo(x + off - 8, cy - 34);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - off, cy + 34);
      ctx.lineTo(x - off + 12, cy + 34);
      ctx.lineTo(x - off + 4, cy + 42);
      ctx.lineTo(x - off - 8, cy + 42);
      ctx.fill();
    }
    ctx.globalAlpha = a * (Math.sin(G.realTime * 12) > -0.3 ? 1 : 0.4);
  }
  const slide = (1 - easeOutCubic(inT)) * 40;
  ctx.textBaseline = 'middle';
  ctx.font = `900 34px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(b.title, view.W / 2 + 2 - slide, cy - 6 + 2);
  ctx.fillStyle = b.color;
  ctx.fillText(b.title, view.W / 2 - slide, cy - 6);
  if (b.sub) {
    ctx.font = `700 15px ${FONT2}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(b.sub.split('').join(String.fromCharCode(8202)), view.W / 2 + slide, cy + 22);
  }
  ctx.globalAlpha = 1;
}

// Node / sector beats: square neon rules and a kicker line, so a node's start, its end and a sector's end each read
// differently at a glance. start: rules sweep out from the middle. clear: rules close in. secured: a full-width band.
function drawBeat(ctx, b) {
  const W = view.W;
  const cy = view.H * 0.38;
  const inT = Math.min(1, b.t / 0.3);
  const outT = Math.min(1, (b.dur - b.t) / 0.4);
  const a = Math.min(inT, outT) * hudA;
  const e = easeOutCubic(inT);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.globalAlpha = a;
  const secured = b.kind === 'secured';
  const half = secured ? 52 : 40;
  if (secured) {
    // Band in the sector hue with a white sweep crossing it once.
    ctx.fillStyle = 'rgba(3,2,10,0.62)';
    ctx.fillRect(0, cy - half, W, half * 2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * 0.16;
    ctx.fillStyle = b.color;
    ctx.fillRect(0, cy - half, W, half * 2);
    const sx = -80 + (W + 160) * Math.min(1, b.t / 0.9);
    const sg = ctx.createLinearGradient(sx - 70, 0, sx + 70, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 70, cy - half, 140, half * 2);
    ctx.globalCompositeOperation = 'source-over';
  }
  // Rules: start = grow out from the centre; clear = close in from the edges; secured = full width, thick.
  const lw = secured ? 3 : 2;
  ctx.fillStyle = b.color;
  ctx.shadowColor = b.color;
  ctx.shadowBlur = 10;
  if (b.kind === 'clear') {
    // Two halves slide in from the edges and meet in the middle.
    const x = (W / 2) * (e - 1);
    for (const y of [cy - half, cy + half - lw]) {
      ctx.fillRect(x, y, W / 2, lw);
      ctx.fillRect(W - x - W / 2, y, W / 2, lw);
    }
  } else {
    const w = (secured ? W : W * 0.72) * e;
    ctx.fillRect((W - w) / 2, cy - half, w, lw);
    ctx.fillRect((W - w) / 2, cy + half - lw, w, lw);
  }
  ctx.shadowBlur = 0;
  if (b.kicker) {
    ctx.font = `700 ${secured ? 12 : 11}px ${FONT}`;
    ctx.fillStyle = secured ? '#ffffff' : b.color;
    ctx.globalAlpha = a * 0.9;
    ctx.fillText(spaced(b.kicker), W / 2, cy - half + 15);
    ctx.globalAlpha = a;
  }
  const size = secured ? 36 : 32;
  ctx.font = `900 ${size}px ${FONT}`;
  const tw = ctx.measureText(b.title).width;
  const fit = Math.min(1, (W - 30) / tw);
  ctx.save();
  ctx.translate(W / 2, cy + 3);
  // start: drops in with a small overshoot; clear / secured: punches from large.
  const pop = b.kind === 'start' ? 1 : 1 + (1 - e) * 0.35;
  ctx.scale(fit * pop, fit * pop);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(b.title, 2, 2);
  ctx.fillStyle = b.color;
  ctx.fillText(b.title, 0, 0);
  ctx.restore();
  if (b.sub) {
    ctx.font = `700 13px ${FONT2}`;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = a * Math.min(1, Math.max(0, (b.t - 0.15) / 0.25));
    ctx.fillText(spaced(b.sub), W / 2, cy + half - 13);
  }
  ctx.globalAlpha = 1;
}

const spaced = (s) => s.split('').join(String.fromCharCode(8202));

export function updateBanner(dt) {
  if (!G.banner) return;
  G.banner.t += dt;
  if (G.banner.t >= G.banner.dur) G.banner = null;
}
