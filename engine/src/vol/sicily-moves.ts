// FAB Vol. II, Sicily: army zones and releases (14.3, 14.4, 14.61, 17.23), movement (14.1, 14.24-14.26, 14.29, 15.1, 15.3), arrivals through beachheads and ports (14.24, 14.25), the airborne assault (14.27a) and the At Sea box (14.24b, 14.28).
import { areas as mapAreas, connection, neighbors } from '../map';
import {
  BOX,
  ETNA,
  MESSINA,
  boxByCode,
  isBox,
  isLandingBox,
  isPortBox,
  landingBoxes,
  portBoxes,
  zonesOf,
  type SSide,
  type SBox,
} from '../sicily/map';
import { reachable, allowanceOf, type SMoveCtx } from '../sicily/move';
import {
  blocks,
  chit,
  contested,
  dropReserve,
  eliminate,
  needAdmin,
  other,
  say,
  spendSA,
  unitsIn,
  updateControl,
  type Game,
  type Opt,
  type Side,
  type Unit,
} from '../game';
import { army, avail, gone, nameOf, nation, need, PLANS, regular, relieveFlank, state, unit } from './sicily';

/* ================= zones and releases (14.3, 14.4, 14.61, 17.23) ================= */
/** The army zones a unit may operate in: its landing plan's zones, more once its division is released. Axis units and units with no plan: no restriction. */
export function allowedZones(g: Game, u: Unit): Set<string> | undefined {
  if (u.side !== 'allied') return undefined;
  const V = state(g),
    n = nation(u) as 'us' | 'british';
  if (V.sunrise) return isReleased(g, u) ? new Set(['A', 'B']) : new Set(['B']);
  const plan = PLANS[V.plan ?? 'historical'][n];
  return new Set(isReleased(g, u) ? plan.released_zones : plan.zones);
}
export const isReleased = (g: Game, u: Unit) => {
  const V = state(g);
  return (nation(u) === 'us' && V.usReleased) || (!!u.division && V.released.includes(u.division));
};
/** The zones of an area (Messina is in B and C, 14.41); in Sunrise Bridge the scenario's own zone A and the rest as B. */
export const zonesAt = (g: Game, a: number) => (state(g).sunrise ? [state(g).sunriseZoneA.includes(a) ? 'A' : 'B'] : zonesOf(a));
export const zoneOk = (g: Game, u: Unit, a: number) => {
  const z = allowedZones(g, u);
  return !z || isBox(a) || zonesAt(g, a).some((x) => z.has(x));
};
/** 14.61: release a division (and, for the British, one independent brigade with it) by a Special Action of its own army. */
export function releaseDivision(g: Game, division: string, chitId?: string, brigade?: string) {
  needAdmin(g, 'allied');
  need(
    !['br_1st_cdn_arm', 'br_4th_arm', 'br_231st'].includes(division),
    'a brigade is released only together with a British division (14.61)',
  );
  const V = state(g),
    us = g.units.filter((u) => u.side === 'allied' && u.division === division && regular(u));
  need(us.length, 'no such division');
  need(!isReleased(g, us[0]), `${us[0].name} is already released`);
  const n = nation(us[0]);
  need(n === 'us' || n === 'british', 'an Allied division');
  if (brigade) {
    need(
      n === 'british' && ['br_1st_cdn_arm', 'br_4th_arm', 'br_231st'].includes(brigade) && !V.released.includes(brigade),
      'one of the three independent British brigades, not yet released (14.61)',
    );
  }
  spendSA(g, 'allied', us[0].ech, `release the ${us[0].name} division from its army boundaries (14.61)`, chitId);
  V.released.push(division);
  if (brigade) V.released.push(brigade);
  say(
    g,
    `${us[0].name}${brigade ? ` and the ${g.units.find((u) => u.division === brigade)?.name ?? brigade}` : ''} released: may operate in zones ${[...allowedZones(g, us[0])!].join(', ')}`,
    'allied',
  );
}
/** 17.23 US 7th Army Release: every American division is released. */
export function playArmyRelease(g: Game, chitId: string) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['event_army_release']);
  gone(c);
  state(g).usReleased = true;
  say(g, 'US 7th Army Release: all American divisions may now operate beyond their original zones, never zone B (17.23)', 'allied');
}

