"""Trace the scanned map into layered vector art (web/public/map-vector.svg).
Layers: terrain, borders (from the verified area polygons), rivers and roads (traced from the scan), labels.
The original scan (map.jpg) is kept untouched for later 3D scenery (woods, towns)."""
import json, cv2, numpy as np
W = 1740; SC = 3                                           # playing area width in scan px; trace at 3x for smooth edges
im = cv2.imread('web/public/map.jpg')[:, :W]; H = im.shape[0]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); h, s, v = cv2.split(hsv)
ground = '#%02x%02x%02x' % tuple(int(x) for x in np.median(im.reshape(-1, 3), axis=0)[::-1])
def up(mask, sig=2.2, thr=127): return cv2.GaussianBlur(cv2.resize(mask, None, fx=SC, fy=SC, interpolation=cv2.INTER_CUBIC), (0, 0), sig) > thr   # blur: smooth the dithered scan edges
def paths(mask, min_len=0, eps=0.9, min_area=0, sig=2.2, thr=127):
    m = (up(mask.astype(np.uint8) * 255, sig, thr)).astype(np.uint8)
    cs, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE); d = []
    keep = set()
    for i, c in enumerate(cs):                              # decide per outer contour whether the shape is long enough to be a line
        if hier[0][i][3] != -1: continue
        x, y, w, hh = cv2.boundingRect(c)
        if max(w, hh) / SC >= min_len and cv2.contourArea(c) / SC / SC >= min_area: keep.add(i)
    for i, c in enumerate(cs):
        root = i
        while hier[0][root][3] != -1: root = hier[0][root][3]
        if root not in keep or len(c) < 4: continue
        a = cv2.approxPolyDP(c, eps, True)[:, 0, :] / SC
        d.append('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in a) + 'Z')
    return ''.join(d)
river = cv2.morphologyEx(((h >= 95) & (h <= 115) & (s > 110) & (v > 120)).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
road = cv2.morphologyEx(((s < 48) & (v < 128)).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
white = cv2.morphologyEx(((s < 30) & (v > 236)).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
m = json.load(open('data/bulge/map.json')); areas = {a['id']: a for a in json.load(open('data/bulge/areas.json'))}
borders = ''.join('M' + 'L'.join(f'{x} {y}' for x, y in a['polygon']) + 'Z' for a in m['areas'])
labels = ''.join(f'<text x="{a["label"][0]}" y="{a["label"][1] + 22}" text-anchor="middle">{areas[a["id"]]["name"]}</text><g><rect x="{a["label"][0] - 15}" y="{a["label"][1] - 15}" width="30" height="24" rx="3" fill="#c9a24f" stroke="#6b5420" stroke-width="1.5"/><text x="{a["label"][0]}" y="{a["label"][1] + 3}" text-anchor="middle" font-style="normal" font-weight="700" fill="#1a1608" stroke="none">{a["id"]}</text></g>' for a in m['areas'] if a['id'] in areas)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<g id="terrain"><rect width="{W}" height="{H}" fill="{ground}"/></g>
<g id="woods" opacity="0"><!-- reserved for the 3D scenery pass --></g>
<g id="borders" fill="#f7f7f2"><path fill-rule="evenodd" d="{paths(white, 70, 0.8)}"/></g>
<g id="area-outlines" fill="none" stroke="#f7f7f2" stroke-width="0" display="none"><path d="{borders}"/></g>
<g id="rivers" fill="#2f8fd0"><path fill-rule="evenodd" d="{paths(river, 25, 0.8, sig=1.6, thr=75)}"/></g>
<g id="roads" fill="#585d5a"><path fill-rule="evenodd" d="{paths(road, 55, 0.8, sig=3.0, thr=100)}"/></g>
<g id="labels" font-family="Arial Narrow, Arial, sans-serif" font-size="15" fill="#2c3a22" font-style="italic" stroke="{ground}" stroke-width="3" paint-order="stroke">{labels}</g>
</svg>'''
open('web/public/map-vector.svg', 'w').write(svg); print(len(svg) // 1024, 'KB')
