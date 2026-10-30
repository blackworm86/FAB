"""Apply the user's first review pass (map checker export) to data/bulge: edge edits + hand-drawn area shapes."""
import json
D = '../data/bulge/'
E = json.load(open(D + 'edges.json'))
idx = {(e['a'], e['b']): e for e in E}
def setc(a, b, conn=None, river=None):
    e = idx[(min(a, b), max(a, b))]
    if conn: e['connection'] = conn
    if river is not None: e['river'] = river
for a, b in [(3,12),(15,16),(29,55),(53,54),(54,58),(58,59),(58,78),(68,69),(82,89),(89,90),(90,95),(91,93),(93,94),(95,96)]: setc(a, b, 'road')
for a, b in [(88,89),(97,98)]: setc(a, b, 'field')
for a, b in [(54,58),(58,59),(79,80),(90,95),(91,94)]: setc(a, b, river=True)
if (80, 92) not in idx:
    e = dict(a=80, b=92, connection='field', river=True, restricted=False, army=True, manual=True, mid=[437, 369]); E.append(e); idx[(80, 92)] = e
E.sort(key=lambda e: (e['a'], e['b']))
json.dump(E, open(D + 'edges.json', 'w'), ensure_ascii=False)
P = {int(k): v for k, v in json.load(open(D + 'polygons_auto.json')).items()}
P.update({int(k): v for k, v in json.load(open(D + 'polygons_user_pass1.json')).items()})
json.dump({str(k): P[k] for k in sorted(P)}, open(D + 'polygons.json', 'w'))
print(len(E), 'edges;', len(P), 'polygons')
