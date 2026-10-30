# Piece assets

Generated from `docs/game-pieces/` by the scripts in `tools/` (see `tools/slice_counters.py`, `catalog_counters.py`, `catalog_blocks.py`, `build_reinforcements.py`).

- `counters/raw/<id>.png` – 160×160 scans of the 190 front-side counters (ids: sheet `L`/`R` + row + column, `Rx` exploitation, `Rb` bid fuel). Edges carry a few pixels of neighbouring tiles.
- `blocks/B01..B73.png` – label scans for the 73 unit blocks, `SA1/SA2` – the two reusable Special Action block labels. Neighbouring labels bleed in slightly at the edges; the app will redraw labels from data, the scans are for reference and a fallback texture.
- Data: `data/bulge/counters.json` (190), `data/bulge/units.json` (73 units + 2 Special Action blocks), `data/bulge/reinforcements.json` (schedule per turn).

Block step reading: `steps` = pips on the top edge; `quality_by_step[i]` is the troop quality when the block has `i+1` steps (index 0 = 1 step, last = full strength). Rotating the block 90° counter-clockwise on a step loss brings the next edge to the top.

- `counters/backs/*.png` – the 19 distinct back faces (low resolution, upscaled 2x from the back sheet) plus `gear_front.png` (the gear side of the 38 Blown Bridge counters). Catalogue: `data/bulge/counter_backs.json`; each counter in `counters.json` has `back`, `copies`, `ids`, `limit`.
- `counters/combined/<id>.png` – one image per physical counter with both faces (front left, back right); `counters.json` has `faces.front`, `faces.back` and `combined` for each of the 137 counter entries (228 physical counters in all).
