// Run details (pause menu → RUN DETAILS): everything this run has picked up, in three tabs that share one panel
// (TECH, STATS, LOADOUT). All tabs are rendered into the same grid cell and the inactive ones are only hidden, so the
// panel is always as tall as the tallest tab and switching tabs never moves the buttons. Every entry has a tooltip.

import { UPGRADES, ICONS, CAT_COLORS, pathOf, pathRanks, masteryTier, splashUsed, MASTERY, SPEC_MAX, SPLASH_CAP, modText } from '../game/upgrades.js';
import { TAGS, STATS, itemLines } from '../game/parts.js';
import { RARITY } from '../game/rarity.js';
import { CLASSES } from '../game/pilot.js';
import { sumMods, describe } from '../game/tree.js';
import { formatTime } from '../core/math.js';
import { tip } from './tips.js';
import { pathTip } from './screens.js';

const $ = (sel) => document.querySelector(sel);
const ROMAN = ['', 'I', 'II', 'III'];
export const RUN_TABS = ['tech', 'stats', 'loadout'];
let tab = 'tech';

// --- Stats --------------------------------------------------------------------------------------------------------
// [label, get(st, p), format, kind, what raises it]. kind: 'pct' (relative change), 'pts' (percentage points),
// 'n' (whole numbers), 'x' (multiplier), 's' (seconds, lower is better when `low`).
const pc = (v) => `${Math.round(v * 100)}%`;
const STAT_ROWS = [
  ['Damage', (s) => s.dmg, pc, 'pct', 'Plasma Core, Firepower gear and tunes'],
  ['Fire rate', (s) => s.rate, pc, 'pct', 'Overclock, Firepower gear and tunes'],
  ['Crit chance', (s) => s.crit, pc, 'pts', 'Targeting AI, Crit gear and tunes'],
  ['Crit damage', (s) => s.critMul, (v) => `x${v.toFixed(2)}`, 'x', 'Crit gear, abilities and mastery'],
  ['Pierce', (s) => s.pierce, (v) => `${v}`, 'n', 'Phase Rounds'],
  ['Module damage', (s) => s.modDmg, pc, 'pct', 'Modules gear, tunes and mastery'],
  ['Module rate', (s) => s.modRate, pc, 'pct', 'Modules gear and tunes'],
  ['Module slots', (s) => s.maxModules, (v) => `${v}`, 'n', 'Overflow, rare Modules gear'],
  ['Move speed', (s, p) => s.speed / p.ship.speed, pc, 'pct', 'Thrusters, Mobility gear and tunes'],
  ['Dashes', (s) => s.maxCharges, (v) => `${v}`, 'n', 'Afterburner'],
  ['Dash recharge', (s) => s.dashRecharge, (v) => `${v.toFixed(2)}s`, 's', 'Thrusters, Mobility gear (lower is better)', true],
  ['Max hull', (s) => s.maxHp, (v) => `${v}`, 'n', 'Reinforced Hull, Rest Stations, Tank gear'],
  ['Shield', (s) => s.shieldInterval, (v) => (v ? `${v.toFixed(1)}s` : 'OFF'), 's', 'Aegis Shield: recharge time (lower is better)', true],
  ['Ult charge', (s) => s.odGain, pc, 'pct', 'Capacitor, Overdrive gear and tunes'],
  ['Ult duration', (s) => s.odDur, (v) => `${v.toFixed(1)}s`, 's', 'Capacitor, Overdrive gear'],
  ['Graze radius', (s) => s.grazeR, pc, 'pct', 'Graze Field, Overdrive gear'],
  ['Pickup range', (s) => s.magnet / 80, pc, 'pct', 'Tractor Field, Greed gear'],
  ['XP gain', (s) => s.xpMul, pc, 'pct', 'Salvage Protocol, Greed gear'],
  ['Credits', (s) => s.creditMul, pc, 'pct', 'Prospector, Greed gear'],
  ['Rarity find', (s) => s.find || 0, (v) => `+${Math.round(v * 100)}%`, 'pts', 'Greed gear, tunes and mastery'],
  ['Boost tank', (s) => s.boostCap, pc, 'pct', 'Boost Tank, Mobility gear'],
  ['Boost refill', (s) => s.boostRegen, pc, 'pct', 'Ram Scoop, Mobility gear'],
];

