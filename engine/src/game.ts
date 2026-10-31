import unitsJson from '../../data/bulge/units.json';
import entryJson from '../../data/bulge/entry_areas.json';
import scenJson from '../../data/bulge/scenarios.json';
import { areas, connection, edgeKey, neighbors, zoneOf } from './map';
import { d10, rng, succeeds } from './dice';
import { moraleSn, successNumber, type Quality, type Shooter } from './combat';
import { reachable } from './movement';
import { buildChits, chitClass, isArty, isBattleAsset, isAsset, ZONE, type Chit, type Side } from './chits';
export type { Chit, Side };

export type Phase = 'reinforcement' | 'admin' | 'movement' | 'strategic' | 'combat' | 'reaction' | 'btMove' | 'btCombat' | 'supply';
export const PHASES: Phase[] = ['admin', 'movement', 'strategic', 'combat', 'reaction', 'btMove', 'btCombat', 'supply'];
/** Turn Track (map): Admin Phase draws [first player turn, second player turn] and the sudden-death net VP [German, Allied]. */
export const TRACK = [
  { ge: [0, 0], al: [0, 0], sd: null }, { ge: [9, 5], al: [7, 0], sd: null }, { ge: [9, 4], al: [7, 1], sd: null }, { ge: [8, 3], al: [7, 2], sd: [5, 5] },
  { ge: [7, 3], al: [7, 2], sd: [6, 4] }, { ge: [10, 4], al: [10, 5], sd: [7, 3] }, { ge: [8, 3], al: [11, 6], sd: [7, 3] }, { ge: [7, 2], al: [12, 7], sd: [6, 4] }, { ge: [6, 2], al: [13, 8], sd: [5, 5] },
] as unknown as { ge: number[]; al: number[]; sd: number[] | null }[];

export interface Unit {
  id: string; name: string; side: Side; cls: 'armor' | 'infantry'; q: Quality[]; max: number; str: number; area: number | null; garrison?: boolean;
  disorder: 0 | 1 | 2; unsupplied: boolean; moved: boolean; reserve: string | null; exploit: boolean; from?: number;
  arrival?: number; entry?: string[]; ech?: string; symbol?: string; code?: string;
  chitId?: string; interdict?: string; adjOnly?: boolean; spent?: number; delayed?: boolean; paradrop?: 'pending' | 'intact' | 'partial'; heydte?: boolean; bcross?: boolean;
  up?: number;   /** area where the block lies face-up after a battle (6.24); it is upright, so hidden from the enemy, whenever it is elsewhere */
}
export interface Roll { who: string; sn: number; dice: number[]; hits: number; kind: 'arty' | 'ground' }
export interface Battle {
  area: number; attacker: Side; attPoint: string; defPoint: string; bt: boolean; riverAssault: boolean;
  stage: 'setup' | 'attArty' | 'defArty' | 'defFire' | 'offFire' | 'attChoice' | 'attFirst' | 'defChoice' | 'retreat' | 'done';
  retreat?: { side: Side; queue: string[]; moved: boolean; after: 'ground' | 'arty' | 'sa'; h: number; excess: number };
  queue: ('attArty' | 'defArty' | 'defFire' | 'offFire')[]; assets: Record<Side, string[]>; air: Partial<Record<Side, { id: string; mode: 'arty' | 'support'; unit?: string }>>;
  pending: number; pendingKind?: 'arty' | 'ground'; engFw: boolean; rolls: Roll[]; result?: string; exploit: boolean; unitHit: Record<Side, boolean>; mark: number; hit?: Record<Side, string[]>;
  ready?: Side[]; locked?: boolean;
}
export interface Opts { scenario: 'tournament' | 'campaign'; fuel: boolean; airborne?: boolean; advArty?: boolean }
export interface Game {
  turn: number; lastTurn: number; phasing: Side; phase: Phase; units: Unit[]; chits: Chit[]; control: Record<number, Side>;
  fieldWorks: number[]; fwOwner: Record<number, Side>; riverAssault: number[]; blown: string[]; contestedAtMoveStart: number[]; fought: number[];
  markers: { german: Record<string, number>; allied: Record<string, number> }; stratMoves: number; riverCross: string[]; blowTried: number[]; entered: Record<number, { id: string; river: boolean; blown: boolean }[]>;
  pendingBlow: { unit: string; path: number[]; spent?: number } | null; greif: Record<string, string>; greifTried: string[]; fwBuilt: string[]; tfNew: string[]; elimLarge: string[]; captured: number[]; fuelAdded: boolean; opts: Opts;
  roadblocks: Record<number, Side>; interdicted: Record<number, string>; pooled: number | null; airSupply: { area: number; side: Side; id: string; stamp: number } | null; revealed: string | null; arrived: string[]; pendingArrivals: string[];
  recover: Side[];
  battle: Battle | null; seed: number; rolls: number; log: string[]; over?: string;
}
type RawUnit = { id: string; name: string; side: string; echelon?: string; symbol?: string; cls?: string; steps?: number; quality_by_step?: Quality[]; start_area?: number; arrival_turn?: number; entry?: string[]; kind?: string };
const ENTRY = entryJson as Record<string, { side: string; area: number }>;
/** 14.21-14.23: the entry areas a Higher Echelon may use when its own are blocked or a Special Action reroutes it. */
const APPROPRIATE: Record<string, string> = { de_5pz: 'XYZ', de_6pz: 'YZ', de_7a: 'XY', de_sr: 'YZ', us_1a: 'ABCDEFGHJ', us_3a: 'KLM', us_sr: 'FGHJ', br_xxx: 'CDEFGH' };
const appropriateAreas = (u: Unit) => [...(APPROPRIATE[u.ech ?? ''] ?? '')].map((l) => ENTRY[l]?.area).filter((a): a is number => a != null);
export const other = (s: Side): Side => (s === 'german' ? 'allied' : 'german');
const sideOf = (s: string): Side => (s === 'german' ? 'german' : 'allied');
const keyOf = edgeKey;

export const quality = (u: Unit) => u.q[u.str - 1];
export const unitsIn = (g: Game, a: number, side?: Side) => g.units.filter((u) => u.area === a && (!side || u.side === side));
export const blocks = (g: Game, a: number, side: Side) => unitsIn(g, a, side).filter((u) => !u.garrison);
export const contested = (g: Game, a: number) => unitsIn(g, a, 'german').length > 0 && unitsIn(g, a, 'allied').length > 0;
export const contestedAreas = (g: Game) => [...areas.keys()].filter((a) => contested(g, a));
export const newlyContested = (g: Game) => contestedAreas(g).filter((a) => !g.contestedAtMoveStart.includes(a));
export const chit = (g: Game, id: string) => g.chits.find((c) => c.id === id)!;
export const boxOf = (g: Game, side: Side, box: Chit['box']) => g.chits.filter((c) => c.side === side && c.box === box);
const roll = (g: Game) => d10(rng(g.seed * 7919 + g.rolls++));
const say = (g: Game, s: string) => { g.log.push(`T${g.turn} ${g.phasing === 'german' ? 'GE' : 'AL'} ${g.phase}: ${s}`); };
const AIRBORNE = new Set(['82', '101', '517']);                                                // 18.5
const ARMY = (u: Unit): number | undefined => (u.ech ? ZONE[u.ech] : undefined);

/* ================= setup ================= */
export function newGame(seed = Date.now() % 1e9, opts: Partial<Opts> = {}): Game {
  const o: Opts = { scenario: 'tournament', fuel: true, ...opts }, sc = scenJson.tournament, last = o.scenario === 'campaign' ? 9 : 5;
  const units: Unit[] = [];
  for (const r of unitsJson as RawUnit[]) {
    if (r.kind) continue;
    const max = r.steps!, red = (sc.reduced as Record<string, number>)[r.name] ?? (sc.reinforcementsReduced as Record<string, number>)[r.name];
    units.push({ id: r.id, name: r.name, side: sideOf(r.side), cls: r.cls as 'armor' | 'infantry', q: r.quality_by_step!, max, str: red ?? max, area: r.start_area ?? null, disorder: 0, unsupplied: false, moved: false,
      reserve: null, exploit: false, arrival: r.arrival_turn, entry: r.entry, ech: r.echelon, symbol: r.symbol,
      code: r.start_area ? String(r.start_area) : r.arrival_turn ? `${r.arrival_turn}-${r.entry!.length > 1 ? r.entry![0] + r.entry![r.entry!.length - 1] : r.entry![0]}` : 'Res' });
  }
  for (const a of sc.garrisons) units.push({ id: `G${a}`, name: `Garrison ${areas.get(a)!.name}`, side: 'allied', cls: 'infantry', q: ['green'], max: 1, str: 1, area: a, garrison: true, disorder: 0, unsupplied: false, moved: true, reserve: null, exploit: false });
  const g: Game = { turn: 1, lastTurn: last, phasing: 'german', phase: 'combat', units, chits: buildChits(last), control: {}, fieldWorks: [...sc.fieldWorks], fwOwner: {}, riverAssault: [...sc.riverAssault], blown: [...sc.blownBridges],
    contestedAtMoveStart: [], fought: [], markers: { german: { z5: 2, z6: 2, z7: 1 }, allied: { z56: 3, z7: 2 } }, stratMoves: 0, riverCross: [], blowTried: [], entered: {}, pendingBlow: null, greif: {}, greifTried: [], fwBuilt: [], tfNew: [],
    elimLarge: [], captured: [], fuelAdded: false, opts: o, roadblocks: {}, interdicted: {}, pooled: null, airSupply: null, revealed: null, arrived: [], pendingArrivals: [], recover: [], battle: null, seed, rolls: 0, log: [] };
  for (const fa of g.fieldWorks) g.fwOwner[fa] = units.some((u) => u.side === 'allied' && u.area === fa) ? 'allied' : 'german';
  const peiper = units.find((u) => u.name === 'Peiper')!; peiper.reserve = 'z6'; g.markers.german.z6--;
  const ger = new Set(units.filter((u) => u.side === 'german' && u.area).map((u) => u.area!));
  const todo = units.filter((u) => u.side === 'allied' && u.area).map((u) => u.area!), seen = new Set(todo);
  while (todo.length) for (const n of neighbors(todo.pop()!)) if (!seen.has(n) && !ger.has(n)) { seen.add(n); todo.push(n); }
  for (const a of areas.keys()) g.control[a] = seen.has(a) ? 'allied' : 'german';
  for (const a of [1, 2, 3, 4, 5, 6, 7, 8, 14, 15]) if (!units.some((u) => u.side === 'allied' && u.area === a)) g.control[a] = 'german';
  say(g, `${o.scenario === 'campaign' ? 'Campaign' : 'Tournament'} scenario set up. All contested areas must be fought this phase.`);
  return g;
}

