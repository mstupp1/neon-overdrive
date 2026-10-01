// Simulation step, collision resolution and world rendering.

import { G, view } from './state.js';
import { S, glow } from '../render/sprites.js';
import { TAU, segDist2, dist2 } from '../core/math.js';
import { bg } from '../render/background.js';
import { updateDirector } from './director.js';
import { updatePlayer, drawPlayer, hurtPlayer, gainOverdrive, addScore } from './player.js';
import { pilotTimeScale, domeErase, onGraze, phasing } from './pilot.js';
import { updateModules, updateBeams, drawModules, drawBeams } from './modules.js';
import { updateEnemies, damageEnemy } from './enemies.js';
import { drawBoss } from './bosses.js';
import { updatePlayerBullets, updateEnemyBullets, drawPlayerBullets, drawEnemyBullets } from './bullets.js';
import { updatePickups, drawPickups } from './pickups.js';
import { updateParticles, drawParticles, updateTexts, drawTexts, sparks, explosion } from './fx.js';
import { sfx } from '../core/audio.js';

export function step(dt) {
  const p = G.player;
  G.time += dt;
  if (G.mode === 'run' && !p.dead) G.runTime += dt;
  updateDirector(dt);
  updatePlayer(p, dt);
  updateModules(p, dt);
  const et = dt * pilotTimeScale(p, dt); // enemy time (Phase Shift slows it)
  updateEnemies(et);
  updatePlayerBullets(dt);
  updateEnemyBullets(et);
  updateBeams(dt);
  collide(p);
  updatePickups(dt);
  updateParticles(dt);
  updateTexts(dt);
  if (G.comboTimer > 0) {
    G.comboTimer -= dt;
    if (G.comboTimer <= 0) G.combo = 0;
  }
  if (G.pulse > 0) {
    G.pulse += dt * 1100;
    if (G.pulse > G.pulseMax) G.pulse = 0;
  }
}

// --- Collisions -------------------------------------------------------------------

function hitTest(e, x, y, r) {
  if (e.parts) {
    if (e.boss && dist2(x, y, e.x, e.y) > 200 * 200) return false;
    for (const pt of e.parts) {
      const rr = pt.r + r;
      if (dist2(x, y, pt.x, pt.y) < rr * rr) return true;
    }
    return false;
  }
  const rr = e.r + r;
  const dx = x - e.x;
  if (dx > rr || dx < -rr) return false;
  const dy = y - e.y;
  if (dy > rr || dy < -rr) return false;
  return dx * dx + dy * dy < rr * rr;
}

