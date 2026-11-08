"""The 3D ground picture right up to a cut map's edge.

The ground mesh ends exactly on the cut outline, but the painted ground (snow.png) stopped a few pixels short of it, with a dark rim and the
sheet's colour beyond; the rim of the mesh showed them as a saw-tooth fringe. Within `inset` px inside the cut and `outset` px outside it, each
pixel takes the colour of the nearest pixel further in.

As a script:  python3 tools/relief_edge.py web/public/golan73/relief   (reads relief.json's cut, rewrites snow.png in place)
"""
import json, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd


def fill_edge(path, rings, inset=5, outset=2):
    im = Image.open(path); mode = im.mode
    a = np.array(im.convert('RGBA' if 'A' in mode or mode == 'P' and 'transparency' in im.info else 'RGB'))
    m = Image.new('L', (a.shape[1], a.shape[0]), 0); d = ImageDraw.Draw(m)
    for r in rings: d.polygon([tuple(p) for p in r], fill=255)
    cut = np.array(m) > 127
    inner = nd.binary_erosion(cut, iterations=inset)
    band = ~inner & (nd.distance_transform_edt(~cut) <= outset)
    _, (iy, ix) = nd.distance_transform_edt(~inner, return_indices=True)
    a[band] = a[iy[band], ix[band]]
    out = Image.fromarray(a)
    if mode == 'P': out = out.quantize(64, dither=Image.Dither.NONE)          # The Bulge keeps a small palette, as relief.py writes it
    out.save(path, optimize=True)
    assert inner.any() and band.sum() < cut.sum() * 0.2, 'cut outline and picture do not match'
    return int(band.sum())


if __name__ == '__main__':
    for d in sys.argv[1:]:
        meta = json.load(open(d + '/relief.json'))
        print(d, fill_edge(d + '/snow.png', meta['cut']), 'edge pixels filled')
