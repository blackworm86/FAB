# 3D relief mockup (St. Vith – Malmedy)

Offline build of the low-poly relief described in docs/PLAN-3D-MAP.md. Run from a scratch folder (outputs land in the current directory):

1. `python3 fetch.py`: Terrarium elevation tiles (zoom 11) for the map area into `tiles/`.
2. `python3 geo.py`: thin-plate-spline warp from 44 towns (game label → real lon/lat), real elevation for every map pixel (`real.npy`).
3. `node raster.cjs`: woods, rivers, roads, towns, borders masks from the map SVGs. `node cap.cjs` / `node cap2.cjs`: the printed board and the transparent printed layer from the running dev server (`?sandbox=1`, uses `__fab.board()`).
4. `python3 shape.py`: game shaping (TDN scales the relief, rivers cut valleys, Schnee Eifel ridge) and the region crop.
5. `python3 pack.py`: embeds everything into `ardennes-relief.html` (from `page.html`).

Elevation data: Mapzen Terrarium tiles (AWS open data). Nothing generated here is committed.
