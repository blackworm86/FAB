// FAB: Golan '73 map model, from data/golan73/map.json (read from the hand-drawn layered map, tools/golan73/svgmap.py).
// Areas, the connections between them with their boundary types (14.1), the two Israeli Assembly areas (14.22) as
// off-map areas A and B, Mt Hermon's single link to 59 (14.16), and which side of the Purple Line each area lies on.
import mapJson from '../../../data/golan73/map.json';

export type GSide = 'israeli' | 'syrian';
export const enemyOf = (s: GSide): GSide => (s === 'israeli' ? 'syrian' : 'israeli');

export interface GArea { id: number; name: string; tdn: number; vp: { mutual: boolean; syrian: number }; supply: boolean; altSetup: string | null; syria: boolean }
/** One link between two areas. `kind` is the connection crossing the boundary; the flags are the boundary types drawn along it. */
export interface GConn {
  a: number; b: number; kind: 'road' | 'field' | 'hermon' | 'assembly' | 'transfer';
  river: boolean; atDitch: boolean; wadi: boolean; escarpment: boolean; rugged: boolean; samBarrier: boolean; sector: boolean;
}
type RawConn = { a: number; b: number; type: string; river?: boolean; atDitch?: boolean; wadi?: boolean; escarpment?: boolean; rugged?: boolean; samBarrier?: boolean; sector?: boolean };
type RawArea = { id: number; name: string; tdn: number; vp: { mutual: boolean; syrian: number }; supply: boolean; altSetup: string | null };
const RAW = mapJson as unknown as { areas: RawArea[]; connections: RawConn[]; entries: { letter: string; area: number }[]; assembly: Record<'A' | 'B', { enters: number[] }> };

/** The Assembly areas are off-map boxes; the engine gives them area ids. */
export const ASSEMBLY = { A: 101, B: 102 } as const;
export const isAssembly = (a: number) => a === ASSEMBLY.A || a === ASSEMBLY.B;
export const HERMON = 83;

const flags = { river: false, atDitch: false, wadi: false, escarpment: false, rugged: false, samBarrier: false, sector: false };
const conns: GConn[] = RAW.connections.map((c) => ({
  ...flags, a: c.a, b: c.b, kind: c.type === 'special' ? 'hermon' : (c.type as 'road' | 'field'),
  river: !!c.river, atDitch: !!c.atDitch, wadi: !!c.wadi, escarpment: !!c.escarpment, rugged: !!c.rugged, samBarrier: !!c.samBarrier, sector: !!c.sector,
}));
for (const [k, id] of Object.entries(ASSEMBLY)) for (const to of RAW.assembly[k as 'A' | 'B'].enters) conns.push({ ...flags, a: id, b: to, kind: 'assembly' });
conns.push({ ...flags, a: ASSEMBLY.A, b: ASSEMBLY.B, kind: 'transfer' });          // 14.22: between the boxes for all MP

export const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const EDGES = new Map(conns.map((c) => [edgeKey(c.a, c.b), c]));
const ADJ = new Map<number, number[]>();
for (const c of conns) for (const [x, y] of [[c.a, c.b], [c.b, c.a]]) (ADJ.get(x) ?? ADJ.set(x, []).get(x)!).push(y);
export const connection = (a: number, b: number) => EDGES.get(edgeKey(a, b));
export const neighbors = (a: number) => ADJ.get(a) ?? [];
export const connections = (): readonly GConn[] => conns;

/** Israel-held Golan (west of the Purple Line): everything reachable from the Israeli supply areas without crossing the AT ditch. */
const west = new Set<number>(), todo = RAW.areas.filter((a) => a.supply).map((a) => a.id);
while (todo.length) { const a = todo.pop()!; if (west.has(a)) continue; west.add(a); for (const n of neighbors(a)) if (!isAssembly(n) && !connection(a, n)!.atDitch) todo.push(n); }
export const areas = new Map<number, GArea>(RAW.areas.map((a) => [a.id, { ...a, syria: !west.has(a.id) }]));
export const area = (id: number) => areas.get(id)!;
/** Syrian Entry areas V–Z (14.21), letter → area. */
export const ENTRY = Object.fromEntries(RAW.entries.map((e) => [e.letter, e.area])) as Record<string, number>;
