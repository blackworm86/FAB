import entryJson from '../../data/bulge/entry_areas.json';
import { areas, edgeKey, setPlayArea } from './map';
import { d10, rng } from './dice';
import { successNumber, type Quality } from './combat';
import { type Chit, type Side } from './chits';
import { CUR, registerHooks, useGame, type Volume } from './volumes';
import { bulgeNewGame, coldAreas } from './vol/bulge-setup';
export * from './vol/bulge-setup';
import {
  britishOk,
  bulgeAfterMove,
  bulgeAfterStrat,
  bulgeBeforeMove,
  bulgeBeforeRecycle,
  bulgeCanAssign,
  bulgeFinal,
  bulgeMarkerKey,
  bulgeMoraleSn,
  bulgeReach,
  bulgeRetreatOk,
  bulgeSources,
  bulgeStratAllowed,
  bulgeStratStep,
  bulgeSupplyHook,
  bulgeSupplyStep,
} from './vol/bulge';
export * from './vol/bulge';
import { autoArrive, drawChits, reinforcementPhase } from './reinforce';
export * from './reinforce';
import { airSup, check, needAdmin, supplied } from './admin';
export * from './admin';
import { dropReserve, endMove } from './moves';
export * from './moves';
import { fighters, settleUp, setupSide } from './battle-setup';
export * from './battle-setup';
import { allocate, eliminate, type LossRun } from './fire';
export * from './fire';
import { mustFight, retreatPaths } from './battle-end';
export * from './battle-end';
import { inSupply, rollSupply, supplyPhase } from './supply';
export * from './supply';
export type { Chit, Side };
export { useGame, CUR as VOLUME } from './volumes';

export type Phase =
  | 'deploy'
  | 'reinforcement'
  | 'admin'
  | 'movement'
  | 'strategic'
  | 'combat'
  | 'reaction'
  | 'btMove'
  | 'btCombat'
  | 'supply';
export const PHASES: Phase[] = ['admin', 'movement', 'strategic', 'combat', 'reaction', 'btMove', 'btCombat', 'supply'];
/** Turn Track (map): Admin Phase draws [first player turn, second player turn] and the sudden-death net VP [German, Allied]. */
export const TRACK = [
  { ge: [0, 0], al: [0, 0], sd: null },
  { ge: [9, 5], al: [7, 0], sd: null },
  { ge: [9, 4], al: [7, 1], sd: null },
  { ge: [8, 3], al: [7, 2], sd: [5, 5] },
  { ge: [7, 3], al: [7, 2], sd: [6, 4] },
  { ge: [10, 4], al: [10, 5], sd: [7, 3] },
  { ge: [8, 3], al: [11, 6], sd: [7, 3] },
  { ge: [7, 2], al: [12, 7], sd: [6, 4] },
  { ge: [6, 2], al: [13, 8], sd: [5, 5] },
] as unknown as { ge: number[]; al: number[]; sd: number[] | null }[];

