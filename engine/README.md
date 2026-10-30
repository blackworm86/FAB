# FAB rules engine

Pure TypeScript, no UI. Loads `data/bulge/map.json`. Run `npm install && npm test` in this folder.

Implemented so far:
- `dice.ts` – seeded d10, success rule (1 always hits, 10 always misses), hit probability.
- `combat.ts` – Success Number with an explained list of modifiers; hit distribution for any mix of dice (the attack success % calculator).
- `movement.ts` – reachable areas with cheapest cost and path (movement aid): road/field/restricted costs, occupied +1, leaving a contested area, minimum move, stop in enemy areas and roadblocks, blown bridges, German army-boundary +2 and fuel need, disordered/unsupplied one area.

Tests reproduce the play-book examples (movement 23.3, combat 23.5–23.7).
Combat modifiers are rebuilt from those examples because the Player-Aid card is missing; they are the main thing to confirm.
