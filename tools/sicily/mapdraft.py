# FAB: Sicily map draft: the areas traced on the module's map (segment.py), adjacency from shared edges, and the
# values read off the map by hand (tables below, each checked against the printed map scan and the Sunrise Bridge
# map of the player aids). The detectors only back the hand tables up: any disagreement is printed.
# Usage: python3 -I mapdraft.py <zones.json> <labels.png> <map image> <out map_vassal.json>
import json, sys
import cv2, numpy as np
from shapely.geometry import Polygon
from shapely.ops import polylabel

Z = json.load(open(sys.argv[1])); lab = cv2.imread(sys.argv[2], 0).astype(np.int32); im = cv2.imread(sys.argv[3])
H, W = lab.shape
ZA = {a['id']: a for a in Z['areas']}

# ---- hand-read tables ---------------------------------------------------------------------------------------
# TDN from the area-number plate (legend: circle 0, square 1, hexagon 2, triangle 3). Same on the printed scan.
TDN = {0: [1, 2, 4, 5, 8, 9, 10, 13, 14, 19, 20, 41, 42, 52, 53, 58, 60, 61, 63, 64, 65],
       1: [3, 7, 11, 12, 15, 16, 17, 18, 21, 23, 24, 25, 39, 40, 43, 44, 48, 49, 51, 54, 56, 57, 59, 62],
       2: [6, 22, 26, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 45, 46, 47, 50, 55],
       3: [27]}
tdn = {a: t for t, ids in TDN.items() for a in ids}
NAME_FIX = {1: 'Pachino', 27: 'Mount Etna', 47: 'Cefalù'}         # as printed on the map (Vassal: "Pachino ", "Mt. Etna", "Cefalú")
ALLIED_VP = {28: 1, 30: 1, 29: 3}                                 # black crosses ("Allied VP Space"); Messina has three
GERMAN_VP = {5: 1, 57: 1, 65: 1}                                  # white star on blue disc ("German VP Space")
MUTUAL_VP = [15, 18, 26, 45, 49]                                  # yellow star on red pentagon ("Mutual VP Space")
AIRFIELD = [18, 26, 65]                                           # yellow airfield disc (3 slots on the Captured Airfields chart)
PORT = {5: 'P1', 26: 'P2', 57: 'P3', 29: 'P4'}                    # anchor + port box
EXIT_AXIS = [29]                                                  # "Exiting Axis Units" arrows, Messina to the mainland
# plate centres (printed area number), read where the matcher in the review step missed them
PLATE_FIX = {1: [2405, 1882], 2: [2245, 1895], 5: [2577, 1673], 8: [2015, 1858], 13: [2453, 1402], 29: [2822, 303]}
# road crossings (checked edge by edge on the Vassal map, the printed scan and, for the south-east, the Sunrise Bridge map)
ROAD = set('''1/2 1/4 2/7 4/5 5/6 5/13 6/12 7/9 9/19 11/12 11/17 13/14 14/26 17/22 18/19 18/22 19/20 20/41 22/38 24/25 24/35
 24/38 25/33 26/27 27/28 27/33 28/29 28/30 29/30 30/31 30/32 31/34 32/33 33/35 34/36 35/36 35/37 36/47 37/46 38/45 40/41
 40/42 40/45 41/42 42/43 42/52 43/52 44/46 44/48 45/46 46/48 47/48 48/49 48/50 49/50 49/56 50/51 50/54 51/52 51/53 53/60
 54/55 55/56 56/57 57/58 58/59 58/62 59/60 60/61 61/65 62/64 64/65'''.split())
# where the crossing detector disagrees and the edge was settled by eye (missed thin roads; 43/44 and 44/51: road
# beside the 43/44/51 river junction that does not cross)
ROAD_SEEN = set('2/7 6/12 17/22 30/31 32/33 35/36 37/46 43/44 44/46 44/48 44/51 50/54 55/56'.split())
ROAD_AT_FIX = {'35/36': [1771, 716], '37/46': [1541, 806]}   # crossing spots placed by hand
RIVER = set('''12/15 14/15 14/26 15/26 16/26 20/41 21/40 37/46 38/45 38/46 39/40 39/45 43/44 43/51 44/45 44/48 48/49 48/50
 51/52 51/53 51/54 53/60 54/59 54/60 60/61'''.split())
