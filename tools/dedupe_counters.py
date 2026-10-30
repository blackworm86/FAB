"""Collapse identical counters into one catalogue entry with a copy count.

  python3 tools/dedupe_counters.py            # dry run: print the groups only
  python3 tools/dedupe_counters.py --apply    # rewrite data/bulge/counters.json and delete the duplicate PNGs in assets/counters/raw/

Identical = same kind, name, army, turn, zones, area and quality (i.e. same face on the sheet).
Each remaining entry gets  copies: N  and  limit: "limited" | "unlimited":
  unlimited = status markers the rules never cap (disordered/recovering, river assault, exploitation, German VP crosses);
              the engine can place as many as needed, `copies` only records how many the box contains.
  limited   = everything that is a real component of the game: assets, events, reserve markers (rule 5.21: "limited by the counter-mix"), fuel, task forces ...
"""
import json, os, sys
from collections import OrderedDict
D = '../data/bulge/'
UNLIMITED = {'Disordered / Recovering', 'River Assault', 'Exploitation', 'German VP'}
C = json.load(open(D + 'counters.json'))
groups = OrderedDict()
for c in C:
    key = json.dumps([c['kind'], c['name'], c['echelon'], c['turn'], c.get('zones'), c.get('area'), c.get('quality'), c.get('division'), c.get('drop_areas')], sort_keys=True)
    groups.setdefault(key, []).append(c)
out, dropped = [], []
for g in groups.values():
    keep = dict(g[0]); keep['copies'] = len(g); keep['ids'] = [x['id'] for x in g]
    keep['limit'] = 'unlimited' if keep['name'] in UNLIMITED else 'limited'
    out.append(keep); dropped += [x for x in g[1:]]
dups = [o for o in out if o['copies'] > 1]
print(f'{len(C)} counters -> {len(out)} distinct; {len(dropped)} duplicates to remove\n')
print(f'{"copies":>6}  {"limit":<9} {"name":<28} {"army":<8} turn  ids')
for o in sorted(dups, key=lambda o: (o['limit'], o['name'], str(o['turn']))):
    print(f'{o["copies"]:>6}  {o["limit"]:<9} {o["name"]:<28} {o["echelon"]:<8} {str(o["turn"]):<5} {" ".join(o["ids"])}')
if '--apply' in sys.argv:
    for x in dropped:
        p = '../' + x['image']
        if os.path.exists(p): os.remove(p)
    json.dump(out, open(D + 'counters.json', 'w'), indent=1, ensure_ascii=False)
    print(f'\napplied: {len(dropped)} files removed, counters.json rewritten ({len(out)} entries)')
else:
    print('\ndry run only; add --apply to change files (git checkout restores everything)')
