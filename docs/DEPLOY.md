# Deploying: GitHub Pages and Firebase

The game is a static site (`web/`, built with Vite). Online play stores one table per id in Firestore; everything else runs in the browser.

## 1. Firebase (once)
1. Create a project at console.firebase.google.com. Add a **Web app** and copy its config.
2. **Build > Authentication > Sign-in method**: enable **Anonymous** (login with accounts comes later).
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
