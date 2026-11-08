"""Sicily board art after the printed map: the cardboard's own ground (ground.py) under the game's lines, boxes and symbols drawn in the print's style.

Usage: python3 -I tools/sicily/board.py data/sicily web/public/sicily <scratch>/sicily-ground.png
Writes map-base.svg: the printed ground of the island and the mainland on the printed sea, the landing boxes (A green, B blue, D dark green)
and port boxes with their white dotted arrows, the damage boxes, the At Sea and Airborne Assault boxes. And map-lines.svg, in the print's
order: the blue coast line, rivers, roads, the restricted-terrain tufts, area borders, the army boundaries (grey with white dashes), the
hatched cities, the owner's drawn arrows (white dotted, as printed), then the symbols above everything (anchors, airfields). Area numbers, names and VP symbols are printed at run time (labels.json).
The unshaded ground is left beside the ground file as sicily-ground.npy for relief.py.
"""
import base64, io, json, os, re, sys
from xml.sax.saxutils import escape
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
from shapely.geometry import LineString, Point, Polygon

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
PORT_COL = {'P3': '#3f8a3a', 'P4': '#6d7378'}

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
flip = lambda cx, cy, body: f'<g data-flip="{cx:.1f} {cy:.1f}">{body}</g>'
fl = lambda x0, y0, x1, y1, body, pad=5: f'<g data-float="{x0 - pad:.1f} {y0 - pad:.1f} {x1 - x0 + 2 * pad:.1f} {y1 - y0 + 2 * pad:.1f}">{body}</g>'   # hovers over the relief in 3D     # printed words the app turns round for the player across the table
def box_svg(b):
    x0, y0, x1, y1 = b['rect']; w, h = x1 - x0, y1 - y0; col = GROUP[b['group']]; r = 7; s = ''
    if b['kind'] == 'landing':
        st = 22
        s += (f'<rect x="{x0}" y="{y0}" width="{w:.1f}" height="{h:.1f}" rx="{r}" fill="#c9def0" stroke="#ffffff" stroke-width="3"/>'
              f'<path d="M{x0} {y1 - st}H{x1}V{y1 - r}A{r} {r} 0 0 1 {x1 - r} {y1}H{x0 + r}A{r} {r} 0 0 1 {x0} {y1 - r}Z" fill="{col}"/>'
              + txt(x0 + 8, y1 - 6, b['box'], 16, '#fff', 'text-anchor="start"') + (txt(x1 - 8, y1 - 6, b['name'], 13, '#fff', 'text-anchor="end" font-weight="600"' + (f' textLength="{room:.0f}" lengthAdjust="spacingAndGlyphs"' if (room := w - 16 - len(b['box']) * 9 - 6) < len(b['name']) * 6.2 else '')) if b.get('name') else ''))   # a long beach name is squeezed to clear the box's code
        s = fl(x0, y0, x1, y1, flip((x0 + x1) / 2, (y0 + y1) / 2, s))
    else:
        who = 'Axis Control Required (6th Army only)' if b['box'] == 'P4' else f"Allied Control Required ({'7th' if b['box'] == 'P3' else '8th'} Army only)"
        col = PORT_COL.get(b['box'], col)                                                # as printed: Palermo green (7th Army), Messina grey (Axis), the British ports blue
        s += (f'<rect x="{x0}" y="{y0}" width="{w:.1f}" height="{h:.1f}" rx="{r}" fill="{col}" stroke="#1b2a3a" stroke-width="2.4"/>'
              + txt((x0 + x1) / 2, y0 + 24, b['box'], 20, '#fff') + txt((x0 + x1) / 2, y0 + 42, b['name'], 15, '#fff', 'font-weight="600"')
              + txt((x0 + x1) / 2, y1 - 20, who.split(' (')[0], 9.5, '#fff', 'font-weight="600"') + txt((x0 + x1) / 2, y1 - 8, '(' + who.split(' (')[1], 9.5, '#fff', 'font-weight="600"'))
        s = fl(x0, y0, x1, y1, flip((x0 + x1) / 2, (y0 + y1) / 2, s))
        if b.get('damage_box'):
            dx0, dy0, dx1, dy1 = b['damage_box']; cx = (dx0 + dx1) / 2
            s += fl(dx0, dy0, dx1, dy1, flip(cx, (dy0 + dy1) / 2, f'<rect x="{dx0}" y="{dy0}" width="{dx1 - dx0:.1f}" height="{dy1 - dy0:.1f}" rx="6" fill="#dbe9f4" stroke="#ffffff" stroke-width="2.5"/>'
                  + txt(cx, dy0 + 14, b['name'], 10, '#1b2a3a', 'font-weight="600"') + txt(cx, dy0 + 25, 'Damage', 9, '#1b2a3a', 'font-weight="600"') + anchor_glyph(cx, (dy0 + dy1) / 2 + 12, 0.9, '#1e6fc0')))
    return s
