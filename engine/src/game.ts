import unitsJson from '../../data/bulge/units.json';
import entryJson from '../../data/bulge/entry_areas.json';
import scenJson from '../../data/bulge/scenarios.json';
import { areas, connection, edgeKey, neighbors } from './map';
import { d10, rng, succeeds } from './dice';
import { moraleSn, successNumber, type Quality, type Shooter } from './combat';
import { reachable } from './movement';

export type Side = 'german' | 'allied';
export type Phase = 'movement' | 'combat' | 'supply';
export interface Unit {
  id: string; name: string; side: Side; cls: 'armor' | 'infantry'; q: Quality[]; max: number; str: number;
  area: number | null; garrison?: boolean; disorder: 0 | 1 | 2; unsupplied: boolean; moved: boolean; reserve: boolean;
  arrival?: number; entry?: string[];
}
export interface Game {
  turn: number; lastTurn: number; phasing: Side; phase: Phase; units: Unit[];
  control: Record<number, Side>; fieldWorks: number[]; riverAssault: number[]; blown: string[];
  contestedAtMoveStart: number[]; fought: number[]; seed: number; rolls: number; log: string[]; over?: string;
}
type RawUnit = { id: string; name: string; side: string; cls?: string; steps?: number; quality_by_step?: Quality[]; start_area?: number; arrival_turn?: number; entry?: string[]; kind?: string };
const other = (s: Side): Side => (s === 'german' ? 'allied' : 'german');
const sideOf = (s: string): Side => (s === 'german' ? 'german' : 'allied');
const ENTRY = entryJson as Record<string, { side: string; area: number; nearby_detected: number[] }>;

export const quality = (u: Unit) => u.q[u.str - 1];
export const unitsIn = (g: Game, a: number, side?: Side) => g.units.filter((u) => u.area === a && (!side || u.side === side));
const blocks = (g: Game, a: number, side: Side) => unitsIn(g, a, side).filter((u) => !u.garrison);
export const contested = (g: Game, a: number) => unitsIn(g, a, 'german').length > 0 && unitsIn(g, a, 'allied').length > 0;
export const contestedAreas = (g: Game) => [...areas.keys()].filter((a) => contested(g, a));
export const newlyContested = (g: Game) => contestedAreas(g).filter((a) => !g.contestedAtMoveStart.includes(a));
const roll = (g: Game) => d10(rng(g.seed * 7919 + g.rolls++));
const say = (g: Game, s: string) => { g.log.push(`T${g.turn} ${g.phasing === 'german' ? 'GE' : 'AL'} ${g.phase}: ${s}`); };

/** Tournament scenario setup (24.2): units on their label start areas, markers per the scenario table. */
export function newGame(seed = Date.now() % 1e9): Game {
  const sc = scenJson.tournament;
  const units: Unit[] = [];
  for (const r of unitsJson as RawUnit[]) {
    if (r.kind) continue;                                   // Special Action blocks: not in the demo
    const max = r.steps!, red = (sc.reduced as Record<string, number>)[r.name] ?? (sc.reinforcementsReduced as Record<string, number>)[r.name];
    units.push({ id: r.id, name: r.name, side: sideOf(r.side), cls: r.cls as 'armor' | 'infantry', q: r.quality_by_step!, max, str: red ?? max,
      area: r.start_area ?? null, disorder: 0, unsupplied: false, moved: false, reserve: sc.reserve.includes(r.name), arrival: r.arrival_turn, entry: r.entry });
  }
  for (const a of sc.garrisons) units.push({ id: `G${a}`, name: `Garrison ${areas.get(a)!.name}`, side: 'allied', cls: 'infantry', q: ['green'], max: 1, str: 1, area: a, garrison: true, disorder: 0, unsupplied: false, moved: true, reserve: false });
  const g: Game = { turn: 1, lastTurn: sc.turns, phasing: 'german', phase: 'combat', units, control: {}, fieldWorks: [...sc.fieldWorks], riverAssault: [...sc.riverAssault],
    blown: [...sc.blownBridges], contestedAtMoveStart: [], fought: [], seed, rolls: 0, log: [] };
  // Allied control: areas with Allied units plus everything west of the front (reachable from Allied units without passing German-held areas).
  const ger = new Set(units.filter((u) => u.side === 'german' && u.area).map((u) => u.area!));
  const todo = units.filter((u) => u.side === 'allied' && u.area).map((u) => u.area!), seen = new Set(todo);
  while (todo.length) for (const n of neighbors(todo.pop()!)) if (!seen.has(n) && !ger.has(n)) { seen.add(n); todo.push(n); }
  for (const a of areas.keys()) g.control[a] = seen.has(a) ? 'allied' : 'german';
  for (const a of [1, 2, 3, 4, 5, 6, 7, 8, 14, 15]) if (!units.some((u) => u.side === 'allied' && u.area === a)) g.control[a] = 'german'; // German start line along the east edge
  say(g, 'Tournament scenario set up. All contested areas must be fought this phase.');
  return g;
}

