// Hangar screens (campaign map only): SHIP (ship select: browse hulls, base stats, buy / pick paint), LOADOUT (the
// active ship's 3 gear slots and its stats with that gear on), the per-slot inventory (8-tile grid + a fixed detail
// panel) and the Fabricator (roll new gear). Rendering + handlers; the rules live in game/hangar.js (rolls, equip,
// sell), game/parts.js (items) and game/rarity.js (odds).

import { tip } from './tips.js';
import { G } from '../game/state.js';
import { profile, saveProfile } from '../core/storage.js';
import { sfx } from '../core/audio.js';
import { S, previewShipSprite } from '../render/sprites.js';
import { menuArtwork } from './menu-art.js';
import { initServiceArt, showFabricatorArt, playFabricatorRoll } from './service-art.js';
import { SHIPS, WEAPONS, weaponStreams, ownsShip, paintsFor, activePaint, shipById } from '../game/ships.js';
import { SLOTS, SLOT_INFO, SLOT_CAP, TAGS, gearDef, gearByUid, gearInSlot, equippedParts, equippedOn, itemName, itemLines, itemTags, sellValue, itemScore } from '../game/parts.js';
import { RARITY, rarityOdds } from '../game/rarity.js';
import { recomputeStats } from '../game/upgrades.js';
import { selectShip, buyShip, equipPart, unequipSlot, setPaint, ownsPaint, rollGear, sellGear, sellJunk, junkIn, ROLL_COST, fabLuck, fabItemLevel } from '../game/hangar.js';
import { ui, $ } from './screens.js';
import { hubExit } from './hub.js';

const coin = '<svg class="coin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l3.5 4.5-3.5 4.5-3.5-4.5z"/></svg>';
const fmt = (n) => Math.floor(n).toLocaleString();

let viewIdx = 0; // SHIP: hull being previewed
let preview = null; // SHIP: paint index previewed on the hull (focused / hovered swatch), null = the equipped one
let slot = 'core'; // slot open in the inventory / Fabricator
let sel = null; // inventory: uid shown in the detail panel
let confirmSell = null; // uid waiting for a second SELL press (Epic / Legendary)
let lastRoll = null; // Fabricator: the last rolled item (shown in its result panel)
let fabRolling = false; // Presentation lock; a paid roll is already saved before the reel starts.
let fabFrom = 'hub'; // where the Fabricator's BACK goes: 'hub' (out of the hangar) | 'parts' (its inventory)
const viewShip = () => SHIPS[viewIdx];
export const hangarHooks = { demo: null }; // main.js: shows a ship in the background title demo
const gearShip = () => shipById(profile.lastShip); // LOADOUT, inventory and Fabricator fit the active ship

// Derived stats for a ship wearing `parts` (stock kit upgrades included).
function statsFor(ship, parts) {
  const p = { ship, up: { ...ship.start }, st: {}, parts, hullMod: 0 };
  for (const part of parts) for (const [id, lv] of Object.entries(part.start || {})) p.up[id] = Math.max(p.up[id] || 0, lv);
  recomputeStats(p);
  return p.st;
}

// Gun output at weapon level 1 against Vector's twin pulse (= 100): damage x volley size x rate, piercing counted once.
function gunRating(ship) {
  const dps = (s) => {
    const w = WEAPONS[s.weapon];
    return (w.dmg * (w.burst || 1) * weaponStreams(s.weapon, 1).length * (1 + 0.4 * Math.min(1, w.pierce || 0))) / w.interval;
  };
  return dps(ship) / dps(SHIPS[0]);
}

