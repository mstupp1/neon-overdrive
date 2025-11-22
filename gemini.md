# Project Analysis: Neon Overdrive

## Project Overview
**Neon Overdrive** is a web-based bullet hell shooter game contained within a single HTML file. It features a high-intensity neon aesthetic, fast-paced gameplay, and a custom game engine built from scratch using vanilla JavaScript and the HTML5 Canvas API.

## Technology Stack
- **Core**: HTML5, CSS3, JavaScript (ES6+).
- **Rendering**: HTML5 Canvas API (2D Context).
- **Audio**: Web Audio API (Synthesized sound effects, no external assets).
- **Dependencies**: None (Zero-dependency, vanilla implementation).

## Game Mechanics
- **Genre**: Bullet Hell / Shoot 'em up (SHMUP).
- **Controls**: 
  - Mouse/Touch drag for relative movement.
  - Auto-fire mechanics.
- **Entities**:
  - **Player**: Features movement physics, health/lives system, and weapon power levels.
  - **Enemies**: Distinct types with unique behaviors:
    - *Chaser*: Follows the player.
    - *Spinner*: Stationary/moving turret that shoots patterns.
    - *Dasher*: Fast moving, predictive targeting.
    - *Snake*: Multi-segmented enemy.
    - *Sniper*: Aim and shoot mechanics.
  - **Powerups**: Weapon upgrades, Bombs (screen clear), Shields, Extra Lives.
- **Systems**:
  - **Object Pooling**: Custom `Pool` class to manage memory for Bullets, Enemies, Particles, Powerups, and Text to prevent garbage collection pauses.
  - **Game Loop**: Fixed timestep logic (60 updates/sec) with decoupled rendering.
  - **Asset Generation**: All graphics are procedurally generated at runtime using Canvas drawing commands (no image files).

## Aesthetics & Design
- **Theme**: Cyberpunk / Neon Glitch.
- **Visual Style**:
  - High contrast neon colors (Cyan, Magenta, Red) on a deep black background.
  - "Glitch" text effects using CSS animations.
  - CRT Monitor effects: Scanline overlay, RGB shift (implied in style).
  - Glow effects using `shadowBlur` in Canvas.
- **UI**: Minimalist HUD with skewed containers and translucent backdrops.

## Code Structure
- **Single File Architecture**: All code resides in `index.html`.
- **CSS**: Embedded in `<style>` block. Handles UI layout, animations, and screen effects.
- **JavaScript**: Embedded in `<script>` block.
  - **Classes**: `Bullet`, `Enemy`, `PowerUp`, `Particle`, `FloatingText`, `Pool`.
  - **State Management**: Global variables for game state (`MENU`, `PLAYING`, `GAME_OVER`), score, and entities.
  - **Input Handling**: Unified mouse and touch event listeners.
