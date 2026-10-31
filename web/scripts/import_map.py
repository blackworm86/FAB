"""Build the game map from the hand-drawn Illustrator file (docs/maps/vector/BulgeMap_layers.svg).
Layers read: Areas (fill = TDN), Zones (fill = army zone), Roads, Rivers, Boundaries, Towns.
Writes data/bulge/map.json polygons (areas keep id, name, VP, label) and web/public/map-vector.svg (the board texture).
Victory points, entry areas and names are not in the drawing; they come from data/bulge/areas.json and entry_areas.json."""
import json, math, re, sys
import xml.etree.ElementTree as ET
import numpy as np
from svgelements import Path
from shapely.geometry import Polygon as SP, Point
from shapely.ops import unary_union
from shapely.validation import make_valid
def fix(g):
    g = make_valid(g)
    if g.geom_type == 'GeometryCollection': g = unary_union([x for x in g.geoms if x.geom_type in ('Polygon', 'MultiPolygon')])
    return g
SRC = 'docs/maps/vector/BulgeMap_layers.svg'; NS = '{http://www.w3.org/2000/svg}'
W, H = 1740, 1584
root = ET.parse(SRC).getroot(); layers = {g.get('id'): g for g in root.findall(NS + 'g')}
css = {k: v for k, v in re.findall(r'\.(st\d+)\s*\{([^}]*)\}', open(SRC).read().replace('\n', ' '))}
fill = lambda c: (re.search(r'fill:\s*(#\w+)', css.get(c, '')) or [None, None])[1]
TDN_OF = {'#f5dd9d': 0, '#b89554': 1, '#797667': 2, '#52531c': 3}; ZONE_OF = {'#878787': 5, '#951b81': 6, '#009fe3': 7}
tag = lambda e: e.tag.split('}')[1]
def pts_of(e, n=12):
    if tag(e) == 'rect':
        x, y, w, h = (float(e.get(k)) for k in ('x', 'y', 'width', 'height')); return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    if tag(e) == 'polygon':
        v = list(map(float, re.findall(r'-?[\d.]+', e.get('points')))); return list(zip(v[::2], v[1::2]))
    out = []
    for seg in Path(e.get('d')):
        for t in np.linspace(0, 1, n if seg.__class__.__name__ != 'Line' else 2, endpoint=False): q = seg.point(t); out.append((q.x, q.y))
    return out
def shapes(layer):
    out = []
    for e in layers[layer]:
        if tag(e) not in ('path', 'polygon', 'rect'): continue
        try: pg = fix(SP(pts_of(e)))
        except Exception: continue
        if pg.area > 150: out.append((pg, e.get('class')))
    return out
A, Z = shapes('Areas'), shapes('Zones')
areas = {a['id']: a for a in json.load(open('data/bulge/areas.json'))}; old = json.load(open('data/bulge/map.json'))
entries = json.load(open('data/bulge/entry_areas.json'))
new_areas, report = [], []
for oa in old['areas']:
    p0 = SP(oa['polygon']).buffer(0); rp = p0.representative_point()
    hit = [i for i, (pg, c) in enumerate(A) if pg.contains(rp)]
    if len(hit) == 0: hit = [max(range(len(A)), key=lambda i: A[i][0].intersection(p0).area / max(1, A[i][0].union(p0).area))]
    if len(hit) != 1: report.append(f'area {oa["id"]}: label matches {len(hit)} drawn shapes'); continue
    pg, c = A[hit[0]]; tdn = TDN_OF.get(fill(c)); zc = [cl for q, cl in Z if q.contains(pg.representative_point())]; zone = ZONE_OF.get(fill(zc[0])) if zc else None
    if tdn != areas[oa['id']]['tdn']: report.append(f'area {oa["id"]} {oa["name"]}: TDN data {areas[oa["id"]]["tdn"]} drawing {tdn}')
    if zone != areas[oa['id']]['zone']: report.append(f'area {oa["id"]} {oa["name"]}: zone data {areas[oa["id"]]["zone"]} drawing {zone}')
    ring = pg.simplify(0.35, preserve_topology=True); ring = max(ring.geoms, key=lambda g: g.area) if ring.geom_type == 'MultiPolygon' else ring
    poly = [[round(x, 1), round(y, 1)] for x, y in list(ring.exterior.coords)[:-1]]
    lab = oa['label'] if pg.contains(Point(*oa['label'])) else [round(rp.x), round(rp.y)]
    new_areas.append({**oa, 'label': lab, 'polygon': poly, 'drawn': True}); oa['_pg'] = pg
