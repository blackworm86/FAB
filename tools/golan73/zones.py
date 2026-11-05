# Golan '73 map draft from the Vassal module's zones: area polygons, names, label points, adjacency.
# Usage: python3 -I zones.py <unzipped vmod dir> <out json>
import re, sys, json
from shapely.geometry import Polygon
from shapely.ops import polylabel
src = open(sys.argv[1] + '/buildFile.xml', encoding='utf-8', errors='replace').read()
board = src[src.index('boardPicker.Board image="FAB Golan MAP FINAL-120.jpg"'):]
board = board[:board.index('</VASSAL.build.module.map.boardPicker.Board>')]
areas = []
for attrs in re.findall(r'<VASSAL\.build\.module\.map\.boardPicker\.board\.mapgrid\.Zone ([^>]*)>', board):
    name = re.search(r'name="([^"]*)"', attrs).group(1); m = re.match(r'(\d+) - (.+)$', name)
    if not m: continue
    pts = [tuple(map(float, p.split(','))) for p in re.search(r'path="([^"]*)"', attrs).group(1).split(';') if p]
    clean = [p for i, p in enumerate(pts) if i == 0 or p != pts[i - 1]]
    P = Polygon(clean).buffer(0)
    if P.geom_type != 'Polygon': P = max(P.geoms, key=lambda g: g.area)
    c = polylabel(P, 1.0)
    areas.append({'id': int(m.group(1)), 'name': m.group(2), 'polygon': [[round(x, 1), round(y, 1)] for x, y in P.exterior.coords][:-1], 'label': [round(c.x), round(c.y)], 'area_px': round(P.area)})
areas.sort(key=lambda a: a['id'])
polys = {a['id']: Polygon(a['polygon']) for a in areas}
conn = []
for a in areas:
    for b in areas:
        if a['id'] < b['id']:
            inter = polys[a['id']].buffer(4).intersection(polys[b['id']].buffer(4))
            if not inter.is_empty and inter.area > 120: conn.append({'a': a['id'], 'b': b['id'], 'shared': round(inter.area / 8)})
json.dump({'size': [4080, 2640], 'source': 'Vassal module zones (map image not redistributed)', 'areas': areas, 'connections': conn}, open(sys.argv[2], 'w'), indent=1)
print(len(areas), 'areas', len(conn), 'connections')
