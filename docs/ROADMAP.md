# Plan of action

Written by the project-management session on 13 November 2026, after the streamlining work. It says where the project is going, what is open, in which order to do it, which session does what, and how agents can help. `docs/STATUS.md` stays the live picture (updated after each review); this file is the plan it is measured against. Nothing here starts without the owner's go-ahead.

## 1. The aim

A faithful online version of GMT's **Fast Action Battles**: the full rules enforced, every number explained, quicker to play than the board game without losing its tension. Three volumes (The Bulge, Sicily, Golan '73), hot seat and online, phone and desktop, English and Italian, on the free Firebase plan. A personal fan project, not for sale (`PRODUCT.md`).

**"Version 1" is reached when** (proposed; the owner may change the list):

1. Each volume can be played from set-up to the final result, hot seat and online, on a phone and on a desktop, without a stuck screen.
2. The owner's rule questions are answered and the answers are in the engine, each with a test.
3. The Bulge has a computer opponent with three levels that answers in a few seconds on a phone.
4. New, short lessons replace the present tutorial, in both languages.
5. The 3D figures are polished to the owner's eye; blocks remain available.
6. The published site and its database rules match `main`.

## 2. Where we stand (13 November 2026)

| Area | State | Session (as listed on 13 November) |
|---|---|---|
| Rules engine | Audited against the rulebooks; 417 tests and a full-game fuzzer; about 15 rule questions waiting for the owner | Rules check: waiting for the owner's answer on the Admin Phase order (4.2b/c) |
| Table and interface | Six critiques fixed; "no automation" since 13 November; not re-tested end to end since | Interface: idle |
| Computer opponent | Plays The Bulge from both sides, a little better than the reference player; stages 1–5 of 6 done | Computer opponents: idle since 12 November, waiting for the owner's playtest |
| 3D figures | In the game, blocks the default; the owner keeps them and wants them polished | 3D assets: waiting for the owner to upload the three model archives again |
| Lessons | Work, but too long and complex; to be rebuilt (owner, 13 November) | none yet |
| Code | Split into small themed files, formatted, with a size guard; pictures, a rules fingerprint and tests as a safety net | Project management (this session) |
| Site | Published from `main`; the database rules of 10 November are not published yet | owner |

## 3. What is open

**Only the owner can do these** (they block the rest):

| # | Action | Unblocks |
|---|---|---|
| O1 | Publish `database.rules.json` (Admin > Update rules) | the site matching `main` |
| O2 | Upload the three model archives to the 3D assets session again | the figures polish |
| O3 | Answer the Admin Phase order question in the rules session, then the other rule questions, a few at a time (`docs/AUDIT-2026-11.md` §5) | rule fixes |
| O4 | Play a few turns against the computer (`?lab=german`, `?lab=allied`), after step A3 below | stage 6, the levels |
| O5 | Say whether the present lessons stay on the site until the new ones are ready | the tutorial work |

**Work for the sessions:**

| # | Item | Size | Depends on |
|---|---|---|---|
| W1 | Every session takes the new file layout (merge `main`, format) | small | — |
| W2 | One command that runs every check (`verify`), with the load check and the rules fingerprint kept in the repository | small | — |
| W3 | Full re-test of each volume and of an online game after "no automation" | medium | W2 |
| W4 | Fix what W3 finds | unknown | W3 |
| W5 | Computer opponent: check it against the click-every-step flow, re-run its measurements on the 13 November rules | small | W1 |
| W6 | Computer opponent stage 6: three levels, phone speed; then a link on the home page | large | O4 |
| W7 | 3D figures polish (mockup first for anything big) | medium | O2 |
| W8 | Rule fixes from the owner's answers, each "Rule fix: …" with a test | medium | O3 |
| W9 | Split `vol/golan.ts` and `vol/sicily.ts`, with a seeded-game fingerprint made first | medium | W8 quiet |
| W10 | New lessons: an outline per volume for the owner's approval, then the build, then Italian | large | O5 |
| W11 | Interface leftovers: stripes for cut-off areas on the 3D map; each screen's CSS in one place | small / medium | W4 |
| W12 | Later: computer opponent for Golan and Sicily; push notices with the app closed | large | version 1 |

