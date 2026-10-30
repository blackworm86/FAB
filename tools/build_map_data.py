"""Assemble data/bulge/{areas,edges,entry_areas}.json from the segmentation + hand-read tables, and draw QA overlays."""
import cv2, json, numpy as np, networkx as nx, sys
D = '../data/bulge/'
seeds = json.load(open(D + 'area_seeds.json'))
raw = json.load(open(D + 'edges_raw.json'))
ov = json.load(open(D + 'edge_overrides.json'))
B = cv2.imread(D + 'area_bodies.png', 0)
im = cv2.imread('../docs/maps/FAB The Bulge Game Map.jpg')

NAMES = "Bitburg,Ehlenz,Pronsfeld,Prüm,Losheim,Blankenheim,Schleiden,Kesternich,Udenbreth,Bucholz,Bleialf,Lutzkampen,Dasburg,Sinspelt,Irrel,Echternach,Junglinster,Beaufort,Diekirch,Holzthum,Marnach,Weiswampach,St. Vith,Vielsalm,Ligneuville,Elsenborn,Monschau,Walheim,Aachen,Eupen,Hohes Venn,Spa,Malmedy,Trois Ponts,Baraque de Fraiture,Houffalize,Lullange,Wiltz,Ettelbruck,Mersch,Luxembourg City,Capellen,Arlon,Sure,Rambrouch,Martelange,Bastogne,Noville,Samrée,Manhay,Werbomont,Stoumont,Aywaille,Fléron,Verviers,Herve,Oupeye,Liège,Esneux,Ouffet,Hotton,La Roche,Sprimont,Sibret,Habay,Étalle,Tintigny,Florenville,Straimont,Neufchâteau,Bertrix,Libramont,St. Hubert,Champlon,Marche,Mean,Huy,Amay,Wanze,Andenne,Ciney,Rochefort,Grupont,Libin,Paliseul,Ste. Cécile,La Chapelle,Bièvre,Wellin,Celles,Spontin,Nameche,Namur,Profondeville,Dinant,Givet,Beauraing,Forêt des Ardennes".split(',')
TDN0 = {1,30,37,59,60,63,64,76,77,78,79,80,81,90,91,92,93,94,95,96}
TDN2 = {27,41,43,47,55,58}
TDN3 = {26,31,32,38,45,69,74,87,98}
ALLIED_VP = {27:1,8:1,7:1,9:1,10:1,6:2,5:1,4:2,11:1,12:1,3:1,13:1,2:1,14:1,1:2,15:1}   # black crosses (Allied VP)
GERMAN_VP = {93:3,92:2,79:2,78:2,58:3,43:1,41:1}                                         # blue stars (German VP)
MUTUAL_VP = {55,77,51,33,75,47}                                                         # yellow stars

E = {(e['a'], e['b']): e for e in raw}
for a, b in ov.get('remove', []): E.pop((min(a, b), max(a, b)), None)
for a, b in ov.get('add', []):
    E.setdefault((min(a, b), max(a, b)), dict(a=min(a, b), b=max(a, b), river=0, road=0, dashDensity=0, manual=True))
for (a, b), f in ov.get('set', {}).items() if isinstance(ov.get('set'), dict) else []: pass
for s in ov.get('set', []):
    a, b = sorted(s['edge']); e = E[(a, b)]
    for k, v in s.items():
        if k != 'edge': e[k] = v

army = {k for k, e in E.items() if e.get('dashDensity', 0) >= 0.8} - {(4, 11)}
army |= {tuple(sorted(p)) for p in ov.get('army_add', [])}
army -= {tuple(sorted(p)) for p in ov.get('army_remove', [])}
G = nx.Graph([k for k in E if k not in army])
for a in range(1, 99): G.add_node(a)
anchor = {'6': ov['zone6'], '5': ov['zone5'], '7': ov['zone7']}
zone = {}
for z, nodes in anchor.items():
    for a in nodes: zone[a] = int(z)
H = G.copy()
# zone 5 vs 6: remaining leaks are cut with a minimum cut between the anchor sets
for u in ov['zone6']: H.add_edge('S', u, capacity=99)
for u in ov['zone5']: H.add_edge('T', u, capacity=99)
nx.set_edge_attributes(H, {e: 1 for e in H.edges if 'S' not in e and 'T' not in e}, 'capacity')
for e in H.edges:
    if 'capacity' not in H.edges[e]: H.edges[e]['capacity'] = 1
cut, (S_, T_) = nx.minimum_cut(H, 'S', T_ := 'T') if False else nx.minimum_cut(H, 'S', 'T')
z6 = {a for a in S_ if a != 'S'}
G7 = nx.Graph([k for k in E if k not in army])
comp7 = nx.node_connected_component(G7, ov['zone7'][0])
zones = {}
for a in range(1, 99):
    zones[a] = 7 if a in comp7 else (6 if a in z6 else 5)
cutedges = sorted((min(u, v), max(u, v)) for u in S_ for v in H[u] if v in T_ and u not in ('S', 'T') and v not in ('S', 'T'))

areas = []
for a in range(1, 99):
    ys, xs = np.nonzero(B == a)
    areas.append(dict(id=a, name=NAMES[a - 1], seed=seeds[str(a)], centroid=[int(xs.mean()), int(ys.mean())],
                      tdn=0 if a in TDN0 else 2 if a in TDN2 else 3 if a in TDN3 else 1,
                      vp=dict(allied=ALLIED_VP.get(a, 0), german=GERMAN_VP.get(a, 0), mutual=a in MUTUAL_VP),
                      zone=zones[a]))
edges = []
for (a, b), e in sorted(E.items()):
    edges.append(dict(a=a, b=b, connection='road' if e.get('road') else 'field', river=bool(e.get('river', 0) > 0.35) if 'river_override' not in e else e['river_override'],
                      restricted=(a, b) == (4, 11), army=zones[a] != zones[b], manual=bool(e.get('manual'))))
json.dump(areas, open(D + 'areas.json', 'w'), ensure_ascii=False, indent=1)
json.dump(edges, open(D + 'edges.json', 'w'), ensure_ascii=False)
print(len(areas), 'areas', len(edges), 'edges;', 'zone counts', {z: sum(1 for a in areas if a['zone'] == z) for z in (5, 6, 7)})
print('cut edges 5|6:', cutedges)
print('army edges flagged by dashes but not zone-changing:', sorted(army - {(e['a'], e['b']) for e in edges if e['army']}))
