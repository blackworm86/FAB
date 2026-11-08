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
shade = 1 + (shade - 1) * 0.7                                                         # a soft modelling of the plateau
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
herm = ids == 83                                                                     # Mt Hermon as printed: stepped olive-brown height bands, darker towards the summit
hq = np.percentile(h[herm], [22, 45, 65, 82]) if herm.any() else [0, 0, 0, 0]
HBANDS = np.array([(152, 124, 54), (128, 104, 44), (110, 90, 36), (97, 79, 31), (84, 69, 26)], np.float32)
hb = np.digitize(nd.gaussian_filter(h, 3), hq)
hcol = nd.gaussian_filter(HBANDS[hb], (1.2, 1.2, 0))
ground = np.where(herm[..., None], hcol, ground)
yy_, xx_ = np.mgrid[0:H, 0:W]; nolab = np.ones((H, W), bool)
for a in M['areas']: x_, y_ = a['label']; nolab &= ((xx_ - x_) / 22) ** 2 + ((yy_ - y_) / 20) ** 2 > 1     # the printed TDN badges and symbols are not tels
tel = land & nolab & (sr - sb > 70) & (sr > 170) & (sg > 110) & (sg < 185); tel = nd.binary_opening(tel, iterations=2)
lab_, n_ = nd.label(tel); big = np.zeros(n_ + 1, bool); big[1:] = np.array(nd.sum(tel, lab_, range(1, n_ + 1))) >= 300; tel = big[lab_]
TEL = med(tel, (188, 155, 93)); tsoft = nd.gaussian_filter(nd.binary_closing(tel, iterations=3).astype(np.float32), 2.0)[..., None]   # the tels (volcanic cones) where the print has them, in its orange-brown
ground = ground * (1 - tsoft * .9) + TEL * tsoft * .9
tg = nd.gaussian_filter(tsoft[..., 0], 3); ty, tx = np.gradient(tg)                  # the tels as mounds: lit on the upper left, shaded on the lower right, as printed
ground = ground * (1 + np.clip((-tx - ty) * 9, -0.16, 0.12))[..., None]
# the Jordan and Hula valley below the escarpment: the print's pale mint, deepening with depth
MINT = np.array([222, 231, 203], np.float32); vdep = np.clip((200 - nd.gaussian_filter(h, 6)) / 200, 0, 1) ** 0.8
vdep = vdep * (1 + nd.gaussian_filter(rng.standard_normal((H, W)), 14) * 0.35); vdep = np.clip(vdep, 0, 1)[..., None] * land[..., None]
ground = ground * (1 - vdep * 0.9) + MINT * vdep * 0.9
# the escarpment: a broad soft brown shading on its downhill side, as printed (not only a halo along the line)
escl = np.zeros((H, W), np.uint8); _d = ImageDraw.Draw(Image.fromarray(escl))
_im = Image.new('L', (W, H), 0); _dd = ImageDraw.Draw(_im)
for dpath in A['escarpment']:
    q = pts(dpath)
    if len(q) > 1: _dd.line(q, fill=1, width=3)
escl = np.array(_im) > 0
dE, (eiy, eix) = nd.distance_transform_edt(~escl, return_indices=True)
below = nd.gaussian_filter(h, 2) < h[eiy, eix] - 8
band = np.clip(1 - dE / 70, 0, 1) ** 1.3 * below * land
band = nd.gaussian_filter(band.astype(np.float32), 3)[..., None]
ground = ground * (1 - band * 0.7) + np.array([170, 134, 86], np.float32) * band * 0.7
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
def triangle(e, side=40):
    x, y = e['x'], e['y']; n = inward(x, y); t = np.array([-n[1], n[0]])
    c = np.array([x, y]) + n * side * 0.23                                           # as printed: the map edge crosses the triangle a quarter of the way from its base
    marks.append({'letter': e['letter'], 'x': round(float(c[0] - n[0] * 6), 1), 'y': round(float(c[1] - n[1] * 6 + 2), 1)})
    tip = c + n * side * 0.5; b1 = c - n * side * 0.5 + t * side * 0.58; b2 = c - n * side * 0.5 - t * side * 0.58
    xs, ys = [tip[0], b1[0], b2[0]], [tip[1], b1[1], b2[1]]
    return (f'<g data-float="{min(xs) - 4:.1f} {min(ys) - 4:.1f} {max(xs) - min(xs) + 8:.1f} {max(ys) - min(ys) + 8:.1f}" fill="#91a763" stroke="#5f7a3c" stroke-width="2" stroke-linejoin="round">'
            f'<path d="M{tip[0]:.1f} {tip[1]:.1f}L{b1[0]:.1f} {b1[1]:.1f}L{b2[0]:.1f} {b2[1]:.1f}Z"/></g>')
