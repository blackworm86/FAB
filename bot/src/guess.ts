// A guess of the full game from one seat's view: every hidden enemy block is given the details of one enemy unit
// the seat has not seen, drawn at random from the scenario's roster (the counter mix is public), with a likely strength.
// Plans are tried on several such guesses, so no plan relies on one guess (sampling the hidden information).
import * as E from '../../engine/src';
import type { Game, Side } from '../../engine/src';

export function guessFull(view: Game, seat: Side, r: () => number): Game {
  const g = structuredClone(view), enemy = E.other(seat), seen = new Set(g.units.map((u) => u.id));
  E.useGame(g.game ?? 'bulge');
  const pool = E.newGame(1, g.opts).units.filter((u) => u.side === enemy && !seen.has(u.id));
  for (const u of g.units) if (u.side === enemy && E.isPlaceholder(u) && pool.length) {
    const pick = pool.splice(Math.floor(r() * pool.length), 1)[0];
    Object.assign(u, E.secretOf(pick), { str: Math.max(1, Math.ceil(pick.max * (0.5 + 0.5 * r()))) });
  }
  return g;
}
