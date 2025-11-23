/**
 * UI MANAGEMENT
 */

// Menu Navigation State
let currentMenuId = null;
let selectedButtonIndex = 0;

const MENUS = {
    'start-menu': { selector: '#start-menu .btn', defaultIndex: 0 },
    'pause-menu': { selector: '#pause-menu .btn', defaultIndex: 0 },
    'game-over-menu': { selector: '#game-over-menu .btn', defaultIndex: 0 },
    'level-up-menu': { selector: '#level-up-menu .upgrade-card', defaultIndex: 1 } // Center option default
};

const ALL_UPGRADES = [
    { id: 'hp', title: 'REINFORCE', description: '+1 MAX HP', icon: 'favorite', stat: 'HP' },
    { id: 'damage', title: 'OVERCHARGE', description: '+10% DAMAGE', icon: 'flash_on', stat: 'DMG' },
    { id: 'speed', title: 'ACCELERATE', description: '+10% FIRE RATE', icon: 'speed', stat: 'RATE' },
    { id: 'moveSpeed', title: 'AFTERBURNER', description: '+10% MOVE SPEED', icon: 'directions_run', stat: 'MOVE' }
];

function showLevelUpOptions() {
    const upgradeContainer = document.querySelector('#level-up-menu .upgrade-container');
    upgradeContainer.innerHTML = '';

    // Shuffle and pick 3
    const options = [...ALL_UPGRADES].sort(() => 0.5 - Math.random()).slice(0, 3);

    options.forEach(upgrade => {
        const cardHTML = `
            <div class="upgrade-column">
                <button class="upgrade-card" data-upgrade-id="${upgrade.id}" onclick="selectUpgrade('${upgrade.id}')" onmouseenter="updateLevelUpStats('${upgrade.id}')" onmouseleave="updateLevelUpStats(null)" onfocus="updateLevelUpStats('${upgrade.id}')" onblur="updateLevelUpStats(null)">
                    <span class="material-icons icon">${upgrade.icon}</span>
                    <h3>${upgrade.title}</h3>
                    <p>${upgrade.description}</p>
                </button>
                <div class="stat-item">
                    <span class="stat-label">${upgrade.stat}</span>
                    <span class="stat-value" id="stat-${upgrade.id}"></span>
                </div>
            </div>
        `;
        upgradeContainer.innerHTML += cardHTML;
    });

    updateMenuSelection();
    updateLevelUpStats(null);
}

function getVisibleMenuId() {
    if (!startMenu.classList.contains('hidden')) return 'start-menu';
    if (!pauseMenu.classList.contains('hidden')) return 'pause-menu';
    if (!gameOverMenu.classList.contains('hidden')) return 'game-over-menu';
    if (!document.getElementById('level-up-menu').classList.contains('hidden')) return 'level-up-menu';
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
        buttons[selectedButtonIndex].click();
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
    const currentTier = Math.floor((player.lives - 1) / MAX_VISUAL_SLOTS);
    const maxTier = Math.floor((player.stats.hpMax - 1) / MAX_VISUAL_SLOTS);

    // HP within current tier (0-9)
    const hpInCurrentTier = ((player.lives - 1) % MAX_VISUAL_SLOTS) + 1;
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
    if (totalTiers > 1) {
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
        }
    });
}
