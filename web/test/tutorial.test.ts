import { describe, expect, it } from 'vitest';
import * as E from '../../engine/src';
import { COURSES, U, replay, type Course } from '../src/tutorial-script';

for (const course of COURSES)
  describe(`course ${course.id}`, () => {
    it('has unique lesson ids and every lesson a chapter, a goal and steps', () => {
      const ids = course.lessons.map((l) => l.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const l of course.lessons) {
        expect(l.chapter).toBeTruthy();
        expect(l.goal).toBeTruthy();
        expect(l.steps.length).toBeGreaterThan(1);
      }
    });
    for (let i = 0; i < course.lessons.length; i++)
      it(`lesson ${i} · ${course.lessons[i].topic}: every step reaches its goal`, () => {
        course.lessons[i].steps.forEach((s, k) => {
          if (!s.done || s.tap || !(s.act || s.auto || s.undo)) return;
          const g = replay(course, i, k + 1);
          if (s.skip?.(replay(course, i, k))) return;
          expect(
            s.done(g, () => true),
            `${course.id} lesson ${i} step ${k} "${s.title}"`,
          ).toBe(true);
        });
      });
    it('Back: a replay to any step never throws, and every figure renders', () => {
      for (let i = 0; i < course.lessons.length; i++)
        for (let k = 0; k <= course.lessons[i].steps.length; k++) {
          const g = replay(course, i, k);
          for (const s of course.lessons[i].steps) if (s.figure) expect(s.figure(g)).toContain('<');
        }
    });
  });

const bulge = COURSES.find((c) => c.id === 'bulge-basics')!,
  golan = COURSES.find((c) => c.id === 'golan73-whats-new')!,
  sicily = COURSES.find((c) => c.id === 'sicily-whats-new')!;
const lesson = (c: Course, id: string) => {
  const i = c.lessons.findIndex((l) => l.id === id);
  if (i < 0) throw new Error(id);
  return i;
};
const battleOf = (c: Course, i: number, title: string) => {
  const L = c.lessons[i];
  const k = L.steps.findIndex((s) => s.title === title);
  let b: E.Battle | null = null;
  for (let n = 1; n <= k + 1; n++) b = replay(c, i, n).battle ?? b;
  return b!;
};
const atEnd = (c: Course, id: string) => {
  const i = lesson(c, id);
  return replay(c, i, c.lessons[i].steps.length);
};
describe("The Bulge: the book's outcomes", () => {
  it('23.5: two hits on the 18th VG, attack aborted', () => {
    const i = lesson(bulge, 'fight'),
      b = battleOf(bulge, i, 'A hard choice'),
      g = replay(bulge, i, bulge.lessons[i].steps.findIndex((s) => s.title === 'A hard choice') + 1);
    expect(b.rolls.filter((x) => x.kind === 'ground').reduce((t, x) => t + x.hits, 0)).toBe(2);
    expect(b.result).toMatch(/aborted/);
    expect(U(g, '18 VG').str).toBe(2);
    expect(U(g, '18 VG').disorder).toBe(1);
  });
  it('23.6: the 116th scores three hits and passes exploitation', () => {
    const i = lesson(bulge, 'win'),
      b = battleOf(bulge, i, 'Exploit!'),
      g = atEnd(bulge, 'win');
    const off = b.rolls.find((x) => x.who.includes('116') && x.kind === 'ground')!;
    expect(off.dice).toEqual([1, 6, 5]);
    expect(off.hits).toBe(3);
    expect(b.rolls.filter((x) => x.kind === 'arty').every((x) => x.hits === 0)).toBe(true);
    expect(U(g, '112/28').area).toBe(null);
    expect(U(g, '116 Pz').exploit).toBe(true);
  });
  it('23.7: the breakthrough battle in Houffalize', () => {
    const g = atEnd(bulge, 'breakthrough');
    expect(U(g, '116 Pz').str).toBe(2);
    expect(U(g, 'CCR/9').area).toBe(48);
    expect(U(g, 'CCR/9').disorder).toBeGreaterThan(0);
    expect(U(g, 'Lehr').area).toBe(24);
  });
  it('23.8: KG Peiper is cut off, the others are supplied', () => {
    const g = bulge.lessons[lesson(bulge, 'supply')].setup();
    expect(E.inSupply(g, 'german', 51)).toBe(false);
    for (const a of [33, 25, 24, 34]) expect(E.inSupply(g, 'german', a), String(a)).toBe(true);
  });
});
describe("Golan '73: the book's outcomes", () => {
  it('Ex 6: the recon fails its minefield check and goes round, the 52nd passes, the 46th Tank crosses the ditch', () => {
    const g = atEnd(golan, 'gn-purple-line');
    expect(E.golan.state(g).minefieldFailed).toContain('S11');
    expect(U(g, 'S11').area).toBe(47);
    expect(U(g, 'S04').area).toBe(47);
    expect(U(g, 'S14').area).toBe(50);
    expect(E.contested(g, 50)).toBe(true);
  });
  it('Ex 9: the strongpoint in Juhader is eliminated and the ditch bridged towards Dhake', () => {
    const g = atEnd(golan, 'gn-strongpoints');
    expect(U(g, 'I30').area).toBe(null);
    expect(E.golan.state(g).bridgedDitch).toContain('28-79');
  });
  it('Ex 2: the first SAM cancels the Jasim mission, the second misses', () => {
    const g = atEnd(golan, 'gn-sams');
    expect(E.chit(g, 'IC03').box).toBe('used');
    expect(g.interdicted[73]).toBe('IC10a');
    expect(g.interdicted[75]).toBeUndefined();
  });
  it('Ex 11: jammed and beaten, Golani retreats disordered', () => {
    const g = atEnd(golan, 'gn-ew');
    expect(U(g, 'I01').area).toBe(34);
    expect(U(g, 'I01').disorder).toBe(1);
  });
});
describe("Sicily: the book's outcomes", () => {
  it('Ex 14: both garrisons eliminated; the naval support removes the Gela field works', () => {
    expect(U(atEnd(sicily, 'sn-italians'), 'IT09').str).toBe(0);
    const g = atEnd(sicily, 'sn-navy');
    expect(U(g, 'IT37').str).toBe(0);
    expect(g.fieldWorks).not.toContain(19);
  });
  it('Ex 5: after the release the 5th Infantry reaches Regalbuto', () => {
    const i = lesson(sicily, 'sn-zones'),
      g0 = sicily.lessons[i].setup();
    g0.phase = 'movement';
    expect(E.moveOptions(g0, 'BR03').map((o) => o.area)).not.toContain(25);
    expect(U(atEnd(sicily, 'sn-zones'), 'BR03').area).toBe(25);
  });
  it('Ex 3: Bolognetta stays interdicted, Salemi is freed', () => {
    const g = atEnd(sicily, 'sn-air');
    expect(g.interdicted[56]).toBe('USC06a');
    expect(g.interdicted[59]).toBeUndefined();
  });
});