def anchor_glyph(x, y, k, col):
    return (f'<g transform="translate({x:.1f} {y:.1f}) scale({k})" fill="none" stroke="{col}" stroke-width="2.4" stroke-linecap="round"><circle cy="-8" r="2.4"/><path d="M0 -5.5V9M-6 -1.5H6M-9 3.5A9 9 0 0 0 9 3.5"/></g>')
anchor = lambda x, y: f'<g transform="translate({x:.1f} {y:.1f})"><circle r="12.5" fill="{ANCHOR}" stroke="#ffffff" stroke-width="2"/>{anchor_glyph(0, 0.5, 1, "#ffffff")}</g>'
airfield = lambda x, y, r: (f'<g transform="translate({x:.1f} {y:.1f}) scale(.8)" opacity=".9"><circle r="{r:.1f}" fill="{AIRFIELD}" stroke="#4a463c" stroke-width="1"/>'
                            f'<g transform="scale({r / 16:.3f})" fill="#2b2a26"><path d="M-1.6 -11h3.2l1 7 8.5 4.5v2.6l-8.5-2.2-.5 5.5 3 2v1.8L0 9.5l-5.2 .7V8.4l3-2-.5-5.5-8.5 2.2V.5l8.5-4.5z"/></g></g>')
ML = M['mainland']; mlc = ML['label']
hold = lambda x, y, w, h, title: fl(x, y, x + w, y + h, flip(x + w / 2, y + h / 2, f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="#c9def0" stroke="#ffffff" stroke-width="3"/>'
                                  f'<path d="M{x} {y + h - 24}H{x + w}V{y + h - 8}A8 8 0 0 1 {x + w - 8} {y + h}H{x + 8}A8 8 0 0 1 {x} {y + h - 8}Z" fill="{GROUP["P"]}"/>' + txt(x + w / 2, y + h - 7, title, 15, '#fff')))
base = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
        f'<image id="ground" href="{ground_uri}" width="{W}" height="{H}" preserveAspectRatio="none"/>',
        '<g id="names">' + f'<g data-flip="{mlc[0] + 40:.1f} {mlc[1] - 145:.1f}">' + txt(mlc[0] + 40, mlc[1] - 150, 'Exiting', 24, '#3f3e3a', 'stroke="#d8dad2" stroke-width="3" paint-order="stroke" font-style="italic"')
        + txt(mlc[0] + 40, mlc[1] - 124, 'Axis Units', 24, '#3f3e3a', 'stroke="#d8dad2" stroke-width="3" paint-order="stroke" font-style="italic"') + '</g></g>',
        '<g id="boxes">' + ''.join(box_svg(b) for b in A['boxes']) + hold(46, 1020, 170, 170, 'At Sea') + hold(236, 1020, 150, 170, 'Airborne Assault') + '</g>',
        '</svg>']
open(os.path.join(OUT, 'map-base.svg'), 'w').write('\n'.join(base))

# ---------- the line work, in the print's order; the symbols above everything ----------
g = lambda gid, attrs, body: f'<g id="{gid}" fill="none" stroke-linecap="round" stroke-linejoin="round" {attrs}>{body}</g>'
# the restricted-terrain boundary as printed: rows of small dark tufts on both sides of the line
def tufts(d, gap=7.5, off=5.5, size=7.5):
    P = np.array(pts(d)); seg = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]; out = []
    for k, t in enumerate(np.arange(gap / 2, seg[-1], gap)):
        i = min(np.searchsorted(seg, t), len(P) - 1); a, b = P[max(i - 1, 0)], P[i]; v = b - a; L = np.hypot(*v)
        if not L: continue
        tg = v / L; n = np.array([-tg[1], tg[0]]); c0 = a + tg * (t - seg[max(i - 1, 0)])
        for side in (1, -1):
            c = c0 + n * side * (off + (k % 2) * 1.2)
            for f in (-0.7, -0.45, -0.2, 0.05, 0.3, 0.55, 0.8):                                              # a fan of five short strokes pointing away from the line
                dirn = n * side * np.cos(f) + tg * np.sin(f); e = c + dirn * size * (0.75 + 0.35 * np.cos(f * 2))
                out.append(f'M{c[0]:.1f} {c[1]:.1f}L{e[0]:.1f} {e[1]:.1f}')
    return ''.join(out)
def small_paths(d, n=28):                                                           # one path of 1680 strokes made phones drop the line work drawn after it (the borders): a few strokes per path, as on the other maps
    s = re.findall(r'M[^M]+', d); return ''.join(f'<path d="{"".join(s[i:i + n])}"/>' for i in range(0, len(s), n))
