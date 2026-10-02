// Hangar screens (campaign map only): ship carousel, 3 gear slots, paint row, live stats; the per-slot inventory
// (8-tile grid + a fixed detail panel); and the Fabricator (roll new gear). Rendering + handlers; the rules live in
// game/hangar.js (rolls, equip, sell), game/parts.js (items) and game/rarity.js (odds).

import { G } from '../game/state.js';
import { profile, saveProfile } from '../core/storage.js';
import { sfx } from '../core/audio.js';
import { S } from '../render/sprites.js';
import { SHIPS, ownsShip, paintsFor, activePaint } from '../game/ships.js';
import { SLOTS, SLOT_INFO, SLOT_CAP, TAGS, gearDef, gearByUid, gearInSlot, equippedParts, equippedOn, itemName, itemLines, itemTags, sellValue, itemScore } from '../game/parts.js';
import { RARITY, rarityOdds } from '../game/rarity.js';
import { recomputeStats } from '../game/upgrades.js';
import { selectShip, buyShip, equipPart, unequipSlot, setPaint, ownsPaint, rollGear, sellGear, sellJunk, junkIn, ROLL_COST, fabLuck, fabItemLevel } from '../game/hangar.js';
import { ui, $ } from './screens.js';

const coin = '<svg class="coin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l3.5 4.5-3.5 4.5-3.5-4.5z"/></svg>';
const fmt = (n) => Math.floor(n).toLocaleString();

let viewIdx = 0; // ship being previewed in the carousel
let slot = 'core'; // slot open in the inventory / Fabricator
let sel = null; // inventory: uid shown in the detail panel
let confirmSell = null; // uid waiting for a second SELL press (Epic / Legendary)
let lastRoll = null; // Fabricator: the last rolled item (shown in its result panel)
let fabFrom = 'hangar'; // where the Fabricator's BACK goes: 'hangar' | 'parts'
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
  ['CRIT DMG', (st) => st.critMul, (v) => v.toFixed(1) + 'x'],
  ['MODULES', (st) => st.modDmg, (v) => Math.round(v * 100) + '%'],
  ['SLOTS', (st) => st.maxModules, (v) => v],
  ['ULT', (st) => st.odGain, (v) => Math.round(v * 100) + '%'],
  ['ULT TIME', (st) => st.odDur, (v) => v.toFixed(1) + 's'],
  ['PICKUP', (st) => st.magnet / 80, (v) => Math.round(v * 100) + '%'],
  ['DASH TIME', (st) => st.dashDur, (v) => Math.round(v * 100) + '%'],
  ['XP', (st) => st.xpMul, (v) => Math.round(v * 100) + '%'],
  ['CREDITS', (st) => st.creditMul, (v) => Math.round(v * 100) + '%'],
  ['GRAZE', (st) => st.grazeR, (v) => Math.round(v * 100) + '%'],
  ['RECHARGE', (st) => 1.5 / st.dashRecharge, (v) => Math.round(v * 100) + '%'],
  ['BOSS DMG', (st) => 1 + st.bounty, (v) => Math.round(v * 100) + '%'],
  ['FIND', (st) => 1 + st.find, (v) => Math.round(v * 100) + '%'],
];
const STAT_SLOTS = 9; // fixed cells so equipping never changes the panel's height

function renderStats(ship, owned) {
  const base = statsFor(ship, []);
  const parts = owned ? equippedParts(profile, ship.id) : [];
  const cur = owned ? statsFor(ship, parts) : base;
  const cells = [];
  STAT_ROWS.forEach(([label, get, f], i) => {
    const a = get(base);
    const b = get(cur);
    const moved = Math.abs(b - a) > 1e-6;
    if (i >= 6 && !moved) return; // extras only when gear changes them
    cells.push(`<div class="${moved ? (b > a ? 'up' : 'dn') : ''}">${label}<b>${f(b)}</b></div>`);
  });
  while (cells.length % 3 || cells.length < STAT_SLOTS) cells.push('<div class="blank"></div>');
  $('#hs-stats').innerHTML = cells.slice(0, Math.max(STAT_SLOTS, Math.ceil(cells.length / 3) * 3)).join('');
  // Build paths of the equipped gear (they steer level-up drafts)
  const tags = {};
  for (const pt of parts) for (const [t, n] of Object.entries(itemTags(pt.item))) tags[t] = (tags[t] || 0) + n;
  if (ship.path) tags[ship.path] = (tags[ship.path] || 0) + 1;
  const list = Object.entries(tags).sort((a, b) => b[1] - a[1]);
  $('#hs-paths').innerHTML = list.length
    ? list.map(([t, n]) => `<span style="--t:${TAGS[t].color}">${TAGS[t].name}<b>${n}</b></span>`).join('')
    : '<em>Equip gear to set your build paths</em>';
}

