// What the players do with their chits outside battle: Special Actions (8.1), engineers (bridges 14.5, field works 5.23), replacements and rebuilds, rally, the alternate use (4.21), Command Staff (8.3), roadblocks (4.34), the air missions (17.2), and a morale check.
import { areas, connection, neighbors, zoneOf } from './map';
import { succeeds } from './dice';
import { isAsset, ZONE, type Chit, type Side } from './chits';
import { CUR } from './volumes';
import { ARMY, ARMY_ECH, dropGreif, interdictCheck } from './vol/bulge';
import { entryOpen, listedEntries } from './reinforce';
import {
  airSupplied,
  appropriateAreas,
  blocks,
  boxOf,
  chit,
  contested,
  dropReserve,
  endMove,
  type Game,
  helpless,
  inSupply,
  keyOf,
  other,
  roll,
  say,
  setReserve,
  type Unit,
  unitsIn,
} from './game';

/* ================= special actions & admin ================= */
/** 8.1: an event helps its own Higher Echelon; The Bulge's Strategic Reserve units use the events of the army whose zone they stand in (15.1c), and a German event works only in its army's zone (17.1). */
const saMatch = (c: Chit, e: string | undefined, area?: number) =>
  (!c.ech || !e || c.ech === e || c.ech === 'us_sr' || e === 'us_sr' || (e === 'de_sr' && c.side === 'german')) &&
  (area == null || c.side !== 'german' || c.ech === 'german' || ZONE[c.ech] === zoneOf(area));
export function saAvailable(g: Game, side: Side, ech?: string | string[], area?: number) {
  const blk = boxOf(g, side, 'available').find((c) => c.kind === 'sa_block'),
    echs = ech == null ? [] : Array.isArray(ech) ? ech : [ech];
  const ev = boxOf(g, side, 'available').filter(
    (c) =>
      c.kind === 'special_action_event' && (!echs.length ? area == null || saMatch(c, c.ech, area) : echs.some((e) => saMatch(c, e, area))),
  );
  const list = [...(blk ? [blk] : []), ...ev];
  return CUR.saFilter ? CUR.saFilter(g, side, list, echs[0]) : list;
}
/** Spend a Special Action: the one the player chose (`chitId`), or else the first that fits (the reusable block first). */
export function spendSA(g: Game, side: Side, ech?: string | string[], why = 'Special Action', chitId?: string, area?: number) {
  const ok = saAvailable(g, side, ech, area),
    c = chitId ? ok.find((x) => x.id === chitId) : ok[0];
  if (!c)
    throw new Error(
      chitId
        ? 'that Special Action cannot be used for this unit (8.1: an event only helps its own Higher Echelon)'
        : 'no Special Action available',
    );
  c.box = c.kind === 'sa_block' ? 'used' : 'eliminated';
  say(g, `${side} spends ${c.kind === 'sa_block' ? 'the reusable Special Action' : 'a Special Action event'}: ${why}`, side);
  CUR.onSpendSA?.(g, side, c);
  return c;
}
/** 4.2b/c: in the Admin Phase the phasing player acts first; once he is done (g.done), the other player acts and ends the phase. */
export const adminActor = (g: Game): Side => (g.done?.includes(g.phasing) ? other(g.phasing) : g.phasing);
export const needAdmin = (g: Game, side?: Side) => {
  if (g.phase !== 'admin') throw new Error('only in the Admin Phase');
  if (side && side !== adminActor(g))
    throw new Error(
      side === g.phasing ? 'your part of the Admin Phase is over (4.2b)' : 'the phasing player acts first; you act once he is done (4.2c)',
    );
};
export const suppliedArea = (g: Game, side: Side, a: number) => g.control[a] === side && inSupply(g, side, a) && !contested(g, a);
export const supplied = (g: Game, side: Side, a: number) =>
  g.control[a] === side && inSupply(g, side, a) && !contested(g, a) && !airSup(g).some((s) => s.area === a && s.side === side); // 9.34d: no engineering for an air-supplied area
export const assetZoneOk = (g: Game, c: Chit, a: number, bridging = false) =>
  CUR.id !== 'bulge' ||
  c.side === 'allied' ||
  c.ech === 'de_sr' ||
  c.ech === 'german' ||
  ZONE[c.ech] === zoneOf(a) ||
  (bridging &&
    c.kind === 'engineer' &&
    !g.chits.some((x) => x.kind === 'engineer' && x.ech === ARMY_ECH[zoneOf(a)] && x.box !== 'eliminated')); // 14.52 an army that lost its engineer may borrow another   // 16.1 German assets/events act only in their own army's zone
