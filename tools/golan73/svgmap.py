"""Golan '73 game map from the hand-drawn layered SVG (docs/games/golan73/maps/GolanMap.svg).

Usage: python3 -I tools/golan73/svgmap.py docs/games/golan73/maps/GolanMap.svg data/golan73/map_vassal.json data/golan73/map.json data/golan73/map_art.json

The SVG has no area numbers, so each drawn area is paired with a Vassal zone (map_vassal.json: ids, names, entries)
by fitting an affine transform from Vassal pixels to SVG units and matching by overlap. Everything else comes
from the SVG layers: TDN from the area fill, VPs, supply sources, alternate set-up squares, adjacency from shared
edges, and per-edge boundary types (open, river, AT ditch / Purple Line, wadi, escarpment, rugged, SAM barrier,
operational boundary) and road crossings. map_art.json keeps the drawn lines (rivers, lakes, roads, boundaries) for the board art.
"""
import json, re, sys, xml.etree.ElementTree as ET
import numpy as np
from shapely import affinity
from shapely.geometry import LineString, MultiLineString, Point, Polygon
from shapely.ops import polylabel, unary_union
from svgelements import Path

SVG_IN, VASSAL, OUT, ART = sys.argv[1:5]
NS = '{http://www.w3.org/2000/svg}'
root = ET.parse(SVG_IN).getroot()
W, H = [float(v) for v in root.attrib['viewBox'].split()[2:]]
CSS = root.find(NS + 'defs').find(NS + 'style').text
FILL, STROKE = {}, {}
for sel, body in re.findall(r'([^{}]+)\{([^}]*)\}', CSS):
    for c in re.findall(r'\.(st\d+)', sel):
        for prop, tgt in (('fill', FILL), ('stroke', STROKE)):
            m = re.search(prop + r':\s*([^;]+);', body)
            if m: tgt[c] = m.group(1).strip()

def d_of(e):
    t, a = e.tag.replace(NS, ''), e.attrib
    f = lambda k: float(a.get(k, 0))
    if t == 'path': return a['d']
    if t in ('polygon', 'polyline'):
        p = a['points'].split(); xy = [p[i] + ',' + p[i + 1] for i in range(0, len(p), 2)]
        return 'M' + ' L'.join(xy) + (' Z' if t == 'polygon' else '')
    if t == 'line': return f'M{f("x1")},{f("y1")} L{f("x2")},{f("y2")}'
    if t == 'rect': return f'M{f("x")},{f("y")} h{f("width")} v{f("height")} h{-f("width")} Z'
    if t == 'circle':
        cx, cy, r = f('cx'), f('cy'), f('r'); return f'M{cx - r},{cy} a{r},{r} 0 1,0 {2 * r},0 a{r},{r} 0 1,0 {-2 * r},0 Z'

def layer(lid):
    g = next(x for x in root if x.attrib.get('id') == lid)
    out = []
    for e in g.iter():
        d = d_of(e) if e is not g else None
        if not d: continue
        subs = []
        for sp in Path(d).as_subpaths():
            sp = Path(sp); L = sp.length(error=1e-3)
            if L < 1: continue
            n = max(2, int(L / 2))
            subs.append([(round(q.x, 1), round(q.y, 1)) for q in (sp.point(i / n) for i in range(n + 1))])
        if subs: out.append({'tag': e.tag.replace(NS, ''), 'cls': e.attrib.get('class'), 'subs': subs})
    return out

def lines(lid):
    return MultiLineString([s for e in layer(lid) for s in e['subs']])

def centre(e): return tuple(np.mean([p for s in e['subs'] for p in s], 0))

# ---- areas: drawn shapes, paired with the Vassal zones ----
TDN_FILL = {'#fcea10': 0, '#936037': 1, '#706f6f': 2, '#1d1d1b': 3}
shapes = []
for e in layer('AREAS'):
    g = unary_union([Polygon(s).buffer(0) for s in e['subs'] if len(s) > 3])
    if g.area > 50: shapes.append({'fill': FILL.get(e['cls']), 'g': g})
V = json.load(open(VASSAL))
Z = {a['id']: Polygon(a['polygon']).buffer(0) for a in V['areas']}
zb, sb = unary_union(list(Z.values())).bounds, unary_union([s['g'] for s in shapes if s['fill'] in TDN_FILL]).bounds
sx, sy = (sb[2] - sb[0]) / (zb[2] - zb[0]), (sb[3] - sb[1]) / (zb[3] - zb[1])
A = np.array([[sx, 0, sb[0] - zb[0] * sx], [0, sy, sb[1] - zb[1] * sy]])
tf = lambda g: affinity.affine_transform(g, [A[0, 0], A[0, 1], A[1, 0], A[1, 1], A[0, 2], A[1, 2]])
iou = lambda p, q: p.intersection(q).area / max(1, p.union(q).area)
for _ in range(4):
    src, dst, pair = [], [], {}
    for zid, z in Z.items():
        tz = tf(z); k = max(range(len(shapes)), key=lambda i: iou(shapes[i]['g'], tz)); pair[zid] = (k, iou(shapes[k]['g'], tz))
        if pair[zid][1] > .5: src.append(z.centroid.coords[0]); dst.append(shapes[k]['g'].centroid.coords[0])
    A = np.linalg.lstsq(np.c_[np.array(src), np.ones(len(src))], np.array(dst), rcond=None)[0].T
