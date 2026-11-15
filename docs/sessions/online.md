# online · 15 November 2026

Doing: waiting for the full three-volume `npm run online` on main c30c5e4 (home page build, chat for players only); result goes to the project-management session.
Next: the open audit findings in `docs/ONLINE.md` §5 (3 to 8, each with a test; rules changes bundled so the owner publishes once); then the turn's other steps online (reinforcements, movement, supply), which the test still skips.
Waiting for the owner: to publish `database.rules.json` again (chat readable by the two players and admins only); to retest issues #1, #2, #3.
Last checked: verify --quick all passed; online test on The Bulge passed (creator on the phone) on the new home page; database rules tests 34 passed. 15 Nov.
Files in hand: none.
Notes:
- Done today: `docs/ONLINE.md` (map, leaks, faults, audit table); `web/e2e/online.mjs` (`npm run online`, also `npm run verify -- --online`; about twelve minutes; Java and `npm ci` in `tools/rules-test`; ports 9000, 9099, 5198; GAMES=, SWAP=1, SHOTS=).
- Fixed: own block turning blank after a battle (re-hide count not saved); moves at the same moment lost; connection dot; slow start becoming a local table; Sign out; QR code in the invitation; home page and sign-in (approved mockup in `docs/mockups/`); audit 1 (game data as script) and 2 (replay record mid-game, rules published by the owner).
- The test's dev server serves the live files: do not edit `web/src` while it runs (use a worktree).
- `qrcode-generator` was added before the owner was asked; he then said to keep it.
- A helper's worktree may remain under `.claude/worktrees/` (ignored locally, never commit it).
