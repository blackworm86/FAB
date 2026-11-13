// Hits, retreats and the end of a battle: the attacker's and the defender's choices (6.4, 6.5), retreat routes (6.6), overrunning artillery (18.7), exploitation (6.8), the defender's Special Actions in a battle, breakthrough activation, and which battles must be fought.
import { areas, connection, neighbors, setPlayArea } from './map';
import { succeeds } from './dice';
import { isArty, isBattleAsset, type Side } from './chits';
import { CUR } from './volumes';
import { clearInterdict } from './vol/bulge';
import { spendSA } from './admin';
import { dropReserve } from './moves';
import { airOf, attackerBegun, dropAsset, fighters, fixPoint, point, settleUp } from './battle-setup';
import { allGone, allocate, eliminate, fireList, next, runLosses, stepLoss } from './fire';
import {
  type Battle,
  blocks,
  chit,
  contested,
  type Game,
  newlyContested,
  other,
  roll,
  roomFor,
  say,
  sidesOf,
  stackMax,
  type Unit,
  unitsIn,
  updateControl,
} from './game';

export function hitAttacker(g: Game, b: Battle, h: number) {
  if (h > 0) {
    b.unitHit[b.attacker] = false;
    if (b.assets[b.attacker].some((id) => isBattleAsset(chit(g, id)))) {
      b.pending = h;
      b.stage = 'attFirst';
      return;
    } // 6.41a the attacker picks the point unit or one battle asset
    allocate(g, b, b.attacker, 1);
  }
  afterFirstHit(g, b, h - 1);
}
function afterFirstHit(g: Game, b: Battle, rest: number) {
  if (rest > 0 && unitsIn(g, b.area, b.attacker).some((u) => !u.garrison)) {
    b.pending = rest;
    b.stage = 'attChoice';
    return;
  }
  next(g, b);
}
/** 6.41a: the first hit on the attacker falls on the point unit or on any one assigned battle asset, the player's choice. */
export function chooseFirstLoss(g: Game, b: Battle, key: string) {
  if (b.stage !== 'attFirst') throw new Error('no choice pending');
  const att = b.attacker;
  fixPoint(g, b);
  if (key !== b.attPoint && !b.assets[att].includes(key)) throw new Error('the first loss falls on the point unit or one battle asset');
  const h = b.pending;
  b.pending = 0;
  stepLoss(g, b, att, key);
  b.hit ??= {};
  b.hit[att] = [...new Set([...(b.hit[att] ?? []), key])];
  afterFirstHit(g, b, h - 1);
}
export function attackerChoice(g: Game, b: Battle, abort: boolean) {
  if (b.stage !== 'attChoice') throw new Error('no choice pending');
  if (abort) {
    {
      const why = CUR.canAbort?.(g, b);
      if (why) throw new Error(why);
    }
    const us = unitsIn(g, b.area, b.attacker).filter((u) => !u.garrison);
    if (b.riverAssault)
      for (const u of us) {
        const from = u.from;
        if (
          from != null &&
          neighbors(b.area).includes(from) &&
          g.control[from] === b.attacker &&
          !unitsIn(g, from, other(b.attacker)).length &&
          blocks(g, from, b.attacker).length < stackMax(g, from) &&
          (!CUR.retreatOk || CUR.retreatOk(g, u, b.area, from))
        ) {
          u.area = from;
          CUR.onRetreat?.(g, u, b.area, from);
        } else if (from != null) stepLoss(g, b, b.attacker, u.id);
      }
    for (const u of us) if (u.area != null) u.disorder = 1; // the ones that fell back are disordered too
    b.queue = [];
    return end(g, b, 'Attack aborted: attackers disordered' + (b.riverAssault ? ' and back across the river' : ''));
  }
  runLosses(g, b, { side: b.attacker, left: b.pending, then: 'att' });
}
export function hitDefender(g: Game, b: Battle, h: number, kind: 'arty' | 'ground') {
  const def = other(b.attacker);
  {
    const p = point(g, b, def);
    if (p && p.area === b.area) b.lastDefPoint = { ...p };
  }
  if (h > 0 && g.fieldWorks.includes(b.area) && (g.fwOwner[b.area] ?? def) === def) {
    g.fieldWorks = g.fieldWorks.filter((x) => x !== b.area);
    h--;
    say(g, 'field works absorb 1 hit');
  }
  b.pending = h;
  b.pendingKind = kind;
  b.lossKind = kind;
  const real = fighters(g, b.area, def, false).filter((u) => !u.garrison);
  const canDis = kind === 'arty' && real.some((u) => u.disorder !== 1);
  const noRet = CUR.noRetreat ? unitsIn(g, b.area, def).filter((x) => CUR.noRetreat!(g, x)).length : 0; // 16.21: the garrison is destroyed first, the retreat needs a hit to spare
  const canRet = kind === 'ground' && real.some((u) => !u.fort) && h > noRet; // strongpoints never retreat (Golan 15.6)
  if (h > 0 && (canDis || canRet)) {
    b.stage = 'defChoice';
    return;
  }
  applyDef(g, b, h, kind, false);
}
export function defenderChoice(g: Game, b: Battle, use: boolean) {
  if (b.stage !== 'defChoice') throw new Error('no choice pending');
  const kind = b.pendingKind!,
    def = other(b.attacker);
  let h = b.pending;
  if (use && kind === 'arty') {
    for (const u of unitsIn(g, b.area, def))
      if (!u.garrison && u.disorder === 0) u.disorder = 1;
      else if (!u.garrison && u.disorder === 2) u.disorder = 1;
    h--;
    say(g, 'defenders disordered to absorb 1 hit');
  }
  applyDef(g, b, h, kind, use && kind === 'ground');
}
function applyDef(g: Game, b: Battle, h: number, kind: 'arty' | 'ground', retreat: boolean) {
  const def = other(b.attacker);
  if (retreat && CUR.noRetreat)
    for (const a of unitsIn(g, b.area, def).filter((x) => CUR.noRetreat!(g, x))) {
      say(g, `${a.name} cannot retreat: destroyed, counting as a hit (6.42c)`);
      eliminate(g, a);
      h = Math.max(0, h - 1);
    } // 6.42c (2016), 16.21: first
  if (retreat) h = Math.max(0, h - 1);
  runLosses(g, b, { side: def, left: h, then: 'def', kind, retreat, h });
}
export function afterDefLosses(g: Game, b: Battle, kind: 'arty' | 'ground', retreat: boolean, h: number, excess: number) {
  const def = other(b.attacker);
  b.pending = 0;
  if (retreat) {
    b.retreat = {
      side: def,
      queue: unitsIn(g, b.area, def)
        .filter((x) => !x.garrison && !x.fort && !x.ghost)
        .map((x) => x.id),
      moved: false,
      after: kind,
      h,
      excess,
    };
    return advanceRetreat(g, b);
  }
  finishDef(g, b, kind, false, excess);
}
function finishDef(g: Game, b: Battle, kind: 'arty' | 'ground', retreated: boolean, excess: number) {
  const def = other(b.attacker);
  if (allGone(g, b, def)) {
    b.result = retreated ? 'Defender retreated' : 'Defender eliminated';
    b.exploit = !retreated && (kind === 'arty' || excess > 0);
    b.unabsorbed = excess;
    b.byArty = !retreated && kind === 'arty';
    b.queue = b.queue.filter((s) => s === 'defArty');
  }
  next(g, b);
}
/** Where a retreating block may go (6.6, 2016): an adjoining, uncontested, friendly-controlled area with room (one unit or fewer); when every such area
 *  is full, onward through them to the nearest uncontested friendly area with room. None: the block takes a step loss instead. */
