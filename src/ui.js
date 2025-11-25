/**
 * UI MANAGEMENT
 */

// Menu Navigation State
let currentMenuId = null;
let selectedButtonIndex = 0;

// Hold-to-Select State
let holdStartTime = null;
let holdTargetUpgrade = null;
let isHolding = false;
let holdAnimationFrame = null;
const HOLD_DURATION = 800; // milliseconds
let holdAudioContext = null;
let holdOscillator = null;
let holdGainNode = null;
let isKeyHeld = false; // Track if Enter/Space is currently held down

const MENUS = {
    'start-menu': { selector: '#start-menu .btn', defaultIndex: 0 },
    'pause-menu': { selector: '#pause-menu .btn', defaultIndex: 0 },
    'game-over-menu': { selector: '#game-over-menu .btn', defaultIndex: 0 },
    'level-up-menu': { selector: '#level-up-menu .upgrade-card', defaultIndex: 1 }, // Center option default
    'stage-complete-menu': { selector: '#stage-complete-menu .upgrade-card', defaultIndex: 1 }
};

const ALL_UPGRADES = [
    { id: 'hp', title: 'REINFORCE', descriptionLines: ['+1', 'MAX HP', 'FULL HEALTH'], icon: 'favorite', stat: 'HP' },
    { id: 'damage', title: 'OVERCHARGE', descriptionLines: ['+10%', 'DAMAGE'], icon: 'flash_on', stat: 'DMG' },
    { id: 'speed', title: 'ACCELERATE', descriptionLines: ['+10%', 'FIRE RATE'], icon: 'speed', stat: 'RATE' },
    { id: 'moveSpeed', title: 'AFTERBURNER', descriptionLines: ['+10%', 'MOVE SPEED'], icon: 'directions_run', stat: 'MOVE' },
    { id: 'weaponXp', title: 'WEAPON MASTERY', descriptionLines: ['+10%', 'WEAPON XP'], icon: 'military_tech', stat: 'WPN XP' },
    { id: 'playerXp', title: 'INSIGHT', descriptionLines: ['+10%', 'XP GAIN'], icon: 'psychology', stat: 'PLYR XP' }
];

function showLevelUpOptions() {
    const upgradeContainer = document.querySelector('#level-up-menu .upgrade-container');
    upgradeContainer.innerHTML = '';

    // Shuffle and pick 3
    const options = [...ALL_UPGRADES].sort(() => 0.5 - Math.random()).slice(0, 3);

    options.forEach(upgrade => {
        const descriptionLines = (upgrade.descriptionLines ?? [upgrade.description ?? '']).filter(Boolean);
        const cardHTML = `
            <div class="upgrade-column">
                <div class="hold-indicator hidden">HOLD</div>
                <button type="button" class="upgrade-card" data-upgrade-id="${upgrade.id}" onmouseenter="updateLevelUpStats('${upgrade.id}')" onmouseleave="updateLevelUpStats(null)" onfocus="updateLevelUpStats('${upgrade.id}')" onblur="updateLevelUpStats(null)">
                    <span class="material-icons icon">${upgrade.icon}</span>
                    <h3>${upgrade.title}</h3>
                    <p>${descriptionLines.join('<br>')}</p>
                    <div class="hold-progress-bar">
                        <div class="hold-progress-fill"></div>
                    </div>
                </button>
                <div class="stat-item">
                    <span class="stat-label">${upgrade.stat}</span>
                    <span class="stat-value" id="stat-${upgrade.id}"></span>
                </div>
            </div>
        `;
        upgradeContainer.innerHTML += cardHTML;
    });

    // Add HP increase display row (shown below all upgrade options)
    const hpRowHTML = `
        <div class="level-up-hp-display">
            <div class="hp-increase-label">HEALTH</div>
            <div class="hp-increase-value" id="level-up-hp-value"></div>
        </div>
    `;
    upgradeContainer.innerHTML += hpRowHTML;

    // Add event listeners for hold-to-select
    setupHoldToSelectListeners();

    updateMenuSelection();
    updateLevelUpStats(null);
    updateMenuSelection();
    updateLevelUpStats(null);
}

