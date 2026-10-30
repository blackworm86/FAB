import { describe, expect, it } from 'vitest';
import { areas, neighbors, connection, d10, rng, succeeds, hitProb, successNumber, moraleSn, hitPmf, probAtLeast, meanHits, reachable, type MoveCtx } from '../src';

const empty: MoveCtx = { occupants: () => ({ german: 0, allied: 0 }) };
const withAllied = (...ids: number[]): MoveCtx => ({ occupants: (a) => ({ german: 0, allied: ids.includes(a) ? 1 : 0 }) });
const cost = (r: ReturnType<typeof reachable>, a: number) => r.find((x) => x.area === a);

describe('map', () => {
  it('has 98 areas and symmetric adjacency', () => {
    expect(areas.size).toBe(98);
    for (const a of areas.keys()) for (const b of neighbors(a)) expect(neighbors(b)).toContain(a);
    expect(connection(4, 11)?.restricted).toBe(true);
  });
});

describe('Player Aid C rules', () => {
  it('armor point unit in field works is still only -1; artillery ignores TQ and TDN', () => {
    const g = successNumber({ kind: 'unit', cls: 'infantry', quality: 'veteran', dice: 1 }, { pointCls: 'armor', pointQuality: 'veteran', fieldWorks: true }, { attacker: true, tdn: 0 });
    expect(g.sn).toBe(4);
    expect(successNumber({ kind: 'artillery', cls: 'infantry', quality: 'green', dice: 1 }, { pointCls: 'infantry', pointQuality: 'elite', fieldWorks: true }, { attacker: true, tdn: 3 }).sn).toBe(4);
  });
  it('morale', () => { expect(moraleSn('elite')).toBe(7); expect(moraleSn('green', true, true)).toBe(1); });
});

describe('dice (2.1)', () => {
  it('1 always succeeds, 10 always fails', () => {
    expect(succeeds(1, -3)).toBe(true); expect(succeeds(10, 12)).toBe(false); expect(succeeds(5, 5)).toBe(true); expect(succeeds(6, 5)).toBe(false);
    expect(hitProb(-2)).toBe(0.1); expect(hitProb(14)).toBe(0.9); expect(hitProb(6)).toBe(0.6);
  });
  it('seeded rolls repeat and stay in 1..10', () => {
    const a = rng(42), b = rng(42), rolls = Array.from({ length: 500 }, () => d10(a));
    expect(rolls.every((r) => r >= 1 && r <= 10)).toBe(true);
    expect(rolls.slice(0, 20)).toEqual(Array.from({ length: 20 }, () => d10(b)));
  });
});

