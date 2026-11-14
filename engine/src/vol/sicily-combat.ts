// FAB Vol. II, Sicily: combat. Success and morale numbers, beach assaults (14.27), who may assign what, dogfights (16.32), untried garrisons revealed (15.3b), Italian morale (15.2), naval shock and the Rangers (16.2x), aborting, retreats to the sea.
import { connection } from '../map';
import { ETNA, isBox, area as sarea } from '../sicily/map';
import { isArty, isBattleAsset, type Chit } from '../chits';
import { moraleSn, successNumber, type Shooter, type Target, type Setting } from '../combat';
import {
  airOf,
  blocks,
  chit,
  contested,
  eliminate,
  inSupply,
  moraleCheck,
  other,
  quality,
  say,
  sidesOf,
  unitsIn,
  SEA,
  type Battle,
  type Game,
  type Side,
  type Unit,
  type Fire,
} from '../game';
import { etnaFree, isReleased, seaRetreat, toSea, zoneOk, zonesAt } from './sicily-moves';
import { afterChange, captureBeachhead } from './sicily-turn';
import { nameOf, nation, need, regular, state } from './sicily';

/* ================= combat (14.27, 15.2, 15.3b, 16.11, 16.2x, 16.3, 17.21d-f) ================= */
export interface SicilyBattle {
  flank?: boolean;
  noAir: Partial<Record<Side, boolean>>;
  airborne?: string;
}
export const battleState = (b: Battle) => (b.vol ??= { noAir: {} }) as unknown as SicilyBattle;
export const sicilySn = (s: Shooter, t: Target, c: Setting) => successNumber(s, t, c);
export const sicilyMoraleSn = (g: Game, u: Unit, why: 'exploit' | 'supply' | 'check') =>
  moraleSn(quality(u), u.disorder > 0, (why === 'supply' || u.unsupplied) && !(g.opts.airborne && u.symbol === 'airborne')); // 18.1
