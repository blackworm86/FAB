/** The tutorial courses (docs/TUTORIAL.md): The Bulge teaches the series in one turn; Golan '73 and Sicily teach only what is new.
 *  The lessons live in tutorial-basics.ts, tutorial-golan-new.ts and tutorial-sicily-new.ts on the kit in tutorial-kit.ts; this file is the registry and the replay. */
import type { Course, G } from './tutorial-kit';
import { BASICS_COURSE } from './tutorial-basics';
import { GOLAN_WHATS_NEW } from './tutorial-golan-new';
import { SICILY_WHATS_NEW } from './tutorial-sicily-new';
export type { Course, Lesson, Step, Target } from './tutorial-kit';
export { U } from './tutorial-kit';

export const COURSES: Course[] = [BASICS_COURSE, GOLAN_WHATS_NEW, SICILY_WHATS_NEW];
/** The courses before 14 November 2026 had other ids; their addresses (and saved bookmarks) open the new course of the same game. */
const OLD: Record<string, string> = {
  bulge: 'bulge-basics',
  golan73: 'golan73-whats-new',
  'golan73-new': 'golan73-whats-new',
  sicily: 'sicily-whats-new',
  'sicily-new': 'sicily-whats-new',
};
export const courseFor = (id: string | null | undefined) => COURSES.find((c) => c.id === (OLD[id ?? ''] ?? id)) ?? COURSES[0];
export { coursesOf } from './tutorial-list';

/** Play the first `upTo` steps of a lesson in engine terms (Back, and the tests). */
export function replay(course: Course, i: number, upTo: number): G {
  const L = course.lessons[i],
    g0 = L.setup();
  let g = g0;
  const before: string[] = [];
  for (const s of L.steps.slice(0, upTo)) {
    if (s.skip?.(g)) continue;
    if (s.undo) {
      const p = before.pop();
      if (p) g = JSON.parse(p);
      continue;
    }
    s.enter?.(g);
    if (s.auto || s.act) before.push(JSON.stringify(g));
    s.auto?.(g);
    s.act?.(g);
  }
  return g;
}
