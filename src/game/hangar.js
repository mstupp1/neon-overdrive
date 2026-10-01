// Hangar model: buying and equipping ships, parts and paints. Pure profile logic (no DOM).
// Every function returns '' on success or a short reason string. Callers play the sfx.

import { profile, saveProfile } from '../core/storage.js';
import { SHIPS, shipById, ownsShip, paintsFor, activePaint } from './ships.js';
import { SLOTS, partById, ownsPart } from './parts.js';
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

export function buyPart(id) {
  const part = partById(id);
  if (!part) return 'UNKNOWN PART';
  if (ownsPart(profile, id)) return 'OWNED';
  const err = spend(part.price);
  if (err) return err;
  profile.ownedParts.push(id);
  saveProfile();
  return '';
}

// Equips an owned part into its slot on that ship (replacing whatever was there).
export function equipPart(shipId, partId) {
  const part = partById(partId);
  if (!part) return 'UNKNOWN PART';
  if (!ownsPart(profile, partId)) return 'NOT OWNED';
  const eq = (profile.equip[shipId] ||= {});
  eq[part.slot] = partId;
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

// Applies the ship's equipped paint to its baked sprites (one ship only; cheap).
export function applyPaint(ship) {
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
