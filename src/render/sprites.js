// Pre-rendered neon sprites. Glow is baked once into offscreen canvases with
// shadowBlur so the per-frame renderer never pays for blur.

import { TAU } from '../core/math.js';
import { withAlpha, poly, regular, glowStroke } from './ink.js';
import { drawShip } from './shipArt.js';
import { buildEnemyArt } from './enemyArt.js';

export { withAlpha };

// Engine flame: a 1 x 3 teardrop, hot white at the top (the nozzle) fading to colour. Drawn stretched per frame.
const flameCache = new Map();
export function flame(color) {
  let f = flameCache.get(color);
  if (f) return f;
  const c = document.createElement('canvas');
  c.width = 24;
  c.height = 72;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 72);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, withAlpha(color, 0.95));
  grd.addColorStop(0.6, withAlpha(color, 0.35));
  grd.addColorStop(1, withAlpha(color, 0));
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(2, 0);
  g.quadraticCurveTo(0, 8, 6, 30);
  g.quadraticCurveTo(10, 56, 12, 72);
  g.quadraticCurveTo(14, 56, 18, 30);
  g.quadraticCurveTo(24, 8, 22, 0);
  g.closePath();
  g.fill();
  g.globalCompositeOperation = 'lighter';
  const core = g.createLinearGradient(0, 0, 0, 34);
  core.addColorStop(0, 'rgba(255,255,255,0.9)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = core;
  g.beginPath();
  g.ellipse(12, 6, 5, 22, 0, 0, Math.PI * 2);
  g.fill();
  f = { img: c };
  flameCache.set(color, f);
  return f;
}

const RES = 2; // sprite texels per logical unit

function makeCanvas(w, h, res = RES) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * res);
  c.height = Math.ceil(h * res);
  return c;
}

// size: logical box. draw(ctx) is called with origin at the box centre. Detailed art bakes at res 3 so fine seams
// stay crisp on high-DPI screens; g.blurK keeps glow radii (canvas pixels) the same size in logical units.
export function makeSprite(size, draw, withFlash = false, res = RES) {
  const c = makeCanvas(size, size, res);
  const g = c.getContext('2d');
  g.scale(res, res);
  g.translate(size / 2, size / 2);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.blurK = res / RES;
  draw(g);
  const spr = { img: c, size, half: size / 2 };
  if (withFlash) {
    const f = makeCanvas(size, size, res);
    const fg = f.getContext('2d');
    fg.drawImage(c, 0, 0);
    fg.globalCompositeOperation = 'source-atop';
    fg.fillStyle = 'rgba(255,255,255,0.92)';
    fg.fillRect(0, 0, f.width, f.height);
    spr.flash = f;
  }
  return spr;
}

