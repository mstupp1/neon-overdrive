/**
 * MAIN GAME LOOP & STATE MANAGEMENT
 */

function resetWorldState() {
    bullets.forEach(b => bulletPool.release(b)); bullets.length = 0;
    enemies.forEach(e => enemyPool.release(e)); enemies.length = 0;
    particles.forEach(p => particlePool.release(p)); particles.length = 0;
    powerups.forEach(p => powerupPool.release(p)); powerups.length = 0;
    texts.forEach(t => textPool.release(t)); texts.length = 0;
    player.tail.length = 0;
    levelManager.reset();
}

function pauseGame() {
    if (gameState !== 'PLAYING') return;
    gameState = 'PAUSED';
    uiLayer.classList.add('hidden');
    pauseMenu.classList.remove('hidden');
    pauseBtn.classList.add('active');
    updateMenuSelection();
}

function resumeGame() {
    if (gameState !== 'PAUSED') return;
    gameState = 'PLAYING';
    pauseMenu.classList.add('hidden');
    uiLayer.classList.remove('hidden');
    pauseBtn.classList.remove('active');
    lastTime = performance.now();
    accumulator = 0;
}

function returnToMenu() {
    gameState = 'MENU';
    pauseMenu.classList.add('hidden');
    gameOverMenu.classList.add('hidden');
    startMenu.classList.remove('hidden');
    uiLayer.classList.add('hidden');
    pauseBtn.classList.remove('active');
    updateMenuSelection();

    score = 0; player.lives = PLAYER_MAX_LIVES; player.powerLevel = 0; player.iframes = 0; player.hasShield = false;
    player.weaponXp = 0; player.weaponXpMax = getWeaponXpForLevel(player.powerLevel);
    if (xpFill) { xpFill.style.transition = 'none'; setTimeout(() => xpFill.style.transition = 'width 0.2s ease-out', 50); }
    setPlayerStartPosition(); player.vx = 0; player.vy = 0; player.tilt = 0;

    resetWorldState();
    buildPowerSegments();
    updateUI();

    // Stop background music
    MusicPlayer.stop();
}

function initGame() {
    if (document.activeElement) document.activeElement.blur();
    score = 0; player.lives = PLAYER_MAX_LIVES; player.powerLevel = 0; player.iframes = 0; player.hasShield = false;
    player.weaponXp = 0; player.weaponXpMax = getWeaponXpForLevel(player.powerLevel);
    player.level = 1; player.xp = 0; player.xpMax = CHAR_XP_BASE;
    player.stats = { damageMult: 1.0, hpMax: PLAYER_MAX_LIVES, fireRateMult: 1.0, moveSpeedMult: 1.0, weaponXpMult: 1.0, playerXpMult: 1.0 };

    if (xpFill) { xpFill.style.transition = 'none'; setTimeout(() => xpFill.style.transition = 'width 0.2s ease-out', 50); }
    setPlayerStartPosition(); player.vx = 0; player.vy = 0; player.tilt = 0;

    resetWorldState();

    buildPowerSegments();
    updateUI();
    gameState = 'PLAYING';
    uiLayer.classList.remove('hidden');
    startMenu.classList.add('hidden');
    gameOverMenu.classList.add('hidden');
    pauseMenu.classList.add('hidden');
    document.getElementById('level-up-menu').classList.add('hidden');
    pauseBtn.classList.remove('active');

    lastTime = performance.now();
    accumulator = 0;

    // Start background music
    MusicPlayer.start();
}