RESTRICTED = set('26/27 27/28 27/30 27/32 27/33 31/32 33/34'.split())    # hachured "Restricted Terrain Boundary"
# army (zone) boundaries: the dashed line, plus the rivers it follows (no dashes are drawn on a river)
ARMY_DASHED = set('2/7 2/8 3/7 6/7 6/11 11/12 11/15 15/16 24/35 25/26 25/33 27/30 27/32 27/33 28/30 36/47 37/38'.split())
ARMY_RIVER = set('16/26 37/46 38/46 38/45 39/45 39/40 21/40 20/41'.split())
ZONE_SEED = {'A': 19, 'B': 5, 'C': 35, 'D': 57}                   # zone letters printed beside the dashed line
ZONE_UNSURE = [29]                                                # Messina touches B (28) and C (30) with no zone line
# landing boxes: box -> area the printed arrow points at
BEACH = {'A1': (20, 'Joss'), 'A2': (19, 'Dime'), 'A3': (9, 'Cent North'), 'A4': (8, 'Cent South'), 'B1': (2, 'Bark West'),
         'B2': (1, 'Bark South & East'), 'B3': (4, 'Acid South'), 'B4': (5, 'Acid North'), 'B5': (13, 'Ladbroke'),
         'B6': (14, 'Fustian'), 'D1': (56, ''), 'D2': (57, ''), 'D3': (58, ''), 'D4': (63, ''), 'D5': (64, ''), 'D6': (65, ''),
         'D7': (61, ''), 'D8': (60, ''), 'D9': (53, ''), 'D10': (51, ''), 'D11': (52, ''), 'D12': (42, ''), 'D13': (41, '')}
PORT_BOX = {'P1': ('Syracuse', 5, 'Allied Control Required (8th Army only)', 'Syracuse Damage'),
            'P2': ('Catania', 26, 'Allied Control Required (8th Army only)', 'Catania Damage'),
            'P3': ('Palermo', 57, 'Allied Control Required (7th Army only)', 'Palermo Damage'),
            'P4': ('Messina', 29, 'Axis Control Required (6th Army only)', None)}
# Sunrise Bridge scenario map (player aids p. 9): areas in play, and the red number squares printed on it
SUNRISE_AREAS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17, 25, 26]
SUNRISE_RED = {5: 2, 6: 1, 7: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 2, 17: 1, 25: 3, 26: 4}   # 10 and 17: square cut by the page edge
# turn track as printed: dates, Admin Phase asset/event draw "1st/2nd" (Allied, Axis), net VPs "Allied/Axis"
TURNS = [(1, 'July 10-11', '0/0', '0/0', None), (2, 'July 12-13', '11/5*', '10/5', None), (3, 'July 14-15', '11/5*', '10/5', None),
         (4, 'July 16-17', '11/5*', '9/5', '2/8'), (5, 'July 18-19', '11/5*', '8/4', '3/7'), (6, 'July 20-22', '11/5*', '7/4', '4/6'),
         (7, 'July 23-25', '11/5*', '6/3', '5/5'), (8, 'July 26-28', '11/5*', '5/3', '6/4'), (9, 'July 29-31', '11/5*', '4/2', '7/3')]
TURN_NOTE = '* +1 for each Allied controlled and undamaged port each Admin Phase'
# printed boxes with no Vassal zone
EXTRA_BOXES = [{'name': 'Axis Selection Cup (grey mug)', 'kind': 'selection_cup', 'rect': [1585, 360, 1765, 530], 'vassal_zone': False},
               {'name': 'Exiting Axis Units (mainland)', 'kind': 'axis_exit', 'rect': [2880, 0, 3332, 720], 'vassal_zone': False}]
MIN_EDGE = 30   # px of shared edge; below that the two areas only meet at a corner

