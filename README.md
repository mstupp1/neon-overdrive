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
| Move | WASD / arrows | - | drag anywhere (relative) | left stick / d-pad |
| Dash (i-frames) | Space | - | DASH button or 2nd finger | A / RT |
| **Class ultimate** (replaces Overdrive) | E | - | ULT button | B / X |
| **Boost** | hold Shift | - | hold BOOST button | LB / RB / LT |
| Pause | Esc / P | pause button | pause button | Start |

The mouse only drives menus (including pause, drafts, the Black Market and tooltips); it does not steer or fire in play.

On touch, ULT sits above BOOST, with DASH inward toward the playfield. **Settings → Touch buttons** picks the corner (RIGHT by default, or LEFT, which mirrors the cluster). Hold BOOST or tap ULT while steering with your other hand; a second finger on the field also dashes. Generated instrument housings surround live meters that adapt to dash charges, ultimate reserve cells and boost capacity.

Menus: up / down (arrows, d-pad, stick) always step one row, landing in the column you came from; left / right step along a row, and on a `‹ value ›` selector (ship card, Overdrive tier, settings toggles) change the value. Enter / Space / A to select, Esc / B to go back (or skip dialogue), Q / E or LB / RB to switch the screen's tabs. A footer under every menu shows the buttons for the current device and can be clicked or tapped (BACK is how touch leaves a screen). `1`-`3` to pick an upgrade, `R` to reroll (or retry on the game-over screen), `F` to lock the focused draft card. Items you cannot afford stay focusable and show their price. Names that don't fit end in an ellipsis; hovering or focusing them shows the full text. Descriptions sit in fixed-height boxes, so browsing ships, abilities, relics or cards never resizes anything; copy too long for its box fades at the edge and scrolls itself slowly (mouse wheel, touch drag or the right stick scroll it by hand). Dialogue boxes are fixed too: a line too long for the box is split into pages at a sentence or clause break, each advanced like its own line.

The title menu is PLAY, HANGAR, COLLECTION, HOW TO PLAY and SETTINGS. **HANGAR** (also on the campaign map) is one hub with SHIP · LOADOUT · FAB · PILOT · TREE · FLUX tabs; **COLLECTION** holds GALLERY and ACHIEVEMENTS.

## Campaign

Title **PLAY** opens the campaign map, then LAUNCH. A **run** flies all four systems in order with one ship: beat a system's boss and you warp straight into the next one with your build, level, hull (no free repairs: hearts drop only from bosses, usually from mini bosses and sometimes from Hunters, never from elites) and wallet. **Die anywhere and the next run starts again at Genesis**, so the Hangar, Pilot and banked credits are how you get further each time. Each system is a map of 8 rows plus a boss. The campaign map shows the furthest point any run has reached.

| # | System | Boss | Sectors | Notes |
|---|---|---|---|---|
| 1 | NEON GENESIS | WARDEN | 9 | Learn the ropes |
| 2 | CRIMSON TIDE | HYDRA | 9 | Carriers, shielders |
| 3 | CYAN CYCLONE | OMEGA | 9 | Weavers, blinkers |
| 4 | THE VOID | ECLIPSE | 9 | Final system |

