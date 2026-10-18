import { G, view } from '../src/game/state.js';
import { sv } from '../src/game/stageview.js';
import { drawMini, prewarmMiniArt } from '../src/render/miniArt.js';
import { MINI_ART } from '../src/render/miniImageSpecs.js';
import { MINI_ATTACKS } from '../src/game/minibosses.js';
import { miniImage } from '../src/render/miniImages.js';

const IDS = Object.keys(MINI_ART);
const CAMERAS = ['top', 'side', 'chase'];
const CANVAS = { width: 580, height: 420 };
const state = {
  id: IDS[0],
  phase: 1,
  background: 'dark',
  pixel: false,
  flash: false,
  attack: true,
};
const root = document.querySelector('#views');
const samples = new Map();
const controls = Object.fromEntries(
  ['mini', 'phase', 'background', 'pixel', 'flash', 'attack'].map(id => [
    id,
    document.getElementById(id),
  ]),
);
const lowResolutionCanvas = document.createElement('canvas');

prewarmMiniArt();
view.W = 450;
view.H = 800;
G.player = { x: 225, y: 700, bank: 0, pitch: 0, ship: 'vector' };
G.director = { diff: { hp: 1, blackout: false } };

for (const id of IDS) {
  controls.mini.add(new Option(`${MINI_ART[id].name || id.toUpperCase()} · ${id}`, id));
}

function makeSample(mode) {
  const figure = document.createElement('figure');
  figure.className = 'view';

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS.width;
  canvas.height = CANVAS.height;

  const caption = document.createElement('figcaption');
  caption.innerHTML = `<span>${mode.toUpperCase()}</span><span class="status">Loading</span>`;
  figure.append(canvas, caption);
  root.append(figure);

  return { canvas, status: caption.querySelector('.status') };
}

for (const camera of CAMERAS) samples.set(camera, makeSample(camera));

function drawBackground(ctx, width, height) {
  ctx.fillStyle = state.background === 'light'
    ? '#e8edf2'
    : state.background === 'checker' ? '#18222a' : '#09111f';
  ctx.fillRect(0, 0, width, height);

  if (state.background !== 'checker') return;
  ctx.fillStyle = '#222f38';
  for (let y = 0; y < height; y += 24) {
    for (let x = (y / 24 % 2) * 12; x < width; x += 24) {
      ctx.fillRect(x, y, 12, 12);
    }
  }
}

function makePose(time) {
  const spec = MINI_ART[state.id];
  const attack = MINI_ATTACKS[state.id];
  const enemy = {
    type: 'boss',
    boss: true,
    mini: true,
    kind: state.id,
    name: spec.name || state.id.toUpperCase(),
    title: spec.title || '',
    x: 0,
    y: 0,
    r: spec.r || 28,
    color: spec.color,
    phase: state.phase,
    flash: state.flash ? 1 : 0,
    alpha: 1,
    state: 'fight',
    anim: time,
    t: time,
    entered: true,
    parts: [],
    trail: [],
    drones: [],
    hold: false,
    muz: 0,
    pump: 0,
    ghost: null,
    atk: null,
    rot: 0,
    arm: 56,
    shA: time * 1.05,
    shHit: 0,
  };

  const parts = attack?.parts?.(enemy) || [[0, 0, enemy.r]];
  enemy.parts = parts.map(([x, y, radius]) => ({
    x: enemy.x + x,
    y: enemy.y + y,
    r: radius,
  }));

  if (state.id === 'arclight') {
    for (let index = 0; index < 2; index++) {
      const angle = enemy.anim + index * Math.PI;
      enemy.parts.push({
        x: enemy.x + Math.cos(angle) * enemy.arm,
        y: enemy.y + Math.sin(angle) * enemy.arm * 0.8,
        r: 12,
      });
    }
  }

  if (state.attack) {
    enemy.muz = 0.05;
    enemy.pump = 1;
    enemy.shHit = state.id === 'citadel' ? 0.12 : 0;
    if (state.id === 'razorwing') {
      enemy.dive = { x0: -72, y0: -52, x1: 72, y1: 58, t: 0.8 };
    }
    if (state.id === 'specter') enemy.ghost = { x: -22, y: 12, t: 0.65 };
  }

  return enemy;
}

