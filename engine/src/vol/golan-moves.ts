// FAB Vol. III, Golan '73: movement (14.x, through ../golan/move.ts), what a move triggers (the Purple Line and the releases 15.2, 15.4, commando raids, the optional withdrawal 18.2), strongpoints swapped into an attack or evacuated (15.6), strategic movement.
import { areas, connection, edgeKey } from '../map';
import { ENTRY, boxSide, eastOfSam, isAssembly, area as garea, type GSide } from '../golan/map';
import { reachable, type GMoveCtx, type GMoveUnit } from '../golan/move';
import { isBattleAsset, type Chit } from '../chits';
import {
  chit,
  contested,
  eliminate,
  moraleCheck,
  move as seriesMove,
  moveOptions,
  other,
  rollDie,
  say,
  unitsIn,
  type Battle,
  type Game,
  type Opt,
  type Side,
  type Unit,
} from '../game';
import {
  battleState,
  ghostReach,
  ghostRoom,
  ghostsMet,
  golanMoraleSn,
  isNafakh,
  isNight,
  limits,
  nameOf,
  need,
  raidUnitAt,
  regular,
  state,
  T62,
  unit,
} from './golan';

/* ================= movement (14.x), through ../golan/move.ts ================= */
export const interdictedBy = (g: Game, a: number): Side | undefined => {
  const id = g.interdicted[a];
  return id ? chit(g, id).side : undefined;
};
function moveCtx(g: Game): GMoveCtx {
  const V = state(g),
    count = (a: number, f: (u: Unit) => boolean): Record<GSide, number> => ({
      israeli: unitsIn(g, a, 'israeli').filter(f).length,
      syrian: unitsIn(g, a, 'syrian').filter(f).length,
    });
  return {
    turn: g.turn,
    night: isNight(g),
    units: (a) => (isAssembly(a) ? { israeli: 0, syrian: 0 } : count(a, (u) => !u.garrison)),
    assets: (a) => count(a, (u) => !!u.garrison),
    controller: (a) => (isAssembly(a) ? boxSide(a) : g.control[a]) as GSide | undefined,
    bridgedDitch: new Set(V.bridgedDitch),
    blownBridges: new Set(g.blown),
    minefields: new Set(V.minefields),
    crossedThisPhase: new Set(V.crossed),
    interdicted: (a) => interdictedBy(g, a) as GSide | undefined,
    raids: new Set(V.raids),
    roadblocks: new Map(Object.entries(g.roadblocks).map(([a, s]) => [+a, s as GSide])),
  };
}
export const asMover = (g: Game, u: Unit, one: boolean): GMoveUnit => ({
  areasMoved: g.moving?.id === u.id ? g.moving.steps : 0,
  slowField: !!g.opts.t62 && T62.has(u.id),
  side: u.side as GSide,
  cls: u.cls,
  area: u.area!,
  supplied: !u.unsupplied,
  disordered: u.disorder > 0,
  adjacentOnly: one || !!u.adjOnly,
  spent: u.spent,
  minefieldFailed: state(g).minefieldFailed.includes(u.id),
});
export function golanReach(g: Game, u: Unit, one: boolean): Opt[] {
  if (isNafakh(g) && u.id === 'S03' && !state(g).nafakh?.s03Free) return []; // 22.46: the 33rd holds Tel Fazra
  const ctx = { ...moveCtx(g), room: g.opts.advGhosts ? (a: number) => ghostRoom(g, u, a) : undefined };
  let r = u.ghost ? ghostReach(g, u, one, ctx) : reachable(asMover(g, u, one), ctx);
  if (state(g).kingHassan && u.id === 'S07') r = r.filter((x) => x.path.slice(1).every((a) => isAssembly(a) || g.control[a] !== 'israeli')); // 17.24: the Moroccans keep out of Israeli-controlled areas
  return r.map((x) => ({
    area: x.area,
    cost: x.cost,
    fuel: false,
    mustStop: x.mustStop,
    path: x.path,
    triggers: x.triggers,
    limited: x.limited,
  }));
}
/** 14.02: crossing a minefield from the starting area costs +1 MP and a morale check; failing, the unit stays (having spent that 1 MP), may not try another minefield this turn, and may move on into a non-mined area. */
export function beforeMove(g: Game, u: Unit, opt: Opt) {
  need(!state(g).release, 'Syria first places the units released at the Purple Line (15.2)');
  const w = withdrawal(g, u, opt);
  if (w) return w;
  if (u.side !== 'syrian') return;
  const key = edgeKey(opt.path[0], opt.path[1]);
  if (!state(g).minefields.includes(key)) return;
  const sn = golanMoraleSn(g, u, 'check'),
    { r, ok } = moraleCheck(g, u, sn, 'Minefield (14.02)');
  if (ok) {
    say(g, `${u.name} crosses the minefield (${r} vs ${sn})`);
    return;
  }
  state(g).minefieldFailed.push(u.id);
  u.spent = (u.spent ?? 0) + 1; // only the attempt's extra MP: it never crossed, and may go on into a non-mined area
  say(g, `${u.name} fails the minefield check (${r} vs ${sn}) and stays in ${areas.get(opt.path[0])!.name}`);
  return 'minefield';
}
/** 18.2 (optional) Withdrawal: the last unit to leave a contested area in the Movement Phase checks morale; failing, it is disordered and its
 *  move ends in the first area it enters (it stays put when it may not stop there). */
