// FAB Vol. III, Golan '73, on the series engine: the scenario set-ups (22.1, 22.2), the exclusive rules as the volume hooks the
// series engine calls (movement 14.x via ../golan/move.ts, the Combat Play Aid numbers via ../golan/combat.ts, strongpoints 15.6,
// ghosts 15.7, air assault 15.3, SAMs 16.12, commando raids 16.11, the Purple Line releases 15.2/15.4, supply 14.9, victory 19.x)
// and the player actions that exist only in this volume (engineering 14.5, air missions 16.31, events 17.x, Special Action uses
// 14.61, the alternate set-up). Everything else — the turn sequence, battles, retreats, reserves, arrivals — is the series engine.
// This file keeps the volume's state, data and small helpers, and registers its hooks at the end. The rules themselves are in the
// files listed below (golan-setup, -scenarios, -moves, -turn, -combat, -optional, -actions), which were part of this file until November 2026: each
// `export * from` line passes a file's names on, so the table and the tests go on using everything through this one. THE ORDER OF
// THOSE LINES MATTERS: they load in that order, before this file's own code; a file may take from this one what it uses later,
// inside its functions, but not a value it needs while loading (rule and tool: the top of ../game.ts, web/scripts/move-code.mjs).
import unitsJson from '../../../data/golan73/units.json';
import countersJson from '../../../data/golan73/counters.json';
import setupsJson from '../../../data/golan73/setups.json';
import trackJson from '../../../data/golan73/turn_track.json';
import { areas, connection, edgeKey } from '../map';
import { ASSEMBLY, ENTRY, HERMON, NAF_NORTH, REAR, eastOfSam, isAssembly } from '../golan/map';
import { type Quality } from '../golan/combat';
import { type Chit } from '../chits';
import { registerHooks, type Volume } from '../volumes';
import { chit, other, quality, saAvailable, supplied, unitsIn, type Battle, type Game, type Side, type Unit } from '../game';
import { afterDeploy, newGolanGame } from './golan-setup';
export * from './golan-setup';
import { NAF, nafakhStaff } from './golan-scenarios';
export * from './golan-scenarios';
import { afterMove, beforeMove, golanReach, interdictedBy, keepAssigned, stratStep } from './golan-moves';
export * from './golan-moves';
import { finalResult, golanVictory, onPhase, reinforce, resolveDugman, sources, supplyStep } from './golan-turn';
export * from './golan-turn';
import {
  adjustFire,
  afterFire,
  beforeBegin,
  beforeFire,
  canAssign,
  golanMoraleSn,
  golanSuccessNumber,
  onAssign,
  onBattle,
  onUnassign,
} from './golan-combat';
export * from './golan-combat';
import {
  absorbLoss,
  assault,
  freeBattle,
  ghostRoom,
  GOLAN_OPTIONAL,
  lossAsset,
  lossOk,
  onRetreat,
  recoverOk,
  retreatOk,
  retreatPrefer,
} from './golan-optional';
export * from './golan-optional';
import { reinforceOptions } from './golan-actions';
export * from './golan-actions';
export { ASSEMBLY, HERMON, NAF_NORTH, REAR, isAssembly, eastOfSam };
/** The Golan rule book's own optional rules (18.2–18.5; 18.1 is the series' fwMaintain), each off unless chosen. */
declare module '../game' {
  interface Opts {
    withdrawal?: boolean /** 18.2 leaving a contested area last takes a morale check */;
    artyInterdict?: boolean /** 18.31 artillery interdiction in the Admin Phase */;
    directSupport?: boolean /** 18.32 Israeli artillery as direct combat support (+1 to the point unit) */;
    syrianAirAttack?: boolean /** 18.4 Syrian close air support only when Syria attacks */;
    israeliDivisions?: boolean /** 18.5 Israeli divisional organization (the 15.12 mixing penalty for Israel) */;
  }
}

