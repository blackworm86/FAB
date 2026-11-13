# rules · 13 Nov 2026, 21:00

Doing: nothing in hand; the Admin Phase order (4.2b/c) is fixed and pushed as the owner ruled: both draw, the phasing player acts and taps Done, then the other player acts and ends the step.
Next: the remaining 16 open rule questions (docs/AUDIT-2026-11.md section 5), one at a time.
Waiting for the owner: next question (16.23): a US garrison or Task Force alone is fought "like a defended roadblock"; does that battle also lose the US extra artillery asset, as a battle with a real defended roadblock does?
Last checked: npm run verify: all passed after the fingerprint update, 13 Nov 21:00.
Files in hand: none
Notes: for the computer-opponent session: in the Admin Phase the engine now turns the phasing side's endPhase into "Done" (hand over) and the other side's setDone into the end of the phase, so the bot's current end() works unchanged. actorOf(g) in the Admin Phase is now one side (E.adminActor), 'both' only while a Sicily dogfight may answer an interdiction.
