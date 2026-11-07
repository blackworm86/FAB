"""Sicily board art after the printed map: the cardboard's own ground (ground.py) under the game's lines, boxes and symbols drawn in the print's style.

Usage: python3 -I tools/sicily/board.py data/sicily web/public/sicily <scratch>/sicily-ground.png
Writes map-base.svg: the printed ground of the island and the mainland on the printed sea, the landing boxes (A green, B blue, D dark green)
and port boxes with their white dotted arrows, the damage boxes, the At Sea and Airborne Assault boxes. And map-lines.svg, in the print's
order: rivers, roads, area borders, the restricted-terrain tree line, the army boundaries, the white coast rim, then the symbols above
everything (anchors, airfields, the Messina exit arrows). Area numbers, names and VP symbols are printed at run time (labels.json).
The unshaded ground is left beside the ground file as sicily-ground.npy for relief.py.
"""
import base64, io, json, os, re, sys
from xml.sax.saxutils import escape
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
from shapely.geometry import Point, Polygon

D, OUT, GROUND = sys.argv[1:4]
M = json.load(open(os.path.join(D, 'map.json'))); A = json.load(open(os.path.join(D, 'map_art.json')))
W, H = [int(v) for v in M['size']]
os.makedirs(OUT, exist_ok=True)
paths = lambda ds, extra='': ''.join(f'<path d="{d}"{extra}/>' for d in ds if d)
pts = lambda d: [tuple(map(float, q.split(','))) for q in re.findall(r'-?[\d.]+,-?[\d.]+', d)]
ring = lambda P: 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in P) + 'Z'
font = 'font-family="Saira Condensed, Arial Narrow, sans-serif"'
def txt(x, y, s, size, fill, extra=''):
    attrs = {'text-anchor': 'middle', 'font-weight': '700'}
    for k in list(attrs):
        if k in extra: del attrs[k]
    at = ' '.join(f'{k}="{v}"' for k, v in attrs.items())
    return f'<text x="{x:.1f}" y="{y:.1f}" {at} {font} font-size="{size}" fill="{fill}" {extra}>{escape(s)}</text>'

# ---------- the printed palette, sampled from the scan ----------
SEA = (137, 193, 216); RIM = '#ffffff'; RIVER = '#4f9fd8'; ROAD = '#a9a49c'; BORDER = '#6a6667'; ARMY = '#3b3b3b'; TREELINE = '#6b4a24'; ANCHOR = '#1e6fc0'; AIRFIELD = '#f4de3a'
GROUP = {'A': '#3f9a3a', 'B': '#2a7fc8', 'D': '#1f6f3f', 'P': '#1e6fc0'}

# ---------- the ground: the cardboard's island and mainland on the printed sea ----------
ground = np.array(Image.open(GROUND).convert('RGB')).astype(np.float32)
def mask(polys):
    im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
    for P in polys:
        if len(P) > 2: d.polygon([tuple(p) for p in P], fill=1)
    return np.array(im) > 0
land = mask([a['polygon'] for a in M['areas']]) | mask([pts(p) for p in A['coast']]) | mask([pts(p) for p in A['islets']]) | mask([pts(p) for p in A['mainland']])
mainland = mask([pts(p) for p in A['mainland']])
grey = np.median(ground[mainland].reshape(-1, 3), 0)                                                # the printed mainland: a flat grey (its text and legend are not ground)
img = np.where(nd.binary_dilation(land, iterations=2)[..., None], ground, np.array(SEA, np.float32))
rng = np.random.default_rng(7); img = np.where(mainland[..., None], grey + nd.gaussian_filter(rng.standard_normal((H, W)), 5)[..., None] * 6, img)
buf = io.BytesIO(); Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(buf, 'JPEG', quality=88, optimize=True)
ground_uri = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
np.save(os.path.join(os.path.dirname(GROUND), 'sicily-ground.npy'), np.clip(img, 0, 255).astype(np.uint8))

# ---------- the boxes, as printed: a pale rounded card with its coloured stripe, the white dotted arrow to the coast ----------
AREA = {a['id']: Polygon(a['polygon']) for a in M['areas']}
def arrow(b, white=True):
    x0, y0, x1, y1 = b['rect']; c = Point((x0 + x1) / 2, (y0 + y1) / 2); P = AREA[b['area']]
    tgt = P.exterior.interpolate(P.exterior.project(c)); v = np.array([tgt.x - c.x, tgt.y - c.y]); n = v / np.hypot(*v)
    t = min((abs(((x1 - x0) / 2) / n[0]) if n[0] else 9e9), (abs(((y1 - y0) / 2) / n[1]) if n[1] else 9e9)) + 4
    s = np.array([c.x, c.y]) + n * t; e = np.array([tgt.x, tgt.y]) - n * 10
    if np.hypot(*(e - s)) < 10: return ''
    p = np.array([-n[1], n[0]]); tip = e + n * 12; b1 = e - n * 6 + p * 11; b2 = e - n * 6 - p * 11
    return (f'<path d="M{s[0]:.1f} {s[1]:.1f}L{e[0]:.1f} {e[1]:.1f}" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="butt" stroke-dasharray="6 6"/>'
            f'<path d="M{tip[0]:.1f} {tip[1]:.1f}L{b1[0]:.1f} {b1[1]:.1f}L{b2[0]:.1f} {b2[1]:.1f}Z" fill="#ffffff"/>')
