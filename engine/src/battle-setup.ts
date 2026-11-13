// A battle before the dice: who fights, the point units (6.24), starting a battle, the assets each side may commit and whose step it is in the set-up (6.21–6.24), what each side may see, beginning or cancelling combat.
import { areas, neighbors, zoneOf } from './map';
import { type Chit, type Side } from './chits';
import { CUR } from './volumes';
import { pz150In } from './vol/bulge';
import { saAvailable, spendSA } from './admin';
import { type Battle, chit, contested, end, type Game, newlyContested, next, other, say, sidesOf, type Unit, unitsIn } from './game';

/* ================= combat ================= */
export const fighters = (g: Game, a: number, side: Side, attacker: boolean) =>
  unitsIn(g, a, side).filter((u) => !u.ghost && !(attacker && (u.disorder > 0 || u.fort)));
export const point = (g: Game, b: Battle, side: Side) =>
  g.units.find((x) => x.id === (side === b.attacker ? b.attPoint : b.defPoint)) ?? null;
const pointOrder = (x: Unit, y: Unit) => +!!x.garrison - +!!y.garrison || +!!x.fort - +!!y.fort || y.str - x.str; // regular blocks before strongpoints before standing assets
export function fixPoint(g: Game, b: Battle) {
  for (const side of sidesOf(g)) {
    const p = point(g, b, side);
    if (p && p.area === b.area) continue;
    const us = fighters(g, b.area, side, side === b.attacker);
    if (!us.length) continue;
    const n = [...us].sort(pointOrder)[0].id;
    if (side === b.attacker) b.attPoint = n;
    else b.defPoint = n;
  }
}
/** The area the volume says must be fought before any other now (Golan 15.3), while it is still contested and unfought. */
export function firstBattle(g: Game): number | null {
  const f = CUR.firstBattle?.(g);
  return f != null && contested(g, f) && !g.fought.includes(f) ? f : null;
}
export function startBattle(g: Game, a: number, viaSA = false, chitId?: string): Battle {
  if (g.battle) throw new Error('a battle is already open');
  const bt = g.phase === 'btCombat';
  if ((g.phase !== 'combat' && !bt && !CUR.battleAllowed?.(g, a)) || !contested(g, a) || g.fought.includes(a))
    throw new Error('no battle here');
  const att = fighters(g, a, g.phasing, true).filter((u) => !u.garrison || !!CUR.battleAllowed?.(g, a)), // a landing flank asset fights its own round (Sicily 17.22)
    def = fighters(g, a, other(g.phasing), false);
  if (!att.length) throw new Error('no attacker in good order');
  {
    const f = firstBattle(g);
    if (f != null && f !== a) throw new Error(`the battle in ${areas.get(f)!.name} must be fought first`);
  }
  let lockedAtStart = false;
  if (bt && !newlyContested(g).includes(a)) {
    if (CUR.freeBattle?.(g, a)) {
      say(g, 'a free Breakthrough combat round');
      lockedAtStart = true;
    } // the round is spent: the battle cannot be withdrawn
    else {
      if (!viaSA) throw new Error('re-engaging an already contested area costs a Special Action');
      spendSA(g, g.phasing, [...new Set(att.map((u) => u.ech!))], 'breakthrough combat', chitId, a);
      lockedAtStart = true;
    } // 8.1: an event of the attackers' echelon
  }
  const pick = (us: Unit[]) => [...us].sort(pointOrder)[0]?.id ?? '',
    empty = <T>(v: T) => Object.fromEntries(sidesOf(g).map((s) => [s, structuredClone(v)])) as Record<Side, T>;
  const b: Battle = {
    area: a,
    attacker: g.phasing,
    attPoint: pick(att),
    defPoint: pick(def),
    bt,
    riverAssault: g.riverAssault.includes(a),
    stage: 'setup',
    queue: [],
    assets: empty<string[]>([]),
    air: {},
    pending: 0,
    engFw: false,
    rolls: [],
    exploit: false,
    unitHit: empty(false),
    mark: g.log.length,
    hit: empty<string[]>([]),
    ready: [],
    locked: lockedAtStart,
    defSA:
      saAvailable(g, other(g.phasing)).length > 0 &&
      [a, ...neighbors(a)].some((n) => unitsIn(g, n, other(g.phasing)).some((u) => !u.garrison && !u.fort && !u.ghost)),
  };
  {
    const pz = pz150In(g, b);
    if (pz) {
      if (pz.side === b.attacker) b.attPoint = pz.id;
      else b.defPoint = pz.id;
    }
  }
  g.battle = b;
  return b;
}
/* --- assets (6.22, 6.23, 6.31, 16.1, 16.12, 16.23, 15.2) --- */
function echelons(g: Game, b: Battle, side: Side) {
  const set = new Set<string>();
  for (const u of unitsIn(g, b.area, side))
    if (!u.garrison)
      set.add(u.ech === 'de_sr' ? ({ 5: 'de_5pz', 6: 'de_6pz', 7: 'de_7a' } as Record<number, string>)[zoneOf(b.area)] : u.ech!);
  return set;
}
export function assetLimits(g: Game, b: Battle, side: Side) {
  const attacker = side === b.attacker,
    ech = echelons(g, b, side),
    us = side === 'allied' && [...ech].some((e) => e.startsWith('us_'));
  const pooled = g.pooled === b.area && us && [...ech].every((e) => e.startsWith('us_')),
    pure = [...ech].filter((e) => e !== 'us_sr'),
    mixed = pure.length > 1 && !pooled; // 14.62b
  const onlyAssets = unitsIn(g, b.area, side).every((u) => u.garrison),
    vsDR = unitsIn(g, b.area, other(side)).some((u) => u.id.startsWith('DR-') || u.heydte); // 16.23: no extra US artillery in a battle with a defended roadblock
  return {
    arty: (attacker ? 2 : 1) + (us && !mixed && !onlyAssets && !vsDR ? 1 : 0),
    battle: !mixed && !onlyAssets,
    event: !mixed && !onlyAssets,
    mixed,
    pure,
    ech,
    pooled,
  };
}
/** 6.21-6.24: whose step it is in a battle's set-up. The Defender decides on a Special Action, then the Attacker assigns assets, then the Defender
 *  assigns his and designates his point unit, then the Attacker designates his point unit and begins the round (a second setReady). A volume may hand the step over for an answer (Golan: SAM, jamming). */
