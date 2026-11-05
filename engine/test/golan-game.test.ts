// Golan '73 game state: Operation Badr set-up (Play Book 22.1 with the errata), turn sequence, draws, control, supply, victory.
import { describe, expect, it } from 'vitest';
import { fight } from './golan-helpers';
import { mustFight, newGolanGame, endPhase, onMap, count, unit, chit, moveOptions, move, arrivalOptions, placeArrival, inSupply, computeVictory, ASSEMBLY, TURN_TRACK, type GGame } from '../src/golan';

const runTo = (g: GGame, turn: number, player: 'syrian' | 'israeli', phase: string) => {
  for (let i = 0; i < 400 && !(g.turn === turn && g.player === player && g.phase === phase); i++) {
    if (g.phase === 'reinforcement') for (const u of g.units.filter((x) => x.box === 'arriving')) { const o = arrivalOptions(g, u.id); if (o.length) placeArrival(g, u.id, o[0]); }
    for (const a of mustFight(g)) fight(g, a);
    endPhase(g);
  }
  expect([g.turn, g.player, g.phase]).toEqual([turn, player, phase]);
};

describe('Operation Badr set-up (22.1)', () => {
  const g = newGolanGame(7);
  it('opens with the Syrian Combat Phase of turn 1', () => { expect([g.turn, g.player, g.phase]).toEqual([1, 'syrian', 'combat']); });
  it('7 Israeli regulars, 8 strongpoints and 3 ghosts on the Purple Line areas, 16 Syrian units on the map', () => {
    const on = g.units.filter((u) => u.box === 'map');
    expect(on.filter((u) => u.side === 'israeli' && !u.kind).length).toBe(7);
    expect(on.filter((u) => u.kind === 'strongpoint').length).toBe(8);
    expect(on.filter((u) => u.kind === 'ghost').length).toBe(3);
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
    expect(g.chits.filter((c) => c.side === 'israeli' && c.box === 'available').length).toBe(4);
    expect(g.chits.filter((c) => c.side === 'syrian' && c.box === 'available').length).toBeGreaterThanOrEqual(25);
    expect(g.chits.filter((c) => c.box === 'air_support_holding').length).toBe(3);
    expect(g.chits.filter((c) => c.box === 'evacuated_strongpoints').length).toBe(8);
    expect(g.minefields).toEqual(['29-30', '47-48', '50-51']);
    expect(unit(g, 'S15').reserve && unit(g, 'S13').reserve).toBe(true);
    expect(g.freeCombatRound).toBe(2);
  });
  it('at the start Israel holds the VP lead from the mutual VP areas it controls', () => {
    const v = computeVictory(g); expect(v.leader).toBe('israeli'); expect(v.israeli).toBe(5); expect(v.syrian).toBe(0);
  });
});

describe('turn sequence, reinforcements and draws', () => {
  it('turn 2: the night turn; reinforcements arrive in the Assembly areas and at Syrian entries; draws follow the Turn Track', () => {
    const g = newGolanGame(3);
    runTo(g, 2, 'syrian', 'reinforcement');
    expect(unit(g, 'I02').box).toBe('arriving'); expect(arrivalOptions(g, 'I02')).toEqual([ASSEMBLY.A]);
    expect(g.chits.filter((c) => c.kind === 'sa_block').map((c) => c.box)).toEqual(['available', 'available']);
    expect(arrivalOptions(g, 'S24')).toEqual([82]);                              // 47th: entry V
    const cupBefore = { syrian: g.chits.filter((c) => c.side === 'syrian' && c.box === 'cup').length, israeli: g.chits.filter((c) => c.side === 'israeli' && c.box === 'cup').length };
    const availBefore = { syrian: g.chits.filter((c) => c.side === 'syrian' && c.box === 'available').length, israeli: g.chits.filter((c) => c.side === 'israeli' && c.box === 'available').length };
    runTo(g, 2, 'syrian', 'movement');
    const d = TURN_TRACK[2].draws;
    expect(g.chits.filter((c) => c.side === 'syrian' && c.box === 'available').length - availBefore.syrian).toBe(Math.min(d.syrian[0], cupBefore.syrian));
    expect(g.chits.filter((c) => c.side === 'israeli' && c.box === 'available').length - availBefore.israeli).toBe(Math.min(d.israeli[0], cupBefore.israeli));
    expect(unit(g, 'I02').area).toBe(ASSEMBLY.A);
  });
  it('Syrian night move: infantry one area, armor two', () => {
    const g = newGolanGame(5); runTo(g, 2, 'syrian', 'movement');
    const inf = g.units.find((u) => u.side === 'syrian' && u.box === 'map' && u.cls === 'infantry' && !g.riverAssault.includes(u.area!) && moveOptions(g, u.id).length)!;
    expect(Math.max(...moveOptions(g, inf.id).map((r) => r.path.length))).toBe(2);
  });
  it('moving changes control; a game runs to its end with a result', () => {
    const g = newGolanGame(11); runTo(g, 2, 'syrian', 'movement');
    const u = unit(g, 'S24'); const opt = moveOptions(g, u.id).find((r) => !r.mustStop)!;
    move(g, u.id, opt.area); expect(u.area).toBe(opt.area); expect(g.control[opt.area]).toBe('syrian');
    for (let i = 0; i < 2000 && !g.result; i++) { if (g.phase === 'reinforcement') for (const x of g.units.filter((y) => y.box === 'arriving')) { const o = arrivalOptions(g, x.id); if (o.length) placeArrival(g, x.id, o[0]); } for (const a of mustFight(g)) fight(g, a); endPhase(g); }
    expect(g.result).toMatch(/Victory|Draw/);
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
