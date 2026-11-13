// Rules sweep of Golan '73: each test asserts what the printed rules require and fails while the engine does otherwise.
import { describe, expect, it } from 'vitest';
import { VOLUMES, endPhase, startBattle, canAssign, assign, stratOptions, stratMove, newGame, useGame, golan, type Game } from '../src';
import { reachable, areas, connections, edgeKey, type GMoveCtx, type GSide } from '../src/golan';
import { newGolanGame, unit, chit, give, move } from './golan-helpers';
import * as E from '../src';

const H = () => VOLUMES.golan73 as unknown as Record<string, (...a: unknown[]) => unknown>;
type Occ = Partial<Record<number, Partial<Record<GSide, number>>>>;
const ctx = (occ: Occ = {}, more: Partial<GMoveCtx> = {}): GMoveCtx => ({
  turn: 5,
  units: (a) => ({ israeli: occ[a]?.israeli ?? 0, syrian: occ[a]?.syrian ?? 0 }),
  ...more,
});
const clearMap = (g: Game) => {
  for (const u of g.units)
    if (u.area != null) {
      u.area = null;
      u.box = 'gone';
    }
};
/** Syria holds the whole map with every AT ditch bridged and no minefields, so any Syrian unit traces supply. */
const syrianMap = (g: Game) => {
  clearMap(g);
  for (const a of areas.keys()) g.control[a] = 'syrian';
  golan.state(g).bridgedDitch = connections()
    .filter((c) => c.atDitch)
    .map((c) => edgeKey(c.a, c.b));
  golan.state(g).minefields = [];
};

describe('Golan rules sweep', () => {
  it('14.17/19.5: west of the Jordan is Gadot, Kfar Hanasi and Almagor (6, 9, 10) - a supplied Syrian unit in Kfar Hanasi wins', () => {
    const g = newGolanGame(1);
    syrianMap(g);
    Object.assign(unit(g, 'S09'), { area: 9, box: undefined, unsupplied: false });
    g.phasing = 'israeli';
    g.phase = 'supply';
    H().onPhase(g, 'supply', 'end');
    expect(g.over ?? '').toMatch(/Automatic/);
  });
  it("14.17/19.5: B'not Yakov Bridge (7) lies east of the Jordan - a Syrian unit there is no automatic victory", () => {
    const g = newGolanGame(1);
    syrianMap(g);
    Object.assign(unit(g, 'S09'), { area: 7, box: undefined, unsupplied: false });
    g.phasing = 'israeli';
    g.phase = 'supply';
    H().onPhase(g, 'supply', 'end');
    expect(g.over).toBeFalsy();
  });

  it('14.43: the undefended-area limit applies only to crossing the Purple Line - inside Syria an Israeli unit may attack a defended area', () => {
    const r = reachable({ side: 'israeli', cls: 'armor', area: 60 }, ctx({ 60: { israeli: 1 }, 61: { syrian: 1 } }));
    expect(r.some((x) => x.area === 61)).toBe(true);
  });

  it('14.01a: a newly contested area entered only across a rugged boundary is a Crossing Assault (assault marker)', () => {
    const g = newGolanGame(1);
    clearMap(g);
    g.turn = 5;
    g.phase = 'movement';
    g.phasing = 'syrian';
    g.contestedAtMoveStart = [];
    Object.assign(unit(g, 'S01'), { area: 49, box: undefined, moved: false, spent: 0, disorder: 0, unsupplied: false });
    g.control[49] = 'syrian';
    Object.assign(unit(g, 'I05'), { area: 46, box: undefined });
    g.control[46] = 'israeli';
    move(g, 'S01', 46);
    endPhase(g);
    expect(g.riverAssault).toContain(46);
  });

  it('14.16: on Mt Hermon only infantry-class battle assets and air support may be assigned - no artillery', () => {
    const g = newGolanGame(1);
    Object.assign(unit(g, 'S01'), { area: 83, unsupplied: false });
    const b = startBattle(g, 83);
    expect(canAssign(g, b, 'syrian', chit(g, 'SC06'))).not.toBeNull();
  });
  it('14.16 with 13.3: an engineer is an infantry-class battle asset and may be assigned on Mt Hermon', () => {
    const g = newGolanGame(1);
    Object.assign(unit(g, 'S01'), { area: 83, unsupplied: false });
    const b = startBattle(g, 83);
    expect(canAssign(g, b, 'syrian', chit(g, 'SC10'))).toBeNull();
  });

  it('14.03: on the night turn the Syrian player may strat-move only one unit', () => {
    const g = newGolanGame(1);
    g.turn = 2;
    g.phase = 'strategic';
    g.phasing = 'syrian';
    for (const id of ['S15', 'S13']) Object.assign(unit(g, id), { moved: false, unsupplied: false });
    expect(unit(g, 'S15').reserve).toBeTruthy();
    expect(unit(g, 'S13').reserve).toBeTruthy();
    const o = stratOptions(g, 'S15');
    expect(o.length).toBeGreaterThan(0);
    stratMove(g, 'S15', o[0]);
    expect(stratOptions(g, 'S13')).toEqual([]);
  });

  it('17.11: a Strategic Reserve Released event places the unit in a friendly Entry area at once (same Admin Phase)', () => {
    const g = newGolanGame(1);
    g.turn = 6;
    g.phase = 'admin';
    g.phasing = 'syrian';
    golan.playRelease(g, give(g, 'SC42'));
    const u = unit(g, 'S21');
    expect(u.area != null || g.pendingArrivals.includes(u.id)).toBe(true);
  });
  it('14.61b: a Special Action releases the next 3rd Tank Division unit into its Entry area at once', () => {
    const g = newGolanGame(1);
    g.turn = 3;
    g.phase = 'admin';
    g.phasing = 'syrian';
    golan.releaseOperationalReserve(g, give(g, 'SC28'));
    const u = unit(g, 'S18');
    expect(u.area != null || g.pendingArrivals.includes(u.id)).toBe(true);
  });
});

