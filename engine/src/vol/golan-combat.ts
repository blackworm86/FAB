// FAB Vol. III, Golan '73: combat by the Combat Play Aid (success and morale numbers, asset limits 15.12, who may assign what, SAMs 16.12, garrisons and raids 16.2, what changes the fire).
import { areas } from '../map';
import { HERMON, eastOfSam, type GSide } from '../golan/map';
import {
  assetLimits,
  brigadeExtraDie,
  moraleSn as gMoraleSn,
  successNumber as gSuccessNumber,
  type GShooter,
  type GTarget,
} from '../golan/combat';
import { isArty, isBattleAsset, type Chit } from '../chits';
import { airOf, chit, inSupply, other, rollDie, say, unitsIn, type Battle, type Game, type Side, type Unit, type Fire } from '../game';
import type { Shooter, Target, Setting } from '../combat';
import { battleState, isNight, optionalFire, q, raidUnitAt, regular, state } from './golan';

/* ================= combat (Combat Play Aid, 15.12, 15.51, 16.12, 16.21, 16.22, 16.24, 17.33, 17.34) ================= */
export const golanSuccessNumber = (s: Shooter, t: Target, c: Setting) =>
  gSuccessNumber(s as unknown as GShooter, t as GTarget, {
    firerIsAttacker: c.attacker,
    tdn: c.tdn,
    assault: c.riverAssault,
    night: c.night,
  });
export const golanMoraleSn = (g: Game, u: Unit, why: 'exploit' | 'supply' | 'check') =>
  gMoraleSn(q(u), {
    disordered: u.disorder > 0,
    unsupplied: why === 'supply' || u.unsupplied,
    nightExploitation: why === 'exploit' && isNight(g),
  });
const mixedDivisions = (g: Game, a: number, side: Side = 'syrian') =>
  new Set(
    unitsIn(g, a, side)
      .filter((u) => regular(u) && u.division)
      .map((u) => u.division),
  ).size > 1; // 15.12; 18.5 (optional) for Israel
