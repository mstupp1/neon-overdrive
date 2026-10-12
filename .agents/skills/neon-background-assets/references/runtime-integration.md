# Runtime integration notes

The background is drawn by `src/render/background.js`; image layer placement and movement live in `src/render/backgroundLayers.js`. Each system has three bottom-aligned horizon layers (`gate`, `skylineFar`, `skylineNear`) scaled to 360×240, 500×140, and 510×90 logical units. Two square deck textures (`deckFar`, `deckNear`) are projected onto the perspective grid below the horizon. Keep the gate's source aspect ratio; like the old procedural ring, much of it extends above the viewport. The reactive perspective grid and light pools are drawn separately and must remain visible. Do not replace or bake the grid, lights, enemies, shots, or HUD into generated images.

Deck projection follows the grid's depth curve and column taper, with the same travel phase (`bg.scroll / gridRows`). Structures shrink toward the vanishing point and widen outward along the grid toward the ship. Both textures move at one ground speed; differing repeat counts (3 far, 2 near) establish footprint sizes instead of making surfaces drift apart. Use opacity 0.42 / 0.58 with a distance fade and preserve the clear central aisle. The strip renderer caps draw work, splits at repeating edges, and guards fractional wrapping against zero-length intervals. For future floor assets, inspect alignment in motion and test varied fractional phases, not only integer offsets.

The pixel-look renderer in `src/render/pixel.js` reduces the finished frame to approximately 360 virtual pixels across, then scales with nearest-neighbor sampling. Keep source art crisp and check it at this effective size. Transparent PNG layers allow the existing background and gameplay to show through. Horizons can be wide, opaque-to-transparent scenes; decorative playfield objects should be isolated transparent layers.

Initial runtime exports are `gate-v1.png`, `skyline-far-v1.png`, `skyline-near-v1.png`, `deck-far-v1.png`, and `deck-near-v1.png` in `src/assets/backgrounds/genesis/`. Their selected source generations are documented in `art/backgrounds/genesis/manifest.json`. Export horizons at 720×480 and decks at 360×360 for this first set; confirm the target shape against the current art and placement when creating later layers. Validate transparent pixels on all layers and fully clear top/bottom rows on deck tiles.

Use `tools/background-preview.html` with the repository's local static server to compare procedural/generated layers. The preview has controls for baseline, generated, waves, dense fire, Warden boss, boost, freeze/resume, and a background-draw benchmark. Review at normal size, with pixel look enabled, and during combat before accepting a layer. The renderer already loads the current Genesis names, so matching exports can be previewed without changing code. Keep runtime asset URLs relative to the project; source or prompt paths in development metadata must not become runtime paths.

From the repository root, use `python3` and Pillow:

```sh
python3 tools/background_assets.py export art/backgrounds/genesis/sources/deck-near-v1.png src/assets/backgrounds/genesis/deck-near-v2.png --out-width 360 --out-height 360 --require-alpha
python3 tools/background_assets.py validate src/assets/backgrounds/genesis/deck-near-v2.png --width 360 --height 360 --require-alpha --require-clear-vertical-edges
python3 tools/background_assets.py tile-preview src/assets/backgrounds/genesis/deck-near-v2.png /tmp/deck-near-v2-tiles.png --columns 1 --rows 3 --require-alpha --require-clear-vertical-edges
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `/tools/background-preview.html` on that server. The iframe uses an in-memory copy of local storage before the game loads, so test runs cannot overwrite the real save. For versioned replacement exports, update the source URL in `backgroundLayers.js` and the manifest mapping, then reload. Tiny alpha residue can survive on a source edge but disappear on nearest-neighbor export: require genuine transparency on the source, and strict clear vertical edges on the actual runtime tile. If the exported tile fails, revise it through imagegen and revalidate rather than masking or painting seams by hand. Side and pursuit stages use the same decoded theme set through `src/game/stageview.js`. The overworld remains a separate renderer.

## Theme and camera integration

`loadThemeLayers(theme)` loads one complete five-image set for `genesis`, `crimson`, `cyclone`, or `void`, triggered by `bg.setTheme`. Failed or incomplete sets retain procedural scenery. Themes cache independently so a theme change cannot display the previous system's images. General layer helpers restore alpha, composite mode, and smoothing; generated materials use source-over so dark hulls retain their value.

Top decks follow theme-specific grid row periods: Genesis/Cyclone 16, Crimson 14, Void 9. Genesis's gate is horizon-aligned; the planet, storm eye, and black hole sit lower like their original procedural landmarks. Horizon files export at 720×480 and decks at 360×360 RGBA.

Side scenery uses `drawThemeSideHorizon` and `drawThemeSideDeck`, with horizontal parallax driven by `bg.scroll * 140`. The existing live terrain edges and collisions stay separate. Pursuit sky uses `drawThemeChaseHorizon`: preserve the landmark aspect ratio, scale it to the shallow sky, bottom-align at the horizon, and clip every sky layer above it. Pursuit floor uses `drawChaseDeckLayer`, receiving `{hy,A,Yc,f,CW,CH}` from `chaseProj()`. Screen-y strips invert `hy + A / (Yc - virtualY)`, sample texture rows from world depth minus shared `floorRun()`, and use the same lane width as `floorPt`. Wrap splits are bounded at 160 strips per layer; fractional boundary snapping must always advance.

The preview selectors cover all four systems and all three cameras; `?theme=void&view=chase` opens a particular case. Compare generated/procedural art, dense waves, system bosses, boost, freeze, and portrait/wider layouts. The benchmark measures top-down Canvas submission and frozen-frame pacing only; it explicitly refuses side/pursuit timings. Do not interpret that number as whole-game or GPU performance.
