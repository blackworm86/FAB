// 20.3 Operation Al-Owda: the Syrian plan to attack at dawn, six turns on the whole map but Mt Hermon.
import { describe, expect, it } from 'vitest';
import { endPhase, victory, golan, type Game } from '../src';
import { newGolanGame, unit, playOut } from './golan-helpers';

const alowda = (seed = 4): Game => newGolanGame(seed, 'alowda' as 'badr');

describe('Operation Al-Owda (20.3)', () => {
  it('sets up: six turns, Mt Hermon already Syrian, the Syrians to place their sixteen units', () => {
    const g = alowda();
    expect(g.lastTurn).toBe(6); expect(g.phase).toBe('deploy'); expect(g.phasing).toBe('syrian');
    expect(g.inPlay).not.toContain(golan.HERMON); expect(g.control[golan.HERMON]).toBe('syrian');
    expect(g.units.filter((u) => u.box === 'deploy').length).toBe(16);
    for (const id of ['S24', 'S22', 'S17', 'S23']) expect(g.units.some((u) => u.id === id)).toBe(false);
    expect(unit(g, 'S21').arrival).toBe(3); expect(unit(g, 'S18').box).toBeUndefined();
    expect(unit(g, 'I03').area).toBe(31);                                                             // Israeli regulars at their start areas
    expect(golan.isNight(g)).toBe(false); g.turn = 2; expect(golan.isNight(g)).toBe(false);
  });
  it('the Syrians place one unit per tank-symbol area, and up to two commandos', () => {
    const g = alowda(), first = g.units.find((u) => u.box === 'deploy')!;
    const opts = golan.deployOptions(g, first.id); expect(opts.length).toBeGreaterThanOrEqual(16);
    golan.deploy(g, first.id, opts[0]); expect(golan.deployOptions(g, g.units.find((u) => u.box === 'deploy')!.id)).not.toContain(opts[0]);
    const cmd = g.chits.filter((c) => c.kind === 'commando' && c.side === 'syrian' && c.box === 'available');
    expect(cmd.length).toBeGreaterThanOrEqual(2);
    const at = golan.alowdaRaidAreas(g); expect(at).not.toContain(17); expect(at).not.toContain(golan.HERMON);
    golan.alowdaRaid(g, cmd[0].id, at[0]); golan.alowdaRaid(g, cmd[1].id, at[1]);
    expect(golan.alowdaRaidAreas(g)).toEqual([]);
  });
  it('Israel starts with 3 VPs; no sudden death; plays out to a result', () => {
    const g = alowda(); expect(victory(g).israeli).toBeGreaterThanOrEqual(3);
    for (const u of g.units.filter((x) => x.box === 'deploy')) golan.deploy(g, u.id, golan.deployOptions(g, u.id)[0]);
    endPhase(g); expect(g.phase).toBe('movement'); expect(g.turn).toBe(1);
    playOut(g); expect(g.over).toMatch(/Victory|Draw/); expect(g.turn).toBe(6);
  });
});