shapes_by_id = {a['id']: next(pg for pg, c in A if pg.contains(SP(a['polygon']).buffer(0).representative_point())) if False else None for a in new_areas}
# adjacency of the drawn areas against the connection list
pgs = {}
for oa in old['areas']:
    if '_pg' in oa: pgs[oa['id']] = oa['_pg']
conns = {(min(c['a'], c['b']), max(c['a'], c['b'])) for c in old['connections']}
touch = set()
ids = sorted(pgs)
for i, a in enumerate(ids):
    for b in ids[i + 1:]:
        if pgs[a].buffer(1.2).intersection(pgs[b].buffer(1.2)).length > 30: touch.add((a, b))
for k in sorted(conns - touch): report.append(f'connection {k} is in the data but the drawn areas do not touch')
for k in sorted(touch - conns): report.append(f'drawn areas {k} touch but have no connection in the data')
old.pop('size', None)
out = {'size': [W, H], 'areas': [{k: v for k, v in a.items() if k != 'drawn'} for a in new_areas], 'connections': old['connections']}
json.dump(out, open('data/bulge/map.json', 'w'), separators=(',', ':'))
print('areas', len(new_areas), 'of', len(old['areas']))
# ---------------- board texture ----------------
def d_of(layer, cls=None): return [(e.get('class'), e.get('d')) for e in layers[layer] if tag(e) == 'path' and (cls is None or e.get('class') == cls) and e.get('d')]
ground = '#bcc7a9'; land = unary_union([pg for pg, _ in A if pg.area > 5000]).buffer(0)
land_d = ''.join('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in g.exterior.coords) + 'Z' for g in (land.geoms if land.geom_type == 'MultiPolygon' else [land]))
river_w = {'st2': 9, 'st5': 6, 'st3': 4.2}
rivers = ''.join(f'<path d="{d}" stroke-width="{river_w.get(c, 5)}"/>' for c, d in d_of('Rivers'))
roads = [d for _, d in d_of('Roads')]
roads_c = ''.join(f'<path d="{d}"/>' for d in roads)
bnd = ''
for e in layers['Boundaries']:
    t = tag(e); a = {k: v for k, v in e.attrib.items() if k != 'class'}
    bnd += '<' + t + ''.join(f' {k}="{v}"' for k, v in a.items()) + '/>'
outline = ''.join(f'<path d="{e.get("d")}"/>' for e in layers['OUTLINE'] if tag(e) == 'path')
towns, cities = '', ''
for e in layers['Towns']:
    t = tag(e)
    if t == 'circle': towns += f'<circle cx="{e.get("cx")}" cy="{e.get("cy")}" r="7.5" fill="#fff" stroke="#3b403d" stroke-width="2.6"/>'
    else: cities += '<' + t + ''.join(f' {k}="{v}"' for k, v in e.attrib.items() if k != 'class') + '/>'
def cross(x, y, r): return f'<path d="M{x - r * .3:.1f} {y - r:.1f}h{r * .6:.1f}v{r * .55:.1f}h{r * .7:.1f}v{r * .6:.1f}h{-r * .7:.1f}v{r * 1.25:.1f}h{-r * .6:.1f}v{-r * 1.25:.1f}h{-r * .7:.1f}v{-r * .6:.1f}h{r * .7:.1f}Z" fill="#111"/>'
def star(x, y, r, f, s): return '<path d="M' + 'L'.join(f'{x + (r if i % 2 == 0 else r * .45) * math.sin(i * math.pi / 5):.1f} {y - (r if i % 2 == 0 else r * .45) * math.cos(i * math.pi / 5):.1f}' for i in range(10)) + f'Z" fill="{f}" stroke="{s}" stroke-width="1.2"/>'
marks = labels = ''
for a in out['areas']:
    x, y = a['label']; t = areas[a['id']]['tdn']; vp = areas[a['id']]['vp']
    if t == 0: mk = f'<circle cx="{x}" cy="{y - 3}" r="13" fill="#f4e3a4" stroke="#8a7a3a" stroke-width="1.6"/>'; ink = '#1a1608'
    elif t == 1: mk = f'<rect x="{x - 14}" y="{y - 15}" width="28" height="24" rx="3" fill="#c9a24f" stroke="#6b5420" stroke-width="1.6"/>'; ink = '#1a1608'
    elif t == 2: mk = f'<path d="M{x - 15} {y - 3}L{x - 7} {y - 15}H{x + 7}L{x + 15} {y - 3}L{x + 7} {y + 9}H{x - 7}Z" fill="#8a8f86" stroke="#2d3330" stroke-width="1.6"/>'; ink = '#111'
    else: mk = f'<path d="M{x - 15} {y - 14}H{x + 15}L{x} {y + 12}Z" fill="#4a5028" stroke="#1d2110" stroke-width="1.6"/>'; ink = '#fff'
    marks += mk + f'<text x="{x}" y="{y + (0 if t != 3 else -3)}" text-anchor="middle" font-size="16" font-weight="700" fill="{ink}" font-family="Arial Narrow, Arial, sans-serif">{a["id"]}</text>'
    labels += f'<text x="{x}" y="{y + 26}" text-anchor="middle">{areas[a["id"]]["name"]}</text>'
    for i in range(vp['allied']): marks += cross(x + (i - (vp['allied'] - 1) / 2) * 24, y - 40, 10)
    for i in range(vp['german']): marks += f'<circle cx="{x}" cy="{y - 40 - i * 20}" r="9" fill="#2f78c8" stroke="#fff" stroke-width="1.5"/>' + star(x, y - 40 - i * 20, 6.5, '#fff', 'none')
    if vp['mutual']: marks += star(x, y - 40, 11, '#f2d21b', '#c3281c')
strips = ''
E_SH = shapes('Entering_Zones'); used = set()
for letter, e in sorted(entries.items()):
    pg = pgs.get(e['area']); 
    if pg is None: continue
    cand = [(pg.distance(q), i) for i, (q, c) in enumerate(E_SH) if i not in used]
    d, i = min(cand); q, c = E_SH[i]
    if d > 12: report.append(f'entry {letter}: nearest drawn strip is {d:.0f}px away'); continue
    used.add(i); ge = e['side'] == 'german'
    strips += '<path d="M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in q.exterior.coords) + f'Z" fill="{"#9fb0b8" if ge else "#2f9a52"}" stroke="#fff" stroke-width="1.6"/>'
    c = q.representative_point(); strips += f'<text x="{c.x:.1f}" y="{c.y + 6:.1f}" text-anchor="middle" font-size="19" font-weight="700" fill="{"#111" if ge else "#fff"}" stroke="{"#fff" if ge else "#14502a"}" stroke-width="0.8" font-family="Arial, sans-serif">{letter}</text>'
report.extend(f'drawn entry strip {i} was not matched to an entry area' for i in range(len(E_SH)) if i not in used)
open('docs/maps/vector/import-report.txt', 'w').write('\n'.join(report) or 'no differences'); print('\n'.join(report[:40]) or 'no differences')
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<rect id="frame" width="{W}" height="{H}" fill="#bccad3"/>
<g id="terrain"><path fill="{ground}" fill-rule="evenodd" d="{land_d}"/></g>
<g id="woods" opacity="0"></g>
<g id="entering-zones">{strips}</g>
<g id="boundaries" fill="none" stroke="#fbfbf6" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round">{bnd}</g>
<g id="rivers" fill="none" stroke="#2f8fd0" stroke-linecap="round" stroke-linejoin="round">{rivers}</g>
<g id="roads" fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#3a3f3d" stroke-width="7.4">{roads_c}</g><g stroke="#5d6360" stroke-width="4.6">{roads_c}</g></g>
<g id="cities" fill="#6b706d" stroke="#3a3f3d" stroke-width="1.6">{cities}</g>
<g id="towns">{towns}</g>
<g id="outline" fill="none" stroke="#fbfbf6" stroke-width="4.6" stroke-linejoin="round">{outline}</g>
<g id="markers">{marks}</g>
<g id="labels" font-family="Arial Narrow, Arial, sans-serif" font-size="16" font-style="italic" fill="#2c3a22" stroke="{ground}" stroke-width="3.2" paint-order="stroke">{labels}</g>
</svg>'''
open('web/public/map-vector.svg', 'w').write(svg); print('svg', len(svg) // 1024, 'KB')
