/**
 * GLOBAL CONFIGURATION & STATE
 */

// DOM Elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const uiLayer = document.getElementById('ui-layer');
const startMenu = document.getElementById('start-menu');
const pauseMenu = document.getElementById('pause-menu');
const gameOverMenu = document.getElementById('game-over-menu');
const levelUpMenu = document.getElementById('level-up-menu');
const scoreDisplay = document.getElementById('score-display');
const hudTop = document.querySelector('.hud-top');
const livesContainer = document.getElementById('lives-container');
const powerSegments = document.getElementById('power-segments');
const xpFill = document.getElementById('xp-fill');
const xpStatus = document.getElementById('xp-status');
const finalScoreDisplay = document.getElementById('final-score');
const flashOverlay = document.getElementById('flash-overlay');
const pauseBtn = document.getElementById('pause-btn');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const quitBtn = document.getElementById('quit-btn');
const playerLevelDisplay = document.getElementById('player-level-display');
const playerXpFill = document.getElementById('player-xp-fill');
const lowHealthVignette = document.getElementById('low-health-vignette');
const lowHealthWarning = document.getElementById('low-health-warning');

// Constants
const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 800;
const IS_DESKTOP = !IS_MOBILE; // For desktop-specific moderate optimizations
const SCORE_DIGITS = 10;
const POWERUP_LIFETIME_FRAMES = 900; // ~15 seconds before despawn
const POWERUP_BLINK_FRAMES = 240; // Blink for last ~4 seconds
const SCORE_POWERUP_VALUE = 1000;
const SCORE_POWERUP_XP_RATIO = 0.2;
const TIME_STEP = 1000 / 60; // Fixed 60 FPS logic
let GAME_SCALE = 0.75; // Will be dynamic
const TARGET_LOGICAL_WIDTH = 573; // Based on 430px / 0.75

const PLAYER_MAX_SPEED = 6;
const PLAYER_MAX_SPEED_UP = 7.5;
const PLAYER_MAX_SPEED_DOWN = 5.25;
const PLAYER_ACCEL = 0.55;
const PLAYER_ACCEL_UP_BOOST = 1.25;
const PLAYER_ACCEL_DOWN_FACTOR = 0.8;
const PLAYER_FRICTION = 0.9;
const PLAYER_TILT_MAX = 0.25;
const PLAYER_TILT_DEADZONE = 0.8;
const PLAYER_TILT_DIR_SMOOTH = 0.1;
const PLAYER_TILT_BLEND = 0.08;
const PLAYER_TILT_DAMP = 0.98;
const PLAYFIELD_SIDE_PADDING = 20;
const PLAYFIELD_TOP_BUFFER = 20;
const PLAYFIELD_BOTTOM_PADDING = 36;
const PLAYER_START_BOTTOM_OFFSET = 200;

const MAX_POWER_LEVEL = 10;
const WEAPON_XP_BASE = 150;
const WEAPON_XP_GROWTH = 2;
const PLAYER_MAX_LIVES = 5;

// Weapon Tuning
const PLAYER_WEAPON_BASE = {
    beam: { damage: 1.1, pierce: false },
    normal: { damage: 1, pierce: false },
    homing: { damage: 0.9, pierce: false },
    wave: { damage: 0.75, pierce: true },
    blade: { damage: 0.65, pierce: true },
    missile: { damage: 2.5, pierce: false } // High damage + AOE effect
};

const WEAPON_LEVEL_CURVE = [
    { damage: 0.9, speed: 0.5, hue: 0, glow: 0 },      // 0 - Slower
    { damage: 1.0, speed: 0.90, hue: 8, glow: 0.02 },    // 1 - Slower
    { damage: 1.05, speed: 0.95, hue: 16, glow: 0.03 }, // 2 - Slower
    { damage: 1.1, speed: 1.04, hue: 24, glow: 0.05 },  // 3
    { damage: 1.15, speed: 1.06, hue: 32, glow: 0.07 }, // 4
    { damage: 1.2, speed: 1.08, hue: 40, glow: 0.1 },   // 5
    { damage: 1.28, speed: 1.1, hue: 52, glow: 0.12 },  // 6
    { damage: 1.35, speed: 1.12, hue: 64, glow: 0.14 }, // 7
    { damage: 1.45, speed: 1.15, hue: 76, glow: 0.16 }, // 8
    { damage: 1.55, speed: 1.18, hue: 88, glow: 0.18 }, // 9
    { damage: 1.7, speed: 1.22, hue: 100, glow: 0.2 }   // 10+
];

// Game State Variables
let width, height;
let globalHue = 0;
let gameState = 'DEMO';
let score = 0;
let frameCount = 0;
let lastTime = 0;
let accumulator = 0;
let hudTopHeight = hudTop ? hudTop.getBoundingClientRect().height : 80;

// Input State
const input = { x: 0, y: 0, active: false, lastX: 0, lastY: 0 };
const keys = {
    up: false, down: false, left: false, right: false,
    w: false, a: false, s: false, d: false
};

// Player State
const player = {
    x: 0, y: 0, radius: 6,
    w: 24, h: 32,
    lives: PLAYER_MAX_LIVES, iframes: 0, powerLevel: 0, maxPower: MAX_POWER_LEVEL,
    weaponXp: 0, weaponXpMax: 0, // Weapon Progression
    level: 1, xp: 0, xpMax: 100, // Character Progression
    stats: {
        damageMult: 1.0,
        hpMax: PLAYER_MAX_LIVES,
        fireRateMult: 1.0,
        moveSpeedMult: 1.0
    },
    hasShield: false,
    tail: [],
    vx: 0, vy: 0, tilt: 0, tiltDir: 1,
    godMode: false
};

const CHAR_XP_BASE = 80;
const CHAR_XP_GROWTH = 1;

// Entity Lists
const bullets = [];
const enemies = [];
const particles = [];
const powerups = [];
const texts = [];

// Resize Function
function resize() {
    const container = document.getElementById('game-container');
    const rect = container.getBoundingClientRect();

    // Calculate scale to maintain target logical width
    // If screen is wider than desktop max-width (handled by CSS), this will just use that width
    // On mobile, rect.width will be screen width
    GAME_SCALE = rect.width / TARGET_LOGICAL_WIDTH;

    // Clamp scale to reasonable limits if needed, but for now let it float
    // Ensure we don't get too small or negative
    GAME_SCALE = Math.max(0.1, GAME_SCALE);

    width = rect.width / GAME_SCALE;
    height = rect.height / GAME_SCALE;
    canvas.width = rect.width;
    canvas.height = rect.height;
    if (hudTop) hudTopHeight = hudTop.getBoundingClientRect().height / GAME_SCALE;

    // UI Scaling
    const uiScale = rect.width / 430; // Base design width
    const uiElements = [uiLayer, startMenu, pauseMenu, gameOverMenu, levelUpMenu];

    uiElements.forEach(el => {
        if (el) {
            el.style.transform = `scale(${uiScale})`;
            el.style.width = `${100 / uiScale}%`;
            el.style.height = `${100 / uiScale}%`;
            el.style.transformOrigin = 'top left';
        }
    });

    // We need setPlayerStartPosition, but it's not defined yet.
    // We'll handle player positioning in the main game logic or player module.
    // For now, just setting width/height is enough for globals.
}
window.addEventListener('resize', resize);
resize();