function updateControl(g: Game, a: number) {
  const ge = blocks(g, a, 'german').length, al = blocks(g, a, 'allied').length;
  if (ge && !al && !unitsIn(g, a, 'allied').length) g.control[a] = 'german';
  if (al && !ge && !unitsIn(g, a, 'german').length) g.control[a] = 'allied';
}

/* ---------------- movement ---------------- */
export function moveOptions(g: Game, id: string) {
  const u = g.units.find((x) => x.id === id)!;
  if (g.phase !== 'movement' || u.side !== g.phasing || u.moved || u.area == null || u.garrison) return [];
  const enemy = other(u.side);
  const occ = (a: number) => ({ german: blocks(g, a, 'german').length, allied: blocks(g, a, 'allied').length });
  const garrisonOnly = new Set(g.units.filter((x) => x.garrison && x.side === enemy && x.area != null && !blocks(g, x.area, enemy).length).map((x) => x.area!));
  const r = reachable({ side: u.side, cls: u.cls, area: u.area, supplied: !u.unsupplied, disordered: u.disorder > 0 },
    { occupants: occ, blownBridges: new Set(g.blown), roadblocks: garrisonOnly, controller: (a) => g.control[a] });
  return r.filter((x) => blocks(g, x.area, u.side).length < 2);            // stacking 5.1
}
export function move(g: Game, id: string, to: number) {
  const opt = moveOptions(g, id).find((x) => x.area === to);
  if (!opt) throw new Error('illegal move');
  const u = g.units.find((x) => x.id === id)!, from = u.area!;
  u.area = to; u.moved = true; u.reserve = false;
  const crossed = opt.path.slice(1).map((a, i) => connection(opt.path[i], a)!);
  if (contested(g, to) && !g.contestedAtMoveStart.includes(to) && crossed[crossed.length - 1].river && g.blown.includes(edgeKey(opt.path[opt.path.length - 2], to)) && !g.riverAssault.includes(to)) g.riverAssault.push(to); // 5.35e (simplified)
  updateControl(g, from); updateControl(g, to);
  say(g, `${u.name} ${areas.get(from)!.name} → ${areas.get(to)!.name} (${opt.cost} MP)`);
}

/* ---------------- combat ---------------- */
export interface Battle { area: number; attacker: Side; attPoint: string; defPoint: string; stage: 'defFire' | 'attChoice' | 'offFire' | 'defChoice' | 'done'; pendingHits: number; rolls: { who: string; sn: number; dice: number[]; hits: number }[]; result?: string }

const fighters = (g: Game, a: number, side: Side, attacker: boolean) => unitsIn(g, a, side).filter((u) => !(attacker && u.disorder > 0));
export function startBattle(g: Game, a: number): Battle {
  if (g.phase !== 'combat' || !contested(g, a) || g.fought.includes(a)) throw new Error('no battle here');
  const att = fighters(g, a, g.phasing, true).filter((u) => !u.garrison), def = unitsIn(g, a, other(g.phasing));
  if (!att.length) throw new Error('no attacker in good order');
  const pick = (us: Unit[]) => [...us].sort((x, y) => +!!x.garrison - +!!y.garrison || y.str - x.str)[0].id;   // default point: strongest unit, assets only if alone
  return { area: a, attacker: g.phasing, attPoint: pick(att), defPoint: pick(def), stage: 'defFire', pendingHits: 0, rolls: [] };
}
export function shooterOf(g: Game, u: Unit): Shooter { return { kind: u.garrison ? 'battle' : 'unit', cls: u.cls, quality: quality(u), dice: u.str, disordered: u.disorder > 0, unsupplied: u.unsupplied }; }
export function fireOdds(g: Game, b: Battle, attackerFires: boolean) {
  const side = attackerFires ? b.attacker : other(b.attacker), target = g.units.find((x) => x.id === (attackerFires ? b.defPoint : b.attPoint))!;
  return fighters(g, b.area, side, attackerFires).map((u) => ({ unit: u, ...successNumber(shooterOf(g, u), { pointCls: target.cls, pointQuality: quality(target), fieldWorks: attackerFires && g.fieldWorks.includes(b.area), riverAssaultMarker: !attackerFires && g.riverAssault.includes(b.area) },
    { attacker: attackerFires, tdn: areas.get(b.area)!.tdn, riverAssault: attackerFires && g.riverAssault.includes(b.area) }) }));
}
function fire(g: Game, b: Battle, attackerFires: boolean) {
  let total = 0;
  for (const o of fireOdds(g, b, attackerFires)) { const dice = Array.from({ length: o.unit.str }, () => roll(g)), hits = dice.filter((d) => succeeds(d, o.sn)).length; total += hits; b.rolls.push({ who: o.unit.name, sn: o.sn, dice, hits }); }
  return total;
}
function stepLoss(g: Game, u: Unit) { u.str -= 1; if (u.str <= 0 || u.garrison) { u.area = null; u.str = 0; say(g, `${u.name} eliminated`); } }
/** 6.43: point unit first (assets may go before it), every unit/asset once before any second loss. */
function allocate(g: Game, b: Battle, side: Side, hits: number, point: string, alreadyHit = new Set<string>()) {
  while (hits > 0) {
    const live = unitsIn(g, b.area, side); if (!live.length) return hits;
    const order = [...live].sort((x, y) => +!x.garrison - +!y.garrison || +(x.id !== point) - +(y.id !== point));
    const u = order.find((x) => !alreadyHit.has(x.id)) ?? order[0];
    alreadyHit.add(u.id); stepLoss(g, u); hits--;
    if (alreadyHit.size >= live.length) alreadyHit.clear();
  }
  return 0;
}
const disorder = (us: Unit[]) => us.forEach((u) => { if (!u.garrison) u.disorder = 1; });

