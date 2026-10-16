---
name: neon-background-assets
description: Create and prepare layered raster backgrounds for NEON OVERDRIVE using built-in imagegen, including top-down, side-scroll, and pursuit views, with consistent revisions, live previews and deterministic PNG exports.
---

# NEON OVERDRIVE background assets

Use this skill for generated campaign horizons and decorative distant scenery in top-down, side-scroll, and pursuit playfields. Use the built-in imagegen tool for concepts and layer generation. Keep source images, prompt text, and the final brief in `art/backgrounds/<system>/`; place runtime PNG exports in `src/assets/backgrounds/<system>/`. Runtime references must stay repo-relative; provenance fields in the manifest are for traceability and must never be used to load runtime assets.

Inspect the current game in motion and capture representative gameplay screenshots. Write a short asset brief from those screenshots, then make one reference concept that can be shown for optional feedback. Continue with separate transparent layers using your judgment; feedback can steer a targeted revision. Export candidates and inspect them in the runtime preview before accepting final assets. Preserve original generated files and prompt provenance in `manifest.json`; use `tools/background_assets.py` for validation, nearest-neighbor exports, tile previews, and image reports. The helper does not generate or edit art.

Read [shared art direction and process](../../../art/STYLE.md) and [background art direction](references/art-direction.md) before prompting. Read [runtime integration](references/runtime-integration.md) before choosing dimensions or filenames. Keep existing reactive grid behavior visible, retain playfield contrast, and avoid baking gameplay effects into static art. Subject artwork such as ships, portraits and icons follows `neon-game-art` instead.

## Revisions and consistency

For additions or redos, read the selected theme manifest and inspect its accepted source images and live scene before prompting. Use the selected source as the identity/composition reference when changing a layer; preserve the theme palette, visual weight, horizon/aisle placement and repeat behavior except where the user requests a change. Give the prompt a clear change/invariant split. Do not regenerate neighboring layers just to make a targeted revision.

Generated dimensions, transparent margins, camera angle and clean edges must be inspected rather than inferred from the prompt. Keep new source/runtime revisions versioned and selected explicitly; preserve reference hashes and exact prompts. Deterministic crops/resizing are export operations, but missing geometry, matte backgrounds or repeating-edge mistakes need imagegen correction. Validate the actual runtime tile and scene after export; an attractive master or successful metadata check is not sufficient. For changes shared across cameras, review all affected cameras and theme transitions using isolated preview storage, and record newly performed checks rather than reusing historical results.
