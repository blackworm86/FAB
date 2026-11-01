/** Online play: one table with a state document and a seats document, kept in a shared store.
 *  The store is Firebase (GitHub Pages deploy).
 *  The rules engine is deterministic from the saved state (dice come from the stored seed), so every client simply loads the newest state;
 *  the seat decides who may act. With neither store the game is hot-seat, and in dev mode a seat switch lets one machine play both sides. */
import { compose, toPublic, secretsOf, revealsIn, revealOf, freshReveals, type Game, type Side, type Priv, type Reveals } from '../../engine/src';
import { firebaseStore } from './store-firebase';

export interface Seats { german?: string | null; allied?: string | null; germanName?: string | null; alliedName?: string | null }
/** A match is a table plus a lobby record: who made it, which game and rules, who is in. */
export interface Match { id: string; game: string; title: string; opts: { scenario: string; fuel: boolean; airborne?: boolean }; owner: string; members: string[]; germanName?: string; alliedName?: string; created: number }
export interface Account { uid: string; name: string; email: string; guest: boolean; admin: boolean }
export interface StateDoc { rev: number; json: string; by?: string }
/** What a storage backend has to provide. */
export interface Store {
  uid: string; canWrite: boolean;
  /** Hidden blocks split between seats (see engine/src/split.ts): the shared game, this seat's private details, and the shared reveals. */
  split?: boolean; watchPriv?(next: (p: Priv | null) => void): void; setPriv?(p: Priv): Promise<void>; watchReveals?(next: (r: Reveals) => void): void; mergeReveals?(r: Reveals): Promise<void>;
  watchState(next: (d: StateDoc | null) => void, err: (e: string) => void): void;
  setState(d: StateDoc): Promise<void>;
  watchSeats(next: (s: Seats) => void, err: (e: string) => void): void;
  /** Take the seat for `side` (or give up every seat when null); resolves an error message, or '' on success. */
  sit(side: Side | null): Promise<string>;
  /** Accounts: only the Firebase store has them . */
  account?(): Account; onAccount?(f: (a: Account) => void): void;
  google?(): Promise<string>; emailSignIn?(email: string, password: string): Promise<string>; emailRegister?(email: string, password: string, name: string): Promise<string>;
  /** Lobby: create a match (state, creator's seat and record) and list the matches the user belongs to. Resolves the new id, or an error starting with '!'. */
  createMatch?(m: Omit<Match, 'id' | 'owner' | 'members' | 'created'>, side: Side | null, stateJson: string): Promise<string>;
  /** Owner or admin: remove the match with its state and seats. Resolves '' or an error. Others: leave (drop their membership). */
  deleteMatch?(id: string): Promise<string>; leaveMatch?(id: string): Promise<string>;
  watchMyMatches?(next: (m: Match[]) => void, err: (e: string) => void): void;
  resetPassword?(email: string): Promise<string>; signOut?(): Promise<string>; freeSeat?(side: Side): Promise<string>;
}

const params = new URLSearchParams(location.search);
export const DEV = import.meta.env.DEV || params.has('dev') || (() => { try { return localStorage.getItem('fab-dev') === '1'; } catch { return false; } })();
export const TABLE = params.get('table') || 'main';
export const HAS_TABLE = params.has('table'), LOCAL_ONLY = params.has('local');
export type DevSeat = 'german' | 'allied' | 'both' | 'watch';

export const online = {
  /** 'off' = hot-seat, 'local' = seats enforced on this machine only (dev), 'remote' = shared through a store. */
  mode: 'off' as 'off' | 'local' | 'remote', uid: '', seats: {} as Seats, rev: 0, canWrite: true, error: '', store: '' as string,
  devSeat: 'both' as DevSeat, split: false, enemyAlias: new Map<string, string>(), account: null as Account | null, admin: false, hasAccounts: false,
  mySide(): Side | null {
    if (DEV && this.mode !== 'off') return this.devSeat === 'german' || this.devSeat === 'allied' ? this.devSeat : null;
    return this.seats.german === this.uid && this.uid ? 'german' : this.seats.allied === this.uid && this.uid ? 'allied' : null;
  },
  /** True when this client may act for whoever's turn it is (dev "both" seat, or hot-seat). */
  both() { return this.mode === 'off' || (DEV && this.devSeat === 'both'); },
  get active() { return this.mode !== 'off'; },
};
let priv: Priv | null = null, reveals: Reveals = {}, pubDoc: StateDoc | null = null;
let rebuildLater = false;
function rebuild() {
  if (writing) { rebuildLater = true; return; }       // a save is in flight: apply what arrived as soon as it ends
  if (!pubDoc) return; const side = online.mySide(), g0 = JSON.parse(pubDoc.json) as Game;
  if (!side) { onRemote(g0); return; }
  const { game, enemyAlias } = compose(g0, side, priv, reveals); online.enemyAlias = enemyAlias; onRemote(game);
}
let store: Store | null = null, lastJson = '', writing = false, queued: Game | null = null, onChange: () => void = () => {}, onRemote: (g: Game) => void = () => {};
const slim = (g: Game) => JSON.stringify({ ...g, log: g.log.slice(-120) });
const fail = (e: string) => { online.error = e; onChange(); };
let notify: (m: string) => void = () => {};
/** The store refuses a save when the other player saved first (same rev). Take their game, and tell the player to repeat the move. */
function conflictOr(e: unknown) {
  const m = String((e as { message?: string })?.message ?? e);
  if (m.includes('CONFLICT')) { lastJson = ''; notify('The other player moved at the same moment. Their move is in; repeat yours.'); rebuildLater = true; return; }
  fail(m);
}

