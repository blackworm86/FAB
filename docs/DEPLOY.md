# Deploying: GitHub Pages and Firebase

The game is a static site (`web/`, built with Vite). Online play stores one table per id in Firestore; everything else runs in the browser.

## 1. Firebase (once)
1. Create a project at console.firebase.google.com. Add a **Web app** and copy its config.
2. **Authentication > Sign-in method**: enable **Anonymous** (guests who only watch), **Google** (set the support email) and **Email/Password**.
3. **Authentication > Settings > Authorized domains**: add `<your-user>.github.io`.
4. **Build > Firestore Database**: create it (production mode), then publish the rules: `npx firebase-tools deploy --only firestore:rules` from the repository root (`firestore.rules`, `firebase.json`). Test them first with `npx firebase-tools emulators:start` (the rules have not been run against the emulator yet).

## 2. GitHub Pages
1. Repository **Settings > Pages > Source: GitHub Actions**.
2. **Settings > Secrets and variables > Actions > Variables**: add `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_SENDER_ID` (the web config values; they are not secrets, the rules protect the data).
3. Merge to `main`. `.github/workflows/pages.yml` runs the typecheck and tests, builds `web/` and publishes `web/dist`. The site is at `https://<your-user>.github.io/<repository>/` (the build uses relative paths, so a project site works).

## 3. Playing
- Open `.../?table=my-game` on two machines (any name; the default table is `main`). Each player takes a seat in the menu (☰). Anyone else watches.
- A player with no Firebase variables set (for example a local `npm run dev`) plays hot-seat.

## 4. Developer seat switch
Add `?dev=1` (or run `npm run dev`) to get the **Seat** button in the top bar. It cycles **Both, German, Allied, Watching**, enforces the turn rules for the seat you pick, and shows `YOU` in the header, so one machine can check two-player control and, later, what each side may see. With a Firebase table the state document is only writable by a seated user, so for dev use the emulator or run without Firebase variables.

## Local development
```bash
cd web && cp .env.example .env.local   # optional; leave empty for hot-seat
npm ci && npm run dev
```

## 5. Accounts and the admin user
- Visitors open the page as anonymous guests and can only watch. To take a seat they sign in from the menu (☰): **Continue with Google**, or an email and password (type a name and tap **Register**; **Forgot password** sends a reset mail).
- **Make an admin:** sign in on the site once, then in Firebase open **Authentication > Users** and copy your **User UID**. In **Firestore Database > Data** add a collection `admins` with a document whose ID is that UID (any field, for example `role: "admin"`). Reload the site: the menu shows "admin". Admins can write any table and free a seat; nobody can create admins from the site (the rules only allow it in the console).
- Publish the updated `firestore.rules` after every change to that file (Firestore > Rules).


## Refereed games (hidden blocks kept on the server), free

Ordinary tables keep the whole game in one document that both players' browsers read. A **refereed** table keeps it only on the server:

- `netlify/functions/referee.ts` is one Netlify function (free tier, no card) that runs the same rules engine. It uses a Firebase service account, which works on the free Spark plan.
- The full game is in Firestore `tables/{id}/private/full`, which no client can read (rules deny it; the service account bypasses them). Each seat reads `tables/{id}/views/german` or `.../allied`, a copy with the other side's hidden blocks stripped of identity, strength and quality (ids are replaced by opaque ones) and without the dice seed.
- A player's browser never changes the game. It records the engine calls the player's action makes and POSTs them, with its Firebase login token, to the referee, which checks the seat and the turn, replays them and writes the new views. Operations: `createTable`, `act`, `restartTable`, `deleteTable`.

To switch it on: (1) Firebase console, Project settings, Service accounts, Generate new private key; (2) on netlify.com sign in with GitHub, Add new site, Import from GitHub, pick this repository (the settings come from `netlify.toml`), and add the environment variable `FIREBASE_SERVICE_ACCOUNT` with the whole JSON of that key; (3) set the repository variable `VITE_REFEREE_URL` to the Netlify site address and re-run the `deploy` workflow; (4) publish the rules again (Admin, Update rules). Games created before that stay ordinary tables.

Limits: the server checks that the seat owns the piece and that it is that seat's turn or step; beyond that it relies on what the engine itself throws on. The log is scrubbed of hidden block names by string match. Netlify's free tier allows 125,000 function calls a month. `?fake=german` / `?fake=allied` (development only) runs the same server code inside the browser so two tabs can try a refereed game without deploying anything.
