"""Cut the illustrations (not the lettering) out of the printed chits: fuel barrels, the two Bodenplatte fighters, the Allied Air Mission fighters,
and the Special Action arrow with its tank. Output: web/public/chit/*.png|jpg and src/chit-art.ts (file names and boxes). Lettering is redrawn as vector text."""
import io, json, os, cv2, numpy as np
from PIL import Image
SC = 4
FILES = {}
def png(rgba, w=None):
    im = Image.fromarray(cv2.cvtColor(rgba, cv2.COLOR_BGRA2RGBA)); im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS); b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return b.getvalue()
BLOBS = {}
def put(key, data, ext): BLOBS[key] = (data, ext)
def load(n): im = cv2.imread(f'../assets/counters/raw/{n}.png'); return cv2.resize(im, None, fx=SC, fy=SC, interpolation=cv2.INTER_CUBIC)
def finish(big, mask, box):
    mask = cv2.erode(mask, np.ones((5, 5), np.uint8)); mask = cv2.GaussianBlur(mask, (0, 0), 1.2)
    rgba = np.dstack([big, mask]); x0, y0, x1, y1 = [v * SC for v in box]
    return rgba[y0:y1, x0:x1], (box[0], box[1], box[2] - box[0], box[3] - box[1])
def comps(fg, min_area):
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg); keep = np.zeros_like(fg)
    for k in range(1, n):
        if st[k][4] > min_area: keep[lab == k] = 255
    return keep
out = {}
# fuel barrels: everything that is neither the orange panel, the yellow lettering nor the white corner box
big = load('R17'); b, g, r = [big[:, :, i].astype(int) for i in range(3)]; hsv = cv2.cvtColor(big, cv2.COLOR_BGR2HSV); h, s, v = [x.astype(int) for x in cv2.split(hsv)]
orange = (h > 5) & (h < 22) & (s > 150); yellow = (h >= 22) & (h < 35) & (s > 150) & (v > 150)
fg = (~(orange | yellow)).astype(np.uint8) * 255; box = np.zeros_like(fg); box[22 * SC:92 * SC, 18 * SC:112 * SC] = 255; fg &= box
fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)); fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((13, 13), np.uint8)); fg = comps(fg, 6000)
rgba, bx = finish(big, fg, (16, 20, 114, 100)); put('fuel', png(rgba), 'png'); out['fuelBox'] = bx
# fighters on a sky background
def planes(name, region, min_area):
    big = load(name); b, g, r = [big[:, :, i].astype(int) for i in range(3)]
    sky = (b - r > 22) & (b > 150); fg = (~sky).astype(np.uint8) * 255; box = np.zeros_like(fg); x0, y0, x1, y1 = [q * SC for q in region]; box[y0:y1, x0:x1] = 255; fg &= box
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)); fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)); fg = comps(fg, min_area)
    return big, fg
big, fg = planes('R21', (20, 24, 146, 84), 2600); rgba, bx = finish(big, fg, (18, 22, 148, 86)); put('boden', png(rgba), 'png'); out['bodenBox'] = bx
big, fg = planes('R41', (20, 42, 146, 90), 6000); rgba, bx = finish(big, fg, (18, 40, 148, 92)); put('air', png(rgba), 'png'); out['airBox'] = bx
# Special Action arrow: key the purple panel out so the yellow arrow, tank and black arrows float on any panel colour
sa = np.array(Image.open('../assets/counters/raw/R38.png').convert('RGB')).astype(int); crop = sa[52:124, 18:148]; panel = np.median(sa[100:110, 125:140].reshape(-1, 3), axis=0)
d = np.abs(crop - panel).sum(axis=2); alpha = np.clip((d - 40) * 5, 0, 255).astype(np.uint8)
im = Image.fromarray(np.dstack([crop.astype(np.uint8), alpha]), 'RGBA'); b = io.BytesIO(); im.save(b, 'PNG', optimize=True); put('saArrow', b.getvalue(), 'png')
# the tank on the Exploitation counter: silhouette from its black outline, filled
im4 = cv2.resize(cv2.imread('../assets/counters/raw/Rx1.png'), None, fx=SC, fy=SC, interpolation=cv2.INTER_CUBIC)
x0, y0, x1, y1 = 14 * SC, 98 * SC, 108 * SC, 154 * SC; crop = im4[y0:y1, x0:x1]; g = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
dark = (g < 105).astype(np.uint8) * 255; dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
cs, _ = cv2.findContours(dark, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); sil = np.zeros_like(dark)
for c in cs:
    if cv2.contourArea(c) > 3000: cv2.drawContours(sil, [c], -1, 255, -1)
sil = cv2.GaussianBlur(cv2.erode(sil, np.ones((3, 3), np.uint8)), (0, 0), 1.2)
tank = np.dstack([crop, sil]); put('tank', png(tank), 'png'); out['tankBox'] = (14, 98, 94, 56)
# the three illustrated markers: inner artwork of the printed counter, denoised and upscaled, to sit on a vector frame
def art(name, box, size=420):
    im = cv2.imread(f'../assets/counters/raw/{name}.png'); x0, y0, x1, y1 = box; c = im[y0:y1, x0:x1]
    c = cv2.fastNlMeansDenoisingColored(c, None, 6, 6, 5, 15); c = cv2.resize(c, (size, size), interpolation=cv2.INTER_LANCZOS4)
    c = cv2.addWeighted(c, 1.5, cv2.GaussianBlur(c, (0, 0), 2.2), -0.5, 0)
    return jpg_arr(c)
def jpg_arr(c):
    b = io.BytesIO(); Image.fromarray(cv2.cvtColor(c, cv2.COLOR_BGR2RGB)).save(b, 'JPEG', quality=90); return b.getvalue()
for k, n, box in (('artBoundary', 'R67', (6, 17, 159, 155)), ('artBridge', 'R89', (6, 17, 152, 159)), ('artRiver', 'R92', (8, 17, 154, 155))): put(k, art(n, box), 'jpg')
os.makedirs('public/chit', exist_ok=True)
for f in os.listdir('public/chit'): os.remove('public/chit/' + f)
files = {}
for k, (data, ext) in BLOBS.items():
    files[k] = f'{k}.{ext}'; open(f'public/chit/{k}.{ext}', 'wb').write(data)
open('src/chit-art.ts', 'w').write('// generated by scripts/chit_art.py from the printed counters: image file names (in public/chit) and cut-out boxes\nexport const CHIT_FILES = ' + json.dumps(files) + ' as const;\nexport const CHIT_BOXES = ' + json.dumps({k: v for k, v in out.items() if k.endswith('Box')}) + ' as const;\n')
print(files, {k: len(d) // 1024 for k, (d, e) in BLOBS.items()})
