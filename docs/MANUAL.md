# How to run this project

The owner's manual: who does what, what to type, and which Claude model to choose for each kind of work. Written 13 November 2026 by the project-management session. The live state is in `docs/STATUS.md`, the plan in `docs/ROADMAP.md`; this file is how to work them.

## 1. The idea in one minute

- **You decide.** Nothing big is built before you have seen it (a mockup, a question with options), and nothing reaches the site that failed its checks.
- **Sessions are the departments.** Each long-lived session owns a part of the project and its files, so two never edit the same file.
- **Helpers are the specialists.** A session calls a helper for one job (write this rule, review this change, play this game) and gets back a short report. The helpers are defined once, in `.claude/agents/`, and every session has them from its next start.
- **Files are the memory.** A conversation can be lost; `docs/STATUS.md`, `docs/sessions/*.md` and the commit history cannot.

## 2. The cast

**Sessions** (start a new one with the prompt in section 5 if one is lost):

| Session | Owns | Its note |
|---|---|---|
| Project manager | the plan, the status, the checks, the helpers | `docs/sessions/project-management.md` |
| Interface | the table (`web/src`), the styles, the lessons | `docs/sessions/interface.md` |
| Rules check | the engine (`engine/`), the rule tests, your checklist page | `docs/sessions/rules.md` |
| Computer opponents | `bot/`, the experimental tables | `docs/sessions/computer-opponent.md` |
| 3D assets | the figures, the pieces kit | `docs/sessions/figures.md` |

**Helpers** (15, all named `fab-…`; a session picks the right one by itself, or you can name it):

| Kind | Helper | What it does | Model it runs on |
|---|---|---|---|
| Code | `fab-rules-programmer` | a rule in the engine, with its test | the session's, high effort |
| | `fab-ui-programmer` | screens, panels, phone and desktop layouts | the session's |
| | `fab-ai-programmer` | the computer opponent | the session's |
| | `fab-online-programmer` | online play, hidden blocks, database rules | the session's |
| | `fab-tools-programmer` | check scripts, browser tests, importers, CI | Sonnet |
| Design | `fab-ux-designer` | a flow or a screen: options and a mockup for you | the session's |
| | `fab-graphics-artist` | figures, blocks, textures, light, the 3D map | the session's |
| Words | `fab-lesson-writer` | the lessons, outline first | Sonnet |
| | `fab-translator` | Italian, by the glossary | Sonnet |
| Review | `fab-rules-referee` | a rule against the printed text, clause by clause | the session's, high effort |
| | `fab-code-reviewer` | a change before it is pushed | the session's, high effort |
| | `fab-security-reviewer` | cheating and leaks: hidden blocks, database rules | the session's, high effort |
| Test | `fab-playtester` | plays one game on one screen, reports with pictures | Sonnet |
| | `fab-verifier` | runs every check, returns one table | Sonnet |
| | `fab-release-manager` | is `main` fit to publish, and your checklist | Sonnet |

"The session's" means the helper uses whatever model you chose for that session: that is why the next section matters.

Of the template's 49 roles, these are the ones a finished board-game engine on the web needs. Left out: the 16 specialists for Godot, Unity and Unreal (this game uses none of them), sound and music, story and world-building, in-game economy, live events, community and analytics (the game has none of these), and the directors (you are the director; the project manager is the producer).

## 3. Which model to choose

Choose the model when you open or resume a session (`/model`), and the effort beside it. A stronger model is slower and costs more of your usage; a weaker one on hard work costs more in mistakes.

| The work | Model | Effort |
|---|---|---|
| A rule fix or anything in `engine/`; hidden blocks and online play; moving shared code | **Fable 5.2** | **high** |
| A review (referee, code, security) | **Fable 5.2** | **high** |
| The computer opponent's design and measurements | **Fable 5.2** | **high** |
| Interface work, a mockup, the figures and graphics | **Fable 5.2** | medium |
| Planning, a status review, deciding priorities | **Fable 5.2** | medium |
| Lessons' text, Italian, documents | **Sonnet 5.5** | medium |
| Tools, check scripts, formatting, the weekly report | **Sonnet 5.5** | medium |
| Running the checks, a playtest, a release check | **Sonnet 5.5** | medium (the helpers set this themselves) |
| Nothing in this project | Haiku 5.5 | — |

Rules of thumb:

1. **If a mistake would be silent, go strong.** A wrong rule or a leaked hidden block does not crash; it just plays wrong.
2. **If a tool will catch the mistake, go cheaper.** Formatting, translation lengths, a script that either runs or does not.
3. **Raise the effort before you change the model.** Fable at high effort for an afternoon of rule fixes; back to medium for interface polish.
4. A session that sends a "Sonnet" helper pays Sonnet for that job even if the session itself is on Fable. You never need to switch models just to run the checks or a playtest.