function drawPose(ctx, mode, enemy, flash) {
  ctx.save();
  if (mode === 'side') ctx.rotate(Math.PI / 2);
  drawMini(ctx, enemy, flash);
  ctx.restore();
}

function drawSample(camera, sample, time) {
  const { canvas, status } = sample;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackground(ctx, CANVAS.width, CANVAS.height);

  let target = ctx;
  if (state.pixel) {
    lowResolutionCanvas.width = CANVAS.width / 2;
    lowResolutionCanvas.height = CANVAS.height / 2;
    target = lowResolutionCanvas.getContext('2d');
    target.setTransform(1, 0, 0, 1, 0, 0);
    drawBackground(target, lowResolutionCanvas.width, lowResolutionCanvas.height);
  }

  const ratio = state.pixel ? 0.5 : 1;
  target.save();
  target.scale(ratio, ratio);

  const enemy = makePose(time);
  const previousCamera = sv.mode;
  sv.mode = camera;
  G.time = time;

  target.save();
  target.translate(200, 190);
  target.scale(2, 2);
  drawPose(target, camera, enemy, state.flash);
  target.restore();

  target.fillStyle = state.background === 'light' ? '#263846' : '#89aaba';
  target.font = '11px system-ui';
  target.textAlign = 'center';
  target.fillText('ENLARGED · 2×', 200, 402);

  target.save();
  target.translate(450, 260);
  target.fillStyle = state.background === 'light' ? '#f5f7fa' : '#07101b';
  target.fillRect(-90, -90, 180, 180);
  target.strokeStyle = '#4d6875';
  target.lineWidth = 1;
  target.strokeRect(-90, -90, 180, 180);
  drawPose(target, camera, enemy, state.flash);
  target.restore();
  target.fillText('NATIVE · 1×', 450, 372);

  target.restore();
  sv.mode = previousCamera;

  if (state.pixel) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(lowResolutionCanvas, 0, 0, CANVAS.width, CANVAS.height);
    ctx.imageSmoothingEnabled = true;
  }

  const color = state.phase > 1 ? MINI_ART[state.id].phaseColor : MINI_ART[state.id].color;
  const selected = miniImage(state.id, camera, null, color);
  status.textContent = selected?.generated ? 'generated camera art' : 'procedural fallback';
}

function render() {
  const time = performance.now() / 1000;
  try {
    for (const [camera, sample] of samples) drawSample(camera, sample, time);
    const generated = CAMERAS.filter(camera =>
      miniImage(state.id, camera, null)?.generated,
    ).length;
    document.querySelector('#asset-status').textContent =
      `${generated}/3 generated cameras · phase ${state.phase}`;
  } catch (error) {
    document.querySelector('#asset-status').textContent = `Preview error: ${error.message}`;
    console.error(error);
    return;
  }
  requestAnimationFrame(render);
}

const frame = document.querySelector('iframe');
const gameStatus = document.querySelector('#game-status');
const origin = JSON.stringify(location.origin);
const gameRoot = new URL('../', location.href).href;
const storage = new URL('background-preview-storage.js', location.href).href;
let ready = false;
let pending = null;

const runtime = `
  import { spawnBoss } from '${new URL('src/game/bosses.js', gameRoot).href}';
  import { G, view } from '${new URL('src/game/state.js', gameRoot).href}';
  import { sv } from '${new URL('src/game/stageview.js', gameRoot).href}';

  const origin = ${origin};
  window.addEventListener('message', event => {
    if (event.source !== parent || event.data?.kind !== 'mini-preview') return;
    const N = window.NEON;
    if (!N) return;

    try {
      N.startRun('vector');
      G.banner = null;
      G.player.god = true;
      G.player.fireT = 1e6;
      for (const pool of [
        G.enemies, G.pBullets, G.eBullets, G.beams, G.bolts, G.pickups,
        G.obstacles, G.particles, G.texts,
      ]) pool.length = 0;

      G.boss = null;
      G.director.state = 'await';
      G.director.queue.length = 0;
      sv.enter(event.data.camera);

      const boss = spawnBoss(event.data.id, 1, 0);
      boss.x = view.W / 2;
      boss.y = boss.homeY + view.safeTop;
      boss.state = 'fight';
      boss.invuln = true;
      boss.phase = event.data.phase;
      boss.gap = event.data.attack ? 0.5 : 1e6;
      boss.flash = event.data.flash ? 1 : 0;
      boss.alpha = 1;

      parent.postMessage({
        kind: 'mini-preview-ready',
        id: boss.kind,
        camera: sv.mode,
      }, origin);
    } catch (error) {
      parent.postMessage({
        kind: 'mini-preview-error',
        message: error?.message || String(error),
      }, origin);
    }
  });
  parent.postMessage({ kind: 'mini-preview-runtime-ready' }, origin);
`;