export function retreatOptions(g: Game, b: Battle): number[] {
  setPlayArea(g.inPlay);
  const r = b.retreat;
  if (!r) return [];
  const u = g.units.find((x) => x.id === r.queue[0]); // the unit retreating now
  const room = (n: number) => (u ? roomFor(g, u, n) : blocks(g, n, r.side).length < stackMax(g, n));
  const opts = [...retreatPaths(g, b.area, r.side, u).keys()].filter(room);
  let out = u && CUR.retreatPrefer ? CUR.retreatPrefer(g, u, b.area, opts) : opts;
  if (!out.length && u && CUR.seaRetreat?.(g, u, b.area)) out = [SEA]; // Sicily 14.28: to sea when nothing else is open
  return out;
}
/** A retreat destination that is not an area: the sea (Sicily's At Sea box, 14.28). */
export const SEA = -1;
/** The retreat routes from the battle area: each reachable destination and the way there (adjoining areas with room first; past full ones only when all are full). */
export function retreatPaths(
  g: Game,
  from: number,
  side: Side,
  u: Unit | undefined,
  zoneOnly = !!(u && CUR.retreatZone),
): Map<number, number[]> {
  const ok = (f: number, n: number) =>
    g.control[n] === side &&
    !unitsIn(g, n, other(side)).length &&
    (!u || !CUR.retreatOk || CUR.retreatOk(g, u, f, n)) &&
    (!u || !CUR.moveOk || CUR.moveOk(g, u, n)) &&
    (!zoneOnly || CUR.retreatZone!(g, u!, n));
  const room = (n: number) => (u ? roomFor(g, u, n) : blocks(g, n, side).length < stackMax(g, n));
  const out = new Map<number, number[]>(),
    first = neighbors(from).filter((n) => ok(from, n));
  for (const n of first) if (room(n)) out.set(n, [from, n]);
  if (!out.size && zoneOnly && !first.some((n) => !room(n))) return retreatPaths(g, from, side, u, false); // 14.43: nothing in the own zone, then the other paths
  if (out.size || !first.length) return out;
  let ring = first.map((n) => [from, n]);
  const seen = new Set([from, ...first]);
  while (ring.length && !out.size) {
    // breadth first: the nearest areas with room
    const next: number[][] = [];
    for (const p of ring)
      for (const n of neighbors(p[p.length - 1])) {
        if (seen.has(n) || !ok(p[p.length - 1], n)) continue;
        seen.add(n);
        const q = [...p, n];
        if (room(n)) out.set(n, q);
        else next.push(q);
      }
    ring = next;
  }
  return !out.size && zoneOnly ? retreatPaths(g, from, side, u, false) : out;
}
function advanceRetreat(g: Game, b: Battle) {
  const r = b.retreat!;
  while (r.queue.length) {
    const u = g.units.find((x) => x.id === r.queue[0])!,
      opts = retreatOptions(g, b);
    if (!opts.length) {
      stepLoss(g, b, r.side, u.id);
      r.queue.shift();
      continue;
    }
    if (opts.length === 1) {
      moveRetreat(g, b, u, opts[0]);
      r.queue.shift();
      continue;
    }
    b.stage = 'retreat';
    return;
  }
  b.retreat = undefined;
  if (r.after === 'sa' && unitsIn(g, b.area, r.side).length) {
    b.stage = 'setup';
    say(
      g,
      `the units retreat; ${unitsIn(g, b.area, r.side)
        .map((u) => u.name)
        .join(', ')} stay and still fight`,
    );
    return;
  } // a garrison or defended roadblock cannot retreat: the battle goes on against it
  if (r.after === 'sa') {
    b.exploit = true;
    b.queue = [];
    return end(g, b, 'Defender retreated (Special Action): exploitation opportunity');
  }
  finishDef(g, b, r.after, r.moved, r.excess);
}
function moveRetreat(g: Game, b: Battle, u: Unit, to: number) {
  if (u.area == null) return;
  if (to === SEA) {
    const from = u.area;
    if (b.retreat!.after !== 'sa') u.disorder = 1;
    b.retreat!.moved = true;
    u.area = null;
    u.box = 'at_sea';
    dropReserve(g, u);
    CUR.onRetreat?.(g, u, from, SEA);
    updateControl(g, from);
    say(g, `${u.name} retreats to sea (14.28)`);
    return;
  }
  const path = retreatPaths(g, b.area, b.retreat!.side, u).get(to) ?? [u.area, to]; // past full areas when it must (6.6)
  if (b.retreat!.after !== 'sa') u.disorder = 1;
  b.retreat!.moved = true; // 8.24 a retreat before combat does not disorder
  for (let i = 1; i < path.length && u.area != null; i++) {
    const from = path[i - 1];
    u.area = path[i];
    CUR.onRetreat?.(g, u, from, path[i]);
    updateControl(g, from);
    updateControl(g, path[i]);
  }
  if (u.area != null)
    say(
      g,
      `${u.name} retreats to ${areas.get(u.area)!.name}${
        path.length > 2
          ? ` (through ${path
              .slice(1, -1)
              .map((a) => areas.get(a)!.name)
              .join(', ')}, full)`
          : ''
      }`,
    );
}
export function chooseRetreat(g: Game, b: Battle, to: number) {
  if (b.stage !== 'retreat' || !b.retreat) throw new Error('no retreat pending');
  if (!retreatOptions(g, b).includes(to)) throw new Error('cannot retreat there');
  moveRetreat(g, b, g.units.find((x) => x.id === b.retreat!.queue[0])!, to);
  b.retreat.queue.shift();
  advanceRetreat(g, b);
}
/** 18.7 Overrunning Artillery: the defending area is vacated; the attacker rolls one die per defending artillery asset (rocket included).
 *  SN 1 if the defender retreated with a step surviving, 2 if its units and battle assets were destroyed, +1 per unabsorbed hit. Destroyed by
 *  attacking artillery: the attacking units roll their ground fire as if the defender were still there; its hits count as unabsorbed. */
