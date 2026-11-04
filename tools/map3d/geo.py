import json,math,numpy as np
from PIL import Image
from scipy.interpolate import RBFInterpolator
M=json.load(open('/home/user/FAB/data/bulge/map.json'));L={a['name']:a['label'] for a in M['areas']}
REAL={'Bitburg':(6.527,49.967),'Prüm':(6.424,50.207),'Losheim':(6.27,50.395),'Blankenheim':(6.650,50.437),'Schleiden':(6.475,50.530),'Monschau':(6.240,50.555),
'Aachen':(6.084,50.776),'Eupen':(6.036,50.628),'Spa':(5.865,50.492),'Malmedy':(6.028,50.426),'Trois Ponts':(5.871,50.372),'St. Vith':(6.127,50.282),
'Vielsalm':(5.915,50.284),'Houffalize':(5.790,50.132),'Bastogne':(5.719,50.003),'Wiltz':(5.932,49.966),'Diekirch':(6.159,49.868),'Echternach':(6.418,49.812),
'Luxembourg City':(6.130,49.611),'Arlon':(5.817,49.683),'Neufchâteau':(5.435,49.841),'St. Hubert':(5.374,50.027),'Marche':(5.344,50.227),'La Roche':(5.576,50.183),
'Hotton':(5.447,50.268),'Liège':(5.567,50.633),'Verviers':(5.862,50.589),'Huy':(5.239,50.519),'Namur':(4.867,50.467),'Dinant':(4.912,50.261),'Givet':(4.826,50.138),
'Rochefort':(5.222,50.162),'Ciney':(5.100,50.294),'Bleialf':(6.283,50.233),'Elsenborn':(6.215,50.460),'Ligneuville':(6.070,50.380),'Werbomont':(5.685,50.380),
'Manhay':(5.675,50.293),'Stoumont':(5.808,50.408),'Marnach':(6.080,50.050),'Weiswampach':(6.075,50.140),'Ettelbruck':(6.104,49.847),'Udenbreth':(6.370,50.420),'Dasburg':(6.135,50.048)}
P=np.array([L[k] for k in REAL],float);G=np.array([REAL[k] for k in REAL],float)
tps=RBFInterpolator(P,G,kernel='thin_plate_spline',smoothing=1e5)
res=G-tps(P);print('fit residual km',np.round(np.hypot(res[:,0]*71,res[:,1]*111).mean(),2))
z=11;x0,y0=1050,686;dem=np.zeros((14*256,14*256),np.float32)
for i in range(14):
  for j in range(14):
    a=np.array(Image.open(f'tiles/{z}_{x0+i}_{y0+j}.png').convert('RGB')).astype(np.float32)
    dem[j*256:(j+1)*256,i*256:(i+1)*256]=a[...,0]*256+a[...,1]+a[...,2]/256-32768
def elev(lon,lat):
  n=2**z;X=(lon+180)/360*n;Y=(1-np.arcsinh(np.tan(np.radians(lat)))/np.pi)/2*n
  px=(X-x0)*256-.5;py=(Y-y0)*256-.5;i=np.floor(px).astype(int);j=np.floor(py).astype(int);fx=px-i;fy=py-j
  g=lambda a,b:dem[np.clip(b,0,dem.shape[0]-1),np.clip(a,0,dem.shape[1]-1)]
  return g(i,j)*(1-fx)*(1-fy)+g(i+1,j)*fx*(1-fy)+g(i,j+1)*(1-fx)*fy+g(i+1,j+1)*fx*fy
# real elevation for every map pixel, 2 px grid
ys,xs=np.mgrid[0:1584:2,0:1740:2];q=np.c_[xs.ravel(),ys.ravel()].astype(float)
ll=tps(q);H=elev(ll[:,0],ll[:,1]).reshape(xs.shape)
np.save('real.npy',H);print(H.shape,H.min(),H.max())
Image.fromarray(np.clip((H-H.min())/(H.max()-H.min())*255,0,255).astype(np.uint8)).save('real.png')
