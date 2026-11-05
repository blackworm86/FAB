// FAB: Golan '73 operational movement (series 5.2–5.35 with the Golan boundary rules 14.02–14.43, 14.16, 14.22, 16.11, 16.31b).
// reachable() lists every area a unit can end its move in, with the cheapest cost and path, and what the move triggers
// (a minefield morale check, a commando raid roll). The game layer applies those; this module only knows the map rules.
import { ASSEMBLY, HERMON, area, connection, edgeKey, enemyOf, isAssembly, neighbors, type GSide } from './map';

export interface GMoveUnit {
  side: GSide; cls: 'armor' | 'infantry'; area: number;
  supplied?: boolean; disordered?: boolean;
  immobile?: boolean;          // strongpoints and ghosts (15.6, 15.7), garrisons
  adjacentOnly?: boolean;      // exploitation / Special Action breakthrough move (7.31)
  spent?: number;              // MP already used this phase (a failed minefield attempt, 14.02)
  minefieldFailed?: boolean;   // failed a minefield check this turn: may not cross any minefield (14.02)
}
export interface GMoveCtx {
  turn: number;
  units: (a: number) => Record<GSide, number>;                     // units (incl. strongpoints and ghosts)
  assets?: (a: number) => Record<GSide, number>;                   // assets on the map: garrisons, commando raids, roadblocks
  controller?: (a: number) => GSide | undefined;
  bridgedDitch?: Set<string>;                                      // AT Ditch Bridged markers (14.51)
  blownBridges?: Set<string>;                                      // river edges whose bridge is blown (4.31)
  minefields?: Set<string>;                                        // mined boundaries (14.02)
  crossedThisPhase?: Set<string>;                                  // one-unit-per-phase boundaries already used (5.35c, 14.11–14.14)
  interdicted?: (a: number) => GSide | undefined;                  // owner of an interdiction air mission in the area (16.31b)
  raids?: Set<number>;                                             // Syrian commando raid areas (16.11a)
  roadblocks?: Map<number, GSide>;                                 // roadblock owner (4.34)
}
export type Trigger = 'minefield' | 'raid';
export interface GReach { area: number; cost: number; path: number[]; mustStop: boolean; canEnd: boolean; triggers: Trigger[]; limited: string[] }

const total = (r: Record<GSide, number>) => r.israeli + r.syrian;

