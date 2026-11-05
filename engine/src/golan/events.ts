// FAB: Golan '73 Admin-phase play and the rest of the player options: engineering (4.31–4.35, 14.51a, 14.52), air missions
// (16.31b/c), commando raid placement (16.11a), events (17.1–17.3, 4.21 alternate use), Special Action uses (8.21, 8.25–8.27,
// 14.61), staff functions (8.3), reserve markers and field works by units (5.21, 5.23, 14.7), the 4.1a asset recovery and the
// alternate set-up placement (22.24/22.25). Each function checks the rule's conditions and throws a plain-language error.
import { ASSEMBLY, ENTRY, HERMON, area, connection, eastOfSam, edgeKey, enemyOf, isAssembly, neighbors, type GSide } from './map';
import { onReconFlies } from './battle';
import { chit, contested, count, dropReserve, inSupply, isNight, onMap, roll, spendSA, unit, updateControl, type GChit, type GGame, type GUnit } from './game';

const log = (g: GGame, text: string) => g.log.push({ turn: g.turn, side: g.player, phase: g.phase, text });
const need = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };
const inAdmin = (g: GGame) => need(g.phase === 'admin', 'only in the Admin Phase');
const avail = (g: GGame, id: string, kinds: string[]) => { const c = chit(g, id); need(c.box === 'available' && kinds.includes(c.kind), `${c.name} is not available for this`); return c; };
const sideOf = (c: GChit) => c.side as GSide;
/** Supplied, friendly-controlled and uncontested: the usual condition for an Admin-phase function. */
const homeArea = (g: GGame, side: GSide, a: number) => !isAssembly(a) && g.control[a] === side && !contested(g, a) && inSupply(g, side, a);
const vacant = (g: GGame, a: number) => count(g, a).israeli + count(g, a).syrian === 0 && !g.chits.some((c) => c.stand && c.box === 'map' && c.area === a);
const used = (c: GChit) => { c.box = 'used'; c.area = undefined; };
const gone = (c: GChit) => { c.box = 'eliminated'; c.area = undefined; };
const reduced = (u: GUnit) => u.box === 'map' && !u.kind && u.str < u.max;
const ARMOR_CLASS = (u: GUnit) => u.cls === 'armor';

