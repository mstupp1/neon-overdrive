# Agents Guide for Neon Overdrive

This game lives entirely in `index.html` and exposes its state through globals. Use this guide to understand where to plug an automated agent, what signals to read, and how to drive the player safely.

## Quick Map of Core Globals
- State flags: `gameState` (`MENU`, `PLAYING`, `GAMEOVER`, `DEMO`), `frameCount`, `score`.
- Player: `player` (pos `x/y`, `powerLevel`, `maxPower`, `lives`, `hasShield`, `iframes`, `tail`).
- Entities: `bullets`, `enemies`, `powerups`, `particles`, `texts`; object pools handle allocation (`bulletPool`, `enemyPool`, etc.).
- Systems: `update(dt)` game tick, `draw()` renderer, `firePlayerWeapons()` shooting, `hitPlayer()` damage handler, `spawnEnemyLogic()` spawner, `triggerBombLogic()` screen clear.

## How the Game Updates
- Fixed timestep loop at ~60 updates/sec with `update(dt)` handling spawn, movement, collisions, scoring, and pooling cleanup.
- Render loop uses Canvas 2D; state changes happen in `update`, not `draw`.
- Demo/autoplay lives in `updateDemoAI()`, executed when `gameState === 'DEMO'`.

## Driving an Agent
- Input surfaces: keyboard flags `keys` (up/down/left/right/w/a/s/d), pointer events update `pointerX/pointerY`, and the game uses these inside `update` to move the player when `gameState === 'PLAYING'`.
- Simplest control injection: set `keys` booleans each frame or override `updateDemoAI()` with custom logic, then set `gameState = 'DEMO'` to let it run without UI buttons.
- Movement bounds: player is clamped to the canvas with a small margin (`20–30` px), so avoid commanding positions outside that.
- Shooting is auto-fired every few frames during `PLAYING`; calling `firePlayerWeapons()` manually is optional unless you set a custom cadence.

## Signals to Observe
- Threats: iterate `bullets` for enemy projectiles (`b.type === 'enemy'`), `enemies` for collision bodies; use `dist(player.x, player.y, target.x, target.y)` helper already present.
- Opportunities: `powerups` carries `type` (`weapon`, `bomb`, `shield`, `life`). Collect by steering within `radius + 20`.
- Survival: `player.iframes` indicates invulnerability frames; `player.hasShield` toggles a one-hit buffer.
- Difficulty: spawn rate tightens with score; in DEMO it is set more aggressively.

## Using the Built-in Demo AI
- `updateDemoAI()` demonstrates a steering blend: avoid nearby threats, attract toward close powerups, bias to the back of the screen, smooth movement, auto-fire, and force max power.
- You can replace or wrap this function to test alternative policies without touching the rest of the loop.

## Common Extension Hooks
- Start a controlled run: call `initGame(); gameState = 'PLAYING';` then drive `keys` or pointer values each frame.
- Sandbox/autoplay: set `gameState = 'DEMO'` after redefining `updateDemoAI` to your agent; the loop will invoke it automatically.
- Bomb usage: call `triggerBombLogic()` to clear bullets/enemies and shake the screen; respect cooldowns you define.
- UI feedback: `updateUI()` syncs score, lives, and power bars; call after manipulating player stats for consistency.

## Tips
- Respect the pools: deactivate entities by setting `.active = false`; the cleanup step will recycle them.
- Avoid blocking: heavy logic inside `updateDemoAI()` runs every frame—keep it lightweight.
- For experimentation, expose your agent via the console or a new script tag; keep changes minimal to preserve single-file portability.