export interface Unit {
  id: string;
  name: string;
  side: Side;
  cls: 'armor' | 'infantry';
  q: Quality[];
  max: number;
  str: number;
  area: number | null;
  garrison?: boolean;
  fort?:
    | 'armor'
    | 'infantry' /** a strongpoint (Golan 15.6): cannot move, attack or retreat; fires one die; its symbol gives the fire modifier */;
  ghost?: boolean /** a ghost (Golan 15.7): revealed and removed when a battle begins */;
  division?: string;
  brigade?: string;
  kind?: string;
  symbol2?: string;
  box?: string /** an off-map holding box of the volume (Golan: Operational/Strategic Reserve, Air Assault, strongpoint pool, evacuated, deploy, arriving) */;
  disorder: 0 | 1 | 2;
  unsupplied: boolean;
  moved: boolean;
  reserve: string | null;
  exploit: boolean;
  from?: number;
  arrival?: number;
  entry?: string[];
  ech?: string;
  symbol?: string;
  code?: string;
  nation?: string;
  untried?: boolean;
  motorized?: boolean /** Sicily: the block's nationality; an untried Italian garrison not yet in battle (15.3); the motorized Livorno (15.1) */;
  chitId?: string;
  interdict?: string;
  adjOnly?: boolean;
  peiperFull?: boolean;
  spent?: number;
  delayed?: boolean;
  paradrop?: 'pending' | 'intact' | 'partial';
  heydte?: boolean;
  bcross?: boolean;
  rec?: number /** recovery markers taken from artillery this round (Golan optional artillery vs armour) */;
  up?: number /** area where the block lies face-up after a battle (6.24); it is upright, so hidden from the enemy, whenever it is elsewhere */;
}
/** A morale check outside a battle: who rolled, against what, and the result. */
export interface Check {
  who: string;
  why: string;
  sn: number;
  die: number;
  ok: boolean;
  area: number | null;
}
export interface Roll {
  who: string;
  sn: number;
  dice: number[];
  hits: number;
  kind: 'arty' | 'ground' | 'morale' | 'sam';
}
export interface Battle {
  area: number;
  attacker: Side;
  attPoint: string;
  defPoint: string;
  bt: boolean;
  riverAssault: boolean;
  stage:
    | 'setup'
    | 'attArty'
    | 'defArty'
    | 'defFire'
    | 'offFire'
    | 'attChoice'
    | 'attFirst'
    | 'loss'
    | 'defChoice'
    | 'retreat'
    | 'exploit'
    | 'done';
  /** 6.43: step losses the owner is placing one at a time (stage 'loss'), and what follows once they are all taken. */
  loss?: LossRun;
  reinforced?: string /** 8.23: the unit that reinforced the defence by Special Action (never the point unit while the original stands) */;
  exploitIds?: string[] /** 6.8: the attacking armor-class units that may roll the exploitation morale check */;
  retreat?: { side: Side; queue: string[]; moved: boolean; after: 'ground' | 'arty' | 'sa'; h: number; excess: number };
  queue: ('attArty' | 'defArty' | 'defFire' | 'offFire')[];
  assets: Record<Side, string[]>;
  air: Partial<Record<Side, { id: string; mode: 'arty' | 'support'; unit?: string }>>;
  air2?: Partial<
    Record<Side, { id: string; mode: 'arty' | 'support'; unit?: string }>
  > /** a second air asset (Golan 16.22: one fires as artillery, the other supports a unit) */;
  vol?: Record<
    string,
    unknown
  > /** a volume's own battle state (Golan: the events played, jamming, counterbattery, the ditch an engineer bridges) */;
  pending: number;
  pendingKind?: 'arty' | 'ground';
  lossKind?: 'arty' | 'ground';
  engFw: boolean;
  rolls: Roll[];
  result?: string;
  exploit: boolean;
  unitHit: Record<Side, boolean>;
  mark: number;
  hit?: Record<Side, string[]>;
  ready?: Side[];
  locked?: boolean;
  attPointDone?: boolean /** 6.24: the Attacker designated his point unit after the Defender's: the round may begin and the blocks are revealed */;
  defSA?: boolean /** 6.21: the Defender has still to decide on a Special Action (reinforce or retreat), before the Attacker assigns assets */;
  pz150?: string /** 18.4 the 150th's first battle: its id, cleared once the morale check is done */;
  defStart?: string[];
  unabsorbed?: number;
  byArty?: boolean;
  lastDefPoint?: Unit /** 18.7 bookkeeping */;
}
/** Scenario and optional rules (Play Book 18); every optional flag missing = off. */
export interface Opts {
  scenario: string;
  fuel: boolean;
  airborne?: boolean;
  advArty?: boolean;
  bridgeLimit?: boolean /** 18.1 the Germans repair at most six bridges */;
  bid?: number /** 18.2 fuel bid: + extra German bid fuel assets (eliminated when used), − fuel assets moved to the Used Box at start (max 5) */;
  peiper?: boolean /** 18.3 KG Peiper's once-per-game full exploitation move */;
  pz150?: boolean /** 18.4 150th Panzer Brigade */;
  overrun?: boolean /** 18.7 overrunning artillery */;
  fwMaintain?: boolean /** 18.8 maintaining field works */;
  randomReinf?: boolean /** 18.9 random reinforcements */;
  /* Golan '73 additional optional rules (the Battle for Nafakh and Al-Owda scenario sheets, 18.x) */
  atAssets?: boolean /** Syrian AT assets: +1 against an armour point unit; defending with one, Israeli armour fires −1 */;
  t62?: boolean /** Syrian T-62 tanks: +1 MP to cross a field connection */;
  chemical?: boolean /** chemical warfare: the Syrian defender's reusable Special Action gives one artillery asset +2 */;
  flank?: boolean /** Israeli flank assault: a Special Action, the second unit fires +1 and takes no hits */;
  artyArmor?: boolean /** artillery vs armour: armour takes recovery markers instead of step losses from artillery */;
  zvikaCup?: boolean /** Lt. Zvika variant: back into the cup in the Supply Phase */;
  raidMod?: boolean /** commando raids east of the SAM barrier: −1 to the die */;
  battleRecovery?: boolean /** battlefield recovery: recovering in a contested area takes a morale check */;
  advGhosts?: boolean /** advanced ghost units: they move, may be reserves, arrive from the cup */;
}
/** The optional rules of Play Book 18, for menus and the 'rules in use' list. */
export type OptionalRule = { key: keyof Opts; rule: string; name: string; text: string };
export const OPTIONAL_RULES: OptionalRule[] = [
  { key: 'bridgeLimit', rule: '18.1', name: 'Bridge repair limits', text: 'The Germans may repair at most six bridges.' },
  {
    key: 'bid',
    rule: '18.2',
    name: 'Bidding for sides',
    text: 'The agreed bid changes the German starting fuel: extra bid fuel assets (+) or fuel moved to the Used Box (−).',
  },
  {
    key: 'peiper',
    rule: '18.3',
    name: 'KG Peiper',
    text: 'Once, in a Breakthrough Movement Phase up to turn 3, exploiting Peiper may use its full movement.',
  },
  {
    key: 'pz150',
    rule: '18.4',
    name: '150th Panzer Brigade',
    text: 'Its first battle: it is the point unit; after artillery the American point unit checks morale (+2) or is disordered.',
  },
  {
    key: 'airborne',
    rule: '18.5',
    name: 'American airborne units',
    text: '82nd, 101st and 517th ignore the −1 unsupplied morale modifier.',
  },
  {
    key: 'advArty',
    rule: '18.6',
    name: 'Advanced artillery modifiers',
    text: '−1 when the target is the defender, +1 against an infantry point unit not in field works.',
  },
  {
    key: 'overrun',
    rule: '18.7',
    name: 'Overrunning artillery',
    text: 'Defending artillery left behind in a vacated area may be destroyed by the attacker.',
  },
  {
    key: 'fwMaintain',
    rule: '18.8',
    name: 'Maintaining field works',
    text: "Field works in a contested area stay unless a morale check fails in the owner's Supply Phase.",
  },
  {
    key: 'randomReinf',
    rule: '18.9',
    name: 'Random reinforcements',
    text: 'Arriving units are drawn at random from those due now and next turn.',
  },
];
export interface Game {
  /** Set when hidden blocks are split between seats: setReady does not start combat by itself (see split.ts). */
  deferBegin?: boolean;
  /** Sides that have finished their part of a phase both sides work in (Reinforcement, Admin); the Phasing Player ends the step once the other side is done. */
  done?: Side[];
  game?: string;
  sides?: [Side, Side] /** the volume and its two sides, First Player first (older saved games: The Bulge) */;
  turn: number;
  lastTurn: number;
  phasing: Side;
  phase: Phase;
  units: Unit[];
  chits: Chit[];
  control: Record<number, Side>;
  fieldWorks: number[];
  fwOwner: Record<number, Side>;
  riverAssault: number[];
  blown: string[];
  contestedAtMoveStart: number[];
  fought: number[];
  markers: Record<Side, Record<string, number>>;
  stratMoves: number;
  riverCross: string[];
  blowTried: number[];
  entered: Record<number, { id: string; river: boolean; blown: boolean }[]>;
  pendingBlow: { unit: string; path: number[]; spent?: number; fuel?: boolean } | null;
  /** The block moving step by step (one area at a time) and may still go on: whether it left a contested area (5.34), the areas entered so far, whether it paid fuel (16.13). */
  moving?: { id: string; left: boolean; steps: number; fuel: boolean } | null;
  greif: Record<string, string>;
  greifTried: string[];
  fwBuilt: string[];
  tfNew: string[];
  elimLarge: string[];
  captured: number[];
  fuelAdded: boolean;
  opts: Opts;
  roadblocks: Record<number, Side>;
  interdicted: Record<number, string>;
  pooled: number | null;
  airSupplies?: { area: number; side: Side; id: string; stamp: number }[];
  markersHeld?: [Side, string][];
  airSupply: { area: number; side: Side; id: string; stamp: number } | null;
  revealed: string | null;
  arrived: string[];
  pendingArrivals: string[];
  recover: Side[];
  battle: Battle | null;
  seed: number;
  rolls: number;
  log: string[];
  over?: string;
  force?: number[];
  inPlay?: number[] /** 24.33 the Introductory scenario plays on its own map sheet: only these areas */;
  supplyOnly?: number[] /** P500 Cold Shoulder: Zone 5 areas both sides may trace supply through but nobody may enter */;
  track?: { ge: number[]; al: number[]; sd: number[] | null }[] /** draws per turn when the scenario has its own track */;
  artyPick?: boolean;
  supplyPending?: boolean;
  vpHist?: number[] /** net VP at each turn's Victory Check (German positive), for the end-of-game chart */;
  battles?: number /** battles fought so far */ /** 9.4 the out-of-supply checks of this Supply Phase are still to be rolled */;
  bridgesLeft?: number /** 18.1 German bridge repairs left */;
  peiperUsed?: boolean /** 18.3 used */;
  pz150Done?: boolean /** 18.4 the 150th has been in its first battle */;
  vol?: Record<string, unknown> /** a volume's own state (Golan: minefields, bridged ditches, raids…) */;
  /** Online: set when a player's rules check put the game back to the last legal position (`why`: what the check found). */
  restored?: { t: number; why: string[] };
  checks?: Check[] /** morale checks rolled outside battles (supply, Greif interdict), newest last, so the table can show the dice */ /** 16.12: the German player must choose which used artillery asset is eliminated */ /** sandbox: die results to use before the seeded ones */;
}
export type RawUnit = {
  id: string;
  name: string;
  side: string;
  echelon?: string;
  symbol?: string;
  cls?: string;
  steps?: number;
  quality_by_step?: Quality[];
  start_area?: number;
  arrival_turn?: number;
  entry?: string[];
  kind?: string;
};
export const ENTRY = entryJson as Record<string, { side: string; area: number }>;
/** 14.21-14.23: the entry areas a Higher Echelon may use when its own are blocked or a Special Action reroutes it. */
const APPROPRIATE: Record<string, string> = {
  de_5pz: 'XYZ',
  de_6pz: 'YZ',
  de_7a: 'XY',
  de_sr: 'YZ',
  us_1a: 'ABCDEFGHJ',
  us_3a: 'KLM',
  us_sr: 'FGHJ',
  br_xxx: 'CDEFGH',
};
export const appropriateAreas = (u: Unit, g?: Game) =>
  g && CUR.appropriate
    ? CUR.appropriate(g, u)
    : [...(APPROPRIATE[u.ech ?? ''] ?? '')]
        .map((l) => ENTRY[l]?.area)
        .filter((a): a is number => a != null && (!g?.inPlay || g.inPlay.includes(a)));
