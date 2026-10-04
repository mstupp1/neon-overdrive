# NEON OVERDRIVE

A roguelike neon arcade shooter for the browser: portrait, auto-firing, bullet-dodging, upgrade-drafting. Fight through a four-system **campaign** along a branching route, bank credits and rank between runs, and spend them in the **Hangar** on ships, gear and paint. Pure HTML5 Canvas + vanilla JS (ES modules), no build step, no dependencies.

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
| **Boost** (fights; overworld: strafe / lock-on) | hold Shift | - | hold BOOST button | LB / RB / LT |
| Pause | Esc / P | pause button | pause button | Start |

On touch, the DASH and ULT buttons (and BOOST above DASH) sit together in one bottom corner so one thumb works them while the other hand steers; **Settings → Touch buttons** picks the corner (RIGHT by default, or LEFT).

Menus: arrows / d-pad to move, Enter / Space / A to select, Esc / B to go back (or skip dialogue), `1`-`3` to pick an upgrade, `R` to reroll (or retry on the game-over screen), `F` to lock the focused draft card. Items you cannot afford stay focusable and show their price.

## Campaign

Title **PLAY** opens the campaign map, then LAUNCH. A **run** flies all four systems in order with one ship: beat a system's boss and you warp straight into the next one with your build, level, hull (half the missing hull is patched) and wallet. **Die anywhere and the next run starts again at Genesis**, so the Hangar, Pilot and banked credits are how you get further each time. Each system is a map of 8 rows plus a boss. The campaign map shows the furthest point any run has reached.

| # | System | Boss | Sectors | Notes |
|---|---|---|---|---|
| 1 | NEON GENESIS | WARDEN | 9 | Learn the ropes |
| 2 | CRIMSON TIDE | HYDRA | 9 | Carriers, shielders |
| 3 | CYAN CYCLONE | OMEGA | 9 | Weavers, blinkers |
| 4 | THE VOID | ECLIPSE | 9 | Final system |

- **Map.** Slay the Spire style: six paths climb a 4-wide grid without crossing, splitting and merging, and you may only jump along a link. Row 1 is always a fight, the middle row is a **Treasure Vault**, the row before the boss is a **Rest Station**, and every map has a Market. Elites, shops, rests, vaults and rifts never come twice in a row on one path. Only the nodes you can reach next are labelled.
- **Overworld.** Between nodes you fly through open space with your whole loadout: main gun, modules, dash and ultimate all work out here. Each leg of the route is its own large zone; the next nodes are exits hidden somewhere up ahead (up, up-left or up-right), and you have to find them. Fly into an exit and hold (or press Enter / A) to jump in; picking one closes the others, and the next leg is a new zone. The card above the gauges shows what an exit holds: reward, hazards, hostiles, zones and threat (or what a stop does). Packs of the levels' own enemies sleep around the zone and wake when you get close, stragglers roam in the longer you take, and debris fields block ships and shots, so you can fight through or run past. The ship auto-aims: it turns to the nearest awake enemy in range while you steer anywhere (sleeping packs are left alone so you can sneak past), and faces where it flies when nothing is near. Hold **Shift** (pad shoulder) to lock onto that target and strafe around it (with no target it holds the facing, which also lets you pull a sleeping pack); with a mouse Shift aims at the cursor instead, and a pad's right stick aims. Steering: WASD / stick, drag on touch, click or hold the left mouse button. **M** / Tab / Select / the MAP button opens the zone map (fogged until you fly through it) with the system route under it. Sites: **Salvage** (credits), **Data Cache** (XP), **Repair Beacon** (+1 hull), **Guarded Cache** (clear its elite guards first) and **Distress Signal** (an anomaly). Pause still has ABANDON / EXTRACT.
- **Fight rewards.** Every combat node shows (a coloured dot, and a tag when reachable) what it pays on top of its sector draft: **OFFENSE**, **DEFENSE** or **MODULE** (the draft only offers that category; Defense also repairs 1), **CACHE** (a credit cache), **HULL** (+1 max hull), **BOOST** (+1 level to an upgrade you own). Elites pay **2 DRAFTS**.
- **Stage views.** Top-down is the main view, but now and then a fight flies one of its later zones from another camera, switching mid fly-through. **SIDESCROLL**: the jet faces right and threats come in from the right; up / down steer, the jet holds the left half of the screen, and neon terrain closes in from above and below (scraping it costs hull). **PURSUIT**: the camera sits behind and above the jet and everything comes out of the distance toward you; you hold the near lane, and laser gates rush in that you have to fly through the gap of (missing costs hull, threading one charges the ult a little). Most fights past the first row (60%, elites 80%, first row 35%) have such a zone, and a three-zone fight sometimes flies both later zones in other views; the exit card shows it. In PURSUIT the ships stand up off the floor like paper cutouts, hovering over their own lit shadows. Boss variants: HYDRA can meet you side-on as the **Abyssal Leviathan** (orb tides with one gap, floor-to-ceiling geysers) and OMEGA from behind as **Event Horizon** (gate volleys, lanes that light up along the floor); each arena rolls its variant 65% of the time.
- **Node types:** **Combat**, **Elite** (a Hunter mini-boss late in the sector), **Market**, **Rest**, **Anomaly**, **Vault**, **Rift** and the **Boss**.
- **Modifiers.** Elites always, and combat nodes past the first row sometimes, carry a sector modifier: ION STORM (faster bullets, +50% credits), SWARM FRONT, MINEFIELD, BLACKOUT (lights out, enemies glow), OVERCLOCKED (enemies fire faster, +30% XP), BOUNTY (elites drop extra credits).
- **Difficulty.** One continuous climb: Genesis opens gently and every system picks up where the last boss left off, so a build that keeps growing stays roughly level with the waves.
- **Black Market.** Two upgrade offers, a repair, a reroll token and **Contraband** (+2 random upgrade levels, -1 max hull). Paid from the run wallet; prices rise with the system.
- **Rest Station.** Full repair, **Reinforce** (+1 max hull), or **Overclock** (+1 level to an upgrade you own, your pick).
- **Treasure Vault.** A credit cache plus a draft where each pick installs two levels.
- **Chaos Rift.** Dive in (+3 random upgrade levels, the next 2 fights each get a hazard modifier), skim the edge (+1 level, 1 hazard) or back away.
- **Anomalies.** Risk-for-reward events with 2-3 choices: Derelict Carrier, Signal Echo, Smuggler Beacon, Cryo Pod, Glitched Cache, Ghost Signal, Overcharged Reactor, Quiet Drift, Wreckage Field, MAG Uplink. Some curse the next fight (a hazard modifier or an elite ambush).
- **Story.** Short comms exchanges (ECHO is your pilot; MAG and the SIGNAL talk to you) play at launch, before and after bosses and at the ending. Toggle in Settings; Esc / B skips.
- **Hull.** Clearing a sector repairs 1 hull. A system boss gives a reward draft and moves the run on; beating ECLIPSE wins the run and you **extract**.

