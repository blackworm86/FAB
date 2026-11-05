"""Checks data/golan73/map.json against what the Play Book's examples of play (23.0) say about the map.
Usage: python3 -I tools/golan73/check_playbook.py   (exit code 1 if an example disagrees with the map)"""
import json, sys
M = json.load(open('data/golan73/map.json'))
C = {}
for c in M['connections']: C[(c['a'], c['b'])] = C[(c['b'], c['a'])] = c
# (a, b, connection type or None, boundary flags that must be set, where the Play Book says so)
EXAMPLES = [
    (75, 74, 'road', [], 'Ex 2C: 1 MP road into Swisah'), (74, 73, 'road', [], 'Ex 2C: 2 MP into an interdicted area = road +1'),
    (6, 7, 'road', ['river'], 'Ex 3A: road (bridge) over the river'), (7, 36, 'road', ['escarpment'], 'Ex 3A: escarpment by road'),
    (36, 37, 'field', ['wadi'], 'Ex 3A: wadi by field, 3 MP'), (6, 9, 'field', [], 'Ex 3B/D: field'), (9, 8, 'field', ['river'], 'Ex 3B: river, no road, no bridge'),
    (35, 8, 'field', ['escarpment'], 'Ex 3E: escarpment without road'), (35, 36, 'field', [], 'Ex 3F: open boundary, field'), (36, 42, 'road', [], 'Ex 3F'),
    (36, 43, None, ['wadi'], 'Ex 3F: wadi +1'), (35, 34, 'road', [], 'Ex 3G'), (34, 38, 'road', [], 'Ex 3G'), (34, 33, 'road', [], 'Ex 3H'),
    (50, 51, 'road', [], 'Ex 4A'), (51, 52, 'road', [], 'Ex 4A'), (52, 46, 'field', [], 'Ex 4A: 3 MP, field +1'), (51, 46, 'field', ['rugged'], 'Ex 4B: rugged, armor may not cross'),
    (49, 46, None, ['rugged'], 'Ex 4C: rugged'), (49, 48, None, ['sector'], 'Ex 4D: operational boundary'), (18, 19, 'road', ['rugged'], '14.14: rugged with road'),
    (64, 50, None, ['atDitch'], 'Ex 5A'), (61, 57, None, ['atDitch'], 'Ex 5B'), (60, 59, None, ['atDitch'], 'Ex 5C'), (63, 64, None, [], 'Ex 5E'),
    (48, 47, 'road', [], 'Ex 6C: road +1 occupied +1 minefield'), (48, 40, 'road', [], 'Ex 6B: 1 MP'), (40, 41, 'field', [], 'Ex 6B: 2 MP'), (41, 47, 'field', [], 'Ex 6B: 2 MP'),
    (10, 11, 'road', [], 'Ex 7'), (11, 12, 'road', [], 'Ex 7'), (12, 24, 'road', ['escarpment'], 'Ex 7, Ex 13B'), (24, 26, 'road', [], 'Ex 7'), (12, 35, 'road', [], 'Ex 7'),
    (26, 31, 'field', [], 'Ex 14E: 3 MP = field +1'), (30, 31, None, [], 'Ex 14A'), (33, 32, None, [], 'Ex 14C'), (27, 28, None, [], 'Ex 14D'),
    (3, 54, None, ['escarpment'], 'Ex 15C: supply blocked by escarpment'), (2, 58, 'road', ['escarpment'], 'Ex 15C: road across the escarpment'), (57, 61, None, ['atDitch'], 'Ex 15B'),
]
bad = 0
for a, b, t, flags, src in EXAMPLES:
    c = C.get((a, b))
    if c and (t is None or c['type'] == t) and all(c.get(f) for f in flags): continue
    bad += 1
    got = 'not adjacent' if not c else c['type'] + ''.join(f' {f}' for f in ('river', 'atDitch', 'wadi', 'escarpment', 'rugged', 'samBarrier', 'sector') if c.get(f))
    print(f'{a}/{b}: map has {got}; {src} expects {t or "any"} {" ".join(flags)}')
assert {M['assembly']['A']['enters'] == [6, 10], M['assembly']['B']['enters'] == [17]} == {True}, 'assembly arrows'
print(f'{len(EXAMPLES) - bad} of {len(EXAMPLES)} Play Book map facts agree')
sys.exit(1 if bad else 0)