/** 5.1: two blocks of a side per area, unless the volume says otherwise (Golan's Assembly areas hold any number). */
export const stackMax = (g: Game, a: number) => CUR.stackLimit?.(g, a) ?? 2;
/** Room for unit `u` to end in area `a` (5.1); a volume may count some units differently (Golan's advanced ghosts overstack by one). */
export const roomFor = (g: Game, u: Unit, a: number) =>
  CUR.stackRoom?.(g, u, a) ?? blocks(g, a, u.side).filter((x) => x.id !== u.id).length < stackMax(g, a);
/** The two sides of a game, First Player first (an older saved Bulge game has none). */
export const sidesOf = (g: { sides?: [Side, Side] }): [Side, Side] => g.sides ?? CUR.sides;
export const other = (s: Side): Side => (s === CUR.sides[0] ? CUR.sides[1] : CUR.sides[0]);
export const sideOf = (s: string): Side => (s === 'german' ? 'german' : 'allied');
export const keyOf = edgeKey;

export const quality = (u: Unit) => u.q[u.str - 1];
export const unitsIn = (g: Game, a: number, side?: Side) => g.units.filter((u) => u.area === a && (!side || u.side === side));
export const blocks = (g: Game, a: number, side: Side) => unitsIn(g, a, side).filter((u) => !u.garrison);
export const contested = (g: Game, a: number) => {
  const [p, q] = sidesOf(g);
  return unitsIn(g, a, p).length > 0 && unitsIn(g, a, q).length > 0;
};
export const contestedAreas = (g: Game) => [...areas.keys()].filter((a) => contested(g, a));
export const newlyContested = (g: Game) => contestedAreas(g).filter((a) => !g.contestedAtMoveStart.includes(a));
export const chit = (g: Game, id: string) => g.chits.find((c) => c.id === id)!;
export const boxOf = (g: Game, side: Side, box: Chit['box']) => g.chits.filter((c) => c.side === side && c.box === box);
/** Dice come from the game's seed; a test table can queue exact results in `force` (the sandbox). */
/** Online the dice must not be predictable from the shared game, so the client plugs in a secure random source; tests and offline play use the seed. */
export let secure: (() => number) | null = null;
/** The optional rules of the game being played (each volume has its own list). */
export const optionalRules = (): OptionalRule[] => CUR.optional ?? OPTIONAL_RULES;
export const setRandom = (f: (() => number) | null) => {
  secure = f;
};
/** The secure source when one is set (online), for choices that must not be reproducible from the shared seed. */
export const secureRandom = () => secure?.() ?? null;
/** The random source in use (null: the game's seed), so a simulation can run on the seed and put it back. */
export const roll = (g: Game) =>
  secure
    ? (g.rolls++, 1 + Math.floor(secure() * 10))
    : g.force?.length
      ? (g.rolls++, g.force.shift()!)
      : d10(rng(g.seed * 7919 + g.rolls++)); // online the queue is ignored: a client must not write its own dice