const pct = (v) => Math.round(v * 100) + '%';
// Stat bars, the same six on SHIP (base) and LOADOUT (with gear): [label, value, text, bar full at, what it means].
const BARS = [
  ['HULL', (st) => st.maxHp, (v) => v, 6, 'Hits you can take.'],
  ['DASH', (st) => st.maxCharges, (v) => v, 4, 'Dash charges.'],
  ['SPEED', (st) => st.speed, pct, 1.35, 'Movement speed.'],
  ['POWER', (st, ship) => gunRating(ship) * st.dmg * st.rate, (v) => Math.round(v * 100), 2.2, 'Main gun output (VECTOR = 100): damage and fire rate.'],
  ['CRIT', (st) => st.crit, pct, 0.5, 'Critical hit chance.'],
  ['ULT', (st) => st.odGain, pct, 2, 'Ult charge rate.'],
];
// LOADOUT also lists the other stats its gear moves.
const EXTRAS = [
  ['DAMAGE', (st) => st.dmg, pct],
  ['FIRE', (st) => st.rate, pct],
  ['CRIT DMG', (st) => st.critMul, (v) => v.toFixed(1) + 'x'],
  ['MODULES', (st) => st.modDmg, pct],
  ['SLOTS', (st) => st.maxModules, (v) => v],
  ['ULT TIME', (st) => st.odDur, (v) => v.toFixed(1) + 's'],
  ['PICKUP', (st) => st.magnet / 80, pct],
  ['DASH TIME', (st) => st.dashDur, pct],
  ['XP', (st) => st.xpMul, pct],
  ['CREDITS', (st) => st.creditMul, pct],
  ['GRAZE', (st) => st.grazeR, pct],
  ['RECHARGE', (st) => 1.5 / st.dashRecharge, pct],
  ['BOSS DMG', (st) => 1 + st.bounty, pct],
  ['FIND', (st) => 1 + st.find, pct],
];

// Six segmented bars. `parts` = null: base stats; else the gain (green) or loss (red) over base is marked.
function statBars(ship, parts) {
  const base = statsFor(ship, []);
  const cur = parts ? statsFor(ship, parts) : base;
  return BARS.map(([label, get, f, full, what]) => {
    const a = get(base, ship);
    const b = get(cur, ship);
    const w = (v) => Math.max(0, Math.min(100, (v / full) * 100));
    const moved = Math.abs(b - a) > 1e-6 ? (b > a ? 'up' : 'dn') : '';
    const delta = moved ? `<i class="sb-d" style="left:${w(Math.min(a, b))}%;width:${w(Math.max(a, b)) - w(Math.min(a, b))}%"></i>` : '';
    const tipBody = moved ? [what, `Base ${f(a)}, with gear ${f(b)}.`] : what;
    return `<div class="sb ${moved}"${tip(label, tipBody)}><span class="sb-l">${label}</span><span class="sb-bar"><i class="sb-f" style="width:${w(Math.min(a, b))}%"></i>${delta}</span><b>${f(b)}</b></div>`;
  }).join('');
}

// Build paths of the equipped gear and the hull (they steer level-up drafts).
function pathsHtml(ship, parts) {
  const tags = {};
  for (const pt of parts) for (const [t, n] of Object.entries(itemTags(pt.item))) tags[t] = (tags[t] || 0) + n;
  if (ship.path) tags[ship.path] = (tags[ship.path] || 0) + 1;
  return Object.entries(tags).sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `<span style="--t:${TAGS[t].color}"${tip(TAGS[t].name, [`Weight ${n} from this ship and its gear.`, 'Drafts lean toward your heaviest paths, and tunes roll from them.'], TAGS[t].color)}>${TAGS[t].name}<b>${n}</b></span>`).join('');
}

// Generated hulls bake into a roomier box than the procedural 64-unit sprite; frame the card on
// that central 64 units so hangar art keeps its size.
function hullImage(sprite) {
  if (!sprite.generated || sprite.size <= 64) return sprite.img;
  const px = sprite.img.width * 64 / sprite.size, edge = (sprite.img.width - px) / 2;
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(px);
  c.getContext('2d').drawImage(sprite.img, edge, edge, px, px, 0, 0, c.width, c.height);
  return c;
}

function shipArt(ship, owned, color = null, full = 112, pixel = 64) {
  const sprite = color ? previewShipSprite(ship, color) : S['ship_' + ship.id];
  const art = menuArtwork(hullImage(sprite), full, pixel, sprite.img, sprite.ready?.then(() => hullImage(sprite)));
  if (!owned) art.classList.add('dim');
  return art;
}

