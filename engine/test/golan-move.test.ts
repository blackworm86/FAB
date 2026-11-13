// Golan '73 movement, against the Play Book's examples of play (23.0; docs/games/golan73/rules/playbook-examples.md).
import { describe, expect, it } from 'vitest';
import {
  reachable,
  stratReachable,
  pathCost,
  areas,
  area,
  ASSEMBLY,
  neighbors,
  connection,
  type GMoveCtx,
  type GMoveUnit,
  type GSide,
} from '../src/golan';

type Occ = Partial<Record<number, Partial<Record<GSide, number>>>>;
const ctx = (occ: Occ = {}, more: Partial<GMoveCtx> = {}): GMoveCtx => ({
  turn: 5,
  units: (a) => ({ israeli: occ[a]?.israeli ?? 0, syrian: occ[a]?.syrian ?? 0 }),
  ...more,
});
const at = (u: GMoveUnit, c: GMoveCtx, a: number) => reachable(u, c).find((r) => r.area === a);
const isr = (cls: 'armor' | 'infantry', a: number): GMoveUnit => ({ side: 'israeli', cls, area: a });
const syr = (cls: 'armor' | 'infantry', a: number): GMoveUnit => ({ side: 'syrian', cls, area: a });

describe('Golan map model', () => {
  it('83 areas, symmetric links, Hermon only touches 59, assembly areas lead to 6/10 and 17', () => {
    expect(areas.size).toBe(83);
    for (const a of areas.keys()) for (const b of neighbors(a)) expect(neighbors(b)).toContain(a);
    expect(neighbors(83)).toEqual([59]);
    expect(neighbors(ASSEMBLY.A).sort()).toEqual([10, 102, 6].sort());
    expect(neighbors(ASSEMBLY.B).sort()).toEqual([101, 17].sort());
  });
  it('the Purple Line splits Israel-held Golan from Syria', () => {
    for (const a of [2, 27, 42, 46, 57, 59, 83]) expect(area(a).syria).toBe(false);
    for (const a of [60, 61, 62, 63, 64, 75, 82]) expect(area(a).syria).toBe(true);
    expect(connection(64, 50)?.atDitch).toBe(true);
  });
});

describe('Example 3: basic movement', () => {
  it('A: 4th Mech 6 → 7 (bridge 1) → 36 (escarpment by road 2) → 37 (wadi by field 3) = 6 MP', () => {
    expect(pathCost(isr('armor', 6), ctx(), [6, 7, 36, 37])!.cost).toBe(6);
    expect(pathCost(isr('armor', 6), ctx(), [6, 7, 36, 37, 42])).toBeNull();
    expect(at(isr('armor', 6), ctx(), 7)!.cost).toBe(1);
    expect(at(isr('armor', 6), ctx(), 36)!.cost).toBe(3);
  });
  it('B: 6 → 9 occupied = 3; 9 → 8 across the river with no road is a whole-allowance move', () => {
    expect(at(isr('armor', 6), ctx({ 9: { israeli: 1 } }), 9)!.cost).toBe(3);
    expect(pathCost(isr('armor', 9), ctx(), [9, 8])!.cost).toBe(6);
    expect(pathCost(isr('armor', 6), ctx(), [6, 9, 8])).toBeNull();
  });
  it('D: once the 4th Mech has used the escarpment 7/36, no other unit may cross it this phase', () => {
    const c = ctx({}, { crossedThisPhase: new Set(['7-36']) });
    expect(pathCost(isr('armor', 7), c, [7, 36])).toBeNull();
    expect(pathCost(isr('armor', 6), ctx(), [6, 7, 36])!.limited).toEqual(['7-36']);
  });
  it('E–G: Golani in 35: no escarpment without road into 8; 36 by field 2; 34 occupied 2, then 38 for 1', () => {
    const g = isr('infantry', 35),
      c = ctx({ 34: { israeli: 1 }, 42: { israeli: 1 } }, { crossedThisPhase: new Set(['7-36']) });
    expect(pathCost(g, c, [35, 8])).toBeNull();
    expect(pathCost(g, c, [35, 36])!.cost).toBe(2);
    expect(pathCost(g, c, [35, 36, 42])).toBeNull(); // occupied: 2 + 2 > 3
    expect(pathCost(g, c, [35, 36, 43])).toBeNull(); // wadi by field
    expect(pathCost(g, c, [35, 36, 7])).toBeNull(); // escarpment already crossed this phase
    expect(at(g, c, 38)!.cost).toBe(3);
    expect(at(g, c, 38)!.path).toEqual([35, 34, 38]);
  });
  it('H: 53/188 in 34 into enemy-held 33: road +1 occupied = 2 and must stop', () => {
    const r = at(isr('armor', 34), ctx({ 34: { israeli: 1 }, 33: { syrian: 1 } }), 33)!;
    expect(r.cost).toBe(2);
    expect(r.mustStop).toBe(true);
    expect(
      reachable(isr('armor', 34), ctx({ 34: { israeli: 1 }, 33: { syrian: 1 } })).some((x) => x.path.includes(33) && x.area !== 33),
    ).toBe(false);
  });
});

