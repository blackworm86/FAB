"""Real elevation of Sicily bent onto the game map, as tools/golan73/terrain.py does for the Golan.

Usage: python3 -I tools/sicily/terrain.py <scratch dir>
Fetches Terrarium elevation tiles (AWS open data, zoom 11) into <scratch>/tiles, fits a thin-plate spline from the game's area
labels to the longitude/latitude of the towns the areas are named after, and writes <scratch>/real.npy: metres above sea level for
every map pixel on a 2 px grid (rows = map y / 2; the sea is 0 or below). Nothing it writes is committed; board.py and relief.py read it.
"""
import json, os, subprocess, sys, time, concurrent.futures as cf
import numpy as np
from PIL import Image
from scipy.interpolate import RBFInterpolator

OUT = sys.argv[1]; os.makedirs(OUT + '/tiles', exist_ok=True)
M = json.load(open('data/sicily/map.json')); W, H = [int(v) for v in M['size']]
L = {a['id']: a['label'] for a in M['areas']}
# lon, lat of the town each area is named after (the game's areas are drawn round them; a few hundred metres of error does not show)
REAL = {1: (15.09, 36.715), 2: (14.76, 36.86), 3: (14.72, 36.93), 4: (15.13, 36.91), 5: (15.29, 37.075), 6: (14.90, 37.06), 7: (14.60, 36.95), 8: (14.52, 36.83), 9: (14.43, 36.89),
        10: (14.56, 37.08), 11: (14.75, 37.16), 12: (15.03, 37.16), 13: (15.22, 37.23), 14: (14.99, 37.28), 15: (14.84, 37.30), 16: (14.69, 37.38), 17: (14.63, 37.21), 18: (14.39, 37.15),
        19: (14.25, 37.07), 20: (13.94, 37.10), 21: (14.18, 37.19), 22: (14.51, 37.24), 23: (14.37, 37.38), 24: (14.39, 37.64), 25: (14.64, 37.65), 26: (15.09, 37.50), 27: (14.99, 37.75),
        28: (15.29, 37.85), 29: (15.55, 38.19), 30: (15.13, 38.02), 31: (14.74, 38.16), 32: (14.95, 37.88), 33: (14.83, 37.66), 34: (14.63, 38.07), 35: (14.40, 37.75), 36: (14.35, 38.01),
        37: (14.21, 37.80), 38: (14.28, 37.57), 39: (14.21, 37.30), 40: (13.85, 37.36), 41: (13.77, 37.19), 42: (13.58, 37.31), 43: (13.62, 37.40), 44: (13.75, 37.58), 45: (14.06, 37.49),
        46: (14.09, 37.93), 47: (14.02, 38.03), 48: (13.94, 37.92), 49: (13.70, 37.98), 50: (13.43, 37.72), 51: (13.44, 37.62), 52: (13.39, 37.44), 53: (13.08, 37.51), 54: (13.30, 37.81),
        55: (13.40, 37.86), 56: (13.46, 37.97), 57: (13.36, 38.12), 58: (12.96, 37.98), 59: (12.80, 37.82), 60: (12.79, 37.68), 61: (12.59, 37.65), 62: (12.86, 37.91), 63: (12.68, 38.08),
        64: (12.51, 38.02), 65: (12.44, 37.80)}
P = np.array([L[k] for k in REAL], float); Gll = np.array([REAL[k] for k in REAL], float)
tps = RBFInterpolator(P, Gll, kernel='thin_plate_spline', smoothing=float(os.environ.get('SMOOTH', 3e5)))
res = Gll - tps(P); print('fit residual km', round(float(np.hypot(res[:, 0] * 88, res[:, 1] * 111).mean()), 2), 'worst', round(float(np.hypot(res[:, 0] * 88, res[:, 1] * 111).max()), 2))