/* ---------- engineering (4.3, 14.5) ---------- */
/** 4.31: up to two bridges (river edges a road crosses) next to one supplied, friendly, uncontested area. */
export function blowBridges(g: GGame, chitId: string, from: number, to: number[]) {
  inAdmin(g); const c = avail(g, chitId, ['engineer']), side = sideOf(c);
  need(homeArea(g, side, from), 'the engineer works from a supplied, friendly-controlled, uncontested area');
  need(to.length >= 1 && to.length <= 2, 'one or two bridges');
  for (const n of to) { const e = connection(from, n); need(e?.river && e.kind === 'road' && !g.blownBridges.includes(edgeKey(from, n)), `no bridge between ${from} and ${n}`); }
  for (const n of to) g.blownBridges.push(edgeKey(from, n));
  used(c); log(g, `Bridge(s) blown at ${to.map((n) => edgeKey(from, n)).join(', ')} (4.31).`);
}
/** 4.32: repair a blown bridge; both areas friendly, or one friendly and the other enemy-held but contested. */
export function repairBridge(g: GGame, chitId: string, from: number, to: number) {
  inAdmin(g); const c = avail(g, chitId, ['engineer']), side = sideOf(c), key = edgeKey(from, to);
  need(g.blownBridges.includes(key), 'that bridge is not blown');
  need(homeArea(g, side, from) && (g.control[to] === side || contested(g, to)), 'repair from a supplied, friendly, uncontested area towards a friendly or contested one');
  g.blownBridges = g.blownBridges.filter((x) => x !== key); used(c); log(g, `Bridge ${key} repaired (4.32).`);
}
/** 4.33: field works where a friendly unit stands (never with a strongpoint, 15.6). */
export function engineerFieldWorks(g: GGame, chitId: string, a: number) {
  inAdmin(g); const c = avail(g, chitId, ['engineer']), side = sideOf(c);
  need(homeArea(g, side, a) && count(g, a)[side] > 0, 'a supplied, friendly, uncontested area with a friendly unit');
  need(!g.fieldWorks.includes(a) && !onMap(g, a).some((u) => u.kind === 'strongpoint'), 'no field works there (one per area, never with a strongpoint)');
  g.fieldWorks.push(a); used(c); log(g, `Field works built in ${a} (4.33).`);
}
/** 4.34 roadblock marker / 4.35 the engineer itself as a defended roadblock: a supplied, friendly, vacant area of TDN 1 or more. */
export function roadblock(g: GGame, chitId: string, a: number, defended = false) {
  inAdmin(g); const c = avail(g, chitId, ['engineer']), side = sideOf(c);
  need(homeArea(g, side, a) && vacant(g, a) && area(a).tdn >= 1, 'a supplied, friendly-controlled, vacant area with a TDN of 1 or more');
  if (defended) { c.box = 'map'; c.area = a; c.stand = true; } else { g.roadblocks[a] = side; used(c); }
  log(g, `${defended ? 'Defended roadblock' : 'Roadblock'} in ${a} (${defended ? '4.35' : '4.34'}).`);
}
/** 14.51a: bridge an AT ditch boundary (up to eight markers). */
export function bridgeDitch(g: GGame, chitId: string, from: number, to: number) {
  inAdmin(g); const c = avail(g, chitId, ['engineer']), side = sideOf(c), key = edgeKey(from, to);
  need(connection(from, to)?.atDitch && !g.bridgedDitch.includes(key), 'no unbridged AT ditch there');
  need(g.bridgedDitch.length < 8, 'all eight AT Ditch Bridged markers are in use');
  need(homeArea(g, side, from) && (g.control[to] === side || (contested(g, to) && g.control[to] === enemyOf(side))), 'bridge from a supplied, friendly, uncontested area towards a friendly one or a contested enemy one');
  g.bridgedDitch.push(key); used(c); log(g, `AT ditch ${key} bridged (14.51a).`);
}
/** 14.52 (Syrian only): lift a minefield next to a supplied, friendly, uncontested area. */
export function removeMinefield(g: GGame, chitId: string, from: number, to: number) {
  inAdmin(g); const c = avail(g, chitId, ['engineer']), key = edgeKey(from, to);
  need(c.side === 'syrian', 'only Syrian engineers clear minefields');
  need(g.minefields.includes(key) && homeArea(g, 'syrian', from), 'a mined boundary next to a supplied, friendly, uncontested area');
  g.minefields = g.minefields.filter((x) => x !== key); used(c); log(g, `Minefield ${key} cleared (14.52).`);
}

/* ---------- air missions in the Admin Phase (16.31b/c) and commando raids (16.11a) ---------- */
const airOk = (g: GGame, c: GChit, a: number) => { need(!isNight(g), 'no air missions on the night turn (14.03)'); need(!isAssembly(a), 'not over an Assembly area'); void c; };
export function airInterdiction(g: GGame, chitId: string, a: number) {
  inAdmin(g); const c = avail(g, chitId, ['air_mission']), side = sideOf(c); airOk(g, c, a);
  c.box = 'map'; c.area = a; c.mission = 'interdiction'; g.interdicted[a] = side;
  if (side === 'israeli' && eastOfSam(a)) g.samTarget = c.id;
  log(g, `Air interdiction over ${a} (16.31b).`);
}
export function airRecon(g: GGame, chitId: string, a: number) {
  inAdmin(g); const c = avail(g, chitId, ['air_mission']), side = sideOf(c); airOk(g, c, a);
  need(count(g, a)[enemyOf(side)] > 0, 'reconnaissance over an enemy-occupied area');
  c.box = 'map'; c.area = a; c.mission = 'recon';
  if (side === 'israeli' && eastOfSam(a) && g.chits.some((x) => x.kind === 'sam' && x.box === 'available')) { g.samTarget = c.id; log(g, `Air reconnaissance over ${a}: Syria may answer with a SAM (16.31c).`); return; }
  finishRecon(g, c);
}
/** The reconnaissance flies (not cancelled by a SAM): the enemy blocks in the area are shown for the rest of the phase. */
export function finishRecon(g: GGame, c: GChit) {
  const side = sideOf(c), a = c.area!;
  g.intel = { side, units: onMap(g, a).filter((u) => u.side !== side).map((u) => u.id) };
  c.mission = undefined; used(c); log(g, `Reconnaissance reveals the enemy in ${a}.`);
}
onReconFlies(finishRecon);
/** 16.11a: a commando from the Available Box onto a vacant Israeli-controlled area next to a Syrian-occupied one. */
export function placeRaid(g: GGame, chitId: string, a: number) {
  inAdmin(g); const c = avail(g, chitId, ['commando']);
  need(!isAssembly(a) && g.control[a] === 'israeli' && vacant(g, a) && neighbors(a).some((n) => count(g, n).syrian > 0), 'a vacant Israeli-controlled area next to a Syrian-occupied area');
  c.box = 'map'; c.area = a; c.stand = true; c.raid = 'pending'; g.raids.push(a);
  log(g, `Commandos land in ${area(a).name} (16.11a).`);
}