// Body fill: flat tint plus a soft white core light clipped to the shape, so every sprite reads as lit glass.
function glowFill(g, color, blur, pathFn, fillAlpha = 0.18) {
  g.save();
  g.globalAlpha = fillAlpha;
  g.fillStyle = color;
  g.beginPath();
  pathFn(g);
  g.fill();
  g.globalAlpha = Math.min(1, fillAlpha * 1.4 + 0.08);
  g.clip();
  const grd = g.createRadialGradient(0, -2, 0, 0, 0, 22);
  grd.addColorStop(0, 'rgba(255,255,255,0.32)');
  grd.addColorStop(0.45, withAlpha(color, 0.25));
  grd.addColorStop(1, withAlpha(color, 0));
  g.fillStyle = grd;
  g.fillRect(-40, -40, 80, 80);
  g.restore();
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

// --- Ships -------------------------------------------------------------------

// Ship art lives in shipArt.js (layered parts, weapons, seams, engines, canopy) and bakes from one paint colour.
function shipSprite(id, color) {
  return makeSprite(64, (g) => drawShip(g, id, color), false, 3);
}

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
  carrier: '#ffc27a',
  shielder: '#7aa7ff',
  weaver: '#d6ff3a',
  blinker: '#e0d4ff',
  hunter: '#ff2d2d',
  eclipsedrone: '#c23bff',
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
    } else if (sh.weapon === 'ricochet') {
      g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 8;
      g.beginPath(); poly([[0, -9], [3, 0], [0, 7], [-3, 0]])(g); g.fill();
      g.fillStyle = '#fff'; g.shadowBlur = 0;
      g.beginPath(); poly([[0, -6], [1.2, 0], [0, 4], [-1.2, 0]])(g); g.fill();
    } else if (sh.weapon === 'charge') {
      // Soft orb (drawn ~8 units radius; scaled up by weapon level in firePrimary).
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, 9);
      grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.35, c); grd.addColorStop(1, withAlpha(c, 0));
      g.fillStyle = grd;
      g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill();
      g.strokeStyle = c; g.lineWidth = 1.2; g.shadowColor = c; g.shadowBlur = 6;
      g.beginPath(); g.arc(0, 0, 6.5, 0, TAU); g.stroke();
    } else if (sh.weapon === 'wave') {
      // Teardrop with a bright head (weaving lances).
      g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 9;
      g.beginPath(); poly([[0, -8], [2.6, -2], [1.6, 6], [0, 9], [-1.6, 6], [-2.6, -2]])(g); g.fill();
      g.fillStyle = '#fff'; g.shadowBlur = 0;
      g.beginPath(); g.ellipse(0, -2.5, 1.2, 3.6, 0, 0, TAU); g.fill();
    } else if (sh.weapon === 'burst') {
      // Thin, hot needle round.
      g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 8;
      g.beginPath(); poly([[0, -11], [1.6, -3], [1.2, 9], [-1.2, 9], [-1.6, -3]])(g); g.fill();
      g.fillStyle = '#fff'; g.shadowBlur = 0;
      g.fillRect(-0.5, -9, 1, 15);
    } else if (sh.weapon === 'spark') {
      // Four-point spark.
      g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 10;
      g.beginPath(); poly([[0, -6], [1.3, -1.3], [5, 0], [1.3, 1.3], [0, 6], [-1.3, 1.3], [-5, 0], [-1.3, -1.3]])(g); g.fill();
      g.fillStyle = '#fff'; g.shadowBlur = 0;
      g.beginPath(); g.arc(0, 0, 1.4, 0, TAU); g.fill();
    } else if (sh.weapon === 'shard') {
      // Faceted crystal shard.
      g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 8;
      g.beginPath(); poly([[0, -8], [4, -3], [3, 5], [0, 8], [-3, 5], [-4, -3]])(g); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 0.9; g.shadowBlur = 0;
      g.beginPath(); g.moveTo(0, -7); g.lineTo(0, 7); g.moveTo(-3.5, -2.5); g.lineTo(0, 0); g.lineTo(3.5, -2.5); g.stroke();
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
  S['ship_' + ship.id] = shipSprite(ship.id, color);
  S['pb_' + ship.id] = bulletSprite(ship, bullet);
}

