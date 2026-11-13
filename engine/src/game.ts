import unitsJson from '../../data/bulge/units.json';
import entryJson from '../../data/bulge/entry_areas.json';
import scenJson from '../../data/bulge/scenarios.json';
import { areas, connection, edgeKey, neighbors, allNeighbors, setPlayArea, zoneOf } from './map';
import { d10, rng, succeeds } from './dice';
import { moraleSn, successNumber, type Quality, type Shooter } from './combat';
import { reachable } from './movement';
import { buildChits, chitClass, isArty, isBattleAsset, isAsset, ZONE, type Chit, type Side } from './chits';
import { CUR, registerHooks, useGame, type Volume } from './volumes';
export type { Chit, Side };
export { useGame, CUR as VOLUME } from './volumes';

export type Phase = 'deploy' | 'reinforcement' | 'admin' | 'movement' | 'strategic' | 'combat' | 'reaction' | 'btMove' | 'btCombat' | 'supply';
export const PHASES: Phase[] = ['admin', 'movement', 'strategic', 'combat', 'reaction', 'btMove', 'btCombat', 'supply'];
/** Turn Track (map): Admin Phase draws [first player turn, second player turn] and the sudden-death net VP [German, Allied]. */
export const TRACK = [
  { ge: [0, 0], al: [0, 0], sd: null }, { ge: [9, 5], al: [7, 0], sd: null }, { ge: [9, 4], al: [7, 1], sd: null }, { ge: [8, 3], al: [7, 2], sd: [5, 5] },
  { ge: [7, 3], al: [7, 2], sd: [6, 4] }, { ge: [10, 4], al: [10, 5], sd: [7, 3] }, { ge: [8, 3], al: [11, 6], sd: [7, 3] }, { ge: [7, 2], al: [12, 7], sd: [6, 4] }, { ge: [6, 2], al: [13, 8], sd: [5, 5] },
] as unknown as { ge: number[]; al: number[]; sd: number[] | null }[];

export interface Unit {
  id: string; name: string; side: Side; cls: 'armor' | 'infantry'; q: Quality[]; max: number; str: number; area: number | null; garrison?: boolean;
  fort?: 'armor' | 'infantry';   /** a strongpoint (Golan 15.6): cannot move, attack or retreat; fires one die; its symbol gives the fire modifier */
  ghost?: boolean;              /** a ghost (Golan 15.7): revealed and removed when a battle begins */
  division?: string; brigade?: string; kind?: string; symbol2?: string;
  box?: string;   /** an off-map holding box of the volume (Golan: Operational/Strategic Reserve, Air Assault, strongpoint pool, evacuated, deploy, arriving) */
  disorder: 0 | 1 | 2; unsupplied: boolean; moved: boolean; reserve: string | null; exploit: boolean; from?: number;
  arrival?: number; entry?: string[]; ech?: string; symbol?: string; code?: string;
  nation?: string; untried?: boolean; motorized?: boolean;   /** Sicily: the block's nationality; an untried Italian garrison not yet in battle (15.3); the motorized Livorno (15.1) */
  chitId?: string; interdict?: string; adjOnly?: boolean; peiperFull?: boolean; spent?: number; delayed?: boolean; paradrop?: 'pending' | 'intact' | 'partial'; heydte?: boolean; bcross?: boolean;
  rec?: number;  /** recovery markers taken from artillery this round (Golan optional artillery vs armour) */
  up?: number;   /** area where the block lies face-up after a battle (6.24); it is upright, so hidden from the enemy, whenever it is elsewhere */
}
/** A morale check outside a battle: who rolled, against what, and the result. */
export interface Check { who: string; why: string; sn: number; die: number; ok: boolean; area: number | null }
export interface Roll { who: string; sn: number; dice: number[]; hits: number; kind: 'arty' | 'ground' | 'morale' | 'sam' }
export interface Battle {
  area: number; attacker: Side; attPoint: string; defPoint: string; bt: boolean; riverAssault: boolean;
  stage: 'setup' | 'attArty' | 'defArty' | 'defFire' | 'offFire' | 'attChoice' | 'attFirst' | 'loss' | 'defChoice' | 'retreat' | 'exploit' | 'done';
  /** 6.43: step losses the owner is placing one at a time (stage 'loss'), and what follows once they are all taken. */
  loss?: LossRun;
  reinforced?: string;     /** 8.23: the unit that reinforced the defence by Special Action (never the point unit while the original stands) */
  exploitIds?: string[];   /** 6.8: the attacking armor-class units that may roll the exploitation morale check */
  retreat?: { side: Side; queue: string[]; moved: boolean; after: 'ground' | 'arty' | 'sa'; h: number; excess: number };
  queue: ('attArty' | 'defArty' | 'defFire' | 'offFire')[]; assets: Record<Side, string[]>; air: Partial<Record<Side, { id: string; mode: 'arty' | 'support'; unit?: string }>>;
  air2?: Partial<Record<Side, { id: string; mode: 'arty' | 'support'; unit?: string }>>;   /** a second air asset (Golan 16.22: one fires as artillery, the other supports a unit) */
  vol?: Record<string, unknown>;   /** a volume's own battle state (Golan: the events played, jamming, counterbattery, the ditch an engineer bridges) */
  pending: number; pendingKind?: 'arty' | 'ground'; lossKind?: 'arty' | 'ground'; engFw: boolean; rolls: Roll[]; result?: string; exploit: boolean; unitHit: Record<Side, boolean>; mark: number; hit?: Record<Side, string[]>;
  ready?: Side[]; locked?: boolean;
  attPointDone?: boolean;   /** 6.24: the Attacker designated his point unit after the Defender's: the round may begin and the blocks are revealed */
  defSA?: boolean;   /** 6.21: the Defender has still to decide on a Special Action (reinforce or retreat), before the Attacker assigns assets */
  pz150?: string;   /** 18.4 the 150th's first battle: its id, cleared once the morale check is done */
  defStart?: string[]; unabsorbed?: number; byArty?: boolean; lastDefPoint?: Unit;   /** 18.7 bookkeeping */
}
/** Scenario and optional rules (Play Book 18); every optional flag missing = off. */
export interface Opts { scenario: string; fuel: boolean; airborne?: boolean; advArty?: boolean;
  bridgeLimit?: boolean;   /** 18.1 the Germans repair at most six bridges */
  bid?: number;            /** 18.2 fuel bid: + extra German bid fuel assets (eliminated when used), − fuel assets moved to the Used Box at start (max 5) */
  peiper?: boolean;        /** 18.3 KG Peiper's once-per-game full exploitation move */
  pz150?: boolean;         /** 18.4 150th Panzer Brigade */
  overrun?: boolean;       /** 18.7 overrunning artillery */
  fwMaintain?: boolean;    /** 18.8 maintaining field works */
  randomReinf?: boolean;   /** 18.9 random reinforcements */
  /* Golan '73 additional optional rules (the Battle for Nafakh and Al-Owda scenario sheets, 18.x) */
  atAssets?: boolean;      /** Syrian AT assets: +1 against an armour point unit; defending with one, Israeli armour fires −1 */
  t62?: boolean;           /** Syrian T-62 tanks: +1 MP to cross a field connection */
  chemical?: boolean;      /** chemical warfare: the Syrian defender's reusable Special Action gives one artillery asset +2 */
  flank?: boolean;         /** Israeli flank assault: a Special Action, the second unit fires +1 and takes no hits */
  artyArmor?: boolean;     /** artillery vs armour: armour takes recovery markers instead of step losses from artillery */
  zvikaCup?: boolean;      /** Lt. Zvika variant: back into the cup in the Supply Phase */
  raidMod?: boolean;       /** commando raids east of the SAM barrier: −1 to the die */
  battleRecovery?: boolean;/** battlefield recovery: recovering in a contested area takes a morale check */
  advGhosts?: boolean;     /** advanced ghost units: they move, may be reserves, arrive from the cup */
}
/** The optional rules of Play Book 18, for menus and the 'rules in use' list. */
export type OptionalRule = { key: keyof Opts; rule: string; name: string; text: string };
export const OPTIONAL_RULES: OptionalRule[] = [
  { key: 'bridgeLimit', rule: '18.1', name: 'Bridge repair limits', text: 'The Germans may repair at most six bridges.' },
  { key: 'bid', rule: '18.2', name: 'Bidding for sides', text: 'The agreed bid changes the German starting fuel: extra bid fuel assets (+) or fuel moved to the Used Box (−).' },
  { key: 'peiper', rule: '18.3', name: 'KG Peiper', text: 'Once, in a Breakthrough Movement Phase up to turn 3, exploiting Peiper may use its full movement.' },
  { key: 'pz150', rule: '18.4', name: '150th Panzer Brigade', text: 'Its first battle: it is the point unit; after artillery the American point unit checks morale (+2) or is disordered.' },
  { key: 'airborne', rule: '18.5', name: 'American airborne units', text: '82nd, 101st and 517th ignore the −1 unsupplied morale modifier.' },
  { key: 'advArty', rule: '18.6', name: 'Advanced artillery modifiers', text: '−1 when the target is the defender, +1 against an infantry point unit not in field works.' },
  { key: 'overrun', rule: '18.7', name: 'Overrunning artillery', text: 'Defending artillery left behind in a vacated area may be destroyed by the attacker.' },
  { key: 'fwMaintain', rule: '18.8', name: 'Maintaining field works', text: 'Field works in a contested area stay unless a morale check fails in the owner\'s Supply Phase.' },
  { key: 'randomReinf', rule: '18.9', name: 'Random reinforcements', text: 'Arriving units are drawn at random from those due now and next turn.' },
];
export interface Game {
  /** Set when hidden blocks are split between seats: setReady does not start combat by itself (see split.ts). */
  deferBegin?: boolean;
  /** Sides that have finished their part of a phase both sides work in (Reinforcement, Admin); the Phasing Player ends the step once the other side is done. */
  done?: Side[];
  game?: string; sides?: [Side, Side];   /** the volume and its two sides, First Player first (older saved games: The Bulge) */
  turn: number; lastTurn: number; phasing: Side; phase: Phase; units: Unit[]; chits: Chit[]; control: Record<number, Side>;
  fieldWorks: number[]; fwOwner: Record<number, Side>; riverAssault: number[]; blown: string[]; contestedAtMoveStart: number[]; fought: number[];
  markers: Record<Side, Record<string, number>>; stratMoves: number; riverCross: string[]; blowTried: number[]; entered: Record<number, { id: string; river: boolean; blown: boolean }[]>;
  pendingBlow: { unit: string; path: number[]; spent?: number; fuel?: boolean } | null;
  /** The block moving step by step (one area at a time) and may still go on: whether it left a contested area (5.34), the areas entered so far, whether it paid fuel (16.13). */
  moving?: { id: string; left: boolean; steps: number; fuel: boolean } | null; greif: Record<string, string>; greifTried: string[]; fwBuilt: string[]; tfNew: string[]; elimLarge: string[]; captured: number[]; fuelAdded: boolean; opts: Opts;
  roadblocks: Record<number, Side>; interdicted: Record<number, string>; pooled: number | null; airSupplies?: { area: number; side: Side; id: string; stamp: number }[]; markersHeld?: [Side, string][]; airSupply: { area: number; side: Side; id: string; stamp: number } | null; revealed: string | null; arrived: string[]; pendingArrivals: string[];
  recover: Side[];
  battle: Battle | null; seed: number; rolls: number; log: string[]; over?: string;
  force?: number[];
  inPlay?: number[];   /** 24.33 the Introductory scenario plays on its own map sheet: only these areas */
  supplyOnly?: number[];   /** P500 Cold Shoulder: Zone 5 areas both sides may trace supply through but nobody may enter */
  track?: { ge: number[]; al: number[]; sd: number[] | null }[];   /** draws per turn when the scenario has its own track */
  artyPick?: boolean;
  supplyPending?: boolean;
  vpHist?: number[];   /** net VP at each turn's Victory Check (German positive), for the end-of-game chart */
  battles?: number;   /** battles fought so far */   /** 9.4 the out-of-supply checks of this Supply Phase are still to be rolled */
  bridgesLeft?: number;   /** 18.1 German bridge repairs left */
  peiperUsed?: boolean;   /** 18.3 used */
  pz150Done?: boolean;    /** 18.4 the 150th has been in its first battle */
  vol?: Record<string, unknown>;   /** a volume's own state (Golan: minefields, bridged ditches, raids…) */
  /** Online: set when a player's rules check put the game back to the last legal position (`why`: what the check found). */
  restored?: { t: number; why: string[] };
  checks?: Check[];   /** morale checks rolled outside battles (supply, Greif interdict), newest last, so the table can show the dice */   /** 16.12: the German player must choose which used artillery asset is eliminated */   /** sandbox: die results to use before the seeded ones */
}
type RawUnit = { id: string; name: string; side: string; echelon?: string; symbol?: string; cls?: string; steps?: number; quality_by_step?: Quality[]; start_area?: number; arrival_turn?: number; entry?: string[]; kind?: string };
const ENTRY = entryJson as Record<string, { side: string; area: number }>;
/** 14.21-14.23: the entry areas a Higher Echelon may use when its own are blocked or a Special Action reroutes it. */
const APPROPRIATE: Record<string, string> = { de_5pz: 'XYZ', de_6pz: 'YZ', de_7a: 'XY', de_sr: 'YZ', us_1a: 'ABCDEFGHJ', us_3a: 'KLM', us_sr: 'FGHJ', br_xxx: 'CDEFGH' };
const appropriateAreas = (u: Unit, g?: Game) => (g && CUR.appropriate ? CUR.appropriate(g, u) : [...(APPROPRIATE[u.ech ?? ''] ?? '')].map((l) => ENTRY[l]?.area).filter((a): a is number => a != null && (!g?.inPlay || g.inPlay.includes(a))));
/** 5.1: two blocks of a side per area, unless the volume says otherwise (Golan's Assembly areas hold any number). */
const stackMax = (g: Game, a: number) => CUR.stackLimit?.(g, a) ?? 2;
/** Room for unit `u` to end in area `a` (5.1); a volume may count some units differently (Golan's advanced ghosts overstack by one). */
const roomFor = (g: Game, u: Unit, a: number) => CUR.stackRoom?.(g, u, a) ?? blocks(g, a, u.side).filter((x) => x.id !== u.id).length < stackMax(g, a);
/** The two sides of a game, First Player first (an older saved Bulge game has none). */
export const sidesOf = (g: { sides?: [Side, Side] }): [Side, Side] => g.sides ?? CUR.sides;
export const other = (s: Side): Side => (s === CUR.sides[0] ? CUR.sides[1] : CUR.sides[0]);
const sideOf = (s: string): Side => (s === 'german' ? 'german' : 'allied');
export const keyOf = edgeKey;

export const quality = (u: Unit) => u.q[u.str - 1];
export const unitsIn = (g: Game, a: number, side?: Side) => g.units.filter((u) => u.area === a && (!side || u.side === side));
export const blocks = (g: Game, a: number, side: Side) => unitsIn(g, a, side).filter((u) => !u.garrison);
export const contested = (g: Game, a: number) => { const [p, q] = sidesOf(g); return unitsIn(g, a, p).length > 0 && unitsIn(g, a, q).length > 0; };
export const contestedAreas = (g: Game) => [...areas.keys()].filter((a) => contested(g, a));
export const newlyContested = (g: Game) => contestedAreas(g).filter((a) => !g.contestedAtMoveStart.includes(a));
export const chit = (g: Game, id: string) => g.chits.find((c) => c.id === id)!;
export const boxOf = (g: Game, side: Side, box: Chit['box']) => g.chits.filter((c) => c.side === side && c.box === box);
/** Dice come from the game's seed; a test table can queue exact results in `force` (the sandbox). */
/** Online the dice must not be predictable from the shared game, so the client plugs in a secure random source; tests and offline play use the seed. */
let secure: (() => number) | null = null;
/** The optional rules of the game being played (each volume has its own list). */
export const optionalRules = (): OptionalRule[] => CUR.optional ?? OPTIONAL_RULES;
export const setRandom = (f: (() => number) | null) => { secure = f; };
/** The secure source when one is set (online), for choices that must not be reproducible from the shared seed. */
export const secureRandom = () => secure?.() ?? null;
/** The random source in use (null: the game's seed), so a simulation can run on the seed and put it back. */
const roll = (g: Game) => (secure ? (g.rolls++, 1 + Math.floor(secure() * 10)) : g.force?.length ? (g.rolls++, g.force.shift()!) : d10(rng(g.seed * 7919 + g.rolls++)));   // online the queue is ignored: a client must not write its own dice
/** A log line, labelled with the side that acted (in Prepare and Reinforcement both sides act). */
export const say = (g: Game, s: string, side: Side = g.phasing) => { g.log.push(`T${g.turn} ${CUR.tag[side] ?? side} ${g.phase}: ${s}`); if (g.log.length > 400) g.log.splice(0, g.log.length - 300); };   // the log only has to be read, so it stays short
const AIRBORNE = new Set(['82', '101', '517']);                                                // 18.5
const ARMY = (u: Unit): number | undefined => (u.ech ? ZONE[u.ech] : undefined);

/* ================= setup ================= */
/** 24.3 Introductory scenario "Nuts!": its map sheet, forces, chits and draws (Play Book back page and the scenario map sheet). */
const INTRO_AREAS = [12, 13, 14, 15, 19, 20, 21, 22, 36, 37, 38, 39, 45, 46, 47, 48, 63, 64];
const EDGE_INTRO: number[] = [];
const INTRO_UNITS: Record<string, number> = { '116 Pz': 12, '560 VG': 12, Lehr: 13, '276 VG': 15, '5 FJ': 19, '26 VG': 20, '2 Pz': 21, '112/28': 12, '109/28': 19, '110/28': 21, 'CCR/9': 37 };
/** Chits in play: turn 1 ones start Available; later ones enter the cup on their turn (drawn per the sheet's turn track). */
const INTRO_CHITS: Record<string, number> = { 'L47.0': 1, 'L46.0': 1, 'L36.0': 1, 'L31.0': 1, 'L33.0': 1, 'R17.0': 1, 'R17.1': 1, 'R15.0': 2, 'L35.0': 3, 'R48.0': 3,
  'L79.0': 2, 'L65.0': 2, 'L88.0': 2, 'L62.0': 2, 'L71.0': 2, 'R71.0': 2, 'SA-allied': 2, 'L83.0': 3 };
function introSetup(g: Game) {
  g.inPlay = [...INTRO_AREAS]; g.lastTurn = 3;
  g.track = [{ ge: [0, 0], al: [0, 0], sd: null }, { ge: [4, 1], al: [3, 0], sd: null }, { ge: [3, 0], al: [3, 0], sd: null }];
  for (const u of g.units) {
    if (u.garrison) { if (u.area !== 38 && u.area !== 47) u.area = null, u.str = 0; continue; }
    if (u.name === '10 Arm') { u.area = null; u.arrival = 2; u.entry = ['#46']; u.str = u.max; continue; }       // 24.35 arrives at full strength into Martelange
    u.area = INTRO_UNITS[u.name] ?? null; u.str = u.max; if (u.area == null) u.arrival = undefined;
  }
  g.units = g.units.filter((u) => u.area != null || u.arrival != null);
  g.chits = g.chits.filter((c) => INTRO_CHITS[c.id] != null);
  for (const c of g.chits) { const t = INTRO_CHITS[c.id]; c.turn = t; c.box = t === 1 ? 'available' : 'future'; }
  g.fieldWorks = [12, 19, 21]; g.riverAssault = [21]; g.blown = [edgeKey(13, 21), edgeKey(13, 20)];
  g.markers = { german: { z5: 1, z6: 0, z7: 1 }, allied: { z56: 1, z7: 0 } };
}
/* P500 "Cold Shoulder" (Bonus Scenario sheet, docs/scenarios/FAB_BonusScen_ColdShoulder.pdf): Zone 6 only, turns 1-9. */
const COLD_UNITS: Record<string, number | null> = { Peiper: 5, '1SS(-)': 6, '150 Pz': 6, '12SS': 7, '326 VG': 8, '12 VG': 9, '277 VG': 9, '3 FJ': 10,
  '2SS': null, '9SS': null, '3 PG': null, '246 VG': null, '10SS': null, '17SS': null,                                       // German reinforcements / released divisions
  '99 Inf': 9, '14 Cav': 10, 'CCB/9': 25, '102 Cav': 27, '2 Inf': 27,
  '1 Inf': null, '7 Arm': null, '9 Inf': null, '30 Inf': null, '3 Arm': null, '84 Inf': null, '75 Inf': null, '43 Inf': null, '4 Cav': null, Guards: null };
