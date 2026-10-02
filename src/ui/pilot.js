// Pilot screen (campaign map only): ECHO's rank, class selector and passive toggles.
// Rendering + handlers; the rules (found classes / abilities, rank-gated slots and rarity cap) live in game/pilot.js.

import { G } from '../game/state.js';
import { profile } from '../core/storage.js';
import { sfx } from '../core/audio.js';
import { S } from '../render/sprites.js';
import { rankFor } from '../game/economy.js';
import { CLASSES, classById, activeClass, classUnlocked, passiveUnlocked, passiveFound, equippedPassives, setClass, togglePassive, abilitySlots, rarityCap, rankForRarity, nextSlotRank } from '../game/pilot.js';
import { RARITY } from '../game/rarity.js';
import { ui, $ } from './screens.js';

let viewCls = 'striker'; // class whose details are open (may be a locked one, preview only)

const lockSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
const fmt = (n) => Math.floor(n).toLocaleString();

function portrait() {
  const cv = document.createElement('canvas');
  cv.width = 160;
  cv.height = 160;
  cv.getContext('2d').drawImage(S.portrait_echo.img, 0, 0, 160, 160);
  return cv;
}

function render() {
  const rk = rankFor(profile.rankXp);
  const act = activeClass();
  const view = classById(viewCls);
  const owned = classUnlocked(view);

  // Callsign / rank
  const card = $('#pl-card');
  card.style.setProperty('--c', act.color);
  const pct = rk.need ? Math.round((100 * rk.into) / rk.need) : 100;
  card.innerHTML = `<div class="pl-art"></div><div class="pl-info"><div class="role">PILOT CALLSIGN</div><h4>ECHO</h4><div class="pl-rank"><span>RANK <b>${rk.rank}</b></span><span class="rankbar big"><i style="width:${pct}%"></i></span></div><div class="pl-xp">${rk.need ? `${fmt(rk.into)} / ${fmt(rk.need)} XP TO RANK ${rk.rank + 1}` : 'MAX RANK'}</div></div>`;
  card.querySelector('.pl-art').appendChild(portrait());

  // Class tabs
  $('#pl-tabs').innerHTML = CLASSES.map((c) => {
    const open = classUnlocked(c);
    const cur = act.id === c.id;
    return `<button class="cls-tab${cur ? ' cur' : ''}${viewCls === c.id ? ' view' : ''}${open ? '' : ' locked'}" data-act="pclass" data-id="${c.id}" style="--c:${c.color}" aria-pressed="${cur}"><span class="cls-ico">${open ? c.icon : lockSvg}</span><b>${c.name}</b><i>${open ? (cur ? 'ACTIVE' : c.role.toUpperCase()) : 'NOT FOUND'}</i></button>`;
  }).join('');

  // Class info
  const info = $('#pl-info');
  info.style.setProperty('--c', view.color);
  info.classList.toggle('locked', !owned);
  info.innerHTML = `<div class="ci-top"><span class="role">${view.role.toUpperCase()}${owned ? '' : ' · NOT FOUND · DROPS FROM BOSSES'}</span></div><p>${view.desc}</p><div class="ci-ult"><em>ULTIMATE</em><b>${view.ult.name}</b><span>${view.ult.desc}</span></div>`;

  // Abilities: found ones equip into rank-gated slots; rarity above the rank cap stays locked.
  const eq = equippedPassives(view.id).map((x) => x.id);
  const slots = abilitySlots();
  const cap = rarityCap();
  const next = nextSlotRank();
  const nextTxt = next ? ` · RANK ${next} +1` : '';
  $('#pl-pass-label').innerHTML = `ABILITIES ${eq.length}/${slots} · UP TO <b style="color:${RARITY[cap].color}">${RARITY[cap].name}</b>${nextTxt}`;
  const wrap = $('#pl-passives');
  wrap.style.setProperty('--c', view.color);
  wrap.innerHTML = [...view.passives].sort((a, b) => a.r - b.r).map((ps) => {
    const found = passiveFound(ps);
    const open = passiveUnlocked(view, ps);
    const on = eq.includes(ps.id);
    const rc = RARITY[ps.r].color;
    const tag = on ? '<span class="card-tag">ON</span>' : '';
    const lock = !owned ? 'CLASS' : !found ? 'NOT FOUND' : `RANK ${rankForRarity(ps.r)}`;
    const right = open ? `<b class="eq${on ? ' tick' : ''}">${on ? '✓' : 'EQUIP'}</b>` : `<span class="lk">${lockSvg}</span><i>${lock}</i>`;
    return `<button class="card offer pass rar r${ps.r}${on ? ' on' : ''}${open ? '' : ' locked'}${found ? '' : ' unfound'}" data-act="ppass" data-id="${ps.id}" style="--c:${view.color};--rc:${rc}" aria-pressed="${on}"><div class="card-icon">${ps.icon}</div><div><div class="card-top"><span class="card-name">${ps.name}</span><span class="pass-rar">${RARITY[ps.r].name}</span>${tag}</div><div class="card-desc">${ps.desc}</div></div><div class="price${open ? (on ? ' own' : '') : ' dim'}">${right}</div></button>`;
  }).join('');
}

function focusEl(sel) {
  return document.querySelector('#scr-pilot ' + sel);
}

export function showPilot(focus) {
  G.screen = 'pilot';
  render();
  let el = typeof focus === 'string' ? focusEl(focus) : focus;
  if (!el) el = focusEl('.cls-tab.view') || $('#pl-back');
  ui.show('pilot', { focus: el });
}

export function openPilot() {
  viewCls = activeClass().id;
  showPilot('.cls-tab.view');
}

// data-act handlers merged into main's ui.init.
export const pilotActs = {
  pclass(btn) {
    viewCls = btn.dataset.id;
    const c = classById(viewCls);
    if (classUnlocked(c)) {
      setClass(viewCls);
      sfx.levelUp();
    } else sfx.ui();
    showPilot(`.cls-tab[data-id="${viewCls}"]`);
  },
  ppass(btn) {
    const id = btn.dataset.id;
    const err = togglePassive(viewCls, id);
    if (err) sfx.ui();
    showPilot(`.card[data-id="${id}"]`);
  },
};
