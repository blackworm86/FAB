"""Trace the scanned map into layered vector art (web/public/map-vector.svg).
Layers: frame, terrain, entry zones, borders (verified area polygons, snapped and de-duplicated), rivers and roads (skeleton centre lines drawn as thick strokes),
towns and cities, victory points, area markers, labels. The scan (map.jpg) is never modified; the empty `woods` layer is reserved for the 3D scenery pass."""
import json, math, cv2, numpy as np
from skimage.morphology import skeletonize
W = 1740
im = cv2.imread('web/public/map.jpg')[:, :W]; H = im.shape[0]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); h, s, v = [x.astype(int) for x in cv2.split(hsv)]
bgr = im.astype(int)
def near(rgb, tol): return (np.abs(bgr[:, :, 2] - rgb[0]) + np.abs(bgr[:, :, 1] - rgb[1]) + np.abs(bgr[:, :, 0] - rgb[2])) < tol
SC = 3
def fill_paths(mask, min_area=0, eps=0.8, sig=1.6, thr=110):
    m = cv2.GaussianBlur(cv2.resize(mask.astype(np.uint8) * 255, None, fx=SC, fy=SC, interpolation=cv2.INTER_CUBIC), (0, 0), sig) > thr
    cs, hier = cv2.findContours(m.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE); d = []
    for i, c in enumerate(cs):
        root = i
        while hier[0][root][3] != -1: root = hier[0][root][3]
        if len(c) < 4 or cv2.contourArea(cs[root]) / SC / SC < min_area: continue
        a = cv2.approxPolyDP(c, eps * SC / 3, True)[:, 0, :] / SC
        d.append('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in a) + 'Z')
    return ''.join(d)

def trace(mask, min_len, spur=10):
    """Skeleton centre lines as polylines with a local width from the distance transform."""
    dist = cv2.distanceTransform(mask.astype(np.uint8), cv2.DIST_L2, 3)
    sk = skeletonize(mask > 0); ys, xs = np.nonzero(sk); pts = set(zip(xs.tolist(), ys.tolist()))
    nb = lambda p: [(p[0] + dx, p[1] + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy) and (p[0] + dx, p[1] + dy) in pts]
    deg = {p: len(nb(p)) for p in pts}; nodes = [p for p in pts if deg[p] != 2]; seen = set(); out = []
    def walk(a, b):
        path = [a, b]; seen.add((a, b)); seen.add((b, a))
        while deg[path[-1]] == 2:
            nx = [q for q in nb(path[-1]) if q != path[-2] and (path[-1], q) not in seen]
            if not nx: break
            q = nx[0]; seen.add((path[-1], q)); seen.add((q, path[-1])); path.append(q)
        return path
    for n in nodes:
        for q in nb(n):
            if (n, q) not in seen: out.append(walk(n, q))
    for p in pts:                                                   # closed loops
        for q in nb(p):
            if (p, q) not in seen: out.append(walk(p, q))
    # connected components by shared pixels, to drop text and dashes
    comp = {}; lab = cv2.connectedComponents(sk.astype(np.uint8), connectivity=8)[1]
    res = []
    total = {}
    for pth in out: total[lab[pth[0][1], pth[0][0]]] = total.get(lab[pth[0][1], pth[0][0]], 0) + len(pth)
    for pth in out:
        if total[lab[pth[0][1], pth[0][0]]] < min_len: continue
        if len(pth) < spur and (deg[pth[0]] == 1 or deg[pth[-1]] == 1): continue
        w = float(np.mean([dist[y, x] for x, y in pth])) * 2
        a = cv2.approxPolyDP(np.array(pth, np.int32).reshape(-1, 1, 2), 1.4, False)[:, 0, :].astype(float)
        for _ in range(2):                                          # Chaikin smoothing
            if len(a) < 3: break
            b = [a[0]]
            for i in range(len(a) - 1): b += [0.75 * a[i] + 0.25 * a[i + 1], 0.25 * a[i] + 0.75 * a[i + 1]]
            b.append(a[-1]); a = np.array(b)
        res.append((w, a))
    return res
def strokes(lines, color, wmin, grow=1.3, casing=None):
    buckets = {}
    for w, a in lines:
        k = round(max(wmin, w * grow) * 2) / 2; buckets.setdefault(k, []).append('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in a))
    out = ''
    for k, ds in sorted(buckets.items()):
        if casing: out += f'<path d="{"".join(ds)}" stroke="{casing}" stroke-width="{k + 2.2}"/>'
    for k, ds in sorted(buckets.items()): out += f'<path d="{"".join(ds)}" stroke="{color}" stroke-width="{k}"/>'
    return out

m = json.load(open('data/bulge/map.json')); areas = {a['id']: a for a in json.load(open('data/bulge/areas.json'))}; entries = json.load(open('data/bulge/entry_areas.json'))
conns = {(min(c['a'], c['b']), max(c['a'], c['b'])): c for c in m['connections']}
ground = '#%02x%02x%02x' % tuple(int(x) for x in np.median(im[:, :].reshape(-1, 3), axis=0)[::-1])
# --- playing area = union of the verified polygons; the printed title, tank and legend lie outside it and are never traced
play = np.zeros((H, W), np.uint8)
for a in json.load(open('data/bulge/map.json'))['areas']: cv2.fillPoly(play, [np.array(a['polygon'], np.int32)], 255)
play = cv2.morphologyEx(play, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8)); play_in = cv2.dilate(play, np.ones((9, 9), np.uint8)) > 0
# --- frame and terrain
bgc = (188, 202, 211); is_bg = near(bgc, 14)
bg_big = cv2.morphologyEx(is_bg.astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
terrain = fill_paths(play_in, 5000, 1.0, 2.0)
# --- entry zones
green = fill_paths(cv2.morphologyEx(((h >= 50) & (h <= 70) & (s > 90) & (v > 110)).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)), 400)
strip = fill_paths(cv2.morphologyEx(near((159, 172, 180), 22).astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)), 600)
# --- area borders from the verified polygons: snap shared vertices, drop duplicate edges, dash the restricted ones
pts = [(a['id'], i, tuple(p)) for a in m['areas'] for i, p in enumerate(a['polygon'])]
parent = list(range(len(pts)))
def find(i):
    while parent[i] != i: parent[i] = parent[parent[i]]; i = parent[i]
    return i
