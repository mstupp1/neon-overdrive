// Campaign-layer screens: campaign map, in-run route, route stop (placeholder), extraction.
// Render-only; flow/handlers live in main.js. Shared helpers come from screens.js.

import { profile } from '../core/storage.js';
import { formatScore, formatTime } from '../core/math.js';
import { $, stat, renderBuild } from './screens.js';
import { SYSTEMS, NODE_TYPES, systemUnlocked, reachableNodes, routeNode } from '../game/campaign.js';
import { MODIFIERS } from '../game/modifiers.js';
import { bossById } from '../game/bosses.js';

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
    $('#ship-btn').textContent = `SHIP: ${shipName}`;
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
    $('#route-stats').innerHTML = stat('HULL', `${p.hp}/${p.maxHp}`) + stat('LEVEL', p.level) + stat('ROUTE', `${visited.size}/${total}`);
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
    $('#extract-rewards').innerHTML = ''; // step 3: credits / rank XP banked on extraction
    renderBuild($('#extract-build'), sum.player);
  },
};