export function defensiveFire(g: Game, b: Battle) {
  const hits = fire(g, b, false); let left = hits;
  say(g, `${areas.get(b.area)!.name}: defensive fire ${hits} hit(s)`);
  if (left > 0) { const pt = g.units.find((x) => x.id === b.attPoint)!; stepLoss(g, pt); left--; }       // 6.41a mandatory loss on the point unit
  b.pendingHits = left;
  b.stage = !unitsIn(g, b.area, b.attacker).length ? (b.result = 'Attacker eliminated', 'done') : left > 0 ? 'attChoice' : 'offFire';
  if (b.stage === 'done') endBattle(g, b);
  return hits;
}
export function attackerChoice(g: Game, b: Battle, abort: boolean) {
  if (abort) { disorder(unitsIn(g, b.area, b.attacker)); b.result = 'Attack aborted, attackers disordered'; b.stage = 'done'; endBattle(g, b); return; }
  allocate(g, b, b.attacker, b.pendingHits, b.attPoint, new Set([b.attPoint])); b.pendingHits = 0;
  if (!fighters(g, b.area, b.attacker, true).length) { b.result = 'Attacker eliminated'; b.stage = 'done'; endBattle(g, b); return; }
  b.stage = 'offFire';
}
export function offensiveFire(g: Game, b: Battle) {
  let left = fire(g, b, true);
  say(g, `${areas.get(b.area)!.name}: offensive fire ${left} hit(s)`);
  if (left && g.fieldWorks.includes(b.area)) { g.fieldWorks = g.fieldWorks.filter((x) => x !== b.area); left--; say(g, 'field works absorb 1 hit'); }
  b.pendingHits = left;
  if (left > 0 && unitsIn(g, b.area, other(b.attacker)).some((u) => !u.garrison)) b.stage = 'defChoice';
  else defenderChoice(g, b, false);
}
export function defenderChoice(g: Game, b: Battle, retreat: boolean) {
  const def = other(b.attacker); let left = b.pendingHits;
  if (retreat) left--;
  const excess = allocate(g, b, def, left, b.defPoint);
  if (retreat) for (const u of unitsIn(g, b.area, def).filter((x) => !x.garrison)) {
    const to = neighbors(b.area).find((n) => g.control[n] === def && !unitsIn(g, n, b.attacker).length && blocks(g, n, def).length < 2);
    if (to == null) { stepLoss(g, u); continue; }
    u.area = to; u.disorder = 1; say(g, `${u.name} retreats to ${areas.get(to)!.name}`);
  }
  b.pendingHits = 0;
  const gone = !unitsIn(g, b.area, def).length;
  b.result = gone ? (retreat ? 'Defender retreated' : 'Defender eliminated') : 'Area remains contested';
  if (gone && !retreat && excess > 0 && !g.riverAssault.includes(b.area)) {           // 6.8 exploitation opportunity
    for (const u of unitsIn(g, b.area, b.attacker).filter((x) => x.cls === 'armor')) {
      const r = roll(g), ok = succeeds(r, moraleSn(quality(u), u.disorder > 0, u.unsupplied));
      say(g, `${u.name} exploitation morale check: rolled ${r} → ${ok ? 'exploitation marker' : 'failed'}`);
    }
  }
  b.stage = 'done'; endBattle(g, b);
}
function endBattle(g: Game, b: Battle) { g.fought.push(b.area); updateControl(g, b.area); for (const n of neighbors(b.area)) updateControl(g, n); say(g, `${areas.get(b.area)!.name}: ${b.result}`); }

