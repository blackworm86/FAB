# Handover to the next session

Written at the end of a long development session. Read this, then `docs/ARCHITECTURE.md` (how the pieces fit), `docs/DEPLOY.md` (Firebase, GitHub Pages, push relay) and `README.md`.
The rules review and the computer opponent run in their own sessions, a project-management session keeps `docs/STATUS.md` (see `docs/PARALLEL.md` for who owns which files). The computer opponent was rebuilt from scratch from 10 November 2026: `docs/COMPUTER-PLAYER-PLAN.md`. What changed since the start is in `docs/CHANGELOG.md`.

## 1. What this is

GMT's block wargame series **Fast Action Battles** as a browser game: a rules engine in TypeScript (`engine/`), a three.js table (`web/`), online play on the free Firebase plan. Three volumes are playable: **The Bulge**, **Sicily**, **Golan '73**. The owner is the product owner and tester; they play on a phone (Android) and desktop.

## 2. Where it stands (13 November 2026, everything on `main`)

- **Playable**: The Bulge, Sicily and Golan '73, hot seat and online, on phone and desktop, with lessons (English and Italian), a sandbox for the owner's tests, a replay viewer and the rules reader. The interface went through six design critiques (25 → 29 out of 40, all findings fixed); the owner's rule since 13 November: **no automation**, every step and roll waits for the player's click.
- **Rules**: audited against the rulebooks (`docs/AUDIT-2026-11.md`, with the questions still waiting for the owner); the engine tests and a random full-game fuzzer guard them.
- **Maps**: 2D from the printed maps, 3D relief from satellite data, for all three volumes.
- **3D figures**: in the game (View > Units: Blocks / Figures, kit in `tools/pezzi3d/`, notes in `docs/ASSETS-3D.md`); blocks are the default. The owner decided on 13 November 2026 to keep them and polish them after the streamlining work.
- **Computer opponent**: rebuilt in `bot/`, plays The Bulge from either side, measurably (a little) better than the reference player; the owner's playtest is pending (`?lab=german`, `?lab=allied`). Stage 6, levels and phone speed, is next.
- **Code layout**: split into themed modules on 13 November 2026 (section 3).
- **Tests**: engine (417), table (134), computer opponent (11), database rules (needs Java and the Firebase emulator). CI (`.github/workflows`) runs them, the format check, the push relay test and a browser smoke test.
- **Progress page** (private artifact, ticks stored in its database): https://claude.ai/artifact/SHN8KVGcEFYxQRmywT7MEm. All of phases 1–6 and 4.x are ticked.
- **Live status of every session, open problems and the owner's pending decisions**: `docs/STATUS.md`.

## 3. Where the code is (since 13 November 2026)

Three big files were split by moving code, not rewriting it; checked by tests, a rules fingerprint and pictures. Details and results: `docs/STATUS.md`, the streamlining plan.

- **`web/src/main.ts`** only starts the table (frame loop, new game, start-up). The table lives in 22 modules, in load order: `page` (which game, its map), `game-state` (the game and the selection), `scene`, `map3d`, `piece-kit`, `pieces`, `map-paint`, `camera`, `flow` (steps, messages, act and undo), `choices`, `map-input` (taps on the map), `routes`, `map-marks` (area tags, bubbles, halos), `rolls`, `cards`, `prompt` (top bar, instruction line, main button), `dock`, `pieces-window`, `unit-card`, `map-dock`, `battle-view`, `menus`, `render`. Other files (`home`, `online`, `tutorial*`, `sandbox*`, `golan-ui`, ...) are as the architecture note describes.
  - **The load-order rule** (also written at the top of `main.ts`): the modules load in the order `main.ts` lists them, as the one file ran top to bottom. A module may use while loading only what a module above it declares; it reaches the later ones through `./main`, inside functions. A variable another module must change has a setter (`setSelUnit(...)`). Imports go through `./main`.
