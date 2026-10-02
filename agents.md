# Agents Guide — NEON OVERDRIVE

The game is a set of ES modules (see README "Project layout"). All mutable world state lives on one object, `G` (`src/game/state.js`); the logical playfield is `view.W = 450` wide and `view.H` tall (depends on aspect).

## Debug / automation hook

`window.NEON` (defined in `src/main.js`):

| Member | Purpose |
|---|---|
| `G` | Live game state (see below) |
| `view` | Logical size, scale, safe-area insets, quality |
| `profile` | Persisted records/settings |
| `startRun(shipId)` | Start a run (`vector`, `needle`, `bulwark`, `phantom`, `corsair`, `monolith`); uses that ship's equipped hangar parts and paint |
| `startEndless(shipId)` | Alias of `startRun` (endless mode) |
| `startSpec(spec, shipId?)` | Start a run, then `startSector` with a sector spec `{index, level, loop, boss, elite, modifiers[], hue, name, duration}` (missing fields default to `endlessSpec(1)`) |
| `spawn(type, x?, y?, opts?)` | Debug: spawn an on-screen enemy (`dart swarm spinner dasher snake sniper tank splitter mine carrier shielder weaver blinker hunter`). `weaver` spawns the linked pair (`opts.gap`) and returns both nodes. Test bosses with `startSpec({boss:'eclipse', level:11, duration:3})` |
| `launch(system)` | Start a campaign run (1-based index or id: `genesis crimson cyclone void`); lands on the route screen |
| `grant({credits, rankXp, wallet})` | Add profile credits / rank XP, and/or credits to the current run wallet |
| `market()` | Current Black Market offers (array, see Economy) |
| `pickNode(i)` | On the route screen, pick the i-th reachable node |
| `campaign` | `{ SYSTEMS, generateRoute(system, seed), nodeSpec, reachableNodes }` from `src/game/campaign.js` |
| `setClass(id)` `setPassives(cls, [ids])` | Pilot class / up to 2 passives; return `''` or a reason (`RANK n`, `SLOTS FULL`). Rank-gated: `grant({rankXp: 9000})` first (rank 3 = 700 XP, 6 = 2500, 10 = 6300) |
| `buyShip(id)` `buyPart(id)` `selectShip(id)` `equip(shipId, partId)` `unequip(shipId, slot)` `paint(shipId, idx)` | Hangar actions; return `''` or a reason (`NEED n`, `OWNED`, ...). They spend profile credits, so `grant({credits})` first |
| `toTitle()` | Back to title/attract mode |
| `comms` | Dialogue overlay (`play / skipAll / clear`, `blocking`, `active`) |
| `event(id, {rng})` `pickEvent(i)` `eventState()` | Open anomaly event `id` (campaign run required), choose choice `i`, inspect the session |
| `extract()` `showBossCard(boss)` | Debug: end the campaign run now / show the boss title card |
| `applyUpgrade(id)` | Grant an upgrade (ids in `src/game/upgrades.js`) |
| `rollDraft(kind?)` | Roll a draft (`'level'`/`'sector'`) for the current player (may include an Evolution card) |
| `dropRelic(x?, y?)` | Debug: drop a relic cache (run only; default just above the ship) |
| `simulate(seconds, pickFn?, opts?)` | Fast-forward synchronously at 60 Hz, auto-picking drafts (`pickFn(choices) → id`) and route nodes (`opts.nodePick(nodes) → index`, default random fighting node). Market: buys the cheapest affordable upgrade offer (override `opts.marketPick(offers, wallet) → index | -1`), then leaves; dock: repairs if damaged else reinforces; anomaly auto-continues. Stops on `gameover` or `extract`. Returns `{screen, sector, hp, level, score, time, run:{system,row}, victory}`. |

Set `G.autopilot = true` to let the built-in bot (`src/game/bot.js`) fly a real run; `G.player.god = true` for invulnerability.

Example balance check:

```js
NEON.startRun('vector'); NEON.G.autopilot = true;
NEON.simulate(600); // → { screen, sector, hp, level, score, time }
```

## Useful state

