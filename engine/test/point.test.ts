import { describe, expect, it } from 'vitest';
import { newGame, startBattle, mustFight, setReady, setPoint, pointChoices, pointPending } from '../src';

// issue #18: a side with two or more possible point units must choose one (6.24); a lone unit is chosen for it
describe('6.24 point unit choice', () => {
  it('refuses the Attacker’s last Ready until he chooses; a lone Defender unit needs no choice', () => {
    const g = newGame(1);
    g.phase = 'combat';
    g.phasing = 'german';
    g.deferBegin = true;
    const b = startBattle(g, mustFight(g).find((a) => a === 9)!);
    expect(pointChoices(g, b, 'german').length).toBeGreaterThan(1);
    expect(pointChoices(g, b, 'allied')).toHaveLength(1);
    setReady(g, b, 'german'); // assets
    expect(pointPending(g, b, 'allied')).toBe(false);
    setReady(g, b, 'allied');
    expect(pointPending(g, b, 'german')).toBe(true);
    expect(() => setReady(g, b, 'german')).toThrow(/choose your point unit first/);
    setPoint(g, b, 'german', pointChoices(g, b, 'german')[1]);
    expect(b.pointSet).toContain('german');
    setReady(g, b, 'german');
    expect(b.attPointDone).toBe(true);
  });
});
