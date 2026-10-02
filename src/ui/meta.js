// Campaign-layer screens: campaign map, in-run route, anomaly event, market, dock, extraction.
// Render-only; flow/handlers live in main.js. Shared helpers come from screens.js.

import { RARITY as GEAR_RARITY } from '../game/rarity.js';
import { itemName } from '../game/parts.js';
import { profile } from '../core/storage.js';
import { formatScore, formatTime } from '../core/math.js';
import { $, stat, renderBuild } from './screens.js';
import { SYSTEMS, NODE_TYPES, REWARDS, reachableNodes, routeNode } from '../game/campaign.js';
import { MODIFIERS } from '../game/modifiers.js';
import { heatScale } from '../game/core.js';
import { bossById } from '../game/bosses.js';
import { rankFor, ECON_ICONS } from '../game/economy.js';
import { CAT_COLORS, ICONS } from '../game/upgrades.js';
import { SLOT_INFO } from '../game/parts.js';
import { CLASSES, activeClass } from '../game/pilot.js';
import { choiceBlocked } from '../game/story.js';

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const NODE_ICONS = {
  combat: svg('<circle cx="12" cy="12" r="6"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>'),
  elite: svg('<path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.4l6-.8z"/>'),
  market: svg('<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 016 0"/>'),
  dock: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>'),
  anomaly: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 115 0c0 1.8-2.5 2-2.5 3.5M12 17v.5"/>'),
  vault: svg('<rect x="3" y="6" width="18" height="14" rx="1"/><path d="M3 11h18M10 11v3h4v-3"/>'),
  rift: svg('<path d="M12 2l-3 7 4 2-5 11"/><path d="M15 4l-2 5M7 15l-3 4"/>'),
  boss: svg('<path d="M12 3l9 5-2 12H5L3 8z"/><path d="M9 11v2M15 11v2M10 17h4"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7"/>'),
};

const coin = '<svg class="coin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l3.5 4.5-3.5 4.5-3.5-4.5z"/></svg>';
const fmt = (n) => Math.floor(n).toLocaleString();
const hsl = (h, l = 62) => `hsl(${h},100%,${l}%)`;

// --- Campaign map ---------------------------------------------------------------

const MAP_X = [34, 66, 34, 66];
const mapY = (i) => 87.5 - i * 25; // act 1 at the bottom

