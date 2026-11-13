// Fire and losses: who fires at what and with which numbers (6.3), eliminating and reducing blocks, placing step losses (6.43), and the next step of a battle, roll by roll.
import { areas } from './map';
import { succeeds } from './dice';
import { type Shooter } from './combat';
import { chitClass, isArty, isBattleAsset, type Side } from './chits';
import { CUR } from './volumes';
import { pz150Check } from './vol/bulge';
import { dropReserve } from './moves';
import { airOf, fighters, fixPoint, point } from './battle-setup';
import {
  afterDefLosses,
  type Battle,
  chit,
  end,
  type Game,
  hitAttacker,
  hitDefender,
  other,
  quality,
  roll,
  say,
  type Unit,
  unitsIn,
} from './game';

/* --- fire --- */
export interface Fire {
  key: string;
  who: string;
  shooter: Shooter;
  dice: number;
  sn: number;
  parts: [string, number][];
  isAsset: boolean;
}
/** 6.33: the attacker's engineer will remove the enemy field works before offensive fire (chosen, field works there, engineer still in the battle). */
export const engRemovesFw = (g: Game, b: Battle) =>
  b.engFw &&
  g.fieldWorks.includes(b.area) &&
  (g.fwOwner[b.area] ?? other(b.attacker)) !== b.attacker &&
  b.assets[b.attacker].some((id) => chit(g, id).kind === 'engineer');
export function fireList(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground', ghost?: Unit): Fire[] {
  const att = side === b.attacker,
    tp = ghost ?? point(g, b, other(side));
  if (!tp) return [];
  const out: Fire[] = [],
    tgt = {
      pointCls: tp.cls,
      pointQuality: quality(tp),
      strongpoint: tp.fort,
      fieldWorks:
        att &&
        g.fieldWorks.includes(b.area) &&
        (g.fwOwner[b.area] ?? other(side)) === other(side) &&
        !(kind === 'ground' && engRemovesFw(g, b)),
      riverAssaultMarker: !att && b.riverAssault,
    };
  const set = {
    attacker: att,
    tdn: areas.get(b.area)!.tdn,
    riverAssault: att && b.riverAssault,
    advArty: g.opts.advArty,
    night: CUR.isNight?.(g),
  };
  const add = (key: string, who: string, shooter: Shooter, isAsset: boolean) => {
    const r = CUR.successNumber({ side, ...shooter }, tgt, set);
    out.push({ key, who, shooter, dice: shooter.dice, sn: r.sn, parts: r.parts, isAsset });
  };
  if (kind === 'arty') {
    for (const id of b.assets[side]) {
      const c = chit(g, id);
      if (isArty(c)) add(id, c.name, { kind: 'artillery', cls: 'infantry', dice: 1, rocket: c.kind === 'rocket_artillery' }, true);
    }
    for (const a of airOf(b, side))
      if (a.mode === 'arty') add(a.id, 'Air Mission (artillery)', { kind: 'air', cls: 'infantry', dice: 1 }, true);
  } else {
    for (const u of fighters(g, b.area, side, att)) {
      if (u.paradrop === 'partial') continue;
      const sup = airOf(b, side).some((a) => a.mode === 'support' && a.unit === u.id);
      add(
        u.id,
        u.name,
        {
          kind: u.garrison ? 'battle' : 'unit',
          cls: u.cls,
          quality: quality(u),
          dice: u.fort ? 1 : u.str,
          disordered: u.disorder > 0,
          unsupplied: u.unsupplied,
          airSupport: sup,
          closeAirSupport: sup,
          strongpoint: u.fort,
        },
        !!u.garrison,
      );
    }
    let skipEng = att && kind === 'ground' && engRemovesFw(g, b); // 6.33: one engineer does the job instead of firing, the others fire
    for (const id of b.assets[side]) {
      const c = chit(g, id);
      if (!isBattleAsset(c)) continue;
      if (skipEng && c.kind === 'engineer') {
        skipEng = false;
        continue;
      }
      add(id, c.name, { kind: 'battle', cls: chitClass(c), quality: c.q, dice: 1 }, true);
    }
  }
  CUR.adjustFire?.(g, b, side, kind, out);
  return out;
}
function doFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground', engBusy = false) {
  CUR.beforeFire?.(g, b, side, kind);
  let total = 0;
  let skip = engBusy;
  for (const f of fireList(g, b, side, kind).filter((x) => {
    if (skip && b.assets[side].includes(x.key) && chit(g, x.key).kind === 'engineer') {
      skip = false;
      return false;
    }
    return true;
  })) {
    const dice = Array.from({ length: f.dice }, () => roll(g)),
      hits = dice.filter((d) => succeeds(d, f.sn)).length;
    total += hits;
    b.rolls.push({ who: f.who, sn: f.sn, dice, hits, kind });
  }
  say(g, `${areas.get(b.area)!.name}: ${side} ${kind === 'arty' ? 'artillery' : 'ground fire'} ${total} hit(s)`);
  CUR.afterFire?.(g, b, side, kind);
  return total;
}
export function eliminate(g: Game, u: Unit) {
  say(g, `${u.name} eliminated`);
  if (u.max >= 3 && !u.garrison && !u.fort) g.elimLarge.push(u.id);
  u.area = null;
  u.str = 0;
  dropReserve(g, u);
  if (u.chitId) chit(g, u.chitId).box = 'eliminated';
  if (u.interdict) {
    chit(g, u.interdict).box = 'eliminated';
    u.interdict = undefined;
  }
}
export function stepLoss(g: Game, b: Battle, side: Side, key: string) {
  const c = g.chits.find((x) => x.id === key);
  if (c) {
    c.box = 'eliminated';
    b.assets[side] = b.assets[side].filter((x) => x !== key);
    say(g, `${c.name} eliminated`);
    return;
  }
  const u = g.units.find((x) => x.id === key)!;
  if (!u.garrison && CUR.absorbLoss?.(g, b, side, u)) {
    b.unitHit[side] = true;
    return;
  } // the volume takes the hit another way (a recovery marker)
  u.str -= 1;
  if (u.str <= 0 || u.garrison) eliminate(g, u);
  else say(g, `${u.name} loses a step`);
  if (!u.garrison) b.unitHit[side] = true;
}
/** 6.43 step losses still to place: `then` says what follows (the attacker's remaining hits, or the defender's, with its retreat option and kind of fire). */
export interface LossRun {
  side: Side;
  left: number;
  then: 'att' | 'def';
  kind?: 'arty' | 'ground';
  retreat?: boolean;
  h?: number;
  excess?: number;
}
/** Who may take the next step loss (6.43): everyone present takes one before anyone takes a second (across the battle's volleys), the first unit loss is the
 *  point unit's (battle assets may go before it), and the volume's limits. Sorted with the suggested pick first: assets, then the point unit, then the weakest.
 *  null: nothing is left to take it. */
