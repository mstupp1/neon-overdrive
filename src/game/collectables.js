// Relics: themed collectables. Bought in the Gallery (commons and rares, or a random Data Capsule)
// or found in the field as a rare drop; legendaries are field finds only. One set per campaign
// system plus Grid Junk, which turns up anywhere; completing a set pays a bounty.

import { G } from './state.js';
import { profile, saveProfile } from '../core/storage.js';
import { S, makeSprite } from '../render/sprites.js';
import { dropPickup } from './pickups.js';
import { floatText, ring, sparks } from './fx.js';
import { chance, TAU } from '../core/math.js';

const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const RARITY = {
  common: { name: 'COMMON', price: 150, weight: 6, color: '#cfe3ff' },
  rare: { name: 'RARE', price: 350, weight: 3, color: '#3ff6ff' },
  legendary: { name: 'LEGENDARY', price: 0, weight: 1.4, color: '#ffd24a' }, // field finds only
};

export const CAPSULE_PRICE = 180;
export const SET_BONUS = 250;

// `system`: the campaign system whose fields drop this set (null = Grid Junk, a small share of finds in every system).
export const THEMES = [
  { id: 'genesis', system: 'genesis', name: 'GRID ORIGINS', color: '#5b9cff', blurb: 'Salvage from the outer lattice, where it all began.' },
  { id: 'crimson', system: 'crimson', name: 'BIO BLOOM', color: '#ff3b6b', blurb: 'Specimens from the Crimson Tide. Handle with gloves.' },
  { id: 'cyclone', system: 'cyclone', name: 'DATA STORM', color: '#3fffd2', blurb: 'Debris swept up by the Cyan Cyclone\'s data winds.' },
  { id: 'void', system: 'void', name: 'EVENTIDE', color: '#b48bff', blurb: 'Things that came back from the Void. Mostly.' },
  { id: 'junk', system: null, name: 'GRID JUNK', color: '#ffd24a', blurb: 'Pilot clutter lost all over the Grid.' },
];

