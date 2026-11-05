"""Golan '73 board art in the series look (The Bulge's board), from data/golan73/map.json + map_art.json and the real relief.

Usage: python3 -I tools/golan73/board.py data/golan73 web/public/golan73 <scratch>/real.npy docs/games/golan73/maps/GolanMap.svg
Writes map-base.svg: the sheet margin, one ground for the whole play area (dry October plateau, cultivated valley floor, the Hermon
massif) shaded by the real relief and speckled with basalt where the terrain is rough (as The Bulge's ground carries its woods), the
off-map basalt of the Leja and Lebanon, the lakes, the Assembly boxes, the Syrian entry triangles, the Israeli supply sources and the
alternate set-up squares as on the printed map. And map-lines.svg: the line work in the printed legend's styles drawn with The
Bulge's vocabulary (white area borders, cased roads and rivers). Numbers, names, VP stars and entry letters are printed at run time.
"""
import base64, io, json, os, re, sys, xml.etree.ElementTree as ET
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
from shapely.geometry import LineString, Polygon

D, OUT, REAL, SVG_IN = sys.argv[1:5]
M = json.load(open(os.path.join(D, 'map.json'))); A = json.load(open(os.path.join(D, 'map_art.json')))
W, H = [int(v) for v in M['size']]
os.makedirs(OUT, exist_ok=True)
poly = lambda P: 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in P) + 'Z'
paths = lambda ds, extra='': ''.join(f'<path d="{d}"{extra}/>' for d in ds if d)
pts = lambda d: [tuple(map(float, q.split(','))) for q in re.findall(r'-?[\d.]+,-?[\d.]+', d)]

# ---------- the series palette (The Bulge: margin #bccad3, borders #fbfbf6, roads #585b56 on #e4e6d8, rivers #1c78c0 in white, entry green #2f9a52) ----------
MARGIN = (188, 202, 211); PLATEAU = np.array([205, 194, 160], np.float32); VALLEY = np.array([196, 199, 164], np.float32)
HERMON = np.array([150, 128, 96], np.float32); BASALT = np.array([158, 157, 148], np.float32); WATER = (150, 190, 219)

# ---------- masks ----------
def mask(polys, fill=1):
    im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
    for P in polys:
        if len(P) > 2: d.polygon([tuple(p) for p in P], fill=fill)
    return np.array(im) > 0
ids = Image.new('I', (W, H), 0); dd = ImageDraw.Draw(ids)
for a in M['areas']: dd.polygon([tuple(p) for p in a['polygon']], fill=a['id'])
ids = np.array(ids); land = ids > 0
tdn = np.zeros(128, np.float32)
for a in M['areas']: tdn[a['id']] = a['tdn']
T = nd.gaussian_filter(tdn[ids] * land, 3)
lakes = [pts(p) for p in A['lakes']]
leja = [P for P in lakes if np.mean([p[1] for p in P]) < 300]                      # the basalt field in the north-east corner, drawn with the lakes
water = [P for P in lakes if P not in leja]
offmap = (mask([pts(p) for p in A['offmap']]) | mask(leja)) & ~(ids > 0)
wet = mask(water)

# ---------- relief: real metres on the map grid ----------
h = nd.zoom(np.load(REAL), 2, order=1)[:H, :W]
hs = nd.gaussian_filter(h, 1.6)
gy, gx = np.gradient(hs)
shade = np.clip(1 + (-gx * 0.62 - gy * 0.78) / 34, 0.62, 1.22)                       # light from the upper left, as on a printed map
shade = 1 + (shade - 1) * np.where(ids == 83, 1.0, 0.7)                             # Hermon keeps its full modelling, the plateau a softer one
slope = np.hypot(gx, gy)

