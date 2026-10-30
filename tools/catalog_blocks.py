"""Slice the sticker sheet into one label image per block and read steps/quality from the pips.
Names, symbol type and entry codes were transcribed by hand (reading order = rows top to bottom, left to right)."""
import cv2, json, numpy as np, os
OUT = '../assets/blocks'; os.makedirs(OUT, exist_ok=True)
im = cv2.imread('../docs/game-pieces/Sticker_Sheet.jpg'); g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY); hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
boxes = json.load(open('/tmp/claude-0/-home-user/a1c94234-d293-5e86-91af-6e8f1a3ddf07/scratchpad/boxes.json'))
rows = []
for b in sorted(boxes, key=lambda b: b[1]):
    for r in rows:
        if abs(r[0][1] - b[1]) < 40: r.append(b); break
    else: rows.append([b])
boxes = [b for r in rows for b in sorted(r)]
# name, symbol, code
U = """Peiper armor 5|1SS(-) armor 6|12SS armor 7|150 Pz mech 6|12 VG inf 9|277 VG inf 9|3 FJ airborne 10
2SS armor 4-Z|9SS armor 4-Z|326 VG inf 8|3 PG mech 4-Z|246 VG inf 8-Z|15 PG mech 7-Y|167 VG inf 8-Y
Lehr armor 13|2 Pz armor 21|9 Pz armor 7-Y|116 Pz armor 12|18 VG inf 11|26 VG inf 20|62 VG inf 11
560 VG inf 12|Fuh Es armor 3-Y|9 VG inf 8-X|212 VG inf 16|276 VG inf 15|352 VG inf 18|5 FJ airborne 19
79 VG inf 6-X|Fuh Gr mech 5-X|11 Pz armor Res
10SS armor Res|17SS mech Res|6SS mountain Res
4 Inf inf 16|109/28 inf 19|110/28 inf 21|112/28 inf 12|106 Inf inf 11|99 Inf inf 9|2 Inf inf 27
14 Cav cavalry 10|102 Cav cavalry 27|CCA/9 armor 18|CCB/9 armor 25|CCR/9 armor 37|7 Arm armor 2-AC|1 Inf inf 2-AC
9 Inf inf 3-AB|30 Inf inf 3-AB|82 airborne 3-HJ|101 airborne 3-HJ|3 Arm armor 5-B|517 airborne 6-HJ|75 Inf inf 6-CE
84 Inf inf 6-CE|4 Cav cavalry 7-CE|5 Arm armor 7-CE|2 Arm armor 7-CE|10 Arm armor 2-NQ|26 Inf inf 6-KN|80 Inf inf 6-KN
4 Arm armor 6-KN|6 Cav cavalry 7-KN|5 Inf inf 7-KN|6 Arm armor 8-KQ|43 Inf inf 6-DH|53 Inf inf 6-DH
11 Arm armor 8-KQ|35 Inf inf 8-KQ|90 Inf inf 8-KQ|Guards armor 7-DH|51 Inf inf 8-DE"""
units = []
for line in U.split('\n'):
    for it in line.split('|'):
        p = it.split(); units.append((' '.join(p[:-2]), p[-2], p[-1]))
assert len(units) == len(boxes) == 73, (len(units), len(boxes))
REF = {'de_6pz': (150, 40, 130), 'de_5pz': (225, 225, 225), 'de_7a': (235, 160, 80), 'de_sr': (30, 130, 235), 'us_1a': (150, 215, 150), 'us_3a': (60, 90, 70),
       'us_sr': (235, 200, 140), 'br_xxx': (40, 40, 220)}   # BGR
CLASS = dict(armor='armor', mech='armor', cavalry='armor', inf='infantry', airborne='infantry', mountain='infantry')
def pipcolor(bgr):
    b, gg, r = [int(v) for v in bgr]
    if r > 170 and gg < 110 and b < 110: return 'elite'
    if (b + gg + r) / 3 < 110: return 'veteran'
    if min(b, gg, r) > 205: return 'green'
    return None
def pips(x0, y0, x1, y1, want=None):
    reg = g[y0:y1, x0:x1]
    cs = cv2.HoughCircles(cv2.GaussianBlur(reg, (5, 5), 1.2), cv2.HOUGH_GRADIENT, 1, 12, param1=90, param2=10, minRadius=7, maxRadius=12)
    out = []
    if cs is not None:
        for cx, cy, r in cs[0]:
            X, Y = int(cx) + x0, int(cy) + y0
            patch = im[Y - 1:Y + 2, X - 1:X + 2].reshape(-1, 3).astype(float)
            if patch.std(0).max() > 45: continue          # letters have holes / edges, pips are solid
            q = pipcolor(patch.mean(0))
            if q: out.append((X, Y, q))
            if want is not None and len(out) >= want: break
    return sorted(out)