export const meta = {
  // The run's four systems as a progress track (furthest point any run reached), plus the run rules. Returns LAUNCH.
  renderCampaign(shipName) {
    const map = $('#sys-map');
    const c = profile.campaign;
    const reached = (i) => i <= c.bestSys || i === 0;
    let lines = '';
    for (let i = 0; i < SYSTEMS.length - 1; i++) {
      lines += `<line x1="${MAP_X[i]}" y1="${mapY(i)}" x2="${MAP_X[i + 1]}" y2="${mapY(i + 1)}" class="${reached(i + 1) ? 'open' : ''}" style="stroke:${hsl(SYSTEMS[i + 1].hue)}"/>`;
    }
    let nodes = '';
    SYSTEMS.forEach((s, i) => {
      const done = c.cleared.includes(s.id);
      const seen = reached(i);
      const sub = done ? 'CLEARED' : i === c.bestSys ? `BEST · SECTOR ${c.bestRow + 1}` : seen ? `ACT ${s.act} · ${bossById(s.boss).name}` : 'UNCHARTED';
      nodes += `<div class="sys${done ? ' done' : ''}${seen ? '' : ' locked'}${i === Math.max(0, c.bestSys) ? ' sel' : ''}" style="--c:${hsl(s.hue)};left:${MAP_X[i]}%;top:${mapY(i)}%"><span class="sys-orb">${done ? NODE_ICONS.check : seen ? s.act : NODE_ICONS.lock}</span><span class="sys-txt"><b>${s.name}</b><i>${sub}</i></span></div>`;
    });
    map.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>${nodes}`;
    const rk = rankFor(profile.rankXp);
    $('#camp-pilot').innerHTML = `<span class="gold">${coin}${fmt(profile.credits)}</span><span class="rank">RANK <b>${rk.rank}</b></span><span class="rankbar"><i style="width:${rk.need ? Math.round((100 * rk.into) / rk.need) : 100}%"></i></span><span class="rank">${shipName}</span><span class="rank cls" style="--c:${activeClass().color}">${activeClass().name}</span>`;
    const best = c.bestSys < 0 ? 'NO RUNS YET' : profile.bestDeep ? `BEST · DEEP GRID ${profile.bestDeep}` : c.cleared.length >= SYSTEMS.length ? 'ALL SYSTEMS CLEARED' : `BEST · ${SYSTEMS[c.bestSys].short} SECTOR ${c.bestRow + 1}`;
    const t = profile.tier;
    const k = heatScale(t, 0);
    const heat = t ? `<span style="color:#ff4d6d">OVERDRIVE ${t} · ENEMY HP ×${k.hp.toFixed(1)} · REWARDS +${Math.round((k.reward - 1) * 100)}% · FLUX</span>` : '';
    $('#sys-detail').style.setProperty('--c', hsl(SYSTEMS[0].hue));
    $('#sys-detail').innerHTML = `<div class="sys-meta"><span>${best}</span>${heat}</div><button class="info-btn" data-act="runInfo" aria-label="How a run works" title="How a run works">?</button>`;
    $('#run-info').hidden = profile.seenRunInfo;
    const tb = $('#tier-btn');
    tb.textContent = profile.tierMax ? `OVERDRIVE ${t}` : 'OVERDRIVE';
    tb.disabled = !profile.tierMax;
    $('#core-btn').innerHTML = `FLUX CORE${profile.flux ? ` · ${fmt(profile.flux)}` : ''}`;
    return $('#launch-btn');
  },

  // --- Route ------------------------------------------------------------------
  renderRoute(G) {
    const run = G.run;
    const route = run.route;
    const sys = run.system;
    const p = G.player;
    const total = route.rows.length;
    const reach = reachableNodes(route, run.nodeId);
    const reachIds = new Set(reach.map((n) => n.id));
    const visited = new Set(run.visited);
    $('#route-leave').textContent = run.victory ? 'EXTRACT · BANK ALL' : 'ABANDON RUN';
    $('#route-title').textContent = run.deep ? `DEEP ${run.deep} · ${sys.short}` : sys.name;
    $('#route-title').style.textShadow = `0 0 0.35em ${hsl(sys.hue)}, 0 0 1.2em ${hsl(sys.hue, 55)}`;
    $('#route-stats').innerHTML = stat('HULL', `${p.hp}/${p.maxHp}`) + stat('LEVEL', p.level) + stat('CREDITS', `<span class="gold">${fmt(run.wallet || 0)}</span>`) + stat('ROUTE', `${visited.size}/${total}`) + (run.tier || run.deep ? stat('FLUX', `<span class="flux">${fmt(run.flux || 0)}</span>`) : '');
    const cls = CLASSES.find((c) => c.id === p.cls) || CLASSES[0];
    $('#route-gear').innerHTML =
      `<div class="chip cls" style="--c:${cls.color}" title="${cls.name}">${cls.icon}</div>` +
      (p.passives || []).map((id) => cls.passives.find((x) => x.id === id)).filter(Boolean).map((ps) => `<div class="chip" style="--c:${cls.color}" title="${ps.name}">${ps.icon}</div>`).join('') +
      (p.parts || []).map((pt) => `<div class="chip" style="--c:${GEAR_RARITY[pt.r].color}" title="${pt.name}">${pt.icon}</div>`).join('');
    const px = (n) => 12 + n.x * 76;
    const py = (n) => 90 - (n.row / (total - 1)) * 84;
    let lines = '';
    for (const n of route.nodes) {
      for (const id of n.links) {
        const t = routeNode(route, id);
        const cls = visited.has(n.id) && visited.has(t.id) ? 'trav' : n.id === run.nodeId && reachIds.has(t.id) ? 'open' : '';
        lines += `<line x1="${px(n)}" y1="${py(n)}" x2="${px(t)}" y2="${py(t)}" class="${cls}"/>`;
      }
    }
    let btns = '';
    for (const n of route.nodes) {
      const info = NODE_TYPES[n.type];
      const can = reachIds.has(n.id);
      const state = n.id === run.nodeId ? ' cur' : visited.has(n.id) ? ' done' : can ? ' reach' : '';
      const mod = n.modifiers[0] ? MODIFIERS[n.modifiers[0]] : null;
      const rw = n.reward && !visited.has(n.id) ? REWARDS[n.reward] : null;
      btns += `<button class="rnode t-${n.type}${state}" data-act="node" data-id="${n.id}" ${can ? '' : 'disabled'} style="--c:${info.color};left:${px(n)}%;top:${py(n)}%" aria-label="${info.name}"><span class="rn-ico">${visited.has(n.id) && n.id !== run.nodeId ? NODE_ICONS.check : NODE_ICONS[n.type]}</span>${rw ? `<span class="rn-rw" style="--r:${rw.color}"></span>` : ''}<span class="rn-lab">${info.name}${rw ? `<em style="--c:${rw.color}">${rw.name}</em>` : ''}${mod ? `<em style="--c:${mod.color}">${mod.name}</em>` : ''}</span></button>`;
    }
    $('#route-map').innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>${btns}`;
    const nextRow = run.row + 1;
    $('#route-hint').textContent = `${nextRow >= total - 1 ? 'BOSS SECTOR' : `SECTOR ${nextRow + 1} · ${total - 1 - nextRow} TO THE BOSS`} · CHOOSE YOUR NEXT JUMP`;
    return document.querySelector('#route-map .rnode.reach');
  },

  // --- Anomaly event ---------------------------------------------------------------
  // s = story.startEvent() session. Choices render as cards; renderEventResult swaps them for the outcome.
  renderEvent(s, G) {
    const ev = s.ev;
    const box = $('#scr-event');
    box.style.setProperty('--c', ev.color);
    $('#event-icon').innerHTML = NODE_ICONS[ev.id === 'rift' ? 'rift' : 'anomaly'];
    $('#event-icon').style.setProperty('--c', ev.color);
    $('#event-title').textContent = ev.title;
    $('#event-text').textContent = ev.text;
    const wrap = $('#event-choices');
    wrap.hidden = false;
    wrap.innerHTML = '';
    s.choices.forEach((c, i) => {
      const why = choiceBlocked(s, i);
      const b = document.createElement('button');
      b.className = 'card choice' + (c.tag === 'RISKY' ? ' risky' : c.tag === 'SAFE' ? ' safe' : '') + (c.fresh ? ' fresh' : '');
      b.dataset.act = 'event';
      b.dataset.i = i;
      b.style.setProperty('--c', c.tag === 'RISKY' ? '#ff3df2' : c.tag === 'SAFE' ? '#7dff6b' : ev.color);
      b.disabled = !!why;
      b.innerHTML = `<div><div class="card-top"><span class="card-name">${c.label}</span>${c.tag ? `<span class="card-tag">${c.tag}</span>` : ''}</div><div class="card-desc">${c.desc}</div></div>${c.cost ? `<div class="price"><span>${coin}<b>${c.cost}</b></span>${why && why.startsWith('NEED') ? `<i>${why}</i>` : ''}</div>` : why ? `<div class="price"><i>${why}</i></div>` : ''}`;
      wrap.appendChild(b);
    });
    $('#event-result').hidden = true;
    $('#event-continue').hidden = true;
    this.eventStats(G);
  },

  eventStats(G) {
    const p = G.player;
    $('#event-stats').innerHTML = stat('HULL', `${p.hp}/${p.maxHp}`) + stat('CREDITS', `<span class="gold">${fmt(G.run.wallet || 0)}</span>`) + stat('REROLLS', G.rerolls);
  },

  renderEventResult(s, G) {
    $('#event-choices').hidden = true;
    const c = s.choices[s.picked];
    const r = $('#event-result');
    r.innerHTML = `<small>${c.label.toUpperCase()}</small>${s.result}`;
    r.hidden = false;
    $('#event-continue').hidden = false;
    this.eventStats(G);
  },

  // --- Route stop (market / dock live in their own screens; anomalies in scr-event) ---

  // --- Black Market ------------------------------------------------------------
  // first = play the card entrance animation; later re-renders (after a purchase) stay still.
  renderMarket(G, offers, first) {
    const w = G.run.wallet || 0;
    $('#market-wallet').innerHTML = `${coin}<b>${fmt(w)}</b>`;
    $('#market-hint').textContent = `${G.player.hp}/${G.player.maxHp} HULL · ${G.rerolls} REROLL${G.rerolls === 1 ? '' : 'S'}`;
    const wrap = $('#market-cards');
    wrap.classList.toggle('still', !first);
    wrap.innerHTML = '';
    offers.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'card offer' + (o.sold ? ' sold' : '') + (o.fresh && !o.sold ? ' fresh' : '');
      b.dataset.act = 'buy';
      b.dataset.i = i;
      b.style.setProperty('--c', CAT_COLORS[o.cat] || '#ffd24a');
      const cant = !o.sold && !o.blocked && w < o.price; // unaffordable: dimmed but still focusable
      const dis = o.sold || !!o.blocked || cant;
      b.disabled = o.sold || !!o.blocked;
      if (cant) b.setAttribute('aria-disabled', 'true');
      const status = o.sold ? 'SOLD' : o.blocked || (w < o.price ? 'NEED ' + (o.price - w) : '');
      b.innerHTML = `<div class="card-icon">${o.icon}</div><div><div class="card-top"><span class="card-name">${o.name}</span><span class="card-tag">${o.tag}</span></div><div class="card-desc">${o.desc}</div></div><div class="price${dis ? ' dim' : ''}"><span>${o.sold ? '' : coin}<b>${o.sold ? 'SOLD' : o.price}</b></span>${status && !o.sold ? `<i>${status}</i>` : ''}</div>`;
      wrap.appendChild(b);
    });
    renderBuild($('#market-build'), G.player);
  },

  // --- Repair dock -----------------------------------------------------------------
  // canBoost: there is an owned upgrade with a level left (else OVERCLOCK is disabled).
  renderDock(p, canBoost = true) {
    $('#dock-hull').textContent = `HULL ${p.hp}/${p.maxHp}`;
    const full = p.hp >= p.maxHp;
    $('#dock-repair').innerHTML = `<div class="card-icon">${ECON_ICONS.repairFull}</div><div><div class="card-top"><span class="card-name">Full Repair</span><span class="card-tag">HEAL</span></div><div class="card-desc">${full ? 'Hull is already full.' : `Restore hull to ${p.maxHp}/${p.maxHp}.`}</div></div>`;
    $('#dock-reinforce').innerHTML = `<div class="card-icon">${ECON_ICONS.reinforce}</div><div><div class="card-top"><span class="card-name">Hull Reinforcement</span><span class="card-tag">+1 MAX</span></div><div class="card-desc">+1 max hull for this run. No repair.</div></div>`;
    const oc = $('#dock-overclock');
    oc.disabled = !canBoost;
    oc.innerHTML = `<div class="card-icon">${ICONS.rate}</div><div><div class="card-top"><span class="card-name">Overclock</span><span class="card-tag">+1 LV</span></div><div class="card-desc">${canBoost ? 'Pick an upgrade you own and push it one level higher.' : 'Nothing left to overclock.'}</div></div>`;
  },

  // --- Rewards block (extraction + game over) -------------------------------------
  renderRewards(el, rw, campaignDeath) {
    const lootLine = (w) => {
      const loot = [...(w.loot || [])].sort((a, b) => b.r - a.r);
      const shown = loot.slice(0, 3).map((it) => `<b style="color:${GEAR_RARITY[it.r].color}">${itemName(it)}</b>`).join(' · ');
      const more = loot.length > 3 ? ` +${loot.length - 3}` : '';
      const found = (w.found || []).length ? `<span class="rw-found">FOUND ${w.found.join(' · ')}</span>` : '';
      return loot.length || found ? `<div class="rw-loot">${loot.length ? `<span>GEAR ${shown}${more}</span>` : ''}${found}</div>` : '';
    };
    const bar = (rk) => `<span class="rankbar big"><i style="width:${rk.need ? Math.round((100 * rk.into) / rk.need) : 100}%"></i></span>`;
    const rk = rw.rankAfter;
    el.innerHTML = `
      <div class="rw-grid">
        <div>EARNED<b class="gold">${coin}${fmt(rw.earned)}</b></div>
        <div>${rw.spent > 0 ? `SPENT<b>${fmt(rw.spent)}</b>` : 'WALLET<b>' + fmt(rw.wallet) + '</b>'}</div>
        <div>BANKED<b class="gold">${coin}${fmt(rw.banked)}</b></div>
      </div>
      ${campaignDeath ? `<p class="rw-note">${Math.round(rw.pct * 100)}% SALVAGED${rw.wallet ? ` · ${fmt(rw.wallet - rw.banked)} LOST` : ''}</p>` : ''}
      <div class="rw-total">PROFILE ${coin}<b>${fmt(rw.total)}</b>${rw.flux ? ` · <span class="flux">+${fmt(rw.flux)} FLUX</span>` : ''}</div>
      <div class="rw-rank">
        <span>RANK <b>${rk.rank}</b></span>${bar(rk)}<span class="rw-xp">+${fmt(rw.rankXp)} XP</span>
      </div>
      ${rw.rankUp ? `<div class="rankup">RANK UP → ${rk.rank}</div>` : ''}
      ${lootLine(rw)}`;
    el.hidden = false;
  },

  // --- Extraction -------------------------------------------------------------
  renderExtract(sum) {
    $('#extract-title').textContent = sum.deep ? 'EXTRACTED' : sum.final ? 'SIGNAL SILENCED' : 'SYSTEM SECURED';
    $('#extract-sub').textContent = sum.deep ? `DEEP GRID ${sum.deep} · ${sum.system.name}${sum.tier ? ` · OVERDRIVE ${sum.tier}` : ''}` : sum.final ? `${sum.system.name} · THE GRID IS FREE` : `${sum.system.name} · EXTRACTION COMPLETE`;
    $('#extract-score').textContent = formatScore(sum.score);
    $('#extract-stats').innerHTML =
      stat('TIME', formatTime(sum.time)) + stat('LEVEL', sum.level) + stat('KILLS', sum.kills) +
      stat('SECTORS', sum.sectors) + stat('BEST CHAIN', sum.maxCombo) + stat('GRAZES', sum.grazes);
    const un = $('#extract-unlock');
    un.hidden = !sum.unlocked.length;
    un.textContent = sum.unlocked.map((s) => `NEW SHIP UNLOCKED: ${s.name}`).join(' · ');
    this.renderRewards($('#extract-rewards'), sum.reward, false);
    renderBuild($('#extract-build'), sum.player);
  },
};
