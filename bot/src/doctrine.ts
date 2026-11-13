// The doctrine player: a short list of plain rules, a yardstick for the real computer player (stage 3 of
// docs/COMPUTER-PLAYER-PLAN.md). Attack where the odds are good, march on the objectives, hold the objectives
// under threat, keep a reserve. It reads only its seat's view; hidden enemy blocks count as average blocks.
import * as E from '../../engine/src';
import type { Game, Side, Unit } from '../../engine/src';
import { candidates, isLegal, type Action } from './actions';
import type { Player } from './random';
import { ASSET_STEPS, assetsInHand, makeOrders, type Orders } from './orders';

const HIDDEN_STEPS = 2.5; // a hidden enemy block, on average
/** The doctrine's settings; a commander plan is one set of them. */
export interface Style {
  attackOdds: number;
  assets: number;
  reserves: number;
  hold: boolean;
  /** army zone of the main effort (5 centre, 6 north, 7 south): deep objectives elsewhere are ignored */ focus?: number;
  /** the first doctrine, kept for measuring: no orders */ v1?: boolean;
  /** before 12 Nov, kept for measuring: abort judged on the blocks alone */ abortV1?: boolean;
  /** before the operational rules (12 Nov), kept for measuring: reserves for strategic moves, breakthroughs, events */ v3?: boolean;
  /** operational rules switched off one by one, for measuring each: 'reserve', 'breakthrough', 'greif', 'quality', 'assets' (rotation of worn blocks was measured harmful twice and removed, 12 Nov) */ skip?: string[];
}
export const DEFAULT_STYLE: Style = { attackOdds: 1.3, assets: 2, reserves: 2, hold: true }; // attackOdds: our steps against theirs, terrain included, to start or join a fight

const steps = (us: Unit[]) => us.reduce((t, u) => t + (u.garrison ? 1 : E.isPlaceholder(u) ? HIDDEN_STEPS : u.str), 0);
const fighting = (g: Game, a: number, s: Side) => E.unitsIn(g, a, s).filter((u) => !u.ghost);
/** Our steps against theirs in an area, the defender helped by the terrain. */
const odds = (g: Game, a: number, s: Side, extra = 0) => {
  const ours = steps(fighting(g, a, s)) + extra,
    theirs = steps(fighting(g, a, E.other(s)));
  return theirs ? ours / (theirs * (1 + 0.25 * E.areas.get(a)!.tdn)) : Infinity;
};
/** The attacker (the first player: the Germans in The Bulge) gives orders and counts its assets; the defender keeps the cautious rules (measured: bolder Allies lose points). */
const attacker = (g: Game, s: Side, st: Style) => !st.v1 && s === E.sidesOf(g)[0];
const backing = (g: Game, s: Side, st: Style) => (attacker(g, s, st) ? Math.min(st.assets, assetsInHand(g, s)) * ASSET_STEPS : 0);
/** The attacker's operational rules (rotation, reserves, breakthroughs, events) are on. */
const ops = (g: Game, s: Side, st: Style, rule = '') => attacker(g, s, st) && !st.v3 && !st.skip?.includes(rule);
const enemyNear = (g: Game, a: number, s: Side) => E.neighbors(a).some((n) => fighting(g, n, E.other(s)).length > 0);
const worth = (a: number, s: Side) => {
  const v = E.areas.get(a)!.vp;
  return (v.mutual ? 1 : 0) + (s === 'german' ? v.german : v.allied);
};

