import { describe, expect, it } from 'vitest';
import * as E from '../../engine/src';
import { clean } from '../src/store-clean';

describe('game data from the database cannot carry HTML', () => {
  it('tags and attribute quotes are taken out of every text and key, at any depth', () => {
    const bad = {
      units: [{ id: 'B01"onclick="x', cls: '<img src=x onerror=alert(1)>', str: 3, q: ['green`'] }],
      control: { '<b>': 'german' },
    };
    const out = JSON.stringify(clean(bad)).replace(/\\"|"/g, ''); // the JSON's own quotes aside
    expect(out).not.toMatch(/[<>`"]/);
    expect(clean(bad).units[0].str).toBe(3);
  });
  it('an honest game of each volume is left exactly as it is', () => {
    for (const id of ['bulge', 'sicily', 'golan73']) {
      E.useGame(id);
      const g = E.newGame(3);
      expect(clean(g)).toEqual(JSON.parse(JSON.stringify(g)));
    }
    E.useGame('bulge');
  });
});
