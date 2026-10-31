/** Development only (`?fake=german` or `?fake=allied`): a stand-in for the Firebase referee that runs the same server code in the browser.
 *  Two tabs of the same browser share the game through localStorage, so a two-player refereed game can be tried without deploying anything. */
import { processAction, viewsOf, startFull, type Call, type Side } from '../../engine/src';
import type { Seats, Store, StateDoc } from './online';

const K = 'fab-fake-full', SALT = 'dev-salt';
const read = () => { try { return JSON.parse(localStorage.getItem(K) ?? 'null') as { rev: number; json: string } | null; } catch { return null; } };
export function fakeStore(side: Side): Store {
  const seats: Seats = { german: 'u-german', allied: 'u-allied', germanName: 'German (dev)', alliedName: 'Allied (dev)' };
  if (!read()) { const full = startFull({ scenario: 'tournament', fuel: true }, 5); localStorage.setItem(K, JSON.stringify({ rev: 1, json: JSON.stringify(full) })); }
  const view = (): StateDoc | null => { const f = read(); if (!f) return null; const v = viewsOf(JSON.parse(f.json), SALT); return { rev: f.rev, json: v[side] }; };
  return {
    uid: 'u-' + side, canWrite: true, server: true,
    watchSeats: (next) => next(seats), sit: async () => '',
    watchState: (next) => { next(view()); window.addEventListener('storage', (e) => { if (e.key === K) next(view()); }); },
    setState: async () => undefined,
    async sendCalls(calls: Call[]) {
      const f = read()!;
      try { const out = processAction(f.json, SALT, side, calls); localStorage.setItem(K, JSON.stringify({ rev: f.rev + 1, json: out.full })); window.dispatchEvent(new StorageEvent('storage', { key: K })); return ''; } catch (e) { return (e as Error).message; }
    },
    async restart() { const full = startFull({ scenario: 'tournament', fuel: true }, 5); const f = read()!; localStorage.setItem(K, JSON.stringify({ rev: f.rev + 1, json: JSON.stringify(full) })); window.dispatchEvent(new StorageEvent('storage', { key: K })); return ''; },
  };
}
