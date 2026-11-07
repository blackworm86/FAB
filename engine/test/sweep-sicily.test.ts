// Sweep of the Sicily module against the printed rules: each test asserts what the rules require and fails on an engine bug.
import { describe, expect, it } from 'vitest';
import * as E from '../src';
import { newSicilyGame, unit, chit, give, runTo, step } from './sicily-helpers';

const S = E.sicily;
const clear = (g: E.Game, a: number, side: E.Side) => { for (const x of E.unitsIn(g, a, side)) x.area = 64; };

describe('Sicily rules sweep', () => {
  it('14.25a / 14.26: an Axis unit arriving in the Messina port box (P4) can advance to Messina while Axis units hold it', () => {
    const g = newSicilyGame(41, 'campaign');
    g.phase = 'movement'; g.phasing = 'axis'; g.contestedAtMoveStart = [];
    const ge = unit(g, 'GE06'); ge.arrival = undefined; ge.area = S.boxId('P4'); ge.moved = false;
    for (const x of E.unitsIn(g, 29)) x.area = 28;                           // room for one more block (stacking 2)
    const it = unit(g, 'IT01'); it.area = 29; it.reserve = null;            // an Axis unit already in Messina
    expect(E.moveOptions(g, ge.id).map((o) => o.area)).toContain(29);
  });
  it('14.24a / 14.24b: Axis units left in the Messina port box are not sent to the (Allied) At Sea box at the end of the Axis Movement Phase', () => {
    const g = newSicilyGame(41, 'campaign');
    runTo(g, 1, 'axis', 'movement');
    const ge = unit(g, 'GE06'); ge.arrival = undefined; ge.area = S.boxId('P4');
    E.endPhase(g);
    expect(ge.box).not.toBe('at_sea');
  });
  it('16.21 / Example 2A: the reusable Special Action may save the Naval Support asset in the Used Box before the fleet withdraws one', () => {
    const g = newSicilyGame(43);
    runTo(g, 1, 'axis', 'supply');
    for (const c of g.chits.filter((x) => x.side === 'allied' && x.box === 'used')) c.box = 'cup';
    const nav = chit(g, 'USC07a'); nav.box = 'used';
    chit(g, 'AL01').box = 'available';                                       // the reusable SA unused at the start of turn 2
    E.endPhase(g);
    expect(g.turn).toBe(2); expect(g.recover).toContain('allied');
    expect(nav.box).toBe('used');                                            // still there to be recovered (step 1) before the reduction (step 3)
  });
  it('16.33: an interdiction mission stays only until the Supply Phase of the same player turn, whoever placed it', () => {
    const g = newSicilyGame(45);
    runTo(g, 2, 'axis', 'admin');
    const air = chit(g, 'USC06a'); air.box = 'available';
    S.airInterdiction(g, air.id, 59);                                         // the Allies interdict in the Axis player turn (Example 3)
    for (let i = 0; i < 50 && g.phase !== 'supply'; i++) step(g);
    expect(g.phase).toBe('supply'); expect(g.phasing).toBe('axis');
    expect(air.box).toBe('used'); expect(g.interdicted[59]).toBeUndefined();
  });
  it('15.3c: untried units are eliminated only when an OOS morale check is required of them (their own Supply Phase), not in the Allied one', () => {
    const g = newSicilyGame(47);
    runTo(g, 1, 'allied', 'btCombat');
    for (const u of E.unitsIn(g, 29, 'axis')) u.area = 30; g.control[29] = 'allied';     // Messina lost: every Axis unit is out of supply
    const untried = g.units.filter((u) => u.untried && u.area != null && !E.contested(g, u.area));
    expect(untried.length).toBeGreaterThan(0);
    E.endPhase(g); expect(g.phase).toBe('supply'); expect(g.phasing).toBe('allied');
    expect(untried.every((u) => u.area != null && u.str > 0)).toBe(true);
  });
  it('15.3a: placing an untried unit in reserve is its one action; no other untried unit may then move in that Movement Phase', () => {
    const g = newSicilyGame(49);
    runTo(g, 1, 'axis', 'movement');
    E.setReserve(g, 'GE01', false);                                           // free the Axis reserve marker
    const ok = g.units.filter((u) => u.untried && u.area != null && E.canReserve(g, u));
    const a = ok[0]; expect(a).toBeTruthy();
    E.setReserve(g, a.id, true); expect(a.reserve).toBeTruthy();
    const b = g.units.find((u) => u.untried && u.area != null && u.id !== a.id && !E.contested(g, u.area!) && E.unitsIn(g, u.area!, 'allied').length === 0)!;
    expect(E.moveOptions(g, b.id)).toEqual([]);
  });
  it('17.22: one flanking invasion per Admin Phase — a second 30th RCT may land in a later Admin Phase while the first still stands', () => {
    const g = newSicilyGame(51);
    runTo(g, 2, 'allied', 'admin');
    const us = unit(g, 'US03'); us.box = undefined; us.area = 20; clear(g, 20, 'axis'); g.control[20] = 'allied';
    give(g, 'USC27');
    const t = S.flankTargets(g, 'USC27').filter((a) => !E.unitsIn(g, a, 'axis').length);
    expect(t.length).toBeGreaterThan(0);
    S.playFlanking(g, 'USC27', t[0]);
    runTo(g, 3, 'allied', 'admin');
    expect(Object.keys(S.state(g).flank).length).toBe(1);                   // the first is still on the map
    us.area = 20; g.control[20] = 'allied';
    give(g, 'USC31');
    expect(S.flankTargets(g, 'USC31').length).toBeGreaterThan(0);
  });
  it('14.29: an Axis unit moving normally into Messina may then spend one MP to evacuate', () => {
    const g = newSicilyGame(53);
    runTo(g, 1, 'axis', 'movement');
    const u = unit(g, 'GE01'); E.setReserve(g, 'GE01', false); u.area = 28; u.moved = false;
    E.move(g, u.id, 29); expect(u.area).toBe(29);
    expect(S.canEvacuate(g, u)).toBe(true);
  });
  it('14.1: the side controlling Mount Etna may leave it by road, armor too, even while it is contested', () => {
    const g = newSicilyGame(55);
    g.phase = 'movement'; g.phasing = 'axis';
    for (const a of [27, 28]) { clear(g, a, 'axis'); clear(g, a, 'allied'); g.control[a] = 'axis'; }
    const pz = unit(g, 'GE01'); pz.area = 27; pz.reserve = null; pz.moved = false; pz.disorder = 0;
    const br = unit(g, 'BR03'); br.box = undefined; br.area = 27;
    g.contestedAtMoveStart = [27];
    expect(E.contested(g, 27)).toBe(true);
    expect(E.moveOptions(g, pz.id).map((o) => o.area)).toContain(28);
  });
  it('22.28 with 19.3: the Tournament is decided on the VP level (net); Axis ahead by only 3 is an Allied win', () => {
    const g = newSicilyGame(57);
    g.elimLarge.push(...g.units.filter((u) => u.side === 'axis' && u.max >= 3).slice(0, 5).map((u) => u.id));
    const v = E.victory(g); expect(v.axis).toBe(8); expect(v.allied).toBe(5); expect(v.net).toBe(-3);
    expect(E.VOLUMES.sicily.finalResult!(g, v.net)).toMatch(/Allied/);
  });
  it('22.17: Sunrise Bridge VPs go for control of the areas — an Axis-controlled area does not stop counting when contested', () => {
    const g = newSicilyGame(59, 'sunrise_bridge');
    const before = E.victory(g).axis;
    const br = g.units.find((u) => u.nation === 'british' && u.box !== 'airborne_assault' && u.symbol !== 'airborne')!; br.box = undefined; br.area = 26;
    expect(g.control[26]).toBe('axis'); expect(E.contested(g, 26)).toBe(true);
    expect(E.victory(g).axis).toBe(before);
  });
  it('16.21: Shock and Awe is the first act of the battle — the field works go even if the attack is then aborted', () => {
    const g = newSicilyGame(61);
    g.phase = 'combat'; g.phasing = 'allied'; g.fought = [];
    clear(g, 14, 'axis'); clear(g, 14, 'allied'); const it = unit(g, 'IT03'); it.area = 14; it.disorder = 0; it.untried = undefined; g.control[14] = 'axis';
    const br = unit(g, 'BR03'); br.box = undefined; br.area = 14; br.disorder = 0;
    const b6 = S.boxId('B6'); S.state(g).beachheads[b6] = 'british'; g.control[b6] = 'allied';
    g.fieldWorks = [14]; g.fwOwner[14] = 'axis'; g.riverAssault = [];
    const nav = chit(g, 'BRC09a'); nav.box = 'available';
    const b = E.startBattle(g, 14); E.assign(g, b, nav.id); S.setNavalShock(g, b, nav.id);
    g.force = Array(40).fill(1);                                             // the defenders hit with every die
    E.beginCombat(g, b);
    for (let i = 0; i < 30 && b.stage !== 'done'; i++) {
      if (b.stage === 'attFirst') E.chooseFirstLoss(g, b, b.attPoint);
      else if (b.stage === 'attChoice') E.attackerChoice(g, b, true);
      else if (b.stage === 'retreat') E.chooseRetreat(g, b, E.retreatOptions(g, b)[0]);
      else E.roll_step(g, b);
    }
    expect(b.result ?? '').toMatch(/abort/i);
    expect(g.fieldWorks).not.toContain(14);
  });
  it('14.64: the Reroute Reinforcement Special Action is not used in Sicily', () => {
    const g = newSicilyGame(63);
    g.phase = 'reinforcement'; g.phasing = 'allied';
    const u = unit(g, 'US03'); u.box = undefined; u.area = S.boxId('A1'); g.arrived = [u.id];
    for (const x of E.unitsIn(g, S.boxId('A2'))) x.area = 64;
    give(g, 'USC15'); chit(g, 'AL01').box = 'available';
    expect(E.rerouteOptions(g, u.id)).toEqual([]);
  });
  it('14.26 / 14.27b: landing into an area that is already contested is ordinary combat — an abort is not a sea retreat and costs no beachhead', () => {
    const g = newSicilyGame(65);
    const a1 = S.boxId('A1');
    clear(g, 20, 'axis'); clear(g, 20, 'allied');
    const it = unit(g, 'IT05'); it.area = 20; it.disorder = 0; g.control[20] = 'axis';
    const first = unit(g, 'US05'); first.box = undefined; first.area = 20;              // already ashore: Licata is contested before the landing
    g.contestedAtMoveStart = [20];
    const lander = E.unitsIn(g, a1).find((u) => u.id !== first.id)!;
    E.move(g, lander.id, 20); expect(lander.area).toBe(20);
    for (const x of g.units.filter((y) => y.box === 'airborne_assault')) x.box = 'at_sea';      // keep the drops out of this test
    E.endPhase(g); E.endPhase(g); expect(g.phase).toBe('combat');
    expect(g.riverAssault).not.toContain(20);                                           // not newly contested: no assault marker
    const b = E.startBattle(g, 20); g.force = Array(40).fill(1); E.beginCombat(g, b);
    for (let i = 0; i < 30 && b.stage !== 'done'; i++) {
      if (b.stage === 'attFirst') E.chooseFirstLoss(g, b, b.attPoint);
      else if (b.stage === 'attChoice') E.attackerChoice(g, b, true);
      else if (b.stage === 'retreat') E.chooseRetreat(g, b, E.retreatOptions(g, b)[0]);
      else E.roll_step(g, b);
    }
    expect(b.result ?? '').toMatch(/abort/i);
    expect(S.state(g).beachheads[a1]).toBe('us');
    expect(lander.box).not.toBe('at_sea');
  });
  it('14.63: the Axis staff asset may not replace steps of units on the board', () => {
    const g = newSicilyGame(67);
    runTo(g, 2, 'axis', 'admin');
    const staff = chit(g, 'ITC11'); staff.box = 'available';
    const u = unit(g, 'IT03'); u.str = u.max - 1; u.unsupplied = false; expect(u.area).not.toBeNull();
    expect(() => E.staffReplacement(g, staff.id, u.id)).toThrow();
  });
  it('17.11: under the Patton Soldier Slap a US single-use Special Action event needs a second one for its alternate event use (4.21) too', () => {
    const g = newSicilyGame(69);
    runTo(g, 2, 'allied', 'admin');
    S.state(g).patton = true;
    for (const c of g.chits.filter((x) => x.kind === 'special_action_event' && x.box === 'available')) c.box = 'cup';
    give(g, 'USC15');
    chit(g, 'USC01').box = 'eliminated';                                                   // something the alternate use could bring back
    expect(() => E.alternateUse(g, 'USC15')).toThrow();
  });
  it('14.43: retreating into a prohibited zone (US into zone B) does not count as a release of the division', () => {
    const g = newSicilyGame(71);
    const u = unit(g, 'US03'); u.box = undefined; u.area = 6; expect(S.isReleased(g, u)).toBe(false);
    E.VOLUMES.sicily.onRetreat!(g, u, 7, 6);
    expect(S.isReleased(g, u)).toBe(false);
  });
});

describe('Sicily ports (decision: Example 10 lists three Sicilian ports)', () => {
  it('17.21a / 16.5: an Allied Messina triggers neither Fading Italian Morale nor the extra Allied draw', () => {
    const g = newSicilyGame(81);
    const V = S.state(g), before = V.morale;
    for (const x of E.unitsIn(g, 29, 'axis')) x.area = 28;
    const br = unit(g, 'BR03'); br.box = undefined; br.area = 29; g.control[29] = 'allied';
    E.VOLUMES.sicily.onPhase!(g, 'movement', 'end');
    expect(V.morale).toBe(before);
    expect(E.VOLUMES.sicily.extraDraws!(g, 'allied')).toBe(0);
  });
});
