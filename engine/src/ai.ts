/** 4.4 The computer opponent: a player for one side of any volume, built on the engine's own option functions (so every action it takes
 *  is legal) and an evaluation of the position. It is honest: it thinks on a copy of the game where every enemy block it may not see (6.24) is the average hidden block (`mask`).
 *  One call of `next` gives ONE action (so the table can show them one by one); `play` runs them until the side has nothing left to do.
 *  An action is data (`op`: a name and its arguments, run with `apply`), so it can come back from a worker thread.
 *  Three levels: easy (the plain player, with some noise and no assets), normal (the plain player: it holds and takes objective areas,
 *  attacks where the dice favour it, spends assets and replacements where they do most), and hard (the same choices, but each important
 *  one is tried on copies of the game: an attack is fought out many times with the real rules and dice before it is made, a loss, a
 *  retreat or an abort is chosen by what the position reads like after it, and a move is judged by the whole position it leaves). */
import { areas, neighbors, connection, setPlayArea } from './map';
import { isArty, isBattleAsset, isAsset, type Chit, type Side } from './chits';
import { hitProb } from './dice';
import type { Quality } from './combat';
import * as E from './game';
import type { Game, Unit, Battle } from './game';
import * as G from './vol/golan';
import * as S from './vol/sicily';
import { CUR } from './volumes';

export type Level = 'easy' | 'normal' | 'hard';
/** One action, as data: `op` names an entry of `OPS` and its arguments; `run` applies it. */
export type Op = [string, ...unknown[]];
/** One area toward `to` by the cheapest way from where the block stands, as a player's step move (2.4 control, 5.34, fuel once).
 *  Returns true while the block has more steps to go; at the end its move is closed. */
export function walkStep(g: Game, id: string, to: number): boolean {
  if (E.actorOf(g) !== 'both' && E.actorOf(g) !== g.units.find((x) => x.id === id)!.side) { E.endMove(g); return false; }   // the other side must act first (Golan 15.2): the block stops here
  const opts = E.moveOptions(g, id), o = opts.find((x) => x.area === to); if (!o) { E.endMove(g); return false; }
  const next = o.path.slice(1).find((a) => opts.some((x) => x.area === a))!;                         // a full friendly area is passed through, not stopped in (5.1)
  const r = E.move(g, id, next, true);
  if (r !== 'moved' || g.moving?.id !== id || next === to) { if (g.moving?.id === id) E.endMove(g); return false; }
  return true;
}
/** The computer's move, one area at a time. */
export function walk(g: Game, id: string, to: number) { for (let i = 0; i < 20 && walkStep(g, id, to); i++); }
export interface Action { label: string; unit?: string; area?: number; chit?: string; roll?: boolean; op: Op; run: (g: Game) => void }
type Est = { str: number; q: Quality; cls: 'armor' | 'infantry' };
const QW: Record<Quality, number> = { green: 0.8, veteran: 1, elite: 1.25 };
/** How many times a hard player fights a battle out before deciding (more: steadier, slower). */
export const SIMS = { attack: 48, choice: 24, turn: 4 };
/** How long (ms, on the clock) the hard player may think about one action before it settles for fewer play-outs (at least `SIMS.min` each), so a
 *  slow phone gets a quick, slightly shallower move rather than minutes of waiting. Infinity in the arena, to measure the full strength. */
export const BUDGET = { ms: 3000, min: 3 };
let deadline = Infinity;
const late = (i: number, min = BUDGET.min) => i >= min && performance.now() > deadline;
/** Tuning numbers the arena changes (ARENA_TUNE), and whether the hard player plans its attacks first. */
export const TUNE = { plan: true, planAt: 0.3, sd: true, asym: 0.4, vpBase: 6, tw1: 0.5, tw2: 1.5, ownCut: null as number | null, expose: 0.35, turn: true, horizon: 2 };

/* ================= actions as data ================= */
type OpFn = (g: Game, ...args: never[]) => unknown;
const OPS: Record<string, OpFn> = {
  endPhase: (g) => E.endPhase(g), setDone: (g, side: Side) => E.setDone(g, side), resolveBlow: (g, yes: boolean) => E.resolveBlow(g, yes),
  recoverAsset: (g, side: Side, id: string | null) => E.recoverAsset(g, side, id), chooseArtyLoss: (g, id: string) => E.chooseArtyLoss(g, id),
  pickRelease: (g, ids: string[]) => G.pickRelease(g, ids), placeReleased: (g, id: string, a: number) => G.placeReleased(g, id, a), fireSam: (g, id: string) => G.fireSam(g, id), declineSam: (g) => G.declineSam(g), answerJamming: (g, id: string | null) => G.answerJamming(g, g.battle!, id ?? undefined), pickMoraleLoss: (g, side: Side, id: string) => S.pickMoraleLoss(g, side, id), autoMoraleLoss: (g) => S.autoMoraleLoss(g),
  autoStrongpoints: (g) => G.autoStrongpoints(g, 'historical'), golanDeploy: (g, u: string, a: number) => G.deploy(g, u, a), autoMinefields: (g) => G.autoMinefields(g), autoReserves: (g, side: Side) => G.autoReserves(g, side),
  alowdaRaid: (g, c: string, a: number) => G.alowdaRaid(g, c, a), autoGarrisons: (g) => S.autoGarrisons(g), choosePlan: (g, br: string, us?: string) => S.choosePlan(g, 'historical', br, us), sicilyDeploy: (g, u: string, a: number) => S.deploy(g, u, a),
  placeTaskForce: (g, id: string, a: number) => E.placeTaskForce(g, id, a), placeArrival: (g, id: string, a: number) => E.placeArrival(g, id, a),
  playReplacement: (g, c: string, u: string) => (CUR.id === 'golan73' ? G.playReplacement(g, c, u) : E.playReplacement(g, c, u)), playRebuild: (g, c: string, u: string, a: number) => E.playRebuild(g, c, u, a),
  staffReplacement: (g, c: string, u: string) => E.staffReplacement(g, c, u), fieldWorksFor: (g, c: string, a: number) => (CUR.id === 'golan73' ? G.engineerFieldWorks(g, c, a) : E.fieldWorksFor(g, c, a)),
  portWork: (g, c: string, p: string) => S.portWork(g, c, p), bridgeDitch: (g, c: string, a: number, n: number) => G.bridgeDitch(g, c, a, n), removeMinefield: (g, c: string, a: number, n: number) => G.removeMinefield(g, c, a, n),
  rally: (g, side: Side, a: number, c: string) => E.rally(g, side, a, c), qualityReplacement: (g, u: string, c: string) => E.qualityReplacement(g, u, c), releaseUnit: (g, c: string, a: 4 | 6) => E.releaseUnit(g, c, a),
  playRelease: (g, c: string) => G.playRelease(g, c), arrivingBattalion: (g, c: string, ch: Parameters<typeof G.playArrivingBattalion>[2]) => G.playArrivingBattalion(g, c, ch), playArmyRelease: (g, c: string) => S.playArmyRelease(g, c),
  playSSM: (g, c: string) => G.playSSM(g, c), playLtZvika: (g, c: string, a: number) => G.playLtZvika(g, c, a), airInterdiction: (g, c: string, a: number) => G.airInterdiction(g, c, a),
  releaseDivision: (g, d: string, sa: string) => S.releaseDivision(g, d, sa), releaseOperationalReserve: (g, sa: string) => G.releaseOperationalReserve(g, sa), releaseGolani: (g, sa: string) => G.releaseGolani(g, sa), freeThe33rd: (g, sa: string) => G.freeThe33rd(g, sa),
  repairBridge: (g, c: string, a: number, to: number) => E.repairBridge(g, c, a, to), greifBridge: (g, c: string, a: number, b: number) => E.playGreifBridge(g, c, a, b), interdict: (g, c: string, u: string) => E.playInterdict(g, c, u),
  bodenplatte: (g, c: string) => E.playBodenplatte(g, c), heydteDrop: (g, c: string, a: 31 | 52) => E.heydteDrop(g, c, a), staffReserve: (g, c: string, u: string) => E.staffReserve(g, c, u), activateBreakthrough: (g, u: string) => E.activateBreakthrough(g, u),
  blowBridges: (g, c: string, a: number, t: number) => E.blowBridges(g, c, a, [t]), roadblock: (g, c: string, a: number, d: boolean) => E.roadblock(g, c, a, d), staffBoundary: (g, c: string, u: string) => E.staffBoundary(g, c, u),
  staffPool: (g, c: string, a: number) => E.staffPool(g, c, a), staffIntel: (g, c: string, u: string) => E.staffIntel(g, c, u), interdiction: (g, c: string, a: number) => E.playInterdiction(g, c, a), alternateUse: (g, c: string) => E.alternateUse(g, c),
  buildFieldWorks: (g, u: string) => { const had = !!g.units.find((x) => x.id === u)?.interdict; try { E.buildFieldWorks(g, u); } catch (e) { if (!had) throw e; } },   /* a failed Greif interdict check (17.11) is an outcome */ retreatSA: (g) => E.defenderRetreatSA(g, g.battle!), reinforceSA: (g, u: string) => E.defenderReinforceSA(g, g.battle!, u),
  move: (g, u: string, a: number) => walk(g, u, a), setReserve: (g, u: string) => { const had = !!g.units.find((x) => x.id === u)?.interdict; try { E.setReserve(g, u, true); } catch (e) { if (!had) throw e; } },   /* a failed Greif interdict check (17.11) is an outcome, not an illegal action */ setPeiperFull: (g, u: string) => E.setPeiperFull(g, u, true), stratMove: (g, u: string, a: number) => E.stratMove(g, u, a),
  airDrop: (g, u: string, a: number | null) => S.airDrop(g, u, a), startBattle: (g, a: number, viaSA: boolean) => E.startBattle(g, a, viaSA),
  assign: (g, c: string, mode?: 'arty' | 'support', engFw?: boolean) => { E.assign(g, g.battle!, c, mode); if (engFw) E.setEngFw(g, g.battle!, true); },
  passSA: (g) => E.passSA(g, g.battle!), setPoint: (g, side: Side, u: string) => E.setPoint(g, g.battle!, side, u), setReady: (g, side: Side) => E.setReady(g, g.battle!, side), closeBattle: (g) => E.closeBattle(g),
  chooseLoss: (g, k: string) => E.chooseLoss(g, g.battle!, k), chooseFirstLoss: (g, k: string) => E.chooseFirstLoss(g, g.battle!, k), attackerChoice: (g, abort: boolean) => E.attackerChoice(g, g.battle!, abort),
  defenderChoice: (g, use: boolean) => E.defenderChoice(g, g.battle!, use), chooseRetreat: (g, a: number) => E.chooseRetreat(g, g.battle!, a), roll: (g) => E.roll_step(g, g.battle!),
  airSupply: (g, c: string, a: number) => (CUR.id === 'bulge' ? E.playAirSupply(g, c, a) : S.airSupply(g, c, a)), rollSupply: (g) => E.rollSupply(g),
};
/** Run an action's `op` on a game (the table applies what the worker chose). */
export function apply(g: Game, op: Op) { E.useGame(g.game ?? 'bulge'); setPlayArea(g.inPlay); const f = OPS[op[0]]; if (!f) throw new Error(`unknown action ${op[0]}`); return f(g, ...(op.slice(1) as never[])); }
const act = (label: string, op: Op, x: Partial<Action> = {}): Action => ({ label, op, ...x, run: (g) => { apply(g, op); } });

