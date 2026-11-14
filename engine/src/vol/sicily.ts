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
import { BOX, boxByCode, isBox, isLandingBox, within, area as sarea, type Nation } from '../sicily/map';
import { allowanceOf } from '../sicily/move';
import { isArty, isBattleAsset, type Chit } from '../chits';
import { type Quality } from '../combat';
import { registerHooks, type Volume } from '../volumes';
import { buildFieldWorks, chit, contested, needAdmin, say, saAvailable, supplied, unitsIn, type Game, type Side, type Unit } from '../game';
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
  untriedFree,
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
const used = (c: Chit) => {
  c.box = 'used';
  c.area = undefined;
};
export const gone = (c: Chit) => {
  c.box = 'eliminated';
  c.area = undefined;
};
/* ---------- air support in the Admin and Supply Phases (16.33, 16.34, 16.31) ---------- */
export function airInterdiction(g: Game, chitId: string, a: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['air_mission']);
  need(!isBox(a) && !g.interdicted[a], 'a land area not already interdicted');
  need(!state(g).airCancelled?.includes(a), 'the dogfight cancelled the interdiction here: no replacement (16.31)');
  c.box = 'map';
  c.area = a;
  c.mission = 'interdiction';
  g.interdicted[a] = c.id;
  say(g, `Air interdiction over ${nameOf(a)} (16.33)`, c.side);
}
export function dogfightInterdiction(g: Game, chitId: string, a: number) {
  needAdmin(g); // 16.31: an answer to the enemy mission, whichever part of the Admin Phase it is
  const c = avail(g, chitId, ['air_mission']),
    id = g.interdicted[a];
  need(id && chit(g, id).side !== c.side, 'no enemy interdiction there');
  const t = chit(g, id!);
  used(t);
  t.mission = undefined;
  delete g.interdicted[a];
  (state(g).airCancelled ??= []).push(a);
  used(c);
  say(g, `Dogfight: the interdiction over ${nameOf(a)} is cancelled (16.31)`, c.side);
}
export function airSupply(g: Game, chitId: string, a: number) {
  need(g.phase === 'supply', 'in the Supply Phase');
  const c = avail(g, chitId, ['air_mission']);
  need(
    unitsIn(g, a, c.side).some((u) => u.unsupplied),
    'one of your unsupplied areas',
  );
  need(!g.airSupply, 'one Air Supply mission at a time');
  need(
    state(g).airNoMore !== g.turn * 10 + (g.phasing === 'allied' ? 1 : 2),
    'the dogfight cancelled the Air Supply mission: no replacement this Supply Phase (16.31)',
  );
  c.box = 'map';
  c.area = a;
  c.mission = 'supply';
  g.airSupply = { area: a, side: c.side, id: c.id, stamp: g.turn };
  const V = state(g);
  V.airPrev = {};
  for (const u of unitsIn(g, a, c.side))
    if (u.unsupplied && u.disorder) {
      V.airPrev[u.id] = u.disorder;
      u.disorder = u.disorder === 2 ? 0 : 2;
    } // either player's mission; supplied units were already adjusted   // 16.34 (2): the marker stays, but no morale check (supplyChecks) and the 9.35 adjustment is allowed
  say(g, `Air supply over ${nameOf(a)} (16.34)`, c.side);
}
export function dogfightAirSupply(g: Game, chitId: string) {
  need(g.phase === 'supply' && !!g.airSupply, 'no Air Supply mission to cancel');
  const c = avail(g, chitId, ['air_mission']);
  need(c.side !== g.airSupply!.side, 'your own mission');
  const t = chit(g, g.airSupply!.id),
    V = state(g);
  for (const u of unitsIn(g, g.airSupply!.area, t.side)) if (V.airPrev?.[u.id] != null) u.disorder = V.airPrev[u.id]; // 16.31: undo the recovery; the unsupplied marker never came off
  V.airPrev = undefined;
  V.airNoMore = g.turn * 10 + (g.phasing === 'allied' ? 1 : 2);
  used(t);
  t.mission = undefined;
  g.airSupply = null;
  used(c);
  say(g, 'Dogfight: the Air Supply mission is cancelled (16.31)', c.side);
}
/* ---------- ports (14.51) ---------- */
export function portWork(g: Game, chitId: string, port: string) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['engineer']),
    V = state(g),
    p = boxByCode(port);
  need(p && p.kind === 'port' && port !== 'P4', 'Syracuse, Catania or Palermo (Messina cannot be damaged, 14.51)');
  need(!V.portWorked.includes(port), 'one level per port per Admin Phase');
  need(supplied(g, c.side, p.area), 'the port must be friendly-controlled, uncontested and in supply');
  if (c.side === 'axis') {
    need(V.portDamage[port] < 2, 'already damaged twice');
    V.portDamage[port]++;
  } else {
    need(
      unitsIn(g, p.area, 'allied').some((u) => nation(u) === p.nation && regular(u)),
      `occupied by a ${p.nation === 'us' ? 'American' : 'British'} unit`,
    );
    need(V.portDamage[port] > 0, 'not damaged');
    V.portDamage[port]--;
  }
  V.portWorked.push(port);
  used(c);
  say(g, `${c.name} ${c.side === 'axis' ? 'damages' : 'repairs'} the port of ${p.name}: damage ${V.portDamage[port]} (14.51)`, c.side);
}
/* ---------- 14.63 the Axis staff asset recovers an Italian infantry asset ---------- */
export function axisStaffRecover(g: Game, chitId: string, assetId: string) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['command_staff']);
  need(c.side === 'axis', 'the Axis staff asset');
  const a = chit(g, assetId);
  need(
    a.side === 'axis' && a.nation === 'italian' && a.kind === 'infantry_asset' && a.box === 'eliminated',
    'an eliminated Italian infantry asset',
  );
  a.box = 'available';
  used(c);
  say(g, `Staff: ${a.name} returns to the Available Box (14.63)`, 'axis');
}
/* ---------- events (17.x) ---------- */
export function playPatton(g: Game, chitId: string) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['event_patton_slap']);
  gone(c);
  state(g).patton = true;
  say(g, 'Patton Soldier Slap: US single-use Special Actions now cost two events each (17.11)', 'axis');
}
export function playTacticalExtract(g: Game, chitId: string) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['event_tactical_extract']);
  gone(c);
  state(g).extract = true;
  say(g, 'Axis Tactical Extract: this Movement Phase German units may move out of contested areas towards Messina (17.12)', 'axis');
}
/** 17.21b-c: Italian morale fades one level; the Axis, then the Allies, pick the Italian assets eliminated from the Available Box. */
export function playFadingMorale(g: Game, chitId: string) {
  needAdmin(g, chit(g, chitId).side);
  const V = state(g);
  need(
    !V.moralePick || !Object.values(V.moralePick).some((n) => n > 0),
    'first pick the Italian assets of the last Fading Italian Morale (17.21c)',
  );
  const c = avail(g, chitId, ['event_fading_morale']);
  gone(c);
  V.morale = Math.min(3, V.morale + 1);
  const n = V.morale === 1 ? { axis: 1, allied: 0 } : V.morale === 2 ? { axis: 1, allied: 1 } : { axis: 2, allied: 2 };
  const pool = () =>
    g.chits.filter(
      (x) =>
        x.side === 'axis' &&
        x.nation === 'italian' &&
        x.box === 'available' &&
        x.kind !== 'command_staff' &&
        (isArty(x) || isBattleAsset(x)),
    );
  V.moralePick = { axis: Math.min(n.axis, pool().length), allied: Math.min(n.allied, Math.max(0, pool().length - n.axis)) };
  say(
    g,
    `Fading Italian Morale: level ${V.morale} (17.21). The Axis picks ${V.moralePick.axis} Italian asset(s) to eliminate, then the Allies ${V.moralePick.allied}`,
    'allied',
  );
}
export function pickMoraleLoss(g: Game, side: Side, assetId: string) {
  const V = state(g);
  need(V.moralePick && V.moralePick[side] > 0, 'no pick pending for that side');
  need(side === 'allied' ? !V.moralePick!.axis : true, 'the Axis picks first (17.21c)');
  const a = chit(g, assetId);
  need(
    a.side === 'axis' && a.nation === 'italian' && a.box === 'available' && a.kind !== 'command_staff' && (isArty(a) || isBattleAsset(a)),
    'an Italian asset in the Available Box (not the Staff)',
  );
  gone(a);
  V.moralePick![side]--;
  say(g, `${a.name} is eliminated (Fading Italian Morale, 17.21c)`, side);
}
export function autoMoraleLoss(g: Game) {
  const V = state(g);
  for (const sd of ['axis', 'allied'] as const)
    while (V.moralePick?.[sd]) {
      const a = g.chits.find(
        (x) =>
          x.side === 'axis' &&
          x.nation === 'italian' &&
          x.box === 'available' &&
          x.kind !== 'command_staff' &&
          (isArty(x) || isBattleAsset(x)),
      );
      if (!a) {
        V.moralePick![sd] = 0;
        break;
      }
      pickMoraleLoss(g, sd, a.id);
    }
}
/** 17.22: a Flanking Invasion asset lands in an enemy-controlled, uncontested coastal area within two areas of a unit of its army in a coastal area. */
export function flankTargets(g: Game, chitId: string): number[] {
  const c = chit(g, chitId),
    V = state(g);
  if (
    g.phase !== 'admin' ||
    g.phasing !== 'allied' ||
    c.box !== 'available' ||
    !c.flank ||
    (c.flank === 'once' && V.cdoUsed) ||
    V.flankTurn === g.turn
  )
    return []; // one per Admin Phase
  const near = new Set<number>();
  for (const u of g.units.filter(
    (x) => x.side === 'allied' && x.area != null && !isBox(x.area) && regular(x) && nation(x) === c.nation && sarea(x.area)?.coastal,
  ))
    for (const a of within(u.area!, 2)) near.add(a);
  return [...near].filter(
    (a) => sarea(a)?.coastal && g.control[a] === 'axis' && !contested(g, a) && (!g.inPlay || g.inPlay.includes(a)) && !V.flank[a],
  );
}
export function playFlanking(g: Game, chitId: string, a: number) {
  need(flankTargets(g, chitId).includes(a), 'not a legal flanking invasion (17.22)');
  const c = chit(g, chitId),
    V = state(g);
  c.box = 'map';
  c.area = a;
  if (c.flank === 'once') V.cdoUsed = true;
  V.flank[a] = c.id;
  V.flankTurn = g.turn;
  g.units.push({
    id: `F-${c.id}`,
    name: c.name,
    side: 'allied',
    nation: c.nation,
    cls: 'infantry',
    q: [c.q ?? 'veteran'],
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
    ech: c.ech,
  });
  say(g, `${c.name} lands in ${nameOf(a)}: a flanking invasion (17.22)`, 'allied');
  if (unitsIn(g, a, 'axis').length) {
    if (!g.riverAssault.includes(a)) g.riverAssault.push(a);
    say(g, 'The area is defended: one round of combat now, with air and naval support only', 'allied');
  }
}
/** 17.22: a flanking invasion is relieved the instant an Allied unit enters its area. */
export function relieveFlank(g: Game, a: number) {
  const V = state(g),
    id = V.flank[a];
  if (!id) return;
  const c = chit(g, id);
  used(c);
  g.units = g.units.filter((u) => u.id !== `F-${id}`);
  delete V.flank[a];
  say(g, `${c.name} is relieved and goes to the Used Box (17.22)`, 'allied');
}
/** A battle may open in the Allied Admin Phase where a flanking invasion just landed on defenders (17.22). */
export const battleAllowed = (g: Game, a: number) =>
  g.phase === 'admin' &&
  g.phasing === 'allied' &&
  state(g).flankTurn === g.turn &&
  !!state(g).flank[a] &&
  g.units.some((u) => u.id === `F-${state(g).flank[a]}` && u.area === a); // 17.22(i): only the round of the landing
