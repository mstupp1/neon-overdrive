# BROODMOTHER artwork

Pink hive carrier with veined egg sac. Static source omits six moving legs. Generated side view places near/far legs below the carapace; chase compresses leg depth. Camera-specific sac positions keep the pulse on its actual source aperture.

Method: built-in imagegen for originals and visual revisions; deterministic Pillow export via `tools/physical_art_assets.py`. Exact prompts are under `prompts/`; reference files, SHA256 hashes and all transforms are in `manifest.json`. Unselected originals remain in `sources/`.

| Camera | Selected source | Runtime export |
| --- | --- | --- |
| top | `top-v1.png` | `top-v1.png` |
| side | `side-v2.png` | `side-v2.png` |
| chase | `chase-v2.png` | `chase-v2.png` |

## Validation

Three live camera encounters advanced through real attacks for 3 simulated seconds each. All cameras loaded generated bodies and required parts; both phase colors loaded. Light-background/flash checks covered the roster, with detailed Broodmother alpha and Arclight pixel checks. Generated-only leg adjustment was visually rechecked after integration.

The combined art regression run passed 62 tests, including manifests, alpha, loader failures, atomic layers, cache reuse and projection matrices. Both preview pages were checked at approximately 391 CSS pixels with no horizontal overflow. Browser console checks showed no errors or warnings during the smoke flows.

These checks cover isolated encounters and representative visual states; a full campaign, every free-flight heading and physical gamepad/touch hardware were not exhaustively replayed. Gameplay collision geometry, damage, timings, progression and save formats are unchanged.