/* ---------- events (17.x) ---------- */
const STRATEGIC: Record<string, string> = { Assad: 'S21', '141st': 'S22', '62nd': 'S23' };
/** 17.11: the named Strategic Reserve unit is released; place it with placeArrival. */
export function playRelease(g: GGame, chitId: string) {
  inAdmin(g); const c = avail(g, chitId, ['event_release']);
  const id = Object.entries(STRATEGIC).find(([k]) => c.name.startsWith(k))?.[1]; need(id, 'unknown release');
  const u = unit(g, id!); need(u.box === 'strategic_reserve', `${u.name} is already in play`);
  u.box = 'arriving'; gone(c); log(g, `${u.name} released from the Strategic Reserve (17.11).`);
}
/** 17.12 SSM attack: each Israeli air asset in the Available Box goes back to the cup on 1–2. */
export function playSSM(g: GGame, chitId: string) {
  inAdmin(g); const c = avail(g, chitId, ['event_ssm_strike']); gone(c);
  for (const air of g.chits.filter((x) => x.kind === 'air_mission' && x.side === 'israeli' && x.box === 'available')) {
    const die = roll(g); if (die <= 2) air.box = 'cup'; log(g, `SSM strike: ${die}${die <= 2 ? ', an air asset goes back to the cup' : ', no effect'}.`);
  }
}
/** 17.21: two steps to the named brigade: +2 to one unit, +1 to each, or one eliminated unit back at 2 steps in an Assembly area. */
export function playArrivingBattalion(g: GGame, chitId: string, choice: { add: string } | { split: [string, string] } | { rebuild: string; assembly: 'A' | 'B' }) {
  inAdmin(g); const c = avail(g, chitId, ['event_arriving_battalion']);
  const mine = (id: string) => { const u = unit(g, id); need(u.side === 'israeli' && !!c.brigade && u.brigade === c.brigade, `${u.name} is not of the ${c.brigade} brigade`); return u; };
  if ('add' in choice) { const u = mine(choice.add); need(u.box === 'map' && inSupply(g, 'israeli', u.area!) && u.str + 2 <= u.max, 'a supplied unit with room for two steps'); u.str += 2; }
  else if ('split' in choice) for (const id of choice.split) { const u = mine(id); need(u.box === 'map' && inSupply(g, 'israeli', u.area!) && u.str < u.max, 'supplied, reduced units'); u.str += 1; }
  else {
    const u = mine(choice.rebuild); need(u.box === 'eliminated', 'only an eliminated unit comes back');
    Object.assign(u, { box: 'map', area: choice.assembly === 'B' ? ASSEMBLY.B : ASSEMBLY.A, str: Math.min(2, u.max), disorder: 0, unsupplied: false });
    if (u.max >= 3) g.eliminatedLarge.israeli = Math.max(0, g.eliminatedLarge.israeli - 1);              // 19.2: off the Eliminated Large Units track
  }
  gone(c); log(g, `${c.name} arrives (17.21).`);
}
/** 17.23 Lt. Zvika Greengold: an elite armor defended roadblock in an unoccupied friendly-controlled area, staying until destroyed. */
export function playLtZvika(g: GGame, chitId: string, a: number) {
  inAdmin(g); const c = avail(g, chitId, ['event_lt_zvika']);
  need(!isAssembly(a) && g.control[a] === 'israeli' && vacant(g, a), 'an unoccupied Israeli-controlled area');
  Object.assign(c, { box: 'map', area: a, stand: true, quality: 'elite' }); log(g, `Lt. Zvika takes position in ${area(a).name} (17.23).`);
}
/** 17.24 King Hassan's Troublemakers: the Moroccans fire only in defence and never enter enemy-controlled areas, for the rest of the game. */
export function playKingHassan(g: GGame, chitId: string) {
  inAdmin(g); const c = avail(g, chitId, ['event_king_hassan']); gone(c); g.kingHassan = true; log(g, "King Hassan's Troublemakers: the Moroccan brigade holds back (17.24).");
}
/** 17.31/17.32 replacements: one step to a supplied reduced unit, even in a contested area; elite steps allowed. */
export function playReplacement(g: GGame, chitId: string, unitId: string) {
  inAdmin(g); const c = avail(g, chitId, ['replacement_arm', 'replacement_mech']), u = unit(g, unitId);
  need(u.side === c.side && reduced(u) && inSupply(g, u.side, u.area!), 'a supplied, reduced unit of your own');
  need(c.kind === 'replacement_arm' ? ARMOR_CLASS(u) : u.symbol === 'mech' || u.cls === 'infantry', c.kind === 'replacement_arm' ? 'armor replacements go to armor-class units' : 'mechanized replacements go to mech or infantry-class units');
  u.str += 1; gone(c); log(g, `${u.name} gets a replacement step (17.3).`);
}
/** 4.21: any event may instead bring two assets back from the Eliminated Box to the cup (not commandos, SAMs, air support, garrisons). */
export function alternateEventUse(g: GGame, chitId: string, assetIds: string[]) {
  const c = chit(g, chitId);
  need(c.box === 'available' && c.kind.startsWith('event') || c.kind === 'special_action_event', 'play an event from the Available Box');
  need(assetIds.length <= 2, 'two assets at most');
  for (const id of assetIds) { const a = chit(g, id); need(a.side === c.side && a.box === 'eliminated' && !['commando', 'sam', 'air_mission', 'garrison'].includes(a.kind) && !a.kind.startsWith('event') && a.kind !== 'special_action_event', `${a.name} cannot come back this way (17.4)`); }
  for (const id of assetIds) chit(g, id).box = 'cup';
  gone(c); log(g, `${c.name} used to bring back ${assetIds.length} asset(s) (4.21).`);
}