mute = lambda c: '#%02x%02x%02x' % tuple(int(int(c[i:i + 2], 16) * 0.62 + v * 0.38) for i, v in ((1, 168), (3, 160), (5, 132))) if re.match(r'#[0-9a-fA-F]{6}$', c) else c   # the print's set-up tanks are muted, small glyphs, not bright toys
tank = lambda x, y, col: (f'<g transform="translate({x:.1f} {y:.1f}) scale(.44)" fill="{mute(col)}" stroke="#3a3830" stroke-width="2.2" stroke-linejoin="round">'      # the alternate set-up tanks, in the division's colour
                          '<rect x="-24" y="2" width="48" height="11" rx="5.5"/><path d="M-20 2L-15 -6H17L22 2Z"/><path d="M-8 -6V-12H9L11 -6Z"/><path d="M9 -10H30" fill="none" stroke-width="3.4"/></g>')
font = 'font-family="Saira Condensed, Arial Narrow, sans-serif"'
txt = lambda x, y, s, size, fill, extra='': f'<text x="{x:.0f}" y="{y:.0f}" text-anchor="middle" font-family="Crimson Pro, Times New Roman, serif" font-style="italic" font-weight="600" font-size="{size}" fill="{fill}" {extra}>{s}</text>'   # the print's water and basalt names: a quiet serif italic
wcentre = lambda P: (np.mean([p[0] for p in P]), np.mean([p[1] for p in P]))
lake_names = []
flip = lambda cx, cy, body: f'<g data-flip="{cx:.1f} {cy:.1f}">{body}</g>'     # printed words the app turns round for the player across the table
for P in water:
    cx, cy = wcentre(P); big = Polygon(P).area > 40000
    lake_names.append(flip(cx, cy - 12 if big else cy, txt(cx, cy - 4, 'Sea of Galilee' if big else 'Lake Hula', 22 if big else 15, '#2c6e9e', 'stroke="#cfe3f1" stroke-width="2" paint-order="stroke"') +
                      ('' if big else txt(cx, cy + 13, '(drained)', 11, '#2c6e9e', 'stroke="#cfe3f1" stroke-width="2" paint-order="stroke"'))))
for P in leja: cx, cy = wcentre(P); lake_names.append(flip(cx - 6, cy - 9, txt(cx - 6, cy, 'The Leja', 19, '#3f3e3a', 'stroke="#b9b8b1" stroke-width="2" paint-order="stroke"')))

base = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
        f'<image id="ground" href="{ground_uri}" width="{W}" height="{H}" preserveAspectRatio="none"/>',
        '<g id="names">' + ''.join(lake_names) + '</g>',
        '<g id="setup">' + ''.join(tank(x, y, c) for x, y, c in setup) + '</g>',
        '<g id="supply">' + ''.join(f'<g transform="translate({x:.1f} {y:.1f})"><circle r="13" fill="#fbfbf6"/><path d="M0 -11A11 11 0 0 0 0 11Z" fill="#1d5fa8"/>'
                                     f'<circle r="11" fill="none" stroke="#1d5fa8" stroke-width="2"/></g>' for x, y in supply) + '</g>',
        '</svg>']
open(os.path.join(OUT, 'map-base.svg'), 'w').write('\n'.join(base))

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
_one, _all = one_shaft(A['arrows1']), [d for d in one_shaft(A['arrowsAll']) if LineString(pts(d)).length > 60]
HERMON_ARROW = 'M190,634L262,606'                                                    # the drawing's Hermon arrow is a stub: drawn where the print has it, from the mountain to Majdal Shams
def head(tip, d, L=21, w=7.5):
    n = np.array([-d[1], d[0]]); b = tip - d * L
    q = [tip, b + n * w, tip - d * L * 0.72, b - n * w]
    return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in q) + 'Z'
