// DOM menus: screen switching, keyboard/gamepad navigation, draft cards, results.

import { input } from '../core/input.js';
import { profile, saveProfile } from '../core/storage.js';
import { sfx } from '../core/audio.js';
import { cardInfo, CAT_COLORS, UPGRADES, ICONS, RARITY, pathRanks, splashUsed, SPEC_AT, SPEC_MAX, SPLASH_CAP, MASTERY, MASTERY_AT, masteryTier, modText } from '../game/upgrades.js';
import { TAGS } from '../game/parts.js';
import { formatScore, formatTime } from '../core/math.js';
import { SYSTEMS } from '../game/campaign.js';
import { tip, initTips, hideTip } from './tips.js';
import { initWells, tickWells } from './wells.js';

export const $ = (sel) => document.querySelector(sel);

const screens = {};
let current = null;
let focusIdx = 0;
let lockUntil = 0;
// Guarded screens ignore keys / pad until everything held when they opened is let go
// (and a short beat has passed), so flying input doesn't spill into the menu.
let guarded = false;
let guardUntil = 0;
let handlers = {};

// Draft card locks: the lock marks and the reroll button (its count, and how many cards it will replace).
const LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
let draftLock = null;
let lastLocks = new Set();
let lastRerolls = 0;
function syncLocks(locks, rerolls) {
  lastLocks = locks;
  lastRerolls = rerolls;
  const cards = screens.draft.querySelectorAll('#draft-cards .card');
  cards.forEach((c, i) => c.classList.toggle('locked-card', locks.has(i)));
  const n = cards.length - locks.size;
  const rr = $('#reroll-btn');
  rr.textContent = `${locks.size ? 'REROLL UNLOCKED' : 'REROLL'} (${rerolls})`;
  rr.disabled = rerolls <= 0 || n <= 0;
}

// Draft hold-to-select: upgrade cards must be held (500 ms) via mouse, touch, [Enter/Space/Pad A] or [1-3].
const DRAFT_HOLD_MS = 500;
let draftHold = null;

function updateHoldVisual(card, progress) {
  if (!card) return;
  card.style.setProperty('--hold', progress);
}

function startDraftHold(card, id, onPick, source, pointerId = null) {
  if (!card || !id || !onPick || card.dataset.picked === 'true') return;
  if (draftHold) {
    if (draftHold.card === card && draftHold.source === source) return;
    cancelDraftHold();
  }
  if (performance.now() < lockUntil || guarded) return;

  draftHold = {
    card,
    id,
    onPick,
    source,
    pointerId,
    startTime: performance.now(),
    sound: sfx.holdCharge ? sfx.holdCharge(DRAFT_HOLD_MS / 1000) : null,
    completed: false,
  };
  card.classList.add('holding');
  updateHoldVisual(card, 0);
}

function cancelDraftHold() {
  if (!draftHold) return;
  if (!draftHold.completed) {
    if (draftHold.sound) draftHold.sound.stop();
    draftHold.card.classList.remove('holding');
    updateHoldVisual(draftHold.card, 0);
  }
  draftHold = null;
}

function completeDraftHold() {
  if (!draftHold || draftHold.completed) return;
  draftHold.completed = true;
  if (draftHold.sound) draftHold.sound.stop();
  const { card, id, onPick } = draftHold;
  card.dataset.picked = 'true';
  card.classList.remove('holding');
  card.classList.add('hold-complete');
  updateHoldVisual(card, 1);
  sfx.select();
  draftHold = null;
  onPick(id);
}

// --- Button prompts ---------------------------------------------------------------------------------------------------
// A console-style footer under every menu: what each button does here, in the current device's glyphs (keys, pad
// buttons, or plain labels on touch). Mouse and touch can click them: BACK is how a pointer leaves a screen.
// Screens: data-back (+ data-back-label) adds BACK, data-select-label renames SELECT, data-noselect drops it;
// ui.prompts(name, fn) adds per-screen extras ({k, label, act}).
const GLYPHS = {
  keyboard: { confirm: 'ENTER', back: 'ESC', reroll: 'R', lock: 'F', tabL: 'Q', tabR: 'E' },
  pad: { confirm: 'A', back: 'B', reroll: 'Y', lock: 'X', tabL: 'LB', tabR: 'RB' },
};
let promptDevice = null;
const extraPrompts = {};

// The key / button glyph for a menu action on the current device ('' on touch).
export function keyCap(k) {
  const pad = input.device === 'pad';
  const g = input.device === 'touch' ? null : (pad ? GLYPHS.pad : GLYPHS.keyboard)[k];
  return g ? `<kbd class="kc k-${k}${pad ? ' pad' : ''}">${g}</kbd>` : '';
}

// --- Hubs -------------------------------------------------------------------------------------------------------------
// Screens that share one tabbed hub carry data-hub="hub:tab": they get a header with the hub's name, the player's
// currencies and the hub's tab bar (Q / E or LB / RB step it; clicking a tab opens it through the 'hub' handler).
const HUBS = {
  // [id, tab label, page name in the header]
  hangar: { title: 'HANGAR', tabs: [['ship', 'SHIP', 'SHIP & GEAR'], ['fab', 'FAB', 'FABRICATOR'], ['pilot', 'PILOT', 'PILOT'], ['tree', 'TREE', 'PASSIVE TREE'], ['core', 'FLUX', 'FLUX CORE']] },
  collect: { title: 'COLLECTION', tabs: [['gallery', 'GALLERY', 'RELICS'], ['ach', 'ACHIEVEMENTS', 'ACHIEVEMENTS']] },
};
const COIN = '<svg class="coin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l3.5 4.5-3.5 4.5-3.5-4.5z"/></svg>';
const FLUX = '<svg class="coin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 3l7 9-7 9-7-9z"/><path d="M12 8l3 4-3 4-3-4z"/></svg>';

