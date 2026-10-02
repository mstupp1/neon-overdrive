// Loot: equipment and pilot finds. Gear goes straight into profile.gear (kept even if the run is lost);
// a full slot salvages its weakest unequipped piece for credits. Pilot classes and abilities are found here too.
// Listeners: onLoot(fn(kind, payload)) with kind 'gear' ({item, salvaged}) | 'class' (class def) | 'ability' (passive def).

import { G } from './state.js';
import { profile, saveProfile } from '../core/storage.js';
import { SLOTS, SLOT_CAP, makeItem, itemLevel, itemName, itemScore, sellValue, gearInSlot, equippedOn } from './parts.js';
import { RARITY, luckFor, rollRarity } from './rarity.js';
import { CLASSES, ALL_PASSIVES, classUnlocked, classOfPassive, findClass, findPassive, passiveFound } from './pilot.js';
import { floatText, ring } from './fx.js';

const listeners = [];
export const onLoot = (fn) => listeners.push(fn);
const emit = (kind, payload) => listeners.forEach((fn) => fn(kind, payload));

// Luck and item level where the run is now (system, Overdrive tier, Deep Grid cycle, Rarity Find).
export function runLuck(p = G.player) {
  const r = G.run;
  if (!r || r.mode !== 'campaign') return luckFor({ sys: Math.min(3, Math.floor((G.sector - 1) / 3)), find: p ? p.st.find : 0 });
  return luckFor({ sys: r.sysIdx, tier: r.tier || 0, deep: r.deep || 0, find: p ? p.st.find : 0 });
}
export function runItemLevel() {
  const r = G.run;
  if (!r || r.mode !== 'campaign') return itemLevel({ sys: Math.min(3, Math.floor((G.sector - 1) / 3)) });
  return itemLevel({ sys: r.sysIdx, tier: r.tier || 0, deep: r.deep || 0 });
}

// Adds an item to the inventory. A full slot drops its weakest unequipped piece (maybe the new one) for credits.
// Returns {item, salvaged: item | null, credits}.
export function addGear(item) {
  item.uid = 'g' + ++profile.gearSeq;
  profile.gear.push(item);
  profile.gearNew.push(item.uid);
  let salvaged = null;
  let credits = 0;
  const inSlot = gearInSlot(profile, item.slot);
  if (inSlot.length > SLOT_CAP) {
    const spare = inSlot.filter((g) => !equippedOn(profile, g.uid).length).sort((a, b) => itemScore(a) - itemScore(b))[0];
    if (spare) {
      salvaged = spare;
      credits = sellValue(spare);
      profile.gear.splice(profile.gear.indexOf(spare), 1);
      profile.gearNew = profile.gearNew.filter((u) => u !== spare.uid);
      profile.credits += credits;
    }
  }
  saveProfile();
  return { item, salvaged, credits };
}

// Rolls one piece of gear for the current run and banks it. bonus: extra luck (bosses, the Hunter).
export function dropGear(x, y, bonus = 0, floor = 0) {
  const luck = runLuck() + bonus;
  const r = rollRarity(luck, Math.random, floor);
  const item = makeItem(SLOTS[Math.floor(Math.random() * 3)], r, runItemLevel());
  const res = addGear(item);
  if (G.run) (G.run.loot ||= []).push(item);
  const c = RARITY[r].color;
  floatText(x, y - 30, itemName(item).toUpperCase(), c, r >= 3 ? 15 : 12, 1.8);
  if (r >= 2) ring(x, y, 50 + 12 * r, c, 0.6);
  emit('gear', res);
  return res;
}

// Pilot finds: a class you have not found, else an ability (rarity rolled; prefers your found classes).
function dropPilot(x, y, luck, classChance) {
  const missing = CLASSES.filter((c) => !classUnlocked(c));
  const pl = profile.pilot;
  if (missing.length && (Math.random() < classChance || pl.pity >= 2)) {
    pl.pity = 0;
    const c = missing[0];
    findClass(c.id);
    if (G.run) (G.run.found ||= []).push(c.name);
    floatText(x, y - 50, `CLASS FOUND: ${c.name}`, c.color, 15, 2);
    emit('class', c);
    return true;
  }
  if (missing.length) pl.pity++;
  return dropAbility(x, y, luck);
}

export function dropAbility(x, y, luck) {
  const left = ALL_PASSIVES.filter((ps) => !passiveFound(ps));
  if (!left.length) return false;
  const want = rollRarity(luck);
  const mine = left.filter((ps) => classUnlocked(classOfPassive(ps.id)));
  const pool = mine.length ? mine : left;
  // Closest rarity to the roll that still has something unfound.
  let best = pool[0];
  for (const ps of pool) if (Math.abs(ps.r - want) < Math.abs(best.r - want) || (ps.r === want && Math.random() < 0.5)) best = ps;
  findPassive(best.id);
  if (G.run) (G.run.found ||= []).push(best.name);
  floatText(x, y - 50, `ABILITY FOUND: ${best.name.toUpperCase()}`, RARITY[best.r].color, 13, 2);
  emit('ability', best);
  return true;
}

// Kill hook (enemies.js killEnemy, bosses.js finishBoss): bosses always drop gear, the Hunter usually, elites rarely.
export function rollGearDrop(e) {
  if (G.mode !== 'run' || !G.run) return;
  const luck = runLuck();
  if (e.boss) {
    dropGear(e.x, e.y, 2, 1);
    if (Math.random() < 0.6) dropPilot(e.x, e.y, luck + 1, 0.45);
  } else if (e.hunter) {
    if (Math.random() < 0.75) dropGear(e.x, e.y, 1);
    if (Math.random() < 0.25) dropPilot(e.x, e.y, luck, 0);
  } else if (e.elite && Math.random() < 0.03) dropGear(e.x, e.y);
}

// Every rank gained hands over an unfound ability (rarer ones as the rank climbs). Returns the abilities found.
export function rankUpFinds(from, to) {
  const out = [];
  for (let rk = from + 1; rk <= to; rk++) {
    const before = profile.pilot.found.length;
    dropAbility(-999, -999, rk / 3);
    if (profile.pilot.found.length > before) out.push(profile.pilot.found[profile.pilot.found.length - 1]);
  }
  return out;
}