export function buildSprites(ships) {
  for (const sh of ships) S['ship_' + sh.id] = shipSprite(sh.id, sh.color);

  // Player bullets ---------------------------------------------------------
  for (const sh of ships) S['pb_' + sh.id] = bulletSprite(sh, sh.bullet);
  buildGearSpritesV2();
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

  // Enemies: see enemyArt.js (baked in buildEnemySpritesV2).
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

  // Fortress Protocol dome (ring radius 85 at scale 1), baked so the per-frame cost is one drawImage.
  S.dome = makeSprite(220, (g) => {
    const R = 85;
    const grd = g.createRadialGradient(0, 0, R * 0.55, 0, 0, R);
    grd.addColorStop(0, 'rgba(255,176,46,0)');
    grd.addColorStop(1, 'rgba(255,176,46,0.3)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    glowStroke(g, '#ffb02e', 2.6, 12, (c) => c.arc(0, 0, R, 0, TAU));
    g.save();
    g.globalAlpha = 0.35;
    g.strokeStyle = '#ffd98a'; g.lineWidth = 1; g.setLineDash([6, 8]);
    g.beginPath(); g.arc(0, 0, R - 7, 0, TAU); g.stroke();
    g.restore();
  });

  // ECHO's helmet bust (pilot screen now, comms later). 96x96 box.
  S.portrait_echo = makeSprite(96, (g) => {
    const shell = (c) => {
      c.moveTo(-23, 20); c.lineTo(-25, -6); c.quadraticCurveTo(-25, -34, 0, -37); c.quadraticCurveTo(25, -34, 25, -6);
      c.lineTo(23, 20); c.lineTo(11, 28); c.lineTo(-11, 28); c.closePath();
    };
    const shoulders = (c) => {
      c.moveTo(-44, 48); c.lineTo(-36, 36); c.lineTo(-14, 30); c.moveTo(14, 30); c.lineTo(36, 36); c.lineTo(44, 48);
    };
    glowStroke(g, '#3ff6ff', 2, 6, shoulders, 1);
    glowFill(g, '#3ff6ff', 0, shell, 0.16);
    glowStroke(g, '#3ff6ff', 2.4, 10, shell);
    // crest + cheek lines
    glowStroke(g, '#3ff6ff', 1.4, 5, (c) => { c.moveTo(0, -37); c.lineTo(0, -22); c.moveTo(-23, 12); c.lineTo(-13, 14); c.moveTo(23, 12); c.lineTo(13, 14); }, 1);
    // visor
    const visor = (c) => { c.moveTo(-19, -10); c.lineTo(19, -10); c.lineTo(15, 3); c.lineTo(-15, 3); c.closePath(); };
    glowFill(g, '#ff3df2', 0, visor, 0.55);
    glowStroke(g, '#ff3df2', 2, 9, visor);
    g.save();
    g.fillStyle = '#fff'; g.shadowColor = '#ff3df2'; g.shadowBlur = 8;
    g.fillRect(-11, -5, 22, 2.4);
    g.restore();
  });

  // MAG, the mission AI: a hex frame around a watching eye. 96x96 box.
  S.portrait_mag = makeSprite(96, (g) => {
    const C = '#3ff6ff';
    const hex = poly(regular(6, 37, Math.PI / 2));
    glowFill(g, C, 0, hex, 0.12);
    glowStroke(g, C, 2.4, 10, hex);
    glowStroke(g, C, 1.2, 5, poly(regular(6, 28, Math.PI / 2)), 1);
    glowStroke(g, C, 1.4, 5, (c) => {
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 2 + (i / 6) * TAU;
        c.moveTo(Math.cos(a) * 37, Math.sin(a) * 37);
        c.lineTo(Math.cos(a) * 45, Math.sin(a) * 45);
      }
    }, 1);
    const eye = (c) => { c.moveTo(-23, 0); c.quadraticCurveTo(0, -21, 23, 0); c.quadraticCurveTo(0, 21, -23, 0); c.closePath(); };
    glowFill(g, C, 0, eye, 0.28);
    glowStroke(g, C, 2, 8, eye);
    glowStroke(g, '#ff3df2', 1.6, 6, (c) => c.arc(0, 0, 8.5, 0, TAU), 1);
    g.save();
    g.fillStyle = '#fff'; g.shadowColor = C; g.shadowBlur = 8;
    g.fillRect(-1.6, -7, 3.2, 14);
    g.restore();
  });

  // SIGNAL, the hostile intelligence: a cracked, glitch-sliced mask. 96x96 box.
  S.portrait_signal = makeSprite(96, (g) => {
    const R = '#ff3d6e';
    const M = '#ff3df2';
    const mask = (c) => {
      c.moveTo(-26, -34); c.lineTo(26, -34); c.lineTo(30, -4); c.lineTo(20, 24); c.lineTo(8, 36); c.lineTo(-8, 36); c.lineTo(-20, 24); c.lineTo(-30, -4); c.closePath();
    };
    glowFill(g, R, 0, mask, 0.16);
    glowStroke(g, R, 2.4, 10, mask);
    // eyes: jagged slits, one displaced
    const eyeL = (c) => { c.moveTo(-21, -10); c.lineTo(-5, -14); c.lineTo(-8, -3); c.lineTo(-19, -4); c.closePath(); };
    const eyeR = (c) => { c.moveTo(21, -10); c.lineTo(5, -14); c.lineTo(8, -3); c.lineTo(19, -4); c.closePath(); };
    glowFill(g, R, 0, eyeL, 0.7); glowStroke(g, R, 1.8, 8, eyeL);
    glowFill(g, R, 0, eyeR, 0.7); glowStroke(g, R, 1.8, 8, eyeR);
    // crack down the face + mouth grille
    glowStroke(g, M, 1.4, 6, (c) => { c.moveTo(2, -34); c.lineTo(-4, -20); c.lineTo(3, -8); c.lineTo(-2, 6); c.lineTo(4, 18); }, 1);
    glowStroke(g, R, 1.2, 4, (c) => { for (const x of [-9, -3, 3, 9]) { c.moveTo(x, 20); c.lineTo(x, 29); } }, 1);
    // glitch slices: shifted copies of the outline
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = '#3ff6ff'; g.lineWidth = 1.4; g.globalAlpha = 0.7;
    g.beginPath(); g.moveTo(-34, -22); g.lineTo(-18, -22); g.moveTo(22, -22); g.lineTo(38, -22); g.stroke();
    g.strokeStyle = M;
    g.beginPath(); g.moveTo(-36, 10); g.lineTo(-12, 10); g.moveTo(14, 10); g.lineTo(36, 10); g.moveTo(-30, 30); g.lineTo(-16, 30); g.stroke();
    g.restore();
  });
}

