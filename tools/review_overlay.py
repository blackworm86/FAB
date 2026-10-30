"""Draw the area graph on the map for human review: python3 review_overlay.py out.png [x0 y0 x1 y1]"""
import cv2, json, sys
D = '../data/bulge/'
im = cv2.imread('../docs/maps/FAB The Bulge Game Map.jpg')
areas = {a['id']: a for a in json.load(open(D + 'areas.json'))}
edges = json.load(open(D + 'edges.json'))
ZC = {5: (200, 120, 0), 6: (0, 0, 200), 7: (0, 140, 0)}
for e in edges:
    p, q = tuple(areas[e['a']]['centroid']), tuple(areas[e['b']]['centroid'])
    if e['restricted']: col, th = (0, 90, 160), 5
    elif e['connection'] == 'road': col, th = (20, 20, 20), 4
    else: col, th = (140, 140, 140), 2
    cv2.line(im, p, q, col, th)
    m = ((p[0] + q[0]) // 2, (p[1] + q[1]) // 2)
    if e['river']: cv2.circle(im, m, 6, (255, 120, 0), -1)
    if e['army']: cv2.circle(im, m, 9, (255, 0, 255), 2)
    if e.get('manual'): cv2.circle(im, m, 12, (0, 200, 255), 2)
for a in areas.values():
    c = tuple(a['centroid']); cv2.circle(im, c, 15, ZC[a['zone']], -1)
    cv2.putText(im, str(a['id']), (c[0] - 11, c[1] + 5), 0, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
x0, y0, x1, y1 = (map(int, sys.argv[2:6]) if len(sys.argv) > 5 else (0, 0, 1740, 1584))
cv2.imwrite(sys.argv[1], im[y0:y1, x0:x1])
