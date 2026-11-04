# Packs the three border renders (bR, bG, bB from borders.cjs) into borders.png for the region: R solid core, G dashed core, B wide halo.
import json,numpy as np
from PIL import Image
m=json.load(open('meta.json'));X0,Y0,W,H=m['x0'],m['y0'],m['w'],m['h']
ch=[255-np.array(Image.open(n+'.png').convert('L').crop((X0*2,Y0*2,(X0+W)*2,(Y0+H)*2))) for n in ['bR','bG','bB']]
Image.fromarray(np.stack(ch,2).astype(np.uint8)).save('borders.png',optimize=True)
