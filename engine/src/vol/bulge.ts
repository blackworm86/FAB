// FAB Vol. I, The Bulge, on the series engine: its exclusive rules, which the series engine calls as the volume's hooks (game.ts registers them): army zones and fuel 16.1, German artillery attrition 16.12, garrisons and Task Forces 16.2, Greif teams 17.1, Bodenplatte 17.14, von der Heydte 16.11, the British 14.43, the optional rules 18.x, the scenario results.
import { areas, connection, allNeighbors, zoneOf } from '../map';
import { moraleSn } from '../combat';
import { reachable } from '../movement';
import { isArty, isBattleAsset, ZONE, type Chit, type Side } from '../chits';
import { CUR } from '../volumes';
import { coldAreas, EDGE_INTRO } from './bulge-setup';
import {
  airSup,
  assetLimits,
  type Battle,
  blocks,
  boxOf,
  check,
  chit,
  contested,
  eliminate,
  finalResult,
  type Game,
  inSupply,
  keyOf,
  markerAreas,
  needAdmin,
  type Opt,
  other,
  point,
  quality,
  recycleUsed,
  roll,
  say,
  sideOf,
  type Unit,
  unitsIn,
} from '../game';

export const AIRBORNE = new Set(['82', '101', '517']); // 18.5
export const ARMY = (u: Unit): number | undefined => (u.ech ? ZONE[u.ech] : undefined);
export const bulgeSources = (g: Game, side: Side) =>
  g.inPlay && g.opts.scenario === 'intro'
    ? new Set(g.inPlay.filter((a) => allNeighbors(a).some((n) => !g.inPlay!.includes(n)) || EDGE_INTRO.includes(a))) // 24.36 any area at the edge of the play area
    : new Set(
        Object.values(CUR.entries)
          .filter((e) => sideOf(e.side) === side && (!g.supplyOnly || g.inPlay!.includes(e.area) || g.supplyOnly.includes(e.area)))
          .map((e) => e.area),
      );
/** The Bulge's supply path step, by the latest series rules (Golan '73 rulebook, 9.31): through friendly-controlled areas (contested ones too, 9.31c),
 *  never over a blown bridge except from the first area (9.31a). The Bulge's own book had a further 9.31c (no vacant area next to uncontested enemy units): dropped. */
export function bulgeSupplyStep(g: Game, _side: Side, a: number, n: number, first: boolean) {
  return !(g.blown.includes(keyOf(a, n)) && !first);
}
/** 4.1b-c: the Used Box goes back to the cup (German artillery attrition first, 16.12). */
/** 16.12 (Cold Shoulder P.6: turns 5+): the German player eliminates one regular artillery asset of his choice from the Used Box; true while he has to choose. */
export function bulgeBeforeRecycle(g: Game, side: Side) {
  if (side !== 'german' || (g.opts.scenario === 'cold' && g.turn < 5)) return false;
  const arts = boxOf(g, side, 'used').filter((c) => c.kind === 'artillery');
  if (arts.length > 1) {
    g.artyPick = true;
    say(g, 'German artillery attrition: the German player chooses which artillery asset in the Used Box is eliminated (16.12)');
    return true;
  }
  if (arts.length === 1) {
    arts[0].box = 'eliminated';
    say(g, `German artillery attrition: ${arts[0].name} eliminated, the only one in the Used Box (16.12)`);
  }
  return false;
}
/** 16.12: the German player's choice of the artillery asset lost to attrition; the rest of the Used Box then goes to the cup. */
export function chooseArtyLoss(g: Game, id: string) {
  if (!g.artyPick) throw new Error('no artillery attrition pending');
  const c = chit(g, id);
  if (c.side !== 'german' || c.kind !== 'artillery' || c.box !== 'used')
    throw new Error('pick a regular German artillery asset in the Used Box (not rocket artillery)');
  c.box = 'eliminated';
  g.artyPick = false;
  say(g, `German artillery attrition: ${c.name} eliminated (16.12)`, 'german');
  recycleUsed(g, 'german', true);
}
export function placeTaskForce(g: Game, id: string, area: number) {
  const c = chit(g, id);
  if (g.phase !== 'reinforcement' || !g.tfNew.includes(id) || c.box !== 'available') throw new Error('task force cannot be placed now');
  if (g.control[area] !== 'allied' || contested(g, area) || !inSupply(g, 'allied', area))
    throw new Error('needs a supplied, friendly-controlled, uncontested area');
  c.box = 'map';
  g.tfNew = g.tfNew.filter((x) => x !== id);
  g.units.push({
    id: `TF-${id}`,
    name: `Task Force (${areas.get(area)!.name})`,
    side: 'allied',
    cls: 'infantry',
    q: ['green'],
    max: 1,
    str: 1,
    area,
    garrison: true,
    disorder: 0,
    unsupplied: false,
    moved: true,
    reserve: null,
    exploit: false,
    ech: 'us_sr',
    chitId: id,
  });
  say(g, `Task Force placed in ${areas.get(area)!.name}`, 'allied');
}

