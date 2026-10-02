// Passive tree: one radial node wheel per pilot class (Path of Exile style).
// - Points: 2 per Pilot Rank + the Flux Core's Neural Expansion levels (core.js `expand`). Each class spends the same pool
//   on its own tree; refunds are free, any time (a node can be refunded while everything else stays linked to the centre).
// - A tree is generated from TREES[cls] = 6 wedges in clockwise order from the top: {theme, big, key}. Big wedges have
//   12 nodes (two notables), small ones 7 (one notable); every wedge ends in its own keystone, and a bridge node joins
//   each pair of neighbouring wedges. Node ids are `${cls}.${theme}.${slot}` and must stay stable (saves keep them):
//   add new nodes under new slot names rather than renaming.
// - Stats: applyTree(st, p) runs at the end of recomputeStats (after applyPassives) and sums every allocated node's
//   mods (see MODS); behavioural keystones set st flags read by treeOnKill / treeOnDash / treeOnGraze and world.js.
// - Save: profile.tree[cls] = [node ids]; the player gets p.tree = allocated ids of the active class (null in attract).

import { G } from './state.js';
import { profile, saveProfile } from '../core/storage.js';
import { rankFor } from './economy.js';
import { floatText, ring } from './fx.js';
import { sfx } from '../core/audio.js';

export const POINTS_PER_RANK = 2;

// Build-path themes (the same paths as gear: Firepower, Crit, Modules, Mobility, Overdrive/Graze, Tank, Greed).
// small: the two alternating small-node bonuses; notables: [first, second] (small wedges use the first).
export const THEMES = {
  fire: {
    name: 'FIREPOWER', color: '#ff4d6d',
    small: [{ dmg: 4 }, { rate: 4 }],
    notables: [{ name: 'Heavy Rounds', mods: { dmg: 12, pierce: 1 } }, { name: 'Rapid Cycle', mods: { rate: 12 } }],
  },
  crit: {
    name: 'CRIT', color: '#ffe14d',
    small: [{ crit: 2 }, { critMul: 0.15 }],
    notables: [{ name: 'Weak Spot', mods: { crit: 5 } }, { name: 'Lethal Precision', mods: { critMul: 0.5 } }],
  },
  mods: {
    name: 'MODULES', color: '#ff8a3d',
    small: [{ mod: 6 }, { mod: 3, dmg: 2 }],
    notables: [{ name: 'Drone Uplink', mods: { mod: 15 } }, { name: 'Expanded Bay', mods: { slots: 1 } }],
  },
  mob: {
    name: 'MOBILITY', color: '#3ff6ff',
    small: [{ speed: 4 }, { dashCd: 6 }],
    notables: [{ name: 'Afterburner', mods: { speed: 10, dashLen: 15 } }, { name: 'Extra Thruster', mods: { charges: 1 } }],
  },
  od: {
    name: 'OVERDRIVE', color: '#ff3df2',
    small: [{ odGain: 6 }, { odDur: 0.4 }],
    notables: [{ name: 'Surge Capacitor', mods: { odGain: 20 } }, { name: 'Sustained Burn', mods: { odDur: 1.5 } }],
  },
  graze: {
    name: 'GRAZE', color: '#9d7bff',
    small: [{ grazeR: 8 }, { grazeOd: 12 }],
    notables: [{ name: 'Razor Edge', mods: { grazeR: 25 } }, { name: 'Thrill Seeker', mods: { grazeOd: 40 } }],
  },
  tank: {
    name: 'TANK', color: '#7dff6b',
    small: [{ hull: 0.5 }, { hitIfr: 10 }],
    notables: [{ name: 'Reinforced Frame', mods: { hull: 1 } }, { name: 'Aegis Lattice', mods: { shield: 22 } }],
  },
  greed: {
    name: 'GREED', color: '#5aa9ff',
    small: [{ credits: 5 }, { xp: 4 }],
    notables: [{ name: 'Prospector', mods: { credits: 12, luck: 15 } }, { name: 'Scholar', mods: { xp: 12, magnet: 20 } }],
  },
};

