#!/usr/bin/env python3
"""Export selected generated boss art using measured, reproducible registration."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/bosses'
SIZES = {'warden': 230, 'hydra': 250, 'omega': 120, 'eclipse': 210}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    for boss, size in SIZES.items():
        selection = json.loads((ART / boss / 'selection.json').read_text())
        assets = []
        for mode, spec in selection['views'].items():
            source = ROOT / spec['source']
            im = Image.open(source).convert('RGBA')
            bbox = im.getchannel('A').point(lambda a: 255 if a > 32 else 0).getbbox()
            if not bbox or im.getchannel('A').getextrema() != (0,255):
                raise ValueError(f'{source}: genuine alpha required')
            if min(bbox[0],bbox[1],im.width-bbox[2],im.height-bbox[3]) < 2:
                raise ValueError(f'{source}: silhouette touches source edge')
            # Uniform scaling about the measured core/eye; preserve its overlay
            # position in the existing logical sprite box for every camera.
            scale = spec['logicalScale'] * 512 / size
            nw, nh = round(im.width*scale), round(im.height*scale)
            origin = spec['sourceAnchor']
            target = spec.get('logicalAnchor',[0,0])
            offset = [round(256 + target[i]*512/size-origin[i]*scale) for i in range(2)]
            bounds = [bbox[0]*scale+offset[0],bbox[1]*scale+offset[1],bbox[2]*scale+offset[0],bbox[3]*scale+offset[1]]
            if min(bounds[:2]) < 4 or max(bounds[2:]) > 508:
                raise ValueError(f'{source}: export clips visible artwork: {bounds}')
            out = Image.new('RGBA',(512,512))
            out.alpha_composite(im.resize((nw,nh),Image.Resampling.LANCZOS),tuple(offset))
            runtime = ROOT / f'src/assets/bosses/{boss}/{mode}-v1.png'
            runtime.parent.mkdir(parents=True,exist_ok=True)
            out.save(runtime)
            assets.append({'camera':mode,'source':str(source.relative_to(ROOT)),
                'source_sha256':sha(source),'runtime':str(runtime.relative_to(ROOT)),
                'runtime_sha256':sha(runtime),'sourceSize':[im.width,im.height],
                'operation':'uniform Lanczos scale about measured anchor onto transparent 512px square',
                'logicalScale':spec['logicalScale'],'sourceAnchor':origin,'logicalAnchor':target,
                'resizeSize':[nw,nh],'offset':offset,'alphaBounds':list(out.getchannel('A').getbbox()),
                'prompt':spec['prompt'],'prompt_sha256':sha(ROOT/spec['prompt']),'references':[{'path':p,'sha256':sha(ROOT/p)} for p in spec.get('references',[])]})
        (ART/boss/'manifest.json').write_text(json.dumps({'method':'built-in imagegen; deterministic Pillow export','logicalSize':size,'assets':assets},indent=2)+'\n')
        print(f'{boss}: {len(assets)} registered views')

if __name__ == '__main__':
    main()