def arrow(d, both, text, off=20):
    q = np.array(pts(d)); u = lambda a, b: (b - a) / (np.hypot(*(b - a)) or 1)
    e1, e0 = u(q[-2], q[-1]), u(q[1], q[0]); s = q.copy(); s[-1] = s[-1] - e1 * 15
    if both: s[0] = s[0] - e0 * 15
    shaft = 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in s)
    heads = head(q[-1], e1) + (head(q[0], e0) if both else '')
    lab = arrow_label(d, text, off)
    xs, ys = q[:, 0], q[:, 1]; lx, ly = [float(v) for v in re.findall(r'data-flip="(-?[\d.]+) (-?[\d.]+)"', lab)[0]]
    x0, x1, y0, y1 = min(xs.min(), lx - 40) - 14, max(xs.max(), lx + 40) + 14, min(ys.min(), ly - 22) - 14, max(ys.max(), ly + 22) + 14
    return (f'<g data-float="{x0:.1f} {y0:.1f} {x1 - x0:.1f} {y1 - y0:.1f}"><path d="{shaft}" fill="none" stroke="#1d1d1b" stroke-width="4.6" stroke-linecap="butt" stroke-dasharray="3.6 3.4"/>'
            f'<path d="{heads}" fill="#1d1d1b"/>{lab}</g>')
arrows_svg = ''.join(arrow(d, False, '1 MP') for d in _one) + ''.join(arrow(d, True, "All MP's") for d in _all) + arrow(HERMON_ARROW, True, "All MP's|(Inf-class only)", off=-40)
def assembly_box(k, x, y, w, h):                                                     # as printed: pale blue, a dark edge, the blue title band, the letter triangle astride the bottom edge
    cx = x + w / 2; ty = y + h
    return (f'<g data-float="{x - 6} {y - 6} {w + 12} {h + 40}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5" fill="#c8e2f5" stroke="#2b2c2e" stroke-width="2.4"/>'
            f'<path d="M{x + 1.2} {y + 30}V{y + 5}A4 4 0 0 1 {x + 5} {y + 1.2}H{x + w - 5}A4 4 0 0 1 {x + w - 1.2} {y + 5}V{y + 30}Z" fill="#4f9fd6"/>'
            f'<g data-flip="{cx} {y + 16}"><text x="{cx}" y="{y + 21}" text-anchor="middle" {font} font-weight="700" font-size="15" fill="#fff">{M["assembly"][k]["name"]}</text></g>'
            f'<path d="M{cx} {ty - 22}L{cx + 22} {ty + 16}H{cx - 22}Z" fill="#4f9fd6" stroke="#eaf3fa" stroke-width="2" stroke-linejoin="round"/>'
            f'<g data-flip="{cx} {ty + 3}"><text x="{cx}" y="{ty + 11}" text-anchor="middle" {font} font-weight="700" font-size="20" fill="#fff">{k}</text></g></g>')
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
         g('sam-barrier', '', f'<g stroke="#eef4f6" stroke-width="6.5" stroke-opacity=".9">{paths(A["samBarrier"])}</g><g stroke="#2a72c0" stroke-width="3.2" stroke-linecap="butt" stroke-dasharray="6 5">{paths(A["samBarrier"])}</g>'),   # as printed: short blue dashes on a pale casing
         g('sectors', '', f'<g stroke="#5e5a52" stroke-width="5">{paths(A["sector"])}</g><g stroke="#ffffff" stroke-width="1.8" stroke-linecap="butt" stroke-dasharray="5 4">{paths(A["sector"])}</g>'),
         g('hermon', '', f'<g stroke="#8a8476" stroke-width="7">{paths(A["hermon"])}</g><g stroke="#f3eee0" stroke-width="3.6" stroke-dasharray="0.1 6.4">{paths(A["hermon"])}</g>'),
         g('outline', 'stroke="#6c6a62" stroke-width="9"', paths(A['border'])),
         '<g id="assembly">' + ''.join(assembly_box(k, *v['box']) for k, v in M['assembly'].items()) + '</g>',
         '<g id="entries">' + ''.join(triangle(e) for e in M['entries']) + '</g>',
         '<g id="arrows">' + arrows_svg + '</g>',
         '</svg>']
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')); from hatch import convert as hatch_free   # no <pattern> in a board file: see tools/hatch.py
open(os.path.join(OUT, 'map-lines.svg'), 'w').write(hatch_free('\n'.join(lines)))
json.dump(marks, open(os.path.join(D, 'entry_marks.json'), 'w'))                      # where the run-time letters go: in the triangles

np.save(os.path.join(os.path.dirname(REAL), 'golan-ground.npy'), np.clip(img, 0, 255).astype(np.uint8))   # unshaded ground, for the 3D relief
print('board', W, H, os.path.getsize(os.path.join(OUT, 'map-base.svg')) // 1024, 'KB +', os.path.getsize(os.path.join(OUT, 'map-lines.svg')) // 1024, 'KB', len(supply), 'supply', len(setup), 'setup')
