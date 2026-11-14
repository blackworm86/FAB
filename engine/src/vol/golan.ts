// FAB Vol. III, Golan '73, on the series engine: the scenario set-ups (22.1, 22.2), the exclusive rules as the volume hooks the
// series engine calls (movement 14.x via ../golan/move.ts, the Combat Play Aid numbers via ../golan/combat.ts, strongpoints 15.6,
// ghosts 15.7, air assault 15.3, SAMs 16.12, commando raids 16.11, the Purple Line releases 15.2/15.4, supply 14.9, victory 19.x)
// and the player actions that exist only in this volume (engineering 14.5, air missions 16.31, events 17.x, Special Action uses
// 14.61, the alternate set-up). Everything else — the turn sequence, battles, retreats, reserves, arrivals — is the series engine.
import unitsJson from '../../../data/golan73/units.json';
import countersJson from '../../../data/golan73/counters.json';
import setupsJson from '../../../data/golan73/setups.json';
import trackJson from '../../../data/golan73/turn_track.json';
import { areas, connection, edgeKey, neighbors } from '../map';
import { ASSEMBLY, ENTRY, HERMON, NAF_NORTH, REAR, eastOfSam, isAssembly, area as garea, type GSide } from '../golan/map';
import { reachable, type GMoveCtx } from '../golan/move';
import {
  assetLimits,
  brigadeExtraDie,
  moraleSn as gMoraleSn,
  samResult,
  successNumber as gSuccessNumber,
  type GShooter,
  type GTarget,
  type Quality,
} from '../golan/combat';
import { isArty, isBattleAsset, type Chit } from '../chits';
import { registerHooks, type Volume } from '../volumes';
import {
  airOf,
  blocks,
  buildFieldWorks,
  chit,
  contested,
  dropAir,
  dropReserve,
  eliminate,
  fighters,
  inSupply,
  moraleCheck,
  needAdmin,
  other,
  quality,
  rollDie,
  say,
  saAvailable,
  sidesOf,
  spendSA,
  supplied,
  unitsIn,
  updateControl,
  type Battle,
  type Game,
  type Side,
  type Unit,
  type Fire,
  type OptionalRule,
} from '../game';
import type { Shooter, Target, Setting } from '../combat';
import { afterDeploy, newGolanGame, reservesLeft, setupReserves } from './golan-setup';
export * from './golan-setup';
import { alowdaCommandos, alowdaDraw, alowdaRaidAreas, NAF, nafakhResult, nafakhStaff, strengthIn, VP_EAST } from './golan-scenarios';
export * from './golan-scenarios';
import {
  afterMove,
  asMover,
  beforeMove,
  evacuateStrongpoint,
  golanReach,
  interdictedBy,
  keepAssigned,
  releaseAreas,
  releaseUnit,
  stratStep,
} from './golan-moves';
export * from './golan-moves';
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
const q = (u: Unit): Quality => quality(u) ?? 'veteran';
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

/* ================= supply (9.31, 14.93–14.95) and victory (19.x) ================= */
const sources = (g: Game, side: Side) =>
  new Set(
    isNafakh(g)
      ? NAF.sheet.supply[side]
      : side === 'syrian'
        ? Object.values(ENTRY)
        : [...areas.values()].filter((a) => a.supply).map((a) => a.id),
  ); // 22.46: the sources printed on the Nafakh sheet
function supplyStep(g: Game, side: Side, a: number, n: number, first: boolean) {
  if (isAssembly(n)) return isNafakh(g) && n === REAR && side === 'syrian'; // the Syrian Rear Area is the Nafakh sheet's Syrian supply source
  const c = connection(a, n)!,
    key = edgeKey(a, n);
  if (c.hermon) return false;
  if (c.river && g.blown.includes(key) && !first) return false; // 9.31a
  if (c.atDitch && !state(g).bridgedDitch.includes(key) && !first) return false; // 14.93
  if (c.escarpment && c.type !== 'road') return false;
  if (side === 'syrian' && state(g).minefields.includes(key)) return false;
  return true;
}
/** 19.1–19.2: Syria scores its objective areas (held, supplied and occupied) and the mutual stars; Israel the mutual stars and each supplied area it holds in Syria; one point per large enemy unit destroyed. */
function golanVictory(g: Game): Record<Side, number> & { net: number } {
  if (isNafakh(g)) {
    const s = strengthIn(g, 'syrian'),
      i = strengthIn(g, 'israeli');
    return { syrian: s, israeli: i, net: s - i };
  } // 22.47: the score is the strength in Nafakh
  const pts: Record<Side, number> = { syrian: 0, israeli: 0 };
  for (const id of g.elimLarge) {
    const u = g.units.find((x) => x.id === id)!;
    pts[other(u.side)]++;
  }
  for (const a of areas.values()) {
    if (isAssembly(a.id)) continue;
    const ctl = g.control[a.id];
    if (!ctl || !inSupply(g, ctl, a.id)) continue;
    if (ctl === 'syrian' && unitsIn(g, a.id, 'syrian').some(regular)) pts.syrian += a.vp.syrian + (a.vp.mutual ? 1 : 0);
    if (ctl === 'israeli') pts.israeli += (a.vp.mutual ? 1 : 0) + ((isAlOwda(g) ? VP_EAST.has(a.id) : garea(a.id).syria) ? 1 : 0); // 20.38: Al-Owda counts east of its Israeli VP Line, not the Purple Line
  }
  pts.israeli += Math.max(0, (state(g).chem ?? 0) - 1); // chemical warfare after the first use
  return { ...pts, net: pts.syrian - pts.israeli };
}
const finalResult = (g: Game, net: number) =>
  isNafakh(g)
    ? nafakhResult(g)
    : net === 0
      ? 'Draw (0 net VP)'
      : `${net > 0 ? 'Syrian' : 'Israeli'} ${Math.abs(net) >= 3 ? 'Operational' : 'Marginal'} Victory (${Math.abs(net)} net VP)`;
/** 14.17: west of the Jordan = Gadot, Kfar Hanasi and Almagor. The rule book prints "areas 6, 7, 8"; the map numbers them 6, 9, 10 (docs/NOTES.md). */
export const WEST_OF_JORDAN = [6, 9, 10];
/** 19.5: a supplied Syrian unit west of the Jordan at the end of an Israeli player turn. */
const jordanCrossed = (g: Game) =>
  g.units.some(
    (u) => u.side === 'syrian' && regular(u) && u.area != null && WEST_OF_JORDAN.includes(u.area) && inSupply(g, 'syrian', u.area),
  );

