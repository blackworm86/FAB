// The volumes of the series: each game's data (map, units, counters, scenarios, turn track) and its exclusive rules, as hooks the
// series engine (game.ts) calls. One page runs one game, so the engine reads the current volume (`CUR`); `useGame(id)` switches it,
// like `setPlayArea` switches the area of play. The hooks of a volume are registered by its module (game.ts registers The Bulge's).
import bulgeMap from '../../data/bulge/map.json';
import bulgeUnits from '../../data/bulge/units.json';
import bulgeCounters from '../../data/bulge/counters.json';
import bulgeScen from '../../data/bulge/scenarios.json';
import bulgeEntry from '../../data/bulge/entry_areas.json';
import golanMap from '../../data/golan73/map.json';
import golanUnits from '../../data/golan73/units.json';
import golanCounters from '../../data/golan73/counters.json';
import golanSetups from '../../data/golan73/setups.json';
import golanTrack from '../../data/golan73/turn_track.json';
import sicilyUnits from '../../data/sicily/units.json';
import sicilyCounters from '../../data/sicily/counters.json';
import sicilySetups from '../../data/sicily/setups.json';
import sicilyTrack from '../../data/sicily/turn_track.json';
import { engineMap as sicilyEngineMap } from './sicily/map';
import type { Game, Unit, Battle, Opts, Opt, OptionalRule } from './game';
import type { Chit } from './chits';
import type { Shooter, Target, Setting, Quality } from './combat';

export type Side = string;
/** One area as the series engine sees it: `vp[side]` is that side's points for holding it, `mutual` a point for whoever holds it. */
export interface Area {
  id: number;
  name: string;
  tdn: number;
  zone: number;
  vp: { mutual: boolean; german: number; allied: number; syrian: number; israeli: number };
  supply?: boolean;
  altSetup?: string | null;
}
/** One link between two areas. `type` is the connection (road 1 MP, field 2 MP, special: an arrow); the flags are the boundary types drawn along it (14.1 of each volume). */
export interface Conn {
  a: number;
  b: number;
  type: 'road' | 'field' | 'special';
  mp: number;
  river: boolean;
  restricted: boolean;
  army_boundary: boolean;
  atDitch?: boolean;
  wadi?: boolean;
  escarpment?: boolean;
  rugged?: boolean;
  samBarrier?: boolean;
  sector?: boolean;
  hermon?: boolean;
  /** Printed only on this scenario's map sheet (with its own MP cost; once: one unit per Movement Phase). */
  sheet?: string;
  once?: boolean;
  /** Sicily: the arrow from a landing box or a port box to its coastal area (14.21, 14.23). */
  landing?: boolean;
  port?: boolean;
}
export interface MapData {
  size: [number, number];
  areas: Area[];
  connections: Conn[];
}
export interface TrackRow {
  ge: number[];
  al: number[];
  sd: number[] | null;
} // draws [first player's turn, second player's turn] for the first (ge) and second (al) player; sd: net VP for sudden death [first, second]

