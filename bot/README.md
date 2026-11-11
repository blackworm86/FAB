# bot/ — the experimental computer player

The plan and its stages: `docs/COMPUTER-PLAYER-PLAN.md`. Nothing here is used by the site yet.

- `src/view.ts`: a Seat gives the computer exactly what a player in that seat sees online (`engine/src/split.ts`): hidden enemy blocks blank under opaque ids that change after each reveal, and dice that cannot be foreseen.
- `src/actions.ts`: every choice a side has right now, generated from the engine's own functions (`candidates`, `legalActions`), and `apply` to carry one out.
- `src/random.ts`: the random player (picks a kind of action, then one legal action of that kind).
- `src/doctrine.ts`: the doctrine player, a short list of plain rules (attack at good odds, march on objectives, hold threatened objectives, keep a reserve). A yardstick, not the final player.
- `src/players.ts`: every player by name, older versions included.
- `src/match.ts`: the table for computer games: real game, seat views, every action checked, stuck games reported, thinking time per decision.
- `scripts/arena.ts`: the measuring tool. `npm run arena -- doctrine random 200 [scenario]`: paired seeds, both seats, each result with its 95% margin, thinking times.
- `scripts/random-games.ts`: `npm run random -- 1000` plays random against random over all Bulge scenarios on every core.

`npm test` and `npm run typecheck` as in `engine/`.
