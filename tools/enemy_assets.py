#!/usr/bin/env python3
"""Deterministically export generated enemy masters and write runtime specs/manifests."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art' / 'enemies'
ASSETS = ROOT / 'src' / 'assets' / 'enemies'
SPECS = ROOT / 'src' / 'render' / 'enemyImageSpecs.js'
VIEWS = ('top', 'side', 'chase')
ENEMIES = {
    'dart': (40, '#35e0ff'), 'swarm': (30, '#7dffb0'), 'spinner': (60, '#b56cff'),
    'dasher': (44, '#ff4d6d'), 'snakeHead': (40, '#6dff4d'), 'snakeSeg': (30, '#6dff4d'),
    'sniper': (46, '#ffa62b'), 'tank': (78, '#ffe14d'), 'splitter': (48, '#ff5ce1'),
    'mine': (34, '#ff8a3d'), 'carrier': (84, '#ffc27a'), 'shielder': (52, '#7aa7ff'),
    'weaver': (40, '#d6ff3a'), 'blinker': (44, '#e0d4ff'), 'eclipseDrone': (36, '#c23bff'),
}
LAYERS = {'spinner': ('core', 'rotor'), 'tank': ('carriage',),
          'carrier': ('doorLeft', 'doorRight')}
VIEW_INTENT = {
    'top': 'Direct overhead orthographic; nose faces down-screen (+y).',
    'side': 'True side profile; nose reads screen-left after the side camera transform.',
    'chase': 'Front-facing enemy approach toward the camera/player, viewed near the horizon.',
}


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def export(source: Path, target: Path, size: int = 256, frame: dict | None = None,
           crop_rect: tuple[int, int, int, int] | None = None) -> dict:
    im = Image.open(source).convert('RGBA')
    if frame:
        # Layer masters share the base view's authored coordinate plane and exact export
        # transform. They must be generated on a same-sized transparent canvas with parts
        # placed to match the base; independently cropping a component would break alignment.
        if im.size != tuple(frame['sourceSize'].values()):
            raise ValueError(f'{source} canvas {im.size} does not match base source canvas {frame["sourceSize"]}')
        box = tuple(frame['cropRect'])
        cropped = im.crop(box)
        nw, nh = tuple(frame['resizeSize'])
        offset = tuple(frame['offset'])
    else:
        bbox = crop_rect or im.getchannel('A').getbbox()
        if bbox is None:
            raise ValueError(f'{source} has no visible pixels')
        # Crop transparent margins, preserve the whole subject, then fit within a fixed
        # square with a 10% safety margin for glow and rotation.
        box = bbox
        cropped = im.crop(box)
        inner = round(size * 0.8)
        scale = min(inner / cropped.width, inner / cropped.height)
        nw, nh = max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))
        offset = ((size - nw) // 2, (size - nh) // 2)
    cropped = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.alpha_composite(cropped, offset)
    target.parent.mkdir(parents=True, exist_ok=True)
    out.save(target, format='PNG', optimize=False)
    return {'source': source.relative_to(ROOT).as_posix(), 'sourceSha256': sha(source),
            'output': target.relative_to(ROOT).as_posix(), 'outputSha256': sha(target),
            'sourceSize': {'width': im.width, 'height': im.height},
            'exportSize': {'width': size, 'height': size},
            'cropRect': list(box), 'resizeSize': [nw, nh], 'offset': list(offset),
            'contentBox': [offset[0], offset[1], offset[0] + nw, offset[1] + nh],
            'alpha': True, 'operation': ('apply base view crop/scale/offset to registered full-canvas layer; Lanczos resize'
                                        if frame else 'crop transparent bounds; Lanczos fit to 80% of export square; center on transparent RGBA canvas')}


def bbox_union(paths: list[Path], source_size: tuple[int, int]) -> tuple[int, int, int, int] | None:
    boxes = []
    for path in paths:
        if not path.exists():
            continue
        im = Image.open(path).convert('RGBA')
        if im.size != source_size:
            raise ValueError(f'{path} canvas {im.size} does not match registered source canvas {source_size}')
        box = im.getchannel('A').getbbox()
        if box:
            boxes.append(box)
    if not boxes:
        return None
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


def reference_record(path: Path) -> dict:
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path)}


def normalized_pivot(layer_path: Path, frame: dict, size: int) -> list[float]:
    im = Image.open(layer_path).convert('RGBA')
    box = im.getchannel('A').getbbox()
    if not box:
        return [0.5, 0.5]
    crop = frame['cropRect']
    resized = frame['resizeSize']
    offset = frame['offset']
    px = offset[0] + ((box[0] + box[2]) / 2 - crop[0]) * resized[0] / (crop[2] - crop[0])
    py = offset[1] + ((box[1] + box[3]) / 2 - crop[1]) * resized[1] / (crop[3] - crop[1])
    return [round(px / size, 6), round(py / size, 6)]


def projected_point(point: list[float], frame: dict, size: int) -> list[float]:
    crop, resized, offset = frame['cropRect'], frame['resizeSize'], frame['offset']
    px = offset[0] + (point[0] - crop[0]) * resized[0] / (crop[2] - crop[0])
    py = offset[1] + (point[1] - crop[1]) * resized[1] / (crop[3] - crop[1])
    return [round(px / size, 6), round(py / size, 6)]


def alpha_aspect(path: Path) -> float:
    box = Image.open(path).convert('RGBA').getchannel('A').getbbox()
    return round((box[3] - box[1]) / (box[2] - box[0]), 6) if box else 1.0


def registered_components(selection: dict, view: str) -> dict[str, dict]:
    sheet = selection.get('sourceSheets', {}).get(view, {})
    registration_path = sheet.get('registration') if isinstance(sheet, dict) else None
    if isinstance(registration_path, str) and (ROOT / registration_path).is_file():
        return {item.get('output', ''): item for item in json.loads((ROOT / registration_path).read_text())
                if isinstance(item, dict)}
    if isinstance(registration_path, dict):
        # Some aligned sheets are registered with explicit source crop / destination
        # rectangles in selection.json rather than a separate measured-pivot JSON.
        return {key[:-6]: {'registeredPivot': [value[0] + value[2] / 2,
                                                value[1] + value[3] / 2]}
                for key, value in registration_path.items()
                if key.endswith('Target') and isinstance(value, list) and len(value) == 4}
    return {}


def source_sheet_record(sheet_ref: dict | None) -> dict | None:
    if not sheet_ref:
        return None
    record = dict(sheet_ref)
    for key in ('path', 'sheet', 'doorSheet', 'openHull', 'base'):
        path = record.get(key)
        if isinstance(path, str) and (ROOT / path).is_file():
            record.setdefault('sourceHashes', {})[key] = sha(ROOT / path)
    registration = record.get('registration')
    if isinstance(registration, str) and (ROOT / registration).is_file():
        record['registrationSha256'] = sha(ROOT / registration)
    elif isinstance(registration, dict):
        encoded = json.dumps(registration, sort_keys=True, separators=(',', ':')).encode()
        record['registrationSha256'] = hashlib.sha256(encoded).hexdigest()
    return record


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--manifest', action='store_true', help='write manifests and registry after exporting discovered masters')
    ap.add_argument('--size', type=int, default=256)
    ap.add_argument('--strict', action='store_true', help='fail if any camera master or required layer source is missing')
    args = ap.parse_args()
    registry = {}
    missing = []
    for enemy, (logical_size, tint) in ENEMIES.items():
        subject = ART / enemy
        selection_path = subject / 'selection.json'
        selection = json.loads(selection_path.read_text()) if selection_path.exists() else {}
        views = {}
        manifest_views = {}
        for view in VIEWS:
            source_name = selection.get(view, f'{view}-v1.png')
            src = subject / 'sources' / source_name
            if not src.exists():
                missing.append(f'{enemy}/{view}')
                continue
            dst = ASSETS / enemy / source_name
            source_image = Image.open(src).convert('RGBA')
            layer_paths = {layer: subject / 'layers' / view / f'{layer}-{source_name.removeprefix(view + "-")}'
                           for layer in LAYERS.get(enemy, ())}
            common_box = bbox_union([src, *layer_paths.values()], source_image.size)
            record = export(src, dst, args.size, crop_rect=common_box)
            prompt_path = subject / 'prompts' / Path(source_name).with_suffix('.txt').name
            record['cameraIntent'] = VIEW_INTENT[view]
            record['prompt'] = reference_record(prompt_path) if prompt_path.exists() else None
            sheet_ref = selection.get('sourceSheets', {}).get(view)
            if isinstance(sheet_ref, str):
                sheet_ref = {'path': sheet_ref}
            identity_refs = []
            if sheet_ref:
                record['sourceSheet'] = source_sheet_record(sheet_ref)
                identity_refs = sheet_ref.get('identityReferences', [])
            else:
                record['sourceSheet'] = None
            if not identity_refs and view != 'top':
                top_identity = subject / 'sources' / selection.get('top', 'top-v1.png')
                identity_refs = [top_identity.relative_to(ROOT).as_posix()] if top_identity.exists() else []
            record['inputReferences'] = []
            for reference in identity_refs:
                path = reference.get('path') if isinstance(reference, dict) else reference
                if isinstance(path, str) and (ROOT / path).is_file():
                    record['inputReferences'].append(reference_record(ROOT / path))
            manifest_views[view] = record
            views[view] = {'src': f'../assets/enemies/{enemy}/{source_name}',
                           'width': logical_size, 'height': logical_size,
                           'sourceSize': record['sourceSize'], 'anchor': [0.5, 0.5]}
            layer_specs = {}
            registration = registered_components(selection, view)
            for layer in LAYERS.get(enemy, ()):
                layer_src = layer_paths[layer]
                layer_dst = ASSETS / enemy / 'layers' / view / f'{layer}-{source_name.removeprefix(view + "-")}'
                layer_src_rel = f'../assets/enemies/{enemy}/layers/{view}/{layer}-{source_name.removeprefix(view + "-")}'
                layer_spec = {'src': layer_src_rel, 'width': logical_size, 'height': logical_size,
                              'anchor': [0.5, 0.5], 'pivot': [0.5, 0.5]}
                if not layer_src.exists():
                    missing.append(f'{enemy}/{view}/layer:{layer}')
                    manifest_views[view].setdefault('layers', {})[layer] = {
                        'available': False, 'expectedSource': layer_src.relative_to(ROOT).as_posix(),
                        'expectedOutput': layer_dst.relative_to(ROOT).as_posix(),
                        'inputReferences': record['inputReferences'], 'sourceSheet': record['sourceSheet'],
                    }
                    layer_specs[layer] = layer_spec
                    continue
                layer_record = export(layer_src, layer_dst, args.size, record)
                layer_record['inputReferences'] = record['inputReferences'] + [reference_record(src)]
                layer_record['sourceSheet'] = record['sourceSheet']
                layer_prompt_path = subject / 'prompts' / 'layers' / view / f'{layer}-{layer_src.stem.removeprefix(layer + "-")}.txt'
                layer_record['prompt'] = (reference_record(layer_prompt_path)
                                          if layer_prompt_path.is_file() else record['prompt'])
                manifest_views[view].setdefault('layers', {})[layer] = layer_record
                layer_spec['sourceSize'] = layer_record['sourceSize']
                reg = registration.get(layer_src.relative_to(ROOT).as_posix(),
                                       registration.get(layer, {}))
                pivot_source = reg.get('registeredPivot')
                layer_spec['pivot'] = (projected_point(pivot_source, record, args.size)
                                       if pivot_source else normalized_pivot(layer_src, record, args.size))
                layer_record['measuredPivotSourcePx'] = pivot_source
                layer_record['measuredPivotExportNormalized'] = layer_spec['pivot']
                if enemy == 'spinner' and layer == 'rotor':
                    layer_spec['spinAspect'] = alpha_aspect(layer_src)
                    layer_record['spinAspectHeightOverWidth'] = layer_spec['spinAspect']
                layer_specs[layer] = layer_spec
            if layer_specs:
                views[view]['layers'] = layer_specs
        if views:
            registry[enemy] = {'tint': tint, 'views': views}
            subject.mkdir(parents=True, exist_ok=True)
            selected_prompts = {v: (manifest_views[v].get('prompt') or {}).get('path')
                                for v in manifest_views}
            (subject / 'manifest.json').write_text(json.dumps({
                'subject': enemy, 'logicalSize': logical_size, 'tint': tint,
                'views': manifest_views,
                'prompts': selected_prompts,
                'generation': 'built-in imagegen; original selected transparent PNGs retained under sources/',
            }, indent=2) + '\n')
            brief_lines = [f'# {enemy} enemy artwork', '',
                           f'Logical footprint: {logical_size} × {logical_size} units. Accent tint: `{tint}`.',
                           '', 'Selected camera masters:', '']
            for mode in VIEWS:
                if mode not in manifest_views:
                    brief_lines.append(f'- **{mode}:** pending source.')
                    continue
                rec = manifest_views[mode]
                brief_lines.append(f'- **{mode}:** `{Path(rec["source"]).name}` — {VIEW_INTENT[mode]}')
                if rec.get('sourceSheet'):
                    source_sheet_path = (rec['sourceSheet'].get('path') or
                                         rec['sourceSheet'].get('sheet') or
                                         rec['sourceSheet'].get('doorSheet'))
                    if source_sheet_path:
                        brief_lines.append(f'  Source sheet: `{source_sheet_path}`.')
                if rec.get('layers'):
                    for key, layer_rec in rec['layers'].items():
                        state = 'registered source present' if layer_rec.get('sourceSha256') else 'required source pending'
                        brief_lines.append(f'  Layer `{key}`: {state}.')
            brief_lines += ['', 'Exact prompt text is stored under `prompts/`; source masters and input references are recorded in `manifest.json`.',
                            'Exports are deterministic transparent PNGs with content hashes and measured source-frame transforms.']
            brief_path = subject / 'brief.md'
            previous = brief_path.read_text() if brief_path.exists() else ''
            review = ('\n## Review' + previous.split('\n## Review', 1)[1]
                      if '\n## Review' in previous else '')
            brief_path.write_text('\n'.join(brief_lines) + review + '\n')
    if args.manifest:
        body = '// Generated by tools/enemy_assets.py; source masters and prompts live under art/enemies/.\n'
        body += '// `width` and `height` are logical game units; anchors and pivots are normalized (0..1).\n'
        body += 'export const ENEMY_IMAGE_SPECS = ' + json.dumps(registry, indent=2) + ';\n'
        SPECS.write_text(body)
    if missing:
        print('Missing source masters: ' + ', '.join(missing))
        if args.strict:
            raise SystemExit(1)
    print(f'Exported {sum(len(v["views"]) for v in registry.values())} views for {len(registry)} subjects.')


if __name__ == '__main__':
    main()
