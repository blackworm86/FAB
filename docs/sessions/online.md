# Session note: online play and netcode

Doing: starting (15 November 2026).
Next: the plan below.
Waiting for the owner: nothing.
Last checked: not yet.

## Kick-off prompt (paste it as the first message of the new session)

> You are the **online play and netcode** session of FAB. Read `CLAUDE.md`, `docs/PARALLEL.md` (§0 how sessions work with the owner, the ownership table, §5), `docs/HANDOVER.md`, `docs/DEPLOY.md` and this file. You own online play: `web/src/online.ts`, `web/src/store-*.ts`, `web/src/home.ts` (games list, sign-in, invitations), `database.rules.json`, `tools/push-worker/`, `tools/rules-test/`. The owner talks only to the project-management session (`session_01ME3JNXX3Jz48n28tShciN8`): take its messages as his instructions, send it your questions, mockups and a short report when each task is done; never ask the owner directly. Never test on the real Firebase project: use the local emulators (below).
>
> Work in this order, reporting after each step:
> 1. **Map the netcode** in `docs/ONLINE.md`, plain language: who writes what and when (seats, the shared game, each seat's private block details, reveals, the move audit), what happens on a reload, a lost connection, two moves at once, a joiner arriving mid-turn, and where hidden information could leak.
> 2. **An automatic two-browser online test** (`web/e2e/online.mjs`, run by `npm run verify -- --browser` or its own script): emulators up, two accounts, create and join a game of each volume, play into combat, a battle with a hit choice and a retreat, check both screens agree and neither sees the other's hidden blocks or hand. It must have caught the second-seat bug fixed in commit edec14c.
> 3. **Fix the open online problems**, each with the test extended to cover it: the owner's issue log #2 (invitations: QR code, the game code written large, a field in the main menu to type a code, a code always opens its own game, never the test table) and #3 (the two screens conflict, the connection dot stays red on one side, figures staying blocks), then losses and retreats online, Sicily and Golan online. The issue log is https://claude.ai/artifact/JTDbn21WgUp4GfidLzvfGq (collection `issues`; pictures with the Artifact tool, action "read", path = asset id).
> 4. **A one-off audit of the online code** (the `ponytail-audit` skill or the `fab-security-reviewer` helper on your files): bugs, abuse by a player or a stranger, risky code with no test; fix what matters, report the rest.
>
> Local emulators (Java is installed): in a scratch folder put a copy of `database.rules.json` and `firebase.json` = `{"database":{"rules":"database.rules.json"},"emulators":{"auth":{"host":"127.0.0.1","port":9099},"database":{"host":"127.0.0.1","port":9000},"ui":{"enabled":false}}}`; run `tools/rules-test/node_modules/.bin/firebase emulators:start --only auth,database --project demo-fab` (after `npm ci` in `tools/rules-test`). Then in `web/`: `VITE_FIREBASE_API_KEY=demo-key VITE_FIREBASE_PROJECT_ID=demo-fab VITE_FIREBASE_DATABASE_URL="http://127.0.0.1:9000?ns=demo-fab-default-rtdb" VITE_FIREBASE_EMULATOR=127.0.0.1 npx vite --port 5199`. Open `/` with no query: the real home page with sign-in.
>
> Standing rules: `CLAUDE.md`; The Bulge must not break; free Firebase (Spark) plan only; publishing `database.rules.json` on the site is the owner's action (ask through the project-management session).