- `G.screen`: `title | campaign | hangar | parts | pilot | help | settings | route | market | dock | event | comms | sector-intro | play | pause | pause-settings | draft | extract | gameover` (`comms` = a blocking dialogue between screens; `sector-intro` = the warp-in title animation when a run enters a system; the world is frozen unless `play`/`title`/menus listed in `simulating()`)
- `G.mode`: `attract` (bot demo behind menus, SFX muted) or `run`
- `G.player`: `x, y, hp, maxHp, shield, charges, od (0–100), odT, level, xp, up {id: level}, st {derived stats}`
- `G.enemies` (`type, x, y, r, hp, elite, parts?`; bosses have `boss: true, phase, state`), `G.boss`
- `G.eBullets` (`x, y, vx, vy, r, type`), `G.pBullets`, `G.pickups`, `G.beams`
- `G.director`: `state (intro|waves|clearing|warn|boss|bossDown|clear|await)`, `progress`, `diff`
- `G.sector`, `G.loop`, `G.score`, `G.displayScore`, `G.combo`, `G.comboTimer`, `G.maxCombo`, `G.kills`, `G.grazes`, `G.bossKills`, `G.runTime` (run seconds), `G.time` (sim seconds), `G.rerolls`, `G.pendingLevels`, `G.supplyLeft` (supply-drop drafts left), `G.deathT`, `G.vacuum`, `G.autopilot`, `G.enemyTimeScale`, `G.slowmo`, `G.hitstop`, `G.banner`, `G.pulse*`
- `G.run` (null in attract): `{mode: 'campaign'|'endless', system, route, row, nodeId, sectors, victory, visited[]}` plus fields reset in `newWorld`: `wallet, earned, frac, curse, ambush, bonusXp, events[]`.
- `profile` (`src/core/storage.js`, v3): `settings{music,sfx,shake,flashes,damageNumbers,story}, best, bestSector, bestCombo, bossKills, runs, kills, lastShip, seenHelp, credits, rankXp, campaign{cleared[], seenStory{}}, ownedShips[], ownedParts[], equip{ship:{slot:part}}, paint{ship:idx}, paintsOwned{ship:[idx]}, pilot{cls, passives{cls:[ids]}}, relics[], relicNew[], ach{id: timestamp}, stats{swarm, capsules}`. `load()` merges onto defaults, `sanitize()` coerces corrupt collections, a v2 save migrates once, and every storage call is wrapped in try/catch.
- Sector spec (`director.startSector(spec)`): `{index, row?, level, loop, boss, elite, modifiers[], hue, name, duration, bossHp?, pay?}`. `bossHp` multiplies the boss base HP (campaign only, per `SYSTEMS` row), `pay` scales credit values.

## Enemy roster notes (step 6a)

- TYPES in `enemies.js` (`hp` is scaled by `diff.hp`; `keep` = never despawned, `plain` = no elite roll). Beyond the originals: **carrier** (descends, hovers, launches 3 diving swarm pods up to 3x), **shielder** (tethers a shield to up to 3 nearby enemies via `e.links` / `target.shieldedBy`; `damageEnemy` takes -80% while the shielder lives; drawn by `drawShieldLinks` in world.js), **weaver** (spawned in pairs by `spawnWeavers`; the lead node owns an enemy beam in `G.beams` with `len` = segment length, `tele` 0.6s; it vanishes when either node dies; beams without `len` are 1400px rays), **blinker** (fade in, 0.5s ring telegraph, ring of 10-14, teleports to a spot >= 140px from the player via `blinkSpot`, repeats `shots` times then leaves; `e.alpha` fades, `invuln` while faint).
- Director patterns (min level): carrier 2, shielder 4, weavers 5, blinkers 6. Elite nodes (`spec.elite`) spawn one **Hunter** at progress > 0.6 (`d.hunter`, compact HUD bar, `keep`, hp = 110 x (1 + 3% x sector level), never times out the `clearing` state, pays ~3 elites of credits + heart + magnet/cell, counts for Nanorepair).
- **ECLIPSE** (`bosses.js`, campaign system 4 only, not in the endless rotation, music index 3 = "The Final Shadow"): attacks `mirrorFan ring dashLanes overdriveWave` and phase-3 `copyUlt` which dispatches on `G.player.cls` (`COPY.striker` Dark Overdrive / `engineer` Dark Fortress: 2 `eclipsedrone` turrets + invulnerable dome, max 2 casts / `ghost` Dark Phase: blinks, slows player bullets near it). Lane beams are `G.beams` entries tagged `boss: e` (removed on phase shift / death). The autopilot (`bot.js`) steers away from enemy beam segments.

