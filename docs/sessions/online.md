# online · 15 November 2026

Doing: step 3 of the kick-off prompt (git history, commit 28385ae). Done so far: issue #3 (moves at the same moment no longer lost, the connection dot follows the real connection, failed saves retry) and the QR code of issue #2.
Next: a mockup of the home page and sign-in for the owner (issue #1, with the code field of #2 in it), through the project-management session; then the turn's other steps online (reinforcements, movement, supply), Sicily and Golan in real play order; then step 4, the audit (leaks in `docs/ONLINE.md` §5).
Waiting for the owner: nothing.
Last checked: `cd web && npm run online` all passed on the three volumes (and The Bulge with the creator on the phone); `npm run verify -- --quick --browser` passed except formatting of `engine/src/vol/bulge-setup.ts` (the rules session's file); database rules tests passed. 15 Nov.
Files in hand: none.
Notes:
- Steps 1 and 2 are done: `docs/ONLINE.md` (the map, leaks, faults) and `web/e2e/online.mjs` (`npm run online`, about twelve minutes, needs Java and `npm ci` in `tools/rules-test`; it uses ports 9000, 9099 and 5198).
- The test found and fixed: a block hidden again after a battle became a blank on its owner's own screen for good (its re-hide count was never saved); a slow start turned a shared table into a local one after 15 seconds.
- With the fix of `edec14c` undone completely the test fails as that bug did (checked by hand, then put back).
- One line added to `web/src/main.ts` (the UI session's file): `settled` in the development-only test hook.
- Not in `npm run verify` yet: `scripts/` belongs to the project-management session; proposed to it.
