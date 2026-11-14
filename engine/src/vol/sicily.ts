// FAB Vol. II, Sicily, on the series engine: the Play Book scenarios (22.1 Sunrise Bridge, 22.2 Tournament, 22.3 Campaign) and the
// Exclusive Rules as the volume hooks the series engine calls — landing and port boxes, beachheads and arrivals (14.2), airborne and
// beach assaults (14.27), sea retreat (14.28), Axis evacuation (14.29), army zones and releases (14.3, 14.4, 14.61, 17.23), port damage
// (14.51), reserve and strat-move limits (14.7, 14.8), supply (14.9), the motorized Livorno (15.1), divisional integrity (15.2), the
// untried Italian garrisons (15.3), the asset rules (16.x: Italian battle assets, naval support, Rangers, air support, airfields, ports),
// the events (17.x) and victory (19.x). Everything else — the turn sequence, battles, retreats, reserves — is the series engine.
import unitsJson from '../../../data/sicily/units.json';
import countersJson from '../../../data/sicily/counters.json';
import setupsJson from '../../../data/sicily/setups.json';
import { areas as mapAreas } from '../map';
import { isLandingBox, type Nation } from '../sicily/map';
import { allowanceOf } from '../sicily/move';
import { type Chit } from '../chits';
import { type Quality } from '../combat';
import { registerHooks, type Volume } from '../volumes';
import { chit, contested, type Game, type Side, type Unit } from '../game';
export { MESSINA, ETNA, isBox, isLandingBox, isPortBox, boxId, BOX, landingBoxes, portBoxes, LANDING_ORDER } from '../sicily/map';
import { afterDeploy, newSicilyGame } from './sicily-setup';
export * from './sicily-setup';
import {
  afterMove,
  afterStrat,
  beforeRecycle,
  entryBoxes,
  moveOk,
  reinforce,
  seaRetreat,
  sicilyReach,
  stratAllowed,
  stratStep,
  zoneOk,
} from './sicily-moves';
export * from './sicily-moves';
import { afterDraw, extraDraws, finalResult, onPhase, sicilyVictory, sources, supplyStep, unitSupply } from './sicily-turn';
export * from './sicily-turn';
import {
  adjustFire,
  assault,
  beforeBegin,
  beforeFire,
  canAbort,
  canAssign,
  onBattle,
  onRetreat,
  retreatOk,
  retreatPrefer,
  sicilyMoraleSn,
  sicilySn,
} from './sicily-combat';
export * from './sicily-combat';
import { battleAllowed, markerKey, onReserve, onSpendSA, reserveOk, saFilter } from './sicily-actions';
export * from './sicily-actions';

