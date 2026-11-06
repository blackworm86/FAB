"""Sicily game map from the hand-drawn layered SVG (docs/games/sicily/maps/SicilyMap.svg), as tools/golan73/svgmap.py did for Golan.

Usage: python3 -I tools/sicily/svgmap.py docs/games/sicily/maps/SicilyMap.svg data/sicily/map_vassal.json data/sicily/map.json data/sicily/map_art.json

The SVG has no area numbers, so each drawn area is paired with a Vassal zone (map_vassal.json: ids, names) by fitting an affine
transform from Vassal pixels to SVG units and matching by overlap. Everything else comes from the layers: TDN from the area fill
(yellow 0, brown 1, grey 2, black 3), VP symbols (Axis white stars, Allied German crosses, mutual pentagons), ports and their
damage boxes, airfields, landing and port boxes (paired with the Vassal boxes, which carry the box codes, names and the areas
their printed arrows point at), adjacency from shared edges, and per edge the boundary types drawn along it (river, restricted
terrain, army boundary) and whether a road crosses it. The army zones A-D come from the drawn army boundaries (flood fill), named
after the Vassal zones. The Exclusive Rules settle what the drawing leaves open: every Mount Etna boundary and the two Nebrodi
ridges are restricted terrain (14.1), Messina is in both zones B and C (14.41). map_art.json keeps the line work for the board.
"""
import json, re, sys, xml.etree.ElementTree as ET
from collections import Counter
import numpy as np
from shapely import affinity
from shapely.geometry import LineString, MultiLineString, Point, Polygon, box as sbox
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
        if subs: out.append({'tag': e.tag.replace(NS, ''), 'cls': e.attrib.get('class'), 'subs': subs, 'attrib': dict(e.attrib)})
    return out

def lines(lid):
    return MultiLineString([s for e in layer(lid) for s in e['subs']])

def centre(e): return tuple(np.mean([p for s in e['subs'] for p in s], 0))
def rect_of(e):
    a = e['attrib']; x, y, w, h = [float(a[k]) for k in ('x', 'y', 'width', 'height')]
    return [round(x, 1), round(y, 1), round(x + w, 1), round(y + h, 1)]

# ---- areas: drawn shapes, paired with the Vassal zones ----
TDN_FILL = {'#fcea10': 0, '#936037': 1, '#706f6f': 2, '#1d1d1b': 3}
shapes = []
for e in layer('AREAS'):
    g = unary_union([Polygon(s).buffer(0) for s in e['subs'] if len(s) > 3])
    if g.area > 50: shapes.append({'fill': FILL.get(e['cls']), 'g': g})
V = json.load(open(VASSAL))
Z = {a['id']: Polygon(a['polygon']).buffer(0) for a in V['areas']}
zb, sb = unary_union(list(Z.values())).bounds, unary_union([s['g'] for s in shapes if s['g'].area > 5000]).bounds
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
islets = [s['g'] for i, s in enumerate(shapes) if i not in {k for k, _ in pair.values()}]   # small islands drawn but not areas
tpt = lambda x, y: (float(A[0, 0] * x + A[0, 1] * y + A[0, 2]), float(A[1, 0] * x + A[1, 1] * y + A[1, 2]))
LAND = unary_union(list(G.values()))

def area_at(x, y):
    p = Point(x, y)
    a = next((zid for zid, g in G.items() if g.contains(p)), None)
    return a if a is not None else min(G, key=lambda zid: G[zid].distance(p))

# ---- symbols: VPs, ports, airfields, cities ----
vp_ger, vp_all, vp_mut = Counter(), Counter(), set()
for e in layer('AXIS_VPS'):
    if e['tag'] == 'circle': vp_ger[area_at(*centre(e))] += 1                      # white star in a blue disc: a German VP space (19.1)
for e in layer('ALLIED_VPS'):
    if FILL.get(e['cls']) == '#010101': vp_all[area_at(*centre(e))] += 1           # the black ground of a German cross: an Allied VP space
for e in layer('MUTUAL_VPS'):
    if FILL.get(e['cls']) == '#c42a1d': vp_mut.add(area_at(*centre(e)))            # the red pentagon: a mutual VP space
