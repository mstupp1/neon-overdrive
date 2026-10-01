// Gallery (relic sets, buying, Data Capsules) and Achievements screens, both off the title menu.

import { G } from '../game/state.js';
import { profile } from '../core/storage.js';
import { sfx } from '../core/audio.js';
import {
  THEMES, RARITY, CAPSULE_PRICE, CAPSULE_ICON, SET_BONUS, RELICS, relicsOf, relicById, ownsRelic, setDone, priceOf, buyRelic, openCapsule, seenRelics,
} from '../game/collectables.js';
import { SYSTEMS } from '../game/campaign.js';
import { ACHIEVEMENTS, GROUPS, TIERS, hasAch, achProgress } from '../game/achievements.js';
import { ui, $ } from './screens.js';

const coin = '<svg class="coin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l3.5 4.5-3.5 4.5-3.5-4.5z"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.3 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z"/></svg>';
const fmt = (n) => Math.floor(n).toLocaleString();

let tab = 0; // theme index
let sel = null; // selected relic id
let flashId = null; // relic just acquired (pop animation)
let back = null; // where BACK goes

const theme = () => THEMES[tab];
const fieldName = (t) => (t.system ? SYSTEMS.find((s) => s.id === t.system).name : 'THE ENDLESS GRID');

function renderGallery() {
  const t = theme();
  const owned = RELICS.filter((r) => ownsRelic(r.id)).length;
  $('#gl-head').innerHTML = `<span class="gold">${coin}${fmt(profile.credits)}</span><span>RELICS <b>${owned}/${RELICS.length}</b></span>`;

  $('#gl-tabs').innerHTML = THEMES.map((th, i) => {
    const n = relicsOf(th.id).filter((r) => ownsRelic(r.id)).length;
    const fresh = relicsOf(th.id).some((r) => profile.relicNew.includes(r.id));
    return `<button class="gl-tab${i === tab ? ' cur' : ''}${setDone(th.id) ? ' done' : ''}" data-act="gltab" data-i="${i}" style="--c:${th.color}"><b>${th.name}</b><i>${n}/6</i>${fresh ? '<s></s>' : ''}</button>`;
  }).join('');

  const set = relicsOf(t.id);
  const have = set.filter((r) => ownsRelic(r.id)).length;
  const done = have === set.length;
  const setEl = $('#gl-set');
  setEl.style.setProperty('--c', t.color);
  setEl.innerHTML = `<div class="gl-set-top"><h4>${t.name}</h4><span class="${done ? 'ok' : ''}">${done ? 'SET COMPLETE' : `SET BONUS ${coin}${SET_BONUS}`}</span></div><p>${t.blurb}</p><div class="gl-bar"><i style="width:${(have / set.length) * 100}%"></i></div>`;

  $('#gl-grid').innerHTML = set.map((r) => {
    const own = ownsRelic(r.id);
    const legend = r.rarity === 'legendary';
    const cls = ['gl-tile', own ? 'own' : '', legend ? 'legend' : '', r.id === sel ? 'sel' : '', r.id === flashId ? 'pop' : ''].join(' ');
    const art = own || !legend ? r.icon : '<i>?</i>';
    const fresh = profile.relicNew.includes(r.id) ? '<s></s>' : '';
    return `<button class="${cls}" data-act="glpick" data-id="${r.id}" style="--c:${t.color};--r:${RARITY[r.rarity].color}" aria-label="${own || !legend ? r.name : 'Unknown relic'}">${art}${fresh}</button>`;
  }).join('');
  flashId = null;

  renderDetail();
  const cap = $('#gl-capsule');
  const left = RELICS.some((r) => r.rarity !== 'legendary' && !ownsRelic(r.id));
  cap.innerHTML = left ? `CAPSULE ${coin}${CAPSULE_PRICE}` : 'CAPSULES SOLD OUT';
  cap.disabled = !left;
  cap.setAttribute('aria-disabled', left && profile.credits < CAPSULE_PRICE ? 'true' : 'false');
}