function overrun(g: Game, b: Battle) {
  const def = other(b.attacker),
    arts = b.assets[def].map((id) => chit(g, id)).filter((c) => isArty(c) && c.box === 'map');
  if (!arts.length || unitsIn(g, b.area, def).length || !unitsIn(g, b.area, b.attacker).some((u) => !u.garrison)) return;
  const survived = (b.defStart ?? []).some((id) => {
    const u = g.units.find((x) => x.id === id);
    return !!u && u.str > 0 && u.area != null && u.area !== b.area;
  });
  let extra = survived ? 0 : (b.unabsorbed ?? 0);
  if (!survived && b.byArty && b.lastDefPoint) {
    let hits = 0;
    for (const f of fireList(g, b, b.attacker, 'ground', b.lastDefPoint)) {
      const dice = Array.from({ length: f.dice }, () => roll(g));
      hits += dice.filter((d) => succeeds(d, f.sn)).length;
    }
    extra = hits;
    say(g, `overrunning artillery: the attackers' ground fire scores ${hits} unabsorbed hit(s) (18.7)`);
  }
  const sn = (survived ? 1 : 2) + extra;
  for (const c of arts) {
    const r = roll(g),
      ok = succeeds(r, sn);
    b.rolls.push({ who: `Overrun ${c.name} (18.7)`, sn, dice: [r], hits: ok ? 1 : 0, kind: 'morale' });
    if (ok) {
      c.box = 'eliminated';
      b.assets[def] = b.assets[def].filter((x) => x !== c.id);
    }
    say(g, `overrunning artillery: ${c.name} ${ok ? 'is destroyed' : 'escapes'} (rolled ${r}, needs ${sn} or less, 18.7)`);
    b.result = `${b.result ?? ''}${b.result ? ' · ' : ''}${c.name} ${ok ? 'overrun and destroyed' : 'escapes the overrun'} (18.7)`;
  }
}
export function end(g: Game, b: Battle, result: string) {
  b.result = result;
  b.stage = 'done';
  if (g.opts.overrun) overrun(g, b);
  b.lastDefPoint = undefined; // a copy of a block: never left in the shared game
  for (const side of sidesOf(g))
    for (const id of b.assets[side] ?? []) {
      const c = chit(g, id);
      if (c.box === 'map') c.box = 'used';
    }
  for (const side of sidesOf(g)) for (const a of airOf(b, side)) chit(g, a.id).box = CUR.id === 'bulge' ? 'eliminated' : 'used'; // Bulge air missions are single-use; Golan air support recycles (16.31)
  CUR.onBattle?.(g, b, 'end');
  g.fought.push(b.area);
  for (const n of [b.area, ...neighbors(b.area)]) updateControl(g, n);
  say(g, `${areas.get(b.area)!.name}: ${result}`);
  g.battles = (g.battles ?? 0) + 1;
  const cand =
    b.exploit && !b.bt && !b.riverAssault
      ? unitsIn(g, b.area, b.attacker)
          .filter((x) => x.cls === 'armor' && !x.garrison && !x.unsupplied)
          .map((x) => x.id)
      : []; // 6.8: never from river assaults or Breakthrough combat; never an out-of-supply unit (2016)
  if (cand.length) {
    b.stage = 'exploit';
    b.exploitIds = cand;
    say(g, `exploitation opportunity: ${b.attacker} may roll a morale check for ${cand.length} armor-class unit(s) (6.8)`);
  }
}
/** 6.8: the attacker may decline the exploitation opportunity (and keep the blocks hidden). */
export function declineExploit(g: Game, b: Battle) {
  if (b.stage !== 'exploit') throw new Error('no exploitation pending');
  b.exploitIds = undefined;
  b.stage = 'done';
  say(g, `${b.attacker} declines the exploitation opportunity`);
}
export function closeBattle(g: Game) {
  if (g.battle?.stage !== 'done') throw new Error('battle not finished');
  g.battle = null;
  settleUp(g);
}
export function defenderRetreatSA(g: Game, b: Battle, chitId?: string) {
  if (b.stage !== 'setup' || (!b.defSA && attackerBegun(b)))
    throw new Error("only as the Defender's first decision, before the Attacker assigns assets (6.21)");
  const def = other(b.attacker);
  const us = unitsIn(g, b.area, def).filter((u) => !u.garrison && !u.fort && !u.ghost);
  if (!us.length) throw new Error('only units retreat: garrisons, defended roadblocks and strongpoints stay (16.21, 4.35, 15.6)');
  if (us.some((u) => u.unsupplied)) throw new Error('out-of-supply units may not be affected by Special Actions (9.34d)');
  spendSA(
    g,
    def,
    us.map((x) => x.ech!),
    'retreat before combat',
    chitId,
    b.area,
  );
  b.defSA = false;
  for (const id of [...b.assets[def], ...airOf(b, def).map((a) => a.id)]) dropAsset(g, b, id); // assets already assigned go back to the Available Box
  b.locked = true;
  us.forEach((x) => clearInterdict(g, x));
  b.retreat = { side: def, queue: us.map((u) => u.id), moved: false, after: 'sa', h: 0, excess: 0 };
  advanceRetreat(g, b);
}
export function defenderReinforceSA(g: Game, b: Battle, unitId: string, chitId?: string) {
  if (b.stage !== 'setup' || (!b.defSA && attackerBegun(b)))
    throw new Error("only as the Defender's first decision, before the Attacker assigns assets (6.21)");
  const def = other(b.attacker),
    u = g.units.find((x) => x.id === unitId)!;
  if (
    unitsIn(g, b.area, def).some((x) => x.id.startsWith('DR-') || x.heydte) ||
    (!CUR.reinforceOk && unitsIn(g, b.area, def).every((x) => x.garrison))
  )
    throw new Error('a battle of standing assets alone may not be reinforced (4.35)');
  if ((u.cls === 'armor' && connection(u.area!, b.area)?.restricted) || (CUR.moveOk && !CUR.moveOk(g, u, b.area)))
    throw new Error('that unit may not cross into the battle area (14.1, 14.43)');
  if (
    u.side !== def ||
    u.area == null ||
    !neighbors(b.area).includes(u.area) ||
    contested(g, u.area) ||
    u.disorder ||
    u.unsupplied ||
    u.garrison ||
    u.fort ||
    u.ghost ||
    !roomFor(g, u, b.area)
  )
    throw new Error('not a legal reinforcement');
  if (CUR.reinforceOk && !CUR.reinforceOk(g, b, u)) throw new Error('not a legal reinforcement here (8.23)');
  spendSA(g, def, u.ech, 'reinforce a battle', chitId, b.area);
  b.defSA = false;
  b.locked = true;
  b.reinforced = u.id;
  clearInterdict(g, u);
  const from = u.area;
  u.area = b.area;
  u.from = from;
  updateControl(g, from);
  say(g, `${u.name} reinforces ${areas.get(b.area)!.name}`);
}
export function activateBreakthrough(g: Game, unitId: string, chitId?: string) {
  const u = g.units.find((x) => x.id === unitId)!;
  if (
    g.phase !== 'btMove' ||
    u.side !== g.phasing ||
    u.cls !== 'armor' ||
    u.unsupplied ||
    u.disorder ||
    u.moved ||
    u.exploit ||
    u.area == null
  )
    throw new Error('needs a supplied armor unit in good order');
  spendSA(g, u.side, u.ech, 'breakthrough movement', chitId, u.area!);
  clearInterdict(g, u);
  u.exploit = true;
}
export function mustFight(g: Game) {
  const bt = g.phase === 'btCombat';
  if (g.phase !== 'combat' && !bt) return [];
  return [...new Set([...newlyContested(g), ...(CUR.mustFight?.(g) ?? [])])].filter(
    (a) => !g.fought.includes(a) && fighters(g, a, g.phasing, true).some((u) => !u.garrison),
  );
}
