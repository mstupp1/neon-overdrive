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
        if (atMaxLevel) {
            xpStatus.textContent = 'MAX';
            xpStatus.classList.add('max');
            xpStatus.classList.remove('show');
        } else {
            xpStatus.textContent = `LVL ${player.powerLevel}`;
            xpStatus.classList.remove('max');
            xpStatus.classList.add('show');
        }
    }
}
