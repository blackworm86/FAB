// FAB Vol. III, Golan '73, on the series engine: the scenario set-ups (22.1, 22.2), the exclusive rules as the volume hooks the
// series engine calls (movement 14.x via ../golan/move.ts, the Combat Play Aid numbers via ../golan/combat.ts, strongpoints 15.6,
// ghosts 15.7, air assault 15.3, SAMs 16.12, commando raids 16.11, the Purple Line releases 15.2/15.4, supply 14.9, victory 19.x)
// and the player actions that exist only in this volume (engineering 14.5, air missions 16.31, events 17.x, Special Action uses
// 14.61, the alternate set-up). Everything else — the turn sequence, battles, retreats, reserves, arrivals — is the series engine.
import unitsJson from '../../../data/golan73/units.json';
import countersJson from '../../../data/golan73/counters.json';
import setupsJson from '../../../data/golan73/setups.json';
import trackJson from '../../../data/golan73/turn_track.json';
import { areas, connection, edgeKey, neighbors, setPlayArea } from '../map';
import { ASSEMBLY, ENTRY, HERMON, NAF_NORTH, REAR, boxSide, connections, eastOfSam, isAssembly, area as garea, type GSide } from '../golan/map';
import { reachable, type GMoveCtx, type GMoveUnit } from '../golan/move';
import { assetLimits, brigadeExtraDie, moraleSn as gMoraleSn, samResult, successNumber as gSuccessNumber, type GShooter, type GTarget, type Quality } from '../golan/combat';
import { isArty, isBattleAsset, type Chit } from '../chits';
import { registerHooks, type Volume } from '../volumes';
import { airOf, blocks, buildFieldWorks, chit, contested, dropAir, dropReserve, eliminate, fighters, inSupply, moraleCheck, move as seriesMove, moveOptions, needAdmin, other, quality, rngf, rollDie, say, secureRandom, saAvailable, sidesOf, spendSA, supplied, unitsIn, updateControl,
  type Battle, type Game, type Opt, type Opts, type Side, type Unit, type Fire, type OptionalRule } from '../game';
import type { Shooter, Target, Setting } from '../combat';
export { ASSEMBLY, HERMON, NAF_NORTH, REAR, isAssembly, eastOfSam };
/** The Golan rule book's own optional rules (18.2–18.5; 18.1 is the series' fwMaintain), each off unless chosen. */
declare module '../game' {
  interface Opts {
    withdrawal?: boolean;        /** 18.2 leaving a contested area last takes a morale check */
    artyInterdict?: boolean;     /** 18.31 artillery interdiction in the Admin Phase */
    directSupport?: boolean;     /** 18.32 Israeli artillery as direct combat support (+1 to the point unit) */
    syrianAirAttack?: boolean;   /** 18.4 Syrian close air support only when Syria attacks */
    israeliDivisions?: boolean;  /** 18.5 Israeli divisional organization (the 15.12 mixing penalty for Israel) */
  }
}

/* ================= the volume's own state ================= */
export interface GolanState {
  minefields: string[]; bridgedDitch: string[];           // mined boundaries (14.02), AT Ditch Bridged markers (14.51)
  raids: number[]; raidPartial: number[];                 // commando raid areas (16.11a) and the ones only partly successful (they do not fire back)
  crossed: string[];                                      // one-unit-per-phase boundaries already used this phase (14.11–14.14)
  minefieldFailed: string[];                              // units that failed a minefield check this turn (14.02)
  assaultEntered: Record<number, string[]>;               // units that entered an enemy area across an unbridged ditch or river this phase (14.01)
  kingHassan: boolean;                                    // 17.24 in effect
  intel?: { side: Side; units: string[] };                // 16.31c: enemy blocks a reconnaissance showed, for the rest of the phase
  freeCombatRound: number;                                // 22.17: Syrian free Breakthrough combat rounds left on turn 1
  purpleLineCrossed: boolean; airReleased: number; hermonLost: boolean;
  airAssaultArea?: number; samTarget?: string;            // 15.3; 16.12: the Israeli air mission a SAM may answer now
  minesLeft?: number; startAt?: 'combat' | 'movement';    // 14.02: minefields the Israeli player still places at the start; the phase the scenario opens with once set up
  nafakh?: { s03Free: boolean; golani: boolean; staffOut: boolean };   // 22.46: the 33rd held back, Golani's release, the HQ Staff lost with Nafakh
  alowda?: { raids: number; cup?: string[]; drawn?: string[] };
  samCancelled?: number[];                                // 16.12: areas where a SAM cancelled an Admin-Phase air mission (no replacement this phase)
  withdrew?: string[]; artyInt?: Side[];                 // 18.2: units that already rolled to leave a contested area this phase; 18.31: sides that interdicted with artillery this Admin Phase
  chem?: number; ghostsMade?: number;    // optional rules: chemical attacks so far (each one after the first gives Israel a VP); ghosts drawn from the Al-Owda cup       // 20.35 the commandos landed at the start; 20.36 the Israeli Reinforcements Draw Cup
}
export interface GolanBattle { event: Partial<Record<Side, string>>; counterbattery: Partial<Record<Side, string>>; ew?: { pending: boolean }; defLocked?: boolean; engBridge?: string; chem?: string; flank?: string; spSwap?: string; samCancelled?: boolean; dcs?: string[] }   // samCancelled: 16.12; dcs: 18.32 Israeli artillery in direct combat support
export const state = (g: Game) => g.vol as unknown as GolanState;
export const battleState = (b: Battle) => (b.vol ??= { event: {}, counterbattery: {} }) as unknown as GolanBattle;

type RawUnit = { id: string; name: string; side: Side; cls?: string | null; symbol?: string; kind?: string; steps?: number; quality_by_step?: (Quality | null)[]; division?: string | null; brigade?: string | null;
  start_area?: number; arrival_turn?: number; entry?: string[]; initial_steps?: number };
type RawChit = { id: string; ids?: string[]; kind: string; side: Side | 'none'; name: string; turn: number | string | null; quality?: Quality | null; area?: number; brigade?: string };
type Setup = { units: { id: string; area?: number; box?: string }[]; reduced?: Record<string, number>; holding_boxes?: Record<string, string[]>; available?: Record<string, string[]>;
  garrisons?: { id: string; area: number }[]; strongpoints?: { areas?: number[]; suggested_historical: { area: number; id: string }[] }; minefields?: { fixed: number[][]; player_placed?: number }; riverAssault?: number[]; reserve?: { syrian?: string[] }; turns: number };
const UNITS = unitsJson as unknown as RawUnit[], COUNTERS = countersJson as unknown as RawChit[], SETUPS = setupsJson as unknown as Record<string, Setup>;
const TRACK = (trackJson as unknown as { turns: Record<string, { night: boolean }> }).turns;
const NOT_CHITS = new Set(['minefield', 'marker', 'reserve_marker', 'marker_control', 'field_works', 'marker_at_ditch_bridged']);
const need = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };
/** The Battle for Nafakh (22.4) plays on its own sheet. */
export const isNafakh = (g: Game) => g.opts.scenario === 'nafakh';
/** 20.3 Operation Al-Owda: the original Syrian plan, six daylight turns on the whole map. */
export const isAlOwda = (g: Game) => g.opts.scenario === 'alowda';
export const isNight = (g: Game) => !isNafakh(g) && !isAlOwda(g) && (TRACK[String(g.turn)]?.night ?? false);       // Nafakh's four turns and Al-Owda's six are all daylight (20.37: no night turn)
const q = (u: Unit): Quality => quality(u) ?? 'veteran';
const regular = (u: Unit) => !u.garrison && !u.fort && !u.ghost;
/** Standing assets are units with the garrison flag; this finds the one a chit stands as. */
const standing = (g: Game, chitId: string) => g.units.find((u) => u.garrison && u.chitId === chitId && u.area != null);
const raidUnitAt = (g: Game, a: number) => unitsIn(g, a, 'syrian').find((u) => u.garrison && u.chitId && chit(g, u.chitId).kind === 'commando');
const asGarrison = (c: Chit, prefix: string, a: number, cls: 'armor' | 'infantry' = 'infantry', qual?: Quality): Unit =>
  ({ id: `${prefix}-${c.id}`, name: c.name, side: c.side, cls, q: [qual ?? c.q ?? 'green'], max: 1, str: 1, area: a, garrison: true, disorder: 0, unsupplied: false, moved: true, reserve: null, exploit: false, chitId: c.id });

/* ================= set-up (22.1 Operation Badr, 22.2 the alternate set-up) ================= */
/** A new game: the scenario's own set-up, keeping the optional rules the players chose. */
function newGolanGame(seed: number, opts: Partial<Opts>): Game {
  const g = buildGolanGame(seed, opts); g.opts = { ...opts, scenario: g.opts.scenario, fuel: false }; return g;
}
function buildGolanGame(seed: number, opts: Partial<{ scenario: string }>): Game {
  setPlayArea(null);                                                                                 // whatever the last game played on
  if (opts.scenario === 'nafakh') { const g = nafakhSetup(newGolanGame(seed, { scenario: 'badr' })); setPlayArea(g.inPlay); return g; }
  if (opts.scenario === 'alowda') { const g = alowdaSetup(newGolanGame(seed, { scenario: 'badr' })); setPlayArea(g.inPlay); return g; }
  const scenario = opts.scenario === 'badr_alt' ? 'badr_alt' : 'badr', S = SETUPS.badr;        // badr_alt shares everything but the free placement (22.24/22.25)
  const where = new Map(S.units.map((p) => [p.id, p]));
  const units: Unit[] = UNITS.filter((u) => u.kind !== 'special_action_block').map((u) => {
    const p = where.get(u.id), max = u.steps ?? 1, kind = u.kind === 'strongpoint' || u.kind === 'ghost' ? u.kind : undefined, area = p?.area ?? null;
    const box = area != null ? undefined : ['operational_reserve', 'strategic_reserve', 'air_assault'].includes(p?.box ?? '') ? p!.box : kind ? 'deploy' : undefined;          // 15.6/15.7: the Israeli player places every strongpoint and ghost at the start
    return { id: u.id, name: u.name, side: u.side, cls: (u.cls ?? 'infantry') as 'armor' | 'infantry', q: (u.quality_by_step ?? []).map((x) => x ?? 'veteran'), max, str: S.reduced?.[u.id] ?? u.initial_steps ?? max,
      area, box, disorder: 0, unsupplied: false, moved: false, reserve: null, exploit: false, arrival: u.arrival_turn, entry: u.entry, symbol: u.symbol, division: u.division ?? undefined, brigade: u.brigade ?? undefined,
      kind, fort: kind === 'strongpoint' ? (u.symbol === 'armor' ? 'armor' : 'infantry') : undefined, ghost: kind === 'ghost' || undefined,
      code: area != null ? String(area) : u.arrival_turn ? `${u.arrival_turn}-${(u.entry ?? []).join('')}` : box === 'operational_reserve' ? 'OR' : box === 'strategic_reserve' ? 'SR' : box === 'air_assault' ? 'AA' : '' };
  });
  const avail = new Set([...(S.available?.syrian ?? []), ...(S.available?.israeli ?? [])]), hold = S.holding_boxes ?? {};
  const inHold = (id: string) => (hold.air_support_holding?.includes(id) ? 'air_support_holding' : hold.evacuated_strongpoints?.includes(id) ? 'evacuated_strongpoints' : null);
  const garrison = new Map((S.garrisons ?? []).map((x) => [x.id, x.area]));
  const chits: Chit[] = [];
  for (const c of COUNTERS) {
    if (NOT_CHITS.has(c.kind) || c.side === 'none') continue;
    for (const id of c.ids?.length ? c.ids : [c.id]) {
      const box = garrison.has(c.id) ? 'map' : inHold(id) ?? (c.turn === 'S' || avail.has(id) ? 'available' : 'future');
      const ch: Chit = { id, counter: c.id, name: c.name, kind: c.kind, side: c.side, ech: '', q: c.quality ?? undefined, turn: c.turn, box, area: garrison.get(c.id), brigade: c.brigade };
      chits.push(ch); if (garrison.has(c.id)) units.push(asGarrison(ch, 'G', garrison.get(c.id)!));
    }
  }
  for (const u of UNITS.filter((x) => x.kind === 'special_action_block')) chits.push({ id: u.id, counter: u.id, name: u.name, kind: 'sa_block', side: u.side, ech: '', turn: u.arrival_turn ?? 2, box: 'future' });   // 8.1, from turn 2
  const control: Record<number, Side> = { [ASSEMBLY.A]: 'israeli', [ASSEMBLY.B]: 'israeli' };
  for (const a of areas.keys()) if (!isAssembly(a)) control[a] = garea(a).syria ? 'syrian' : 'israeli';                     // 22.13: everything west of the Purple Line is Israeli
  const vol: GolanState = { minefields: (S.minefields?.fixed ?? []).map(([a, b]) => edgeKey(a, b)), bridgedDitch: [], raids: [], raidPartial: [], crossed: [], minefieldFailed: [], assaultEntered: {}, kingHassan: false,
    freeCombatRound: scenario === 'badr' ? 2 : 0, purpleLineCrossed: false, airReleased: 0, hermonLost: false, minesLeft: S.minefields?.player_placed ?? 3, startAt: scenario === 'badr' ? 'combat' : 'movement' };
  const g: Game = { game: 'golan73', sides: ['syrian', 'israeli'], turn: 1, lastTurn: S.turns, phasing: 'syrian', phase: 'combat', units, chits, control, fieldWorks: [], fwOwner: {}, riverAssault: scenario === 'badr' ? [...(S.riverAssault ?? [])] : [], blown: [],
    contestedAtMoveStart: [], fought: [], markers: { syrian: { res: 2 }, israeli: { res: 4 } }, stratMoves: 0, riverCross: [], blowTried: [], entered: {}, pendingBlow: null, greif: {}, greifTried: [], fwBuilt: [], tfNew: [],
    elimLarge: [], captured: [], fuelAdded: false, opts: { scenario, fuel: false }, roadblocks: {}, interdicted: {}, pooled: null, airSupply: null, revealed: null, arrived: [], pendingArrivals: [], recover: [], battle: null, seed, rolls: 0, log: [],
    vol: vol as unknown as Record<string, unknown> };
  for (const a of g.riverAssault) for (const u of unitsIn(g, a, 'syrian')) u.from = neighbors(a).find((n) => connection(a, n)!.atDitch && g.control[n] === 'syrian');   // the bridgeheads came across the ditch
  if (scenario === 'badr') for (const id of S.reserve?.syrian ?? []) { g.units.find((u) => u.id === id)!.reserve = 'res'; g.markers.syrian.res--; }
  if (scenario === 'badr_alt')                                                                       // 22.24/22.25: the players place their regular units too
    for (const u of g.units) if (u.area != null && regular(u) && u.id !== 'S17') { u.box = 'deploy'; u.area = null; u.from = undefined; }
  g.phase = 'deploy'; g.phasing = 'israeli';                                                          // 22.14/22.24: the Israeli player places strongpoints, ghosts and three minefields first
  say(g, scenario === 'badr' ? 'Operation Badr: the Syrian assault has crossed the Purple Line. Israel places its strongpoints and ghosts face-down, one per Purple Line area, and three minefields; then the Syrian Combat Phase of turn 1.'
    : 'Operation Badr, alternate set-up: Israel places its strongpoints, ghosts, minefields and regular units, Syria its sixteen units and two reserve markers; then the Syrian Movement Phase of turn 1.');
  return g;
}

