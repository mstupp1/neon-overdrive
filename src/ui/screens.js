// DOM menus: screen switching, keyboard/gamepad navigation, draft cards, results.

import { input } from '../core/input.js';
import { profile, saveProfile } from '../core/storage.js';
import { sfx } from '../core/audio.js';
import { cardInfo, CAT_COLORS, UPGRADES, ICONS } from '../game/upgrades.js';
import { formatScore, formatTime } from '../core/math.js';
import { SYSTEMS } from '../game/campaign.js';

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

export const ui = {
  get current() {
    return current;
  },

  init(h) {
    handlers = h;
    document.querySelectorAll('.screen').forEach((el) => {
      screens[el.id.replace('scr-', '')] = el;
      el.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn || btn.disabled) return;
        if (performance.now() < lockUntil) return;
        // Unaffordable items stay focusable (aria-disabled) so their price and text can be read with keys / a pad.
        if (btn.getAttribute('aria-disabled') === 'true') return sfx.ui();
        sfx.select();
        handlers[btn.dataset.act]?.(btn);
      });
      el.addEventListener('pointerover', (e) => {
        const items = focusables();
        const t = e.target.closest('button, .set-row');
        const i = items.indexOf(t);
        if (i >= 0 && i !== focusIdx) {
          focusIdx = i;
          applyFocus();
        }
      });
    });
    this.initSettings();
  },

  show(name, { lock = 0, focus = 0, guard = false } = {}) {
    for (const [k, el] of Object.entries(screens)) el.classList.toggle('active', k === name);
    current = name || null;
    focusIdx = typeof focus === 'number' ? focus : 0;
    lockUntil = performance.now() + lock;
    guarded = guard;
    guardUntil = performance.now() + 180;
    if (name) screens[name].classList.toggle('guarded', guard);
    input.clear();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (focus instanceof Element) focusIdx = Math.max(0, focusables().indexOf(focus)); // focus a given element
    if (name) fit(screens[name]);
    applyFocus();
  },

  hide() {
    this.show(null);
  },

  // Called every frame while a menu is open.
  update() {
    if (!current) return;
    // Content can change after show() (purchases, event results, fonts, resizes): keep it fitted.
    const now = performance.now();
    if (now >= fitCheckAt) {
      fitCheckAt = now + 250;
      const el = screens[current];
      if (el.scrollHeight > el.clientHeight + 1 || el.clientHeight !== el._fitH || el.clientWidth !== el._fitW) fit(el);
    }
    if (guarded) {
      if (input.anyHeld() || performance.now() < guardUntil) {
        input.clear();
        return;
      }
      guarded = false;
      screens[current].classList.remove('guarded');
    }
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
    const isRange = el && el.tagName === 'INPUT' && el.type === 'range';
    const isRow = el && el.classList.contains('set-row') && el.querySelector('input[type=range]');
    const range = isRange ? el : isRow ? el.querySelector('input') : null;

    if (input.consume('up')) move(-1);
    if (input.consume('down')) move(1);
    if (input.consume('left')) {
      if (range) nudge(range, -1);
      else move(-1);
    }
    if (input.consume('right')) {
      if (range) nudge(range, 1);
      else move(1);
    }
    if (input.consume('confirm') && performance.now() >= lockUntil) {
      const target = items[focusIdx];
      if (target && !range) target.click();
    }
    if (input.consume('back')) {
      const act = screens[current].dataset.back;
      if (act && handlers[act]) {
        sfx.ui();
        handlers[act]();
      }
    }
    if (current === 'draft') {
      ['one', 'two', 'three'].forEach((k, i) => {
        if (input.consume(k) && performance.now() >= lockUntil) {
          const card = screens.draft.querySelectorAll('.card')[i];
          if (card) card.click();
        }
      });
      if (input.consume('reroll')) $('#reroll-btn').click();
    }
    if (current === 'over' && input.consume('reroll') && performance.now() >= lockUntil) handlers.retry();
  },

  // --- Title ------------------------------------------------------------------
  renderTitle() {
    const r = $('#title-records');
    r.innerHTML = profile.runs
      ? `<div>BEST<b>${formatScore(profile.best)}</b></div><div>FURTHEST<b>${profile.campaign.bestSys < 0 ? '-' : SYSTEMS[profile.campaign.bestSys].short}</b></div><div>RUNS<b>${profile.runs}</b></div>`
      : '';
    $('#title-hint').textContent = input.isTouchDevice ? 'Tap PLAY to begin' : 'Enter / Space to select';
  },

  // --- Draft --------------------------------------------------------------------
  renderDraft(player, choices, kind, rerolls, onPick, left = 0) {
    $('#draft-title').textContent = kind === 'sector' ? 'SECTOR CLEAR' : kind === 'supply' ? 'SUPPLY DROP' : 'LEVEL UP';
    $('#draft-title').style.color = kind === 'sector' ? '#7dff6b' : kind === 'supply' ? '#ffd24a' : '#fff';
    $('#draft-sub').textContent = kind === 'sector' ? 'Claim a reward for the next sector' : kind === 'supply' ? `Salvaged tech for this system — ${left} to claim` : `Level ${player.level} — choose an upgrade`;
    const wrap = $('#draft-cards');
    wrap.innerHTML = '';
    wrap.classList.toggle('no-keys', input.device === 'touch');
    choices.forEach((id, i) => {
      const info = cardInfo(player, id);
      const c = CAT_COLORS[info.cat];
      const b = document.createElement('button');
      // Two "new" levels, each with its own flag on the card's top edge: never seen in any run (DISCOVERY, white,
      // outlined card) vs. seen before but not owned this run (NEW THIS RUN, category colour).
      const fresh = info.max > 0 && info.fresh;
      const runNew = info.max > 0 && !fresh && !info.evo && info.cat !== 'weapon' && info.lv === 0; // you always fly a main cannon
      b.className = 'card' + (info.evo ? ' evo' : '') + (fresh ? ' fresh' : '');
      b.style.setProperty('--c', c);
      let pips = '';
      if (info.max && !info.evo) {
        for (let k = 0; k < info.max; k++) pips += `<i class="${k < info.lv ? 'on' : k === info.lv ? 'next' : ''}"></i>`;
      }
      const tag = info.evo ? 'EVOLVE' : info.max ? `LV ${info.lv + 1}` : 'BONUS';
      const flag = fresh ? `<span class="card-flag disc">${STAR}NEW DISCOVERY</span>` : runNew ? '<span class="card-flag run">NEW THIS RUN</span>' : '';
      b.innerHTML = `${flag}<div class="card-icon">${info.icon}</div><div><div class="card-top"><span class="card-name">${info.name}</span><span class="card-tag">${tag}</span></div><div class="card-desc">${info.desc}</div>${pips ? `<div class="pips">${pips}</div>` : ''}</div>${input.device === 'touch' ? '' : `<kbd>${i + 1}</kbd>`}`;
      b.addEventListener('click', () => {
        if (performance.now() < lockUntil) return;
        sfx.select();
        onPick(id);
      });
      wrap.appendChild(b);
    });
    const rr = $('#reroll-btn');
    rr.textContent = `REROLL (${rerolls})${input.device === 'keyboard' ? '  [R]' : ''}`;
    rr.disabled = rerolls <= 0;
    renderBuild($('#draft-build'), player);
  },

  // --- Pause --------------------------------------------------------------------
  renderPause(G) {
    const p = G.player;
    $('#pause-stats').innerHTML = stat('SECTOR', G.sector) + stat('LEVEL', p.level) + stat('TIME', formatTime(G.runTime));
    renderBuild($('#pause-build'), p);
    $('#pause-quit').textContent = G.run && G.run.mode === 'campaign' ? 'ABANDON RUN' : 'QUIT TO TITLE';
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

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.3l7.1-.7z"/></svg>';

export function stat(label, value) {
  return `<div>${label}<b>${value}</b></div>`;
}

export function renderBuild(el, p) {
  if (!p) {
    el.innerHTML = '';
    return;
  }
  let html = '';
  for (const u of UPGRADES) {
    const lv = p.up[u.id] || 0;
    if (!lv) continue;
    html += `<div class="${u.cat === 'evolution' ? 'chip evo' : 'chip'}" style="--c:${CAT_COLORS[u.cat]}" title="${u.name}">${ICONS[u.id]}${u.cat === 'evolution' ? '' : `<b>${lv}</b>`}</div>`;
  }
  el.innerHTML = html;
}

// Menus never scroll: when a screen's content is taller than the window, shrink the whole screen's
// type (everything is sized in em) until it fits. Below MIN_FIT it stays clipped-but-scrollable (no bar).
const MIN_FIT = 0.72;
let fitCheckAt = 0;

function fit(el) {
  el.style.fontSize = '';
  let k = 1;
  for (let i = 0; i < 6 && k > MIN_FIT && el.scrollHeight > el.clientHeight + 1; i++) {
    k = Math.max(MIN_FIT, k * Math.min(0.97, el.clientHeight / el.scrollHeight));
    el.style.fontSize = `${k}em`;
  }
  el._fitH = el.clientHeight;
  el._fitW = el.clientWidth;
}

function focusables() {
  if (!current) return [];
  const root = screens[current];
  return [...root.querySelectorAll('button:not([disabled]), .set-row')].filter((el) => el.offsetParent !== null);
}

function applyFocus() {
  const items = focusables();
  if (!current) return;
  screens[current].querySelectorAll('.focus').forEach((el) => el.classList.remove('focus'));
  if (!items.length) return;
  focusIdx = ((focusIdx % items.length) + items.length) % items.length;
  items[focusIdx].classList.add('focus');
  items[focusIdx].scrollIntoView({ block: 'nearest' });
}

function move(d) {
  focusIdx += d;
  applyFocus();
  sfx.ui();
}

function nudge(range, dir) {
  range.value = Math.max(0, Math.min(100, Number(range.value) + dir * 10));
  range.dispatchEvent(new Event('input'));
}
