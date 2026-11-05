"""Golan '73 label placement, as tools/map3d/labels.py does for The Bulge: the label (number plate in its TDN shape, VP stars,
name) goes where it covers the least line work (roads, rivers, special boundaries) and leaves the biggest clear spot for the pieces.
Usage: python3 -I tools/golan73/labels.py data/golan73   (writes data/golan73/labels.json)"""
import json, os, re, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
from shapely.geometry import Polygon, box
from shapely.ops import polylabel
D = sys.argv[1]
M = json.load(open(os.path.join(D, 'map.json'))); A = json.load(open(os.path.join(D, 'map_art.json')))
W, H = [int(v) for v in M['size']]
def mask(keys):
    im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
    for k in keys:
        for path in A[k]:
            for sub in path.split('M')[1:]:
                pts = [tuple(map(float, p.strip().split(','))) for p in sub.split('L') if p.strip()]
                if len(pts) > 1: d.line(pts, fill=255, width=3)
    return np.array(im) > 0
WEIGHT = {('roads',): 1.4, ('river',): 2.0, ('wadi', 'escarpment', 'rugged', 'atDitch', 'samBarrier', 'sector', 'arrows1', 'arrowsAll'): 1.0}
cost = np.zeros((H, W), np.float32)
for keys, w in WEIGHT.items(): cost += nd.binary_dilation(mask(keys), iterations=3) * w
I = cost.cumsum(0).cumsum(1)
def boxcost(x0, y0, x1, y1):
    x0, y0, x1, y1 = [int(round(v)) for v in (x0, y0, x1, y1)]; x0 = max(x0, 1); y0 = max(y0, 1)
    return float(I[y1, x1] - I[y0 - 1, x1] - I[y1, x0 - 1] + I[y0 - 1, x0 - 1])
out = {}
for a in M['areas']:
    P = Polygon(a['polygon']).buffer(0); inner = P.buffer(-5)
    nvp = a['vp']['syrian'] + (1 if a['vp']['mutual'] else 0)
    nw = len(a['name']) * 7.4 + 6; best = None
    for mode, w, h in [('full', max(nw, 32 + nvp * 21), 46), ('plate', 32 + nvp * 21, 30)]:
        if inner.is_empty: break
        b = inner.bounds; cand = []
        for cy in np.arange(b[1] + h / 2, b[3] - h / 2 + 1, 4):
            for cx in np.arange(b[0] + w / 2, b[2] - w / 2 + 1, 4):
                bx = box(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
                if not inner.contains(bx): continue
                rest = inner.difference(bx.buffer(5))
                if rest.is_empty: continue
                rp = max(rest.geoms, key=lambda g: g.area) if rest.geom_type == 'MultiPolygon' else rest
                pc = polylabel(rp, 1.0); pr = rp.exterior.distance(pc)
                c = boxcost(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2) / (w * h)
                cand.append((min(pr, 36) * 2.2 - c * 55, cx, cy, pc, pr, c))
        if cand:
            s, cx, cy, pc, pr, c = max(cand, key=lambda t: t[0])
            if mode == 'full' and pr < 14 and c > 0.6: continue
            best = dict(mode=mode, x=round(float(cx), 1), y=round(float(cy), 1), w=round(w, 1), h=h, px=round(pc.x, 1), py=round(pc.y, 1), pr=round(pr, 1), clutter=round(c, 2)); break
    if not best:
        c = polylabel(P, 1.0); best = dict(mode='plate', x=round(c.x, 1), y=round(c.y, 1), w=32, h=30, px=round(c.x, 1), py=round(c.y + 24, 1), pr=8, clutter=0)
    out[a['id']] = best
json.dump(out, open(os.path.join(D, 'labels.json'), 'w'), separators=(',', ':'))
from collections import Counter
print(Counter(v['mode'] for v in out.values()), 'worst clutter', sorted(((v['clutter'], k) for k, v in out.items()))[-4:], 'small piece spots', sorted((v['pr'], k) for k, v in out.items())[:5])
