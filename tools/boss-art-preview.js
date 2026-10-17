import { G, view } from '../src/game/state.js';
import { drawBoss } from '../src/game/bosses.js';
import { prewarmBossArt } from '../src/render/bossArt.js';
import { BOSS_ART } from '../src/render/bossImageSpecs.js';
import { bossImage, bossPart } from '../src/render/bossImages.js';
import { sv } from '../src/game/stageview.js';

const BOSSES = [
  { id: 'warden', name: 'WARDEN', color: '#ff7a18' },
  { id: 'hydra', name: 'HYDRA', color: '#6dff4d' },
  { id: 'omega', name: 'OMEGA', color: '#3ff6ff' },
  { id: 'eclipse', name: 'ECLIPSE', color: '#c23bff' },
];
const CAMERAS = ['top', 'side', 'chase'];
const controls = Object.fromEntries(['boss','phase','background','pixel','flash','attack'].map(id => [id, document.getElementById(id)]));
const viewRoot = document.querySelector('#views');
const samples = new Map();
const state = { boss: 'warden', phase: 1, background: 'dark', pixel: false, flash: false, attack: true };
const scratch = document.createElement('canvas');
const lowres = document.createElement('canvas');
prewarmBossArt();
G.player = { x: 225, y: 620, bank: 0, pitch: 0, ship: 'vector' };
G.director = { diff: { hp: 1, blackout: false } };
view.W = 450; view.H = 800;
for (const boss of BOSSES) controls.boss.add(new Option(`${boss.name} · ${boss.id}`, boss.id));

function makePose(id, t) {
  const def = BOSSES.find(b => b.id === id) || BOSSES[0];
  const e = { type: 'boss', boss: true, kind: id, name: def.name, title: def.name, x: 0, y: 0,
    r: id === 'warden' ? 40 : id === 'hydra' ? 46 : id === 'omega' ? 36 : 34,
    color: def.color, phase: state.phase, flash: state.flash ? 1 : 0, alpha: 1, state: 'fight',
    anim: t * 0.9, t, entered: true, parts: [], tentacles: null, trail: [], lanes: null,
    dome: false, warp: false, pulse: 0, frenzy: false, atk: null, drones: [] };
  if (id === 'hydra') {
    e.tentacles = Array.from({ length: 6 }, (_, i) => {
      const side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
      const x0 = side * (28 + row * 6), y0 = 18 + row * 14;
      const points = [];
      for (let k = 0; k <= 8; k++) {
        const u = k / 8, reach = 42 + row * 18 + 10 * Math.sin(t * 2 + i);
        points.push(x0 + side * reach * u + Math.sin(t * 2.7 + i + u * 3) * 9 * u,
          y0 + (side < 0 ? -1 : 1) * (20 + row * 7) * u + Math.cos(t * 2.1 + i + u * 4) * 9 * u);
      }
      return points;
    });
  }
  if (id === 'eclipse' && state.attack) {
    e.lanes = [{ x: -76, fired: false }, { x: 58, fired: false }]; e.laneT = 0.72;
    e.dome = true; e.warp = true; e.pulse = 0.54; e.frenzy = state.phase === 3;
    e.atk = state.phase >= 2 ? { name: 'mirrorFan' } : null;
    e.trail = [{ x: -22, y: 34, a: 0.3 }, { x: 18, y: -29, a: 0.18 }];
  }
  return e;
}

function canvasFor(mode) {
  const fig = document.createElement('figure'); fig.className = 'view';
  const canvas = document.createElement('canvas'); canvas.width = 460; canvas.height = 350;
  const cap = document.createElement('figcaption'); cap.innerHTML = `<span>${mode === 'top' ? 'OVERHEAD' : mode === 'side' ? 'SIDE-SCROLL' : 'PURSUIT'}</span><span class="status">Loading</span>`;
  fig.append(canvas, cap); viewRoot.append(fig);
  return { canvas, status: cap.querySelector('.status') };
}
for (const mode of CAMERAS) samples.set(mode, canvasFor(mode));

function paintBackground(ctx, w, h) {
  ctx.fillStyle = state.background === 'light' ? '#e8edf2' : state.background === 'checker' ? '#18222a' : '#09111f';
  ctx.fillRect(0, 0, w, h);
  if (state.background === 'checker') {
    ctx.fillStyle = '#222f38';
    for (let y = 0; y < h; y += 24) for (let x = (Math.floor(y / 24) % 2) * 12; x < w; x += 24) ctx.fillRect(x, y, 12, 12);
  }
}

