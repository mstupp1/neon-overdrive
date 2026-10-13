# AGENTS.md — NEON OVERDRIVE

## Getting started

NEON OVERDRIVE is a browser shooter built with vanilla JavaScript ES modules
and HTML5 Canvas. There is no build step or dependency installation.

Serve the repository root; ES modules cannot load from `file://`:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. See [README setup](README.md#run-it) and
[project layout](README.md#project-layout) for orientation.
Use Context7 for version-specific documentation and code examples.

## Architecture and constraints

- Shared mutable world state lives in `G` in `src/game/state.js`.
  `src/main.js` coordinates boot, the main loop, and game flow.
- Persisted progression and settings live in `profile` in `src/core/storage.js`.
  Preserve existing saves, defaults, sanitization, and migrations when changing it.
- Use logical coordinates, not CSS or device pixels. The normal playfield is
  450 units wide; height depends on aspect ratio. Overworld and alternate cameras
  use different bounds: follow existing `inField` / `playfieldBounds` helpers and
  stage-view transforms rather than hardcoding screen bounds.
- Bake expensive glow into cached sprites. Keep per-frame rendering lightweight
  and respect existing pool limits and adaptive quality.
- Follow existing module boundaries; consult the relevant source for current
  behavior instead of copying feature details into this guide.

## UI conventions

- Preserve responsive menu fitting and keyboard, gamepad, mouse, and touch input.
  Check narrow portrait layouts and safe-area insets when changing screens.
- Reserve space for conditional text so menus do not jump as content changes.
- Keep thin neon borders and nearly square corners. Do not add corner brackets
  or `clip-path` cut corners to containers.
- Reuse existing focus, navigation, and tooltip behavior for new controls.

## Validation and debugging

For behavior changes, serve the game and smoke-test the affected flow in a
browser. Check the console for errors; for UI changes, check layout and input.
Run existing tests relevant to the changed subsystem:

```sh
node --test tools/test_background_layers.mjs
node --test tools/test_icon_images.mjs
```

`window.NEON`, defined in `src/main.js`, exposes live state and debug helpers.
A quick sandbox simulation in the browser console:

```js
NEON.startRun('vector');
NEON.G.autopilot = true;
NEON.simulate(60);
```

`startRun` starts the debug endless sandbox; `NEON.launch()` starts a campaign.
Simulations advance gameplay but do not replace visual or input checks.
Consult the hook implementation for other commands. Report relevant checks
and any validation you could not perform. Documentation-only edits need no
gameplay tests.

## Specialized workflows and documentation

- Music changes: follow [music-pipeline](.agents/skills/music-pipeline/SKILL.md).
- Background changes: follow [neon-background-assets](.agents/skills/neon-background-assets/SKILL.md).
- Other artwork: see [README artwork guidance](README.md#item-artwork-workflow).
- Keep this guide short and limited to durable working instructions.
  Put feature explanations in the README and implementation details near the
  relevant source; do not add rosters, balance tables, or exhaustive API lists.
