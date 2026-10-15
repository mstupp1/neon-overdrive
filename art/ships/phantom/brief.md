# PHANTOM generated hull set

Three built-in imagegen views are saved under `sources/`, with the exact selected prompts under `prompts/`. The top master follows PHANTOM's stock star-manta silhouette and violet identity. The side view is a real low side elevation with nose right and foreshortened crescent wings. The pursuit view looks from astern with the paired engine apertures visible. The top-view emitter and engine tips, side-view emitter and engine openings, and pursuit-view emitter and engine openings were checked visually and recorded in `src/render/shipImageSpecs/phantom.js` as normalized full-source coordinates.

Runtime images are 256x256 transparent RGBA exports created with `tools/ship_assets.py`; the original full-resolution RGBA masters are retained. Source and runtime SHA-256 hashes, references, camera notes, export settings and measured pixel anchors are in `manifest.json`.

Visual review confirmed the silhouette, stock violet palette, alpha channel, visible emitter ports and engine apertures. The side image faces right with a strongly foreshortened wing stack. The pursuit image has a short, rear-facing engine-dominant profile. Browser firing and exhaust alignment remain for the parent integration pass.
