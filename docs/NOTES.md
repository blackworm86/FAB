# Working notes – FAB: The Bulge

Source review of `docs/` (series rules, play book, map, counters, sticker sheet, reinforcement cards).

## What the game is (engine view)

- **Board**: ~98 numbered areas + entry areas A–Q (Allied) and X–Z (German). Graph, not hexes.
- **Edges** (area pairs) carry: boundary type (open / river / restricted Schnee Eifel 4–11 / army boundary), connection type (road 1 MP / field 2 MP / restricted 3 MP), bridge state.
- **Area** carries: TDN 0–3, VP symbols (Allied cross, German white star, yellow mutual star), German zone (5/6/7), control, field works, markers.
- **Units**: wooden blocks, 1–4 steps, troop quality per step (red elite / black veteran / white green), armor vs infantry class, Higher Echelon (colour), entry turn/area code (e.g. `3-HJ`), hidden from opponent.
- **Assets / events**: chits drawn from a selection cup into Available → Used → Eliminated boxes.
- **Turn**: Reinforcement → [Admin, Op Move, Strat Move, Combat, Reaction, Breakthrough Move, Breakthrough Combat, Supply] × 2 players → Victory check. 9 turns.
- **Dice**: d10, success on ≤ Success Number (base 5); 1 always hits, 10 always misses.

## Open questions

1. **Combat Table / Player-Aid Card is missing.** I can rebuild most of it from the worked examples:
   firer is armor +1; TQ firer vs target point unit (elite→vet +1, elite→green +2, vet→elite −1, green→vet −1, …);
   target point unit armor −1; TDN −N; field works −1; disordered −1; unsupplied −1; attacking in river assault −1; firing at a river-assaulting unit +1.
   Are there more rows (e.g. artillery-specific)? A photo of the card would settle it.
2. **Turn Track numbers** (chit draws per Admin phase, sudden-death VP thresholds): I read them from the map, e.g. T2 German 9/5, Allied 7/0; T4 sudden death 5. The image is small; a clearer crop of the track would help.
3. **Intro scenario map sheet** (areas in play, draw counts) is not in the files. Needed only for the intro scenario.
4. **Contradictions in the rules:**
   - ~~14.82 vs example 23.4~~ **Resolved (user):** the US strat-move limit is the number of reserve markers in the counter mix (3× zone 5/6, 2× zone 7), so the example is right.
   - 17.14 Bodenplatte: "2-5 return to cup" and "5-10 unaffected" overlap on a 5. I'd read it as 6-10.
5. **Some rules text is garbled in the PDF extraction:** ~~13.3~~ (recovered from the page image: armor class = armor, armored cavalry, mechanized infantry; infantry class = infantry, mountain, airborne, engineer, artillery, rocket artillery), 14.62b, 18.4 and 18.5 (the text was readable in the extracted PDF after all). I'll recover them from the page images. Flagging this in case you have a cleaner copy.
6. **Map digitising:** adjacency, road/field connections and rivers have to be traced by hand from the map JPG (2448×1584). A higher-resolution scan would reduce errors. I'll produce `data/bulge/map.json` and a visual overlay for you to check.
7. **Optional rules (18.x)**: include all of them as toggles?
8. **Multiplayer scope**: online 2-player, hot-seat, vs AI? Which ones and in what order?
9. **Hidden information**: online play needs an authoritative server so a client never receives the hidden blocks. Is that OK, or is a trusted/casual mode fine at first?
10. **Art**: are we allowed to use GMT's map/counter art in the app (private use), or should we redraw everything?

## Map digitisation status (v1, auto-generated – needs human review)

Files in `data/bulge/`: `areas.json` (98 areas: name, TDN, VP, army zone), `edges.json` (235 adjacencies: road/field, river, restricted, army boundary),
`entry_areas.json` (A–Q Allied, X–Z German), plus the tool inputs (`area_seeds.json`, `outside_seeds.json`, `edge_overrides.json`).
Regenerate with `tools/segment.py` → `tools/edges.py` → `tools/build_map_data.py`; draw the review overlay with `tools/review_overlay.py`.
Overlay for checking: `docs/maps/review/graph_overlay_v1.png` (black = road, grey = field, blue dot = river, magenta ring = army boundary, brown = restricted, area colour = zone).

How it was made: area numbers/positions were read by hand; areas were segmented with a seeded watershed on the white boundary lines + rivers; adjacency from touching region cores;
road/river/dashed-army-boundary detected by colour. Zones are derived from the dashed lines (zone 6 north-east, 5 centre, 7 south).

