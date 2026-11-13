// Supply (9): tracing a supply line, the Supply Phase with its checks and its clean-up, and the path and the reason shown to the player.
import { areas, neighbors, allNeighbors, setPlayArea } from './map';
import { moraleSn } from './combat';
import { type Side } from './chits';
import { CUR } from './volumes';
import { AIRBORNE, bulgeSupplyStep } from './vol/bulge';
import { airSup, check } from './admin';
import { dropReserve } from './moves';
import { eliminate } from './fire';
import { chit, contested, type Game, keyOf, other, quality, say, type Unit, unitsIn, updateControl } from './game';

/** Neighbours a supply line may use: the play area, plus Cold Shoulder's supply-only Zone 5 (P.6). */
const supN = (g: Game, a: number) =>
  g.supplyOnly ? allNeighbors(a).filter((n) => g.inPlay!.includes(n) || g.supplyOnly!.includes(n)) : neighbors(a);
export function inSupply(g: Game, side: Side, start: number) {
  setPlayArea(g.inPlay);
  if (CUR.supplyFree?.(g, side, start)) return true; // 17.2 Air Supply Mission (The Bulge); Mt Hermon, the Assembly areas (Golan)
  const src = CUR.sources(g, side);
  const seen = new Set([start]),
    todo = [start];
  while (todo.length) {
    const a = todo.pop()!;
    if (src.has(a) && g.control[a] === side) return true;
    for (const n of supN(g, a)) {
      if (seen.has(n) || g.control[n] !== side || !(CUR.supplyStep ?? bulgeSupplyStep)(g, side, a, n, a === start)) continue;
      seen.add(n);
      todo.push(n);
    }
  }
  return false;
}
/** Who has a supply status: units, plus The Bulge's garrison and task force assets (16.21, 16.22: eliminated by a failed unsupplied morale check). */
const hasSupply = (x: Unit) =>
  !x.garrison || (CUR.id === 'bulge' && !x.id.startsWith('DR-') && !x.heydte) || (CUR.id === 'golan73' && x.id.startsWith('G-')); // Golan 16.24: garrisons too (raids and Lt. Zvika are always supplied)
