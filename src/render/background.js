// Scrolling synthwave backdrop: gradient sky, nebula glows, perspective grid, stars.

import { view } from '../game/state.js';
import { glow } from './sprites.js';
import { rand, damp, wrapAngle } from '../core/math.js';

export const bg = {
  hue: 215,
  target: 215,
  t: 0,
  scroll: 0,
  boost: 1,
  stars: [],
  nebula: [],

  init() {
    this.stars.length = 0;
    const layers = [
      { n: 60, speed: 18, size: 1, a: 0.35 },
      { n: 34, speed: 45, size: 1.4, a: 0.55 },
      { n: 14, speed: 110, size: 2, a: 0.9 },
    ];
    for (const L of layers) {
      for (let i = 0; i < L.n; i++) {
        this.stars.push({ x: rand(0, 1), y: rand(0, 1), speed: L.speed * rand(0.8, 1.2), size: L.size, a: L.a * rand(0.6, 1) });
      }
    }
    this.nebula = [
      { x: 0.2, y: 0.25, r: 0.9, h: 0, s: 0.004 },
      { x: 0.85, y: 0.6, r: 1.1, h: 50, s: 0.006 },
      { x: 0.4, y: 0.95, r: 0.8, h: -40, s: 0.005 },
    ];
  },

  setHue(h) {
    this.target = h;
  },

  update(dt, boost = 1) {
    // Shortest way around the colour wheel.
    const diff = wrapAngle(((this.target - this.hue) * Math.PI) / 180) * (180 / Math.PI);
    this.hue = (this.hue + diff * Math.min(1, dt * 1.5) + 360) % 360;
    this.boost = damp(this.boost, boost, 3, dt);
    this.t += dt;
    this.scroll += dt * 0.55 * this.boost;
    for (const s of this.stars) {
      s.y += (s.speed * this.boost * dt) / view.H;
      if (s.y > 1) {
        s.y -= 1;
        s.x = Math.random();
      }
    }
  },

  draw(ctx) {
    const W = view.W;
    const H = view.H;
    const h = Math.round(this.hue);
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, `hsl(${h},55%,5%)`);
    grd.addColorStop(0.55, `hsl(${(h + 25) % 360},60%,7%)`);
    grd.addColorStop(1, `hsl(${(h + 40) % 360},70%,10%)`);
    ctx.fillStyle = grd;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // Nebula clouds (hue quantised so the glow cache stays small)
    ctx.globalCompositeOperation = 'lighter';
    for (const n of this.nebula) {
      const nh = (Math.round((h + n.h) / 10) * 10 + 360) % 360;
      const s = glow(`hsl(${nh},90%,45%)`, 128);
      const r = n.r * W;
      const x = n.x * W + Math.sin(this.t * n.s * 20) * 30;
      const y = ((n.y + this.scroll * 0.03) % 1.4) * H - 0.2 * H;
      ctx.globalAlpha = 0.16;
      ctx.drawImage(s.img, x - r, y - r, r * 2, r * 2);
    }

    // Perspective grid
    const horizon = H * 0.12;
    const depth = H - horizon;
    const lineCol = `hsl(${h},100%,62%)`;
    ctx.strokeStyle = lineCol;
    ctx.lineWidth = 1;
    const rows = 16;
    const phase = this.scroll % 1;
    for (let i = 0; i < rows; i++) {
      const f = (i + phase) / rows;
      const y = horizon + depth * f * f;
      ctx.globalAlpha = 0.04 + f * 0.14;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.09;
    ctx.beginPath();
    const cols = 14;
    for (let i = -cols; i <= cols; i++) {
      const bx = W / 2 + i * (W / 7);
      ctx.moveTo(W / 2 + (bx - W / 2) * 0.06, horizon);
      ctx.lineTo(bx, H);
    }
    ctx.stroke();

    // Horizon glow line
    const hg = glow(`hsl(${Math.round(h / 10) * 10},100%,60%)`, 64);
    ctx.globalAlpha = 0.25;
    ctx.drawImage(hg.img, -W * 0.2, horizon - 30, W * 1.4, 60);

    // Stars (streak when boosting)
    ctx.fillStyle = '#ffffff';
    const streak = Math.max(0, this.boost - 1.2) * 14;
    for (const s of this.stars) {
      ctx.globalAlpha = s.a;
      const len = s.size + streak * (s.speed / 110);
      ctx.fillRect(s.x * W, s.y * H, s.size, len);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
};
