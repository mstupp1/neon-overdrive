/**
 * PLAYER LOGIC
 */

function setPlayerStartPosition() {
    const topLimit = hudTopHeight + PLAYFIELD_TOP_BUFFER + player.radius;
    const targetBottomY = height - PLAYFIELD_BOTTOM_PADDING - PLAYER_START_BOTTOM_OFFSET;
    player.x = width / 2;
    player.y = Math.max(topLimit, targetBottomY);
}

function clampPlayerToPlayfield({ dampenVelocity = false } = {}) {
    const leftBound = PLAYFIELD_SIDE_PADDING;
    const rightBound = width - PLAYFIELD_SIDE_PADDING;
    const topBound = hudTopHeight + PLAYFIELD_TOP_BUFFER;
    const bottomBound = height - PLAYFIELD_BOTTOM_PADDING;

    if (player.x < leftBound) { player.x = leftBound; if (dampenVelocity && player.vx < 0) player.vx = 0; }
    if (player.x > rightBound) { player.x = rightBound; if (dampenVelocity && player.vx > 0) player.vx = 0; }
    if (player.y < topBound) { player.y = topBound; if (dampenVelocity && player.vy < 0) player.vy = 0; }
    if (player.y > bottomBound) { player.y = bottomBound; if (dampenVelocity && player.vy > 0) player.vy = 0; }
}

function getPlayerBulletStats(subType, baseSpeed, levelOverride = null) {
    const base = PLAYER_WEAPON_BASE[subType] || PLAYER_WEAPON_BASE.normal;
    const scale = getWeaponLevelStats(levelOverride ?? player.powerLevel);
    return {
        speed: baseSpeed * scale.speed,
        damage: base.damage * scale.damage * player.stats.damageMult,
        pierce: base.pierce,
        tintHue: scale.hue,
        glow: scale.glow
    };
}

function spawnPlayerBullet(x, y, angle, baseSpeed, subType) {
    const stats = getPlayerBulletStats(subType, baseSpeed);
    spawnBullet(x, y, angle, stats.speed, 'player', subType, {
        damage: stats.damage,
        pierce: stats.pierce,
        tintHue: stats.tintHue,
        glow: stats.glow
    });
}

function firePlayerWeapons() {
    if (gameState === 'PLAYING') playSound('shoot');

    // Fire rate modifier affects the frame check
    // Since we use modulo, we can't easily change the modulus dynamically without sync issues
    // Instead, we can use a probabilistic approach or a separate timer.
    // For simplicity, let's just use the multiplier to potentially fire EXTRA bullets or increase speed?
    // No, "Attack Speed" usually means fire rate.
    // Let's use a global fire timer or modify the modulo check.
    // A simple way: `frameCount * fireRateMult % interval < fireRateMult`? No.
    // Better: `Math.floor(frameCount * player.stats.fireRateMult) % interval === 0`

    const fr = player.stats.fireRateMult;
    const tick = Math.floor(frameCount * fr);

    spawnPlayerBullet(player.x, player.y - 20, -Math.PI / 2, 18, 'beam');

    if (player.powerLevel >= 2) {
        spawnPlayerBullet(player.x - 15, player.y, -1.7, 15, 'normal');
        spawnPlayerBullet(player.x + 15, player.y, -1.4, 15, 'normal');
    }
    if (player.powerLevel >= 3 && tick % 14 === 0) {
        spawnPlayerBullet(player.x, player.y - 20, -1.6, 10, 'blade');
        spawnPlayerBullet(player.x, player.y - 20, -1.5, 10, 'blade');
    }
    if (player.powerLevel >= 4 && tick % 21 === 0) {
        spawnPlayerBullet(player.x - 20, player.y, Math.PI, 12, 'homing');
        spawnPlayerBullet(player.x + 20, player.y, 0, 12, 'homing');
    }
    if (player.powerLevel >= 5 && tick % 21 === 0) {
        spawnPlayerBullet(player.x, player.y - 10, -Math.PI / 2, 12, 'wave');
    }
    if (player.powerLevel >= 6) {
        spawnPlayerBullet(player.x - 10, player.y - 20, -Math.PI / 2, 18, 'beam');
        spawnPlayerBullet(player.x + 10, player.y - 20, -Math.PI / 2, 18, 'beam');
    }
    if (player.powerLevel >= 7 && tick % 10 === 0) {
        spawnPlayerBullet(player.x - 22, player.y - 12, -1.55, 18, 'beam');
        spawnPlayerBullet(player.x + 22, player.y - 12, -1.59, 18, 'beam');
    }
    if (player.powerLevel >= 8 && tick % 18 === 0) {
        spawnPlayerBullet(player.x, player.y + 6, Math.PI, 12, 'wave');
    }
    if (player.powerLevel >= 9 && tick % 16 === 0) {
        spawnPlayerBullet(player.x - 28, player.y - 18, -1.35, 17, 'normal');
        spawnPlayerBullet(player.x + 28, player.y - 18, -1.8, 17, 'normal');
    }
    if (player.powerLevel >= 10 && tick % 24 === 0) {
        spawnPlayerBullet(player.x, player.y - 26, -Math.PI / 2, 24, 'beam');
        spawnPlayerBullet(player.x - 6, player.y - 26, -Math.PI / 2, 24, 'beam');
        spawnPlayerBullet(player.x + 6, player.y - 26, -Math.PI / 2, 24, 'beam');
    }
}

