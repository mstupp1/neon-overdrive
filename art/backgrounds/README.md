# Campaign parallax art

## Free-flight overworlds

Each system also has two transparent overhead scenery layers and four solid obstacle sprites generated with built-in imagegen. Genesis uses orbital salvage, Crimson uses bio-corrupted refinery wreckage, Cyclone uses storm collectors and turbines, and Void uses fractured monoliths and alien relics. The existing landmarks sit at a distant camera depth; far/near scenery travels at separate parallax rates below the reactive grid. Solid sprites follow the original collision geometry and rotation.

The overworld briefs are in each system's `overworld-brief.md`; exact prompts and source/export provenance are appended to its manifest. Runtime exports use nearest-neighbor resizing with transparent framing (`background_assets.py export --padding`), preserving original alpha and source art. The preview's **Overworld** view supports free flight, baseline comparison, dense combat, boost, and freeze with saves isolated in memory. Run `node --test tools/test_overworld_layers.mjs` for loading, culling, parallax, and fallback coverage.

## Combat cameras

Generated with built-in imagegen. Four independent five-layer sets are used across top-down, side-scroll, and pursuit views. Each set has a landmark, far skyline, near skyline, far deck, and near deck. The new production set adds fifteen layers; the existing Genesis art is preserved.

| System | Brief | Exact prompts, sources and hashes |
| --- | --- | --- |
| Genesis | [Brief](genesis/brief.md) | [Manifest](genesis/manifest.json) |
| Crimson | [Brief](crimson/brief.md) | [Manifest](crimson/manifest.json) |
| Cyclone | [Brief](cyclone/brief.md) | [Manifest](cyclone/manifest.json) |
| Void | [Brief](void/brief.md) | [Manifest](void/manifest.json) |

Runtime files are in `src/assets/backgrounds/<system>/`. Selected source generations remain in each `sources/` folder. Crimson near-deck uses source v3 after two targeted revisions; earlier generations and prompts remain traceable. Resizing preserves RGBA with nearest-neighbor sampling. All six new deck tiles have clear top/bottom alpha rows; repeated previews are in `previews/`.

The reusable skill is `.agents/skills/neon-background-assets/SKILL.md`. Serve the repository and open `/tools/background-preview.html`; choose any system and camera. The preview isolates saves in memory, includes procedural comparison, wave/dense/boss checks, boost and freeze. New theme sets publish only after every image decodes; failures keep the procedural fallback.

Top-down floor detail follows each grid period; side scenery moves horizontally at different depth rates; pursuit detail shares the grid's reciprocal projection and world travel. The pursuit sky is scaled and clipped above its horizon. The reactive grid, gameplay art, collision geometry and camera controls remain separate.

Eleven renderer tests pass with `node --test tools/test_background_layers.mjs`, including complete-set loading, independent failure fallback, fractional wraps, canvas-state restoration, camera geometry, and preview storage isolation. The skill validator and JS syntax/diff checks pass. Live review covers all twelve system/camera combinations, dense fire in the new top-down themes, boost, and Eclipse pursuit combat in portrait/wider layouts.

Local top-down Canvas submission added 0.100 ms (Crimson), 0.075 ms (Cyclone), and 0.100 ms (Void). Frozen-frame median pacing remained 8.30 ms in each comparison. Reports are preserved in each theme's `references/performance.txt`. These are local CPU submission and refresh-limited measurements; side/pursuit GPU cost and whole-game FPS were not measured.

Pursuit atmosphere uses a faint additive horizon haze that fades across the full floor. It adds depth without darkening the grid or leaving a visible mid-screen rectangular cutoff.

Pursuit grid rows fade in over a short 28–64 logical-pixel distance after entering the far plane. Converging lines also fade near the vanishing point; foreground grid contrast remains unchanged.
