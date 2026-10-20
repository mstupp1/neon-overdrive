# Regular enemy artwork

This set covers the 14 regular enemy types and the snake's independently positioned segment: 15 sprite subjects, 45 camera views, and 15 moving component images. Hunter and bosses are outside this set.

## Sources and reproduction

Artwork was generated with built-in imagegen following the NEON game-art skill and `art/STYLE.md`, using Luna subagents for production, integration and review. Each subject directory preserves full-resolution original generations, exact prompts, selected sources and SHA-256 manifests. Layered subjects also retain original component sheets and measured crop/placement registration. `selection.json` names selected revisions; unselected iterations remain as provenance. Runtime loads only selected versioned PNGs from `src/assets/enemies/`.

Run `python3 tools/enemy_assets.py --manifest` to reproduce the 256px transparent exports and registry. Component exports use a common union frame, so a small core is not expanded to the rotor's size. Selected source silhouettes have transparent margins. Registration records and manifests map measured pivots through crop, scale, padding and side-view rotation.

## Runtime behavior

Overhead enemies face virtual +y. Side sources face left and are baked with a compensating quarter turn. Pursuit uses front-facing artwork with the stage's existing depth/tilt transform. The sprite wrapper keeps its identity while asynchronous image loading replaces each complete camera view. Missing images or required components retain that camera's procedural fallback.

The spinner's top rotor follows its existing rotation, with a slower relative core rotation. Its alternate-view rotor spins through a projected transform that retains foreshortening. Tank carriage recoil lasts 80ms of simulation time after an actual firing event. Carrier doors open during the existing launch warning and close at launch. Combat timing, projectile origins, hitboxes, rewards, shields, beams and other gameplay signals retain their existing behavior.

## Preview and review

Serve the repository and open `/tools/enemy-art-preview.html`. It includes all three cameras, native-size procedural comparisons, enlarged artwork, complete hit flashes, elite/opacity controls, light/dark backgrounds and pixel look. The live game iframe uses in-memory save storage and can select an enemy, camera, elite effects and blackout. Its smoke button runs the complete roster through three cameras and two looks, checking loaded art, finite poses, tank firing, carrier launches and snake segments.

2026-10-16: inspected source/composite contact sheets and browser previews. Rejected overhead-like pursuit generations were revised; the clipped tank side sheet was replaced with a complete hull and registered carriage. Spinner, tank and carrier parts were reviewed as assembled sprites. Independent browser review confirmed all 15 subjects load in all cameras; light/dark, pixel, flash and opacity controls work, and the preview stacks without horizontal clipping at 390×844.

Radially symmetric drones and the round snake segment retain similar silhouettes across cameras. Camera elevations are selected visually rather than calibrated to an exact numeric angle. Very fine panel detail naturally disappears at native gameplay size; silhouette and fixed accent color carry identity.

## Validation results

Final export: 45 camera views and 15 moving component PNGs, with all required layers present. The combined enemy/background/icon/ship/geometry suite passed **37/37 tests**, including source and output hashes, transparency, source margins, camera selection, image failure fallback, complete flashes, projected spinner motion and recoil axes.

The browser combat smoke check passed **6/6 encounters** across overhead, side-scroll and pursuit with normal and pixel looks, elite scaling and blackout. It exercised the full regular roster, tank firing, carrier launches and snake segment continuity. The final run produced no new browser warnings or errors. An initial test-harness spawn used straight-down movement for the tank, preventing its hold-state firing; the preview now uses the same hover movement required by that behavior. Independent browser review also checked the responsive 390×844 preview and art controls.

## Pursuit refresh · 2026-10-20

Regenerated all 15 regular-enemy pursuit subjects with built-in imagegen and Luna agents, emphasizing nose-on front faces, shallow dorsal reveal, top-left lighting, dark undersides and clear neon accents. The game continues to draw ground shadows separately. Spinner, tank and carrier retain separate registered moving parts. Overhead and side view records are unchanged. Camera elevations are visually selected rather than calibrated measurements.

Full-resolution selected sources and exact prompts remain in each subject’s `sources/` and `prompts/` directories; `selection.json` and `manifest.json` record selected revisions, actual input references, hashes and deterministic export transforms. Explicit empty identity-reference lists mean text-only generations. Splitter uses a measured export crop to exclude faint alpha specks while retaining its complete master. Spinner pursuit layers draw the rotor before its raised core.

The final strict export and 11/11 enemy-art tests passed. The isolated browser combat smoke passed 6/6 encounters across all three cameras and normal/pixel looks, including elite/blackout, tank firing, carrier launches and snake segments, with no console warnings or errors. Light/dark edges and hit-flash rendering were visually sampled. [Before/after and native-size sheet](references/pursuit-2026-10-20.png) and [browser visual check](references/pursuit-browser-2026-10-20.png) preserve the review.

## Comparative review and retries · 2026-10-20

A second visual review rejected seven first-pass refreshes for weaker silhouette, identity or native-size presence. Six retries are now selected: Swarm v4, SnakeHead v4, Tank v8, Splitter v6, Shielder v5 and Blinker v5. Tank returns to a hovering hull with a visible gold reactor and a separate paired-cannon carriage; ground tracks are gone. The original Spinner chase-v3 was restored because the thicker v5 retry still had a less convincing pursuit angle and blade sweep. The other eight first-pass views remain selected.

[Per-enemy judgments](references/pursuit-review-2026-10-20.md) explain every call; [the three-way comparison](references/pursuit-retries-2026-10-20.png) shows originals, first refreshes and final selections at enlarged and native size. Full sources, exact built-in imagegen prompts and rejected attempts are preserved in each subject folder. Luna agents handled production; the parent performed comparative selection, exports and browser validation.

Final validation: strict export, 11/11 enemy-art tests and 6/6 live combat smoke encounters passed with no console warnings/errors. All 30 overhead/side manifest records remain unchanged. The light/dark and hit-flash checks were repeated on the final set. [Browser visual review](references/pursuit-reviewed-browser-2026-10-20.png).