// --- Step 6a enemies: Carrier, Shielder, Weaver, Blinker, Hunter, ECLIPSE (+ its drones) --------------
// Kept in one function (called from boot after buildSprites) so it stays separate from the roster above.

export function buildEnemySpritesV2() {
  const E = ENEMY_COLORS;
  buildEnemyArt(S, makeSprite, E);
  S.shieldRing = makeSprite(64, (g) => {
    g.save();
    g.globalAlpha = 0.16; g.fillStyle = E.shielder; g.beginPath(); g.arc(0, 0, 28, 0, TAU); g.fill();
    g.restore();
    glowStroke(g, E.shielder, 1.8, 8, (c) => c.arc(0, 0, 28, 0, TAU), 1);
  });
}

// --- Step 6b: Gravity Well, Reflector, Flak Burst and reflected-bullet sprites ----------------------------
function buildGearSpritesV2() {
  // Singularity core, radius ~50 at scale 1 (drawn rotated and scaled per frame).
  S.gwell = makeSprite(120, (g) => {
    const R = 52;
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, R);
    grd.addColorStop(0, 'rgba(0,0,0,0.95)');
    grd.addColorStop(0.3, 'rgba(20,4,40,0.8)');
    grd.addColorStop(0.75, 'rgba(160,60,255,0.25)');
    grd.addColorStop(1, 'rgba(160,60,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    for (let i = 0; i < 3; i++) {
      const a0 = (i / 3) * TAU;
      glowStroke(g, '#b86bff', 2.2, 8, (c) => {
        c.moveTo(Math.cos(a0) * 14, Math.sin(a0) * 14);
        for (let t = 0.1; t <= 1; t += 0.1) c.lineTo(Math.cos(a0 + t * 2.2) * (14 + t * 34), Math.sin(a0 + t * 2.2) * (14 + t * 34));
      }, 1);
    }
    glowStroke(g, '#e0b3ff', 1.8, 8, (c) => c.arc(0, 0, 9, 0, TAU), 1);
  });
  // Reflector bubble, ring radius 50 at scale 1.
  S.reflect = makeSprite(120, (g) => {
    const R = 50;
    const grd = g.createRadialGradient(0, 0, R * 0.5, 0, 0, R);
    grd.addColorStop(0, 'rgba(127,255,230,0)');
    grd.addColorStop(1, 'rgba(127,255,230,0.3)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    glowStroke(g, '#7fffe6', 2.6, 12, (c) => c.arc(0, 0, R, 0, TAU));
  });
  S.flak = makeSprite(20, (g) => {
    g.fillStyle = '#ffcf6b'; g.shadowColor = '#ff8a3d'; g.shadowBlur = 8;
    g.beginPath(); g.arc(0, 0, 4.2, 0, TAU); g.fill();
    g.shadowBlur = 0; g.fillStyle = '#fff';
    g.beginPath(); g.arc(0, 0, 2, 0, TAU); g.fill();
  });
  S.pb_refl = makeSprite(22, (g) => {
    g.fillStyle = '#7fffe6'; g.shadowColor = '#7fffe6'; g.shadowBlur = 8;
    g.beginPath(); g.arc(0, 0, 4.4, 0, TAU); g.fill();
    g.shadowBlur = 0; g.fillStyle = '#fff';
    g.beginPath(); g.arc(0, 0, 2.2, 0, TAU); g.fill();
  });
  // Annihilator afterglow strip (stretched vertically per frame).
  S.afterglow = makeSprite(24, (g) => {
    const grd = g.createLinearGradient(-12, 0, 12, 0);
    grd.addColorStop(0, 'rgba(255,61,242,0)');
    grd.addColorStop(0.5, 'rgba(255,200,250,0.9)');
    grd.addColorStop(1, 'rgba(255,61,242,0)');
    g.fillStyle = grd;
    g.fillRect(-12, -12, 24, 24);
  });
}
