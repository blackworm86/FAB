# rules · 14 Nov 2026, night

Doing: nothing in hand. Issue #12 (Sicily 15.3a) fixed: a second untried garrison gets no moves, field works or reserve once one acted.
Next: nothing open on the rules. For the interface session: frame and name the retreat areas when they are not next to the battle; say when Retreat would cost a step (retreatBlocked).
Waiting for the owner: nothing.
Last checked: npm run verify all passed, 15 Nov (root Prettier 3.3.3 installed: use it, not npx latest).
Files in hand: none
Notes: for the computer-opponent session: in the Admin Phase the engine now turns the phasing side's endPhase into "Done" (hand over) and the other side's setDone into the end of the phase, so the bot's current end() works unchanged. actorOf(g) in the Admin Phase is now one side (E.adminActor), 'both' only while a Sicily dogfight may answer an interdiction.
