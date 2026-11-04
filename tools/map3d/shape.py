import json,numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage as nd
M=json.load(open('/home/user/FAB/data/bulge/map.json'));W,H=M['size']
real=np.load('real.npy');real=nd.zoom(real,2,order=1)[:H,:W]          # 1 px grid
ids=Image.new('I',(W,H),0);d=ImageDraw.Draw(ids)
for a in M['areas']: d.polygon([tuple(p) for p in a['polygon']],fill=a['id'])
ids=np.array(ids);tdn={a['id']:a['tdn'] for a in M['areas']}
# per-area relief scale by terrain defence: 0 gentle .. 3 rugged
K=np.vectorize(lambda i:[0.45,0.9,1.4,2.0][tdn.get(i,1)] if i else 0.8)(ids).astype(np.float32);K=nd.gaussian_filter(K,8)
base=nd.gaussian_filter(real,30);det=real-base
h=base*0.7+det*K
m=lambda n:(np.array(Image.open(n+'.png').convert('L'))<128)
riv=m('rivers');dr=nd.distance_transform_edt(~riv)
h-=55*np.exp(-(dr/9)**2)+20*np.exp(-(dr/26)**2)                       # every game river sits in a valley
h=np.where(dr<2.5,np.minimum(h,nd.minimum_filter(h,7)),h)
# Schnee Eifel: the 4-11 border becomes a ridge
b411=(ids==4)&nd.binary_dilation(ids==11,iterations=3)|(ids==11)&nd.binary_dilation(ids==4,iterations=3)
ds=nd.distance_transform_edt(~b411);h+=110*np.exp(-(ds/10)**2)+40*np.exp(-(ds/30)**2)
h=nd.gaussian_filter(h,1.2)
X0,Y0,RW,RH=930,320,650,480
r=h[Y0:Y0+RH+1:2,X0:X0+RW+1:2];print(r.shape,r.min(),r.max())
lo,hi=float(r.min()),float(r.max());q=np.round((r-lo)/(hi-lo)*65535).astype(np.uint16)
q.astype('<u2').tofile('height.bin')
woods=(np.array(Image.open('woods.png').convert('RGB')).astype(int).sum(2)<700)
wd=nd.uniform_filter(woods.astype(np.float32),5)[Y0:Y0+RH+1:2,X0:X0+RW+1:2]
(np.round(wd*255).astype(np.uint8)).tofile('woods.bin')
w=(nd.distance_transform_edt(~riv)<2.2)[Y0:Y0+RH+1:2,X0:X0+RW+1:2];w.astype(np.uint8).tofile('water.bin')
twn=m('towns')[Y0:Y0+RH+1:2,X0:X0+RW+1:2];twn.astype(np.uint8).tofile('town.bin')
json.dump({'x0':X0,'y0':Y0,'w':RW,'h':RH,'step':2,'cols':r.shape[1],'rows':r.shape[0],'lo':lo,'hi':hi},open('meta.json','w'))
Image.fromarray((q>>8).astype(np.uint8)).save('h.png')
for n,src in [('printed','printed.png'),('overlay','overlay.png')]:
  im=Image.open(src).crop((X0*2,Y0*2,(X0+RW)*2,(Y0+RH)*2))
  if n=='printed': im.convert('RGB').save(n+'.jpg',quality=82)
  else:
    a=np.array(im);a[...,3]=np.where(a[...,3]<10,0,a[...,3]);Image.fromarray(a).save(n+'.png',optimize=True)