/* ================= movement (14.1, 14.24-14.26, 14.29, 14.4, 15.1, 15.3, 16.33, 17.12) ================= */
const interdictedBy = (g: Game, a: number): Side | undefined => {
  const id = g.interdicted[a];
  return id ? chit(g, id).side : undefined;
};
export const etnaFree = (g: Game): SSide | undefined => (contested(g, ETNA) ? undefined : (g.control[ETNA] as SSide | undefined));
function moveCtx(g: Game): SMoveCtx {
  const count = (a: number): Record<SSide, number> => ({ allied: unitsIn(g, a, 'allied').length, axis: unitsIn(g, a, 'axis').length });
  return {
    units: count,
    controller: (a) => g.control[a] as SSide | undefined,
    blownBridges: new Set(g.blown),
    interdicted: (a) => interdictedBy(g, a) as SSide | undefined,
    untriedOnly: (a) => unitsIn(g, a).length > 0 && unitsIn(g, a).every((u) => u.untried),
    etnaFree: etnaFree(g),
    etnaCtl: g.control[ETNA] as SSide | undefined,
    contestedAtStart: new Set(g.contestedAtMoveStart),
    roadblock: (a) => (g.roadblocks[a] ?? unitsIn(g, a).find((u) => u.id.startsWith('DR-'))?.side) as SSide | undefined,
  };
}
export function sicilyReach(g: Game, u: Unit, one: boolean): Opt[] {
  const V = state(g),
    a = u.area!;
  const opt = (r: { area: number; cost: number; path: number[]; mustStop: boolean }): Opt => ({
    area: r.area,
    cost: r.cost,
    fuel: false,
    mustStop: r.mustStop,
    path: r.path,
  });
  if (isLandingBox(a)) {
    // 14.26: a landing takes the whole allowance; never in a Breakthrough phase
    if (one || g.phase !== 'movement') return [];
    const box = BOX.get(a)!;
    return [opt({ area: box.area, cost: allowanceOf(u), path: [a, box.area], mustStop: true })];
  }
  if (isPortBox(a)) {
    // 14.26: ashore in the port, then a normal move
    const box = BOX.get(a)!;
    if (one || unitsIn(g, box.area, other(u.side)).length) return [];
    const from = reachable(
      {
        side: u.side as SSide,
        cls: u.cls,
        area: box.area,
        supplied: true,
        disordered: u.disorder > 0,
        motorized: u.motorized,
        allowed: allowedZones(g, u),
      },
      moveCtx(g),
    );
    return [
      opt({ area: box.area, cost: 0, path: [a, box.area], mustStop: false }),
      ...from.map((r) => opt({ ...r, path: [a, ...r.path] })),
    ];
  }
  const r = reachable(
    {
      side: u.side as SSide,
      cls: u.cls,
      area: a,
      supplied: !u.unsupplied,
      disordered: u.disorder > 0,
      adjacentOnly: one || !!u.adjOnly,
      spent: u.spent,
      motorized: u.motorized,
      untried: u.untried,
      leftContested: g.moving?.id === u.id && g.moving.left,
      allowed: allowedZones(g, u),
      extract: V.extract && nation(u) === 'german' && contested(g, a),
    },
    moveCtx(g),
  );
  return r.map(opt);
}
/** 15.3a: only one untried garrison may act in each Operational Movement Phase. */
export const untriedFree = (g: Game, u: Unit) =>
  !u.untried || g.phase !== 'movement' || !state(g).untriedActed || state(g).untriedActed === u.id;
