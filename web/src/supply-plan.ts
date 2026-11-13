/** Supply for planning moves: where a block would end up out of supply, and where each side's supply comes from. */
import * as E from '../../engine/src';

/** Destinations (of `areas`) where the block would be out of supply: each move is played on a copy of the game and supply traced from there. */
export function noSupplyTargets(g: E.Game, id: string, areas: number[]): Set<number> {
  const u = g.units.find((x) => x.id === id),
    out = new Set<number>();
  if (!u) return out;
  for (const a of areas) {
    try {
      const h = structuredClone(g);
      E.move(h, id, a, true);
      if (!E.inSupply(h, u.side, a)) out.add(a);
    } catch {
      /* not a legal move on the copy */
    }
  }
  return out;
}
/** The areas a side holds where its supply trace ends at once: its supply sources (and an air-supplied area). */
export const supplySources = (g: E.Game, side: E.Side, areas: number[]) =>
  areas.filter((a) => g.control[a] === side && E.supplyPath(g, side, a)?.length === 1);
