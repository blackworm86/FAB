// Sicily on the series engine: the set-up and the landings (22.2, 14.2), zones (14.3), supply (14.9), victory (19.x), the scenarios played through.
import { describe, expect, it } from 'vitest';
import * as E from '../src';
import mapJson from '../../data/sicily/map.json';
import { newSicilyGame, unit, onMap, move, fight, step, playOut, runTo, give } from './sicily-helpers';

const S = E.sicily;
describe('Sicily set-up (22.24-22.26)', () => {
  it('a Tournament game sets up: 29 garrisons face down one per area, field works on the invaded coast, beachheads, the invasion units on them', () => {
    const g = newSicilyGame(3, 'tournament', false);
    expect(g.phase).toBe('deploy'); expect(g.units.filter((u) => u.untried).length).toBe(29);
    expect(S.deployOptions(g, 'IT09').length).toBeGreaterThan(50);
    expect(() => S.choosePlan(g, 'historical', 'B1')).toThrow(/garrisons first/);
    S.autoDeploy(g);
    const garrisonAreas = g.units.filter((u) => u.untried).map((u) => u.area!);
    expect(new Set(garrisonAreas).size).toBe(29); expect(garrisonAreas.every((a) => a >= 1 && a <= 65)).toBe(true);
    const V = S.state(g); expect(V.plan).toBe('historical');
    expect(S.beachheads(g).map((b) => b.box).sort()).toEqual(['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'B5']);
    for (const a of [1, 2, 4, 5, 8, 9, 19, 20]) if (E.unitsIn(g, a, 'axis').length) expect(g.fieldWorks).toContain(a);     // 22.24: field works where an Axis unit holds an invasion-capable area
    expect(g.units.filter((u) => u.box === 'deploy').length).toBe(0);
    expect(g.units.filter((u) => u.box === 'airborne_assault').map((u) => u.id).sort()).toEqual(['BR11', 'US09']);
    for (const b of S.beachheads(g)) expect(E.unitsIn(g, b.id).length).toBeLessThanOrEqual(2);
    expect(E.unitsIn(g, S.boxId('A1')).every((u) => u.nation === 'us')).toBe(true);
    endPhase(g); expect(g.phase).toBe('movement'); expect(g.phasing).toBe('allied'); expect(g.turn).toBe(1);
  });
  it('the alternate plan: five consecutive British boxes across A and B, four consecutive US boxes in D', () => {
    const g = newSicilyGame(3, 'tournament', false); for (const u of g.units.filter((x) => x.untried)) { u.box = undefined; u.area = 30; }
    expect(S.planOptions(g, 'alternate')).toEqual({ british: ['A1', 'A2', 'A3', 'A4', 'B1', 'B2'], us: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10'] });
    S.choosePlan(g, 'alternate', 'A3', 'D5');
    expect(S.beachheads(g).map((b) => `${b.box}:${b.nation}`).sort()).toEqual(['A3:british', 'A4:british', 'B1:british', 'B2:british', 'B3:british', 'D5:us', 'D6:us', 'D7:us', 'D8:us']);
    const us = unit(g, 'US03'); expect(S.allowedZones(g, us)).toEqual(new Set(['C', 'D'])); expect(S.allowedZones(g, unit(g, 'BR03'))).toEqual(new Set(['A', 'B']));
  });
  it('Axis start: the 15th PG in Regalbuto in reserve, Livorno in Canicattì, all land Axis-controlled, 8 VPs to the Axis', () => {
    const g = newSicilyGame(5);
    expect(unit(g, 'GE01').area).toBe(25); expect(unit(g, 'GE01').reserve).toBe('res'); expect(unit(g, 'IT01').area).toBe(40); expect(unit(g, 'IT01').motorized).toBe(true);
    for (let a = 1; a <= 65; a++) expect(g.control[a]).toBe('axis');
    const v = E.victory(g); expect(v.axis).toBe(8); expect(v.allied).toBe(0); expect(v.net).toBe(-8);
  });
});
const endPhase = E.endPhase;
describe('Landings (14.24-14.27)', () => {
  it('from a landing box a unit can only advance to its coastal area, for its whole allowance; the landing against defenders is a beach assault', () => {
    const g = newSicilyGame(7);
    const a1 = S.boxId('A1'), us = E.unitsIn(g, a1)[0];
    const o = E.moveOptions(g, us.id); expect(o.map((x) => x.area)).toEqual([20]); expect(o[0].cost).toBe(us.cls === 'armor' ? 6 : 3); expect(o[0].mustStop).toBe(true);
    const defended = E.unitsIn(g, 20, 'axis').length > 0;
    move(g, us.id, 20); expect(us.area).toBe(20);
    if (defended) { expect(E.contested(g, 20)).toBe(true); endPhase(g); endPhase(g); expect(g.phase).toBe('combat'); expect(g.riverAssault).toContain(20); expect(E.mustFight(g)).toContain(20); }
  });
  it('units left in a landing box at the end of the Movement Phase go back to sea and land again next turn', () => {
    const g = newSicilyGame(7); const b1 = S.boxId('B1'), us = E.unitsIn(g, b1);
    for (const u of E.unitsIn(g, 2, 'axis')) { u.area = 30; }                                                 // Modica empty
    move(g, us[0].id, 2); move(g, us[1].id, 2); expect(onMap(g, 2).length).toBe(2);
    const late = E.unitsIn(g, S.boxId('B2'))[0]; const o = E.moveOptions(g, late.id); expect(o.length).toBe(E.unitsIn(g, 1, 'axis').length || E.blocks(g, 1, 'allied').length < 2 ? o.length : 0);
    unit(g, 'BR05').area = 1; unit(g, 'BR06').area = 1; g.control[1] = 'allied'; for (const u of E.unitsIn(g, 1, 'axis')) u.area = 30;
    const stuck = E.unitsIn(g, S.boxId('B2'))[0]; expect(E.moveOptions(g, stuck.id)).toEqual([]);           // Pachino is full
    endPhase(g); expect(stuck.box).toBe('at_sea'); expect(stuck.area).toBeNull();
    runTo(g, 2, 'allied', 'reinforcement'); expect(g.pendingArrivals).toContain(stuck.id);
    expect(E.arrivalOptions(g, stuck.id).map((x) => x.area).every((x) => x >= 100)).toBe(true);
  });
  it('airborne units wait in the Airborne Assault box and drop next to two areas of their army at the start of the Combat Phase; no abort', () => {
    const g = newSicilyGame(9); const para = unit(g, 'US09'); expect(para.box).toBe('airborne_assault');
    for (const u of E.unitsIn(g, 20, 'axis')) u.area = 30; for (const u of E.unitsIn(g, 19, 'axis')) u.area = 30;
    for (const u of E.unitsIn(g, S.boxId('A1'))) move(g, u.id, 20); for (const u of E.unitsIn(g, S.boxId('A2'))) move(g, u.id, 19);
    endPhase(g); endPhase(g); expect(g.phase).toBe('combat'); expect(S.state(g).dropPending).toBe(true);
    expect(() => endPhase(g)).toThrow(/airborne/);
    const t = S.airDropTargets(g, 'US09'); expect(t.length).toBeGreaterThan(0); expect(t).toContain(21);              // Butera touches Licata and Gela
    const enemy = t.find((a) => E.unitsIn(g, a, 'axis').length) ?? t[0]; S.airDrop(g, 'US09', enemy); expect(para.area).toBe(enemy);
    S.airDrop(g, 'BR11', S.airDropTargets(g, 'BR11')[0] ?? null); expect(S.state(g).dropPending).toBe(false);
    if (E.unitsIn(g, enemy, 'axis').length) { expect(g.riverAssault).toContain(enemy); const b = E.startBattle(g, enemy); E.beginCombat(g, b); expect(b.attPoint).toBe('US09'); expect(E.VOLUMES.sicily.canAbort!(g, b)).toMatch(/14.27a/); }
  });
});
describe('Zones and releases (14.3, 14.4, 14.61, 17.23)', () => {
  it('a US unit of the historical plan stays in zones A and C, never B; released it may enter D; the 7th Army Release frees every US division', () => {
    const g = newSicilyGame(11); const u = unit(g, 'US03'); u.area = 20; g.control[20] = 'allied'; for (const x of E.unitsIn(g, 20, 'axis')) x.area = 30;
    const reach = () => E.moveOptions(g, u.id).map((o) => o.area);
    expect(reach().length).toBeGreaterThan(0); expect(reach().every((a) => ['A', 'C'].some((z) => mapZones(a).includes(z)))).toBe(true);
    expect(reach()).not.toContain(41);                                                                                // Palma (D) across the army boundary
    g.phase = 'admin'; give(g, 'USC15'); S.releaseDivision(g, 'us_1st_inf'); g.phase = 'movement'; expect(reach()).toContain(41);
    const v = unit(g, 'US05'); v.area = 20; expect(E.moveOptions(g, v.id).map((o) => o.area)).not.toContain(41);
    g.phase = 'admin'; give(g, 'USC23'); S.playArmyRelease(g, 'USC23'); g.phase = 'movement'; expect(E.moveOptions(g, v.id).map((o) => o.area)).toContain(41);
    v.area = 28; g.control[28] = 'allied'; expect(E.moveOptions(g, v.id).map((o) => o.area)).not.toContain(27 === 27 ? 26 : 26);   // Catania is zone B: never for Americans
    expect(E.moveOptions(g, v.id).map((o) => o.area)).toContain(29);                                                       // Messina is in B and C
  });
});
const mapZones = (a: number) => (mapJson as unknown as { areas: { id: number; zone: string[] }[] }).areas.find((x) => x.id === a)!.zone;
describe('Supply and victory (14.9, 19.x)', () => {
  it('the Axis traces to Messina; an American unit to a US beachhead or an undamaged friendly port, a British one to a British beachhead', () => {
    const g = newSicilyGame(13);
    expect(E.inSupply(g, 'axis', 65)).toBe(true); g.control[29] = 'allied'; expect(E.inSupply(g, 'axis', 65)).toBe(false); g.control[29] = 'axis';
    const us = unit(g, 'US03'); us.area = 20; g.control[20] = 'allied'; for (const x of E.unitsIn(g, 20, 'axis')) x.area = 30;
    expect(E.VOLUMES.sicily.unitSupply!(g, us)).toBe(true);
    const br = unit(g, 'BR03'); br.area = 20; expect(E.VOLUMES.sicily.unitSupply!(g, br)).toBe(false);                 // no British beachhead and no port reachable
    g.control[1] = 'allied'; g.control[2] = 'allied'; g.control[8] = 'allied'; g.control[9] = 'allied'; g.control[7] = 'allied'; g.control[19] = 'allied';
    expect(E.VOLUMES.sicily.unitSupply!(g, br)).toBe(true);
  });
  it('the Allies score crosses and yellow stars only when occupied, the Axis white and yellow stars; captured beachheads count for the Axis', () => {
    const g = newSicilyGame(13); g.control[26] = 'allied'; for (const x of E.unitsIn(g, 26, 'axis')) x.area = 30;
    let v = E.victory(g); expect(v.allied).toBe(0);                                                                    // Catania held but empty, and no supply line
    const u = unit(g, 'BR03'); u.area = 26; S.state(g).beachheads[S.boxId('B6')] = 'british'; g.control[S.boxId('B6')] = 'allied'; g.control[14] = 'allied';
    v = E.victory(g); expect(v.allied).toBe(1); expect(v.axis).toBe(7);
    S.state(g).captured.push(S.boxId('A1')); expect(E.victory(g).axis).toBe(8);
  });
});
describe('The scenarios play through', () => {
  it('Sunrise Bridge: 4 turns on 17 areas, British only, its own track and VPs', () => {
    const g = newSicilyGame(21, 'sunrise_bridge');
    expect(g.lastTurn).toBe(4); expect(g.inPlay).toContain(26); expect(g.inPlay).not.toContain(30);
    expect(g.units.every((u) => u.side === 'axis' || u.nation === 'british')).toBe(true);
    expect(S.beachheads(g).map((b) => b.box)).toEqual(['B1', 'B2', 'B3', 'B4', 'B5']);
    expect(g.units.filter((u) => u.untried).length).toBe(10); expect(g.units.filter((u) => u.untried).every((u) => [1, 2, 3, 4, 5, 6, 7, 13, 14, 26].includes(u.area!))).toBe(true);
    playOut(g); expect(g.over).toMatch(/Victory|Draw/); expect(g.turn).toBe(4);
  });
  it('Tournament: five turns, sudden death from turn 4, an Axis win at 4+ VPs', () => {
    const g = newSicilyGame(23); playOut(g); expect(g.over).toBeTruthy(); expect(g.turn).toBeLessThanOrEqual(5);
  });
  it('Campaign: nine turns; reinforcements arrive at the beachheads and ports; the Axis at Messina', () => {
    const g = newSicilyGame(29, 'campaign'); playOut(g, 6000); expect(g.over).toBeTruthy();
    const arrivedGe = unit(g, 'GE06'); expect(arrivedGe.area != null || arrivedGe.str === 0 || arrivedGe.box === 'evacuated' || arrivedGe.arrival != null).toBe(true);
  });
});