/* ================= 22.4 Battle for Nafakh: its own map sheet, four turns, from the Syrian Movement Phase of turn 1 ================= */
type Nafakh = { turns: number; areas_in_play: number[]; units: { id: string; area?: number; box?: string; recovering?: boolean }[]; reduced: Record<string, number>;
  on_map_chits: { id: string; area: number }[]; garrisons: { id: string; area: number }[]; available: Record<Side, string[]>; minefields: { fixed: number[][]; player_placed?: number };
  reserve: { markers: Record<Side, number> }; special_action_release: { id: string; turns: number[] };
  reinforcements: Record<string, Record<Side, { units: { id: string; entry: string[]; steps?: number }[]; chits: string[] }>>;
  sheet: { entry: Record<string, number>; control_israeli: number[]; supply: Record<Side, number[]>; track: Record<string, Record<Side, number[]>> } };
const NAF = (setupsJson as unknown as Record<string, Nafakh>).nafakh;
const nafBox = (b: string) => (b === 'northern_assembly' ? NAF_NORTH : b === 'syrian_rear_area' ? REAR : NAF.sheet.entry[b]);
function nafakhSetup(g: Game): Game {
  g.opts = { scenario: 'nafakh', fuel: false }; g.lastTurn = NAF.turns; g.phasing = 'israeli'; g.phase = 'deploy'; g.log = [];          // 22.44: Israel lays its minefield and may mark one reserve, then the Syrian Movement Phase of turn 1
  g.inPlay = [...NAF.areas_in_play, NAF_NORTH, REAR];
  g.track = Array.from({ length: NAF.turns }, (_, i) => ({ ge: NAF.sheet.track[i + 1].syrian, al: NAF.sheet.track[i + 1].israeli, sd: null }));
  g.riverAssault = []; g.fieldWorks = []; g.markers = { syrian: { res: NAF.reserve.markers.syrian }, israeli: { res: NAF.reserve.markers.israeli } };
  const V = state(g); V.freeCombatRound = 0; V.minefields = NAF.minefields.fixed.map(([a, b]) => edgeKey(a, b)); V.nafakh = { s03Free: false, golani: false, staffOut: false }; V.minesLeft = NAF.minefields.player_placed ?? 0; V.startAt = 'movement';
  const place = new Map(NAF.units.map((p) => [p.id, p])), arrive = new Map<string, { turn: number; entry: string[]; steps?: number }>();
  for (const [t, sides] of Object.entries(NAF.reinforcements)) for (const s of ['israeli', 'syrian'] as const) for (const r of sides[s].units) arrive.set(r.id, { turn: +t, entry: r.entry, steps: r.steps });
  g.units = g.units.filter((u) => !u.garrison && (place.has(u.id) || arrive.has(u.id) || u.id === NAF.special_action_release.id));
  for (const u of g.units) {
    const p = place.get(u.id), a = arrive.get(u.id);
    Object.assign(u, { reserve: null, from: undefined, disorder: 0, str: NAF.reduced[u.id] ?? u.max, arrival: undefined, entry: undefined, box: undefined, area: null });
    if (p) { u.area = p.area ?? nafBox(p.box!); if (p.recovering) u.disorder = 2; }                       // 22.46: the 52nd starts recovering
    else if (a) { u.arrival = a.turn; u.entry = a.entry.map((e) => `#${nafBox(e)}`); if (a.steps) u.str = a.steps; }   // 22.45: full strength unless listed reduced
    else u.box = 'sa_release';                                                                                 // Golani: only by a Special Action on turns 3-4
  }
  const avail = new Set([...NAF.available.israeli, ...NAF.available.syrian]), later = new Map<string, number>(), onMap = new Map([...NAF.on_map_chits, ...NAF.garrisons].map((x) => [x.id, x.area]));
  for (const [t, sides] of Object.entries(NAF.reinforcements)) for (const s of ['israeli', 'syrian'] as const) for (const id of sides[s].chits) later.set(id, +t);
  g.chits = g.chits.filter((c) => avail.has(c.id) || later.has(c.id) || onMap.has(c.id));
  for (const c of g.chits) {
    c.area = undefined; c.mission = undefined;
    if (onMap.has(c.id)) { c.box = 'map'; c.area = onMap.get(c.id); c.turn = 'S'; }
    else if (avail.has(c.id)) { c.box = 'available'; c.turn = 'S'; }
    else { c.box = 'future'; c.turn = later.get(c.id)!; }
  }
  for (const c of g.chits.filter((x) => x.box === 'map')) {                                                  // the garrisons, and Lt. Zvika already in Sindiana
    if (c.kind === 'garrison') g.units.push(asGarrison(c, 'G', c.area!));
    if (c.kind === 'event_lt_zvika') { c.q = 'elite'; g.units.push(asGarrison(c, 'Z', c.area!, 'armor', 'elite')); }
  }
  for (const a of NAF.areas_in_play) g.control[a] = NAF.sheet.control_israeli.includes(a) ? 'israeli' : 'syrian';   // 22.43
  g.control[NAF_NORTH] = 'israeli'; g.control[REAR] = 'syrian';
  say(g, 'Battle for Nafakh, October 7th AM: the 1st Tank Division drives on the Israeli command centre. Israel lays one minefield (the one between Ein Zivan and Bunker 109 is already there) and may put a reserve marker on one unit; then the Syrian Movement Phase of turn 1.');
  return g;
}
/** 22.46: the 33rd may leave Tel Fazra only once a Special Action is spent on it. */
export function freeThe33rd(g: Game, chitId?: string) {
  const V = state(g); need(isNafakh(g) && V.nafakh && !V.nafakh.s03Free, 'the 33rd is already free to move');
  need(g.phasing === 'syrian' && (g.phase === 'admin' || g.phase === 'movement'), 'in the Syrian Admin or Movement Phase');
  spendSA(g, 'syrian', undefined, 'the 33rd leaves its mop-up of the AT ditch crossings (22.46)', chitId); V.nafakh!.s03Free = true;
}
/** 22.45: on turns 3-4 a Special Action brings Golani into play at the sheet's Israeli entry area (beside Oretal). */
export function releaseGolani(g: Game, chitId?: string) {
  const V = state(g), u = unit(g, NAF.special_action_release.id), at = NAF.sheet.entry.A;
  need(isNafakh(g) && V.nafakh && u.box === 'sa_release', 'Golani is not waiting to be released');
  needAdmin(g); need(g.phasing === 'israeli' && NAF.special_action_release.turns.includes(g.turn), 'in the Israeli Admin Phase of turn 3 or 4');
  need(g.control[at] === 'israeli' && !unitsIn(g, at, 'syrian').length && blocks(g, at, 'israeli').length < 2, `${nameOf(at)} must be Israeli-held with room for a unit`);
  spendSA(g, 'israeli', undefined, 'Golani released (22.45)', chitId); u.box = undefined; u.area = at; V.nafakh!.golani = true;
  say(g, `Golani enters at ${nameOf(at)}`, 'israeli');
}
/** 22.46: whenever Syria holds Nafakh, the Israeli reusable Special Action is lost and the HQ Staff goes to the cup; drawing it brings the Special Action back. */
function nafakhStaff(g: Game) {
  const V = state(g); if (!isNafakh(g) || !V.nafakh) return;
  const staff = g.chits.find((c) => c.kind === 'command_staff' && c.side === 'israeli'), sa = g.chits.find((c) => c.kind === 'sa_block' && c.side === 'israeli');
  if (g.control[42] === 'syrian' && staff?.box === 'map') {
    staff.box = 'cup'; staff.area = undefined; V.nafakh.staffOut = true;
    if (sa && sa.box !== 'future') sa.box = 'eliminated';
    say(g, 'Syria holds Nafakh: the Israeli reusable Special Action is lost; the HQ Staff goes into the cup (22.46)', 'israeli');
  }
  if (V.nafakh.staffOut && staff && staff.box !== 'cup' && staff.box !== 'map') { V.nafakh.staffOut = false; if (sa && sa.box === 'eliminated') { sa.box = 'available'; say(g, 'The HQ Staff is back: the reusable Special Action returns (22.46)', 'israeli'); } }
}
/** 22.47: strength points of regular units in Nafakh. */
const strengthIn = (g: Game, side: Side) => unitsIn(g, 42, side).filter(regular).reduce((s, u) => s + u.str, 0);
function nafakhResult(g: Game) {
  const held = g.control[42], clear = held && !contested(g, 42);
  if (clear) return `${held === 'syrian' ? 'Syrian' : 'Israeli'} Decisive Victory: uncontested control of Nafakh (22.47)`;
  const s = strengthIn(g, 'syrian'), i = strengthIn(g, 'israeli');
  return `${s > i ? 'Syrian' : 'Israeli'} Marginal Victory: ${Math.max(s, i)} to ${Math.min(s, i)} strength points in Nafakh${s === i ? ', a tie goes to Israel' : ''} (22.47)`;
}

/* ================= 20.3 Operation Al-Owda (hypothetical): the whole map but Mt Hermon, six turns, the Syrians place their own units =================
   From the scenario rules, the Al-Owda Setup Cards, Turn Track and Reference Map (data/golan73/setups.json "alowda"). */
type SideCard = { available: string[]; chits: Record<string, string[]>; reserve_markers: number; start?: Record<string, number> };
type AlOwda = { turns: number; out_of_play: { units: string[] }; track: Record<string, Record<Side, [number, number]>>; vp_line_east: number[];
  israeli: SideCard & { air_support_holding: string[]; garrisons: number[]; vp: number; fixed_reinforcements: Record<string, { id: string; entry: string[] }[]>;
    draw_cup: { start: string[]; ghosts: number; added: Record<string, string[]>; draws: Record<string, number>; entry: Record<string, string[]> } };
  syrian: SideCard & { commando_landing: string[]; reinforcements: Record<string, string[]>; entry: string[] } };
const ALO = (setupsJson as unknown as Record<string, AlOwda>).alowda;
const VP_EAST = new Set(ALO.vp_line_east);
function alowdaSetup(g: Game): Game {
  g.opts = { scenario: 'alowda', fuel: false }; g.lastTurn = ALO.turns; g.phase = 'deploy'; g.phasing = 'syrian'; g.log = [];
  g.inPlay = [...areas.keys()].filter((a) => a !== HERMON && a !== REAR && a !== NAF_NORTH);           // 20.37: Mt Hermon is already Syrian; no sudden death
  g.track = Array.from({ length: ALO.turns }, (_, i) => ({ ge: ALO.track[String(i + 1)].syrian, al: ALO.track[String(i + 1)].israeli, sd: null }));    // the Al-Owda Turn Track: no sudden death
  g.riverAssault = []; g.control[HERMON] = 'syrian';
  const V = state(g); V.freeCombatRound = 0; V.startAt = 'movement';
  const I = ALO.israeli, S = ALO.syrian, cup = I.draw_cup;
  V.alowda = { raids: 0, cup: [...cup.start, ...Array.from({ length: cup.ghosts }, (_, k) => `ghost${k + 1}`)], drawn: [] };
  const fixed = new Map(Object.entries(I.fixed_reinforcements).flatMap(([t, l]) => l.map((r) => [r.id, { turn: +t, entry: r.entry }] as const)));
  const syArr = new Map(Object.entries(S.reinforcements).flatMap(([t, l]) => l.map((id) => [id, +t] as const)));
  const cupIds = new Set([...cup.start, ...Object.values(cup.added).flat()]);
  g.units = g.units.filter((u) => !ALO.out_of_play.units.includes(u.id) && !(u.garrison && !I.garrisons.includes(u.area ?? -1)));   // garrisons: only those on the card (not Mt Hermon)
  for (const u of g.units) {
    u.reserve = null; u.from = undefined;
    if (u.side === 'syrian' && regular(u) && u.area != null) { u.box = 'deploy'; u.area = null; }       // 20.35: the sixteen at the player's discretion
    if (syArr.has(u.id)) { u.box = undefined; u.area = null; u.arrival = syArr.get(u.id); u.entry = [...S.entry]; }       // 20.36: any friendly Entry Area V-Z; no Operational or Strategic Reserve
    if (I.start?.[u.id] != null) { u.area = I.start[u.id]; u.box = undefined; }                          // 20.34: the area printed on the block on the card
    if (fixed.has(u.id)) { u.arrival = fixed.get(u.id)!.turn; u.entry = fixed.get(u.id)!.entry; }
    if (cupIds.has(u.id)) { u.arrival = undefined; u.entry = cup.entry[u.id]; u.box = cup.start.includes(u.id) ? 'draw_cup' : 'draw_later'; }
  }
  const avail = new Set([...I.available, ...S.available]), holding = new Set(I.air_support_holding), landing = new Set(S.commando_landing);
  const at = new Map<string, number>(); for (const side of [I, S]) for (const [t, l] of Object.entries(side.chits)) for (const id of l) at.set(id, +t);
  g.chits = g.chits.filter((c) => c.kind === 'sa_block' || c.box === 'evacuated_strongpoints' || (c.kind === 'garrison' && c.box === 'map' && I.garrisons.includes(c.area ?? -1)) || avail.has(c.id) || holding.has(c.id) || landing.has(c.id) || at.has(c.id));
  for (const c of g.chits) {
    if (c.kind === 'sa_block' || c.box === 'evacuated_strongpoints' || c.kind === 'garrison') continue;
    if (avail.has(c.id) || landing.has(c.id)) { c.box = 'available'; c.turn = 'S'; }
    else if (holding.has(c.id)) c.box = 'air_support_holding';
    else { c.box = 'future'; c.turn = at.get(c.id)!; }                                                    // the turn on the card, not the label (20.36)
  }
  g.markers = { syrian: { res: S.reserve_markers }, israeli: { res: I.reserve_markers } };
  say(g, 'Operation Al-Owda: the Syrian plan to attack at dawn. Israel places its strongpoints and ghosts and its four reserve markers; Syria places its sixteen units, one per tank-symbol area, its two reserve markers, and lands the 181st and 182nd commandos; then the Syrian Movement Phase of turn 1.');
  return g;
}
/** 20.36: at the start of each Israeli Reinforcement Phase, the listed units go into the Draw Cup, then the listed number is drawn at random; drawn ghosts are set aside. */
/** Advanced ghosts: a ghost drawn from the cup arrives in either Assembly Area, like a unit. */
function newGhost(g: Game): Unit {
  const tpl = g.units.find((u) => u.ghost)!, V = state(g), n = (V.ghostsMade = (V.ghostsMade ?? 0) + 1);
  const u: Unit = { ...JSON.parse(JSON.stringify(tpl)), id: `GH${n}`, area: null, box: undefined, str: 1, reserve: null, moved: false, disorder: 0, arrival: g.turn, entry: ['A', 'B'] };
  g.units.push(u); return u;
}
function alowdaDraw(g: Game) {
  const V = state(g), A = V.alowda, cup = ALO.israeli.draw_cup; if (!isAlOwda(g) || !A?.cup) return;
  for (const id of cup.added[String(g.turn)] ?? []) { A.cup.push(id); unit(g, id).box = 'draw_cup'; }
  const n = Math.min(cup.draws[String(g.turn)] ?? 0, A.cup.length), got: string[] = [];
  for (let k = 0; k < n; k++) {
    const pick = A.cup.splice(Math.floor(rngf(g) * A.cup.length), 1)[0]; A.drawn!.push(pick);              // a uniform draw that spends no dice
    if (pick.startsWith('ghost')) { if (g.opts.advGhosts) { got.push(newGhost(g).name); continue; } got.push('a ghost (set aside)'); continue; }
    const u = unit(g, pick); u.box = undefined; u.arrival = g.turn; got.push(u.name);
  }
  if (n) say(g, `Reinforcements Draw Cup: ${got.join(', ')} (20.36)`, 'israeli');
}
/** 20.35: while setting up, Syria lands its two commandos in vacant Israeli-held areas east of the Jordan, not on Mt Hermon or Ma'agan. */
/** The two commandos the card lands at the start, still to place. */
export const alowdaCommandos = (g: Game) => (isAlOwda(g) && g.phase === 'deploy' ? g.chits.filter((c) => ALO.syrian.commando_landing.includes(c.id) && c.box === 'available') : []);
export const alowdaRaidAreas = (g: Game) => (isAlOwda(g) && g.phase === 'deploy' && alowdaCommandos(g).length > 0
  ? [...areas.keys()].filter((a) => !isAssembly(a) && a !== HERMON && a !== 17 && !WEST_OF_JORDAN.includes(a) && g.control[a] === 'israeli' && vacant(g, a)) : []);
