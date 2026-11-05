# Golan '73 data tools

Drafts built from the Vassal module in `docs/games/golan73/other/FAB_Golan73.vmod` (unzip it to a scratch folder first; its images are reference only and are never committed).

1. `python3 -I zones.py <unzipped vmod> zones.json`: the 83 area polygons, names, label points and adjacency from the module's map zones.
2. `python3 -I mapdraft.py zones.json "<unzipped vmod>/images/FAB Golan MAP FINAL-120.jpg" data/golan73/map.json`: adds the values read off the map (TDN from the plate shapes, VP spaces, supply sources, entry and assembly areas) and the boundary types whose colour is distinctive (river, SAM barrier, Purple Line). Every other boundary type is `review` until the hand-drawn map gives it.
