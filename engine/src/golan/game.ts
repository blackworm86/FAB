// FAB: Golan '73 game state: scenario set-up (22.1/22.2), the turn sequence (3.0), the Reinforcement and Admin Phases (4.1, 4.2,
// 16.12 SAM reduction, 16.23), area control (2.4), supply (9.31, 14.9), victory points and sudden death (19.0), and unit moves
// through the movement rules (move.ts). Combat resolution, events and engineering come next on top of this state.
import unitsJson from '../../../data/golan73/units.json';
import countersJson from '../../../data/golan73/counters.json';
import setupsJson from '../../../data/golan73/setups.json';
import trackJson from '../../../data/golan73/turn_track.json';
import { ASSEMBLY, ENTRY, HERMON, area, areas, connection, edgeKey, enemyOf, isAssembly, neighbors, type GSide } from './map';
import { pathCost, reachable, stratReachable, type GMoveCtx, type GReach } from './move';
import { moraleSn, type Quality } from './combat';
import type { GBattle } from './battle';

export type GPhase = 'reinforcement' | 'admin' | 'movement' | 'strategic' | 'combat' | 'reaction' | 'btMove' | 'btCombat' | 'supply';
export const PHASES: GPhase[] = ['admin', 'movement', 'strategic', 'combat', 'reaction', 'btMove', 'btCombat', 'supply'];
export type Box = 'map' | 'future' | 'arriving' | 'operational_reserve' | 'strategic_reserve' | 'air_assault' | 'eliminated' | 'strongpoint_pool' | 'evacuated';
export type ChitBox = 'future' | 'cup' | 'available' | 'used' | 'eliminated' | 'map' | 'air_support_holding' | 'evacuated_strongpoints';

export interface GUnit {
  id: string; name: string; side: GSide; cls: 'armor' | 'infantry'; symbol?: string; kind?: 'strongpoint' | 'ghost';
  support?: 'armor' | 'infantry';          // strongpoint tank or rifle symbol (15.6)
  max: number; str: number; q: Quality[]; division?: string | null; brigade?: string;
  area: number | null; box: Box; arrival?: number; entry?: string[];
  disorder: 0 | 1 | 2;                     // good order, disordered, recovering
  unsupplied: boolean; reserve: boolean; exploit: boolean; revealed: boolean;
  movedThisPhase?: boolean; spent?: number; minefieldFailed?: boolean;
  from?: number;                           // area it came from into a newly contested area (14.01a: an aborted assault goes back there)
}
export interface GChit { id: string; counter: string; name: string; kind: string; side: GSide | 'none'; quality?: Quality; turn: number | string | null; box: ChitBox; area?: number }
export interface GLog { turn: number; side: GSide | null; phase: GPhase; text: string }
export interface GGame {
  scenario: 'badr' | 'badr_alt'; turn: number; lastTurn: number; player: GSide; phase: GPhase; rng: number;
  units: GUnit[]; chits: GChit[]; control: Record<number, GSide>;
  minefields: string[]; bridgedDitch: string[]; blownBridges: string[]; fieldWorks: number[]; riverAssault: number[]; raids: number[];
  interdicted: Record<number, GSide>; crossed: string[]; reserveMarkers: Record<GSide, number>;
  freeCombatRound: number;                 // 22.17: Syrian free Breakthrough combat rounds left on turn 1
  purpleLineCrossed: boolean; airReleased: number; hermonLost: boolean;
  eliminatedLarge: Record<GSide, number>;  // large units lost by each side (19.2)
  vp: { syrian: number; israeli: number; net: number; leader: GSide | null };
  result: string | null; log: GLog[];
  battle: GBattle | null; fought: number[];
  airAssaultArea?: number; samTarget?: string; raidPartial?: number[];
}

type RawUnit = { id: string; name: string; side: GSide; cls?: string; symbol?: string; kind?: string; steps?: number; quality_by_step?: Quality[]; division?: string | null; brigade?: string;
  start_area?: number; arrival_turn?: number; entry?: string[]; initial_steps?: number; start_box?: string };
