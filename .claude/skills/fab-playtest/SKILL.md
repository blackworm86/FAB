---
name: fab-playtest
description: Full re-test of FAB by playtester helpers, one per volume and screen size, with one checked report at the end. Use after a change of the flow of play, before a release, or when the owner asks for a re-test. Costs six helper runs; say so before starting.
---
# FAB playtest (six play-throughs, one report)

Arguments: which games (default all three), which screens (default desktop and phone), how far (default: one whole turn of each side, every battle offered).

1. **Say what it costs** (one helper per game and screen, each a long browser session) and wait for the owner's yes, unless they asked for exactly this.
2. **Prepare**: `npm run verify -- --quick` must pass (a table that fails its own checks is not worth playing). Start the dev server (`cd web && npx vite --port 5199 --strictPort`), make a folder per helper under the scratch directory.
3. **Send the helpers**: one `fab-playtester` per game and screen, **at most three at a time** (the browsers share one processor), all of a batch in the same message. Each brief: game, screen, `BASE`, how far, its folder, and what changed lately (from `docs/STATUS.md`). Nothing about what you expect them to find.
4. **Check every finding yourself**: open its picture with Read. Drop what the picture does not show; merge the same problem seen by several helpers; mark which volumes and screens it shows on. A helper that stopped early is reported as "not finished", not as a pass.
5. **Write the report** to `docs/playtest-reports/<date>.md` with the pictures beside it: what was played, findings worst first (stuck, wrong, unreadable, unclear), each with its picture, and what was not assessed. Plain language; the owner reads it on a phone.
6. **Hand over**: findings about the table go to the interface session, rule doubts to the rules session (through `docs/STATUS.md`, section "waiting"). This skill fixes nothing.
7. Stop the dev server. In `docs/STATUS.md` note the date, how many findings held up against how many were reported, and roughly how long it took: that is how the owner judges whether the helpers are worth their cost.
