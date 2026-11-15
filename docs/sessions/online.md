# online · 15 November 2026, evening

Doing: nothing in hand; main 2eaf6f0 carries everything below.
Next: the open audit findings in `docs/ONLINE.md` §5 (4 to 8 and 10; rules changes bundled so the owner publishes once); then the turn's steps before combat online (reinforcements, movement, supply), which the test still skips.
Waiting for the owner: to publish `database.rules.json` (one change: chat readable by the two players and admins only); to retest issues #1, #2, #3.
Last checked: full verify all passed; `npm run online` all passed on three volumes + hot-seat on main 2eaf6f0; The Bulge 6 of 6 before that. 15 Nov.
Files in hand: none.
Notes:
- The test: `cd web && npm run online` (also `npm run verify -- --online`; about 15 minutes; Java and `npm ci` in `tools/rules-test`; ports 9000, 9099, 5198). GAMES=bulge, SWAP=1 (creator on the phone), SHOTS=folder, BURSTS=n (repeat the both-move check). Its dev server serves the live files: do not edit `web/src` or `engine/src` while it runs (use a worktree).
- Issue #3's lost move had two causes (fixed): a browser rewrote the other side's blocks in the shared game (`engine/src/split.ts`: each seat decides only its own); a save replaced the newest game received with its own copy (`online.ts`). 27 runs without a loss since.
- A block a battle showed is hidden again when the rules hide it, never in the middle of a battle; the Rules check (`engine/src/turn.ts`) treats that as no move.
- Hot-seat: `meta.hotseat`, one seat, the game stored unsplit, `online.hotseat`; the table side is the interface session's.
- Other fixes of the day: own block blank after a battle; slow start becoming a local table; connection dot; Sign out; QR code; home page and sign-in; chat in Sicily and Golan; audit 1, 2, 3.
- Hit choices and retreats in the test are a note (dice), not a check.
- A helper's worktree may remain under `.claude/worktrees/` (ignored locally, never commit it).
