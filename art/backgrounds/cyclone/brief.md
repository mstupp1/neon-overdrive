# CYAN CYCLONE background set

Storm-eye ring with dim spiral ribbons above floating collector stations. The floor uses dark teal station panels and utility clusters.

Generated with built-in imagegen on 2026-10-12. Preserve selected source PNGs and exact prompts in the manifest. The five files serve top-down, side-scroll, and pursuit scenes through separate camera-aware placement. Combat remains brighter than scenery. No gameplay geometry is baked into these images.

| Layer | Runtime dimensions | Role |
| --- | --- | --- |
| Landmark (gate filename) | 720×480 RGBA | Distant system identity |
| Far skyline | 720×480 RGBA | Quiet upper silhouette |
| Near skyline | 720×480 RGBA | Lower structural depth |
| Far deck | 360×360 RGBA | Large dim overhead footprints |
| Near deck | 360×360 RGBA | Sparse outer conduits |

Top decks follow the system grid phase and widen toward the player. Side bands scroll horizontally at different depth rates and sit behind live collision terrain. Pursuit floor strips use the same reciprocal projection and world travel as its grid. Source alpha is preserved with nearest-neighbor export. Generated sets only replace procedural scenery after every file has decoded.

The preview is `tools/background-preview.html?theme=cyclone&view=top`; change the view selector for side or pursuit. Baseline and generated captures are retained under `references/`. Runtime art is in `src/assets/backgrounds/cyclone/`; exact source mappings, prompts and hashes are in `manifest.json`.

## Validation

Eleven renderer tests and the skill validator pass. All five runtime PNGs have genuine alpha; both deck tiles have fully clear top/bottom rows. Live checks cover top-down dense fire plus side and pursuit composition. The local top-down rendering comparison is saved in `references/performance.txt`; it measures Canvas submission and refresh-limited frozen-frame pacing, not GPU time or whole-game combat FPS.

Top-down landmark masking: the planet/storm/black-hole image is clipped at the skyline horizon before the scenery bands are drawn. Its upper edge peeks up behind the buildings; its lower portion is hidden from the combat floor. This mask does not change side or pursuit framing.

The top-down storm rotates around its eye at 0.025 rad/s (about 4.2 minutes per revolution), driven by the simulation clock. The screen-space skyline mask is applied before rotation, so the storm remains behind the scenery as it turns.

Side and pursuit now share that same simulation-clock rotation and speed. The landmark transform is restored before drawing skyline bands; screen-space clipping keeps rotating arms above the floor.
