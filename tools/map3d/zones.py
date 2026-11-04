# German army zones (5, 6, 7) as inset outlines: union of each zone's areas, pulled 5 map px inside, written as SVG paths for zones.cjs.
import json
from shapely.geometry import Polygon
from shapely.ops import unary_union
M=json.load(open('/home/user/FAB/data/bulge/map.json'));out={}
for z in (5,6,7):
    u=unary_union([Polygon(a['polygon']).buffer(1.5) for a in M['areas'] if a['zone']==z]).buffer(-1.5-5,join_style=2)
    geoms=getattr(u,'geoms',[u]);d=[]
    for g in geoms:
        for ring in [g.exterior,*g.interiors]:
            c=list(ring.coords);d.append('M'+' L'.join(f'{x:.1f} {y:.1f}' for x,y in c)+'Z')
    out[z]=' '.join(d)
json.dump(out,open('zones.json','w'));print({k:len(v) for k,v in out.items()})
