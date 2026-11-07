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

# ---------- ground: drawn in the printed map's manner from its own colours (the scan, rotated to the board, is only measured) ----------
SCAN = os.environ.get('GOLAN_SCAN', 'docs/games/golan73/maps/ma_final.jpg')
scan = np.array(Image.open(SCAN).convert('RGB').rotate(90, expand=True).resize((W, H))).astype(np.float32)   # the print lies on the board one to one
sr, sg, sb = scan[..., 0], scan[..., 1], scan[..., 2]; sgray = 0.299 * sr + 0.587 * sg + 0.114 * sb; ssat = scan.max(2) - scan.min(2)
plain = land & ~wet & (sgray > 150) & (ssat < 80) & ~(sb - sr > 20); plain = nd.binary_erosion(plain, iterations=2)   # the print's paper and washes, not its lines or text
med = lambda sel, d: np.median(scan[sel].reshape(-1, 3), 0) if sel.sum() > 400 else np.array(d, np.float32)
bands = [(-400, -150), (-150, 0), (0, 150), (150, 350), (350, 600), (600, 900), (900, 1300), (1300, 3000)]; pal = []
for lo, hi in bands: pal.append(((lo + hi) / 2, med(plain & (h >= lo) & (h < hi) & (ids != 83), pal[-1][1] if pal else (215, 205, 165))))
zs = np.array([z for z, _ in pal]); cs = np.array([c for _, c in pal])
rng = np.random.default_rng(73)
hz = nd.gaussian_filter(h, 4) + nd.gaussian_filter(rng.standard_normal((H, W)), 12) * 35      # the washes follow the ground in soft patches
ground = np.stack([np.interp(hz, zs, cs[:, k]) for k in range(3)], -1)
HERMON = med(nd.binary_erosion(ids == 83, iterations=6) & (ssat > 20), (150, 120, 70))
ground = np.where((ids == 83)[..., None], HERMON * np.clip(shade, .75, 1.2)[..., None], ground)
stone = nd.gaussian_filter(rng.standard_normal((H, W)), 1.1) * 2.5                  # the paper's grain
img = ground + stone[..., None]
cont = np.zeros((H, W), bool)                                                        # the print's faint brown contour lines, every 50 m
for lev in range(-200, 2800, 50): cont |= (nd.gaussian_filter(h, 2) >= lev) & ~nd.binary_erosion(nd.gaussian_filter(h, 2) >= lev)
img = np.where((cont & land & (ids != 83))[..., None], img * 0.9 + np.array([150, 110, 70]) * 0.1, img)
BASALT = med(offmap & (ssat < 15) & (sgray < 170), (150, 148, 140))
MARGIN = tuple(med(~(land | offmap | wet) & (ssat > 40) & (sgray > 120) & (sgray < 190) & (sb < sr - 30), (183, 166, 104)).astype(int))   # the print's olive-khaki margin
WATER = tuple(med(wet & (sb - sr > 40), (143, 192, 230)).astype(int))
img = np.where(offmap[..., None], BASALT[None, None, :] + stone[..., None], img)
inside = land | offmap
img = np.where(inside[..., None], img, np.array(MARGIN, np.float32))
img = np.where(wet[..., None], np.array(WATER, np.float32), img)
speck = np.zeros((H, W), bool)
print('palette', [(int(z), c.astype(int).tolist()) for z, c in pal], 'hermon', HERMON.astype(int), 'basalt', BASALT.astype(int), 'margin', MARGIN, 'water', WATER)
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
flip = lambda cx, cy, body: f'<g data-flip="{cx:.1f} {cy:.1f}">{body}</g>'     # printed words the app turns round for the player across the table
for P in water:
    cx, cy = wcentre(P); big = Polygon(P).area > 40000
    lake_names.append(flip(cx, cy - 12 if big else cy, txt(cx, cy - 4, 'Sea of Galilee' if big else 'Lake Hula', 34 if big else 20, '#1d5f9a', 'stroke="#d8e8f3" stroke-width="3" paint-order="stroke"') +
                      ('' if big else txt(cx, cy + 18, '(drained)', 15, '#1d5f9a', 'stroke="#d8e8f3" stroke-width="3" paint-order="stroke"'))))
