# Hand-drawn map (Illustrator)

`BulgeMap_layers.svg` / `.ai` is the source of the map. Layers, bottom to top: Areas (fill = terrain defence), Zones (fill = army zone), Entering_Zones, Boundaries, Rivers, Roads, Towns, OUTLINE.

Keep the layer names and order. Then run `python3 web/scripts/import_map.py`; it rebuilds the polygons and the board texture and reports any difference against `data/bulge/`.

## Confirmed art (the only versions kept)
- `BulgeMap_layers.svg` / `.ai`: the map (layers, then `web/scripts/import_map.py` → `web/public/map-base.svg`, `map-lines.svg`).
- `vp-symbols.svg` → `web/public/icons/vp-*.svg`.
- `redone-markers.svg` → `web/public/chit/mk_*.png`: map markers and the counters of the same name (Blown Bridge, Road Block, Field Works, River Assault, Disordered, Recovering, Exploitation, Boundary Crossing, reserve markers, Greif Team Bridge/Interdict, Out of Supply).
- `special-action-blocks.svg` → `sa_german.png`, `sa_allied.png`; `special-action-events.svg` → `sae_*.png`.
- `fuel-chit.svg` → `mk_FUEL.png` (the German Fuel asset).

## Still to redraw
- Unit blocks (`fab-blocks.svg` is the current art) and the chits not listed above. Ask for fresh templates when you are ready: each shows the old graphic beside an empty square.

Older sheets, blank templates and PDFs were removed once their art was confirmed; they stay in the git history.
