/**
 * UI MANAGEMENT
 */

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