airfields = {area_at(*centre(e)) for e in layer('AIRFIELDS')}
port_sym = {area_at(*centre(e)): centre(e) for e in layer('PORTS')}
cities = [{'area': area_at(*centre(e)), 'd': None, 'pts': e['subs'][0]} for e in layer('CITIES')]

# ---- the landing and port boxes, paired with the Vassal boxes (which know their codes, names and the areas the arrows point at) ----
vboxes = [{'kind': 'landing', **b} for b in V['beaches']] + [{'kind': 'port', **p} for p in V['ports']]
for b in vboxes: b['c'] = tpt((b['rect'][0] + b['rect'][2]) / 2, (b['rect'][1] + b['rect'][3]) / 2)
GROUP_FILL = {'#518f39': 'A', '#2589c5': 'B', '#137344': 'D', '#656567': 'P'}
boxes, taken = [], set()
for e in layer('PORTS_x5F_AREAS'):
    c = centre(e); k = min((i for i in range(len(vboxes)) if i not in taken), key=lambda i: (vboxes[i]['c'][0] - c[0]) ** 2 + (vboxes[i]['c'][1] - c[1]) ** 2)
    vb = vboxes[k]; taken.add(k); d = float(np.hypot(vb['c'][0] - c[0], vb['c'][1] - c[1]))
    assert d < 60, (vb['box'], d)
    boxes.append({'box': vb['box'], 'kind': vb['kind'], 'name': vb['name'], 'area': vb['area'], 'rect': rect_of(e), 'fill': FILL.get(e['cls']), 'group': vb.get('group') or 'P', **({'control': vb['control']} if 'control' in vb else {})})
assert len(taken) == len(vboxes) == 27, len(taken)
dmg = [rect_of(e) for e in layer('PORST_DAMAGE')]
for b in boxes:
    if b['kind'] == 'port':
        near = [r for r in dmg if np.hypot((r[0] + r[2]) / 2 - (b['rect'][0] + b['rect'][2]) / 2, (r[1] + r[3]) / 2 - (b['rect'][1] + b['rect'][3]) / 2) < 160]
        b['damage_box'] = near[0] if near else None
        assert (b['damage_box'] is None) == (b['box'] == 'P4'), b['box']                      # Messina cannot be damaged (14.51)
beaches = {}
for b in boxes:
    if b['kind'] == 'landing': beaches.setdefault(b['area'], []).append(b['box'])
ports = {b['area']: b['box'] for b in boxes if b['kind'] == 'port'}
assert set(ports) == set(port_sym), (ports, port_sym)                                          # the anchor symbols sit in the port areas

# ---- adjacency and boundary types along each shared edge ----
FEAT = {'river': lines('RIVERS'), 'restricted': lines('RESTRICTED_TERRAIN_BOUNDARY'), 'army_boundary': lines('ARMY_BOUNDARY'), 'open': lines('OPEN_x5F_BOUNDARY')}
FB = {k: v.buffer(7) for k, v in FEAT.items()}
ROADS = [LineString(s) for e in layer('ROADS') for s in e['subs']]
ETNA = next(a['id'] for a in V['areas'] if a['name'] == 'Mount Etna')
NAME = {a['id']: a['name'] for a in V['areas']}
RIDGES = {frozenset(x) for x in [(31, 32), (33, 34)]}                                            # 14.1 (i) and (ii): Capo di Orlando / Randazzo, Adrano / Sant'Agata
ids = sorted(G)
conns, drawn_differs = [], []
for i, a in enumerate(ids):
    for b in ids[i + 1:]:
        if not G[a].buffer(4).intersects(G[b].buffer(4)): continue
        seam = G[a].boundary.intersection(G[b].buffer(4))
        if seam.length < 12: continue                                   # corners only
        cov = {k: seam.intersection(FB[k]).length / seam.length for k in FB}
        cross = seam.buffer(5)
        road = any(r.intersects(cross) and r.intersection(G[a].buffer(-3)).length > 4 and r.intersection(G[b].buffer(-3)).length > 4 for r in ROADS if r.intersects(cross))
        c = {'a': a, 'b': b, 'type': 'road' if road else 'field', 'mp': 1 if road else 2, 'river': cov['river'] > .5}
        drawn_r = cov['restricted'] > .5; rule_r = ETNA in (a, b) or frozenset((a, b)) in RIDGES
        c['restricted'] = rule_r
        if drawn_r != rule_r: drawn_differs.append((a, b, 'drawn' if drawn_r else 'not drawn', 'rule 14.1: restricted' if rule_r else 'rule 14.1: not restricted'))
        c['army_boundary'] = cov['army_boundary'] > .5
        if max(cov.values()) < .5: c['check'] = 'no boundary line drawn along this edge'
        c['length'] = round(seam.length)
        mid = seam.interpolate(.5, normalized=True) if seam.geom_type == 'LineString' else max(seam.geoms, key=lambda s: s.length).interpolate(.5, normalized=True)
        c['mid'] = [round(mid.x), round(mid.y)]
        conns.append(c)

