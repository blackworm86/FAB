# Architecture

Technical reference for maintaining FAB: The Bulge and building the next games of the series. For the visual design see `DESIGN.md`; for setting up Firebase and GitHub Pages see `docs/DEPLOY.md`.

## 1. The pieces

| Piece | Where | What it does |
|---|---|---|
| Rules engine | `engine/src` | Every rule of the series and of The Bulge, as pure functions over one `Game` object. No browser code: it runs in the browser today and could run on a server unchanged. |
| Game data | `data/bulge/*.json` | Map (areas, polygons, connections, entry areas), units, counters, reinforcements, scenarios. |
| Client | `web/src` | three.js table, HTML overlay, chits and dice, online glue. Built with Vite to a static site. |
| Hosting | GitHub Pages | Serves the built files only; runs no code. `.github/workflows/pages.yml` tests and publishes on every push to `main`. |
| Shared storage | Firebase Realtime Database (free Spark plan) | Stores each game and pushes changes live to every open browser. Also Firebase Authentication (Google, email, anonymous guests). |

Main client files: `boot.ts` (entry: the home page, or the table on a game page), `home.ts` (home page, sign-in, invites; loads without three.js), `main.ts` (the table: scene, screens, input), `chat.ts` (chat panel), `ui-kit.ts` (the button registry both pages share), `table-text.ts` (abbreviations, button icons, die faces), `opt-rules.ts` (optional-rules chooser), `online.ts` (connection, seats, saving), `store-rtdb.ts` (all database reads and writes), `sandbox.ts` + `sandbox-ui.ts` (admin test table and hotseat), `chit-play.ts` (what a chit can be played on), `chits.ts` / `art.ts` (counter art; drawn markers and Special Action art are PNGs in `public/chit`, loaded at start), `dice3d.ts`, `fx.ts` (effect pop-ups), `rules-text.ts` (chit descriptions).

## 2. Who runs the game

There is **no game server**. Each player's browser holds a full copy of the engine:

1. The player taps an action. The client checks the seat (`allowed()`, based on `E.actorOf(g)`: who has to act now).
2. The engine applies the rule on the player's copy of the game. Dice are rolled there.
3. `online.push` hides the player's secret block details (`split.ts`), then `store-rtdb.setState` writes **only the values that changed**, signed with the writer's account id (`state/by`).
4. Firebase pushes the change to the other browser and to watchers, which rebuild their game from it.

Online dice and chit draws use the browser's secure random generator (`E.setRandom`, set in `online.ts`), so they cannot be predicted from the shared game. Tests, the sandbox and hotseat use the seeded generator (`g.seed`, `g.force` for queued dice).

## 3. What is stored (`games/{id}`)

| Path | Content | Who may read | Who may write |
|---|---|---|---|
| `meta` | title, game, scenario options, owner, created | signed-in users | the creator, once |
| `members/{uid}` | `true` | signed-in users | that user |
| `seats` | `german`, `allied`: account ids | signed-in users | a player takes a free seat for themself or leaves their own; admin frees any; one account can never hold both |
| `seatNames/{side}` | display name | signed-in users | the seat holder, or admin |
| `state` | the shared game: `f/<field>`, `units/<n>`, `chits/<n>` (JSON strings), `rev`, `by` | signed-in users (guests watch) | created by the owner; then only the two seated players (or admin); `by` must be the writer; players cannot delete it |
| `priv/{side}` | that side's real block details and salt | that seat only | created by the owner; then that seat; never deleted by a player |
| `reveals` | block details the other side has to see | signed-in users | the seated players |
| `chat/{pushId}` | `uid`, `side`, `name`, `text` (≤300 chars), `t` | signed-in users (watchers read) | only the two seated players, as themselves and their own side; never edited; only an admin deletes |
| `users/{uid}/games/{id}` | each player's game list | that user | that user |
| `users/{uid}/soloIndex/{id}` | the list entry of a game against the computer: game, the computer's side, title, scenario, turn, step, result, `rev` (saves) | that user | that user (signed in, not a guest); the entry names its own id |
| `users/{uid}/solo/{id}` | that game, as `f/<field>`, `units/<n>`, `chits/<n>` (JSON strings, like `state`); saved as differences | that user | that user (signed in, not a guest) |
| `admins/{uid}` | admin flag | that user | nobody (set by hand in the console) |

