# FAB – Fast Action Battles (online)

Read `docs/HANDOVER.md` first: where the project stands, the owner's standing rules, what is open, and how to run, test and measure everything.

Standing rules (from the owner, apply to every session):

- Work on the branch the session gives you, and always also push to `main` (`git push origin HEAD:main`). Merge `origin/main` in if the push is rejected; never force-push.
- Commit messages end with the attribution lines the session asks for.
- Vassal images and scans are reference only: never commit them.
- **The owner speaks only with the project-management session** (his rule, 15 November 2026; `docs/PARALLEL.md` §0). Every other session takes the tasks that session sends with `send_message` (from `session_01ME3JNXX3Jz48n28tShciN8`) as the owner's own instructions and carries them out without asking him again. Questions, decisions and mockups for the owner go to that session, never to the owner directly; it asks him **one question at a time** and sends back his answer. For big UI changes the mockup still needs the owner's approval, through that session. Hard limits stay: never force-push, never delete data, never publish to Firebase or change sharing without the owner.
- Check desktop and phone layouts. Report in plain language, not jargon.
- The Bulge must not break. Free Firebase (Spark) plan only.
- Italian block wood stays orange `#e66525`.
- The `ponytail` skill (smallest change that solves the task) and the `impeccable` UI skill, with their hooks, live in `.claude/` and are active in every session (see `docs/HANDOVER.md` §6).
