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
    // Map client coordinates to canvas coordinates (0 to rect.width/height)
    const clientX = x - rect.left;
    const clientY = y - rect.top;

    // Map canvas coordinates to game coordinates
    // Game coordinates are (clientX / GAME_SCALE, clientY / GAME_SCALE)
    return {
        x: clientX / GAME_SCALE,
        y: clientY / GAME_SCALE
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
