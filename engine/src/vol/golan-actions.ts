// FAB Vol. III, Golan '73: the player actions that exist only in this volume. Engineering (4.3, 14.5), air missions and commando raids in the Admin Phase (16.31, 16.11), SAM fire (16.12), the events (17.x, 4.21), the Special Action uses (14.61), events in a battle (Electronic Warfare 17.33, Counterbattery 17.34), the air assault of the 82nd Para (15.3).
import { areas, connection, edgeKey, neighbors } from '../map';
import { ASSEMBLY, HERMON, eastOfSam, isAssembly, area as garea } from '../golan/map';
import { samResult } from '../golan/combat';
import { isArty, type Chit } from '../chits';
import {
  airOf,
  blocks,
  buildFieldWorks,
  chit,
  contested,
  dropAir,
  dropReserve,
  fighters,
  inSupply,
  needAdmin,
  other,
  rollDie,
  say,
  sidesOf,
  spendSA,
  unitsIn,
  updateControl,
  type Battle,
  type Game,
  type Side,
} from '../game';
import { releaseAreas, releaseUnit } from './golan-moves';
import { samAvailable } from './golan-combat';
import {
  asGarrison,
  avail,
  battleState,
  gone,
  homeArea,
  isNafakh,
  isNight,
  nameOf,
  need,
  reduced,
  regular,
  state,
  unit,
  used,
  vacant,
} from './golan';

/* ---------- engineering (4.3, 14.5) ---------- */
/** 4.31: up to two bridges (river boundaries a road crosses, 14.41) next to one supplied, friendly, uncontested area. */
export function blowBridges(g: Game, chitId: string, from: number, to: number[]) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['engineer']);
  need(homeArea(g, c.side, from), 'the engineer works from a supplied, friendly-controlled, uncontested area');
  need(to.length >= 1 && to.length <= 2, 'one or two bridges');
  for (const n of to) {
    const e = connection(from, n);
    need(e?.river && e.type === 'road' && !g.blown.includes(edgeKey(from, n)), `no bridge between ${nameOf(from)} and ${nameOf(n)}`);
  }
  for (const n of to) g.blown.push(edgeKey(from, n));
  used(c);
  say(g, `${c.name} blows the bridge(s) ${to.map((n) => `${nameOf(from)}–${nameOf(n)}`).join(', ')} (4.31)`, c.side);
}
/** 4.32: repair a blown bridge from a supplied, friendly, uncontested area towards a friendly or contested one. */
export function repairBridge(g: Game, chitId: string, from: number, to: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['engineer']),
    key = edgeKey(from, to);
  need(g.blown.includes(key), 'that bridge is not blown');
  need(
    homeArea(g, c.side, from) && (g.control[to] === c.side || contested(g, to)),
    'repair from a supplied, friendly, uncontested area towards a friendly or contested one',
  );
  g.blown = g.blown.filter((x) => x !== key);
  used(c);
  say(g, `${c.name} repairs the bridge ${nameOf(from)}–${nameOf(to)} (4.32)`, c.side);
}
/** 4.33: field works where a friendly unit stands (never with a strongpoint, 15.6). */
export function engineerFieldWorks(g: Game, chitId: string, a: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['engineer']);
  need(homeArea(g, c.side, a) && blocks(g, a, c.side).some(regular), 'a supplied, friendly, uncontested area with a friendly unit');
  need(!g.fieldWorks.includes(a) && !unitsIn(g, a).some((u) => u.fort), 'no field works there (one per area, never with a strongpoint)');
  g.fieldWorks.push(a);
  g.fwOwner[a] = c.side;
  used(c);
  say(g, `${c.name} builds field works in ${nameOf(a)} (4.33)`, c.side);
}
/** 14.51a: bridge an AT ditch boundary (up to eight markers) from a supplied, friendly, uncontested area towards a friendly one or a contested enemy one. */
export function bridgeDitch(g: Game, chitId: string, from: number, to: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['engineer']),
    key = edgeKey(from, to),
    V = state(g);
  need(connection(from, to)?.atDitch && !V.bridgedDitch.includes(key), 'no unbridged AT ditch there');
  need(V.bridgedDitch.length < 8, 'all eight AT Ditch Bridged markers are in use');
  need(
    homeArea(g, c.side, from) && (g.control[to] === c.side || (contested(g, to) && g.control[to] === other(c.side))),
    'bridge from a supplied, friendly, uncontested area towards a friendly one or a contested enemy one',
  );
  V.bridgedDitch.push(key);
  used(c);
  say(g, `${c.name} bridges the AT ditch ${nameOf(from)}–${nameOf(to)} (14.51a)`, c.side);
}
/** 14.52 (Syrian only): lift a minefield next to a supplied, friendly, uncontested area. */
export function removeMinefield(g: Game, chitId: string, from: number, to: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['engineer']),
    key = edgeKey(from, to),
    V = state(g);
  need(c.side === 'syrian', 'only Syrian engineers clear minefields');
  need(V.minefields.includes(key) && homeArea(g, 'syrian', from), 'a mined boundary next to a supplied, friendly, uncontested area');
  V.minefields = V.minefields.filter((x) => x !== key);
  used(c);
  say(g, `${c.name} clears the minefield ${nameOf(from)}–${nameOf(to)} (14.52)`, c.side);
}
/** 14.51b: a Syrian engineer in a battle on the Israeli side of the ditch may bridge an adjoining AT ditch boundary instead of firing. */
export function setEngineerBridge(g: Game, b: Battle, to: number | null) {
  const B = battleState(b);
  if (to == null) {
    B.engBridge = undefined;
    return;
  }
  const c = connection(b.area, to);
  need(
    b.attacker === 'syrian' && !garea(b.area).syria && c?.atDitch && !state(g).bridgedDitch.includes(edgeKey(b.area, to)),
    'no AT ditch to bridge there',
  );
  need(state(g).bridgedDitch.length < 8, 'all eight AT Ditch Bridged markers are in use (14.51a)');
  need(
    b.assets.syrian.some((id) => chit(g, id).kind === 'engineer'),
    'assign an engineer asset first',
  );
  B.engBridge = edgeKey(b.area, to);
}