/* ================= reserves ================= */
export const bulgeMarkerKey = (_g: Game, u: Unit) => (u.side === 'german' ? `z${zoneOf(u.area!)}` : zoneOf(u.area!) === 7 ? 'z7' : 'z56');

/* ================= movement ================= */
const fuelChits = (g: Game) => boxOf(g, 'german', 'available').filter((c) => c.kind === 'fuel');
/** Where a Bulge unit can get to (movement.ts): army boundaries, fuel, roadblocks, von der Heydte, interdiction. */
export function bulgeReach(g: Game, u: Unit, one: boolean): Opt[] {
  const enemy = other(u.side),
    occ = (a: number) => ({ german: blocks(g, a, 'german').length, allied: blocks(g, a, 'allied').length });
  const garr = new Set(
    g.units.filter((x) => x.garrison && x.side === enemy && x.area != null && !blocks(g, x.area, enemy).length).map((x) => x.area!),
  );
  const r = reachable(
    {
      side: u.side as 'german' | 'allied',
      cls: u.cls,
      area: u.area!,
      supplied: !u.unsupplied,
      disordered: u.disorder > 0,
      adjacentOnly: one || !!u.adjOnly,
      spent: u.spent,
      ownZone: one ? undefined : (ARMY(u) as 5 | 6 | 7 | undefined),
      boundaryPreauthorized: u.bcross,
    },
    {
      occupants: occ,
      blownBridges: new Set(g.blown),
      roadblocks: new Set([...garr, ...markerAreas(g, enemy)]),
      enemyAssets: (a) => garr.has(a),
      controller: (a) => g.control[a] as 'german' | 'allied' | undefined,
      extraCost: (f, t) =>
        (markerAreas(g, enemy).includes(t) ? 1 : 0) +
        (unitsIn(g, t).length && !blocks(g, t, 'german').length && !blocks(g, t, 'allied').length ? 1 : 0) +
        (u.side === 'german' ? (g.interdicted[f] ? 1 : 0) + (g.interdicted[t] ? 1 : 0) : 0),
    },
  ); // 17.21: +1 to enter and +1 to leave
  return r.filter(
    (x) => !(u.side === 'german' && x.fuel && g.opts.fuel && !fuelChits(g).length && !(g.moving?.id === u.id && g.moving.fuel)),
  ); // 16.13
}
/** 17.11 Greif interdict: the unit rolls morale before it moves; failing, it may only move one area. */
export function bulgeBeforeMove(g: Game, u: Unit, opt: Opt) {
  if (u.interdict && !interdictCheck(g, u) && opt.path.length > 2) {
    u.adjOnly = true;
    return 'interdict';
  }
}
/** Fuel (16.13), KG Peiper (18.3), Greif bridges taken (17.12), von der Heydte relieved and the paradrop result (16.11). */
export function bulgeAfterMove(g: Game, u: Unit, opt: Opt) {
  if (u.side === 'german' && opt.fuel && g.opts.fuel) {
    const f = fuelChits(g).sort((x, y) => +!!y.bid - +!!x.bid)[0];
    if (f) {
      f.box = f.bid ? 'eliminated' : 'used';
      say(g, `${f.bid ? 'bid ' : ''}fuel asset spent for ${u.name}${f.bid ? ' (eliminated, 18.2)' : ''}`);
    }
  }
  if (u.peiperFull) {
    u.peiperFull = false;
    if (!g.peiperUsed) say(g, 'KG Peiper uses its full movement allowance (18.3)');
    g.peiperUsed = true;
  }
  if (u.side === 'german')
    for (let i = 1; i < opt.path.length; i++) {
      const k = keyOf(opt.path[i - 1], opt.path[i]);
      if (g.greif[k]) {
        chit(g, g.greif[k]).box = 'eliminated';
        delete g.greif[k];
        say(g, 'Greif Team Bridge: the bridge is taken');
      }
    }
  const hd = unitsIn(g, opt.area).find((x) => x.heydte);
  if (hd && u.side === 'german') {
    chit(g, hd.chitId!).box = 'used';
    hd.area = null;
    hd.str = 0;
    say(g, 'von der Heydte is relieved and becomes a regular battle asset');
  }
  paradropReveal(g, opt.area, u, opt.cost);
}
/** Strategic movement (5.4, 14.8): supplied reserve units, any friendly-controlled supplied area reachable over road/field links without blown bridges or enemy areas. */
export function clearInterdict(g: Game, u: Unit) {
  if (u.interdict) {
    chit(g, u.interdict).box = 'eliminated';
    u.interdict = undefined;
    say(g, `${u.name}: interdict marker removed (Special Action movement)`);
  }
}
export function dropGreif(g: Game, k: string) {
  if (g.greif[k]) {
    chit(g, g.greif[k]).box = 'eliminated';
    delete g.greif[k];
  }
}
/** The Bulge: one German strat-move per phase and it costs fuel (16.13); never across the restricted boundary; not through an interdicted area (17.2). */
export const bulgeStratAllowed = (g: Game, u: Unit) =>
  !(u.side === 'german' && (g.stratMoves >= 1 || (g.opts.fuel && !fuelChits(g).length)));
