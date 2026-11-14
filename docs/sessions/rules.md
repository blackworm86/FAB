# rules · 14 Nov 2026, evening

Doing: nothing in hand. Sicily Air Supply panel checked in the browser (desktop and phone): two missions, one area each, and a dogfight per mission all work.
Next: nothing open on the rules. For the interface session: frame and name the retreat areas when they are not next to the battle; say when Retreat would cost a step (retreatBlocked).
Waiting for the owner: nothing.
Last checked: browser check of the Sicily Air Supply panel, 14 Nov evening; npm run verify all passed at 16:20.
Files in hand: none
Notes: for the computer-opponent session: in the Admin Phase the engine now turns the phasing side's endPhase into "Done" (hand over) and the other side's setDone into the end of the phase, so the bot's current end() works unchanged. actorOf(g) in the Admin Phase is now one side (E.adminActor), 'both' only while a Sicily dogfight may answer an interdiction.
