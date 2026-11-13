import entryJson from '../../data/bulge/entry_areas.json';
import { areas, connection, edgeKey, neighbors, allNeighbors, setPlayArea, zoneOf } from './map';
import { d10, rng, succeeds } from './dice';
import { moraleSn, successNumber, type Quality, type Shooter } from './combat';
import { chitClass, isArty, isBattleAsset, type Chit, type Side } from './chits';
import { CUR, registerHooks, useGame, type Volume } from './volumes';
import { bulgeNewGame, coldAreas } from './vol/bulge-setup';
export * from './vol/bulge-setup';
import {
  AIRBORNE,
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
  clearInterdict,
  pz150Check,
  pz150In,
} from './vol/bulge';
export * from './vol/bulge';
import { autoArrive, drawChits, reinforcementPhase } from './reinforce';
export * from './reinforce';
import { airSup, check, needAdmin, saAvailable, spendSA, supplied } from './admin';
export * from './admin';
import { dropReserve, endMove } from './moves';
export * from './moves';
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
const stackMax = (g: Game, a: number) => CUR.stackLimit?.(g, a) ?? 2;
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
/** Neighbours a supply line may use: the play area, plus Cold Shoulder's supply-only Zone 5 (P.6). */
const supN = (g: Game, a: number) =>
  g.supplyOnly ? allNeighbors(a).filter((n) => g.inPlay!.includes(n) || g.supplyOnly!.includes(n)) : neighbors(a);