/** 14.27: any assault from a landing box or the air is a River Assault; otherwise the series river rule. */
export function assault(g: Game, area: number, entered: { id: string; river: boolean; blown: boolean }[]) {
  const V = state(g);
  if (V.beachAssault[area] != null || V.airborneAreas.includes(area)) return true;
  const att = blocks(g, area, g.phasing);
  return att.length > 0 && att.every((u) => entered.some((e) => e.id === u.id && e.river)) && entered.some((e) => e.blown);
}
export function canAssign(g: Game, b: Battle, side: Side, c: Chit, mode?: 'arty' | 'support'): string | null {
  const B = battleState(b),
    V = state(g),
    mine = b.assets[side].map((id) => chit(g, id)),
    att = side === b.attacker;
  const own = unitsIn(g, b.area, side),
    dr = !own.some(regular) && own.find((u) => u.id.startsWith('DR-'));
  if (dr)
    return isArty(c) && c.kind !== 'naval_support' && c.ech === dr.ech && !mine.some(isArty)
      ? null
      : 'a defended roadblock gets one artillery asset of its own army, nothing else (4.35)';
  if (c.kind === 'air_mission') {
    // 16.3: regardless of supply; 16.32: one per side
    if (B.noAir[side]) return 'the dogfight settled the air over this battle (16.31)';
    if (airOf(b, side).length) return 'one air support asset per side in a battle (16.32)';
    void mode;
    return null;
  }
  if (
    unitsIn(g, b.area, side).some((u) => u.unsupplied && regular(u)) ||
    (unitsIn(g, b.area, side).some(regular) && !inSupply(g, side, b.area))
  )
    return 'units that cannot trace supply may not have assets (9.34a)'; // 17.22(iii): a flanking invasion alone needs no supply
  if (V.flank[b.area] && side === 'allied' && c.kind !== 'naval_support')
    return 'a flanking invasion gets only air and naval support (17.22)';
  if (c.kind === 'naval_support' && !sarea(b.area)?.coastal) return 'naval support only in coastal areas (16.21)';
  if (side === 'allied' && !c.strategic && c.nation && !unitsIn(g, b.area, 'allied').some((u) => nation(u) === c.nation && regular(u)))
    return `${c.nation === 'us' ? 'American' : 'British'} assets only assist their own army (16.2)`;
  const armies = new Set(
      unitsIn(g, b.area, side)
        .filter(regular)
        .map((u) => u.ech),
    ),
    mixed = armies.size > 1; // 6.22/6.23: US 7th and British 8th Army
  if (isArty(c)) {
    const cap = mixed ? (att ? armies.size : 1) : att ? 2 : 1,
      arts = mine.filter(isArty);
    if (arts.length >= cap) return `at most ${cap} artillery asset(s) for the ${att ? 'Attacker' : 'Defender'}`;
    if (mixed && att && arts.some((x) => x.nation === c.nation)) return 'mixed Higher Echelons: one artillery asset per army (6.22)';
    return null;
  }
  if (isBattleAsset(c)) {
    if (mixed) return 'units of different Higher Echelons: no battle assets (6.22, 6.23)';
    if (c.nation === 'italian' && mine.some((x) => x.nation === 'italian' && isBattleAsset(x)))
      return 'at most one Italian battle asset per battle (16.11)';
    const cap = att ? 8 : 5;
    return mine.filter(isBattleAsset).length >= cap ? `at most ${cap} battle assets for the ${att ? 'Attacker' : 'Defender'}` : null;
  }
  void V;
  return 'this counter is not assigned to battles (events come with the event rules)';
}
/** 16.31: cancel the enemy's air support over this battle with one of your own; both are used and neither side commits more air. */
export function dogfight(g: Game, b: Battle, chitId: string) {
  const c = chit(g, chitId),
    enemy = other(c.side);
  need(c.kind === 'air_mission' && c.box === 'available' && b.stage === 'setup', 'an available air support asset, before the first roll');
  const target = airOf(b, enemy)[0];
  need(target, 'the enemy has no air support in this battle');
  need(!airOf(b, c.side).length, 'your air commitment to this battle is already made (16.32)');
  const t = chit(g, target.id);
  t.box = 'used';
  c.box = 'used';
  b.assets[enemy] = b.assets[enemy].filter((x) => x !== t.id);
  for (const s of sidesOf(g)) {
    if (b.air[s]?.id === t.id) delete b.air[s];
    if (b.air2?.[s]?.id === t.id) delete b.air2[s];
  }
  const B = battleState(b);
  B.noAir[c.side] = true;
  B.noAir[enemy] = true;
  say(g, `Dogfight: ${c.name} cancels the enemy air support over ${nameOf(b.area)} (16.31)`, c.side);
}
export function onBattle(g: Game, b: Battle, when: 'begin' | 'end') {
  const V = state(g),
    B = battleState(b);
  if (when === 'begin') {
    if (V.flank[b.area]) B.flank = true;
    const ab = unitsIn(g, b.area, 'allied').find((u) => u.symbol === 'airborne' && V.airborneAreas.includes(b.area) && u.moved);
    if (ab && b.attacker === 'allied') {
      b.attPoint = ab.id;
      B.airborne = ab.id;
      say(g, `${ab.name} leads the airborne assault (14.27a)`);
    }
    italianMorale(g, b);
  }
  if (when === 'end') {
    for (const u of unitsIn(g, b.area, 'axis'))
      if (u.untried) {
        u.untried = false;
        say(g, `${u.name} is now a tried unit (15.3d)`);
      }
    delete V.navalShock[`${b.area}`];
    delete V.rangerFw[`${b.area}`];
    const box = V.beachAssault[b.area];
    if (box != null && b.attacker === 'allied' && (b.result ?? '').startsWith('Attack aborted')) {
      // 14.27b: an aborted beach assault retreats to sea and loses the beachhead
      for (const u of g.units.filter((x) => x.side === 'allied' && (x.area === b.area || x.area === box) && x.str > 0))
        toSea(g, u, 'the beach assault is aborted, 14.27b');
      if (V.beachheads[box] != null) captureBeachhead(g, box, 'captured: the beach assault was aborted (14.27b)');
    }
    if (V.flank[b.area] && !unitsIn(g, b.area, 'allied').some((u) => u.garrison && u.chitId === V.flank[b.area])) delete V.flank[b.area];
    afterChange(g);
  }
}
/** 15.3b and 17.21d-f: the Italian units in the battle check morale as the level of Italian morale demands, once the blocks are revealed. */
function italianMorale(g: Game, b: Battle) {
  const V = state(g),
    L = V.morale,
    its = unitsIn(g, b.area, 'axis').filter((u) => nation(u) === 'italian' && regular(u) && u.str > 0);
  const checkOne = (u: Unit, why: string, lossOnFail: boolean) => {
    const sn = sicilyMoraleSn(g, u, 'check'),
      { r, ok } = moraleCheck(g, u, sn, why);
    b.rolls.push({ who: `${u.name}: ${why}`, sn, dice: [r], hits: ok ? 0 : 1, kind: 'morale' });
    if (ok) return say(g, `${u.name} holds (${r} vs ${sn}, ${why})`);
    if (!lossOnFail) {
      u.disorder = 1;
      return say(g, `${u.name} is disordered (${r} vs ${sn}, ${why})`);
    }
    const q = quality(u),
      surrender = (q === 'veteran' && r === 10) || (q === 'green' && r >= 8);
    if (surrender) {
      say(g, `${u.name} surrenders (${r}, 17.21f)`);
      eliminate(g, u);
      return;
    }
    u.str--;
    if (u.str <= 0) eliminate(g, u);
    else say(g, `${u.name} loses a step (${r} vs ${sn}, ${why})`);
  };
  for (const u of its) {
    if (u.untried) {
      if (L === 0) checkOne(u, 'untried unit revealed (15.3b)', false);
      else {
        u.disorder = 1;
        say(g, `${u.name} (untried) is disordered: Fading Italian Morale level ${L} (17.21d)`);
        if (L >= 2) checkOne(u, `Fading Italian Morale level ${L} (17.21d)`, true);
      }
    } else if (L === 1) {
      if (u.disorder !== 1) checkOne(u, 'Fading Italian Morale level 1 (17.21e)', false);
    } else if (L === 2) {
      if (u.disorder !== 1) {
        u.disorder = 1;
        say(g, `${u.name} is disordered: Fading Italian Morale level 2 (17.21e)`);
      }
    } else if (L >= 3) {
      if (u.disorder === 1) checkOne(u, 'Fading Italian Morale level 3 (17.21e)', true);
      else {
        u.disorder = 1;
        say(g, `${u.name} is disordered: Fading Italian Morale level 3 (17.21e)`);
      }
    }
  }
}
/** Divisional integrity (15.2), the green untried units' cap (15.3b), the Shock-and-Awe naval asset and the Rangers that remove field works instead of firing (16.21, 16.22). */
export function adjustFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground', list: Fire[]) {
  const V = state(g),
    key = `${b.area}`;
  if (kind === 'arty' && V.navalShock[key])
    for (let i = list.length - 1; i >= 0; i--) if (list[i].key === V.navalShock[key]) list.splice(i, 1);
  if (kind !== 'ground') return;
  if (V.rangerFw[key] && side === b.attacker)
    for (let i = list.length - 1; i >= 0; i--) if (list[i].key === V.rangerFw[key]) list.splice(i, 1);
  for (const f of list) {
    const u = g.units.find((x) => x.id === f.key);
    if (u?.untried && quality(u) === 'green') {
      f.parts = f.parts.filter(([why, v]) => why === 'base' || v <= 0);
      /* the base Success Number stays; only the bonuses go */ f.sn = f.parts.reduce((n, [, v]) => n + v, 0);
    }
  }
  const byDiv = new Map<string, Fire[]>();
  for (const f of list) {
    const u = g.units.find((x) => x.id === f.key);
    if (u && regular(u) && u.division && !u.untried) (byDiv.get(u.division) ?? byDiv.set(u.division, []).get(u.division)!).push(f);
  }
  for (const [d, fs] of byDiv)
    if (fs.length >= 2)
      list.push({
        key: `division:${d}`,
        who: `${g.units.find((x) => x.id === fs[0].key)!.name}: divisional integrity`,
        shooter: { kind: 'unit', cls: 'infantry', dice: 1 },
        dice: 1,
        sn: Math.min(...fs.map((f) => f.sn)),
        parts: [['divisional integrity extra die (15.2)', 0]],
        isAsset: true,
      });
}
/** 16.21 Shock and Awe: the naval bombardment that removes the defending field works is the first act of each battle. */
function navalShockFirst(g: Game, b: Battle) {
  const V = state(g),
    id = V.navalShock[`${b.area}`],
    def = other(b.attacker);
  if (id && b.assets[b.attacker].includes(id) && g.fieldWorks.includes(b.area) && (g.fwOwner[b.area] ?? def) === def) {
    g.fieldWorks = g.fieldWorks.filter((a) => a !== b.area);
    say(g, `${chit(g, id).name} removes the field works in ${nameOf(b.area)} (16.21)`, b.attacker);
  } else if (id) delete V.navalShock[`${b.area}`]; // no field works to remove: it fires as artillery
}
/** The field works go before the fire of the step the asset gave up (16.21 naval support first; 16.22 Rangers in the ground step, if the attack goes on and they survived). */
export function beforeFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground') {
  const V = state(g),
    key = `${b.area}`,
    def = other(b.attacker);
  if (side !== b.attacker) return;
  // the naval asset's bombardment is the first act of the battle (beforeBegin); the Rangers act in the ground step
  for (const [id, rule] of (kind === 'arty' ? [] : [[V.rangerFw[key], '16.22']]) as [string | undefined, string][]) {
    if (id && b.assets[side].includes(id) && g.fieldWorks.includes(b.area) && (g.fwOwner[b.area] ?? def) === def) {
      g.fieldWorks = g.fieldWorks.filter((a) => a !== b.area);
      say(g, `${chit(g, id).name} removes the field works in ${nameOf(b.area)} (${rule})`, side);
    } else if (id) delete V.rangerFw[key]; // nothing left to remove: it rolls as usual
  }
}
/** 16.21 Shock and Awe: a committed naval support asset of the attacker removes the defending field works instead of firing. */
export function setNavalShock(g: Game, b: Battle, chitId: string | null) {
  const V = state(g),
    key = `${b.area}`;
  if (chitId == null) {
    delete V.navalShock[key];
    return;
  }
  const c = chit(g, chitId);
  need(
    b.stage === 'setup' && c.side === b.attacker && c.kind === 'naval_support' && b.assets[c.side].includes(chitId),
    'a naval support asset of the attacker, committed to this battle',
  );
  V.navalShock[key] = chitId;
}
/** 16.22 / 16.23: a Ranger or Commando asset of the attacker removes the field works instead of rolling. */
export function setRangerFw(g: Game, b: Battle, chitId: string | null) {
  const V = state(g),
    key = `${b.area}`;
  if (chitId == null) {
    delete V.rangerFw[key];
    return;
  }
  const c = chit(g, chitId);
  need(
    b.stage === 'setup' &&
      c.side === b.attacker &&
      (c.subtype === 'ranger' || c.subtype === 'commando') &&
      b.assets[c.side].includes(chitId),
    'a Ranger or Commando asset of the attacker, committed to this battle',
  );
  V.rangerFw[key] = chitId;
}
export const canAbort = (_g: Game, b: Battle) => (battleState(b).airborne ? 'an airborne assault may not be aborted (14.27a)' : null);
export function beforeBegin(g: Game, b: Battle) {
  const V = state(g);
  need(!V.dropPending, 'place the airborne units first (14.27a)');
  const first = V.airborneAreas.filter((a) => contested(g, a) && !g.fought.includes(a));
  need(!first.length || first.includes(b.area), `the airborne assault in ${nameOf(first[0] ?? 0)} is fought first (14.27a)`);
  navalShockFirst(g, b);
}
/** 14.41: zone B is prohibited to the Americans, zone D to the British. */
const prohibited = (u: Unit, g: Game, a: number) =>
  nation(u) === 'us' ? zonesAt(g, a).every((z) => z === 'B') : zonesAt(g, a).every((z) => z === 'D');
