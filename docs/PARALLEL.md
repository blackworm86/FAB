# Projects in parallel

The owner runs several Claude Code sessions at once. Each session reads this file, `docs/HANDOVER.md`, and only its own section below. All of them follow the standing rules in `CLAUDE.md`: push to the session branch and to `main`, **merge** `origin/main` when a push is rejected (never force-push), ask one question at a time, show a mockup before a big UI change, and never break The Bulge.

## Who owns which files (to keep merges small)

Since 13 November 2026 the big files are split (see `docs/HANDOVER.md` section 3), so sessions work in different files.

| Project | Owns | Touches carefully, in small commits |
|---|---|---|
| 1. Computer opponent (rebuilt from scratch) | `bot/` (`docs/COMPUTER-PLAYER-PLAN.md`), `web/src/lab.ts`, `web/src/lab-worker.ts` | the engine's public functions only (import from `engine/src` or `./game`, not from a phase file); the small switch in `web/` for the experimental mode |
| 2. Rules review | `engine/src/vol/*` (The Bulge, Golan, Sicily), the series rules in `engine/src/` (`game.ts`, `reinforce`, `admin`, `moves`, `battle-setup`, `fire`, `battle-end`, `supply`, `turn`, `combat`, `movement`, `chits`, `split`), `engine/test/*`, the review artifact | `web/src/golan-ui.ts`, `web/src/sicily-ui.ts`, `web/src/sandbox*.ts`, `web/src/rules-text.ts` |
| UI and interface (the UI/UX sessions, `docs/HANDOVER.md`) | the table: `web/src/main.ts` and its modules (`page`, `game-state`, `scene`, `map3d`, `piece-kit`, `pieces`, `map-*`, `camera`, `flow`, `choices`, `routes`, `rolls`, `cards`, `prompt`, `dock`, `pieces-window`, `unit-card`, `battle-view`, `menus`, `render`), `web/src/css/`, `web/src/i18n*`, `web/e2e/`, lessons (`web/src/tutorial*`) | `web/src/online.ts` and `store-*.ts` (online play), `database.rules.json` (publishing it is the owner's action) |
| 3D figures (kept, to be polished) | `web/src/troops.ts`, `web/src/figures.ts`, `web/public/pezzi/`, `tools/pezzi3d/`, `docs/ASSETS-3D.md` | `web/src/pieces.ts` (where the figures are placed) |
| 4. Project management and control | `docs/STATUS.md` (and the streamlining plan in it), `docs/ROADMAP.md` (the plan of action) | nothing else without the owner's go-ahead: it reads the code, docs and git history |

Merge `origin/main` at the start of every work block, then run `npm run format` at the repository root on your own unpushed changes before pushing (CI fails an unformatted push). When project 2 changes how a rule works, it says so in the commit message ("Rule fix: …"), so project 1 can re-run its measurements. Before a change that must not alter the look, take `npm run shots` first and `npm run shots:compare` after (`docs/HANDOVER.md` section 6).

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

## 3. 3D figures instead of blocks: kept

The owner dropped this project once (early November), then decided on 13 November 2026 to **keep the figures** and polish them after the streamlining work. They are in the game (View > Units: Blocks / Figures; blocks are the default since 12 November). Plan and kit: `docs/ASSETS-3D.md`, `tools/pezzi3d/`.

## 4. Project management and control

Goal: one up-to-date picture of the whole project for the owner (what is done, in progress, blocked and next for each parallel session), early warning of conflicts and overlapping work, the open problems and the decisions waiting for the owner, and proposed priorities. This session does not change game code.

Kick-off prompt for the session:

> Read `docs/PARALLEL.md` §4, `CLAUDE.md`, `docs/HANDOVER.md`, `docs/PLAN.md`, `docs/COMPUTER-PLAYER-PLAN.md` and the recent git log on `main`. You are the project-management and project-control session for FAB. Keep one document, `docs/STATUS.md`: for each parallel session (and the UI work in `docs/HANDOVER.md`) what is done, in progress, blocked and next; conflicts or overlapping work between sessions; open problems; decisions waiting for the owner; proposed priorities. Update it after each review and write a short weekly summary in plain language. Ask the owner one question at a time.

Notes for that session:
- It follows the other sessions through `main`, `docs/HANDOVER.md`, the commit messages and this file; it does not talk to them directly.
- It owns only `docs/STATUS.md`; anything else it would change goes to the owner as a proposal.
- A regular report (for example every Monday) can be set up as a scheduled task on the owner's request.
