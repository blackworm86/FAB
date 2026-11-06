"""Sicily board art in the series look (The Bulge's board, Golan's palette rules), from data/sicily/map.json + map_art.json and the real relief.

Usage: python3 -I tools/sicily/board.py data/sicily web/public/sicily <scratch>/real.npy
Writes map-base.svg: the sheet, the sea, one ground for the island (summer straw lowlands, olive and tan hills, the dark Nebrodi
and Madonie, Etna's lava cone) shaded by the real relief and speckled with maquis where the terrain is rough, the Italian mainland
("Exiting Axis Units"), the landing boxes (A, B and D, with their beach names and arrows), the port boxes with their damage boxes,
the four port cities, the anchors and the airfields. And map-lines.svg: the line work in the printed legend's styles drawn with The
Bulge's vocabulary (white area borders, cased roads, rivers, the coast, hachured restricted terrain, the dashed army boundaries).
Area numbers, names and VP symbols are printed at run time (labels.json). The unshaded ground is left in <scratch>/sicily-ground.npy for relief.py.
"""
import base64, io, json, os, re, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
from shapely.geometry import LineString, Point, Polygon

D, OUT, REAL = sys.argv[1:4]
M = json.load(open(os.path.join(D, 'map.json'))); A = json.load(open(os.path.join(D, 'map_art.json')))
W, H = [int(v) for v in M['size']]
os.makedirs(OUT, exist_ok=True)
poly = lambda P: 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in P) + 'Z'
paths = lambda ds, extra='': ''.join(f'<path d="{d}"{extra}/>' for d in ds if d)
pts = lambda d: [tuple(map(float, q.split(','))) for q in re.findall(r'-?[\d.]+,-?[\d.]+', d)]

# ---------- the series palette (The Bulge: margin #bccad3, borders #fbfbf6, roads #585b56 on #e4e6d8, rivers #1c78c0 in white; Golan's water 150,190,219) ----------
MARGIN = (188, 202, 211); SEA = np.array([132, 178, 212], np.float32); SHALLOW = np.array([168, 204, 226], np.float32)
PLAIN = np.array([226, 212, 162], np.float32); HILL = np.array([204, 188, 138], np.float32); MOUNT = np.array([150, 152, 110], np.float32); FOREST = np.array([136, 146, 104], np.float32)
LAVA = np.array([112, 106, 100], np.float32); SUMMIT = np.array([178, 172, 166], np.float32); OFFMAP = np.array([176, 178, 166], np.float32)
GROUP_COL = {'A': '#518f39', 'B': '#2589c5', 'D': '#137344', 'P': '#656567'}

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
coast = mask([pts(p) for p in A['coast']]) | land
islets = mask([pts(p) for p in A['islets']])
mainland = mask([pts(p) for p in A['mainland']])
ground_mask = coast | islets | mainland

# ---------- relief: real metres on the map grid ----------
h = nd.zoom(np.load(REAL), 2, order=1)[:H, :W]
hs = nd.gaussian_filter(h, 3.0)
gy, gx = np.gradient(hs)
shade = np.clip(1 + (-gx * 0.62 - gy * 0.78) / 70, 0.7, 1.18)                       # light from the upper left, as on a printed map, softly: the board is read, not admired
slope = np.hypot(gx, gy)