function withdrawal(g: Game, u: Unit, opt: Opt) {
  const V = state(g),
    from = opt.path[0];
  if (!g.opts.withdrawal || g.phase !== 'movement' || isAssembly(from) || !contested(g, from) || (V.withdrew ??= []).includes(u.id)) return;
  if (unitsIn(g, from, u.side).some((x) => x.id !== u.id && regular(x))) return;
  V.withdrew.push(u.id);
  const sn = golanMoraleSn(g, u, 'check'),
    { r, ok } = moraleCheck(g, u, sn, 'Withdrawal (18.2)');
  if (ok) {
    say(g, `${u.name} withdraws from ${nameOf(from)} in good order (${r} vs ${sn}, 18.2)`);
    return;
  }
  u.disorder = 1;
  const first = opt.path[1],
    can = moveOptions(g, u.id).some((x) => x.area === first); // disordered now: it may no longer stop among enemy units (9.33d)
  say(g, `${u.name} fails its withdrawal check (${r} vs ${sn}): disordered, its move ends in ${nameOf(can ? first : from)} (18.2)`);
  if (can) seriesMove(g, u.id, first);
  u.moved = true;
  return 'withdrawal';
}
export function afterMove(g: Game, u: Unit, opt: Opt) {
  const V = state(g),
    from = opt.path[0],
    to = opt.area,
    prev = opt.path[opt.path.length - 2],
    last = connection(prev, to)!,
    key = edgeKey(prev, to);
  for (const l of opt.limited ?? []) if (!V.crossed.includes(l)) V.crossed.push(l);
  if (
    unitsIn(g, to, other(u.side)).length &&
    ((last.atDitch && !V.bridgedDitch.includes(key)) ||
      last.rugged ||
      last.escarpment ||
      (last.river && (last.type !== 'road' || g.blown.includes(key))))
  )
    (V.assaultEntered[to] ??= []).push(u.id); // 14.01 (a: rugged, escarpment, AT ditch)
  if (u.side === 'israeli' && !V.purpleLineCrossed && !isAssembly(from) && !garea(from).syria && !isAssembly(to) && garea(to).syria)
    purpleLineCrossed(g);
  if (u.side === 'israeli' && V.raids.includes(to)) resolveRaid(g, u, to, opt.cost);
  if (u.side === 'syrian') {
    const c = raidUnitAt(g, to);
    if (c) {
      chit(g, c.chitId!).box = 'used';
      c.area = null;
      c.str = 0;
      V.raids = V.raids.filter((a) => a !== to);
      V.raidPartial = V.raidPartial.filter((a) => a !== to);
      say(g, `${u.name} relieves the commandos in ${areas.get(to)!.name}`);
    }
  }
  if (u.side === 'israeli' && regular(u)) evacuateStrongpoint(g, from);
  ghostsMet(g, u, to, opt.cost);
}
/** 15.2, 15.4a: the first Israeli unit into Syria releases at once the 3rd Tank Division and two Strategic Reserve units of the Syrian player's
 *  choice. The Israeli move waits while the Syrian player picks the two (pickRelease) and places each released unit on one of its friendly-controlled
 *  Entry areas (placeReleased); a unit with no open Entry area waits in the Arriving box for the next Reinforcement Phase. */
