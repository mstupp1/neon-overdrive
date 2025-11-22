/**
 * NEON GLITCH ENGINE V7: OVERDRIVE MOBILE
 */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const uiLayer = document.getElementById('ui-layer');
const startMenu = document.getElementById('start-menu');
const pauseMenu = document.getElementById('pause-menu');
const gameOverMenu = document.getElementById('game-over-menu');
const scoreDisplay = document.getElementById('score-display');
const hudTop = document.querySelector('.hud-top');
const livesContainer = document.getElementById('lives-container');
const powerSegments = document.getElementById('power-segments');
const finalScoreDisplay = document.getElementById('final-score');
const flashOverlay = document.getElementById('flash-overlay');
const pauseBtn = document.getElementById('pause-btn');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const quitBtn = document.getElementById('quit-btn');
const SCORE_DIGITS = 10;

// --- ASSET PRE-RENDERING ---
const sprites = {};

function renderGlowSprite(color, radius, glow, type = 'circle') {
    const size = (radius + glow) * 2;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const cx = c.getContext('2d');
    const center = size / 2;

    cx.shadowBlur = glow; cx.shadowColor = color;
    cx.fillStyle = '#fff';

    if (type === 'circle') {
        cx.beginPath(); cx.arc(center, center, radius, 0, Math.PI * 2); cx.fill();
    } else if (type === 'beam') {
        cx.fillStyle = color;
        cx.fillRect(center - radius, center - radius * 3, radius * 2, radius * 6);
        cx.fillStyle = '#fff';
        cx.fillRect(center - radius / 2, center - radius * 2, radius, radius * 4);
    } else if (type === 'blade') {
        cx.strokeStyle = color; cx.lineWidth = 3;
        cx.beginPath();
        cx.moveTo(center - radius, center); cx.lineTo(center + radius, center);
        cx.moveTo(center, center - radius); cx.lineTo(center, center + radius);
        cx.stroke();
    } else if (type === 'chaser') {
        cx.fillStyle = color; cx.shadowBlur = glow; cx.shadowColor = color;
        cx.beginPath(); cx.moveTo(center, center + 15); cx.lineTo(center + 10, center - 15); cx.lineTo(center, center - 10); cx.lineTo(center - 10, center - 15); cx.fill();
    } else if (type === 'spinner') {
        cx.strokeStyle = color; cx.lineWidth = 3; cx.shadowBlur = glow; cx.shadowColor = color;
        cx.beginPath(); cx.arc(center, center, 15, 0, Math.PI * 2); cx.stroke();
        for (let i = 0; i < 4; i++) {
            cx.save(); cx.translate(center, center); cx.rotate(i * Math.PI / 2);
            cx.beginPath(); cx.moveTo(15, 0); cx.lineTo(25, 5); cx.lineTo(25, -5); cx.fillStyle = color; cx.fill();
            cx.restore();
        }
    } else if (type === 'dasher') {
        cx.fillStyle = color; cx.shadowBlur = glow; cx.shadowColor = color;
        cx.beginPath(); cx.moveTo(center, center + 20); cx.lineTo(center + 6, center - 10); cx.lineTo(center, center - 20); cx.lineTo(center - 6, center - 10); cx.fill();
    } else if (type === 'snake') {
        cx.fillStyle = color; cx.shadowBlur = glow; cx.shadowColor = color;
        cx.beginPath(); cx.arc(center, center, 12, 0, Math.PI * 2); cx.fill();
    } else if (type === 'sniper') {
        cx.fillStyle = color; cx.shadowBlur = glow; cx.shadowColor = color;
        cx.fillRect(center - 15, center - 15, 30, 30);
    }
    return c;
}

function prerenderAssets() {
    // Varied enemy bullets
    sprites.enemyBulletBasic = renderGlowSprite('#f00', 4, 8);   // Chaser: Small, sharp
    sprites.enemyBulletOrb = renderGlowSprite('#d0f', 6, 12);    // Spinner: Medium, purple
    sprites.enemyBulletFast = renderGlowSprite('#ff0', 3, 10, 'beam'); // Dasher: Fast, yellow beam-like
    sprites.enemyBulletSniper = renderGlowSprite('#fff', 8, 15); // Sniper: Large, white hot

    sprites.playerNormal = renderGlowSprite('#0ff', 4, 8);
    sprites.playerBeam = renderGlowSprite('#0ff', 3, 15, 'beam');
    sprites.playerHoming = renderGlowSprite('#d0f', 4, 8);
    sprites.playerWave = renderGlowSprite('#50f', 5, 12);
    sprites.playerBlade = renderGlowSprite('#0ff', 15, 10, 'blade');
    sprites.enemyChaser = renderGlowSprite('#f00', 20, 10, 'chaser');
    sprites.enemySpinner = renderGlowSprite('#f0f', 30, 10, 'spinner');
    sprites.enemyDasher = renderGlowSprite('#ff0', 20, 10, 'dasher');
    sprites.enemySnake = renderGlowSprite('#f00', 15, 10, 'snake');
    sprites.enemySniper = renderGlowSprite('#f44', 20, 10, 'sniper');
}
prerenderAssets();

// --- Audio ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    if (gameState === 'DEMO') return; // Muted in demo
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'shoot') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'bomb') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 1.0);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.linearRampToValueAtTime(0, now + 1.0);
        osc.start(now); osc.stop(now + 1.0);
    } else if (type === 'shieldBreak') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(0, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    }
}

// --- Object Pooling ---
class Pool {
    constructor(createFn, maxSize = 200) {
        this.pool = [];
        this.createFn = createFn;
        this.maxSize = maxSize;
    }
    get(...args) {
        let obj = this.pool.pop();
        if (!obj) obj = this.createFn();
        obj.init(...args);
        return obj;
    }
    release(obj) {
        if (this.pool.length < this.maxSize) {
            this.pool.push(obj);
        }
    }
}

