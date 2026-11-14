/** The tutorial courses as the home page lists them (the lessons themselves load only when a course opens). */
export interface CourseInfo {
  id: string;
  game: string;
  title: string;
  sub: string;
  blurb: string;
  minutes: number;
}
export const COURSE_INFO: CourseInfo[] = [
  {
    id: 'bulge-basics',
    game: 'bulge',
    title: 'The Bulge: your first turn',
    sub: '9 lessons · about 22 minutes',
    minutes: 22,
    blurb:
      "Who you are, what you fight for, then one German turn step by step, on the Play Book's own examples: chits, moving, battles, breakthrough, supply, the score.",
  },
  {
    id: 'golan73-whats-new',
    game: 'golan73',
    title: "Golan '73: what's new",
    sub: '6 lessons · about 13 minutes',
    minutes: 13,
    blurb:
      "For players who know The Bulge: the Purple Line, minefields and the anti-tank ditch, strongpoints and ghosts, SAMs, electronic warfare and Syria's special forces.",
  },
  {
    id: 'sicily-whats-new',
    game: 'sicily',
    title: "Sicily: what's new",
    sub: '7 lessons · about 13 minutes',
    minutes: 13,
    blurb:
      'For players who know The Bulge: landings and airborne drops, the untried Italian garrisons, the fleet and the air war, two Allied armies on one island.',
  },
];
export const infoOf = (id: string) => COURSE_INFO.find((c) => c.id === id)!;
export const coursesOf = (game: string) => COURSE_INFO.filter((c) => c.game === game);
