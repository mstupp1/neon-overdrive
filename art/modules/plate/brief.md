# Shield Plate module artwork

The Shield Plate is one physical orbiting armor slab. Its combat identity uses dark gunmetal layers and lime-green edge lights, following the selected Shield Plates menu icon. The overhead image shows the front armor; the side image shows its thin profile and physical thickness; the chase image shows the foreshortened reverse face and underside rails. These are separately generated camera views, not rotations of one image.

Selected sources and runtime exports are recorded in `selection.json` and `manifest.json`. Exact prompts are in `prompts/`; originals are in `sources/`. `tools/physical_art_assets.py` exports 512px RGBA images with deterministic uniform scaling, transparent padding and LANCZOS resampling. Logical footprint is 22 units with a 14-unit visible extent.

All three source images have genuine transparency and clear margins. The three runtime module images were visually reviewed at 512px. No combat glow, forcefield, shadow, or other animated effect is baked into the art. Integration review passed: generated views loaded in all three cameras; base and evolved live simulations passed with finite positions and no console warnings or errors. See [combined review](../../icons/upgrades/path-modules/review.md) for checks and limitations.
