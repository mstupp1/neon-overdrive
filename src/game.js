/**
 * MAIN GAME LOOP & STATE MANAGEMENT
 */

let menuIdleTimer = 0;

function playerCanBeHit() {
  if (player.godMode || gameState === 'DEMO') return false;
  if (hasActiveInvincibility()) return false;
  return player.iframes <= 0;
}

function startIntro() {
  gameState = 'INTRO';
  menuIdleTimer = 0;
  startMenu.classList.add('hidden');
  intro.init();
}

function startDemo() {
  gameState = 'DEMO';
  menuIdleTimer = 0;
  startMenu.classList.add('hidden');

  resetWorldState();

  // Setup player for demo
  player.x = width / 2;
  player.y = height * 0.8;
  player.powerLevel = player.maxPower;
  player.activePowerups.clear();

  // Ensure UI is hidden
  uiLayer.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  gameOverMenu.classList.add('hidden');
}

function resetWorldState() {
  bullets.forEach((b) => bulletPool.release(b));
  bullets.length = 0;
  enemies.forEach((e) => enemyPool.release(e));
  enemies.length = 0;
  particles.forEach((p) => particlePool.release(p));
  particles.length = 0;
  powerups.forEach((p) => powerupPool.release(p));
  powerups.length = 0;
  texts.forEach((t) => textPool.release(t));
  texts.length = 0;
  player.tail.length = 0;
  player.boomerangs = [];
  player.activePowerups.clear();
  player.fireballAngle = 0;
  levelManager.reset();
  if (typeof backgroundObstacleManager !== 'undefined') {
    backgroundObstacleManager.reset();
  }

  InvincibilityPlayer.stop();
  MusicPlayer.clearInvincibilityPause();
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
  menuIdleTimer = 0; // Reset idle timer on return
  pauseMenu.classList.add('hidden');
  gameOverMenu.classList.add('hidden');
  startMenu.classList.remove('hidden');
  uiLayer.classList.add('hidden');
  pauseBtn.classList.remove('active');
  updateMenuSelection();

  score = 0;
  player.lives = PLAYER_MAX_LIVES;
  player.powerLevel = 0;
  player.iframes = 0;
  player.hasShield = false;
  player.weaponXp = 0;
  player.excessWeaponXp = 0;
  player.weaponXpMax = getWeaponXpForLevel(player.powerLevel);
  if (xpFill) {
    xpFill.style.transition = 'none';
    setTimeout(() => (xpFill.style.transition = 'width 0.2s ease-out'), 50);
  }
  setPlayerStartPosition();
  player.vx = 0;
  player.vy = 0;
  player.tilt = 0;
  player.dashCooldown = 0;
  player.dashActive = false;
  player.dashFrames = 0;
  player.dashVx = 0;
  player.dashVy = 0;
  player.dodgeCharges = DODGE_CHARGES_MAX;
  player.dodgeCooldowns = [];
  player.dashGapTimer = 0;
  player.lastMoveDirX = 0;
  player.lastMoveDirY = -1; // Default to up direction

  resetWorldState();
  buildPowerSegments();
  updateUI();

  // Stop background music and reset to normal mode
  MusicPlayer.stop();
  MusicPlayer.isLateGame = false;

  // Reset any invincibility pause state
  MusicPlayer.clearInvincibilityPause();

  // Stop invincibility theme if it was playing
  InvincibilityPlayer.stop();

  // Stop ambient noise
  AmbientPlayer.stop();
}

