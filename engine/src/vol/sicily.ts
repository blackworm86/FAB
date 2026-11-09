// FAB Vol. II, Sicily, on the series engine: the Play Book scenarios (22.1 Sunrise Bridge, 22.2 Tournament, 22.3 Campaign) and the
// Exclusive Rules as the volume hooks the series engine calls — landing and port boxes, beachheads and arrivals (14.2), airborne and
// beach assaults (14.27), sea retreat (14.28), Axis evacuation (14.29), army zones and releases (14.3, 14.4, 14.61, 17.23), port damage
// (14.51), reserve and strat-move limits (14.7, 14.8), supply (14.9), the motorized Livorno (15.1), divisional integrity (15.2), the
// untried Italian garrisons (15.3), the asset rules (16.x: Italian battle assets, naval support, Rangers, air support, airfields, ports),
// the events (17.x) and victory (19.x). Everything else — the turn sequence, battles, retreats, reserves — is the series engine.
import unitsJson from '../../../data/sicily/units.json';
import countersJson from '../../../data/sicily/counters.json';
import setupsJson from '../../../data/sicily/setups.json';
import { areas as mapAreas, connection, edgeKey, neighbors, setPlayArea } from '../map';
import { AIRFIELDS, BOX, ETNA, INVASION_CAPABLE, LANDING_ORDER, MESSINA, MUTUAL, PORT_AREA, boxByCode, boxId, isBox, isLandingBox, isPortBox, landingBoxes, portBoxes, portOf, within, zonesOf, area as sarea, type SSide, type Nation, type SBox } from '../sicily/map';
import { reachable, allowanceOf, type SMoveCtx } from '../sicily/move';
import { isArty, isBattleAsset, type Chit } from '../chits';
import { moraleSn, successNumber, type Quality, type Shooter, type Target, type Setting } from '../combat';
import { registerHooks, type Volume } from '../volumes';
import { airOf, blocks, buildFieldWorks, chit, contested, dropReserve, eliminate, inSupply, moraleCheck, needAdmin, other, quality, rollDie, say, secureRandom, saAvailable, sidesOf, spendSA, supplied, unitsIn, updateControl, SEA,
  type Battle, type Game, type Opt, type Opts, type Side, type Unit, type Fire } from '../game';
export { MESSINA, ETNA, isBox, isLandingBox, isPortBox, boxId, BOX, landingBoxes, portBoxes, LANDING_ORDER } from '../sicily/map';

/* ================= the volume's own state ================= */
export type Plan = 'historical' | 'alternate';
export interface SicilyState {
  plan?: Plan; beachheads: Record<number, 'us' | 'british'>;   // landing boxes holding a beachhead marker, by nationality (14.22)
  captured: number[];                                          // beachheads the Axis captured or destroyed: one VP each (19.2)
  released: string[]; usReleased: boolean;                     // divisions released from their zones (14.61); 17.23 US 7th Army Release
  morale: number; moraleCup: number; triggered: string[];      // Fading Italian Morale level (17.21), events put in the cup so far, the ports / areas that triggered one
  moralePick?: Record<string, number>;                         // 17.21c: Italian assets each side must still pick for elimination
  portDamage: Record<string, number>; portWorked: string[];    // damage level of P1-P3 (14.51); ports already worked this Admin Phase
  evacMp?: Record<string, number>;                             // 14.29: MP an Axis unit still has after moving into Messina this phase
  stratUnit?: string;                                          // 14.29: the unit that strat-moved this phase (it may go on to the toe of Italy)
  flankTurn?: number;                                          // 17.22: the turn of the last flanking invasion (one per Admin Phase)
  untriedActed?: string;                                       // 15.3a: the one untried unit that acted this Movement Phase
  strat: Record<string, number>;                               // strat-moves this turn: axis, us, british (14.8)
  extract: boolean; patton: boolean;                           // 17.12 in effect this Movement Phase; 17.11 in effect
  airfieldsTaken: number[]; airfieldHoles: number;             // 16.4: airfields the Allies took; empty Captured Airfields boxes the next Axis air asset fills
  flank: Record<number, string>; cdoUsed: boolean;             // 17.22: flanking invasion assets standing on the map, by area; the 3rd CDO's once per game
  beachAssault: Record<number, number>;                        // 14.27b: areas assaulted from a landing box this phase (box id)
  dropPending: boolean; airborneAreas: number[];               // 14.27a: airborne units still to place; areas just assaulted from the air
  navalShock: Record<string, string>; rangerFw: Record<string, string>;   // 16.21 / 16.22: per battle key, the asset that removes the field works
  sunrise: boolean; sunriseZoneA: number[];
}
export const state = (g: Game) => g.vol as unknown as SicilyState;
const need = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };
const nameOf = (a: number) => mapAreas.get(a)?.name ?? String(a);
const unit = (g: Game, id: string) => { const u = g.units.find((x) => x.id === id); if (!u) throw new Error(`no unit ${id}`); return u; };
const regular = (u: Unit) => !u.garrison;
const nation = (u: Unit): Nation => (u.nation ?? (u.side === 'axis' ? 'italian' : 'us')) as Nation;
const army = (n: Nation) => (n === 'us' ? 'us' : n === 'british' ? 'british' : 'axis');
export const isSunrise = (g: Game) => g.opts.scenario === 'sunrise_bridge';

type RawUnit = { id: string; name: string; side: Side; nation: Nation; echelon: string; symbol?: string; cls?: string; steps?: number; quality_by_step?: Quality[]; division?: string | null; size?: string; kind?: string;
  start_area?: number; start_reserve?: boolean; arrival?: string; arrival_turn?: number; entry?: string[]; motorized?: boolean };
type RawChit = { id: string; ids?: string[]; kind: string; side: Side | 'none'; nation: Nation | null; echelon: string; name: string; turn: number | string | null; quality?: Quality | null; subtype?: string; red_flag?: boolean; flanking_invasion?: string | boolean; division?: string };
type Setup = { name: string; rule: string; turns: number; admin_skipped_turn1: Side[]; units: { id: string; area?: number; box?: string }[]; reserve?: { axis: string[] }; untried: { ids: string[]; areas?: number[] };
  landing_plans?: { historical: PlanDef; alternate: PlanDef }; holding_boxes: Record<string, string[]>; reserve_markers_on_units?: Record<string, string>; available: Record<string, string[]>; port_damage?: Record<string, number>;
  areas_in_play?: number[]; track?: Record<string, Record<string, [number, number]>>; invasion?: { allied: string[]; beachheads: string[] }; zones?: { british: string[]; zone_a_areas: number[] }; supply?: { axis_areas?: number[] };
  reinforcements?: Record<string, Record<string, { units: { id: string; entry: (number | string)[] }[]; chits: string[] }>>; victory: { area_vp?: Record<string, number>; axis_win_at?: number; levels?: { operational: number; marginal: number } };
  historical_option?: { untried_areas: number[]; british_beachheads: string[] } };
type PlanDef = { british: { beachheads: number; consecutive_in?: string[]; boxes?: string[]; zones: string[]; released_zones: string[] }; us: { beachheads: number; consecutive_in?: string[]; boxes?: string[]; zones: string[]; released_zones: string[] } };
const UNITS = unitsJson as unknown as RawUnit[], COUNTERS = countersJson as unknown as RawChit[], SETUPS = setupsJson as unknown as Record<string, Setup>;
const CHIT_KINDS = new Set(['artillery', 'engineer', 'infantry_asset', 'armor_asset', 'air_mission', 'naval_support', 'special_action_event', 'command_staff', 'replacement_inf', 'replacement_arm',
  'event_asset_delayed', 'event_fading_morale', 'event_army_release', 'event_patton_slap', 'event_tactical_extract']);
const SCEN = (g: Game) => SETUPS[g.opts.scenario === 'campaign_hist' ? 'campaign' : g.opts.scenario] ?? SETUPS.tournament;
const PLANS = SETUPS.tournament.landing_plans!;