/* ---------- air missions in the Admin Phase (16.31b/c) and commando raids (16.11a) ---------- */
const noSamReplay = (g: Game, a: number) =>
  need(!(state(g).samCancelled ?? []).includes(a), 'a SAM cancelled an air mission over that area: no replacement this phase (16.12)');
const airOk = (g: Game, a: number) => {
  need(!state(g).samTarget, 'Syria must first answer the air mission already flown (16.12)');
  need(!isNight(g), 'no air missions on the night turn (14.03)');
  need(!isAssembly(a), 'not over an Assembly area');
};
export function airInterdiction(g: Game, chitId: string, a: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['air_mission']);
  airOk(g, a);
  need(!g.interdicted[a], 'that area is already interdicted');
  noSamReplay(g, a);
  c.box = 'map';
  c.area = a;
  c.mission = 'interdiction';
  g.interdicted[a] = c.id;
  if (c.side === 'israeli' && eastOfSam(a) && samAvailable(g)) state(g).samTarget = c.id;
  say(g, `Air interdiction over ${nameOf(a)} (16.31b)`, c.side);
}
/** 18.31 (optional) Artillery interdiction: once per Admin Phase per player, an available artillery asset goes into an area next to friendly units
 *  or a strongpoint; it works as an interdiction mission (16.31b: +1 MP in and out for the enemy, no strat-move) until the second Supply Phase. */