function shipArt(ship, owned) {
  const cv = document.createElement('canvas');
  cv.width = 112;
  cv.height = 112;
  cv.getContext('2d').drawImage(S['ship_' + ship.id].img, 0, 0, 112, 112);
  if (!owned) cv.className = 'dim';
  return cv;
}

// Rebuilds the main hangar screen.
function render() {
  const ship = viewShip();
  const owned = ownsShip(profile, ship);
  const selShip = profile.lastShip === ship.id;
  const paint = activePaint(profile, ship);
  $('#hangar-credits').innerHTML = `<span class="gold">${coin}${fmt(profile.credits)}</span>`;

  const card = $('#hs-card');
  card.style.setProperty('--c', paint.color);
  card.classList.toggle('locked', !owned);
  const legacy = ship.unlock ? `<p class="hs-or">OR ${ship.unlock.text.toUpperCase()}</p>` : '';
  const path = ship.path ? `<span class="hs-path" style="--t:${TAGS[ship.path].color}">${TAGS[ship.path].name}</span>` : '';
  const trait = ship.trait ? `<p class="hs-trait">${ship.trait.text}</p>` : '';
  card.innerHTML = `<div class="hs-art"></div><div class="hs-info"><div class="role">${ship.role}${path}${selShip ? ' · <em>ACTIVE</em>' : ''}</div><h4>${ship.name}</h4><p>${ship.desc}</p>${trait}${owned ? '' : legacy}</div>`;
  card.querySelector('.hs-art').appendChild(shipArt(ship, owned));
  $('#hs-dots').innerHTML = SHIPS.map((s, i) => `<i class="${i === viewIdx ? 'on' : ''}${ownsShip(profile, s) ? ' own' : ''}"></i>`).join('');

  const act = $('#hs-act');
  act.className = 'btn primary hs-act';
  act.disabled = false;
  act.setAttribute('aria-disabled', 'false');
  if (!owned) {
    const afford = profile.credits >= ship.price;
    act.innerHTML = `<span>BUY ${coin}${fmt(ship.price)}</span>`;
    act.setAttribute('aria-disabled', afford ? 'false' : 'true'); // dim but focusable
    act.dataset.mode = 'buy';
    if (!afford) act.innerHTML += `<small>NEED ${fmt(ship.price - profile.credits)}</small>`;
  } else if (selShip) {
    act.textContent = 'SELECTED';
    act.disabled = true;
    act.dataset.mode = 'none';
  } else {
    act.textContent = 'SELECT';
    act.dataset.mode = 'select';
  }

  // Slots
  const eq = profile.equip[ship.id] || {};
  $('#hs-slots').innerHTML = SLOTS.map((sl) => {
    const item = owned ? gearByUid(profile, eq[sl]) : null;
    const info = SLOT_INFO[sl];
    const fresh = gearInSlot(profile, sl).some((g) => profile.gearNew.includes(g.uid));
    const c = item ? RARITY[item.r].color : info.color;
    const name = item ? `<b style="color:${item.r ? c : ''}">${itemName(item)}</b>` : '<b>EMPTY</b>';
    const sub = item ? `${info.name} · ${RARITY[item.r].name} · IL ${item.il}` : `${info.name} · ${gearInSlot(profile, sl).length}/${SLOT_CAP}`;
    return `<button class="slot${item ? ' filled' : ''}" data-act="hslot" data-slot="${sl}" ${owned ? '' : 'disabled'} style="--c:${c}"><span class="slot-ico">${item ? gearDef(item.base).icon : '<i>+</i>'}</span><span class="slot-txt"><em>${sub}</em>${name}</span><span class="slot-go">${fresh ? '<i class="newdot">NEW</i>' : ''}›</span></button>`;
  }).join('');

  // Paints
  $('#hs-paints').innerHTML = paintsFor(ship).map((pt, i) => {
    const has = ownsPaint(ship.id, i);
    const on = owned && has && (profile.paint[ship.id] || 0) === i;
    const afford = profile.credits >= pt.price;
    const dis = !owned;
    const cant = owned && !has && !afford;
    return `<button class="swatch${on ? ' on' : ''}${has ? '' : ' buy'}" data-act="hpaint" data-i="${i}" ${dis ? 'disabled' : ''}${cant ? ' aria-disabled="true"' : ''} style="--c:${pt.color}" aria-label="${pt.name}"><span class="sw-dot"></span><b>${pt.name}</b><i>${on ? 'EQUIPPED' : has ? 'OWNED' : coin + pt.price}</i></button>`;
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

// --- Item detail panel (inventory and Fabricator) -----------------------------------------------

function detailHtml(item, { compare = null, empty = '' } = {}) {
  if (!item) return `<p class="gd-empty">${empty}</p>`;
  const rc = RARITY[item.r].color;
  const def = gearDef(item.base);
  const on = equippedOn(profile, item.uid);
  const state = on.includes(viewShip().id) ? 'EQUIPPED' : on.length ? `ON ${on.length} SHIP${on.length > 1 ? 'S' : ''}` : '';
  const lines = itemLines(item).map((l) => `<li class="${l.kind}"${l.tag ? ` style="--t:${TAGS[l.tag].color}"` : ''}>${l.text}</li>`).join('');
  const tags = Object.entries(itemTags(item)).sort((a, b) => b[1] - a[1]).map(([t]) => `<span style="--t:${TAGS[t].color}">${TAGS[t].name}</span>`).join('');
  const cmp = compare && compare.uid !== item.uid ? `<span class="gd-cmp">REPLACES <b style="color:${RARITY[compare.r].color}">${itemName(compare)}</b></span>` : '';
  return `<div class="gd-head"><span class="gd-ico" style="--rc:${rc}">${def.icon}</span><div class="gd-title"><b style="color:${rc}">${def.name}</b><em>${RARITY[item.r].name} ${SLOT_INFO[item.slot].name} · ITEM LEVEL ${item.il}</em></div><span class="gd-state">${state}</span></div>
    <ul class="gd-lines">${lines}</ul>
    <div class="gd-foot"><span class="gd-tags">${tags}</span>${cmp}<span class="gd-sell">${coin}${sellValue(item)}</span></div>`;
}

function setDetail(el, item, opts) {
  el.innerHTML = detailHtml(item, opts);
  el.style.setProperty('--rc', item ? RARITY[item.r].color : 'rgba(255,255,255,0.2)');
  el.classList.toggle('legend', !!item && item.r === 4);
}

// --- Inventory (one slot) ------------------------------------------------------------------------

const sorted = (list) => [...list].sort((a, b) => itemScore(b) - itemScore(a));

function showParts(focus) {
  const ship = viewShip();
  const info = SLOT_INFO[slot];
  G.screen = 'parts';
  const items = sorted(gearInSlot(profile, slot));
  const equippedUid = (profile.equip[ship.id] || {})[slot];
  if (!items.some((g) => g.uid === sel)) sel = equippedUid && gearByUid(profile, equippedUid) ? equippedUid : items[0] ? items[0].uid : null;
  $('#parts-title').textContent = info.name;
  $('#parts-title').style.textShadow = `0 0 0.35em ${info.color}, 0 0 1.2em ${info.color}`;
  $('#parts-sub').textContent = `${ship.name} · ${items.length}/${SLOT_CAP} PIECES`;
  $('#parts-credits').innerHTML = `<span class="gold">${coin}${fmt(profile.credits)}</span>`;
  renderDetail();
  const wrap = $('#parts-list');
  wrap.innerHTML = '';
  for (let i = 0; i < SLOT_CAP; i++) {
    const item = items[i];
    const b = document.createElement('button');
    if (!item) {
      b.className = 'inv-tile empty';
      b.disabled = true;
      wrap.appendChild(b);
      continue;
    }
    const on = equippedUid === item.uid;
    const fresh = profile.gearNew.includes(item.uid);
    b.className = `inv-tile r${item.r}${on ? ' on' : ''}${fresh ? ' fresh' : ''}`;
    b.dataset.act = 'hpart';
    b.dataset.id = item.uid;
    b.style.setProperty('--rc', RARITY[item.r].color);
    b.setAttribute('aria-label', itemName(item));
    b.innerHTML = `${gearDef(item.base).icon}<i class="il">${item.il}</i>${on ? '<i class="eqm">E</i>' : fresh ? '<i class="nw">NEW</i>' : ''}`;
    wrap.appendChild(b);
  }
  // Seen now: clear the NEW marks for this slot (after drawing them once).
  profile.gearNew = profile.gearNew.filter((u) => !items.some((g) => g.uid === u));
  saveProfile();
  renderSellButtons();
  let el = focus;
  if (typeof focus === 'string') el = wrap.querySelector(`[data-id="${focus}"]`) || $(focus);
  if (!el || el.disabled) el = wrap.querySelector('.inv-tile:not(:disabled)') || $('#parts-fab');
  ui.show('parts', { focus: el });
}

function renderDetail() {
  const ship = viewShip();
  const item = sel ? gearByUid(profile, sel) : null;
  const cur = gearByUid(profile, (profile.equip[ship.id] || {})[slot]);
  setDetail($('#parts-detail'), item, { compare: cur, empty: `No ${SLOT_INFO[slot].name} gear yet. Roll some in the FABRICATOR, or find it on elites and bosses.` });
  $('#parts-detail').querySelector('.gd-hint')?.remove();
  const hint = document.createElement('div');
  hint.className = 'gd-hint';
  hint.textContent = item ? (cur && cur.uid === item.uid ? 'SELECT AGAIN TO UNEQUIP' : `SELECT TO EQUIP ON ${ship.name}`) : '';
  $('#parts-detail').appendChild(hint);
}

function renderSellButtons() {
  const item = sel ? gearByUid(profile, sel) : null;
  const sell = $('#parts-sell');
  sell.disabled = !item;
  sell.innerHTML = item ? (confirmSell === item.uid ? `CONFIRM ${coin}${sellValue(item)}` : `SELL ${coin}${sellValue(item)}`) : 'SELL';
  sell.classList.toggle('warn', !!item && confirmSell === item.uid);
  const junk = junkIn(slot);
  const jb = $('#parts-junk');
  jb.disabled = !junk.length;
  jb.innerHTML = `SELL JUNK${junk.length ? ` · ${junk.length}` : ''}`;
}

// Tile focus (keys / pad / hover) picks what the detail panel shows.
function onTileFocus(e) {
  const t = e.target.closest && e.target.closest('.inv-tile');
  if (!t || !t.dataset.id || t.dataset.id === sel) return;
  sel = t.dataset.id;
  confirmSell = null;
  renderDetail();
  renderSellButtons();
}

// --- Fabricator ----------------------------------------------------------------------------------

const SHORT = { common: 'COM', uncommon: 'UNC', rare: 'RARE', epic: 'EPIC', legendary: 'LEG' };
const shipFind = () => statsFor(SHIPS.find((s) => s.id === profile.lastShip) || SHIPS[0], equippedParts(profile, profile.lastShip)).find;

function showFab(focus) {
  G.screen = 'fab';
  const find = shipFind();
  const luck = fabLuck(find);
  $('#fab-credits').innerHTML = `<span class="gold">${coin}${fmt(profile.credits)}</span>`;
  const std = rarityOdds(luck, 0);
  const pre = rarityOdds(luck, 2);
  const pct = (x) => (x <= 0 ? '-' : x < 0.01 ? (x * 100).toFixed(1) + '%' : Math.round(x * 100) + '%');
  $('#fab-odds').innerHTML = `<div class="fo-row fo-head"><span></span>${RARITY.map((r) => `<b style="color:${r.color}">${SHORT[r.id]}</b>`).join('')}</div>
    <div class="fo-row"><span>ROLL</span>${std.map((x) => `<i>${pct(x)}</i>`).join('')}</div>
    <div class="fo-row"><span>PREMIUM</span>${pre.map((x) => `<i>${pct(x)}</i>`).join('')}</div>
    <div class="fo-note">ITEM LEVEL ${fabItemLevel()} · LUCK ${luck.toFixed(1)}${find ? ` · FIND +${Math.round(find * 100)}%` : ''}</div>`;
  $('#fab-slots').innerHTML = SLOTS.map((sl) => {
    const n = gearInSlot(profile, sl).length;
    return `<button class="fab-slot${sl === slot ? ' on' : ''}" data-act="fslot" data-slot="${sl}" style="--c:${SLOT_INFO[sl].color}" aria-pressed="${sl === slot}"><b>${SLOT_INFO[sl].name}</b><i>${n}/${SLOT_CAP}</i></button>`;
  }).join('');
  for (const b of document.querySelectorAll('#scr-fab [data-act=froll]')) {
    const cost = ROLL_COST[b.dataset.kind];
    b.setAttribute('aria-disabled', profile.credits >= cost ? 'false' : 'true');
    b.querySelector('.cost').innerHTML = `${coin}${cost}`;
  }
  const item = lastRoll && gearByUid(profile, lastRoll.uid) ? lastRoll : null;
  setDetail($('#fab-result'), item, { empty: 'Pick a slot and roll. A full slot salvages its weakest spare piece for credits.' });
  let el = typeof focus === 'string' ? document.querySelector('#scr-fab ' + focus) : focus;
  if (!el) el = document.querySelector('#scr-fab [data-act=froll]');
  ui.show('fab', { focus: el });
}

export function openFab(from = 'hangar') {
  fabFrom = from;
  lastRoll = null;
  showFab();
}

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
    sel = null;
    confirmSell = null;
    showParts();
  },
  // Inventory tile: equip on the viewed ship, or unequip when it is already on.
  hpart(btn) {
    const ship = viewShip();
    const uid = btn.dataset.id;
    sel = uid;
    confirmSell = null;
    if ((profile.equip[ship.id] || {})[slot] === uid) unequipSlot(ship.id, slot);
    else {
      equipPart(ship.id, uid);
      sfx.levelUp();
    }
    showParts(uid);
  },
  gsell() {
    const item = sel && gearByUid(profile, sel);
    if (!item) return;
    if (item.r >= 3 && confirmSell !== item.uid) {
      confirmSell = item.uid;
      renderSellButtons();
      return sfx.ui();
    }
    confirmSell = null;
    sellGear(item.uid);
    sfx.coin();
    sel = null;
    showParts('#parts-sell');
  },
  gjunk() {
    if (sellJunk(slot)) sfx.coin();
    sel = null;
    confirmSell = null;
    showParts('#parts-junk');
  },
  gfab() {
    openFab('parts');
  },
  hfab() {
    openFab('hangar');
  },
  fslot(btn) {
    slot = btn.dataset.slot;
    showFab(`[data-act=fslot][data-slot="${slot}"]`);
  },
  froll(btn) {
    const res = rollGear(slot, btn.dataset.kind, shipFind());
    if (res.err) return sfx.ui();
    lastRoll = res.item;
    bought();
    if (res.item.r >= 3) sfx.achieve(res.item.r === 4);
    showFab(`[data-act=froll][data-kind="${btn.dataset.kind}"]`);
    const el = $('#fab-result');
    el.classList.remove('reveal');
    void el.offsetWidth;
    el.classList.add('reveal');
  },
  finv() {
    sel = lastRoll ? lastRoll.uid : null;
    showParts(sel || undefined);
  },
  fabBack() {
    if (fabFrom === 'parts') showParts();
    else showHangar('#hs-fab');
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
    confirmSell = null;
    showHangar(`#hs-slots [data-slot="${slot}"]`);
  },
};

export function initHangarUi() {
  for (const id of ['#parts-list']) $(id).addEventListener('menufocus', onTileFocus);
  $('#parts-list').addEventListener('pointerover', onTileFocus);
}
