// Flux Core screen (campaign map): permanent, uncapped stat levels bought with Flux (game/core.js).

import { G } from '../game/state.js';
import { profile, saveProfile } from '../core/storage.js';
import { sfx } from '../core/audio.js';
import { CORE, coreCost } from '../game/core.js';
import { ui, $ } from './screens.js';

export const FLUX_ICON = '<svg class="coin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 3l7 9-7 9-7-9z"/><path d="M12 8l3 4-3 4-3-4z"/></svg>';
const fmt = (n) => Math.floor(n).toLocaleString();

let onBack = null;

function render() {
  $('#core-sub').innerHTML = `<span class="flux">${FLUX_ICON}${fmt(profile.flux)} FLUX</span> · PERMANENT, NO LEVEL CAP`;
  const wrap = $('#core-list');
  wrap.innerHTML = '';
  CORE.forEach((n) => {
    const lv = profile.core[n.id] || 0;
    const cost = coreCost(n, lv);
    const cant = profile.flux < cost;
    const b = document.createElement('button');
    b.className = 'card offer';
    b.dataset.act = 'coreBuy';
    b.dataset.id = n.id;
    b.style.setProperty('--c', n.color);
    if (cant) b.setAttribute('aria-disabled', 'true');
    b.innerHTML = `<div class="card-icon">${n.icon}</div><div><div class="card-top"><span class="card-name">${n.name}</span><span class="card-tag">LV ${lv}</span></div><div class="card-desc">${n.desc(lv)}</div></div><div class="price flux${cant ? ' dim' : ''}"><span>${FLUX_ICON}<b>${fmt(cost)}</b></span>${cant ? `<i>NEED ${fmt(cost - profile.flux)}</i>` : ''}</div>`;
    wrap.appendChild(b);
  });
}

export function openCore(back) {
  onBack = back;
  G.screen = 'core';
  render();
  ui.show('core', { lock: 200 });
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
    render();
    ui.show('core', { focus: document.querySelector(`#core-list [data-id="${n.id}"]`) });
  },
  leaveCore: () => onBack && onBack(),
};
