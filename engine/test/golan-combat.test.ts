// Golan '73 combat numbers, against the Play Book examples 8 and 9 and the Combat Play Aid.
import { describe, expect, it } from 'vitest';
import { successNumber, brigadeExtraDie, assetLimits, samResult, moraleSn, unitDice, type GShooter, type GTarget } from '../src/golan';

const sn = (s: GShooter, t: GTarget, attacker: boolean, more: { tdn?: number; assault?: boolean; night?: boolean } = {}) => successNumber(s, t, { firerIsAttacker: attacker, tdn: more.tdn ?? 0, assault: more.assault, night: more.night }).sn;
const armorVet: GTarget = { pointCls: 'armor', pointQuality: 'veteran' }, armorElite: GTarget = { pointCls: 'armor', pointQuality: 'elite' };

describe('Example 8: basic combat in Hushniyah (38, TDN 0)', () => {
  it('A: attacking artillery 405th+55th: −1 armor point, −1 target is the defender = 3', () => {
    expect(sn({ side: 'israeli', kind: 'artillery', cls: 'infantry' }, armorVet, true)).toBe(3);
  });
  it('B: defending artillery 89th: −1 armor point = 4', () => {
    expect(sn({ side: 'syrian', kind: 'artillery', cls: 'infantry' }, armorElite, false)).toBe(4);
  });
  it('C: 91st Tank (elite) with Syrian close air support vs a veteran armor point: 5+1+1−1+1 = 7, three dice', () => {
    expect(sn({ side: 'syrian', kind: 'unit', cls: 'armor', quality: 'elite', closeAirSupport: true }, armorVet, false)).toBe(7);
  });
  it('D: 4th Mech (veteran) vs the elite 91st: 5+1−1+0−1 = 4, and brigade integrity adds a die at that SN', () => {
    const s = sn({ side: 'israeli', kind: 'unit', cls: 'armor', quality: 'veteran' }, armorElite, true, { tdn: 0 });
    expect(s).toBe(4);
    expect(brigadeExtraDie([{ brigade: '4th_mech', sn: s, side: 'israeli' }, { brigade: '4th_mech', sn: s, side: 'israeli' }])).toEqual([{ brigade: '4th_mech', sn: 4 }]);
    expect(brigadeExtraDie([{ brigade: '4th_mech', sn: 4, side: 'israeli' }])).toEqual([]);
  });
});

describe('Example 9: crossing assault on strongpoints (27, 28)', () => {
  const armorSP: GTarget = { pointCls: 'infantry', pointQuality: 'elite', strongpoint: 'armor' }, infSP: GTarget = { pointCls: 'infantry', pointQuality: 'veteran', strongpoint: 'infantry' };
  it('A: Syrian artillery on a strongpoint: −1 strongpoint −1 defender = 3', () => {
    expect(sn({ side: 'syrian', kind: 'artillery', cls: 'infantry' }, infSP, true)).toBe(3);
  });
  it('B: rifle strongpoint firing at a unit under a River Assault marker: 5−1+1 = 5, one die', () => {
    expect(sn({ side: 'israeli', kind: 'unit', cls: 'infantry', quality: 'veteran', strongpoint: 'infantry' }, { pointCls: 'infantry', pointQuality: 'veteran', riverAssaultMarker: true }, false)).toBe(5);
    expect(unitDice(2, true)).toBe(1);
  });
  it('C: disordered elite tank strongpoint at the veteran 61st under a River Assault marker: 5−1+1+1+1 = 7', () => {
    expect(sn({ side: 'israeli', kind: 'unit', cls: 'infantry', quality: 'elite', strongpoint: 'armor', disordered: true }, { pointCls: 'infantry', pointQuality: 'veteran', riverAssaultMarker: true }, false)).toBe(7);
  });
  it('D: 112th Inf with air support crossing at a rifle strongpoint: 5+1−1−1 = 4', () => {
    expect(sn({ side: 'syrian', kind: 'unit', cls: 'infantry', quality: 'veteran', closeAirSupport: true }, infSP, true, { assault: true })).toBe(4);
  });
  it('F: 61st Inf (veteran) at the elite tank strongpoint: 5−1+1−1 = 4; 5th Tank (green): 5+1−1+1−2 = 4', () => {
    expect(sn({ side: 'syrian', kind: 'unit', cls: 'infantry', quality: 'veteran' }, armorSP, true, { assault: true })).toBe(4);
    expect(sn({ side: 'syrian', kind: 'unit', cls: 'armor', quality: 'green' }, armorSP, true, { assault: true })).toBe(4);
  });
});