ys, xs = np.mgrid[0:H:2, 0:W:2]; ll = tps(np.c_[xs.ravel(), ys.ravel()].astype(float))
z = 11; n = 2 ** z
tx = lambda lon: (lon + 180) / 360 * n
ty = lambda lat: (1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * n
X0, X1 = int(tx(ll[:, 0].min())) - 1, int(tx(ll[:, 0].max())) + 1
Y0, Y1 = int(ty(ll[:, 1].max())) - 1, int(ty(ll[:, 1].min())) + 1
def get(j):
    x, y = j; f = f'{OUT}/tiles/{z}_{x}_{y}.png'
    for attempt in range(6):
        if os.path.exists(f) and os.path.getsize(f) > 0: return
        r = subprocess.run(['curl', '-sS', '--retry', '3', '--retry-all-errors', '--max-time', '60', '-o', f, f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'])
        if r.returncode: time.sleep(2 * attempt + 1)
    assert os.path.exists(f) and os.path.getsize(f) > 0, f
jobs = [(x, y) for x in range(X0, X1 + 1) for y in range(Y0, Y1 + 1)]
with cf.ThreadPoolExecutor(8) as e: list(e.map(get, jobs))
dem = np.zeros(((Y1 - Y0 + 1) * 256, (X1 - X0 + 1) * 256), np.float32)
for x, y in jobs:
    a = np.array(Image.open(f'{OUT}/tiles/{z}_{x}_{y}.png').convert('RGB')).astype(np.float32)
    dem[(y - Y0) * 256:(y - Y0 + 1) * 256, (x - X0) * 256:(x - X0 + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
# refine the fit on the coast: the game map draws the coast carefully, so every map coast point is matched to the nearest real
# coast point (Sicily's own shore, not Calabria's across the strait) and the spline is refitted through towns and coast together
import re
from scipy import ndimage as nd
from scipy.spatial import cKDTree
A = json.load(open('data/sicily/map_art.json'))
coast_px = []
for d in A['coast']:
    q = np.array([tuple(map(float, v.split(','))) for v in re.findall(r'-?[\d.]+,-?[\d.]+', d)])
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(q, axis=0).T))]
    for t in np.arange(0, seg[-1], 12): k = np.searchsorted(seg, t); coast_px.append(q[min(k, len(q) - 1)])
coast_px = np.array(coast_px)
landm = dem > 0; lab, _ = nd.label(landm)
enna = (int((tx(REAL[38][0]) - X0) * 256), int((ty(REAL[38][1]) - Y0) * 256)); sic = lab == lab[enna[1], enna[0]]
shore = sic & ~nd.binary_erosion(sic); sy_, sx_ = np.nonzero(shore)
lon_of = lambda px: (px + .5) / 256 / n * 360 - 180 + X0 * 360 / n
lat_of = lambda py: np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * ((py + .5) / 256 + Y0) / n))))
shore_ll = np.c_[lon_of(sx_), lat_of(sy_)]; scale = np.array([88.0, 111.0])          # km per degree at 37.5 N
tree = cKDTree(shore_ll * scale)
for it in range(4):
    cl = tps(coast_px); dist, idx = tree.query(cl * scale)
    ok = dist < (12 if it == 0 else 8)
    Pf = np.r_[P, coast_px[ok]]; Gf = np.r_[Gll, shore_ll[idx[ok]]]
    tps = RBFInterpolator(Pf, Gf, kernel='thin_plate_spline', smoothing=float(os.environ.get('SMOOTH2', 1.5e5)))
    res = Gll - tps(P); print('pass', it, 'coast pts', int(ok.sum()), 'coast km', round(float(dist[ok].mean()), 2), 'town km', round(float(np.hypot(res[:, 0] * 88, res[:, 1] * 111).mean()), 2))
ll = tps(np.c_[xs.ravel(), ys.ravel()].astype(float))
px = (tx(ll[:, 0]) - X0) * 256 - .5; py = (ty(ll[:, 1]) - Y0) * 256 - .5
i = np.floor(px).astype(int); j = np.floor(py).astype(int); fx = px - i; fy = py - j
g = lambda a, b: dem[np.clip(b, 0, dem.shape[0] - 1), np.clip(a, 0, dem.shape[1] - 1)]
h = (g(i, j) * (1 - fx) * (1 - fy) + g(i + 1, j) * fx * (1 - fy) + g(i, j + 1) * (1 - fx) * fy + g(i + 1, j + 1) * fx * fy).reshape(xs.shape)
h = np.where(h < -6000, -50, h)                                                      # a few no-data pixels in one sea tile
np.save(f'{OUT}/real.npy', h)
# ground metres per map pixel, from the fitted longitude/latitude across the land
lon_m = 111320 * np.cos(np.radians(37.5)); dx = np.hypot(np.gradient(ll[:, 0].reshape(xs.shape), axis=1) * lon_m, np.gradient(ll[:, 1].reshape(xs.shape), axis=1) * 111320) / 2
print('metres per map px (median)', round(float(np.median(dx))))
Image.fromarray(np.clip((h - h.min()) / (h.max() - h.min()) * 255, 0, 255).astype(np.uint8)).save(f'{OUT}/real.png')
print(len(jobs), 'tiles', h.shape, round(float(h.min())), round(float(h.max())))
