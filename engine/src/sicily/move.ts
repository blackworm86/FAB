// FAB: Sicily operational movement (series 5.2-5.35 with the Exclusive Rules: restricted terrain and Mount Etna 14.1, army zones 14.3/14.4,
// untried garrisons 14.42/15.3, the motorized Livorno 15.1, air interdiction 16.33, the Tactical Extract 17.12).
// reachable() lists every area a unit standing on the map can end its move in, with the cheapest cost and path; the game layer applies the rest.
import { connection, edgeKey, neighbors } from '../map';
import { ETNA, distMessina, isBox, zonesOf, type SSide, enemyOf } from './map';

export interface SMoveUnit {
  side: SSide;
  cls: 'armor' | 'infantry';
  area: number;
  supplied?: boolean;
  disordered?: boolean;
  adjacentOnly?: boolean; // exploitation / Special Action breakthrough move (7.31)
  spent?: number; // MP already used this phase
  motorized?: boolean; // 15.1 the Livorno division
  untried?: boolean; // 15.3a an untried garrison: never into an enemy-occupied area
  allowed?: Set<string>; // 14.3: the army zones this Allied unit may operate in (undefined: no restriction)
  extract?: boolean; // 17.12: a German unit moving under the Tactical Extract
  leftContested?: boolean; // moving one area at a time, it started in a contested area (15.1: then it moves as infantry)
}
export interface SMoveCtx {
  units: (a: number) => Record<SSide, number>; // blocks and standing assets by side
  controller?: (a: number) => SSide | undefined;
  blownBridges?: Set<string>;
  interdicted?: (a: number) => SSide | undefined; // owner of an interdiction air mission over the area (16.33)
  untriedOnly?: (a: number) => boolean; // 14.42: the area holds only untried Italian units
  etnaFree?: SSide; // 14.1: the side that controls an uncontested Mount Etna
  etnaCtl?: SSide; // 14.1: the side that controls Mount Etna, contested or not
  contestedAtStart?: Set<number>;
  roadblock?: (a: number) => SSide | undefined; // 4.34 / 4.35: whose roadblock (marker or defended) is there                              // 17.12: areas already contested when the phase began
}
export interface SReach {
  area: number;
  cost: number;
  path: number[];
  mustStop: boolean;
}

const total = (r: Record<SSide, number>) => r.allied + r.axis;
export const allowanceOf = (u: { cls: 'armor' | 'infantry'; motorized?: boolean }, startContested = false) =>
  u.cls === 'armor' ? 6 : u.motorized && !startContested ? 6 : 3;

/** Every area the unit can reach in an Operational or Breakthrough Movement Phase. */
export function reachable(u: SMoveUnit, ctx: SMoveCtx): SReach[] {
  const enemy = enemyOf(u.side),
    occ = ctx.units,
    spent = u.spent ?? 0;
  const startContested = occ(u.area).allied > 0 && occ(u.area).axis > 0;
  const allowance = allowanceOf(u, startContested || !!u.leftContested);
  const adjacentOnly = !(u.supplied ?? true) || !!u.disordered || !!u.adjacentOnly || !!u.extract; // 9.33a; 17.12 is one step
  const best = new Map<number, SReach>([[u.area, { area: u.area, cost: spent, path: [u.area], mustStop: false }]]);
  const todo = [u.area];
  while (todo.length) {
    todo.sort((x, y) => best.get(x)!.cost - best.get(y)!.cost);
    const from = todo.shift()!,
      cur = best.get(from)!;
    if (cur.mustStop || (adjacentOnly && from !== u.area)) continue;
    for (const to of neighbors(from)) {
      if (isBox(to)) continue;
      const c = connection(from, to)!,
        key = edgeKey(from, to),
        atStart = from === u.area,
        first = atStart && !spent;
      const enemyThere = occ(to)[enemy] > 0,
        contestedTo = occ(to).allied > 0 && occ(to).axis > 0;
      if (u.allowed && !zonesOf(to).some((z) => u.allowed!.has(z))) continue; // 14.41: outside the army's zones
      if (u.untried && enemyThere) continue; // 15.3a
      if (startContested && atStart && u.extract) {
        // 17.12: out of a contested area into an enemy-controlled or contested one, not away from Messina
        if (
          !((contestedTo && ctx.contestedAtStart?.has(to)) || (ctx.controller?.(to) === enemy && !enemyThere)) ||
          distMessina(to) > distMessina(from)
        )
          continue; // not newly contested
      } else if (startContested && (enemyThere || (atStart && (contestedTo || ctx.controller?.(to) === enemy)))) continue; // 5.34
      let all = false;
      if (c.restricted) {
        // 14.1
        const exception =
          c.type === 'road' && ((from === ETNA && (ctx.etnaCtl ?? ctx.etnaFree) === u.side) || (to === ETNA && ctx.etnaFree === u.side)); // leave by road while in control; enter only uncontested
        if (!exception) {
          if (u.cls === 'armor' || !first) continue;
          all = true;
        }
      }
      if (c.river && (c.type !== 'road' || ctx.blownBridges?.has(key))) {
        if (!first) continue;
        all = true;
      } // 5.32: no bridge, or a blown one
      let step = c.type === 'road' ? 1 : 2;
      if (total(occ(to)) > 0 && !ctx.untriedOnly?.(to)) step += 1; // 5.32, 14.42
      if (atStart && startContested) step += 1;
      if (ctx.interdicted?.(to) === enemy) step += 1; // 16.33: to enter and to leave
      if (ctx.interdicted?.(from) === enemy) step += 1;
      const rb = ctx.roadblock?.(to) === enemy;
      if (rb) step += 1; // 4.34: +1 MP and stop
      let cost = all ? allowance : cur.cost + step;
      if (u.motorized && enemyThere && cost > 3 && !first) continue; // 15.1: into a contested area it moves as infantry
      if (cost > allowance && !first) continue; // 5.33 only a one-area move may exceed the allowance
      if (cost > allowance) cost = allowance;
      const old = best.get(to);
      if (old && old.cost <= cost) continue;
      best.set(to, { area: to, cost, path: [...cur.path, to], mustStop: enemyThere || rb });
      todo.push(to);
    }
  }
  best.delete(u.area);
  return [...best.values()].sort((a, b) => a.cost - b.cost || a.area - b.area);
}