def box_svg(b):
    x0, y0, x1, y1 = b['rect']; w, h = x1 - x0, y1 - y0; col = GROUP[b['group']]; r = 7; s = ''
    if b['kind'] == 'landing':
        st = 22
        s += (f'<rect x="{x0}" y="{y0}" width="{w:.1f}" height="{h:.1f}" rx="{r}" fill="#c9def0" stroke="#ffffff" stroke-width="3"/>'
              f'<path d="M{x0} {y1 - st}H{x1}V{y1 - r}A{r} {r} 0 0 1 {x1 - r} {y1}H{x0 + r}A{r} {r} 0 0 1 {x0} {y1 - r}Z" fill="{col}"/>'
              + txt(x0 + 8, y1 - 6, b['box'], 16, '#fff', 'text-anchor="start"') + (txt(x1 - 8, y1 - 6, b['name'], 13, '#fff', 'text-anchor="end" font-weight="600"') if b.get('name') else ''))
    else:
        who = 'Axis Control Required (6th Army only)' if b['box'] == 'P4' else f"Allied Control Required ({'7th' if b['box'] == 'P3' else '8th'} Army only)"
        s += (f'<rect x="{x0}" y="{y0}" width="{w:.1f}" height="{h:.1f}" rx="{r}" fill="{col}" stroke="#ffffff" stroke-width="3"/>'
              + txt((x0 + x1) / 2, y0 + 24, b['box'], 20, '#fff') + txt((x0 + x1) / 2, y0 + 42, b['name'], 15, '#fff', 'font-weight="600"')
              + txt((x0 + x1) / 2, y1 - 20, who.split(' (')[0], 9.5, '#fff', 'font-weight="600"') + txt((x0 + x1) / 2, y1 - 8, '(' + who.split(' (')[1], 9.5, '#fff', 'font-weight="600"'))
        if b.get('damage_box'):
            dx0, dy0, dx1, dy1 = b['damage_box']; cx = (dx0 + dx1) / 2
            s += (f'<rect x="{dx0}" y="{dy0}" width="{dx1 - dx0:.1f}" height="{dy1 - dy0:.1f}" rx="6" fill="#dbe9f4" stroke="#ffffff" stroke-width="2.5"/>'
                  + txt(cx, dy0 + 14, b['name'], 10, '#1b2a3a', 'font-weight="600"') + txt(cx, dy0 + 25, 'Damage', 9, '#1b2a3a', 'font-weight="600"') + anchor_glyph(cx, (dy0 + dy1) / 2 + 12, 0.9, '#1e6fc0'))
    return s + arrow(b)
def anchor_glyph(x, y, k, col):
    return (f'<g transform="translate({x:.1f} {y:.1f}) scale({k})" fill="none" stroke="{col}" stroke-width="2.4" stroke-linecap="round"><circle cy="-8" r="2.4"/><path d="M0 -5.5V9M-6 -1.5H6M-9 3.5A9 9 0 0 0 9 3.5"/></g>')
anchor = lambda x, y: f'<g transform="translate({x:.1f} {y:.1f})"><circle r="12.5" fill="{ANCHOR}" stroke="#ffffff" stroke-width="2"/>{anchor_glyph(0, 0.5, 1, "#ffffff")}</g>'
airfield = lambda x, y, r: (f'<g transform="translate({x:.1f} {y:.1f})"><circle r="{r:.1f}" fill="{AIRFIELD}" stroke="#2b2a26" stroke-width="1.2"/>'
                            f'<g transform="scale({r / 16:.3f})" fill="#2b2a26"><path d="M-1.6 -11h3.2l1 7 8.5 4.5v2.6l-8.5-2.2-.5 5.5 3 2v1.8L0 9.5l-5.2 .7V8.4l3-2-.5-5.5-8.5 2.2V.5l8.5-4.5z"/></g></g>')