# ---------- ground ----------
low = np.clip((60 - h) / 220, 0, 1)[..., None]                                     # the valley floor below about 0 m: tilled and greener
ground = PLATEAU * (1 - low) + VALLEY * low
ground = np.where((ids == 83)[..., None], HERMON, ground)
rng = np.random.default_rng(73)
grain = nd.gaussian_filter(rng.standard_normal((H, W)), 0.7)                       # basalt boulders: dark specks, denser where the terrain is rough
speck = (grain > 2.15 - 0.42 * T) & land & ~wet
stone = nd.gaussian_filter(rng.standard_normal((H, W)), 6) * 6                      # a little large-scale unevenness so the ground does not read as flat paint
img = ground + stone[..., None]
img = np.where(speck[..., None], img * 0.72, img)
img = img * shade[..., None]
img = np.where(offmap[..., None], BASALT * np.clip(shade, .85, 1.12)[..., None], img)
inside = land | offmap
img = np.where(inside[..., None], img, np.array(MARGIN, np.float32))
img = np.where(wet[..., None], np.array(WATER, np.float32), img)
buf = io.BytesIO(); Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(buf, 'JPEG', quality=84, optimize=True)
ground_uri = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()

# ---------- what the drawing carries besides the areas: supply sources, alternate set-up squares ----------
NS = '{http://www.w3.org/2000/svg}'; root = ET.parse(SVG_IN).getroot()
layer = lambda lid: next(x for x in root if x.attrib.get('id') == lid)
supply = []
for e in layer('ISRAELI_SUPPLY_SOURCES').iter(NS + 'path'):
    m = re.match(r'M([\d.]+),([\d.]+)v', e.attrib.get('d', ''))
    if m: supply.append((float(m.group(1)), float(m.group(2)) - 10))
CSS = root.find(NS + 'defs').find(NS + 'style').text
FILL = {c: re.search(r'fill:\s*([^;]+);', b).group(1) for s, b in re.findall(r'([^{}]+)\{([^}]*)\}', CSS) if 'fill:' in b for c in re.findall(r'\.(st\d+)', s)}
setup = [(float(e.attrib['x']) + 8.5, float(e.attrib['y']) + 8.5, FILL.get(e.attrib.get('class'), '#f0cf2c')) for e in layer('SYRIAN_ALTERNATE_SETUP_AREAS').iter(NS + 'rect')]

# ---------- the entry triangles (14.21): on the map edge, pointing in, as printed ----------
label = {a['id']: a['label'] for a in M['areas']}
def inward(x, y, r=70):                                                            # into the play area: towards the land around the entry point
    yy, xx = np.mgrid[max(0, int(y) - r):min(H, int(y) + r), max(0, int(x) - r):min(W, int(x) + r)]
    k = land[yy, xx] & ((xx - x) ** 2 + (yy - y) ** 2 < r * r); v = np.array([xx[k].mean() - x, yy[k].mean() - y])
    a = np.arctan2(v[1], v[0]); a = np.round(a / (np.pi / 2)) * (np.pi / 2)        # square to the map edge
    return np.array([np.cos(a), np.sin(a)])
marks = []
def triangle(e, side=66):
    x, y = e['x'], e['y']; n = inward(x, y); t = np.array([-n[1], n[0]])
    c = np.array([x, y]) + n * 8                                                     # astride the map edge, pointing in (the sheet has no margin outside it here)
    marks.append({'letter': e['letter'], 'x': round(float(c[0] - n[0] * 4), 1), 'y': round(float(c[1] - n[1] * 4 + 2), 1)})
    tip = c + n * side * 0.5; b1 = c - n * side * 0.5 + t * side * 0.58; b2 = c - n * side * 0.5 - t * side * 0.58
    return f'M{tip[0]:.1f} {tip[1]:.1f}L{b1[0]:.1f} {b1[1]:.1f}L{b2[0]:.1f} {b2[1]:.1f}Z'
tank = lambda x, y, col: (f'<g transform="translate({x:.1f} {y:.1f}) scale(.62)" fill="{col}" stroke="#2b2a26" stroke-width="2.2" stroke-linejoin="round">'      # the alternate set-up tanks, in the division's colour
                          '<rect x="-24" y="2" width="48" height="11" rx="5.5"/><path d="M-20 2L-15 -6H17L22 2Z"/><path d="M-8 -6V-12H9L11 -6Z"/><path d="M9 -10H30" fill="none" stroke-width="3.4"/></g>')
