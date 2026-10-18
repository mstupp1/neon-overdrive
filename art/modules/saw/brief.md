# SAW artwork

Eight-tooth magenta Buzzsaw disc with its own generated identity. Shared alternate-camera low-plane master is valid for the radially symmetric disc. Measured plane aspect .271 retains its plane during rotation. A generated saw draws once; procedural fallback retains the historical pair of quarter-turned blades.

Method: built-in imagegen for originals and visual revisions; deterministic Pillow export via `tools/physical_art_assets.py`. Exact prompts are under `prompts/`; reference files, SHA256 hashes and all transforms are in `manifest.json`. Unselected originals remain in `sources/`.

| Camera | Selected source | Runtime export |
| --- | --- | --- |
| top | `top-v1.png` | `top-v1.png` |
| side | `plane-v2.png` | `side-v1.png` |
| chase | `plane-v2.png` | `chase-v1.png` |

## Validation

All three live camera flows advanced through real module updates for 1 simulated second, checking object coordinates for finite values. Interceptor launch/attack/return, mine spawning and saw flight were observed; Phalanx plus Fortress produced 9 wingmen. Static native/enlarged views and representative light-background/pixel scenes were reviewed.

The combined art regression run passed 62 tests, including manifests, alpha, loader failures, atomic layers, cache reuse and projection matrices. Both preview pages were checked at approximately 391 CSS pixels with no horizontal overflow. Browser console checks showed no errors or warnings during the smoke flows.

These checks cover isolated encounters and representative visual states; a full campaign, every free-flight heading and physical gamepad/touch hardware were not exhaustively replayed. Gameplay collision geometry, damage, timings, progression and save formats are unchanged.
