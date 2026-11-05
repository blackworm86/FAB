# FAB rules engine

Pure TypeScript, no UI. Loads `data/bulge/map.json`. Run `npm install && npm test` in this folder.

Implemented so far:
- `dice.ts` – seeded d10, success rule (1 always hits, 10 always misses), hit probability.
- `combat.ts` – Success Number with an explained list of modifiers; hit distribution for any mix of dice (the attack success % calculator).
- `movement.ts` – reachable areas with cheapest cost and path (movement aid): road/field/restricted costs, occupied +1, leaving a contested area, minimum move, stop in enemy areas and roadblocks, blown bridges, German army-boundary +2 and fuel need, disordered/unsupplied one area.

Tests reproduce the play-book examples (movement 23.3, combat 23.5–23.7).
Combat modifiers are rebuilt from those examples because the Player-Aid card is missing; they are the main thing to confirm.

## FAB: Golan '73 (`src/golan/`)

A separate engine for Golan '73, built on the same series rules but independent of The Bulge code above (sides `israeli`/`syrian`). Loads `data/golan73/` (map read from the hand-drawn SVG, units, counters, set-ups, `turn_track.json`).

- `map.ts` – areas, connections and their boundary types (14.1), Assembly areas A/B as areas 101/102, Mt Hermon's link to 59, which side of the Purple Line each area is on.
- `move.ts` – operational movement (5.2–5.35, 14.02 minefields, 14.03 night, 14.11–14.14 escarpment / AT ditch / wadi / rugged, 14.16, 14.22, 14.41–14.43, 16.11 raids, 16.31b interdiction); `pathCost` prices a chosen route; strat-moves (5.4, 14.8).
- `combat.ts` – Success Numbers from the Combat Play Aid (strongpoints, assaults, close air support, night, rocket artillery, TQ matrix), brigade integrity, asset limits, SAM table, morale.
- `game.ts` – Operation Badr set-up (22.1, errata applied), turn sequence, Reinforcement and Admin draws from the Turn Track, control, supply (9.31, 14.9), victory points, sudden death and the Syrian automatic victory (19.0).

Tests (`test/golan-*.test.ts`) reproduce the Play Book examples (`docs/games/golan73/rules/playbook-examples.md`). Still to come: the combat round procedure (hits, retreats, exploitation), events and engineering, the alternate and Nafakh set-ups, then the web app.
