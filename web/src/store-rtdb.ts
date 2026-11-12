import type { ChatMsg, Seats, Store, StateDoc, Account, Match } from './online';
import { gameInfo } from './games';
import { initSplit, rotateSalt, toTree, fromTree, diffTree, type Game, type Priv, type Reveals, type Side, type Tree } from '../../engine/src';
const msg = (e: unknown) => { const c = (e as { code?: string })?.code ?? ''; const m = String((e as { message?: string })?.message ?? e); return c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') ? 'Wrong email or password' : c.includes('email-already') ? 'That email already has an account, sign in instead' : c.includes('weak-password') ? 'The password needs at least 6 characters' : c.includes('popup-closed') ? 'Sign-in was cancelled' : c.includes('unauthorized-domain') ? 'This site is not in the Firebase authorized domains' : m; };

/** Firebase Realtime Database + Auth. Everything of one game is under `games/{id}`: meta, seats, the shared game (as many small values), each seat's private block details, the reveals.
 *  Visitors watch as anonymous guests; playing needs a Google or email account; admins are listed under `admins/{uid}`. */
export async function rtdbStore(table: string): Promise<Store | null> {
  const env = import.meta.env, apiKey = env.VITE_FIREBASE_API_KEY, projectId = env.VITE_FIREBASE_PROJECT_ID, databaseURL = env.VITE_FIREBASE_DATABASE_URL as string | undefined;
  if (!apiKey || !projectId || !databaseURL) return null;     // not configured: the site shows its home page without online play
  const [{ initializeApp }, A, rt] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/database')]);
  const app = initializeApp({ apiKey, projectId, databaseURL, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`, appId: env.VITE_FIREBASE_APP_ID, messagingSenderId: env.VITE_FIREBASE_SENDER_ID });
  const auth = A.getAuth(app), db = rt.getDatabase(app);
  if (env.DEV && env.VITE_FIREBASE_EMULATOR) { A.connectAuthEmulator(auth, `http://${env.VITE_FIREBASE_EMULATOR}:9099`, { disableWarnings: true }); rt.connectDatabaseEmulator(db, env.VITE_FIREBASE_EMULATOR, 9000); }   // development: the local Firebase emulators
  const  R = (p: string) => rt.ref(db, p), G = (p: string) => R(`games/${table}/${p}`);
  let account: Account = { uid: '', name: '', email: '', guest: true, admin: false };
  const listeners: ((a: Account) => void)[] = [];
  const read = async (u: import('firebase/auth').User): Promise<Account> => {
    let admin = false; try { admin = (await rt.get(R(`admins/${u.uid}`))).exists(); } catch { /* not an admin */ }
    return { uid: u.uid, name: u.displayName || u.email?.split('@')[0] || '', email: u.email ?? '', guest: u.isAnonymous, admin };
  };
  await new Promise<void>((ok, bad) => {
    let first = true;
    A.onAuthStateChanged(auth, async (u) => {
      if (!u) { if (first) A.signInAnonymously(auth).catch(bad); return; }
      account = await read(u); listeners.forEach((f) => f(account)); if (first) { first = false; ok(); }
    });
  });
  const seatName = () => (account.name || account.email || 'Player') + (account.admin ? ' (admin)' : '');
  /** Database keys may not contain . # $ / [ ] (a Task Force id has a dot), so keys are percent-encoded on the way in and decoded on the way out. */
  const ek = (k: string) => encodeURIComponent(k).replace(/\./g, '%2E'), dk = (k: string) => decodeURIComponent(k);
  /** The first to sit at a fresh seat changes its salt and writes the shared copy again with the new opaque ids, in one update (rotateSalt in the engine). */
  async function changeSalt(side: Side) {
    const p = (await rt.get(G(`priv/${side}`))).val() as { salt: string; secrets?: Record<string, string>; fresh?: boolean } | null;
    if (!p?.fresh) return;
    const [st, rv] = await Promise.all([rt.get(G('state')), rt.get(G('reveals'))]), t = st.val() as (Partial<Tree> & { rev?: number }) | null; if (!t?.f) return;
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => (b % 36).toString(36)).join('');
    const r = rotateSalt(JSON.stringify(fromTree(t)), { salt: p.salt, secrets: dec(p.secrets), fresh: true }, dec(rv.val()), salt); if (!r) return;
    const diff = diffTree(t as Tree, toTree(JSON.parse(r.pub) as Game)); delete diff['f/log'];
    await rt.update(R('/'), { ...Object.fromEntries(Object.entries(diff).map(([k, v]) => [`games/${table}/state/${k}`, v])), [`games/${table}/state/rev`]: rt.increment(1), [`games/${table}/state/by`]: account.uid, [`games/${table}/priv/${side}`]: { salt, secrets: enc(r.priv.secrets) } });
  }
  let stopMatches = () => undefined as void;
  const enc = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [ek(k), JSON.stringify(v)]));
  const dec = <T,>(o: Record<string, string> | null | undefined) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [dk(k), JSON.parse(v) as T]));
  const seatOf = (s: Seats): Side | '' => (account.uid && s.german === account.uid ? 'german' : account.uid && s.allied === account.uid ? 'allied' : '');
  /** The seats of this game, from the two nodes that hold them. */
  const watchSeatNodes = (next: (s: Seats) => void, err: (e: string) => void) => {
    let seats: Record<string, string> = {}, names: Record<string, string> = {};
    const emit = () => next({ german: seats.german ?? null, allied: seats.allied ?? null, germanName: names.german ?? null, alliedName: names.allied ?? null });
    rt.onValue(G('seats'), (s) => { seats = s.val() ?? {}; emit(); }, (e) => err(msg(e))); rt.onValue(G('seatNames'), (s) => { names = s.val() ?? {}; emit(); }, (e) => err(msg(e)));
  };
  let lastTree: Tree | null = null;
  return {
    get uid() { return account.uid; }, 
    account: () => account, onAccount: (f) => { listeners.push(f); },
    watchState: (next, err) => {
      rt.onValue(G('state'), (s) => {
        if (!s.exists()) { lastTree = null; next(null); return; }
        const v = s.val() as { rev?: number; by?: string; f?: Tree['f']; units?: Tree['units']; chits?: Tree['chits'] };
        lastTree = { f: v.f ?? {}, units: v.units ?? {}, chits: v.chits ?? {} };
        next({ rev: v.rev ?? 0, json: JSON.stringify(fromTree(lastTree)), by: v.by });
      }, (e) => err(msg(e)));
    },
    /** Write only what changed; the server counts the revision. */
    async setState(d: StateDoc) {
      const tree = toTree(JSON.parse(d.json) as Game), diff = diffTree(lastTree, tree); if (!Object.keys(diff).length) return;
      const logKey = 'f/log', mine = diff[logKey], before: string[] = lastTree?.f.log ? JSON.parse(lastTree.f.log) : [];
      delete diff[logKey];
      if (Object.keys(diff).length) await rt.update(G('state'), { ...diff, rev: rt.increment(1), by: account.uid });
      if (mine) {                                                                                       // both players may act at once: add our new lines to the log as it is now, never overwrite theirs
        const ours: string[] = JSON.parse(mine), last = before.at(-1), at = last == null ? -1 : ours.lastIndexOf(last), fresh = at >= 0 ? ours.slice(at + 1) : ours.slice(-20);
        await rt.runTransaction(G('state/f/log'), (cur: string | null) => { const now: string[] = cur ? JSON.parse(cur) : []; const add = fresh.filter((l) => !now.slice(-40).includes(l)); return add.length ? JSON.stringify([...now, ...add].slice(-400)) : undefined; });
      }
    },
    watchSeats: watchSeatNodes,
    watchPriv: (next: (p: Priv | null) => void) => {
      let seats: Seats = {}, cur = '', stop: (() => void) | null = null;
      const follow = () => { const v = seatOf(seats); if (v === cur) return; cur = v; stop?.(); stop = null; if (!v) return next(null); stop = rt.onValue(G(`priv/${v}`), (s) => { const p = s.val() as { salt: string; secrets?: Record<string, string> } | null; next(p ? { salt: p.salt, secrets: dec(p.secrets) } : null); }, () => next(null)); };
      watchSeatNodes((s) => { seats = s; follow(); }, () => next(null)); listeners.push(() => follow());
    },
    async setPriv(p: Priv) { const s = (await rt.get(G('seats'))).val() ?? {}, v = seatOf(s); if (v) await rt.set(G(`priv/${v}`), { salt: p.salt, secrets: enc(p.secrets) }); },
    watchReveals: (next: (r: Reveals) => void) => { rt.onValue(G('reveals'), (s) => next(dec(s.val())), () => next({})); },
    async mergeReveals(r: Reveals) { await rt.update(G('reveals'), enc(r)); },
    async dropReveals(keys: string[]) { await rt.update(G('reveals'), Object.fromEntries(keys.map((k) => [ek(k), null]))); },
    watchChat: (next) => { rt.onValue(rt.query(G('chat'), rt.limitToLast(100)), (s) => { const out: ChatMsg[] = []; s.forEach((c) => { const v = c.val(); out.push({ id: c.key!, uid: v.uid, side: v.side, name: v.name, text: String(v.text ?? ''), t: v.t }); }); next(out); }, () => next([])); },
    async addJournal(part, d) { await rt.push(G(`journal/${part}`), { at: rt.serverTimestamp(), d }); },
    async readJournal() { const s = await rt.get(G('journal')); return (s.val() ?? {}) as Record<string, Record<string, { at: number; d: string }>>; },
    async sendChat(side: Side, text: string) { try { await rt.push(G('chat'), { uid: account.uid, side, name: seatName().slice(0, 60), text, t: Date.now() }); return ''; } catch (e) { return msg(e); } },
    /** The table's creator made both salts and could decode this seat's opaque ids: the first to sit here makes a new one and writes the shared copy again with the new ids (rotateSalt). */
    async sit(side: Side | null) {
      if (account.guest) return 'Sign in to take a seat';
      const uid = account.uid;
      try {
        const cur = ((await rt.get(G('seats'))).val() ?? {}) as Record<string, string>;
        const mine = (['german', 'allied'] as Side[]).filter((x) => cur[x] === uid);
        for (const x of mine) await rt.remove(G(`seatNames/${x}`));                                      // names first: only the seat's owner may write it
        const r = await rt.runTransaction(G('seats'), (s: Record<string, string> | null) => {
          const n = { ...(s ?? {}) }; for (const x of ['german', 'allied']) if (n[x] === uid) delete n[x];
          if (side) { if (n[side] && n[side] !== uid) return undefined; n[side] = uid; }
          return Object.keys(n).length ? n : null;
        });
        if (!r.committed) return `The ${side} seat is taken`;
        if (side) {
          const meta = (await rt.get(G('meta'))).val() as { title?: string; game?: string; created?: number } | null;
          await rt.update(R('/'), { [`games/${table}/seatNames/${side}`]: seatName(), [`games/${table}/members/${uid}`]: true, [`users/${uid}/games/${table}`]: { title: meta?.title ?? table, game: meta?.game ?? 'bulge', created: meta?.created ?? Date.now() } });
          await changeSalt(side);
        }
        return '';
      } catch (e) { return msg(e); }
    },
    async freeSeat(side: Side) { try { await rt.update(G(''), { [`seats/${side}`]: null, [`seatNames/${side}`]: null }); return ''; } catch (e) { return msg(e); } },
    async createMatch(m, side, stateJson) {
      if (account.guest) return '!Sign in to create a game';
      const rnd = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => (b % 36).toString(36)).join(''), id = rnd(10), uid = account.uid, name = seatName(), P = (p: string) => `games/${id}/${p}`, created = Date.now();
      try {
        const sp = initSplit(JSON.parse(stateJson) as Game, rnd(24), rnd(24));                    // the salts hide the block ids: secure random, not Math.random     // hidden blocks: each seat keeps its own details
        await rt.update(R('/'), { [P('meta')]: { title: m.title, game: m.game, opts: m.opts, owner: uid, created, split: true }, [P(`members/${uid}`)]: true, ...(side ? { [P(`seats/${side}`)]: uid } : {}), [`users/${uid}/games/${id}`]: { title: m.title, game: m.game, created } });
        if (side) await rt.set(R(P(`seatNames/${side}`)), name);                                         // the seat has to exist before its name may be written
        await rt.set(R(P('priv/german')), { salt: sp.german.salt, secrets: enc(sp.german.secrets), fresh: true }); await rt.set(R(P('priv/allied')), { salt: sp.allied.salt, secrets: enc(sp.allied.secrets), fresh: true });
        const tree = toTree(JSON.parse(sp.pub) as Game); await rt.set(R(P('state')), { ...tree, rev: 1, by: uid });
        return id;
      } catch (e) { return '!' + msg(e); }
    },
    async deleteMatch(id) { try { await rt.remove(R(`games/${id}`)); await rt.remove(R(`users/${account.uid}/games/${id}`)); return ''; } catch (e) { return msg(e); } },
    async leaveMatch(id) { try { await rt.remove(R(`users/${account.uid}/games/${id}`)); await rt.remove(R(`games/${id}/members/${account.uid}`)); return ''; } catch (e) { return msg(e); } },
    /** The games on my list, each joined with its meta and seat names; a game that no longer exists drops off. */
    watchMyMatches: (next, err) => {
      stopMatches(); stopMatches = () => undefined;                                                     // the list of the account before (sign-out, another account) is no longer watched
      if (account.guest) { next([]); return; }
      type Row = { meta?: Record<string, unknown>; names?: Record<string, string>; seats?: Record<string, string>; f?: Record<string, string>; stop: () => void };
      const rows = new Map<string, Row>();
      /** Who must act, from a few top-level fields of the shared state (not the whole game): mirrors the engine's actorOf. */
      const move = (r: Row) => { const f = r.f, P = (k: string) => { try { return f?.[k] ? JSON.parse(f[k]) : null; } catch { return null; } }; if (!f) return {}; if (P('over')) return { over: true };
        const second = gameInfo(String(r.meta?.game ?? 'bulge'))?.sides[1] ?? 'allied', key = (x: string): Side => (x === second ? 'allied' : 'german');     // the state names the volume's sides; the seats keep the keys german/allied
        const phase = P('phase') as string, phasing = key(P('phasing') as string), b0 = P('battle') as { stage: string; attacker: string; defSA?: boolean; ready?: string[] } | null, b = b0 && { stage: b0.stage, attacker: key(b0.attacker), defSA: b0.defSA, ready: (b0.ready ?? []).map(key) }, oth = (x: Side): Side => (x === 'german' ? 'allied' : 'german');
        const actor = P('pendingBlow') ? 'both' : b ? (b.stage === 'setup' ? (b.defSA ? oth(b.attacker) : b.ready.length === 2 || !b.ready.includes(b.attacker) ? b.attacker : oth(b.attacker)) : ['defArty', 'defFire', 'defChoice', 'retreat'].includes(b.stage) ? oth(b.attacker) : b.attacker) : phase === 'admin' || phase === 'reinforcement' || phase === 'deploy' ? 'both' : phase === 'reaction' ? oth(phasing) : phasing;
        const mySides = (['german', 'allied'] as Side[]).filter((x) => r.seats?.[x] === account.uid), other = r.seats && Object.keys(r.seats).length === 2;
        return { myMove: !!other && mySides.length > 0 && (actor === 'both' || mySides.includes(actor as Side)), turn: Number(P('turn') ?? 0) || undefined, step: phase ?? undefined }; };
      const emit = () => next([...rows.entries()].filter(([, r]) => r.meta).map(([id, r]) => ({ id, game: String(r.meta!.game ?? 'bulge'), title: String(r.meta!.title ?? id), opts: (r.meta!.opts ?? { scenario: 'tournament', fuel: true }) as Match['opts'], owner: String(r.meta!.owner ?? ''), members: [], germanName: r.names?.german, alliedName: r.names?.allied, created: Number(r.meta!.created ?? 0), ...move(r) })).sort((a, b) => b.created - a.created));
      const stopList = rt.onValue(R(`users/${account.uid}/games`), (s) => {
        const ids = new Set(Object.keys(s.val() ?? {}));
        for (const [id, r] of rows) if (!ids.has(id)) { r.stop(); rows.delete(id); }
        for (const id of ids) if (!rows.has(id)) {
          const row: Row = { stop: () => undefined }; rows.set(id, row);
          const u1 = rt.onValue(R(`games/${id}/meta`), (m) => { if (!m.exists()) { void rt.remove(R(`users/${account.uid}/games/${id}`)); } row.meta = m.val() ?? undefined; emit(); }, () => undefined);
          const u2 = rt.onValue(R(`games/${id}/seatNames`), (n) => { row.names = n.val() ?? {}; emit(); }, () => undefined);
          const u3 = rt.onValue(R(`games/${id}/seats`), (n) => { row.seats = n.val() ?? {}; emit(); }, () => undefined);
          const fs: Record<string, string> = {}, u4 = ['phase', 'phasing', 'battle', 'pendingBlow', 'turn', 'over'].map((k) => rt.onValue(R(`games/${id}/state/f/${k}`), (n) => { const v = n.val(); if (v == null) delete fs[k]; else fs[k] = v; row.f = { ...fs }; emit(); }, () => undefined));
          row.stop = () => { u1(); u2(); u3(); u4.forEach((x) => x()); };
        }
        emit();
      }, (e) => err(msg(e)));
      stopMatches = () => { stopList(); for (const r of rows.values()) r.stop(); rows.clear(); };
    },
    async google() { try { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); return ''; } catch (e) { return msg(e); } },
    async emailSignIn(email, password) { try { await A.signInWithEmailAndPassword(auth, email, password); return ''; } catch (e) { return msg(e); } },
    async emailRegister(email, password, name) { try { const c = await A.createUserWithEmailAndPassword(auth, email, password); if (name) await A.updateProfile(c.user, { displayName: name }); account = await read(auth.currentUser!); listeners.forEach((f) => f(account)); return ''; } catch (e) { return msg(e); } },
    async idToken() { const u = auth.currentUser; return u && !u.isAnonymous ? u.getIdToken() : null; },
    async resetPassword(email) { try { await A.sendPasswordResetEmail(auth, email); return ''; } catch (e) { return msg(e); } },
    async signOut() { await A.signOut(auth); return ''; },
  };
}
