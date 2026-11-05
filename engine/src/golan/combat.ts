// FAB: Golan '73 combat numbers: Success Numbers with every modifier named (Combat Play Aid: Artillery Fire and Ground Fire tables,
// TQ matrix), dice per firing group (15.51 brigade integrity, 15.6 strongpoints), asset limits per battle (6.22/6.23, 15.12, 16.21,
// 16.22), the SAM Air Defense table (16.12) and morale checks (6.7, 14.03).
import type { GSide } from './map';

export type Quality = 'green' | 'veteran' | 'elite';
const LEVEL: Record<Quality, number> = { green: 0, veteran: 1, elite: 2 };
export type SupportType = 'armor' | 'infantry';      // a strongpoint's tank or rifle symbol (15.6)

/** One firing group: a unit, a battle asset, an artillery asset, or an air support asset used as artillery (16.31a). */
export interface GShooter {
  side: GSide; kind: 'unit' | 'battle' | 'artillery' | 'air';
  cls: 'armor' | 'infantry'; quality?: Quality;
  rocket?: boolean;                 // rocket artillery (16.4)
  strongpoint?: SupportType;        // a firing strongpoint (15.6)
  disordered?: boolean; unsupplied?: boolean;
  closeAirSupport?: boolean;        // supported by a Close Air Support mission (16.31a)
}
/** The opposing point unit. */
export interface GTarget { pointCls: 'armor' | 'infantry'; pointQuality: Quality; strongpoint?: SupportType; fieldWorks?: boolean; riverAssaultMarker?: boolean }
/** firerIsAttacker: the shooter is the Attacker (its target is the Defender). assault: the firer is attacking across a River, Crossing or Air Assault. */
export interface GSetting { firerIsAttacker: boolean; tdn: number; assault?: boolean; night?: boolean }

export function successNumber(s: GShooter, t: GTarget, c: GSetting) {
  const parts: [string, number][] = [['base', 5]];
  const add = (why: string, v: number) => { if (v) parts.push([why, v]); };
  if (s.kind === 'artillery' || s.kind === 'air') {                                       // Artillery Fire table
    if (s.rocket) add('rocket artillery', 1);
    if (t.pointCls === 'armor') add("target's point unit is armor class", -1);
    else if (t.strongpoint) add("target's point unit is a strongpoint", -1);
    else if (t.fieldWorks) add("target's point unit is infantry in field works", -1);
    if (c.firerIsAttacker) add('target is the defender', -1);
    if (c.night) add('night turn', -1);
    return { sn: parts.reduce((n, [, v]) => n + v, 0), parts };
  }
  if (s.strongpoint) add(`strongpoint with ${s.strongpoint === 'armor' ? 'tank' : 'rifle'} symbol`, s.strongpoint === 'armor' ? 1 : -1);   // 15.6
  else if (s.cls === 'armor') add('firing unit is armor', 1);
  if (c.firerIsAttacker && c.assault) add('conducting an assault (river, crossing or air)', -1);
  if (s.closeAirSupport) add('close air support', s.side === 'israeli' ? 2 : 1);
  if (s.disordered) add('disordered', -1);
  if (s.unsupplied) add('unsupplied', -1);
  if (s.quality) add(`${s.quality} firing on ${t.pointQuality} point unit`, LEVEL[s.quality] - LEVEL[t.pointQuality]);
  if (c.firerIsAttacker) add('terrain (TDN of the defended area)', -c.tdn);
  if (t.strongpoint) add(`target is a strongpoint with ${t.strongpoint === 'armor' ? 'tank' : 'rifle'} symbol`, t.strongpoint === 'armor' ? 1 : -1);  // Ex 9D/9F
  else if (t.pointCls === 'armor') add("target's point unit is armor class", -1);
  else if (t.fieldWorks) add("target's point unit is infantry in field works", -1);
  if (t.riverAssaultMarker) add('target has a River Assault marker', 1);
  if (c.night && !(s.side === 'syrian' && s.kind === 'unit' && s.cls === 'armor')) add('night turn', -1);   // 14.03: Syrian armor units exempt
  return { sn: parts.reduce((n, [, v]) => n + v, 0), parts };
}

/** Dice for one unit: its current steps, but a strongpoint always rolls one (15.6); assets roll one. */
export const unitDice = (steps: number, strongpoint = false) => (strongpoint ? 1 : steps);

/** 15.51 Brigade integrity: two units of the same Israeli brigade in the same combat get one extra die at the lower of their SNs. */
export function brigadeExtraDie(firers: { brigade?: string; sn: number; side: GSide }[]): { brigade: string; sn: number }[] {
  const by = new Map<string, number[]>();
  for (const f of firers) if (f.side === 'israeli' && f.brigade) (by.get(f.brigade) ?? by.set(f.brigade, []).get(f.brigade)!).push(f.sn);
  return [...by].filter(([, sns]) => sns.length >= 2).map(([brigade, sns]) => ({ brigade, sn: Math.min(...sns) }));
}

export interface AssetLimits { artillery: number; battle: number; events: number; air: number }
/** How many assets a side may commit to one battle (Combat Play Aid; 6.22/6.23, 15.12 Syrian mixed divisions, 16.21 Mt Hermon, 16.22 Israeli air). */
export function assetLimits(side: GSide, attacker: boolean, o: { mixedDivisions?: boolean; israeliHoldsHermon?: boolean; eastOfSamBarrier?: boolean; samAvailable?: boolean } = {}): AssetLimits {
  let artillery = attacker ? 2 : 1, battle = attacker ? 8 : 5;
  if (side === 'israeli' && o.israeliHoldsHermon) artillery += 1;
  if (side === 'syrian' && o.mixedDivisions) { artillery = 1; battle = 0; }
  const air = side === 'israeli' && !(o.eastOfSamBarrier && o.samAvailable) ? 2 : 1;
  return { artillery, battle, events: 1, air };
}

/** 16.12 SAM Air Defense Fire: the result for an Israeli air asset by turn and die roll. */
export function samResult(turn: number, roll: number): 'eliminated' | 'used' | 'none' {
  if (roll <= 1) return 'eliminated';
  const usedUpTo = turn <= 3 ? 7 : turn <= 6 ? 5 : 3;
  return roll <= usedUpTo ? 'used' : 'none';
}

/** Morale check SN (6.7): elite +2, green −2, disordered −1, unsupplied −1; exploitation checks at night −2 (14.03). */
export function moraleSn(q: Quality, o: { disordered?: boolean; unsupplied?: boolean; nightExploitation?: boolean } = {}) {
  return 5 + { elite: 2, veteran: 0, green: -2 }[q] - +!!o.disordered - +!!o.unsupplied - (o.nightExploitation ? 2 : 0);
}
