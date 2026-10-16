# Characters, portraits and identity-preserving revisions

Read `art/portraits/README.md`, `src/ui/portraits.js`, `src/ui/comms.js` and the relevant screen before choosing framing or dimensions. Accepted portrait originals and exact prompts are in `art/portraits/sources/` and `prompts/`. The same renderer serves dialogue and pilot UI; the current pixel presentation uses a 96px portrait. A portrait is not a combat sprite: ship camera axes, weapon anchors and three-camera coverage do not automatically apply.

## Establish identity

For an existing character, inspect the selected full-resolution image and relevant character/story definitions. Record the recognizable features that must remain: face or mask geometry, helmet, proportions, silhouette, established clothing/materials, palette and distinctive markings. Preserve established identity traits; do not invent gender or other canon to fill unspecified details. ECHO's existing brief leaves gender unspecified. MAG and SIGNAL demonstrate non-human character forms; do not force future characters into those forms.

For a new character, derive the brief from the user's concept and existing visual world. Establish one selected identity image before making expressions, outfits, poses or alternate views. Use an accepted portrait as a material/lighting reference where useful, while retaining the new character's own silhouette and personality. Request references or clarify only when a consequential identity choice cannot be inferred from the request or project.

## Generate and revise

Use the selected original as an image reference. Name the requested change and the invariants in the exact prompt: for example, change only the expression while preserving face/helmet geometry, costume, palette, camera, apparent head size and lighting. Match framing and eye-line across dialogue expressions so swaps do not visibly jump. If the request is a redesign, state which identity features remain and which may change instead of freezing everything.

Ask for true transparency and a clean isolated bust when the consumer expects a portrait. Keep important anatomy and silhouette within the frame; inspect actual alpha bounds and crop. Do not add baked UI frames, names, dialogue, rarity borders or environment effects. New full-body or animated characters need their own consumer-driven pose, camera and part plan; do not infer those assets from a portrait request.

## Accept and integrate

Compare the selected original and all variants side by side, enlarged and at the actual display size. Check face/helmet landmarks, silhouette, accent hue, apparent scale, eye-line and alpha edges on light/dark backgrounds. An attractive variant can still be the wrong character. Re-generate identity or framing mistakes through imagegen rather than painting a corrective face or silhouette in an export script.

Preserve original generations, references, exact prompts, selected mappings and export hashes. For the current portraits the consumer expects 256px RGBA exports; use a new versioned filename and update its actual reference for a revision rather than changing an accepted file in place. Keep stable character/speaker IDs and procedural fallback keys when versioning files. The current renderer derives filenames from the character ID, so introduce an explicit filename mapping there for a replacement rather than renaming a speaker to match a versioned image. Reuse the existing cached portrait/menu renderer and fallback, and check dialogue and pilot UI in normal/pixel looks, narrow portrait layout and relevant input flows with isolated storage. Do not claim a variant passed review based on an older portrait's results.
