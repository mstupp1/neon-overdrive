// In-canvas HUD: hull, score & combo, XP, sector progress, boss bar, gauges, banners.

import { G, view, sectorInfo } from '../game/state.js';
import { S } from './sprites.js';
import { TAU, clamp, easeOutCubic } from '../core/math.js';
import { comboMult } from '../game/player.js';
import { input } from '../core/input.js';

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
  if (d === 'pad') return kind === 'dash' ? 'A' : 'B';
  if (d === 'mouse') return kind === 'dash' ? 'LMB' : 'RMB';
  if (d === 'touch') return '';
  return kind === 'dash' ? 'SPACE' : 'E';
}

export function drawHud(ctx) {
  const p = G.player;
  if (!p) return;
  const W = view.W;
  const y0 = view.safeTop + 10;
  ctx.textBaseline = 'middle';

  // Top scrim for legibility
  const grd = ctx.createLinearGradient(0, 0, 0, y0 + 70);
  grd.addColorStop(0, 'rgba(3,2,10,0.75)');
  grd.addColorStop(1, 'rgba(3,2,10,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, y0 + 70);

  // Hull
  const hs = 20;
  let hx = 18;
  for (let i = 0; i < p.maxHp; i++) {
    const full = i < p.hp;
    const spr = full ? S.hudHeart : S.hudHeartEmpty;
    let sz = 22;
    if (full && p.hp === 1) sz *= 1 + Math.sin(G.realTime * 10) * 0.12;
    ctx.drawImage(spr.img, hx - sz / 2, y0 + 10 - sz / 2, sz, sz);
    hx += hs;
  }
  if (p.shield) {
    ctx.drawImage(S.hudShield.img, hx - 11, y0 - 1, 22, 22);
  } else if (p.st.shieldInterval) {
    ctx.globalAlpha = 0.3;
    ctx.drawImage(S.hudShield.img, hx - 11, y0 - 1, 22, 22);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#3ff6ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, y0 + 10, 12, -Math.PI / 2, -Math.PI / 2 + TAU * (p.shieldT / p.st.shieldInterval));
    ctx.stroke();
  }

  // Level + XP
  text(ctx, `LV ${p.level}`, 12, y0 + 33, 10, '#9ffcff', 'left', 700);
  bar(ctx, 50, y0 + 30, 118, 5, p.xp / p.xpNeed, '#3ff6ff');

  // Score (rolling)
  G.displayScore += (G.score - G.displayScore) * Math.min(1, 0.2);
  if (Math.abs(G.score - G.displayScore) < 1) G.displayScore = G.score;
  const sc = Math.floor(G.displayScore).toString().padStart(8, '0');
  ctx.shadowColor = 'transparent';
  text(ctx, sc, W / 2, y0 + 11, 20, '#ffffff', 'center', 700);

  // Combo
  const mult = comboMult();
  if (G.combo > 0) {
    const col = mult >= 5 ? '#ff3df2' : mult >= 3 ? '#ffe14d' : '#9ffcff';
    text(ctx, `x${mult}  ·  ${G.combo} CHAIN`, W / 2, y0 + 31, 10, col, 'center', 700);
    bar(ctx, W / 2 - 40, y0 + 39, 80, 2, G.comboTimer / 2.6, col, 'rgba(255,255,255,0.08)');
  }

  // Sector + progress (left of pause button)
  const rx = W - 60;
  const info = sectorInfo(G.sector);
  const hue = `hsl(${info.hue},100%,72%)`;
  text(ctx, `SECTOR ${G.sector}`, rx, y0 + 9, 11, hue, 'right', 700);
  const d = G.director;
  const bossSector = G.sector % 3 === 0;
  bar(ctx, rx - 84, y0 + 23, 84, 4, d.progress, hue);
  if (bossSector) {
    ctx.fillStyle = '#ff2e55';
    ctx.beginPath();
    ctx.arc(rx + 1, y0 + 25, 4, 0, TAU);
    ctx.fill();
  }
  text(ctx, `${Math.floor(G.runTime / 60)}:${Math.floor(G.runTime % 60).toString().padStart(2, '0')}`, rx, y0 + 38, 9, 'rgba(255,255,255,0.5)', 'right', 600);

  // Boss bar
  const boss = G.boss;
  if (boss && !boss.dead) {
    const by = y0 + 58;
    const bw = W - 32;
    const fill = boss.state === 'enter' ? easeOutCubic(boss.barFill) : boss.hp / boss.maxHp;
    text(ctx, boss.name, 16, by - 7, 10, boss.color, 'left', 900);
    text(ctx, boss.phase === 3 ? 'FINAL PHASE' : `PHASE ${boss.phase}`, W - 16, by - 7, 9, 'rgba(255,255,255,0.7)', 'right', 700);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(16, by, bw, 6);
    ctx.fillStyle = boss.flash > 0 ? '#ffffff' : boss.color;
    ctx.fillRect(16, by, bw * clamp(fill, 0, 1), 6);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(16 + bw * 0.66, by, 2, 6);
    ctx.fillRect(16 + bw * 0.33, by, 2, 6);
  }

  // Gauges (fade when the ship flies near them)
  const gy = view.H - view.safeBottom - 46;
  drawGauge(ctx, 44, gy, p, 'od');
  drawGauge(ctx, W - 44, gy, p, 'dash');

  drawBanner(ctx);
}

function drawGauge(ctx, x, y, p, kind) {
  const near = Math.hypot(p.x - x, p.y - y) < 90;
  ctx.globalAlpha = near ? 0.25 : 0.9;
  const r = 24;
  ctx.fillStyle = 'rgba(5,3,15,0.55)';
  ctx.beginPath();
  ctx.arc(x, y, r + 4, 0, TAU);
  ctx.fill();
  if (kind === 'od') {
    const active = p.odT > 0;
    const t = active ? p.odT / p.st.odDur : p.od / 100;
    const ready = p.od >= 100 && !active;
    ctx.strokeStyle = 'rgba(255,61,242,0.2)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = active || ready ? '#ff3df2' : '#b84dff';
    ctx.lineWidth = ready ? 5 + Math.sin(G.realTime * 8) * 1.5 : 4;
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * t);
    ctx.stroke();
    const label = active ? 'ON' : ready ? keyHint('od') || 'TAP' : `${Math.floor(p.od)}%`;
    text(ctx, label, x, y - 1, ready || active ? 10 : 9, ready || active ? '#ffffff' : '#e7b8ff', 'center', 700);
    text(ctx, 'OVERDRIVE', x, y + r + 12, 7, '#ff9ad5', 'center', 700);
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
    text(ctx, hint || 'DASH', x, y - 1, hint.length > 3 ? 8 : 10, p.charges ? '#ffffff' : 'rgba(255,255,255,0.4)', 'center', 700);
    text(ctx, 'DASH', x, y + r + 12, 7, '#9ffcff', 'center', 700);
  }
  ctx.globalAlpha = 1;
}

function drawBanner(ctx) {
  const b = G.banner;
  if (!b) return;
  const inT = Math.min(1, b.t / 0.25);
  const outT = Math.min(1, (b.dur - b.t) / 0.35);
  const a = Math.min(inT, outT);
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
    ctx.font = `700 13px ${FONT2}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(b.sub.split('').join(String.fromCharCode(8202)), view.W / 2 + slide, cy + 22);
  }
  ctx.globalAlpha = 1;
}

export function updateBanner(dt) {
  if (!G.banner) return;
  G.banner.t += dt;
  if (G.banner.t >= G.banner.dur) G.banner = null;
}