/* ---------- Special Action uses (8.2, 14.61) ---------- */
/** 8.21: a supplied armor-class unit in good order that has not moved may move one area in the Breakthrough Movement Phase. */
export function activateBreakthrough(g: GGame, unitId: string, chitId?: string) {
  need(g.phase === 'btMove', 'only in the Breakthrough Movement Phase');
  const u = unit(g, unitId); need(u.side === g.player && u.box === 'map' && ARMOR_CLASS(u) && !u.kind && u.disorder === 0 && !u.unsupplied && !u.movedThisPhase, 'a supplied armor-class unit in good order that has not moved');
  spendSA(g, u.side, `breakthrough move for ${u.name} (8.21)`, chitId); u.saMove = true;
}
/** 8.25: all friendly units in a supplied area and the areas next to it recover fully. */
export function rally(g: GGame, side: GSide, a: number, chitId?: string) {
  inAdmin(g); need(inSupply(g, side, a), 'rally in a supplied area');
  spendSA(g, side, `rally around ${a} (8.25)`, chitId);
  for (const n of [a, ...neighbors(a)]) for (const u of onMap(g, n)) if (u.side === side) u.disorder = 0;
}
/** 8.26: one step (even elite) to a supplied reduced unit. */
export function qualityReplacement(g: GGame, unitId: string, chitId?: string) {
  inAdmin(g); const u = unit(g, unitId); need(reduced(u) && inSupply(g, u.side, u.area!), 'a supplied, reduced unit');
  spendSA(g, u.side, `quality replacement for ${u.name} (8.26)`, chitId); u.str += 1;
}
/** 8.27: in the Reinforcement Phase, a reinforcing unit may enter at any appropriate entry area. */
export const rerouteOptions = (g: GGame, unitId: string) => {
  const u = unit(g, unitId); if (u.box !== 'arriving' || g.phase !== 'reinforcement') return [];
  return (u.side === 'israeli' ? [ASSEMBLY.A, ASSEMBLY.B] : Object.values(ENTRY)).filter((a) => isAssembly(a) || ((g.control[a] === u.side || count(g, a)[enemyOf(u.side)] === 0) && count(g, a)[u.side] < 2));
};
export function reroute(g: GGame, unitId: string, a: number, chitId?: string) {
  need(rerouteOptions(g, unitId).includes(a), 'not an entry area this unit can be rerouted to');
  const u = unit(g, unitId); spendSA(g, u.side, `reroute ${u.name} (8.27)`, chitId);
  u.box = 'map'; u.area = a; updateControl(g, a); log(g, `${u.name} rerouted to ${isAssembly(a) ? (a === ASSEMBLY.A ? 'Assembly Area A' : 'Assembly Area B') : a}.`);
}
/** 14.61a (Israeli): fold one unit into another with the same symbol, same or adjacent uncontested friendly areas, both in good order. */
export function mergeUnits(g: GGame, fromId: string, intoId: string, chitId?: string) {
  inAdmin(g); const a = unit(g, fromId), b = unit(g, intoId);
  need(a.side === 'israeli' && b.side === 'israeli' && a.id !== b.id && !a.kind && !b.kind && a.symbol === b.symbol, 'two Israeli units with the same unit symbol');
  need(a.box === 'map' && b.box === 'map' && (a.area === b.area || neighbors(a.area!).includes(b.area!)), 'in the same or adjacent areas');
  need([a.area!, b.area!].every((x) => isAssembly(x) || (g.control[x] === 'israeli' && !contested(g, x))) && a.disorder === 0 && b.disorder === 0, 'uncontested friendly areas, units in good order');
  spendSA(g, 'israeli', `merge ${a.name} into ${b.name} (14.61a)`, chitId);
  b.str = Math.min(b.max, b.str + a.str); a.box = 'eliminated'; a.area = null;                          // no VP for Syria (19.2)
}
/** 14.61b (Syrian, from turn 3): release the next 3rd Tank Division unit (15th, 81st, 65th). */
export function releaseOperationalReserve(g: GGame, chitId?: string) {
  inAdmin(g); need(g.turn >= 3, 'from turn 3');
  const next = ['S18', 'S19', 'S20'].map((id) => unit(g, id)).find((u) => u.box === 'operational_reserve'); need(next, 'the Operational Reserve is empty');
  spendSA(g, 'syrian', `release ${next!.name} (14.61b)`, chitId); next!.box = 'arriving';
}
/** 14.61c / 14.61d: a SAM (Syria) or an air support asset (Israel) from the Eliminated Box back into the cup. */
export function replaceAsset(g: GGame, side: GSide, assetId: string, chitId?: string) {
  inAdmin(g); const a = chit(g, assetId);
  need(a.side === side && a.box === 'eliminated' && a.kind === (side === 'syrian' ? 'sam' : 'air_mission'), side === 'syrian' ? 'an eliminated SAM asset' : 'an eliminated air support asset');
  spendSA(g, side, `${a.name} replaced (14.61${side === 'syrian' ? 'c' : 'd'})`, chitId); a.box = 'cup';
}