- **`engine/src/game.ts`** keeps the types, small helpers, a new game, control and victory points, and registers The Bulge's rules. The rest: `vol/bulge-setup`, `vol/bulge` (The Bulge's own rules, like `vol/golan` and `vol/sicily`), then by phase `reinforce`, `admin`, `moves`, `battle-setup`, `fire`, `battle-end`, `supply`, `turn`. Everything is still imported from `./game` or `index.ts`; same load-order idea (rule at the top of `game.ts`). Since 14 November `vol/golan.ts` and `vol/sicily.ts` are split the same way: each keeps its state, data and hook registration, with the rules in `vol/golan-setup`, `-scenarios`, `-moves`, `-turn`, `-combat`, `-optional`, `-actions` and `vol/sicily-setup`, `-moves`, `-turn`, `-combat`, `-actions`; everything is still reached through `E.golan` and `E.sicily`.
- **`web/src/style.css`** only lists the 28 files of `web/src/css/` with `@import`. **The order is the cascade**: later rules override earlier ones; new rules go at the end of the file for their screen. A screen can appear in several files (from different rounds).
- **Helpers, gates and session notes**: `docs/PARALLEL.md`; the fifteen helpers are in `.claude/agents/fab-*.md`; the owner's manual (what to ask, which model) is `docs/MANUAL.md`. Keep your note in `docs/sessions/`.
- **To move more code**: `cd web && node scripts/move-code.mjs` (its first lines say how): it moves whole top-level blocks with the TypeScript compiler and fixes the imports, exports and setters.
- **Formatting**: Prettier, width 140, `npm run format` at the repository root; CI fails an unformatted push. Merge `origin/main`, then format your own unpushed changes before pushing.

## 4. Owner actions still pending


1. **Publish `database.rules.json`** (Admin > Update rules on the site, or the Firebase console) after every change to that file. The last change (10 November 2026) removes the paths of the old computer games (`users/{uid}/soloIndex`, `users/{uid}/solo`). Their data, if any, can then be deleted in the Firebase console (Realtime Database, under each user).
2. Optional: set up the push relay (`docs/DEPLOY.md` §7). The owner said "we'll keep push notices for later".

## 5. Open work, in the order the owner would want it