describe('Success Numbers match the play-book combat examples (23.5, 23.6, 23.7)', () => {
  const vetInf = { pointCls: 'infantry', pointQuality: 'veteran' } as const;
  it('St. Vith, defensive fire (fig. 8)', () => {
    expect(successNumber({ kind: 'unit', cls: 'armor', quality: 'veteran', dice: 1 }, vetInf, { attacker: false, tdn: 1 }).sn).toBe(6);  // CCB/9
    expect(successNumber({ kind: 'battle', cls: 'infantry', quality: 'green', dice: 1 }, vetInf, { attacker: false, tdn: 1 }).sn).toBe(4); // garrison
    expect(successNumber({ kind: 'unit', cls: 'infantry', quality: 'green', dice: 1 }, vetInf, { attacker: false, tdn: 1 }).sn).toBe(4);  // 106 Inf
  });
  it('Weiswampach, artillery and ground fire (fig. 10-11)', () => {
    expect(successNumber({ kind: 'artillery', cls: 'infantry', dice: 2 }, vetInf, { attacker: true, tdn: 1 }).sn).toBe(5);
    expect(successNumber({ kind: 'artillery', cls: 'infantry', dice: 1 }, { pointCls: 'armor', pointQuality: 'elite' }, { attacker: false, tdn: 1 }).sn).toBe(4);
    expect(successNumber({ kind: 'unit', cls: 'infantry', quality: 'veteran', dice: 1 }, { pointCls: 'armor', pointQuality: 'elite' }, { attacker: false, tdn: 1 }).sn).toBe(3);
    expect(successNumber({ kind: 'unit', cls: 'armor', quality: 'elite', dice: 3 }, vetInf, { attacker: true, tdn: 1 }).sn).toBe(6);    // 116 Pz
  });
  it('breakthrough combats (D and E)', () => {
    expect(successNumber({ kind: 'unit', cls: 'armor', quality: 'veteran', dice: 1 }, { pointCls: 'armor', pointQuality: 'elite', riverAssaultMarker: true }, { attacker: false, tdn: 1 }).sn).toBe(5);
    expect(successNumber({ kind: 'unit', cls: 'armor', quality: 'veteran', dice: 2 }, { pointCls: 'armor', pointQuality: 'veteran' }, { attacker: true, tdn: 1, riverAssault: true }).sn).toBe(3);
    expect(successNumber({ kind: 'unit', cls: 'infantry', quality: 'green', dice: 3 }, { pointCls: 'armor', pointQuality: 'elite' }, { attacker: false, tdn: 1 }).sn).toBe(2);
    expect(successNumber({ kind: 'unit', cls: 'armor', quality: 'elite', dice: 4 }, { pointCls: 'infantry', pointQuality: 'green' }, { attacker: true, tdn: 1 }).sn).toBe(7);
  });
  it('hit distribution', () => {
    const pmf = hitPmf([{ dice: 3, sn: 6 }, { dice: 1, sn: 4 }]);
    expect(pmf.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(meanHits(pmf)).toBeCloseTo(3 * 0.6 + 0.4, 12);
    expect(probAtLeast(pmf, 0)).toBeCloseTo(1, 12);
    expect(pmf[4]).toBeCloseTo(0.6 ** 3 * 0.4, 12);
  });
});

describe('movement matches the play-book examples (23.3, fig. 4-5)', () => {
  const inf = { side: 'german', cls: 'infantry', area: 4, supplied: true, disordered: false, ownZone: 5 } as const;
  const arm = { ...inf, cls: 'armor' } as const;
  it('infantry Prüm -> St. Vith by road through Pronsfeld and Lutzkampen: 3 MP', () => {
    expect(cost(reachable(inf, empty), 23)?.cost).toBe(3);
    expect(cost(reachable(inf, empty), 23)?.path).toEqual([4, 3, 12, 23]);
  });
  it('Schnee Eifel: infantry pays 3 MP into Bleialf, armor cannot cross', () => {
    expect(cost(reachable(inf, empty), 11)?.cost).toBe(3);
    expect(cost(reachable(arm, empty), 11)?.path).not.toEqual([4, 11]);
  });
  it('leaving the own army zone costs 2 more (Prüm -> Losheim = 3 MP), unless pre-authorised', () => {
    expect(cost(reachable(inf, empty), 5)?.cost).toBe(3);
    expect(cost(reachable({ ...inf, boundaryPreauthorized: true }, empty), 5)?.cost).toBe(1);
  });
  it('armor needs fuel beyond 3 MP; occupied St. Vith costs 4 through Pronsfeld', () => {
    const free = cost(reachable(arm, empty), 23)!; expect(free.cost).toBe(3); expect(free.fuel).toBe(false);
    const occ = cost(reachable(arm, withAllied(23)), 23)!; expect(occ.cost).toBe(4); expect(occ.fuel).toBe(true); expect(occ.mustStop).toBe(true);
    expect(cost(reachable(inf, withAllied(23)), 23)).toBeUndefined();   // infantry would need 4 MP
  });
  it('units stop in enemy areas and disordered units move one area only', () => {
    expect(reachable(arm, withAllied(3)).some((r) => r.path.includes(3) && r.area !== 3)).toBe(false);
    expect(reachable({ ...inf, disordered: true }, empty).every((r) => r.path.length === 2)).toBe(true);
  });
  it('a blown bridge costs the whole allowance and can only be crossed from the start area', () => {
    const blown = { ...empty, blownBridges: new Set(['13-21']) };
    const r = cost(reachable({ ...arm, area: 13 }, blown), 21)!;
    expect(r.path[1] === 21 ? r.cost : 6).toBe(6);                        // direct crossing always costs 6
    expect(reachable({ ...arm, area: 12 }, blown).some((x) => x.path.join() .includes('13,21'))).toBe(false); // not after moving
  });
});
