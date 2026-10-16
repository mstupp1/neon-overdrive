// Flux Core screen (campaign map): permanent, uncapped stat levels bought with Flux (game/core.js).

import { G } from '../game/state.js';
import { profile, saveProfile } from '../core/storage.js';
import { sfx } from '../core/audio.js';
import { CORE, coreCost } from '../game/core.js';
import { ui, $ } from './screens.js';

export const FLUX_ICON = '<svg class="coin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 3l7 9-7 9-7-9z"/><path d="M12 8l3 4-3 4-3-4z"/></svg>';
const fmt = (n) => Math.floor(n).toLocaleString();

let onBack = null;
let detailId = null; // node shown in the detail panel (follows the focus)

// Grid of compact tiles (icon, name, level, price) + one fixed detail panel for the focused node, so the long text
// never sizes the tiles and the screen never needs to shrink.
function render() {
  $('#core-sub').innerHTML = `<span class="flux">${FLUX_ICON}${fmt(profile.flux)} FLUX</span> · PERMANENT, NO LEVEL CAP`;
  const wrap = $('#core-list');
  wrap.innerHTML = '';
  CORE.forEach((n) => {
    const lv = profile.core[n.id] || 0;
    const cost = coreCost(n, lv);
    const cant = profile.flux < cost;
    const b = document.createElement('button');
    b.className = 'core-tile' + (cant ? ' cant' : '');
    b.dataset.act = 'coreBuy';
    b.dataset.id = n.id;
    b.style.setProperty('--c', n.color);
    if (cant) b.setAttribute('aria-disabled', 'true');
    b.innerHTML = `<span class="ct-ico">${n.icon}</span><span class="ct-txt"><b class="clip">${n.name}</b><i><em>LV ${lv}</em><span class="flux">${FLUX_ICON}${fmt(cost)}</span></i></span>`;
    wrap.appendChild(b);
  });
  if (!CORE.some((n) => n.id === detailId)) detailId = CORE[0].id;
  renderDetail();
}

function renderDetail() {
  const n = CORE.find((c) => c.id === detailId);
  const el = $('#core-detail');
  if (!n) return;
  const lv = profile.core[n.id] || 0;
  const cost = coreCost(n, lv);
  const cant = profile.flux < cost;
  el.style.setProperty('--c', n.color);
  el.innerHTML = `<span class="cd-ico">${n.icon}</span><div><div class="cd-top"><b>${n.name}</b><em>LV ${lv}</em></div><p>${n.desc(lv)}</p><div class="cd-buy${cant ? ' dim' : ''}"><span class="flux">${FLUX_ICON}${fmt(cost)}</span>${cant ? `<i>NEED ${fmt(cost - profile.flux)}</i>` : '<b>SELECT TO UPGRADE</b>'}</div></div>`;
}

function onTileFocus(e) {
  const t = e.target.closest && e.target.closest('.core-tile');
  if (!t || t.dataset.id === detailId) return;
  detailId = t.dataset.id;
  renderDetail();
}

let bound = false;
export function openCore(back) {
  onBack = back;
  G.screen = 'core';
  if (!bound) {
    bound = true;
    $('#core-list').addEventListener('menufocus', onTileFocus);
    $('#core-list').addEventListener('pointerover', onTileFocus);
  }
  render();
  ui.show('core', { lock: 200, focus: document.querySelector(`#core-list [data-id="${detailId}"]`) });
}

export const coreActs = {
  coreBuy(btn) {
    const n = CORE.find((c) => c.id === btn.dataset.id);
    if (!n) return;
    const lv = profile.core[n.id] || 0;
    const cost = coreCost(n, lv);
    if (profile.flux < cost) return;
    profile.flux -= cost;
    profile.core[n.id] = lv + 1;
    saveProfile();
    sfx.levelUp();
    detailId = n.id;
    render();
    ui.show('core', { focus: document.querySelector(`#core-list [data-id="${n.id}"]`) });
  },
  leaveCore: () => onBack && onBack(),
};
