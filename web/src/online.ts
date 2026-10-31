/** Online play: one table with a state document and a seats document, kept in a shared store.
 *  Two stores are supported: the claude.ai artifact database (when the page runs inside claude.ai) and Firebase (GitHub Pages deploy).
 *  The rules engine is deterministic from the saved state (dice come from the stored seed), so every client simply loads the newest state;
 *  the seat decides who may act. With neither store the game is hot-seat, and in dev mode a seat switch lets one machine play both sides. */
import type { Game, Side } from '../../engine/src';
import { artifactStore } from './store-artifact';
import { firebaseStore } from './store-firebase';

export interface Seats { german?: string | null; allied?: string | null; germanName?: string | null; alliedName?: string | null }
/** A match is a table plus a lobby record: who made it, which game and rules, who is in. */
export interface Match { id: string; game: string; title: string; opts: { scenario: string; fuel: boolean; airborne?: boolean }; owner: string; members: string[]; germanName?: string; alliedName?: string; created: number }
export interface Account { uid: string; name: string; email: string; guest: boolean; admin: boolean }
export interface StateDoc { rev: number; json: string; by?: string }
/** What a storage backend has to provide. */
export interface Store {
  uid: string; canWrite: boolean;
  watchState(next: (d: StateDoc | null) => void, err: (e: string) => void): void;
  setState(d: StateDoc): Promise<void>;
  watchSeats(next: (s: Seats) => void, err: (e: string) => void): void;
  /** Take the seat for `side` (or give up every seat when null); resolves an error message, or '' on success. */
  sit(side: Side | null): Promise<string>;
  /** Accounts: only the Firebase store has them (the artifact store identifies viewers itself). */
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
  devSeat: 'both' as DevSeat, account: null as Account | null, admin: false, hasAccounts: false,
  mySide(): Side | null {
    if (DEV && this.mode !== 'off') return this.devSeat === 'german' || this.devSeat === 'allied' ? this.devSeat : null;
    return this.seats.german === this.uid && this.uid ? 'german' : this.seats.allied === this.uid && this.uid ? 'allied' : null;
  },
  /** True when this client may act for whoever's turn it is (dev "both" seat, or hot-seat). */
  both() { return this.mode === 'off' || (DEV && this.devSeat === 'both'); },
  get active() { return this.mode !== 'off'; },
};
let store: Store | null = null, lastJson = '', writing = false, queued: Game | null = null, onChange: () => void = () => {}, onRemote: (g: Game) => void = () => {};
const slim = (g: Game) => JSON.stringify({ ...g, log: g.log.slice(-120) });
const fail = (e: string) => { online.error = e; onChange(); };

export async function startOnline(remote: (g: Game) => void, changed: () => void, current: () => Game) {
  onRemote = remote; onChange = changed;
  if (LOCAL_ONLY) { if (DEV) { online.mode = 'local'; changed(); } return; }
  try { store = (await artifactStore()) ?? (await firebaseStore(TABLE)); } catch (e) { online.error = String(e); store = null; }
  if (!store) { if (DEV) { online.mode = 'local'; changed(); } return; }
  online.mode = 'remote'; online.uid = store.uid; online.canWrite = store.canWrite;
  if (store.account) { online.hasAccounts = true; const sync = (a: Account) => { online.account = a; online.uid = a.uid; online.admin = a.admin; onChange(); }; sync(store.account()); store.onAccount?.(sync); }
  store.watchSeats((s) => { online.seats = s; onChange(); }, fail);
  store.watchState((d) => {
    if (!d) { if (online.canWrite) void push(current()); return; }
    if (d.json === lastJson || d.rev < online.rev) return;
    lastJson = d.json; online.rev = d.rev; try { onRemote(JSON.parse(d.json)); } catch { /* ignore a damaged document */ }
  }, fail);
}

/** Publish the local state (quick bursts are coalesced into one write at a time). */
export async function push(g: Game) {
  if (online.mode !== 'remote' || !store || !online.canWrite) return;
  if (online.hasAccounts && !online.admin && online.mySide() == null) return;                       // only seated players (or an admin) change a shared table
  const json = slim(g); if (json === lastJson) return;
  if (writing) { queued = g; return; }
  writing = true;
  try { lastJson = json; online.rev += 1; await store.setState({ rev: online.rev, json, by: online.uid }); } catch (e) { fail(String((e as { message?: string })?.message ?? e)); }
  writing = false; if (queued) { const q = queued; queued = null; void push(q); }
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
