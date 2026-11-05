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

# trees: oak scrub on the northern slopes under Hermon and orchards on the valley floor, sparse; none on water, basalt or rock
real = h + lo
gy, gx = np.gradient(nd.gaussian_filter(real, 2)); slope = np.hypot(gx, gy)
rng = np.random.default_rng(5); n = nd.gaussian_filter(rng.random((H, W)), 9); n = (n - n.min()) / (n.max() - n.min())
valley = (real < lo + 260) & land
foothill = (real > 600 + lo * 0) & (real < 1150) & land & (ids != 83)
dens = np.where(valley, 0.55, 0) + np.where(foothill, 0.45, 0)
dens *= (n > 0.52) * (slope < 9) * ~mask(water)
wd = nd.uniform_filter(dens.astype(np.float32), STEP + 1)[::STEP, ::STEP]; np.round(np.clip(wd, 0, 1) * 255).astype(np.uint8).tofile(OUT + 'woods.bin')

# the ground the 3D map is painted with: board.py's ground without its hill shading (the lights do that here), water, basalt
gr = np.load(S + '/golan-ground.npy').astype(np.float32)
gr = np.where((offmap & ~land)[..., None], np.array([158, 157, 148], np.float32), gr)
gr = np.where(mask(water)[..., None], np.array([150, 190, 219], np.float32), gr)
gr = np.where(sheet[..., None], gr, np.array([188, 202, 211], np.float32))
Image.fromarray(gr.astype(np.uint8)).quantize(48).save(OUT + 'snow.png', optimize=True)
json.dump({'outline': [[[0, 0], [W, 0], [W, H], [0, H], [0, 0]]], 'w': W, 'h': H, 'step': STEP, 'cols': cols, 'rows': rows, 'metres': hi, 'mpp': MPP, 'exag': EXAG,
           'dry': True, 'overlay': 'map-base.svg', 'towns': [], 'cities': []}, open(OUT + 'relief.json', 'w'), separators=(',', ':'))
print(rows, cols, round(hi), 'm', {f: os.path.getsize(OUT + f) // 1024 for f in os.listdir(OUT)})