try {
  const response = await fetch('../index.html');
  if (!response.ok) throw Error(`index.html HTTP ${response.status}`);
  const html = await response.text();
  const bootstrap = `<base href="${gameRoot}"><script src="${storage}"><` +
    `/script><script type="module">${runtime.replaceAll('</script', '<\\/script')}<` +
    '/script>';
  frame.srcdoc = html.replace('<head>', `<head>${bootstrap}`);
} catch (error) {
  gameStatus.textContent = `Preview error: ${error.message}`;
}

function refreshLive() {
  if (!frame.contentWindow.NEON) return;
  pending = {
    kind: 'mini-preview',
    id: state.id,
    phase: state.phase,
    flash: state.flash,
    attack: state.attack,
    camera: document.querySelector('#live-camera').value,
  };
  if (ready) {
    frame.contentWindow.postMessage(pending, location.origin);
    pending = null;
  }
}

frame.addEventListener('load', () => {
  const poll = setInterval(() => {
    const N = frame.contentWindow.NEON;
    if (!N) return;
    clearInterval(poll);
    try {
      N.profile.settings.music = 0;
      N.profile.settings.sfx = 0;
      N.profile.settings.story = false;
      N.skipIntro();
      N.comms.skipAll();
      document.querySelector('#restart').disabled = false;
      document.querySelector('#simulate').disabled = false;
      document.querySelector('#pixel-game').disabled = false;
      gameStatus.textContent = 'Sandbox ready · save isolated';
      refreshLive();
    } catch (error) {
      gameStatus.textContent = `Preview error: ${error.message}`;
    }
  }, 100);
  setTimeout(() => clearInterval(poll), 15000);
});

for (const [id, key] of [
  ['mini', 'id'],
  ['phase', 'phase'],
  ['background', 'background'],
  ['pixel', 'pixel'],
  ['flash', 'flash'],
  ['attack', 'attack'],
]) {
  controls[id].addEventListener('input', () => {
    state[key] = ['pixel', 'flash', 'attack'].includes(key)
      ? controls[id].checked
      : key === 'phase' ? Number(controls[id].value) : controls[id].value;
    refreshLive();
  });
}

render();
document.querySelector('#restart').addEventListener('click', refreshLive);
document.querySelector('#simulate').addEventListener('click', () => {
  const N = frame.contentWindow.NEON;
  if (!N) return;
  N.simulate(3);
  const G = N.G;
  gameStatus.textContent =
    `Simulated 3s · ${G.boss?.kind || state.id} · ${G.eBullets.length} enemy shots · ${G.boss?.atk?.name || 'attack cycle active'}`;
});
document.querySelector('#live-camera').addEventListener('change', refreshLive);
document.querySelector('#pixel-game').addEventListener('click', () => {
  const N = frame.contentWindow.NEON;
  if (!N) return;
  N.profile.settings.retro = N.profile.settings.retro === 'pixel' ? 'off' : 'pixel';
  refreshLive();
});

window.addEventListener('message', event => {
  if (event.source !== frame.contentWindow) return;
  if (event.data?.kind === 'mini-preview-runtime-ready') {
    ready = true;
    if (pending) {
      frame.contentWindow.postMessage(pending, location.origin);
      pending = null;
    }
  } else if (event.data?.kind === 'mini-preview-ready') {
    gameStatus.textContent = `${event.data.id} · ${event.data.camera} · save isolated`;
  } else if (event.data?.kind === 'mini-preview-error') {
    gameStatus.textContent = `Preview error: ${event.data.message}`;
  }
});