/** A log line, labelled with the side that acted (in Prepare and Reinforcement both sides act). */
export const say = (g: Game, s: string, side: Side = g.phasing) => {
  g.log.push(`T${g.turn} ${CUR.tag[side] ?? side} ${g.phase}: ${s}`);
  if (g.log.length > 400) g.log.splice(0, g.log.length - 300);
}; // the log only has to be read, so it stays short
export function newGame(seed = Date.now() % 1e9, opts: Partial<Opts> = {}): Game {
  return CUR.newGame(seed, opts);
}

/* ================= control, supply, VP ================= */
function updateControl(g: Game, a: number) {
  if (contested(g, a))
    for (const u of unitsIn(g, a))
      if (u.reserve) {
        g.markers[u.side][u.reserve]++;
        u.reserve = null;
      } // 5.21 the marker goes when the area becomes contested
  const [p, q] = sidesOf(g),
    np = blocks(g, a, p).length,
    nq = blocks(g, a, q).length,
    was = g.control[a];
  if (np && !nq && !unitsIn(g, a, q).length) g.control[a] = p;
  if (nq && !np && !unitsIn(g, a, p).length) g.control[a] = q;
  if (CUR.id === 'bulge' && was !== 'german' && g.control[a] === 'german' && areas.get(a)!.vp.mutual && !g.captured.includes(a)) {
    // 16.13 captured fuel, first capture of a yellow-star area
    g.captured.push(a);
    const r = roll(g);
    if (r === 1 && !g.fuelAdded) {
      g.fuelAdded = true;
      g.chits.push({
        id: `FUEL-C${a}`,
        name: 'Captured Fuel Asset',
        kind: 'fuel',
        side: 'german',
        ech: 'german',
        turn: 'S',
        box: 'available',
      });
      say(g, `captured fuel at ${areas.get(a)!.name} (rolled 1): new fuel asset`);
    } else if (r <= 5) {
      const f = g.chits.find((c) => c.kind === 'fuel' && c.box === 'used') ?? g.chits.find((c) => c.kind === 'fuel' && c.box === 'cup');
      if (f) {
        f.box = 'available';
        say(g, `captured fuel at ${areas.get(a)!.name} (rolled ${r}): a fuel asset is available again`);
      }
    }
  }
}
export const victory = (g: Game) => CUR.victory(g);
/** 19.1–19.3 as the series rules give them: objective areas held and supplied, plus one point per large enemy unit eliminated; net is First Player minus Second. */
export function seriesVictory(g: Game): Record<Side, number> & { net: number } {
  const [p, q] = sidesOf(g),
    pts: Record<Side, number> = { [p]: 0, [q]: 0 },
    vp = (a: { vp: Record<string, number | boolean> }, s: Side) => (a.vp[s] as number) || 0;
  for (const a of areas.values()) {
    const c = g.control[a.id];
    if (!c || (!vp(a, c) && !a.vp.mutual) || !inSupply(g, c, a.id)) continue; // nobody holds it (possible in the sandbox)
    pts[c] += vp(a, c) + (a.vp.mutual ? 1 : 0);
  }
  for (const id of g.elimLarge) {
    const u = g.units.find((x) => x.id === id)!;
    pts[other(u.side)]++;
  }
  return { ...pts, net: pts[p] - pts[q] };
}