// Markup for a main tab bar: [{label, act, attrs, on}]. The end caps show the Q / E (LB / RB) glyphs.
export function tabbar(tabs) {
  const t = tabs.map((x) => `<button class="tab${x.on ? ' on' : ''}" data-act="${x.act}" ${x.attrs || ''}><span class="tab-l">${x.label}</span><i class="tab-badge" hidden></i></button>`).join('');
  return `<div class="tabbar primary" data-nofocus><button class="tk" data-k="tabL" tabindex="-1" aria-label="Previous tab"></button><div class="tabs">${t}</div><button class="tk" data-k="tabR" tabindex="-1" aria-label="Next tab"></button></div>`;
}

function initHubs() {
  for (const el of document.querySelectorAll('.screen[data-hub]')) {
    const [hub, cur] = el.dataset.hub.split(':');
    const h = HUBS[hub];
    const head = document.createElement('header');
    head.className = 'hub-head';
    const page = h.tabs.find(([id]) => id === cur)[2];
    head.innerHTML = `<div class="hub-top"><h2 class="hub-title">${h.title}<span class="hub-page">${page}</span></h2><div class="hub-res" data-res></div></div>${tabbar(h.tabs.map(([id, label, name]) => ({ label, act: 'hub', attrs: `data-hub-tab="${hub}:${id}" aria-label="${name}"`, on: id === cur })))}`;
    el.prepend(head);
  }
}

function renderHubHead(el) {
  const res = el.querySelector('[data-res]');
  if (!res) return;
  const fmt = (n) => Math.floor(n).toLocaleString();
  res.innerHTML = `<span class="gold">${COIN}${fmt(profile.credits)}</span>${profile.flux || profile.tierMax ? `<span class="flux">${FLUX}${fmt(profile.flux)}</span>` : ''}`;
  const badges = ui.badges ? ui.badges() : {};
  for (const t of el.querySelectorAll('.tab[data-hub-tab]')) {
    const b = t.querySelector('.tab-badge');
    const v = badges[t.dataset.hubTab];
    b.hidden = !v;
    b.textContent = typeof v === 'number' ? v : '';
  }
}

function renderPrompts() {
  promptDevice = input.device;
  const bar = $('#prompts');
  for (const k of document.querySelectorAll('.tabbar.primary .tk')) k.innerHTML = keyCap(k.dataset.k);
  if (!bar) return;
  const el = current && screens[current];
  if (!el) {
    bar.hidden = true;
    return;
  }
  const list = [];
  if (input.device !== 'touch' && !el.hasAttribute('data-noselect')) list.push({ k: 'confirm', label: el.dataset.selectLabel || 'SELECT' });
  for (const p of extraPrompts[current]?.() || []) if (p && (p.touch || input.device !== 'touch')) list.push(p);
  if (el.dataset.back) list.push({ k: 'back', label: el.dataset.backLabel || 'BACK' });
  bar.innerHTML = list.map((p) => `<button class="pr pr-${p.k}" data-pr="${p.k}"${p.act ? ` data-pr-act="${p.act}"` : ''} tabindex="-1">${keyCap(p.k)}<span>${p.label}</span></button>`).join('');
  bar.hidden = !list.length;
}

function promptClick(e) {
  const b = e.target.closest('[data-pr]');
  if (!b || !current || performance.now() < lockUntil) return;
  const k = b.dataset.pr;
  if (b.dataset.prAct) {
    sfx.select();
    return handlers[b.dataset.prAct]?.();
  }
  if (k === 'back') {
    const act = screens[current].dataset.back;
    if (act && handlers[act]) {
      sfx.ui();
      handlers[act]();
    }
  } else if (k === 'confirm') {
    const t = focusables()[focusIdx];
    if (t && !(current === 'draft' && t.classList.contains('card'))) t.click();
  } else if (k === 'reroll' && current === 'draft') $('#reroll-btn').click();
  else if (k === 'lock' && current === 'draft') {
    const card = screens.draft.querySelector('.card.focus');
    if (card && draftLock && draftLock(+card.dataset.i)) syncLocks(lastLocks, lastRerolls);
  }
}