/* ================= phases ================= */
function onPhase(g: Game, phase: string, when: 'start' | 'mid' | 'end') {
  const V = state(g);
  nafakhStaff(g);
  if (when === 'end' && V.release) throw new Error('Syria first places the units released at the Purple Line (15.2)');
  if (phase === 'reinforcement' && when === 'start') V.minefieldFailed = [];
  if (phase === 'strategic' && when === 'start') V.crossed = []; // each phase counts its own crossings
  if ((phase === 'movement' || phase === 'btMove' || phase === 'reaction') && when === 'start') {
    V.crossed = [];
    V.assaultEntered = {};
    V.withdrew = [];
  }
  if (phase === 'admin' && when === 'start') V.artyInt = [];
  if (phase === 'deploy' && when === 'end' && g.units.some((u) => u.box === 'deploy')) throw new Error('place every unit first');
  if (phase === 'deploy' && when === 'end' && V.minesLeft)
    throw new Error(`place the Israeli minefields first (${V.minesLeft} left, 14.02)`);
  if (phase === 'deploy' && when === 'end')
    for (const sd of sidesOf(g))
      if (setupReserves(g, sd).all && reservesLeft(g, sd))
        throw new Error(`place the ${sd === 'israeli' ? 'Israeli' : 'Syrian'} reserve markers first (${reservesLeft(g, sd)} left)`);
  if (phase === 'deploy' && when === 'end' && alowdaRaidAreas(g).length)
    throw new Error(`land the Syrian commandos first (${alowdaCommandos(g).length} left, 20.35)`);
  if (phase === 'admin' && when === 'end' && V.samTarget)
    throw new Error('Syria must answer the Israeli air mission first: fire a SAM or let it fly (16.12)');
  if (phase === 'admin' && when === 'end') V.intel = undefined;
  if (phase === 'admin' && when === 'start') V.samCancelled = [];
  if (phase === 'supply' && when === 'mid' && g.phasing === 'israeli') {
    // 16.31b: interdiction lasts to the second player's Supply Phase
    g.interdicted = {};
    for (const c of g.chits)
      if (c.mission === 'interdiction' && c.box === 'map') {
        c.box = 'used';
        c.area = undefined;
        c.mission = undefined;
      }
  }
  if (phase === 'supply' && when === 'end' && g.phasing === 'israeli' && !isNafakh(g) && !isAlOwda(g) && jordanCrossed(g))
    g.over = 'Syrian Automatic Victory: a supplied Syrian unit west of the Jordan (19.5)';
}
/** The Reinforcement Phase's Golan extras: the SAM barrier reduction (16.12) and the units released into the Arriving box. */
function reinforce(g: Game, side: Side) {
  if (side === 'israeli') alowdaDraw(g);
  if (side === 'syrian') {
    const sams = g.chits.filter((c) => c.kind === 'sam' && c.box === 'used'),
      rolls = sams.map(() => rollDie(g));
    if (rolls.some((r) => r >= 6)) {
      sams[0].box = 'eliminated';
      samEliminated(g);
      say(g, `SAM reduction rolls ${rolls.join(', ')}: one SAM asset is eliminated (16.12)`, side);
    }
  }
  for (const u of g.units)
    if (u.side === side && u.box === 'arriving') {
      u.box = undefined;
      u.arrival = g.turn;
    }
}
/** 16.23: the first three SAM losses each bring a conditional Israeli air support asset into the cup. */
export function samEliminated(g: Game) {
  const V = state(g);
  if (V.airReleased >= 3) return;
  const c = g.chits.find((x) => x.box === 'air_support_holding');
  if (c) {
    c.box = 'cup';
    V.airReleased++;
  }
}
/** 17.22 Operation Dugman 5: must be played when drawn; one die per Syrian SAM in the Available Box. */
export function resolveDugman(g: Game, c: Chit) {
  c.box = 'eliminated';
  say(g, 'Operation Dugman 5 is played (17.22)', 'israeli');
  if (!g.chits.some((x) => x.kind === 'sam' && x.box === 'available'))
    say(g, 'Dugman 5: no SAM in the Syrian Available Box, no effect', 'israeli');
  for (const sam of g.chits.filter((x) => x.kind === 'sam' && x.box === 'available')) {
    const die = rollDie(g);
    if (die === 1) {
      sam.box = 'eliminated';
      samEliminated(g);
      say(g, `Dugman 5: ${die}, great success: a SAM battery is destroyed`, 'israeli');
    } else if (die <= 3) {
      sam.box = 'cup';
      say(g, `Dugman 5: ${die}, limited success: a SAM goes back into the cup`, 'israeli');
    } else if (die <= 9) say(g, `Dugman 5: ${die}, failure`, 'israeli');
    else {
      const air =
        g.chits.find((x) => x.kind === 'air_mission' && x.side === 'israeli' && x.box === 'available') ??
        g.chits.find((x) => x.kind === 'air_mission' && x.side === 'israeli' && x.box === 'cup');
      if (air) air.box = 'eliminated';
      say(g, `Dugman 5: ${die}, a really bad idea: an Israeli air asset is lost`, 'israeli');
    }
  }
}

/* ================= combat (Combat Play Aid, 15.12, 15.51, 16.12, 16.21, 16.22, 16.24, 17.33, 17.34) ================= */
const golanSuccessNumber = (s: Shooter, t: Target, c: Setting) =>
  gSuccessNumber(s as unknown as GShooter, t as GTarget, {
    firerIsAttacker: c.attacker,
    tdn: c.tdn,
    assault: c.riverAssault,
    night: c.night,
  });
export const golanMoraleSn = (g: Game, u: Unit, why: 'exploit' | 'supply' | 'check') =>
  gMoraleSn(q(u), {
    disordered: u.disorder > 0,
    unsupplied: why === 'supply' || u.unsupplied,
    nightExploitation: why === 'exploit' && isNight(g),
  });
const mixedDivisions = (g: Game, a: number, side: Side = 'syrian') =>
  new Set(
    unitsIn(g, a, side)
      .filter((u) => regular(u) && u.division)
      .map((u) => u.division),
  ).size > 1; // 15.12; 18.5 (optional) for Israel
