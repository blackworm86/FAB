// Random against random for The Bulge, over every scenario and a few optional-rule mixes, split over the processor's cores.
// Stage 2 test of docs/COMPUTER-PLAYER-PLAN.md: every game must reach its end without getting stuck.
//   npm run random -- 1000            (games; default 100)
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { playMatch, type MatchResult } from '../src/match';
import { randomPlayer } from '../src/random';

export const MIXES: { scenario: string; opts: Record<string, unknown> }[] = [
  { scenario: 'tournament', opts: {} }, { scenario: 'campaign', opts: {} }, { scenario: 'intro', opts: {} }, { scenario: 'cold', opts: {} },
  { scenario: 'tournament', opts: { bridgeLimit: true, bid: 2, peiper: true, pz150: true, airborne: true, advArty: true, overrun: true, fwMaintain: true, randomReinf: true } },
  { scenario: 'campaign', opts: { fuel: false, overrun: true, randomReinf: true } },
];
export const gameOf = (seed: number) => ({ seed, ...MIXES[seed % MIXES.length] });

const args = process.argv.slice(2).filter((a) => a !== '--');
if (args[0] === 'worker') {
  const [, from, to] = args.map(Number);
  for (let seed = from; seed < to; seed++) {
    const m = gameOf(seed);
    const r = playMatch(seed, { german: randomPlayer(seed * 2), allied: randomPlayer(seed * 2 + 1) }, { scenario: m.scenario, opts: m.opts });
    process.stdout.write(JSON.stringify({ ...r, scenario: m.scenario, mix: seed % MIXES.length }) + '\n');
  }
} else {
  const n = +(args[0] ?? 100), k = Math.min(cpus().length, n), per = Math.ceil(n / k), t0 = Date.now();
  const results: (MatchResult & { scenario: string })[] = [];
  await Promise.all(Array.from({ length: k }, (_, i) => new Promise<void>((done) => {
    const p = spawn('npx', ['vite-node', 'scripts/random-games.ts', '--', 'worker', String(1 + i * per), String(1 + Math.min(n, (i + 1) * per))], { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '';
    p.stdout.on('data', (d) => { buf += d; const lines = buf.split('\n'); buf = lines.pop()!; for (const l of lines) if (l.startsWith('{')) { results.push(JSON.parse(l)); if (results.length % 50 === 0) console.error(`${results.length}/${n} games`); } });
    p.on('close', () => done());
  })));
  const stuck = results.filter((r) => r.stuck), sum = (f: (r: MatchResult) => number) => results.reduce((x, r) => x + f(r), 0);
  const used: Record<string, number> = {}, refused: Record<string, number> = {};
  for (const r of results) { for (const [k, v] of Object.entries(r.counts)) used[k] = (used[k] ?? 0) + v; for (const [k, v] of Object.entries(r.refusedBy)) refused[k] = (refused[k] ?? 0) + v; }
  const byScen: Record<string, Record<string, number>> = {};
  for (const r of results) { const b = (byScen[r.scenario] ??= {}); const k = r.stuck ? 'stuck' : r.winner ?? 'draw'; b[k] = (b[k] ?? 0) + 1; }
  console.log(JSON.stringify({
    games: results.length, finished: results.length - stuck.length, stuck: stuck.map((r) => `seed ${r.seed} ${r.scenario}: ${r.stuck}`),
    byScenario: byScen, avgTurns: +(sum((r) => r.turns) / results.length).toFixed(1), avgActions: Math.round(sum((r) => r.actions) / results.length),
    refusedActions: sum((r) => r.refused), refused, actionsUsed: used, minutes: +((Date.now() - t0) / 60000).toFixed(1),
  }, null, 1));
  if (results.length < n || stuck.length) process.exitCode = 1;
}
