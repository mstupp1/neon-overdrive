// Player shot styles: every primary weapon gets an animated ki-style head (a few baked frames) plus a baked trail strip
// that is stretched behind it per frame. Everything is baked once (shadowBlur, gradients) so a shot still costs two
// drawImage calls. A style object doubles as a plain sprite ({img, size, half}) for code that only wants one image.
//
// Style fields read by bullets.js drawPlayerBullets:
//   frames[]  head canvases (cycled at `fps`; the shot's seed offsets the cycle)
//   spin      rad/s the head turns on its own (0 = the head points along its flight)
//   trails[]  trail canvases (cycled with the head frames), drawn from the head backwards
//   tl, tw    trail length / width in logical units at scale 1 (tl grows in over the first few frames of flight)
//   hit       impact colour; `pop` impact flash size (world.js)

import { TAU, mulberry32 } from '../core/math.js';
import { withAlpha, shade, rgbOf } from './ink.js';

const RES = 2;

// A w x len strip, origin at the top centre (the head end); y runs down the trail. fade: alpha mask from head to tail.
function strip(w, len, paint, fade = [1, 0.55, 0]) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * RES);
  c.height = Math.ceil(len * RES);
  const g = c.getContext('2d');
  g.scale(RES, RES);
  g.translate(w / 2, 0);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  paint(g, w, len);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  const m = g.createLinearGradient(0, 0, 0, c.height);
  fade.forEach((a, i) => m.addColorStop(i / (fade.length - 1), `rgba(0,0,0,${a})`));
  g.fillStyle = m;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// Tapered comet tail: colour body, white core.
function comet(c, w, len, core = 0.8) {
  return strip(w, len, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, len);
    grd.addColorStop(0, withAlpha(c, 0.9));
    grd.addColorStop(1, withAlpha(c, 0.1));
    g.fillStyle = grd;
    g.shadowColor = c;
    g.shadowBlur = 4;
    g.beginPath();
    g.moveTo(-w / 2 + 1.5, 0);
    g.quadraticCurveTo(-w / 2 + 1, len * 0.4, 0, len);
    g.quadraticCurveTo(w / 2 - 1, len * 0.4, w / 2 - 1.5, 0);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = `rgba(255,255,255,${core})`;
    g.beginPath();
    g.moveTo(-w / 7, 0);
    g.quadraticCurveTo(-w / 9, len * 0.35, 0, len * 0.75);
    g.quadraticCurveTo(w / 9, len * 0.35, w / 7, 0);
    g.closePath();
    g.fill();
  });
}

// Flickering ki corona: a ragged flame ring swept back (+y), filled with a soft colour gradient.
function corona(g, c, r0, r1, n, rnd, sweep = 1.35) {
  g.save();
  const grd = g.createRadialGradient(0, 0, r0 * 0.4, 0, 0, r1 * sweep);
  grd.addColorStop(0, withAlpha(c, 0.95));
  grd.addColorStop(0.55, withAlpha(c, 0.45));
  grd.addColorStop(1, withAlpha(c, 0));
  g.fillStyle = grd;
  g.shadowColor = c;
  g.shadowBlur = 6;
  g.beginPath();
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * TAU - Math.PI / 2;
    const r = i % 2 ? r0 + (r1 - r0) * (0.35 + rnd() * 0.25) : r0 + (r1 - r0) * (0.7 + rnd() * 0.3);
    const back = Math.max(0, Math.sin(a)); // the back half streams out further
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * (1 + back * (sweep - 1));
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  g.restore();
}

// Bright ball: colour rim fading to a white-hot centre.
function ball(g, c, r, cy = 0) {
  const grd = g.createRadialGradient(0, cy - r * 0.15, 0, 0, cy, r);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.45, shade(c, 0.6));
  grd.addColorStop(0.8, c);
  grd.addColorStop(1, withAlpha(c, 0.25));
  g.fillStyle = grd;
  g.shadowColor = c;
  g.shadowBlur = 8;
  g.beginPath();
  g.arc(0, cy, r, 0, TAU);
  g.fill();
  g.shadowBlur = 0;
}