export function moveOk(g: Game, u: Unit, a: number) {
  return !isBox(a) && untriedFree(g, u);
}
export function afterMove(g: Game, u: Unit, opt: Opt) {
  const V = state(g),
    from = opt.path[0],
    to = opt.area;
  if (u.untried) V.untriedActed = u.id;
  if (u.side === 'axis' && to === MESSINA && !isBox(from)) (V.evacMp ??= {})[u.id] = allowanceOf(u) - opt.cost; // 14.29: what is left to evacuate with
  if (isLandingBox(from) && unitsIn(g, to, 'axis').length && !g.contestedAtMoveStart.includes(to)) V.beachAssault[to] = from; // 14.27b; into a contested area it is ordinary combat (14.26)
  if (V.extract && nation(u) === 'german' && g.contestedAtMoveStart.includes(from)) {
    u.disorder = 2;
    say(g, `${u.name} extracts to ${nameOf(to)} and is recovering (17.12)`);
  }
  if (u.side === 'allied' && V.flank[to]) relieveFlank(g, to);
}
/** 14.24b: the units that could not land this Movement Phase go to the At Sea box. */
export function toSea(g: Game, u: Unit, why: string) {
  const from = u.area;
  u.area = null;
  u.box = 'at_sea';
  u.moved = false;
  dropReserve(g, u);
  if (from != null) updateControl(g, from);
  say(g, `${u.name} goes back to sea (${why})`, u.side);
}
export const inBoxes = (g: Game, side: Side, f: (a: number) => boolean) =>
  g.units.filter((u) => u.side === side && u.area != null && f(u.area));
/** 14.29: an Axis unit in Messina leaves for the mainland, for good (one MP; or its strat-move). */
export function canEvacuate(g: Game, u: Unit) {
  return (
    u.side === 'axis' &&
    u.area === MESSINA &&
    !state(g).sunrise &&
    g.phasing === 'axis' &&
    regular(u) &&
    ((g.phase === 'movement' && !u.untried && (!u.moved || (state(g).evacMp?.[u.id] ?? 0) >= 1)) ||
      (g.phase === 'strategic' && ((!!u.reserve && !u.moved && stratAllowed(g, u)) || (u.moved && state(g).stratUnit === u.id))))
  );
}
export function evacuate(g: Game, unitId: string) {
  const u = unit(g, unitId);
  need(canEvacuate(g, u), 'only an Axis unit in Messina, in its Movement Phase (or a reserve unit by strat-move), may evacuate (14.29)');
  if (g.phase === 'strategic' && !u.moved) afterStrat(g, u);
  u.area = null;
  u.box = 'evacuated';
  u.moved = true;
  dropReserve(g, u);
  updateControl(g, MESSINA);
  say(g, `${u.name} evacuates to the Italian mainland (14.29)`, 'axis');
}
/** 14.8: the Axis strat-moves one unit a turn, the Allies one American and one British; never out of a landing box; not from an interdicted area. */
export function stratAllowed(g: Game, u: Unit) {
  const V = state(g),
    k = army(nation(u));
  if (isLandingBox(u.area!)) return false;
  if (isPortBox(u.area!) && contested(g, BOX.get(u.area!)!.area)) return false; // 14.24c
  if (interdictedBy(g, u.area!) === other(u.side)) return false;
  return (V.strat[k] ?? 0) < 1;
}
export function stratStep(g: Game, u: Unit, a: number, n: number): boolean | 'end' {
  const c = connection(a, n)!;
  if (isBox(n) || c.restricted) return false;
  if (!zoneOk(g, u, n)) return false; // 14.82: only released units cross their army boundaries
  if (interdictedBy(g, n) === other(u.side)) return false; // 16.33
  return true;
}
export function afterStrat(g: Game, u: Unit) {
  const V = state(g),
    k = army(nation(u));
  V.strat[k] = (V.strat[k] ?? 0) + 1;
  V.stratUnit = u.id;
}

/* ================= arrivals (14.24, 14.25), airborne assault (14.27a), the At Sea box (14.24b, 14.28) ================= */
const portOpen = (g: Game, p: SBox, side: Side) =>
  g.control[p.area] === side &&
  !contested(g, p.area) &&
  (p.box === 'P4' || (state(g).portDamage[p.box] ?? 0) === 0) &&
  (!g.inPlay || g.inPlay.includes(p.id));
