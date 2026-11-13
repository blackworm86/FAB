# Project status

Kept by the project-management session (`docs/PARALLEL.md` §4). It reads `main`, the docs and the commit messages; it changes no game code. Updated after each review.

**Last review: Friday 13 November 2026, 10:00 UTC** (`main` at `bed5cca`).

## Weekly summary (9–13 November)

A very busy week: about 160 changes reached `main` from four sessions working at once.

- **Computer opponent**: rebuilt from nothing in five days. It now plays The Bulge from either side and beats the simple "doctrine" player, but only by a small margin (about 1–1.5 points). It is waiting for you to try it. That session has been quiet since Thursday morning.
- **Rules**: a sweep of every asset and event in all three games was finished today, with fixes and a new list of rule questions for you.
- **Interface**: six rounds of design review, each fixed. Today: one top bar (turn pill and the whole points track), one Map button, and, at your request, no more automatic steps: every step waits for your click.
- **3D figures**: still being polished today (smoother shading, cleaner textures, strength pips), although two documents say this project was dropped. This needs your word (see Decisions, 1).

## Sessions

| Session (branch on the merges) | Done | In progress | Blocked / waiting | Next |
|---|---|---|---|---|
| **1. Computer opponent** (`ccr-4176afac`) | Stages 1–5 of `docs/COMPUTER-PLAYER-PLAN.md`: old opponent removed, random player, measuring tool, doctrine player, learned judge, commander. Two attempts to improve the judge measured and not kept. | Nothing since 12 Nov 08:21. | **Your playtest** of `?lab=german` / `?lab=allied`. | Stage 6: Easy / Normal / Hard, a few seconds per decision on a phone. |
| **2. Rules review** (`ccr-57a13ef6`) | Audit of 8 Nov (33 fixes, Golan Electronic Warfare 17.33 fixed in three places); asset and event sweep of all three games (13 Nov), report in `docs/AUDIT-2026-11.md` §5. | Checklist page for your marks: https://claude.ai/artifact/KD6t2FroR5MwtzStYJNtUz | **Your answers** to the sweep's questions (§5 of the audit, about 15, one at a time). | Fix what you mark Broken, Golan → Sicily → Bulge. |
| **UI work** (`docs/HANDOVER.md`, `ccr-ce5fce21`) | Six critiques fixed (scores 25 → 30 → 28 → 25 → 28 → 27 → 29 out of 40); compact menus, area tags, sandbox redesign, act-now halos and Skip, top bar with turn pill and VP track, one Map button, no automation. | — | — | Leftovers in HANDOVER §4.4 (not yet decided by you). |
| **3D figures** (`claude/gifted-galileo-hsxngj`) | Figures for all three games, Blocks / Figures switch (blocks by default), your orientation and variant choices, hole repair, smooth shading, texture clean-up, full-strength pips. | Active today (last change 13 Nov 09:26). | Your decision on whether this project continues. | — |
| **4. Project management** (this session) | This file. | — | — | Next review; a weekly report if you want one. |

## Conflicts and overlapping work

1. **Figures: the documents and the work disagree.** `docs/PARALLEL.md` §3 and `docs/HANDOVER.md` §2 say the figures project was dropped and its code removed. In fact the figures code (`web/src/troops.ts`, `web/public/pezzi/`, `tools/pezzi3d/`) is in the game and was changed four times today. `docs/ASSETS-3D.md` describes it as live. `docs/HANDOVER.md` §2 even says both "Figures by default" and "blocks are the default again" (blocks is right, per your 12 Nov choice).
2. **`web/src/main.ts` is edited by all four working sessions** (computer opponent, rules, UI, figures) in the last three days. Merges went through, but this is where a clash would happen. `web/src/troops.ts` (UI and figures), `web/src/sandbox-ui.ts` (rules and UI) and `engine/src/game.ts` (computer opponent and rules) are also shared.
3. **"No automation" vs the computer opponent.** Today's UI change removed automatic rolls and steps, except that an online opponent's dice still move on by themselves. The computer opponent relies on the same path (commit `9e80679`: without it the table froze). Not re-checked since the change: worth a quick test before your playtest.
4. **Rule changes vs the computer's measurements.** The rules sweep changed timing and use of assets and events in The Bulge today (`c2d462d`). The computer opponent's measurements (stage 5) were made before it and should be re-run. The commit messages do not start with "Rule fix:" as `docs/PARALLEL.md` asks, so the computer session may not notice.