/* ================= control, supply, VP ================= */
function updateControl(g: Game, a: number) {
  if (contested(g, a)) for (const u of unitsIn(g, a)) if (u.reserve) { g.markers[u.side][u.reserve]++; u.reserve = null; }       // 5.21 the marker goes when the area becomes contested
  const ge = blocks(g, a, 'german').length, al = blocks(g, a, 'allied').length, was = g.control[a];
  if (ge && !al && !unitsIn(g, a, 'allied').length) g.control[a] = 'german';
  if (al && !ge && !unitsIn(g, a, 'german').length) g.control[a] = 'allied';
  if (was !== 'german' && g.control[a] === 'german' && areas.get(a)!.vp.mutual && !g.captured.includes(a)) {      // 16.13 captured fuel, first capture of a yellow-star area
    g.captured.push(a); const r = roll(g);
    if (r === 1 && !g.fuelAdded) { g.fuelAdded = true; g.chits.push({ id: `FUEL-C${a}`, name: 'Captured Fuel Asset', kind: 'fuel', side: 'german', ech: 'german', turn: 'S', box: 'available' }); say(g, `captured fuel at ${areas.get(a)!.name} (rolled 1): new fuel asset`); }
    else if (r <= 5) { const f = g.chits.find((c) => c.kind === 'fuel' && c.box === 'used') ?? g.chits.find((c) => c.kind === 'fuel' && c.box === 'cup'); if (f) { f.box = 'available'; say(g, `captured fuel at ${areas.get(a)!.name} (rolled ${r}): a fuel asset is available again`); } }
  }
}
const sources = (side: Side) => new Set(Object.values(ENTRY).filter((e) => sideOf(e.side) === side).map((e) => e.area));
export function inSupply(g: Game, side: Side, start: number) {
  if (g.airSupply?.side === side && g.airSupply.area === start) return true;                // 17.2 Air Supply Mission
  const src = sources(side), enemy = other(side);
  const blocked = (a: number) => !unitsIn(g, a).length && neighbors(a).some((n) => g.control[n] === enemy && unitsIn(g, n, enemy).length && !unitsIn(g, n, side).length);
  const seen = new Set([start]), todo = [start];
  while (todo.length) {
    const a = todo.pop()!;
    if (src.has(a) && g.control[a] === side) return true;
    for (const n of neighbors(a)) {
      if (seen.has(n) || g.control[n] !== side || (blocked(n) && !unitsIn(g, n, side).length)) continue;
      if (g.blown.includes(keyOf(a, n)) && a !== start) continue;
      seen.add(n); todo.push(n);
    }
  }
  return false;
}
export function victory(g: Game) {
  let ge = 0, al = 0;
  for (const a of areas.values()) {
    const v = a.vp; if (!v.german && !v.allied && !v.mutual) continue;
    const c = g.control[a.id]; if (!inSupply(g, c, a.id)) continue;
    if (c === 'allied') al += v.allied + (v.mutual ? 1 : 0); else ge += v.german + (v.mutual ? 1 : 0);
  }
  for (const id of g.elimLarge) { const u = g.units.find((x) => x.id === id)!; if (u.side === 'allied') ge++; else al++; }
  return { german: ge, allied: al, net: ge - al };
}

/* ================= chits ================= */
function drawChits(g: Game, side: Side, n: number) {
  for (let i = 0; i < n; i++) {
    const cup = boxOf(g, side, 'cup'); if (!cup.length) return;
    const c = cup[Math.floor(rngf(g) * cup.length)];
    if (c.kind === 'event_delayed_response') { c.box = 'eliminated'; say(g, `${side} drew Delayed Response (no effect)`); } else { c.box = 'available'; c.drawn = g.turn * 10 + (g.phasing === 'german' ? 1 : 2); }
  }
}
const rngf = (g: Game) => rng(g.seed * 104729 + g.rolls++)();
/** 4.1b-c: the Used Box goes back to the cup (German artillery attrition first, 16.12). */
function recycleUsed(g: Game, side: Side) {
  if (side === 'german') { const art = boxOf(g, side, 'used').find((c) => c.kind === 'artillery'); if (art) { art.box = 'eliminated'; say(g, `German artillery attrition: ${art.name} eliminated (16.12)`); } }
  boxOf(g, side, 'used').forEach((c) => (c.box = c.kind === 'sa_block' ? 'available' : 'cup'));
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
}
function reinforcementPhase(g: Game) {
  g.arrived = [];
  g.recover = [];
  for (const side of ['german', 'allied'] as Side[]) {
    const sa = g.chits.find((c) => c.kind === 'sa_block' && c.side === side && c.turn === 2 && g.turn >= 2)!;
    if (g.turn >= 2) {
      if (sa.box === 'available') { if (boxOf(g, side, 'used').some((c) => isAsset(c))) { g.recover.push(side); continue; } }   // 4.1a unused reusable SA: the player brings one asset back first
      else sa.box = 'available';
    }
    recycleUsed(g, side);
  }
  g.pendingArrivals = g.units.filter((x) => x.arrival === g.turn && x.area == null && x.str > 0).map((x) => x.id);
  g.tfNew = [];
  for (const c of g.chits.filter((x) => x.turn === g.turn && x.box === 'future')) {
    if (c.kind === 'task_force') { c.box = 'available'; g.tfNew.push(c.id); } else c.box = 'cup';
  }
}
export function placeTaskForce(g: Game, id: string, area: number) {
  const c = chit(g, id);
  if (g.phase !== 'reinforcement' || !g.tfNew.includes(id) || c.box !== 'available') throw new Error('task force cannot be placed now');
  if (g.control[area] !== 'allied' || contested(g, area) || !inSupply(g, 'allied', area)) throw new Error('needs a supplied, friendly-controlled, uncontested area');
  c.box = 'map'; g.tfNew = g.tfNew.filter((x) => x !== id);
  g.units.push({ id: `TF-${id}`, name: `Task Force (${areas.get(area)!.name})`, side: 'allied', cls: 'infantry', q: ['green'], max: 1, str: 1, area, garrison: true, disorder: 0, unsupplied: false, moved: true, reserve: null, exploit: false, ech: 'us_sr', chitId: id });
  say(g, `Task Force placed in ${areas.get(area)!.name}`);
}

/* ================= reserves ================= */
const markerKey = (u: Unit) => (u.side === 'german' ? `z${zoneOf(u.area!)}` : zoneOf(u.area!) === 7 ? 'z7' : 'z56');
export function canReserve(g: Game, u: Unit) {
  return u.area != null && !u.garrison && !u.reserve && !u.moved && !u.unsupplied && u.disorder === 0 && !contested(g, u.area) && (g.markers[u.side][markerKey(u)] ?? 0) > 0;
}
export function setReserve(g: Game, id: string, on: boolean) {
  const u = g.units.find((x) => x.id === id)!;
  if (on) { if (!canReserve(g, u)) throw new Error('no eligible reserve marker for this unit'); if (u.interdict && !interdictCheck(g, u)) throw new Error('Greif interdict: morale check failed, it cannot be placed in reserve'); const k = markerKey(u); g.markers[u.side][k]--; u.reserve = k; }
  else if (u.reserve) { g.markers[u.side][u.reserve]++; u.reserve = null; }
}
const dropReserve = (g: Game, u: Unit) => { if (u.reserve) { g.markers[u.side][u.reserve]++; u.reserve = null; } };

