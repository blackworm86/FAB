import { describe, expect, it } from 'vitest';
import { newGame, mustFight, startBattle, defensiveFire, attackerChoice, offensiveFire, defenderChoice, endPhase, moveOptions, move, contestedAreas, unitsIn } from '../src';

function fightAll(g: ReturnType<typeof newGame>) {
  for (const a of contestedAreas(g)) {
    if (g.fought.includes(a)) continue;
    let b; try { b = startBattle(g, a); } catch { continue; }
    defensiveFire(g, b);
    if (b.stage === 'attChoice') attackerChoice(g, b, false);
    if (b.stage === 'offFire') offensiveFire(g, b);
    if (b.stage === 'defChoice') defenderChoice(g, b, true);
    expect(b.stage).toBe('done');
  }
}
describe('tournament demo flow', () => {
  it('sets up 31 units, 4 garrisons and the T1 German combat phase', () => {
    const g = newGame(1);
    expect(g.units.filter((u) => u.area != null && !u.garrison)).toHaveLength(31);
    expect(g.units.find((u) => u.name === '4 Inf')!.str).toBe(2);
    expect(g.control[47]).toBe('allied'); expect(g.control[6]).toBe('german'); expect(g.control[12]).toBe('allied');
    expect(mustFight(g).sort((a, b) => a - b)).toEqual([9, 10, 11, 12, 16, 18, 19, 21]);
  });
  it('plays turns 1-2 without errors and keeps units consistent', () => {
    const g = newGame(7);
    expect(() => endPhase(g)).toThrow();                 // mandatory combats first
    for (let step = 0; step < 40 && !g.over && g.turn < 3; step++) {
      if (g.phase === 'combat') fightAll(g);
      if (g.phase === 'movement') {
        for (const u of g.units.filter((x) => x.side === g.phasing && x.area != null)) { const o = moveOptions(g, u.id); if (o.length) move(g, u.id, o[o.length - 1].area); }
      }
      endPhase(g);
    }
    expect(g.turn).toBe(3);
    for (const a of [...Array(98)].map((_, i) => i + 1)) expect(unitsIn(g, a, 'german').filter((u) => !u.garrison).length).toBeLessThanOrEqual(2);
    expect(g.units.every((u) => u.area == null || (u.str >= 1 && u.str <= u.max))).toBe(true);
    expect(g.units.some((u) => u.name === '7 Arm' && u.area != null)).toBe(true);   // turn-2 reinforcement arrived
  });
});