/* ================= the volume's own state ================= */
export type Plan = 'historical' | 'alternate';
export interface SicilyState {
  plan?: Plan;
  beachheads: Record<number, 'us' | 'british'>; // landing boxes holding a beachhead marker, by nationality (14.22)
  captured: number[]; // beachheads the Axis captured or destroyed: one VP each (19.2)
  released: string[];
  usReleased: boolean; // divisions released from their zones (14.61); 17.23 US 7th Army Release
  morale: number;
  moraleCup: number;
  triggered: string[]; // Fading Italian Morale level (17.21), events put in the cup so far, the ports / areas that triggered one
  moralePick?: Record<string, number>; // 17.21c: Italian assets each side must still pick for elimination
  portDamage: Record<string, number>;
  portWorked: string[]; // damage level of P1-P3 (14.51); ports already worked this Admin Phase
  evacMp?: Record<string, number>; // 14.29: MP an Axis unit still has after moving into Messina this phase
  stratUnit?: string; // 14.29: the unit that strat-moved this phase (it may go on to the toe of Italy)
  flankTurn?: number; // 17.22: the turn of the last flanking invasion (one per Admin Phase)
  untriedActed?: string; // 15.3a: the one untried unit that acted this Movement Phase
  strat: Record<string, number>; // strat-moves this turn: axis, us, british (14.8)
  extract: boolean;
  patton: boolean; // 17.12 in effect this Movement Phase; 17.11 in effect
  airfieldsTaken: number[];
  airfieldHoles: number; // 16.4: airfields the Allies took; empty Captured Airfields boxes the next Axis air asset fills
  flank: Record<number, string>;
  cdoUsed: boolean; // 17.22: flanking invasion assets standing on the map, by area; the 3rd CDO's once per game
  beachAssault: Record<number, number>; // 14.27b: areas assaulted from a landing box this phase (box id)
  dropPending: boolean;
  airborneAreas: number[]; // 14.27a: airborne units still to place; areas just assaulted from the air
  navalShock: Record<string, string>;
  rangerFw: Record<string, string>; // 16.21 / 16.22: per battle key, the asset that removes the field works
  sunrise: boolean;
  sunriseZoneA: number[];
  airPrev?: Record<string, 0 | 1 | 2>;
  airNoMore?: number;
  airCancelled?: number[]; // 16.31: what an Air Supply changed (undone by a dogfight), no replacement after a dogfight
}
export const state = (g: Game) => g.vol as unknown as SicilyState;
export const need = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(msg);
};
export const nameOf = (a: number) => mapAreas.get(a)?.name ?? String(a);
export const unit = (g: Game, id: string) => {
  const u = g.units.find((x) => x.id === id);
  if (!u) throw new Error(`no unit ${id}`);
  return u;
};
export const regular = (u: Unit) => !u.garrison;
export const nation = (u: Unit): Nation => (u.nation ?? (u.side === 'axis' ? 'italian' : 'us')) as Nation;
export const army = (n: Nation) => (n === 'us' ? 'us' : n === 'british' ? 'british' : 'axis');
export const isSunrise = (g: Game) => g.opts.scenario === 'sunrise_bridge';

type RawUnit = {
  id: string;
  name: string;
  side: Side;
  nation: Nation;
  echelon: string;
  symbol?: string;
  cls?: string;
  steps?: number;
  quality_by_step?: Quality[];
  division?: string | null;
  size?: string;
  kind?: string;
  start_area?: number;
  start_reserve?: boolean;
  arrival?: string;
  arrival_turn?: number;
  entry?: string[];
  motorized?: boolean;
};
type RawChit = {
  id: string;
  ids?: string[];
  kind: string;
  side: Side | 'none';
  nation: Nation | null;
  echelon: string;
  name: string;
  turn: number | string | null;
  quality?: Quality | null;
  subtype?: string;
  red_flag?: boolean;
  flanking_invasion?: string | boolean;
  division?: string;
};
type Setup = {
  name: string;
  rule: string;
  turns: number;
  admin_skipped_turn1: Side[];
  units: { id: string; area?: number; box?: string }[];
  reserve?: { axis: string[] };
  untried: { ids: string[]; areas?: number[] };
  landing_plans?: { historical: PlanDef; alternate: PlanDef };
  holding_boxes: Record<string, string[]>;
  reserve_markers_on_units?: Record<string, string>;
  available: Record<string, string[]>;
  port_damage?: Record<string, number>;
  areas_in_play?: number[];
  track?: Record<string, Record<string, [number, number]>>;
  invasion?: { allied: string[]; beachheads: string[] };
  zones?: { british: string[]; zone_a_areas: number[] };
  supply?: { axis_areas?: number[] };
  reinforcements?: Record<string, Record<string, { units: { id: string; entry: (number | string)[] }[]; chits: string[] }>>;
  victory: { area_vp?: Record<string, number>; axis_win_at?: number; levels?: { operational: number; marginal: number } };
  historical_option?: { untried_areas: number[]; british_beachheads: string[] };
};
type PlanDef = {
  british: { beachheads: number; consecutive_in?: string[]; boxes?: string[]; zones: string[]; released_zones: string[] };
  us: { beachheads: number; consecutive_in?: string[]; boxes?: string[]; zones: string[]; released_zones: string[] };
};
export const UNITS = unitsJson as unknown as RawUnit[],
  COUNTERS = countersJson as unknown as RawChit[],
  SETUPS = setupsJson as unknown as Record<string, Setup>;
