# Genesis background pilot

Built with the built-in imagegen tool on 2026-10-12, using the actual pixel-mode gameplay screenshot in `references/baseline-combat.jpg`. The gate became the shared material/palette reference for all four subsequent layers. Exact prompts, original generator paths, source/export sizes, and hashes are recorded in `manifest.json`; selected originals are preserved in `sources/`.

The visual target is the game's near-black navy glass, restrained blue/cyan structure, and sparse magenta windows. Strong neon and white cores remain reserved for combat. Fine pixel clusters must survive the roughly 360-pixel-wide final presentation. No generated ships, enemies, effects, grid lines, HUD, targets, or collidable scenery are included.

## Layer contract

| Layer | Runtime PNG | Logical placement | Motion / opacity |
| --- | --- | --- | --- |
| Gate | 720×480 RGBA | 360×240, centered, bottom at horizon + 6 | 3 px sway, 0.72 alpha |
| Far skyline | 720×480 RGBA | 500×140, same baseline | 6 px sway, 0.66 alpha |
| Near skyline | 720×480 RGBA | 510×90, same baseline | 9 px sway, 0.78 alpha |
| Far industrial deck | 360×360 RGBA | Perspective ground texture, 3 repeats over floor depth | Grid travel phase, 0.42 alpha × distance fade |
| Near conduits | 360×360 RGBA | Perspective ground texture, 2 repeats over floor depth | Same grid travel phase, 0.58 alpha × distance fade |

The horizon remains at 12% of logical height. The gate keeps its source aspect ratio and extends above the viewport, like the former procedural ring. Dark industrial detail stays along the outer lanes; the center is transparent. Both deck exports have completely transparent top/bottom rows and clean repeated joins. The runtime images total approximately 1.1 MiB; the game loads/decodes them once and only switches from procedural Genesis after the complete set is ready.

## Review and reuse

Serve the repository, then open `tools/background-preview.html`. Its iframe copies the save into in-memory storage before loading the game; test runs cannot overwrite real progress. Compare procedural/generated art, waves, dense fire, Warden, boost and pause. Sources and screenshots do not load in production; only `src/assets/backgrounds/genesis/` does.

Five focused Node tests passed, including partial-set rejection, image/decode failures, perspective geometry, source bounds, shared ground travel, canvas state restoration, and preview storage isolation. A fractional-phase regression exercises 1,000 scroll positions to prevent zero-progress loops at texture wraps. The skill passed its bundled validator and an independent export/tile-preview exercise. All five runtime assets passed alpha checks; both deck exports passed strict clear-edge checks. Screenshots are retained in `references/` and tile previews in `previews/`.

The second renderer pass projects the same source art onto the visual grid instead of scrolling fixed-size rectangles down the screen. It uses the grid's quadratic depth and horizontal convergence, so details get larger and travel outward as they approach the ship. Both layers share the grid phase and boost rate. Higher opacity makes the industrial floor visible, with far-distance fading to keep the horizon calm. Existing grid deformation and live lighting still draw over the floor.

After projection, local background CPU submission medians were approximately 0.050 ms procedural and 0.150 ms generated. Frozen-scene frame pacing was unchanged at 8.30 ms median and 9.10 ms p95. These measurements are refresh-limited and do not establish GPU cost, performance on phones, or full-combat FPS. The preview benchmark uses small draw batches to keep this more detailed renderer's workload bounded.

This pilot covers Genesis top-down backgrounds. The other systems, side/chase cameras, overworld scenery, obstacle skins, and making pixel mode permanent remain separate work. Use `$neon-background-assets` for subsequent background tasks, preserve original sources, and revise individual layers with the existing screenshots and gate as references.


## Camera extension

The selected Genesis source art now also serves side-scroll and pursuit backgrounds. Side bands scroll horizontally with `bg.scroll`; pursuit floor detail shares the camera's reciprocal projection and `floorRun` phase. The pursuit horizon is scaled to its shallow sky and clipped above the floor. The current preview includes all four systems and all three cameras; the original pilot validation above remains historical.
