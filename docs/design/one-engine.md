# One engine, one interface, three volumes

Goal (user, 2026-11-05): the games share one base interface and one base rules engine, so the interface and the series rules are maintained once; each volume plugs in its map, pieces, scenarios and exclusive rules.

Done (2026-11-05): `engine/src/*.ts` is the series engine; The Bulge and Golan '73 are volume modules; `web/src/main.ts` is the one interface, with `web/src/vol.ts` the view of the volume it runs. The separate Golan engine and page are gone.

## Shape

- `Side` is a string; a game names its two sides (`sides[0]` = First Player). Records keyed by side are `Partial<Record<Side, …>>`.
- The engine's map, counters, units and scenarios come from a **volume registry** (`engine/src/volumes.ts`): `useGame(id)` selects the data set the module-level helpers (`areas`, `connection`, `neighbors`…) read, like `setPlayArea` does. One page runs one game, so a current-game switch is enough; tests call it explicitly.
- Exclusive rules live in a **volume module** with hooks the series code calls (`Volume` in volumes.ts): movement reach and restrictions, combat Success Numbers and extra firing groups, asset assignment, morale, retreats, supply sources and path steps, victory, phase and battle hooks, arrivals, stacking, night. The Bulge's hooks are registered at the bottom of `game.ts`; Golan's module is `engine/src/vol/golan.ts` (set-ups, hooks, and the volume's own player actions: engineering, air missions, raids, events, Special Action uses, the alternate set-up), built on the pure helpers in `engine/src/golan/{map,move,combat}.ts`. It is exported as the `golan` namespace.
- Standing assets (garrisons, defended roadblocks, Golan commando raids and Lt. Zvika) are units with the `garrison` flag, as the series engine models 4.35; strongpoints and ghosts are units with the `fort` / `ghost` flags; a volume keeps its own state in `g.vol` and a battle's in `b.vol`.
- The interface reads side names, tags, colours, wood, map, labels, board art, piece art and features from `web/src/vol.ts` (`VOL`), chosen before the scene is built: `?game=` in the address, else the saved game of the table, else The Bulge. A shared table of another game reloads the page as that game. The volume's own counters and prompts are in `web/src/golan-ui.ts` (the same glowing-targets model as `chit-play.ts`). Bulge-only panels (fuel, army zones, optional rules, the 3D relief) show only when the volume has them. Online seats keep their database keys (`german` = First Player, `allied` = Second) and are mapped to the game's sides in `online.ts`.
- The home page lists every volume (`web/src/games.ts`: sides, tags, scenarios); a new game is created as the chosen volume and opened with its `game` parameter.

## Adding a volume

1. Data under `data/<id>/` (map, units, counters, set-ups, turn track) and a `VOLUMES.<id>` entry in `engine/src/volumes.ts`.
2. A module `engine/src/vol/<id>.ts` registering its hooks with `registerHooks`, exported from `engine/src/index.ts`; its tests are its acceptance suite.
3. Board art under `web/public/<id>/`, piece art in a `<id>-art.ts`, a `GameInfo` in `web/src/games.ts`, a `VolView` in `web/src/vol.ts` and, if it has counters or prompts of its own, a `<id>-ui.ts`.

## Open

- Sicily (Vol. 2) is still a shelf box only.
- The Golan map has no 3D relief; the Battle for Nafakh scenario, the optional rules 18.x and Al-Owda are not built.
- The interface's log and feed read the side from the log tag (`GE`/`AL`, `SY`/`IS`); a structured log would be cleaner.
