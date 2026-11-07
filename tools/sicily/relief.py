"""The Sicily 3D map data (web/public/sicily/relief/): the real relief (terrain.py) painted with the real July ground (satellite.py: Sentinel-2),
with groves and woods where the land cover has trees, and towns and cities where it is built up; the ground is painted by land-cover class in the colours the July image gives each class.

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

# the ground from the land cover, in the colours the July satellite image gives each class (tools/terrain/satellite.py measured them):
# the real pattern of woods, crops, pasture and towns, painted in patches like a map rather than copied from the photo
lc = nd.zoom(np.load(S + '/landcover.npy'), 2, order=0)[:H, :W]
have = nd.zoom(np.load(S + '/sat_have.npy').astype(np.float32), 2, order=0)[:H, :W] > 0.5
sat = np.array(Image.open(S + '/sat.png').convert('RGB').resize((W, H), Image.BILINEAR)).astype(np.float32)
CLASSES = [10, 20, 30, 40, 50, 60, 80]
shore = nd.distance_transform_edt(ground) < 9
lc = np.where((lc == 80) & land & shore, 30, lc)                                     # the land-cover sea along a coast that the map draws a little differently: ground, not water
col = {}
for k in CLASSES:                                                                     # the class's own colour, measured on the map where the image is clear
    sel = have & (lc == k) & land; col[k] = np.median(sat[sel].reshape(-1, 3), 0) if sel.sum() > 400 else np.array([150, 140, 110.])
col[0] = col[30]
lift = lambda c: 255 * (np.clip(c, 0, 255) / 255) ** 0.62 * 0.9 + 18                 # the photo is dark; the board reads it lighter, like a printed photo map
rng = np.random.default_rng(1943)
soft = {k: nd.gaussian_filter((lc == k).astype(np.float32), 2.2) for k in CLASSES}   # soft-edged patches
tot = sum(soft.values()) + 1e-6
gr = sum(lift(col[k])[None, None, :] * soft[k][..., None] for k in CLASSES) / tot[..., None]
gr = gr * (1 + nd.gaussian_filter(rng.standard_normal((H, W)), 7)[..., None] * 0.06 + nd.gaussian_filter(rng.standard_normal((H, W)), 1.5)[..., None] * 0.04)   # field patchwork and grain
summit = nd.gaussian_filter((h > 1900).astype(np.float32), 8)[..., None]
gr = gr * (1 - summit) + np.array([120, 112, 104], np.float32) * summit             # Etna's lava
gr = np.where(ground[..., None], gr, np.array([137, 193, 216], np.float32))          # the sea as printed
mainland_only = ground & ~land
gr = np.where(mainland_only[..., None], gr * 0.85 + np.array([150, 150, 145], np.float32) * 0.15, gr)
Image.fromarray(np.clip(gr, 0, 255).astype(np.uint8)).save(OUT + 'snow.png', optimize=True)

# trees where the land cover says tree cover (dense) or shrubland (sparse), never on the summit or the sea
rng = np.random.default_rng(7); n = nd.gaussian_filter(rng.random((H, W)), 3); n = (n - n.min()) / (n.max() - n.min())
dens = np.where(lc == 10, 0.85, 0) + np.where(lc == 20, 0.3, 0) + np.where(lc == 40, 0.08, 0)
dens = dens * land * (n > 0.25)
wd = nd.uniform_filter(dens.astype(np.float32), STEP + 1)[::STEP, ::STEP]; np.round(np.clip(wd, 0, 1) * 255).astype(np.uint8).tofile(OUT + 'woods.bin')

# towns and cities from the game map, as it was in 1943 (not today's built-up land): the four cities drawn on the map (CITIES layer)
# as house blocks filling their printed shape, and a town (a church and a ring of houses) at the place each area is named after
A2 = json.load(open('data/sicily/map_art.json'))
cities, towns = [], []
for c in A2['cities']:
    P = pts(c['d']); cm = mask([P]); ys, xs = np.nonzero(cm)
    if not len(xs): continue
    cells = sorted({(int(x) // 4 * 4 + 2, int(y) // 4 * 4 + 2) for x, y in zip(xs, ys)})
    cities.append({'c': [round(float(xs.mean()), 1), round(float(ys.mean()), 1)], 'cells': [cc for cc in cells if cm[min(cc[1], H - 1), min(cc[0], W - 1)]]})
city_areas = {c['area'] for c in A2['cities']}
for a in M['areas']:
    if a['id'] in city_areas or a['tdn'] >= 3: continue                                  # the cities are drawn; no town on Etna
    towns.append([float(a['label'][0]), float(a['label'][1])])
print(len(towns), 'towns', len(cities), 'cities')
json.dump({'outline': [[[0, 0], [W, 0], [W, H], [0, H], [0, 0]]], 'w': W, 'h': H, 'step': STEP, 'cols': cols, 'rows': rows, 'metres': hi, 'mpp': MPP, 'exag': EXAG,
           'dry': True, 'ownLines': True, 'overlay': 'map-base.svg', 'towns': towns, 'cities': cities}, open(OUT + 'relief.json', 'w'), separators=(',', ':'))
print(rows, cols, round(hi), 'm', {f: os.path.getsize(OUT + f) // 1024 for f in os.listdir(OUT)})