function showStageCompleteOptions() {
    const upgradeContainer = document.querySelector('#stage-complete-menu .upgrade-container');
    upgradeContainer.innerHTML = '';

    // Filter out already acquired passives
    const availablePassives = SHIP_MUTATIONS.filter(p => !player.passives.has(p.id));

    // Shuffle and pick 3
    const options = [...availablePassives].sort(() => 0.5 - Math.random()).slice(0, 3);

    options.forEach(upgrade => {
        const cardHTML = `
            <div class="upgrade-column">
                <div class="hold-indicator hidden">HOLD</div>
                <button type="button" class="upgrade-card" data-upgrade-id="${upgrade.id}" data-type="passive">
                    <span class="material-icons icon">${upgrade.icon}</span>
                    <h3>${upgrade.title}</h3>
                    <p>${upgrade.description}</p>
                    <div class="hold-progress-bar">
                        <div class="hold-progress-fill"></div>
                    </div>
                </button>
            </div>
        `;
        upgradeContainer.innerHTML += cardHTML;
    });

    // Add event listeners for hold-to-select
    setupHoldToSelectListeners();

    updateMenuSelection();
}

function getVisibleMenuId() {
    if (!startMenu.classList.contains('hidden')) return 'start-menu';
    if (!pauseMenu.classList.contains('hidden')) return 'pause-menu';
    if (!gameOverMenu.classList.contains('hidden')) return 'game-over-menu';
    if (!document.getElementById('level-up-menu').classList.contains('hidden')) return 'level-up-menu';
    if (!document.getElementById('stage-complete-menu').classList.contains('hidden')) return 'stage-complete-menu';
    return null;
}

function updateMenuSelection() {
    const menuId = getVisibleMenuId();
    if (!menuId) return;

    if (currentMenuId !== menuId) {
        currentMenuId = menuId;
        selectedButtonIndex = MENUS[menuId].defaultIndex;
    }

    const buttons = document.querySelectorAll(MENUS[menuId].selector);
    if (buttons.length === 0) return;

    // Clamp index
    if (selectedButtonIndex < 0) selectedButtonIndex = buttons.length - 1;
    if (selectedButtonIndex >= buttons.length) selectedButtonIndex = 0;

    buttons.forEach((btn, index) => {
        if (index === selectedButtonIndex) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });

    // Update stats preview if in level up menu
    if (menuId === 'level-up-menu') {
        const upgradeTypes = Array.from(buttons).map(btn => btn.dataset.upgradeId);
        updateLevelUpStats(upgradeTypes[selectedButtonIndex]);
    }
}

function handleMenuInput(key) {
    const menuId = getVisibleMenuId();
    if (!menuId) return;

    const buttons = document.querySelectorAll(MENUS[menuId].selector);
    if (buttons.length === 0) return;

    // Initialize selection if needed
    if (currentMenuId !== menuId) {
        updateMenuSelection();
        return; // Just highlight first option on first input if not already
    }

    if (key === 'ArrowUp' || key === 'w' || key === 'ArrowLeft' || key === 'a') {
        selectedButtonIndex--;
        updateMenuSelection();
    } else if (key === 'ArrowDown' || key === 's' || key === 'ArrowRight' || key === 'd') {
        selectedButtonIndex++;
        updateMenuSelection();
    } else if (key === 'Enter' || key === ' ') {
        // Only start hold if not already holding (prevents keyboard repeat from restarting)
        if (isKeyHeld) return;
        isKeyHeld = true;

        // For level-up menu or stage-complete menu, start hold process
        if (menuId === 'level-up-menu' || menuId === 'stage-complete-menu') {
            const upgradeId = buttons[selectedButtonIndex].dataset.upgradeId;
            const type = buttons[selectedButtonIndex].dataset.type; // Check if passive
            startHold(upgradeId, buttons[selectedButtonIndex], type);
        } else {
            // For other menus, immediate click
            buttons[selectedButtonIndex].click();
        }
    }
}