# ---- army zones: flood fill across edges with no army boundary, named after the Vassal zones ----
zone_of = {}
MESSINA = next(a['id'] for a in V['areas'] if a['name'] == 'Messina')                 # 14.41: in both zones B and C, so no boundary is drawn round it; the fill must not pass through it
nb = {a: [] for a in ids}
for c in conns:
    if not c['army_boundary'] and MESSINA not in (c['a'], c['b']): nb[c['a']].append(c['b']); nb[c['b']].append(c['a'])
comp = {}
for a in ids:
    if a in comp: continue
    stack, k = [a], len(set(comp.values()))
    while stack:
        x = stack.pop()
        if x in comp: continue
        comp[x] = k; stack.extend(nb[x])
VZ = {int(a): z for z, lst in V['zones'].items() for a in lst}
names = {}
for k in set(comp.values()):
    members = [a for a in ids if comp[a] == k]
    votes = Counter(VZ[a] for a in members if a in VZ)
    names[k] = votes.most_common(1)[0][0] if votes else '?'
assert len({v for v in names.values() if v != '?'}) == 4, names
for a in ids: zone_of[a] = ['B', 'C'] if a == MESSINA else [names[comp[a]]]           # 14.41: Messina is in both zones B and C
for c in conns:
    if c['army_boundary']: c['zones'] = sorted({zone_of[c['a']][0], zone_of[c['b']][0]}) if zone_of[c['a']][0] != zone_of[c['b']][0] else None
zone_diff = [(a, VZ.get(a), zone_of[a]) for a in ids if a != MESSINA and VZ.get(a) != zone_of[a][0]]

# ---- coastal areas: part of the boundary faces the sea ----
others = {a: unary_union([G[b] for b in ids if b != a]).buffer(6) for a in ids}
coastal = {a for a in ids if G[a].boundary.difference(others[a]).length > 25}

old = {(c['a'], c['b']) for c in V['connections']}
new = {(c['a'], c['b']) for c in conns}
areas = []
for v in V['areas']:
    g = G[v['id']]; poly = g if g.geom_type == 'Polygon' else max(g.geoms, key=lambda p: p.area)
    lab = polylabel(poly.buffer(-2), tolerance=1)
    tdn = TDN_FILL[[s['fill'] for s in shapes if s['g'] is g][0]]
    areas.append({'id': v['id'], 'name': v['name'], 'tdn': tdn, 'vp': {'allied': vp_all.get(v['id'], 0), 'german': vp_ger.get(v['id'], 0), 'mutual': v['id'] in vp_mut},
                  'zone': zone_of[v['id']], 'coastal': v['id'] in coastal, 'port': ports.get(v['id']), 'airfield': v['id'] in airfields, 'beaches': sorted(beaches.get(v['id'], [])),
                  'axis_exit': v['id'] == MESSINA, 'label': [round(lab.x), round(lab.y)],
                  'polygon': [[round(x, 1), round(y, 1)] for x, y in poly.simplify(0.8).exterior.coords[:-1]]})
mainland = [Polygon(s) for e in layer('EXITING_x5F_AXIS_x5F_UNITS_x5F_ZONE') for s in e['subs'] if len(s) > 3]
ML = max(mainland, key=lambda p: p.area)
json.dump({'size': [int(W), int(H)], 'source': 'docs/games/sicily/maps/SicilyMap.svg (hand-drawn, layered); area ids and names from the Vassal zones; restricted terrain per rule 14.1, Messina in zones B and C per 14.41',
           'areas': areas, 'connections': conns,
           'boxes': [{k: b[k] for k in b if k != 'fill'} for b in boxes],
           'mainland': {'id': 100, 'name': 'Italian mainland', 'label': [round(ML.centroid.x), round(ML.centroid.y)], 'polygon': [[round(x, 1), round(y, 1)] for x, y in ML.simplify(0.8).exterior.coords[:-1]], 'exit_from': MESSINA},
           'zones': {z: sorted(a for a in ids if z in zone_of[a]) for z in 'ABCD'},
           'diff_vs_vassal': {'added': sorted(new - old), 'removed': sorted(old - new), 'zones': zone_diff, 'restricted_drawing': drawn_differs}}, open(OUT, 'w'), indent=1)

