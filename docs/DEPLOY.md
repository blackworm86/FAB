# Deploying: GitHub Pages and Firebase

The game is a static site (`web/`, built with Vite) on GitHub Pages. Firebase provides login (Authentication) and storage (Realtime Database). Everything else, including the rules engine, runs in the browser. Both are on Firebase's free Spark plan.

## 1. Firebase (once)
1. Create a project at console.firebase.google.com. Add a **Web app** and copy its config.
2. **Authentication > Sign-in method**: enable **Anonymous** (guests who only watch), **Google** (set the support email) and **Email/Password**.
3. **Authentication > Settings > Authorized domains**: add `<your-user>.github.io`.
4. **Build > Realtime Database**: create it (locked mode). Note its address, e.g. `https://<project>-default-rtdb.<region>.firebasedatabase.app` (the region is part of it unless the database is in the US).
5. Publish `database.rules.json` in **Realtime Database > Rules**. After a change to that file, use the site's **Admin > Update rules** page (home page for admins): it shows the rules, a copy button and a link to the editor.

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

Limits: the database rules stop a player reading the opponent's block details; they cannot check that a move was legal, so a modified browser could write a false game. The dice seed is part of the shared game, so a determined player could predict rolls. Log lines are cleaned of hidden names by text match.

## 6. Development
```bash
cd web && cp .env.example .env.local   # optional; without it only the development table works
npm ci && npm run dev
```
`?dev=1` opens a local table and shows a **Seat** button (Both, German, Allied, Watching). `?dev=1&fake=german` and `?dev=1&fake=allied` in two tabs of one browser play the two seats of a game kept in localStorage, with no Firebase.