export function setupSide(g: Game, b: Battle): Side {
  return CUR.setupActor?.(g, b) ?? orderSide(b);
}
const orderSide = (b: Battle): Side => {
  const def = other(b.attacker),
    r = b.ready ?? [];
  return b.defSA ? def : r.length === 2 ? b.attacker : r.includes(b.attacker) ? def : b.attacker;
};
export const attackerBegun = (b: Battle) => !!b.ready?.includes(b.attacker) || b.assets[b.attacker].length > 0 || !!b.air[b.attacker];
/** 6.21: the Defender goes on without a Special Action. */
export function passSA(g: Game, b: Battle) {
  if (b.stage !== 'setup' || !b.defSA) throw new Error('no Special Action decision pending');
  b.defSA = false;
}
const notYourStep = (g: Game, b: Battle, side: Side) =>
  b.defSA
    ? 'the Defender first decides on a Special Action (6.21)'
    : side === setupSide(g, b)
      ? null
      : side === b.attacker
        ? 'your assets are committed: now the Defender assigns (6.23)'
        : 'the Attacker assigns his assets first (6.22)';
const committed = (b: Battle, side: Side) =>
  b.ready?.includes(side) ? (side === b.attacker ? 'your assets are committed (6.22)' : 'your assets are committed (6.23)') : null;
export function canAssign(g: Game, b: Battle, side: Side, c: Chit, mode?: 'arty' | 'support'): string | null {
  if (b.stage !== 'setup') return 'assets are committed before the first roll';
  {
    const w = notYourStep(g, b, side) ?? committed(b, side);
    if (w) return w;
  }
  if (c.side !== side || c.box !== 'available') return 'not in the Available Box';
  return CUR.canAssign(g, b, side, c, mode);
}
export function assign(g: Game, b: Battle, id: string, mode?: 'arty' | 'support', unit?: string) {
  const c = chit(g, id),
    err = canAssign(g, b, c.side, c, mode);
  if (err) throw new Error(err);
  c.box = 'map';
  if (c.kind === 'air_mission') {
    const a = { id, mode: mode ?? 'arty', unit };
    if (b.air[c.side]) (b.air2 ??= {})[c.side] = a;
    else b.air[c.side] = a;
  } else b.assets[c.side].push(id);
  CUR.onAssign?.(g, b, c, mode, unit);
}
/** Take an asset back, in its owner's own set-up step only. */
export function unassign(g: Game, b: Battle, id: string) {
  const s = chit(g, id).side;
  if (s === orderSide(b) && !committed(b, s)) dropAsset(g, b, id);
} /* an air mission may be taken back while its SAM answer waits (16.12) */
export function dropAsset(g: Game, b: Battle, id: string) {
  const c = chit(g, id);
  if (b.stage !== 'setup' || CUR.keepAssigned?.(g, b, c)) return;
  c.box = 'available';
  b.assets[c.side] = b.assets[c.side].filter((x) => x !== id);
  dropAir(b, c.side, id);
  CUR.onUnassign?.(g, b, c);
}
/** The air assets a side committed to a battle (one, or two in Golan '73). */
export const airOf = (b: Battle, side: Side) =>
  [b.air[side], b.air2?.[side]].filter((a): a is { id: string; mode: 'arty' | 'support'; unit?: string } => !!a);