/** How many assets a side may commit here (6.22/6.23, 15.12 mixed Syrian divisions, 16.21 Mt Hermon, 16.22 Israeli air against SAMs). */
export function limits(g: Game, b: Battle, side: Side) {
  const V = state(g);
  if (g.control[HERMON] === 'syrian') V.hermonLost = true; // 16.21: for the rest of the game
  const hermon = side === 'israeli' && !V.hermonLost && g.control[HERMON] === 'israeli' && unitsIn(g, HERMON, 'israeli').length > 0;
  const samUp = g.chits.some((c) => c.kind === 'sam' && c.box === 'available');
  const lim = assetLimits(side as GSide, side === b.attacker, {
    mixedDivisions: (side === 'syrian' || !!g.opts.israeliDivisions) && mixedDivisions(g, b.area, side),
    israeliHoldsHermon: hermon,
    eastOfSamBarrier: eastOfSam(b.area),
    samAvailable: samUp,
  });
  const alone = unitsIn(g, b.area, side).every((u) => u.garrison); // 4.35, 16.24, 16.11a, 17.23: a garrison, raid or Lt. Zvika fighting alone
  return alone ? { ...lim, artillery: 1, battle: 0, events: 0, air: 0, alone } : { ...lim, alone };
}
function canAssign(g: Game, b: Battle, side: Side, c: Chit, mode?: 'arty' | 'support'): string | null {
  const V = state(g),
    B = battleState(b);
  if (side !== b.attacker && B.ew?.pending) return 'answer the jamming first (17.33)';
  if (side !== b.attacker && B.defLocked) return 'all defending units are jammed: no artillery, air, SAM or battle assets (17.33)';
  const lim = limits(g, b, side),
    mine = b.assets[side].map((id) => chit(g, id));
  if (lim.alone && !isArty(c)) return 'a standing asset fighting alone gets one artillery asset only (4.35)';
  if (c.kind === 'air_mission') {
    if (lim.battle === 0 && (mode ?? 'arty') === 'support') return 'mixed divisions: air support may only fire as artillery (15.12)'; // 16.31a, 16.22; air needs no supply
    if (isNight(g)) return 'no air support on the night turn (14.03)';
    if (g.opts.syrianAirAttack && side === 'syrian' && b.attacker !== 'syrian')
      return 'Syrian air support flies close air support only when Syria attacks (18.4)';
    if (side === 'israeli' && B.samCancelled)
      return 'a SAM cancelled the air mission here: no replacement air asset in this battle (16.12)';
    const air = airOf(b, side);
    if (air.length >= lim.air) return lim.air === 2 ? 'at most two air support assets' : 'one air support asset per battle';
    if (air.length === 1 && air[0].mode === (mode ?? 'arty'))
      return 'with two air assets, one fires as artillery and the other supports a unit (16.22)';
    return null;
  }
  if (V.airAssaultArea === b.area && side === 'syrian' && !inSupply(g, side, b.area))
    return 'an air assault that cannot trace supply gets only one air support asset (15.3)';
  if (!inSupply(g, side, b.area) || unitsIn(g, b.area, side).some((u) => u.unsupplied))
    return 'units that cannot trace supply may not have assets (9.34a)';
  const hermonOk = (x: Chit) =>
    ['infantry_asset', 'commando', 'engineer'].includes(x.kind) || (x.kind === 'task_force' && x.name.includes('infantry')); // 13.3 infantry class
  if (b.area === HERMON && !hermonOk(c)) return 'on Mt Hermon only infantry-class battle assets and air support (14.16)';
  if (isArty(c)) return mine.filter(isArty).length >= lim.artillery ? `at most ${lim.artillery} artillery asset(s)` : null;
  if (isBattleAsset(c)) {
    if (c.kind === 'commando' && c.side !== 'syrian') return 'Syrian only';
    return mine.filter(isBattleAsset).length >= lim.battle
      ? lim.battle
        ? `at most ${lim.battle} battle assets`
        : side === 'syrian'
          ? 'mixed Syrian divisions: no battle assets (15.12)'
          : 'mixed Israeli divisions: no battle assets (18.5)'
      : null;
  }
  return 'this counter is not assigned to battles (events come with the event rules)';
}
const samAvailable = (g: Game) => g.chits.some((c) => c.kind === 'sam' && c.box === 'available');
/** 16.12: an Israeli air asset placed east of the SAM barrier may be answered at once by an available SAM. */
function onAssign(g: Game, b: Battle, c: Chit) {
  if (
    c.kind === 'air_mission' &&
    c.side === 'israeli' &&
    eastOfSam(b.area) &&
    samAvailable(g) &&
    !(b.attacker === 'israeli' && battleState(b).defLocked)
  )
    state(g).samTarget = c.id;
} // 17.33: a jammed defence fires no SAM
function beforeBegin(g: Game, b: Battle) {
  if (state(g).samTarget) throw new Error('the SAM answer to the air mission is pending (16.12)');
  if (battleState(b).ew?.pending) throw new Error('the Defender must answer the jamming first (17.33)');
}
/** The air mission taken back (or its battle withdrawn): no SAM answer is pending any more. */
function onUnassign(g: Game, b: Battle, c: Chit) {
  const V = state(g),
    B = battleState(b);
  if (V.samTarget === c.id) V.samTarget = undefined;
  if (B.dcs) B.dcs = B.dcs.filter((x) => x !== c.id);
}
function onBattle(g: Game, b: Battle, when: 'begin' | 'end') {
  const V = state(g);
  if (when === 'begin')
    for (const u of unitsIn(g, b.area))
      if (u.ghost) {
        u.area = null;
        u.str = 0;
        say(g, `A Ghost is revealed in ${areas.get(b.area)!.name} and removed (15.7)`);
      }
  if (when === 'end') {
    for (const u of g.units)
      if (u.rec) {
        u.rec = 0;
        if (u.area != null && u.disorder === 0) u.disorder = 2;
      } // artillery vs armour: one marker stays, the unit recovers in the Supply Phase
    if (V.airAssaultArea === b.area) V.airAssaultArea = undefined;
    V.raids = V.raids.filter((a) => raidUnitAt(g, a));
    V.raidPartial = V.raidPartial.filter((a) => raidUnitAt(g, a));
    if (g.control[HERMON] === 'syrian') V.hermonLost = true;
  }
}
/** Brigade integrity (15.51), the Moroccans' passivity (17.24), a partly successful raid (16.11a) and an engineer bridging instead of firing (14.51b). */
function adjustFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground', list: Fire[]) {
  optionalFire(g, b, side, kind, list);
  if (kind !== 'ground') return;
  const V = state(g),
    B = battleState(b),
    drop = (f: (x: Fire) => boolean) => {
      for (let i = list.length - 1; i >= 0; i--) if (f(list[i])) list.splice(i, 1);
    };
  if (side === b.attacker && V.kingHassan) drop((f) => f.key === 'S07');
  if (side === 'syrian' && V.raidPartial.includes(b.area))
    drop((f) => {
      const u = g.units.find((x) => x.id === f.key);
      return !!u?.garrison && !!u.chitId && chit(g, u.chitId).kind === 'commando';
    });
  if (side === b.attacker && B.engBridge) {
    const i = list.findIndex((f) => f.isAsset && b.assets[side].includes(f.key) && chit(g, f.key).kind === 'engineer');
    if (i >= 0) list.splice(i, 1);
  } // one engineer bridges, the others fire
  if (side === 'israeli') {
    const firers = list
      .filter((f) => !f.isAsset)
      .map((f) => ({ brigade: g.units.find((u) => u.id === f.key)?.brigade, sn: f.sn, side: side as GSide }))
      .filter((x): x is { brigade: string; sn: number; side: GSide } => !!x.brigade);
    for (const x of brigadeExtraDie(firers))
      list.push({
        key: `brigade:${x.brigade}`,
        who: `${x.brigade} brigade integrity`,
        shooter: { kind: 'unit', cls: 'infantry', dice: 1 },
        dice: 1,
        sn: x.sn,
        parts: [['brigade integrity extra die (15.51)', 0]],
        isAsset: true,
      });
  }
}
/** 14.51b: the engineer survived both fire steps: the ditch is bridged as the attackers fire (it does not fire itself). */
function beforeFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground') {
  const B = battleState(b);
  if (kind !== 'ground' || side !== b.attacker || !B.engBridge) return;
  const engineers = b.assets.syrian.filter((id) => chit(g, id).kind === 'engineer').length;
  if (b.engFw && engineers < 2) {
    B.engBridge = undefined;
    say(g, 'The one engineer removes the field works: the ditch is not bridged (6.33, 14.51b)');
    return;
  }
  if (engineers && state(g).bridgedDitch.length < 8) {
    state(g).bridgedDitch.push(B.engBridge);
    say(g, `A Syrian engineer bridges the AT ditch ${B.engBridge} (14.51b)`);
  }
}
/** 17.34 Counterbattery: after the enemy artillery fired, 1–5 sends one of its artillery assets that many turns down the track. */
function afterFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground') {
  const B = battleState(b);
  if (kind === 'ground' && side === b.attacker) B.engBridge = undefined;
  if (kind !== 'arty') return;
  const enemy = other(side);
  if (!B.counterbattery[enemy]) return;
  B.counterbattery[enemy] = undefined;
  const target = b.assets[side].map((id) => chit(g, id)).find(isArty);
  if (!target) return;
  const die = rollDie(g);
  b.rolls.push({ who: 'Counterbattery (17.34)', sn: 5, dice: [die], hits: die <= 5 ? 1 : 0, kind: 'morale' });
  if (die > 5) return say(g, `Counterbattery: ${die}, no effect`, enemy);
  target.box = 'future';
  target.turn = g.turn + die;
  target.direct = true;
  target.area = undefined;
  b.assets[side] = b.assets[side].filter((x) => x !== target.id);
  say(g, `Counterbattery: ${die}, ${target.name} is put back ${die} turn(s), to turn ${g.turn + die} (17.34)`, enemy);
}