Known weak spots to verify against the physical map:
- **Adjacency in the NW (Meuse valley: areas 57–59, 77–80, 91–95)**: the river valleys are wide, so I added 11 edges by hand (`edge_overrides.json`) and removed 4 false ones.
- **Road vs field** was detected from road lines crossing the border; roads that run over a river (e.g. 3–12, expected road per the play-book examples) are sometimes missed. Rivers + road on the same edge are the likely errors.
- **River edges** are any border whose length is mostly blue; a river that only touches the border will be wrong. Known-good checks: 15/16, 15/18, 13/20, 13/21 are rivers (scenario setup).
- Edge cases from play-book examples used as tests: 3–4, 12–23, 4–5, 5–10, 10–11, 11–23, 21–22, 22–24, 22–23 are roads; 12–13, 13–21 are field.
- TDN and VP symbols were read by eye from the tiles.

## Pieces status (v1)

- 190 counters and 75 block labels sliced and catalogued (`assets/README.md`). The reinforcement schedule derived from them matches both printed Reinforcement Cards turn by turn (units and number of chits).
- Reserve markers match your note: 3× Zones 5/6 and 2× Zone 7 for the Allies; the Germans have 2× Zone 5, 2× Zone 6, 1× Zone 7.
- Review sheets: `docs/pieces-review/` (blocks with parsed steps/quality: e = elite, v = veteran, g = green, listed full strength first).
- **Missing: the Getting Started Card.** It holds the setup that the map bottom-right only hints at ("In the Available Box at Start"): which assets start in the Available Box and the cup, the label sticker orientation and the starting step of each block. The Player-Aid cards (combat table, turn track details) are also still missing.
- Not yet extracted: the counter backs (`countersheet_back.webp` is low resolution), the Intro scenario sheet, and gear/back tiles (not needed for play).
- Units that start reduced: 4th Infantry (2 steps, yellow triangle on the label) and 1st Infantry (arrives with 1 step) per the scenario rules; the label triangle marks the starting orientation.

## Map review pass 1 (applied)

Your export was applied with `tools/apply_pass1.py`: 18 connection edits (roads, rivers), 1 new connection (80–92), and 93 hand-drawn area shapes (`data/bulge/polygons.json`, your raw export in `polygons_user_pass1.json`; areas 21, 34, 44, 82, 84 keep my shapes).
`data/bulge/edges.json` is now the reviewed source of truth (it is no longer regenerated from the image pipeline). The map checker was rebuilt on top of it.
With a 12 px gap tolerance your shapes agree with the connection list almost everywhere. Left for pass 2: touching but unconnected 95–97, 61–76, 54–59, 91–95; connected but not touching 72–85.

## Map review pass 2 (applied) – map v2 accepted

All 98 areas were marked checked. Applied with `tools/apply_pass2.py`: Monschau TDN 3, 17 connection type changes, 5 river flags, 2 new connections (61–76, 95–97). The shapes were not changed.
Final graph: 98 areas, 240 connections (incl. 54–59 and 91–95 added in a short pass 3), planar and connected. All play-book example checks pass (roads 3–4, 12–23, 4–5, 5–10, 10–11, 11–23, 21–22, 22–24, 22–23, 3–12; fields 12–13, 13–21, 11–12; rivers 15/16, 15/18, 13/20, 13/21; restricted 4–11; zones of 5, 6, 10, 11, 23, 34).
Victory symbols: 19 Allied VP (black crosses), 14 German VP (blue stars), 6 mutual yellow-star areas.
The engine loads `data/bulge/map.json` (built by `tools/build_map_json.py`); the map checker stays available for later corrections.

## Counters: duplicates collapsed, backs catalogued

- `tools/dedupe_counters.py --apply` was run: 190 counter fronts became 136 entries with `copies`, `ids` and `limit` (limited / unlimited).
- `tools/catalog_backs.py`: the back sheet is catalogued in `data/bulge/counter_backs.json` (19 back faces, images in `assets/counters/backs/`) and every counter entry has a `back` field.
  The totals reconcile exactly: 228 counters = 190 fronts + 38 gear fronts (Blown Bridge), and 228 backs. The generic "Asset or Event" backs match the number of chits: 57 German (grey) and 73 Allied (green).
- Face pairs: Disordered / Recovering (12), River Assault / Road Block (4), Exploitation / No Fuel (8), German VP cross / Allied VP star (11), VPs (1), Boundary Crossing / Pooled Assets (1), Game Turn (1), Remaining German Bridge Repairs / Optional Rule 18.1 (1), gear / Blown Bridge (38), Bid Fuel / Bid (2). Reserve markers, Task Forces and Garrisons have matching backs.
- Limits: unlimited = Disordered / Recovering, Road Block, River Assault, Exploitation, No Fuel, VP cross and star, Blown Bridge (the box has 38 but rivers have 93 borders and the rules cap bridges only by engineers). Everything else is limited by the box.