/** What a volume gives the series engine. Data first; the rule hooks are optional and default to the series behaviour. */
export interface Volume {
  id: string;
  name: string;
  sides: [Side, Side]; // [First Player, Second Player]
  tag: Record<Side, string>; // GE / AL, SY / IS: the log and the step bar
  sideName: Record<Side, string>; // German / Allied, Syrian / Israeli
  map: MapData;
  units: unknown[];
  counters: unknown[];
  scenarios: Record<string, unknown>;
  entries: Record<string, { side: string; area: number }>;
  track: TrackRow[];
  /* ---- rule hooks (set by the volume's module) ---- */
  newGame: (seed: number, opts: Partial<Opts>) => Game;
  /** The reserve-marker pool a unit draws from (The Bulge: its army zone). */
  markerKey: (g: Game, u: Unit) => string;
  /** Raw reach of a unit this phase (its volume's boundary and cost rules); the series filters stacking, reaction and river limits after it. */
  reach: (g: Game, u: Unit, one: boolean) => Opt[];
  /** The block's movement allowance in MP now (default 6 armor, 3 infantry). */
  allowance?: (g: Game, u: Unit) => number;
  moveOk?: (g: Game, u: Unit, area: number) => boolean;
  /** A block the volume shows to the enemy for now (Golan reconnaissance). */
  seenBy?: (g: Game, u: Unit, side: Side) => boolean;
  /** Something that happens before the unit moves (a morale check, a raid); a string ends the move with that result. */
  beforeMove?: (g: Game, u: Unit, opt: Opt) => string | void;
  afterMove?: (g: Game, u: Unit, opt: Opt) => void;
  stratAllowed?: (g: Game, u: Unit) => boolean;
  stratStep?: (g: Game, u: Unit, from: number, to: number) => boolean | 'end'; // 'end': may be reached but not passed through
  afterStrat?: (g: Game, u: Unit, path: number[]) => void;
  successNumber: (s: Shooter, t: Target, c: Setting) => { sn: number; parts: [string, number][] };
  /** Extra firing groups (brigade integrity) or changes to the list before the dice roll. */
  adjustFire?: (
    g: Game,
    b: Battle,
    side: Side,
    kind: 'arty' | 'ground',
    list: { key: string; who: string; shooter: Shooter; dice: number; sn: number; parts: [string, number][]; isAsset: boolean }[],
  ) => void;
  canAssign: (g: Game, b: Battle, side: Side, c: Chit, mode?: 'arty' | 'support') => string | null;
  moraleSn: (g: Game, u: Unit, why: 'exploit' | 'supply' | 'check') => number;
  retreatOk?: (g: Game, u: Unit, from: number, to: number) => boolean;
  /** 6.42c (2016): an asset the Exclusive Rules do not allow to retreat; when its side retreats it is destroyed, counting as a hit. */
  noRetreat?: (g: Game, u: Unit) => boolean;
  retreatPrefer?: (g: Game, u: Unit, from: number, opts: number[]) => number[];
  onRetreat?: (g: Game, u: Unit, from: number, to: number) => void;
  sources: (g: Game, side: Side) => Set<number>;
  supplyStep?: (g: Game, side: Side, from: number, to: number, first: boolean) => boolean;
  alwaysSupplied?: (g: Game, u: Unit) => boolean;
  victory: (g: Game) => Record<Side, number> & { net: number };
  finalResult: (g: Game, net: number) => string;
  /** Called at the start of the named phase (after the series set it up) and at its end (before the series moves on). */
  onPhase?: (g: Game, phase: string, when: 'start' | 'mid' | 'end') => void;
  /** The start of a combat round (blocks revealed) and its end. */
  onBattle?: (g: Game, b: Battle, when: 'begin' | 'end') => void;
  /** A Breakthrough Combat round here costs no Special Action (22.17 of Golan). */
  freeBattle?: (g: Game, area: number) => boolean;
  /** Does the move that made this area newly contested count as an assault (River Assault marker)? The series: all attackers crossed a river and one a blown bridge. */
  assault?: (g: Game, area: number, entered: { id: string; river: boolean; blown: boolean }[]) => boolean;
  /** An area whose supply is given regardless of any path (The Bulge: an Air Supply mission). */
  supplyFree?: (g: Game, side: Side, area: number) => boolean;
  /** Before the Used Box recycles (4.1b): true when the side must first make a choice (The Bulge's artillery attrition). */
  beforeRecycle?: (g: Game, side: Side) => boolean;
  vpHist?: (g: Game, v: Record<Side, number> & { net: number }) => number;
  /** How many blocks of one side an area holds (5.1: two; Golan's Assembly areas: any number). */
  stackLimit?: (g: Game, area: number) => number;
  /** Whether unit `u` may end in area `a` under the stacking limit; undefined = the usual count against stackLimit. */
  stackRoom?: (g: Game, u: Unit, area: number) => boolean | undefined;
  /** The entry areas a unit may be rerouted to or placed in when its own are blocked (14.2). */
  appropriate?: (g: Game, u: Unit) => number[];
  isNight?: (g: Game) => boolean;
  /** An asset was just assigned to a battle (an air mission may draw SAM fire). */
  onAssign?: (g: Game, b: Battle, c: Chit, mode?: string, unit?: string) => void;
  /** An asset taken back before the first roll, or a battle withdrawn (the volume drops what hung on the asset, e.g. a pending SAM answer). */
  onUnassign?: (g: Game, b: Battle, c: Chit) => void;
  /** The volume's optional rules, for the chooser (the series list when missing). */
  optional?: OptionalRule[];
  /** A unit takes a hit some other way than a step loss (true: handled, no step lost). */
  absorbLoss?: (g: Game, b: Battle, side: Side, u: Unit) => boolean;
  /** May this unit or asset take the next loss? (only applied when some candidate may) */
  lossOk?: (g: Game, b: Battle, side: Side, key: string) => boolean;
  /** Supply Phase: may this disordered or recovering unit improve? (a morale check, say) */
  recoverOk?: (g: Game, u: Unit) => boolean;
  /** Ghost blocks move like units (an optional rule). */
  ghostsMove?: (g: Game) => boolean;
  /** An asset committed for good (it may not be taken back before the first roll). */
  keepAssigned?: (g: Game, b: Battle, c: Chit) => boolean;
  /** 8.23: may this block reinforce the defender now (the series check has passed)? */
  reinforceOk?: (g: Game, b: Battle, u: Unit) => boolean;
  /** Combat may not begin yet (a SAM answer or a jamming roll is pending): throw. */
  beforeBegin?: (g: Game, b: Battle) => void;
  /** Who answers now during a battle's set-up, when the volume interrupts the usual order (Golan: the SAM answer 16.12, jamming 17.33). */
  setupActor?: (g: Game, b: Battle) => Side | undefined;
  /** Before and after one side's dice of a firing step (an engineer bridging instead of firing; a counterbattery strike). */
  beforeFire?: (g: Game, b: Battle, side: Side, kind: 'arty' | 'ground') => void;
  afterFire?: (g: Game, b: Battle, side: Side, kind: 'arty' | 'ground') => void;
  /** The chit side of the Reinforcement Phase (4.1a–d) for one side; returns true when the side still has a choice to make (4.1a). */
  reinforce?: (g: Game, side: Side) => void;
  afterDraw?: (g: Game) => void;
  /** The set-up step is over: true if the volume started the first phase itself (Golan's historical set-up opens with the Syrian Combat Phase). */
  afterDeploy?: (g: Game) => boolean;
  quality?: (u: Unit) => Quality;
  /** A unit's own supply check in the Supply Phase (Sicily: by nationality, 14.92); default: inSupply of its side. */
  unitSupply?: (g: Game, u: Unit) => boolean;
  /** Extra Admin Phase draws for a side (Sicily 16.5: one per undamaged port held and occupied). */
  extraDraws?: (g: Game, side: Side) => number;
  /** 14.28 (Sicily): the unit may retreat to sea from this area when no other retreat is open. */
  seaRetreat?: (g: Game, u: Unit, from: number) => boolean;
  /** Why the attacker may not abort this battle (Sicily's airborne assault, 14.27a); null: it may. */
  canAbort?: (g: Game, b: Battle) => string | null;
  /** The Special Actions a side may use now, after the volume's own rules (Sicily 17.11: Patton's two-event cost). */
  saFilter?: (g: Game, side: Side, list: Chit[], ech?: string) => Chit[];
  /** Contested areas the volume makes mandatory this Combat Phase beyond the newly contested ones (Sicily 14.27a). */
  mustFight?: (g: Game) => number[];
  /** A retreat destination inside the unit's own operating zone (Sicily 14.43): such paths are tried first. */
  retreatZone?: (g: Game, u: Unit, to: number) => boolean;
  onSpendSA?: (g: Game, side: Side, c: Chit) => void;
  /** A battle may be opened here outside a Combat Phase (Sicily's Flanking Invasion lands into a defended area in the Admin Phase, 17.22). */
  battleAllowed?: (g: Game, area: number) => boolean;
  /** An area whose battle must be fought before any other this phase (Golan 15.3). */
  firstBattle?: (g: Game) => number | undefined;
  /** A side the rules make act out of turn now (Golan 15.2: Syria places the units released at the Purple Line). */
  pendingSide?: (g: Game) => Side | undefined;
  /** May this unit take a reserve marker (beyond the series conditions)? */
  reserveOk?: (g: Game, u: Unit) => boolean;
  /** A committed asset other than a battle asset that may take a step loss (Golan 18.32: artillery in direct support). */
  lossAsset?: (g: Game, b: Battle, side: Side, id: string) => boolean;
  /** The Reroute Reinforcement special action (8.27) is not used (Sicily 14.64). */
  noReroute?: boolean;
  /** Whether this command staff may replace steps of units on the board (8.31; Sicily 14.63: not the Axis one). */
  staffReplaceOk?: (g: Game, c: Chit) => boolean;
  /** A reserve marker just went on the unit. */
  onReserve?: (g: Game, u: Unit) => void;
}