### Endgame: Deep Grid, Overdrive tiers, Flux

- **Deep Grid.** Beating ECLIPSE no longer ends the run: after a reward draft and the ending, the run loops back to Genesis as **Deep Grid 1**, then 2, 3... Each cycle multiplies enemy HP by 1.8 and pushes bullet speed, fire rate and spawn rate a little, with bigger rewards. The run only ends when you die (everything banks, since the run is already won) or choose **EXTRACT · BANK ALL** from the pause menu.
- **Overdrive tiers** (Diablo-style torment levels). Clearing THE VOID at tier *t* unlocks tier *t+1* (up to 10). Pick the tier with the OVERDRIVE button on the campaign map before LAUNCH. Each tier: enemy HP ×1.4, slightly faster and denser fire, +25% credits and XP.
- **Flux** drops only while the run is heated (tier > 0 or in the Deep Grid): bosses, Hunters and sector clears, scaled by heat = tier + Deep cycle. It always banks in full.
- **Flux Core** (campaign map): permanent stat levels with no cap, prices rising per level: Damage Lattice (+5% damage), Cycle Accelerator (+3% fire rate), Predictive Optics (+1% crit), Hull Weave (+1 max hull), Overdrive Feed (+6% charge), Neural Uplink (+5% XP), Salvage Protocol (+5% credits).

### Economy and banking

- You earn **credits** in a run: kill chips (`credit` pickups), elites and Hunters, sector clear payouts and the boss. The run **wallet** is what you spend at Markets.
- **Extraction / a won run** banks 100% of the wallet. **Death** before beating THE VOID banks 50%. **Abandoning** an unwon run banks nothing.
- A full run earns a few thousand credits. Spend-vs-bank is the point: every credit spent at a Market is one less for the Hangar.
- **Pilot Rank** comes from run XP (score, sectors, bosses, +bonus for victory, later systems teach more). Rank 3 = 700 XP, rank 6 = 2500, rank 10 = 6300, cap 15. Rank gates classes and passives.

### Ships

Ships are bought with credits in the **Hangar** (campaign map -> HANGAR), or granted free when you reach the legacy unlock goal.