function collide(p) {
  const enemies = G.enemies;
  const crit = p.st.crit;

  // Player bullets → torpedoes (destroyable enemy shots)
  for (const t of G.eBullets) {
    if (t.dead || !t.hp) continue;
    for (const b of G.pBullets) {
      if (b.dead) continue;
      const rr = t.r + b.r + 4;
      if (dist2(b.x, b.y, t.x, t.y) < rr * rr) {
        t.hp -= b.dmg;
        t.flash = 0.05;
        b.dead = true;
        if (t.hp <= 0) {
          t.dead = true;
          explosion(t.x, t.y, '#ff3b3b', 0.8);
          addScore(150);
          sfx.explode(0.8);
          break;
        }
      }
    }
  }

  // Player bullets → enemies
  for (const b of G.pBullets) {
    if (b.dead) continue;
    for (const e of enemies) {
      if (e.dead || (!e.entered && !e.boss) || e.state === 'dying') continue;
      if (!hitTest(e, b.x, b.y, b.r)) continue;
      if (b.hits.includes(e)) continue;
      const isCrit = crit > 0 && Math.random() < crit;
      const dmg = b.dmg * (isCrit ? p.st.critMul : 1);
      if (!e.invuln) {
        damageEnemy(e, dmg, b.x, b.y, isCrit);
        sfx.hit();
      } else {
        sparks(b.x, b.y, '#ffffff', 1, 120);
      }
      sparks(b.x, b.y, e.color, isCrit ? 4 : 2, 160, Math.atan2(b.vy, b.vx) + Math.PI, 1.6);
      if (b.aoe) {
        explosion(b.x, b.y, '#ff9e3d', 0.6);
        const r2 = b.aoe * b.aoe;
        for (const o of enemies) {
          if (o === e || o.dead || !o.entered || o.boss) continue;
          if (dist2(b.x, b.y, o.x, o.y) < r2) damageEnemy(o, b.dmg * 0.6, o.x, o.y);
        }
      }
      if (b.pierce > 0 && !e.boss) {
        b.pierce--;
        b.hits.push(e);
      } else {
        b.dead = true;
        break;
      }
    }
  }

  // Player beams (rail lance)
  for (const beam of G.beams) {
    if (beam.owner !== 'player') continue;
    const half = beam.w / 2;
    for (const e of enemies) {
      if (e.dead || beam.hit.has(e) || !e.entered || e.state === 'dying') continue;
      const pts = e.parts || [e];
      for (const pt of pts) {
        if (pt.y < p.y && Math.abs(pt.x - beam.x) < half + pt.r) {
          beam.hit.add(e);
          damageEnemy(e, beam.dmg, pt.x, pt.y, false);
          sparks(pt.x, pt.y, '#9ffcff', 6, 240);
          break;
        }
      }
    }
    for (const b of G.eBullets) {
      if (b.dead || b.type === 'torpedo' || b.y > p.y) continue;
      if (Math.abs(b.x - beam.x) < half + b.r) {
        b.dead = true;
        sparks(b.x, b.y, '#ff9ad5', 2, 120);
      }
    }
  }

  if (p.dead) return;
  domeErase(p);

  // Enemy bullets → player (+ graze)
  const grazeR = 24 * p.st.grazeR;
  const ghost = phasing(p);
  for (const b of G.eBullets) {
    if (b.dead || b.delay > 0) continue;
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const lim = b.r + grazeR;
    if (dx > lim || dx < -lim || dy > lim || dy < -lim) continue;
    const d2 = dx * dx + dy * dy;
    const hr = b.r + p.r;
    if (d2 < hr * hr && !ghost) {
      if (p.iframes <= 0 && p.dashT <= 0) {
        b.dead = true;
        hurtPlayer(p);
      }
    } else if (!b.grazed && d2 < lim * lim) {
      b.grazed = true;
      G.grazes++;
      gainOverdrive(2.4 * p.st.grazeOd);
      addScore(25);
      sparks(p.x + dx * 0.5, p.y + dy * 0.5, '#ffffff', 2, 140);
      sfx.graze();
      onGraze(p);
    }
  }

  // Enemy bodies → player
  for (const e of enemies) {
    if (e.dead || !e.entered || e.state === 'dying') continue;
    if (e.parts) {
      for (const pt of e.parts) {
        const rr = pt.r * 0.8 + p.r;
        if (dist2(pt.x, pt.y, p.x, p.y) < rr * rr) {
          hurtPlayer(p);
          break;
        }
      }
    } else {
      const rr = e.r * 0.75 + p.r;
      if (dist2(e.x, e.y, p.x, p.y) < rr * rr) hurtPlayer(p);
    }
  }

  // Enemy lasers → player
  for (const beam of G.beams) {
    if (beam.owner !== 'enemy' || beam.tele > 0) continue;
    const L = beam.len || 1400;
    const ex = beam.x + Math.cos(beam.ang) * L;
    const ey = beam.y + Math.sin(beam.ang) * L;
    const rr = beam.w * 0.8 + p.r;
    if (segDist2(p.x, p.y, beam.x, beam.y, ex, ey) < rr * rr) hurtPlayer(p);
  }
}

// --- Rendering ----------------------------------------------------------------------

function drawTelegraphs(ctx) {
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (e.type === 'dasher' && e.state === 'tele') {
      const t = 1 - e.timer / 0.75;
      ctx.globalAlpha = 0.2 + t * 0.5;
      ctx.strokeStyle = '#ff4d6d';
      ctx.lineWidth = 1 + t * 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.aim) * 900, e.y + Math.sin(e.aim) * 900);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (e.type === 'sniper' && e.state === 'aim') {
      const locked = e.timer <= 0.28;
      ctx.globalAlpha = locked ? (Math.sin(G.time * 50) > 0 ? 0.9 : 0.3) : 0.35;
      ctx.strokeStyle = locked ? '#ffffff' : '#ffa62b';
      ctx.lineWidth = locked ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.aim) * 1000, e.y + Math.sin(e.aim) * 1000);
      ctx.stroke();
    } else if (e.type === 'blinker' && e.state === 'tele') {
      // Contracting ring: the burst fires when it closes.
      const t = 1 - e.timer / 0.5;
      ctx.globalAlpha = 0.25 + t * 0.6;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 1.5 + t * 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 14 + (1 - t) * 60, 0, TAU);
      ctx.stroke();
    } else if (e.type === 'mine' && e.state === 'arm') {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ff8a3d';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 30 + (0.75 - e.timer) * 60, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function drawRot(ctx, img, x, y, a, size, k) {
  const c = Math.cos(a) * k;
  const s = Math.sin(a) * k;
  ctx.setTransform(c, s, -s, c, x * k + view.ox, y * k + view.oy);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
}

