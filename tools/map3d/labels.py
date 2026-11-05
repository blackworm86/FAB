# Label placement, pass 2: the label (number plate in its TDN shape, VP stars, name) goes where it covers the least printed detail
# (towns, cities, roads, rivers) and leaves the biggest clear spot for the pieces. Writes data/bulge/labels.json.
import json, numpy as np
from PIL import Image
from shapely.geometry import Polygon, box
from shapely.ops import polylabel
from scipy import ndimage as nd
D='/tmp/claude-0/-home-user/a1c94234-d293-5e86-91af-6e8f1a3ddf07/scratchpad/m3d/'
M=json.load(open('/home/user/FAB/data/bulge/map.json'))
mask=lambda n:np.array(Image.open(D+n+'.png').convert('L'))<128
W={'townsonly':6.0,'cities':6.0,'rivers':2.0,'roads':1.4}
cost=np.zeros(mask('roads').shape,np.float32)
for n,w in W.items(): cost+=nd.binary_dilation(mask(n),iterations=3)*w
I=cost.cumsum(0).cumsum(1)
def boxcost(x0,y0,x1,y1):
    x0,y0,x1,y1=[int(round(v)) for v in (x0,y0,x1,y1)]; x0=max(x0,1);y0=max(y0,1)
    return float(I[y1,x1]-I[y0-1,x1]-I[y1,x0-1]+I[y0-1,x0-1])
out={}
for a in M['areas']:
    P=Polygon(a['polygon']).buffer(0); inner=P.buffer(-5)
    vp=a['vp']; nvp=vp['allied']+vp['german']+(1 if vp['mutual'] else 0)
    nw=len(a['name'])*7.4+6; best=None
    for mode,w,h in [('full',max(nw,32+nvp*21),46),('plate',32+nvp*21,30)]:
        if inner.is_empty: break
        b=inner.bounds; cand=[]
        for cy in np.arange(b[1]+h/2,b[3]-h/2+1,4):
            for cx in np.arange(b[0]+w/2,b[2]-w/2+1,4):
                bx=box(cx-w/2,cy-h/2,cx+w/2,cy+h/2)
                if not inner.contains(bx): continue
                rest=inner.difference(bx.buffer(5))
                if rest.is_empty: continue
                rp=max(rest.geoms,key=lambda g:g.area) if rest.geom_type=='MultiPolygon' else rest
                pc=polylabel(rp,1.0); pr=rp.exterior.distance(pc)
                c=boxcost(cx-w/2,cy-h/2,cx+w/2,cy+h/2)/(w*h)
                cand.append((min(pr,36)*2.2 - c*55, cx, cy, pc, pr, c))
        if cand:
            s,cx,cy,pc,pr,c=max(cand,key=lambda t:t[0])
            if mode=='full' and pr<14 and c>0.6: continue   # too cramped for the full label: number only
            best=dict(mode=mode,x=round(float(cx),1),y=round(float(cy),1),w=round(w,1),h=h,px=round(pc.x,1),py=round(pc.y,1),pr=round(pr,1),clutter=round(c,2)); break
    if not best:
        c=polylabel(P,1.0); best=dict(mode='plate',x=round(c.x,1),y=round(c.y,1),w=32,h=30,px=round(c.x,1),py=round(c.y+24,1),pr=8,clutter=0)
    out[a['id']]=best
json.dump(out,open('/home/user/FAB/data/bulge/labels.json','w'),separators=(',',':'))
from collections import Counter
print(Counter(v['mode'] for v in out.values()), 'mean clutter', round(np.mean([v['clutter'] for v in out.values()]),2), 'worst', sorted(((v['clutter'],k) for k,v in out.items()))[-5:])
