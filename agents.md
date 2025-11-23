# Agents Guide for Neon Overdrive

This game has been refactored from a single-file structure into a modular codebase with multiple JavaScript modules, while still exposing its state through globals. Use this guide to understand the architecture, plug in an automated agent, read signals, and drive the player safely.

## Architecture Overview
The game is now split across multiple modules loaded in `index.html`:
- `globals.js` - Constants, DOM elements, game state variables, player object, entity arrays
- `levels.js` - Level progression system with 9 stages, each with unique themes and difficulty scaling
- `utils.js` - Helper functions (distance, random, etc.)
- `audio.js` - Sound effects and background music system (`MusicPlayer` object)
- `assets.js` - Sprite definitions for player weapons, enemies, and visual effects
- `pool.js` - Generic object pooling class
- `bullet.js`, `enemy.js`, `particle.js`, `powerup.js`, `floatingText.js` - Entity classes
- `cosmicBackground.js` - Dynamic background renderer with theme support
- `pools.js` - Pool instances for each entity type
- `ui.js` - HUD updates, menus, toasts, keyboard navigation, level-up system
- `spawners.js` - Enemy spawning logic
- `player.js` - Player movement, weapons, upgrades, collision handlers
- `game.js` - Main game loop, state management, update/draw cycles

## Quick Map of Core Globals
### State Management
- `gameState`: `'MENU'`, `'PLAYING'`, `'PAUSED'`, `'GAMEOVER'`, `'DEMO'`, `'LEVEL_UP'`
- `score`: Current score
- `frameCount`: Game tick counter
- `globalHue`: Current color theme (changes per level)
- `GAME_SCALE`: Dynamic canvas scale for responsive layout

### Player Object
```javascript
player = {
    x, y, radius: 6, w: 24, h: 32,
    lives, iframes, hasShield,
    powerLevel, maxPower: 10,
    weaponXp, weaponXpMax,           // Weapon progression
    level, xp, xpMax,                 // Character progression
    stats: {                          // Upgradeable stats
        damageMult, hpMax, fireRateMult, 
        moveSpeedMult, weaponXpMult, playerXpMult
    },
    vx, vy, tilt, tiltDir, tail,
    godMode                           // Debug flag
}
```

### Entity Arrays & Pools
- `bullets`, `enemies`, `particles`, `powerups`, `texts` - Active entity lists
- `bulletPool`, `enemyPool`, `particlePool`, `powerupPool`, `textPool` - Object pools for recycling

### Key Systems
- `levelManager`: Controls stage progression (9 levels with infinite scaling on level 9)
- `MusicPlayer`: Background music with shuffle and track management
- `cosmicBg`: Dynamic background that adapts to level themes
- Input: `keys` object and `input` object for keyboard/touch/mouse

## Game Systems

### Level Progression
The game features 9 distinct stages, each with:
- Unique name and color theme (updates `globalHue`)
- Progressive difficulty (enemy health, speed, spawn rate modifiers)
- New enemy types unlocked at each stage
- Level 9 ("OMEGA OVERDRIVE") has infinite scaling difficulty
- Stage transitions trigger visual effects, toasts, and theme changes

Access via `levelManager`:
- `levelManager.currentLevel` - Current stage (1-9)
- `levelManager.getCurrentStats()` - Returns `{ hpMod, speedMod, spawnMod, types }`

### Character Progression
Players earn XP from killing enemies and can level up to gain stat upgrades:
- **Weapon XP**: Fills weapon power bar, grants weapon upgrades (levels 1-10)
- **Player XP**: Fills character XP bar, triggers level-up menu with stat choices
- **Stat Options**: HP+, Damage+, Fire Rate+, Move Speed+, Weapon XP Gain+, Player XP Gain+

Level-up menu (`LEVEL_UP` game state) pauses the game and presents 3 random upgrade options.

### HP System
- Player HP uses a tiered color system (10 HP per tier, up to 100 max)
- Colors: Red (1-10), Cyan (11-20), Yellow (21-30), Magenta (31-40), etc.
- HUD displays heart icons with visual tiers
- Low health triggers vignette warning effects

### Weapon System
- 10 power levels with distinct firing patterns
- Weapon types: beam, normal shot, triple shot, blade wave, crescent wave, side cannons, rear cannon, missiles
- Each level has damage, speed, and visual (hue, glow) multipliers in `WEAPON_LEVEL_CURVE`
- Level 10 fires continuous thick beam bursts
- Missiles (level 9) have AOE explosion damage

### Audio System
- **Sound Effects**: `playSound(type)` - types: 'shoot', 'bomb', 'hit', 'powerup', 'shieldBreak'
- **Music Player**: Shuffled playlist with 20+ tracks, no repeats until all played
- **Controls**: `MusicPlayer.toggleMute()`, `toggleSfxMute()` for independent mute
- **UI Toggles**: Pause menu has music/SFX toggle buttons
- **Song Toasts**: Display current track name in bottom-right corner

### UI Enhancements
- **Stage Toasts**: Show stage name/number in bottom-left on level transitions
- **Song Toasts**: Show "NOW PLAYING" with track name and animated sound bars
- **Keyboard Navigation**: WASD/Arrow keys + Space/Enter for all menus
- **Debug Menu**: In pause menu, toggle god mode, add HP, force level-ups, set HP to 1
- **HUD**: Score, stage number, lives (hearts), weapon power bar with XP track, player level display
- **Mobile Optimization**: Dynamic scaling, simplified visuals, touch controls

## How the Game Updates
- **Fixed timestep loop** at ~60 FPS with `update(TIME_STEP)` handling game logic
- **Accumulator pattern** ensures consistent physics/gameplay regardless of frame rate
- **Render loop** uses Canvas 2D with `GAME_SCALE` applied; state changes happen in `update()`, not `draw()`
- **Demo mode**: `updateDemoAI()` runs when `gameState === 'DEMO'`
- **Level manager**: Updates level timer, handles stage transitions and infinite scaling