/* ================= set-up (22.14, 22.24-22.26, 22.37) ================= */
function newSicilyGame(seed: number, opts: Partial<Opts>): Game {
  setPlayArea(null);
  const scenario = ['sunrise_bridge', 'tournament', 'campaign', 'campaign_hist'].includes(opts.scenario ?? '') ? opts.scenario! : 'tournament', S = SETUPS[scenario === 'campaign_hist' ? 'campaign' : scenario];
  const sunrise = scenario === 'sunrise_bridge', hist = scenario === 'campaign_hist';
  const where = new Map(S.units.map((p) => [p.id, p])), fixedUntried = sunrise ? S.untried.areas! : hist ? S.historical_option!.untried_areas : null;
  const inScenario = new Set(S.units.map((p) => p.id)), later = new Map<string, { turn: number; entry: string[] }>();
  for (const [t, sides] of Object.entries(S.reinforcements ?? {})) for (const sd of Object.values(sides)) for (const r of sd.units) later.set(r.id, { turn: +t, entry: r.entry.map((e) => (typeof e === 'number' ? `#${e}` : e)) });
  const untriedIds = sunrise ? S.untried.ids : UNITS.filter((u) => u.kind === 'untried').map((u) => u.id);
  const units: Unit[] = [];
  for (const u of UNITS) {
    if (u.kind === 'special_action_block') continue;
    const p = where.get(u.id), arr = later.get(u.id), untried = u.kind === 'untried';
    if (sunrise && !p && !arr && !untriedIds.includes(u.id)) continue;                                   // Sunrise Bridge: only the Scenario Forces sheet
    const max = u.steps ?? 1;
    const x: Unit = { id: u.id, name: u.name, side: u.side, nation: u.nation, cls: (u.cls ?? 'infantry') as 'armor' | 'infantry', q: (u.quality_by_step ?? ['green']).map((q) => q ?? 'green'), max, str: max, area: null,
      disorder: 0, unsupplied: false, moved: false, reserve: null, exploit: false, ech: u.echelon, symbol: u.symbol, division: u.division ?? undefined, motorized: u.motorized || undefined, untried: untried || undefined, code: u.start_area != null ? String(u.start_area) : u.arrival === 'invasion' ? 'Inv' : untried ? 'S*' : u.arrival_turn ? String(u.arrival_turn) : '' };
    if (p?.area != null) x.area = p.area;
    else if (untried) x.box = 'deploy';
    else if (p?.box === 'airborne_assault' || (u.arrival === 'invasion' && u.symbol === 'airborne')) x.box = 'airborne_assault';
    else if (p?.box === 'at_sea' || u.arrival === 'invasion') x.box = 'deploy';                           // the invasion units: placed on the beachheads once the landing plan is chosen
    else if (arr) { x.arrival = arr.turn; x.entry = arr.entry; }
    else if (!sunrise && u.arrival_turn) { x.arrival = u.arrival_turn; x.entry = u.entry; }
    else if (!sunrise) continue;
    if (!sunrise || p || arr || untriedIds.includes(u.id)) units.push(x);
  }
  const lastTurn = S.turns;
  const avail = new Set([...(S.available.allied ?? []), ...(S.available.axis ?? [])]), hold = S.holding_boxes;
  const laterChit = new Map<string, number>(); for (const [t, sides] of Object.entries(S.reinforcements ?? {})) for (const sd of Object.values(sides)) for (const id of sd.chits) laterChit.set(id, +t);
  const chits: Chit[] = [];
  for (const c of COUNTERS) {
    if (!CHIT_KINDS.has(c.kind) || c.side === 'none') continue;
    for (const id of c.ids?.length ? c.ids : [c.id]) {
      let box: Chit['box'], turn: number | string | null = c.turn;
      if (avail.has(id)) { box = 'available'; turn = 'S'; }
      else if (hold.captured_airfields?.includes(id)) box = 'captured_airfields';
      else if (hold.captured_ports_vp?.includes(id)) box = 'captured_ports_vp';
      else if (sunrise) { if (!laterChit.has(id)) continue; box = 'future'; turn = laterChit.get(id)!; }
      else if (typeof c.turn === 'number' && c.turn <= lastTurn) box = 'future';
      else continue;
      chits.push({ id, counter: c.id, name: c.name, kind: c.kind, side: c.side, ech: c.echelon, q: c.quality ?? undefined, turn, box, division: c.division, subtype: c.subtype, nation: c.nation ?? undefined, strategic: c.red_flag || undefined,
        flank: c.flanking_invasion ? (c.flanking_invasion === 'once_per_game' ? 'once' : 'each') : undefined });
    }
  }
  for (const u of UNITS.filter((x) => x.kind === 'special_action_block')) chits.push({ id: u.id, counter: u.id, name: 'Special Action (reusable)', kind: 'sa_block', side: u.side, ech: u.side, turn: 2, box: 'future', nation: u.nation });   // 8.1, from turn 2
  const control: Record<number, Side> = {};
  for (const a of mapAreas.keys()) if (!isBox(a) && (!S.areas_in_play || S.areas_in_play.includes(a))) control[a] = 'axis';   // 22.13, 22.23: all land areas start Axis-controlled
  const vol: SicilyState = { beachheads: {}, captured: [], released: [], usReleased: false, morale: 0, moraleCup: 0, triggered: [], portDamage: { P1: 0, P2: 0, P3: 0 }, portWorked: [], strat: {}, extract: false, patton: false,
    airfieldsTaken: [], airfieldHoles: 0, flank: {}, cdoUsed: false, beachAssault: {}, dropPending: false, airborneAreas: [], navalShock: {}, rangerFw: {}, sunrise, sunriseZoneA: S.zones?.zone_a_areas ?? [] };
  const res = (ids: string[] | undefined) => ids?.length ?? 0;
  const markers = { allied: { us: res(hold.allied_reserve_markers?.filter((m) => m.startsWith('M01'))), br: res(hold.allied_reserve_markers?.filter((m) => m.startsWith('M02'))) }, axis: { res: res(hold.axis_reserve_markers) + Object.keys(S.reserve_markers_on_units ?? {}).length } };
  const g: Game = { game: 'sicily', sides: ['allied', 'axis'], turn: 1, lastTurn, phasing: 'axis', phase: 'deploy', units, chits, control, fieldWorks: [], fwOwner: {}, riverAssault: [], blown: [],
    contestedAtMoveStart: [], fought: [], markers, stratMoves: 0, riverCross: [], blowTried: [], entered: {}, pendingBlow: null, greif: {}, greifTried: [], fwBuilt: [], tfNew: [],
    elimLarge: [], captured: [], fuelAdded: false, opts: { ...opts, scenario, fuel: false }, roadblocks: {}, interdicted: {}, pooled: null, airSupply: null, revealed: null, arrived: [], pendingArrivals: [], recover: [], battle: null, seed, rolls: 0, log: [],
    vol: vol as unknown as Record<string, unknown> };
  for (const id of S.reserve?.axis ?? []) { const u = g.units.find((x) => x.id === id); if (u) { u.reserve = 'res'; g.markers.axis.res--; } }         // 25R: the 15th PG starts in reserve
  if (S.areas_in_play) { g.inPlay = [...S.areas_in_play, ...(S.invasion?.beachheads ?? []).map(boxId), boxId('P1'), boxId('P2')]; setPlayArea(g.inPlay); }
  if (S.track) g.track = Object.keys(S.track).sort((a, b) => +a - +b).map((k) => ({ ge: S.track![k].allied, al: S.track![k].axis, sd: null }));
  if (fixedUntried) autoUntried(g, fixedUntried);                                                     // 22.14, 22.37: the garrisons go where the scenario says, still shuffled
  if (sunrise) { choosePlan(g, 'historical', 'B1'); }                                                  // 22.14: the five British beachheads are B1-B5
  else if (hist) choosePlan(g, 'historical', 'B1');                                                   // 22.37: the historical landing plan, B1-B5
  say(g, sunrise ? 'Sunrise Bridge: the Axis garrisons are shuffled face down into areas 1-7, 13, 14 and 26; the British land at B1-B5. Place the invasion units on the beachheads, then the Allied Movement Phase of turn 1.'
    : `${S.name}: the Axis places its ${untriedIds.length} untried garrisons face down, one per area; the Allies then choose a landing plan, place the beachheads and the invasion units; then the Allied Movement Phase of turn 1 (the Admin Phase is skipped, 22.27).`);
  return g;
}
/** A seeded shuffle that spends no dice (the set-up must not change the game's rolls; online, not from the shared seed). */
const shuffled = <T,>(g: Game, xs: T[], salt: number) => { const sr = secureRandom(); let h = ((sr == null ? g.seed : Math.floor(sr * 2 ** 32)) ^ salt) >>> 0; const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** 15.3: the untried garrisons go face down at random, one per listed area. */
function autoUntried(g: Game, areas: number[]) {
  const pool = shuffled(g, g.units.filter((u) => u.untried && u.box === 'deploy'), 11);
  for (const a of shuffled(g, areas, 13)) { const u = pool.shift(); if (!u) break; u.box = undefined; u.area = a; }
}
/** The areas an untried garrison may still be placed in (22.24: anywhere, one per area, not with two tried units), or a beachhead box for an invasion unit. */
export function deployOptions(g: Game, unitId: string): number[] {
  const u = unit(g, unitId); if (g.phase !== 'deploy' || u.box !== 'deploy') return [];
  if (u.untried) return [...mapAreas.keys()].filter((a) => !isBox(a) && (!g.inPlay || g.inPlay.includes(a)) && !unitsIn(g, a).some((x) => x.untried) && unitsIn(g, a, 'axis').filter((x) => !x.untried).length < 2);
  const V = state(g); if (!V.plan) return [];
  return Object.keys(V.beachheads).map(Number).filter((b) => V.beachheads[b] === nation(u) && unitsIn(g, b).length < 2);     // 14.24: two units per box
}
export function deploy(g: Game, unitId: string, a: number) {
  need(deployOptions(g, unitId).includes(a), 'not a set-up area for this unit');
  const u = unit(g, unitId); u.box = undefined; u.area = a; if (!isBox(a)) updateControl(g, a);
}
/** The quick set-up: the garrisons at random, the historical plan from B1, the invasion units two per beachhead. */
export function autoDeploy(g: Game) {
  need(g.phase === 'deploy', 'only while setting up');
  autoGarrisons(g);
  if (!state(g).plan) choosePlan(g, 'historical', 'B1', 'D1');
  autoLanding(g);
}
/** 22.24: the Axis garrisons still to place go at random (one per area, never with two tried units). */
export function autoGarrisons(g: Game) {
  for (const u of shuffled(g, g.units.filter((x) => x.untried && x.box === 'deploy'), 17)) { const o = deployOptions(g, u.id); if (o.length) deploy(g, u.id, shuffled(g, o, u.id.charCodeAt(2) + u.id.charCodeAt(3))[0]); }
}
/** 14.24: the invasion units still to place go two per beachhead of their nationality. */
export function autoLanding(g: Game) {
  for (const u of g.units.filter((x) => x.box === 'deploy' && !x.untried)) { const o = deployOptions(g, u.id); if (o.length) deploy(g, u.id, o[0]); }
}
/** 22.25 / 22.26: the landing plan. `british` is the first of the five consecutive British boxes, `us` the first of the four US boxes (alternate plan only). */
export function planOptions(g: Game, plan: Plan): { british: string[]; us: string[] } {
  if (isSunrise(g) || g.opts.scenario === 'campaign_hist') return { british: ['B1'], us: [] };
  const def = PLANS[plan], starts = (d: { consecutive_in?: string[]; beachheads: number }) => (d.consecutive_in ?? []).slice(0, (d.consecutive_in?.length ?? 0) - d.beachheads + 1);
  return { british: starts(def.british), us: def.us.consecutive_in ? starts(def.us) : [] };
}
export function choosePlan(g: Game, plan: Plan, british: string, us?: string) {
  need(g.phase === 'deploy' && !state(g).plan, 'the landing plan is chosen once, while setting up');
  need(!g.units.some((u) => u.untried && u.box === 'deploy'), 'the Axis places its garrisons first (22.24)');
  const o = planOptions(g, plan); need(o.british.includes(british), 'not a legal first British landing box');
  const V = state(g), def = PLANS[plan], S = SCEN(g);
  const seq = (list: string[], first: string, n: number) => list.slice(list.indexOf(first), list.indexOf(first) + n);
  const br = isSunrise(g) ? S.invasion!.beachheads : seq(def.british.consecutive_in!, british, def.british.beachheads);
  let usb: string[] = [];
  if (!isSunrise(g)) { if (def.us.boxes) usb = def.us.boxes; else { need(us && o.us.includes(us), 'not a legal first American landing box'); usb = seq(def.us.consecutive_in!, us!, def.us.beachheads); } }
  V.plan = plan; V.beachheads = {};
  for (const b of br) { V.beachheads[boxId(b)] = 'british'; g.control[boxId(b)] = 'allied'; }
  for (const b of usb) { V.beachheads[boxId(b)] = 'us'; g.control[boxId(b)] = 'allied'; }
  placeFieldWorks(g);
  say(g, `${plan === 'historical' ? 'Historical' : 'Alternate'} landing plan: British beachheads ${br.join(', ')}${usb.length ? `, American beachheads ${usb.join(', ')}` : ''} (${plan === 'historical' ? '22.25' : '22.26'})`, 'allied');
}
/** 22.14, 22.24: once the Axis set-up is done, a field works marker on each invasion-capable coastal area holding an Axis unit. */
function placeFieldWorks(g: Game) {
  for (const a of INVASION_CAPABLE) if ((!g.inPlay || g.inPlay.includes(a)) && unitsIn(g, a, 'axis').length && !g.fieldWorks.includes(a)) { g.fieldWorks.push(a); g.fwOwner[a] = 'axis'; }
}
function onDeployEnd(g: Game) {
  need(!g.units.some((u) => u.untried && u.box === 'deploy'), 'place every Axis garrison first (22.24)');
  need(!!state(g).plan, 'choose the Allied landing plan first (22.24)');
  need(!g.units.some((u) => u.box === 'deploy'), 'place every invasion unit on a beachhead first (14.24)');
}
/** End of the set-up: the Allied Operational Movement Phase of turn 1 (the Admin Phase is skipped, 22.27). */
function afterDeploy(g: Game) {
  g.phase = 'movement'; g.phasing = 'allied'; g.units.forEach((u) => { u.moved = false; u.spent = 0; }); g.contestedAtMoveStart = []; g.stratMoves = 0; onPhase(g, 'movement', 'start'); return true;
}

/* ================= zones and releases (14.3, 14.4, 14.61, 17.23) ================= */
/** The army zones a unit may operate in: its landing plan's zones, more once its division is released. Axis units and units with no plan: no restriction. */
export function allowedZones(g: Game, u: Unit): Set<string> | undefined {
  if (u.side !== 'allied') return undefined;
  const V = state(g), n = nation(u) as 'us' | 'british';
  if (V.sunrise) return isReleased(g, u) ? new Set(['A', 'B']) : new Set(['B']);
  const plan = PLANS[V.plan ?? 'historical'][n];
  return new Set(isReleased(g, u) ? plan.released_zones : plan.zones);
}
export const isReleased = (g: Game, u: Unit) => { const V = state(g); return (nation(u) === 'us' && V.usReleased) || (!!u.division && V.released.includes(u.division)); };
/** The zones of an area (Messina is in B and C, 14.41); in Sunrise Bridge the scenario's own zone A and the rest as B. */
const zonesAt = (g: Game, a: number) => (state(g).sunrise ? [state(g).sunriseZoneA.includes(a) ? 'A' : 'B'] : zonesOf(a));
export const zoneOk = (g: Game, u: Unit, a: number) => { const z = allowedZones(g, u); return !z || isBox(a) || zonesAt(g, a).some((x) => z.has(x)); };
/** 14.61: release a division (and, for the British, one independent brigade with it) by a Special Action of its own army. */
export function releaseDivision(g: Game, division: string, chitId?: string, brigade?: string) {
  needAdmin(g); const V = state(g), us = g.units.filter((u) => u.side === 'allied' && u.division === division && regular(u)); need(us.length, 'no such division');
  need(!isReleased(g, us[0]), `${us[0].name} is already released`);
  const n = nation(us[0]); need(n === 'us' || n === 'british', 'an Allied division');
  if (brigade) { need(n === 'british' && ['br_1st_cdn_arm', 'br_4th_arm', 'br_231st'].includes(brigade) && !V.released.includes(brigade), 'one of the three independent British brigades, not yet released (14.61)'); }
  spendSA(g, 'allied', us[0].ech, `release the ${us[0].name} division from its army boundaries (14.61)`, chitId);
  V.released.push(division); if (brigade) V.released.push(brigade);
  say(g, `${us[0].name}${brigade ? ` and the ${g.units.find((u) => u.division === brigade)?.name ?? brigade}` : ''} released: may operate in zones ${[...allowedZones(g, us[0])!].join(', ')}`, 'allied');
}
/** 17.23 US 7th Army Release: every American division is released. */
export function playArmyRelease(g: Game, chitId: string) {
  needAdmin(g); const c = avail(g, chitId, ['event_army_release']); gone(c); state(g).usReleased = true; say(g, 'US 7th Army Release: all American divisions may now operate beyond their original zones, never zone B (17.23)', 'allied');
}

/* ================= movement (14.1, 14.24-14.26, 14.29, 14.4, 15.1, 15.3, 16.33, 17.12) ================= */
const interdictedBy = (g: Game, a: number): Side | undefined => { const id = g.interdicted[a]; return id ? chit(g, id).side : undefined; };
const etnaFree = (g: Game): SSide | undefined => (contested(g, ETNA) ? undefined : (g.control[ETNA] as SSide | undefined));
function moveCtx(g: Game): SMoveCtx {
  const count = (a: number): Record<SSide, number> => ({ allied: unitsIn(g, a, 'allied').length, axis: unitsIn(g, a, 'axis').length });
  return { units: count, controller: (a) => g.control[a] as SSide | undefined, blownBridges: new Set(g.blown), interdicted: (a) => interdictedBy(g, a) as SSide | undefined,
    untriedOnly: (a) => unitsIn(g, a).length > 0 && unitsIn(g, a).every((u) => u.untried), etnaFree: etnaFree(g), etnaCtl: g.control[ETNA] as SSide | undefined, contestedAtStart: new Set(g.contestedAtMoveStart) };
}
function sicilyReach(g: Game, u: Unit, one: boolean): Opt[] {
  const V = state(g), a = u.area!;
  const opt = (r: { area: number; cost: number; path: number[]; mustStop: boolean }): Opt => ({ area: r.area, cost: r.cost, fuel: false, mustStop: r.mustStop, path: r.path });
  if (isLandingBox(a)) {                                                                               // 14.26: a landing takes the whole allowance; never in a Breakthrough phase
    if (one || g.phase !== 'movement') return []; const box = BOX.get(a)!;
    return [opt({ area: box.area, cost: allowanceOf(u), path: [a, box.area], mustStop: true })];
  }
  if (isPortBox(a)) {                                                                                  // 14.26: ashore in the port, then a normal move
    const box = BOX.get(a)!; if (one || unitsIn(g, box.area, other(u.side)).length) return [];
    const from = reachable({ side: u.side as SSide, cls: u.cls, area: box.area, supplied: true, disordered: u.disorder > 0, motorized: u.motorized, allowed: allowedZones(g, u) }, moveCtx(g));
    return [opt({ area: box.area, cost: 0, path: [a, box.area], mustStop: false }), ...from.map((r) => opt({ ...r, path: [a, ...r.path] }))];
  }
  const r = reachable({ side: u.side as SSide, cls: u.cls, area: a, supplied: !u.unsupplied, disordered: u.disorder > 0, adjacentOnly: one || !!u.adjOnly, spent: u.spent, motorized: u.motorized, untried: u.untried, leftContested: g.moving?.id === u.id && g.moving.left,
    allowed: allowedZones(g, u), extract: V.extract && nation(u) === 'german' && contested(g, a) }, moveCtx(g));
  return r.map(opt);
}
/** 15.3a: only one untried garrison may act in each Operational Movement Phase. */
const untriedFree = (g: Game, u: Unit) => !u.untried || g.phase !== 'movement' || !state(g).untriedActed || state(g).untriedActed === u.id;
function moveOk(g: Game, u: Unit, a: number) { return !isBox(a) && untriedFree(g, u); }
function afterMove(g: Game, u: Unit, opt: Opt) {
  const V = state(g), from = opt.path[0], to = opt.area;
  if (u.untried) V.untriedActed = u.id;
  if (u.side === 'axis' && to === MESSINA && !isBox(from)) (V.evacMp ??= {})[u.id] = allowanceOf(u) - opt.cost;   // 14.29: what is left to evacuate with
  if (isLandingBox(from) && unitsIn(g, to, 'axis').length && !g.contestedAtMoveStart.includes(to)) V.beachAssault[to] = from;   // 14.27b; into a contested area it is ordinary combat (14.26)
  if (V.extract && nation(u) === 'german' && g.contestedAtMoveStart.includes(from)) { u.disorder = 2; say(g, `${u.name} extracts to ${nameOf(to)} and is recovering (17.12)`); }
  if (u.side === 'allied' && V.flank[to]) relieveFlank(g, to);
}
/** 14.24b: the units that could not land this Movement Phase go to the At Sea box. */
function toSea(g: Game, u: Unit, why: string) { const from = u.area; u.area = null; u.box = 'at_sea'; u.moved = false; dropReserve(g, u); if (from != null) updateControl(g, from); say(g, `${u.name} goes back to sea (${why})`, u.side); }
const inBoxes = (g: Game, side: Side, f: (a: number) => boolean) => g.units.filter((u) => u.side === side && u.area != null && f(u.area));
/** 14.29: an Axis unit in Messina leaves for the mainland, for good (one MP; or its strat-move). */
export function canEvacuate(g: Game, u: Unit) {
  return u.side === 'axis' && u.area === MESSINA && !state(g).sunrise && g.phasing === 'axis' && regular(u) && ((g.phase === 'movement' && !u.untried && (!u.moved || (state(g).evacMp?.[u.id] ?? 0) >= 1)) || (g.phase === 'strategic' && ((!!u.reserve && !u.moved && stratAllowed(g, u)) || (u.moved && state(g).stratUnit === u.id))));
}
export function evacuate(g: Game, unitId: string) {
  const u = unit(g, unitId); need(canEvacuate(g, u), 'only an Axis unit in Messina, in its Movement Phase (or a reserve unit by strat-move), may evacuate (14.29)');
  if (g.phase === 'strategic' && !u.moved) afterStrat(g, u);
  u.area = null; u.box = 'evacuated'; u.moved = true; dropReserve(g, u); updateControl(g, MESSINA); say(g, `${u.name} evacuates to the Italian mainland (14.29)`, 'axis');
}
/** 14.8: the Axis strat-moves one unit a turn, the Allies one American and one British; never out of a landing box; not from an interdicted area. */
function stratAllowed(g: Game, u: Unit) {
  const V = state(g), k = army(nation(u)); if (isLandingBox(u.area!)) return false;
  if (isPortBox(u.area!) && contested(g, BOX.get(u.area!)!.area)) return false;                       // 14.24c
  if (interdictedBy(g, u.area!) === other(u.side)) return false;
  return (V.strat[k] ?? 0) < 1;
}
function stratStep(g: Game, u: Unit, a: number, n: number): boolean | 'end' {
  const c = connection(a, n)!; if (isBox(n) || c.restricted) return false;
  if (!zoneOk(g, u, n)) return false;                                                                 // 14.82: only released units cross their army boundaries
  if (interdictedBy(g, n) === other(u.side)) return false;                                            // 16.33
  return true;
}
function afterStrat(g: Game, u: Unit) { const V = state(g), k = army(nation(u)); V.strat[k] = (V.strat[k] ?? 0) + 1; V.stratUnit = u.id; }

/* ================= arrivals (14.24, 14.25), airborne assault (14.27a), the At Sea box (14.24b, 14.28) ================= */
const portOpen = (g: Game, p: SBox, side: Side) => g.control[p.area] === side && !contested(g, p.area) && (p.box === 'P4' || (state(g).portDamage[p.box] ?? 0) === 0) && (!g.inPlay || g.inPlay.includes(p.id));
/** The boxes a unit may arrive in now (14.25). */
export function entryBoxes(g: Game, u: Unit): number[] {
  const V = state(g), n = nation(u);
  if (u.side === 'axis') { if (u.entry?.some((e) => e.startsWith('#'))) return u.entry.map((e) => +e.slice(1)); const p = boxByCode('P4'); return portOpen(g, p, 'axis') ? [p.id] : []; }
  const bh = Object.keys(V.beachheads).map(Number).filter((b) => V.beachheads[b] === n);
  const ports = portBoxes.filter((p) => p.nation === n && portOpen(g, p, 'allied')).map((p) => p.id);
  return [...bh, ...ports];
}
function syncPortBoxes(g: Game) { for (const p of portBoxes) { const c = g.control[p.area]; if (c) g.control[p.id] = c; else delete g.control[p.id]; } }
/** 16.21: the fleet withdraws one Naval Support asset from the Used Box, after the unused reusable Special Action had its chance to save it (Example 2A). */
function beforeRecycle(g: Game, side: Side) {
  if (side === 'allied' && g.phase === 'reinforcement') { const nav = g.chits.find((c) => c.kind === 'naval_support' && c.box === 'used'); if (nav) { nav.box = 'eliminated'; say(g, `${nav.name} withdraws: eliminated from the Used Box (16.21)`, side); } }
  return false;
}
function reinforce(g: Game, side: Side) {
  const V = state(g); syncPortBoxes(g); V.strat = {};
  for (const u of g.units.filter((x) => x.side === side && x.box === 'at_sea')) { u.box = undefined; u.arrival = g.turn; say(g, `${u.name} tries to land again (14.24b)`, side); }
  for (const u of g.units.filter((x) => x.side === side && x.arrival === g.turn && x.area == null && x.str > 0 && !x.box)) {
    if (u.symbol === 'airborne') { u.box = 'airborne_assault'; u.arrival = undefined; g.arrived.push(u.id); say(g, `${u.name} waits in the Airborne Assault box (14.24)`, side); continue; }
    u.entry = entryBoxes(g, u).map((b) => `#${b}`);
  }
}
/** 14.27a: where an airborne unit may drop: an area adjacent to at least two areas holding units of its army, with room. */
export function airDropTargets(g: Game, unitId: string): number[] {
  const u = unit(g, unitId); if (u.box !== 'airborne_assault' || g.phase !== 'combat' || g.phasing !== 'allied') return [];
  const n = nation(u), mine = (a: number) => unitsIn(g, a, 'allied').some((x) => nation(x) === n && regular(x));
  return [...mapAreas.keys()].filter((a) => !isBox(a) && (!g.inPlay || g.inPlay.includes(a)) && neighbors(a).filter((x) => !isBox(x) && mine(x)).length >= 2 && blocks(g, a, 'allied').length < 2);
}
export function airDrop(g: Game, unitId: string, a: number | null) {
  const u = unit(g, unitId), V = state(g), t = airDropTargets(g, unitId);
  need(u.box === 'airborne_assault' && g.phase === 'combat' && g.phasing === 'allied' && !g.fought.length && !g.battle, 'airborne units drop at the start of the Allied Combat Phase (14.27a)');
  if (a == null || !t.length) { need(!t.length, 'that unit can drop somewhere'); u.box = undefined; eliminate(g, u); say(g, `${u.name} has no drop zone and is eliminated (14.27a)`, 'allied'); }
  else { need(t.includes(a), 'not a legal drop zone'); u.box = undefined; u.area = a; u.moved = true; if (unitsIn(g, a, 'axis').length) { if (!g.riverAssault.includes(a)) g.riverAssault.push(a); V.airborneAreas.push(a); } updateControl(g, a); say(g, `${u.name} drops into ${nameOf(a)} (14.27a)`, 'allied'); }
  V.dropPending = g.units.some((x) => x.box === 'airborne_assault' && x.side === 'allied');
}
/** The drops done at once: each unit to its first drop zone, or lost. */
export function autoAirDrop(g: Game) { for (const u of g.units.filter((x) => x.box === 'airborne_assault' && x.side === 'allied')) { const t = airDropTargets(g, u.id); airDrop(g, u.id, t[0] ?? null); } }
/** 14.28: an Allied unit in a coastal area connected to a live beachhead may retreat to sea when nothing else is open. */
const seaRetreat = (g: Game, u: Unit, from: number) => u.side === 'allied' && !isBox(from) && landingBoxes.some((b) => b.area === from && state(g).beachheads[b.id] != null);

/* ================= phases ================= */
function onPhase(g: Game, phase: string, when: 'start' | 'mid' | 'end') {
  const V = state(g);
  if (phase === 'deploy' && when === 'end') onDeployEnd(g);
  if (when === 'start') { syncPortBoxes(g); V.portWorked = []; }
  if (phase === 'movement' && when === 'start') { V.untriedActed = undefined; V.beachAssault = {}; V.evacMp = {}; }
  if (phase === 'strategic' && when === 'start') V.stratUnit = undefined;
  if (phase === 'movement' && when === 'end') {
    for (const u of inBoxes(g, g.phasing, isLandingBox)) toSea(g, u, 'could not land, 14.24b');
    if (g.phasing === 'allied') for (const u of inBoxes(g, g.phasing, isPortBox).filter((x) => !x.reserve)) toSea(g, u, 'could not land, 14.24b');   // the At Sea box is the Allies' (14.24b)
    V.extract = false;
  }
  if (phase === 'btMove' && when === 'end' && g.phasing === 'allied') for (const u of inBoxes(g, g.phasing, isPortBox)) { const a = BOX.get(u.area!)!.area; if (!unitsIn(g, a, 'axis').length && blocks(g, a, 'allied').length < 2) { u.area = a; dropReserve(g, u); say(g, `${u.name} lands in ${nameOf(a)} (14.24c)`); } else toSea(g, u, 'the port is full, 14.24c'); }
  if (phase === 'combat' && when === 'start') { V.dropPending = g.phasing === 'allied' && g.units.some((u) => u.box === 'airborne_assault' && u.side === 'allied'); V.airborneAreas = []; }
  if (phase === 'combat' && when === 'end') { need(!V.dropPending, 'place the airborne units first (14.27a)'); V.airborneAreas = []; V.beachAssault = {}; }
  if (phase === 'admin' && when === 'end') need(!V.moralePick || !Object.values(V.moralePick).some((n) => n > 0), 'pick the Italian assets eliminated by Fading Italian Morale first (17.21c)');
  if (phase === 'admin' && when === 'end') need(!Object.keys(V.flank).some((a) => battleAllowed(g, +a) && contested(g, +a) && !g.fought.includes(+a)), 'the flanking invasion landed on defenders: fight its round of combat first (17.22)');
  if (phase === 'reinforcement' && when === 'start') afterChange(g);                               // 14.22: a beachhead lost in the other player's turn is gone before the arrivals
  if (phase === 'supply' && when === 'mid') {
    for (const u of g.units.filter((x) => x.untried && x.side === g.phasing && x.area != null && x.unsupplied)) {   /* only when its own OOS morale check is due */ say(g, `${u.name} is out of supply: untried units are eliminated instead of checking morale (15.3c)`); eliminate(g, u); }
    for (const c of g.chits) if (c.mission === 'interdiction' && c.box === 'map') { c.box = 'used'; if (c.area != null) delete g.interdicted[c.area]; c.area = undefined; c.mission = undefined; }   // 16.33: to the Supply Phase of the same player turn
  }
  if (phase === 'supply' && when === 'end' && g.airSupply) { chit(g, g.airSupply.id).box = 'used'; g.airSupply = null; }   // 16.34: to the Used Box at the end of that Supply Phase
  if (when === 'end') afterChange(g);
}
/** What control changes trigger: lost beachheads (14.22), captured airfields (16.4), Fading Italian Morale (17.21a). */
function afterChange(g: Game) {
  const V = state(g);
  if (g.turn >= 2) for (const b of Object.keys(V.beachheads).map(Number)) { const a = BOX.get(b)!.area; if (g.control[a] === 'axis' && !contested(g, a)) captureBeachhead(g, b, 'destroyed: its coastal area is Axis-controlled (14.22)'); }
  for (const a of AIRFIELDS) if (g.control[a] === 'allied' && !V.airfieldsTaken.includes(a) && (!g.inPlay || g.inPlay.includes(a))) {
    V.airfieldsTaken.push(a); const c = g.chits.find((x) => x.box === 'captured_airfields'); if (c) { c.box = 'cup'; V.airfieldHoles++; say(g, `The ${nameOf(a)} airfield is captured: a conditional Air Support asset goes into the Allied cup; the next Axis Air Support drawn fills the empty box (16.4)`, 'allied'); }
  }
  if (V.sunrise) return;
  for (const a of MUTUAL) if (g.control[a] === 'allied' && !V.triggered.includes(`vp${a}`)) { V.triggered.push(`vp${a}`); moraleTrigger(g, `${nameOf(a)} captured`); }
  for (const p of portBoxes) if (p.box !== 'P4' && g.control[p.area] === 'allied' && V.portDamage[p.box] === 0 && !V.triggered.includes(p.box))   /* the three Sicilian ports (Example 10), not Messina */ { V.triggered.push(p.box); moraleTrigger(g, `the port of ${p.name} is Allied and undamaged`); }
}
function captureBeachhead(g: Game, b: number, why: string) {
  const V = state(g); delete V.beachheads[b]; V.captured.push(b); delete g.control[b];
  for (const u of unitsIn(g, b)) toSea(g, u, 'the beachhead is lost');
  say(g, `Beachhead ${BOX.get(b)!.box} ${why}: one VP to the Axis (19.2)`, 'axis');
}
function moraleTrigger(g: Game, why: string) {
  const V = state(g), c = g.chits.find((x) => x.box === 'captured_ports_vp'); if (!c) return;
  c.box = 'cup'; V.moraleCup++; say(g, `${why}: a Fading Italian Morale event goes into the Allied cup (17.21a)`, 'allied');
}
/** The Reinforcement Phase draw rule of 17.32 is in the series draw; 16.4: an Axis air asset just drawn fills an empty Captured Airfields box. */
function afterDraw(g: Game) {
  const V = state(g); if (!V.airfieldHoles) return;
  const stamp = g.turn * 10 + (g.phasing === 'allied' ? 1 : 2);
  for (const c of g.chits.filter((x) => x.kind === 'air_mission' && x.side === 'axis' && x.box === 'available' && x.drawn === stamp)) { if (!V.airfieldHoles) break; c.box = 'captured_airfields'; V.airfieldHoles--; say(g, `${c.name} fills the empty Captured Airfields box (16.4)`, 'axis'); }
}
/** 16.5: one extra Allied draw per undamaged Sicilian port the Allies control and occupy. */
const extraDraws = (g: Game, side: Side) => (side !== 'allied' || state(g).sunrise ? 0 : portBoxes.filter((p) => g.control[p.area] === 'allied' && unitsIn(g, p.area, 'allied').some(regular) && p.box !== 'P4' && state(g).portDamage[p.box] === 0).length);   // 16.5: Syracuse, Catania, Palermo only

/* ================= supply (14.9) and victory (19.x) ================= */
let NATION_FILTER: Nation | null = null;
function sources(g: Game, side: Side): Set<number> {
  const V = state(g);
  if (side === 'axis') return new Set(V.sunrise ? SCEN(g).supply?.axis_areas ?? [] : [MESSINA]);
  const bh = Object.keys(V.beachheads).map(Number).filter((b) => !NATION_FILTER || V.beachheads[b] === NATION_FILTER);
  const ports = portBoxes.filter((p) => (p.box === 'P4' || V.portDamage[p.box] === 0) && (!g.inPlay || g.inPlay.includes(p.area))).map((p) => p.area);
  return new Set([...bh, ...ports]);
}
function supplyStep(g: Game, _side: Side, a: number, n: number, first: boolean) {
  if (isBox(a) && !first) return false;                                                               // a path never runs through a box
  if (isPortBox(n)) return false;
  const c = connection(a, n)!;
  return !(c.river && g.blown.includes(edgeKey(a, n)) && !first);                                     // 9.31a
}
/** 14.92: an Allied unit traces to a beachhead of its own nationality or any friendly undamaged port. */
function unitSupply(g: Game, u: Unit) {
  if (u.side === 'axis') return inSupply(g, 'axis', u.area!);
  NATION_FILTER = nation(u); try { return inSupply(g, 'allied', u.area!); } finally { NATION_FILTER = null; }
}
function sicilyVictory(g: Game): Record<Side, number> & { net: number } {
  const V = state(g), S = SCEN(g), pts: Record<Side, number> = { allied: 0, axis: 0 };
  if (V.sunrise) {
    for (const [a, v] of Object.entries(S.victory.area_vp ?? {})) { const c = g.control[+a]; if (c) pts[c] += v; }                                                  // 22.17: control, contested or not
    return { ...pts, net: pts.allied - pts.axis };
  }
  for (const a of mapAreas.values()) {
    if (isBox(a.id)) continue; const c = g.control[a.id]; if (!c || !inSupply(g, c, a.id)) continue;
    if (c === 'allied' && unitsIn(g, a.id, 'allied').some(regular)) pts.allied += a.vp.allied + (a.vp.mutual ? 1 : 0);     // 19.1: crosses and yellow stars, occupied
    if (c === 'axis') pts.axis += a.vp.german + (a.vp.mutual ? 1 : 0);                                                    // white and yellow stars
  }
  for (const id of g.elimLarge) { const u = g.units.find((x) => x.id === id)!; pts[other(u.side)]++; }                   // 19.2
  pts.axis += V.captured.length;
  return { ...pts, net: pts.allied - pts.axis };
}
function finalResult(g: Game, net: number) {
  const S = SCEN(g); if (state(g).sunrise) return net > 0 ? `Allied Victory (${net} net VP, 22.17)` : net < 0 ? `Axis Victory (${-net} net VP, 22.17)` : 'Draw (22.17)';
  if (S.victory.axis_win_at != null) return -net >= S.victory.axis_win_at ? `Axis Victory (Axis ahead by ${-net} VP, 22.28)` : `Allied Victory (${net >= 0 ? `Allies ahead by ${net}` : `Axis ahead by only ${-net}`} VP, 22.28)`;   // 19.3: the VP level
  const n = Math.abs(net); if (!n) return 'Draw (22.38)';
  return `${net > 0 ? 'Allied' : 'Axis'} ${n >= (S.victory.levels?.operational ?? 4) ? 'Operational' : 'Marginal'} Victory (${n} net VP, 22.38)`;
}

/* ================= combat (14.27, 15.2, 15.3b, 16.11, 16.2x, 16.3, 17.21d-f) ================= */
export interface SicilyBattle { flank?: boolean; noAir: Partial<Record<Side, boolean>>; airborne?: string }
export const battleState = (b: Battle) => (b.vol ??= { noAir: {} }) as unknown as SicilyBattle;
const sicilySn = (s: Shooter, t: Target, c: Setting) => successNumber(s, t, c);
const sicilyMoraleSn = (g: Game, u: Unit, why: 'exploit' | 'supply' | 'check') => moraleSn(quality(u), u.disorder > 0, (why === 'supply' || u.unsupplied) && !(g.opts.airborne && u.symbol === 'airborne'));   // 18.1
/** 14.27: any assault from a landing box or the air is a River Assault; otherwise the series river rule. */
function assault(g: Game, area: number, entered: { id: string; river: boolean; blown: boolean }[]) {
  const V = state(g); if (V.beachAssault[area] != null || V.airborneAreas.includes(area)) return true;
  const att = blocks(g, area, g.phasing); return att.length > 0 && att.every((u) => entered.some((e) => e.id === u.id && e.river)) && entered.some((e) => e.blown);
}
function canAssign(g: Game, b: Battle, side: Side, c: Chit, mode?: 'arty' | 'support'): string | null {
  const B = battleState(b), V = state(g), mine = b.assets[side].map((id) => chit(g, id)), att = side === b.attacker;
  if (c.kind === 'air_mission') {                                                                      // 16.3: regardless of supply; 16.32: one per side
    if (B.noAir[side]) return 'the dogfight settled the air over this battle (16.31)';
    if (airOf(b, side).length) return 'one air support asset per side in a battle (16.32)';
    void mode; return null;
  }
  if (unitsIn(g, b.area, side).some((u) => u.unsupplied && regular(u)) || !inSupply(g, side, b.area)) return 'units that cannot trace supply may not have assets (9.34a)';
  if (V.flank[b.area] && side === 'allied' && c.kind !== 'naval_support') return 'a flanking invasion gets only air and naval support (17.22)';
  if (c.kind === 'naval_support' && !sarea(b.area)?.coastal) return 'naval support only in coastal areas (16.21)';
  if (side === 'allied' && !c.strategic && c.nation && !unitsIn(g, b.area, 'allied').some((u) => nation(u) === c.nation && regular(u))) return `${c.nation === 'us' ? 'American' : 'British'} assets only assist their own army (16.2)`;
  const armies = new Set(unitsIn(g, b.area, side).filter(regular).map((u) => u.ech)), mixed = armies.size > 1;                      // 6.22/6.23: US 7th and British 8th Army
  if (isArty(c)) { const cap = mixed ? (att ? armies.size : 1) : att ? 2 : 1, arts = mine.filter(isArty); if (arts.length >= cap) return `at most ${cap} artillery asset(s) for the ${att ? 'Attacker' : 'Defender'}`; if (mixed && att && arts.some((x) => x.nation === c.nation)) return 'mixed Higher Echelons: one artillery asset per army (6.22)'; return null; }
  if (isBattleAsset(c)) {
    if (mixed) return 'units of different Higher Echelons: no battle assets (6.22, 6.23)';
    if (c.nation === 'italian' && mine.some((x) => x.nation === 'italian' && isBattleAsset(x))) return 'at most one Italian battle asset per battle (16.11)';
    const cap = att ? 8 : 5; return mine.filter(isBattleAsset).length >= cap ? `at most ${cap} battle assets for the ${att ? 'Attacker' : 'Defender'}` : null;
  }
  void V; return 'this counter is not assigned to battles (events come with the event rules)';
}
/** 16.31: cancel the enemy's air support over this battle with one of your own; both are used and neither side commits more air. */
export function dogfight(g: Game, b: Battle, chitId: string) {
  const c = chit(g, chitId), enemy = other(c.side); need(c.kind === 'air_mission' && c.box === 'available' && b.stage === 'setup', 'an available air support asset, before the first roll');
  const target = airOf(b, enemy)[0]; need(target, 'the enemy has no air support in this battle'); need(!airOf(b, c.side).length, 'your air commitment to this battle is already made (16.32)');
  const t = chit(g, target.id); t.box = 'used'; c.box = 'used'; b.assets[enemy] = b.assets[enemy].filter((x) => x !== t.id);
  for (const s of sidesOf(g)) { if (b.air[s]?.id === t.id) delete b.air[s]; if (b.air2?.[s]?.id === t.id) delete b.air2[s]; }
  const B = battleState(b); B.noAir[c.side] = true; B.noAir[enemy] = true;
  say(g, `Dogfight: ${c.name} cancels the enemy air support over ${nameOf(b.area)} (16.31)`, c.side);
}
function onBattle(g: Game, b: Battle, when: 'begin' | 'end') {
  const V = state(g), B = battleState(b);
  if (when === 'begin') {
    if (V.flank[b.area]) B.flank = true;
    const ab = unitsIn(g, b.area, 'allied').find((u) => u.symbol === 'airborne' && V.airborneAreas.includes(b.area) && u.moved);
    if (ab && b.attacker === 'allied') { b.attPoint = ab.id; B.airborne = ab.id; say(g, `${ab.name} leads the airborne assault (14.27a)`); }
    italianMorale(g, b);
  }
  if (when === 'end') {
    for (const u of unitsIn(g, b.area, 'axis')) if (u.untried) { u.untried = false; say(g, `${u.name} is now a tried unit (15.3d)`); }
    delete V.navalShock[`${b.area}`]; delete V.rangerFw[`${b.area}`];
    const box = V.beachAssault[b.area];
    if (box != null && b.attacker === 'allied' && (b.result ?? '').startsWith('Attack aborted')) {       // 14.27b: an aborted beach assault retreats to sea and loses the beachhead
      for (const u of g.units.filter((x) => x.side === 'allied' && (x.area === b.area || x.area === box) && x.str > 0)) toSea(g, u, 'the beach assault is aborted, 14.27b');
      if (V.beachheads[box] != null) captureBeachhead(g, box, 'captured: the beach assault was aborted (14.27b)');
    }
    if (V.flank[b.area] && !unitsIn(g, b.area, 'allied').some((u) => u.garrison && u.chitId === V.flank[b.area])) delete V.flank[b.area];
    afterChange(g);
  }
}
/** 15.3b and 17.21d-f: the Italian units in the battle check morale as the level of Italian morale demands, once the blocks are revealed. */
function italianMorale(g: Game, b: Battle) {
  const V = state(g), L = V.morale, its = unitsIn(g, b.area, 'axis').filter((u) => nation(u) === 'italian' && regular(u) && u.str > 0);
  const checkOne = (u: Unit, why: string, lossOnFail: boolean) => {
    const sn = sicilyMoraleSn(g, u, 'check'), { r, ok } = moraleCheck(g, u, sn, why);
    b.rolls.push({ who: `${u.name}: ${why}`, sn, dice: [r], hits: ok ? 0 : 1, kind: 'morale' });
    if (ok) return say(g, `${u.name} holds (${r} vs ${sn}, ${why})`);
    if (!lossOnFail) { u.disorder = 1; return say(g, `${u.name} is disordered (${r} vs ${sn}, ${why})`); }
    const q = quality(u), surrender = (q === 'veteran' && r === 10) || (q === 'green' && r >= 8);
    if (surrender) { say(g, `${u.name} surrenders (${r}, 17.21f)`); eliminate(g, u); return; }
    u.str--; if (u.str <= 0) eliminate(g, u); else say(g, `${u.name} loses a step (${r} vs ${sn}, ${why})`);
  };
  for (const u of its) {
    if (u.untried) {
      if (L === 0) checkOne(u, 'untried unit revealed (15.3b)', false);
      else { u.disorder = 1; say(g, `${u.name} (untried) is disordered: Fading Italian Morale level ${L} (17.21d)`); if (L >= 2) checkOne(u, `Fading Italian Morale level ${L} (17.21d)`, true); }
    } else if (L === 1) { if (u.disorder !== 1) checkOne(u, 'Fading Italian Morale level 1 (17.21e)', false); }
    else if (L === 2) { if (u.disorder !== 1) { u.disorder = 1; say(g, `${u.name} is disordered: Fading Italian Morale level 2 (17.21e)`); } }
    else if (L >= 3) { if (u.disorder === 1) checkOne(u, 'Fading Italian Morale level 3 (17.21e)', true); else { u.disorder = 1; say(g, `${u.name} is disordered: Fading Italian Morale level 3 (17.21e)`); } }
  }
}
/** Divisional integrity (15.2), the green untried units' cap (15.3b), the Shock-and-Awe naval asset and the Rangers that remove field works instead of firing (16.21, 16.22). */
function adjustFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground', list: Fire[]) {
  const V = state(g), key = `${b.area}`;
  if (kind === 'arty' && V.navalShock[key]) for (let i = list.length - 1; i >= 0; i--) if (list[i].key === V.navalShock[key]) list.splice(i, 1);
  if (kind !== 'ground') return;
  if (V.rangerFw[key] && side === b.attacker) for (let i = list.length - 1; i >= 0; i--) if (list[i].key === V.rangerFw[key]) list.splice(i, 1);
  for (const f of list) { const u = g.units.find((x) => x.id === f.key); if (u?.untried && quality(u) === 'green') { f.parts = f.parts.filter(([why, v]) => why === 'base' || v <= 0); /* the base Success Number stays; only the bonuses go */ f.sn = f.parts.reduce((n, [, v]) => n + v, 0); } }
  const byDiv = new Map<string, Fire[]>();
  for (const f of list) { const u = g.units.find((x) => x.id === f.key); if (u && regular(u) && u.division && !u.untried) (byDiv.get(u.division) ?? byDiv.set(u.division, []).get(u.division)!).push(f); }
  for (const [d, fs] of byDiv) if (fs.length >= 2) list.push({ key: `division:${d}`, who: `${g.units.find((x) => x.id === fs[0].key)!.name}: divisional integrity`, shooter: { kind: 'unit', cls: 'infantry', dice: 1 }, dice: 1, sn: Math.min(...fs.map((f) => f.sn)), parts: [['divisional integrity extra die (15.2)', 0]], isAsset: true });
}
/** 16.21 Shock and Awe: the naval bombardment that removes the defending field works is the first act of each battle. */
function navalShockFirst(g: Game, b: Battle) {
  const V = state(g), id = V.navalShock[`${b.area}`], def = other(b.attacker);
  if (id && b.assets[b.attacker].includes(id) && g.fieldWorks.includes(b.area) && (g.fwOwner[b.area] ?? def) === def) { g.fieldWorks = g.fieldWorks.filter((a) => a !== b.area); say(g, `${chit(g, id).name} removes the field works in ${nameOf(b.area)} (16.21)`, b.attacker); }
}
/** The field works go before the fire of the step the asset gave up (16.21 naval support first; 16.22 Rangers in the ground step, if the attack goes on and they survived). */
function beforeFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground') {
  const V = state(g), key = `${b.area}`, def = other(b.attacker); if (side !== b.attacker) return;
  // the naval asset's bombardment is the first act of the battle (beforeBegin); the Rangers act in the ground step
  for (const [id, rule] of (kind === 'arty' ? [] : [[V.rangerFw[key], '16.22']]) as [string | undefined, string][]) {
    if (id && b.assets[side].includes(id) && g.fieldWorks.includes(b.area) && (g.fwOwner[b.area] ?? def) === def) { g.fieldWorks = g.fieldWorks.filter((a) => a !== b.area); say(g, `${chit(g, id).name} removes the field works in ${nameOf(b.area)} (${rule})`, side); }
  }
}
/** 16.21 Shock and Awe: a committed naval support asset of the attacker removes the defending field works instead of firing. */
export function setNavalShock(g: Game, b: Battle, chitId: string | null) {
  const V = state(g), key = `${b.area}`; if (chitId == null) { delete V.navalShock[key]; return; }
  const c = chit(g, chitId); need(b.stage === 'setup' && c.side === b.attacker && c.kind === 'naval_support' && b.assets[c.side].includes(chitId), 'a naval support asset of the attacker, committed to this battle');
  V.navalShock[key] = chitId;
}
/** 16.22 / 16.23: a Ranger or Commando asset of the attacker removes the field works instead of rolling. */
export function setRangerFw(g: Game, b: Battle, chitId: string | null) {
  const V = state(g), key = `${b.area}`; if (chitId == null) { delete V.rangerFw[key]; return; }
  const c = chit(g, chitId); need(b.stage === 'setup' && c.side === b.attacker && (c.subtype === 'ranger' || c.subtype === 'commando') && b.assets[c.side].includes(chitId), 'a Ranger or Commando asset of the attacker, committed to this battle');
  V.rangerFw[key] = chitId;
}
const canAbort = (_g: Game, b: Battle) => (battleState(b).airborne ? 'an airborne assault may not be aborted (14.27a)' : null);
function beforeBegin(g: Game, b: Battle) {
  const V = state(g); need(!V.dropPending, 'place the airborne units first (14.27a)');
  const first = V.airborneAreas.filter((a) => contested(g, a) && !g.fought.includes(a)); need(!first.length || first.includes(b.area), `the airborne assault in ${nameOf(first[0] ?? 0)} is fought first (14.27a)`);
  navalShockFirst(g, b);
}
/** 14.41: zone B is prohibited to the Americans, zone D to the British. */
const prohibited = (u: Unit, g: Game, a: number) => (nation(u) === 'us' ? zonesAt(g, a).every((z) => z === 'B') : zonesAt(g, a).every((z) => z === 'D'));
/** 14.43: retreat within the army's zones first, to sea before any prohibited crossing. */
function retreatPrefer(g: Game, u: Unit, from: number, opts: number[]) {
  if (u.side !== 'allied') return opts;
  const ok = opts.filter((n) => zoneOk(g, u, n)); if (ok.length) return ok;
  if (seaRetreat(g, u, from)) return [];
  const notProhibited = opts.filter((x) => !prohibited(u, g, x));                                     // 14.41: never zone B (US) / zone D (British) if anything else is open
  return notProhibited.length ? notProhibited : opts;
}
function onRetreat(g: Game, u: Unit, _from: number, to: number) {
  if (u.side === 'allied' && to !== SEA && !zoneOk(g, u, to) && !prohibited(u, g, to) && u.division && !isReleased(g, u)) {   /* only the restricted-boundary case releases (14.43) */ state(g).released.push(u.division); say(g, `${u.name} retreats across its army boundary: its division counts as released (14.43)`); }
}
const retreatOk = (g: Game, u: Unit, from: number, to: number) => { if (isBox(to)) return state(g).beachAssault[from] === to;   /* 14.27b: an aborted beach assault falls back to its box, then to sea */ const c = connection(from, to)!; if (c.restricted && (u.cls === 'armor' || c.type !== 'road' || g.control[ETNA] !== u.side || (to === ETNA && etnaFree(g) !== u.side))) return false;   /* 14.1: the controller leaves by road; enters only uncontested */ return !(u.side === 'axis' && state(g).flank[to]); };