/** 17.22: the flanking invasion battles still to fight in this Admin Phase. */
export const flankBattles = (g: Game) =>
  Object.keys(state(g).flank)
    .map(Number)
    .filter((a) => battleAllowed(g, a) && contested(g, a) && !g.fought.includes(a) && g.battle?.area !== a);
/* ---------- 17.11 Patton: a US single-use Special Action costs two events ---------- */
function saFilter(g: Game, _side: Side, list: Chit[], ech?: string) {
  if (!state(g).patton) return list;
  const usEv = list.filter((c) => c.kind === 'special_action_event' && c.nation === 'us');
  if (usEv.length >= 2 || !usEv.length) return list;
  void ech;
  return list.filter((c) => !usEv.includes(c));
}
function onSpendSA(g: Game, _side: Side, c: Chit) {
  if (!state(g).patton || c.kind !== 'special_action_event' || c.nation !== 'us') return;
  const second = g.chits.find((x) => x.kind === 'special_action_event' && x.nation === 'us' && x.box === 'available');
  if (second) {
    gone(second);
    say(g, `Patton Soldier Slap: a second US Special Action event is spent (17.11)`, 'allied');
  }
}
/* ---------- reserves (14.7) ---------- */
const markerKey = (_g: Game, u: Unit) => (u.side === 'axis' ? 'res' : nation(u) === 'british' ? 'br' : 'us');
const reserveOk = (g: Game, u: Unit) => !isLandingBox(u.area!) && untriedFree(g, u);
/** 15.3a: a reserve marker on an untried unit is its one action this phase (called when the marker goes on). */
const onReserve = (g: Game, u: Unit) => {
  if (u.untried && g.phase === 'movement') state(g).untriedActed = u.id;
};
/** 5.23 with 15.3a: an untried garrison digging in is the one untried unit acting this phase. */
export function unitFieldWorks(g: Game, unitId: string) {
  const u = unit(g, unitId);
  need(untriedFree(g, u), 'only one untried unit may act in a Movement Phase (15.3a)');
  need(!isBox(u.area!), 'not in a box');
  buildFieldWorks(g, unitId);
  if (u.untried) state(g).untriedActed = u.id;
}
export const specialActions = (g: Game, side: Side) => saAvailable(g, side);
/** The beachheads still in play, by landing box code. */
export const beachheads = (g: Game) =>
  Object.entries(state(g).beachheads).map(([b, n]) => ({ box: BOX.get(+b)!.box, id: +b, nation: n, area: BOX.get(+b)!.area }));

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