function buildPowerSegments() {
    if (!powerSegments) return;
    powerSegments.innerHTML = '';
    for (let i = 0; i < player.maxPower; i++) {
        const seg = document.createElement('div');
        seg.className = 'segment';
        powerSegments.appendChild(seg);
    }
}

function updateUI() {
    const paddedScore = String(score).padStart(SCORE_DIGITS, '0');
    const firstActive = paddedScore.search(/[1-9]/);
    const activeFrom = firstActive === -1 ? paddedScore.length - 1 : firstActive;

    scoreDisplay.innerHTML = '';
    for (let i = 0; i < paddedScore.length; i++) {
        const span = document.createElement('span');
        span.className = 'score-digit' + (i < activeFrom ? ' inactive' : '');
        span.textContent = paddedScore[i];
        scoreDisplay.appendChild(span);
    }
    livesContainer.innerHTML = '';

    // Always show exactly 10 visual slots
    // Each tier of 10 HP uses a different color
    const MAX_VISUAL_SLOTS = 10;

    // Calculate which tier we're in (0-9 for tiers 1-10)
    // Clamp to 0 minimum to handle 0 or negative lives
    const currentTier = Math.max(0, Math.floor((player.lives - 1) / MAX_VISUAL_SLOTS));
    const maxTier = Math.floor((player.stats.hpMax - 1) / MAX_VISUAL_SLOTS);

    // HP within current tier (0-9)
    // Clamp to 0 minimum to handle 0 or negative lives
    const hpInCurrentTier = Math.max(0, ((player.lives - 1) % MAX_VISUAL_SLOTS) + 1);
    const maxHpInMaxTier = ((player.stats.hpMax - 1) % MAX_VISUAL_SLOTS) + 1;

    // Color tiers - each tier gets a distinct, contrasting color
    const tierColors = [
        { filled: 'tier-red', empty: 'tier-red-empty' },       // Tier 1: 1-10 HP (red)
        { filled: 'tier-cyan', empty: 'tier-cyan-empty' },     // Tier 2: 11-20 HP (cyan)
        { filled: 'tier-yellow', empty: 'tier-yellow-empty' }, // Tier 3: 21-30 HP (yellow)
        { filled: 'tier-magenta', empty: 'tier-magenta-empty' }, // Tier 4: 31-40 HP (magenta)
        { filled: 'tier-green', empty: 'tier-green-empty' },   // Tier 5: 41-50 HP (green)
        { filled: 'tier-orange', empty: 'tier-orange-empty' }, // Tier 6: 51-60 HP (orange)
        { filled: 'tier-purple', empty: 'tier-purple-empty' }, // Tier 7: 61-70 HP (purple)
        { filled: 'tier-pink', empty: 'tier-pink-empty' },     // Tier 8: 71-80 HP (pink)
        { filled: 'tier-lime', empty: 'tier-lime-empty' },     // Tier 9: 81-90 HP (lime)
        { filled: 'tier-blue', empty: 'tier-blue-empty' }      // Tier 10: 91-100 HP (blue)
    ];

    const lifeRow = document.createElement('div');
    lifeRow.className = 'life-row';

    // Render 10 slots from right to left
    for (let i = MAX_VISUAL_SLOTS - 1; i >= 0; i--) {
        const l = document.createElement('div');
        const slotIndex = i + 1; // 1-10

        // Determine if this slot is filled based on current HP in tier
        const isFilled = slotIndex <= hpInCurrentTier;

        // Determine if this slot should be shown as available based on max HP
        const isAvailable = slotIndex <= maxHpInMaxTier || currentTier < maxTier;

        // Get the appropriate tier color
        const tierColor = tierColors[Math.min(currentTier, tierColors.length - 1)];

        if (isFilled) {
            l.className = `life-icon ${tierColor.filled}`;
        } else if (isAvailable) {
            l.className = `life-icon ${tierColor.empty}`;
        } else {
            // Slot not available at current max HP
            l.className = 'life-icon unavailable';
        }

        lifeRow.appendChild(l);
    }

    livesContainer.appendChild(lifeRow);

    // Add tier markers to show completed and available 10-HP blocks
    const totalTiers = Math.min(maxTier + 1, tierColors.length);
    if (totalTiers > 0) {
        const tierRow = document.createElement('div');
        tierRow.className = 'life-tier-row';

        for (let t = 0; t < totalTiers; t++) {
            const tierColor = tierColors[Math.min(t, tierColors.length - 1)];
            const indicator = document.createElement('div');

            // A tier is "filled" if the player currently has any HP inside that 10-HP block
            const tierLives = Math.max(0, Math.min(player.lives - (t * MAX_VISUAL_SLOTS), MAX_VISUAL_SLOTS));
            const isTierFilled = tierLives > 0;

            indicator.className = `life-tier-indicator ${isTierFilled ? tierColor.filled : tierColor.empty}`;
            tierRow.appendChild(indicator);
        }

        livesContainer.appendChild(tierRow);
    }


    const segs = powerSegments.children;
    const atMaxLevel = player.powerLevel >= player.maxPower;
    for (let i = 0; i < segs.length; i++) {
        const filled = i < player.powerLevel;
        segs[i].className = filled ? 'segment active' : 'segment';
        if (atMaxLevel && filled) segs[i].className = 'segment max';
    }

    // Update Passive Icons
    const passiveIconsContainer = document.getElementById('passive-icons');
    if (passiveIconsContainer) {
        passiveIconsContainer.innerHTML = '';
        player.passives.forEach(passiveId => {
            const passiveDef = SHIP_MUTATIONS.find(p => p.id === passiveId);
            if (passiveDef) {
                const iconSpan = document.createElement('span');
                iconSpan.className = 'material-icons passive-icon-small';
                iconSpan.textContent = passiveDef.icon;
                passiveIconsContainer.appendChild(iconSpan);
            }
        });
    }

    // Update Active Power-up Icons
    const powerupIconsContainer = document.getElementById('powerup-icons');
    if (powerupIconsContainer) {
        powerupIconsContainer.innerHTML = '';
        const iconMap = {
            rapidFire: { icon: 'bolt', color: '#f80', duration: POWERUP_DURATION_RAPID_FIRE },
            slowDown: { icon: 'hourglass_bottom', color: '#0cf', duration: POWERUP_DURATION_SLOW_DOWN },
            fireballs: { icon: 'local_fire_department', color: '#f30', duration: POWERUP_DURATION_FIREBALLS },
            piercing: { icon: 'arrow_forward', color: '#a0f', duration: POWERUP_DURATION_PIERCING },
            invincibility: { icon: 'grade', color: '#ffd54f', duration: POWERUP_DURATION_INVINCIBILITY }
        };

        const activePowerups = Array.from(player.activePowerups.entries()).reverse(); // newest on the left

        activePowerups.forEach(([type, timer]) => {
            const powerupData = iconMap[type];
            if (!powerupData) return;

            const iconSpan = document.createElement('span');
            iconSpan.className = 'material-icons powerup-icon-small';
            iconSpan.textContent = powerupData.icon;
            iconSpan.style.color = powerupData.color;

            const totalDuration = powerupData.duration || timer;
            const expireThreshold = totalDuration ? Math.min(120, totalDuration * 0.25) : 90;
            if (timer <= expireThreshold) {
                iconSpan.classList.add('expiring');
            }

            powerupIconsContainer.appendChild(iconSpan);
        });
    }

    // Update XP Bar
    const xpPercent = atMaxLevel ? 100 : Math.min(100, (player.weaponXp / player.weaponXpMax) * 100);
    if (xpFill) xpFill.style.width = `${xpPercent}%`;
    if (xpStatus) {
        const missileIcon = `<svg class="missile-icon" viewBox="0 0 24 24"><path d="M12 2.5c-2.5 0-4.5 4-4.5 9.5c0 2 1 3.5 1 3.5l-2.5 2.5v1h12v-1l-2.5-2.5s1-1.5 1-3.5c0-5.5-2-9.5-4.5-9.5z"/></svg>`;
        if (atMaxLevel) {
            xpStatus.innerHTML = `${missileIcon} MAX`;
            xpStatus.classList.add('max');
            xpStatus.classList.remove('show');
        } else {
            xpStatus.innerHTML = `${missileIcon} LVL ${player.powerLevel}`;
            xpStatus.classList.remove('max');
            xpStatus.classList.add('show');
        }
    }

    // Update Player Level UI
    if (playerLevelDisplay) playerLevelDisplay.textContent = player.level;
    if (playerXpFill) {
        const pXpPercent = Math.min(100, (player.xp / player.xpMax) * 100);
        playerXpFill.style.width = `${pXpPercent}%`;
    }

    // Low Health Warning System
    if (lowHealthVignette && lowHealthWarning && gameState === 'PLAYING') {
        if (player.lives === 1) {
            // Critical - 1 HP
            lowHealthVignette.className = 'critical';
            lowHealthWarning.className = 'critical';
            lowHealthWarning.textContent = 'CRITICAL';
        } else if (player.lives <= 3 && player.lives > 1) {
            // Warning - 2-3 HP
            lowHealthVignette.className = 'warning';
            lowHealthWarning.className = 'warning';
            lowHealthWarning.textContent = 'WARNING';
        } else {
            // Healthy - remove warnings
            lowHealthVignette.className = '';
            lowHealthWarning.className = '';
        }
    } else if (lowHealthVignette && lowHealthWarning) {
        // Clear warnings when not playing
        lowHealthVignette.className = '';
        lowHealthWarning.className = '';
    }

    // Update Stage Progress Bar
    updateStageProgressBar();

    // Update Dodge Charges
    const dodgeContainer = document.getElementById('dodge-charges');
    if (dodgeContainer) {
        dodgeContainer.innerHTML = '';
        for (let i = 0; i < DODGE_CHARGES_MAX; i++) {
            const charge = document.createElement('div');
            charge.className = 'dodge-charge';

            if (i < player.dodgeCharges) {
                // Filled charges
                charge.classList.add('filled');
            } else if (player.dodgeCooldowns.length > 0) {
                // All empty charges flash when any are recharging
                charge.classList.add('recharging');
            }

            dodgeContainer.appendChild(charge);
        }
    }
}

