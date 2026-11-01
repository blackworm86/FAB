import { describe, expect, it } from 'vitest';
import { newGame, toTree, fromTree, diffTree, startBattle, mustFight } from '../src';

describe('game as small values', () => {
  it('round-trips the whole game', () => {
    const g = newGame(5); expect(fromTree(toTree(g))).toEqual(JSON.parse(JSON.stringify(g)));
  });
  it('a move writes only what changed', () => {
    const g = newGame(5); g.phase = 'combat'; g.phasing = 'german'; const before = toTree(g);
    startBattle(g, mustFight(g)[0] ?? 11);
    const d = diffTree(before, toTree(g)), keys = Object.keys(d);
    expect(keys.length).toBeLessThan(10); expect(keys).toContain('f/battle'); expect(keys.some((k) => k.startsWith('units/'))).toBe(false);
  });
  it('removing a field removes its path', () => {
    const g = newGame(5), t = toTree(g); const t2 = toTree(g); delete t2.f.battle;
    expect(diffTree(t, t2)['f/battle']).toBeNull();
  });
});
