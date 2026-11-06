import { describe, expect, it } from 'vitest';
import * as E from '../../engine/src';
import { COURSES, U, replay, type Course } from '../src/tutorial-script';

for (const course of COURSES) describe(`course ${course.id}`, () => {
  it('has unique lesson ids and every lesson a chapter, a goal and steps', () => {
    const ids = course.lessons.map((l) => l.id); expect(new Set(ids).size).toBe(ids.length);
    for (const l of course.lessons) { expect(l.chapter).toBeTruthy(); expect(l.goal).toBeTruthy(); expect(l.steps.length).toBeGreaterThan(1); }
  });
  for (let i = 0; i < course.lessons.length; i++) it(`lesson ${i} · ${course.lessons[i].topic}: every step reaches its goal`, () => {
    course.lessons[i].steps.forEach((s, k) => {
      if (!s.done || s.tap || !(s.act || s.auto || s.undo)) return;
      const g = replay(course, i, k + 1); if (s.skip?.(replay(course, i, k))) return;
      expect(s.done(g, () => true), `${course.id} lesson ${i} step ${k} "${s.title}"`).toBe(true);
    });
  });
  it('Back: a replay to any step never throws, and every figure renders', () => {
    for (let i = 0; i < course.lessons.length; i++) for (let k = 0; k <= course.lessons[i].steps.length; k++) {
      const g = replay(course, i, k);
      for (const s of course.lessons[i].steps) if (s.figure) expect(s.figure(g)).toContain('<');
    }
  });
});

const bulge = COURSES[0], golan = COURSES[1];
const lesson = (c: Course, id: string) => { const i = c.lessons.findIndex((l) => l.id === id); if (i < 0) throw new Error(id); return i; };
const battleOf = (c: Course, i: number, title: string) => { const L = c.lessons[i]; const k = L.steps.findIndex((s) => s.title === title); let b: E.Battle | null = null; for (let n = 1; n <= k + 1; n++) b = replay(c, i, n).battle ?? b; return b!; };
describe('The Bulge: the book\'s outcomes', () => {
  it('23.5: two hits on the 18th VG, attack aborted', () => {
    const i = lesson(bulge, 'combat'), b = battleOf(bulge, i, 'Two hits on you'), g = replay(bulge, i, bulge.lessons[i].steps.findIndex((s) => s.title === 'Two hits on you') + 1);
    expect(b.rolls.filter((x) => x.kind === 'ground').reduce((t, x) => t + x.hits, 0)).toBe(2);
    expect(b.result).toMatch(/aborted/); expect(U(g, '18 VG').str).toBe(2); expect(U(g, '18 VG').disorder).toBe(1);
  });
  it('23.6: the 116th scores three hits and passes exploitation', () => {
    const i = lesson(bulge, 'exploitation'), b = battleOf(bulge, i, 'Exploitation'), g = replay(bulge, i, bulge.lessons[i].steps.length);
    const off = b.rolls.find((x) => x.who.includes('116') && x.kind === 'ground')!; expect(off.dice).toEqual([1, 6, 5]); expect(off.hits).toBe(3);
    expect(b.rolls.filter((x) => x.kind === 'arty').every((x) => x.hits === 0)).toBe(true);
    expect(U(g, '112/28').area).toBe(null); expect(U(g, '116 Pz').exploit).toBe(true);
  });
  it('23.7: breakthrough combats in Houffalize and Vielsalm', () => {
    const i = lesson(bulge, 'breakthrough'), g = replay(bulge, i, bulge.lessons[i].steps.length);
    expect(U(g, '116 Pz').str).toBe(2); expect(U(g, 'CCR/9').area).toBe(48); expect(U(g, 'CCR/9').disorder).toBeGreaterThan(0);
    expect(U(g, '106 Inf').area).toBe(35); expect(U(g, '106 Inf').str).toBe(2);
    expect(U(g, 'Lehr').area).toBe(24); expect(U(g, '150 Pz').area).toBe(22);
  });
  it('23.8: KG Peiper is cut off, the others are supplied', () => {
    const g = bulge.lessons[lesson(bulge, 'supply')].setup();
    expect(E.inSupply(g, 'german', 51)).toBe(false);
    for (const a of [33, 25, 24, 34]) expect(E.inSupply(g, 'german', a), String(a)).toBe(true);
  });
});
describe('Golan \'73: the book\'s outcomes', () => {
  it('Ex 2: the first SAM cancels the Jasim mission, the second misses', () => {
    const i = lesson(golan, 'g-reinforcement'), L = golan.lessons[i], g = replay(golan, i, L.steps.findIndex((s) => s.title === 'Fire again') + 1);
    expect(E.chit(g, 'IC03').box).toBe('used'); expect(g.interdicted[73]).toBe('IC10a'); expect(g.interdicted[75]).toBeUndefined();
    expect(g.chits.filter((c) => c.kind === 'sam' && c.box === 'eliminated').length).toBe(1);
  });
  it('Ex 3: the 4th Mech reaches Sindiana for 6 and Golani stops in Hushniyah', () => {
    const i = lesson(golan, 'g-move-israeli'), g = replay(golan, i, golan.lessons[i].steps.length);
    expect(U(g, 'I11').area).toBe(37); expect(U(g, 'I01').area).toBe(38); expect(U(g, 'I03').area).toBe(33); expect(E.contested(g, 33)).toBe(true);
  });
  it('Ex 6: the 52nd fails its minefield check and the recon goes round', () => {
    const i = lesson(golan, 'g-move-syrian'), g = replay(golan, i, golan.lessons[i].steps.length);
    expect(U(g, 'S04').area).toBe(48); expect(E.golan.state(g).minefieldFailed).toContain('S04'); expect(U(g, 'S11').area).toBe(47); expect(U(g, 'S14').area).toBe(50); expect(E.contested(g, 50)).toBe(true);
  });
  it('Ex 8: field works gone, the Task Force lost, the 91st retreats to Keshet with a step lost', () => {
    const i = lesson(golan, 'g-combat'), g = replay(golan, i, golan.lessons[i].steps.length);
    expect(g.fieldWorks).not.toContain(38); expect(E.chit(g, 'IC11a').box).toBe('eliminated');
    expect(U(g, 'S26').area).toBe(32); expect(U(g, 'S26').str).toBe(2); expect(U(g, 'S26').disorder).toBe(1);
  });
  it('Ex 9: the strongpoint in Juhader is eliminated and the ditch bridged towards Dhake', () => {
    const i = lesson(golan, 'g-assault'), g = replay(golan, i, golan.lessons[i].steps.length);
    expect(U(g, 'I30').area).toBe(null); expect(E.golan.state(g).bridgedDitch).toContain('28-79');
  });
  it('Ex 15: three Syrian blocks supplied, the 78th cut off', () => {
    const g = golan.lessons[lesson(golan, 'g-supply')].setup();
    for (const a of [49, 56, 58]) expect(E.inSupply(g, 'syrian', a), String(a)).toBe(true);
    expect(E.inSupply(g, 'syrian', 52)).toBe(false);
  });
});
