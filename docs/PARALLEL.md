# Three projects in parallel

The owner runs three Claude Code sessions at once. Each session reads this file, `docs/HANDOVER.md`, and only its own section below. All of them follow the standing rules in `CLAUDE.md`: push to the session branch and to `main`, **merge** `origin/main` when a push is rejected (never force-push), ask one question at a time, show a mockup before a big UI change, and never break The Bulge.

## Who owns which files (to keep merges small)

| Project | Owns | Touches carefully, in small commits |
|---|---|---|
| 1. Computer opponent | `engine/src/ai.ts`, `engine/test/arena.test.ts`, `engine/test/ai-*.ts`, `web/src/cpu-worker.ts` | `engine/src/vol/*` (only if a rule is missing for the AI) |
| 2. Rules review | `engine/src/vol/*`, `engine/src/*.ts` rules code, `engine/test/*` rule tests, the review artifact | `web/src/*-ui.ts`, `web/src/sandbox*.ts` |
| 3. Figures instead of blocks | new `web/src/figures3d.ts`, `web/public/models/`, `tools/figures/` (the pipeline) | `web/src/main.ts`: only `block()` (line ~276) and one settings switch |

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

## 3. Soldiers and tanks instead of blocks

Goal: a switch in the settings, **Blocks / Figures**. With Figures, each unit is drawn as small soldiers, guns or tanks on a base, made by a semi-automatic pipeline that uses different AI services: concept art → 3D model → animation → into the game.

Kick-off prompt for the session:

> Read `docs/PARALLEL.md` §3. Before any code, show me a mockup of one Bulge area with Figures on (US infantry, German Panther, an artillery unit, one hidden enemy unit) on desktop and phone, and wait for my approval. Then build the pipeline for one unit type end to end, and only then the rest.

**Status (November 2026):** the pipeline and the prompts for all 72 figure types are in `tools/figures/` (see its `README.md` and `PROMPTS.md`); no model has been made yet. The owner does not want Claude to model figures: every image, model and animation comes from the AI services. The shapes in `web/src/figures3d.ts` are a stand-in from the first mockup, off by default.

Pipeline, one folder per step under `tools/figures/`, each step a script that reads the previous step's files, so a step can be redone with another service:
1. **List**: from the unit data of each volume, the distinct figure types needed (e.g. US infantry, Panther, Tiger, M4 Sherman, Italian infantry, Centurion, T-55, Merkava, artillery, HQ). Real equipment of the period is fine; Vassal images and scans are reference only and never go into the repo or into a prompt.
2. **Concept art**: an image model (for example OpenAI, Google Imagen/Gemini, Flux) makes front, side and three-quarter views on a plain background. The owner picks one per type.
3. **3D model**: an image-to-3D service (free first: TRELLIS, open source under the MIT licence, run on free Hugging Face or Colab GPU time; then the free monthly allowances of Meshy or Tripo; not Hunyuan3D, whose licence excludes the EU) makes a textured model; the script reduces it to a low polygon count and compresses it (`gltf-transform`) so the phone stays fast. Target: a few hundred KB per type.
4. **Animation**: soldiers get a rig and a few short clips (idle, move, fire, fall) from an auto-rigging service (for example Mixamo or the 3D service's own rigging); tanks need no rig, the game turns the turret, recoils the gun and rocks the hull in code.
5. **Into the game**: `.glb` files in `web/public/models/`, loaded by a new `web/src/figures3d.ts`; `block()` in `web/src/main.ts` returns a figure group instead of a box when the switch is on. Blocks remain the default.

Rules the figures must keep:
- **Hidden information.** A face-down enemy block shows nothing. With Figures, a hidden enemy unit is a neutral, covered figure (a tarp or a generic silhouette) that does not tell infantry from armour, and its strength is not shown.
- **Strength must be readable**: the base carries the unit's printed face (the same picture as the block label) or a strength bar, so the game stays playable.
- Nation colours stay as on the blocks; Italian wood stays orange `#e66525`.
- API keys never go in the repo: ask for them with the session's credential form. The owner wants free services where possible: prefer open models and free allowances, say before using anything paid, report the cost of each run, and each step can be skipped by dropping in files made by hand.
- Free Firebase plan: the models are static files served with the site, nothing goes into the database.
