/** 4.4 The computer opponent: a player for one side of any volume, built on the engine's own option functions (so every action it takes
 *  is legal) and a plain evaluation of the position. It is honest: an enemy block it may not see (6.24) counts as an average block.
 *  One call of `next` gives ONE action (so the table can show them one by one); `play` runs them until the side has nothing left to do.
 *  Nothing here is clever: it holds and takes objective areas, attacks where the dice favour it, spends assets and replacements where
 *  they do the most, and never leaves a step of the sequence undone. */
import { areas, neighbors, connection, setPlayArea } from './map';
import { isArty, isBattleAsset, isAsset, type Chit, type Side } from './chits';
import { hitProb } from './dice';
import type { Quality } from './combat';
import * as E from './game';
import type { Game, Unit, Battle } from './game';
import * as G from './vol/golan';
import * as S from './vol/sicily';
import { CUR } from './volumes';

export interface Action { label: string; unit?: string; area?: number; chit?: string; roll?: boolean; run: (g: Game) => void }
type Est = { str: number; q: Quality; cls: 'armor' | 'infantry' };
const QW: Record<Quality, number> = { green: 0.8, veteran: 1, elite: 1.25 };

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
/** The whole position for `side`, in steps-worth: own and enemy strength, objectives (the victory function), threatened objectives, assets in hand. */
export function evaluate(g: Game, side: Side): number {
  const foe = E.other(side); let s = 0;
  for (const u of g.units) if (u.area != null) s += (u.side === side ? 1 : -1) * val(g, u, side);
  const v = E.victory(g); s += (v[side] - v[foe]) * 4;
  for (const a of areas.keys()) if (inPlay(g, a)) s -= need(g, a, side) * 2;
  for (const c of g.chits) if (c.side === side && c.box === 'available') s += c.kind === 'sa_block' ? 1 : c.kind === 'special_action_event' ? 0.6 : isAsset(c) ? 0.3 : 0.2;
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
export function next(g: Game, side: Side): Action | null {
  E.useGame(g.game ?? 'bulge'); setPlayArea(g.inPlay);
  if (g.over || !turnOf(g, side)) return null;
  const p = pending(g, side); if (p) return p;
  const b = g.battle; if (b) return battle(g, b, side);
  switch (g.phase) {
    case 'deploy': return deploy(g, side);
    case 'reinforcement': return reinforce(g, side) ?? both(g, side);
    case 'admin': return admin(g, side) ?? both(g, side);
    case 'movement': case 'btMove': case 'reaction': return movement(g, side) ?? end(g, side);
    case 'strategic': return strategic(g, side) ?? end(g, side);
    case 'combat': case 'btCombat': return combat(g, side) ?? end(g, side);
    case 'supply': return supply(g, side) ?? end(g, side);
  }
  return null;
}
/** Every action of `side` until it has nothing left to do (the set-up is never ended here: the caller does). Returns the actions taken. */
export function play(g: Game, side: Side, max = 500): Action[] {
  const out: Action[] = [];
  for (let i = 0; i < max; i++) { const a = next(g, side); if (!a) break; a.run(g); out.push(a); }
  return out;
}
const end = (g: Game, side: Side): Action | null => (E.actorOf(g) === side || (E.actorOf(g) === 'both' && g.phasing === side) ? { label: 'end', run: (x) => E.endPhase(x) } : null);
/** Admin and Reinforcement: the other side marks itself done; the Phasing Player ends the step once it is. */
function both(g: Game, side: Side): Action | null {
  if (g.phasing !== side) return g.done?.includes(side) ? null : { label: 'done', run: (x) => E.setDone(x, side) };
  return g.done?.includes(E.other(side)) ? { label: 'end', run: (x) => E.endPhase(x) } : null;
}

/* ================= choices the rules put to a side outside the sequence ================= */
const hasPending = (g: Game, side: Side) => (!!g.pendingBlow && g.units.find((x) => x.id === g.pendingBlow!.unit)?.side !== side) || g.recover.includes(side) || (!!g.artyPick && side === 'german')
  || (CUR.id === 'golan73' && side === 'syrian' && !!G.state(g).samTarget) || (CUR.id === 'sicily' && !!S.state(g).moralePick?.[side]);
function pending(g: Game, side: Side): Action | null {
  if (g.pendingBlow) {
    const u = g.units.find((x) => x.id === g.pendingBlow!.unit)!; if (u.side === side) return null;
    const to = g.pendingBlow.path.at(-1)!, worthIt = g.control[to] === side && (E.unitsIn(g, to, side).length > 0 || worth(g, to, side) > 0);
    return { label: worthIt ? 'blow the bridge' : 'let them cross', area: to, run: (x) => { E.resolveBlow(x, worthIt); } };
  }
  if (g.recover.includes(side)) {
    const pri = ['artillery', 'rocket_artillery', 'naval_support', 'engineer', 'armor_asset', 'air_mission', 'infantry_asset', 'commando', 'sam', 'task_force', 'command_staff', 'fuel'];
    const c = E.boxOf(g, side, 'used').filter(isAsset).sort((a, b) => pri.indexOf(a.kind) - pri.indexOf(b.kind))[0];
    return { label: 'recover an asset', chit: c?.id, run: (x) => E.recoverAsset(x, side, c?.id ?? null) };
  }
  if (g.artyPick && side === 'german') { const c = E.boxOf(g, 'german', 'used').filter((x) => x.kind === 'artillery').sort((a, b) => (a.ech === 'de_sr' ? 1 : 0) - (b.ech === 'de_sr' ? 1 : 0))[0]; if (c) return { label: 'artillery attrition', chit: c.id, run: (x) => E.chooseArtyLoss(x, c.id) }; }
  if (CUR.id === 'golan73' && side === 'syrian' && G.state(g).samTarget) { const sam = avail(g, 'syrian').find((c) => c.kind === 'sam'); return { label: sam ? 'SAM fires' : 'no SAM', chit: sam?.id, run: (x) => (sam ? G.fireSam(x, sam.id) : G.declineSam(x)) }; }
  if (CUR.id === 'sicily') { const V = S.state(g); if (V.moralePick?.[side]) { const pool = g.chits.filter((c) => c.side === 'axis' && c.nation === 'italian' && c.box === 'available' && c.kind !== 'command_staff' && (isArty(c) || isBattleAsset(c))).sort((a, b) => +isArty(a) - +isArty(b)); return { label: 'Italian morale', chit: pool[0]?.id, run: (x) => (pool.length ? S.pickMoraleLoss(x, side, pool[0].id) : S.autoMoraleLoss(x)) }; } }
  return null;
}

/* ================= set-up ================= */
function deploy(g: Game, side: Side): Action | null {
  if (CUR.id === 'golan73') {
    if (side === 'israeli' && g.units.some((u) => u.box === 'deploy' && u.side === side && (u.fort || u.ghost))) return { label: 'strongpoints', run: (x) => G.autoStrongpoints(x, 'historical') };
    const u = g.units.find((x) => x.box === 'deploy' && x.side === side); if (u) return place(g, u, G.deployOptions(g, u.id), (x, a) => G.deploy(x, u.id, a));
    if (side === 'israeli' && G.state(g).minesLeft) return { label: 'minefields', run: (x) => G.autoMinefields(x) };
    if (G.reservesLeft(g, side)) return { label: 'reserves', run: (x) => G.autoReserves(x, side) };
    if (side === 'syrian') { const c = G.alowdaCommandos(g)[0], o = G.alowdaRaidAreas(g); if (c && o.length) { const a = best(o, (x) => worth(g, x, side))!.x; return { label: 'commando raid', chit: c.id, area: a, run: (x) => G.alowdaRaid(x, c.id, a) }; } }
    return null;
  }
  if (CUR.id === 'sicily') {
    if (side === 'axis') { const u = g.units.find((x) => x.box === 'deploy' && x.untried); return u ? { label: 'garrisons', run: (x) => S.autoGarrisons(x) } : null; }
    if (!S.state(g).plan) { if (g.units.some((u) => u.untried && u.box === 'deploy')) return null; const o = S.planOptions(g, 'historical'); return { label: 'landing plan', run: (x) => S.choosePlan(x, 'historical', o.british[0], o.us[0]) }; }
    const u = g.units.find((x) => x.box === 'deploy' && x.side === side); if (u) { const o = S.deployOptions(g, u.id); return o.length ? { label: 'land', unit: u.id, area: o[0], run: (x) => S.deploy(x, u.id, o[0]) } : null; }
  }
  return null;
}
/** Place a block where the position reads best (a quick full evaluation per option). */
function place(g: Game, u: Unit, opts: number[], run: (g: Game, a: number) => void): Action | null {
  if (!opts.length) return null;
  const b = best(opts, (a) => { const x = structuredClone(g); try { run(x, a); } catch { return -1e9; } return evaluate(x, u.side) + worth(g, a, u.side) * 0.5 + near(g, a, E.other(u.side), u.side) * 0.2; })!;
  return { label: 'place', unit: u.id, area: b.x, run: (x) => run(x, b.x) };
}

/* ================= reinforcement ================= */
function reinforce(g: Game, side: Side): Action | null {
  if (side === 'allied') for (const id of g.tfNew ?? []) {
    const ok = [...areas.keys()].filter((a) => inPlay(g, a) && g.control[a] === 'allied' && !E.contested(g, a) && E.inSupply(g, 'allied', a));
    const b = best(ok, (a) => need(g, a, side) + worth(g, a, side) * 0.3 + near(g, a, E.other(side), side) * 0.2 - power(g, a, side, side) * 0.1); if (b) return { label: 'task force', unit: id, area: b.x, run: (x) => E.placeTaskForce(x, id, b.x) };
  }
  for (const id of g.pendingArrivals) {
    const u = g.units.find((x) => x.id === id)!; if (u.side !== side) continue;
    const o = E.arrivalOptions(g, id).filter((x) => !x.sa); if (!o.length) continue;
    const b = best(o, (x) => need(g, x.area, side) * 2 + 1 / (1 + dist(g, x.area, enemyObjective(g, side))) - E.blocks(g, x.area, side).length * 0.3)!;
    return { label: 'arrive', unit: id, area: b.x.area, run: (x) => E.placeArrival(x, id, b.x.area) };
  }
  return null;
}

/* ================= admin: try each play, keep what reads best ================= */
type Try = { label: string; chit?: string; unit?: string; area?: number; bonus?: number; run: (g: Game) => void };
function admin(g: Game, side: Side): Action | null {
  const tries: Try[] = [];
  const front = [...areas.keys()].filter((a) => inPlay(g, a) && g.control[a] === side && E.blocks(g, a, side).some(regular) && near(g, a, E.other(side), side) > 0);
  const reduced = own(g, side).filter((u) => regular(u) && u.str < u.max && !u.unsupplied), dead = g.units.filter((u) => u.side === side && u.area == null && u.str === 0 && regular(u));
  const disordered = [...areas.keys()].filter((a) => inPlay(g, a) && E.blocks(g, a, side).some((u) => u.disorder && !u.unsupplied));
  for (const c of avail(g, side)) {
    const k = c.kind;
    if (['replacement_inf', 'replacement_arm', 'rebuild_or_replace_inf', 'rebuild_or_replace_arm', 'event_arriving_regiment', 'replacement_mech'].includes(k)) {
      for (const u of reduced) tries.push({ label: 'replacement', chit: c.id, unit: u.id, run: (x) => (CUR.id === 'golan73' ? G.playReplacement(x, c.id, u.id) : E.playReplacement(x, c.id, u.id)) });
      for (const u of dead.slice(0, 4)) for (const a of front.slice(0, 6)) tries.push({ label: 'rebuild', chit: c.id, unit: u.id, area: a, run: (x) => E.playRebuild(x, c.id, u.id, a) });
      for (const u of dead.slice(0, 4)) tries.push({ label: 'return', chit: c.id, unit: u.id, run: (x) => E.playReplacement(x, c.id, u.id) });
    }
    if (k === 'command_staff') for (const u of reduced.filter((x) => x.cls === 'infantry')) tries.push({ label: 'staff replacement', chit: c.id, unit: u.id, bonus: -0.4, run: (x) => E.staffReplacement(x, c.id, u.id) });
    if (k === 'engineer') for (const a of front) tries.push({ label: 'field works', chit: c.id, area: a, bonus: 0.3, run: (x) => (CUR.id === 'golan73' ? G.engineerFieldWorks(x, c.id, a) : E.fieldWorksFor(x, c.id, a)) });
    if (k === 'engineer' && CUR.id === 'sicily') for (const p of ['P1', 'P2', 'P3']) tries.push({ label: 'port work', chit: c.id, bonus: 1, run: (x) => S.portWork(x, c.id, p) });
    if (k === 'engineer' && CUR.id === 'golan73' && side === 'syrian') for (const a of front) for (const n of neighbors(a)) { tries.push({ label: 'bridge the ditch', chit: c.id, area: a, bonus: 1.2, run: (x) => G.bridgeDitch(x, c.id, a, n) }); tries.push({ label: 'clear mines', chit: c.id, area: a, bonus: 1, run: (x) => G.removeMinefield(x, c.id, a, n) }); }
    if (k === 'sa_block' || k === 'special_action_event') for (const a of disordered) tries.push({ label: 'rally', chit: c.id, area: a, run: (x) => E.rally(x, side, a, c.id) });
    if (k === 'special_action_event') for (const u of reduced.filter((x) => x.ech === c.ech || c.ech === 'us_sr')) tries.push({ label: 'quality replacements', chit: c.id, unit: u.id, run: (x) => E.qualityReplacement(x, u.id, c.id) });
    if (k === 'event_release' && CUR.id === 'bulge') for (const a of [4, 6] as const) tries.push({ label: 'release', chit: c.id, area: a, bonus: 2, run: (x) => E.releaseUnit(x, c.id, a) });
    if (k === 'event_release' && CUR.id === 'golan73') tries.push({ label: 'release', chit: c.id, bonus: 2, run: (x) => G.playRelease(x, c.id) });
    if (k === 'event_arriving_battalion') { for (const u of own(g, side).filter((x) => x.brigade === c.brigade)) tries.push({ label: 'arriving battalion', chit: c.id, unit: u.id, bonus: 1, run: (x) => G.playArrivingBattalion(x, c.id, { add: u.id }) }); for (const u of dead.filter((x) => x.brigade === c.brigade)) tries.push({ label: 'arriving battalion', chit: c.id, unit: u.id, bonus: 1, run: (x) => G.playArrivingBattalion(x, c.id, { rebuild: u.id, assembly: 'A' }) }); }
    if (k === 'event_army_release') tries.push({ label: 'army release', chit: c.id, bonus: 3, run: (x) => S.playArmyRelease(x, c.id) });
    if (k === 'event_ssm_strike') tries.push({ label: 'SSM strike', chit: c.id, bonus: 1, run: (x) => G.playSSM(x, c.id) });
    if (k === 'event_lt_zvika') for (const a of front) tries.push({ label: 'Lt. Zvika', chit: c.id, area: a, bonus: 1, run: (x) => G.playLtZvika(x, c.id, a) });
    if (k === 'air_mission' && CUR.id === 'golan73' && side === 'israeli' && avail(g, side).filter((x) => x.kind === 'air_mission').length > 2) for (const a of [...new Set(front.flatMap((f) => neighbors(f)))].filter((a) => g.control[a] !== side)) tries.push({ label: 'air interdiction', chit: c.id, area: a, bonus: 0.5, run: (x) => G.airInterdiction(x, c.id, a) });
  }
  if (CUR.id === 'sicily' && side === 'allied') { const sa = E.saAvailable(g, side); if (sa.length > 1) for (const d of [...new Set(own(g, side).filter(regular).map((u) => u.division).filter(Boolean))] as string[]) tries.push({ label: 'release the division', bonus: 1.2, run: (x) => S.releaseDivision(x, d, sa[0].id) }); }
  if (CUR.id === 'golan73' && side === 'israeli' && G.state(g).purpleLineCrossed) { const sa = E.saAvailable(g, side); if (sa.length) { tries.push({ label: 'operational reserve', bonus: 1.5, run: (x) => G.releaseOperationalReserve(x, sa[0].id) }); tries.push({ label: 'Golani', bonus: 1.5, run: (x) => G.releaseGolani(x, sa[0].id) }); tries.push({ label: 'the 33rd', bonus: 1.5, run: (x) => G.freeThe33rd(x, sa[0].id) }); } }
  if (!tries.length) return null;
  const base = evaluate(g, side);
  const b = best(tries, (t) => { const x = structuredClone(g); try { t.run(x); } catch { return -1e9; } return evaluate(x, side) - base + (t.bonus ?? 0); });
  return b && b.s > 0.15 ? { label: b.x.label, chit: b.x.chit, unit: b.x.unit, area: b.x.area, run: b.x.run } : null;
}

/* ================= movement ================= */
/** One move of `side`'s blocks: the single move that improves the position most (attacks with enough weight, objectives taken or shored up), else a reserve marker. */
function movement(g: Game, side: Side): Action | null {
  const foe = E.other(side), mover = g.phase === 'reaction' ? E.other(g.phasing) : g.phasing; if (mover !== side) return null;
  const units = own(g, side).filter((u) => !u.moved);
  const canReach = new Map<number, Unit[]>();                                                         // blocks still able to join an attack on an area this phase
  const optsOf = new Map<string, E.Opt[]>();
  for (const u of units) { const o = E.moveOptions(g, u.id); optsOf.set(u.id, o); for (const x of o) if (E.unitsIn(g, x.area, foe).length) (canReach.get(x.area) ?? canReach.set(x.area, []).get(x.area)!).push(u); }
  const supplied = (a: number) => supplyFrom(g, side, a);
  let bestMove: { u: Unit; o: E.Opt; s: number } | null = null;
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
      if (!bestMove || s > bestMove.s) bestMove = { u, o, s };
    }
  }
  if (bestMove && bestMove.s > 0.2) { const { u, o } = bestMove; return { label: 'move', unit: u.id, area: o.area, run: (x) => { E.move(x, u.id, o.area); } }; }
  if (g.phase === 'movement') {                                                                          // reserve markers on the best blocks left standing
    const cand = own(g, side).filter((u) => E.canReserve(g, u));
    const b = best(cand, (u) => val(g, u, side) + (u.cls === 'armor' ? 1 : 0) + (near(g, u.area!, foe, side) > 0 ? 0.5 : 0));
    if (b) return { label: 'reserve', unit: b.x.id, run: (x) => E.setReserve(x, b.x.id, true) };
  }
  if (g.phase === 'btMove' && CUR.id === 'bulge') for (const u of own(g, side)) if (E.peiperCan(g, u)) return { label: 'Peiper', unit: u.id, run: (x) => E.setPeiperFull(x, u.id, true) };
  return null;
}
const needWith = (g: Game, a: number, side: Side, u: Unit) => { const w = worth(g, a, side); if (!w || g.control[a] !== side) return 0; const en = near(g, a, E.other(side), side); return (w * Math.max(0, en - power(g, a, side, side) - val(g, u, side))) / (en + 1); };
const needWithout = (g: Game, a: number, side: Side, u: Unit) => { const w = worth(g, a, side); if (!w || g.control[a] !== side) return 0; const en = near(g, a, E.other(side), side); return (w * Math.max(0, en - power(g, a, side, side) + val(g, u, side))) / (en + 1); };
function strategic(g: Game, side: Side): Action | null {
  let bestMove: { u: Unit; a: number; s: number } | null = null;
  for (const u of own(g, side).filter((x) => x.reserve && !x.moved)) {
    const from = u.area!, leaving = need(g, from, side) - needWithout(g, from, side, u);
    for (const a of E.stratOptions(g, u.id)) {
      const s = (need(g, a, side) - needWith(g, a, side, u)) * 1.5 + (dist(g, from, enemyObjective(g, side)) - dist(g, a, enemyObjective(g, side))) * 0.3 - leaving * 1.2 - 0.3;
      if (!bestMove || s > bestMove.s) bestMove = { u, a, s };
    }
  }
  return bestMove && bestMove.s > 0.3 ? { label: 'strategic move', unit: bestMove.u.id, area: bestMove.a, run: (x) => { E.stratMove(x, bestMove!.u.id, bestMove!.a); } } : null;
}