## 4. The order

**Phase A, make it solid again (first).** The code moved a lot on 13 November and the interface changed its flow the same day; nobody has played a whole game since.

- A1. W1: this session tells every session what changed (see section 6).
- A2. W2: the `verify` command.
- A3. W5 and W3 together: the computer-opponent session checks its table; the full re-test runs as the first trial of the playtest agents (section 5).
- A4. W4: the interface session fixes what was found. The Bulge first: it must not break.
- Owner in parallel: O1, O2, O3 (first question), O5.

**Phase B, the product work (three streams side by side, each in its own files).**

- Stream 1, the owner's priority: W7, the figures polish.
- Stream 2: O4, then W6, the computer opponent's levels.
- Stream 3: W8 as the answers come; W9 when the rules are quiet.
- Then W10, the new lessons: last in this phase on purpose, so they are written once the flow and the rules have stopped moving.

**Phase C, finishing.** W11, a last full re-test, the version 1 list of section 1 checked item by item, then W12.

**Rules of the road** (they exist already; listed so the plan is complete): one owner question at a time per session; a mockup before a big interface change; merge, never force-push; `npm run format` before pushing; pictures before and after a change that must not alter the look; "Rule fix:" in the commit message when a rule changes.

## 5. Agents and subagents: do they help here?

**What they are.** A session can hand a task to a helper (a subagent) that works on its own and brings back only a short report. Helpers can be defined once in the repository (`.claude/agents/`, where the four `impeccable` ones already live) so every session has the same ones. Several can run at once.

**Where they would help this project**

| Need | Why a helper fits | Proposed helper |
|---|---|---|
| The owner is the only tester, and W3 needs six full play-throughs (three volumes, phone and desktop) | Independent, parallel, read-only work; fresh eyes find what the author no longer sees; the screenshots and logs stay out of the main session | **`fab-playtester`**: plays one volume on one screen size in a real browser, as a player would, and reports where it got stuck, with a picture |
| Rule fixes are the heart of the product, and today each is judged only by the session that wrote it | A second opinion that has not seen the author's reasoning: it gets the rule number and the code, reads the rulebook text itself, and says whether they agree | **`fab-rules-referee`**: read-only; quotes the rule, says "matches" or "differs" and why |
| Long checks filled this session's memory with waiting and logs | A cheap model can run the checks and return one table | **`fab-verifier`**: runs `verify` (and the pictures when asked) and reports pass or fail with the failing lines |
| Searching the rulebooks and the code for every place a rule touches | Wide reading, small answer | the built-in search helper, no new one |

**Where they would not help** (and would cost for nothing)