/** P.5 entry areas where the sheet differs from the campaign data ("Enter at AC", "CE", "DE"). */
const COLD_ENTRY: Record<string, string[]> = { '1 Inf': ['A', 'C'], '7 Arm': ['A', 'C'], '84 Inf': ['C', 'E'], '75 Inf': ['C', 'E'], '4 Cav': ['C', 'E'], '43 Inf': ['D', 'E'], Guards: ['D', 'E'] };
/** P.4 / P.5 chits by turn (1 = in the Available Box at start; later turns enter the cup, Task Forces go to Available). */
const COLD_CHITS: Record<string, number> = {
  // German, 6th Panzer Army
  'L26.0': 1, 'R17.0': 1, 'R17.1': 1, 'R17.2': 1, 'L12.0': 1, 'L13.0': 1, 'L25.0': 1, 'L14.0': 1, 'L15.0': 1, 'L16.0': 1,      // T1 engineer, 3 fuel, 3 rocket, 3 artillery
  'L22.0': 2, 'L24.0': 2, 'L11.0': 2, 'L17.0': 2, 'SA-german': 2,                                                     // T2 2 armor, v.d. Heydte, inf replacement, reusable SA
  'L49.0': 3, 'R16.0': 3, 'R26.0': 3,                                                                                 // T3 HQ, Greif Bridge, Greif Interdict
  'R38.0': 4,                                                                                                          // T4 6th Pz Army SA
  'L23.0': 5, 'R12.0': 5, 'L19.0': 5,                                                                                 // T5 armor, 10th SS released, armor replacement
  'L21.0': 6, 'R39.0': 6, 'L18.0': 6,                                                                                 // T6 elite armor, SA, non-elite inf replacement
  'R22.0': 7, 'R23.0': 8, 'R13.0': 8,                                                                                 // T7-8 Delayed Response x2, 17th SS PzGr released
  // Allied, 1st Army
  'L63.0': 2, 'L65.0': 2, 'L61.0': 2, 'L62.0': 2, 'L64.0': 2, 'R71.0': 2, 'SA-allied': 2,                              // T2 2 engineers, 3 artillery, Task Force, reusable SA
  'L83.0': 3, 'L98.0': 3, 'R33.0': 3, 'R35.0': 3, 'L48.0': 3,                                                         // T3 engineer, HQ, Delayed Response, Regiment 1st Inf, inf replacement
  'L81.0': 4, 'L74.0': 4, 'R82.0': 4, 'R34.0': 4, 'R36.0': 4,                                                         // T4 armor, artillery, Task Force, Delayed Response, Regiment
  'R46.0': 5, 'R37.0': 5,                                                                                              // T5 1st Army SA, Regiment
  'L82.0': 6, 'L84.0': 6, 'L53.0': 6, 'R41.0': 6, 'L67.0': 6, 'L57.0': 6,                                              // T6 infantry, engineer, British armor, Air Mission, arm + inf replacements
  'L86.0': 7, 'L75.0': 7, 'L76.0': 7, 'L51.0': 7, 'R42.0': 7, 'R42.1': 7, 'R42.2': 7, 'L68.0': 7,                     // T7 armor, 2 artillery, British artillery, 3 Air Missions, arm replacement
  'L78.0': 8, 'R52.0': 8, 'R52.1': 8, 'L59.0': 8,                                                                     // T8 artillery, 2 Air Missions, inf replacement
  'R62.0': 9, 'L77.0': 9,                                                                                              // T9 Air Mission, arm replacement
};
/** Chit draws: the sheet gives two rows per side; like the map's Turn Track (TRACK) they are [German player turn, Allied player turn].
 *  Check: the campaign track has Allied T2 = [7, 0] and the sheet's Allied second row starts 0 at T2 as well (no Allied draw in their own first turn). */
const COLD_TRACK = [[0, 0, 0, 0], [5, 2, 4, 0], [5, 2, 4, 1], [4, 2, 4, 1], [4, 2, 4, 1], [4, 2, 5, 2], [3, 2, 5, 3], [3, 1, 6, 3], [2, 1, 6, 4]]
  .map(([a, b, c, d]) => ({ ge: [a, b], al: [c, d], sd: null }));
export const isZone = (a: number, z: number) => areas.get(a)?.zone === z;
function coldSetup(g: Game) {
  g.lastTurn = 9; g.track = COLD_TRACK;
  g.inPlay = [...areas.keys()].filter((a) => isZone(a, 6)); g.supplyOnly = [...areas.keys()].filter((a) => isZone(a, 5));       // P.3 / P.6
  for (const u of g.units) {
    if (u.garrison) { if (u.area !== 32) u.area = null, u.str = 0; continue; }                                        // the garrison asset in Spa
    if (!(u.name in COLD_UNITS)) { u.area = null; u.arrival = undefined; u.str = 0; continue; }
    const at = COLD_UNITS[u.name]; if (at != null) { u.area = at; u.arrival = undefined; } else u.area = null;
    if (COLD_ENTRY[u.name]) u.entry = COLD_ENTRY[u.name];
  }
  g.units = g.units.filter((u) => u.area != null || u.arrival != null || u.name === '10SS' || u.name === '17SS');
  g.chits = g.chits.filter((c) => COLD_CHITS[c.id] != null);
  for (const c of g.chits) { const t = COLD_CHITS[c.id]; c.turn = t === 1 ? 'S' : t; c.box = t === 1 ? 'available' : 'future'; }
  g.fieldWorks = [9, 10, 27]; g.riverAssault = []; g.blown = [];
  g.markers = { german: { z5: 0, z6: 2, z7: 0 }, allied: { z56: 2, z7: 0 } };                                           // 2 Zone 6 reserve markers (one goes on Peiper), 2 Allied Zone 5/6
}
/** P.7: German-controlled Zone 6 areas (at the end of turn 9: 11+ German victory, 10 draw, 9 or less Allied victory). */
export const coldAreas = (g: Game) => [...areas.keys()].filter((a) => isZone(a, 6) && g.control[a] === 'german').length;
export function newGame(seed = Date.now() % 1e9, opts: Partial<Opts> = {}): Game { return CUR.newGame(seed, opts); }
function bulgeNewGame(seed: number, opts: Partial<Opts>): Game {
  const o: Opts = { scenario: 'tournament', fuel: true, ...opts }, sc = scenJson.tournament, last = o.scenario === 'campaign' || o.scenario === 'cold' ? 9 : 5;
  const units: Unit[] = [];
  for (const r of unitsJson as RawUnit[]) {
    if (r.kind) continue;
    const max = r.steps!, red = (sc.reduced as Record<string, number>)[r.name] ?? (sc.reinforcementsReduced as Record<string, number>)[r.name];
    units.push({ id: r.id, name: r.name, side: sideOf(r.side), cls: r.cls as 'armor' | 'infantry', q: r.quality_by_step!, max, str: red ?? max, area: r.start_area ?? null, disorder: 0, unsupplied: false, moved: false,
      reserve: null, exploit: false, arrival: r.arrival_turn, entry: r.entry, ech: r.echelon, symbol: r.symbol,
      code: r.start_area ? String(r.start_area) : r.arrival_turn ? `${r.arrival_turn}-${r.entry!.length > 1 ? r.entry![0] + r.entry![r.entry!.length - 1] : r.entry![0]}` : 'Res' });
  }
  for (const a of sc.garrisons) units.push({ id: `G${a}`, name: `Garrison ${areas.get(a)!.name}`, side: 'allied', cls: 'infantry', q: ['green'], max: 1, str: 1, area: a, garrison: true, disorder: 0, unsupplied: false, moved: true, reserve: null, exploit: false });
  const g: Game = { game: 'bulge', sides: ['german', 'allied'], turn: 1, lastTurn: last, phasing: 'german', phase: 'combat', units, chits: buildChits(last), control: {}, fieldWorks: [...sc.fieldWorks], fwOwner: {}, riverAssault: [...sc.riverAssault], blown: [...sc.blownBridges],
    contestedAtMoveStart: [], fought: [], markers: { german: { z5: 2, z6: 2, z7: 1 }, allied: { z56: 3, z7: 2 } }, stratMoves: 0, riverCross: [], blowTried: [], entered: {}, pendingBlow: null, greif: {}, greifTried: [], fwBuilt: [], tfNew: [],
    elimLarge: [], captured: [], fuelAdded: false, opts: o, roadblocks: {}, interdicted: {}, pooled: null, airSupply: null, revealed: null, arrived: [], pendingArrivals: [], recover: [], battle: null, seed, rolls: 0, log: [] };
  let frontZ5: Record<number, Side> = {};
  if (o.scenario === 'cold') { setPlayArea(null); frontZ5 = campaignControl(units); coldSetup(g); }               // Zone 5 keeps the campaign front line (P.3: Allied west of it)
  if (o.scenario === 'intro') introSetup(g);
  setPlayArea(g.inPlay);
  for (const fa of g.fieldWorks) g.fwOwner[fa] = units.some((u) => u.side === 'allied' && u.area === fa) ? 'allied' : 'german';
  if (o.scenario !== 'intro') { const peiper = units.find((u) => u.name === 'Peiper')!; peiper.reserve = 'z6'; g.markers.german.z6--; }
  g.control = campaignControl(g.units);
  if (o.bridgeLimit) g.bridgesLeft = 6;                                                                   // 18.1
  if (o.bid && o.bid > 0) for (let i = 0; i < o.bid; i++) g.chits.push({ id: `BID-${i}`, name: 'Bid Fuel Asset', kind: 'fuel', side: 'german', ech: 'german', turn: 'S', box: 'available', bid: true });   // 18.2 extra fuel, not recycled
  if (o.bid && o.bid < 0) for (const c of boxOf(g, 'german', 'available').filter((x) => x.kind === 'fuel').slice(0, Math.min(5, -o.bid))) c.box = 'used';   // 18.2 bidding to be the Germans: fewer starting fuel assets (they recycle normally)
  if (o.scenario === 'cold') for (const a of g.supplyOnly!) g.control[a] = frontZ5[a];
  say(g, `${SCEN_NAME[o.scenario]} scenario set up. All contested areas must be fought this phase.`);
  return g;
}

/* ================= control, supply, VP ================= */
function updateControl(g: Game, a: number) {
  if (contested(g, a)) for (const u of unitsIn(g, a)) if (u.reserve) { g.markers[u.side][u.reserve]++; u.reserve = null; }       // 5.21 the marker goes when the area becomes contested
  const [p, q] = sidesOf(g), np = blocks(g, a, p).length, nq = blocks(g, a, q).length, was = g.control[a];
  if (np && !nq && !unitsIn(g, a, q).length) g.control[a] = p;
  if (nq && !np && !unitsIn(g, a, p).length) g.control[a] = q;
  if (CUR.id === 'bulge' && was !== 'german' && g.control[a] === 'german' && areas.get(a)!.vp.mutual && !g.captured.includes(a)) {      // 16.13 captured fuel, first capture of a yellow-star area
    g.captured.push(a); const r = roll(g);
    if (r === 1 && !g.fuelAdded) { g.fuelAdded = true; g.chits.push({ id: `FUEL-C${a}`, name: 'Captured Fuel Asset', kind: 'fuel', side: 'german', ech: 'german', turn: 'S', box: 'available' }); say(g, `captured fuel at ${areas.get(a)!.name} (rolled 1): new fuel asset`); }
    else if (r <= 5) { const f = g.chits.find((c) => c.kind === 'fuel' && c.box === 'used') ?? g.chits.find((c) => c.kind === 'fuel' && c.box === 'cup'); if (f) { f.box = 'available'; say(g, `captured fuel at ${areas.get(a)!.name} (rolled ${r}): a fuel asset is available again`); } }
  }
}
/** Area control from a deployment: the Allies hold their areas and everything west of the front (reachable without crossing a German area); the Germans the rest (P.3, 24.x). */
function campaignControl(units: Unit[]): Record<number, Side> {
  const ger = new Set(units.filter((u) => u.side === 'german' && u.area).map((u) => u.area!)), out: Record<number, Side> = {};
  const todo = units.filter((u) => u.side === 'allied' && u.area).map((u) => u.area!), seen = new Set(todo);
  while (todo.length) for (const n of neighbors(todo.pop()!)) if (!seen.has(n) && !ger.has(n)) { seen.add(n); todo.push(n); }
  for (const a of areas.keys()) out[a] = seen.has(a) ? 'allied' : 'german';
  for (const a of [1, 2, 3, 4, 5, 6, 7, 8, 14, 15]) if (!units.some((u) => u.side === 'allied' && u.area === a)) out[a] = 'german';
  return out;
}
export const SCEN_NAME: Record<string, string> = { tournament: 'Tournament', campaign: 'Campaign', intro: 'Introductory (Nuts!)', cold: 'Cold Shoulder', badr: 'Operation Badr', badr_alt: 'Operation Badr, alternate set-up' };
/** Neighbours a supply line may use: the play area, plus Cold Shoulder's supply-only Zone 5 (P.6). */
const supN = (g: Game, a: number) => (g.supplyOnly ? allNeighbors(a).filter((n) => g.inPlay!.includes(n) || g.supplyOnly!.includes(n)) : neighbors(a));
const bulgeSources = (g: Game, side: Side) => g.inPlay && g.opts.scenario === 'intro' ? new Set(g.inPlay.filter((a) => allNeighbors(a).some((n) => !g.inPlay!.includes(n)) || EDGE_INTRO.includes(a)))      // 24.36 any area at the edge of the play area
  : new Set(Object.values(CUR.entries).filter((e) => sideOf(e.side) === side && (!g.supplyOnly || g.inPlay!.includes(e.area) || g.supplyOnly.includes(e.area))).map((e) => e.area));
/** The Bulge's supply path step, by the latest series rules (Golan '73 rulebook, 9.31): through friendly-controlled areas (contested ones too, 9.31c),
 *  never over a blown bridge except from the first area (9.31a). The Bulge's own book had a further 9.31c (no vacant area next to uncontested enemy units): dropped. */
function bulgeSupplyStep(g: Game, _side: Side, a: number, n: number, first: boolean) {
  return !(g.blown.includes(keyOf(a, n)) && !first);
}
export function inSupply(g: Game, side: Side, start: number) {
  setPlayArea(g.inPlay);
  if (CUR.supplyFree?.(g, side, start)) return true;                                        // 17.2 Air Supply Mission (The Bulge); Mt Hermon, the Assembly areas (Golan)
  const src = CUR.sources(g, side);
  const seen = new Set([start]), todo = [start];
  while (todo.length) {
    const a = todo.pop()!;
    if (src.has(a) && g.control[a] === side) return true;
    for (const n of supN(g, a)) {
      if (seen.has(n) || g.control[n] !== side || !(CUR.supplyStep ?? bulgeSupplyStep)(g, side, a, n, a === start)) continue;
      seen.add(n); todo.push(n);
    }
  }
  return false;
}
export const victory = (g: Game) => CUR.victory(g);
/** 19.1–19.3 as the series rules give them: objective areas held and supplied, plus one point per large enemy unit eliminated; net is First Player minus Second. */
export function seriesVictory(g: Game): Record<Side, number> & { net: number } {
  const [p, q] = sidesOf(g), pts: Record<Side, number> = { [p]: 0, [q]: 0 }, vp = (a: { vp: Record<string, number | boolean> }, s: Side) => (a.vp[s] as number) || 0;
  for (const a of areas.values()) {
    const c = g.control[a.id]; if (!c || (!vp(a, c) && !a.vp.mutual) || !inSupply(g, c, a.id)) continue;            // nobody holds it (possible in the sandbox)
    pts[c] += vp(a, c) + (a.vp.mutual ? 1 : 0);
  }
  for (const id of g.elimLarge) { const u = g.units.find((x) => x.id === id)!; pts[other(u.side)]++; }
  return { ...pts, net: pts[p] - pts[q] };
}

/* ================= chits ================= */
function drawChits(g: Game, side: Side, n: number) {
  for (let i = 0; i < n; i++) {
    const cup = boxOf(g, side, 'cup'); if (!cup.length) return;
    const c = cup[Math.floor(rngf(g) * cup.length)];
    if (c.kind === 'event_delayed_response' || c.kind === 'event_asset_delayed') { c.box = 'eliminated'; say(g, `${side} drew ${c.name} (no effect)`, side); } else { c.box = 'available'; c.drawn = g.turn * 10 + (g.phasing === sidesOf(g)[0] ? 1 : 2); c.firstDrawn ??= c.drawn; }   // 16.11: v.d. Heydte drops only in the Admin Phase it is FIRST drawn
  }
}
export const rngf = (g: Game) => (secure ? (g.rolls++, secure()) : rng(g.seed * 104729 + g.rolls++)());
/** 4.1b-c: the Used Box goes back to the cup (German artillery attrition first, 16.12). */
/** 16.12 (Cold Shoulder P.6: turns 5+): the German player eliminates one regular artillery asset of his choice from the Used Box; true while he has to choose. */
function bulgeBeforeRecycle(g: Game, side: Side) {
  if (side !== 'german' || (g.opts.scenario === 'cold' && g.turn < 5)) return false;
  const arts = boxOf(g, side, 'used').filter((c) => c.kind === 'artillery');
  if (arts.length > 1) { g.artyPick = true; say(g, 'German artillery attrition: the German player chooses which artillery asset in the Used Box is eliminated (16.12)'); return true; }
  if (arts.length === 1) { arts[0].box = 'eliminated'; say(g, `German artillery attrition: ${arts[0].name} eliminated, the only one in the Used Box (16.12)`); }
  return false;
}
function recycleUsed(g: Game, side: Side, artyDone = false) {
  if (!artyDone && CUR.beforeRecycle?.(g, side)) return;
  for (const c of boxOf(g, side, 'used')) {
    if (c.direct) continue;                                                                       // waits for its turn (a counterbattery victim, Golan 17.34)
    if (g.opts.scenario === 'cold' && (c.kind === 'sa_block' || c.kind === 'command_staff')) {              // P.6: reusable SAs and HQ assets wait one more turn in the Used Box
      if (c.held == null) { c.held = g.turn; continue; } c.held = undefined;
    }
    c.box = c.kind === 'sa_block' ? 'available' : 'cup';
  }
}
/** 16.12: the German player's choice of the artillery asset lost to attrition; the rest of the Used Box then goes to the cup. */
export function chooseArtyLoss(g: Game, id: string) {
  if (!g.artyPick) throw new Error('no artillery attrition pending');
  const c = chit(g, id); if (c.side !== 'german' || c.kind !== 'artillery' || c.box !== 'used') throw new Error('pick a regular German artillery asset in the Used Box (not rocket artillery)');
  c.box = 'eliminated'; g.artyPick = false; say(g, `German artillery attrition: ${c.name} eliminated (16.12)`, 'german'); recycleUsed(g, 'german', true);
}
/** 4.1a: with the reusable Special Action unused, move one asset of the player's choice from the Used Box to the Available Box (or none). */
export function recoverAsset(g: Game, side: Side, id: string | null) {
  if (!g.recover.includes(side)) throw new Error('no recovery pending for that side');
  if (id != null) { const c = chit(g, id); if (c.side !== side || c.box !== 'used' || !isAsset(c)) throw new Error('pick an asset from the Used Box'); c.box = 'available'; say(g, `${side}: ${c.name} returned to Available (unused Special Action)`); }
  g.recover = g.recover.filter((s) => s !== side); recycleUsed(g, side);
}
/** The old automatic choice (engineer first), for tests and for a player who just wants to move on. */
export function autoRecover(g: Game) {
  const pri = ['engineer', 'artillery', 'rocket_artillery', 'armor_asset', 'fuel', 'infantry_asset', 'command_staff'];
  for (const side of [...g.recover]) { const back = boxOf(g, side, 'used').filter((c) => isAsset(c)).sort((a, b) => pri.indexOf(a.kind) - pri.indexOf(b.kind))[0]; recoverAsset(g, side, back?.id ?? null); }
  if (g.artyPick) chooseArtyLoss(g, boxOf(g, 'german', 'used').find((c) => c.kind === 'artillery')!.id);
}
/** 18.92: for each side, the units still to arrive on or before this turn plus next turn's go in a cup; as many as are due this turn are drawn,
 *  the rest wait for next turn. Arriving units are public (off-map blocks), so no hidden information is involved. */
function randomizeArrivals(g: Game) {
  for (const side of sidesOf(g)) {
    const due = g.units.filter((u) => u.side === side && u.arrival != null && u.arrival <= g.turn && u.area == null && u.str > 0 && !g.arrived.includes(u.id));
    const cup = [...due, ...g.units.filter((u) => u.side === side && u.arrival === g.turn + 1 && u.area == null && u.str > 0)];
    const n = due.filter((u) => u.arrival === g.turn).length; if (!n || cup.length <= n) continue;
    const drawn: Unit[] = []; for (let i = 0; i < n; i++) { const pool = cup.filter((u) => !drawn.includes(u)); drawn.push(pool[Math.floor(rngf(g) * pool.length)]); }
    for (const u of cup) u.arrival = drawn.includes(u) ? g.turn : g.turn + 1;
    say(g, `random reinforcements: ${drawn.map((u) => u.name).join(', ')} arrive this turn (18.9)`, side);
  }
}
function reinforcementPhase(g: Game) {
  g.arrived = [];
  g.recover = []; g.artyPick = false;
  for (const side of sidesOf(g)) {
    CUR.reinforce?.(g, side);
    const sa = g.chits.find((c) => c.kind === 'sa_block' && c.side === side && c.turn === 2 && g.turn >= 2);
    if (g.turn >= 2 && sa) {
      if (sa.box === 'available') { if (boxOf(g, side, 'used').some((c) => isAsset(c))) { g.recover.push(side); continue; } }   // 4.1a unused reusable SA: the player brings one asset back first
      else if (!(g.opts.scenario === 'cold' && sa.box === 'used')) sa.box = 'available';                 // Cold Shoulder: a used one waits a turn (recycleUsed)
    }
    recycleUsed(g, side);
  }
  if (g.opts.randomReinf) randomizeArrivals(g);
  g.pendingArrivals = g.units.filter((x) => x.arrival === g.turn && x.area == null && x.str > 0).map((x) => x.id);
  g.tfNew = CUR.id === 'bulge' ? g.chits.filter((x) => x.kind === 'task_force' && x.box === 'available').map((x) => x.id) : [];   // 16.22: a Task Force kept back may be placed later
  for (const c of g.chits.filter((x) => x.turn === g.turn && (x.box === 'future' || (x.box === 'used' && x.direct)))) {
    if (c.kind === 'task_force' && CUR.id === 'bulge') { c.box = 'available'; g.tfNew.push(c.id); } else if (c.direct) { c.box = 'available'; c.direct = undefined; } else c.box = 'cup';     // direct: back straight to the Available Box (Golan 17.34)
  }
}
export function placeTaskForce(g: Game, id: string, area: number) {
  const c = chit(g, id);
  if (g.phase !== 'reinforcement' || !g.tfNew.includes(id) || c.box !== 'available') throw new Error('task force cannot be placed now');
  if (g.control[area] !== 'allied' || contested(g, area) || !inSupply(g, 'allied', area)) throw new Error('needs a supplied, friendly-controlled, uncontested area');
  c.box = 'map'; g.tfNew = g.tfNew.filter((x) => x !== id);
  g.units.push({ id: `TF-${id}`, name: `Task Force (${areas.get(area)!.name})`, side: 'allied', cls: 'infantry', q: ['green'], max: 1, str: 1, area, garrison: true, disorder: 0, unsupplied: false, moved: true, reserve: null, exploit: false, ech: 'us_sr', chitId: id });
  say(g, `Task Force placed in ${areas.get(area)!.name}`, 'allied');
}

