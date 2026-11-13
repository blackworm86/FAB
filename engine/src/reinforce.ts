// The Reinforcement Phase and the chit cup: drawing chits, the Used Box going back, recovering an asset (4.1a), arrivals and where they may enter, rerouting (8.27), random reinforcements (18.9).
import { areas } from './map';
import { rng } from './dice';
import { isAsset, type Side } from './chits';
import { CUR } from './volumes';
import { chooseArtyLoss } from './vol/bulge';
import {
  appropriateAreas,
  boxOf,
  chit,
  ENTRY,
  type Game,
  other,
  roomFor,
  saAvailable,
  say,
  secure,
  sidesOf,
  spendSA,
  type Unit,
  unitsIn,
  updateControl,
} from './game';

/* ================= chits ================= */
export function drawChits(g: Game, side: Side, n: number) {
  for (let i = 0; i < n; i++) {
    const cup = boxOf(g, side, 'cup');
    if (!cup.length) return;
    const c = cup[Math.floor(rngf(g) * cup.length)];
    if (c.kind === 'event_delayed_response' || c.kind === 'event_asset_delayed') {
      c.box = 'eliminated';
      say(g, `${side} drew ${c.name} (no effect)`, side);
    } else {
      c.box = 'available';
      c.drawn = g.turn * 10 + (g.phasing === sidesOf(g)[0] ? 1 : 2);
      c.firstDrawn ??= c.drawn;
    } // 16.11: v.d. Heydte drops only in the Admin Phase it is FIRST drawn
  }
}
export const rngf = (g: Game) => (secure ? (g.rolls++, secure()) : rng(g.seed * 104729 + g.rolls++)());
export function recycleUsed(g: Game, side: Side, artyDone = false) {
  if (!artyDone && CUR.beforeRecycle?.(g, side)) return;
  for (const c of boxOf(g, side, 'used')) {
    if (c.direct) continue; // waits for its turn (a counterbattery victim, Golan 17.34)
    if (g.opts.scenario === 'cold' && (c.kind === 'sa_block' || c.kind === 'command_staff')) {
      // P.6: reusable SAs and HQ assets wait one more turn in the Used Box
      if (c.held == null) {
        c.held = g.turn;
        continue;
      }
      c.held = undefined;
    }
    c.box = c.kind === 'sa_block' ? 'available' : 'cup';
  }
}
/** 4.1a: with the reusable Special Action unused, move one asset of the player's choice from the Used Box to the Available Box (or none). */
export function recoverAsset(g: Game, side: Side, id: string | null) {
  if (!g.recover.includes(side)) throw new Error('no recovery pending for that side');
  if (id != null) {
    const c = chit(g, id);
    if (c.side !== side || c.box !== 'used' || !isAsset(c)) throw new Error('pick an asset from the Used Box');
    c.box = 'available';
    say(g, `${side}: ${c.name} returned to Available (unused Special Action)`);
  }
  g.recover = g.recover.filter((s) => s !== side);
  recycleUsed(g, side);
}
/** The old automatic choice (engineer first), for tests and for a player who just wants to move on. */
export function autoRecover(g: Game) {
  const pri = ['engineer', 'artillery', 'rocket_artillery', 'armor_asset', 'fuel', 'infantry_asset', 'command_staff'];
  for (const side of [...g.recover]) {
    const back = boxOf(g, side, 'used')
      .filter((c) => isAsset(c))
      .sort((a, b) => pri.indexOf(a.kind) - pri.indexOf(b.kind))[0];
    recoverAsset(g, side, back?.id ?? null);
  }
  if (g.artyPick) chooseArtyLoss(g, boxOf(g, 'german', 'used').find((c) => c.kind === 'artillery')!.id);
}
/** 18.92: for each side, the units still to arrive on or before this turn plus next turn's go in a cup; as many as are due this turn are drawn,
 *  the rest wait for next turn. Arriving units are public (off-map blocks), so no hidden information is involved. */
