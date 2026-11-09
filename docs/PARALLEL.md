# Projects in parallel

The owner runs several Claude Code sessions at once. Each session reads this file, `docs/HANDOVER.md`, and only its own section below. All of them follow the standing rules in `CLAUDE.md`: push to the session branch and to `main`, **merge** `origin/main` when a push is rejected (never force-push), ask one question at a time, show a mockup before a big UI change, and never break The Bulge.

## Who owns which files (to keep merges small)

| Project | Owns | Touches carefully, in small commits |
|---|---|---|
| 1. Computer opponent | `engine/src/ai.ts`, `engine/test/arena.test.ts`, `engine/test/ai-*.ts`, `web/src/cpu-worker.ts` | `engine/src/vol/*` (only if a rule is missing for the AI) |
| 2. Rules review | `engine/src/vol/*`, `engine/src/*.ts` rules code, `engine/test/*` rule tests, the review artifact | `web/src/*-ui.ts`, `web/src/sandbox*.ts` |

Merge `origin/main` at the start of every work block. When project 2 changes how a rule works, it says so in the commit message ("Rule fix: …"), so project 1 can re-run the arena.

---

## 1. Computer opponent (already running in another session)

Goal: the computer can play every part of the turn in all three volumes, start to finish, at Easy, Normal and Hard, and Hard is hard to beat. The open list is `docs/HANDOVER.md` §4: re-measure Hard on the masked view, the chits it never plays, Special Actions in battle, then a difficulty that adapts. Progress page (private artifact): https://claude.ai/artifact/TdGcLVt1eKZtidUtHoJTfK. Its rows live in the artifact's database (collections `phases`, `items`, `arena`, `log`): after every piece of work, update the item's `status`/`note`/`updated` with ArtifactData, add arena results as `arena` rows and one `log` row. Never republish the page just to change data.

Status (Nov 2026): the Bulge's missing actions are in (bridges, Greif, Bodenplatte, von der Heydte, staff reserve, paid Breakthrough, reaction reserves) but did not change strength; next is a German plan for the Bulge (the areas to take by turn 4 and the routes to them), then the same for the other volumes. Done means: a fuzzer-style test where the computer plays both seats of every scenario of every volume to the end without getting stuck, and arena numbers per level in the docs.

## 2. Rules review, with a test page for the owner

Goal: every game element of every volume works as the rulebook says. The owner already knows one is broken: **Electronic Warfare in Golan (17.33)**.

Kick-off prompt for the session:

> Read `docs/PARALLEL.md` §2. Build a list of every game element for The Bulge, Sicily and Golan '73 (each rule section, chit, asset, terrain, special action, optional rule) from `tools/rules/*.md` and `docs/rules/`. Start with Golan EW (17.33), which the owner says does not work: reproduce it, fix it, add a test. Then make a private artifact checklist: one row per element, the rule text, a link that opens the sandbox already set up on that situation, and buttons Works / Broken / Note that save to the artifact's database. I test from the page; you read my marks and fix what is broken, one volume at a time, with a test per fix.

Notes for that session:
- The sandbox (`web/src/sandbox.ts`, `?sandbox=1`) already lets the owner set pieces, chits, turn and phase, pin notes and download a report. Reuse it: each checklist link should open a ready situation (a scenario snapshot in the URL or a small preset list), not an empty table.
- Hidden blocks must stay hidden (`engine/src/split.ts`).
- Order: Golan (the owner's worry) → Sicily → The Bulge (the most played, so the most tested already).

## 3. Figures instead of blocks: dropped

Dropped by the owner in November 2026: no 3D figure generation for this project. The blocks stay. The pipeline, its page and the trial code were removed (last in commit history before "Remove the figures project").
