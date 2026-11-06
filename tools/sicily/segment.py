# Segment the Vassal map image of FAB: Sicily into its 65 areas: watershed on the drawn boundary lines (dark grey,
# river blue, army-boundary dashes), seeded at the Vassal zones' label points; the sea, the mainland, the arrows and
# boxes on the sea are outside. Writes a label image (0 = outside, 1..65 = area id).
# Usage: python3 -I segment.py <zones.json> <map image> <out labels.png>
import cv2, json, sys, numpy as np
Z = json.load(open(sys.argv[1])); im = cv2.imread(sys.argv[2]); H, W = im.shape[:2]
B, G, R = [im[..., i].astype(int) for i in range(3)]
mx = np.maximum(np.maximum(B, G), R); mn = np.minimum(np.minimum(B, G), R); mean = (B + G + R) / 3
dark = ((mean < 150) & (mx - mn < 40)).astype(np.uint8) * 255
dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))       # drops the 1 px road casings and most text
blue = ((B > R + 40) & (B > 120)).astype(np.uint8) * 255                          # rivers and sea
sea = cv2.morphologyEx(blue, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
dash = (((mx - mn) <= 12) & (mean >= 238)).astype(np.uint8) * 255                 # white dashes of the army boundary
n, cc, st, _ = cv2.connectedComponentsWithStats(blue, connectivity=8)            # drop the river-name lettering
bluel = ((np.maximum(st[:, 2], st[:, 3]) >= 28)[cc] & (blue > 0)).astype(np.uint8) * 255  # (small separate blue blobs)
bluel = cv2.morphologyEx(bluel, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))  # bridge the gaps where roads cross
lines = cv2.bitwise_or(cv2.bitwise_or(dark, bluel), dash)
elev = cv2.GaussianBlur(lines, (0, 0), 2)
mk = np.zeros((H, W), np.int32)
OUT = 255
mk[sea > 0] = OUT
grey = cv2.morphologyEx((((mx - mn) < 25) & (mean > 100) & (mean < 160)).astype(np.uint8), cv2.MORPH_OPEN,
                        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
grey[:, :2860] = 0
mk[grey > 0] = OUT                                                                # the grey mainland (Calabria)
pale = (((mx - mn) <= 30) & (mean >= 180)).astype(np.uint8)                       # white arrows printed on the sea:
n, cc, st, _ = cv2.connectedComponentsWithStats(pale, connectivity=8)             # pale blobs ringed by blue only
ring = cv2.dilate(pale, np.ones((5, 5), np.uint8)) & (1 - pale)
_, rc = cv2.connectedComponents(cv2.dilate(pale, np.ones((5, 5), np.uint8)), connectivity=8)
tot = np.bincount(rc[ring > 0], minlength=rc.max() + 1); blu = np.bincount(rc[(ring > 0) & (blue > 0)], minlength=rc.max() + 1)
okr = blu >= 0.9 * np.maximum(tot, 1); okr[0] = False
arrow = (pale > 0) & okr[rc]
mk[arrow] = OUT
for b in Z['boxes']:                                                              # boxes and tracks printed on the sea
    x0, y0, x1, y1 = map(int, b['rect']); mk[y0:y1, x0:x1] = OUT
for a in Z['areas']:
    x, y = a['label']; cv2.circle(mk, (int(x), int(y)), 10, a['id'], -1)
cv2.watershed(cv2.merge([elev, elev, elev]), mk)
lab = np.where(mk < 0, 0, mk).astype(np.uint8)
# keep the thick body of each area (line pixels excluded), flood again from those bodies, then give the watershed
# lines to the nearest area, so the areas tile the island and each shared edge runs down the middle of the printed line
river = cv2.bitwise_and(bluel, cv2.bitwise_not(cv2.dilate(sea, np.ones((9, 9), np.uint8))))
online = (cv2.dilate(dark | dash, np.ones((3, 3), np.uint8)) > 0) | (cv2.dilate(river, np.ones((7, 7), np.uint8)) > 0)
ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
body = np.zeros((H, W), np.uint8)
for v in [a['id'] for a in Z['areas']] + [OUT]:
    o = cv2.morphologyEx(((lab == v) & ~online).astype(np.uint8), cv2.MORPH_OPEN, ker)
    n, cc, st, _ = cv2.connectedComponentsWithStats(o, connectivity=8)
    if n > 1: body[cc == 1 + int(st[1:, 4].argmax())] = v
mk2 = body.astype(np.int32)                                                       # re-flood from the bodies: pieces cut off
cv2.watershed(cv2.merge([elev, elev, elev]), mk2)                                 # go back across the nearest line
body = np.where((mk2 < 0) | online, 0, mk2).astype(np.uint8)                       # line pixels: nearest side
def nearest_fill(lab):                                                             # every 0 pixel takes the nearest label
    _, idx = cv2.distanceTransformWithLabels((lab == 0).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.nonzero(lab); lut = np.zeros(idx.max() + 1, np.uint8); lut[idx[ys, xs]] = lab[ys, xs]
    return lut[idx]
full = nearest_fill(body)
for v in [a['id'] for a in Z['areas']]:                                            # one piece per area: stray crumbs
    n, cc, st, _ = cv2.connectedComponentsWithStats((full == v).astype(np.uint8), connectivity=4)   # go to their neighbours
    if n > 2: full[(cc > 0) & (cc != 1 + int(st[1:, 4].argmax()))] = 0
full = nearest_fill(full)
full[full == OUT] = 0
cv2.imwrite(sys.argv[3], full)
print('traced', len(np.unique(full)) - 1, 'areas')