/* ================= phase flow ================= */
function retreatExcess(g: Game) {
  for (const side of sidesOf(g))
    for (const a of areas.keys()) {
      const us = blocks(g, a, side).filter((u) => !u.fort && !u.ghost);
      while (us.length > stackMax(g, a)) {
        const u = us.pop()!,
          to = [...retreatPaths(g, a, side, u).keys()][0]; // 6.6 (2016): past full areas to the nearest one with room
        if (to == null) {
          u.str = 0;
          eliminate(g, u);
        } else {
          u.area = to;
          u.disorder = 1;
          CUR.onRetreat?.(g, u, a, to);
          updateControl(g, to);
          say(g, `${u.name} retreats from overstacking to ${areas.get(to)!.name}`);
        }
      }
    }
}
function placeRiverAssaults(g: Game) {
  for (const [a, list] of Object.entries(g.entered)) {
    const area = +a,
      att = blocks(g, area, g.phasing);
    const isAssault = CUR.assault
      ? CUR.assault(g, area, list)
      : att.every((u) => list.some((e) => e.id === u.id && e.river)) && list.some((e) => e.blown);
    if (
      contested(g, area) &&
      !g.contestedAtMoveStart.includes(area) &&
      att.length &&
      isAssault &&
      !g.riverAssault.includes(area) &&
      (CUR.id !== 'bulge' || g.riverAssault.length < 4)
    ) {
      // The Bulge: 4 markers in the counter mix
      g.riverAssault.push(area);
      say(g, `river assault in ${areas.get(area)!.name}`);
    }
  }
  g.entered = {};
  g.riverCross = [];
  g.blowTried = [];
}
export function setDone(g: Game, side: Side, on = true) {
  const d = (g.done ?? []).filter((x) => x !== side);
  if (on) d.push(side);
  g.done = d;
}
export function endPhase(g: Game) {
  useGame(g.game ?? 'bulge');
  setPlayArea(g.inPlay);
  if (g.phase === 'supply' && g.supplyPending) rollSupply(g);
  endMove(g);
  settleUp(g);
  if (g.over) return;
  if (g.recover.length) throw new Error('choose the assets to recover first (4.1a)');
  if (g.artyPick) throw new Error('the German player must choose the artillery asset lost to attrition first (16.12)');
  if (g.battle) throw new Error('finish the open battle first');
  if (g.pendingBlow) throw new Error('resolve the bridge-blowing attempt first');
  if (mustFight(g).length) throw new Error('newly contested areas must be fought first');
  g.done = [];
  const ph = g.phase;
  if (ph !== 'supply') CUR.onPhase?.(g, ph, 'end'); // supply's end ran in rollSupply
  if (ph === 'deploy' && CUR.afterDeploy?.(g)) {
    say(g, 'phase start');
    return;
  }
  if (ph === 'deploy') {
    g.phase = 'movement';
    g.phasing = sidesOf(g)[0];
    g.units.forEach((u) => {
      u.moved = false;
      u.spent = 0;
    });
    g.contestedAtMoveStart = contestedAreas(g);
    g.stratMoves = 0;
    CUR.onPhase?.(g, 'movement', 'start');
    say(g, 'phase start');
    return;
  }
  g.fieldWorks = g.fieldWorks.filter((a) => {
    const o = g.fwOwner[a];
    return o ? blocks(g, a, o).length > 0 : unitsIn(g, a).some((u) => !u.garrison);
  }); // 5.23: a unit, not a standing asset   // 5.23 gone when no friendly unit is left in the area
  for (const a of Object.keys(g.fwOwner).map(Number)) if (!g.fieldWorks.includes(a)) delete g.fwOwner[a];
  if (ph === 'reinforcement') for (const id of [...g.pendingArrivals]) autoArrive(g, id);
  if (ph === 'admin') g.revealed = null;
  for (const [s, k] of g.markersHeld ?? []) g.markers[s][k]++;
  g.markersHeld = []; // 17.11: a reserve marker lost to a failed Greif check comes back after the phase                                                      // 8.32 revealed only until the end of the Admin Phase
  if (ph === 'movement' || ph === 'btMove') placeRiverAssaults(g);
  if (ph === 'movement' || ph === 'strategic' || ph === 'combat' || ph === 'reaction' || ph === 'btMove' || ph === 'btCombat')
    retreatExcess(g);
  if (ph === 'supply') {
    g.units.forEach((u) => {
      u.exploit = false;
    });
    const [p1, p2] = sidesOf(g),
      N = CUR.sideName;
    if (g.phasing === p1) g.phasing = p2;
    else {
      const v = victory(g),
        sd = g.inPlay ? null : (g.track ?? CUR.track)[g.turn - 1].sd;
      (g.vpHist ??= [])[g.turn - 1] = CUR.vpHist ? CUR.vpHist(g, v) : v.net;
      if (g.opts.scenario === 'cold')
        say(g, `Victory check: the Germans control ${coldAreas(g)} Zone 6 areas (11+ German victory, 10 draw, 9 or less Allied victory)`);
      else
        say(
          g,
          `Victory check: ${N[p1]} ${v[p1]}, ${N[p2]} ${v[p2]}, net ${v.net > 0 ? N[p1] + ' +' + v.net : v.net < 0 ? N[p2] + ' +' + -v.net : '0'}`,
        );
      if (sd && g.turn < g.lastTurn && ((v.net > 0 && v.net >= sd[0]) || (v.net < 0 && -v.net >= sd[1]))) {
        g.over = `Sudden death victory: ${v.net > 0 ? N[p1] : N[p2]} (net ${Math.abs(v.net)})`;
        return;
      }
      if (g.turn >= g.lastTurn) {
        g.over = CUR.finalResult(g, v.net);
        return;
      }
      g.turn++;
      g.phasing = p1;
      g.phase = 'reinforcement';
      reinforcementPhase(g);
      g.units.forEach((u) => {
        u.moved = false;
        u.spent = 0;
      });
      CUR.onPhase?.(g, 'reinforcement', 'start');
      say(g, 'reinforcement phase');
      return;
    }
    g.phase = 'admin';
    CUR.onPhase?.(g, 'admin', 'start');
    drawFor(g);
    return;
  }
  const order: Phase[] = ['reinforcement', 'admin', 'movement', 'strategic', 'combat', 'reaction', 'btMove', 'btCombat', 'supply'];
  g.phase = order[order.indexOf(ph) + 1];
  if (g.phase === 'admin') {
    CUR.onPhase?.(g, 'admin', 'start');
    drawFor(g);
  }
  if (g.phase === 'movement') {
    g.units.forEach((u) => {
      u.moved = false;
      u.spent = 0;
    });
    g.contestedAtMoveStart = contestedAreas(g);
    g.stratMoves = 0;
  }
  if (g.phase === 'strategic')
    g.units.forEach((u) => {
      u.moved = false;
      u.spent = 0;
    });
  if (g.phase === 'combat') g.fought = [];
  if (g.phase === 'reaction' || g.phase === 'btMove') {
    g.units.forEach((u) => {
      u.moved = false;
      u.spent = 0;
    });
    g.riverCross = [];
    g.blowTried = [];
    if (g.phase === 'btMove') g.contestedAtMoveStart = contestedAreas(g);
  } // 5.35c: per phase
  if (g.phase === 'btCombat') g.fought = [];
  if (g.phase === 'supply') supplyPhase(g);
  else CUR.onPhase?.(g, g.phase, 'start');
  say(g, 'phase start');
}
function drawFor(g: Game) {
  const [p1, p2] = sidesOf(g),
    i = g.phasing === p1 ? 0 : 1,
    t = (g.track ?? CUR.track)[g.turn - 1];
  const x1 = CUR.extraDraws?.(g, p1) ?? 0,
    x2 = CUR.extraDraws?.(g, p2) ?? 0;
  drawChits(g, p1, t.ge[i] + x1);
  drawChits(g, p2, t.al[i] + x2);
  say(g, `Admin draws: ${CUR.sideName[p1]} ${t.ge[i] + x1}, ${CUR.sideName[p2]} ${t.al[i] + x2}`);
  CUR.afterDraw?.(g);
}
/** The scenario's victory table: [condition, result]; the end of the game picks the matching row. */
export function victoryTable(g: Game): [string, string][] {
  if (g.opts.scenario === 'campaign')
    return [
      ['4+ German VP', 'German Operational Victory'],
      ['1–3 German VP', 'German Marginal Victory'],
      ['0', 'Draw'],
      ['1–3 Allied VP', 'Allied Marginal Victory'],
      ['4+ Allied VP', 'Allied Operational Victory'],
    ];
  if (g.opts.scenario === 'cold')
    return [
      ['11+ Zone 6 areas German', 'German Victory'],
      ['10 areas', 'Draw'],
      ['9 or less areas', 'Allied Victory'],
    ];
  if (g.opts.scenario === 'intro')
    return [
      ['Uncontested Bastogne', 'Decisive Victory'],
      ['More strength in Bastogne (Germans −2 per key area not held; tie: Allies)', 'Marginal Victory'],
    ];
  return [
    ['4+ German VP', 'German Operational Victory'],
    ['2–3 German VP', 'German Marginal Victory'],
    ['0–1 German VP', 'Allied Marginal Victory'],
    ['1+ Allied VP', 'Allied Operational Victory'],
  ];
}
export function finalResult(g: Game, net: number) {
  if (g.opts.scenario === 'campaign')
    return net >= 4
      ? 'German Operational Victory'
      : net >= 1
        ? 'German Marginal Victory'
        : net === 0
          ? 'Draw'
          : net >= -3
            ? 'Allied Marginal Victory'
            : 'Allied Operational Victory';
  return net >= 4
    ? 'German Operational Victory'
    : net >= 2
      ? 'German Marginal Victory'
      : net >= 0
        ? 'Allied Marginal Victory'
        : 'Allied Operational Victory';
}

