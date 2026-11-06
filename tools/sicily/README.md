# FAB: Sicily data tools

## Pieces: blocks, counters, set-ups (`pieces.py`)

Writes `data/sicily/units.json`, `counters.json`, `counter_backs.json`, `reinforcements.json` and `setups.json` from the Vassal module checked against the printed sheets and player aid cards. Unzip `docs/games/sicily/other/FAB_Sicily.vmod` to a scratch folder first (its images are reference only and are never committed), then from the repo root:

    python3 -I tools/sicily/pieces.py <unzipped vmod> data/sicily [<scratch folder>]

The facts read by eye (pips per block edge, set-up codes, chit pip colours, symbols, scenario rows) are tables in the script. On each run it checks them against the module: every image present, the number of Vassal pieces per image, the turn each piece sits at on the Vassal set-up cards and in the asset file name, no module image left unused, and 228 counters in all; it stops on any mismatch. With a third argument it also writes `review.html` there: each Vassal image beside the fields parsed for it. Open questions are in `data/sicily/NOTES.md` ("Units and counters").

## Map draft (`zones.py`, `segment.py`, `mapdraft.py`, `review.py`)

Writes `data/sicily/map_vassal.json`, the draft map model: 65 areas (id, printed name and Vassal name, TDN, VPs, army zone, coastal, port, airfield, landing boxes, Sunrise Bridge values, label point, number-plate point, traced polygon and the Vassal zone polygon), the 144 shared edges (road or field, river, restricted, army boundary), the corner-only contacts, the 23 landing boxes and 4 port boxes with the area each arrow points at, every other box or track, and the printed turn track. Coordinates are px on the module's "Main Map" image (3332 x 2156); the printed scan `docs/games/sicily/maps/SICILYmap-FINAL-72.jpg` is the same map at 1/1.361. It is a cross-check for the hand-drawn SVG to come, as `map_vassal.json` is for Golan. Open questions are in `data/sicily/NOTES.md` ("Map").

Unzip `docs/games/sicily/other/FAB_Sicily.vmod` to a scratch folder `<vmod>` first (its images are reference only and are never committed), then from the repo root, with `<s>` a scratch folder:

    python3 -I tools/sicily/zones.py <vmod> <s>/zones.json
    python3 -I tools/sicily/segment.py <s>/zones.json "<vmod>/images/FAB Sicily Map (VASSAL).jpg" <s>/labels.png
    python3 -I tools/sicily/mapdraft.py <s>/zones.json <s>/labels.png "<vmod>/images/FAB Sicily Map (VASSAL).jpg" data/sicily/map_vassal.json

1. `zones.py`: the 145 zones of the board "Main Map": the 65 numbered areas (polygon, name, label point) and the 80 other zones (ports, damage boxes, beaches, resource boxes, tracks) as rectangles.
2. `segment.py`: the Vassal zones are rough, so the areas are traced on the map image instead: a watershed on the printed boundary lines (dark grey lines, river blue, army-boundary dashes), seeded at the zones' label points, with the sea, the grey mainland and the white arrows on the sea outside. Writes a label image (0 = outside, 1..65 = area). Each area is one piece and the shared edges run down the middle of the printed lines.
3. `mapdraft.py`: adjacency from the label image (two areas are neighbours when they share at least 30 px of edge; a point contact is not an edge) and the values read off the map by hand, kept as tables at the top of the script (TDN plates, VP symbols, airfields, ports, roads, rivers, restricted and army boundaries, landing-box arrows, Sunrise Bridge squares, turn track). Detectors for river, dashes, road crossings and plate shapes back the tables up; the script prints `check:` for any disagreement not already settled by eye (listed in `ROAD_SEEN`).

Review overlay (scratch only, never committed): `python3 -I tools/sicily/review.py data/sicily/map_vassal.json <image> <out.png> [a b c d e f]` draws the polygons, ids, TDN, zone, VPs, ports, airfields, landing boxes and every edge (green road, red field, blue band river, brown band restricted, magenta army boundary, green circles where a road crosses) over the Vassal map, or over another image given the 2x3 affine from that image's px to Vassal px (printed scan: 1.36112 -0.0000116 -0.395 -0.0000279 1.36174 -0.293, fitted with SIFT, 0.5 px rms).