# ---- geometry from the label image --------------------------------------------------------------------------
areas = {}
for a in range(1, 66):
    m = (lab == a).astype(np.uint8)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    poly = cv2.approxPolyDP(c, 1.5, True)[:, 0, :].astype(float)
    P = Polygon(poly).buffer(0)
    if P.geom_type != 'Polygon': P = max(P.geoms, key=lambda g: g.area)
    areas[a] = {'poly': [[round(x, 1), round(y, 1)] for x, y in P.exterior.coords][:-1], 'label': polylabel(P, 1.0)}
cnt, coast = {}, {}
for dy, dx in [(0, 1), (1, 0)]:
    p, q = lab[:H - dy, :W - dx], lab[dy:, dx:]
    m = (p != q)
    for x, y in zip(p[m], q[m]):
        x, y = int(x), int(y)
        if x and y: k = (min(x, y), max(x, y)); cnt[k] = cnt.get(k, 0) + 1
        else: k = max(x, y); coast[k] = coast.get(k, 0) + 1
pairs = sorted(k for k, n in cnt.items() if n >= MIN_EDGE)
corners = sorted(k for k, n in cnt.items() if n < MIN_EDGE)

# ---- detectors (evidence only) --------------------------------------------------------------------------------
B_, G_, R_ = [im[..., i].astype(int) for i in range(3)]
mx = np.maximum(np.maximum(B_, G_), R_); mn = np.minimum(np.minimum(B_, G_), R_); sat = mx - mn; mean = (B_ + G_ + R_) / 3
blue = ((B_ > R_ + 40) & (B_ > 120)).astype(np.uint8)
sea = cv2.morphologyEx(blue, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
riverN = cv2.dilate(blue & (1 - cv2.dilate(sea, np.ones((9, 9), np.uint8))), np.ones((9, 9), np.uint8)).astype(bool)
dashN = cv2.dilate(((sat <= 12) & (mean >= 238)).astype(np.uint8), np.ones((13, 13), np.uint8)).astype(bool)
road = ((sat <= 24) & (mean >= 125) & (mean <= 237)).astype(np.uint8)            # grey-cased light road line
linem = cv2.morphologyEx(((mean < 140) & (sat < 40)).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) | ((sat <= 12) & (mean >= 238)).astype(np.uint8)
road[cv2.dilate(linem, np.ones((7, 7), np.uint8)) > 0] = 0
road[cv2.dilate((lab == 0).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0] = 0
def detect(a, b):
    ma, mb = (lab == a).astype(np.uint8), (lab == b).astype(np.uint8)
    seam = cv2.dilate(ma, np.ones((3, 3), np.uint8)).astype(bool) & (mb > 0)
    ys, xs = np.nonzero(seam); x0, x1, y0, y1 = max(xs.min() - 40, 0), min(xs.max() + 40, W), max(ys.min() - 40, 0), min(ys.max() + 40, H)
    sl = (slice(y0, y1), slice(x0, x1)); s = seam[sl]
    ds = cv2.distanceTransform((~s).astype(np.uint8), cv2.DIST_L2, 5)
    def approaches(m, dmin=13, dmax=22):        # road strands leaving the seam on one side
        rd = (road[sl] > 0) & (ds <= 30) & (m[sl] > 0) & (ds >= 3)
        k, cc, st, _ = cv2.connectedComponentsWithStats(rd.astype(np.uint8), connectivity=8); pts = []
        for i in range(1, k):
            if st[i, 4] < 15: continue
            c = cc == i; d = ds[c]
            if d.min() <= dmin and d.max() >= dmax:
                yy, xx = np.nonzero(c & (ds <= d.min() + 5)); pts.append((xx.mean(), yy.mean()))
        return pts
    pair = lambda pa, pb, r: [[int((xa + xb) / 2 + x0), int((ya + yb) / 2 + y0)] for xa, ya in pa for xb, yb in pb if (xa - xb) ** 2 + (ya - yb) ** 2 <= r * r]
    roads = pair(approaches(ma), approaches(mb), 30)
    loose = pair(approaches(ma, 20, 16), approaches(mb, 20, 16), 45)     # fallback spot for crossings settled by eye
    spot = loose[0] if loose else None
    return {'river': float(riverN[seam].mean()), 'dash': float(dashN[seam].mean()), 'roads': roads, 'spot': spot, 'mid': [int(xs.mean()), int(ys.mean())]}

# ---- zones (flood fill over edges that are not army boundaries) ---------------------------------------------
key = lambda a, b: '%d/%d' % (a, b)
ARMY = ARMY_DASHED | ARMY_RIVER
nbr = {a: set() for a in range(1, 66)}
for a, b in pairs:
    if key(a, b) not in ARMY: nbr[a].add(b); nbr[b].add(a)
zone = {}
for z, seed in ZONE_SEED.items():
    todo = [seed]
    while todo:
        a = todo.pop()
        if a in zone or a in ZONE_UNSURE: continue
        zone[a] = z; todo += list(nbr[a])

# ---- assemble -----------------------------------------------------------------------------------------------
warn = []
conns = []
for a, b in pairs:
    k = key(a, b); d = detect(a, b)
    if (d['river'] >= 0.6) != (k in RIVER): warn.append('river %s detector %.2f' % (k, d['river']))
    if (d['dash'] >= 0.5) != (k in ARMY_DASHED): warn.append('dash %s detector %.2f' % (k, d['dash']))
    if bool(d['roads']) != (k in ROAD) and k not in ROAD_SEEN: warn.append('road %s detector %s' % (k, d['roads']))
    typ = 'road' if k in ROAD else 'field'
    conns.append({'a': a, 'b': b, 'type': typ, 'mp': 1 if typ == 'road' else 2, 'river': k in RIVER, 'restricted': k in RESTRICTED,
                  'army_boundary': k in ARMY, 'zones': '/'.join(sorted({zone.get(a, '?'), zone.get(b, '?')})) if k in ARMY else None,
                  'length': cnt[(a, b)], 'mid': d['mid'], 'road_at': ([ROAD_AT_FIX[k]] if k in ROAD_AT_FIX else d['roads'] or ([d['spot']] if d['spot'] else [])) if k in ROAD else []})
for k in ROAD | RIVER | RESTRICTED | ARMY:
    if tuple(map(int, k.split('/'))) not in pairs: warn.append('table edge %s is not a shared edge' % k)
beach_of = {}
for box, (ar, nm) in BEACH.items(): beach_of.setdefault(ar, []).append(box)
# plate (printed area number) position: best match of the four legend plates inside the area; also checks TDN
TPL = {0: (705, 538), 1: (431, 608), 2: (838, 598), 3: (2376, 772)}       # plates 58, 62, 55, 27
R = 15
plates = {}
for a in range(1, 66):
    if a in PLATE_FIX: plates[a] = PLATE_FIX[a]; continue
    ys, xs = np.nonzero(lab == a); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    sub = im[y0:y1 + 1, x0:x1 + 1]
    inside = cv2.erode((lab[y0:y1 + 1, x0:x1 + 1] == a).astype(np.uint8), np.ones((R + 1, R + 1), np.uint8))[R:-R, R:-R]
    best = None
    for t, (x, y) in TPL.items():
        r = cv2.matchTemplate(sub, im[y - R:y + R + 1, x - R:x + R + 1], cv2.TM_CCOEFF_NORMED)
        r = np.where(inside[:r.shape[0], :r.shape[1]] > 0, r, -1); j = np.unravel_index(r.argmax(), r.shape)
        if best is None or r[j] > best[0]: best = (r[j], t, [int(j[1] + x0 + R), int(j[0] + y0 + R)])
    plates[a] = best[2]
    if best[1] != tdn[a]: warn.append('plate %d looks like TDN %d (table %d)' % (a, best[1], tdn[a]))
out_areas = []
for a in range(1, 66):
    z = ZA[a]; lp = areas[a]['label']
    out_areas.append({'id': a, 'name': NAME_FIX.get(a, z['name']), 'vassal_name': z['vassal_name'], 'tdn': tdn[a],
                      'vp': {'allied': ALLIED_VP.get(a, 0), 'german': GERMAN_VP.get(a, 0), 'mutual': a in MUTUAL_VP},
                      'zone': zone.get(a), 'coastal': coast.get(a, 0) >= MIN_EDGE, 'port': PORT.get(a), 'airfield': a in AIRFIELD,
                      'beaches': sorted(beach_of.get(a, []), key=lambda s: (s[0], int(s[1:]))), 'axis_exit': a in EXIT_AXIS,
                      'sunrise_bridge': {'in_play': a in SUNRISE_AREAS, 'red_value': SUNRISE_RED.get(a)} if a in SUNRISE_AREAS else None,
                      'label': [round(lp.x), round(lp.y)], 'plate': plates[a], 'polygon': areas[a]['poly'],
                      'vassal_polygon': z['polygon']})
boxes = {b['vassal_name']: b['rect'] for b in Z['boxes']}
beaches = []
for b in Z['boxes']:
    n = b['vassal_name']
    if n.startswith('Beach') or n == 'D13':
        bid = n.split()[1] if n.startswith('Beach') else n
        bid = 'D10' if bid == '10' else bid
        ar, nm = BEACH[bid]
        beaches.append({'box': bid, 'name': nm or None, 'group': bid[0], 'area': ar, 'rect': b['rect'], 'vassal_name': n})
beaches.sort(key=lambda x: (x['box'][0], int(x['box'][1:])))
ports = [{'box': p, 'name': nm, 'area': ar, 'control': ctl, 'rect': boxes['%s %s' % (p, nm)], 'damage_box': boxes.get(dmg) if dmg else None}
         for p, (nm, ar, ctl, dmg) in PORT_BOX.items()]
KIND = [('Turn ', 'turn_track'), ('Eliminated Large Units', 'eliminated_large_units_track'), ('Fading Italian Morale', 'fading_italian_morale_track'),
        ('Army R', 'restricted_formation_status'), ('Draw Cup', 'selection_cup'), ('Resource', 'resources'), ('Reserve Marker', 'reserve_marker_holding'),
        ('Captured', 'captured_chart'), ('At Sea', 'at_sea'), ('Airborne', 'airborne_assault')]
other = []
for b in Z['boxes']:
    n = b['vassal_name']
    if n.startswith('Beach') or n == 'D13' or n[:2] in ('P1', 'P2', 'P3', 'P4') or n.endswith('Damage'): continue   # in beaches / ports
    kind = 'general_information_track' if n.isdigit() else next((k for p, k in KIND if p in n), 'other')
    other.append({'name': n, 'kind': kind, 'rect': b['rect'], 'vassal_zone': True})
other += EXTRA_BOXES
out = {'size': Z['size'], 'source': 'draft: areas traced on the Vassal module map (Main Map); values read off the map by hand; see data/sicily/NOTES.md',
       'areas': out_areas, 'connections': conns,
       'corner_only': [list(k) for k in corners],
       'zones': {z: sorted(a for a in zone if zone[a] == z) for z in sorted(ZONE_SEED)},
       'beaches': beaches, 'ports': ports, 'boxes': other,
       'turn_track': {'turns': [{'turn': t, 'dates': d, 'draw_allied': al, 'draw_axis': ax, 'net_vp': vp} for t, d, al, ax, vp in TURNS], 'note': TURN_NOTE}}
json.dump(out, open(sys.argv[4], 'w'), indent=1, ensure_ascii=False)
print('areas', len(out_areas), 'edges', len(conns), 'road', sum(c['type'] == 'road' for c in conns), 'river', sum(c['river'] for c in conns),
      'restricted', sum(c['restricted'] for c in conns), 'army', sum(c['army_boundary'] for c in conns), 'coastal', sum(a['coastal'] for a in out_areas),
      'boxes', len(other), 'beaches', len(beaches), 'ports', len(ports))
print('corner only', corners)
print('zones', out['zones'], 'no zone', [a for a in range(1, 66) if a not in zone])
for w in warn: print('check:', w)
