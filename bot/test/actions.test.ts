import { describe, expect, it } from 'vitest';
import * as E from '../../engine/src';
import { actors, apply, legalActions } from '../src/actions';
import { Seat } from '../src/view';
import { playMatch } from '../src/match';
import { randomPlayer, rng } from '../src/random';
import { doctrinePlayer } from '../src/doctrine';

describe('the list of legal actions', () => {
  it('at the start of The Bulge the Germans may fight, and every listed action works on the real game', () => {
    E.useGame('bulge');
    const g = E.newGame(3, { scenario: 'tournament' }),
      side = actors(g)[0];
    const s = new Seat(side, { german: 'a', allied: 'b' }, rng(2)),
      list = legalActions(s.view(g), side);
    expect(list.some((a) => a.fn === 'startBattle')).toBe(true);
    for (const a of list) expect(() => apply(structuredClone(g), a, (id) => s.real(id))).not.toThrow();
  });
  it('the other side has nothing to do while it is not its turn', () => {
    E.useGame('bulge');
    const g = E.newGame(3, { scenario: 'tournament' }),
      idle = E.other(actors(g)[0]);
    expect(legalActions(g, idle)).toEqual([]);
  });
});

describe('random players', () => {
  for (const [seed, scenario] of [
    [1, 'intro'],
    [2, 'tournament'],
    [3, 'cold'],
  ] as const)
    it(`finish a ${scenario} game without getting stuck`, () => {
      const r = playMatch(seed, { german: randomPlayer(seed), allied: randomPlayer(seed + 100) }, { scenario });
      expect(r.stuck).toBeNull();
      expect(r.result).toBeTruthy();
    }, 120_000);
});

describe('the doctrine player', () => {
  it('finishes a game from either seat and never gets an action refused by the table', () => {
    for (const [german, allied] of [
      [doctrinePlayer(), randomPlayer(5)],
      [randomPlayer(6), doctrinePlayer()],
    ]) {
      const r = playMatch(4, { german, allied }, { scenario: 'intro' });
      expect(r.stuck).toBeNull();
      expect(r.refused).toBe(0);
    }
  }, 120_000);
});

describe('the learned judge', () => {
  it('gives a chance between 0 and 1 from either seat, and the two sides add up to 1', async () => {
    const { winChance } = await import('../src/judge');
    E.useGame('bulge');
    const g = E.newGame(2, { scenario: 'tournament' });
    for (const seat of ['german', 'allied'] as const) {
      const v = new Seat(seat, { german: 'a', allied: 'b' }, rng(3)).view(g),
        p = winChance(v, seat, 'german');
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
      expect(p + winChance(v, seat, 'allied')).toBeCloseTo(1);
    }
  });
});