function lossCands(g: Game, b: Battle, side: Side): string[] | null {
  fixPoint(g, b);
  const ps = lossPool(g, b, side);
  if (!ps.length) return null;
  const hit = new Set<string>(b.hit?.[side] ?? []);
  let cand = ps.filter((p) => !hit.has(p.key));
  if (!cand.length) cand = ps;
  const pid = side === b.attacker ? b.attPoint : b.defPoint;
  if (!b.unitHit[side] && cand.some((p) => p.key === pid)) cand = cand.filter((p) => p.asset || p.key === pid);
  if (CUR.lossOk) {
    const ok = cand.filter((p) => CUR.lossOk!(g, b, side, p.key));
    if (ok.length) cand = ok;
  } // e.g. a flanking unit takes no hits while its point unit stands
  cand.sort((x, y) => +!x.asset - +!y.asset || +(x.key !== pid) - +(y.key !== pid) || x.str - y.str);
  return cand.map((p) => p.key);
}
const lossPool = (g: Game, b: Battle, side: Side) => [
  ...b.assets[side]
    .filter((id) => isBattleAsset(chit(g, id)) || !!CUR.lossAsset?.(g, b, side, id))
    .map((id) => ({ key: id, asset: true, str: 1 })),
  ...unitsIn(g, b.area, side)
    .filter((u) => side !== b.attacker || !(u.disorder > 0 || u.fort))
    .map((u) => ({ key: u.id, asset: !!u.garrison, str: u.str })),
]; // 6.2: disordered units take no part for the attacker
function takeLoss(g: Game, b: Battle, side: Side, key: string) {
  b.hit ??= {};
  const hit = new Set<string>(b.hit[side] ?? []);
  if (lossPool(g, b, side).every((p) => hit.has(p.key))) hit.clear(); // everyone has taken one: a new round of 6.43
  stepLoss(g, b, side, key);
  hit.add(key);
  b.hit[side] = [...hit];
}
/** Place the losses of `run`: automatically while only one block or asset may take the next one (or `auto`), otherwise the owner picks (stage 'loss'). */
export function runLosses(g: Game, b: Battle, run: LossRun, auto = false) {
  while (run.left > 0) {
    const cand = lossCands(g, b, run.side);
    if (!cand) {
      run.excess = (run.excess ?? 0) + run.left;
      run.left = 0;
      break;
    }
    if (cand.length > 1 && !auto) {
      b.loss = run;
      b.stage = 'loss';
      return;
    }
    takeLoss(g, b, run.side, cand[0]);
    run.left--;
  }
  b.loss = undefined;
  if (run.then === 'att') {
    b.pending = 0;
    return next(g, b);
  }
  afterDefLosses(g, b, run.kind!, !!run.retreat, run.h ?? 0, run.excess ?? 0);
}
/** The blocks and battle assets that may take the next step loss now (6.43), the suggested one first. */
export function lossOptions(g: Game, b: Battle): string[] {
  return b.stage === 'loss' && b.loss ? (lossCands(g, b, b.loss.side) ?? []) : [];
}
/** 6.43: the owner places one step loss. */
export function chooseLoss(g: Game, b: Battle, key: string) {
  if (b.stage !== 'loss' || !b.loss) throw new Error('no loss to place');
  if (!lossOptions(g, b).includes(key))
    throw new Error(
      "that block or asset cannot take this loss (6.43: everyone takes one before anyone takes a second; the first unit loss is the point unit's)",
    );
  const run = b.loss;
  takeLoss(g, b, run.side, key);
  run.left--;
  runLosses(g, b, run);
}
/** The rest of the losses in the suggested order (assets first, then the point unit, then the weakest). */
export function autoLosses(g: Game, b: Battle) {
  if (b.stage !== 'loss' || !b.loss) throw new Error('no loss to place');
  runLosses(g, b, b.loss, true);
}
/** One automatic loss (the first hit on an attacker with no battle asset: always the point unit). */
export function allocate(g: Game, b: Battle, side: Side, n: number) {
  for (let i = 0; i < n; i++) {
    const c = lossCands(g, b, side);
    if (!c) return n - i;
    takeLoss(g, b, side, c[0]);
  }
  return 0;
}
export const allGone = (g: Game, b: Battle, side: Side) =>
  !unitsIn(g, b.area, side).length && !b.assets[side].some((id) => isBattleAsset(chit(g, id)));