assert len({k for k, _ in pair.values()}) == len(Z), 'two Vassal zones matched the same drawn area'
G = {zid: shapes[k]['g'] for zid, (k, _) in pair.items()}
offmap = [s['g'] for i, s in enumerate(shapes) if i not in {k for k, _ in pair.values()}]   # the orange Hermon massif: not an area

def area_at(x, y):
    p = Point(x, y)
    return next((zid for zid, g in G.items() if g.contains(p)), None)

vp_syr, vp_mut = {}, set()
for e in layer('SYRIA_VPS'):
    if e['tag'] == 'circle': a = area_at(*centre(e)); vp_syr[a] = vp_syr.get(a, 0) + 1
for e in layer('MUTUAL_VPS'):
    if FILL.get(e['cls']) == '#c42a1d': vp_mut.add(area_at(*centre(e)))
supply = {area_at(*centre(e)) for e in layer('ISRAELI_SUPPLY_SOURCES') if FILL.get(e['cls']) == '#1172b5'}
ALT = {'#e30613': '7th_inf', '#009fe3': '9th_inf', '#ffed00': '5th_inf'}   # division colours (Syrian alternate set-up)
alt = {area_at(*centre(e)): ALT[FILL[e['cls']]] for e in layer('SYRIAN_ALTERNATE_SETUP_AREAS')}

# ---- adjacency and boundary types along each shared edge ----
FEAT = {'river': lines('RIVERS'), 'atDitch': lines('ANTUTANKRIDGE_x5F_BOUNDARY'), 'wadi': lines('WADI_x5F_BOUNDARY'), 'escarpment': lines('ESCARPMENT'),
        'rugged': lines('RUGGED_x5F_BOUNDARY'), 'samBarrier': lines('SYRIAN_SAM_BARRIER'), 'sector': lines('SECTOR_BOUNDARIES'), 'open': lines('OPEN_x5F_BOUNDARY')}
FB = {k: v.buffer(7) for k, v in FEAT.items()}
ROADS = [LineString(s) for e in layer('ROADS') for s in e['subs']]
ids = sorted(G)
conns = []
for i, a in enumerate(ids):
    for b in ids[i + 1:]:
        if not G[a].buffer(4).intersects(G[b].buffer(4)): continue
        seam = G[a].boundary.intersection(G[b].buffer(4))
        if seam.length < 12: continue                                   # corners only
        cov = {k: seam.intersection(FB[k]).length / seam.length for k in FB}
        # a road connection: a road that runs from one area into the other across this edge
        cross = seam.buffer(5)
        road = any(r.intersects(cross) and r.intersection(G[a].buffer(-3)).length > 4 and r.intersection(G[b].buffer(-3)).length > 4 for r in ROADS if r.intersects(cross))
        c = {'a': a, 'b': b, 'type': 'road' if road else 'field', 'mp': 1 if road else 2}
        for k in ('river', 'atDitch', 'wadi', 'escarpment', 'rugged', 'samBarrier', 'sector'):
            c[k] = cov[k] > .5
        c['purpleLine'] = c['atDitch']
        drawn = max(cov.values())
        if drawn < .5: c['check'] = 'no boundary line drawn along this edge'
        c['length'] = round(seam.length)
        conns.append(c)

# special connections (arrows on the map): Mt Hermon only touches 59 (14.16); assembly areas (14.22)
conns.append({'a': 59, 'b': 83, 'type': 'special', 'mp': 'all', 'hermon': True, 'note': '14.16: infantry class only, entire MA each way'})
SPECIAL = {'assembly': {'A': {'name': 'Northern Assembly Area', 'enters': [], 'box': None}, 'B': {'name': 'Southern Assembly Area', 'enters': [], 'box': None}}}
rects = sorted([e for e in layer('ASSEMBLY_AREAS')], key=lambda e: centre(e)[0])
for k, e in zip('AB', rects):
    xs, ys = zip(*[p for s in e['subs'] for p in s]); SPECIAL['assembly'][k]['box'] = [round(min(xs)), round(min(ys)), round(max(xs) - min(xs)), round(max(ys) - min(ys))]