/* ================= reserves ================= */
const bulgeMarkerKey = (_g: Game, u: Unit) => (u.side === 'german' ? `z${zoneOf(u.area!)}` : zoneOf(u.area!) === 7 ? 'z7' : 'z56');
const markerKey = (g: Game, u: Unit) => CUR.markerKey(g, u);
export function canReserve(g: Game, u: Unit) {
  return g.moving?.id !== u.id && u.area != null && !u.garrison && !u.fort && (!u.ghost || !!CUR.ghostsMove?.(g)) && !u.reserve && !u.moved && !u.unsupplied && u.disorder === 0 && !contested(g, u.area) && (g.markers[u.side]?.[markerKey(g, u)] ?? 0) > 0 && (CUR.reserveOk?.(g, u) ?? true);
}
/** 3.22 / 5.21: the Phasing Player marks reserves in his Operational Movement Phase; `anyTime` is for Command Staff 8.33 and set-ups. */
export function setReserve(g: Game, id: string, on: boolean, anyTime = false) {
  const u = g.units.find((x) => x.id === id)!;
  if (on && g.moving && g.moving.id !== id) endMove(g);
  if (on && !anyTime && (g.phase !== 'movement' || u.side !== g.phasing)) throw new Error('reserves are marked by the phasing player in his Movement Phase (5.21)');
  if (on) { if (!canReserve(g, u)) throw new Error('no eligible reserve marker for this unit'); if (u.interdict && !interdictCheck(g, u)) { u.adjOnly = true; const k0 = markerKey(g, u); g.markers[u.side][k0]--; (g.markersHeld ??= []).push([u.side, k0]); throw new Error('Greif interdict: morale check failed, it cannot be placed in reserve, and that marker is out for this phase (17.11)'); } const k = markerKey(g, u); g.markers[u.side][k]--; u.reserve = k; CUR.onReserve?.(g, u); }
  else if (u.reserve) { g.markers[u.side][u.reserve]++; u.reserve = null; }
}
const dropReserve = (g: Game, u: Unit) => { if (u.reserve) { g.markers[u.side][u.reserve]++; u.reserve = null; } };

/* ================= movement ================= */
const fuelChits = (g: Game) => boxOf(g, 'german', 'available').filter((c) => c.kind === 'fuel');
export interface Opt { area: number; cost: number; fuel: boolean; mustStop: boolean; path: number[]; triggers?: string[]; limited?: string[] }
const markerAreas = (g: Game, owner: Side) => Object.keys(g.roadblocks).map(Number).filter((a) => g.roadblocks[a] === owner && !unitsIn(g, a).length);
export function moveOptions(g: Game, id: string): Opt[] {
  setPlayArea(g.inPlay);
  const u = g.units.find((x) => x.id === id)!;
  if (u.area == null || u.garrison || u.fort || (u.ghost && !CUR.ghostsMove?.(g)) || u.moved) return [];
  const mover = g.phase === 'reaction' ? other(g.phasing) : g.phasing;
  const exploit = g.phase === 'btMove' && u.exploit, reserveBt = g.phase === 'btMove' && !!u.reserve;
  const ok = (g.phase === 'movement' && u.side === g.phasing) || (g.phase === 'reaction' && u.side === mover && !!u.reserve) || (g.phase === 'btMove' && u.side === g.phasing && (exploit || reserveBt));
  if (!ok) return [];
  const enemy = other(u.side), one = exploit && !reserveBt && !u.peiperFull;                            // 18.3 KG Peiper may use its full allowance once
  let r = CUR.reach(g, u, one);
  if (exploit && !reserveBt) r = r.filter((x) => !x.path.some((p, i) => i > 0 && g.blown.includes(keyOf(x.path[i - 1], p))));
  const mv = g.moving?.id === u.id ? g.moving : null;
  if (mv?.left) r = r.filter((x) => !unitsIn(g, x.area, other(u.side)).length);                        // 5.34: having left a contested area, it may neither enter nor create another one
  if (mv?.fuel) r = r.map((x) => ({ ...x, fuel: false }));                                             // 16.13: the move's fuel is already paid                        // 7.31 no crossing of a blown bridge
  return r.filter((x) => {
    if (CUR.moveOk && !CUR.moveOk(g, u, x.area)) return false;
    if (!roomFor(g, u, x.area)) return false;                                                          // 5.1
    if (u.disorder > 0 && unitsIn(g, x.area, enemy).length) return false;                              // 9.33d: a disordered unit may not enter an area with enemy units or assets
    const en = unitsIn(g, x.area, enemy).length > 0, cont = contested(g, x.area);
    if (g.phase === 'reaction' && en && !cont) return false;                                           // 7.2: reaction never creates a newly contested area
    const last = connection(x.path[x.path.length - 2], x.area)!;
    if (en && last.river && g.riverCross.includes(keyOf(x.path[x.path.length - 2], x.area))) return false; // 5.35c
    return true;
  });
}
/** Where a Bulge unit can get to (movement.ts): army boundaries, fuel, roadblocks, von der Heydte, interdiction. */
function bulgeReach(g: Game, u: Unit, one: boolean): Opt[] {
  const enemy = other(u.side), occ = (a: number) => ({ german: blocks(g, a, 'german').length, allied: blocks(g, a, 'allied').length });
  const garr = new Set(g.units.filter((x) => x.garrison && x.side === enemy && x.area != null && !blocks(g, x.area, enemy).length).map((x) => x.area!));
  const r = reachable({ side: u.side as 'german' | 'allied', cls: u.cls, area: u.area!, supplied: !u.unsupplied, disordered: u.disorder > 0, adjacentOnly: one || !!u.adjOnly, spent: u.spent, ownZone: one ? undefined : (ARMY(u) as 5 | 6 | 7 | undefined), boundaryPreauthorized: u.bcross },
    { occupants: occ, blownBridges: new Set(g.blown), roadblocks: new Set([...garr, ...markerAreas(g, enemy)]), enemyAssets: (a) => garr.has(a), controller: (a) => g.control[a] as 'german' | 'allied' | undefined,
      extraCost: (f, t) => (markerAreas(g, enemy).includes(t) ? 1 : 0) + (unitsIn(g, t).length && !blocks(g, t, 'german').length && !blocks(g, t, 'allied').length ? 1 : 0) + (u.side === 'german' ? (g.interdicted[f] ? 1 : 0) + (g.interdicted[t] ? 1 : 0) : 0) });   // 17.21: +1 to enter and +1 to leave
  return r.filter((x) => !(u.side === 'german' && x.fuel && g.opts.fuel && !fuelChits(g).length && !(g.moving?.id === u.id && g.moving.fuel)));    // 16.13
}
/** 17.11 Greif interdict: the unit rolls morale before it moves; failing, it may only move one area. */
function bulgeBeforeMove(g: Game, u: Unit, opt: Opt) { if (u.interdict && !interdictCheck(g, u) && opt.path.length > 2) { u.adjOnly = true; return 'interdict'; } }
/** Fuel (16.13), KG Peiper (18.3), Greif bridges taken (17.12), von der Heydte relieved and the paradrop result (16.11). */
function bulgeAfterMove(g: Game, u: Unit, opt: Opt) {
  if (u.side === 'german' && opt.fuel && g.opts.fuel) { const f = fuelChits(g).sort((x, y) => +!!y.bid - +!!x.bid)[0]; if (f) { f.box = f.bid ? 'eliminated' : 'used'; say(g, `${f.bid ? 'bid ' : ''}fuel asset spent for ${u.name}${f.bid ? ' (eliminated, 18.2)' : ''}`); } }
  if (u.peiperFull) { u.peiperFull = false; if (!g.peiperUsed) say(g, 'KG Peiper uses its full movement allowance (18.3)'); g.peiperUsed = true; }
  if (u.side === 'german') for (let i = 1; i < opt.path.length; i++) { const k = keyOf(opt.path[i - 1], opt.path[i]); if (g.greif[k]) { chit(g, g.greif[k]).box = 'eliminated'; delete g.greif[k]; say(g, 'Greif Team Bridge: the bridge is taken'); } }
  const hd = unitsIn(g, opt.area).find((x) => x.heydte);
  if (hd && u.side === 'german') { chit(g, hd.chitId!).box = 'used'; hd.area = null; hd.str = 0; say(g, 'von der Heydte is relieved and becomes a regular battle asset'); }
  paradropReveal(g, opt.area, u, opt.cost);
}
function finishMove(g: Game, u: Unit, opt: Opt, bridgeBlown: boolean, step?: { left: boolean }) {
  const bc = u.bcross, peiper = !!u.peiperFull, wasExploit = u.exploit && !u.reserve && !peiper, m = g.moving?.id === u.id ? g.moving : null;   // 18.3: Peiper's full move goes on step by step
  for (const a of opt.path.slice(1)) if (g.roadblocks[a] && g.roadblocks[a] !== u.side) delete g.roadblocks[a];   // 4.34 (2016): a roadblock goes when an enemy unit pays its penalty, not when a friendly unit enters
  u.bcross = false;                                                                          // 14.62a the marker goes when the unit next moves
  const from = u.area!, to = opt.area, last = connection(opt.path[opt.path.length - 2], to)!, enemy = other(u.side);
  const intoEnemy = unitsIn(g, to, enemy).length > 0;
  for (const a of opt.path.slice(1, -1)) if (!unitsIn(g, a).length && g.control[a] !== u.side) { u.area = a; updateControl(g, a); say(g, `${u.name} passes through ${areas.get(a)!.name}: now ${CUR.sideName[u.side] ?? u.side}-controlled (2.4)`); }   // 2.4: control changes the instant a unit is sole occupant, passing through too
  const faceUp = unitsIn(g, to, enemy).some((x) => x.up === to);                              // 5.22 a unit entering a contested area whose forces are already face-up is revealed too
  u.from = intoEnemy ? opt.path[opt.path.length - 2] : from; u.area = to; if (faceUp) u.up = to; u.moved = true; u.adjOnly = false; u.spent = 0; dropReserve(g, u);   // into the enemy: the area it came from is the one across the boundary (an aborted river assault goes back there, 6.5)
  if (intoEnemy && last.river) { g.riverCross.push(keyOf(opt.path[opt.path.length - 2], to)); }
  if (intoEnemy) (g.entered[to] ??= []).push({ id: u.id, river: last.river, blown: bridgeBlown || g.blown.includes(keyOf(opt.path[opt.path.length - 2], to)) });
  if (g.phase === 'btMove' || g.phase === 'movement') { u.exploit = u.exploit && g.phase === 'btMove' ? false : u.exploit; }
  CUR.afterMove?.(g, u, opt);
  updateControl(g, from); updateControl(g, to);
  say(g, `${u.name} ${areas.get(from)!.name} → ${areas.get(to)!.name} (${opt.cost} MP)`);
  g.moving = null;
  if (step && !opt.mustStop && u.area === to && !wasExploit && !u.adjOnly && !u.disorder && !u.unsupplied && ['movement', 'reaction', 'btMove'].includes(g.phase)) {   // one area at a time: it may go on with the points left
    u.moved = false; u.spent = opt.cost; u.bcross = bc; if (peiper) { u.exploit = true; u.peiperFull = true; } g.moving = { id: u.id, left: step.left, steps: (m?.steps ?? 0) + opt.path.length - 1, fuel: !!(m?.fuel || opt.fuel) };
    if (!moveOptions(g, u.id).length) endMove(g);
  }
}
/** The block moving step by step stops here (or another block is chosen, or the phase ends): its move is over. */
export function endMove(g: Game) { const m = g.moving; if (!m) return; const u = g.units.find((x) => x.id === m.id); if (u) { u.moved = true; u.spent = 0; if (u.peiperFull) { u.peiperFull = undefined; u.exploit = false; } } g.moving = null; }
/** The movement allowance of a block (MP), for showing how many points a moving block has left. */
export const allowance = (g: Game, u: Unit) => CUR.allowance?.(g, u) ?? (u.cls === 'armor' ? 6 : 3);
/** Move a block. `step`: the table's one-area-at-a-time move, after which the block may go on with the points it has left (the tests move in one go). */
export function move(g: Game, id: string, to: number, step = false) {
  if (g.moving && g.moving.id !== id) endMove(g);                                                 // another block: the one moving before is done for good
  if (g.pendingBlow) throw new Error('resolve the bridge-blowing attempt first');
  const opt = moveOptions(g, id).find((x) => x.area === to); if (!opt) throw new Error('illegal move');
  const u = g.units.find((x) => x.id === id)!;
  { const pre = CUR.beforeMove?.(g, u, opt); if (pre) return pre; }
  const prev = opt.path[opt.path.length - 2], last = connection(prev, to)!, enemy = other(u.side);
  const newly = unitsIn(g, to, enemy).length > 0 && !g.contestedAtMoveStart.includes(to);        // 5.35d: newly contested this phase, even once a first unit entered overland
  if (last.river && (CUR.id !== 'golan73' || last.type === 'road') && !g.blown.includes(keyOf(prev, to)) && newly && !g.blowTried.includes(to) && (g.phase === 'movement' || g.phase === 'btMove')) {   // Golan 14.41: no bridge on a field connection
    g.pendingBlow = { unit: id, path: opt.path, fuel: opt.fuel || undefined, spent: (moveOptions(g, id).find((x) => x.area === opt.path[opt.path.length - 2])?.cost ?? 0) }; return 'blow';                                       // 5.35d the opponent may try to blow the bridge
  }
  finishMove(g, u, opt, false, step ? { left: g.moving?.id === id ? g.moving.left : contested(g, u.area!) } : undefined); return 'moved';
}
export function resolveBlow(g: Game, attempt: boolean) {
  const p = g.pendingBlow!; g.pendingBlow = null;
  const u = g.units.find((x) => x.id === p.unit)!, to = p.path[p.path.length - 1], prev = p.path[p.path.length - 2];
  const opt = { area: to, cost: 0, fuel: !!p.fuel, mustStop: true, path: p.path };   // 16.13: a long German move still spends its fuel
  g.blowTried.push(to);
  if (!attempt) { finishMove(g, u, { ...opt, cost: p.path.length }, false); return 'crossed'; }
  const r = roll(g), need = g.greif[keyOf(prev, to)] ? 1 : 5;                       // 17.12: a Greif team holding the bridge makes it a 1
  (g.checks ??= []).push({ who: `Bridge ${areas.get(prev)!.name}–${areas.get(to)!.name}`, why: 'Blow the bridge (5.35d)', sn: need, die: r, ok: r <= need, area: prev }); if (g.checks.length > 30) g.checks.splice(0, g.checks.length - 30);   // shown on the table like a morale check
  if (r > need) { say(g, `bridge blow attempt failed (rolled ${r})`); finishMove(g, u, { ...opt, cost: p.path.length }, false); return 'failed'; }
  g.blown.push(keyOf(prev, to)); say(g, `bridge ${areas.get(prev)!.name}–${areas.get(to)!.name} blown (rolled ${r})`); dropGreif(g, keyOf(prev, to));
  const exploitOnly = g.phase === 'btMove' && u.exploit && !u.reserve;
  if (exploitOnly) { u.moved = true; u.exploit = false; say(g, `${u.name} cannot cross the blown bridge and does not move at all (7.31)`); return 'stopped'; }          // exploitation units may not cross a blown bridge, even one blown by their own attempt
  if (p.path.length === 2) { finishMove(g, u, { ...opt, cost: 6 }, true); return 'blown-crossed'; }     // began adjacent: still crosses, whole allowance
  // 5.35d: it does not enter the area, loses one movement point, and may carry on from where it stands
  const here = p.path.length - 2 > 0 ? prev : u.area!; u.spent = (p.spent ?? 0) + 1; u.area = here; u.from = p.path[0]; dropReserve(g, u);
  say(g, `${u.name} stops in ${areas.get(prev)!.name} (bridge blown ahead) and may keep moving`); updateControl(g, p.path[0]); updateControl(g, prev);
  return 'stopped';
}
/** Strategic movement (5.4, 14.8): supplied reserve units, any friendly-controlled supplied area reachable over road/field links without blown bridges or enemy areas. */
function clearInterdict(g: Game, u: Unit) { if (u.interdict) { chit(g, u.interdict).box = 'eliminated'; u.interdict = undefined; say(g, `${u.name}: interdict marker removed (Special Action movement)`); } }
function dropGreif(g: Game, k: string) { if (g.greif[k]) { chit(g, g.greif[k]).box = 'eliminated'; delete g.greif[k]; } }
/** Where a strat-move can go, each area with the area it is reached from (the route). */
function stratReach(g: Game, u: Unit): Map<number, number> {
  const prev = new Map<number, number>([[u.area!, -1]]), q = [u.area!];
  while (q.length) { const a = q.shift()!; for (const n of neighbors(a)) {
    if (prev.has(n) || g.control[n] !== u.side || unitsIn(g, n, other(u.side)).length || contested(g, n) || g.blown.includes(keyOf(a, n))) continue;
    const step = CUR.stratStep ? CUR.stratStep(g, u, a, n) : true; if (!step) continue;
    prev.set(n, a); if (step !== 'end') q.push(n);                                                // 'end': reachable, but not a way through (The Bulge: an interdicted area)
  } }
  return prev;
}
export function stratOptions(g: Game, id: string): number[] {
  const u = g.units.find((x) => x.id === id)!;
  if (g.phase !== 'strategic' || u.side !== g.phasing || !u.reserve || u.unsupplied || u.area == null || u.moved) return [];
  if (CUR.stratAllowed && !CUR.stratAllowed(g, u)) return [];
  return [...stratReach(g, u).keys()].filter((a) => a !== u.area && (!CUR.moveOk || CUR.moveOk(g, u, a)) && roomFor(g, u, a) && inSupply(g, u.side, a));
}
/** The Bulge: one German strat-move per phase and it costs fuel (16.13); never across the restricted boundary; not through an interdicted area (17.2). */
const bulgeStratAllowed = (g: Game, u: Unit) => !(u.side === 'german' && (g.stratMoves >= 1 || (g.opts.fuel && !fuelChits(g).length)));
const bulgeStratStep = (g: Game, u: Unit, a: number, n: number): boolean | 'end' => (connection(a, n)!.restricted ? false : u.side === 'german' && g.interdicted[n] ? 'end' : true);
const bulgeAfterStrat = (g: Game, u: Unit) => { if (u.side === 'german') { g.stratMoves++; if (g.opts.fuel) { const f = fuelChits(g).sort((x, y) => +!!y.bid - +!!x.bid)[0]; f.box = f.bid ? 'eliminated' : 'used'; } } };   // 18.2 bid fuel first, eliminated
export function stratMove(g: Game, id: string, to: number) {
  if (!stratOptions(g, id).includes(to)) throw new Error('illegal strategic move');
  const u = g.units.find((x) => x.id === id)!, from = u.area!, prev = stratReach(g, u), path = [to];
  while (prev.get(path[0])! >= 0) path.unshift(prev.get(path[0])!);
  if (u.interdict && !interdictCheck(g, u)) { u.adjOnly = true; return; }                            // 17.11: a strat-move is a move attempt; failing, no strat-move
  if (CUR.id === 'bulge' && u.side === 'german') for (let i = 1; i < path.length; i++) dropGreif(g, keyOf(path[i - 1], path[i]));   // 17.12: a German crossing takes the bridge
  CUR.afterStrat?.(g, u, path);
  u.area = to; u.moved = true; dropReserve(g, u); updateControl(g, from); updateControl(g, to);
  say(g, `${u.name} strategic move ${areas.get(from)!.name} → ${areas.get(to)!.name}`);
}

