# Hand-drawn map (Illustrator)

`BulgeMap_layers.svg` / `.ai` is the source of the map. Layers, bottom to top: Areas (fill = terrain defence), Zones (fill = army zone), Entering_Zones, Boundaries, Rivers, Roads, Towns, OUTLINE.

Keep the layer names and order. Then run `python3 web/scripts/import_map.py`; it rebuilds the polygons and the board texture and reports any difference against `data/bulge/`.

## Redrawn art in the game (kept in sync with the files you send)
- `redone-markers.svg` → `web/public/chit/mk_*.png`: map markers and also the counters of the same name (Blown Bridge, Road Block, Field Works, River Assault, Disordered, Recovering, Exploitation, Boundary Crossing, reserve markers, Greif Team Bridge/Interdict chits, Out of Supply).
- `special-action-blocks.svg` → `sa_german.png`, `sa_allied.png`; `special-action-events.svg` → `sae_*.png`.
- `BulgeMap_layers.svg` → `web/public/map-base.svg`, `map-lines.svg` (`web/scripts/import_map.py`); `vp-symbols.svg` → `web/public/icons/vp-*.svg`.
- `blank/chit-templates-*.svg`: one sheet per group of chits still in code-drawn art: the old graphic on the left, a dashed square for the new one on the right.
