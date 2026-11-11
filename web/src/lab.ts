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

/** Every action the computer took, with its reason, kept with the saved game (the game record the owner can send back). */
type Entry = { at: string; turn: number; phasing: E.Side; phase: string; battle?: string; fn: string; args: unknown[]; reason?: string; timedOut?: boolean };
export const recordKey = (cpu: E.Side) => `fab-lab-${cpu}-record`;
const history: Entry[] = (() => { try { return LAB_SIDE ? JSON.parse(localStorage.getItem(recordKey(LAB_SIDE)) ?? '[]') : []; } catch { return []; } })();
const note = (e: Entry) => { history.push(e); try { localStorage.setItem(recordKey(LAB_SIDE!), JSON.stringify(history.slice(-3000))); } catch { /* storage full or off: the record is only a help */ } };
/** Forget the record (a new game). */
export function labClear() { history.length = 0; try { if (LAB_SIDE) localStorage.removeItem(recordKey(LAB_SIDE)); } catch { /* storage off */ } }
/** The game record as a file to save: the whole game (log included) and every action the computer took with its reason. */
export function labDownload(g: E.Game) {
  const rec = { kind: 'fab-computer-game-record', version: 1, saved: new Date().toISOString(), computer: LAB_SIDE, scenario: g.opts.scenario, game: g, computerActions: history };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(rec)], { type: 'application/json' }));
  a.download = `fab-computer-${LAB_SIDE}-turn${g.turn}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** The computer's turn to act now (in the Admin and Reinforcement Phases it waits until the other side is done). */
export const labTurn = (g: E.Game) => !!LAB_SIDE && !g.over && actors(g)[0] === LAB_SIDE;

/** If it is the computer's turn, think and then carry out its action through `act`; its battle rolls go through `roll`, the table's dice,
 *  and it waits while dice are on screen (`waiting`). */
export function labStep(game: () => E.Game, act: (f: () => void) => void, refresh: () => void, roll: () => void, waiting: () => boolean) {
  const g = game(); if (!LAB_SIDE || busy || waiting() || !labTurn(g)) return;
  seat ??= new Seat(LAB_SIDE, Object.fromEntries(E.sidesOf(g).map((s) => [s, Math.random().toString(36).slice(2)])) as Record<E.Side, string>, rng(Date.now() % 1e9));
  worker ??= new Worker(new URL('./lab-worker.ts', import.meta.url), { type: 'module' });
  busy = true; lab.thinking = true; refresh();
  const id = ++next, view = seat.view(g), s = seat, w = worker;
  const done = (a: Action | null, reason?: string | null) => {
    if (id !== next) return; next++;                                          // answered once only (the worker or the time limit)
    clearTimeout(timer); w.onmessage = null; if (reason) lab.reason = reason;
    if (a) note({ at: new Date().toISOString(), turn: g.turn, phasing: g.phasing, phase: g.phase, battle: g.battle ? `${g.battle.area} ${E.areas.get(g.battle.area)?.name} ${g.battle.stage}` : undefined, fn: a.fn, args: a.args.map((x) => (typeof x === 'string' ? s.real(x) : x)), reason: reason ?? undefined, timedOut: timedOut || undefined });
    setTimeout(() => { busy = false; lab.thinking = false; if (a && labTurn(game())) { if (a.fn === 'roll_step' && game().battle) roll(); else act(() => apply(game(), a, (x) => s.real(x))); } else refresh(); }, PACE_MS);   // the game the table holds now
  };
  let timedOut = false;
  const timer = setTimeout(() => { worker?.terminate(); worker = null; lab.fallback++; timedOut = true; done(doctrinePlayer()(view, LAB_SIDE)); }, TIMEOUT_MS);
  w.onmessage = (e) => done(e.data.action, e.data.reason);
  w.postMessage({ id, view, side: LAB_SIDE });
}
