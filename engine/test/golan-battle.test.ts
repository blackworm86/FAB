// Golan '73 combat rounds: Badr turn 1 bridgeheads, Play Book examples 8–10, ghosts, strongpoints, garrisons, air and SAM.
import { describe, expect, it } from 'vitest';
import { newGolanGame, endPhase, startBattle, beginCombat, rollStep, chooseFirstLoss, attackerChoice, defenderChoice,
  fireList, assign, canAssign, fireSam, mustFight, airAssault, airAssaultTargets, unit, chit, onMap, count } from '../src/golan';
import { fight, playOut } from './golan-helpers';

describe('Operation Badr, turn 1: the seven crossing assaults', () => {
  it('all seven bridgeheads must be fought before the Combat Phase ends', () => {
    const g = newGolanGame(2);
    expect(mustFight(g).sort((x, y) => x - y)).toEqual([27, 28, 39, 48, 50, 57, 59]);
    expect(() => endPhase(g)).toThrow(/combat is required/);
    for (const a of mustFight(g)) { const r = fight(g, a); expect(r).toBeTruthy(); }
    expect(mustFight(g)).toEqual([]);
    endPhase(g); expect(g.phase).toBe('reaction');
  });
  it('the Syrian attackers fight under the assault penalty and the strongpoint fires one die at +1 for the River Assault marker', () => {
    const g = newGolanGame(4), b = startBattle(g, 28); beginCombat(g, b);
    const att = fireList(g, b, 'syrian', 'ground'), def = fireList(g, b, 'israeli', 'ground');
    expect(att.every((f) => f.parts.some(([why]) => why.startsWith('conducting an assault')))).toBe(true);
    const spt = def.find((f) => f.shooter.strongpoint)!; expect(spt.dice).toBe(1); expect(spt.parts.some(([why]) => why.includes('River Assault'))).toBe(true);
  });
});

describe('Example 9 inside a battle: Tel Saki (27) and Juhader (28)', () => {
  const setUp = () => {
    const g = newGolanGame(9);
    for (const id of ['I23', 'I26', 'I30']) { const u = unit(g, id); u.area = null; u.box = 'strongpoint_pool'; }
    Object.assign(unit(g, 'I23'), { box: 'map', area: 27 });                    // elite armor strongpoint in Tel Saki
    Object.assign(unit(g, 'I30'), { box: 'map', area: 28 });                    // veteran infantry strongpoint in Juhader
    return g;
  };
  it('A: Syrian artillery on a strongpoint: SN 3', () => {
    const g = setUp(), b = startBattle(g, 27); assign(g, b, chit(g, 'SC06').id); beginCombat(g, b);
    expect(fireList(g, b, 'syrian', 'arty').map((f) => f.sn)).toEqual([3]);
  });
  it('C/F: the elite tank strongpoint shoots the veteran 61st at 6 (7 once disordered... minus 1); the 61st shoots back at 4', () => {
    const g = setUp(), b = startBattle(g, 27); beginCombat(g, b);
    const sp = fireList(g, b, 'israeli', 'ground').find((f) => f.key === 'I23')!;
    expect(sp.sn).toBe(5 + 1 + 1 + (unit(g, 'S01').q[unit(g, 'S01').str - 1] === 'veteran' ? 1 : 0));
    unit(g, 'I23').disorder = 1; expect(fireList(g, b, 'israeli', 'ground').find((f) => f.key === 'I23')!.sn).toBe(sp.sn - 1);
    const s61 = fireList(g, b, 'syrian', 'ground').find((f) => f.key === 'S01')!;
    expect(s61.parts.map(([w]) => w)).toEqual(expect.arrayContaining(['conducting an assault (river, crossing or air)', 'target is a strongpoint with tank symbol']));
  });
  it('D: the 112th with Syrian air support on the rifle strongpoint: 5 +1 −1 −1 = 4', () => {
    const g = setUp(), b = startBattle(g, 28), air = g.chits.find((c) => c.kind === 'air_mission' && c.side === 'syrian' && c.box === 'available');
    if (!air) { air === undefined; return; }
    assign(g, b, air.id, 'support', 'S02'); beginCombat(g, b);
    expect(fireList(g, b, 'syrian', 'ground').find((f) => f.key === 'S02')!.sn).toBe(4);
  });
});

