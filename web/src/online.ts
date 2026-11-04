/** Online play. Everything of one game lives in the Firebase Realtime Database under `games/{id}` (see store-rtdb.ts and database.rules.json):
 *  the shared game as many small values, each seat's private block details, and the reveals. A browser works out its own moves with the rules engine
 *  and writes only what changed. The seat decides who may act. In development (`?dev=1`) a seat switch lets one tab play both sides. */
import { setRandom, SplitSeat, type Game, type Side, type Priv, type Reveals } from '../../engine/src';
import { rtdbStore } from './store-rtdb';

export interface Seats { german?: string | null; allied?: string | null; germanName?: string | null; alliedName?: string | null }
/** A game as listed in the lobby: who made it, which game and rules, who sits where. */
export interface Match { id: string; game: string; title: string; opts: { scenario: string; fuel: boolean; airborne?: boolean }; owner: string; members: string[]; germanName?: string; alliedName?: string; created: number }
export interface Account { uid: string; name: string; email: string; guest: boolean; admin: boolean }
/** The shared game as the store hands it over: a revision counter and the game as JSON. */
/** One chat message: written only by a seated player, signed with their own account and side. */
export interface ChatMsg { id: string; uid: string; side: Side; name?: string; text: string; t: number }
export interface StateDoc { rev: number; json: string; by?: string }
/** What a storage backend has to provide. */
export interface Store {
  uid: string;
  watchState(next: (d: StateDoc | null) => void, err: (e: string) => void): void;
  setState(d: StateDoc): Promise<void>;
  watchSeats(next: (s: Seats) => void, err: (e: string) => void): void;
  /** Take the seat for `side` (or give up every seat when null); resolves an error message, or '' on success. */
  sit(side: Side | null): Promise<string>;
  /** Each seat's private block details, and the details the other side may see (see engine/src/split.ts). */
  watchPriv(next: (p: Priv | null) => void): void; setPriv(p: Priv): Promise<void>; watchReveals(next: (r: Reveals) => void): void; mergeReveals(r: Reveals): Promise<void>; dropReveals(keys: string[]): Promise<void>;
  /** The players' chat: the last messages, live; and sending one as the seated side. */
  watchChat(next: (m: ChatMsg[]) => void): void; sendChat(side: Side, text: string): Promise<string>;
  /** Accounts and the lobby. */
  account(): Account; onAccount(f: (a: Account) => void): void;
  google(): Promise<string>; emailSignIn(email: string, password: string): Promise<string>; emailRegister(email: string, password: string, name: string): Promise<string>;
  resetPassword(email: string): Promise<string>; signOut(): Promise<string>; freeSeat(side: Side): Promise<string>;
  /** Create a game (its shared state, the creator's seat and the lobby record); resolves the new id, or an error starting with '!'. */
  createMatch(m: Omit<Match, 'id' | 'owner' | 'members' | 'created'>, side: Side | null, stateJson: string): Promise<string>;
  /** The creator or an admin deletes the game for everyone; anyone else leaves it. Resolve '' or an error. */
  deleteMatch(id: string): Promise<string>; leaveMatch(id: string): Promise<string>;
  watchMyMatches(next: (m: Match[]) => void, err: (e: string) => void): void;
}

const params = new URLSearchParams(location.search);
export const DEV = import.meta.env.DEV || params.has('dev') || (() => { try { return localStorage.getItem('fab-dev') === '1'; } catch { return false; } })();
export const TABLE = params.get('table') || 'main';
export const HAS_TABLE = params.has('table'), DEV_FAKE = DEV && params.has('fake');
/** The admin sandbox (`?sandbox`): a private test table in this browser; the account is only read to check that it is an admin. */
export const SANDBOX = params.has('sandbox');
/** The tutorial: a local game in this browser, nothing written online. */
export const TUTORIAL = params.has('tutorial') && !SANDBOX && !params.has('table');
export type DevSeat = 'german' | 'allied' | 'both' | 'watch';