// --- State ---
let width, height;
let globalHue = 0;
let gameState = 'DEMO'; // Start in DEMO
let score = 0;
let frameCount = 0; // Logical frames
let lastTime = 0;
let accumulator = 0;
const TIME_STEP = 1000 / 60; // Fixed 60 FPS logic

// Input
const PLAYER_MAX_SPEED = 6; // Shared movement cap for keyboard and touch/mouse
const PLAYER_MAX_SPEED_UP = 7.5; // Slightly higher cap when boosting upward
const PLAYER_MAX_SPEED_DOWN = 5.25; // Slightly slower when retreating/backing down
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
const PLAYFIELD_TOP_BUFFER = 20; // Keep player clear of the HUD bar
const PLAYFIELD_BOTTOM_PADDING = 36; // Keep player off the very bottom edge
const PLAYER_START_BOTTOM_OFFSET = 40; // Keep initial spawn near the bottom without hugging the edge
let hudTopHeight = hudTop ? hudTop.getBoundingClientRect().height : 80;
const input = { x: 0, y: 0, active: false, lastX: 0, lastY: 0 };

// Keyboard Input
const keys = {
    up: false, down: false, left: false, right: false,
    w: false, a: false, s: false, d: false
};

// Player
const PLAYER_MAX_LIVES = 6;
const player = {
    x: 0, y: 0, radius: 6, // Slightly smaller hitbox
    w: 24, h: 32,
    lives: PLAYER_MAX_LIVES, iframes: 0, powerLevel: 1, maxPower: 6,
    hasShield: false,
    tail: [],
    vx: 0, vy: 0, tilt: 0, tiltDir: 1
};

// Entities Lists
const bullets = [];
const enemies = [];
const particles = [];
const powerups = [];
const texts = [];

function setPlayerStartPosition() {
    const topLimit = hudTopHeight + PLAYFIELD_TOP_BUFFER + player.radius;
    const targetBottomY = height - PLAYFIELD_BOTTOM_PADDING - PLAYER_START_BOTTOM_OFFSET;
    player.x = width / 2;
    player.y = Math.max(topLimit, targetBottomY);
}

// --- Resize ---
function resize() {
    // Constrain to mobile dimensions
    const container = document.getElementById('game-container');
    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width;
    canvas.height = height;
    if (hudTop) hudTopHeight = hudTop.getBoundingClientRect().height;
    if (gameState === 'MENU' || gameState === 'DEMO') setPlayerStartPosition();
}
window.addEventListener('resize', resize);
resize();

// Map pointer coords to game space so touch/mouse movement matches keyboard speed
function toGameCoords(x, y) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    return {
        x: (x - rect.left) * scaleX,
        y: (y - rect.top) * scaleY
    };
}

// --- Input Handling (Relative) ---
function handleStart(x, y) {
    input.active = true;
    const pos = toGameCoords(x, y);
    input.lastX = pos.x;
    input.lastY = pos.y;
}
function handleMove(x, y) {
    if (!input.active) return;
    const pos = toGameCoords(x, y);
    input.lastX = pos.x;
    input.lastY = pos.y;
}
function handleEnd() { input.active = false; }

window.addEventListener('mousedown', e => handleStart(e.clientX, e.clientY));
window.addEventListener('mousemove', e => handleMove(e.clientX, e.clientY));
window.addEventListener('mouseup', handleEnd);

window.addEventListener('touchstart', e => {
    handleStart(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });
window.addEventListener('touchmove', e => {
    e.preventDefault(); // Prevent scrolling
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });
window.addEventListener('touchend', handleEnd);

// Keyboard Controls
window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') { keys.up = true; keys.w = true; }
    if (key === 'arrowdown' || key === 's') { keys.down = true; keys.s = true; }
    if (key === 'arrowleft' || key === 'a') { keys.left = true; keys.a = true; }
    if (key === 'arrowright' || key === 'd') { keys.right = true; keys.d = true; }
});

window.addEventListener('keyup', e => {
    const key = e.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') { keys.up = false; keys.w = false; }
    if (key === 'arrowdown' || key === 's') { keys.down = false; keys.s = false; }
    if (key === 'arrowleft' || key === 'a') { keys.left = false; keys.a = false; }
    if (key === 'arrowright' || key === 'd') { keys.right = false; keys.d = false; }
});

// --- Helpers ---
const rand = (min, max) => Math.random() * (max - min) + min;
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
function j(val, amt = 3) { return val + Math.random() * amt - amt / 2; }

// --- Classes ---

class Bullet {
    constructor() { this.active = false; }
    init(x, y, angle, speed, type, subType = 'normal') {
        this.x = x; this.y = y;
        this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
        this.angle = angle; this.speed = speed;
        this.type = type; this.subType = subType;
        this.active = true;

        // Set radius based on subtype
        if (type === 'enemy') {
            if (subType === 'basic') this.radius = 5;
            else if (subType === 'orb') this.radius = 7;
            else if (subType === 'fast') this.radius = 4;
            else if (subType === 'sniper') this.radius = 9;
            else this.radius = 6;
        } else {
            this.radius = 8;
        }

        this.timer = 0; this.rotation = 0;
        this.life = 1.0;
    }