- **Map.** Slay the Spire style: six paths climb a 4-wide grid without crossing, splitting and merging, and you may only jump along a link. Row 1 is always a fight, the middle row is a **Treasure Vault**, the row before the boss is a **Rest Station**, and every map has a Market. Elites, shops, rests, vaults and rifts never come twice in a row on one path. Only the nodes you can reach next are labelled.
- **Overworld.** Between nodes you fly through open space with your whole loadout: main gun, modules, dash and ultimate all work out here. Each leg of the route is its own large zone; the next nodes are exits hidden somewhere up ahead (up, up-left or up-right), and you have to find them. Fly into an exit and hold (or press Enter / A) to jump in; picking one closes the others, and the next leg is a new zone. The card above the gauges shows what an exit holds: reward, hazards, hostiles, zones and threat (or what a stop does). Packs of the levels' own enemies sleep around the zone and wake when you get close, stragglers roam in the longer you take, and debris fields block ships and shots, so you can fight through or run past. The ship auto-aims: it turns to the nearest awake enemy in range while you steer anywhere (sleeping packs are left alone so you can sneak past), and faces where it flies when nothing is near. Hold **Shift** / a pad shoulder / touch **BOOST** to fly faster using the regular boost meter; releasing it lets the meter recharge. Boost keeps normal auto-aim, and a pad's right stick aims manually. Steering: WASD / stick, drag on touch. **M** / Tab / Select / the MAP button opens the zone map (fogged until you fly through it) with the system route under it. Sites: **Salvage** (credits), **Data Cache** (XP), **Repair Beacon** (+1 hull), **Guarded Cache** (clear its elite guards first) and **Distress Signal** (an anomaly). Pause still has ABANDON / EXTRACT.
- **Fight rewards.** Every combat node shows (a coloured dot, and a tag when reachable) what it pays on top of its sector draft: **OFFENSE**, **DEFENSE** or **MODULE** (the draft only offers that category; Defense also repairs 1), **CACHE** (a credit cache), **HULL** (+1 max hull), **BOOST** (+1 level to an upgrade you own). Elites pay **2 DRAFTS**.
- **Stage views.** Top-down is the main view, but now and then a fight flies one of its later zones from another camera, switching mid fly-through. **SIDESCROLL**: the jet faces right and threats come in from the right; up / down steer, the jet holds the left half of the screen, and neon terrain closes in from above and below (scraping it costs hull). **PURSUIT**: the camera sits behind and above the jet and everything comes out of the distance toward you; you hold the near lane, and laser gates rush in that you have to fly through the gap of (missing costs hull, threading one charges the ult a little). Most fights past the first row (60%, elites 80%, first row 35%) have such a zone, and a three-zone fight sometimes flies both later zones in other views; the exit card shows it. In PURSUIT the ships stand up off the floor like paper cutouts that bank as they swerve, hovering over their own lit shadows; threats come down out of the sky as they close in, so the whole screen height is in play. Pursuit also runs hot: the floor rushes by near fly-through speed and threats move, fire and close 40% faster. Boss variants: HYDRA can meet you side-on as the **Abyssal Leviathan** (orb tides with one gap, floor-to-ceiling geysers) and OMEGA from behind as **Event Horizon** (gate volleys, lanes that light up along the floor); each arena rolls its variant 65% of the time.
- **Capital ship assault.** Every system has one **ASSAULT** node on a late row (6 or 7), the trench run. It opens on a **HULL RUN** in SIDESCROLL along a capital ship's belly, drops into **THE TRENCH** in PURSUIT (walled in, with laser gates coming faster than usual), then flies down to the **REACTOR CORE**: a mini boss with spinning plasma spokes, blast shutters slammed across the trench, vent bursts and drone launches, on a 45 s countdown. Crack it in time and the ship blows up behind you as you escape, paying a credit jackpot and two drafts at elite rarity. If the clock runs out the core seals, and you pull out with the sector draft only. Tuning: `CORE_TIME` / `ASSAULT_GATES` in director.js, `coreHp` per system in campaign.js.
- **Node types:** **Combat**, **Elite** (a Hunter mini-boss late in the sector), **Assault**, **Market**, **Rest**, **Anomaly**, **Vault**, **Rift** and the **Boss**.
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

Ships are bought with credits in the **Hangar** (title menu or campaign map -> HANGAR), or granted free when you reach the legacy unlock goal. **SHIP** is the ship select: browse every hull with its base stats, buy or pick it, and preview / buy paint on the hull. **LOADOUT** fits the active ship's CORE, PLATING and THRUSTERS gear, with the same stat bars showing what the gear adds (green) or costs (red).

Every ship spends the same stat budget (roughly: 1 hull = 3 damage/s, 1 dash = 2, +0.1 speed = 2; base damage sits at 20-23/s except HALO, which pays in damage for its module bay) and carries a **trait**.