function updateStageProgressBar() {
    const progressFill = document.getElementById('stage-progress-fill');
    const startNode = document.getElementById('stage-start-node');
    const endNode = document.getElementById('stage-end-node');

    if (!progressFill || !startNode || !endNode) return;

    const currentLevel = levelManager.currentLevel;
    const config = LEVEL_CONFIG[currentLevel];

    if (!config) return;

    // Colors
    const currentHue = config.hue;
    const nextLevel = Math.min(currentLevel + 1, 9); // Cap at 9
    const nextHue = LEVEL_CONFIG[nextLevel].hue;

    const currentColor = `hsl(${currentHue}, 100%, 50%)`;
    const nextColor = `hsl(${nextHue}, 100%, 50%)`;

    // Update Node Colors
    startNode.style.backgroundColor = currentColor;
    startNode.style.borderColor = `hsl(${currentHue}, 100%, 70%)`;
    startNode.style.boxShadow = `0 0 8px ${currentColor}`;

    endNode.style.backgroundColor = nextColor;
    endNode.style.borderColor = `hsl(${nextHue}, 100%, 70%)`;
    endNode.style.boxShadow = `0 0 8px ${nextColor}`;

    // Update Fill Color
    progressFill.style.backgroundColor = currentColor;
    progressFill.style.boxShadow = `0 0 8px ${currentColor}`;
    progressFill.style.color = currentColor; // For the ship SVG drop-shadow

    // Calculate Progress
    let progress = 0;
    if (currentLevel === 9) {
        // Infinite level - maybe pulse or just show full?
        // Let's show full for now to indicate "maxed out"
        progress = 100;
    } else {
        const duration = config.duration;
        const timer = levelManager.levelTimer;
        progress = Math.min(100, (timer / duration) * 100);
    }

    progressFill.style.width = `${progress}%`;
}

