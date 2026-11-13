// Which game this page shows: the volume, its map, and the map's geometry (world units, borders, area names).
import * as THREE from 'three';
import * as E from '../../engine/src';
import { useVolume, type LabelBox } from './vol';
import { TABLE, SANDBOX, TUTORIAL } from './online';
import { courseFor } from './tutorial-script';
import { LAB_SIDE } from './lab';

/* ---------- which game this page shows ---------- */
export const PARAMS = new URLSearchParams(location.search),
  GAME_PARAM = PARAMS.get('game');
export const TUT = TUTORIAL ? courseFor(PARAMS.get('tutorial')) : null; // the tutorial course this page runs (docs/TUTORIAL.md)
export const KEY0 = TUT
    ? `fab-tutorial-${TUT.id}`
    : LAB_SIDE
      ? `fab-lab-${LAB_SIDE}`
      : SANDBOX
        ? 'fab-sandbox'
        : TABLE === 'main'
          ? 'fab-demo2'
          : `fab-demo2-${TABLE}`,
  KEY = GAME_PARAM && GAME_PARAM !== 'bulge' ? `${KEY0}-${GAME_PARAM}` : KEY0;
export function load(): E.Game | null {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return null;
    const x = JSON.parse(s);
    return x.chits && x.markers && x.greif && x.roadblocks && x.pendingArrivals && x.fwOwner && Array.isArray(x.recover) ? x : null;
  } catch {
    return null;
  }
}
/** The volume (docs/design/one-engine.md): the address says which game, else the game saved for this table, else The Bulge. A shared table of another game reloads the page with its game. */
export const VOL = useVolume(TUT ? TUT.game : (GAME_PARAM ?? load()?.game ?? 'bulge'));
document.documentElement.style.setProperty('--gauge-l', VOL.ink[VOL.sides[1]]);
document.documentElement.style.setProperty('--gauge-r', VOL.ink[VOL.sides[0]]); /* the VP gauge's ends in the sides' own colours */
export const [P1, P2] = VOL.sides,
  first = (sd: string) => sd === P1,
  near = (sd: string) => sd === VOL.bottom; // near: the side whose map edge is at the bottom, whose rows sit toward +z
export const MAP = VOL.map,
  LAB: Record<string, LabelBox> = VOL.labels;
// World unit = 1 cm. Every FAB map is the full 34 x 22 in sheet (86.36 x 55.88 cm); the drawing's width gives the pixels per cm.
export const [MW, MH] = MAP.size,
  S = MW / 86.36; // map pixels per cm
export const toWorld = (x: number, y: number) => new THREE.Vector3(x / S - MW / (2 * S), 0, y / S - MH / (2 * S));
/** Pole of inaccessibility: the point inside the polygon farthest from its edges, so pieces sit visually centred. */
export function pole(poly: [number, number][]): [number, number] {
  const xs = poly.map((p) => p[0]),
    ys = poly.map((p) => p[1]),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const inside = (x: number, y: number) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i],
        [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const edge = (x: number, y: number) => {
    let d = 1e9;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j],
        [bx, by] = poly[i],
        dx = bx - ax,
        dy = by - ay,
        t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
    return d;
  };
  let best: [number, number] = [(x0 + x1) / 2, (y0 + y1) / 2],
    bd = -1;
  for (let i = 0; i <= 40; i++)
    for (let j = 0; j <= 40; j++) {
      const x = x0 + ((x1 - x0) * i) / 40,
        y = y0 + ((y1 - y0) * j) / 40;
      if (!inside(x, y)) continue;
      const d = edge(x, y);
      if (d > bd) {
        bd = d;
        best = [x, y];
      }
    }
  return best;
}
/** Candidate spots inside an area: grid points (world cm) with their clearance from the border, so pieces can be kept fully inside it. */
const CELLS = new Map<number, { x: number; z: number; d: number }[]>();
export function cellsOf(id: number) {
  let c = CELLS.get(id);
  if (c) return c;
  const poly = MAP.areas.find((a) => a.id === id)!.polygon,
    xs = poly.map((p) => p[0]),
    ys = poly.map((p) => p[1]);
  c = [];
  const inside = (x: number, y: number) => {
    let k = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i],
        [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) k = !k;
    }
    return k;
  };
  const edge = (x: number, y: number) => {
    let d = 1e9;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j],
        [bx, by] = poly[i],
        dx = bx - ax,
        dy = by - ay,
        t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
    return d;
  };
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 5)
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += 5)
      if (inside(x, y)) {
        const w = toWorld(x, y);
        c.push({ x: w.x, z: w.z, d: edge(x, y) / S });
      }
  CELLS.set(id, c);
  return c;
}
export const POLE = new Map<number, [number, number]>(
  MAP.areas.map((a) => [a.id, LAB[a.id] ? [LAB[a.id].px, LAB[a.id].py] : pole(a.polygon)]),
); // where an area's pieces stand: its clear spot beside the label
/** Marker spot on the shared border of two areas (the scan carries no marker positions for most connections). */
export function borderMid(a: number, b: number): [number, number] {
  const A = MAP.areas.find((x) => x.id === a)!,
    B = MAP.areas.find((x) => x.id === b)!,
    near = A.polygon.filter((p) => B.polygon.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 8));
  if (near.length) {
    const mx = near.reduce((s, p) => s + p[0], 0) / near.length,
      my = near.reduce((s, p) => s + p[1], 0) / near.length;
    return [mx, my];
  }
  const pa = POLE.get(a)!,
    pb = POLE.get(b)!;
  return [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
}
/** General direction of the border between two areas (the river runs along it), as an angle in map space. */
export function borderAngle(a: number, b: number): number {
  const A = MAP.areas.find((x) => x.id === a)!,
    B = MAP.areas.find((x) => x.id === b)!,
    near = A.polygon.filter((p) => B.polygon.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 8));
  if (near.length >= 2) {
    const mx = near.reduce((t, p) => t + p[0], 0) / near.length,
      my = near.reduce((t, p) => t + p[1], 0) / near.length;
    let sxx = 0,
      syy = 0,
      sxy = 0;
    for (const p of near) {
      sxx += (p[0] - mx) ** 2;
      syy += (p[1] - my) ** 2;
      sxy += (p[0] - mx) * (p[1] - my);
    }
    return 0.5 * Math.atan2(2 * sxy, sxx - syy);
  }
  const pa = POLE.get(a)!,
    pb = POLE.get(b)!;
  return Math.atan2(pb[1] - pa[1], pb[0] - pa[0]) + Math.PI / 2;
}
export const $ = (s: string) => document.querySelector(s) as HTMLElement;
export const areaName = (a: number) => E.areas.get(a)!.name;