| Ship | Style | Hull | Price | Free unlock |
|---|---|---|---|---|
| VECTOR | Twin pulse cannon, balanced. Trait: +1 reroll every run, +10% XP | 3 | owned | - |
| NEEDLE | Piercing lances, fast, glass cannon. Trait: each enemy pierced adds +20% to that shot | 2 | 600 | Defeat any boss |
| BULWARK | Short-range homing scatter, starts with a shield. Trait: shield breaks knock enemies back | 4 | 900 | Fight 5 sectors in one run |
| PHANTOM | Seeking crescents, 3 dashes, quick ultimate. Trait: every dash charges the ultimate | 3 | 1400 | Fight 8 sectors in one run |
| CORSAIR | Ricochet bolts that bounce off the side walls. Trait: ricocheted bolts +25% | 3 | 1100 | - |
| MONOLITH | Siege: slow, huge piercing charge orbs. Trait: armored enemies take +30% | 5 | 1600 | - |

### Gear parts

Three slots per ship: **Core**, **Plating**, **Thrusters**. Gear is loot (Fabricator rolls, elite and boss drops) with a rarity and an item level; each base has one tradeoff. Gear can only be changed from the campaign map, never mid-run. Paint jobs (3 per ship, 120 credits) are cosmetic.

Each slot has a job, and its random modifiers only roll from that job:

| Slot | Job | Modifiers it rolls |
|---|---|---|
| Core | How you deal damage; the **ammo cores** (Cryo, Ember, Acid, Shock) start every run with their Rounds 1, which locks your ammo | damage, fire rate, crit, pierce, module damage and rate, projectile size and speed, armor piercing, burst, ammo proc and strength, % hull |
| Plating | Survival (and loot) | hull, shield recharge, invulnerability, dodge, elite/boss damage, pickup range, XP, credits, rarity find, rerolls |
| Thrusters | Movement, graze and the ultimate | speed, dash recharge and length, ult charge and duration, graze, cell save, boost |

**Ammo proc / strength** modifiers boost whichever Rounds your run owns, and do nothing without one. Module slots come only from Expanded Bay and Conductor Core (never a random modifier). Item level adds +1.5% per level to the base effect and +3% to modifiers; Legendary bases are x1.4. Older items keep their rolls; elemental and slot modifiers from before were converted to ammo proc, ammo strength and module damage.

### Pilot classes

Open **PILOT** on the campaign map to pick a class and equip **2 passives**. Rank unlocks both.

| Class | Rank | Ultimate | Passives (rank) |
|---|---|---|---|
| STRIKER | 1 | **OVERDRIVE**: a kill window with the biggest fire rate / damage / score boost and a small 120px erase; a blast from LV2 (LV3: whole screen, vacuums shards) | Killstreak (1), Hair Trigger (2), Executioner (4), Bloodrush (5) |
| ENGINEER | 3 | **FORTRESS PROTOCOL**: the only ult that erases: a bullet-eating dome and 2-4 extra wingmen; the dome bursts at the end, harder the more it absorbed | Salvager (3), Overflow (4), Drone Link (5), Nanorepair (7) |
| GHOST | 6 | **PHASE SHIFT**: enemies and bullets slow (to 45% at LV3), faster ship and wider graze, grazes strike back harder each level; 25% / 50% dodge, LV3 intangible for its first 2.5s then 50% dodge | Wide Graze (6), Slipstream (7), Riposte (8), Afterimage (10) |

Each class's Common ability (Killstreak, Salvager, Wide Graze) comes with the class and starts equipped.

**Ultimate levels.** The ult gauge banks **cells** (ring segments). Pressing ult spends up to 3 cells and fires at that level: LV1 is a quick, short panic button, LV3 is the full ultimate. Partial progress toward the next cell is kept. Charge from kills, grazes, pickups and passive generation pauses while an ultimate is active and resumes once it ends. Cell pickups are still consumed during an active ultimate but give no charge; avoid them if you want to collect them after it ends. Routine charge gains are halved, before build bonuses, so a cell pickup gives 15 meter points at the base rate. **Reserve Cell** (level-up card) banks up to 2 more cells, shown in white, for a quick follow-up cast (5 max). **Cell Recycler** (card), the Overdrive gear modifier and the Surge Capacitor tree notable give a chance that each spent cell is saved (50% max). Level 2 runs for 80% of the ult duration and level 1 runs for 60%. Ult duration caps at 10s at level 3, counting every bonus together (Bloodrush included).

### Passive tree