export const ui = {
  get current() {
    return current;
  },

  badges: null, // () → {'hub:tab': count | true}: marks on hub tabs (unspent points, new gear / relics)

  init(h) {
    handlers = h;
    initWells(document.getElementById('app'));
    document.querySelectorAll('.screen').forEach((el) => {
      screens[el.id.replace('scr-', '')] = el;
      el.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn || btn.disabled) return;
        if (performance.now() < lockUntil) return;
        // Unaffordable items stay focusable (aria-disabled) so their price and text can be read with keys / a pad.
        if (btn.getAttribute('aria-disabled') === 'true') return sfx.ui();
        sfx.select();
        const on = current;
        handlers[btn.dataset.act]?.(btn);
        // A page tab swapped what is on screen without re-opening it: start the focus at the top of the new page.
        if (btn.classList.contains('tab') && current === on && !focusables()[focusIdx]?.classList.contains('focus')) {
          focusIdx = 0;
          applyFocus();
        }
      });
      el.addEventListener('pointerover', (e) => {
        if (guarded) return; // a cursor resting where a new screen's button appears doesn't grab focus
        const items = focusables();
        const t = e.target.closest('button, .set-row');
        const i = items.indexOf(t);
        if (i >= 0 && i !== focusIdx) {
          focusIdx = i;
          applyFocus();
        }
      });
    });
    window.addEventListener('pointerup', () => {
      if (draftHold && draftHold.source === 'pointer') cancelDraftHold();
    });
    window.addEventListener('pointercancel', () => {
      if (draftHold && draftHold.source === 'pointer') cancelDraftHold();
    });
    window.addEventListener('blur', () => {
      cancelDraftHold();
    });
    initHubs();
    this.initSettings();
    initTips();
    $('#prompts')?.addEventListener('click', promptClick);
    for (const k of document.querySelectorAll('.tabbar.primary .tk')) {
      k.addEventListener('click', () => performance.now() >= lockUntil && switchTab(k.dataset.k === 'tabL' ? -1 : 1));
    }
  },

  // Extra footer prompts for a screen: fn() → [{k: input action, label, act?: handler, touch?: also on touch}].
  prompts(name, fn) {
    extraPrompts[name] = fn;
  },

  /** Re-draw the footer prompts (state they show changed). */
  refreshPrompts() {
    renderPrompts();
  },

  show(name, { lock = 0, focus = 0, guard = false } = {}) {
    cancelDraftHold();
    const same = !!name && name === current; // re-render of the open screen (carousel, purchase, result...)
    for (const [k, el] of Object.entries(screens)) el.classList.toggle('active', k === name);
    current = name || null;
    focusIdx = typeof focus === 'number' ? focus : 0;
    lockUntil = performance.now() + lock;
    guarded = guard;
    guardUntil = performance.now() + 180;
    if (name) screens[name].classList.toggle('guarded', guard);
    input.clear();
    hideTip();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (focus instanceof Element) focusIdx = Math.max(0, focusables().indexOf(focus)); // focus a given element
    renderPrompts();
    if (name) renderHubHead(screens[name]);
    if (name) fit(screens[name], same);
    applyFocus();
  },

  hide() {
    cancelDraftHold();
    this.show(null);
  },

  /** Re-fit the open menu from full size (fonts swapped, e.g. the retro pixel faces). */
  refit() {
    if (current) fit(screens[current]);
  },

  // Called every frame while a menu is open.
  update() {
    if (!current) return;
    // Content can change after show() (purchases, event results, fonts, resizes): keep it fitted.
    const now = performance.now();
    if (now >= fitCheckAt) {
      fitCheckAt = now + 250;
      const el = screens[current];
      if (overflow(el) > 1 || el.clientHeight !== el._fitH || el.clientWidth !== el._fitW) fit(el);
    }
    tickWells(screens[current]);
    if (guarded) {
      if (input.anyHeld() || performance.now() < guardUntil) {
        input.clear();
        return;
      }
      guarded = false;
      screens[current].classList.remove('guarded');
    }
    if (input.device !== promptDevice) renderPrompts();
    const items = focusables();
    if (!items.length) {
      // Nothing focusable: back must still escape the screen.
      if (input.consume('back')) {
        const act = screens[current].dataset.back;
        if (act && handlers[act]) handlers[act]();
      }
      return;
    }
    const el = items[focusIdx];
    if (el && el._keys) el._keys(); // a focused widget with its own arrow handling (tree view); it re-queues what it skips
    const isRange = el && el.tagName === 'INPUT' && el.type === 'range';
    const isRow = el && el.classList.contains('set-row') && el.querySelector('input[type=range]');
    const range = isRange ? el : isRow ? el.querySelector('input') : null;

    // Console-style rows: up / down step a row, left / right step along it (see moveRow).
    if (input.consume('up')) moveRow(-1);
    if (input.consume('down')) moveRow(1);
    // Left / right on a slider nudges it; on a selector (‹ VALUE ›, data-cycle) steps its value; on a settings toggle
    // with nothing beside it, flips it.
    for (const [k, d] of [['left', -1], ['right', 1]]) {
      if (!input.consume(k)) continue;
      if (range) nudge(range, d);
      else if (el.dataset.cycle && handlers[el.dataset.cycle]) {
        if (performance.now() >= lockUntil) {
          sfx.ui();
          handlers[el.dataset.cycle](el, d);
        }
      } else if (!moveCol(d) && el.classList.contains('toggle') && performance.now() >= lockUntil) el.click();
    }
    for (const [k, d] of [['tabL', -1], ['tabR', 1]]) if (input.consume(k) && performance.now() >= lockUntil) switchTab(d);
    if (input.consume('confirm') && performance.now() >= lockUntil) {
      const target = items[focusIdx];
      if (target && !range) {
        if (current === 'draft' && target.classList.contains('card')) {
          // Draft cards require hold-to-select; do not click immediately.
        } else {
          target.click();
        }
      }
    }
    if (input.consume('back')) {
      const act = screens[current].dataset.back;
      if (act && handlers[act]) {
        sfx.ui();
        handlers[act]();
      }
    }
    if (current === 'draft') {
      ['one', 'two', 'three'].forEach((k) => input.consume(k));
      if (input.consume('reroll')) $('#reroll-btn').click();
      if (input.consume('lock')) {
        const card = screens.draft.querySelector('.card.focus');
        if (card && draftLock && draftLock(+card.dataset.i)) syncLocks(lastLocks, lastRerolls);
      }

      if (performance.now() >= lockUntil && !guarded) {
        if (draftHold) {
          if (draftHold.source === 'pointer') {
            if (!draftHold.card.isConnected) cancelDraftHold();
          } else if (draftHold.source === 'confirm') {
            const cur = items[focusIdx];
            if (!input.down('confirm') || cur !== draftHold.card) cancelDraftHold();
          } else if (['one', 'two', 'three'].includes(draftHold.source)) {
            if (!input.down(draftHold.source)) cancelDraftHold();
          }
        }

        if (!draftHold) {
          const cards = screens.draft.querySelectorAll('#draft-cards .card');
          const numKeys = ['one', 'two', 'three'];
          let keyStarted = false;
          for (let i = 0; i < cards.length && i < 3; i++) {
            if (input.down(numKeys[i])) {
              const c = cards[i];
              if (c && c.dataset.id && c._onPick && c.dataset.picked !== 'true') {
                const idx = items.indexOf(c);
                if (idx >= 0 && idx !== focusIdx) {
                  focusIdx = idx;
                  applyFocus();
                }
                startDraftHold(c, c.dataset.id, c._onPick, numKeys[i]);
                keyStarted = true;
                break;
              }
            }
          }
          if (!keyStarted && input.down('confirm')) {
            const cur = items[focusIdx];
            if (cur && cur.classList.contains('card') && cur.dataset.id && cur._onPick && cur.dataset.picked !== 'true') {
              startDraftHold(cur, cur.dataset.id, cur._onPick, 'confirm');
            }
          }
        }

        if (draftHold && !draftHold.completed) {
          const elapsed = performance.now() - draftHold.startTime;
          const progress = Math.min(1, Math.max(0, elapsed / DRAFT_HOLD_MS));
          updateHoldVisual(draftHold.card, progress);
          if (progress >= 1) completeDraftHold();
        }
      } else if (draftHold) {
        cancelDraftHold();
      }
    } else if (draftHold) {
      cancelDraftHold();
    }
    if (current === 'over' && input.consume('reroll') && performance.now() >= lockUntil) handlers.retry();
  },

  // --- Title ------------------------------------------------------------------
  renderTitle() {
    const r = $('#title-records');
    r.innerHTML = profile.runs
      ? `<div>BEST<b>${formatScore(profile.best)}</b></div><div>FURTHEST<b>${profile.campaign.bestSys < 0 ? '-' : SYSTEMS[profile.campaign.bestSys].short}</b></div><div>RUNS<b>${profile.runs}</b></div>`
      : '';
  },

  // --- Draft --------------------------------------------------------------------
  // note: an extra line for the subtitle (campaign fight reward, vault haul).
  // locks: indices of locked cards (kept through a reroll); onLock(i) toggles one and returns whether it changed.
  // fx: Fortune state {fortune, max, spent, floor, base, skip (Fortune a skip adds, -1 = no skip here), next, nextGain, boss}.
  renderDraft(player, choices, kind, rerolls, onPick, left = 0, note = '', rolls = {}, locks = new Set(), onLock = null, fx = {}) {
    const T = {
      sector: fx.boss ? ['SYSTEM CLEAR', '#ffb300', 'Boss reward: every card Uncommon or better'] : ['SECTOR CLEAR', '#7dff6b', 'Claim new tech for the road ahead'],
      supply: ['SUPPLY DROP', '#ffd24a', `Pick the tech you launch with — ${left} to claim`],
      vault: ['TREASURE VAULT', '#ffb300', 'Pick one'],
      boost: ['OVERCLOCK', '#7dff6b', '+1 level to an upgrade you own'],
      level: ['LEVEL UP', '#fff', `Level ${player.level} — tune what you fly`],
    }[kind] || ['LEVEL UP', '#fff', ''];
    $('#draft-title').textContent = T[0];
    $('#draft-title').style.color = T[1];
    $('#draft-sub').textContent = `${note ? `${T[2]} · ${note} · ` : `${T[2]} · `}HOLD TO PICK`;
    renderPaths($('#draft-paths'), player, fx);
    cancelDraftHold();
    const wrap = $('#draft-cards');
    wrap.innerHTML = '';
    wrap.classList.toggle('no-keys', input.device === 'touch');
    wrap.classList.toggle('micro', kind === 'level');
    choices.forEach((id, i) => {
      const info = cardInfo(player, id, rolls[id]);
      const c = info.color || CAT_COLORS[info.cat];
      const b = document.createElement('button');
      // Two "new" levels, each with its own flag on the card's top edge: never seen in any run (DISCOVERY, white,
      // outlined card) vs. seen before but not owned this run (NEW THIS RUN, category colour).
      const fresh = info.max > 0 && info.fresh;
      const runNew = info.max > 0 && !fresh && !info.evo && info.cat !== 'weapon' && info.lv === 0; // you always fly a main cannon
      b.className = 'card' + (info.evo ? ' evo' : '') + (fresh ? ' fresh' : '') + (info.r != null ? ` rar r${info.r}` : '') + (info.tune ? ' tune' : '') + (locks.has(i) ? ' locked-card' : '');
      b.dataset.i = i;
      b.dataset.id = id;
      b._onPick = onPick;
      b.style.setProperty('--c', c);
      if (info.r != null) b.style.setProperty('--rc', RARITY[info.r].color);
      let pips = '';
      if (info.max && !info.evo) {
        for (let k = 0; k < info.max; k++) pips += `<i class="${k < info.lv ? 'on' : k < info.lv + info.levels ? 'next' : ''}"></i>`;
      }
      const tag = info.evo ? 'EVOLVE' : info.tune ? 'TUNE' : info.max ? (info.levels > 1 ? `LV ${info.lv + 1}-${info.lv + info.levels}` : `LV ${info.lv + 1}`) : 'BONUS';
      // Path line: what the pick does to your specialization (locks a path in, reaches a mastery tier, uses splash).
      const pn = info.note ? `<span class="pnote ${info.note.kind}" style="--t:${TAGS[info.note.path].color}">${info.note.text}</span>` : '';
      // Reward cards: rarity, bonus levels and a reserved two-line modifier block (rerolls never change the card height).
      // Level-up cards are plain and compact: just the path line.
      const rar = info.r != null
        ? `<div class="card-rar"><b>${RARITY[info.r].name}</b>${info.levels > 1 ? `<span>+${info.levels} LEVELS</span>` : ''}${pn}</div><div class="card-mods well">${info.mods.map((m) => `<i>${m}</i>`).join('')}</div>`
        : `<div class="card-rar plain">${pn}</div>`; // always present: every card in a draft is the same height
      const flag = fresh ? `<span class="card-flag disc">${STAR}NEW DISCOVERY</span>` : runNew ? '<span class="card-flag run">NEW THIS RUN</span>' : '';
      b.innerHTML = `${flag}<div class="card-hold-wash"></div><div class="card-icon">${info.icon}</div><div><div class="card-top"><span class="card-name clip">${info.name}</span><span class="card-tag">${tag}</span></div><div class="card-desc well">${info.desc}</div>${rar}<div class="pips">${pips}</div></div>${input.device === 'touch' ? '' : `<kbd>${i + 1}</kbd>`}<span class="card-lock" title="Lock: keep this card through a reroll">${LOCK_SVG}</span><span class="card-sel"></span><div class="card-hold-track"><div class="card-hold-bar"></div></div>`;
      b.querySelector('.card-lock').addEventListener('click', (e) => {
        e.stopPropagation();
        if (onLock && onLock(i)) syncLocks(locks, rerolls);
      });
      b.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.pointerType !== 'touch') return;
        if (e.target.closest('.card-lock')) return;
        if (performance.now() < lockUntil || guarded) return;
        startDraftHold(b, id, onPick, 'pointer', e.pointerId);
      });
      b.addEventListener('pointerup', (e) => {
        if (draftHold && draftHold.source === 'pointer' && draftHold.card === b) cancelDraftHold();
      });
      b.addEventListener('pointercancel', (e) => {
        if (draftHold && draftHold.source === 'pointer' && draftHold.card === b) cancelDraftHold();
      });
      b.addEventListener('pointerleave', (e) => {
        if (draftHold && draftHold.source === 'pointer' && draftHold.card === b) cancelDraftHold();
      });
      b.addEventListener('click', (e) => {
        e.preventDefault();
      });
      wrap.appendChild(b);
    });
    draftLock = onLock;
    syncLocks(locks, rerolls);
    const sk = $('#skip-btn');
    sk.style.visibility = fx.skip < 0 ? 'hidden' : '';
    sk.disabled = !(fx.skip > 0);
    sk.textContent = fx.skip > 0 ? `SKIP · +${fx.skip} FORTUNE` : 'FORTUNE FULL';
    sk.title = 'Take nothing now; your next reward draft rolls rarer';
    renderBuild($('#draft-build'), player);
  },

  // --- Pause --------------------------------------------------------------------
  renderPause(G) {
    const p = G.player;
    $('#pause-stats').innerHTML = stat('SECTOR', G.sector) + stat('LEVEL', p.level) + stat('TIME', formatTime(G.runTime));
    renderBuild($('#pause-build'), p, true);
    $('#pause-quit').textContent = G.run && G.run.mode === 'campaign' ? (G.run.victory ? 'EXTRACT · BANK ALL' : 'ABANDON RUN') : 'QUIT TO TITLE';
  },

  // --- Game over ----------------------------------------------------------------
  renderGameOver(sum) {
    $('#over-score').textContent = formatScore(sum.score);
    $('#over-best').hidden = !sum.newBest;
    $('#over-stats').innerHTML =
      stat('SECTOR', sum.sector) + stat('TIME', formatTime(sum.time)) + stat('LEVEL', sum.level) +
      stat('KILLS', sum.kills) + stat('BEST CHAIN', sum.maxCombo) + stat('GRAZES', sum.grazes);
    const un = $('#over-unlock');
    un.hidden = !sum.unlocked.length;
    un.textContent = sum.unlocked.map((s) => `NEW SHIP UNLOCKED: ${s.name}`).join(' · ');
    renderBuild($('#over-build'), sum.player);
    // Campaign: the way forward is the Hangar (spend what was banked), so UPGRADE SHIP leads and RETRY is secondary.
    const main = $('#over-main');
    const alt = $('#over-alt');
    main.dataset.act = sum.campaign ? 'upgrade' : 'retry';
    main.textContent = sum.campaign ? 'UPGRADE SHIP' : 'RETRY';
    alt.dataset.act = sum.campaign ? 'retry' : 'campaign';
    alt.textContent = sum.campaign ? 'RETRY' : 'CAMPAIGN';
    const next = $('#over-next');
    next.hidden = !sum.campaign;
    if (sum.campaign) {
      const cr = sum.reward.total;
      next.innerHTML = cr > 0 ? `Spend your <b>${formatScore(cr)}</b> credits in the HANGAR, then relaunch.` : 'Gear up in the HANGAR, then relaunch.';
    }
  },

  // --- Settings -----------------------------------------------------------------
  initSettings() {
    const s = profile.settings;
    const music = $('#set-music');
    const sfxR = $('#set-sfx');
    const sync = () => {
      music.value = Math.round(s.music * 100);
      sfxR.value = Math.round(s.sfx * 100);
      $('#set-music-v').textContent = music.value;
      $('#set-sfx-v').textContent = sfxR.value;
      const px = s.retro !== 'off';
      $('#set-retro b').textContent = px ? 'ON' : 'OFF';
      $('#set-retro b').classList.toggle('off', !px);
      $('#set-side b').textContent = s.touchSide === 'left' ? 'LEFT' : 'RIGHT';
      document.querySelectorAll('[data-set]').forEach((b) => {
        const on = !!s[b.dataset.set];
        const tag = b.querySelector('b');
        tag.textContent = on ? 'ON' : 'OFF';
        tag.classList.toggle('off', !on);
      });
    };
    music.addEventListener('input', () => {
      handlers.setMusic?.(music.value / 100);
      sync();
      saveProfile();
    });
    sfxR.addEventListener('input', () => {
      handlers.setSfx?.(sfxR.value / 100);
      sync();
      saveProfile();
      sfx.ui();
    });
    document.querySelectorAll('[data-set]').forEach((b) =>
      b.addEventListener('click', () => {
        s[b.dataset.set] = !s[b.dataset.set];
        saveProfile();
        sync();
      }),
    );
    this.syncSettings = sync;
    sync();
  },

  toast(textStr) {
    const t = $('#toast');
    $('#toast-text').textContent = textStr;
    t.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('show'), 3500);
  },
};

