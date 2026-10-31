/** Online play through the artifact's shared database: one table with a state document and a seats document.
 *  The rules engine is deterministic from the saved state (the dice come from the stored seed), so every player simply
 *  loads the newest state; the seat decides who may act. Without the `db` capability the game stays hot-seat. */
import type { Game, Side } from '../../engine/src';

type Snap = { exists: boolean; data(): Record<string, unknown> | undefined };
type Ref = { get(): Promise<Snap>; set(d: Record<string, unknown>): Promise<void>; onSnapshot(n: (s: Snap) => void, e?: (x: unknown) => void): () => void; acquire(o: { holder: string; ttlMs?: number }): Promise<{ acquired: boolean }> };
type Db = { doc(p: string): Ref };
declare const claude: { use(name: string): Promise<unknown> } | undefined;

export interface Seats { german?: string | null; allied?: string | null }
export const online = {
  active: false, uid: '' as string, seats: {} as Seats, rev: 0, canWrite: true, error: '',
  mySide(): Side | null { return this.seats.german === this.uid ? 'german' : this.seats.allied === this.uid ? 'allied' : null; },
};
let stateRef: Ref | null = null, seatsRef: Ref | null = null, lastJson = '', writing = false, queued: Game | null = null, onChange: () => void = () => {}, onRemote: (g: Game) => void = () => {};

const slim = (g: Game) => { const c = { ...g, log: g.log.slice(-120) }; return JSON.stringify(c); };

export async function startOnline(remote: (g: Game) => void, changed: () => void, current: () => Game) {
  onRemote = remote; onChange = changed;
  try {
    if (typeof claude === 'undefined') return;
    const db = (await claude.use('db')) as Db | null, user = (await claude.use('user')) as { id(): Promise<string | null>; can(n: string): boolean | null } | null;
    if (!db || !user) return;
    online.uid = (await user.id()) ?? ''; if (!online.uid) return;
    online.canWrite = user.can('data.write') !== false; online.active = true;
    stateRef = db.doc('table/state'); seatsRef = db.doc('table/seats');
    seatsRef.onSnapshot((s) => { online.seats = (s.exists ? (s.data() as Seats) : {}) ?? {}; onChange(); }, (e) => { online.error = String((e as { message?: string })?.message ?? e); onChange(); });
    stateRef.onSnapshot((s) => {
      if (!s.exists) { if (online.canWrite) void push(current()); return; }
      const d = s.data() as { rev: number; json: string };
      if (d.json === lastJson || d.rev < online.rev) return;
      lastJson = d.json; online.rev = d.rev; try { onRemote(JSON.parse(d.json)); } catch { /* ignore a damaged document */ }
    }, (e) => { online.error = String((e as { message?: string })?.message ?? e); onChange(); });
  } catch (e) { online.active = false; online.error = String(e); }
}

/** Publish the local state (coalescing quick bursts into one write at a time). */
export async function push(g: Game) {
  if (!online.active || !stateRef || !online.canWrite) return;
  const json = slim(g); if (json === lastJson) return;
  if (writing) { queued = g; return; }
  writing = true;
  try { lastJson = json; online.rev += 1; await stateRef.set({ rev: online.rev, json, by: online.uid }); }
  catch (e) { online.error = String((e as { message?: string })?.message ?? e); onChange(); }
  writing = false; if (queued) { const q = queued; queued = null; void push(q); }
}

/** Take a seat (first come, first served), or give it up. Uses a short lease so two players cannot take the same seat. */
export async function sit(side: Side | null) {
  if (!online.active || !seatsRef) return;
  const lease = await seatsRef.acquire({ holder: online.uid, ttlMs: 4000 }); if (!lease.acquired) { online.error = 'The table is busy, try again'; onChange(); return; }
  const cur = ((await seatsRef.get()).data() as Seats | undefined) ?? {}, next: Seats = { german: cur.german ?? null, allied: cur.allied ?? null };
  if (next.german === online.uid) next.german = null; if (next.allied === online.uid) next.allied = null;
  if (side) { if (next[side] && next[side] !== online.uid) { online.error = `The ${side} seat is taken`; onChange(); return; } next[side] = online.uid; }
  online.error = ''; await seatsRef.set(next as Record<string, unknown>);
}