/* ================= what the side knows ================= */
/** A block as this side sees it: its own and face-up blocks as they are; a hidden enemy block as the average of the enemy blocks hidden on the map
 *  at full strength (what the printed order of battle tells a player: their current steps are what is hidden). */
const est = (g: Game, u: Unit, side: Side): Est => (E.visibleTo(g, u, side) ? { str: u.str, q: E.quality(u), cls: u.cls } : hiddenAvg(g, u.side, side));
let hidKey = '', hidVal: Est = { str: 2, q: 'veteran', cls: 'infantry' };
const QL: Quality[] = ['green', 'veteran', 'elite'];
function hiddenAvg(g: Game, foe: Side, side: Side): Est {
  const key = `${g.game}|${g.seed}|${foe}|${side}|${g.turn}|${g.log.length}|${g.units.filter((u) => u.side === foe && u.area != null).length}`; if (key === hidKey) return hidVal; hidKey = key;
  const hs = g.units.filter((u) => u.side === foe && u.area != null && !u.garrison && !E.visibleTo(g, u, side));
  if (!hs.length) return (hidVal = { str: 2, q: 'veteran', cls: 'infantry' });
  const str = hs.reduce((t, u) => t + u.max, 0) / hs.length, ql = hs.reduce((t, u) => t + QL.indexOf(u.q[u.max - 1] ?? 'veteran'), 0) / hs.length, arm = hs.filter((u) => u.cls === 'armor').length / hs.length;
  return (hidVal = { str: Math.round(str * 2) / 2, q: QL[Math.round(ql)] ?? 'veteran', cls: arm > 0.5 ? 'armor' : 'infantry' });
}
/** Fighting value of a block (steps × quality, armour a little more, disorder and no supply a lot less). */
function val(g: Game, u: Unit, side: Side): number {
  const e = est(g, u, side); let v = e.str * QW[e.q] * (e.cls === 'armor' ? 1.15 : 1);
  if (u.garrison) v *= 0.5; if (u.fort) v *= 0.8;
  if (u.disorder) v *= u.disorder === 1 ? 0.6 : 0.85; if (u.unsupplied) v *= 0.6;
  return v;
}
const power = (g: Game, a: number, side: Side, viewer: Side) => E.unitsIn(g, a, side).reduce((t, u) => t + val(g, u, viewer), 0);
const near = (g: Game, a: number, side: Side, viewer: Side) => neighbors(a).reduce((t, n) => t + power(g, n, side, viewer), 0);
/** What an area is worth to `side`: its own points, the enemy's points it denies, and a point for contested objectives. */
function worth(g: Game, a: number, side: Side): number {
  const A = areas.get(a); if (!A) return 0; const vp = A.vp as unknown as Record<string, number | boolean>;
  return ((vp[side] as number) || 0) + ((vp[E.other(side)] as number) || 0) * 0.8 + (vp.mutual ? 1 : 0) + (A.supply ? 0.5 : 0) + (CUR.sources(g, side).has(a) ? 0.8 : 0);
}
const inPlay = (g: Game, a: number) => (!g.inPlay || g.inPlay.includes(a)) && !isBox(a);
const isBox = (a: number) => (CUR.id === 'sicily' ? S.isBox(a) : CUR.id === 'golan73' ? G.isAssembly(a) : false);
/** The friendly objective areas the enemy next to them outweighs: what they lack. */
function need(g: Game, a: number, side: Side): number {
  const w = worth(g, a, side); if (!w || g.control[a] !== side) return 0;
  const en = near(g, a, E.other(side), side); if (!en) return 0;
  const own = power(g, a, side, side);
  return (w * Math.max(0, en - own)) / (en + 1);
}
/** What `side` stands to lose in `a` (its own area, enemy next to it): the hits the enemy blocks around it would deal attacking, against the hits its
 *  defenders deal back, weighed by what the area is worth. Nothing when the area is empty of enemies' reach or well held. */
function threat(g: Game, a: number, side: Side): number {
  const w = worth(g, a, side); if (g.control[a] !== side) return 0;
  const foe = E.other(side), att = neighbors(a).flatMap((n) => E.unitsIn(g, n, foe)).filter((u) => regular(u) && !u.disorder); if (!att.length) return 0;
  const mine = E.unitsIn(g, a, side).filter((u) => !u.ghost), fw = g.fieldWorks.includes(a) && (g.fwOwner[a] ?? side) === side;
  const myPoint: Est = mine.length ? pointOf(g, a, side, side) : { str: 1, q: 'green', cls: 'infantry' }, theirPoint = pointOf(g, att[0].area!, foe, side);
  let theirs = 0, m = 0;
  for (const u of att.slice(0, 4)) theirs += expHits(g, a, u, foe, true, myPoint, fw);
  for (const u of mine) m += expHits(g, a, u, side, false, theirPoint, false);
  if (!mine.length) return (w + 0.5) * Math.min(1, theirs) * 0.6;                                       // an empty objective in reach: likely to be taken
  return (w + 0.5) * Math.max(0, theirs - m * 0.8);
}
/** What `side` could take in `a` (an enemy area next to its blocks) by the same measure: a favourable attack in reach. */
function chance(g: Game, a: number, side: Side): number {
  const foe = E.other(side); if (g.control[a] !== foe || !E.unitsIn(g, a, foe).length) return 0;
  const w = worth(g, a, side), att = neighbors(a).flatMap((n) => E.unitsIn(g, n, side)).filter((u) => regular(u) && !u.disorder && !u.unsupplied); if (!att.length) return 0;
  const theirPoint = pointOf(g, a, foe, side), myPoint = pointOf(g, att[0].area!, side, side), fwFoe = g.fieldWorks.includes(a) && (g.fwOwner[a] ?? foe) === foe;
  let m = 0, t = 0;
  for (const u of att.slice(0, 2)) m += expHits(g, a, u, side, true, theirPoint, fwFoe);
  for (const u of E.unitsIn(g, a, foe).filter((u) => !u.ghost)) t += expHits(g, a, u, foe, false, myPoint, false);
  return (w + 0.5) * Math.max(0, Math.min(2, m - t));
}
/** An enemy objective `side` is fighting in: partly as good as held (the fight goes on next turn), by its share of the strength there. */
function pressure(g: Game, a: number, side: Side): number {
  const foe = E.other(side); if (g.control[a] !== foe || !E.contested(g, a)) return 0;
  const A = areas.get(a)!, vp = A.vp as unknown as Record<string, number | boolean>, w = ((vp[side] as number) || 0) + ((vp[foe] as number) || 0) + (vp.mutual ? 1 : 0); if (!w) return 0;
  const m = power(g, a, side, side), t = power(g, a, foe, side);
  return w * 0.45 * (m / (m + t + 0.1));
}
/** What a victory point is worth in steps: more as the game nears its end (and its sudden-death checks), when nothing else will count. */
const vpWeight = (g: Game) => TUNE.vpBase + 3 * Math.max(0, Math.min(1, (g.turn - (g.lastTurn - 4)) / 3));
/** The whole position for `side`, in steps-worth: own and enemy strength, objectives (the victory function), threatened objectives, assets in hand,
 *  enemy blocks cut off from supply, and (for the side that has to take ground) how close its blocks stand to the objectives still to take. */
export function evaluate(g: Game, side: Side): number { return evaluateParts(g, side).total; }
/** The evaluation by its parts (for tuning). */
export function evaluateParts(g: Game, side: Side) {
  const foe = E.other(side); const p = { units: 0, vp: 0, sd: 0, threat: 0, chance: 0, pressure: 0, chits: 0, cutoff: 0, approach: 0, exposed: 0, total: 0 };
  const first = E.sidesOf(g)[0] === side, tw = first ? TUNE.tw1 : TUNE.tw2, ownW = first ? 1 - TUNE.asym * (TUNE.ownCut ?? (CUR.id === 'golan73' ? 0 : 1)) : 1, foeW = first ? 1 + TUNE.asym : 1;      // Golan: the Syrian pays for every lost block in victory points, so its own steps keep their full worth      // the side that must take ground may count the enemy's steps for more than its own
  for (const u of g.units) if (u.area != null) p.units += u.side === side ? ownW * val(g, u, side) : -foeW * val(g, u, side);
  const v = E.victory(g), net = v[side] - v[foe]; p.vp = net * vpWeight(g);
  { const sd = g.inPlay || !TUNE.sd ? null : (g.track ?? CUR.track)[g.turn - 1]?.sd; if (sd) { const [me, them] = E.sidesOf(g)[0] === side ? sd : [sd[1], sd[0]];        // the Victory Check at the end of this turn: over the line wins the game, a point short is nothing yet
    p.sd = (net >= me ? 12 : 4 * Math.max(0, 1 - (me - net) / 3)) - (-net >= them ? 12 : 4 * Math.max(0, 1 - (them + net) / 3)); } }
  for (const a of areas.keys()) if (inPlay(g, a)) { p.threat -= threat(g, a, side) * tw; p.chance += chance(g, a, side) * 0.5; p.pressure += pressure(g, a, side) * vpWeight(g); }
  for (const c of g.chits) if (c.side === side && c.box === 'available') p.chits += c.kind === 'sa_block' ? 0.8 : c.kind === 'special_action_event' ? 0.5 : isAsset(c) ? 0.1 : 0.2;
  const held = new Set(g.units.filter((u) => u.side === foe && u.area != null && !u.garrison).map((u) => u.area!));
  for (const a of held) if (inPlay(g, a) && !E.inSupply(g, foe, a)) p.cutoff += 0.35 * steps(g, a, foe, side);          // cut off: weaker next Supply Phase
  if (first) { const obj = enemyObjective(g, side); for (const u of own(g, side)) if (regular(u)) p.approach -= 0.2 * (isBox(u.area!) ? 6 : Math.min(5, dist(g, u.area!, obj))); }      // still in a landing or assembly box: farthest of all
  if (CUR.id === 'bulge' && TUNE.expose) {
    for (const a of enemyReach(g, foe)) if (g.control[a] === side && !E.unitsIn(g, a, side).length) p.exposed -= TUNE.expose * vpWorth(a, side) * vpWeight(g);   // an empty objective the enemy can drive into next turn (2.4: passing takes it)
  }
  p.total = p.units + p.vp + p.sd + p.threat + p.chance + p.pressure + p.chits + p.cutoff + p.approach + p.exposed;
  return p;
}

