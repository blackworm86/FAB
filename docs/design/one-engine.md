# One engine, one interface, three volumes

Goal (user, 2026-11-05): the games share one base interface and one base rules engine, so the interface and the series rules are maintained once; each volume plugs in its map, pieces, scenarios and exclusive rules.

Today: `engine/src/*.ts` is the series engine written around The Bulge (sides `german`/`allied`, fuel, army zones, Greif, Peiper…), `engine/src/golan/*` is a second, separate engine, and `web/src/golan-play.ts` a second, simpler interface. This is the plan to fold them together without breaking the live Bulge game.

## Shape

- `Side` is a string; a game names its two sides (`sides[0]` = First Player). Records keyed by side are `Partial<Record<Side, …>>`.
- The engine's map, counters, units and scenarios come from a **volume registry** (`engine/src/volumes.ts`): `useGame(id)` selects the data set the module-level helpers (`areas`, `connection`, `neighbors`…) read, like `setPlayArea` does today. One page runs one game, so a current-game switch is enough; tests call it explicitly.
- Exclusive rules live in a **volume module** with hooks the series code calls: movement step cost and restrictions by boundary type, combat SN extras, set-up, event kinds and their play functions, supply sources, victory, phase hooks, unit art. The Bulge module is what the engine does today, moved behind the hooks; the Golan module reuses `engine/src/golan/{move,combat,events}.ts`.
- Standing assets (garrisons, defended roadblocks, Golan commando raids and Lt. Zvika) are units with the `garrison` flag, as the series engine already models 4.35.
- The interface (`web/src/main.ts`) reads side names, colours, wood, map, labels, board art and features from the volume; Bulge-only panels (fuel, army zones, Greif, Peiper) are shown only when the volume has them. Online seats keep their database keys (`german`/`allied`, the first and second seat) and are mapped to the game's sides.

## Increments (each keeps every test green)

1. Engine: sides and map per game, `g.game`, `g.sides`, volume registry. No behaviour change.
2. Engine: Bulge exclusive rules behind the module hooks. No behaviour change.
3. Engine: Golan module on the series engine; the Golan tests become its acceptance suite; the separate Golan game/battle code goes.
4. Interface: `main.ts` reads the volume; Golan gets the full New game flow on the home page; `golan.html` goes.
5. Both games checked on desktop and phone; publish.
