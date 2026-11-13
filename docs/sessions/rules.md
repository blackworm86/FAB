# rules · 13 Nov 2026, 19:10
Doing: nothing in hand; the asset and event sweep of all three volumes is finished and pushed (report: docs/AUDIT-2026-11.md section 5).
Next: the owner's answers to the 17 open rule questions (listed in the report), one at a time; then fix what each answer needs, as "Rule fix:" commits.
Waiting for the owner: "In the Admin Phase both players can now act in any order. The rules say the phasing player acts first. Should the game make the phasing player go first?" (4.2b/c)
Last checked: npm run verify after merging main: everything passed except formatting of engine/src/vol/bulge-setup.ts, which is the same on main (not from this session).
Files in hand: none
Notes: new tests engine/test/{bulge,sicily,golan}-sweep.test.ts. Each volume chooses its own explanation texts through VOL.ruleKey(kind, chit) and VOL.unitRule(unit); the texts are the 'bulge:', 'sicily:' and 'golan:' keys in rules-text.ts.
