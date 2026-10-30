"""Make one image per physical counter showing both faces (front left, back right) and record the face pairing in counters.json."""
import cv2, json, numpy as np, os
D = '../data/bulge/'
C = json.load(open(D + 'counters.json')); B = {b['id']: b for b in json.load(open(D + 'counter_backs.json'))}
os.makedirs('../assets/counters/combined', exist_ok=True)
BACK_NAME = {'recovering': 'Recovering', 'roadblock': 'Road Block', 'no_fuel': 'No Fuel', 'star': 'Allied VP (star)', 'pooled': 'Pooled Assets', 'optional': 'Optional Rule 18.1 (bridges remaining)',
             'blown': 'Blown Bridge', 'bid': 'Bid', 'vps': 'VPs (Allied side)', 'game_turn': 'Game Turn (Allied side)'}
for c in C:
    f = cv2.imread('../' + c['image'])[7:-7, 7:-7]; bk = B[c['back']]; b = cv2.imread('../' + bk['image'])[4:-4, 4:-4]
    b = cv2.resize(b, (f.shape[1], f.shape[0]), interpolation=cv2.INTER_CUBIC)
    out = np.full((f.shape[0], f.shape[1] * 2 + 8, 3), 255, np.uint8); out[:, :f.shape[1]] = f; out[:, f.shape[1] + 8:] = b
    p = f'assets/counters/combined/{c["id"]}.png'; cv2.imwrite('../' + p, out)
    key = c['back'][5:]
    c['faces'] = dict(front=dict(name=c['name'], image=c['image']), back=dict(name=BACK_NAME.get(key, bk['name']), image=bk['image']))
    c['combined'] = p
    assert bk['limit'] == c['limit'] or key in ('grey_asset', 'green_asset', 'task_force', 'garrison'), (c['name'], bk['limit'], c['limit'])
json.dump(C, open(D + 'counters.json', 'w'), indent=1, ensure_ascii=False)
print(len(C), 'combined images')