export function artilleryInterdiction(g: Game, chitId: string, a: number) {
  needAdmin(g, chit(g, chitId).side);
  need(!!g.opts.artyInterdict, 'artillery interdiction is an optional rule (18.31)');
  const c = chit(g, chitId),
    V = state(g);
  need(c.box === 'available' && isArty(c), `${c.name} is not an available artillery asset`);
  need(!(V.artyInt ?? []).includes(c.side), 'one artillery interdiction per player in each Admin Phase (18.31)');
  need(areas.has(a) && !isAssembly(a) && (!g.inPlay || g.inPlay.includes(a)), 'not an area of the map');
  need(!g.interdicted[a], 'that area is already interdicted');
  need(
    neighbors(a).some((n) => !isAssembly(n) && unitsIn(g, n, c.side).some((u) => regular(u) || !!u.fort)),
    'an area next to one holding friendly units or a strongpoint (18.31)',
  );
  c.box = 'map';
  c.area = a;
  c.mission = 'interdiction';
  g.interdicted[a] = c.id;
  (V.artyInt ??= []).push(c.side);
  say(g, `${c.name} interdicts ${nameOf(a)} (18.31)`, c.side);
}
export function airRecon(g: Game, chitId: string, a: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['air_mission']);
  airOk(g, a);
  noSamReplay(g, a);
  need(
    unitsIn(g, a, other(c.side)).some((u) => !u.garrison),
    'reconnaissance over an enemy-occupied area',
  ); // strongpoints and ghosts too
  c.box = 'map';
  c.area = a;
  c.mission = 'recon';
  if (c.side === 'israeli' && eastOfSam(a) && samAvailable(g)) {
    state(g).samTarget = c.id;
    say(g, `Air reconnaissance over ${nameOf(a)}: Syria may answer with a SAM (16.31c)`, c.side);
    return;
  }
  finishRecon(g, c);
}
/** The reconnaissance flies: the enemy blocks in the area are shown for the rest of the phase. */
export function finishRecon(g: Game, c: Chit) {
  state(g).intel = { side: c.side, area: c.area! };
  c.mission = undefined;
  used(c);
  say(g, 'Reconnaissance reveals the enemy blocks (16.31c)', c.side);
}
/** 16.11a: a commando from the Available Box lands on a vacant Israeli-controlled area next to a Syrian-occupied one; it stands there like a defended roadblock. */
export function placeRaid(g: Game, chitId: string, a: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['commando']);
  need(
    !isAssembly(a) && g.control[a] === 'israeli' && vacant(g, a) && neighbors(a).some((n) => blocks(g, n, 'syrian').some(regular)),
    'a vacant Israeli-controlled area next to a Syrian-occupied area',
  );
  c.box = 'map';
  c.area = a;
  g.units = g.units.filter((x) => x.id !== `R-${c.id}`);
  g.units.push(asGarrison(c, 'R', a, 'infantry', c.q ?? 'veteran'));
  state(g).raids.push(a);
  say(g, `Commandos land in ${nameOf(a)} (16.11a)`, 'syrian');
}
/** 16.12: the Syrian player answers the Israeli air mission with an available SAM (or declines). */
export function fireSam(g: Game, samId: string) {
  const V = state(g),
    b = g.battle,
    airId = V.samTarget;
  need(airId, 'no Israeli air mission to answer');
  const sam = chit(g, samId);
  need(sam.kind === 'sam' && sam.box === 'available', 'no SAM asset available');
  const die = rollDie(g),
    res = samResult(isNafakh(g) ? Math.max(4, g.turn) : g.turn, die);
  sam.box = 'used';
  V.samTarget = undefined; // 22.46: Nafakh uses the turn 4-6 column
  const a = chit(g, airId!);
  if (a.mission === 'interdiction' && res !== 'none' && a.area != null) delete g.interdicted[a.area];
  if (!b && res !== 'none' && a.area != null) (V.samCancelled ??= []).push(a.area);
  if (a.mission === 'recon' && res === 'none') finishRecon(g, a);
  if (res !== 'none') {
    a.mission = undefined;
    a.box = res === 'eliminated' ? 'eliminated' : 'used';
    a.area = undefined;
    if (b) {
      for (const s of sidesOf(g)) dropAir(b, s, a.id);
      battleState(b).samCancelled = true;
    }
  }
  b?.rolls.push({ who: `SAM against ${a.name}`, sn: 0, dice: [die], hits: res === 'none' ? 0 : 1, kind: 'sam' });
  say(
    g,
    `SAM air defence fire: ${die} — ${res === 'eliminated' ? 'the air asset is shot down' : res === 'used' ? 'the air mission is cancelled' : 'no effect'} (16.12)`,
    'syrian',
  );
  return res;
}
export function declineSam(g: Game) {
  const V = state(g),
    id = V.samTarget;
  V.samTarget = undefined;
  const a = id ? chit(g, id) : undefined;
  if (a?.mission === 'recon') finishRecon(g, a);
}

