// The experimental computer opponent on a local table: ?lab=german (the computer plays the Germans) or ?lab=allied.
// Not linked from the home page. The table asks the worker for a move with a time limit; if the worker does not
// answer in time, the simple doctrine player moves instead, so the table never stalls.
import * as E from '../../engine/src';
import { actors, apply, type Action } from '../../bot/src/actions';
import { doctrinePlayer } from '../../bot/src/doctrine';
import { Seat } from '../../bot/src/view';
import { rng } from '../../bot/src/random';

const TIMEOUT_MS = 20000, PACE_MS = 350;
const p = new URLSearchParams(location.search).get('lab');
/** The side the computer plays, or null outside the experimental mode. */
export const LAB_SIDE: E.Side | null = p === 'german' || p === 'allied' ? p : null;
export const labHuman = () => (LAB_SIDE ? E.other(LAB_SIDE) : null);

let seat: Seat | null = null, worker: Worker | null = null, busy = false, next = 0;
export const lab = { thinking: false, reason: '' as string, fallback: 0 };

/** The computer's turn to act now (in the Admin and Reinforcement Phases it waits until the other side is done). */
export const labTurn = (g: E.Game) => !!LAB_SIDE && !g.over && actors(g)[0] === LAB_SIDE;

/** If it is the computer's turn, think and then carry out its action through `act`. */
export function labStep(game: () => E.Game, act: (f: () => void) => void, refresh: () => void) {
  const g = game(); if (!LAB_SIDE || busy || !labTurn(g)) return;
  seat ??= new Seat(LAB_SIDE, Object.fromEntries(E.sidesOf(g).map((s) => [s, Math.random().toString(36).slice(2)])) as Record<E.Side, string>, rng(Date.now() % 1e9));
  worker ??= new Worker(new URL('./lab-worker.ts', import.meta.url), { type: 'module' });
  busy = true; lab.thinking = true; refresh();
  const id = ++next, view = seat.view(g), s = seat, w = worker;
  const done = (a: Action | null, reason?: string | null) => {
    if (id !== next) return; next++;                                          // answered once only (the worker or the time limit)
    clearTimeout(timer); w.onmessage = null; if (reason) lab.reason = reason;
    setTimeout(() => { busy = false; lab.thinking = false; if (a && labTurn(game())) act(() => apply(game(), a, (x) => s.real(x))); else refresh(); }, PACE_MS);   // the game the table holds now
  };
  const timer = setTimeout(() => { worker?.terminate(); worker = null; lab.fallback++; done(doctrinePlayer()(view, LAB_SIDE)); }, TIMEOUT_MS);
  w.onmessage = (e) => done(e.data.action, e.data.reason);
  w.postMessage({ id, view, side: LAB_SIDE });
}