/* ---------------- supply (9.3) ---------------- */
function sources(side: Side) { return new Set(Object.values(ENTRY).filter((e) => sideOf(e.side) === side).flatMap((e) => e.nearby_detected)); }
export function inSupply(g: Game, side: Side, start: number) {
  const src = sources(side), enemy = other(side);
  const blocked = (a: number) => !unitsIn(g, a).length && neighbors(a).some((n) => g.control[n] === enemy && unitsIn(g, n, enemy).length && !unitsIn(g, n, side).length);
  const seen = new Set([start]), todo = [start];
  while (todo.length) {
    const a = todo.pop()!;
    if (src.has(a) && g.control[a] === side) return true;
    for (const n of neighbors(a)) {
      if (seen.has(n) || g.control[n] !== side || (blocked(n) && !unitsIn(g, n, side).length)) continue;
      if (g.blown.includes(edgeKey(a, n)) && a !== start) continue;              // 9.31a
      seen.add(n); todo.push(n);
    }
  }
  return false;
}
function supplyPhase(g: Game) {
  for (const a of areas.keys()) updateControl(g, a);
  for (const u of g.units.filter((x) => x.area != null && !x.garrison)) u.unsupplied = !inSupply(g, u.side, u.area!);
  for (const u of g.units.filter((x) => x.area != null && !x.unsupplied && x.disorder)) u.disorder = u.disorder === 2 ? 0 : 2;   // 9.35
  for (const u of g.units.filter((x) => x.area != null && x.side === g.phasing && x.unsupplied && !x.garrison)) {                // 9.4
    const r = roll(g), q = quality(u);
    if (succeeds(r, moraleSn(q, u.disorder > 0, true))) continue;
    if (!u.disorder) { u.disorder = 1; say(g, `${u.name} unsupplied, morale failed (${r}): disordered`); }
    else if ((q === 'veteran' && r === 10) || (q === 'green' && r >= 8)) { u.area = null; say(g, `${u.name} surrenders (${r})`); }
    else { stepLoss(g, u); say(g, `${u.name} unsupplied and disordered, morale failed (${r}): step loss`); }
  }
  g.riverAssault = []; g.fieldWorks = g.fieldWorks.filter((a) => !contested(g, a));
  g.units.filter((u) => u.side === other(g.phasing)).forEach((u) => (u.reserve = false));
}

/* ---------------- turn sequence ---------------- */
export function mustFight(g: Game) { return g.phase === 'combat' ? newlyContested(g).filter((a) => !g.fought.includes(a) && fighters(g, a, g.phasing, true).some((u) => !u.garrison)) : []; }
export function endPhase(g: Game) {
  if (mustFight(g).length) throw new Error('newly contested areas must be fought first');
  if (g.phase === 'movement') { g.phase = 'combat'; g.fought = []; }
  else if (g.phase === 'combat') { g.phase = 'supply'; supplyPhase(g); }
  else {
    if (g.phasing === 'german') g.phasing = 'allied';
    else if (g.turn >= g.lastTurn) { g.over = 'Scenario over (victory check not in the demo yet)'; return; }
    else { g.phasing = 'german'; g.turn++; reinforce(g); }
    g.phase = 'movement'; g.units.forEach((u) => (u.moved = false)); g.contestedAtMoveStart = contestedAreas(g);
  }
  say(g, 'phase start');
}
function reinforce(g: Game) {
  for (const u of g.units.filter((x) => x.arrival === g.turn && x.area == null && x.str > 0)) {
    const opts = (u.entry ?? []).flatMap((l) => ENTRY[l]?.nearby_detected ?? []);
    const to = opts.find((a) => g.control[a] === u.side && blocks(g, a, u.side).length < 2) ?? opts.find((a) => !unitsIn(g, a).length);
    if (to == null) { u.arrival = g.turn + 1; continue; }                          // 4.1c: delayed one turn
    u.area = to; g.control[to] = u.side; say(g, `${u.name} arrives in ${areas.get(to)!.name}`);
  }
}