font = 'font-family="Saira Condensed, Arial Narrow, sans-serif"'
txt = lambda x, y, s, size, fill, extra='': f'<text x="{x:.0f}" y="{y:.0f}" text-anchor="middle" {font} font-style="italic" font-weight="600" font-size="{size}" fill="{fill}" {extra}>{s}</text>'
wcentre = lambda P: (np.mean([p[0] for p in P]), np.mean([p[1] for p in P]))
lake_names = []
for P in water:
    cx, cy = wcentre(P); big = Polygon(P).area > 40000
    lake_names.append(txt(cx, cy - 4, 'Sea of Galilee' if big else 'Lake Hula', 34 if big else 20, '#1d5f9a', 'stroke="#d8e8f3" stroke-width="3" paint-order="stroke"') +
                      ('' if big else txt(cx, cy + 18, '(drained)', 15, '#1d5f9a', 'stroke="#d8e8f3" stroke-width="3" paint-order="stroke"')))
for P in leja: cx, cy = wcentre(P); lake_names.append(txt(cx - 6, cy, 'The Leja', 26, '#3f3e3a', 'stroke="#c3c2bb" stroke-width="3" paint-order="stroke"'))

base = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
        f'<image id="ground" href="{ground_uri}" width="{W}" height="{H}" preserveAspectRatio="none"/>',
        '<g id="names">' + ''.join(lake_names) + '</g>',
        '<g id="assembly">' + ''.join(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#dce8ef" stroke="#fbfbf6" stroke-width="4"/>'
            f'<path d="M{x + 10} {y}H{x + w - 10}A10 10 0 0 1 {x + w} {y + 10}V{y + 34}H{x}V{y + 10}A10 10 0 0 1 {x + 10} {y}Z" fill="#2a8fc8"/>'
            f'<text x="{x + w / 2}" y="{y + 23}" text-anchor="middle" {font} font-weight="700" font-size="14" fill="#fff" textLength="{w - 22}" lengthAdjust="spacingAndGlyphs">{v["name"].upper()}</text>'
            f'<path d="M{x + w / 2 - 26} {y + h + 4}L{x + w / 2 + 26} {y + h + 4}L{x + w / 2} {y + h + 46}Z" fill="#2a8fc8" stroke="#fbfbf6" stroke-width="3" stroke-linejoin="round"/>'
            f'<text x="{x + w / 2}" y="{y + h + 28}" text-anchor="middle" {font} font-weight="700" font-size="24" fill="#fff">{k}</text>'
            for k, v in M['assembly'].items() for x, y, w, h in [v['box']]) + '</g>',
        '<g id="entries" fill="#2f9a52" stroke="#fbfbf6" stroke-width="3.2" stroke-linejoin="round">' + ''.join(f'<path d="{triangle(e)}"/>' for e in M['entries']) + '</g>',
        '<g id="setup">' + ''.join(tank(x, y, c) for x, y, c in setup) + '</g>',
        '<g id="supply">' + ''.join(f'<g transform="translate({x:.1f} {y:.1f})"><circle r="13" fill="#fbfbf6"/><path d="M0 -11A11 11 0 0 0 0 11Z" fill="#1d5fa8"/>'
                                     f'<circle r="11" fill="none" stroke="#1d5fa8" stroke-width="2"/></g>' for x, y in supply) + '</g>',
        '</svg>']
open(os.path.join(OUT, 'map-base.svg'), 'w').write('\n'.join(base))
json.dump(marks, open(os.path.join(D, 'entry_marks.json'), 'w'))                      # where the run-time letters go: in the triangles