function renderSample(mode, sample, now) {
  const { canvas, status } = sample, ctx = canvas.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0); paintBackground(ctx, canvas.width, canvas.height);
  const art = BOSS_ART[state.boss]?.views?.[mode];
  const selected = art && bossImage(state.boss, mode, null);
  status.textContent = selected?.generated ? 'generated view' : art ? 'procedural fallback · registered' : 'procedural fallback';
  status.className = `status${selected?.generated ? '' : ' dim'}`;
  let target = ctx;
  if (state.pixel) {
    lowres.width = 230; lowres.height = 175;
    target = lowres.getContext('2d'); target.setTransform(1,0,0,1,0,0); paintBackground(target, 230, 175);
  }
  const ratio = state.pixel ? 0.5 : 1;
  target.save(); target.scale(ratio, ratio); target.translate(230, 170);
  const e = makePose(state.boss, now); e.x = 0; e.y = 0;
  G.time = now; G.player.x = 225; G.player.y = 260;
  const previousMode = sv.mode; sv.mode = mode;
  target.save(); if (mode === 'side') target.rotate(Math.PI / 2); target.scale(1.16, 1.16); drawBoss(target, e); target.restore();
  target.fillStyle = state.background === 'light' ? '#263846' : '#89aaba'; target.font = '11px system-ui'; target.textAlign = 'center';
  target.fillText('ENLARGED · 1.16×', 0, 136);
  // Native-size sample sits in a framed inset, drawn by the same game routine.
  target.save(); target.translate(156, 100); target.fillStyle = state.background === 'light' ? '#f5f7fa' : '#07101b'; target.fillRect(-58, -58, 116, 116);
  target.strokeStyle = '#4d6875'; target.lineWidth = 1; target.strokeRect(-58, -58, 116, 116);
  if (mode === 'side') target.rotate(Math.PI / 2);
  target.scale(0.48, 0.48); drawBoss(target, e); target.restore();
  target.fillStyle = state.background === 'light' ? '#263846' : '#89aaba'; target.font = '10px system-ui'; target.fillText('FIT · 0.48×', 156, 165);
  target.restore(); sv.mode = previousMode;
  if (state.pixel) { ctx.imageSmoothingEnabled = false; ctx.drawImage(lowres, 0, 0, canvas.width, canvas.height); ctx.imageSmoothingEnabled = true; }
}

function render() {
  const now = performance.now() / 1000;
  try {
    for (const [mode, sample] of samples) renderSample(mode, sample, now);
    const loaded = CAMERAS.filter(mode => bossImage(state.boss, mode, null)?.generated).length;
    const parts = Object.keys(BOSS_ART[state.boss]?.parts || {});
    const readyParts = parts.filter(part => bossPart(state.boss, part, 'top', null)?.generated).length;
    document.querySelector('#asset-status').textContent = `${loaded}/3 generated views${parts.length ? ` · ${readyParts}/${parts.length} moving parts` : ''} · phase ${state.phase}`;
  } catch (error) {
    document.querySelector('#asset-status').textContent = `Preview error: ${error.message}`;
    console.error(error); return;
  }
  requestAnimationFrame(render);
}
for (const [id,key] of [['boss','boss'],['phase','phase'],['background','background'],['pixel','pixel'],['flash','flash'],['attack','attack']]) {
  controls[id].addEventListener('input', () => { state[key] = key === 'phase' ? Number(controls[id].value) : ['pixel','flash','attack'].includes(key) ? controls[id].checked : controls[id].value; refreshLive(); });
  controls[id].addEventListener('change', () => { state[key] = key === 'phase' ? Number(controls[id].value) : ['pixel','flash','attack'].includes(key) ? controls[id].checked : controls[id].value; refreshLive(); });
}
render();