export function bridgeTargets(g: Game, side: Side, area: number) {
  return neighbors(area).filter(
    (n) =>
      connection(area, n)!.river &&
      !g.blown.includes(keyOf(area, n)) &&
      !(g.greif[keyOf(area, n)] && g.greifTried.includes(keyOf(area, n))) &&
      supplied(g, side, area),
  ); // 17.12: one try per Admin Phase on a Greif bridge
}
export function blowBridges(g: Game, id: string, area: number, targets: number[]) {
  needAdmin(g, chit(g, id).side);
  const c = chit(g, id);
  if (c.kind !== 'engineer' || c.box !== 'available') throw new Error('engineer not available');
  if (
    !assetZoneOk(g, c, area, true) ||
    !bridgeTargets(g, c.side, area).length ||
    targets.length < 1 ||
    targets.length > 2 ||
    !targets.every((t) => bridgeTargets(g, c.side, area).includes(t))
  )
    throw new Error('not a legal bridge-blowing');
  c.box = 'used';
  for (const t of targets) {
    const k = keyOf(area, t);
    if (g.greif[k]) {
      if (g.greifTried.includes(k)) {
        say(g, 'the Greif-held bridge was already tried this Admin Phase');
        continue;
      }
      const r = roll(g);
      g.greifTried.push(k);
      if (r > 5) {
        say(g, `engineer fails to blow the Greif-held bridge (rolled ${r})`);
        continue;
      }
      say(g, `engineer blows the Greif-held bridge (rolled ${r})`);
    }
    g.blown.push(k);
    dropGreif(g, k);
  }
  say(g, `${c.name} works on ${targets.length} bridge(s) from ${areas.get(area)!.name}`, c.side);
}
export function repairTargets(g: Game, side: Side, area: number) {
  if (!supplied(g, side, area)) return [];
  return neighbors(area).filter(
    (n) => g.blown.includes(keyOf(area, n)) && (g.control[n] === side || (g.control[n] === other(side) && contested(g, n))),
  );
}
export function repairBridge(g: Game, id: string, area: number, to: number) {
  needAdmin(g, chit(g, id).side);
  const c = chit(g, id);
  if (c.kind !== 'engineer' || c.box !== 'available' || !assetZoneOk(g, c, area, true) || !repairTargets(g, c.side, area).includes(to))
    throw new Error('not a legal repair');
  if (c.side === 'german' && g.opts.bridgeLimit && (g.bridgesLeft ?? 6) <= 0)
    throw new Error('the Germans have repaired their six bridges (18.1)');
  if (c.side === 'german' && g.opts.bridgeLimit) g.bridgesLeft = (g.bridgesLeft ?? 6) - 1;
  g.blown = g.blown.filter((k) => k !== keyOf(area, to));
  c.box = 'used';
  say(
    g,
    `${c.name} repairs the bridge ${areas.get(area)!.name}–${areas.get(to)!.name}${c.side === 'german' && g.opts.bridgeLimit ? ` (German repairs left: ${g.bridgesLeft}, 18.1)` : ''}`,
    c.side,
  );
}
export function fieldWorksFor(g: Game, id: string, area: number) {
  needAdmin(g, chit(g, id).side);
  const c = chit(g, id);
  const same = blocks(g, area, c.side).some((u) => u.ech === c.ech || c.ech === 'us_sr' || u.ech === 'us_sr');
  if (
    c.kind !== 'engineer' ||
    c.box !== 'available' ||
    !supplied(g, c.side, area) ||
    !same ||
    g.fieldWorks.includes(area) ||
    !assetZoneOk(g, c, area)
  )
    throw new Error("needs a supplied, uncontested area holding a unit of the engineer's echelon");
  g.fieldWorks.push(area);
  g.fwOwner[area] = c.side;
  c.box = 'used';
  say(g, `${c.name} builds field works in ${areas.get(area)!.name}`, c.side);
}
function addStep(g: Game, u: Unit, elite: boolean) {
  const nq = u.q[u.str];
  if (u.fort) throw new Error('strongpoints never receive replacement steps (15.6)');
  if (u.str >= u.max || helpless(g, u) || (!elite && nq === 'elite')) throw new Error('that unit cannot receive a step');
  u.str++;
}
export function eligibleForStep(c: Chit, u: Unit, g?: Game) {
  if (c.kind === 'event_arriving_regiment' && u.side === c.side && u.area == null && u.str === 0 && !u.garrison)
    return u.name === `${parseInt(c.division ?? '')} Inf`; // 17.23 brings an eliminated division back
  if (u.side !== c.side || u.area == null || u.garrison || u.fort || u.unsupplied || (g && airSupplied(g, u)) || u.str >= u.max)
    return false;
  if (c.kind !== 'event_arriving_regiment' && u.q[u.str] === 'elite') return false; // 17.31, 17.32: never the elite step
  const arm = c.kind === 'replacement_arm' || c.kind === 'rebuild_or_replace_arm',
    inf = c.kind === 'replacement_inf' || c.kind === 'rebuild_or_replace_inf';
  if (c.kind === 'event_arriving_regiment') return u.name === `${parseInt(c.division ?? '')} Inf`;
  if (arm && u.cls !== 'armor') return false;
  if (inf && u.cls !== 'infantry') return false;
  if (c.ech === 'de_sr' || c.ech === 'us_sr') return true;
  if (c.side === 'german' && ZONE[c.ech] !== zoneOf(u.area)) return false;
  return u.ech === c.ech || u.ech === 'us_sr' || (c.side === 'german' && u.ech === 'de_sr'); // 15.1c: plus the Strategic Reserve units
}
/** 17.23: the appropriate friendly-controlled entry areas an eliminated division comes back to. */
export const regimentAreas = (g: Game, unitId: string) => {
  const u = g.units.find((x) => x.id === unitId)!;
  return [...new Set([...listedEntries(u), ...appropriateAreas(u, g)])].filter((a) => g.control[a] === u.side && entryOpen(g, u, a));
};
export function playReplacement(g: Game, id: string, unitId: string, area?: number) {
  needAdmin(g, chit(g, id).side);
  const c = chit(g, id),
    u = g.units.find((x) => x.id === unitId)!;
  if (c.box !== 'available' || !eligibleForStep(c, u, g)) throw new Error('that unit is not eligible');
  if (u.area == null) {
    // 17.23: back into play with one step in a free friendly entry area of the player's choice
    const ok = regimentAreas(g, unitId),
      to = area ?? ok[0];
    if (to == null || !ok.includes(to)) throw new Error('no free friendly-controlled entry area for it there (17.23)');
    u.str = 1;
    u.area = to;
    u.disorder = 0;
    u.unsupplied = false;
    g.control[to] = u.side;
    g.elimLarge = g.elimLarge.filter((x) => x !== u.id);
    c.box = 'eliminated';
    return say(g, `${c.name}: ${u.name} returns in ${areas.get(to)!.name} with 1 step`, c.side);
  }
  addStep(g, u, c.kind === 'event_arriving_regiment');
  c.box = 'eliminated';
  say(g, `${c.name}: ${u.name} gains a step (${u.str}/${u.max})`, c.side);
}
export function playRebuild(g: Game, id: string, unitId: string, area: number) {
  needAdmin(g, chit(g, id).side);
  const c = chit(g, id),
    u = g.units.find((x) => x.id === unitId)!;
  const arm = c.kind === 'rebuild_or_replace_arm';
  const ownArmy = c.ech === 'us_sr' || c.ech === 'de_sr' || u.ech === c.ech || u.ech === 'us_sr' || u.ech === 'de_sr'; // 17.2: its own Army's units
  if (
    !c.kind.startsWith('rebuild') ||
    c.box !== 'available' ||
    u.area != null ||
    u.str !== 0 ||
    !ownArmy ||
    u.max !== 1 ||
    u.side !== c.side ||
    u.q[0] === 'elite' ||
    arm !== (u.cls === 'armor') ||
    g.control[area] !== c.side ||
    !(areas.get(area)!.vp.allied || areas.get(area)!.vp.mutual || areas.get(area)!.vp.german)
  )
    throw new Error('cannot return that unit there');
  u.area = area;
  u.str = 1;
  c.box = 'eliminated';
  say(g, `${u.name} returns to ${areas.get(area)!.name}`, c.side);
}
/** 4.21: the eliminated assets an event may bring back (never garrisons, Task Forces or bid fuel: 16.21, 16.22, 18.2). */
export const alternateCandidates = (g: Game, side: Side) =>
  boxOf(g, side, 'eliminated').filter((x) => isAsset(x) && x.kind !== 'garrison' && x.kind !== 'task_force' && !x.bid);