export function inSupply(g: Game, side: Side, start: number) {
  setPlayArea(g.inPlay);
  if (CUR.supplyFree?.(g, side, start)) return true; // 17.2 Air Supply Mission (The Bulge); Mt Hermon, the Assembly areas (Golan)
  const src = CUR.sources(g, side);
  const seen = new Set([start]),
    todo = [start];
  while (todo.length) {
    const a = todo.pop()!;
    if (src.has(a) && g.control[a] === side) return true;
    for (const n of supN(g, a)) {
      if (seen.has(n) || g.control[n] !== side || !(CUR.supplyStep ?? bulgeSupplyStep)(g, side, a, n, a === start)) continue;
      seen.add(n);
      todo.push(n);
    }
  }
  return false;
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

/* ================= combat ================= */
const fighters = (g: Game, a: number, side: Side, attacker: boolean) =>
  unitsIn(g, a, side).filter((u) => !u.ghost && !(attacker && (u.disorder > 0 || u.fort)));
export const point = (g: Game, b: Battle, side: Side) =>
  g.units.find((x) => x.id === (side === b.attacker ? b.attPoint : b.defPoint)) ?? null;
const pointOrder = (x: Unit, y: Unit) => +!!x.garrison - +!!y.garrison || +!!x.fort - +!!y.fort || y.str - x.str; // regular blocks before strongpoints before standing assets
function fixPoint(g: Game, b: Battle) {
  for (const side of sidesOf(g)) {
    const p = point(g, b, side);
    if (p && p.area === b.area) continue;
    const us = fighters(g, b.area, side, side === b.attacker);
    if (!us.length) continue;
    const n = [...us].sort(pointOrder)[0].id;
    if (side === b.attacker) b.attPoint = n;
    else b.defPoint = n;
  }
}
/** The area the volume says must be fought before any other now (Golan 15.3), while it is still contested and unfought. */
export function firstBattle(g: Game): number | null {
  const f = CUR.firstBattle?.(g);
  return f != null && contested(g, f) && !g.fought.includes(f) ? f : null;
}
export function startBattle(g: Game, a: number, viaSA = false, chitId?: string): Battle {
  if (g.battle) throw new Error('a battle is already open');
  const bt = g.phase === 'btCombat';
  if ((g.phase !== 'combat' && !bt && !CUR.battleAllowed?.(g, a)) || !contested(g, a) || g.fought.includes(a))
    throw new Error('no battle here');
  const att = fighters(g, a, g.phasing, true).filter((u) => !u.garrison || !!CUR.battleAllowed?.(g, a)), // a landing flank asset fights its own round (Sicily 17.22)
    def = fighters(g, a, other(g.phasing), false);
  if (!att.length) throw new Error('no attacker in good order');
  {
    const f = firstBattle(g);
    if (f != null && f !== a) throw new Error(`the battle in ${areas.get(f)!.name} must be fought first`);
  }
  let lockedAtStart = false;
  if (bt && !newlyContested(g).includes(a)) {
    if (CUR.freeBattle?.(g, a)) {
      say(g, 'a free Breakthrough combat round');
      lockedAtStart = true;
    } // the round is spent: the battle cannot be withdrawn
    else {
      if (!viaSA) throw new Error('re-engaging an already contested area costs a Special Action');
      spendSA(g, g.phasing, [...new Set(att.map((u) => u.ech!))], 'breakthrough combat', chitId, a);
      lockedAtStart = true;
    } // 8.1: an event of the attackers' echelon
  }
  const pick = (us: Unit[]) => [...us].sort(pointOrder)[0]?.id ?? '',
    empty = <T>(v: T) => Object.fromEntries(sidesOf(g).map((s) => [s, structuredClone(v)])) as Record<Side, T>;
  const b: Battle = {
    area: a,
    attacker: g.phasing,
    attPoint: pick(att),
    defPoint: pick(def),
    bt,
    riverAssault: g.riverAssault.includes(a),
    stage: 'setup',
    queue: [],
    assets: empty<string[]>([]),
    air: {},
    pending: 0,
    engFw: false,
    rolls: [],
    exploit: false,
    unitHit: empty(false),
    mark: g.log.length,
    hit: empty<string[]>([]),
    ready: [],
    locked: lockedAtStart,
    defSA:
      saAvailable(g, other(g.phasing)).length > 0 &&
      [a, ...neighbors(a)].some((n) => unitsIn(g, n, other(g.phasing)).some((u) => !u.garrison && !u.fort && !u.ghost)),
  };
  {
    const pz = pz150In(g, b);
    if (pz) {
      if (pz.side === b.attacker) b.attPoint = pz.id;
      else b.defPoint = pz.id;
    }
  }
  g.battle = b;
  return b;
}
/* --- assets (6.22, 6.23, 6.31, 16.1, 16.12, 16.23, 15.2) --- */
function echelons(g: Game, b: Battle, side: Side) {
  const set = new Set<string>();
  for (const u of unitsIn(g, b.area, side))
    if (!u.garrison)
      set.add(u.ech === 'de_sr' ? ({ 5: 'de_5pz', 6: 'de_6pz', 7: 'de_7a' } as Record<number, string>)[zoneOf(b.area)] : u.ech!);
  return set;
}
export function assetLimits(g: Game, b: Battle, side: Side) {
  const attacker = side === b.attacker,
    ech = echelons(g, b, side),
    us = side === 'allied' && [...ech].some((e) => e.startsWith('us_'));
  const pooled = g.pooled === b.area && us && [...ech].every((e) => e.startsWith('us_')),
    pure = [...ech].filter((e) => e !== 'us_sr'),
    mixed = pure.length > 1 && !pooled; // 14.62b
  const onlyAssets = unitsIn(g, b.area, side).every((u) => u.garrison),
    vsDR = unitsIn(g, b.area, other(side)).some((u) => u.id.startsWith('DR-') || u.heydte); // 16.23: no extra US artillery in a battle with a defended roadblock
  return {
    arty: (attacker ? 2 : 1) + (us && !mixed && !onlyAssets && !vsDR ? 1 : 0),
    battle: !mixed && !onlyAssets,
    event: !mixed && !onlyAssets,
    mixed,
    pure,
    ech,
    pooled,
  };
}
/** 6.21-6.24: whose step it is in a battle's set-up. The Defender decides on a Special Action, then the Attacker assigns assets, then the Defender
 *  assigns his and designates his point unit, then the Attacker designates his point unit and begins the round (a second setReady). A volume may hand the step over for an answer (Golan: SAM, jamming). */
export function setupSide(g: Game, b: Battle): Side {
  return CUR.setupActor?.(g, b) ?? orderSide(b);
}
const orderSide = (b: Battle): Side => {
  const def = other(b.attacker),
    r = b.ready ?? [];
  return b.defSA ? def : r.length === 2 ? b.attacker : r.includes(b.attacker) ? def : b.attacker;
};
const attackerBegun = (b: Battle) => !!b.ready?.includes(b.attacker) || b.assets[b.attacker].length > 0 || !!b.air[b.attacker];
/** 6.21: the Defender goes on without a Special Action. */
export function passSA(g: Game, b: Battle) {
  if (b.stage !== 'setup' || !b.defSA) throw new Error('no Special Action decision pending');
  b.defSA = false;
}
const notYourStep = (g: Game, b: Battle, side: Side) =>
  b.defSA
    ? 'the Defender first decides on a Special Action (6.21)'
    : side === setupSide(g, b)
      ? null
      : side === b.attacker
        ? 'your assets are committed: now the Defender assigns (6.23)'
        : 'the Attacker assigns his assets first (6.22)';
const committed = (b: Battle, side: Side) =>
  b.ready?.includes(side) ? (side === b.attacker ? 'your assets are committed (6.22)' : 'your assets are committed (6.23)') : null;
export function canAssign(g: Game, b: Battle, side: Side, c: Chit, mode?: 'arty' | 'support'): string | null {
  if (b.stage !== 'setup') return 'assets are committed before the first roll';
  {
    const w = notYourStep(g, b, side) ?? committed(b, side);
    if (w) return w;
  }
  if (c.side !== side || c.box !== 'available') return 'not in the Available Box';
  return CUR.canAssign(g, b, side, c, mode);
}
export function assign(g: Game, b: Battle, id: string, mode?: 'arty' | 'support', unit?: string) {
  const c = chit(g, id),
    err = canAssign(g, b, c.side, c, mode);
  if (err) throw new Error(err);
  c.box = 'map';
  if (c.kind === 'air_mission') {
    const a = { id, mode: mode ?? 'arty', unit };
    if (b.air[c.side]) (b.air2 ??= {})[c.side] = a;
    else b.air[c.side] = a;
  } else b.assets[c.side].push(id);
  CUR.onAssign?.(g, b, c, mode, unit);
}
/** Take an asset back, in its owner's own set-up step only. */
export function unassign(g: Game, b: Battle, id: string) {
  const s = chit(g, id).side;
  if (s === orderSide(b) && !committed(b, s)) dropAsset(g, b, id);
} /* an air mission may be taken back while its SAM answer waits (16.12) */
function dropAsset(g: Game, b: Battle, id: string) {
  const c = chit(g, id);
  if (b.stage !== 'setup' || CUR.keepAssigned?.(g, b, c)) return;
  c.box = 'available';
  b.assets[c.side] = b.assets[c.side].filter((x) => x !== id);
  dropAir(b, c.side, id);
  CUR.onUnassign?.(g, b, c);
}
/** The air assets a side committed to a battle (one, or two in Golan '73). */
export const airOf = (b: Battle, side: Side) =>
  [b.air[side], b.air2?.[side]].filter((a): a is { id: string; mode: 'arty' | 'support'; unit?: string } => !!a);
export function dropAir(b: Battle, side: Side, id: string) {
  if (b.air[side]?.id === id) delete b.air[side];
  if (b.air2?.[side]?.id === id) delete b.air2[side];
  if (!b.air[side] && b.air2?.[side]) {
    b.air[side] = b.air2[side];
    delete b.air2[side];
  }
}
/* --- fire --- */
export interface Fire {
  key: string;
  who: string;
  shooter: Shooter;
  dice: number;
  sn: number;
  parts: [string, number][];
  isAsset: boolean;
}
/** 6.33: the attacker's engineer will remove the enemy field works before offensive fire (chosen, field works there, engineer still in the battle). */
export const engRemovesFw = (g: Game, b: Battle) =>
  b.engFw &&
  g.fieldWorks.includes(b.area) &&
  (g.fwOwner[b.area] ?? other(b.attacker)) !== b.attacker &&
  b.assets[b.attacker].some((id) => chit(g, id).kind === 'engineer');
export function fireList(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground', ghost?: Unit): Fire[] {
  const att = side === b.attacker,
    tp = ghost ?? point(g, b, other(side));
  if (!tp) return [];
  const out: Fire[] = [],
    tgt = {
      pointCls: tp.cls,
      pointQuality: quality(tp),
      strongpoint: tp.fort,
      fieldWorks:
        att &&
        g.fieldWorks.includes(b.area) &&
        (g.fwOwner[b.area] ?? other(side)) === other(side) &&
        !(kind === 'ground' && engRemovesFw(g, b)),
      riverAssaultMarker: !att && b.riverAssault,
    };
  const set = {
    attacker: att,
    tdn: areas.get(b.area)!.tdn,
    riverAssault: att && b.riverAssault,
    advArty: g.opts.advArty,
    night: CUR.isNight?.(g),
  };
  const add = (key: string, who: string, shooter: Shooter, isAsset: boolean) => {
    const r = CUR.successNumber({ side, ...shooter }, tgt, set);
    out.push({ key, who, shooter, dice: shooter.dice, sn: r.sn, parts: r.parts, isAsset });
  };
  if (kind === 'arty') {
    for (const id of b.assets[side]) {
      const c = chit(g, id);
      if (isArty(c)) add(id, c.name, { kind: 'artillery', cls: 'infantry', dice: 1, rocket: c.kind === 'rocket_artillery' }, true);
    }
    for (const a of airOf(b, side))
      if (a.mode === 'arty') add(a.id, 'Air Mission (artillery)', { kind: 'air', cls: 'infantry', dice: 1 }, true);
  } else {
    for (const u of fighters(g, b.area, side, att)) {
      if (u.paradrop === 'partial') continue;
      const sup = airOf(b, side).some((a) => a.mode === 'support' && a.unit === u.id);
      add(
        u.id,
        u.name,
        {
          kind: u.garrison ? 'battle' : 'unit',
          cls: u.cls,
          quality: quality(u),
          dice: u.fort ? 1 : u.str,
          disordered: u.disorder > 0,
          unsupplied: u.unsupplied,
          airSupport: sup,
          closeAirSupport: sup,
          strongpoint: u.fort,
        },
        !!u.garrison,
      );
    }
    let skipEng = att && kind === 'ground' && engRemovesFw(g, b); // 6.33: one engineer does the job instead of firing, the others fire
    for (const id of b.assets[side]) {
      const c = chit(g, id);
      if (!isBattleAsset(c)) continue;
      if (skipEng && c.kind === 'engineer') {
        skipEng = false;
        continue;
      }
      add(id, c.name, { kind: 'battle', cls: chitClass(c), quality: c.q, dice: 1 }, true);
    }
  }
  CUR.adjustFire?.(g, b, side, kind, out);
  return out;
}
function doFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground', engBusy = false) {
  CUR.beforeFire?.(g, b, side, kind);
  let total = 0;
  let skip = engBusy;
  for (const f of fireList(g, b, side, kind).filter((x) => {
    if (skip && b.assets[side].includes(x.key) && chit(g, x.key).kind === 'engineer') {
      skip = false;
      return false;
    }
    return true;
  })) {
    const dice = Array.from({ length: f.dice }, () => roll(g)),
      hits = dice.filter((d) => succeeds(d, f.sn)).length;
    total += hits;
    b.rolls.push({ who: f.who, sn: f.sn, dice, hits, kind });
  }
  say(g, `${areas.get(b.area)!.name}: ${side} ${kind === 'arty' ? 'artillery' : 'ground fire'} ${total} hit(s)`);
  CUR.afterFire?.(g, b, side, kind);
  return total;
}
function eliminate(g: Game, u: Unit) {
  say(g, `${u.name} eliminated`);
  if (u.max >= 3 && !u.garrison && !u.fort) g.elimLarge.push(u.id);
  u.area = null;
  u.str = 0;
  dropReserve(g, u);
  if (u.chitId) chit(g, u.chitId).box = 'eliminated';
  if (u.interdict) {
    chit(g, u.interdict).box = 'eliminated';
    u.interdict = undefined;
  }
}
function stepLoss(g: Game, b: Battle, side: Side, key: string) {
  const c = g.chits.find((x) => x.id === key);
  if (c) {
    c.box = 'eliminated';
    b.assets[side] = b.assets[side].filter((x) => x !== key);
    say(g, `${c.name} eliminated`);
    return;
  }
  const u = g.units.find((x) => x.id === key)!;
  if (!u.garrison && CUR.absorbLoss?.(g, b, side, u)) {
    b.unitHit[side] = true;
    return;
  } // the volume takes the hit another way (a recovery marker)
  u.str -= 1;
  if (u.str <= 0 || u.garrison) eliminate(g, u);
  else say(g, `${u.name} loses a step`);
  if (!u.garrison) b.unitHit[side] = true;
}
/** 6.43 step losses still to place: `then` says what follows (the attacker's remaining hits, or the defender's, with its retreat option and kind of fire). */
export interface LossRun {
  side: Side;
  left: number;
  then: 'att' | 'def';
  kind?: 'arty' | 'ground';
  retreat?: boolean;
  h?: number;
  excess?: number;
}
/** Who may take the next step loss (6.43): everyone present takes one before anyone takes a second (across the battle's volleys), the first unit loss is the
 *  point unit's (battle assets may go before it), and the volume's limits. Sorted with the suggested pick first: assets, then the point unit, then the weakest.
 *  null: nothing is left to take it. */
