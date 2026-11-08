# Handover to the next session

Written at the end of a long development session. Read this, then `docs/ARCHITECTURE.md` (how the pieces fit), `docs/DEPLOY.md` (Firebase, GitHub Pages, push relay) and `README.md`.
Three projects now run in parallel sessions (computer opponent, rules review, figures instead of blocks): see `docs/PARALLEL.md` for who owns which files.

## 1. What this is

GMT's block wargame series **Fast Action Battles** as a browser game: a rules engine in TypeScript (`engine/`), a three.js table (`web/`), online play on the free Firebase plan, and a computer opponent. Three volumes are playable: **The Bulge**, **Sicily**, **Golan '73**. The owner is the product owner and tester; they play on a phone (Android) and desktop.

## 2. Where it stands (everything below is on `main`)

- **Audit**: all eight findings of the last `/ponytail-audit` are fixed (5–8: fuzzer no longer hides known problems, the device/account choice is `syncChoice` in `web/src/solo.ts` with a table test, tuning leftovers gone from `ai.ts`, the push relay only posts to real push services).
- **Rules**: a full sweep of all three volumes (about 60 bugs fixed), a random full-game fuzzer (`engine/test/sweep-fuzz.test.ts`), players choose their own step losses (6.43), Golan optional rules 18.1–18.5.
- **Phase 4 extras, all done**: install as an app (PWA), "your move" notices (in-page notices work; the closed-app push relay in `tools/push-worker` is optional and **not set up**), replay viewer, Play Book example figures, Italian interface and tutorials (`web/src/i18n*`, `GLOSSARY.md`).
- **Maps**: 2D from the printed maps, 3D relief from satellite data, for all three volumes. Latest work (3D dioramas, phone map-line fixes) was done by another session and is merged.
- **Computer opponent (4.4)**: `engine/src/ai.ts`, three levels (Easy, Normal, Hard), thinking in a worker thread (`web/src/cpu-worker.ts`), home-page card "Play the computer", pace setting, one-line turn summary. Games against the computer are kept on the device and, when signed in, in the player's account (`web/src/solo.ts`, `store-rtdb.ts`: `users/{uid}/soloIndex` and `users/{uid}/solo`), with a "played on another device" question when two devices diverge.
- **Tests**: engine 357, web 116, database rules 35 (needs Java + Firebase emulator). CI (`.github/workflows`) runs engine, web, push relay, database rules and a browser smoke test.
- **Progress page** (private artifact, ticks stored in its database): https://claude.ai/artifact/SHN8KVGcEFYxQRmywT7MEm. All of phases 1–6 and 4.x are ticked.

## 3. Owner actions still pending

1. **Publish `database.rules.json`** (Admin > Update rules on the site, or the Firebase console) after every change to that file. The last change adds `rev` under `users/{uid}/solo/{id}`; until it is published, saving games against the computer to the account fails (they still work on the device).
2. Optional: set up the push relay (`docs/DEPLOY.md` §7). The owner said "we'll keep push notices for later".

## 4. Open work, in the order the owner would want it

1. **Re-measure the hard computer player.** Its strength numbers were taken while it could see face-down blocks (fixed since: it now thinks on a masked copy, `mask()` in `ai.ts`). Run the arena (below), then retune `ai.TUNE`. The owner wants Hard to be **hard to beat**; known weak spot: the German attacker in The Bulge loses most games by Allied sudden death on turn 4. Ideas: multi-turn planning for the attacker, better use of artillery and Special Actions.
2. **Computer-player gaps**: chits it never plays (Bulge: Greif, Bodenplatte, von der Heydte, roadblocks, staff, interdiction; Golan: jamming, counterbattery, recon, merging, optional rules; Sicily: dogfights, naval shock, flanking invasion, evacuation, Patton, extraction, fading morale), and Special Actions in battle (reinforce or retreat a defence).
3. Easy/Normal/Hard are chosen by `?level=`; nothing yet for a difficulty that adapts.