/* ================= helpers ================= */
/** The victory points an area means to `side` if the enemy takes it: the enemy's own points there, and a shared objective counts both ways. */
const vpWorth = (a: number, side: Side) => { const vp = areas.get(a)!.vp as unknown as Record<string, number | boolean>; return ((vp[E.other(side)] as number) || 0) + (vp.mutual ? 2 : 0); };
/** The areas `foe`'s blocks could enter or pass through on their next move (The Bulge's MP and costs, roughly: not past `side`'s blocks, no blown bridges,
 *  no armour over the restricted boundary). An empty area on such a path changes hands (2.4). */
function enemyReach(g: Game, foe: Side): Set<number> {
  const side = E.other(foe), out = new Set<number>();
  for (const u of g.units) {
    if (u.side !== foe || u.area == null || !regular(u) || u.disorder || u.unsupplied) continue;
    const allow = u.cls === 'armor' ? 6 : 3, cost = new Map([[u.area, 0]]), todo = [u.area];
    while (todo.length) {
      const a = todo.shift()!, c0 = cost.get(a)!;
      if (a !== u.area && E.unitsIn(g, a, side).length) continue;                                    // entering an occupied area ends the move
      for (const n of neighbors(a)) {
        const c = connection(a, n)!; if ((c.restricted && u.cls === 'armor') || (c.river && g.blown.includes(E.keyOf(a, n)))) continue;
        const k = c0 + c.mp + (E.unitsIn(g, n).length ? 1 : 0); if (k > allow || (cost.get(n) ?? 99) <= k) continue;
        cost.set(n, k); out.add(n); todo.push(n);
      }
    }
  }
  return out;
}
const own = (g: Game, side: Side) => g.units.filter((u) => u.side === side && u.area != null);
const regular = (u: Unit) => !u.garrison && !u.fort && !u.ghost;
const avail = (g: Game, side: Side) => E.boxOf(g, side, 'available');
const best = <T,>(xs: T[], score: (x: T) => number): { x: T; s: number } | null => { let out: { x: T; s: number } | null = null; for (const x of xs) { const s = score(x); if (!out || s > out.s) out = { x, s }; } return out; };
/** Expected hits of one firing group (unit or asset) against a point block, by the volume's own table. */
function expHits(g: Game, a: number, shooter: Unit | null, side: Side, attacker: boolean, target: Est, fw: boolean, assetKind?: 'artillery' | 'battle'): number {
  const tdn = areas.get(a)!.tdn, setting = { attacker, tdn, riverAssault: attacker && g.riverAssault.includes(a), advArty: g.opts.advArty, night: CUR.isNight?.(g) };
  const tgt = { pointCls: target.cls, pointQuality: target.q, fieldWorks: attacker && fw, riverAssaultMarker: !attacker && g.riverAssault.includes(a) };
  if (!shooter) { const r = CUR.successNumber({ side, kind: assetKind === 'artillery' ? 'artillery' : 'battle', cls: 'infantry', quality: assetKind === 'battle' ? 'veteran' : undefined, dice: 1 }, tgt, setting); return hitProb(r.sn); }
  const e = est(g, shooter, side), r = CUR.successNumber({ side, kind: shooter.garrison ? 'battle' : 'unit', cls: e.cls, quality: e.q, dice: e.str, disordered: shooter.disorder > 0, unsupplied: shooter.unsupplied, strongpoint: shooter.fort }, tgt, setting);
  return (shooter.fort ? 1 : e.str) * hitProb(r.sn);
}
/** The point block the enemy would present (its strongest, as this side sees it). */
function pointOf(g: Game, a: number, side: Side, viewer: Side): Est {
  const us = E.unitsIn(g, a, side).filter((u) => !u.ghost); if (!us.length) return { str: 2, q: 'veteran', cls: 'infantry' };
  const b = best(us, (u) => est(g, u, viewer).str * (u.cls === 'armor' ? 1.5 : 1))!.x; return est(g, b, viewer);
}
/** A round of combat in `a` as `side` expects it: hits it deals and takes per round (artillery in hand counted once). */
function exchange(g: Game, a: number, side: Side, attacker: boolean, extra: Unit[] = []): { mine: number; theirs: number } {
  const foe = E.other(side), fwHere = g.fieldWorks.includes(a), fwFoe = fwHere && (g.fwOwner[a] ?? foe) === foe, fwMine = fwHere && g.fwOwner[a] === side;
  const mine = [...E.unitsIn(g, a, side).filter((u) => !u.ghost && !(attacker && u.disorder)), ...extra], theirs = E.unitsIn(g, a, foe).filter((u) => !u.ghost && !(!attacker && u.disorder));
  const myPoint: Est = mine.length ? pointOf(g, a, side, side) : { str: 2, q: 'veteran', cls: 'infantry' }, theirPoint = pointOf(g, a, foe, side);
  let m = 0, t = 0;
  for (const u of mine) m += expHits(g, a, u, side, attacker, theirPoint, fwFoe);
  for (const u of theirs) t += expHits(g, a, u, foe, !attacker, myPoint, fwMine);
  const arty = (s: Side) => avail(g, s).filter((c) => isArty(c) || (c.kind === 'air_mission' && CUR.id === 'bulge' && s === 'allied')).length;
  m += Math.min(attacker ? 2 : 1, arty(side)) * 0.7 * expHits(g, a, null, side, attacker, theirPoint, fwFoe, 'artillery');
  t += Math.min(attacker ? 1 : 2, arty(foe)) * 0.7 * expHits(g, a, null, foe, !attacker, myPoint, fwMine, 'artillery');
  return { mine: m, theirs: t };
}
const steps = (g: Game, a: number, side: Side, viewer: Side) => E.unitsIn(g, a, side).filter((u) => !u.ghost).reduce((t, u) => t + (u.fort ? 1 : est(g, u, viewer).str), 0);
/** Distance (areas) from `a` to the nearest area for which `ok` holds, up to 6. */
function dist(g: Game, a: number, ok: (x: number) => boolean, max = 6): number {
  const seen = new Set([a]); let ring = [a];
  for (let d = 0; d <= max && ring.length; d++) { if (ring.some(ok)) return d; const nx: number[] = []; for (const x of ring) for (const n of neighbors(x)) if (!seen.has(n) && inPlay(g, n)) { seen.add(n); nx.push(n); } ring = nx; }
  return max + 1;
}
/** How much risk the side runs: the First Player must take ground, and a side behind near the end has little to lose. */
function risk(g: Game, side: Side): number { const v = E.victory(g), behind = v[side] - v[E.other(side)] < 0; return (E.sidesOf(g)[0] === side ? 0.12 : 0) + (behind && g.turn >= g.lastTurn - 2 ? 0.15 : 0); }
const enemyObjective = (g: Game, side: Side) => (a: number) => g.control[a] === E.other(side) && worth(g, a, side) > 0;
const supplyFrom = (g: Game, side: Side, a: number) => E.inSupply(g, side, a) || neighbors(a).some((n) => g.control[n] === side && E.inSupply(g, side, n));
/** A little noise for the easy player, the same for the same position (so a repeated call gives the same action). */
function noise(g: Game, key: string, amount: number): number {
  if (!amount) return 0; let h = (g.seed ^ (g.rolls * 7919) ^ (g.log.length * 104729)) >>> 0;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  return ((h >>> 8) / 2 ** 24 - 0.5) * 2 * amount;
}

/* ================= simulation (the hard player's eyes) ================= */
/** Play the open battle (or the one `prep` opens) out to its end on copies of the game, every side's choices by the plain player, the dice from a
 *  different seed each time; the mean of what the position then reads like for `side`. */
function simulate(g: Game, side: Side, n: number, prep?: (x: Game) => void): number {
  const sides = E.sidesOf(g), src = E.randomSource(); E.setRandom(null);
  let total = 0, done = 0;
  try {
    for (let i = 0; i < n && !late(i); i++) {
      const x = structuredClone(g); x.seed = ((g.seed + 1) * 2654435761 + (i + 1) * 40503 + g.rolls * 97) % 1e9; x.rolls = 0;
      mask(x, side);
      try { prep?.(x); } catch { continue; }
      for (let k = 0; k < 120 && x.battle; k++) {
        let a: Action | null = null; for (const s of sides) { a = step(x, s, 'normal'); if (a) break; }
        if (!a) break; try { a.run(x); } catch { break; }
      }
      total += evaluate(x, side); done++;
    }
  } finally { E.setRandom(src); }
  return done ? total / done : -1e9;
}
/** The game as `side` may know it: every enemy block it cannot see becomes the average hidden block (no ghost, no strongpoint, no true strength). */
function mask(x: Game, side: Side) {
  const foe = E.other(side), e = hiddenAvg(x, foe, side);
  for (const u of x.units) if (u.side === foe && u.area != null && !u.garrison && !E.visibleTo(x, u, side)) {
    const n = Math.max(1, Math.round(e.str));
    Object.assign(u, { str: n, max: n, q: Array(n).fill(e.q), cls: e.cls, ghost: undefined, fort: undefined, name: 'Hidden block' });
  }
}
/** The best of several ways to go on in a battle, by simulation (hard) — or the given default. */
function pickSim<T>(g: Game, side: Side, level: Level, options: T[], fallback: T, apply: (x: Game, o: T) => void, n = SIMS.choice): T {
  if (level !== 'hard' || options.length < 2) return fallback;
  const b = best(options, (o) => simulate(g, side, n, (x) => apply(x, o)));
  return b && b.s > -1e8 ? b.x : fallback;
}