export function purpleLineCrossed(g: Game) {
  const V = state(g),
    sr = g.units.filter((x) => x.box === 'strategic_reserve');
  V.purpleLineCrossed = true;
  say(
    g,
    "Israeli units cross the Purple Line: the 3rd Tank Division and two Strategic Reserve units of the Syrian player's choice are released (15.2, 15.4a)",
  );
  V.release = { pick: sr.length > 2, place: [] };
  if (!V.release.pick)
    queueRelease(
      g,
      sr.map((u) => u.id),
    );
}
/** The Strategic Reserve units the Syrian player chooses from (15.2), while the choice is open. */
export const releaseChoices = (g: Game) => (state(g).release?.pick ? g.units.filter((x) => x.box === 'strategic_reserve') : []);
export function pickRelease(g: Game, ids: string[]) {
  const V = state(g),
    c = releaseChoices(g);
  need(V.release?.pick, 'no Strategic Reserve units to choose now');
  need(
    ids.length === 2 && new Set(ids).size === 2 && ids.every((id) => c.some((u) => u.id === id)),
    'choose two Strategic Reserve units (15.2)',
  );
  V.release!.pick = false;
  say(g, `Syria releases ${ids.map((id) => unit(g, id).name).join(' and ')} (15.2)`, 'syrian');
  queueRelease(g, ids);
}
function queueRelease(g: Game, ids: string[]) {
  state(g).release!.place = [...g.units.filter((x) => x.box === 'operational_reserve').map((u) => u.id), ...ids];
  settleRelease(g);
}
/** Released units with no open Entry area go to the Arriving box; the release ends when nothing is left to choose or place. */
function settleRelease(g: Game) {
  const V = state(g);
  if (!V.release) return;
  for (const id of [...V.release.place]) {
    const u = unit(g, id);
    if (releaseAreas(g, u).length) continue;
    u.box = 'arriving';
    V.release.place = V.release.place.filter((x) => x !== id);
    say(g, `${u.name}: no open Entry area, it arrives next Reinforcement Phase`, 'syrian');
  }
  if (!V.release.pick && !V.release.place.length) V.release = undefined;
}
/** The Entry areas a released unit may be placed on now. */
export const releaseTargets = (g: Game, id: string) => (state(g).release?.place.includes(id) ? releaseAreas(g, unit(g, id)) : []);
export function placeReleased(g: Game, id: string, a: number) {
  need(releaseTargets(g, id).includes(a), 'a friendly-controlled Entry area of that unit, with room (15.2)');
  const V = state(g);
  releaseUnit(g, unit(g, id), a);
  V.release!.place = V.release!.place.filter((x) => x !== id);
  settleRelease(g);
}
/** Friendly-controlled Entry areas of a released Syrian unit with room for it (14.61b, 15.2, 17.11). */
export const releaseAreas = (g: Game, u: Unit) =>
  (u.entry ?? [])
    .map((l) => (l.startsWith('#') ? +l.slice(1) : ENTRY[l]))
    .filter(
      (a) =>
        a != null && g.control[a] === u.side && !unitsIn(g, a, other(u.side)).length && unitsIn(g, a, u.side).filter(regular).length < 2,
    );
/** Place a released unit in an Entry area at once (`at`, or the first open one); false when none is open. */
export function releaseUnit(g: Game, u: Unit, at?: number): boolean {
  const ok = releaseAreas(g, u),
    a = at ?? ok[0];
  if (a == null || !ok.includes(a)) return false;
  Object.assign(u, { box: undefined, area: a, arrival: g.turn, moved: false, spent: 0 });
  g.arrived.push(u.id);
  say(g, `${u.name} enters in ${nameOf(a)}`, u.side);
  return true;
}
/** 16.11a: the first Israeli unit into a raided area rolls: 1–2 the raid succeeds, 3–5 partly (the commandos do not fire back), 6+ the helicopters were shot down. */
function resolveRaid(g: Game, u: Unit, a: number, cost: number) {
  const V = state(g),
    die = rollDie(g),
    r = g.opts.raidMod && eastOfSam(a) ? die - 1 : die,
    c = raidUnitAt(g, a);
  V.raids = V.raids.filter((x) => x !== a); // optional: −1 east of the SAM barrier
  if (r >= 6) {
    if (c) eliminate(g, c);
    u.moved = false;
    u.spent = cost;
    say(g, `Commando raid in ${areas.get(a)!.name} fails (${r}): the helicopters are shot down, ${u.name} may move on`);
    return;
  }
  if (r >= 3) V.raidPartial.push(a);
  say(g, `Commando raid in ${areas.get(a)!.name} ${r <= 2 ? 'succeeds' : 'partly succeeds'} (${r}): ${u.name} stops and must fight it`);
}
/** 15.6: once the regular units leave a contested area, its strongpoint is evacuated and a matching Task Force goes into the Israeli cup. */
/** Errata (9/2017): an Israeli attack in an area holding an Israeli strongpoint. The strongpoint may take part only by being removed from play
 *  and replaced at once by its Task Force (armor or infantry supported, as for evacuation, 15.6), committed to the battle; this cannot be undone. */
