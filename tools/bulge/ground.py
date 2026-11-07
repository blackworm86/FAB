"""The Bulge board's ground, drawn in the printed map's manner from the game's own data: the print's pale paper in the river valleys
darkening to grey-olive on the high Ardennes (its relief washes), mottled as the print is, and its woods redrawn as a stipple of tree crowns.

Usage: python3 -I tools/bulge/ground.py web/public/map.jpg <lines.png> docs/maps/vector/map-ground.jpg
(lines.png: the board's own line work rendered alone on white, so the scan's printed lines are left out)   (then web/scripts/import_map.py)
The scan (reference only, never committed) is only read for its colours and for where its woods are: the median paper colour at each
height of the real ground (web/public/relief/height.bin) gives the wash palette, its woods their two greens, and its stippled texture
(darker and busier than the paper, lines and text left out) where to plant them. The crowns themselves are drawn here.
"""
import json, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

SCAN, LINES, OUT = sys.argv[1:4]
M = json.load(open('data/bulge/map.json')); W, H = M['size']
r = json.load(open('web/public/relief/relief.json'))
h = nd.zoom(np.fromfile('web/public/relief/height.bin', '<u2').reshape(r['rows'], r['cols']) / 65535 * r['metres'], 4, order=1)[:H, :W]
scan = np.array(Image.open(SCAN).convert('RGB').crop((0, 0, W, H))).astype(np.float32)
im = Image.new('L', (W, H)); d = ImageDraw.Draw(im)
for a in M['areas']: d.polygon([tuple(p) for p in a['polygon']], fill=1)
land = np.array(im) > 0

# ---------- where the print has woods: its stipple is darker than the paper around it and busy; lines, text and symbols left out ----------
lum = scan.mean(2); sat = scan.max(2) - scan.min(2); R, G, B = scan[..., 0], scan[..., 1], scan[..., 2]
drawn = np.array(Image.open(LINES).convert('RGBA'))[..., 3] > 0 if Image.open(LINES).mode == 'RGBA' else np.array(Image.open(LINES).convert('L')) < 250
excl = nd.binary_dilation((B - R > 25) | (lum > 228) | (R - B > 36) | (lum < 95), iterations=3) | nd.binary_dilation(drawn, iterations=3)
m = nd.uniform_filter(lum, 7); sd = np.sqrt(np.maximum(nd.uniform_filter(lum ** 2, 7) - m ** 2, 0))
score = (nd.maximum_filter(nd.uniform_filter(lum, 5), 25) - m) / 25 + sd / 18; busy = sd.copy()
excl0 = excl.copy(); yy, xx = np.mgrid[0:H, 0:W]
for a in M['areas']:                                                                              # the printed name, number and VP symbols over each area's label
    x, y = a['label']; excl |= ((xx - x) / 62) ** 2 + ((yy - y + 14) / 48) ** 2 < 1
excl |= nd.binary_dilation(lum < 110, iterations=7)                                               # any other print: unit boxes, small text
score = np.where(excl, 0, score); wgt = (~excl).astype(np.float32)
_, (iy, ix) = nd.distance_transform_edt(excl, return_indices=True); score = score[iy, ix]; busy = busy[iy, ix]   # the holes take the texture of the nearest open ground
score = nd.gaussian_filter(score, 3); busy = nd.gaussian_filter(busy, 4)

# ---------- the print's palette: paper by height (away from woods, lines and text), the woods' light and dark greens ----------
plain = nd.binary_erosion(land, iterations=6) & (nd.distance_transform_edt(score < 1.0) > 3) & ~excl & (lum > 175) & (sat < 40)
pal = []
for lo, hi in [(0, 120), (120, 150), (150, 210), (210, 270), (270, 330), (330, 400), (400, 480), (480, 800)]:
    s = plain & (h >= lo) & (h < hi); pal.append(((lo + hi) / 2, np.median(scan[s], 0) if s.sum() > 300 else pal[-1][1]))
wd = land & (score > 2.6) & ~excl0; wood_dark, wood_light = np.percentile(scan[wd], 15, 0), np.percentile(scan[wd], 70, 0)
grey = lambda c, f: c * (1 - f) + c.mean() * f; wood_dark, wood_light = grey(wood_dark, 0.3), grey(wood_light, 0.2)   # the print's woods are grey-green
print('palette', [(int(z), c.astype(int).tolist()) for z, c in pal], 'woods', wood_dark.astype(int), wood_light.astype(int))

# ---------- the paper: height through the palette, laid in soft patches like the print's washes ----------
rng = np.random.default_rng(1944)
blotch = nd.gaussian_filter(rng.standard_normal((H, W)), 16) * 70 + nd.gaussian_filter(rng.standard_normal((H, W)), 5) * 14
hz = nd.gaussian_filter(h, 5) + blotch
zs = np.array([z for z, _ in pal]); cs = np.array([c for _, c in pal])
paper = np.stack([np.interp(hz, zs, cs[:, k]) for k in range(3)], -1) + nd.gaussian_filter(rng.standard_normal((H, W)), 1.0)[..., None] * 2.5

# ---------- the woods: where the print has them, with ragged edges and stray trees, filled with tree crowns ----------
dens = score + nd.gaussian_filter(rng.standard_normal((H, W)), 2.0) * 0.35
wood = np.clip((dens - 1.35) / 0.45, 0, 1) * np.clip((busy - 6.5) / 4, 0, 1)                                                         # soft, ragged edge; the washes are smooth, the woods busy
crowns = nd.gaussian_filter(rng.random((H, W)), 1.0); crowns = (crowns - crowns.mean()) / crowns.std()
k = np.clip(0.45 + crowns * 0.38, 0, 1)                                                           # crown light to shadow
tree = wood_light * (1 - k[..., None]) + wood_dark * k[..., None]
a = (wood * np.clip(0.76 + crowns * 0.2, 0.35, 1))[..., None]
ground = paper * (1 - a) + tree * a
ground = np.where(land[..., None], ground, np.array([188, 202, 211.]))                             # the sheet's margin, as the board frames it
Image.fromarray(np.clip(ground, 0, 255).astype(np.uint8)).save(OUT, quality=88)
print('woods cover', round(float((wood > 0.5)[land].mean()), 2))