// --- SHIP (ship select) ----------------------------------------------------------------------------------------

// The paint on show: the previewed swatch, else the equipped paint (stock on hulls not owned yet).
function shownPaint(ship, owned) {
  const list = paintsFor(ship);
  if (preview !== null && list[preview]) return { i: preview, paint: list[preview] };
  const eq = (profile.paint && profile.paint[ship.id]) || 0;
  const i = owned && list[eq] && ownsPaint(ship.id, eq) ? eq : 0;
  return { i, paint: list[i] };
}

// Hull art + the paint caption: follows the swatch under focus without rebuilding the screen.
function renderPaintView() {
  const ship = viewShip();
  const owned = ownsShip(profile, ship);
  const { i, paint } = shownPaint(ship, owned);
  const card = $('#hs-card');
  card.style.setProperty('--c', paint.color);
  const art = card.querySelector('.hs-art');
  art.querySelector('.menu-art')?.remove();
  art.appendChild(shipArt(ship, owned, i ? paint.color : null, 160, 64));
  const on = owned && (profile.paint[ship.id] || 0) === i && ownsPaint(ship.id, i);
  const has = ownsPaint(ship.id, i);
  let state;
  if (!owned) state = '<em>BUY THE SHIP FIRST</em>';
  else if (on) state = '<em class="ok">EQUIPPED</em>';
  else if (has) state = '<em>OWNED</em>';
  else state = `<em class="gold${profile.credits >= paint.price ? '' : ' short'}">${coin}${paint.price}</em>`;
  $('#hs-pcap').innerHTML = `<b style="color:${paint.color}">${paint.name}</b>${state}`;
}

function render() {
  const ship = viewShip();
  const owned = ownsShip(profile, ship);
  const selShip = profile.lastShip === ship.id;
  hangarHooks.demo?.(ship);

  // The card is the ship selector: left / right (or the arrows) browse, confirm buys / selects.
  const card = $('#hs-card');
  card.classList.toggle('locked', !owned);
  const legacy = ship.unlock ? `<span class="hs-or">OR ${ship.unlock.text.toUpperCase()}</span>` : '';
  const path = ship.path ? `<span class="hs-path" style="--t:${TAGS[ship.path].color}">${TAGS[ship.path].name}</span>` : '';
  const trait = `<p class="hs-trait well">${ship.trait ? ship.trait.text : ''}</p>`; // own fixed well, always reserved
  let actLine;
  if (!owned) {
    const afford = profile.credits >= ship.price;
    card.dataset.mode = 'buy';
    actLine = `<span class="hs-buy">BUY ${coin}${fmt(ship.price)}</span>${afford ? '' : `<small>NEED ${fmt(ship.price - profile.credits)}</small>`}`;
  } else if (selShip) {
    card.dataset.mode = 'none';
    actLine = '<span class="hs-on">ACTIVE · LOADOUT ›</span>';
  } else {
    card.dataset.mode = 'select';
    actLine = '<span class="hs-buy">SELECT</span>';
  }
  card.innerHTML = `<div class="hs-art"><i class="hs-pad"></i></div><div class="hs-info"><div class="role clip">${ship.role}${path}</div><h4 class="clip">${ship.name}</h4><p class="hs-desc well">${ship.desc}${owned ? '' : legacy}</p>${trait}</div><div class="hs-actline"><span class="hs-n">${viewIdx + 1}/${SHIPS.length}</span>${actLine}</div>`;
  card.setAttribute('aria-label', `${ship.name}: ${owned ? (selShip ? 'active ship, open loadout' : 'select') : 'buy'}. Left and right browse ships.`);

  // Fleet strip: every hull at a glance (owned lit, the active one marked); tapping one jumps to it.
  $('#hs-roster').innerHTML = '';
  SHIPS.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = `hr-ship${i === viewIdx ? ' on' : ''}${ownsShip(profile, s) ? ' own' : ''}${profile.lastShip === s.id ? ' act' : ''}`;
    b.dataset.act = 'hpick';
    b.dataset.i = i;
    b.tabIndex = -1;
    b.setAttribute('aria-label', s.name);
    b.style.setProperty('--c', ownsShip(profile, s) ? activePaint(profile, s).color : s.color);
    b.appendChild(shipArt(s, true, null, 48, 32));
    $('#hs-roster').appendChild(b);
  });

  $('#hs-stats').innerHTML = statBars(ship, null);

  // Paint: one row of chips; the focused chip previews on the hull, confirm equips (buying it first if needed).
  $('#hs-paints').innerHTML = paintsFor(ship).map((pt, i) => {
    const has = ownsPaint(ship.id, i);
    const on = owned && has && (profile.paint[ship.id] || 0) === i;
    const cant = owned && !has && profile.credits < pt.price;
    return `<button class="swatch${on ? ' on' : ''}${has ? '' : ' buy'}" data-act="hpaint" data-i="${i}" ${owned ? '' : 'aria-disabled="true"'}${cant ? ' aria-disabled="true"' : ''} style="--c:${pt.color}" aria-label="${pt.name} paint"><span class="sw-dot"></span>${has ? '' : `<i>${coin}</i>`}</button>`;
  }).join('');
  renderPaintView();
}

