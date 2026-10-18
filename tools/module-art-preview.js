import { MODULE_ART } from '../src/render/moduleImageSpecs.js';
import { moduleImage, prewarmModuleImages } from '../src/render/moduleImages.js';
import { S, buildSprites } from '../src/render/sprites.js';
import { SHIPS } from '../src/game/ships.js';

buildSprites(SHIPS);
prewarmModuleImages();

const FALLBACK = {
  blade: 'blade',
  drone: 'drone',
  interceptor: 'interceptor',
  mine: null,
  saw: 'blade',
};
const IDS = Object.keys(MODULE_ART);
const MODES = ['top', 'side', 'chase'];
const CANVAS = { width: 440, height: 310 };
const state = {
  id: IDS[0],
  background: 'dark',
  pixel: false,
  evolution: false,
  fortress: 0,
};
const root = document.querySelector('#views');
const samples = new Map();

// The physical mine has no generated file fallback, so keep a small procedural
// ring visible while its three camera images decode.
const MINE_FALLBACK = (() => {
  const img = document.createElement('canvas');
  img.width = img.height = 48;
  const ctx = img.getContext('2d');
  ctx.strokeStyle = '#ff9e3d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(24, 24, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd0a0';
  ctx.fillRect(20, 20, 8, 8);
  return { img, size: 24, half: 12 };
})();

for (const id of IDS) {
  document.querySelector('#module').add(new Option(id.toUpperCase(), id));
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

  return {
    canvas,
    status: caption.querySelector('.status'),
    pixel: document.createElement('canvas'),
  };
}

for (const mode of MODES) samples.set(mode, makeSample(mode));

