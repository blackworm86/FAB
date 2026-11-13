// Recorded games for the learned judge: varied players on The Bulge Tournament, the facts of every phase start from
// both seats, and who won.   npm run record -- 3000      (writes records/bulge-tournament.jsonl, not committed)
import { mkdirSync, writeFileSync } from 'node:fs';
import { features } from '../src/features';
import { playMatch } from '../src/match';
import { PLAYERS } from '../src/players';
import { rng } from '../src/random';
import { onAllCores } from './pool';

// Each seat its own mix, so that both sides win often enough to learn from (random Germans almost never win, doctrine Allies almost always do).
const MIX = {
  german: ['commander', 'doctrine', 'doctrine-10', 'doctrine-30'],
  allied: ['commander', 'random', 'random', 'doctrine-60', 'doctrine-30', 'doctrine'],
}; // round 2: the commander's own games too
type Game = { seed: number; german: string; allied: string; winner: string | null; rows: { turn: number; seat: string; x: number[] }[] }; // x: the values of features(), in its order

const args = process.argv.slice(2).filter((a) => a !== '--');
if (args[0] === 'worker') {
  const [, from, to] = args.map(Number);
  for (let seed = from; seed < to; seed++) {
    const r = rng(seed * 13),
      german = MIX.german[Math.floor(r() * MIX.german.length)],
      allied = MIX.allied[Math.floor(r() * MIX.allied.length)],
      rows: Game['rows'] = [];
    const m = playMatch(
      seed,
      { german: PLAYERS[german](seed), allied: PLAYERS[allied](seed + 5) },
      { scenario: 'tournament', sample: (v, seat) => rows.push({ turn: v.turn, seat, x: Object.values(features(v, seat)) }) },
    );
    if (!m.stuck) process.stdout.write(JSON.stringify({ seed, german, allied, winner: m.winner, rows }) + '\n');
  }
} else {
  const n = +(args[0] ?? 100),
    t0 = Date.now(),
    games = await onAllCores<Game>('scripts/record.ts', n);
  mkdirSync('records', { recursive: true });
  writeFileSync('records/bulge-tournament.jsonl', games.map((x) => JSON.stringify(x)).join('\n') + '\n');
  console.log(
    `${games.length} games, ${games.reduce((t, x) => t + x.rows.length, 0)} positions, ${((Date.now() - t0) / 60000).toFixed(1)} minutes`,
  );
}