export function alowdaRaid(g: Game, chitId: string, a: number) {
  need(alowdaRaidAreas(g).includes(a), 'a vacant Israeli-held area east of the Jordan (not Mt Hermon or Ma\'agan)');
  const c = chit(g, chitId); need(ALO.syrian.commando_landing.includes(c.id) && c.box === 'available', 'the 181st or 182nd commandos (Al-Owda Setup Card)');
  c.box = 'map'; c.area = a; g.units = g.units.filter((x) => x.id !== `R-${c.id}`); g.units.push(asGarrison(c, 'R', a, 'infantry', c.q ?? 'veteran')); state(g).raids.push(a); state(g).alowda!.raids++;
  say(g, `Commandos land in ${nameOf(a)} (20.35)`, 'syrian');
}

/* ================= movement (14.x), through ../golan/move.ts ================= */
const interdictedBy = (g: Game, a: number): Side | undefined => { const id = g.interdicted[a]; return id ? chit(g, id).side : undefined; };
function moveCtx(g: Game): GMoveCtx {
  const V = state(g), count = (a: number, f: (u: Unit) => boolean): Record<GSide, number> => ({ israeli: unitsIn(g, a, 'israeli').filter(f).length, syrian: unitsIn(g, a, 'syrian').filter(f).length });
  return { turn: g.turn, night: isNight(g), units: (a) => (isAssembly(a) ? { israeli: 0, syrian: 0 } : count(a, (u) => !u.garrison)), assets: (a) => count(a, (u) => !!u.garrison), controller: (a) => (isAssembly(a) ? boxSide(a) : g.control[a]) as GSide | undefined,
    bridgedDitch: new Set(V.bridgedDitch), blownBridges: new Set(g.blown), minefields: new Set(V.minefields), crossedThisPhase: new Set(V.crossed),
    interdicted: (a) => interdictedBy(g, a) as GSide | undefined, raids: new Set(V.raids), roadblocks: new Map(Object.entries(g.roadblocks).map(([a, s]) => [+a, s as GSide])) };
}
const asMover = (g: Game, u: Unit, one: boolean): GMoveUnit => ({ areasMoved: g.moving?.id === u.id ? g.moving.steps : 0, slowField: !!g.opts.t62 && T62.has(u.id), side: u.side as GSide, cls: u.cls, area: u.area!, supplied: !u.unsupplied, disordered: u.disorder > 0, adjacentOnly: one || !!u.adjOnly, spent: u.spent, minefieldFailed: state(g).minefieldFailed.includes(u.id) });
function golanReach(g: Game, u: Unit, one: boolean): Opt[] {
  if (isNafakh(g) && u.id === 'S03' && !state(g).nafakh?.s03Free) return [];                       // 22.46: the 33rd holds Tel Fazra
  const ctx = { ...moveCtx(g), room: g.opts.advGhosts ? (a: number) => ghostRoom(g, u, a) : undefined };
  let r = u.ghost ? ghostReach(g, u, one, ctx) : reachable(asMover(g, u, one), ctx);
  if (state(g).kingHassan && u.id === 'S07') r = r.filter((x) => x.path.slice(1).every((a) => isAssembly(a) || g.control[a] !== 'israeli'));   // 17.24: the Moroccans keep out of Israeli-controlled areas
  return r.map((x) => ({ area: x.area, cost: x.cost, fuel: false, mustStop: x.mustStop, path: x.path, triggers: x.triggers, limited: x.limited }));
}
/** 14.02: crossing a minefield from the starting area costs +1 MP and a morale check; failing, the unit stays (having spent that 1 MP), may not try another minefield this turn, and may move on into a non-mined area. */
function beforeMove(g: Game, u: Unit, opt: Opt) {
  const w = withdrawal(g, u, opt); if (w) return w;
  if (u.side !== 'syrian') return;
  const key = edgeKey(opt.path[0], opt.path[1]); if (!state(g).minefields.includes(key)) return;
  const sn = golanMoraleSn(g, u, 'check'), { r, ok } = moraleCheck(g, u, sn, 'Minefield (14.02)');
  if (ok) { say(g, `${u.name} crosses the minefield (${r} vs ${sn})`); return; }
  state(g).minefieldFailed.push(u.id); u.spent = (u.spent ?? 0) + 1;   // only the attempt's extra MP: it never crossed, and may go on into a non-mined area
  say(g, `${u.name} fails the minefield check (${r} vs ${sn}) and stays in ${areas.get(opt.path[0])!.name}`); return 'minefield';
}
/** 18.2 (optional) Withdrawal: the last unit to leave a contested area in the Movement Phase checks morale; failing, it is disordered and its
 *  move ends in the first area it enters (it stays put when it may not stop there). */
function withdrawal(g: Game, u: Unit, opt: Opt) {
  const V = state(g), from = opt.path[0];
  if (!g.opts.withdrawal || g.phase !== 'movement' || isAssembly(from) || !contested(g, from) || (V.withdrew ??= []).includes(u.id)) return;
  if (unitsIn(g, from, u.side).some((x) => x.id !== u.id && regular(x))) return;
  V.withdrew.push(u.id);
  const sn = golanMoraleSn(g, u, 'check'), { r, ok } = moraleCheck(g, u, sn, 'Withdrawal (18.2)');
  if (ok) { say(g, `${u.name} withdraws from ${nameOf(from)} in good order (${r} vs ${sn}, 18.2)`); return; }
  u.disorder = 1; const first = opt.path[1], can = moveOptions(g, u.id).some((x) => x.area === first);   // disordered now: it may no longer stop among enemy units (9.33d)
  say(g, `${u.name} fails its withdrawal check (${r} vs ${sn}): disordered, its move ends in ${nameOf(can ? first : from)} (18.2)`);
  if (can) seriesMove(g, u.id, first);
  u.moved = true; return 'withdrawal';
}
function afterMove(g: Game, u: Unit, opt: Opt) {
  const V = state(g), from = opt.path[0], to = opt.area, prev = opt.path[opt.path.length - 2], last = connection(prev, to)!, key = edgeKey(prev, to);
  for (const l of opt.limited ?? []) if (!V.crossed.includes(l)) V.crossed.push(l);
  if (unitsIn(g, to, other(u.side)).length && ((last.atDitch && !V.bridgedDitch.includes(key)) || last.rugged || last.escarpment || (last.river && (last.type !== 'road' || g.blown.includes(key))))) (V.assaultEntered[to] ??= []).push(u.id);   // 14.01 (a: rugged, escarpment, AT ditch)
  if (u.side === 'israeli' && !V.purpleLineCrossed && !isAssembly(from) && !garea(from).syria && !isAssembly(to) && garea(to).syria) purpleLineCrossed(g);
  if (u.side === 'israeli' && V.raids.includes(to)) resolveRaid(g, u, to, opt.cost);
  if (u.side === 'syrian') { const c = raidUnitAt(g, to); if (c) { chit(g, c.chitId!).box = 'used'; c.area = null; c.str = 0; V.raids = V.raids.filter((a) => a !== to); V.raidPartial = V.raidPartial.filter((a) => a !== to); say(g, `${u.name} relieves the commandos in ${areas.get(to)!.name}`); } }
  if (u.side === 'israeli' && regular(u)) evacuateStrongpoint(g, from);
  ghostsMet(g, u, to, opt.cost);
}
/** 15.2, 15.4a: the first Israeli unit into Syria releases at once the 3rd Tank Division and two Strategic Reserve units of the Syrian
 *  player's choice (`choice`; by default the first two still held: Assad, then the 141st), each placed in a friendly-controlled Entry area.
 *  A unit with no open Entry area waits in the Arriving box for the next Reinforcement Phase. */
export function purpleLineCrossed(g: Game, choice?: string[]) {
  state(g).purpleLineCrossed = true;
  const held = g.units.filter((x) => x.box === 'strategic_reserve'), sr = choice ? held.filter((u) => choice.includes(u.id)) : held;
  for (const u of [...g.units.filter((x) => x.box === 'operational_reserve'), ...sr.slice(0, 2)]) if (!releaseUnit(g, u)) u.box = 'arriving';
  say(g, 'Israeli units cross the Purple Line: the 3rd Tank Division and two Strategic Reserve units are released (15.2, 15.4a)');
}
/** Friendly-controlled Entry areas of a released Syrian unit with room for it (14.61b, 15.2, 17.11). */
export const releaseAreas = (g: Game, u: Unit) => (u.entry ?? []).map((l) => (l.startsWith('#') ? +l.slice(1) : ENTRY[l])).filter((a) => a != null && g.control[a] === u.side
  && !unitsIn(g, a, other(u.side)).length && unitsIn(g, a, u.side).filter(regular).length < 2);
/** Place a released unit in an Entry area at once (`at`, or the first open one); false when none is open. */
function releaseUnit(g: Game, u: Unit, at?: number): boolean {
  const ok = releaseAreas(g, u), a = at ?? ok[0]; if (a == null || !ok.includes(a)) return false;
  Object.assign(u, { box: undefined, area: a, arrival: g.turn, moved: false, spent: 0 }); g.arrived.push(u.id); say(g, `${u.name} enters in ${nameOf(a)}`, u.side);
  return true;
}
/** 16.11a: the first Israeli unit into a raided area rolls: 1–2 the raid succeeds, 3–5 partly (the commandos do not fire back), 6+ the helicopters were shot down. */
function resolveRaid(g: Game, u: Unit, a: number, cost: number) {
  const V = state(g), die = rollDie(g), r = g.opts.raidMod && eastOfSam(a) ? die - 1 : die, c = raidUnitAt(g, a); V.raids = V.raids.filter((x) => x !== a);   // optional: −1 east of the SAM barrier
  if (r >= 6) { if (c) eliminate(g, c); u.moved = false; u.spent = cost; say(g, `Commando raid in ${areas.get(a)!.name} fails (${r}): the helicopters are shot down, ${u.name} may move on`); return; }
  if (r >= 3) V.raidPartial.push(a);
  say(g, `Commando raid in ${areas.get(a)!.name} ${r <= 2 ? 'succeeds' : 'partly succeeds'} (${r}): ${u.name} stops and must fight it`);
}
/** 15.6: once the regular units leave a contested area, its strongpoint is evacuated and a matching Task Force goes into the Israeli cup. */
/** Errata (9/2017): an Israeli attack in an area holding an Israeli strongpoint. The strongpoint may take part only by being removed from play
 *  and replaced at once by its Task Force (armor or infantry supported, as for evacuation, 15.6), committed to the battle; this cannot be undone. */
