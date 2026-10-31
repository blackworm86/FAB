import type { Seats, Store, StateDoc, Account, Match } from './online';
import type { Side } from '../../engine/src';
const msg = (e: unknown) => { const c = (e as { code?: string })?.code ?? ''; const m = String((e as { message?: string })?.message ?? e); return c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') ? 'Wrong email or password' : c.includes('email-already') ? 'That email already has an account, sign in instead' : c.includes('weak-password') ? 'The password needs at least 6 characters' : c.includes('popup-closed') ? 'Sign-in was cancelled' : c.includes('unauthorized-domain') ? 'This site is not in the Firebase authorized domains' : m; };

/** Firebase (Firestore + Auth), used when VITE_FIREBASE_* is configured. Visitors watch as anonymous guests; playing needs a Google or email account; admins are listed in the `admins` collection. */
export async function firebaseStore(table: string): Promise<Store | null> {
  const env = import.meta.env, apiKey = env.VITE_FIREBASE_API_KEY, projectId = env.VITE_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) return null;
  const [{ initializeApp }, A, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
  const app = initializeApp({ apiKey, projectId, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`, appId: env.VITE_FIREBASE_APP_ID, messagingSenderId: env.VITE_FIREBASE_SENDER_ID });
  const auth = A.getAuth(app), db = fs.getFirestore(app);
  const stateRef = fs.doc(db, 'tables', table, 'docs', 'state'), seatsRef = fs.doc(db, 'tables', table, 'docs', 'seats');
  let account: Account = { uid: '', name: '', email: '', guest: true, admin: false };
  const listeners: ((a: Account) => void)[] = []; let unsubM: (() => void) | null = null;
  const read = async (u: import('firebase/auth').User): Promise<Account> => {
    let admin = false; try { admin = (await fs.getDoc(fs.doc(db, 'admins', u.uid))).exists(); } catch { /* not an admin */ }
    return { uid: u.uid, name: u.displayName || u.email?.split('@')[0] || '', email: u.email ?? '', guest: u.isAnonymous, admin };
  };
  await new Promise<void>((ok, bad) => {
    let first = true;
    A.onAuthStateChanged(auth, async (u) => {
      if (!u) { if (first) A.signInAnonymously(auth).catch(bad); return; }
      account = await read(u); listeners.forEach((f) => f(account)); if (first) { first = false; ok(); }
    });
  });
  const seatName = (s: Side) => (account.name || account.email || 'Player') + (account.admin ? ' (admin)' : '');
  return {
    get uid() { return account.uid; }, get canWrite() { return true; },
    account: () => account, onAccount: (f) => { listeners.push(f); },
    watchState: (next, err) => { fs.onSnapshot(stateRef, (s) => next(s.exists() ? (s.data() as StateDoc) : null), (e) => err(msg(e))); },
    setState: (d) => fs.setDoc(stateRef, d),
    watchSeats: (next, err) => { fs.onSnapshot(seatsRef, (s) => next(s.exists() ? (s.data() as Seats) : {}), (e) => err(msg(e))); },
    async sit(side: Side | null) {
      if (account.guest) return 'Sign in to take a seat';
      const uid = account.uid;
      try {
        const r = await fs.runTransaction(db, async (tx) => {
          const snap = await tx.get(seatsRef), cur = (snap.exists() ? snap.data() : {}) as Seats, next: Seats = { german: cur.german ?? null, allied: cur.allied ?? null, germanName: cur.germanName ?? null, alliedName: cur.alliedName ?? null };
          if (next.german === uid) { next.german = null; next.germanName = null; } if (next.allied === uid) { next.allied = null; next.alliedName = null; }
          if (side) { if (next[side] && next[side] !== uid) return `The ${side} seat is taken`; next[side] = uid; next[side === 'german' ? 'germanName' : 'alliedName'] = seatName(side); }
          tx.set(seatsRef, next); return '';
        });
        if (r === '' && side && table !== 'main') await fs.updateDoc(fs.doc(db, 'matches', table), { members: fs.arrayUnion(uid), [side + 'Name']: seatName(side) }).catch(() => undefined);
        return r;
      } catch (e) { return msg(e); }
    },
    async createMatch(m, side, stateJson) {
      if (account.guest) return '!Sign in to create a game';
      const id = Math.random().toString(36).slice(2, 8), uid = account.uid, name = seatName(side ?? 'german');
      try {
        await fs.setDoc(fs.doc(db, 'matches', id), { ...m, owner: uid, members: [uid], created: Date.now(), ...(side ? { [side + 'Name']: name } : {}) });
        const seats: Seats = { german: null, allied: null, germanName: null, alliedName: null }; if (side) { seats[side] = uid; seats[side === 'german' ? 'germanName' : 'alliedName'] = name; }
        await fs.setDoc(fs.doc(db, 'tables', id, 'docs', 'seats'), seats);
        await fs.setDoc(fs.doc(db, 'tables', id, 'docs', 'state'), { rev: 1, json: stateJson, by: uid });
        return id;
      } catch (e) { return '!' + msg(e); }
    },
    watchMyMatches: (next, err) => {
      unsubM?.(); unsubM = null;
      const go = () => { if (account.guest) return next([]); unsubM = fs.onSnapshot(fs.query(fs.collection(db, 'matches'), fs.where('members', 'array-contains', account.uid)), (q) => next(q.docs.map((d) => ({ id: d.id, ...d.data() }) as Match).sort((a, b) => b.created - a.created)), (e) => err(msg(e))); };
      go();
    },
    async freeSeat(side: Side) { try { await fs.setDoc(seatsRef, { ...( (await fs.getDoc(seatsRef)).data() ?? {}), [side]: null, [side === 'german' ? 'germanName' : 'alliedName']: null }); return ''; } catch (e) { return msg(e); } },
    async google() { try { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); return ''; } catch (e) { return msg(e); } },
    async emailSignIn(email, password) { try { await A.signInWithEmailAndPassword(auth, email, password); return ''; } catch (e) { return msg(e); } },
    async emailRegister(email, password, name) { try { const c = await A.createUserWithEmailAndPassword(auth, email, password); if (name) await A.updateProfile(c.user, { displayName: name }); account = await read(auth.currentUser!); listeners.forEach((f) => f(account)); return ''; } catch (e) { return msg(e); } },
    async resetPassword(email) { try { await A.sendPasswordResetEmail(auth, email); return ''; } catch (e) { return msg(e); } },
    async signOut() { await A.signOut(auth); return ''; },
  };
}