for e in layer('_x31__MP_ARROWS'):
    if e['tag'] == 'polygon':                                           # arrow head inside the area it enters
        a = area_at(*centre(e)); k = min('AB', key=lambda k: abs(SPECIAL['assembly'][k]['box'][0] + 100 - centre(e)[0]))
        SPECIAL['assembly'][k]['enters'].append(a)
for k in 'AB': SPECIAL['assembly'][k]['enters'].sort()

old = {(c['a'], c['b']) for c in V['connections']}
new = {(c['a'], c['b']) for c in conns if c['type'] != 'special'}
areas = []
for v in V['areas']:
    g = G[v['id']]; poly = g if g.geom_type == 'Polygon' else max(g.geoms, key=lambda p: p.area)
    lab = polylabel(poly.buffer(-2), tolerance=1)
    tdn = TDN_FILL[[s['fill'] for s in shapes if s['g'] is g][0]]
    areas.append({'id': v['id'], 'name': v['name'], 'tdn': tdn, 'vp': {'mutual': v['id'] in vp_mut, 'syrian': vp_syr.get(v['id'], 0)}, 'supply': v['id'] in supply,
                  'altSetup': alt.get(v['id']), 'label': [round(lab.x), round(lab.y)],
                  'polygon': [[round(x, 1), round(y, 1)] for x, y in poly.simplify(0.8).exterior.coords[:-1]]})
BORDER = lines('BORDER').buffer(8)
def edge_point(aid):
    seg = G[aid].boundary.intersection(BORDER)
    p = seg.interpolate(.5, normalized=True) if seg.length > 0 else G[aid].centroid
    return [round(p.x, 1), round(p.y, 1)]
entries = [{'letter': e['letter'], 'area': e['area'], 'side': 'syrian', 'x': edge_point(e['area'])[0], 'y': edge_point(e['area'])[1]} for e in V['entries']]
json.dump({'size': [W, H], 'source': 'docs/games/golan73/maps/GolanMap.svg (hand-drawn, layered); area ids and names from the Vassal zones',
           'areas': areas, 'connections': conns, 'entries': entries, **SPECIAL,
           'diff_vs_vassal': {'added': sorted(new - old), 'removed': sorted(old - new)}}, open(OUT, 'w'), indent=1)

def dpath(geom):
    gs = getattr(geom, 'geoms', [geom])
    return ' '.join('M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in g.simplify(.6).coords) for g in gs if g.length > 0)
art = {'size': [W, H], 'border': [dpath(LineString(s)) for e in layer('BORDER') for s in e['subs']],
       'lakes': ['M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in Polygon(s).simplify(.6).exterior.coords) + 'Z' for e in layer('LAKES') if FILL.get(e['cls']) for s in e['subs'] if len(s) > 3],
       'offmap': ['M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in g.simplify(.6).exterior.coords) + 'Z' for g in offmap],
       'hermon': [dpath(LineString(s)) for e in layer('MT_HEROMN') for s in e['subs']],
       'roads': [dpath(r) for r in ROADS],
       **{k: [dpath(g) for g in getattr(FEAT[k], 'geoms', [FEAT[k]])] for k in ('river', 'atDitch', 'wadi', 'escarpment', 'rugged', 'samBarrier', 'sector', 'open')},
       'arrows1': [dpath(LineString(s)) for e in layer('_x31__MP_ARROWS') if e['tag'] != 'polygon' for s in e['subs']],
       'arrowsAll': [dpath(LineString(s)) for e in layer('AL_MP_ARROWS') if e['tag'] != 'polygon' for s in e['subs']],
       'heads': ['M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in Polygon(s).simplify(.3).exterior.coords) + 'Z' for e in layer('_x31__MP_ARROWS') + layer('AL_MP_ARROWS') if e['tag'] == 'polygon' for s in e['subs'] if len(s) > 3]}
json.dump(art, open(ART, 'w'), separators=(',', ':'))
print(len(areas), 'areas', len(conns), 'connections; mean overlap with Vassal %.2f' % np.mean([p[1] for p in pair.values()]))
print('vs Vassal adjacency: added', sorted(new - old), 'removed', sorted(old - new))
print('mutual', sorted(vp_mut), 'syrian', vp_syr, 'supply', sorted(supply), 'assembly', {k: v['enters'] for k, v in SPECIAL['assembly'].items()})
print('edges with no drawn line:', [(c['a'], c['b'], c['length']) for c in conns if c.get('check')])
from collections import Counter
print(Counter(k for c in conns for k in ('river', 'atDitch', 'wadi', 'escarpment', 'rugged', 'samBarrier', 'sector') if c.get(k)), Counter(c['type'] for c in conns))
