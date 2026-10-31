/** The games that share the FAB series rules. Only The Bulge has a rules data set so far; the others show in the lobby as coming soon. */
export interface GameInfo { id: string; name: string; vol: string; blurb: string; ready: boolean }
export const GAMES: GameInfo[] = [
  { id: 'bulge', name: 'The Bulge', vol: 'Vol. 1', blurb: 'Ardennes, December 1944. German offensive against the thin American line.', ready: true },
  { id: 'sicily', name: 'Sicily', vol: 'Vol. 2', blurb: 'Operation Husky, July 1943. Allied landings against Axis defenders.', ready: false },
  { id: "golan73", name: "Golan '73", vol: 'Vol. 3', blurb: 'Yom Kippur War, October 1973. Syrian armor against the Golan heights.', ready: false },
];
export const gameInfo = (id: string) => GAMES.find((x) => x.id === id);
