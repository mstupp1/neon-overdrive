// Shared combat systems that upgrades, modules and gear build on:
//  - Armor: a damage-reduction fraction on enemies (`armorOf`), cut by Armor Piercing and Corrosive stacks.
//  - Statuses: freeze / burn / corrode stacks applied by player hits (`onPlayerHit`), ticked by `updateStatus`.
//  - Marks: every Nth hit on an enemy detonates for extra damage (`st.detHits`).
//  - % health damage: a slice of the target's max hull per hit (`st.pctHp`), capped on bosses.
//  - Burst fire: `rollBurst(st)` says how many extra volleys a weapon fires right after this one.
// All of it reads neutral defaults set in `recomputeStats` (upgrades.js), so nothing here does anything until a
// card, gear modifier or passive raises one of those stats.

import { G } from './state.js';
import { sparks, ring, floatText } from './fx.js';
import { dist2 } from '../core/math.js';

// --- Armor ---------------------------------------------------------------------------------
// Fraction of incoming damage an enemy shrugs off. Anything not listed has none. Elites gain +0.05, bosses use BOSS_ARMOR.
export const ARMOR = { tank: 0.25, carrier: 0.2, hunter: 0.2, snake: 0.1, spinner: 0.05, eclipsedrone: 0.1 };
export const BOSS_ARMOR = 0.15;
const ARMOR_MIN = -0.25; // corrosion can push armor below zero: a bonus to damage taken
const ARMOR_MAX = 0.8;

const baseArmor = (e) => (e.boss ? BOSS_ARMOR : (ARMOR[e.type] || 0) + (e.elite ? 0.05 : 0));

// Current armor fraction, after Corrosive stacks and the player's Armor Piercing.
export function armorOf(e, st) {
  if (e.armor === undefined) e.armor = baseArmor(e);
  const cor = e.fx && e.fx.corrode ? e.fx.corrode.n * CORRODE_PER * corrodePot(e, st) : 0;
  return Math.max(ARMOR_MIN, Math.min(ARMOR_MAX, e.armor - cor - ((st && st.armorPierce) || 0)));
}

// --- Statuses ------------------------------------------------------------------------------
export const STATUS = {
  freeze: { color: '#7fe9ff', max: 10, dur: 3 },
  burn: { color: '#ff8a2b', max: 10, dur: 3 },
  corrode: { color: '#a6ff3d', max: 10, dur: 4 },
};
const SLOW_PER = 0.06; // movement / fire-rate slow per freeze stack (at potency 1)
const BOSS_SLOW_CAP = 0.2;
const FROZEN_T = 1.2; // a full freeze stack locks a non-boss enemy for this long
const FROZEN_IMMUNE = 3; // then it can't be frozen again for this long
const BURN_TICK = 0.5;
const BURN_PER = 0.55; // damage per stack per tick = this x player damage x difficulty hull scale x potency
const CORRODE_PER = 0.04; // armor shaved per corrosion stack
const PROC_GAP = 0.1; // per enemy, procs (status, marks, % hull) fire at most this often so beams can't spam them

// Fraction of status strength an enemy resists (also lowers its stack cap and application chance).
export const resistOf = (e) => (e.boss ? 0.5 : e.hunter ? 0.5 : e.elite ? 0.25 : 0);

const potOf = (e, st, kind) => ((st && st[kind + 'Pot']) || 1) * (1 - resistOf(e) * 0.5);
const corrodePot = (e, st) => potOf(e, st, 'corrode');

// Adds stacks of `kind` to enemy e (respecting resistance and its stack cap). Returns true when applied.
export function applyStatus(e, kind, stacks = 1) {
  if (e.dead || !STATUS[kind]) return false;
  const def = STATUS[kind];
  const fx = e.fx || (e.fx = {});
  if (kind === 'freeze' && (e.frozenT > 0 || G.time < (e.freezeImm || 0))) return false;
  const s = fx[kind] || (fx[kind] = { n: 0, t: 0, tick: BURN_TICK });
  const cap = Math.max(3, Math.round(def.max * (1 - resistOf(e))));
  s.n = Math.min(cap, s.n + stacks);
  s.t = def.dur;
  if (kind === 'freeze' && s.n >= cap && !e.boss) {
    // Full stack: the enemy locks up briefly.
    e.frozenT = FROZEN_T;
    e.freezeImm = G.time + FROZEN_T + FROZEN_IMMUNE;
    fx.freeze = null;
    ring(e.x, e.y, e.r + 14, def.color, 0.4);
    sparks(e.x, e.y, def.color, 8, 180);
  }
  return true;
}