/* ================= the dispatcher ================= */
/** Does `side` have to act now? */
export function turnOf(g: Game, side: Side): boolean {
  if (g.over) return false;
  if (hasPending(g, side)) return true;
  const a = E.actorOf(g); if (a !== 'both') return a === side;
  const b = g.battle; if (b) return !b.ready?.includes(side);
  if (g.phase === 'deploy') return VOLDeployPending(g, side);
  return !g.done?.includes(side) || g.phasing === side;
}
const VOLDeployPending = (g: Game, side: Side) => g.units.some((u) => u.box === 'deploy' && u.side === side) || (CUR.id === 'golan73' && ((side === 'israeli' && !!G.state(g).minesLeft) || (G.setupReserves(g, side).all && G.reservesLeft(g, side) > 0) || (side === 'syrian' && G.alowdaRaidAreas(g).length > 0))) || (CUR.id === 'sicily' && side === 'allied' && !S.state(g).plan);
/** The next action of `side`, or null when it has nothing (more) to do now. In a step both sides work in, the side marks itself done (or, phasing, ends the step once the other is done). */
export function next(g: Game, side: Side, level: Level = 'normal'): Action | null {
  E.useGame(g.game ?? 'bulge'); setPlayArea(g.inPlay);
  if (g.over || !turnOf(g, side)) return null;
  const view = structuredClone(g); mask(view, side);                                                    // it thinks on what it may know: the enemy blocks it cannot see are stand-ins
  deadline = level === 'hard' ? performance.now() + BUDGET.ms : Infinity;
  try { return step(view, side, level); } finally { deadline = Infinity; }
}
function step(g: Game, side: Side, level: Level): Action | null {
  if (g.over || !turnOf(g, side)) return null;
  const p = pending(g, side); if (p) return p;
  const b = g.battle; if (b) return battle(g, b, side, level);
  switch (g.phase) {
    case 'deploy': return deploy(g, side);
    case 'reinforcement': return reinforce(g, side) ?? both(g, side);
    case 'admin': return admin(g, side, level) ?? both(g, side);
    case 'movement': case 'btMove': case 'reaction': return movement(g, side, level) ?? end(g, side);
    case 'strategic': return strategic(g, side, level) ?? end(g, side);
    case 'combat': case 'btCombat': return combat(g, side, level) ?? end(g, side);
    case 'supply': return supply(g, side) ?? end(g, side);
  }
  return null;
}
/** Every action of `side` until it has nothing left to do (the set-up is never ended here: the caller does). Returns the actions taken. */
export function play(g: Game, side: Side, level: Level = 'normal', max = 500): Action[] {
  const out: Action[] = [];
  for (let i = 0; i < max; i++) { const a = next(g, side, level); if (!a) break; a.run(g); out.push(a); }
  return out;
}
const end = (g: Game, side: Side): Action | null => (E.actorOf(g) === side || (E.actorOf(g) === 'both' && g.phasing === side) ? act('end', ['endPhase']) : null);
/** Admin and Reinforcement: the other side marks itself done; the Phasing Player ends the step once it is. */
function both(g: Game, side: Side): Action | null {
  if (g.phasing !== side) return g.done?.includes(side) ? null : act('done', ['setDone', side]);
  return g.done?.includes(E.other(side)) ? act('end', ['endPhase']) : null;
}

/* ================= choices the rules put to a side outside the sequence ================= */
const jammed = (g: Game, side: Side) => CUR.id === 'golan73' && !!g.battle && g.battle.stage === 'setup' && side !== g.battle.attacker && !!G.battleState(g.battle).ew?.pending;   // 17.33: the Defender rolls before anything else
const hasPending = (g: Game, side: Side) => jammed(g, side) || (CUR.id === 'golan73' && side === 'syrian' && !!G.state(g).release) || (!!g.pendingBlow && g.units.find((x) => x.id === g.pendingBlow!.unit)?.side !== side) || g.recover.includes(side) || (!!g.artyPick && side === 'german')
  || (CUR.id === 'golan73' && side === 'syrian' && !!G.state(g).samTarget) || (CUR.id === 'sicily' && !!S.state(g).moralePick?.[side]);
function pending(g: Game, side: Side): Action | null {
  if (g.pendingBlow) {
    const u = g.units.find((x) => x.id === g.pendingBlow!.unit)!; if (u.side === side) return null;
    const to = g.pendingBlow.path.at(-1)!, worthIt = g.control[to] === side && (E.unitsIn(g, to, side).length > 0 || worth(g, to, side) > 0);
    return act(worthIt ? 'blow the bridge' : 'let them cross', ['resolveBlow', worthIt], { area: to });
  }
  if (g.recover.includes(side)) {
    const pri = ['artillery', 'rocket_artillery', 'naval_support', 'engineer', 'armor_asset', 'air_mission', 'infantry_asset', 'commando', 'sam', 'task_force', 'command_staff', 'fuel'];
    const c = E.boxOf(g, side, 'used').filter(isAsset).sort((a, b) => pri.indexOf(a.kind) - pri.indexOf(b.kind))[0];
    return act('recover an asset', ['recoverAsset', side, c?.id ?? null], { chit: c?.id });
  }
  if (g.artyPick && side === 'german') { const c = E.boxOf(g, 'german', 'used').filter((x) => x.kind === 'artillery').sort((a, b) => (a.ech === 'de_sr' ? 1 : 0) - (b.ech === 'de_sr' ? 1 : 0))[0]; if (c) return act('artillery attrition', ['chooseArtyLoss', c.id], { chit: c.id }); }
  if (CUR.id === 'golan73' && side === 'syrian' && G.state(g).release) {                              // 15.2: the first two Strategic Reserve units, each on its first open Entry area
    const R = G.state(g).release!; if (R.pick) return act('release', ['pickRelease', G.releaseChoices(g).slice(0, 2).map((u) => u.id)]);
    const id = R.place[0]; return act('place released', ['placeReleased', id, G.releaseTargets(g, id)[0]], { unit: id });
  }
  if (jammed(g, side)) { const cm = avail(g, side).find((c) => c.kind === 'event_ew'); return act(cm ? 'EW countermeasures' : 'answer the jamming', ['answerJamming', cm?.id ?? null], { chit: cm?.id }); }
  if (CUR.id === 'golan73' && side === 'syrian' && G.state(g).samTarget) { const sam = avail(g, 'syrian').find((c) => c.kind === 'sam'); return sam ? act('SAM fires', ['fireSam', sam.id], { chit: sam.id }) : act('no SAM', ['declineSam']); }
  if (CUR.id === 'sicily') { const V = S.state(g); if (V.moralePick?.[side]) { const pool = g.chits.filter((c) => c.side === 'axis' && c.nation === 'italian' && c.box === 'available' && c.kind !== 'command_staff' && (isArty(c) || isBattleAsset(c))).sort((a, b) => +isArty(a) - +isArty(b)); return pool.length ? act('Italian morale', ['pickMoraleLoss', side, pool[0].id], { chit: pool[0].id }) : act('Italian morale', ['autoMoraleLoss']); } }
  return null;
}

/* ================= set-up ================= */
function deploy(g: Game, side: Side): Action | null {
  if (CUR.id === 'golan73') {
    if (side === 'israeli' && g.units.some((u) => u.box === 'deploy' && u.side === side && (u.fort || u.ghost))) return act('strongpoints', ['autoStrongpoints']);
    const u = g.units.find((x) => x.box === 'deploy' && x.side === side); if (u) return place(g, u, G.deployOptions(g, u.id), 'golanDeploy');
    if (side === 'israeli' && G.state(g).minesLeft) return act('minefields', ['autoMinefields']);
    if (G.reservesLeft(g, side)) return act('reserves', ['autoReserves', side]);
    if (side === 'syrian') { const c = G.alowdaCommandos(g)[0], o = G.alowdaRaidAreas(g); if (c && o.length) { const a = best(o, (x) => worth(g, x, side))!.x; return act('commando raid', ['alowdaRaid', c.id, a], { chit: c.id, area: a }); } }
    return null;
  }
  if (CUR.id === 'sicily') {
    if (side === 'axis') { const u = g.units.find((x) => x.box === 'deploy' && x.untried); return u ? act('garrisons', ['autoGarrisons']) : null; }
    if (!S.state(g).plan) { if (g.units.some((u) => u.untried && u.box === 'deploy')) return null; const o = S.planOptions(g, 'historical'); return act('landing plan', ['choosePlan', o.british[0], o.us[0]]); }
    const u = g.units.find((x) => x.box === 'deploy' && x.side === side); if (u) { const o = S.deployOptions(g, u.id); return o.length ? act('land', ['sicilyDeploy', u.id, o[0]], { unit: u.id, area: o[0] }) : null; }
  }
  return null;
}
/** Place a block where the position reads best (a quick full evaluation per option). */
function place(g: Game, u: Unit, opts: number[], op: string): Action | null {
  if (!opts.length) return null;
  const b = best(opts, (a) => { const x = structuredClone(g); try { apply(x, [op, u.id, a]); } catch { return -1e9; } return evaluate(x, u.side) + worth(g, a, u.side) * 0.5 + near(g, a, E.other(u.side), u.side) * 0.2; })!;
  return act('place', [op, u.id, b.x], { unit: u.id, area: b.x });
}

