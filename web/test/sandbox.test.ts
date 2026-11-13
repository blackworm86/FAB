// The rules checklist's links: a fresh game set up on a turn, phase, chits and an open battle.
import { describe, expect, it } from 'vitest';
import * as E from '../../engine/src';
import { preset } from '../src/sandbox';

const make = (game: string, q: string, opts: Partial<E.Opts> = {}) => {
  E.useGame(game);
  return preset(E.newGame(7, opts), new URLSearchParams(q));
};
describe('sandbox preset', () => {
  for (const [game, scenario] of [
    ['bulge', 'tournament'],
    ['sicily', 'tournament'],
    ['golan73', 'badr'],
    ['golan73', 'nafakh'],
    ['sicily', 'campaign'],
  ] as const)
    it(`${game} ${scenario}: set up, a battle opens in the Combat Phase`, () => {
      const g = make(game, 'battle=1&case=6.2', { scenario } as Partial<E.Opts>);
      expect(g.phase).toBe('combat');
      expect(g.battle?.stage).toBe('setup');
      expect(g.log.at(-1)).toMatch(/test: 6.2/);
    });
  it('turn, side, phase and chits', () => {
    const g = make('golan73', 'at=3.israeli.admin&chits=event_ew,syrian:sam');
    expect([g.turn, g.phasing, g.phase]).toEqual([3, 'israeli', 'admin']);
    for (const s of ['israeli', 'syrian'])
      expect(g.chits.some((c) => c.side === s && c.kind === 'event_ew' && c.box === 'available')).toBe(true);
    expect(g.chits.some((c) => c.kind === 'sam' && c.box === 'available')).toBe(true);
  });
});
