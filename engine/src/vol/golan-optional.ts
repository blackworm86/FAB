// FAB Vol. III, Golan '73: the additional optional rules of the Battle for Nafakh and Al-Owda sheets (18.x: AT assets, T-62s, chemical warfare, the flank assault, direct support, artillery against armour, the Lt. Zvika variant, battlefield recovery, advanced ghosts), and how they change fire, losses and retreats.
import { connection, edgeKey } from '../map';
import { isAssembly } from '../golan/map';
import { reachable, type GMoveCtx } from '../golan/move';
import { isArty, type Chit } from '../chits';
import {
  airOf,
  blocks,
  chit,
  contested,
  eliminate,
  moraleCheck,
  other,
  say,
  saAvailable,
  spendSA,
  unitsIn,
  updateControl,
  type Battle,
  type Game,
  type Side,
  type Unit,
  type Fire,
  type OptionalRule,
} from '../game';
import { asMover, evacuateStrongpoint } from './golan-moves';
import { golanMoraleSn } from './golan-combat';
import { battleState, isAlOwda, nameOf, need, regular, state, unit } from './golan';

/* ================= additional optional rules (the Battle for Nafakh and Al-Owda scenario sheets, 18.x) ================= */
export const GOLAN_OPTIONAL: OptionalRule[] = [
  {
    key: 'fwMaintain',
    rule: '18.1',
    name: 'Maintaining field works',
    text: 'Field works in a contested area are not removed automatically: in his own Supply Phase the owner checks morale with one unit there, and only a failure removes them.',
  },
  {
    key: 'withdrawal',
    rule: '18.2',
    name: 'Withdrawal',
    text: 'The last unit to leave a contested area in the Movement Phase checks morale; failing, it is disordered and its move ends at once.',
  },
  {
    key: 'artyInterdict',
    rule: '18.31',
    name: 'Artillery interdiction',
    text: 'Once per Admin Phase each player may place an available artillery asset next to his units or a strongpoint: the enemy pays +1 MP to enter and to leave, and may not strat-move in or out, until the second Supply Phase.',
  },
  {
    key: 'directSupport',
    rule: '18.32',
    name: 'Direct combat support (Israeli)',
    text: 'Israeli artillery assigned to a battle may support instead of firing: +1 to the point unit per asset.',
  },
  {
    key: 'syrianAirAttack',
    rule: '18.4',
    name: 'Syrian air support use',
    text: 'Syrian air support flies close air support only when Syria is the Attacker.',
  },
  {
    key: 'israeliDivisions',
    rule: '18.5',
    name: 'Israeli divisional organization',
    text: 'Israeli units of different divisions in one area: one artillery asset, no battle assets (as 15.12); merging units (14.61a) must be of the same division.',
  },
  {
    key: 'atAssets',
    rule: '18.6',
    name: 'Anti-tank assets',
    text: 'Syrian AT assets fire +1 when the enemy point unit is armour. When Syria defends with an AT asset assigned, Israeli armour fires −1. In Al-Owda (its own sheet): only a defending Syrian AT asset gets the +1, and there is no −1.',
  },
  {
    key: 't62',
    rule: '18.7',
    name: 'Syrian T-62 tanks',
    text: 'The 65th, 76th, 81st, 91st and Assad armoured units pay one extra MP to cross a field connection.',
  },
  {
    key: 'artyArmor',
    rule: '18.8',
    name: 'Artillery vs armour',
    text: 'Armour takes a recovery marker instead of a step loss from artillery; each marker is −1 in ground fire. After the battle one marker stays (the unit is recovering) until the Supply Phase.',
  },
  {
    key: 'zvikaCup',
    rule: '18.9',
    name: 'Lt. Zvika variant',
    text: 'In the Supply Phase Israel may take Lt. Zvika back off the map into the Selection Cup, to play him again when drawn.',
  },
  {
    key: 'raidMod',
    rule: '18.10',
    name: 'Commando raid modifier',
    text: 'A commando raid east of the SAM barrier gets −1 on the die (better for Syria).',
  },
  {
    key: 'battleRecovery',
    rule: '18.11',
    name: 'Battlefield recovery',
    text: 'Disordered or recovering units in a contested area improve in the Supply Phase only by passing a morale check.',
  },
  {
    key: 'chemical',
    rule: 'A 18.7',
    name: 'Chemical warfare',
    text: 'As the defender, Syria spends the reusable Special Action: one artillery asset (or air support firing as artillery) fires +2. Every use after the first gives Israel 1 VP.',
  },
  {
    key: 'flank',
    rule: 'A 18.8',
    name: 'Flank assault (Israelis)',
    text: 'Attacking with two units, Israel spends a Special Action: the second unit flanks, fires +1 and takes no hits while the point unit stands.',
  },
  {
    key: 'advGhosts',
    rule: 'A 18.10',
    name: 'Advanced ghost units',
    text: 'Ghosts move (as armour or infantry), may be reserves, never create a contested area, overstack by one, and vanish when a Syrian unit enters their area alone. In Al-Owda a ghost drawn from the cup arrives in an Assembly Area.',
  },
];
export const T62 = new Set(['S19', 'S20', 'S21', 'S26', 'S27']); // 65th, 76th, 81st, 91st, Assad (all Elite)
const isAT = (c: Chit) => c.side === 'syrian' && /\bAT$/.test(c.name);
const pointOf = (g: Game, b: Battle, side: Side) => g.units.find((u) => u.id === (side === b.attacker ? b.attPoint : b.defPoint));
const bump = (f: Fire, by: number, why: string) => {
  f.sn += by;
  f.parts.push([why, by]);
};
export function optionalFire(g: Game, b: Battle, side: Side, kind: 'arty' | 'ground', list: Fire[]) {
  const o = g.opts,
    B = battleState(b),
    enemyPoint = pointOf(g, b, other(side));
  if (o.chemical && kind === 'arty' && B.chem) for (const f of list) if (f.key === B.chem) bump(f, 2, 'chemical warfare');
  const dcs = o.directSupport && side === 'israeli' ? (B.dcs ?? []).filter((id) => b.assets.israeli.includes(id)) : []; // 18.32: they support instead of firing
  if (kind === 'arty' && dcs.length) for (let i = list.length - 1; i >= 0; i--) if (dcs.includes(list[i].key)) list.splice(i, 1);
  if (kind !== 'ground') return;
  const own = pointOf(g, b, side);
  if (dcs.length && own) for (const f of list) if (f.key === own.id) bump(f, dcs.length, `direct combat support ×${dcs.length} (18.32)`);
  const atNarrow = isAlOwda(g); // A18.6: in Al-Owda only a defending Syrian AT asset gets +1, and no −1; N18.6 elsewhere
  if (o.atAssets && side === 'syrian' && enemyPoint?.cls === 'armor' && (!atNarrow || b.attacker === 'israeli'))
    for (const f of list) if (f.isAsset && b.assets.syrian.includes(f.key) && isAT(chit(g, f.key))) bump(f, 1, 'AT asset vs armour (18.6)');
  if (o.atAssets && !atNarrow && side === 'israeli' && b.attacker === 'israeli' && b.assets.syrian.some((id) => isAT(chit(g, id))))
    for (const f of list) {
      const u = g.units.find((x) => x.id === f.key);
      if (u?.cls === 'armor' && !f.isAsset) bump(f, -1, 'Syrian AT defence (18.6)');
    }
  if (o.artyArmor)
    for (const f of list) {
      const u = g.units.find((x) => x.id === f.key);
      if (u?.rec) bump(f, -u.rec, `${u.rec} recovery marker${u.rec > 1 ? 's' : ''}`);
    }
  if (o.flank && B.flank && side === b.attacker) for (const f of list) if (f.key === B.flank) bump(f, 1, 'flanking (18.8)');
}
/** Artillery vs armour: an armour unit hit by artillery takes a recovery marker instead of a step. */
export function absorbLoss(g: Game, b: Battle, _side: Side, u: Unit) {
  if (!g.opts.artyArmor || b.lossKind !== 'arty' || u.cls !== 'armor' || u.fort || u.ghost) return false;
  u.rec = (u.rec ?? 0) + 1;
  say(g, `${u.name} is buttoned up: a recovery marker instead of a step loss (artillery vs armour)`);
  return true;
}
/** Flank assault: the flanking unit takes no hits while the point unit is still in the battle. */
export function lossOk(g: Game, b: Battle, side: Side, key: string) {
  const B = battleState(b);
  if (!g.opts.flank || !B.flank || side !== b.attacker || key !== B.flank) return true;
  return !unitsIn(g, b.area, side).some((u) => u.id === b.attPoint);
}
/** Battlefield recovery: in a contested area a unit improves only by passing a morale check. */
export function recoverOk(g: Game, u: Unit) {
  if (!g.opts.battleRecovery || u.area == null || !contested(g, u.area)) return true;
  const sn = golanMoraleSn(g, u, 'check'),
    { r, ok } = moraleCheck(g, u, sn, 'Battlefield recovery (18.11)');
  say(g, `${u.name} ${ok ? 'recovers' : 'stays as it is'} in the front line (${r} vs ${sn}, 18.11)`);
  return ok;
}
/** Chemical warfare: the Syrian defender spends the reusable Special Action; one artillery asset (or air support firing as artillery) fires +2 this battle. */
export function playChemical(g: Game, assetId: string) {
  const b = g.battle;
  need(
    !!g.opts.chemical && !!b && b.stage === 'setup' && b.attacker === 'israeli',
    'as the Syrian defender, before the first roll (chemical warfare)',
  );
  const B = battleState(b!);
  need(!B.chem, 'one chemical attack per battle');
  need(
    b!.assets.syrian.some((id) => id === assetId && isArty(chit(g, id))) ||
      airOf(b!, 'syrian').some((a) => a.id === assetId && a.mode === 'arty'),
    'a Syrian artillery asset (or air support firing as artillery) in this battle',
  );
  const blk = saAvailable(g, 'syrian').find((c) => c.kind === 'sa_block');
  need(!!blk, 'the reusable Special Action is not available');
  spendSA(g, 'syrian', undefined, 'chemical warfare', blk!.id);
  B.chem = assetId;
  const V = state(g);
  V.chem = (V.chem ?? 0) + 1;
  say(g, `Chemical warfare: ${chit(g, assetId).name} fires +2${V.chem > 1 ? ' (Israel gains 1 VP)' : ''}`, 'syrian');
}
/** The Syrian artillery a chemical attack could use now (empty when it cannot be played). */
export function chemicalOptions(g: Game): string[] {
  const b = g.battle;
  if (
    !g.opts.chemical ||
    !b ||
    b.stage !== 'setup' ||
    b.attacker !== 'israeli' ||
    battleState(b).chem ||
    !saAvailable(g, 'syrian').some((c) => c.kind === 'sa_block')
  )
    return [];
  return [
    ...b.assets.syrian.filter((id) => isArty(chit(g, id))),
    ...airOf(b, 'syrian')
      .filter((a) => a.mode === 'arty')
      .map((a) => a.id),
  ];
}
/** Flank assault: attacking with two units, Israel spends a Special Action; the second unit flanks. */
export function playFlank(g: Game, unitId: string, chitId?: string) {
  need(flankOptions(g).includes(unitId), 'an Israeli unit beside the point unit, attacking, before the first roll (flank assault)');
  const b = g.battle!,
    u = unit(g, unitId);
  spendSA(g, 'israeli', u.ech, 'flank assault', chitId);
  battleState(b).flank = unitId;
  say(g, `${u.name} flanks: +1 to its fire, the point unit takes the hits`, 'israeli');
}
export function flankOptions(g: Game): string[] {
  const b = g.battle;
  if (!g.opts.flank || !b || b.stage !== 'setup' || b.attacker !== 'israeli' || battleState(b).flank || !saAvailable(g, 'israeli').length)
    return [];
  const us = unitsIn(g, b.area, 'israeli').filter(regular);
  return us.length >= 2 ? us.filter((u) => u.id !== b.attPoint).map((u) => u.id) : [];
}
/** 18.32 (optional) Direct combat support: the Israeli artillery assigned to the open battle that may be switched between firing and supporting. */
export function directSupportOptions(g: Game): string[] {
  const b = g.battle;
  if (!g.opts.directSupport || !b || b.stage !== 'setup') return [];
  return b.assets.israeli.filter((id) => isArty(chit(g, id)));
}
/** 18.32: an assigned Israeli artillery asset supports the point unit (+1 to its SN) instead of firing; `on` false puts it back to firing. */
export function setDirectSupport(g: Game, chitId: string, on: boolean) {
  need(directSupportOptions(g).includes(chitId), 'an Israeli artillery asset in this battle, before the first roll (18.32)');
  const B = battleState(g.battle!),
    dcs = (B.dcs ?? []).filter((x) => x !== chitId);
  B.dcs = on ? [...dcs, chitId] : dcs;
  say(g, `${chit(g, chitId).name} ${on ? 'gives direct combat support to the point unit (18.32)' : 'fires as artillery'}`, 'israeli');
}
/** 18.32: an artillery asset in direct combat support may take a step loss, like a battle asset (needs the series loss pool to ask this hook). */
export const lossAsset = (g: Game, b: Battle, side: Side, id: string) =>
  !!g.opts.directSupport && side === 'israeli' && (battleState(b).dcs ?? []).includes(id) && b.assets.israeli.includes(id);