1. **The computer opponent** (`docs/COMPUTER-PLAYER-PLAN.md`): stages 1–5 done (removal, `bot/` with the computer's view and every legal choice, measuring tool, the learned judge, the commander); the owner's playtest of `?lab=german` / `?lab=allied` is next, then stage 6 (Easy / Normal / Hard, a few seconds a decision on a phone). Its measurements should be re-run after the 13 November rule changes.
2. **The rules review** (`docs/PARALLEL.md` section 2, `docs/AUDIT-2026-11.md`): the owner's marks on the checklist page and answers to the rule questions.
3. **Tutorial**: the owner decided (13 November) to cancel the present lessons and rebuild them shorter and simpler. Until then they stay; `node web/e2e/tutorials.mjs` walks them.
4. **Interface leftovers**, not yet decided by the owner: on the 3D relief cut-off areas show a plain grey tint (stripes on the 2D map only); battles in Sicily and Golan and online games were not re-tested after the battle-flow changes and 'no automation'.
5. **After the streamlining plan** (done 13 November, `docs/STATUS.md`): polish the 3D figures (owner's decision), rebuild the tutorial, then the items above. Keep source files under 1,000 lines (`npm run check:size`, a CI check).

## 6. How to run and measure

```bash
npm ci                                                      # at the repository root: the formatter
npm run format:check                                        # and `npm run format` to fix
npm run verify                                              # every check below in one table (about four minutes); -- --browser adds the load check
cd engine && npm ci && npm run typecheck && npm test        # a few minutes with the fuzzer
cd web && npm ci && npm run typecheck && npm test && npm run build
cd bot && npm ci && npm test                                # the computer opponent (its tools: bot/README.md)
cd tools/rules-test && npm ci && npm test                   # needs Java (Firebase emulator)
cd web && npm run dev                                       # the table, on the Vite address
cd bot && npm run fingerprint                               # twelve seeded games of The Bulge must end as in bot/fingerprint.txt
                                                            # Golan and Sicily: the engine's own tests do it (test/fingerprint-golan-sicily.txt; deliberate change: npx vitest run test/sweep-fuzz.test.ts -u)
cd web && npm run e2e                                       # browser smoke test, dev server up
cd web && npm run load                                      # each game and a lesson open without an error (a minute), dev server up
cd web && npm run shots                                     # pictures of every phase, battle and window, per game and screen;
cd web && npm run shots:compare                             # after a change that must not alter the look (about 8 minutes a game)
```

`npm run shots` pictures are repeatable (fixed clock and dice); on The Bulge's phone size the camera sometimes opens a hair off and every picture of that run differs by about 1%: run that game again.

## 7. Skills and hooks for the next session

Both are committed in `.claude/` and load by themselves when a session opens this repository (no plugin to install):

- **ponytail** (`.claude/skills/ponytail*`, `.claude/ponytail/`): the "smallest change that solves it" mode and its audit, review, debt, gain and help skills. Hooks in `.claude/settings.json`: SessionStart, UserPromptSubmit and SubagentStart run `node .claude/ponytail/hooks/*.js` (they need Node 22, which is there).
- **impeccable** (`.claude/skills/impeccable/`, agents in `.claude/agents/impeccable-*.md`): the UI design skill (critique, polish, audit, craft…). Hooks: SessionStart ("Preparing build session"), PostToolUse on Edit/Write ("Checking UI changes") and Stop ("Design deep pass") run `.claude/skills/impeccable/scripts/impeccable hook`; each hook is skipped if that file is missing.
- A fresh clone of `main` was tested: the ponytail activation hook prints "PONYTAIL MODE ACTIVE" and the impeccable hook runs and exits cleanly.
- Skill names in the session: `FAB:ponytail`, `FAB:ponytail-audit`, `FAB:ponytail-review`, `FAB:ponytail-debt`, `FAB:ponytail-gain`, `FAB:ponytail-help`, `FAB:impeccable`. Use them for UI work (impeccable) and for any coding task or review (ponytail).


## 8. Things that bit us

- `web/scripts/import_map.py` needs `pip install shapely svgelements`; run it from the repository root. It rebuilt the old Bulge map byte for byte before the zone changes, so it is the source of truth for `map-base.svg` / `map-lines.svg`.
- Prototype UI changes are kept with `git stash` while the owner looks at a mockup; pop and commit only after approval.

- A long inline `//` comment placed in the middle of a line swallows the rest of that line when text is patched by script: use `/* */` or put the comment at the end of the line.
- Phone browsers can draw a large SVG blank the first time; the board image cache only keeps a layer once it holds ink (`keepIfInked` in `web/src/main.ts`). The other session's later fixes (no SVG `<pattern>`, 1x canvas on phones) are in `main`.
- Two sessions push to `main`: when a push is rejected, fetch and **merge** `origin/main`, never force-push.
- Hidden blocks: the shared copy must never show a face-down enemy block (`engine/src/split.ts`). The new computer player must see only its seat's view, the same filtered copy the online game sends to a player.
- Moving code between modules: a name set by one module and read by another is a `let` that needs its setter; a statement that runs while loading must not need something declared later in the load order (the table opens blank with 'Cannot access X before initialization'). The load check in `docs/STATUS.md` step 3 caught every case.
- Rules code is registered, not imported: The Bulge's hooks are registered at the end of `engine/src/game.ts`; registering them from `vol/bulge.ts` leaves the tests without them.
- A cascade has no reliable undo: a CSS rule moved earlier or later can change which rule wins. Keep `web/src/css/` in order (the production stylesheet was byte-for-byte checked after the split).
