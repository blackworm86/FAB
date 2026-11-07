"""The real ground of a game map from open satellite data, in the season the game is set in: Sentinel-2 true colour (AWS open data,
sentinel-cogs) and ESA WorldCover land cover (tree cover, built-up, water...), sampled on the map's own grid.

Usage: python3 -I tools/terrain/satellite.py <scratch> <year> <months> <utm zone> <lat band> <squares or *> [max cloud %]  (run once per UTM zone the map spans; each run adds to sat.png)
  e.g. python3 -I tools/terrain/satellite.py <s>/sicily-terrain 2023 7,8 33 S TA,TB,TC,UA,UB,UC,VA,VB,VC,WA,WB,WC,XA,XB,XC 8
Reads <scratch>/lonlat.npy (longitude, latitude of every point of the map's 2 px grid, from the game's terrain.py) and writes
<scratch>/sat.png (true colour, the clearest scene of each tile in those months, 10 m data read at 80 m) and <scratch>/landcover.npy
(WorldCover classes: 10 trees, 20 shrub, 30 grass, 40 crops, 50 built-up, 60 bare, 70 snow, 80 water, 90 wetland, 95 mangrove, 100 moss).
WorldCover tiles are fetched into <scratch>/wc/ as needed. Nothing here is committed.
"""
import json, os, subprocess, sys
import numpy as np, rasterio
from rasterio.warp import transform as tf
from PIL import Image

os.environ.setdefault('CURL_CA_BUNDLE', '/root/.ccr/ca-bundle.crt'); os.environ.setdefault('GDAL_CURL_CA_BUNDLE', '/root/.ccr/ca-bundle.crt')
OUT, YEAR, MONTHS, ZONE, BAND, SQUARES = sys.argv[1:7]; MAXCLOUD = float(sys.argv[7]) if len(sys.argv) > 7 else 10
ll = np.load(OUT + '/lonlat.npy'); R, C, _ = ll.shape; lon, lat = ll[..., 0].ravel().astype(float), ll[..., 1].ravel().astype(float)
bbox = (lon.min(), lat.min(), lon.max(), lat.max()); print('map covers lon %.2f..%.2f lat %.2f..%.2f' % bbox)
S3 = 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/'
get = lambda url: subprocess.run(['curl', '-sS', '--retry', '3', '--max-time', '120', url], capture_output=True, text=True).stdout

# ---------- Sentinel-2: the clearest scene of each tile in the chosen months ----------
sat = np.zeros((R * C, 3), np.float32); have = np.zeros(R * C, bool)
if os.environ.get('ADD') and os.path.exists(OUT + '/sat_have.npy'): sat = np.array(Image.open(OUT + '/sat.png').convert('RGB')).reshape(-1, 3).astype(np.float32); have = np.load(OUT + '/sat_have.npy').ravel()
if SQUARES == '*':                                                                  # every grid square of the zone and band: those off the map are skipped by their footprint
    SQUARES = ','.join(p.split('</Prefix>')[0].rstrip('/').split('/')[-1] for p in get(f'{S3}?prefix=sentinel-s2-l2a-cogs/{ZONE}/{BAND}/&delimiter=/').split('<Prefix>')[2:])
for sq in SQUARES.split(','):
    best = None
    for mo in MONTHS.split(','):
        lst = get(f'{S3}?prefix=sentinel-s2-l2a-cogs/{ZONE}/{BAND}/{sq}/{YEAR}/{mo}/&delimiter=/')
        for pre in [p.split('</Prefix>')[0] for p in lst.split('<Prefix>')[2:]]:
            sid = pre.rstrip('/').split('/')[-1]
            try: meta = json.loads(get(f'{S3}{pre}{sid}.json'))
            except Exception: continue
            cc = meta['properties'].get('eo:cloud_cover', 100); bb = meta.get('bbox')
            if not bb: continue
            ov = max(0, min(bb[2], bbox[2]) - max(bb[0], bbox[0])) * max(0, min(bb[3], bbox[3]) - max(bb[1], bbox[1]))   # how much of the map this scene's data covers
            if ov <= 0: continue
            score = ov * (1 - cc / 100) ** 2                                                     # the widest clear scene wins
            if cc <= MAXCLOUD and (best is None or score > best[2]): best = (cc, pre, score)
    if best is None: print(sq, 'off the map or no clear scene'); continue
    cc, pre, _ = best; print(sq, pre.split('/')[-2], 'cloud %.1f%%' % cc)
    with rasterio.open('/vsicurl/' + S3 + pre + 'TCI.tif') as ds:
        a = ds.read(out_shape=(3, ds.height // 8, ds.width // 8)); sx, sy = ds.width / a.shape[2], ds.height / a.shape[1]
        xs, ys = tf('EPSG:4326', ds.crs, lon, lat); xs, ys = np.array(xs), np.array(ys)
        col, row = (~ds.transform) * (xs, ys); col = np.floor(col / sx).astype(int); row = np.floor(row / sy).astype(int)
        ok = (col >= 0) & (row >= 0) & (col < a.shape[2]) & (row < a.shape[1])
        px = a[:, row[ok], col[ok]].T.astype(np.float32); valid = px.sum(1) > 0                    # black = no data at the scene's edge
        fill = ok.copy(); fill[ok] = valid & ~have[ok]
        sat[fill] = px[valid & ~have[ok]]; have |= fill
print('satellite cover %.1f%% of the grid' % (have.mean() * 100))
sat = sat.reshape(R, C, 3); Image.fromarray(np.clip(sat, 0, 255).astype(np.uint8)).save(OUT + '/sat.png'); np.save(OUT + '/sat_have.npy', have.reshape(R, C))

# ---------- ESA WorldCover 2021: the land cover class of every grid point ----------
os.makedirs(OUT + '/wc', exist_ok=True)
lc = np.zeros(R * C, np.uint8)
for la in range(int(np.floor(bbox[1] / 3) * 3), int(np.floor(bbox[3] / 3) * 3) + 1, 3):
    for lo in range(int(np.floor(bbox[0] / 3) * 3), int(np.floor(bbox[2] / 3) * 3) + 1, 3):
        name = f'ESA_WorldCover_10m_2021_v200_{"N" if la >= 0 else "S"}{abs(la):02d}{"E" if lo >= 0 else "W"}{abs(lo):03d}_Map.tif'; f = f'{OUT}/wc/{name}'
        if not os.path.exists(f) or os.path.getsize(f) < 1000:
            subprocess.run(['curl', '-sS', '--retry', '3', '--max-time', '900', '-o', f, f'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/{name}'])
        if os.path.getsize(f) < 1000: print(name, 'is not a tile (sea)'); continue
        with rasterio.open(f) as ds:
            a = ds.read(1, out_shape=(ds.height // 8, ds.width // 8)); sx, sy = ds.width / a.shape[1], ds.height / a.shape[0]
            col, row = (~ds.transform) * (lon, lat); col = np.floor(col / sx).astype(int); row = np.floor(row / sy).astype(int)
            ok = (col >= 0) & (row >= 0) & (col < a.shape[1]) & (row < a.shape[0]); lc[ok] = a[row[ok], col[ok]]
        print(name, 'done')
lc = lc.reshape(R, C); np.save(OUT + '/landcover.npy', lc)
print('land cover classes', {int(v): round(float(c) / lc.size * 100, 1) for v, c in zip(*np.unique(lc, return_counts=True))})
