---
name: neon-background-assets
description: Create and prepare layered raster backgrounds for NEON OVERDRIVE using built-in imagegen, with in-game previews and deterministic PNG exports.
---

# NEON OVERDRIVE background assets

Use this skill for generated campaign horizons and decorative distant scenery in the scrolling top-down playfield. Use the built-in imagegen tool for concepts and layer generation. Keep source images, prompt text, and the final brief in `art/backgrounds/<system>/`; place runtime PNG exports in `src/assets/backgrounds/<system>/`. Runtime references must stay repo-relative; provenance fields in the manifest are for traceability and must never be used to load runtime assets.

Inspect the current game in motion and capture representative gameplay screenshots. Write a short asset brief from those screenshots, then make one reference concept that can be shown for optional feedback. Continue with separate transparent layers using your judgment; feedback can steer a targeted revision. Export candidates and inspect them in the runtime preview before accepting final assets. Preserve original generated files and prompt provenance in `manifest.json`; use `tools/background_assets.py` for validation, nearest-neighbor exports, tile previews, and image reports. The helper does not generate or edit art.

Read [art direction](references/art-direction.md) before prompting. Read [runtime integration](references/runtime-integration.md) before choosing dimensions or filenames. Keep existing reactive grid behavior visible, retain playfield contrast, and avoid baking gameplay effects into static art.
