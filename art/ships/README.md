# Player ship artwork

The fleet uses the [shared artwork guide](../STYLE.md) and [neon-game-art workflow](../../.agents/skills/neon-game-art/SKILL.md). Each ship has a selected top-down, side and rear pursuit sprite, with its own silhouette, stock palette, weapon apertures and engines. VECTOR establishes the material and illustration style, rather than a common hull shape.

Per-ship folders preserve full-resolution sources, exact prompts, a brief and a manifest with references, hashes and measured cannon/engine pixels. Runtime 256×256 RGBA exports live under `src/assets/ships/<id>/`. Camera placement and normalized source anchors live under `src/render/shipImageSpecs/`; `shipImageSpecs.js` registers the fleet. Generated hulls retain procedural loading/failure fallbacks. Paint variants shift the stock accent hue while preserving neutral armor and unrelated detail, and decoded/baked variants are cached.

Serve the repository and open `/tools/ship-art-preview.html`. Select a ship to inspect three views, cannon guides, banking, paints and native-size readability. The live iframe uses in-memory storage and supports all three cameras, weapon levels, normal/pixel look, individual firing checks and the complete fleet check. The original and generated fleet contact sheets make silhouette comparison easier. `references/procedural-fleet.jpg` records the original baseline.

Use `python3 tools/ship_assets.py <source> <new-runtime-path>` for deterministic exports, or pass one existing PNG to validate alpha and borders. Run `node --test tools/test_ship_art.mjs` for provenance, paint, geometry and fallback checks, then inspect actual flight in the browser. The firing checks measure attachment registration; they do not establish weapon balance or whole-game performance.

## Fleet integration review

The October 2026 integration review covered the three fleet camera galleries, normal and pixel flight, hangar carousel input and a narrow portrait preview. The live firing check passed for all ten ships: 3,690 actual bullet origins across three cameras, eight weapon levels and three bank angles, with maximum error below 0.000002 logical pixels. Focused geometry checks also cover free-flight headings and pursuit cinematic zoom, translation and fog-dependent hull scaling.

The combined ship-art, menu-art, icon-image, background-layer, top-down-geometry and ultimate-charge suites passed 33 tests. All ten selected asset manifests passed source/export hash, alpha-edge and measured-anchor validation. Review screenshots live in `references/`. This review did not benchmark whole-game performance or play through every campaign encounter.