function focusEl(sel) {
  return document.querySelector('#scr-hangar ' + sel);
}

export function showHangar(focus) {
  G.screen = 'hangar';
  preview = null;
  render();
  let el = typeof focus === 'string' ? focusEl(focus) : focus;
  if (!el || el.disabled) el = $('#hs-card');
  ui.show('hangar', { focus: el });
}

export function openHangar() {
  viewIdx = Math.max(0, SHIPS.findIndex((s) => s.id === profile.lastShip));
  showHangar('#hs-card');
}

// Focus moving onto a paint chip previews it; anywhere else shows the equipped paint again.
function onPaintFocus(e) {
  const sw = e.target.closest && e.target.closest('.swatch');
  const i = sw ? +sw.dataset.i : null;
  if (i === preview) return;
  preview = i;
  renderPaintView();
}

// --- LOADOUT (the active ship's gear) ---------------------------------------------------------------------------

function renderLoadout() {
  const ship = gearShip();
  const paint = activePaint(profile, ship);
  const parts = equippedParts(profile, ship.id);
  hangarHooks.demo?.(ship);
  const card = $('#lo-card');
  card.style.setProperty('--c', paint.color);
  const paths = pathsHtml(ship, parts);
  card.innerHTML = `<div class="hs-art"><i class="hs-pad"></i></div><div class="hs-info"><div class="role clip">ACTIVE SHIP</div><h4 class="clip">${ship.name}</h4><div class="hs-paths well">${paths || '<em>Equip gear to set your build paths</em>'}</div></div><div class="hs-actline"><span class="hs-n">BUILD PATHS</span><span class="hs-buy">‹ CHANGE SHIP</span></div>`;
  card.querySelector('.hs-art').appendChild(shipArt(ship, true, null, 160, 64));
  card.setAttribute('aria-label', `${ship.name}: change ship`);

  $('#lo-stats').innerHTML = statBars(ship, parts);

  const eq = profile.equip[ship.id] || {};
  $('#lo-slots').innerHTML = SLOTS.map((sl) => {
    const item = gearByUid(profile, eq[sl]);
    const info = SLOT_INFO[sl];
    const fresh = gearInSlot(profile, sl).some((g) => profile.gearNew.includes(g.uid));
    const c = item ? RARITY[item.r].color : info.color;
    const name = item ? `<b class="clip" style="color:${item.r ? c : ''}">${itemName(item)}</b>` : '<b>EMPTY</b>';
    const sub = item ? `${info.name} · ${RARITY[item.r].name} · IL ${item.il}` : `${info.name} · ${gearInSlot(profile, sl).length}/${SLOT_CAP}`;
    return `<button class="slot${item ? ' filled' : ''}" data-act="hslot" data-slot="${sl}" style="--c:${c}"><span class="slot-ico">${item ? gearDef(item.base).icon : '<i>+</i>'}</span><span class="slot-txt"><em class="clip">${sub}</em>${name}</span><span class="slot-go">${fresh ? '<i class="newdot">NEW</i>' : ''}›</span></button>`;
  }).join('');

  // Everything else the gear moves, in a fixed well under the slots.
  const base = statsFor(ship, []);
  const cur = statsFor(ship, parts);
  const cells = EXTRAS.filter(([, get]) => Math.abs(get(cur) - get(base)) > 1e-6)
    .map(([label, get, f]) => `<div class="${get(cur) > get(base) ? 'up' : 'dn'}">${label}<b>${f(get(cur))}</b></div>`);
  $('#lo-extra').innerHTML = cells.length ? cells.join('') : '<em>Other bonuses from your gear show here.</em>';
  $('#lo-extra').classList.toggle('none', !cells.length);
}