/** 4.21: spend an event to put two eliminated assets of the owner's choice (`ids`) back in the cup; without `ids`, a fixed priority picks them (tests). */
export function alternateUse(g: Game, id: string, ids?: string[]) {
  needAdmin(g, chit(g, id).side);
  const c = chit(g, id);
  if (c.box !== 'available' || isAsset(c) || c.kind === 'sa_block') throw new Error('not an event');
  if (CUR.saFilter && !CUR.saFilter(g, c.side, boxOf(g, c.side, 'available'), c.ech).includes(c))
    throw new Error('this event cannot be spent alone now'); // e.g. Sicily 17.11 Patton: two US events
  const pri = ['engineer', 'artillery', 'rocket_artillery', 'armor_asset', 'infantry_asset', 'fuel'],
    cands = alternateCandidates(g, c.side);
  const back = ids
    ? ids.map((x) => cands.find((y) => y.id === x)!)
    : [...cands].sort((a, b) => pri.indexOf(a.kind) - pri.indexOf(b.kind)).slice(0, 2);
  if (ids && (back.some((x) => !x) || new Set(ids).size !== ids.length || ids.length !== Math.min(2, cands.length)))
    throw new Error('choose two assets from your Eliminated Box (4.21)');
  if (!back.length) throw new Error('no assets in the Eliminated Box to bring back (4.21)');
  back.forEach((x) => (x.box = 'cup'));
  c.box = 'eliminated';
  CUR.onSpendSA?.(g, c.side, c);
  say(g, `${c.name} used as alternate event: ${back.map((x) => x.name).join(', ')} back to the cup`, c.side);
}
export function rally(g: Game, side: Side, area: number, chitId?: string) {
  needAdmin(g, side);
  if (g.control[area] !== side || !inSupply(g, side, area)) throw new Error('area must be supplied and friendly'); // 8.25: any supplied area, contested or not
  const sa = spendSA(g, side, undefined, 'Rally the troops', chitId, area),
    only = sa.kind === 'special_action_event' && sa.ech !== 'us_sr' ? sa.ech : null; // 8.1 a single-use event only affects its own Higher Echelon (17.1: a German one only in its army's zone)
  const fits = (u: Unit, a: number) =>
    !only || ((u.ech === only || u.ech === 'us_sr' || u.ech === 'de_sr') && (side !== 'german' || ZONE[only] === zoneOf(a))); // 15.1c, 15.2: plus the Strategic Reserve units
  for (const a of [area, ...neighbors(area)])
    for (const u of blocks(g, a, side)) if (u.disorder && !helpless(g, u) && fits(u, a)) u.disorder = 0;
}
export function qualityReplacement(g: Game, unitId: string, chitId?: string) {
  const u = g.units.find((x) => x.id === unitId)!;
  needAdmin(g, u.side);
  if (u.area == null || u.str < 1 || u.garrison || u.fort || helpless(g, u) || u.str >= u.max)
    throw new Error('not eligible (strongpoints never receive steps, Golan 15.6)'); // 8.26: a supplied reduced unit on the map
  spendSA(g, u.side, u.ech, 'Quality replacements', chitId, u.area!);
  u.str++;
  say(g, `${u.name} gains a step`, u.side);
}
export function staffReplacement(g: Game, id: string, unitId: string) {
  needAdmin(g, chit(g, id).side);
  const c = chit(g, id),
    u = g.units.find((x) => x.id === unitId)!;
  if (
    c.kind !== 'command_staff' ||
    c.box !== 'available' ||
    CUR.staffReplaceOk?.(g, c) === false ||
    u.side !== c.side ||
    u.cls !== 'infantry' ||
    u.area == null ||
    u.garrison
  )
    throw new Error('not eligible');
  addStep(g, u, false);
  c.box = 'used';
  say(g, `Command staff: ${u.name} gains a step`, c.side);
}
export function staffReserve(g: Game, id: string, unitId: string) {
  needAdmin(g, chit(g, id).side);
  const c = chit(g, id);
  if (c.kind !== 'command_staff' || c.box !== 'available') throw new Error('not available');
  const u = g.units.find((x) => x.id === unitId)!,
    m = u.moved;
  u.moved = false; // 8.33: any eligible unit (14.7), even one that moved in its own last breakthrough phase
  try {
    setReserve(g, unitId, true, true);
  } finally {
    u.moved = m;
  }
  c.box = 'used';
}
export function releaseUnit(g: Game, id: string, area: 4 | 6) {
  needAdmin(g, chit(g, id).side);
  const c = chit(g, id);
  if (c.kind !== 'event_release' || c.box !== 'available') throw new Error('not available');
  const nm: Record<string, string> = { '11th': '11 Pz', '10th': '10SS', '17th': '17SS', '6th': '6SS' },
    u = g.units.find((x) => x.name === nm[c.name.split(' ')[0]])!;
  if (g.inPlay && !g.inPlay.includes(area)) throw new Error('that entry area is not in play');
  if (u.area != null || blocks(g, area, 'german').length >= 2 || (g.control[area] !== 'german' && unitsIn(g, area).length))
    throw new Error('entry area blocked');
  u.area = area;
  g.control[area] = 'german';
  c.box = 'eliminated';
  say(g, `${u.name} released and enters in ${areas.get(area)!.name}`, 'german');
}
export function check(g: Game, u: Unit, sn: number, why: string) {
  const die = roll(g),
    ok = succeeds(die, sn);
  (g.checks ??= []).push({ who: u.name, why, sn, die, ok, area: u.area });
  if (g.checks.length > 30) g.checks.splice(0, g.checks.length - 30);
  return { r: die, ok };
}
export function buildFieldWorks(g: Game, id: string) {
  const u = g.units.find((x) => x.id === id)!;
  if (g.moving?.id === id) throw new Error('it has started moving: no field works (5.23)');
  if (g.moving) endMove(g);
  const ok =
    (g.phase === 'movement' && u.side === g.phasing) ||
    (g.phase === 'reaction' && u.side !== g.phasing && !!u.reserve) ||
    (g.phase === 'btMove' && u.side === g.phasing && (!!u.reserve || u.exploit));
  if (
    !ok ||
    u.moved ||
    u.area == null ||
    u.garrison ||
    u.fort ||
    u.ghost ||
    u.unsupplied ||
    u.disorder ||
    contested(g, u.area) ||
    g.fieldWorks.includes(u.area)
  )
    throw new Error('needs a supplied unit in good order that has not moved, in an uncontested area without field works');
  if (u.interdict && !interdictCheck(g, u)) {
    u.adjOnly = true;
    throw new Error('Greif interdict: morale check failed, it cannot build field works');
  }
  g.fieldWorks.push(u.area);
  g.fwOwner[u.area] = u.side;
  u.moved = true;
  dropReserve(g, u);
  u.exploit = false;
  say(g, `${u.name} builds field works in ${areas.get(u.area)!.name}`);
}