export function strongpointSwapOption(g: Game): { unit: string; chit: string } | null {
  const b = g.battle; if (!b || b.stage !== 'setup' || b.attacker !== 'israeli' || battleState(b).spSwap) return null;
  const sp = unitsIn(g, b.area, 'israeli').find((u) => u.fort && !u.ghost); if (!sp) return null;
  const tf = g.chits.find((c) => c.box === 'evacuated_strongpoints' && c.kind === 'task_force' && c.name.includes(sp.fort === 'armor' ? 'armor' : 'infantry'));
  if (!tf) return null;
  const lim = limits(g, b, 'israeli'); if (b.assets.israeli.filter((id) => isBattleAsset(chit(g, id))).length >= lim.battle) return null;
  return { unit: sp.id, chit: tf.id };
}
export function swapStrongpointIntoAttack(g: Game) {
  const o = strongpointSwapOption(g); need(!!o, 'no strongpoint of the attack to commit (errata: Israeli attack in an area with a strongpoint)');
  const b = g.battle!, sp = unit(g, o!.unit), tf = chit(g, o!.chit);
  sp.area = null; sp.box = 'evacuated'; tf.box = 'map'; b.assets.israeli.push(tf.id); battleState(b).spSwap = tf.id; b.locked = true;
  say(g, `The strongpoint in ${nameOf(b.area)} joins the attack as the ${tf.name} (errata): it is removed from play for good`, 'israeli');
}
/** The Task Force that replaced a strongpoint stays in its battle. */
const keepAssigned = (_g: Game, b: Battle, c: Chit) => battleState(b).spSwap === c.id;
function evacuateStrongpoint(g: Game, a: number) {
  const sp = unitsIn(g, a, 'israeli').find((u) => u.fort); if (!sp || !unitsIn(g, a, 'syrian').some(regular) || unitsIn(g, a, 'israeli').some(regular)) return;
  sp.area = null; sp.box = 'evacuated';
  const tf = g.chits.find((c) => c.box === 'evacuated_strongpoints' && c.kind === 'task_force' && c.name.includes(sp.fort === 'armor' ? 'armor' : 'infantry'));
  if (tf) tf.box = 'cup';
  say(g, `The strongpoint in ${areas.get(a)!.name} is evacuated; a Task Force goes into the Israeli cup (15.6)`);
}
/** Strategic movement (14.8): roads only, never into an Assembly area from the map, not over an unbridged ditch, not across the operational boundary (Syrians to turn 4), not into an interdicted or raided area. */
function stratStep(g: Game, u: Unit, a: number, n: number): boolean {
  const c = connection(a, n)!, V = state(g);
  if (isAssembly(n) && !isAssembly(a)) return false;
  if (c.type !== 'road' && !(c.type === 'special' && isAssembly(a) && isAssembly(n))) return false;
  if (c.atDitch && !V.bridgedDitch.includes(edgeKey(a, n))) return false;
  if (u.side === 'syrian' && g.turn <= 4 && c.sector) return false;
  if (interdictedBy(g, n) === other(u.side) || (u.side === 'israeli' && V.raids.includes(n))) return false;
  if ((c.escarpment || c.rugged) && V.crossed.includes(edgeKey(a, n))) return false;                   // 14.11/14.14 (player aid A.6, the owner's ruling): one unit per boundary in strategic moves too
  return true;
}

/* ================= supply (9.31, 14.93–14.95) and victory (19.x) ================= */
const sources = (g: Game, side: Side) => new Set(isNafakh(g) ? NAF.sheet.supply[side] : side === 'syrian' ? Object.values(ENTRY) : [...areas.values()].filter((a) => a.supply).map((a) => a.id));   // 22.46: the sources printed on the Nafakh sheet
function supplyStep(g: Game, side: Side, a: number, n: number, first: boolean) {
  if (isAssembly(n)) return isNafakh(g) && n === REAR && side === 'syrian';                          // the Syrian Rear Area is the Nafakh sheet's Syrian supply source
  const c = connection(a, n)!, key = edgeKey(a, n);
  if (c.hermon) return false;
  if (c.river && g.blown.includes(key) && !first) return false;                                     // 9.31a
  if (c.atDitch && !state(g).bridgedDitch.includes(key) && !first) return false;                     // 14.93
  if (c.escarpment && c.type !== 'road') return false;
  if (side === 'syrian' && state(g).minefields.includes(key)) return false;
  return true;
}
/** 19.1–19.2: Syria scores its objective areas (held, supplied and occupied) and the mutual stars; Israel the mutual stars and each supplied area it holds in Syria; one point per large enemy unit destroyed. */
function golanVictory(g: Game): Record<Side, number> & { net: number } {
  if (isNafakh(g)) { const s = strengthIn(g, 'syrian'), i = strengthIn(g, 'israeli'); return { syrian: s, israeli: i, net: s - i }; }   // 22.47: the score is the strength in Nafakh
  const pts: Record<Side, number> = { syrian: 0, israeli: 0 };
  for (const id of g.elimLarge) { const u = g.units.find((x) => x.id === id)!; pts[other(u.side)]++; }
  for (const a of areas.values()) {
    if (isAssembly(a.id)) continue;
    const ctl = g.control[a.id]; if (!ctl || !inSupply(g, ctl, a.id)) continue;
    if (ctl === 'syrian' && unitsIn(g, a.id, 'syrian').some(regular)) pts.syrian += a.vp.syrian + (a.vp.mutual ? 1 : 0);
    if (ctl === 'israeli') pts.israeli += (a.vp.mutual ? 1 : 0) + ((isAlOwda(g) ? VP_EAST.has(a.id) : garea(a.id).syria) ? 1 : 0);   // 20.38: Al-Owda counts east of its Israeli VP Line, not the Purple Line
  }
  pts.israeli += Math.max(0, (state(g).chem ?? 0) - 1);                                                       // chemical warfare after the first use
  return { ...pts, net: pts.syrian - pts.israeli };
}
const finalResult = (g: Game, net: number) => isNafakh(g) ? nafakhResult(g) : (net === 0 ? 'Draw (0 net VP)' : `${net > 0 ? 'Syrian' : 'Israeli'} ${Math.abs(net) >= 3 ? 'Operational' : 'Marginal'} Victory (${Math.abs(net)} net VP)`);
/** 14.17: west of the Jordan = Gadot, Kfar Hanasi and Almagor. The rule book prints "areas 6, 7, 8"; the map numbers them 6, 9, 10 (docs/NOTES.md). */
const WEST_OF_JORDAN = [6, 9, 10];
/** 19.5: a supplied Syrian unit west of the Jordan at the end of an Israeli player turn. */
const jordanCrossed = (g: Game) => g.units.some((u) => u.side === 'syrian' && regular(u) && u.area != null && WEST_OF_JORDAN.includes(u.area) && inSupply(g, 'syrian', u.area));

/* ================= phases ================= */
function onPhase(g: Game, phase: string, when: 'start' | 'mid' | 'end') {
  const V = state(g); nafakhStaff(g);
  if (phase === 'reinforcement' && when === 'start') V.minefieldFailed = [];
  if (phase === 'strategic' && when === 'start') V.crossed = [];                                      // each phase counts its own crossings
  if ((phase === 'movement' || phase === 'btMove' || phase === 'reaction') && when === 'start') { V.crossed = []; V.assaultEntered = {}; V.withdrew = []; }
  if (phase === 'admin' && when === 'start') V.artyInt = [];
  if (phase === 'deploy' && when === 'end' && g.units.some((u) => u.box === 'deploy')) throw new Error('place every unit first');
  if (phase === 'deploy' && when === 'end' && V.minesLeft) throw new Error(`place the Israeli minefields first (${V.minesLeft} left, 14.02)`);
  if (phase === 'deploy' && when === 'end') for (const sd of sidesOf(g)) if (setupReserves(g, sd).all && reservesLeft(g, sd)) throw new Error(`place the ${sd === 'israeli' ? 'Israeli' : 'Syrian'} reserve markers first (${reservesLeft(g, sd)} left)`);
  if (phase === 'deploy' && when === 'end' && alowdaRaidAreas(g).length) throw new Error(`land the Syrian commandos first (${alowdaCommandos(g).length} left, 20.35)`);
  if (phase === 'admin' && when === 'end' && V.samTarget) throw new Error('Syria must answer the Israeli air mission first: fire a SAM or let it fly (16.12)');
  if (phase === 'admin' && when === 'end') V.intel = undefined;
  if (phase === 'admin' && when === 'start') V.samCancelled = [];
  if (phase === 'supply' && when === 'mid' && g.phasing === 'israeli') {                              // 16.31b: interdiction lasts to the second player's Supply Phase
    g.interdicted = {};
    for (const c of g.chits) if (c.mission === 'interdiction' && c.box === 'map') { c.box = 'used'; c.area = undefined; c.mission = undefined; }
  }
  if (phase === 'supply' && when === 'end' && g.phasing === 'israeli' && !isNafakh(g) && !isAlOwda(g) && jordanCrossed(g)) g.over = 'Syrian Automatic Victory: a supplied Syrian unit west of the Jordan (19.5)';
}
/** The Reinforcement Phase's Golan extras: the SAM barrier reduction (16.12) and the units released into the Arriving box. */
function reinforce(g: Game, side: Side) {
  if (side === 'israeli') alowdaDraw(g);
  if (side === 'syrian') {
    const sams = g.chits.filter((c) => c.kind === 'sam' && c.box === 'used'), rolls = sams.map(() => rollDie(g));
    if (rolls.some((r) => r >= 6)) { sams[0].box = 'eliminated'; samEliminated(g); say(g, `SAM reduction rolls ${rolls.join(', ')}: one SAM asset is eliminated (16.12)`, side); }
  }
  for (const u of g.units) if (u.side === side && u.box === 'arriving') { u.box = undefined; u.arrival = g.turn; }
}
/** 16.23: the first three SAM losses each bring a conditional Israeli air support asset into the cup. */
export function samEliminated(g: Game) {
  const V = state(g); if (V.airReleased >= 3) return;
  const c = g.chits.find((x) => x.box === 'air_support_holding'); if (c) { c.box = 'cup'; V.airReleased++; }
}
/** 17.22 Operation Dugman 5: must be played when drawn; one die per Syrian SAM in the Available Box. */
export function resolveDugman(g: Game, c: Chit) {
  c.box = 'eliminated';
  for (const sam of g.chits.filter((x) => x.kind === 'sam' && x.box === 'available')) {
    const die = rollDie(g);
    if (die === 1) { sam.box = 'eliminated'; samEliminated(g); say(g, `Dugman 5: ${die}, great success: a SAM battery is destroyed`, 'israeli'); }
    else if (die <= 3) { sam.box = 'cup'; say(g, `Dugman 5: ${die}, limited success: a SAM goes back into the cup`, 'israeli'); }
    else if (die <= 9) say(g, `Dugman 5: ${die}, failure`, 'israeli');
    else { const air = g.chits.find((x) => x.kind === 'air_mission' && x.side === 'israeli' && x.box === 'available') ?? g.chits.find((x) => x.kind === 'air_mission' && x.side === 'israeli' && x.box === 'cup'); if (air) air.box = 'eliminated'; say(g, `Dugman 5: ${die}, a really bad idea: an Israeli air asset is lost`, 'israeli'); }
  }
}