/* ================= additional optional rules (the Battle for Nafakh and Al-Owda scenario sheets, 18.x) ================= */
export const GOLAN_OPTIONAL: OptionalRule[] = [
  {
    key: 'fwMaintain',
    rule: '18.1',
    name: 'Maintaining field works',
    text: 'Field works in a contested area are not removed automatically: in his own Supply Phase the owner checks morale with one unit there, and only a failure removes them.',
  },
  {
    key: 'withdrawal',
    rule: '18.2',
    name: 'Withdrawal',
    text: 'The last unit to leave a contested area in the Movement Phase checks morale; failing, it is disordered and its move ends at once.',
  },
  {
    key: 'artyInterdict',
    rule: '18.31',
    name: 'Artillery interdiction',
    text: 'Once per Admin Phase each player may place an available artillery asset next to his units or a strongpoint: the enemy pays +1 MP to enter and to leave, and may not strat-move in or out, until the second Supply Phase.',
  },
  {
    key: 'directSupport',
    rule: '18.32',
    name: 'Direct combat support (Israeli)',
    text: 'Israeli artillery assigned to a battle may support instead of firing: +1 to the point unit per asset.',
  },
  {
    key: 'syrianAirAttack',
    rule: '18.4',
    name: 'Syrian air support use',
    text: 'Syrian air support flies close air support only when Syria is the Attacker.',
  },
  {
    key: 'israeliDivisions',
    rule: '18.5',
    name: 'Israeli divisional organization',
    text: 'Israeli units of different divisions in one area: one artillery asset, no battle assets (as 15.12); merging units (14.61a) must be of the same division.',
  },
  {
    key: 'atAssets',
    rule: '18.6',
    name: 'Anti-tank assets',
    text: 'Syrian AT assets fire +1 when the enemy point unit is armour. When Syria defends with an AT asset assigned, Israeli armour fires −1. In Al-Owda (its own sheet): only a defending Syrian AT asset gets the +1, and there is no −1.',
  },
  {
    key: 't62',
    rule: '18.7',
    name: 'Syrian T-62 tanks',
    text: 'The 65th, 76th, 81st, 91st and Assad armoured units pay one extra MP to cross a field connection.',
  },
  {
    key: 'artyArmor',
    rule: '18.8',
    name: 'Artillery vs armour',
    text: 'Armour takes a recovery marker instead of a step loss from artillery; each marker is −1 in ground fire. After the battle one marker stays (the unit is recovering) until the Supply Phase.',
  },
  {
    key: 'zvikaCup',
    rule: '18.9',
    name: 'Lt. Zvika variant',
    text: 'In the Supply Phase Israel may take Lt. Zvika back off the map into the Selection Cup, to play him again when drawn.',
  },
  {
    key: 'raidMod',
    rule: '18.10',
    name: 'Commando raid modifier',
    text: 'A commando raid east of the SAM barrier gets −1 on the die (better for Syria).',
  },
  {
    key: 'battleRecovery',
    rule: '18.11',
    name: 'Battlefield recovery',
    text: 'Disordered or recovering units in a contested area improve in the Supply Phase only by passing a morale check.',
  },
  {
    key: 'chemical',
    rule: 'A 18.7',
    name: 'Chemical warfare',
    text: 'As the defender, Syria spends the reusable Special Action: one artillery asset (or air support firing as artillery) fires +2. Every use after the first gives Israel 1 VP.',
  },
  {
    key: 'flank',
    rule: 'A 18.8',
    name: 'Flank assault (Israelis)',
    text: 'Attacking with two units, Israel spends a Special Action: the second unit flanks, fires +1 and takes no hits while the point unit stands.',
  },
  {
    key: 'advGhosts',
    rule: 'A 18.10',
    name: 'Advanced ghost units',
    text: 'Ghosts move (as armour or infantry), may be reserves, never create a contested area, overstack by one, and vanish when a Syrian unit enters their area alone. In Al-Owda a ghost drawn from the cup arrives in an Assembly Area.',
  },
];
export const T62 = new Set(['S19', 'S20', 'S21', 'S26', 'S27']); // 65th, 76th, 81st, 91st, Assad (all Elite)
const isAT = (c: Chit) => c.side === 'syrian' && /\bAT$/.test(c.name);
const pointOf = (g: Game, b: Battle, side: Side) => g.units.find((u) => u.id === (side === b.attacker ? b.attPoint : b.defPoint));
const bump = (f: Fire, by: number, why: string) => {
  f.sn += by;
  f.parts.push([why, by]);
};
function optionalFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground', list: Fire[]) {
  const o = g.opts,
    B = battleState(b),
    enemyPoint = pointOf(g, b, other(side));
  if (o.chemical && kind === 'arty' && B.chem) for (const f of list) if (f.key === B.chem) bump(f, 2, 'chemical warfare');
  const dcs = o.directSupport && side === 'israeli' ? (B.dcs ?? []).filter((id) => b.assets.israeli.includes(id)) : []; // 18.32: they support instead of firing
  if (kind === 'arty' && dcs.length) for (let i = list.length - 1; i >= 0; i--) if (dcs.includes(list[i].key)) list.splice(i, 1);
  if (kind !== 'ground') return;
  const own = pointOf(g, b, side);
  if (dcs.length && own) for (const f of list) if (f.key === own.id) bump(f, dcs.length, `direct combat support ×${dcs.length} (18.32)`);
  const atNarrow = isAlOwda(g); // A18.6: in Al-Owda only a defending Syrian AT asset gets +1, and no −1; N18.6 elsewhere
  if (o.atAssets && side === 'syrian' && enemyPoint?.cls === 'armor' && (!atNarrow || b.attacker === 'israeli'))
    for (const f of list) if (f.isAsset && b.assets.syrian.includes(f.key) && isAT(chit(g, f.key))) bump(f, 1, 'AT asset vs armour (18.6)');
  if (o.atAssets && !atNarrow && side === 'israeli' && b.attacker === 'israeli' && b.assets.syrian.some((id) => isAT(chit(g, id))))
    for (const f of list) {
      const u = g.units.find((x) => x.id === f.key);
      if (u?.cls === 'armor' && !f.isAsset) bump(f, -1, 'Syrian AT defence (18.6)');
    }
  if (o.artyArmor)
    for (const f of list) {
      const u = g.units.find((x) => x.id === f.key);
      if (u?.rec) bump(f, -u.rec, `${u.rec} recovery marker${u.rec > 1 ? 's' : ''}`);
    }
  if (o.flank && B.flank && side === b.attacker) for (const f of list) if (f.key === B.flank) bump(f, 1, 'flanking (18.8)');
}
/** Artillery vs armour: an armour unit hit by artillery takes a recovery marker instead of a step. */
function absorbLoss(g: Game, b: Battle, _side: Side, u: Unit) {
  if (!g.opts.artyArmor || b.lossKind !== 'arty' || u.cls !== 'armor' || u.fort || u.ghost) return false;
  u.rec = (u.rec ?? 0) + 1;
  say(g, `${u.name} is buttoned up: a recovery marker instead of a step loss (artillery vs armour)`);
  return true;
}
/** Flank assault: the flanking unit takes no hits while the point unit is still in the battle. */
function lossOk(g: Game, b: Battle, side: Side, key: string) {
  const B = battleState(b);
  if (!g.opts.flank || !B.flank || side !== b.attacker || key !== B.flank) return true;
  return !unitsIn(g, b.area, side).some((u) => u.id === b.attPoint);
}
/** Battlefield recovery: in a contested area a unit improves only by passing a morale check. */
function recoverOk(g: Game, u: Unit) {
  if (!g.opts.battleRecovery || u.area == null || !contested(g, u.area)) return true;
  const sn = golanMoraleSn(g, u, 'check'),
    { r, ok } = moraleCheck(g, u, sn, 'Battlefield recovery (18.11)');
  say(g, `${u.name} ${ok ? 'recovers' : 'stays as it is'} in the front line (${r} vs ${sn}, 18.11)`);
  return ok;
}
/** Chemical warfare: the Syrian defender spends the reusable Special Action; one artillery asset (or air support firing as artillery) fires +2 this battle. */
export function playChemical(g: Game, assetId: string) {
  const b = g.battle;
  need(
    !!g.opts.chemical && !!b && b.stage === 'setup' && b.attacker === 'israeli',
    'as the Syrian defender, before the first roll (chemical warfare)',
  );
  const B = battleState(b!);
  need(!B.chem, 'one chemical attack per battle');
  need(
    b!.assets.syrian.some((id) => id === assetId && isArty(chit(g, id))) ||
      airOf(b!, 'syrian').some((a) => a.id === assetId && a.mode === 'arty'),
    'a Syrian artillery asset (or air support firing as artillery) in this battle',
  );
  const blk = saAvailable(g, 'syrian').find((c) => c.kind === 'sa_block');
  need(!!blk, 'the reusable Special Action is not available');
  spendSA(g, 'syrian', undefined, 'chemical warfare', blk!.id);
  B.chem = assetId;
  const V = state(g);
  V.chem = (V.chem ?? 0) + 1;
  say(g, `Chemical warfare: ${chit(g, assetId).name} fires +2${V.chem > 1 ? ' (Israel gains 1 VP)' : ''}`, 'syrian');
}
/** The Syrian artillery a chemical attack could use now (empty when it cannot be played). */
export function chemicalOptions(g: Game): string[] {
  const b = g.battle;
  if (
    !g.opts.chemical ||
    !b ||
    b.stage !== 'setup' ||
    b.attacker !== 'israeli' ||
    battleState(b).chem ||
    !saAvailable(g, 'syrian').some((c) => c.kind === 'sa_block')
  )
    return [];
  return [
    ...b.assets.syrian.filter((id) => isArty(chit(g, id))),
    ...airOf(b, 'syrian')
      .filter((a) => a.mode === 'arty')
      .map((a) => a.id),
  ];
}
/** Flank assault: attacking with two units, Israel spends a Special Action; the second unit flanks. */
export function playFlank(g: Game, unitId: string, chitId?: string) {
  need(flankOptions(g).includes(unitId), 'an Israeli unit beside the point unit, attacking, before the first roll (flank assault)');
  const b = g.battle!,
    u = unit(g, unitId);
  spendSA(g, 'israeli', u.ech, 'flank assault', chitId);
  battleState(b).flank = unitId;
  say(g, `${u.name} flanks: +1 to its fire, the point unit takes the hits`, 'israeli');
}
export function flankOptions(g: Game): string[] {
  const b = g.battle;
  if (!g.opts.flank || !b || b.stage !== 'setup' || b.attacker !== 'israeli' || battleState(b).flank || !saAvailable(g, 'israeli').length)
    return [];
  const us = unitsIn(g, b.area, 'israeli').filter(regular);
  return us.length >= 2 ? us.filter((u) => u.id !== b.attPoint).map((u) => u.id) : [];
}
/** 18.32 (optional) Direct combat support: the Israeli artillery assigned to the open battle that may be switched between firing and supporting. */
export function directSupportOptions(g: Game): string[] {
  const b = g.battle;
  if (!g.opts.directSupport || !b || b.stage !== 'setup') return [];
  return b.assets.israeli.filter((id) => isArty(chit(g, id)));
}
/** 18.32: an assigned Israeli artillery asset supports the point unit (+1 to its SN) instead of firing; `on` false puts it back to firing. */
export function setDirectSupport(g: Game, chitId: string, on: boolean) {
  need(directSupportOptions(g).includes(chitId), 'an Israeli artillery asset in this battle, before the first roll (18.32)');
  const B = battleState(g.battle!),
    dcs = (B.dcs ?? []).filter((x) => x !== chitId);
  B.dcs = on ? [...dcs, chitId] : dcs;
  say(g, `${chit(g, chitId).name} ${on ? 'gives direct combat support to the point unit (18.32)' : 'fires as artillery'}`, 'israeli');
}
/** 18.32: an artillery asset in direct combat support may take a step loss, like a battle asset (needs the series loss pool to ask this hook). */
const lossAsset = (g: Game, b: Battle, side: Side, id: string) =>
  !!g.opts.directSupport && side === 'israeli' && (battleState(b).dcs ?? []).includes(id) && b.assets.israeli.includes(id);
