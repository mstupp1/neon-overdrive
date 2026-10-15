import { drawShip } from '../src/render/shipArt.js';
import { makeSprite } from '../src/render/sprites.js';
import { withShipImages, shipSpriteForView, SHIP_ART } from '../src/render/shipImages.js';
import { posedShipPoint } from '../src/render/shipMounts.js';
import { SHIPS, paintsFor } from '../src/game/ships.js';

const originals = Object.fromEntries(SHIPS.map(ship => [ship.id, makeSprite(64, g => drawShip(g, ship.id, ship.color), false, 3)]));
const fleet = Object.fromEntries(SHIPS.map(ship => [ship.id, withShipImages(ship.id, ship.color, originals[ship.id])]));
let N;
const selector = document.querySelector('#ship');
for (const ship of SHIPS) selector.add(new Option(`${ship.name} · ${ship.role}`, ship.id));
let selected = SHIPS.find(ship => ship.id === new URLSearchParams(location.search).get('ship')) || SHIPS[0];
let sprite;
function selectShip() {
  selector.value = selected.id;
  const original = originals[selected.id];
  const ctx = document.querySelector('#original').getContext('2d');
  ctx.clearRect(0, 0, 192, 192); ctx.drawImage(original.img, 0, 0);
  const paint = document.querySelector('#paint'); paint.replaceChildren();
  for (const p of paintsFor(selected)) paint.add(new Option(p.name, p.color));
  sprite = fleet[selected.id];
  for (const [mode, file] of [['top','top'], ['side','side'], ['chase','pursuit']]) {
    const name = SHIP_ART[selected.id]?.[mode]?.file || `${file}-v1.png`;
    document.querySelector(`#${mode}`).parentElement.querySelector('a').href = `../src/assets/ships/${selected.id}/${name}`;
  }
  document.querySelector('h1').textContent = `${selected.name} / Generated hull study`;
}
selectShip();
selector.addEventListener('change', () => {
  selected = SHIPS.find(ship => ship.id === selector.value); selectShip();
  if (N) { N.startRun(selected.id); N.G.player.god = true; status(); }
});
document.querySelector('#paint').addEventListener('change', e => {
  sprite = withShipImages(selected.id, e.target.value, originals[selected.id]);
});
function drawFleet(canvas, generated) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 1000, 400); ctx.fillStyle = '#09111f'; ctx.fillRect(0, 0, 1000, 400);
  for (let i = 0; i < SHIPS.length; i++) {
    const ship = SHIPS[i], x = (i % 5) * 200 + 100, y = Math.floor(i / 5) * 200 + 85;
    const mode = generated ? document.querySelector('#fleet-view').value : 'top';
    const art = generated ? shipSpriteForView(fleet[ship.id], mode) : originals[ship.id];
    ctx.save();
    ctx.translate(x, y);
    if (mode === 'side') ctx.rotate(Math.PI / 2);
    ctx.drawImage(art.img, -art.size, -art.size, art.size * 2, art.size * 2);
    ctx.restore();
    ctx.fillStyle = ship.color; ctx.font = '15px system-ui'; ctx.textAlign = 'center'; ctx.fillText(ship.name, x, y + 82);
  }
}
drawFleet(document.querySelector('#fleet-original'), false);
function draw() {
  const bank = +document.querySelector('#bank').value;
  const guides = document.querySelector('#guides').checked;
  let loaded = 0;
  for (const mode of ['top', 'side', 'chase']) {
    const s = shipSpriteForView(sprite, mode);
    if (s.generated) loaded++;
    const canvas = document.querySelector('#' + mode);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 512, 360);
    ctx.translate(256, 180); ctx.scale(5, 5);
    if (mode === 'side') ctx.rotate(Math.PI / 2);
    ctx.save();
    if (mode === 'chase') ctx.rotate(bank * 0.42);
    ctx.scale(1 - Math.abs(bank) * 0.28, 1);
    ctx.drawImage(s.img, -s.half, -s.half, s.size, s.size);
    ctx.restore();
    if (guides) for (const mount of s.muzzles || []) {
      const [x, y] = posedShipPoint(mount, bank, 0, null, mode === 'chase');
      ctx.strokeStyle = '#ffcb5d'; ctx.lineWidth = 0.25;
      ctx.beginPath();ctx.moveTo(x - 1.3, y);ctx.lineTo(x + 1.3, y);ctx.moveTo(x, y + 1.3);ctx.lineTo(x, y - 7);ctx.stroke();
    }
    // A second sample at native game scale exposes detail that disappears in combat.
    ctx.setTransform(1, 0, 0, 1, 0, 0);ctx.translate(42, 305);
    if (mode === 'side') ctx.rotate(Math.PI / 2);
    ctx.drawImage(s.img, -s.half, -s.half, s.size, s.size);
    ctx.setTransform(1, 0, 0, 1, 0, 0);ctx.fillStyle = '#7796a5';ctx.font = '12px system-ui';ctx.fillText('1× gameplay scale', 80, 311);
  }
  document.querySelector('#asset-status').textContent = `${loaded}/3 generated views loaded`;
  drawFleet(document.querySelector('#fleet-generated'), true);
  requestAnimationFrame(draw);
}
draw();

