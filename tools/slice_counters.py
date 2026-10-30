"""Slice the front counter sheet (rotated upright) into one PNG per counter + a montage for checking.
Grid centres were read from the labels (half-scale coords), tiles are ~168px at 300 dpi."""
import cv2, numpy as np, json, os, sys
OUT = '../assets/counters/raw'; os.makedirs(OUT, exist_ok=True)
im = cv2.imread('../docs/game-pieces/countersheet_Front.jpg'); r = cv2.rotate(im, cv2.ROTATE_90_COUNTERCLOCKWISE)
ROWS = [74, 161, 264, 349, 454, 539, 640, 725, 826, 911]
SH = {'L': 68, 'R': 884}; PITCH = 84.6
EXTRA = {  # bottom-of-sheet special tiles (half-scale centres)
 'Rx': [(1275, 1010), (1360, 1010), (1275, 1095), (1360, 1095), (1275, 1180), (1360, 1180), (1475, 1095), (1560, 1095)],
 'Rb': [(1475, 1180), (1560, 1180)]}
H = 80
tiles = []
for sh, x0 in SH.items():
    for ri, y in enumerate(ROWS):
        for ci in range(9):
            tiles.append((f'{sh}{ri + 1}{ci + 1}', int((x0 + PITCH * ci) * 2), y * 2))
for k, pts in EXTRA.items():
    for i, (x, y) in enumerate(pts): tiles.append((f'{k}{i + 1}', x * 2, y * 2))
meta = []
for name, cx, cy in tiles:
    t = r[cy - H:cy + H, cx - H:cx + H]
    cv2.imwrite(f'{OUT}/{name}.png', t); meta.append(dict(id=name, cx=cx, cy=cy))
json.dump(meta, open('../assets/counters/grid.json', 'w'))
# montage per sheet for visual verification
for sh in ('L', 'R'):
    rows = [np.hstack([cv2.resize(cv2.imread(f'{OUT}/{sh}{ri + 1}{ci + 1}.png'), (110, 110)) for ci in range(9)]) for ri in range(10)]
    cv2.imwrite(f'{sys.argv[1]}/montage_{sh}.png', np.vstack(rows))
print(len(tiles))
