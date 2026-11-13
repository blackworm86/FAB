import { describe, expect, it } from 'vitest';
import * as E from '../src';

describe('24.3 Introductory scenario "Nuts!"', () => {
  it('sets up only the listed forces on the sheet', () => {
    const g = E.newGame(1, { scenario: 'intro' });
    const at = (a: number) =>
      E.unitsIn(g, a)
        .map((u) => u.name)
        .sort();
    expect(at(12)).toEqual(['112/28', '116 Pz', '560 VG']);
    expect(at(20)).toEqual(['26 VG']);
    expect(at(47)).toEqual(['Garrison Bastogne']);
    expect(g.units.filter((u) => u.area != null).length).toBe(13);
    expect(g.lastTurn).toBe(3);
    expect(E.boxOf(g, 'german', 'available').length).toBe(7);
    expect(E.boxOf(g, 'allied', 'available').length).toBe(0);
    expect(E.neighbors(47).every((n) => g.inPlay!.includes(n))).toBe(true);
    expect(E.mustFight(g).sort((a, b) => a - b)).toEqual([12, 19, 21]);
  });
  it('plays the three turns to a result', () => {
    for (const seed of [1, 2, 3]) {
      const g = E.newGame(seed, { scenario: 'intro' });
      for (let i = 0; i < 400 && !g.over; i++) {
        for (const a of E.mustFight(g)) {
          const b = E.startBattle(g, a, g.phase === 'btCombat');
          E.beginCombat(g, b);
          for (let k = 0; k < 90 && b.stage !== 'done'; k++) {
            if (b.stage === 'attChoice') E.attackerChoice(g, b, false);
            else if (b.stage === 'defChoice') E.defenderChoice(g, b, false);
            else if (b.stage === 'attFirst') E.chooseFirstLoss(g, b, b.attPoint);
            else if (b.stage === 'retreat') E.chooseRetreat(g, b, E.retreatOptions(g, b)[0]);
            else if (b.stage === 'exploit') E.declineExploit(g, b);
            else E.roll_step(g, b);
          }
          E.closeBattle(g);
        }
        E.autoRecover(g);
        E.endPhase(g);
      }
      expect(g.over).toMatch(/Victory/);
      expect(g.units.find((u) => u.name === '10 Arm')!.area).not.toBeNull();
    }
  });
  it('scores the end of turn 3 (24.37)', () => {
    const fresh = () => {
      const g = E.newGame(1, { scenario: 'intro' });
      for (const u of g.units) if (u.area === 47) u.area = null;
      return g;
    };
    const put = (g: E.Game, name: string, str: number) => {
      const u = g.units.find((x) => x.name === name)!;
      u.area = 47;
      u.str = str;
    };
    let g = fresh();
    put(g, '26 VG', 3);
    g.control[47] = 'german'; // German alone in Bastogne
    expect(E.introResult(g)).toBe('German Decisive Victory (uncontested Bastogne)');
    g = fresh();
    g.control[47] = 'german'; // taken and left empty: still uncontested German control
    expect(E.introResult(g)).toBe('German Decisive Victory (uncontested Bastogne)');
    g = fresh();
    put(g, '26 VG', 3);
    put(g, 'CCR/9', 2);
    g.control[47] = 'allied'; // contested: 3 points, minus 2 for each key area not German
    for (const a of [39, 36, 48, 63, 64]) g.control[a] = 'german';
    g.control[64] = 'allied';
    expect(E.introResult(g)).toBe('Allied Marginal Victory (German 1, Allied 2)');
    g.control[64] = 'german';
    expect(E.introResult(g)).toBe('German Marginal Victory (German 3, Allied 2)');
  });
});
