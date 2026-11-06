// FAB: Sicily map model, from data/sicily/map.json (read from the hand-drawn layered map, tools/sicily/svgmap.py).
// The 65 areas with their army zones (14.3), the landing boxes A1-A4, B1-B6, D1-D13 and the port boxes P1-P4 as off-map areas
// linked by their printed arrow to one coastal area (14.21-14.23), the ports, airfields and VP symbols (19.1), and the distance
// of every area from Messina (17.12).
import mapJson from '../../../data/sicily/map.json';
import type { Area, Conn, MapData } from '../volumes';

export type SSide = 'allied' | 'axis';
export type Nation = 'us' | 'british' | 'german' | 'italian';
export const enemyOf = (s: SSide): SSide => (s === 'allied' ? 'axis' : 'allied');
export const MESSINA = 29, ETNA = 27;
export const LANDING_ORDER = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13'];
export const PORT_ORDER = ['P1', 'P2', 'P3', 'P4'];

export interface SArea { id: number; name: string; tdn: number; vp: { allied: number; german: number; mutual: boolean }; zone: string[]; coastal: boolean; port: string | null; airfield: boolean; beaches: string[] }
/** A landing box (a beach the Allies may invade) or a port box, with the coastal area its arrow points at. */
export interface SBox { id: number; box: string; kind: 'landing' | 'port'; group: string; area: number; name: string | null; nation?: 'us' | 'british' | 'axis' }
type RawConn = { a: number; b: number; type: 'road' | 'field'; mp: number; river: boolean; restricted: boolean; army_boundary: boolean; zones?: string[] | null };
type RawBox = { box: string; kind: 'landing' | 'port'; name: string | null; area: number; group: string; control?: string };
const RAW = mapJson as unknown as { areas: SArea[]; connections: RawConn[]; boxes: RawBox[]; zones: Record<string, number[]> };

export const areas = new Map<number, SArea>(RAW.areas.map((a) => [a.id, a]));
export const area = (id: number) => areas.get(id)!;
/** Box ids (all below 256, as the board's area-id texture needs): landing boxes 101-123 in the printed order A1-A4, B1-B6, D1-D13; port boxes 131-134. */
export const boxId = (code: string) => (code.startsWith('P') ? 130 + PORT_ORDER.indexOf(code) + 1 : 100 + LANDING_ORDER.indexOf(code) + 1);
export const isBox = (a: number) => a >= 100;
export const isLandingBox = (a: number) => a > 100 && a < 130;
export const isPortBox = (a: number) => a > 130 && a < 140;
const portNation = (code: string): 'us' | 'british' | 'axis' => (code === 'P3' ? 'us' : code === 'P4' ? 'axis' : 'british');
export const boxes: SBox[] = RAW.boxes.map((b) => ({ id: boxId(b.box), box: b.box, kind: b.kind, group: b.group, area: b.area, name: b.name, ...(b.kind === 'port' ? { nation: portNation(b.box) } : {}) }));
export const BOX = new Map<number, SBox>(boxes.map((b) => [b.id, b]));
export const boxByCode = (code: string) => BOX.get(boxId(code))!;
export const landingBoxes = boxes.filter((b) => b.kind === 'landing');
export const portBoxes = boxes.filter((b) => b.kind === 'port');
/** The port box of a port area (5 Syracuse, 26 Catania, 57 Palermo, 29 Messina). */
export const portOf = (a: number) => portBoxes.find((p) => p.area === a);
export const PORT_AREA: Record<string, number> = Object.fromEntries(portBoxes.map((p) => [p.box, p.area]));
export const AIRFIELDS = RAW.areas.filter((a) => a.airfield).map((a) => a.id);
export const MUTUAL = RAW.areas.filter((a) => a.vp.mutual).map((a) => a.id);
/** 14.21: the coastal areas a landing box points at. */
export const INVASION_CAPABLE = new Set(landingBoxes.map((b) => b.area));
export const zonesOf = (a: number): string[] => areas.get(a)?.zone ?? [];
export const ZONES: Record<string, number[]> = RAW.zones;

/** The engine's view of the map: the areas, the boxes as areas, the links between areas and each box's arrow to its coastal area. */
export function engineMap(): MapData {
  const vp = (a: SArea) => ({ mutual: a.vp.mutual, german: a.vp.german, allied: a.vp.allied, syrian: 0, israeli: 0 });
  const A: Area[] = [...RAW.areas.map((a) => ({ id: a.id, name: a.name, tdn: a.tdn, zone: 0, vp: vp(a) })),
    ...boxes.map((b) => ({ id: b.id, name: b.kind === 'landing' ? `Landing box ${b.box}${b.name ? ` (${b.name})` : ''}` : `Port box ${b.box} ${b.name}`, tdn: 0, zone: 0, vp: { mutual: false, german: 0, allied: 0, syrian: 0, israeli: 0 } }))];
  const C: Conn[] = [...RAW.connections.map((c) => ({ a: c.a, b: c.b, type: c.type, mp: c.mp, river: !!c.river, restricted: !!c.restricted, army_boundary: !!c.army_boundary })),
    ...boxes.map((b) => ({ a: b.id, b: b.area, type: 'road' as const, mp: 1, river: false, restricted: false, army_boundary: false, ...(b.kind === 'landing' ? { landing: true } : { port: true }) }))];
  return { size: [2550, 1650], areas: A, connections: C };
}

/** Steps from Messina over the land links (17.12: a Tactical Extract may not move away from Messina). */
const DIST = new Map<number, number>([[MESSINA, 0]]);
{ const adj = new Map<number, number[]>(); for (const c of RAW.connections) { (adj.get(c.a) ?? adj.set(c.a, []).get(c.a)!).push(c.b); (adj.get(c.b) ?? adj.set(c.b, []).get(c.b)!).push(c.a); }
  const q = [MESSINA]; while (q.length) { const a = q.shift()!; for (const n of adj.get(a) ?? []) if (!DIST.has(n)) { DIST.set(n, DIST.get(a)! + 1); q.push(n); } } }
export const distMessina = (a: number) => DIST.get(a) ?? 99;
/** Areas within `n` steps of `a` over the land links. */
export function within(a: number, n: number): Set<number> {
  const adj = new Map<number, number[]>(); for (const c of RAW.connections) { (adj.get(c.a) ?? adj.set(c.a, []).get(c.a)!).push(c.b); (adj.get(c.b) ?? adj.set(c.b, []).get(c.b)!).push(c.a); }
  const d = new Map<number, number>([[a, 0]]), q = [a];
  while (q.length) { const x = q.shift()!; if (d.get(x)! >= n) continue; for (const y of adj.get(x) ?? []) if (!d.has(y)) { d.set(y, d.get(x)! + 1); q.push(y); } }
  return new Set(d.keys());
}