describe('Golan rules sweep (2)', () => {
  it('16.12: once a SAM cancels an Israeli air mission, Israel may not replace it with another air asset in that battle', () => {
    let checked = false;
    for (let seed = 1; seed < 60 && !checked; seed++) {
      const g = newGolanGame(seed);
      g.phasing = 'israeli';
      g.fought = [];
      Object.assign(unit(g, 'I05'), { area: 50 });
      const airs = g.chits.filter((c) => c.kind === 'air_mission' && c.side === 'israeli');
      airs[0].box = 'available';
      airs[1].box = 'available';
      const b = startBattle(g, 50);
      assign(g, b, airs[0].id, 'arty');
      const sam = g.chits.find((c) => c.kind === 'sam' && c.box === 'available')!;
      if (golan.fireSam(g, sam.id) === 'none') continue;
      checked = true;
      expect(canAssign(g, b, 'israeli', airs[1], 'arty')).not.toBeNull();
    }
    expect(checked).toBe(true);
  });
  it("20.35 with 14.17: Al-Owda commandos may land east of the Jordan in B'not Yakov Bridge (7), not west of it in Kfar Hanasi (9)", () => {
    useGame('golan73');
    const g = newGame(1, { scenario: 'alowda' });
    const ok = golan.alowdaRaidAreas(g);
    expect(ok).toContain(7);
    expect(ok).not.toContain(9);
  });
  it('17.31/4.21: an Armor Replacement is an event, so it may instead bring two eliminated assets back to the cup', () => {
    const g = newGolanGame(1);
    g.turn = 5;
    g.phase = 'admin';
    g.phasing = 'syrian';
    chit(g, 'SC06').box = 'eliminated';
    expect(() => golan.alternateEventUse(g, give(g, 'SC36'), ['SC06'])).not.toThrow();
    expect(chit(g, 'SC06').box).toBe('cup');
  });
  it('15.4a/15.2: when an Israeli unit first crosses the Purple Line the 3rd Tank Division is released at once, not next turn', () => {
    const g = newGolanGame(1);
    clearMap(g);
    g.turn = 5;
    g.phase = 'movement';
    g.phasing = 'israeli';
    g.contestedAtMoveStart = [];
    Object.assign(unit(g, 'I05'), { area: 50, box: undefined, moved: false, spent: 0, disorder: 0, unsupplied: false });
    g.control[50] = 'israeli';
    move(g, 'I05', 64);
    expect(unit(g, 'I05').area).toBe(64);
    const R = () => golan.state(g).release;
    if (R()?.pick)
      golan.pickRelease(
        g,
        golan
          .releaseChoices(g)
          .slice(0, 2)
          .map((x) => x.id),
      ); // 15.2: Syria chooses and places at once
    for (let i = 0; i < 6 && R(); i++) {
      const id = R()!.place[0];
      golan.placeReleased(g, id, golan.releaseTargets(g, id)[0]);
    }
    const u = unit(g, 'S18');
    expect(u.area != null || g.pendingArrivals.includes(u.id)).toBe(true);
  });
});

describe('Golan rules sweep (minefields)', () => {
  it('14.02: a failed minefield check costs only the extra 1 MP; the unit stays and may still move into a non-mined area', () => {
    E.useGame('golan73');
    const g = E.newGame(3, { scenario: 'badr' });
    E.golan.autoStrongpoints(g, 'historical');
    E.golan.state(g).minesLeft = 0;
    E.endPhase(g);
    g.phase = 'movement';
    g.phasing = 'syrian';
    g.contestedAtMoveStart = [];
    const [a, b] = E.golan.state(g).minefields[0].split('-').map(Number);
    for (const x of [...E.unitsIn(g, a), ...E.unitsIn(g, b)]) x.area = null;
    g.control[a] = 'syrian';
    g.control[b] = 'syrian';
    const u = g.units.find((x) => x.side === 'syrian' && x.cls === 'armor' && x.area == null && x.str > 0)!;
    Object.assign(u, { area: a, box: undefined, moved: false, spent: 0, disorder: 0, reserve: null, unsupplied: false });
    expect(E.moveOptions(g, u.id).some((o) => o.area === b)).toBe(true);
    g.force = [10];
    E.move(g, u.id, b);
    expect(u.area).toBe(a);
    expect(u.spent).toBe(1);
    const left = E.moveOptions(g, u.id);
    expect(left.some((o) => o.area === b)).toBe(false);
    expect(left.length).toBeGreaterThan(0);
  });
});