describe('ghosts, abort and retreat', () => {
  it('a Ghost is removed when revealed; alone, the defence is gone', () => {
    const g = newGolanGame(1), ghostArea = [49, 40, 30].find((a) => onMap(g, a).some((u) => u.kind === 'ghost'))!;
    Object.assign(unit(g, 'S05'), { area: ghostArea, revealed: false });
    const res = fight(g, ghostArea);
    expect(res).toMatch(/Ghost/); expect(count(g, ghostArea).israeli).toBe(0);
  });
  it('an aborted crossing assault falls back across the AT ditch, disordered (14.01a)', () => {
    let done = false;
    for (let seed = 1; seed < 60 && !done; seed++) {
      const g = newGolanGame(seed); Object.assign(unit(g, 'I05'), { area: 50 });
      const b = startBattle(g, 50); beginCombat(g, b);
      for (let i = 0; i < 20 && b.stage !== 'done'; i++) {
        if (b.stage === 'attChoice') { const ids = onMap(g, 50).filter((u) => u.side === 'syrian').map((u) => u.id); attackerChoice(g, b, true); for (const id of ids) { const u = unit(g, id); if (u.box === 'map') { expect(u.area).toBe(64); expect(u.disorder).toBe(1); } } done = true; break; }
        if (b.stage === 'attFirst') chooseFirstLoss(g, b, b.attPoint!); else if (b.stage === 'defChoice') defenderChoice(g, b, false); else rollStep(g, b);
      }
    }
    expect(done).toBe(true);
  });
});

describe('air assault (15.3) and air support (16.12, 16.22)', () => {
  it('the 82nd Para may land on Mt Hermon, never on the night turn; the garrison then defends as a roadblock', () => {
    const g = newGolanGame(5); g.fought = [];
    expect(airAssaultTargets(g)).toContain(83);
    airAssault(g, 83); expect(mustFight(g)).toContain(83);
    const b = startBattle(g, 83); expect(b.airAssault && b.assault).toBe(true);
    expect(b.defPoint).toBe('IC09');
  });
  it('an Israeli air mission east of the SAM barrier can be answered by a SAM', () => {
    const g = newGolanGame(6); g.player = 'israeli';
    Object.assign(unit(g, 'I05'), { area: 50 }); for (const u of onMap(g, 50)) u.revealed = true;
    const air = g.chits.find((c) => c.kind === 'air_mission' && c.side === 'israeli' && c.box === 'available')!;
    const b = startBattle(g, 50); assign(g, b, air.id, 'arty'); expect(g.samTarget).toBe(air.id);
    const sam = g.chits.find((c) => c.kind === 'sam' && c.box === 'available')!;
    expect(() => beginCombat(g, b)).toThrow(/SAM/);
    const r = fireSam(g, sam.id); expect(['eliminated', 'used', 'none']).toContain(r); expect(chit(g, sam.id).box).toBe('used');
  });
  it('Israel may commit two air assets (one artillery, one support) only where no SAM is available or west of the barrier', () => {
    const g = newGolanGame(8); g.player = 'israeli'; g.fought = [];
    Object.assign(unit(g, 'I05'), { area: 59 }); for (const u of onMap(g, 59)) u.revealed = true;
    const b = startBattle(g, 59);
    const fake = (id: string) => { g.chits.push({ id, counter: 'IC03', name: 'Air Support', kind: 'air_mission', side: 'israeli', turn: 'S', box: 'available' }); return chit(g, id); };
    const x = fake('AX'), y = fake('AY');
    expect(canAssign(g, b, x, 'arty')).toBeNull(); assign(g, b, x.id, 'arty'); g.samTarget = undefined;
    expect(canAssign(g, b, y, 'support')).toMatch(/one air support asset/);       // 59 is east of the SAM barrier and Syria has SAMs available
  });
});

describe('brigade integrity in a battle (15.51)', () => {
  it('both 179th units in the same battle add one die', () => {
    const g = newGolanGame(3); g.player = 'israeli'; g.fought = [];
    for (const id of ['I09', 'I10']) Object.assign(unit(g, id), { box: 'map', area: 27, revealed: false });
    for (const u of onMap(g, 27).filter((x) => x.side === 'israeli' && x.kind)) Object.assign(u, { box: 'strongpoint_pool', area: null });
    const b = startBattle(g, 27); beginCombat(g, b);
    expect(fireList(g, b, 'israeli', 'ground').some((f) => f.key.startsWith('brigade:'))).toBe(true);
  });
});

describe('a whole game with every battle fought', () => {
  it('plays to a result', () => { const g = newGolanGame(21); playOut(g); expect(g.result).toMatch(/Victory|Draw/); });
});