// Shielder tethers + shield rings on linked enemies.
function drawShieldLinks(ctx) {
  let any = false;
  for (const e of G.enemies) {
    if (e.dead || e.type !== 'shielder' || !e.links || !e.links.length) continue;
    if (!any) {
      any = true;
      ctx.globalCompositeOperation = 'lighter';
    }
    const pulse = 0.5 + 0.2 * Math.sin(G.time * 6);
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = pulse * 0.8;
    ctx.beginPath();
    for (const o of e.links) {
      if (o.dead) continue;
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(o.x, o.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(G.time * 6);
    for (const o of e.links) {
      if (o.dead) continue;
      const sz = (o.r + 8) * 2.286;
      ctx.drawImage(S.shieldRing.img, o.x - sz / 2, o.y - sz / 2, sz, sz);
    }
  }
  if (any) {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawEnemies(ctx, k) {
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (e.boss) {
      drawBoss(ctx, e);
      continue;
    }
    const scale = e.elite ? 1.2 : 1;
    if (e.type === 'snake') {
      const seg = S.snakeSeg;
      for (let i = e.parts.length - 1; i >= 1; i--) {
        const pt = e.parts[i];
        const img = e.flash > 0 ? seg.flash : seg.img;
        const sz = seg.size * (1 - i * 0.04) * scale;
        ctx.drawImage(img, pt.x - sz / 2, pt.y - sz / 2, sz, sz);
      }
    }
    if (e.elite) {
      ctx.globalAlpha = 0.8;
      drawRot(ctx, S.eliteRing.img, e.x, e.y, G.time * 1.5, (e.r / 30) * 96 * 1.1, k);
      ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
      ctx.globalAlpha = 1;
    }
    const s = e.spr;
    const img = e.flash > 0 ? s.flash : s.img;
    if (e.alpha !== undefined) ctx.globalAlpha = e.alpha;
    drawRot(ctx, img, e.x, e.y, e.rot, s.size * scale, k);
    if (e.alpha !== undefined) ctx.globalAlpha = 1;
  }
  ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
  drawShieldLinks(ctx);

  // Health bars on tough enemies once damaged
  for (const e of G.enemies) {
    if (e.dead || e.boss || e.hp >= e.maxHp || (e.maxHp < 40 && !e.elite)) continue;
    const w = e.r * 1.6;
    const y = e.y + e.r + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - w / 2, y, w, 3);
    ctx.fillStyle = e.elite ? '#ffd84d' : e.color;
    ctx.fillRect(e.x - w / 2, y, (w * Math.max(0, e.hp)) / e.maxHp, 3);
  }
}

export function renderWorld(ctx, k) {
  bg.draw(ctx);
  drawPickups(ctx);
  drawTelegraphs(ctx);
  drawEnemies(ctx, k);
  drawBeams(ctx);
  drawPlayerBullets(ctx, k);
  drawModules(ctx, k);
  drawPlayer(ctx, k);
  drawParticles(ctx);
  drawEnemyBullets(ctx, k);
  drawTexts(ctx);

  // Overdrive shockwave
  if (G.pulse > 0 && G.player) {
    const p = G.player;
    const t = G.pulse / G.pulseMax;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = G.pulseColor;
    ctx.lineWidth = 16 * (1 - t) + 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, G.pulse, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Ult tint (class colour)
  if (G.player && G.player.odT > 0) {
    const g = glow(G.player.ucol, 64);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.08 + Math.sin(G.time * 6) * 0.03;
    ctx.drawImage(g.img, -view.W * 0.5, -view.H * 0.2, view.W * 2, view.H * 1.4);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
