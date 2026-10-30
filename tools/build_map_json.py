"""Consolidate the reviewed map into data/bulge/map.json (the single file the game engine will load)."""
import json
D = '../data/bulge/'
A = json.load(open(D + 'areas.json')); E = json.load(open(D + 'edges.json')); P = json.load(open(D + 'polygons.json')); EN = json.load(open(D + 'entry_areas.json'))
cost = lambda e: 3 if e['restricted'] else 1 if e['connection'] == 'road' else 2
out = dict(game='FAB The Bulge', size=[1740, 1584], source='docs/maps/FAB The Bulge Game Map.jpg (crop x<1740)',
    areas=[dict(id=a['id'], name=a['name'], tdn=a['tdn'], vp=a['vp'], zone=a['zone'], label=a['seed'], polygon=P[str(a['id'])]) for a in A],
    connections=[dict(a=e['a'], b=e['b'], type=e['connection'], mp=cost(e), river=bool(e['river']), restricted=bool(e['restricted']), army_boundary=bool(e['army']), marker=e.get('mid')) for e in E],
    entry_areas={k: dict(side=v['side'], area=v['area']) for k, v in EN.items()},
    notes=['river=true means a river boundary: a bridge exists unless a blown-bridge marker is placed (rule 5.31)',
           'restricted: area 4-11 (Schnee Eifel): 3 MP, armor-class units and strat-moves may not cross (rule 14.1)',
           'army_boundary: the two areas are in different German army zones (rule 14.3); zone = 5th Pz (5), 6th Pz (6), 7th Army (7)'])
json.dump(out, open(D + 'map.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out['areas']), 'areas', len(out['connections']), 'connections')