export const bulgeStratStep = (g: Game, u: Unit, a: number, n: number): boolean | 'end' =>
  connection(a, n)!.restricted ? false : u.side === 'german' && g.interdicted[n] ? 'end' : true;
export const bulgeAfterStrat = (g: Game, u: Unit) => {
  if (u.side === 'german') {
    g.stratMoves++;
    if (g.opts.fuel) {
      const f = fuelChits(g).sort((x, y) => +!!y.bid - +!!x.bid)[0];
      f.box = f.bid ? 'eliminated' : 'used';
    }
  }
}; // 18.2 bid fuel first, eliminated
/** 14.43: the British operate only northwest of the Meuse, from area 57 in the north to area 96 in the west (areas on that side of the Meuse in the hand-drawn map). */
export const BRITISH_AREAS = new Set([57, 58, 78, 79, 92, 93, 94, 95, 96]);
export const britishOk = (u: Unit, a: number) => u.ech !== 'br_xxx' || BRITISH_AREAS.has(a);
export const ARMY_ECH: Record<number, string> = { 5: 'de_5pz', 6: 'de_6pz', 7: 'de_7a' };

/* ================= Bulge events (17.11, 17.12, 17.14, 16.11) and unit field works (5.23) ================= */
export function playGreifBridge(g: Game, id: string, a: number, b: number) {
  needAdmin(g, chit(g, id).side);
  const c = chit(g, id),
    k = keyOf(a, b),
    cn = connection(a, b);
  if (c.kind !== 'event_greif_bridge' || c.box !== 'available' || !cn?.river || g.blown.includes(k) || g.greif[k])
    throw new Error('needs an intact bridge on a river boundary');
  g.greif[k] = id;
  c.box = 'map';
  say(g, `Greif Team Bridge placed on ${areas.get(a)!.name}–${areas.get(b)!.name}`, 'german');
}
export function playInterdict(g: Game, id: string, unitId: string) {
  needAdmin(g, chit(g, id).side);
  const c = chit(g, id),
    u = g.units.find((x) => x.id === unitId)!;
  if (
    c.kind !== 'event_greif_interdict' ||
    c.box !== 'available' ||
    u.side !== 'allied' ||
    u.ech === 'br_xxx' ||
    u.area == null ||
    u.garrison ||
    u.interdict
  )
    throw new Error('needs an American block without an interdict marker (17.11)');
  u.interdict = id;
  c.box = 'map';
  say(g, `Greif Team Interdict placed on ${u.name}`, 'german');
}
/** 17.11: when the unit next tries to move, build field works or take a reserve marker it rolls morale with +2; on failure it only stays or moves one area. */
export function interdictCheck(g: Game, u: Unit) {
  const { r, ok } = check(
    g,
    u,
    moraleSn(quality(u), u.disorder > 0, u.unsupplied && !(g.opts.airborne && AIRBORNE.has(u.name))) + 2,
    'Greif interdict morale check (17.11)',
  );
  chit(g, u.interdict!).box = 'eliminated';
  u.interdict = undefined;
  say(g, `Greif interdict: ${u.name} morale check rolled ${r} → ${ok ? 'passed, no effect' : 'failed'}`);
  return ok;
}
export function playBodenplatte(g: Game, id: string) {
  needAdmin(g, chit(g, id).side);
  const c = chit(g, id);
  if (c.kind !== 'event_bodenplatte' || c.box !== 'available') throw new Error('not available');
  for (const m of boxOf(g, 'allied', 'available').filter((x) => x.kind === 'air_mission')) {
    const r = roll(g); // Player Aid D: 1-5 unaffected, 6-9 delayed (back to the cup), 10 eliminated
    if (r === 10) m.box = 'eliminated';
    else if (r >= 6) m.box = 'cup';
    say(
      g,
      `Bodenplatte vs ${m.name} T${m.turn}: rolled ${r} → ${r === 10 ? 'eliminated' : r >= 6 ? 'delayed (back to the cup)' : 'unaffected'}`,
    );
  }
  c.box = 'eliminated';
}
export const heydteWindow = (g: Game, c: Chit) =>
  c.name === 'v.d. Heydte' &&
  c.box === 'available' &&
  g.phase === 'admin' &&
  (c.firstDrawn ?? c.drawn) === g.turn * 10 + (g.phasing === 'german' ? 1 : 2) &&
  !g.units.some((u) => u.heydte);
