# Architecture and the next games

FAB is a series: every game shares the same core rules (the chit boxes and selection cup, Special Actions, the Success Number and combat sequence, movement costs, supply, morale) and each game adds its own map, units, scenarios and exclusive rules. The code is already split that way along these lines:

| Layer | Where now | Notes |
|---|---|---|
| Series rules | `engine/src/{dice,combat,movement,chits}.ts`, most of `game.ts` | Dice (seeded), Player Aid C tables, movement graph search, chit kinds and boxes, the phase machine. |
| Game data | `data/bulge/*.json` | Map polygons and connections, areas, units, counters, reinforcements, scenarios, entry areas. |
| Game-exclusive rules | `game.ts` sections marked 14-17 (zones, fuel, Greif, Bodenplatte, Heydte, British limits, airborne) | These are the parts a new game replaces. |
| Client | `web/src` | Board, UI, chits, dice, online. Reads the map from `data/<game>/map.json` and `public/map-base.svg and map-lines.svg`. |
| Online | `web/src/online.ts` + `store-*.ts` | One state document and one seats document per table; stores are pluggable. |

## Plan for game 2
1. Move the series layer to `packages/fab-core` and the Bulge rules and data to `games/bulge` (engine exports `createGame(ruleset)`). The exclusive rules become a `Ruleset` object: zones, army boundaries, fuel, events, set-up, victory.
2. The client selects a game by id (`?game=bulge`) and loads that ruleset, its data and its art. Chit art generation (`web/scripts`) moves into each game folder.
3. Keep the save format versioned (`version`, `game`) so tables and saves can be told apart; today saves are checked by field.
4. Matches database: a `matches/{id}` document (players, game, scenario, status, result) and a per-user list, once login exists. Online play stays the same: tables are `tables/{match}/docs/{state,seats}`.

## Known gaps before multi-user play
- Hidden blocks (6.24): `visibleTo` in the engine decides what a seat may read; the web client draws hidden enemy blocks as blank backs and each seat looks from its own edge of the map. This is enforced in the browser only: the shared state still contains every block, so a determined player could read it. Real secrecy needs a server.
- Turn control is enforced in the client and by Firestore rules only for who may write, not for what a move is. A server-side validator (Cloud Function re-running the deterministic engine) is the next step.
- Dice come from the stored seed, so a player who reads the state could predict rolls; move the roll to the server when that matters.

## Lobby and matches
`web/src/games.ts` lists the series titles (Bulge ready; Sicily, Golan '73 pending). Signed-in players create a game in the lobby: `matches/{id}` (record), `tables/{id}/docs/seats`, `tables/{id}/docs/state`. The invite link is `?table={id}`; sitting adds the player to `members`. Battle set-up: each seat handles only its own assets, both press Ready (`setReady`), the attacker may `cancelBattle` until a Special Action is spent; each fire step is rolled by the side that owns it.


## Screens
Home (`?` with no table) is its own page: sign in, your games, new game, join with an invite. A game opens at `?table={id}`; a slim bar over the table offers the free seat(s) or the invite link, and Menu has Players, Log, Settings, Admin and Leave game. There is no hot-seat mode; `?dev=1` plays a local table for development only.