/** Lt. Zvika variant: in the Supply Phase Israel takes Lt. Zvika off the map, back into the Selection Cup. */
export function zvikaToCup(g: Game) {
  const z = zvikaOnMap(g);
  need(!!z, 'Lt. Zvika is not on the map in the Supply Phase (Lt. Zvika variant)');
  z!.area = null;
  z!.str = 0;
  const c = chit(g, z!.chitId!);
  c.box = 'cup';
  c.area = undefined;
  say(g, 'Lt. Zvika is taken back into the Selection Cup', 'israeli');
}
export const zvikaOnMap = (g: Game) =>
  g.opts.zvikaCup && g.phase === 'supply' && g.phasing === 'israeli'
    ? g.units.find((u) => u.area != null && u.chitId && chit(g, u.chitId).kind === 'event_lt_zvika')
    : undefined;
/** Advanced ghosts: the best of an armour and an infantry move, never into an area that would become contested. */
export function ghostReach(g: Game, u: Unit, one: boolean, ctx: GMoveCtx) {
  const all = new Map<number, ReturnType<typeof reachable>[number]>();
  for (const cls of ['armor', 'infantry'] as const)
    for (const r of reachable({ ...asMover(g, u, one), cls }, ctx)) {
      const o = all.get(r.area);
      if (!o || r.cost < o.cost) all.set(r.area, r);
    }
  return [...all.values()].filter((r) => !(unitsIn(g, r.area, 'syrian').length && !contested(g, r.area)));
}
/** Advanced ghosts (A 18.10): a ghost may overstack by one, so an area holds at most three Israeli units, of which at most two
 *  are regular (non-ghost) and at most two are ghosts. Without the option, the usual two-unit count. */
export function ghostRoom(g: Game, u: Unit, a: number) {
  if (isAssembly(a)) return true;
  const here = unitsIn(g, a, u.side).filter((x) => !x.garrison && x.id !== u.id),
    gh = here.filter((x) => x.ghost).length;
  if (here.length >= 3) return false;
  return u.ghost ? gh < 2 : here.length - gh < 2 && (here.length < 2 || gh > 0);
}
/** Advanced ghosts: a Syrian unit entering an area held only by ghosts reveals and removes them, and may go on with what MP it has left. */
export function ghostsMet(g: Game, u: Unit, to: number, cost: number) {
  if (!g.opts.advGhosts || u.side !== 'syrian') return;
  const here = unitsIn(g, to, 'israeli');
  if (!here.length || !here.every((x) => x.ghost)) return;
  for (const x of here) {
    x.area = null;
    x.str = 0;
  }
  updateControl(g, to);
  u.moved = false;
  u.spent = cost;
  say(g, `Only a ghost was in ${nameOf(to)}: it is removed, and ${u.name} may move on`);
}
/** Retreats: no Assembly areas, boundaries the unit could not cross, no raided areas for Israelis (6.5, 14.1x, 16.11a). */
function retreatOk(g: Game, u: Unit, from: number, to: number) {
  if (isAssembly(to)) return false;
  const c = connection(from, to)!;
  if (c.hermon && u.cls !== 'infantry') return false;
  if (c.rugged && c.type !== 'road' && u.cls === 'armor') return false;
  if (c.escarpment && c.type !== 'road') return false;
  return !(u.side === 'israeli' && state(g).raids.includes(to));
}
/** 14.42: a Syrian unit retreats across the operational boundary only when nothing else is open (turns 1–4). */
function retreatPrefer(g: Game, u: Unit, from: number, opts: number[]) {
  if (u.side !== 'syrian' || g.turn > 4) return opts;
  const inside = opts.filter((n) => !connection(from, n)?.sector);
  return inside.length ? inside : opts; // a retreat past a full neighbour ends further away
}
/** A retreat across a minefield costs a morale check (14.02); the strongpoint left behind is evacuated (15.6); a garrison left behind is destroyed (16.24). */
function onRetreat(g: Game, u: Unit, from: number, to: number) {
  if (u.side === 'syrian' && state(g).minefields.includes(edgeKey(from, to))) {
    const sn = golanMoraleSn(g, u, 'check'),
      { r, ok } = moraleCheck(g, u, sn, 'Retreat through a minefield (14.02)');
    if (!ok) {
      say(g, `${u.name} retreats through the minefield and loses a step (${r} vs ${sn})`);
      u.str--;
      if (u.str <= 0) eliminate(g, u);
    }
  }
  if (u.side === 'israeli') evacuateStrongpoint(g, from);
  const b = g.battle;
  if (b && b.area === from && b.retreat?.after !== 'sa' && !unitsIn(g, from, u.side).some(regular))
    for (const ga of unitsIn(g, from, u.side).filter((x) => x.garrison)) {
      say(g, `${ga.name} is left behind and destroyed (16.24)`);
      eliminate(g, ga);
    }
}
/** 14.01: a crossing assault — every attacker entered across an unbridged AT ditch or a river without a usable bridge. */
function assault(g: Game, area: number) {
  const att = blocks(g, area, g.phasing).filter(regular),
    in_ = state(g).assaultEntered[area] ?? [];
  return att.length > 0 && att.every((u) => in_.includes(u.id));
}
/** 22.17: a free Breakthrough combat round is still owed (read without spending it). */
export const freeRoundLeft = (g: Game) => g.turn === 1 && g.phasing === 'syrian' && g.phase === 'btCombat' && state(g).freeCombatRound > 0;
function freeBattle(g: Game) {
  const V = state(g);
  if (!(g.turn === 1 && g.phasing === 'syrian' && V.freeCombatRound > 0)) return false;
  V.freeCombatRound--;
  return true; // 22.17
}

/* ================= the volume's own player actions ================= */
const avail = (g: Game, id: string, kinds: string[]) => {
  const c = chit(g, id);
  need(c.box === 'available' && kinds.includes(c.kind), `${c.name} is not available for this`);
  return c;
};
const homeArea = (g: Game, side: Side, a: number) => !isAssembly(a) && supplied(g, side, a);
export const vacant = (g: Game, a: number) => !unitsIn(g, a).length;
const used = (c: Chit) => {
  c.box = 'used';
  c.area = undefined;
};
const gone = (c: Chit) => {
  c.box = 'eliminated';
  c.area = undefined;
};
const reduced = (u: Unit) => u.area != null && regular(u) && u.str < u.max;
export const unit = (g: Game, id: string) => {
  const u = g.units.find((x) => x.id === id);
  if (!u) throw new Error(`no unit ${id}`);
  return u;
};
export const nameOf = (a: number) => areas.get(a)?.name ?? String(a);