| Ship | Style | Hull | Price | Free unlock |
|---|---|---|---|---|
| VECTOR | Twin pulse cannon, balanced | 3 | owned | - |
| NEEDLE | Piercing lances, fast, glass cannon | 2 | 600 | Defeat any boss |
| BULWARK | Short-range homing scatter, starts with a shield | 4 | 900 | Fight 5 sectors in one run |
| PHANTOM | Seeking crescents, 3 dashes, Shock Dash, quick ultimate | 3 | 1400 | Fight 8 sectors in one run |
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

### Passive tree

**PILOT → PASSIVE TREE** opens each class's own node wheel (64 nodes). You earn **2 points per Pilot Rank**, plus 1 per level of the Flux Core's **Neural Expansion**. Start at the class core and spend points on linked nodes, working outward through six themed wedges that match the gear build paths (Firepower, Crit, Modules, Mobility, Overdrive, Graze, Tank, Greed). Most nodes are small stat bumps. Each wedge has notables and ends in a class-specific **keystone** that changes the rules (Glass Cannon, Swarm Doctrine, Shadow Strike...), and link nodes join neighbouring wedges for hybrid builds. Refunds are free at any time: click an allocated node (if nothing past it depends on it) or REFUND ALL. Drag to pan; wheel, pinch or +/− to zoom; arrows walk the nodes with keys or a pad.

| Class | Big wedges | Small wedges |
|---|---|---|
| STRIKER | Firepower, Crit, Overdrive | Mobility, Greed, Tank |
| ENGINEER | Modules, Greed, Tank | Firepower, Crit, Overdrive |
| GHOST | Mobility, Graze, Crit | Overdrive, Greed, Firepower |

## In a run

- **Level ups.** Enemies drop XP shards. Each level offers a draft of 3 upgrades; clearing a sector grants a bonus draft. Rerolls: 3 per run, +1 every 5 levels and +1 per boss kill (more from Greed gear, the Prospector tree notable and the Flux Core). Lock a card (lock icon, `F`, or X on a pad) to keep it through a reroll.
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
| Proximity Mines | Mines dropped in your wake blow when enemies come close (Crimson) |
| Buzzsaw | A saw that carves through enemies and boomerangs back (Cyclone) |
| Stasis Pulse | Freezes nearby bullets to a crawl and shocks enemies (Cyclone) |
| Prism Beam | A locked-on beam that burns up to three targets (Void) |
| Starfall | Stars fall from the top of the screen onto enemies (Void) |

**Evolutions.** Max a module (level 5) while owning its partner stat and a gold **EVOLVE** card can appear in drafts: Swarm Missiles + Targeting AI = **Hellfire Swarm**, Razor Orbit + Thrusters = **Storm Halo**, Arc Coil + Capacitor = **Tesla Storm**, Pulse Nova + Plasma Core = **Supernova**, Wingmen + Overclock = **Phalanx**, Rail Lance + Phase Rounds = **Annihilator**, Reflector + Aegis Shield = **Mirror Storm**, Gravity Well + Tractor Field = **Event Horizon**. Evolutions take no module slot and are never sold in the Black Market.

### Tech tiers and discovery

The level-up pool grows as a run goes deeper. Genesis drafts from the core set. Reaching Crimson, Cyclone and the Void each adds a tier of rarer tech (Rail Lance, Reflector, Gravity Well, the new modules above, and perks such as Overload Rounds, Culling Edge, Second Wind, Echo Fire, Static Discharge, Perpetual Engine and Null Field). Seeing an option in any draft, Black Market or smuggler beacon **discovers** it: from then on it can turn up from Genesis in every later run. Cards mark the difference: a white **NEW DISCOVERY** flag and white frame for tech never seen before, and a **NEW THIS RUN** flag for tech you know but don't own in the current run. Saves that had already played keep everything that existed before tiers, so nothing they could draft goes missing.

### Enemies and bosses

- **Core roster:** darts, swarms, spinners, dashers, snakes, snipers, tanks, splitters, mines.
- **Later systems:** **Carriers** (launch swarm pods), **Shielders** (shield their neighbours until killed), **Weavers** (a pair joined by a lethal laser tripwire), **Blinkers** (teleport and fire a ring), and on Elite nodes the **Hunter** mini-boss.
- **WARDEN** (siege mech), **HYDRA** (bio-leviathan), **OMEGA** (core intelligence): three phases each. Campaign boss HP is tuned per system.
- **ECLIPSE** (system 4 only): a dark mirror with mirror fans, rings, telegraphed dash-lane beams and shockwaves. Its last phase copies **your** class ultimate (Dark Overdrive, Dark Fortress with two turrets and an invulnerable dome, Dark Phase).