The rules are in `database.rules.json`. **After changing them, publish them** (Admin > Update rules on the site, or the Firebase console) and run the rules tests (§7).

## 4. Hidden blocks without a server (`engine/src/split.ts`)

- The shared `state` holds every block nobody may see (6.24) as a placeholder: opaque id (salted hash), no name, strength or quality. Names in the log and in morale checks are replaced by "a hidden block".
- Each seat's real details sit in `priv/{side}`, readable only by that seat. A browser rebuilds its own game with `compose(pub, priv, reveals)`.
- When a rule shows a block (a battle once both pressed Ready, face-up blocks, Intelligence Gathering), the owner's browser publishes its details to `reveals` (`SplitSeat.due`).
- When that block is hidden again, the owner's browser deletes its reveal and gives it a new opaque id (`epoch` in `priv`, `SplitSeat.save`), so the other side cannot link it to what it saw. Names in the shared log are replaced as whole words only.
- `engine/test/split.test.ts` plays into turn 2 and checks that no hidden block's name appears anywhere in the shared copy.

## 5. Referee-lite: checking the other browser (Option 1)

Without a server, the database rules decide **who** may write, not **whether a move is legal**. Each browser therefore checks every change written by the other one (`E.auditChange(prev, next, writerSide)` in `engine/src/game.ts`, called from the online callback in `main.ts`):

- the game went back in time (turn or phase earlier than before), other than a restart;
- the dice counter went backwards, or dice already rolled in the open battle changed;
- the side that wrote was not the side that had to act (`E.actorOf`), outside the phases where both act.

Problems show as a red **Rules check** bar for the receiving player and in the browser console. This detects tampering; it does not prevent it. `engine/test/audit.test.ts` plays three full games step by step, writing each step as the acting side, and expects **no** warning; it also checks that each kind of tampering is flagged.

Rolls on screen: a roll's result is written at once (`rollStage` pushes the new game), while the board keeps showing the old state until the dice land (`heldNext`, `commitRoll`). `save()` writes nothing while a roll is held, otherwise the older board would be queued behind the result and overwrite it. The referee-lite check found exactly this bug in a two-tab test; keep that guard.

Concurrency: in Prepare and battle set-up both players act at once. Writes carry only changed values, so different blocks and chits never overwrite each other. The log is appended through a database transaction (`store-rtdb.setState`), so both players' lines are kept.

## 6. Other modes