function updateLevelUpStats(previewType) {
    const upgradeCards = document.querySelectorAll('#level-up-menu .upgrade-card');
    const displayedUpgrades = Array.from(upgradeCards).map(card => card.dataset.upgradeId);

    // Helper to format preview
    const formatStat = (el, current, next, isInt = false) => {
        if (!el) return;
        if (next > current) {
            el.innerHTML = `${isInt ? current : current.toFixed(1)} <span class="preview-good">-> ${isInt ? next : next.toFixed(1)}</span>`;
        } else {
            el.innerHTML = `<span class="preview-neutral">${isInt ? current : current.toFixed(1)}</span>`;
        }
    };

    displayedUpgrades.forEach(id => {
        const el = document.getElementById(`stat-${id}`);
        let current, next;

        switch (id) {
            case 'hp':
                current = player.stats.hpMax;
                next = (previewType === 'hp') ? current + 1 : current;
                formatStat(el, current, next, true);
                break;
            case 'damage':
                current = player.stats.damageMult;
                next = (previewType === 'damage') ? current + 0.1 : current;
                formatStat(el, current, next);
                break;
            case 'speed':
                current = player.stats.fireRateMult;
                next = (previewType === 'speed') ? current + 0.1 : current;
                formatStat(el, current, next);
                break;
            case 'moveSpeed':
                current = player.stats.moveSpeedMult;
                next = (previewType === 'moveSpeed') ? current + 0.1 : current;
                formatStat(el, current, next);
                break;
            case 'weaponXp':
                current = player.stats.weaponXpMult;
                next = (previewType === 'weaponXp') ? current + 0.1 : current;
                formatStat(el, current, next);
                break;
            case 'playerXp':
                current = player.stats.playerXpMult;
                next = (previewType === 'playerXp') ? current + 0.1 : current;
                formatStat(el, current, next);
                break;
        }
    });

    // Update HP increase display (always shows the +1 from leveling up)
    const hpValueEl = document.getElementById('level-up-hp-value');
    if (hpValueEl) {
        const prevHp = player.stats.hpMax - 1;
        const currentHp = player.stats.hpMax;
        hpValueEl.innerHTML = `${prevHp} <span class="preview-good">-> ${currentHp}</span>`;
    }
}