/* ================= reinforcement ================= */
function reinforce(g: Game, side: Side): Action | null {
  if (side === 'allied') for (const id of g.tfNew ?? []) {
    const ok = [...areas.keys()].filter((a) => inPlay(g, a) && g.control[a] === 'allied' && !E.contested(g, a) && E.inSupply(g, 'allied', a));
    const b = best(ok, (a) => need(g, a, side) + worth(g, a, side) * 0.3 + near(g, a, E.other(side), side) * 0.2 - power(g, a, side, side) * 0.1); if (b) return act('task force', ['placeTaskForce', id, b.x], { unit: id, area: b.x });
  }
  for (const id of g.pendingArrivals) {
    const u = g.units.find((x) => x.id === id)!; if (u.side !== side) continue;
    const o = E.arrivalOptions(g, id).filter((x) => !x.sa || CUR.id === 'bulge'); if (!o.length) continue;          // 8.27: another entry area for a Special Action, when it is worth one
    const b = best(o, (x) => need(g, x.area, side) * 2 + 1 / (1 + dist(g, x.area, enemyObjective(g, side))) - E.blocks(g, x.area, side).length * 0.3 - (x.sa ? 1 : 0))!;
    return act('arrive', ['placeArrival', id, b.x.area], { unit: id, area: b.x.area });
  }
  return null;
}

/* ================= admin: try each play, keep what reads best ================= */
type Try = { label: string; chit?: string; unit?: string; area?: number; bonus?: number; op: Op };
function admin(g: Game, side: Side, level: Level): Action | null {
  const tries: Try[] = [];
  const front = [...areas.keys()].filter((a) => inPlay(g, a) && g.control[a] === side && E.blocks(g, a, side).some(regular) && near(g, a, E.other(side), side) > 0);
  const reduced = own(g, side).filter((u) => regular(u) && u.str < u.max && !u.unsupplied), dead = g.units.filter((u) => u.side === side && u.area == null && u.str === 0 && regular(u));
  const disordered = [...areas.keys()].filter((a) => inPlay(g, a) && E.blocks(g, a, side).some((u) => u.disorder && !u.unsupplied));
  for (const c of avail(g, side)) {
    const k = c.kind;
    if (['replacement_inf', 'replacement_arm', 'rebuild_or_replace_inf', 'rebuild_or_replace_arm', 'event_arriving_regiment', 'replacement_mech'].includes(k)) {
      for (const u of reduced) tries.push({ label: 'replacement', chit: c.id, unit: u.id, op: ['playReplacement', c.id, u.id] });
      for (const u of dead.slice(0, 4)) for (const a of front.slice(0, 6)) tries.push({ label: 'rebuild', chit: c.id, unit: u.id, area: a, op: ['playRebuild', c.id, u.id, a] });
      for (const u of dead.slice(0, 4)) tries.push({ label: 'return', chit: c.id, unit: u.id, op: ['playReplacement', c.id, u.id] });
    }
    if (k === 'command_staff') for (const u of reduced.filter((x) => x.cls === 'infantry')) tries.push({ label: 'staff replacement', chit: c.id, unit: u.id, bonus: -0.4, op: ['staffReplacement', c.id, u.id] });
    if (k === 'engineer') for (const a of front) tries.push({ label: 'field works', chit: c.id, area: a, bonus: 0.3, op: ['fieldWorksFor', c.id, a] });
    if (k === 'engineer' && CUR.id === 'sicily') for (const p of ['P1', 'P2', 'P3']) tries.push({ label: 'port work', chit: c.id, bonus: 1, op: ['portWork', c.id, p] });
    if (k === 'engineer' && CUR.id === 'golan73' && side === 'syrian') for (const a of front) for (const n of neighbors(a)) { tries.push({ label: 'bridge the ditch', chit: c.id, area: a, bonus: 1.2, op: ['bridgeDitch', c.id, a, n] }); tries.push({ label: 'clear mines', chit: c.id, area: a, bonus: 1, op: ['removeMinefield', c.id, a, n] }); }
    if (k === 'sa_block' || k === 'special_action_event') for (const a of disordered) tries.push({ label: 'rally', chit: c.id, area: a, op: ['rally', side, a, c.id] });
    if (k === 'special_action_event') for (const u of reduced.filter((x) => x.ech === c.ech || c.ech === 'us_sr')) tries.push({ label: 'quality replacements', chit: c.id, unit: u.id, op: ['qualityReplacement', u.id, c.id] });
    if (k === 'event_release' && CUR.id === 'bulge') for (const a of [4, 6] as const) tries.push({ label: 'release', chit: c.id, area: a, bonus: 2, op: ['releaseUnit', c.id, a] });
    if (k === 'event_release' && CUR.id === 'golan73') tries.push({ label: 'release', chit: c.id, bonus: 2, op: ['playRelease', c.id] });
    if (CUR.id === 'bulge') {                                                                          // the plays the position score cannot see: a bonus for what they open up
      const ahead = (a: number) => dist(g, a, enemyObjective(g, side));
      if (k === 'engineer') for (const a of [...areas.keys()].filter((x) => inPlay(g, x) && E.blocks(g, x, side).some(regular))) for (const to of E.repairTargets(g, side, a)) tries.push({ label: 'repair the bridge', chit: c.id, area: a, bonus: 0.4 + 0.4 * Math.max(0, ahead(a) - ahead(to)), op: ['repairBridge', c.id, a, to] });
      if (k === 'event_greif_bridge') for (const a of front) for (const n of neighbors(a)) if (connection(a, n)?.river && !g.blown.includes(E.keyOf(a, n)) && !g.greif[E.keyOf(a, n)] && g.control[n] !== side && ahead(n) < ahead(a)) tries.push({ label: 'Greif bridge', chit: c.id, area: a, bonus: 0.8, op: ['greifBridge', c.id, a, n] });
      if (k === 'event_greif_interdict') for (const u of g.units.filter((x) => x.side !== side && x.area != null && regular(x) && !x.interdict && neighbors(x.area).some((n) => front.includes(n))).sort((x, y) => val(g, y, side) - val(g, x, side)).slice(0, 4)) tries.push({ label: 'Greif interdict', chit: c.id, unit: u.id, bonus: 0.3 + 0.15 * val(g, u, side), op: ['interdict', c.id, u.id] });
      if (k === 'event_bodenplatte') { const air = avail(g, E.other(side)).filter((x) => x.kind === 'air_mission').length; if (air) tries.push({ label: 'Bodenplatte', chit: c.id, bonus: 0.5 * air, op: ['bodenplatte', c.id] }); }
      if (E.heydteWindow(g, c)) for (const a of [31, 52] as const) tries.push({ label: 'von der Heydte', chit: c.id, area: a, bonus: 1, op: ['heydteDrop', c.id, a] });
      if (k === 'command_staff') for (const u of own(g, side).filter((x) => x.cls === 'armor' && E.canReserve(g, x) && near(g, x.area!, E.other(side), side) > 0)) tries.push({ label: 'staff reserve', chit: c.id, unit: u.id, bonus: 0.3, op: ['staffReserve', c.id, u.id] });
      const foe = E.other(side), reach = side === 'allied' ? enemyReach(g, foe) : new Set<number>();
      if (k === 'engineer' && side === 'allied') {                                                        // the defender's engineers: bridges blown in the enemy's face, roadblocks on his roads
        for (const a of front) for (const n of E.bridgeTargets(g, side, a)) if (E.unitsIn(g, n, foe).some(regular)) tries.push({ label: 'blow the bridge', chit: c.id, area: a, bonus: 0.4 + 0.5 * (worth(g, a, side) + need(g, a, side)), op: ['blowBridges', c.id, a, n] });
        for (const a of E.roadblockAreas(g, side).filter((x) => reach.has(x)).sort((x, y) => vpWorth(y, side) - vpWorth(x, side)).slice(0, 4)) for (const d of [false, true]) tries.push({ label: d ? 'defended roadblock' : 'roadblock', chit: c.id, area: a, bonus: 0.3 + 0.4 * vpWorth(a, side) + (d ? 0.2 : 0), op: ['roadblock', c.id, a, d] });
      }
      if (k === 'command_staff') {
        const hidden = g.units.filter((u) => u.side === foe && u.area != null && regular(u) && !E.visibleTo(g, u, side) && neighbors(u.area).some((n) => E.unitsIn(g, n, side).some(regular))).slice(0, 4);
        for (const u of hidden) tries.push({ label: 'intelligence', chit: c.id, unit: u.id, bonus: 0.25, op: ['staffIntel', c.id, u.id] });
        if (side === 'allied') for (const a of front.filter((x) => worth(g, x, side) > 0).sort((x, y) => threat(g, y, side) - threat(g, x, side)).slice(0, 2)) tries.push({ label: 'pooled assets', chit: c.id, area: a, bonus: 0.3 + 0.3 * worth(g, a, side), op: ['staffPool', c.id, a] });
        if (side === 'german') for (const u of own(g, side).filter((x) => x.cls === 'armor' && regular(x) && !x.bcross && near(g, x.area!, foe, side) > 0).slice(0, 3)) tries.push({ label: 'army boundary', chit: c.id, unit: u.id, bonus: 0.15, op: ['staffBoundary', c.id, u.id] });
      }
      if (k === 'air_mission' && side === 'allied' && avail(g, side).filter((x) => x.kind === 'air_mission').length > 1)    // one kept for the battles
        for (const a of [...new Set(front.flatMap((f) => neighbors(f)))].filter((x) => g.control[x] === foe && E.unitsIn(g, x, foe).some(regular) && !g.interdicted[x]).sort((x, y) => steps(g, y, foe, side) - steps(g, x, foe, side)).slice(0, 3))
          tries.push({ label: 'interdiction', chit: c.id, area: a, bonus: 0.3 + 0.1 * steps(g, a, foe, side), op: ['interdiction', c.id, a] });
      if (!isAsset(c) && k !== 'sa_block' && E.alternateCandidates(g, side).length) tries.push({ label: 'assets back to the cup', chit: c.id, bonus: 0.3 * Math.min(2, E.alternateCandidates(g, side).length), op: ['alternateUse', c.id] });
    }
    if (k === 'event_arriving_battalion') { for (const u of own(g, side).filter((x) => x.brigade === c.brigade)) tries.push({ label: 'arriving battalion', chit: c.id, unit: u.id, bonus: 1, op: ['arrivingBattalion', c.id, { add: u.id }] }); for (const u of dead.filter((x) => x.brigade === c.brigade)) tries.push({ label: 'arriving battalion', chit: c.id, unit: u.id, bonus: 1, op: ['arrivingBattalion', c.id, { rebuild: u.id, assembly: 'A' }] }); }
    if (k === 'event_army_release') tries.push({ label: 'army release', chit: c.id, bonus: 3, op: ['playArmyRelease', c.id] });
    if (k === 'event_ssm_strike') tries.push({ label: 'SSM strike', chit: c.id, bonus: 1, op: ['playSSM', c.id] });
    if (k === 'event_lt_zvika') for (const a of front) tries.push({ label: 'Lt. Zvika', chit: c.id, area: a, bonus: 1, op: ['playLtZvika', c.id, a] });
    if (k === 'air_mission' && CUR.id === 'golan73' && side === 'israeli' && avail(g, side).filter((x) => x.kind === 'air_mission').length > 2) for (const a of [...new Set(front.flatMap((f) => neighbors(f)))].filter((a) => g.control[a] !== side)) tries.push({ label: 'air interdiction', chit: c.id, area: a, bonus: 0.5, op: ['airInterdiction', c.id, a] });
  }
  if (CUR.id === 'sicily' && side === 'allied') { const sa = E.saAvailable(g, side); if (sa.length > 1) for (const d of [...new Set(own(g, side).filter(regular).map((u) => u.division).filter(Boolean))] as string[]) tries.push({ label: 'release the division', bonus: 1.2, op: ['releaseDivision', d, sa[0].id] }); }
  if (CUR.id === 'golan73' && side === 'israeli' && G.state(g).purpleLineCrossed) { const sa = E.saAvailable(g, side); if (sa.length) { tries.push({ label: 'operational reserve', bonus: 1.5, op: ['releaseOperationalReserve', sa[0].id] }); tries.push({ label: 'Golani', bonus: 1.5, op: ['releaseGolani', sa[0].id] }); tries.push({ label: 'the 33rd', bonus: 1.5, op: ['freeThe33rd', sa[0].id] }); } }
  if (!tries.length) return null;
  const base = evaluate(g, side);
  const b = best(tries, (t) => { const x = structuredClone(g); try { apply(x, t.op); } catch { return -1e9; } return evaluate(x, side) - base + (t.bonus ?? 0) + noise(g, t.op.join(), level === 'easy' ? 1 : 0); });
  return b && b.s > 0.15 ? act(b.x.label, b.x.op, { chit: b.x.chit, unit: b.x.unit, area: b.x.area }) : null;
}

