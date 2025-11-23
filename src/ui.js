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
        const upgradeTypes = ['hp', 'damage', 'speed'];
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
    for (let i = 0; i < player.lives; i++) {
        const l = document.createElement('div'); l.className = 'life-icon';
        livesContainer.appendChild(l);
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
}

function updateLevelUpStats(previewType) {
    const hpEl = document.getElementById('stat-hp');
    const dmgEl = document.getElementById('stat-damage');
    const spdEl = document.getElementById('stat-speed');

    if (!hpEl || !dmgEl || !spdEl) return;

    // Current Stats
    const currentHp = player.lives;
    const currentDmg = player.stats.damageMult.toFixed(1);
    const currentSpd = player.stats.fireRateMult.toFixed(1);

    // Projected Stats
    let nextHp = currentHp;
    let nextDmg = parseFloat(currentDmg);
    let nextSpd = parseFloat(currentSpd);

    if (previewType === 'hp') nextHp++;
    if (previewType === 'damage') nextDmg += 0.1;
    if (previewType === 'speed') nextSpd += 0.1;

    // Helper to format preview
    const formatStat = (el, current, next, isInt = false) => {
        if (next > current) {
            el.innerHTML = `${current} <span class="preview-good">-> ${isInt ? next : next.toFixed(1)}</span>`;
        } else {
            el.innerHTML = `<span class="preview-neutral">${current}</span>`;
        }
    };

    formatStat(hpEl, currentHp, nextHp, true);
    formatStat(dmgEl, parseFloat(currentDmg), nextDmg);
    formatStat(spdEl, parseFloat(currentSpd), nextSpd);
}
