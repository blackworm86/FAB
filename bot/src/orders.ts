// Orders for the attacker's Movement Phase (the "task for each block" of docs/COMPUTER-PLAYER-PLAN.md): choose the
// areas worth attacking now (objectives, road junctions, fights already under way), give each one the strongest blocks
// that can reach it this phase (up to the stacking limit) and the assets the plan commits, and attack only where that
// whole group has the odds. The doctrine moves the ordered blocks to their objective; the others follow its usual rules.
import * as E from '../../engine/src';
import type { Game, Side, Unit } from '../../engine/src';
import type { Action } from './actions';

export const HIDDEN_STEPS = 2.5; // a hidden enemy block, on average
export const ASSET_STEPS = 1.5; // what one battle asset (artillery, armour, ...) adds to an attack, in steps
export type Orders = Map<string, number>; // block id -> area to attack

export const steps = (us: Unit[]) => us.reduce((t, u) => t + (u.garrison ? 1 : E.isPlaceholder(u) ? HIDDEN_STEPS : u.str), 0);
const fighting = (g: Game, a: number, s: Side) => E.unitsIn(g, a, s).filter((u) => !u.ghost);
const defence = (g: Game, a: number, s: Side) => steps(fighting(g, a, E.other(s))) * (1 + 0.25 * E.areas.get(a)!.tdn);
const worth = (a: number) => {
  const v = E.areas.get(a)!.vp;
  return v.german + v.allied + (v.mutual ? 1 : 0);
};
const junction = (a: number) => E.neighbors(a).filter((n) => E.connection(a, n)?.type === 'road').length >= 4;
/** Assets in the Available Box that fight in a battle. */
export const assetsInHand = (g: Game, s: Side) => E.boxOf(g, s, 'available').filter((c) => E.isArty(c) || E.isBattleAsset(c)).length;

/** What taking an area is worth to the attacker: its points, a road junction, a fight already under way there. */
function value(g: Game, s: Side, a: number): number {
  return 3 * worth(a) + (junction(a) ? 2 : 0) + (fighting(g, a, s).length ? 2 : 0) + (g.control[a] !== s ? 1 : 0);
}

/** The orders for this phase. `moves`: the legal moves listed now; `assets`: how many the plan commits per battle; `odds`: what it needs. */
export function makeOrders(g: Game, s: Side, moves: Action[], assets: number, odds: number): Orders {
  const reach = new Map<number, Unit[]>();
  for (const m of moves)
    if (m.fn === 'move') {
      const u = g.units.find((x) => x.id === m.args[0])!,
        to = m.args[1] as number;
      if (fighting(g, to, E.other(s)).length) reach.set(to, [...(reach.get(to) ?? []), u]);
    }
  const orders: Orders = new Map();
  let pool = assetsInHand(g, s);
  const ranked = [...reach.keys()].map((a) => ({ a, v: value(g, s, a) / Math.max(1, defence(g, a, s)) })).sort((x, y) => y.v - x.v);
  for (const { a } of ranked) {
    const room = (E.VOLUME.stackLimit?.(g, a) ?? 2) - E.blocks(g, a, s).length;
    if (room <= 0) continue;
    const group = reach
      .get(a)!
      .filter((u) => !orders.has(u.id))
      .sort((x, y) => y.str - x.str)
      .slice(0, room);
    if (!group.length) continue;
    const backing = Math.min(assets, pool);
    if ((steps(fighting(g, a, s)) + steps(group) + backing * ASSET_STEPS) / Math.max(0.5, defence(g, a, s)) < odds) continue;
    for (const u of group) orders.set(u.id, a);
    pool -= backing;
  }
  return orders;
}