/* ================= combat (Combat Play Aid, 15.12, 15.51, 16.12, 16.21, 16.22, 16.24, 17.33, 17.34) ================= */
const golanSuccessNumber = (s: Shooter, t: Target, c: Setting) => gSuccessNumber(s as unknown as GShooter, t as GTarget, { firerIsAttacker: c.attacker, tdn: c.tdn, assault: c.riverAssault, night: c.night });
const golanMoraleSn = (g: Game, u: Unit, why: 'exploit' | 'supply' | 'check') => gMoraleSn(q(u), { disordered: u.disorder > 0, unsupplied: why === 'supply' || u.unsupplied, nightExploitation: why === 'exploit' && isNight(g) });
const mixedDivisions = (g: Game, a: number, side: Side = 'syrian') => new Set(unitsIn(g, a, side).filter((u) => regular(u) && u.division).map((u) => u.division)).size > 1;   // 15.12; 18.5 (optional) for Israel
/** How many assets a side may commit here (6.22/6.23, 15.12 mixed Syrian divisions, 16.21 Mt Hermon, 16.22 Israeli air against SAMs). */
export function limits(g: Game, b: Battle, side: Side) {
  const V = state(g); if (g.control[HERMON] === 'syrian') V.hermonLost = true;                      // 16.21: for the rest of the game
  const hermon = side === 'israeli' && !V.hermonLost && g.control[HERMON] === 'israeli' && unitsIn(g, HERMON, 'israeli').length > 0;
  const samUp = g.chits.some((c) => c.kind === 'sam' && c.box === 'available');
  const lim = assetLimits(side as GSide, side === b.attacker, { mixedDivisions: (side === 'syrian' || !!g.opts.israeliDivisions) && mixedDivisions(g, b.area, side), israeliHoldsHermon: hermon, eastOfSamBarrier: eastOfSam(b.area), samAvailable: samUp });
  const alone = unitsIn(g, b.area, side).every((u) => u.garrison);                                  // 4.35, 16.24, 16.11a, 17.23: a garrison, raid or Lt. Zvika fighting alone
  return alone ? { ...lim, artillery: 1, battle: 0, events: 0, air: 0, alone } : { ...lim, alone };
}
function canAssign(g: Game, b: Battle, side: Side, c: Chit, mode?: 'arty' | 'support'): string | null {
  const V = state(g), B = battleState(b);
  if (side !== b.attacker && B.ew?.pending) return 'answer the jamming first (17.33)';
  if (side !== b.attacker && B.defLocked) return 'all defending units are jammed: no artillery, air, SAM or battle assets (17.33)';
  const lim = limits(g, b, side), mine = b.assets[side].map((id) => chit(g, id));
  if (lim.alone && !isArty(c)) return 'a standing asset fighting alone gets one artillery asset only (4.35)';
  if (c.kind === 'air_mission') {
    if (lim.battle === 0 && (mode ?? 'arty') === 'support') return 'mixed divisions: air support may only fire as artillery (15.12)';                                                                    // 16.31a, 16.22; air needs no supply
    if (isNight(g)) return 'no air support on the night turn (14.03)';
    if (g.opts.syrianAirAttack && side === 'syrian' && b.attacker !== 'syrian') return 'Syrian air support flies close air support only when Syria attacks (18.4)';
    if (side === 'israeli' && B.samCancelled) return 'a SAM cancelled the air mission here: no replacement air asset in this battle (16.12)';
    const air = airOf(b, side);
    if (air.length >= lim.air) return lim.air === 2 ? 'at most two air support assets' : 'one air support asset per battle';
    if (air.length === 1 && air[0].mode === (mode ?? 'arty')) return 'with two air assets, one fires as artillery and the other supports a unit (16.22)';
    return null;
  }
  if (V.airAssaultArea === b.area && side === 'syrian' && !inSupply(g, side, b.area)) return 'an air assault that cannot trace supply gets only one air support asset (15.3)';
  if (!inSupply(g, side, b.area) || unitsIn(g, b.area, side).some((u) => u.unsupplied)) return 'units that cannot trace supply may not have assets (9.34a)';
  const hermonOk = (x: Chit) => ['infantry_asset', 'commando', 'engineer'].includes(x.kind) || (x.kind === 'task_force' && x.name.includes('infantry'));   // 13.3 infantry class
  if (b.area === HERMON && !hermonOk(c)) return 'on Mt Hermon only infantry-class battle assets and air support (14.16)';
  if (isArty(c)) return mine.filter(isArty).length >= lim.artillery ? `at most ${lim.artillery} artillery asset(s)` : null;
  if (isBattleAsset(c)) {
    if (c.kind === 'commando' && c.side !== 'syrian') return 'Syrian only';
    return mine.filter(isBattleAsset).length >= lim.battle ? (lim.battle ? `at most ${lim.battle} battle assets` : side === 'syrian' ? 'mixed Syrian divisions: no battle assets (15.12)' : 'mixed Israeli divisions: no battle assets (18.5)') : null;
  }
  return 'this counter is not assigned to battles (events come with the event rules)';
}
const samAvailable = (g: Game) => g.chits.some((c) => c.kind === 'sam' && c.box === 'available');
/** 16.12: an Israeli air asset placed east of the SAM barrier may be answered at once by an available SAM. */
function onAssign(g: Game, b: Battle, c: Chit) { if (c.kind === 'air_mission' && c.side === 'israeli' && eastOfSam(b.area) && samAvailable(g) && !(b.attacker === 'israeli' && battleState(b).defLocked)) state(g).samTarget = c.id; }   // 17.33: a jammed defence fires no SAM
function beforeBegin(g: Game, b: Battle) { if (state(g).samTarget) throw new Error('the SAM answer to the air mission is pending (16.12)'); if (battleState(b).ew?.pending) throw new Error('the Defender must answer the jamming first (17.33)'); }
/** The air mission taken back (or its battle withdrawn): no SAM answer is pending any more. */
function onUnassign(g: Game, b: Battle, c: Chit) { const V = state(g), B = battleState(b); if (V.samTarget === c.id) V.samTarget = undefined; if (B.dcs) B.dcs = B.dcs.filter((x) => x !== c.id); }
function onBattle(g: Game, b: Battle, when: 'begin' | 'end') {
  const V = state(g);
  if (when === 'begin') for (const u of unitsIn(g, b.area)) if (u.ghost) { u.area = null; u.str = 0; say(g, `A Ghost is revealed in ${areas.get(b.area)!.name} and removed (15.7)`); }
  if (when === 'end') {
    for (const u of g.units) if (u.rec) { u.rec = 0; if (u.area != null && u.disorder === 0) u.disorder = 2; }        // artillery vs armour: one marker stays, the unit recovers in the Supply Phase
    if (V.airAssaultArea === b.area) V.airAssaultArea = undefined;
    V.raids = V.raids.filter((a) => raidUnitAt(g, a)); V.raidPartial = V.raidPartial.filter((a) => raidUnitAt(g, a));
    if (g.control[HERMON] === 'syrian') V.hermonLost = true;
  }
}
/** Brigade integrity (15.51), the Moroccans' passivity (17.24), a partly successful raid (16.11a) and an engineer bridging instead of firing (14.51b). */
function adjustFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground', list: Fire[]) {
  optionalFire(g, b, side, kind, list);
  if (kind !== 'ground') return;
  const V = state(g), B = battleState(b), drop = (f: (x: Fire) => boolean) => { for (let i = list.length - 1; i >= 0; i--) if (f(list[i])) list.splice(i, 1); };
  if (side === b.attacker && V.kingHassan) drop((f) => f.key === 'S07');
  if (side === 'syrian' && V.raidPartial.includes(b.area)) drop((f) => { const u = g.units.find((x) => x.id === f.key); return !!u?.garrison && !!u.chitId && chit(g, u.chitId).kind === 'commando'; });
  if (side === b.attacker && B.engBridge) drop((f) => f.isAsset && b.assets[side].includes(f.key) && chit(g, f.key).kind === 'engineer');
  if (side === 'israeli') {
    const firers = list.filter((f) => !f.isAsset).map((f) => ({ brigade: g.units.find((u) => u.id === f.key)?.brigade, sn: f.sn, side: side as GSide })).filter((x): x is { brigade: string; sn: number; side: GSide } => !!x.brigade);
    for (const x of brigadeExtraDie(firers)) list.push({ key: `brigade:${x.brigade}`, who: `${x.brigade} brigade integrity`, shooter: { kind: 'unit', cls: 'infantry', dice: 1 }, dice: 1, sn: x.sn, parts: [['brigade integrity extra die (15.51)', 0]], isAsset: true });
  }
}
/** 14.51b: the engineer survived both fire steps: the ditch is bridged as the attackers fire (it does not fire itself). */
function beforeFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground') {
  const B = battleState(b); if (kind !== 'ground' || side !== b.attacker || !B.engBridge) return;
  const engineers = b.assets.syrian.filter((id) => chit(g, id).kind === 'engineer').length;
  if (b.engFw && engineers < 2) { B.engBridge = undefined; say(g, 'The one engineer removes the field works: the ditch is not bridged (6.33, 14.51b)'); return; }
  if (engineers) { state(g).bridgedDitch.push(B.engBridge); say(g, `A Syrian engineer bridges the AT ditch ${B.engBridge} (14.51b)`); }
}
/** 17.34 Counterbattery: after the enemy artillery fired, 1–5 sends one of its artillery assets that many turns down the track. */
function afterFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground') {
  const B = battleState(b);
  if (kind === 'ground' && side === b.attacker) B.engBridge = undefined;
  if (kind !== 'arty') return;
  const enemy = other(side); if (!B.counterbattery[enemy]) return;
  B.counterbattery[enemy] = undefined;
  const target = b.assets[side].map((id) => chit(g, id)).find(isArty); if (!target) return;
  const die = rollDie(g); b.rolls.push({ who: 'Counterbattery (17.34)', sn: 5, dice: [die], hits: die <= 5 ? 1 : 0, kind: 'morale' });
  if (die > 5) return say(g, `Counterbattery: ${die}, no effect`, enemy);
  target.box = 'future'; target.turn = g.turn + die; target.direct = true; target.area = undefined; b.assets[side] = b.assets[side].filter((x) => x !== target.id);
  say(g, `Counterbattery: ${die}, ${target.name} is put back ${die} turn(s), to turn ${g.turn + die} (17.34)`, enemy);
}

/* ================= additional optional rules (the Battle for Nafakh and Al-Owda scenario sheets, 18.x) ================= */
export const GOLAN_OPTIONAL: OptionalRule[] = [
  { key: 'fwMaintain', rule: '18.1', name: 'Maintaining field works', text: 'Field works in a contested area are not removed automatically: in his own Supply Phase the owner checks morale with one unit there, and only a failure removes them.' },
  { key: 'withdrawal', rule: '18.2', name: 'Withdrawal', text: 'The last unit to leave a contested area in the Movement Phase checks morale; failing, it is disordered and its move ends at once.' },
  { key: 'artyInterdict', rule: '18.31', name: 'Artillery interdiction', text: 'Once per Admin Phase each player may place an available artillery asset next to his units or a strongpoint: the enemy pays +1 MP to enter and to leave, and may not strat-move in or out, until the second Supply Phase.' },
  { key: 'directSupport', rule: '18.32', name: 'Direct combat support (Israeli)', text: 'Israeli artillery assigned to a battle may support instead of firing: +1 to the point unit per asset.' },
  { key: 'syrianAirAttack', rule: '18.4', name: 'Syrian air support use', text: 'Syrian air support flies close air support only when Syria is the Attacker.' },
  { key: 'israeliDivisions', rule: '18.5', name: 'Israeli divisional organization', text: 'Israeli units of different divisions in one area: one artillery asset, no battle assets (as 15.12); merging units (14.61a) must be of the same division.' },
  { key: 'atAssets', rule: '18.6', name: 'Anti-tank assets', text: 'Syrian AT assets fire +1 when the enemy point unit is armour. When Syria defends with an AT asset assigned, Israeli armour fires −1. In Al-Owda (its own sheet): only a defending Syrian AT asset gets the +1, and there is no −1.' },
  { key: 't62', rule: '18.7', name: 'Syrian T-62 tanks', text: 'The 65th, 76th, 81st, 91st and Assad armoured units pay one extra MP to cross a field connection.' },
  { key: 'artyArmor', rule: '18.8', name: 'Artillery vs armour', text: 'Armour takes a recovery marker instead of a step loss from artillery; each marker is −1 in ground fire. After the battle one marker stays (the unit is recovering) until the Supply Phase.' },
  { key: 'zvikaCup', rule: '18.9', name: 'Lt. Zvika variant', text: 'In the Supply Phase Israel may take Lt. Zvika back off the map into the Selection Cup, to play him again when drawn.' },
  { key: 'raidMod', rule: '18.10', name: 'Commando raid modifier', text: 'A commando raid east of the SAM barrier gets −1 on the die (better for Syria).' },
  { key: 'battleRecovery', rule: '18.11', name: 'Battlefield recovery', text: 'Disordered or recovering units in a contested area improve in the Supply Phase only by passing a morale check.' },
  { key: 'chemical', rule: 'A 18.7', name: 'Chemical warfare', text: 'As the defender, Syria spends the reusable Special Action: one artillery asset (or air support firing as artillery) fires +2. Every use after the first gives Israel 1 VP.' },
  { key: 'flank', rule: 'A 18.8', name: 'Flank assault (Israelis)', text: 'Attacking with two units, Israel spends a Special Action: the second unit flanks, fires +1 and takes no hits while the point unit stands.' },
  { key: 'advGhosts', rule: 'A 18.10', name: 'Advanced ghost units', text: 'Ghosts move (as armour or infantry), may be reserves, never create a contested area, overstack by one, and vanish when a Syrian unit enters their area alone. In Al-Owda a ghost drawn from the cup arrives in an Assembly Area.' },
];
const T62 = new Set(['S19', 'S20', 'S21', 'S26', 'S27']);                                            // 65th, 76th, 81st, 91st, Assad (all Elite)
const isAT = (c: Chit) => c.side === 'syrian' && /\bAT$/.test(c.name);
const pointOf = (g: Game, b: Battle, side: Side) => g.units.find((u) => u.id === (side === b.attacker ? b.attPoint : b.defPoint));
const bump = (f: Fire, by: number, why: string) => { f.sn += by; f.parts.push([why, by]); };
function optionalFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground', list: Fire[]) {
  const o = g.opts, B = battleState(b), enemyPoint = pointOf(g, b, other(side));
  if (o.chemical && kind === 'arty' && B.chem) for (const f of list) if (f.key === B.chem) bump(f, 2, 'chemical warfare');
  const dcs = o.directSupport && side === 'israeli' ? (B.dcs ?? []).filter((id) => b.assets.israeli.includes(id)) : [];     // 18.32: they support instead of firing
  if (kind === 'arty' && dcs.length) for (let i = list.length - 1; i >= 0; i--) if (dcs.includes(list[i].key)) list.splice(i, 1);
  if (kind !== 'ground') return;
  const own = pointOf(g, b, side);
  if (dcs.length && own) for (const f of list) if (f.key === own.id) bump(f, dcs.length, `direct combat support ×${dcs.length} (18.32)`);
  const atNarrow = isAlOwda(g);                                                                       // A18.6: in Al-Owda only a defending Syrian AT asset gets +1, and no −1; N18.6 elsewhere
  if (o.atAssets && side === 'syrian' && enemyPoint?.cls === 'armor' && (!atNarrow || b.attacker === 'israeli')) for (const f of list) if (f.isAsset && b.assets.syrian.includes(f.key) && isAT(chit(g, f.key))) bump(f, 1, 'AT asset vs armour (18.6)');
  if (o.atAssets && !atNarrow && side === 'israeli' && b.attacker === 'israeli' && b.assets.syrian.some((id) => isAT(chit(g, id)))) for (const f of list) { const u = g.units.find((x) => x.id === f.key); if (u?.cls === 'armor' && !f.isAsset) bump(f, -1, 'Syrian AT defence (18.6)'); }
  if (o.artyArmor) for (const f of list) { const u = g.units.find((x) => x.id === f.key); if (u?.rec) bump(f, -u.rec, `${u.rec} recovery marker${u.rec > 1 ? 's' : ''}`); }
  if (o.flank && B.flank && side === b.attacker) for (const f of list) if (f.key === B.flank) bump(f, 1, 'flanking (18.8)');
}
/** Artillery vs armour: an armour unit hit by artillery takes a recovery marker instead of a step. */
function absorbLoss(g: Game, b: Battle, _side: Side, u: Unit) {
  if (!g.opts.artyArmor || b.lossKind !== 'arty' || u.cls !== 'armor' || u.fort || u.ghost) return false;
  u.rec = (u.rec ?? 0) + 1; say(g, `${u.name} is buttoned up: a recovery marker instead of a step loss (artillery vs armour)`); return true;
}
/** Flank assault: the flanking unit takes no hits while the point unit is still in the battle. */
function lossOk(g: Game, b: Battle, side: Side, key: string) {
  const B = battleState(b); if (!g.opts.flank || !B.flank || side !== b.attacker || key !== B.flank) return true;
  return !unitsIn(g, b.area, side).some((u) => u.id === b.attPoint);
}
/** Battlefield recovery: in a contested area a unit improves only by passing a morale check. */
function recoverOk(g: Game, u: Unit) {
  if (!g.opts.battleRecovery || u.area == null || !contested(g, u.area)) return true;
  const sn = golanMoraleSn(g, u, 'check'), { r, ok } = moraleCheck(g, u, sn, 'Battlefield recovery (18.11)');
  say(g, `${u.name} ${ok ? 'recovers' : 'stays as it is'} in the front line (${r} vs ${sn}, 18.11)`); return ok;
}
/** Chemical warfare: the Syrian defender spends the reusable Special Action; one artillery asset (or air support firing as artillery) fires +2 this battle. */
export function playChemical(g: Game, assetId: string) {
  const b = g.battle; need(!!g.opts.chemical && !!b && b.stage === 'setup' && b.attacker === 'israeli', 'as the Syrian defender, before the first roll (chemical warfare)');
  const B = battleState(b!); need(!B.chem, 'one chemical attack per battle');
  need(b!.assets.syrian.some((id) => id === assetId && isArty(chit(g, id))) || airOf(b!, 'syrian').some((a) => a.id === assetId && a.mode === 'arty'), 'a Syrian artillery asset (or air support firing as artillery) in this battle');
  const blk = saAvailable(g, 'syrian').find((c) => c.kind === 'sa_block'); need(!!blk, 'the reusable Special Action is not available');
  spendSA(g, 'syrian', undefined, 'chemical warfare', blk!.id); B.chem = assetId;
  const V = state(g); V.chem = (V.chem ?? 0) + 1; say(g, `Chemical warfare: ${chit(g, assetId).name} fires +2${V.chem > 1 ? ' (Israel gains 1 VP)' : ''}`, 'syrian');
}
/** The Syrian artillery a chemical attack could use now (empty when it cannot be played). */
export function chemicalOptions(g: Game): string[] {
  const b = g.battle; if (!g.opts.chemical || !b || b.stage !== 'setup' || b.attacker !== 'israeli' || battleState(b).chem || !saAvailable(g, 'syrian').some((c) => c.kind === 'sa_block')) return [];
  return [...b.assets.syrian.filter((id) => isArty(chit(g, id))), ...airOf(b, 'syrian').filter((a) => a.mode === 'arty').map((a) => a.id)];
}
/** Flank assault: attacking with two units, Israel spends a Special Action; the second unit flanks. */
export function playFlank(g: Game, unitId: string, chitId?: string) {
  need(flankOptions(g).includes(unitId), 'an Israeli unit beside the point unit, attacking, before the first roll (flank assault)');
  const b = g.battle!, u = unit(g, unitId); spendSA(g, 'israeli', u.ech, 'flank assault', chitId); battleState(b).flank = unitId; say(g, `${u.name} flanks: +1 to its fire, the point unit takes the hits`, 'israeli');
}
export function flankOptions(g: Game): string[] {
  const b = g.battle; if (!g.opts.flank || !b || b.stage !== 'setup' || b.attacker !== 'israeli' || battleState(b).flank || !saAvailable(g, 'israeli').length) return [];
  const us = unitsIn(g, b.area, 'israeli').filter(regular); return us.length >= 2 ? us.filter((u) => u.id !== b.attPoint).map((u) => u.id) : [];
}
/** 18.32 (optional) Direct combat support: the Israeli artillery assigned to the open battle that may be switched between firing and supporting. */
export function directSupportOptions(g: Game): string[] {
  const b = g.battle; if (!g.opts.directSupport || !b || b.stage !== 'setup') return [];
  return b.assets.israeli.filter((id) => isArty(chit(g, id)));
}
/** 18.32: an assigned Israeli artillery asset supports the point unit (+1 to its SN) instead of firing; `on` false puts it back to firing. */
export function setDirectSupport(g: Game, chitId: string, on: boolean) {
  need(directSupportOptions(g).includes(chitId), 'an Israeli artillery asset in this battle, before the first roll (18.32)');
  const B = battleState(g.battle!), dcs = (B.dcs ?? []).filter((x) => x !== chitId); B.dcs = on ? [...dcs, chitId] : dcs;
  say(g, `${chit(g, chitId).name} ${on ? 'gives direct combat support to the point unit (18.32)' : 'fires as artillery'}`, 'israeli');
}
/** 18.32: an artillery asset in direct combat support may take a step loss, like a battle asset (needs the series loss pool to ask this hook). */
const lossAsset = (g: Game, b: Battle, side: Side, id: string) => !!g.opts.directSupport && side === 'israeli' && (battleState(b).dcs ?? []).includes(id) && b.assets.israeli.includes(id);
/** Lt. Zvika variant: in the Supply Phase Israel takes Lt. Zvika off the map, back into the Selection Cup. */
export function zvikaToCup(g: Game) {
  const z = zvikaOnMap(g); need(!!z, 'Lt. Zvika is not on the map in the Supply Phase (Lt. Zvika variant)');
  z!.area = null; z!.str = 0; const c = chit(g, z!.chitId!); c.box = 'cup'; c.area = undefined; say(g, 'Lt. Zvika is taken back into the Selection Cup', 'israeli');
}
export const zvikaOnMap = (g: Game) => (g.opts.zvikaCup && g.phase === 'supply' && g.phasing === 'israeli' ? g.units.find((u) => u.area != null && u.chitId && chit(g, u.chitId).kind === 'event_lt_zvika') : undefined);
/** Advanced ghosts: the best of an armour and an infantry move, never into an area that would become contested. */
function ghostReach(g: Game, u: Unit, one: boolean, ctx: GMoveCtx) {
  const all = new Map<number, ReturnType<typeof reachable>[number]>();
  for (const cls of ['armor', 'infantry'] as const) for (const r of reachable({ ...asMover(g, u, one), cls }, ctx)) { const o = all.get(r.area); if (!o || r.cost < o.cost) all.set(r.area, r); }
  return [...all.values()].filter((r) => !(unitsIn(g, r.area, 'syrian').length && !contested(g, r.area)));
}
/** Advanced ghosts (A 18.10): a ghost may overstack by one, so an area holds at most three Israeli units, of which at most two
 *  are regular (non-ghost) and at most two are ghosts. Without the option, the usual two-unit count. */
