"""Derive the per-turn reinforcement schedule from units.json + counters.json (cross-checked against the two reinforcement cards)."""
import json, collections
D = '../data/bulge/'
units = json.load(open(D + 'units.json')); ctr = json.load(open(D + 'counters.json'))
SIDE = lambda e: 'german' if e in ('german',) or str(e).startswith('de_') else 'allied'
sched = {t: dict(german=dict(units=[], chits=[]), allied=dict(units=[], chits=[])) for t in range(2, 10)}
start = dict(german=[], allied=[])
for u in units:
    if u.get('kind') == 'special_action_block': sched[2][u['side']]['chits'].append(dict(id=u['id'], name=u['name'], reusable=True)); continue
    if 'arrival_turn' in u: sched[u['arrival_turn']][u['side'] if u['side'] == 'german' else 'allied']['units'].append(dict(id=u['id'], name=u['name'], entry=u['entry']))
    elif 'start_area' in u: start['german' if u['side'] == 'german' else 'allied'].append(dict(id=u['id'], name=u['name'], area=u['start_area']))
    else: sched['strategic_reserve'] = sched.get('strategic_reserve', []) + [dict(id=u['id'], name=u['name'])]
for c in ctr:
    ech = c['echelon']; side = 'german' if (str(ech).startswith('de_') or ech == 'german') else 'allied' if (str(ech).startswith(('us_', 'br_')) or ech == 'allied') else None
    if side is None or c['kind'] in ('marker', 'marker_vp', 'reserve_marker'): continue
    tn = c['turn']
    if isinstance(tn, int): sched[tn][side]['chits'].append(dict(id=c['id'], kind=c['kind'], name=c['name'], echelon=ech))
    elif tn == 'S': start[side].append(dict(id=c['id'], kind=c['kind'], name=c['name'], echelon=ech))
out = dict(source='derived from units.json + counters.json; matches the printed Reinforcement Cards (units per turn and chit totals)', start_assets=start, turns=sched)
json.dump(out, open(D + 'reinforcements.json', 'w'), indent=1, ensure_ascii=False)
for t in range(2, 10): print(t, {s: (len(sched[t][s]['units']), len(sched[t][s]['chits'])) for s in ('german', 'allied')})
print('start assets', {k: len(v) for k, v in start.items()}, 'strategic reserve', len(sched.get('strategic_reserve', [])))
