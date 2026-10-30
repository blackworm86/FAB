"""Segment the FAB Bulge map into areas by watershed from hand-read area seeds.
Writes data/bulge/area_labels.png (label image, 0 = none, 1..98 = area id, 255 = outside)."""
import cv2, json, numpy as np, sys
im = cv2.imread('../docs/maps/FAB The Bulge Game Map.jpg')
H, W = im.shape[:2]
seeds = json.load(open('../data/bulge/area_seeds.json'))
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
white = ((hsv[..., 1] < 30) & (hsv[..., 2] > 225)).astype(np.uint8) * 255
B_, G_, R_ = [im[..., i].astype(int) for i in range(3)]
blue = (((B_ > 150) & (R_ < 120) & (B_ - R_ > 60)).astype(np.uint8)) * 255   # river lines are boundaries too
white = cv2.bitwise_or(white, cv2.dilate(blue, np.ones((3, 3), np.uint8)))
white = cv2.morphologyEx(white, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
elev = cv2.GaussianBlur(white, (0, 0), 1.5)
elev3 = cv2.merge([elev, elev, elev])
mk = np.zeros((H, W), np.int32)
for k, (x, y) in seeds.items():
    cv2.circle(mk, (x, y), 16, int(k), -1)
OUT = 200
mk[:, 1740:] = OUT           # right panel
mk[:6, :] = OUT; mk[-6:, :] = OUT; mk[:, :6] = OUT
for x, y in json.load(open('../data/bulge/outside_seeds.json')):
    cv2.circle(mk, (x, y), 8, OUT, -1)
cv2.watershed(elev3, mk)
yy, xx = np.mgrid[0:H, 0:W]
def leash(m8, R=330):
    # an area never extends more than R px from its seed: stops river valleys being swallowed by one far-away region
    out = m8.copy()
    for k_, (x, y) in seeds.items():
        far = (m8 == int(k_)) & ((xx - x) ** 2 + (yy - y) ** 2 > R * R)
        out[far] = 0
    return out
# refine: keep only the thick body (largest blob) of each region, then re-flood so thin leaks go to true neighbours
ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
for _ in range(2):
    m8 = np.where(mk < 0, 0, mk).astype(np.uint8)
    m8 = leash(m8)
    core = np.zeros((H, W), np.int32)
    for v in list(range(1, 99)) + [OUT]:
        o = cv2.morphologyEx((m8 == v).astype(np.uint8), cv2.MORPH_OPEN, ker)
        n, cc, st, _ = cv2.connectedComponentsWithStats(o, connectivity=8)
        if n > 1:
            core[cc == 1 + int(st[1:, 4].argmax())] = v
    cv2.watershed(elev3, core)
    mk = core
# final: thick bodies only, every other pixel (incl. border lines) goes to the nearest body
m8 = leash(np.where(mk < 0, 0, mk).astype(np.uint8))
body = np.zeros((H, W), np.uint8)
k9 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
for v in list(range(1, 99)) + [OUT]:
    o = cv2.morphologyEx((m8 == v).astype(np.uint8), cv2.MORPH_OPEN, k9)
    n, cc, st, _ = cv2.connectedComponentsWithStats(o, connectivity=8)
    if n > 1:
        body[cc == 1 + int(st[1:, 4].argmax())] = v
_, idx = cv2.distanceTransformWithLabels((body == 0).astype(np.uint8), cv2.DIST_L2, 3, labelType=cv2.DIST_LABEL_PIXEL)
flat = body.ravel()
lut = np.zeros(idx.max() + 1, np.uint8)
ys, xs = np.nonzero(body)
lut[idx[ys, xs]] = body[ys, xs]
lab = lut[idx]
cv2.imwrite('../data/bulge/area_bodies.png', body)
cv2.imwrite('../data/bulge/area_labels.png', lab)
rng = np.random.default_rng(3); cols = rng.integers(40, 230, (256, 3)); cols[0] = 255; cols[OUT] = 0
vis = (0.55 * cols[lab] + 0.45 * im).astype(np.uint8)
for k, (x, y) in seeds.items():
    cv2.putText(vis, k, (x - 10, y + 5), 0, 0.5, (0, 0, 0), 2); cv2.putText(vis, k, (x - 10, y + 5), 0, 0.5, (255, 255, 255), 1)
cv2.imwrite(sys.argv[1], vis[:, :1740])
