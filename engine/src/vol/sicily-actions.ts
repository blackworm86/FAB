// FAB Vol. II, Sicily: the player actions that exist only in this volume. Air support in the Admin and Supply Phases (16.3x), ports (14.51), the Axis staff (14.63), the events (17.x: Patton, Tactical Extract, Fading Morale, the flanking invasion), reserves (14.7).
import { BOX, boxByCode, isBox, isLandingBox, within, area as sarea } from '../sicily/map';
import { isArty, isBattleAsset, type Chit } from '../chits';
import { buildFieldWorks, chit, contested, needAdmin, say, saAvailable, supplied, unitsIn, type Game, type Side, type Unit } from '../game';
import { untriedFree } from './sicily-moves';
import { avail, gone, nameOf, nation, need, regular, state, unit, used } from './sicily';

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
export function saFilter(g: Game, _side: Side, list: Chit[], ech?: string) {
  if (!state(g).patton) return list;
  const usEv = list.filter((c) => c.kind === 'special_action_event' && c.nation === 'us');
  if (usEv.length >= 2 || !usEv.length) return list;
  void ech;
  return list.filter((c) => !usEv.includes(c));
}
export function onSpendSA(g: Game, _side: Side, c: Chit) {
  if (!state(g).patton || c.kind !== 'special_action_event' || c.nation !== 'us') return;
  const second = g.chits.find((x) => x.kind === 'special_action_event' && x.nation === 'us' && x.box === 'available');
  if (second) {
    gone(second);
    say(g, `Patton Soldier Slap: a second US Special Action event is spent (17.11)`, 'allied');
  }
}
/* ---------- reserves (14.7) ---------- */
export const markerKey = (_g: Game, u: Unit) => (u.side === 'axis' ? 'res' : nation(u) === 'british' ? 'br' : 'us');
export const reserveOk = (g: Game, u: Unit) => !isLandingBox(u.area!) && untriedFree(g, u);
/** 15.3a: a reserve marker on an untried unit is its one action this phase (called when the marker goes on). */
export const onReserve = (g: Game, u: Unit) => {
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
