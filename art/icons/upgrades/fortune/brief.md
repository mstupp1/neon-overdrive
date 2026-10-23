# Fortune upgrade artwork

Fortune increases reward-draft luck and guarantees a rarer card. Its existing
`ICONS.fortune` reference already targets `src/assets/icons/upgrades/fortune.png`;
adding the missing export activates artwork in all consumers of that icon.

Selected identity: four heart-shaped mechanical clover leaves, a curved stem,
gunmetal armor, golden glass and energy, restrained cyan/magenta accents. No
text or baked UI frame. The accepted Prospector source is a materials/palette
reference, not a subject reference.

Generated with built-in imagegen. The complete original is retained in
`sources/fortune-v1.png`; the exact prompt is in `prompts/fortune-v1.txt`.
`manifest.json` records selected paths, SHA-256 hashes, reference provenance
and deterministic export settings. Runtime output is 256×256 RGBA.

## Review — 2026-10-23

- Inspected the full-resolution original and the runtime export.
- Verified genuine alpha (0–255), plus dark/light edge appearance at 256 and
  48 pixels; no matte or baked background visible.
- Browser review in the existing menu integration catalog: Fortune reads in
  normal and pixel modes using actual game icon definitions and card styling.
  All 218 catalog images decoded; browser warning/error log was empty.
- Audited 151 explicit assetIcon references across source modules: Fortune was
  the only missing export before this addition. The catalog also covers dynamic
  gear/relic references; no missing images remained.
- `node --test tools/test_icon_images.mjs`: all six tests passed.
- Draft layout audit attempted but unavailable because the local Node runtime
  cannot resolve Playwright. No menu markup, layout, gameplay, or save changes.
  Live reward-draft selection and narrow portrait layout were not separately tested.
