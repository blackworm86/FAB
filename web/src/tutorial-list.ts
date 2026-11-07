/** The tutorial courses as the home page lists them (the lessons themselves load only when a course opens). */
export interface CourseInfo { id: string; game: string; title: string; sub: string; blurb: string; minutes: number }
export const COURSE_INFO: CourseInfo[] = [
  { id: 'bulge', game: 'bulge', title: 'The Bulge: learn to play', sub: '13 lessons · about 65 minutes', minutes: 66,
    blurb: 'The pieces, the map and the score, then a whole turn played step by step on the Play Book\'s examples. You play the Germans; the coach plays the Allies.' },
  { id: 'golan73', game: 'golan73', title: "Golan '73: learn to play", sub: '18 lessons · about 95 minutes', minutes: 94,
    blurb: 'The sides, the ground and the score, then every phase of the Golan turn on the Play Book\'s examples, on both sides of the line.' },
  { id: 'golan73-new', game: 'golan73', title: "Golan '73: what's new", sub: '16 lessons · about 85 minutes', minutes: 87,
    blurb: 'For players who know The Bulge: the new ground, the new units and assets, and the Golan examples, without the series basics.' },
  { id: 'sicily', game: 'sicily', title: 'Sicily: learn to play', sub: '12 lessons · about 55 minutes', minutes: 53,
    blurb: 'The four nations, the island and the score, then the invasion on the Play Book\'s examples: setting up, landing, beach assaults, army zones, ports, the air war and fading Italian morale.' },
  { id: 'sicily-new', game: 'sicily', title: "Sicily: what's new", sub: '11 lessons · about 50 minutes', minutes: 48,
    blurb: 'For players who know The Bulge: landings and beach assaults, untried garrisons, army zones, ports, naval support and Italian morale, without the series basics.' },
];
export const infoOf = (id: string) => COURSE_INFO.find((c) => c.id === id)!;
export const coursesOf = (game: string) => COURSE_INFO.filter((c) => c.game === game);