# ---------- ground: a July island, from the straw-coloured plains up to the dark ridges and Etna's lava ----------
hh = np.clip(h, 0, None)
w_hill = np.clip((hh - 120) / 500, 0, 1)[..., None]; w_mount = np.clip((hh - 900) / 700, 0, 1)[..., None]
ground = PLAIN * (1 - w_hill) + HILL * w_hill
ground = ground * (1 - w_mount) + MOUNT * w_mount
w_forest = np.clip((hh - 1000) / 400, 0, 1)[..., None] * (1 - nd.gaussian_filter((ids == 27).astype(np.float32), 6)[..., None])   # the Nebrodi and Madonie woods
ground = ground * (1 - w_forest * .7) + FOREST * w_forest * .7
etna = nd.gaussian_filter((ids == 27).astype(np.float32), 6)[..., None]
w_lava = np.clip((hh - 1500) / 900, 0, 1)[..., None] * etna; w_top = np.clip((hh - 2700) / 500, 0, 1)[..., None] * etna
ground = ground * (1 - w_lava) + LAVA * w_lava; ground = ground * (1 - w_top) + SUMMIT * w_top
rng = np.random.default_rng(43)
grain = nd.gaussian_filter(rng.standard_normal((H, W)), 0.7)                       # maquis and rock: dark specks, denser where the terrain is rough
speck = (grain > 2.2 - 0.4 * T) & land
stone = nd.gaussian_filter(rng.standard_normal((H, W)), 6) * 5
img = ground + stone[..., None]
img = np.where(speck[..., None], img * 0.74, img)
unshaded = img.copy()
img = img * shade[..., None]
# the sea: deeper blue away from the shore, a pale band along the coast
dsea = nd.distance_transform_edt(~ground_mask)
sea = SHALLOW * np.clip(1 - dsea / 14, 0, 1)[..., None] + SEA * np.clip(dsea / 14, 0, 1)[..., None]
img = np.where(ground_mask[..., None], img, sea)
img = np.where((mainland & ~land)[..., None], (OFFMAP + stone[..., None]) * np.clip(shade, .85, 1.12)[..., None], img)
buf = io.BytesIO(); Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(buf, 'JPEG', quality=86, optimize=True)
ground_uri = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
np.save(os.path.join(os.path.dirname(REAL), 'sicily-ground.npy'), np.clip(np.where(ground_mask[..., None], np.where((mainland & ~land)[..., None], OFFMAP + stone[..., None], unshaded), sea), 0, 255).astype(np.uint8))

# ---------- the printed items beside the areas: landing and port boxes with their arrows, cities, anchors, airfields, the mainland ----------
font = 'font-family="Saira Condensed, Arial Narrow, sans-serif"'
from xml.sax.saxutils import escape
def txt(x, y, s, size, fill, extra=''):
    attrs = {'text-anchor': 'middle', 'font-weight': '700'}
    for k in list(attrs):
        if k in extra: del attrs[k]                                                     # what `extra` sets wins; no attribute twice
    return f'<text x="{x:.1f}" y="{y:.1f}" {" ".join(f"{k}=\"{v}\"" for k, v in attrs.items())} {font} font-size="{size}" fill="{fill}" {extra}>{escape(s)}</text>'
AREA = {a['id']: Polygon(a['polygon']) for a in M['areas']}
def arrow(b):
    x0, y0, x1, y1 = b['rect']; c = Point((x0 + x1) / 2, (y0 + y1) / 2); P = AREA[b['area']]
    tgt = P.exterior.interpolate(P.exterior.project(c))                            # the nearest point of the area's shore
    v = np.array([tgt.x - c.x, tgt.y - c.y]); L = np.hypot(*v); n = v / L
    # leave the box at its edge
    t = min((abs(((x1 - x0) / 2) / n[0]) if n[0] else 9e9), (abs(((y1 - y0) / 2) / n[1]) if n[1] else 9e9)) + 3
    s = np.array([c.x, c.y]) + n * t; e = np.array([tgt.x, tgt.y]) - n * 6
    if np.hypot(*(e - s)) < 8: return ''
    head = e + n * 7; p = np.array([-n[1], n[0]])
    dash = ' stroke-dasharray="10 7"' if np.hypot(*(e - s)) > 240 else ''
    return (f'<path d="M{s[0]:.1f} {s[1]:.1f}L{e[0]:.1f} {e[1]:.1f}" fill="none" stroke="#fbfbf6" stroke-width="7" stroke-linecap="round"/>'
            f'<path d="M{s[0]:.1f} {s[1]:.1f}L{e[0]:.1f} {e[1]:.1f}" fill="none" stroke="#1d1d1b" stroke-width="3.2" stroke-linecap="round"{dash}/>'
            f'<path d="M{head[0]:.1f} {head[1]:.1f}L{(e - n * 8 + p * 8)[0]:.1f} {(e - n * 8 + p * 8)[1]:.1f}L{(e - n * 8 - p * 8)[0]:.1f} {(e - n * 8 - p * 8)[1]:.1f}Z" fill="#1d1d1b" stroke="#fbfbf6" stroke-width="2" stroke-linejoin="round"/>')
