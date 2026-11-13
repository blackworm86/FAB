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
});
