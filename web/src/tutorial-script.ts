/** The tutorial courses: one per volume for a first game, and "what's new" courses for players who know an earlier volume.
 *  The lessons live in tutorial-bulge.ts, tutorial-golan.ts and tutorial-sicily.ts on the kit in tutorial-kit.ts; this file is the registry and the replay. */
import type { Course, G } from './tutorial-kit';
import { BULGE_COURSE } from './tutorial-bulge';
import { GOLAN_COURSE, GOLAN_NEW_COURSE } from './tutorial-golan';
import { SICILY_COURSE, SICILY_NEW_COURSE } from './tutorial-sicily';
import { BASICS_COURSE } from './tutorial-basics';
import { GOLAN_WHATS_NEW } from './tutorial-golan-new';
import { SICILY_WHATS_NEW } from './tutorial-sicily-new';
export type { Course, Lesson, Step, Target } from './tutorial-kit';
export { U } from './tutorial-kit';

export const COURSES: Course[] = [
  BULGE_COURSE,
  GOLAN_COURSE,
  GOLAN_NEW_COURSE,
  SICILY_COURSE,
  SICILY_NEW_COURSE,
  BASICS_COURSE,
  GOLAN_WHATS_NEW,
  SICILY_WHATS_NEW,
]; // the new short course (tutorial-basics.ts) is reached only by its address until it replaces the old one
export const courseFor = (id: string | null | undefined) => COURSES.find((c) => c.id === id) ?? COURSES[0];
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