/* ---------- events (17.x, 4.21) ---------- */
const STRATEGIC: Record<string, string> = { Assad: 'S21', '141st': 'S22', '62nd': 'S23' };
/** 17.11: the named Strategic Reserve unit is released and placed at once in a friendly-controlled Entry area (`at`, or the first open one). */
export function playRelease(g: Game, chitId: string, at?: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['event_release']);
  const id = Object.entries(STRATEGIC).find(([k]) => c.name.startsWith(k))?.[1];
  need(id, 'unknown release');
  const u = unit(g, id!);
  need(u.box === 'strategic_reserve', `${u.name} is already in play`);
  need(at == null ? releaseAreas(g, u).length > 0 : releaseAreas(g, u).includes(at), 'a friendly-controlled Entry area with room (17.11)');
  say(g, `${u.name} released from the Strategic Reserve (17.11)`, 'syrian');
  releaseUnit(g, u, at);
  gone(c);
}
/** 17.12 SSM attack: each Israeli air asset in the Available Box goes back to the cup on 1–2. */
export function playSSM(g: Game, chitId: string) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['event_ssm_strike']);
  gone(c);
  for (const air of g.chits.filter((x) => x.kind === 'air_mission' && x.side === 'israeli' && x.box === 'available')) {
    const die = rollDie(g);
    if (die <= 2) air.box = 'cup';
    say(g, `SSM strike: ${die}${die <= 2 ? ', an air asset goes back to the cup' : ', no effect'} (17.12)`, 'syrian');
  }
}
/** 17.21: two steps to the named brigade: +2 to one unit, +1 to each of two, or one eliminated unit back at 2 steps in an Assembly area. */
export function playArrivingBattalion(
  g: Game,
  chitId: string,
  choice: { add: string } | { split: [string, string] } | { rebuild: string; assembly: 'A' | 'B' },
) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['event_arriving_battalion']);
  const mine = (id: string) => {
    const u = unit(g, id);
    need(u.side === 'israeli' && !!c.brigade && u.brigade === c.brigade, `${u.name} is not of the ${c.brigade} brigade`);
    return u;
  };
  if ('add' in choice) {
    const u = mine(choice.add);
    need(u.area != null && !u.unsupplied && u.str + 2 <= u.max, 'a supplied unit with room for two steps');
    u.str += 2;
  } else if ('split' in choice)
    for (const id of choice.split) {
      const u = mine(id);
      need(u.area != null && !u.unsupplied && u.str < u.max, 'supplied, reduced units');
      u.str += 1;
    }
  else {
    const u = mine(choice.rebuild);
    need(u.area == null && u.str === 0, 'only an eliminated unit comes back');
    Object.assign(u, {
      area: choice.assembly === 'B' ? ASSEMBLY.B : ASSEMBLY.A,
      str: Math.min(2, u.max),
      disorder: 0,
      unsupplied: false,
      box: undefined,
    });
    g.elimLarge = g.elimLarge.filter((x) => x !== u.id); // 19.2: off the Eliminated Large Units track
  }
  gone(c);
  say(g, `${c.name} arrives (17.21)`, 'israeli');
}
/** 17.23 Lt. Zvika Greengold: an elite armor defended roadblock in an unoccupied Israeli-controlled area, staying until destroyed. */
export function playLtZvika(g: Game, chitId: string, a: number) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['event_lt_zvika']);
  need(
    !isAssembly(a) && g.control[a] === 'israeli' && vacant(g, a) && inSupply(g, 'israeli', a),
    'a supplied, unoccupied Israeli-controlled area (17.23, 4.35)',
  );
  c.box = 'map';
  c.area = a;
  c.q = 'elite';
  g.units.push(asGarrison(c, 'Z', a, 'armor', 'elite'));
  say(g, `Lt. Zvika takes position in ${nameOf(a)} (17.23)`, 'israeli');
}
/** 17.24 King Hassan's Troublemakers: the Moroccans fire only in defence and never enter Israeli-controlled areas, for the rest of the game. */
export function playKingHassan(g: Game, chitId: string) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['event_king_hassan']);
  gone(c);
  state(g).kingHassan = true;
  say(g, "King Hassan's Troublemakers: the Moroccan brigade holds back (17.24)", 'israeli');
}
/** 17.31/17.32 replacements: one step to a supplied reduced unit of the matching class, even in a contested area. */
export function playReplacement(g: Game, chitId: string, unitId: string) {
  needAdmin(g, chit(g, chitId).side);
  const c = avail(g, chitId, ['replacement_arm', 'replacement_mech']),
    u = unit(g, unitId);
  need(!u.fort, 'strongpoints never receive replacement steps (15.6)');
  need(
    u.side === c.side && reduced(u) && !u.unsupplied,
    'a supplied, reduced unit of your own (9.31: its status from the last Supply Phase)',
  );
  need(
    c.kind === 'replacement_arm' ? u.cls === 'armor' : u.symbol === 'mech' || u.cls === 'infantry',
    c.kind === 'replacement_arm'
      ? 'armor replacements go to armor-class units'
      : 'mechanized replacements go to mech or infantry-class units',
  );
  u.str += 1;
  gone(c);
  say(g, `${u.name} gets a replacement step (17.3)`, c.side);
}
/** 4.21: any event may instead bring two assets back from the Eliminated Box to the cup (not commandos, SAMs, air support or garrisons, 17.4). */
/** 4.21 with 17.4: the eliminated assets an event may bring back (never commandos, SAMs, air support or garrisons). */
export const alternateEventCandidates = (g: Game, side: Side) =>
  g.chits.filter(
    (a) =>
      a.side === side &&
      a.box === 'eliminated' &&
      !['commando', 'sam', 'air_mission', 'garrison', 'sa_block', 'command_staff'].includes(a.kind) &&
      !a.kind.startsWith('event') &&
      !a.kind.startsWith('replacement_') &&
      a.kind !== 'special_action_event',
  );
