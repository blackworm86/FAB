import mapJson from '../../data/bulge/map.json';

export type Conn = { a: number; b: number; type: 'road' | 'field'; mp: number; river: boolean; restricted: boolean; army_boundary: boolean };
export type Area = { id: number; name: string; tdn: number; zone: 5 | 6 | 7; vp: { allied: number; german: number; mutual: boolean } };

const data = mapJson as unknown as { areas: Area[]; connections: Conn[] };
export const areas = new Map(data.areas.map((a) => [a.id, a]));
export const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const edges = new Map(data.connections.map((c) => [edgeKey(c.a, c.b), c]));
const adj = new Map<number, number[]>();
for (const c of data.connections) { (adj.get(c.a) ?? adj.set(c.a, []).get(c.a)!).push(c.b); (adj.get(c.b) ?? adj.set(c.b, []).get(c.b)!).push(c.a); }

export const connection = (a: number, b: number) => edges.get(edgeKey(a, b));
export const neighbors = (a: number) => adj.get(a) ?? [];
export const zoneOf = (a: number) => areas.get(a)!.zone;
