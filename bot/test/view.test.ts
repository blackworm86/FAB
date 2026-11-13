import { describe, expect, it } from 'vitest';
import * as E from '../../engine/src';
import { Seat } from '../src/view';
import { rng } from '../src/random';

const game = () => {
  E.useGame('bulge');
  return E.newGame(5, { scenario: 'tournament' });
};
const seat = (s: E.Side) => new Seat(s, { german: 'saltG', allied: 'saltA' }, rng(1));

describe('the computer sees only what a player in its seat sees', () => {
  it('hidden enemy blocks are blank, under ids that are not their real ones', () => {
    const g = game(),
      v = seat('allied').view(g),
      json = JSON.stringify(v);
    const hidden = g.units.filter((u) => u.side === 'german' && !E.visibleTo(g, u, 'spectator'));
    expect(hidden.length).toBeGreaterThan(5);
    for (const u of hidden) expect(json.includes(`"${u.id}"`)).toBe(false);
    expect(v.units.filter((u) => E.isPlaceholder(u)).length).toBe(hidden.length);
  });
  it('its own blocks are complete, and the dice cannot be foreseen', () => {
    const g = game(),
      v = seat('german').view(g);
    for (const u of g.units.filter((x) => x.side === 'german')) expect(v.units.find((x) => x.id === u.id)).toEqual(u);
    expect(v.seed).not.toBe(g.seed);
  });
  it('the table translates a hidden block back to the real one', () => {
    const g = game(),
      s = seat('allied'),
      v = s.view(g);
    for (const p of v.units.filter((u) => E.isPlaceholder(u))) {
      const real = g.units.find((u) => u.id === s.real(p.id))!;
      expect(real.side).toBe('german');
      expect(real.area).toBe(p.area);
    }
  });
  it('a block shown in battle and hidden again gets a new id (it cannot be followed)', () => {
    const g = game(),
      s = seat('allied'),
      u = g.units.find((x) => x.side === 'german' && x.area != null && !E.visibleTo(g, x, 'spectator'))!;
    const before = s.view(g).units.find((x) => s.real(x.id) === u.id)!.id;
    u.up = u.area ?? undefined;
    expect(s.view(g).units.find((x) => x.id === u.id)?.name).toBe(u.name);
    u.up = undefined;
    const after = s.view(g).units.find((x) => s.real(x.id) === u.id)!.id;
    expect(after).not.toBe(before);
    expect(after).not.toBe(u.id);
  });
});
