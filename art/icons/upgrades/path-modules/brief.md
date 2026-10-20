# Path-module menu artwork

Artwork for the eight modules and eight evolutions introduced in PR #96, plus Shock Rounds and Overcharge. Shock Core gear from PR #97 is recorded separately in `art/icons/items/shockcore-manifest.json`.

Generated with built-in imagegen, coordinated through Luna subagents using `neon-game-art` and `imagegen`. Accepted full-resolution upgrade icons supply the material, lighting and palette references. Each evolution uses its selected base artwork as an identity reference. The exact per-image prompts, original generations, selected references and SHA256 hashes are retained in the adjacent manifests, `sources/` and `prompts/`.

Menu artwork uses dark navy/gunmetal, dark glass, crisp bevels and restrained cyan, magenta and gold accents. Subjects remain isolated on genuine alpha; labels, rarity frames and discovery masks belong to the existing UI. Runtime files use the existing upgrade IDs under `src/assets/icons/upgrades/`, so all consumers keep their loading fallback and cached pixel look.

Review through `tools/icon-ui-preview.html` for actual menu wrappers and pixel look, `tools/icon-preview.html` for larger and native-size comparisons, and `tools/module-art-preview.html` for the separate physical combat bodies. Validation results are recorded in `review.md` after the selected exports are checked.
