# Hand-drawn map (Illustrator)

`BulgeMap_layers.svg` / `.ai` is the source of the map. Layers, bottom to top: Areas (fill = terrain defence), Zones (fill = army zone), Entering_Zones, Boundaries, Rivers, Roads, Towns, OUTLINE.

Keep the layer names and order. Then run `python3 web/scripts/import_map.py`; it rebuilds the polygons and the board texture and reports any difference against `data/bulge/`.
