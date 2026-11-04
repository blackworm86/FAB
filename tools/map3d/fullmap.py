# Full-map relief data for the game (web/public/relief/): height grid, woods density, snow ground image, towns and cities.
import json,os,numpy as np
from PIL import Image,ImageDraw,ImageFilter
from scipy import ndimage as nd
OUT='/home/user/FAB/web/public/relief/';os.makedirs(OUT,exist_ok=True)
M=json.load(open('/home/user/FAB/data/bulge/map.json'));W,H=M['size'];STEP=4
real=np.load('real.npy');real=nd.zoom(real,2,order=1)[:H,:W]
ids=Image.new('I',(W,H),0);d=ImageDraw.Draw(ids)
for a in M['areas']: d.polygon([tuple(p) for p in a['polygon']],fill=a['id'])
ids=np.array(ids);tdn={a['id']:a['tdn'] for a in M['areas']}
K=np.vectorize(lambda i:[0.45,0.9,1.4,2.0][tdn.get(i,1)] if i else 0.8)(ids).astype(np.float32);K=nd.gaussian_filter(K,8)
base=nd.gaussian_filter(real,30);det=real-base;h=base*0.7+det*K
m=lambda n:(np.array(Image.open(n+'.png').convert('L'))<128)
riv=m('rivers');dr=nd.distance_transform_edt(~riv)
h-=55*np.exp(-(dr/9)**2)+20*np.exp(-(dr/26)**2)
h=np.where(dr<2.5,np.minimum(h,nd.minimum_filter(h,7)),h)
b411=(ids==4)&nd.binary_dilation(ids==11,iterations=3)|(ids==11)&nd.binary_dilation(ids==4,iterations=3)
ds=nd.distance_transform_edt(~b411);h+=110*np.exp(-(ds/10)**2)+40*np.exp(-(ds/30)**2)
h=nd.gaussian_filter(h,1.2)
land=ids>0;lo=float(h[land].min());h=h-lo                                 # the diorama is the playing area: the union of the game's areas
dist,(iy,ix)=nd.distance_transform_edt(~land,return_indices=True)       # off it the heights carry on from the nearest land, so the cut sides stand straight
h=np.where(land,h,h[iy,ix]);h=np.maximum(h,0)
g=h[::STEP,::STEP];hi=float(g.max());rows,cols=g.shape
np.round(g/hi*65535).astype('<u2').tofile(OUT+'height.bin')
entryA=nd.binary_dilation(np.array(Image.open(OUT+'entry.png').convert('RGBA'))[...,3]>20,iterations=6)          # no trees on the entry strips
woods=(np.array(Image.open('woods.png').convert('RGB')).astype(int).sum(2)<700)&land&~entryA
wd=nd.uniform_filter(woods.astype(np.float32),STEP+1)[::STEP,::STEP];np.round(wd*255).astype(np.uint8).tofile(OUT+'woods.bin')
# towns (circles) and cities (footprint cells, 4 px)
tm=np.array(Image.open('townsonly.png').convert('L'))<128;lab,n=nd.label(tm)
towns=[[round(float(x),1),round(float(y),1)] for y,x in nd.center_of_mass(tm,lab,range(1,n+1))]
cm=np.array(Image.open('cities.png').convert('L'))<128;lab,n=nd.label(cm);cities=[]
for k,(y,x) in enumerate(nd.center_of_mass(cm,lab,range(1,n+1))):
  ys,xs=np.nonzero(lab==k+1);cells=sorted({(int(a)//4*4+2,int(b)//4*4+2) for a,b in zip(xs,ys)})
  cells=[c for c in cells if lab[min(c[1],H-1),min(c[0],W-1)]==k+1]
  cities.append({'c':[round(float(x),1),round(float(y),1)],'cells':cells})
# snow ground: fields white, woods pale green, towns grey; off the land the printed frame and entry bars stay
img=np.array(Image.open('map-base.png').convert('RGB')).astype(np.float32)
paved=np.zeros((H,W),bool);yy,xx=np.mgrid[0:H,0:W]
for x,y in towns: paved|=(xx-x)**2+(yy-y)**2<81
paved|=nd.binary_dilation(cm,iterations=2)
wsoft=np.clip(nd.gaussian_filter(nd.uniform_filter(woods.astype(np.float32),5),2.0)*1.6-0.3,0,1)
snow=np.array([241,244,248],np.float32)*(1-wsoft[...,None])+np.array([158,186,168],np.float32)*wsoft[...,None]
snow=np.where(paved[...,None],np.array([200,202,206],np.float32),snow)
q=np.array(Image.fromarray(snow.astype(np.uint8)).quantize(24).convert('RGB'))
Image.fromarray(np.dstack([q,np.where(land,255,0).astype(np.uint8)])).quantize(25,method=Image.Quantize.FASTOCTREE).save(OUT+'snow.png',optimize=True)     # transparent off the land
from shapely.geometry import Polygon
from shapely.ops import unary_union
u=unary_union([Polygon(a['polygon']).buffer(1.2) for a in M['areas']]).buffer(-1.2).simplify(0.6)
rings=[[[round(x,1),round(y,1)] for x,y in r.coords] for g2 in getattr(u,'geoms',[u]) for r in [g2.exterior,*g2.interiors]]
json.dump({'outline':rings,'w':W,'h':H,'step':STEP,'cols':cols,'rows':rows,'metres':hi,'towns':towns,'cities':cities},open(OUT+'relief.json','w'),separators=(',',':'))
print(rows,cols,round(hi,1),len(towns),len(cities),{f:os.path.getsize(OUT+f)//1024 for f in os.listdir(OUT)})
