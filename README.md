# NEON OVERDRIVE

A roguelike neon arcade shooter for the browser: portrait, auto-firing, bullet-dodging, upgrade-drafting. Fight through a four-system **campaign** along a branching route, bank credits and rank between runs, and spend them in the **Hangar** on ships, gear and paint. A classic **Endless Grid** remains for score chasers. Pure HTML5 Canvas + vanilla JS (ES modules), no build step, no dependencies.

## Run it

Serve the folder with any static server (ES modules don't load from `file://`):

```bash
python3 -m http.server 8000            # then open http://localhost:8000
python3 -m http.server 8000 --bind 0.0.0.0   # to play from a phone on your LAN
```

It deploys as-is to any static host (itch.io, GitHub Pages, Netlify...). Fonts are self-hosted, so it works offline.

## Controls

| Action | Keyboard | Mouse | Touch | Gamepad |
|---|---|---|---|---|
| Move | WASD / arrows | ship follows cursor | drag anywhere (relative) | left stick / d-pad |
| Dash (i-frames) | Space | left click | DASH button or 2nd finger | A / RT |
| **Class ultimate** (replaces Overdrive) | E | right click | ULT button | B / X |
| Focus (slow, precise) | hold Shift | - | - | LB / RB / LT |
| Pause | Esc / P | pause button | pause button | Start |

Menus: arrows / d-pad to move, Enter / Space / A to select, Esc / B to go back (or skip dialogue), `1`-`3` to pick an upgrade, `R` to reroll (or retry on the game-over screen). Items you cannot afford stay focusable and show their price.

## Campaign

Title **PLAY** opens the campaign map: pick a **system**, then LAUNCH. Systems unlock in order (clear one to open the next). Each system is a route of 5-6 rows plus a boss.

| # | System | Boss | Sectors | Supply drops | Notes |
|---|---|---|---|---|---|
| 1 | NEON GENESIS | WARDEN | 6 | - | Learn the ropes |
| 2 | CRIMSON TIDE | HYDRA | 6 | 3 | Carriers, shielders |
| 3 | CYAN CYCLONE | OMEGA | 7 | 4 | Weavers, blinkers |
| 4 | THE VOID | ECLIPSE | 7 | 4 | Final system |

- **Route.** Every row offers 2-3 nodes; you may only jump to nodes linked from your current one. Node types: **Combat**, **Elite** (a Hunter mini-boss late in the sector, pays ~3 elites of credits), **Market**, **Dock**, **Anomaly** and the **Boss**. Every row keeps at least one fight, and a Market or Dock is guaranteed from row 3 on.
- **Modifiers.** Elites always, and combat nodes past the first row sometimes, carry a sector modifier: ION STORM (faster bullets, +50% credits), SWARM FRONT, MINEFIELD, BLACKOUT (lights out, enemies glow), OVERCLOCKED (enemies fire faster, +30% XP), BOUNTY (elites drop extra credits).
- **Supply Drop.** Systems 2-4 open with free upgrade drafts so a fresh ship is not helpless at row 0. The first two rows of systems 2-4 also ease in, and Genesis starts as gently as the first Endless sector.
- **Black Market.** Two upgrade offers, a repair, a reroll token and **Contraband** (+2 random upgrade levels, -1 max hull). Paid from the run wallet; prices rise with the system.
- **Repair Dock.** Full repair, or **Reinforce** (+1 max hull).
- **Anomalies.** Risk-for-reward events with 2-3 choices: Derelict Carrier, Signal Echo, Smuggler Beacon, Cryo Pod, Glitched Cache, Ghost Signal, Overcharged Reactor, Quiet Drift, Wreckage Field, MAG Uplink. Some curse the next fight (a hazard modifier or an elite ambush).
- **Story.** Short comms exchanges (ECHO is your pilot; MAG and the SIGNAL talk to you) play at launch, before and after bosses and at the ending. Toggle in Settings; Esc / B skips.
- **Hull.** Clearing a sector repairs 1 hull. Win = beat the system boss and **extract**.

### Economy and banking

- You earn **credits** in a run: kill chips (`credit` pickups), elites and Hunters, sector clear payouts and the boss. The run **wallet** is what you spend at Markets.
- **Extraction (victory)** banks 100% of the wallet. **Death** banks 50%. **Abandoning** a run banks nothing. Endless Grid earns half credits but banks all of them.
- Typical win: ~300 (system 1), 500, 700, 1000 (system 4) credits. Spend-vs-bank is the point: every credit spent at a Market is one less for the Hangar.
- **Pilot Rank** comes from run XP (score, sectors, bosses, +bonus for victory, later systems teach more). Rank 3 = 700 XP, rank 6 = 2500, rank 10 = 6300, cap 15. Rank gates classes and passives.

### Ships

Ships are bought with credits in the **Hangar** (campaign map -> HANGAR), or granted free when you reach the legacy unlock goal.

| Ship | Style | Hull | Price | Free unlock |
|---|---|---|---|---|
| VECTOR | Twin pulse cannon, balanced | 3 | owned | - |
| NEEDLE | Piercing lances, fast, glass cannon | 2 | 600 | Defeat any boss |
| BULWARK | Short-range homing scatter, starts with a shield | 4 | 900 | Endless: reach sector 5 |
| PHANTOM | Seeking crescents, 3 dashes, Shock Dash, quick ultimate | 3 | 1400 | Endless: reach sector 8 |
| CORSAIR | Ricochet bolts that bounce off the side walls | 3 | 1100 | - |
| MONOLITH | Siege: slow, huge piercing charge orbs | 5 | 1600 | - |

### Gear parts

Three slots per ship: **Core**, **Plating**, **Thrusters**. Parts are bought once and fit any ship; each has a tradeoff. Gear can only be changed from the campaign map, never mid-run. Paint jobs (3 per ship, 120 credits) are cosmetic.

| Slot | Part | Price | Effect |
|---|---|---|---|
| Core | Glass Reactor | 300 | +30% damage, -1 max hull |
| Core | Rapid Cycler | 250 | +20% fire rate, -10% damage |
| Core | Data Siphon | 200 | +25% XP, -5% damage |
| Core | Hunter Optics | 350 | +10% crit, crits deal 3x, -8% fire rate |
| Plating | Reactive Armor | 350 | +1 max hull, -8% speed |
| Plating | Aegis Emitter | 400 | Start with Aegis Shield 1, dashes recharge 15% slower |
| Plating | Graze Mesh | 300 | +40% graze radius, +30% graze Overdrive, -6% damage |
| Plating | Salvage Hull | 250 | +30% credits, -10% damage |
| Thrusters | Afterburner Kit | 450 | +1 dash charge, 20% slower recharge |
| Thrusters | Vector Fins | 250 | +12% speed, 15% slower recharge |
| Thrusters | Phase Drive | 400 | +40% dash length and i-frames, -5% speed |
| Thrusters | Magnet Coil | 150 | +60% pickup range, -5% speed |

### Pilot classes

Open **PILOT** on the campaign map to pick a class and equip **2 passives**. Rank unlocks both.

| Class | Rank | Ultimate | Passives (rank) |
|---|---|---|---|
| STRIKER | 1 | **OVERDRIVE**: erase every bullet, blast all enemies, vacuum shards, +fire rate / +damage | Killstreak (1), Hair Trigger (2), Executioner (4), Bloodrush (5) |
| ENGINEER | 3 | **FORTRESS PROTOCOL**: opening blast, then a bullet-eating dome and 2 extra wingmen | Salvager (3), Overflow (4), Drone Link (5), Nanorepair (7) |
| GHOST | 6 | **PHASE SHIFT**: enemies, bullets and spawns slow to 40%, you are intangible, grazes strike back | Wide Graze (6), Slipstream (7), Riposte (8), Afterimage (10) |

## In a run

- **Level ups.** Enemies drop XP shards. Each level offers a draft of 3 upgrades; clearing a sector grants a bonus draft. Rerolls: 1 per run + 1 per boss kill.
- **Build.** Main cannon, stats (damage, fire rate, crit, pierce, speed, magnet, capacitor), defenses (hull, regenerating Aegis shield, extra dashes) and up to **4 weapon modules** (5 with Engineer's Overflow).
- **Combo.** Kills chain into a score multiplier (up to x8). Getting hit breaks the chain.
- **Graze and ultimate.** Skimming bullets and killing fills the ult meter. Every ultimate doubles your score while it lasts.
- **Only the white core of your ship is the hitbox.** Dashing makes you invulnerable.

### Modules and evolutions

| Module | What it does |
|---|---|
| Swarm Missiles | Homing missiles with a small blast |
| Razor Orbit | Blades orbit you, cutting enemies and erasing bullets |
| Wingmen | Escort drones that fire (aimed from level 3) |
| Arc Coil | Lightning chains between enemies |
| Pulse Nova | Periodic ring of piercing shots |
| Rail Lance | Huge piercing beam |
| Shrapnel | Dead enemies burst into fragments |
| Shock Dash | Dashing unleashes a shockwave |
| Gravity Well | A singularity that drags in enemies and bullets |
| Reflector | A pulsing bubble that burns what it touches and returns enemy bullets |
| Flak Burst | Slow shells that airburst into fragment rings |

**Evolutions.** Max a module (level 5) while owning its partner stat and a gold **EVOLVE** card can appear in drafts: Swarm Missiles + Targeting AI = **Hellfire Swarm**, Razor Orbit + Thrusters = **Storm Halo**, Arc Coil + Capacitor = **Tesla Storm**, Rail Lance + Phase Rounds = **Annihilator**. Evolutions take no module slot and are never sold in the Black Market.

### Enemies and bosses

- **Core roster:** darts, swarms, spinners, dashers, snakes, snipers, tanks, splitters, mines.
- **Later systems:** **Carriers** (launch swarm pods), **Shielders** (shield their neighbours until killed), **Weavers** (a pair joined by a lethal laser tripwire), **Blinkers** (teleport and fire a ring), and on Elite nodes the **Hunter** mini-boss.
- **WARDEN** (siege mech), **HYDRA** (bio-leviathan), **OMEGA** (core intelligence): three phases each. Campaign boss HP is tuned per system.
- **ECLIPSE** (system 4 only): a dark mirror with mirror fans, rings, telegraphed dash-lane beams and shockwaves. Its last phase copies **your** class ultimate (Dark Overdrive, Dark Fortress with two turrets and an invulnerable dome, Dark Phase).

## Endless Grid

**ENDLESS GRID** on the campaign map flies your selected ship and gear on the classic arcade ladder: 9-sector cycles with a boss every 3rd sector (WARDEN, HYDRA, OMEGA), looping with much harder enemies. Half credits, banked in full when you die. Best score and best sector are kept.

Best score, unlocks, credits, rank, gear and settings persist in `localStorage` (profile v3; v2 saves migrate and corrupt saves are sanitised).

## Settings

Music / SFX volume, screen shake, screen flashes, damage numbers, story dialogue, fullscreen, reset progress.

## Project layout

```
index.html            markup for canvas + DOM menus
src/main.js           boot, layout, main loop, game flow (title -> campaign -> route -> run -> draft/pause -> results), NEON debug hook
src/style.css         menu / HUD-overlay styles
src/core/             math (+ seeded PRNG), input (kb/mouse/touch/gamepad), audio (synth SFX + music), storage (profile v3)
src/render/           baked glow sprites (ships, enemies, gear, portraits), per-system backgrounds, canvas HUD
src/game/state.js     global state G
src/game/player.js    ship, firing, dash, ult hookup, hit handling
src/game/pilot.js     classes, ultimates, passives, Phase Shift time scale
src/game/modules.js   weapon modules, evolutions, beams
src/game/enemies.js   enemy roster and AI, Hunter, damage / kill
src/game/bosses.js    WARDEN / HYDRA / OMEGA / ECLIPSE
src/game/director.js  wave director (sector flow, patterns, boss warn)
src/game/campaign.js  systems, route generation, node specs
src/game/modifiers.js sector modifiers
src/game/economy.js   credits, banking, Pilot Rank, Black Market, dock
src/game/hangar.js    buy / equip ships, parts, paint (pure profile logic)
src/game/parts.js     12 gear parts
src/game/ships.js     ships, weapons, paint sets
src/game/story.js     dialogue and the 10 anomaly events
src/game/upgrades.js  upgrade pool, drafts, stat recompute
src/game/bullets.js, pickups.js, fx.js, world.js, bot.js   projectiles, pickups, particles, step + collisions, autopilot
src/ui/screens.js     menu navigation, draft cards, results
src/ui/meta.js        campaign / route / market / dock / event / extraction screens
src/ui/hangar.js      Hangar (ships, parts, paint)
src/ui/pilot.js       Pilot screen (class, passives)
src/ui/comms.js       dialogue overlay
src/audio/music/      soundtrack
src/fonts/            Orbitron + Rajdhani (SIL OFL)
```

## Performance notes

- All glow is baked into offscreen sprites once; nothing uses `shadowBlur` per frame.
- Capped pools for enemy bullets (650), player bullets, pickups and particles (900, scaled by quality).
- Variable-rate simulation sub-stepped at <= 1/60 s, so it is smooth on 60/120/144 Hz displays.
- Adaptive quality: sustained slow frames lower render resolution and particle count automatically.
- The headless autopilot simulates a full campaign system in a couple of seconds (see `agents.md`).

See [agents.md](agents.md) for the debug / automation hook (`window.NEON`) and state reference.