/** Why a single step from `from` to `to` is impossible, or its cost and side effects. `first` = the unit's first step this phase. */
function step(u: GMoveUnit, ctx: GMoveCtx, from: number, to: number, first: boolean, allowance: number):
  { cost: number; all?: boolean; limited?: string; trigger?: Trigger; stop?: boolean } | null {
  const c = connection(from, to)!, key = edgeKey(from, to), enemy = enemyOf(u.side);
  const occ = (a: number) => total(ctx.units(a)) + (ctx.assets ? total(ctx.assets(a)) : 0);
  const enemyIn = (a: number) => ctx.units(a)[enemy] + (ctx.assets?.(a)[enemy] ?? 0) > 0;
  const syrianNight = ctx.turn === 2 && u.side === 'syrian';
  if (c.kind === 'assembly' && !isAssembly(from)) return null;                                  // 14.22: no entering an Assembly area from the map
  if (c.kind === 'transfer') return first ? { cost: allowance, all: true } : null;               // 14.22: between the boxes for all MP
  if (c.kind === 'hermon') {                                                                     // 14.16: infantry class, from 59 / out to 59, all MP
    if (u.cls !== 'infantry' || !first || syrianNight) return null;
    return { cost: allowance, all: true, stop: enemyIn(to) };
  }
  if (syrianNight && (to === HERMON || from === HERMON)) return null;                            // 14.03
  if (u.side === 'syrian' && ctx.turn <= 4 && c.sector) return null;                            // 14.42
  const toArea = isAssembly(to) ? null : area(to);
  if (u.side === 'israeli' && toArea?.syria && ctx.units(to).syrian > 0) return null;           // 14.43: into Syria only if undefended
  const road = c.kind === 'road' || c.kind === 'assembly';
  let cost = road ? 1 : 2, all = false, limited: string | undefined;
  const intoEnemy = enemyIn(to);
  if (c.river) {                                                                                 // 5.32, 14.41: a bridge only where a road crosses
    if (!road || ctx.blownBridges?.has(key)) all = true;
    if (intoEnemy) limited = key;                                                                // 5.35c
  }
  if (c.atDitch) {                                                                               // 14.12
    if (!ctx.bridgedDitch?.has(key)) all = true;
    if (intoEnemy) limited = key;
  }
  if (c.escarpment) { if (!road) return null; cost += 1; limited = key; }                         // 14.11
  if (c.wadi) { if (!road) cost += 1; if (intoEnemy) limited = key; }                            // 14.13: field 2+1, road 1
  if (c.rugged) {                                                                                // 14.14: infantry only, all MP; a road (18/19) lets armor cross at 1 MP
    if (!road) { if (u.cls === 'armor') return null; all = true; }
    limited = key;
  }
  if (limited && ctx.crossedThisPhase?.has(limited)) return null;                                // one unit per boundary per Movement Phase
  let trigger: Trigger | undefined;
  if (u.side === 'syrian' && ctx.minefields?.has(key)) {                                          // 14.02: only from the starting area, +1 MP and a morale check
    if (!first || u.minefieldFailed) return null;
    cost += 1; trigger = 'minefield';
  }
  if (all) { if (!first) return null; cost = allowance; }
  if (occ(to) > 0) cost += 1;                                                                    // 5.32 entering an occupied area
  if (ctx.interdicted?.(from) === enemy) cost += 1;                                              // 16.31b +1 to leave
  if (ctx.interdicted?.(to) === enemy) cost += 1;                                                // and +1 to enter
  let stop = intoEnemy;
  const empty = occ(to) === 0;                                                                   // these +1s are not added to the +1 for an occupied area (series 4.34 note)
  if (u.side === 'israeli' && ctx.raids?.has(to)) { if (empty) cost += 1; trigger = 'raid'; stop = true; }  // 16.11a
  if (ctx.roadblocks?.get(to) === enemy) { if (empty) cost += 1; stop = true; }                  // 4.34
  if (all) cost = Math.max(cost, allowance);
  return { cost, all, limited, trigger, stop };
}

/** Every area the unit can end an Operational (or Breakthrough) move in, cheapest first (5.22, 5.32–5.35, 14.x). */
export function reachable(u: GMoveUnit, ctx: GMoveCtx): GReach[] {
  if (u.immobile) return [];
  const syrianNight = ctx.turn === 2 && u.side === 'syrian';                                     // 14.03
  const allowance = syrianNight ? (u.cls === 'armor' ? 4 : 1) : u.cls === 'armor' ? 6 : 3;
  const maxAreas = syrianNight ? (u.cls === 'armor' ? 2 : 1) : Infinity;
  const spent = u.spent ?? 0, enemy = enemyOf(u.side);
  const contested = (a: number) => !isAssembly(a) && ctx.units(a).israeli > 0 && ctx.units(a).syrian > 0;
  const startContested = contested(u.area);
  const oneArea = !!u.adjacentOnly || u.supplied === false || !!u.disordered;                     // 5.32, 9.33
  type Node = GReach & { left: boolean };
  const best = new Map<number, Node>([[u.area, { area: u.area, cost: spent, path: [u.area], mustStop: false, canEnd: false, triggers: [], limited: [], left: false }]]);
  const todo = [u.area];
  while (todo.length) {
    todo.sort((x, y) => best.get(x)!.cost - best.get(y)!.cost);
    const from = todo.shift()!, cur = best.get(from)!;
    const steps = cur.path.length - 1;
    if (cur.mustStop || (oneArea && steps >= 1) || steps >= maxAreas) continue;
    for (const to of neighbors(from)) {
      if (cur.path.includes(to)) continue;
      const first = steps === 0 && spent === 0;
      const s = step(u, ctx, from, to, first, allowance);
      if (!s) continue;
      if (startContested) {                                                                     // 5.34
        const fresh = steps === 0;
        if (fresh && (contested(to) || ctx.units(to)[enemy] > 0 || ctx.controller?.(to) === enemy)) continue;
        if (!fresh && (contested(to) || ctx.units(to)[enemy] > 0)) continue;
      }
      let cost = cur.cost + s.cost + (startContested && steps === 0 ? 1 : 0);                   // 5.32 +1 to leave a contested area
      if (cost > allowance && !(steps === 0)) continue;                                         // 5.33 one area may always be entered
      const old = best.get(to);
      if (old && old.cost <= cost) continue;
      const friendly = ctx.units(to)[u.side];
      best.set(to, { area: to, cost, path: [...cur.path, to], mustStop: !!s.stop, canEnd: friendly < 2 && !isAssembly(to),
        triggers: s.trigger ? [...cur.triggers, s.trigger] : cur.triggers, limited: s.limited ? [...cur.limited, s.limited] : cur.limited, left: true });
      todo.push(to);
    }
  }
  best.delete(u.area);
  return [...best.values()].filter((r) => r.canEnd).map(({ left: _l, ...r }) => r).sort((a, b) => a.cost - b.cost || a.area - b.area);
}