/* ================= movement ================= */
/** One move of `side`'s blocks: the single move that improves the position most (attacks with enough weight, objectives taken or shored up), else a reserve marker.
 *  The hard player judges the best few candidates on copies: the position after the move, an attack fought out many times. */
function movement(g: Game, side: Side, level: Level): Action | null {
  const foe = E.other(side), mover = g.phase === 'reaction' ? E.other(g.phasing) : g.phasing; if (mover !== side) return null;
  if (level === 'hard' && TUNE.plan && g.phase === 'movement') { const p = planned(g, side); if (p) return act('move', ['move', p[0], p[1]], { unit: p[0], area: p[1] }); }
  const units = own(g, side).filter((u) => !u.moved);
  const canReach = new Map<number, Unit[]>();                                                         // blocks still able to join an attack on an area this phase
  const optsOf = new Map<string, E.Opt[]>();
  for (const u of units) { const o = E.moveOptions(g, u.id); optsOf.set(u.id, o); for (const x of o) if (E.unitsIn(g, x.area, foe).length) (canReach.get(x.area) ?? canReach.set(x.area, []).get(x.area)!).push(u); }
  const supplied = (a: number) => supplyFrom(g, side, a);
  const cands: { u: Unit; o: E.Opt; s: number; attack: boolean }[] = [];
  for (const u of units) {
    const from = u.area!, opts = optsOf.get(u.id)!; if (!opts.length) continue;
    const myVal = val(g, u, side), leaving = need(g, from, side) - needWithout(g, from, side, u);        // what the start area loses
    for (const o of opts) {
      const a = o.area, enemy = E.unitsIn(g, a, foe).length > 0, w = worth(g, a, side); let s = 0;
      if (enemy) {
        if (g.phase === 'reaction' && !E.contested(g, a)) continue;
        const others = (canReach.get(a) ?? []).filter((x) => x.id !== u.id && E.blocks(g, a, side).length + 1 < (CUR.stackLimit?.(g, a) ?? 2)).slice(0, 1);
        const ex = exchange(g, a, side, g.phase !== 'reaction', [u, ...others.map((x) => x)]);
        const ratio = ex.mine / (ex.theirs + 0.3), def = steps(g, a, foe, side);
        if (g.phase === 'reaction') s = (w + 1) * Math.min(1.5, ratio) * 0.8;                              // reinforcing a defence
        else s = (w + 1.2) * (ratio - 1.05 + risk(g, side)) + (ratio >= 1.3 ? Math.min(1, def * 0.3) : 0) - (o.path.length > 2 ? 0.1 : 0);
        if (ratio < 0.9 - risk(g, side)) s = -1;
        if (connection(o.path[o.path.length - 2], a)?.river) s -= 0.4;
        if (E.contested(g, a) && g.contestedAtMoveStart.includes(a)) s *= 0.7;                          // joining a fight already standing
      } else if (g.control[a] === foe || !g.control[a]) {
        if (g.phase === 'reaction') continue;
        const danger = Math.max(0, near(g, a, foe, side) - power(g, a, side, side) - myVal);
        s = w * 1.5 + 0.35 + (dist(g, from, enemyObjective(g, side)) - dist(g, a, enemyObjective(g, side))) * 0.25 - danger * 0.25 * (w ? 0.5 : 1) - (supplied(a) ? 0 : 1.2);
      } else {
        const gain = need(g, a, side) - needWith(g, a, side, u);
        s = gain * 1.5 + (dist(g, from, enemyObjective(g, side)) - dist(g, a, enemyObjective(g, side))) * 0.2 - 0.2 - (supplied(a) ? 0 : 1) + (u.unsupplied && supplied(a) ? 1 : 0);
      }
      s -= leaving * 1.2;
      if (o.fuel && g.opts.fuel && u.side === 'german') s -= 0.4;
      s += noise(g, `${u.id}>${a}`, level === 'easy' ? 1.2 : 0);
      cands.push({ u, o, s, attack: enemy });
    }
  }
  cands.sort((x, y) => y.s - x.s);
  let chosen: { u: Unit; o: E.Opt } | null = null;
  if (level === 'hard' && cands.length) {                                                               // the best few, judged on copies: an attack by its fought-out outcome, any move dropped if the position after it reads clearly worse
    const base = evaluate(g, side), live = cands.filter((c) => c.s > -0.6);
    const attacks = live.filter((c) => c.attack && g.phase !== 'reaction').slice(0, 7), moves = live.filter((c) => !c.attack || g.phase === 'reaction').slice(0, 7);
    const deep = best([...attacks, ...moves], (c) => { const d = deepMove(g, side, c.u, c.o, c.attack, canReach, base); return c.attack && g.phase !== 'reaction' ? d * 0.6 + 0.1 : d < -1.2 ? -1 : Math.max(c.s, d * 0.6 + 0.1); });
    if (deep && deep.s > 0.2) chosen = deep.x;
  } else if (cands.length && cands[0].s > 0.2) chosen = cands[0];
  if (chosen) return act('move', ['move', chosen.u.id, chosen.o.area], { unit: chosen.u.id, area: chosen.o.area });
  if (g.phase === 'movement' && level !== 'easy' && CUR.id === 'bulge') {                               // 5.23: a block that stays digs in where the enemy is near and the area matters
    const fw = own(g, side).filter((u) => regular(u) && !u.moved && !u.disorder && !u.unsupplied && !g.fieldWorks.includes(u.area!) && !E.contested(g, u.area!) && near(g, u.area!, foe, side) > 0);
    const b = best(fw, (u) => need(g, u.area!, side) + worth(g, u.area!, side));
    if (b && b.s > 0.5) return act('field works', ['buildFieldWorks', b.x.id], { unit: b.x.id, area: b.x.area! });
  }
  if (g.phase === 'movement' && level !== 'easy') {                                                     // reserve markers on the best blocks left standing
    const cand = own(g, side).filter((u) => E.canReserve(g, u));
    const b = best(cand, (u) => val(g, u, side) + (u.cls === 'armor' ? 1 : 0) + (near(g, u.area!, foe, side) > 0 ? 0.5 : 0));
    if (b) return act('reserve', ['setReserve', b.x.id], { unit: b.x.id });
  }
  if (g.phase === 'btMove' && level !== 'easy' && E.saAvailable(g, side).length) { const id = breakthrough(g, side, level); if (id) return act('breakthrough', ['activateBreakthrough', id], { unit: id }); }
  if (g.phase === 'btMove' && CUR.id === 'bulge') for (const u of own(g, side)) if (E.peiperCan(g, u)) return act('Peiper', ['setPeiperFull', u.id], { unit: u.id });
  return null;
}
/** 8.21: an armor block in good order pays a Special Action to move one area in Breakthrough Movement, when its best such move reads well
 *  worth the Special Action (hard: attacks fought out too; normal: only moves into areas without enemy blocks). */