function updateDemoAI() {
    // --- AI BEHAVIOR ---
    // 1. Base Bias: Stay in the bottom 20% of the screen (back row)
    let targetX = player.x;
    let targetY = height * 0.85; // Default "safe" Y

    // 2. Avoidance (Bullets & Enemies)
    let avoidX = 0;
    let avoidY = 0;
    let threatCount = 0;
    const detectionRadius = 150;

    // Check bullets
    bullets.forEach(b => {
        if (b.type === 'enemy' && b.active) {
            const d = dist(player.x, player.y, b.x, b.y);
            if (d < detectionRadius) {
                const angle = Math.atan2(player.y - b.y, player.x - b.x);
                const force = (detectionRadius - d) / detectionRadius;
                avoidX += Math.cos(angle) * force * 20; // Strong avoidance
                avoidY += Math.sin(angle) * force * 20;
                threatCount++;
            }
        }
    });

    // Check enemies (don't crash into them)
    enemies.forEach(e => {
        if (e.active) {
            const d = dist(player.x, player.y, e.x, e.y);
            if (d < detectionRadius + 20) {
                const angle = Math.atan2(player.y - e.y, player.x - e.x);
                const force = (detectionRadius - d) / detectionRadius;
                avoidX += Math.cos(angle) * force * 15;
                avoidY += Math.sin(angle) * force * 15;
                threatCount++;
            }
        }
    });

    // 3. Attraction (Powerups)
    let attractX = 0;
    let attractY = 0;
    let foundPowerup = false;
    powerups.forEach(p => {
        if (p.active && !foundPowerup) { // Target closest/first found
            const d = dist(player.x, player.y, p.x, p.y);
            if (d < 300) { // Only go for if reasonably close
                attractX = p.x - player.x;
                attractY = p.y - player.y;
                foundPowerup = true;
            }
        }
    });

    // --- COMBINE FORCES ---

    // If no immediate threats, drift towards center-ish X
    if (threatCount === 0 && !foundPowerup) {
        targetX = width / 2 + Math.sin(frameCount * 0.01) * 200;
    }

    // Apply forces
    let moveX = 0;
    let moveY = 0;

    if (threatCount > 0) {
        // Panic mode: Prioritize avoidance
        moveX = avoidX;
        moveY = avoidY;
    } else if (foundPowerup) {
        // Greed mode: Go for powerup
        moveX = attractX * 0.05;
        moveY = attractY * 0.05;
    } else {
        // Idle mode: Drift to base position
        moveX = (targetX - player.x) * 0.02;
        moveY = (targetY - player.y) * 0.02;
    }

    // Apply movement with smoothing
    player.x += moveX;
    player.y += moveY;
    clampPlayerToPlayfield();

    // Auto fire using the full weapon system
    if (frameCount % 7 === 0) {
        firePlayerWeapons();
    }

    // Always stay at top power in demo so new level 9/10 effects are visible
    player.powerLevel = player.maxPower;
}

