/**
 * LEVEL CONFIGURATION & MANAGEMENT
 */

const LEVEL_CONFIG = {
    1: {
        name: "NEON GENESIS",
        hue: 220, // Deep Blue
        enemyTypes: ['chaser'],
        spawnRateMod: 1.0,
        enemyHealthMod: 1.0,
        enemySpeedMod: 1.0,
        duration: 1800
    },
    2: {
        name: "VIOLET VORTEX",
        hue: 270, // Purple
        enemyTypes: ['chaser', 'spinner'],
        spawnRateMod: 0.9,
        enemyHealthMod: 1.4,
        enemySpeedMod: 1.05,
        duration: 2400
    },
    3: {
        name: "CRIMSON TIDE",
        hue: 350, // Red
        enemyTypes: ['chaser', 'spinner', 'dasher'],
        spawnRateMod: 0.8,
        enemyHealthMod: 2.0,
        enemySpeedMod: 1.1,
        duration: 2400
    },
    4: {
        name: "SOLAR FLARE",
        hue: 30, // Orange/Gold
        enemyTypes: ['chaser', 'spinner', 'dasher', 'snake'],
        spawnRateMod: 0.75,
        enemyHealthMod: 2.8,
        enemySpeedMod: 1.15,
        duration: 3000
    },
    5: {
        name: "TOXIC WASTE",
        hue: 120, // Toxic Green
        enemyTypes: ['chaser', 'spinner', 'dasher', 'snake', 'sniper'],
        spawnRateMod: 0.7,
        enemyHealthMod: 4.0,
        enemySpeedMod: 1.2,
        duration: 3000
    },
    6: {
        name: "CYAN CYCLONE",
        hue: 180, // Cyan
        enemyTypes: ['chaser', 'spinner', 'dasher', 'snake', 'sniper'],
        spawnRateMod: 0.65,
        enemyHealthMod: 6.0,
        enemySpeedMod: 1.25,
        duration: 3600
    },
    7: {
        name: "MAGENTA MADNESS",
        hue: 300, // Magenta
        enemyTypes: ['chaser', 'spinner', 'dasher', 'snake', 'sniper'],
        spawnRateMod: 0.6,
        enemyHealthMod: 10.0,
        enemySpeedMod: 1.3,
        duration: 3600
    },
    8: {
        name: "VOID WALKER",
        hue: 250, // Indigo/Dark
        enemyTypes: ['chaser', 'spinner', 'dasher', 'snake', 'sniper'],
        spawnRateMod: 0.55,
        enemyHealthMod: 15.0,
        enemySpeedMod: 1.4,
        duration: 4200
    },
    9: {
        name: "OMEGA OVERDRIVE",
        hue: 0, // Chaos
        enemyTypes: ['chaser', 'spinner', 'dasher', 'snake', 'sniper'],
        spawnRateMod: 0.5,
        enemyHealthMod: 25,
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
        globalHue = config.hue;

        // Update Background Theme
        if (window.cosmicBg) {
            cosmicBg.setTheme(config.hue);
        }

        // Update UI
        const stageDisplay = document.getElementById('stage-display');
        if (stageDisplay) {
            stageDisplay.innerText = this.currentLevel;
            stageDisplay.style.color = `hsl(${config.hue}, 100%, 70%)`;
            stageDisplay.style.textShadow = `0 0 10px hsl(${config.hue}, 100%, 50%)`;
        }

        // Update Vignette to match theme
        const vignette = document.querySelector('.vignette');
        if (vignette) {
            // Radial gradient from transparent center to dark colored edges
            vignette.style.background = `radial-gradient(circle, transparent 40%, hsla(${config.hue}, 80%, 10%, 0.9) 120%)`;
        }

        // Show Stage Toast
        if (typeof showStageToast === 'function') {
            showStageToast(config.name, config.hue, this.currentLevel);
        }
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
