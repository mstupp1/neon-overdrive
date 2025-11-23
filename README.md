# Neon Overdrive

A fast-paced neon bullet-hell shooter built with HTML5 Canvas and vanilla JavaScript.

## Running

This is a browser-based game with no build step required:

1. Start a local web server in the project directory:
   ```bash
   python3 -m http.server 8000
   ```
   Or use any other static file server.

2. Open your browser to `http://localhost:8000`

3. Click "ENGAGE" to start playing!

## Controls

- **WASD** or **Arrow keys**: Move the ship
- **Mouse/Touch**: Alternative movement (ship follows cursor)
- **P** or **Esc**: Pause/resume
- **Space** or **Enter**: Select menu options

## Features

- Dynamic neon visuals with cosmic background effects
- Progressive difficulty with multiple enemy types
- Character progression with level-up upgrades (HP, Damage, Fire Rate)
- Weapon power-up system
- Collectible powerups: shields, bombs, extra lives, score bonuses
- Keyboard navigation for all menus
- Mobile-optimized (max 430x932 resolution)

## Notes

- Game launches in demo/attract mode; press start to play
- Bombs clear all enemies and bullets on screen
- Shields provide one-hit protection
- Power-ups blink before despawning
- HP hearts show both filled and empty slots for visual feedback
