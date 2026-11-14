# rules · 14 Nov 2026, night

Doing: nothing in hand. Sicily 15.3d fixed (untried units that survive the revealing round become tried even after leaving the area); 6.2/17.21: an Italian attack disordered at the reveal ends, and now says why.
Next: nothing open on the rules. For the interface session: frame and name the retreat areas when they are not next to the battle; say when Retreat would cost a step (retreatBlocked).
Waiting for the owner: nothing.
Last checked: npm run verify all passed after the Sicily fingerprint update, 14 Nov night.
Files in hand: none
Notes: for the computer-opponent session: in the Admin Phase the engine now turns the phasing side's endPhase into "Done" (hand over) and the other side's setDone into the end of the phase, so the bot's current end() works unchanged. actorOf(g) in the Admin Phase is now one side (E.adminActor), 'both' only while a Sicily dogfight may answer an interdiction.