/* ================= the volume's own state ================= */
export interface GolanState {
  minefields: string[];
  bridgedDitch: string[]; // mined boundaries (14.02), AT Ditch Bridged markers (14.51)
  raids: number[];
  raidPartial: number[]; // commando raid areas (16.11a) and the ones only partly successful (they do not fire back)
  crossed: string[]; // one-unit-per-phase boundaries already used this phase (14.11–14.14)
  minefieldFailed: string[]; // units that failed a minefield check this turn (14.02)
  assaultEntered: Record<number, string[]>; // units that entered an enemy area across an unbridged ditch or river this phase (14.01)
  kingHassan: boolean; // 17.24 in effect
  intel?: { side: Side; area: number }; // 16.31c: enemy blocks a reconnaissance showed, for the rest of the phase
  freeCombatRound: number; // 22.17: Syrian free Breakthrough combat rounds left on turn 1
  purpleLineCrossed: boolean;
  airReleased: number;
  hermonLost: boolean;
  release?: { pick: boolean; place: string[] }; // 15.2/15.4a: the Syrian choice and placements the Israeli move waits for
  airAssaultArea?: number;
  samTarget?: string; // 15.3; 16.12: the Israeli air mission a SAM may answer now
  minesLeft?: number;
  startAt?: 'combat' | 'movement'; // 14.02: minefields the Israeli player still places at the start; the phase the scenario opens with once set up
  nafakh?: { s03Free: boolean; golani: boolean; staffOut: boolean }; // 22.46: the 33rd held back, Golani's release, the HQ Staff lost with Nafakh
  alowda?: { raids: number; cup?: string[]; drawn?: string[] };
  samCancelled?: number[]; // 16.12: areas where a SAM cancelled an Admin-Phase air mission (no replacement this phase)
  withdrew?: string[];
  artyInt?: Side[]; // 18.2: units that already rolled to leave a contested area this phase; 18.31: sides that interdicted with artillery this Admin Phase
  chem?: number;
  ghostsMade?: number; // optional rules: chemical attacks so far (each one after the first gives Israel a VP); ghosts drawn from the Al-Owda cup       // 20.35 the commandos landed at the start; 20.36 the Israeli Reinforcements Draw Cup
}
export interface GolanBattle {
  event: Partial<Record<Side, string>>;
  counterbattery: Partial<Record<Side, string>>;
  ew?: { pending: boolean };
  defLocked?: boolean;
  engBridge?: string;
  chem?: string;
  flank?: string;
  spSwap?: string;
  samCancelled?: boolean;
  dcs?: string[];
} // samCancelled: 16.12; dcs: 18.32 Israeli artillery in direct combat support
export const state = (g: Game) => g.vol as unknown as GolanState;
export const battleState = (b: Battle) => (b.vol ??= { event: {}, counterbattery: {} }) as unknown as GolanBattle;

type RawUnit = {
  id: string;
  name: string;
  side: Side;
  cls?: string | null;
  symbol?: string;
  kind?: string;
  steps?: number;
  quality_by_step?: (Quality | null)[];
  division?: string | null;
  brigade?: string | null;
  start_area?: number;
  arrival_turn?: number;
  entry?: string[];
  initial_steps?: number;
};
type RawChit = {
  id: string;
  ids?: string[];
  kind: string;
  side: Side | 'none';
  name: string;
  turn: number | string | null;
  quality?: Quality | null;
  area?: number;
  brigade?: string;
};
type Setup = {
  units: { id: string; area?: number; box?: string }[];
  reduced?: Record<string, number>;
  holding_boxes?: Record<string, string[]>;
  available?: Record<string, string[]>;
  garrisons?: { id: string; area: number }[];
  strongpoints?: { areas?: number[]; suggested_historical: { area: number; id: string }[] };
  minefields?: { fixed: number[][]; player_placed?: number };
  riverAssault?: number[];
  reserve?: { syrian?: string[] };
  turns: number;
};
export const UNITS = unitsJson as unknown as RawUnit[],
  COUNTERS = countersJson as unknown as RawChit[],
  SETUPS = setupsJson as unknown as Record<string, Setup>;
const TRACK = (trackJson as unknown as { turns: Record<string, { night: boolean }> }).turns;
export const NOT_CHITS = new Set(['minefield', 'marker', 'reserve_marker', 'marker_control', 'field_works', 'marker_at_ditch_bridged']);
export const need = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(msg);
};
/** The Battle for Nafakh (22.4) plays on its own sheet. */
export const isNafakh = (g: Game) => g.opts.scenario === 'nafakh';
/** 20.3 Operation Al-Owda: the original Syrian plan, six daylight turns on the whole map. */
export const isAlOwda = (g: Game) => g.opts.scenario === 'alowda';
export const isNight = (g: Game) => !isNafakh(g) && !isAlOwda(g) && (TRACK[String(g.turn)]?.night ?? false); // Nafakh's four turns and Al-Owda's six are all daylight (20.37: no night turn)
export const q = (u: Unit): Quality => quality(u) ?? 'veteran';
export const regular = (u: Unit) => !u.garrison && !u.fort && !u.ghost;
/** Standing assets are units with the garrison flag; this finds the one a chit stands as. */
const standing = (g: Game, chitId: string) => g.units.find((u) => u.garrison && u.chitId === chitId && u.area != null);
export const raidUnitAt = (g: Game, a: number) =>
  unitsIn(g, a, 'syrian').find((u) => u.garrison && u.chitId && chit(g, u.chitId).kind === 'commando');
export const asGarrison = (c: Chit, prefix: string, a: number, cls: 'armor' | 'infantry' = 'infantry', qual?: Quality): Unit => ({
  id: `${prefix}-${c.id}`,
  name: c.name,
  side: c.side,
  cls,
  q: [qual ?? c.q ?? 'green'],
  max: 1,
  str: 1,
  area: a,
  garrison: true,
  disorder: 0,
  unsupplied: false,
  moved: true,
  reserve: null,
  exploit: false,
  chitId: c.id,
});

