// Hangar screens (campaign map only): ship carousel, 3 gear slots, paint row, live stats, and the
// per-slot part list. Rendering + handlers; the buy/equip rules live in game/hangar.js.

import { G } from '../game/state.js';
import { profile } from '../core/storage.js';
import { sfx } from '../core/audio.js';
import { S } from '../render/sprites.js';
import { SHIPS, ownsShip, paintsFor, activePaint } from '../game/ships.js';
import { SLOTS, SLOT_INFO, partById, partsForSlot, equippedParts, ownsPart } from '../game/parts.js';
import { recomputeStats } from '../game/upgrades.js';
import { selectShip, buyShip, buyPart, equipPart, unequipSlot, setPaint, ownsPaint } from '../game/hangar.js';
import { ui, $ } from './screens.js';

const coin = '<svg class="coin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l3.5 4.5-3.5 4.5-3.5-4.5z"/></svg>';
const fmt = (n) => Math.floor(n).toLocaleString();

let viewIdx = 0; // ship being previewed in the carousel
let slot = 'core'; // slot open in the part list
const viewShip = () => SHIPS[viewIdx];

// Derived stats for a ship wearing `parts` (stock kit upgrades included).
function statsFor(ship, parts) {
  const p = { ship, up: { ...ship.start }, st: {}, parts, hullMod: 0 };
  for (const part of parts) for (const [id, lv] of Object.entries(part.start || {})) p.up[id] = Math.max(p.up[id] || 0, lv);
  recomputeStats(p);
  return p.st;
}

const STAT_ROWS = [
  ['HULL', (st) => st.maxHp, (v) => v],
  ['DASH', (st) => st.maxCharges, (v) => v],
  ['SPEED', (st) => st.speed, (v) => Math.round(v * 100) + '%'],
  ['DAMAGE', (st) => st.dmg, (v) => Math.round(v * 100) + '%'],
  ['FIRE', (st) => st.rate, (v) => Math.round(v * 100) + '%'],
  ['CRIT', (st) => st.crit, (v) => Math.round(v * 100) + '%'],
  ['PICKUP', (st) => st.magnet / 80, (v) => Math.round(v * 100) + '%'],
  ['DASH TIME', (st) => st.dashDur, (v) => Math.round(v * 100) + '%'],
  ['XP', (st) => st.xpMul, (v) => Math.round(v * 100) + '%'],
  ['CREDITS', (st) => st.creditMul, (v) => Math.round(v * 100) + '%'],
  ['GRAZE', (st) => st.grazeR, (v) => Math.round(v * 100) + '%'],
  ['RECHARGE', (st) => 1.5 / st.dashRecharge, (v) => Math.round(v * 100) + '%'],
];

function renderStats(ship, owned) {
  const base = statsFor(ship, []);
  const cur = owned ? statsFor(ship, equippedParts(profile, ship.id)) : base;
  let html = '';
  STAT_ROWS.forEach(([label, get, f], i) => {
    const a = get(base);
    const b = get(cur);
    const moved = Math.abs(b - a) > 1e-6;
    if (i >= 6 && !moved) return; // extras (pickup, xp, credits...) only when a part changes them
    html += `<div class="${moved ? (b > a ? 'up' : 'dn') : ''}">${label}<b>${f(b)}</b></div>`;
  });
  $('#hs-stats').innerHTML = html;
}

function shipArt(ship, owned) {
  const cv = document.createElement('canvas');
  cv.width = 112;
  cv.height = 112;
  cv.getContext('2d').drawImage(S['ship_' + ship.id].img, 0, 0, 112, 112);
  if (!owned) cv.className = 'dim';
  return cv;
}

// Rebuilds the main hangar screen. `focusKey` picks what keeps focus: a selector inside #scr-hangar.
function render() {
  const ship = viewShip();
  const owned = ownsShip(profile, ship);
  const sel = profile.lastShip === ship.id;
  const paint = activePaint(profile, ship);
  $('#hangar-credits').innerHTML = `<span class="gold">${coin}${fmt(profile.credits)}</span>`;

  const card = $('#hs-card');
  card.style.setProperty('--c', paint.color);
  card.classList.toggle('locked', !owned);
  const legacy = ship.unlock ? `<p class="hs-or">OR ${ship.unlock.text.toUpperCase()}</p>` : '';
  card.innerHTML = `<div class="hs-art"></div><div class="hs-info"><div class="role">${ship.role}${sel ? ' · <em>ACTIVE</em>' : ''}</div><h4>${ship.name}</h4><p>${ship.desc}</p>${owned ? '' : legacy}</div>`;
  card.querySelector('.hs-art').appendChild(shipArt(ship, owned));
  $('#hs-dots').innerHTML = SHIPS.map((s, i) => `<i class="${i === viewIdx ? 'on' : ''}${ownsShip(profile, s) ? ' own' : ''}"></i>`).join('');

  const act = $('#hs-act');
  act.className = 'btn primary hs-act';
  act.disabled = false;
  if (!owned) {
    const afford = profile.credits >= ship.price;
    act.innerHTML = `BUY ${coin}${fmt(ship.price)}`;
    act.disabled = !afford;
    act.dataset.mode = 'buy';
    if (!afford) act.innerHTML += `<small>NEED ${fmt(ship.price - profile.credits)}</small>`;
  } else if (sel) {
    act.textContent = 'SELECTED';
    act.disabled = true;
    act.dataset.mode = 'none';
  } else {
    act.textContent = 'SELECT';
    act.dataset.mode = 'select';
  }

  // Slots
  const eq = (profile.equip[ship.id]) || {};
  $('#hs-slots').innerHTML = SLOTS.map((sl) => {
    const part = owned && partById(eq[sl]) && ownsPart(profile, eq[sl]) ? partById(eq[sl]) : null;
    const info = SLOT_INFO[sl];
    return `<button class="slot${part ? ' filled' : ''}" data-act="hslot" data-slot="${sl}" ${owned ? '' : 'disabled'} style="--c:${info.color}"><span class="slot-ico">${part ? part.icon : '<i>+</i>'}</span><span class="slot-txt"><em>${info.name}</em><b>${part ? part.name : 'EMPTY'}</b></span><span class="slot-go">›</span></button>`;
  }).join('');

  // Paints
  $('#hs-paints').innerHTML = paintsFor(ship).map((pt, i) => {
    const has = ownsPaint(ship.id, i);
    const on = owned && has && (profile.paint[ship.id] || 0) === i;
    const afford = profile.credits >= pt.price;
    const dis = !owned || (!has && !afford);
    return `<button class="swatch${on ? ' on' : ''}${has ? '' : ' buy'}" data-act="hpaint" data-i="${i}" ${dis ? 'disabled' : ''} style="--c:${pt.color}" aria-label="${pt.name}"><span class="sw-dot"></span><b>${pt.name}</b><i>${on ? 'EQUIPPED' : has ? 'OWNED' : coin + pt.price}</i></button>`;
  }).join('');

  renderStats(ship, owned);
}

