"""The Sicily 3D map data (web/public/sicily/relief/), built like Golan's (tools/golan73/relief.py).

Usage: python3 -I tools/sicily/relief.py <scratch>     (after terrain.py and board.py, which leave real.npy and sicily-ground.npy there)
Writes height.bin (uint16 grid, 4 map px), woods.bin (tree density), snow.png (the ground the relief is painted with: board.py's ground
without its shading, the sea, the mainland) and relief.json. Real metres, gently shaped for the game: the sea is flat at the base,
Etna is compressed above 1500 m so it does not tower over the board, the Calabrian mainland rises too, and beyond the printed sheet the ground is flat.
"""
import json, os, re, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

S = sys.argv[1]; OUT = 'web/public/sicily/relief/'; os.makedirs(OUT, exist_ok=True)
M = json.load(open('data/sicily/map.json')); A = json.load(open('data/sicily/map_art.json')); W, H = [int(v) for v in M['size']]; STEP = 4
MPP, EXAG = 126.0, 2.4                                                             # about 126 m of ground per map pixel; heights shown 2.4 times real
pts = lambda d: [tuple(map(float, q.split(','))) for q in re.findall(r'-?[\d.]+,-?[\d.]+', d)]
def mask(polys):
    im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
    for P in polys:
        if len(P) > 2: d.polygon(P, fill=1)
    return np.array(im) > 0
ids = Image.new('I', (W, H), 0); dd = ImageDraw.Draw(ids)
for a in M['areas']: dd.polygon([tuple(p) for p in a['polygon']], fill=a['id'])
ids = np.array(ids); land = ids > 0
ground = land | mask([pts(p) for p in A['coast']]) | mask([pts(p) for p in A['islets']]) | mask([pts(p) for p in A['mainland']])

h = nd.zoom(np.load(S + '/real.npy'), 2, order=1)[:H, :W].astype(np.float32)
h = np.where(h > 1500, 1500 + (h - 1500) * 0.45, h)                                # Etna: the cone compressed
h = np.maximum(h, 0)                                                                # the sea is flat
h = np.where(ground, np.maximum(h, 4), 0)                                           # every bit of drawn land stands clear of the water
dl, (iy, ix) = nd.distance_transform_edt(~ground, return_indices=True)              # the shore drops to the sea over a few pixels
h = np.where(ground, h, h[iy, ix] * np.clip(1 - dl / 3, 0, 1))
h = nd.gaussian_filter(h, 1.0)
g = h[::STEP, ::STEP]; hi = float(g.max()); rows, cols = g.shape
np.round(g / hi * 65535).astype('<u2').tofile(OUT + 'height.bin')

# trees: citrus and olive groves on the plains and lower slopes, oak and pine on the Nebrodi, Madonie and Etna's flanks; none on rock, sand or the summit
real = nd.zoom(np.load(S + '/real.npy'), 2, order=1)[:H, :W]
gy, gx = np.gradient(nd.gaussian_filter(real, 2)); slope = np.hypot(gx, gy)
rng = np.random.default_rng(7); n = nd.gaussian_filter(rng.random((H, W)), 9); n = (n - n.min()) / (n.max() - n.min())
groves = (real > 5) & (real < 500) & land
forest = (real > 900) & (real < 1900) & land
dens = np.where(groves, 0.4, 0) + np.where(forest, 0.6, 0)
dens *= (n > 0.5) * (slope < 11)
wd = nd.uniform_filter(dens.astype(np.float32), STEP + 1)[::STEP, ::STEP]; np.round(np.clip(wd, 0, 1) * 255).astype(np.uint8).tofile(OUT + 'woods.bin')

# the ground the 3D map is painted with: board.py's ground without its hill shading (the lights do that here), the sea, the mainland
gr = np.load(S + '/sicily-ground.npy').astype(np.float32)
Image.fromarray(gr.astype(np.uint8)).quantize(48).save(OUT + 'snow.png', optimize=True)
json.dump({'outline': [[[0, 0], [W, 0], [W, H], [0, H], [0, 0]]], 'w': W, 'h': H, 'step': STEP, 'cols': cols, 'rows': rows, 'metres': hi, 'mpp': MPP, 'exag': EXAG,
           'dry': True, 'overlay': 'map-base.svg', 'towns': [], 'cities': []}, open(OUT + 'relief.json', 'w'), separators=(',', ':'))
print(rows, cols, round(hi), 'm', {f: os.path.getsize(OUT + f) // 1024 for f in os.listdir(OUT)})
