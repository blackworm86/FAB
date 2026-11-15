# online · 15 November 2026

Doing: step 3 of the kick-off prompt (git history, commit 28385ae): the owner's issues #2 (invitations: QR code, code field in the main menu), #3 (screens conflict, connection dot) and #1 (home page and sign-in: mockup first, through the project-management session).
Next: losses and retreats, Sicily and Golan online in real play order (the test skips to combat); then step 4, the audit (leaks in `docs/ONLINE.md` §5).
Waiting for the owner: nothing.
Last checked: `cd web && npm run online` all passed on the three volumes; `npm run verify -- --quick --browser` and the database rules tests: see the last commit message.
Files in hand: none.
Notes:
- Steps 1 and 2 are done: `docs/ONLINE.md` (the map, leaks, faults) and `web/e2e/online.mjs` (`npm run online`, about ten minutes, needs Java and `npm ci` in `tools/rules-test`; it uses ports 9000, 9099 and 5198).
- The test found and fixed: a block hidden again after a battle became a blank on its owner's own screen for good (its re-hide count was never saved); a slow start turned a shared table into a local one after 15 seconds.
- With the fix of `edec14c` undone completely the test fails as that bug did (checked by hand, then put back).
- One line added to `web/src/main.ts` (the UI session's file): `settled` in the development-only test hook.
- Not in `npm run verify` yet: `scripts/` belongs to the project-management session; proposed to it.