/* ================= special actions & admin ================= */
/** 8.1: an event helps its own Higher Echelon; The Bulge's Strategic Reserve units use the events of the army whose zone they stand in (15.1c), and a German event works only in its army's zone (17.1). */
const saMatch = (c: Chit, e: string | undefined, area?: number) => (!c.ech || !e || c.ech === e || c.ech === 'us_sr' || e === 'us_sr' || (e === 'de_sr' && c.side === 'german')) && (area == null || c.side !== 'german' || c.ech === 'german' || ZONE[c.ech] === zoneOf(area));
export function saAvailable(g: Game, side: Side, ech?: string | string[], area?: number) {
  const blk = boxOf(g, side, 'available').find((c) => c.kind === 'sa_block'), echs = ech == null ? [] : Array.isArray(ech) ? ech : [ech];
  const ev = boxOf(g, side, 'available').filter((c) => c.kind === 'special_action_event' && (!echs.length ? area == null || saMatch(c, c.ech, area) : echs.some((e) => saMatch(c, e, area))));
  const list = [...(blk ? [blk] : []), ...ev];
  return CUR.saFilter ? CUR.saFilter(g, side, list, echs[0]) : list;
}
/** Spend a Special Action: the one the player chose (`chitId`), or else the first that fits (the reusable block first). */
export function spendSA(g: Game, side: Side, ech?: string | string[], why = 'Special Action', chitId?: string, area?: number) {
  const ok = saAvailable(g, side, ech, area), c = chitId ? ok.find((x) => x.id === chitId) : ok[0];
  if (!c) throw new Error(chitId ? 'that Special Action cannot be used for this unit (8.1: an event only helps its own Higher Echelon)' : 'no Special Action available');
  c.box = c.kind === 'sa_block' ? 'used' : 'eliminated'; say(g, `${side} spends ${c.kind === 'sa_block' ? 'the reusable Special Action' : 'a Special Action event'}: ${why}`, side); CUR.onSpendSA?.(g, side, c); return c;
}
const needAdmin = (g: Game) => { if (g.phase !== 'admin') throw new Error('only in the Admin Phase'); };
export const suppliedArea = (g: Game, side: Side, a: number) => g.control[a] === side && inSupply(g, side, a) && !contested(g, a);
const supplied = (g: Game, side: Side, a: number) => g.control[a] === side && inSupply(g, side, a) && !contested(g, a) && !airSup(g).some((s) => s.area === a && s.side === side);   // 9.34d: no engineering for an air-supplied area
/** 14.43: the British operate only northwest of the Meuse, from area 57 in the north to area 96 in the west (areas on that side of the Meuse in the hand-drawn map). */
export const BRITISH_AREAS = new Set([57, 58, 78, 79, 92, 93, 94, 95, 96]);
const britishOk = (u: Unit, a: number) => u.ech !== 'br_xxx' || BRITISH_AREAS.has(a);
const ARMY_ECH: Record<number, string> = { 5: 'de_5pz', 6: 'de_6pz', 7: 'de_7a' };
export const assetZoneOk = (g: Game, c: Chit, a: number, bridging = false) => CUR.id !== 'bulge' || c.side === 'allied' || c.ech === 'de_sr' || c.ech === 'german' || ZONE[c.ech] === zoneOf(a) ||
  (bridging && c.kind === 'engineer' && !g.chits.some((x) => x.kind === 'engineer' && x.ech === ARMY_ECH[zoneOf(a)] && x.box !== 'eliminated'));   // 14.52 an army that lost its engineer may borrow another   // 16.1 German assets/events act only in their own army's zone
export function bridgeTargets(g: Game, side: Side, area: number) {
  return neighbors(area).filter((n) => connection(area, n)!.river && !g.blown.includes(keyOf(area, n)) && !(g.greif[keyOf(area, n)] && g.greifTried.includes(keyOf(area, n))) && supplied(g, side, area));   // 17.12: one try per Admin Phase on a Greif bridge
}
export function blowBridges(g: Game, id: string, area: number, targets: number[]) {
  needAdmin(g); const c = chit(g, id);
  if (c.kind !== 'engineer' || c.box !== 'available') throw new Error('engineer not available');
  if (!assetZoneOk(g, c, area, true) || !bridgeTargets(g, c.side, area).length || targets.length < 1 || targets.length > 2 || !targets.every((t) => bridgeTargets(g, c.side, area).includes(t))) throw new Error('not a legal bridge-blowing');
  c.box = 'used';
  for (const t of targets) {
    const k = keyOf(area, t);
    if (g.greif[k]) { if (g.greifTried.includes(k)) { say(g, 'the Greif-held bridge was already tried this Admin Phase'); continue; } const r = roll(g); g.greifTried.push(k); if (r > 5) { say(g, `engineer fails to blow the Greif-held bridge (rolled ${r})`); continue; } say(g, `engineer blows the Greif-held bridge (rolled ${r})`); }
    g.blown.push(k); dropGreif(g, k);
  }
  say(g, `${c.name} works on ${targets.length} bridge(s) from ${areas.get(area)!.name}`, c.side);
}
export function repairTargets(g: Game, side: Side, area: number) {
  if (!supplied(g, side, area)) return [];
  return neighbors(area).filter((n) => g.blown.includes(keyOf(area, n)) && (g.control[n] === side || (g.control[n] === other(side) && contested(g, n))));
}
export function repairBridge(g: Game, id: string, area: number, to: number) {
  needAdmin(g); const c = chit(g, id);
  if (c.kind !== 'engineer' || c.box !== 'available' || !assetZoneOk(g, c, area, true) || !repairTargets(g, c.side, area).includes(to)) throw new Error('not a legal repair');
  if (c.side === 'german' && g.opts.bridgeLimit && (g.bridgesLeft ?? 6) <= 0) throw new Error('the Germans have repaired their six bridges (18.1)');
  if (c.side === 'german' && g.opts.bridgeLimit) g.bridgesLeft = (g.bridgesLeft ?? 6) - 1;
  g.blown = g.blown.filter((k) => k !== keyOf(area, to)); c.box = 'used'; say(g, `${c.name} repairs the bridge ${areas.get(area)!.name}–${areas.get(to)!.name}${c.side === 'german' && g.opts.bridgeLimit ? ` (German repairs left: ${g.bridgesLeft}, 18.1)` : ''}`, c.side);
}
export function fieldWorksFor(g: Game, id: string, area: number) {
  needAdmin(g); const c = chit(g, id);
  const same = blocks(g, area, c.side).some((u) => u.ech === c.ech || c.ech === 'us_sr' || u.ech === 'us_sr');
  if (c.kind !== 'engineer' || c.box !== 'available' || !supplied(g, c.side, area) || !same || g.fieldWorks.includes(area) || !assetZoneOk(g, c, area)) throw new Error('needs a supplied, uncontested area holding a unit of the engineer\'s echelon');
  g.fieldWorks.push(area); g.fwOwner[area] = c.side; c.box = 'used'; say(g, `${c.name} builds field works in ${areas.get(area)!.name}`, c.side);
}
function addStep(g: Game, u: Unit, elite: boolean) {
  const nq = u.q[u.str]; if (u.fort) throw new Error('strongpoints never receive replacement steps (15.6)');
  if (u.str >= u.max || helpless(g, u) || (!elite && nq === 'elite')) throw new Error('that unit cannot receive a step');
  u.str++;
}
export function eligibleForStep(c: Chit, u: Unit, g?: Game) {
  if (c.kind === 'event_arriving_regiment' && u.side === c.side && u.area == null && u.str === 0 && !u.garrison) return u.name === `${parseInt(c.division ?? '')} Inf`;     // 17.23 brings an eliminated division back
  if (u.side !== c.side || u.area == null || u.garrison || u.fort || u.unsupplied || (g && airSupplied(g, u)) || u.str >= u.max) return false;
  if (c.kind !== 'event_arriving_regiment' && u.q[u.str] === 'elite') return false;                    // 17.31, 17.32: never the elite step
  const arm = c.kind === 'replacement_arm' || c.kind === 'rebuild_or_replace_arm', inf = c.kind === 'replacement_inf' || c.kind === 'rebuild_or_replace_inf';
  if (c.kind === 'event_arriving_regiment') return u.name === `${parseInt(c.division ?? '')} Inf`;
  if (arm && u.cls !== 'armor') return false; if (inf && u.cls !== 'infantry') return false;
  if (c.ech === 'de_sr' || c.ech === 'us_sr') return true;
  if (c.side === 'german' && ZONE[c.ech] !== zoneOf(u.area)) return false;
  return u.ech === c.ech || u.ech === 'us_sr' || (c.side === 'german' && u.ech === 'de_sr');   // 15.1c: plus the Strategic Reserve units
}
/** 17.23: the appropriate friendly-controlled entry areas an eliminated division comes back to. */
export const regimentAreas = (g: Game, unitId: string) => { const u = g.units.find((x) => x.id === unitId)!; return [...new Set([...listedEntries(u), ...appropriateAreas(u, g)])].filter((a) => g.control[a] === u.side && entryOpen(g, u, a)); };
export function playReplacement(g: Game, id: string, unitId: string, area?: number) {
  needAdmin(g); const c = chit(g, id), u = g.units.find((x) => x.id === unitId)!;
  if (c.box !== 'available' || !eligibleForStep(c, u, g)) throw new Error('that unit is not eligible');
  if (u.area == null) {                                                                                     // 17.23: back into play with one step in a free friendly entry area of the player's choice
    const ok = regimentAreas(g, unitId), to = area ?? ok[0]; if (to == null || !ok.includes(to)) throw new Error('no free friendly-controlled entry area for it there (17.23)');
    u.str = 1; u.area = to; u.disorder = 0; u.unsupplied = false; g.control[to] = u.side; g.elimLarge = g.elimLarge.filter((x) => x !== u.id); c.box = 'eliminated';
    return say(g, `${c.name}: ${u.name} returns in ${areas.get(to)!.name} with 1 step`, c.side);
  }
  addStep(g, u, c.kind === 'event_arriving_regiment'); c.box = 'eliminated'; say(g, `${c.name}: ${u.name} gains a step (${u.str}/${u.max})`, c.side);
}
export function playRebuild(g: Game, id: string, unitId: string, area: number) {
  needAdmin(g); const c = chit(g, id), u = g.units.find((x) => x.id === unitId)!;
  const arm = c.kind === 'rebuild_or_replace_arm';
  const ownArmy = c.ech === 'us_sr' || c.ech === 'de_sr' || u.ech === c.ech || u.ech === 'us_sr' || u.ech === 'de_sr';   // 17.2: its own Army's units
  if (!c.kind.startsWith('rebuild') || c.box !== 'available' || u.area != null || u.str !== 0 || !ownArmy || u.max !== 1 || u.side !== c.side || u.q[0] === 'elite' || (arm !== (u.cls === 'armor')) || g.control[area] !== c.side || !(areas.get(area)!.vp.allied || areas.get(area)!.vp.mutual || areas.get(area)!.vp.german)) throw new Error('cannot return that unit there');
  u.area = area; u.str = 1; c.box = 'eliminated'; say(g, `${u.name} returns to ${areas.get(area)!.name}`, c.side);
}
/** 4.21: the eliminated assets an event may bring back (never garrisons, Task Forces or bid fuel: 16.21, 16.22, 18.2). */
export const alternateCandidates = (g: Game, side: Side) => boxOf(g, side, 'eliminated').filter((x) => isAsset(x) && x.kind !== 'garrison' && x.kind !== 'task_force' && !x.bid);
/** 4.21: spend an event to put two eliminated assets of the owner's choice (`ids`) back in the cup; without `ids`, a fixed priority picks them (tests). */
export function alternateUse(g: Game, id: string, ids?: string[]) {
  needAdmin(g); const c = chit(g, id);
  if (c.box !== 'available' || isAsset(c) || c.kind === 'sa_block') throw new Error('not an event');
  if (CUR.saFilter && !CUR.saFilter(g, c.side, boxOf(g, c.side, 'available'), c.ech).includes(c)) throw new Error('this event cannot be spent alone now');   // e.g. Sicily 17.11 Patton: two US events
  const pri = ['engineer', 'artillery', 'rocket_artillery', 'armor_asset', 'infantry_asset', 'fuel'], cands = alternateCandidates(g, c.side);
  const back = ids ? ids.map((x) => cands.find((y) => y.id === x)!) : [...cands].sort((a, b) => pri.indexOf(a.kind) - pri.indexOf(b.kind)).slice(0, 2);
  if (ids && (back.some((x) => !x) || new Set(ids).size !== ids.length || ids.length !== Math.min(2, cands.length))) throw new Error('choose two assets from your Eliminated Box (4.21)');
  if (!back.length) throw new Error('no assets in the Eliminated Box to bring back (4.21)');
  back.forEach((x) => (x.box = 'cup')); c.box = 'eliminated'; CUR.onSpendSA?.(g, c.side, c); say(g, `${c.name} used as alternate event: ${back.map((x) => x.name).join(', ')} back to the cup`, c.side);
}
export function rally(g: Game, side: Side, area: number, chitId?: string) {
  needAdmin(g); if (g.control[area] !== side || !inSupply(g, side, area)) throw new Error('area must be supplied and friendly');   // 8.25: any supplied area, contested or not
  const sa = spendSA(g, side, undefined, 'Rally the troops', chitId, area), only = sa.kind === 'special_action_event' && sa.ech !== 'us_sr' ? sa.ech : null;     // 8.1 a single-use event only affects its own Higher Echelon (17.1: a German one only in its army's zone)
  const fits = (u: Unit, a: number) => !only || ((u.ech === only || u.ech === 'us_sr' || u.ech === 'de_sr') && (side !== 'german' || ZONE[only] === zoneOf(a)));   // 15.1c, 15.2: plus the Strategic Reserve units
  for (const a of [area, ...neighbors(area)]) for (const u of blocks(g, a, side)) if (u.disorder && !helpless(g, u) && fits(u, a)) u.disorder = 0;
}
export function qualityReplacement(g: Game, unitId: string, chitId?: string) {
  needAdmin(g); const u = g.units.find((x) => x.id === unitId)!; if (u.area == null || u.str < 1 || u.garrison || u.fort || helpless(g, u) || u.str >= u.max) throw new Error('not eligible (strongpoints never receive steps, Golan 15.6)');   // 8.26: a supplied reduced unit on the map
  spendSA(g, u.side, u.ech, 'Quality replacements', chitId, u.area!); u.str++; say(g, `${u.name} gains a step`, u.side);
}
export function staffReplacement(g: Game, id: string, unitId: string) {
  needAdmin(g); const c = chit(g, id), u = g.units.find((x) => x.id === unitId)!;
  if (c.kind !== 'command_staff' || c.box !== 'available' || CUR.staffReplaceOk?.(g, c) === false || u.side !== c.side || u.cls !== 'infantry' || u.area == null || u.garrison) throw new Error('not eligible');
  addStep(g, u, false); c.box = 'used'; say(g, `Command staff: ${u.name} gains a step`, c.side);
}
export function staffReserve(g: Game, id: string, unitId: string) {
  needAdmin(g); const c = chit(g, id); if (c.kind !== 'command_staff' || c.box !== 'available') throw new Error('not available');
  const u = g.units.find((x) => x.id === unitId)!, m = u.moved; u.moved = false;                     // 8.33: any eligible unit (14.7), even one that moved in its own last breakthrough phase
  try { setReserve(g, unitId, true, true); } finally { u.moved = m; } c.box = 'used';
}
export function releaseUnit(g: Game, id: string, area: 4 | 6) {
  needAdmin(g); const c = chit(g, id); if (c.kind !== 'event_release' || c.box !== 'available') throw new Error('not available');
  const nm: Record<string, string> = { '11th': '11 Pz', '10th': '10SS', '17th': '17SS', '6th': '6SS' }, u = g.units.find((x) => x.name === nm[c.name.split(' ')[0]])!;
  if (g.inPlay && !g.inPlay.includes(area)) throw new Error('that entry area is not in play');
  if (u.area != null || blocks(g, area, 'german').length >= 2 || (g.control[area] !== 'german' && unitsIn(g, area).length)) throw new Error('entry area blocked');
  u.area = area; g.control[area] = 'german'; c.box = 'eliminated'; say(g, `${u.name} released and enters in ${areas.get(area)!.name}`, 'german');
}


/* ================= Bulge events (17.11, 17.12, 17.14, 16.11) and unit field works (5.23) ================= */
export function playGreifBridge(g: Game, id: string, a: number, b: number) {
  needAdmin(g); const c = chit(g, id), k = keyOf(a, b), cn = connection(a, b);
  if (c.kind !== 'event_greif_bridge' || c.box !== 'available' || !cn?.river || g.blown.includes(k) || g.greif[k]) throw new Error('needs an intact bridge on a river boundary');
  g.greif[k] = id; c.box = 'map'; say(g, `Greif Team Bridge placed on ${areas.get(a)!.name}–${areas.get(b)!.name}`, 'german');
}
export function playInterdict(g: Game, id: string, unitId: string) {
  needAdmin(g); const c = chit(g, id), u = g.units.find((x) => x.id === unitId)!;
  if (c.kind !== 'event_greif_interdict' || c.box !== 'available' || u.side !== 'allied' || u.ech === 'br_xxx' || u.area == null || u.garrison || u.interdict) throw new Error('needs an American block without an interdict marker (17.11)');
  u.interdict = id; c.box = 'map'; say(g, `Greif Team Interdict placed on ${u.name}`, 'german');
}
function check(g: Game, u: Unit, sn: number, why: string) {
  const die = roll(g), ok = succeeds(die, sn); (g.checks ??= []).push({ who: u.name, why, sn, die, ok, area: u.area }); if (g.checks.length > 30) g.checks.splice(0, g.checks.length - 30);
  return { r: die, ok };
}
/** 17.11: when the unit next tries to move, build field works or take a reserve marker it rolls morale with +2; on failure it only stays or moves one area. */
export function interdictCheck(g: Game, u: Unit) {
  const { r, ok } = check(g, u, moraleSn(quality(u), u.disorder > 0, u.unsupplied && !(g.opts.airborne && AIRBORNE.has(u.name))) + 2, 'Greif interdict morale check (17.11)');
  chit(g, u.interdict!).box = 'eliminated'; u.interdict = undefined;
  say(g, `Greif interdict: ${u.name} morale check rolled ${r} → ${ok ? 'passed, no effect' : 'failed'}`); return ok;
}
export function playBodenplatte(g: Game, id: string) {
  needAdmin(g); const c = chit(g, id); if (c.kind !== 'event_bodenplatte' || c.box !== 'available') throw new Error('not available');
  for (const m of boxOf(g, 'allied', 'available').filter((x) => x.kind === 'air_mission')) {
    const r = roll(g);                                                                // Player Aid D: 1-5 unaffected, 6-9 delayed (back to the cup), 10 eliminated
    if (r === 10) m.box = 'eliminated'; else if (r >= 6) m.box = 'cup';
    say(g, `Bodenplatte vs ${m.name} T${m.turn}: rolled ${r} → ${r === 10 ? 'eliminated' : r >= 6 ? 'delayed (back to the cup)' : 'unaffected'}`);
  }
  c.box = 'eliminated';
}
export const heydteWindow = (g: Game, c: Chit) => c.name === 'v.d. Heydte' && c.box === 'available' && g.phase === 'admin' && (c.firstDrawn ?? c.drawn) === g.turn * 10 + (g.phasing === 'german' ? 1 : 2) && !g.units.some((u) => u.heydte);
export function heydteDrop(g: Game, id: string, area: 31 | 52) {
  needAdmin(g); const c = chit(g, id);
  if (!heydteWindow(g, c) || unitsIn(g, area).length || g.control[area] !== 'allied') throw new Error('the drop zone must be vacant and Allied-controlled, in the Admin Phase the asset was drawn');
  c.box = 'map'; g.units.push({ id: 'HEYDTE', name: 'v.d. Heydte', side: 'german', cls: 'infantry', q: ['veteran'], max: 1, str: 1, area, garrison: true, disorder: 0, unsupplied: false, moved: true, reserve: null, exploit: false, ech: 'de_sr', chitId: id, paradrop: 'pending', heydte: true });
  say(g, `von der Heydte drops near ${areas.get(area)!.name} (not yet located)`);
}
/** 16.11: the first American unit to enter the drop area finds out how the paradrop went. */
function paradropReveal(g: Game, area: number, mover: Unit, cost: number) {
  const h = unitsIn(g, area).find((x) => x.paradrop === 'pending'); if (!h || mover.side !== 'allied') return;
  const r = roll(g);
  if (r === 1) { h.paradrop = 'intact'; say(g, `paradrop result ${r}: von der Heydte landed intact and holds ${areas.get(area)!.name}`); }
  else if (r <= 5) { h.paradrop = 'partial'; say(g, `paradrop result ${r}: partly scattered, it will not fire back`); }
  else { say(g, `paradrop result ${r}: completely scattered`); eliminate(g, h); if (!blocks(g, area, 'german').length && !g.roadblocks[area]) { mover.moved = false; mover.spent = cost; } }   // the unit may move on
}
export function buildFieldWorks(g: Game, id: string) {
  const u = g.units.find((x) => x.id === id)!;
  if (g.moving?.id === id) throw new Error('it has started moving: no field works (5.23)');
  if (g.moving) endMove(g);
  const ok = (g.phase === 'movement' && u.side === g.phasing) || (g.phase === 'reaction' && u.side !== g.phasing && !!u.reserve) || (g.phase === 'btMove' && u.side === g.phasing && (!!u.reserve || u.exploit));
  if (!ok || u.moved || u.area == null || u.garrison || u.fort || u.ghost || u.unsupplied || u.disorder || contested(g, u.area) || g.fieldWorks.includes(u.area)) throw new Error('needs a supplied unit in good order that has not moved, in an uncontested area without field works');
  if (u.interdict && !interdictCheck(g, u)) { u.adjOnly = true; throw new Error('Greif interdict: morale check failed, it cannot build field works'); }
  g.fieldWorks.push(u.area); g.fwOwner[u.area] = u.side; u.moved = true; dropReserve(g, u); u.exploit = false; say(g, `${u.name} builds field works in ${areas.get(u.area)!.name}`);
}