export const online = {
  /** 'off' = not connected, 'local' = a development table on this machine, 'remote' = shared through the database. */
  mode: 'off' as 'off' | 'local' | 'remote', uid: '', seats: {} as Seats, rev: 0, error: '', sync: 'connecting' as string, ready: false,
  lastBy: '', chat: [] as ChatMsg[], devSeat: 'both' as DevSeat, enemyAlias: new Map<string, string>(), account: null as Account | null, admin: false, hasAccounts: false,
  mySide(): Side | null {
    if ((DEV || SANDBOX) && this.mode !== 'off') return this.devSeat === 'german' || this.devSeat === 'allied' ? this.devSeat : null;
    return this.seats.german === this.uid && this.uid ? 'german' : this.seats.allied === this.uid && this.uid ? 'allied' : null;
  },
  /** True when this client may act for whoever's turn it is (the development "both" seat). */
  both() { return this.mode === 'off' || ((DEV || SANDBOX) && this.devSeat === 'both'); },
  get active() { return this.mode !== 'off'; },
};

let store: Store | null = null, seat: SplitSeat | null = null, pubDoc: StateDoc | null = null, lastJson = '';
let writing = false, queued: Game | null = null, rebuildLater = false, had = false;
let onChat: (m: ChatMsg[]) => void = () => {};
let onChange: () => void = () => {}, onRemote: (g: Game) => void = () => {}, notify: (m: string) => void = () => {}, onGone: () => void = () => {};
const fail = (e: string) => { online.error = e; onChange(); };
const mySeat = () => { const side = online.mySide(); if (!side) return (seat = null); if (!seat || seat.side !== side) seat = new SplitSeat(side); return seat; };

/** Rebuild the game this seat plays on from the shared copy, its private details and the reveals. */
function rebuild() {
  if (writing) { rebuildLater = true; return; }       // a save is in flight: apply what arrived as soon as it ends
  if (!pubDoc) return; const sp = mySeat(), g0 = JSON.parse(pubDoc.json) as Game;
  if (!sp) { onRemote(g0); return; }
  const game = sp.open(g0); online.enemyAlias = sp.enemyAlias; onRemote(game);
  if (sp.priv && sp.stale(game)) void push(game);          // the other seat's move hid one of our revealed blocks: withdraw its reveal now, not at our next move
}
const savedLater = () => { writing = false; if (rebuildLater) { rebuildLater = false; rebuild(); } if (queued) { const q = queued; queued = null; void push(q); } };

export async function startOnline(remote: (g: Game) => void, changed: () => void, say: (m: string) => void = () => {}, gone: () => void = () => {}) {
  onRemote = remote; onChange = changed; notify = say; onGone = gone;
  if (TUTORIAL) { online.ready = true; changed(); return; }
  try {
    const fake = DEV ? params.get('fake') : null, make = async () => (fake === 'german' || fake === 'allied' ? (await import('./store-fake')).fakeStore(fake) : rtdbStore(TABLE));
    store = await Promise.race([make(), new Promise<never>((_, no) => setTimeout(() => no(new Error('Could not reach the game database. Check the database address and your connection.')), 15000))]);
    if (store && (fake === 'german' || fake === 'allied')) online.devSeat = fake;                  // a stand-in store plays one seat per tab
  } catch (e) { online.error = String(e); store = null; }
  if (!store) { if (DEV) online.mode = 'local'; online.ready = true; changed(); return; }
  if (SANDBOX) {                                                                                   // only the account: the game stays in this browser
    const sync = (a: Account) => { online.account = a; online.uid = a.uid; online.admin = a.admin; onChange(); }; sync(store.account()); store.onAccount(sync);
    online.mode = 'local'; online.ready = true; online.hasAccounts = true; changed(); return;
  }
  setRandom(() => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);                       // shared games: dice nobody can predict from the shared seed
  online.ready = true; online.mode = 'remote'; online.uid = store.uid; online.hasAccounts = true;
  const sync = (a: Account) => { online.account = a; online.uid = a.uid; online.admin = a.admin; onChange(); }; sync(store.account()); store.onAccount(sync);
  store.watchSeats((s) => { online.seats = s; onChange(); rebuild(); }, fail);
  store.watchPriv((p) => { const sp = mySeat(); if (sp) sp.priv = p; rebuild(); if (p && queued) { const q = queued; queued = null; void push(q); } });
  store.watchReveals((r) => { const sp = mySeat(); if (sp) sp.reveals = r; rebuild(); });
  store.watchChat((m) => { online.chat = m; onChat(m); onChange(); });
  store.watchState((d) => {
    if (!d) { if (had) onGone(); return; }                                                         // the game was deleted
    had = true; online.sync = `received ${new Date().toLocaleTimeString()}`; onChange();
    online.rev = Math.max(online.rev, d.rev); online.lastBy = d.by ?? ''; pubDoc = d; if (d.json === lastJson) return; lastJson = d.json; rebuild();
  }, fail);
}