ui.prompts('draft', () => [{ k: 'reroll', label: 'REROLL' }, { k: 'lock', label: 'LOCK' }]);
ui.prompts('over', () => [{ k: 'reroll', label: 'RETRY', act: 'retry' }]);

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.3l7.1-.7z"/></svg>';

export function stat(label, value) {
  return `<div>${label}<b>${value}</b></div>`;
}

// Tooltip lines for a build-path chip: rank, what specializing / mastery gives.
export function pathTip(p, t, ranks) {
  const spec = p.spec || [];
  const [stat, v] = MASTERY[t];
  const lines = [`Rank ${ranks[t]}: every upgrade level on this path adds 1.`];
  if (spec.includes(t)) {
    const tier = masteryTier(ranks[t]);
    const next = MASTERY_AT.find((r) => r > ranks[t]);
    lines.push(tier ? `Mastery ${['', 'I', 'II', 'III'][tier]}: ${modText([stat, v * tier])}.` : `Mastery tiers at ${MASTERY_AT.join(' / ')}: ${modText([stat, v])} each.`);
    if (next) lines.push(`Next tier at rank ${next}.`);
  } else if (spec.length < SPEC_MAX) lines.push(`Reach ${SPEC_AT} to specialize: mastery gives ${modText([stat, v])} per tier.`);
  else lines.push(`Off-path: shares ${SPLASH_CAP} splash levels with the other off-paths.`);
  return lines;
}

