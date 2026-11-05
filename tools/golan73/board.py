"""Golan '73 board art in the Bulge board's style, from data/golan73/map.json + map_art.json.

Usage: python3 -I tools/golan73/board.py data/golan73 web/public/golan73
Writes map-base.svg (margin, ground tinted by terrain difficulty, the Hermon massif, lakes, assembly boxes)
and map-lines.svg (area borders, special boundaries, rivers, roads, arrows, map edge). Numbers, names, VPs and
entry strips are printed at run time, as for The Bulge.
"""
import json, os, sys
D, OUT = sys.argv[1:3]
M = json.load(open(os.path.join(D, 'map.json'))); A = json.load(open(os.path.join(D, 'map_art.json')))
W, H = [int(v) for v in M['size']]
os.makedirs(OUT, exist_ok=True)
# Bulge palette: margin #bccad3, water #9fb0b8, borders #fbfbf6, roads #e4e6d8 over #585b56, rivers #1c78c0 in white, entry green #2f9a52.
# Golan ground: dry basalt plateau in October, one tone per TDN (open → very rough), muted like the Bulge ground #bcc0ab.
GROUND = {0: '#d4cca6', 1: '#bba987', 2: '#9b968a', 3: '#6e6a62'}
poly = lambda P: 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in P) + 'Z'
paths = lambda ds, extra='': ''.join(f'<path d="{d}"{extra}/>' for d in ds if d)

base = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">', f'<rect id="frame" width="{W}" height="{H}" fill="#bccad3"/>',
        f'<g id="offmap" fill="#c9c6b8" stroke="#fbfbf6" stroke-width="2">{paths(A["offmap"])}</g>',
        '<g id="terrain">' + ''.join(f'<path fill="{GROUND[t]}" d="{"".join(poly(a["polygon"]) for a in M["areas"] if a["tdn"] == t)}"/>' for t in GROUND) + '</g>',
        f'<g id="water" fill="#9fb0b8" stroke="#fbfbf6" stroke-width="2">{paths(A["lakes"])}</g>',
        '<g id="assembly">' + ''.join(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="#2f9a52" stroke="#fff" stroke-width="2.4"/>'
                                     f'<text x="{x + w / 2}" y="{y + 64}" text-anchor="middle" font-family="Saira Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="54" fill="#fff">{k}</text>'
                                     f'<text x="{x + w / 2}" y="{y + 100}" text-anchor="middle" font-family="Saira Condensed, Arial Narrow, sans-serif" font-weight="600" font-size="19" fill="#fff" letter-spacing="1.5">{v["name"].split()[0].upper()}</text>'
                                     f'<text x="{x + w / 2}" y="{y + 122}" text-anchor="middle" font-family="Saira Condensed, Arial Narrow, sans-serif" font-weight="600" font-size="19" fill="#fff" letter-spacing="1.5">ASSEMBLY AREA</text>'
                                     for k, v in M['assembly'].items() for x, y, w, h in [v['box']]) + '</g>',
        '</svg>']
open(os.path.join(OUT, 'map-base.svg'), 'w').write('\n'.join(base))

g = lambda gid, attrs, body: f'<g id="{gid}" fill="none" stroke-linecap="round" stroke-linejoin="round" {attrs}>{body}</g>'
heads = ''.join(f'<path d="{d}" fill="#1d1d1b"/>' for d in A['heads'])
lines = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
         g('boundaries', 'stroke="#fbfbf6" stroke-width="2.8"', paths(A['open'])),
         g('wadi', 'stroke="#6f8a2c" stroke-width="3.6"', paths(A['wadi'])),
         g('rugged', '', f'<g stroke="#fbfbf6" stroke-width="7">{paths(A["rugged"])}</g><g stroke="#2b2a26" stroke-width="4.2" stroke-dasharray="1 7">{paths(A["rugged"])}</g>'),
         g('escarpment', '', f'<g stroke="#fbfbf6" stroke-width="6.5">{paths(A["escarpment"])}</g><g stroke="#a3402b" stroke-width="3.6">{paths(A["escarpment"])}</g>'),
         g('hermon', 'stroke="#fbfbf6" stroke-width="3"', paths(A['hermon'])),
         g('rivers', '', f'<g stroke="#fff" stroke-width="6">{paths(A["river"])}</g><g stroke="#1c78c0" stroke-width="3">{paths(A["river"])}</g>'),
         g('roads', '', f'<g stroke="#e4e6d8" stroke-opacity=".85" stroke-width="4.4">{paths(A["roads"])}</g><g stroke="#585b56" stroke-width="1.7">{paths(A["roads"])}</g>'),
         g('at-ditch', '', f'<g stroke="#fbfbf6" stroke-width="8">{paths(A["atDitch"])}</g><g stroke="#7a3f8f" stroke-width="5">{paths(A["atDitch"])}</g><g stroke="#e9d9ef" stroke-width="1.4" stroke-dasharray="7 9">{paths(A["atDitch"])}</g>'),
         g('sam-barrier', 'stroke="#1d5fa8" stroke-width="3.4" stroke-dasharray="14 5 2 5"', paths(A['samBarrier'])),
         g('sectors', 'stroke="#3a3f3d" stroke-width="3" stroke-dasharray="11 6"', paths(A['sector'])),
         g('arrows', 'stroke="#1d1d1b" stroke-width="3.4"', paths(A['arrows1']) + f'<g stroke-dasharray="10 7">{paths(A["arrowsAll"])}</g>' + f'<g stroke="none">{heads}</g>'),
         g('outline', 'stroke="#fbfbf6" stroke-width="4.6"', paths(A['border'])),
         '</svg>']
open(os.path.join(OUT, 'map-lines.svg'), 'w').write('\n'.join(lines))
print('board', W, H, os.path.getsize(os.path.join(OUT, 'map-base.svg')) // 1024, 'KB +', os.path.getsize(os.path.join(OUT, 'map-lines.svg')) // 1024, 'KB')
