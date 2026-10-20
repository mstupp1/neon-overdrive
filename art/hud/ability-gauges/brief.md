# Ability instrument housings — revision 1

Generated with built-in `image_gen`; integrated and reviewed on 2026-10-20.

## Selected design and sources

Three front-facing instrument housings use dark navy glass, beveled gunmetal and restrained rim lighting. Dash is cyan, boost amber and ultimate neutral silver; ultimate class color comes from the live meter. The right-hand cluster places ultimate directly above boost, with dash inward. Left-hand controls mirror the cluster.

Full-resolution originals are `dash-source-v1.png`, `boost-source-v1.png` and `od-source-v1.png`. Exact prompts are preserved verbatim in [prompts.json](prompts.json). Dash references the accepted `art/icons/pilot/striker-source.png`; boost and ultimate reference the selected dash original. [manifest.json](manifest.json) records reference/source/runtime hashes and deterministic crop/resize transforms.

Runtime PNGs:

- `src/assets/hud/dash-gauge-v1.png`
- `src/assets/hud/boost-gauge-v1.png`
- `src/assets/hud/od-gauge-v1.png`

Each runtime image is 256×256 RGBA, displayed in a 68-unit logical box. All three total 285,052 bytes. Export again with `python3 tools/export_gauge_art.py` (Pillow required). The footprint measurement ignores alpha values <=4, adds an 8-source-pixel margin, centers the original crop in a square, then downsamples with Lanczos. Original artwork and alpha are preserved inside that crop. This removes invisible edge noise without painting or replacing generated content.

## Runtime contract

Images contain only the housing and empty glass face. Charge segments, partial recharge, boost fill/threshold, ultimate reserve cells, active countdown, input hints, labels, ready pulses and unavailable/locked states stay procedural. Charge geometry derives from actual capacity; dense dash counts also show a numeric fraction. Ultimate uses the existing effective capacity cap of five cells and cast cap of three, preserving progression and balance.

`gaugeImages.js` loads and decodes each image once and bakes a 204×204 canvas outside rendering. Baked rim lighting replaces the old per-frame boost shadow. Failed or loading images retain procedural instruments; rendering never retries loading. One logical layout drives both Canvas centers and DOM hit targets. Targets are at least 44 CSS pixels, account for safe-area insets and update on resize, orientation and control-side changes. Overworld cards and notifications clear the two-row cluster.

## Verification

- `node --test tools/test_ability_gauges.mjs tools/test_icon_images.mjs tools/test_background_layers.mjs`: 24 passed.
- `tools/ability_gauge_audit.mjs`: passed at 320×568, 375×667, 390×844 and 844×390 with touch emulation, DPR 2, both control sides, injected safe-area insets, normal and pixel looks. DOM targets match Canvas centers and meet 44px minimum size.
- Thirty live-rendered fixtures: 1–5 and 12 dash charges; 1–5 ultimate cells; empty, partially filled, ready, active and depleted/locked states; boost capacity 175. See [meter-state sheet](validation-meter-states-v1.png).
- Real Chromium multi-touch passed: steering plus boost, steering plus ultimate, second-finger field dash, boost release on pointer-up/cancel/lost capture, blur, pause and backgrounding. The test waits for the existing 250ms menu exit transition before a new touch.
- Keyboard, mouse and gamepad hints, free-cruise SKIP indicator, and actual resource-failure fallback passed without JavaScript errors. Combat top/side/chase cameras and actual campaign-to-overworld flight were visually inspected.
- Overworld exit-card clearance passed at 320×568, 390×844 and 844×390 on both sides. Notifications clear the exit card as well as the gauges.
- Full menu layout audit passed on desktop and phone: no layout shift. Settings, pause and run details passed again after the final notification CSS change.
- Enlarged and 64px exports were checked over dark navy and pale backgrounds: genuine transparency, centered silhouettes and no matte/checkerboard halos. Native phone layouts, partial fills, reserve-cell colors and dense-count labels were inspected. [Cluster preview](preview-v1.png).
- A warmed full-HUD draw averaged approximately 0.13ms over 500 iterations in local headless Chromium. This is a desktop microbenchmark, not a physical-phone measurement. Physical iOS/Android devices were not tested.

Run browser audits against a served repository with `node tools/ability_gauge_audit.mjs http://localhost:8000/`; set `PLAYWRIGHT_MODULE` to a Playwright module path if it is not installed globally. Browser preview storage is in memory in isolated contexts, leaving real saves untouched. Transient audit screenshots are written under `/tmp/neon-gauge-audit` (override with `GAUGE_AUDIT_OUTPUT`).