function lossCands(g: Game, b: Battle, side: Side): string[] | null {
  fixPoint(g, b);
  const ps = lossPool(g, b, side);
  if (!ps.length) return null;
  const hit = new Set<string>(b.hit?.[side] ?? []);
  let cand = ps.filter((p) => !hit.has(p.key));
  if (!cand.length) cand = ps;
  const pid = side === b.attacker ? b.attPoint : b.defPoint;
  if (!b.unitHit[side] && cand.some((p) => p.key === pid)) cand = cand.filter((p) => p.asset || p.key === pid);
  if (CUR.lossOk) {
    const ok = cand.filter((p) => CUR.lossOk!(g, b, side, p.key));
    if (ok.length) cand = ok;
  } // e.g. a flanking unit takes no hits while its point unit stands
  cand.sort((x, y) => +!x.asset - +!y.asset || +(x.key !== pid) - +(y.key !== pid) || x.str - y.str);
  return cand.map((p) => p.key);
}
const lossPool = (g: Game, b: Battle, side: Side) => [
  ...b.assets[side]
    .filter((id) => isBattleAsset(chit(g, id)) || !!CUR.lossAsset?.(g, b, side, id))
    .map((id) => ({ key: id, asset: true, str: 1 })),
  ...unitsIn(g, b.area, side)
    .filter((u) => side !== b.attacker || !(u.disorder > 0 || u.fort))
    .map((u) => ({ key: u.id, asset: !!u.garrison, str: u.str })),
]; // 6.2: disordered units take no part for the attacker
function takeLoss(g: Game, b: Battle, side: Side, key: string) {
  b.hit ??= {};
  const hit = new Set<string>(b.hit[side] ?? []);
  if (lossPool(g, b, side).every((p) => hit.has(p.key))) hit.clear(); // everyone has taken one: a new round of 6.43
  stepLoss(g, b, side, key);
  hit.add(key);
  b.hit[side] = [...hit];
}
/** Place the losses of `run`: automatically while only one block or asset may take the next one (or `auto`), otherwise the owner picks (stage 'loss'). */
function runLosses(g: Game, b: Battle, run: LossRun, auto = false) {
  while (run.left > 0) {
    const cand = lossCands(g, b, run.side);
    if (!cand) {
      run.excess = (run.excess ?? 0) + run.left;
      run.left = 0;
      break;
    }
    if (cand.length > 1 && !auto) {
      b.loss = run;
      b.stage = 'loss';
      return;
    }
    takeLoss(g, b, run.side, cand[0]);
    run.left--;
  }
  b.loss = undefined;
  if (run.then === 'att') {
    b.pending = 0;
    return next(g, b);
  }
  afterDefLosses(g, b, run.kind!, !!run.retreat, run.h ?? 0, run.excess ?? 0);
}
/** The blocks and battle assets that may take the next step loss now (6.43), the suggested one first. */
export function lossOptions(g: Game, b: Battle): string[] {
  return b.stage === 'loss' && b.loss ? (lossCands(g, b, b.loss.side) ?? []) : [];
}
/** 6.43: the owner places one step loss. */
export function chooseLoss(g: Game, b: Battle, key: string) {
  if (b.stage !== 'loss' || !b.loss) throw new Error('no loss to place');
  if (!lossOptions(g, b).includes(key))
    throw new Error(
      "that block or asset cannot take this loss (6.43: everyone takes one before anyone takes a second; the first unit loss is the point unit's)",
    );
  const run = b.loss;
  takeLoss(g, b, run.side, key);
  run.left--;
  runLosses(g, b, run);
}
/** The rest of the losses in the suggested order (assets first, then the point unit, then the weakest). */
export function autoLosses(g: Game, b: Battle) {
  if (b.stage !== 'loss' || !b.loss) throw new Error('no loss to place');
  runLosses(g, b, b.loss, true);
}
/** One automatic loss (the first hit on an attacker with no battle asset: always the point unit). */
function allocate(g: Game, b: Battle, side: Side, n: number) {
  for (let i = 0; i < n; i++) {
    const c = lossCands(g, b, side);
    if (!c) return n - i;
    takeLoss(g, b, side, c[0]);
  }
  return 0;
}
const allGone = (g: Game, b: Battle, side: Side) =>
  !unitsIn(g, b.area, side).length && !b.assets[side].some((id) => isBattleAsset(chit(g, id)));
