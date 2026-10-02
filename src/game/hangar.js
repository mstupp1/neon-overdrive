// Hangar model: buying and equipping ships, parts and paints. Pure profile logic (no DOM).
// Every function returns '' on success or a short reason string. Callers play the sfx.

import { profile, saveProfile } from '../core/storage.js';
import { SHIPS, shipById, ownsShip, paintsFor, activePaint } from './ships.js';
import { SLOTS, makeItem, itemLevel, sellValue, gearByUid, gearInSlot, equippedOn, migrateParts } from './parts.js';
import { luckFor, rollRarity } from './rarity.js';
import { addGear } from './loot.js';
import { rebuildShipSprite } from '../render/sprites.js';

function spend(price) {
  if (profile.credits < price) return 'NEED ' + (price - profile.credits);
  profile.credits -= price;
  return '';
}

export function selectShip(id) {
  const ship = SHIPS.find((s) => s.id === id);
  if (!ship) return 'UNKNOWN SHIP';
  if (!ownsShip(profile, ship)) return 'NOT OWNED';
  profile.lastShip = id;
  saveProfile();
  return '';
}

export function buyShip(id) {
  const ship = SHIPS.find((s) => s.id === id);
  if (!ship) return 'UNKNOWN SHIP';
  if (ownsShip(profile, ship)) return 'OWNED';
  const err = spend(ship.price || 0);
  if (err) return err;
  profile.ownedShips.push(id);
  saveProfile();
  return '';
}

// --- Gear: the Fabricator, equipping and selling -----------------------------------------------

export const ROLL_COST = { standard: 150, premium: 600 }; // premium: Rare or better

// Fabricator odds: your furthest system, best Overdrive tier and Deep Grid depth (at 75%), plus the active ship's
// Rarity Find. Item level follows the same progress.
export function fabLuck(find = 0) {
  const c = profile.campaign;
  return 0.75 * luckFor({ sys: Math.max(0, c.bestSys), tier: profile.tierMax, deep: Math.min(3, profile.bestDeep) }) + 3 * find;
}
export const fabItemLevel = () => itemLevel({ sys: Math.max(0, profile.campaign.bestSys), tier: profile.tierMax, deep: Math.min(3, profile.bestDeep) });

// Rolls a piece for `slot`. Returns {err} or addGear's result.
export function rollGear(slot, kind = 'standard', find = 0) {
  if (!SLOTS.includes(slot)) return { err: 'UNKNOWN SLOT' };
  const err = spend(ROLL_COST[kind]);
  if (err) return { err };
  const r = rollRarity(fabLuck(find), Math.random, kind === 'premium' ? 2 : 0);
  return addGear(makeItem(slot, r, fabItemLevel()));
}

// Equips an owned item into its slot on that ship (replacing whatever was there).
export function equipPart(shipId, uid) {
  const item = gearByUid(profile, uid);
  if (!item) return 'NOT OWNED';
  const eq = (profile.equip[shipId] ||= {});
  eq[item.slot] = uid;
  saveProfile();
  return '';
}

export function unequipSlot(shipId, slot) {
  if (!SLOTS.includes(slot)) return 'UNKNOWN SLOT';
  const eq = profile.equip[shipId];
  if (eq) delete eq[slot];
  saveProfile();
  return '';
}

// Sells an item (unequipping it from every ship). Returns '' or a reason.
export function sellGear(uid) {
  const item = gearByUid(profile, uid);
  if (!item) return 'NOT OWNED';
  for (const s of Object.keys(profile.equip)) for (const sl of SLOTS) if (profile.equip[s][sl] === uid) delete profile.equip[s][sl];
  profile.gear.splice(profile.gear.indexOf(item), 1);
  profile.gearNew = profile.gearNew.filter((u) => u !== uid);
  profile.credits += sellValue(item);
  saveProfile();
  return '';
}

// Unequipped Common / Uncommon pieces in a slot: what SELL JUNK would sell.
export const junkIn = (slot) => gearInSlot(profile, slot).filter((g) => g.r <= 1 && !equippedOn(profile, g.uid).length);

export function sellJunk(slot) {
  const junk = junkIn(slot);
  let total = 0;
  for (const g of junk) {
    total += sellValue(g);
    sellGear(g.uid);
  }
  return total;
}

// Boot: legacy parts become items.
export function initGear() {
  migrateParts(profile);
  saveProfile();
}

// Applies the ship's equipped paint to its baked sprites (one ship only; cheap).
function applyPaint(ship) {
  const p = activePaint(profile, ship);
  rebuildShipSprite(ship, p.color, p.bullet);
}

export function ownsPaint(shipId, idx) {
  return idx === 0 || (profile.paintsOwned[shipId] || []).includes(idx);
}

// Buys the paint if needed, then equips it and re-bakes that ship's sprite.
export function setPaint(shipId, idx) {
  const ship = shipById(shipId);
  const list = paintsFor(ship);
  if (ship.id !== shipId || !list[idx]) return 'UNKNOWN PAINT';
  if (!ownsShip(profile, ship)) return 'NOT OWNED';
  if (!ownsPaint(shipId, idx)) {
    const err = spend(list[idx].price);
    if (err) return err;
    (profile.paintsOwned[shipId] ||= []).push(idx);
  }
  profile.paint[shipId] = idx;
  saveProfile();
  applyPaint(ship);
  return '';
}

// Boot: re-bake every ship wearing a non-stock paint.
export function applyAllPaints() {
  for (const ship of SHIPS) if (activePaint(profile, ship).color !== ship.color) applyPaint(ship);
}
