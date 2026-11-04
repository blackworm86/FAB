# Packs the zone masks for the region: R = zone 5, G = zone 6, B = zone 7.
import json,numpy as np
from PIL import Image
m=json.load(open('meta.json'));X0,Y0,W,H=m['x0'],m['y0'],m['w'],m['h']
ch=[255-np.array(Image.open(f'z{z}.png').convert('L').crop((X0*2,Y0*2,(X0+W)*2,(Y0+H)*2))) for z in (5,6,7)]
Image.fromarray(np.stack(ch,2).astype(np.uint8)).save('zones.png',optimize=True);print([round(c.mean(),2) for c in ch])