function jag(g, rnd, x0, y0, x1, y1, segs, amp) {
  g.moveTo(x0, y0);
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    g.lineTo(x0 + (x1 - x0) * t + (rnd() - 0.5) * 2 * amp, y0 + (y1 - y0) * t + (rnd() - 0.5) * amp * 0.6);
  }
  g.lineTo(x1, y1);
}

function glowLine(g, c, w, blur, path) {
  g.save();
  g.strokeStyle = c;
  g.shadowColor = c;
  g.lineWidth = w;
  g.shadowBlur = blur;
  g.beginPath();
  path(g);
  g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = Math.max(0.6, w * 0.4);
  g.beginPath();
  path(g);
  g.stroke();
  g.restore();
}

function star(g, c, long, short, thin = 1.3) {
  g.save();
  g.fillStyle = c;
  g.shadowColor = c;
  g.shadowBlur = 7;
  g.beginPath();
  g.moveTo(0, -long);
  g.lineTo(thin, -thin);
  g.lineTo(short, 0);
  g.lineTo(thin, thin);
  g.lineTo(0, long);
  g.lineTo(-thin, thin);
  g.lineTo(-short, 0);
  g.lineTo(-thin, -thin);
  g.closePath();
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(0, 0, thin * 1.1, 0, TAU);
  g.fill();
  g.restore();
}

// --- The styles --------------------------------------------------------------------------------------------------
// Each builder returns {frames, fps, spin, trails, tl, tw, pop, size}; `mk(size, draw)` bakes one head frame.