// The draft's build-path and Fortune lines (two fixed lines, so they never shift the cards).
const RNAME = ['', 'UNCOMMON+', 'RARE+', 'EPIC+', 'LEGENDARY'];
function renderPaths(el, p, fx) {
  const ranks = pathRanks(p);
  const spec = p.spec || [];
  const chip = (t, txt, cls = '') => `<span class="pchip ${cls}" style="--t:${TAGS[t].color}"${tip(TAGS[t].name, pathTip(p, t, ranks), TAGS[t].color)}>${txt}</span>`;
  let line = '';
  if (spec.length) {
    line += spec.map((t) => chip(t, `◆ ${TAGS[t].name} ${ranks[t]}`, 'spec')).join('');
    line += spec.length < SPEC_MAX
      ? `<span class="pdim">a second path locks in at ${SPEC_AT}</span>`
      : `<span class="pdim">SPLASH ${Math.min(SPLASH_CAP, splashUsed(p, ranks))}/${SPLASH_CAP}</span>`;
  } else {
    const top = Object.keys(ranks).filter((t) => ranks[t] > 0).sort((a, b) => ranks[b] - ranks[a]).slice(0, 3);
    line += top.map((t) => chip(t, `${TAGS[t].name} ${ranks[t]}`)).join('');
    line += `<span class="pdim">${top.length ? '' : 'BUILD PATHS · '}${SPEC_MAX} lock in at ${SPEC_AT}</span>`;
  }
  const pips = Array.from({ length: fx.max || 6 }, (_, i) => `<i class="${i < (fx.fortune || 0) ? 'on' : ''}"></i>`).join('');
  const ft = tip('FORTUNE', ['Skip a draft to bank Fortune: +1 on a level-up, +2 on a reward (max 6).', 'Your next reward draft spends it all: luckier rolls, and one card at least Rare at 2, Epic at 4, Legendary at 6.'], '#ffd24a');
  let f = `<span class="fortune"${ft}>FORTUNE <span class="fpips">${pips}</span></span>`;
  if (fx.spent) f = `<span class="fortune spent">FORTUNE ×${fx.spent} SPENT</span><span class="pdim">${fx.floor > fx.base ? `one card ${RNAME[fx.floor]} · ` : ''}luckier rolls</span>`;
  else if (fx.boss) f += '<span class="pdim">boss reward</span>';
  else if (fx.next) f += `<span class="pdim">next reward: one card ${RNAME[fx.next]}</span>`;
  else if (fx.skip > 0 && fx.nextGain) f += `<span class="pdim">skip → next reward: one card ${RNAME[fx.nextGain]}</span>`;
  else f += '<span class="pdim">skip a draft to roll rarer rewards</span>';
  el.innerHTML = `<div>${line}</div><div>${f}</div>`;
}

