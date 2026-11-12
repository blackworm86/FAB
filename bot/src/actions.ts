// Every choice a player has, generated from the engine's own functions and option lists, so the computer can never
// miss a kind of move (reserves, breakthroughs, bridges, Special Actions, ...). The Bulge first; other games later.
// An Action is a call of one public engine function: E[fn](game, ...args). BATTLE stands for the open battle.
import * as E from '../../engine/src';
import type { Game, Side, Battle } from '../../engine/src';

export const BATTLE = '@battle';
export type Arg = string | number | boolean | null | undefined | (string | number)[];
export interface Action { side: Side; fn: string; args: Arg[] }

const ENGINE = E as unknown as Record<string, (g: Game, ...a: unknown[]) => unknown>;

/** Carry out an action on a game. `real` turns a view's opaque block ids into real ones (the table's job). Throws if illegal. */
export function apply(g: Game, a: Action, real: (id: string) => string = (x) => x): unknown {
  const f = ENGINE[a.fn]; if (typeof f !== 'function') throw new Error(`unknown engine function ${a.fn}`);
  const map = (x: Arg): unknown => (x === BATTLE ? g.battle : typeof x === 'string' ? real(x) : Array.isArray(x) ? x.map((y) => (typeof y === 'string' ? real(y) : y)) : x);
  E.useGame(g.game ?? 'bulge'); E.setPlayArea(g.inPlay);
  return f(g, ...a.args.map(map));
}

/** True if the action is legal in this game: tried on a copy. */
export function isLegal(g: Game, a: Action): boolean {
  try { apply(structuredClone(g), a); return true; } catch { return false; }
}

/** The complete list of legal actions for `side` now (empty when it is not that side's turn to act). */
export function legalActions(g: Game, side: Side): Action[] { return candidates(g, side).filter((a) => isLegal(g, a)); }

/** Which sides may act now. In the Admin and Reinforcement Phases both work: the other side says it is done, then the Phasing Player ends the phase. */
export function actors(g: Game): Side[] {
  if (g.over) return [];
  if (!g.battle && !g.pendingBlow && (g.recover.length || g.artyPick)) return [...new Set([...g.recover, ...(g.artyPick ? ['german' as Side] : [])])];   // 4.1a, 16.12: answered first, by each side that owes one, in any order
  const w = E.actorOf(g); if (w !== 'both') return [w];
  const o = E.other(g.phasing);
  return g.done?.includes(o) ? [g.phasing] : [o, g.phasing];
}