describe('Combat Play Aid', () => {
  it('rocket artillery +1, night −1 for artillery and for all fire except Syrian armor units', () => {
    expect(sn({ side: 'syrian', kind: 'artillery', cls: 'infantry', rocket: true }, { pointCls: 'infantry', pointQuality: 'green' }, false)).toBe(6);
    expect(sn({ side: 'syrian', kind: 'artillery', cls: 'infantry' }, { pointCls: 'infantry', pointQuality: 'green' }, false, { night: true })).toBe(4);
    expect(sn({ side: 'syrian', kind: 'unit', cls: 'armor', quality: 'veteran' }, { pointCls: 'infantry', pointQuality: 'veteran' }, false, { night: true })).toBe(6);
    expect(sn({ side: 'syrian', kind: 'battle', cls: 'armor', quality: 'veteran' }, { pointCls: 'infantry', pointQuality: 'veteran' }, false, { night: true })).toBe(5);
    expect(sn({ side: 'israeli', kind: 'unit', cls: 'armor', quality: 'veteran' }, { pointCls: 'infantry', pointQuality: 'veteran' }, false, { night: true })).toBe(5);
  });
  it('Israeli close air support is +2; infantry in field works −1; TDN only when firing at the defender', () => {
    expect(sn({ side: 'israeli', kind: 'unit', cls: 'infantry', quality: 'veteran', closeAirSupport: true }, { pointCls: 'infantry', pointQuality: 'veteran', fieldWorks: true }, true, { tdn: 2 })).toBe(4);
    expect(sn({ side: 'israeli', kind: 'unit', cls: 'infantry', quality: 'veteran' }, { pointCls: 'infantry', pointQuality: 'veteran' }, false, { tdn: 2 })).toBe(5);
  });
  it('asset limits: 2/8 attacking, 1/5 defending; Mt Hermon +1 artillery for Israel; Syrian mixed divisions 1 artillery, no battle assets', () => {
    expect(assetLimits('syrian', true)).toMatchObject({ artillery: 2, battle: 8, events: 1, air: 1 });
    expect(assetLimits('israeli', false, { israeliHoldsHermon: true })).toMatchObject({ artillery: 2, battle: 5 });
    expect(assetLimits('syrian', false, { mixedDivisions: true })).toMatchObject({ artillery: 1, battle: 0 });
    expect(assetLimits('israeli', true, { eastOfSamBarrier: true, samAvailable: true }).air).toBe(1);
    expect(assetLimits('israeli', true, { eastOfSamBarrier: true, samAvailable: false }).air).toBe(2);
  });
  it('SAM table (Example 2: turn 4, a 3 sends the air asset to the Used Box, a 6 has no effect)', () => {
    expect(samResult(4, 3)).toBe('used'); expect(samResult(4, 6)).toBe('none'); expect(samResult(2, 7)).toBe('used'); expect(samResult(8, 4)).toBe('none'); expect(samResult(9, 1)).toBe('eliminated');
  });
  it('morale', () => { expect(moraleSn('elite')).toBe(7); expect(moraleSn('green', { disordered: true, unsupplied: true })).toBe(1); expect(moraleSn('veteran', { nightExploitation: true })).toBe(3); });
});