// Owned upgrades as icon chips with tooltips. focusable: buttons the menu focus can land on (pause), else tip-only
// (hover / tap) so they stay out of the screen's key navigation (draft, game over).
export function renderBuild(el, p, focusable = false) {
  if (!p) {
    el.innerHTML = '';
    return;
  }
  const tagName = focusable ? 'button' : 'div';
  let html = '';
  for (const u of UPGRADES) {
    const lv = p.up[u.id] || 0;
    if (!lv) continue;
    const evo = u.cat === 'evolution';
    const t = tip(u.name, [u.desc(u.cat === 'module' ? 1 : lv), evo ? 'Evolution' : `Level ${lv} of ${u.max}${lv >= u.max ? ' (max)' : ''}`], CAT_COLORS[u.cat]);
    html += `<${tagName} class="${evo ? 'chip evo' : 'chip'}" style="--c:${CAT_COLORS[u.cat]}"${t}>${ICONS[u.id]}${evo ? '' : `<b>${lv}</b>`}</${tagName}>`;
  }
  el.innerHTML = html;
}

// Menus never scroll: when a screen's content is taller than the window, shrink the whole screen's
// type (everything is sized in em) until it fits. Below MIN_FIT it stays clipped-but-scrollable (no bar).
// Menus never jump either: a screen is centred once when it opens, then its top is pinned, so a line that
// appears or a card that grows only pushes what is below it. `keep` = the screen was already open.
const MIN_FIT = 0.72;
let fitCheckAt = 0;

