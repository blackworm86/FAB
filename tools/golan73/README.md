# Golan '73 data tools

## The game map (from the hand-drawn SVG)

`docs/games/golan73/maps/GolanMap.svg` is the map redrawn by hand in layers (areas filled by terrain difficulty, rivers, lakes, open / AT ditch / wadi / escarpment / rugged boundaries, Mt Hermon, roads, assembly areas, 1 MP and all-MP arrows, SAM barrier, operational boundaries, Syrian alternate set-up squares, Israeli supply sources, Syrian and mutual VPs, map edge). Run from the repo root:

1. `python3 -I tools/golan73/svgmap.py docs/games/golan73/maps/GolanMap.svg data/golan73/map_vassal.json data/golan73/map.json data/golan73/map_art.json`
   The SVG carries no area numbers, so each drawn area is paired with its Vassal zone (`map_vassal.json`, ids and names) by fitting the two maps on each other and matching by overlap (all 83 pair up, 96% mean overlap). Everything else is read from the layers: TDN from the fill, VPs, supply, alternate set-up areas, adjacency from shared edges (areas that only meet at a corner are not adjacent), and for each edge the boundary types drawn along it and whether a road crosses it. `map_art.json` keeps the line work for the board.
2. `python3 -I tools/golan73/terrain.py <scratch>`: the real elevation (Terrarium tiles, AWS open data) bent onto the game map by a thin-plate spline through about forty places whose position is known; writes `<scratch>/real.npy`. Nothing in the scratch folder is committed.
   `python3 -I tools/golan73/board.py data/golan73 web/public/golan73 <scratch>/real.npy docs/games/golan73/maps/GolanMap.svg`: the board in the series look. `map-base.svg`: one sandy ground shaded by the real relief and speckled with basalt where the terrain is rough (as The Bulge's ground carries its woods), the Hermon massif, the Leja, the lakes, the Assembly boxes, the green Syrian entry triangles, the Israeli supply sources and the alternate set-up tanks. `map-lines.svg`: the line work in the printed legend's styles (hachured escarpment, ditch band with the Purple Line on its Syrian side, sector and SAM lines) drawn with The Bulge's cased borders, roads and rivers. Also writes `data/golan73/entry_marks.json` (where the entry letters go). Numbers, names, VPs and entry letters are printed at run time.
   `python3 -I tools/golan73/relief.py <scratch>`: the 3D map (`web/public/golan73/relief/`), as tools/map3d does for The Bulge: real metres twice raised, the Hermon summit compressed, flat lakes, a sharper step on the drawn escarpment, sparse oak scrub and orchards.
3. `python3 -I tools/golan73/labels.py data/golan73`: where each area's label and piece spot go (`labels.json`), as for The Bulge.

After editing the SVG, run the three steps again. `npm run dev` in `web/` and open `golan-sheet.html` to see the board with its labels and every block, counter and back drawn by `web/src/golan-art.ts`.

## The Vassal draft (kept for ids and names)

Drafts built from the Vassal module in `docs/games/golan73/other/FAB_Golan73.vmod` (unzip it to a scratch folder first; its images are reference only and are never committed).

1. `python3 -I zones.py <unzipped vmod> zones.json`: the 83 area polygons, names, label points and adjacency from the module's map zones.
2. `python3 -I mapdraft.py zones.json "<unzipped vmod>/images/FAB Golan MAP FINAL-120.jpg" data/golan73/map_vassal.json`: adds the values read off the module's map. Superseded by the hand-drawn map above; kept because it gives the area ids and names.