// Keystones: one per wedge, unique per class. `mods` may carry flags (momentum, edgeRunner, shadowStrike, critDouble).
const K = (name, desc, mods) => ({ name, desc, mods });
export const TREES = {
  striker: [
    { theme: 'fire', big: true, key: K('Glass Cannon', '+40% damage. -2 max hull.', { dmg: 40, hull: -2 }) },
    { theme: 'crit', big: true, key: K('Deadeye', 'Double crit chance. Shots that do not crit deal 20% less.', { critDouble: 1, nonCrit: -20 }) },
    { theme: 'mob', key: K('Momentum', 'Every kill speeds your next dash charge by 0.1s.', { momentum: 1 }) },
    { theme: 'greed', key: K('High Roller', '+60% credits and +30% rarity find. -1 max hull.', { credits: 60, luck: 30, hull: -1 }) },
    { theme: 'tank', key: K('Juggernaut', '+3 max hull. -15% move speed.', { hull: 3, speed: -15 }) },
    { theme: 'od', big: true, key: K('Berserker', 'Overdrive lasts 50% longer. The meter charges 25% slower.', { odDurPct: 50, odGain: -25 }) },
  ],
  engineer: [
    { theme: 'mods', big: true, key: K('Swarm Doctrine', '+2 module slots. Your main gun deals 25% less.', { slots: 2, primary: -25 }) },
    { theme: 'fire', key: K('Overclock', '+25% fire rate. -1 max hull.', { rate: 25, hull: -1 }) },
    { theme: 'crit', key: K('Precision Tooling', '+8% crit chance. Crits deal 0.5x less.', { crit: 8, critMul: -0.5 }) },
    { theme: 'greed', big: true, key: K('Salvage Master', '+40% credits and +60% pickup range. -10% damage.', { credits: 40, magnet: 60, dmg: -10 }) },
    { theme: 'tank', big: true, key: K('Bastion', 'A shield recharges every 12s. -10% fire rate.', { shieldBase: 12, rate: -10 }) },
    { theme: 'od', key: K('Field Generator', 'Fortress Protocol lasts 3s longer. The meter charges 15% slower.', { odDur: 3, odGain: -15 }) },
  ],
  ghost: [
    { theme: 'mob', big: true, key: K('Shadow Step', '+1 dash charge and 20% faster dash recharge. -1 max hull.', { charges: 1, dashCd: 20, hull: -1 }) },
    { theme: 'graze', big: true, key: K('Edge Runner', 'Every 80 grazes repair 1 hull. -10% damage.', { edgeRunner: 1, dmg: -10 }) },
    { theme: 'od', key: K('Echo Chamber', 'Phase Shift charges 30% faster but lasts 30% shorter.', { odGain: 30, odDurPct: -30 }) },
    { theme: 'greed', key: K('Opportunist', '+25% credits and XP. -1 dash charge.', { credits: 25, xp: 25, charges: -1 }) },
    { theme: 'fire', key: K('Assassin', '+30% damage. -15% fire rate.', { dmg: 30, rate: -15 }) },
    { theme: 'crit', big: true, key: K('Shadow Strike', 'For 0.6s after a dash every hit crits. Crits deal 0.5x less.', { shadowStrike: 1, critMul: -0.5 }) },
  ],
};

// --- Layout -----------------------------------------------------------------------------------------------------------
// Positions are polar (ring, degrees off the wedge centre); the UI turns them into x/y. Ring 0 is the class core.
const BIG = [
  ['g', 1, 0, 0, ['root']],
  ['s2', 2, 0, 1, ['g']],
  ['l3', 3, -11, 0, ['s2']],
  ['l4', 4, -14, 1, ['l3']],
  ['n1', 5, -14, 'n0', ['l4']],
  ['r3', 3, 11, 1, ['s2']],
  ['r4', 4, 14, 0, ['r3']],
  ['n2', 5, 14, 'n1', ['r4']],
  ['lo', 6, -19, 1, ['n1']],
  ['ro', 6, 19, 0, ['n2']],
  ['s6', 6, 0, 0, ['n1', 'n2']],
  ['k', 7, 0, 'key', ['s6']],
];
const SMALL = [
  ['g', 1, 0, 0, ['root']],
  ['s2', 2, 0, 1, ['g']],
  ['s3', 3, 0, 0, ['s2']],
  ['l4', 4, -14, 1, ['s3']],
  ['r4', 4, 14, 0, ['s3']],
  ['n1', 5, 0, 'n0', ['l4', 'r4']],
  ['k', 6, 0, 'key', ['n1']],
];

