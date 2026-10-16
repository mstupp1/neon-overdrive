"""Deterministically crop and register Carrier component sheets into aligned masters."""
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[3]
ART = Path(__file__).resolve().parent


def crop_sheet(name, index):
    im = Image.open(ART / 'sheets' / name).convert('RGBA')
    w, h = im.size
    if w % 3:
        raise ValueError(f'{name} width is not divisible into three equal cells')
    x0, x1 = index * w // 3, (index + 1) * w // 3
    return im.crop((x0, 0, x1, h)), [x0, 0, x1, h]


def pad_registered(paths, factor):
    imgs = [Image.open(path).convert('RGBA') for path in paths]
    size = imgs[0].size
    if any(im.size != size for im in imgs):
        raise ValueError('registered images must share a canvas before padding')
    nw, nh = round(size[0] * factor), round(size[1] * factor)
    offset = ((size[0] - nw) // 2, (size[1] - nh) // 2)
    for path, im in zip(paths, imgs):
        small = im.resize((nw, nh), Image.Resampling.LANCZOS)
        out = Image.new('RGBA', size, (0, 0, 0, 0))
        out.alpha_composite(small, offset)
        out.save(path)

def place_component(canvas, component, crop, target):
    """Crop source pixels, resize into explicitly recorded target and alpha composite."""
    part = component.crop(crop)
    part = part.resize((target[2], target[3]), Image.Resampling.LANCZOS)
    canvas.alpha_composite(part, (target[0], target[1]))

# Top: use the third-generation sheet's first cell as the open-bay base.
top, top_cell = crop_sheet('top-v4.png', 0)
top.save(ART / 'sources' / 'top-v3.png')
top_left_cell, top_left_cell_rect = crop_sheet('top-v4.png', 1)
top_right_cell, top_right_cell_rect = crop_sheet('top-v4.png', 2)
left = Image.new('RGBA', top.size, (0, 0, 0, 0))
right = Image.new('RGBA', top.size, (0, 0, 0, 0))
# Isolate the door pixels away from incidental neighboring-hull spill, then fit the two
# panels to the open apertures visible in the extracted base cell.
place_component(left, top_left_cell, (285, 130, 470, 570), (252, 200, 78, 170))
place_component(right, top_right_cell, (235, 125, 390, 565), (394, 200, 78, 170))
left.save(ART / 'layers/top/doorLeft-v3.png')
right.save(ART / 'layers/top/doorRight-v3.png')
pad_registered([ART / 'sources/top-v3.png', ART / 'layers/top/doorLeft-v3.png', ART / 'layers/top/doorRight-v3.png'], 0.88)

# Side base is a dedicated door-removed edit because ImageGen let the long hull cross
# the equal-third crop boundary. Registered components still come from the preserved sheet.
side = Image.open(ART / 'sources' / 'side-v3.png').convert('RGBA')
side_sheet, _ = crop_sheet('side-v4.png', 1)
side_right_sheet, _ = crop_sheet('side-v4.png', 2)
side_left = Image.new('RGBA', side.size, (0, 0, 0, 0))
side_right = Image.new('RGBA', side.size, (0, 0, 0, 0))
place_component(side_left, side_sheet, (440, 320, 724, 430), (780, 365, 500, 138))
place_component(side_right, side_right_sheet, (285, 390, 625, 505), (780, 510, 500, 138))
side_left.save(ART / 'layers/side/doorLeft-v3.png')
side_right.save(ART / 'layers/side/doorRight-v3.png')

# Chase front: keep the directly generated front-elevation hull; isolate corresponding
# doors from the separate two-component sheet and fit each into its open frontal bay.
chase = Image.open(ART / 'sources' / 'chase-v3.png').convert('RGBA')
chase_sheet = Image.open(ART / 'sheets' / 'chase-doors-v3.png').convert('RGBA')
w, h = chase_sheet.size
chase_left_part = chase_sheet
chase_right_part = chase_sheet
chase_left = Image.new('RGBA', chase.size, (0, 0, 0, 0))
chase_right = Image.new('RGBA', chase.size, (0, 0, 0, 0))
place_component(chase_left, chase_left_part, (65, 100, 1020, 625), (700, 215, 220, 185))
place_component(chase_right, chase_right_part, (65, 100, 1020, 625), (1250, 215, 220, 185))
chase_left.save(ART / 'layers/chase/doorLeft-v3.png')
chase_right.save(ART / 'layers/chase/doorRight-v3.png')
pad_registered([ART / 'sources/chase-v3.png', ART / 'layers/chase/doorLeft-v3.png', ART / 'layers/chase/doorRight-v3.png'], 0.88)

selection = {
  'top': 'top-v3.png', 'side': 'side-v3.png', 'chase': 'chase-v3.png',
  'sourceSheets': {
    'top': {'sheet': 'art/enemies/carrier/sheets/top-v4.png', 'grid': [3, 1],
      'cellMap': {'base': 0, 'doorLeft': 1, 'doorRight': 2},
      'baseCellRect': top_cell,
      'registration': {'canvas': list(top.size), 'postTransform': {'uniformScale': 0.88, 'centered': True}, 'doorLeftCrop': [285,130,470,570], 'doorLeftTarget': [252,200,78,170], 'doorRightCrop': [235,125,390,565], 'doorRightTarget': [394,200,78,170]}},
    'side': {'sheet': 'art/enemies/carrier/sheets/side-v4.png', 'grid': [3, 1],
      'cellMap': {'doorLeft': 1, 'doorRight': 2}, 'openHull': 'art/enemies/carrier/sources/side-v3.png',
      'registration': {'canvas': list(side.size), 'doorLeftCrop': [440,320,724,430], 'doorLeftTarget': [780,365,500,138], 'doorRightCrop': [285,390,625,505], 'doorRightTarget': [780,510,500,138]},
      'note': 'The sheet hull crossed the first equal-third crop boundary, so the selected open-hull base is the separately generated side-v3 master.'},
    'chase': {'sheet': 'art/enemies/carrier/sheets/chase-v3.png', 'grid': [3, 1],
      'sheetStatus': 'Original three-cell attempt retained for provenance; cell artwork spills across boundaries. Selected frontal hull is a separate direct generation; doors are cropped from chase-doors-v3.png.',
      'doorSheet': 'art/enemies/carrier/sheets/chase-doors-v3.png', 'doorGrid': [2, 1],
      'base': 'art/enemies/carrier/sources/chase-v3.png',
      'registration': {'canvas': list(chase.size), 'postTransform': {'uniformScale': 0.88, 'centered': True}, 'doorLeftCrop': [65,100,1020,625], 'doorLeftTarget': [700,215,220,185], 'doorRightCrop': [1151,100,2106,625], 'doorRightTarget': [1250,215,220,185]},
      'cameraQA': 'Near-horizon frontal elevation, broad low wings, direct approach; slight visible top plane remains.'}
  }
}
(ART / 'selection.json').write_text(json.dumps(selection, indent=2) + '\n')