Best score, unlocks, credits, rank, gear and settings persist in `localStorage` (profile v3; v2 saves migrate and corrupt saves are sanitised).

## Gallery and achievements

**GALLERY** (title menu) holds 30 **relics** in five themed sets of six: GRID ORIGINS, BIO BLOOM, DATA STORM and EVENTIDE (one per campaign system) and GRID JUNK (a small share of finds in any system). Each set has 3 commons, 2 rares and a legendary.

- **Buy** commons (150) and rares (350) in the Gallery, or open a **Data Capsule** (180) for a random common or rare you don't own yet.
- **Find** them in the field: any kill has a tiny chance to drop a golden relic cache (elites 4%, Hunters 20%, bosses 35%). It drops a relic from the set of the system you're flying, preferring ones you don't own. **Legendaries are field finds only.** Finds are kept even if you die.
- Completing a set pays a 250 credit bonus.

**ACHIEVEMENTS** (title menu): 44 achievements in four tabs (Combat, Skill, Career, Oddities), some hidden behind a one-line hint until unlocked. Each pays credits (bronze 20, silver 60, gold 150). Unlocks, relic finds and set completions pop a small toast at the top of the screen. Older saves get what they already earned on first load.

## Settings

Music / SFX volume, screen shake, screen flashes, damage numbers, story dialogue, replay intro, fullscreen, reset progress.

The first boot plays a short, skippable in-engine intro (ECHO's squadron falls at the Genesis gate, MAG wakes ECHO, one burst of combat) before the title menu; any key arms the skip, a second press (or Esc) skips.

## Project layout

```
index.html            markup for canvas + DOM menus
src/main.js           boot, layout, main loop, game flow (title -> campaign -> overworld -> run -> draft/pause -> results), NEON debug hook
src/style.css         menu / HUD-overlay styles
src/core/             math (+ seeded PRNG), input (kb/mouse/touch/gamepad), audio (synth SFX + music), storage (profile v3)
src/render/           baked glow sprites (ships, enemies, gear, portraits), per-system backgrounds, canvas HUD
src/game/state.js     global state G
src/game/player.js    ship, firing, dash, ult hookup, hit handling
src/game/pilot.js     classes, ultimates, passives, Phase Shift time scale
src/game/tree.js      passive trees (per-class node wheels, points, refunds, keystones)
src/game/modules.js   weapon modules, evolutions, beams
src/game/enemies.js   enemy roster and AI, Hunter, damage / kill
src/game/bosses.js    WARDEN / HYDRA / OMEGA / ECLIPSE
src/game/director.js  wave director (sector flow, patterns, boss warn)
src/game/campaign.js  systems, route generation, node specs
src/game/stageview.js side / chase stage views: frame swap, screen mapping, terrain, laser gates, backdrops
src/game/overworld.js free-flight overworld: one zone per route leg, hidden exits, enemy packs, debris, sites, map
src/game/modifiers.js sector modifiers
src/game/economy.js   credits, banking, Pilot Rank, Black Market, dock
src/game/hangar.js    ships, paint, the gear Fabricator, equip / sell (pure profile logic)
src/game/parts.js     gear items: 21 base types, 12 legendaries, random modifiers, build paths
src/game/rarity.js    Common → Legendary odds and luck (gear and level-up cards)
src/game/loot.js      gear drops, inventory cap, pilot class / ability finds
src/game/ships.js     ships, weapons, paint sets
src/game/story.js     dialogue and the 10 anomaly events
src/game/intro.js     skippable boot intro (scripted in-engine cinematic)
src/game/upgrades.js  upgrade pool, drafts, stat recompute
src/game/bullets.js, pickups.js, fx.js, world.js, bot.js   projectiles, pickups, particles, step + collisions, autopilot
src/ui/screens.js     menu navigation, draft cards, results
src/ui/meta.js        campaign / route / market / dock / event / extraction screens
src/ui/hangar.js      Hangar (ships, paint), inventory, Fabricator
src/ui/pilot.js       Pilot screen (class, abilities)
src/ui/tree.js        Passive tree screen (pan / zoom canvas)
src/ui/comms.js       dialogue overlay
src/game/collectables.js   relic sets, buying, capsules, field drops
src/game/achievements.js   achievement defs + tracker (polls G / profile each frame)
src/ui/gallery.js     Gallery and Achievements screens
src/ui/toasts.js      achievement / relic notification toasts
src/gallery.css       styles for the above
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
