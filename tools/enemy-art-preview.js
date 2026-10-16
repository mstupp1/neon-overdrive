import { S, ENEMY_COLORS, buildEnemySpritesV2 } from '../src/render/sprites.js';
import { TYPES } from '../src/game/enemies.js';
import { enemySpriteForView, drawEnemyHull } from '../src/render/enemyImages.js';

const IDS = ['dart','swarm','spinner','dasher','snakeHead','snakeSeg','sniper','tank','splitter','mine','carrier','shielder','weaver','blinker','eclipseDrone'];
const MODES = ['top','side','chase'];
buildEnemySpritesV2();
const TYPE_FOR = Object.fromEntries(Object.entries(TYPES).map(([type, def]) => [def.spr, type]));
const COLORS = Object.fromEntries(Object.entries(TYPES).map(([type, def]) => [def.spr, ENEMY_COLORS[type]]));
const frameState = { flash: false, elite: false, opacity: 1, background: 'dark', pixel: false };
const roster = document.querySelector('#roster');
const entries = new Map();
const scratch = document.createElement('canvas');
scratch.width = scratch.height = 256;
const pixelScratch = document.createElement('canvas');
pixelScratch.width = pixelScratch.height = 205; // 360px game look / 450 logical units
function paintHull(ctx, sprite, enemy, mode, scale = 1) {
  const g = scratch.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 256, 256);
  drawEnemyHull(g, sprite, { ...enemy, x: 128, y: 128 }, mode, 1, 0, 0, scale * (frameState.elite ? 1.2 : 1));
  let source = scratch;
  if (frameState.pixel) {
    const p = pixelScratch.getContext('2d');
    p.clearRect(0, 0, 205, 205); p.drawImage(scratch, 0, 0, 205, 205);
    source = pixelScratch;
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(enemy.x, enemy.y);
  if (mode === 'side') ctx.rotate(Math.PI / 2); // mirror the real stage transform
  ctx.imageSmoothingEnabled = !frameState.pixel;
  ctx.drawImage(source, -128, -128, 256, 256); ctx.restore();
}

function makeCanvas(id, mode) {
  const wrap = document.createElement('div'); wrap.className = 'sample';
  const label = document.createElement('label'); label.innerHTML = `<span>${mode.toUpperCase()}</span><span class="status">loading</span>`;
  const canvas = document.createElement('canvas'); canvas.width = 360; canvas.height = 270;
  wrap.append(label, canvas);
  return { wrap, canvas, status: label.querySelector('.status') };
}

for (const id of IDS) {
  const row = document.createElement('section'); row.className = 'row';
  const label = id === 'snakeHead' ? 'Snake head' : id === 'snakeSeg' ? 'Snake segment' : (TYPE_FOR[id] || id).replace(/^./, c => c.toUpperCase());
  const title = document.createElement('h2'); title.textContent = `${label} · ${id}`;
  const samples = document.createElement('div'); samples.className = 'samples';
  const views = {};
  for (const mode of MODES) { views[mode] = makeCanvas(id, mode); samples.append(views[mode].wrap); }
  row.append(title, samples); roster.append(row);
  entries.set(id, { row, views, sprite: S[id] });
}

function paintBackground(ctx) {
  const color = frameState.background === 'light' ? '#e8edf2' : frameState.background === 'checker' ? '#18222a' : '#09111f';
  ctx.fillStyle = color; ctx.fillRect(0, 0, 360, 270);
  if (frameState.background === 'checker') {
    ctx.fillStyle = '#222f38';
    for (let y = 0; y < 270; y += 24) for (let x = (y / 24 % 2) * 12; x < 360; x += 24) ctx.fillRect(x, y, 12, 12);
  }
}