## Open problems

- Battles in Sicily and Golan, and online games, were not re-tested after the battle-flow changes (HANDOVER §4.4); now "no automation" changed the flow again.
- On the 3D map, cut-off areas show a plain grey tint, no stripes.
- `docs/HANDOVER.md` §4 is numbered 1, 4 (items 2 and 3 missing) and §2 mixes superseded notes ("faster battles") with current ones.

## Decisions waiting for you

0. **Tutorial**: to be cancelled and rebuilt (your decision, 13 November). When, and whether the present lessons come off the site in the meantime, is still to be said.

1. **Figures**: does the figures work continue (and the docs get corrected), or is it dropped (and the code removed)?
2. **Playtest the computer opponent** (`?lab=german`, `?lab=allied`) and say whether it is good enough to move to levels.
3. **Rule questions** from the asset and event sweep (`docs/AUDIT-2026-11.md` §5), and your marks on the checklist page.
4. **Publish `database.rules.json`** on the site (Admin > Update rules): still pending since 10 November.
5. Interface leftovers in HANDOVER §4.4 (3D cut-off stripes; re-testing Sicily, Golan and online battles).
6. Optional: push notices with the app closed (`docs/DEPLOY.md` §7), "for later".

## Proposed priorities

1. Settle the figures question, so no session works on something that is meant to be gone.
2. Re-test a full game in each volume, and an online game, after "no automation" (The Bulge must not break). Fix the two check scripts so they can do this by themselves.
3. Your playtest of the computer opponent, after a quick check that it does not freeze with the new click-every-step flow; then re-run its measurements on the new rules.
4. The rule questions, a few at a time.
5. Publish the database rules.

## Streamlining plan (approved by the owner, 13 November)

Goal: keep the design, split the few oversized files by moving code, no rewrite and no change in behaviour. One step at a time; after each step the session stops and reports.

| Step | What | State |
|---|---|---|
| 1. Safety net | A picture check of every phase, a selected block, a battle and the main windows for each game on desktop and phone (`web/e2e/shots.mjs`). | **Done 13 Nov** (details below) |
| 2. One formatting pass | An automatic formatter over all the code, with a CI check. Needs a short freeze of the other sessions. | Next |
| 3. Split `web/src/main.ts` | Move code into modules, one small commit each. | — |
| 4. Split the engine | The Bulge's own rules to `engine/src/vol/bulge.ts`; the rest of `game.ts` by phase. | — |
| 5. Split `style.css` | One file per screen. | — |
| 6. Docs and ownership | `HANDOVER.md` as current state plus changelog; ownership in `PARALLEL.md` by module. | — |
| 7. Guard | A CI check on file size. | — |

### Step 1, what was done

- **Picture check** (dev server up; `cd web && npm run shots` before a change, `npm run shots:compare` after it): 21 pictures per game and screen size (start, the View, Pieces and Map windows, every phase, a battle pressed through, a selected block). The page's clock and the dice are fixed so the same code gives the same pictures. Measured on unchanged code: The Bulge desktop, Sicily desktop and phone match exactly; now and then one run opens with the camera a hair off, and every picture of that game and screen then shows about 1% spread thinly over the map (seen on The Bulge phone, and at about 0.5% on two Golan battle pictures). When that happens, run that game again (`GAMES=bulge`). One game takes about 8 minutes, all three about 25: a tool for the refactoring steps, not for CI.
- **Lessons**: the owner decided on 13 November to cancel the present tutorial and rebuild it later (too long and complex), so the lesson check was not finished. Two real bugs found on the way are fixed in `web/src/tutorial.ts`, for as long as the present lessons stay: since "no automation" a dice result inside a lesson waited for a Continue the lesson lock blocked (the player was stuck); and in The Bulge lesson 7 a tap on the glowing area moved the wrong block. `web/e2e/tutorials.mjs` now plays more like a player (map taps, Continue) but was last run in full before the second fix.
- `tools/mobile-sweep.cjs` no longer exists (removed in the 12 November clean-up), so that open problem is closed.

## Proposals for other files (for you to approve; this session does not change them)

- `docs/PARALLEL.md` §3 and `docs/HANDOVER.md` §2: match what you decide about figures; remove the "Figures by default" line.
- `docs/HANDOVER.md` §4: renumber; mark the "faster battles" note as superseded.
- Ask the rules session to start commit messages that change a rule with "Rule fix:".
