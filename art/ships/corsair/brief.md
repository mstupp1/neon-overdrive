# CORSAIR generated hull set

Three built-in imagegen views are saved under `sources/`, with exact selected prompts under `prompts/`. The top master preserves CORSAIR's stock orange and its forward-swept fork wings, slim center fuselage, dual outer ricochet cannons and closely spaced rear engines. The side master is a true nose-right elevation with strongly foreshortened wings. The pursuit master looks from behind, with the fork-wing planform spread wide and both engine apertures facing the viewer.

Runtime hulls are 256x256 transparent RGBA exports generated through `tools/ship_assets.py`, preserving the non-square side master with transparent padding. Full-resolution sources, exact prompts, source references, per-view camera notes, measured anchor pixels and SHA-256 hashes are recorded in `manifest.json`; normalized full-source anchors and source sizes are in `src/render/shipImageSpecs/corsair.js`.

Visual review confirmed the forward-swept silhouette, stock orange metal finish, true side orientation, rear engine apertures and transparent alpha. Browser firing and exhaust alignment remain for the parent integration pass.
