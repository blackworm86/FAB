# Golan '73 map draft: zones (zones.py) + values read off the module's map + boundary types detected where their colour is distinctive.
# Usage: python3 -I mapdraft.py <zones.json> <map image> <out map.json>
import json, sys
import numpy as np
from PIL import Image
from shapely.geometry import Polygon
Z = json.load(open(sys.argv[1])); im = np.array(Image.open(sys.argv[2]).convert('RGB')).astype(int)
# TDN from the area-number plate shapes (circle 0, square 1, hexagon 2, triangle 3)
TDN = {0: [17,18,19,20,21,22,23,24,25,26,27,28,29,31,32,33,34,36,37,38,42,43,44,71,75,76,77,78,80,81],
       1: [1,3,4,5,6,7,8,9,10,11,12,35,39,41,45,47,48,50,51,52,53,54,63,64,65,66,67,68,69,72,73,74,79,82],
       2: [2,13,16,30,40,49,55,56,57,60,61,62,70],
       3: [14,15,46,58,59,83]}
tdn = {a: t for t, ids in TDN.items() for a in ids}
MUTUAL_VP = [30, 42, 46, 50, 57, 83]                 # red/yellow star: mutual VP space (6 per the errata)
SYRIAN_VP = {2: 1, 4: 2, 7: 3, 11: 3, 21: 1}         # blue star(s): Syrian VP space, one VP per star
SUPPLY = [6, 10, 17]                                 # Israeli supply sources (half circle)
ENTRY = {'Z': 62, 'Y': 63, 'X': 69, 'W': 75, 'V': 82}  # Syrian entry areas on the east edge
ASSEMBLY = {'A': [6, 10], 'B': [17]}                 # Israeli assembly areas: box → areas it enters (1 MP)
def frac(mask_fn, line_pts):
    hit = n = 0
    for x, y in line_pts:
        x0, y0 = int(x), int(y); win = im[max(0, y0 - 9):y0 + 10, max(0, x0 - 9):x0 + 10].reshape(-1, 3)
        n += 1; hit += bool(mask_fn(win).any())
    return hit / max(n, 1)
river = lambda w: (w[:, 2] > w[:, 0] + 50) & (w[:, 2] > 180) & (w[:, 1] > 140)           # light blue water line
sam = lambda w: (w[:, 2] > w[:, 0] + 90) & (w[:, 0] < 60)                                  # dark blue dash-dot
purple = lambda w: (w[:, 0] > w[:, 1] + 30) & (w[:, 2] > w[:, 1] + 20) & (w[:, 0] > 130)    # purple dashes
polys = {a['id']: Polygon(a['polygon']) for a in Z['areas']}
conns = []
for c in Z['connections']:
    line = polys[c['a']].buffer(3).intersection(polys[c['b']].buffer(3)).centroid
    seam = polys[c['a']].boundary.intersection(polys[c['b']].buffer(5))
    pts = [seam.interpolate(t, normalized=True).coords[0] for t in np.linspace(0.08, 0.92, 24)] if seam.length > 0 else [line.coords[0]]
    fr, fs, fp = frac(river, pts), frac(sam, pts), frac(purple, pts)
    conns.append({'a': c['a'], 'b': c['b'], 'river': fr > 0.55 and fs <= 0.4, 'samBarrier': fs > 0.4, 'purpleLine': fp > 0.15, 'type': 'review', 'length': round(seam.length)})
areas = [{'id': a['id'], 'name': a['name'], 'tdn': tdn.get(a['id']), 'vp': {'mutual': a['id'] in MUTUAL_VP, 'syrian': SYRIAN_VP.get(a['id'], 0)}, 'supply': a['id'] in SUPPLY,
          'label': a['label'], 'polygon': a['polygon']} for a in Z['areas']]
missing = [a['id'] for a in areas if a['tdn'] is None]
json.dump({'size': Z['size'], 'source': 'draft: areas from the Vassal zones; values read off the map; boundary types to review', 'areas': areas, 'connections': conns,
           'entries': [{'letter': k, 'area': v, 'side': 'syrian'} for k, v in ENTRY.items()], 'assembly': ASSEMBLY}, open(sys.argv[3], 'w'), indent=1)
print('areas', len(areas), 'no tdn', missing, 'conns', len(conns), 'river', sum(c['river'] for c in conns), 'sam', sum(c['samBarrier'] for c in conns), 'purple', sum(c['purpleLine'] for c in conns))
