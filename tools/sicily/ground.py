"""The printed ground of the Sicily map, lifted from the scan: the tan paper, the brown relief washes, Etna, the sea, without any line, text or symbol.

Usage: python3 -I tools/sicily/ground.py docs/games/sicily/maps/SICILYmap-FINAL-72.jpg data/sicily <scratch>/sicily-ground.png
The scan is warped into the game's coordinates (the same fit that paired the drawing with the Vassal map), then everything the
board draws itself is masked and inpainted: the grey and black lines (borders, roads, hachures), the blue rivers and river names, the
number plates, names, VP symbols and other printed symbols, the landing and port boxes with their arrows, and the charts beyond the
map frame. What remains is the cardboard's own ground depiction; board.py draws the lines, boxes and symbols over it in the print's style.
"""
import json, os, re, sys
import numpy as np, cv2

SCAN, D, OUT = sys.argv[1:4]
A = json.load(open(os.path.join(D, 'map_art.json'))); M = json.load(open(os.path.join(D, 'map.json'))); V = json.load(open(os.path.join(D, 'map_vassal.json')))
W, H = M['size']
pts = lambda d: [tuple(map(float, q.split(','))) for q in re.findall(r'-?[\d.]+,-?[\d.]+', d)]
# scan -> Vassal px (fitted with SIFT, 0.5 px rms) and Vassal -> drawing (svgmap.py's fit)
A1 = np.array([[1.36112, -0.0000116, -0.395], [-0.0000279, 1.36174, -0.293]]); A2 = np.array([[0.7657, -0.0001, 0.2434], [-0.0002, 0.7659, -0.3259]])
T = (np.vstack([A2, [0, 0, 1]]) @ np.vstack([A1, [0, 0, 1]]))[:2]
img = cv2.warpAffine(cv2.imread(SCAN), T, (W, H), flags=cv2.INTER_CUBIC)

land = np.zeros((H, W), np.uint8)
for a in M['areas']: cv2.fillPoly(land, [np.array(a['polygon'], np.int32)], 255)
for p in A['islets'] + A['mainland']: cv2.fillPoly(land, [np.array(pts(p), np.int32)], 255)
b, g, r = [c.astype(int) for c in cv2.split(img)]; gray = 0.299 * r + 0.587 * g + 0.114 * b; sat = np.max(img, 2).astype(int) - np.min(img, 2).astype(int)

mask = np.zeros((H, W), np.uint8)
mask[(gray < 130) & (sat < 45)] = 255                                                  # grey and black: borders, roads, hachures, text, plates' numbers
thin_blue = ((b - r > 45) & (gray < 175)).astype(np.uint8)                              # rivers and blue text, not the sea
mask[(thin_blue > 0) & (cv2.morphologyEx(thin_blue, cv2.MORPH_OPEN, np.ones((13, 13), np.uint8)) == 0)] = 255
mask[(sat > 105) & (land > 0)] = 255                                                   # coloured symbols and plates on the land
def line(paths, w):
    for d in paths: cv2.polylines(mask, [np.array(pts(d), np.int32)], False, 255, w)
line(A['roads'], 9); line(A['open'], 11); line(A['river'], 9); line(A['army_boundary'], 11); line(A['restricted'], 26); line(A['coast'], 7)   # the drawn lines themselves, generously
for a in V['areas']: x, y = A2 @ np.array([a['plate'][0], a['plate'][1], 1]); cv2.circle(mask, (int(x), int(y)), 21, 255, -1)
for v in A['vp_marks']: cv2.circle(mask, (int(v['x']), int(v['y'])), 19, 255, -1)
for p in A['port_symbols']: cv2.circle(mask, (int(p['x']), int(p['y'])), 20, 255, -1)
for p in A['airfields']: cv2.circle(mask, (int(p['x']), int(p['y'])), int(p['r']) + 6, 255, -1)
for c in A['cities']: cv2.fillPoly(mask, [np.array(pts(c['d']), np.int32)], 255)
for bx in A['boxes']:
    x0, y0, x1, y1 = bx['rect']; cv2.rectangle(mask, (int(x0) - 16, int(y0) - 16), (int(x1) + 16, int(y1) + 16), 255, -1)
    if bx.get('damage_box'): x0, y0, x1, y1 = bx['damage_box']; cv2.rectangle(mask, (int(x0) - 12, int(y0) - 12), (int(x1) + 12, int(y1) + 12), 255, -1)
mask[(gray > 222) & (land == 0)] = 255                                                 # the white dotted arrows and box edges in the sea
mask = cv2.dilate(mask, np.ones((7, 7), np.uint8))
out = cv2.inpaint(img, mask, 9, cv2.INPAINT_TELEA)
out = cv2.bilateralFilter(out, 7, 28, 7)
sea = np.median(out[(land == 0) & (mask == 0)].reshape(-1, 3), 0)                        # the printed sea colour
cv2.imwrite(OUT, out)
print('ground', out.shape, 'masked', round(float((mask > 0).mean()) * 100, 1), '% of the sheet; sea rgb', sea[::-1].astype(int))
