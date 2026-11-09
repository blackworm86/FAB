# Handover to the next session

Written at the end of a long development session. Read this, then `docs/ARCHITECTURE.md` (how the pieces fit), `docs/DEPLOY.md` (Firebase, GitHub Pages, push relay) and `README.md`.
Two projects run in parallel sessions (computer opponent, rules review; a third, figures instead of blocks, was dropped): see `docs/PARALLEL.md` for who owns which files.

## 1. What this is

GMT's block wargame series **Fast Action Battles** as a browser game: a rules engine in TypeScript (`engine/`), a three.js table (`web/`), online play on the free Firebase plan, and a computer opponent. Three volumes are playable: **The Bulge**, **Sicily**, **Golan '73**. The owner is the product owner and tester; they play on a phone (Android) and desktop.

## 2. Where it stands (everything below is on `main`)

- **Audit**: all eight findings of the last `/ponytail-audit` are fixed (5–8: fuzzer no longer hides known problems, the device/account choice is `syncChoice` in `web/src/solo.ts` with a table test, tuning leftovers gone from `ai.ts`, the push relay only posts to real push services).
- **Rules**: the audit of 8 November 2026 (`docs/AUDIT-2026-11.md`: 33 rule fixes, open questions for the owner, the owner's test page https://claude.ai/artifact/KD6t2FroR5MwtzStYJNtUz); before it, a full sweep of all three volumes (about 60 bugs fixed), a random full-game fuzzer (`engine/test/sweep-fuzz.test.ts`), players choose their own step losses (6.43), Golan optional rules 18.1–18.5.
- **Phase 4 extras, all done**: install as an app (PWA), "your move" notices (in-page notices work; the closed-app push relay in `tools/push-worker` is optional and **not set up**), replay viewer, Play Book example figures, Italian interface and tutorials (`web/src/i18n*`, `GLOSSARY.md`).
- **Interface, UI/UX session of 9 November 2026** (critique saved in `.impeccable/critique/`, score 25/40 before the work; each change shown to the owner as a mockup first):
  - **Supply you can plan with**: the Supply layer tints your supplied areas in your side's colour, hatches cut-off areas, labels supply sources, and has a Yours / Enemy switch; with a block selected, every destination where it would be out of supply reads "2 MP · no supply" and is hatched (`web/src/supply-plan.ts`, tested in `web/test/supply-plan.test.ts`); the block panel always shows its supply line.
  - **Layer bar on the map**: None · TDN · Zones · Control · Supply next to Legend, one tap, the active layer's key under it (short words on the phone); the View window keeps only the printed-map options, the move key, 2D/3D and the camera.
  - **One meaning per colour**: lime = you can move there; brass = stop here or selected; red = battles only (must fight filled, may fight a thin line); dark stripes = out of supply; grey = blown bridge. No blue in the interface (blue is for water); Israeli (Golan) and Allied (Sicily) control are ivory.
  - **Faster battles** (about 10 clicks down to 3): a tap on a red area opens the battle; set-up steps with nothing to choose, rolls with no choice before them and the close of a finished battle run by themselves (`autoBattle()` in `main.ts`; off with Settings > Dice > WAIT and in tutorials); the main button then names the nearest battle left ("Next battle: Bleialf").
  - **Smaller fixes**: a tap on an area the selected block cannot reach says why; a new battle clears the last one's messages; phone tap targets 44 px and no 10 px text; phone map tools under the layer bar: **Rotate** (a quarter turn per tap; printed names are upright only facing the long sides) and **Deselect** (redraws the map like Escape). The admin sandbox button moved to the right edge.
  - **Bulge map army zones** (`web/scripts/import_map.py`, which rebuilds `web/public/map-base.svg` and `map-lines.svg` from `docs/maps/vector/BulgeMap_layers.svg`): the magenta and cyan national-border lines are gone; the German entry strips are in their zone's colour (X blue 7th Army, Y grey 5th Panzer, Z purple 6th Panzer); each army boundary has a dashed line on each side in that side's zone colour, continuous along rivers too.
  - **The figures project was dropped** (no 3D figure generation): its pipeline, page and trial code were removed.
- **Maps**: 2D from the printed maps, 3D relief from satellite data, for all three volumes. Latest work (3D dioramas, phone map-line fixes) was done by another session and is merged.
- **Computer opponent (4.4)**: `engine/src/ai.ts`, three levels (Easy, Normal, Hard), thinking in a worker thread (`web/src/cpu-worker.ts`), home-page card "Play the computer", pace setting, one-line turn summary. Games against the computer are kept on the device and, when signed in, in the player's account (`web/src/solo.ts`, `store-rtdb.ts`: `users/{uid}/soloIndex` and `users/{uid}/solo`), with a "played on another device" question when two devices diverge.
- **Tests**: engine 358, web 125, database rules 35 (needs Java + Firebase emulator). CI (`.github/workflows`) runs engine, web, push relay, database rules and a browser smoke test.
- **Computer opponent progress page** (private artifact, kept up to date after each piece of work, see `docs/PARALLEL.md` §1): https://claude.ai/artifact/TdGcLVt1eKZtidUtHoJTfK.
- **Progress page** (private artifact, ticks stored in its database): https://claude.ai/artifact/SHN8KVGcEFYxQRmywT7MEm. All of phases 1–6 and 4.x are ticked.

## 3. Owner actions still pending

1. **Publish `database.rules.json`** (Admin > Update rules on the site, or the Firebase console) after every change to that file. The last change adds `rev` under `users/{uid}/solo/{id}`; until it is published, saving games against the computer to the account fails (they still work on the device).
2. Optional: set up the push relay (`docs/DEPLOY.md` §7). The owner said "we'll keep push notices for later".

## 4. Open work, in the order the owner would want it

1. **Re-measure the hard computer player.** Its strength numbers were taken while it could see face-down blocks (fixed since: it now thinks on a masked copy, `mask()` in `ai.ts`). Run the arena (below), then retune `ai.TUNE`. The owner wants Hard to be **hard to beat**; known weak spot: the German attacker in The Bulge loses most games by Allied sudden death on turn 4. Ideas: multi-turn planning for the attacker, better use of artillery and Special Actions.
   - Measured in November 2026 (Bulge, 16 seeds per seat): Hard as the Germans ends a mean 7–9 VP behind, against Hard and against `ref` alike; the Germans lose by sudden death on turn 4 (they start at net −11 and must reach −3). The fix needs a German plan (which mutual VP areas to take by turn 4, along which roads and bridges), not more single actions.
   - Re-measured 9 November 2026 after the rules audit, step-by-step movement and control along the path (`hard:ref`, 6 seeds per seat, mean net VP for Hard, before → after): Bulge as Germans −7.3 → −8.8, as Allies +8.7 → +8.7; Golan as Syria −3.5 → −4.3, as Israel +4.0 → +5.2; Sicily as Allies +0.3 → +0.8, as Axis +11.8 → +10.3. All within noise (about ±1.5 at this sample size): no change in strength.
   - Measured 9 November 2026 afternoon, with step movement and the empty-objective term (`expose`), 6 seeds per seat, mean net VP over both seats (the level's edge): Hard vs `ref` Bulge +3.7 (as Germans −4.3), Golan +0.4, Sicily +5.6; Hard vs Normal +2.3 / +1.3 / +4.1; Normal vs Easy +2.9 / +0.3 / +4.1. In Golan the three levels play alike.
   - Tried and dropped on 9 November (Bulge, Hard vs Hard, 16 seeds, Germans' mean net VP; today's version −5.3): seeing next turn's sudden-death check (no effect: the term is flat far from the line), points counting more when behind the line (−5.3) or always (`vpBase` 9 with it: −5.0), a goal list of objectives to take before the deadline (−5.9 to −6.1), a lower attack threshold (`planAt` 0: −5.8), enemy steps counting more (`asym` 0.8: −5.7), less guarding of empty objectives (`expose` 0.15: −4.9). Noise is about ±1.
   - What a game shows: on turns 2–4 the Germans have about twice the Allied steps on the map (45–55 against 17–37) but fight only 0–6 battles a turn; on turn 2 with 10 enemy areas in reach they attacked 3 and moved 6 blocks back to guard empty German areas (since the 2.4 fix, Allied armour takes every empty area it drives through). Weights do not fix this: the hard player judges one move at a time, one turn ahead.
   - Golan (9 November, 16 games per level against Normal): between computers Israel wins every game by sudden death (net 3 from turn 4), so the final margin cannot show a level; the arena now prints the turn games end on. Syria lasts to turn 4.9 (Easy), 5.5 (Normal), 5.6 (Hard); Israel wins on turn 4.9 (Easy), 5.5 (Normal), 4.0 (Hard). Hard Israel is clearly stronger; the Syrian levels hardly differ and none ever wins. Syria fights 5-7 battles a turn with about twice Israel's steps but wins about half. Tried for Hard Syria: `planAt` 0, `asym` 0.8, `tw1` 0.2: no change (turn 5.6-5.9).
   - 9 November, done by the rules session and handed back (not continued there): the hard player's position score in The Bulge now counts empty friendly objective areas the enemy can drive into next turn (`enemyReach`, `TUNE.expose` 0.35 in `ai.ts`); arena hard:ref, 6 seeds per seat: Germans −8.8 → −4.3, Allies +8.7 → +11.7. A supply-line term was tried and removed (no gain). Remaining German leaks seen: Bastogne taken but out of supply, big German divisions lost (asym 0.4 makes Hard count its own losses at 60%; untested), the southern border (1, 14, 15) falling late.
2. **Computer-player gaps**: done for the Bulge (both sides use them): bridge repair, Greif bridge and interdict, Bodenplatte, von der Heydte, command-staff reserve, paying a Special Action for armour Breakthrough movement, reserves shoring up threatened areas in the Reaction Phase. Measured: no change in strength (within noise), but the game is now played with these rules. Still missing: Bulge roadblocks, blowing bridges on its own initiative, staff boundary/intel/pool, Allied interdiction missions; Golan: jamming, counterbattery, recon, merging, optional rules; Sicily: dogfights, naval shock, flanking invasion, evacuation, Patton, extraction, fading morale), and Special Actions in battle (reinforce or retreat a defence).
3. Easy/Normal/Hard are chosen by `?level=`; nothing yet for a difficulty that adapts.
4. **Interface leftovers** from the 9 November critique, not yet decided by the owner: on the 3D relief cut-off areas show as a plain grey tint (the stripes are drawn on the 2D map only); battles in Sicily and Golan and online games were not re-tested with the faster battle flow.

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

- `web/scripts/import_map.py` needs `pip install shapely svgelements`; run it from the repository root. It rebuilt the old Bulge map byte for byte before the zone changes, so it is the source of truth for `map-base.svg` / `map-lines.svg`.
- Prototype UI changes are kept with `git stash` while the owner looks at a mockup; pop and commit only after approval.

- A long inline `//` comment placed in the middle of a line swallows the rest of that line when text is patched by script: use `/* */` or put the comment at the end of the line.
- Phone browsers can draw a large SVG blank the first time; the board image cache only keeps a layer once it holds ink (`keepIfInked` in `web/src/main.ts`). The other session's later fixes (no SVG `<pattern>`, 1x canvas on phones) are in `main`.
- Two sessions push to `main`: when a push is rejected, fetch and **merge** `origin/main`, never force-push.
- Hidden blocks: the shared copy and the computer must never see a face-down enemy block (`engine/src/split.ts`, `ai.ts` `mask`). Any new computer code that reads enemy blocks must go through `est`/`hiddenAvg`, never `u.str` directly.