ARROW_COL = '#ffffff'
ZONE = {a['id']: a['zone'] for a in M['areas']}
def zone_captions():                                                                # as printed: "Zone A" / "Zone B" either side of each army boundary, along it
    import math; out = ''
    for d in A['army_boundary']:
        q = pts(d)
        if len(q) < 2: continue
        ln = LineString(q); L = ln.length
        if L < 120: continue
        for t in ([0.5] if L < 500 else [0.3, 0.7]):
            a, b = ln.interpolate(L * t - 6), ln.interpolate(L * t + 6); ang = math.degrees(math.atan2(b.y - a.y, b.x - a.x))
            if ang > 90: ang -= 180
            if ang < -90: ang += 180
            m = ln.interpolate(L * t); r = math.radians(ang); nx, ny = -math.sin(r), math.cos(r)
            for sgn in (1, -1):
                px, py = m.x + nx * 13 * sgn, m.y + ny * 13 * sgn
                zs = next((ZONE[k] for k, P in AREA.items() if P.contains(Point(px, py))), None)
                if zs and len(zs) == 1:
                    out += (f'<g data-float="{px - 34:.1f} {py - 12:.1f} 68 24"><g data-flip="{px:.1f} {py:.1f}"><text x="{px:.1f}" y="{py + 4:.1f}" transform="rotate({ang:.1f} {px:.1f} {py:.1f})" text-anchor="middle" '
                            f'font-family="Saira Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="12" letter-spacing="1" fill="#4b4b4b" stroke="#ece6d2" stroke-width="2.4" paint-order="stroke">ZONE {zs[0]}</text></g></g>')   # hovers over the relief in 3D, like the area names
    return out
def clear_of_town(x, y, r=17):                                                      # an anchor never sits on a town's hatching: pushed out of it, away from the town's middle
    for c in A['cities']:
        P = Polygon(pts(c['d']))
        if P.is_valid and P.distance(Point(x, y)) < r:
            cx, cy = P.centroid.x, P.centroid.y; d = np.array([x - cx, y - cy]); d = d / (np.hypot(*d) or 1)
            for k in range(1, 80):
                q = Point(x + d[0] * k, y + d[1] * k)
                if P.distance(q) >= r: return q.x, q.y
    return x, y
def arrow_svg(a):
    v = [float(x) for x in re.findall(r'-?\d+\.?\d*', a['shaft'] + ' ' + a['head'])]; xs, ys = v[0::2], v[1::2]
    return fl(min(xs), min(ys), max(xs), max(ys), f'<path d="{a["shaft"]}" fill="none" stroke="{ARROW_COL}" stroke-width="6" stroke-dasharray="5 4" stroke-linecap="butt"/><path d="{a["head"]}" fill="{ARROW_COL}"/>', 8)
arrows_svg = ''.join(arrow_svg(a) for a in A['arrows'])
coast = [ring(pts(p)) for p in A['coast'] + A['islets'] + A['mainland']]
city = ''.join(f'<path d="{c["d"]}" fill="url(#hatch)" stroke="#6d6d6d" stroke-width="1.2"/>' for c in A['cities'])
lines = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
         '<defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#c4c2bd"/><path d="M0 0V4" stroke="#7d7b77" stroke-width="1.3"/></pattern></defs>',
         g('coast', 'stroke="#2a86c2" stroke-width="3.2"', paths(coast)),                                   # the print's order: the coast, rivers, roads, the tufts, borders, army boundaries, cities, arrows, symbols
         g('rivers', '', f'<g stroke="#2f7fb5" stroke-width="6.4">{paths(A["river"])}</g><g stroke="#6cc4ec" stroke-width="3.6">{paths(A["river"])}</g>'),
         g('roads', '', f'<g stroke="#8e8e8e" stroke-width="5">{paths(A["roads"])}</g><g stroke="#d6d5d2" stroke-width="2.6">{paths(A["roads"])}</g>'),
         g('restricted', 'stroke="#4b3b2a" stroke-width=".8"', small_paths(''.join(tufts(d) for d in A['restricted']))),
         g('boundaries', 'stroke="#626262" stroke-width="5.2"', paths(A['open'] + A['restricted'])),
         g('army-boundaries', '', f'<g stroke="#5a5a5a" stroke-width="7">{paths(A["army_boundary"])}</g><g stroke="#ffffff" stroke-width="2" stroke-linecap="butt" stroke-dasharray="6 5">{paths(A["army_boundary"])}</g>'),
         f'<g id="cities">{city}</g>',
         f'<g id="zone-names">{zone_captions()}</g>',
         f'<g id="arrows">{arrows_svg}</g>',
         '<g id="symbols">' + ''.join(anchor(*clear_of_town(p['x'], p['y'])) for p in A['port_symbols']) + ''.join(airfield(a['x'], a['y'], a['r']) for a in A['airfields']) + '</g>',
         '</svg>']
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')); from hatch import convert as hatch_free   # no <pattern> in a board file: see tools/hatch.py
open(os.path.join(OUT, 'map-lines.svg'), 'w').write(hatch_free('\n'.join(lines)))
print('board', W, H, os.path.getsize(os.path.join(OUT, 'map-base.svg')) // 1024, 'KB +', os.path.getsize(os.path.join(OUT, 'map-lines.svg')) // 1024, 'KB', len(A['boxes']), 'boxes')
