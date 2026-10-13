#!/usr/bin/env python3
"""Inspect and prepare NEON OVERDRIVE background PNGs; this tool never edits artwork."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image


def inspect(path: Path) -> dict:
    with Image.open(path) as source:
        image_format = source.format
        image = source.copy()
    bands = image.getbands()
    alpha = image.getchannel("A") if "A" in bands else None
    alpha_extrema = alpha.getextrema() if alpha else None
    visible_bbox = alpha.getbbox() if alpha else image.getbbox()
    transparent_pixels = 0
    partial_pixels = 0
    if alpha:
        hist = alpha.histogram()
        transparent_pixels = hist[0]
        partial_pixels = sum(hist[1:255])
    total = image.width * image.height
    colors = image.getcolors(maxcolors=1_000_000)
    edge_alpha_max = None
    clear_vertical_edges = None
    if alpha:
        top = alpha.crop((0, 0, image.width, 1)).getextrema()[1]
        bottom = alpha.crop((0, image.height - 1, image.width, image.height)).getextrema()[1]
        edge_alpha_max = {"top": top, "bottom": bottom}
        clear_vertical_edges = top == 0 and bottom == 0
    return {
        "path": str(path),
        "format": image_format,
        "width": image.width,
        "height": image.height,
        "mode": image.mode,
        "has_alpha": alpha is not None,
        "alpha_extrema": alpha_extrema,
        "transparent_percent": round(100 * transparent_pixels / total, 3),
        "partial_alpha_percent": round(100 * partial_pixels / total, 3),
        "visible_bbox": visible_bbox,
        "edge_alpha_max": edge_alpha_max,
        "clear_vertical_edges": clear_vertical_edges,
        "unique_colors": len(colors) if colors is not None else None,
    }


def print_report(
    path: Path,
    expect: tuple[int, int] | None,
    require_alpha: bool,
    require_clear_vertical_edges: bool = False,
) -> bool:
    report = inspect(path)
    print(json.dumps(report, indent=2))
    problems = []
    if expect and (report["width"], report["height"]) != expect:
        problems.append(f"expected {expect[0]}x{expect[1]}, got {report['width']}x{report['height']}")
    if require_alpha and not report["has_alpha"]:
        problems.append("image has no alpha channel")
    if require_alpha and report["transparent_percent"] == 0:
        problems.append("image has an alpha channel but no transparent pixels")
    if require_clear_vertical_edges and not report["has_alpha"]:
        problems.append("clear vertical edges require an alpha channel")
    elif require_clear_vertical_edges and not report["clear_vertical_edges"]:
        problems.append("top and bottom rows must be fully transparent for a clean vertical tile")
    if report["visible_bbox"] is None:
        problems.append("image contains no visible pixels")
    if problems:
        for problem in problems:
            print(f"error: {problem}", file=sys.stderr)
        return False
    return True


def load_rgba(path: Path) -> Image.Image:
    with Image.open(path) as source:
        return source.convert("RGBA")


def validate(args: argparse.Namespace) -> int:
    if (args.width is None) != (args.height is None):
        print("error: --width and --height must be provided together", file=sys.stderr)
        return 2
    expected = (args.width, args.height) if args.width is not None else None
    return 0 if print_report(args.image, expected, args.require_alpha, args.require_clear_vertical_edges) else 1


def export(args: argparse.Namespace) -> int:
    if (args.width is None) != (args.height is None):
        print("error: --width and --height must be provided together", file=sys.stderr)
        return 2
    expected = (args.width, args.height) if args.width is not None else None
    if not print_report(args.image, expected, args.require_alpha, args.require_clear_vertical_edges):
        return 1
    if args.image.resolve() == args.output.resolve():
        print("error: output must not overwrite the source image", file=sys.stderr)
        return 1
    image = load_rgba(args.image)
    padding = args.padding
    if padding < 0 or padding * 2 >= min(args.out_width, args.out_height):
        print("error: padding must leave a nonempty image area", file=sys.stderr)
        return 2
    image = image.resize((args.out_width - padding * 2, args.out_height - padding * 2), Image.Resampling.NEAREST)
    if padding:
        framed = Image.new("RGBA", (args.out_width, args.out_height))
        framed.paste(image, (padding, padding))
        image = framed
    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output, format="PNG", optimize=False)
    print(f"wrote {args.output} ({image.width}x{image.height}, RGBA, nearest)")
    return 0


def tile_preview(args: argparse.Namespace) -> int:
    if not print_report(args.image, None, args.require_alpha, args.require_clear_vertical_edges):
        return 1
    tile = load_rgba(args.image)
    if args.image.resolve() == args.output.resolve():
        print("error: output must not overwrite the source image", file=sys.stderr)
        return 1
    preview = Image.new("RGBA", (tile.width * args.columns, tile.height * args.rows))
    for y in range(args.rows):
        for x in range(args.columns):
            preview.alpha_composite(tile, (x * tile.width, y * tile.height))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    preview.save(args.output, format="PNG", optimize=False)
    print(f"wrote {args.output} ({preview.width}x{preview.height}, repeated {args.columns}x{args.rows})")
    return 0


def positive(value: str) -> int:
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return number


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    check = subparsers.add_parser("validate", help="report image dimensions, alpha, and visible bounds")
    check.add_argument("image", type=Path)
    check.add_argument("--width", type=positive)
    check.add_argument("--height", type=positive)
    check.add_argument("--require-alpha", action="store_true")
    check.add_argument("--require-clear-vertical-edges", action="store_true")
    check.set_defaults(run=validate)

    make = subparsers.add_parser("export", help="convert to RGBA and resize with nearest-neighbor sampling")
    make.add_argument("image", type=Path)
    make.add_argument("output", type=Path)
    make.add_argument("--out-width", type=positive, required=True)
    make.add_argument("--out-height", type=positive, required=True)
    make.add_argument("--padding", type=int, default=0, help="transparent export margin in pixels (source pixels remain intact)")
    make.add_argument("--width", type=positive, help="required source width")
    make.add_argument("--height", type=positive, help="required source height")
    make.add_argument("--require-alpha", action="store_true")
    make.add_argument("--require-clear-vertical-edges", action="store_true")
    make.set_defaults(run=export)

    tile = subparsers.add_parser("tile-preview", help="repeat a PNG into a transparent tiling preview")
    tile.add_argument("image", type=Path)
    tile.add_argument("output", type=Path)
    tile.add_argument("--columns", type=positive, default=3)
    tile.add_argument("--rows", type=positive, default=2)
    tile.add_argument("--require-alpha", action="store_true")
    tile.add_argument("--require-clear-vertical-edges", action="store_true")
    tile.set_defaults(run=tile_preview)

    args = parser.parse_args()
    try:
        return args.run(args)
    except (OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
