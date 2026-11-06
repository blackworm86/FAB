# FAB: Sicily data tools

## Pieces: blocks, counters, set-ups (`pieces.py`)

Writes `data/sicily/units.json`, `counters.json`, `counter_backs.json`, `reinforcements.json` and `setups.json` from the Vassal module checked against the printed sheets and player aid cards. Unzip `docs/games/sicily/other/FAB_Sicily.vmod` to a scratch folder first (its images are reference only and are never committed), then from the repo root:

    python3 -I tools/sicily/pieces.py <unzipped vmod> data/sicily [<scratch folder>]

The facts read by eye (pips per block edge, set-up codes, chit pip colours, symbols, scenario rows) are tables in the script. On each run it checks them against the module: every image present, the number of Vassal pieces per image, the turn each piece sits at on the Vassal set-up cards and in the asset file name, no module image left unused, and 228 counters in all; it stops on any mismatch. With a third argument it also writes `review.html` there: each Vassal image beside the fields parsed for it. Open questions are in `data/sicily/NOTES.md` ("Units and counters").