const STYLES = {
  // VECTOR: ki barrage. Flickering ki balls with comet tails.
  pulse(c, mk) {
    const frames = [0, 1, 2].map((f) => mk(22, (g) => {
      const rnd = mulberry32(11 + f * 7);
      corona(g, c, 3.2, 7.4, 7, rnd, 1.3);
      ball(g, c, 3.6);
    }).img);
    return { frames, fps: 22, spin: 0, trails: [comet(c, 7, 26)], tl: 26, tw: 7, pop: 12 };
  },
  // NEEDLE: spiral beam. A drill tip with two strands corkscrewing down a long core.
  lance(c, mk) {
    const head = mk(26, (g) => {
      g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 8;
      g.beginPath(); g.moveTo(0, -12); g.lineTo(2.6, -2); g.lineTo(1.6, 6); g.lineTo(-1.6, 6); g.lineTo(-2.6, -2); g.closePath(); g.fill();
      g.shadowBlur = 0; g.fillStyle = '#fff';
      g.beginPath(); g.moveTo(0, -10); g.lineTo(1, -2); g.lineTo(0.6, 5); g.lineTo(-0.6, 5); g.lineTo(-1, -2); g.closePath(); g.fill();
    }).img;
    const trails = [0, 1, 2, 3].map((f) => strip(12, 72, (g, w, len) => {
      g.strokeStyle = withAlpha(c, 0.9); g.shadowColor = c; g.shadowBlur = 4; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len); g.stroke();
      g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len * 0.8); g.stroke();
      for (const s of [0, Math.PI]) {
        g.strokeStyle = s ? shade(c, 0.55) : c; g.lineWidth = 1.3; g.shadowColor = c; g.shadowBlur = 3;
        g.beginPath();
        for (let y = 0; y <= len; y += 1.5) {
          const amp = (w / 2 - 1.5) * Math.min(1, y / 10);
          const x = Math.sin(y * 0.32 - (f / 4) * TAU + s) * amp;
          if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
    }));
    return { frames: [head], fps: 30, spin: 0, trails, tl: 72, tw: 12, pop: 10 };
  },
  // BULWARK: destructo discs. Serrated energy discs that spin flat.
  scatter(c, mk) {
    const frames = [0, 1].map((f) => mk(22, (g) => {
      g.save();
      g.globalAlpha = 0.35; g.fillStyle = c;
      g.beginPath(); g.arc(0, 0, 5.4, 0, TAU); g.fill();
      g.restore();
      g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 6;
      g.beginPath();
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + f * 0.2;
        g.moveTo(Math.cos(a) * 5, Math.sin(a) * 5);
        g.lineTo(Math.cos(a + 0.28) * 8.4, Math.sin(a + 0.28) * 8.4);
        g.lineTo(Math.cos(a + 0.6) * 5, Math.sin(a + 0.6) * 5);
      }
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = '#fff'; g.lineWidth = 1.3;
      g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.stroke();
      g.strokeStyle = shade(c, 0.5); g.lineWidth = 0.8;
      g.beginPath(); g.arc(0, 0, 2.6, 0, TAU); g.stroke();
    }).img);
    return { frames, fps: 14, spin: 24, trails: [comet(c, 9, 16, 0.5)], tl: 16, tw: 9, pop: 11 };
  },
  // PHANTOM: masenko crescents. A burning crescent wave trailed by fading echoes of itself.
  phase(c, mk) {
    const cres = (g, k, a) => {
      g.save();
      g.globalAlpha = a;
      g.beginPath();
      g.arc(0, 6 * k, 10 * k, Math.PI * 1.12, Math.PI * 1.88);
      g.arc(0, 9.5 * k, 9.2 * k, Math.PI * 1.82, Math.PI * 1.18, true);
      g.closePath();
      g.fill();
      g.restore();
    };
    const frames = [0, 1, 2].map((f) => mk(28, (g) => {
      const rnd = mulberry32(31 + f * 5);
      g.fillStyle = withAlpha(c, 0.5); g.shadowColor = c; g.shadowBlur = 9;
      g.save(); g.scale(1.25 + rnd() * 0.12, 1.3); cres(g, 1, 1); g.restore();
      g.shadowBlur = 4; g.fillStyle = c;
      cres(g, 1, 1);
      g.shadowBlur = 0; g.fillStyle = '#fff';
      g.save(); g.translate(0, 1.4); g.scale(0.82, 0.7); cres(g, 1, 0.95); g.restore();
    }).img);
    const trails = [strip(24, 34, (g) => {
      g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 5;
      for (let i = 0; i < 4; i++) {
        g.save();
        g.translate(0, 2 + i * 8);
        g.scale(1 - i * 0.12, 1 - i * 0.12);
        g.globalAlpha = 0.55 - i * 0.1;
        g.beginPath();
        g.arc(0, 6, 10, Math.PI * 1.12, Math.PI * 1.88);
        g.arc(0, 8.8, 9.4, Math.PI * 1.82, Math.PI * 1.18, true);
        g.closePath();
        g.fill();
        g.restore();
      }
    }, [1, 0.6, 0])];
    return { frames, fps: 18, spin: 0, trails, tl: 34, tw: 24, pop: 13 };
  },
  // CORSAIR: thunder bolts. Jagged lightning heads with a crackling wake.
  ricochet(c, mk) {
    const frames = [0, 1, 2, 3].map((f) => mk(26, (g) => {
      const rnd = mulberry32(51 + f * 13);
      glowLine(g, c, 2.6, 7, (h) => jag(h, rnd, 0, -11, 0, 8, 5, 3.2));
      glowLine(g, c, 1.1, 4, (h) => jag(h, rnd, 0, -4, (rnd() - 0.5) * 12, 4, 3, 2));
      g.fillStyle = '#fff'; g.shadowColor = c; g.shadowBlur = 6;
      g.beginPath(); g.arc(0, -11, 2, 0, TAU); g.fill();
    }).img);
    const trails = [0, 1, 2, 3].map((f) => strip(10, 30, (g, w, len) => {
      const rnd = mulberry32(77 + f * 3);
      glowLine(g, c, 1.4, 4, (h) => jag(h, rnd, 0, 0, 0, len, 7, 3.5));
    }));
    return { frames, fps: 24, spin: 0, trails, tl: 30, tw: 10, pop: 12 };
  },
  // MONOLITH: spirit orb. A swirling, crackling energy bomb that drags a wide beam of ki behind it.
  charge(c, mk) {
    const frames = [0, 1, 2, 3].map((f) => mk(40, (g) => {
      const rnd = mulberry32(91 + f * 17);
      corona(g, c, 8, 12.5, 10, rnd, 1.1);
      ball(g, c, 8.2);
      g.save();
      g.shadowColor = c; g.shadowBlur = 5;
      for (let i = 0; i < 3; i++) {
        const a0 = (i / 3) * TAU + (f / 4) * (TAU / 3);
        g.strokeStyle = i ? withAlpha('#ffffff', 0.85) : shade(c, 0.4);
        g.lineWidth = 1.3;
        g.beginPath();
        g.ellipse(0, 0, 11.5, 4.6, a0, 0.2, 2.4);
        g.stroke();
      }
      g.restore();
      glowLine(g, shade(c, 0.5), 0.9, 4, (h) => {
        for (let k = 0; k < 2; k++) {
          const a = rnd() * TAU;
          jag(h, rnd, Math.cos(a) * 7, Math.sin(a) * 7, Math.cos(a) * 16, Math.sin(a) * 16, 3, 2.4);
        }
      });
    }).img);
    const trails = [0, 1].map((f) => strip(16, 60, (g, w, len) => {
      const rnd = mulberry32(5 + f);
      const grd = g.createLinearGradient(-w / 2, 0, w / 2, 0);
      grd.addColorStop(0, withAlpha(c, 0));
      grd.addColorStop(0.25, withAlpha(c, 0.55));
      grd.addColorStop(0.5, withAlpha(shade(c, 0.7), 0.95));
      grd.addColorStop(0.75, withAlpha(c, 0.55));
      grd.addColorStop(1, withAlpha(c, 0));
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(-w / 2 + 2, 0);
      for (let y = 0; y <= len; y += 4) g.lineTo(-w / 2 + 2 + y * 0.09 + (rnd() - 0.5) * 2.4, y);
      for (let y = len; y >= 0; y -= 4) g.lineTo(w / 2 - 2 - y * 0.09 + (rnd() - 0.5) * 2.4, y);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(-1.2, 0, 2.4, len * 0.7);
    }, [0.85, 0.4, 0]));
    return { frames, fps: 16, spin: 0, trails, tl: 60, tw: 16, pop: 17 };
  },
  // WRAITH: ghost wisps. Flame-tongued spirits on a ribbon tail.
  wave(c, mk) {
    const frames = [0, 1, 2].map((f) => mk(24, (g) => {
      const rnd = mulberry32(131 + f * 9);
      g.save();
      g.fillStyle = withAlpha(c, 0.75); g.shadowColor = c; g.shadowBlur = 7;
      g.beginPath();
      g.moveTo(0, -7);
      g.bezierCurveTo(5, -6, 5, 1, 2.5 + rnd() * 2, 9);
      g.quadraticCurveTo(0.5, 5, 0, 10 + rnd() * 2);
      g.quadraticCurveTo(-0.5, 5, -2.5 - rnd() * 2, 9);
      g.bezierCurveTo(-5, 1, -5, -6, 0, -7);
      g.fill();
      g.restore();
      ball(g, c, 3, -2.5);
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.beginPath(); g.ellipse(-1.2, -3, 0.6, 1, 0, 0, TAU); g.ellipse(1.2, -3, 0.6, 1, 0, 0, TAU); g.fill();
    }).img);
    const trails = [0, 1, 2].map((f) => strip(10, 30, (g, w, len) => {
      g.strokeStyle = c; g.shadowColor = c; g.shadowBlur = 4; g.lineWidth = 2.2;
      g.beginPath();
      for (let y = 0; y <= len; y += 1.5) {
        const x = Math.sin(y * 0.3 + (f / 3) * TAU) * Math.min(3.4, y * 0.25);
        if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
      g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.8; g.stroke();
    }));
    return { frames, fps: 14, spin: 0, trails, tl: 30, tw: 10, pop: 11 };
  },
  // TALON: death beams. A pinpoint of white-hot light dragging a long, razor-thin tracer.
  burst(c, mk) {
    const frames = [0, 1].map((f) => mk(22, (g) => {
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, 7);
      grd.addColorStop(0, withAlpha(c, 0.9)); grd.addColorStop(1, withAlpha(c, 0));
      g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill();
      star(g, shade(c, 0.4), f ? 9 : 7, f ? 5 : 7, 0.9);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 1.9, 0, TAU); g.fill();
    }).img);
    const trails = [strip(5, 96, (g, w, len) => {
      g.strokeStyle = c; g.shadowColor = c; g.shadowBlur = 3; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len); g.stroke();
      g.shadowBlur = 0; g.strokeStyle = '#fff'; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len * 0.7); g.stroke();
    }, [1, 0.5, 0])];
    return { frames, fps: 30, spin: 0, trails, tl: 96, tw: 5, pop: 9 };
  },
  // HALO: star sparks. Twinkling four-point stars that leave glitter behind.
  spark(c, mk) {
    const frames = [0, 1].map((f) => mk(24, (g) => {
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, 8);
      grd.addColorStop(0, withAlpha(c, 0.7)); grd.addColorStop(1, withAlpha(c, 0));
      g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill();
      star(g, c, f ? 9 : 7, f ? 7 : 9, 1.6);
      g.save(); g.rotate(Math.PI / 4); star(g, shade(c, 0.5), 3.6, 3.6, 0.7); g.restore();
    }).img);
    const trails = [0, 1].map((f) => strip(10, 30, (g, w, len) => {
      const rnd = mulberry32(201 + f * 11);
      g.strokeStyle = withAlpha(c, 0.5); g.lineWidth = 1; g.shadowColor = c; g.shadowBlur = 3;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len); g.stroke();
      g.fillStyle = '#fff';
      for (let i = 0; i < 6; i++) {
        const y = 3 + i * 4.5 + rnd() * 2;
        const x = (rnd() - 0.5) * 6;
        const s = 1.6 - i * 0.18;
        g.beginPath(); g.moveTo(x, y - s * 1.8); g.lineTo(x + s * 0.4, y); g.lineTo(x, y + s * 1.8); g.lineTo(x - s * 0.4, y); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(x - s * 1.8, y); g.lineTo(x, y + s * 0.4); g.lineTo(x + s * 1.8, y); g.lineTo(x, y - s * 0.4); g.closePath(); g.fill();
      }
    }, [1, 0.7, 0]));
    return { frames, fps: 12, spin: 9, trails, tl: 30, tw: 10, pop: 12 };
  },
  // MAGNATE: crystal shards. Tumbling faceted gems that throw a glint.
  shard(c, mk) {
    const frames = [0, 1, 2].map((f) => mk(26, (g) => {
      const pts = [[0, -9], [4.5, -3], [3.4, 5.5], [0, 9], [-3.4, 5.5], [-4.5, -3]];
      g.fillStyle = withAlpha(c, 0.55); g.shadowColor = c; g.shadowBlur = 7;
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = withAlpha(shade(c, 0.6), 0.85);
      g.beginPath(); g.moveTo(0, -9); g.lineTo(4.5, -3); g.lineTo(0, 0); g.lineTo(-4.5, -3); g.closePath(); g.fill();
      g.strokeStyle = c; g.lineWidth = 1.2;
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(0, -8); g.lineTo(0, 8); g.moveTo(-4, -3); g.lineTo(0, 0); g.lineTo(4, -3); g.stroke();
      const [gx, gy] = [pts[0], pts[2], pts[4]][f];
      g.save(); g.translate(gx * 0.85, gy * 0.85); star(g, '#ffffff', 5, 5, 0.6); g.restore();
    }).img);
    return { frames, fps: 9, spin: 7, trails: [comet(c, 6, 20, 0.6)], tl: 20, tw: 6, pop: 12 };
  },
  // Default (unknown weapon): a plain ki bolt.
  bolt(c, mk) {
    const frames = [mk(22, (g) => { corona(g, c, 2.6, 5.5, 6, mulberry32(3), 1.6); ball(g, c, 3); }).img];
    return { frames, fps: 1, spin: 0, trails: [comet(c, 6, 20)], tl: 20, tw: 6, pop: 10 };
  },
};