/* ================= the volume's own player actions ================= */
export const avail = (g: Game, id: string, kinds: string[]) => {
  const c = chit(g, id);
  need(c.box === 'available' && kinds.includes(c.kind), `${c.name} is not available for this`);
  return c;
};
export const homeArea = (g: Game, side: Side, a: number) => !isAssembly(a) && supplied(g, side, a);
export const vacant = (g: Game, a: number) => !unitsIn(g, a).length;
export const used = (c: Chit) => {
  c.box = 'used';
  c.area = undefined;
};
export const gone = (c: Chit) => {
  c.box = 'eliminated';
  c.area = undefined;
};
export const reduced = (u: Unit) => u.area != null && regular(u) && u.str < u.max;
export const unit = (g: Game, id: string) => {
  const u = g.units.find((x) => x.id === id);
  if (!u) throw new Error(`no unit ${id}`);
  return u;
};
export const nameOf = (a: number) => areas.get(a)?.name ?? String(a);
/** The Israeli areas next to the Purple Line: each takes one strongpoint or ghost (15.7). */
export const PURPLE = SETUPS.badr.strongpoints!.areas!;
export const SUGGESTED = SETUPS.badr.strongpoints!.suggested_historical;
/** The Special Actions a side could spend now (the reusable block first). */
export const specialActions = (g: Game, side: Side) => saAvailable(g, side);

registerHooks('golan73', {
  seenBy: (g, u, side) => {
    const i = state(g).intel;
    return !!i && i.side === side && u.side !== side && u.area === i.area;
  }, // 16.31c: the reconnaissance shows the whole area for the rest of the phase
  moveOk: (g, u, a) => !(state(g).kingHassan && u.id === 'S07' && !isAssembly(a) && g.control[a] === 'israeli'), // 17.24: also by Special Action
  newGame: newGolanGame as Volume['newGame'],
  markerKey: () => 'res',
  reach: golanReach,
  beforeMove,
  afterMove,
  stratAllowed: (g, u) => interdictedBy(g, u.area!) !== other(u.side) && !(isNight(g) && g.stratMoves >= (u.side === 'israeli' ? 2 : 1)),
  stratStep, // 14.03: night strat-moves, Israel 2, Syria 1
  afterStrat: (g, _u, path) => {
    g.stratMoves++;
    const V = state(g);
    for (let i = 1; i < path.length; i++) {
      const c = connection(path[i - 1], path[i])!;
      if (c.escarpment || c.rugged) V.crossed.push(edgeKey(path[i - 1], path[i]));
    }
  },
  setupActor: (g, b) => (state(g).samTarget ? 'syrian' : (b.vol as GolanBattle | undefined)?.ew?.pending ? other(b.attacker) : undefined), // read only: battleState() would create the record
  successNumber: golanSuccessNumber,
  adjustFire,
  canAssign,
  moraleSn: golanMoraleSn,
  retreatOk,
  retreatPrefer,
  onRetreat,
  noRetreat: (_g, u) => !!u.garrison, // 16.24: garrisons never retreat (6.42c)

  sources,
  supplyStep,
  supplyFree: (_g, _s, a) => isAssembly(a) || a === HERMON,
  alwaysSupplied: (_g, u) => !!u.ghost || u.id === 'S17',
  victory: golanVictory,
  finalResult,
  onPhase,
  onBattle,
  freeBattle,
  assault,
  reinforce,
  afterDraw: (g) => {
    nafakhStaff(g);
    const d = g.chits.find((c) => c.kind === 'event_dugman5' && c.box === 'available');
    if (d) resolveDugman(g, d);
  },
  afterDeploy,
  onUnassign,
  keepAssigned,
  optional: GOLAN_OPTIONAL,
  absorbLoss,
  lossOk,
  recoverOk,
  ghostsMove: (g) => !!g.opts.advGhosts,
  reinforceOk: (g, b, u) => reinforceOptions(g, b).includes(u.id),
  stackLimit: (_g, a) => (isAssembly(a) ? 99 : 2),
  stackRoom: (g, u, a) => (g.opts.advGhosts && u.side === 'israeli' ? ghostRoom(g, u, a) : undefined),
  firstBattle: (g) => state(g).airAssaultArea,
  pendingSide: (g) => (state(g).release || state(g).samTarget ? 'syrian' : undefined), // the Purple Line release, a SAM answer (16.12)
  allowance: (g, u) => (isNight(g) && u.side === 'syrian' ? (u.cls === 'armor' ? 4 : 1) : u.cls === 'armor' ? 6 : 3),
  appropriate: (g, u) =>
    isNafakh(g)
      ? u.side === 'israeli'
        ? [NAF_NORTH]
        : [REAR, NAF.sheet.entry.Z]
      : u.side === 'israeli'
        ? [ASSEMBLY.A, ASSEMBLY.B]
        : Object.values(ENTRY),
  isNight,
  onAssign,
  beforeBegin,
  beforeFire,
  afterFire,
  lossAsset, // 18.32: a supporting artillery asset may take a step loss (series loss pool)
} as Partial<Volume>);
