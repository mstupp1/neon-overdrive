"""Re-export selected HUD originals without altering generated artwork content."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / 'art/hud/ability-gauges/manifest.json'
manifest = json.loads(MANIFEST.read_text())
for spec in manifest['assets'].values():
    source = ROOT / spec['source']
    image = Image.open(source).convert('RGBA')
    # Ignore only almost-invisible alpha noise when measuring the footprint; keep
    # original alpha in the crop and an 8px margin for the generated edge glow.
    bounds = image.getchannel('A').point(lambda v: 255 if v > 4 else 0).getbbox()
    box = (max(0, bounds[0]-8), max(0, bounds[1]-8), min(image.width, bounds[2]+8), min(image.height, bounds[3]+8))
    crop = image.crop(box)
    size = max(crop.size)
    square = Image.new('RGBA', (size, size))
    offset = ((size-crop.width)//2, (size-crop.height)//2)
    square.alpha_composite(crop, offset)
    target = ROOT / spec['runtime']
    square.resize((256, 256), Image.Resampling.LANCZOS).save(target, optimize=True)
    spec.update(crop=list(box), squareSize=size, cropOffset=list(offset), padding=8, boundsAlphaThreshold=4,
                sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                runtimeSha256=hashlib.sha256(target.read_bytes()).hexdigest())
MANIFEST.write_text(json.dumps(manifest, indent=2)+'\n')
