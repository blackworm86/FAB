"""Trace the printed map's forest pattern into docs/maps/vector/map-woods.png (16 alpha levels, one colour).
Needs the scan at web/public/map.jpg (not in the repo). Run before import_map.py."""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
im = Image.open('web/public/map.jpg').convert('RGB').crop((0, 0, 1740, 1584)); a = np.array(im).astype('float32')
lum = a.mean(2); R, G, B = a[..., 0], a[..., 1], a[..., 2]
bl = B - R > 25; dark = lum < 100; tan = R - B > 36; white = lum > 226
box = ndi.binary_dilation((B - R > 6) & (lum > 192) & ~bl, iterations=2); box = ndi.binary_opening(box, structure=np.ones((3, 3)), iterations=3); box = ndi.binary_dilation(box, iterations=6)   # the scan's pale unit-label boxes
excl = ndi.binary_dilation(bl | white | tan, iterations=3) | ndi.binary_dilation(dark, iterations=3) | box
al = np.clip((189 - lum) / 48, 0, 1); al = np.where(al < 0.27, 0, al); al = np.where(excl, 0, al)
lab, n = ndi.label(ndi.binary_dilation(al > 0, iterations=2)); keep = np.zeros(n + 1, bool)
for i, s in enumerate(ndi.find_objects(lab), 1):
    h = s[0].stop - s[0].start; w = s[1].stop - s[1].start; ar = (lab[s] == i).sum()
    if ar >= 140 and not (max(h, w) > 4 * min(h, w) and ar < 900): keep[i] = True
al = np.where(keep[lab], al, 0) * 0.82
q = np.round(al * 15).astype('uint8'); alpha = (np.arange(16) * 255 / 15).astype('uint8')
img = Image.fromarray(q, 'P'); img.putpalette([92, 116, 78] * 16 + [0] * 3 * 240)
img.save('docs/maps/vector/map-woods.png', optimize=True, transparency=bytes(alpha.tolist()))