/* ================= combat ================= */
const fighters = (g: Game, a: number, side: Side, attacker: boolean) => unitsIn(g, a, side).filter((u) => !u.ghost && !(attacker && (u.disorder > 0 || u.fort)));
export const point = (g: Game, b: Battle, side: Side) => g.units.find((x) => x.id === (side === b.attacker ? b.attPoint : b.defPoint)) ?? null;
const pointOrder = (x: Unit, y: Unit) => +!!x.garrison - +!!y.garrison || +!!x.fort - +!!y.fort || y.str - x.str;      // regular blocks before strongpoints before standing assets
function fixPoint(g: Game, b: Battle) {
  for (const side of sidesOf(g)) {
    const p = point(g, b, side); if (p && p.area === b.area) continue;
    const us = fighters(g, b.area, side, side === b.attacker); if (!us.length) continue;
    const n = [...us].sort(pointOrder)[0].id; if (side === b.attacker) b.attPoint = n; else b.defPoint = n;
  }
}
/** The area the volume says must be fought before any other now (Golan 15.3), while it is still contested and unfought. */
export function firstBattle(g: Game): number | null { const f = CUR.firstBattle?.(g); return f != null && contested(g, f) && !g.fought.includes(f) ? f : null; }
export function startBattle(g: Game, a: number, viaSA = false, chitId?: string): Battle {
  if (g.battle) throw new Error('a battle is already open');
  const bt = g.phase === 'btCombat';
  if ((g.phase !== 'combat' && !bt && !CUR.battleAllowed?.(g, a)) || !contested(g, a) || g.fought.includes(a)) throw new Error('no battle here');
  const att = fighters(g, a, g.phasing, true).filter((u) => !u.garrison || !!CUR.battleAllowed?.(g, a)),   // a landing flank asset fights its own round (Sicily 17.22)
    def = fighters(g, a, other(g.phasing), false);
  if (!att.length) throw new Error('no attacker in good order');
  { const f = firstBattle(g); if (f != null && f !== a) throw new Error(`the battle in ${areas.get(f)!.name} must be fought first`); }
  let lockedAtStart = false;
  if (bt && !newlyContested(g).includes(a)) {
    if (CUR.freeBattle?.(g, a)) { say(g, 'a free Breakthrough combat round'); lockedAtStart = true; }           // the round is spent: the battle cannot be withdrawn
    else { if (!viaSA) throw new Error('re-engaging an already contested area costs a Special Action'); spendSA(g, g.phasing, [...new Set(att.map((u) => u.ech!))], 'breakthrough combat', chitId, a); lockedAtStart = true; }   // 8.1: an event of the attackers' echelon
  }
  const pick = (us: Unit[]) => [...us].sort(pointOrder)[0]?.id ?? '', empty = <T,>(v: T) => Object.fromEntries(sidesOf(g).map((s) => [s, structuredClone(v)])) as Record<Side, T>;
  const b: Battle = { area: a, attacker: g.phasing, attPoint: pick(att), defPoint: pick(def), bt, riverAssault: g.riverAssault.includes(a), stage: 'setup', queue: [], assets: empty<string[]>([]), air: {}, pending: 0,
    engFw: false, rolls: [], exploit: false, unitHit: empty(false), mark: g.log.length, hit: empty<string[]>([]), ready: [], locked: lockedAtStart,
    defSA: saAvailable(g, other(g.phasing)).length > 0 && [a, ...neighbors(a)].some((n) => unitsIn(g, n, other(g.phasing)).some((u) => !u.garrison && !u.fort && !u.ghost)) };
  { const pz = pz150In(g, b); if (pz) { if (pz.side === b.attacker) b.attPoint = pz.id; else b.defPoint = pz.id; } }
  g.battle = b; return b;
}
/* --- assets (6.22, 6.23, 6.31, 16.1, 16.12, 16.23, 15.2) --- */
function echelons(g: Game, b: Battle, side: Side) {
  const set = new Set<string>();
  for (const u of unitsIn(g, b.area, side)) if (!u.garrison) set.add(u.ech === 'de_sr' ? ({ 5: 'de_5pz', 6: 'de_6pz', 7: 'de_7a' } as Record<number, string>)[zoneOf(b.area)] : u.ech!);
  return set;
}
export function assetLimits(g: Game, b: Battle, side: Side) {
  const attacker = side === b.attacker, ech = echelons(g, b, side), us = side === 'allied' && [...ech].some((e) => e.startsWith('us_'));
  const pooled = g.pooled === b.area && us && [...ech].every((e) => e.startsWith('us_')), pure = [...ech].filter((e) => e !== 'us_sr'), mixed = pure.length > 1 && !pooled;                // 14.62b
  const onlyAssets = unitsIn(g, b.area, side).every((u) => u.garrison), vsDR = unitsIn(g, b.area, other(side)).some((u) => u.id.startsWith('DR-') || u.heydte);   // 16.23: no extra US artillery in a battle with a defended roadblock
  return { arty: (attacker ? 2 : 1) + (us && !mixed && !onlyAssets && !vsDR ? 1 : 0), battle: !mixed && !onlyAssets, event: !mixed && !onlyAssets, mixed, pure, ech, pooled };
}
/** 6.21-6.24: whose step it is in a battle's set-up. The Defender decides on a Special Action, then the Attacker assigns assets, then the Defender
 *  assigns his and designates his point unit, then the Attacker designates his point unit and begins the round (a second setReady). A volume may hand the step over for an answer (Golan: SAM, jamming). */
export function setupSide(g: Game, b: Battle): Side { return CUR.setupActor?.(g, b) ?? orderSide(b); }
const orderSide = (b: Battle): Side => { const def = other(b.attacker), r = b.ready ?? []; return b.defSA ? def : r.length === 2 ? b.attacker : r.includes(b.attacker) ? def : b.attacker; };
const attackerBegun = (b: Battle) => !!b.ready?.includes(b.attacker) || b.assets[b.attacker].length > 0 || !!b.air[b.attacker];
/** 6.21: the Defender goes on without a Special Action. */
export function passSA(g: Game, b: Battle) { if (b.stage !== 'setup' || !b.defSA) throw new Error('no Special Action decision pending'); b.defSA = false; }
const notYourStep = (g: Game, b: Battle, side: Side) => (b.defSA ? 'the Defender first decides on a Special Action (6.21)' : side === setupSide(g, b) ? null
  : side === b.attacker ? 'your assets are committed: now the Defender assigns (6.23)' : 'the Attacker assigns his assets first (6.22)');
const committed = (b: Battle, side: Side) => (b.ready?.includes(side) ? (side === b.attacker ? 'your assets are committed (6.22)' : 'your assets are committed (6.23)') : null);
export function canAssign(g: Game, b: Battle, side: Side, c: Chit, mode?: 'arty' | 'support'): string | null {
  if (b.stage !== 'setup') return 'assets are committed before the first roll';
  { const w = notYourStep(g, b, side) ?? committed(b, side); if (w) return w; }
  if (c.side !== side || c.box !== 'available') return 'not in the Available Box';
  return CUR.canAssign(g, b, side, c, mode);
}
/** The Bulge's asset rules: supply, army zones and Higher Echelons (6.22, 6.23, 16.1, 16.12, 16.23, 14.62b, 4.35), one Allied Air Mission. */
function bulgeCanAssign(g: Game, b: Battle, side: Side, c: Chit): string | null {
  if (c.kind === 'air_mission') { if (side !== 'allied') return 'Allied only'; if (unitsIn(g, b.area, side).every((u) => u.garrison)) return 'a garrison, Task Force or defended roadblock fighting alone gets no events (4.35, 16.21)'; return b.air.allied ? 'one air mission per battle' : null; }   // 17.21: unsupplied and air-supplied areas allowed   // 17.21: unsupplied areas allowed
  if (c.kind === 'task_force') return 'a Task Force is placed in the Reinforcement Phase, not assigned to battles (16.22)';
  if (unitsIn(g, b.area, side).some((u) => u.unsupplied) || !inSupply(g, side, b.area)) return 'units that cannot trace supply may not have assets (9.34a)';
  if (airSup(g).some((s) => s.area === b.area && s.side === side)) return 'air-supplied units may not have assets (9.34a)';
  const lim = assetLimits(g, b, side), cur = b.assets[side].map((x) => chit(g, x)), att = side === b.attacker, dr = unitsIn(g, b.area, side).find((x) => x.id.startsWith('DR-') || x.heydte);
  if (dr && (!isArty(c) || c.ech !== dr.ech || cur.length >= 1)) return 'a defended roadblock gets one artillery asset of its own Higher Echelon (4.35)';
  if (side === 'german' && c.ech !== 'de_sr' && ZONE[c.ech] !== zoneOf(b.area)) return "German assets act only in their own army's zone (16.1)";
  const armies = new Set(cur.filter((x) => x.ech !== 'us_sr').map((x) => x.ech));
  const echOk2 = c.ech === 'us_sr' || (side === 'german' && c.ech === 'de_sr') || lim.pure.includes(c.ech) || (lim.pooled && c.ech.startsWith('us_')) || (side === 'allied' && lim.pure.length === 0 && (armies.size === 0 || armies.has(c.ech)));
  if (!echOk2) return 'asset belongs to a different Higher Echelon';
  if (isArty(c) && unitsIn(g, b.area, side).every((x) => x.heydte)) return 'von der Heydte receives no artillery support';
  if (isArty(c)) {
    const arts = cur.filter(isArty), cap = lim.mixed ? (att ? lim.pure.length : 1) : lim.arty;
    if (arts.length >= cap) return `at most ${cap} artillery asset(s) here`;
    if (lim.mixed && att && arts.some((x) => x.ech === c.ech)) return 'only one artillery asset per involved Higher Echelon';
    if (side === 'german' && arts.length >= 1 && (arts[0].kind === c.kind || arts[0].ech !== c.ech)) return 'two German artillery assets need one regular and one rocket asset of the same army (16.12)';
    return null;
  }
  if (isBattleAsset(c)) { if (!lim.battle) return 'battle assets need units of one Higher Echelon'; const cap = att ? 8 : 5; return cur.filter(isBattleAsset).length >= cap ? `at most ${cap} battle assets for the ${att ? 'Attacker' : 'Defender'} (${att ? '6.22' : '6.23'})` : null; }
  return 'this chit cannot be assigned to a battle';
}
export function assign(g: Game, b: Battle, id: string, mode?: 'arty' | 'support', unit?: string) {
  const c = chit(g, id), err = canAssign(g, b, c.side, c, mode); if (err) throw new Error(err);
  c.box = 'map';
  if (c.kind === 'air_mission') { const a = { id, mode: mode ?? 'arty', unit }; if (b.air[c.side]) (b.air2 ??= {})[c.side] = a; else b.air[c.side] = a; } else b.assets[c.side].push(id);
  CUR.onAssign?.(g, b, c, mode, unit);
}
/** Take an asset back, in its owner's own set-up step only. */
export function unassign(g: Game, b: Battle, id: string) { const s = chit(g, id).side; if (s === orderSide(b) && !committed(b, s)) dropAsset(g, b, id); }   /* an air mission may be taken back while its SAM answer waits (16.12) */
function dropAsset(g: Game, b: Battle, id: string) {
  const c = chit(g, id); if (b.stage !== 'setup' || CUR.keepAssigned?.(g, b, c)) return; c.box = 'available';
  b.assets[c.side] = b.assets[c.side].filter((x) => x !== id); dropAir(b, c.side, id); CUR.onUnassign?.(g, b, c);
}
/** The air assets a side committed to a battle (one, or two in Golan '73). */
export const airOf = (b: Battle, side: Side) => [b.air[side], b.air2?.[side]].filter((a): a is { id: string; mode: 'arty' | 'support'; unit?: string } => !!a);
export function dropAir(b: Battle, side: Side, id: string) {
  if (b.air[side]?.id === id) delete b.air[side]; if (b.air2?.[side]?.id === id) delete b.air2[side];
  if (!b.air[side] && b.air2?.[side]) { b.air[side] = b.air2[side]; delete b.air2[side]; }
}
/* --- fire --- */
export interface Fire { key: string; who: string; shooter: Shooter; dice: number; sn: number; parts: [string, number][]; isAsset: boolean }
/** 6.33: the attacker's engineer will remove the enemy field works before offensive fire (chosen, field works there, engineer still in the battle). */
export const engRemovesFw = (g: Game, b: Battle) => b.engFw && g.fieldWorks.includes(b.area) && (g.fwOwner[b.area] ?? other(b.attacker)) !== b.attacker && b.assets[b.attacker].some((id) => chit(g, id).kind === 'engineer');
export function fireList(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground', ghost?: Unit): Fire[] {
  const att = side === b.attacker, tp = ghost ?? point(g, b, other(side)); if (!tp) return [];
  const out: Fire[] = [], tgt = { pointCls: tp.cls, pointQuality: quality(tp), strongpoint: tp.fort, fieldWorks: att && g.fieldWorks.includes(b.area) && (g.fwOwner[b.area] ?? other(side)) === other(side) && !(kind === 'ground' && engRemovesFw(g, b)), riverAssaultMarker: !att && b.riverAssault };
  const set = { attacker: att, tdn: areas.get(b.area)!.tdn, riverAssault: att && b.riverAssault, advArty: g.opts.advArty, night: CUR.isNight?.(g) };
  const add = (key: string, who: string, shooter: Shooter, isAsset: boolean) => { const r = CUR.successNumber({ side, ...shooter }, tgt, set); out.push({ key, who, shooter, dice: shooter.dice, sn: r.sn, parts: r.parts, isAsset }); };
  if (kind === 'arty') {
    for (const id of b.assets[side]) { const c = chit(g, id); if (isArty(c)) add(id, c.name, { kind: 'artillery', cls: 'infantry', dice: 1, rocket: c.kind === 'rocket_artillery' }, true); }
    for (const a of airOf(b, side)) if (a.mode === 'arty') add(a.id, 'Air Mission (artillery)', { kind: 'air', cls: 'infantry', dice: 1 }, true);
  } else {
    for (const u of fighters(g, b.area, side, att)) { if (u.paradrop === 'partial') continue; const sup = airOf(b, side).some((a) => a.mode === 'support' && a.unit === u.id); add(u.id, u.name, { kind: u.garrison ? 'battle' : 'unit', cls: u.cls, quality: quality(u), dice: u.fort ? 1 : u.str, disordered: u.disorder > 0, unsupplied: u.unsupplied, airSupport: sup, closeAirSupport: sup, strongpoint: u.fort }, !!u.garrison); }
    let skipEng = att && kind === 'ground' && engRemovesFw(g, b);                                    // 6.33: one engineer does the job instead of firing, the others fire
    for (const id of b.assets[side]) { const c = chit(g, id); if (!isBattleAsset(c)) continue; if (skipEng && c.kind === 'engineer') { skipEng = false; continue; } add(id, c.name, { kind: 'battle', cls: chitClass(c), quality: c.q, dice: 1 }, true); }
  }
  CUR.adjustFire?.(g, b, side, kind, out);
  return out;
}
function doFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground', engBusy = false) {
  CUR.beforeFire?.(g, b, side, kind);
  let total = 0;
  let skip = engBusy;
  for (const f of fireList(g, b, side, kind).filter((x) => { if (skip && b.assets[side].includes(x.key) && chit(g, x.key).kind === 'engineer') { skip = false; return false; } return true; })) { const dice = Array.from({ length: f.dice }, () => roll(g)), hits = dice.filter((d) => succeeds(d, f.sn)).length; total += hits; b.rolls.push({ who: f.who, sn: f.sn, dice, hits, kind }); }
  say(g, `${areas.get(b.area)!.name}: ${side} ${kind === 'arty' ? 'artillery' : 'ground fire'} ${total} hit(s)`);
  CUR.afterFire?.(g, b, side, kind);
  return total;
}
function eliminate(g: Game, u: Unit) {
  say(g, `${u.name} eliminated`); if (u.max >= 3 && !u.garrison && !u.fort) g.elimLarge.push(u.id); u.area = null; u.str = 0; dropReserve(g, u);
  if (u.chitId) chit(g, u.chitId).box = 'eliminated'; if (u.interdict) { chit(g, u.interdict).box = 'eliminated'; u.interdict = undefined; }
}
function stepLoss(g: Game, b: Battle, side: Side, key: string) {
  const c = g.chits.find((x) => x.id === key);
  if (c) { c.box = 'eliminated'; b.assets[side] = b.assets[side].filter((x) => x !== key); say(g, `${c.name} eliminated`); return; }
  const u = g.units.find((x) => x.id === key)!;
  if (!u.garrison && CUR.absorbLoss?.(g, b, side, u)) { b.unitHit[side] = true; return; }      // the volume takes the hit another way (a recovery marker)
  u.str -= 1;
  if (u.str <= 0 || u.garrison) eliminate(g, u); else say(g, `${u.name} loses a step`);
  if (!u.garrison) b.unitHit[side] = true;
}
/** 6.43 step losses still to place: `then` says what follows (the attacker's remaining hits, or the defender's, with its retreat option and kind of fire). */
export interface LossRun { side: Side; left: number; then: 'att' | 'def'; kind?: 'arty' | 'ground'; retreat?: boolean; h?: number; excess?: number }
/** Who may take the next step loss (6.43): everyone present takes one before anyone takes a second (across the battle's volleys), the first unit loss is the
 *  point unit's (battle assets may go before it), and the volume's limits. Sorted with the suggested pick first: assets, then the point unit, then the weakest.
 *  null: nothing is left to take it. */
function lossCands(g: Game, b: Battle, side: Side): string[] | null {
  fixPoint(g, b);
  const ps = lossPool(g, b, side); if (!ps.length) return null;
  const hit = new Set<string>(b.hit?.[side] ?? []);
  let cand = ps.filter((p) => !hit.has(p.key)); if (!cand.length) cand = ps;
  const pid = side === b.attacker ? b.attPoint : b.defPoint;
  if (!b.unitHit[side] && cand.some((p) => p.key === pid)) cand = cand.filter((p) => p.asset || p.key === pid);
  if (CUR.lossOk) { const ok = cand.filter((p) => CUR.lossOk!(g, b, side, p.key)); if (ok.length) cand = ok; }        // e.g. a flanking unit takes no hits while its point unit stands
  cand.sort((x, y) => +!x.asset - +!y.asset || +(x.key !== pid) - +(y.key !== pid) || x.str - y.str);
  return cand.map((p) => p.key);
}
const lossPool = (g: Game, b: Battle, side: Side) => [...b.assets[side].filter((id) => isBattleAsset(chit(g, id)) || !!CUR.lossAsset?.(g, b, side, id)).map((id) => ({ key: id, asset: true, str: 1 })),
  ...unitsIn(g, b.area, side).filter((u) => side !== b.attacker || !(u.disorder > 0 || u.fort)).map((u) => ({ key: u.id, asset: !!u.garrison, str: u.str }))];   // 6.2: disordered units take no part for the attacker