## 5. How to run and measure

```bash
cd engine && npm ci && npm run typecheck && npm test        # 357 tests, a few minutes with the fuzzer
cd web && npm ci && npm run typecheck && npm test && npm run build
cd tools/rules-test && npm ci && npm test                   # needs Java (Firebase emulator)
cd web && npm run dev                                       # the table, on the Vite address
```

- **Play against the computer locally**: `http://localhost:5199/?cpu=german&level=hard&new=1&scenario=tournament&fuel=1&dev=1` (`cpu=` is the computer's side; `game=golan73|sicily` for the others).
- **The arena** (computer versions against each other, mean net victory points per seat): `cd engine && ARENA=1 ARENA_GAMES=6 ARENA_PAIRS=hard:ref ARENA_GAMES_LIST=bulge,golan73,sicily npx vitest run test/arena.test.ts` (`ref` is the frozen first version in `test/ai-ref.ts`; tune with `ARENA_TUNE='{"asym":0.4}'`). Several runs in parallel take 10–30 minutes. The tournament scenarios are one-sided between these players, so read the margin from each seat, not the win count.
- **Account sync end to end**: run the Firebase emulators (`firebase emulators:start --only database,auth --project demo-fab` with the repo's `database.rules.json`) and the dev server with `VITE_FIREBASE_API_KEY=demo VITE_FIREBASE_PROJECT_ID=demo-fab VITE_FIREBASE_DATABASE_URL="http://127.0.0.1:9000?ns=demo-fab" VITE_FIREBASE_EMULATOR=127.0.0.1`, then drive two browser contexts with Playwright (installed in `web/node_modules`; Chromium at `/opt/pw-browsers` in cloud sessions).

## 6. Skills and hooks for the next session

Both are committed in `.claude/` and load by themselves when a session opens this repository (no plugin to install):

- **ponytail** (`.claude/skills/ponytail*`, `.claude/ponytail/`): the "smallest change that solves it" mode and its audit, review, debt, gain and help skills. Hooks in `.claude/settings.json`: SessionStart, UserPromptSubmit and SubagentStart run `node .claude/ponytail/hooks/*.js` (they need Node 22, which is there).
- **impeccable** (`.claude/skills/impeccable/`, agents in `.claude/agents/impeccable-*.md`): the UI design skill (critique, polish, audit, craft…). Hooks: SessionStart ("Preparing build session"), PostToolUse on Edit/Write ("Checking UI changes") and Stop ("Design deep pass") run `.claude/skills/impeccable/scripts/impeccable hook`; each hook is skipped if that file is missing.
- A fresh clone of `main` was tested: the ponytail activation hook prints "PONYTAIL MODE ACTIVE" and the impeccable hook runs and exits cleanly.
- Skill names in the session: `FAB:ponytail`, `FAB:ponytail-audit`, `FAB:ponytail-review`, `FAB:ponytail-debt`, `FAB:ponytail-gain`, `FAB:ponytail-help`, `FAB:impeccable`. Use them for UI work (impeccable) and for any coding task or review (ponytail).

## 7. Things that bit us

- A long inline `//` comment placed in the middle of a line swallows the rest of that line when text is patched by script: use `/* */` or put the comment at the end of the line.
- Phone browsers can draw a large SVG blank the first time; the board image cache only keeps a layer once it holds ink (`keepIfInked` in `web/src/main.ts`). The other session's later fixes (no SVG `<pattern>`, 1x canvas on phones) are in `main`.
- Two sessions push to `main`: when a push is rejected, fetch and **merge** `origin/main`, never force-push.
- Hidden blocks: the shared copy and the computer must never see a face-down enemy block (`engine/src/split.ts`, `ai.ts` `mask`). Any new computer code that reads enemy blocks must go through `est`/`hiddenAvg`, never `u.str` directly.
