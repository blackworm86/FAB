# online · 16 November 2026

Doing: nothing in hand once the audit work below is on main.
Next: nothing in hand. The online test now plays whole turns of all three volumes through the screens (docs/ONLINE.md §7).
Waiting for the owner: to publish `database.rules.json` once (the audit changes below; steps sent to the project-management session); to redeploy the push relay (`tools/push-worker`) when convenient; to retest issues #1, #2, #3; to decide whether hidden blocks should change place in the stored list at every hide (finding 5, the part left).
Last checked: 16 Nov, on the audit commit: rules test 40, engine 460, web 80, push relay 4, `npm run online` all passed on three volumes + hot-seat.
Files in hand: none.
Notes:
- The test: `cd web && npm run online` (also `npm run verify -- --online`; about 15 minutes; Java and `npm ci` in `tools/rules-test`; ports 9000, 9099, 5198). GAMES=bulge, SWAP=1 (creator on the phone), SHOTS=folder, BURSTS=n (repeat the both-move check). Its dev server serves the live files: do not edit `web/src` or `engine/src` while it runs (use a worktree).
- Audit (`docs/ONLINE.md` §5), 16 Nov: 4 fixed (the Rules check can no longer be switched off by leaving out the writer or by a false "restored" mark), 7 fixed (bad data no longer breaks or reloads the other screen), 5 partly (a table locks to its two accounts once both sit, node `games/<id>/locked`; the first sitter shuffles its hidden blocks' places), 6 partly (a reveal naming your own block is ignored), 8 and 10 narrowed (size limits in the rules; fewer writes in the push relay).
- Once a table is locked the two players cannot swap sides, and a replacement player needs an admin to free the seat (that clears the lock).
- The new site works on the old rules (tables just stay unlocked); an old cached site works on the new rules.
- Issue #3's lost move had two causes (fixed 15 Nov): `engine/src/split.ts` (each seat decides only its own blocks) and `online.ts` (a save no longer replaces the newest game received).
- A block a battle showed is hidden again when the rules hide it, never in the middle of a battle; the Rules check (`engine/src/turn.ts`, `samePosition`) treats that, and a hidden block changing code or place, as no move.
- Hot-seat: `meta.hotseat`, one seat, the game stored unsplit, `online.hotseat`; the table side is the interface session's.
- Hit choices and retreats in the test are a note (dice), not a check.
- A helper's worktree may remain under `.claude/worktrees/` (ignored locally, never commit it).
