// Movement: reserves (5.21), where a block can go and what the move costs, moving step by step, blowing a bridge in the enemy's path (14.51), strategic movement (5.4).
import { areas, connection, neighbors, setPlayArea } from './map';
import { type Side } from './chits';
import { CUR } from './volumes';
import { dropGreif, interdictCheck } from './vol/bulge';
import { contested, type Game, inSupply, keyOf, other, roll, roomFor, say, type Unit, unitsIn, updateControl } from './game';

const markerKey = (g: Game, u: Unit) => CUR.markerKey(g, u);
export function canReserve(g: Game, u: Unit) {
  return (
    g.moving?.id !== u.id &&
    u.area != null &&
    !u.garrison &&
    !u.fort &&
    (!u.ghost || !!CUR.ghostsMove?.(g)) &&
    !u.reserve &&
    !u.moved &&
    !u.unsupplied &&
    u.disorder === 0 &&
    !contested(g, u.area) &&
    (g.markers[u.side]?.[markerKey(g, u)] ?? 0) > 0 &&
    (CUR.reserveOk?.(g, u) ?? true)
  );
}
/** 3.22 / 5.21: the Phasing Player marks reserves in his Operational Movement Phase; `anyTime` is for Command Staff 8.33 and set-ups. */
export function setReserve(g: Game, id: string, on: boolean, anyTime = false) {
  const u = g.units.find((x) => x.id === id)!;
  if (on && g.moving && g.moving.id !== id) endMove(g);
  if (on && !anyTime && (g.phase !== 'movement' || u.side !== g.phasing))
    throw new Error('reserves are marked by the phasing player in his Movement Phase (5.21)');
  if (on) {
    if (!canReserve(g, u)) throw new Error('no eligible reserve marker for this unit');
    if (u.interdict && !interdictCheck(g, u)) {
      u.adjOnly = true;
      const k0 = markerKey(g, u);
      g.markers[u.side][k0]--;
      (g.markersHeld ??= []).push([u.side, k0]);
      throw new Error(
        'Greif interdict: morale check failed, it cannot be placed in reserve, and that marker is out for this phase (17.11)',
      );
    }
    const k = markerKey(g, u);
    g.markers[u.side][k]--;
    u.reserve = k;
    CUR.onReserve?.(g, u);
  } else if (u.reserve) {
    g.markers[u.side][u.reserve]++;
    u.reserve = null;
  }
}
export const dropReserve = (g: Game, u: Unit) => {
  if (u.reserve) {
    g.markers[u.side][u.reserve]++;
    u.reserve = null;
  }
};
export interface Opt {
  area: number;
  cost: number;
  fuel: boolean;
  mustStop: boolean;
  path: number[];
  triggers?: string[];
  limited?: string[];
}
export const markerAreas = (g: Game, owner: Side) =>
  Object.keys(g.roadblocks)
    .map(Number)
    .filter((a) => g.roadblocks[a] === owner && !unitsIn(g, a).length);