export function alternateEventUse(g: Game, chitId: string, assetIds: string[]) {
  needAdmin(g, chit(g, chitId).side);
  const c = chit(g, chitId);
  need(
    c.box === 'available' && (c.kind.startsWith('event') || c.kind.startsWith('replacement_') || c.kind === 'special_action_event'),
    'play an event from the Available Box',
  ); // 17.31/17.32 replacements are events
  need(assetIds.length === Math.min(2, alternateEventCandidates(g, c.side).length), 'choose two assets from your Eliminated Box (4.21)');
  for (const id of assetIds) {
    const a = chit(g, id);
    need(
      a.side === c.side &&
        a.box === 'eliminated' &&
        !['commando', 'sam', 'air_mission', 'garrison'].includes(a.kind) &&
        !a.kind.startsWith('event') &&
        !a.kind.startsWith('replacement_') &&
        a.kind !== 'special_action_event',
      `${a.name} cannot come back this way (17.4)`,
    );
  }
  for (const id of assetIds) chit(g, id).box = 'cup';
  gone(c);
  say(g, `${c.name} used to bring back ${assetIds.length} asset(s) (4.21)`, c.side);
}

/* ---------- Special Action uses of this volume (14.61) ---------- */
/** 14.61a (Israeli): fold one unit into another with the same symbol, same or adjacent uncontested friendly areas, both in good order. */
export function mergeUnits(g: Game, fromId: string, intoId: string, chitId?: string) {
  needAdmin(g, 'israeli');
  const a = unit(g, fromId),
    b = unit(g, intoId);
  need(
    a.side === 'israeli' && b.side === 'israeli' && a.id !== b.id && regular(a) && regular(b) && a.symbol === b.symbol,
    'two Israeli units with the same unit symbol',
  );
  need(
    !g.opts.israeliDivisions || a.division === b.division,
    'with Israeli divisional organization, merging units must be of the same division (18.5)',
  );
  need(a.area != null && b.area != null && (a.area === b.area || neighbors(a.area).includes(b.area)), 'in the same or adjacent areas');
  need(
    [a.area!, b.area!].every((x) => isAssembly(x) || (g.control[x] === 'israeli' && !contested(g, x))) &&
      a.disorder === 0 &&
      b.disorder === 0 &&
      !a.unsupplied &&
      !b.unsupplied,
    'uncontested friendly areas, supplied units in good order (9.34d)',
  );
  spendSA(g, 'israeli', undefined, `merge ${a.name} into ${b.name} (14.61a)`, chitId);
  b.str = Math.min(b.max, b.str + a.str);
  a.area = null;
  a.str = 0;
  dropReserve(g, a); // no VP for Syria (19.2)
}
/** 14.61b (Syrian, from turn 3): release the next 3rd Tank Division unit (15th, 81st, 65th) into its friendly-controlled Entry area (`at`, or the first open one). */
export function releaseOperationalReserve(g: Game, chitId?: string, at?: number) {
  needAdmin(g, 'syrian');
  need(g.turn >= 3, 'from turn 3');
  const next = ['S18', 'S19', 'S20'].map((id) => unit(g, id)).find((u) => u.box === 'operational_reserve');
  need(next, 'the Operational Reserve is empty');
  need(
    at == null ? releaseAreas(g, next!).length > 0 : releaseAreas(g, next!).includes(at),
    'its Entry area must be friendly-controlled, with room (14.61b)',
  );
  spendSA(g, 'syrian', undefined, `release ${next!.name} (14.61b)`, chitId);
  releaseUnit(g, next!, at);
}
/** 14.61c / 14.61d: a SAM (Syria) or an air support asset (Israel) from the Eliminated Box back into the cup. */
export function replaceAsset(g: Game, side: Side, assetId: string, chitId?: string) {
  needAdmin(g, side);
  const a = chit(g, assetId);
  need(
    a.side === side && a.box === 'eliminated' && a.kind === (side === 'syrian' ? 'sam' : 'air_mission'),
    side === 'syrian' ? 'an eliminated SAM asset' : 'an eliminated air support asset',
  );
  spendSA(g, side, undefined, `${a.name} replaced (14.61${side === 'syrian' ? 'c' : 'd'})`, chitId);
  a.box = 'cup';
}
/** 5.23 with 15.6: a unit digs in, but never where a strongpoint stands. */
export function unitFieldWorks(g: Game, unitId: string) {
  const u = unit(g, unitId);
  need(u.area == null || !unitsIn(g, u.area).some((x) => x.fort), 'no field works where a strongpoint stands (15.6)');
  buildFieldWorks(g, unitId);
}