/* ---------- engineering (4.3, 14.5) ---------- */
/** 4.31: up to two bridges (river boundaries a road crosses, 14.41) next to one supplied, friendly, uncontested area. */
export function blowBridges(g: Game, chitId: string, from: number, to: number[]) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['engineer']);
  need(homeArea(g, c.side, from), 'the engineer works from a supplied, friendly-controlled, uncontested area');
  need(to.length >= 1 && to.length <= 2, 'one or two bridges');
  for (const n of to) {
    const e = connection(from, n);
    need(e?.river && e.type === 'road' && !g.blown.includes(edgeKey(from, n)), `no bridge between ${nameOf(from)} and ${nameOf(n)}`);
  }
  for (const n of to) g.blown.push(edgeKey(from, n));
  used(c);
  say(g, `${c.name} blows the bridge(s) ${to.map((n) => `${nameOf(from)}–${nameOf(n)}`).join(', ')} (4.31)`, c.side);
}
/** 4.32: repair a blown bridge from a supplied, friendly, uncontested area towards a friendly or contested one. */
export function repairBridge(g: Game, chitId: string, from: number, to: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['engineer']),
    key = edgeKey(from, to);
  need(g.blown.includes(key), 'that bridge is not blown');
  need(
    homeArea(g, c.side, from) && (g.control[to] === c.side || contested(g, to)),
    'repair from a supplied, friendly, uncontested area towards a friendly or contested one',
  );
  g.blown = g.blown.filter((x) => x !== key);
  used(c);
  say(g, `${c.name} repairs the bridge ${nameOf(from)}–${nameOf(to)} (4.32)`, c.side);
}
/** 4.33: field works where a friendly unit stands (never with a strongpoint, 15.6). */
export function engineerFieldWorks(g: Game, chitId: string, a: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['engineer']);
  need(homeArea(g, c.side, a) && blocks(g, a, c.side).some(regular), 'a supplied, friendly, uncontested area with a friendly unit');
  need(!g.fieldWorks.includes(a) && !unitsIn(g, a).some((u) => u.fort), 'no field works there (one per area, never with a strongpoint)');
  g.fieldWorks.push(a);
  g.fwOwner[a] = c.side;
  used(c);
  say(g, `${c.name} builds field works in ${nameOf(a)} (4.33)`, c.side);
}
/** 14.51a: bridge an AT ditch boundary (up to eight markers) from a supplied, friendly, uncontested area towards a friendly one or a contested enemy one. */
export function bridgeDitch(g: Game, chitId: string, from: number, to: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['engineer']),
    key = edgeKey(from, to),
    V = state(g);
  need(connection(from, to)?.atDitch && !V.bridgedDitch.includes(key), 'no unbridged AT ditch there');
  need(V.bridgedDitch.length < 8, 'all eight AT Ditch Bridged markers are in use');
  need(
    homeArea(g, c.side, from) && (g.control[to] === c.side || (contested(g, to) && g.control[to] === other(c.side))),
    'bridge from a supplied, friendly, uncontested area towards a friendly one or a contested enemy one',
  );
  V.bridgedDitch.push(key);
  used(c);
  say(g, `${c.name} bridges the AT ditch ${nameOf(from)}–${nameOf(to)} (14.51a)`, c.side);
}
/** 14.52 (Syrian only): lift a minefield next to a supplied, friendly, uncontested area. */
export function removeMinefield(g: Game, chitId: string, from: number, to: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['engineer']),
    key = edgeKey(from, to),
    V = state(g);
  need(c.side === 'syrian', 'only Syrian engineers clear minefields');
  need(V.minefields.includes(key) && homeArea(g, 'syrian', from), 'a mined boundary next to a supplied, friendly, uncontested area');
  V.minefields = V.minefields.filter((x) => x !== key);
  used(c);
  say(g, `${c.name} clears the minefield ${nameOf(from)}–${nameOf(to)} (14.52)`, c.side);
}
/** 14.51b: a Syrian engineer in a battle on the Israeli side of the ditch may bridge an adjoining AT ditch boundary instead of firing. */
export function setEngineerBridge(g: Game, b: Battle, to: number | null) {
  const B = battleState(b);
  if (to == null) {
    B.engBridge = undefined;
    return;
  }
  const c = connection(b.area, to);
  need(
    b.attacker === 'syrian' && !garea(b.area).syria && c?.atDitch && !state(g).bridgedDitch.includes(edgeKey(b.area, to)),
    'no AT ditch to bridge there',
  );
  need(state(g).bridgedDitch.length < 8, 'all eight AT Ditch Bridged markers are in use (14.51a)');
  need(
    b.assets.syrian.some((id) => chit(g, id).kind === 'engineer'),
    'assign an engineer asset first',
  );
  B.engBridge = edgeKey(b.area, to);
}

/* ---------- air missions in the Admin Phase (16.31b/c) and commando raids (16.11a) ---------- */
const noSamReplay = (g: Game, a: number) =>
  need(!(state(g).samCancelled ?? []).includes(a), 'a SAM cancelled an air mission over that area: no replacement this phase (16.12)');
const airOk = (g: Game, a: number) => {
  need(!state(g).samTarget, 'Syria must first answer the air mission already flown (16.12)');
  need(!isNight(g), 'no air missions on the night turn (14.03)');
  need(!isAssembly(a), 'not over an Assembly area');
};
export function airInterdiction(g: Game, chitId: string, a: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['air_mission']);
  airOk(g, a);
  need(!g.interdicted[a], 'that area is already interdicted');
  noSamReplay(g, a);
  c.box = 'map';
  c.area = a;
  c.mission = 'interdiction';
  g.interdicted[a] = c.id;
  if (c.side === 'israeli' && eastOfSam(a) && samAvailable(g)) state(g).samTarget = c.id;
  say(g, `Air interdiction over ${nameOf(a)} (16.31b)`, c.side);
}
/** 18.31 (optional) Artillery interdiction: once per Admin Phase per player, an available artillery asset goes into an area next to friendly units
 *  or a strongpoint; it works as an interdiction mission (16.31b: +1 MP in and out for the enemy, no strat-move) until the second Supply Phase. */
export function artilleryInterdiction(g: Game, chitId: string, a: number) {
  needAdmin(g, chit(g, chitId).side);
  need(!!g.opts.artyInterdict, 'artillery interdiction is an optional rule (18.31)');
  const c = chit(g, chitId),
    V = state(g);
  need(c.box === 'available' && isArty(c), `${c.name} is not an available artillery asset`);
  need(!(V.artyInt ?? []).includes(c.side), 'one artillery interdiction per player in each Admin Phase (18.31)');
  need(areas.has(a) && !isAssembly(a) && (!g.inPlay || g.inPlay.includes(a)), 'not an area of the map');
  need(!g.interdicted[a], 'that area is already interdicted');
  need(
    neighbors(a).some((n) => !isAssembly(n) && unitsIn(g, n, c.side).some((u) => regular(u) || !!u.fort)),
    'an area next to one holding friendly units or a strongpoint (18.31)',
  );
  c.box = 'map';
  c.area = a;
  c.mission = 'interdiction';
  g.interdicted[a] = c.id;
  (V.artyInt ??= []).push(c.side);
  say(g, `${c.name} interdicts ${nameOf(a)} (18.31)`, c.side);
}
export function airRecon(g: Game, chitId: string, a: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['air_mission']);
  airOk(g, a);
  noSamReplay(g, a);
  need(
    unitsIn(g, a, other(c.side)).some((u) => !u.garrison),
    'reconnaissance over an enemy-occupied area',
  ); // strongpoints and ghosts too
  c.box = 'map';
  c.area = a;
  c.mission = 'recon';
  if (c.side === 'israeli' && eastOfSam(a) && samAvailable(g)) {
    state(g).samTarget = c.id;
    say(g, `Air reconnaissance over ${nameOf(a)}: Syria may answer with a SAM (16.31c)`, c.side);
    return;
  }
  finishRecon(g, c);
}
/** The reconnaissance flies: the enemy blocks in the area are shown for the rest of the phase. */
export function finishRecon(g: Game, c: Chit) {
  state(g).intel = { side: c.side, area: c.area! };
  c.mission = undefined;
  used(c);
  say(g, 'Reconnaissance reveals the enemy blocks (16.31c)', c.side);
}
/** 16.11a: a commando from the Available Box lands on a vacant Israeli-controlled area next to a Syrian-occupied one; it stands there like a defended roadblock. */
export function placeRaid(g: Game, chitId: string, a: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['commando']);
  need(
    !isAssembly(a) && g.control[a] === 'israeli' && vacant(g, a) && neighbors(a).some((n) => blocks(g, n, 'syrian').some(regular)),
    'a vacant Israeli-controlled area next to a Syrian-occupied area',
  );
  c.box = 'map';
  c.area = a;
  g.units = g.units.filter((x) => x.id !== `R-${c.id}`);
  g.units.push(asGarrison(c, 'R', a, 'infantry', c.q ?? 'veteran'));
  state(g).raids.push(a);
  say(g, `Commandos land in ${nameOf(a)} (16.11a)`, 'syrian');
}
/** 16.12: the Syrian player answers the Israeli air mission with an available SAM (or declines). */
export function fireSam(g: Game, samId: string) {
  const V = state(g),
    b = g.battle,
    airId = V.samTarget;
  need(airId, 'no Israeli air mission to answer');
  const sam = chit(g, samId);
  need(sam.kind === 'sam' && sam.box === 'available', 'no SAM asset available');
  const die = rollDie(g),
    res = samResult(isNafakh(g) ? Math.max(4, g.turn) : g.turn, die);
  sam.box = 'used';
  V.samTarget = undefined; // 22.46: Nafakh uses the turn 4-6 column
  const a = chit(g, airId!);
  if (a.mission === 'interdiction' && res !== 'none' && a.area != null) delete g.interdicted[a.area];
  if (!b && res !== 'none' && a.area != null) (V.samCancelled ??= []).push(a.area);
  if (a.mission === 'recon' && res === 'none') finishRecon(g, a);
  if (res !== 'none') {
    a.mission = undefined;
    a.box = res === 'eliminated' ? 'eliminated' : 'used';
    a.area = undefined;
    if (b) {
      for (const s of sidesOf(g)) dropAir(b, s, a.id);
      battleState(b).samCancelled = true;
    }
  }
  b?.rolls.push({ who: `SAM against ${a.name}`, sn: 0, dice: [die], hits: res === 'none' ? 0 : 1, kind: 'sam' });
  say(
    g,
    `SAM air defence fire: ${die} — ${res === 'eliminated' ? 'the air asset is shot down' : res === 'used' ? 'the air mission is cancelled' : 'no effect'} (16.12)`,
    'syrian',
  );
  return res;
}
export function declineSam(g: Game) {
  const V = state(g),
    id = V.samTarget;
  V.samTarget = undefined;
  const a = id ? chit(g, id) : undefined;
  if (a?.mission === 'recon') finishRecon(g, a);
}

