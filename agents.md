# Agents Guide — NEON OVERDRIVE

The game is a set of ES modules (see README "Project layout"). All mutable world state lives on one object, `G` (`src/game/state.js`); the logical playfield is `view.W = 450` wide and `view.H` tall (depends on aspect).

## Debug / automation hook

`window.NEON` (defined in `src/main.js`):

| Member | Purpose |
|---|---|
| `G` | Live game state (see below) |
| `view` | Logical size, scale, safe-area insets, quality |
| `profile` | Persisted records/settings |
| `startRun(shipId)` | Start a run (`vector`, `needle`, `bulwark`, `phantom`) |
| `startEndless(shipId)` | Alias of `startRun` (endless mode) |
| `startSpec(spec, shipId?)` | Start a run, then `startSector` with a sector spec `{index, level, loop, boss, elite, modifiers[], hue, name, duration}` (missing fields default to `endlessSpec(1)`) |
| `launch(system)` | Start a campaign run (1-based index or id: `genesis crimson cyclone void`); lands on the route screen |
| `grant({credits, rankXp, wallet})` | Add profile credits / rank XP, and/or credits to the current run wallet |
| `market()` | Current Black Market offers (array, see Economy) |
| `pickNode(i)` | On the route screen, pick the i-th reachable node |
| `campaign` | `{ SYSTEMS, generateRoute(system, seed), nodeSpec, reachableNodes }` from `src/game/campaign.js` |
| `toTitle()` | Back to title/attract mode |
| `applyUpgrade(id)` | Grant an upgrade (ids in `src/game/upgrades.js`) |
| `simulate(seconds, pickFn?, opts?)` | Fast-forward synchronously at 60 Hz, auto-picking drafts (`pickFn(choices) → id`) and route nodes (`opts.nodePick(nodes) → index`, default random fighting node). Market: buys the cheapest affordable upgrade offer (override `opts.marketPick(offers, wallet) → index | -1`), then leaves; dock: repairs if damaged else reinforces; anomaly auto-continues. Stops on `gameover` or `extract`. Returns `{screen, sector, hp, level, score, time, run:{system,row}, victory}`. |

Set `G.autopilot = true` to let the built-in bot (`src/game/bot.js`) fly a real run; `G.player.god = true` for invulnerability.

Example balance check:

```js
NEON.startRun('vector'); NEON.G.autopilot = true;
NEON.simulate(600); // → { screen, sector, hp, level, score, time }
```

## Useful state

- `G.screen`: `title | campaign | ships | help | settings | route | node | play | pause | pause-settings | draft | gameover | extract`
- `G.mode`: `attract` (bot demo behind menus, SFX muted) or `run`
- `G.player`: `x, y, hp, maxHp, shield, charges, od (0–100), odT, level, xp, up {id: level}, st {derived stats}`
- `G.enemies` (`type, x, y, r, hp, elite, parts?`; bosses have `boss: true, phase, state`), `G.boss`
- `G.eBullets` (`x, y, vx, vy, r, type`), `G.pBullets`, `G.pickups`, `G.beams`
- `G.director`: `state (intro|waves|clearing|warn|boss|bossDown|clear|await)`, `progress`, `diff`
- `G.sector`, `G.loop`, `G.score`, `G.combo`, `G.kills`, `G.grazes`

## Driving input programmatically

`input` (`src/core/input.js`, also `NEON.input`): call `input.press('dash' | 'od' | 'pause' | 'confirm' | …)` for buffered presses; set `input.mode = 'target'` with `input.tx/ty` (logical coords) to steer toward a point.

## Campaign flow

Title PLAY → `scr-campaign` (select system, LAUNCH / SHIP / ENDLESS GRID) → `launchSystem` → `scr-route` (branching nodes) → fighting node = `startSector(nodeSpec(...))` → sector reward draft → back to route. Boss node cleared → `extract()` → `scr-extract` → campaign. `G.run = { mode: 'campaign'|'endless', system, route, row, nodeId, sectors, victory, visited[] }` (null in attract).

- `src/game/campaign.js`: `SYSTEMS`, `generateRoute`, `reachableNodes`, `nodeSpec`, `systemUnlocked`. Progress: `profile.campaign.cleared` (system ids).
- `src/ui/meta.js`: render functions for campaign / route / route stop / extraction.
- Stops: `visitNode(node)` in `src/main.js`: market → `scr-market`, dock → `scr-dock`, anomaly is still the `scr-node` placeholder (body `#node-body`, step 7). Every stop must finish via `nodeContinue()`.
- Extraction rewards go in `#extract-rewards` (game over: `#over-rewards`), both filled by `meta.renderRewards(el, reward, campaignDeath)`; banking happens in `extract()` / `gameOver()` via `bankRun()` in `main.js` → `economy.settleRun(victory)`.

## Economy (`src/game/economy.js`)

- `G.run.wallet` (spendable) / `G.run.earned` (total) / `G.run.frac` (rounding carry) / `G.run.curse` (modifier id added to the next fighting node, from Contraband). `gainCredits(amount, at?)` applies `diff.credits`, `p.st.creditMul || 1` (hook for passives/parts), and ×0.5 in endless; returns credits gained (0 in attract).
- Sources: `credit` pickups (`dropKillCredits` from `killEnemy`: 10% normal, 30% big, 2.5% swarm/mine; elites drop 3 × `diff.eliteCredits`), `sectorPayout()` (SECTOR CLEAR banner), `bossPayout()`. Value scale `unit()` = `0.95*level - 0.1`.
- Banking (`settleRun`): campaign victory 100% of wallet, campaign death 50%, endless death 100% of its (halved) wallet; abandoning a run banks nothing. Rank XP = `sqrt(score)*0.25 + 40*sectorsCleared + 120*bosses + 250 (victory)`.
- Pilot Rank: `rankFor(xp) → {rank, into, need}` (cap `RANK_CAP` = 15, `need` 0 at cap); `RANKS[r-1]` = cumulative XP for rank r (rank 3 = 700, rank 6 = 2500). `settleRun` returns `{earned, spent, wallet, pct, banked, total, rankXp, rankBefore, rankAfter, rankUp, victory}`.
- Black Market: `rollMarket(p, system, rng) → offers`; offer = `{id, kind: 'upgrade'|'repair'|'reroll'|'contraband', name, desc, icon, cat, tag, price, sold, blocked?, up?, amount?, hullDrawback?}`; `buyOffer(offer)` returns `''` or a reason. Prices ×(1+0.5*(act-1)).
- Max-hull tweaks go through `p.hullMod` (dock reinforcement +, contraband −), read by `recomputeStats` (min 1).
- Upgrade helper: `rollUpgradeIds(p, kind, n, rng)` in `upgrades.js` (also behind `rollDraft`).