export function supplyPhase(g: Game) {
  CUR.onPhase?.(g, 'supply', 'start');
  for (const a of areas.keys()) updateControl(g, a);
  for (const u of g.units.filter((x) => x.area != null && hasSupply(x)))
    u.unsupplied = !(CUR.alwaysSupplied?.(g, u) || (CUR.unitSupply ? CUR.unitSupply(g, u) : inSupply(g, u.side, u.area!)));
  for (const u of g.units.filter((x) => x.area != null && x.fort)) u.unsupplied = false; // strongpoints are always in supply (Golan 15.6)
  for (const u of g.units.filter((x) => x.area != null && !x.unsupplied && x.disorder))
    if (!CUR.recoverOk || CUR.recoverOk(g, u)) u.disorder = u.disorder === 2 ? 0 : 2;
  g.riverAssault = [];
  if (!g.opts.fwMaintain) g.fieldWorks = g.fieldWorks.filter((a) => !contested(g, a));
  else
    for (const a of g.fieldWorks.filter((x) => contested(g, x) && (g.fwOwner[x] ?? g.control[x]) === g.phasing)) {
      // 18.8: in the owner's own Supply Phase, one unit (the best: the player's natural choice) checks morale
      const us = unitsIn(g, a, g.phasing).filter((u) => !u.garrison);
      if (!us.length) continue;
      const sn = (u: Unit) => moraleSn(quality(u), u.disorder > 0, u.unsupplied && !(g.opts.airborne && AIRBORNE.has(u.name)));
      const u = [...us].sort((x, y) => sn(y) - sn(x))[0],
        { r, ok } = check(
          g,
          u,
          sn(u),
          `Maintaining field works (${CUR.id === 'golan73' ? '18.1' : CUR.id === 'sicily' ? '18.4' : '18.8'})`,
        );
      if (!ok) g.fieldWorks = g.fieldWorks.filter((x) => x !== a);
      say(
        g,
        `field works in ${areas.get(a)!.name}: ${u.name} rolls ${r} → ${ok ? 'maintained' : 'removed'} (${CUR.id === 'golan73' ? '18.1' : CUR.id === 'sicily' ? '18.4' : '18.8'})`,
      );
    }
  g.roadblocks = {}; // 4.34
  for (const u of g.units.filter((x) => x.id.startsWith('DR-') && x.area != null)) {
    chit(g, u.chitId!).box = 'used';
    u.area = null;
    say(g, `${u.name} survives and returns to the Used Box`);
  } // 4.35
  for (const a of areas.keys()) updateControl(g, a);
  CUR.onPhase?.(g, 'supply', 'mid');
  g.units.forEach((u) => {
    u.exploit = false;
    u.adjOnly = false;
    if (u.side === other(g.phasing)) dropReserve(g, u);
  });
  g.supplyPending = true; // the player rolls the checks (rollSupply); endPhase rolls them if nobody did
}
/** 9.4 the units of the Phasing Player that must roll an out-of-supply morale check now, with the number each needs. */
/** Sicily 16.34: an Air Supply mission spares the units of its area the morale check (the marker stays). */
export const airSupplied = (g: Game, x: Unit) => airSup(g).some((s) => s.area === x.area && s.side === x.side);
/** Units events, Special Actions, staff and engineers may not help: unsupplied, or kept supplied only by an Air Supply mission (9.34d, 17.21). */
export const helpless = (g: Game, u: Unit) => u.unsupplied || airSupplied(g, u);
export function supplyChecks(g: Game) {
  return g.units
    .filter((x) => x.area != null && x.side === g.phasing && x.unsupplied && hasSupply(x) && !x.fort && !airSupplied(g, x))
    .map((u) => ({ unit: u, sn: CUR.moraleSn(g, u, 'supply'), rounds: CUR.id === 'bulge' && g.turn >= 6 ? 2 : 1 }));
}
export function rollSupply(g: Game) {
  if (!g.supplyPending) throw new Error('no supply checks pending');
  g.supplyPending = false;
  const rounds = CUR.id === 'bulge' && g.turn >= 6 ? 2 : 1; // 14.93 (The Bulge)
  for (const u of g.units.filter(
    (x) => x.area != null && x.side === g.phasing && x.unsupplied && hasSupply(x) && !x.fort && !airSupplied(g, x),
  ))
    for (let i = 0; i < rounds && u.area != null; i++) {
      const q = quality(u),
        { r, ok } = check(g, u, CUR.moraleSn(g, u, 'supply'), 'Out of supply morale check (9.4)');
      if (ok) continue;
      if (u.garrison) {
        eliminate(g, u);
        say(g, `${u.name} unsupplied, morale failed (${r}): eliminated (${CUR.id === 'golan73' ? '16.24' : '16.21'})`);
        continue;
      }
      if (!u.disorder) {
        u.disorder = 1;
        say(g, `${u.name} unsupplied, morale failed (${r}): disordered`);
      } else if ((q === 'veteran' && r === 10) || (q === 'green' && r >= 8)) {
        eliminate(g, u);
        say(g, `${u.name} surrenders (${r})`);
      } else {
        u.str -= 1;
        if (u.str <= 0) eliminate(g, u);
        say(g, `${u.name} unsupplied and disordered, morale failed (${r}): step loss`);
      }
    }
  for (const a of areas.keys()) updateControl(g, a); // eliminated units leave areas behind
  supplyCleanup(g);
}
function supplyCleanup(g: Game) {
  CUR.onPhase?.(g, 'supply', 'end');
}
/** The chain of areas a block traces supply through (9.3), source last; or null when it is cut off. Same rule as inSupply. */
export function supplyPath(g: Game, side: Side, start: number): number[] | null {
  setPlayArea(g.inPlay);
  if (CUR.supplyFree?.(g, side, start)) return [start];
  const src = CUR.sources(g, side),
    prev = new Map<number, number>([[start, -1]]),
    q = [start];
  while (q.length) {
    const a = q.shift()!;
    if (src.has(a) && g.control[a] === side) {
      const p = [a];
      let x = a;
      while (prev.get(x)! >= 0) {
        x = prev.get(x)!;
        p.unshift(x);
      }
      return p;
    }
    for (const n of supN(g, a)) {
      if (prev.has(n) || g.control[n] !== side || !(CUR.supplyStep ?? bulgeSupplyStep)(g, side, a, n, a === start)) continue;
      prev.set(n, a);
      q.push(n);
    }
  }
  return null;
}
/** Why a cut-off area has no supply, in plain words: the friendly neighbours it could not pass and the enemy that holds the way. */
export function supplyWhy(g: Game, side: Side, start: number): string {
  const enemy = other(side),
    held = neighbors(start)
      .filter((n) => g.control[n] === enemy)
      .map((n) => areas.get(n)!.name);
  const blown = neighbors(start)
    .filter((n) => g.blown.includes(keyOf(start, n)))
    .map((n) => areas.get(n)!.name);
  const parts = [
    held.length ? `held by the enemy: ${held.join(', ')}` : '',
    blown.length ? `blown bridge to ${blown.join(', ')}` : '',
  ].filter(Boolean);
  return parts.length
    ? `No friendly path to a supply source (${parts.join('; ')}).`
    : 'No friendly path to a supply source: every way out runs through enemy-held areas.';
}
