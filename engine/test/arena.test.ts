// The arena (ARENA=1): whole games between two levels of the computer player, both seatings, several seeds, every volume's tournament
// scenario. Prints wins and the mean net VP for the first-named level. ARENA_GAMES=n seeds (default 4), ARENA_PAIRS=hard:normal,normal:easy
// (default; 'ref' is the frozen first version in test/ai-ref.ts), ARENA_GAMES_LIST=bulge,golan73,sicily. Not run by default: it takes minutes.
import { describe, it } from 'vitest';
import * as E from '../src';
import type { Game, Side } from '../src';
import * as REF from './ai-ref';

const ENV: Record<string, string | undefined> = ((globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env) ?? {};
type Level = E.ai.Level | 'ref';
const nextOf = (g: Game, side: Side, l: Level) => (l === 'ref' ? REF.next(g, side, 'normal') : E.ai.next(g, side, l));
const SCEN: Record<string, string> = { bulge: 'tournament', golan73: 'badr', sicily: 'tournament' };
const SCEN_LAST = (game: string) => { E.useGame(game); return E.newGame(1, { scenario: SCEN[game] } as never).lastTurn; };

/** A whole game, side 1 at `l1`, side 2 at `l2`. */
export function match(game: string, scenario: string, seed: number, l1: Level, l2: Level, opts: Record<string, unknown> = {}) {
  E.useGame(game); E.setRandom(null);
  const g = E.newGame(seed, { scenario, ...opts } as never), [s1, s2] = E.sidesOf(g);
  let n = 0, idle = 0; const t0 = performance.now();
  while (!g.over) {
    if (++n > 8000) throw new Error(`${game}/${seed} ${l1}:${l2}: does not end at T${g.turn} ${g.phase}`);
    E.useGame(game); E.setPlayArea(g.inPlay);
    const a = nextOf(g, s1, l1) ?? nextOf(g, s2, l2);
    if (!a) { if (g.phase === 'deploy' && !g.units.some((u) => u.box === 'deploy')) { E.endPhase(g); continue; } if (++idle > 3) throw new Error(`${game}/${seed} ${l1}:${l2}: stuck at T${g.turn} ${g.phasing} ${g.phase} ${g.battle?.stage ?? ''}`); continue; }
    idle = 0; a.run(g);
  }
  const v = E.victory(g);
  return { g, net: v[s1] - v[s2], ms: performance.now() - t0, actions: n };
}
/** Who won, from the result text and the net VP: 1 = side 1, -1 = side 2, 0 = draw. */
export function winner(g: Game, net: number): number {
  const [s1, s2] = E.sidesOf(g), N = E.VOLUME.sideName, t = g.over ?? '';
  if (/draw/i.test(t)) return 0;
  if (t.includes(N[s1])) return 1; if (t.includes(N[s2])) return -1;
  return net > 0 ? 1 : net < 0 ? -1 : 0;
}

describe.skipIf(!ENV.ARENA)('arena', () => {
  E.ai.BUDGET.ms = Infinity;                                                                          // full strength, the same on any machine      // skipped, not absent, without ARENA: a test file with no suite fails the run (and the deploy)
  if (ENV.ARENA_PLAN) E.ai.TUNE.plan = ENV.ARENA_PLAN === '1'; if (ENV.ARENA_SIMS) Object.assign(E.ai.SIMS, JSON.parse(ENV.ARENA_SIMS)); if (ENV.ARENA_TUNE) { Object.assign(E.ai.TUNE, JSON.parse(ENV.ARENA_TUNE)); console.log('TUNE', JSON.stringify(E.ai.TUNE)); }
  const games = (ENV.ARENA_GAMES_LIST ?? 'bulge,golan73,sicily').split(','), N = +(ENV.ARENA_GAMES ?? 4);
  const pairs = (ENV.ARENA_PAIRS ?? 'hard:normal,normal:easy').split(',').map((p) => p.split(':') as [Level, Level]);
  for (const [A, B] of pairs) for (const game of games) it(`${game}: ${A} vs ${B}`, () => {
    let wins = 0, losses = 0, draws = 0, net = 0, ms = 0; const bySeat: Record<string, number[]> = { first: [], second: [] }, ends: Record<string, number[]> = { first: [], second: [] };
    for (let seed = 1; seed <= N; seed++) for (const first of [true, false]) {
      const r = first ? match(game, SCEN[game], seed, A, B) : match(game, SCEN[game], seed, B, A);
      const w = winner(r.g, r.net) * (first ? 1 : -1); if (w > 0) wins++; else if (w < 0) losses++; else draws++;
      const mine = r.net * (first ? 1 : -1); net += mine; ms += r.ms; bySeat[first ? 'first' : 'second'].push(mine); ends[first ? 'first' : 'second'].push(r.g.turn);
    }
    const n = 2 * N, mean = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2);
    console.log(`${game.padEnd(8)} ${A} vs ${B}: ${A} wins ${wins}/${n} (losses ${losses}, draws ${draws}), mean net VP for ${A} ${(net / n).toFixed(2)} [as first player ${mean(bySeat.first)}: ${bySeat.first.join(' ')}; as second ${mean(bySeat.second)}: ${bySeat.second.join(' ')}]; game ends on turn: ${A} first ${mean(ends.first)}, ${A} second ${mean(ends.second)} (of ${SCEN_LAST(game)}), ${(ms / n / 1000).toFixed(1)} s per game`);   // a game cut short by sudden death shows the level when the margin cannot
  }, 3_600_000);
});
