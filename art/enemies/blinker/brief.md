# blinker enemy artwork

Logical footprint: 44 × 44 units. Accent tint: `#e0d4ff`.

Selected camera masters:

- **top:** `top-v1.png` — Direct overhead orthographic; nose faces down-screen (+y).
- **side:** `side-v1.png` — True side profile; nose reads screen-left after the side camera transform.
- **chase:** `chase-v5.png` — Front-facing enemy approach toward the camera/player, viewed near the horizon.

Exact prompt text is stored under `prompts/`; source masters and input references are recorded in `manifest.json`.
Exports are deterministic transparent PNGs with content hashes and measured source-frame transforms.
## Review

2026-10-16 final review: inspected selected art in the three-camera browser roster at native and enlarged scale. Light/dark background, opacity, hit-flash and pixel controls were checked. The complete regular roster passed the six live combat scenarios (three cameras, two looks), including elite/blackout rendering. Detailed checks and camera/symmetry limitations are recorded in `art/enemies/README.md`.

2026-10-20 pursuit revision: generated a new transparent chase master from the selected chase identity reference using built-in imagegen; saved the full-resolution source and exact prompt. Inspected the 1254×1254 RGBA source at enlarged scale and confirmed identity, palette and silhouette. The first chase redo remained overhead-like and was rejected. A text-only retry was then inspected enlarged and selected: its low front face and dark underside read clearly, with the full silhouette inside the frame. Top and side selections remain unchanged. Runtime export is pending the parent task; no gameplay or browser validation was performed here.

2026-10-20 selected chase revision: chase-v4.png is now selected. Inspected the generated 1254×1254 RGBA source enlarged; preserved the subject identity and fixed accent palette. Generated from text without an image reference to establish the low front camera. Top and side selections remain unchanged. Runtime export is pending the parent task; no gameplay or browser validation was performed here.

2026-10-20 integration validation: deterministic strict export and all 11 enemy-art tests passed. The isolated browser preview loaded all 15 subjects in three cameras; the six-case combat smoke passed in normal/pixel looks with elite and blackout, tank firing, carrier launch and snake segments. Console warnings/errors: none. Light/dark edges and hit-flash controls were visually sampled. Camera angles are judged visually, not numerically calibrated; radial subjects retain similar silhouettes. See `art/enemies/references/pursuit-2026-10-20.png` for prior/new and native-size comparisons.


2026-10-20 silhouette review: chase-v4 was rejected because its tall vertical fin distorted the accepted broad flight silhouette. Selected chase-v5 after enlarged comparison against the prior accepted chase-v2 identity reference. The new source keeps a broad horizontal star shape, central dark visor, pale lavender armor, short vertical points and contained wings, with a lower front-facing read. Exact prompt and reference are recorded in prompts/chase-v5.txt and selection.json. Runtime export is pending the parent task; no browser validation was performed here.

Comparative review integration: final selected view passed strict export, all 11 enemy-art tests and the six-case isolated browser combat smoke (three cameras, normal/pixel, elite/blackout, tank firing, carrier launches, snake segments). All 15 subjects loaded; no console warnings/errors. Light/dark backgrounds and complete hit flashes were visually sampled. The original Spinner chase-v3 is retained after its retry was judged weaker; the other six retries are selected. See `art/enemies/references/pursuit-review-2026-10-20.md` for individual decisions.