/** The areas the side marches on: areas worth points to either side that it does not hold, and its own threatened objectives. */
function targets(g: Game, s: Side, st: Style): number[] {
  const all = [...E.areas.keys()].filter((a) => !g.inPlay || g.inPlay.includes(a));
  const denies = (a: number) => worth(a, E.other(s)) > 0 && g.control[a] === E.other(s);
  const take = all.filter(
    (a) => worth(a, s) + worth(a, E.other(s)) > 0 && g.control[a] !== s && (denies(a) || !st.focus || E.areas.get(a)!.zone === st.focus),
  ); // a point gained or a point denied
  const keep = all.filter((a) => worth(a, s) > 0 && g.control[a] === s && enemyNear(g, a, s) && fighting(g, a, s).length < 2);
  return [...take, ...keep];
}
/** Steps from every area to the nearest target (breadth-first over the map). */
function distances(g: Game, from: number[]): Map<number, number> {
  const d = new Map(from.map((a) => [a, 0])),
    q = [...from];
  for (let i = 0; i < q.length; i++)
    for (const n of E.neighbors(q[i]))
      if (!d.has(n) && (!g.inPlay || g.inPlay.includes(n))) {
        d.set(n, d.get(q[i])! + 1);
        q.push(n);
      }
  return d;
}

/** How good one action is for the doctrine; null: never do it. Higher is better; ending the phase scores 0. */
export function score(
  g: Game,
  s: Side,
  a: Action,
  dist: Map<number, number>,
  st: Style,
  orders: Orders = new Map(),
  stuck: Set<string> = new Set(),
): number | null {
  const unit = (id: unknown) => g.units.find((u) => u.id === id)!,
    b = g.battle;
  switch (a.fn) {
    case 'endPhase':
    case 'setDone':
    case 'endMove':
      return 0;
    // waiting decisions
    case 'resolveBlow':
      return a.args[0] ? 1 : 0.5;
    case 'recoverAsset':
      return a.args[1] == null ? 0.1 : E.isArty(E.chit(g, a.args[1] as string)) ? 2 : 1;
    case 'chooseArtyLoss':
    case 'chooseRetreat':
    case 'closeBattle':
    case 'roll_step':
      return 1;
    // battles
    case 'passSA':
      return 1;
    case 'assign':
      return b &&
        (b.assets[s]?.length ?? 0) < st.assets + (ops(g, s, st, 'assets') && s === b.attacker && assetsInHand(g, s) > 6 ? 1 : 0) &&
        (s !== b.attacker || odds(g, b.area, s) >= 1) &&
        a.args[2] !== 'support'
        ? 2
        : null;
    case 'setReady':
      return 1;
    case 'autoLosses':
      return 1;
    case 'chooseFirstLoss':
      return a.args[1] === b?.attPoint ? 1 : null;
    case 'attackerChoice':
      return (a.args[1] as boolean) === (b != null && odds(g, b.area, s, st.abortV1 ? 0 : b.assets[s].length * ASSET_STEPS) < 1) ? 1 : 0.5; // abort only when outmatched, the assets already in the battle counted
    case 'defenderChoice':
      return (a.args[1] as boolean) ===
        (b?.pendingKind === 'arty' || (b != null && steps(fighting(g, b.area, s)) <= b.pending && worth(b.area, s) === 0))
        ? 1
        : 0.5;
    case 'declineExploit':
      return 0.5;
    case 'startBattle': {
      const area = a.args[0] as number;
      if (E.mustFight(g).includes(area)) return 5;
      if (a.args[1] && g.phase === 'btCombat' && !E.newlyContested(g).includes(area)) return null; // no Special Action spent on it
      return odds(g, area, s, backing(g, s, st)) >= st.attackOdds ? 3 : null;
    }
    // supply, reinforcements, admin
    case 'playAirSupply':
    case 'playReplacement':
      return 2;
    case 'repairBridge':
      return s === 'german' ? 1.5 : null;
    case 'blowBridges':
      return s === 'allied' ? 1.5 : null;
    case 'placeArrival':
      return a.args[2] == null ? 2 : null;
    case 'playGreifBridge': {
      // a bridge on the line of advance: one end ours, the other not
      if (!ops(g, s, st, 'greif')) return null;
      const [x, y] = [a.args[1] as number, a.args[2] as number];
      return (g.control[x] === s) !== (g.control[y] === s) && Math.min(dist.get(x) ?? 99, dist.get(y) ?? 99) <= 2 ? 1.5 : null;
    }
    case 'playInterdict': {
      // the strongest enemy block near our front
      if (!ops(g, s, st, 'greif')) return null;
      const u = unit(a.args[1]);
      return u.area != null &&
        E.neighbors(u.area)
          .concat(u.area)
          .some((n) => fighting(g, n, s).length)
        ? 1 + steps([u]) / 4
        : null;
    }
    case 'qualityReplacement': {
      if (!ops(g, s, st, 'quality')) return null;
      const u = unit(a.args[0]);
      return u.cls === 'armor' && u.max >= 3 && u.str < u.max ? 1.2 : null;
    }
    case 'activateBreakthrough': {
      if (!ops(g, s, st, 'breakthrough')) return null;
      const u = unit(a.args[0]);
      return u.str >= 2 && !E.contested(g, u.area!) && (dist.get(u.area!) ?? 99) <= 3 ? 1.5 : null;
    }
    case 'placeTaskForce':
      return 1 + worth(a.args[1] as number, s);
    // movement
    case 'setReserve': {
      const u = unit(a.args[0]);
      if (!a.args[1] || u.area == null) return null;
      if (ops(g, s, st, 'reserve'))
        return stuck.has(u.id) && !orders.has(u.id) && !enemyNear(g, u.area, s) && !E.contested(g, u.area) ? 3 : null; // a block with nowhere useful to go waits as a reserve: strategic move or breakthrough later
      return g.units.filter((x) => x.side === s && x.reserve).length < st.reserves &&
        !enemyNear(g, u.area, s) &&
        !E.contested(g, u.area) &&
        (dist.get(u.area) ?? 99) > 2
        ? 4
        : null;
    }
    case 'move':
    case 'stratMove': {
      const u = unit(a.args[0]),
        to = a.args[1] as number,
        from = u.area!,
        order = orders.get(u.id);
      if (order != null) return order === to ? 6 + u.str / 10 : null; // an ordered block goes to its objective, nowhere else
      if (E.contested(g, from) && odds(g, from, s) < st.attackOdds) return null; // do not leave a fight we may lose
      if (st.hold && worth(from, s) > 0 && g.control[from] === s && enemyNear(g, from, s) && fighting(g, from, s).length <= 1) return null; // hold the objective
      if (fighting(g, to, E.other(s)).length && odds(g, to, s, u.str) < st.attackOdds) return null; // no attack against bad odds
      const gain = (dist.get(from) ?? 99) - (dist.get(to) ?? 99);
      return gain > 0 ? gain + u.str / 10 : null;
    }
  }
  return null; // everything else: the doctrine leaves it alone
}

