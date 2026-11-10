// The doctrine player: a short list of plain rules, a yardstick for the real computer player (stage 3 of
// docs/COMPUTER-PLAYER-PLAN.md). Attack where the odds are good, march on the objectives, hold the objectives
// under threat, keep a reserve. It reads only its seat's view; hidden enemy blocks count as average blocks.
import * as E from '../../engine/src';
import type { Game, Side, Unit } from '../../engine/src';
import { candidates, isLegal, type Action } from './actions';
import type { Player } from './random';

const HIDDEN_STEPS = 2.5;          // a hidden enemy block, on average
const ATTACK_ODDS = 1.3;           // our steps against theirs, terrain included, to start or join a fight
const ASSETS_PER_BATTLE = 2;
const RESERVES = 2;

const steps = (us: Unit[]) => us.reduce((t, u) => t + (u.garrison ? 1 : E.isPlaceholder(u) ? HIDDEN_STEPS : u.str), 0);
const fighting = (g: Game, a: number, s: Side) => E.unitsIn(g, a, s).filter((u) => !u.ghost);
/** Our steps against theirs in an area, the defender helped by the terrain. */
const odds = (g: Game, a: number, s: Side, extra = 0) => {
  const ours = steps(fighting(g, a, s)) + extra, theirs = steps(fighting(g, a, E.other(s)));
  return theirs ? ours / (theirs * (1 + 0.25 * E.areas.get(a)!.tdn)) : Infinity;
};
const enemyNear = (g: Game, a: number, s: Side) => E.neighbors(a).some((n) => fighting(g, n, E.other(s)).length > 0);
const worth = (a: number, s: Side) => { const v = E.areas.get(a)!.vp; return (v.mutual ? 1 : 0) + (s === 'german' ? v.german : v.allied); };

/** The areas the side marches on: objectives to take, and objectives it holds that the enemy threatens. */
function targets(g: Game, s: Side): number[] {
  const all = [...E.areas.keys()].filter((a) => !g.inPlay || g.inPlay.includes(a));
  const take = all.filter((a) => worth(a, s) > 0 && g.control[a] !== s);
  const keep = all.filter((a) => worth(a, E.other(s)) > 0 && g.control[a] === s && enemyNear(g, a, s) && fighting(g, a, s).length < 2);
  return [...take, ...keep];
}
/** Steps from every area to the nearest target (breadth-first over the map). */
function distances(g: Game, from: number[]): Map<number, number> {
  const d = new Map(from.map((a) => [a, 0])), q = [...from];
  for (let i = 0; i < q.length; i++) for (const n of E.neighbors(q[i])) if (!d.has(n) && (!g.inPlay || g.inPlay.includes(n))) { d.set(n, d.get(q[i])! + 1); q.push(n); }
  return d;
}

/** How good one action is for the doctrine; null: never do it. Higher is better; ending the phase scores 0. */
function score(g: Game, s: Side, a: Action, dist: Map<number, number>): number | null {
  const unit = (id: unknown) => g.units.find((u) => u.id === id)!, b = g.battle;
  switch (a.fn) {
    case 'endPhase': case 'setDone': case 'endMove': return 0;
    // waiting decisions
    case 'resolveBlow': return a.args[0] ? 1 : 0.5;
    case 'recoverAsset': return a.args[1] == null ? 0.1 : E.isArty(E.chit(g, a.args[1] as string)) ? 2 : 1;
    case 'chooseArtyLoss': case 'chooseRetreat': case 'closeBattle': case 'roll_step': return 1;
    // battles
    case 'passSA': return 1;
    case 'assign': return b && (b.assets[s]?.length ?? 0) < ASSETS_PER_BATTLE && (s !== b.attacker || odds(g, b.area, s) >= 1) && a.args[2] !== 'support' ? 2 : null;
    case 'setReady': return 1;
    case 'autoLosses': return 1;
    case 'chooseFirstLoss': return a.args[1] === b?.attPoint ? 1 : null;
    case 'attackerChoice': return (a.args[1] as boolean) === (b != null && odds(g, b.area, s) < 1) ? 1 : 0.5;     // abort only when outmatched
    case 'defenderChoice': return (a.args[1] as boolean) === (b?.pendingKind === 'arty' || (b != null && steps(fighting(g, b.area, s)) <= b.pending && worth(b.area, s) === 0)) ? 1 : 0.5;
    case 'declineExploit': return 0.5;
    case 'startBattle': {
      const area = a.args[0] as number;
      if (E.mustFight(g).includes(area)) return 5;
      if (a.args[1] && g.phase === 'btCombat' && !E.newlyContested(g).includes(area)) return null;      // no Special Action spent on it
      return odds(g, area, s) >= ATTACK_ODDS ? 3 : null;
    }
    // supply, reinforcements, admin
    case 'playAirSupply': case 'playReplacement': return 2;
    case 'repairBridge': return s === 'german' ? 1.5 : null;
    case 'blowBridges': return s === 'allied' ? 1.5 : null;
    case 'placeArrival': return a.args[2] == null ? 2 : null;
    case 'placeTaskForce': return 1 + worth(a.args[1] as number, E.other(s));
    // movement
    case 'setReserve': {
      const u = unit(a.args[0]); if (!a.args[1] || u.area == null) return null;
      return g.units.filter((x) => x.side === s && x.reserve).length < RESERVES && !enemyNear(g, u.area, s) && !E.contested(g, u.area) && (dist.get(u.area) ?? 99) > 2 ? 4 : null;
    }
    case 'move': case 'stratMove': {
      const u = unit(a.args[0]), to = a.args[1] as number, from = u.area!;
      if (E.contested(g, from) && odds(g, from, s) < ATTACK_ODDS) return null;                         // do not leave a fight we may lose
      if (worth(from, E.other(s)) > 0 && g.control[from] === s && enemyNear(g, from, s) && fighting(g, from, s).length <= 1) return null;   // hold the objective
      if (fighting(g, to, E.other(s)).length && odds(g, to, s, u.str) < ATTACK_ODDS) return null;        // no attack against bad odds
      const gain = (dist.get(from) ?? 99) - (dist.get(to) ?? 99);
      return gain > 0 ? gain + u.str / 10 : null;
    }
  }
  return null;                                                                                          // everything else: the doctrine leaves it alone
}

export function doctrinePlayer(): Player {
  return (view, side) => {
    if (view.moving && view.moving.id) { const u = view.units.find((x) => x.id === view.moving!.id); if (u?.side === side) return { side, fn: 'endMove', args: [] }; }   // a move goes straight to its goal
    const dist = distances(view, targets(view, side));
    const ranked = candidates(view, side).map((a) => ({ a, v: score(view, side, a, dist) })).filter((x) => x.v != null).sort((x, y) => y.v! - x.v!);
    for (const { a } of ranked) if (isLegal(view, a)) return a;
    return null;
  };
}