export function moveOptions(g: Game, id: string): Opt[] {
  setPlayArea(g.inPlay);
  const u = g.units.find((x) => x.id === id)!;
  if (u.area == null || u.garrison || u.fort || (u.ghost && !CUR.ghostsMove?.(g)) || u.moved) return [];
  const mover = g.phase === 'reaction' ? other(g.phasing) : g.phasing;
  const exploit = g.phase === 'btMove' && u.exploit,
    reserveBt = g.phase === 'btMove' && !!u.reserve;
  const ok =
    (g.phase === 'movement' && u.side === g.phasing) ||
    (g.phase === 'reaction' && u.side === mover && !!u.reserve) ||
    (g.phase === 'btMove' && u.side === g.phasing && (exploit || reserveBt));
  if (!ok) return [];
  const enemy = other(u.side),
    one = exploit && !reserveBt && !u.peiperFull; // 18.3 KG Peiper may use its full allowance once
  let r = CUR.reach(g, u, one);
  if (exploit && !reserveBt) r = r.filter((x) => !x.path.some((p, i) => i > 0 && g.blown.includes(keyOf(x.path[i - 1], p))));
  const mv = g.moving?.id === u.id ? g.moving : null;
  if (mv?.left) r = r.filter((x) => !unitsIn(g, x.area, other(u.side)).length); // 5.34: having left a contested area, it may neither enter nor create another one
  if (mv?.fuel) r = r.map((x) => ({ ...x, fuel: false })); // 16.13: the move's fuel is already paid                        // 7.31 no crossing of a blown bridge
  return r.filter((x) => {
    if (CUR.moveOk && !CUR.moveOk(g, u, x.area)) return false;
    if (!roomFor(g, u, x.area)) return false; // 5.1
    if (u.disorder > 0 && unitsIn(g, x.area, enemy).length) return false; // 9.33d: a disordered unit may not enter an area with enemy units or assets
    const en = unitsIn(g, x.area, enemy).length > 0,
      cont = contested(g, x.area);
    if (g.phase === 'reaction' && en && !cont) return false; // 7.2: reaction never creates a newly contested area
    const last = connection(x.path[x.path.length - 2], x.area)!;
    if (en && last.river && g.riverCross.includes(keyOf(x.path[x.path.length - 2], x.area))) return false; // 5.35c
    return true;
  });
}
function finishMove(g: Game, u: Unit, opt: Opt, bridgeBlown: boolean, step?: { left: boolean }) {
  const bc = u.bcross,
    peiper = !!u.peiperFull,
    wasExploit = u.exploit && !u.reserve && !peiper,
    m = g.moving?.id === u.id ? g.moving : null; // 18.3: Peiper's full move goes on step by step
  for (const a of opt.path.slice(1)) if (g.roadblocks[a] && g.roadblocks[a] !== u.side) delete g.roadblocks[a]; // 4.34 (2016): a roadblock goes when an enemy unit pays its penalty, not when a friendly unit enters
  u.bcross = false; // 14.62a the marker goes when the unit next moves
  const from = u.area!,
    to = opt.area,
    last = connection(opt.path[opt.path.length - 2], to)!,
    enemy = other(u.side);
  const intoEnemy = unitsIn(g, to, enemy).length > 0;
  for (const a of opt.path.slice(1, -1))
    if (!unitsIn(g, a).length && g.control[a] !== u.side) {
      u.area = a;
      updateControl(g, a);
      say(g, `${u.name} passes through ${areas.get(a)!.name}: now ${CUR.sideName[u.side] ?? u.side}-controlled (2.4)`);
    } // 2.4: control changes the instant a unit is sole occupant, passing through too
  const faceUp = unitsIn(g, to, enemy).some((x) => x.up === to); // 5.22 a unit entering a contested area whose forces are already face-up is revealed too
  u.from = intoEnemy ? opt.path[opt.path.length - 2] : from;
  u.area = to;
  if (faceUp) u.up = to;
  u.moved = true;
  u.adjOnly = false;
  u.spent = 0;
  dropReserve(g, u); // into the enemy: the area it came from is the one across the boundary (an aborted river assault goes back there, 6.5)
  if (intoEnemy && last.river) {
    g.riverCross.push(keyOf(opt.path[opt.path.length - 2], to));
  }
  if (intoEnemy)
    (g.entered[to] ??= []).push({
      id: u.id,
      river: last.river,
      blown: bridgeBlown || g.blown.includes(keyOf(opt.path[opt.path.length - 2], to)),
    });
  if (g.phase === 'btMove' || g.phase === 'movement') {
    u.exploit = u.exploit && g.phase === 'btMove' ? false : u.exploit;
  }
  CUR.afterMove?.(g, u, opt);
  updateControl(g, from);
  updateControl(g, to);
  say(g, `${u.name} ${areas.get(from)!.name} → ${areas.get(to)!.name} (${opt.cost} MP)`);
  g.moving = null;
  if (
    step &&
    !opt.mustStop &&
    u.area === to &&
    !wasExploit &&
    !u.adjOnly &&
    !u.disorder &&
    !u.unsupplied &&
    ['movement', 'reaction', 'btMove'].includes(g.phase)
  ) {
    // one area at a time: it may go on with the points left
    u.moved = false;
    u.spent = opt.cost;
    u.bcross = bc;
    if (peiper) {
      u.exploit = true;
      u.peiperFull = true;
    }
    g.moving = { id: u.id, left: step.left, steps: (m?.steps ?? 0) + opt.path.length - 1, fuel: !!(m?.fuel || opt.fuel) };
    if (!moveOptions(g, u.id).length) endMove(g);
  }
}
/** The block moving step by step stops here (or another block is chosen, or the phase ends): its move is over. */
export function endMove(g: Game) {
  const m = g.moving;
  if (!m) return;
  const u = g.units.find((x) => x.id === m.id);
  if (u) {
    u.moved = true;
    u.spent = 0;
    if (u.peiperFull) {
      u.peiperFull = undefined;
      u.exploit = false;
    }
  }
  g.moving = null;
}
/** The movement allowance of a block (MP), for showing how many points a moving block has left. */
export const allowance = (g: Game, u: Unit) => CUR.allowance?.(g, u) ?? (u.cls === 'armor' ? 6 : 3);
/** Move a block. `step`: the table's one-area-at-a-time move, after which the block may go on with the points it has left (the tests move in one go). */
export function move(g: Game, id: string, to: number, step = false) {
  if (g.moving && g.moving.id !== id) endMove(g); // another block: the one moving before is done for good
  if (g.pendingBlow) throw new Error('resolve the bridge-blowing attempt first');
  const opt = moveOptions(g, id).find((x) => x.area === to);
  if (!opt) throw new Error('illegal move');
  const u = g.units.find((x) => x.id === id)!;
  {
    const pre = CUR.beforeMove?.(g, u, opt);
    if (pre) return pre;
  }
  const prev = opt.path[opt.path.length - 2],
    last = connection(prev, to)!,
    enemy = other(u.side);
  const newly = unitsIn(g, to, enemy).length > 0 && !g.contestedAtMoveStart.includes(to); // 5.35d: newly contested this phase, even once a first unit entered overland
  if (
    last.river &&
    (CUR.id !== 'golan73' || last.type === 'road') &&
    !g.blown.includes(keyOf(prev, to)) &&
    newly &&
    !g.blowTried.includes(to) &&
    (g.phase === 'movement' || g.phase === 'btMove')
  ) {
    // Golan 14.41: no bridge on a field connection
    g.pendingBlow = {
      unit: id,
      path: opt.path,
      fuel: opt.fuel || undefined,
      spent: moveOptions(g, id).find((x) => x.area === opt.path[opt.path.length - 2])?.cost ?? 0,
    };
    return 'blow'; // 5.35d the opponent may try to blow the bridge
  }
  finishMove(g, u, opt, false, step ? { left: g.moving?.id === id ? g.moving.left : contested(g, u.area!) } : undefined);
  return 'moved';
}
export function resolveBlow(g: Game, attempt: boolean) {
  const p = g.pendingBlow!;
  g.pendingBlow = null;
  const u = g.units.find((x) => x.id === p.unit)!,
    to = p.path[p.path.length - 1],
    prev = p.path[p.path.length - 2];
  const opt = { area: to, cost: 0, fuel: !!p.fuel, mustStop: true, path: p.path }; // 16.13: a long German move still spends its fuel
  g.blowTried.push(to);
  if (!attempt) {
    finishMove(g, u, { ...opt, cost: p.path.length }, false);
    return 'crossed';
  }
  const r = roll(g),
    need = g.greif[keyOf(prev, to)] ? 1 : 5; // 17.12: a Greif team holding the bridge makes it a 1
  (g.checks ??= []).push({
    who: `Bridge ${areas.get(prev)!.name}–${areas.get(to)!.name}`,
    why: 'Blow the bridge (5.35d)',
    sn: need,
    die: r,
    ok: r <= need,
    area: prev,
  });
  if (g.checks.length > 30) g.checks.splice(0, g.checks.length - 30); // shown on the table like a morale check
  if (r > need) {
    say(g, `bridge blow attempt failed (rolled ${r})`);
    finishMove(g, u, { ...opt, cost: p.path.length }, false);
    return 'failed';
  }
  g.blown.push(keyOf(prev, to));
  say(g, `bridge ${areas.get(prev)!.name}–${areas.get(to)!.name} blown (rolled ${r})`);
  dropGreif(g, keyOf(prev, to));
  const exploitOnly = g.phase === 'btMove' && u.exploit && !u.reserve;
  if (exploitOnly) {
    u.moved = true;
    u.exploit = false;
    say(g, `${u.name} cannot cross the blown bridge and does not move at all (7.31)`);
    return 'stopped';
  } // exploitation units may not cross a blown bridge, even one blown by their own attempt
  if (p.path.length === 2) {
    finishMove(g, u, { ...opt, cost: 6 }, true);
    return 'blown-crossed';
  } // began adjacent: still crosses, whole allowance
  // 5.35d: it does not enter the area, loses one movement point, and may carry on from where it stands
  const here = p.path.length - 2 > 0 ? prev : u.area!;
  u.spent = (p.spent ?? 0) + 1;
  u.area = here;
  u.from = p.path[0];
  dropReserve(g, u);
  say(g, `${u.name} stops in ${areas.get(prev)!.name} (bridge blown ahead) and may keep moving`);
  updateControl(g, p.path[0]);
  updateControl(g, prev);
  return 'stopped';
}
/** Where a strat-move can go, each area with the area it is reached from (the route). */
function stratReach(g: Game, u: Unit): Map<number, number> {
  const prev = new Map<number, number>([[u.area!, -1]]),
    q = [u.area!];
  while (q.length) {
    const a = q.shift()!;
    for (const n of neighbors(a)) {
      if (prev.has(n) || g.control[n] !== u.side || unitsIn(g, n, other(u.side)).length || contested(g, n) || g.blown.includes(keyOf(a, n)))
        continue;
      const step = CUR.stratStep ? CUR.stratStep(g, u, a, n) : true;
      if (!step) continue;
      prev.set(n, a);
      if (step !== 'end') q.push(n); // 'end': reachable, but not a way through (The Bulge: an interdicted area)
    }
  }
  return prev;
}
export function stratOptions(g: Game, id: string): number[] {
  const u = g.units.find((x) => x.id === id)!;
  if (g.phase !== 'strategic' || u.side !== g.phasing || !u.reserve || u.unsupplied || u.area == null || u.moved) return [];
  if (CUR.stratAllowed && !CUR.stratAllowed(g, u)) return [];
  return [...stratReach(g, u).keys()].filter(
    (a) => a !== u.area && (!CUR.moveOk || CUR.moveOk(g, u, a)) && roomFor(g, u, a) && inSupply(g, u.side, a),
  );
}
export function stratMove(g: Game, id: string, to: number) {
  if (!stratOptions(g, id).includes(to)) throw new Error('illegal strategic move');
  const u = g.units.find((x) => x.id === id)!,
    from = u.area!,
    prev = stratReach(g, u),
    path = [to];
  while (prev.get(path[0])! >= 0) path.unshift(prev.get(path[0])!);
  if (u.interdict && !interdictCheck(g, u)) {
    u.adjOnly = true;
    return;
  } // 17.11: a strat-move is a move attempt; failing, no strat-move
  if (CUR.id === 'bulge' && u.side === 'german') for (let i = 1; i < path.length; i++) dropGreif(g, keyOf(path[i - 1], path[i])); // 17.12: a German crossing takes the bridge
  CUR.afterStrat?.(g, u, path);
  u.area = to;
  u.moved = true;
  dropReserve(g, u);
  updateControl(g, from);
  updateControl(g, to);
  say(g, `${u.name} strategic move ${areas.get(from)!.name} → ${areas.get(to)!.name}`);
}
