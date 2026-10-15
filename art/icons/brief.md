# NEON OVERDRIVE item artwork

Replace gameplay SVG glyphs with isolated raster artwork: upgrades, weapon modules, evolutions, pilot classes and passives, ship gear, relics, route destinations, market/dock choices and Flux Core purchases. Achievement rewards reuse the trophy artwork, and collection-completion notifications reuse the vault artwork.

Art direction follows [the shared artwork guide](../STYLE.md) and the project's generated background workflow: near-black navy glass and industrial metal; crisp beveled silhouettes; cyan, magenta and gold emissive details; restrained rim lighting. UI objects are brighter than the backdrop and must remain distinguishable at 32–64 px. Use transparent margins, no text or baked rarity frame. Existing labels, rarity borders, discovery masking and controls retain their meaning.

Each unique asset is generated with built-in imagegen. Original outputs and individual prompts are preserved in each group's manifest/source directory; runtime PNG exports are 256 px. Matching mechanics may reuse art across menus (for example damage and Flux Core damage). Files are grouped under src/assets/icons/{upgrades,pilot,items,choices}. Small control glyphs such as lock/check/currency markers and procedural tree connections remain UI primitives.

Use the `neon-game-art` skill for subsequent subject artwork. Validate transparency, local image references, menu sizing and the game's existing checks before delivery.
