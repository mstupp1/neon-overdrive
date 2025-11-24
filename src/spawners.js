/**
 * SPAWNERS & GAME LOGIC HELPERS
 */

function spawnBullet(x, y, angle, speed, type, subType, opts) {
  bullets.push(bulletPool.get(x, y, angle, speed, type, subType, opts));
}

function spawnEnemyEntity(type) {
  enemies.push(enemyPool.get(type));
}
function spawnParticle(...args) {
  particles.push(particlePool.get(...args));
}
function spawnPowerup(...args) {
  const p = powerupPool.get(...args);
  powerups.push(p);
  return p;
}
function spawnText(...args) {
  texts.push(textPool.get(...args));
}

function spawnEnemyLogic() {
  if (debugNoEnemySpawns) return;

  // In DEMO, always allow all types for variety
  if (gameState === 'DEMO') {
    if (enemies.length > 30) return;
    const types = ['chaser', 'spinner', 'dasher', 'snake', 'sniper'];
    const type = types[Math.floor(Math.random() * types.length)];
    spawnEnemyEntity(type);
    return;
  }

  const stats = levelManager.getCurrentStats();
  const allowedTypes = stats.types;

  // Weighted random selection could be better, but for now uniform is fine
  // or maybe bias towards 'chaser' as fodder
  let type = allowedTypes[Math.floor(Math.random() * allowedTypes.length)];

  // Simple bias: 50% chance to just be a chaser if available
  if (allowedTypes.includes('chaser') && Math.random() < 0.5) {
    type = 'chaser';
  }

  spawnEnemyEntity(type);
}

function createExplosionLogic(x, y, color, count) {
  // Desktop optimized to 75% (vs mobile 50%, original 100%)
  const finalCount = IS_MOBILE
    ? Math.ceil(count * 0.5)
    : IS_DESKTOP
    ? Math.ceil(count * 0.75)
    : count;
  for (let i = 0; i < finalCount; i++) spawnParticle(x, y, color);
}

function createDashParticles(x, y, color, count) {
  // Fixed-size particles for dash effect (no upward boost scaling)
  const finalCount = IS_MOBILE
    ? Math.ceil(count * 0.5)
    : IS_DESKTOP
    ? Math.ceil(count * 0.75)
    : count;
  const fixedSize = 5; // Fixed size for consistent dash effect
  const speed = 4; // Slightly slower for dash particles
  for (let i = 0; i < finalCount; i++) {
    spawnParticle(x, y, color, speed, fixedSize, true); // true = isDashParticle flag
  }
}

function triggerBombLogic() {
  playSound('bomb');
  flashOverlay.style.opacity = 1;
  setTimeout(() => (flashOverlay.style.opacity = 0), 500);

  enemies.forEach((e) => {
    e.active = false;
    // Enhanced bomb explosion particles
    createExplosionLogic(e.x, e.y, '#ff0', 20);
    createExplosionLogic(e.x, e.y, '#fff', 8);
    createExplosionLogic(e.x, e.y, '#ff9c2a', 12);
  });
  bullets.forEach((b) => {
    if (b.type === 'enemy') {
      b.active = false;
      createExplosionLogic(b.x, b.y, '#ff0', 2);
    }
  });

  score += 2000;
  updateUI();
  spawnText(width / 2, height / 2, 'OMEGA BLAST', '#ff0');
}
