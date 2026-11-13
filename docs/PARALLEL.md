# Projects in parallel

The owner runs several Claude Code sessions at once. Each session reads this file, `docs/HANDOVER.md`, and only its own section below. All of them follow the standing rules in `CLAUDE.md`: push to the session branch and to `main`, **merge** `origin/main` when a push is rejected (never force-push), ask one question at a time, show a mockup before a big UI change, and never break The Bulge.

## Who owns which files (to keep merges small)

| Project | Owns | Touches carefully, in small commits |
|---|---|---|
| 1. Computer opponent (rebuilt from scratch) | `bot/` (the experimental area, `docs/COMPUTER-PLAYER-PLAN.md`) | the engine's public functions only; a small switch in `web/` for the experimental mode |
| 2. Rules review | `engine/src/vol/*`, `engine/src/*.ts` rules code, `engine/test/*` rule tests, the review artifact | `web/src/*-ui.ts`, `web/src/sandbox*.ts` |
| 4. Project management and control | `docs/STATUS.md` | nothing else: it reads the code, docs and git history, it does not change game code |

Merge `origin/main` at the start of every work block. When project 2 changes how a rule works, it says so in the commit message ("Rule fix: …"), so project 1 can re-run its measurements.

---

## 1. Computer opponent

The first computer opponent was removed on 10 November 2026 at the owner's request; it is being rebuilt from scratch, step by step, in its own experimental area. Plan and stages: `docs/COMPUTER-PLAYER-PLAN.md`.

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

## 4. Project management and control

Goal: one up-to-date picture of the whole project for the owner (what is done, in progress, blocked and next for each parallel session), early warning of conflicts and overlapping work, the open problems and the decisions waiting for the owner, and proposed priorities. This session does not change game code.

Kick-off prompt for the session:

> Read `docs/PARALLEL.md` §4, `CLAUDE.md`, `docs/HANDOVER.md`, `docs/PLAN.md`, `docs/COMPUTER-PLAYER-PLAN.md` and the recent git log on `main`. You are the project-management and project-control session for FAB. Keep one document, `docs/STATUS.md`: for each parallel session (and the UI work in `docs/HANDOVER.md`) what is done, in progress, blocked and next; conflicts or overlapping work between sessions; open problems; decisions waiting for the owner; proposed priorities. Update it after each review and write a short weekly summary in plain language. Ask the owner one question at a time.

Notes for that session:
- It follows the other sessions through `main`, `docs/HANDOVER.md`, the commit messages and this file; it does not talk to them directly.
- It owns only `docs/STATUS.md`; anything else it would change goes to the owner as a proposal.
- A regular report (for example every Monday) can be set up as a scheduled task on the owner's request.