/* ================= the volume's own player actions ================= */
const avail = (g: Game, id: string, kinds: string[]) => { const c = chit(g, id); need(c.box === 'available' && kinds.includes(c.kind), `${c.name} is not available for this`); return c; };
const used = (c: Chit) => { c.box = 'used'; c.area = undefined; };
const gone = (c: Chit) => { c.box = 'eliminated'; c.area = undefined; };
/* ---------- air support in the Admin and Supply Phases (16.33, 16.34, 16.31) ---------- */
export function airInterdiction(g: Game, chitId: string, a: number) {
  needAdmin(g); const c = avail(g, chitId, ['air_mission']); need(!isBox(a) && !g.interdicted[a], 'a land area not already interdicted');
  c.box = 'map'; c.area = a; c.mission = 'interdiction'; g.interdicted[a] = c.id; say(g, `Air interdiction over ${nameOf(a)} (16.33)`, c.side);
}
export function dogfightInterdiction(g: Game, chitId: string, a: number) {
  needAdmin(g); const c = avail(g, chitId, ['air_mission']), id = g.interdicted[a]; need(id && chit(g, id).side !== c.side, 'no enemy interdiction there');
  const t = chit(g, id!); used(t); t.mission = undefined; delete g.interdicted[a]; used(c); say(g, `Dogfight: the interdiction over ${nameOf(a)} is cancelled (16.31)`, c.side);
}
export function airSupply(g: Game, chitId: string, a: number) {
  need(g.phase === 'supply', 'in the Supply Phase'); const c = avail(g, chitId, ['air_mission']);
  need(unitsIn(g, a, c.side).some((u) => u.unsupplied), 'one of your unsupplied areas');
  need(!g.airSupply, 'one Air Supply mission at a time');
  c.box = 'map'; c.area = a; c.mission = 'supply'; g.airSupply = { area: a, side: c.side, id: c.id, stamp: g.turn };
  if (c.side === g.phasing) for (const u of unitsIn(g, a, c.side)) if (u.disorder) u.disorder = u.disorder === 2 ? 0 : 2;   // 16.34 (2): the marker stays, but no morale check (supplyChecks) and the 9.35 adjustment is allowed
  say(g, `Air supply over ${nameOf(a)} (16.34)`, c.side);
}
export function dogfightAirSupply(g: Game, chitId: string) {
  need(g.phase === 'supply' && !!g.airSupply, 'no Air Supply mission to cancel'); const c = avail(g, chitId, ['air_mission']); need(c.side !== g.airSupply!.side, 'your own mission');
  const t = chit(g, g.airSupply!.id); for (const u of unitsIn(g, g.airSupply!.area, t.side)) u.unsupplied = !unitSupply(g, u);
  used(t); t.mission = undefined; g.airSupply = null; used(c); say(g, 'Dogfight: the Air Supply mission is cancelled (16.31)', c.side);
}
/* ---------- ports (14.51) ---------- */
export function portWork(g: Game, chitId: string, port: string) {
  needAdmin(g); const c = avail(g, chitId, ['engineer']), V = state(g), p = boxByCode(port); need(p && p.kind === 'port' && port !== 'P4', 'Syracuse, Catania or Palermo (Messina cannot be damaged, 14.51)');
  need(!V.portWorked.includes(port), 'one level per port per Admin Phase');
  need(supplied(g, c.side, p.area), 'the port must be friendly-controlled, uncontested and in supply');
  if (c.side === 'axis') { need(V.portDamage[port] < 2, 'already damaged twice'); V.portDamage[port]++; }
  else { need(unitsIn(g, p.area, 'allied').some((u) => nation(u) === p.nation && regular(u)), `occupied by a ${p.nation === 'us' ? 'American' : 'British'} unit`); need(V.portDamage[port] > 0, 'not damaged'); V.portDamage[port]--; }
  V.portWorked.push(port); used(c); say(g, `${c.name} ${c.side === 'axis' ? 'damages' : 'repairs'} the port of ${p.name}: damage ${V.portDamage[port]} (14.51)`, c.side);
}
/* ---------- 14.63 the Axis staff asset recovers an Italian infantry asset ---------- */
export function axisStaffRecover(g: Game, chitId: string, assetId: string) {
  needAdmin(g); const c = avail(g, chitId, ['command_staff']); need(c.side === 'axis', 'the Axis staff asset');
  const a = chit(g, assetId); need(a.side === 'axis' && a.nation === 'italian' && a.kind === 'infantry_asset' && a.box === 'eliminated', 'an eliminated Italian infantry asset');
  a.box = 'available'; used(c); say(g, `Staff: ${a.name} returns to the Available Box (14.63)`, 'axis');
}
/* ---------- events (17.x) ---------- */
export function playPatton(g: Game, chitId: string) { needAdmin(g); const c = avail(g, chitId, ['event_patton_slap']); gone(c); state(g).patton = true; say(g, 'Patton Soldier Slap: US single-use Special Actions now cost two events each (17.11)', 'axis'); }
export function playTacticalExtract(g: Game, chitId: string) { needAdmin(g); const c = avail(g, chitId, ['event_tactical_extract']); gone(c); state(g).extract = true; say(g, 'Axis Tactical Extract: this Movement Phase German units may move out of contested areas towards Messina (17.12)', 'axis'); }
/** 17.21b-c: Italian morale fades one level; the Axis, then the Allies, pick the Italian assets eliminated from the Available Box. */
export function playFadingMorale(g: Game, chitId: string) {
  needAdmin(g); const c = avail(g, chitId, ['event_fading_morale']), V = state(g); gone(c); V.morale = Math.min(3, V.morale + 1);
  const n = V.morale === 1 ? { axis: 1, allied: 0 } : V.morale === 2 ? { axis: 1, allied: 1 } : { axis: 2, allied: 2 };
  const pool = () => g.chits.filter((x) => x.side === 'axis' && x.nation === 'italian' && x.box === 'available' && x.kind !== 'command_staff' && (isArty(x) || isBattleAsset(x)));
  V.moralePick = { axis: Math.min(n.axis, pool().length), allied: Math.min(n.allied, Math.max(0, pool().length - n.axis)) };
  say(g, `Fading Italian Morale: level ${V.morale} (17.21). The Axis picks ${V.moralePick.axis} Italian asset(s) to eliminate, then the Allies ${V.moralePick.allied}`, 'allied');
}
export function pickMoraleLoss(g: Game, side: Side, assetId: string) {
  const V = state(g); need(V.moralePick && V.moralePick[side] > 0, 'no pick pending for that side'); need(side === 'allied' ? !V.moralePick!.axis : true, 'the Axis picks first (17.21c)');
  const a = chit(g, assetId); need(a.side === 'axis' && a.nation === 'italian' && a.box === 'available' && a.kind !== 'command_staff' && (isArty(a) || isBattleAsset(a)), 'an Italian asset in the Available Box (not the Staff)');
  gone(a); V.moralePick![side]--; say(g, `${a.name} is eliminated (Fading Italian Morale, 17.21c)`, side);
}
export function autoMoraleLoss(g: Game) { const V = state(g); for (const sd of ['axis', 'allied'] as const) while (V.moralePick?.[sd]) { const a = g.chits.find((x) => x.side === 'axis' && x.nation === 'italian' && x.box === 'available' && x.kind !== 'command_staff' && (isArty(x) || isBattleAsset(x))); if (!a) { V.moralePick![sd] = 0; break; } pickMoraleLoss(g, sd, a.id); } }
/** 17.22: a Flanking Invasion asset lands in an enemy-controlled, uncontested coastal area within two areas of a unit of its army in a coastal area. */
export function flankTargets(g: Game, chitId: string): number[] {
  const c = chit(g, chitId), V = state(g); if (g.phase !== 'admin' || g.phasing !== 'allied' || c.box !== 'available' || !c.flank || (c.flank === 'once' && V.cdoUsed) || V.flankTurn === g.turn) return [];          // one per Admin Phase
  const near = new Set<number>(); for (const u of g.units.filter((x) => x.side === 'allied' && x.area != null && !isBox(x.area) && regular(x) && nation(x) === c.nation && sarea(x.area)?.coastal)) for (const a of within(u.area!, 2)) near.add(a);
  return [...near].filter((a) => sarea(a)?.coastal && g.control[a] === 'axis' && !contested(g, a) && (!g.inPlay || g.inPlay.includes(a)) && !V.flank[a]);
}
export function playFlanking(g: Game, chitId: string, a: number) {
  need(flankTargets(g, chitId).includes(a), 'not a legal flanking invasion (17.22)'); const c = chit(g, chitId), V = state(g);
  c.box = 'map'; c.area = a; if (c.flank === 'once') V.cdoUsed = true; V.flank[a] = c.id; V.flankTurn = g.turn;
  g.units.push({ id: `F-${c.id}`, name: c.name, side: 'allied', nation: c.nation, cls: 'infantry', q: [c.q ?? 'veteran'], max: 1, str: 1, area: a, garrison: true, disorder: 0, unsupplied: false, moved: true, reserve: null, exploit: false, chitId: c.id, ech: c.ech });
  say(g, `${c.name} lands in ${nameOf(a)}: a flanking invasion (17.22)`, 'allied');
  if (unitsIn(g, a, 'axis').length) { if (!g.riverAssault.includes(a)) g.riverAssault.push(a); say(g, 'The area is defended: one round of combat now, with air and naval support only', 'allied'); }
}
/** 17.22: a flanking invasion is relieved the instant an Allied unit enters its area. */
function relieveFlank(g: Game, a: number) { const V = state(g), id = V.flank[a]; if (!id) return; const c = chit(g, id); used(c); g.units = g.units.filter((u) => u.id !== `F-${id}`); delete V.flank[a]; say(g, `${c.name} is relieved and goes to the Used Box (17.22)`, 'allied'); }
/** A battle may open in the Allied Admin Phase where a flanking invasion just landed on defenders (17.22). */
const battleAllowed = (g: Game, a: number) => g.phase === 'admin' && g.phasing === 'allied' && state(g).flankTurn === g.turn && !!state(g).flank[a] && g.units.some((u) => u.id === `F-${state(g).flank[a]}` && u.area === a);   // 17.22(i): only the round of the landing
/* ---------- 17.11 Patton: a US single-use Special Action costs two events ---------- */
function saFilter(g: Game, _side: Side, list: Chit[], ech?: string) {
  if (!state(g).patton) return list;
  const usEv = list.filter((c) => c.kind === 'special_action_event' && c.nation === 'us');
  if (usEv.length >= 2 || !usEv.length) return list;
  void ech; return list.filter((c) => !usEv.includes(c));
}
function onSpendSA(g: Game, _side: Side, c: Chit) {
  if (!state(g).patton || c.kind !== 'special_action_event' || c.nation !== 'us') return;
  const second = g.chits.find((x) => x.kind === 'special_action_event' && x.nation === 'us' && x.box === 'available'); if (second) { gone(second); say(g, `Patton Soldier Slap: a second US Special Action event is spent (17.11)`, 'allied'); }
}
/* ---------- reserves (14.7) ---------- */
const markerKey = (_g: Game, u: Unit) => (u.side === 'axis' ? 'res' : nation(u) === 'british' ? 'br' : 'us');
const reserveOk = (g: Game, u: Unit) => !isLandingBox(u.area!) && untriedFree(g, u);
/** 15.3a: a reserve marker on an untried unit is its one action this phase (called when the marker goes on). */
const onReserve = (g: Game, u: Unit) => { if (u.untried && g.phase === 'movement') state(g).untriedActed = u.id; };
/** 5.23 with 15.3a: an untried garrison digging in is the one untried unit acting this phase. */
export function unitFieldWorks(g: Game, unitId: string) { const u = unit(g, unitId); need(untriedFree(g, u), 'only one untried unit may act in a Movement Phase (15.3a)'); need(!isBox(u.area!), 'not in a box'); buildFieldWorks(g, unitId); if (u.untried) state(g).untriedActed = u.id; }
export const specialActions = (g: Game, side: Side) => saAvailable(g, side);
export const scenarioOf = (g: Game) => SCEN(g);
/** The beachheads still in play, by landing box code. */
export const beachheads = (g: Game) => Object.entries(state(g).beachheads).map(([b, n]) => ({ box: BOX.get(+b)!.box, id: +b, nation: n, area: BOX.get(+b)!.area }));