type RawChit = { id: string; ids: string[]; kind: string; side: GSide | 'none'; name: string; turn: number | string | null; quality?: Quality; area?: number; start_box?: string; symbol?: string };
type Setup = { units: { id: string; area?: number; box?: string }[]; reduced?: Record<string, number>; holding_boxes?: Record<string, string[]>; available?: Record<GSide, string[]>;
  garrisons?: { id: string; area: number }[]; strongpoints?: { suggested_historical: { area: number; id: string }[] }; minefields?: { fixed: number[][] }; riverAssault?: number[];
  reserve?: { syrian?: string[] }; turns: number };
const UNITS = unitsJson as unknown as RawUnit[], COUNTERS = countersJson as unknown as RawChit[];
const SETUPS = setupsJson as unknown as Record<string, Setup>;
const TRACK = (trackJson as unknown as { turns: Record<string, { night: boolean; draws: Record<GSide, [number, number]>; suddenDeath: Record<GSide, number> | null }> }).turns;
const NOT_CHITS = new Set(['minefield', 'marker', 'reserve_marker', 'marker_control', 'field_works', 'marker_at_ditch_bridged']);

/* ---------- dice: a serialisable mulberry32 state, so a saved game replays the same rolls ---------- */
function random(g: GGame): number {
  g.rng = (g.rng + 0x6d2b79f5) | 0; let t = Math.imul(g.rng ^ (g.rng >>> 15), 1 | g.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const roll = (g: GGame) => 1 + Math.floor(random(g) * 10);
const ok = (die: number, sn: number) => die === 1 || (die !== 10 && die <= sn);
const say = (g: GGame, text: string) => g.log.push({ turn: g.turn, side: g.player, phase: g.phase, text });

/** Entry letters on a label are a range: "VW" or ["V","W"] → V and W; Israeli letters are the Assembly areas (14.21, 14.22). */
export function entryAreas(u: GUnit): number[] {
  const ls = u.entry ?? []; if (!ls.length) return [];
  if (u.side === 'israeli') return ls.map((l) => (l === 'B' ? ASSEMBLY.B : ASSEMBLY.A));
  const all = 'VWXYZ', i0 = all.indexOf(ls[0]), i1 = all.indexOf(ls[ls.length - 1]);
  return all.slice(Math.min(i0, i1), Math.max(i0, i1) + 1).split('').map((l) => ENTRY[l]);
}

/* ---------- set-up ---------- */
export function newGolanGame(seed = 1, scenario: 'badr' | 'badr_alt' = 'badr'): GGame {
  const S = SETUPS.badr;                                                    // badr_alt shares everything but the free placement (22.24/22.25)
  const where = new Map(S.units.map((p) => [p.id, p]));
  const sp = new Map((S.strongpoints?.suggested_historical ?? []).map((p) => [p.id, p.area]));
  const units: GUnit[] = UNITS.filter((u) => u.kind !== 'special_action_block').map((u) => {
    const p = where.get(u.id), max = u.steps ?? 1;
    const box: Box = p?.area != null || sp.has(u.id) ? 'map' : p?.box === 'operational_reserve' ? 'operational_reserve' : p?.box === 'strategic_reserve' ? 'strategic_reserve'
      : p?.box === 'air_assault' ? 'air_assault' : u.arrival_turn != null ? 'future' : u.kind ? 'strongpoint_pool' : 'future';
    const kind = u.kind === 'strongpoint' || u.kind === 'ghost' ? u.kind : undefined;
    return { id: u.id, name: u.name, side: u.side, cls: (u.cls ?? 'infantry') as 'armor' | 'infantry', symbol: u.symbol, kind, support: kind === 'strongpoint' ? (u.symbol === 'armor' ? 'armor' : 'infantry') : undefined,
      max, str: S.reduced?.[u.id] ?? u.initial_steps ?? max, q: u.quality_by_step ?? [], division: u.division, brigade: u.brigade,
      area: p?.area ?? sp.get(u.id) ?? null, box, arrival: u.arrival_turn, entry: u.entry, disorder: 0, unsupplied: false, reserve: false, exploit: false, revealed: false };
  });
  const avail = new Set([...(S.available?.syrian ?? []), ...(S.available?.israeli ?? [])]);
  const hold = S.holding_boxes ?? {};
  const inHold = (id: string): ChitBox | null => (hold.air_support_holding?.includes(id) ? 'air_support_holding' : hold.evacuated_strongpoints?.includes(id) ? 'evacuated_strongpoints' : null);
  const garrison = new Map((S.garrisons ?? []).map((x) => [x.id, x.area]));
  const chits: GChit[] = [];
  for (const c of COUNTERS) {
    if (NOT_CHITS.has(c.kind) || c.side === 'none') continue;
    for (const id of c.ids?.length ? c.ids : [c.id]) {
      const box: ChitBox = garrison.has(c.id) ? 'map' : inHold(id) ?? (c.turn === 'S' || avail.has(id) ? 'available' : 'future');
      chits.push({ id, counter: c.id, name: c.name, kind: c.kind, side: c.side, quality: c.quality ?? undefined, turn: c.turn, box, area: garrison.get(c.id) });
    }
  }
  for (const u of UNITS.filter((x) => x.kind === 'special_action_block'))      // the reusable Special Action blocks (8.1), from turn 2
    chits.push({ id: u.id, counter: u.id, name: u.name, kind: 'sa_block', side: u.side, turn: u.arrival_turn ?? 2, box: 'future' });
  const control: Record<number, GSide> = {};
  for (const a of areas.values()) control[a.id] = a.syria ? 'syrian' : 'israeli';         // 22.13: everything west of the Purple Line is Israeli
  const g: GGame = {
    scenario, turn: 1, lastTurn: S.turns, player: 'syrian', phase: scenario === 'badr' ? 'combat' : 'movement', rng: seed | 0,
    units, chits, control, minefields: (S.minefields?.fixed ?? []).map(([a, b]) => edgeKey(a, b)), bridgedDitch: [], blownBridges: [], fieldWorks: [],
    riverAssault: scenario === 'badr' ? [...(S.riverAssault ?? [])] : [], raids: [], interdicted: {}, crossed: [], reserveMarkers: { israeli: 4, syrian: 2 },
    freeCombatRound: scenario === 'badr' ? 2 : 0, purpleLineCrossed: false, airReleased: 0, hermonLost: false, eliminatedLarge: { israeli: 0, syrian: 0 },
    vp: { syrian: 0, israeli: 0, net: 0, leader: null }, result: null, log: [], battle: null, fought: [],
  };
  for (const a of g.riverAssault) for (const u of onMap(g, a)) if (u.side === 'syrian') u.from = neighbors(a).find((n) => connection(a, n)!.atDitch && g.control[n] === 'syrian');   // the bridgeheads came across the ditch
  for (const id of S.reserve?.syrian ?? []) if (scenario === 'badr') { unit(g, id).reserve = true; g.reserveMarkers.syrian--; }
  computeVictory(g);
  say(g, scenario === 'badr' ? 'Operation Badr: the Syrian assault has crossed the Purple Line; the game opens with the Syrian Combat Phase of turn 1.' : 'Operation Badr, alternate set-up.');
  return g;
}

/* ---------- queries ---------- */
export const unit = (g: GGame, id: string) => { const u = g.units.find((x) => x.id === id); if (!u) throw new Error(`no unit ${id}`); return u; };
export const chit = (g: GGame, id: string) => { const c = g.chits.find((x) => x.id === id); if (!c) throw new Error(`no counter ${id}`); return c; };
export const onMap = (g: GGame, a: number) => g.units.filter((u) => u.box === 'map' && u.area === a);
export const count = (g: GGame, a: number): Record<GSide, number> => { const r = { israeli: 0, syrian: 0 }; for (const u of onMap(g, a)) r[u.side]++; return r; };
export const contested = (g: GGame, a: number) => { const c = count(g, a); return c.israeli > 0 && c.syrian > 0; };
const assetsAt = (g: GGame, a: number): Record<GSide, number> => { const r = { israeli: 0, syrian: 0 }; for (const c of g.chits) if (c.box === 'map' && c.area === a && c.side !== 'none') r[c.side]++; return r; };
export const isNight = (g: GGame) => TRACK[g.turn]?.night ?? false;

export function moveCtx(g: GGame): GMoveCtx {
  return {
    turn: g.turn, units: (a) => (isAssembly(a) ? { israeli: 0, syrian: 0 } : count(g, a)), assets: (a) => assetsAt(g, a), controller: (a) => (isAssembly(a) ? 'israeli' : g.control[a]),
    bridgedDitch: new Set(g.bridgedDitch), blownBridges: new Set(g.blownBridges), minefields: new Set(g.minefields), crossedThisPhase: new Set(g.crossed),
    interdicted: (a) => g.interdicted[a], raids: new Set(g.raids),
  };
}
const asMover = (u: GUnit) => ({ side: u.side, cls: u.cls, area: u.area!, supplied: !u.unsupplied, disordered: u.disorder === 1, immobile: !!u.kind, adjacentOnly: u.exploit, spent: u.spent, minefieldFailed: u.minefieldFailed });

/** Where a unit may move now (Operational or Breakthrough Movement Phase of its side). */
export function moveOptions(g: GGame, id: string): GReach[] {
  const u = unit(g, id);
  const mover = g.phase === 'reaction' ? enemyOf(g.player) : g.player;
  if (u.box !== 'map' || u.side !== mover || u.movedThisPhase) return [];
  if (g.phase === 'movement') return reachable(asMover(u), moveCtx(g));
  if (g.phase === 'btMove' && (u.reserve || u.exploit)) return reachable({ ...asMover(u), adjacentOnly: u.exploit && !u.reserve }, moveCtx(g));
  if (g.phase === 'reaction' && u.reserve) return reachable(asMover(u), moveCtx(g)).filter((r) => contested(g, r.area) || count(g, r.area)[enemyOf(u.side)] === 0);
  return [];
}
export const stratOptions = (g: GGame, id: string) => { const u = unit(g, id); return g.phase === 'strategic' && u.reserve && !u.unsupplied && u.side === g.player ? stratReachable(asMover(u), moveCtx(g)) : []; };

/** Move a unit along a chosen path (or the cheapest one to `to`). Minefield checks and commando raid rolls happen on the way. */
export function move(g: GGame, id: string, to: number, path?: number[]) {
  const u = unit(g, id), opt = moveOptions(g, id).find((r) => r.area === to);
  if (!opt) throw new Error(`${u.name} cannot move to ${to}`);
  const route = path ?? opt.path, priced = pathCost(asMover(u), moveCtx(g), route);
  if (!priced) throw new Error('that route is not allowed');
  let at = u.area!;
  for (let i = 1; i < route.length; i++) {
    const from = route[i - 1], next = route[i], key = edgeKey(from, next);
    if (u.side === 'syrian' && g.minefields.includes(key)) {                                     // 14.02
      const die = roll(g), sn = moraleSn(u.q[u.str - 1] ?? 'veteran', { disordered: u.disorder === 1, unsupplied: u.unsupplied });
      if (!ok(die, sn)) { u.minefieldFailed = true; u.spent = (u.spent ?? 0) + (connection(from, next)!.kind === 'road' ? 1 : 2) + 1; say(g, `${u.name} fails the minefield check (${die} vs ${sn}) and stays in ${at}.`); return { stopped: at, failed: 'minefield' as const }; }
      say(g, `${u.name} crosses the minefield (${die} vs ${sn}).`);
    }
    at = next;
    if (u.side === 'israeli' && g.raids.includes(next)) {                                         // 16.11a
      const die = roll(g);
      if (die >= 6) { const c = g.chits.find((x) => x.box === 'map' && x.area === next && x.kind === 'commando'); if (c) c.box = 'eliminated'; g.raids = g.raids.filter((a) => a !== next); say(g, `Commando raid in ${next} fails (${die}).`); }
      else { if (die >= 3) (g.raidPartial ??= []).push(next); say(g, `Commando raid in ${next} ${die <= 2 ? 'succeeds' : 'partly succeeds'} (${die}): ${u.name} stops.`); break; }
    }
  }
  for (const l of priced.limited) if (!g.crossed.includes(l)) g.crossed.push(l);
  if (u.area != null && !isAssembly(u.area) && area(u.area).syria === false && !isAssembly(at) && area(at).syria && u.side === 'israeli' && !g.purpleLineCrossed) purpleLineCrossed(g);
  if (count(g, at)[enemyOf(u.side)] > 0 && !onMap(g, at).some((x) => x.revealed)) u.from = route[route.indexOf(at) - 1];
  u.area = at; u.movedThisPhase = true; u.reserve = false;                                  // 5.21: the marker goes when the unit moves
  evacuateStrongpoints(g, route[0], u);
  updateControl(g, at);
  say(g, `${u.name} moves to ${at}.`);
  return { stopped: at };
}

/** 15.2, 15.4a: the first Israeli unit into Syria releases the 3rd Tank Division and two Strategic Reserve units. */
function purpleLineCrossed(g: GGame) {
  g.purpleLineCrossed = true;
  for (const u of g.units) if (u.box === 'operational_reserve') u.box = 'arriving';
  const sr = g.units.filter((u) => u.box === 'strategic_reserve').slice(0, 2); for (const u of sr) u.box = 'arriving';
  say(g, 'Israeli units cross the Purple Line: the 3rd Tank Division and two Strategic Reserve units are released (15.2, 15.4a).');
}
/** 15.6: a regular unit leaving a contested area evacuates the strongpoint there; a matching Task Force goes into the cup. */
function evacuateStrongpoints(g: GGame, from: number, mover: GUnit) {
  if (mover.side !== 'israeli' || mover.kind) return;
  const spt = onMap(g, from).find((x) => x.kind === 'strongpoint');
  if (!spt || count(g, from).syrian === 0) return;
  spt.box = 'evacuated'; spt.area = null;
  const tf = g.chits.find((c) => c.box === 'evacuated_strongpoints' && c.kind === 'task_force' && c.name.includes(spt.support === 'armor' ? 'armor' : 'infantry'));
  if (tf) tf.box = 'cup';
  say(g, `The strongpoint in ${from} is evacuated; a Task Force goes into the Israeli cup.`);
}

export function updateControl(g: GGame, a: number) {
  if (isAssembly(a)) return;
  const c = count(g, a);
  if (c.israeli > 0 && c.syrian === 0) g.control[a] = 'israeli';
  if (c.syrian > 0 && c.israeli === 0) g.control[a] = 'syrian';
  if (a === HERMON && g.control[a] === 'syrian') g.hermonLost = true;                     // 16.21: for the rest of the game
}

/** Place an arriving unit in one of its entry areas (4.1c, 14.2): friendly-controlled or vacant, within stacking. */
export function arrivalOptions(g: GGame, id: string) {
  const u = unit(g, id);
  if (u.box !== 'arriving') return [];
  return entryAreas(u).filter((a) => isAssembly(a) || ((g.control[a] === u.side || count(g, a)[enemyOf(u.side)] === 0) && count(g, a)[u.side] < 2));
}
export function placeArrival(g: GGame, id: string, a: number) {
  if (!arrivalOptions(g, id).includes(a)) throw new Error(`cannot place ${id} in ${a}`);
  const u = unit(g, id); u.box = 'map'; u.area = a; updateControl(g, a); say(g, `${u.name} arrives in ${isAssembly(a) ? (a === ASSEMBLY.A ? 'Assembly Area A' : 'Assembly Area B') : a}.`);
}

/* ---------- Reinforcement (4.1) and Admin (4.2a) ---------- */
function reinforcementPhase(g: GGame) {
  g.phase = 'reinforcement';
  for (const side of ['syrian', 'israeli'] as GSide[]) {
    const sa = g.chits.find((c) => c.kind === 'sa_block' && c.side === side);
    if (sa?.box === 'used') sa.box = 'available';                                                   // 4.1a
    if (side === 'syrian') {                                                                        // 16.12 SAM barrier reduction
      const sams = g.chits.filter((c) => c.kind === 'sam' && c.box === 'used');
      const rolls = sams.map(() => roll(g));
      if (rolls.some((r) => r >= 6)) { sams[0].box = 'eliminated'; samEliminated(g); say(g, `SAM reduction rolls ${rolls.join(', ')}: one SAM asset is eliminated.`); }
    }
    for (const c of g.chits) if (c.side === side && c.box === 'used' && c.kind !== 'sa_block') c.box = 'cup';                       // 4.1b
    for (const u of g.units) if (u.side === side && u.box === 'future' && u.arrival === g.turn) u.box = 'arriving';                  // 4.1c
    for (const c of g.chits) if (c.side === side && c.box === 'future' && c.turn === g.turn) c.box = c.kind === 'sa_block' ? 'available' : 'cup';   // 4.1d
  }
}
/** 16.23: the first three SAM losses each bring a conditional Israeli air support asset into the cup. */
export function samEliminated(g: GGame) {
  if (g.airReleased >= 3) return;
  const c = g.chits.find((x) => x.box === 'air_support_holding'); if (c) { c.box = 'cup'; g.airReleased++; }
}
/** 4.2a: both players draw from their cups as the Turn Track says for this player turn. */
function adminDraw(g: GGame) {
  const t = TRACK[g.turn], i = g.player === 'syrian' ? 0 : 1;
  if (g.turn === 1 && g.player === 'syrian') return;                                                // 22.14/22.15: Syrian Admin Phase skipped on turn 1
  for (const side of ['syrian', 'israeli'] as GSide[]) {
    const cup = g.chits.filter((c) => c.side === side && c.box === 'cup');
    for (let n = t.draws[side][i]; n > 0 && cup.length; n--) { const k = Math.floor(random(g) * cup.length); cup.splice(k, 1)[0].box = 'available'; }
  }
}

/* ---------- supply (9.31, 14.9) ---------- */
const sources = (g: GGame, side: GSide) => side === 'syrian' ? Object.values(ENTRY).filter((a) => g.control[a] === 'syrian') : [...areas.values()].filter((a) => a.supply && g.control[a.id] === 'israeli').map((a) => a.id);
/** Can a unit or area of `side` at `start` trace a supply path? */
export function inSupply(g: GGame, side: GSide, start: number): boolean {
  if (isAssembly(start) || start === HERMON) return true;                                           // 14.94, 14.95
  const src = new Set(sources(g, side)), seen = new Set([start]), todo = [start];
  while (todo.length) {
    const a = todo.pop()!;
    if (src.has(a)) return true;
    for (const n of neighbors(a)) {
      if (seen.has(n) || isAssembly(n)) continue;
      const c = connection(a, n)!, key = edgeKey(a, n), first = a === start;
      if (g.control[n] !== side) continue;                                                          // 9.31b: into friendly-controlled areas only
      if (c.kind === 'hermon') continue;
      if (c.river && g.blownBridges.includes(key) && !first) continue;                              // 9.31a
      if (c.atDitch && !g.bridgedDitch.includes(key) && !first) continue;                           // 14.93
      if (c.escarpment && c.kind !== 'road') continue;
      if (side === 'syrian' && g.minefields.includes(key)) continue;
      seen.add(n); todo.push(n);
    }
  }
  return false;
}

/* ---------- victory (19.1–19.5) ---------- */
export function computeVictory(g: GGame) {
  const pts = { syrian: g.eliminatedLarge.israeli, israeli: g.eliminatedLarge.syrian };
  for (const a of areas.values()) {
    const ctl = g.control[a.id]; if (!ctl || !inSupply(g, ctl, a.id)) continue;
    const syrianHere = count(g, a.id).syrian > 0;
    if (ctl === 'syrian' && syrianHere) pts.syrian += a.vp.syrian + (a.vp.mutual ? 1 : 0);
    if (ctl === 'israeli') pts.israeli += (a.vp.mutual ? 1 : 0) + (a.syria ? 1 : 0);
  }
  const net = pts.syrian - pts.israeli;
  g.vp = { syrian: pts.syrian, israeli: pts.israeli, net: Math.abs(net), leader: net > 0 ? 'syrian' : net < 0 ? 'israeli' : null };
  return g.vp;
}
function victoryCheck(g: GGame) {
  const v = computeVictory(g), sd = TRACK[g.turn]?.suddenDeath;
  if (sd && v.leader && v.net >= sd[v.leader]) { g.result = `${v.leader === 'syrian' ? 'Syrian' : 'Israeli'} Sudden Death Victory (${v.net} net VP on turn ${g.turn})`; return; }
  if (g.turn >= g.lastTurn) g.result = !v.leader ? 'Draw (0 net VP)' : `${v.leader === 'syrian' ? 'Syrian' : 'Israeli'} ${v.net >= 3 ? 'Operational' : 'Marginal'} Victory (${v.net} net VP)`;
}
/** 19.5: a supplied Syrian unit west of the Jordan (areas 6, 7, 8) at the end of an Israeli player turn. */
const jordanCrossed = (g: GGame) => g.units.some((u) => u.side === 'syrian' && u.box === 'map' && [6, 7, 8].includes(u.area!) && inSupply(g, 'syrian', u.area!));

/* ---------- Supply Phase (9.0), simplified: status, recovery, markers; the unsupplied morale checks roll here ---------- */
function supplyPhase(g: GGame) {
  for (const u of g.units) if (u.box === 'map') {
    const always = u.kind === 'strongpoint' || u.id === 'S17' || isAssembly(u.area!) || u.area === HERMON;   // 15.6, 15.3, 14.94, 14.95
    u.unsupplied = !always && !inSupply(g, u.side, u.area!);
    if (!u.unsupplied && u.disorder) u.disorder = u.disorder === 1 ? 2 : 0;                     // 9.35
  }
  for (const u of g.units.filter((x) => x.box === 'map' && x.side === g.player && x.unsupplied)) {                       // 9.4
    const q = u.q[u.str - 1] ?? 'veteran', die = roll(g);
    if (ok(die, moraleSn(q, { disordered: u.disorder === 1, unsupplied: true }))) continue;
    if (u.disorder !== 1) { u.disorder = 1; say(g, `${u.name} is unsupplied and becomes disordered (${die}).`); continue; }
    if ((q === 'veteran' && die === 10) || (q === 'green' && die >= 8)) { eliminate(g, u); say(g, `${u.name} surrenders (${die}).`); continue; }
    u.str--; if (u.str <= 0) eliminate(g, u); say(g, `${u.name} is unsupplied and loses a step (${die}).`);
  }
  for (const a of [...g.fieldWorks]) if (contested(g, a)) g.fieldWorks = g.fieldWorks.filter((x) => x !== a);           // 9.5
  g.riverAssault = []; g.units.forEach((u) => { u.exploit = false; if (u.side !== g.player) u.reserve = false; });
  if (g.player === 'israeli') for (const k of Object.keys(g.interdicted)) delete g.interdicted[+k];                         // 16.31b
}
export function eliminate(g: GGame, u: GUnit) {
  u.box = 'eliminated'; u.area = null;
  if (u.max >= 3 && !u.kind) g.eliminatedLarge[u.side]++;                                       // 19.2
}

/** Newly contested areas (2.4): contested with blocks not yet face-up, or a raid an Israeli unit ran into. */
const holdsAsset = (g: GGame, a: number, side: GSide) => g.chits.some((c) => c.box === 'map' && c.area === a && c.side === side && (c.kind === 'garrison' || c.kind === 'commando'));
export const newlyContested = (g: GGame) => [...new Set([
  ...g.units.filter((u) => u.box === 'map' && u.area != null && !isAssembly(u.area) && !u.revealed && (contested(g, u.area) || holdsAsset(g, u.area, enemyOf(u.side)))).map((u) => u.area!),
  ...g.raids.filter((a) => count(g, a).israeli > 0 && !g.units.some((u) => u.area === a && u.revealed))])];
/** Battles still owed this Combat or Breakthrough Combat Phase (6.1, 7.41). */
export const mustFight = (g: GGame) => (g.phase === 'combat' || g.phase === 'btCombat' ? newlyContested(g).filter((a) => !g.fought.includes(a)) : []);

/** Advance to the next phase, running the automatic steps (Reinforcement, Admin draws, Supply, Victory Check). */
export function endPhase(g: GGame) {
  if (g.result) return;
  if (g.battle) throw new Error('finish the open battle first');
  if (mustFight(g).length) throw new Error(`combat is required in ${mustFight(g).join(', ')}`);
  if (g.phase === 'combat' || g.phase === 'btCombat') g.fought = [];
  if (g.phase === 'reinforcement' && g.units.some((u) => u.box === 'arriving' && arrivalOptions(g, u.id).length)) throw new Error('place the arriving units first');
  for (const u of g.units) { u.movedThisPhase = false; if (g.phase === 'movement' || g.phase === 'btMove') { u.spent = 0; } }
  if (g.phase === 'movement' || g.phase === 'btMove') g.crossed = [];
  if (g.phase === 'reinforcement') { g.phase = 'admin'; g.player = 'syrian'; adminDraw(g); return; }
  const i = PHASES.indexOf(g.phase);
  if (g.phase !== 'supply') { g.phase = PHASES[i + 1]; if (g.phase === 'supply') supplyPhase(g); return; }
  if (g.player === 'syrian') { g.player = 'israeli'; g.phase = 'admin'; adminDraw(g); return; }
  if (jordanCrossed(g)) { g.result = 'Syrian Automatic Victory: a supplied Syrian unit west of the Jordan (19.5)'; return; }
  victoryCheck(g); if (g.result) return;
  g.turn++; g.player = 'syrian'; for (const u of g.units) u.minefieldFailed = false;
  reinforcementPhase(g);
}
export { TRACK as TURN_TRACK };
