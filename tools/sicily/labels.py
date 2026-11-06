"""Sicily label placement, as tools/golan73/labels.py does for Golan: the label (number plate in its TDN shape, VP symbols, name)
goes where it covers the least line work (roads, rivers, restricted terrain, army boundaries, the coast) and leaves the biggest clear spot for the pieces.
Usage: python3 -I tools/sicily/labels.py data/sicily   (writes data/sicily/labels.json)"""
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
                pts = [tuple(map(float, p.strip().rstrip('Z').split(','))) for p in sub.split('L') if p.strip()]
                if len(pts) > 1: d.line(pts, fill=255, width=3)
    return np.array(im) > 0
WEIGHT = {('roads',): 1.4, ('river',): 2.0, ('restricted', 'army_boundary'): 1.0, ('coast',): 1.2}
cost = np.zeros((H, W), np.float32)
for keys, w in WEIGHT.items(): cost += nd.binary_dilation(mask(keys), iterations=3) * w
for c in A['cities']:                                                                   # the drawn city blocks and the port anchors stay visible
    pts = [tuple(map(float, p.split(','))) for p in re.findall(r'-?[\d.]+,-?[\d.]+', c['d'])]
    im = Image.new('L', (W, H), 0); ImageDraw.Draw(im).polygon(pts, fill=255); cost += nd.binary_dilation(np.array(im) > 0, iterations=4) * 2.5
for p in A['port_symbols'] + A['airfields']:
    yy, xx = np.ogrid[0:H, 0:W]; cost += (((xx - p['x']) ** 2 + (yy - p['y']) ** 2) < 18 ** 2) * 2.5
I = cost.cumsum(0).cumsum(1)
def boxcost(x0, y0, x1, y1):
    x0, y0, x1, y1 = [int(round(v)) for v in (x0, y0, x1, y1)]; x0 = max(x0, 1); y0 = max(y0, 1); x1 = min(x1, W - 1); y1 = min(y1, H - 1)
    return float(I[y1, x1] - I[y0 - 1, x1] - I[y1, x0 - 1] + I[y0 - 1, x0 - 1])
out = {}
for a in M['areas']:
    P = Polygon(a['polygon']).buffer(0); inner = P.buffer(-5)
    nvp = a['vp']['allied'] + a['vp']['german'] + (1 if a['vp']['mutual'] else 0)
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
ML = M['mainland']; out[ML['id']] = dict(mode='plate', x=ML['label'][0], y=ML['label'][1] + 40, w=32, h=30, px=ML['label'][0], py=ML['label'][1] + 90, pr=40, clutter=0)
json.dump(out, open(os.path.join(D, 'labels.json'), 'w'), separators=(',', ':'))
from collections import Counter
print(Counter(v['mode'] for v in out.values()), 'worst clutter', sorted(((v['clutter'], k) for k, v in out.items()))[-4:], 'small piece spots', sorted((v['pr'], k) for k, v in out.items())[:5])