registerHooks('sicily', {
  newGame: newSicilyGame as Volume['newGame'], markerKey, reach: sicilyReach, moveOk, afterMove, stratAllowed, stratStep, afterStrat,
  allowance: (g, u) => allowanceOf(u, g.moving?.id === u.id && g.moving.left), successNumber: sicilySn, adjustFire, canAssign, moraleSn: sicilyMoraleSn, retreatOk, retreatPrefer, onRetreat, noRetreat: (_g, u) => !!u.garrison, seaRetreat,
  mustFight: (g) => state(g).airborneAreas.filter((a) => contested(g, a)), retreatZone: (g, u, to) => u.side !== 'allied' || zoneOk(g, u, to),   // 14.27a, 14.43
  sources, supplyStep, unitSupply, supplyFree: (g, side, a) => g.airSupply?.area === a && g.airSupply.side === side, alwaysSupplied: (_g, u) => isLandingBox(u.area!) || !!u.garrison,
  victory: sicilyVictory, finalResult, onPhase, onBattle, assault, reinforce, afterDraw, afterDeploy, extraDraws, canAbort, beforeBegin, beforeFire, saFilter, onSpendSA, battleAllowed, reserveOk, onReserve, beforeRecycle, noReroute: true, staffReplaceOk: (_g, c) => c.side !== 'axis',
  appropriate: (g, u) => entryBoxes(g, u), stackLimit: () => 2, optional: [{ key: 'airborne', rule: '18.1', name: 'Airborne units', text: 'The 82nd and 1st Airborne units ignore the −1 unsupplied morale modifier.' },
    { key: 'advArty', rule: '18.2', name: 'Advanced artillery modifiers', text: '−1 when the target is the defender, +1 against an infantry point unit not in field works.' },
    { key: 'overrun', rule: '18.3', name: 'Overrunning artillery', text: 'Defending artillery left behind in a vacated area may be destroyed by the attacker.' },
    { key: 'fwMaintain', rule: '18.4', name: 'Maintaining field works', text: 'Field works in a contested area stay unless a morale check fails in the owner\'s Supply Phase.' }],
} as Partial<Volume>);