function drawBackground(ctx) {
  const { width, height } = CANVAS;
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

function selectedFallback() {
  return state.id === 'mine' ? MINE_FALLBACK : S[FALLBACK[state.id]];
}

function drawSample(mode, sample) {
  const { canvas, status } = sample;
  const ctx = canvas.getContext('2d');
  const size = MODULE_ART[state.id].size || 30;
  const sprite = moduleImage(state.id, mode, selectedFallback());
  const ink = state.background === 'light' ? '#263846' : '#89aaba';

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackground(ctx);

  // At six times scale even the largest 30-unit module fits inside this view.
  ctx.save();
  ctx.translate(220, 130);
  if (mode === 'side') ctx.rotate(Math.PI / 2);
  ctx.imageSmoothingEnabled = !state.pixel;
  ctx.drawImage(sprite.img, -size * 3, -size * 3, size * 6, size * 6);
  ctx.restore();

  // Keep the native sample separate so small craft can be judged at gameplay
  // size without competing with a redundant player-scale copy.
  ctx.save();
  ctx.translate(90, 220);
  if (mode === 'side') ctx.rotate(Math.PI / 2);
  ctx.imageSmoothingEnabled = !state.pixel;
  ctx.drawImage(sprite.img, -size / 2, -size / 2, size, size);
  ctx.restore();

  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.font = '11px system-ui';
  ctx.fillText('NATIVE · 1×', 90, 263);
  ctx.fillText('ENLARGED · 6×', 220, 263);

  status.textContent = sprite.generated ? 'generated art' : 'procedural fallback';
  status.className = `status${sprite.generated ? '' : ' dim'}`;

  if (state.pixel) {
    const low = sample.pixel;
    low.width = CANVAS.width / 2;
    low.height = CANVAS.height / 2;
    low.getContext('2d').drawImage(canvas, 0, 0, low.width, low.height);
    ctx.clearRect(0, 0, CANVAS.width, CANVAS.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(low, 0, 0, CANVAS.width, CANVAS.height);
    ctx.imageSmoothingEnabled = true;
  }
}

function render() {
  try {
    for (const [mode, sample] of samples) drawSample(mode, sample);
    const generated = MODES.filter(mode =>
      moduleImage(state.id, mode, selectedFallback())?.generated,
    ).length;
    document.querySelector('#asset-status').textContent =
      `${generated}/3 generated camera views · ${state.id}`;
  } catch (error) {
    document.querySelector('#asset-status').textContent = `Preview error: ${error.message}`;
    console.error(error);
    return;
  }
  requestAnimationFrame(render);
}

const frame = document.querySelector('iframe');
const status = document.querySelector('#game-status');
const parentOrigin = JSON.stringify(location.origin);
const gameRoot = new URL('../', location.href).href;
const storage = new URL('background-preview-storage.js', location.href).href;
let runtimeReady = false;
let pending = null;

const runtime = `
  import { G, view } from '${new URL('src/game/state.js', gameRoot).href}';
  import { sv } from '${new URL('src/game/stageview.js', gameRoot).href}';

  const origin = ${parentOrigin};
  window.addEventListener('message', event => {
    if (event.source !== parent || event.data?.kind !== 'module-preview') return;
    const N = window.NEON;
    if (!N) return;

    try {
      N.startRun('vector');
      G.banner = null;
      G.player.god = true;
      G.player.fireT = 1e6;
      G.director.spawnT = 1e6;
      G.director.duration = 1e6;
      G.director.queue.length = 0;
      G.enemies.length = 0;
      sv.enter(event.data.camera);

      const player = G.player;
      const id = event.data.id;
      const fortress = Number(event.data.fortress) || 0;
      player.up = {};
      player.mod.orbA = 0;
      player.mod.mines = [];
      player.mod.saws = [];
      player.mod.interceptors = [];
      player.drones = [];
      player.up.orbitals = id === 'blade' ? 2 : 0;
      player.up.drones = id === 'drone' ? 3 : 0;
      player.up.droneSwarm = id === 'interceptor' ? 2 : 0;
      player.up.mines = id === 'mine' ? 4 : 0;
      player.up.saw = id === 'saw' ? 3 : 0;
      if (event.data.evolution && id === 'blade') player.up.stormhalo = 1;
      if (event.data.evolution && id === 'drone') player.up.phalanx = 1;
      player.cls = fortress ? 'engineer' : 'striker';
      player.odT = fortress ? 1e6 : 0;
      player.ultLv = fortress || 3;

      // Durable stationary targets let interceptors and saws show their real
      // launch, orbit, and contact behavior without ending the preview.
      if (id === 'interceptor' || id === 'saw') {
        for (const x of [view.W * 0.38, view.W * 0.62]) {
          const enemy = N.spawn('tank', x, view.H * 0.3, {
            mv: 'hover', speed: 0, stay: 1e6, fireDelay: 1e6, gap: 1e6,
          });
          enemy.hp = enemy.maxHp = 1e9;
          enemy.entered = true;
          enemy.untargetable = false;
          enemy.mv = 'stationary';
          enemy.state = 'hold';
          enemy.x = enemy.tx = x;
          enemy.y = enemy.ty = view.H * 0.3;
          enemy.fireT = 1e6;
        }
      }

      parent.postMessage({
        kind: 'module-preview-ready',
        id,
        camera: sv.mode,
        evolution: !!event.data.evolution,
        fortress,
      }, origin);
    } catch (error) {
      parent.postMessage({
        kind: 'module-preview-error',
        message: error?.message || String(error),
      }, origin);
    }
  });
  parent.postMessage({ kind: 'module-preview-runtime-ready' }, origin);
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
  status.textContent = `Preview error: ${error.message}`;
}

function refreshLive() {
  if (!frame.contentWindow.NEON) return;
  pending = {
    kind: 'module-preview',
    id: state.id,
    camera: document.querySelector('#live-camera').value,
    evolution: state.evolution,
    fortress: state.fortress,
  };
  if (runtimeReady) {
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
      status.textContent = 'Sandbox ready · save isolated';
      refreshLive();
    } catch (error) {
      status.textContent = `Preview error: ${error.message}`;
    }
  }, 100);
  setTimeout(() => clearInterval(poll), 15000);
});

for (const [id, key] of [
  ['module', 'id'],
  ['background', 'background'],
  ['pixel', 'pixel'],
  ['evolution', 'evolution'],
  ['fortress', 'fortress'],
]) {
  document.getElementById(id).addEventListener('input', event => {
    state[key] = ['pixel', 'evolution'].includes(key)
      ? event.target.checked
      : key === 'fortress' ? Number(event.target.value) : event.target.value;
    refreshLive();
  });
}

render();
document.querySelector('#restart').addEventListener('click', refreshLive);
document.querySelector('#live-camera').addEventListener('change', refreshLive);
document.querySelector('#simulate').addEventListener('click', () => {
  const N = frame.contentWindow.NEON;
  if (!N) return;

  try {
    N.simulate(1);
    const player = N.G.player;
    const groups = {
      drones: player.drones || [],
      interceptors: player.mod.interceptors || [],
      mines: player.mod.mines || [],
      saws: player.mod.saws || [],
    };

    for (const [name, objects] of Object.entries(groups)) {
      objects.forEach((object, index) => {
        if (!Number.isFinite(object.x) || !Number.isFinite(object.y)) {
          throw Error(`${name}[${index}] has invalid position (${object.x}, ${object.y})`);
        }
      });
    }

    const counts = Object.entries(groups)
      .map(([name, objects]) => `${name} ${objects.length}`)
      .join(' · ');
    const interceptorStates = groups.interceptors.reduce((states, interceptor) => {
      const state = interceptor.state || 'unknown';
      states[state] = (states[state] || 0) + 1;
      return states;
    }, {});
    const stateSummary = Object.entries(interceptorStates)
      .map(([state, count]) => `${state} ${count}`)
      .join(', ');
    status.textContent = `Simulated 1s · ${counts}${stateSummary ? ` · interceptor states: ${stateSummary}` : ''}`;
  } catch (error) {
    status.textContent = `Simulation error: ${error.message}`;
    console.error(error);
  }
});
document.querySelector('#pixel-game').addEventListener('click', () => {
  const N = frame.contentWindow.NEON;
  if (!N) return;
  N.profile.settings.retro = N.profile.settings.retro === 'pixel' ? 'off' : 'pixel';
  refreshLive();
});

window.addEventListener('message', event => {
  if (event.source !== frame.contentWindow) return;
  if (event.data?.kind === 'module-preview-runtime-ready') {
    runtimeReady = true;
    if (pending) {
      frame.contentWindow.postMessage(pending, location.origin);
      pending = null;
    }
  } else if (event.data?.kind === 'module-preview-ready') {
    status.textContent = `${event.data.id} · ${event.data.camera} · save isolated`;
  } else if (event.data?.kind === 'module-preview-error') {
    status.textContent = `Preview error: ${event.data.message}`;
  }
});