/* ================= combat ================= */
function combat(g: Game, side: Side): Action | null {
  if (g.phasing !== side) return null;
  if (CUR.id === 'sicily' && S.state(g).dropPending) for (const u of g.units.filter((x) => x.box === 'airborne_assault' && x.side === 'allied')) { const t = S.airDropTargets(g, u.id); const b = best(t, (a) => worth(g, a, side) - steps(g, a, E.other(side), side) * 0.5); return { label: 'air drop', unit: u.id, area: b?.x, run: (x) => S.airDrop(x, u.id, b?.x ?? null) }; }
  const must = E.mustFight(g);
  if (CUR.id === 'sicily') { const first = S.state(g).airborneAreas.filter((a) => E.contested(g, a) && !g.fought.includes(a)); if (first.length) return { label: 'fight', area: first[0], run: (x) => { E.startBattle(x, first[0]); } }; }
  if (must.length) { const a = best(must, (x) => exchange(g, x, side, true).mine)!.x; return { label: 'fight', area: a, run: (x) => { E.startBattle(x, a); } }; }
  const bt = g.phase === 'btCombat', opt = E.contestedAreas(g).filter((a) => !g.fought.includes(a) && E.fighters(g, a, side, true).some((u) => !u.garrison) && (!bt || E.newlyContested(g).includes(a) || freeRound(g)));
  const b = best(opt, (a) => { const ex = exchange(g, a, side, true); return ex.mine / (ex.theirs + 0.3) + worth(g, a, side) * 0.15; });
  if (b && b.s >= 1.1 - risk(g, side)) return { label: 'fight', area: b.x, run: (x) => { E.startBattle(x, b.x, bt); } };
  return null;
}
/** Golan 22.17: a free Breakthrough combat round is still owed (read without spending it). */
const freeRound = (g: Game) => CUR.id === 'golan73' && g.turn === 1 && g.phasing === 'syrian' && G.state(g).freeCombatRound > 0;
/** May this block be made the point unit (the rules pin it in some battles: 18.4, 8.23)? */
const canPoint = (g: Game, b: Battle, side: Side, id: string) => { const x = structuredClone(g); try { E.setPoint(x, x.battle!, side, id); return true; } catch { return false; } };
function battle(g: Game, b: Battle, side: Side): Action | null {
  const att = side === b.attacker, foe = E.other(side), a = b.area;
  if (b.stage === 'setup') {
    if (b.ready?.includes(side)) return null;
    if (CUR.id === 'golan73' && G.state(g).samTarget && side !== 'syrian') return null;                 // the SAM answer comes first (16.12)
    const ex = exchange(g, a, side, att), close = ex.mine < ex.theirs * 1.6, w = worth(g, a, side);
    for (const c of avail(g, side)) {
      const mode = c.kind === 'air_mission' ? 'arty' : undefined;
      if (E.canAssign(g, b, side, c, mode) != null) continue;
      if (isArty(c) || c.kind === 'air_mission') return { label: 'assign', chit: c.id, run: (x) => E.assign(x, x.battle!, c.id, mode) };
      if (isBattleAsset(c) && (close || w >= 2) && b.assets[side].filter((id) => isBattleAsset(E.chit(g, id))).length < 2) return { label: 'assign', chit: c.id, run: (x) => { E.assign(x, x.battle!, c.id); if (att && c.kind === 'engineer' && x.fieldWorks.includes(a) && (x.fwOwner[a] ?? foe) === foe) E.setEngFw(x, x.battle!, true); } };
    }
    const cands = E.unitsIn(g, a, side).filter((u) => regular(u) && !(att && u.disorder)), cur = att ? b.attPoint : b.defPoint;
    const p = best(cands, (u) => (u.cls === 'armor' ? 2 : 0) + QW[E.quality(u)] + u.str * 0.3);
    if (p && p.x.id !== cur && canPoint(g, b, side, p.x.id)) return { label: 'point unit', unit: p.x.id, run: (x) => E.setPoint(x, x.battle!, side, p.x.id) };
    return { label: 'ready', run: (x) => E.setReady(x, x.battle!, side) };
  }
  if (b.stage === 'done') return att ? { label: 'close', run: (x) => E.closeBattle(x) } : null;
  if (b.stage === 'loss' && b.loss?.side === side) { const o = E.lossOptions(g, b); const k = o.find((id) => g.chits.some((c) => c.id === id)) ?? best(o, (id) => { const u = g.units.find((x) => x.id === id)!; return -QW[E.quality(u)] + u.str * 0.2; })?.x ?? o[0]; return { label: 'step loss', unit: k, run: (x) => E.chooseLoss(x, x.battle!, k) }; }
  if (b.stage === 'attFirst' && att) { const k = b.assets[side].find((id) => isBattleAsset(E.chit(g, id))) ?? b.attPoint; return { label: 'first loss', unit: k, run: (x) => E.chooseFirstLoss(x, x.battle!, k) }; }
  if (b.stage === 'attChoice' && att) {
    const mineSteps = steps(g, a, side, side), left = mineSteps - b.pending, ex = exchange(g, a, side, true);
    const abort = !CUR.canAbort?.(g, b) && (left <= 0 || (left <= 1 && ex.theirs >= 1) || ex.mine * (left / Math.max(1, mineSteps)) < ex.theirs * 0.5);
    return { label: abort ? 'abort' : 'press on', run: (x) => E.attackerChoice(x, x.battle!, abort) };
  }
  if (b.stage === 'defChoice' && !att) {
    const mineSteps = steps(g, a, side, side), w = worth(g, a, side), ex = exchange(g, a, side, false);
    let use: boolean;
    if (b.pendingKind === 'arty') use = b.pending >= 2 || mineSteps <= b.pending + 1;
    else use = E.retreatOptions(g, { ...b, retreat: { side, queue: E.unitsIn(g, a, side).filter(regular).map((u) => u.id), moved: false, after: 'ground', h: 0, excess: 0 } }).length > 0 && (mineSteps - b.pending <= 1 || (ex.theirs > ex.mine * 1.5 && w < 2) || (b.pending >= mineSteps * 0.5 && w < 1));
    return { label: use ? (b.pendingKind === 'arty' ? 'disorder' : 'retreat') : 'stand', run: (x) => E.defenderChoice(x, x.battle!, use) };
  }
  if (b.stage === 'retreat' && b.retreat?.side === side) {
    const o = E.retreatOptions(g, b), foeSide = E.other(side);
    const r = best(o, (x) => (x === E.SEA ? -5 : E.blocks(g, x, side).length * 0.8 + worth(g, x, side) - near(g, x, foeSide, side) * 0.4 + (E.inSupply(g, side, x) ? 1 : 0)))!;
    return { label: 'retreat', area: r.x, run: (x) => E.chooseRetreat(x, x.battle!, r.x) };
  }
  if (b.stage === 'exploit' && att) return { label: 'exploitation check', roll: true, run: (x) => E.roll_step(x, x.battle!) };
  if (['attArty', 'offFire'].includes(b.stage) ? att : ['defArty', 'defFire'].includes(b.stage) ? !att : false) return { label: 'roll', roll: true, run: (x) => E.roll_step(x, x.battle!) };
  return null;
}

/* ================= supply ================= */
function supply(g: Game, side: Side): Action | null {
  if (g.phasing !== side) return null;
  const air = avail(g, side).find((c) => c.kind === 'air_mission');
  if (air && g.supplyPending && !g.airSupply) {
    const ar = CUR.id === 'bulge' ? E.airSupplyAreas(g, side) : CUR.id === 'sicily' ? [...new Set(own(g, side).filter((u) => u.unsupplied).map((u) => u.area!))] : [];
    const b = best(ar, (a) => steps(g, a, side, side) + worth(g, a, side)); if (b && b.s >= 2) return { label: 'air supply', chit: air.id, area: b.x, run: (x) => (CUR.id === 'bulge' ? E.playAirSupply(x, air.id, b.x) : S.airSupply(x, air.id, b.x)) };
  }
  if (g.supplyPending) return { label: 'supply checks', roll: true, run: (x) => E.rollSupply(x) };
  return null;
}