const frame = document.querySelector('iframe');
const html = await (await fetch('../index.html')).text();
const root = new URL('../', location.href).href;
const storage = new URL('background-preview-storage.js', location.href).href;
// Refresh changed modules consistently throughout the iframe's import graph.
// A local static server can otherwise keep an older transitive module in cache.
const revision = Date.now();
const modules = ['render/sprites.js', 'game/player.js', 'render/shipImages.js', 'render/shipImageSpecs.js', 'render/shipPaint.js', 'render/shipMounts.js', 'render/shipAssetGeometry.js', 'ui/menu-art.js', 'ui/hangar.js', ...SHIPS.map(ship => `render/shipImageSpecs/${ship.id}.js`)];
const imports = Object.fromEntries(modules.map(path => [
  new URL('src/' + path, root).href, new URL('src/' + path + '?fleet=' + revision, root).href,
]));
frame.srcdoc = html.replace('<head>', `<head><base href="${root}"><script type="importmap">${JSON.stringify({imports})}<` + `/script><script src="${storage}"><` + '/script>');
const ready = setInterval(() => {
  N = frame.contentWindow.NEON;
  if (!N) return;
  clearInterval(ready);
  N.profile.settings.music = 0; N.profile.settings.sfx = 0; N.profile.settings.story = false;
  N.profile.settings.retro = 'off';
  N.skipIntro(); N.comms.skipAll();
  N.startRun(selected.id); N.G.player.god = true;
  const runtime = frame.contentDocument.createElement('script');
  runtime.type = 'module'; runtime.src = new URL('ship-art-preview-runtime.js?fleet=' + revision, location.href).href;
  frame.contentDocument.body.append(runtime);
  document.querySelectorAll('button').forEach(button => button.disabled = false);
  status();
}, 100);
function status() {
  document.querySelector('#game-status').textContent = `${N.G.player.ship.name} · ${N.sv.mode} · weapon LV ${N.G.player.st.mainLv} · ${N.G.screen === 'pause' ? 'frozen' : 'live'}`;
}
for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => {
  if (N.G.screen !== 'play') { N.startRun(selected.id); N.G.player.god = true; }
  N.stage(button.dataset.view); status();
});
document.querySelector('#freeze').addEventListener('click', () => { N.G.screen = N.G.screen === 'pause' ? 'play' : 'pause'; status(); });
document.querySelector('#level').addEventListener('click', () => { N.G.player.st.mainLv = N.G.player.st.mainLv % 8 + 1; status(); });
document.querySelector('#pixel').addEventListener('click', () => { N.profile.settings.retro = N.profile.settings.retro === 'off' ? 'pixel' : 'off'; });
document.querySelector('#hangar').addEventListener('click', () => N.openHangar());
document.querySelector('#check').addEventListener('click', () => {
  frame.contentWindow.postMessage({kind:'check-ship-muzzles',ship:selected.id}, location.origin);
});
document.querySelector('#check-fleet').addEventListener('click', () => {
  frame.contentWindow.postMessage({kind:'check-ship-muzzles',fleet:true,ship:selected.id}, location.origin);
});
window.addEventListener('message', event => {
  if (event.source === frame.contentWindow && event.data?.kind === 'ship-muzzle-results') {
    document.querySelector('#checks').textContent = event.data.text;
    status();
  }
});
