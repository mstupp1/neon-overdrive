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

    let damageMult = player.stats.damageMult;

    // Passive: Perfectionist (+50% dmg at full health)
    if (player.passives.has('damageFullHp') && player.lives >= player.stats.hpMax) {
        damageMult += 0.5;
    }

    // Passive: Berserker (+100% dmg at low health)
    if (player.passives.has('damageLowHp')) {
        const missingHpPercent = 1 - (player.lives / player.stats.hpMax);
        damageMult += missingHpPercent; // Up to +100%
    }

    // Passive: Kinetic Boost (more damage with speed)
    if (player.passives.has('speedDamage')) {
        const speed = Math.hypot(player.vx, player.vy);
        const speedRatio = speed / PLAYER_MAX_SPEED;
        damageMult += speedRatio * 0.5; // Up to +50% at max speed
    }

    return {
        speed: baseSpeed * scale.speed,
        damage: base.damage * scale.damage * damageMult,
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

    const fr = player.stats.fireRateMult;
    const tick = Math.floor(frameCount * fr);

    // Levels 0-2: Single beam
    // Levels 3-5: Double beam
    // Levels 6-7: Triple shot (front) - fires every frame
    // Levels 8-9: Crescent wave (replaces triple) - fires every frame
    // Level 10: Thick continuous beam (replaces crescent) - fires every frame

    // --- BASE FRONT SHOTS ---
    if (player.powerLevel >= 10) {
        // Level 10: Thick continuous beam firing every frame
        spawnPlayerBullet(player.x, player.y - 20, -Math.PI / 2, 22, 'beam');
        spawnPlayerBullet(player.x - 4, player.y - 20, -Math.PI / 2, 22, 'beam');
        spawnPlayerBullet(player.x + 4, player.y - 20, -Math.PI / 2, 22, 'beam');
    } else if (player.powerLevel >= 8) {
        // Level 8-9: Crescent wave shot (replaces triple) - fires every frame
        // Frontal crescent wave - 5 bullets in arc
        const arcSpread = Math.PI / 8; // Tightened spread
        for (let i = -2; i <= 2; i++) {
            const angle = -Math.PI / 2 + (i * arcSpread / 4);
            spawnPlayerBullet(player.x + i * 3, player.y - 18, angle, 18, 'wave');
        }
    } else if (player.powerLevel >= 6) {
        // Level 6-7: Triple shot - fires every frame
        spawnPlayerBullet(player.x, player.y - 22, -Math.PI / 2, 20, 'normal');
        spawnPlayerBullet(player.x - 8, player.y - 18, -Math.PI / 2 - 0.1, 18, 'normal');
        spawnPlayerBullet(player.x + 8, player.y - 18, -Math.PI / 2 + 0.1, 18, 'normal');
    } else if (player.powerLevel >= 3) {
        // Level 3-5: Double beam
        spawnPlayerBullet(player.x - 5, player.y - 20, -Math.PI / 2, 18, 'beam');
        spawnPlayerBullet(player.x + 5, player.y - 20, -Math.PI / 2, 18, 'beam');
    } else {
        // Level 0-2: Single beam
        spawnPlayerBullet(player.x, player.y - 20, -Math.PI / 2, 18, 'beam');
    }

    // --- LEVEL 2+ ANGLED SPREAD ---
    if (player.powerLevel >= 2) {
        spawnPlayerBullet(player.x - 15, player.y, -1.67, 15, 'normal');
        spawnPlayerBullet(player.x + 15, player.y, -1.47, 15, 'normal');
    }

    // --- LEVEL 4+ BLADE SHOTS ---
    if (player.powerLevel >= 4 && tick % 14 === 0) {
        spawnPlayerBullet(player.x, player.y - 20, -1.62, 10, 'blade');
        spawnPlayerBullet(player.x, player.y - 20, -1.52, 10, 'blade');
    }

    // --- LEVEL 5+ SIDE HOMING ---
    if (player.powerLevel >= 5 && tick % 21 === 0) {
        spawnPlayerBullet(player.x - 20, player.y, Math.PI, 12, 'homing');
        spawnPlayerBullet(player.x + 20, player.y, 0, 12, 'homing');
    }

    // --- LEVEL 7+ ARCING HOMING LASERS ---
    if (player.powerLevel >= 7 && tick % 35 === 0) {
        // Occasional arcing homing lasers that shoot from the front
        const arcAngle1 = -Math.PI / 2 - 0.25;
        const arcAngle2 = -Math.PI / 2 + 0.25;
        spawnPlayerBullet(player.x - 12, player.y - 24, arcAngle1, 14, 'homing');
        spawnPlayerBullet(player.x + 12, player.y - 24, arcAngle2, 14, 'homing');
    }

    // --- LEVEL 9+ FORWARD MISSILE ---
    if (player.powerLevel >= 9 && tick % 45 === 0) {
        // Forward missile with AOE effect
        spawnPlayerBullet(player.x, player.y - 15, -Math.PI / 2, 16, 'missile');
    }

    // --- LEVEL 10+ LIGHTNING BOLTS ---
    if (player.powerLevel >= 10 && tick % 8 === 0) {
        // Additional lightning-style rapid fire
        spawnPlayerBullet(player.x - 18, player.y - 15, -Math.PI / 2 - 0.15, 24, 'beam');
        spawnPlayerBullet(player.x + 18, player.y - 15, -Math.PI / 2 + 0.15, 24, 'beam');
    }

    // --- PASSIVE: WINGMEN ---
    if (player.passives.has('sidekicks') && player.sidekicks) {
        player.sidekicks.forEach(sk => {
            // Sidekicks fire simple lasers every 20 frames
            if (tick % 20 === 0) {
                spawnPlayerBullet(sk.x, sk.y - 10, -Math.PI / 2, 16, 'beam');
            }
        });
    }
}

