# spinner enemy artwork

Logical footprint: 60 × 60 units. Accent tint: `#b56cff`.

Selected camera masters:

- **top:** `top-v3.png` — Direct overhead orthographic; nose faces down-screen (+y).
  Source sheet: `art/enemies/spinner/sheets/top-components-v3.png`.
  Layer `core`: registered source present.
  Layer `rotor`: registered source present.
- **side:** `side-v3.png` — True side profile; nose reads screen-left after the side camera transform.
  Source sheet: `art/enemies/spinner/sheets/side-components-v3.png`.
  Layer `core`: registered source present.
  Layer `rotor`: registered source present.
- **chase:** `chase-v3.png` — Front-facing enemy approach toward the camera/player, viewed near the horizon.
  Source sheet: `art/enemies/spinner/sheets/chase-components-v3.png`.
  Layer `core`: registered source present.
  Layer `rotor`: registered source present.

Exact prompt text is stored under `prompts/`; source masters and input references are recorded in `manifest.json`.
Exports are deterministic transparent PNGs with content hashes and measured source-frame transforms.

## Review

2026-10-16 final review: inspected selected art in the three-camera browser roster at native and enlarged scale. Light/dark background, opacity, hit-flash and pixel controls were checked. The complete regular roster passed the six live combat scenarios (three cameras, two looks), including elite/blackout rendering. Detailed checks and camera/symmetry limitations are recorded in `art/enemies/README.md`.