// How far a screen's content runs into its bottom padding (the prompt footer's room) or past it. scrollHeight leaves
// a flex column's end padding out, so measure the children.
function overflow(el) {
  const pb = parseFloat(getComputedStyle(el).paddingBottom) || 0;
  let bottom = 0;
  for (const c of el.children) {
    if (c.offsetParent === null) continue;
    const cs = getComputedStyle(c);
    if (cs.position === 'absolute') continue;
    bottom = Math.max(bottom, c.offsetTop + c.offsetHeight + (parseFloat(cs.marginBottom) || 0));
  }
  return Math.max(el.scrollHeight - el.clientHeight, bottom + pb - el.clientHeight);
}

function fit(el, keep = false) {
  if (keep && el._pinned && overflow(el) <= 1) return;
  el.style.fontSize = '';
  el.style.justifyContent = '';
  el.style.paddingTop = '';
  let k = 1;
  for (let i = 0; i < 6 && k > MIN_FIT; i++) {
    const over = overflow(el);
    if (over <= 1) break;
    k = Math.max(MIN_FIT, k * Math.min(0.97, el.clientHeight / (el.clientHeight + over)));
    el.style.fontSize = `${k}em`;
  }
  pin(el);
  // Pinning can add a pixel or two of padding to a screen that only just fit: shrink a hair more so it can't scroll.
  if (overflow(el) > 0 && k < 1 && k > MIN_FIT) {
    k = Math.max(MIN_FIT, k * 0.99);
    el.style.fontSize = `${k}em`;
    el.style.justifyContent = '';
    el.style.paddingTop = '';
    pin(el);
  }
  el._fitH = el.clientHeight;
  el._fitW = el.clientWidth;
}

// Swap the flex centring for the same top offset as fixed padding.
function pin(el) {
  const first = [...el.children].find((c) => c.offsetParent !== null && getComputedStyle(c).position !== 'absolute');
  el._pinned = !!first;
  if (!first) return;
  const top = first.offsetTop - (parseFloat(getComputedStyle(first).marginTop) || 0);
  el.style.justifyContent = 'flex-start';
  el.style.paddingTop = `${top}px`;
}