export function heydteDrop(g: Game, id: string, area: 31 | 52) {
  needAdmin(g, chit(g, id).side);
  const c = chit(g, id);
  if (!heydteWindow(g, c) || unitsIn(g, area).length || g.control[area] !== 'allied')
    throw new Error('the drop zone must be vacant and Allied-controlled, in the Admin Phase the asset was drawn');
  c.box = 'map';
  g.units.push({
    id: 'HEYDTE',
    name: 'v.d. Heydte',
    side: 'german',
    cls: 'infantry',
    q: ['veteran'],
    max: 1,
    str: 1,
    area,
    garrison: true,
    disorder: 0,
    unsupplied: false,
    moved: true,
    reserve: null,
    exploit: false,
    ech: 'de_sr',
    chitId: id,
    paradrop: 'pending',
    heydte: true,
  });
  say(g, `von der Heydte drops near ${areas.get(area)!.name} (not yet located)`);
}
/** 16.11: the first American unit to enter the drop area finds out how the paradrop went. */
function paradropReveal(g: Game, area: number, mover: Unit, cost: number) {
  const h = unitsIn(g, area).find((x) => x.paradrop === 'pending');
  if (!h || mover.side !== 'allied') return;
  const r = roll(g);
  if (r === 1) {
    h.paradrop = 'intact';
    say(g, `paradrop result ${r}: von der Heydte landed intact and holds ${areas.get(area)!.name}`);
  } else if (r <= 5) {
    h.paradrop = 'partial';
    say(g, `paradrop result ${r}: partly scattered, it will not fire back`);
  } else {
    say(g, `paradrop result ${r}: completely scattered`);
    eliminate(g, h);
    if (!blocks(g, area, 'german').length && !g.roadblocks[area]) {
      mover.moved = false;
      mover.spent = cost;
    }
  } // the unit may move on
}
/** The Bulge's asset rules: supply, army zones and Higher Echelons (6.22, 6.23, 16.1, 16.12, 16.23, 14.62b, 4.35), one Allied Air Mission. */
export function bulgeCanAssign(g: Game, b: Battle, side: Side, c: Chit): string | null {
  if (c.kind === 'air_mission') {
    if (side !== 'allied') return 'Allied only';
    if (unitsIn(g, b.area, side).every((u) => u.garrison))
      return 'a garrison, Task Force or defended roadblock fighting alone gets no events (4.35, 16.21)';
    return b.air.allied ? 'one air mission per battle' : null;
  } // 17.21: unsupplied and air-supplied areas allowed   // 17.21: unsupplied areas allowed
  if (c.kind === 'task_force') return 'a Task Force is placed in the Reinforcement Phase, not assigned to battles (16.22)';
  if (unitsIn(g, b.area, side).some((u) => u.unsupplied) || !inSupply(g, side, b.area))
    return 'units that cannot trace supply may not have assets (9.34a)';
  if (airSup(g).some((s) => s.area === b.area && s.side === side)) return 'air-supplied units may not have assets (9.34a)';
  const lim = assetLimits(g, b, side),
    cur = b.assets[side].map((x) => chit(g, x)),
    att = side === b.attacker,
    dr = unitsIn(g, b.area, side).find((x) => x.id.startsWith('DR-') || x.heydte);
  if (dr && (!isArty(c) || c.ech !== dr.ech || cur.length >= 1))
    return 'a defended roadblock gets one artillery asset of its own Higher Echelon (4.35)';
  if (side === 'german' && c.ech !== 'de_sr' && ZONE[c.ech] !== zoneOf(b.area))
    return "German assets act only in their own army's zone (16.1)";
  const armies = new Set(cur.filter((x) => x.ech !== 'us_sr').map((x) => x.ech));
  const echOk2 =
    c.ech === 'us_sr' ||
    (side === 'german' && c.ech === 'de_sr') ||
    lim.pure.includes(c.ech) ||
    (lim.pooled && c.ech.startsWith('us_')) ||
    (side === 'allied' && lim.pure.length === 0 && (armies.size === 0 || armies.has(c.ech)));
  if (!echOk2) return 'asset belongs to a different Higher Echelon';
  if (isArty(c) && unitsIn(g, b.area, side).every((x) => x.heydte)) return 'von der Heydte receives no artillery support';
  if (isArty(c)) {
    const arts = cur.filter(isArty),
      cap = lim.mixed ? (att ? lim.pure.length : 1) : lim.arty;
    if (arts.length >= cap) return `at most ${cap} artillery asset(s) here`;
    if (lim.mixed && att && arts.some((x) => x.ech === c.ech)) return 'only one artillery asset per involved Higher Echelon';
    if (side === 'german' && arts.length >= 1 && (arts[0].kind === c.kind || arts[0].ech !== c.ech))
      return 'two German artillery assets need one regular and one rocket asset of the same army (16.12)';
    return null;
  }
  if (isBattleAsset(c)) {
    if (!lim.battle) return 'battle assets need units of one Higher Echelon';
    const cap = att ? 8 : 5;
    return cur.filter(isBattleAsset).length >= cap
      ? `at most ${cap} battle assets for the ${att ? 'Attacker' : 'Defender'} (${att ? '6.22' : '6.23'})`
      : null;
  }
  return 'this chit cannot be assigned to a battle';
}
/** 18.4: the 150th Panzer Brigade's first battle, if it is in this one. */
export const pz150In = (g: Game, b: Battle) =>
  g.opts.pz150 && !g.pz150Done ? g.units.find((u) => u.name === '150 Pz' && u.area === b.area && u.str > 0) : undefined;
