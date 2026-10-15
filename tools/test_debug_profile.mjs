import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { addEventListener() {} };
const entries = new Map();
globalThis.localStorage = {
  getItem: (key) => entries.get(key) ?? null,
  setItem: (key, value) => entries.set(key, value),
  removeItem: (key) => entries.delete(key),
};
const { profile } = await import('../src/core/storage.js');
const { unlockEverything, restoreDebugProfile, hasDebugBackup } = await import('../src/game/debug-profile.js');
const { SHIPS, paintsFor } = await import('../src/game/ships.js');
const { CLASSES, ALL_PASSIVES, passiveUnlocked } = await import('../src/game/pilot.js');
const { RELICS } = await import('../src/game/collectables.js');
const { UPGRADES, isDiscovered } = await import('../src/game/upgrades.js');
const { ACHIEVEMENTS } = await import('../src/game/achievements.js');
const { treeFor, treePoints, sanitizeTrees } = await import('../src/game/tree.js');
const { rankFor, RANK_CAP } = await import('../src/game/economy.js');
const { TIER_CAP } = await import('../src/game/core.js');

test('unlock covers progression gates and restores the original snapshot after repeat unlocks', () => {
  profile.best = 12345;
  const original = JSON.parse(JSON.stringify(profile));
  unlockEverything();
  assert.equal(hasDebugBackup(), true);
  assert.ok(SHIPS.every((s) => profile.ownedShips.includes(s.id)));
  for (const s of SHIPS) assert.equal(profile.paintsOwned[s.id].length, paintsFor(s).length);
  assert.ok(UPGRADES.every((u) => isDiscovered(u.id)));
  assert.ok(RELICS.every((r) => profile.relics.includes(r.id)));
  assert.ok(ACHIEVEMENTS.every((a) => profile.ach[a.id]));
  assert.equal(rankFor(profile.rankXp).rank, RANK_CAP);
  assert.equal(profile.pilot.found.length, ALL_PASSIVES.length);
  assert.equal(profile.tierMax, TIER_CAP);
  for (const c of CLASSES) {
    assert.ok(c.passives.every((p) => passiveUnlocked(c, p)));
    assert.ok(treePoints() >= treeFor(c.id).nodes.size);
  }
  sanitizeTrees();
  profile.credits += 10;
  unlockEverything();
  profile.settings.music = 0.2;
  const settings = { ...profile.settings };
  restoreDebugProfile();
  assert.deepEqual(profile, { ...original, settings });
  assert.equal(hasDebugBackup(), false);
  assert.deepEqual(JSON.parse(entries.get('neon-overdrive/profile/v3')), profile);
});

test('unavailable backup storage cancels unlock without altering progression', () => {
  const original = JSON.stringify(profile);
  const setItem = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('quota'); };
  try {
    assert.throws(unlockEverything, /backup could not be saved/);
    assert.equal(JSON.stringify(profile), original);
  } finally { localStorage.setItem = setItem; }
});