res = []
for i, ((x, y, w, h), (name, sym, code)) in enumerate(zip(boxes, units)):
    cx = x + w // 2
    top = pips(x - 5, y - 52, x + w + 5, y - 6)
    n = len(top)
    right = pips(x + w + 6, y - 4, x + w + 48, y + h + 6, n - 1) if n > 1 else []
    bottom = pips(x - 8, y + h + 6, x + w // 2 + 14, y + h + 62, n - 2) if n > 2 else []
    left = pips(x - 44, y - 4, x - 6, y + h + 6, n - 3) if n > 3 else []
    edges = [top, right, bottom, left]
    tq = [e[0][2] if e else None for e in edges]
    counts = [len(e) for e in edges]
    # colour of the box fill: sample inside near the corners
    s = np.mean([im[y + 10:y + 18, x + 10:x + 18].reshape(-1, 3).mean(0), im[y + h - 18:y + h - 10, x + w - 18:x + w - 10].reshape(-1, 3).mean(0)], 0)
    ech = min(REF, key=lambda k: np.linalg.norm(np.array(REF[k]) - s))
    n = counts[0]
    cv2.imwrite(f'{OUT}/B{i + 1:02d}.png', im[max(0, y - 58):y + h + 66, max(0, x - 66):x + w + 56])
    res.append(dict(id=f'B{i + 1:02d}', name=name, symbol=sym, cls=CLASS[sym], code=code, echelon_guess=ech, box=[x, y, w, h], pip_counts=counts, pip_quality=tq,
                    steps=n, image=f'assets/blocks/B{i + 1:02d}.png'))
json.dump(res, open('/tmp/claude-0/-home-user/a1c94234-d293-5e86-91af-6e8f1a3ddf07/scratchpad/blocks_raw.json', 'w'), indent=0)
for r in res: print(r['id'], r['name'], r['echelon_guess'], r['pip_counts'], r['pip_quality'])

# ---------------- final assembly ----------------
ECH = {}
for k, names in {
 'de_6pz': 'Peiper,1SS(-),12SS,150 Pz,12 VG,277 VG,3 FJ,2SS,9SS,326 VG,3 PG,246 VG',
 'de_5pz': '15 PG,167 VG,Lehr,2 Pz,9 Pz,116 Pz,18 VG,26 VG,62 VG,560 VG,Fuh Es',
 'de_7a': '9 VG,212 VG,276 VG,352 VG,5 FJ,79 VG,Fuh Gr',
 'de_sr': '11 Pz,10SS,17SS,6SS',
 'us_1a': '4 Inf,109/28,110/28,112/28,106 Inf,99 Inf,2 Inf,14 Cav,102 Cav,CCA/9,CCB/9,CCR/9,7 Arm,1 Inf,9 Inf,30 Inf,3 Arm,75 Inf,84 Inf,4 Cav,5 Arm,2 Arm',
 'us_3a': '10 Arm,26 Inf,80 Inf,4 Arm,6 Cav,5 Inf,6 Arm,11 Arm,35 Inf,90 Inf',
 'us_sr': '82,101,517', 'br_xxx': '43 Inf,53 Inf,Guards,51 Inf'}.items():
    for n in names.split(','): ECH[n] = k
SIDE = lambda e: 'german' if e.startswith('de_') else 'british' if e.startswith('br_') else 'us'
LET = 'ABCDEFGHJKLMNPQ'
def parse(code, side):
    if code == 'Res': return dict(arrival='strategic_reserve_event', entry=['Y', 'Z'])
    if '-' not in code: return dict(start_area=int(code))
    t, l = code.split('-'); turn = int(t)
    ent = [l] if len(l) == 1 else list(LET[LET.index(l[0]):LET.index(l[1]) + 1])
    return dict(arrival_turn=turn, entry=ent)
FIX = {}
units = []
for r in res:
    e = ECH[r['name']]; q = [x for x in r['pip_quality'][:r['steps']]]
    if r['id'] in FIX: q[1] = FIX[r['id']]['right']
    units.append(dict(id=r['id'], name=r['name'], side=SIDE(e), echelon=e, symbol=r['symbol'], cls=r['cls'], steps=r['steps'],
                      quality_by_step=list(reversed(q)),      # index 0 = 1-step strength ... last = full strength
                      **parse(r['code'], SIDE(e)), image=r['image']))
for k, (x0, y0, x1, y1, nm) in enumerate([(627, 718, 955, 1018, 'German Special Action'), (964, 718, 1248, 1018, 'Allied Special Action')]):
    cv2.imwrite(f'{OUT}/SA{k + 1}.png', im[y0:y1, x0:x1])
    units.append(dict(id=f'SA{k + 1}', name=nm, side='german' if k == 0 else 'allied', kind='special_action_block', arrival_turn=2, image=f'assets/blocks/SA{k + 1}.png'))
json.dump(units, open('../data/bulge/units.json', 'w'), indent=1, ensure_ascii=False)
# annotated montage for checking
tiles = []
for u, r in zip(units, res):
    t = cv2.imread('../' + u['image']); t = cv2.resize(t, (215, 230)); cv2.rectangle(t, (0, 205), (215, 230), (255, 255, 255), -1)
    cv2.putText(t, f"{u['name']} {u['steps']}st {''.join(q[0] for q in reversed(u['quality_by_step']))}", (3, 224), 0, 0.5, (0, 0, 0), 1); tiles.append(t)
rowsm = [np.hstack(tiles[i:i + 7] + [np.full((230, 215, 3), 255, np.uint8)] * (7 - len(tiles[i:i + 7]))) for i in range(0, len(tiles), 7)]
cv2.imwrite('/tmp/claude-0/-home-user/a1c94234-d293-5e86-91af-6e8f1a3ddf07/scratchpad/blocks_montage.png', np.vstack(rowsm[:6]))
cv2.imwrite('/tmp/claude-0/-home-user/a1c94234-d293-5e86-91af-6e8f1a3ddf07/scratchpad/blocks_montage2.png', np.vstack(rowsm[6:]))
print(len(units), 'units written')