/* ---------- staff functions (8.3) ---------- */
const staff = (g: GGame, chitId: string) => { inAdmin(g); const c = avail(g, chitId, ['command_staff']); return c; };
/** 8.31: one non-elite step to a supplied infantry-class unit. */
export function staffReplacement(g: GGame, chitId: string, unitId: string) {
  const c = staff(g, chitId), u = unit(g, unitId);
  need(u.side === c.side && reduced(u) && u.cls === 'infantry' && inSupply(g, u.side, u.area!), 'a supplied, reduced infantry-class unit');
  need(u.q[u.str] !== 'elite', 'the next step would be elite: staff replacements are non-elite');
  u.str += 1; used(c); log(g, `${u.name} gets a replacement step (8.31).`);
}
/** 8.32: one enemy unit anywhere is shown until the end of the Admin Phase. */
export function staffIntel(g: GGame, chitId: string, unitId: string) {
  const c = staff(g, chitId), u = unit(g, unitId); need(u.side !== c.side && u.box === 'map', 'an enemy unit on the map');
  g.intel = { side: sideOf(c), units: [u.id] }; used(c); log(g, 'Intelligence gathering (8.32).');
}
/** 8.33: a reserve marker on an eligible unit. */
export function staffReserve(g: GGame, chitId: string, unitId: string) {
  const c = staff(g, chitId), u = unit(g, unitId); need(u.side === c.side && reserveEligible(g, u), 'an eligible unit (supplied, good order, uncontested)');
  need(g.reserveMarkers[u.side] > 0, 'no reserve marker left'); u.reserve = true; g.reserveMarkers[u.side]--; used(c);
}

