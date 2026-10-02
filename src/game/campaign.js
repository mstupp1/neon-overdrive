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
    id: 'genesis', name: 'NEON GENESIS', short: 'GENESIS', act: 1, hue: 215, level: 1, step: 0.56, warm: 0, rows: 8, dur: 42, bossHp: 1.3, supply: 0, pay: 0.8, boss: 'warden',
    blurb: 'The Grid\'s outer lattice. A siege mech guards the gate.',
  },
  {
    id: 'crimson', name: 'CRIMSON TIDE', short: 'CRIMSON', act: 2, hue: 345, level: 5.8, step: 0.375, warm: 0, rows: 8, dur: 42, bossHp: 1, supply: 0, pay: 0.64, boss: 'hydra',
    blurb: 'Bio-corrupted sectors. Something huge is breeding in the dark.',
  },
  {
    id: 'cyclone', name: 'CYAN CYCLONE', short: 'CYCLONE', act: 3, hue: 185, level: 9.2, step: 0.45, warm: 0, rows: 8, dur: 42, bossHp: 0.5, supply: 0, pay: 0.68, boss: 'omega',
    blurb: 'Storm-lit data winds. The core intelligence waits at the eye.',
  },
  {
    id: 'void', name: 'THE VOID', short: 'VOID', act: 4, hue: 275, level: 10.2, step: 0.825, warm: 0, rows: 8, dur: 42, bossHp: 0.22, supply: 0, pay: 0.82, boss: 'eclipse',
    blurb: 'Beyond the Grid. The Signal\'s source. No one has returned.',
  },
];

const WARM = 0.9; // default `warm`

export const systemById = (id) => SYSTEMS.find((s) => s.id === id) || SYSTEMS[0];

export const NODE_TYPES = {
  combat: { name: 'COMBAT', color: '#3ff6ff' },
  elite: { name: 'ELITE', color: '#ff3df2' },
  market: { name: 'MARKET', color: '#ffd24a' },
  dock: { name: 'REST', color: '#7dff6b' },
  anomaly: { name: 'ANOMALY', color: '#b48bff' },
  vault: { name: 'VAULT', color: '#ffb300' },
  rift: { name: 'RIFT', color: '#ff4d6d' },
  boss: { name: 'BOSS', color: '#ff2e55' },
};

// What a fight pays on top of its sector draft (shown on the map before you pick it). Elites always pay 'double'.
export const REWARDS = {
  offense: { name: 'OFFENSE', desc: 'Draft of weapons and stats', color: '#3ff6ff' },
  defense: { name: 'DEFENSE', desc: 'Draft of defenses + repair 1', color: '#ff4d6d' },
  module: { name: 'MODULE', desc: 'Draft of modules', color: '#ff3df2' },
  credits: { name: 'CACHE', desc: 'Credit cache', color: '#ffd24a' },
  hull: { name: 'HULL', desc: '+1 max hull', color: '#7dff6b' },
  boost: { name: 'BOOST', desc: '+1 level to an upgrade you own', color: '#ffb300' },
  double: { name: '2 DRAFTS', desc: 'Two sector drafts', color: '#ff3df2' },
};
const REWARD_ROLL = [['offense', 3], ['defense', 2], ['module', 3], ['credits', 2], ['hull', 1], ['boost', 2]];

const MOD_IDS = Object.keys(MODIFIERS);
export const COLS = 4;
const PATHS = 6;
const LIMITED = ['elite', 'market', 'dock', 'vault', 'rift']; // never twice in a row along a path