describe('Example 4: rugged boundaries', () => {
  it('A: 121st Mech 50 → 51 → 52 by road, then 46 occupied by field = 5', () => {
    expect(pathCost(syr('armor', 50), ctx({ 46: { israeli: 1 } }), [50, 51, 52, 46])!.cost).toBe(5);
  });
  it('B: armor may not cross the rugged 51/46; C: infantry may, for its whole allowance', () => {
    expect(pathCost(syr('armor', 51), ctx(), [51, 46])).toBeNull();
    expect(pathCost(syr('infantry', 49), ctx({ 46: { israeli: 1 } }), [49, 46])!.cost).toBeGreaterThanOrEqual(3);
  });
  it('D: Syrian units may not cross an operational boundary before turn 5', () => {
    expect(at(syr('infantry', 49), ctx({}, { turn: 3 }), 48)).toBeUndefined();
    expect(at(syr('infantry', 49), ctx({}, { turn: 5 }), 48)).toBeDefined();
  });
  it('14.14: armor crosses the rugged 18/19 only by its road, one unit per phase', () => {
    expect(at(isr('armor', 18), ctx(), 19)!.cost).toBe(1);
    expect(pathCost(isr('armor', 18), ctx({}, { crossedThisPhase: new Set(['18-19']) }), [18, 19])).toBeNull();
  });
});

describe('Example 5: anti-tank ditch', () => {
  it('A–C: crossing the AT ditch takes the whole allowance, allowed as a one-area move', () => {
    for (const [from, to, cls] of [
      [64, 50, 'infantry'],
      [61, 57, 'infantry'],
      [60, 59, 'infantry'],
    ] as const) {
      expect(pathCost(syr(cls, from), ctx({ [to]: { israeli: 1 } }), [from, to])!.cost).toBeGreaterThanOrEqual(3);
      expect(pathCost(syr('armor', from), ctx(), [from, to])!.cost).toBe(6);
    }
  });
  it('D: from Horfa (62) the ditch cannot be reached and crossed in one phase', () => {
    expect(reachable(syr('armor', 62), ctx()).some((r) => r.path.some((a, i) => i > 0 && !area(a).syria))).toBe(false);
  });
  it('a bridged AT ditch is crossed by its connection', () => {
    expect(at(syr('armor', 64), ctx({}, { bridgedDitch: new Set(['50-64']) }), 50)!.cost).toBe(1);
  });
});