function ghostRoom(g: Game, u: Unit, a: number) {
  if (isAssembly(a)) return true;
  const here = unitsIn(g, a, u.side).filter((x) => !x.garrison && x.id !== u.id), gh = here.filter((x) => x.ghost).length;
  if (here.length >= 3) return false;
  return u.ghost ? gh < 2 : here.length - gh < 2 && (here.length < 2 || gh > 0);
}
/** Advanced ghosts: a Syrian unit entering an area held only by ghosts reveals and removes them, and may go on with what MP it has left. */
function ghostsMet(g: Game, u: Unit, to: number, cost: number) {
  if (!g.opts.advGhosts || u.side !== 'syrian') return;
  const here = unitsIn(g, to, 'israeli'); if (!here.length || !here.every((x) => x.ghost)) return;
  for (const x of here) { x.area = null; x.str = 0; }
  updateControl(g, to); u.moved = false; u.spent = cost; say(g, `Only a ghost was in ${nameOf(to)}: it is removed, and ${u.name} may move on`);
}
/** Retreats: no Assembly areas, boundaries the unit could not cross, no raided areas for Israelis (6.5, 14.1x, 16.11a). */
function retreatOk(g: Game, u: Unit, from: number, to: number) {
  if (isAssembly(to)) return false; const c = connection(from, to)!;
  if (c.hermon && u.cls !== 'infantry') return false;
  if (c.rugged && c.type !== 'road' && u.cls === 'armor') return false;
  if (c.escarpment && c.type !== 'road') return false;
  return !(u.side === 'israeli' && state(g).raids.includes(to));
}
/** 14.42: a Syrian unit retreats across the operational boundary only when nothing else is open (turns 1–4). */
function retreatPrefer(g: Game, u: Unit, from: number, opts: number[]) {
  if (u.side !== 'syrian' || g.turn > 4) return opts;
  const inside = opts.filter((n) => !connection(from, n)?.sector); return inside.length ? inside : opts;   // a retreat past a full neighbour ends further away
}
/** A retreat across a minefield costs a morale check (14.02); the strongpoint left behind is evacuated (15.6); a garrison left behind is destroyed (16.24). */
function onRetreat(g: Game, u: Unit, from: number, to: number) {
  if (u.side === 'syrian' && state(g).minefields.includes(edgeKey(from, to))) {
    const sn = golanMoraleSn(g, u, 'check'), { r, ok } = moraleCheck(g, u, sn, 'Retreat through a minefield (14.02)');
    if (!ok) { say(g, `${u.name} retreats through the minefield and loses a step (${r} vs ${sn})`); u.str--; if (u.str <= 0) eliminate(g, u); }
  }
  if (u.side === 'israeli') evacuateStrongpoint(g, from);
  const b = g.battle;
  if (b && b.area === from && b.retreat?.after !== 'sa' && !unitsIn(g, from, u.side).some(regular)) for (const ga of unitsIn(g, from, u.side).filter((x) => x.garrison)) { say(g, `${ga.name} is left behind and destroyed (16.24)`); eliminate(g, ga); }
}
/** 14.01: a crossing assault — every attacker entered across an unbridged AT ditch or a river without a usable bridge. */
function assault(g: Game, area: number) {
  const att = blocks(g, area, g.phasing).filter(regular), in_ = state(g).assaultEntered[area] ?? [];
  return att.length > 0 && att.every((u) => in_.includes(u.id));
}
/** 22.17: a free Breakthrough combat round is still owed (read without spending it). */
export const freeRoundLeft = (g: Game) => g.turn === 1 && g.phasing === 'syrian' && g.phase === 'btCombat' && state(g).freeCombatRound > 0;
function freeBattle(g: Game) {
  const V = state(g); if (!(g.turn === 1 && g.phasing === 'syrian' && V.freeCombatRound > 0)) return false;
  V.freeCombatRound--; return true;                                                                   // 22.17
}

/* ================= the volume's own player actions ================= */
const avail = (g: Game, id: string, kinds: string[]) => { const c = chit(g, id); need(c.box === 'available' && kinds.includes(c.kind), `${c.name} is not available for this`); return c; };
const homeArea = (g: Game, side: Side, a: number) => !isAssembly(a) && supplied(g, side, a);
const vacant = (g: Game, a: number) => !unitsIn(g, a).length;
const used = (c: Chit) => { c.box = 'used'; c.area = undefined; };
const gone = (c: Chit) => { c.box = 'eliminated'; c.area = undefined; };
const reduced = (u: Unit) => u.area != null && regular(u) && u.str < u.max;
const unit = (g: Game, id: string) => { const u = g.units.find((x) => x.id === id); if (!u) throw new Error(`no unit ${id}`); return u; };
const nameOf = (a: number) => areas.get(a)?.name ?? String(a);

/* ---------- engineering (4.3, 14.5) ---------- */
/** 4.31: up to two bridges (river boundaries a road crosses, 14.41) next to one supplied, friendly, uncontested area. */
export function blowBridges(g: Game, chitId: string, from: number, to: number[]) {
  needAdmin(g); const c = avail(g, chitId, ['engineer']);
  need(homeArea(g, c.side, from), 'the engineer works from a supplied, friendly-controlled, uncontested area');
  need(to.length >= 1 && to.length <= 2, 'one or two bridges');
  for (const n of to) { const e = connection(from, n); need(e?.river && e.type === 'road' && !g.blown.includes(edgeKey(from, n)), `no bridge between ${nameOf(from)} and ${nameOf(n)}`); }
  for (const n of to) g.blown.push(edgeKey(from, n));
  used(c); say(g, `${c.name} blows the bridge(s) ${to.map((n) => `${nameOf(from)}–${nameOf(n)}`).join(', ')} (4.31)`, c.side);
}
/** 4.32: repair a blown bridge from a supplied, friendly, uncontested area towards a friendly or contested one. */
export function repairBridge(g: Game, chitId: string, from: number, to: number) {
  needAdmin(g); const c = avail(g, chitId, ['engineer']), key = edgeKey(from, to);
  need(g.blown.includes(key), 'that bridge is not blown');
  need(homeArea(g, c.side, from) && (g.control[to] === c.side || contested(g, to)), 'repair from a supplied, friendly, uncontested area towards a friendly or contested one');
  g.blown = g.blown.filter((x) => x !== key); used(c); say(g, `${c.name} repairs the bridge ${nameOf(from)}–${nameOf(to)} (4.32)`, c.side);
}
/** 4.33: field works where a friendly unit stands (never with a strongpoint, 15.6). */
export function engineerFieldWorks(g: Game, chitId: string, a: number) {
  needAdmin(g); const c = avail(g, chitId, ['engineer']);
  need(homeArea(g, c.side, a) && blocks(g, a, c.side).some(regular), 'a supplied, friendly, uncontested area with a friendly unit');
  need(!g.fieldWorks.includes(a) && !unitsIn(g, a).some((u) => u.fort), 'no field works there (one per area, never with a strongpoint)');
  g.fieldWorks.push(a); g.fwOwner[a] = c.side; used(c); say(g, `${c.name} builds field works in ${nameOf(a)} (4.33)`, c.side);
}
/** 14.51a: bridge an AT ditch boundary (up to eight markers) from a supplied, friendly, uncontested area towards a friendly one or a contested enemy one. */
export function bridgeDitch(g: Game, chitId: string, from: number, to: number) {
  needAdmin(g); const c = avail(g, chitId, ['engineer']), key = edgeKey(from, to), V = state(g);
  need(connection(from, to)?.atDitch && !V.bridgedDitch.includes(key), 'no unbridged AT ditch there');
  need(V.bridgedDitch.length < 8, 'all eight AT Ditch Bridged markers are in use');
  need(homeArea(g, c.side, from) && (g.control[to] === c.side || (contested(g, to) && g.control[to] === other(c.side))), 'bridge from a supplied, friendly, uncontested area towards a friendly one or a contested enemy one');
  V.bridgedDitch.push(key); used(c); say(g, `${c.name} bridges the AT ditch ${nameOf(from)}–${nameOf(to)} (14.51a)`, c.side);
}
/** 14.52 (Syrian only): lift a minefield next to a supplied, friendly, uncontested area. */
export function removeMinefield(g: Game, chitId: string, from: number, to: number) {
  needAdmin(g); const c = avail(g, chitId, ['engineer']), key = edgeKey(from, to), V = state(g);
  need(c.side === 'syrian', 'only Syrian engineers clear minefields');
  need(V.minefields.includes(key) && homeArea(g, 'syrian', from), 'a mined boundary next to a supplied, friendly, uncontested area');
  V.minefields = V.minefields.filter((x) => x !== key); used(c); say(g, `${c.name} clears the minefield ${nameOf(from)}–${nameOf(to)} (14.52)`, c.side);
}
/** 14.51b: a Syrian engineer in a battle on the Israeli side of the ditch may bridge an adjoining AT ditch boundary instead of firing. */
export function setEngineerBridge(g: Game, b: Battle, to: number | null) {
  const B = battleState(b); if (to == null) { B.engBridge = undefined; return; }
  const c = connection(b.area, to);
  need(b.attacker === 'syrian' && !garea(b.area).syria && c?.atDitch && !state(g).bridgedDitch.includes(edgeKey(b.area, to)), 'no AT ditch to bridge there');
  need(b.assets.syrian.some((id) => chit(g, id).kind === 'engineer'), 'assign an engineer asset first');
  B.engBridge = edgeKey(b.area, to);
}

/* ---------- air missions in the Admin Phase (16.31b/c) and commando raids (16.11a) ---------- */
const noSamReplay = (g: Game, a: number) => need(!(state(g).samCancelled ?? []).includes(a), 'a SAM cancelled an air mission over that area: no replacement this phase (16.12)');
const airOk = (g: Game, a: number) => { need(!isNight(g), 'no air missions on the night turn (14.03)'); need(!isAssembly(a), 'not over an Assembly area'); };
export function airInterdiction(g: Game, chitId: string, a: number) {
  needAdmin(g); const c = avail(g, chitId, ['air_mission']); airOk(g, a); need(!g.interdicted[a], 'that area is already interdicted'); noSamReplay(g, a);
  c.box = 'map'; c.area = a; c.mission = 'interdiction'; g.interdicted[a] = c.id;
  if (c.side === 'israeli' && eastOfSam(a) && samAvailable(g)) state(g).samTarget = c.id;
  say(g, `Air interdiction over ${nameOf(a)} (16.31b)`, c.side);
}
/** 18.31 (optional) Artillery interdiction: once per Admin Phase per player, an available artillery asset goes into an area next to friendly units
 *  or a strongpoint; it works as an interdiction mission (16.31b: +1 MP in and out for the enemy, no strat-move) until the second Supply Phase. */