function randomizeArrivals(g: Game) {
  for (const side of sidesOf(g)) {
    const due = g.units.filter(
      (u) => u.side === side && u.arrival != null && u.arrival <= g.turn && u.area == null && u.str > 0 && !g.arrived.includes(u.id),
    );
    const cup = [...due, ...g.units.filter((u) => u.side === side && u.arrival === g.turn + 1 && u.area == null && u.str > 0)];
    const n = due.filter((u) => u.arrival === g.turn).length;
    if (!n || cup.length <= n) continue;
    const drawn: Unit[] = [];
    for (let i = 0; i < n; i++) {
      const pool = cup.filter((u) => !drawn.includes(u));
      drawn.push(pool[Math.floor(rngf(g) * pool.length)]);
    }
    for (const u of cup) u.arrival = drawn.includes(u) ? g.turn : g.turn + 1;
    say(g, `random reinforcements: ${drawn.map((u) => u.name).join(', ')} arrive this turn (18.9)`, side);
  }
}
export function reinforcementPhase(g: Game) {
  g.arrived = [];
  g.recover = [];
  g.artyPick = false;
  for (const side of sidesOf(g)) {
    CUR.reinforce?.(g, side);
    const sa = g.chits.find((c) => c.kind === 'sa_block' && c.side === side && c.turn === 2 && g.turn >= 2);
    if (g.turn >= 2 && sa) {
      if (sa.box === 'available') {
        if (boxOf(g, side, 'used').some((c) => isAsset(c))) {
          g.recover.push(side);
          continue;
        }
      } // 4.1a unused reusable SA: the player brings one asset back first
      else if (!(g.opts.scenario === 'cold' && sa.box === 'used')) sa.box = 'available'; // Cold Shoulder: a used one waits a turn (recycleUsed)
    }
    recycleUsed(g, side);
  }
  if (g.opts.randomReinf) randomizeArrivals(g);
  g.pendingArrivals = g.units.filter((x) => x.arrival === g.turn && x.area == null && x.str > 0).map((x) => x.id);
  g.tfNew = CUR.id === 'bulge' ? g.chits.filter((x) => x.kind === 'task_force' && x.box === 'available').map((x) => x.id) : []; // 16.22: a Task Force kept back may be placed later
  for (const c of g.chits.filter((x) => x.turn === g.turn && (x.box === 'future' || (x.box === 'used' && x.direct)))) {
    if (c.kind === 'task_force' && CUR.id === 'bulge') {
      c.box = 'available';
      g.tfNew.push(c.id);
    } else if (c.direct) {
      c.box = 'available';
      c.direct = undefined;
    } else c.box = 'cup'; // direct: back straight to the Available Box (Golan 17.34)
  }
}
/** 8.27 Reroute a reinforcing unit (Reinforcement Phase, one Special Action). */
export function rerouteOptions(g: Game, unitId: string): number[] {
  const u = g.units.find((x) => x.id === unitId);
  if (
    !u ||
    CUR.noReroute ||
    g.phase !== 'reinforcement' ||
    !g.arrived.includes(u.id) ||
    u.area == null ||
    !saAvailable(g, u.side, u.ech).length
  )
    return [];
  return [...new Set(appropriateAreas(u, g))].filter(
    (a) => a !== u.area && (g.control[a] === u.side || !unitsIn(g, a).length) && roomFor(g, u, a) && !unitsIn(g, a, other(u.side)).length,
  );
}
export function reroute(g: Game, unitId: string, area: number, chitId?: string) {
  if (!rerouteOptions(g, unitId).includes(area)) throw new Error('not a legal entry area');
  const u = g.units.find((x) => x.id === unitId)!,
    from = u.area!;
  spendSA(g, u.side, u.ech, 'reroute a reinforcement', chitId);
  u.area = area;
  g.control[area] = u.side;
  updateControl(g, from);
  say(g, `${u.name} rerouted to ${areas.get(area)!.name}`, u.side);
}

/* ================= arrivals (4.1c) ================= */
export const listedEntries = (u: Unit) =>
  (u.entry ?? []).map((l) => (l.startsWith('#') ? +l.slice(1) : CUR.entries[l]?.area)).filter(Boolean) as number[];
const stackFree = (g: Game, u: Unit, a: number) => CUR.id === 'bulge' && g.turn === 4 && u.side === 'german' && a === ENTRY.Z.area; // 15.3
export const entryOpen = (g: Game, u: Unit, a: number) =>
  (!g.inPlay || g.inPlay.includes(a)) &&
  (g.control[a] === u.side || !unitsIn(g, a).length) &&
  (roomFor(g, u, a) || stackFree(g, u, a)) &&
  !unitsIn(g, a, other(u.side)).length;
/** Entry areas a block that has not arrived yet may be placed in. Areas outside its listed ones cost a Special Action (8.27). */
export function arrivalOptions(g: Game, id: string): { area: number; sa: boolean }[] {
  const u = g.units.find((x) => x.id === id);
  if (!u || !g.pendingArrivals.includes(id)) return [];
  const own = listedEntries(u).filter((a) => entryOpen(g, u, a)),
    sa = saAvailable(g, u.side, u.ech).length > 0;
  const rest = u.delayed || sa ? [...new Set(appropriateAreas(u, g))].filter((a) => !own.includes(a) && entryOpen(g, u, a)) : []; // 4.1c a delayed unit takes the nearest allowed area, otherwise it costs a Special Action
  return [...own.map((area) => ({ area, sa: false })), ...rest.map((area) => ({ area, sa: !u.delayed }))];
}
export function placeArrival(g: Game, id: string, area: number, chitId?: string) {
  const opt = arrivalOptions(g, id).find((o) => o.area === area);
  if (!opt) throw new Error('not a legal entry area');
  const u = g.units.find((x) => x.id === id)!;
  if (opt.sa) spendSA(g, u.side, u.ech, 'reroute a reinforcement', chitId);
  u.area = area;
  g.control[area] = u.side;
  g.arrived.push(id);
  g.pendingArrivals = g.pendingArrivals.filter((x) => x !== id);
  say(g, `${u.name} arrives in ${areas.get(area)!.name}`, u.side);
}
export function autoArrive(g: Game, id: string) {
  const u = g.units.find((x) => x.id === id)!,
    opts = listedEntries(u),
    to = opts.find((a) => g.control[a] === u.side && (roomFor(g, u, a) || stackFree(g, u, a))) ?? opts.find((a) => !unitsIn(g, a).length);
  g.pendingArrivals = g.pendingArrivals.filter((x) => x !== id);
  if (to == null) {
    u.arrival = g.turn + 1;
    u.delayed = true;
    say(g, `${u.name} delayed one turn (entry blocked)`);
    return;
  }
  u.area = to;
  g.control[to] = u.side;
  g.arrived.push(id);
  say(g, `${u.name} arrives in ${areas.get(to)!.name}`, u.side);
}