export const RELICS = [
  // GRID ORIGINS
  { id: 'die', theme: 'genesis', rarity: 'common', name: 'Pixel Die', text: 'One pip on every face. Rolls a 1. Every time.', icon: svg('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/>') },
  { id: 'floppy', theme: 'genesis', rarity: 'common', name: 'Floppy Disk', text: '1.44 MB of somebody\'s road-trip mixtape.', icon: svg('<path d="M4 4h13l3 3v13H4z"/><path d="M8 4v5h7V4"/><rect x="7" y="13" width="10" height="7"/>') },
  { id: 'shard', theme: 'genesis', rarity: 'common', name: 'Lattice Shard', text: 'A splinter of the outer Grid. Still humming in B flat.', icon: svg('<path d="M12 2l6 9-6 11-6-11z"/><path d="M6 11h12M12 2v20"/>') },
  { id: 'token', theme: 'genesis', rarity: 'rare', name: 'Arcade Token', text: 'Insert coin to continue. The machine is long gone.', icon: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="M12 8.6l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z"/>') },
  { id: 'bolt', theme: 'genesis', rarity: 'rare', name: 'Warden\'s Bolt', text: 'Torn off a siege mech. It was not happy about it.', icon: svg('<path d="M12 3l7 4v6l-7 4-7-4V7z"/><circle cx="12" cy="10" r="2.5"/><path d="M12 17v4"/>') },
  { id: 'firstlight', theme: 'genesis', rarity: 'legendary', name: 'First Light', text: 'The first photon the Grid ever rendered. Warm to the touch.', icon: svg('<circle cx="12" cy="12" r="3.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5L19 19M19 5l-2.5 2.5M7.5 16.5L5 19"/>') },
  // BIO BLOOM
  { id: 'spores', theme: 'crimson', rarity: 'common', name: 'Spore Jar', text: 'Do not open. Do not shake. Do not name it.', icon: svg('<path d="M8 3h8M9.5 3v3L6 9.5V21h12V9.5L14.5 6V3"/><circle cx="10" cy="15" r="1.5"/><circle cx="14.5" cy="17" r="1"/><circle cx="13.5" cy="12.5" r="1"/>') },
  { id: 'fang', theme: 'crimson', rarity: 'common', name: 'Crimson Fang', text: 'Lost by something with a lot of other fangs.', icon: svg('<path d="M6 3c4 1.2 8 1.2 12 0-1 6.5-3 12.5-6 18C9 15.5 7 9.5 6 3z"/><path d="M9 6.5c2 .5 4 .5 6 0"/>') },
  { id: 'petri', theme: 'crimson', rarity: 'common', name: 'Petri Dish', text: 'Something in here waved at you.', icon: svg('<ellipse cx="12" cy="12" rx="9" ry="4"/><path d="M3 12v2.5c0 2.2 4 4 9 4s9-1.8 9-4V12"/><circle cx="10" cy="11.5" r="1"/><circle cx="14" cy="12.5" r="1.4"/>') },
  { id: 'scale', theme: 'crimson', rarity: 'rare', name: 'Hydra Scale', text: 'Grows back if you snap it. Please stop snapping it.', icon: svg('<path d="M12 3c5 3 7 7 7 11a7 7 0 0 1-14 0c0-4 2-8 7-11z"/><path d="M12 8.5c2 2 3 3.8 3 5.5a3 3 0 0 1-6 0c0-1.7 1-3.5 3-5.5z"/>') },
  { id: 'heartjar', theme: 'crimson', rarity: 'rare', name: 'Heart in a Jar', text: 'Still beating. Slightly off-tempo.', icon: svg('<rect x="5" y="5" width="14" height="16" rx="3"/><path d="M8 3h8"/><path d="M12 17.5l-3.2-3.2a2 2 0 0 1 3.2-2.5 2 2 0 0 1 3.2 2.5z"/>') },
  { id: 'egg', theme: 'crimson', rarity: 'legendary', name: 'Hydra Egg', text: 'It is warm. It is ticking. It is fine.', icon: svg('<path d="M12 2c4 0 7 6 7 11a7 7 0 0 1-14 0c0-5 3-11 7-11z"/><path d="M7.5 11.5l2 2 2.5-3 2.5 3 2-2"/>') },
  // DATA STORM
  { id: 'stormcell', theme: 'cyclone', rarity: 'common', name: 'Storm Cell', text: 'Lightning in a bottle. Literally. Shake to recharge.', icon: svg('<path d="M9 2h6M10 2v3L6 9v11h12V9l-4-4V2"/><path d="M13 10l-3 4h4l-3 4"/>') },
  { id: 'packet', theme: 'cyclone', rarity: 'common', name: 'Lost Packet', text: 'Never arrived. Never will. Marked urgent.', icon: svg('<rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M3 7l9 6 9-6"/>') },
  { id: 'glitch', theme: 'cyclone', rarity: 'common', name: 'Glitch Cube', text: 'Has seven sides on Tuesdays.', icon: svg('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/><path d="M17 3h4M2 19h3"/>') },
  { id: 'omegaeye', theme: 'cyclone', rarity: 'rare', name: 'Omega Lens', text: 'It blinks when you are not looking.', icon: svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>') },
  { id: 'compass', theme: 'cyclone', rarity: 'rare', name: 'Storm Compass', text: 'Points to the eye of the storm. Or to lunch.', icon: svg('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>') },
  { id: 'eye', theme: 'cyclone', rarity: 'legendary', name: 'Eye of the Storm', text: 'Perfectly calm. Suspiciously calm.', icon: svg('<path d="M12 12a1.5 1.5 0 0 1 3 0 3 3 0 0 1-6 0 4.5 4.5 0 0 1 9 0 6 6 0 0 1-12 0 7.5 7.5 0 0 1 15 0"/>') },
  // EVENTIDE
  { id: 'candle', theme: 'void', rarity: 'common', name: 'Black Candle', text: 'Burns darkness instead of wax. Cosy.', icon: svg('<rect x="8" y="10" width="8" height="11" rx="1"/><path d="M12 10V7.5"/><path d="M12 2c1.6 1.6 1.6 3.2 0 4.8-1.6-1.6-1.6-3.2 0-4.8z"/>') },
  { id: 'mask', theme: 'void', rarity: 'common', name: 'Hollow Mask', text: 'Nobody was wearing it. It was still smiling.', icon: svg('<path d="M4 5c5-2 11-2 16 0 0 8-3 14-8 15C7 19 4 13 4 5z"/><path d="M7.5 10l2.5 1M16.5 10l-2.5 1M10 15.5c1.3.8 2.7.8 4 0"/>') },
  { id: 'pearl', theme: 'void', rarity: 'common', name: 'Void Pearl', text: 'Reflects everything except you.', icon: svg('<circle cx="12" cy="12" r="7"/><circle cx="9.8" cy="9.8" r="1.8"/><path d="M3 21l2.5-2.5M21 3l-2.5 2.5"/>') },
  { id: 'signal', theme: 'void', rarity: 'rare', name: 'Signal Fragment', text: 'A piece of the voice. It whispers your callsign.', icon: svg('<path d="M5 19a10 10 0 0 1 0-14M8 16a6 6 0 0 1 0-8M19 5a10 10 0 0 1 0 14M16 8a6 6 0 0 1 0 8"/><circle cx="12" cy="12" r="1.5"/>') },
  { id: 'eclipse', theme: 'void', rarity: 'rare', name: 'Eclipse Shard', text: 'A sliver of the shadow that ate a sun.', icon: svg('<circle cx="12" cy="12" r="8"/><circle cx="14.5" cy="10" r="5.5" fill="currentColor" fill-opacity=".3"/>') },
  { id: 'crown', theme: 'void', rarity: 'legendary', name: 'Dark Matter Crown', text: 'Heavy is the head. Extremely heavy. Mostly dark matter.', icon: svg('<path d="M3 18l2-11 4.5 5L12 5l2.5 7L19 7l2 11z"/><path d="M3 21h18"/>') },
  // GRID JUNK
  { id: 'duck', theme: 'junk', rarity: 'common', name: 'Rubber Duck', text: 'Debugs your ship by quietly listening.', icon: svg('<path d="M15.5 9.5a4 4 0 1 0-6.8 1.7C5.5 11 3.5 12.5 4 15c.6 3.3 3.8 5 8 5s8-1.8 8-5.5c0-2.6-2-4.3-4.5-5z"/><circle cx="12.5" cy="7" r=".8" fill="currentColor"/><path d="M15.6 8.2l3.2.3"/>') },
  { id: 'sock', theme: 'junk', rarity: 'common', name: 'Lucky Sock', text: 'Unwashed since your first boss kill. Do not ask.', icon: svg('<path d="M9 3h6v9l3.2 3.2a3 3 0 0 1-4.2 4.2L9 14.4z"/><path d="M9 6.5h6"/>') },
  { id: 'noodles', theme: 'junk', rarity: 'common', name: 'Cup Noodles', text: 'Space ration. Three minutes. Infinite patience.', icon: svg('<path d="M5 10h14l-2 11H7z"/><path d="M4 10h16"/><path d="M9 10c0-3 1-5 1-7M12 10c0-3 1-5 1-7M15 10l3-8"/>') },
  { id: 'trophy', theme: 'junk', rarity: 'rare', name: 'Hi-Score Trophy', text: 'Engraved: AAA. It was always AAA.', icon: svg('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4c0 3 1.5 4.5 3.5 5M17 6h3c0 3-1.5 4.5-3.5 5M12 14v4M8 21h8"/>') },
  { id: 'holocat', theme: 'junk', rarity: 'rare', name: 'Holo Cat', text: 'Knocks your HUD off the table for fun.', icon: svg('<path d="M5 20V9l3-5 3 4h2l3-4 3 5v11z"/><path d="M9 13h.01M15 13h.01" stroke-width="2.6"/><path d="M11 16.2l1 .8 1-.8"/>') },
  { id: 'joystick', theme: 'junk', rarity: 'legendary', name: 'Golden Joystick', text: 'Legend says it once played a perfect run by itself.', icon: svg('<rect x="4" y="15" width="16" height="5" rx="1.5"/><path d="M12 15V8.5"/><circle cx="12" cy="6" r="3"/><path d="M16.5 17.5h.01" stroke-width="2.6"/>') },
];

export const CAPSULE_ICON = svg('<rect x="3" y="8" width="18" height="9" rx="4.5"/><path d="M12 8v9"/><path d="M18 2.5v3M16.5 4h3M5 20.5v2M4 21.5h2"/>');

export const themeById = (id) => THEMES.find((t) => t.id === id);
export const relicById = (id) => RELICS.find((r) => r.id === id);
export const relicsOf = (theme) => RELICS.filter((r) => r.theme === theme);
export const ownsRelic = (id) => profile.relics.includes(id);
export const setDone = (theme) => relicsOf(theme).every((r) => ownsRelic(r.id));
export const priceOf = (r) => RARITY[r.rarity].price;

// Listeners (achievements, toasts) — `fn(relic, source)` with source 'field' | 'shop' | 'capsule'.
const listeners = [];
export const onRelic = (fn) => listeners.push(fn);
const setListeners = [];
export const onSetComplete = (fn) => setListeners.push(fn);

function grant(relic, source) {
  if (ownsRelic(relic.id)) return false;
  profile.relics.push(relic.id);
  if (!profile.relicNew.includes(relic.id)) profile.relicNew.push(relic.id);
  const theme = themeById(relic.theme);
  const done = setDone(theme.id);
  if (done) profile.credits += SET_BONUS;
  saveProfile();
  for (const fn of listeners) fn(relic, source);
  if (done) for (const fn of setListeners) fn(theme);
  return true;
}

// Gallery purchase. Returns '' or a reason.
export function buyRelic(id) {
  const r = relicById(id);
  if (!r) return 'UNKNOWN';
  if (ownsRelic(id)) return 'OWNED';
  if (r.rarity === 'legendary') return 'FIELD ONLY';
  const price = priceOf(r);
  if (profile.credits < price) return 'NEED ' + (price - profile.credits);
  profile.credits -= price;
  grant(r, 'shop');
  return '';
}

function weighted(pool, rng) {
  let total = 0;
  for (const r of pool) total += RARITY[r.rarity].weight;
  let x = rng() * total;
  for (const r of pool) if ((x -= RARITY[r.rarity].weight) <= 0) return r;
  return pool[pool.length - 1];
}

// Data Capsule: a random unowned common / rare from any set. Returns { relic } or { err }.
export function openCapsule(rng = Math.random) {
  const pool = RELICS.filter((r) => r.rarity !== 'legendary' && !ownsRelic(r.id));
  if (!pool.length) return { err: 'SOLD OUT' };
  if (profile.credits < CAPSULE_PRICE) return { err: 'NEED ' + (CAPSULE_PRICE - profile.credits) };
  profile.credits -= CAPSULE_PRICE;
  profile.stats.capsules = (profile.stats.capsules || 0) + 1;
  const relic = weighted(pool, rng);
  grant(relic, 'capsule');
  return { relic };
}

export function seenRelics() {
  if (!profile.relicNew.length) return;
  profile.relicNew = [];
  saveProfile();
}

// --- Field finds --------------------------------------------------------------------

// The set that drops where the player is flying.
function fieldTheme() {
  const r = G.run;
  const sys = r && r.mode === 'campaign' && r.system ? r.system.id : null;
  const junk = THEMES[THEMES.length - 1];
  if (Math.random() < 0.2) return junk;
  return THEMES.find((t) => t.system === sys) || junk;
}

function relicSprite() {
  return (S.relic ||= makeSprite(30, (g) => {
    g.shadowColor = '#ffffff';
    g.shadowBlur = 8;
    g.strokeStyle = '#ffe9a8';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -10);
    g.lineTo(8, 0);
    g.lineTo(0, 10);
    g.lineTo(-8, 0);
    g.closePath();
    g.stroke();
    g.fillStyle = 'rgba(255,233,168,0.25)';
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(0, 0, 2.6, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(255,210,74,0.7)';
    g.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      g.beginPath();
      g.moveTo(Math.cos(a) * 9, Math.sin(a) * 9);
      g.lineTo(Math.cos(a) * 13, Math.sin(a) * 13);
      g.stroke();
    }
  }));
}

// Called on every kill (enemies.js) and boss kill (bosses.js): a rare relic cache.
export function rollRelicDrop(e, force = false) {
  if (G.mode !== 'run' || !G.run) return;
  const p = e.boss ? 0.35 : e.hunter ? 0.2 : e.elite ? 0.04 : 0.0008;
  if (!force && !chance(p)) return;
  relicSprite();
  const pk = dropPickup(e.x, e.y, 'relic');
  pk.theme = fieldTheme().id;
}

// Pickup collected (player.js). Prefers relics you do not own yet; a finished set pays credits instead.
export function collectRelic(pk) {
  const p = G.player;
  const theme = themeById(pk.theme) || fieldTheme();
  const pool = relicsOf(theme.id).filter((r) => !ownsRelic(r.id));
  ring(p.x, p.y, 60, theme.color, 0.6);
  sparks(p.x, p.y, theme.color, 14, 260);
  if (!pool.length) {
    const bonus = 60;
    if (G.run) G.run.wallet = (G.run.wallet || 0) + bonus;
    if (G.run) G.run.earned = (G.run.earned || 0) + bonus;
    floatText(p.x, p.y - 34, `${theme.name} CACHE +${bonus}`, '#ffd24a', 11, 1.4);
    return;
  }
  const relic = weighted(pool, Math.random);
  floatText(p.x, p.y - 34, relic.name.toUpperCase(), RARITY[relic.rarity].color, 13, 1.6);
  grant(relic, 'field');
}
