# interface · 14 Nov 2026 (playtest 2026-11-13, item 7)
Doing: playtest report 2026-11-13 in the owner's order. Done: B1-B7, A1-A3, A6, C1-C7, C8 (via C1), C9 (point unit named), C11. A4: owner keeps blocks turning like the real ones (not a bug).
Next (not done, need a reproduction first): B8 camera framing (destination off the right edge, British beachheads off screen, empty band beyond the map edge; the tilted camera looks past the map's top); C9 rest (Sicily dogfight panel staying after the Axis declined); C10 (Allied hand grey and cut at the edges; German hand behind the instruction bar) - not seen in my runs.
Waiting for the owner: nothing.
Last checked: npm run verify --browser, 14 Nov: all passed except formatting of engine/src/vol/bulge-setup.ts (rules session's file).
Files in hand: none.
Notes: phone overrides live in web/src/css/playtest-fixes.css (loaded last; #ui prefix to win). it-ui.json is written with json.dumps(ensure_ascii=False, indent=1); plain texts go under "text", regexes under "patterns"; desktop turns "Tap" into "Click", so add both. C4 changed one line of engine/src/vol/sicily-combat.ts (a morale roll's record: 1 = passed, like the other volumes). A5, A7-A9 and section D belong to the rules session or the owner.