/* ================= movement ================= */
const fuelChits = (g: Game) => boxOf(g, 'german', 'available').filter((c) => c.kind === 'fuel');
export interface Opt { area: number; cost: number; fuel: boolean; mustStop: boolean; path: number[] }
const markerAreas = (g: Game, owner: Side) => Object.keys(g.roadblocks).map(Number).filter((a) => g.roadblocks[a] === owner && !unitsIn(g, a).length);
export function moveOptions(g: Game, id: string): Opt[] {
  const u = g.units.find((x) => x.id === id)!;
  if (u.area == null || u.garrison || u.moved) return [];
  const mover = g.phase === 'reaction' ? other(g.phasing) : g.phasing;
  const exploit = g.phase === 'btMove' && u.exploit, reserveBt = g.phase === 'btMove' && !!u.reserve;
  const ok = (g.phase === 'movement' && u.side === g.phasing) || (g.phase === 'reaction' && u.side === mover && !!u.reserve) || (g.phase === 'btMove' && u.side === g.phasing && (exploit || reserveBt));
  if (!ok) return [];
  const enemy = other(u.side), occ = (a: number) => ({ german: blocks(g, a, 'german').length, allied: blocks(g, a, 'allied').length });
  const garr = new Set(g.units.filter((x) => x.garrison && x.side === enemy && x.area != null && !blocks(g, x.area, enemy).length).map((x) => x.area!));
  const one = exploit && !reserveBt;
  let r = reachable({ side: u.side, cls: u.cls, area: u.area, supplied: !u.unsupplied, disordered: u.disorder > 0, adjacentOnly: one || !!u.adjOnly, spent: u.spent, ownZone: one ? undefined : (ARMY(u) as 5 | 6 | 7 | undefined), boundaryPreauthorized: u.bcross },
    { occupants: occ, blownBridges: new Set(g.blown), roadblocks: new Set([...garr, ...markerAreas(g, enemy)]), controller: (a) => g.control[a],
      extraCost: (f, t) => (markerAreas(g, enemy).includes(t) ? 1 : 0) + (u.side === 'allied' && unitsIn(g, t, 'german').some((x) => x.heydte) ? 1 : 0) + (u.side === 'german' && (g.interdicted[f] || g.interdicted[t]) ? 1 : 0) });
  if (one) r = r.filter((x) => !g.blown.includes(keyOf(x.path[0], x.path[1])));                        // 7.31 no crossing of a blown bridge
  return r.filter((x) => {
    if (!britishOk(u, x.area)) return false;
    if (blocks(g, x.area, u.side).length >= 2) return false;                                           // 5.1
    const en = unitsIn(g, x.area, enemy).length > 0, cont = contested(g, x.area);
    if (g.phase === 'reaction' && en && !cont) return false;                                           // 7.2: reaction never creates a newly contested area
    const last = connection(x.path[x.path.length - 2], x.area)!;
    if (en && last.river && g.riverCross.includes(keyOf(x.path[x.path.length - 2], x.area))) return false; // 5.35c
    if (u.side === 'german' && x.fuel && g.opts.fuel && !fuelChits(g).length) return false;             // 16.13
    return true;
  });
}
function finishMove(g: Game, u: Unit, opt: Opt, bridgeBlown: boolean) {
  for (const a of opt.path.slice(1)) delete g.roadblocks[a];                                  // 4.34 a roadblock goes when anyone enters
  u.bcross = false;                                                                          // 14.62a the marker goes when the unit next moves
  const from = u.area!, to = opt.area, last = connection(opt.path[opt.path.length - 2], to)!, enemy = other(u.side);
  const intoEnemy = unitsIn(g, to, enemy).length > 0;
  if (u.side === 'german' && opt.fuel && g.opts.fuel) { const f = fuelChits(g)[0]; if (f) { f.box = 'used'; say(g, `fuel asset spent for ${u.name}`); } }
  u.from = from; u.area = to; u.moved = true; u.adjOnly = false; u.spent = 0; dropReserve(g, u);
  if (u.side === 'german') for (let i = 1; i < opt.path.length; i++) { const k = keyOf(opt.path[i - 1], opt.path[i]); if (g.greif[k]) { chit(g, g.greif[k]).box = 'eliminated'; delete g.greif[k]; say(g, 'Greif Team Bridge: the bridge is taken'); } }
  const hd = unitsIn(g, to).find((x) => x.heydte);
  if (hd && u.side === 'german') { chit(g, hd.chitId!).box = 'used'; hd.area = null; hd.str = 0; say(g, 'von der Heydte is relieved and becomes a regular battle asset'); }
  if (intoEnemy && last.river) { g.riverCross.push(keyOf(opt.path[opt.path.length - 2], to)); }
  if (intoEnemy) (g.entered[to] ??= []).push({ id: u.id, river: last.river, blown: bridgeBlown || g.blown.includes(keyOf(opt.path[opt.path.length - 2], to)) });
  if (g.phase === 'btMove' || g.phase === 'movement') { u.exploit = u.exploit && g.phase === 'btMove' ? false : u.exploit; }
  paradropReveal(g, to, u);
  updateControl(g, from); updateControl(g, to);
  say(g, `${u.name} ${areas.get(from)!.name} → ${areas.get(to)!.name} (${opt.cost} MP)`);
}
export function move(g: Game, id: string, to: number) {
  if (g.pendingBlow) throw new Error('resolve the bridge-blowing attempt first');
  const opt = moveOptions(g, id).find((x) => x.area === to); if (!opt) throw new Error('illegal move');
  const u = g.units.find((x) => x.id === id)!;
  if (u.interdict && !interdictCheck(g, u)) { if (opt.path.length > 2) { u.adjOnly = true; return 'interdict'; } }
  const prev = opt.path[opt.path.length - 2], last = connection(prev, to)!, enemy = other(u.side);
  const newly = unitsIn(g, to, enemy).length > 0 && !g.contestedAtMoveStart.includes(to) && !contested(g, to);
  if (last.river && !g.blown.includes(keyOf(prev, to)) && newly && !g.blowTried.includes(to) && (g.phase === 'movement' || g.phase === 'btMove')) {
    g.pendingBlow = { unit: id, path: opt.path, spent: (moveOptions(g, id).find((x) => x.area === opt.path[opt.path.length - 2])?.cost ?? 0) }; return 'blow';                                       // 5.35d the opponent may try to blow the bridge
  }
  finishMove(g, u, opt, false); return 'moved';
}
export function resolveBlow(g: Game, attempt: boolean) {
  const p = g.pendingBlow!; g.pendingBlow = null;
  const u = g.units.find((x) => x.id === p.unit)!, to = p.path[p.path.length - 1], prev = p.path[p.path.length - 2];
  const opt = { area: to, cost: 0, fuel: false, mustStop: true, path: p.path };
  g.blowTried.push(to);
  if (!attempt) { finishMove(g, u, { ...opt, cost: p.path.length }, false); return 'crossed'; }
  const r = roll(g), need = g.greif[keyOf(prev, to)] ? 1 : 5;                       // 17.12: a Greif team holding the bridge makes it a 1
  if (r > need) { say(g, `bridge blow attempt failed (rolled ${r})`); finishMove(g, u, { ...opt, cost: p.path.length }, false); return 'failed'; }
  g.blown.push(keyOf(prev, to)); say(g, `bridge ${areas.get(prev)!.name}–${areas.get(to)!.name} blown (rolled ${r})`); dropGreif(g, keyOf(prev, to));
  const exploitOnly = g.phase === 'btMove' && u.exploit && !u.reserve;
  if (exploitOnly) { say(g, `${u.name} cannot cross the blown bridge and does not move (7.31)`); return 'stopped'; }          // exploitation units may not cross a blown bridge, even one blown by their own attempt
  if (p.path.length === 2) { finishMove(g, u, { ...opt, cost: 6 }, true); return 'blown-crossed'; }     // began adjacent: still crosses, whole allowance
  // 5.35d: it does not enter the area, loses one movement point, and may carry on from where it stands
  const here = p.path.length - 2 > 0 ? prev : u.area!; u.spent = (p.spent ?? 0) + 1; u.area = here; u.from = p.path[0]; dropReserve(g, u);
  say(g, `${u.name} stops in ${areas.get(prev)!.name} (bridge blown ahead) and may keep moving`); updateControl(g, p.path[0]); updateControl(g, prev);
  return 'stopped';
}
/** Strategic movement (5.4, 14.8): supplied reserve units, any friendly-controlled supplied area reachable over road/field links without blown bridges or enemy areas. */
function clearInterdict(g: Game, u: Unit) { if (u.interdict) { chit(g, u.interdict).box = 'eliminated'; u.interdict = undefined; say(g, `${u.name}: interdict marker removed (Special Action movement)`); } }
function dropGreif(g: Game, k: string) { if (g.greif[k]) { chit(g, g.greif[k]).box = 'eliminated'; delete g.greif[k]; } }
export function stratOptions(g: Game, id: string): number[] {
  const u = g.units.find((x) => x.id === id)!;
  if (g.phase !== 'strategic' || u.side !== g.phasing || !u.reserve || u.unsupplied || u.area == null || u.moved) return [];
  if (u.side === 'german' && (g.stratMoves >= 1 || (g.opts.fuel && !fuelChits(g).length))) return [];
  const seen = new Set<number>();
  seen.add(u.area); const q = [u.area];
  while (q.length) { const a = q.shift()!; for (const n of neighbors(a)) {
    const c = connection(a, n)!;
    if (seen.has(n) || g.control[n] !== u.side || unitsIn(g, n, other(u.side)).length || contested(g, n) || c.restricted || g.blown.includes(keyOf(a, n))) continue;
    seen.add(n); if (!(u.side === 'german' && g.interdicted[n])) q.push(n);                    // 17.2 no strat-move through an interdicted area
  } }
  seen.delete(u.area);
  return [...seen].filter((a) => britishOk(u, a) && blocks(g, a, u.side).length < 2 && inSupply(g, u.side, a));
}
export function stratMove(g: Game, id: string, to: number) {
  if (!stratOptions(g, id).includes(to)) throw new Error('illegal strategic move');
  const u = g.units.find((x) => x.id === id)!, from = u.area!;
  if (u.side === 'german') { g.stratMoves++; if (g.opts.fuel) fuelChits(g)[0].box = 'used'; }
  u.area = to; u.moved = true; dropReserve(g, u); updateControl(g, from); updateControl(g, to);
  say(g, `${u.name} strategic move ${areas.get(from)!.name} → ${areas.get(to)!.name}`);
}

/* ================= special actions & admin ================= */
export function saAvailable(g: Game, side: Side, ech?: string) {
  const blk = boxOf(g, side, 'available').find((c) => c.kind === 'sa_block');
  const ev = boxOf(g, side, 'available').filter((c) => c.kind === 'special_action_event' && (!ech || c.ech === ech || c.ech === 'us_sr' || ech === 'us_sr'));
  return [...(blk ? [blk] : []), ...ev];
}
export function spendSA(g: Game, side: Side, ech?: string, why = 'Special Action') {
  const c = saAvailable(g, side, ech)[0]; if (!c) throw new Error('no Special Action available');
  c.box = c.kind === 'sa_block' ? 'used' : 'eliminated'; say(g, `${side} spends ${c.kind === 'sa_block' ? 'the reusable Special Action' : 'a Special Action event'}: ${why}`); return c;
}
const needAdmin = (g: Game) => { if (g.phase !== 'admin') throw new Error('only in the Admin Phase'); };
export const suppliedArea = (g: Game, side: Side, a: number) => g.control[a] === side && inSupply(g, side, a) && !contested(g, a);
const supplied = (g: Game, side: Side, a: number) => g.control[a] === side && inSupply(g, side, a) && !contested(g, a);
/** 14.43: the British operate only northwest of the Meuse, from area 57 in the north to area 96 in the west (areas on that side of the Meuse in the hand-drawn map). */
export const BRITISH_AREAS = new Set([57, 58, 78, 79, 92, 93, 94, 95, 96]);
const britishOk = (u: Unit, a: number) => u.ech !== 'br_xxx' || BRITISH_AREAS.has(a);
const ARMY_ECH: Record<number, string> = { 5: 'de_5pz', 6: 'de_6pz', 7: 'de_7a' };
const echOk = (g: Game, c: Chit, a: number) => c.side === 'allied' || c.ech === 'de_sr' || c.ech === 'german' || ZONE[c.ech] === zoneOf(a) ||
  (c.kind === 'engineer' && !g.chits.some((x) => x.kind === 'engineer' && x.ech === ARMY_ECH[zoneOf(a)] && x.box !== 'eliminated'));   // 14.52 an army that lost its engineer may borrow another   // 16.1 German assets/events act only in their own army's zone