## Driving an Agent

### Input Methods
1. **Keyboard**: Set `keys.up/down/left/right` or `keys.w/a/s/d` booleans
2. **Pointer**: Set `input.active = true` and update `input.lastX/lastY` with target coordinates
3. **Direct position**: In `DEMO` mode, directly modify `player.x` and `player.y` in `updateDemoAI()`

### Control Injection
- **Controlled run**: Call `initGame()`, then set `gameState = 'PLAYING'` and drive `keys` or `input` each frame
- **Sandbox/autoplay**: Redefine `updateDemoAI()` with your agent logic, set `gameState = 'DEMO'`
- **Movement bounds**: Player is clamped via `clampPlayerToPlayfield()` with padding (20-36px from edges)
- **Shooting**: Auto-fires every 7 frames in `PLAYING` mode; call `firePlayerWeapons()` manually if needed

### Demo AI Behavior
The built-in `updateDemoAI()` in `game.js` demonstrates:
- **Threat avoidance**: Steers away from nearby enemy bullets and enemies
- **Powerup attraction**: Moves toward close powerups
- **Safe positioning**: Biases toward bottom 85% of screen
- **Smooth movement**: Blends forces with weighted steering
- **Auto-fire**: Shoots every 7 frames
- **Max power**: Forces `powerLevel = maxPower` for demo showcase

Replace or wrap this function to test custom AI policies.

## Signals to Observe

### Threats
- **Enemy bullets**: `bullets.filter(b => b.type === 'enemy' && b.active)`
- **Enemies**: `enemies.filter(e => e.active)` - check `e.type`, `e.x`, `e.y`, `e.radius`
- **Snake segments**: Snake enemies have `e.segments` array with positions
- **Distance helper**: `dist(player.x, player.y, target.x, target.y)`

### Opportunities
- **Powerups**: `powerups.filter(p => p.active)` with types:
  - `'weapon'`: Weapon level up (or score if maxed)
  - `'bomb'`: Screen clear
  - `'shield'`: One-hit protection
  - `'life'`: +1 HP (capped at `player.stats.hpMax`)
  - `'score'`: +1000 score and weapon XP bonus
- **Pickup radius**: Collect when `dist(player, powerup) < powerup.radius + 20`

### Survival
- `player.iframes`: Invulnerability frames remaining (flicker effect)
- `player.hasShield`: One-hit shield active
- `player.godMode`: Debug invincibility flag
- `player.lives`: Current HP (dies when ≤ 0)
- `player.stats.hpMax`: Maximum HP

### Difficulty Indicators
- `levelManager.currentLevel`: Stage 1-9
- `levelManager.infiniteScalingFactor`: Difficulty multiplier in stage 9
- Spawn rate: `Math.max(15, 60 * stats.spawnMod)` frames between spawns
- Enemy stats scale with `levelManager.getCurrentStats()`

## Common Extension Hooks

### Game Control
- **Start game**: `initGame()` - Resets state, starts music, sets `gameState = 'PLAYING'`
- **Pause/Resume**: `pauseGame()`, `resumeGame()`
- **Return to menu**: `returnToMenu()` - Stops music, resets world
- **Trigger bomb**: `triggerBombLogic()` - Clears screen, awards XP

### Player Manipulation
- **Award XP**: `awardWeaponXp(amount)`, `awardPlayerXp(amount)`
- **Force level-up**: `triggerLevelUp()` - Opens level-up menu
- **Select upgrade**: `selectUpgrade(type)` - types: 'hp', 'damage', 'fireRate', 'moveSpeed', 'weaponXp', 'playerXp'
- **Hit player**: `hitPlayer()` - Handles damage, shield, lives, game over
- **Give powerup**: Spawn via `spawnPowerup(x, y)` (random type) or modify `type` directly

### Visual Effects
- **Explosion**: `createExplosionLogic(x, y, color, count)` - Particle burst
- **Floating text**: `spawnText(x, y, text, color)` - Score popups, messages
- **Screen shake**: Built into `draw()` when `player.iframes > 0`
- **Flash overlay**: `flashOverlay.style.opacity = 1` for screen flash effects

### UI Updates
- **Refresh HUD**: `updateUI()` - Syncs score, lives, power, XP displays
- **Show toasts**: `showSongToast(name)`, `showStageToast(name, hue, stageNum)`
- **Menu navigation**: `updateMenuSelection()` - Highlights current menu option

## Debug Tools
Access via pause menu debug panel:
- **God Mode**: `player.godMode = true` - Invincibility
- **Add Max HP**: `selectUpgrade('hp')` - +1 max HP, refill to max
- **Player Level Up**: `triggerLevelUp()` - Force level-up menu
- **Weapon Level Up**: `player.powerLevel++` (max 10)
- **Set HP to 1**: `player.lives = 1` - Test low health state

## Tips for Agent Development
- **Respect object pools**: Deactivate entities with `.active = false`; pools auto-recycle
- **Avoid blocking**: `updateDemoAI()` runs every frame (~60 FPS)—keep logic lightweight
- **Use existing helpers**: `dist()`, `rand()`, `clamp()`, `randDir()` available in `utils.js`
- **Read before writing**: Most game state is readable via globals before making decisions
- **Test in DEMO mode**: Preserve original gameplay by using `DEMO` state for AI testing
- **Mobile awareness**: Check `IS_MOBILE` flag; visuals are simplified on mobile devices
- **Scale coordinates**: If injecting visual overlays, account for `GAME_SCALE`
- **Modular access**: Each system is in its own file; override specific functions without touching others