/** The cost of one exact route (the player's chosen path), or null if any step of it is not allowed. */
export function pathCost(u: GMoveUnit, ctx: GMoveCtx, path: number[]): { cost: number; mustStop: boolean; triggers: Trigger[]; limited: string[] } | null {
  if (u.immobile || path[0] !== u.area) return null;
  const syrianNight = ctx.turn === 2 && u.side === 'syrian';
  const allowance = syrianNight ? (u.cls === 'armor' ? 4 : 1) : u.cls === 'armor' ? 6 : 3;
  const oneArea = !!u.adjacentOnly || u.supplied === false || !!u.disordered;
  if ((oneArea || (syrianNight && u.cls === 'infantry')) && path.length > 2) return null;
  if (syrianNight && path.length > 3) return null;
  const startContested = !isAssembly(u.area) && ctx.units(u.area).israeli > 0 && ctx.units(u.area).syrian > 0;
  let cost = u.spent ?? 0, stop = false; const triggers: Trigger[] = [], limited: string[] = [];
  for (let i = 1; i < path.length; i++) {
    if (stop || !neighbors(path[i - 1]).includes(path[i])) return null;
    const s = step(u, ctx, path[i - 1], path[i], i === 1 && !u.spent, allowance);
    if (!s) return null;
    cost += s.cost + (startContested && i === 1 ? 1 : 0);
    if (cost > allowance && i > 1) return null;
    stop = !!s.stop; if (s.trigger) triggers.push(s.trigger); if (s.limited) limited.push(s.limited);
  }
  return { cost, mustStop: stop, triggers, limited };
}

/** Strategic movement (5.4, 14.8): supplied reserve units, road connections only, through friendly-controlled uncontested areas,
 *  never across an unbridged AT ditch or a blown bridge, nor into or out of an area interdicted or raided by the enemy. */
export function stratReachable(u: GMoveUnit, ctx: GMoveCtx): number[] {
  const enemy = enemyOf(u.side), out = new Set<number>(), seen = new Set([u.area]), todo = [u.area];
  const ok = (a: number) => isAssembly(a) || (ctx.controller?.(a) === u.side && ctx.units(a)[enemy] === 0 && !(ctx.assets?.(a)[enemy]) && ctx.interdicted?.(a) !== enemy
    && !(u.side === 'israeli' && ctx.raids?.has(a)));
  if (ctx.interdicted?.(u.area) === enemy) return [];
  while (todo.length) {
    const from = todo.pop()!;
    for (const to of neighbors(from)) {
      const c = connection(from, to)!, key = edgeKey(from, to);
      if (seen.has(to)) continue;
      const roadLike = c.kind === 'road' || (c.kind === 'assembly' && isAssembly(from)) || c.kind === 'transfer';
      if (!roadLike || (c.atDitch && !ctx.bridgedDitch?.has(key)) || (c.river && ctx.blownBridges?.has(key)) || !ok(to)) continue;
      if (u.side === 'syrian' && ctx.turn <= 4 && c.sector) continue;
      seen.add(to); todo.push(to); if (!isAssembly(to) && ctx.units(to)[u.side] < 2) out.add(to);
    }
  }
  return [...out].sort((a, b) => a - b);
}
export { ASSEMBLY };