/** Test hooks for rules that have no public entry point, and the helpers a volume module builds its rules on. */
export const updateControlForTest = updateControl;
export const allocateForTest = allocate;
export { updateControl, dropReserve, eliminate, needAdmin, supplied, fighters, roll as rollDie, check as moraleCheck };

/* ================= referee-lite: checks on a move written by the other browser ================= */
/** Who has to act now: one side, or both (Prepare phases). */
export function actorOf(g: Game): Side | 'both' {
  if (g.pendingBlow) {
    const u = g.units.find((x) => x.id === g.pendingBlow!.unit);
    return u ? other(u.side) : 'both';
  }
  {
    const s = CUR.pendingSide?.(g);
    if (s) return s;
  }
  const b = g.battle;
  if (b)
    return b.stage === 'setup'
      ? setupSide(g, b)
      : b.stage === 'loss' && b.loss
        ? b.loss.side
        : ['defArty', 'defFire', 'defChoice', 'retreat'].includes(b.stage)
          ? other(b.attacker)
          : b.attacker;
  if (g.phase === 'admin' || g.phase === 'reinforcement' || g.phase === 'deploy') return 'both'; // the set-up: each side places its own pieces
  return g.phase === 'reaction' ? other(g.phasing) : g.phasing;
}
const PHASE_ORDER: Phase[] = ['reinforcement', 'admin', 'movement', 'strategic', 'combat', 'reaction', 'btMove', 'btCombat', 'supply'];
const clock = (g: Game) =>
  g.phase === 'deploy' ? g.turn * 1000 - 1 : g.turn * 1000 + (g.phasing === sidesOf(g)[0] ? 0 : 500) + PHASE_ORDER.indexOf(g.phase);
