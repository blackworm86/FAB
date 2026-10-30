"""Apply review pass 2 (map checker export): TDN change, 21 connection edits, 2 new connections."""
import json
D = '../data/bulge/'
E = json.load(open(D + 'edges.json')); A = json.load(open(D + 'areas.json'))
idx = {(e['a'], e['b']): e for e in E}
def g(a, b): return idx[(min(a, b), max(a, b))]
for a, b in [(9,10),(24,35),(32,53),(36,48),(38,39),(44,46),(49,62),(51,53),(60,61),(63,74),(75,82),(77,79)]: g(a, b)['connection'] = 'road'
for a, b in [(34,50),(38,46),(54,57),(57,58)]: g(a, b)['connection'] = 'field'
for a, b in [(59,78),(77,78),(77,79),(91,92),(91,93)]: g(a, b)['river'] = True
for a, b in [(61, 76), (95, 97)]:
    e = dict(a=a, b=b, connection='field', river=True, restricted=False, army=False, manual=True); E.append(e); idx[(a, b)] = e
for a in A:
    if a['id'] == 27: a['tdn'] = 3
E.sort(key=lambda e: (e['a'], e['b']))
zone = {a['id']: a['zone'] for a in A}
for e in E: e['army'] = zone[e['a']] != zone[e['b']]
json.dump(E, open(D + 'edges.json', 'w'), ensure_ascii=False); json.dump(A, open(D + 'areas.json', 'w'), ensure_ascii=False, indent=1)
print(len(E), 'edges')
