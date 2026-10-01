// Pre-rendered neon sprites. Glow is baked once into offscreen canvases with
// shadowBlur so the per-frame renderer never pays for blur.

import { TAU } from '../core/math.js';

const RES = 2; // sprite texels per logical unit

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * RES);
  c.height = Math.ceil(h * RES);
  return c;
}

// size: logical box. draw(ctx) is called with origin at the box centre.
export function makeSprite(size, draw, withFlash = false) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.scale(RES, RES);
  g.translate(size / 2, size / 2);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  const spr = { img: c, size, half: size / 2 };
  if (withFlash) {
    const f = makeCanvas(size, size);
    const fg = f.getContext('2d');
    fg.drawImage(c, 0, 0);
    fg.globalCompositeOperation = 'source-atop';
    fg.fillStyle = 'rgba(255,255,255,0.92)';
    fg.fillRect(0, 0, f.width, f.height);
    spr.flash = f;
  }
  return spr;
}

function glowStroke(g, color, width, blur, pathFn, passes = 2) {
  g.save();
  g.strokeStyle = color;
  g.shadowColor = color;
  g.lineWidth = width;
  for (let i = 0; i < passes; i++) {
    g.shadowBlur = blur * (i + 1) * 0.6;
    g.beginPath();
    pathFn(g);
    g.stroke();
  }
  g.shadowBlur = 0;
  g.lineWidth = Math.max(1, width * 0.45);
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  pathFn(g);
  g.stroke();
  g.restore();
}

function glowFill(g, color, blur, pathFn, fillAlpha = 0.18) {
  g.save();
  g.globalAlpha = fillAlpha;
  g.fillStyle = color;
  g.beginPath();
  pathFn(g);
  g.fill();
  g.restore();
}

function poly(points) {
  return (g) => {
    g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.closePath();
  };
}