NAMES = {a['id']: a['name'] for a in M['areas']}
def box_svg(b):
    x0, y0, x1, y1 = b['rect']; w, hh_ = x1 - x0, y1 - y0; col = GROUP_COL[b['group']]; r = 7
    top = 24
    s = (f'<rect x="{x0}" y="{y0}" width="{w:.1f}" height="{hh_:.1f}" rx="{r}" fill="#e8eef2" stroke="#fbfbf6" stroke-width="3.5"/>'
         f'<path d="M{x0 + r} {y0}H{x1 - r}A{r} {r} 0 0 1 {x1} {y0 + r}V{y0 + top}H{x0}V{y0 + r}A{r} {r} 0 0 1 {x0 + r} {y0}Z" fill="{col}"/>')
    if b['kind'] == 'landing':
        s += txt(x0 + 19, y0 + 18, b['box'], 16, '#fff', 'text-anchor="start"') + (txt(x1 - 6, y0 + 18, b['name'], 13, '#fff', 'text-anchor="end" font-weight="600" font-style="italic"') if b.get('name') else '')
        s += txt((x0 + x1) / 2, y1 - 9, 'LANDING BOX', 9.5, '#5a6670', 'letter-spacing=".08em" font-weight="600"')
    else:
        s += txt(x0 + 19, y0 + 18, b['box'], 16, '#fff', 'text-anchor="start"') + txt(x1 - 6, y0 + 18, b['name'], 14, '#fff', 'text-anchor="end"')
        who = 'Axis control (6th Army)' if b['box'] == 'P4' else '8th Army only' if b['box'] in ('P1', 'P2') else '7th Army only'
        s += txt((x0 + x1) / 2, y1 - 20, 'PORT BOX', 9.5, '#5a6670', 'letter-spacing=".08em" font-weight="600"') + txt((x0 + x1) / 2, y1 - 7, who, 10, '#2b3137', 'font-weight="600"')
        if b.get('damage_box'):
            dx0, dy0, dx1, dy1 = b['damage_box']
            s += (f'<rect x="{dx0}" y="{dy0}" width="{dx1 - dx0:.1f}" height="{dy1 - dy0:.1f}" rx="5" fill="#dfe6ec" stroke="#fbfbf6" stroke-width="3" stroke-dasharray="6 4"/>'
                  + txt((dx0 + dx1) / 2, (dy0 + dy1) / 2 - 2, 'PORT', 9, '#5a6670', 'letter-spacing=".06em" font-weight="600"') + txt((dx0 + dx1) / 2, (dy0 + dy1) / 2 + 9, 'DAMAGE', 9, '#5a6670', 'letter-spacing=".06em" font-weight="600"'))
    return s + arrow(b)
anchor = lambda x, y: (f'<g transform="translate({x:.1f} {y:.1f})"><circle r="12" fill="#2f78c8" stroke="#fbfbf6" stroke-width="2.4"/>'
                       '<g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><circle cy="-6" r="2"/><path d="M0 -4V7M-5 -1H5M-7 3A7 7 0 0 0 7 3"/></g></g>')
airfield = lambda x, y, r: (f'<g transform="translate({x:.1f} {y:.1f})"><circle r="{r:.1f}" fill="#f3e23f" stroke="#fbfbf6" stroke-width="2.4"/>'
                            f'<g transform="scale({r / 16:.3f})" fill="#2b2a26"><path d="M-1.6 -11h3.2l1 7 8.5 4.5v2.6l-8.5-2.2-.5 5.5 3 2v1.8L0 9.5l-5.2 .7V8.4l3-2-.5-5.5-8.5 2.2V.5l8.5-4.5z"/></g></g>')
cityd = lambda d: f'<path d="{d}" fill="#3b3a36" stroke="#fbfbf6" stroke-width="2.2" stroke-linejoin="round"/>'
ML = M['mainland']; mlc = ML['label']
base = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
        f'<image id="ground" href="{ground_uri}" width="{W}" height="{H}" preserveAspectRatio="none"/>',
        '<g id="names">' + txt(mlc[0] + 40, mlc[1] - 150, 'ITALIAN', 22, '#3f3e3a', 'stroke="#d8dad2" stroke-width="3" paint-order="stroke" font-style="italic"')
        + txt(mlc[0] + 40, mlc[1] - 126, 'MAINLAND', 22, '#3f3e3a', 'stroke="#d8dad2" stroke-width="3" paint-order="stroke" font-style="italic"')
        + txt(mlc[0] + 40, mlc[1] - 100, 'Exiting Axis units', 15, '#3f3e3a', 'stroke="#d8dad2" stroke-width="3" paint-order="stroke" font-weight="600"')
        + txt(1200, 1630, 'SICILY', 30, '#1d5f9a', 'stroke="#d8e8f3" stroke-width="3" paint-order="stroke" font-style="italic" letter-spacing=".3em"') + '</g>',
        '<g id="boxes">' + ''.join(box_svg(b) for b in A['boxes']) + '</g>',
        '<g id="cities">' + ''.join(cityd(c['d']) for c in A['cities']) + '</g>',
        '<g id="ports">' + ''.join(anchor(p['x'], p['y']) for p in A['port_symbols']) + '</g>',
        '<g id="airfields">' + ''.join(airfield(a['x'], a['y'], a['r']) for a in A['airfields']) + '</g>',
        '</svg>']