export function bridgeTargets(g: Game, side: Side, area: number) {
  return neighbors(area).filter((n) => connection(area, n)!.river && !g.blown.includes(keyOf(area, n)) && supplied(g, side, area));
}
export function blowBridges(g: Game, id: string, area: number, targets: number[]) {
  needAdmin(g); const c = chit(g, id);
  if (c.kind !== 'engineer' || c.box !== 'available') throw new Error('engineer not available');
  if (!echOk(g, c, area) || !bridgeTargets(g, c.side, area).length || targets.length < 1 || targets.length > 2 || !targets.every((t) => bridgeTargets(g, c.side, area).includes(t))) throw new Error('not a legal bridge-blowing');
  c.box = 'used';
  for (const t of targets) {
    const k = keyOf(area, t);
    if (g.greif[k]) { if (g.greifTried.includes(k)) { say(g, 'the Greif-held bridge was already tried this Admin Phase'); continue; } const r = roll(g); g.greifTried.push(k); if (r > 5) { say(g, `engineer fails to blow the Greif-held bridge (rolled ${r})`); continue; } say(g, `engineer blows the Greif-held bridge (rolled ${r})`); }
    g.blown.push(k); dropGreif(g, k);
  }
  say(g, `${c.name} works on ${targets.length} bridge(s) from ${areas.get(area)!.name}`);
}
export function repairTargets(g: Game, side: Side, area: number) {
  if (!supplied(g, side, area)) return [];
  return neighbors(area).filter((n) => g.blown.includes(keyOf(area, n)) && (g.control[n] === side || (g.control[n] === other(side) && contested(g, n))));
}
export function repairBridge(g: Game, id: string, area: number, to: number) {
  needAdmin(g); const c = chit(g, id);
  if (c.kind !== 'engineer' || c.box !== 'available' || !echOk(g, c, area) || !repairTargets(g, c.side, area).includes(to)) throw new Error('not a legal repair');
  g.blown = g.blown.filter((k) => k !== keyOf(area, to)); c.box = 'used'; say(g, `${c.name} repairs the bridge ${areas.get(area)!.name}–${areas.get(to)!.name}`);
}
export function fieldWorksFor(g: Game, id: string, area: number) {
  needAdmin(g); const c = chit(g, id);
  const same = blocks(g, area, c.side).some((u) => u.ech === c.ech || c.ech === 'us_sr' || u.ech === 'us_sr');
  if (c.kind !== 'engineer' || c.box !== 'available' || !supplied(g, c.side, area) || !same || g.fieldWorks.includes(area) || !echOk(g, c, area)) throw new Error('needs a supplied, uncontested area holding a unit of the engineer\'s echelon');
  g.fieldWorks.push(area); g.fwOwner[area] = c.side; c.box = 'used'; say(g, `${c.name} builds field works in ${areas.get(area)!.name}`);
}
function addStep(u: Unit, elite: boolean) {
  const nq = u.q[u.str]; if (u.str >= u.max || u.unsupplied || (!elite && nq === 'elite')) throw new Error('that unit cannot receive a step');
  u.str++;
}
export function eligibleForStep(c: Chit, u: Unit) {
  if (c.kind === 'event_arriving_regiment' && u.side === c.side && u.area == null && u.str === 0 && !u.garrison) return u.name === `${parseInt(c.division ?? '')} Inf`;     // 17.23 brings an eliminated division back
  if (u.side !== c.side || u.area == null || u.garrison || u.unsupplied || u.str >= u.max) return false;
  const arm = c.kind === 'replacement_arm' || c.kind === 'rebuild_or_replace_arm', inf = c.kind === 'replacement_inf' || c.kind === 'rebuild_or_replace_inf';
  if (c.kind === 'event_arriving_regiment') return u.name === `${parseInt(c.division ?? '')} Inf`;
  if (arm && u.cls !== 'armor') return false; if (inf && u.cls !== 'infantry') return false;
  if (c.ech === 'de_sr' || c.ech === 'us_sr') return true;
  if (c.side === 'german' && ZONE[c.ech] !== zoneOf(u.area)) return false;
  return u.ech === c.ech || u.ech === 'us_sr';
}
export function playReplacement(g: Game, id: string, unitId: string) {
  needAdmin(g); const c = chit(g, id), u = g.units.find((x) => x.id === unitId)!;
  if (c.box !== 'available' || !eligibleForStep(c, u)) throw new Error('that unit is not eligible');
  if (u.area == null) {                                                                                     // 17.23: back into play with one step in a free friendly entry area
    const to = [...listedEntries(u), ...appropriateAreas(u)].find((a) => entryOpen(g, u, a)); if (to == null) throw new Error('no free entry area for it right now');
    u.str = 1; u.area = to; u.disorder = 0; u.unsupplied = false; g.control[to] = u.side; g.elimLarge = g.elimLarge.filter((x) => x !== u.id); c.box = 'eliminated';
    return say(g, `${c.name}: ${u.name} returns in ${areas.get(to)!.name} with 1 step`);
  }
  addStep(u, c.kind === 'event_arriving_regiment'); c.box = 'eliminated'; say(g, `${c.name}: ${u.name} gains a step (${u.str}/${u.max})`);
}
export function playRebuild(g: Game, id: string, unitId: string, area: number) {
  needAdmin(g); const c = chit(g, id), u = g.units.find((x) => x.id === unitId)!;
  const arm = c.kind === 'rebuild_or_replace_arm';
  if (!c.kind.startsWith('rebuild') || c.box !== 'available' || u.area != null || u.max !== 1 || u.side !== c.side || u.q[0] === 'elite' || (arm !== (u.cls === 'armor')) || g.control[area] !== c.side || !(areas.get(area)!.vp.allied || areas.get(area)!.vp.mutual || areas.get(area)!.vp.german)) throw new Error('cannot return that unit there');
  u.area = area; u.str = 1; c.box = 'eliminated'; say(g, `${u.name} returns to ${areas.get(area)!.name}`);
}
export function alternateUse(g: Game, id: string) {
  needAdmin(g); const c = chit(g, id);
  if (c.box !== 'available' || isAsset(c) || c.kind === 'sa_block') throw new Error('not an event');
  const pri = ['engineer', 'artillery', 'rocket_artillery', 'armor_asset', 'infantry_asset', 'fuel'];
  const back = boxOf(g, c.side, 'eliminated').filter(isAsset).sort((a, b) => pri.indexOf(a.kind) - pri.indexOf(b.kind)).slice(0, 2);
  back.forEach((x) => (x.box = 'cup')); c.box = 'eliminated'; say(g, `${c.name} used as alternate event: ${back.map((x) => x.name).join(', ') || 'no assets in the Eliminated Box'} back to the cup`);
}
export function rally(g: Game, side: Side, area: number) {
  needAdmin(g); if (!supplied(g, side, area)) throw new Error('area must be supplied and friendly');
  spendSA(g, side, undefined, 'Rally the troops');
  for (const a of [area, ...neighbors(area)]) for (const u of blocks(g, a, side)) if (u.disorder && !u.unsupplied) u.disorder = 0;
}
export function qualityReplacement(g: Game, unitId: string) {
  needAdmin(g); const u = g.units.find((x) => x.id === unitId)!; if (u.garrison || u.unsupplied || u.str >= u.max) throw new Error('not eligible');
  spendSA(g, u.side, u.ech, 'Quality replacements'); u.str++; say(g, `${u.name} gains a step`);
}
export function staffReplacement(g: Game, id: string, unitId: string) {
  needAdmin(g); const c = chit(g, id), u = g.units.find((x) => x.id === unitId)!;
  if (c.kind !== 'command_staff' || c.box !== 'available' || u.side !== c.side || u.cls !== 'infantry' || u.area == null || u.garrison) throw new Error('not eligible');
  addStep(u, false); c.box = 'used'; say(g, `Command staff: ${u.name} gains a step`);
}
export function staffReserve(g: Game, id: string, unitId: string) {
  needAdmin(g); const c = chit(g, id); if (c.kind !== 'command_staff' || c.box !== 'available') throw new Error('not available');
  setReserve(g, unitId, true); c.box = 'used';
}
export function releaseUnit(g: Game, id: string, area: 4 | 6) {
  needAdmin(g); const c = chit(g, id); if (c.kind !== 'event_release' || c.box !== 'available') throw new Error('not available');
  const nm: Record<string, string> = { '11th': '11 Pz', '10th': '10SS', '17th': '17SS', '6th': '6SS' }, u = g.units.find((x) => x.name === nm[c.name.split(' ')[0]])!;
  if (u.area != null || blocks(g, area, 'german').length >= 2 || (g.control[area] !== 'german' && unitsIn(g, area).length)) throw new Error('entry area blocked');
  u.area = area; g.control[area] = 'german'; c.box = 'eliminated'; say(g, `${u.name} released and enters in ${areas.get(area)!.name}`);
}


