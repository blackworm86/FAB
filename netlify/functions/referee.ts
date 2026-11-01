/** The referee, on Netlify's free tier. Every move goes through here: the full game lives only in Firestore `tables/{id}/private/full`
 *  (clients cannot read it; this function uses the service account), and each seat gets a redacted view in `tables/{id}/views/{german|allied|public}`.
 *  POST JSON { op: 'createTable' | 'act' | 'restartTable' | 'deleteTable', ... } with `Authorization: Bearer <Firebase ID token>`. */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { processAction, viewsOf, startFull, type Call, type Opts, type Side } from '../../engine/src';

if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}')) });
const db: Firestore = getFirestore();

class Fail extends Error { constructor(public status: number, message: string) { super(message); } }
const randomId = (n: number) => Array.from({ length: n }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');
const TABLE = /^[a-z0-9-]{3,40}$/;
const T = (table: string) => ({ full: db.doc(`tables/${table}/private/full`), seats: db.doc(`tables/${table}/docs/seats`), meta: db.doc(`tables/${table}/docs/meta`), view: (v: string) => db.doc(`tables/${table}/views/${v}`) });
const cleanOpts = (o: Partial<Opts> | undefined): Partial<Opts> => ({ scenario: o?.scenario === 'campaign' ? 'campaign' : 'tournament', fuel: o?.fuel !== false, airborne: !!o?.airborne, advArty: !!o?.advArty });
const tableOf = (v: unknown) => { if (typeof v !== 'string' || !TABLE.test(v)) throw new Fail(400, 'bad table'); return v; };

function write(tx: Transaction, table: string, rev: number, full: string, salt: string, views: { german: string; allied: string; public: string }, by: string) {
  const t = T(table);
  tx.set(t.full, { rev, json: full, salt });
  for (const v of ['german', 'allied', 'public'] as const) tx.set(t.view(v), { rev, json: views[v], by });
}
const isAdmin = async (uid: string) => (await db.doc(`admins/${uid}`).get()).exists;

async function createTable(u: DecodedIdToken, d: { title?: string; game?: string; opts?: Partial<Opts>; side?: Side | null }) {
  const id = randomId(6), opts = cleanOpts(d.opts), side = d.side === 'german' || d.side === 'allied' ? d.side : null, name = (u.name as string) || (u.email as string) || 'Player';
  const salt = randomId(16), full = startFull(opts), json = JSON.stringify(full), views = viewsOf(full, salt), t = T(id);
  await db.runTransaction(async (tx) => {
    tx.set(db.doc(`matches/${id}`), { game: 'bulge', title: String(d.title ?? '').slice(0, 60) || `Game ${id}`, opts, owner: u.uid, members: [u.uid], created: Date.now(), server: true, ...(side ? { [side + 'Name']: name } : {}) });
    tx.set(t.meta, { server: true });
    tx.set(t.seats, { german: side === 'german' ? u.uid : null, allied: side === 'allied' ? u.uid : null, germanName: side === 'german' ? name : null, alliedName: side === 'allied' ? name : null });
    write(tx, id, 1, json, salt, views, u.uid);
  });
  return { id };
}

async function act(u: DecodedIdToken, d: { table?: string; calls?: Call[]; rev?: number }) {
  const table = tableOf(d.table), calls = d.calls; if (!Array.isArray(calls)) throw new Fail(400, 'bad request');
  const t = T(table);
  return db.runTransaction(async (tx) => {
    const [fs, ss] = await Promise.all([tx.get(t.full), tx.get(t.seats)]);
    if (!fs.exists) throw new Fail(404, 'no such game');
    const seats = (ss.data() ?? {}) as { german?: string | null; allied?: string | null }, side: Side | null = seats.german === u.uid ? 'german' : seats.allied === u.uid ? 'allied' : null;
    if (!side) throw new Fail(403, 'take a seat first');
    const cur = fs.data() as { rev: number; json: string; salt: string };
    if (typeof d.rev === 'number' && d.rev !== cur.rev) throw new Fail(409, 'The game moved on. Try again.');
    let out; try { out = processAction(cur.json, cur.salt, side, calls); } catch (e) { throw new Fail(422, (e as Error).message || 'illegal move'); }
    write(tx, table, cur.rev + 1, out.full, cur.salt, out.views, u.uid);
    return { rev: cur.rev + 1 };
  });
}

async function restartTable(u: DecodedIdToken, d: { table?: string; opts?: Partial<Opts> }) {
  const table = tableOf(d.table), t = T(table), opts = cleanOpts(d.opts);
  return db.runTransaction(async (tx) => {
    const [fs, ms, ad] = await Promise.all([tx.get(t.full), tx.get(db.doc(`matches/${table}`)), tx.get(db.doc(`admins/${u.uid}`))]);
    if (!fs.exists) throw new Fail(404, 'no such game');
    if (!(ad.exists || (ms.exists && (ms.data() as { owner?: string }).owner === u.uid))) throw new Fail(403, 'only the creator or an admin');
    const cur = fs.data() as { rev: number; salt: string }, full = startFull(opts);
    write(tx, table, cur.rev + 1, JSON.stringify(full), cur.salt, viewsOf(full, cur.salt), u.uid);
    return { rev: cur.rev + 1 };
  });
}

async function deleteTable(u: DecodedIdToken, d: { table?: string }) {
  const table = tableOf(d.table), ms = await db.doc(`matches/${table}`).get();
  if (!((await isAdmin(u.uid)) || (ms.exists && (ms.data() as { owner?: string }).owner === u.uid))) throw new Fail(403, 'only the creator or an admin');
  const refs = [`tables/${table}/private/full`, `tables/${table}/docs/seats`, `tables/${table}/docs/meta`, `tables/${table}/docs/state`, ...['german', 'allied', 'public'].map((v) => `tables/${table}/views/${v}`), `matches/${table}`].map((p) => db.doc(p));
  await Promise.all(refs.map((x) => x.delete()));
  return { ok: true };
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status: number, body: unknown) => ({ statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const handler = async (event: { httpMethod: string; headers: Record<string, string | undefined>; body: string | null }) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'POST only' });
  try {
    const h = event.headers.authorization ?? event.headers.Authorization ?? '', token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) throw new Fail(401, 'Sign in first');
    let u: DecodedIdToken; try { u = await getAuth().verifyIdToken(token); } catch { throw new Fail(401, 'Sign in again'); }
    if (u.firebase.sign_in_provider === 'anonymous') throw new Fail(403, 'Guests can only watch');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = JSON.parse(event.body ?? '{}');
    switch (d.op) {
      case 'createTable': return reply(200, await createTable(u, d));
      case 'act': return reply(200, await act(u, d));
      case 'restartTable': return reply(200, await restartTable(u, d));
      case 'deleteTable': return reply(200, await deleteTable(u, d));
      default: throw new Fail(400, 'unknown operation');
    }
  } catch (e) {
    if (e instanceof Fail) return reply(e.status, { error: e.message });
    console.error(e); return reply(500, { error: 'The referee had a problem. Try again.' });
  }
};
