# Salvage Drone module artwork

The Salvage Drone is a compact autonomous utility craft with a cyan sensor and gold salvage clamps. Its identity follows the selected Salvage Drone menu icon and the accepted Wingman module materials. The overhead image points nose-up; the side image is a true right-facing profile with foreshortened wings; the chase image faces away from the camera with paired rear apertures closest to the viewer. Each camera view was generated separately.

Selected sources and runtime exports are recorded in `selection.json` and `manifest.json`. Exact prompts are in `prompts/`; originals are in `sources/`. `tools/physical_art_assets.py` exports 512px RGBA images with deterministic uniform scaling, transparent padding and LANCZOS resampling. Logical footprint is 24 units with a 16-unit visible extent.

All three source images have genuine transparency and clear margins. The three runtime module images were visually reviewed at 512px. The rear apertures are unlit; no flame, exhaust, trail, or other combat effect is baked into the art. Integration review passed: generated views loaded in all three cameras; base and evolved live simulations passed with finite positions and no console warnings or errors. See [combined review](../../icons/upgrades/path-modules/review.md) for checks and limitations.
