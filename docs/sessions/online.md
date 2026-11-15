# online · 15 November 2026

Doing: step 4 of the kick-off prompt (git history, commit 28385ae): the audit of the online code (leaks in `docs/ONLINE.md` §5 first).
Next: build the new home page and sign-in once the owner approves the mockup; then the turn's other steps online (reinforcements, movement, supply), Sicily and Golan in real play order.
Waiting for the owner: the mockup `docs/mockups/2026-11-15-home-signin-desktop.png` / `-phone.png` (issue #1 and the code field of #2), sent to the project-management session with one question: should "Learn to play" stay a small line for a first-time visitor too?
Last checked: `cd web && npm run online` all passed on the three volumes (and The Bulge with the creator on the phone); `npm run verify -- --quick --browser` all passed; database rules tests passed. 15 Nov.
Files in hand: none.
Notes:
- Steps 1, 2 and 3 (issues #3, #2's QR code, #1's Sign out) are done: `docs/ONLINE.md` (the map, leaks, faults) and `web/e2e/online.mjs` (`npm run online`, about twelve minutes, needs Java and `npm ci` in `tools/rules-test`; it uses ports 9000, 9099 and 5198).
- The test found and fixed: a block hidden again after a battle became a blank on its owner's own screen for good (its re-hide count was never saved); a slow start turned a shared table into a local one after 15 seconds.
- With the fix of `edec14c` undone completely the test fails as that bug did (checked by hand, then put back).
- One line added to `web/src/main.ts` (the UI session's file): `settled` in the development-only test hook.
- Not in `npm run verify` yet: `scripts/` belongs to the project-management session; proposed to it.