/** 14.43: retreat within the army's zones first, to sea before any prohibited crossing. */
export function retreatPrefer(g: Game, u: Unit, from: number, opts: number[]) {
  if (u.side !== 'allied') return opts;
  const ok = opts.filter((n) => zoneOk(g, u, n));
  if (ok.length) return ok;
  if (seaRetreat(g, u, from)) return [];
  const notProhibited = opts.filter((x) => !prohibited(u, g, x)); // 14.41: never zone B (US) / zone D (British) if anything else is open
  return notProhibited.length ? notProhibited : opts;
}
export function onRetreat(g: Game, u: Unit, _from: number, to: number) {
  if (u.side === 'allied' && to !== SEA && !zoneOk(g, u, to) && !prohibited(u, g, to) && u.division && !isReleased(g, u)) {
    /* only the restricted-boundary case releases (14.43) */ state(g).released.push(u.division);
    say(g, `${u.name} retreats across its army boundary: its division counts as released (14.43)`);
  }
}
export const retreatOk = (g: Game, u: Unit, from: number, to: number) => {
  if (isBox(to)) return state(g).beachAssault[from] === to;
  /* 14.27b: an aborted beach assault falls back to its box, then to sea */ const c = connection(from, to)!;
  if (c.restricted && (u.cls === 'armor' || c.type !== 'road' || g.control[ETNA] !== u.side || (to === ETNA && etnaFree(g) !== u.side)))
    return false;
  /* 14.1: the controller leaves by road; enters only uncontested */ return !(u.side === 'axis' && state(g).flank[to]);
};