ML = M['mainland']; mlc = ML['label']
hold = lambda x, y, w, h, title: (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="#c9def0" stroke="#ffffff" stroke-width="3"/>'
                                  f'<path d="M{x} {y + h - 24}H{x + w}V{y + h - 8}A8 8 0 0 1 {x + w - 8} {y + h}H{x + 8}A8 8 0 0 1 {x} {y + h - 8}Z" fill="{GROUP["P"]}"/>' + txt(x + w / 2, y + h - 7, title, 15, '#fff'))
base = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
        f'<image id="ground" href="{ground_uri}" width="{W}" height="{H}" preserveAspectRatio="none"/>',
        '<g id="names">' + txt(mlc[0] + 40, mlc[1] - 150, 'Exiting', 24, '#3f3e3a', 'stroke="#d8dad2" stroke-width="3" paint-order="stroke" font-style="italic"')
        + txt(mlc[0] + 40, mlc[1] - 124, 'Axis Units', 24, '#3f3e3a', 'stroke="#d8dad2" stroke-width="3" paint-order="stroke" font-style="italic"') + '</g>',
        '<g id="boxes">' + ''.join(box_svg(b) for b in A['boxes']) + hold(46, 1020, 170, 170, 'At Sea') + hold(236, 1020, 150, 170, 'Airborne Assault') + '</g>',
        '</svg>']
open(os.path.join(OUT, 'map-base.svg'), 'w').write('\n'.join(base))

# ---------- the line work, in the print's order; the symbols above everything ----------
g = lambda gid, attrs, body: f'<g id="{gid}" fill="none" stroke-linecap="round" stroke-linejoin="round" {attrs}>{body}</g>'
exit_arrows = ''
mess = AREA[ML['exit_from']]; mp = Polygon(pts(A['mainland'][0]))
near = sorted(((mp.distance(Point(q)), q) for q in mess.exterior.coords), key=lambda x: x[0])[0][1]       # the Messina shore facing the strait
at = mess.exterior.project(Point(near))
for k in range(3):
    s = mess.exterior.interpolate(at + (k - 1) * 28); t = mp.exterior.interpolate(mp.exterior.project(s))
    v = np.array([t.x - s.x, t.y - s.y]); n = v / np.hypot(*v); p = np.array([-n[1], n[0]]); e = np.array([t.x, t.y]) - n * 6; st = np.array([s.x, s.y]) + n * 4
    exit_arrows += f'<path d="M{st[0]:.1f} {st[1]:.1f}L{e[0]:.1f} {e[1]:.1f}" stroke-dasharray="5 5"/><path d="M{(e + n * 9)[0]:.1f} {(e + n * 9)[1]:.1f}L{(e - n * 4 + p * 7)[0]:.1f} {(e - n * 4 + p * 7)[1]:.1f}L{(e - n * 4 - p * 7)[0]:.1f} {(e - n * 4 - p * 7)[1]:.1f}Z" fill="#ffffff" stroke="none"/>'
coast = [ring(pts(p)) for p in A['coast'] + A['islets'] + A['mainland']]
lines = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
         g('rivers', '', f'<g stroke="#ffffff" stroke-width="5.2">{paths(A["river"])}</g><g stroke="{RIVER}" stroke-width="2.8">{paths(A["river"])}</g>'),
         g('roads', f'stroke="{ROAD}" stroke-width="4.2"', paths(A['roads'])),
         g('boundaries', f'stroke="{BORDER}" stroke-width="4.4"', paths(A['open'])),
         g('restricted', '', f'<g stroke="{TREELINE}" stroke-width="14" stroke-linecap="butt" stroke-dasharray="1.4 4.2" stroke-opacity=".75">{paths(A["restricted"])}</g><g stroke="{TREELINE}" stroke-width="2.4">{paths(A["restricted"])}</g>'),
         g('army-boundaries', '', f'<g stroke="#ffffff" stroke-width="4.4">{paths(A["army_boundary"])}</g><g stroke="{ARMY}" stroke-width="4.4" stroke-linecap="butt" stroke-dasharray="8 8">{paths(A["army_boundary"])}</g>'),
         g('outline', f'stroke="{RIM}" stroke-width="7"', paths(coast)),
         g('exit', 'stroke="#ffffff" stroke-width="3.4"', exit_arrows),
         '<g id="symbols">' + ''.join(anchor(p['x'], p['y']) for p in A['port_symbols']) + ''.join(airfield(a['x'], a['y'], a['r']) for a in A['airfields']) + '</g>',
         '</svg>']
open(os.path.join(OUT, 'map-lines.svg'), 'w').write('\n'.join(lines))
print('board', W, H, os.path.getsize(os.path.join(OUT, 'map-base.svg')) // 1024, 'KB +', os.path.getsize(os.path.join(OUT, 'map-lines.svg')) // 1024, 'KB', len(A['boxes']), 'boxes')