    update() {
        this.timer++;
        this.x += this.vx; this.y += this.vy;

        if (this.subType === 'homing') {
            let target = null;
            let minDist = 400;
            if (frameCount % 4 === 0) {
                for (let e of enemies) {
                    if (!e.active) continue;
                    let d = dist(this.x, this.y, e.x, e.y);
                    if (d < minDist && e.y > 0) { minDist = d; target = e; }
                }
            }

            if (target) {
                let angleTo = Math.atan2(target.y - this.y, target.x - this.x);
                let diff = angleTo - this.angle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.angle += diff * 0.15;
                this.vx = Math.cos(this.angle) * this.speed;
                this.vy = Math.sin(this.angle) * this.speed;
            }
        } else if (this.subType === 'blade') {
            this.rotation += 0.3;
            this.vx *= 0.99; this.vy *= 0.99;
            this.life -= 0.005;
            if (this.life <= 0) this.active = false;
        }

        // Let enemy bullets travel farther offscreen to keep long shots alive a bit longer
        const bounds = this.type === 'enemy' ? 300 : 50;
        if (this.x < -bounds || this.x > width + bounds || this.y < -bounds || this.y > height + bounds) this.active = false;
    }

    draw(ctx) {
        if (this.type === 'enemy') {
            ctx.globalAlpha = 1;
            if (this.subType === 'basic') ctx.drawImage(sprites.enemyBulletBasic, this.x - 12, this.y - 12);
            else if (this.subType === 'orb') ctx.drawImage(sprites.enemyBulletOrb, this.x - 18, this.y - 18);
            else if (this.subType === 'fast') {
                ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle + Math.PI / 2);
                ctx.drawImage(sprites.enemyBulletFast, -6, -15); // Beam shape
                ctx.restore();
            }
            else if (this.subType === 'sniper') ctx.drawImage(sprites.enemyBulletSniper, this.x - 23, this.y - 23);
            else ctx.drawImage(sprites.enemyBulletBasic, this.x - 12, this.y - 12); // Fallback
        } else {
            ctx.globalCompositeOperation = 'lighter';
            if (this.subType === 'beam') {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.angle + Math.PI / 2);
                ctx.drawImage(sprites.playerBeam, -10, -20, 20, 40);
                ctx.restore();
            }
            else if (this.subType === 'homing') ctx.drawImage(sprites.playerHoming, this.x - 12, this.y - 12);
            else if (this.subType === 'wave') ctx.drawImage(sprites.playerWave, this.x - 18, this.y - 18);
            else if (this.subType === 'blade') {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation);
                ctx.globalAlpha = Math.max(0, this.life);
                ctx.drawImage(sprites.playerBlade, -25, -25);
                ctx.globalAlpha = 1;
                ctx.restore();
            }
            else ctx.drawImage(sprites.playerNormal, this.x - 12, this.y - 12);
            ctx.globalCompositeOperation = 'source-over';
        }
    }
}

class Enemy {
    constructor() { this.active = false; this.segments = []; }
    init(type) {
        this.type = type; this.active = true; this.hp = 1;
        this.timer = rand(0, 30); // Randomize start to prevent sync
        this.state = 'move';
        this.fireTimer = rand(0, 50); // Randomize start
        this.flashTimer = 0; // Flash effect when taking damage
        this.fade = 1; this.inactive = false;
        this.vx = 0; this.vy = 0;

        const spawnMargin = 50;
        // Spawn from the top band only to keep entries predictable
        this.x = rand(spawnMargin, width - spawnMargin); this.y = -40;

        if (type === 'chaser') { this.hp = 4; this.radius = 18; this.speed = rand(2, 3.5); }
        else if (type === 'spinner') { this.hp = 15; this.radius = 25; this.speed = 1.5; }
        else if (type === 'dasher') {
            this.hp = 3; this.radius = 12; this.speed = 6;
            const a = Math.atan2(player.y - this.y, player.x - this.x);
            this.vx = Math.cos(a) * this.speed; this.vy = Math.sin(a) * this.speed;
        }
        else if (type === 'snake') {
            this.hp = 20; this.radius = 15;
            this.segments = [];
            for (let i = 0; i < 8; i++) this.segments.push({ x: this.x, y: this.y - i * 15 });
        }
        else if (type === 'sniper') {
            this.hp = 6; this.radius = 20;
            this.tx = rand(50, width - 50); this.ty = rand(50, height * 0.4);
        }
    }