export const VOLUMES: Record<string, Volume> = {};
export let CUR: Volume;
const data = (v: Omit<Volume, keyof Hooks>) => v as Volume;
type Hooks = Pick<
  Volume,
  'newGame' | 'markerKey' | 'reach' | 'successNumber' | 'canAssign' | 'moraleSn' | 'sources' | 'victory' | 'finalResult'
>;
/** The map's Turn Track (draws per player turn and the sudden-death net VP from turn 4), for The Bulge. */
const BULGE_TRACK: TrackRow[] = [
  { ge: [0, 0], al: [0, 0], sd: null },
  { ge: [9, 5], al: [7, 0], sd: null },
  { ge: [9, 4], al: [7, 1], sd: null },
  { ge: [8, 3], al: [7, 2], sd: [5, 5] },
  { ge: [7, 3], al: [7, 2], sd: [6, 4] },
  { ge: [10, 4], al: [10, 5], sd: [7, 3] },
  { ge: [8, 3], al: [11, 6], sd: [7, 3] },
  { ge: [7, 2], al: [12, 7], sd: [6, 4] },
  { ge: [6, 2], al: [13, 8], sd: [5, 5] },
];
VOLUMES.bulge = data({
  id: 'bulge',
  name: 'The Bulge',
  sides: ['german', 'allied'],
  tag: { german: 'GE', allied: 'AL' },
  sideName: { german: 'German', allied: 'Allied' },
  map: (() => {
    const m = bulgeMap as unknown as MapData;
    return { ...m, areas: m.areas.map((a) => ({ ...a, vp: { ...a.vp, syrian: 0, israeli: 0 } })) };
  })(),
  units: bulgeUnits as unknown[],
  counters: bulgeCounters as unknown[],
  scenarios: bulgeScen as unknown as Record<string, unknown>,
  entries: bulgeEntry as Record<string, { side: string; area: number }>,
  track: BULGE_TRACK,
});
{
  // Golan '73: the hand-drawn map (areas, connections with their boundary types), the Vassal units and counters, the two Badr set-ups, the turn track
  type GConn = {
    a: number;
    b: number;
    type: string;
    river?: boolean;
    atDitch?: boolean;
    wadi?: boolean;
    escarpment?: boolean;
    rugged?: boolean;
    samBarrier?: boolean;
    sector?: boolean;
  };
  const m = golanMap as unknown as {
    size: [number, number];
    areas: { id: number; name: string; tdn: number; vp: { mutual: boolean; syrian: number }; supply: boolean; altSetup: string | null }[];
    connections: GConn[];
    entries: { letter: string; area: number }[];
  };
  const conns: Conn[] = m.connections.map((c) => ({
    a: c.a,
    b: c.b,
    type: c.type === 'special' ? 'special' : (c.type as 'road' | 'field'),
    mp: c.type === 'special' ? 99 : c.type === 'road' ? 1 : 2,
    river: !!c.river,
    restricted: false,
    army_boundary: false,
    atDitch: !!c.atDitch,
    wadi: !!c.wadi,
    escarpment: !!c.escarpment,
    rugged: !!c.rugged,
    samBarrier: !!c.samBarrier,
    sector: !!c.sector,
    hermon: c.type === 'special',
  }));
  const t = (
    golanTrack as unknown as {
      turns: Record<string, { draws: Record<string, [number, number]>; suddenDeath: Record<string, number> | null }>;
    }
  ).turns;
  const track: TrackRow[] = Object.keys(t)
    .sort((a, b) => +a - +b)
    .map((k) => ({
      ge: t[k].draws.syrian,
      al: t[k].draws.israeli,
      sd: t[k].suddenDeath ? [t[k].suddenDeath!.syrian, t[k].suddenDeath!.israeli] : null,
    }));
  VOLUMES.golan73 = data({
    id: 'golan73',
    name: "Golan '73",
    sides: ['syrian', 'israeli'],
    tag: { syrian: 'SY', israeli: 'IS' },
    sideName: { syrian: 'Syrian', israeli: 'Israeli' },
    map: {
      size: m.size,
      areas: [
        ...m.areas.map((a) => ({
          id: a.id,
          name: a.name,
          tdn: a.tdn,
          zone: 0,
          vp: { mutual: a.vp.mutual, german: 0, allied: 0, syrian: a.vp.syrian, israeli: 0 },
          supply: a.supply,
          altSetup: a.altSetup,
        })),
        ...[
          [101, 'Northern Assembly Area'],
          [102, 'Southern Assembly Area'],
          [103, 'Syrian Rear Area'],
          [104, 'Northern Assembly Area (Nafakh)'],
        ].map(([id, name]) => ({
          id: id as number,
          name: name as string,
          tdn: 0,
          zone: 0,
          vp: { mutual: false, german: 0, allied: 0, syrian: 0, israeli: 0 },
        })),
      ],
      connections: [
        ...conns,
        ...[
          [101, 6],
          [101, 10],
          [102, 17],
        ].map(([a, b]) => ({ a, b, type: 'road' as const, mp: 1, river: false, restricted: false, army_boundary: false })),
        { a: 101, b: 102, type: 'special' as const, mp: 99, river: false, restricted: false, army_boundary: false },
        ...Object.entries(
          golanSetups as unknown as Record<string, { sheet?: { links: { a: number; b: number; mp: number; once?: boolean }[] } }>,
        ).flatMap(([id, sc]) =>
          (sc.sheet?.links ?? []).map((l) => ({
            a: l.a,
            b: l.b,
            type: 'field' as const,
            mp: l.mp,
            river: false,
            restricted: false,
            army_boundary: false,
            sheet: id,
            once: l.once,
          })),
        ),
      ],
    },
    units: golanUnits as unknown[],
    counters: golanCounters as unknown[],
    scenarios: golanSetups as unknown as Record<string, unknown>,
    entries: {
      ...Object.fromEntries(m.entries.map((e) => [e.letter, { side: 'syrian', area: e.area }])),
      A: { side: 'israeli', area: 101 },
      B: { side: 'israeli', area: 102 },
    },
    track,
  });
}
{
  // Sicily: the hand-drawn map with its landing and port boxes (engine/src/sicily/map.ts), the Vassal units and counters, the three Play Book scenarios, the turn track
  const t = (
    sicilyTrack as unknown as {
      turns: Record<string, { allied: [number, number]; axis: [number, number]; sudden_death: [number, number] | null }>;
    }
  ).turns;
  const track: TrackRow[] = Object.keys(t)
    .sort((a, b) => +a - +b)
    .map((k) => ({ ge: t[k].allied, al: t[k].axis, sd: t[k].sudden_death }));
  VOLUMES.sicily = data({
    id: 'sicily',
    name: 'Sicily',
    sides: ['allied', 'axis'],
    tag: { allied: 'AL', axis: 'AX' },
    sideName: { allied: 'Allied', axis: 'Axis' },
    map: sicilyEngineMap(),
    units: sicilyUnits as unknown[],
    counters: sicilyCounters as unknown[],
    scenarios: sicilySetups as unknown as Record<string, unknown>,
    entries: {},
    track,
  });
}
CUR = VOLUMES.bulge;
/** Attach a volume's rule hooks. */
export function registerHooks(id: string, hooks: Partial<Volume>) {
  Object.assign(VOLUMES[id], hooks);
}
const listeners: ((v: Volume) => void)[] = [];
/** map.ts listens: the map helpers follow the current volume. */
export const onGameSwitch = (f: (v: Volume) => void) => {
  listeners.push(f);
};
export const useGame = (id: string) => {
  const v = VOLUMES[id];
  if (!v) throw new Error(`unknown game ${id}`);
  if (v !== CUR) {
    CUR = v;
    for (const f of listeners) f(v);
  }
  return v;
};
export const gameOf = (g: { game?: string }) => useGame(g.game ?? 'bulge');