// The full game lives in an iframe with a private, in-memory copy of localStorage.
const frame = document.querySelector('iframe');
const root = new URL('../', location.href).href;
const storage = new URL('background-preview-storage.js', location.href).href;
const parentOrigin = JSON.stringify(location.origin);
const runtime = `import { spawnBoss } from '${new URL('src/game/bosses.js', root).href}';
import { G, view } from '${new URL('src/game/state.js', root).href}';
import { sv } from '${new URL('src/game/stageview.js', root).href}';

const targetOrigin = ${parentOrigin};
window.addEventListener('message', ev => {
  if (ev.source !== parent || ev.data?.kind !== 'boss-preview') return;
  const N = window.NEON;
  if (!N) return;
  try {
    N.startRun('vector');
    G.banner = null;
    G.player.god = true;
    G.player.fireT = 1e6;
    for (const pool of [G.enemies, G.pBullets, G.eBullets, G.beams, G.bolts, G.pickups, G.obstacles, G.particles, G.texts]) pool.length = 0;
    G.boss = null;
    G.director.state = 'await';
    G.director.queue.length = 0;
    sv.enter(ev.data.camera);
    const e = spawnBoss(ev.data.boss, 1, 0);
    e.x = view.W / 2;
    e.y = e.homeY + view.safeTop;
    e.state = 'fight';
    e.invuln = true;
    e.phase = ev.data.phase;
    e.gap = ev.data.attack ? 0 : 1e6;
    e.flash = ev.data.flash ? 1 : 0;
    e.alpha = 1;
    G.player.god = true;
    parent.postMessage({kind:'boss-preview-ready', boss:e.kind, camera:sv.mode}, targetOrigin);
  } catch (error) {
    parent.postMessage({kind:'boss-preview-error', message:error?.message || String(error)}, targetOrigin);
  }
});
parent.postMessage({kind:'boss-preview-runtime-ready'}, targetOrigin);`;

const gameStatus = document.querySelector('#game-status');
let runtimeReady = false;
let pendingLiveMessage = null;
try {
  const response = await fetch('../index.html');
  if (!response.ok) throw new Error(`index.html returned HTTP ${response.status}`);
  const html = await response.text();
  const errors = `<script>
    window.addEventListener('error', event => {
      if (event.message) parent.postMessage({kind:'boss-preview-error', message:event.message}, ${parentOrigin});
    });
    window.addEventListener('unhandledrejection', event => {
      parent.postMessage({kind:'boss-preview-error', message:String(event.reason?.message || event.reason)}, ${parentOrigin});
    });
  </script>`;
  frame.srcdoc = html.replace('<head>', `<head><base href="${root}"><script src="${storage}"><` + `/script>${errors}<script type="module">${runtime.replaceAll('</script','<\\/script')}<` + `/script>`);
} catch (error) {
  gameStatus.textContent = `Preview error: ${error?.message || String(error)}`;
  console.error(error);
}
function refreshLive() {
  if (!frame.contentWindow.NEON) return;
  const camera = document.querySelector('#live-camera').value;
  pendingLiveMessage = {kind:'boss-preview',boss:state.boss,phase:state.phase,flash:state.flash,attack:state.attack,camera};
  if (runtimeReady) {
    frame.contentWindow.postMessage(pendingLiveMessage, location.origin);
    pendingLiveMessage = null;
  }
}
frame.addEventListener('load', () => {
  let finished = false;
  const poll = setInterval(() => {
    const N = frame.contentWindow.NEON;
    if (!N || finished) return;
    finished = true; clearInterval(poll); clearTimeout(timeout);
    try {
      N.profile.settings.music=0; N.profile.settings.sfx=0; N.profile.settings.story=false; N.skipIntro(); N.comms.skipAll();
      document.querySelector('#restart').disabled=false; document.querySelector('#pixel-game').disabled=false;
      gameStatus.textContent='Sandbox ready · save isolated'; refreshLive();
    } catch (error) {
      gameStatus.textContent = `Preview error: ${error?.message || String(error)}`;
      console.error(error);
    }
  }, 100);
  const timeout = setTimeout(() => {
    if (finished) return;
    finished = true; clearInterval(poll);
    if (!gameStatus.textContent.startsWith('Preview error:')) gameStatus.textContent='Preview error: sandbox did not finish loading';
  }, 15000);
});
document.querySelector('#restart').addEventListener('click', refreshLive);
document.querySelector('#live-camera').addEventListener('change', refreshLive);
document.querySelector('#pixel-game').addEventListener('click', () => { const N=frame.contentWindow.NEON; if (!N) return; N.profile.settings.retro=N.profile.settings.retro==='pixel'?'off':'pixel'; refreshLive(); });
window.addEventListener('message', ev => {
  if (ev.source !== frame.contentWindow) return;
  if (ev.data?.kind === 'boss-preview-runtime-ready') {
    runtimeReady = true;
    if (pendingLiveMessage) {
      frame.contentWindow.postMessage(pendingLiveMessage, location.origin);
      pendingLiveMessage = null;
    }
  } else if (ev.data?.kind === 'boss-preview-ready') {
    gameStatus.textContent=`${ev.data.boss} · ${ev.data.camera} · save isolated`;
  } else if (ev.data?.kind === 'boss-preview-error') {
    gameStatus.textContent=`Preview error: ${ev.data.message || 'iframe failed'}`;
    console.error('Boss preview iframe:', ev.data.message);
  }
});