    update() {
        // Decrease flash timer
        if (this.flashTimer > 0) this.flashTimer--;

        // Fade-out zone near the bottom HUD to prevent clumping
        const bottomHudHeight = 80;
        const fadeBuffer = 50; // Reduced from 140 to keep enemies active longer
        const fadeStart = height - (bottomHudHeight + fadeBuffer);
        const fadeEnd = height - bottomHudHeight + 10;
        const inFadeZone = this.y >= fadeStart;
        const fadeT = inFadeZone ? Math.min(1, (this.y - fadeStart) / (fadeEnd - fadeStart)) : 0;
        this.fade = 1 - fadeT;
        this.inactive = inFadeZone;
        const allowFire = !this.inactive;

        if (this.type === 'chaser') {
            const a = Math.atan2(player.y - this.y, player.x - this.x);
            this.x += Math.cos(a) * this.speed; this.y += Math.max(1, Math.sin(a) * this.speed);
            this.fireTimer++;
            if (allowFire && this.fireTimer > 40) { // Even faster fire (was 60)
                this.fireTimer = 0;
                // Light harassment shots from chasers
                spawnBullet(this.x, this.y, a + rand(-0.2, 0.2), 6, 'enemy', 'basic');
            }
        }
        else if (this.type === 'spinner') {
            this.y += 0.8; this.x += Math.sin(frameCount * 0.03);
            this.timer++;
            if (allowFire && this.timer > 40) { // Adjusted rate
                this.timer = 0;
                // Spinners lay down broader, faster rings to pressure space
                // Reduced speed from 9 to 6 to prevent "fading" illusion and make them dodgeable but visible
                for (let i = 0; i < 6; i++) spawnBullet(this.x, this.y, i * (Math.PI / 3) + frameCount * 0.1, 6, 'enemy', 'orb');
            }
        }
        else if (this.type === 'dasher') {
            this.x += this.vx; this.y += this.vy;
            this.fireTimer++;
            if (allowFire && this.fireTimer > 50) { // Faster fire (was 70)
                this.fireTimer = 0;
                const backAngle = Math.atan2(this.vy, this.vx) + Math.PI; // Fire slightly backwards while dashing
                spawnBullet(this.x, this.y, backAngle + rand(-0.15, 0.15), 8, 'enemy', 'fast');
            }
        }
        else if (this.type === 'snake') {
            this.x += Math.sin(frameCount * 0.05) * 3; this.y += 2;
            let p = { x: this.x, y: this.y };
            this.segments.forEach(s => { s.x += (p.x - s.x) * 0.3; s.y += (p.y - s.y) * 0.3; p = { x: s.x, y: s.y }; });
        }
        else if (this.type === 'sniper') {
            if (this.state === 'move') {
                this.x += (this.tx - this.x) * 0.05; this.y += (this.ty - this.y) * 0.05;
                if (Math.abs(this.x - this.tx) < 5) { this.state = 'aim'; this.timer = 0; }
            } else if (this.state === 'aim') {
                this.timer++;
                if (allowFire && this.timer > 40) { // Faster fire (was 50)
                    const a = Math.atan2(player.y - this.y, player.x - this.x);
                    spawnBullet(this.x, this.y, a, 15, 'enemy', 'sniper');
                    this.tx = rand(50, width - 50); this.ty = rand(50, height * 0.4); this.state = 'move';
                }
            }
        }

        // Drift down and disengage when overlapping the HUD zone
        if (inFadeZone) {
            const exitDrift = 1.5 + fadeT * 2.5;
            this.y += exitDrift;
            this.vx = (this.vx || 0) * 0.92;
            this.vy = (this.vy || 0) * 0.92;
        }

        // Soft steer away from edges so enemies don't linger at the borders
        const edgeMargin = 60;
        if (this.x < edgeMargin) this.x += (edgeMargin - this.x) * 0.05;
        else if (this.x > width - edgeMargin) this.x -= (this.x - (width - edgeMargin)) * 0.05;
        if (this.y < edgeMargin) this.y += (edgeMargin - this.y) * 0.05;
        else if (this.y > height - edgeMargin) this.y -= (this.y - (height - edgeMargin)) * 0.05;

        if (this.y > height + 100 || this.x < -100 || this.x > width + 100) this.active = false;
    }

    draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y);

        const baseAlpha = this.fade ?? 1;
        ctx.globalAlpha = baseAlpha;

        // Flash effect when taking damage
        if (this.flashTimer > 0) {
            ctx.globalCompositeOperation = 'lighter';
            const flashIntensity = this.flashTimer / 8; // 8 frames flash duration
            ctx.shadowBlur = 20 * flashIntensity;
            ctx.shadowColor = '#fff';
            ctx.globalAlpha = baseAlpha * (0.5 + (flashIntensity * 0.5));
        }

        if (this.type === 'chaser') {
            ctx.rotate(Math.atan2(player.y - this.y, player.x - this.x) - Math.PI / 2);
            ctx.drawImage(sprites.enemyChaser, -30, -30); // Size roughly (20+10)*2 = 60
        }
        else if (this.type === 'spinner') {
            ctx.rotate(frameCount * 0.1);
            ctx.drawImage(sprites.enemySpinner, -40, -40); // Size roughly (30+10)*2 = 80
        }
        else if (this.type === 'dasher') {
            ctx.rotate(Math.atan2(this.vy, this.vx) + Math.PI / 2);
            ctx.drawImage(sprites.enemyDasher, -30, -30);
        }
        else if (this.type === 'snake') {
            ctx.drawImage(sprites.enemySnake, -25, -25); // Head
            ctx.restore(); ctx.save();
            ctx.globalAlpha = baseAlpha;
            // Flash effect for segments too
            if (this.flashTimer > 0) {
                ctx.shadowBlur = 15 * (this.flashTimer / 8);
                ctx.shadowColor = '#fff';
            }
            this.segments.forEach((s, i) => {
                ctx.fillStyle = `rgba(255, 50, 50, ${1 - i / 10})`;
                ctx.beginPath(); ctx.arc(s.x, s.y, 10 - i, 0, Math.PI * 2); ctx.fill();
            });
        }
        else if (this.type === 'sniper') {
            ctx.drawImage(sprites.enemySniper, -30, -30);
            if (this.state === 'aim') {
                ctx.restore(); ctx.save(); ctx.globalAlpha = baseAlpha; ctx.strokeStyle = `rgba(255,0,0,${this.timer / 50})`; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(player.x, player.y); ctx.stroke();
            }
        }
        ctx.restore();
    }
}

