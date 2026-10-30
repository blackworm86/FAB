"""Catalogue the counter backs (countersheet_back.webp, rotated upright and upscaled 2x) and pair every face with its front.
Counts were read by hand from the sheet (two halves A and B) and cross-checked against the fronts: 228 counters in total = 190 fronts + 38 gear fronts."""
import cv2, json, numpy as np
from PIL import Image
D = '../data/bulge/'
im = np.array(Image.open('../docs/game-pieces/countersheet_back.webp').convert('RGB'))[:, :, ::-1]
big = cv2.resize(cv2.rotate(im, cv2.ROTATE_90_CLOCKWISE), None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
SH = {'A': big[:, :900], 'B': big[:, 900:]}
def cut(name, sh, x, y, h=48):
    t = SH[sh][max(0, y - h):y + h, max(0, x - h):x + h]; cv2.imwrite(f'../assets/counters/backs/{name}.png', t); return f'assets/counters/backs/{name}.png'
front = cv2.rotate(cv2.imread('../docs/game-pieces/countersheet_Front.jpg'), cv2.ROTATE_90_COUNTERCLOCKWISE)
cv2.imwrite('../assets/counters/backs/gear_front.png', front[2040 - 80:2040 + 80, 146 - 80:146 + 80])
# face: (key, display name, sheet, x, y, copies, kind)
B = [
 ('grey_asset', 'Asset or Event (German)', 'A', 90, 100, 57, 'back_generic'), ('green_asset', 'Asset or Event (Allied)', 'A', 275, 295, 73, 'back_generic'),
 ('task_force', 'Task Force (back)', 'A', 737, 690, 5, 'back_generic'), ('garrison', 'Garrison (back)', 'B', 260, 910, 4, 'back_generic'),
 ('bid', 'Bid (back)', 'A', 85, 1285, 2, 'back_generic'),
 ('zone5_de', 'Zone 5 Reserve Unit', 'A', 270, 490, 2, 'reserve_marker'), ('zone6_de', 'Zone 6 Reserve Unit', 'A', 85, 490, 2, 'reserve_marker'), ('zone7_de', 'Zone 7 Reserve Unit', 'A', 85, 585, 1, 'reserve_marker'),
 ('zone7_al', 'Zone 7 Reserve Unit (Allied)', 'B', 80, 910, 2, 'reserve_marker'), ('zones56_al', 'Zones 5/6 Reserve Unit (Allied)', 'A', 830, 905, 3, 'reserve_marker'),
 ('recovering', 'Recovering', 'A', 85, 900, 12, 'marker'), ('roadblock', 'Road Block', 'A', 643, 905, 4, 'marker'), ('no_fuel', 'No Fuel', 'A', 85, 1195, 8, 'marker'),
 ('star', 'Allied VP (star)', 'A', 180, 690, 11, 'marker'), ('vps', 'VPs (Allied side)', 'A', 85, 690, 1, 'marker'), ('pooled', 'Pooled Assets', 'A', 275, 585, 1, 'marker'),
 ('game_turn', 'Game Turn (Allied side)', 'A', 365, 585, 1, 'marker'), ('optional', 'Optional Rule 18.1 (bridges remaining)', 'A', 85, 790, 1, 'marker'), ('blown', 'Blown Bridge', 'A', 85, 1100, 38, 'marker')]
backs = {}
for key, name, sh, x, y, n, kind in B:
    backs[key] = dict(id='back_' + key, name=name, kind=kind, copies=n, image=cut(key, sh, x, y))
# fronts -> back face; groups from the deduplicated counters.json
C = json.load(open(D + 'counters.json'))
RES = {'Zone 5 Reserve Unit': 'zone5_de', 'Zone 6 Reserve Unit': 'zone6_de'}
def back_for(c):
    n, k, e = c['name'], c['kind'], c['echelon']
    if k == 'reserve_marker':
        if e == 'german': return {'Zone 5 Reserve Unit': 'zone5_de', 'Zone 6 Reserve Unit': 'zone6_de', 'Zone 7 Reserve Unit': 'zone7_de'}[n]
        return 'zone7_al' if n.startswith('Zone 7') else 'zones56_al'
    if k == 'task_force': return 'task_force'
    if k == 'garrison': return 'garrison'
    if k == 'fuel_bid': return 'bid'
    if k in ('marker', 'marker_vp'):
        return {'Disordered / Recovering': 'recovering', 'River Assault': 'roadblock', 'Exploitation': 'no_fuel', 'German VP': 'star', 'VPs': 'vps', 'Boundary Crossing': 'pooled', 'Game Turn': 'game_turn', 'Remaining German Bridge Repairs': 'optional'}[n]
    return 'grey_asset' if (e.startswith('de_') or e == 'german') else 'green_asset'
tot = {'grey_asset': 0, 'green_asset': 0}
for c in C:
    if c.get('copies') is None: c['copies'] = 1
    b = back_for(c); c['back'] = 'back_' + b
    if b in tot: tot[b] += c['copies']
print('chit counts from fronts (must equal back counts):', tot, '| backs read:', {k: backs[k]['copies'] for k in tot})
assert tot['grey_asset'] == backs['grey_asset']['copies'] and tot['green_asset'] == backs['green_asset']['copies']
# gear front <-> Blown Bridge back
C.append(dict(id='GEAR', kind='marker', echelon='none', turn=None, name='Blown Bridge (gear side)', image='assets/counters/backs/gear_front.png', copies=38, ids=[f'gear{i}' for i in range(1, 39)], limit='unlimited', back='back_blown'))
UNL = {'recovering', 'roadblock', 'no_fuel', 'star', 'blown'}
for k, b in backs.items():
    b['limit'] = 'unlimited' if k in UNL else 'limited'
json.dump(C, open(D + 'counters.json', 'w'), indent=1, ensure_ascii=False)
json.dump(list(backs.values()), open(D + 'counter_backs.json', 'w'), indent=1, ensure_ascii=False)
total = sum(c['copies'] for c in C); print('fronts incl. gear:', total, '| backs:', sum(b['copies'] for b in backs.values()))
