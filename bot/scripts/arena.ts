// The measuring tool: player A against player B on paired seeds, from both seats, with margins of error.
//   npm run arena -- doctrine random 200 [scenario]
// Each seed is played three times with the same dice seed: A as German vs B, B as German vs A, and B against itself.
// A's result in a seat is compared with B's own result in that seat on the same seed (the paired difference),
// so "A beats B from the German seat" means: A as German does better against B than B as German does against B.
import { playMatch, type MatchResult } from '../src/match';
import { PLAYERS } from '../src/players';
import { onAllCores } from './pool';

const args = process.argv.slice(2).filter((a) => a !== '--');
const win = (r: MatchResult, s: string) => (r.stuck ? NaN : r.winner === s ? 1 : r.winner == null ? 0.5 : 0);
type Row = { seed: number; ab: MatchResult; ba: MatchResult; bb: MatchResult };

if (args[0] === 'worker') {
  const [, from, to] = args.slice(0, 3).map(Number),
    [A, B, scenario] = args.slice(3);
  for (let seed = from; seed < to; seed++) {
    const play = (g: string, a: string) => playMatch(seed, { german: PLAYERS[g](seed), allied: PLAYERS[a](seed + 7) }, { scenario });
    process.stdout.write(JSON.stringify({ seed, ab: play(A, B), ba: play(B, A), bb: play(B, B) }) + '\n');
  }
} else {
  const [A, B = 'random', n = '200', scenario = 'tournament'] = args,
    t0 = Date.now();
  if (!PLAYERS[A] || !PLAYERS[B]) throw new Error(`players: ${Object.keys(PLAYERS).join(', ')}`);
  const rows = await onAllCores<Row>('scripts/arena.ts', +n, [A, B, scenario]);
  const stuck = rows.flatMap((r) => [r.ab, r.ba, r.bb]).filter((m) => m.stuck);
  /** Mean of the paired differences with its 95% margin. */
  const paired = (xs: number[]) => {
    const m = xs.reduce((a, b) => a + b, 0) / xs.length,
      sd = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
    return { mean: +m.toFixed(3), margin: +((1.96 * sd) / Math.sqrt(xs.length)).toFixed(3) };
  };
  const pct = (xs: number[]) => `${Math.round((100 * xs.reduce((a, b) => a + b, 0)) / xs.length)}%`;
  const seat = (s: 'german' | 'allied') => {
    const a = rows.map((r) => (s === 'german' ? r.ab : r.ba)),
      base = rows.map((r) => r.bb),
      sign = s === 'german' ? 1 : -1;
    const wins = paired(a.map((m, i) => win(m, s) - win(base[i], s))),
      vp = paired(a.map((m, i) => sign * (m.net - base[i].net)));
    return {
      [`${A} wins`]: pct(a.map((m) => win(m, s))),
      [`${B} wins (against itself)`]: pct(base.map((m) => win(m, s))),
      winDifference: wins,
      vpDifference: vp,
      verdict:
        wins.mean - wins.margin > 0 || (vp.mean - vp.margin > 0 && wins.mean >= 0)
          ? `${A} is better`
          : wins.mean + wins.margin < 0 || vp.mean + vp.margin < 0
            ? `${B} is better`
            : 'no clear difference',
    };
  };
  const thinkOf = (name: string) => {
    const ms = rows
      .flatMap(
        (r) =>
          [
            [r.ab, 'german', A],
            [r.ab, 'allied', B],
            [r.ba, 'german', B],
            [r.ba, 'allied', A],
          ] as const,
      )
      .filter(([, , p]) => p === name)
      .map(([m, s]) => m.think[s]);
    const n = ms.reduce((t, x) => t + x.n, 0);
    return { meanMs: +(ms.reduce((t, x) => t + x.ms, 0) / n).toFixed(1), maxMs: Math.round(Math.max(...ms.map((x) => x.max))) };
  };
  console.log(
    JSON.stringify(
      {
        A,
        B,
        scenario,
        seeds: rows.length,
        games: rows.length * 3,
        stuck: stuck.length,
        asGerman: seat('german'),
        asAllied: seat('allied'),
        thinking: { [A]: thinkOf(A), [B]: thinkOf(B) },
        minutes: +((Date.now() - t0) / 60000).toFixed(1),
      },
      null,
      1,
    ),
  );
}
