"""The Bulge 3D ground for the winter of 1944-45 (web/public/relief/snow.png, woods.bin, relief.json): the real land cover (ESA WorldCover)
painted in the colours a snowy February 2021 Sentinel-2 scene gives each class (snow on the fields, dark woods, grey towns), and the trees
where the land cover has woods. The relief (height.bin), the entry strips and the towns and cities (from the game map) are kept as they are.

Usage: SNOW=1 python3 -I tools/terrain/satellite.py <s> 2021 1,2,12 31 U FQ,FR,FS,GQ,GR,GS 40     (lonlat.npy from tools/map3d/geo.py's town fit)
       SNOW=1 ADD=1 python3 -I tools/terrain/satellite.py <s> 2021 1,2,12 32 U KA,KB,KV,LA,LB,LV 40
       python3 -I tools/bulge/relief.py <s> <sheet.png>     (sheet.png: the board outline filled black on white, the printed sheet)
"""
import json, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

S, SHEET = sys.argv[1:3]; OUT = 'web/public/relief/'
M = json.load(open('data/bulge/map.json')); W, H = M['size']; meta = json.load(open(OUT + 'relief.json')); STEP = meta['step']
im = Image.new('L', (W, H)); d = ImageDraw.Draw(im)
for a in M['areas']: d.polygon([tuple(p) for p in a['polygon']], fill=1)
land = np.array(im) > 0; sheet = (np.array(Image.open(SHEET).convert('L')) < 128) | land

lc = nd.zoom(np.load(S + '/landcover.npy'), 2, order=0)[:H, :W]
_, (iy, ix) = nd.distance_transform_edt(lc == 50, return_indices=True); lc = lc[iy, ix]   # today's built-up land is painted as the ground around it: the towns come from the game map
have = nd.zoom(np.load(S + '/sat_have.npy').astype(np.float32), 2, order=0)[:H, :W] > 0.5
sat = np.array(Image.open(S + '/sat.png').convert('RGB').resize((W, H), Image.BILINEAR)).astype(np.float32)
clear = have & (np.arange(H)[:, None] < H * 0.45)                                                  # the north of the scene is clear; cloud streets cross the south
CLASSES = [10, 20, 30, 40, 50, 60, 80, 90]
col = {k: (np.median(sat[clear & (lc == k)].reshape(-1, 3), 0) if (clear & (lc == k)).sum() > 400 else np.array([236, 240, 244.])) for k in CLASSES}
col[10] = col[10] * 0.75 + np.array([96, 112, 98.]) * 0.25                                          # the snowy woods a shade greener, so they read as forest
col[0] = col[30]; print({k: v.astype(int).tolist() for k, v in col.items()})
snowy = lambda c: np.clip(c * 0.82 + np.array([232, 238, 246.]) * 0.18, 0, 255)                  # a touch of the cold blue-white of fresh snow
rng = np.random.default_rng(1944)
soft = {k: nd.gaussian_filter((lc == k).astype(np.float32), 2.2) for k in CLASSES}; tot = sum(soft.values()) + 1e-6
gr = sum(snowy(col[k])[None, None, :] * soft[k][..., None] for k in CLASSES) / tot[..., None]
gr = gr * (1 + nd.gaussian_filter(rng.standard_normal((H, W)), 6)[..., None] * 0.03 + nd.gaussian_filter(rng.standard_normal((H, W)), 1.2)[..., None] * 0.025)
offl = np.clip(nd.distance_transform_edt(~land) / 6, 0, 1)[..., None]                               # beyond the play areas: greyer snow, as before
gr = gr * (1 - offl) + (gr * 0.55 + np.array([214, 218, 214.]) * 0.45) * offl
gr = np.where(sheet[..., None], gr, np.array([200, 212, 220.]))                                     # the sheet's margin: pale blue-grey, as printed
Image.fromarray(np.clip(gr, 0, 255).astype(np.uint8)).quantize(40, dither=Image.Dither.NONE).save(OUT + 'snow.png', optimize=True)   # a small palette keeps the file light for phones

entry = nd.binary_dilation(np.array(Image.open(OUT + 'entry.png').convert('RGBA'))[..., 3] > 20, iterations=6)   # no trees on the entry strips
n = nd.gaussian_filter(rng.random((H, W)), 3); n = (n - n.min()) / (n.max() - n.min())
dens = (np.where(lc == 10, 0.85, 0) + np.where(lc == 20, 0.3, 0)) * land * ~entry * (n > 0.2)
wd = nd.uniform_filter(dens.astype(np.float32), STEP + 1)[::STEP, ::STEP]; np.round(np.clip(wd, 0, 1) * 255).astype(np.uint8).tofile(OUT + 'woods.bin')
# the map stands proud of the sheet's margin, cut straight down at its edge (the old relief sloped down to the margin): from the original grid, kept once in <s>
import os, shutil
if not os.path.exists(S + '/height-orig.bin'): shutil.copy(OUT + 'height.bin', S + '/height-orig.bin')
meta.setdefault('metresOrig', meta['metres'])                                       # the original grid's scale
orig = np.fromfile(S + '/height-orig.bin', '<u2').reshape(meta['rows'], meta['cols']).astype(np.float32) / 65535 * meta['metresOrig']
onmap = nd.binary_dilation(sheet, iterations=5)[::STEP, ::STEP][:meta['rows'], :meta['cols']]
PLINTH = 0.4 * 80 * (W / 86.36) / 4                                                 # 4 mm, in the relief's metres (80 m a pixel, shown four times higher)
hg = np.where(onmap, orig + PLINTH, 0); meta['metres'] = float(hg.max()); np.round(hg / hg.max() * 65535).astype('<u2').tofile(OUT + 'height.bin')
meta['floatsFrom'] = 'map-base.svg'                                                 # the entry strips hover over the relief, out of the board file
meta['ownLines'] = True; json.dump(meta, open(OUT + 'relief.json', 'w'), separators=(',', ':'))
print('woods', round(float((dens > 0)[land].mean()), 2))