/** Everything `side` might do now, from the engine's option lists; some still fail the engine's checks (isLegal filters). */
export function candidates(g: Game, side: Side): Action[] {
  if (!actors(g).includes(side)) return [];
  const out: Action[] = [], add = (fn: string, ...args: Arg[]) => out.push({ side, fn, args });
  const avail = E.boxOf(g, side, 'available'), mine = g.units.filter((u) => u.side === side), onMap = mine.filter((u) => u.area != null);
  const sas = (ech?: string, area?: number): (string | undefined)[] => { const l = E.saAvailable(g, side, ech, area).map((c) => c.id); return l.length ? l : [undefined]; };
  const areas = [...E.areas.keys()].filter((a) => !g.inPlay || g.inPlay.includes(a));

  // decisions that wait for an answer before anything else
  if (g.pendingBlow) { for (const v of [true, false]) add('resolveBlow', v); return out; }
  if (g.recover.includes(side)) { add('recoverAsset', side, null); for (const c of E.boxOf(g, side, 'used')) if (E.isAsset(c)) add('recoverAsset', side, c.id); return out; }
  if (g.artyPick) { if (side === 'german') for (const c of E.boxOf(g, side, 'used')) if (c.kind === 'artillery') add('chooseArtyLoss', c.id); return out; }
  if (g.battle) { battle(g, g.battle, side, add, sas); return out; }

  const ph = g.phase, end = () => (side === g.phasing ? add('endPhase') : add('setDone', side, true));
  if (ph === 'reinforcement') {
    for (const id of side === 'allied' ? g.tfNew ?? [] : []) for (const a of areas) add('placeTaskForce', id, a);
    for (const id of g.pendingArrivals) { const u = mine.find((x) => x.id === id); if (u) for (const o of E.arrivalOptions(g, id)) for (const c of o.sa ? sas(u.ech) : [undefined]) add('placeArrival', id, o.area, c); }
    for (const id of g.arrived) { const u = mine.find((x) => x.id === id); if (u) for (const a of E.rerouteOptions(g, id)) for (const c of sas(u.ech)) add('reroute', id, a, c); }
    end();
  } else if (ph === 'admin') {
    for (const c of avail) adminPlays(g, side, c, areas, add);
    for (const a of areas) if (g.control[a] === side) for (const c of sas()) add('rally', side, a, c);
    for (const u of onMap) if (u.str < u.max) for (const c of sas(u.ech, u.area!)) add('qualityReplacement', u.id, c);
    end();
  } else if (ph === 'movement' || ph === 'reaction' || ph === 'btMove') {
    if (g.moving) add('endMove');
    for (const u of onMap) {
      for (const o of E.moveOptions(g, u.id)) add('move', u.id, o.area, true);
      add('buildFieldWorks', u.id);
      if (ph === 'movement' && (u.reserve ? true : E.canReserve(g, u))) add('setReserve', u.id, !u.reserve);
      if (ph === 'btMove') { for (const c of sas(u.ech, u.area!)) add('activateBreakthrough', u.id, c); if (E.peiperCan(g, u)) add('setPeiperFull', u.id, true); }
    }
    add('endPhase');
  } else if (ph === 'strategic') {
    for (const u of onMap) for (const a of E.stratOptions(g, u.id)) add('stratMove', u.id, a);
    add('endPhase');
  } else if (ph === 'combat' || ph === 'btCombat') {
    const must = E.mustFight(g), fresh = E.newlyContested(g);
    for (const a of must.length ? must : E.contestedAreas(g).filter((x) => !g.fought.includes(x))) {
      if (ph === 'btCombat' && !fresh.includes(a)) { for (const c of sas(undefined, a)) add('startBattle', a, true, c); }       // 8.23: a breakthrough battle in an old contested area costs a Special Action
      else add('startBattle', a, ph === 'btCombat');
    }
    add('endPhase');
  } else if (ph === 'supply') {
    for (const c of avail) if (c.kind === 'air_mission') for (const a of E.airSupplyAreas(g, side)) add('playAirSupply', c.id, a);
    if (g.supplyPending) add('rollSupply');
    add('endPhase');
  } else if (ph === 'deploy') end();
  return out;
}

/** The Admin Phase plays of one chit (16.1, 17.x, 8.32, 4.21), by kind. */
function adminPlays(g: Game, side: Side, c: E.Chit, areas: number[], add: (fn: string, ...a: Arg[]) => void) {
  const mine = g.units.filter((u) => u.side === side), enemy = g.units.filter((u) => u.side !== side && u.area != null);
  const k = c.kind;
  if (k === 'engineer') for (const a of areas) {
    const bt = E.bridgeTargets(g, side, a);
    bt.forEach((t, i) => { add('blowBridges', c.id, a, [t]); for (const t2 of bt.slice(i + 1)) add('blowBridges', c.id, a, [t, t2]); });
    for (const t of E.repairTargets(g, side, a)) add('repairBridge', c.id, a, t);
    if (E.blocks(g, a, side).length) add('fieldWorksFor', c.id, a);
  }
  if (k === 'engineer') for (const a of E.roadblockAreas(g, side)) for (const d of [false, true]) add('roadblock', c.id, a, d);
  if (k.startsWith('replacement') || k.startsWith('rebuild') || k === 'event_arriving_regiment') for (const u of mine) if (E.eligibleForStep(c, u)) add('playReplacement', c.id, u.id);
  if (k.startsWith('rebuild')) for (const u of mine) if (u.area == null && u.str === 0) for (const a of areas) if (g.control[a] === side) add('playRebuild', c.id, u.id, a);
  if (k === 'command_staff') {
    for (const u of mine) if (u.area != null) { add('staffReplacement', c.id, u.id); add('staffReserve', c.id, u.id); if (side === 'german') add('staffBoundary', c.id, u.id); }
    if (side === 'allied') for (const a of areas) add('staffPool', c.id, a);
    for (const u of enemy) add('staffIntel', c.id, u.id);
  }
  if (k === 'air_mission') for (const a of areas) add('playInterdiction', c.id, a);
  if (k === 'event_greif_bridge') for (const a of areas) for (const b of E.neighbors(a)) if (a < b) add('playGreifBridge', c.id, a, b);
  if (k === 'event_greif_interdict') for (const u of enemy) add('playInterdict', c.id, u.id);
  if (k === 'event_bodenplatte') add('playBodenplatte', c.id);
  if (k === 'event_release') for (const a of [4, 6]) add('releaseUnit', c.id, a);
  if (E.heydteWindow(g, c)) for (const a of [31, 52]) add('heydteDrop', c.id, a);
  if (E.isEvent(c) && k !== 'event_delayed_response') {
    const back = E.alternateCandidates(g, side).map((x) => x.id);
    if (back.length <= 2) add('alternateUse', c.id, back);
    else back.forEach((x, i) => back.slice(i + 1).forEach((y) => add('alternateUse', c.id, [x, y])));
  }
}