describe('Example 6: minefields', () => {
  const mines = { minefields: new Set(['47-48']) };
  it('C: 52nd Inf 48 → 47 across a minefield: road 1 +1 occupied +1 mine = 3, with a morale check', () => {
    const r = at(syr('infantry', 48), ctx({ 47: { israeli: 1 } }, mines), 47)!;
    expect(r.cost).toBe(3);
    expect(r.triggers).toEqual(['minefield']);
  });
  it('B: after a failed check the recon must go round: 48 → 40 → 41 → 47', () => {
    const r = at({ ...syr('armor', 48), minefieldFailed: true }, ctx({}, { ...mines, turn: 3 }), 47)!;
    expect(r.path).toEqual([48, 40, 41, 47]);
    expect(r.cost).toBe(4); // the printed map has a road on 40/41 (the example says 5)
  });
  it('after a failed check the allowance is spent: no further one-area move beyond it (5.33 only on the first step)', () => {
    expect(at({ ...syr('infantry', 48), spent: 3 }, ctx({}, mines), 40)).toBeUndefined();
  });
  it('minefields do not affect Israeli units', () => {
    expect(at(isr('armor', 48), ctx({}, mines), 47)!.cost).toBe(1);
  });
});

describe('Example 7: strategic movement', () => {
  const west = (a: number) => (area(a).syria ? 'syrian' : 'israeli') as GSide;
  it('4th Mech in reserve in Assembly A strat-moves to Tel Faris (30)', () => {
    expect(stratReachable(isr('armor', ASSEMBLY.A), ctx({}, { controller: west }))).toContain(30);
  });
  it('the operational alternatives fall short: A → 10 → 11 → 12 → 24 → 26 = 6 MP', () => {
    const r = reachable(isr('armor', ASSEMBLY.A), ctx({}, { controller: west }));
    expect(r.find((x) => x.area === 26)!.cost).toBe(6);
    expect(r.find((x) => x.area === 38)!.cost).toBe(6);
    expect(r.some((x) => x.area === 30)).toBe(false);
  });
});

describe('Example 2 and 13: interdiction and commando raids', () => {
  it('2C: 91st Tank into interdicted Tel Kudne: 1 + 2, and 2 to leave', () => {
    const c = ctx({}, { interdicted: (a) => (a === 73 ? 'israeli' : undefined) });
    expect(at(syr('armor', 75), c, 73)!.cost).toBe(3);
    expect(at(syr('armor', 73), c, 74)!.cost).toBe(2);
  });
  it("13B: 4th Mech up the escarpment into a raided Ma'ale Gamla: 1 + 1 + 1 = 3, raid roll, stop", () => {
    const r = at(isr('armor', 12), ctx({}, { raids: new Set([24]) }), 24)!;
    expect(r.cost).toBe(3);
    expect(r.triggers).toEqual(['raid']);
    expect(r.mustStop).toBe(true);
  });
});

describe('special areas', () => {
  it('Mt Hermon: infantry from 59 for the whole allowance, never armor, never on the Syrian night turn', () => {
    expect(at(isr('infantry', 59), ctx(), 83)!.cost).toBe(3);
    expect(at(isr('armor', 59), ctx(), 83)).toBeUndefined();
    expect(at(syr('infantry', 59), ctx({}, { turn: 2 }), 83)).toBeUndefined();
  });
  it('night turn: Syrian infantry one area, armor two areas and 4 MP', () => {
    const inf = reachable(syr('infantry', 63), ctx({}, { turn: 2 })),
      arm = reachable(syr('armor', 63), ctx({}, { turn: 2 }));
    expect(Math.max(...inf.map((r) => r.path.length))).toBe(2);
    expect(Math.max(...arm.map((r) => r.path.length))).toBeLessThanOrEqual(3);
    expect(Math.max(...arm.map((r) => r.cost))).toBeLessThanOrEqual(4);
  });
  it('14.43: Israeli units enter Syria only where it is undefended', () => {
    expect(at(isr('armor', 50), ctx({ 64: { syrian: 1 } }), 64)).toBeUndefined();
    expect(at(isr('armor', 50), ctx(), 64)).toBeDefined();
  });
});