function breakthrough(g: Game, side: Side, level: Level): string | null {
  const foe = E.other(side), base = evaluate(g, side);
  const cand = own(g, side).filter((u) => u.cls === 'armor' && regular(u) && !u.moved && !u.exploit && !u.reserve && !u.disorder && !u.unsupplied).sort((x, y) => val(g, y, side) - val(g, x, side)).slice(0, 3);
  const b = best(cand, (u) => {
    const x = structuredClone(g); try { E.activateBreakthrough(x, u.id); } catch { return -1e9; }
    const v = x.units.find((y) => y.id === u.id)!, opts = E.moveOptions(x, u.id).filter((o) => (level === 'hard' && E.unitsIn(x, o.area, foe).length > 0) || (!E.unitsIn(x, o.area, foe).length && x.control[o.area] !== side)).slice(0, 4);
    return best(opts, (o) => deepMove(x, side, v, o, E.unitsIn(x, o.area, foe).length > 0, new Map(), base))?.s ?? -1e9;
  });
  return b && b.s > 0.8 ? b.x.id : null;
}
/* ---- the hard player's attack plan: before its blocks move one by one, the attacks worth making this turn, each with the group of blocks that makes it ---- */
const PLANS = new Map<string, { key: string; at: number; moves: [string, number][] }>();
/** The next move of the attack plan for this Movement Phase (worked out once per phase, kept while the phase lasts), or null when it is done. */
function planned(g: Game, side: Side): [string, number] | null {
  const key = `${g.game}|${g.seed}|${side}|${g.turn}|${g.phasing}|${g.phase}`, held = PLANS.get(side);                  // the seed: another game of the same scenario never inherits this one's plan
  const plan = held && held.key === key && held.at <= g.log.length ? held : { key, at: g.log.length, moves: TUNE.turn ? turnPlan(g, side) : attackPlan(g, side) }; PLANS.set(side, plan);     // a game put back to before the plan (the account's copy) plans again
  for (const [id, a] of plan.moves) { const u = g.units.find((x) => x.id === id); if (!u || u.moved || u.area === a) continue; if (E.moveOptions(g, id).some((o) => o.area === a)) return [id, a]; }
  return null;
}
type Plan = { a: number; ids: string[]; gain: number };
/** Every enemy-held area in reach, attacked by the strongest 1, 2 or 3 blocks that can get there (up to the stacking room), each judged by fighting the attack out. */
function attackOptions(g: Game, side: Side): Plan[] {
  const foe = E.other(side), base = evaluate(g, side), units = own(g, side).filter((u) => regular(u) && !u.moved && !u.disorder);
  const reach = new Map<number, Unit[]>();
  for (const u of units) for (const o of E.moveOptions(g, u.id)) if (E.unitsIn(g, o.area, foe).length && inPlay(g, o.area)) (reach.get(o.area) ?? reach.set(o.area, []).get(o.area)!).push(u);
  const plans: Plan[] = [];
  for (const [a, us] of reach) {
    const room = (CUR.stackLimit?.(g, a) ?? 2) - E.blocks(g, a, side).length; if (room <= 0) continue;
    const ranked = [...us].sort((x, y) => val(g, y, side) - val(g, x, side));
    for (let k = 1; k <= Math.min(room, 3, ranked.length); k++) {
      const grp = ranked.slice(0, k), x = structuredClone(g); let ok = true;
      for (const u of grp) { try { E.move(x, u.id, a); if (x.pendingBlow) E.resolveBlow(x, false); } catch { ok = false; break; } }
      if (!ok || !E.contested(x, a)) continue;
      const gain = simulate(x, side, SIMS.attack, (y) => { y.phase = 'combat'; y.fought = []; E.startBattle(y, a, false); }) - base;
      plans.push({ a, ids: grp.map((u) => u.id), gain });
    }
  }
  return plans.sort((p, q) => q.gain - p.gain);
}
/** The attacks that pay (TUNE.planAt), strongest first, no block in two of them. */
function attackPlan(g: Game, side: Side, plans = attackOptions(g, side), at = TUNE.planAt): [string, number][] {
  const used = new Set<string>(), out: [string, number][] = [];
  for (const p of plans) { if (p.gain < at || p.ids.some((id) => used.has(id)) || out.some((m) => m[1] === p.a)) continue; for (const id of p.ids) { used.add(id); out.push([id, p.a]); } }
  return out;
}
/** The turn-level plan (hard): a few whole offensives (no attack, the attacks that pay, everything promising, or all the weight on the best one, two or
 *  three targets), each played out on copies of the game through the enemy's reply (TUNE.horizon 2; the rest by the plain player); the best one is made. */
function turnPlan(g: Game, side: Side): [string, number][] {
  const opts = attackOptions(g, side), byArea = new Map<number, Plan[]>();
  for (const p of opts) (byArea.get(p.a) ?? byArea.set(p.a, []).get(p.a)!).push(p);
  const targets = [...byArea.values()].map((ps) => ps.reduce((x, y) => (y.ids.length > x.ids.length ? y : x))).sort((x, y) => Math.max(...byArea.get(y.a)!.map((p) => p.gain)) - Math.max(...byArea.get(x.a)!.map((p) => p.gain)));
  const massed = (k: number) => { const used = new Set<string>(), out: [string, number][] = []; for (const p of targets.slice(0, k)) { const ids = p.ids.filter((id) => !used.has(id)); for (const id of ids) { used.add(id); out.push([id, p.a]); } } return out; };
  const cands = [[], attackPlan(g, side, opts), attackPlan(g, side, opts, -0.5), massed(1), massed(2), massed(3)];
  const seen = new Set<string>(), uniq = cands.filter((c) => { const k = JSON.stringify(c); if (seen.has(k)) return false; seen.add(k); return true; });
  if (uniq.length < 2 || late(1, 0)) return uniq.length < 2 ? uniq[0] ?? [] : uniq[1];                 // out of time already: the attacks that pay
  return best(uniq, (moves) => playTurn(g, side, moves, SIMS.turn))!.x;
}
/** The mean position for `side` after `TUNE.horizon` player turns (1: its own, before the Supply Phase; 2: and the enemy's reply; 3: and its next turn, the follow-up wave) after making `moves`, on `n` copies with their own dice. */
function playTurn(g: Game, side: Side, moves: [string, number][], n: number): number {
  const sides = E.sidesOf(g), src = E.randomSource(); E.setRandom(null);
  let total = 0, done = 0;
  try {
    for (let i = 0; i < n && !late(i, 1); i++) {
      const x = structuredClone(g); x.seed = ((g.seed + 7) * 2654435761 + (i + 1) * 40503 + g.rolls * 131) % 1e9; x.rolls = 0;
      mask(x, side);
      for (const [id, a] of moves) { try { walk(x, id, a); if (x.pendingBlow) E.resolveBlow(x, false); } catch { /* blocked on the way */ } }
      let at = side, turns = 1;                                                                           // player turns begun so far: 1 = its own
      for (let k = 0; k < 4000 && !x.over; k++) {
        if (x.phasing !== at) { at = x.phasing; turns++; }
        if (turns > TUNE.horizon || (TUNE.horizon < 2 && (x.turn !== g.turn || x.phase === 'supply'))) break;
        let act: Action | null = null; for (const s of sides) { act = step(x, s, 'normal'); if (act) break; }
        if (!act) break; try { act.run(x); } catch { break; }
      }
      total += evaluate(x, side); done++;
    }
  } finally { E.setRandom(src); }
  return done ? total / done : -1e9;
}
/** The hard player's judgement of one move: the position after it (an attack: after the battle it leads to, fought out many times with the
 *  blocks that can still join), against the position now. */
function deepMove(g: Game, side: Side, u: Unit, o: E.Opt, attack: boolean, canReach: Map<number, Unit[]>, base: number): number {
  const x = structuredClone(g);
  try { E.move(x, u.id, o.area); } catch { return -1e9; }
  if (x.pendingBlow) { const p = pending(x, E.other(side)); if (p) p.run(x); }                         // the enemy blows the bridge when it pays him to
  const a = o.area;
  if (attack && x.units.find((v) => v.id === u.id)!.area === a && E.contested(x, a) && g.phase !== 'reaction') {
    for (const f of (canReach.get(a) ?? []).filter((v) => v.id !== u.id)) { try { if (E.moveOptions(x, f.id).some((p) => p.area === a)) { E.move(x, f.id, a); if (x.pendingBlow) E.resolveBlow(x, false); } } catch { /* cannot follow */ } }   // the blocks that can still join do
    const bt = g.phase === 'btMove';
    return simulate(x, side, SIMS.attack, (y) => { y.phase = bt ? 'btCombat' : 'combat'; y.fought = []; E.startBattle(y, a, false); }) - base;
  }
  return evaluate(x, side) - base;
}
const needWith = (g: Game, a: number, side: Side, u: Unit) => { const w = worth(g, a, side); if (!w || g.control[a] !== side) return 0; const en = near(g, a, E.other(side), side); return (w * Math.max(0, en - power(g, a, side, side) - val(g, u, side))) / (en + 1); };
const needWithout = (g: Game, a: number, side: Side, u: Unit) => { const w = worth(g, a, side); if (!w || g.control[a] !== side) return 0; const en = near(g, a, E.other(side), side); return (w * Math.max(0, en - power(g, a, side, side) + val(g, u, side))) / (en + 1); };
function strategic(g: Game, side: Side, level: Level): Action | null {
  const cands: { u: Unit; a: number; s: number }[] = [];
  for (const u of own(g, side).filter((x) => x.reserve && !x.moved)) {
    const from = u.area!, leaving = need(g, from, side) - needWithout(g, from, side, u);
    for (const a of E.stratOptions(g, u.id)) cands.push({ u, a, s: (need(g, a, side) - needWith(g, a, side, u)) * 1.5 + (dist(g, from, enemyObjective(g, side)) - dist(g, a, enemyObjective(g, side))) * 0.3 - leaving * 1.2 - 0.3 + noise(g, `s${u.id}>${a}`, level === 'easy' ? 1 : 0) });
  }
  cands.sort((x, y) => y.s - x.s);
  let pick: { u: Unit; a: number } | null = null;
  if (level === 'hard' && cands.length) { const base = evaluate(g, side); const d = best(cands.slice(0, 8), (c) => { const x = structuredClone(g); try { E.stratMove(x, c.u.id, c.a); } catch { return -1e9; } return evaluate(x, side) - base; }); if (d && d.s > 0.3) pick = d.x; }
  else if (cands.length && cands[0].s > 0.3) pick = cands[0];
  return pick ? act('strategic move', ['stratMove', pick.u.id, pick.a], { unit: pick.u.id, area: pick.a }) : null;
}

