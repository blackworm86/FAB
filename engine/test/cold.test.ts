import { describe, expect, it } from 'vitest';
import * as E from '../src';

const cold = (seed = 1) => E.newGame(seed, { scenario: 'cold', fuel: true });
const fight = (g: E.Game) => {
  for (const a of E.mustFight(g)) {
    const b = E.startBattle(g, a, g.phase === 'btCombat');
    E.beginCombat(g, b);
    for (let k = 0; k < 90 && b.stage !== 'done'; k++) {
      if (b.stage === 'attChoice') E.attackerChoice(g, b, false);
      else if (b.stage === 'defChoice') E.defenderChoice(g, b, false);
      else if (b.stage === 'attFirst') E.chooseFirstLoss(g, b, b.attPoint);
      else if (b.stage === 'retreat') E.chooseRetreat(g, b, E.retreatOptions(g, b)[0]);
      else if (b.stage === 'exploit') E.declineExploit(g, b);
      else E.roll_step(g, b);
    }
    E.closeBattle(g);
  }
};
const step = (g: E.Game) => {
  fight(g);
  E.autoRecover(g);
  E.endPhase(g);
};

describe('P500 Cold Shoulder', () => {
  it('sets up the listed forces, markers and control (P.3, P.4)', () => {
    const g = cold(),
      at = (a: number) =>
        E.unitsIn(g, a)
          .map((u) => u.name)
          .sort();
    expect(at(5)).toEqual(['Peiper']);
    expect(at(6)).toEqual(['150 Pz', '1SS(-)']);
    expect(at(7)).toEqual(['12SS']);
    expect(at(8)).toEqual(['326 VG']);
    expect(at(9)).toEqual(['12 VG', '277 VG', '99 Inf']);
    expect(at(10)).toEqual(['14 Cav', '3 FJ']);
    expect(at(25)).toEqual(['CCB/9']);
    expect(at(27)).toEqual(['102 Cav', '2 Inf']);
    expect(at(32)).toEqual(['Garrison Spa']);
    expect(g.units.filter((u) => u.area != null).length).toBe(14); // 8 German, 5 Allied blocks and the Spa garrison
    expect(g.units.find((u) => u.name === 'Peiper')!.reserve).toBe('z6');
    expect(g.markers).toEqual({ german: { z5: 0, z6: 1, z7: 0 }, allied: { z56: 2, z7: 0 } });
    expect(g.fieldWorks.sort((a, b) => a - b)).toEqual([9, 10, 27]);
    expect(E.coldAreas(g)).toBe(4); // P.7: the Germans start with 4 Zone 6 areas
    expect(g.control[9]).toBe('allied');
    expect(g.control[25]).toBe('allied');
    expect(g.control[58]).toBe('allied');
    expect(g.lastTurn).toBe(9);
    expect(g.phase).toBe('combat');
    expect(g.turn).toBe(1);
    expect(
      E.boxOf(g, 'german', 'available')
        .map((c) => c.kind)
        .sort(),
    ).toEqual([
      'artillery',
      'artillery',
      'artillery',
      'engineer',
      'fuel',
      'fuel',
      'fuel',
      'rocket_artillery',
      'rocket_artillery',
      'rocket_artillery',
    ]);
    expect(E.boxOf(g, 'allied', 'available').length).toBe(0);
    const later = g.units
      .filter((u) => u.area == null && u.arrival)
      .map((u) => `${u.name}@${u.arrival}`)
      .sort();
    expect(later).toEqual(
      [
        '1 Inf@2',
        '246 VG@8',
        '2SS@4',
        '30 Inf@3',
        '3 Arm@5',
        '3 PG@4',
        '4 Cav@7',
        '43 Inf@6',
        '7 Arm@2',
        '75 Inf@6',
        '84 Inf@6',
        '9 Inf@3',
        '9SS@4',
        'Guards@7',
      ].sort(),
    );
    expect(g.units.find((u) => u.name === '1 Inf')!.str).toBe(1);
    expect(g.units.find((u) => u.name === '43 Inf')!.entry).toEqual(['D', 'E']);
  });
  it('begins with the German combat phase: every contested area must be fought (P.6)', () => {
    const g = cold();
    expect(E.mustFight(g).sort((a, b) => a - b)).toEqual([9, 10]);
  });
  it('keeps play in Zone 6; Zone 5 only carries supply (P.3, P.6)', () => {
    const g = cold();
    expect(g.inPlay!.every((a) => E.areas.get(a)!.zone === 6)).toBe(true);
    E.setPlayArea(g.inPlay);
    expect(E.neighbors(5)).not.toContain(4); // Losheim borders Zone 5 Losheimergraben, which nobody may enter
    g.phase = 'movement';
    const opts = E.moveOptions(g, g.units.find((u) => u.name === 'Peiper')!.id);
    expect(opts.every((o) => E.areas.get(o.area)!.zone === 6)).toBe(true);
    // a German block in Losheim traces supply only through Zone 5 when Blankenheim (Z) is cut off
    const h = cold();
    for (const u of h.units) if (u.area === 6) u.area = null;
    h.control[6] = 'allied';
    h.control[7] = 'allied';
    h.control[8] = 'allied';
    expect(h.control[4]).toBe('german');
    expect(E.inSupply(h, 'german', 5)).toBe(true);
    h.supplyOnly = undefined;
    expect(E.inSupply(h, 'german', 5)).toBe(false);
  });
  it('draws chits from the sheet table: [German player turn, Allied player turn]', () => {
    const g = cold();
    expect(g.track![1]).toEqual({ ge: [5, 2], al: [4, 0], sd: null });
    expect(g.track![8]).toEqual({ ge: [2, 1], al: [6, 4], sd: null });
  });
  it('applies German artillery attrition only from turn 5 and delays used reusable SAs and HQ a turn (P.6)', () => {
    const g = cold();
    g.turn = 3;
    g.phasing = 'german';
    g.phase = 'reinforcement';
    for (const c of g.chits.filter((x) => x.side === 'german' && x.kind === 'artillery').slice(0, 2)) c.box = 'used';
    const sa = g.chits.find((c) => c.kind === 'sa_block' && c.side === 'german')!;
    sa.box = 'used';
    const hq = g.chits.find((c) => c.kind === 'command_staff' && c.side === 'german')!;
    hq.box = 'used';
    g.phase = 'supply';
    g.phasing = 'allied';
    g.supplyPending = false;
    E.endPhase(g); // into turn 4's reinforcement
    expect(g.turn).toBe(4);
    expect(g.artyPick).toBeFalsy();
    expect(g.chits.filter((c) => c.side === 'german' && c.kind === 'artillery' && c.box === 'eliminated').length).toBe(0);
    expect(sa.box).toBe('used');
    expect(hq.box).toBe('used'); // held for one more turn
    for (const c of g.chits.filter((x) => x.side === 'german' && x.kind === 'artillery').slice(0, 2)) c.box = 'used';
    g.phase = 'supply';
    g.phasing = 'allied';
    E.endPhase(g); // turn 5: attrition applies now
    expect(g.turn).toBe(5);
    expect(g.artyPick).toBe(true);
    E.chooseArtyLoss(g, E.boxOf(g, 'german', 'used').find((c) => c.kind === 'artillery')!.id);
    expect(g.chits.filter((c) => c.side === 'german' && c.kind === 'artillery' && c.box === 'eliminated').length).toBe(1);
    expect(sa.box).toBe('available');
    expect(hq.box).toBe('cup');
  });
  it('scores German-controlled Zone 6 areas at the end (P.7)', () => {
    const g = cold();
    const z6 = g.inPlay!;
    const setN = (n: number) =>
      z6.forEach((a, i) => {
        g.control[a] = i < n ? 'german' : 'allied';
      });
    setN(11);
    expect(E.coldResult(g)).toMatch(/^German Victory/);
    setN(10);
    expect(E.coldResult(g)).toMatch(/^Draw/);
    setN(9);
    expect(E.coldResult(g)).toMatch(/^Allied Victory/);
    expect(E.victoryTable(g)[0][1]).toBe('German Victory');
  });
  it('plays through all nine turns to a result', () => {
    for (const seed of [1, 7]) {
      const g = cold(seed);
      for (let i = 0; i < 900 && !g.over; i++) step(g);
      expect(g.turn).toBe(9);
      expect(g.over).toMatch(/Victory|Draw/);
      expect(g.units.every((u) => u.area == null || E.areas.get(u.area)!.zone === 6)).toBe(true);
    }
  });
});
