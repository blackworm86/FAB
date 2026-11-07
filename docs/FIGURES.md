# Play Book example figures (4.5)

Each example of play in the rules reader can have a figure: the game's printed board, framed on the example's areas, with the game's own
blocks, markers, arrows and dice, stepped through the example's lettered paragraphs (A, B, C…). Approved mockup:
claude.ai/artifact/3A62bGTYNtx5naguQFC2yf. Renderer: `web/src/figures.ts`; data: `data/<game>/figures.json`, keyed by the section id the
reader uses (`Ex 6`, `23.2`…). Template: `data/golan73/figures.json`, Example 6.

```jsonc
"Ex 6": {
  "view": [48, 47, 40, 41, 49],                    // areas the frame must show (their labels, with room around)
  "pieces": {                                      // keys are local names
    "recon": { "unit": "S11" },                    // a unit of the game by id (data/<game>/units.json): drawn with its real face
    "idf": { "label": "Israeli unit", "side": "israeli", "cls": "armor" }   // a hypothetical or unnamed block
  },
  "markers": [{ "kind": "mines", "edge": [47, 48] }],   // on the board from the start; kinds: mines fw blown roadblock bridge interdict ditch note(+text)
  "steps": [                                       // cumulative: a step changes only what it names
    { "tab": "Set-up", "cap": "…", "at": { "recon": 48, "idf": 47 } },
    { "tab": "A", "cap": "…", "fail": [[48, 47]], "dice": [["9th Recon morale check", null, [7], false]] },
    { "tab": "B", "cap": "…", "at": { "recon": 47 }, "moves": [{ "path": [48, 40, 41, 47], "labels": ["1", "2", "2"] }], "mp": "5 MP" },
    { "tab": "C", "cap": "…", "at": { "inf": 47 }, "str": { "idf": 1 }, "ring": [47], "dice": [["52nd morale check", null, [4], true]] }
  ]
}
```
- `tab`: `Set-up` first, then the example's paragraph letters exactly as printed (`**A—**`). Tapping a paragraph shows its step.
- `at`: area per piece (`null` takes it off the board). `str`: strength from that step on (pips on the face). `drop`: markers removed, as `"kind:area"` or `"kind:a-b"`.
- `moves`: arrows along adjacent areas (`kind`: move, retreat, strat; `air` may jump). `fail`: a crossing that did not happen (red arrow with a cross). `ring`: battle areas.
- `dice`: `[who, success number or null, dice, passed (only when the number is null)]`. `mp`: the movement cost line. `cap`: one or two plain sentences; say only what the book says.
- `npm test` in `web/` checks every figure against the map, the units and the example's letters (`web/test/figures.test.ts`).