export function dropAir(b: Battle, side: Side, id: string) {
  if (b.air[side]?.id === id) delete b.air[side];
  if (b.air2?.[side]?.id === id) delete b.air2[side];
  if (!b.air[side] && b.air2?.[side]) {
    b.air[side] = b.air2[side];
    delete b.air2[side];
  }
}
/** 6.24, 5.22: may `side` read this block? Own blocks, face-up blocks, a block in an area where enemy blocks are face-up, and the Intelligence Gathering target. Chits are always face-up. */
/** Blocks that were face-up in a battle stand up again once their area is no longer contested. */
export function settleUp(g: Game) {
  for (const u of g.units) if (u.up != null && (u.up !== u.area || !contested(g, u.up))) u.up = undefined;
}
export function visibleTo(g: Game, u: Unit, side: Side | 'spectator' | null): boolean {
  if (side === null || u.side === side || u.garrison || g.revealed === u.id || u.area == null) return true;
  if (side !== 'spectator' && CUR.seenBy?.(g, u, side)) return true; // a volume's own reveal (Golan air reconnaissance, 16.31c)
  if (u.up === u.area && contested(g, u.area)) return true; // face-up only while the area stays contested (the blocks stand up again when the enemy leaves)
  return g.units.some((x) => x.area === u.area && x.side !== u.side && x.up === u.area);
}
export function beginCombat(g: Game, b: Battle) {
  if (b.stage !== 'setup') throw new Error('already started');
  CUR.beforeBegin?.(g, b);
  for (const u of g.units) if (u.area === b.area && !u.garrison) u.up = b.area; // 6.24 units are revealed once both point units are designated
  CUR.onBattle?.(g, b, 'begin');
  fixPoint(g, b);
  if (!fighters(g, b.area, other(b.attacker), false).length) {
    b.result = 'Defender eliminated';
    b.exploit = false;
    return end(g, b, b.result);
  } // only ghosts stood there (Golan 15.7): removed, not eliminated by fire, so no exploitation (6.8)
  {
    const pz = pz150In(g, b);
    if (pz) {
      if (pz.side === b.attacker) b.attPoint = pz.id;
      else b.defPoint = pz.id;
      b.pz150 = pz.id;
      g.pz150Done = true;
      say(g, '150th Panzer Brigade, first battle: it is the point unit (18.4)');
    }
  }
  b.defStart = unitsIn(g, b.area, other(b.attacker)).map((u) => u.id); // 18.7
  b.queue = ['attArty', 'defArty', 'defFire', 'offFire'];
  next(g, b);
}
/** Hot-seat shortcut stays beginCombat; online each side confirms its set-up and combat starts when both are ready. */
export function setReady(g: Game, b: Battle, side: Side, on = true) {
  if (b.stage !== 'setup') throw new Error('already started');
  if (!on) throw new Error('assets once committed stay committed (6.22, 6.23)');
  {
    const w = notYourStep(g, b, side);
    if (w) throw new Error(w);
  }
  const r = (b.ready ??= []);
  if (!r.includes(side)) r.push(side);
  else if (side === b.attacker && r.length === 2) b.attPointDone = true;
  else throw new Error('already done');
  if (b.attPointDone && !g.deferBegin) beginCombat(g, b);
}
/** Withdraw from a battle that has not rolled yet, returning every assigned asset. Not possible once a Special Action was spent. */
export function cancelBattle(g: Game) {
  const b = g.battle;
  if (!b) throw new Error('no battle');
  if (b.stage !== 'setup') throw new Error('combat has begun');
  if (b.locked) throw new Error('a Special Action was spent; the battle cannot be withdrawn');
  if (b.ready?.includes(b.attacker)) throw new Error('the Attacker has committed his assets: the battle is fought (6.22)');
  for (const id of sidesOf(g).flatMap((s) => [...(b.assets[s] ?? []), ...airOf(b, s).map((a) => a.id)])) dropAsset(g, b, id);
  g.battle = null;
}

/** The point unit a side designates for a battle (6.24), and the engineer's option to remove field works instead of firing (6.33): plain state changes, so they can travel as actions. */
export function setPoint(g: Game, b: Battle, side: Side, unitId: string) {
  if (b.stage !== 'setup') throw new Error('already started');
  const u = g.units.find((x) => x.id === unitId);
  {
    const w =
      notYourStep(g, b, side) ??
      (side === b.attacker && !b.ready?.includes(other(b.attacker)) ? 'the Defender designates his point unit first (6.24)' : null);
    if (w) throw new Error(w);
  }
  if (!u || u.side !== side || u.area !== b.area || u.garrison || u.ghost) throw new Error('not a legal point unit');
  if (side === b.attacker && u.disorder) throw new Error('a disordered unit cannot be the attacking point unit');
  if (side !== b.attacker && unitId === b.reinforced && g.units.some((x) => x.id === b.defPoint && x.area === b.area))
    throw new Error('the reinforcing unit may not be the point unit while the original point unit stands (8.23)');
  {
    const pz = pz150In(g, b);
    if (pz && pz.side === side && pz.id !== unitId)
      throw new Error('150th Panzer Brigade must be the point unit in its first battle (18.4)');
  }
  if (side === b.attacker) b.attPoint = unitId;
  else b.defPoint = unitId;
}
export function setEngFw(_g: Game, b: Battle, on: boolean) {
  if (!['setup', 'attArty', 'defArty', 'defFire', 'offFire'].includes(b.stage))
    throw new Error('too late: the field works are removed before offensive fire (6.33)');
  b.engFw = !!on;
}