# ---------- line work: the printed legend, in The Bulge's hand ----------
g = lambda gid, attrs, body: f'<g id="{gid}" fill="none" stroke-linecap="round" stroke-linejoin="round" {attrs}>{body}</g>'
heads = ''.join(f'<path d="{d}" fill="#1d1d1b"/>' for d in A['heads'])
def purple(d, off=11):                                                              # the Purple Line runs beside the anti-tank ditch, on the Israeli side
    L = LineString(pts(d))
    if L.length < 5: return ''
    a, b = L.parallel_offset(off, 'left'), L.parallel_offset(off, 'right')
    mid = lambda G: np.mean([c[1] for c in (G.coords if G.geom_type == 'LineString' else [c for s in G.geoms for c in s.coords])])
    o = min([a, b], key=mid)                                                       # as printed: on the Syrian side (up the sheet, east)
    segs = [o] if o.geom_type == 'LineString' else list(o.geoms)
    return ''.join('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in s.coords) for s in segs if s.length > 4)
lines = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
         g('shores', '', f'<g stroke="#fbfbf6" stroke-width="5">{paths(A["lakes"][:0] + [poly(P) for P in water])}</g><g stroke="#1c78c0" stroke-width="2.2">{paths([poly(P) for P in water])}</g>'
                         f'<g stroke="#fbfbf6" stroke-width="3">{paths([poly(P) for P in leja])}</g>'),
         g('boundaries', 'stroke="#fbfbf6" stroke-width="2.8"', paths(A['open'])),
         g('wadi', '', f'<g stroke="#8a7458" stroke-opacity=".35" stroke-width="11">{paths(A["wadi"])}</g><g stroke="#fbfbf6" stroke-width="5.4">{paths(A["wadi"])}</g><g stroke="#6d5a40" stroke-width="2.8">{paths(A["wadi"])}</g>'),
         g('rugged', '', f'<g stroke="#4f4c45" stroke-width="13" stroke-linecap="butt" stroke-dasharray="1.6 4.4">{paths(A["rugged"])}</g><g stroke="#fbfbf6" stroke-width="5">{paths(A["rugged"])}</g><g stroke="#4f4c45" stroke-width="2.4">{paths(A["rugged"])}</g>'),
         g('escarpment', '', f'<g stroke="#5b4630" stroke-width="15" stroke-linecap="butt" stroke-dasharray="1.4 3.2" stroke-opacity=".85">{paths(A["escarpment"])}</g><g stroke="#fbfbf6" stroke-width="6">{paths(A["escarpment"])}</g><g stroke="#3b2f22" stroke-width="3.2">{paths(A["escarpment"])}</g>'),
         g('hermon', 'stroke="#fbfbf6" stroke-width="3"', paths(A['hermon'])),
         g('rivers', '', f'<g stroke="#fff" stroke-width="6">{paths(A["river"])}</g><g stroke="#1c78c0" stroke-width="3">{paths(A["river"])}</g>'),
         g('roads', '', f'<g stroke="#e4e6d8" stroke-opacity=".85" stroke-width="4.4">{paths(A["roads"])}</g><g stroke="#585b56" stroke-width="1.7">{paths(A["roads"])}</g>'),
         g('at-ditch', '', f'<g stroke="#8b6a4a" stroke-opacity=".45" stroke-width="18">{paths(A["atDitch"])}</g><g stroke="#fbfbf6" stroke-width="6">{paths(A["atDitch"])}</g><g stroke="#6a4a2e" stroke-width="3.4">{paths(A["atDitch"])}</g>'),
         g('purple-line', 'stroke="#8e4f9f" stroke-width="2.2" stroke-dasharray="7 6"', ''.join(f'<path d="{purple(d)}"/>' for d in A['atDitch'])),
         g('sam-barrier', '', f'<g stroke="#fbfbf6" stroke-width="5.6">{paths(A["samBarrier"])}</g><g stroke="#1d5fa8" stroke-width="3" stroke-dasharray="14 5 2 5">{paths(A["samBarrier"])}</g>'),
         g('sectors', '', f'<g stroke="#fbfbf6" stroke-width="6">{paths(A["sector"])}</g><g stroke="#2b2a26" stroke-width="3" stroke-linecap="butt" stroke-dasharray="8 7">{paths(A["sector"])}</g>'),
         g('arrows', 'stroke="#1d1d1b" stroke-width="3.4"', paths(A['arrows1']) + f'<g stroke-dasharray="10 7">{paths(A["arrowsAll"])}</g>' + f'<g stroke="none">{heads}</g>'),
         g('outline', 'stroke="#fbfbf6" stroke-width="4.6"', paths(A['border'])),
         '</svg>']
open(os.path.join(OUT, 'map-lines.svg'), 'w').write('\n'.join(lines))
np.save(os.path.join(os.path.dirname(REAL), 'golan-ground.npy'), np.clip((ground + stone[..., None]) * np.where(speck, .8, 1)[..., None], 0, 255).astype(np.uint8))   # unshaded ground, for the 3D relief
print('board', W, H, os.path.getsize(os.path.join(OUT, 'map-base.svg')) // 1024, 'KB +', os.path.getsize(os.path.join(OUT, 'map-lines.svg')) // 1024, 'KB', len(supply), 'supply', len(setup), 'setup')