export function showLoadout(focus) {
  G.screen = 'loadout';
  renderLoadout();
  let el = typeof focus === 'string' ? document.querySelector('#scr-loadout ' + focus) : focus;
  if (!el || el.disabled) el = document.querySelector('#lo-slots .slot');
  ui.show('loadout', { focus: el });
}

export const openLoadout = () => showLoadout();

// --- Item detail panel (inventory and Fabricator) -----------------------------------------------

function detailHtml(item, { compare = null, empty = '' } = {}) {
  if (!item) return `<p class="gd-empty">${empty}</p>`;
  const rc = RARITY[item.r].color;
  const def = gearDef(item.base);
  const on = equippedOn(profile, item.uid);
  const state = on.includes(gearShip().id) ? 'EQUIPPED' : on.length ? `ON ${on.length} SHIP${on.length > 1 ? 'S' : ''}` : '';
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
  const ship = gearShip();
  const info = SLOT_INFO[slot];
  G.screen = 'parts';
  const items = sorted(gearInSlot(profile, slot));
  const equippedUid = (profile.equip[ship.id] || {})[slot];
  if (!items.some((g) => g.uid === sel)) sel = equippedUid && gearByUid(profile, equippedUid) ? equippedUid : items[0] ? items[0].uid : null;
  $('#parts-title').textContent = `${info.name} GEAR`;
  $('#parts-title').style.color = info.color;
  $('#parts-sub').textContent = `${ship.name} · ${items.length}/${SLOT_CAP} PIECES`;
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
  const ship = gearShip();
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
  const std = rarityOdds(luck, 0);
  const pre = rarityOdds(luck, 2);
  const pct = (x) => (x <= 0 ? '-' : x < 0.01 ? (x * 100).toFixed(1) + '%' : Math.round(x * 100) + '%');
  $('#fab-odds').innerHTML = `<div class="fo-row fo-head"><span></span>${RARITY.map((r) => `<b style="color:${r.color}">${SHORT[r.id]}</b>`).join('')}</div>
    <div class="fo-row"><span>ROLL</span>${std.map((x) => `<i>${pct(x)}</i>`).join('')}</div>
    <div class="fo-row"><span>PREMIUM</span>${pre.map((x) => `<i>${pct(x)}</i>`).join('')}</div>
    <div class="fo-note">ITEM LEVEL ${fabItemLevel()} · LUCK ${luck.toFixed(1)}${find ? ` · FIND +${Math.round(find * 100)}%` : ''}</div>`;
  $('#fab-slots').innerHTML = SLOTS.map((sl) => {
    const n = gearInSlot(profile, sl).length;
    return `<button class="fab-slot${sl === slot ? ' on' : ''}" data-act="fslot" data-slot="${sl}" style="--c:${SLOT_INFO[sl].color}" aria-pressed="${sl === slot}" aria-disabled="${fabRolling}"><b>${SLOT_INFO[sl].name}</b><i>${n}/${SLOT_CAP}</i></button>`;
  }).join('');
  for (const b of document.querySelectorAll('#scr-fab [data-act=froll]')) {
    const cost = ROLL_COST[b.dataset.kind];
    b.setAttribute('aria-disabled', !fabRolling && profile.credits >= cost ? 'false' : 'true');
    b.querySelector('.cost').innerHTML = `${coin}${cost}`;
  }
  const item = !fabRolling && lastRoll && gearByUid(profile, lastRoll.uid) ? lastRoll : null;
  setDetail($('#fab-result'), item, { empty: 'Pick a slot and roll. A full slot salvages its weakest spare piece for credits.' });
  $('#fab-workbench').setAttribute('aria-busy', String(fabRolling));
  if (!fabRolling) showFabricatorArt(slot, lastRoll, !!lastRoll && !item);
  let el = typeof focus === 'string' ? document.querySelector('#scr-fab ' + focus) : focus;
  if (!el) el = document.querySelector('#scr-fab [data-act=froll]');
  ui.show('fab', { focus: el });
}

