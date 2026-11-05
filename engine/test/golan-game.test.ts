// Golan '73 on the series engine: Operation Badr set-up (Play Book 22.1 with the errata), turn sequence, draws, control, supply, victory.
import { describe, expect, it } from 'vitest';
import track from '../../data/golan73/turn_track.json';
import { fight, newGolanGame, onMap, count, unit, chit, move, runTo, playOut } from './golan-helpers';
import { mustFight, endPhase, moveOptions, arrivalOptions, inSupply, victory, golan } from '../src';

const ASSEMBLY = golan.ASSEMBLY;

describe('Operation Badr set-up (22.1)', () => {
  const g = newGolanGame(7);
  it('opens with the Syrian Combat Phase of turn 1', () => { expect([g.turn, g.phasing, g.phase]).toEqual([1, 'syrian', 'combat']); });
  it('7 Israeli regulars, 8 strongpoints and 3 ghosts on the Purple Line areas, 16 Syrian units on the map', () => {
    const on = g.units.filter((u) => u.area != null && !u.garrison);
    expect(on.filter((u) => u.side === 'israeli' && !u.kind).length).toBe(7);
    expect(on.filter((u) => u.fort).length).toBe(8);
    expect(on.filter((u) => u.ghost).length).toBe(3);
    expect(on.filter((u) => u.side === 'syrian').length).toBe(16);
    for (const a of [27, 28, 29, 30, 39, 40, 48, 49, 50, 57, 59]) expect(onMap(g, a).filter((u) => u.kind).length).toBe(1);
  });
  it('the seven Syrian bridgeheads are contested with River Assault markers; Israel still controls them', () => {
    for (const a of [27, 28, 39, 48, 50, 57, 59]) { expect(count(g, a)).toEqual({ israeli: 1, syrian: 1 }); expect(g.control[a]).toBe('israeli'); }
    expect(g.riverAssault).toEqual([27, 28, 39, 48, 50, 57, 59]);
  });
  it('holding boxes, garrisons, available assets, minefields, reserve markers and the free combat rounds', () => {
    expect(g.units.filter((u) => u.box === 'operational_reserve').map((u) => u.name)).toEqual(['15th', '81st', '65th']);
    expect(g.units.filter((u) => u.box === 'strategic_reserve').length).toBe(3);
    expect(unit(g, 'S17').box).toBe('air_assault');
    expect(g.chits.filter((c) => c.kind === 'garrison' && c.box === 'map').map((c) => c.area)).toEqual([22, 30, 42, 46, 83]);
    expect(g.units.filter((u) => u.garrison).map((u) => u.area)).toEqual([22, 30, 42, 46, 83]);
    expect(g.chits.filter((c) => c.side === 'israeli' && c.box === 'available').length).toBe(4);
    expect(g.chits.filter((c) => c.side === 'syrian' && c.box === 'available').length).toBeGreaterThanOrEqual(25);
    expect(g.chits.filter((c) => c.box === 'air_support_holding').length).toBe(3);
    expect(g.chits.filter((c) => c.box === 'evacuated_strongpoints').length).toBe(8);
    expect(golan.state(g).minefields).toEqual(['29-30', '47-48', '50-51']);
    expect(unit(g, 'S15').reserve && unit(g, 'S13').reserve).toBeTruthy(); expect(g.markers.syrian.res).toBe(0); expect(g.markers.israeli.res).toBe(4);
    expect(golan.state(g).freeCombatRound).toBe(2);
  });
  it('at the start Israel holds the VP lead from the mutual VP areas it controls', () => {
    const v = victory(g); expect(v.israeli).toBe(5); expect(v.syrian).toBe(0); expect(v.net).toBe(-5);
  });
});

describe('turn sequence, reinforcements and draws', () => {
  it('turn 2: the night turn; reinforcements arrive in the Assembly areas and at Syrian entries; draws follow the Turn Track', () => {
    const g = newGolanGame(3);
    runTo(g, 2, 'syrian', 'reinforcement');
    expect(g.pendingArrivals).toContain('I02'); expect(arrivalOptions(g, 'I02').filter((o) => !o.sa).map((o) => o.area)).toEqual([ASSEMBLY.A]);   // the other Assembly area costs a Special Action (8.27)
    expect(g.chits.filter((c) => c.kind === 'sa_block').map((c) => c.box)).toEqual(['available', 'available']);
    expect(arrivalOptions(g, 'S24').filter((o) => !o.sa).map((o) => o.area)).toEqual([82]);                              // 47th: entry V
    const inBox = (side: string, box: string) => g.chits.filter((c) => c.side === side && c.box === box).length;
    const cupBefore = { syrian: inBox('syrian', 'cup'), israeli: inBox('israeli', 'cup') }, before = { syrian: inBox('syrian', 'available'), israeli: inBox('israeli', 'available') };
    runTo(g, 2, 'syrian', 'movement');
    const d = track.turns['2'].draws, drawn = (side: 'syrian' | 'israeli') => Math.min(d[side][0], cupBefore[side]);
    expect(inBox('syrian', 'available') - before.syrian).toBe(drawn('syrian'));
    expect(inBox('israeli', 'available') - before.israeli).toBeGreaterThanOrEqual(drawn('israeli') - 1);     // Dugman 5 is resolved as soon as it is drawn
    expect(unit(g, 'I02').area).toBe(ASSEMBLY.A);
    expect(golan.isNight(g)).toBe(true);
  });
  it('Syrian night move: infantry one area, armor two', () => {
    const g = newGolanGame(5); runTo(g, 2, 'syrian', 'movement');
    const inf = g.units.find((u) => u.side === 'syrian' && u.area != null && u.cls === 'infantry' && !g.riverAssault.includes(u.area) && moveOptions(g, u.id).length)!;
    expect(Math.max(...moveOptions(g, inf.id).map((r) => r.path.length))).toBe(2);
  });
  it('moving changes control; a game runs to its end with a result', () => {
    const g = newGolanGame(11); runTo(g, 2, 'syrian', 'movement');
    const u = unit(g, 'S24'); const opt = moveOptions(g, u.id).find((r) => !r.mustStop)!;
    move(g, u.id, opt.area); expect(u.area).toBe(opt.area); expect(g.control[opt.area]).toBe('syrian');
    playOut(g); expect(g.over).toMatch(/victory|draw/i);
  });
  it('all seven bridgeheads must be fought before the Combat Phase ends', () => {
    const g = newGolanGame(2);
    expect(mustFight(g).sort((x, y) => x - y)).toEqual([27, 28, 39, 48, 50, 57, 59]);
    expect(() => endPhase(g)).toThrow(/fought/);
    for (const a of mustFight(g)) { const r = fight(g, a); expect(r).toBeTruthy(); }
    expect(mustFight(g)).toEqual([]);
    endPhase(g); expect(g.phase).toBe('reaction');
  });
});

describe('supply (9.31, 14.93–14.95)', () => {
  it('Syrian bridgeheads trace back across the ditch they sit on; Assembly areas and Mt Hermon are always supplied', () => {
    const g = newGolanGame(1);
    expect(inSupply(g, 'syrian', 64)).toBe(true);
    expect(inSupply(g, 'israeli', 42)).toBe(true);
    expect(inSupply(g, 'israeli', ASSEMBLY.B)).toBe(true);
    expect(inSupply(g, 'syrian', 83)).toBe(true);
    expect(chit(g, 'IC09').area).toBe(83);
  });
});
