// Campaign: star systems (acts), seeded branching routes, and node → sector specs.

import { MODIFIERS } from './modifiers.js';
import { mulberry32 } from '../core/math.js';

// level = difficulty at route row 0; each row adds `step` (boss row ≈ level + rows*step). dur = fighting sector seconds;
// bossHp multiplies the boss's base HP (campaign bosses are tuned per system, the debug sandbox keeps the base);
// supply = free upgrade drafts at system start (a fresh ship at row 0 of a late system would otherwise be hopelessly outgunned);
// warm = level eased off per row short of row 2 (default WARM).
// One run flies all four systems with one build, so levels form one continuous climb: Genesis opens like the old endless
// sector 1 and each system starts where the previous boss row left off, never above the old standalone levels. Boss HP stays
// at most as hard as when each system was flown alone (OMEGA x0.5, ECLIPSE x0.22 as before).
export const SYSTEMS = [
  {
    id: 'genesis', name: 'NEON GENESIS', short: 'GENESIS', act: 1, hue: 215, level: 1, step: 0.9, warm: 0, rows: 5, dur: 46, bossHp: 1.3, supply: 0, pay: 0.8, boss: 'warden',
    blurb: 'The Grid\'s outer lattice. A siege mech guards the gate.',
  },
  {
    id: 'crimson', name: 'CRIMSON TIDE', short: 'CRIMSON', act: 2, hue: 345, level: 5.8, step: 0.6, warm: 0, rows: 5, dur: 46, bossHp: 1, supply: 0, pay: 0.64, boss: 'hydra',
    blurb: 'Bio-corrupted sectors. Something huge is breeding in the dark.',
  },
  {
    id: 'cyclone', name: 'CYAN CYCLONE', short: 'CYCLONE', act: 3, hue: 185, level: 9.2, step: 0.6, warm: 0, rows: 6, dur: 46, bossHp: 0.5, supply: 0, pay: 0.68, boss: 'omega',
    blurb: 'Storm-lit data winds. The core intelligence waits at the eye.',
  },
  {
    id: 'void', name: 'THE VOID', short: 'VOID', act: 4, hue: 275, level: 10.2, step: 1.1, warm: 0, rows: 6, dur: 46, bossHp: 0.22, supply: 0, pay: 0.82, boss: 'eclipse',
    blurb: 'Beyond the Grid. The Signal\'s source. No one has returned.',
  },
];

const WARM = 0.9; // default `warm`

export const systemById = (id) => SYSTEMS.find((s) => s.id === id) || SYSTEMS[0];

export const NODE_TYPES = {
  combat: { name: 'COMBAT', color: '#3ff6ff' },
  elite: { name: 'ELITE', color: '#ff3df2' },
  market: { name: 'MARKET', color: '#ffd24a' },
  dock: { name: 'DOCK', color: '#7dff6b' },
  anomaly: { name: 'ANOMALY', color: '#b48bff' },
  boss: { name: 'BOSS', color: '#ff2e55' },
};

const MOD_IDS = Object.keys(MODIFIERS);

// route = { system, seed, rows: [[node]], nodes: [node] }; node = { id, row, col, x, type, modifiers, links[] }
export function generateRoute(system, seed) {
  const rnd = mulberry32(seed);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const rows = [];
  const nodes = [];
  const make = (row, col, n, type) => {
    const x = n === 1 ? 0.5 : n === 2 ? 0.3 + 0.4 * col : 0.15 + 0.35 * col;
    const node = { id: `r${row}c${col}`, row, col, x, type, modifiers: [], links: [] };
    nodes.push(node);
    return node;
  };
  const rollType = (row) => {
    const w = [['combat', 5], ['elite', row >= 2 ? 1.6 : 0], ['market', row >= 1 ? 1.1 : 0], ['dock', row >= 1 ? 1.1 : 0], ['anomaly', row >= 1 ? 1.1 : 0]];
    let r = rnd() * w.reduce((a, b) => a + b[1], 0);
    for (const [t, k] of w) if ((r -= k) <= 0 && k > 0) return t;
    return 'combat';
  };
  for (let r = 0; r < system.rows; r++) {
    const n = ri(2, 3);
    const row = [];
    for (let c = 0; c < n; c++) row.push(make(r, c, n, r === 0 ? 'combat' : rollType(r)));
    // Every row keeps at least one fighting node so the route can't be skipped wholesale.
    if (!row.some((nd) => nd.type === 'combat' || nd.type === 'elite')) row[ri(0, n - 1)].type = 'combat';
    rows.push(row);
  }
  // Guarantee a Market or Dock somewhere in rows 2..rows-1.
  const late = rows.slice(2).flat();
  if (!late.some((nd) => nd.type === 'market' || nd.type === 'dock')) {
    const fights = (row) => row.filter((nd) => nd.type === 'combat' || nd.type === 'elite').length;
    const cand = late.filter((nd) => !(nd.type === 'combat' || nd.type === 'elite') || fights(rows[nd.row]) >= 2);
    cand[ri(0, cand.length - 1)].type = rnd() < 0.5 ? 'market' : 'dock';
  }
  rows.push([make(system.rows, 0, 1, 'boss')]);
  // Modifiers: elites always one, combat sometimes (never on row 0: the opening fight stays plain).
  for (const nd of nodes) {
    if (nd.type === 'elite' || (nd.type === 'combat' && rnd() < 0.35 && nd.row > 0)) nd.modifiers = [MOD_IDS[ri(0, MOD_IDS.length - 1)]];
  }
  // Links: each node → nearest 1–2 nodes in the next row; then every orphan gets an inbound link.
  for (let r = 0; r < rows.length - 1; r++) {
    const next = rows[r + 1];
    for (const nd of rows[r]) {
      const sorted = [...next].sort((a, b) => Math.abs(a.x - nd.x) - Math.abs(b.x - nd.x));
      nd.links.push(sorted[0].id);
      if (sorted[1] && Math.abs(sorted[1].x - nd.x) < 0.45 && rnd() < 0.5) nd.links.push(sorted[1].id);
    }
    for (const t of next) {
      if (rows[r].some((nd) => nd.links.includes(t.id))) continue;
      const src = [...rows[r]].sort((a, b) => Math.abs(a.x - t.x) - Math.abs(b.x - t.x))[0];
      src.links.push(t.id);
    }
  }
  return { system: system.id, seed, rows, nodes };
}

export const routeNode = (route, id) => route.nodes.find((n) => n.id === id);

// Nodes the player may pick next: row 0 at the start, else the current node's links.
export function reachableNodes(route, nodeId) {
  if (!nodeId) return route.rows[0];
  return routeNode(route, nodeId).links.map((id) => routeNode(route, id));
}

// Difficulty level of a route row. The first two rows ease in: a ship that has only its supply drop must not meet
// full-strength waves at row 0.
export const nodeLevel = (system, row) => system.level + row * system.step - Math.max(0, 2 - row) * (system.warm ?? WARM);

// Director spec for a fighting node. sectorIndex is 1-based (sectors fought so far + 1).
export function nodeSpec(system, node, sectorIndex) {
  const level = nodeLevel(system, node.row);
  const boss = node.type === 'boss' ? system.boss : null;
  const base = system.dur;
  return {
    index: sectorIndex, row: node.row, level, loop: 0, boss, elite: node.type === 'elite', modifiers: node.modifiers.slice(),
    hue: system.hue, name: system.name, duration: boss ? base * 0.7 : base, bossHp: system.bossHp, pay: system.pay,
  };
}
