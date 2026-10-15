---
name: neon-game-art
description: Generate and integrate NEON OVERDRIVE ships, enemies, portraits and item artwork with consistent style, camera views, attachment anchors, provenance and live previews. For scenery layers, use neon-background-assets.
---

# NEON OVERDRIVE game artwork

Read [shared art direction and process](../../../art/STYLE.md) before prompting. Use the available imagegen skill and built-in image generation tool for raster creation and visual revisions. This skill covers game subjects rather than background layers; route scenery work to `neon-background-assets`.

Inspect the relevant source renderer and existing brief. Preserve subject identity and its gameplay silhouette; establish a selected reference before making alternate views. For icons read `art/icons/brief.md`; for portraits read `art/portraits/README.md`. For ships, inspect `src/render/shipArt.js`, `src/render/shipImages.js`, `src/render/shipMounts.js`, `src/game/player.js`, and `src/game/stageview.js` rather than assuming image axes equal screen axes.

Preserve selected full-resolution sources, exact prompts and a manifest under `art/<category>/<subject>/`. Export transparent versioned PNGs under `src/assets/<category>/<subject>/`; size them for their consumer rather than automatically using icon dimensions. Record the export operation, source/output hashes, input references and measured attachment anchors. See `art/ships/vector/` for the first three-camera hull set and `tools/ship-art-preview.html` for fleet selection, native-scale samples, paint and live-flight review.

For combat hulls, measure cannon and engine anchors from the final art and use them for both visuals and firing/exhaust placement. Validate real bullet emergence through the full camera transform, banking, free-flight heading and upgraded weapon streams. Alternate views must depict the requested camera, not just a rotated top view. Keep dynamic effects outside the static image.

Ship placement lives in `src/render/shipImageSpecs/<id>.js`, registered in `src/render/shipImageSpecs.js`: preserve the stock color, three camera footprints and normalized full-source attachment coordinates. Record `sourceSize` for non-square masters so anchors follow export padding; use `contentBox` when the export's exact pixel placement needs to be specified. Keep the manifest's pixel measurements consistent with those fractions. Run `python3 tools/ship_assets.py art/ships/<id>/manifest.json --manifest` to check hashes, alpha and attachment proximity to the visible hull, then visually confirm the points are on the intended apertures. Single-cannon and paired-emitter ships need their actual mount counts, and charge-up effects must use the same mount as the shot. Stock accent tinting is handled by `shipPaint.js`; do not recolor neutral armor or alter unrelated decorative colors. Use the preview's entire-fleet firing check when changing shared ship rendering.

Retain the procedural fallback and existing cosmetics, decode/cache assets outside per-frame drawing, and verify the resulting scene in the browser using isolated preview storage. Run relevant existing tests; add focused geometry or asset checks when changing attachment or camera behavior. Record actual review results in the subject brief. Deliver saved asset paths, exact prompt locations, generation method, and checks or limitations.
