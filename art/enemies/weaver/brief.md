# weaver enemy artwork

Logical footprint: 40 × 40 units. Accent tint: `#d6ff3a`.

Selected camera masters:

- **top:** `top-v1.png` — Direct overhead orthographic; nose faces down-screen (+y).
- **side:** `side-v1.png` — True side profile; nose reads screen-left after the side camera transform.
- **chase:** `chase-v3.png` — Front-facing enemy approach toward the camera/player, viewed near the horizon.

Exact prompt text is stored under `prompts/`; source masters and input references are recorded in `manifest.json`.
Exports are deterministic transparent PNGs with content hashes and measured source-frame transforms.
## Review

2026-10-20 chase revision: The replacement was generated from the accepted chase master. Its central chartreuse diamond reads as the forward core, with four angular limbs and a dark lower face visible. Full-resolution image was inspected; visible limbs remain in frame. Runtime export/browser preview remains with the integration pass.


2026-10-16 final review: inspected selected art in the three-camera browser roster at native and enlarged scale. Light/dark background, opacity, hit-flash and pixel controls were checked. The complete regular roster passed the six live combat scenarios (three cameras, two looks), including elite/blackout rendering. Detailed checks and camera/symmetry limitations are recorded in `art/enemies/README.md`.

2026-10-20 integration validation: deterministic strict export and all 11 enemy-art tests passed. The isolated browser preview loaded all 15 subjects in three cameras; the six-case combat smoke passed in normal/pixel looks with elite and blackout, tank firing, carrier launch and snake segments. Console warnings/errors: none. Light/dark edges and hit-flash controls were visually sampled. Camera angles are judged visually, not numerically calibrated; radial subjects retain similar silhouettes. See `art/enemies/references/pursuit-2026-10-20.png` for prior/new and native-size comparisons.
