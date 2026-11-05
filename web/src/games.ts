/** The games that share the FAB series rules, as the home page and the lobby need them (no engine import: the home page shows every game, not only the one loaded). */
/** testing: a scenario still being built and checked; only the admin sandbox offers it. */
export interface ScenarioInfo { id: string; name: string; sub: string; title: string; testing?: boolean }
export interface GameInfo {
  id: string; name: string; vol: string; blurb: string; when: string; ready: boolean;
  sides: [string, string]; tag: Record<string, string>; sideName: Record<string, string>;      // First Player first; the database seats keep the keys german (first) and allied (second)
  scenarios: ScenarioInfo[]; defaultScenario: string;
  fuel: boolean;              // the game has The Bulge's fuel rule switch (16.13)
  optional: boolean;          // the Play Book 18 optional rules chooser applies
}
export const GAMES: GameInfo[] = [
  { id: 'bulge', name: 'The Bulge', vol: 'Vol. 1', blurb: 'Ardennes, December 1944. German offensive against the thin American line.', when: 'Ardennes · Dec 1944 – Jan 1945', ready: true,
    sides: ['german', 'allied'], tag: { german: 'GE', allied: 'AL' }, sideName: { german: 'German', allied: 'Allied' },
    scenarios: [{ id: 'tournament', name: 'Tournament', sub: '5 turns', title: 'Tournament (24.2), 5 turns' }, { id: 'campaign', name: 'Campaign', sub: '9 turns', title: 'Campaign (24.1), 9 turns' },
      { id: 'intro', name: 'Nuts!', sub: '3 turns · Bastogne', title: 'Nuts! Introductory (24.3), 3 turns' }, { id: 'cold', name: 'Cold Shoulder', sub: '9 turns · Zone 6', title: 'Cold Shoulder bonus scenario, 9 turns' }],
    defaultScenario: 'tournament', fuel: true, optional: true },
  { id: 'sicily', name: 'Sicily', vol: 'Vol. 2', blurb: 'Operation Husky, July 1943. Allied landings against Axis defenders.', when: 'Operation Husky · July – August 1943', ready: false,
    sides: ['axis', 'allied'], tag: { axis: 'AX', allied: 'AL' }, sideName: { axis: 'Axis', allied: 'Allied' }, scenarios: [], defaultScenario: '', fuel: false, optional: false },
  { id: 'golan73', name: "Golan '73", vol: 'Vol. 3', blurb: 'Yom Kippur War, October 1973. Syrian armor against the Golan heights.', when: 'Golan Heights · October 1973', ready: true,
    sides: ['syrian', 'israeli'], tag: { syrian: 'SY', israeli: 'IS' }, sideName: { syrian: 'Syrian', israeli: 'Israeli' },
    scenarios: [{ id: 'badr', name: 'Operation Badr', sub: '9 turns · historical set-up', title: 'Operation Badr (22.1): the historical set-up, 9 turns' }, { id: 'badr_alt', name: 'Badr, free set-up', sub: '9 turns · players place their units', title: 'Operation Badr, alternate set-up (22.2): the players place their units' }, { id: 'nafakh', name: 'Battle for Nafakh', sub: '4 turns · Oct 7–8 · in testing', title: 'Battle for Nafakh (22.4): the Syrian drive on Nafakh, 4 turns', testing: true }, { id: 'alowda', name: 'Operation Al-Owda', sub: '6 turns · hypothetical · in testing', title: 'Operation Al-Owda (20.3): the original Syrian plan, 6 turns, from its Setup Cards. Its Turn Track and Reference Map are not in the repository: the chit draws and the Israeli VP line are estimates.', testing: true }],
    defaultScenario: 'badr', fuel: false, optional: false },
];
export const gameInfo = (id: string) => GAMES.find((x) => x.id === id);