/** How many assets a side may commit here (6.22/6.23, 15.12 mixed Syrian divisions, 16.21 Mt Hermon, 16.22 Israeli air against SAMs). */
export function limits(g: Game, b: Battle, side: Side) {
  const V = state(g);
  if (g.control[HERMON] === 'syrian') V.hermonLost = true; // 16.21: for the rest of the game
  const hermon = side === 'israeli' && !V.hermonLost && g.control[HERMON] === 'israeli' && unitsIn(g, HERMON, 'israeli').length > 0;
  const samUp = g.chits.some((c) => c.kind === 'sam' && c.box === 'available');
  const lim = assetLimits(side as GSide, side === b.attacker, {
    mixedDivisions: (side === 'syrian' || !!g.opts.israeliDivisions) && mixedDivisions(g, b.area, side),
    israeliHoldsHermon: hermon,
    eastOfSamBarrier: eastOfSam(b.area),
    samAvailable: samUp,
  });
  const alone = unitsIn(g, b.area, side).every((u) => u.garrison); // 4.35, 16.24, 16.11a, 17.23: a garrison, raid or Lt. Zvika fighting alone
  return alone ? { ...lim, artillery: 1, battle: 0, events: 0, air: 0, alone } : { ...lim, alone };
}
export function canAssign(g: Game, b: Battle, side: Side, c: Chit, mode?: 'arty' | 'support'): string | null {
  const V = state(g),
    B = battleState(b);
  if (side !== b.attacker && B.ew?.pending) return 'answer the jamming first (17.33)';
  if (side !== b.attacker && B.defLocked) return 'all defending units are jammed: no artillery, air, SAM or battle assets (17.33)';
  const lim = limits(g, b, side),
    mine = b.assets[side].map((id) => chit(g, id));
  if (lim.alone && !isArty(c)) return 'a standing asset fighting alone gets one artillery asset only (4.35)';
  if (c.kind === 'air_mission') {
    if (lim.battle === 0 && (mode ?? 'arty') === 'support') return 'mixed divisions: air support may only fire as artillery (15.12)'; // 16.31a, 16.22; air needs no supply
    if (isNight(g)) return 'no air support on the night turn (14.03)';
    if (g.opts.syrianAirAttack && side === 'syrian' && b.attacker !== 'syrian')
      return 'Syrian air support flies close air support only when Syria attacks (18.4)';
    if (side === 'israeli' && B.samCancelled)
      return 'a SAM cancelled the air mission here: no replacement air asset in this battle (16.12)';
    const air = airOf(b, side);
    if (air.length >= lim.air) return lim.air === 2 ? 'at most two air support assets' : 'one air support asset per battle';
    if (air.length === 1 && air[0].mode === (mode ?? 'arty'))
      return 'with two air assets, one fires as artillery and the other supports a unit (16.22)';
    return null;
  }
  if (V.airAssaultArea === b.area && side === 'syrian' && !inSupply(g, side, b.area))
    return 'an air assault that cannot trace supply gets only one air support asset (15.3)';
  if (!inSupply(g, side, b.area) || unitsIn(g, b.area, side).some((u) => u.unsupplied))
    return 'units that cannot trace supply may not have assets (9.34a)';
  const hermonOk = (x: Chit) =>
    ['infantry_asset', 'commando', 'engineer'].includes(x.kind) || (x.kind === 'task_force' && x.name.includes('infantry')); // 13.3 infantry class
  if (b.area === HERMON && !hermonOk(c)) return 'on Mt Hermon only infantry-class battle assets and air support (14.16)';
  if (isArty(c)) return mine.filter(isArty).length >= lim.artillery ? `at most ${lim.artillery} artillery asset(s)` : null;
  if (isBattleAsset(c)) {
    if (c.kind === 'commando' && c.side !== 'syrian') return 'Syrian only';
    return mine.filter(isBattleAsset).length >= lim.battle
      ? lim.battle
        ? `at most ${lim.battle} battle assets`
        : side === 'syrian'
          ? 'mixed Syrian divisions: no battle assets (15.12)'
          : 'mixed Israeli divisions: no battle assets (18.5)'
      : null;
  }
  return 'this counter is not assigned to battles (events come with the event rules)';
}
export const samAvailable = (g: Game) => g.chits.some((c) => c.kind === 'sam' && c.box === 'available');
/** 16.12: an Israeli air asset placed east of the SAM barrier may be answered at once by an available SAM. */
export function onAssign(g: Game, b: Battle, c: Chit) {
  if (
    c.kind === 'air_mission' &&
    c.side === 'israeli' &&
    eastOfSam(b.area) &&
    samAvailable(g) &&
    !(b.attacker === 'israeli' && battleState(b).defLocked)
  )
    state(g).samTarget = c.id;
} // 17.33: a jammed defence fires no SAM
export function beforeBegin(g: Game, b: Battle) {
  if (state(g).samTarget) throw new Error('the SAM answer to the air mission is pending (16.12)');
  if (battleState(b).ew?.pending) throw new Error('the Defender must answer the jamming first (17.33)');
}
/** The air mission taken back (or its battle withdrawn): no SAM answer is pending any more. */
export function onUnassign(g: Game, b: Battle, c: Chit) {
  const V = state(g),
    B = battleState(b);
  if (V.samTarget === c.id) V.samTarget = undefined;
  if (B.dcs) B.dcs = B.dcs.filter((x) => x !== c.id);
}
export function onBattle(g: Game, b: Battle, when: 'begin' | 'end') {
  const V = state(g);
  if (when === 'begin')
    for (const u of unitsIn(g, b.area))
      if (u.ghost) {
        u.area = null;
        u.str = 0;
        say(g, `A Ghost is revealed in ${areas.get(b.area)!.name} and removed (15.7)`);
      }
  if (when === 'end') {
    for (const u of g.units)
      if (u.rec) {
        u.rec = 0;
        if (u.area != null && u.disorder === 0) u.disorder = 2;
      } // artillery vs armour: one marker stays, the unit recovers in the Supply Phase
    if (V.airAssaultArea === b.area) V.airAssaultArea = undefined;
    V.raids = V.raids.filter((a) => raidUnitAt(g, a));
    V.raidPartial = V.raidPartial.filter((a) => raidUnitAt(g, a));
    if (g.control[HERMON] === 'syrian') V.hermonLost = true;
  }
}
/** Brigade integrity (15.51), the Moroccans' passivity (17.24), a partly successful raid (16.11a) and an engineer bridging instead of firing (14.51b). */
export function adjustFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground', list: Fire[]) {
  optionalFire(g, b, side, kind, list);
  if (kind !== 'ground') return;
  const V = state(g),
    B = battleState(b),
    drop = (f: (x: Fire) => boolean) => {
      for (let i = list.length - 1; i >= 0; i--) if (f(list[i])) list.splice(i, 1);
    };
  if (side === b.attacker && V.kingHassan) drop((f) => f.key === 'S07');
  if (side === 'syrian' && V.raidPartial.includes(b.area))
    drop((f) => {
      const u = g.units.find((x) => x.id === f.key);
      return !!u?.garrison && !!u.chitId && chit(g, u.chitId).kind === 'commando';
    });
  if (side === b.attacker && B.engBridge) {
    const i = list.findIndex((f) => f.isAsset && b.assets[side].includes(f.key) && chit(g, f.key).kind === 'engineer');
    if (i >= 0) list.splice(i, 1);
  } // one engineer bridges, the others fire
  if (side === 'israeli') {
    const firers = list
      .filter((f) => !f.isAsset)
      .map((f) => ({ brigade: g.units.find((u) => u.id === f.key)?.brigade, sn: f.sn, side: side as GSide }))
      .filter((x): x is { brigade: string; sn: number; side: GSide } => !!x.brigade);
    for (const x of brigadeExtraDie(firers))
      list.push({
        key: `brigade:${x.brigade}`,
        who: `${x.brigade} brigade integrity`,
        shooter: { kind: 'unit', cls: 'infantry', dice: 1 },
        dice: 1,
        sn: x.sn,
        parts: [['brigade integrity extra die (15.51)', 0]],
        isAsset: true,
      });
  }
}
/** 14.51b: the engineer survived both fire steps: the ditch is bridged as the attackers fire (it does not fire itself). */
export function beforeFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground') {
  const B = battleState(b);
  if (kind !== 'ground' || side !== b.attacker || !B.engBridge) return;
  const engineers = b.assets.syrian.filter((id) => chit(g, id).kind === 'engineer').length;
  if (b.engFw && engineers < 2) {
    B.engBridge = undefined;
    say(g, 'The one engineer removes the field works: the ditch is not bridged (6.33, 14.51b)');
    return;
  }
  if (engineers && state(g).bridgedDitch.length < 8) {
    state(g).bridgedDitch.push(B.engBridge);
    say(g, `A Syrian engineer bridges the AT ditch ${B.engBridge} (14.51b)`);
  }
}
/** 17.34 Counterbattery: after the enemy artillery fired, 1–5 sends one of its artillery assets that many turns down the track. */
export function afterFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground') {
  const B = battleState(b);
  if (kind === 'ground' && side === b.attacker) B.engBridge = undefined;
  if (kind !== 'arty') return;
  const enemy = other(side);
  if (!B.counterbattery[enemy]) return;
  B.counterbattery[enemy] = undefined;
  const target = b.assets[side].map((id) => chit(g, id)).find(isArty);
  if (!target) return;
  const die = rollDie(g);
  b.rolls.push({ who: 'Counterbattery (17.34)', sn: 5, dice: [die], hits: die <= 5 ? 1 : 0, kind: 'morale' });
  if (die > 5) return say(g, `Counterbattery: ${die}, no effect`, enemy);
  target.box = 'future';
  target.turn = g.turn + die;
  target.direct = true;
  target.area = undefined;
  b.assets[side] = b.assets[side].filter((x) => x !== target.id);
  say(g, `Counterbattery: ${die}, ${target.name} is put back ${die} turn(s), to turn ${g.turn + die} (17.34)`, enemy);
}