function awardWeaponXp(xpGain) {
    if (gameState !== 'PLAYING' || xpGain <= 0) return;

    if (player.powerLevel >= player.maxPower) {
        player.weaponXp = player.weaponXpMax;
        return;
    }

    player.weaponXp += xpGain * player.stats.weaponXpMult;

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

    player.xp += amount * player.stats.playerXpMult;
    if (player.xp >= player.xpMax) {
        player.xp -= player.xpMax;
        player.level++;
        player.xpMax = Math.floor(player.xpMax * CHAR_XP_GROWTH);
        triggerLevelUp();
    }
}

function triggerLevelUp() {
    // Always grant +1 max health on level up
    player.stats.hpMax += 1;
    player.lives = player.stats.hpMax; // Full heal

    gameState = 'LEVEL_UP';
    uiLayer.classList.add('hidden');
    document.getElementById('level-up-menu').classList.remove('hidden');
    showLevelUpOptions();
    playSound('powerup'); // Reuse powerup sound or add new one
}

function applyUpgrade(type) {
    if (type === 'hp') {
        player.stats.hpMax += 1;
        player.lives = player.stats.hpMax;
        spawnText(player.x, player.y, "MAX HP UP", "#f00");
    } else if (type === 'damage') {
        player.stats.damageMult += 0.1;
        spawnText(player.x, player.y, "DAMAGE UP", "#f00");
    } else if (type === 'speed') {
        player.stats.fireRateMult += 0.1;
        spawnText(player.x, player.y, "SPEED UP", "#ff0");
    } else if (type === 'moveSpeed') {
        player.stats.moveSpeedMult += 0.1;
        spawnText(player.x, player.y, "MOVE SPEED UP", "#0ff");
    } else if (type === 'weaponXp') {
        player.stats.weaponXpMult += 0.1;
        spawnText(player.x, player.y, "WEAPON XP UP", "#9e0");
    } else if (type === 'playerXp') {
        player.stats.playerXpMult += 0.1;
        spawnText(player.x, player.y, "PLAYER XP UP", "#9e0");
    }

    document.getElementById('level-up-menu').classList.add('hidden');
    uiLayer.classList.remove('hidden');
    gameState = 'PLAYING';
    updateUI();
}