function takeLoss(g: Game, b: Battle, side: Side, key: string) {
  b.hit ??= {}; const hit = new Set<string>(b.hit[side] ?? []);
  if (lossPool(g, b, side).every((p) => hit.has(p.key))) hit.clear();                                // everyone has taken one: a new round of 6.43
  stepLoss(g, b, side, key); hit.add(key); b.hit[side] = [...hit];
}
/** Place the losses of `run`: automatically while only one block or asset may take the next one (or `auto`), otherwise the owner picks (stage 'loss'). */
function runLosses(g: Game, b: Battle, run: LossRun, auto = false) {
  while (run.left > 0) {
    const cand = lossCands(g, b, run.side);
    if (!cand) { run.excess = (run.excess ?? 0) + run.left; run.left = 0; break; }
    if (cand.length > 1 && !auto) { b.loss = run; b.stage = 'loss'; return; }
    takeLoss(g, b, run.side, cand[0]); run.left--;
  }
  b.loss = undefined;
  if (run.then === 'att') { b.pending = 0; return next(g, b); }
  afterDefLosses(g, b, run.kind!, !!run.retreat, run.h ?? 0, run.excess ?? 0);
}
/** The blocks and battle assets that may take the next step loss now (6.43), the suggested one first. */
export function lossOptions(g: Game, b: Battle): string[] { return b.stage === 'loss' && b.loss ? lossCands(g, b, b.loss.side) ?? [] : []; }
/** 6.43: the owner places one step loss. */
export function chooseLoss(g: Game, b: Battle, key: string) {
  if (b.stage !== 'loss' || !b.loss) throw new Error('no loss to place');
  if (!lossOptions(g, b).includes(key)) throw new Error('that block or asset cannot take this loss (6.43: everyone takes one before anyone takes a second; the first unit loss is the point unit\'s)');
  const run = b.loss; takeLoss(g, b, run.side, key); run.left--; runLosses(g, b, run);
}
/** The rest of the losses in the suggested order (assets first, then the point unit, then the weakest). */
export function autoLosses(g: Game, b: Battle) { if (b.stage !== 'loss' || !b.loss) throw new Error('no loss to place'); runLosses(g, b, b.loss, true); }
/** One automatic loss (the first hit on an attacker with no battle asset: always the point unit). */
function allocate(g: Game, b: Battle, side: Side, n: number) {
  for (let i = 0; i < n; i++) { const c = lossCands(g, b, side); if (!c) return n - i; takeLoss(g, b, side, c[0]); }
  return 0;
}
const allGone = (g: Game, b: Battle, side: Side) => !unitsIn(g, b.area, side).length && !b.assets[side].some((id) => isBattleAsset(chit(g, id)));
/** 18.4: the 150th Panzer Brigade's first battle, if it is in this one. */
const pz150In = (g: Game, b: Battle) => (g.opts.pz150 && !g.pz150Done ? g.units.find((u) => u.name === '150 Pz' && u.area === b.area && u.str > 0) : undefined);
/** 18.4: after artillery has fired on both sides, if the 150th survived, the American point unit checks morale with +2; failing, it is disordered (a defended roadblock is eliminated and an exploitation opportunity arises). */
function pz150Check(g: Game, b: Battle) {
  const pz = g.units.find((u) => u.id === b.pz150); b.pz150 = undefined;
  if (!pz || pz.area !== b.area || pz.str <= 0) return say(g, '150th Panzer Brigade did not survive the artillery fire: no effect (18.4)');
  const am = point(g, b, other(pz.side)); if (!am || am.area !== b.area) return;
  if (am.disorder > 0) return say(g, `150th Panzer Brigade: ${am.name} is already disordered, no effect (18.4)`);
  const { r, ok } = check(g, am, moraleSn(quality(am), false, am.unsupplied && !(g.opts.airborne && AIRBORNE.has(am.name))) + 2, '150th Panzer Brigade confusion (18.4)');
  b.rolls.push({ who: `${am.name}: morale +2 (18.4)`, sn: moraleSn(quality(am), false, am.unsupplied) + 2, dice: [r], hits: ok ? 1 : 0, kind: 'morale' });
  if (ok) return say(g, `150th Panzer Brigade: ${am.name} passes its morale check (rolled ${r}), no effect (18.4)`);
  if (am.id.startsWith('DR-') || am.heydte) { say(g, `150th Panzer Brigade: the defended roadblock fails its morale check (rolled ${r}) and is eliminated (18.4)`); eliminate(g, am); b.exploit = pz.side === b.attacker; }
  else { am.disorder = 1; say(g, `150th Panzer Brigade: ${am.name} fails its morale check (rolled ${r}) and is disordered (18.4)`); }
}
function next(g: Game, b: Battle) {
  fixPoint(g, b);
  if (!unitsIn(g, b.area, b.attacker).filter((u) => !u.garrison || !!CUR.battleAllowed?.(g, b.area)).length) return end(g, b, 'Attacker eliminated');   // Sicily 17.22: a flanking invasion attacks alone
  if (!fighters(g, b.area, b.attacker, true).length) { b.queue = []; return end(g, b, 'No attacker left in good order'); }   // 6.2: disordered units cannot carry the attack
  if (b.pz150 && (!b.queue.length || b.queue[0] === 'defFire' || b.queue[0] === 'offFire')) {
    pz150Check(g, b); const def = other(b.attacker);
    if (allGone(g, b, def)) { b.result = 'Defender eliminated'; b.queue = []; return end(g, b, b.result); }
  }
  const s = b.queue.shift(); if (!s) return end(g, b, b.result ?? 'Area remains contested');
  if (s === 'attArty' || s === 'defArty') { const side = s === 'attArty' ? b.attacker : other(b.attacker); if (!fireList(g, b, side, 'arty').length) return next(g, b); }
  b.stage = s; return;
}
/** 6.24, 5.22: may `side` read this block? Own blocks, face-up blocks, a block in an area where enemy blocks are face-up, and the Intelligence Gathering target. Chits are always face-up. */
/** Blocks that were face-up in a battle stand up again once their area is no longer contested. */
export function settleUp(g: Game) { for (const u of g.units) if (u.up != null && (u.up !== u.area || !contested(g, u.up))) u.up = undefined; }
export function visibleTo(g: Game, u: Unit, side: Side | 'spectator' | null): boolean {
  if (side === null || u.side === side || u.garrison || g.revealed === u.id || u.area == null) return true;
  if (side !== 'spectator' && CUR.seenBy?.(g, u, side)) return true;                                  // a volume's own reveal (Golan air reconnaissance, 16.31c)
  if (u.up === u.area && contested(g, u.area)) return true;                                           // face-up only while the area stays contested (the blocks stand up again when the enemy leaves)
  return g.units.some((x) => x.area === u.area && x.side !== u.side && x.up === u.area);
}
export function beginCombat(g: Game, b: Battle) {
  if (b.stage !== 'setup') throw new Error('already started');
  CUR.beforeBegin?.(g, b);
  for (const u of g.units) if (u.area === b.area && !u.garrison) u.up = b.area;                // 6.24 units are revealed once both point units are designated
  CUR.onBattle?.(g, b, 'begin'); fixPoint(g, b);
  if (!fighters(g, b.area, other(b.attacker), false).length) { b.result = 'Defender eliminated'; b.exploit = false; return end(g, b, b.result); }   // only ghosts stood there (Golan 15.7): removed, not eliminated by fire, so no exploitation (6.8)
  { const pz = pz150In(g, b); if (pz) { if (pz.side === b.attacker) b.attPoint = pz.id; else b.defPoint = pz.id; b.pz150 = pz.id; g.pz150Done = true; say(g, '150th Panzer Brigade, first battle: it is the point unit (18.4)'); } }
  b.defStart = unitsIn(g, b.area, other(b.attacker)).map((u) => u.id);                                // 18.7
  b.queue = ['attArty', 'defArty', 'defFire', 'offFire']; next(g, b);
}
/** Hot-seat shortcut stays beginCombat; online each side confirms its set-up and combat starts when both are ready. */
export function setReady(g: Game, b: Battle, side: Side, on = true) {
  if (b.stage !== 'setup') throw new Error('already started');
  if (!on) throw new Error('assets once committed stay committed (6.22, 6.23)');
  { const w = notYourStep(g, b, side); if (w) throw new Error(w); }
  const r = (b.ready ??= []);
  if (!r.includes(side)) r.push(side); else if (side === b.attacker && r.length === 2) b.attPointDone = true; else throw new Error('already done');
  if (b.attPointDone && !g.deferBegin) beginCombat(g, b);
}
/** Withdraw from a battle that has not rolled yet, returning every assigned asset. Not possible once a Special Action was spent. */
export function cancelBattle(g: Game) {
  const b = g.battle; if (!b) throw new Error('no battle'); if (b.stage !== 'setup') throw new Error('combat has begun');
  if (b.locked) throw new Error('a Special Action was spent; the battle cannot be withdrawn');
  if (b.ready?.includes(b.attacker)) throw new Error('the Attacker has committed his assets: the battle is fought (6.22)');
  for (const id of sidesOf(g).flatMap((s) => [...(b.assets[s] ?? []), ...airOf(b, s).map((a) => a.id)])) dropAsset(g, b, id);
  g.battle = null;
}
export const exploitSn = (g: Game, u: Unit) => CUR.moraleSn(g, u, 'exploit');
/** The Bulge's morale check: quality, disorder, supply (18.5: airborne units ignore the unsupplied modifier); a supply check always counts as unsupplied. */
const bulgeMoraleSn = (g: Game, u: Unit, why: 'exploit' | 'supply' | 'check') => moraleSn(quality(u), u.disorder > 0, (why === 'supply' || u.unsupplied) && !(g.opts.airborne && AIRBORNE.has(u.name)));
export function roll_step(g: Game, b: Battle) {
  const st = b.stage;
  if (st === 'loss') return autoLosses(g, b);                                                          // "roll on": the losses go in the suggested order
  if (st === 'exploit') {                                                                                // 6.8: each attacking armor-class unit rolls; a pass earns the exploitation marker
    for (const id of b.exploitIds ?? []) { const u = g.units.find((x) => x.id === id)!; if (u.area !== b.area) continue; const sn = exploitSn(g, u), r = roll(g), ok = succeeds(r, sn); if (ok) u.exploit = true; b.rolls.push({ who: u.name, sn, dice: [r], hits: ok ? 1 : 0, kind: 'morale' }); say(g, `${u.name} exploitation morale check: rolled ${r} (needs ${sn} or less) → ${ok ? 'exploitation marker' : 'failed'}`); }
    b.exploitIds = undefined; b.stage = 'done'; return;
  }
  if (st === 'attArty') { const h = doFire(g, b, b.attacker, 'arty'); return hitDefender(g, b, h, 'arty'); }
  if (st === 'defArty' || st === 'defFire') { const h = doFire(g, b, other(b.attacker), st === 'defArty' ? 'arty' : 'ground'); b.lossKind = st === 'defArty' ? 'arty' : 'ground'; return hitAttacker(g, b, h); }
  if (st === 'offFire') {
    const eng = engRemovesFw(g, b);                                                                    // 6.33: after artillery and defensive fire, before the attackers fire; the engineer does not fire
    if (eng) { g.fieldWorks = g.fieldWorks.filter((x) => x !== b.area); say(g, 'engineer removes the field works (6.33)'); }
    const h = doFire(g, b, b.attacker, 'ground', eng); return hitDefender(g, b, h, 'ground');
  }
  throw new Error('nothing to roll');
}
function hitAttacker(g: Game, b: Battle, h: number) {
  if (h > 0) {
    b.unitHit[b.attacker] = false;
    if (b.assets[b.attacker].some((id) => isBattleAsset(chit(g, id)))) { b.pending = h; b.stage = 'attFirst'; return; }                // 6.41a the attacker picks the point unit or one battle asset
    allocate(g, b, b.attacker, 1);
  }
  afterFirstHit(g, b, h - 1);
}
function afterFirstHit(g: Game, b: Battle, rest: number) {
  if (rest > 0 && unitsIn(g, b.area, b.attacker).some((u) => !u.garrison)) { b.pending = rest; b.stage = 'attChoice'; return; }
  next(g, b);
}
/** 6.41a: the first hit on the attacker falls on the point unit or on any one assigned battle asset, the player's choice. */
export function chooseFirstLoss(g: Game, b: Battle, key: string) {
  if (b.stage !== 'attFirst') throw new Error('no choice pending');
  const att = b.attacker; fixPoint(g, b);
  if (key !== b.attPoint && !b.assets[att].includes(key)) throw new Error('the first loss falls on the point unit or one battle asset');
  const h = b.pending; b.pending = 0; stepLoss(g, b, att, key); b.hit ??= {}; b.hit[att] = [...new Set([...(b.hit[att] ?? []), key])];
  afterFirstHit(g, b, h - 1);
}
export function attackerChoice(g: Game, b: Battle, abort: boolean) {
  if (b.stage !== 'attChoice') throw new Error('no choice pending');
  if (abort) {
    { const why = CUR.canAbort?.(g, b); if (why) throw new Error(why); }
    const us = unitsIn(g, b.area, b.attacker).filter((u) => !u.garrison);
    if (b.riverAssault) for (const u of us) { const from = u.from; if (from != null && neighbors(b.area).includes(from) && g.control[from] === b.attacker && !unitsIn(g, from, other(b.attacker)).length && blocks(g, from, b.attacker).length < stackMax(g, from) && (!CUR.retreatOk || CUR.retreatOk(g, u, b.area, from))) { u.area = from; CUR.onRetreat?.(g, u, b.area, from); } else if (from != null) stepLoss(g, b, b.attacker, u.id); }
    for (const u of us) if (u.area != null) u.disorder = 1;                                      // the ones that fell back are disordered too
    b.queue = []; return end(g, b, 'Attack aborted: attackers disordered' + (b.riverAssault ? ' and back across the river' : ''));
  }
  runLosses(g, b, { side: b.attacker, left: b.pending, then: 'att' });
}
function hitDefender(g: Game, b: Battle, h: number, kind: 'arty' | 'ground') {
  const def = other(b.attacker); { const p = point(g, b, def); if (p && p.area === b.area) b.lastDefPoint = { ...p }; }
  if (h > 0 && g.fieldWorks.includes(b.area) && (g.fwOwner[b.area] ?? def) === def) { g.fieldWorks = g.fieldWorks.filter((x) => x !== b.area); h--; say(g, 'field works absorb 1 hit'); }
  b.pending = h; b.pendingKind = kind; b.lossKind = kind;
  const real = fighters(g, b.area, def, false).filter((u) => !u.garrison);
  const canDis = kind === 'arty' && real.some((u) => u.disorder !== 1);
  const noRet = CUR.noRetreat ? unitsIn(g, b.area, def).filter((x) => CUR.noRetreat!(g, x)).length : 0;      // 16.21: the garrison is destroyed first, the retreat needs a hit to spare
  const canRet = kind === 'ground' && real.some((u) => !u.fort) && h > noRet;                      // strongpoints never retreat (Golan 15.6)
  if (h > 0 && (canDis || canRet)) { b.stage = 'defChoice'; return; }
  applyDef(g, b, h, kind, false);
}
export function defenderChoice(g: Game, b: Battle, use: boolean) {
  if (b.stage !== 'defChoice') throw new Error('no choice pending');
  const kind = b.pendingKind!, def = other(b.attacker); let h = b.pending;
  if (use && kind === 'arty') { for (const u of unitsIn(g, b.area, def)) if (!u.garrison && u.disorder === 0) u.disorder = 1; else if (!u.garrison && u.disorder === 2) u.disorder = 1; h--; say(g, 'defenders disordered to absorb 1 hit'); }
  applyDef(g, b, h, kind, use && kind === 'ground');
}
function applyDef(g: Game, b: Battle, h: number, kind: 'arty' | 'ground', retreat: boolean) {
  const def = other(b.attacker);
  if (retreat && CUR.noRetreat) for (const a of unitsIn(g, b.area, def).filter((x) => CUR.noRetreat!(g, x))) { say(g, `${a.name} cannot retreat: destroyed, counting as a hit (6.42c)`); eliminate(g, a); h = Math.max(0, h - 1); }   // 6.42c (2016), 16.21: first
  if (retreat) h = Math.max(0, h - 1);
  runLosses(g, b, { side: def, left: h, then: 'def', kind, retreat, h });
}
function afterDefLosses(g: Game, b: Battle, kind: 'arty' | 'ground', retreat: boolean, h: number, excess: number) {
  const def = other(b.attacker);
  b.pending = 0;
  if (retreat) { b.retreat = { side: def, queue: unitsIn(g, b.area, def).filter((x) => !x.garrison && !x.fort && !x.ghost).map((x) => x.id), moved: false, after: kind, h, excess }; return advanceRetreat(g, b); }
  finishDef(g, b, kind, false, excess);
}
function finishDef(g: Game, b: Battle, kind: 'arty' | 'ground', retreated: boolean, excess: number) {
  const def = other(b.attacker);
  if (allGone(g, b, def)) {
    b.result = retreated ? 'Defender retreated' : 'Defender eliminated';
    b.exploit = !retreated && (kind === 'arty' || excess > 0); b.unabsorbed = excess; b.byArty = !retreated && kind === 'arty';
    b.queue = b.queue.filter((s) => s === 'defArty');
  }
  next(g, b);
}
/** Where a retreating block may go (6.6, 2016): an adjoining, uncontested, friendly-controlled area with room (one unit or fewer); when every such area
 *  is full, onward through them to the nearest uncontested friendly area with room. None: the block takes a step loss instead. */
export function retreatOptions(g: Game, b: Battle): number[] {
  setPlayArea(g.inPlay);
  const r = b.retreat; if (!r) return [];
  const u = g.units.find((x) => x.id === r.queue[0]);                                        // the unit retreating now
  const room = (n: number) => (u ? roomFor(g, u, n) : blocks(g, n, r.side).length < stackMax(g, n));
  const opts = [...retreatPaths(g, b.area, r.side, u).keys()].filter(room);
  let out = u && CUR.retreatPrefer ? CUR.retreatPrefer(g, u, b.area, opts) : opts;
  if (!out.length && u && CUR.seaRetreat?.(g, u, b.area)) out = [SEA];                        // Sicily 14.28: to sea when nothing else is open
  return out;
}
/** A retreat destination that is not an area: the sea (Sicily's At Sea box, 14.28). */
export const SEA = -1;
/** The retreat routes from the battle area: each reachable destination and the way there (adjoining areas with room first; past full ones only when all are full). */
function retreatPaths(g: Game, from: number, side: Side, u: Unit | undefined, zoneOnly = !!(u && CUR.retreatZone)): Map<number, number[]> {
  const ok = (f: number, n: number) => g.control[n] === side && !unitsIn(g, n, other(side)).length && (!u || !CUR.retreatOk || CUR.retreatOk(g, u, f, n)) && (!u || !CUR.moveOk || CUR.moveOk(g, u, n)) && (!zoneOnly || CUR.retreatZone!(g, u!, n));
  const room = (n: number) => (u ? roomFor(g, u, n) : blocks(g, n, side).length < stackMax(g, n));
  const out = new Map<number, number[]>(), first = neighbors(from).filter((n) => ok(from, n));
  for (const n of first) if (room(n)) out.set(n, [from, n]);
  if (!out.size && zoneOnly && !first.some((n) => !room(n))) return retreatPaths(g, from, side, u, false);   // 14.43: nothing in the own zone, then the other paths
  if (out.size || !first.length) return out;
  let ring = first.map((n) => [from, n]); const seen = new Set([from, ...first]);
  while (ring.length && !out.size) {                                                          // breadth first: the nearest areas with room
    const next: number[][] = [];
    for (const p of ring) for (const n of neighbors(p[p.length - 1])) { if (seen.has(n) || !ok(p[p.length - 1], n)) continue; seen.add(n); const q = [...p, n]; if (room(n)) out.set(n, q); else next.push(q); }
    ring = next;
  }
  return !out.size && zoneOnly ? retreatPaths(g, from, side, u, false) : out;
}
/** 14.1: armor never crosses the restricted boundary (Schnee Eifel), not even to retreat. */
const bulgeRetreatOk = (_g: Game, u: Unit, from: number, to: number) => !(u.cls === 'armor' && connection(from, to)?.restricted);
function advanceRetreat(g: Game, b: Battle) {
  const r = b.retreat!;
  while (r.queue.length) {
    const u = g.units.find((x) => x.id === r.queue[0])!, opts = retreatOptions(g, b);
    if (!opts.length) { stepLoss(g, b, r.side, u.id); r.queue.shift(); continue; }
    if (opts.length === 1) { moveRetreat(g, b, u, opts[0]); r.queue.shift(); continue; }
    b.stage = 'retreat'; return;
  }
  b.retreat = undefined;
  if (r.after === 'sa' && unitsIn(g, b.area, r.side).length) { b.stage = 'setup'; say(g, `the units retreat; ${unitsIn(g, b.area, r.side).map((u) => u.name).join(', ')} stay and still fight`); return; }   // a garrison or defended roadblock cannot retreat: the battle goes on against it
  if (r.after === 'sa') { b.exploit = true; b.queue = []; return end(g, b, 'Defender retreated (Special Action): exploitation opportunity'); }
  finishDef(g, b, r.after, r.moved, r.excess);
}
function moveRetreat(g: Game, b: Battle, u: Unit, to: number) {
  if (u.area == null) return;
  if (to === SEA) { const from = u.area; if (b.retreat!.after !== 'sa') u.disorder = 1; b.retreat!.moved = true; u.area = null; u.box = 'at_sea'; dropReserve(g, u); CUR.onRetreat?.(g, u, from, SEA); updateControl(g, from); say(g, `${u.name} retreats to sea (14.28)`); return; }
  const path = retreatPaths(g, b.area, b.retreat!.side, u).get(to) ?? [u.area, to];               // past full areas when it must (6.6)
  if (b.retreat!.after !== 'sa') u.disorder = 1; b.retreat!.moved = true;                    // 8.24 a retreat before combat does not disorder
  for (let i = 1; i < path.length && u.area != null; i++) { const from = path[i - 1]; u.area = path[i]; CUR.onRetreat?.(g, u, from, path[i]); updateControl(g, from); updateControl(g, path[i]); }
  if (u.area != null) say(g, `${u.name} retreats to ${areas.get(u.area)!.name}${path.length > 2 ? ` (through ${path.slice(1, -1).map((a) => areas.get(a)!.name).join(', ')}, full)` : ''}`);
}
export function chooseRetreat(g: Game, b: Battle, to: number) {
  if (b.stage !== 'retreat' || !b.retreat) throw new Error('no retreat pending');
  if (!retreatOptions(g, b).includes(to)) throw new Error('cannot retreat there');
  moveRetreat(g, b, g.units.find((x) => x.id === b.retreat!.queue[0])!, to); b.retreat.queue.shift(); advanceRetreat(g, b);
}
/** 18.7 Overrunning Artillery: the defending area is vacated; the attacker rolls one die per defending artillery asset (rocket included).
 *  SN 1 if the defender retreated with a step surviving, 2 if its units and battle assets were destroyed, +1 per unabsorbed hit. Destroyed by
 *  attacking artillery: the attacking units roll their ground fire as if the defender were still there; its hits count as unabsorbed. */
