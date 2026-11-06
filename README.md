# FAB – Fast Action Battles (online)

A browser version of GMT's block wargame series **FAB – Fast Action Battles**, played on a 3D table, online with a friend or hotseat on one screen. Published with GMT's permission.

| Volume | Status |
|---|---|
| 1. *The Bulge* | Playable: Tournament, Campaign, Nuts! and Cold Shoulder; tutorial |
| 2. *Sicily* | Planned |
| 3. *Golan '73* | Playable: Operation Badr (historical and free set-up), Battle for Nafakh, Operation Al-Owda; tutorials |

One rules engine and one interface serve every volume (`docs/design/one-engine.md`).

## What it does

- **Every rule enforced:** movement, stacking, combat rounds, retreats, supply, reinforcements, events and Special Actions, plus each volume's exclusive rules and its optional rules (chosen when creating a game).
- **Online play:** sign in with Google or email, create a game, share the link. Moves appear live on both screens. Each side sees only its own blocks, and online dice come from a secure random source. Guests may watch.
- **Rules reference:** the rulebooks, play books, scenario sheets and player aids, searchable and indexed. Rule numbers in the game's prompts open the matching rule.
- **Tutorials:** guided courses for each volume.
- **Desktop and phone** layouts.

## Run it locally

Needs Node 22.

```bash
cd web
npm ci
npm run dev
```

Open the address Vite prints. Without a Firebase config (`web/.env.local`, see `web/.env.example`), only the offline development table works.

## Tests

```bash
cd engine && npm ci && npm run typecheck && npm test
```

```bash
cd web && npm ci && npm run typecheck && npm test
```

The database rules tests need Java (Firebase emulator): `cd tools/rules-test && npm i && npm test`.

## Deploy

Every push to `main` runs the checks and publishes the site to GitHub Pages (`.github/workflows/pages.yml`). Firebase (login and the shared database) is on the free Spark plan. Full set-up: `docs/DEPLOY.md`.

## Where things are

| Folder | Contents |
|---|---|
| `engine/src` | The rules engine: pure TypeScript, no browser code. `game.ts` is the series rules; `vol/` holds each volume's exclusive rules. |
| `web/src` | The client: three.js table, panels, online glue, rules reader, tutorials. |
| `data/<volume>/` | Map, units, counters, scenarios, rules text (`rules.json`) for each volume. |
| `tools/` | Scripts that build the data: map and art extraction, rules text (`tools/rules/`), database rules tests. |
| `docs/` | Design notes, architecture (`docs/ARCHITECTURE.md`), deployment, and each game's source material (`docs/games/<volume>/`). |

## Adding a volume

1. Put the volume's rulebooks, map, counters and player aids in `docs/games/<volume>/`.
2. Build its data in `data/<volume>/` (map, units, counters, set-ups).
3. Write its exclusive rules as an engine module in `engine/src/vol/`, registered with `registerHooks`.
4. Add it to the game list in `web/src/games.ts`, and its rules text with `tools/rules/build.py`.

The steps in detail: `docs/design/one-engine.md`.

## Tooling

[Ponytail](.claude/ponytail) is vendored in `.claude/` (skills: `ponytail`, `-audit`, `-review`, `-debt`, `-gain`, `-help`; hooks wired in `.claude/settings.json`).
