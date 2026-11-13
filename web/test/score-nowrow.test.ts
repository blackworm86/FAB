import { describe, expect, it } from 'vitest';
import { nowRow } from '../src/score';

const bulge: [string, string][] = [
  ['4+ German VP', 'German Operational Victory'],
  ['2–3 German VP', 'German Marginal Victory'],
  ['0–1 German VP', 'Allied Marginal Victory'],
  ['1+ Allied VP', 'Allied Operational Victory'],
];
const golan: [string, string][] = [
  ['3+ Syrian VP', 'a'],
  ['1–2 Syrian VP', 'b'],
  ['0', 'Draw'],
  ['1–2 Israeli VP', 'c'],
  ['3+ Israeli VP', 'd'],
];
describe('nowRow: the victory-table row that holds now', () => {
  it('reads the Bulge table', () => {
    expect([5, 3, 2, 1, 0, -1, -11].map((n) => nowRow(bulge, n, 'German'))).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
  it('reads a table with a draw row', () => {
    expect([4, 1, 0, -2, -3].map((n) => nowRow(golan, n, 'Syrian'))).toEqual([0, 1, 2, 3, 4]);
  });
});