function drawOne(entry, mode) {
  const sample = entry.views[mode], ctx = sample.canvas.getContext('2d');
  sample.canvas.style.imageRendering = frameState.pixel ? 'pixelated' : 'auto';
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 360, 270); paintBackground(ctx);
  const sprite = enemySpriteForView(entry.sprite, mode);
  const t = performance.now() / 1000;
  const enemy = { x: 180, y: 92, rot: entry.sprite.enemyImageId === 'spinner' ? t * 1.6 : 0.18, t, lastShotAt: Math.floor(t * 4) / 4, carrierDoors: 0.5 + 0.5 * Math.sin(t * 0.9), flash: frameState.flash ? 1 : 0, color: COLORS[entry.sprite.enemyImageId] || '#3ff6ff', hp: 1, maxHp: 1 };
  ctx.save(); ctx.globalAlpha = frameState.opacity;
  if (frameState.pixel) ctx.imageSmoothingEnabled = false;
  paintHull(ctx, sprite, enemy, mode, 2.15);
  if (frameState.elite) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = frameState.opacity * 0.85; ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(180, 92, Math.max(32, sprite.size * 1.15), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
  // Compare both sprites at their original game's nominal footprint.
  ctx.fillStyle = frameState.background === 'light' ? '#263846' : '#89aaba';
  ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Procedural · native scale', 86, 204); ctx.fillText('Generated · native scale', 275, 204);
  ctx.save(); ctx.globalAlpha = frameState.opacity;
  if (frameState.pixel) ctx.imageSmoothingEnabled = false;
  const procedural = entry.sprite.procedural || entry.sprite;
  paintHull(ctx, procedural, { ...enemy, x: 86, y: 236 }, mode);
  paintHull(ctx, sprite, { ...enemy, x: 275, y: 236 }, mode);
  ctx.restore();
  sample.status.textContent = sprite?.generated ? 'generated' : 'procedural fallback';
  sample.status.className = 'status' + (sprite?.generated ? '' : ' dim');
}

function render() {
  try {
    for (const entry of entries.values()) for (const mode of MODES) drawOne(entry, mode);
    document.querySelector('#asset-status').textContent = `${IDS.filter(id => entries.get(id).sprite?.generated).length}/${IDS.length} subjects loaded · 3 cameras each`;
  } catch (error) {
    document.querySelector('#asset-status').textContent = `Preview error: ${error.message}`;
    console.error(error);
    return;
  }
  requestAnimationFrame(render);
}
for (const [selector, key] of [['#background','background'],['#pixel','pixel'],['#flash','flash'],['#elite','elite'],['#opacity','opacity']]) {
  document.querySelector(selector).addEventListener('input', event => { frameState[key] = key === 'opacity' ? +event.target.value : key === 'background' ? event.target.value : event.target.checked; });
  document.querySelector(selector).addEventListener('change', event => { frameState[key] = key === 'opacity' ? +event.target.value : key === 'background' ? event.target.value : event.target.checked; });
}
render();

// Keep the game sample isolated from the user's persistent progression.
const frame = document.querySelector('iframe');
const liveEnemy = document.querySelector('#live-enemy');
for (const type of Object.keys(TYPES).filter(id => id !== 'hunter')) liveEnemy.add(new Option(type, type));
function encounter() {
  const N = frame.contentWindow.NEON;
  N.startRun('vector'); N.G.player.god = true; N.G.player.fireT = 1e6;
  N.stage(document.querySelector('#live-camera').value);
  N.G.director.spawnT = 1e6;
  N.G.director.duration = 1e6; N.G.director.queue.length = 0;
  N.G.director.diff.blackout = document.querySelector('#live-blackout').checked;
  N.G.enemies.length = 0;
  N.sv.push();
  try {
    const types = liveEnemy.value === 'all' ? Object.keys(TYPES).filter(id => id !== 'hunter') : [liveEnemy.value];
    types.forEach((type, i) => {
      const x = types.length === 1 ? N.view.W / 2 : N.view.W * (0.2 + (i % 3) * 0.3);
      const y = types.length === 1 ? N.view.H * 0.4 : N.view.H * (0.16 + Math.floor(i / 3) * 0.12);
      const spawned = N.spawn(type, x, y, { mv: ['spinner', 'tank', 'shielder'].includes(type) ? 'hover' : 'down', stay: 30, speed: 10, wa: 8, fireDelay: 0.6, gap: 80 });
      for (const e of Array.isArray(spawned) ? spawned : [spawned]) {
        e.hp = e.maxHp = 1e6;
        e.elite = document.querySelector('#live-elite').checked && !TYPES[type].plain;
      }
    });
  } finally { N.sv.pop(); }
  document.querySelector('#game-status').textContent = `${liveEnemy.value} · ${N.sv.mode} · save isolated`;
}
const html = await (await fetch('../index.html')).text();
const root = new URL('../', location.href).href;
const storage = new URL('background-preview-storage.js', location.href).href;
const revision = Date.now();
const modules = ['render/sprites.js','render/enemyImages.js','render/enemyImageSpecs.js','game/enemies.js', ...IDS.map(id => `render/enemyImageSpecs/${id}.js`)];
const imports = Object.fromEntries(modules.map(path => [new URL(`src/${path}`, root).href, new URL(`src/${path}?enemyPreview=${revision}`, root).href]));
frame.srcdoc = html.replace('<head>', `<head><base href="${root}"><script type="importmap">${JSON.stringify({imports})}<` + `/script><script src="${storage}"><` + '/script>');
const ready = setInterval(() => {
  const N = frame.contentWindow.NEON;
  if (!N) return;
  clearInterval(ready);
  N.profile.settings.music = 0; N.profile.settings.sfx = 0; N.profile.settings.story = false;
  N.profile.settings.retro = 'off'; N.skipIntro(); N.comms.skipAll();
  encounter();
  document.querySelector('#launch').disabled = false;
  document.querySelector('#pixel-game').disabled = false;
  document.querySelector('#smoke').disabled = false;
  document.querySelector('#smoke-status').textContent = 'Ready · full roster, 3 cameras, 2 looks';
  document.querySelector('#game-status').textContent = 'Sandbox ready · save isolated';
}, 100);
document.querySelector('#launch').addEventListener('click', encounter);
for (const id of ['#live-enemy', '#live-camera', '#live-elite', '#live-blackout']) document.querySelector(id).addEventListener('change', () => { if (frame.contentWindow.NEON) encounter(); });
document.querySelector('#pixel-game').addEventListener('click', () => {
  const N = frame.contentWindow.NEON; N.profile.settings.retro = N.profile.settings.retro === 'off' ? 'pixel' : 'off';
});