P = np.array([p[2] for p in pts], float)
for i in range(len(pts)):
    d = np.hypot(*(P - P[i]).T)
    for j in np.nonzero(d < 7)[0]:
        if j > i: parent[find(j)] = find(i)
cl = {}
for i in range(len(pts)): cl.setdefault(find(i), []).append(i)
cpos = {r: P[ix].mean(axis=0) for r, ix in cl.items()}; idx = {(a, i): find(k) for k, (a, i, _) in enumerate(pts)}
edges = {}
for a in m['areas']:
    n = len(a['polygon'])
    for i in range(n):
        u, w = idx[(a['id'], i)], idx[(a['id'], (i + 1) % n)]
        if u != w: edges.setdefault((min(u, w), max(u, w)), set()).add(a['id'])
solid, dashed, army = [], [], []
for (u, w), ids in edges.items():
    seg = f'M{cpos[u][0]:.1f} {cpos[u][1]:.1f}L{cpos[w][0]:.1f} {cpos[w][1]:.1f}'; ids = sorted(ids); c = conns.get((ids[0], ids[1])) if len(ids) == 2 else None
    (dashed if c and c['restricted'] else solid).append(seg)
    if c and c['army_boundary']: army.append(seg)
# --- rivers and roads (centre lines)
river_mask = ((h >= 95) & (h <= 115) & (s > 110) & (v > 120)).astype(np.uint8); river_mask = cv2.morphologyEx(river_mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)) * play_in.astype(np.uint8)
road_mask = ((s < 48) & (v < 128)).astype(np.uint8); road_mask = cv2.morphologyEx(road_mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) * play_in.astype(np.uint8)
for a in m['areas']:                                               # the printed VP crosses and area boxes are not roads
    x, y = a['label']; road_mask[max(0, int(y) - 68):int(y) - 12, max(0, int(x) - 28):int(x) + 28] = 0; road_mask[max(0, int(y) - 12):int(y) + 10, max(0, int(x) - 16):int(x) + 16] = 0