let songToastTimeout;
function showSongToast(songName) {
    const toast = document.getElementById('song-toast');
    const nameDisplay = document.getElementById('song-name-display');
    if (!toast || !nameDisplay) return;

    nameDisplay.textContent = songName;
    toast.classList.remove('hidden');

    if (songToastTimeout) clearTimeout(songToastTimeout);
    songToastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

let stageToastTimeout;
function showStageToast(stageName, hue, stageNum) {
    const toast = document.getElementById('stage-toast');
    const nameDisplay = document.getElementById('stage-name-display');
    const labelDisplay = toast.querySelector('.stage-label');
    if (!toast || !nameDisplay) return;

    nameDisplay.textContent = stageName;
    if (stageNum !== undefined) {
        labelDisplay.textContent = `ENTERING SECTOR ${stageNum}`;
    }

    // Apply dynamic colors
    const color = `hsl(${hue}, 100%, 50%)`;
    toast.style.borderColor = color;
    toast.style.borderLeftColor = color;
    toast.style.boxShadow = `0 0 10px hsla(${hue}, 100%, 50%, 0.3)`;
    labelDisplay.style.color = color;
    labelDisplay.style.textShadow = `0 0 5px ${color}`;
    nameDisplay.style.textShadow = `0 0 5px #fff, 0 0 10px ${color}`;

    toast.classList.remove('hidden');

    if (stageToastTimeout) clearTimeout(stageToastTimeout);
    stageToastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// Audio Toggles
const musicToggleBtn = document.getElementById('music-toggle-btn');
const sfxToggleBtn = document.getElementById('sfx-toggle-btn');

if (musicToggleBtn) {
    musicToggleBtn.addEventListener('click', () => {
        const isMuted = MusicPlayer.toggleMute();
        updateAudioBtnState(musicToggleBtn, isMuted, 'music_note', 'music_off');
    });
}

if (sfxToggleBtn) {
    sfxToggleBtn.addEventListener('click', () => {
        const isMuted = toggleSfxMute();
        updateAudioBtnState(sfxToggleBtn, isMuted, 'volume_up', 'volume_off');
    });
}

function updateAudioBtnState(btn, isMuted, onIcon, offIcon) {
    const iconSpan = btn.querySelector('.material-icons');
    if (isMuted) {
        btn.classList.add('muted');
        iconSpan.textContent = offIcon;
    } else {
        btn.classList.remove('muted');
        iconSpan.textContent = onIcon;
    }
}

// ===== HOLD-TO-SELECT SYSTEM =====

function setupHoldToSelectListeners() {
    const upgradeCards = document.querySelectorAll('.upgrade-card'); // Select all upgrade cards globally

    upgradeCards.forEach(card => {
        // Mouse events
        card.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const upgradeId = card.dataset.upgradeId;
            const type = card.dataset.type;
            startHold(upgradeId, card, type);
        });

        // Touch events for mobile
        card.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const upgradeId = card.dataset.upgradeId;
            const type = card.dataset.type;
            startHold(upgradeId, card, type);
        });

        // Prevent context menu
        card.addEventListener('contextmenu', (e) => e.preventDefault());

        // Prevent click events (only hold should work)
        card.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    // Global mouseup and touchend listeners to cancel hold
    // Remove previous listeners to avoid duplicates if this is called multiple times
    document.removeEventListener('mousedown', cancelHold); // Changed from mouseup to mousedown to match startHold
    document.removeEventListener('mouseup', cancelHold);
    document.removeEventListener('touchend', cancelHold);
    document.removeEventListener('touchcancel', cancelHold);

    document.addEventListener('mouseup', cancelHold);
    document.addEventListener('touchend', cancelHold);
    document.addEventListener('touchcancel', cancelHold);

    // Keyboard listeners for hold
    // We can't easily remove anonymous functions, so we should move this out or use a named function.
    // For now, let's just leave it but be aware. Ideally this should be in init.
}

