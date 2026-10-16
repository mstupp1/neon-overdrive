# NEON OVERDRIVE artwork

## Shared visual language

Use the current game and accepted assets as references: near-black navy, industrial gunmetal and dark glass, crisp beveled forms, readable silhouettes, and restrained emissive accents. Cyan, magenta and gold belong to the established palette; preserve each ship, character or system's own identity. Neutral metal can carry pale highlights, but avoid making broad areas white or drowning the silhouette in bloom. Detail must survive the actual display size and the game's pixel look.

Maintain a brightness hierarchy: backgrounds recede; hulls, pickups and portraits read clearly; active shots and important combat signals remain distinct. Backgrounds use sparse highlights and atmospheric depth. Icons and portraits may have richer illustration; combat sprites favor broad panels and clear geometry. Do not impose one asset type's dimensions or pixel treatment on every other type.

## Shared production process

Read the relevant renderer, asset brief and specialized skill before prompting. Capture the existing appearance when matching an established design. State the intended screen size, camera, silhouette, palette, material, alpha requirements, moving parts and avoid list in the prompt. Use built-in imagegen for new raster artwork and visual revisions. For several views of one subject, establish its identity once and use the selected image as a reference for subsequent views. Judge the actual camera result: rotating an overhead image is not a side or rear view.

Keep full-resolution originals and exact prompts under `art/<category>/<subject>/`, with a brief and manifest mapping selected sources to repo-relative runtime filenames. Record reference images, camera intent, export settings, hashes and any measured attachment points. Keep rejected generations separate from selected mappings if retained. Runtime code loads only `src/assets/`, never workstation paths or provenance fields.

Use deterministic export tools for resizing and RGBA conversion, preserving genuine alpha. Revise artwork through imagegen when content, shape or transparency is wrong. Do not paint over mistakes or substitute code-drawn art while presenting it as generated output. Runtime tinting, transforms and separately animated effects are normal rendering operations. Inspect alpha edges on both dark and light backgrounds; avoid baked checkerboards and matte halos. Preserve originals and use versioned runtime names.

Check assets enlarged and at their actual display size, in normal and pixel look. For runtime changes, retain a loading/failure fallback, cache decoded images and baked variants, and smoke-test the affected screen or camera in a browser. Use in-memory preview storage so visual review does not modify the real save. Report what was verified and any remaining limitations.

## Consistent additions and revisions

Use an accepted full-resolution image as the visual identity reference, supported by its brief and current renderer. For a new subject, establish one selected identity before making variants. For a redo, state what changes and what stays: silhouette, face or mask, proportions, materials, accent palette, framing, apparent size and lighting as relevant. Existing artwork establishes the visual world, not a requirement that every character or hull share the same shape. Do not invent unspecified character traits as canon.

Record the actual input images, exact prompt, selected revision, source/output hashes and export operations. Preserve whole original generations, including component sheets; keep rejected versions out of selected mappings. Version replacements and update the consumer's actual reference. Do not treat old validation notes as evidence for a new revision.

## Camera and component checks

Name the subject and consumer when describing a camera. Player hulls face up overhead, right in side-source art and away in rear pursuit. Enemies face down overhead, left in side-source art and toward the camera in pursuit. Portrait framing follows its UI rather than those flight axes. Runtime transforms can differ from source-image axes: inspect the relevant implementation before positioning or animating anything.

Reference images can bias imagegen toward the original view even when the prompt requests another camera. Compare the outputs side by side: look for actual foreshortening, front/rear apertures and visible faces of the object. A requested angle is not proof. Radial or spherical designs may legitimately retain similar silhouettes; directional hulls need a real viewpoint change.

For articulated artwork, omit moving pieces from the static base and preserve separately generated parts. Component sheets can help consistency, but inspect actual cell boundaries, scale, clipped tips and neighboring fragments before extraction. Register parts with measured hubs/hinges on a common source canvas and export frame; independently fitting each part to the same box breaks scale. Keep exact crop/scale/placement records. Check the assembled result at motion extremes and through complete hit flashes; transparent padding cannot repair already clipped geometry.

Category-specific instructions live in the [game-art skill](../.agents/skills/neon-game-art/SKILL.md), including its character and enemy references, and the [background skill](../.agents/skills/neon-background-assets/SKILL.md). Consult source modules for current schemas, dimensions and behavior instead of copying roster counts or old defaults into new work.

## Ship-specific checks

Use the game's logical coordinates and camera transforms. Record measured cannon-tip and engine-nozzle anchors on the selected images; prompting with coordinates alone does not guarantee pixel placement. Preserve original source dimensions so attachment coordinates follow any padding added during export. Check that each point lies on the intended aperture, not merely somewhere inside the image. Bullet origins, muzzle flashes and exhaust should use those same anchors, accounting for banking, free-flight rotation, the side world's quarter turn and pursuit projection. Inspect firing while stationary and moving, with upgraded volleys as well as the starting weapon. Preserve weapon timing, damage and stream counts unless balancing is explicitly requested.

Top view is directly overhead, nose up. Side view faces right, close to horizontal with only enough dorsal reveal to read the ship; wings must be foreshortened. Pursuit looks forward from directly behind, with rear engine faces visible, balanced wings and a foreshortened nose. Choose elevation to fit the live scene rather than treating a nominal angle as proof of correctness.

Keep exhaust flames, projectiles, hit flashes, shields, labels and UI borders separate from the static hull. Confirm the original hitbox, visible hull size, paint jobs and control behavior still work.