function next(g: Game, b: Battle) {
  fixPoint(g, b);
  if (!unitsIn(g, b.area, b.attacker).filter((u) => !u.garrison || !!CUR.battleAllowed?.(g, b.area)).length)
    return end(g, b, 'Attacker eliminated'); // Sicily 17.22: a flanking invasion attacks alone
  if (!fighters(g, b.area, b.attacker, true).length) {
    b.queue = [];
    return end(g, b, 'No attacker left in good order');
  } // 6.2: disordered units cannot carry the attack
  if (b.pz150 && (!b.queue.length || b.queue[0] === 'defFire' || b.queue[0] === 'offFire')) {
    pz150Check(g, b);
    const def = other(b.attacker);
    if (allGone(g, b, def)) {
      b.result = 'Defender eliminated';
      b.queue = [];
      return end(g, b, b.result);
    }
  }
  const s = b.queue.shift();
  if (!s) return end(g, b, b.result ?? 'Area remains contested');
  if (s === 'attArty' || s === 'defArty') {
    const side = s === 'attArty' ? b.attacker : other(b.attacker);
    if (!fireList(g, b, side, 'arty').length) return next(g, b);
  }
  b.stage = s;
  return;
}
/** 6.24, 5.22: may `side` read this block? Own blocks, face-up blocks, a block in an area where enemy blocks are face-up, and the Intelligence Gathering target. Chits are always face-up. */
/** Blocks that were face-up in a battle stand up again once their area is no longer contested. */
export function settleUp(g: Game) {
  for (const u of g.units) if (u.up != null && (u.up !== u.area || !contested(g, u.up))) u.up = undefined;
}
export function visibleTo(g: Game, u: Unit, side: Side | 'spectator' | null): boolean {
  if (side === null || u.side === side || u.garrison || g.revealed === u.id || u.area == null) return true;
  if (side !== 'spectator' && CUR.seenBy?.(g, u, side)) return true; // a volume's own reveal (Golan air reconnaissance, 16.31c)
  if (u.up === u.area && contested(g, u.area)) return true; // face-up only while the area stays contested (the blocks stand up again when the enemy leaves)
  return g.units.some((x) => x.area === u.area && x.side !== u.side && x.up === u.area);
}
export function beginCombat(g: Game, b: Battle) {
  if (b.stage !== 'setup') throw new Error('already started');
  CUR.beforeBegin?.(g, b);
  for (const u of g.units) if (u.area === b.area && !u.garrison) u.up = b.area; // 6.24 units are revealed once both point units are designated
  CUR.onBattle?.(g, b, 'begin');
  fixPoint(g, b);
  if (!fighters(g, b.area, other(b.attacker), false).length) {
    b.result = 'Defender eliminated';
    b.exploit = false;
    return end(g, b, b.result);
  } // only ghosts stood there (Golan 15.7): removed, not eliminated by fire, so no exploitation (6.8)
  {
    const pz = pz150In(g, b);
    if (pz) {
      if (pz.side === b.attacker) b.attPoint = pz.id;
      else b.defPoint = pz.id;
      b.pz150 = pz.id;
      g.pz150Done = true;
      say(g, '150th Panzer Brigade, first battle: it is the point unit (18.4)');
    }
  }
  b.defStart = unitsIn(g, b.area, other(b.attacker)).map((u) => u.id); // 18.7
  b.queue = ['attArty', 'defArty', 'defFire', 'offFire'];
  next(g, b);
}
/** Hot-seat shortcut stays beginCombat; online each side confirms its set-up and combat starts when both are ready. */
export function setReady(g: Game, b: Battle, side: Side, on = true) {
  if (b.stage !== 'setup') throw new Error('already started');
  if (!on) throw new Error('assets once committed stay committed (6.22, 6.23)');
  {
    const w = notYourStep(g, b, side);
    if (w) throw new Error(w);
  }
  const r = (b.ready ??= []);
  if (!r.includes(side)) r.push(side);
  else if (side === b.attacker && r.length === 2) b.attPointDone = true;
  else throw new Error('already done');
  if (b.attPointDone && !g.deferBegin) beginCombat(g, b);
}
/** Withdraw from a battle that has not rolled yet, returning every assigned asset. Not possible once a Special Action was spent. */
export function cancelBattle(g: Game) {
  const b = g.battle;
  if (!b) throw new Error('no battle');
  if (b.stage !== 'setup') throw new Error('combat has begun');
  if (b.locked) throw new Error('a Special Action was spent; the battle cannot be withdrawn');
  if (b.ready?.includes(b.attacker)) throw new Error('the Attacker has committed his assets: the battle is fought (6.22)');
  for (const id of sidesOf(g).flatMap((s) => [...(b.assets[s] ?? []), ...airOf(b, s).map((a) => a.id)])) dropAsset(g, b, id);
  g.battle = null;
}
export const exploitSn = (g: Game, u: Unit) => CUR.moraleSn(g, u, 'exploit');
export function roll_step(g: Game, b: Battle) {
  const st = b.stage;
  if (st === 'loss') return autoLosses(g, b); // "roll on": the losses go in the suggested order
  if (st === 'exploit') {
    // 6.8: each attacking armor-class unit rolls; a pass earns the exploitation marker
    for (const id of b.exploitIds ?? []) {
      const u = g.units.find((x) => x.id === id)!;
      if (u.area !== b.area) continue;
      const sn = exploitSn(g, u),
        r = roll(g),
        ok = succeeds(r, sn);
      if (ok) u.exploit = true;
      b.rolls.push({ who: u.name, sn, dice: [r], hits: ok ? 1 : 0, kind: 'morale' });
      say(g, `${u.name} exploitation morale check: rolled ${r} (needs ${sn} or less) → ${ok ? 'exploitation marker' : 'failed'}`);
    }
    b.exploitIds = undefined;
    b.stage = 'done';
    return;
  }
  if (st === 'attArty') {
    const h = doFire(g, b, b.attacker, 'arty');
    return hitDefender(g, b, h, 'arty');
  }
  if (st === 'defArty' || st === 'defFire') {
    const h = doFire(g, b, other(b.attacker), st === 'defArty' ? 'arty' : 'ground');
    b.lossKind = st === 'defArty' ? 'arty' : 'ground';
    return hitAttacker(g, b, h);
  }
  if (st === 'offFire') {
    const eng = engRemovesFw(g, b); // 6.33: after artillery and defensive fire, before the attackers fire; the engineer does not fire
    if (eng) {
      g.fieldWorks = g.fieldWorks.filter((x) => x !== b.area);
      say(g, 'engineer removes the field works (6.33)');
    }
    const h = doFire(g, b, b.attacker, 'ground', eng);
    return hitDefender(g, b, h, 'ground');
  }
  throw new Error('nothing to roll');
}
function hitAttacker(g: Game, b: Battle, h: number) {
  if (h > 0) {
    b.unitHit[b.attacker] = false;
    if (b.assets[b.attacker].some((id) => isBattleAsset(chit(g, id)))) {
      b.pending = h;
      b.stage = 'attFirst';
      return;
    } // 6.41a the attacker picks the point unit or one battle asset
    allocate(g, b, b.attacker, 1);
  }
  afterFirstHit(g, b, h - 1);
}
function afterFirstHit(g: Game, b: Battle, rest: number) {
  if (rest > 0 && unitsIn(g, b.area, b.attacker).some((u) => !u.garrison)) {
    b.pending = rest;
    b.stage = 'attChoice';
    return;
  }
  next(g, b);
}
/** 6.41a: the first hit on the attacker falls on the point unit or on any one assigned battle asset, the player's choice. */
export function chooseFirstLoss(g: Game, b: Battle, key: string) {
  if (b.stage !== 'attFirst') throw new Error('no choice pending');
  const att = b.attacker;
  fixPoint(g, b);
  if (key !== b.attPoint && !b.assets[att].includes(key)) throw new Error('the first loss falls on the point unit or one battle asset');
  const h = b.pending;
  b.pending = 0;
  stepLoss(g, b, att, key);
  b.hit ??= {};
  b.hit[att] = [...new Set([...(b.hit[att] ?? []), key])];
  afterFirstHit(g, b, h - 1);
}
export function attackerChoice(g: Game, b: Battle, abort: boolean) {
  if (b.stage !== 'attChoice') throw new Error('no choice pending');
  if (abort) {
    {
      const why = CUR.canAbort?.(g, b);
      if (why) throw new Error(why);
    }
    const us = unitsIn(g, b.area, b.attacker).filter((u) => !u.garrison);
    if (b.riverAssault)
      for (const u of us) {
        const from = u.from;
        if (
          from != null &&
          neighbors(b.area).includes(from) &&
          g.control[from] === b.attacker &&
          !unitsIn(g, from, other(b.attacker)).length &&
          blocks(g, from, b.attacker).length < stackMax(g, from) &&
          (!CUR.retreatOk || CUR.retreatOk(g, u, b.area, from))
        ) {
          u.area = from;
          CUR.onRetreat?.(g, u, b.area, from);
        } else if (from != null) stepLoss(g, b, b.attacker, u.id);
      }
    for (const u of us) if (u.area != null) u.disorder = 1; // the ones that fell back are disordered too
    b.queue = [];
    return end(g, b, 'Attack aborted: attackers disordered' + (b.riverAssault ? ' and back across the river' : ''));
  }
  runLosses(g, b, { side: b.attacker, left: b.pending, then: 'att' });
}
function hitDefender(g: Game, b: Battle, h: number, kind: 'arty' | 'ground') {
  const def = other(b.attacker);
  {
    const p = point(g, b, def);
    if (p && p.area === b.area) b.lastDefPoint = { ...p };
  }
  if (h > 0 && g.fieldWorks.includes(b.area) && (g.fwOwner[b.area] ?? def) === def) {
    g.fieldWorks = g.fieldWorks.filter((x) => x !== b.area);
    h--;
    say(g, 'field works absorb 1 hit');
  }
  b.pending = h;
  b.pendingKind = kind;
  b.lossKind = kind;
  const real = fighters(g, b.area, def, false).filter((u) => !u.garrison);
  const canDis = kind === 'arty' && real.some((u) => u.disorder !== 1);
  const noRet = CUR.noRetreat ? unitsIn(g, b.area, def).filter((x) => CUR.noRetreat!(g, x)).length : 0; // 16.21: the garrison is destroyed first, the retreat needs a hit to spare
  const canRet = kind === 'ground' && real.some((u) => !u.fort) && h > noRet; // strongpoints never retreat (Golan 15.6)
  if (h > 0 && (canDis || canRet)) {
    b.stage = 'defChoice';
    return;
  }
  applyDef(g, b, h, kind, false);
}
export function defenderChoice(g: Game, b: Battle, use: boolean) {
  if (b.stage !== 'defChoice') throw new Error('no choice pending');
  const kind = b.pendingKind!,
    def = other(b.attacker);
  let h = b.pending;
  if (use && kind === 'arty') {
    for (const u of unitsIn(g, b.area, def))
      if (!u.garrison && u.disorder === 0) u.disorder = 1;
      else if (!u.garrison && u.disorder === 2) u.disorder = 1;
    h--;
    say(g, 'defenders disordered to absorb 1 hit');
  }
  applyDef(g, b, h, kind, use && kind === 'ground');
}
function applyDef(g: Game, b: Battle, h: number, kind: 'arty' | 'ground', retreat: boolean) {
  const def = other(b.attacker);
  if (retreat && CUR.noRetreat)
    for (const a of unitsIn(g, b.area, def).filter((x) => CUR.noRetreat!(g, x))) {
      say(g, `${a.name} cannot retreat: destroyed, counting as a hit (6.42c)`);
      eliminate(g, a);
      h = Math.max(0, h - 1);
    } // 6.42c (2016), 16.21: first
  if (retreat) h = Math.max(0, h - 1);
  runLosses(g, b, { side: def, left: h, then: 'def', kind, retreat, h });
}
function afterDefLosses(g: Game, b: Battle, kind: 'arty' | 'ground', retreat: boolean, h: number, excess: number) {
  const def = other(b.attacker);
  b.pending = 0;
  if (retreat) {
    b.retreat = {
      side: def,
      queue: unitsIn(g, b.area, def)
        .filter((x) => !x.garrison && !x.fort && !x.ghost)
        .map((x) => x.id),
      moved: false,
      after: kind,
      h,
      excess,
    };
    return advanceRetreat(g, b);
  }
  finishDef(g, b, kind, false, excess);
}
function finishDef(g: Game, b: Battle, kind: 'arty' | 'ground', retreated: boolean, excess: number) {
  const def = other(b.attacker);
  if (allGone(g, b, def)) {
    b.result = retreated ? 'Defender retreated' : 'Defender eliminated';
    b.exploit = !retreated && (kind === 'arty' || excess > 0);
    b.unabsorbed = excess;
    b.byArty = !retreated && kind === 'arty';
    b.queue = b.queue.filter((s) => s === 'defArty');
  }
  next(g, b);
}
/** Where a retreating block may go (6.6, 2016): an adjoining, uncontested, friendly-controlled area with room (one unit or fewer); when every such area
 *  is full, onward through them to the nearest uncontested friendly area with room. None: the block takes a step loss instead. */
