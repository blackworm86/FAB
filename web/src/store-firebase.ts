import type { Seats, Store, StateDoc } from './online';
import type { Side } from '../../engine/src';
const msg = (e: unknown) => String((e as { message?: string })?.message ?? e);

/** Firebase (Firestore + anonymous sign-in), used when VITE_FIREBASE_* is configured. The SDK is loaded on demand. */
export async function firebaseStore(table: string): Promise<Store | null> {
  const env = import.meta.env, apiKey = env.VITE_FIREBASE_API_KEY, projectId = env.VITE_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) return null;
  const [{ initializeApp }, { getAuth, signInAnonymously, onAuthStateChanged }, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
  const app = initializeApp({ apiKey, projectId, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`, appId: env.VITE_FIREBASE_APP_ID, messagingSenderId: env.VITE_FIREBASE_SENDER_ID });
  const auth = getAuth(app), db = fs.getFirestore(app);
  const uid = await new Promise<string>((ok, bad) => { const off = onAuthStateChanged(auth, (u) => { if (u) { off(); ok(u.uid); } }); signInAnonymously(auth).catch(bad); });
  const stateRef = fs.doc(db, 'tables', table, 'docs', 'state'), seatsRef = fs.doc(db, 'tables', table, 'docs', 'seats');
  return {
    uid, canWrite: true,
    watchState: (next, err) => { fs.onSnapshot(stateRef, (s) => next(s.exists() ? (s.data() as StateDoc) : null), (e) => err(msg(e))); },
    setState: (d) => fs.setDoc(stateRef, d),
    watchSeats: (next, err) => { fs.onSnapshot(seatsRef, (s) => next(s.exists() ? (s.data() as Seats) : {}), (e) => err(msg(e))); },
    async sit(side: Side | null) {
      try {
        return await fs.runTransaction(db, async (tx) => {
          const snap = await tx.get(seatsRef), cur = (snap.exists() ? snap.data() : {}) as Seats, next: Seats = { german: cur.german ?? null, allied: cur.allied ?? null };
          if (next.german === uid) next.german = null; if (next.allied === uid) next.allied = null;
          if (side) { if (next[side] && next[side] !== uid) return `The ${side} seat is taken`; next[side] = uid; }
          tx.set(seatsRef, next); return '';
        });
      } catch (e) { return msg(e); }
    },
  };
}