## Driving input programmatically

`input` (`src/core/input.js`, also `NEON.input`): call `input.press('dash' | 'od' | 'pause' | 'confirm' | …)` for buffered presses; set `input.mode = 'target'` with `input.tx/ty` (logical coords) to steer toward a point.

## Campaign flow

Title PLAY → `scr-campaign` (select system, LAUNCH / HANGAR + PILOT pair / ENDLESS GRID + BACK pair) → `launchSystem` → `scr-route` (branching nodes) → fighting node = `startSector(nodeSpec(...))` → sector reward draft → back to route. Boss node cleared → `extract()` → `scr-extract` → campaign. Campaign death → `scr-over`, where UPGRADE SHIP (`upgrade` → `showCampaign('ship-btn')`, HANGAR focused) leads and RETRY is secondary; endless keeps RETRY first. `G.run = { mode: 'campaign'|'endless', system, route, row, nodeId, sectors, victory, visited[] }` (null in attract).

- `src/game/campaign.js`: `SYSTEMS` (`{id, name, short, act, hue, level, step, rows, dur, bossHp, supply, pay, boss, blurb}`: `level` = row-0 difficulty, `step` per row, `dur` sector seconds (boss sector x0.7), `bossHp` boss HP multiplier, `supply` free drafts at launch, `pay` credit scale, `warm` optional per-row ease for rows 0-1, default 0.9; Genesis uses 0 and starts at level 1 like endless sector 1), `generateRoute`, `reachableNodes`, `nodeLevel(system, row)` (rows 0-1 are eased in by `warm`), `nodeSpec`, `systemUnlocked`. Progress: `profile.campaign.cleared` (system ids). `launchSystem` plays the intro, then `startSupply(n)` opens `n` `'supply'` drafts (`G.supplyLeft`) before the route.
- `src/ui/meta.js`: render functions for campaign / route / route stop / extraction.
- Stops: `visitNode(node)` in `src/main.js`: market → `scr-market`, dock → `scr-dock`, anomaly → `scr-event` (`openEvent`). Every stop must finish via `nodeContinue()`.
- Extraction rewards go in `#extract-rewards` (game over: `#over-rewards`), both filled by `meta.renderRewards(el, reward, campaignDeath)`; banking happens in `extract()` / `gameOver()` via `bankRun()` in `main.js` → `economy.settleRun(victory)`.

## Economy (`src/game/economy.js`)

- `G.run.wallet` (spendable) / `G.run.earned` (total) / `G.run.frac` (rounding carry) / `G.run.curse` (modifier id added to the next fighting node, from Contraband). `gainCredits(amount, at?)` applies `diff.credits`, `p.st.creditMul || 1` (hook for passives/parts), and ×0.5 in endless; returns credits gained (0 in attract).
- Sources: `credit` pickups (`dropKillCredits` from `killEnemy`: 10% normal, 30% big, 2.5% swarm/mine; elites drop 3 × `diff.eliteCredits`), `sectorPayout()` (SECTOR CLEAR banner), `bossPayout()`. Value scale `unit()` = `(0.95*level - 0.1) x spec.pay`.
- Banking (`settleRun`): campaign victory 100% of wallet, campaign death 50%, endless death 100% of its (halved) wallet; abandoning a run banks nothing. Rank XP = `(sqrt(score)*0.08 + 20*sectorsCleared + 90*bosses + 120 (victory)) x (1 + 0.15*(act-1))` (campaign) + `run.bonusXp`.
- Pilot Rank: `rankFor(xp) → {rank, into, need}` (cap `RANK_CAP` = 15, `need` 0 at cap); `RANKS[r-1]` = cumulative XP for rank r (rank 3 = 700, rank 6 = 2500). `settleRun` returns `{earned, spent, wallet, pct, banked, total, rankXp, rankBefore, rankAfter, rankUp, victory}`.
- Black Market: `rollMarket(p, system, rng) → offers`; offer = `{id, kind: 'upgrade'|'repair'|'reroll'|'contraband', name, desc, icon, cat, tag, price, sold, blocked?, up?, amount?, hullDrawback?}`; `buyOffer(offer)` returns `''` or a reason. Prices ×(1+0.5*(act-1)).
- Max-hull tweaks go through `p.hullMod` (dock reinforcement +, contraband −), read by `recomputeStats` (min 1).
- Upgrade helper: `rollUpgradeIds(p, kind, n, rng)` in `upgrades.js` (also behind `rollDraft`).

