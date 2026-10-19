// Decorative location art and the Fabricator's presentation. The purchase/save happens
// in hangar.js before this animation starts; the reel never rolls or changes real loot.
import { BASES, gearDef, SLOT_INFO, sellValue } from '../game/parts.js';
import { RARITY } from '../game/rarity.js';

let spin = null;
let settleTimer = null;
let revision = 0;
const warmed = new Set();

export function initServiceArt() {
  for (const scene of document.querySelectorAll('.service-scene')) {
    for (const pixel of [false, true]) {
      const img = new Image();
      img.className = pixel ? 'service-art-pixel' : 'service-art-original';
      img.alt = '';
      img.draggable = false;
      img.decoding = 'async';
      img.onload = () => scene.classList.add(pixel ? 'pixel-ready' : 'art-ready');
      img.onerror = () => { img.hidden = true; };
      img.src = new URL(`../assets/locations/${scene.dataset.location}/scene${pixel ? '-pixel' : ''}-v1.png`, import.meta.url).href;
      scene.prepend(img);
    }
  }
}

function stopSpin() {
  revision++;
  spin?.cancel();
  spin = null;
  clearTimeout(settleTimer);
  settleTimer = null;
}

function partCell(def, color) {
  return `<span class="fab-reel-item" style="--part-color:${color}">${def.icon}</span>`;
}

function warmSlot(slot) {
  if (warmed.has(slot)) return;
  warmed.add(slot);
  for (const def of BASES.filter(d => d.slot === slot)) {
    const img = new Image();
    img.src = new URL(`../assets/icons/items/${def.id}.png`, import.meta.url).href;
    img.decode().catch(() => {});
  }
}

export function showFabricatorArt(slot, item = null, salvaged = false) {
  stopSpin();
  warmSlot(slot);
  const root = document.querySelector('#fab-workbench');
  const color = item ? RARITY[item.r].color : SLOT_INFO[slot].color;
  root.dataset.state = salvaged ? 'salvaged' : item ? 'result' : 'idle';
  root.style.setProperty('--part-color', color);
  const def = item ? gearDef(item.base) : BASES.find(d => d.slot === slot);
  document.querySelector('#fab-reel').innerHTML = partCell(def, color);
  document.querySelector('#fab-readout').textContent = salvaged ? `AUTO-SALVAGED · +${sellValue(item)} CREDITS` : `${SLOT_INFO[slot].name} · SELECT A ROLL`;
  document.querySelector('#fab-result').setAttribute('aria-hidden', item && !salvaged ? 'false' : 'true');
}

export function playFabricatorRoll(item, done) {
  stopSpin();
  const ticket = revision;
  const root = document.querySelector('#fab-workbench');
  const reel = document.querySelector('#fab-reel');
  const pool = BASES.filter(d => d.slot === item.slot);
  const final = gearDef(item.base);
  const color = SLOT_INFO[item.slot].color;
  const count = 22;
  // Cosmetic order uses no gameplay RNG, and previews only the selected ship-part slot.
  const offset = Math.max(0, pool.findIndex(d => d.id === item.base));
  reel.innerHTML = Array.from({ length: count }, (_, i) => partCell(pool[(offset + i * 5) % pool.length], color)).join('') + partCell(final, RARITY[item.r].color);
  root.dataset.state = 'rolling';
  root.style.setProperty('--part-color', color);
  document.querySelector('#fab-readout').textContent = `FABRICATING ${SLOT_INFO[item.slot].name}…`;
  document.querySelector('#fab-result').setAttribute('aria-hidden', 'true');

  const finish = () => {
    if (revision !== ticket) return;
    root.dataset.state = 'landed';
    root.style.setProperty('--part-color', RARITY[item.r].color);
    reel.innerHTML = partCell(final, RARITY[item.r].color);
    spin?.cancel();
    spin = null;
    document.querySelector('#fab-readout').textContent = `${RARITY[item.r].name.toUpperCase()} ${SLOT_INFO[item.slot].name} · COMPLETE`;
    settleTimer = setTimeout(() => {
      if (revision === ticket) done();
    }, reduced ? 0 : 400);
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !reel.animate) return finish();
  spin = reel.animate([
    { transform: 'translateY(0)' },
    { transform: `translateY(-${count * 100}%)` },
  ], { duration: 2500, easing: 'cubic-bezier(.12,.68,.12,1)', fill: 'forwards' });
  spin.finished.then(finish, () => {}); // Cancelling a stale presentation is expected.
}
