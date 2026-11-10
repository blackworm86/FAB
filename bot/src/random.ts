// The random player: a yardstick and a test of the action list. It picks a kind of action at random
// (moving, a battle, a chit play, ending the phase, ...), then one legal action of that kind.
import type { Game, Side } from '../../engine/src';
import { candidates, isLegal, type Action } from './actions';

export type Player = (view: Game, side: Side) => Action | null;
export const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ENDS = new Set(['endPhase', 'setDone']);

export function randomPlayer(seed: number, endWeight = 0.3): Player {
  const r = rng(seed);
  return (view, side) => {
    const groups = new Map<string, Action[]>();
    for (const a of candidates(view, side)) { const k = a.fn; groups.set(k, [...(groups.get(k) ?? []), a]); }
    const kinds = [...groups.keys()];
    while (kinds.length) {
      const w = kinds.map((k) => (ENDS.has(k) ? endWeight : 1)), tot = w.reduce((x, y) => x + y, 0);
      let x = r() * tot, i = 0; while (x >= w[i] && i < kinds.length - 1) x -= w[i++];
      const list = groups.get(kinds[i])!;
      for (let tries = 0; tries < 40 && list.length; tries++) { const a = list.splice(Math.floor(r() * list.length), 1)[0]; if (isLegal(view, a)) return a; }
      kinds.splice(i, 1);
    }
    return null;
  };
}
