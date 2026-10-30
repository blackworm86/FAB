"""Derive area adjacency + edge features from area_bodies.png (region cores) and the map image.
Two areas are adjacent if their cores come within ~10px of each other over a long enough stretch.
Feature detection (road crossing / river / dashed army boundary) works inside that overlap band."""
import cv2, json, numpy as np, networkx as nx
im = cv2.imread('../docs/maps/FAB The Bulge Game Map.jpg')
B = cv2.imread('../data/bulge/area_bodies.png', 0)
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
Bc, Gc, Rc = [im[..., i].astype(int) for i in range(3)]
blue = (Bc > 150) & (Rc < 110) & (Bc - Rc > 70)
road = (hsv[..., 1] < 40) & (hsv[..., 2] > 55) & (hsv[..., 2] < 135)
road = cv2.morphologyEx(road.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)).astype(bool)
roadD = cv2.dilate(road.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
# dashes: small elongated dark components (army boundary is a dashed line)
dark = ((hsv[..., 1] < 45) & (hsv[..., 2] < 150) & (hsv[..., 2] > 40)).astype(np.uint8)
n, cc, st, _ = cv2.connectedComponentsWithStats(dark, connectivity=8)
ok = np.zeros(n, bool)
for i in range(1, n):
    x, y, w, h, a = st[i]
    ok[i] = 5 <= max(w, h) <= 18 and min(w, h) <= 5 and a >= 8
dashId = np.where(ok[cc], cc, 0)
k21 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21))
k9 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
D = {a: cv2.dilate((B == a).astype(np.uint8), k21).astype(bool) for a in range(1, 99)}
dA = {}
def dist_to(a):
    if a not in dA: dA[a] = cv2.distanceTransform((B != a).astype(np.uint8), cv2.DIST_L2, 3)
    return dA[a]
MIN_OVERLAP = 300
edges = []
for a in range(1, 99):
    for b in range(a + 1, 99):
        band = D[a] & D[b]
        ov = int(band.sum())
        if ov < MIN_OVERLAP: continue
        length = ov / 12.0
        riv = float((blue & band).sum()) / length
        ids = np.unique(dashId[band & cv2.dilate(band.astype(np.uint8), k9).astype(bool)])
        ndash = int((ids > 0).sum())
        rb = (roadD & band).astype(np.uint8)
        k, rcc = cv2.connectedComponents(rb, connectivity=8)
        cross = 0
        for j in range(1, k):
            c = rcc == j
            ra = c & road & (B == a)  | c & road & (dist_to(a) < 12) & (dist_to(b) < 12)
            # road pixels close to both cores: sample around the middle of the gap
            near_a = c & road & (dist_to(a) < 8) & (dist_to(b) >= 3)
            near_b = c & road & (dist_to(b) < 8) & (dist_to(a) >= 3)
            if near_a.sum() >= 3 and near_b.sum() >= 3: cross += 1
        edges.append(dict(a=a, b=b, overlap=ov, river=round(riv, 2), road=cross, dashes=ndash, dashDensity=round(ndash / length * 40, 2)))
G = nx.Graph([(e['a'], e['b']) for e in edges])
print(len(edges), 'edges; planar:', nx.check_planarity(G)[0], '; with road', sum(e['road'] > 0 for e in edges))
json.dump(edges, open('../data/bulge/edges_raw.json', 'w'))