const SPAN = 360 / 6;
const trees = new Map(); // cls → { nodes: Map(id → node), list: [node], root }

function addMods(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] || 0) + v;
  return out;
}
// Bridges take half of each side's bonus (whole-number stats are dropped, half hull stays ½).
const halve = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, k === 'hull' ? v : k === 'charges' || k === 'slots' || k === 'pierce' ? 0 : v / 2]));

function build(cls) {
  const spec = TREES[cls];
  const nodes = new Map();
  const root = { id: `${cls}.root`, kind: 'root', ring: 0, ang: 0, links: [], mods: {}, theme: null };
  nodes.set(root.id, root);
  const link = (a, b) => {
    if (!a.links.includes(b.id)) a.links.push(b.id);
    if (!b.links.includes(a.id)) b.links.push(a.id);
  };
  spec.forEach((w, wi) => {
    const th = THEMES[w.theme];
    const centre = -90 + wi * SPAN;
    for (const [slot, rg, off, kind, from] of w.big ? BIG : SMALL) {
      const id = `${cls}.${w.theme}.${slot}`;
      let node;
      if (kind === 'key') node = { kind: 'key', name: w.key.name, desc: w.key.desc, mods: w.key.mods };
      else if (typeof kind === 'string') {
        const nt = th.notables[kind === 'n0' ? 0 : 1];
        node = { kind: 'notable', name: nt.name, mods: nt.mods };
      } else node = { kind: 'small', name: th.name, mods: th.small[kind] };
      Object.assign(node, { id, theme: w.theme, ring: rg, ang: centre + off, links: [] });
      nodes.set(id, node);
      for (const f of from) link(node, f === 'root' ? root : nodes.get(`${cls}.${w.theme}.${f}`));
    }
  });
  // Bridges: wedge i's r4 ↔ bridge ↔ wedge i+1's l4, with half of each side's first small bonus.
  spec.forEach((w, wi) => {
    const nx = spec[(wi + 1) % spec.length];
    const a = THEMES[w.theme];
    const b = THEMES[nx.theme];
    const id = `${cls}.bridge.${w.theme}-${nx.theme}`;
    const node = { id, kind: 'small', bridge: true, theme: w.theme, theme2: nx.theme, name: `${a.name} / ${b.name}`, mods: addMods(halve(a.small[0]), halve(b.small[0])), ring: 4.7, ang: -90 + wi * SPAN + SPAN / 2, links: [] };
    nodes.set(id, node);
    link(node, nodes.get(`${cls}.${w.theme}.r4`));
    link(node, nodes.get(`${cls}.${nx.theme}.l4`));
  });
  for (const n of nodes.values()) if (!n.desc) n.desc = describe(n.mods);
  return { nodes, list: [...nodes.values()], root };
}

export function treeFor(cls) {
  if (!TREES[cls]) return null;
  if (!trees.has(cls)) trees.set(cls, build(cls));
  return trees.get(cls);
}

// --- Descriptions ------------------------------------------------------------------------------------------------------

