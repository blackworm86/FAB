# Segment the Vassal map image of FAB: Sicily into its 65 areas: watershed on the drawn boundary lines (dark grey,
# river blue), seeded at the Vassal zones' label points; the sea is outside. Writes a label image (0 = outside,
# 1..65 = area id) next to zones.json. Usage: python3 -I segment.py <zones.json> <map image> <out labels.png>
import cv2, json, sys, numpy as np
Z = json.load(open(sys.argv[1])); im = cv2.imread(sys.argv[2]); H, W = im.shape[:2]
B, G, R = [im[..., i].astype(int) for i in range(3)]
mx = np.maximum(np.maximum(B, G), R); mn = np.minimum(np.minimum(B, G), R); mean = (B + G + R) / 3
dark = ((mean < 150) & (mx - mn < 40)).astype(np.uint8) * 255
dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))       # drops the 1 px road casings and most text
blue = ((B > R + 40) & (B > 120)).astype(np.uint8) * 255                          # rivers and sea
sea = cv2.morphologyEx(blue, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
lines = cv2.bitwise_or(dark, blue)
elev = cv2.GaussianBlur(lines, (0, 0), 2)
mk = np.zeros((H, W), np.int32)
OUT = 255
mk[sea > 0] = OUT
for b in Z['boxes']:                                                              # boxes and tracks printed on the sea
    x0, y0, x1, y1 = map(int, b['rect']); mk[y0:y1, x0:x1] = OUT
mk[:, 2880:] = OUT
SEED = {int(k): v for k, v in (json.load(open(sys.argv[4])) if len(sys.argv) > 4 else {}).items()}   # hand-placed seeds override
for a in Z['areas']:
    x, y = SEED.get(a['id'], a['label']); cv2.circle(mk, (int(x), int(y)), 10, a['id'], -1)
cv2.watershed(cv2.merge([elev, elev, elev]), mk)
lab = np.where(mk < 0, 0, mk).astype(np.uint8)
# keep the thick body of each area, then give every line pixel to the nearest body so the areas tile the island
ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
body = np.zeros((H, W), np.uint8)
for v in [a['id'] for a in Z['areas']] + [OUT]:
    o = cv2.morphologyEx((lab == v).astype(np.uint8), cv2.MORPH_OPEN, ker)
    n, cc, st, _ = cv2.connectedComponentsWithStats(o, connectivity=8)
    if n > 1: body[cc == 1 + int(st[1:, 4].argmax())] = v
inv = (body == 0).astype(np.uint8)
_, idx = cv2.distanceTransformWithLabels(inv, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
ys, xs = np.nonzero(body); lut = np.zeros(idx.max() + 1, np.uint8)
lut[idx[ys, xs]] = body[ys, xs]
full = lut[idx]
full[full == OUT] = 0
cv2.imwrite(sys.argv[3], full)
for a in Z['areas']:
    print(a['id'], int((full == a['id']).sum()), a['area_px']) if abs(int((full == a['id']).sum()) - a['area_px']) > 0.25 * a['area_px'] else None
