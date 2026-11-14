# rules · 14 Nov 2026

Doing: nothing in hand; owner answered 16.23 (a lone US garrison counts as a defended roadblock: no extra US artillery); the game already did this, now covered by a test.
Next: the remaining 15 open rule questions (docs/AUDIT-2026-11.md section 5), one at a time.
Waiting for the owner: Sicily 16.32: rule 16.32 allows one air support asset per side in a battle, but Example 15 commits two to the flanking invasion. Which one is right?
Last checked: npm run verify: all passed after the fingerprint update, 13 Nov 21:00.
Files in hand: none
Notes: for the computer-opponent session: in the Admin Phase the engine now turns the phasing side's endPhase into "Done" (hand over) and the other side's setDone into the end of the phase, so the bot's current end() works unchanged. actorOf(g) in the Admin Phase is now one side (E.adminActor), 'both' only while a Sicily dogfight may answer an interdiction.
