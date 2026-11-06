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
  it('two seats writing at once: each diff against the same base lands, neither loses the other\'s change', () => {
    const base = newGame(7); base.phase = 'admin'; const t0 = toTree(base);
    const gA = JSON.parse(JSON.stringify(base)), gB = JSON.parse(JSON.stringify(base));
    const uA = gA.units.find((u: { area: number | null }) => u.area != null); uA.disorder = 1; gA.log.push('A acted');                 // the German seat touches a unit
    const cB = gB.chits.find((c: { box: string }) => c.box === 'available') ?? gB.chits[0]; cB.box = 'used'; gB.log.push('B acted');  // the Allied seat touches a chit
    const dA = diffTree(t0, toTree(gA)), dB = diffTree(t0, toTree(gB));
    expect(Object.keys(dA).filter((k) => k !== 'f/log')).toHaveLength(1); expect(Object.keys(dB).filter((k) => k !== 'f/log')).toHaveLength(1);
    const merged: Record<string, string> = Object.fromEntries(Object.entries(t0).flatMap(([sec, m]) => Object.entries(m as Record<string, string>).map(([k, v]) => [`${sec}/${k}`, v] as [string, string])));
    for (const d of [dA, dB]) for (const [k, v] of Object.entries(d)) { if (k === 'f/log') continue; if (v === null) delete merged[k]; else merged[k] = v; }   // what the server does with two updates
    const tree = { f: {}, units: {}, chits: {} } as Record<string, Record<string, string>>; for (const [k, v] of Object.entries(merged)) { const [sec, key] = k.split('/'); tree[sec][key] = v; }
    const g = fromTree(tree as never);
    expect(g.units.find((u) => u.id === uA.id)!.disorder).toBe(1); expect(g.chits.find((c) => c.id === cB.id)!.box).toBe('used');
  });
});