/* ================= combat ================= */
function combat(g: Game, side: Side, level: Level): Action | null {
  if (g.phasing !== side) return null;
  if (CUR.id === 'sicily' && S.state(g).dropPending) for (const u of g.units.filter((x) => x.box === 'airborne_assault' && x.side === 'allied')) { const t = S.airDropTargets(g, u.id); const b = best(t, (a) => worth(g, a, side) - steps(g, a, E.other(side), side) * 0.5); return act('air drop', ['airDrop', u.id, b?.x ?? null], { unit: u.id, area: b?.x }); }
  const must = E.mustFight(g);
  { const f = E.firstBattle(g); if (f != null) return act('fight', ['startBattle', f, false], { area: f }); }
  if (CUR.id === 'sicily') { const first = S.state(g).airborneAreas.filter((a) => E.contested(g, a) && !g.fought.includes(a)); if (first.length) return act('fight', ['startBattle', first[0], false], { area: first[0] }); }
  if (must.length) { const a = best(must, (x) => exchange(g, x, side, true).mine)!.x; return act('fight', ['startBattle', a, false], { area: a }); }
  const bt = g.phase === 'btCombat', opt = E.contestedAreas(g).filter((a) => !g.fought.includes(a) && E.fighters(g, a, side, true).some((u) => !u.garrison) && (!bt || E.newlyContested(g).includes(a) || freeRound(g)));
  if (level === 'hard') {                                                                               // fought out on copies: only where the position comes out better than leaving it
    const base = evaluate(g, side), paid = bt && E.saAvailable(g, side).length ? E.contestedAreas(g).filter((a) => !opt.includes(a) && !g.fought.includes(a) && E.fighters(g, a, side, true).some((u) => !u.garrison)) : [];   // a second round this turn, for a Special Action (8.22)
    const b = best([...opt, ...paid], (a) => simulate(g, side, SIMS.attack, (x) => { E.startBattle(x, a, bt); }) - base - (paid.includes(a) ? 0.5 : 0));
    return b && b.s > 0.2 ? act('fight', ['startBattle', b.x, bt], { area: b.x }) : null;
  }
  const b = best(opt, (a) => { const ex = exchange(g, a, side, true); return ex.mine / (ex.theirs + 0.3) + worth(g, a, side) * 0.15 + noise(g, `f${a}`, level === 'easy' ? 0.4 : 0); });
  if (b && b.s >= 1.1 - risk(g, side)) return act('fight', ['startBattle', b.x, bt], { area: b.x });
  return null;
}
/** Golan 22.17: a free Breakthrough combat round is still owed (read without spending it). */
const freeRound = (g: Game) => CUR.id === 'golan73' && g.turn === 1 && g.phasing === 'syrian' && G.state(g).freeCombatRound > 0;
/** 6.21: the Defender's Special Action before the battle: go on, retreat (8.24) or bring in a neighbouring block (8.23). Hard fights each out on
 *  copies; normal reinforces a valuable area it would lose and retreats from a hopeless fight over nothing; easy goes on. */
function saDecision(g: Game, b: Battle, side: Side, level: Level): Action {
  const pass: Op = ['passSA'], ok = (op: Op) => { const x = structuredClone(g); try { apply(x, op); return true; } catch { return false; } };
  if (level === 'easy' || CUR.id !== 'bulge') return act('no Special Action', pass);
  const a = b.area, foe = E.other(side), opts: Op[] = [pass];
  if (ok(['retreatSA'])) opts.push(['retreatSA']);
  for (const u of neighbors(a).flatMap((n) => E.unitsIn(g, n, side)).filter(regular).sort((x, y) => val(g, y, side) - val(g, x, side)).slice(0, 3)) if (ok(['reinforceSA', u.id])) opts.push(['reinforceSA', u.id]);
  if (opts.length === 1) return act('no Special Action', pass);
  let pick: Op = pass;
  if (level === 'hard') pick = pickSim(g, side, level, opts, pass, (x, op) => apply(x, op));
  else { const ex = exchange(g, a, side, false), w = worth(g, a, side), rf = opts.find((o) => o[0] === 'reinforceSA');
    if (rf && w > 0 && ex.theirs > ex.mine * 1.5) pick = rf; else if (opts.some((o) => o[0] === 'retreatSA') && !w && ex.theirs > ex.mine * 2.5) pick = ['retreatSA']; }
  return pick[0] === 'retreatSA' ? act('retreat before combat', pick, { area: a }) : pick[0] === 'reinforceSA' ? act('reinforce the battle', pick, { unit: pick[1] as string, area: a }) : act('no Special Action', pass);
}
/** May this block be made the point unit (the rules pin it in some battles: 18.4, 8.23)? */
const canPoint = (g: Game, b: Battle, side: Side, id: string) => { const x = structuredClone(g); try { E.setPoint(x, x.battle!, side, id); return true; } catch { return false; } };
function battle(g: Game, b: Battle, side: Side, level: Level): Action | null {
  const att = side === b.attacker, foe = E.other(side), a = b.area;
  if (b.stage === 'setup') {
    if (E.setupSide(g, b) !== side || b.attPointDone || (b.ready?.includes(side) && !(att && b.ready.length === 2))) return null;   // its own step only; the Attacker's last one is his point unit (6.24)
    if (b.defSA) return saDecision(g, b, side, level);                                                   // 6.21
    if (CUR.id === 'golan73' && G.state(g).samTarget && side !== 'syrian') return null;                 // the SAM answer comes first (16.12)
    const ex = exchange(g, a, side, att), close = ex.mine < ex.theirs * 1.6, w = worth(g, a, side);
    if (level !== 'easy') for (const c of avail(g, side)) {
      const mode = c.kind === 'air_mission' ? 'arty' : undefined;
      if (E.canAssign(g, b, side, c, mode) != null) continue;
      if (isArty(c) || c.kind === 'air_mission') return act('assign', ['assign', c.id, mode], { chit: c.id });
      if (isBattleAsset(c) && (close || w >= 2 || level === 'hard') && b.assets[side].filter((id) => isBattleAsset(E.chit(g, id))).length < (level === 'hard' && (close || w >= 2) ? 3 : 2)) return act('assign', ['assign', c.id, undefined, att && c.kind === 'engineer' && g.fieldWorks.includes(a) && (g.fwOwner[a] ?? foe) === foe], { chit: c.id });
    }
    const cands = E.unitsIn(g, a, side).filter((u) => regular(u) && !(att && u.disorder)), cur = att ? b.attPoint : b.defPoint;
    const p = best(cands, (u) => (u.cls === 'armor' ? 2 : 0) + QW[E.quality(u)] + u.str * 0.3);
    if (p && p.x.id !== cur && canPoint(g, b, side, p.x.id)) return act('point unit', ['setPoint', side, p.x.id], { unit: p.x.id });
    return act('ready', ['setReady', side]);
  }
  if (b.stage === 'done') return att ? act('close', ['closeBattle']) : null;
  if (b.stage === 'loss' && b.loss?.side === side) {
    const o = E.lossOptions(g, b); const k0 = o.find((id) => g.chits.some((c) => c.id === id)) ?? best(o, (id) => { const u = g.units.find((x) => x.id === id)!; return -QW[E.quality(u)] + u.str * 0.2; })?.x ?? o[0];
    const k = pickSim(g, side, level, o, k0, (x, id) => E.chooseLoss(x, x.battle!, id));
    return act('step loss', ['chooseLoss', k], { unit: k });
  }
  if (b.stage === 'attFirst' && att) { const o = [b.attPoint, ...b.assets[side].filter((id) => isBattleAsset(E.chit(g, id)))], k0 = o[1] ?? o[0]; const k = pickSim(g, side, level, o, k0, (x, id) => E.chooseFirstLoss(x, x.battle!, id)); return act('first loss', ['chooseFirstLoss', k], { unit: k }); }
  if (b.stage === 'attChoice' && att) {
    const mineSteps = steps(g, a, side, side), left = mineSteps - b.pending, ex = exchange(g, a, side, true);
    const canAbort = !CUR.canAbort?.(g, b), abort0 = canAbort && (left <= 0 || (left <= 1 && ex.theirs >= 1) || ex.mine * (left / Math.max(1, mineSteps)) < ex.theirs * 0.5);
    const abort = canAbort ? pickSim(g, side, level, [false, true], abort0, (x, ab) => E.attackerChoice(x, x.battle!, ab)) : false;
    return act(abort ? 'abort' : 'press on', ['attackerChoice', abort]);
  }
  if (b.stage === 'defChoice' && !att) {
    const mineSteps = steps(g, a, side, side), w = worth(g, a, side), ex = exchange(g, a, side, false);
    let use0: boolean;
    const canRetreat = E.retreatOptions(g, { ...b, retreat: { side, queue: E.unitsIn(g, a, side).filter(regular).map((u) => u.id), moved: false, after: 'ground', h: 0, excess: 0 } }).length > 0;
    if (b.pendingKind === 'arty') use0 = b.pending >= 2 || mineSteps <= b.pending + 1;
    else use0 = canRetreat && (mineSteps - b.pending <= 1 || (ex.theirs > ex.mine * 1.5 && w < 2) || (b.pending >= mineSteps * 0.5 && w < 1));
    const use = b.pendingKind === 'arty' || canRetreat ? pickSim(g, side, level, [false, true], use0, (x, u) => E.defenderChoice(x, x.battle!, u)) : false;
    return act(use ? (b.pendingKind === 'arty' ? 'disorder' : 'retreat') : 'stand', ['defenderChoice', use]);
  }
  if (b.stage === 'retreat' && b.retreat?.side === side) {
    const o = E.retreatOptions(g, b), foeSide = E.other(side);
    const r0 = best(o, (x) => (x === E.SEA ? -5 : E.blocks(g, x, side).length * 0.8 + worth(g, x, side) - near(g, x, foeSide, side) * 0.4 + (E.inSupply(g, side, x) ? 1 : 0)))!.x;
    const r = pickSim(g, side, level, o, r0, (x, to) => E.chooseRetreat(x, x.battle!, to));
    return act('retreat', ['chooseRetreat', r], { area: r });
  }
  if (b.stage === 'exploit' && att) return act('exploitation check', ['roll'], { roll: true });
  if (['attArty', 'offFire'].includes(b.stage) ? att : ['defArty', 'defFire'].includes(b.stage) ? !att : false) return act('roll', ['roll'], { roll: true });
  return null;
}

/* ================= supply ================= */
function supply(g: Game, side: Side): Action | null {
  if (g.phasing !== side) return null;
  const air = avail(g, side).find((c) => c.kind === 'air_mission');
  if (air && g.supplyPending && !g.airSupply) {
    const ar = CUR.id === 'bulge' ? E.airSupplyAreas(g, side) : CUR.id === 'sicily' ? [...new Set(own(g, side).filter((u) => u.unsupplied).map((u) => u.area!))] : [];
    const b = best(ar, (a) => steps(g, a, side, side) + worth(g, a, side)); if (b && b.s >= 2) return act('air supply', ['airSupply', air.id, b.x], { chit: air.id, area: b.x });
  }
  if (g.supplyPending) return act('supply checks', ['rollSupply'], { roll: true });
  return null;
}
