import json,base64,numpy as np
from scipy import ndimage as nd
meta=json.load(open('meta.json'));C,R=meta['cols'],meta['rows']
h=np.fromfile('height.bin','<u2')
w=np.fromfile('woods.bin',np.uint8);wa=np.fromfile('water.bin',np.uint8);t=np.fromfile('town.bin',np.uint8)
flags=((w.astype(int)*63//255)<<2|wa<<1|t).astype(np.uint8)
lab,n=nd.label(t.reshape(R,C));towns=[[round(float(x)*2+meta['x0'],1),round(float(y)*2+meta['y0'],1),int(s)] for (y,x),s in zip(nd.center_of_mass(t.reshape(R,C),lab,range(1,n+1)),nd.sum(t.reshape(R,C),lab,range(1,n+1)))]
M=json.load(open('/home/user/FAB/data/bulge/map.json'))
x0,y0,x1,y1=meta['x0'],meta['y0'],meta['x0']+meta['w'],meta['y0']+meta['h']
C2={a['id']:a['centroid'] for a in json.load(open('/home/user/FAB/data/bulge/areas.json'))}
areas=[{'id':a['id'],'c':C2[a['id']],'name':a['name'],'tdn':a['tdn'],'label':a['label'],'poly':[[round(p[0]),round(p[1])] for p in a['polygon'][::2]]} for a in M['areas'] if any(x0-40<p[0]<x1+40 and y0-40<p[1]<y1+40 for p in a['polygon'])]
b=lambda f:base64.b64encode(open(f,'rb').read()).decode()
D={'meta':meta,'h':base64.b64encode(h.astype('<u2').tobytes()).decode(),'f':base64.b64encode(flags.tobytes()).decode(),'towns':towns,'areas':areas}
src=open('page.html').read().replace('/*DATA*/null',json.dumps(D)).replace('__PRINTED__','data:image/jpeg;base64,'+b('printed.jpg')).replace('__OVERLAY__','data:image/png;base64,'+b('overlay.png'))
open('ardennes-relief.html','w').write(src)
print(len(towns),[a['id'] for a in areas],len(src)//1024,'KB')
