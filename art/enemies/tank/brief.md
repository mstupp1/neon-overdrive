# tank enemy artwork

Logical footprint: 78 × 78 units. Accent tint: `#ffe14d`.

Selected camera masters:

- **top:** `top-v4.png` — Direct overhead orthographic; nose faces down-screen (+y).
  Source sheet: `art/enemies/tank/sheets/top-v4.png`.
  Layer `carriage`: registered source present.
- **side:** `side-v3.png` — True side profile; nose reads screen-left after the side camera transform.
  Source sheet: `art/enemies/tank/sources/side-v3.png`.
  Layer `carriage`: registered source present.
- **chase:** `chase-v8.png` — Front-facing enemy approach toward the camera/player, viewed near the horizon.
  Source sheet: `art/enemies/tank/sheets/chase-components-v8.png`.
  Layer `carriage`: registered source present.

Exact prompt text is stored under `prompts/`; source masters and input references are recorded in `manifest.json`.
Exports are deterministic transparent PNGs with content hashes and measured source-frame transforms.
## Review

2026-10-16 final review: inspected selected art in the three-camera browser roster at native and enlarged scale. Light/dark background, opacity, hit-flash and pixel controls were checked. The complete regular roster passed the six live combat scenarios (three cameras, two looks), including elite/blackout rendering. Detailed checks and camera/symmetry limitations are recorded in `art/enemies/README.md`.

2026-10-20 pursuit revision: selected `chase-v4.png`. The front-facing hull and twin-barrel carriage were isolated from the generated sheet, uniformly scaled and registered to the empty weapon socket on a shared canvas. The assembled source overlay was checked for alignment and full-canvas margins. Browser/game firing animation review is pending.

2026-10-20 integration validation: deterministic strict export and all 11 enemy-art tests passed. The isolated browser preview loaded all 15 subjects in three cameras; the six-case combat smoke passed in normal/pixel looks with elite and blackout, tank firing, carrier launch and snake segments. Console warnings/errors: none. Light/dark edges and hit-flash controls were visually sampled. Camera angles are judged visually, not numerically calibrated; radial subjects retain similar silhouettes. See `art/enemies/references/pursuit-2026-10-20.png` for prior/new and native-size comparisons.

2026-10-20 pursuit selection v8: user review preferred the original hover-tank identity over v4's tracked ground-vehicle appearance. Candidate comparisons rejected v5, v6 and v7 because they duplicated the cannons on the static hull. Selected v8 restores the broad smooth anti-gravity hull and gold reactor, with only flush empty sockets on the base and a separate compact paired-barrel carriage. The full connected base/carriage shapes were isolated from `sheets/chase-components-v8.png`, uniformly scaled 0.56 and registered to shared [443,410] on the 887px source canvas; assembled native-60 preview showed barrels below the unobstructed reactor. Camera and symmetry are judged visually rather than numerically calibrated. Runtime/browser firing animation review is pending parent export. Exact prompt and registration: `prompts/chase-v8.txt`, `sheets/chase-registration-v8.json`; rejected full sheets and prompts remain under `sheets/` and `prompts/`.

Comparative review integration: final selected view passed strict export, all 11 enemy-art tests and the six-case isolated browser combat smoke (three cameras, normal/pixel, elite/blackout, tank firing, carrier launches, snake segments). All 15 subjects loaded; no console warnings/errors. Light/dark backgrounds and complete hit flashes were visually sampled. The original Spinner chase-v3 is retained after its retry was judged weaker; the other six retries are selected. See `art/enemies/references/pursuit-review-2026-10-20.md` for individual decisions.