function applyPassive(id) {
    player.passives.add(id);

    // Immediate effects
    if (id === 'doubleHp') {
        player.stats.hpMax *= 2;
        player.lives = player.stats.hpMax; // Heal to full? Or just double current? Description says "Doubles your max hp", usually implies heal too or just max increase. Let's do max increase + heal to new max for "Titan Hull" feel.
        spawnText(player.x, player.y, "MAX HP DOUBLED", "#0f0");
    } else if (id === 'smallSize') {
        player.radius *= 0.75;
        // Visual scale handled in draw? Or just hitbox?
        // Let's reduce hitbox radius. Visuals might need adjustment if we want it to look smaller.
        // We can add a scale factor to player for drawing.
        player.scale = (player.scale || 1) * 0.75;
        spawnText(player.x, player.y, "SHRUNK", "#0ff");
    } else if (id === 'sidekicks') {
        // Initialize sidekicks
        player.sidekicks = [
            { x: player.x - 30, y: player.y + 10, offset: -30 },
            { x: player.x + 30, y: player.y + 10, offset: 30 }
        ];
        spawnText(player.x, player.y, "WINGMEN DEPLOYED", "#ff0");
    } else {
        spawnText(player.x, player.y, "PASSIVE ACQUIRED", "#fff");
    }

    document.getElementById('stage-complete-menu').classList.add('hidden');
    uiLayer.classList.remove('hidden');
    gameState = 'PLAYING';
    updateUI();

    // Fade music back in after passive select (only in late game - stage 7+)
    if (levelManager.currentLevel >= 7) {
        MusicPlayer.fadeInAfterPassiveSelect();
    }

    // Advance level logic
    levelManager.advanceLevel();
}

// Expose for HTML onclick
window.selectUpgrade = applyUpgrade;
window.applyPassive = applyPassive;

function hitPlayer() {
    if (player.godMode) return;
    if (gameState === 'DEMO') return; // Invincible in demo

    if (player.hasShield) {
        // Passive: Hardened Shield
        if (player.passives.has('strongerShield') && !player.shieldDamaged) {
            player.shieldDamaged = true;
            playSound('shieldBreak'); // Maybe different sound?
            spawnText(player.x, player.y - 50, "SHIELD HOLDING", "#0af");
            player.iframes = 30; // Brief iframe
            return;
        }

        player.hasShield = false;
        player.shieldDamaged = false; // Reset state
        playSound('shieldBreak');
        createExplosionLogic(player.x, player.y, '#00f', 20);
        player.iframes = 60;
        spawnText(player.x, player.y - 50, "SHIELD DOWN", "#00f");

        // Reset auto shield timer on hit
        player.autoShieldTimer = 0;
        return;
    }

    player.lives--;
    player.iframes = 120;

    // Reset auto shield timer on hit
    player.autoShieldTimer = 0;

    // Passive: Shockwave
    if (player.passives.has('killNearby')) {
        // Check cooldown? Description said 10s cooldown.
        const now = Date.now();
        if (!player.lastShockwaveTime || now - player.lastShockwaveTime > 10000) {
            player.lastShockwaveTime = now;

            // Kill all nearby enemies
            enemies.forEach(e => {
                if (e.active && dist(player.x, player.y, e.x, e.y) < 250) {
                    e.hp = 0; // Instant kill
                    createExplosionLogic(e.x, e.y, '#f0f', 10);
                }
            });

            // Visual shockwave
            createExplosionLogic(player.x, player.y, '#f0f', 50);
            spawnText(player.x, player.y - 60, "SHOCKWAVE", "#f0f");
        }
    }

    playSound('hit');
    flashOverlay.style.opacity = 0.5; setTimeout(() => flashOverlay.style.opacity = 0, 100);
    createExplosionLogic(player.x, player.y, '#f00', 25);

    updateUI();

    // Check if player has run out of lives
    if (player.lives <= 0) {
        gameState = 'GAMEOVER';
        uiLayer.classList.add('hidden');
        pauseMenu.classList.add('hidden');
        pauseBtn.classList.remove('active');
        gameOverMenu.classList.remove('hidden');
        finalScoreDisplay.innerText = score;
        updateMenuSelection();
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
