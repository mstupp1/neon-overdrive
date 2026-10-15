# MAGNATE generated hull set

Three-view hull set created with built-in imagegen and exported through `tools/ship_assets.py`. Stock hull accent: `#e8c66a`. The selected top view defines identity; side and pursuit views use it as their identity reference.

- Full-resolution imagegen originals and exact prompts: `sources/` and `prompts/`.
- Runtime exports: `src/assets/ships/magnate/` (256 × 256 RGBA, aspect-preserving with an 8px transparent margin).
- Original-source dimensions, measured muzzle/engine anchors, runtime content boxes and SHA-256 hashes: `manifest.json`.
- Runtime specs preserve original-source anchor coordinates and map them through each view's `contentBox`.

Visual review confirmed overhead top, right-facing side and low rear pursuit cameras, distinct silhouette, stock palette, requested weapon shape and engine count. Browser/gameplay review is handled by the integration pass.
