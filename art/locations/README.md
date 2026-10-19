# Service location artwork

Three selected v1 scenes generated with built-in `image_gen`. Full-resolution
1536 × 1024 originals are preserved; runtime loads only `src/assets/locations/`.
Each subject's manifest records exact prompts, source/reference SHA-256 hashes,
measured crop rectangles, export sizes and output hashes.

| Subject | Source / prompt / manifest | Runtime |
| --- | --- | --- |
| Ship-parts Fabricator | [Original](fabricator/sources/scene-v1.png) · [Prompt](fabricator/prompts/scene-v1.txt) · [Manifest](fabricator/manifest.json) | [768 × 432](../../src/assets/locations/fabricator/scene-v1.png) · [192 × 108 pixel](../../src/assets/locations/fabricator/scene-pixel-v1.png) |
| Black Market | [Original](black-market/sources/scene-v1.png) · [Prompt](black-market/prompts/scene-v1.txt) · [Manifest](black-market/manifest.json) | [768 × 256](../../src/assets/locations/black-market/scene-v1.png) · [192 × 64 pixel](../../src/assets/locations/black-market/scene-pixel-v1.png) |
| Rest Station | [Original](rest-station/sources/scene-v1.png) · [Prompt](rest-station/prompts/scene-v1.txt) · [Manifest](rest-station/manifest.json) | [768 × 256](../../src/assets/locations/rest-station/scene-v1.png) · [192 × 64 pixel](../../src/assets/locations/rest-station/scene-pixel-v1.png) |

## Brief and integration

Visual thesis: dark industrial machinery with crisp gunmetal surfaces, restrained
practical neon lighting and readable spacecraft parts. The Fabricator establishes
the material reference used by the other two generations. The Black Market is a
concealed asteroid trading bay with violet/gold lamps; the Rest Station is an
orderly cyan-lit repair berth. The maintenance ship is incidental scenery, not a
new playable hull. No baked text, interface controls, rarity frames or animated
effects. These are opaque menu scenes rather than gameplay layers.

Content plan: location imagery establishes the place; the existing slot, purchase
and repair controls retain their meaning. The market heading and wallet overlay
the arrival banner so its five offers still fit. The Fabricator machine replaces
the empty result well, without adding menu height. After a roll, item details
crossfade into that same fixed area.

Interaction thesis: a brief location entrance fade; a vertically scrolling ship-part
projection that decelerates into the actual awarded item; a short lock-in and
result reveal. The reel uses existing item art for the selected equipment slot,
not new generated icons or randomized rarity previews. Its order uses no gameplay
RNG. The purchase, item generation and existing automatic salvage policy run and
save before presentation. Repeat input/slot changes are guarded during the spin;
navigation is allowed, with stale callbacks prevented from reopening another
screen. Reduced motion skips the reel. A newly rolled part that is automatically
salvaged shows its credit return in the readout.

The Fabricator crop is (0, 80, 1536, 944); its measured chamber occupies approximately
35–65% of image width and 14–67% of height in the export. The projection shares
the image's aspect-preserving coordinate space. Other crops are
(0, 224, 1536, 736). Exports convert to RGBA and resize with Pillow LANCZOS;
pixel variants sample the same crop at one quarter resolution. Both versions load
outside rendering. Image failures keep the fixed scene area and usable controls;
the Fabricator's live reel remains separate from its backdrop.

## Review

Open `/tools/location-art-preview.html` on the served repository for all three live
menus, viewport selection, pixel mode, credits and a no-art check. It copies local
storage into memory before the game loads; preview mutations never write the real
save.

Validated: 16 existing icon/background tests; menu layout audit for Fabricator,
hangar tabs, market and dock at desktop and phone sizes; browser checks for
single-charge/single-save behavior under rapid input, selected slots, premium
rarity, leaving mid-spin, reduced motion, insufficient credits and full-inventory
auto-salvage. All three menus fit 320 × 568 portrait and 844 × 390 landscape.
Live normal/pixel review checks chamber registration, banner crops, result text,
keyboard selection and image-failure behavior. No physical gamepad was used;
existing navigation handlers are reused.
