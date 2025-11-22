/**
 * UTILITIES
 */

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}

function j(val, amt = 3) {
    return val + Math.random() * amt - amt / 2;
}

function toGameCoords(x, y) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    return {
        x: (x - rect.left) * scaleX / GAME_SCALE,
        y: (y - rect.top) * scaleY / GAME_SCALE
    };
}

function getWeaponXpForLevel(level) {
    const clamped = Math.min(Math.max(0, level), MAX_POWER_LEVEL - 1);
    return Math.floor(WEAPON_XP_BASE * Math.pow(WEAPON_XP_GROWTH, clamped));
}

function getWeaponLevelStats(level) {
    const idx = Math.min(Math.max(0, level), WEAPON_LEVEL_CURVE.length - 1);
    return WEAPON_LEVEL_CURVE[idx];
}

// Initialize player XP max now that helper is available
player.weaponXpMax = getWeaponXpForLevel(0);
