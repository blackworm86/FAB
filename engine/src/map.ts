// The current volume's map: areas, the connections between them and their adjacency. `useGame` (volumes.ts) switches it; the bindings
// below are live, so importers always see the current map. The area of play (`setPlayArea`) narrows the neighbours for a scenario.
import { CUR, onGameSwitch, type Area, type Conn, type Volume } from './volumes';
export type { Area, Conn };

export let areas = new Map<number, Area>();
let edges = new Map<string, Conn>();
let adj = new Map<number, number[]>();
export const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
export function useMap(v: Volume) {
  areas = new Map(v.map.areas.map((a) => [a.id, a]));
  edges = new Map(v.map.connections.map((c) => [edgeKey(c.a, c.b), c]));
  adj = new Map();
  for (const c of v.map.connections) { (adj.get(c.a) ?? adj.set(c.a, []).get(c.a)!).push(c.b); (adj.get(c.b) ?? adj.set(c.b, []).get(c.b)!).push(c.a); }
}
onGameSwitch(useMap); useMap(CUR);

export const connection = (a: number, b: number) => edges.get(edgeKey(a, b));
/** The areas in play: all of them, or the Introductory ("Nuts!") map sheet (24.33). Set by the game being played (setPlayArea). */
let PLAY: Set<number> | null = null;
export const setPlayArea = (ids: number[] | null | undefined) => { PLAY = ids?.length ? new Set(ids) : null; };
export const inPlay = (a: number) => !PLAY || PLAY.has(a);
/** All neighbours on the full map, also outside the area of play (to find the edge of the Introductory sheet). */
export const allNeighbors = (a: number) => adj.get(a) ?? [];
export const neighbors = (a: number) => (PLAY ? (adj.get(a) ?? []).filter((n) => PLAY!.has(n)) : adj.get(a) ?? []);
export const zoneOf = (a: number) => areas.get(a)!.zone;