**PILOT → PASSIVE TREE** opens each class's own node wheel (64 nodes). You earn **2 points per Pilot Rank**, plus 1 per level of the Flux Core's **Neural Expansion** (up to +10). Start at the class core and spend points on linked nodes, working outward through six themed wedges that match the gear build paths (Firepower, Crit, Modules, Mobility, Overdrive, Graze, Tank, Greed). Most nodes are small stat bumps. Each wedge has notables and ends in a class-specific **keystone** that changes the rules (Glass Cannon, Swarm Doctrine, Shadow Strike...), and link nodes join neighbouring wedges for hybrid builds. Refunds are free at any time: click an allocated node (if nothing past it depends on it) or REFUND ALL. Drag to pan; wheel, pinch or +/− to zoom; arrows walk the nodes with keys or a pad.

| Class | Big wedges | Small wedges |
|---|---|---|
| STRIKER | Firepower, Crit, Overdrive | Mobility, Greed, Tank |
| ENGINEER | Modules, Greed, Tank | Firepower, Crit, Overdrive |
| GHOST | Mobility, Graze, Crit | Overdrive, Greed, Firepower |

## In a run

- **Level ups vs rewards.** Enemies drop XP shards. Each level offers a small draft that tunes what you already fly: +1 to a stat or defense (owned or new), or a **Tune** (one small run modifier from your build paths). New tech, module levels, rarity and evolutions come from **reward** drafts: clearing a sector (elites a bit luckier), a boss (every card Uncommon or better, rarer rolls), and a vault. A run has no opening draft: you launch with the bare ship, and the first draft is your first level-up.
- **Main Cannon.** Never drafted: it gains a level for each system's halfway mini boss and each boss, reaching its max at the Void's mini boss.
- **Mini bosses.** Each system's halfway Vault is guarded by one of six mini bosses (Razorwing, Mauler, Broodmother, Specter, Arclight, Citadel). Beat it for the Main Cannon level, then the Vault opens.
- **Specialization.** Every upgrade level counts toward its build path. The first two paths to reach 5 levels lock in as your specializations, with a mastery bonus at 5, 10 and 15 levels; after that the other paths share 10 splash levels.
- **Fortune.** A draftable Greed stat (the Fortune card, max 3), also rolled on Rare+ plating, granted by the Prospector tree notable and the MAGNATE's trait. Every reward draft gets +0.25 luck per point, and one card in it is at least Uncommon / Rare / Epic / Legendary at 1 / 3 / 5 / 7 Fortune. Level-ups are unaffected, and drafts can't be skipped. Rerolls: 3 per run, +1 every 5 levels and +1 per boss kill (more from Greed gear, the Prospector tree notable and the Flux Core). Lock a card (lock icon, `F`, or X on a pad) to keep it through a reroll.
- **Build.** Main cannon, stats (damage, fire rate, crit, pierce, speed, magnet, capacitor), defenses (hull, regenerating Aegis shield, extra dashes) and up to **4 weapon modules** (more from Overflow, Halo, the tree and gear, never more than 6).
- **Exclusive families.** Some cards rule others out for the rest of the run, and the card says which. **Ammo** (Cryo / Incendiary / Corrosive / Shock Rounds): pick one. Shock Rounds builds charges; at 5 an enemy discharges and arcs into 2 neighbours (Overcharge: +1 arc, +25%). **Trick shots** (Overload Primer, Splinter Shells, Resonance Coil, Sunder Tips): two at most. **Barrier** (Razor Orbit, Reflector, Shock Dash, Gravity Well, Shield Plates): one bullet-erasing module. Flamethrower, Glacial Spike, Caustic Slag, Arc Coil and Tesla Pylons deal +30% when your ammo matches their element (Arc Coil and Pylons: Shock).
- **Barrier budget.** Barrier erases never speed up with fire rate, and heavy shots (big orbs, torpedoes, fuse shells, shootable shots) can't be erased, only slowed or shot down. An orbit blade rests 0.6s after eating a bullet; a Reflector pulse returns 8-12 bullets at 60% of the old damage, then fades; a Gravity Well crushes 8-16; Shock Dash erases once a second; Supernova's ring wipe once every 3s.
- **Status and effect cards.** Wide Bore / Accelerator Coils (projectile size, speed), Hyperflow (faster battle for score and credits), Lucky Dodge, Armor Piercing, Burst Fire, Cryo / Incendiary / Corrosive Rounds (stacking chill, burn, armor loss; each has a potency follow-up that only appears once you own it), Resonance Coil (every Nth hit detonates) and Sunder Tips (% max hull per hit). Armored enemies (tanks, carriers, hunters, elites, bosses) take less damage until you pierce or corrode it.
- **Combo.** Kills chain into a score multiplier (up to x8). Getting hit breaks the chain.
- **Graze and ultimate.** Skimming bullets and killing fills the ult meter. Every ultimate raises your score multiplier while it lasts (Striker up to x2, Engineer and Ghost up to x1.5).
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
| Flamethrower | Continuous sweeping flame cone that applies stacking burn (Crimson) |
| Glacial Spike | Heavy piercing ice spikes that shatter into chilling blasts (Crimson) |
| Drone Swarm | Autonomous interceptors that sortie from your hull, strafe, and recharge (Cyclone) |
| Caustic Slag | Volatile acid canisters that detonate into lingering armor-shredding pools (Cyclone) |
| Shield Plates | Tank barrier: plates orbit you, each blocks one bullet then recharges |
| Wake Blades | Mobility: a cutting trail behind the ship, twice as sharp while boosting or dashing |
| Salvage Drone | Greed: fetches drops, rams enemies; its kills drop a credit chip |
| Marksman Drone | Crit: snipes the toughest enemy, every shot crits (Crimson) |
| Harpoon | Firepower: heavy homing spear at the toughest enemy (Crimson) |
| Sentry Turret | Plants turrets that fire for 8s (Crimson) |
| Tesla Pylons | Pylons linked by lightning beams, the newest to your ship from level 3 (Cyclone) |
| Capacitor Bloom | Overdrive: a shot ring that grows with your ult meter (Cyclone) |

