/**
 * LEVEL CONFIGURATION & MANAGEMENT
 */

const LEVEL_CONFIG = {
    1: {
        name: "NEON GENESIS",
        hue: 240, // Blue
        enemyTypes: ['chaser'],
        spawnRateMod: 1.0,
        enemyHealthMod: 1.0,
        enemySpeedMod: 1.0,
        duration: 1800 // 30 seconds
    },
    2: {
        name: "VIOLET VORTEX",
        hue: 280, // Purple
        enemyTypes: ['chaser', 'spinner'],
        spawnRateMod: 0.9,
        enemyHealthMod: 1.2,
        enemySpeedMod: 1.05,
        duration: 2400 // 40 seconds
    },
    3: {
        name: "CRIMSON TIDE",
        hue: 0, // Red
        enemyTypes: ['chaser', 'spinner', 'dasher'],
        spawnRateMod: 0.8,
        enemyHealthMod: 1.4,
        enemySpeedMod: 1.1,
        duration: 2400
    },
    4: {
        name: "SOLAR FLARE",
        hue: 40, // Orange
        enemyTypes: ['chaser', 'spinner', 'dasher', 'snake'],
        spawnRateMod: 0.75,
        enemyHealthMod: 1.6,
        enemySpeedMod: 1.15,
        duration: 3000 // 50 seconds
    },
    5: {
        name: "EMERALD EXPANSE",
        hue: 140, // Green
        enemyTypes: ['chaser', 'spinner', 'dasher', 'snake', 'sniper'],
        spawnRateMod: 0.7,
        enemyHealthMod: 1.8,
        enemySpeedMod: 1.2,
        duration: 3000
    },
    6: {
        name: "CYAN CYCLONE",
        hue: 180, // Cyan
        enemyTypes: ['chaser', 'spinner', 'dasher', 'snake', 'sniper'],
        spawnRateMod: 0.65,
        enemyHealthMod: 2.0,
        enemySpeedMod: 1.25,
        duration: 3600 // 60 seconds
    },
    7: {
        name: "MAGENTA MADNESS",
        hue: 300, // Magenta
        enemyTypes: ['chaser', 'spinner', 'dasher', 'snake', 'sniper'],
        spawnRateMod: 0.6,
        enemyHealthMod: 2.5,
        enemySpeedMod: 1.3,
        duration: 3600
    },
    8: {
        name: "VOID WALKER",
        hue: 200, // Dark Blue/Grey
        enemyTypes: ['chaser', 'spinner', 'dasher', 'snake', 'sniper'],
        spawnRateMod: 0.55,
        enemyHealthMod: 3.0,
        enemySpeedMod: 1.4,
        duration: 4200 // 70 seconds
    },
    9: {
        name: "OMEGA OVERDRIVE",
        hue: 0, // Cycling/Chaos (handled in logic)
        enemyTypes: ['chaser', 'spinner', 'dasher', 'snake', 'sniper'],
        spawnRateMod: 0.5,
        enemyHealthMod: 4.0, // Scales infinitely
        enemySpeedMod: 1.5,
        duration: Infinity
    }
};

class LevelManager {
    constructor() {
        this.currentLevel = 1;
        this.levelTimer = 0;
        this.infiniteScalingFactor = 1.0;
    }

    reset() {
        this.currentLevel = 1;
        this.levelTimer = 0;
        this.infiniteScalingFactor = 1.0;
        this.applyLevelConfig();
    }

    update() {
        if (gameState !== 'PLAYING') return;

        this.levelTimer++;
        const config = LEVEL_CONFIG[this.currentLevel];

        if (this.currentLevel < 9 && this.levelTimer >= config.duration) {
            this.advanceLevel();
        } else if (this.currentLevel === 9) {
            // Infinite scaling logic
            if (this.levelTimer % 600 === 0) { // Every 10 seconds
                this.infiniteScalingFactor += 0.1;
                spawnText(width / 2, height / 2 - 100, "DANGER RISING", "#f00");
            }
        }
    }

    advanceLevel() {
        this.currentLevel++;
        this.levelTimer = 0;
        this.applyLevelConfig();

        // Visual fanfare
        const config = LEVEL_CONFIG[this.currentLevel];
        spawnText(width / 2, height / 2, `LEVEL ${this.currentLevel}`, `hsl(${config.hue}, 100%, 50%)`);
        spawnText(width / 2, height / 2 + 40, config.name, "#fff");

        // Flash screen
        flashOverlay.style.backgroundColor = `hsla(${config.hue}, 100%, 50%, 0.3)`;
        flashOverlay.style.opacity = 1;
        setTimeout(() => {
            flashOverlay.style.opacity = 0;
            setTimeout(() => flashOverlay.style.backgroundColor = 'white', 500);
        }, 500);
    }

    applyLevelConfig() {
        const config = LEVEL_CONFIG[this.currentLevel];
        // Smoothly transition global hue
        // We'll let the game loop handle the gradual shift, but we set the target
        // For now, hard set it or let cosmic background handle it.
        // Let's update cosmic background directly if possible, or just set globalHue
        globalHue = config.hue;
    }

    getCurrentStats() {
        const config = LEVEL_CONFIG[this.currentLevel];
        let hpMod = config.enemyHealthMod;
        let speedMod = config.enemySpeedMod;
        let spawnMod = config.spawnRateMod;

        if (this.currentLevel === 9) {
            hpMod *= this.infiniteScalingFactor;
            speedMod *= (1 + (this.infiniteScalingFactor - 1) * 0.2); // Scale speed slower than HP
            spawnMod /= (1 + (this.infiniteScalingFactor - 1) * 0.5); // Spawn faster
        }

        return {
            hpMod,
            speedMod,
            spawnMod,
            types: config.enemyTypes
        };
    }
}

const levelManager = new LevelManager();