function update(dt) {
    if (gameState !== 'PLAYING' && gameState !== 'DEMO') {
        // if (gameState !== 'LEVEL_UP') globalHue += 1; // Removed to keep theme stable
        return;
    }

    if (gameState === 'DEMO') {
        updateDemoAI();
    } else {
        levelManager.update();
    }

    cosmicBg.update();

    globalHue += 2;
    frameCount++;

    // Spawn logic: More intense in DEMO
    // Spawn logic: More intense in DEMO
    let spawnRate = Math.max(20, 60 - Math.floor(score / 300));
    if (gameState === 'PLAYING') {
        const stats = levelManager.getCurrentStats();
        spawnRate = Math.max(15, 60 * stats.spawnMod);
    }
    if (gameState === 'DEMO') spawnRate = 15; // Very fast spawn in demo

    if (frameCount % Math.floor(spawnRate) === 0) spawnEnemyLogic();

    // Engine trails
    if (frameCount % 2 === 0) player.tail.push({ x: player.x, y: player.y + 15, life: 1 });
    player.tail.forEach(t => t.life -= 0.1);
    player.tail = player.tail.filter(t => t.life > 0);

    // --- PLAYER MOVEMENT (KEYBOARD + TOUCH/MOUSE) ---
    if (gameState === 'PLAYING') {
        let accelX = 0;
        let accelY = 0;
        const accel = PLAYER_ACCEL * player.stats.moveSpeedMult;

        // Keyboard-driven acceleration
        if (keys.up || keys.w) accelY -= accel;
        if (keys.down || keys.s) accelY += accel;
        if (keys.left || keys.a) accelX -= accel;
        if (keys.right || keys.d) accelX += accel;

        // Pointer-driven acceleration toward last touch/mouse position
        if (input.active) {
            const dx = input.lastX - player.x;
            const dy = input.lastY - player.y;
            const distance = Math.hypot(dx, dy);
            if (distance > 2) {
                const steer = Math.min(accel, distance * 0.02);
                accelX += (dx / distance) * steer;
                accelY += (dy / distance) * steer;
            }
        }

        // Give upward movement a bit more punch
        if (accelY < 0) accelY *= PLAYER_ACCEL_UP_BOOST;
        if (accelY > 0) accelY *= PLAYER_ACCEL_DOWN_FACTOR;

        player.vx += accelX;
        player.vy += accelY;

        // Apply friction for floaty glide
        player.vx *= PLAYER_FRICTION;
        player.vy *= PLAYER_FRICTION;

        // Cap speed
        const maxSpeed = (player.vy < 0)
            ? PLAYER_MAX_SPEED_UP * player.stats.moveSpeedMult
            : (player.vy > 0 ? PLAYER_MAX_SPEED_DOWN * player.stats.moveSpeedMult : PLAYER_MAX_SPEED * player.stats.moveSpeedMult);
        const speed = Math.hypot(player.vx, player.vy);
        if (speed > maxSpeed) {
            const s = maxSpeed / speed;
            player.vx *= s; player.vy *= s;
        }

        player.x += player.vx;
        player.y += player.vy;
        // Clamp player position to screen bounds and damp velocity when hitting edges
        clampPlayerToPlayfield({ dampenVelocity: true });

        // Smooth tilt based purely on horizontal velocity (always lean into move direction)
        player.tiltDir = 1; // keep for compatibility, but fix orientation

        const absVx = Math.abs(player.vx);
        let targetTilt = player.tilt; // preserve current tilt inside deadzone
        if (absVx > PLAYER_TILT_DEADZONE) {
            const tiltNorm = Math.min(1, (absVx - PLAYER_TILT_DEADZONE) / (PLAYER_MAX_SPEED - PLAYER_TILT_DEADZONE));
            targetTilt = tiltNorm * PLAYER_TILT_MAX * Math.sign(player.vx) * player.tiltDir;
        } else {
            targetTilt *= PLAYER_TILT_DAMP; // gently settle toward neutral
        }

        player.tilt = player.tilt * (1 - PLAYER_TILT_BLEND) + targetTilt * PLAYER_TILT_BLEND;
    }

    // --- SHOOTING ---
    if (gameState === 'PLAYING' && frameCount % 7 === 0) {
        firePlayerWeapons();
    }
    if (player.iframes > 0) player.iframes--;

    // --- PASSIVE: REGENERATOR (Auto Shield) ---
    if (player.passives.has('autoShield') && !player.hasShield && gameState === 'PLAYING') {
        player.autoShieldTimer++;
        if (player.autoShieldTimer >= 300) { // 5 seconds at 60fps
            player.hasShield = true;
            player.autoShieldTimer = 0;
            playSound('powerup');
            spawnText(player.x, player.y - 40, "SHIELD REGEN", "#00f");
        }
    }

    // --- PASSIVE: WINGMEN (Sidekicks) ---
    if (player.passives.has('sidekicks') && player.sidekicks) {
        // Update sidekick positions to follow player with lag/smoothing
        player.sidekicks.forEach(sk => {
            const targetX = player.x + sk.offset;
            const targetY = player.y + 10;
            sk.x += (targetX - sk.x) * 0.1;
            sk.y += (targetY - sk.y) * 0.1;
        });
    }

    // Update Entities
    [bullets, enemies, particles, powerups, texts].forEach(arr => arr.forEach(e => e.update()));

    // Cleanup and Return to Pool
    function cleanList(list, pool) {
        for (let i = list.length - 1; i >= 0; i--) {
            if (!list[i].active) {
                pool.release(list[i]);
                list.splice(i, 1);
            }
        }
    }
    cleanList(bullets, bulletPool);
    cleanList(enemies, enemyPool);
    cleanList(particles, particlePool);
    cleanList(powerups, powerupPool);
    cleanList(texts, textPool);

    // Collisions
    bullets.forEach(b => {
        if (b.type === 'player') {
            enemies.forEach(e => {
                let hit = dist(b.x, b.y, e.x, e.y) < e.radius + b.radius + 5;
                if (e.type === 'snake') {
                    if (dist(b.x, b.y, e.x, e.y) < e.radius + b.radius) hit = true;
                    else e.segments.forEach(s => { if (dist(b.x, b.y, s.x, s.y) < e.radius + b.radius) hit = true; });
                }

                if (hit) {
                    // Check if this was a missile for AOE
                    const isMissile = b.subType === 'missile';

                    if (!b.pierce) b.active = false;
                    e.hp -= (b.damage ?? 1);

                    // Flash effect on damage
                    e.flashTimer = 8;

                    // Missile AOE explosion
                    if (isMissile) {
                        const aoeRadius = 60;
                        // Visual explosion for missile
                        createExplosionLogic(b.x, b.y, '#ff9c2a', 30);
                        createExplosionLogic(b.x, b.y, '#fff', 15);
                        createExplosionLogic(b.x, b.y, '#f60', 20);

                        // AOE damage to all nearby enemies
                        enemies.forEach(target => {
                            if (target.active && target !== e) {
                                const distance = dist(b.x, b.y, target.x, target.y);
                                if (distance < aoeRadius) {
                                    // Reduced damage for AOE
                                    const aoeDamage = (b.damage ?? 1) * 0.5;
                                    target.hp -= aoeDamage;
                                    target.flashTimer = 8;
                                    createExplosionLogic(target.x, target.y, '#ff9c2a', 3);
                                }
                            }
                        });
                    } else {
                        // Reduced impact effect for non-missiles
                        if (Math.random() < 0.3) createExplosionLogic(b.x, b.y, '#fff', 1);
                    }

                    if (e.hp <= 0 && e.active) {
                        e.active = false;
                        if (gameState === 'PLAYING') {
                            score += 100;
                        }
                        // Enhanced death explosion with more particles and variety
                        createExplosionLogic(e.x, e.y, `hsl(${globalHue},100%,50%)`, 25);
                        createExplosionLogic(e.x, e.y, '#fff', 10);
                        createExplosionLogic(e.x, e.y, `hsl(${globalHue + 60},100%,60%)`, 15);
                        createExplosionLogic(e.x, e.y, `hsl(${globalHue + 60},100%,60%)`, 15);

                        // Passive: Scavenger (Increased spawn rate)
                        let powerupChance = 0.03;
                        if (player.passives.has('spawnRate')) powerupChance = 0.08; // Significant boost
                        if (Math.random() < powerupChance) spawnPowerup(e.x, e.y);

                        // Passive: Shrapnel (Fragments)
                        if (player.passives.has('fragments')) {
                            const fragCount = 3;
                            for (let i = 0; i < fragCount; i++) {
                                const angle = Math.random() * Math.PI * 2;
                                spawnBullet(e.x, e.y, angle, 10, 'player', 'normal', {
                                    damage: 0.5 * player.stats.damageMult, // Half normal damage
                                    pierce: false,
                                    tintHue: 50, // Gold color
                                    glow: 0.1
                                });
                            }
                        }

                        // XP Logic
                        if (gameState === 'PLAYING') {
                            let xpGain = 10;
                            if (e.type === 'chaser') xpGain = 10;
                            else if (e.type === 'dasher') xpGain = 20;
                            else if (e.type === 'sniper') xpGain = 30;
                            else if (e.type === 'snake') xpGain = 40;
                            else if (e.type === 'spinner') xpGain = 50;

                            awardWeaponXp(xpGain);
                            awardPlayerXp(xpGain); // Award character XP too
                            updateUI();
                        }
                    }
                }
            });
            // Bullet-on-Bullet Collision (Destructible Enemy Bullets)
            bullets.forEach(eb => {
                if (eb.type === 'enemy' && eb.destructible && eb.active) {
                    if (dist(b.x, b.y, eb.x, eb.y) < b.radius + eb.radius) {
                        eb.active = false;
                        if (!b.pierce) b.active = false; // Blade/Wave pierce
                        createExplosionLogic(eb.x, eb.y, '#ff9c2a', 5);
                        if (gameState === 'PLAYING') score += 10;
                    }
                }
            });
        } else {
            if (player.iframes <= 0 && dist(b.x, b.y, player.x, player.y) < player.radius + 5) {
                b.active = false; hitPlayer();
                if (gameState === 'GAMEOVER') return; // Stop processing if player died
            }
        }
    });
    enemies.forEach(e => {
        let hit = dist(e.x, e.y, player.x, player.y) < e.radius + player.radius;
        if (e.type === 'snake') e.segments.forEach(s => { if (dist(s.x, s.y, player.x, player.y) < e.radius + player.radius) hit = true; });
        if (player.iframes <= 0 && hit) {
            hitPlayer();
            if (gameState === 'GAMEOVER') return; // Stop processing if player died
        }
    });
    powerups.forEach(p => {
        if (p.pickupTimer > 0) return; // Cannot pick up yet
        if (dist(p.x, p.y, player.x, player.y) < p.radius + 20) {
            p.active = false; playSound('powerup');
            if (p.type === 'weapon') {
                if (player.powerLevel < player.maxPower) {
                    player.powerLevel++;
                    player.weaponXpMax = getWeaponXpForLevel(player.powerLevel);
                    player.weaponXp = Math.min(player.weaponXp, player.weaponXpMax);
                    if (player.powerLevel >= player.maxPower) player.weaponXp = player.weaponXpMax;
                    spawnText(player.x, player.y - 40, "UPGRADE", "#0ff");
                }
                else { if (gameState === 'PLAYING') score += 1000; spawnText(player.x, player.y - 40, "+1000", "#fff"); }
            } else if (p.type === 'bomb') { triggerBombLogic(); }
            else if (p.type === 'shield') { player.hasShield = true; spawnText(player.x, player.y - 40, "SHIELD UP", "#00f"); }
            else if (p.type === 'life') {
                // Can't pick up life powerup if already dead
                if (player.lives <= 0) return;
                const prevLives = player.lives;
                player.lives = Math.min(player.stats.hpMax, player.lives + 1);
                if (player.lives > prevLives) spawnText(player.x, player.y - 40, "EXTEND", "#f00");
            } else if (p.type === 'score') {
                if (gameState === 'PLAYING') {
                    score += SCORE_POWERUP_VALUE;
                    const xpGain = Math.floor(player.weaponXpMax * SCORE_POWERUP_XP_RATIO);
                    awardWeaponXp(xpGain);
                }
                const xpLabel = gameState === 'PLAYING' ? `+${SCORE_POWERUP_VALUE} +XP` : `+${SCORE_POWERUP_VALUE}`;
                spawnText(player.x, player.y - 40, xpLabel, "#fd0");
            }
            if (gameState === 'PLAYING') updateUI();
        }
    });
}