function finish(st, mk, c) {
  const first = { img: st.frames[0] };
  st.img = first.img;
  st.size = st.size || first.img.width / RES;
  st.half = st.size / 2;
  st.hit = c;
  st.nf = st.frames.length;
  st.nt = st.trails ? st.trails.length : 0;
  return st;
}

// Pale paint colours (pastel bullets) wash out to white once shots overlap additively, so the energy body uses a
// saturated, darker take on the same hue and the white core supplies the brightness.
function vivid(color) {
  const [r, g, b] = rgbOf(color).map((v) => v / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return color;
  const d = mx - mn;
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  const s0 = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  return `hsl(${Math.round(h)},${Math.round(Math.max(s0, 0.95) * 100)}%,${Math.round(Math.min(l, 0.6) * 100)}%)`;
}

// The primary-gun style for a weapon id in colour c. mk = sprites.js makeSprite.
export function shotStyle(weapon, c, mk) {
  c = vivid(c);
  const st = (STYLES[weapon] || STYLES.bolt)(c, mk);
  return finish(st, mk, c);
}

// Striker Overdrive: super ki. Golden flame bolts with a white-hot core and a long fire trail.
export function superKi(mk) {
  const C = '#ffd23f';
  const frames = [0, 1, 2].map((f) => mk(28, (g) => {
    const rnd = mulberry32(301 + f * 23);
    g.save();
    g.scale(0.9, 1.25);
    corona(g, '#ff9e2c', 4, 10, 8, rnd, 1.6);
    g.restore();
    corona(g, C, 3.5, 7, 7, rnd, 1.5);
    ball(g, C, 4.2, -1);
  }).img);
  const trails = [0, 1].map((f) => strip(13, 44, (g, w, len) => {
    const rnd = mulberry32(331 + f);
    const grd = g.createLinearGradient(0, 0, 0, len);
    grd.addColorStop(0, 'rgba(255,240,180,0.95)');
    grd.addColorStop(0.4, 'rgba(255,190,50,0.8)');
    grd.addColorStop(1, 'rgba(255,90,40,0.2)');
    g.fillStyle = grd; g.shadowColor = '#ffb02e'; g.shadowBlur = 5;
    g.beginPath();
    g.moveTo(-w / 2 + 2, 0);
    for (let y = 4; y <= len; y += 4) g.lineTo(-(w / 2 - 2) * (1 - y / len) - rnd() * 2, y);
    for (let y = len; y >= 4; y -= 4) g.lineTo((w / 2 - 2) * (1 - y / len) + rnd() * 2, y);
    g.lineTo(w / 2 - 2, 0);
    g.closePath();
    g.fill();
  }, [1, 0.65, 0]));
  return finish({ frames, fps: 20, spin: 0, trails, tl: 44, tw: 13, pop: 16 }, mk, C);
}

// Module shots: smaller comet-tailed rounds so drones, novas, frags and reflections still read as yours.
export function moduleShot(c, mk, head, tl = 14, tw = 5) {
  return finish({ frames: [mk(head.size, head.draw).img], fps: 1, spin: 0, trails: [comet(c, tw, tl, 0.6)], tl, tw, pop: 8, size: head.size }, mk, c);
}

// Give a plain sprite (missile, blade) a comet trail; its head keeps its own single image.
export function withTrail(spr, c, tl, tw) {
  return Object.assign(spr, { frames: [spr.img], fps: 1, nf: 1, spin: 0, trails: [comet(c, tw, tl, 0.7)], nt: 1, tl, tw, pop: 10, hit: c });
}