/** A battle's choices for `side` (6.2-6.8): Special Actions, assets, point unit, the rolls and every decision after them. */
function battle(g: Game, b: Battle, side: Side, add: (fn: string, ...a: Arg[]) => void, sas: (ech?: string, area?: number) => (string | undefined)[]) {
  const att = b.attacker, def = E.other(att), here = E.unitsIn(g, b.area, side).filter((u) => !u.garrison && !u.ghost);
  switch (b.stage) {
    case 'setup':
      if (b.defSA) {
        if (side !== def) return;
        add('passSA', BATTLE);
        for (const c of sas(undefined, b.area)) add('defenderRetreatSA', BATTLE, c);
        for (const n of E.neighbors(b.area)) for (const u of E.unitsIn(g, n, def)) if (!u.garrison) for (const c of sas(u.ech, b.area)) add('defenderReinforceSA', BATTLE, u.id, c);
        return;
      }
      if (E.setupSide(g, b) !== side) return;
      for (const c of E.boxOf(g, side, 'available')) {
        if (c.kind !== 'air_mission') { if (E.canAssign(g, b, side, c) == null) add('assign', BATTLE, c.id); continue; }
        if (E.canAssign(g, b, side, c, 'arty') == null) add('assign', BATTLE, c.id, 'arty');
        if (E.canAssign(g, b, side, c, 'support') == null) for (const u of [...here, null]) add('assign', BATTLE, c.id, 'support', u?.id);
      }
      for (const id of b.assets[side] ?? []) add('unassign', BATTLE, id);
      for (const u of here) if (side !== att || !u.disorder) add('setPoint', BATTLE, side, u.id);
      if (side === att) { add('setEngFw', BATTLE, !b.engFw); add('cancelBattle'); }
      add('setReady', BATTLE, side);
      return;
    case 'loss': for (const k of E.lossOptions(g, b)) add('chooseLoss', BATTLE, k); add('autoLosses', BATTLE); return;
    case 'attFirst': for (const k of [b.attPoint, ...b.assets[att].filter((id) => E.isBattleAsset(E.chit(g, id)))]) add('chooseFirstLoss', BATTLE, k); return;
    case 'attChoice': for (const v of [false, true]) add('attackerChoice', BATTLE, v); return;
    case 'defChoice': for (const v of [false, true]) add('defenderChoice', BATTLE, v); return;
    case 'retreat': for (const a of E.retreatOptions(g, b)) add('chooseRetreat', BATTLE, a); return;
    case 'exploit': add('declineExploit', BATTLE); add('roll_step', BATTLE); return;
    case 'done': add('closeBattle'); return;
    default: add('roll_step', BATTLE);
  }
}