/* ---------- events (17.x, 4.21) ---------- */
const STRATEGIC: Record<string, string> = { Assad: 'S21', '141st': 'S22', '62nd': 'S23' };
/** 17.11: the named Strategic Reserve unit is released and placed at once in a friendly-controlled Entry area (`at`, or the first open one). */
export function playRelease(g: Game, chitId: string, at?: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['event_release']);
  const id = Object.entries(STRATEGIC).find(([k]) => c.name.startsWith(k))?.[1];
  need(id, 'unknown release');
  const u = unit(g, id!);
  need(u.box === 'strategic_reserve', `${u.name} is already in play`);
  need(at == null ? releaseAreas(g, u).length > 0 : releaseAreas(g, u).includes(at), 'a friendly-controlled Entry area with room (17.11)');
  say(g, `${u.name} released from the Strategic Reserve (17.11)`, 'syrian');
  releaseUnit(g, u, at);
  gone(c);
}
/** 17.12 SSM attack: each Israeli air asset in the Available Box goes back to the cup on 1–2. */
export function playSSM(g: Game, chitId: string) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['event_ssm_strike']);
  gone(c);
  for (const air of g.chits.filter((x) => x.kind === 'air_mission' && x.side === 'israeli' && x.box === 'available')) {
    const die = rollDie(g);
    if (die <= 2) air.box = 'cup';
    say(g, `SSM strike: ${die}${die <= 2 ? ', an air asset goes back to the cup' : ', no effect'} (17.12)`, 'syrian');
  }
}
/** 17.21: two steps to the named brigade: +2 to one unit, +1 to each of two, or one eliminated unit back at 2 steps in an Assembly area. */
export function playArrivingBattalion(
  g: Game,
  chitId: string,
  choice: { add: string } | { split: [string, string] } | { rebuild: string; assembly: 'A' | 'B' },
) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['event_arriving_battalion']);
  const mine = (id: string) => {
    const u = unit(g, id);
    need(u.side === 'israeli' && !!c.brigade && u.brigade === c.brigade, `${u.name} is not of the ${c.brigade} brigade`);
    return u;
  };
  if ('add' in choice) {
    const u = mine(choice.add);
    need(u.area != null && !u.unsupplied && u.str + 2 <= u.max, 'a supplied unit with room for two steps');
    u.str += 2;
  } else if ('split' in choice)
    for (const id of choice.split) {
      const u = mine(id);
      need(u.area != null && !u.unsupplied && u.str < u.max, 'supplied, reduced units');
      u.str += 1;
    }
  else {
    const u = mine(choice.rebuild);
    need(u.area == null && u.str === 0, 'only an eliminated unit comes back');
    Object.assign(u, {
      area: choice.assembly === 'B' ? ASSEMBLY.B : ASSEMBLY.A,
      str: Math.min(2, u.max),
      disorder: 0,
      unsupplied: false,
      box: undefined,
    });
    g.elimLarge = g.elimLarge.filter((x) => x !== u.id); // 19.2: off the Eliminated Large Units track
  }
  gone(c);
  say(g, `${c.name} arrives (17.21)`, 'israeli');
}
/** 17.23 Lt. Zvika Greengold: an elite armor defended roadblock in an unoccupied Israeli-controlled area, staying until destroyed. */
export function playLtZvika(g: Game, chitId: string, a: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['event_lt_zvika']);
  need(
    !isAssembly(a) && g.control[a] === 'israeli' && vacant(g, a) && inSupply(g, 'israeli', a),
    'a supplied, unoccupied Israeli-controlled area (17.23, 4.35)',
  );
  c.box = 'map';
  c.area = a;
  c.q = 'elite';
  g.units.push(asGarrison(c, 'Z', a, 'armor', 'elite'));
  say(g, `Lt. Zvika takes position in ${nameOf(a)} (17.23)`, 'israeli');
}
/** 17.24 King Hassan's Troublemakers: the Moroccans fire only in defence and never enter Israeli-controlled areas, for the rest of the game. */
export function playKingHassan(g: Game, chitId: string) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['event_king_hassan']);
  gone(c);
  state(g).kingHassan = true;
  say(g, "King Hassan's Troublemakers: the Moroccan brigade holds back (17.24)", 'israeli');
}
/** 17.31/17.32 replacements: one step to a supplied reduced unit of the matching class, even in a contested area. */
export function playReplacement(g: Game, chitId: string, unitId: string) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['replacement_arm', 'replacement_mech']),
    u = unit(g, unitId);
  need(!u.fort, 'strongpoints never receive replacement steps (15.6)');
  need(
    u.side === c.side && reduced(u) && !u.unsupplied,
    'a supplied, reduced unit of your own (9.31: its status from the last Supply Phase)',
  );
  need(
    c.kind === 'replacement_arm' ? u.cls === 'armor' : u.symbol === 'mech' || u.cls === 'infantry',
    c.kind === 'replacement_arm'
      ? 'armor replacements go to armor-class units'
      : 'mechanized replacements go to mech or infantry-class units',
  );
  u.str += 1;
  gone(c);
  say(g, `${u.name} gets a replacement step (17.3)`, c.side);
}
/** 4.21: any event may instead bring two assets back from the Eliminated Box to the cup (not commandos, SAMs, air support or garrisons, 17.4). */
/** 4.21 with 17.4: the eliminated assets an event may bring back (never commandos, SAMs, air support or garrisons). */
export const alternateEventCandidates = (g: Game, side: Side) =>
  g.chits.filter(
    (a) =>
      a.side === side &&
      a.box === 'eliminated' &&
      !['commando', 'sam', 'air_mission', 'garrison', 'sa_block', 'command_staff'].includes(a.kind) &&
      !a.kind.startsWith('event') &&
      !a.kind.startsWith('replacement_') &&
      a.kind !== 'special_action_event',
  );
export function alternateEventUse(g: Game, chitId: string, assetIds: string[]) {
  needAdmin(g, chit(g, chitId).side);
  const c = chit(g, chitId);
  need(
    c.box === 'available' && (c.kind.startsWith('event') || c.kind.startsWith('replacement_') || c.kind === 'special_action_event'),
    'play an event from the Available Box',
  ); // 17.31/17.32 replacements are events
  need(assetIds.length === Math.min(2, alternateEventCandidates(g, c.side).length), 'choose two assets from your Eliminated Box (4.21)');
  for (const id of assetIds) {
    const a = chit(g, id);
    need(
      a.side === c.side &&
        a.box === 'eliminated' &&
        !['commando', 'sam', 'air_mission', 'garrison'].includes(a.kind) &&
        !a.kind.startsWith('event') &&
        !a.kind.startsWith('replacement_') &&
        a.kind !== 'special_action_event',
      `${a.name} cannot come back this way (17.4)`,
    );
  }
  for (const id of assetIds) chit(g, id).box = 'cup';
  gone(c);
  say(g, `${c.name} used to bring back ${assetIds.length} asset(s) (4.21)`, c.side);
}