**Evolutions.** Max a module (level 5) while owning its partner stat and a gold **EVOLVE** card can appear in drafts: Swarm Missiles + Targeting AI = **Hellfire Swarm**, Razor Orbit + Thrusters = **Storm Halo**, Arc Coil + Capacitor = **Tesla Storm**, Pulse Nova + Plasma Core = **Supernova**, Wingmen + Overclock = **Phalanx**, Rail Lance + Phase Tips = **Annihilator**, Reflector + Aegis Shield = **Mirror Storm**, Gravity Well + Tractor Field = **Event Horizon**, Shield Plates + Reinforced Hull = **Citadel Plates**, Wake Blades + Afterburner = **Comet Trail**, Salvage Drone + Prospector = **Scrapper Swarm**, Marksman Drone + Culling Edge = **Deadshot**, Harpoon + Bounty Hunter = **Leviathan**, Sentry Turret + Accelerator Coils = **Sentry Net**, Tesla Pylons + Static Discharge = **Storm Grid**, Capacitor Bloom + Reserve Cell = **Overbloom**. Evolutions take no module slot and are never sold in the Black Market.

### Tech tiers and discovery

The level-up pool grows as a run goes deeper. Genesis drafts from the core set. Reaching Crimson, Cyclone and the Void each adds a tier of rarer tech (Rail Lance, Reflector, Gravity Well, the new modules above, and perks such as Overload Primer, Culling Edge, Second Wind, Echo Fire, Static Discharge, Perpetual Engine and Null Field). Seeing an option in any draft, Black Market or smuggler beacon **discovers** it: from then on it can turn up from Genesis in every later run. Cards mark the difference: a white **NEW DISCOVERY** flag and white frame for tech never seen before, and a **NEW THIS RUN** flag for tech you know but don't own in the current run. Saves that had already played keep everything that existed before tiers, so nothing they could draft goes missing.

### Enemies and bosses

