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

2026-10-20 pursuit revision: selected `chase-v4.png`. The shallow frontal view uses a flattened rotor silhouette; bearing, rotor and core remain separate and share a measured source pivot. The assembled source overlay was inspected against a dark field at enlarged scale. Browser/game animation review is pending.





The pursuit rotor is composited before the raised core to keep the violet aperture visible above the foreshortened blades. Other camera layer orders are unchanged.

2026-10-20 integration validation: deterministic strict export and all 11 enemy-art tests passed. The isolated browser preview loaded all 15 subjects in three cameras; the six-case combat smoke passed in normal/pixel looks with elite and blackout, tank firing, carrier launch and snake segments. Console warnings/errors: none. Light/dark edges and hit-flash controls were visually sampled. Camera angles are judged visually, not numerically calibrated; radial subjects retain similar silhouettes. See `art/enemies/references/pursuit-2026-10-20.png` for prior/new and native-size comparisons.

2026-10-20 pursuit revision v5: compared the previously selected v3 assembly with v4 at native 60px; v4 lost too much rotor thickness and core presence. Selected v5 retains the broad four-blade graphite/violet identity with a substantial shallow-front rotor and brighter center module. The bearing, rotor, and core are independently isolated from the full sheet and uniformly registered around the measured shared center (0.88 scale for the base and rotor, 0.60 for the core). The assembled native-size preview was checked against v3; the bright core stays centered in the hub without reaching the outer blade roots. Runtime/browser spin review is pending parent export. Full sheet and prompt: `sheets/chase-components-v5.png`, `prompts/chase-v5.txt`; registration: `sheets/chase-registration-v5.json`.

2026-10-20 comparative decision: after testing the thicker v5 rotor with a larger core, retained the original chase-v3. V5 recovers readability but its near-circular X-shaped sweep reads too overhead; v3 remains the strongest combination of visible core, swept blades and convincing pursuit perspective. V4 and v5 are preserved as unselected attempts.

Comparative review integration: final selected view passed strict export, all 11 enemy-art tests and the six-case isolated browser combat smoke (three cameras, normal/pixel, elite/blackout, tank firing, carrier launches, snake segments). All 15 subjects loaded; no console warnings/errors. Light/dark backgrounds and complete hit flashes were visually sampled. The original Spinner chase-v3 is retained after its retry was judged weaker; the other six retries are selected. See `art/enemies/references/pursuit-review-2026-10-20.md` for individual decisions.
