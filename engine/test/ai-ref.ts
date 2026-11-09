// A frozen copy of the computer player (the first version, 2026-11) as the arena's reference opponent: new versions have to beat it. Not part of the engine.
/** 4.4 The computer opponent: a player for one side of any volume, built on the engine's own option functions (so every action it takes
 *  is legal) and an evaluation of the position. It is honest: an enemy block it may not see (6.24) counts as an average block.
 *  One call of `next` gives ONE action (so the table can show them one by one); `play` runs them until the side has nothing left to do.
 *  An action is data (`op`: a name and its arguments, run with `apply`), so it can come back from a worker thread.
 *  Three levels: easy (the plain player, with some noise and no assets), normal (the plain player: it holds and takes objective areas,
 *  attacks where the dice favour it, spends assets and replacements where they do most), and hard (the same choices, but each important
 *  one is tried on copies of the game: an attack is fought out many times with the real rules and dice before it is made, a loss, a
 *  retreat or an abort is chosen by what the position reads like after it, and a move is judged by the whole position it leaves). */
import { areas, neighbors, connection, setPlayArea } from '../src/map';
import { isArty, isBattleAsset, isAsset, type Chit, type Side } from '../src/chits';
import { hitProb } from '../src/dice';
import type { Quality } from '../src/combat';
import * as E from '../src/game';
import type { Game, Unit, Battle } from '../src/game';
import * as G from '../src/vol/golan';
import * as S from '../src/vol/sicily';
import { CUR } from '../src/volumes';

export type Level = 'easy' | 'normal' | 'hard';
/** One action, as data: `op` names an entry of `OPS` and its arguments; `run` applies it. */
export type Op = [string, ...unknown[]];
export interface Action { label: string; unit?: string; area?: number; chit?: string; roll?: boolean; op: Op; run: (g: Game) => void }
type Est = { str: number; q: Quality; cls: 'armor' | 'infantry' };
const QW: Record<Quality, number> = { green: 0.8, veteran: 1, elite: 1.25 };
/** How many times a hard player fights a battle out before deciding (more: steadier, slower). */
export const SIMS = { attack: 48, choice: 24 };