for P in leja: cx, cy = wcentre(P); lake_names.append(flip(cx - 6, cy - 9, txt(cx - 6, cy, 'The Leja', 26, '#3f3e3a', 'stroke="#c3c2bb" stroke-width="3" paint-order="stroke"')))

base = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
        f'<image id="ground" href="{ground_uri}" width="{W}" height="{H}" preserveAspectRatio="none"/>',
        '<g id="names">' + ''.join(lake_names) + '</g>',
        '<g id="assembly">' + ''.join(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#dce8ef" stroke="#fbfbf6" stroke-width="4"/>'
            f'<path d="M{x + 10} {y}H{x + w - 10}A10 10 0 0 1 {x + w} {y + 10}V{y + 34}H{x}V{y + 10}A10 10 0 0 1 {x + 10} {y}Z" fill="#2a8fc8"/>'
            f'<g data-flip="{x + w / 2} {y + 18}"><text x="{x + w / 2}" y="{y + 23}" text-anchor="middle" {font} font-weight="700" font-size="14" fill="#fff" textLength="{w - 22}" lengthAdjust="spacingAndGlyphs">{v["name"].upper()}</text></g>'
            f'<path d="M{x + w / 2 - 26} {y + h + 4}L{x + w / 2 + 26} {y + h + 4}L{x + w / 2} {y + h + 46}Z" fill="#2a8fc8" stroke="#fbfbf6" stroke-width="3" stroke-linejoin="round"/>'
            f'<g data-flip="{x + w / 2} {y + h + 20}"><text x="{x + w / 2}" y="{y + h + 28}" text-anchor="middle" {font} font-weight="700" font-size="24" fill="#fff">{k}</text></g>'
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
def arrow_label(d, text, off=20, size=13):                                          # the printed "1 MP" / "All MP's" beside its arrow, the way it reads on the map
    q = np.array(pts(d)); L = LineString(q); m = L.interpolate(.5, normalized=True); v = q[-1] - q[0]; v = v / (np.hypot(*v) or 1); n = np.array([-v[1], v[0]])
    if n[1] < 0: n = -n
    x, y = m.x + n[0] * off, m.y + n[1] * off
    lines = text.split('|'); cy = y + (len(lines) - 1) * (size + 2) / 2 - size * 0.35
    return f'<g stroke="none" data-flip="{x:.1f} {cy:.1f}">' + ''.join(f'<text x="{x:.1f}" y="{y + i * (size + 2):.1f}" text-anchor="middle" {font} font-weight="700" font-size="{size}" fill="#1d1d1b">{t}</text>' for i, t in enumerate(text.split('|'))) + '</g>'
def one_shaft(ds):                                                                   # the drawing has each shaft twice (a long and a short line from the same tail): keep one, so the dashes keep their rhythm
    out = []
    for d in ds:
        q = pts(d)
        if len(q) < 2: continue
        if any(np.hypot(q[0][0] - pts(o)[0][0], q[0][1] - pts(o)[0][1]) < 3 for o in out): continue
        out.append(d)
    return out
def purple(d, off=11):                                                              # the Purple Line runs beside the anti-tank ditch, on the Israeli side
    L = LineString(pts(d))
    if L.length < 5: return ''
    a, b = L.parallel_offset(off, 'left'), L.parallel_offset(off, 'right')
    mid = lambda G: np.mean([c[1] for c in (G.coords if G.geom_type == 'LineString' else [c for s in G.geoms for c in s.coords])])
    o = min([a, b], key=mid)                                                       # as printed: on the Syrian side (up the sheet, east)
    segs = [o] if o.geom_type == 'LineString' else list(o.geoms)
    return ''.join('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in s.coords) for s in segs if s.length > 4)
_one, _all = one_shaft(A['arrows1']), one_shaft(A['arrowsAll'])
arrow_labels = ''.join(arrow_label(d, '1 MP') for d in _one) + ''.join(arrow_label(d, "All MP's") if LineString(pts(d)).length > 60 else arrow_label(d, "All MP's|(Inf-class only)", off=-46) for d in _all)
lines = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
         g('shores', '', f'<g stroke="#3f86c4" stroke-width="4">{paths([poly(P) for P in water])}</g><g stroke="#6c6a62" stroke-width="7">{paths([poly(P) for P in leja])}</g>'),
         g('rivers', '', f'<g stroke="#4f8fc4" stroke-width="5.6">{paths(A["river"])}</g><g stroke="#9ccbee" stroke-width="3">{paths(A["river"])}</g>'),
         g('roads', '', f'<g stroke="#8d8a82" stroke-width="5">{paths(A["roads"])}</g><g stroke="#dedbd0" stroke-width="2.4">{paths(A["roads"])}</g>'),
         g('boundaries', 'stroke="#5e5a52" stroke-width="4"', paths(A['open'])),
         g('wadi', '', f'<g stroke="#a08868" stroke-width="7" stroke-opacity=".55">{paths(A["wadi"])}</g><g stroke="#4f4a42" stroke-width="3.4">{paths(A["wadi"])}</g>'),
         g('rugged', '', f'<g stroke="#7a6a52" stroke-width="12" stroke-linecap="butt" stroke-dasharray="1.2 2.6">{paths(A["rugged"])}</g><g stroke="#4f4a42" stroke-width="3.6">{paths(A["rugged"])}</g>'),
         g('escarpment', '', f'<g stroke="#b08a5c" stroke-width="22" stroke-opacity=".45">{paths(A["escarpment"])}</g><g stroke="#1d1d1b" stroke-width="3.6">{paths(A["escarpment"])}</g>'),
         g('at-ditch', '', f'<g stroke="#5f4630" stroke-width="13">{paths(A["atDitch"])}</g><g stroke="#9a7650" stroke-width="7">{paths(A["atDitch"])}</g>'),
         g('purple-line', 'stroke="#8e4f9f" stroke-width="2.4" stroke-dasharray="7 5"', ''.join(f'<path d="{purple(d)}"/>' for d in A['atDitch'])),
         g('sam-barrier', '', f'<g stroke="#2a72c0" stroke-width="3" stroke-dasharray="12 4 2 4">{paths(A["samBarrier"])}</g>'),
         g('sectors', '', f'<g stroke="#5e5a52" stroke-width="5">{paths(A["sector"])}</g><g stroke="#ffffff" stroke-width="1.8" stroke-linecap="butt" stroke-dasharray="5 4">{paths(A["sector"])}</g>'),
         g('hermon', 'stroke="#ffffff" stroke-width="3.2" stroke-dasharray="3 4"', paths(A['hermon'])),
         g('arrows', 'stroke="#1d1d1b" stroke-width="6"', f'<g stroke-linecap="butt" stroke-dasharray="4 4">{paths(one_shaft(A["arrows1"])) + paths(one_shaft(A["arrowsAll"]))}</g><g stroke="none">{heads}</g>' + arrow_labels),
         g('outline', 'stroke="#6c6a62" stroke-width="9"', paths(A['border'])),
         '</svg>']
open(os.path.join(OUT, 'map-lines.svg'), 'w').write('\n'.join(lines))
np.save(os.path.join(os.path.dirname(REAL), 'golan-ground.npy'), np.clip(img, 0, 255).astype(np.uint8))   # unshaded ground, for the 3D relief
print('board', W, H, os.path.getsize(os.path.join(OUT, 'map-base.svg')) // 1024, 'KB +', os.path.getsize(os.path.join(OUT, 'map-lines.svg')) // 1024, 'KB', len(supply), 'supply', len(setup), 'setup')
