import type { Seats, Store, StateDoc } from './online';
import type { Side } from '../../engine/src';
type Snap = { exists: boolean; data(): Record<string, unknown> | undefined };
type Ref = { get(): Promise<Snap>; set(d: Record<string, unknown>): Promise<void>; onSnapshot(n: (s: Snap) => void, e?: (x: unknown) => void): () => void; acquire(o: { holder: string; ttlMs?: number }): Promise<{ acquired: boolean }> };
type Db = { doc(p: string): Ref };
declare const claude: { use(name: string): Promise<unknown> } | undefined;
const msg = (e: unknown) => String((e as { message?: string })?.message ?? e);

/** The claude.ai artifact database, present only when the page is published as an artifact. */
export async function artifactStore(): Promise<Store | null> {
  if (typeof claude === 'undefined') return null;
  const db = (await claude.use('db')) as Db | null, user = (await claude.use('user')) as { id(): Promise<string | null>; can(n: string): boolean | null } | null;
  if (!db || !user) return null;
  const uid = (await user.id()) ?? ''; if (!uid) return null;
  const state = db.doc('table/state'), seats = db.doc('table/seats');
  return {
    uid, canWrite: user.can('data.write') !== false,
    watchState: (next, err) => { state.onSnapshot((s) => next(s.exists ? (s.data() as unknown as StateDoc) : null), (e) => err(msg(e))); },
    setState: (d) => state.set(d as unknown as Record<string, unknown>),
    watchSeats: (next, err) => { seats.onSnapshot((s) => next((s.exists ? (s.data() as Seats) : {}) ?? {}), (e) => err(msg(e))); },
    async sit(side: Side | null) {
      const lease = await seats.acquire({ holder: uid, ttlMs: 4000 }); if (!lease.acquired) return 'The table is busy, try again';
      const cur = ((await seats.get()).data() as Seats | undefined) ?? {}, next: Seats = { german: cur.german ?? null, allied: cur.allied ?? null };
      if (next.german === uid) next.german = null; if (next.allied === uid) next.allied = null;
      if (side) { if (next[side] && next[side] !== uid) return `The ${side} seat is taken`; next[side] = uid; }
      await seats.set(next as Record<string, unknown>); return '';
    },
  };
}
