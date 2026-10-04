// DOM menus: screen switching, keyboard/gamepad navigation, draft cards, results.

import { input } from '../core/input.js';
import { profile, saveProfile } from '../core/storage.js';
import { sfx } from '../core/audio.js';
import { cardInfo, CAT_COLORS, UPGRADES, ICONS, RARITY, pathRanks, splashUsed, SPEC_AT, SPEC_MAX, SPLASH_CAP, MASTERY, MASTERY_AT, masteryTier, modText } from '../game/upgrades.js';
import { TAGS } from '../game/parts.js';
import { formatScore, formatTime } from '../core/math.js';
import { SYSTEMS } from '../game/campaign.js';
import { tip, initTips, hideTip } from './tips.js';

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
  const keys = input.device === 'keyboard' ? '  [R] · LOCK [F]' : input.device === 'pad' ? ' · LOCK [X]' : '';
  const rr = $('#reroll-btn');
  rr.textContent = `${locks.size ? 'REROLL UNLOCKED' : 'REROLL'} (${rerolls})${keys}`;
  rr.disabled = rerolls <= 0 || n <= 0;
}

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
    this.initSettings();
    initTips();
  },

  show(name, { lock = 0, focus = 0, guard = false } = {}) {
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
    if (name) fit(screens[name], same);
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
    if (el && el._keys) el._keys(); // a focused widget with its own arrow handling (tree view); it re-queues what it skips
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
      if (input.consume('lock')) {
        const card = screens.draft.querySelector('.card.focus');
        if (card && draftLock && draftLock(+card.dataset.i)) syncLocks(lastLocks, lastRerolls);
      }
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
    $('#draft-sub').textContent = note ? `${T[2]} · ${note}` : T[2];
    renderPaths($('#draft-paths'), player, fx);
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
        ? `<div class="card-rar"><b>${RARITY[info.r].name}</b>${info.levels > 1 ? `<span>+${info.levels} LEVELS</span>` : ''}${pn}</div><div class="card-mods">${info.mods.map((m) => `<i>${m}</i>`).join('')}</div>`
        : pn ? `<div class="card-rar plain">${pn}</div>` : '';
      const flag = fresh ? `<span class="card-flag disc">${STAR}NEW DISCOVERY</span>` : runNew ? '<span class="card-flag run">NEW THIS RUN</span>' : '';
      b.innerHTML = `${flag}<div class="card-icon">${info.icon}</div><div><div class="card-top"><span class="card-name">${info.name}</span><span class="card-tag">${tag}</span></div><div class="card-desc">${info.desc}</div>${rar}${pips ? `<div class="pips">${pips}</div>` : ''}</div>${input.device === 'touch' ? '' : `<kbd>${i + 1}</kbd>`}<span class="card-lock" title="Lock: keep this card through a reroll">${LOCK_SVG}</span><span class="card-sel"></span>`;
      b.querySelector('.card-lock').addEventListener('click', (e) => {
        e.stopPropagation();
        if (onLock && onLock(i)) syncLocks(locks, rerolls);
      });
      b.addEventListener('click', () => {
        if (performance.now() < lockUntil) return;
        sfx.select();
        onPick(id);
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

function fit(el, keep = false) {
  if (keep && el._pinned && el.scrollHeight <= el.clientHeight + 1) return;
  el.style.fontSize = '';
  el.style.justifyContent = '';
  el.style.paddingTop = '';
  let k = 1;
  for (let i = 0; i < 6 && k > MIN_FIT && el.scrollHeight > el.clientHeight + 1; i++) {
    k = Math.max(MIN_FIT, k * Math.min(0.97, el.clientHeight / el.scrollHeight));
    el.style.fontSize = `${k}em`;
  }
  pin(el);
  // Pinning can add a pixel or two of padding to a screen that only just fit: shrink a hair more so it can't scroll.
  if (el.scrollHeight > el.clientHeight && k < 1 && k > MIN_FIT) {
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
  return [...root.querySelectorAll('button:not([disabled]), .set-row')].filter((el) => el.offsetParent !== null && !el.closest('.tab-off'));
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

function move(d) {
  focusIdx += d;
  applyFocus();
  sfx.ui();
}

function nudge(range, dir) {
  range.value = Math.max(0, Math.min(100, Number(range.value) + dir * 10));
  range.dispatchEvent(new Event('input'));
}
