"""The Sicily 3D map data (web/public/sicily/relief/): the real relief (terrain.py) painted with the real July ground (satellite.py: Sentinel-2),
with groves and woods where the land cover has trees, and towns and cities where it is built up.

Usage: python3 -I tools/sicily/relief.py <scratch>     (after terrain.py, satellite.py and board.py)
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

# the ground, trees and towns from the satellite data (tools/terrain/satellite.py): Sentinel-2 in July, WorldCover land cover
from PIL import ImageFilter
sat = np.array(Image.open(S + '/sat.png').convert('RGB').resize((W, H), Image.BILINEAR)).astype(np.float32)
have = nd.zoom(np.load(S + '/sat_have.npy').astype(np.float32), 2, order=0)[:H, :W] > 0.5
lc = nd.zoom(np.load(S + '/landcover.npy'), 2, order=0)[:H, :W]
LC_COL = {10: (62, 88, 44), 20: (150, 140, 90), 30: (196, 178, 118), 40: (190, 160, 110), 50: (170, 165, 158), 60: (200, 190, 170), 80: (120, 170, 205)}
fallback = np.full((H, W, 3), 190, np.float32)
for k, c in LC_COL.items(): fallback[lc == k] = c
sat = np.where(have[..., None], sat, fallback)
sat = 255 * (np.clip(sat, 0, 255) / 255) ** 0.72                                     # the raw true colour is dark; lifted so the pieces stay readable
sat = sat * 0.88 + sat.mean(2, keepdims=True) * 0.12                                   # a touch less saturated, like a printed photo
sat = np.array(Image.fromarray(sat.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32)
gr = np.where(ground[..., None], sat, np.array([137, 193, 216], np.float32))          # the sea as printed (flat); lakes keep their satellite blue
Image.fromarray(gr.astype(np.uint8)).save(OUT + 'snow.png', optimize=True)

# trees where the land cover says tree cover (dense) or shrubland (sparse), never on the summit or the sea
rng = np.random.default_rng(7); n = nd.gaussian_filter(rng.random((H, W)), 3); n = (n - n.min()) / (n.max() - n.min())
dens = np.where(lc == 10, 0.85, 0) + np.where(lc == 20, 0.3, 0) + np.where(lc == 40, 0.08, 0)
dens = dens * land * (n > 0.25)
wd = nd.uniform_filter(dens.astype(np.float32), STEP + 1)[::STEP, ::STEP]; np.round(np.clip(wd, 0, 1) * 255).astype(np.uint8).tofile(OUT + 'woods.bin')

# towns and cities from the built-up class: the large clusters are cities (house blocks on 4 px cells), the smaller ones towns (a church and a ring of houses)
built = (lc == 50) & land
built = nd.binary_opening(built, iterations=1)
lab, nlab = nd.label(built, structure=np.ones((3, 3)))
sizes = nd.sum(built, lab, range(1, nlab + 1)); towns, cities = [], []
for i, sz in enumerate(sizes, 1):
    if sz < 60: continue
    ys, xs = np.nonzero(lab == i); cy, cx = float(ys.mean()), float(xs.mean())
    if sz < 400: towns.append([round(cx, 1), round(cy, 1)]); continue
    cells = sorted({(int(x) // 4 * 4 + 2, int(y) // 4 * 4 + 2) for x, y in zip(xs[::3], ys[::3])})
    cells = [c for c in cells if lab[min(c[1], H - 1), min(c[0], W - 1)] == i][:900]
    cities.append({'c': [round(cx, 1), round(cy, 1)], 'cells': cells})
print(len(towns), 'towns', len(cities), 'cities')
json.dump({'outline': [[[0, 0], [W, 0], [W, H], [0, H], [0, 0]]], 'w': W, 'h': H, 'step': STEP, 'cols': cols, 'rows': rows, 'metres': hi, 'mpp': MPP, 'exag': EXAG,
           'dry': True, 'overlay': 'map-base.svg', 'towns': towns, 'cities': cities}, open(OUT + 'relief.json', 'w'), separators=(',', ':'))
print(rows, cols, round(hi), 'm', {f: os.path.getsize(OUT + f) // 1024 for f in os.listdir(OUT)})