// Time multiplier for this enemy's behaviour (1 normal, 0 frozen solid).
export function slowOf(e, st) {
  if (e.frozenT > 0) return 0;
  const f = e.fx && e.fx.freeze;
  if (!f) return 1;
  let slow = f.n * SLOW_PER * potOf(e, st || (G.player && G.player.st), 'freeze');
  if (e.boss) slow = Math.min(BOSS_SLOW_CAP, slow);
  return Math.max(0.15, 1 - slow);
}

// Per-enemy tick (updateEnemies): status timers, burn damage and the little effect particles.
export function updateStatus(e, dt, damage) {
  if (e.frozenT > 0) e.frozenT -= dt;
  const fx = e.fx;
  if (!fx) return;
  const st = G.player && G.player.st;
  for (const kind of ['freeze', 'burn', 'corrode']) {
    const s = fx[kind];
    if (!s) continue;
    s.t -= dt;
    if (s.t <= 0) {
      fx[kind] = null;
      continue;
    }
    if (kind === 'burn') {
      s.tick -= dt;
      if (s.tick <= 0) {
        s.tick += BURN_TICK;
        const d = s.n * BURN_PER * ((st && st.dmg) || 1) * (G.director.diff.hp || 1) * potOf(e, st, 'burn');
        sparks(e.x, e.y, STATUS.burn.color, 2, 90);
        damage(e, d, e.x, e.y, false, 'dot');
        if (e.dead) return;
      }
    } else if (Math.random() < dt * 4) sparks(e.x, e.y, STATUS[kind].color, 1, 60);
  }
  if (e.frozenT > 0 && Math.random() < dt * 6) sparks(e.x, e.y, STATUS.freeze.color, 1, 40);
}

// --- Player hit procs ----------------------------------------------------------------------
// Called from damageEnemy for every player hit that is not itself a proc. `dmg` is the damage that landed.
export function onPlayerHit(e, dmg, x, y, damage) {
  const pl = G.player;
  if (!pl || e.dead) return;
  const st = pl.st;
  if (G.time < (e.procT || 0)) return;
  const resist = 1 - resistOf(e);
  if (st.freezeChance && Math.random() < st.freezeChance * resist) applyStatus(e, 'freeze');
  if (st.burnChance && Math.random() < st.burnChance * resist) applyStatus(e, 'burn');
  if (st.corrodeChance && Math.random() < st.corrodeChance * resist) applyStatus(e, 'corrode');
  const any = st.freezeChance || st.burnChance || st.corrodeChance || st.pctHp || st.detHits;
  if (!any) return;
  e.procT = G.time + PROC_GAP;
  if (st.pctHp) damage(e, e.maxHp * st.pctHp * (e.boss ? 0.15 : 1), x, y, false, 'pct');
  if (st.detHits && !e.dead) {
    e.marks = (e.marks || 0) + 1;
    if (e.marks > st.detHits) {
      e.marks = 0;
      detonate(e, dmg * st.detMul, st.detR, damage);
    }
  }
}

function detonate(e, dmg, R, damage) {
  const x = e.x;
  const y = e.y;
  ring(x, y, R, '#ffe14d', 0.35);
  sparks(x, y, '#ffe14d', 10, 260);
  floatText(x, y - e.r - 8, 'DETONATE', '#ffe14d', 10, 0.6);
  damage(e, dmg, x, y, true, 'det');
  const R2 = R * R;
  for (const o of G.enemies) {
    if (o !== e && !o.dead && dist2(x, y, o.x, o.y) < R2) damage(o, dmg * 0.5, o.x, o.y, false, 'det');
  }
}

// --- Burst fire ----------------------------------------------------------------------------
export const BURST_GAP = 0.07;

// How many extra volleys to queue after a weapon fires. Chance scales with attack speed (`st.rate`).
// Primary fire uses this in player.js; modules can call it at launch and repeat their shot `BURST_GAP` apart.
export function rollBurst(st) {
  if (!st.burstChance) return 0;
  return Math.random() < Math.min(0.9, st.burstChance * (st.rate || 1)) ? st.burstExtra || 1 : 0;
}
