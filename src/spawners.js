/**
 * SPAWNERS & GAME LOGIC HELPERS
 */

function spawnBullet(x, y, angle, speed, type, subType, opts) {
    bullets.push(bulletPool.get(x, y, angle, speed, type, subType, opts));
}

function spawnEnemyEntity(type) { enemies.push(enemyPool.get(type)); }
function spawnParticle(...args) { particles.push(particlePool.get(...args)); }
function spawnPowerup(...args) { powerups.push(powerupPool.get(...args)); }
function spawnText(...args) { texts.push(textPool.get(...args)); }

function spawnEnemyLogic() {
    const chance = Math.random();
    let type = 'chaser';

    // In DEMO, always allow all types for variety
    const effectiveScore = gameState === 'DEMO' ? 5000 : score;

    // Performance Cap for Demo
    if (gameState === 'DEMO' && enemies.length > 30) return;

    if (effectiveScore > 500 && chance > 0.6) type = 'spinner';
    if (effectiveScore > 1000 && chance > 0.8) type = 'dasher';
    if (effectiveScore > 2000 && chance > 0.85) type = 'snake';
    if (effectiveScore > 3000 && chance > 0.9) type = 'sniper';
    spawnEnemyEntity(type);
}

function createExplosionLogic(x, y, color, count) {
    for (let i = 0; i < count; i++) spawnParticle(x, y, color);
}

function triggerBombLogic() {
    playSound('bomb');
    flashOverlay.style.opacity = 1;
    setTimeout(() => flashOverlay.style.opacity = 0, 500);

    enemies.forEach(e => {
        e.active = false;
        // Enhanced bomb explosion particles
        createExplosionLogic(e.x, e.y, '#ff0', 20);
        createExplosionLogic(e.x, e.y, '#fff', 8);
        createExplosionLogic(e.x, e.y, '#ff9c2a', 12);
    });
    bullets.forEach(b => {
        if (b.type === 'enemy') {
            b.active = false;
            createExplosionLogic(b.x, b.y, '#ff0', 2);
        }
    });

    score += 2000;
    updateUI();
    spawnText(width / 2, height / 2, "OMEGA BLAST", "#ff0");
}