// route = { system, seed, rows: [[node]], nodes: [node] }; node = { id, row, col, x, type, reward?, modifiers, links[] }
// Slay the Spire style: PATHS random walks climb a COLS-wide grid without crossing; the cells they touch are the nodes and
// their steps are the links, so paths split and merge. Fixed rows: row 0 fights, the middle row is a Vault, the row
// before the boss is a Rest stop; the rest is weighted per row with a few placement rules.
export function generateRoute(system, seed) {
  const rnd = mulberry32(seed);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const R = system.rows;
  const grid = Array.from({ length: R }, () => new Array(COLS).fill(null));
  const edges = new Set(); // `${row}:${fromCol}>${toCol}`
  const crosses = (r, a, b) => {
    // An edge a→b from row r crosses an existing c→d when they swap order.
    for (const e of edges) {
      const [er, rest] = e.split(':');
      if (+er !== r) continue;
      const [c, d] = rest.split('>').map(Number);
      if ((a < c && b > d) || (a > c && b < d)) return true;
    }
    return false;
  };
  const cell = (r, c) => (grid[r][c] ||= { id: `r${r}c${c}`, row: r, col: c, x: (c + 0.5) / COLS, type: '', modifiers: [], links: [] });
  const starts = [];
  for (let p = 0; p < PATHS; p++) {
    let c = ri(0, COLS - 1);
    if (p === 1) while (c === starts[0]) c = ri(0, COLS - 1); // at least two distinct starts
    starts.push(c);
    cell(0, c);
    for (let r = 0; r < R - 1; r++) {
      const opts = [c - 1, c, c + 1].filter((d) => d >= 0 && d < COLS && !crosses(r, c, d));
      const d = opts.length ? opts[ri(0, opts.length - 1)] : c;
      edges.add(`${r}:${c}>${d}`);
      const from = cell(r, c);
      const to = cell(r + 1, d);
      if (!from.links.includes(to.id)) from.links.push(to.id);
      c = d;
    }
  }
  const rows = grid.map((row) => row.filter(Boolean));
  const nodes = rows.flat();
  const parents = (nd) => (nd.row ? rows[nd.row - 1].filter((p) => p.links.includes(nd.id)) : []);

  const mid = Math.floor(R / 2);
  const weights = (r) => [
    ['combat', 4.6], ['anomaly', 2.2], ['elite', r >= 2 ? 1.3 : 0], ['market', r >= 2 ? 0.8 : 0],
    ['dock', r >= 3 && r < R - 2 ? 0.7 : 0], ['rift', r >= 2 ? 0.6 : 0],
  ];
  const pickW = (w) => {
    let x = rnd() * w.reduce((a, b) => a + b[1], 0);
    for (const [t, k] of w) if ((x -= k) <= 0 && k > 0) return t;
    return 'combat';
  };
  for (const row of rows) {
    for (const nd of row) {
      const r = nd.row;
      if (r === 0) nd.type = 'combat';
      else if (r === R - 1) nd.type = 'dock';
      else if (r === mid) nd.type = 'vault';
      else {
        const bad = new Set(parents(nd).map((p) => p.type).filter((t) => LIMITED.includes(t)));
        // Siblings (same parent) should offer different stops where possible.
        for (const p of parents(nd)) for (const id of p.links) { const sib = grid[r][+id.split('c')[1]]; if (sib && sib !== nd && sib.type && sib.type !== 'combat') bad.add(sib.type); }
        let t = 'combat';
        for (let k = 0; k < 6; k++) {
          t = pickW(weights(r));
          if (!bad.has(t)) break;
          t = 'combat';
        }
        nd.type = t;
      }
    }
  }
  // At least one Market somewhere after row 1 (a place to spend the wallet).
  if (!nodes.some((nd) => nd.type === 'market')) {
    const cand = nodes.filter((nd) => nd.row >= 2 && nd.row < R - 1 && nd.row !== mid && (nd.type === 'combat' || nd.type === 'anomaly'));
    if (cand.length) cand[ri(0, cand.length - 1)].type = 'market';
  }
  const boss = { id: `r${R}c0`, row: R, col: 0, x: 0.5, type: 'boss', modifiers: [], links: [] };
  for (const nd of rows[R - 1]) nd.links.push(boss.id);
  rows.push([boss]);
  nodes.push(boss);
  // Rewards and modifiers: elites always one modifier and two drafts; combat sometimes a modifier (never on row 0).
  for (const nd of nodes) {
    if (nd.type === 'elite') {
      nd.reward = 'double';
      nd.modifiers = [MOD_IDS[ri(0, MOD_IDS.length - 1)]];
    } else if (nd.type === 'combat') {
      nd.reward = pickW(REWARD_ROLL);
      if (rnd() < 0.3 && nd.row > 0) nd.modifiers = [MOD_IDS[ri(0, MOD_IDS.length - 1)]];
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
    hue: system.hue, name: system.name, duration: boss ? base * 0.7 : base, bossHp: system.bossHp, pay: system.pay, reward: node.reward || null,
  };
}