/* ---------- events and Special Actions in a battle (17.33, 17.34, 8.23) ---------- */
const takeEvent = (g: Game, b: Battle, c: Chit, kind: string) => {
  const B = battleState(b);
  need(b.stage === 'setup', 'events are played before the first roll');
  need(c.box === 'available' && c.kind === kind, 'that event is not available');
  need(!unitsIn(g, b.area, c.side).every((u) => u.garrison), 'a standing asset fighting alone plays no events (4.35)');
  need(!B.event[c.side], 'one event per side in a battle (6.22, 6.23)');
  B.event[c.side] = c.id;
  c.box = 'eliminated';
  b.locked = true; // 4.22 single use
  return c.side;
};
/** 17.33 Command Disruption: the Attacker jams the defence before the Defender assigns anything. */
export function playJamming(g: Game, b: Battle, chitId: string) {
  const c = chit(g, chitId),
    def = other(b.attacker);
  need(c.side === b.attacker, 'only the Attacker jams (17.33)');
  need(!b.defSA, 'the Defender first decides on his Special Action (6.21)');
  need(!b.ready?.includes(b.attacker), 'jam with your assets, before committing them (6.22)');
  need(!b.assets[def].length && !airOf(b, def).length, 'the Defender has already assigned assets');
  takeEvent(g, b, c, 'event_ew');
  battleState(b).ew = { pending: true };
  say(g, 'Electronic warfare: command disruption (17.33)', b.attacker);
}
/** 17.33: the Defender answers, with his own EW as countermeasures (+2 to each roll) or without. Each defending unit rolls: 5 or less, disordered. */
export function answerJamming(g: Game, b: Battle, counterChitId?: string) {
  const B = battleState(b),
    def = other(b.attacker);
  need(B.ew?.pending, 'no jamming to answer');
  if (counterChitId) {
    takeEvent(g, b, chit(g, counterChitId), 'event_ew');
    say(g, 'EW countermeasures: +2 to each roll', def);
  }
  for (const u of fighters(g, b.area, def, false).filter((x) => !x.garrison)) {
    const die = rollDie(g),
      mod = counterChitId ? 2 : 0,
      hit = die + mod <= 5;
    b.rolls.push({ who: `${u.name}: jamming`, sn: 5, dice: [die + mod], hits: hit ? 1 : 0, kind: 'morale' });
    if (hit) u.disorder = 1;
    say(g, `${u.name} rolls ${die}${mod ? ' +2' : ''}: ${hit ? 'disordered' : 'holds'}`, def);
  }
  B.ew = { pending: false };
  const us = fighters(g, b.area, def, false).filter((x) => !x.garrison);
  B.defLocked = us.length > 0 && us.every((u) => u.disorder === 1);
}
/** 17.34 Counterbattery: played as the side's one event; it strikes after the enemy artillery fires. */
export function playCounterbattery(g: Game, b: Battle, chitId: string) {
  const side = takeEvent(g, b, chit(g, chitId), 'event_counterbattery');
  battleState(b).counterbattery[side] = chitId;
  say(g, 'Counterbattery strike prepared (17.34)', side);
}
/** 8.23: the units that may reinforce the Defender from an adjacent uncontested area (not into a battle held by assets alone, 4.35, except Lt. Zvika, 17.23). */
export function reinforceOptions(g: Game, b: Battle) {
  const def = other(b.attacker),
    here = unitsIn(g, b.area, def);
  if (b.stage !== 'setup' || blocks(g, b.area, def).filter(regular).length >= 2) return [];
  if (!here.some((u) => regular(u) || !!u.fort) && !here.some((u) => u.garrison && u.chitId && chit(g, u.chitId).kind === 'event_lt_zvika'))
    return [];
  return g.units
    .filter(
      (u) =>
        u.side === def && u.area != null && neighbors(b.area).includes(u.area) && regular(u) && u.disorder === 0 && !contested(g, u.area),
    )
    .map((u) => u.id);
}

/* ---------- 15.3 Air Assault: the 82nd Para, once, east of the SAM barrier or onto Mt Hermon, first thing in a Syrian Combat Phase ---------- */
export function airAssaultTargets(g: Game) {
  const para = g.units.find((u) => u.id === 'S17');
  if (!para || para.box !== 'air_assault' || g.phase !== 'combat' || g.phasing !== 'syrian' || isNight(g) || g.fought.length || g.battle)
    return [];
  return [...areas.keys()].filter((a) => !isAssembly(a) && (eastOfSam(a) || a === HERMON) && blocks(g, a, 'syrian').length < 2);
}
export function airAssault(g: Game, a: number) {
  need(airAssaultTargets(g).includes(a), 'no air assault there');
  const u = unit(g, 'S17');
  u.area = a;
  u.box = undefined;
  say(g, `The 82nd Para lands in ${nameOf(a)} (15.3)`, 'syrian');
  if (unitsIn(g, a, 'israeli').length) {
    g.riverAssault.push(a);
    state(g).airAssaultArea = a;
  } else updateControl(g, a);
}