/* ---------- Special Action uses of this volume (14.61) ---------- */
/** 14.61a (Israeli): fold one unit into another with the same symbol, same or adjacent uncontested friendly areas, both in good order. */
export function mergeUnits(g: Game, fromId: string, intoId: string, chitId?: string) {
  needAdmin(g, 'israeli');
  const a = unit(g, fromId),
    b = unit(g, intoId);
  need(
    a.side === 'israeli' && b.side === 'israeli' && a.id !== b.id && regular(a) && regular(b) && a.symbol === b.symbol,
    'two Israeli units with the same unit symbol',
  );
  need(
    !g.opts.israeliDivisions || a.division === b.division,
    'with Israeli divisional organization, merging units must be of the same division (18.5)',
  );
  need(a.area != null && b.area != null && (a.area === b.area || neighbors(a.area).includes(b.area)), 'in the same or adjacent areas');
  need(
    [a.area!, b.area!].every((x) => isAssembly(x) || (g.control[x] === 'israeli' && !contested(g, x))) &&
      a.disorder === 0 &&
      b.disorder === 0 &&
      !a.unsupplied &&
      !b.unsupplied,
    'uncontested friendly areas, supplied units in good order (9.34d)',
  );
  spendSA(g, 'israeli', undefined, `merge ${a.name} into ${b.name} (14.61a)`, chitId);
  b.str = Math.min(b.max, b.str + a.str);
  a.area = null;
  a.str = 0;
  dropReserve(g, a); // no VP for Syria (19.2)
}
/** 14.61b (Syrian, from turn 3): release the next 3rd Tank Division unit (15th, 81st, 65th) into its friendly-controlled Entry area (`at`, or the first open one). */
export function releaseOperationalReserve(g: Game, chitId?: string, at?: number) {
  needAdmin(g, 'syrian');
  need(g.turn >= 3, 'from turn 3');
  const next = ['S18', 'S19', 'S20'].map((id) => unit(g, id)).find((u) => u.box === 'operational_reserve');
  need(next, 'the Operational Reserve is empty');
  need(
    at == null ? releaseAreas(g, next!).length > 0 : releaseAreas(g, next!).includes(at),
    'its Entry area must be friendly-controlled, with room (14.61b)',
  );
  spendSA(g, 'syrian', undefined, `release ${next!.name} (14.61b)`, chitId);
  releaseUnit(g, next!, at);
}
/** 14.61c / 14.61d: a SAM (Syria) or an air support asset (Israel) from the Eliminated Box back into the cup. */
export function replaceAsset(g: Game, side: Side, assetId: string, chitId?: string) {
  needAdmin(g, side);
  const a = chit(g, assetId);
  need(
    a.side === side && a.box === 'eliminated' && a.kind === (side === 'syrian' ? 'sam' : 'air_mission'),
    side === 'syrian' ? 'an eliminated SAM asset' : 'an eliminated air support asset',
  );
  spendSA(g, side, undefined, `${a.name} replaced (14.61${side === 'syrian' ? 'c' : 'd'})`, chitId);
  a.box = 'cup';
}
/** 5.23 with 15.6: a unit digs in, but never where a strongpoint stands. */
export function unitFieldWorks(g: Game, unitId: string) {
  const u = unit(g, unitId);
  need(u.area == null || !unitsIn(g, u.area).some((x) => x.fort), 'no field works where a strongpoint stands (15.6)');
  buildFieldWorks(g, unitId);
}

/* ---------- events and Special Actions in a battle (17.33, 17.34, 8.23) ---------- */
const takeEvent = (g: Game, b: Battle, c: Chit, kind: string) => {
  const B = battleState(b);
  need(b.stage === 'setup', 'events are played before the first roll');
  need(c.box === 'available' && c.kind === kind, 'that event is not available');
  need(!unitsIn(g, b.area, c.side).every((u) => u.garrison), 'a standing asset fighting alone plays no events (4.35)');
  need(!B.event[c.side], 'one event per side in a battle (6.22, 6.23)');
  B.event[c.side] = c.id;
  c.box = 'eliminated';
  b.locked = true; // 4.22 single use
  return c.side;
};
/** 17.33 Command Disruption: the Attacker jams the defence before the Defender assigns anything. */
export function playJamming(g: Game, b: Battle, chitId: string) {
  const c = chit(g, chitId),
    def = other(b.attacker);
  need(c.side === b.attacker, 'only the Attacker jams (17.33)');
  need(!b.defSA, 'the Defender first decides on his Special Action (6.21)');
  need(!b.ready?.includes(b.attacker), 'jam with your assets, before committing them (6.22)');
  need(!b.assets[def].length && !airOf(b, def).length, 'the Defender has already assigned assets');
  takeEvent(g, b, c, 'event_ew');
  battleState(b).ew = { pending: true };
  say(g, 'Electronic warfare: command disruption (17.33)', b.attacker);
}
/** 17.33: the Defender answers, with his own EW as countermeasures (+2 to each roll) or without. Each defending unit rolls: 5 or less, disordered. */
export function answerJamming(g: Game, b: Battle, counterChitId?: string) {
  const B = battleState(b),
    def = other(b.attacker);
  need(B.ew?.pending, 'no jamming to answer');
  if (counterChitId) {
    takeEvent(g, b, chit(g, counterChitId), 'event_ew');
    say(g, 'EW countermeasures: +2 to each roll', def);
  }
  for (const u of fighters(g, b.area, def, false).filter((x) => !x.garrison)) {
    const die = rollDie(g),
      mod = counterChitId ? 2 : 0,
      hit = die + mod <= 5;
    b.rolls.push({ who: `${u.name}: jamming`, sn: 5, dice: [die + mod], hits: hit ? 1 : 0, kind: 'morale' });
    if (hit) u.disorder = 1;
    say(g, `${u.name} rolls ${die}${mod ? ' +2' : ''}: ${hit ? 'disordered' : 'holds'}`, def);
  }
  B.ew = { pending: false };
  const us = fighters(g, b.area, def, false).filter((x) => !x.garrison);
  B.defLocked = us.length > 0 && us.every((u) => u.disorder === 1);
}
/** 17.34 Counterbattery: played as the side's one event; it strikes after the enemy artillery fires. */
export function playCounterbattery(g: Game, b: Battle, chitId: string) {
  const side = takeEvent(g, b, chit(g, chitId), 'event_counterbattery');
  battleState(b).counterbattery[side] = chitId;
  say(g, 'Counterbattery strike prepared (17.34)', side);
}
/** 8.23: the units that may reinforce the Defender from an adjacent uncontested area (not into a battle held by assets alone, 4.35, except Lt. Zvika, 17.23). */
export function reinforceOptions(g: Game, b: Battle) {
  const def = other(b.attacker),
    here = unitsIn(g, b.area, def);
  if (b.stage !== 'setup' || blocks(g, b.area, def).filter(regular).length >= 2) return [];
  if (!here.some((u) => regular(u) || !!u.fort) && !here.some((u) => u.garrison && u.chitId && chit(g, u.chitId).kind === 'event_lt_zvika'))
    return [];
  return g.units
    .filter(
      (u) =>
        u.side === def && u.area != null && neighbors(b.area).includes(u.area) && regular(u) && u.disorder === 0 && !contested(g, u.area),
    )
    .map((u) => u.id);
}

/* ---------- 15.3 Air Assault: the 82nd Para, once, east of the SAM barrier or onto Mt Hermon, first thing in a Syrian Combat Phase ---------- */
export function airAssaultTargets(g: Game) {
  const para = g.units.find((u) => u.id === 'S17');
  if (!para || para.box !== 'air_assault' || g.phase !== 'combat' || g.phasing !== 'syrian' || isNight(g) || g.fought.length || g.battle)
    return [];
  return [...areas.keys()].filter((a) => !isAssembly(a) && (eastOfSam(a) || a === HERMON) && blocks(g, a, 'syrian').length < 2);
}
export function airAssault(g: Game, a: number) {
  need(airAssaultTargets(g).includes(a), 'no air assault there');
  const u = unit(g, 'S17');
  u.area = a;
  u.box = undefined;
  say(g, `The 82nd Para lands in ${nameOf(a)} (15.3)`, 'syrian');
  if (unitsIn(g, a, 'israeli').length) {
    g.riverAssault.push(a);
    state(g).airAssaultArea = a;
  } else updateControl(g, a);
}
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