function draw() {
    // Background
    // Apply scale for game world
    ctx.save();
    ctx.scale(GAME_SCALE, GAME_SCALE);

    cosmicBg.draw(ctx);

    let sx = 0, sy = 0; if (player.iframes > 0 && player.iframes % 4 === 0) { sx = rand(-5, 5); sy = rand(-5, 5); }
    ctx.save(); ctx.translate(sx, sy);

    // Grid - Optimized with warbling sin wave effect
    ctx.strokeStyle = `hsla(${globalHue}, 80%, 40%, 0.15)`; ctx.lineWidth = 1;
    const gs = 80; // Larger grid size

    if (IS_MOBILE) {
        // Simple grid for mobile
        ctx.beginPath();
        for (let x = 0; x <= width; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
        for (let y = 0; y <= height; y += gs) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
        ctx.stroke();
    } else {
        const waveAmp = 8; // Wave amplitude (how far lines move)
        const waveFreq = 0.015; // Wave frequency (how tight the waves are)
        const waveSpeed = frameCount * 0.03; // Animation speed

        ctx.beginPath();
        // Vertical lines with horizontal warble
        for (let x = 0; x <= width; x += gs) {
            ctx.moveTo(x + Math.sin(waveSpeed + x * waveFreq) * waveAmp, 0);
            for (let y = gs; y <= height; y += gs) {
                ctx.lineTo(x + Math.sin(waveSpeed + y * waveFreq + x * waveFreq) * waveAmp, y);
            }
        }
        // Horizontal lines with vertical warble
        for (let y = 0; y <= height; y += gs) {
            ctx.moveTo(0, y + Math.sin(waveSpeed + y * waveFreq) * waveAmp);
            for (let x = gs; x <= width; x += gs) {
                ctx.lineTo(x, y + Math.sin(waveSpeed + x * waveFreq + y * waveFreq) * waveAmp);
            }
        }
        ctx.stroke();
    }

    powerups.forEach(e => e.draw(ctx));
    particles.forEach(e => e.draw(ctx));
    bullets.forEach(e => e.draw(ctx));
    enemies.forEach(e => e.draw(ctx));
    texts.forEach(e => e.draw(ctx));

    // PLAYER DRAW
    if ((gameState === 'PLAYING' || gameState === 'DEMO' || gameState === 'PAUSED' || gameState === 'LEVEL_UP') && (player.iframes === 0 || Math.floor(frameCount / 4) % 2 === 0)) {
        ctx.save(); ctx.translate(player.x, player.y);

        // Engine Trails
        player.tail.forEach((t, i) => {
            ctx.globalAlpha = t.life * 0.6;
            ctx.fillStyle = '#0ff';
            ctx.beginPath(); ctx.arc(t.x - player.x, t.y - player.y, 6 * t.life, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;

        // SHIELD VISUAL
        if (player.hasShield) {
            ctx.rotate(frameCount * 0.1);
            ctx.strokeStyle = '#0af'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 35, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(0, 200, 255, 0.15)'; ctx.fill();
            ctx.rotate(-frameCount * 0.1);
        }

        // SHIP SPRITE
        ctx.save();
        ctx.rotate(player.tilt);
        ctx.fillStyle = '#fff';
        if (!IS_MOBILE) {
            ctx.shadowBlur = IS_DESKTOP ? 12 : 15; // Desktop optimized (12 vs 15)
            ctx.shadowColor = '#0ff';
        }

        ctx.beginPath();
        ctx.moveTo(0, -25);
        ctx.lineTo(8, 5);
        ctx.lineTo(16, 15);
        ctx.lineTo(8, 15);
        ctx.lineTo(6, 20);
        ctx.lineTo(-6, 20);
        ctx.lineTo(-8, 15);
        ctx.lineTo(-16, 15);
        ctx.lineTo(-8, 5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#022';
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(4, 5); ctx.lineTo(0, 8); ctx.lineTo(-4, 5); ctx.fill();

        if (!IS_MOBILE) {
            ctx.shadowBlur = IS_DESKTOP ? 16 : 20; // Desktop optimized (16 vs 20)
            ctx.fillStyle = '#0ff';
        } else {
            ctx.fillStyle = '#0ff';
        }
        ctx.fillRect(-5, 20, 3, 5); ctx.fillRect(2, 20, 3, 5);
        ctx.restore();

        ctx.restore();
        ctx.restore();
    }

    // --- PASSIVE: WINGMEN DRAW ---
    if ((gameState === 'PLAYING' || gameState === 'DEMO' || gameState === 'PAUSED' || gameState === 'LEVEL_UP' || gameState === 'STAGE_COMPLETE') && player.passives.has('sidekicks') && player.sidekicks) {
        player.sidekicks.forEach(sk => {
            ctx.save();
            ctx.translate(sk.x, sk.y);
            ctx.rotate(player.tilt); // Match player tilt
            ctx.scale(0.6, 0.6); // Smaller size

            // Draw mini ship (simplified player ship)
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(0, -25);
            ctx.lineTo(8, 5);
            ctx.lineTo(16, 15);
            ctx.lineTo(8, 15);
            ctx.lineTo(6, 20);
            ctx.lineTo(-6, 20);
            ctx.lineTo(-8, 15);
            ctx.lineTo(-16, 15);
            ctx.lineTo(-8, 5);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#0ff';
            ctx.fillRect(-5, 20, 3, 5); ctx.fillRect(2, 20, 3, 5);

            ctx.restore();
        });
    }

    ctx.restore();

    // Glitch Overlay - Desktop optimized (every 6 frames vs original 4)
    const glitchFreq = IS_DESKTOP ? 6 : 4;
    if (!IS_MOBILE && frameCount % glitchFreq === 0) { // Reduced frequency
        ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = `hsla(${globalHue + 180},100%,50%,0.05)`;
        ctx.fillRect(0, 0, width, height); ctx.globalCompositeOperation = 'source-over';
    }

    // DEMO OVERLAY
    if (gameState === 'DEMO') {
        // Lighter overlay so it's easier to see
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, width, height);
    }

    ctx.restore(); // Restore scale
}

function loop(timestamp) {
    requestAnimationFrame(loop);

    const dt = timestamp - lastTime;
    lastTime = timestamp;
    accumulator += dt;

    // Fixed timestep update
    while (accumulator >= TIME_STEP) {
        update(TIME_STEP);
        accumulator -= TIME_STEP;
    }

    draw();
}

document.getElementById('start-btn').addEventListener('click', initGame);
document.getElementById('restart-btn').addEventListener('click', initGame);
pauseBtn.addEventListener('click', () => {
    if (gameState === 'PLAYING') pauseGame();
    else if (gameState === 'PAUSED') resumeGame();
});
resumeBtn.addEventListener('click', resumeGame);
pauseRestartBtn.addEventListener('click', initGame);
quitBtn.addEventListener('click', returnToMenu);

// Debug controls
const godModeCheckbox = document.getElementById('god-mode-checkbox');
if (godModeCheckbox) {
    godModeCheckbox.addEventListener('change', (e) => {
        player.godMode = e.target.checked;
    });
}

const addHealthBtn = document.getElementById('add-health-btn');
if (addHealthBtn) {
    addHealthBtn.addEventListener('click', () => {
        selectUpgrade('hp');
        updateUI();
    });
}

const lvlUpBtn = document.getElementById('lvl-up-btn');
if (lvlUpBtn) {
    lvlUpBtn.addEventListener('click', () => {
        triggerLevelUp();
        updateUI();
    });
}

const setHealth1Btn = document.getElementById('set-health-1-btn');
if (setHealth1Btn) {
    setHealth1Btn.addEventListener('click', () => {
        player.lives = 1;
        updateUI();
    });
}

const wpnLvlUpBtn = document.getElementById('wpn-lvl-up-btn');
if (wpnLvlUpBtn) {
    wpnLvlUpBtn.addEventListener('click', () => {
        if (player.powerLevel < player.maxPower) {
            player.powerLevel++;
            player.weaponXpMax = getWeaponXpForLevel(player.powerLevel);
            player.weaponXp = Math.min(player.weaponXp, player.weaponXpMax);
            if (player.powerLevel >= player.maxPower) player.weaponXp = player.weaponXpMax;
            spawnText(player.x, player.y - 40, "UPGRADE", "#0ff");
            playSound('powerup');
        }
        updateUI();
    });
}


// Menu Input Handling
window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        if (gameState === 'PLAYING') pauseGame();
        else if (gameState === 'PAUSED') resumeGame();
        return;
    }

    if (gameState === 'MENU' || gameState === 'PAUSED' || gameState === 'GAMEOVER' || gameState === 'LEVEL_UP' || gameState === 'DEMO') {
        handleMenuInput(e.key);
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(e.key)) {
            e.preventDefault();
        }
    }
});

// Start loop
buildPowerSegments();
updateMenuSelection(); // Initialize selection for start menu
requestAnimationFrame(loop);
