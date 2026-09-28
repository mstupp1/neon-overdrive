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
| `toTitle()` | Back to title/attract mode |
| `applyUpgrade(id)` | Grant an upgrade (ids in `src/game/upgrades.js`) |
| `simulate(seconds, pickFn?)` | Fast-forward synchronously at 60 Hz, auto-picking drafts (`pickFn(choices) → id`). Returns a summary. |

Set `G.autopilot = true` to let the built-in bot (`src/game/bot.js`) fly a real run; `G.player.god = true` for invulnerability.

Example balance check:

```js
NEON.startRun('vector'); NEON.G.autopilot = true;
NEON.simulate(600); // → { screen, sector, hp, level, score, time }
```

## Useful state

- `G.screen`: `title | ships | help | settings | play | pause | pause-settings | draft | gameover`
- `G.mode`: `attract` (bot demo behind menus, SFX muted) or `run`
- `G.player`: `x, y, hp, maxHp, shield, charges, od (0–100), odT, level, xp, up {id: level}, st {derived stats}`
- `G.enemies` (`type, x, y, r, hp, elite, parts?`; bosses have `boss: true, phase, state`), `G.boss`
- `G.eBullets` (`x, y, vx, vy, r, type`), `G.pBullets`, `G.pickups`, `G.beams`
- `G.director`: `state (intro|waves|clearing|warn|boss|bossDown|clear|await)`, `progress`, `diff`
- `G.sector`, `G.loop`, `G.score`, `G.combo`, `G.kills`, `G.grazes`

## Driving input programmatically

`input` (`src/core/input.js`, also `NEON.input`): call `input.press('dash' | 'od' | 'pause' | 'confirm' | …)` for buffered presses; set `input.mode = 'target'` with `input.tx/ty` (logical coords) to steer toward a point.
