# NEON OVERDRIVE artwork

## Shared visual language

Use the current game and accepted assets as references: near-black navy, industrial gunmetal and dark glass, crisp beveled forms, readable silhouettes, and restrained emissive accents. Cyan, magenta and gold belong to the established palette; preserve each ship, character or system's own identity. Neutral metal can carry pale highlights, but avoid making broad areas white or drowning the silhouette in bloom. Detail must survive the actual display size and the game's pixel look.

Maintain a brightness hierarchy: backgrounds recede; hulls, pickups and portraits read clearly; active shots and important combat signals remain distinct. Backgrounds use sparse highlights and atmospheric depth. Icons and portraits may have richer illustration; combat sprites favor broad panels and clear geometry. Do not impose one asset type's dimensions or pixel treatment on every other type.

## Shared production process

Read the relevant renderer, asset brief and specialized skill before prompting. Capture the existing appearance when matching an established design. State the intended screen size, camera, silhouette, palette, material, alpha requirements, moving parts and avoid list in the prompt. Use built-in imagegen for new raster artwork and visual revisions. For several views of one subject, establish its identity once and use the selected image as a reference for subsequent views. Judge the actual camera result: rotating an overhead image is not a side or rear view.

Keep full-resolution originals and exact prompts under `art/<category>/<subject>/`, with a brief and manifest mapping selected sources to repo-relative runtime filenames. Record reference images, camera intent, export settings, hashes and any measured attachment points. Keep rejected generations separate from selected mappings if retained. Runtime code loads only `src/assets/`, never workstation paths or provenance fields.

Use deterministic export tools for resizing and RGBA conversion, preserving genuine alpha. Revise artwork through imagegen when content, shape or transparency is wrong. Do not paint over mistakes or substitute code-drawn art while presenting it as generated output. Runtime tinting, transforms and separately animated effects are normal rendering operations. Inspect alpha edges on both dark and light backgrounds; avoid baked checkerboards and matte halos. Preserve originals and use versioned runtime names.

Check assets enlarged and at their actual display size, in normal and pixel look. For runtime changes, retain a loading/failure fallback, cache decoded images and baked variants, and smoke-test the affected screen or camera in a browser. Use in-memory preview storage so visual review does not modify the real save. Report what was verified and any remaining limitations.

## Ship-specific checks

Use the game's logical coordinates and camera transforms. Record measured cannon-tip and engine-nozzle anchors on the selected images; prompting with coordinates alone does not guarantee pixel placement. Preserve original source dimensions so attachment coordinates follow any padding added during export. Check that each point lies on the intended aperture, not merely somewhere inside the image. Bullet origins, muzzle flashes and exhaust should use those same anchors, accounting for banking, free-flight rotation, the side world's quarter turn and pursuit projection. Inspect firing while stationary and moving, with upgraded volleys as well as the starting weapon. Preserve weapon timing, damage and stream counts unless balancing is explicitly requested.

Top view is directly overhead, nose up. Side view faces right, close to horizontal with only enough dorsal reveal to read the ship; wings must be foreshortened. Pursuit looks forward from directly behind, with rear engine faces visible, balanced wings and a foreshortened nose. Choose elevation to fit the live scene rather than treating a nominal angle as proof of correctness.

Keep exhaust flames, projectiles, hit flashes, shields, labels and UI borders separate from the static hull. Confirm the original hitbox, visible hull size, paint jobs and control behavior still work.
