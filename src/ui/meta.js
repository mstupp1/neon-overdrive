// Campaign-layer screens: campaign map, in-run route, route stop (placeholder), extraction.
// Render-only; flow/handlers live in main.js. Shared helpers come from screens.js.

import { profile } from '../core/storage.js';
import { formatScore, formatTime } from '../core/math.js';
import { $, stat, renderBuild } from './screens.js';
import { SYSTEMS, NODE_TYPES, systemUnlocked, reachableNodes, routeNode } from '../game/campaign.js';
import { MODIFIERS } from '../game/modifiers.js';
import { bossById } from '../game/bosses.js';
import { rankFor, ECON_ICONS } from '../game/economy.js';
import { CAT_COLORS } from '../game/upgrades.js';
import { SLOT_INFO } from '../game/parts.js';

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const NODE_ICONS = {
  combat: svg('<circle cx="12" cy="12" r="6"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>'),
  elite: svg('<path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.4l6-.8z"/>'),
  market: svg('<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 016 0"/>'),
  dock: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>'),
  anomaly: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 115 0c0 1.8-2.5 2-2.5 3.5M12 17v.5"/>'),
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
  // Builds the system map. Returns the element to focus (the selected system).
  renderCampaign(sel, shipName) {
    const map = $('#sys-map');
    let lines = '';
    for (let i = 0; i < SYSTEMS.length - 1; i++) {
      const open = systemUnlocked(SYSTEMS[i + 1], profile);
      lines += `<line x1="${MAP_X[i]}" y1="${mapY(i)}" x2="${MAP_X[i + 1]}" y2="${mapY(i + 1)}" class="${open ? 'open' : ''}" style="stroke:${hsl(SYSTEMS[i + 1].hue)}"/>`;
    }
    let btns = '';
    SYSTEMS.forEach((s, i) => {
      const open = systemUnlocked(s, profile);
      const done = profile.campaign.cleared.includes(s.id);
      const sub = !open ? 'LOCKED' : done ? 'CLEARED' : `ACT ${s.act} · ${bossById(s.boss).name}`;
      btns += `<button class="sys${done ? ' done' : ''}${open ? '' : ' locked'}" data-act="sys" data-i="${i}" ${open ? '' : 'disabled'} style="--c:${hsl(s.hue)};left:${MAP_X[i]}%;top:${mapY(i)}%"><span class="sys-orb">${!open ? NODE_ICONS.lock : done ? NODE_ICONS.check : s.act}</span><span class="sys-txt"><b>${s.name}</b><i>${sub}</i></span></button>`;
    });
    map.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>${btns}`;
    const rk = rankFor(profile.rankXp);
    $('#camp-pilot').innerHTML = `<span class="gold">${coin}${fmt(profile.credits)}</span><span class="rank">RANK <b>${rk.rank}</b></span><span class="rankbar"><i style="width:${rk.need ? Math.round((100 * rk.into) / rk.need) : 100}%"></i></span><span class="rank">${shipName}</span>`;
    return this.selectSystem(sel);
  },

  // Highlights system `i` and fills the detail panel. Returns the LAUNCH button.
  selectSystem(i) {
    const s = SYSTEMS[i];
    document.querySelectorAll('#sys-map .sys').forEach((b) => b.classList.toggle('sel', +b.dataset.i === i));
    const boss = bossById(s.boss);
    $('#sys-detail').style.setProperty('--c', hsl(s.hue));
    $('#sys-detail').innerHTML = `<h4>${s.name}</h4><p>${s.blurb}</p><div class="sys-meta"><span>${s.rows + 1} SECTORS</span><span>BOSS · ${boss.name}</span></div>`;
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
    $('#route-title').textContent = sys.name;
    $('#route-title').style.textShadow = `0 0 0.35em ${hsl(sys.hue)}, 0 0 1.2em ${hsl(sys.hue, 55)}`;
    $('#route-stats').innerHTML = stat('HULL', `${p.hp}/${p.maxHp}`) + stat('LEVEL', p.level) + stat('CREDITS', `<span class="gold">${fmt(run.wallet || 0)}</span>`) + stat('ROUTE', `${visited.size}/${total}`);
    $('#route-gear').innerHTML = (p.parts || []).map((pt) => `<div class="chip" style="--c:${SLOT_INFO[pt.slot].color}" title="${pt.name}">${pt.icon}</div>`).join('');
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
      btns += `<button class="rnode t-${n.type}${state}" data-act="node" data-id="${n.id}" ${can ? '' : 'disabled'} style="--c:${info.color};left:${px(n)}%;top:${py(n)}%" aria-label="${info.name}"><span class="rn-ico">${visited.has(n.id) && n.id !== run.nodeId ? NODE_ICONS.check : NODE_ICONS[n.type]}</span><span class="rn-lab">${info.name}${mod ? `<em style="--c:${mod.color}">${mod.name}</em>` : ''}</span></button>`;
    }
    $('#route-map').innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>${btns}`;
    $('#route-hint').textContent = `${total - visited.size === 1 ? 'FINAL SECTOR' : `${total - visited.size} SECTORS TO THE BOSS`} · CHOOSE YOUR NEXT JUMP`;
    return document.querySelector('#route-map .rnode.reach');
  },

  // --- Route stop placeholder (market / dock / anomaly; replaced in later steps) ---
  renderNode(node) {
    const info = NODE_TYPES[node.type];
    $('#node-icon').innerHTML = NODE_ICONS[node.type];
    $('#node-icon').style.setProperty('--c', info.color);
    $('#node-title').textContent = { market: 'BLACK MARKET', dock: 'REPAIR DOCK', anomaly: 'ANOMALY' }[node.type] || info.name;
    $('#node-sub').textContent = 'Systems offline';
    $('#node-body').textContent = 'Nothing here yet. Continue along the route.';
  },

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
      b.className = 'card offer' + (o.sold ? ' sold' : '');
      b.dataset.act = 'buy';
      b.dataset.i = i;
      b.style.setProperty('--c', CAT_COLORS[o.cat] || '#ffd24a');
      const dis = o.sold || !!o.blocked || w < o.price;
      b.disabled = dis;
      const status = o.sold ? 'SOLD' : o.blocked || (w < o.price ? 'NEED ' + (o.price - w) : '');
      b.innerHTML = `<div class="card-icon">${o.icon}</div><div><div class="card-top"><span class="card-name">${o.name}</span><span class="card-tag">${o.tag}</span></div><div class="card-desc">${o.desc}</div></div><div class="price${dis ? ' dim' : ''}"><span>${o.sold ? '' : coin}<b>${o.sold ? 'SOLD' : o.price}</b></span>${status && !o.sold ? `<i>${status}</i>` : ''}</div>`;
      wrap.appendChild(b);
    });
    renderBuild($('#market-build'), G.player);
  },

  // --- Repair dock -----------------------------------------------------------------
  renderDock(p) {
    $('#dock-hull').textContent = `HULL ${p.hp}/${p.maxHp}`;
    const full = p.hp >= p.maxHp;
    $('#dock-repair').innerHTML = `<div class="card-icon">${ECON_ICONS.repairFull}</div><div><div class="card-top"><span class="card-name">Full Repair</span><span class="card-tag">HEAL</span></div><div class="card-desc">${full ? 'Hull is already full.' : `Restore hull to ${p.maxHp}/${p.maxHp}.`}</div></div>`;
    $('#dock-reinforce').innerHTML = `<div class="card-icon">${ECON_ICONS.reinforce}</div><div><div class="card-top"><span class="card-name">Hull Reinforcement</span><span class="card-tag">+1 MAX</span></div><div class="card-desc">+1 max hull for this run. No repair.</div></div>`;
  },

  // --- Rewards block (extraction + game over) -------------------------------------
  renderRewards(el, rw, campaignDeath) {
    const bar = (rk) => `<span class="rankbar big"><i style="width:${rk.need ? Math.round((100 * rk.into) / rk.need) : 100}%"></i></span>`;
    const rk = rw.rankAfter;
    el.innerHTML = `
      <div class="rw-grid">
        <div>EARNED<b class="gold">${coin}${fmt(rw.earned)}</b></div>
        <div>${rw.spent > 0 ? `SPENT<b>${fmt(rw.spent)}</b>` : 'WALLET<b>' + fmt(rw.wallet) + '</b>'}</div>
        <div>BANKED<b class="gold">${coin}${fmt(rw.banked)}</b></div>
      </div>
      ${campaignDeath ? `<p class="rw-note">${Math.round(rw.pct * 100)}% SALVAGED${rw.wallet ? ` · ${fmt(rw.wallet - rw.banked)} LOST` : ''}</p>` : ''}
      <div class="rw-total">PROFILE ${coin}<b>${fmt(rw.total)}</b></div>
      <div class="rw-rank">
        <span>RANK <b>${rk.rank}</b></span>${bar(rk)}<span class="rw-xp">+${fmt(rw.rankXp)} XP</span>
      </div>
      ${rw.rankUp ? `<div class="rankup">RANK UP → ${rk.rank}</div>` : ''}`;
    el.hidden = false;
  },

  // --- Extraction -------------------------------------------------------------
  renderExtract(sum) {
    $('#extract-title').textContent = 'SYSTEM SECURED';
    $('#extract-sub').textContent = `${sum.system.name} · EXTRACTION COMPLETE`;
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