export function strongpointSwapOption(g: Game): { unit: string; chit: string } | null {
  const b = g.battle;
  if (!b || b.stage !== 'setup' || b.attacker !== 'israeli' || battleState(b).spSwap) return null;
  const sp = unitsIn(g, b.area, 'israeli').find((u) => u.fort && !u.ghost);
  if (!sp) return null;
  const tf = g.chits.find(
    (c) => c.box === 'evacuated_strongpoints' && c.kind === 'task_force' && c.name.includes(sp.fort === 'armor' ? 'armor' : 'infantry'),
  );
  if (!tf) return null;
  const lim = limits(g, b, 'israeli');
  if (b.assets.israeli.filter((id) => isBattleAsset(chit(g, id))).length >= lim.battle) return null;
  return { unit: sp.id, chit: tf.id };
}
export function swapStrongpointIntoAttack(g: Game) {
  const o = strongpointSwapOption(g);
  need(!!o, 'no strongpoint of the attack to commit (errata: Israeli attack in an area with a strongpoint)');
  const b = g.battle!,
    sp = unit(g, o!.unit),
    tf = chit(g, o!.chit);
  sp.area = null;
  sp.box = 'evacuated';
  tf.box = 'map';
  b.assets.israeli.push(tf.id);
  battleState(b).spSwap = tf.id;
  b.locked = true;
  say(g, `The strongpoint in ${nameOf(b.area)} joins the attack as the ${tf.name} (errata): it is removed from play for good`, 'israeli');
}
/** The Task Force that replaced a strongpoint stays in its battle. */
export const keepAssigned = (_g: Game, b: Battle, c: Chit) => battleState(b).spSwap === c.id;
export function evacuateStrongpoint(g: Game, a: number) {
  const sp = unitsIn(g, a, 'israeli').find((u) => u.fort);
  if (!sp || !unitsIn(g, a, 'syrian').some(regular) || unitsIn(g, a, 'israeli').some(regular)) return;
  sp.area = null;
  sp.box = 'evacuated';
  const tf = g.chits.find(
    (c) => c.box === 'evacuated_strongpoints' && c.kind === 'task_force' && c.name.includes(sp.fort === 'armor' ? 'armor' : 'infantry'),
  );
  if (tf) tf.box = 'cup';
  say(g, `The strongpoint in ${areas.get(a)!.name} is evacuated; a Task Force goes into the Israeli cup (15.6)`);
}
/** Strategic movement (14.8): roads only, never into an Assembly area from the map, not over an unbridged ditch, not across the operational boundary (Syrians to turn 4), not into an interdicted or raided area. */
export function stratStep(g: Game, u: Unit, a: number, n: number): boolean {
  const c = connection(a, n)!,
    V = state(g);
  if (isAssembly(n) && !isAssembly(a)) return false;
  if (c.type !== 'road' && !(c.type === 'special' && isAssembly(a) && isAssembly(n))) return false;
  if (c.atDitch && !V.bridgedDitch.includes(edgeKey(a, n))) return false;
  if (u.side === 'syrian' && g.turn <= 4 && c.sector) return false;
  if (interdictedBy(g, n) === other(u.side) || (u.side === 'israeli' && V.raids.includes(n))) return false;
  if ((c.escarpment || c.rugged) && V.crossed.includes(edgeKey(a, n))) return false; // 14.11/14.14 (player aid A.6, the owner's ruling): one unit per boundary in strategic moves too
  return true;
}
