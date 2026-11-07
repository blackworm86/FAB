"""The Sicily board's ground, drawn in the printed map's manner from its own data: the paper tan of the lowlands darkening to brown with
the real height of the ground (the print's relief washes), mottled as the print is, Etna's dark dome, the printed sea and the grey mainland.

Usage: python3 -I tools/sicily/ground.py docs/games/sicily/maps/SICILYmap-FINAL-72.jpg data/sicily <scratch>/real.npy <scratch>/sicily-ground.png
The scan is only read for its colours: the median colour of its ground at each elevation band (lines, text and symbols left out) gives the
wash palette, and its sea and mainland their colours. The shapes come from the real elevation (terrain.py) and from the game's own land
polygons, so every border and the coast line fall exactly where the board draws them.
"""
import json, os, re, sys
import numpy as np, cv2
from scipy import ndimage as nd

SCAN, D, REAL, OUT = sys.argv[1:5]
A = json.load(open(os.path.join(D, 'map_art.json'))); M = json.load(open(os.path.join(D, 'map.json')))
W, H = M['size']
pts = lambda d: [tuple(map(float, q.split(','))) for q in re.findall(r'-?[\d.]+,-?[\d.]+', d)]
A1 = np.array([[1.36112, -0.0000116, -0.395], [-0.0000279, 1.36174, -0.293]]); A2 = np.array([[0.7657, -0.0001, 0.2434], [-0.0002, 0.7659, -0.3259]])
T = (np.vstack([A2, [0, 0, 1]]) @ np.vstack([A1, [0, 0, 1]]))[:2]
scan = cv2.warpAffine(cv2.imread(SCAN), T, (W, H), flags=cv2.INTER_AREA)[..., ::-1].astype(np.float32)   # RGB, in the board's coordinates
h = nd.zoom(np.load(REAL), 2, order=1)[:H, :W].astype(np.float32)

# ---------- the land as the board knows it ----------
def mask(polys):
    m = np.zeros((H, W), np.uint8)
    for P in polys:
        if len(P) > 2: cv2.fillPoly(m, [np.array(P, np.int32)], 1)
    return m > 0
island = mask([a['polygon'] for a in M['areas']]) | mask([pts(p) for p in A['coast']]) | mask([pts(p) for p in A['islets']])
mainland = mask([pts(p) for p in A['mainland']])

# ---------- the print's palette: ground colour by height (its plain paper, its washes), the sea, the mainland ----------
r, g, b = scan[..., 0], scan[..., 1], scan[..., 2]; gray = 0.299 * r + 0.587 * g + 0.114 * b; sat = scan.max(2) - scan.min(2)
plain = island & (gray > 110) & (sat < 125) & ~(b - r > 40)                                            # paper and washes: not lines, text, blue or symbols
plain = nd.binary_erosion(plain, iterations=2)
bands = [(-50, 60), (60, 150), (150, 300), (300, 500), (500, 750), (750, 1000), (1000, 1400), (1400, 1900), (1900, 2600), (2600, 4000)]
palette = []
for lo, hi in bands:
    sel = plain & (h >= lo) & (h < hi); c = np.median(scan[sel].reshape(-1, 3), 0) if sel.sum() > 500 else palette[-1][1]
    palette.append(((lo + hi) / 2, c))
sea = np.median(scan[~nd.binary_dilation(island | mainland, iterations=40) & (b - r > 30)].reshape(-1, 3), 0)
ml = nd.binary_erosion(mainland, iterations=8) & (sat < 30)
grey = np.median(scan[ml].reshape(-1, 3), 0) if ml.sum() > 500 else np.array([150, 150, 145.])
print('palette by height', [(int(z), c.astype(int).tolist()) for z, c in palette]); print('sea', sea.astype(int), 'mainland', grey.astype(int))

# ---------- the ground: height mapped through the palette, with the print's blotchy hand ----------
rng = np.random.default_rng(1943)
blotch = nd.gaussian_filter(rng.standard_normal((H, W)), 14) * 60 + nd.gaussian_filter(rng.standard_normal((H, W)), 5) * 18   # the washes are laid in patches, not contours
hz = nd.gaussian_filter(h, 6) + blotch * nd.gaussian_filter(np.clip(h / 300, 0.3, 1.6), 20)           # higher ground: broader, bolder patches
zs = np.array([z for z, _ in palette]); cols = np.array([c for _, c in palette])
ground = np.stack([np.interp(hz, zs, cols[:, k]) for k in range(3)], -1)
ground = ground + nd.gaussian_filter(rng.standard_normal((H, W)), 1.2)[..., None] * 2.5            # the paper's grain
out = np.where(island[..., None], ground, sea)
out = np.where(mainland[..., None], grey + nd.gaussian_filter(rng.standard_normal((H, W)), 6)[..., None] * 5, out)
cv2.imwrite(OUT, np.ascontiguousarray(np.clip(out, 0, 255).astype(np.uint8)[..., ::-1]))
print('ground', out.shape)