/* ================= Bulge events (17.11, 17.12, 17.14, 16.11) and unit field works (5.23) ================= */
export function playGreifBridge(g: Game, id: string, a: number, b: number) {
  needAdmin(g); const c = chit(g, id), k = keyOf(a, b), cn = connection(a, b);
  if (c.kind !== 'event_greif_bridge' || c.box !== 'available' || !cn?.river || g.blown.includes(k) || g.greif[k]) throw new Error('needs an intact bridge on a river boundary');
  g.greif[k] = id; c.box = 'map'; say(g, `Greif Team Bridge placed on ${areas.get(a)!.name}–${areas.get(b)!.name}`);
}
export function playInterdict(g: Game, id: string, unitId: string) {
  needAdmin(g); const c = chit(g, id), u = g.units.find((x) => x.id === unitId)!;
  if (c.kind !== 'event_greif_interdict' || c.box !== 'available' || u.side !== 'allied' || u.area == null || u.garrison || u.interdict) throw new Error('needs an Allied block without an interdict marker');
  u.interdict = id; c.box = 'map'; say(g, `Greif Team Interdict placed on ${u.name}`);
}
/** 17.11: when the unit next tries to move, build field works or take a reserve marker it rolls morale with +2; on failure it only stays or moves one area. */
export function interdictCheck(g: Game, u: Unit) {
  const r = roll(g), ok = succeeds(r, moraleSn(quality(u), u.disorder > 0, u.unsupplied && !(g.opts.airborne && AIRBORNE.has(u.name))) + 2);
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
export const heydteWindow = (g: Game, c: Chit) => c.name === 'v.d. Heydte' && c.box === 'available' && g.phase === 'admin' && c.drawn === g.turn * 10 + (g.phasing === 'german' ? 1 : 2);
export function heydteDrop(g: Game, id: string, area: 31 | 52) {
  needAdmin(g); const c = chit(g, id);
  if (!heydteWindow(g, c) || unitsIn(g, area).length || g.control[area] !== 'allied') throw new Error('the drop zone must be vacant and Allied-controlled, in the Admin Phase the asset was drawn');
  c.box = 'map'; g.units.push({ id: 'HEYDTE', name: 'v.d. Heydte', side: 'german', cls: 'infantry', q: ['veteran'], max: 1, str: 1, area, garrison: true, disorder: 0, unsupplied: false, moved: true, reserve: null, exploit: false, ech: 'de_sr', chitId: id, paradrop: 'pending', heydte: true });
  say(g, `von der Heydte drops near ${areas.get(area)!.name} (not yet located)`);
}
/** 16.11: the first American unit to enter the drop area finds out how the paradrop went. */
function paradropReveal(g: Game, area: number, mover: Unit) {
  const h = unitsIn(g, area).find((x) => x.paradrop === 'pending'); if (!h || mover.side !== 'allied') return;
  const r = roll(g);
  if (r === 1) { h.paradrop = 'intact'; say(g, `paradrop result ${r}: von der Heydte landed intact and holds ${areas.get(area)!.name}`); }
  else if (r <= 5) { h.paradrop = 'partial'; say(g, `paradrop result ${r}: partly scattered, it will not fire back`); }
  else { say(g, `paradrop result ${r}: completely scattered`); eliminate(g, h); }
}
export function buildFieldWorks(g: Game, id: string) {
  const u = g.units.find((x) => x.id === id)!;
  const ok = (g.phase === 'movement' && u.side === g.phasing) || (g.phase === 'reaction' && u.side !== g.phasing && !!u.reserve) || (g.phase === 'btMove' && u.side === g.phasing && (!!u.reserve || u.exploit));
  if (!ok || u.moved || u.area == null || u.garrison || u.unsupplied || u.disorder || contested(g, u.area) || g.fieldWorks.includes(u.area)) throw new Error('needs a supplied unit in good order that has not moved, in an uncontested area without field works');
  if (u.interdict && !interdictCheck(g, u)) throw new Error('Greif interdict: morale check failed, it cannot build field works');
  g.fieldWorks.push(u.area); g.fwOwner[u.area] = u.side; u.moved = true; dropReserve(g, u); u.exploit = false; say(g, `${u.name} builds field works in ${areas.get(u.area)!.name}`);
}

/* ================= combat ================= */
const fighters = (g: Game, a: number, side: Side, attacker: boolean) => unitsIn(g, a, side).filter((u) => !(attacker && u.disorder > 0));
export const point = (g: Game, b: Battle, side: Side) => g.units.find((x) => x.id === (side === b.attacker ? b.attPoint : b.defPoint)) ?? null;
function fixPoint(g: Game, b: Battle) {
  for (const side of ['german', 'allied'] as Side[]) {
    const p = point(g, b, side); if (p && p.area === b.area) continue;
    const us = unitsIn(g, b.area, side).filter((u) => !(side === b.attacker && u.disorder > 0)); if (!us.length) continue;
    const n = [...us].sort((x, y) => +!!x.garrison - +!!y.garrison || y.str - x.str)[0].id; if (side === b.attacker) b.attPoint = n; else b.defPoint = n;
  }
}
export function startBattle(g: Game, a: number, viaSA = false): Battle {
  if (g.battle) throw new Error('a battle is already open');
  const bt = g.phase === 'btCombat';
  if ((g.phase !== 'combat' && !bt) || !contested(g, a) || g.fought.includes(a)) throw new Error('no battle here');
  const att = fighters(g, a, g.phasing, true).filter((u) => !u.garrison), def = unitsIn(g, a, other(g.phasing));
  if (!att.length) throw new Error('no attacker in good order');
  if (bt && !newlyContested(g).includes(a)) { if (!viaSA) throw new Error('re-engaging an already contested area costs a Special Action'); spendSA(g, g.phasing, undefined, 'breakthrough combat'); }
  const lockedAtStart = bt && !!viaSA;
  const pick = (us: Unit[]) => [...us].sort((x, y) => +!!x.garrison - +!!y.garrison || y.str - x.str)[0].id;
  const b: Battle = { area: a, attacker: g.phasing, attPoint: pick(att), defPoint: pick(def), bt, riverAssault: g.riverAssault.includes(a), stage: 'setup', queue: [], assets: { german: [], allied: [] }, air: {}, pending: 0,
    engFw: false, rolls: [], exploit: false, unitHit: { german: false, allied: false }, mark: g.log.length, hit: { german: [], allied: [] }, ready: [], locked: lockedAtStart };
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
  const onlyAssets = unitsIn(g, b.area, side).every((u) => u.garrison);
  return { arty: (attacker ? 2 : 1) + (us && !mixed && !onlyAssets ? 1 : 0), battle: !mixed && !onlyAssets, event: !mixed && !onlyAssets, mixed, pure, ech, pooled };
}
export function canAssign(g: Game, b: Battle, side: Side, c: Chit): string | null {
  if (b.stage !== 'setup') return 'assets are committed before the first roll';
  if (c.side !== side || c.box !== 'available') return 'not in the Available Box';
  if (unitsIn(g, b.area, side).some((u) => u.unsupplied) || !inSupply(g, side, b.area)) return 'units that cannot trace supply may not have assets (9.34a)';
  if (g.airSupply?.area === b.area && g.airSupply.side === side) return 'air-supplied units may not have assets (9.34a)';
  const lim = assetLimits(g, b, side), cur = b.assets[side].map((x) => chit(g, x)), att = side === b.attacker, dr = unitsIn(g, b.area, side).find((x) => x.id.startsWith('DR-'));
  if (dr && (!isArty(c) || c.ech !== dr.ech || cur.length >= 1)) return 'a defended roadblock gets one artillery asset of its own Higher Echelon (4.35)';
  if (side === 'german' && c.ech !== 'de_sr' && ZONE[c.ech] !== zoneOf(b.area)) return "German assets act only in their own army's zone (16.1)";
  const armies = new Set(cur.filter((x) => x.ech !== 'us_sr').map((x) => x.ech));
  const echOk2 = c.ech === 'us_sr' || (side === 'german' && c.ech === 'de_sr') || lim.pure.includes(c.ech) || (lim.pooled && c.ech.startsWith('us_')) || (side === 'allied' && lim.pure.length === 0 && (armies.size === 0 || armies.has(c.ech)));
  if (c.kind === 'air_mission') { if (side !== 'allied') return 'Allied only'; return b.air.allied ? 'one air mission per battle' : null; }
  if (!echOk2) return 'asset belongs to a different Higher Echelon';
  if (isArty(c) && unitsIn(g, b.area, side).every((x) => x.heydte)) return 'von der Heydte receives no artillery support';
  if (isArty(c)) {
    const arts = cur.filter(isArty), cap = lim.mixed ? (att ? lim.pure.length : 1) : lim.arty;
    if (arts.length >= cap) return `at most ${cap} artillery asset(s) here`;
    if (lim.mixed && att && arts.some((x) => x.ech === c.ech)) return 'only one artillery asset per involved Higher Echelon';
    if (side === 'german' && arts.length >= 1 && (arts[0].kind === c.kind || arts[0].ech !== c.ech)) return 'two German artillery assets need one regular and one rocket asset of the same army (16.12)';
    return null;
  }
  if (isBattleAsset(c)) return lim.battle ? null : 'battle assets need units of one Higher Echelon';
  return 'this chit cannot be assigned to a battle';
}
export function assign(g: Game, b: Battle, id: string, mode?: 'arty' | 'support', unit?: string) {
  const c = chit(g, id), err = canAssign(g, b, c.side, c); if (err) throw new Error(err);
  c.box = 'map';
  if (c.kind === 'air_mission') b.air[c.side] = { id, mode: mode ?? 'arty', unit }; else b.assets[c.side].push(id);
}
export function unassign(g: Game, b: Battle, id: string) {
  const c = chit(g, id); if (b.stage !== 'setup') return; c.box = 'available';
  b.assets[c.side] = b.assets[c.side].filter((x) => x !== id); if (b.air[c.side]?.id === id) delete b.air[c.side];
}
/* --- fire --- */
export interface Fire { key: string; who: string; shooter: Shooter; dice: number; sn: number; parts: [string, number][]; isAsset: boolean }
export function fireList(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground'): Fire[] {
  const att = side === b.attacker, tp = point(g, b, other(side)); if (!tp) return [];
  const out: Fire[] = [], tgt = { pointCls: tp.cls, pointQuality: quality(tp), fieldWorks: att && g.fieldWorks.includes(b.area) && (g.fwOwner[b.area] ?? other(side)) === other(side), riverAssaultMarker: !att && b.riverAssault };
  const set = { attacker: att, tdn: areas.get(b.area)!.tdn, riverAssault: att && b.riverAssault, advArty: g.opts.advArty };
  const add = (key: string, who: string, shooter: Shooter, isAsset: boolean) => { const r = successNumber(shooter, tgt, set); out.push({ key, who, shooter, dice: shooter.dice, sn: r.sn, parts: r.parts, isAsset }); };
  if (kind === 'arty') {
    for (const id of b.assets[side]) { const c = chit(g, id); if (isArty(c)) add(id, c.name, { kind: 'artillery', cls: 'infantry', dice: 1 }, true); }
    const a = b.air[side]; if (a?.mode === 'arty') add(a.id, 'Air Mission (artillery)', { kind: 'artillery', cls: 'infantry', dice: 1 }, true);
  } else {
    for (const u of fighters(g, b.area, side, att)) { if (u.paradrop === 'partial') continue; const sup = b.air[side]?.mode === 'support' && b.air[side]!.unit === u.id; add(u.id, u.name, { kind: u.garrison ? 'battle' : 'unit', cls: u.cls, quality: quality(u), dice: u.str, disordered: u.disorder > 0, unsupplied: u.unsupplied, airSupport: sup }, !!u.garrison); }
    for (const id of b.assets[side]) { const c = chit(g, id); if (!isBattleAsset(c) || (att && b.engFw && c.kind === 'engineer' && g.fieldWorks.includes(b.area))) continue; add(id, c.name, { kind: 'battle', cls: chitClass(c), quality: c.q, dice: 1 }, true); }
  }
  return out;
}
function doFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground') {
  let total = 0;
  for (const f of fireList(g, b, side, kind)) { const dice = Array.from({ length: f.dice }, () => roll(g)), hits = dice.filter((d) => succeeds(d, f.sn)).length; total += hits; b.rolls.push({ who: f.who, sn: f.sn, dice, hits, kind }); }
  say(g, `${areas.get(b.area)!.name}: ${side} ${kind === 'arty' ? 'artillery' : 'ground fire'} ${total} hit(s)`);
  return total;
}
function eliminate(g: Game, u: Unit) {
  say(g, `${u.name} eliminated`); if (u.max >= 3 && !u.garrison) g.elimLarge.push(u.id); u.area = null; u.str = 0; dropReserve(g, u);
  if (u.chitId) chit(g, u.chitId).box = 'eliminated'; if (u.interdict) { chit(g, u.interdict).box = 'eliminated'; u.interdict = undefined; }
}
function stepLoss(g: Game, b: Battle, side: Side, key: string) {
  const c = g.chits.find((x) => x.id === key);
  if (c) { c.box = 'eliminated'; b.assets[side] = b.assets[side].filter((x) => x !== key); say(g, `${c.name} eliminated`); return; }
  const u = g.units.find((x) => x.id === key)!; u.str -= 1;
  if (u.str <= 0 || u.garrison) eliminate(g, u); else say(g, `${u.name} loses a step`);
  if (!u.garrison) b.unitHit[side] = true;
}
/** 6.43: assets first, the first unit loss falls on the point unit, everyone takes one loss before anyone takes a second. */
function allocate(g: Game, b: Battle, side: Side, n: number) {
  b.hit ??= { german: [], allied: [] }; const hit = new Set<string>(b.hit[side]);                          // 6.43 everyone takes a loss before anyone takes a second, across all the volleys of one battle
  for (let i = 0; i < n; i++) {
    fixPoint(g, b);
    let ps = [...b.assets[side].filter((id) => isBattleAsset(chit(g, id))).map((id) => ({ key: id, asset: true, str: 1 })), ...unitsIn(g, b.area, side).map((u) => ({ key: u.id, asset: !!u.garrison, str: u.str }))];
    if (!ps.length) return n - i;
    let cand = ps.filter((p) => !hit.has(p.key)); if (!cand.length) { hit.clear(); cand = ps; }
    const pid = side === b.attacker ? b.attPoint : b.defPoint;
    if (!b.unitHit[side] && cand.some((p) => p.key === pid)) cand = cand.filter((p) => p.asset || p.key === pid);
    cand.sort((x, y) => +!x.asset - +!y.asset || +(x.key !== pid) - +(y.key !== pid) || x.str - y.str);
    stepLoss(g, b, side, cand[0].key); hit.add(cand[0].key); b.hit[side] = [...hit];
  }
  return 0;
}
const allGone = (g: Game, b: Battle, side: Side) => !unitsIn(g, b.area, side).length && !b.assets[side].some((id) => isBattleAsset(chit(g, id)));
function next(g: Game, b: Battle) {
  fixPoint(g, b);
  if (!unitsIn(g, b.area, b.attacker).filter((u) => !u.garrison).length) return end(g, b, 'Attacker eliminated');
  const s = b.queue.shift(); if (!s) return end(g, b, b.result ?? 'Area remains contested');
  if (s === 'attArty' || s === 'defArty') { const side = s === 'attArty' ? b.attacker : other(b.attacker); if (!fireList(g, b, side, 'arty').length) return next(g, b); }
  b.stage = s; return;
}
/** 6.24, 5.22: may `side` read this block? Own blocks, face-up blocks, a block in an area where enemy blocks are face-up, and the Intelligence Gathering target. Chits are always face-up. */
export function visibleTo(g: Game, u: Unit, side: Side | 'spectator' | null): boolean {
  if (side === null || u.side === side || u.garrison || g.revealed === u.id || u.area == null) return true;
  if (u.up === u.area) return true;
  return g.units.some((x) => x.area === u.area && x.side !== u.side && x.up === u.area);
}
export function beginCombat(g: Game, b: Battle) {
  if (b.stage !== 'setup') throw new Error('already started');
  for (const u of g.units) if (u.area === b.area && !u.garrison) u.up = b.area;                // 6.24 units are revealed once both point units are designated
  b.queue = ['attArty', 'defArty', 'defFire', 'offFire']; next(g, b);
}
/** Hot-seat shortcut stays beginCombat; online each side confirms its set-up and combat starts when both are ready. */
export function setReady(g: Game, b: Battle, side: Side, on = true) {
  if (b.stage !== 'setup') throw new Error('already started');
  const r = (b.ready ??= []).filter((x) => x !== side); if (on) r.push(side); b.ready = r;
  if (r.length === 2) beginCombat(g, b);
}
/** Withdraw from a battle that has not rolled yet, returning every assigned asset. Not possible once a Special Action was spent. */
export function cancelBattle(g: Game) {
  const b = g.battle; if (!b) throw new Error('no battle'); if (b.stage !== 'setup') throw new Error('combat has begun');
  if (b.locked) throw new Error('a Special Action was spent; the battle cannot be withdrawn');
  for (const id of [...b.assets.german, ...b.assets.allied, ...Object.values(b.air).map((a) => a!.id)]) unassign(g, b, id);
  g.battle = null;
}
export function roll_step(g: Game, b: Battle) {
  const st = b.stage;
  if (st === 'attArty') { const h = doFire(g, b, b.attacker, 'arty'); return hitDefender(g, b, h, 'arty'); }
  if (st === 'defArty' || st === 'defFire') { const h = doFire(g, b, other(b.attacker), st === 'defArty' ? 'arty' : 'ground'); return hitAttacker(g, b, h); }
  if (st === 'offFire') {
    if (b.engFw && g.fieldWorks.includes(b.area) && b.assets[b.attacker].some((id) => chit(g, id).kind === 'engineer')) { g.fieldWorks = g.fieldWorks.filter((x) => x !== b.area); say(g, 'engineer removes the field works (6.33)'); }
    const h = doFire(g, b, b.attacker, 'ground'); return hitDefender(g, b, h, 'ground');
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
  const h = b.pending; b.pending = 0; stepLoss(g, b, att, key); b.hit ??= { german: [], allied: [] }; b.hit[att] = [...new Set([...b.hit[att], key])];
  afterFirstHit(g, b, h - 1);
}
export function attackerChoice(g: Game, b: Battle, abort: boolean) {
  if (b.stage !== 'attChoice') throw new Error('no choice pending');
  if (abort) {
    const us = unitsIn(g, b.area, b.attacker).filter((u) => !u.garrison);
    if (b.riverAssault) for (const u of us) { const from = u.from; if (from != null && g.control[from] === b.attacker && !unitsIn(g, from, other(b.attacker)).length && blocks(g, from, b.attacker).length < 2) { u.area = from; } else if (from != null) stepLoss(g, b, b.attacker, u.id); }
    for (const u of unitsIn(g, b.area, b.attacker)) if (!u.garrison) u.disorder = 1;
    b.queue = []; return end(g, b, 'Attack aborted: attackers disordered' + (b.riverAssault ? ' and back across the river' : ''));
  }
  allocate(g, b, b.attacker, b.pending); b.pending = 0; next(g, b);
}
function hitDefender(g: Game, b: Battle, h: number, kind: 'arty' | 'ground') {
  const def = other(b.attacker);
  if (h > 0 && g.fieldWorks.includes(b.area)) { g.fieldWorks = g.fieldWorks.filter((x) => x !== b.area); h--; say(g, 'field works absorb 1 hit'); }
  b.pending = h; b.pendingKind = kind;
  const real = unitsIn(g, b.area, def).filter((u) => !u.garrison);
  const canDis = kind === 'arty' && real.some((u) => u.disorder !== 1);
  const canRet = kind === 'ground' && real.length > 0;
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
  if (retreat) h--;
  const excess = allocate(g, b, def, h);
  b.pending = 0;
  if (retreat) { b.retreat = { side: def, queue: unitsIn(g, b.area, def).filter((x) => !x.garrison).map((x) => x.id), moved: false, after: kind, h, excess }; return advanceRetreat(g, b); }
  finishDef(g, b, kind, false, excess);
}
function finishDef(g: Game, b: Battle, kind: 'arty' | 'ground', retreated: boolean, excess: number) {
  const def = other(b.attacker);
  if (allGone(g, b, def)) {
    b.result = retreated ? 'Defender retreated' : 'Defender eliminated';
    b.exploit = !retreated && (kind === 'arty' || excess > 0);
    b.queue = b.queue.filter((s) => s === 'defArty');
  }
  next(g, b);
}
/** Where a retreating block may go: adjacent, friendly-controlled, free of enemies, room for one more block (6.5). */
export function retreatOptions(g: Game, b: Battle): number[] {
  const r = b.retreat; if (!r) return [];
  return neighbors(b.area).filter((n) => g.control[n] === r.side && !unitsIn(g, n, other(r.side)).length && blocks(g, n, r.side).length < 2);
}
function advanceRetreat(g: Game, b: Battle) {
  const r = b.retreat!;
  while (r.queue.length) {
    const u = g.units.find((x) => x.id === r.queue[0])!, opts = retreatOptions(g, b);
    if (!opts.length) { stepLoss(g, b, r.side, u.id); r.queue.shift(); continue; }
    if (opts.length === 1) { moveRetreat(g, b, u, opts[0]); r.queue.shift(); continue; }
    b.stage = 'retreat'; return;
  }
  b.retreat = undefined;
  if (r.after === 'sa') { b.exploit = true; b.queue = []; return end(g, b, 'Defender retreated (Special Action): exploitation opportunity'); }
  finishDef(g, b, r.after, r.moved, r.excess);
}
function moveRetreat(g: Game, b: Battle, u: Unit, to: number) {
  if (u.area == null) return;
  const from = u.area; u.area = to; if (b.retreat!.after !== 'sa') u.disorder = 1; b.retreat!.moved = true;                  // 8.24 a retreat before combat does not disorder updateControl(g, from); updateControl(g, to); say(g, `${u.name} retreats to ${areas.get(to)!.name}`);
}
export function chooseRetreat(g: Game, b: Battle, to: number) {
  if (b.stage !== 'retreat' || !b.retreat) throw new Error('no retreat pending');
  if (!retreatOptions(g, b).includes(to)) throw new Error('cannot retreat there');
  moveRetreat(g, b, g.units.find((x) => x.id === b.retreat!.queue[0])!, to); b.retreat.queue.shift(); advanceRetreat(g, b);
}
function end(g: Game, b: Battle, result: string) {
  b.result = result; b.stage = 'done';
  for (const side of ['german', 'allied'] as Side[]) for (const id of b.assets[side]) { const c = chit(g, id); if (c.box === 'map') c.box = 'used'; }
  for (const side of ['german', 'allied'] as Side[]) { const a = b.air[side]; if (a) chit(g, a.id).box = 'eliminated'; }      // air missions are single-use
  g.fought.push(b.area); for (const n of [b.area, ...neighbors(b.area)]) updateControl(g, n);
  if (b.exploit && !b.bt && !b.riverAssault) for (const u of unitsIn(g, b.area, b.attacker).filter((x) => x.cls === 'armor' && !x.garrison)) {      // 6.8
    const r = roll(g), ok = succeeds(r, moraleSn(quality(u), u.disorder > 0, u.unsupplied && !(g.opts.airborne && AIRBORNE.has(u.name)))); if (ok) u.exploit = true;
    say(g, `${u.name} exploitation morale check: rolled ${r} → ${ok ? 'exploitation marker' : 'failed'}`);
  }
  say(g, `${areas.get(b.area)!.name}: ${result}`);
}
export function closeBattle(g: Game) { if (g.battle?.stage !== 'done') throw new Error('battle not finished'); g.battle = null; }
export function defenderRetreatSA(g: Game, b: Battle) {
  if (b.stage !== 'setup') throw new Error('only before the first roll'); const def = other(b.attacker);
  if (b.assets[def].length || b.air[def]) throw new Error('defender has assets assigned');
  const us = unitsIn(g, b.area, def).filter((u) => !u.garrison); if (!us.length || unitsIn(g, b.area, def).some((u) => u.garrison)) throw new Error('garrisons cannot retreat');
  spendSA(g, def, us[0].ech, 'retreat before combat'); b.locked = true; us.forEach((x) => clearInterdict(g, x));
  b.retreat = { side: def, queue: us.map((u) => u.id), moved: false, after: 'sa', h: 0, excess: 0 }; advanceRetreat(g, b);
}
export function defenderReinforceSA(g: Game, b: Battle, unitId: string) {
  if (b.stage !== 'setup') throw new Error('only before the first roll'); const def = other(b.attacker), u = g.units.find((x) => x.id === unitId)!;
  if (unitsIn(g, b.area, def).some((x) => x.id.startsWith('DR-'))) throw new Error('a defended roadblock may not be reinforced (4.35)');
  if (u.side !== def || u.area == null || !neighbors(b.area).includes(u.area) || contested(g, u.area) || u.disorder || u.garrison || blocks(g, b.area, def).length >= 2) throw new Error('not a legal reinforcement');
  spendSA(g, def, u.ech, 'reinforce a battle'); b.locked = true; clearInterdict(g, u); const from = u.area; u.area = b.area; u.from = from; updateControl(g, from); say(g, `${u.name} reinforces ${areas.get(b.area)!.name}`);
}
export function activateBreakthrough(g: Game, unitId: string) {
  const u = g.units.find((x) => x.id === unitId)!;
  if (g.phase !== 'btMove' || u.side !== g.phasing || u.cls !== 'armor' || u.unsupplied || u.disorder || u.moved || u.exploit || u.area == null) throw new Error('needs a supplied armor unit in good order');
  spendSA(g, u.side, u.ech, 'breakthrough movement'); clearInterdict(g, u); u.exploit = true;
}
export function mustFight(g: Game) {
  const bt = g.phase === 'btCombat'; if (g.phase !== 'combat' && !bt) return [];
  return newlyContested(g).filter((a) => !g.fought.includes(a) && fighters(g, a, g.phasing, true).some((u) => !u.garrison));
}

/* ================= phase flow ================= */
function retreatExcess(g: Game) {
  for (const side of ['german', 'allied'] as Side[]) for (const a of areas.keys()) {
    const us = blocks(g, a, side); while (us.length > 2) {
      const u = us.pop()!, to = neighbors(a).find((n) => g.control[n] === side && !unitsIn(g, n, other(side)).length && blocks(g, n, side).length < 2);
      if (to == null) { u.str = 0; eliminate(g, u); } else { u.area = to; u.disorder = 1; say(g, `${u.name} retreats from overstacking to ${areas.get(to)!.name}`); }
    }
  }
}
function placeRiverAssaults(g: Game) {
  for (const [a, list] of Object.entries(g.entered)) {
    const area = +a, att = blocks(g, area, g.phasing);
    if (contested(g, area) && !g.contestedAtMoveStart.includes(area) && att.length && att.every((u) => list.some((e) => e.id === u.id && e.river)) && list.some((e) => e.blown) && !g.riverAssault.includes(area) && g.riverAssault.length < 4) {      // 4 markers in the counter mix
 g.riverAssault.push(area); say(g, `river assault in ${areas.get(area)!.name}`); }
  }
  g.entered = {}; g.riverCross = []; g.blowTried = [];
}
function supplyPhase(g: Game) {
  const stamp = g.turn * 2 + (g.phasing === 'german' ? 0 : 1);
  if (g.airSupply && g.airSupply.stamp < stamp) { chit(g, g.airSupply.id).box = 'eliminated'; g.airSupply = null; }   // 17.2 lasts until the next Supply Phase begins
  for (const a of areas.keys()) updateControl(g, a);
  for (const u of g.units.filter((x) => x.area != null && !x.garrison)) u.unsupplied = !inSupply(g, u.side, u.area!);
  for (const u of g.units.filter((x) => x.area != null && !x.unsupplied && x.disorder)) u.disorder = u.disorder === 2 ? 0 : 2;
  const rounds = g.turn >= 6 ? 2 : 1;                                                                // 14.93
  for (const u of g.units.filter((x) => x.area != null && x.side === g.phasing && x.unsupplied && !x.garrison)) for (let i = 0; i < rounds && u.area != null; i++) {
    const r = roll(g), q = quality(u);
    if (succeeds(r, moraleSn(q, u.disorder > 0, !(g.opts.airborne && AIRBORNE.has(u.name))))) continue;
    if (!u.disorder) { u.disorder = 1; say(g, `${u.name} unsupplied, morale failed (${r}): disordered`); }
    else if ((q === 'veteran' && r === 10) || (q === 'green' && r >= 8)) { eliminate(g, u); say(g, `${u.name} surrenders (${r})`); }
    else { u.str -= 1; if (u.str <= 0) eliminate(g, u); say(g, `${u.name} unsupplied and disordered, morale failed (${r}): step loss`); }
  }
  for (const h of g.units.filter((x) => x.heydte && x.area != null && g.turn >= 4 && x.side === g.phasing)) if (!inSupply(g, 'german', h.area!)) { const r = roll(g); if (!succeeds(r, moraleSn('veteran', false, true))) { say(g, `von der Heydte out of supply, morale failed (${r}): eliminated`); eliminate(g, h); } }
  g.riverAssault = []; g.fieldWorks = g.fieldWorks.filter((a) => !contested(g, a));
  g.roadblocks = {}; g.pooled = null; for (const [, id] of Object.entries(g.interdicted)) chit(g, id).box = 'eliminated'; g.interdicted = {};   // 4.34, 14.62b, 17.2
  for (const u of g.units.filter((x) => x.id.startsWith('DR-') && x.area != null)) { chit(g, u.chitId!).box = 'used'; u.area = null; say(g, `${u.name} survives and returns to the Used Box`); }   // 4.35
  g.units.forEach((x) => { if (x.side === g.phasing) x.bcross = false; });
  g.units.forEach((u) => { u.exploit = false; u.adjOnly = false; if (u.side === other(g.phasing)) dropReserve(g, u); });
}
export function endPhase(g: Game) {
  if (g.over) return;
  if (g.recover.length) throw new Error('choose the assets to recover first (4.1a)');
  if (g.battle) throw new Error('finish the open battle first');
  if (g.pendingBlow) throw new Error('resolve the bridge-blowing attempt first');
  if (mustFight(g).length) throw new Error('newly contested areas must be fought first');
  const ph = g.phase;
  g.fieldWorks = g.fieldWorks.filter((a) => { const o = g.fwOwner[a]; return o ? unitsIn(g, a, o).length > 0 : unitsIn(g, a).length > 0; });   // 5.23 gone when no friendly unit is left in the area
  for (const a of Object.keys(g.fwOwner).map(Number)) if (!g.fieldWorks.includes(a)) delete g.fwOwner[a];
  if (ph === 'reinforcement') for (const id of [...g.pendingArrivals]) autoArrive(g, id);
  if (ph === 'admin') g.revealed = null;                                                      // 8.32 revealed only until the end of the Admin Phase
  if (ph === 'movement' || ph === 'btMove') placeRiverAssaults(g);
  if (ph === 'movement' || ph === 'strategic' || ph === 'combat' || ph === 'reaction' || ph === 'btMove' || ph === 'btCombat') retreatExcess(g);
  if (ph === 'supply') {
    g.units.forEach((u) => { u.exploit = false; });
    if (g.phasing === 'german') g.phasing = 'allied';
    else {
      const v = victory(g), sd = TRACK[g.turn - 1].sd;
      say(g, `Victory check: German ${v.german}, Allied ${v.allied}, net ${v.net > 0 ? 'German +' + v.net : v.net < 0 ? 'Allied +' + -v.net : '0'}`);
      if (sd && ((v.net > 0 && v.net >= sd[0]) || (v.net < 0 && -v.net >= sd[1]))) { g.over = `Sudden death victory: ${v.net > 0 ? 'German' : 'Allied'} (net ${Math.abs(v.net)})`; return; }
      if (g.turn >= g.lastTurn) { g.over = finalResult(g, v.net); return; }
      g.turn++; g.phasing = 'german'; g.phase = 'reinforcement'; reinforcementPhase(g); g.units.forEach((u) => { u.moved = false; u.spent = 0; }); say(g, 'reinforcement phase'); return;
    }
    g.phase = 'admin'; drawFor(g); return;
  }
  const order: Phase[] = ['reinforcement', 'admin', 'movement', 'strategic', 'combat', 'reaction', 'btMove', 'btCombat', 'supply'];
  g.phase = order[order.indexOf(ph) + 1];
  if (g.phase === 'admin') { g.greifTried = []; drawFor(g); }
  if (g.phase === 'movement') { g.units.forEach((u) => { u.moved = false; u.spent = 0; }); g.contestedAtMoveStart = contestedAreas(g); g.stratMoves = 0; }
  if (g.phase === 'strategic') g.units.forEach((u) => { u.moved = false; u.spent = 0; });
  if (g.phase === 'combat') g.fought = [];
  if (g.phase === 'reaction' || g.phase === 'btMove') { g.units.forEach((u) => { u.moved = false; u.spent = 0; }); if (g.phase === 'btMove') g.contestedAtMoveStart = contestedAreas(g); }
  if (g.phase === 'btCombat') g.fought = [];
  if (g.phase === 'supply') supplyPhase(g);
  say(g, 'phase start');
}
function drawFor(g: Game) {
  const i = g.phasing === 'german' ? 0 : 1, t = TRACK[g.turn - 1];
  drawChits(g, 'german', t.ge[i]); drawChits(g, 'allied', t.al[i]);
  say(g, `Admin draws: German ${t.ge[i]}, Allied ${t.al[i]}`);
}
function finalResult(g: Game, net: number) {
  if (g.opts.scenario === 'campaign') return net >= 4 ? 'German Operational Victory' : net >= 1 ? 'German Marginal Victory' : net === 0 ? 'Draw' : net >= -3 ? 'Allied Marginal Victory' : 'Allied Operational Victory';
  return net >= 4 ? 'German Operational Victory' : net >= 2 ? 'German Marginal Victory' : net >= 0 ? 'Allied Marginal Victory' : 'Allied Operational Victory';
}
export const unitsFor = (g: Game, side: Side) => g.units.filter((u) => u.side === side && u.area != null);

/* ================= M3: roadblocks, staff functions, air missions, reroute ================= */
const vacantSupplied = (g: Game, side: Side, a: number) => supplied(g, side, a) && !unitsIn(g, a).length && areas.get(a)!.tdn >= 1;
/** 4.34 / 4.35: a roadblock marker, or the engineer itself as a defended roadblock. */
export function roadblock(g: Game, id: string, area: number, defended: boolean) {
  needAdmin(g); const c = chit(g, id);
  if (c.kind !== 'engineer' || c.box !== 'available' || !echOk(g, c, area) || !vacantSupplied(g, c.side, area) || g.roadblocks[area]) throw new Error('needs a supplied, friendly, vacant area with a Terrain Difficulty Number of 1 or more');
  if (defended) {
    g.units.push({ id: `DR-${id}`, name: `Defended roadblock (${areas.get(area)!.name})`, side: c.side, cls: 'infantry', q: ['green'], max: 1, str: 1, area, garrison: true, disorder: 0, unsupplied: false, moved: true, reserve: null, exploit: false, ech: c.ech, chitId: id });
    c.box = 'map';
  } else { g.roadblocks[area] = c.side; c.box = 'used'; }
  say(g, `${c.name} makes a ${defended ? 'defended ' : ''}roadblock in ${areas.get(area)!.name}`);
}
export function roadblockAreas(g: Game, side: Side) { return [...areas.keys()].filter((a) => vacantSupplied(g, side, a) && !g.roadblocks[a]); }
const staff = (g: Game, id: string) => { needAdmin(g); const c = chit(g, id); if (c.kind !== 'command_staff' || c.box !== 'available') throw new Error('command staff not available'); return c; };
/** 14.62a (Germans only) */
export function staffBoundary(g: Game, id: string, unitId: string) {
  const c = staff(g, id), u = g.units.find((x) => x.id === unitId)!;
  if (c.side !== 'german' || u.side !== 'german' || u.area == null || u.garrison || ARMY(u) == null) throw new Error('needs a German unit of an army');
  u.bcross = true; c.box = 'used'; say(g, `Command staff: ${u.name} may leave its army zone for free`);
}
/** 14.62b (Americans only) */
export function staffPool(g: Game, id: string, area: number) {
  const c = staff(g, id);
  if (c.side !== 'allied' || !areas.has(area)) throw new Error('Americans only');
  g.pooled = area; c.box = 'used'; say(g, `Command staff: assets pooled for the battle in ${areas.get(area)!.name}`);
}
/** 8.32 */
export function staffIntel(g: Game, id: string, unitId: string) {
  const c = staff(g, id), u = g.units.find((x) => x.id === unitId)!;
  if (u.side === c.side || u.area == null || u.garrison) throw new Error('choose an enemy block on the map');
  g.revealed = u.id; c.box = 'used'; say(g, `Intelligence: ${u.name} in ${areas.get(u.area)!.name} is revealed (${u.str}/${u.max} steps, ${quality(u)})`);
}
/** 17.2 Interdiction Mission (Allied air mission, Admin Phase). */
export function playInterdiction(g: Game, id: string, area: number) {
  needAdmin(g); const c = chit(g, id);
  if (c.kind !== 'air_mission' || c.box !== 'available' || !areas.has(area) || g.interdicted[area]) throw new Error('needs an Air Mission in the Available Box and a free area');
  g.interdicted[area] = id; c.box = 'map'; say(g, `Interdiction mission over ${areas.get(area)!.name}`);
}
/** 17.2 Air Supply Mission: one unsupplied area, played during a Supply Phase (here: the step before it runs). */
export function airSupplyAreas(g: Game, side: Side) { return [...new Set(g.units.filter((u) => u.side === side && u.area != null && !u.garrison && !inSupply(g, side, u.area)).map((u) => u.area!))]; }
export function playAirSupply(g: Game, id: string, area: number) {
  const c = chit(g, id);
  if (g.phase !== 'btCombat' || g.battle || c.kind !== 'air_mission' || c.box !== 'available' || c.side !== g.phasing || g.airSupply || !airSupplyAreas(g, c.side).includes(area)) throw new Error('needs an Air Mission, the end of the turn, and an unsupplied area');
  g.airSupply = { area, side: c.side, id, stamp: g.turn * 2 + (g.phasing === 'german' ? 0 : 1) }; c.box = 'map'; say(g, `Air Supply mission over ${areas.get(area)!.name}`);
}
/** 8.27 Reroute a reinforcing unit (Reinforcement Phase, one Special Action). */
export function rerouteOptions(g: Game, unitId: string): number[] {
  const u = g.units.find((x) => x.id === unitId); if (!u || g.phase !== 'reinforcement' || !g.arrived.includes(u.id) || u.area == null || !saAvailable(g, u.side, u.ech).length) return [];
  return [...new Set(appropriateAreas(u))].filter((a) => a !== u.area && (g.control[a] === u.side || !unitsIn(g, a).length) && blocks(g, a, u.side).length < 2 && !unitsIn(g, a, other(u.side)).length);
}
export function reroute(g: Game, unitId: string, area: number) {
  if (!rerouteOptions(g, unitId).includes(area)) throw new Error('not a legal entry area');
  const u = g.units.find((x) => x.id === unitId)!, from = u.area!; spendSA(g, u.side, u.ech, 'reroute a reinforcement');
  u.area = area; g.control[area] = u.side; updateControl(g, from); say(g, `${u.name} rerouted to ${areas.get(area)!.name}`);
}

/* ================= arrivals (4.1c) ================= */
const listedEntries = (u: Unit) => (u.entry ?? []).map((l) => ENTRY[l]?.area).filter(Boolean) as number[];
const stackFree = (g: Game, u: Unit, a: number) => g.turn === 4 && u.side === 'german' && a === ENTRY.Z.area;                // 15.3
const entryOpen = (g: Game, u: Unit, a: number) => (g.control[a] === u.side || !unitsIn(g, a).length) && (blocks(g, a, u.side).length < 2 || stackFree(g, u, a)) && !unitsIn(g, a, other(u.side)).length;
/** Entry areas a block that has not arrived yet may be placed in. Areas outside its listed ones cost a Special Action (8.27). */
export function arrivalOptions(g: Game, id: string): { area: number; sa: boolean }[] {
  const u = g.units.find((x) => x.id === id); if (!u || !g.pendingArrivals.includes(id)) return [];
  const own = listedEntries(u).filter((a) => entryOpen(g, u, a)), sa = saAvailable(g, u.side, u.ech).length > 0;
  const rest = (u.delayed || sa) ? [...new Set(appropriateAreas(u))].filter((a) => !own.includes(a) && entryOpen(g, u, a)) : [];   // 4.1c a delayed unit takes the nearest allowed area, otherwise it costs a Special Action
  return [...own.map((area) => ({ area, sa: false })), ...rest.map((area) => ({ area, sa: !u.delayed }))];
}
export function placeArrival(g: Game, id: string, area: number) {
  const opt = arrivalOptions(g, id).find((o) => o.area === area); if (!opt) throw new Error('not a legal entry area');
  const u = g.units.find((x) => x.id === id)!; if (opt.sa) spendSA(g, u.side, u.ech, 'reroute a reinforcement');
  u.area = area; g.control[area] = u.side; g.arrived.push(id); g.pendingArrivals = g.pendingArrivals.filter((x) => x !== id); say(g, `${u.name} arrives in ${areas.get(area)!.name}`);
}
function autoArrive(g: Game, id: string) {
  const u = g.units.find((x) => x.id === id)!, opts = listedEntries(u), to = opts.find((a) => g.control[a] === u.side && (blocks(g, a, u.side).length < 2 || stackFree(g, u, a))) ?? opts.find((a) => !unitsIn(g, a).length);
  g.pendingArrivals = g.pendingArrivals.filter((x) => x !== id);
  if (to == null) { u.arrival = g.turn + 1; u.delayed = true; say(g, `${u.name} delayed one turn (entry blocked)`); return; }
  u.area = to; g.control[to] = u.side; g.arrived.push(id); say(g, `${u.name} arrives in ${areas.get(to)!.name}`);
}

/** Test hooks for rules that have no public entry point. */
export const updateControlForTest = updateControl;
export const allocateForTest = allocate;