- Moving shared code (today's work): one thread must hold the whole picture.
- Decisions that are the owner's: a mockup, a rule ruling. A helper cannot approve.
- The computer opponent's measurements: they are processor time, not thinking; scripts do them.
- Small changes: a helper starts knowing nothing and must be briefed; for a short task the briefing costs more than the task.

**The costs, plainly.** Each helper spends tokens of its own; six play-throughs at once is a burst. A helper's report can be wrong in the same confident tone as when it is right, so a finding counts only with its picture or its quoted rule. That is why the plan starts with one trial and a measure.

**What was taken from the Claude Code Game Studios template** (the owner's pointer, 13 November), and what was left:

| Its idea | Here |
|---|---|
| The user decides; question, options, decision, draft, approval | already the owner's rules: one question at a time, a mockup first |
| Roles own directories; no change outside them without being asked | the ownership table in `docs/PARALLEL.md`, now by module |
| "The file is the memory": a short checkpoint a cold reader can resume from | `docs/sessions/<session>.md`, overwritten, at most 25 lines |
| Review gates run by a fresh helper that has not seen the author's reasoning | the four gates in `docs/PARALLEL.md`; the rules referee |
| A change a player can see is run and looked at, and the picture is kept | the playtester: no finding without its picture; `npm run shots` |
| The same seeded run is played again after every change | `bot/fingerprint.txt`: twelve seeded games of The Bulge, checked by `npm run verify` and by CI |
| Scripts report observations, the judge decides | `verify` prints what ran and what failed; the session decides |
| A model per role, pinned in the helper's file | the verifier and the playtester on the mid model, the referee on the session's |
| Independent helpers are sent together; a blocked one is reported, not skipped | the `fab-playtest` skill |
| Several sessions only for work in different files | the parallel sessions, as today |

Of its 49 roles, fifteen are here as `fab-…` helpers, rewritten for this game (coding, design, graphics, words, review, test: `docs/MANUAL.md` section 2). Left out: the 16 specialists for other game engines, sound, story, in-game economy, live events, community and analytics (the game has none of them), the directors (the owner directs, the project-management session produces), and its sprint, epic and design-document ceremony. Nothing of its text was copied.

**Put in place on 13 November**: `npm run verify`, `bot/fingerprint.txt`, `web/e2e/load.mjs`; fifteen helpers (three for checks first, twelve role helpers added the same evening on the owner's request); the skill `fab-playtest`; the session notes; the gates in `docs/PARALLEL.md`. **Not yet run**: the first playtest (step 4 below), which is the trial that says whether the helpers earn their cost.

**How to put them in place**

1. Step A2 first: helpers are only as good as the commands they run.
2. Add the three definitions to `.claude/agents/`, each a short file: its job, its tools (the playtester and the verifier get the shell, the referee only reading), the cheaper model for the verifier and the playtester, the stronger one for the referee.
3. Add a short "Helpers" section to `docs/PARALLEL.md`: when to call which, at most six at once, a finding needs its evidence.
4. **Trial**: run W3 with six playtesters. Keep them if they find real problems the tests missed; drop them if the reports are noise. The result goes in `docs/STATUS.md` with what it cost in time.
5. If the trial is good: the rules session calls the referee before each "Rule fix" push; every session calls the verifier before pushing a large change.

## 6. Coordinating the sessions

Today this session follows the others only through `main` and the documents, and the owner carries messages between them. Two things would shorten that loop; both need the owner's yes because they change the rule in `docs/PARALLEL.md` §4 ("it does not talk to them directly"):

- **Direct notes.** This session can send a message to another session and read what it last reported. Use: the hand-over after a change like today's (A1), and passing on an owner's answer. Such a note is information for the other session, not an order: it cannot make it delete, publish or change permissions.
- **One list of what waits for the owner.** On 13 November two sessions were stopped on a question the owner may not have seen. This session would collect them in `docs/STATUS.md` ("waiting for you", one line each, with the session's name), so one look shows everything.

Also on request: a **weekly report** (for example Monday morning) as a scheduled task that reviews `main` and updates `docs/STATUS.md`.

## 7. Which model for which work

| Work | Model and effort |
|---|---|
| Rules fixes, the referee helper, the computer opponent's design, moving shared code | the strongest model, high effort |
| Interface work, the figures polish, the lessons' outline | the strongest model, medium effort |
| The verifier and playtester helpers, formatting, documents, the weekly report | the mid model (Sonnet), medium effort |

## 8. What could go wrong

| Risk | Guard |
|---|---|
| The Bulge breaks unnoticed | W2 and W3 before any new feature; the 12-game fingerprint on every engine change |
| Golan and Sicily have weaker protection than The Bulge (no seeded-game fingerprint, no computer player) | W9 makes the fingerprint first; the playtesters cover them in W3 |
| Sessions drift apart again | A1 now; the "waiting for you" list; the weekly report |
| Helpers cost more than they give | one trial, measured, before adopting |
| The free Firebase plan's limits | no change planned that adds database traffic; any that would is flagged to the owner first |