export function openFab(from = 'hub') {
  fabFrom = from;
  fabRolling = false;
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
    hangarActs.hship(null, -1);
  },
  hnext() {
    hangarActs.hship(null, 1);
  },
  // Ship carousel: left / right on the card, or its arrows.
  hship(btn, d) {
    viewIdx = (viewIdx + d + SHIPS.length) % SHIPS.length;
    showHangar('#hs-card');
  },
  // Fleet strip: jump straight to a hull.
  hpick(btn) {
    viewIdx = +btn.dataset.i;
    showHangar('#hs-card');
  },
  // Confirm on the card: buy, then select; on the active ship it opens its LOADOUT.
  hact(btn) {
    const ship = viewShip();
    if (btn.dataset.mode === 'none') return showLoadout();
    if (btn.dataset.mode === 'buy') {
      if (buyShip(ship.id)) return sfx.ui();
      bought();
    }
    selectShip(ship.id);
    showHangar('#hs-card');
  },
  hslot(btn) {
    slot = btn.dataset.slot;
    sel = null;
    confirmSell = null;
    showParts();
  },
  // Inventory tile: equip on the viewed ship, or unequip when it is already on.
  hpart(btn) {
    const ship = gearShip();
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
  fslot(btn) {
    if (fabRolling) return;
    slot = btn.dataset.slot;
    showFab(`[data-act=fslot][data-slot="${slot}"]`);
  },
  froll(btn) {
    if (fabRolling) return;
    const res = rollGear(slot, btn.dataset.kind, shipFind());
    if (res.err) return sfx.ui();
    lastRoll = res.item;
    fabRolling = true;
    sfx.coin();
    const focus = `[data-act=froll][data-kind="${btn.dataset.kind}"]`;
    showFab(focus);
    playFabricatorRoll(res.item, () => {
      fabRolling = false;
      if (G.screen !== 'fab' || ui.current !== 'fab') return;
      sfx.levelUp();
      if (res.item.r >= 3) sfx.achieve(res.item.r === 4);
      showFab(focus);
      const el = $('#fab-result');
      el.classList.remove('reveal');
      void el.offsetWidth;
      el.classList.add('reveal');
    });
  },
  finv() {
    sel = lastRoll ? lastRoll.uid : null;
    showParts(sel || undefined);
  },
  fabBack() {
    if (fabFrom === 'parts') showParts();
    else hubExit();
  },
  hpaint(btn) {
    const ship = viewShip();
    const i = +btn.dataset.i;
    if (!ownsShip(profile, ship)) return sfx.ui();
    const had = ownsPaint(ship.id, i);
    if (setPaint(ship.id, i)) return sfx.ui();
    if (!had) bought();
    showHangar(`[data-act=hpaint][data-i="${i}"]`);
  },
  partsBack() {
    confirmSell = null;
    showLoadout(`#lo-slots [data-slot="${slot}"]`);
  },
  // LOADOUT's ship card: back to SHIP to pick another hull.
  loShip() {
    openHangar();
  },
};

export function initHangarUi() {
  initServiceArt();
  for (const id of ['#parts-list']) $(id).addEventListener('menufocus', onTileFocus);
  $('#parts-list').addEventListener('pointerover', onTileFocus);
  $('#scr-hangar').addEventListener('menufocus', onPaintFocus);
}
