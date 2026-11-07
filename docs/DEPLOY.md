# Deploying: GitHub Pages and Firebase

The game is a static site (`web/`, built with Vite) on GitHub Pages. Firebase provides login (Authentication) and storage (Realtime Database). Everything else, including the rules engine, runs in the browser. Both are on Firebase's free Spark plan.

## 1. Firebase (once)
1. Create a project at console.firebase.google.com. Add a **Web app** and copy its config.
2. **Authentication > Sign-in method**: enable **Anonymous** (guests who only watch), **Google** (set the support email) and **Email/Password**.
3. **Authentication > Settings > Authorized domains**: add `<your-user>.github.io`.
4. **Build > Realtime Database**: create it (locked mode). Note its address, e.g. `https://<project>-default-rtdb.<region>.firebasedatabase.app` (the region is part of it unless the database is in the US).
5. Publish `database.rules.json` (and publish it again after every change; test it first with `cd tools/rules-test && npm i && npm test`, which needs Java) in **Realtime Database > Rules**. After a change to that file, use the site's **Admin > Update rules** page (home page for admins): it shows the rules, a copy button and a link to the editor.

## 2. GitHub Pages
1. Repository **Settings > Pages > Source: GitHub Actions**.
2. **Settings > Secrets and variables > Actions > Variables**: add `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_SENDER_ID` and `VITE_FIREBASE_DATABASE_URL` (the web config values and the database address; they are not secrets, the rules protect the data).
3. Merge to `main`. `.github/workflows/pages.yml` runs the typechecks and tests, builds `web/` and publishes `web/dist`. The site is at `https://<your-user>.github.io/<repository>/`.

## 3. Accounts and the admin user
- Visitors are anonymous guests and can only watch. To play they sign in on the home page with Google, or email and password.
- **Make an admin:** sign in once, then in Firebase open **Authentication > Users** and copy your **User UID**. In **Realtime Database > Data** add `admins/<your UID>` with the value `true`. The home page then shows an **Admin** card; a game's Menu shows an **Admin** tab.

## 4. Playing
Home page: sign in, **New game** (choose your seat), invite a player with the share button or link (`?table=<id>`), the opponent opens it and takes the free seat.

## 5. How a game is stored
Everything of one game is under `games/<id>`:
- `meta`: title, scenario, creator. `members`, `seats`, `seatNames`.
- `state`: the shared game as many small values (`f/<field>`, `units/<n>`, `chits/<n>`) plus a revision. A move writes only what changed, so two players changing different things never overwrite each other.
- `priv/german`, `priv/allied`: the real details of that side's blocks. Only the player in that seat can read them.
- `reveals`: details of blocks the other side may see (a battle area once both pressed Ready, an Intelligence Gathering target).
- `users/<uid>/games/<id>`: each player's list of games.

In the shared game, every block nobody may see (6.24) is a placeholder with an opaque id and no name, strength or quality. Each browser puts its own details back, runs the rules on its own copy and writes the changes.

Security: `database.rules.json` lets a player take a free seat only for themself, never both sides, never someone else's seat; only the two seated players write the game (each write is signed with the writer's id); each seat alone reads its own block details. Each browser checks the other's moves ("Rules check": the game went back in time, dice changed, or the wrong side wrote). A change that fails is held back: the board keeps the last legal position, and the player chooses to restore it for both (marked as a restore, so the other browser does not take it for going back in time) or to accept the change. Online dice come from a secure random source. See `docs/ARCHITECTURE.md` §3–§5. A modified browser can still write a false game: only a server could stop it (roadmap, §9).

## 6. Development
```bash
cd web && cp .env.example .env.local   # optional; without it only the development table works
npm ci && npm run dev
```
`?dev=1` opens a local table and shows a **Seat** button (Both, German, Allied, Watching). `?dev=1&fake=german` and `?dev=1&fake=allied` in two tabs of one browser play the two seats of a game kept in localStorage, with no Firebase.

## 7. "Your move" notices with the app closed (optional, free)
Without this, players who switch notices on (Menu > Settings > Notices, or the Account panel) are told when it is their move while a game or the home page is open somewhere (another tab, the app minimised). With it, the notice also arrives when the app is closed. It uses a tiny relay on Cloudflare's free plan (`tools/push-worker/`), which keeps each player's push address and sends an empty push; no game data goes through it. On iPhone and iPad, notices work only in the installed app (Share > Add to Home Screen, iOS 16.4 or later).

Once, on your computer, from the repository folder:
1. Make a free account at dash.cloudflare.com.
2. `cd tools/push-worker` and `npx wrangler login` (a browser window asks you to allow it).
3. `npx wrangler kv namespace create SUBS`. It prints an `id`: paste it into `wrangler.toml` in place of `PASTE-THE-KV-NAMESPACE-ID`.
4. `node keys.mjs`. It prints a **public key** and a **private key**. Keep this window open.
5. In `wrangler.toml` fill in `FIREBASE_PROJECT` (the Firebase project id), `DATABASE_URL` (the same address as `VITE_FIREBASE_DATABASE_URL`), `ALLOWED_ORIGIN` (the site's origin, e.g. `https://<your-user>.github.io`, no path), `VAPID_SUBJECT` (`mailto:` and your email) and `VAPID_PUBLIC` (the public key).
6. `npx wrangler secret put VAPID_PRIVATE_JWK` and paste the private key when asked. Never commit it.
7. `npx wrangler deploy`. It prints the relay's address, e.g. `https://fab-push.<you>.workers.dev`.
8. On GitHub, **Settings > Secrets and variables > Actions > Variables**: add `VITE_PUSH_URL` (the relay's address) and `VITE_VAPID_PUBLIC` (the public key). Run the Pages workflow again (or push to `main`).
9. Players switch notices off and on once (Menu > Settings > Notices) so their device registers with the relay; the message then says "even with the app closed".

What it costs: nothing on the free plan for a group of friends (Workers: 100,000 requests a day; KV: 1,000 writes a day, one per move that hands over the turn, at most one per game a minute). Security: every request carries the player's Firebase sign-in, checked against Google's keys; the relay reads the table's seats as that player and only ever notifies the opponent seated at the same table. Its tests run in CI (`node --test tools/push-worker/worker.test.mjs`).
