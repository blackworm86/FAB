// 20.3 Operation Al-Owda, from its rules and the Al-Owda Setup Cards: six turns on the whole map but Mt Hermon.
import { describe, expect, it } from 'vitest';
import { endPhase, victory, golan, type Game } from '../src';
import { newGolanGame, unit, chit, playOut, runTo } from './golan-helpers';

const alowda = (seed = 4): Game => newGolanGame(seed, 'alowda' as 'badr');
const placeAll = (g: Game) => { golan.autoStrongpoints(g, 'historical'); for (const u of g.units.filter((x) => x.box === 'deploy')) golan.deploy(g, u.id, golan.deployOptions(g, u.id)[0]); golan.autoMinefields(g); golan.autoReserves(g); };

describe('Operation Al-Owda (20.3)', () => {
  it('sets up from the cards: six turns, Mt Hermon Syrian, sixteen Syrian units to place, the cards\' garrisons', () => {
    const g = alowda();
    expect(g.lastTurn).toBe(6); expect(g.phase).toBe('deploy'); expect(g.phasing).toBe('syrian');
    expect(g.inPlay).not.toContain(golan.HERMON); expect(g.control[golan.HERMON]).toBe('syrian');
    expect(g.units.filter((u) => u.box === 'deploy' && u.side === 'syrian').length).toBe(16); expect(g.units.filter((u) => u.box === 'deploy' && (u.fort || u.ghost)).length).toBe(11);
    for (const id of ['S24', 'S22', 'S17', 'S23']) expect(g.units.some((u) => u.id === id)).toBe(false);
    expect(g.units.filter((u) => u.garrison).map((u) => u.area).sort((a, b) => a! - b!)).toEqual([22, 30, 42, 46]);
    expect(unit(g, 'I03').area).toBe(30);                                                     // the card prints 30 (Tel Faris) on the 53/188th(-)
    expect(golan.isNight(g)).toBe(false); g.turn = 2; expect(golan.isNight(g)).toBe(false);
  });
  it('reinforcements and chits arrive on the card\'s turns, not the labels', () => {
    const g = alowda();
    expect(unit(g, 'S26').arrival).toBe(2); expect(unit(g, 'S28').arrival).toBe(2); expect(unit(g, 'S18').arrival).toBe(3); expect(unit(g, 'S21').arrival).toBe(4);
    expect(unit(g, 'S21').entry).toEqual(['V', 'W', 'X', 'Y', 'Z']); expect(unit(g, 'S18').box).toBeUndefined();
    expect(unit(g, 'I09').arrival).toBe(2); expect(unit(g, 'I02').arrival).toBe(2);
    expect(chit(g, 'IC24').turn).toBe(2); expect(chit(g, 'IC49').turn).toBe(4); expect(chit(g, 'SC41').turn).toBe(3);
    expect(chit(g, 'SC25').box).toBe('available'); expect(chit(g, 'SC35').box).toBe('available');
    expect(g.chits.some((c) => c.id === 'SC42' || c.id === 'IC47')).toBe(false);                    // not on the cards
    expect(g.chits.filter((c) => c.box === 'air_support_holding').length).toBe(2);
  });
  it('Syria lands the 181st and 182nd commandos, one per vacant area', () => {
    const g = alowda(); const cmd = golan.alowdaCommandos(g).map((c) => c.id).sort(); expect(cmd).toEqual(['SC23', 'SC30']);
    const at = golan.alowdaRaidAreas(g); expect(at).not.toContain(17); expect(at).not.toContain(golan.HERMON);
    expect(() => golan.alowdaRaid(g, 'SC19', at[0])).toThrow(/181st or 182nd/);
    golan.alowdaRaid(g, 'SC30', at[0]); golan.alowdaRaid(g, 'SC23', at[1]); expect(golan.alowdaRaidAreas(g)).toEqual([]);
  });
  it('the Israeli Reinforcements Draw Cup: six units and two ghosts, units added on turns 3-5, 1/4/4/3/2 drawn', () => {
    const g = alowda(); placeAll(g); endPhase(g);
    for (const id of ['I11', 'I13', 'I15']) { expect(unit(g, id).box).toBe('draw_cup'); expect(unit(g, id).arrival).toBeUndefined(); }
    expect(unit(g, 'I17').box).toBe('draw_later');
    runTo(g, 2, 'syrian', 'admin'); expect(golan.state(g).alowda!.drawn).toHaveLength(1);
    runTo(g, 6, 'syrian', 'admin'); const A = golan.state(g).alowda!;
    expect(A.drawn).toHaveLength(14); expect(A.cup).toHaveLength(0);
    for (const id of ['I11', 'I12', 'I13', 'I14', 'I15', 'I16', 'I17', 'I18', 'I19', 'I20', 'I21', 'I22']) expect(unit(g, id).arrival).toBeGreaterThanOrEqual(2);
  });
  it('Israel starts with 3 VPs; no sudden death; plays out to a result', () => {
    const g = alowda(); expect(victory(g).israeli).toBeGreaterThanOrEqual(3);
    placeAll(g); endPhase(g); expect(g.phase).toBe('movement'); expect(g.turn).toBe(1);
    playOut(g); expect(g.over).toMatch(/Victory|Draw/); expect(g.turn).toBe(6);
  });
  it('set-up: the seven Israeli units in the areas printed on the card; both sides must place all their reserve markers (20.34-20.35)', () => {
    const g = alowda();
    expect(Object.fromEntries(['I05', 'I07', 'I08', 'I04', 'I01', 'I03', 'I06'].map((id) => [id, unit(g, id).area]))).toEqual({ I05: 42, I07: 52, I08: 52, I04: 37, I01: 2, I03: 30, I06: 51 });
    golan.autoStrongpoints(g, 'historical'); for (const u of g.units.filter((x) => x.box === 'deploy')) golan.deploy(g, u.id, golan.deployOptions(g, u.id)[0]); golan.autoMinefields(g);
    expect(golan.reservesLeft(g, 'israeli')).toBe(4); expect(golan.reservesLeft(g, 'syrian')).toBe(2);
    expect(() => endPhase(g)).toThrow(/reserve markers/);
    golan.deployReserve(g, 'I05'); expect(golan.reservesLeft(g, 'israeli')).toBe(3);
    golan.autoReserves(g); expect(golan.reservesLeft(g, 'israeli')).toBe(0); expect(golan.reservesLeft(g, 'syrian')).toBe(0);
    expect(g.units.filter((u) => u.reserve && u.side === 'israeli')).toHaveLength(4); expect(g.units.filter((u) => u.reserve && u.side === 'syrian')).toHaveLength(2);
    endPhase(g); expect(g.phase).toBe('movement'); expect(g.phasing).toBe('syrian');
  });
  it('the Al-Owda Turn Track: draws 0/0 on turn 1, then 8/2, 7/2, 6/2, 6/2, 6/2 for Syria and 2/4, 4/5, 5/7, 5/8, 5/9 for Israel; no sudden death', () => {
    const g = alowda();
    expect(g.track!.map((r) => r.ge)).toEqual([[0, 0], [8, 2], [7, 2], [6, 2], [6, 2], [6, 2]]);
    expect(g.track!.map((r) => r.al)).toEqual([[0, 0], [2, 4], [4, 5], [5, 7], [5, 8], [5, 9]]);
    expect(g.track!.every((r) => r.sd == null)).toBe(true);
  });
  it('20.38: Israel scores the areas it holds east of the Israeli VP Line (Tel Saki 27 counts, Yonatan 26 does not)', () => {
    const g = alowda(); placeAll(g); endPhase(g);
    const score = () => victory(g).israeli;
    for (const a of [26, 27]) { g.units = g.units.filter((u) => u.area !== a); g.control[a] = 'syrian'; }
    const base = score();
    g.control[26] = 'israeli'; expect(score()).toBe(base);                         // west of the line
    g.control[27] = 'israeli'; expect(score()).toBe(base + 1);                     // east of it
  });
});