// Add global keyup listener once
if (!window.holdKeyUpListenerAdded) {
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            isKeyHeld = false; // Reset the key held state
            cancelHold();
        }
    });
    window.holdKeyUpListenerAdded = true;
}

function startHold(upgradeId, cardElement, type) {
    // Cancel any existing hold
    if (isHolding) {
        cancelHold();
    }

    isHolding = true;
    holdStartTime = Date.now();
    holdTargetUpgrade = { id: upgradeId, type: type };

    // Get the upgrade column (parent of button)
    const upgradeColumn = cardElement.parentElement;
    const holdIndicator = upgradeColumn.querySelector('.hold-indicator');
    const progressFill = cardElement.querySelector('.hold-progress-fill');

    // Show hold indicator and add holding state
    if (holdIndicator) {
        holdIndicator.classList.remove('hidden');
    }
    cardElement.classList.add('holding');

    // Reset progress bar
    if (progressFill) {
        progressFill.style.width = '0%';
    }

    // Start hold sound
    playHoldSound();

    // Start animation loop
    updateHoldProgress(cardElement);
}

function updateHoldProgress(cardElement) {
    if (!isHolding) return;

    const elapsed = Date.now() - holdStartTime;
    const progress = Math.min(elapsed / HOLD_DURATION, 1);

    // Update progress bar
    const progressFill = cardElement.querySelector('.hold-progress-fill');
    if (progressFill) {
        progressFill.style.width = `${progress * 100}%`;
    }

    // Update hold sound frequency
    if (holdOscillator && holdGainNode) {
        // Gradually increase frequency and volume
        const baseFreq = 300;
        const maxFreq = 600;
        holdOscillator.frequency.value = baseFreq + (maxFreq - baseFreq) * progress;
        holdGainNode.gain.value = 0.1 + (0.2 * progress);
    }

    if (progress >= 1) {
        // Hold complete!
        completeHold();
    } else {
        // Continue animation
        holdAnimationFrame = requestAnimationFrame(() => updateHoldProgress(cardElement));
    }
}

