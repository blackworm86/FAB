// The Bulge plays the latest series rules (Golan '73 rulebook, 2016) where they differ from its own book: 9.31c and 9.33d.
import { describe, expect, it } from 'vitest';
import * as E from '../src';
import { newGolanGame } from './golan-helpers';

describe('latest series rules in The Bulge and Golan', () => {
  it('9.31: a supply path may pass a vacant friendly area next to uncontested enemy units (The Bulge\'s old 9.31c is gone)', () => {
    E.useGame('bulge'); const g = E.newGame(3); E.useGame('bulge');
    const src = [...E.VOLUMES.bulge.sources(g, 'german')];
    let found = false;
    for (const s of src) for (const v of E.neighbors(s)) for (const start of E.neighbors(v)) {
      if (found || start === s || E.neighbors(start).includes(s)) continue;
      const x = E.neighbors(v).find((n) => n !== s && n !== start && !E.neighbors(start).includes(n) && !E.neighbors(s).includes(n)); if (x == null) continue;
      for (const a of E.areas.keys()) g.control[a] = 'allied';
      for (const u of g.units) u.area = null;
      g.control[s] = g.control[v] = g.control[start] = 'german'; g.blown = [];
      const ge = g.units.find((u) => u.side === 'german' && !u.garrison)!, al = g.units.find((u) => u.side === 'allied' && !u.garrison)!;
      ge.area = start; al.area = x;                                                                     // Allied block next to the vacant link v, uncontested
      expect(E.inSupply(g, 'german', start)).toBe(true);
      found = true;
    }
    expect(found).toBe(true);
  });
  it('9.33d: a disordered unit may not enter an area with enemy units (The Bulge)', () => {
    E.useGame('bulge'); const g = E.newGame(3); g.phase = 'movement'; g.phasing = 'german';
    let checked = 0;
    for (const u of g.units.filter((x) => x.side === 'german' && x.area != null && !x.garrison)) {
      Object.assign(u, { moved: false, reserve: null, unsupplied: false, disorder: 0 });
      const into = E.moveOptions(g, u.id).map((o) => o.area).filter((a) => E.unitsIn(g, a, 'allied').length); if (!into.length) continue;
      u.disorder = 1; const dis = E.moveOptions(g, u.id).map((o) => o.area); u.disorder = 0;
      expect(into.filter((a) => dis.includes(a))).toEqual([]); checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('9.33d: a disordered unit may not enter an area with enemy units (Golan)', () => {
    const g = newGolanGame(6); g.phase = 'movement'; g.phasing = 'israeli';
    const u = g.units.find((x) => x.side === 'israeli' && x.area != null && !x.fort && !x.ghost && !x.garrison && E.neighbors(x.area).some((a) => E.unitsIn(g, a, 'syrian').length))!;
    const en = E.neighbors(u.area!).filter((a) => E.unitsIn(g, a, 'syrian').length);
    Object.assign(u, { moved: false, reserve: null, unsupplied: false, disorder: 0 });
    const ok = E.moveOptions(g, u.id).map((o) => o.area);
    u.disorder = 1; const dis = E.moveOptions(g, u.id).map((o) => o.area);
    expect(en.some((a) => ok.includes(a))).toBe(true);
    expect(en.filter((a) => dis.includes(a))).toEqual([]);
  });
});