/** Lt. Zvika variant: in the Supply Phase Israel takes Lt. Zvika off the map, back into the Selection Cup. */
export function zvikaToCup(g: Game) {
  const z = zvikaOnMap(g);
  need(!!z, 'Lt. Zvika is not on the map in the Supply Phase (Lt. Zvika variant)');
  z!.area = null;
  z!.str = 0;
  const c = chit(g, z!.chitId!);
  c.box = 'cup';
  c.area = undefined;
  say(g, 'Lt. Zvika is taken back into the Selection Cup', 'israeli');
}
export const zvikaOnMap = (g: Game) =>
  g.opts.zvikaCup && g.phase === 'supply' && g.phasing === 'israeli'
    ? g.units.find((u) => u.area != null && u.chitId && chit(g, u.chitId).kind === 'event_lt_zvika')
    : undefined;
/** Advanced ghosts: the best of an armour and an infantry move, never into an area that would become contested. */
export function ghostReach(g: Game, u: Unit, one: boolean, ctx: GMoveCtx) {
  const all = new Map<number, ReturnType<typeof reachable>[number]>();
  for (const cls of ['armor', 'infantry'] as const)
    for (const r of reachable({ ...asMover(g, u, one), cls }, ctx)) {
      const o = all.get(r.area);
      if (!o || r.cost < o.cost) all.set(r.area, r);
    }
  return [...all.values()].filter((r) => !(unitsIn(g, r.area, 'syrian').length && !contested(g, r.area)));
}
/** Advanced ghosts (A 18.10): a ghost may overstack by one, so an area holds at most three Israeli units, of which at most two
 *  are regular (non-ghost) and at most two are ghosts. Without the option, the usual two-unit count. */
