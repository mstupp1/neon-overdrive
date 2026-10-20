# carrier enemy artwork

Logical footprint: 84 × 84 units. Accent tint: `#ffc27a`.

Selected camera masters:

- **top:** `top-v3.png` — Direct overhead orthographic; nose faces down-screen (+y).
  Source sheet: `art/enemies/carrier/sheets/top-v4.png`.
  Layer `doorLeft`: registered source present.
  Layer `doorRight`: registered source present.
- **side:** `side-v3.png` — True side profile; nose reads screen-left after the side camera transform.
  Source sheet: `art/enemies/carrier/sheets/side-v4.png`.
  Layer `doorLeft`: registered source present.
  Layer `doorRight`: registered source present.
- **chase:** `chase-v4.png` — Front-facing enemy approach toward the camera/player, viewed near the horizon.
  Source sheet: `art/enemies/carrier/sheets/chase-v4.png`.
  Layer `doorLeft`: registered source present.
  Layer `doorRight`: registered source present.

Exact prompt text is stored under `prompts/`; source masters and input references are recorded in `manifest.json`.
Exports are deterministic transparent PNGs with content hashes and measured source-frame transforms.
## Review

2026-10-16 final review: inspected selected art in the three-camera browser roster at native and enlarged scale. Light/dark background, opacity, hit-flash and pixel controls were checked. The complete regular roster passed the six live combat scenarios (three cameras, two looks), including elite/blackout rendering. Detailed checks and camera/symmetry limitations are recorded in `art/enemies/README.md`.

2026-10-20 pursuit revision: selected `chase-v4.png`. The frontal hull was isolated from the generated component sheet, uniformly scaled and centered; two separate doors were fitted to the launch-bay openings and kept on the registered animation frame. The assembled source overlay was inspected at enlarged scale. Browser/game launch timing review is pending.

2026-10-20 integration validation: deterministic strict export and all 11 enemy-art tests passed. The isolated browser preview loaded all 15 subjects in three cameras; the six-case combat smoke passed in normal/pixel looks with elite and blackout, tank firing, carrier launch and snake segments. Console warnings/errors: none. Light/dark edges and hit-flash controls were visually sampled. Camera angles are judged visually, not numerically calibrated; radial subjects retain similar silhouettes. See `art/enemies/references/pursuit-2026-10-20.png` for prior/new and native-size comparisons.
