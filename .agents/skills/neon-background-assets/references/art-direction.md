# Campaign art direction

Use actual gameplay screenshots as the primary reference for density, brightness, horizon placement, and ship/enemy readability. The rendered playfield is 450 logical units wide and the optional pixel-look pass targets about 360 virtual pixels across. Aim for crisp pixel art that still reads at that scale. Capture a baseline with the game running, and keep the source screenshot alongside the brief in `art/backgrounds/<system>/references/`.

Genesis uses a near-black navy base with restrained cyan lighting and occasional magenta accents. Keep outlines dark blue and highlights sparse. Ships, enemies, shots, pickups, and HUD elements are brighter than the background; leave open dark regions around active combat. Favor distant industrial silhouettes, gate structures, antennae, and restrained window lights over busy foreground detail. Avoid text, logos, bright broad glows, and fake HUD elements.

For the pilot horizon, make a wide scene with a clean horizon silhouette and atmospheric depth. For top-down playfield decoration, use isolated distant structures or debris-like industrial silhouettes as separate transparent elements; do not imply solid collision geometry or cover the reactive grid. Preserve clean transparent edges and avoid a matte halo.

For horizon layers, frame artwork for the runtime's bottom alignment and output aspect. The Genesis gate preserves its source aspect ratio; skyline layers are shallow bands. For repeating deck layers, leave generous transparent top/bottom margins so vertical repeats do not form bright seams. Horizontal repetition is not used by this pilot. The first export targets are 720×480 for horizon masters and 360×360 for deck masters. Generated dimensions may differ from requested dimensions: inspect the result instead of assuming the prompt controls file size. The export is scaled in the renderer; check clusters at displayed scale rather than imposing a second coarse pixel grid on the art.

In the brief, record target screen/use, layer name, desired visual weight, framing and scale, palette, transparency needs, and explicit avoid list. Keep the original generated assets, prompts, and selected files under `art/backgrounds/<system>/sources/`; map each source and prompt to its runtime filename in `art/backgrounds/<system>/manifest.json`. This makes targeted revisions traceable without replacing the original generation.

## Other systems and cameras

Crimson uses a ringed dark red planet, burgundy refineries, and muted red seams. Cyclone uses a cyan storm-eye structure, floating stations, and dark teal collector platforms. Void uses a black hole, violet/amber accretion ribbons, broken monoliths, and fractured machinery. Keep each system recognizable without making its backdrop as bright as combat.

Reuse each system's five layers across the three cameras when their silhouettes remain convincing. Side skylines travel horizontally at different depth rates; keep landmark motion much slower. Overhead deck textures are only distant detail below the side floor, never foreground collision terrain. Pursuit skylines meet the camera horizon; floor art must use its reciprocal depth projection and shared floor travel. Inspect near-camera growth and texture seams while moving, not only in a still image.

For floor assets ask for isolated clusters that terminate well inside the image, with broad fully transparent top/bottom margins. Continuous pipes touching the canvas edge tend to create visible repeating seams even when the prompt requests empty margins. Validate actual exported alpha rows; revise edge failures through imagegen.
