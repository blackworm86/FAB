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
   - 14.82 says US strat-moves are unlimited; example 23.4 says the US limit is 3 per turn. Which one do we use?
   - 17.14 Bodenplatte: "2-5 return to cup" and "5-10 unaffected" overlap on a 5. I'd read it as 6-10.
5. **Some rules text is garbled in the PDF extraction:** 13.3 (unit types by class), 14.62b, 18.4 and 18.5. I'll recover them from the page images. Flagging this in case you have a cleaner copy.
6. **Map digitising:** adjacency, road/field connections and rivers have to be traced by hand from the map JPG (2448×1584). A higher-resolution scan would reduce errors. I'll produce `data/bulge/map.json` and a visual overlay for you to check.
7. **Optional rules (18.x)**: include all of them as toggles?
8. **Multiplayer scope**: online 2-player, hot-seat, vs AI? Which ones and in what order?
9. **Hidden information**: online play needs an authoritative server so a client never receives the hidden blocks. Is that OK, or is a trusted/casual mode fine at first?
10. **Art**: are we allowed to use GMT's map/counter art in the app (private use), or should we redraw everything?