class PowerUp {
    constructor() { this.active = false; }
    init(x, y, type = null, isKnockout = false) {
        this.x = x; this.y = y; this.active = true; this.radius = 16;
        this.isKnockout = isKnockout;
        if (isKnockout) { const a = Math.random() * 6.28; this.vx = Math.cos(a) * 6; this.vy = Math.sin(a) * 6; }
        else { this.vx = 0; this.vy = 2; }

        if (type) this.type = type;
        else {
            const r = Math.random();
            if (r > 0.97) this.type = 'bomb';
            else if (r > 0.90) this.type = 'shield';
            else if (r > 0.80) this.type = 'life';
            else this.type = 'weapon';
        }
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        if (this.isKnockout) { this.vx *= 0.95; this.vy *= 0.95; if (this.x < 0 || this.x > width) this.vx *= -1; if (this.y < 0 || this.y > height) this.vy *= -1; }
        if (this.y > height + 50) this.active = false;
    }
    draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y);
        const s = 1 + Math.sin(frameCount * 0.2) * 0.3; ctx.scale(s, s);

        let c = '#fff', t = '?';
        if (this.type === 'weapon') { c = '#0ff'; t = 'W'; }
        else if (this.type === 'bomb') { c = '#ff0'; t = 'B'; }
        else if (this.type === 'shield') { c = '#00f'; t = 'S'; }
        else if (this.type === 'life') { c = '#f00'; t = '♥'; }

        // Optimization: Removed shadowBlur
        // ctx.shadowBlur = 10; ctx.shadowColor = c; 

        if (this.type === 'bomb') {
            ctx.beginPath(); ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 0, ${0.3 + Math.sin(frameCount * 0.5) * 0.2})`; ctx.fill();
        }

        ctx.strokeStyle = c; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.stroke();

        // Add a simple glow using a translucent arc behind
        ctx.fillStyle = c;
        ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.arc(0, 0, this.radius + 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = c; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t, 0, 2);
        ctx.restore();
    }
}

class Particle {
    constructor() { this.active = false; }
    init(x, y, color, speed = 5, size = null) {
        this.x = x; this.y = y; const a = Math.random() * 6.28;
        this.vx = Math.cos(a) * speed; this.vy = Math.sin(a) * speed;
        this.life = 1; this.decay = rand(0.015, 0.04); // Slower decay for longer life
        this.color = color;
        this.size = size || rand(3, 8); // Variable size
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = rand(-0.2, 0.2);
        this.active = true;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.vx *= 0.98; // Slight drag
        this.vy *= 0.98;
        this.rotation += this.rotationSpeed;
        this.life -= this.decay;
        if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
        // Boost glow/alpha when player pushes upward
        const forwardBoost = Math.max(0, -(player?.vy || 0)) / PLAYER_MAX_SPEED_UP;
        const brightScale = 1.25 + forwardBoost * 1.35; // higher base glow
        // const blurScale = 1.1 + forwardBoost * 2.0; // Unused optimization
        const sizeScale = 1.15 + forwardBoost * 0.85;
        const streakScale = 1 + forwardBoost * 2.2;
        const alphaBoost = 0.2 + forwardBoost * 0.25;

        ctx.save();
        ctx.globalAlpha = Math.min(1, this.life * brightScale + alphaBoost);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Optimization: Removed shadowBlur
        // ctx.shadowBlur = 14 * this.life * blurScale;
        // ctx.shadowColor = this.color;

        ctx.fillStyle = this.color;
        // Draw as rotated rectangle for more interesting shape
        const half = (this.size * sizeScale) / 2;
        ctx.scale(1, streakScale);
        ctx.fillRect(-half, -half, half * 2, half * 2);

        // Simple fake glow
        ctx.globalAlpha = Math.min(1, (this.life * brightScale + alphaBoost) * 0.4);
        ctx.fillRect(-half * 2, -half * 2, half * 4, half * 4);

        ctx.restore();
        ctx.globalAlpha = 1;
    }
}

class FloatingText {
    constructor() { this.active = false; }
    init(x, y, text, color) { this.x = x; this.y = y; this.text = text; this.color = color; this.life = 1; this.active = true; }
    update() { this.y -= 1; this.life -= 0.02; if (this.life <= 0) this.active = false; }
    draw(ctx) { ctx.globalAlpha = this.life; ctx.fillStyle = this.color; ctx.font = "bold 24px monospace"; ctx.fillText(this.text, this.x, this.y); ctx.globalAlpha = 1; }
}

// --- Cosmic Background ---
class CosmicBackground {
    constructor() {
        this.stars = [];
        this.vortexes = [];
        this.planets = [];
        this.dust = [];
        this.starSpeedScale = 1; // scales with player forward push
        this.starThinScale = 1;  // narrows stars as you accelerate
        this.forwardRatio = 0;
        this.init();
    }

    init() {
        this.stars = [];
        this.vortexes = [];
        this.planets = [];
        // Stars
        for (let i = 0; i < 100; i++) {
            this.stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                z: Math.random() * width,
                size: Math.random() * 2
            });
        }
        // Vortexes
        for (let i = 0; i < 3; i++) {
            this.vortexes.push({
                x: Math.random() * width,
                y: Math.random() * height,
                angle: Math.random() * Math.PI * 2,
                speed: (Math.random() - 0.5) * 0.02,
                color: `hsla(${Math.random() * 360}, 70%, 50%, 0.1)`,
                size: 200 + Math.random() * 300
            });
        }
        // Planets
        for (let i = 0; i < 3; i++) {
            this.planets.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: 30 + Math.random() * 50,
                color: `hsla(${Math.random() * 360}, 60%, 40%, 0.8)`,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5
            });
        }
    }

    update() {
        // Tie backdrop speed/shape to velocity so accelerating feels faster
        const forwardSpeed = Math.max(0, -(player?.vy || 0));
        const backwardSpeed = Math.max(0, player?.vy || 0);
        this.forwardRatio = Math.min(1, forwardSpeed / PLAYER_MAX_SPEED_UP);
        const backwardRatio = Math.min(1, backwardSpeed / PLAYER_MAX_SPEED_DOWN);
        // Slower idle drift; ramps harder with thrust; braking/downward makes it calmer
        const baseScale = 0.35 + this.forwardRatio * 1.65;
        this.starSpeedScale = Math.max(0.12, baseScale * (1 - backwardRatio * 0.65));
        this.starThinScale = Math.max(0.35, 1 / (1 + this.forwardRatio * 1.1));

        const speed = 8 * this.starSpeedScale; // Base flight speed, boosted by player thrust

        // Stars - Move downward to simulate flying upward
        this.stars.forEach(s => {
            // Move stars downward based on their depth (z)
            // Stars closer (smaller z) move faster for parallax effect
            const depthSpeed = speed * (1 + (width - s.z) / width * 2);
            s.y += depthSpeed;

            // Reset star to top when it goes off bottom
            if (s.y > height + 50) {
                s.y = -50;
                s.x = Math.random() * width;
                s.z = Math.random() * width;
            }
        });

        // Vortexes
        this.vortexes.forEach(v => {
            v.angle += v.speed;
            // Parallax
            v.x -= (player.x - width / 2) * 0.002;
            v.y -= (player.y - height / 2) * 0.002;
        });

        // Planets
        this.planets.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < -100) p.x = width + 100;
            if (p.x > width + 100) p.x = -100;
            if (p.y < -100) p.y = height + 100;
            if (p.y > height + 100) p.y = -100;
        });
    }

    draw(ctx) {
        // Deep space bg
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#050010');
        grad.addColorStop(1, '#100020');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Vortexes / Nebula
        ctx.globalCompositeOperation = 'screen';
        this.vortexes.forEach(v => {
            const g = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, v.size);
            g.addColorStop(0, v.color);
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.fillRect(v.x - v.size, v.y - v.size, v.size * 2, v.size * 2);

            // Spiral lines
            ctx.save();
            ctx.translate(v.x, v.y);
            ctx.rotate(v.angle);
            ctx.strokeStyle = v.color.replace('0.1)', '0.2)');
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                ctx.rotate(Math.PI / 3);
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(v.size / 2, v.size / 2, v.size, 0);
            }
            ctx.stroke();
            ctx.restore();
        });

        // Stars - Motion blur ovals
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#fff';
        this.stars.forEach(s => {
            // Size based on depth - closer stars (smaller z) are larger
            const depthFactor = (width - s.z) / width;
            const baseWidth = s.size * (0.3 + depthFactor * 0.5); // Base thickness
            const finalWidth = baseWidth * this.starThinScale;

            // Height stretches based on Y position - fatter at bottom, skinnier at top
            const screenProgress = s.y / height; // 0 at top, 1 at bottom
            const stretchFactor = 0.5 + screenProgress * 3; // More stretch toward bottom
            const height_oval = baseWidth * stretchFactor * 4 * (1 + this.forwardRatio * 0.3);

            if (s.x > 0 && s.x < width && s.y > 0 && s.y < height) {
                // Very faded - max opacity of 0.25
                ctx.globalAlpha = (0.1 + depthFactor * 0.15);

                // Optimization: Replaced expensive gradient with simple rect/line
                // Draw motion-blurred oval with gradient for trail effect
                /*
                const gradient = ctx.createLinearGradient(s.x, s.y - height_oval / 2, s.x, s.y + height_oval / 2);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0)'); // Fade at top
                gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.3)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0.8)'); // Brighter at bottom

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.ellipse(s.x, s.y, finalWidth, height_oval, 0, 0, Math.PI * 2);
                ctx.fill();
                */

                // Simple trail
                ctx.fillStyle = '#fff';
                ctx.fillRect(s.x - finalWidth / 2, s.y - height_oval / 2, finalWidth, height_oval);
            }
        });
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';

        // Planets
        ctx.globalCompositeOperation = 'source-over';
        this.planets.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 20; ctx.shadowColor = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            // Shadow/Crater detail
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.arc(p.x - p.r * 0.3, p.y + p.r * 0.3, p.r * 0.8, 0, Math.PI * 2); ctx.fill();
        });
    }
}

// --- Pools ---
const bulletPool = new Pool(() => new Bullet(), 500);
const enemyPool = new Pool(() => new Enemy(), 50);
const particlePool = new Pool(() => new Particle(), 200);
const powerupPool = new Pool(() => new PowerUp(), 20);
const textPool = new Pool(() => new FloatingText(), 20);

const cosmicBg = new CosmicBackground();

// --- Game Logic ---

function spawnEnemyLogic() {
    const chance = Math.random();
    let type = 'chaser';

    // In DEMO, always allow all types for variety
    const effectiveScore = gameState === 'DEMO' ? 5000 : score;

    // Performance Cap for Demo
    if (gameState === 'DEMO' && enemies.length > 30) return;

    if (effectiveScore > 500 && chance > 0.6) type = 'spinner';
    if (effectiveScore > 1000 && chance > 0.8) type = 'dasher';
    if (effectiveScore > 2000 && chance > 0.85) type = 'snake';
    if (effectiveScore > 3000 && chance > 0.9) type = 'sniper';
    spawnEnemyEntity(type);
}

function createExplosionLogic(x, y, color, count) {
    for (let i = 0; i < count; i++) spawnParticle(x, y, color);
}

function triggerBombLogic() {
    playSound('bomb');
    flashOverlay.style.opacity = 1;
    setTimeout(() => flashOverlay.style.opacity = 0, 500);

    enemies.forEach(e => {
        e.active = false;
        // Enhanced bomb explosion particles
        createExplosionLogic(e.x, e.y, '#ff0', 20);
        createExplosionLogic(e.x, e.y, '#fff', 8);
        createExplosionLogic(e.x, e.y, '#f80', 12);
    });
    bullets.forEach(b => {
        if (b.type === 'enemy') {
            b.active = false;
            createExplosionLogic(b.x, b.y, '#ff0', 2);
        }
    });

    score += 2000;
    updateUI();
    spawnText(width / 2, height / 2, "OMEGA BLAST", "#ff0");
}

function spawnBullet(...args) { bullets.push(bulletPool.get(...args)); }
function spawnEnemyEntity(type) { enemies.push(enemyPool.get(type)); }
function spawnParticle(...args) { particles.push(particlePool.get(...args)); }
function spawnPowerup(...args) { powerups.push(powerupPool.get(...args)); }
function spawnText(...args) { texts.push(textPool.get(...args)); }

function firePlayerWeapons() {
    if (gameState === 'PLAYING') playSound('shoot');

    spawnBullet(player.x, player.y - 20, -Math.PI / 2, 18, 'player', 'beam');

    if (player.powerLevel >= 2) {
        spawnBullet(player.x - 15, player.y, -1.7, 15, 'player', 'normal');
        spawnBullet(player.x + 15, player.y, -1.4, 15, 'player', 'normal');
    }
    if (player.powerLevel >= 3 && frameCount % 14 === 0) {
        spawnBullet(player.x, player.y - 20, -1.6, 10, 'player', 'blade');
        spawnBullet(player.x, player.y - 20, -1.5, 10, 'player', 'blade');
    }
    if (player.powerLevel >= 4 && frameCount % 21 === 0) {
        spawnBullet(player.x - 20, player.y, Math.PI, 12, 'player', 'homing');
        spawnBullet(player.x + 20, player.y, 0, 12, 'player', 'homing');
    }
    if (player.powerLevel >= 5 && frameCount % 21 === 0) {
        spawnBullet(player.x, player.y - 10, -Math.PI / 2, 12, 'player', 'wave');
    }
    if (player.powerLevel >= 6) {
        spawnBullet(player.x - 10, player.y - 20, -Math.PI / 2, 18, 'player', 'beam');
        spawnBullet(player.x + 10, player.y - 20, -Math.PI / 2, 18, 'player', 'beam');
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
    for (let i = 0; i < segs.length; i++) {
        segs[i].className = i < player.powerLevel - 1 ? 'segment active' : 'segment';
        if (player.powerLevel === player.maxPower && i < player.maxPower - 1) segs[i].className = 'segment max';
    }
}

function hitPlayer() {
    if (gameState === 'DEMO') return; // Invincible in demo

    if (player.hasShield) {
        player.hasShield = false;
        playSound('shieldBreak');
        createExplosionLogic(player.x, player.y, '#00f', 20);
        player.iframes = 60;
        spawnText(player.x, player.y - 50, "SHIELD DOWN", "#00f");
        return;
    }

    player.lives--;
    player.iframes = 120;
    playSound('hit');
    flashOverlay.style.opacity = 0.5; setTimeout(() => flashOverlay.style.opacity = 0, 100);
    createExplosionLogic(player.x, player.y, '#f00', 25);

    if (player.powerLevel > 1) {
        player.powerLevel--;
        spawnPowerup(player.x, player.y, 'weapon', true);
        spawnText(player.x, player.y - 50, "SYSTEM DMG", "#f00");
    }
    updateUI();
    if (player.lives <= 0) {
        gameState = 'GAMEOVER';
        uiLayer.classList.add('hidden');
        pauseMenu.classList.add('hidden');
        pauseBtn.classList.remove('active');
        gameOverMenu.classList.remove('hidden');
        finalScoreDisplay.innerText = score;
    }
}

function resetWorldState() {
    bullets.forEach(b => bulletPool.release(b)); bullets.length = 0;
    enemies.forEach(e => enemyPool.release(e)); enemies.length = 0;
    particles.forEach(p => particlePool.release(p)); particles.length = 0;
    powerups.forEach(p => powerupPool.release(p)); powerups.length = 0;
    texts.forEach(t => textPool.release(t)); texts.length = 0;
    player.tail.length = 0;
}

function pauseGame() {
    if (gameState !== 'PLAYING') return;
    gameState = 'PAUSED';
    uiLayer.classList.add('hidden');
    pauseMenu.classList.remove('hidden');
    pauseBtn.classList.add('active');
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

    score = 0; player.lives = PLAYER_MAX_LIVES; player.powerLevel = 1; player.iframes = 0; player.hasShield = false;
    setPlayerStartPosition(); player.vx = 0; player.vy = 0; player.tilt = 0;

    resetWorldState();
    updateUI();
}

function initGame() {
    score = 0; player.lives = PLAYER_MAX_LIVES; player.powerLevel = 1; player.iframes = 0; player.hasShield = false;
    setPlayerStartPosition(); player.vx = 0; player.vy = 0; player.tilt = 0;

    resetWorldState();

    updateUI();
    gameState = 'PLAYING';
    uiLayer.classList.remove('hidden');
    startMenu.classList.add('hidden');
    gameOverMenu.classList.add('hidden');
    pauseMenu.classList.add('hidden');
    pauseBtn.classList.remove('active');

    lastTime = performance.now();
    accumulator = 0;
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

    // Always max power in demo
    player.powerLevel = 6;
}

function clampPlayerToPlayfield({ dampenVelocity = false } = {}) {
    const leftBound = PLAYFIELD_SIDE_PADDING;
    const rightBound = width - PLAYFIELD_SIDE_PADDING;
    const topBound = hudTopHeight + PLAYFIELD_TOP_BUFFER;
    const bottomBound = height - PLAYFIELD_BOTTOM_PADDING;

    if (player.x < leftBound) { player.x = leftBound; if (dampenVelocity && player.vx < 0) player.vx = 0; }
    if (player.x > rightBound) { player.x = rightBound; if (dampenVelocity && player.vx > 0) player.vx = 0; }
    if (player.y < topBound) { player.y = topBound; if (dampenVelocity && player.vy < 0) player.vy = 0; }
    if (player.y > bottomBound) { player.y = bottomBound; if (dampenVelocity && player.vy > 0) player.vy = 0; }
}

function update(dt) {
    if (gameState !== 'PLAYING' && gameState !== 'DEMO') {
        globalHue += 1;
        return;
    }

    if (gameState === 'DEMO') {
        updateDemoAI();
    }

    cosmicBg.update();

    globalHue += 2;
    frameCount++;

    // Spawn logic: More intense in DEMO
    let spawnRate = Math.max(20, 60 - Math.floor(score / 300));
    if (gameState === 'DEMO') spawnRate = 15; // Very fast spawn in demo

    if (frameCount % spawnRate === 0) spawnEnemyLogic();

    // Engine trails
    if (frameCount % 2 === 0) player.tail.push({ x: player.x, y: player.y + 15, life: 1 });
    player.tail.forEach(t => t.life -= 0.1);
    player.tail = player.tail.filter(t => t.life > 0);

    // --- PLAYER MOVEMENT (KEYBOARD + TOUCH/MOUSE) ---
    if (gameState === 'PLAYING') {
        let accelX = 0;
        let accelY = 0;

        // Keyboard-driven acceleration
        if (keys.up || keys.w) accelY -= PLAYER_ACCEL;
        if (keys.down || keys.s) accelY += PLAYER_ACCEL;
        if (keys.left || keys.a) accelX -= PLAYER_ACCEL;
        if (keys.right || keys.d) accelX += PLAYER_ACCEL;

        // Pointer-driven acceleration toward last touch/mouse position
        if (input.active) {
            const dx = input.lastX - player.x;
            const dy = input.lastY - player.y;
            const distance = Math.hypot(dx, dy);
            if (distance > 2) {
                const steer = Math.min(PLAYER_ACCEL, distance * 0.02);
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
            ? PLAYER_MAX_SPEED_UP
            : (player.vy > 0 ? PLAYER_MAX_SPEED_DOWN : PLAYER_MAX_SPEED);
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
                    if (b.subType !== 'blade' && b.subType !== 'wave') b.active = false;
                    e.hp -= (b.subType === 'blade' || b.subType === 'wave' ? 0.5 : 1);

                    // Flash effect on damage
                    e.flashTimer = 8;

                    createExplosionLogic(b.x, b.y, '#fff', 1);
                    if (e.hp <= 0 && e.active) {
                        e.active = false;
                        if (gameState === 'PLAYING') {
                            score += 100;
                            updateUI();
                        }
                        // Enhanced death explosion with more particles and variety
                        createExplosionLogic(e.x, e.y, `hsl(${globalHue},100%,50%)`, 25);
                        createExplosionLogic(e.x, e.y, '#fff', 10);
                        createExplosionLogic(e.x, e.y, `hsl(${globalHue + 60},100%,60%)`, 15);
                        if (Math.random() < 0.08) spawnPowerup(e.x, e.y);
                    }
                }
            });
        } else {
            if (player.iframes <= 0 && dist(b.x, b.y, player.x, player.y) < player.radius + 5) {
                b.active = false; hitPlayer();
            }
        }
    });
    enemies.forEach(e => {
        let hit = dist(e.x, e.y, player.x, player.y) < e.radius + player.radius;
        if (e.type === 'snake') e.segments.forEach(s => { if (dist(s.x, s.y, player.x, player.y) < e.radius + player.radius) hit = true; });
        if (player.iframes <= 0 && hit) hitPlayer();
    });
    powerups.forEach(p => {
        if (dist(p.x, p.y, player.x, player.y) < p.radius + 20) {
            p.active = false; playSound('powerup');
            if (p.type === 'weapon') {
                if (player.powerLevel < player.maxPower) { player.powerLevel++; spawnText(player.x, player.y - 40, "UPGRADE", "#0ff"); }
                else { if (gameState === 'PLAYING') score += 1000; spawnText(player.x, player.y - 40, "+1000", "#fff"); }
            } else if (p.type === 'bomb') { triggerBombLogic(); }
            else if (p.type === 'shield') { player.hasShield = true; spawnText(player.x, player.y - 40, "SHIELD UP", "#00f"); }
            else if (p.type === 'life') {
                const prevLives = player.lives;
                player.lives = Math.min(PLAYER_MAX_LIVES, player.lives + 1);
                if (player.lives > prevLives) spawnText(player.x, player.y - 40, "EXTEND", "#f00");
            }
            if (gameState === 'PLAYING') updateUI();
        }
    });
}

function draw() {
    // Background
    cosmicBg.draw(ctx);

    let sx = 0, sy = 0; if (player.iframes > 0 && player.iframes % 4 === 0) { sx = rand(-5, 5); sy = rand(-5, 5); }
    ctx.save(); ctx.translate(sx, sy);

    // Grid - Optimized
    ctx.strokeStyle = `hsla(${globalHue}, 80%, 40%, 0.15)`; ctx.lineWidth = 1;
    const gs = 80; // Larger grid size

    ctx.beginPath();
    // Simplified grid drawing
    for (let x = 0; x <= width; x += gs) {
        ctx.moveTo(x, 0); ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += gs) {
        ctx.moveTo(0, y); ctx.lineTo(width, y);
    }
    ctx.stroke();

    powerups.forEach(e => e.draw(ctx));
    particles.forEach(e => e.draw(ctx));
    bullets.forEach(e => e.draw(ctx));
    enemies.forEach(e => e.draw(ctx));
    texts.forEach(e => e.draw(ctx));

    // PLAYER DRAW
    if ((gameState === 'PLAYING' || gameState === 'DEMO' || gameState === 'PAUSED') && (player.iframes === 0 || Math.floor(frameCount / 4) % 2 === 0)) {
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
        ctx.shadowBlur = 15; ctx.shadowColor = '#0ff';

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

        ctx.shadowBlur = 20; ctx.fillStyle = '#0ff';
        ctx.fillRect(-5, 20, 3, 5); ctx.fillRect(2, 20, 3, 5);
        ctx.restore();

        ctx.restore();
    }
    ctx.restore();

    // Glitch Overlay - Removed for mobile performance

    if (frameCount % 4 === 0) { // Reduced frequency
        ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = `hsla(${globalHue + 180},100%,50%,0.05)`;
        ctx.fillRect(0, 0, width, height); ctx.globalCompositeOperation = 'source-over';
    }

    // DEMO OVERLAY
    if (gameState === 'DEMO') {
        // Lighter overlay so it's easier to see
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, width, height);
    }
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

// Start loop
requestAnimationFrame(loop);
