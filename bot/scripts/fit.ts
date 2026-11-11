// The learned judge: a logistic model of "the Germans win" over the facts of features.ts, fitted on the recorded
// games (npm run record) and checked on games it has never seen (one game in five, by seed).
//   npm run fit      (writes src/judge-bulge-tournament.json)
import { readFileSync, writeFileSync } from 'node:fs';
import * as E from '../../engine/src';
import { features } from '../src/features';

type Rec = { seed: number; winner: string | null; rows: { turn: number; x: number[] }[] };
const games: Rec[] = readFileSync('records/bulge-tournament.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
E.useGame('bulge'); const names = Object.keys(features(E.newGame(1, { scenario: 'tournament' }), 'german'));
const label = (g: Rec) => (g.winner === 'german' ? 1 : g.winner == null ? 0.5 : 0);
const test = games.filter((g) => g.seed % 5 === 0), train = games.filter((g) => g.seed % 5 !== 0);
const sig = (z: number) => 1 / (1 + Math.exp(-z));

/** Logistic regression with a small L2 penalty, standardised inputs, Adam steps. Returns a predictor. */
function fit(cols: number[]) {
  const X = train.flatMap((g) => g.rows.map((r) => cols.map((c) => r.x[c]))), y = train.flatMap((g) => g.rows.map(() => label(g)));
  const mean = cols.map((_, j) => X.reduce((t, r) => t + r[j], 0) / X.length);
  const sd = cols.map((_, j) => Math.sqrt(X.reduce((t, r) => t + (r[j] - mean[j]) ** 2, 0) / X.length) || 1);
  const Z = X.map((r) => r.map((v, j) => (v - mean[j]) / sd[j])), w = cols.map(() => 0), m = [...w, 0], s2 = [...w, 0]; let b = 0;
  for (let it = 1; it <= 400; it++) {
    const gr = [...w.map((wj) => 1e-3 * wj), 0];
    for (let i = 0; i < Z.length; i++) { const e = sig(b + Z[i].reduce((t, v, j) => t + v * w[j], 0)) - y[i]; for (let j = 0; j < w.length; j++) gr[j] += (e * Z[i][j]) / Z.length; gr[w.length] += e / Z.length; }
    for (let j = 0; j <= w.length; j++) { m[j] = 0.9 * m[j] + 0.1 * gr[j]; s2[j] = 0.999 * s2[j] + 0.001 * gr[j] ** 2; const st = (0.05 * m[j] / (1 - 0.9 ** it)) / (Math.sqrt(s2[j] / (1 - 0.999 ** it)) + 1e-8); if (j < w.length) w[j] -= st; else b -= st; }
  }
  return { cols, mean, sd, w, b, p: (x: number[]) => sig(b + cols.reduce((t, c, j) => t + ((x[c] - mean[j]) / sd[j]) * w[j], 0)) };
}

const base = train.reduce((t, g) => t + label(g) * g.rows.length, 0) / train.reduce((t, g) => t + g.rows.length, 0);
const all = names.map((_, i) => i), judge = fit(all), vpOnly = fit(['vpNet', 'turnsLeft', 'suddenDeathGapGerman', 'suddenDeathGapAllied'].map((n) => names.indexOf(n)));
const loss = (p: number, y: number) => -(y * Math.log(Math.max(p, 1e-6)) + (1 - y) * Math.log(Math.max(1 - p, 1e-6)));
/** Per unseen game: mean log loss and share of positions where the favourite won (draws left out). */
const perGame = (p: (x: number[]) => number) => test.map((g) => { const y = label(g), ps = g.rows.map((r) => p(r.x));
  return { loss: ps.reduce((t, q) => t + loss(q, y), 0) / ps.length, right: y === 0.5 ? NaN : ps.filter((q) => (q > 0.5) === (y === 1)).length / ps.length, early: y === 0.5 ? NaN : +((p(g.rows[0].x) > 0.5) === (y === 1)) }; });
const meanMargin = (xs: number[]) => { xs = xs.filter((x) => !Number.isNaN(x)); const m = xs.reduce((a, b) => a + b, 0) / xs.length, sd = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1)); return `${m.toFixed(3)} ± ${(1.96 * sd / Math.sqrt(xs.length)).toFixed(3)}`; };
const decided = test.filter((g) => g.winner), testRate = decided.filter((g) => g.winner === 'german').length / decided.length, majority = Math.max(testRate, 1 - testRate);   // always naming the side that won most unseen games
const J = perGame(judge.p), V = perGame(vpOnly.p), B = perGame(() => base);
const byTurn = Object.fromEntries([1, 2, 3, 4, 5].map((t) => { const rows = test.flatMap((g) => g.rows.filter((r) => r.turn === t).map((r) => ({ y: label(g), p: judge.p(r.x), v: vpOnly.p(r.x) }))).filter((r) => r.y !== 0.5);
  return [`turn ${t}`, { judge: `${Math.round(100 * rows.filter((r) => (r.p > 0.5) === (r.y === 1)).length / rows.length)}%`, vpOnly: `${Math.round(100 * rows.filter((r) => (r.v > 0.5) === (r.y === 1)).length / rows.length)}%`, chance: `${Math.round(100 * majority)}%` }]; }));
const report = {
  games: { train: train.length, test: test.length }, positions: { train: train.reduce((t, g) => t + g.rows.length, 0), test: test.reduce((t, g) => t + g.rows.length, 0) }, germanWinRate: { train: +base.toFixed(3), unseen: +testRate.toFixed(3) },
  unseenGames: { logLoss: { judge: meanMargin(J.map((x) => x.loss)), vpOnly: meanMargin(V.map((x) => x.loss)), chance: meanMargin(B.map((x) => x.loss)) },
    lossGainOverChance: meanMargin(J.map((x, i) => B[i].loss - x.loss)), lossGainOverVpOnly: meanMargin(J.map((x, i) => V[i].loss - x.loss)),
    favouriteWins: { judge: meanMargin(J.map((x) => x.right)), vpOnly: meanMargin(V.map((x) => x.right)), chance: majority.toFixed(3) },
    fromTheFirstPosition: { judge: meanMargin(J.map((x) => x.early)), vpOnly: meanMargin(V.map((x) => x.early)) }, byTurn },
  strongestFacts: names.map((n, j) => [n, +judge.w[j].toFixed(3)] as const).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 12),
};
writeFileSync('src/judge-bulge-tournament.json', JSON.stringify({ names, mean: judge.mean.map((x) => +x.toFixed(4)), sd: judge.sd.map((x) => +x.toFixed(4)), w: judge.w.map((x) => +x.toFixed(4)), b: +judge.b.toFixed(4), report }, null, 1) + '\n');
console.log(JSON.stringify(report, null, 1));
