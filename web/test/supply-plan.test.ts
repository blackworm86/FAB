// Supply for planning: a destination inside an enemy ring is flagged, an open one is not; sources are where the trace ends.
import { describe, expect, it } from 'vitest';
import * as E from '../../engine/src';
import { noSupplyTargets, supplySources } from '../src/supply-plan';

describe('supply plan (The Bulge)', () => {
  E.useGame('bulge');
  const ring = () => {
    // St. Vith (23) encircled: every neighbour German, the 106th inside, cut off
    const g = E.newGame(7, { scenario: 'tournament' } as Partial<E.Opts>);
    const ge = g.units.filter((x) => x.side === 'german' && x.area != null && !x.garrison);
    (
      [
        [ge[0], 22],
        [ge[1], 24],
        [ge[2], 25],
        [ge[3], 24],
      ] as const
    ).forEach(([x, a]) => {
      x.area = a;
    }); // German blocks on the roads out, as in the approved mockup
    for (const a of [10, 11, 12, 22, 24, 25]) g.control[a] = 'german';
    const u = g.units.find((x) => x.id === 'B39')!;
    u.area = 23;
    g.control[23] = 'allied';
    g.phasing = 'allied';
    g.phase = 'movement';
    for (const x of g.units) x.moved = false;
    return g;
  };
  it('flags a move into the pocket, not a move out to friendly ground', () => {
    const g = ring(),
      al = g.units.find((x) => x.id === 'B44')!;
    al.area = 35;
    g.control[35] = 'allied';
    const opts = E.moveOptions(g, 'B44').map((o) => o.area);
    expect(opts).toContain(36);
    const bad = noSupplyTargets(g, 'B44', opts);
    expect(bad.has(36)).toBe(false); // Houffalize: Allied ground behind the line
    expect(E.inSupply(g, 'allied', 23)).toBe(false);
    for (const a of opts)
      expect(bad.has(a)).toBe(
        !(() => {
          const h = structuredClone(g);
          E.move(h, 'B44', a, true);
          return E.inSupply(h, 'allied', a);
        })(),
      );
  });
  it('a block already cut off sees which of its moves stay cut off', () => {
    const g = ring(),
      opts = E.moveOptions(g, 'B39').map((o) => o.area),
      bad = noSupplyTargets(g, 'B39', opts);
    expect(bad.has(12)).toBe(true); // Lutzkampen: German ground all round, as the mockup showed
    for (const a of opts)
      expect(bad.has(a)).toBe(
        !(() => {
          const h = structuredClone(g);
          E.move(h, 'B39', a, true);
          return E.inSupply(h, 'allied', a);
        })(),
      );
    expect(noSupplyTargets(g, 'nobody', opts).size).toBe(0);
  });
  it('sources are held areas where the trace ends at once', () => {
    const g = ring(),
      ids = E.areas ? [...E.areas.keys()] : [],
      src = supplySources(g, 'allied', ids);
    expect(src.length).toBeGreaterThan(0);
    for (const a of src) {
      expect(g.control[a]).toBe('allied');
      expect(E.supplyPath(g, 'allied', a)).toEqual([a]);
    }
    expect(src).not.toContain(23);
  });
});