/** Without a server nobody stops a modified browser from writing a false game; each browser checks what the other one wrote and warns.
 *  `writer` is the side whose account wrote the change (null: an admin or unknown). Returns plain-language problems, empty when all is well. */
export function auditChange(prev: Game, next: Game, writer: Side | null): string[] {
  const out: string[] = [];
  if (isRestore(prev, next)) return []; // a restore is reported on its own (restoreNote)
  if (next.turn === 1 && next.log.length < prev.log.length && clock(next) < clock(prev)) return ['The game was restarted.'];
  if (clock(next) < clock(prev)) out.push(`The game went back from turn ${prev.turn} ${prev.phase} to turn ${next.turn} ${next.phase}.`);
  if (next.rolls < prev.rolls) out.push('The dice counter went backwards: rolls were undone.');
  const a = prev.battle,
    b = next.battle;
  if (a && b && a.area === b.area && JSON.stringify(b.rolls.slice(0, a.rolls.length)) !== JSON.stringify(a.rolls))
    out.push('Dice already rolled in this battle were changed.');
  const actor = actorOf(prev);
  const hid = (u?: Unit) => !!u && u.name === 'Hidden block',
    bare = (g: Game, o: Game) =>
      JSON.stringify({
        ...g,
        log: [],
        revealed: null,
        units: g.units.map((u, i) => (hid(u) || hid(o.units[i]) ? { side: u.side, area: u.area } : u)),
      }); // a hidden block re-coded or hidden again is not a move
  if (writer && actor !== 'both' && actor !== writer && bare(next, prev) !== bare(prev, next))
    out.push(
      `The ${CUR.sideName[writer] ?? writer} player changed the game while it was the ${CUR.sideName[actor] ?? actor} player's turn to act.`,
    );
  return out;
}

