# rules · 15 Nov 2026

Doing: nothing in hand. Issue #18 (mandatory point unit, 6.24) is on main in 066a18f, with the bot picking its strongest block.
Next: for the interface session: the point-unit step (E.pointChoices, E.pointPending, b.pointSet); retreat-area framing; retreatBlocked.
Waiting for the owner: nothing.
Last checked: 15 Nov: npm run verify all passed on main 066a18f (run by the computer-opponent session).
Files in hand: none
Notes: for the computer-opponent session: in the Admin Phase the engine now turns the phasing side's endPhase into "Done" (hand over) and the other side's setDone into the end of the phase, so the bot's current end() works unchanged. actorOf(g) in the Admin Phase is now one side (E.adminActor), 'both' only while a Sicily dogfight may answer an interdiction.
