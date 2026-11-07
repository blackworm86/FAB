"""Real elevation of the Golan bent onto the game map, as tools/map3d/geo.py does for The Bulge.

Usage: python3 -I tools/golan73/terrain.py <scratch dir>
Fetches Terrarium elevation tiles (AWS open data, zoom 12) into <scratch>/tiles, fits a thin-plate spline from the game
labels of places whose real position is known to their longitude/latitude, and writes <scratch>/real.npy: metres above
sea level for every map pixel on a 2 px grid (rows = map y / 2). Nothing it writes is committed; board.py and relief.py read it.
"""
import json, math, os, subprocess, sys, concurrent.futures as cf
import numpy as np
from PIL import Image
from scipy.interpolate import RBFInterpolator

OUT = sys.argv[1]; os.makedirs(OUT + '/tiles', exist_ok=True)
M = json.load(open('data/golan73/map.json')); W, H = [int(v) for v in M['size']]
L = {a['name']: a['label'] for a in M['areas']}
# lon, lat of places the game names (approximate, to a few hundred metres: the relief is loosely based on the real ground)
REAL = {"Dan": (35.652, 33.240), "Banias": (35.694, 33.248), "Shamir": (35.660, 33.174), "Gonen": (35.647, 33.124), "Gadot": (35.614, 33.016),
        "B'not Yakov Bridge": (35.627, 33.006), "Kfar Hanasi": (35.605, 32.966), "Almagor": (35.596, 32.909), "Arik Bridge": (35.628, 32.894),
        "Ramot": (35.664, 32.848), "Kursi": (35.650, 32.826), "Ein Gev": (35.640, 32.783), "Ha On": (35.625, 32.728), "Ma'agan": (35.602, 32.709),
        "Mevo Hama": (35.661, 32.737), "Givat Yoav": (35.681, 32.802), "Afik": (35.699, 32.779), "El-Al": (35.731, 32.833),
        "Ramat Magshimim": (35.807, 32.849), "Ma'ale Gamla": (35.682, 32.886), "Yehudia": (35.711, 32.937), "Katzrin": (35.692, 32.993),
        "Natur": (35.743, 32.870), "Aniam": (35.736, 32.958), "Tel Faris": (35.851, 32.930), "Rafid": (35.895, 32.950), "Hushniyah": (35.784, 32.995),
        "Nafakh": (35.770, 33.070), "Ein Zivan": (35.790, 33.096), "Kuneitra": (35.824, 33.125), "Merom Golan": (35.776, 33.134),
        "El Rom": (35.770, 33.182), "Tel Abu Nida": (35.788, 33.150), "Wasit": (35.735, 33.115), "Majdal Shams": (35.771, 33.270),
        "Masada": (35.754, 33.233), "Zaura": (35.698, 33.217), "Khan Arnabe": (35.885, 33.183), "Nawa": (36.043, 32.888),
        "Jasim": (36.060, 32.992), "Tasil": (35.968, 32.833), "Mt Hermon": (35.857, 33.416)}
P = np.array([L[k] for k in REAL], float); G = np.array([REAL[k] for k in REAL], float)
tps = RBFInterpolator(P, G, kernel='thin_plate_spline', smoothing=float(os.environ.get("SMOOTH", 4e4)))
res = G - tps(P); print('fit residual km', round(float(np.hypot(res[:, 0] * 93, res[:, 1] * 111).mean()), 2))

ys, xs = np.mgrid[0:H:2, 0:W:2]; ll = tps(np.c_[xs.ravel(), ys.ravel()].astype(float))
z = 12; n = 2 ** z
tx = lambda lon: (lon + 180) / 360 * n
ty = lambda lat: (1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * n
X0, X1 = int(tx(ll[:, 0].min())) - 1, int(tx(ll[:, 0].max())) + 1
Y0, Y1 = int(ty(ll[:, 1].max())) - 1, int(ty(ll[:, 1].min())) + 1
def get(j):
    x, y = j; f = f'{OUT}/tiles/{z}_{x}_{y}.png'
    if not os.path.exists(f): subprocess.run(['curl', '-sS', '--retry', '3', '-o', f, f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], check=True)
jobs = [(x, y) for x in range(X0, X1 + 1) for y in range(Y0, Y1 + 1)]
with cf.ThreadPoolExecutor(8) as e: list(e.map(get, jobs))
dem = np.zeros(((Y1 - Y0 + 1) * 256, (X1 - X0 + 1) * 256), np.float32)
for x, y in jobs:
    a = np.array(Image.open(f'{OUT}/tiles/{z}_{x}_{y}.png').convert('RGB')).astype(np.float32)
    dem[(y - Y0) * 256:(y - Y0 + 1) * 256, (x - X0) * 256:(x - X0 + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
px = (tx(ll[:, 0]) - X0) * 256 - .5; py = (ty(ll[:, 1]) - Y0) * 256 - .5
i = np.floor(px).astype(int); j = np.floor(py).astype(int); fx = px - i; fy = py - j
g = lambda a, b: dem[np.clip(b, 0, dem.shape[0] - 1), np.clip(a, 0, dem.shape[1] - 1)]
h = (g(i, j) * (1 - fx) * (1 - fy) + g(i + 1, j) * fx * (1 - fy) + g(i, j + 1) * (1 - fx) * fy + g(i + 1, j + 1) * fx * fy).reshape(xs.shape)
np.save(f'{OUT}/lonlat.npy', ll.reshape(xs.shape + (2,)).astype(np.float32))                # longitude, latitude of every grid point, for the satellite ground
np.save(f'{OUT}/real.npy', h)
Image.fromarray(np.clip((h - h.min()) / (h.max() - h.min()) * 255, 0, 255).astype(np.uint8)).save(f'{OUT}/real.png')
print(len(jobs), 'tiles', h.shape, round(float(h.min())), round(float(h.max())))
