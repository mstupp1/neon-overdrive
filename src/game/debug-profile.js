// Debug progression is opt-in. Keep the first snapshot across reloads and repeated unlocks.
import { profile, saveProfile } from '../core/storage.js';
import { SHIPS, paintsFor } from './ships.js';
import { CLASSES, ALL_PASSIVES } from './pilot.js';
import { UPGRADES } from './upgrades.js';
import { RELICS } from './collectables.js';
import { ACHIEVEMENTS } from './achievements.js';
import { SYSTEMS } from './campaign.js';
import { RANKS } from './economy.js';
import { TIER_CAP } from './core.js';
import { treeFor } from './tree.js';

const BACKUP = 'neon-overdrive/debug-profile/v1';
export function hasDebugBackup() {
  try { return !!localStorage.getItem(BACKUP); } catch { return false; }
}

export function unlockEverything() {
  // Refuse to overwrite progression if a recoverable snapshot cannot be stored.
  try {
    if (!localStorage.getItem(BACKUP)) localStorage.setItem(BACKUP, JSON.stringify(profile));
  } catch { throw new Error('Storage unavailable. Unlock cancelled because a backup could not be saved.'); }
  const union = (a, b) => [...new Set([...a, ...b])];
  profile.ownedShips = union(profile.ownedShips, SHIPS.map((s) => s.id));
  for (const s of SHIPS) profile.paintsOwned[s.id] = paintsFor(s).map((_, i) => i);
  profile.pilot.classes = union(profile.pilot.classes, CLASSES.map((c) => c.id));
  profile.pilot.found = union(profile.pilot.found, ALL_PASSIVES.map((p) => p.id));
  profile.tech = union(profile.tech, UPGRADES.map((u) => u.id));
  profile.relics = union(profile.relics, RELICS.map((r) => r.id));
  for (const a of ACHIEVEMENTS) profile.ach[a.id] ||= Date.now();
  profile.campaign.cleared = union(profile.campaign.cleared, SYSTEMS.map((s) => s.id));
  profile.campaign.bestSys = SYSTEMS.length - 1;
  profile.rankXp = Math.max(profile.rankXp, RANKS.at(-1));
  profile.credits = Math.max(profile.credits, 1000000);
  profile.flux = Math.max(profile.flux, 100000);
  profile.tierMax = TIER_CAP;
  // All tree nodes become affordable; leave allocation and build choices to the player.
  const nodes = Math.max(...CLASSES.map((c) => treeFor(c.id).nodes.size));
  profile.core.expand = Math.max(profile.core.expand || 0, nodes);
  if (!saveProfile()) throw new Error('Unlock applied for this session, but could not be saved. Your progression backup is kept.');
  return 'Everything unlocked and saved. Previous progression backed up. Core levels are uncapped; Flux supplied.';
}

export function restoreDebugProfile() {
  const raw = localStorage.getItem(BACKUP);
  if (!raw) throw new Error('No debug backup to restore.');
  const saved = JSON.parse(raw);
  const settings = profile.settings;
  Object.assign(profile, saved, { settings });
  if (!saveProfile()) throw new Error('Progression restored for this session, but could not be saved. Your backup is kept; try restoring again.');
  localStorage.removeItem(BACKUP);
  return 'Previous progression restored. Current settings kept.';
}
