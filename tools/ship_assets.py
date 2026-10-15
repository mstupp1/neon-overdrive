"""Deterministic RGBA exports and reports for generated ship sprites (no art edits)."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image
from PIL.PngImagePlugin import PngInfo


def report(path):
    with Image.open(path) as image:
        assert image.mode == 'RGBA', f'{path}: expected RGBA'
        alpha = image.getchannel('A')
        low, high = alpha.getextrema()
        assert low == 0 and high >= 250, f'{path}: expected near-opaque hull and clear alpha'
        w, h = image.size
        assert all(alpha.getpixel((x, y)) == 0 for x, y in
                   [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] +
                   [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]), f'{path}: clipped edge'
        result = {'path': path.as_posix(), 'size': list(image.size), 'mode': image.mode, 'alpha_extrema': [low, high],
                  'alpha_bbox': list(alpha.getbbox()), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
        if 'neon_ship_export' in image.info:
            result.update(json.loads(image.info['neon_ship_export']))
        return result


def validate_manifest(path):
    manifest = json.loads(path.read_text())
    assets = manifest['assets']
    assert {a['view'] for a in assets} == {'top', 'side', 'pursuit'}, 'Expected three distinct camera views'
    for asset in assets:
        for kind in ['source', 'runtime']:
            file = Path(asset[kind])
            assert hashlib.sha256(file.read_bytes()).hexdigest() == asset[kind + '_sha256'], f'{file}: hash mismatch'
        runtime = report(Path(asset['runtime']))
        assert runtime['size'] == [256, 256], 'Expected 256px runtime export'
        with Image.open(asset['source']) as source:
            assert source.mode == 'RGBA', 'Source needs genuine alpha'
            assert list(source.size) == asset['source_size'], 'Recorded source dimensions differ'
            alpha = source.getchannel('A')
            radius = max(3, round(max(source.size) * 0.006))
            for kind in ['source_muzzle_pixels', 'source_engine_pixels']:
                assert asset[kind], f'{asset["view"]}: no {kind}'
                for x, y in asset[kind]:
                    assert 0 <= x < source.width and 0 <= y < source.height, f'{asset["view"]}: anchor outside source'
                    area = alpha.crop((max(0, round(x) - radius), max(0, round(y) - radius),
                                       min(source.width, round(x) + radius + 1), min(source.height, round(y) + radius + 1)))
                    assert area.getextrema()[1] > 32, f'{asset["view"]}: {kind} anchor {(x,y)} misses the visible hull'
    return {'subject': manifest['subject'], 'views': len(assets), 'status': 'valid'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path, nargs='?')
    parser.add_argument('--size', type=int, default=256)
    parser.add_argument('--margin', type=int, default=0, help='Add transparent runtime margins without changing the source master')
    parser.add_argument('--manifest', action='store_true', help='Validate provenance, runtime alpha and measured attachments')
    args = parser.parse_args()
    if args.manifest:
        assert not args.output, 'Manifest validation does not export images'
        print(json.dumps(validate_manifest(args.source), indent=2))
        return
    if args.output:
        assert 0 <= args.margin < args.size / 2, 'Margin must leave room for the ship'
        assert not args.output.exists(), 'Choose a new version; do not overwrite an existing export.'
        with Image.open(args.source) as image:
            assert image.mode == 'RGBA', 'Source must have genuine alpha'
            assert image.getchannel('A').getextrema()[0] == 0, 'Source has no transparency'
            args.output.parent.mkdir(parents=True, exist_ok=True)
            # Preserve source aspect ratio; pad rather than stretching non-square masters.
            source_size = list(image.size)
            inner_size = args.size - 2 * args.margin
            image.thumbnail((inner_size, inner_size), Image.Resampling.LANCZOS)
            canvas = Image.new('RGBA', (args.size, args.size))
            left, top = (args.size - image.width) // 2, (args.size - image.height) // 2
            canvas.alpha_composite(image, (left, top))
            metadata = PngInfo()
            metadata.add_text('neon_ship_export', json.dumps({'source_size': source_size, 'content_box': [left, top, image.width, image.height], 'margin': args.margin}))
            canvas.save(args.output, optimize=True, pnginfo=metadata)
    print(json.dumps(report(args.output or args.source), indent=2))


if __name__ == '__main__':
    main()