export const CHIT_KINDS = new Set([
  'artillery',
  'engineer',
  'infantry_asset',
  'armor_asset',
  'air_mission',
  'naval_support',
  'special_action_event',
  'command_staff',
  'replacement_inf',
  'replacement_arm',
  'event_asset_delayed',
  'event_fading_morale',
  'event_army_release',
  'event_patton_slap',
  'event_tactical_extract',
]);
export const SCEN = (g: Game) => SETUPS[g.opts.scenario === 'campaign_hist' ? 'campaign' : g.opts.scenario] ?? SETUPS.tournament;
export const PLANS = SETUPS.tournament.landing_plans!;

/* ================= the volume's own player actions ================= */
export const avail = (g: Game, id: string, kinds: string[]) => {
  const c = chit(g, id);
  need(c.box === 'available' && kinds.includes(c.kind), `${c.name} is not available for this`);
  return c;
};
export const used = (c: Chit) => {
  c.box = 'used';
  c.area = undefined;
};
export const gone = (c: Chit) => {
  c.box = 'eliminated';
  c.area = undefined;
};

registerHooks('sicily', {
  adminBoth: (g) =>
    Object.values(g.interdicted).some((id) =>
      g.chits.some((c) => c.kind === 'air_mission' && c.box === 'available' && c.side !== chit(g, id).side),
    ), // 16.31: the other side may answer an interdiction with a dogfight at once
  pendingSide: (g) => {
    const p = state(g).moralePick;
    return p?.axis ? 'axis' : p?.allied ? 'allied' : undefined;
  }, // 17.21c: the Axis, then the Allies, pick the Italian assets lost
  newGame: newSicilyGame as Volume['newGame'],
  markerKey,
  reach: sicilyReach,
  moveOk,
  afterMove,
  stratAllowed,
  stratStep,
  afterStrat,
  allowance: (g, u) => allowanceOf(u, g.moving?.id === u.id && g.moving.left),
  successNumber: sicilySn,
  adjustFire,
  canAssign,
  moraleSn: sicilyMoraleSn,
  retreatOk,
  retreatPrefer,
  onRetreat,
  noRetreat: (_g, u) => !!u.garrison,
  seaRetreat,
  mustFight: (g) => state(g).airborneAreas.filter((a) => contested(g, a)),
  retreatZone: (g, u, to) => u.side !== 'allied' || zoneOk(g, u, to), // 14.27a, 14.43
  sources,
  supplyStep,
  unitSupply,
  supplyFree: (g, side, a) => g.airSupply?.area === a && g.airSupply.side === side,
  alwaysSupplied: (_g, u) => isLandingBox(u.area!) || !!u.garrison,
  victory: sicilyVictory,
  finalResult,
  onPhase,
  onBattle,
  assault,
  reinforce,
  afterDraw,
  afterDeploy,
  extraDraws,
  canAbort,
  beforeBegin,
  beforeFire,
  saFilter,
  onSpendSA,
  battleAllowed,
  reserveOk,
  onReserve,
  beforeRecycle,
  noReroute: true,
  staffReplaceOk: (_g, c) => c.side !== 'axis',
  appropriate: (g, u) => entryBoxes(g, u),
  stackLimit: () => 2,
  optional: [
    {
      key: 'airborne',
      rule: '18.1',
      name: 'Airborne units',
      text: 'The 82nd and 1st Airborne units ignore the −1 unsupplied morale modifier.',
    },
    {
      key: 'advArty',
      rule: '18.2',
      name: 'Advanced artillery modifiers',
      text: '−1 when the target is the defender, +1 against an infantry point unit not in field works.',
    },
    {
      key: 'overrun',
      rule: '18.3',
      name: 'Overrunning artillery',
      text: 'Defending artillery left behind in a vacated area may be destroyed by the attacker.',
    },
    {
      key: 'fwMaintain',
      rule: '18.4',
      name: 'Maintaining field works',
      text: "Field works in a contested area stay unless a morale check fails in the owner's Supply Phase.",
    },
  ],
} as Partial<Volume>);