function focusEl(sel) {
  return document.querySelector('#scr-hangar ' + sel);
}

export function showHangar(focus) {
  G.screen = 'hangar';
  render();
  let el = typeof focus === 'string' ? focusEl(focus) : focus;
  if (!el || el.disabled) el = $('#hs-act:not([disabled])') || focusEl('#hs-slots .slot:not([disabled])') || $('#hs-back');
  ui.show('hangar', { focus: el });
}

export function openHangar() {
  viewIdx = Math.max(0, SHIPS.findIndex((s) => s.id === profile.lastShip));
  showHangar('#hs-act');
}

function showParts(focus) {
  const ship = viewShip();
  const info = SLOT_INFO[slot];
  G.screen = 'parts';
  $('#parts-title').textContent = info.name;
  $('#parts-title').style.textShadow = `0 0 0.35em ${info.color}, 0 0 1.2em ${info.color}`;
  $('#parts-sub').textContent = `${ship.name} · ${slotBlurb[slot]}`;
  $('#parts-credits').innerHTML = `<span class="gold">${coin}${fmt(profile.credits)}</span>`;
  const equipped = (profile.equip[ship.id] || {})[slot];
  const wrap = $('#parts-list');
  wrap.innerHTML = '';
  for (const part of partsForSlot(slot)) {
    const owned = ownsPart(profile, part.id);
    const on = equipped === part.id && owned;
    const afford = profile.credits >= part.price;
    const b = document.createElement('button');
    b.className = 'card offer' + (on ? ' on' : '');
    b.dataset.act = 'hpart';
    b.dataset.id = part.id;
    b.style.setProperty('--c', info.color);
    b.disabled = !owned && !afford;
    const right = on ? '<span><b class="eq">UNEQUIP</b></span>' : owned ? '<span><b class="eq">EQUIP</b></span>' : `<span>${coin}<b>${fmt(part.price)}</b></span>${afford ? '' : `<i>NEED ${fmt(part.price - profile.credits)}</i>`}`;
    b.innerHTML = `<div class="card-icon">${part.icon}</div><div><div class="card-top"><span class="card-name">${part.name}</span>${on ? '<span class="card-tag">ON</span>' : ''}</div><div class="card-desc">${part.desc}</div></div><div class="price${b.disabled ? ' dim' : owned ? ' own' : ''}">${right}</div>`;
    wrap.appendChild(b);
  }
  let el = focus;
  if (typeof focus === 'string') el = wrap.querySelector(`[data-id="${focus}"]`);
  if (!el || el.disabled) el = wrap.querySelector('.card:not(:disabled)') || $('#parts-back');
  ui.show('parts', { focus: el });
}

const slotBlurb = { core: 'weapon systems', plating: 'hull and defence', thrusters: 'engines and dash' };

const bought = () => {
  sfx.coin();
  sfx.levelUp();
};

// data-act handlers merged into main's ui.init.
export const hangarActs = {
  hprev() {
    viewIdx = (viewIdx + SHIPS.length - 1) % SHIPS.length;
    showHangar('[data-act=hprev]');
  },
  hnext() {
    viewIdx = (viewIdx + 1) % SHIPS.length;
    showHangar('[data-act=hnext]');
  },
  hact(btn) {
    const ship = viewShip();
    if (btn.dataset.mode === 'buy') {
      if (buyShip(ship.id)) return sfx.ui();
      bought();
    }
    selectShip(ship.id);
    showHangar('#hs-slots .slot');
  },
  hslot(btn) {
    slot = btn.dataset.slot;
    showParts(equippedId());
  },
  hpart(btn) {
    const ship = viewShip();
    const id = btn.dataset.id;
    const part = partById(id);
    if (ownsPart(profile, id) && (profile.equip[ship.id] || {})[part.slot] === id) unequipSlot(ship.id, part.slot);
    else {
      if (!ownsPart(profile, id)) {
        if (buyPart(id)) return sfx.ui();
        bought();
      }
      equipPart(ship.id, id);
    }
    showParts(id);
  },
  hpaint(btn) {
    const ship = viewShip();
    const i = +btn.dataset.i;
    const had = ownsPaint(ship.id, i);
    if (setPaint(ship.id, i)) return sfx.ui();
    if (!had) bought();
    showHangar(`[data-act=hpaint][data-i="${i}"]`);
  },
  partsBack() {
    showHangar(`#hs-slots [data-slot="${slot}"]`);
  },
};

const equippedId = () => (profile.equip[viewShip().id] || {})[slot];
