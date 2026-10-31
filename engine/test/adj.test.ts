import { describe, expect, it } from 'vitest';
import { newGame, moveOptions, areas, neighbors, connection, blocks } from '../src';
describe('exploitation moves (7.31)', () => {
  it('reach every adjacent area they could legally enter, whichever way is cheaper', () => {
    const g = newGame(5); g.phase = 'btMove'; g.phasing = 'german';
    const ger = g.units.find((u) => u.side === 'german' && !u.garrison && u.cls === 'armor')!;
    g.units.forEach((u) => { if (u !== ger) u.area = null; });
    ger.exploit = true; ger.moved = false; ger.reserve = null; ger.disorder = 0; ger.unsupplied = false;
    let checked = 0;
    for (const a of areas.keys()) {
      ger.area = a; const got = new Set(moveOptions(g, ger.id).map((o) => o.area));
      for (const n of neighbors(a)) { const c = connection(a, n)!; if (c.restricted || g.blown.includes(a < n ? `${a}-${n}` : `${n}-${a}`)) continue; checked++; expect(got.has(n), `${a} -> ${n}`).toBe(true); }
    }
    expect(checked).toBeGreaterThan(100);
  });
});