function initGame() {
  if (document.activeElement) document.activeElement.blur();
  menuIdleTimer = 0;
  score = 0;
  player.lives = PLAYER_MAX_LIVES;
  player.powerLevel = 0;
  player.iframes = 0;
  player.hasShield = false;
  player.weaponXp = 0;
  player.excessWeaponXp = 0;
  player.weaponXpMax = getWeaponXpForLevel(player.powerLevel);
  player.level = 1;
  player.xp = 0;
  player.xpMax = CHAR_XP_BASE;
  player.stats = {
    damageMult: 1.0,
    hpMax: PLAYER_MAX_LIVES,
    fireRateMult: 1.0,
    moveSpeedMult: 1.0,
    weaponXpMult: 1.0,
    playerXpMult: 1.0,
  };

  if (xpFill) {
    xpFill.style.transition = 'none';
    setTimeout(() => (xpFill.style.transition = 'width 0.2s ease-out'), 50);
  }
  setPlayerStartPosition();
  player.vx = 0;
  player.vy = 0;
  player.tilt = 0;
  player.dashCooldown = 0;
  player.dashActive = false;
  player.dashFrames = 0;
  player.dashVx = 0;
  player.dashVy = 0;
  player.dodgeCharges = DODGE_CHARGES_MAX;
  player.dodgeCooldowns = [];
  player.dashGapTimer = 0;
  player.lastMoveDirX = 0;
  player.lastMoveDirY = -1; // Default to up direction

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
  if (MusicPlayer.isPlaying) {
    // If late game music is playing, restart it (fade out -> early game)
    if (MusicPlayer.isLateGame) {
      MusicPlayer.restartMusic();
    } else {
      // If early game music is playing, keep it going but ensure volume is restored
      // (in case we restarted during a fade-out)
      MusicPlayer.fadeIn(500, 0.3);
    }
  } else {
    // First start
    MusicPlayer.isLateGame = false;
    MusicPlayer.start();
  }

  // Start ambient noise
  AmbientPlayer.start();

  // Ensure invincibility theme is reset on new runs
  InvincibilityPlayer.stop();
  MusicPlayer.clearInvincibilityPause();
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
  bullets.forEach((b) => {
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
  enemies.forEach((e) => {
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
  powerups.forEach((p) => {
    if (p.active && !foundPowerup) {
      // Target closest/first found
      const d = dist(player.x, player.y, p.x, p.y);
      if (d < 300) {
        // Only go for if reasonably close
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
  if (gameState === 'INTRO') {
    intro.update();
    return;
  }

  if (gameState === 'MENU') {
    menuIdleTimer++;
    if (menuIdleTimer > 60 * 10) {
      // 10 seconds at 60fps
      startDemo();
    }
    // Update cosmetic background in menu
    cosmicBg.update();
    globalHue += 0.5;
    frameCount++;
    return;
  }

  if (gameState !== 'PLAYING' && gameState !== 'DEMO') {
    // if (gameState !== 'LEVEL_UP') globalHue += 1; // Removed to keep theme stable
    return;
  }

  if (gameState === 'DEMO') {
    menuIdleTimer++;
    if (menuIdleTimer > 60 * 20) {
      // 20 seconds
      startIntro();
      return;
    }
    updateDemoAI();
  } else {
    levelManager.update();
  }

  cosmicBg.update();
  if (typeof backgroundObstacleManager !== 'undefined') {
    backgroundObstacleManager.update();
  }

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
  if (frameCount % 2 === 0)
    player.tail.push({ x: player.x, y: player.y + 15, life: 1 });
  player.tail.forEach((t) => (t.life -= 0.1));
  player.tail = player.tail.filter((t) => t.life > 0);

  // --- DASH UPDATE ---
  if (player.dashGapTimer > 0) player.dashGapTimer--;

  // Recharge Logic
  for (let i = player.dodgeCooldowns.length - 1; i >= 0; i--) {
    player.dodgeCooldowns[i]--;
    if (player.dodgeCooldowns[i] <= 0) {
      player.dodgeCooldowns.splice(i, 1);
      if (player.dodgeCharges < DODGE_CHARGES_MAX) {
        player.dodgeCharges++;
        updateUI();
      }
    }
  }

  if (player.dashCooldown > 0) player.dashCooldown--;
  if (player.dashActive) {
    player.dashFrames--;

    if (player.dashFrames <= 0) {
      player.dashActive = false;
      // Reset velocity after dash ends
      player.vx = player.dashVx * 0.3; // Carry some momentum
      player.vy = player.dashVy * 0.3;
    }
  }

  // --- PLAYER MOVEMENT (KEYBOARD + TOUCH/MOUSE) ---
  if (gameState === 'PLAYING') {
    // Dash movement takes priority
    if (player.dashActive) {
      // Move with dash velocity
      player.x += player.dashVx;
      player.y += player.dashVy;
      // Clamp player position to screen bounds
      clampPlayerToPlayfield({ dampenVelocity: true });

      // Create dash trail particles with fixed size
      if (frameCount % 2 === 0) {
        createDashParticles(player.x, player.y, '#0ff', 2);
      }
    } else {
      // Normal movement
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

      // Track last movement direction for dash
      if (accelX !== 0 || accelY !== 0) {
        const mag = Math.hypot(accelX, accelY);
        player.lastMoveDirX = accelX / mag;
        player.lastMoveDirY = accelY / mag;
      } else {
        // Track from velocity if no input
        const speed = Math.hypot(player.vx, player.vy);
        if (speed > 0.1) {
          player.lastMoveDirX = player.vx / speed;
          player.lastMoveDirY = player.vy / speed;
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
      const maxSpeed =
        player.vy < 0
          ? PLAYER_MAX_SPEED_UP * player.stats.moveSpeedMult
          : player.vy > 0
            ? PLAYER_MAX_SPEED_DOWN * player.stats.moveSpeedMult
            : PLAYER_MAX_SPEED * player.stats.moveSpeedMult;
      const speed = Math.hypot(player.vx, player.vy);
      if (speed > maxSpeed) {
        const s = maxSpeed / speed;
        player.vx *= s;
        player.vy *= s;
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
        const tiltNorm = Math.min(
          1,
          (absVx - PLAYER_TILT_DEADZONE) /
          (PLAYER_MAX_SPEED - PLAYER_TILT_DEADZONE)
        );
        targetTilt =
          tiltNorm * PLAYER_TILT_MAX * Math.sign(player.vx) * player.tiltDir;
      } else {
        targetTilt *= PLAYER_TILT_DAMP; // gently settle toward neutral
      }

      player.tilt =
        player.tilt * (1 - PLAYER_TILT_BLEND) + targetTilt * PLAYER_TILT_BLEND;
    }
  }


  // --- SHOOTING ---
  // Calculate fire interval based on fire rate multiplier
  let baseFireInterval = 7; // Default fire every 7 frames
  let fireRateMult = player.stats.fireRateMult;

  // Power-up: Rapid Fire - get the multiplier from player stats calculation
  if (player.activePowerups.has('rapidFire')) {
    fireRateMult *= 2.0; // Apply rapid fire multiplier (matches player.js)
  }

  // Calculate actual fire interval (lower interval = faster firing)
  const fireInterval = Math.max(1, Math.floor(baseFireInterval / fireRateMult));

  if (gameState === 'PLAYING' && frameCount % fireInterval === 0) {
    firePlayerWeapons();
  }
  if (player.iframes > 0) player.iframes--;

  // --- PASSIVE: REGENERATOR (Auto Shield) ---
  if (
    player.passives.has('autoShield') &&
    !player.hasShield &&
    gameState === 'PLAYING'
  ) {
    player.autoShieldTimer++;
    if (player.autoShieldTimer >= 300) {
      // 5 seconds at 60fps
      player.hasShield = true;
      player.autoShieldTimer = 0;
      playSound('powerup');
      spawnText(player.x, player.y - 40, 'SHIELD REGEN', '#00f');
    }
  }

  // --- PASSIVE: WEAPON DASH ---
  if (player.passives.has('dashWeapon')) {
    if (player.dashActive) {
      applyDashWeaponDamage();
    } else if (player.dashWeaponHits && player.dashWeaponHits.size) {
      player.dashWeaponHits.clear();
    }
  }

  // --- PASSIVE: WINGMEN (Sidekicks) ---
  if (player.passives.has('sidekicks') && player.sidekicks?.length) {
    player.sidekicks.forEach((sk) => {
      const orbitSpeed = sk.orbitSpeed ?? 0.01;
      sk.pathAngle = (sk.pathAngle ?? 0) + orbitSpeed;

      sk.bobPhase = (sk.bobPhase ?? 0) + (sk.bobSpeed ?? 0.015);
      const bob = Math.sin(sk.bobPhase) * (sk.bobAmplitude ?? 6);

      const radius = sk.orbitRadius ?? 70;
      const verticalScale = sk.verticalScale ?? 0.6;
      const targetX = player.x + Math.cos(sk.pathAngle) * radius;
      const targetY =
        player.y + Math.sin(sk.pathAngle) * radius * verticalScale + bob;

      const desiredHeading = Math.atan2(targetY - sk.y, targetX - sk.x);
      const currentMoveAngle = sk.moveAngle ?? -Math.PI / 2;
      const turnSpeed = sk.turnSpeed ?? 0.05;
      const headingDiff = normalizeAngle(desiredHeading - currentMoveAngle);
      const appliedTurn = clampValue(headingDiff, -turnSpeed, turnSpeed);
      const newMoveAngle = normalizeAngle(currentMoveAngle + appliedTurn);
      sk.moveAngle = newMoveAngle;

      const moveSpeed = sk.speed ?? 3;
      const distance = Math.hypot(targetX - sk.x, targetY - sk.y);
      const step = Math.min(moveSpeed, distance);
      const vx = Math.cos(newMoveAngle) * step;
      sk.x += vx;
      sk.y += Math.sin(newMoveAngle) * step;

      // Tilt logic
      const absVx = Math.abs(vx);
      let targetTilt = sk.tilt || 0;
      if (absVx > 0.1) {
        const tiltNorm = Math.min(1, absVx / moveSpeed);
        // Tilt max ~20 degrees
        targetTilt = tiltNorm * 0.35 * (Math.sign(vx) || 0);
      } else {
        targetTilt *= 0.8;
      }
      sk.tilt = (sk.tilt || 0) * 0.8 + targetTilt * 0.2;

      // Safety checks
      if (!Number.isFinite(sk.tilt)) sk.tilt = 0;
      if (!Number.isFinite(sk.x)) sk.x = player.x;
      if (!Number.isFinite(sk.y)) sk.y = player.y;
    });
  }

  // --- ACTIVE POWER-UPS TIMER ---
  if (gameState === 'PLAYING') {
    for (const [type, timer] of player.activePowerups.entries()) {
      const newTimer = timer - 1;
      if (newTimer <= 0) {
        player.activePowerups.delete(type);
        if (type === 'invincibility') {
          InvincibilityPlayer.stop();
          MusicPlayer.resumeFromInvincibility();
        }
        spawnText(
          player.x,
          player.y - 60,
          `${type.toUpperCase()} ENDED`,
          '#888'
        );
        updateUI();
      } else {
        player.activePowerups.set(type, newTimer);
      }
    }
  }

  // --- POWER-UP: FIREBALLS ---
  if (player.activePowerups.has('fireballs') && gameState === 'PLAYING') {
    player.fireballAngle += 0.08; // Rotation speed
    const fireballRadius = 60; // Distance from player
    const fireballCount = 8;
    const fireballDamage = 2.5;

    // Check collision with enemies
    for (let i = 0; i < fireballCount; i++) {
      const angle = player.fireballAngle + (i * Math.PI * 2) / fireballCount;
      const fbX = player.x + Math.cos(angle) * fireballRadius;
      const fbY = player.y + Math.sin(angle) * fireballRadius;

      enemies.forEach((e) => {
        if (e.active && dist(fbX, fbY, e.x, e.y) < e.radius + 8) {
          e.hp -= fireballDamage;
          e.flashTimer = 8;
          if (e.hp <= 0 && e.active) {
            handleEnemyDefeat(e);
          }
        }
      });
    }
  }

  // Update Entities
  [bullets, enemies, particles, powerups, texts].forEach((arr) =>
    arr.forEach((e) => e.update())
  );

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

  updateBoomerangPassive();

  // Collisions
  const stageObstacles =
    typeof backgroundObstacleManager !== 'undefined'
      ? backgroundObstacleManager.getObstacles()
      : null;

  bullets.forEach((b) => {
    if (b.type === 'player') {
      enemies.forEach((e) => {
        let hit = dist(b.x, b.y, e.x, e.y) < e.radius + b.radius + 5;
        if (e.type === 'snake') {
          if (dist(b.x, b.y, e.x, e.y) < e.radius + b.radius) hit = true;
          else
            e.segments.forEach((s) => {
              if (dist(b.x, b.y, s.x, s.y) < e.radius + b.radius) hit = true;
            });
        }

        if (hit) {
          // Check if  this was a missile for AOE
          const isMissile = b.subType === 'missile';

          if (!b.pierce) b.active = false;
          e.hp -= b.damage ?? 1;

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
            enemies.forEach((target) => {
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
            handleEnemyDefeat(e);
          }
        }
      });
      if (stageObstacles && stageObstacles.length) {
        stageObstacles.forEach((ob) => {
          if (!ob.active) return;
          const obstacleRadius = (ob.radius || 30) + b.radius;
          if (dist(b.x, b.y, ob.x, ob.y) < obstacleRadius) {
            if (!b.pierce) b.active = false;
            backgroundObstacleManager.damageObstacle(ob, b.damage ?? 1);
          }
        });
      }
      // Bullet-on-Bullet Collision (Destructible Enemy Bullets)
      bullets.forEach((eb) => {
        if (eb.type === 'enemy' && eb.destructible && eb.active) {
          if (dist(b.x, b.y, eb.x, eb.y) < b.radius + eb.radius) {
            if (!b.pierce) b.active = false; // Player bullet dies unless piercing

            eb.hp -= b.damage ?? 1;
            if (eb.hp <= 0) {
              eb.active = false;
              createExplosionLogic(eb.x, eb.y, '#ff9c2a', 5);
              if (gameState === 'PLAYING') score += 10;
            } else {
              // Flash or effect to show hit but not dead?
              createExplosionLogic(eb.x, eb.y, '#ff9c2a', 2);
            }
          }
        }
      });
    } else {
      if (
        playerCanBeHit() &&
        dist(b.x, b.y, player.x, player.y) < player.radius + 5
      ) {
        b.active = false;
        hitPlayer(b.damage || 1);
        if (gameState === 'GAMEOVER') return; // Stop processing if player died
      }
    }
  });
  enemies.forEach((e) => {
    let hit = dist(e.x, e.y, player.x, player.y) < e.radius + player.radius;
    if (e.type === 'snake')
      e.segments.forEach((s) => {
        if (dist(s.x, s.y, player.x, player.y) < e.radius + player.radius)
          hit = true;
      });
    if (playerCanBeHit() && hit) {
      hitPlayer(e.damage || 1);
      if (gameState === 'GAMEOVER') return; // Stop processing if player died
    }
  });
  if (stageObstacles && stageObstacles.length) {
    for (const ob of stageObstacles) {
      if (!ob.active || !ob.collides) continue;
      const combinedRadius = (ob.radius || 30) + player.radius;
      if (
        playerCanBeHit() &&
        dist(ob.x, ob.y, player.x, player.y) < combinedRadius
      ) {
        hitPlayer(1);
        backgroundObstacleManager.damageObstacle(ob, Math.max(2, ob.hp * 0.3));
        if (gameState === 'GAMEOVER') return;
      }
    }
  }
  powerups.forEach((p) => {
    if (p.pickupTimer > 0) return; // Cannot pick up yet
    if (dist(p.x, p.y, player.x, player.y) < p.radius + 20) {
      p.active = false;
      playSound('powerup');
      if (p.type === 'weapon') {
        if (player.powerLevel < player.maxPower) {
          player.powerLevel++;
          player.weaponXpMax = getWeaponXpForLevel(player.powerLevel);
          player.weaponXp = Math.min(player.weaponXp, player.weaponXpMax);
          if (player.powerLevel >= player.maxPower)
            player.weaponXp = player.weaponXpMax;
          spawnText(player.x, player.y - 40, 'UPGRADE', '#0ff');
        } else {
          if (gameState === 'PLAYING') score += 1000;
          spawnText(player.x, player.y - 40, '+1000', '#fff');
        }
      } else if (p.type === 'bomb') {
        triggerBombLogic();
      } else if (p.type === 'shield') {
        player.hasShield = true;
        spawnText(player.x, player.y - 40, 'SHIELD UP', '#00f');
      } else if (p.type === 'life') {
        // Can't pick up life powerup if already dead
        if (player.lives <= 0) return;
        const prevLives = player.lives;
        player.lives = Math.min(player.stats.hpMax, player.lives + 1);
        if (player.lives > prevLives)
          spawnText(player.x, player.y - 40, 'EXTEND', '#f00');
      } else if (p.type === 'score') {
        if (gameState === 'PLAYING') {
          score += SCORE_POWERUP_VALUE;
          const xpGain = Math.floor(
            player.weaponXpMax * SCORE_POWERUP_XP_RATIO
          );
          awardWeaponXp(xpGain);
        }
        const xpLabel =
          gameState === 'PLAYING'
            ? `+${SCORE_POWERUP_VALUE} +XP`
            : `+${SCORE_POWERUP_VALUE}`;
        spawnText(player.x, player.y - 40, xpLabel, '#fd0');
      } else if (p.type === 'rapidFire') {
        player.activePowerups.set('rapidFire', POWERUP_DURATION_RAPID_FIRE);
        spawnText(player.x, player.y - 40, 'RAPID FIRE', '#f80');
      } else if (p.type === 'slowDown') {
        player.activePowerups.set('slowDown', POWERUP_DURATION_SLOW_DOWN);
        spawnText(player.x, player.y - 40, 'SLOW DOWN', '#0cf');
      } else if (p.type === 'fireballs') {
        player.activePowerups.set('fireballs', POWERUP_DURATION_FIREBALLS);
        player.fireballAngle = 0; // Reset rotation
        spawnText(player.x, player.y - 40, 'FIREBALLS', '#f30');
      } else if (p.type === 'piercing') {
        player.activePowerups.set('piercing', POWERUP_DURATION_PIERCING);
        spawnText(player.x, player.y - 40, 'PIERCING', '#a0f');
      } else if (p.type === 'invincibility') {
        player.activePowerups.set(
          'invincibility',
          POWERUP_DURATION_INVINCIBILITY
        );
        MusicPlayer.pauseForInvincibility();
        InvincibilityPlayer.play();
        spawnText(player.x, player.y - 40, 'INVINCIBLE', '#ffd54f');
      }
      if (gameState === 'PLAYING') updateUI();
    }
  });
}

function handleEnemyDefeat(enemy) {
  if (!enemy || !enemy.active) return;

  enemy.active = false;
  if (gameState === 'PLAYING') {
    score += 100;
  }

  createExplosionLogic(enemy.x, enemy.y, `hsl(${globalHue},100%,50%)`, 25);
  createExplosionLogic(enemy.x, enemy.y, '#fff', 10);
  createExplosionLogic(
    enemy.x,
    enemy.y,
    `hsl(${globalHue + 60},100%,60%)`,
    15
  );
  createExplosionLogic(
    enemy.x,
    enemy.y,
    `hsl(${globalHue + 60},100%,60%)`,
    15
  );

  let powerupChance = 0.05;
  if (player.passives.has('spawnRate')) powerupChance = 0.12;
  if (Math.random() < powerupChance) spawnPowerup(enemy.x, enemy.y);

  if (player.passives.has('fragments')) {
    const fragCount = 3;
    for (let i = 0; i < fragCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      spawnBullet(enemy.x, enemy.y, angle, 10, 'player', 'normal', {
        damage: 0.5 * player.stats.damageMult,
        pierce: false,
        tintHue: 50,
        glow: 0.1,
      });
    }
  }

  if (gameState === 'PLAYING') {
    let xpGain = 10;
    if (enemy.type === 'chaser') xpGain = 10;
    else if (enemy.type === 'dasher') xpGain = 20;
    else if (enemy.type === 'sniper') xpGain = 30;
    else if (enemy.type === 'snake') xpGain = 40;
    else if (enemy.type === 'spinner') xpGain = 50;

    awardWeaponXp(xpGain);
    awardPlayerXp(xpGain);
    updateUI();
  }
}

function shortestAngleDiff(current, target) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function updateBoomerangPassive() {
  if (!player.passives.has('boomerang')) return;

  if (!player.boomerangs) player.boomerangs = [];
  if (player.boomerang && player.boomerangs.length === 0) {
    // Legacy single boomerang support
    player.boomerang.initialAngleOffset = 0.2;
    player.boomerangs = [
      player.boomerang,
      createBoomerangState({ curveDir: -1, angleOffset: -0.2 }),
    ];
    player.boomerang = null;
  }
  if (player.boomerangs.length < 2) {
    player.boomerangs = createBoomerangStates();
  }

  const activeStates = player.boomerangs;

  if (gameState !== 'PLAYING' && gameState !== 'DEMO') {
    activeStates.forEach((boomerang) => resetBoomerangToPlayer(boomerang));
    return;
  }

  const damage = BOOMERANG_BASE_DAMAGE * player.stats.damageMult;

  const stageObstacles =
    typeof backgroundObstacleManager !== 'undefined'
      ? backgroundObstacleManager.getObstacles()
      : null;

  activeStates.forEach((boomerang) => {
    if (!boomerang.hitSet) boomerang.hitSet = new Set();

    if (boomerang.state === 'outbound') {
      boomerang.timer++;
      boomerang.angle += boomerang.curveDir * BOOMERANG_CURVE_RATE;
      boomerang.vx = Math.cos(boomerang.angle) * BOOMERANG_SPEED;
      boomerang.vy = Math.sin(boomerang.angle) * BOOMERANG_SPEED;
      boomerang.x += boomerang.vx;
      boomerang.y += boomerang.vy;

      if (boomerang.timer >= BOOMERANG_OUTBOUND_FRAMES) {
        boomerang.state = 'returning';
        boomerang.timer = 0;
        boomerang.hitSet.clear();
      }
    } else {
      boomerang.timer++;
      const dx = player.x - boomerang.x;
      const dy = player.y - boomerang.y;
      const desiredAngle = Math.atan2(dy, dx);
      const diff = shortestAngleDiff(boomerang.angle, desiredAngle);
      const turn = Math.max(
        -BOOMERANG_RETURN_TURN_RATE,
        Math.min(BOOMERANG_RETURN_TURN_RATE, diff)
      );
      boomerang.angle += turn;

      boomerang.vx = Math.cos(boomerang.angle) * BOOMERANG_RETURN_SPEED;
      boomerang.vy = Math.sin(boomerang.angle) * BOOMERANG_RETURN_SPEED;
      boomerang.x += boomerang.vx;
      boomerang.y += boomerang.vy;

      const snappingDistance = BOOMERANG_RADIUS + 6;
      if (
        boomerang.timer > 240 ||
        dist(boomerang.x, boomerang.y, player.x, player.y) < snappingDistance
      ) {
        boomerang.curveDir *= -1;
        resetBoomerangToPlayer(boomerang);
        return;
      }
    }

    enemies.forEach((enemy) => {
      if (!enemy.active || boomerang.hitSet.has(enemy)) return;
      const hitRadius = enemy.radius + BOOMERANG_RADIUS;
      if (dist(boomerang.x, boomerang.y, enemy.x, enemy.y) <= hitRadius) {
        enemy.hp -= damage;
        enemy.flashTimer = 8;
        boomerang.hitSet.add(enemy);

        if (enemy.hp <= 0 && enemy.active) {
          handleEnemyDefeat(enemy);
        }
      }
    });

    if (stageObstacles && stageObstacles.length) {
      stageObstacles.forEach((obstacle) => {
        if (!obstacle.active || boomerang.hitSet.has(obstacle)) return;
        const obstacleRadius = (obstacle.radius || 30) + BOOMERANG_RADIUS;
        if (
          dist(boomerang.x, boomerang.y, obstacle.x, obstacle.y) <=
          obstacleRadius
        ) {
          boomerang.hitSet.add(obstacle);
          backgroundObstacleManager.damageObstacle(obstacle, damage);
        }
      });
    }
  });
}

function drawBoomerangs(ctx) {
  if (
    !player.passives.has('boomerang') ||
    !player.boomerangs ||
    player.boomerangs.length === 0 ||
    (gameState !== 'PLAYING' &&
      gameState !== 'DEMO' &&
      gameState !== 'PAUSED' &&
      gameState !== 'LEVEL_UP' &&
      gameState !== 'STAGE_COMPLETE')
  ) {
    return;
  }

  player.boomerangs.forEach((boomerang) => {
    ctx.save();
    ctx.translate(boomerang.x, boomerang.y);
    ctx.rotate(boomerang.angle + Math.PI / 2);
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ffd54f';

    ctx.fillStyle = boomerang.state === 'returning' ? '#fff59d' : '#ffd54f';
    ctx.beginPath();
    ctx.moveTo(0, -BOOMERANG_RADIUS);
    ctx.lineTo(BOOMERANG_RADIUS * 0.9, -BOOMERANG_RADIUS * 0.1);
    ctx.lineTo(BOOMERANG_RADIUS * 0.35, BOOMERANG_RADIUS);
    ctx.lineTo(-BOOMERANG_RADIUS * 0.35, BOOMERANG_RADIUS);
    ctx.lineTo(-BOOMERANG_RADIUS * 0.9, -BOOMERANG_RADIUS * 0.1);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

function applyDashWeaponDamage() {
  if (!player.dashActive) return;
  const dashSpeed = Math.hypot(player.dashVx, player.dashVy);
  if (dashSpeed < 0.01) return;

  const dirX = player.dashVx / dashSpeed;
  const dirY = player.dashVy / dashSpeed;
  const tipX = player.x + dirX * DASH_WEAPON_TIP_RANGE;
  const tipY = player.y + dirY * DASH_WEAPON_TIP_RANGE;

  enemies.forEach((enemy) => {
    if (!enemy.active || player.dashWeaponHits.has(enemy)) return;

    const tipDist = dist(tipX, tipY, enemy.x, enemy.y);
    const bodyDist = dist(player.x, player.y, enemy.x, enemy.y);
    if (
      tipDist < enemy.radius + 25 ||
      bodyDist < enemy.radius + DASH_WEAPON_BODY_RANGE
    ) {
      player.dashWeaponHits.add(enemy);
      const damage = DASH_WEAPON_DAMAGE * player.stats.damageMult;
      enemy.hp -= damage;
      enemy.flashTimer = 8;
      createExplosionLogic(enemy.x, enemy.y, '#0ff', 4);
      if (enemy.hp <= 0 && enemy.active) {
        handleEnemyDefeat(enemy);
      }
    }
  });
}

function draw() {
  if (gameState === 'INTRO') {
    intro.draw(ctx);
    return;
  }

  // Background
  // Apply scale for game world
  ctx.save();
  ctx.scale(GAME_SCALE, GAME_SCALE);

  cosmicBg.draw(ctx);
  if (typeof backgroundObstacleManager !== 'undefined') {
    backgroundObstacleManager.draw(ctx);
  }

  if (gameState === 'MENU') {
    ctx.restore();
    return;
  }

  let sx = 0,
    sy = 0;
  if (player.iframes > 0 && player.iframes % 4 === 0) {
    sx = rand(-5, 5);
    sy = rand(-5, 5);
  }

  const invincibleActive = hasActiveInvincibility();
  const shouldBlink = player.iframes > 0 || invincibleActive;
  const blinkRate = invincibleActive ? 3 : 4;
  const showPlayerSprite =
    gameState === 'PLAYING' ||
    gameState === 'DEMO' ||
    gameState === 'PAUSED' ||
    gameState === 'LEVEL_UP';
  ctx.save();
  ctx.translate(sx, sy);

  // Grid - Optimized with warbling sin wave effect
  ctx.strokeStyle = `hsla(${globalHue}, 80%, 40%, 0.15)`;
  ctx.lineWidth = 1;
  const gs = 80; // Larger grid size

  if (IS_MOBILE) {
    // Simple grid for mobile
    ctx.beginPath();
    for (let x = 0; x <= width; x += gs) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += gs) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
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
        ctx.lineTo(
          x + Math.sin(waveSpeed + y * waveFreq + x * waveFreq) * waveAmp,
          y
        );
      }
    }
    // Horizontal lines with vertical warble
    for (let y = 0; y <= height; y += gs) {
      ctx.moveTo(0, y + Math.sin(waveSpeed + y * waveFreq) * waveAmp);
      for (let x = gs; x <= width; x += gs) {
        ctx.lineTo(
          x,
          y + Math.sin(waveSpeed + x * waveFreq + y * waveFreq) * waveAmp
        );
      }
    }
    ctx.stroke();
  }

  powerups.forEach((e) => e.draw(ctx));
  particles.forEach((e) => e.draw(ctx));
  bullets.forEach((e) => e.draw(ctx));
  enemies.forEach((e) => e.draw(ctx));
  texts.forEach((e) => e.draw(ctx));

  drawBoomerangs(ctx);

  // PLAYER DRAW
  if (
    showPlayerSprite &&
    (!shouldBlink || Math.floor(frameCount / blinkRate) % 2 === 0)
  ) {
    ctx.save();
    ctx.translate(player.x, player.y);

    // Engine Trails
    player.tail.forEach((t, i) => {
      ctx.globalAlpha = t.life * 0.6;
      ctx.fillStyle = '#0ff';
      ctx.beginPath();
      ctx.arc(t.x - player.x, t.y - player.y, 6 * t.life, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // SHIELD VISUAL
    if (player.hasShield) {
      ctx.rotate(frameCount * 0.1);
      ctx.strokeStyle = '#0af';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(0, 200, 255, 0.15)';
      ctx.fill();
      ctx.rotate(-frameCount * 0.1);
    }

    // INVINCIBILITY VISUAL
    if (invincibleActive) {
      ctx.save();
      const pulse = 1 + Math.sin(frameCount * 0.25) * 0.05;
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = 'rgba(255, 213, 79, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 224, 0.4)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // FIREBALL RING VISUAL
    if (player.activePowerups.has('fireballs')) {
      const fireballRadius = 60;
      const fireballCount = 8;
      for (let i = 0; i < fireballCount; i++) {
        const angle = player.fireballAngle + (i * Math.PI * 2) / fireballCount;
        const fbX = Math.cos(angle) * fireballRadius;
        const fbY = Math.sin(angle) * fireballRadius;

        // Draw fireball
        ctx.save();
        ctx.translate(fbX, fbY);
        ctx.fillStyle = '#f30';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#f30';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();

        // Inner glow
        ctx.fillStyle = '#ff6';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.shadowBlur = 0;
    }

    // SHIP SPRITE
    ctx.save();
    const dashWeaponActive =
      player.dashActive && player.passives.has('dashWeapon');
    let shipRotation = player.tilt;
    if (dashWeaponActive) {
      const dashAngle = Math.atan2(player.dashVy, player.dashVx);
      if (!Number.isNaN(dashAngle)) {
        shipRotation = dashAngle + Math.PI / 2;
      }
    }
    ctx.rotate(shipRotation);

    // Apply subtle blink effect during dash
    if (player.dashActive) {
      // Blink effect: fade between 0.6 and 1.0 opacity
      const blinkSpeed = 0.3; // How fast the blink cycles
      const blinkAlpha =
        0.2 + Math.abs(Math.sin(frameCount * blinkSpeed)) * 0.2;
      ctx.globalAlpha = blinkAlpha;
    }
    if (dashWeaponActive) {
      ctx.fillStyle = '#e0ffff';
      ctx.shadowBlur = IS_DESKTOP ? 20 : 24;
      ctx.shadowColor = '#0ff';

      ctx.beginPath();
      ctx.moveTo(0, -50);
      ctx.lineTo(10, 18);
      ctx.lineTo(-10, 18);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#0ff';
      ctx.fillRect(-3, -35, 6, 60);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-1.5, -45, 3, 65);

      ctx.fillStyle = '#0ff';
      ctx.beginPath();
      ctx.moveTo(-14, 10);
      ctx.lineTo(-24, 25);
      ctx.lineTo(-8, 25);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(14, 10);
      ctx.lineTo(24, 25);
      ctx.lineTo(8, 25);
      ctx.closePath();
      ctx.fill();
    } else {
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
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(4, 5);
      ctx.lineTo(0, 8);
      ctx.lineTo(-4, 5);
      ctx.fill();

      if (!IS_MOBILE) {
        ctx.shadowBlur = IS_DESKTOP ? 16 : 20; // Desktop optimized (16 vs 20)
        ctx.fillStyle = '#0ff';
      } else {
        ctx.fillStyle = '#0ff';
      }
      ctx.fillRect(-5, 20, 3, 5);
      ctx.fillRect(2, 20, 3, 5);
    }
    ctx.restore();

    // Reset alpha if dash blink was applied
    if (player.dashActive) {
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    ctx.restore();
  }

  // --- PASSIVE: WINGMEN DRAW ---
  if (
    (gameState === 'PLAYING' ||
      gameState === 'DEMO' ||
      gameState === 'PAUSED' ||
      gameState === 'LEVEL_UP' ||
      gameState === 'STAGE_COMPLETE') &&
    player.passives.has('sidekicks') &&
    player.sidekicks
  ) {
    player.sidekicks.forEach((sk) => {
      ctx.save();
      ctx.translate(sk.x, sk.y);
      // Face forward (up) + tilt
      ctx.rotate(sk.tilt || 0);
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
      ctx.fillRect(-5, 20, 3, 5);
      ctx.fillRect(2, 20, 3, 5);

      ctx.restore();
    });
  }

  ctx.restore();

  // Glitch Overlay - Desktop optimized (every 6 frames vs original 4)
  const glitchFreq = IS_DESKTOP ? 6 : 4;
  if (!IS_MOBILE && frameCount % glitchFreq === 0) {
    // Reduced frequency
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = `hsla(${globalHue + 180},100%,50%,0.05)`;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
  }

  // DEMO OVERLAY
  if (gameState === 'DEMO') {
    // Lighter overlay so it's easier to see
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 10;
    ctx.fillText('DEMO MODE', width - 20, 20);
    ctx.restore();
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

  // Update stage progress bar every frame for smooth animation
  if (typeof updateStageProgressBar === 'function' && gameState === 'PLAYING') {
    updateStageProgressBar();
  }
}

document.addEventListener('click', () => {
  menuIdleTimer = 0; // Reset on any input
  if (gameState === 'INTRO') intro.skip();
  if (gameState === 'DEMO') returnToMenu();
});
document.addEventListener(
  'touchstart',
  () => {
    menuIdleTimer = 0; // Reset on any input
    if (gameState === 'INTRO') intro.skip();
    if (gameState === 'DEMO') returnToMenu();
  },
  { passive: true }
);

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

const spawnPowerGridBtn = document.getElementById('spawn-power-grid-btn');
if (spawnPowerGridBtn) {
  spawnPowerGridBtn.addEventListener('click', () => {
    spawnAllPowerupsGrid();
  });
}

const noEnemiesCheckbox = document.getElementById('no-enemies-checkbox');
if (noEnemiesCheckbox) {
  noEnemiesCheckbox.addEventListener('change', (e) => {
    debugNoEnemySpawns = e.target.checked;
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
      if (player.powerLevel >= player.maxPower)
        player.weaponXp = player.weaponXpMax;
      spawnText(player.x, player.y - 40, 'UPGRADE', '#0ff');
      playSound('powerup');
    }
    updateUI();
  });
}

const invincibilityBtn = document.getElementById('invincibility-btn');
if (invincibilityBtn) {
  invincibilityBtn.addEventListener('click', () => {
    player.activePowerups.set('invincibility', POWERUP_DURATION_INVINCIBILITY);
    MusicPlayer.pauseForInvincibility();
    InvincibilityPlayer.play();
    spawnText(player.x, player.y - 40, 'INVINCIBLE', '#ffd54f');
    updateUI();
  });
}

const stageLvlUpBtn = document.getElementById('stage-lvl-up-btn');
if (stageLvlUpBtn) {
  stageLvlUpBtn.addEventListener('click', () => {
    // Trigger the stage complete screen
    if (gameState === 'PLAYING' || gameState === 'PAUSED') {
      gameState = 'STAGE_COMPLETE';
      uiLayer.classList.add('hidden');
      pauseMenu.classList.add('hidden');
      document.getElementById('stage-complete-menu').classList.remove('hidden');
      showStageCompleteOptions();
      playSound('powerup');

      // Fade out music for passive select (only if transitioning from level 6)
      if (levelManager.currentLevel === 6) {
        MusicPlayer.fadeOutForPassiveSelect();
      }
    }
  });
}

// Debug Passive Selector
const debugPassiveSelector = document.getElementById('debug-passive-selector');
if (debugPassiveSelector) {
  // Populate with all passives
  SHIP_MUTATIONS.forEach(passive => {
    const passiveBtn = document.createElement('button');
    passiveBtn.className = 'debug-passive-btn';
    passiveBtn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: rgba(0, 255, 255, 0.1);
      border: 1px solid #0ff;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      padding: 0;

    `;

    // Create material icon
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = passive.icon;
    icon.style.cssText = `
      font-size: 20px;
      color: #0ff;
    `;

    passiveBtn.appendChild(icon);
    passiveBtn.title = passive.title; // Tooltip

    // Hover effect
    passiveBtn.addEventListener('mouseenter', () => {
      passiveBtn.style.background = 'rgba(0, 255, 255, 0.3)';
      passiveBtn.style.borderColor = '#fff';
      icon.style.color = '#fff';
    });

    passiveBtn.addEventListener('mouseleave', () => {
      passiveBtn.style.background = 'rgba(0, 255, 255, 0.1)';
      passiveBtn.style.borderColor = '#0ff';
      icon.style.color = '#0ff';
    });

    // Click to grant passive
    passiveBtn.addEventListener('click', () => {
      if (!player.passives.has(passive.id)) {
        // Grant the passive immediately
        player.passives.add(passive.id);

        // Handle immediate effects (similar to applyPassive but without menu transitions)
        if (passive.id === 'sidekicks' && !player.sidekicks) {
          player.sidekicks = [
            createSidekick({ pathAngle: Math.PI * 0.8, fireOffset: 0 }),
            createSidekick({ pathAngle: Math.PI * 0.2, fireOffset: 6 }),
          ];
        } else if (passive.id === 'boomerang' && !player.boomerangs) {
          player.boomerangs = createBoomerangStates();
        } else if (passive.id === 'doubleHp') {
          player.stats.hpMax *= 2;
          player.lives = player.stats.hpMax;
        } else if (passive.id === 'smallSize') {
          player.radius *= 0.75;
          player.scale = (player.scale || 1) * 0.75;
        }

        spawnText(player.x, player.y, `${passive.title} `, '#0f0');
        playSound('powerup');
        updateUI();

        // Visual feedback
        passiveBtn.style.background = 'rgba(0, 255, 0, 0.3)';
        passiveBtn.style.borderColor = '#0f0';
        icon.style.color = '#0f0';
      } else {
        // Already have this passive
        spawnText(player.x, player.y, 'ALREADY OWNED', '#f00');
      }
    });

    debugPassiveSelector.appendChild(passiveBtn);
  });
}


// Menu Input Handling
window.addEventListener('keydown', (e) => {
  menuIdleTimer = 0; // Reset on any input
  if (gameState === 'INTRO') {
    if (
      [
        'Enter',
        ' ',
        'Escape',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ].includes(e.key)
    ) {
      intro.skip();
    }
    return;
  }

  if (gameState === 'DEMO') {
    returnToMenu();
    return;
  }

  if (e.key === 'Escape') {
    if (gameState === 'PLAYING') pauseGame();
    else if (gameState === 'PAUSED') resumeGame();
    return;
  }

  if (
    gameState === 'MENU' ||
    gameState === 'PAUSED' ||
    gameState === 'GAMEOVER' ||
    gameState === 'LEVEL_UP' ||
    gameState === 'STAGE_COMPLETE' ||
    gameState === 'DEMO'
  ) {
    handleMenuInput(e.key);
    if (
      [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        ' ',
        'Enter',
      ].includes(e.key)
    ) {
      e.preventDefault();
    }
  }
});

// Start loop
buildPowerSegments();
updateMenuSelection(); // Initialize selection for start menu

// Start in INTRO mode
gameState = 'INTRO';
intro.init();

requestAnimationFrame(loop);

// Debug helper: spawn all powerups in a static grid for quick testing
function spawnAllPowerupsGrid() {
  const types = [
    'weapon',
    'bomb',
    'shield',
    'life',
    'score',
    'rapidFire',
    'slowDown',
    'fireballs',
    'piercing',
    'invincibility',
  ];
  const cols = 3;
  const spacing = 80;
  const rows = Math.ceil(types.length / cols);

  const startX = width / 2 - ((cols - 1) * spacing) / 2;
  const startY = height / 2 - ((rows - 1) * spacing) / 2;

  types.forEach((type, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = startX + col * spacing;
    const y = startY + row * spacing;
    const p = spawnPowerup(x, y, type, false);
    if (p) {
      p.vx = 0;
      p.vy = 0;
      p.age = 0;
      p.lifetime = POWERUP_LIFETIME_FRAMES * 5;
    }
  });
}