export function ghostRoom(g: Game, u: Unit, a: number) {
  if (isAssembly(a)) return true;
  const here = unitsIn(g, a, u.side).filter((x) => !x.garrison && x.id !== u.id),
    gh = here.filter((x) => x.ghost).length;
  if (here.length >= 3) return false;
  return u.ghost ? gh < 2 : here.length - gh < 2 && (here.length < 2 || gh > 0);
}
/** Advanced ghosts: a Syrian unit entering an area held only by ghosts reveals and removes them, and may go on with what MP it has left. */
export function ghostsMet(g: Game, u: Unit, to: number, cost: number) {
  if (!g.opts.advGhosts || u.side !== 'syrian') return;
  const here = unitsIn(g, to, 'israeli');
  if (!here.length || !here.every((x) => x.ghost)) return;
  for (const x of here) {
    x.area = null;
    x.str = 0;
  }
  updateControl(g, to);
  u.moved = false;
  u.spent = cost;
  say(g, `Only a ghost was in ${nameOf(to)}: it is removed, and ${u.name} may move on`);
}
/** Retreats: no Assembly areas, boundaries the unit could not cross, no raided areas for Israelis (6.5, 14.1x, 16.11a). */
export function retreatOk(g: Game, u: Unit, from: number, to: number) {
  if (isAssembly(to)) return false;
  const c = connection(from, to)!;
  if (c.hermon && u.cls !== 'infantry') return false;
  if (c.rugged && c.type !== 'road' && u.cls === 'armor') return false;
  if (c.escarpment && c.type !== 'road') return false;
  return !(u.side === 'israeli' && state(g).raids.includes(to));
}
/** 14.42: a Syrian unit retreats across the operational boundary only when nothing else is open (turns 1–4). */
export function retreatPrefer(g: Game, u: Unit, from: number, opts: number[]) {
  if (u.side !== 'syrian' || g.turn > 4) return opts;
  const inside = opts.filter((n) => !connection(from, n)?.sector);
  return inside.length ? inside : opts; // a retreat past a full neighbour ends further away
}
/** A retreat across a minefield costs a morale check (14.02); the strongpoint left behind is evacuated (15.6); a garrison left behind is destroyed (16.24). */
export function onRetreat(g: Game, u: Unit, from: number, to: number) {
  if (u.side === 'syrian' && state(g).minefields.includes(edgeKey(from, to))) {
    const sn = golanMoraleSn(g, u, 'check'),
      { r, ok } = moraleCheck(g, u, sn, 'Retreat through a minefield (14.02)');
    if (!ok) {
      say(g, `${u.name} retreats through the minefield and loses a step (${r} vs ${sn})`);
      u.str--;
      if (u.str <= 0) eliminate(g, u);
    }
  }
  if (u.side === 'israeli') evacuateStrongpoint(g, from);
  const b = g.battle;
  if (b && b.area === from && b.retreat?.after !== 'sa' && !unitsIn(g, from, u.side).some(regular))
    for (const ga of unitsIn(g, from, u.side).filter((x) => x.garrison)) {
      say(g, `${ga.name} is left behind and destroyed (16.24)`);
      eliminate(g, ga);
    }
}
/** 14.01: a crossing assault — every attacker entered across an unbridged AT ditch or a river without a usable bridge. */
export function assault(g: Game, area: number) {
  const att = blocks(g, area, g.phasing).filter(regular),
    in_ = state(g).assaultEntered[area] ?? [];
  return att.length > 0 && att.every((u) => in_.includes(u.id));
}
/** 22.17: a free Breakthrough combat round is still owed (read without spending it). */
export const freeRoundLeft = (g: Game) => g.turn === 1 && g.phasing === 'syrian' && g.phase === 'btCombat' && state(g).freeCombatRound > 0;
export function freeBattle(g: Game) {
  const V = state(g);
  if (!(g.turn === 1 && g.phasing === 'syrian' && V.freeCombatRound > 0)) return false;
  V.freeCombatRound--;
  return true; // 22.17
}
