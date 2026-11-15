# rules · 15 Nov 2026

Doing: issue #18 (mandatory point unit, 6.24) done in 0760fc0 on the branch; waiting for the computer opponent to pick a point unit (one line in bot/src/doctrine.ts, asked through PM) before it goes to main.
Next: merge to main once the bot line and the new Bulge fingerprint are on main. For the interface session: point-unit picker (E.pointChoices, E.pointPending, b.pointSet); retreat-area framing; retreatBlocked.
Waiting for the owner: nothing.
Last checked: 15 Nov: engine 457 tests and table tests pass; bot tests and the Bulge fingerprint fail until the doctrine line lands.
Files in hand: none
Notes: for the computer-opponent session: in the Admin Phase the engine now turns the phasing side's endPhase into "Done" (hand over) and the other side's setDone into the end of the phase, so the bot's current end() works unchanged. actorOf(g) in the Admin Phase is now one side (E.adminActor), 'both' only while a Sicily dogfight may answer an interdiction.
