/** The referee. Every move goes through here: the full game lives only in `tables/{id}/private/full` (no client can read it),
 *  each seat gets its own redacted view in `tables/{id}/views/{german|allied|public}`. */
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore, type DocumentReference } from 'firebase-admin/firestore';
import { processAction, viewsOf, startFull, type Call, type Opts, type Side } from '../../engine/src';

initializeApp();
const db: Firestore = getFirestore();
const randomId = (n: number) => Array.from({ length: n }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');
const need = (r: CallableRequest) => {
  const a = r.auth; if (!a) throw new HttpsError('unauthenticated', 'Sign in first');
  if (a.token.firebase.sign_in_provider === 'anonymous') throw new HttpsError('permission-denied', 'Guests can only watch');
  return a;
};
const T = (table: string) => ({ full: db.doc(`tables/${table}/private/full`), seats: db.doc(`tables/${table}/docs/seats`), meta: db.doc(`tables/${table}/docs/meta`), view: (v: string) => db.doc(`tables/${table}/views/${v}`) });
async function write(tx: FirebaseFirestore.Transaction, table: string, rev: number, full: string, salt: string, views: { german: string; allied: string; public: string }, by: string) {
  const t = T(table);
  tx.set(t.full, { rev, json: full, salt });
  for (const v of ['german', 'allied', 'public'] as const) tx.set(t.view(v), { rev, json: views[v], by });
}
const cleanOpts = (o: Partial<Opts> | undefined): Partial<Opts> => ({ scenario: o?.scenario === 'campaign' ? 'campaign' : 'tournament', fuel: o?.fuel !== false, airborne: !!o?.airborne, advArty: !!o?.advArty });

/** Create a table, its lobby record, its seats and the first full game. */
export const createTable = onCall(async (r) => {
  const a = need(r), d = r.data as { title?: string; game?: string; opts?: Partial<Opts>; side?: Side | null };
  const id = randomId(6), opts = cleanOpts(d.opts), side = d.side === 'german' || d.side === 'allied' ? d.side : null, name = (a.token.name as string) || (a.token.email as string) || 'Player';
  const salt = randomId(16), full = startFull(opts), json = JSON.stringify(full), views = viewsOf(full, salt), t = T(id);
  await db.runTransaction(async (tx) => {
    tx.set(db.doc(`matches/${id}`), { game: d.game === 'bulge' ? 'bulge' : 'bulge', title: String(d.title ?? '').slice(0, 60) || `Game ${id}`, opts, owner: a.uid, members: [a.uid], created: Date.now(), server: true, ...(side ? { [side + 'Name']: name } : {}) });
    tx.set(t.meta, { server: true });
    tx.set(t.seats, { german: side === 'german' ? a.uid : null, allied: side === 'allied' ? a.uid : null, germanName: side === 'german' ? name : null, alliedName: side === 'allied' ? name : null });
    await write(tx, id, 1, json, salt, views, a.uid);
  });
  return { id };
});

/** Apply a seat's moves. The client sends the calls it made (names and ids, never state). */
export const act = onCall(async (r) => {
  const a = need(r), d = r.data as { table?: string; calls?: Call[]; rev?: number };
  if (typeof d.table !== 'string' || !/^[a-z0-9-]{3,40}$/.test(d.table) || !Array.isArray(d.calls)) throw new HttpsError('invalid-argument', 'bad request');
  const t = T(d.table), table = d.table, calls = d.calls;
  return db.runTransaction(async (tx) => {
    const [fs, ss] = await Promise.all([tx.get(t.full), tx.get(t.seats)]);
    if (!fs.exists) throw new HttpsError('not-found', 'no such game');
    const seats = (ss.data() ?? {}) as { german?: string | null; allied?: string | null }, side: Side | null = seats.german === a.uid ? 'german' : seats.allied === a.uid ? 'allied' : null;
    if (!side) throw new HttpsError('permission-denied', 'take a seat first');
    const cur = fs.data() as { rev: number; json: string; salt: string };
    if (typeof d.rev === 'number' && d.rev !== cur.rev) throw new HttpsError('aborted', 'The game moved on. Try again.');
    let out; try { out = processAction(cur.json, cur.salt, side, calls); } catch (e) { throw new HttpsError('failed-precondition', (e as Error).message || 'illegal move'); }
    await write(tx, table, cur.rev + 1, out.full, cur.salt, out.views, a.uid);
    return { rev: cur.rev + 1 };
  });
});

/** Start the table's game again (its creator or an admin). */
export const restartTable = onCall(async (r) => {
  const a = need(r), d = r.data as { table?: string; opts?: Partial<Opts> };
  if (typeof d.table !== 'string' || !/^[a-z0-9-]{3,40}$/.test(d.table)) throw new HttpsError('invalid-argument', 'bad request');
  const table = d.table, t = T(table), opts = cleanOpts(d.opts);
  return db.runTransaction(async (tx) => {
    const [fs, ms, ad] = await Promise.all([tx.get(t.full), tx.get(db.doc(`matches/${table}`)), tx.get(db.doc(`admins/${a.uid}`))]);
    if (!fs.exists) throw new HttpsError('not-found', 'no such game');
    if (!(ad.exists || (ms.exists && (ms.data() as { owner?: string }).owner === a.uid))) throw new HttpsError('permission-denied', 'only the creator or an admin');
    const cur = fs.data() as { rev: number; salt: string }, full = startFull(opts);
    await write(tx, table, cur.rev + 1, JSON.stringify(full), cur.salt, viewsOf(full, cur.salt), a.uid);
    return { rev: cur.rev + 1 };
  });
});

/** Delete a table's game and views together with its lobby record (creator or admin). */
export const deleteTable = onCall(async (r) => {
  const a = need(r), d = r.data as { table?: string };
  if (typeof d.table !== 'string' || !/^[a-z0-9-]{3,40}$/.test(d.table)) throw new HttpsError('invalid-argument', 'bad request');
  const table = d.table, [ms, ad] = await Promise.all([db.doc(`matches/${table}`).get(), db.doc(`admins/${a.uid}`).get()]);
  if (!(ad.exists || (ms.exists && (ms.data() as { owner?: string }).owner === a.uid))) throw new HttpsError('permission-denied', 'only the creator or an admin');
  const refs: DocumentReference[] = [db.doc(`tables/${table}/private/full`), db.doc(`tables/${table}/docs/seats`), db.doc(`tables/${table}/docs/meta`), db.doc(`tables/${table}/docs/state`), ...['german', 'allied', 'public'].map((v) => db.doc(`tables/${table}/views/${v}`)), db.doc(`matches/${table}`)];
  await Promise.all(refs.map((x) => x.delete()));
  return { ok: true };
});