function focusables() {
  if (!current) return [];
  const root = screens[current];
  // .tab-off: an inactive tab kept in the layout (visibility only), so its items are skipped.
  // [data-nofocus]: pointer-only controls (tab bars switch with Q / E or the bumpers, carousel arrows with left / right).
  return [...root.querySelectorAll('button:not([disabled]), .set-row')].filter((el) => el.offsetParent !== null && !el.closest('.tab-off, [data-nofocus]'));
}

function applyFocus() {
  const items = focusables();
  if (!current) return;
  screens[current].querySelectorAll('.focus').forEach((el) => el.classList.remove('focus'));
  if (!items.length) return;
  focusIdx = ((focusIdx % items.length) + items.length) % items.length;
  items[focusIdx].classList.add('focus');
  items[focusIdx].dispatchEvent(new CustomEvent('menufocus', { bubbles: true })); // detail panels follow the focus
  items[focusIdx].scrollIntoView({ block: 'nearest' });
}

// Row navigation (console style). The focusable items are read as rows: items whose vertical spans line up form a
// row, ordered left to right (a [data-row] container forces its items into one row). Up / down always step to the
// row above / below (wrapping at the ends), landing on the item nearest the column the moves started from; left / right
// step along the row, wrapping within it. Nothing ever skips a row or jumps sideways on a vertical press.
let navX = null; // {el, x}: the column held by a run of up / down presses
const rowMemory = new WeakMap(); // a row's first item → the item last left in that row
function navRows(items) {
  const keyed = new Map();
  const boxes = [];
  items.forEach((el) => {
    const r = el.getBoundingClientRect();
    const o = { el, t: r.top, b: r.bottom, l: r.left, r: r.right, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 };
    const key = el.closest('[data-row]');
    if (key) {
      const g = keyed.get(key);
      if (g) {
        g.items.push(o);
        g.cy = Math.min(g.cy, o.cy);
        return;
      }
      const row = { items: [o], t: o.t, b: o.b, cy: o.cy, fixed: true };
      keyed.set(key, row);
      boxes.push(row);
      return;
    }
    boxes.push({ items: [o], t: o.t, b: o.b, cy: o.cy });
  });
  boxes.sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const g of boxes) {
    const last = rows[rows.length - 1];
    // Same row: this item's centre sits inside the row's first item's span, or the other way round.
    if (last && !g.fixed && !last.fixed && ((g.cy > last.t && g.cy < last.b) || (last.cy > g.t && last.cy < g.b))) last.items.push(...g.items);
    else rows.push(g);
  }
  for (const r of rows) r.items.sort((a, b) => a.l - b.l);
  return rows;
}

function navTo(el) {
  const items = focusables();
  const i = items.indexOf(el);
  if (i < 0 || i === focusIdx) return false;
  focusIdx = i;
  applyFocus();
  sfx.ui();
  return true;
}

function moveRow(dy) {
  const items = focusables();
  const cur = items[focusIdx];
  if (!cur) return false;
  const rows = navRows(items);
  const ri = rows.findIndex((r) => r.items.some((o) => o.el === cur));
  if (ri < 0 || rows.length < 2) return false;
  const here = rows[ri].items.find((o) => o.el === cur);
  const held = navX && navX.el === cur;
  const x = held ? navX.x : here.cx;
  const row = rows[(ri + dy + rows.length) % rows.length];
  let best = row.items[0];
  for (const o of row.items) if (Math.abs(o.cx - x) < Math.abs(best.cx - x) - 0.5) best = o;
  // From a wide item (a card, a full-width button) over several narrower ones: back to the item last left in that
  // row, else its first item it spans, so a row is always entered at a place you can predict.
  const under = row.items.filter((o) => o.cx >= here.l && o.cx <= here.r);
  if (under.length > 1) best = under.find((o) => o.el === rowMemory.get(row.items[0].el)) || under[0];
  if (rows[ri].items.length > 1) rowMemory.set(rows[ri].items[0].el, cur);
  if (!navTo(best.el)) return false;
  navX = { el: best.el, x };
  return true;
}

function moveCol(dx) {
  const items = focusables();
  const cur = items[focusIdx];
  if (!cur) return false;
  const row = navRows(items).find((r) => r.items.some((o) => o.el === cur));
  if (!row || row.items.length < 2) return false;
  const ci = row.items.findIndex((o) => o.el === cur);
  navX = null;
  return navTo(row.items[(ci + dx + row.items.length) % row.items.length].el);
}

// Q / E (LB / RB): step the screen's main tab bar, wrapping.
function switchTab(d) {
  const bar = screens[current] && screens[current].querySelector('.tabbar.primary');
  if (!bar) return false;
  const tabs = [...bar.querySelectorAll('.tab')].filter((t) => !t.disabled);
  if (tabs.length < 2) return false;
  const i = Math.max(0, tabs.findIndex((t) => t.classList.contains('on')));
  tabs[(i + d + tabs.length) % tabs.length].click();
  return true;
}

function nudge(range, dir) {
  range.value = Math.max(0, Math.min(100, Number(range.value) + dir * 10));
  range.dispatchEvent(new Event('input'));
}
