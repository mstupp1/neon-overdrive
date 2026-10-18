# Physical module artwork

Built-in imagegen sprites cover Razor Orbit blades, Wingmen drones, autonomous Interceptors, Proximity Mines and Buzzsaws. Energy effects and ordinary projectile art retain their existing renderers. Follow [the shared style guide](../STYLE.md).

Each subject preserves full-resolution `sources/`, exact `prompts/`, selected revisions and registration in `selection.json`, and reproducible export records and SHA256 hashes in `manifest.json`. Runtime 512px RGBA exports live under `src/assets/modules/<id>/`. Alternate player craft views face right in side source art and away from the player in rear pursuit; top craft face up. Blade/disc/puck views show their physical plane and thickness.

Transparent padding retains the established logical boxes: blade/saw 30, drone 26, interceptor 22, mine 24 units. Visible top footprints remain approximately 22, 16, 16 and 14 units respectively. Module updates retain their current damage, timing, orbit paths, projectile origins, arming behavior, launch/return logic and evolved/temporary forms. Loading failures retain procedural visuals, and decoding/baking occurs outside drawing. Generated Buzzsaws have their own single disc rather than two overlaid orbit blades.

Run `python3 tools/physical_art_assets.py` to reproduce selected exports. Serve the repository and open `/tools/module-art-preview.html` for native-size and enlarged camera comparisons, contrasting alpha backgrounds, pixel look, evolutions and temporary Wingmen in an isolated live save. Run `node --test tools/test_module_art.mjs tools/test_module_images.mjs` to check provenance, loading failure behavior, caching, scale and projected spin transforms.