function completeHold() {
    if (!holdTargetUpgrade) return;

    const upgradeId = holdTargetUpgrade.id;
    const type = holdTargetUpgrade.type;

    // Stop hold
    cancelHold();

    // Play completion sound (higher pitch burst)
    playCompletionSound();

    // Select the upgrade
    if (type === 'passive') {
        window.applyPassive(upgradeId);
    } else {
        window.selectUpgrade(upgradeId);
    }
}

function cancelHold() {
    if (!isHolding) return;

    isHolding = false;

    // Stop animation
    if (holdAnimationFrame) {
        cancelAnimationFrame(holdAnimationFrame);
        holdAnimationFrame = null;
    }

    // Stop sound
    stopHoldSound();

    // Clean up UI
    const upgradeCards = document.querySelectorAll('.upgrade-card');
    upgradeCards.forEach(card => {
        card.classList.remove('holding');
        const progressFill = card.querySelector('.hold-progress-fill');
        if (progressFill) {
            progressFill.style.width = '0%';
        }
    });

    const holdIndicators = document.querySelectorAll('.hold-indicator');
    holdIndicators.forEach(indicator => {
        indicator.classList.add('hidden');
    });

    holdTargetUpgrade = null;
    holdStartTime = null;
}

// ===== HOLD AUDIO SYSTEM =====

function playHoldSound() {
    try {
        // Initialize audio context if needed
        if (!holdAudioContext) {
            holdAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Stop any existing sound
        stopHoldSound();

        // Create oscillator for rising tone
        holdOscillator = holdAudioContext.createOscillator();
        holdGainNode = holdAudioContext.createGain();

        holdOscillator.connect(holdGainNode);
        holdGainNode.connect(holdAudioContext.destination);

        holdOscillator.type = 'sine';
        holdOscillator.frequency.value = 300; // Start frequency

        // Fade in to prevent click at start (linear ramp is more reliable than exponential)
        const currentTime = holdAudioContext.currentTime;
        holdGainNode.gain.setValueAtTime(0, currentTime); // Start at true silence
        holdGainNode.gain.linearRampToValueAtTime(0.1, currentTime + 0.05); // Fade in over 50ms

        holdOscillator.start(currentTime);
    } catch (e) {
        console.warn('Could not play hold sound:', e);
    }
}

function stopHoldSound() {
    if (holdOscillator && holdGainNode && holdAudioContext) {
        // Keep local references so these nodes can clean themselves up independently
        const oscToStop = holdOscillator;
        const gainToStop = holdGainNode;

        // Clear the global references immediately so new sounds can start
        holdOscillator = null;
        holdGainNode = null;

        try {
            // Fade out to prevent click at end
            const currentTime = holdAudioContext.currentTime;
            gainToStop.gain.cancelScheduledValues(currentTime);
            gainToStop.gain.setValueAtTime(gainToStop.gain.value, currentTime);
            gainToStop.gain.linearRampToValueAtTime(0, currentTime + 0.05); // Fade out over 50ms

            // Stop the oscillator after fade-out completes
            oscToStop.stop(currentTime + 0.05);

            // Disconnect after stopping to prevent interference with new sounds
            setTimeout(() => {
                try {
                    gainToStop.disconnect();
                    oscToStop.disconnect();
                } catch (e) {
                    // Already disconnected
                }
            }, 60); // Slightly longer than fade-out duration
        } catch (e) {
            // Already stopped
        }
    }
}

function playCompletionSound() {
    try {
        if (!holdAudioContext) {
            holdAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const oscillator = holdAudioContext.createOscillator();
        const gainNode = holdAudioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(holdAudioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.value = 800; // High pitch
        gainNode.gain.value = 0.3;

        // Quick fade out
        gainNode.gain.exponentialRampToValueAtTime(0.01, holdAudioContext.currentTime + 0.2);

        oscillator.start();
        oscillator.stop(holdAudioContext.currentTime + 0.2);
    } catch (e) {
        console.warn('Could not play completion sound:', e);
    }
}
