/** Development only: stand-in storage so two tabs of one browser can play a game with split hidden blocks without Firebase. */
import { newGame, initSplit, type Side, type Priv, type Reveals } from '../../engine/src';
import type { Seats, Store, StateDoc } from './online';

/** `?fake=german` / `?fake=allied`: the hiding (shared copy + private details + reveals), kept in localStorage so two tabs can play it. */
export function fakeSplitStore(side: Side): Store {
  const P = 'fab-fake-pub', V = (x: Side) => 'fab-fake-priv-' + x, R = 'fab-fake-reveals';
  const seats: Seats = { german: 'u-german', allied: 'u-allied', germanName: 'German (dev)', alliedName: 'Allied (dev)' };
  const get = <T,>(k: string): T | null => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') as T | null; } catch { return null; } };
  const put = (k: string, v: unknown) => { localStorage.setItem(k, JSON.stringify(v)); window.dispatchEvent(new StorageEvent('storage', { key: k })); };
  if (!get(P)) { const sp = initSplit(newGame(5, { scenario: 'tournament', fuel: true }), 'sg', 'sa'); put(V('german'), sp.german); put(V('allied'), sp.allied); put(P, { rev: 1, json: sp.pub }); }
  const on = (k: string, f: () => void) => { f(); window.addEventListener('storage', (e) => { if (e.key === k) f(); }); };
  return {
    uid: 'u-' + side, canWrite: true, split: true,
    watchSeats: (next) => next(seats), sit: async () => '',
    watchState: (next) => on(P, () => next(get<StateDoc>(P))),
    setState: async (d) => put(P, d),
    watchPriv: (next) => on(V(side), () => next(get<Priv>(V(side)))), setPriv: async (p) => put(V(side), p),
    watchReveals: (next) => on(R, () => next(get<Reveals>(R) ?? {})), mergeReveals: async (r) => put(R, { ...(get<Reveals>(R) ?? {}), ...r }),
  };
}