export function artilleryInterdiction(g: Game, chitId: string, a: number) {
  needAdmin(g); need(!!g.opts.artyInterdict, 'artillery interdiction is an optional rule (18.31)');
  const c = chit(g, chitId), V = state(g); need(c.box === 'available' && isArty(c), `${c.name} is not an available artillery asset`);
  need(!(V.artyInt ?? []).includes(c.side), 'one artillery interdiction per player in each Admin Phase (18.31)');
  need(areas.has(a) && !isAssembly(a) && (!g.inPlay || g.inPlay.includes(a)), 'not an area of the map');
  need(!g.interdicted[a], 'that area is already interdicted');
  need(neighbors(a).some((n) => !isAssembly(n) && unitsIn(g, n, c.side).some((u) => regular(u) || !!u.fort)), 'an area next to one holding friendly units or a strongpoint (18.31)');
  c.box = 'map'; c.area = a; c.mission = 'interdiction'; g.interdicted[a] = c.id; (V.artyInt ??= []).push(c.side);
  say(g, `${c.name} interdicts ${nameOf(a)} (18.31)`, c.side);
}
export function airRecon(g: Game, chitId: string, a: number) {
  needAdmin(g); const c = avail(g, chitId, ['air_mission']); airOk(g, a); noSamReplay(g, a);
  need(unitsIn(g, a, other(c.side)).some(regular), 'reconnaissance over an enemy-occupied area');
  c.box = 'map'; c.area = a; c.mission = 'recon';
  if (c.side === 'israeli' && eastOfSam(a) && samAvailable(g)) { state(g).samTarget = c.id; say(g, `Air reconnaissance over ${nameOf(a)}: Syria may answer with a SAM (16.31c)`, c.side); return; }
  finishRecon(g, c);
}
/** The reconnaissance flies: the enemy blocks in the area are shown for the rest of the phase. */
export function finishRecon(g: Game, c: Chit) {
  state(g).intel = { side: c.side, units: unitsIn(g, c.area!, other(c.side)).filter(regular).map((u) => u.id) };
  c.mission = undefined; used(c); say(g, 'Reconnaissance reveals the enemy blocks (16.31c)', c.side);
}
/** 16.11a: a commando from the Available Box lands on a vacant Israeli-controlled area next to a Syrian-occupied one; it stands there like a defended roadblock. */
export function placeRaid(g: Game, chitId: string, a: number) {
  needAdmin(g); const c = avail(g, chitId, ['commando']);
  need(!isAssembly(a) && g.control[a] === 'israeli' && vacant(g, a) && neighbors(a).some((n) => blocks(g, n, 'syrian').some(regular)), 'a vacant Israeli-controlled area next to a Syrian-occupied area');
  c.box = 'map'; c.area = a; g.units = g.units.filter((x) => x.id !== `R-${c.id}`); g.units.push(asGarrison(c, 'R', a, 'infantry', c.q ?? 'veteran')); state(g).raids.push(a);
  say(g, `Commandos land in ${nameOf(a)} (16.11a)`, 'syrian');
}
/** 16.12: the Syrian player answers the Israeli air mission with an available SAM (or declines). */
export function fireSam(g: Game, samId: string) {
  const V = state(g), b = g.battle, airId = V.samTarget; need(airId, 'no Israeli air mission to answer');
  const sam = chit(g, samId); need(sam.kind === 'sam' && sam.box === 'available', 'no SAM asset available');
  const die = rollDie(g), res = samResult(isNafakh(g) ? Math.max(4, g.turn) : g.turn, die); sam.box = 'used'; V.samTarget = undefined;      // 22.46: Nafakh uses the turn 4-6 column
  const a = chit(g, airId!);
  if (a.mission === 'interdiction' && res !== 'none' && a.area != null) delete g.interdicted[a.area];
  if (!b && res !== 'none' && a.area != null) (V.samCancelled ??= []).push(a.area);
  if (a.mission === 'recon' && res === 'none') finishRecon(g, a);
  if (res !== 'none') { a.mission = undefined; a.box = res === 'eliminated' ? 'eliminated' : 'used'; a.area = undefined; if (b) { for (const s of sidesOf(g)) dropAir(b, s, a.id); battleState(b).samCancelled = true; } }
  b?.rolls.push({ who: `SAM against ${a.name}`, sn: 0, dice: [die], hits: res === 'none' ? 0 : 1, kind: 'sam' });
  say(g, `SAM air defence fire: ${die} — ${res === 'eliminated' ? 'the air asset is shot down' : res === 'used' ? 'the air mission is cancelled' : 'no effect'} (16.12)`, 'syrian');
  return res;
}
export function declineSam(g: Game) { const V = state(g), id = V.samTarget; V.samTarget = undefined; const a = id ? chit(g, id) : undefined; if (a?.mission === 'recon') finishRecon(g, a); }

/* ---------- events (17.x, 4.21) ---------- */
const STRATEGIC: Record<string, string> = { Assad: 'S21', '141st': 'S22', '62nd': 'S23' };
/** 17.11: the named Strategic Reserve unit is released and placed at once in a friendly-controlled Entry area (`at`, or the first open one). */
export function playRelease(g: Game, chitId: string, at?: number) {
  needAdmin(g); const c = avail(g, chitId, ['event_release']);
  const id = Object.entries(STRATEGIC).find(([k]) => c.name.startsWith(k))?.[1]; need(id, 'unknown release');
  const u = unit(g, id!); need(u.box === 'strategic_reserve', `${u.name} is already in play`);
  need(at == null ? releaseAreas(g, u).length > 0 : releaseAreas(g, u).includes(at), 'a friendly-controlled Entry area with room (17.11)');
  say(g, `${u.name} released from the Strategic Reserve (17.11)`, 'syrian'); releaseUnit(g, u, at); gone(c);
}
/** 17.12 SSM attack: each Israeli air asset in the Available Box goes back to the cup on 1–2. */
export function playSSM(g: Game, chitId: string) {
  needAdmin(g); const c = avail(g, chitId, ['event_ssm_strike']); gone(c);
  for (const air of g.chits.filter((x) => x.kind === 'air_mission' && x.side === 'israeli' && x.box === 'available')) {
    const die = rollDie(g); if (die <= 2) air.box = 'cup'; say(g, `SSM strike: ${die}${die <= 2 ? ', an air asset goes back to the cup' : ', no effect'} (17.12)`, 'syrian');
  }
}
/** 17.21: two steps to the named brigade: +2 to one unit, +1 to each of two, or one eliminated unit back at 2 steps in an Assembly area. */
export function playArrivingBattalion(g: Game, chitId: string, choice: { add: string } | { split: [string, string] } | { rebuild: string; assembly: 'A' | 'B' }) {
  needAdmin(g); const c = avail(g, chitId, ['event_arriving_battalion']);
  const mine = (id: string) => { const u = unit(g, id); need(u.side === 'israeli' && !!c.brigade && u.brigade === c.brigade, `${u.name} is not of the ${c.brigade} brigade`); return u; };
  if ('add' in choice) { const u = mine(choice.add); need(u.area != null && inSupply(g, 'israeli', u.area) && u.str + 2 <= u.max, 'a supplied unit with room for two steps'); u.str += 2; }
  else if ('split' in choice) for (const id of choice.split) { const u = mine(id); need(u.area != null && inSupply(g, 'israeli', u.area) && u.str < u.max, 'supplied, reduced units'); u.str += 1; }
  else {
    const u = mine(choice.rebuild); need(u.area == null && u.str === 0, 'only an eliminated unit comes back');
    Object.assign(u, { area: choice.assembly === 'B' ? ASSEMBLY.B : ASSEMBLY.A, str: Math.min(2, u.max), disorder: 0, unsupplied: false, box: undefined });
    g.elimLarge = g.elimLarge.filter((x) => x !== u.id);                                                  // 19.2: off the Eliminated Large Units track
  }
  gone(c); say(g, `${c.name} arrives (17.21)`, 'israeli');
}
/** 17.23 Lt. Zvika Greengold: an elite armor defended roadblock in an unoccupied Israeli-controlled area, staying until destroyed. */
export function playLtZvika(g: Game, chitId: string, a: number) {
  needAdmin(g); const c = avail(g, chitId, ['event_lt_zvika']);
  need(!isAssembly(a) && g.control[a] === 'israeli' && vacant(g, a), 'an unoccupied Israeli-controlled area');
  c.box = 'map'; c.area = a; c.q = 'elite'; g.units.push(asGarrison(c, 'Z', a, 'armor', 'elite')); say(g, `Lt. Zvika takes position in ${nameOf(a)} (17.23)`, 'israeli');
}
/** 17.24 King Hassan's Troublemakers: the Moroccans fire only in defence and never enter Israeli-controlled areas, for the rest of the game. */
export function playKingHassan(g: Game, chitId: string) {
  needAdmin(g); const c = avail(g, chitId, ['event_king_hassan']); gone(c); state(g).kingHassan = true; say(g, "King Hassan's Troublemakers: the Moroccan brigade holds back (17.24)", 'israeli');
}
/** 17.31/17.32 replacements: one step to a supplied reduced unit of the matching class, even in a contested area. */
export function playReplacement(g: Game, chitId: string, unitId: string) {
  needAdmin(g); const c = avail(g, chitId, ['replacement_arm', 'replacement_mech']), u = unit(g, unitId);
  need(u.side === c.side && reduced(u) && inSupply(g, u.side, u.area!), 'a supplied, reduced unit of your own');
  need(c.kind === 'replacement_arm' ? u.cls === 'armor' : u.symbol === 'mech' || u.cls === 'infantry', c.kind === 'replacement_arm' ? 'armor replacements go to armor-class units' : 'mechanized replacements go to mech or infantry-class units');
  u.str += 1; gone(c); say(g, `${u.name} gets a replacement step (17.3)`, c.side);
}
/** 4.21: any event may instead bring two assets back from the Eliminated Box to the cup (not commandos, SAMs, air support or garrisons, 17.4). */
export function alternateEventUse(g: Game, chitId: string, assetIds: string[]) {
  const c = chit(g, chitId);
  need(c.box === 'available' && (c.kind.startsWith('event') || c.kind.startsWith('replacement_') || c.kind === 'special_action_event'), 'play an event from the Available Box');   // 17.31/17.32 replacements are events
  need(assetIds.length <= 2, 'two assets at most');
  for (const id of assetIds) { const a = chit(g, id); need(a.side === c.side && a.box === 'eliminated' && !['commando', 'sam', 'air_mission', 'garrison'].includes(a.kind) && !a.kind.startsWith('event') && !a.kind.startsWith('replacement_') && a.kind !== 'special_action_event', `${a.name} cannot come back this way (17.4)`); }
  for (const id of assetIds) chit(g, id).box = 'cup';
  gone(c); say(g, `${c.name} used to bring back ${assetIds.length} asset(s) (4.21)`, c.side);
}

/* ---------- Special Action uses of this volume (14.61) ---------- */
/** 14.61a (Israeli): fold one unit into another with the same symbol, same or adjacent uncontested friendly areas, both in good order. */
export function mergeUnits(g: Game, fromId: string, intoId: string, chitId?: string) {
  needAdmin(g); const a = unit(g, fromId), b = unit(g, intoId);
  need(a.side === 'israeli' && b.side === 'israeli' && a.id !== b.id && regular(a) && regular(b) && a.symbol === b.symbol, 'two Israeli units with the same unit symbol');
  need(!g.opts.israeliDivisions || a.division === b.division, 'with Israeli divisional organization, merging units must be of the same division (18.5)');
  need(a.area != null && b.area != null && (a.area === b.area || neighbors(a.area).includes(b.area)), 'in the same or adjacent areas');
  need([a.area!, b.area!].every((x) => isAssembly(x) || (g.control[x] === 'israeli' && !contested(g, x))) && a.disorder === 0 && b.disorder === 0, 'uncontested friendly areas, units in good order');
  spendSA(g, 'israeli', undefined, `merge ${a.name} into ${b.name} (14.61a)`, chitId);
  b.str = Math.min(b.max, b.str + a.str); a.area = null; a.str = 0; dropReserve(g, a);                      // no VP for Syria (19.2)
}
/** 14.61b (Syrian, from turn 3): release the next 3rd Tank Division unit (15th, 81st, 65th) into its friendly-controlled Entry area (`at`, or the first open one). */
export function releaseOperationalReserve(g: Game, chitId?: string, at?: number) {
  needAdmin(g); need(g.turn >= 3, 'from turn 3');
  const next = ['S18', 'S19', 'S20'].map((id) => unit(g, id)).find((u) => u.box === 'operational_reserve'); need(next, 'the Operational Reserve is empty');
  need(at == null ? releaseAreas(g, next!).length > 0 : releaseAreas(g, next!).includes(at), 'its Entry area must be friendly-controlled, with room (14.61b)');
  spendSA(g, 'syrian', undefined, `release ${next!.name} (14.61b)`, chitId); releaseUnit(g, next!, at);
}
/** 14.61c / 14.61d: a SAM (Syria) or an air support asset (Israel) from the Eliminated Box back into the cup. */
export function replaceAsset(g: Game, side: Side, assetId: string, chitId?: string) {
  needAdmin(g); const a = chit(g, assetId);
  need(a.side === side && a.box === 'eliminated' && a.kind === (side === 'syrian' ? 'sam' : 'air_mission'), side === 'syrian' ? 'an eliminated SAM asset' : 'an eliminated air support asset');
  spendSA(g, side, undefined, `${a.name} replaced (14.61${side === 'syrian' ? 'c' : 'd'})`, chitId); a.box = 'cup';
}
/** 5.23 with 15.6: a unit digs in, but never where a strongpoint stands. */
export function unitFieldWorks(g: Game, unitId: string) {
  const u = unit(g, unitId); need(u.area == null || !unitsIn(g, u.area).some((x) => x.fort), 'no field works where a strongpoint stands (15.6)');
  buildFieldWorks(g, unitId);
}

