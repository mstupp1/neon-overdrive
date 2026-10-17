# Boss artwork

Warden, Hydra, Omega and Eclipse use generated overhead, left-facing side and front-facing pursuit artwork. Minibosses retain their existing artwork. Runtime files live under `src/assets/bosses/`; `bossImageSpecs.js` selects the camera and records measured visual mount positions.

Each subject directory preserves full imagegen originals and exact prompts. `selection.json` chooses the source revision, measured core/eye anchor, uniform scale and logical placement. `manifest.json` records source, prompt, reference and runtime hashes plus the deterministic export operation. Unselected iterations remain outside the selected mapping. Sources may be rectangular; runtime body canvases are 512×512 RGBA.

Run `python3 tools/boss_assets.py` to reproduce body exports and manifests. Alpha is preserved, including faint edge emission; the exporter checks meaningful silhouette pixels above alpha 32 against source and export edges. Transparent padding does not repair clipped art. The common registration puts each reactor/eye at the existing dynamic overlay position. Side images are compensated by −90° during baking before the world camera turns them clockwise.

The static bodies omit Warden's legs and tracking turrets, Hydra's tentacles and pupil, and Omega's orbiting nodes and shards. Those remain separate animated pieces; Hydra's tip pods and Omega's nodes/shards now have shared radial generated artwork in `components/`. Omega's energy ring and data tethers, all core pulses, exhaust, shields, attack telegraphs and projectiles remain runtime effects. Phase accents are recolored once in cached sprites, preserving neutral armor. Hitboxes, firing origins and attack timing retain their existing values.

Open `/tools/boss-art-preview.html` for the actual boss draw routines in all three cameras, phase colors, hit flashes, normal/pixel looks and light/dark backdrops. The live encounter iframe uses in-memory storage, so preview progression does not touch the real save. The smaller inset is explicitly a fitted comparison; the large sample is 1.16× logical scale.

Validation commands:

```sh
node --test tools/test_boss_art.mjs tools/test_boss_images.mjs
node --test tools/test_background_layers.mjs tools/test_icon_images.mjs tools/test_ship_art.mjs tools/test_enemy_art.mjs
```

## Visual review notes

The first Warden and Hydra pursuit attempts repeated the overhead reference; later low, broad front views are selected instead. Hydra's first broad front revision touched the source edge, so a new imagegen framing revision restores the complete horn outline. Eclipse's side view is revised to reduce the overhead camera bias. Omega is radial: its front silhouette remains close to circular while the side view is strongly foreshortened.

Warden turret, engine and rack-light positions are measured on the selected body rather than inferred from prompt coordinates. Main reactors and Hydra's eye use registered source anchors. The world still animates legs, tentacles and orbital paths in its existing logical plane; this pass does not change their combat geometry or create a 3D skeletal rig.