function regular(n, r, rot = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

// --- Glow blobs (radial gradients) ------------------------------------------

const glowCache = new Map();
export function glow(color, size = 64) {
  const key = color + '|' + size;
  let s = glowCache.get(key);
  if (s) return s;
  s = makeSprite(size, (g) => {
    const r = size / 2;
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grd.addColorStop(0, color);
    grd.addColorStop(0.25, withAlpha(color, 0.45));
    grd.addColorStop(1, withAlpha(color, 0));
    g.fillStyle = grd;
    g.fillRect(-r, -r, size, size);
  });
  glowCache.set(key, s);
  return s;
}

export function withAlpha(color, a) {
  if (color.startsWith('hsl(')) return color.replace('hsl(', 'hsla(').replace(')', `,${a})`);
  if (color.startsWith('#')) {
    let h = color.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  return color;
}

// --- Ships -------------------------------------------------------------------

function shipSprite(shape, color) {
  return makeSprite(56, (g) => {
    const path = poly(shape);
    glowFill(g, color, 0, path, 0.22);
    glowStroke(g, color, 2.4, 10, path);
    // cockpit
    g.fillStyle = '#fff';
    g.shadowColor = color;
    g.shadowBlur = 8;
    g.beginPath();
    g.ellipse(0, -2, 2.6, 5, 0, 0, TAU);
    g.fill();
  });
}

const SHIP_SHAPES = {
  vector: [[0, -20], [7, -4], [17, 10], [8, 8], [5, 14], [-5, 14], [-8, 8], [-17, 10], [-7, -4]],
  needle: [[0, -24], [5, -6], [9, 12], [3, 9], [0, 15], [-3, 9], [-9, 12], [-5, -6]],
  bulwark: [[0, -16], [10, -10], [19, 4], [19, 12], [8, 14], [0, 10], [-8, 14], [-19, 12], [-19, 4], [-10, -10]],
  phantom: [[0, -20], [4, -8], [18, -2], [8, 4], [12, 16], [0, 8], [-12, 16], [-8, 4], [-18, -2], [-4, -8]],
};

// --- Build all sprites --------------------------------------------------------

export const S = {};

export const ENEMY_COLORS = {
  dart: '#35e0ff',
  swarm: '#7dffb0',
  spinner: '#b56cff',
  dasher: '#ff4d6d',
  snake: '#6dff4d',
  sniper: '#ffa62b',
  tank: '#ffe14d',
  splitter: '#ff5ce1',
  mine: '#ff8a3d',
};

function bulletSprite(sh, c) {
  return makeSprite(24, (g) => {
    if (sh.weapon === 'lance') {
      g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 8;
      g.fillRect(-1.6, -11, 3.2, 22);
      g.fillStyle = '#fff'; g.shadowBlur = 0; g.fillRect(-0.7, -10, 1.4, 20);
    } else if (sh.weapon === 'scatter') {
      g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 8;
      g.beginPath(); poly([[0, -6], [3.5, 0], [0, 6], [-3.5, 0]])(g); g.fill();
      g.fillStyle = '#fff'; g.shadowBlur = 0;
      g.beginPath(); poly([[0, -3], [1.5, 0], [0, 3], [-1.5, 0]])(g); g.fill();
    } else if (sh.weapon === 'phase') {
      g.strokeStyle = c; g.shadowColor = c; g.shadowBlur = 8; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 4, 7, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.shadowBlur = 0;
      g.beginPath(); g.arc(0, 4, 7, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
    } else {
      g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 8;
      g.beginPath(); g.roundRect(-2.4, -8, 4.8, 16, 2.4); g.fill();
      g.fillStyle = '#fff'; g.shadowBlur = 0;
      g.beginPath(); g.roundRect(-1, -6.5, 2, 13, 1); g.fill();
    }
  });
}

// Re-bakes one ship's sprite and its primary bullet in a paint colour (cosmetic; ship defs stay immutable).
export function rebuildShipSprite(ship, color, bullet = color) {
  S['ship_' + ship.id] = shipSprite(SHIP_SHAPES[ship.id], color);
  S['pb_' + ship.id] = bulletSprite(ship, bullet);
}

export function buildSprites(ships) {
  for (const sh of ships) S['ship_' + sh.id] = shipSprite(SHIP_SHAPES[sh.id], sh.color);

  // Player bullets ---------------------------------------------------------
  for (const sh of ships) S['pb_' + sh.id] = bulletSprite(sh, sh.bullet);
  S.pb_od = makeSprite(26, (g) => {
    g.fillStyle = '#fff'; g.shadowColor = '#ff3df2'; g.shadowBlur = 10;
    g.beginPath(); g.roundRect(-3, -10, 6, 20, 3); g.fill();
  });
  S.pb_drone = makeSprite(16, (g) => {
    g.fillStyle = '#9ffcff'; g.shadowColor = '#3ff6ff'; g.shadowBlur = 6;
    g.beginPath(); g.arc(0, 0, 2.6, 0, TAU); g.fill();
  });
  S.pb_frag = makeSprite(14, (g) => {
    g.fillStyle = '#ffcf6b'; g.shadowColor = '#ff8a3d'; g.shadowBlur = 6;
    g.beginPath(); poly(regular(3, 3.4, -Math.PI / 2))(g); g.fill();
  });
  S.pb_nova = makeSprite(18, (g) => {
    g.fillStyle = '#ffffff'; g.shadowColor = '#ff3df2'; g.shadowBlur = 8;
    g.beginPath(); g.arc(0, 0, 3.4, 0, TAU); g.fill();
  });
  S.missile = makeSprite(22, (g) => {
    const p = poly([[0, -8], [3, -2], [3, 6], [-3, 6], [-3, -2]]);
    glowFill(g, '#ff9e3d', 0, p, 0.5);
    glowStroke(g, '#ff9e3d', 1.6, 6, p);
  });
  S.blade = makeSprite(30, (g) => {
    const p = poly([[0, -11], [3, -3], [11, 0], [3, 3], [0, 11], [-3, 3], [-11, 0], [-3, -3]]);
    glowFill(g, '#ff3df2', 0, p, 0.35);
    glowStroke(g, '#ff3df2', 1.8, 8, p);
  });
  S.drone = makeSprite(26, (g) => {
    const p = poly([[0, -8], [6, 5], [0, 2], [-6, 5]]);
    glowFill(g, '#3ff6ff', 0, p, 0.3);
    glowStroke(g, '#3ff6ff', 1.6, 6, p);
  });

  // Enemies -----------------------------------------------------------------
  const E = ENEMY_COLORS;
  S.dart = makeSprite(40, (g) => {
    const p = poly([[0, 14], [11, -8], [4, -4], [0, -12], [-4, -4], [-11, -8]]);
    glowFill(g, E.dart, 0, p); glowStroke(g, E.dart, 2.2, 10, p);
  }, true);
  S.swarm = makeSprite(30, (g) => {
    const p = poly([[0, 9], [7, 0], [0, -9], [-7, 0]]);
    glowFill(g, E.swarm, 0, p, 0.35); glowStroke(g, E.swarm, 2, 8, p);
  }, true);
  S.spinner = makeSprite(60, (g) => {
    const outer = poly(regular(4, 20, Math.PI / 4));
    glowFill(g, E.spinner, 0, outer); glowStroke(g, E.spinner, 2.4, 12, outer);
    const inner = poly(regular(4, 10, 0));
    glowStroke(g, E.spinner, 1.8, 8, inner);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill();
  }, true);
  S.dasher = makeSprite(44, (g) => {
    const p = poly([[0, 16], [8, -2], [14, -12], [0, -6], [-14, -12], [-8, -2]]);
    glowFill(g, E.dasher, 0, p, 0.3); glowStroke(g, E.dasher, 2.2, 10, p);
  }, true);
  S.snakeHead = makeSprite(40, (g) => {
    const p = poly(regular(6, 14, Math.PI / 2));
    glowFill(g, E.snake, 0, p, 0.3); glowStroke(g, E.snake, 2.2, 10, p);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(-5, 3, 2.2, 0, TAU); g.arc(5, 3, 2.2, 0, TAU); g.fill();
  }, true);
  S.snakeSeg = makeSprite(30, (g) => {
    const p = poly(regular(6, 9, Math.PI / 2));
    glowFill(g, E.snake, 0, p, 0.2); glowStroke(g, E.snake, 1.8, 8, p);
  }, true);
  S.sniper = makeSprite(46, (g) => {
    const p = poly(regular(6, 16, 0));
    glowFill(g, E.sniper, 0, p); glowStroke(g, E.sniper, 2.2, 10, p);
    g.strokeStyle = E.sniper; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill();
  }, true);
  S.tank = makeSprite(78, (g) => {
    const p = poly(regular(8, 28, Math.PI / 8));
    glowFill(g, E.tank, 0, p, 0.2); glowStroke(g, E.tank, 2.6, 12, p);
    const q = poly(regular(8, 16, 0));
    glowStroke(g, E.tank, 1.8, 8, q);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill();
  }, true);
  S.splitter = makeSprite(48, (g) => {
    g.save();
    glowStroke(g, E.splitter, 2.4, 10, (c) => c.arc(0, 0, 16, 0, TAU));
    glowFill(g, E.splitter, 0, (c) => c.arc(0, 0, 16, 0, TAU), 0.2);
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i / 3) * TAU;
      glowFill(g, E.splitter, 0, poly([[Math.cos(a) * 9, Math.sin(a) * 9], [Math.cos(a + 0.6) * 4, Math.sin(a + 0.6) * 4], [Math.cos(a - 0.6) * 4, Math.sin(a - 0.6) * 4]]), 0.9);
    }
    g.restore();
  }, true);
  S.mine = makeSprite(34, (g) => {
    const p = poly(regular(8, 10, 0));
    glowFill(g, E.mine, 0, p, 0.35); glowStroke(g, E.mine, 2, 8, p);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      g.strokeStyle = E.mine; g.lineWidth = 2;
      g.beginPath(); g.moveTo(Math.cos(a) * 10, Math.sin(a) * 10); g.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); g.stroke();
    }
  }, true);
  S.eliteRing = makeSprite(96, (g) => {
    g.strokeStyle = '#ffd84d'; g.shadowColor = '#ffd84d'; g.shadowBlur = 12; g.lineWidth = 2;
    g.setLineDash([6, 5]);
    g.beginPath(); g.arc(0, 0, 36, 0, TAU); g.stroke();
  });

  // Enemy bullets: bright white cores + dark halo so they read on any background.
  const bullet = (size, r, color) => makeSprite(size, (g) => {
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.beginPath(); g.arc(0, 0, r + 2.4, 0, TAU); g.fill();
    g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 10;
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.shadowBlur = 0; g.fillStyle = '#fff';
    g.beginPath(); g.arc(0, 0, r * 0.55, 0, TAU); g.fill();
  });
  S.eb_orb = bullet(26, 5.2, '#ff2e88');
  S.eb_small = bullet(20, 4, '#ff5ce1');
  S.eb_big = bullet(40, 9.5, '#ff7a18');
  S.eb_wobble = bullet(26, 5.2, '#c04dff');
  S.eb_needle = makeSprite(30, (g) => {
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.beginPath(); g.ellipse(0, 0, 5, 11, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffb02e'; g.shadowColor = '#ffb02e'; g.shadowBlur = 10;
    g.beginPath(); g.ellipse(0, 0, 3.4, 9, 0, 0, TAU); g.fill();
    g.shadowBlur = 0; g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(0, 0, 1.6, 6, 0, 0, TAU); g.fill();
  });
  S.eb_torpedo = makeSprite(36, (g) => {
    const p = poly([[0, 12], [6, 2], [5, -10], [-5, -10], [-6, 2]]);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fill();
    glowFill(g, '#ff3b3b', 0, p, 0.6); glowStroke(g, '#ff3b3b', 2, 10, p);
  });
  S.eb_torpedo_flash = makeSprite(36, (g) => {
    g.fillStyle = '#fff'; g.beginPath(); poly([[0, 12], [6, 2], [5, -10], [-5, -10], [-6, 2]])(g); g.fill();
  });

  // Pickups -----------------------------------------------------------------
  const gem = (size, r, color) => makeSprite(size, (g) => {
    const p = poly([[0, -r], [r * 0.7, 0], [0, r], [-r * 0.7, 0]]);
    glowFill(g, color, 0, p, 0.5); glowStroke(g, color, 1.5, 6, p, 1);
  });
  S.gem1 = gem(18, 4.5, '#3ff6ff');
  S.gem2 = gem(22, 6, '#7dff6b');
  S.gem3 = gem(28, 8, '#ff3df2');
  S.gem4 = gem(34, 10, '#ffe14d');
  S.credit = makeSprite(26, (g) => {
    const p = (c) => c.arc(0, 0, 6.5, 0, TAU);
    glowFill(g, '#ffd24a', 0, p, 0.55); glowStroke(g, '#ffd24a', 1.8, 8, p, 1);
    g.strokeStyle = '#fff6c9'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(-2.6, 0); g.lineTo(0, -3.2); g.lineTo(2.6, 0); g.lineTo(0, 3.2); g.closePath(); g.stroke();
  });
  S.heart = makeSprite(36, (g) => {
    const p = (c) => {
      c.moveTo(0, 9);
      c.bezierCurveTo(-14, -1, -8, -13, 0, -5);
      c.bezierCurveTo(8, -13, 14, -1, 0, 9);
    };
    glowFill(g, '#ff3b6b', 0, p, 0.55); glowStroke(g, '#ff3b6b', 2, 10, p);
  });
  S.magnet = makeSprite(36, (g) => {
    glowStroke(g, '#3ff6ff', 3, 10, (c) => c.arc(0, 0, 9, Math.PI, 0));
    glowStroke(g, '#3ff6ff', 3, 10, (c) => { c.moveTo(-9, 0); c.lineTo(-9, 8); c.moveTo(9, 0); c.lineTo(9, 8); });
    g.fillStyle = '#ff3df2'; g.fillRect(-11, 6, 4, 4); g.fillRect(7, 6, 4, 4);
  });
  S.cell = makeSprite(36, (g) => {
    const p = poly(regular(6, 10, 0));
    glowFill(g, '#ff3df2', 0, p, 0.4); glowStroke(g, '#ff3df2', 2, 10, p);
    g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('⚡', 0, 1);
  });

  // HUD bits
  S.hudHeart = makeSprite(24, (g) => {
    const p = (c) => {
      c.moveTo(0, 7);
      c.bezierCurveTo(-11, -1, -6, -10, 0, -4);
      c.bezierCurveTo(6, -10, 11, -1, 0, 7);
    };
    glowFill(g, '#ff3b6b', 0, p, 0.9); glowStroke(g, '#ff3b6b', 1.4, 6, p, 1);
  });
  S.hudHeartEmpty = makeSprite(24, (g) => {
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(0, 7);
    g.bezierCurveTo(-11, -1, -6, -10, 0, -4);
    g.bezierCurveTo(6, -10, 11, -1, 0, 7);
    g.stroke();
  });
  S.hudShield = makeSprite(24, (g) => {
    const p = poly([[0, -8], [7, -5], [6, 3], [0, 8], [-6, 3], [-7, -5]]);
    glowFill(g, '#3ff6ff', 0, p, 0.5); glowStroke(g, '#3ff6ff', 1.4, 6, p, 1);
  });
}