const pct = (v) => `${v > 0 ? '+' : ''}${+v.toFixed(1)}%`;
const num = (v) => `${v > 0 ? '+' : ''}${+v.toFixed(2)}`;
const MODS = {
  dmg: (v) => `${pct(v)} damage`,
  rate: (v) => `${pct(v)} fire rate`,
  pierce: (v) => `${num(v)} pierce`,
  crit: (v) => `${pct(v)} crit chance`,
  critMul: (v) => `${num(v)}x crit damage`,
  mod: (v) => `${pct(v)} module damage`,
  slots: (v) => `${num(v)} module slot${Math.abs(v) === 1 ? '' : 's'}`,
  primary: (v) => `${pct(v)} main gun damage`,
  speed: (v) => `${pct(v)} move speed`,
  dashCd: (v) => `${pct(v)} dash recharge speed`,
  dashLen: (v) => `${pct(v)} dash length`,
  charges: (v) => `${num(v)} dash charge${Math.abs(v) === 1 ? '' : 's'}`,
  odGain: (v) => `${pct(v)} ultimate charge`,
  odDur: (v) => `${num(v)}s ultimate duration`,
  odDurPct: (v) => `${pct(v)} ultimate duration`,
  grazeR: (v) => `${pct(v)} graze radius`,
  grazeOd: (v) => `${pct(v)} ultimate per graze`,
  hull: (v) => (v === 0.5 ? '+½ max hull (2 = +1)' : `${num(v)} max hull`),
  hitIfr: (v) => `${pct(v)} invulnerability after a hit`,
  shield: (v) => `A shield recharges every ${v}s (20% faster if you already have one)`,
  shieldBase: (v) => `A shield recharges every ${v}s`,
  credits: (v) => `${pct(v)} credits`,
  xp: (v) => `${pct(v)} XP`,
  magnet: (v) => `${pct(v)} pickup range`,
  luck: (v) => `${pct(v)} rarity find`,
  nonCrit: (v) => `${pct(v)} damage on hits that do not crit`,
};

export function describe(mods) {
  return Object.entries(mods).filter(([k, v]) => MODS[k] && v).map(([k, v]) => MODS[k](v)).join('. ') + '.';
}

// Summed mods of a set of node ids (unknown ids are skipped).
export function sumMods(cls, ids) {
  const t = treeFor(cls);
  let m = {};
  if (!t) return m;
  for (const id of ids) {
    const n = t.nodes.get(id);
    if (n) m = addMods(m, n.mods);
  }
  return m;
}

// --- Points and allocation -------------------------------------------------------------------------------------------

export const coreExpand = () => profile.core.expand || 0;
export const treePoints = () => POINTS_PER_RANK * rankFor(profile.rankXp).rank + coreExpand();
export const allocated = (cls) => (profile.tree[cls] || []).filter((id) => treeFor(cls) && treeFor(cls).nodes.has(id));
export const pointsLeft = (cls) => treePoints() - allocated(cls).length;

// Ids reachable from the root through `set` (a Set of ids).
function connected(t, set) {
  const seen = new Set([t.root.id]);
  const q = [t.root];
  while (q.length) {
    const n = q.pop();
    for (const l of n.links) {
      if (seen.has(l) || !set.has(l)) continue;
      seen.add(l);
      q.push(t.nodes.get(l));
    }
  }
  seen.delete(t.root.id);
  return seen;
}

// '' if `id` can be allocated now, else a reason.
export function canAllocate(cls, id) {
  const t = treeFor(cls);
  const n = t && t.nodes.get(id);
  if (!n || n.kind === 'root') return 'UNKNOWN NODE';
  const have = new Set(allocated(cls));
  if (have.has(id)) return 'ALLOCATED';
  if (!n.links.some((l) => l === t.root.id || have.has(l))) return 'NOT CONNECTED';
  if (pointsLeft(cls) <= 0) return 'NO POINTS';
  return '';
}

// '' if `id` can be refunded (everything else stays linked to the centre), else a reason.
export function canRefund(cls, id) {
  const t = treeFor(cls);
  const have = new Set(allocated(cls));
  if (!t || !have.has(id)) return 'NOT ALLOCATED';
  have.delete(id);
  return connected(t, have).size === have.size ? '' : 'IN USE';
}

export function allocate(cls, id) {
  const err = canAllocate(cls, id);
  if (err) return err;
  profile.tree[cls] = [...allocated(cls), id];
  saveProfile();
  return '';
}

export function refund(cls, id) {
  const err = canRefund(cls, id);
  if (err) return err;
  profile.tree[cls] = allocated(cls).filter((x) => x !== id);
  saveProfile();
  return '';
}

export function resetTree(cls) {
  if (!treeFor(cls)) return 'UNKNOWN CLASS';
  profile.tree[cls] = [];
  saveProfile();
  return '';
}

