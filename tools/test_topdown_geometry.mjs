import assert from 'node:assert/strict';
import test from 'node:test';
import * as geometry from '../src/game/topdownGeometry.js';

test('top-down target mapping preserves composition across short and tall fields', () => {
  const cases = [
    { height: 500, y: 100, expected: 200 },
    { height: 896, y: 100, expected: 299 },
  ];
  for (const { height, y, expected } of cases) {
    assert.equal(geometry.topdownTargetY(y, height), expected);
  }

  assert.equal(geometry.topdownHorizon(500), 125);
  assert.equal(geometry.topdownHorizon(896), 224);
  assert.equal(geometry.topdownCombatTop(500), 149);
  assert.equal(geometry.topdownCombatTop(896), 248);
  assert.equal(geometry.topdownTargetY(-500, 500), 173, 'targets clamp below the combat top by their radius');
  assert.equal(geometry.topdownTargetY(1200, 500), 476, 'targets clamp above the bottom playable margin');
  assert.equal(geometry.topdownTargetY(100, 500, 20, 30, 18), 180.2, 'safe areas and enemy radius affect mapping bounds');
});