function delta(a, b, kind, low) {
  if (Math.abs(b - a) < 1e-6) return ['', '–'];
  const better = low ? b < a || (a === 0 && b > 0) : b > a; // a shield going from OFF to on is better
  const sg = b > a ? '+' : '-';
  const d = Math.abs(b - a);
  let t;
  if (kind === 'pct') t = a ? `${sg}${Math.round((d / a) * 100)}%` : `${sg}${Math.round(d * 100)}%`;
  else if (kind === 'pts') t = `${sg}${Math.round(d * 100)}%`;
  else if (kind === 'x') t = `${sg}${d.toFixed(2)}x`;
  else if (kind === 's') t = a === 0 || b === 0 ? (b ? 'NEW' : 'LOST') : `${sg}${d.toFixed(d < 1 ? 2 : 1)}s`;
  else t = `${sg}${+d.toFixed(2)}`;
  return [better ? 'up' : 'dn', t];
}

function statsTab(p) {
  const s0 = p.st0 || p.st;
  let cells = '';
  for (const [label, get, f, kind, src, low] of STAT_ROWS) {
    const a = get(s0, p);
    const b = get(p.st, p);
    const [cls, d] = delta(a, b, kind, low);
    const body = [`At launch ${f(a)} · now ${f(b)}`, `From: ${src}`];
    cells += `<button class="rd-stat"${tip(label.toUpperCase(), body)}><span>${label}</span><b>${f(b)}</b><em class="${cls}">${d}</em></button>`;
  }
  return `<div class="rd-note">NOW · CHANGE SINCE LAUNCH</div><div class="rd-stats">${cells}</div>`;
}

// --- Tech -------------------------------------------------------------------------------------------------------------
function pathLine(p) {
  const ranks = pathRanks(p);
  const spec = p.spec || [];
  const list = Object.keys(ranks).filter((t) => ranks[t] > 0 || spec.includes(t)).sort((a, b) => (spec.includes(b) - spec.includes(a)) || ranks[b] - ranks[a]);
  let html = list.map((t) => {
    const on = spec.includes(t);
    const tier = on ? masteryTier(ranks[t]) : 0;
    return `<button class="pchip${on ? ' spec' : ''}" style="--t:${TAGS[t].color}"${tip(TAGS[t].name, pathTip(p, t, ranks), TAGS[t].color)}>${on ? '◆ ' : ''}${TAGS[t].name} ${ranks[t]}${tier ? ` · ${ROMAN[tier]}` : ''}</button>`;
  }).join('');
  if (spec.length >= SPEC_MAX) html += `<span class="pdim">SPLASH ${Math.min(SPLASH_CAP, splashUsed(p, ranks))}/${SPLASH_CAP}</span>`;
  return `<div class="rd-paths">${html || '<span class="pdim">No build paths yet</span>'}</div>`;
}

function techTab(p) {
  let rows = '';
  for (const u of UPGRADES) {
    const lv = p.up[u.id] || 0;
    if (!lv) continue;
    const evo = u.cat === 'evolution';
    const c = CAT_COLORS[u.cat];
    const path = pathOf(u.id);
    const desc = u.desc(u.cat === 'module' ? 1 : lv);
    const body = [desc, evo ? `Evolution of ${UPGRADES.find((x) => x.id === u.mod).name}.` : `Level ${lv} of ${u.max}${lv >= u.max ? ' (max)' : ''}.`, path && u.cat !== 'weapon' ? `Path: ${TAGS[path].name}` : ''];
    const lvTxt = evo ? 'EVO' : `${lv}/${u.max}`;
    rows += `<button class="rd-item${evo ? ' evo' : ''}${lv >= u.max && !evo ? ' max' : ''}" style="--c:${c}"${tip(u.name, body, c)}><span class="rd-ico">${ICONS[u.id]}</span><span class="rd-name">${u.name}</span><b>${lvTxt}</b></button>`;
  }
  return pathLine(p) + `<div class="rd-items">${rows}</div>`;
}

