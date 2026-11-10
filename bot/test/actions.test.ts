import { describe, expect, it } from 'vitest';
import * as E from '../../engine/src';
import { actors, apply, legalActions } from '../src/actions';
import { Seat } from '../src/view';
import { playMatch } from '../src/match';
import { randomPlayer, rng } from '../src/random';

describe('the list of legal actions', () => {
  it('at the start of The Bulge the Germans may fight, and every listed action works on the real game', () => {
    E.useGame('bulge'); const g = E.newGame(3, { scenario: 'tournament' }), side = actors(g)[0];
    const s = new Seat(side, { german: 'a', allied: 'b' }, rng(2)), list = legalActions(s.view(g), side);
    expect(list.some((a) => a.fn === 'startBattle')).toBe(true);
    for (const a of list) expect(() => apply(structuredClone(g), a, (id) => s.real(id))).not.toThrow();
  });
  it('the other side has nothing to do while it is not its turn', () => {
    E.useGame('bulge'); const g = E.newGame(3, { scenario: 'tournament' }), idle = E.other(actors(g)[0]);
    expect(legalActions(g, idle)).toEqual([]);
  });
});

describe('random players', () => {
  for (const [seed, scenario] of [[1, 'intro'], [2, 'tournament'], [3, 'cold']] as const) it(`finish a ${scenario} game without getting stuck`, () => {
    const r = playMatch(seed, { german: randomPlayer(seed), allied: randomPlayer(seed + 100) }, { scenario });
    expect(r.stuck).toBeNull(); expect(r.result).toBeTruthy();
  }, 120_000);
});
