# swarm enemy artwork

Logical footprint: 30 × 30 units. Accent tint: `#7dffb0`.

Selected camera masters:

- **top:** `top-v1.png` — Direct overhead orthographic; nose faces down-screen (+y).
- **side:** `side-v1.png` — True side profile; nose reads screen-left after the side camera transform.
- **chase:** `chase-v4.png` — Front-facing enemy approach toward the camera/player, viewed near the horizon.

Exact prompt text is stored under `prompts/`; source masters and input references are recorded in `manifest.json`.
Exports are deterministic transparent PNGs with content hashes and measured source-frame transforms.
## Review

2026-10-20 chase revision: The replacement was generated from the accepted chase master as a camera/framing correction. The paired eyes and mandibles read as the front face, with the green shell and paired wings retained. Full-resolution alpha and complete wing/foot silhouette were inspected; runtime export/browser preview remains with the integration pass.


2026-10-16 final review: inspected selected art in the three-camera browser roster at native and enlarged scale. Light/dark background, opacity, hit-flash and pixel controls were checked. The complete regular roster passed the six live combat scenarios (three cameras, two looks), including elite/blackout rendering. Detailed checks and camera/symmetry limitations are recorded in `art/enemies/README.md`.

2026-10-20 integration validation: deterministic strict export and all 11 enemy-art tests passed. The isolated browser preview loaded all 15 subjects in three cameras; the six-case combat smoke passed in normal/pixel looks with elite and blackout, tank firing, carrier launch and snake segments. Console warnings/errors: none. Light/dark edges and hit-flash controls were visually sampled. Camera angles are judged visually, not numerically calibrated; radial subjects retain similar silhouettes. See `art/enemies/references/pursuit-2026-10-20.png` for prior/new and native-size comparisons.

2026-10-20 comparison review: the square chase-v3 was rejected because its armored shell made the sprite too tall. Selected chase-v4 from the original accepted chase-v2 reference. The 2:1 landscape source restores broad lateral mint wings and the compact eye/mandible face below a small dorsal shell. Full-resolution inspection confirms complete wing/foot contours; alpha above 8 leaves 42–43px side margins and no visible edge clipping. Runtime/browser preview remains with the parent integration pass.

Comparative review integration: final selected view passed strict export, all 11 enemy-art tests and the six-case isolated browser combat smoke (three cameras, normal/pixel, elite/blackout, tank firing, carrier launches, snake segments). All 15 subjects loaded; no console warnings/errors. Light/dark backgrounds and complete hit flashes were visually sampled. The original Spinner chase-v3 is retained after its retry was judged weaker; the other six retries are selected. See `art/enemies/references/pursuit-review-2026-10-20.md` for individual decisions.
