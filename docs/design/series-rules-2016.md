# Series rules: The Bulge rulebook vs the 2016 edition (Golan '73)

Both games play the 2016 series rules printed in the Golan '73 Rule Book. The Bulge's own rulebook is the older edition.
The rules reference shows the 2016 text for each changed rule, with The Bulge Rule Book's wording quoted below it
(`tools/rules/corrections.json`, `updates.bulge._series2016`).

The Golan Rule Book lists its changes ("Log of Important Changes", Volumes 2 and 3). A word-by-word comparison of all
104 series sections found 41 that differ; 18 change play, the rest are wording, layout or cross-references.

| Rule | 2016 change | Engine before | Now |
|---|---|---|---|
| 3.24, 6.1 | One combat round per selected area per Combat Phase | already so | – |
| 4.34 | A roadblock is no longer removed when a friendly unit enters | removed on any entry | fixed, both games |
| 4.34, 5.32 | Roadblock +1 MP not on top of the +1 for an occupied area | already so | – |
| 5.1 | No unit may voluntarily end its move overstacked | already so | – |
| 5.23 | One field works marker per area; the −1 applies to infantry in field works | already so | – |
| 5.32 | Entering an area with assets (not only units) costs +1 MP | Bulge: assets did not count (a defended roadblock cost nothing extra) | fixed, The Bulge (Golan already) |
| 5.35b | Stop when entering an area with enemy assets | already so | – |
| 5.35c | One unit per river boundary into an *enemy-occupied* (was: contested) area | already enemy-occupied | – |
| 6.22, 6.23 | At most 8 battle assets for the Attacker, 5 for the Defender | Bulge: no limit | fixed, The Bulge (Golan already) |
| 6.23 | The Defender's battle assets need all defenders from one Higher Echelon | already so | – |
| 6.24 | Wording: each unit compares in each later firing step | – | – |
| 6.33 | An engineer clearing field works still counts as a battle asset | counted | – |
| 6.42c | An asset that may not retreat is destroyed when its side retreats, counting as a hit | Bulge: garrison stayed; Golan: destroyed without counting | fixed, both games |
| 6.6 | Retreat to an area with one unit or fewer; if all adjoining are full, retreat on to the nearest one with room | no retreat, step loss | fixed, both games |
| 6.8 | Out-of-supply units get no exploitation marker | allowed | fixed, both games |
| 7.31 | Reserves that neither move nor build keep their markers for the next Reaction Phase | already so | – |
| 9.31c | No more "vacant area next to uncontested enemy units" block on supply paths | Bulge: blocked | fixed, The Bulge |
| 9.33d | Disordered units may not enter an area with enemy units/assets | not enforced | fixed, both games |
| 9.35 | Cross-reference (9.1) corrected to (9.31) | – | – |
| 9.4 | "not yet disordered" reworded as "in good order or recovering" | same meaning | – |

Tests: `engine/test/series-2016.test.ts`.