export async function startOnline(remote: (g: Game) => void, changed: () => void, current: () => Game, say: (m: string) => void = () => {}) {
  onRemote = remote; onChange = changed; notify = say;
  if (LOCAL_ONLY) { if (DEV) { online.mode = 'local'; changed(); } return; }
  try { const fake = DEV ? params.get('fake') : null; store = fake === 'german' || fake === 'allied' ? (await import('./store-fake')).fakeSplitStore(fake) : await firebaseStore(TABLE); } catch (e) { online.error = String(e); store = null; }
  { const fk = DEV ? params.get('fake') : null; if (store && (fk === 'german' || fk === 'allied')) online.devSeat = fk; }          // a stand-in referee plays one seat per tab
  if (!store) { if (DEV) { online.mode = 'local'; changed(); } return; }
  online.mode = 'remote'; online.uid = store.uid; online.canWrite = store.canWrite;
  if (store.account) { online.hasAccounts = true; const sync = (a: Account) => { online.account = a; online.uid = a.uid; online.admin = a.admin; onChange(); }; sync(store.account()); store.onAccount?.(sync); }
  store.watchSeats((s) => { online.seats = s; onChange(); if (online.split) rebuild(); }, fail);
  online.split = !!store.split;
  if (online.split) {
    // hidden blocks split between seats: rebuild the game this seat plays on from the shared copy, its private details and the reveals
    store.watchPriv?.((p) => { priv = p; rebuild(); }); store.watchReveals?.((r) => { reveals = r; rebuild(); });
    store.watchState((d) => { if (!d) return; if (d.rev >= online.rev) pubDoc = d; if (d.json === lastJson || d.rev < online.rev) return; online.rev = d.rev; lastJson = d.json; rebuild(); }, fail);
    return;
  }
  store.watchState((d) => {
    if (!d) { if (online.canWrite) void push(current()); return; }
    if (d.json === lastJson || d.rev < online.rev) return;
    lastJson = d.json; online.rev = d.rev; try { onRemote(JSON.parse(d.json)); } catch { /* ignore a damaged document */ }
  }, fail);
}

/** Publish the local state (quick bursts are coalesced into one write at a time). */
export async function push(g: Game) {
  if (online.split) return pushSplit(g);
  if (online.mode !== 'remote' || !store || !online.canWrite) return;
  if (online.hasAccounts && !online.admin && online.mySide() == null) return;                       // only seated players (or an admin) change a shared table
  const json = slim(g); if (json === lastJson) return;
  if (writing) { queued = g; return; }
  writing = true;
  try { lastJson = json; online.rev += 1; await store.setState({ rev: online.rev, json, by: online.uid }); } catch (e) { conflictOr(e); }
  writing = false; if (rebuildLater) { rebuildLater = false; rebuild(); }
  if (queued) { const q = queued; queued = null; void push(q); }
}

export async function sit(side: Side | null) { if (online.mode !== 'remote' || !store) return; const e = await store.sit(side); online.error = e; onChange(); }
export function setDevSeat(s: DevSeat) { online.devSeat = s; onChange(); }

export const auth = {
  google: () => run((s) => s.google?.()), signOut: () => run((s) => s.signOut?.()),
  signIn: (e: string, p: string) => run((s) => s.emailSignIn?.(e, p)), register: (e: string, p: string, n: string) => run((s) => s.emailRegister?.(e, p, n)),
  reset: (e: string) => run((s) => s.resetPassword?.(e)), freeSeat: (side: Side) => run((s) => s.freeSeat?.(side)),
};
async function run(f: (s: Store) => Promise<string> | undefined) { if (!store) return; const e = await f(store); online.error = e ?? ''; onChange(); }

export const lobby = {
  can: () => !!store?.createMatch,
  create: async (m: Parameters<NonNullable<Store['createMatch']>>[0], side: Side | null, json: string) => store?.createMatch ? store.createMatch(m, side, json) : '!Online play is not set up',
  remove: (id: string) => run((st) => st.deleteMatch?.(id)), leave: (id: string) => run((st) => st.leaveMatch?.(id)),
  watch: (next: (m: Match[]) => void) => store?.watchMyMatches?.(next, fail),
};


/** Split tables: write this seat's private details when they changed, then the shared copy with this seat's hidden blocks hidden again. */
async function pushSplit(g: Game) {
  const side = online.mySide(); if (online.mode !== 'remote' || !store || !side || !priv) return;
  const json = toPublic(g, side, priv.salt, online.enemyAlias); if (json === lastJson) return;
  if (writing) { queued = g; return; }
  writing = true;
  try {
    const sec = secretsOf(g, side); if (JSON.stringify(sec) !== JSON.stringify(priv.secrets)) { priv = { salt: priv.salt, secrets: sec }; await store.setPriv?.(priv); }
    lastJson = json; online.rev += 1; pubDoc = { rev: online.rev, json, by: online.uid }; await store.setState(pubDoc);
  } catch (e) { conflictOr(e); }
  writing = false; if (rebuildLater) { rebuildLater = false; rebuild(); }
  if (queued) { const q = queued; queued = null; void pushSplit(q); }
}
/** The owner's client publishes the details of its blocks the other side may now see: the battle area once both are ready, and an Intelligence Gathering target. */
export async function publishReveals(g: Game) {
  const side = online.mySide(); if (!online.split || !store || !side || !priv) return;
  let r: Reveals = {};
  const b = g.battle; if (b && b.stage === 'setup' && (b.ready?.length ?? 0) === 2) r = { ...r, ...revealsIn(g, side, b.area, priv.salt) };
  if (g.revealed && g.units.find((u) => u.id === g.revealed)?.side === side) r = { ...r, ...revealOf(g, g.revealed, priv.salt) };
  const fresh = freshReveals(reveals, r); if (!Object.keys(fresh).length) return;
  reveals = { ...reveals, ...fresh }; await store.mergeReveals?.(fresh);
}
