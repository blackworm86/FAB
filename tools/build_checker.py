"""Build the self-contained interactive map checker (tools/map-checker.html) from data/bulge + the map image."""
import base64, cv2, json, numpy as np, sys
D = '../data/bulge/'
areas = json.load(open(D + 'areas.json')); edges = json.load(open(D + 'edges.json')); entry = json.load(open(D + 'entry_areas.json'))
B = cv2.imread(D + 'area_bodies.png', 0)
im = cv2.imread('../docs/maps/FAB The Bulge Game Map.jpg')[:, :1740]
H, W = im.shape[:2]
polys = {int(k): v for k, v in json.load(open(D + 'polygons_auto.json')).items()}
k21 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21))
cache = {}
def dil(i):
    if i not in cache: cache[i] = cv2.dilate((B == i).astype(np.uint8), k21).astype(bool)
    return cache[i]
seed = {a['id']: a['seed'] for a in areas}
for e in edges:
    ys, xs = np.nonzero(dil(e['a']) & dil(e['b']))
    pa, pb = seed[e['a']], seed[e['b']]
    e['mid'] = [int(xs.mean()), int(ys.mean())] if len(xs) else [(pa[0] + pb[0]) // 2, (pa[1] + pb[1]) // 2]
BARS = {'A':[(1095,30,1237,52)],'B':[(960,30,1091,52)],'C':[(761,30,944,52)],'D':[(677,31,772,91),(626,77,695,126)],'E':[(440,162,525,187)],'F':[(63,162,244,187),(19,162,70,455),(234,162,309,187)],'G':[(19,571,43,744)],'H':[(19,758,43,931)],'J':[(123,1284,243,1371),(234,1376,329,1440)],'K':[(549,1536,700,1560)],'L':[(703,1536,799,1560)],'M':[(802,1536,975,1560)],'N':[(978,1536,1087,1560)],'P':[(1088,1536,1201,1560)],'Q':[(1204,1536,1421,1560)],'X':[(1685,1032,1708,1241)],'Y':[(1685,686,1708,792)],'Z':[(1685,418,1708,545)]}
ent = {k: dict(side=v['side'], area=v['area'], rects=[list(r) for r in BARS[k]]) for k, v in entry.items()}
ok, jpg = cv2.imencode('.jpg', im, [cv2.IMWRITE_JPEG_QUALITY, 80])
img = 'data:image/jpeg;base64,' + base64.b64encode(jpg).decode()
data = dict(width=W, height=H, areas=areas, edges=edges, polys=polys, entry=ent)
t = open('map-checker.template.html').read().replace('__DATA__', json.dumps(data, ensure_ascii=False, separators=(',', ':'))).replace('__IMG__', img)
open('map-checker.fragment.html', 'w').write(t)
open('map-checker.html', 'w').write('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html{color-scheme:light}body{margin:0}</style></head><body>' + t + '</body></html>')
print(len(t) / 1e6, 'MB')
