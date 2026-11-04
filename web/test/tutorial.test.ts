import { describe, expect, it } from 'vitest';
import * as E from '../../engine/src';
import { LESSONS, U, replay } from '../src/tutorial-script';

describe('tutorial lessons', () => {
  for (let i = 0; i < LESSONS.length; i++) it(`lesson ${i} · ${LESSONS[i].topic}: every step reaches its goal`, () => {
    LESSONS[i].steps.forEach((s, k) => {
      if (!s.done || s.tap || !(s.act || s.auto || s.undo)) return;
      const g = replay(i, k + 1); if (s.skip?.(replay(i, k))) return;
      expect(s.done(g, () => true), `lesson ${i} step ${k} "${s.title}"`).toBe(true);
    });
  });
  const battleOf = (i: number, title: string) => { const L = LESSONS[i]; const k = L.steps.findIndex((s) => s.title === title); let b: E.Battle | null = null; for (let n = 1; n <= k + 1; n++) b = replay(i, n).battle ?? b; return b!; };
  it('23.5: two hits on the 18th VG, attack aborted', () => {
    const b = battleOf(5, 'Two hits'), g = replay(5, LESSONS[5].steps.findIndex((s) => s.title === 'Two hits') + 1);
    expect(b.rolls.filter((x) => x.kind === 'ground').reduce((t, x) => t + x.hits, 0)).toBe(2);
    expect(b.result).toMatch(/aborted/); expect(U(g, '18 VG').str).toBe(2); expect(U(g, '18 VG').disorder).toBe(1);
  });
  it('23.6: the 116th scores three hits and passes exploitation', () => {
    const b = battleOf(6, 'Exploitation'), g = replay(6, LESSONS[6].steps.length);
    const off = b.rolls.find((x) => x.who.includes('116') && x.kind === 'ground')!; expect(off.dice).toEqual([1, 6, 5]); expect(off.hits).toBe(3);
    expect(b.rolls.filter((x) => x.kind === 'arty').every((x) => x.hits === 0)).toBe(true);
    expect(U(g, '112/28').area).toBe(null); expect(U(g, '116 Pz').exploit).toBe(true);
  });
  it('23.7: breakthrough combats in Houffalize and Vielsalm', () => {
    const g = replay(7, LESSONS[7].steps.length);
    expect(U(g, '116 Pz').str).toBe(2); expect(U(g, 'CCR/9').area).toBe(48); expect(U(g, 'CCR/9').disorder).toBeGreaterThan(0);
    expect(U(g, '106 Inf').area).toBe(35); expect(U(g, '106 Inf').str).toBe(2);
    expect(U(g, 'Lehr').area).toBe(24); expect(U(g, '150 Pz').area).toBe(22);
  });
  it('23.8: KG Peiper is cut off, the others are supplied', () => {
    const g = LESSONS[8].setup();
    expect(E.inSupply(g, 'german', 51)).toBe(false);
    for (const a of [33, 25, 24, 34]) expect(E.inSupply(g, 'german', a), String(a)).toBe(true);
  });
  it('Back: a replay to any step never throws', () => { for (let i = 0; i < LESSONS.length; i++) for (let k = 0; k <= LESSONS[i].steps.length; k++) replay(i, k); });
});