// --- Loadout ------------------------------------------------------------------------------------------------------
function loadoutTab(G) {
  const p = G.player;
  const cls = CLASSES.find((c) => c.id === p.cls) || CLASSES[0];
  const chip = (c, icon, t) => `<button class="chip" style="--c:${c}"${t}>${icon}</button>`;
  const row = (label, inner) => `<div class="rd-row"><span class="rd-lab">${label}</span><div class="rd-chips">${inner}</div></div>`;

  const ship = p.ship;
  const shipTip = tip(ship.name, [ship.desc, ship.trait ? ship.trait.text : '', ship.path ? `Path: ${TAGS[ship.path].name}` : ''], ship.color);
  let html = row('SHIP', `<button class="rd-tag" style="--c:${p.color || ship.color}"${shipTip}>${ship.name}<em>${ship.role}</em></button>`);

  let pilot = chip(cls.color, cls.icon, tip(`${cls.name} · ${cls.role}`, [cls.desc, `Ultimate: ${cls.ult.name}. ${cls.ult.desc}`], cls.color));
  for (const id of p.passives || []) {
    const ps = cls.passives.find((x) => x.id === id);
    if (ps) pilot += chip(RARITY[ps.r].color, ps.icon, tip(ps.name, [ps.desc, `${RARITY[ps.r].name} ability`], RARITY[ps.r].color));
  }
  html += row('PILOT', pilot);

  const gear = (p.parts || []).map((pt) => chip(RARITY[pt.r].color, pt.icon, tip(pt.name, [`${RARITY[pt.r].name} · IL ${pt.item.il}`, ...itemLines(pt.item).map((l) => l.text)], RARITY[pt.r].color))).join('');
  html += row('GEAR', gear || '<span class="pdim">None equipped</span>');

  const tree = p.tree && p.tree.length ? describe(sumMods(p.cls, p.tree)).replace(/\.$/, '').split('. ') : [];
  html += row('TREE', p.tree && p.tree.length
    ? `<button class="rd-tag" style="--c:${cls.color}"${tip('PASSIVE TREE', [`${p.tree.length} nodes allocated`, ...tree])}>${p.tree.length} NODES</button>`
    : '<span class="pdim">No nodes allocated</span>');

  // Run bonuses: rare-card modifiers and level-up tunes, summed per stat, plus mastery.
  const sums = new Map();
  for (const [stat, v] of p.runMods || []) sums.set(stat, (sums.get(stat) || 0) + v);
  const bonus = [...sums].filter(([stat]) => STATS[stat]).map(([stat, v]) => `<span class="rd-mod">${modText([stat, v])}</span>`);
  const ranks = pathRanks(p);
  for (const t of p.spec || []) {
    const tier = masteryTier(ranks[t]);
    if (!tier) continue;
    const [stat, v] = MASTERY[t];
    bonus.push(`<span class="rd-mod" style="--t:${TAGS[t].color}">${TAGS[t].name} ${ROMAN[tier]}: ${modText([stat, v * tier])}</span>`);
  }
  html += `<div class="rd-row bonus"><span class="rd-lab">BONUSES</span><div class="rd-mods">${bonus.join('') || '<span class="pdim">Rare cards and tunes add bonuses here</span>'}</div></div>`;

  const run = G.run || {};
  html += `<div class="run-stats rd-run"><div>FORTUNE<b>${G.fortune || 0}</b></div><div>REROLLS<b>${G.rerolls || 0}</b></div><div>CREDITS<b class="gold">${run.wallet || 0}</b></div></div>`;
  return html;
}

export function renderRunDetails(G) {
  const p = G.player;
  $('#run-sub').textContent = `SECTOR ${G.sector} · LEVEL ${p.level} · ${formatTime(G.runTime)}`;
  $('#run-tab-tech').innerHTML = techTab(p);
  $('#run-tab-stats').innerHTML = statsTab(p);
  $('#run-tab-loadout').innerHTML = loadoutTab(G);
  setRunTab(tab);
}

export function setRunTab(name) {
  tab = RUN_TABS.includes(name) ? name : 'tech';
  document.querySelectorAll('#scr-run [data-tab]').forEach((el) => {
    const on = el.dataset.tab === tab;
    el.classList.toggle('on', on);
    if (el.classList.contains('rd-tab')) el.classList.toggle('tab-off', !on);
  });
}
