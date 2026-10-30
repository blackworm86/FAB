import { connection, edgeKey, neighbors, zoneOf } from './map';

export interface MoveUnit {
  side: 'german' | 'allied'; cls: 'armor' | 'infantry'; area: number;
  supplied: boolean; disordered: boolean;
  ownZone?: 5 | 6 | 7;                 // German army zone; leave unset for Strategic Reserve units (15.1b) and Allies
  boundaryPreauthorized?: boolean;     // 14.62a marker
}
export interface MoveCtx {
  occupants: (area: number) => { german: number; allied: number };
  blownBridges?: Set<string>;          // edgeKey(a, b)
  roadblocks?: Set<number>;
  controller?: (area: number) => 'german' | 'allied' | undefined;
}
export interface Reach { area: number; cost: number; fuel: boolean; mustStop: boolean; path: number[] }

const FUEL_FREE_MP = 3;                // 16.13

/** Every area the unit can reach in an Operational/Breakthrough Movement Phase, with the cheapest cost (rules 5.2-5.35, 14.4, 16.13). */
export function reachable(u: MoveUnit, ctx: MoveCtx): Reach[] {
  const allowance = u.cls === 'armor' ? 6 : 3;
  const enemy = u.side === 'german' ? 'allied' : 'german';
  const occ = (a: number) => ctx.occupants(a);
  const startContested = occ(u.area).german > 0 && occ(u.area).allied > 0;
  const adjacentOnly = !u.supplied || u.disordered;           // 9.33a
  const best = new Map<number, Reach>([[u.area, { area: u.area, cost: 0, fuel: false, mustStop: false, path: [u.area] }]]);
  const todo = [u.area];
  while (todo.length) {
    todo.sort((x, y) => best.get(x)!.cost - best.get(y)!.cost);
    const from = todo.shift()!, cur = best.get(from)!;
    if (cur.mustStop || (adjacentOnly && from !== u.area)) continue;
    for (const to of neighbors(from)) {
      const c = connection(from, to)!;
      if (c.restricted && u.cls === 'armor') continue;        // 14.1
      const first = from === u.area, enemyThere = occ(to)[enemy] > 0;
      if (startContested && (enemyThere || (first && (occ(to).german > 0 && occ(to).allied > 0 || ctx.controller?.(to) === enemy)))) continue; // 5.34
      let step = c.mp;
      if (occ(to).german + occ(to).allied > 0) step += 1;     // 5.32 entering an occupied area
      if (first && startContested) step += 1;                 // 5.32 leaving a contested area
      if (u.ownZone && !u.boundaryPreauthorized && zoneOf(from) === u.ownZone && zoneOf(to) !== u.ownZone) step += 2; // 14.41
      const blown = c.river && ctx.blownBridges?.has(edgeKey(from, to));
      if (blown && !first) continue;                           // whole allowance: only from the starting area
      let cost = blown ? allowance : cur.cost + step;            // 5.32 blown bridge costs the whole allowance
      if (cost > allowance && !first) continue;               // 5.33 only a one-area move may exceed the allowance
      if (cost > allowance) cost = Math.max(cost, allowance);
      const old = best.get(to);
      if (old && old.cost <= cost) continue;
      const mustStop = enemyThere || !!ctx.roadblocks?.has(to); // 5.35b
      const path = [...cur.path, to];
      best.set(to, { area: to, cost, fuel: u.side === 'german' && cost > FUEL_FREE_MP && path.length > 2, mustStop, path });
      todo.push(to);
    }
  }
  best.delete(u.area);
  return [...best.values()].sort((a, b) => a.cost - b.cost || a.area - b.area);
}