function awardWeaponXp(xpGain) {
    if (gameState !== 'PLAYING' || xpGain <= 0) return;

    if (player.powerLevel >= player.maxPower) {
        player.weaponXp = player.weaponXpMax;
        return;
    }

    player.weaponXp += xpGain;

    while (player.powerLevel < player.maxPower && player.weaponXp >= player.weaponXpMax) {
        player.weaponXp -= player.weaponXpMax;

        if (xpFill) {
            xpFill.style.transition = 'none';
            setTimeout(() => xpFill.style.transition = 'width 0.2s ease-out', 50);
        }

        player.powerLevel++;
        player.weaponXpMax = getWeaponXpForLevel(player.powerLevel);
        spawnText(player.x, player.y - 40, "UPGRADE", "#0ff");
        playSound('powerup');
    }

    if (player.powerLevel >= player.maxPower) player.weaponXp = player.weaponXpMax;
}

function awardPlayerXp(amount) {
    if (gameState !== 'PLAYING') return;

    player.xp += amount;
    if (player.xp >= player.xpMax) {
        player.xp -= player.xpMax;
        player.level++;
        player.xpMax = Math.floor(player.xpMax * CHAR_XP_GROWTH);
        triggerLevelUp();
    }
}

function triggerLevelUp() {
    gameState = 'LEVEL_UP';
    uiLayer.classList.add('hidden');
    document.getElementById('level-up-menu').classList.remove('hidden');
    updateMenuSelection();
    updateLevelUpStats(null);
    playSound('powerup'); // Reuse powerup sound or add new one
    updateDebugPanelVisibility();
}

function applyUpgrade(type) {
    if (type === 'hp') {
        player.stats.hpMax += 1;
        player.lives += 1;
        spawnText(player.x, player.y, "MAX HP UP", "#f00");
    } else if (type === 'damage') {
        player.stats.damageMult += 0.1;
        spawnText(player.x, player.y, "DAMAGE UP", "#f00");
    } else if (type === 'speed') {
        player.stats.fireRateMult += 0.1;
        spawnText(player.x, player.y, "SPEED UP", "#ff0");
    }

    document.getElementById('level-up-menu').classList.add('hidden');
    uiLayer.classList.remove('hidden');
    gameState = 'PLAYING';
    updateUI();
    updateDebugPanelVisibility();
}

// Expose for HTML onclick
window.selectUpgrade = applyUpgrade;

function hitPlayer() {
    if (gameState === 'DEMO') return; // Invincible in demo

    if (player.hasShield) {
        player.hasShield = false;
        playSound('shieldBreak');
        createExplosionLogic(player.x, player.y, '#00f', 20);
        player.iframes = 60;
        spawnText(player.x, player.y - 50, "SHIELD DOWN", "#00f");
        return;
    }

    player.lives--;
    player.iframes = 120;
    playSound('hit');
    flashOverlay.style.opacity = 0.5; setTimeout(() => flashOverlay.style.opacity = 0, 100);
    createExplosionLogic(player.x, player.y, '#f00', 25);

    if (player.powerLevel > 1) {
        player.powerLevel--;
        player.weaponXpMax = getWeaponXpForLevel(player.powerLevel);
        player.weaponXp = Math.min(player.weaponXp, Math.floor(player.weaponXpMax * 0.5));
        spawnPowerup(player.x, player.y, 'weapon', true);
        spawnText(player.x, player.y - 50, "SYSTEM DMG", "#f00");
    }
    updateUI();
    if (player.lives <= 0) {
        gameState = 'GAMEOVER';
        uiLayer.classList.add('hidden');
        pauseMenu.classList.add('hidden');
        pauseBtn.classList.remove('active');
        gameOverMenu.classList.remove('hidden');
        finalScoreDisplay.innerText = score;
        updateMenuSelection();
        updateDebugPanelVisibility();
    }
}

// --- Input Handling ---

function handleStart(x, y) {
    input.active = true;
    const pos = toGameCoords(x, y);
    input.lastX = pos.x;
    input.lastY = pos.y;
}
function handleMove(x, y) {
    if (!input.active) return;
    const pos = toGameCoords(x, y);
    input.lastX = pos.x;
    input.lastY = pos.y;
}
function handleEnd() { input.active = false; }

window.addEventListener('mousedown', e => handleStart(e.clientX, e.clientY));
window.addEventListener('mousemove', e => handleMove(e.clientX, e.clientY));
window.addEventListener('mouseup', handleEnd);

window.addEventListener('touchstart', e => {
    handleStart(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });
window.addEventListener('touchmove', e => {
    e.preventDefault(); // Prevent scrolling
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });
window.addEventListener('touchend', handleEnd);

// Keyboard Controls
window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') { keys.up = true; keys.w = true; }
    if (key === 'arrowdown' || key === 's') { keys.down = true; keys.s = true; }
    if (key === 'arrowleft' || key === 'a') { keys.left = true; keys.a = true; }
    if (key === 'arrowright' || key === 'd') { keys.right = true; keys.d = true; }
});

window.addEventListener('keyup', e => {
    const key = e.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') { keys.up = false; keys.w = false; }
    if (key === 'arrowdown' || key === 's') { keys.down = false; keys.s = false; }
    if (key === 'arrowleft' || key === 'a') { keys.left = false; keys.a = false; }
    if (key === 'arrowright' || key === 'd') { keys.right = false; keys.d = false; }
});
