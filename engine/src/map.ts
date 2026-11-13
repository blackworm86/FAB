// The current volume's map: areas, the connections between them and their adjacency. `useGame` (volumes.ts) switches it; the bindings
// below are live, so importers always see the current map. The area of play (`setPlayArea`) narrows the neighbours for a scenario.
import { CUR, onGameSwitch, type Area, type Conn, type Volume } from './volumes';
export type { Area, Conn };

export let areas = new Map<number, Area>();
let edges = new Map<string, Conn>();
let adj = new Map<number, number[]>();
/** Links printed only on a scenario's own map sheet (Golan's Battle for Nafakh): they exist only while a play area including both ends is set. */
let sheetAdj = new Map<number, number[]>();
let PLAY: Set<number> | null = null;
export const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
export function useMap(v: Volume) {
  areas = new Map(v.map.areas.map((a) => [a.id, a]));
  edges = new Map(v.map.connections.map((c) => [edgeKey(c.a, c.b), c]));
  adj = new Map();
  sheetAdj = new Map();
  PLAY = null; // another map: the previous game's sheet (area ids) must not carry over
  for (const c of v.map.connections) {
    const m = c.sheet ? sheetAdj : adj;
    (m.get(c.a) ?? m.set(c.a, []).get(c.a)!).push(c.b);
    (m.get(c.b) ?? m.set(c.b, []).get(c.b)!).push(c.a);
  }
}
onGameSwitch(useMap);
useMap(CUR);

export const connection = (a: number, b: number) => {
  const c = edges.get(edgeKey(a, b));
  return c?.sheet && !(PLAY?.has(a) && PLAY.has(b)) ? undefined : c;
};
/** The areas in play: all of them, or the Introductory ("Nuts!") map sheet (24.33). Set by the game being played (setPlayArea). */
export const setPlayArea = (ids: number[] | null | undefined) => {
  PLAY = ids?.length ? new Set(ids) : null;
};
export const inPlay = (a: number) => !PLAY || PLAY.has(a);
/** All neighbours on the full map, also outside the area of play (to find the edge of the Introductory sheet). */
export const allNeighbors = (a: number) => adj.get(a) ?? [];
export const neighbors = (a: number) =>
  PLAY ? [...(adj.get(a) ?? []), ...(PLAY.has(a) ? (sheetAdj.get(a) ?? []) : [])].filter((n) => PLAY!.has(n)) : (adj.get(a) ?? []);
/** The area of play, or null for the whole map. */
export const playArea = (): ReadonlySet<number> | null => PLAY;
export const zoneOf = (a: number) => areas.get(a)!.zone;
