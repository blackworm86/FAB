# computer-opponent · 14 November 2026, 14:35

Doing: nothing: on hold by the owner's decision of 14 November (docs/STATUS.md): he played the computer and finds it not good; work resumes only when he says so in this session, after the game's own problems are fixed.
Next: German strategic moves are still rare (the reserve rule marks too few blocks); the look-ahead overrides the doctrine on differences inside the noise (tighten its guard, then measure); then stage 6 (levels by deliberate mistakes: more thinking time was measured useless).
Waiting for the owner: his word to resume work on the computer opponent.
Last checked: npm run verify: all passed, 13 Nov 19:35 (fingerprint unchanged); browser run of ?lab=german, the computer played all of turn 1 and German turn 2 to movement (stopped only on the Allied bridge-blowing choice, which is the human's).
Files in hand: none.
Notes: every bot change is kept only with an arena measurement beyond its margin (bot/scripts/arena.ts; players by name in bot/src/players.ts, older versions kept there). Measured and removed: rotation of worn blocks (harmful twice). The judge (bot/src/judge-bulge-tournament.json) is the round 1 fit; rounds 2 and 3 did not help and were not kept. Against the computer the table must never wait on a button the human cannot see: its dice are marked remote (move on by themselves), the human's own roll can always be cleared (flow.ts ownRollShown), a recovery and the artillery attrition do not wait for each other (bot/src/actions.ts actors).
