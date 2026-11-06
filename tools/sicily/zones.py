# FAB: Sicily map draft from the Vassal module's "Main Map" zones: the 65 area polygons, names and label points,
# plus every other zone (ports, beaches, boxes, tracks) as rectangles.
# Usage: python3 -I zones.py <unzipped vmod dir> <out zones.json>
import re, sys, json, html
from shapely.geometry import Polygon
from shapely.ops import polylabel
src = open(sys.argv[1] + '/buildFile', encoding='utf-8', errors='replace').read()
i = src.index('Board image="FAB Sicily Map (VASSAL).jpg"')
board = src[i:src.index('</VASSAL.build.module.map.boardPicker.Board>', i)]
areas, boxes = [], []
for attrs in re.findall(r'<VASSAL\.build\.module\.map\.boardPicker\.board\.mapgrid\.Zone ([^>]*)>', board):
    name = html.unescape(re.search(r'name="([^"]*)"', attrs).group(1))
    pts = [tuple(map(float, p.split(','))) for p in re.search(r'path="([^"]*)"', attrs).group(1).split(';') if p]
    pts = [p for i, p in enumerate(pts) if i == 0 or p != pts[i - 1]]
    m = re.match(r'\((\d+)\) (.+?)\s*$', name)
    if m:
        P = Polygon(pts).buffer(0)
        if P.geom_type != 'Polygon': P = max(P.geoms, key=lambda g: g.area)
        c = polylabel(P, 1.0)
        areas.append({'id': int(m.group(1)), 'name': m.group(2), 'vassal_name': name,
                      'polygon': [[round(x, 1), round(y, 1)] for x, y in P.exterior.coords][:-1],
                      'label': [round(c.x), round(c.y)], 'area_px': round(P.area)})
    else:
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        boxes.append({'vassal_name': name, 'rect': [min(xs), min(ys), max(xs), max(ys)]})
areas.sort(key=lambda a: a['id'])
json.dump({'size': [3332, 2156], 'source': 'Vassal module zones, board "Main Map" (map image not redistributed)',
           'areas': areas, 'boxes': boxes}, open(sys.argv[2], 'w'), indent=1)
print(len(areas), 'areas', len(boxes), 'other zones')
