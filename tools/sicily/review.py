# Review overlay: draws data/sicily/map_vassal.json over a map image (the Vassal map, or the printed scan with the
# affine that maps scan px to Vassal px) so the draft can be checked by eye. Writes PNGs to a scratch folder only.
# Usage: python3 -I review.py <map_vassal.json> <image> <out.png> [a b c d e f  (scan->vassal affine, row-major)]
import json, sys
import cv2, numpy as np
from shapely.geometry import Polygon, LineString, MultiLineString
M = json.load(open(sys.argv[1])); im = cv2.imread(sys.argv[2])
A = np.array([float(v) for v in sys.argv[4:10]]).reshape(2, 3) if len(sys.argv) >= 10 else np.array([[1, 0, 0], [0, 1, 0.]])
Ai = cv2.invertAffineTransform(A)                      # vassal px -> image px
s = float(np.sqrt(abs(np.linalg.det(Ai[:, :2]))))
T = lambda pts: (np.c_[np.asarray(pts, float), np.ones(len(pts))] @ Ai.T)
P = {a['id']: Polygon(a['polygon']) for a in M['areas']}
def lines(g):
    if g.is_empty: return []
    if isinstance(g, LineString): return [g]
    if hasattr(g, 'geoms'): return [x for y in g.geoms for x in lines(y)]
    return []
over = im.copy()
for a in M['areas']:
    cv2.polylines(over, [T(a['polygon']).round().astype(np.int32)], True, (60, 60, 60), max(1, round(2 * s)))
for c in M['connections']:
    seam = P[c['a']].boundary.intersection(P[c['b']].buffer(4))
    col = (0, 170, 0) if c['type'] == 'road' else (0, 0, 230)
    for ln in lines(seam):
        if ln.length < 3: continue
        p = T(list(ln.coords)).round().astype(np.int32)
        if c['river']: cv2.polylines(over, [p], False, (255, 160, 0), max(2, round(9 * s)))
        if c['restricted']: cv2.polylines(over, [p], False, (20, 70, 120), max(2, round(13 * s)))
        if c['army_boundary']: cv2.polylines(over, [p], False, (255, 0, 255), max(2, round(6 * s)))
        cv2.polylines(over, [p], False, col, max(1, round(3 * s)))
    for x, y in c['road_at']:
        q = T([[x, y]])[0]; cv2.circle(over, (int(q[0]), int(q[1])), max(3, round(8 * s)), (0, 170, 0), max(1, round(2 * s)))
fs = 0.55 * s * 1.6
for a in M['areas']:
    x, y = T([a['label']])[0]
    vp = []
    if a['vp']['allied']: vp.append('A%d' % a['vp']['allied'])
    if a['vp']['german']: vp.append('G%d' % a['vp']['german'])
    if a['vp']['mutual']: vp.append('M')
    tags = [t for t in [' '.join(vp), a['port'] or '', 'AF' if a['airfield'] else '', ','.join(a['beaches'])] if t]
    txt = ['%d T%d %s' % (a['id'], a['tdn'], a['zone'] or '?')] + tags
    for i, t in enumerate(txt):
        org = (int(x - 30 * s), int(y + i * 22 * s))
        cv2.putText(over, t, org, cv2.FONT_HERSHEY_SIMPLEX, fs, (255, 255, 255), max(2, round(5 * s)))
        cv2.putText(over, t, org, cv2.FONT_HERSHEY_SIMPLEX, fs, (0, 0, 0), max(1, round(2 * s)))
for b in M['beaches'] + M['ports']:
    r = T([b['rect'][:2], b['rect'][2:]]).round().astype(int)
    cv2.rectangle(over, tuple(r[0]), tuple(r[1]), (0, 140, 255), max(1, round(3 * s)))
    cx, cy = (r[0] + r[1]) // 2; tgt = T([next(a['label'] for a in M['areas'] if a['id'] == b['area'])])[0].astype(int)
    cv2.arrowedLine(over, (int(cx), int(cy)), (int(tgt[0]), int(tgt[1])), (0, 140, 255), max(1, round(2 * s)), tipLength=0.03)
for b in M['boxes']:
    r = T([b['rect'][:2], b['rect'][2:]]).round().astype(int)
    cv2.rectangle(over, tuple(r[0]), tuple(r[1]), (200, 0, 200), max(1, round(2 * s)))
cv2.imwrite(sys.argv[3], over)
