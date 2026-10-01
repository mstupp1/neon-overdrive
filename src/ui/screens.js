// DOM menus: screen switching, keyboard/gamepad navigation, draft cards, results.

import { input } from '../core/input.js';
import { profile, saveProfile } from '../core/storage.js';
import { sfx } from '../core/audio.js';
import { SHIPS, isUnlocked } from '../game/ships.js';
import { S } from '../render/sprites.js';
import { cardInfo, CAT_COLORS, UPGRADES, ICONS } from '../game/upgrades.js';
import { formatScore, formatTime } from '../core/math.js';

export const $ = (sel) => document.querySelector(sel);

const screens = {};
let current = null;
let focusIdx = 0;
let lockUntil = 0;
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

  show(name, { lock = 0, focus = 0 } = {}) {
    for (const [k, el] of Object.entries(screens)) el.classList.toggle('active', k === name);
    current = name || null;
    focusIdx = typeof focus === 'number' ? focus : 0;
    lockUntil = performance.now() + lock;
    input.clear();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (focus instanceof Element) focusIdx = Math.max(0, focusables().indexOf(focus)); // focus a given element
    applyFocus();
  },

  hide() {
    this.show(null);
  },

  // Called every frame while a menu is open.
  update() {
    if (!current) return;
    const items = focusables();
    if (!items.length) return;
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
      ? `<div>BEST<b>${formatScore(profile.best)}</b></div><div>SECTOR<b>${profile.bestSector}</b></div><div>RUNS<b>${profile.runs}</b></div>`
      : '';
    $('#title-hint').textContent = input.isTouchDevice ? 'Tap PLAY to begin' : 'Enter / Space to select';
  },

  // --- Ships --------------------------------------------------------------------
  renderShips(onPick) {
    const list = $('#ship-list');
    list.innerHTML = '';
    let focus = 0;
    SHIPS.forEach((ship, i) => {
      const unlocked = isUnlocked(ship, profile);
      const b = document.createElement('button');
      b.className = 'ship' + (unlocked ? '' : ' locked');
      b.style.setProperty('--c', ship.color);
      const cv = document.createElement('canvas');
      cv.width = 112;
      cv.height = 112;
      const g = cv.getContext('2d');
      const spr = S['ship_' + ship.id];
      g.drawImage(spr.img, 0, 0, 112, 112);
      const specs = `HULL ${'♥'.repeat(ship.hp)} · DASH ${ship.dashes}`;
      b.innerHTML = `<div class="ship-art"></div><div><div class="role">${ship.role}</div><h4>${ship.name}</h4><p>${unlocked ? ship.desc : '🔒 ' + ship.unlock.text}</p>${unlocked ? `<div class="specs">${specs}</div>` : ''}</div>`;
      b.querySelector('.ship-art').appendChild(cv);
      b.addEventListener('click', () => {
        if (performance.now() < lockUntil) return;
        if (!unlocked) {
          sfx.ui();
          b.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 180 });
          return;
        }
        sfx.select();
        onPick(ship);
      });
      if (ship.id === profile.lastShip && unlocked) focus = i;
      list.appendChild(b);
    });
    return focus;
  },

  // --- Draft --------------------------------------------------------------------
  renderDraft(player, choices, kind, rerolls, onPick) {
    $('#draft-title').textContent = kind === 'sector' ? 'SECTOR CLEAR' : 'LEVEL UP';
    $('#draft-title').style.color = kind === 'sector' ? '#7dff6b' : '#fff';
    $('#draft-sub').textContent = kind === 'sector' ? 'Claim a reward for the next sector' : `Level ${player.level} — choose an upgrade`;
    const wrap = $('#draft-cards');
    wrap.innerHTML = '';
    wrap.classList.toggle('no-keys', input.device === 'touch');
    choices.forEach((id, i) => {
      const info = cardInfo(player, id);
      const c = CAT_COLORS[info.cat];
      const b = document.createElement('button');
      b.className = 'card';
      b.style.setProperty('--c', c);
      let pips = '';
      if (info.max) {
        for (let k = 0; k < info.max; k++) pips += `<i class="${k < info.lv ? 'on' : k === info.lv ? 'next' : ''}"></i>`;
      }
      const tag = info.max ? (info.lv === 0 ? 'NEW' : `LV ${info.lv + 1}`) : 'BONUS';
      b.innerHTML = `<div class="card-icon">${info.icon}</div><div><div class="card-top"><span class="card-name">${info.name}</span><span class="card-tag">${tag}</span></div><div class="card-desc">${info.desc}</div>${pips ? `<div class="pips">${pips}</div>` : ''}</div>${input.device === 'touch' ? '' : `<kbd>${i + 1}</kbd>`}`;
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
    html += `<div class="chip" style="--c:${CAT_COLORS[u.cat]}" title="${u.name}">${ICONS[u.id]}<b>${lv}</b></div>`;
  }
  el.innerHTML = html;
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