## Pilot classes (`src/game/pilot.js`, `src/ui/pilot.js`)

- `CLASSES` = striker / engineer / ghost: `{id, name, role, color, rgb, unlockRank, desc, icon, ult:{id,name,short,desc}, passives:[{id,name,rank,desc,icon,apply?(st,p)}]}`. Profile: `pilot.cls`, `pilot.passives[cls] = [ids]` (max 2, only those with `rank <= rankFor(profile.rankXp).rank`; `activeClass()` / `equippedPassives(cls)` apply the gating, `setClass` / `togglePassive` / `setPassives` return `''` or a reason). `scr-pilot` (campaign map only, PILOT button) renders them.
- `createPlayer` calls `initPilot(p, cls, passiveIds)`: sets `p.cls` (`'striker'` for attract / no gear), `p.ucol` (class colour), `p.passives`, `p.pdm` (Killstreak damage multiplier), `p.echoes`, timers. `recomputeStats` runs `applyPassives(st, p)` right after `applyParts`: numeric passives edit `st` (`creditMul`, `grazeR`, `critMul`, `modDmg`, `maxModules`), behavioural ones set flags `st.killstreak/exec/bloodrush/nanorepair/riposte/afterimage/slipstream` checked at the hook points (`updatePilot`, `damageEnemy`, `onEnemyKilled`, director `sectorClear`, world.js graze, dash code).
- The ult replaces Overdrive but still uses `p.od` (meter), `p.odT` (time left; `st.odDur`) and the O key. `player.js activateOverdrive(p)` does the shared part (meter, i-frames, sfx, flash, floatText with `ult.short`) then `pilot.js castUlt(p)` → `ULTS[p.cls](p)` (opening effect). Per-frame effects key off `p.odT > 0` plus helpers `boosted(p)` (Striker's fire/damage boost; modules and `firePrimary` use it), `fortressOn(p)` (dome, in `domeErase(p)` called from `collide`, and 2 temporary drones in `modules.js`), `phasing(p)` (intangible: `hurtPlayer` and the bullet hit test skip, grazes still count and call `onGraze`).
- Phase Shift: `G.enemyTimeScale` (smoothed 1 → 0.4, set by `pilotTimeScale(p, dt)` in `world.js step`) multiplies the dt given to `updateEnemies` (bosses included), `updateEnemyBullets` and enemy beams. Player, player bullets, pickups and FX stay at 1; the director's wave timer (`spawnT`) is scaled too, queued spawn delays are not. Any system that moves enemy things should use that dt. `G.slowmo` is the global (hit-stop style) slow-mo and is separate.
- `G.pulse` / `G.pulseMax` / `G.pulseColor`: the ult shockwave ring. `S.dome` (Fortress dome) and `S.portrait_echo` (96 px helmet bust, for the pilot screen and later comms) are baked in `sprites.js`.
- Add a class: push a def into `CLASSES`, a `ULTS[id]` opening effect and per-frame behaviour keyed on `p.cls`; the HUD gauge (label `ult.short`, colour), pilot screen, route chips and bot already read from `CLASSES`.

## Hangar (`src/game/parts.js`, `src/game/hangar.js`, `src/ui/hangar.js`)

- Reachable only from the campaign map (`#ship-btn` → `openHangar()`); `scr-hangar` (ship carousel, 3 slot rows, paint swatches, live stat summary) and `scr-parts` (part list for one slot). Never reachable from pause/route, so gear is locked during a run. Ship selection lives here: `profile.lastShip` is the ship used by LAUNCH and ENDLESS GRID.
- Add a ship: push a def to `SHIPS` with `price` (and optional legacy `unlock`), a `SHIP_SHAPES[id]` in `sprites.js`; the hangar carousel, ownership, paint (`paintsFor`, per-ship set in `PAINT_SETS` or the fallback) and buying all follow. No price and no unlock = owned from the start. Legacy `unlock` ships still auto-grant at game over (`bankRun`) into `profile.ownedShips`; `ownsShip(profile, ship)` is the menu check (`isUnlocked` is only the legacy condition).
- Parts: `PARTS` in `parts.js`, `{id, slot, name, desc, price, icon, apply(st, p), start?}`. `createPlayer(ship, gear)` sets `p.parts` (empty in attract) and `p.color` (painted colour; use it instead of `p.ship.color` for visuals). `recomputeStats` runs `applyParts(st, p)` after upgrades and before `maxHp` is clamped to >= 1. `start: {upgradeId: lv}` grants free upgrade levels at run start (Aegis Emitter).
- New `p.st` fields (neutral defaults set in `recomputeStats`): `xpMul` (gainXp), `creditMul` (gainCredits), `grazeR` / `grazeOd` (graze radius / Overdrive per graze, world.js), `dashDur` (dash length and i-frames), `critMul` (2.5 default; world.js crit).
- Profile: `ownedParts[]`, `equip{shipId:{core,plating,thrusters}}`, `paint{shipId: idx}`, `paintsOwned{shipId:[idx]}` (0 is stock, always owned). `rebuildShipSprite(ship, color, bullet)` re-bakes one ship sprite and its primary bullet; run for painted ships on boot (`applyAllPaints`) and on paint change.

## Modules, evolutions and the newer ships (step 6b)

- Upgrade ids. Modules (`cat 'module'`, max 5): `missiles orbitals drones arc nova rail shrapnel dashNova` plus `gravity` (Gravity Well), `reflector`, `flak` (Flak Burst). Evolutions (`cat 'evolution'`, max 1, gold `CAT_COLORS.evolution`): `hellfire` (missiles + `crit`), `stormhalo` (orbitals + `thrusters`), `teslastorm` (arc + `capacitor`), `annihilator` (rail + `pierce`). A def's `mod` / `stat` fields name its prerequisites; `evolutionReady(p, u)` is true at module level 5 + stat >= 1 + not yet taken.
- `rollUpgradeIds(p, kind, n, rng, evo=false)`: evolutions only enter the pool when `evo` is true (`rollDraft` passes it; the Black Market and Contraband do not), carry weight 7 and at most one appears per draft. `cardInfo` returns `evo: true`; `renderDraft` shows an `EVOLVE` tag and the gold `.card.evo` style; `renderBuild` draws a gold `.chip.evo`. Evolutions never count towards `moduleCount`. Module code checks them with `evo(p, id)` in `modules.js`.
- `p.mod` gained `gravT/reflT/flakT`, `wells[]`, `flaks[]`, `refl/reflMax`. New-module bullet spawns respect `MAX_PBULLETS` (520). Annihilator's afterglow is a `G.beams` entry with `owner: 'afterglow'` (fixed position, ticks damage, handled in `updateBeams`/`drawBeams`, ignored by `collide`).
- `playerBullet` opts: `bounce` (reflect `vx` at the side walls that many times, `updatePlayerBullets`) and `crit` (always crits; also on missile AoE). WEAPONS `ricochet` (CORSAIR) and `charge` (MONOLITH, whose orb radius/scale grows with weapon level in `firePrimary`; a muzzle charge glow is drawn in `drawPlayer`).
- Sprites for all of this live in `buildGearSpritesV2()` at the end of `sprites.js` (`S.gwell`, `S.reflect`, `S.flak`, `S.pb_refl`, `S.afterglow`).

## Menu styling (`src/style.css`, `src/ui/screens.js`)

- Everything is sized in `em` off `#app`'s font-size (16px x playfield scale); `button { font: inherit }` keeps buttons on that scale too. Keep menu text at 0.72em or larger.
- Menus never scroll: `ui.show` calls `fit(screen)`, which shrinks the screen's font-size (down to `MIN_FIT` 0.72) until its content fits, and `ui.update` re-checks every 250 ms (content changes, resizes). Scrollbars are hidden as a last resort.
- Menus never jump: `fit` centres a screen once when it opens, then pins its top (fixed `padding-top`, `justify-content: flex-start`); re-showing the open screen keeps the pin. Lines that appear later (comms continue hint, hangar NEED / unlock lines, class text, passive and draft descriptions) have reserved `min-height`s, so add one for any new conditional line.
- Look: square (2px) corners and thin neon borders; the focused item brightens its border and glow, and buttons add a sliding arrow. No corner brackets on containers and no `clip-path` cut corners (Myles rejected both).
- How to Play is tabbed (`data-act="helpTab"`, blocks with matching `data-tab`).

## Story, events and system themes (step 7a)

- `src/game/story.js`: `SPEAKERS` (MAG cyan, ECHO class colour, SIGNAL red), `STORY` = `{prologue, systems:{id:{intro, preBoss, postBoss}}, ending}` (lines are `{who, text}`), and `EVENTS` (10 anomalies: `{id, title, color, text, choices: [] | (ctx) => []}`, choice = `{label, desc, tag?, cost?, ok?(ctx), effect(ctx) → result string}`, `ctx = {p, run, rng, scale, lvl}`). `eventFor(route, node, used)` is seeded by route seed + node id and avoids repeats via `G.run.events`; `startEvent / choiceBlocked / resolveChoice` drive the session. Effects use `p.hullMod`, `p.dmgMod` (damage multiplier read by `recomputeStats`), `G.rerolls`, `run.wallet`, `run.curse` (modifier id for the next fight), `run.ambush` (next fight is elite) and `run.bonusXp` (added to rank XP in `settleRun`).
- Story flow in `main.js`: `blockingStory(key, lines, opts, done)` (launch intro, first campaign open prologue, post-boss in `extract()`, ending after ECLIPSE) and `onBossWarn` (director `onWarn` hook: boss title card + non-blocking pre-boss lines). Seen beats are `profile.campaign.seenStory[key]`; intro / prologue / ending play once, boss pre/post lines replay one short line. `profile.settings.story` (settings toggle) turns all dialogue off.
- `src/ui/comms.js` (`#comms`): `comms.play(lines, {blocking, onDone})`. Blocking: `comms.update()` runs before `ui.update`, and while `comms.blocking` main skips `ui.update`; confirm / tap = finish line then next, back = skip all. Non-blocking: lower-middle of the field (clear of the boss entrance and the ship), auto-advances, only while `G.screen === 'play'`. Portraits: `S.portrait_echo / portrait_mag / portrait_signal`.
- Backgrounds: `bg.setTheme(systemId | null)` (set by `startSector`; one baked layer per theme, grid variant per theme), `bg.setDark(bool)` (blackout; set each frame in `main.js`, plus `.fx-vignette.dark` and enemy halos in `world.js`).
- Reactive grid (`background.js` `field`): a screen-space spring lattice (30px cells) under the floor grid. `bg.blast(x, y, size, color)` (called by every `fx.explosion`) kicks nodes outward and adds a floor light pool (`bg.light`); `bg.updateField` also pulls toward live `p.mod.wells` and pushes the band behind the ult shockwave (`G.pulse`). Grid lines are sampled through the lattice only while `field.energy > 0`; at rest the original straight/curved fast path draws. Displacement fades toward the horizon.
- Post FX: `render/post.js bloom(ctx)` runs in `main.js render()` after `renderWorld` and before the HUD. It shrinks the frame into a 1/4, 1/8, 1/16 mip chain (the 1/4 level is self-multiplied as a soft threshold), folds them into the 1/4 layer and adds it back with one full-size `lighter` blit. No `ctx.filter`. Gated by `profile.settings.bloom` (settings toggle) and `view.quality >= 0.5`.
- Cinematics (`src/game/cinematic.js`, `cine`; run mode only). **Finisher cam**: `cine.finisher(target, tier, color)` freezes on the hit, zooms onto `target` (followed while it moves) in slow motion with letterbox bars, a vignette and speed lines, then eases out. Tiers (`CINE_TIERS`, by rank): `hunter` (any Hunter kill), `node` / `elite` (the node's last kill: `onKill` from `killEnemy` while the director is `clearing`, or `lateFinisher()` when the node clears within 1.5 s of a kill), `boss` / `final` (ECLIPSE) from `bosses.js startDeath`, which hold until the boss is gone (its death throes are cut to 1.3 s). While `cine.busy` the director holds `clearing` / `bossDown`, `hurtPlayer` is a no-op and the level-up slow-down waits (an active one is dropped); `G.slowmo` is ignored. `main.js render()` zooms with `cine.camera()` (`screen = world * z + offset`, clamped to the field) by passing `k * z` to `renderWorld`, boosts bloom, draws `cine.overlay(ctx)` and fades the HUD with `cine.hudAlpha()`. `cine.update(raw)` runs at the end of `afterStep`, so `simulate` advances it too. **Node opening**: `startSector` (campaign) calls `cine.nodeStart()` (camera settles from 1.07x, bars retract).
- Beats: `banner(title, sub, color, dur, kind, kicker)`: `kind` `'start'` (node opening: `NODE n / rows`, type, modifiers; rules grow from the centre), `'clear'` (`NODE CLEAR`; rules close in from the edges), `'secured'` (system boss down: `SECTOR SECURED`, full-width band with a sweep). Plain banners (`kind` null) are the endless sandbox, HUNTER and WARNING. Drawn by `drawBeat` in `hud.js`.
- Sector intro (`src/render/sectorIntro.js`): `playSectorIntro(sys, idx, done)` in `main.js` sets `G.screen = 'sector-intro'` (world frozen), runs ~3.7 s of warp streaks → drop flash (grid blast) → per-system motif (GENESIS square lattice, CRIMSON tide bands, CYCLONE vortex, VOID collapsing rings) behind a `SECTOR 0n · ACT n` card with the scrambled-in name and blurb, then calls `done` (dialogue, supply, route). Confirm / back / dash / tap skips to the fade. `NEON.launch` skips it unless `opts.intro`; `simulate` skips it.
- Debug: `NEON.launch(sys, {story})` skips dialogue by default; `NEON.event(id, {rng})`, `NEON.pickEvent(i)`, `NEON.eventState()`, `NEON.comms`, `NEON.extract()`. `simulate` auto-skips blocking comms and picks the first available event choice (`opts.eventPick(event, session) → index`).

## Relics and achievements

- `src/game/collectables.js`: `THEMES` (one per campaign system via `system`, plus `junk` for Endless), `RELICS` (`{id, theme, rarity: common|rare|legendary, name, text, icon}`), `RARITY` (price, drop weight), `buyRelic(id)` / `openCapsule()` (return `''` / `{err}`), `rollRelicDrop(e)` (called from `killEnemy` and boss `finishBoss`; spawns a `'relic'` pickup tagged with the field theme), `collectRelic(pk)` (from `collectPickup`). Listeners: `onRelic(fn(relic, source))`, `onSetComplete(fn(theme))`.
- `src/game/achievements.js`: `ACHIEVEMENTS` (`{id, group, tier: b|s|g, name, desc, hidden?}`), `achTick(dt)` runs every frame from `main.js` and polls `G` / `profile` (screen edges, hp/dash/ult edges, director state, counters), so most achievements need no gameplay hook. Explicit hooks: `achEvent('kill', e)` (onEnemyKilled) and `achEvent('heartFull')`. `achInit()` grants what an older save already earned, silently. `unlock(id)` pays `TIERS[tier].reward` to `profile.credits`. Simulate does not run `achTick`.
- UI: `scr-gallery` / `scr-achievements` (`src/ui/gallery.js`, title menu), toasts in `#notes` (`src/ui/toasts.js`, `notify({kicker, title, icon, color, shine})`).
