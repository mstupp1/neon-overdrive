# NEON OVERDRIVE

A roguelike neon arcade shooter for the browser: portrait, auto-firing, bullet-dodging, upgrade-drafting. Pure HTML5 Canvas + vanilla JS (ES modules), no build step, no dependencies.

## Run it

Serve the folder with any static server (ES modules don't load from `file://`):

```bash
python3 -m http.server 8000            # then open http://localhost:8000
python3 -m http.server 8000 --bind 0.0.0.0   # to play from a phone on your LAN
```

It deploys as-is to any static host (itch.io, GitHub Pages, Netlify…). Fonts are self-hosted, so it works offline.

## How to play

| Action | Keyboard | Mouse | Touch | Gamepad |
|---|---|---|---|---|
| Move | WASD / arrows | ship follows cursor | drag anywhere (relative) | left stick / d-pad |
| Dash (i-frames) | Space | left click | DASH button or 2nd finger | A / RT |
| Overdrive | E | right click | OVERDRIVE button | B / X |
| Focus (slow, precise) | hold Shift | — | — | LB / RB / LT |
| Pause | Esc / P | pause button | pause button | Start |

In menus: arrows/d-pad to move, Enter/Space/A to select, Esc/B to go back, `1`–`3` to pick an upgrade, `R` to reroll (or retry on the results screen).

### The loop

- **Sectors.** Each run is a sequence of ~40–60 s sectors of enemy formations. Every **3rd sector ends in a boss** (WARDEN → HYDRA → OMEGA, each with three phases). After sector 9 the cycle loops with much harder enemies — it's endless, chase the high score.
- **Data shards → level ups.** Enemies drop XP shards (magnetised when close). Each level offers a draft of 3 upgrades; clearing a sector grants a bonus draft and repairs 1 hull. Rerolls: 1 per run + 1 per boss kill.
- **Build.** Upgrade your main cannon, stats (damage, fire rate, crit, pierce, speed, magnet, overdrive capacitor) and defenses (hull, regenerating Aegis shield, extra dashes), and slot up to **4 weapon modules**: Swarm Missiles, Razor Orbit, Wingmen, Arc Coil, Pulse Nova, Rail Lance, Shrapnel, Shock Dash.
- **Combo.** Kills chain into a score multiplier (up to x8). Getting hit breaks the chain.
- **Graze & Overdrive.** Skimming bullets and killing fills the Overdrive meter. Trigger it to erase every bullet on screen, hit everything, vacuum shards, and gain boosted fire rate/damage and double score for several seconds.
- **Only the white core of your ship is the hitbox.** Dashing makes you invulnerable.

### Ships

| Ship | Style | Price | Free unlock |
|---|---|---|---|
| VECTOR | Twin pulse cannon, balanced | owned | — |
| NEEDLE | Piercing lances, fast, 2 hull | 600 | Defeat any boss |
| BULWARK | Wide scatter, 4 hull, starts with shield | 900 | Reach sector 5 |
| PHANTOM | Seeking crescents, 3 dashes, Shock Dash | 1400 | Reach sector 8 |

Ships are bought with credits in the **Hangar** (campaign map → HANGAR), or granted for free when you hit the legacy unlock goal.

### Hangar: parts and paint

Each ship has three gear slots: **Core**, **Plating**, **Thrusters**. Parts are bought once and usable on any ship; every part has a tradeoff (e.g. Glass Reactor: +30% damage, -1 hull; Afterburner Kit: +1 dash, slower recharge; Aegis Emitter: start with Aegis Shield). Four paint jobs per ship (120 credits each) are cosmetic. Gear can only be changed from the campaign map, never mid-run. Endless Grid flies your selected ship with its parts.

Best score, best sector, unlocks and settings persist in `localStorage`.

## Settings

Music / SFX volume, screen shake, screen flashes, damage numbers, fullscreen, and reset progress.

## Project layout

```
index.html          markup for canvas + DOM menus
src/main.js         boot, layout, main loop, game flow (title → campaign → hangar / route → run → draft/pause → results)
src/style.css       menu/HUD-overlay styles
src/core/           math, input (kb/mouse/touch/gamepad), audio (synth SFX + music), storage
src/render/         pre-rendered glow sprites, synthwave background, canvas HUD
src/game/           state, player, weapons modules, enemies, bosses, bullets, pickups,
                    wave director, upgrades, ships, FX, autopilot bot, world step/collisions
src/ui/screens.js   menu screens, navigation, draft cards
src/ui/meta.js      campaign / route / market / extraction screens
src/ui/hangar.js    hangar (ships, parts, paint)
src/audio/music/    soundtrack
src/fonts/          Orbitron + Rajdhani (SIL OFL)
```

## Performance notes

- All glow is baked into offscreen sprites once; nothing uses `shadowBlur` per frame.
- Object pooling for bullets, particles and pickups; fixed-cap particle budget.
- Variable-rate simulation sub-stepped at ≤1/60 s, so it's smooth on 60/120/144 Hz displays.
- Adaptive quality: sustained slow frames lower render resolution and particle count automatically.

See [agents.md](agents.md) for the debug/automation hook (`window.NEON`).
