# Overworld art brief

Use: campaign free-flight overworld, layered below the reactive grid and combat. References: references/overworld-baseline.png (initial shared Genesis free-flight reference) and references/overworld-baseline-live.png (this system with generated art disabled). Preserve dark open space and brighter cyan ship/projectiles.

Create two isolated transparent overhead scenery clusters per system, far and near (720×720 runtime), and four compact roughly circular solid obstacles (256×256 runtime). Keep alpha edges clear, entire silhouettes contained, restrained neon seams, crisp pixel art suitable for the 360-pixel retro pass. Far scenery has faint low-contrast hulls; solid obstacles have clear dark material and sparse rims matching their circular collision radius. No HUD, grid, text, ships, projectiles, pickups, broad bloom or opaque backdrop.

Themes: Genesis industrial orbital salvage in navy/cyan; Crimson organic corruption and refinery ruins in burgundy/red; Cyclone storm-damaged collectors in dark teal/cyan; Void fractured monoliths and alien relics in near-black violet/amber. Reuse current landmark art. Camera-driven depths: .08 landmark, .22 far, .45 near. Visual overhaul only; seeded gameplay layouts and collision behavior stay unchanged.
