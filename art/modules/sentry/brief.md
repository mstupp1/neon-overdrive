# Sentry module artwork

A complete one-piece automated turret uses three camera-specific static views. The shared identity is a compact gunmetal pedestal, one short orange cannon, and a cyan sensor slit. The side view faces right; the pursuit view shows the turret from behind. Each sprite keeps its barrel and base together so the renderer can rotate the whole object. No projectile, beam or flame is baked into the art.

Method: built-in imagegen with the Sentry icon as an identity reference and accepted drone images as camera-only references. Exact prompts, reference hashes, measured export transforms and runtime hashes are in `manifest.json`; full-resolution generated outputs remain in `sources/`.

Runtime exports are transparent 512px RGBA images with a 26-unit logical box and 18-unit visible extent. All three views were visually reviewed at enlarged size and in the assembled camera sheet; alpha and export bounds are recorded in the manifest. Integration review passed: generated views loaded in all three cameras; base and evolved live simulations passed with finite positions and no console warnings or errors. See [combined review](../../icons/upgrades/path-modules/review.md) for checks and limitations.
