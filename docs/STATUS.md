# Project status

Kept by the project-management session (`docs/PARALLEL.md` §4). It reads `main`, the docs and the commit messages; it changes no game code. Updated after each review.

**Last review: Friday 13 November 2026, 10:00 UTC** (`main` at `bed5cca`).

**How to run the project** (who does what, what to type, which model for which work): `docs/MANUAL.md`.

**The plan of action** (aim, open items, order, agents, coordination): `docs/ROADMAP.md`, written 13 November, waiting for the owner's go-ahead.

**Put in place for the plan, 13 November evening**: `npm run verify` (eleven checks, one table; all passing), the rules fingerprint in `bot/fingerprint.txt` (also in CI), the load check, three helpers (`fab-verifier`, `fab-rules-referee`, `fab-playtester`) and the `fab-playtest` procedure, the session notes in `docs/sessions/`, the four gates in `docs/PARALLEL.md`. The helpers have not been used yet: the first playtest is their trial.

**First playtest, 13 November evening** (six helpers, three games, phone and desktop): nothing crashed, no browser error, 30 battles fought to the end. The problems are in what the player sees, mostly on the phone: the phase name and half the instruction line are cut off, panels cover what they describe, "Begin combat" in Sicily can look stuck, "End anyway?" falls back by itself. Full report with pictures and an order of fixes for the interface session: `docs/playtest-reports/2026-11-13.md`. Thin on The Bulge's early phases. Waiting for the owner: whether the interface session should take the report (section G) and a decision on "End anyway?" (A6).

