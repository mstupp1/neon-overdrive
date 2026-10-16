# Enemy images, camera views and moving parts

Inspect `src/render/enemyArt.js`, `enemyImages.js`, `enemyImageSpecs.js`, `src/game/enemies.js`, `world.js` and `stageview.js`, plus `art/enemies/README.md`. Read actual spawn/classification and sprite mappings: an enemy-table entry can be a miniboss, and type IDs need not equal sprite IDs. Do not expand a regular-enemy request to bosses or minibosses automatically.

## Identity and camera

Use the accepted subject original and its procedural baseline as references for silhouette, fixed accent color and logical footprint. Generate a selected overhead identity before alternate views. Preserve broad readable geometry; fine panels disappear at native scale.

- Overhead enemy noses face down along virtual +y; player ships face the other way.
- Side source art faces left. Runtime bakes it by -90 degrees before the stage's clockwise quarter-turn; retain the virtual nose axis when placing effects or animating parts.
- Pursuit enemies approach front-first. Player pursuit art shows the rear. Specify front apertures/eyes, foreshortened depth and the physical camera axis; do not copy a player rear-view prompt.

Imagegen sometimes repeats the overhead reference despite a front-camera prompt. Inspect a three-view contact sheet before integration. A useful correction names a front elevation, optical axis along the fore-aft direction, depth into the page and a broad, low silhouette with only a narrow top plane. Judge the result rather than a nominal degree value. Truly radial/spherical subjects may retain similar silhouettes; record that distinction instead of labeling an obviously overhead directional hull as a front view.

## Component production and registration

Keep shields, projectiles, flashes, telegraphs and other combat effects dynamic. Use separate generated components where movement matters; the static base must omit those components to avoid duplicates. A component sheet can reduce calls and preserve style, but equal-cell layout, same scale and centering are requests, not guarantees. Inspect the entire sheet for spill across cells, clipped hulls and neighboring slivers before extracting anything.

Deterministic crops, uniform scaling and placement of generated components are export operations. Preserve the whole original sheet, exact prompt, reference hashes, measured crop rectangles and registration transforms. If the artwork itself is clipped or wrong, revise it with imagegen; padding a clipped crop does not restore missing geometry.

Register base and components onto a common source canvas using measured assembly points. Use a common union frame/crop, scale and offset for export. Independently fitting every part to the same box makes a core or door as large as the hull. Measure pivots on actual hubs/hinges rather than assuming the alpha-bounds center. Inspect assembled overlays before and during animation, including recoil extremes, open/closed doors and complete hit flashes. A rotated flat side/front sprite does not represent rotation in its own physical plane; the spinner uses a projected layer transform to preserve foreshortening.

## Selection and runtime

`tools/enemy_assets.py` is the source of the supported registry/export schema. Inspect it and a matching existing subject before editing metadata. `selection.json` chooses versioned camera masters; layered views also select matching component versions and can record `sourceSheets`, actual identity references and inline or JSON-file registration. Keep those provenance fields out of runtime URL resolution. Retain unselected originals; export only selected runtime assets. Adding a new subject also requires updating the exporter definitions, sprite construction and preview/test roster where applicable; replacing art usually does not require a gameplay change.

`enemyImages.js` maintains `{img, flash, size, half}` compatibility, stable sprite wrappers and per-camera atomic loading of base plus required layers. Spawned enemies retain their sprite references. Missing/failed assets keep that camera's procedural fallback; do not swap in an incomplete hull or load/decode in the frame loop. Preserve hitboxes, elite scale, opacity, segmented placement, combat timing and projectile origins unless explicitly changing gameplay. Art-only recoil can use actual firing timestamps; visual tests must spawn enemies with movement/state that exercises their attacks (tank firing requires its hover/hold flow).

## Validation

From the repository root:

```sh
python3 tools/enemy_assets.py --manifest --strict
node --test tools/test_enemy_art.mjs
```

The export command writes runtime images, manifests and registry; use it only when ready to update those outputs. The tests check coverage, hashes, alpha/margins, camera selection, fallback and animation transforms. Do not infer camera correctness or assembly quality from a successful export/test alone.

Serve the game and open `/tools/enemy-art-preview.html` for enlarged/native comparisons, all cameras, light/dark edges, pixel look, opacity, flashes and layers. Its live iframe isolates saves. Use the live combat check and inspect rendered motion, firing, launches and segments. For a limited replacement, review the affected subject and shared paths; do not regenerate unrelated enemies. Run relevant existing subsystem tests when shared rendering changes. Record the newly performed checks and remaining limitations in the subject brief, without copying historical pass counts as fresh evidence.
