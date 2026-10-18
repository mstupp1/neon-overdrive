#!/usr/bin/env python3
"""Reproduce selected miniboss/module exports without modifying source art."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export(selection_path):
    selection = json.loads(selection_path.read_text())
    records = []
    for spec in selection['assets']:
        source = ROOT / spec['source']
        image = Image.open(source).convert('RGBA')
        source_size = list(image.size)
        rotation = spec.get('sourceRotation', 0)
        if rotation not in (0, 90, 180, 270):
            raise ValueError('sourceRotation must be a clockwise quarter-turn')
        if rotation:
            image = image.rotate(-rotation, expand=True)
        alpha = image.getchannel('A')
        bounds = alpha.point(lambda x: 255 if x > 32 else 0).getbbox()
        if not bounds or alpha.getextrema() != (0, 255):
            raise ValueError(f'{source}: genuine transparent/opaque pixels required')
        if min(bounds[0], bounds[1], image.width-bounds[2], image.height-bounds[3]) < 2:
            raise ValueError(f'{source}: source silhouette touches edge')
        size = spec['logicalSize']
        scale = spec['visibleExtent'] / max(bounds[2]-bounds[0], bounds[3]-bounds[1])
        scale *= 512 / size
        anchor = spec.get('sourceAnchor', [(bounds[0]+bounds[2])/2, (bounds[1]+bounds[3])/2])
        target = spec.get('logicalAnchor', [0, 0])
        offset = [round(256 + target[i]*512/size - anchor[i]*scale) for i in range(2)]
        placed = [bounds[0]*scale+offset[0], bounds[1]*scale+offset[1], bounds[2]*scale+offset[0], bounds[3]*scale+offset[1]]
        if min(placed[:2]) < 4 or max(placed[2:]) > 508:
            raise ValueError(f'{source}: export would clip silhouette {placed}')
        dimensions = [round(image.width*scale), round(image.height*scale)]
        output = Image.new('RGBA', (512, 512))
        output.alpha_composite(image.resize(dimensions, Image.Resampling.LANCZOS), tuple(offset))
        runtime = ROOT / spec['runtime']
        runtime.parent.mkdir(parents=True, exist_ok=True)
        output.save(runtime)
        prompt = ROOT / spec['prompt']
        def logical_point(point):
            x = (point[0]*dimensions[0]/image.width+offset[0]-256)*size/512
            y = (point[1]*dimensions[1]/image.height+offset[1]-256)*size/512
            if spec['camera'] == 'side':
                x, y = y, -x
            return [round(x, 2), round(y, 2)]

        anchors = {}
        for layer, points in spec.get('sourceVisualPoints', {}).items():
            anchors[layer] = (logical_point(points) if points and isinstance(points[0], (int, float))
                else [logical_point(point) for point in points])
        records.append({**spec, 'sourceSize': source_size, 'orientedSourceSize': list(image.size),
            'registrationSpace': 'source after sourceRotation clockwise', 'sourceAnchor': anchor,
            'logicalAnchor': target, 'resizeSize': dimensions, 'offset': offset,
            'visualAnchors': anchors,
            'operation': 'optional lossless quarter-turn; uniform Lanczos scale about measured anchor onto transparent 512px square',
            'source_sha256': sha(source), 'runtime_sha256': sha(runtime),
            'prompt_sha256': sha(prompt), 'alphaBounds': list(output.getchannel('A').getbbox()),
            'references': [{'path': p, 'sha256': sha(ROOT/p)} for p in spec.get('references', [])]})
    manifest = selection_path.with_name('manifest.json')
    manifest.write_text(json.dumps({'method': 'built-in imagegen; deterministic Pillow export', 'assets': records}, indent=2)+'\n')
    print(f'{selection_path.parent.relative_to(ROOT)}: {len(records)} exports')


if __name__ == '__main__':
    for category in ('minibosses', 'modules'):
        for path in sorted((ROOT / 'art' / category).glob('*/selection.json')):
            export(path)