function renderDetail() {
  const r = relicById(sel);
  const el = $('#gl-detail');
  if (!r) {
    el.innerHTML = `<div class="gl-cap"><span class="gl-cap-ico">${CAPSULE_ICON}</span><p>Pick a relic to inspect it. Commons and rares can be bought here; every relic can also drop in the field around <b>${fieldName(theme())}</b>. Legendaries are field finds only.</p></div>`;
    return;
  }
  const own = ownsRelic(r.id);
  const legend = r.rarity === 'legendary';
  const rar = RARITY[r.rarity];
  let act;
  if (own) act = '<span class="gl-own">IN COLLECTION</span>';
  else if (legend) act = `<span class="gl-own">FIELD FIND · ${fieldName(theme())}</span>`;
  else {
    const price = priceOf(r);
    const afford = profile.credits >= price;
    act = `<button class="btn small primary" data-act="glbuy" data-id="${r.id}" id="gl-buy"${afford ? '' : ' aria-disabled="true"'}>BUY ${coin}${fmt(price)}${afford ? '' : `<small>NEED ${fmt(price - profile.credits)}</small>`}</button>`;
  }
  const name = own || !legend ? r.name : '???';
  const text = own ? r.text : legend ? 'Something rare drifts out there. You will know it when you see it.' : 'Not in your collection yet.';
  el.style.setProperty('--c', theme().color);
  el.style.setProperty('--r', rar.color);
  el.innerHTML = `<div class="gl-big${own ? ' own' : ''}">${own || !legend ? r.icon : '<i>?</i>'}</div><div class="gl-info"><em>${rar.name}</em><h4>${name}</h4><p>${text}</p>${act}</div>`;
}

function show(focus) {
  G.screen = 'gallery';
  renderGallery();
  let el = typeof focus === 'string' ? $('#scr-gallery ' + focus) : focus;
  if (!el || el.disabled) el = $('#gl-tabs .cur');
  ui.show('gallery', { focus: el });
}

export function openGallery(onBack) {
  back = onBack;
  sel = null;
  tab = Math.max(0, THEMES.findIndex((t) => relicsOf(t.id).some((r) => profile.relicNew.includes(r.id))));
  show();
}

// --- Achievements ---------------------------------------------------------------------

function renderAchievements() {
  const got = ACHIEVEMENTS.filter((a) => hasAch(a.id)).length;
  $('#ach-head').innerHTML = `<span>UNLOCKED <b>${got}/${ACHIEVEMENTS.length}</b></span><div class="gl-bar"><i style="width:${(got / ACHIEVEMENTS.length) * 100}%"></i></div>`;
  let html = '';
  for (const g of GROUPS) {
    const list = ACHIEVEMENTS.filter((a) => a.group === g);
    const n = list.filter((a) => hasAch(a.id)).length;
    html += `<div class="ach-group">${g}<i>${n}/${list.length}</i></div>`;
    for (const a of list) {
      const on = hasAch(a.id);
      const t = TIERS[a.tier];
      const secret = a.hidden && !on;
      const pr = !on && achProgress(a.id);
      const bar = pr ? `<span class="ach-prog"><i style="width:${Math.min(100, (pr[0] / pr[1]) * 100)}%"></i><em>${fmt(Math.min(pr[0], pr[1]))}/${fmt(pr[1])}</em></span>` : '';
      html += `<button class="ach${on ? ' on' : ''}${secret ? ' secret' : ''}" tabindex="-1" style="--c:${t.color}"><span class="ach-ico">${on ? STAR : LOCK}</span><span class="ach-txt"><b>${secret ? '???' : a.name}</b><span>${secret ? 'Hidden. Keep flying.' : a.desc}</span>${bar}</span><span class="ach-rw">${on ? t.name : `${coin}${t.reward}`}</span></button>`;
    }
  }
  $('#ach-list').innerHTML = html;
}

export function openAchievements(onBack) {
  back = onBack;
  G.screen = 'achievements';
  renderAchievements();
  $('#ach-list').scrollTop = 0;
  ui.show('achievements', { focus: $('#ach-list .ach') });
}

// data-act handlers merged into main's ui.init.
export const galleryActs = {
  gltab(btn) {
    tab = +btn.dataset.i;
    sel = null;
    show(`[data-act=gltab][data-i="${tab}"]`);
  },
  glpick(btn) {
    sel = btn.dataset.id;
    show(`[data-id="${sel}"]`);
  },
  glbuy(btn) {
    const id = btn.dataset.id;
    if (buyRelic(id)) return sfx.ui();
    sfx.relic(false);
    flashId = id;
    show(`.gl-tile[data-id="${id}"]`);
  },
  capsule() {
    const res = openCapsule();
    if (res.err) return sfx.ui();
    const r = res.relic;
    tab = THEMES.findIndex((t) => t.id === r.theme);
    sel = r.id;
    flashId = r.id;
    show(`.gl-tile[data-id="${r.id}"]`);
  },
  leaveGallery() {
    seenRelics();
    back?.();
  },
  leaveAch() {
    back?.();
  },
};