Opus 5.5 is not in the table because this project has no measurement of it against Fable 5.2; if Fable is unavailable, use Opus 5.5 where the table says Fable.

## 4. The routine

**Every time you sit down** (two minutes): open `docs/STATUS.md`. The top says what waits for you. Answer one waiting question in the session that asked it; that unblocks more than anything else you can do.

**When you want something built:**

1. Say it in the session that owns that part (section 5 has the wording). If you are not sure which, say it to the project manager.
2. For anything you will see on screen, expect a mockup or a question first. Answer it.
3. The session builds, calls its helpers, runs `npm run verify`, pushes, and updates its note.
4. Try it on your phone. What you find goes back to the same session in one line.

**Once a week** (or on request): ask the project manager for a review. It reads `main` and the session notes, updates `docs/STATUS.md`, and tells you what is blocked and what it proposes next.

**Before telling players about a new version:** ask for a release check (section 5).

## 5. What to type

Copy, change the words in capitals. Each line works as the first message of a new session or in the middle of an old one.

**Starting or resuming a session**

> Read `CLAUDE.md`, `docs/HANDOVER.md`, `docs/PARALLEL.md` and your note in `docs/sessions/`. Merge `origin/main`. Tell me in five lines where you stand and what you wait for.

**A rule that is wrong** (rules session, Fable high)

> Rule NUMBER in GAME does not work: WHAT I SAW. Reproduce it in a test, ask the rules referee for its reading, fix it with the rules programmer, and show me the referee's table before you push.

**A rule question you are answering** (rules session)

> My ruling on QUESTION: ANSWER. Apply it, with a test, and record it in the audit.

**A change to a screen** (interface session, Fable medium)

> On SCREEN I want WHAT, because WHY. Have the UX designer give me two options as mockups, phone and desktop. Build nothing until I choose.

**After you chose** (interface session)

> Option N. Build it with the UI programmer, have the translator do the Italian, run the checks with the browser, and show me a phone screenshot.

**Figures and graphics** (3D assets session, Fable medium)

> Polish WHAT on the figures of GAME. Show me before and after pictures, blocks and figures, phone and desktop.

**The computer opponent** (computer-opponent session, Fable high)

> Go on with stage N of the computer-player plan. Measure every change from both seats and tell me the numbers in plain words.

**A full re-test** (project manager, Fable medium; the helpers run on Sonnet)

> Run the playtest on GAMES. Give me the findings with pictures, worst first.

**A review of a big change** (any session, before it pushes)

> Before you push, have the code reviewer read the change, and the security reviewer too if it touches online play. Show me their findings.

**The checks only** (any session)

> Run the verifier and show me its table.

**A status review** (project manager)

> Review the project: read `main` and the session notes, update the status, and tell me what waits for me and what you propose next.

**A release check** (project manager)

> Have the release manager check `main` and give me my checklist.

**When a session seems lost or slow**

> Stop. Write your session note now: doing, next, waiting, files in hand. Then tell me the one thing blocking you.

## 6. The gates (what "done" means)

A session may say "done" only when:

1. `npm run verify` passed (with the browser when the table changed).
2. A rule change has its test, the referee's reading without a "differs", and starts with "Rule fix:".
3. A change that must not alter the look has matching pictures (`npm run shots` before, `npm run shots:compare` after).
4. You approved the mockup of a big interface change, and you ruled on any rule the book leaves open.
5. Its note in `docs/sessions/` is up to date.

If a session says "done" without these, ask: "Which gates did you pass? Show me the table."

## 7. Only you can do these

- Publish `database.rules.json` after it changes (Admin > Update rules on the site).
- Upload files a session asks for (the model archives for the figures).
- Rule on what the rulebook leaves open.
- Approve a look.
- Play it on your phone: no helper replaces that.

## 8. When something goes wrong

| What you see | What to do |
|---|---|
| The table opens blank after a change | Ask that session to run the verifier with the browser; a "cannot access … before initialization" is a load-order break (the rule is at the top of `web/src/main.ts`) |
| Two sessions changed the same thing | Tell the project manager; the ownership table in `docs/PARALLEL.md` says whose file it is |
| A push is rejected | The session must merge `origin/main` and push again; never force |
| A session forgot what it was doing | "Read your note in `docs/sessions/` and go on" |
| A helper's finding looks wrong | Ask for its evidence: the picture, the quoted rule, the failing line. No evidence, no finding |
| The work is costing too much | Check the model and effort against section 3; ask for the verifier instead of long checks in the session; run a playtest on one game instead of three |
| The Bulge behaves differently | `cd bot && npm run fingerprint` shows which seeded games changed; if nobody meant to change a rule, the last engine change is wrong |
