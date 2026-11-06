// Golan '73 combat rounds on the series engine: Badr turn 1 bridgeheads, Play Book examples 8–10, ghosts, strongpoints, garrisons, air and SAM.
import { describe, expect, it } from 'vitest';
import { startBattle, beginCombat, roll_step as rollStep, chooseFirstLoss, attackerChoice, defenderChoice, fireList, assign, canAssign, mustFight, golan, unassign, cancelBattle } from '../src';
import { fight, playOut, newGolanGame, unit, chit, onMap, count } from './golan-helpers';

describe('Operation Badr, turn 1: the crossing assaults', () => {
  it('the Syrian attackers fight under the assault penalty and the strongpoint fires one die at +1 for the River Assault marker', () => {
    const g = newGolanGame(4), b = startBattle(g, 28); beginCombat(g, b);
    const att = fireList(g, b, 'syrian', 'ground'), def = fireList(g, b, 'israeli', 'ground');
    expect(att.length).toBeGreaterThan(0);
    expect(att.every((f) => f.parts.some(([why]) => why.startsWith('conducting an assault')))).toBe(true);
    const spt = def.find((f) => f.shooter.strongpoint)!; expect(spt.dice).toBe(1); expect(spt.parts.some(([why]) => why.includes('River Assault'))).toBe(true);
  });
});

describe('Example 9 inside a battle: Tel Saki (27) and Juhader (28)', () => {
  const setUp = () => {
    const g = newGolanGame(9);
    for (const id of ['I23', 'I26', 'I30']) Object.assign(unit(g, id), { area: null, box: 'strongpoint_pool' });
    Object.assign(unit(g, 'I23'), { area: 27, box: undefined });                    // elite armor strongpoint in Tel Saki
    Object.assign(unit(g, 'I30'), { area: 28, box: undefined });                    // veteran infantry strongpoint in Juhader
    return g;
  };
  it('A: Syrian artillery on a strongpoint: SN 3', () => {
    const g = setUp(), b = startBattle(g, 27); assign(g, b, 'SC06'); beginCombat(g, b);
    expect(fireList(g, b, 'syrian', 'arty').map((f) => f.sn)).toEqual([3]);
  });
  it('C/F: the elite tank strongpoint shoots the 61st; disordered it shoots one less; the 61st fights the strongpoint under the assault penalty', () => {
    const g = setUp(), b = startBattle(g, 27); beginCombat(g, b);
    const sp = fireList(g, b, 'israeli', 'ground').find((f) => f.key === 'I23')!;
    expect(sp.sn).toBe(5 + 1 + 1 + (unit(g, 'S01').q[unit(g, 'S01').str - 1] === 'veteran' ? 1 : 0));
    unit(g, 'I23').disorder = 1; expect(fireList(g, b, 'israeli', 'ground').find((f) => f.key === 'I23')!.sn).toBe(sp.sn - 1);
    const s61 = fireList(g, b, 'syrian', 'ground').find((f) => f.key === 'S01')!;
    expect(s61.parts.map(([w]) => w)).toEqual(expect.arrayContaining(['conducting an assault (river, crossing or air)', 'target is a strongpoint with tank symbol']));
  });
  it('D: the 112th with Syrian air support on the rifle strongpoint: 5 +1 −1 −1 = 4', () => {
    const g = setUp(), b = startBattle(g, 28), air = g.chits.find((c) => c.kind === 'air_mission' && c.side === 'syrian' && c.box === 'available');
    if (!air) return;
    assign(g, b, air.id, 'support', 'S02'); beginCombat(g, b);
    expect(fireList(g, b, 'syrian', 'ground').find((f) => f.key === 'S02')!.sn).toBe(4);
  });
});

