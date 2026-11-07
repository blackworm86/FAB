"""The Golan '73 3D map data (web/public/golan73/relief/), built like The Bulge's (tools/map3d/fullmap.py).

Usage: python3 -I tools/golan73/relief.py <scratch>     (after terrain.py and board.py, which leave real.npy and golan-ground.npy there)
Writes height.bin (uint16 grid, 4 map px), woods.bin (tree density), snow.png (the ground the relief is painted with: board.py's ground
without its shading, the lakes, the basalt beyond the map) and relief.json. Real metres, gently shaped for the game: the lakes are
flat water, the escarpment drawn on the map is a clear step, and the Hermon summit is compressed so it does not tower over the board.
"""
import json, os, re, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

S = sys.argv[1]; OUT = 'web/public/golan73/relief/'; os.makedirs(OUT, exist_ok=True)
M = json.load(open('data/golan73/map.json')); A = json.load(open('data/golan73/map_art.json')); W, H = [int(v) for v in M['size']]; STEP = 4
MPP, EXAG = 31.0, 2.0                                                              # about 31 m of ground per map pixel; heights shown twice real
pts = lambda d: [tuple(map(float, q.split(','))) for q in re.findall(r'-?[\d.]+,-?[\d.]+', d)]
def mask(polys):
    im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
    for P in polys:
        if len(P) > 2: d.polygon(P, fill=1)
    return np.array(im) > 0
def lines(ds, w):
    im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
    for p in ds:
        q = pts(p)
        if len(q) > 1: d.line(q, fill=1, width=w)
    return np.array(im) > 0
ids = Image.new('I', (W, H), 0); dd = ImageDraw.Draw(ids)
for a in M['areas']: dd.polygon([tuple(p) for p in a['polygon']], fill=a['id'])
ids = np.array(ids); land = ids > 0
lakes = [pts(p) for p in A['lakes']]; leja = [P for P in lakes if np.mean([p[1] for p in P]) < 300]; water = [P for P in lakes if P not in leja]
offmap = mask([pts(p) for p in A['offmap']]) | mask(leja); sheet = land | offmap | mask(water)

h = nd.zoom(np.load(S + '/real.npy'), 2, order=1)[:H, :W].astype(np.float32)
h = np.where(h > 1000, 1000 + (h - 1000) * 0.32, h)                                # Hermon: the summit compressed
for P in water:                                                                     # each lake is flat, at the level of its shore
    m = mask([P]); ring = nd.binary_dilation(m, iterations=6) & ~m
    h = np.where(m, np.percentile(h[ring], 10) - 6, h)
esc = lines(A['escarpment'], 3); de = nd.distance_transform_edt(~esc)               # the escarpment line: a sharper step where the game draws it
h += 25 * np.exp(-(de / 6) ** 2) * (h > np.percentile(h[land], 30))
h = nd.gaussian_filter(h, 1.0)
lo = float(h[sheet].min()); h = h - lo
dl, (iy, ix) = nd.distance_transform_edt(~sheet, return_indices=True)               # beyond the printed land the ground slopes gently down to the sheet
h = np.where(sheet, h, nd.gaussian_filter(h[iy, ix], 8) * np.clip(1 - dl / 32, 0, 1) ** 1.5); h = np.maximum(h, 0)
g = h[::STEP, ::STEP]; hi = float(g.max()); rows, cols = g.shape
np.round(g / hi * 65535).astype('<u2').tofile(OUT + 'height.bin')

# the ground, trees and towns: the land cover painted in the colours the October satellite image gives each class (tools/terrain/satellite.py);
# trees where it has woods or orchards; a town (a church and a ring of houses) where each area's settlement is named on the game map
lc = nd.zoom(np.load(S + '/landcover.npy'), 2, order=0)[:H, :W]
have = nd.zoom(np.load(S + '/sat_have.npy').astype(np.float32), 2, order=0)[:H, :W] > 0.5
sat = np.array(Image.open(S + '/sat.png').convert('RGB').resize((W, H), Image.BILINEAR)).astype(np.float32)
CLASSES = [10, 20, 30, 40, 50, 60, 80]
lc = np.where((lc == 80) & land & ~mask(water), 30, lc)                               # the map's lakes are its own; elsewhere water is ground
col = {k: (np.median(sat[have & (lc == k) & sheet].reshape(-1, 3), 0) if (have & (lc == k) & sheet).sum() > 400 else np.array([170, 160, 130.])) for k in CLASSES}
lift = lambda c: 255 * (np.clip(c, 0, 255) / 255) ** 0.62 * 0.9 + 18                 # the photo is dark; the board reads it lighter, like a printed photo map
bal = lambda c: (lambda b: b * 0.75 + b.mean() * 0.25)(c * np.array([0.86, 1.0, 0.94]))   # the basalt soil reads pink once lightened: balanced toward October's dry khaki and olive
col = {k: bal(v) for k, v in col.items()}
rng = np.random.default_rng(1973)
soft = {k: nd.gaussian_filter((lc == k).astype(np.float32), 2.2) for k in CLASSES}; tot = sum(soft.values()) + 1e-6
gr = sum(lift(col[k])[None, None, :] * soft[k][..., None] for k in CLASSES) / tot[..., None]
gr = gr * (1 + nd.gaussian_filter(rng.standard_normal((H, W)), 7)[..., None] * 0.05 + nd.gaussian_filter(rng.standard_normal((H, W)), 1.5)[..., None] * 0.035)
gr = np.where((offmap & ~land)[..., None], gr * 0.55 + np.array([140, 138, 130], np.float32) * 0.45, gr)   # the off-map ground, greyed as printed
gr = np.where(mask(water)[..., None], np.array([150, 197, 225], np.float32), gr)
gr = np.where(sheet[..., None], gr, np.array([188, 172, 110], np.float32))          # the print's olive margin
Image.fromarray(np.clip(gr, 0, 255).astype(np.uint8)).save(OUT + 'snow.png', optimize=True)
n = nd.gaussian_filter(rng.random((H, W)), 3); n = (n - n.min()) / (n.max() - n.min())
dens = (np.where(lc == 10, 0.8, 0) + np.where(lc == 20, 0.3, 0)) * land * (n > 0.25) * ~mask(water)
wd = nd.uniform_filter(dens.astype(np.float32), STEP + 1)[::STEP, ::STEP]; np.round(np.clip(wd, 0, 1) * 255).astype(np.uint8).tofile(OUT + 'woods.bin')
towns = [[float(a['label'][0]), float(a['label'][1])] for a in M['areas'] if a['id'] != 83]
json.dump({'outline': [[[0, 0], [W, 0], [W, H], [0, H], [0, 0]]], 'w': W, 'h': H, 'step': STEP, 'cols': cols, 'rows': rows, 'metres': hi, 'mpp': MPP, 'exag': EXAG,
           'dry': True, 'ownLines': True, 'overlay': 'map-base.svg', 'towns': towns, 'cities': []}, open(OUT + 'relief.json', 'w'), separators=(',', ':'))
print(rows, cols, round(hi), 'm', {f: os.path.getsize(OUT + f) // 1024 for f in os.listdir(OUT)})