- **Core roster:** darts, swarms, spinners, dashers, snakes, snipers, tanks, splitters, mines.
- **Later systems:** **Carriers** (launch swarm pods), **Shielders** (shield their neighbours until killed), **Weavers** (a pair joined by a lethal laser tripwire), **Blinkers** (teleport and fire a ring), and on Elite nodes the **Hunter** mini-boss.
- **WARDEN** (siege mech), **HYDRA** (bio-leviathan), **OMEGA** (core intelligence): three phases each. Campaign boss HP is tuned per system.
- **ECLIPSE** (system 4 only): a dark mirror with mirror fans, rings, telegraphed dash-lane beams and shockwaves. Its last phase copies **your** class ultimate (Dark Overdrive, Dark Fortress with two turrets and an invulnerable dome, Dark Phase).

Best score, unlocks, credits, rank, gear and settings persist in `localStorage` (profile v3; v2 saves migrate and corrupt saves are sanitised).

## Gallery and achievements

**GALLERY** (title menu -> COLLECTION) holds 30 **relics** in five themed sets of six: GRID ORIGINS, BIO BLOOM, DATA STORM and EVENTIDE (one per campaign system) and GRID JUNK (a small share of finds in any system). Each set has 3 commons, 2 rares and a legendary.

- **Buy** commons (150) and rares (350) in the Gallery, or open a **Data Capsule** (180) for a random common or rare you don't own yet.
- **Find** them in the field: any kill has a tiny chance to drop a golden relic cache (elites 4%, Hunters 20%, bosses 35%). It drops a relic from the set of the system you're flying, preferring ones you don't own. **Legendaries are field finds only.** Finds are kept even if you die.
- Completing a set pays a 250 credit bonus.

**ACHIEVEMENTS** (COLLECTION, second tab): 44 achievements in four tabs (Combat, Skill, Career, Oddities), some hidden behind a one-line hint until unlocked. Each pays credits (bronze 20, silver 60, gold 150). Unlocks, relic finds and set completions pop a small toast at the top of the screen. Older saves get what they already earned on first load.

## Settings

Music / SFX volume, screen shake, screen flashes, damage numbers, story dialogue, replay intro, fullscreen, reset progress.