/** Write this seat's private details when they changed, then the shared game with this seat's hidden blocks hidden again. Quick bursts are coalesced into one write at a time. */
export async function push(g: Game) {
  const sp = mySeat(); if (online.mode !== 'remote' || !store || !sp) return;
  if (!sp.priv) { online.sync = 'NOT SAVED: your private block details have not loaded'; queued = g; notify('Your block details have not loaded yet. The move is kept and will be sent when they do.'); return; }
  const out = sp.save(g); if (out.pub === lastJson) return;
  if (writing) { queued = g; return; }
  writing = true; const dog = setTimeout(() => { if (writing) { writing = false; notify('Saving is taking too long. Check your connection.'); rebuild(); } }, 10000);
  try {
    if (out.priv) await store.setPriv(out.priv);
    lastJson = out.pub; pubDoc = { rev: online.rev, json: out.pub, by: online.uid }; online.sync = 'saving'; onChange();
    await store.setState(pubDoc); if (out.gone?.length) await store.dropReveals(out.gone);           // a block hidden again: its old reveal goes
    online.sync = `saved ${new Date().toLocaleTimeString()}`; onChange();
  } catch (e) { const m = String((e as { message?: string })?.message ?? e); online.sync = 'NOT SAVED: ' + m; notify('Not saved: ' + m); fail(m); }
  clearTimeout(dog); savedLater();
}

/** The player's own details of the blocks the other side may now see: the battle area once both are ready, and an Intelligence Gathering target. */
export async function publishReveals(g: Game) {
  const sp = mySeat(); if (!store || !sp) return;
  const fresh = sp.due(g); if (Object.keys(fresh).length) await store.mergeReveals(fresh);
}

/** Send a chat line as the seated side; resolves an error message or ''. Watchers only read. */
export async function sendChat(text: string) { const side = online.mySide(), t = text.trim().slice(0, 300); if (!store || online.mode !== 'remote' && !DEV || !side || !t) return 'Only the two players can write in the chat.'; return store.sendChat(side, t); }
export const setChatListener = (f: (m: ChatMsg[]) => void) => { onChat = f; };
export async function sit(side: Side | null) { if (online.mode !== 'remote' || !store) return; const e = await store.sit(side); online.error = e; onChange(); }
export function setDevSeat(s: DevSeat) { online.devSeat = s; onChange(); }

async function run(f: (s: Store) => Promise<string>) { if (!store) return; const e = await f(store); online.error = e ?? ''; onChange(); }
export const auth = {
  google: () => run((s) => s.google()), signOut: () => run((s) => s.signOut()),
  signIn: (e: string, p: string) => run((s) => s.emailSignIn(e, p)), register: (e: string, p: string, n: string) => run((s) => s.emailRegister(e, p, n)),
  reset: (e: string) => run((s) => s.resetPassword(e)), freeSeat: (side: Side) => run((s) => s.freeSeat(side)),
};
export const lobby = {
  create: async (m: Parameters<Store['createMatch']>[0], side: Side | null, json: string) => (store ? store.createMatch(m, side, json) : '!Online play is not set up'),
  remove: (id: string) => run((s) => s.deleteMatch(id)), leave: (id: string) => run((s) => s.leaveMatch(id)),
  watch: (next: (m: Match[]) => void) => store?.watchMyMatches(next, fail),
};
