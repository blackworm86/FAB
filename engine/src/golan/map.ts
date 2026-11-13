// FAB: Golan '73 map model, from data/golan73/map.json (read from the hand-drawn layered map, tools/golan73/svgmap.py).
// Areas, the connections between them with their boundary types (14.1), the two Israeli Assembly areas (14.22) as
// off-map areas A and B, Mt Hermon's single link to 59 (14.16), and which side of the Purple Line each area lies on.
import mapJson from '../../../data/golan73/map.json';
import setupsJson from '../../../data/golan73/setups.json';
import { playArea } from '../map';

export type GSide = 'israeli' | 'syrian';
export const enemyOf = (s: GSide): GSide => (s === 'israeli' ? 'syrian' : 'israeli');

export interface GArea {
  id: number;
  name: string;
  tdn: number;
  vp: { mutual: boolean; syrian: number };
  supply: boolean;
  altSetup: string | null;
  syria: boolean;
}
/** One link between two areas. `kind` is the connection crossing the boundary; the flags are the boundary types drawn along it. */
export interface GConn {
  a: number;
  b: number;
  kind: 'road' | 'field' | 'hermon' | 'assembly' | 'transfer';
  river: boolean;
  atDitch: boolean;
  wadi: boolean;
  escarpment: boolean;
  rugged: boolean;
  samBarrier: boolean;
  sector: boolean;
  /** A link printed only on a scenario's own map sheet, with its MP cost (once: one unit per Movement Phase). */
  sheet?: string;
  mp?: number;
  once?: boolean;
}
type RawConn = {
  a: number;
  b: number;
  type: string;
  river?: boolean;
  atDitch?: boolean;
  wadi?: boolean;
  escarpment?: boolean;
  rugged?: boolean;
  samBarrier?: boolean;
  sector?: boolean;
};
type RawArea = { id: number; name: string; tdn: number; vp: { mutual: boolean; syrian: number }; supply: boolean; altSetup: string | null };
const RAW = mapJson as unknown as {
  areas: RawArea[];
  connections: RawConn[];
  entries: { letter: string; area: number }[];
  assembly: Record<'A' | 'B', { enters: number[] }>;
};

/** The Assembly areas are off-map boxes; the engine gives them area ids. The Syrian Rear Area is the Battle for Nafakh sheet's box. */
export const ASSEMBLY = { A: 101, B: 102 } as const;
export const REAR = 103,
  NAF_NORTH = 104; // the Battle for Nafakh sheet's own boxes: the Syrian Rear Area and its Northern Assembly Area
/** Any off-map box (the two Israeli Assembly areas, the Nafakh sheet's boxes). */
export const isAssembly = (a: number) => a === ASSEMBLY.A || a === ASSEMBLY.B || a === REAR || a === NAF_NORTH;
/** Whose box it is. */
export const boxSide = (a: number): GSide => (a === REAR ? 'syrian' : 'israeli');
export const HERMON = 83;

const flags = { river: false, atDitch: false, wadi: false, escarpment: false, rugged: false, samBarrier: false, sector: false };
const conns: GConn[] = RAW.connections.map((c) => ({
  ...flags,
  a: c.a,
  b: c.b,
  kind: c.type === 'special' ? 'hermon' : (c.type as 'road' | 'field'),
  river: !!c.river,
  atDitch: !!c.atDitch,
  wadi: !!c.wadi,
  escarpment: !!c.escarpment,
  rugged: !!c.rugged,
  samBarrier: !!c.samBarrier,
  sector: !!c.sector,
}));
for (const [k, id] of Object.entries(ASSEMBLY))
  for (const to of RAW.assembly[k as 'A' | 'B'].enters) conns.push({ ...flags, a: id, b: to, kind: 'assembly' });
conns.push({ ...flags, a: ASSEMBLY.A, b: ASSEMBLY.B, kind: 'transfer' }); // 14.22: between the boxes for all MP
type SheetLink = { a: number; b: number; mp: number; once?: boolean };
for (const [id, sc] of Object.entries(setupsJson as unknown as Record<string, { sheet?: { links: SheetLink[] } }>))
  for (const l of sc.sheet?.links ?? []) conns.push({ ...flags, a: l.a, b: l.b, kind: 'assembly', sheet: id, mp: l.mp, once: l.once });

export const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const EDGES = new Map(conns.map((c) => [edgeKey(c.a, c.b), c]));
const ADJ = new Map<number, number[]>(),
  SHEET_ADJ = new Map<number, number[]>();
for (const c of conns) {
  const m = c.sheet ? SHEET_ADJ : ADJ;
  for (const [x, y] of [
    [c.a, c.b],
    [c.b, c.a],
  ])
    (m.get(x) ?? m.set(x, []).get(x)!).push(y);
}
/** A scenario played on its own sheet narrows the map to its play area (series map.ts): only those areas, plus the sheet's own links. */
export const connection = (a: number, b: number) => {
  const c = EDGES.get(edgeKey(a, b)),
    p = playArea();
  return c?.sheet && !(p?.has(a) && p.has(b)) ? undefined : c;
};
export const neighbors = (a: number) => {
  const p = playArea();
  return p ? [...(ADJ.get(a) ?? []), ...(p.has(a) ? (SHEET_ADJ.get(a) ?? []) : [])].filter((n) => p.has(n)) : (ADJ.get(a) ?? []);
};
export const connections = (): readonly GConn[] => conns;

/** Israel-held Golan (west of the Purple Line): everything reachable from the Israeli supply areas without crossing the AT ditch. */
const west = new Set<number>(),
  todo = RAW.areas.filter((a) => a.supply).map((a) => a.id);
while (todo.length) {
  const a = todo.pop()!;
  if (west.has(a)) continue;
  west.add(a);
  for (const n of neighbors(a)) if (!isAssembly(n) && !connection(a, n)!.atDitch) todo.push(n);
}
export const areas = new Map<number, GArea>(RAW.areas.map((a) => [a.id, { ...a, syria: !west.has(a.id) }]));
export const area = (id: number) => areas.get(id)!;
/** Syrian Entry areas V–Z (14.21), letter → area. */
export const ENTRY = Object.fromEntries(RAW.entries.map((e) => [e.letter, e.area])) as Record<string, number>;
/** East of the Syrian SAM Barrier (14.15): the side holding the Syrian Entry areas, without crossing a SAM barrier edge. */
const east = new Set<number>(),
  todoE = Object.values(ENTRY);
while (todoE.length) {
  const a = todoE.pop()!;
  if (east.has(a)) continue;
  east.add(a);
  for (const n of neighbors(a)) if (!isAssembly(n) && connection(a, n)!.kind !== 'hermon' && !connection(a, n)!.samBarrier) todoE.push(n);
}
export const eastOfSam = (a: number) => east.has(a);