**First use of a helper, 13 November evening**: the rules referee read Golan 17.33 (Electronic Warfare) against the printed rule. Main line: matches. For the rules session to check (the referee's reading, not yet confirmed by a test): (1) after the Defender passes and the Attacker jams, the engine still accepts the Defender's Special Action reinforcement or retreat (the table hides the button, so it shows only online or after an interface change); (2) the "all defending units disordered" test counts the disordered marker but not "recovering"; (3) an unsupplied force can play an event (jamming, Countermeasures, Counterbattery) although assets are refused to it; (4) the 13 November fix has no test of its own. Three new questions for the owner came out of it (all disordered or all failed the roll; Electronic Warfare with mixed Syrian divisions; a SAM answer left open when the jam is played): to be asked by the rules session, one at a time. The referee's notes on its own instructions were used to correct them.

**Where the sessions stood on the evening of 13 November** (from the session list): Rules check, waiting for the owner's answer on the Admin Phase order; 3D assets, waiting for the owner to upload the three model archives again; Computer opponents, idle since 12 November, waiting for the playtest; Interface, idle. None has merged the new file layout yet.

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

1. ~~Figures: the documents and the work disagree.~~ Settled 13 November: the owner keeps the figures; the documents now say so.
2. **`web/src/main.ts` was edited by all four working sessions.** Since 13 November it is split into 22 modules (see the streamlining plan), so sessions now touch different files. `web/src/troops.ts` (UI and figures), `web/src/sandbox-ui.ts` (rules and UI) and `engine/src/game.ts` (computer opponent and rules) are also shared.
3. **"No automation" vs the computer opponent.** Today's UI change removed automatic rolls and steps, except that an online opponent's dice still move on by themselves. The computer opponent relies on the same path (commit `9e80679`: without it the table froze). Not re-checked since the change: worth a quick test before your playtest.
4. **Rule changes vs the computer's measurements.** The rules sweep changed timing and use of assets and events in The Bulge today (`c2d462d`). The computer opponent's measurements (stage 5) were made before it and should be re-run. The commit messages do not start with "Rule fix:" as `docs/PARALLEL.md` asks, so the computer session may not notice.

## Open problems

- Battles in Sicily and Golan, and online games, were not re-tested after the battle-flow changes (HANDOVER §4.4); now "no automation" changed the flow again.
- On the 3D map, cut-off areas show a plain grey tint, no stripes.
- `docs/HANDOVER.md` §4 is numbered 1, 4 (items 2 and 3 missing) and §2 mixes superseded notes ("faster battles") with current ones.

## Decisions waiting for you

0. **Tutorial**: to be cancelled and rebuilt (your decision, 13 November). When, and whether the present lessons come off the site in the meantime, is still to be said.

1. ~~Figures~~ Answered 13 November: kept, to be polished after the streamlining work.
2. **Playtest the computer opponent** (`?lab=german`, `?lab=allied`) and say whether it is good enough to move to levels.
3. **Rule questions** from the asset and event sweep (`docs/AUDIT-2026-11.md` §5), and your marks on the checklist page.
4. **Publish `database.rules.json`** on the site (Admin > Update rules): still pending since 10 November.
5. Interface leftovers in HANDOVER §4.4 (3D cut-off stripes; re-testing Sicily, Golan and online battles).
6. Optional: push notices with the app closed (`docs/DEPLOY.md` §7), "for later".

## Proposed priorities

1. Polish the 3D figures (the owner's choice, 13 November).
2. Re-test a full game in each volume, and an online game, after "no automation" (The Bulge must not break). Fix the two check scripts so they can do this by themselves.
3. Your playtest of the computer opponent, after a quick check that it does not freeze with the new click-every-step flow; then re-run its measurements on the new rules.
4. The rule questions, a few at a time.
5. Publish the database rules.

## Streamlining plan (approved by the owner, 13 November)

Goal: keep the design, split the few oversized files by moving code, no rewrite and no change in behaviour. One step at a time; after each step the session stops and reports.

| Step | What | State |
|---|---|---|
| 1. Safety net | A picture check of every phase, a selected block, a battle and the main windows for each game on desktop and phone (`web/e2e/shots.mjs`). | **Done 13 Nov** (details below) |
| 2. One formatting pass | Prettier over all the source code (`npm run format` at the repository root; width 140), with a CI check (`format:check`). | **Done 13 Nov**: engine 417 and table 134 tests, type checks and the production build pass; picture check: no visible change (Sicily 42 of 42 identical, The Bulge desktop identical, The Bulge phone the known ~1% camera noise). `bot/` tests not run here (no packages installed). Sessions must merge `origin/main` and run `npm run format` on their own unpushed changes before pushing. |
| 3. Split `web/src/main.ts` | The table's code moved, as it is, into 22 themed modules; `main.ts` went from 7,338 to about 700 lines and no module is over about 620. | **Done 13 Nov** (details below) |
| 4. Split the engine | `engine/src/game.ts` went from 3,666 to about 500 lines: The Bulge's own rules in `vol/` like the other two volumes, the series rules by phase. | **Done 13 Nov** (details below) |
| 5. Split `style.css` | The 10,578-line stylesheet became 28 files in `web/src/css/` (largest about 1,040 lines), listed in order in `web/src/style.css`. | **Done 13 Nov** (details below) |
| 6. Docs and ownership | `HANDOVER.md` as current state (history moved to the new `docs/CHANGELOG.md`), `PLAN.md` corrected, ownership in `PARALLEL.md` by module. | **Done 13 Nov** (details below) |
| 7. Guard | A CI check on file size: `npm run check:size` (`scripts/check-size.mjs`). | **Done 13 Nov** |

### Step 1, what was done

- **Picture check** (dev server up; `cd web && npm run shots` before a change, `npm run shots:compare` after it): 21 pictures per game and screen size (start, the View, Pieces and Map windows, every phase, a battle pressed through, a selected block). The page's clock and the dice are fixed so the same code gives the same pictures. Measured on unchanged code: The Bulge desktop, Sicily desktop and phone match exactly; now and then one run opens with the camera a hair off, and every picture of that game and screen then shows about 1% spread thinly over the map (seen on The Bulge phone, and at about 0.5% on two Golan battle pictures). When that happens, run that game again (`GAMES=bulge`). One game takes about 8 minutes, all three about 25: a tool for the refactoring steps, not for CI.
- **Lessons**: the owner decided on 13 November to cancel the present tutorial and rebuild it later (too long and complex), so the lesson check was not finished. Two real bugs found on the way are fixed in `web/src/tutorial.ts`, for as long as the present lessons stay: since "no automation" a dice result inside a lesson waited for a Continue the lesson lock blocked (the player was stuck); and in The Bulge lesson 7 a tap on the glowing area moved the wrong block. `web/e2e/tutorials.mjs` now plays more like a player (map taps, Continue) but was last run in full before the second fix.
- `tools/mobile-sweep.cjs` no longer exists (removed in the 12 November clean-up), so that open problem is closed.

### Step 3, what was done

- **The modules** (in `web/src/`, in the order they load): `page` (which game, its map and geometry), `game-state` (the game, the selection, saving, record and replay), `scene`, `map3d`, `piece-kit` (blocks, tags, chits, discs), `pieces` (drawing every piece), `map-paint` (layers, board picture, labels, area colours), `camera`, `flow` (steps, messages, act and undo, arrivals), `choices` (action feed, small choosers), `map-input` (taps on the map, battle close-up), `routes`, `map-marks` (area tags, bubbles, halos), `rolls`, `cards`, `prompt` (top bar, instruction line, main button), `dock`, `pieces-window`, `unit-card`, `map-dock`, `battle-view`, `menus`, `render`. `main.ts` keeps the frame loop and the start-up.
- **How**: a small tool (`web/scripts/move-code.mjs`) moved whole blocks of code using the TypeScript compiler, so nothing was retyped; 22 commits, one per module, each with the type check, the unit tests and a load check of all three games and a lesson.
- **One rule to know** (written at the top of `main.ts`): the modules load in the order `main.ts` lists them, exactly as the one file ran from top to bottom. A variable that another module must change has a small setter (`setSelUnit(...)`).
- **Checked at the end**: type check, 134 unit tests, formatting, the production build (opened for all three games, the home page, the computer-opponent tables and Italian), the browser smoke test, and the picture check against the pictures taken before the split: 114 of 127 identical; the other 13 are the known camera noise (the same pictures, with the same percentages, that differ between two runs of unchanged code; looked at by eye).
- **What it does not do**: the modules still share the same state and know each other through `main.ts`; untangling that is a later, optional job. The engine tests were not run (the engine was not touched).
- **For the other sessions**: merge `origin/main` before any work on the table; a change made on the old `main.ts` will not merge by itself and has to be redone in the new module (ask this session which one).

### Step 4, what was done

- **The modules** (in `engine/src/`): `vol/bulge-setup` (The Bulge's scenarios and set-up) and `vol/bulge` (its exclusive rules), then the series rules by phase: `reinforce` (chit draws, arrivals), `admin` (Special Actions, engineers, replacements, staff, air missions), `moves`, `battle-setup`, `fire`, `battle-end` (hit choices, retreats), `supply`, `turn` (ending a phase, results, the move audit). `game.ts` keeps the types, the small helpers, a new game, control and victory points.
- **How**: the same tool as step 3, ten commits, each checked with the engine's type check and its 417 tests, the table's type check, and a fingerprint of the rules: twelve complete seeded games of The Bulge (all four scenarios, with and without optional rules) had to end with exactly the same result, turn and action counts as before.
- **Checked at the end**: engine 417, computer opponent 11 and table 134 tests, formatting, the production build opened in a browser for all three games and both computer-opponent tables, the browser smoke test. Everything the engine offered to the table, the computer opponent and the tests is still there under the same names.
- **Side effect**: 58 internal helpers (for example `roll`, `next`, `end`, `check`) are now also visible to the table and the computer opponent, because the modules reach each other through `game.ts`. Nothing uses them; they should not be relied on.
- **Not done**: `vol/golan.ts` (2,450 lines) and `vol/sicily.ts` (1,790 lines) are as they were; the plan covered `game.ts` only. Golan and Sicily have no seeded-game fingerprint, only their tests and the random full-game fuzzer.
- **For the rules and computer-opponent sessions**: merge `origin/main` before touching `engine/`; a change made on the old `game.ts` has to be redone in the new module. Keep importing from `./game` or `index.ts`, not from the new modules directly.

### Step 5, what was done

- **28 files** in `web/src/css/`, named by what they style (`base`, `layout`, `battle`, `tutorial`, `rules-reference`, `replay`, `sandbox-panel`, `top-bar` …). `web/src/style.css` now only lists them with `@import`, in the order they had.
- **The order must be kept**: the stylesheet is a cascade, later rules override earlier ones (it grew by layers of fixes). So the files are stretches of the old file in their old order, not one file per screen: some screens (the home page, the top bar, the sandbox) still appear in two or three files, from different rounds. Merging a screen's rules into one place would change which rule wins and needs the pictures checked screen by screen; not done.
- **Checked**: the production stylesheet is byte-for-byte identical to the one before the split (so nothing can look different), the development server loads and shows the same colours, Golan's 43 pictures match, formatting is clean.
- **For the other sessions**: a CSS change made on the old `style.css` has to be redone in the right file of `web/src/css/` (search for the selector). New rules go at the end of the file that styles that screen, or in a new file added at the end of the list.

### Step 6, what was done (with the owner's permission to edit those files)

- **`docs/HANDOVER.md`** now has: what this is, where it stands (short), where the code is (the modules, the two load-order rules, the CSS order, the formatter, the move tool), pending owner actions, open work, how to run and measure (formatter, bot, shots), skills and hooks, things that bit us (three new ones). The long history of 9–13 November moved word for word to the new **`docs/CHANGELOG.md`**, with a note on what in it is superseded.
- **`docs/PARALLEL.md`**: the ownership table is by module and has the UI and the 3D figures as rows; the formatting and picture-check rules are written there; section 3 now says the figures decision is waiting for the owner, instead of "dropped".
- **`docs/PLAN.md`**: the stack describes what was built (plain TypeScript and three.js, no React; online without a game server); a note says it is the starting plan.
- **`docs/ARCHITECTURE.md`** and **`README.md`**: one line each updated for the split files.
- **Not changed**: `engine/README.md` (it describes an early Golan layout, `battle.ts` / `events.ts`, that no longer matches the files; a rewrite of it is a separate small job).
- The figures wording was updated on the owner's answer the same day (kept).

### Step 7, what was done

- `npm run check:size` (at the repository root, also a CI check) fails when a source file (`.ts`, `.mjs`, `.css`) is over **1,000 lines**. Six files already over have a ceiling of their size, so they may not grow: `vol/golan.ts` (2,450), `vol/sicily.ts` (1,791), the sweep fuzz test, the Golan and Bulge lessons (to be rebuilt anyway), `css/battle-strip.css`. Tested: it passes now and fails on a 1,002-line file.
- **The streamlining plan is finished.** Overall result: `main.ts` 7,338 → 711 lines in 22 modules, `game.ts` 3,666 → 503 in 10 modules, `style.css` 10,578 → 28 files, code formatted by Prettier, pictures, a rules fingerprint and a byte-identical stylesheet as proof nothing changed.
- Still open from it, if wanted: merge each screen's CSS into one place. (`vol/golan.ts` and `vol/sicily.ts` were split on 14 November, see below.)

### After the plan: Golan and Sicily split too (14 November)

- `engine/src/vol/golan.ts` went from 2,450 to about 290 lines (seven files beside it: set-up, the two smaller scenarios, moves, turn, combat, optional rules, player actions) and `vol/sicily.ts` from 1,799 to about 290 (five files: set-up, moves, turn, combat, player actions). Same tool, twelve commits, the 419 engine tests after each, including the sixteen-game fingerprint made for this the evening before.
- Checked at the end: `npm run verify -- --browser` (all eleven checks), the production build opened for all three games, and nothing the table or the tests use has gone (the same names under `E.golan` and `E.sicily`; 71 and 62 internal helpers are now also visible there and should not be relied on).
- No engine file is over 550 lines now; the size guard's exceptions for these two files are removed.
- The rules session must merge `origin/main` before touching Golan or Sicily; a change held against the old files has to be redone in the new one.

## Proposals for other files (for you to approve; this session does not change them)

- Ask the rules session to start commit messages that change a rule with "Rule fix:".
