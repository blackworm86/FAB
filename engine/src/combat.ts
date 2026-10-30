import { hitProb } from './dice';

export type Quality = 'green' | 'veteran' | 'elite';
const LEVEL: Record<Quality, number> = { green: 0, veteran: 1, elite: 2 };

/** One firing group: a unit, a battle asset or an artillery asset (rules 6.25-6.28). */
export interface Shooter {
  kind: 'unit' | 'battle' | 'artillery';
  cls: 'armor' | 'infantry';
  quality?: Quality;            // artillery assets have none
  dice: number;                 // current steps (1 per artillery asset)
  disordered?: boolean; unsupplied?: boolean;
  airSupport?: boolean;         // air mission used as battle support: +2 (17.21)
}
/** What the shooter is shooting at: the opposing point unit and its status. */
export interface Target { pointCls: 'armor' | 'infantry'; pointQuality: Quality; fieldWorks?: boolean; riverAssaultMarker?: boolean }
export interface Setting { attacker: boolean; tdn: number; riverAssault?: boolean }

/** Success Number with every modifier listed, so the UI can explain it. Modifiers were rebuilt from the play-book examples (no Player-Aid card yet). */
export function successNumber(s: Shooter, t: Target, c: Setting) {
  const parts: [string, number][] = [['base', 5]];
  const add = (why: string, v: number) => { if (v) parts.push([why, v]); };
  if (s.cls === 'armor' && s.kind !== 'artillery') add('firing unit is armor', 1);
  if (s.quality) add(`${s.quality} firing on ${t.pointQuality} point unit`, LEVEL[s.quality] - LEVEL[t.pointQuality]);
  if (t.pointCls === 'armor') add("target's point unit is armor", -1);
  if (t.fieldWorks) add('target in field works', -1);
  if (c.attacker && s.kind !== 'artillery') add('terrain (TDN)', -c.tdn);          // TDN only hits the attacker's ground fire (2.4)
  if (c.attacker && c.riverAssault && s.kind !== 'artillery') add('conducting a river assault', -1);
  if (t.riverAssaultMarker) add('target has river assault marker', 1);
  if (s.disordered) add('disordered', -1);
  if (s.unsupplied) add('unsupplied', -1);
  if (s.airSupport) add('air mission support', 2);
  return { sn: parts.reduce((n, [, v]) => n + v, 0), parts };
}

/** Distribution of the total hits from several dice groups: pmf[k] = P(exactly k hits). */
export function hitPmf(groups: { dice: number; sn: number }[]): number[] {
  let pmf = [1];
  for (const g of groups) {
    const p = hitProb(g.sn); let c = 1; // C(n,k) built up step by step
    const bin = Array.from({ length: g.dice + 1 }, (_, k) => { if (k) c = (c * (g.dice - k + 1)) / k; return c * p ** k * (1 - p) ** (g.dice - k); });
    const out = new Array(pmf.length + g.dice).fill(0);
    pmf.forEach((a, i) => bin.forEach((b, j) => (out[i + j] += a * b)));
    pmf = out;
  }
  return pmf;
}
export const probAtLeast = (pmf: number[], k: number) => pmf.slice(k).reduce((a, b) => a + b, 0);
export const meanHits = (pmf: number[]) => pmf.reduce((a, p, k) => a + p * k, 0);