/** The boxes a unit may arrive in now (14.25). */
export function entryBoxes(g: Game, u: Unit): number[] {
  const V = state(g),
    n = nation(u);
  if (u.side === 'axis') {
    if (u.entry?.some((e) => e.startsWith('#'))) return u.entry.map((e) => +e.slice(1));
    const p = boxByCode('P4');
    return portOpen(g, p, 'axis') ? [p.id] : [];
  }
  const bh = Object.keys(V.beachheads)
    .map(Number)
    .filter((b) => V.beachheads[b] === n);
  const ports = portBoxes.filter((p) => p.nation === n && portOpen(g, p, 'allied')).map((p) => p.id);
  return [...bh, ...ports];
}
export function syncPortBoxes(g: Game) {
  for (const p of portBoxes) {
    const c = g.control[p.area];
    if (c) g.control[p.id] = c;
    else delete g.control[p.id];
  }
}
/** 16.21: the fleet withdraws one Naval Support asset from the Used Box, after the unused reusable Special Action had its chance to save it (Example 2A). */
export function beforeRecycle(g: Game, side: Side) {
  if (side === 'allied' && g.phase === 'reinforcement') {
    const nav = g.chits.find((c) => c.kind === 'naval_support' && c.box === 'used');
    if (nav) {
      nav.box = 'eliminated';
      say(g, `${nav.name} withdraws: eliminated from the Used Box (16.21)`, side);
    }
  }
  return false;
}
export function reinforce(g: Game, side: Side) {
  const V = state(g);
  syncPortBoxes(g);
  V.strat = {};
  for (const u of g.units.filter((x) => x.side === side && x.box === 'at_sea')) {
    u.box = undefined;
    u.arrival = g.turn;
    say(g, `${u.name} tries to land again (14.24b)`, side);
  }
  for (const u of g.units.filter((x) => x.side === side && x.arrival === g.turn && x.area == null && x.str > 0 && !x.box)) {
    if (u.symbol === 'airborne') {
      u.box = 'airborne_assault';
      u.arrival = undefined;
      g.arrived.push(u.id);
      say(g, `${u.name} waits in the Airborne Assault box (14.24)`, side);
      continue;
    }
    u.entry = entryBoxes(g, u).map((b) => `#${b}`);
  }
}
/** 14.27a: where an airborne unit may drop: an area adjacent to at least two areas holding units of its army, with room. */
export function airDropTargets(g: Game, unitId: string): number[] {
  const u = unit(g, unitId);
  if (u.box !== 'airborne_assault' || g.phase !== 'combat' || g.phasing !== 'allied') return [];
  const n = nation(u),
    mine = (a: number) => unitsIn(g, a, 'allied').some((x) => nation(x) === n && regular(x));
  return [...mapAreas.keys()].filter(
    (a) =>
      !isBox(a) &&
      (!g.inPlay || g.inPlay.includes(a)) &&
      neighbors(a).filter((x) => !isBox(x) && mine(x)).length >= 2 &&
      blocks(g, a, 'allied').length < 2,
  );
}
export function airDrop(g: Game, unitId: string, a: number | null) {
  const u = unit(g, unitId),
    V = state(g),
    t = airDropTargets(g, unitId);
  need(
    u.box === 'airborne_assault' && g.phase === 'combat' && g.phasing === 'allied' && !g.fought.length && !g.battle,
    'airborne units drop at the start of the Allied Combat Phase (14.27a)',
  );
  if (a == null || !t.length) {
    need(!t.length, 'that unit can drop somewhere');
    u.box = undefined;
    eliminate(g, u);
    say(g, `${u.name} has no drop zone and is eliminated (14.27a)`, 'allied');
  } else {
    need(t.includes(a), 'not a legal drop zone');
    u.box = undefined;
    u.area = a;
    u.moved = true;
    if (unitsIn(g, a, 'axis').length) {
      if (!g.riverAssault.includes(a)) g.riverAssault.push(a);
      V.airborneAreas.push(a);
    }
    updateControl(g, a);
    if (V.flank[a]) relieveFlank(g, a);
    say(g, `${u.name} drops into ${nameOf(a)} (14.27a)`, 'allied');
  }
  V.dropPending = g.units.some((x) => x.box === 'airborne_assault' && x.side === 'allied');
}
/** The drops done at once: each unit to its first drop zone, or lost. */
export function autoAirDrop(g: Game) {
  for (const u of g.units.filter((x) => x.box === 'airborne_assault' && x.side === 'allied')) {
    const t = airDropTargets(g, u.id);
    airDrop(g, u.id, t[0] ?? null);
  }
}
/** 14.28: an Allied unit in a coastal area connected to a live beachhead may retreat to sea when nothing else is open. */
export const seaRetreat = (g: Game, u: Unit, from: number) =>
  u.side === 'allied' && !isBox(from) && landingBoxes.some((b) => b.area === from && state(g).beachheads[b.id] != null);