- **Sandbox / hotseat** (`?sandbox=1`, admins only): the game lives in the browser's local storage; Firebase is only asked whether the account is an admin. Free edits, queued dice, notes with game snapshots and a downloadable test report. Hotseat: the seat follows whoever acts, with a cover between players.
- **Developer table** (`?dev=1`, `?dev=1&fake=german|allied`): local tables, a fake store for two-tab tests.
- **Against the computer** (`?cpu=<side the computer plays>&game=…&scenario=…&fuel=0|1&rules=key,key,bid:n&new=1`, from the home page's "Play the computer" card): a local game kept in this browser (`fab-cpu[-game]`), no account needed. The computer player is `engine/src/ai.ts`: `ai.next(g, side, level)` returns ONE legal action (built on the engine's own option functions and a plain evaluation of the position: strength, objectives held, threatened objectives, assets in hand; admin chits are tried on a copy and kept when the position reads better), `ai.turnOf(g, side)` says whether the side has to act, `ai.play` runs a side to the end of its step (tests). An action is data (`op`, run with `ai.apply`), so the table does the thinking in a worker thread (`web/src/cpu-worker.ts`). Three levels: easy (the plain player with noise, no assets), normal (the plain player), hard (the same choices, but the best few are tried on copies of the game: an attack is fought out `SIMS.attack` times with the real rules and dice before it is made; a loss, retreat, abort or defender's choice is picked by what the position reads like after it; Breakthrough combat rounds are bought with Special Actions when they pay). The arena (`ARENA=1 npx vitest run test/arena.test.ts`, see its header) pits levels against each other and against the frozen first version (`test/ai-ref.ts`); the measure is the mean net VP from each seat, since the tournament scenarios are one-sided between these players. Standing (2026-11, mean net VP for the hard player / for the first version, as First Player and as Second): The Bulge −4.7 / −5.6 and +8.0 / +5.6; Golan '73 −2.0 / −3.5 and +4.5 / +3.5; Sicily −2.0 / −6.0 and +10.3 / +6.0. Tuning switches are in `ai.TUNE` (read from `ARENA_TUNE` JSON by the arena). It is honest: an enemy block it may not see (6.24) counts as a two-step veteran. Each game has an id (`&solo=`); it is kept on the device (`fab-solo-<id>`, listed in `fab-solo-index`, `web/src/solo.ts`) and, when the player is signed in, in the account (`users/{uid}/soloIndex`, `users/{uid}/solo`, see §3): at most 1.5 s after a change, as differences. Opening a game compares the two copies: changed on one side only, the newer wins; changed on both (two devices), the player chooses. A game played signed out is offered for the account on the home page. For local testing against the Firebase emulators set `VITE_FIREBASE_EMULATOR=127.0.0.1` (development builds only). In the client (`main.ts`: `cpuTick`/`cpuStep`) each action goes through the same `act` as a player's, one every 0.6–0.9 s with the dice thrown on screen, and the player's undo never reaches back past the computer's moves. `engine/test/ai.test.ts` plays whole games of every scenario against itself and against a player who only does what the rules force.
- **Scenarios**: Tournament (24.2), Campaign (24.1), Nuts! introductory (24.3). Nuts! limits the map to its sheet (`g.inPlay`; `setPlayArea` in `engine/src/map.ts` filters neighbours).

## 7. Tests

| Command | Checks |
|---|---|
| `cd engine && npm test` | Rules engine: combat, movement, supply, chits, events, scenarios, hidden blocks, referee-lite (`audit.test.ts`), Special Action spending. |
| `cd web && npm test` | Client helpers (undo history). |
| `cd tools/rules-test && npm i && npm test` | `database.rules.json` in the Firebase emulator (needs Java): seats and factions, secrets, who may write the game, the chat, the app's own create/join/move/leave/delete writes. Run after every change to the rules. |

CI (`.github/workflows`) runs the engine and web tests and the build on every push. The rules tests need Java and the emulator, so they run by hand.

## 8. Known limits

- A modified browser can still write a false game; referee-lite only warns the opponent. Fixing this needs a server that re-runs the engine (see §9).
- Anyone with the invite link can take a free seat; once both seats are taken nobody else can sit until a player leaves or an admin frees a seat.
- `setPlayArea` is module state: the client calls it on every refresh, and engine entry points that walk the map call it too.

## 9. Roadmap

1. **Now (free, done): Option 1.** Tight database rules with tests, referee-lite warnings, secure online dice.
2. **Server referee (Option 2 or 3).** Cloudflare Workers + Durable Objects (free tier, needs a Cloudflare account) or Firebase Cloud Functions (Blaze, pay-as-you-go). Browsers send moves; the server runs `engine/` on the full game, rolls the dice and sends each seat only what it may see. `split.ts`, `priv`, `reveals` and most of the rules go away. Keep Firebase Authentication.
3. **Growth (Option 4).** Always-on server and Postgres: lobby with open games, ratings, replays.

The engine has no browser code, so each step reuses it.

## 10. Next games of the series

1. Move the series layer to `packages/fab-core` and The Bulge rules and data to `games/bulge`; exclusive rules (zones, fuel, Greif, Bodenplatte, Heydte, British limits, airborne) become a `Ruleset`.
2. The client picks a game by id (`?game=bulge`) and loads its ruleset, data and art (`web/src/games.ts` lists the titles).
3. Version the save format (`version`, `game`).