export function retreatOptions(g: Game, b: Battle): number[] {
  setPlayArea(g.inPlay);
  const r = b.retreat;
  if (!r) return [];
  const u = g.units.find((x) => x.id === r.queue[0]); // the unit retreating now
  const room = (n: number) => (u ? roomFor(g, u, n) : blocks(g, n, r.side).length < stackMax(g, n));
  const opts = [...retreatPaths(g, b.area, r.side, u).keys()].filter(room);
  let out = u && CUR.retreatPrefer ? CUR.retreatPrefer(g, u, b.area, opts) : opts;
  if (!out.length && u && CUR.seaRetreat?.(g, u, b.area)) out = [SEA]; // Sicily 14.28: to sea when nothing else is open
  return out;
}
/** A retreat destination that is not an area: the sea (Sicily's At Sea box, 14.28). */
export const SEA = -1;
/** The retreat routes from the battle area: each reachable destination and the way there (adjoining areas with room first; past full ones only when all are full). */
function retreatPaths(g: Game, from: number, side: Side, u: Unit | undefined, zoneOnly = !!(u && CUR.retreatZone)): Map<number, number[]> {
  const ok = (f: number, n: number) =>
    g.control[n] === side &&
    !unitsIn(g, n, other(side)).length &&
    (!u || !CUR.retreatOk || CUR.retreatOk(g, u, f, n)) &&
    (!u || !CUR.moveOk || CUR.moveOk(g, u, n)) &&
    (!zoneOnly || CUR.retreatZone!(g, u!, n));
  const room = (n: number) => (u ? roomFor(g, u, n) : blocks(g, n, side).length < stackMax(g, n));
  const out = new Map<number, number[]>(),
    first = neighbors(from).filter((n) => ok(from, n));
  for (const n of first) if (room(n)) out.set(n, [from, n]);
  if (!out.size && zoneOnly && !first.some((n) => !room(n))) return retreatPaths(g, from, side, u, false); // 14.43: nothing in the own zone, then the other paths
  if (out.size || !first.length) return out;
  let ring = first.map((n) => [from, n]);
  const seen = new Set([from, ...first]);
  while (ring.length && !out.size) {
    // breadth first: the nearest areas with room
    const next: number[][] = [];
    for (const p of ring)
      for (const n of neighbors(p[p.length - 1])) {
        if (seen.has(n) || !ok(p[p.length - 1], n)) continue;
        seen.add(n);
        const q = [...p, n];
        if (room(n)) out.set(n, q);
        else next.push(q);
      }
    ring = next;
  }
  return !out.size && zoneOnly ? retreatPaths(g, from, side, u, false) : out;
}
function advanceRetreat(g: Game, b: Battle) {
  const r = b.retreat!;
  while (r.queue.length) {
    const u = g.units.find((x) => x.id === r.queue[0])!,
      opts = retreatOptions(g, b);
    if (!opts.length) {
      stepLoss(g, b, r.side, u.id);
      r.queue.shift();
      continue;
    }
    if (opts.length === 1) {
      moveRetreat(g, b, u, opts[0]);
      r.queue.shift();
      continue;
    }
    b.stage = 'retreat';
    return;
  }
  b.retreat = undefined;
  if (r.after === 'sa' && unitsIn(g, b.area, r.side).length) {
    b.stage = 'setup';
    say(
      g,
      `the units retreat; ${unitsIn(g, b.area, r.side)
        .map((u) => u.name)
        .join(', ')} stay and still fight`,
    );
    return;
  } // a garrison or defended roadblock cannot retreat: the battle goes on against it
  if (r.after === 'sa') {
    b.exploit = true;
    b.queue = [];
    return end(g, b, 'Defender retreated (Special Action): exploitation opportunity');
  }
  finishDef(g, b, r.after, r.moved, r.excess);
}
function moveRetreat(g: Game, b: Battle, u: Unit, to: number) {
  if (u.area == null) return;
  if (to === SEA) {
    const from = u.area;
    if (b.retreat!.after !== 'sa') u.disorder = 1;
    b.retreat!.moved = true;
    u.area = null;
    u.box = 'at_sea';
    dropReserve(g, u);
    CUR.onRetreat?.(g, u, from, SEA);
    updateControl(g, from);
    say(g, `${u.name} retreats to sea (14.28)`);
    return;
  }
  const path = retreatPaths(g, b.area, b.retreat!.side, u).get(to) ?? [u.area, to]; // past full areas when it must (6.6)
  if (b.retreat!.after !== 'sa') u.disorder = 1;
  b.retreat!.moved = true; // 8.24 a retreat before combat does not disorder
  for (let i = 1; i < path.length && u.area != null; i++) {
    const from = path[i - 1];
    u.area = path[i];
    CUR.onRetreat?.(g, u, from, path[i]);
    updateControl(g, from);
    updateControl(g, path[i]);
  }
  if (u.area != null)
    say(
      g,
      `${u.name} retreats to ${areas.get(u.area)!.name}${
        path.length > 2
          ? ` (through ${path
              .slice(1, -1)
              .map((a) => areas.get(a)!.name)
              .join(', ')}, full)`
          : ''
      }`,
    );
}
export function chooseRetreat(g: Game, b: Battle, to: number) {
  if (b.stage !== 'retreat' || !b.retreat) throw new Error('no retreat pending');
  if (!retreatOptions(g, b).includes(to)) throw new Error('cannot retreat there');
  moveRetreat(g, b, g.units.find((x) => x.id === b.retreat!.queue[0])!, to);
  b.retreat.queue.shift();
  advanceRetreat(g, b);
}
/** 18.7 Overrunning Artillery: the defending area is vacated; the attacker rolls one die per defending artillery asset (rocket included).
 *  SN 1 if the defender retreated with a step surviving, 2 if its units and battle assets were destroyed, +1 per unabsorbed hit. Destroyed by
 *  attacking artillery: the attacking units roll their ground fire as if the defender were still there; its hits count as unabsorbed. */