document.querySelector('#smoke').addEventListener('click', async event => {
  const button = event.target, status = document.querySelector('#smoke-status');
  button.disabled = true;
  document.querySelector('details').open = true;
  const N = frame.contentWindow.NEON;
  const snapshot = { enemy: liveEnemy.value, camera: document.querySelector('#live-camera').value,
    elite: document.querySelector('#live-elite').checked, blackout: document.querySelector('#live-blackout').checked,
    retro: N.profile.settings.retro };
  let cases = 0;
  try {
    await Promise.all(IDS.map(id => S[id].ready));
    for (const mode of MODES) for (const retro of ['off', 'pixel']) {
      status.textContent = `Checking ${mode} / ${retro}…`;
      liveEnemy.value = 'all'; document.querySelector('#live-camera').value = mode;
      document.querySelector('#live-elite').checked = true;
      document.querySelector('#live-blackout').checked = true;
      N.profile.settings.retro = retro; encounter();
      const initial = [...N.G.enemies];
      await Promise.all(initial.map(e => e.spr.ready));
      if (initial.some(e => !e.spr.views?.[mode]?.generated) || !enemySpriteForView(S.snakeSeg, mode).generated) throw Error(`${mode}: generated view unavailable`);
      for (let step = 0; step < 16; step++) {
        N.simulate(0.5);
        if (N.G.enemies.some(e => !Number.isFinite(e.x + e.y + e.rot))) throw Error(`${mode}: non-finite enemy pose`);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      const tank = initial.find(e => e.type === 'tank');
      const carrier = initial.find(e => e.type === 'carrier');
      const snake = initial.find(e => e.type === 'snake');
      if (!Number.isFinite(tank.lastShotAt)) throw Error(`${mode}: tank never fired`);
      if (!(carrier.launches > 0)) throw Error(`${mode}: carrier never launched`);
      if (!snake.parts?.length || snake.parts.some(p => !Number.isFinite(p.x + p.y))) throw Error(`${mode}: invalid snake segments`);
      cases++;
    }
    status.textContent = `PASS · ${cases} live encounters · 14 enemy types · 3 cameras / 2 looks · elite + blackout · tank firing / carrier launch / snake segments`;
  } catch (error) {
    status.textContent = `FAIL · ${error.message}`; console.error(error);
  } finally {
    liveEnemy.value = snapshot.enemy; document.querySelector('#live-camera').value = snapshot.camera;
    document.querySelector('#live-elite').checked = snapshot.elite; document.querySelector('#live-blackout').checked = snapshot.blackout;
    N.profile.settings.retro = snapshot.retro; encounter(); button.disabled = false;
  }
});