/** 18.4: after artillery has fired on both sides, if the 150th survived, the American point unit checks morale with +2; failing, it is disordered (a defended roadblock is eliminated and an exploitation opportunity arises). */
export function pz150Check(g: Game, b: Battle) {
  const pz = g.units.find((u) => u.id === b.pz150);
  b.pz150 = undefined;
  if (!pz || pz.area !== b.area || pz.str <= 0) return say(g, '150th Panzer Brigade did not survive the artillery fire: no effect (18.4)');
  const am = point(g, b, other(pz.side));
  if (!am || am.area !== b.area) return;
  if (am.disorder > 0) return say(g, `150th Panzer Brigade: ${am.name} is already disordered, no effect (18.4)`);
  const { r, ok } = check(
    g,
    am,
    moraleSn(quality(am), false, am.unsupplied && !(g.opts.airborne && AIRBORNE.has(am.name))) + 2,
    '150th Panzer Brigade confusion (18.4)',
  );
  b.rolls.push({
    who: `${am.name}: morale +2 (18.4)`,
    sn: moraleSn(quality(am), false, am.unsupplied) + 2,
    dice: [r],
    hits: ok ? 1 : 0,
    kind: 'morale',
  });
  if (ok) return say(g, `150th Panzer Brigade: ${am.name} passes its morale check (rolled ${r}), no effect (18.4)`);
  if (am.id.startsWith('DR-') || am.heydte) {
    say(g, `150th Panzer Brigade: the defended roadblock fails its morale check (rolled ${r}) and is eliminated (18.4)`);
    eliminate(g, am);
    b.exploit = pz.side === b.attacker;
  } else {
    am.disorder = 1;
    say(g, `150th Panzer Brigade: ${am.name} fails its morale check (rolled ${r}) and is disordered (18.4)`);
  }
}
/** The Bulge's morale check: quality, disorder, supply (18.5: airborne units ignore the unsupplied modifier); a supply check always counts as unsupplied. */
export const bulgeMoraleSn = (g: Game, u: Unit, why: 'exploit' | 'supply' | 'check') =>
  moraleSn(quality(u), u.disorder > 0, (why === 'supply' || u.unsupplied) && !(g.opts.airborne && AIRBORNE.has(u.name)));