// Keep saved trees valid: known ids, linked to the centre, within the point budget (oldest allocations survive).
export function sanitizeTrees() {
  const total = treePoints();
  for (const cls of Object.keys(profile.tree)) {
    const t = treeFor(cls);
    if (!t) continue;
    let ids = [...new Set(allocated(cls))];
    const ok = connected(t, new Set(ids));
    ids = ids.filter((id) => ok.has(id));
    while (ids.length > total) {
      ids.pop();
      const c = connected(t, new Set(ids));
      ids = ids.filter((id) => c.has(id));
    }
    profile.tree[cls] = ids;
  }
}

// --- Stats -------------------------------------------------------------------------------------------------------------

const FLAGS = ['momentum', 'edgeRunner', 'shadowStrike'];

// Runs at the end of recomputeStats (after applyPassives). p.tree = allocated ids (null in attract / previews).
export function applyTree(st, p) {
  for (const f of FLAGS) st[f] = false;
  st.nonCrit = 1;
  st.hitIfr = 1;
  if (!p.tree || !p.tree.length) return;
  const m = sumMods(p.cls, p.tree);
  const inc = (k) => 1 + (m[k] || 0) / 100;
  st.dmg *= inc('dmg') * inc('primary');
  st.modDmg *= inc('mod') / inc('primary'); // module damage reads st.dmg, so Swarm Doctrine's main-gun cut skips modules
  st.rate *= inc('rate');
  st.pierce += m.pierce || 0;
  st.crit += (m.crit || 0) / 100;
  if (m.critDouble) st.crit *= 2;
  st.critMul = Math.max(1.2, st.critMul + (m.critMul || 0));
  st.nonCrit = inc('nonCrit');
  st.maxModules += m.slots || 0;
  st.speed *= inc('speed');
  st.dashRecharge /= inc('dashCd');
  st.dashDur *= inc('dashLen');
  st.maxCharges = Math.max(1, st.maxCharges + (m.charges || 0));
  st.odGain *= Math.max(0.1, inc('odGain'));
  st.odDur = Math.max(1, (st.odDur + (m.odDur || 0)) * inc('odDurPct'));
  st.grazeR *= inc('grazeR');
  st.grazeOd *= inc('grazeOd');
  st.maxHp += Math.trunc(m.hull || 0);
  st.hitIfr = inc('hitIfr');
  if (m.shieldBase) st.shieldInterval = st.shieldInterval ? Math.min(st.shieldInterval, m.shieldBase) : m.shieldBase;
  if (m.shield) st.shieldInterval = st.shieldInterval ? st.shieldInterval / 1.2 : m.shield;
  st.creditMul *= inc('credits');
  st.xpMul *= inc('xp');
  st.magnet *= inc('magnet');
  st.find = (st.find || 0) + (m.luck || 0) / 100; // rarity find (loot.js)
  for (const f of FLAGS) st[f] = !!m[f];
}

// --- Keystone hooks ----------------------------------------------------------------------------------------------------

// Allocated ids of the active class for a new player (gear = real run).
export function treeForRun(cls, gear) {
  return gear ? allocated(cls) : null;
}

export function treeOnKill(p) {
  if (p.st.momentum && p.charges < p.maxCharges) p.rechargeT += 0.1;
}

export function treeOnDash(p) {
  if (p.st.shadowStrike) p.critUntil = G.time + 0.6;
}

export function treeOnGraze(p) {
  if (!p.st.edgeRunner) return;
  p.edgeGrazes = (p.edgeGrazes || 0) + 1;
  if (p.edgeGrazes >= 80) {
    p.edgeGrazes = 0;
    if (p.hp < p.maxHp && !p.dead) {
      p.hp++;
      floatText(p.x, p.y - 44, '+1 EDGE RUNNER', THEMES.graze.color, 11, 1.2);
      ring(p.x, p.y, 40, THEMES.graze.color, 0.4);
      sfx.heal();
    }
  }
}

// Shadow Strike: every hit crits for a moment after a dash (world.js collide).
export const forcedCrit = (p) => p.critUntil > G.time;
