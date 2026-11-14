# rules · 14 Nov 2026, afternoon

Doing: nothing in hand. The 14 Nov playtest rule questions are answered in docs/AUDIT-2026-11.md section 5 (all six match the rules; display of SN below 1 fixed; Defender Special Action after a jam refused).
Next: the open owner questions (AUDIT section 5, plus four from the referee on 17.33), one at a time.
Waiting for the owner: Sicily 16.32: rule 16.32 allows one air support asset per side in a battle, but Example 15 commits two to the flanking invasion. Which one is right?
Last checked: npm run verify: all passed after merging main, 14 Nov.
Files in hand: none
Notes: for the computer-opponent session: in the Admin Phase the engine now turns the phasing side's endPhase into "Done" (hand over) and the other side's setDone into the end of the phase, so the bot's current end() works unchanged. actorOf(g) in the Admin Phase is now one side (E.adminActor), 'both' only while a Sicily dogfight may answer an interdiction.