function overrun(g: Game, b: Battle) {
  const def = other(b.attacker), arts = b.assets[def].map((id) => chit(g, id)).filter((c) => isArty(c) && c.box === 'map');
  if (!arts.length || unitsIn(g, b.area, def).length || !unitsIn(g, b.area, b.attacker).some((u) => !u.garrison)) return;
  const survived = (b.defStart ?? []).some((id) => { const u = g.units.find((x) => x.id === id); return !!u && u.str > 0 && u.area != null && u.area !== b.area; });
  let extra = survived ? 0 : (b.unabsorbed ?? 0);
  if (!survived && b.byArty && b.lastDefPoint) {
    let hits = 0; for (const f of fireList(g, b, b.attacker, 'ground', b.lastDefPoint)) { const dice = Array.from({ length: f.dice }, () => roll(g)); hits += dice.filter((d) => succeeds(d, f.sn)).length; }
    extra = hits; say(g, `overrunning artillery: the attackers' ground fire scores ${hits} unabsorbed hit(s) (18.7)`);
  }
  const sn = (survived ? 1 : 2) + extra;
  for (const c of arts) {
    const r = roll(g), ok = succeeds(r, sn);
    b.rolls.push({ who: `Overrun ${c.name} (18.7)`, sn, dice: [r], hits: ok ? 1 : 0, kind: 'morale' });
    if (ok) { c.box = 'eliminated'; b.assets[def] = b.assets[def].filter((x) => x !== c.id); }
    say(g, `overrunning artillery: ${c.name} ${ok ? 'is destroyed' : 'escapes'} (rolled ${r}, needs ${sn} or less, 18.7)`);
    b.result = `${b.result ?? ''}${b.result ? ' · ' : ''}${c.name} ${ok ? 'overrun and destroyed' : 'escapes the overrun'} (18.7)`;
  }
}
function end(g: Game, b: Battle, result: string) {
  b.result = result; b.stage = 'done';
  if (g.opts.overrun) overrun(g, b);
  b.lastDefPoint = undefined;                                                                          // a copy of a block: never left in the shared game
  for (const side of sidesOf(g)) for (const id of b.assets[side] ?? []) { const c = chit(g, id); if (c.box === 'map') c.box = 'used'; }
  for (const side of sidesOf(g)) for (const a of airOf(b, side)) chit(g, a.id).box = CUR.id === 'bulge' ? 'eliminated' : 'used';      // Bulge air missions are single-use; Golan air support recycles (16.31)
  CUR.onBattle?.(g, b, 'end');
  g.fought.push(b.area); for (const n of [b.area, ...neighbors(b.area)]) updateControl(g, n);
  say(g, `${areas.get(b.area)!.name}: ${result}`); g.battles = (g.battles ?? 0) + 1;
  const cand = b.exploit && !b.bt && !b.riverAssault ? unitsIn(g, b.area, b.attacker).filter((x) => x.cls === 'armor' && !x.garrison && !x.unsupplied).map((x) => x.id) : [];      // 6.8: never from river assaults or Breakthrough combat; never an out-of-supply unit (2016)
  if (cand.length) { b.stage = 'exploit'; b.exploitIds = cand; say(g, `exploitation opportunity: ${b.attacker} may roll a morale check for ${cand.length} armor-class unit(s) (6.8)`); }
}
/** 6.8: the attacker may decline the exploitation opportunity (and keep the blocks hidden). */
export function declineExploit(g: Game, b: Battle) { if (b.stage !== 'exploit') throw new Error('no exploitation pending'); b.exploitIds = undefined; b.stage = 'done'; say(g, `${b.attacker} declines the exploitation opportunity`); }
export function closeBattle(g: Game) { if (g.battle?.stage !== 'done') throw new Error('battle not finished'); g.battle = null; settleUp(g); }
export function defenderRetreatSA(g: Game, b: Battle, chitId?: string) {
  if (b.stage !== 'setup' || (!b.defSA && attackerBegun(b))) throw new Error('only as the Defender\'s first decision, before the Attacker assigns assets (6.21)'); const def = other(b.attacker);
  const us = unitsIn(g, b.area, def).filter((u) => !u.garrison && !u.fort && !u.ghost); if (!us.length) throw new Error('only units retreat: garrisons, defended roadblocks and strongpoints stay (16.21, 4.35, 15.6)');
  if (us.some((u) => u.unsupplied)) throw new Error('out-of-supply units may not be affected by Special Actions (9.34d)');
  spendSA(g, def, us.map((x) => x.ech!), 'retreat before combat', chitId, b.area); b.defSA = false;
  for (const id of [...b.assets[def], ...airOf(b, def).map((a) => a.id)]) dropAsset(g, b, id);               // assets already assigned go back to the Available Box
  b.locked = true; us.forEach((x) => clearInterdict(g, x));
  b.retreat = { side: def, queue: us.map((u) => u.id), moved: false, after: 'sa', h: 0, excess: 0 }; advanceRetreat(g, b);
}
export function defenderReinforceSA(g: Game, b: Battle, unitId: string, chitId?: string) {
  if (b.stage !== 'setup' || (!b.defSA && attackerBegun(b))) throw new Error('only as the Defender\'s first decision, before the Attacker assigns assets (6.21)'); const def = other(b.attacker), u = g.units.find((x) => x.id === unitId)!;
  if (unitsIn(g, b.area, def).some((x) => x.id.startsWith('DR-') || x.heydte) || (!CUR.reinforceOk && unitsIn(g, b.area, def).every((x) => x.garrison))) throw new Error('a battle of standing assets alone may not be reinforced (4.35)');
  if ((u.cls === 'armor' && connection(u.area!, b.area)?.restricted) || (CUR.moveOk && !CUR.moveOk(g, u, b.area))) throw new Error('that unit may not cross into the battle area (14.1, 14.43)');
  if (u.side !== def || u.area == null || !neighbors(b.area).includes(u.area) || contested(g, u.area) || u.disorder || u.unsupplied || u.garrison || u.fort || u.ghost || !roomFor(g, u, b.area)) throw new Error('not a legal reinforcement');
  if (CUR.reinforceOk && !CUR.reinforceOk(g, b, u)) throw new Error('not a legal reinforcement here (8.23)');
  spendSA(g, def, u.ech, 'reinforce a battle', chitId, b.area); b.defSA = false; b.locked = true; b.reinforced = u.id; clearInterdict(g, u); const from = u.area; u.area = b.area; u.from = from; updateControl(g, from); say(g, `${u.name} reinforces ${areas.get(b.area)!.name}`);
}
/** 18.3: Peiper, exploiting in a Breakthrough Movement Phase on or before turn 3, may move with its full allowance once per game. */
export const peiperCan = (g: Game, u: Unit) => !!g.opts.peiper && !g.peiperUsed && g.phase === 'btMove' && g.turn <= 3 && u.name === 'Peiper' && u.exploit && !u.moved && u.area != null && u.side === g.phasing;
export function setPeiperFull(g: Game, unitId: string, on: boolean) {
  const u = g.units.find((x) => x.id === unitId)!; if (on && !peiperCan(g, u)) throw new Error('KG Peiper (18.3): only once, exploiting in a Breakthrough Movement Phase on or before turn 3'); u.peiperFull = on || undefined;
}
export function activateBreakthrough(g: Game, unitId: string, chitId?: string) {
  const u = g.units.find((x) => x.id === unitId)!;
  if (g.phase !== 'btMove' || u.side !== g.phasing || u.cls !== 'armor' || u.unsupplied || u.disorder || u.moved || u.exploit || u.area == null) throw new Error('needs a supplied armor unit in good order');
  spendSA(g, u.side, u.ech, 'breakthrough movement', chitId, u.area!); clearInterdict(g, u); u.exploit = true;
}
export function mustFight(g: Game) {
  const bt = g.phase === 'btCombat'; if (g.phase !== 'combat' && !bt) return [];
  return [...new Set([...newlyContested(g), ...(CUR.mustFight?.(g) ?? [])])].filter((a) => !g.fought.includes(a) && fighters(g, a, g.phasing, true).some((u) => !u.garrison));
}

/* ================= phase flow ================= */
function retreatExcess(g: Game) {
  for (const side of sidesOf(g)) for (const a of areas.keys()) {
    const us = blocks(g, a, side).filter((u) => !u.fort && !u.ghost); while (us.length > stackMax(g, a)) {
      const u = us.pop()!, to = [...retreatPaths(g, a, side, u).keys()][0];                           // 6.6 (2016): past full areas to the nearest one with room
      if (to == null) { u.str = 0; eliminate(g, u); } else { u.area = to; u.disorder = 1; CUR.onRetreat?.(g, u, a, to); updateControl(g, to); say(g, `${u.name} retreats from overstacking to ${areas.get(to)!.name}`); }
    }
  }
}
function placeRiverAssaults(g: Game) {
  for (const [a, list] of Object.entries(g.entered)) {
    const area = +a, att = blocks(g, area, g.phasing);
    const isAssault = CUR.assault ? CUR.assault(g, area, list) : att.every((u) => list.some((e) => e.id === u.id && e.river)) && list.some((e) => e.blown);
    if (contested(g, area) && !g.contestedAtMoveStart.includes(area) && att.length && isAssault && !g.riverAssault.includes(area) && (CUR.id !== 'bulge' || g.riverAssault.length < 4)) {      // The Bulge: 4 markers in the counter mix
 g.riverAssault.push(area); say(g, `river assault in ${areas.get(area)!.name}`); }
  }
  g.entered = {}; g.riverCross = []; g.blowTried = [];
}
/** Who has a supply status: units, plus The Bulge's garrison and task force assets (16.21, 16.22: eliminated by a failed unsupplied morale check). */
const hasSupply = (x: Unit) => !x.garrison || (CUR.id === 'bulge' && !x.id.startsWith('DR-') && !x.heydte) || (CUR.id === 'golan73' && x.id.startsWith('G-'));   // Golan 16.24: garrisons too (raids and Lt. Zvika are always supplied)
function supplyPhase(g: Game) {
  CUR.onPhase?.(g, 'supply', 'start');
  for (const a of areas.keys()) updateControl(g, a);
  for (const u of g.units.filter((x) => x.area != null && hasSupply(x))) u.unsupplied = !(CUR.alwaysSupplied?.(g, u) || (CUR.unitSupply ? CUR.unitSupply(g, u) : inSupply(g, u.side, u.area!)));
  for (const u of g.units.filter((x) => x.area != null && x.fort)) u.unsupplied = false;                                   // strongpoints are always in supply (Golan 15.6)
  for (const u of g.units.filter((x) => x.area != null && !x.unsupplied && x.disorder)) if (!CUR.recoverOk || CUR.recoverOk(g, u)) u.disorder = u.disorder === 2 ? 0 : 2;
  g.riverAssault = [];
  if (!g.opts.fwMaintain) g.fieldWorks = g.fieldWorks.filter((a) => !contested(g, a));
  else for (const a of g.fieldWorks.filter((x) => contested(g, x) && (g.fwOwner[x] ?? g.control[x]) === g.phasing)) {        // 18.8: in the owner's own Supply Phase, one unit (the best: the player's natural choice) checks morale
    const us = unitsIn(g, a, g.phasing).filter((u) => !u.garrison); if (!us.length) continue;
    const sn = (u: Unit) => moraleSn(quality(u), u.disorder > 0, u.unsupplied && !(g.opts.airborne && AIRBORNE.has(u.name)));
    const u = [...us].sort((x, y) => sn(y) - sn(x))[0], { r, ok } = check(g, u, sn(u), `Maintaining field works (${CUR.id === 'golan73' ? '18.1' : CUR.id === 'sicily' ? '18.4' : '18.8'})`);
    if (!ok) g.fieldWorks = g.fieldWorks.filter((x) => x !== a);
    say(g, `field works in ${areas.get(a)!.name}: ${u.name} rolls ${r} → ${ok ? 'maintained' : 'removed'} (${CUR.id === 'golan73' ? '18.1' : CUR.id === 'sicily' ? '18.4' : '18.8'})`);
  }
  g.roadblocks = {};                                                                                   // 4.34
  for (const u of g.units.filter((x) => x.id.startsWith('DR-') && x.area != null)) { chit(g, u.chitId!).box = 'used'; u.area = null; say(g, `${u.name} survives and returns to the Used Box`); }   // 4.35
  for (const a of areas.keys()) updateControl(g, a);
  CUR.onPhase?.(g, 'supply', 'mid');
  g.units.forEach((u) => { u.exploit = false; u.adjOnly = false; if (u.side === other(g.phasing)) dropReserve(g, u); });
  g.supplyPending = true;                                                                              // the player rolls the checks (rollSupply); endPhase rolls them if nobody did
}
/** 9.4 the units of the Phasing Player that must roll an out-of-supply morale check now, with the number each needs. */
/** Sicily 16.34: an Air Supply mission spares the units of its area the morale check (the marker stays). */
const airSupplied = (g: Game, x: Unit) => airSup(g).some((s) => s.area === x.area && s.side === x.side);
/** Units events, Special Actions, staff and engineers may not help: unsupplied, or kept supplied only by an Air Supply mission (9.34d, 17.21). */
const helpless = (g: Game, u: Unit) => u.unsupplied || airSupplied(g, u);
export function supplyChecks(g: Game) {
  return g.units.filter((x) => x.area != null && x.side === g.phasing && x.unsupplied && hasSupply(x) && !x.fort && !airSupplied(g, x)).map((u) => ({ unit: u, sn: CUR.moraleSn(g, u, 'supply'), rounds: CUR.id === 'bulge' && g.turn >= 6 ? 2 : 1 }));
}
export function rollSupply(g: Game) {
  if (!g.supplyPending) throw new Error('no supply checks pending'); g.supplyPending = false;
  const rounds = CUR.id === 'bulge' && g.turn >= 6 ? 2 : 1;                                           // 14.93 (The Bulge)
  for (const u of g.units.filter((x) => x.area != null && x.side === g.phasing && x.unsupplied && hasSupply(x) && !x.fort && !airSupplied(g, x))) for (let i = 0; i < rounds && u.area != null; i++) {
    const q = quality(u), { r, ok } = check(g, u, CUR.moraleSn(g, u, 'supply'), 'Out of supply morale check (9.4)');
    if (ok) continue;
    if (u.garrison) { eliminate(g, u); say(g, `${u.name} unsupplied, morale failed (${r}): eliminated (${CUR.id === 'golan73' ? '16.24' : '16.21'})`); continue; }
    if (!u.disorder) { u.disorder = 1; say(g, `${u.name} unsupplied, morale failed (${r}): disordered`); }
    else if ((q === 'veteran' && r === 10) || (q === 'green' && r >= 8)) { eliminate(g, u); say(g, `${u.name} surrenders (${r})`); }
    else { u.str -= 1; if (u.str <= 0) eliminate(g, u); say(g, `${u.name} unsupplied and disordered, morale failed (${r}): step loss`); }
  }
  for (const a of areas.keys()) updateControl(g, a);                                                   // eliminated units leave areas behind
  supplyCleanup(g);
}
function supplyCleanup(g: Game) { CUR.onPhase?.(g, 'supply', 'end'); }
/** The Bulge's Supply Phase extras: the Air Supply mission expires (17.2), field works may be maintained (18.8), pooled assets and interdiction end (14.62b, 17.2), boundary-crossing leave ends, and von der Heydte checks supply (16.11). */
function bulgeSupplyHook(g: Game, phase: string, when: string) {
  if (phase === 'admin' && when === 'start') { g.greifTried = []; return; }
  if (phase !== 'supply') return;
  if (when === 'start') { const stamp = g.turn * 2 + (g.phasing === 'german' ? 0 : 1); for (const s of (g.airSupplies ?? []).filter((x) => x.stamp < stamp)) chit(g, s.id).box = 'eliminated'; g.airSupplies = (g.airSupplies ?? []).filter((x) => x.stamp >= stamp); if (g.airSupply && g.airSupply.stamp < stamp) { chit(g, g.airSupply.id).box = 'eliminated'; g.airSupply = null; } }
  if (when === 'mid') { g.pooled = null; for (const [, id] of Object.entries(g.interdicted)) chit(g, id).box = 'eliminated'; g.interdicted = {}; g.units.forEach((x) => { if (x.side === g.phasing) x.bcross = false; }); }
  if (when === 'end') for (const h of g.units.filter((x) => x.heydte && x.area != null && g.turn >= 4 && x.side === g.phasing)) if (!inSupply(g, 'german', h.area!)) { const { r, ok } = check(g, h, moraleSn('veteran', false, true), 'von der Heydte out of supply (16.11)'); if (!ok) { say(g, `von der Heydte out of supply, morale failed (${r}): eliminated`); eliminate(g, h); } }
}
export function setDone(g: Game, side: Side, on = true) { const d = (g.done ?? []).filter((x) => x !== side); if (on) d.push(side); g.done = d; }
export function endPhase(g: Game) {
  useGame(g.game ?? 'bulge'); setPlayArea(g.inPlay);
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
  const ph = g.phase; if (ph !== 'supply') CUR.onPhase?.(g, ph, 'end');                        // supply's end ran in rollSupply
  if (ph === 'deploy' && CUR.afterDeploy?.(g)) { say(g, 'phase start'); return; }
  if (ph === 'deploy') { g.phase = 'movement'; g.phasing = sidesOf(g)[0]; g.units.forEach((u) => { u.moved = false; u.spent = 0; }); g.contestedAtMoveStart = contestedAreas(g); g.stratMoves = 0; CUR.onPhase?.(g, 'movement', 'start'); say(g, 'phase start'); return; }
  g.fieldWorks = g.fieldWorks.filter((a) => { const o = g.fwOwner[a]; return o ? blocks(g, a, o).length > 0 : unitsIn(g, a).some((u) => !u.garrison); });   // 5.23: a unit, not a standing asset   // 5.23 gone when no friendly unit is left in the area
  for (const a of Object.keys(g.fwOwner).map(Number)) if (!g.fieldWorks.includes(a)) delete g.fwOwner[a];
  if (ph === 'reinforcement') for (const id of [...g.pendingArrivals]) autoArrive(g, id);
  if (ph === 'admin') g.revealed = null;
  for (const [s, k] of g.markersHeld ?? []) g.markers[s][k]++; g.markersHeld = [];                  // 17.11: a reserve marker lost to a failed Greif check comes back after the phase                                                      // 8.32 revealed only until the end of the Admin Phase
  if (ph === 'movement' || ph === 'btMove') placeRiverAssaults(g);
  if (ph === 'movement' || ph === 'strategic' || ph === 'combat' || ph === 'reaction' || ph === 'btMove' || ph === 'btCombat') retreatExcess(g);
  if (ph === 'supply') {
    g.units.forEach((u) => { u.exploit = false; });
    const [p1, p2] = sidesOf(g), N = CUR.sideName;
    if (g.phasing === p1) g.phasing = p2;
    else {
      const v = victory(g), sd = g.inPlay ? null : (g.track ?? CUR.track)[g.turn - 1].sd;
      (g.vpHist ??= [])[g.turn - 1] = CUR.vpHist ? CUR.vpHist(g, v) : v.net;
      if (g.opts.scenario === 'cold') say(g, `Victory check: the Germans control ${coldAreas(g)} Zone 6 areas (11+ German victory, 10 draw, 9 or less Allied victory)`);
      else say(g, `Victory check: ${N[p1]} ${v[p1]}, ${N[p2]} ${v[p2]}, net ${v.net > 0 ? N[p1] + ' +' + v.net : v.net < 0 ? N[p2] + ' +' + -v.net : '0'}`);
      if (sd && g.turn < g.lastTurn && ((v.net > 0 && v.net >= sd[0]) || (v.net < 0 && -v.net >= sd[1]))) { g.over = `Sudden death victory: ${v.net > 0 ? N[p1] : N[p2]} (net ${Math.abs(v.net)})`; return; }
      if (g.turn >= g.lastTurn) { g.over = CUR.finalResult(g, v.net); return; }
      g.turn++; g.phasing = p1; g.phase = 'reinforcement'; reinforcementPhase(g); g.units.forEach((u) => { u.moved = false; u.spent = 0; }); CUR.onPhase?.(g, 'reinforcement', 'start'); say(g, 'reinforcement phase'); return;
    }
    g.phase = 'admin'; CUR.onPhase?.(g, 'admin', 'start'); drawFor(g); return;
  }
  const order: Phase[] = ['reinforcement', 'admin', 'movement', 'strategic', 'combat', 'reaction', 'btMove', 'btCombat', 'supply'];
  g.phase = order[order.indexOf(ph) + 1];
  if (g.phase === 'admin') { CUR.onPhase?.(g, 'admin', 'start'); drawFor(g); }
  if (g.phase === 'movement') { g.units.forEach((u) => { u.moved = false; u.spent = 0; }); g.contestedAtMoveStart = contestedAreas(g); g.stratMoves = 0; }
  if (g.phase === 'strategic') g.units.forEach((u) => { u.moved = false; u.spent = 0; });
  if (g.phase === 'combat') g.fought = [];
  if (g.phase === 'reaction' || g.phase === 'btMove') { g.units.forEach((u) => { u.moved = false; u.spent = 0; }); g.riverCross = []; g.blowTried = []; if (g.phase === 'btMove') g.contestedAtMoveStart = contestedAreas(g); }   // 5.35c: per phase
  if (g.phase === 'btCombat') g.fought = [];
  if (g.phase === 'supply') supplyPhase(g); else CUR.onPhase?.(g, g.phase, 'start');
  say(g, 'phase start');
}
function drawFor(g: Game) {
  const [p1, p2] = sidesOf(g), i = g.phasing === p1 ? 0 : 1, t = (g.track ?? CUR.track)[g.turn - 1];
  const x1 = CUR.extraDraws?.(g, p1) ?? 0, x2 = CUR.extraDraws?.(g, p2) ?? 0;
  drawChits(g, p1, t.ge[i] + x1); drawChits(g, p2, t.al[i] + x2);
  say(g, `Admin draws: ${CUR.sideName[p1]} ${t.ge[i] + x1}, ${CUR.sideName[p2]} ${t.al[i] + x2}`);
  CUR.afterDraw?.(g);
}
/** The Bulge's scenario results: the Introductory and Cold Shoulder sheets, else the Tournament or Campaign table. */
const bulgeFinal = (g: Game, net: number) => (g.opts.scenario === 'intro' ? introResult(g) : g.opts.scenario === 'cold' ? coldResult(g) : finalResult(g, net));
/** 24.37: uncontested control of Bastogne wins outright; otherwise strength points in Bastogne, the German losing 2 per key area he does not control. */
export function introResult(g: Game) {
  const b = 47, c = contested(g, b);
  if (!c && g.control[b]) return `${g.control[b] === 'german' ? 'German' : 'Allied'} Decisive Victory (uncontested Bastogne)`;           // control decides, even with nobody left in the town
  const pts = (s: Side) => unitsIn(g, b, s).filter((u) => !u.garrison).reduce((t, u) => t + u.str, 0);
  const ge = pts('german') - 2 * [39, 36, 48, 63, 64].filter((a) => g.control[a] !== 'german').length, al = pts('allied');
  return `${ge > al ? 'German' : 'Allied'} Marginal Victory (German ${ge}, Allied ${al})`;
}
/** P.7 Cold Shoulder: German-controlled Zone 6 areas at the end of turn 9. */
export function coldResult(g: Game) { const n = coldAreas(g); return `${n >= 11 ? 'German Victory' : n === 10 ? 'Draw' : 'Allied Victory'} (${n} Zone 6 areas German)`; }
/** The scenario's victory table: [condition, result]; the end of the game picks the matching row. */
export function victoryTable(g: Game): [string, string][] {
  if (g.opts.scenario === 'campaign') return [['4+ German VP', 'German Operational Victory'], ['1–3 German VP', 'German Marginal Victory'], ['0', 'Draw'], ['1–3 Allied VP', 'Allied Marginal Victory'], ['4+ Allied VP', 'Allied Operational Victory']];
  if (g.opts.scenario === 'cold') return [['11+ Zone 6 areas German', 'German Victory'], ['10 areas', 'Draw'], ['9 or less areas', 'Allied Victory']];
  if (g.opts.scenario === 'intro') return [['Uncontested Bastogne', 'Decisive Victory'], ['More strength in Bastogne (Germans −2 per key area not held; tie: Allies)', 'Marginal Victory']];
  return [['4+ German VP', 'German Operational Victory'], ['2–3 German VP', 'German Marginal Victory'], ['0–1 German VP', 'Allied Marginal Victory'], ['1+ Allied VP', 'Allied Operational Victory']];
}
function finalResult(g: Game, net: number) {
  if (g.opts.scenario === 'campaign') return net >= 4 ? 'German Operational Victory' : net >= 1 ? 'German Marginal Victory' : net === 0 ? 'Draw' : net >= -3 ? 'Allied Marginal Victory' : 'Allied Operational Victory';
  return net >= 4 ? 'German Operational Victory' : net >= 2 ? 'German Marginal Victory' : net >= 0 ? 'Allied Marginal Victory' : 'Allied Operational Victory';
}

