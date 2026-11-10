// The table for computer games: it keeps the real game, shows each player only its seat's view, carries out the
// chosen action and checks it. A game that cannot go on (no legal action, or too many actions) is reported as stuck.
import * as E from '../../engine/src';
import type { Game, Side } from '../../engine/src';
import { actors, apply, type Action } from './actions';
import { Seat } from './view';
import { rng, type Player } from './random';

export interface MatchResult { seed: number; winner: Side | null; result: string | null; net: number; turns: number; actions: number; refused: number; refusedBy: Record<string, number>; stuck: string | null; counts: Record<string, number>; ms: number }
export interface MatchOpts { scenario?: string; opts?: Record<string, unknown>; maxActions?: number; maxRefused?: number }

export function playMatch(seed: number, players: Record<string, Player>, o: MatchOpts = {}): MatchResult {
  const t0 = performance.now();
  E.useGame('bulge'); E.setRandom(null);
  const g: Game = E.newGame(seed, { scenario: o.scenario ?? 'tournament', ...(o.opts ?? {}) } as never);
  const r = rng(seed ^ 0x5eed), salt = () => Math.floor(r() * 2 ** 31).toString(36);
  const sides = E.sidesOf(g), salts = Object.fromEntries(sides.map((s) => [s, salt()])) as Record<Side, string>;
  const seats = Object.fromEntries(sides.map((s) => [s, new Seat(s, salts, rng(seed * 31 + s.length))])) as Record<Side, Seat>;
  const counts: Record<string, number> = {}, refusedBy: Record<string, number> = {};
  let actions = 0, refused = 0, stuck: string | null = null;
  const max = o.maxActions ?? 30000, maxRefused = o.maxRefused ?? 200;
  while (!g.over && !stuck) {
    const who = actors(g); if (!who.length) { stuck = 'nobody may act'; break; }
    const side = who[0], seat = seats[side];
    const a: Action | null = players[side](seat.view(g), side);
    if (!a) { stuck = `${side} has no legal action (T${g.turn} ${g.phasing} ${g.phase}${g.battle ? ' battle ' + g.battle.stage : ''})`; break; }
    const prev = structuredClone(g);
    try { apply(g, a, (id) => seat.real(id)); }
    catch (e) {                                   // legal in the view, refused by the real game: put the game back
      Object.keys(g).forEach((k) => delete (g as unknown as Record<string, unknown>)[k]); Object.assign(g, prev);
      refusedBy[a.fn] = (refusedBy[a.fn] ?? 0) + 1;
      if (++refused > maxRefused) stuck = `too many refused actions, last ${a.fn}: ${(e as Error).message}`;
      continue;
    }
    const flags = E.auditChange(prev, g, side); if (flags.length) { stuck = `${a.fn} by ${side} flagged: ${flags.join(' | ')}`; break; }
    counts[a.fn] = (counts[a.fn] ?? 0) + 1;
    if (++actions > max) stuck = 'too many actions: the game does not end';
  }
  const v = E.victory(g);
  return { seed, winner: sides.find((x) => g.over?.toLowerCase().includes(x)) ?? null, result: g.over ?? null, net: v.net, turns: g.turn, actions, refused, refusedBy, stuck, counts, ms: performance.now() - t0 };
}
