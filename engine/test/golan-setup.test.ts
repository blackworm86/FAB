// Operation Badr set-up (Play Book 22.14/22.24, 15.6, 15.7, 14.02 and the errata): what the Israeli player places before the first phase.
import { describe, expect, it } from 'vitest';
import { endPhase, connection, golan } from '../src';
import { newGolanGame, unit } from './golan-helpers';

const PURPLE = [27, 28, 29, 30, 39, 40, 48, 49, 50, 57, 59];
describe('Operation Badr set-up', () => {
  it('historical: Israel places the 8 strongpoints and 3 ghosts, one per Purple Line area, then the Syrian Combat Phase of turn 1', () => {
    const g = newGolanGame(3, 'badr', false);
    expect([g.phase, g.phasing, g.turn]).toEqual(['deploy', 'israeli', 1]);
    const pieces = g.units.filter((u) => u.box === 'deploy');
    expect(pieces.length).toBe(11); expect(pieces.every((u) => u.fort || u.ghost)).toBe(true);
    expect(golan.deployOptions(g, 'I31').sort((a, b) => a - b)).toEqual(PURPLE);
    golan.deploy(g, 'I31', 49); expect(golan.deployOptions(g, 'I23')).not.toContain(49);            // one per area
    expect(unit(g, 'S01').area).toBe(27);                                                            // the Syrian units stand where 22.15 puts them
    expect(() => endPhase(g)).toThrow(/place every unit/);
    golan.autoStrongpoints(g, 'shuffle');
    for (const a of PURPLE) expect(g.units.filter((u) => (u.fort || u.ghost) && u.area === a)).toHaveLength(1);
    expect(() => endPhase(g)).toThrow(/minefields/);
    golan.autoMinefields(g); endPhase(g);
    expect([g.phase, g.phasing, g.turn]).toEqual(['combat', 'syrian', 1]);
    expect(golan.state(g).freeCombatRound).toBe(2);
  });
  it('the errata\'s rough historical placement is one click', () => {
    const g = newGolanGame(3, 'badr', false); golan.autoStrongpoints(g, 'historical');
    expect([unit(g, 'I27').area, unit(g, 'I29').area, unit(g, 'I31').area, unit(g, 'I23').area]).toEqual([59, 57, 49, 48]);
  });
  it('14.02: three free minefields, not on the AT ditch, escarpment, river, Mt Hermon or rugged, one mined boundary per area', () => {
    const g = newGolanGame(3, 'badr', false), opts = golan.minefieldOptions(g);
    expect(opts.length).toBeGreaterThan(20);
    for (const k of opts) { const [a, b] = k.split('-').map(Number), c = connection(a, b)!; expect(c.atDitch || c.escarpment || c.river || c.rugged || c.hermon).toBeFalsy(); }
    for (const a of [29, 30, 47, 48, 50, 51]) expect(opts.some((k) => k.split('-').map(Number).includes(a))).toBe(false);   // next to a printed minefield
    const [a, b] = opts[0].split('-').map(Number); golan.placeMinefield(g, a, b);
    expect(golan.minefieldOptions(g).some((k) => k.split('-').map(Number).some((x) => x === a || x === b))).toBe(false);
    expect(() => golan.placeMinefield(g, a, b)).toThrow(/not a boundary/);
    golan.autoMinefields(g); expect(golan.state(g).minefields).toHaveLength(6); expect(golan.minefieldOptions(g)).toEqual([]);
  });
});