/** True when `next` is a restore: the other player's rules check put the game back to the last legal position. */
export const isRestore = (prev: Game, next: Game) => !!next.restored && next.restored.t !== prev.restored?.t;
/* ================= The Bulge, registered as the first volume: its exclusive rules are the hooks above ================= */
registerHooks('bulge', {
  newGame: bulgeNewGame,
  markerKey: bulgeMarkerKey,
  reach: bulgeReach,
  moveOk: (_g, u, a) => britishOk(u, a),
  beforeMove: bulgeBeforeMove,
  afterMove: bulgeAfterMove,
  stratAllowed: bulgeStratAllowed,
  stratStep: bulgeStratStep,
  afterStrat: bulgeAfterStrat,
  successNumber,
  canAssign: bulgeCanAssign,
  moraleSn: bulgeMoraleSn,
  retreatOk: bulgeRetreatOk,
  sources: bulgeSources,
  supplyStep: bulgeSupplyStep,
  supplyFree: (g, side, a) => airSup(g).some((s) => s.side === side && s.area === a),
  noRetreat: (_g, u) => !!u.garrison && (u.id.startsWith('G') || u.id.startsWith('TF-')), // 16.21, 16.22: garrisons and task forces never retreat
  victory: seriesVictory,
  finalResult: bulgeFinal,
  onPhase: bulgeSupplyHook,
  beforeRecycle: bulgeBeforeRecycle,
  vpHist: (g, v) => (g.opts.scenario === 'cold' ? coldAreas(g) : v.net),
} as Partial<Volume>);