/* ================= actions as data ================= */
type OpFn = (g: Game, ...args: never[]) => unknown;
const OPS: Record<string, OpFn> = {
  endPhase: (g) => E.endPhase(g), setDone: (g, side: Side) => E.setDone(g, side), resolveBlow: (g, yes: boolean) => E.resolveBlow(g, yes),
  recoverAsset: (g, side: Side, id: string | null) => E.recoverAsset(g, side, id), chooseArtyLoss: (g, id: string) => E.chooseArtyLoss(g, id),
  fireSam: (g, id: string) => G.fireSam(g, id), declineSam: (g) => G.declineSam(g), pickMoraleLoss: (g, side: Side, id: string) => S.pickMoraleLoss(g, side, id), autoMoraleLoss: (g) => S.autoMoraleLoss(g),
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
  move: (g, u: string, a: number) => E.move(g, u, a), setReserve: (g, u: string) => { const had = !!g.units.find((x) => x.id === u)?.interdict; try { E.setReserve(g, u, true); } catch (e) { if (!had) throw e; } },   /* a failed Greif interdict check (17.11) is an outcome */ setPeiperFull: (g, u: string) => E.setPeiperFull(g, u, true), stratMove: (g, u: string, a: number) => E.stratMove(g, u, a),
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
/** A block as this side sees it: its own and face-up blocks as they are, a hidden enemy block as a two-step veteran. */
const est = (g: Game, u: Unit, side: Side): Est => (E.visibleTo(g, u, side) ? { str: u.str, q: E.quality(u), cls: u.cls } : { str: 2, q: 'veteran', cls: 'infantry' });
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
/** The whole position for `side`, in steps-worth: own and enemy strength, objectives (the victory function), threatened objectives, assets in hand,
 *  enemy blocks cut off from supply, and (for the side that has to take ground) how close its blocks stand to the objectives still to take. */
export function evaluate(g: Game, side: Side): number {
  const foe = E.other(side); let s = 0;
  for (const u of g.units) if (u.area != null) s += (u.side === side ? 1 : -1) * val(g, u, side);
  const v = E.victory(g); s += (v[side] - v[foe]) * 4;
  for (const a of areas.keys()) if (inPlay(g, a)) s -= need(g, a, side) * 2;
  for (const c of g.chits) if (c.side === side && c.box === 'available') s += c.kind === 'sa_block' ? 1 : c.kind === 'special_action_event' ? 0.6 : isAsset(c) ? 0.3 : 0.2;
  const held = new Set(g.units.filter((u) => u.side === foe && u.area != null && !u.garrison).map((u) => u.area!));
  for (const a of held) if (inPlay(g, a) && !E.inSupply(g, foe, a)) s += 0.35 * steps(g, a, foe, side);          // cut off: weaker next Supply Phase
  if (E.sidesOf(g)[0] === side) { const obj = enemyObjective(g, side); for (const u of own(g, side)) if (regular(u) && !isBox(u.area!)) s -= 0.12 * Math.min(5, dist(g, u.area!, obj)); }
  return s;
}

/* ================= helpers ================= */
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
    for (let i = 0; i < n; i++) {
      const x = structuredClone(g); x.seed = ((g.seed + 1) * 2654435761 + (i + 1) * 40503 + g.rolls * 97) % 1e9; x.rolls = 0;
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
  return step(g, side, level);
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
const hasPending = (g: Game, side: Side) => (!!g.pendingBlow && g.units.find((x) => x.id === g.pendingBlow!.unit)?.side !== side) || g.recover.includes(side) || (!!g.artyPick && side === 'german')
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
    const o = E.arrivalOptions(g, id).filter((x) => !x.sa); if (!o.length) continue;
    const b = best(o, (x) => need(g, x.area, side) * 2 + 1 / (1 + dist(g, x.area, enemyObjective(g, side))) - E.blocks(g, x.area, side).length * 0.3)!;
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
        if (g.phase === 'reaction') continue;
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
    const attacks = live.filter((c) => c.attack && g.phase !== 'reaction').slice(0, 6), moves = live.filter((c) => !c.attack || g.phase === 'reaction').slice(0, 5);
    const deep = best([...attacks, ...moves], (c) => { const d = deepMove(g, side, c.u, c.o, c.attack, canReach, base); return c.attack && g.phase !== 'reaction' ? d * 0.6 + 0.1 : d < -1.2 ? -1 : c.s; });
    if (deep && deep.s > 0.2) chosen = deep.x;
  } else if (cands.length && cands[0].s > 0.2) chosen = cands[0];
  if (chosen) return act('move', ['move', chosen.u.id, chosen.o.area], { unit: chosen.u.id, area: chosen.o.area });
  if (g.phase === 'movement' && level !== 'easy') {                                                     // reserve markers on the best blocks left standing
    const cand = own(g, side).filter((u) => E.canReserve(g, u));
    const b = best(cand, (u) => val(g, u, side) + (u.cls === 'armor' ? 1 : 0) + (near(g, u.area!, foe, side) > 0 ? 0.5 : 0));
    if (b) return act('reserve', ['setReserve', b.x.id], { unit: b.x.id });
  }
  if (g.phase === 'btMove' && CUR.id === 'bulge') for (const u of own(g, side)) if (E.peiperCan(g, u)) return act('Peiper', ['setPeiperFull', u.id], { unit: u.id });
  return null;
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
/** For tests and tuning: the hard player's judgement of moving `unitId` to `area` now (evaluate units; an attack is fought out). */
export function judgeMove(g: Game, side: Side, unitId: string, area: number): number {
  E.useGame(g.game ?? 'bulge'); setPlayArea(g.inPlay);
  const u = g.units.find((x) => x.id === unitId)!, o = E.moveOptions(g, u.id).find((x) => x.area === area); if (!o) return -1e9;
  const canReach = new Map<number, Unit[]>(); for (const v of own(g, side).filter((x) => !x.moved)) for (const x of E.moveOptions(g, v.id)) if (E.unitsIn(g, x.area, E.other(side)).length) (canReach.get(x.area) ?? canReach.set(x.area, []).get(x.area)!).push(v);
  return deepMove(g, side, u, o, E.unitsIn(g, area, E.other(side)).length > 0, canReach, evaluate(g, side));
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
  if (CUR.id === 'sicily') { const first = S.state(g).airborneAreas.filter((a) => E.contested(g, a) && !g.fought.includes(a)); if (first.length) return act('fight', ['startBattle', first[0], false], { area: first[0] }); }
  if (must.length) { const a = best(must, (x) => exchange(g, x, side, true).mine)!.x; return act('fight', ['startBattle', a, false], { area: a }); }
  const bt = g.phase === 'btCombat', opt = E.contestedAreas(g).filter((a) => !g.fought.includes(a) && E.fighters(g, a, side, true).some((u) => !u.garrison) && (!bt || E.newlyContested(g).includes(a) || freeRound(g)));
  if (level === 'hard' && opt.length) {                                                                 // fought out on copies: only where the position comes out better than leaving it
    const base = evaluate(g, side), b = best(opt, (a) => simulate(g, side, SIMS.attack, (x) => { E.startBattle(x, a, bt); }) - base);
    return b && b.s > 0.2 ? act('fight', ['startBattle', b.x, bt], { area: b.x }) : null;
  }
  const b = best(opt, (a) => { const ex = exchange(g, a, side, true); return ex.mine / (ex.theirs + 0.3) + worth(g, a, side) * 0.15 + noise(g, `f${a}`, level === 'easy' ? 0.4 : 0); });
  if (b && b.s >= 1.1 - risk(g, side)) return act('fight', ['startBattle', b.x, bt], { area: b.x });
  return null;
}
/** Golan 22.17: a free Breakthrough combat round is still owed (read without spending it). */
const freeRound = (g: Game) => CUR.id === 'golan73' && g.turn === 1 && g.phasing === 'syrian' && G.state(g).freeCombatRound > 0;
/** May this block be made the point unit (the rules pin it in some battles: 18.4, 8.23)? */
const canPoint = (g: Game, b: Battle, side: Side, id: string) => { const x = structuredClone(g); try { E.setPoint(x, x.battle!, side, id); return true; } catch { return false; } };
function battle(g: Game, b: Battle, side: Side, level: Level): Action | null {
  const att = side === b.attacker, foe = E.other(side), a = b.area;
  if (b.stage === 'setup') {
    if (E.setupSide(g, b) !== side || b.attPointDone || (b.ready?.includes(side) && !(att && b.ready.length === 2))) return null;   // its own step only; the Attacker's last one is his point unit (6.24)
    if (b.defSA) return act('no Special Action', ['passSA']);                                          // 6.21 (shortcut: never reinforces or retreats by Special Action yet)
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
