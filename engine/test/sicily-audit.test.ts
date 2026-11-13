// Sicily: the rules audit of November 2026 (one test per fix).
import { describe, expect, it } from 'vitest';
import * as E from '../src';
import { newSicilyGame, unit, move, give } from './sicily-helpers';

const S = E.sicily;
const boxArea = (box: number) => S.BOX.get(box)!.area;
const clear = (g: E.Game, a: number) => {
  for (const u of g.units) if (u.area === a && !u.garrison) u.area = null;
};
const combat = (g: E.Game, side: E.Side) => {
  g.phase = 'combat';
  g.phasing = side;
  g.contestedAtMoveStart = [];
  g.fought = [];
  g.battle = null;
};

describe('Sicily audit fixes', () => {
  it('14.27b: an aborted beach assault goes back to sea without an extra step loss', () => {
    const g = newSicilyGame(5);
    const box = g.units.find((u) => u.side === 'allied' && u.area != null && S.isLandingBox(u.area))!.area!,
      a = boxArea(box);
    const us = g.units.filter((u) => u.area === box);
    clear(g, a);
    const it = unit(g, 'IT05');
    it.area = a;
    it.untried = false;
    g.control[a] = 'axis';
    for (const u of us) {
      expect(move(g, u.id, a)).toBe('moved');
    }
    combat(g, 'allied');
    g.force = [1, 1, 1, 10, 10, 10, 10, 10, 10, 10, 10, 10]; // the defender scores three hits
    const b = E.startBattle(g, a);
    beginAndAbort(g, b);
    const steps = us.map((u) => u.str);
    expect(us.every((u) => u.box === 'at_sea')).toBe(true);
    expect(steps.reduce((t, x) => t + x, 0)).toBe(us.reduce((t, u) => t + u.max, 0) - 1); // only the mandatory first hit
  });
  it('14.27a: an airborne drop into an already contested area makes that battle mandatory', () => {
    const g = newSicilyGame(6);
    combat(g, 'allied');
    const ab = unit(g, 'US09');
    ab.box = 'airborne_assault';
    ab.area = null;
    clear(g, 21);
    unit(g, 'US07').area = 21;
    const it = unit(g, 'IT05');
    it.area = 21;
    it.untried = false;
    g.contestedAtMoveStart = [21];
    clear(g, 20);
    unit(g, 'US02').area = 20;
    g.control[20] = 'allied';
    clear(g, 19);
    unit(g, 'US03').area = 19;
    g.control[19] = 'allied';
    S.state(g).dropPending = true;
    S.airDrop(g, 'US09', 21);
    expect(E.mustFight(g)).toContain(21);
  });
  it('6.22: US and British units in one battle are different Higher Echelons', () => {
    const g = newSicilyGame(7);
    combat(g, 'allied');
    const a = boxArea(Object.keys(S.state(g).beachheads).map(Number)[0]);
    clear(g, a);
    const us = unit(g, 'US03'),
      br = unit(g, 'BR03');
    us.area = a;
    br.area = a;
    S.state(g).released.push(us.division!, br.division!);
    const it = unit(g, 'IT05');
    it.area = a;
    it.untried = false;
    g.control[a] = 'allied';
    g.contestedAtMoveStart = [a];
    give(g, 'USC04');
    give(g, 'USC10');
    give(g, 'USC11');
    const b = E.startBattle(g, a);
    expect(E.canAssign(g, b, 'allied', E.chit(g, 'USC04'))).toMatch(/6\.22/);
    expect(E.canAssign(g, b, 'allied', E.chit(g, 'USC10'))).toBeNull();
    E.assign(g, b, 'USC10');
    expect(E.canAssign(g, b, 'allied', E.chit(g, 'USC11'))).toMatch(/one artillery/);
  });
  it('16.32: a side that committed air support may not also dogfight', () => {
    const g = newSicilyGame(8);
    combat(g, 'allied');
    const a = boxArea(Object.keys(S.state(g).beachheads).map(Number)[0]);
    clear(g, a);
    unit(g, 'US03').area = a;
    const it = unit(g, 'IT05');
    it.area = a;
    it.untried = false;
    g.control[a] = 'allied';
    g.contestedAtMoveStart = [a];
    give(g, 'USC06a');
    give(g, 'USC08a');
    const ax = g.chits.find((c) => c.side === 'axis' && c.kind === 'air_mission')!;
    ax.box = 'available';
    const b = E.startBattle(g, a);
    if (b.defSA) E.passSA(g, b);
    E.assign(g, b, 'USC06a', 'arty');
    E.setReady(g, b, 'allied');
    E.assign(g, b, ax.id, 'arty');
    expect(() => S.dogfight(g, b, 'USC08a')).toThrow(/16\.32/);
  });
  it('16.34: air supply keeps the unsupplied marker, spares the morale check and lets disorder adjust', () => {
    const g = newSicilyGame(9);
    const u = unit(g, 'US03');
    clear(g, 30);
    u.area = 30;
    u.disorder = 1;
    g.control[30] = 'allied';
    g.phase = 'btCombat';
    g.phasing = 'allied';
    g.contestedAtMoveStart = [];
    E.endPhase(g);
    expect(g.phase).toBe('supply');
    expect(u.unsupplied).toBe(true);
    const air = g.chits.find((c) => c.side === 'allied' && c.kind === 'air_mission')!;
    air.box = 'available';
    S.airSupply(g, air.id, 30);
    expect(u.unsupplied).toBe(true);
    expect(u.disorder).toBe(2);
    expect(E.supplyChecks(g).some((c) => c.unit.id === 'US03')).toBe(false);
  });
  it('17.22: a flanking invasion on defenders must fight its round before the Admin Phase ends, and cannot attack in a later Admin Phase', () => {
    const g = newSicilyGame(10);
    g.turn = 2;
    g.phase = 'admin';
    g.phasing = 'allied';
    g.fought = [];
    const c = g.chits.find((x) => x.flank && x.side === 'allied')!;
    c.box = 'available';
    const t = S.flankTargets(g, c.id);
    if (!t.length) return; // no legal landing in this set-up: nothing to test
    const a = t.find((x) => E.unitsIn(g, x, 'axis').length) ?? t[0];
    if (!E.unitsIn(g, a, 'axis').length) {
      const it = unit(g, 'IT05');
      it.area = a;
      it.untried = false;
    }
    S.playFlanking(g, c.id, a);
    expect(() => E.endPhase(g)).toThrow(/17\.22/);
    expect(() => E.startBattle(g, a)).not.toThrow();
    g.battle = null;
    g.fought.push(a);
    E.endPhase(g);
    g.turn = 3;
    g.phase = 'admin';
    g.phasing = 'allied';
    g.fought = [];
    expect(() => E.startBattle(g, a)).toThrow(/no battle/);
  });
  it("14.22: a beachhead lost in the other player's turn is destroyed before the next arrivals are placed", () => {
    const g = newSicilyGame(11);
    const box = Object.keys(S.state(g).beachheads).map(Number)[0],
      a = boxArea(box);
    clear(g, a);
    for (const u of g.units) if (u.area === box) u.area = null;
    g.control[a] = 'axis';
    g.turn = 1;
    g.phase = 'supply';
    g.phasing = 'axis';
    g.supplyPending = false;
    E.endPhase(g);
    expect(g.turn).toBe(2);
    expect(g.phase).toBe('reinforcement');
    expect(S.state(g).beachheads[box]).toBeUndefined();
  });
  it('14.27a: the abort ban holds even after the airborne unit is gone', () => {
    const g = newSicilyGame(12);
    const b = { stage: 'attChoice', pending: 1, attacker: 'allied', area: 21, vol: { airborne: 'US09', noAir: {} } } as never;
    expect(() => E.attackerChoice(g, b, true)).toThrow(/14\.27a/);
  });
});

function beginAndAbort(g: E.Game, b: E.Battle) {
  E.beginCombat(g, b);
  for (let i = 0; i < 40 && b.stage !== 'done'; i++) {
    if (b.stage === 'attFirst') E.chooseFirstLoss(g, b, b.attPoint);
    else if (b.stage === 'attChoice') {
      E.attackerChoice(g, b, true);
      break;
    } else if (b.stage === 'defChoice') E.defenderChoice(g, b, false);
    else E.roll_step(g, b);
  }
}
