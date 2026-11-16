import { describe, expect, it } from 'vitest';
import * as E from '../../engine/src';
import { snap, diffFx } from '../src/fx';

describe('battle pop-ups', () => {
  it('a block moving into the battle reinforces; one moving out retreats', () => {
    const g = E.newGame(undefined, { scenario: 'campaign', fuel: true }),
      a = E.mustFight(g)[0];
    E.startBattle(g, a);
    const u = g.units.find((u) => u.side === 'allied' && u.area != null && u.area !== a && !u.garrison)!;
    const before = snap(g);
    u.area = a;
    expect(diffFx(before, g).find((f) => f.unit === u.id)?.head).toBe('REINFORCES');
    const v = E.unitsIn(g, a, 'allied').find((x) => x.id !== u.id)!,
      back = snap(g);
    v.area = before.u.get(u.id)!.area!;
    expect(diffFx(back, g).find((f) => f.unit === v.id)?.head).toBe('RETREATS');
  });

  it('a pop-up for a unit with no area, or an area with no spot on the map, is left out instead of naming area 0', () => {
    const g = E.newGame(undefined, { scenario: 'campaign', fuel: true }),
      u = g.units.find((x) => x.area != null && !x.garrison)!,
      before = snap(g);
    u.str = Math.max(0, u.str - 1);
    u.area = null; // gone from the map and hurt: the old fallback named area 0
    for (const f of diffFx(before, g)) expect(E.areas.has(f.area)).toBe(true);
    const g2 = E.newGame(undefined, { scenario: 'campaign', fuel: true }),
      b2 = snap(g2);
    const v = g2.units.find((x) => x.area != null && !x.garrison)!;
    v.area = 9999; // a box id the map does not know
    for (const f of diffFx(b2, g2)) expect(E.areas.has(f.area)).toBe(true);
  });
});
