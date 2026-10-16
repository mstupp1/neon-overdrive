---
name: neon-game-art
description: Generate, revise and integrate NEON OVERDRIVE ships, enemies, character portraits and item artwork with consistent identity, camera views, moving parts, provenance and live previews. For scenery layers, use neon-background-assets.
---

# NEON OVERDRIVE game artwork

Read [shared art direction and process](../../../art/STYLE.md) and the available `imagegen` skill before creating or revising raster art. Use built-in imagegen for artwork and visual corrections; use deterministic tools for exports and registration. This skill covers subjects; scenery follows `neon-background-assets`.

## Choose the workflow

Inspect the current renderer, accepted asset and subject brief before prompting. Establish which identity, palette, camera, visible footprint and gameplay/UI behavior must survive. A redesign changes only the aspects the user requests; use the selected full-resolution original as the identity reference for revisions and variants. Selecting a reference does not itself require a new approval step.

- **Characters and expressions:** read [character workflow](references/characters.md) and `art/portraits/README.md`.
- **Enemies and moving parts:** read [enemy workflow](references/enemies.md) and `art/enemies/README.md`.
- **Player ships:** follow the ship checks below and `art/ships/README.md`.
- **Item/menu artwork:** read `art/icons/brief.md`; reuse established artwork for the same mechanic and retain small control glyphs as UI primitives.

## Production and review

Use accepted assets as visual references, not only written style descriptions. Establish a selected identity before generating alternate views; specify the consumer's actual size, camera, silhouette, materials, accent color, alpha and dynamic/static split in each prompt. Inspect the output: a requested angle, cell layout or dimension is not evidence that generation obeyed it.

Keep full-resolution originals and exact prompts under `art/<category>/<subject>/`; keep selected mappings, reference hashes, export transforms and measured anchors/pivots in the manifest. Retain original component sheets when extracting layers. Export versioned runtime PNGs under `src/assets/`; keep rejected iterations outside selected mappings. New revisions must not silently overwrite accepted sources or runtime filenames.

Retain loading/failure fallbacks and existing cosmetics. Decode/cache images and baked variants outside rendering. Check enlarged and native-size art, normal/pixel looks, light/dark alpha edges, and the real consuming screen or camera with isolated preview storage. Automated geometry/hash checks support visual review; they do not establish identity, camera correctness or alignment on their own. Record actual results and limitations in the subject brief; deliver saved paths, exact prompt locations and generation method.

## Player ships

Inspect `src/render/shipArt.js`, `shipImages.js`, `shipMounts.js`, `src/game/player.js` and `stageview.js`. Player ships face up overhead, right in side-source art and away from the camera in rear pursuit. Enemy camera conventions differ; see the enemy workflow.

Measure cannon tips and engine nozzles from final art and use those anchors for visuals and firing/exhaust placement. Placement lives in `src/render/shipImageSpecs/<id>.js`, registered in `shipImageSpecs.js`. Preserve stock color, three camera footprints and normalized full-source coordinates. Record `sourceSize` for non-square masters and `contentBox` where export placement requires it; keep manifest pixels consistent with fractions.

Run `python3 tools/ship_assets.py art/ships/<id>/manifest.json --manifest`, then visually check points on the intended apertures. Single and paired mounts must match actual weapon streams; charge effects share the firing mount. Validate bullet emergence through banking, free-flight heading, side quarter-turn and pursuit projection, including upgraded streams. Preserve balance and hitboxes unless requested. Accent tinting uses `shipPaint.js`; retain neutral armor and unrelated colors.

Use `tools/ship-art-preview.html` for fleet/camera, native-size, paint and live-flight review. Run `node --test tools/test_ship_art.mjs`; use the entire-fleet firing check when changing shared ship rendering. Keep dynamic combat effects out of static hull art.