function overrun(g: Game, b: Battle) {
  const def = other(b.attacker),
    arts = b.assets[def].map((id) => chit(g, id)).filter((c) => isArty(c) && c.box === 'map');
  if (!arts.length || unitsIn(g, b.area, def).length || !unitsIn(g, b.area, b.attacker).some((u) => !u.garrison)) return;
  const survived = (b.defStart ?? []).some((id) => {
    const u = g.units.find((x) => x.id === id);
    return !!u && u.str > 0 && u.area != null && u.area !== b.area;
  });
  let extra = survived ? 0 : (b.unabsorbed ?? 0);
  if (!survived && b.byArty && b.lastDefPoint) {
    let hits = 0;
    for (const f of fireList(g, b, b.attacker, 'ground', b.lastDefPoint)) {
      const dice = Array.from({ length: f.dice }, () => roll(g));
      hits += dice.filter((d) => succeeds(d, f.sn)).length;
    }
    extra = hits;
    say(g, `overrunning artillery: the attackers' ground fire scores ${hits} unabsorbed hit(s) (18.7)`);
  }
  const sn = (survived ? 1 : 2) + extra;
  for (const c of arts) {
    const r = roll(g),
      ok = succeeds(r, sn);
    b.rolls.push({ who: `Overrun ${c.name} (18.7)`, sn, dice: [r], hits: ok ? 1 : 0, kind: 'morale' });
    if (ok) {
      c.box = 'eliminated';
      b.assets[def] = b.assets[def].filter((x) => x !== c.id);
    }
    say(g, `overrunning artillery: ${c.name} ${ok ? 'is destroyed' : 'escapes'} (rolled ${r}, needs ${sn} or less, 18.7)`);
    b.result = `${b.result ?? ''}${b.result ? ' · ' : ''}${c.name} ${ok ? 'overrun and destroyed' : 'escapes the overrun'} (18.7)`;
  }
}
function end(g: Game, b: Battle, result: string) {
  b.result = result;
  b.stage = 'done';
  if (g.opts.overrun) overrun(g, b);
  b.lastDefPoint = undefined; // a copy of a block: never left in the shared game
  for (const side of sidesOf(g))
    for (const id of b.assets[side] ?? []) {
      const c = chit(g, id);
      if (c.box === 'map') c.box = 'used';
    }
  for (const side of sidesOf(g)) for (const a of airOf(b, side)) chit(g, a.id).box = CUR.id === 'bulge' ? 'eliminated' : 'used'; // Bulge air missions are single-use; Golan air support recycles (16.31)
  CUR.onBattle?.(g, b, 'end');
  g.fought.push(b.area);
  for (const n of [b.area, ...neighbors(b.area)]) updateControl(g, n);
  say(g, `${areas.get(b.area)!.name}: ${result}`);
  g.battles = (g.battles ?? 0) + 1;
  const cand =
    b.exploit && !b.bt && !b.riverAssault
      ? unitsIn(g, b.area, b.attacker)
          .filter((x) => x.cls === 'armor' && !x.garrison && !x.unsupplied)
          .map((x) => x.id)
      : []; // 6.8: never from river assaults or Breakthrough combat; never an out-of-supply unit (2016)
  if (cand.length) {
    b.stage = 'exploit';
    b.exploitIds = cand;
    say(g, `exploitation opportunity: ${b.attacker} may roll a morale check for ${cand.length} armor-class unit(s) (6.8)`);
  }
}
/** 6.8: the attacker may decline the exploitation opportunity (and keep the blocks hidden). */
export function declineExploit(g: Game, b: Battle) {
  if (b.stage !== 'exploit') throw new Error('no exploitation pending');
  b.exploitIds = undefined;
  b.stage = 'done';
  say(g, `${b.attacker} declines the exploitation opportunity`);
}
export function closeBattle(g: Game) {
  if (g.battle?.stage !== 'done') throw new Error('battle not finished');
  g.battle = null;
  settleUp(g);
}
export function defenderRetreatSA(g: Game, b: Battle, chitId?: string) {
  if (b.stage !== 'setup' || (!b.defSA && attackerBegun(b)))
    throw new Error("only as the Defender's first decision, before the Attacker assigns assets (6.21)");
  const def = other(b.attacker);
  const us = unitsIn(g, b.area, def).filter((u) => !u.garrison && !u.fort && !u.ghost);
  if (!us.length) throw new Error('only units retreat: garrisons, defended roadblocks and strongpoints stay (16.21, 4.35, 15.6)');
  if (us.some((u) => u.unsupplied)) throw new Error('out-of-supply units may not be affected by Special Actions (9.34d)');
  spendSA(
    g,
    def,
    us.map((x) => x.ech!),
    'retreat before combat',
    chitId,
    b.area,
  );
  b.defSA = false;
  for (const id of [...b.assets[def], ...airOf(b, def).map((a) => a.id)]) dropAsset(g, b, id); // assets already assigned go back to the Available Box
  b.locked = true;
  us.forEach((x) => clearInterdict(g, x));
  b.retreat = { side: def, queue: us.map((u) => u.id), moved: false, after: 'sa', h: 0, excess: 0 };
  advanceRetreat(g, b);
}
export function defenderReinforceSA(g: Game, b: Battle, unitId: string, chitId?: string) {
  if (b.stage !== 'setup' || (!b.defSA && attackerBegun(b)))
    throw new Error("only as the Defender's first decision, before the Attacker assigns assets (6.21)");
  const def = other(b.attacker),
    u = g.units.find((x) => x.id === unitId)!;
  if (
    unitsIn(g, b.area, def).some((x) => x.id.startsWith('DR-') || x.heydte) ||
    (!CUR.reinforceOk && unitsIn(g, b.area, def).every((x) => x.garrison))
  )
    throw new Error('a battle of standing assets alone may not be reinforced (4.35)');
  if ((u.cls === 'armor' && connection(u.area!, b.area)?.restricted) || (CUR.moveOk && !CUR.moveOk(g, u, b.area)))
    throw new Error('that unit may not cross into the battle area (14.1, 14.43)');
  if (
    u.side !== def ||
    u.area == null ||
    !neighbors(b.area).includes(u.area) ||
    contested(g, u.area) ||
    u.disorder ||
    u.unsupplied ||
    u.garrison ||
    u.fort ||
    u.ghost ||
    !roomFor(g, u, b.area)
  )
    throw new Error('not a legal reinforcement');
  if (CUR.reinforceOk && !CUR.reinforceOk(g, b, u)) throw new Error('not a legal reinforcement here (8.23)');
  spendSA(g, def, u.ech, 'reinforce a battle', chitId, b.area);
  b.defSA = false;
  b.locked = true;
  b.reinforced = u.id;
  clearInterdict(g, u);
  const from = u.area;
  u.area = b.area;
  u.from = from;
  updateControl(g, from);
  say(g, `${u.name} reinforces ${areas.get(b.area)!.name}`);
}
export function activateBreakthrough(g: Game, unitId: string, chitId?: string) {
  const u = g.units.find((x) => x.id === unitId)!;
  if (
    g.phase !== 'btMove' ||
    u.side !== g.phasing ||
    u.cls !== 'armor' ||
    u.unsupplied ||
    u.disorder ||
    u.moved ||
    u.exploit ||
    u.area == null
  )
    throw new Error('needs a supplied armor unit in good order');
  spendSA(g, u.side, u.ech, 'breakthrough movement', chitId, u.area!);
  clearInterdict(g, u);
  u.exploit = true;
}
export function mustFight(g: Game) {
  const bt = g.phase === 'btCombat';
  if (g.phase !== 'combat' && !bt) return [];
  return [...new Set([...newlyContested(g), ...(CUR.mustFight?.(g) ?? [])])].filter(
    (a) => !g.fought.includes(a) && fighters(g, a, g.phasing, true).some((u) => !u.garrison),
  );
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
/** Who has a supply status: units, plus The Bulge's garrison and task force assets (16.21, 16.22: eliminated by a failed unsupplied morale check). */
const hasSupply = (x: Unit) =>
  !x.garrison || (CUR.id === 'bulge' && !x.id.startsWith('DR-') && !x.heydte) || (CUR.id === 'golan73' && x.id.startsWith('G-')); // Golan 16.24: garrisons too (raids and Lt. Zvika are always supplied)
function supplyPhase(g: Game) {
  CUR.onPhase?.(g, 'supply', 'start');
  for (const a of areas.keys()) updateControl(g, a);
  for (const u of g.units.filter((x) => x.area != null && hasSupply(x)))
    u.unsupplied = !(CUR.alwaysSupplied?.(g, u) || (CUR.unitSupply ? CUR.unitSupply(g, u) : inSupply(g, u.side, u.area!)));
  for (const u of g.units.filter((x) => x.area != null && x.fort)) u.unsupplied = false; // strongpoints are always in supply (Golan 15.6)
  for (const u of g.units.filter((x) => x.area != null && !x.unsupplied && x.disorder))
    if (!CUR.recoverOk || CUR.recoverOk(g, u)) u.disorder = u.disorder === 2 ? 0 : 2;
  g.riverAssault = [];
  if (!g.opts.fwMaintain) g.fieldWorks = g.fieldWorks.filter((a) => !contested(g, a));
  else
    for (const a of g.fieldWorks.filter((x) => contested(g, x) && (g.fwOwner[x] ?? g.control[x]) === g.phasing)) {
      // 18.8: in the owner's own Supply Phase, one unit (the best: the player's natural choice) checks morale
      const us = unitsIn(g, a, g.phasing).filter((u) => !u.garrison);
      if (!us.length) continue;
      const sn = (u: Unit) => moraleSn(quality(u), u.disorder > 0, u.unsupplied && !(g.opts.airborne && AIRBORNE.has(u.name)));
      const u = [...us].sort((x, y) => sn(y) - sn(x))[0],
        { r, ok } = check(
          g,
          u,
          sn(u),
          `Maintaining field works (${CUR.id === 'golan73' ? '18.1' : CUR.id === 'sicily' ? '18.4' : '18.8'})`,
        );
      if (!ok) g.fieldWorks = g.fieldWorks.filter((x) => x !== a);
      say(
        g,
        `field works in ${areas.get(a)!.name}: ${u.name} rolls ${r} → ${ok ? 'maintained' : 'removed'} (${CUR.id === 'golan73' ? '18.1' : CUR.id === 'sicily' ? '18.4' : '18.8'})`,
      );
    }
  g.roadblocks = {}; // 4.34
  for (const u of g.units.filter((x) => x.id.startsWith('DR-') && x.area != null)) {
    chit(g, u.chitId!).box = 'used';
    u.area = null;
    say(g, `${u.name} survives and returns to the Used Box`);
  } // 4.35
  for (const a of areas.keys()) updateControl(g, a);
  CUR.onPhase?.(g, 'supply', 'mid');
  g.units.forEach((u) => {
    u.exploit = false;
    u.adjOnly = false;
    if (u.side === other(g.phasing)) dropReserve(g, u);
  });
  g.supplyPending = true; // the player rolls the checks (rollSupply); endPhase rolls them if nobody did
}
/** 9.4 the units of the Phasing Player that must roll an out-of-supply morale check now, with the number each needs. */
/** Sicily 16.34: an Air Supply mission spares the units of its area the morale check (the marker stays). */
export const airSupplied = (g: Game, x: Unit) => airSup(g).some((s) => s.area === x.area && s.side === x.side);
/** Units events, Special Actions, staff and engineers may not help: unsupplied, or kept supplied only by an Air Supply mission (9.34d, 17.21). */
export const helpless = (g: Game, u: Unit) => u.unsupplied || airSupplied(g, u);
export function supplyChecks(g: Game) {
  return g.units
    .filter((x) => x.area != null && x.side === g.phasing && x.unsupplied && hasSupply(x) && !x.fort && !airSupplied(g, x))
    .map((u) => ({ unit: u, sn: CUR.moraleSn(g, u, 'supply'), rounds: CUR.id === 'bulge' && g.turn >= 6 ? 2 : 1 }));
}
export function rollSupply(g: Game) {
  if (!g.supplyPending) throw new Error('no supply checks pending');
  g.supplyPending = false;
  const rounds = CUR.id === 'bulge' && g.turn >= 6 ? 2 : 1; // 14.93 (The Bulge)
  for (const u of g.units.filter(
    (x) => x.area != null && x.side === g.phasing && x.unsupplied && hasSupply(x) && !x.fort && !airSupplied(g, x),
  ))
    for (let i = 0; i < rounds && u.area != null; i++) {
      const q = quality(u),
        { r, ok } = check(g, u, CUR.moraleSn(g, u, 'supply'), 'Out of supply morale check (9.4)');
      if (ok) continue;
      if (u.garrison) {
        eliminate(g, u);
        say(g, `${u.name} unsupplied, morale failed (${r}): eliminated (${CUR.id === 'golan73' ? '16.24' : '16.21'})`);
        continue;
      }
      if (!u.disorder) {
        u.disorder = 1;
        say(g, `${u.name} unsupplied, morale failed (${r}): disordered`);
      } else if ((q === 'veteran' && r === 10) || (q === 'green' && r >= 8)) {
        eliminate(g, u);
        say(g, `${u.name} surrenders (${r})`);
      } else {
        u.str -= 1;
        if (u.str <= 0) eliminate(g, u);
        say(g, `${u.name} unsupplied and disordered, morale failed (${r}): step loss`);
      }
    }
  for (const a of areas.keys()) updateControl(g, a); // eliminated units leave areas behind
  supplyCleanup(g);
}
function supplyCleanup(g: Game) {
  CUR.onPhase?.(g, 'supply', 'end');
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

/** The point unit a side designates for a battle (6.24), and the engineer's option to remove field works instead of firing (6.33): plain state changes, so they can travel as actions. */
export function setPoint(g: Game, b: Battle, side: Side, unitId: string) {
  if (b.stage !== 'setup') throw new Error('already started');
  const u = g.units.find((x) => x.id === unitId);
  {
    const w =
      notYourStep(g, b, side) ??
      (side === b.attacker && !b.ready?.includes(other(b.attacker)) ? 'the Defender designates his point unit first (6.24)' : null);
    if (w) throw new Error(w);
  }
  if (!u || u.side !== side || u.area !== b.area || u.garrison || u.ghost) throw new Error('not a legal point unit');
  if (side === b.attacker && u.disorder) throw new Error('a disordered unit cannot be the attacking point unit');
  if (side !== b.attacker && unitId === b.reinforced && g.units.some((x) => x.id === b.defPoint && x.area === b.area))
    throw new Error('the reinforcing unit may not be the point unit while the original point unit stands (8.23)');
  {
    const pz = pz150In(g, b);
    if (pz && pz.side === side && pz.id !== unitId)
      throw new Error('150th Panzer Brigade must be the point unit in its first battle (18.4)');
  }
  if (side === b.attacker) b.attPoint = unitId;
  else b.defPoint = unitId;
}
export function setEngFw(_g: Game, b: Battle, on: boolean) {
  if (!['setup', 'attArty', 'defArty', 'defFire', 'offFire'].includes(b.stage))
    throw new Error('too late: the field works are removed before offensive fire (6.33)');
  b.engFw = !!on;
}

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
/** The chain of areas a block traces supply through (9.3), source last; or null when it is cut off. Same rule as inSupply. */
export function supplyPath(g: Game, side: Side, start: number): number[] | null {
  setPlayArea(g.inPlay);
  if (CUR.supplyFree?.(g, side, start)) return [start];
  const src = CUR.sources(g, side),
    prev = new Map<number, number>([[start, -1]]),
    q = [start];
  while (q.length) {
    const a = q.shift()!;
    if (src.has(a) && g.control[a] === side) {
      const p = [a];
      let x = a;
      while (prev.get(x)! >= 0) {
        x = prev.get(x)!;
        p.unshift(x);
      }
      return p;
    }
    for (const n of supN(g, a)) {
      if (prev.has(n) || g.control[n] !== side || !(CUR.supplyStep ?? bulgeSupplyStep)(g, side, a, n, a === start)) continue;
      prev.set(n, a);
      q.push(n);
    }
  }
  return null;
}
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
/** Why a cut-off area has no supply, in plain words: the friendly neighbours it could not pass and the enemy that holds the way. */
export function supplyWhy(g: Game, side: Side, start: number): string {
  const enemy = other(side),
    held = neighbors(start)
      .filter((n) => g.control[n] === enemy)
      .map((n) => areas.get(n)!.name);
  const blown = neighbors(start)
    .filter((n) => g.blown.includes(keyOf(start, n)))
    .map((n) => areas.get(n)!.name);
  const parts = [
    held.length ? `held by the enemy: ${held.join(', ')}` : '',
    blown.length ? `blown bridge to ${blown.join(', ')}` : '',
  ].filter(Boolean);
  return parts.length
    ? `No friendly path to a supply source (${parts.join('; ')}).`
    : 'No friendly path to a supply source: every way out runs through enemy-held areas.';
}