pink_mask = cv2.dilate(play, np.ones((25, 25), np.uint8)).astype(bool) * cv2.morphologyEx(((h >= 148) & (h <= 172) & (s > 55) & (v > 110) & (v < 215)).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)); pink = trace(pink_mask, 120)
rivers = trace(river_mask, 30); roads = [(w, a) for w, a in trace(road_mask, 70) if w < 9]
# --- towns: white discs with a dark ring; cities: the large dark junction blobs
gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
def _k(r0, r1):
    k = np.zeros((2 * r1 + 1, 2 * r1 + 1), np.float32); cv2.circle(k, (r1, r1), r1, 1, -1)
    if r0: cv2.circle(k, (r1, r1), r0, 0, -1)
    return k / k.sum()
gf = gray.astype(np.float32); inner = cv2.filter2D(gf, -1, _k(0, 4)); mid = cv2.filter2D(gf, -1, _k(6, 7)); score = inner - mid
pk = np.argwhere((score > 60) & (inner > 225) & (score >= cv2.dilate(score, np.ones((15, 15))) - 1e-3))        # a bright disc inside a dark ring
towns = [(x, y, 6.5) for y, x in pk]
big = cv2.morphologyEx(road_mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
cities = fill_paths(big, 60, 0.8, 1.2)
# --- area markers and victory points
def shape_of(x, y):
    p = np.median(im[max(0, int(y) - 9):int(y) + 10, max(0, int(x) - 9):int(x) + 10].reshape(-1, 3), axis=0)[::-1]; r, g, b = p
    if r > 215 and g > 200: return 'circle', '#f4e3a4', '#8a7a3a'
    if r > 175 and g > 140 and b < 120: return 'square', '#c9a24f', '#6b5420'
    if r < 110 and g < 120: return 'triangle', '#4a5028', '#1d2110'
    return 'hex', '#8a8f86', '#2d3330'
marks = ''; labels = ''
star = lambda x, y, r, fill, stroke: f'<path d="' + 'L'.join(f'{x + (r if i % 2 == 0 else r * 0.45) * math.sin(i * math.pi / 5):.1f} {y - (r if i % 2 == 0 else r * 0.45) * math.cos(i * math.pi / 5):.1f}' for i in range(10)).join(('M', 'Z')) + f'" fill="{fill}" stroke="{stroke}" stroke-width="1.2"/>'
cross = lambda x, y, r: f'<path d="M{x - r * .3:.1f} {y - r:.1f}h{r * .6:.1f}v{r * .55:.1f}h{r * .7:.1f}v{r * .6:.1f}h{-r * .7:.1f}v{r * 1.25:.1f}h{-r * .6:.1f}v{-r * 1.25:.1f}h{-r * .7:.1f}v{-r * .6:.1f}h{r * .7:.1f}Z" fill="#111"/>'
for a in m['areas']:
    if a['id'] not in areas: continue
    x, y = a['label']; info = areas[a['id']]; sh, f, st = shape_of(x, y)
    if sh == 'circle': mk = f'<circle cx="{x}" cy="{y - 3}" r="13" fill="{f}" stroke="{st}" stroke-width="1.6"/>'
    elif sh == 'triangle': mk = f'<path d="M{x - 15} {y - 14}H{x + 15}L{x} {y + 12}Z" fill="{f}" stroke="{st}" stroke-width="1.6"/>'
    elif sh == 'hex': mk = f'<path d="M{x - 15} {y - 3}L{x - 7} {y - 15}H{x + 7}L{x + 15} {y - 3}L{x + 7} {y + 9}H{x - 7}Z" fill="{f}" stroke="{st}" stroke-width="1.6"/>'
    else: mk = f'<rect x="{x - 14}" y="{y - 15}" width="28" height="24" rx="3" fill="{f}" stroke="{st}" stroke-width="1.6"/>'
    ink = '#fff' if sh in ('triangle',) else '#1a1608'
    marks += mk + f'<text x="{x}" y="{y + (0 if sh != "triangle" else -3)}" text-anchor="middle" font-size="16" font-weight="700" fill="{ink}" stroke="none" font-family="Arial Narrow, Arial, sans-serif">{a["id"]}</text>'
    labels += f'<text x="{x}" y="{y + 26}" text-anchor="middle">{info["name"]}</text>'
    vp = info['vp']
    for i in range(vp['allied']): marks += cross(x + (i - (vp['allied'] - 1) / 2) * 24, y - 40, 10)                                  # Allied objective: black cross
    for i in range(vp['german']): marks += f'<circle cx="{x}" cy="{y - 40 - i * 20}" r="9" fill="#2f78c8" stroke="#fff" stroke-width="1.5"/>' + star(x, y - 40 - i * 20, 6.5, '#fff', 'none')   # German objective: blue star
    if vp['mutual']: marks += star(x, y - 40, 11, '#f2d21b', '#c3281c')
for letter, e in entries.items():
    a = next((q for q in m['areas'] if q['id'] == e['area']), None)
    if a: marks += f'<g><circle cx="{a["label"][0] + 34}" cy="{a["label"][1] - 3}" r="11" fill="#fff" stroke="#111" stroke-width="2"/><text x="{a["label"][0] + 34}" y="{a["label"][1] + 3}" text-anchor="middle" font-size="15" font-weight="700" fill="#111" font-family="Arial, sans-serif">{letter}</text></g>'
town_svg = ''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r - 0.5:.1f}" fill="#fff" stroke="#3b403d" stroke-width="2.4"/>' for x, y, r in towns)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<rect id="frame" width="{W}" height="{H}" fill="#bccad3"/>
<g id="terrain"><path fill="{ground}" fill-rule="evenodd" d="{terrain}"/></g>
<g id="woods" opacity="0"><!-- reserved for the 3D scenery pass --></g>
<g id="entry-zones"><path fill="#58a05a" d="{green}"/><path fill="#9fb0b8" d="{strip}"/></g>
<g id="borders" fill="none" stroke="#fbfbf6" stroke-width="4.2" stroke-linecap="round"><path d="{''.join(solid)}"/><path d="{''.join(dashed)}" stroke-width="3.4" stroke-dasharray="11 7"/></g>
<g id="army-boundaries" fill="none" stroke-linecap="round"><path d="{''.join(army)}" stroke="#6d736f" stroke-width="2.4" stroke-dasharray="9 6"/><path d="{''.join('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in a) for _, a in pink)}" stroke="#c23a86" stroke-width="5"/></g>
<g id="rivers" fill="none" stroke-linecap="round" stroke-linejoin="round">{strokes(rivers, "#2f8fd0", 4.6, 1.15)}</g>
<g id="roads" fill="none" stroke-linecap="round" stroke-linejoin="round">{strokes(roads, "#5d6360", 4.4, 1.0, "#3a3f3d")}</g>
<g id="cities"><path fill="#6b706d" stroke="#3a3f3d" stroke-width="1.5" d="{cities}"/></g>
<g id="towns">{town_svg}</g>
<g id="markers">{marks}</g>
<g id="labels" font-family="Arial Narrow, Arial, sans-serif" font-size="16" font-style="italic" fill="#2c3a22" stroke="{ground}" stroke-width="3.2" paint-order="stroke">{labels}</g>
</svg>'''
open('web/public/map-vector.svg', 'w').write(svg); print(len(svg) // 1024, 'KB', len(rivers), 'rivers', len(roads), 'roads', len(towns), 'towns')

# ---------------- editable Illustrator-ready file: one top-level group (= layer) per feature type, areas named area-N ----------------
def poly_d(pts): return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z'
def line_d(a): return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in a)
def stroked(lines, color, wmin, cls):
    return ''.join(f'<path id="{cls}-{i + 1}" d="{line_d(a)}" fill="none" stroke="{color}" stroke-width="{max(wmin, w * 1.15):.1f}" stroke-linecap="round" stroke-linejoin="round"/>' for i, (w, a) in enumerate(lines))
area_paths = ''.join(f'<path id="area-{a["id"]}" d="{poly_d(a["polygon"])}" fill="#ffffff" fill-opacity="0.01" stroke="#e2574c" stroke-width="1"/>' for a in m['areas'])
entry_paths = ''.join(f'<path id="entry-{e}" d="{fill_paths(cv2.dilate(np.zeros((H, W), np.uint8), np.ones((1, 1), np.uint8)))}" />' for e in []) 
labels_t = ''.join(f'<text id="label-{a["id"]}" x="{a["label"][0]}" y="{a["label"][1] + 26}" text-anchor="middle" font-family="ArialNarrow-Italic, Arial" font-style="italic" font-size="16" fill="#2c3a22">{areas[a["id"]]["name"]}</text>' for a in m['areas'] if a['id'] in areas)
nums_t = ''.join(f'<text id="number-{a["id"]}" x="{a["label"][0]}" y="{a["label"][1] + 5}" text-anchor="middle" font-family="Arial-BoldMT, Arial" font-weight="700" font-size="16" fill="#1a1608">{a["id"]}</text>' for a in m['areas'] if a['id'] in areas)
ed = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<!-- FAB The Bulge: editable map. Each top-level group is a layer. Keep layer names. Rivers, roads and borders are plain strokes (stroke-width = line width). Areas are closed paths named area-N. -->
<g id="_scan" style="isolation:isolate"><image id="scan" width="2448" height="{H}" xlink:href="map-scan.jpg" opacity="0.55"/></g>
<g id="terrain"><path id="terrain-fill" d="{terrain}" fill="{ground}" fill-rule="evenodd"/></g>
<g id="woods"></g>
<g id="entry-zones"><path id="entry-allied-green" d="{green}" fill="#58a05a"/><path id="entry-german-grey" d="{strip}" fill="#9fb0b8"/></g>
<g id="borders" fill="none" stroke="#fbfbf6" stroke-width="4.2" stroke-linecap="round"><path id="borders-solid" d="{''.join(solid)}"/></g>
<g id="borders-restricted" fill="none" stroke="#fbfbf6" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="11 7"><path id="borders-restricted-path" d="{''.join(dashed)}"/></g>
<g id="army-boundary">{stroked(pink, '#c23a86', 5.0, 'army')}<path id="army-internal" d="{''.join(army)}" fill="none" stroke="#6d736f" stroke-width="2.4" stroke-dasharray="9 6"/></g>
<g id="rivers">{stroked(rivers, '#2f8fd0', 4.6, 'river')}</g>
<g id="roads">{stroked(roads, '#5d6360', 4.4, 'road')}</g>
<g id="cities"><path id="cities-shape" d="{cities}" fill="#6b706d" stroke="#3a3f3d" stroke-width="1.5" fill-rule="evenodd"/></g>
<g id="towns">{''.join(f'<circle id="town-{i + 1}" cx="{x:.1f}" cy="{y:.1f}" r="{r - 0.5:.1f}" fill="#fff" stroke="#3b403d" stroke-width="2.4"/>' for i, (x, y, r) in enumerate(towns))}</g>
<g id="labels">{labels_t}{nums_t}</g>
<g id="areas">{area_paths}</g>
</svg>'''
import os; os.makedirs('docs/maps/vector', exist_ok=True)
open('docs/maps/vector/bulge-map-editable.svg', 'w').write(ed); print('editable', len(ed) // 1024, 'KB')