/* ---------- reserve markers and field works by units (5.21, 5.23, 14.7) ---------- */
export const reserveEligible = (g: GGame, u: GUnit) => u.box === 'map' && !u.kind && !u.reserve && u.disorder === 0 && !u.unsupplied && (isAssembly(u.area!) || !contested(g, u.area!));
/** 5.21: in the Operational Movement Phase (or while deploying the alternate set-up), mark an eligible unit in reserve, or take the marker back. */
export function setReserve(g: GGame, unitId: string, on: boolean) {
  const u = unit(g, unitId);
  need((g.phase === 'movement' && u.side === g.player && !u.movedThisPhase) || (g.phase === 'deploy' && u.side === 'syrian'), 'reserve markers are placed in your Operational Movement Phase');
  if (!on) { dropReserve(g, u); return; }
  need(reserveEligible(g, u), 'only supplied units in good order in uncontested areas (14.7)');
  need(g.reserveMarkers[u.side] > 0, 'no reserve marker left'); u.reserve = true; g.reserveMarkers[u.side]--;
}
/** 5.23: a supplied unit in good order spends its whole move building field works in its uncontested area (not with a strongpoint). */
export function unitFieldWorks(g: GGame, unitId: string) {
  const u = unit(g, unitId);
  need(['movement', 'reaction', 'btMove'].includes(g.phase) && !u.movedThisPhase && !u.kind && u.disorder === 0 && !u.unsupplied, 'a supplied unit in good order that has not moved');
  need(u.box === 'map' && !isAssembly(u.area!) && !contested(g, u.area!) && !g.fieldWorks.includes(u.area!) && !onMap(g, u.area!).some((x) => x.kind === 'strongpoint'), 'an uncontested area without field works or a strongpoint');
  g.fieldWorks.push(u.area!); u.movedThisPhase = true; dropReserve(g, u); log(g, `${u.name} digs in at ${u.area} (5.23).`);
}

/* ---------- 4.1a: the reusable Special Action was not used last turn: bring one used asset back to the Available Box ---------- */
export function recoverAsset(g: GGame, side: GSide, chitId: string) {
  need(g.phase === 'reinforcement' && (g.recoverable[side] ?? []).includes(chitId), 'not an asset you can recover now');
  chit(g, chitId).box = 'available'; g.recoverable[side] = []; log(g, `${chit(g, chitId).name} goes straight back to the Available Box (4.1a).`);
}

/* ---------- alternate set-up placement (22.24, 22.25) ---------- */
export function deployOptions(g: GGame, unitId: string): number[] {
  const u = unit(g, unitId); if (g.phase !== 'deploy' || u.box !== 'deploy') return [];
  if (u.side === 'israeli') return [...Array(84).keys()].filter((a) => a > 0 && a !== HERMON && !area(a).syria && count(g, a).israeli < 2 && !onMap(g, a).some((x) => x.kind));
  return [...Array(84).keys()].filter((a) => a > 0 && area(a).altSetup === u.division && count(g, a).syrian === 0);   // one unit per tank symbol of its division colour
}
export function deploy(g: GGame, unitId: string, a: number) {
  need(deployOptions(g, unitId).includes(a), 'not a set-up area for this unit');
  const u = unit(g, unitId); u.box = 'map'; u.area = a; updateControl(g, a);
}
/** The Israeli player places strongpoints and ghosts at will, one per Purple Line area (15.7, errata): swap two of them. */
export function swapStrongpoints(g: GGame, a: string, b: string) {
  need(g.turn === 1 && (g.phase === 'deploy' || (g.scenario === 'badr' && g.fought.length === 0 && !g.battle)), 'only while setting up');
  const x = unit(g, a), y = unit(g, b); need(!!x.kind && !!y.kind && x.box === 'map' && y.box === 'map', 'two placed strongpoints or ghosts');
  [x.area, y.area] = [y.area, x.area];
}
