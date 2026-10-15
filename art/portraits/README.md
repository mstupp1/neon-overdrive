# Character portraits

Follow [the shared artwork guide](../STYLE.md) and `neon-game-art` for new portraits and revisions. Reuse the selected character as a reference so silhouette, materials and lighting remain consistent across expressions.

Generated with the built-in imagegen tool for ECHO (helmeted pilot with no specified gender), MAG (mission AI eye core), and SIGNAL (hostile fractured mask).

Exact generation prompts are in `prompts/`; full-resolution transparent originals are in `sources/`. Runtime exports are 256×256 RGBA PNGs in `src/assets/portraits/`, resized with Lanczos while retaining transparency.

The pilot screen and dialogue share `src/ui/portraits.js`. Pixel mode displays these portraits at 96×96 with nearest-neighbor enlargement. Normal mode uses the full menu resolution. Procedural portraits remain the fallback when generated artwork is unavailable.