/* ================= M3: roadblocks, staff functions, air missions, reroute ================= */
const vacantSupplied = (g: Game, side: Side, a: number) =>
  (!g.inPlay || g.inPlay.includes(a)) && supplied(g, side, a) && !unitsIn(g, a).length && areas.get(a)!.tdn >= 1;
/** 4.34 / 4.35: a roadblock marker, or the engineer itself as a defended roadblock. */
export function roadblock(g: Game, id: string, area: number, defended: boolean) {
  needAdmin(g, chit(g, id).side);
  const c = chit(g, id);
  if (c.kind !== 'engineer' || c.box !== 'available' || !assetZoneOk(g, c, area) || !vacantSupplied(g, c.side, area) || g.roadblocks[area])
    throw new Error('needs a supplied, friendly, vacant area with a Terrain Difficulty Number of 1 or more');
  if (defended) {
    g.units = g.units.filter((x) => x.id !== `DR-${id}`); // the engineer's earlier roadblock (spent, area null) must not share the id
    g.units.push({
      id: `DR-${id}`,
      name: `${c.name} (defended roadblock)`,
      side: c.side,
      cls: 'infantry',
      q: [c.q ?? 'green'],
      max: 1,
      str: 1,
      area,
      garrison: true,
      disorder: 0,
      unsupplied: false,
      moved: true,
      reserve: null,
      exploit: false,
      ech: c.ech,
      chitId: id,
    });
    c.box = 'map';
  } else {
    g.roadblocks[area] = c.side;
    c.box = 'used';
  }
  say(g, `${c.name} makes a ${defended ? 'defended ' : ''}roadblock in ${areas.get(area)!.name}`, c.side);
}
export function roadblockAreas(g: Game, side: Side) {
  return [...areas.keys()].filter((a) => vacantSupplied(g, side, a) && !g.roadblocks[a]);
}
const staff = (g: Game, id: string) => {
  needAdmin(g, chit(g, id).side);
  const c = chit(g, id);
  if (c.kind !== 'command_staff' || c.box !== 'available') throw new Error('command staff not available');
  return c;
};
/** 14.62a (Germans only) */
export function staffBoundary(g: Game, id: string, unitId: string) {
  const c = staff(g, id),
    u = g.units.find((x) => x.id === unitId)!;
  if (c.side !== 'german' || u.side !== 'german' || u.area == null || u.garrison || ARMY(u) == null)
    throw new Error('needs a German unit of an army');
  u.bcross = true;
  c.box = 'used';
  say(g, `Command staff: ${u.name} may leave its army zone for free`, c.side);
}
/** 14.62b (Americans only) */
export function staffPool(g: Game, id: string, area: number) {
  const c = staff(g, id);
  if (c.side !== 'allied' || !areas.has(area)) throw new Error('Americans only');
  g.pooled = area;
  c.box = 'used';
  say(g, `Command staff: assets pooled for the battle in ${areas.get(area)!.name}`, c.side);
}
/** 8.32 */
export function staffIntel(g: Game, id: string, unitId: string) {
  const c = staff(g, id),
    u = g.units.find((x) => x.id === unitId)!;
  if (u.side === c.side || u.area == null || u.garrison) throw new Error('choose an enemy block on the map');
  g.revealed = u.id;
  c.box = 'used';
  say(g, `Intelligence: the enemy block in ${areas.get(u.area)!.name} is revealed until the end of the Admin Phase (8.32)`, c.side); // online the player only holds a stand-in: its owner publishes the real details
}
/** 17.2 Interdiction Mission (Allied air mission, Admin Phase). */
export function playInterdiction(g: Game, id: string, area: number) {
  needAdmin(g, chit(g, id).side);
  const c = chit(g, id);
  if (c.kind !== 'air_mission' || c.box !== 'available' || !areas.has(area) || g.interdicted[area])
    throw new Error('needs an Air Mission in the Available Box and a free area');
  g.interdicted[area] = id;
  c.box = 'map';
  say(g, `Interdiction mission over ${areas.get(area)!.name}`, c.side);
}
/** 17.2 Air Supply Mission: one unsupplied area, played during a Supply Phase (here: the step before it runs). */
/** The Air Supply missions in force: The Bulge keeps a list (one area each, 17.21), Sicily one at a time (16.34). */
export const airSup = (g: Game) => [...(g.airSupplies ?? []), ...(g.airSupply ? [g.airSupply] : [])];
export function airSupplyAreas(g: Game, side: Side) {
  return [
    ...new Set(
      g.units
        .filter((u) => u.side === side && u.area != null && (!u.garrison || /^(G|TF-)/.test(u.id)) && !inSupply(g, side, u.area))
        .map((u) => u.area!),
    ),
  ].filter((a) => !airSup(g).some((s) => s.area === a && s.side === side));
} // 17.21: garrisons and Task Forces too
export function playAirSupply(g: Game, id: string, area: number) {
  const c = chit(g, id);
  if (g.phase !== 'supply' || g.battle || c.kind !== 'air_mission' || c.box !== 'available' || !airSupplyAreas(g, c.side).includes(area))
    throw new Error('needs an Air Mission, the end of the turn, and an unsupplied area');
  (g.airSupplies ??= []).push({ area, side: c.side, id, stamp: g.turn * 2 + (g.phasing === 'german' ? 0 : 1) });
  c.box = 'map';
  for (const u of unitsIn(g, area, c.side)) {
    if (u.unsupplied && u.disorder && (!CUR.recoverOk || CUR.recoverOk(g, u))) u.disorder = u.disorder === 2 ? 0 : 2;
    u.unsupplied = false;
  } // 9.35: supplied, so the markers adjust
  say(g, `Air Supply mission over ${areas.get(area)!.name}`, c.side);
}
