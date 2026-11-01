import type { Seats, Store, StateDoc, Account, Match } from './online';
import { initSplit, type Game, type Priv, type Reveals } from '../../engine/src';
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
  let split = false; try { const m = await fs.getDoc(fs.doc(db, 'tables', table, 'docs', 'meta')); const d = m.exists() ? (m.data() as { server?: boolean; split?: boolean }) : {}; split = d.split === true; } catch { /* no meta: an ordinary table */ }
  const seatName = () => (account.name || account.email || 'Player') + (account.admin ? ' (admin)' : '');
  return {
    get uid() { return account.uid; }, get canWrite() { return true; }, split,
    watchPriv: (next: (p: Priv | null) => void) => {
      let seats: Seats = {}, cur = '', stop: (() => void) | null = null;
      const mine = () => (seats.german === account.uid && account.uid ? 'german' : seats.allied === account.uid && account.uid ? 'allied' : '');
      const follow = () => { const v = mine(); if (v === cur) return; cur = v; stop?.(); stop = null; if (!v) return next(null); stop = fs.onSnapshot(fs.doc(db, 'tables', table, 'priv', v), (s) => next(s.exists() ? (s.data() as Priv) : null), () => next(null)); };
      fs.onSnapshot(seatsRef, (s) => { seats = s.exists() ? (s.data() as Seats) : {}; follow(); }); listeners.push(() => follow());
    },
    async setPriv(p: Priv) { const sd = (await fs.getDoc(seatsRef)).data() as Seats | undefined; const v = sd?.german === account.uid ? 'german' : sd?.allied === account.uid ? 'allied' : ''; if (v) await fs.setDoc(fs.doc(db, 'tables', table, 'priv', v), p); },
    watchReveals: (next: (r: Reveals) => void) => { fs.onSnapshot(fs.doc(db, 'tables', table, 'docs', 'reveals'), (s) => next(s.exists() ? (s.data() as Reveals) : {}), () => next({})); },
    async mergeReveals(r: Reveals) { await fs.setDoc(fs.doc(db, 'tables', table, 'docs', 'reveals'), r, { merge: true }); },
    account: () => account, onAccount: (f) => { listeners.push(f); },
    watchState: (next, err) => { fs.onSnapshot(stateRef, (s) => next(s.exists() ? (s.data() as StateDoc) : null), (e) => err(msg(e))); },
    // refuse a save made on top of an older game: if the stored rev is already as new as ours, the other player saved first
    setState: (d) => fs.runTransaction(db, async (tx) => { const cur = await tx.get(stateRef); if (cur.exists() && (cur.data() as StateDoc).rev >= d.rev) throw new Error('CONFLICT'); tx.set(stateRef, d); }),
    watchSeats: (next, err) => { fs.onSnapshot(seatsRef, (s) => next(s.exists() ? (s.data() as Seats) : {}), (e) => err(msg(e))); },
    async sit(side: Side | null) {
      if (account.guest) return 'Sign in to take a seat';
      const uid = account.uid;
      try {
        const r = await fs.runTransaction(db, async (tx) => {
          const snap = await tx.get(seatsRef), cur = (snap.exists() ? snap.data() : {}) as Seats, next: Seats = { german: cur.german ?? null, allied: cur.allied ?? null, germanName: cur.germanName ?? null, alliedName: cur.alliedName ?? null };
          if (next.german === uid) { next.german = null; next.germanName = null; } if (next.allied === uid) { next.allied = null; next.alliedName = null; }
          if (side) { if (next[side] && next[side] !== uid) return `The ${side} seat is taken`; next[side] = uid; next[side === 'german' ? 'germanName' : 'alliedName'] = seatName(); }
          tx.set(seatsRef, next); return '';
        });
        if (r === '' && side && table !== 'main') await fs.updateDoc(fs.doc(db, 'matches', table), { members: fs.arrayUnion(uid), [side + 'Name']: seatName() }).catch(() => undefined);
        return r;
      } catch (e) { return msg(e); }
    },
    async createMatch(m, side, stateJson) {
      if (account.guest) return '!Sign in to create a game';
      const id = Math.random().toString(36).slice(2, 8), uid = account.uid, name = seatName();
      try {
        await fs.setDoc(fs.doc(db, 'matches', id), { ...m, owner: uid, members: [uid], created: Date.now(), split: true, ...(side ? { [side + 'Name']: name } : {}) });
        const seats: Seats = { german: null, allied: null, germanName: null, alliedName: null }; if (side) { seats[side] = uid; seats[side === 'german' ? 'germanName' : 'alliedName'] = name; }
        await fs.setDoc(fs.doc(db, 'tables', id, 'docs', 'seats'), seats);
        await fs.setDoc(fs.doc(db, 'tables', id, 'docs', 'meta'), { split: true });
        const rnd = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2), sp = initSplit(JSON.parse(stateJson) as Game, rnd(), rnd());     // hidden blocks: each seat keeps its own details
        await fs.setDoc(fs.doc(db, 'tables', id, 'priv', 'german'), sp.german); await fs.setDoc(fs.doc(db, 'tables', id, 'priv', 'allied'), sp.allied);
        await fs.setDoc(fs.doc(db, 'tables', id, 'docs', 'state'), { rev: 1, json: sp.pub, by: uid });
        return id;
      } catch (e) { return '!' + msg(e); }
    },
    async deleteMatch(id) {
      try {
        for (const d of ['state', 'seats', 'meta', 'reveals']) await fs.deleteDoc(fs.doc(db, 'tables', id, 'docs', d)); for (const sd of ['german', 'allied']) await fs.deleteDoc(fs.doc(db, 'tables', id, 'priv', sd)).catch(() => undefined); await fs.deleteDoc(fs.doc(db, 'matches', id)); return ''; } catch (e) { return msg(e); }
    },
    async leaveMatch(id) {
      try { await fs.updateDoc(fs.doc(db, 'matches', id), { members: fs.arrayRemove(account.uid) }); return ''; } catch (e) { return msg(e); }
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
