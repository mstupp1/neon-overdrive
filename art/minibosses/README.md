# Miniboss artwork

The six vault guards use built-in imagegen camera masters and separately animated components. Follow [the shared style guide](../STYLE.md) and [enemy workflow](../../.agents/skills/neon-game-art/references/enemies.md).

Each subject keeps full-resolution `sources/`, exact `prompts/`, a `selection.json` choosing accepted revisions and measured registration, and a generated `manifest.json` recording source, prompt, reference and runtime hashes. Unselected iterations remain outside the selected mapping. The `components/` record preserves Specter's scythe, Arclight's node and Citadel's short turret barrel. Pivots are measured from their actual hubs rather than alpha-bound centers.

Enemy overhead art faces down, side source art faces left, and pursuit shows the approaching front. The renderer counter-rotates side sources before the stage quarter-turn. Separately generated overhead components rotate in a projected plane in alternate cameras. Phase tint and white hit flashes are baked and cached, while shields, lightning, flames, telegraphs, legs and pulses remain dynamic. Missing or failed body/component bundles retain their procedural camera fallback.

Reproduce selected 512px RGBA runtime exports with `python3 tools/physical_art_assets.py`. The exporter preserves source aspect and genuine alpha, scales uniformly about each measured anchor and rejects clipped silhouettes. Runtime URLs only reference `src/assets/minibosses/`.

Serve the repository and open `/tools/mini-art-preview.html` for camera, native/enlarged, alpha edge, phase, flash and isolated live encounter checks. Run `node --test tools/test_mini_art.mjs tools/test_mini_images.mjs` for provenance and runtime loading checks. Subject briefs record this pass's actual visual validation.