describe('ghosts, abort and retreat', () => {
  it('a Ghost is removed when revealed; alone, the defence is gone', () => {
    const g = newGolanGame(1), ghostArea = [49, 40, 30].find((a) => onMap(g, a).some((u) => u.ghost))!;
    Object.assign(unit(g, 'S05'), { area: ghostArea });
    const res = fight(g, ghostArea);
    expect(res).toMatch(/eliminated/); expect(count(g, ghostArea).israeli).toBe(0); expect(g.elimLarge).toEqual([]);
  });
  it('an aborted crossing assault falls back across the AT ditch, disordered (14.01a)', () => {
    let done = false;
    for (let seed = 1; seed < 60 && !done; seed++) {
      const g = newGolanGame(seed); Object.assign(unit(g, 'I05'), { area: 50 });
      const b = startBattle(g, 50); beginCombat(g, b);
      for (let i = 0; i < 20 && b.stage !== 'done'; i++) {
        if (b.stage === 'attChoice') { const ids = onMap(g, 50).filter((u) => u.side === 'syrian').map((u) => u.id); attackerChoice(g, b, true); for (const id of ids) { const u = unit(g, id); if (u.area != null) { expect(u.area).toBe(64); expect(u.disorder).toBe(1); } } done = true; break; }
        if (b.stage === 'attFirst') chooseFirstLoss(g, b, b.attPoint); else if (b.stage === 'defChoice') defenderChoice(g, b, false); else rollStep(g, b);
      }
    }
    expect(done).toBe(true);
  });
});

describe('air assault (15.3) and air support (16.12, 16.22)', () => {
  it('the 82nd Para may land on Mt Hermon, never on the night turn; the garrison then defends as a roadblock', () => {
    const g = newGolanGame(5); g.fought = [];
    expect(golan.airAssaultTargets(g)).toContain(83);
    golan.airAssault(g, 83); expect(mustFight(g)).toContain(83);
    const b = startBattle(g, 83); expect(b.riverAssault).toBe(true); expect(golan.state(g).airAssaultArea).toBe(83);
    expect(b.defPoint).toBe('G-IC09');
    g.turn = 2; expect(golan.airAssaultTargets(g)).toEqual([]);
  });
  it('the pending SAM answer goes when the air mission is taken back or the battle withdrawn', () => {
    const g = newGolanGame(6); g.phasing = 'israeli';
    Object.assign(unit(g, 'I05'), { area: 50 });
    const air = g.chits.find((c) => c.kind === 'air_mission' && c.side === 'israeli' && c.box === 'available')!;
    let b = startBattle(g, 50); assign(g, b, air.id, 'arty'); expect(golan.state(g).samTarget).toBe(air.id);
    unassign(g, b, air.id); expect(golan.state(g).samTarget).toBeUndefined(); expect(() => beginCombat(g, b)).not.toThrow();
    g.battle = null; b = startBattle(g, 50); assign(g, b, air.id, 'arty'); cancelBattle(g); expect(golan.state(g).samTarget).toBeUndefined();
  });
  it('an Israeli air mission east of the SAM barrier can be answered by a SAM', () => {
    const g = newGolanGame(6); g.phasing = 'israeli';
    Object.assign(unit(g, 'I05'), { area: 50 });
    const air = g.chits.find((c) => c.kind === 'air_mission' && c.side === 'israeli' && c.box === 'available')!;
    const b = startBattle(g, 50); assign(g, b, air.id, 'arty'); expect(golan.state(g).samTarget).toBe(air.id);
    const sam = g.chits.find((c) => c.kind === 'sam' && c.box === 'available')!;
    expect(() => beginCombat(g, b)).toThrow(/SAM/);
    const r = golan.fireSam(g, sam.id); expect(['eliminated', 'used', 'none']).toContain(r); expect(chit(g, sam.id).box).toBe('used');
    expect(b.rolls.at(-1)!.kind).toBe('sam');
  });
  it('Israel may commit two air assets (one artillery, one support) only where no SAM is available or west of the barrier', () => {
    const g = newGolanGame(8); g.phasing = 'israeli'; g.fought = [];
    Object.assign(unit(g, 'I05'), { area: 59 });
    const b = startBattle(g, 59);
    const fake = (id: string) => { g.chits.push({ id, counter: 'IC03', name: 'Air Support', kind: 'air_mission', side: 'israeli', ech: '', turn: 'S', box: 'available' }); return chit(g, id); };
    const x = fake('AX'), y = fake('AY');
    expect(canAssign(g, b, 'israeli', x, 'arty')).toBeNull(); assign(g, b, x.id, 'arty'); golan.state(g).samTarget = undefined;
    expect(canAssign(g, b, 'israeli', y, 'support')).toMatch(/one air support asset/);       // 59 is east of the SAM barrier and Syria has SAMs available
    for (const c of g.chits.filter((c) => c.kind === 'sam')) c.box = 'eliminated';
    expect(canAssign(g, b, 'israeli', y, 'arty')).toMatch(/one fires as artillery/);
    expect(canAssign(g, b, 'israeli', y, 'support')).toBeNull(); assign(g, b, y.id, 'support', 'I05');
    expect(b.air2?.israeli?.id).toBe('AY');
  });
});

