# splitter enemy artwork

Logical footprint: 48 × 48 units. Accent tint: `#ff5ce1`.

Selected camera masters:

- **top:** `top-v1.png` — Direct overhead orthographic; nose faces down-screen (+y).
- **side:** `side-v1.png` — True side profile; nose reads screen-left after the side camera transform.
- **chase:** `chase-v6.png` — Front-facing enemy approach toward the camera/player, viewed near the horizon.

Exact prompt text is stored under `prompts/`; source masters and input references are recorded in `manifest.json`.
Exports are deterministic transparent PNGs with content hashes and measured source-frame transforms.
## Review

2026-10-16 final review: inspected selected art in the three-camera browser roster at native and enlarged scale. Light/dark background, opacity, hit-flash and pixel controls were checked. The complete regular roster passed the six live combat scenarios (three cameras, two looks), including elite/blackout rendering. Detailed checks and camera/symmetry limitations are recorded in `art/enemies/README.md`.

2026-10-20 pursuit revision: generated a new transparent chase master from the selected chase identity reference using built-in imagegen; saved the full-resolution source and exact prompt. Inspected the 1254×1254 RGBA source at enlarged scale and confirmed identity, palette and silhouette. The first chase redo remained overhead-like and was rejected. A text-only retry was then inspected enlarged and selected: its low front face and dark underside read clearly, with the full silhouette inside the frame. Top and side selections remain unchanged. Runtime export is pending the parent task; no gameplay or browser validation was performed here.

2026-10-20 selected chase revision: chase-v4.png is now selected. Inspected the generated 1254×1254 RGBA source enlarged; preserved the subject identity and fixed accent palette. Generated from text without an image reference to establish the low front camera. Top and side selections remain unchanged. Runtime export is pending the parent task; no gameplay or browser validation was performed here.



2026-10-20 final splitter framing revision: replaced the text-only chase-v4 selection with chase-v5 after reviewing its clipped side lobes. Generated chase-v5 from text without image references. At normal visual alpha it keeps the full three-lobe silhouette inside the centered area with broad transparent margins; enlarged inspection confirms all three magenta cores and lobes are visible. Exact prompt is prompts/chase-v5.txt. Runtime export is pending the parent task; no browser validation was performed here.


The v5 master has faint alpha-1 specks beyond the visible hull. The measured chase export frame `[360,415,895,825]` contains the complete visible silhouette with padding, so those specks do not shrink the runtime sprite. The full generated master is retained unchanged.

2026-10-20 integration validation: deterministic strict export and all 11 enemy-art tests passed. The isolated browser preview loaded all 15 subjects in three cameras; the six-case combat smoke passed in normal/pixel looks with elite and blackout, tank firing, carrier launch and snake segments. Console warnings/errors: none. Light/dark edges and hit-flash controls were visually sampled. Camera angles are judged visually, not numerically calibrated; radial subjects retain similar silhouettes. See `art/enemies/references/pursuit-2026-10-20.png` for prior/new and native-size comparisons.

2026-10-20 comparison review: chase-v6 restores the original cohesive low, wide three-lobe chassis, with all three magenta cores readable in a single horizontal row. It was generated from the original chase-v2 identity reference on a 2:1 canvas. Full-resolution alpha audit found a complete silhouette with 65px side margins and no alpha on canvas edges. The stale v5 crop was removed. Runtime/browser preview remains with the parent integration pass.

Comparative review integration: final selected view passed strict export, all 11 enemy-art tests and the six-case isolated browser combat smoke (three cameras, normal/pixel, elite/blackout, tank firing, carrier launches, snake segments). All 15 subjects loaded; no console warnings/errors. Light/dark backgrounds and complete hit flashes were visually sampled. The original Spinner chase-v3 is retained after its retry was judged weaker; the other six retries are selected. See `art/enemies/references/pursuit-review-2026-10-20.md` for individual decisions.