def dpath(geom):
    gs = getattr(geom, 'geoms', [geom])
    return ' '.join('M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in g.simplify(.6).coords) for g in gs if g.length > 0)
ring = lambda P, tol=.6: 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in Polygon(P).simplify(tol).exterior.coords) + 'Z'
coast = LAND.buffer(1.5).buffer(-1.5)
art = {'size': [int(W), int(H)],
       'border': [dpath(LineString(s)) for e in layer('BORDER') for s in e['subs'] if LineString(s).length > 1000],
       'frame_small': [dpath(LineString(s)) for e in layer('BORDER') for s in e['subs'] if LineString(s).length <= 1000],
       'coast': [ring(p.exterior.coords, .8) for p in getattr(coast, 'geoms', [coast])],
       'islets': [ring(p.exterior.coords, .4) for p in islets],
       'mainland': [ring(p.exterior.coords, .8) for p in mainland],
       'roads': [dpath(r) for r in ROADS],
       **{k: [dpath(g) for g in getattr(FEAT[k], 'geoms', [FEAT[k]])] for k in ('river', 'restricted', 'army_boundary', 'open')},
       'cities': [{'area': c['area'], 'd': ring(c['pts'], .3)} for c in cities],
       'port_symbols': [{'area': a, 'x': round(x, 1), 'y': round(y, 1)} for a, (x, y) in port_sym.items()],
       'airfields': [{'area': area_at(*centre(e)), 'x': round(centre(e)[0], 1), 'y': round(centre(e)[1], 1), 'r': float(e['attrib']['r'])} for e in layer('AIRFIELDS')],
       'vp_marks': [{'kind': 'german', 'area': area_at(*centre(e)), 'x': round(centre(e)[0], 1), 'y': round(centre(e)[1], 1)} for e in layer('AXIS_VPS') if e['tag'] == 'circle']
                 + [{'kind': 'allied', 'area': area_at(*centre(e)), 'x': round(centre(e)[0], 1), 'y': round(centre(e)[1], 1)} for e in layer('ALLIED_VPS') if FILL.get(e['cls']) == '#010101']
                 + [{'kind': 'mutual', 'area': area_at(*centre(e)), 'x': round(centre(e)[0], 1), 'y': round(centre(e)[1], 1)} for e in layer('MUTUAL_VPS') if FILL.get(e['cls']) == '#c42a1d'],
       'boxes': [{k: b[k] for k in ('box', 'kind', 'group', 'area', 'rect', 'fill', 'name')} | ({'damage_box': b['damage_box']} if 'damage_box' in b else {}) for b in boxes]}
json.dump(art, open(ART, 'w'), separators=(',', ':'))
print(len(areas), 'areas', len(conns), 'connections; mean overlap with Vassal %.3f' % np.mean([p[1] for p in pair.values()]), '; islets', len(islets))
print('vs Vassal adjacency: added', sorted(new - old), 'removed', sorted(old - new))
print('zones', {z: len(v) for z, v in {z: [a for a in ids if z in zone_of[a]] for z in 'ABCD'}.items()}, 'differ from the Vassal draft:', zone_diff)
print('restricted: drawing differs from 14.1 at', drawn_differs)
print('german VP', dict(vp_ger), 'allied VP', dict(vp_all), 'mutual', sorted(vp_mut), 'airfields', sorted(airfields), 'ports', ports)
print('coastal', len(coastal), sorted(coastal)); print('beaches', beaches)
print('edges with no drawn line:', [(c['a'], c['b'], c['length']) for c in conns if c.get('check')])
print(Counter(k for c in conns for k in ('river', 'restricted', 'army_boundary') if c.get(k)), Counter(c['type'] for c in conns))