The first boot plays a short, skippable in-engine intro (ECHO's squadron falls at the Genesis gate, MAG wakes ECHO, one burst of combat) before the title menu; any key arms the skip, a second press (or Esc) skips.

## Project layout

```
index.html            markup for canvas + DOM menus
src/main.js           boot, layout, main loop, game flow (title -> campaign -> overworld -> run -> draft/pause -> results), NEON debug hook
src/style.css         menu / HUD-overlay styles
src/core/             math (+ seeded PRNG), input (kb/touch/gamepad, mouse for menus), audio (synth SFX + music), storage (profile v3)
src/render/           baked glow sprites (ships, enemies, gear, portraits), per-system backgrounds, canvas HUD
src/game/state.js     global state G
src/game/player.js    ship, firing, dash, ult hookup, hit handling
src/game/pilot.js     classes, ultimates, passives, Phase Shift time scale
src/game/tree.js      passive trees (per-class node wheels, points, refunds, keystones)
src/game/modules.js   weapon modules, evolutions, beams
src/game/enemies.js   enemy roster and AI, Hunter, damage / kill
src/game/status.js    shared combat systems: enemy armor, freeze / burn / corrode stacks, hit-count detonation, % hull damage, burst fire
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
src/ui/screens.js     menu navigation (rows, tabs, button prompts, hub headers), draft cards, results
src/ui/meta.js        campaign / route / market / dock / event / extraction screens
src/ui/hangar.js      Hangar SHIP select (hulls, paint) and LOADOUT (gear), inventory, Fabricator
src/ui/hub.js         where the HANGAR / COLLECTION hubs return on BACK
src/ui/wells.js       fixed-height description boxes that scroll long copy (tools/menu_layout_audit.mjs checks every menu for shifts)
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

## Background art workflow

All four systems have generated horizon and floor layers for top-down, side-scroll, and pursuit views. Runtime PNGs live in `src/assets/backgrounds/`; originals, prompts, hashes, and review captures live in `art/backgrounds/`. Each theme falls back to procedural scenery until its complete image set has decoded.

Use the repository skill at `.agents/skills/neon-background-assets/SKILL.md` for new or revised art. Serve this directory locally and open `/tools/background-preview.html` to compare themes, cameras, dense waves, bosses, and boost without changing the real save. The preview also accepts `?theme=void&view=chase`.

Run `node --test tools/test_background_layers.mjs` for renderer checks. `tools/background_assets.py` validates PNG alpha and tile edges and exports with nearest-neighbor scaling; it does not generate or retouch art.

## Item artwork workflow

All generated artwork follows [shared art direction and process](art/STYLE.md). Use [neon-game-art](.agents/skills/neon-game-art/SKILL.md) for ships, portraits and icons; scenery follows the background skill.

The player fleet uses generated top-down, side and pursuit hulls from `src/assets/ships/<id>/`, with procedural loading/failure fallbacks and cached paint variants. [Ship artwork records](art/ships/README.md) link the workflow; each ship's manifest preserves source masters, exact prompts and measured cannon/engine anchors. Open `/tools/ship-art-preview.html` to compare all ships and cameras, native-size readability, paint, pixel look and live firing alignment. Its game preview uses in-memory storage. Run `node --test tools/test_ship_art.mjs` for provenance, paint, attachment geometry and fallback checks; `python3 tools/ship_assets.py <source> <new-runtime-path>` makes a versioned 256px RGBA export, and `python3 tools/ship_assets.py art/ships/<id>/manifest.json --manifest` validates the selected set.

Regular enemy hulls use generated top-down, side and pursuit views from `src/assets/enemies/<id>/`, with a procedural fallback for each camera until its hull and required layers decode. [Enemy artwork records](art/enemies/README.md) preserve source masters, prompts, registered component sheets and export hashes. Open `/tools/enemy-art-preview.html` to compare all subjects at native and enlarged scale, inspect hit flashes, elite rings, opacity, pixel look and backgrounds, and check a live sandbox with isolated save storage. Run `node --test tools/test_enemy_art.mjs` for roster, camera selection, loader fallback and asset provenance checks; `python3 tools/enemy_assets.py --manifest` exports discovered masters and updates manifests and the runtime registry.

The four main bosses use generated camera-specific bodies and separate animated components, with procedural loading/failure fallbacks. [Boss artwork records](art/bosses/README.md) document selected revisions, measured mounts, prompts and hashes. Open `/tools/boss-art-preview.html` for all cameras, phase colors, flashes and isolated live encounters. Run `python3 tools/boss_assets.py` to reproduce exports and `node --test tools/test_boss_art.mjs tools/test_boss_images.mjs` for validation.

Minibosses and physical weapon modules have their own camera artwork, preserving animated combat effects and procedural fallbacks. [Miniboss records](art/minibosses/README.md) and [module records](art/modules/README.md) retain originals, prompts, selected revisions and registration. Open `/tools/mini-art-preview.html` or `/tools/module-art-preview.html` for isolated live review. Run `python3 tools/physical_art_assets.py` to reproduce their registered exports and `node --test tools/test_mini_art.mjs tools/test_mini_images.mjs tools/test_module_art.mjs tools/test_module_images.mjs` to validate them.

Generated gameplay icons live in `src/assets/icons/` (upgrades, pilots, items and choices). Source masters and prompts are preserved in the matching `art/icons/` directories. The shared `src/ui/asset-icons.js` renderer supports both menu markup and overworld Canvas icons, retaining the original SVG as an image-load fallback.

Serve the repository and open `/tools/icon-preview.html` to inspect exported artwork at several sizes, or `/tools/icon-ui-preview.html` to check the actual game definitions in production card styles and compare original glyphs. `/tools/icon-live-preview.html` opens real drafts, pilots, gear and the overworld map. Both game previews use in-memory storage.

Pixel mode keeps menu image icons at 48×48, hangar ship previews at 64×64, and character portraits at 96×96. Headings and buttons use Pixelify Sans; reading text retains Rajdhani. The live artwork preview includes a mode toggle and character dialogue. Generated ECHO, MAG and SIGNAL portrait masters and prompts live in `art/portraits/`; runtime PNGs live in `src/assets/portraits/`. Run `node --test tools/test_menu_art.mjs` to check preview sizing and portrait fallbacks.

The Fabricator, Black Market and Rest Station use generated location scenes with normal/pixel exports. [Location artwork records](art/locations/README.md) preserve originals, exact prompts, crop measurements and hashes. Open `/tools/location-art-preview.html` for isolated live menus and rolling ship-part reveals; all preview save changes stay in memory.

Use the imagegen skill for individual transparent assets, following `art/icons/brief.md`. Export 256px RGBA runtime PNGs; keep labels and rarity frames in the UI. Run `node --test tools/test_icon_images.mjs` for Canvas loading and fallback checks.

## Desktop app and releases

The web build stays the source of truth; the desktop app wraps it unchanged.

- **Web:** GitHub Pages already serves `main` (branch deploy), so every merge is live. On https the site registers `sw.js`, so phones can "Add to Home Screen" and play fullscreen, offline for whatever they've already loaded.
- **Desktop:** `desktop/` is a thin Electron shell (bundled Chromium, so WebGL and the Gamepad API behave the same on Windows, macOS, Linux and Steam Deck). It serves `index.html` + `src/` from a private `app://neon-overdrive` origin, so saves persist in the app's own storage (separate from the browser's). It starts fullscreen (F11 or Settings → Fullscreen toggles) and adds QUIT to the title menu.
- **Release:** `git tag v0.2.0 && git push origin v0.2.0`. `.github/workflows/release.yml` builds the Windows installer, macOS dmg/zip (universal) and Linux AppImage, uploads them to a draft release and publishes it once all three finish. Running the workflow by hand builds test artifacts without publishing.
- **Updates:** installed apps check GitHub Releases on launch, download in the background, toast "UPDATE READY" and install on quit. Builds are unsigned: Windows shows a SmartScreen prompt on first install and macOS needs right-click → Open; macOS auto-update needs an Apple Developer ID to work.

Run the app locally: `cd desktop && npm install && npm start` (`NEON_WINDOWED=1` for a window). `npm run dist` builds for the current OS into `desktop/dist/`.

## Debug drawer

On desktop, click the quiet **DEV** tab at the bottom-right edge, or press the backtick key (\`). The game keeps running while the drawer is open; Escape closes it. **Freeze gameplay** stops the world without opening the pause screen, while music and debug controls remain active. It stays frozen after closing the drawer until **Resume gameplay** is pressed; a new run or return to title clears the freeze. Its collapsible groups expose campaign/system launches, endless and encounter tests, camera switching, autopilot and simulation, upgrades and drops, progression grants, screen previews and artwork tools. Keyboard Tab/Shift+Tab navigate controls; gamepad up/down navigates, left/right changes selectors, A activates and B closes.

**Progression → Unlock everything** saves all ships and paints, pilot classes and abilities, upgrade discoveries, relics, achievements and Overdrive tiers. It supplies max pilot rank, enough points to fill each passive tree, credits and Flux. Allocation, equipment and current run upgrades remain build choices; use the upgrade and gear controls to test individual items. Flux Core levels have no maximum.

The first unlock stores a backup in this browser. **Restore pre-unlock progression** restores that snapshot, including records and inventory, and returns to the title; current settings are kept. Repeated unlocks preserve the first backup. Live-run progression changes take effect on the next launch; reopen progression screens to refresh their contents. The drawer is hidden for touch-only devices. The console equivalents remain available through `NEON`, including `NEON.debug.open()`, `NEON.debug.unlockEverything()` and `NEON.debug.restoreProfile()`.

Run `node --test tools/test_debug_profile.mjs tools/test_ultimate_charge.mjs` for progression restoration and ultimate-meter checks.

## Performance notes

- All glow is baked into offscreen sprites once; nothing uses `shadowBlur` per frame.
- Capped pools for enemy bullets (650), player bullets, pickups and particles (900, scaled by quality).
- Variable-rate simulation sub-stepped at <= 1/60 s, so it is smooth on 60/120/144 Hz displays.
- Adaptive quality: sustained slow frames lower render resolution and particle count automatically.
- The headless autopilot simulates a full campaign system in a couple of seconds (see [AGENTS.md](AGENTS.md#validation-and-debugging)).

See [AGENTS.md](AGENTS.md) for agent onboarding, working constraints, and a debug simulation example. The full `window.NEON` hook is defined in `src/main.js`.