/** 14.1: armor never crosses the restricted boundary (Schnee Eifel), not even to retreat. */
export const bulgeRetreatOk = (_g: Game, u: Unit, from: number, to: number) => !(u.cls === 'armor' && connection(from, to)?.restricted);
/** 18.3: Peiper, exploiting in a Breakthrough Movement Phase on or before turn 3, may move with its full allowance once per game. */
export const peiperCan = (g: Game, u: Unit) =>
  !!g.opts.peiper &&
  !g.peiperUsed &&
  g.phase === 'btMove' &&
  g.turn <= 3 &&
  u.name === 'Peiper' &&
  u.exploit &&
  !u.moved &&
  u.area != null &&
  u.side === g.phasing;
export function setPeiperFull(g: Game, unitId: string, on: boolean) {
  const u = g.units.find((x) => x.id === unitId)!;
  if (on && !peiperCan(g, u))
    throw new Error('KG Peiper (18.3): only once, exploiting in a Breakthrough Movement Phase on or before turn 3');
  u.peiperFull = on || undefined;
}
/** The Bulge's Supply Phase extras: the Air Supply mission expires (17.2), field works may be maintained (18.8), pooled assets and interdiction end (14.62b, 17.2), boundary-crossing leave ends, and von der Heydte checks supply (16.11). */
export function bulgeSupplyHook(g: Game, phase: string, when: string) {
  if (phase === 'admin' && when === 'start') {
    g.greifTried = [];
    return;
  }
  if (phase !== 'supply') return;
  if (when === 'start') {
    const stamp = g.turn * 2 + (g.phasing === 'german' ? 0 : 1);
    for (const s of (g.airSupplies ?? []).filter((x) => x.stamp < stamp)) chit(g, s.id).box = 'eliminated';
    g.airSupplies = (g.airSupplies ?? []).filter((x) => x.stamp >= stamp);
    if (g.airSupply && g.airSupply.stamp < stamp) {
      chit(g, g.airSupply.id).box = 'eliminated';
      g.airSupply = null;
    }
  }
  if (when === 'mid') {
    g.pooled = null;
    for (const [, id] of Object.entries(g.interdicted)) chit(g, id).box = 'eliminated';
    g.interdicted = {};
    g.units.forEach((x) => {
      if (x.side === g.phasing) x.bcross = false;
    });
  }
  if (when === 'end')
    for (const h of g.units.filter((x) => x.heydte && x.area != null && g.turn >= 4 && x.side === g.phasing))
      if (!inSupply(g, 'german', h.area!)) {
        const { r, ok } = check(g, h, moraleSn('veteran', false, true), 'von der Heydte out of supply (16.11)');
        if (!ok) {
          say(g, `von der Heydte out of supply, morale failed (${r}): eliminated`);
          eliminate(g, h);
        }
      }
}
/** The Bulge's scenario results: the Introductory and Cold Shoulder sheets, else the Tournament or Campaign table. */
export const bulgeFinal = (g: Game, net: number) =>
  g.opts.scenario === 'intro' ? introResult(g) : g.opts.scenario === 'cold' ? coldResult(g) : finalResult(g, net);
/** 24.37: uncontested control of Bastogne wins outright; otherwise strength points in Bastogne, the German losing 2 per key area he does not control. */
export function introResult(g: Game) {
  const b = 47,
    c = contested(g, b);
  if (!c && g.control[b]) return `${g.control[b] === 'german' ? 'German' : 'Allied'} Decisive Victory (uncontested Bastogne)`; // control decides, even with nobody left in the town
  const pts = (s: Side) =>
    unitsIn(g, b, s)
      .filter((u) => !u.garrison)
      .reduce((t, u) => t + u.str, 0);
  const ge = pts('german') - 2 * [39, 36, 48, 63, 64].filter((a) => g.control[a] !== 'german').length,
    al = pts('allied');
  return `${ge > al ? 'German' : 'Allied'} Marginal Victory (German ${ge}, Allied ${al})`;
}
/** P.7 Cold Shoulder: German-controlled Zone 6 areas at the end of turn 9. */
export function coldResult(g: Game) {
  const n = coldAreas(g);
  return `${n >= 11 ? 'German Victory' : n === 10 ? 'Draw' : 'Allied Victory'} (${n} Zone 6 areas German)`;
}