describe('brigade integrity in a battle (15.51)', () => {
  it('both 179th units in the same battle add one die', () => {
    const g = newGolanGame(3); g.phasing = 'israeli'; g.fought = [];
    for (const id of ['I09', 'I10']) Object.assign(unit(g, id), { area: 27, box: undefined });
    for (const u of onMap(g, 27).filter((x) => x.side === 'israeli' && x.kind)) Object.assign(u, { box: 'strongpoint_pool', area: null });
    const b = startBattle(g, 27); beginCombat(g, b);
    expect(fireList(g, b, 'israeli', 'ground').some((f) => f.key.startsWith('brigade:'))).toBe(true);
  });
});

describe('a whole game with every battle fought', () => {
  it('plays to a result', () => { const g = newGolanGame(21); playOut(g); expect(g.over).toMatch(/victory|draw/i); });
  it('errata: Israel attacking in a strongpoint area may commit the strongpoint only as its Task Force, for good', () => {
    const g = newGolanGame(6); g.phasing = 'israeli';
    const sp = g.units.find((u) => u.fort && u.fort === 'armor' && u.area != null && g.units.some((x) => x.side === 'syrian' && x.area === u.area && !x.garrison))!;
    const a = sp.area!; Object.assign(unit(g, 'I05'), { area: a, disorder: 0 }); golan.state(g).samTarget = undefined;
    const b = startBattle(g, a), o = golan.strongpointSwapOption(g)!;
    expect(o.unit).toBe(sp.id); expect(chit(g, o.chit).name).toMatch(/armor/);
    expect(fireList(g, b, 'israeli', 'ground').some((f) => f.key === sp.id)).toBe(false);          // a strongpoint never attacks by itself
    golan.swapStrongpointIntoAttack(g);
    expect(sp.area).toBeNull(); expect(chit(g, o.chit).box).toBe('map'); expect(b.assets.israeli).toContain(o.chit);
    expect(fireList(g, b, 'israeli', 'ground').some((f) => f.key === o.chit)).toBe(true);           // it fires as a battle asset
    unassign(g, b, o.chit); expect(b.assets.israeli).toContain(o.chit);                              // cannot be taken back
    expect(() => cancelBattle(g)).toThrow(); expect(golan.strongpointSwapOption(g)).toBeNull();
    beginCombat(g, b); for (let i = 0; i < 40 && b.stage !== 'done'; i++) { if (b.stage === 'attFirst') chooseFirstLoss(g, b, b.attPoint); else if (b.stage === 'attChoice') attackerChoice(g, b, false); else if (b.stage === 'defChoice') defenderChoice(g, b, false); else rollStep(g, b); }
    const c = chit(g, o.chit); expect(['used', 'eliminated']).toContain(c.box);
  });
  it('errata swap: not offered when Syria attacks, nor for a ghost', () => {
    const g = newGolanGame(6); g.phasing = 'syrian'; const a = g.units.find((u) => u.fort && u.area != null && g.units.some((x) => x.side === 'syrian' && x.area === u.area))!.area!;
    startBattle(g, a); expect(golan.strongpointSwapOption(g)).toBeNull();
  });
});