/* ================= M3: roadblocks, staff functions, air missions, reroute ================= */
const vacantSupplied = (g: Game, side: Side, a: number) => (!g.inPlay || g.inPlay.includes(a)) && supplied(g, side, a) && !unitsIn(g, a).length && areas.get(a)!.tdn >= 1;
/** 4.34 / 4.35: a roadblock marker, or the engineer itself as a defended roadblock. */
export function roadblock(g: Game, id: string, area: number, defended: boolean) {
  needAdmin(g); const c = chit(g, id);
  if (c.kind !== 'engineer' || c.box !== 'available' || !assetZoneOk(g, c, area) || !vacantSupplied(g, c.side, area) || g.roadblocks[area]) throw new Error('needs a supplied, friendly, vacant area with a Terrain Difficulty Number of 1 or more');
  if (defended) {
    g.units = g.units.filter((x) => x.id !== `DR-${id}`);                                            // the engineer's earlier roadblock (spent, area null) must not share the id
    g.units.push({ id: `DR-${id}`, name: `${c.name} (defended roadblock)`, side: c.side, cls: 'infantry', q: [c.q ?? 'green'], max: 1, str: 1, area, garrison: true, disorder: 0, unsupplied: false, moved: true, reserve: null, exploit: false, ech: c.ech, chitId: id });
    c.box = 'map';
  } else { g.roadblocks[area] = c.side; c.box = 'used'; }
  say(g, `${c.name} makes a ${defended ? 'defended ' : ''}roadblock in ${areas.get(area)!.name}`, c.side);
}
export function roadblockAreas(g: Game, side: Side) { return [...areas.keys()].filter((a) => vacantSupplied(g, side, a) && !g.roadblocks[a]); }
const staff = (g: Game, id: string) => { needAdmin(g); const c = chit(g, id); if (c.kind !== 'command_staff' || c.box !== 'available') throw new Error('command staff not available'); return c; };
/** 14.62a (Germans only) */
export function staffBoundary(g: Game, id: string, unitId: string) {
  const c = staff(g, id), u = g.units.find((x) => x.id === unitId)!;
  if (c.side !== 'german' || u.side !== 'german' || u.area == null || u.garrison || ARMY(u) == null) throw new Error('needs a German unit of an army');
  u.bcross = true; c.box = 'used'; say(g, `Command staff: ${u.name} may leave its army zone for free`, c.side);
}
/** 14.62b (Americans only) */
export function staffPool(g: Game, id: string, area: number) {
  const c = staff(g, id);
  if (c.side !== 'allied' || !areas.has(area)) throw new Error('Americans only');
  g.pooled = area; c.box = 'used'; say(g, `Command staff: assets pooled for the battle in ${areas.get(area)!.name}`, c.side);
}
/** 8.32 */
export function staffIntel(g: Game, id: string, unitId: string) {
  const c = staff(g, id), u = g.units.find((x) => x.id === unitId)!;
  if (u.side === c.side || u.area == null || u.garrison) throw new Error('choose an enemy block on the map');
  g.revealed = u.id; c.box = 'used'; say(g, `Intelligence: the enemy block in ${areas.get(u.area)!.name} is revealed until the end of the Admin Phase (8.32)`, c.side);      // online the player only holds a stand-in: its owner publishes the real details
}
/** 17.2 Interdiction Mission (Allied air mission, Admin Phase). */
export function playInterdiction(g: Game, id: string, area: number) {
  needAdmin(g); const c = chit(g, id);
  if (c.kind !== 'air_mission' || c.box !== 'available' || !areas.has(area) || g.interdicted[area]) throw new Error('needs an Air Mission in the Available Box and a free area');
  g.interdicted[area] = id; c.box = 'map'; say(g, `Interdiction mission over ${areas.get(area)!.name}`, c.side);
}
/** 17.2 Air Supply Mission: one unsupplied area, played during a Supply Phase (here: the step before it runs). */
/** The Air Supply missions in force: The Bulge keeps a list (one area each, 17.21), Sicily one at a time (16.34). */
export const airSup = (g: Game) => [...(g.airSupplies ?? []), ...(g.airSupply ? [g.airSupply] : [])];
export function airSupplyAreas(g: Game, side: Side) { return [...new Set(g.units.filter((u) => u.side === side && u.area != null && (!u.garrison || /^(G|TF-)/.test(u.id)) && !inSupply(g, side, u.area)).map((u) => u.area!))].filter((a) => !airSup(g).some((s) => s.area === a && s.side === side)); }   // 17.21: garrisons and Task Forces too
export function playAirSupply(g: Game, id: string, area: number) {
  const c = chit(g, id);
  if (g.phase !== 'supply' || g.battle || c.kind !== 'air_mission' || c.box !== 'available' || !airSupplyAreas(g, c.side).includes(area)) throw new Error('needs an Air Mission, the end of the turn, and an unsupplied area');
  (g.airSupplies ??= []).push({ area, side: c.side, id, stamp: g.turn * 2 + (g.phasing === 'german' ? 0 : 1) }); c.box = 'map'; for (const u of unitsIn(g, area, c.side)) { if (u.unsupplied && u.disorder && (!CUR.recoverOk || CUR.recoverOk(g, u))) u.disorder = u.disorder === 2 ? 0 : 2; u.unsupplied = false; }   // 9.35: supplied, so the markers adjust
  say(g, `Air Supply mission over ${areas.get(area)!.name}`, c.side);
}
/** 8.27 Reroute a reinforcing unit (Reinforcement Phase, one Special Action). */
export function rerouteOptions(g: Game, unitId: string): number[] {
  const u = g.units.find((x) => x.id === unitId); if (!u || CUR.noReroute || g.phase !== 'reinforcement' || !g.arrived.includes(u.id) || u.area == null || !saAvailable(g, u.side, u.ech).length) return [];
  return [...new Set(appropriateAreas(u, g))].filter((a) => a !== u.area && (g.control[a] === u.side || !unitsIn(g, a).length) && roomFor(g, u, a) && !unitsIn(g, a, other(u.side)).length);
}
export function reroute(g: Game, unitId: string, area: number, chitId?: string) {
  if (!rerouteOptions(g, unitId).includes(area)) throw new Error('not a legal entry area');
  const u = g.units.find((x) => x.id === unitId)!, from = u.area!; spendSA(g, u.side, u.ech, 'reroute a reinforcement', chitId);
  u.area = area; g.control[area] = u.side; updateControl(g, from); say(g, `${u.name} rerouted to ${areas.get(area)!.name}`, u.side);
}

/* ================= arrivals (4.1c) ================= */
const listedEntries = (u: Unit) => (u.entry ?? []).map((l) => (l.startsWith('#') ? +l.slice(1) : CUR.entries[l]?.area)).filter(Boolean) as number[];
const stackFree = (g: Game, u: Unit, a: number) => CUR.id === 'bulge' && g.turn === 4 && u.side === 'german' && a === ENTRY.Z.area;                // 15.3
const entryOpen = (g: Game, u: Unit, a: number) => (!g.inPlay || g.inPlay.includes(a)) && (g.control[a] === u.side || !unitsIn(g, a).length) && (roomFor(g, u, a) || stackFree(g, u, a)) && !unitsIn(g, a, other(u.side)).length;
/** Entry areas a block that has not arrived yet may be placed in. Areas outside its listed ones cost a Special Action (8.27). */
export function arrivalOptions(g: Game, id: string): { area: number; sa: boolean }[] {
  const u = g.units.find((x) => x.id === id); if (!u || !g.pendingArrivals.includes(id)) return [];
  const own = listedEntries(u).filter((a) => entryOpen(g, u, a)), sa = saAvailable(g, u.side, u.ech).length > 0;
  const rest = (u.delayed || sa) ? [...new Set(appropriateAreas(u, g))].filter((a) => !own.includes(a) && entryOpen(g, u, a)) : [];   // 4.1c a delayed unit takes the nearest allowed area, otherwise it costs a Special Action
  return [...own.map((area) => ({ area, sa: false })), ...rest.map((area) => ({ area, sa: !u.delayed }))];
}
export function placeArrival(g: Game, id: string, area: number, chitId?: string) {
  const opt = arrivalOptions(g, id).find((o) => o.area === area); if (!opt) throw new Error('not a legal entry area');
  const u = g.units.find((x) => x.id === id)!; if (opt.sa) spendSA(g, u.side, u.ech, 'reroute a reinforcement', chitId);
  u.area = area; g.control[area] = u.side; g.arrived.push(id); g.pendingArrivals = g.pendingArrivals.filter((x) => x !== id); say(g, `${u.name} arrives in ${areas.get(area)!.name}`, u.side);
}
function autoArrive(g: Game, id: string) {
  const u = g.units.find((x) => x.id === id)!, opts = listedEntries(u), to = opts.find((a) => g.control[a] === u.side && (roomFor(g, u, a) || stackFree(g, u, a))) ?? opts.find((a) => !unitsIn(g, a).length);
  g.pendingArrivals = g.pendingArrivals.filter((x) => x !== id);
  if (to == null) { u.arrival = g.turn + 1; u.delayed = true; say(g, `${u.name} delayed one turn (entry blocked)`); return; }
  u.area = to; g.control[to] = u.side; g.arrived.push(id); say(g, `${u.name} arrives in ${areas.get(to)!.name}`, u.side);
}

/** Test hooks for rules that have no public entry point, and the helpers a volume module builds its rules on. */
export const updateControlForTest = updateControl;
export const allocateForTest = allocate;
export { updateControl, dropReserve, eliminate, needAdmin, supplied, fighters, roll as rollDie, check as moraleCheck };

/** The point unit a side designates for a battle (6.24), and the engineer's option to remove field works instead of firing (6.33): plain state changes, so they can travel as actions. */
export function setPoint(g: Game, b: Battle, side: Side, unitId: string) {
  if (b.stage !== 'setup') throw new Error('already started'); const u = g.units.find((x) => x.id === unitId);
  { const w = notYourStep(g, b, side) ?? (side === b.attacker && !b.ready?.includes(other(b.attacker)) ? 'the Defender designates his point unit first (6.24)' : null); if (w) throw new Error(w); }
  if (!u || u.side !== side || u.area !== b.area || u.garrison || u.ghost) throw new Error('not a legal point unit');
  if (side === b.attacker && u.disorder) throw new Error('a disordered unit cannot be the attacking point unit');
  if (side !== b.attacker && unitId === b.reinforced && g.units.some((x) => x.id === b.defPoint && x.area === b.area)) throw new Error('the reinforcing unit may not be the point unit while the original point unit stands (8.23)');
  { const pz = pz150In(g, b); if (pz && pz.side === side && pz.id !== unitId) throw new Error('150th Panzer Brigade must be the point unit in its first battle (18.4)'); }
  if (side === b.attacker) b.attPoint = unitId; else b.defPoint = unitId;
}
export function setEngFw(_g: Game, b: Battle, on: boolean) { if (!['setup', 'attArty', 'defArty', 'defFire', 'offFire'].includes(b.stage)) throw new Error('too late: the field works are removed before offensive fire (6.33)'); b.engFw = !!on; }

/* ================= referee-lite: checks on a move written by the other browser ================= */
/** Who has to act now: one side, or both (Prepare phases). */
export function actorOf(g: Game): Side | 'both' {
  if (g.pendingBlow) { const u = g.units.find((x) => x.id === g.pendingBlow!.unit); return u ? other(u.side) : 'both'; }
  { const s = CUR.pendingSide?.(g); if (s) return s; }
  const b = g.battle;
  if (b) return b.stage === 'setup' ? setupSide(g, b) : b.stage === 'loss' && b.loss ? b.loss.side : ['defArty', 'defFire', 'defChoice', 'retreat'].includes(b.stage) ? other(b.attacker) : b.attacker;
  if (g.phase === 'admin' || g.phase === 'reinforcement' || g.phase === 'deploy') return 'both';         // the set-up: each side places its own pieces
  return g.phase === 'reaction' ? other(g.phasing) : g.phasing;
}
const PHASE_ORDER: Phase[] = ['reinforcement', 'admin', 'movement', 'strategic', 'combat', 'reaction', 'btMove', 'btCombat', 'supply'];
const clock = (g: Game) => g.phase === 'deploy' ? g.turn * 1000 - 1 : g.turn * 1000 + (g.phasing === sidesOf(g)[0] ? 0 : 500) + PHASE_ORDER.indexOf(g.phase);
/** Without a server nobody stops a modified browser from writing a false game; each browser checks what the other one wrote and warns.
 *  `writer` is the side whose account wrote the change (null: an admin or unknown). Returns plain-language problems, empty when all is well. */
export function auditChange(prev: Game, next: Game, writer: Side | null): string[] {
  const out: string[] = [];
  if (isRestore(prev, next)) return [];                                                               // a restore is reported on its own (restoreNote)
  if (next.turn === 1 && next.log.length < prev.log.length && clock(next) < clock(prev)) return ['The game was restarted.'];
  if (clock(next) < clock(prev)) out.push(`The game went back from turn ${prev.turn} ${prev.phase} to turn ${next.turn} ${next.phase}.`);
  if (next.rolls < prev.rolls) out.push('The dice counter went backwards: rolls were undone.');
  const a = prev.battle, b = next.battle;
  if (a && b && a.area === b.area && JSON.stringify(b.rolls.slice(0, a.rolls.length)) !== JSON.stringify(a.rolls)) out.push('Dice already rolled in this battle were changed.');
  const actor = actorOf(prev);
  const hid = (u?: Unit) => !!u && u.name === 'Hidden block', bare = (g: Game, o: Game) => JSON.stringify({ ...g, log: [], revealed: null, units: g.units.map((u, i) => (hid(u) || hid(o.units[i]) ? { side: u.side, area: u.area } : u)) });   // a hidden block re-coded or hidden again is not a move
  if (writer && actor !== 'both' && actor !== writer && bare(next, prev) !== bare(prev, next)) out.push(`The ${CUR.sideName[writer] ?? writer} player changed the game while it was the ${CUR.sideName[actor] ?? actor} player's turn to act.`);
  return out;
}

/** True when `next` is a restore: the other player's rules check put the game back to the last legal position. */
export const isRestore = (prev: Game, next: Game) => !!next.restored && next.restored.t !== prev.restored?.t;
/** The chain of areas a block traces supply through (9.3), source last; or null when it is cut off. Same rule as inSupply. */
export function supplyPath(g: Game, side: Side, start: number): number[] | null {
  setPlayArea(g.inPlay);
  if (CUR.supplyFree?.(g, side, start)) return [start];
  const src = CUR.sources(g, side), prev = new Map<number, number>([[start, -1]]), q = [start];
  while (q.length) {
    const a = q.shift()!;
    if (src.has(a) && g.control[a] === side) { const p = [a]; let x = a; while (prev.get(x)! >= 0) { x = prev.get(x)!; p.unshift(x); } return p; }
    for (const n of supN(g, a)) {
      if (prev.has(n) || g.control[n] !== side || !(CUR.supplyStep ?? bulgeSupplyStep)(g, side, a, n, a === start)) continue;
      prev.set(n, a); q.push(n);
    }
  }
  return null;
}
/* ================= The Bulge, registered as the first volume: its exclusive rules are the hooks above ================= */
registerHooks('bulge', {
  newGame: bulgeNewGame, markerKey: bulgeMarkerKey, reach: bulgeReach, moveOk: (_g, u, a) => britishOk(u, a), beforeMove: bulgeBeforeMove, afterMove: bulgeAfterMove,
  stratAllowed: bulgeStratAllowed, stratStep: bulgeStratStep, afterStrat: bulgeAfterStrat, successNumber, canAssign: bulgeCanAssign, moraleSn: bulgeMoraleSn,
  retreatOk: bulgeRetreatOk, sources: bulgeSources, supplyStep: bulgeSupplyStep, supplyFree: (g, side, a) => airSup(g).some((s) => s.side === side && s.area === a),
  noRetreat: (_g, u) => !!u.garrison && (u.id.startsWith('G') || u.id.startsWith('TF-')),       // 16.21, 16.22: garrisons and task forces never retreat
  victory: seriesVictory, finalResult: bulgeFinal, onPhase: bulgeSupplyHook, beforeRecycle: bulgeBeforeRecycle, vpHist: (g, v) => (g.opts.scenario === 'cold' ? coldAreas(g) : v.net),
} as Partial<Volume>);
/** Why a cut-off area has no supply, in plain words: the friendly neighbours it could not pass and the enemy that holds the way. */
export function supplyWhy(g: Game, side: Side, start: number): string {
  const enemy = other(side), held = neighbors(start).filter((n) => g.control[n] === enemy).map((n) => areas.get(n)!.name);
  const blown = neighbors(start).filter((n) => g.blown.includes(keyOf(start, n))).map((n) => areas.get(n)!.name);
  const parts = [held.length ? `held by the enemy: ${held.join(', ')}` : '', blown.length ? `blown bridge to ${blown.join(', ')}` : ''].filter(Boolean);
  return parts.length ? `No friendly path to a supply source (${parts.join('; ')}).` : 'No friendly path to a supply source: every way out runs through enemy-held areas.';
}