open(os.path.join(OUT, 'map-base.svg'), 'w').write('\n'.join(base))

# ---------- line work: the printed legend, in The Bulge's hand ----------
g = lambda gid, attrs, body: f'<g id="{gid}" fill="none" stroke-linecap="round" stroke-linejoin="round" {attrs}>{body}</g>'
exit_arrows = ''
mess = AREA[M['mainland']['exit_from']]; mp = Polygon(pts(A['mainland'][0]))
for k in range(3):                                                                  # three white arrows from Messina to the mainland, as printed
    s = mess.exterior.interpolate(0.52 + k * 0.03, normalized=True); t = mp.exterior.interpolate(mp.exterior.project(s))
    v = np.array([t.x - s.x, t.y - s.y]); n = v / np.hypot(*v); p = np.array([-n[1], n[0]]); e = np.array([t.x, t.y]) - n * 4; st = np.array([s.x, s.y]) + n * 4
    exit_arrows += f'<path d="M{st[0]:.1f} {st[1]:.1f}L{e[0]:.1f} {e[1]:.1f}"/><path d="M{(e + n * 6)[0]:.1f} {(e + n * 6)[1]:.1f}L{(e - n * 6 + p * 6)[0]:.1f} {(e - n * 6 + p * 6)[1]:.1f}L{(e - n * 6 - p * 6)[0]:.1f} {(e - n * 6 - p * 6)[1]:.1f}Z" fill="#fbfbf6"/>'
lines = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
         g('shores', '', f'<g stroke="#fbfbf6" stroke-width="5">{paths(A["coast"] + A["islets"] + A["mainland"])}</g><g stroke="#1c78c0" stroke-width="2.2">{paths(A["coast"] + A["islets"] + A["mainland"])}</g>'),
         g('boundaries', 'stroke="#fbfbf6" stroke-width="2.8"', paths(A['open'])),
         g('restricted', '', f'<g stroke="#5b4630" stroke-width="15" stroke-linecap="butt" stroke-dasharray="1.4 3.2" stroke-opacity=".85">{paths(A["restricted"])}</g><g stroke="#fbfbf6" stroke-width="6">{paths(A["restricted"])}</g><g stroke="#3b2f22" stroke-width="3.2">{paths(A["restricted"])}</g>'),
         g('rivers', '', f'<g stroke="#fff" stroke-width="6">{paths(A["river"])}</g><g stroke="#1c78c0" stroke-width="3">{paths(A["river"])}</g>'),
         g('roads', '', f'<g stroke="#e4e6d8" stroke-opacity=".85" stroke-width="4.4">{paths(A["roads"])}</g><g stroke="#585b56" stroke-width="1.7">{paths(A["roads"])}</g>'),
         g('army-boundaries', '', f'<g stroke="#fbfbf6" stroke-width="6">{paths(A["army_boundary"])}</g><g stroke="#2b2a26" stroke-width="3" stroke-linecap="butt" stroke-dasharray="9 7">{paths(A["army_boundary"])}</g>'),
         g('exit', 'stroke="#fbfbf6" stroke-width="3.4"', exit_arrows),
         g('outline', 'stroke="#fbfbf6" stroke-width="4.6"', paths(A['border'] + A['frame_small'])),
         '</svg>']
open(os.path.join(OUT, 'map-lines.svg'), 'w').write('\n'.join(lines))
print('board', W, H, os.path.getsize(os.path.join(OUT, 'map-base.svg')) // 1024, 'KB +', os.path.getsize(os.path.join(OUT, 'map-lines.svg')) // 1024, 'KB', len(A['boxes']), 'boxes')