export function doctrinePlayer(st: Style = DEFAULT_STYLE): Player {
  let ordersKey = '',
    orders: Orders = new Map();
  return (view, side) => {
    if (view.moving && view.moving.id) {
      const u = view.units.find((x) => x.id === view.moving!.id);
      if (u?.side === side) return { side, fn: 'endMove', args: [] };
    } // a move goes straight to its goal
    const dist = distances(view, targets(view, side, st));
    const cands = candidates(view, side),
      key = `${view.turn} ${view.phasing} ${view.phase}`;
    if (key !== ordersKey && ['movement', 'btMove'].includes(view.phase) && view.phasing === side && attacker(view, side, st)) {
      ordersKey = key;
      orders = makeOrders(view, side, cands, st.assets, st.attackOdds);
    } // once per phase, so the groups stay together
    if (key !== ordersKey) orders = new Map();
    const scored = cands.map((a) => ({ a, v: score(view, side, a, dist, st, orders) }));
    const going = new Set(scored.filter((x) => x.a.fn === 'move' && x.v != null && x.v > 0).map((x) => x.a.args[0] as string));
    const stuck = new Set(view.units.filter((u) => u.side === side && u.area != null && !going.has(u.id)).map((u) => u.id)); // blocks with no useful move: worth a reserve marker
    const ranked = scored
      .map(({ a, v }) => ({ a, v: a.fn === 'setReserve' ? score(view, side, a, dist, st, orders, stuck) : v }))
      .filter((x) => x.v != null)
      .sort((x, y) => y.v! - x.v!);
    for (const { a } of ranked) if (isLegal(view, a)) return a;
    return null;
  };
}