export function next(g: Game, b: Battle) {
  fixPoint(g, b);
  if (!unitsIn(g, b.area, b.attacker).filter((u) => !u.garrison || !!CUR.battleAllowed?.(g, b.area)).length)
    return end(g, b, 'Attacker eliminated'); // Sicily 17.22: a flanking invasion attacks alone
  if (!fighters(g, b.area, b.attacker, true).length) {
    b.queue = [];
    return end(g, b, 'No attacker left in good order');
  } // 6.2: disordered units cannot carry the attack
  if (b.pz150 && (!b.queue.length || b.queue[0] === 'defFire' || b.queue[0] === 'offFire')) {
    pz150Check(g, b);
    const def = other(b.attacker);
    if (allGone(g, b, def)) {
      b.result = 'Defender eliminated';
      b.queue = [];
      return end(g, b, b.result);
    }
  }
  const s = b.queue.shift();
  if (!s) return end(g, b, b.result ?? 'Area remains contested');
  if (s === 'attArty' || s === 'defArty') {
    const side = s === 'attArty' ? b.attacker : other(b.attacker);
    if (!fireList(g, b, side, 'arty').length) return next(g, b);
  }
  b.stage = s;
  return;
}
export const exploitSn = (g: Game, u: Unit) => CUR.moraleSn(g, u, 'exploit');
export function roll_step(g: Game, b: Battle) {
  const st = b.stage;
  if (st === 'loss') return autoLosses(g, b); // "roll on": the losses go in the suggested order
  if (st === 'exploit') {
    // 6.8: each attacking armor-class unit rolls; a pass earns the exploitation marker
    for (const id of b.exploitIds ?? []) {
      const u = g.units.find((x) => x.id === id)!;
      if (u.area !== b.area) continue;
      const sn = exploitSn(g, u),
        r = roll(g),
        ok = succeeds(r, sn);
      if (ok) u.exploit = true;
      b.rolls.push({ who: u.name, sn, dice: [r], hits: ok ? 1 : 0, kind: 'morale' });
      say(g, `${u.name} exploitation morale check: rolled ${r} (needs ${sn} or less) → ${ok ? 'exploitation marker' : 'failed'}`);
    }
    b.exploitIds = undefined;
    b.stage = 'done';
    return;
  }
  if (st === 'attArty') {
    const h = doFire(g, b, b.attacker, 'arty');
    return hitDefender(g, b, h, 'arty');
  }
  if (st === 'defArty' || st === 'defFire') {
    const h = doFire(g, b, other(b.attacker), st === 'defArty' ? 'arty' : 'ground');
    b.lossKind = st === 'defArty' ? 'arty' : 'ground';
    return hitAttacker(g, b, h);
  }
  if (st === 'offFire') {
    const eng = engRemovesFw(g, b); // 6.33: after artillery and defensive fire, before the attackers fire; the engineer does not fire
    if (eng) {
      g.fieldWorks = g.fieldWorks.filter((x) => x !== b.area);
      say(g, 'engineer removes the field works (6.33)');
    }
    const h = doFire(g, b, b.attacker, 'ground', eng);
    return hitDefender(g, b, h, 'ground');
  }
  throw new Error('nothing to roll');
}
