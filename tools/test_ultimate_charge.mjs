import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { addEventListener() {} };
const { G } = await import('../src/game/state.js');
const { gainOverdrive, activateOverdrive } = await import('../src/game/player.js');
const { updatePickups } = await import('../src/game/pickups.js');
const { ultCap } = await import('../src/game/pilot.js');

function player(overrides = {}) {
  G.player = { x: 225, y: 200, od: 0, odT: 0, dead: false, st: { odGain: 1, ultCells: 3, magnet: 100 }, ...overrides };
  G.pickups = [];
  return G.player;
}

test('routine charge is halved, respects build bonuses and caps at bank capacity', () => {
  const p = player();
  gainOverdrive(30);
  assert.equal(p.od, 15);
  p.st.odGain = 2;
  gainOverdrive(30);
  assert.equal(p.od, 45);
  gainOverdrive(1000);
  assert.equal(p.od, ultCap(p));
});

test('active and dead players gain no charge; charging resumes when the ultimate ends', () => {
  const p = player({ od: 80, odT: 4 });
  gainOverdrive(30);
  assert.equal(p.od, 80);
  activateOverdrive(p);
  assert.equal(p.odT, 4);
  p.odT = 0;
  gainOverdrive(30);
  assert.equal(p.od, 95);
  p.dead = true;
  gainOverdrive(30);
  assert.equal(p.od, 95);
});

test('cells are consumed without charge during an ultimate and give reduced charge afterward', () => {
  const p = player({ odT: 4, cls: 'striker' });
  G.texts = [];
  const cell = () => ({ type: 'cell', x: p.x, y: p.y, vx: 0, vy: 0, t: 0, pull: true, dead: false, life: 9 });
  G.pickups.push(cell());
  updatePickups(1 / 60);
  assert.equal(G.pickups.length, 0);
  assert.equal(p.od, 0);
  p.odT = 0;
  G.pickups.push(cell());
  updatePickups(1 / 60);
  assert.equal(G.pickups.length, 0);
  assert.equal(p.od, 15);
});
