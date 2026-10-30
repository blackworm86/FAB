"""Build the 3D piece checker (tools/pieces-checker.html): all blocks and counters with texture crops embedded."""
import base64, cv2, json
D = '../data/bulge/'
units = json.load(open(D + 'units.json')); ctr = json.load(open(D + 'counters.json'))
sheet = cv2.imread('../docs/game-pieces/Sticker_Sheet.jpg')
imgs, pieces = [], []
def add(img, q=88):
    ok, b = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, q]); imgs.append('data:image/jpeg;base64,' + base64.b64encode(b).decode()); return len(imgs) - 1
side_of = lambda e: 'german' if e.startswith('de_') or e == 'german' else 'us' if e.startswith('us_') else 'british' if e.startswith('br_') else 'allied' if e == 'allied' else 'neutral'
for u in units:
    if u.get('kind') == 'special_action_block':
        im = cv2.imread('../' + u['image']); h, w = im.shape[:2]
        pieces.append(dict(t='block', id=u['id'], name=u['name'], side=u['side'], ech='german' if u['side'] == 'german' else 'allied', cls='infantry', symbol='special action', steps=1, q=['veteran'],
                           start_area=None, arrival_turn=u.get('arrival_turn'), entry=[], ar=round(h / w, 3), img=add(im)))
        pieces[-1]['kind'] = 'special_action_block'; continue
    x, y, w, h = u['box']; im = sheet[max(0, y - 54):y + h + 58, max(0, x - 50):x + w + 46]; hh, ww = im.shape[:2]
    pieces.append(dict(t='block', id=u['id'], name=u['name'], side=u['side'], ech=u['echelon'], cls=u['cls'], symbol=u['symbol'], steps=u['steps'], q=u['quality_by_step'],
                       start_area=u.get('start_area'), arrival_turn=u.get('arrival_turn'), entry=u.get('entry', []), ar=round(hh / ww, 3), img=add(im)))
backs = json.load(open(D + 'counter_backs.json'))
fronts = {b['id']: [] for b in backs}
for c in ctr:
    im = cv2.imread('../' + c['image'])[7:-7, 7:-7]
    extra = ', '.join(f'{k} {v}' for k, v in c.items() if k in ('area', 'drop_areas', 'zones', 'division', 'airborne'))
    fronts[c['back']].append(f"{c['name']} x{c['copies']}")
    pieces.append(dict(t='counter', id=c['id'], name=c['name'], side=side_of(c['echelon']), ech=c['echelon'], kind=c['kind'], turn=c['turn'], quality=c.get('quality'), extra=extra,
                       copies=c['copies'], limit=c['limit'], back='bk_' + c['back'][5:], img=add(im, 86)))
SIDE_B = {'grey_asset': 'german', 'green_asset': 'allied', 'bid': 'german', 'task_force': 'us', 'garrison': 'us', 'zone5_de': 'german', 'zone6_de': 'german', 'zone7_de': 'german', 'zone7_al': 'allied', 'zones56_al': 'allied'}
for bk in backs:
    key = bk['id'][5:]; im = cv2.imread('../' + bk['image'])[4:-4, 4:-4]
    used = fronts[bk['id']]
    pieces.append(dict(t='back', id='bk_' + key, name=bk['name'], side=SIDE_B.get(key, 'neutral'), ech='none', kind=bk['kind'], copies=bk['copies'], limit=bk['limit'],
                       used_by=', '.join(used[:6]) + (f' (+{len(used) - 6} more)' if len(used) > 6 else ''), img=add(im, 88)))
t = open('pieces-checker.template.html').read().replace('__DATA__', json.dumps(pieces, ensure_ascii=False, separators=(',', ':'))).replace('__IMGS__', json.dumps(imgs))
open('pieces-checker.fragment.html', 'w').write(t)
open('pieces-checker.html', 'w').write('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html{color-scheme:light}body{margin:0}</style></head><body>' + t + '</body></html>')
print(len(pieces), 'pieces', round(len(t) / 1e6, 2), 'MB')