/* ---------- events and Special Actions in a battle (17.33, 17.34, 8.23) ---------- */
const takeEvent = (g: Game, b: Battle, c: Chit, kind: string) => {
  const B = battleState(b);
  need(b.stage === 'setup', 'events are played before the first roll');
  need(c.box === 'available' && c.kind === kind, 'that event is not available');
  need(!unitsIn(g, b.area, c.side).every((u) => u.garrison), 'a standing asset fighting alone plays no events (4.35)');
  need(!B.event[c.side], 'one event per side in a battle (6.22, 6.23)');
  B.event[c.side] = c.id; c.box = 'eliminated'; b.locked = true;                                            // 4.22 single use
  return c.side;
};
/** 17.33 Command Disruption: the Attacker jams the defence before the Defender assigns anything. */
export function playJamming(g: Game, b: Battle, chitId: string) {
  const c = chit(g, chitId), def = other(b.attacker);
  need(c.side === b.attacker, 'only the Attacker jams (17.33)');
  need(!b.assets[def].length && !airOf(b, def).length, 'the Defender has already assigned assets');
  takeEvent(g, b, c, 'event_ew'); battleState(b).ew = { pending: true };
  say(g, 'Electronic warfare: command disruption (17.33)', b.attacker);
}
/** 17.33: the Defender answers, with his own EW as countermeasures (+2 to each roll) or without. Each defending unit rolls: 5 or less, disordered. */
export function answerJamming(g: Game, b: Battle, counterChitId?: string) {
  const B = battleState(b), def = other(b.attacker); need(B.ew?.pending, 'no jamming to answer');
  if (counterChitId) { takeEvent(g, b, chit(g, counterChitId), 'event_ew'); say(g, 'EW countermeasures: +2 to each roll', def); }
  for (const u of fighters(g, b.area, def, false).filter((x) => !x.garrison)) {
    const die = rollDie(g), mod = counterChitId ? 2 : 0, hit = die + mod <= 5;
    b.rolls.push({ who: `${u.name}: jamming`, sn: 5, dice: [die + mod], hits: hit ? 1 : 0, kind: 'morale' });
    if (hit) u.disorder = 1;
    say(g, `${u.name} rolls ${die}${mod ? ' +2' : ''}: ${hit ? 'disordered' : 'holds'}`, def);
  }
  B.ew = { pending: false };
  const us = fighters(g, b.area, def, false).filter((x) => !x.garrison); B.defLocked = us.length > 0 && us.every((u) => u.disorder === 1);
}
/** 17.34 Counterbattery: played as the side's one event; it strikes after the enemy artillery fires. */
export function playCounterbattery(g: Game, b: Battle, chitId: string) {
  const side = takeEvent(g, b, chit(g, chitId), 'event_counterbattery'); battleState(b).counterbattery[side] = chitId;
  say(g, 'Counterbattery strike prepared (17.34)', side);
}
/** 8.23: the units that may reinforce the Defender from an adjacent uncontested area (not into a battle held by assets alone, 4.35, except Lt. Zvika, 17.23). */
export function reinforceOptions(g: Game, b: Battle) {
  const def = other(b.attacker), here = unitsIn(g, b.area, def);
  if (b.stage !== 'setup' || blocks(g, b.area, def).filter(regular).length >= 2) return [];
  if (!here.some(regular) && !here.some((u) => u.garrison && u.chitId && chit(g, u.chitId).kind === 'event_lt_zvika')) return [];
  return g.units.filter((u) => u.side === def && u.area != null && neighbors(b.area).includes(u.area) && regular(u) && u.disorder === 0 && !contested(g, u.area)).map((u) => u.id);
}

/* ---------- 15.3 Air Assault: the 82nd Para, once, east of the SAM barrier or onto Mt Hermon, first thing in a Syrian Combat Phase ---------- */
export function airAssaultTargets(g: Game) {
  const para = g.units.find((u) => u.id === 'S17');
  if (!para || para.box !== 'air_assault' || g.phase !== 'combat' || g.phasing !== 'syrian' || isNight(g) || g.fought.length || g.battle) return [];
  return [...areas.keys()].filter((a) => !isAssembly(a) && (eastOfSam(a) || a === HERMON) && blocks(g, a, 'syrian').length < 2);
}
export function airAssault(g: Game, a: number) {
  need(airAssaultTargets(g).includes(a), 'no air assault there');
  const u = unit(g, 'S17'); u.area = a; u.box = undefined; say(g, `The 82nd Para lands in ${nameOf(a)} (15.3)`, 'syrian');
  if (unitsIn(g, a, 'israeli').length) { g.riverAssault.push(a); state(g).airAssaultArea = a; } else updateControl(g, a);
}

/* ---------- the alternate set-up (22.24, 22.25) and the Israeli player's strongpoint placement (15.7) ---------- */
export function deployOptions(g: Game, unitId: string): number[] {
  const u = unit(g, unitId); if (g.phase !== 'deploy' || u.box !== 'deploy') return [];
  const ids = [...areas.keys()].filter((a) => !isAssembly(a));
  if (u.fort || u.ghost) return PURPLE.filter((a) => g.inPlay?.includes(a) !== false && !unitsIn(g, a).some((x) => x.fort || x.ghost));    // 15.7: one strongpoint or ghost in each area next to the Purple Line
  if (u.side === 'israeli') return ids.filter((a) => a !== HERMON && !garea(a).syria && !PURPLE.includes(a) && blocks(g, a, 'israeli').filter(regular).length < 2);   // 22.24 and the set-up card: not next to the Purple Line
  if (isAlOwda(g)) return ids.filter((a) => garea(a).altSetup && !unitsIn(g, a, 'syrian').length);     // 20.35: any tank-symbol area, one unit each
  return ids.filter((a) => garea(a).altSetup === u.division && !unitsIn(g, a, 'syrian').length);       // one unit per tank symbol of its division colour
}
export function deploy(g: Game, unitId: string, a: number) {
  need(deployOptions(g, unitId).includes(a), 'not a set-up area for this unit');
  const u = unit(g, unitId); u.box = undefined; u.area = a; updateControl(g, a);
}
/** The Israeli areas next to the Purple Line: each takes one strongpoint or ghost (15.7). */
const PURPLE = SETUPS.badr.strongpoints!.areas!;
const SUGGESTED = SETUPS.badr.strongpoints!.suggested_historical;
/** A seeded shuffle that spends no dice (the set-up must not change the game's rolls). */
const shuffled = <T,>(g: Game, xs: T[], salt: number) => { const sr = secureRandom(); let h = ((sr == null ? g.seed : Math.floor(sr * 2 ** 32)) ^ salt) >>> 0; /* online: not from the shared seed, which the other player can read */ const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** 15.7 quick placement of the strongpoints and ghosts still to place: the errata's rough historical set-up, or shuffled face-down ("most players prefer"). */
export function autoStrongpoints(g: Game, how: 'historical' | 'shuffle') {
  need(g.phase === 'deploy', 'only while setting up');
  if (how === 'historical') for (const { id, area } of SUGGESTED) if (g.units.some((u) => u.id === id && u.box === 'deploy') && deployOptions(g, id).includes(area)) deploy(g, id, area);
  const rest = shuffled(g, g.units.filter((u) => (u.fort || u.ghost) && u.box === 'deploy'), 7);
  for (const u of rest) { const o = deployOptions(g, u.id); if (o.length) deploy(g, u.id, shuffled(g, o, u.id.charCodeAt(2))[0]); }
}
/** 14.02: boundaries where the Israeli player may still place one of his three minefields. */
export function minefieldOptions(g: Game): string[] {
  const V = state(g); if (g.phase !== 'deploy' || !V.minesLeft) return [];
  const mined = new Set(V.minefields.flatMap((k) => k.split('-').map(Number)));
  return connections().filter((c) => !isAssembly(c.a) && !isAssembly(c.b) && c.kind !== 'hermon' && !c.atDitch && !c.escarpment && !c.river && !c.rugged && !c.sheet
    && c.a !== HERMON && c.b !== HERMON && !mined.has(c.a) && !mined.has(c.b) && (!g.inPlay || (g.inPlay.includes(c.a) && g.inPlay.includes(c.b)))).map((c) => edgeKey(c.a, c.b));
}
export function placeMinefield(g: Game, a: number, b: number) {
  const key = edgeKey(a, b); need(minefieldOptions(g).includes(key), 'not a boundary for a minefield (14.02: not on the AT ditch, escarpment, river, Mt Hermon or rugged; one mined boundary per area)');
  const V = state(g); V.minefields.push(key); V.minesLeft!--; say(g, `Minefield laid between ${nameOf(a)} and ${nameOf(b)} (14.02)`, 'israeli');
}
/** Random minefields, on boundaries between Israeli-held areas within two areas of the Purple Line (where they can stop an attack). */
export function autoMinefields(g: Game) {
  const front = new Set(PURPLE.flatMap((a) => [a, ...neighbors(a)])), useful = (k: string) => k.split('-').map(Number).every((a) => g.control[a] === 'israeli' && !garea(a).syria && front.has(a));
  for (let k = 0; k < 5 && state(g).minesLeft; k++) { const all = minefieldOptions(g), o = shuffled(g, all.some(useful) ? all.filter(useful) : all, 31 + k); if (!o.length) break; const [a, b] = o[0].split('-').map(Number); placeMinefield(g, a, b); } }
/** 22.25: in the alternate set-up Syria may put its two reserve markers on units it has placed (toggle). */
/** Reserve markers placed during the set-up: how many a side may put on its units, and whether all of them must be placed (22.25, 20.34-20.35, 22.44). */
export function setupReserves(g: Game, side: Side): { max: number; all: boolean } {
  if (g.phase !== 'deploy') return { max: 0, all: false };
  if (g.opts.scenario === 'badr_alt') return side === 'syrian' ? { max: 2, all: false } : { max: 0, all: false };
  if (isAlOwda(g)) return { max: side === 'israeli' ? ALO.israeli.reserve_markers : ALO.syrian.reserve_markers, all: true };
  if (isNafakh(g)) return side === 'israeli' ? { max: 1, all: false } : { max: 0, all: false };
  return { max: 0, all: false };
}
/** The reserve markers still to place at set-up (0 when the scenario gives none, or all are placed). */
export const reservesLeft = (g: Game, side: Side) => { const r = setupReserves(g, side); return Math.max(0, Math.min(g.markers[side]?.res ?? 0, r.max - g.units.filter((u) => u.side === side && u.reserve).length)); };
/** The set-up reserve markers that must be placed, put on placed units at random (the quick set-up). */
export function autoReserves(g: Game, only?: Side) {
  for (const sd of sidesOf(g).filter((x) => !only || x === only)) { const pool = shuffled(g, g.units.filter((u) => u.side === sd && regular(u) && u.area != null && !isAssembly(u.area) && !u.reserve), 43); while (reservesLeft(g, sd) && pool.length) deployReserve(g, pool.shift()!.id); }
}
export function deployReserve(g: Game, unitId: string) {
  const u = unit(g, unitId), r = setupReserves(g, u.side); need(r.max > 0 && regular(u) && u.area != null && !isAssembly(u.area), 'one of your placed units, during the set-up');
  if (u.reserve) { u.reserve = null; g.markers[u.side].res++; return; }
  need(reservesLeft(g, u.side) > 0, 'every reserve marker of the set-up is placed'); u.reserve = 'res'; g.markers[u.side].res--;
}
/** End of the set-up: the historical scenario opens with the Syrian Combat Phase (the Operational Movement Phase has taken place, 22.17). */
function afterDeploy(g: Game) {
  if (state(g).startAt !== 'combat') return false;
  g.phase = 'combat'; g.phasing = 'syrian'; g.units.forEach((u) => { u.moved = false; u.spent = 0; }); return true;
}
/** The Israeli player places strongpoints and ghosts at will, one per Purple Line area (15.7): swap two of them while setting up. */
export function swapStrongpoints(g: Game, a: string, b: string) {
  need(g.turn === 1 && (g.phase === 'deploy' || (g.phase === 'combat' && g.fought.length === 0 && !g.battle)), 'only while setting up');
  const x = unit(g, a), y = unit(g, b); need((x.fort || x.ghost) && (y.fort || y.ghost) && x.area != null && y.area != null, 'two placed strongpoints or ghosts');
  [x.area, y.area] = [y.area, x.area];
}
/** The Special Actions a side could spend now (the reusable block first). */
export const specialActions = (g: Game, side: Side) => saAvailable(g, side);

registerHooks('golan73', {
  newGame: newGolanGame as Volume['newGame'], markerKey: () => 'res', reach: golanReach, beforeMove, afterMove,
  stratAllowed: (g, u) => interdictedBy(g, u.area!) !== other(u.side) && !(isNight(g) && g.stratMoves >= (u.side === 'israeli' ? 2 : 1)), stratStep,   // 14.03: night strat-moves, Israel 2, Syria 1
  afterStrat: (g, _u, path) => { g.stratMoves++; const V = state(g); for (let i = 1; i < path.length; i++) { const c = connection(path[i - 1], path[i])!; if (c.escarpment || c.rugged) V.crossed.push(edgeKey(path[i - 1], path[i])); } },
  setupActor: (g, b) => (state(g).samTarget ? 'syrian' : (b.vol as GolanBattle | undefined)?.ew?.pending ? other(b.attacker) : undefined),   // read only: battleState() would create the record
  successNumber: golanSuccessNumber, adjustFire, canAssign, moraleSn: golanMoraleSn, retreatOk, retreatPrefer, onRetreat, noRetreat: (_g, u) => !!u.garrison,     // 16.24: garrisons never retreat (6.42c)
  
  sources, supplyStep, supplyFree: (_g, _s, a) => isAssembly(a) || a === HERMON, alwaysSupplied: (_g, u) => !!u.ghost || u.id === 'S17',
  victory: golanVictory, finalResult, onPhase, onBattle, freeBattle, assault, reinforce, afterDraw: (g) => { nafakhStaff(g); const d = g.chits.find((c) => c.kind === 'event_dugman5' && c.box === 'available'); if (d) resolveDugman(g, d); },
  afterDeploy, onUnassign, keepAssigned, optional: GOLAN_OPTIONAL, absorbLoss, lossOk, recoverOk, ghostsMove: (g) => !!g.opts.advGhosts, reinforceOk: (g, b, u) => reinforceOptions(g, b).includes(u.id), stackLimit: (_g, a) => (isAssembly(a) ? 99 : 2), stackRoom: (g, u, a) => (g.opts.advGhosts && u.side === 'israeli' ? ghostRoom(g, u, a) : undefined), firstBattle: (g) => state(g).airAssaultArea, allowance: (g, u) => (isNight(g) && u.side === 'syrian' ? (u.cls === 'armor' ? 4 : 1) : u.cls === 'armor' ? 6 : 3), appropriate: (g, u) => (isNafakh(g) ? (u.side === 'israeli' ? [NAF_NORTH] : [REAR, NAF.sheet.entry.Z]) : u.side === 'israeli' ? [ASSEMBLY.A, ASSEMBLY.B] : Object.values(ENTRY)), isNight, onAssign, beforeBegin, beforeFire, afterFire,
  lossAsset,   // 18.32: a supporting artillery asset may take a step loss (series loss pool)
} as Partial<Volume>);
