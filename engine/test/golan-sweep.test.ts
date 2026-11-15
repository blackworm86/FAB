// Golan '73: the asset and event sweep of November 2026 (one test per fix).
import { describe, expect, it } from 'vitest';
import { startBattle, unitsIn, visibleTo, passSA, defenderReinforceSA, reinforcementPhase, recoverAsset, golan, type Game } from '../src';
import { CUR } from '../src/volumes';
import * as E from '../src';
import { newGolanGame, unit, chit, give } from './golan-helpers';

const S = (g: Game) => golan.state(g);
const syrAir = (g: Game) => g.chits.find((c) => c.kind === 'air_mission' && c.side === 'syrian')!.id;
const admin = (g: Game, side: 'israeli' | 'syrian') => {
  g.phase = 'admin';
  g.phasing = side;
  S(g).samTarget = undefined;
};

describe('Golan asset and event sweep', () => {
  it('16.31c: Syrian reconnaissance may fly over strongpoints only, and shows them', () => {
    const g = newGolanGame(31);
    admin(g, 'syrian');
    g.turn = 3;
    const a = [...new Set(g.units.filter((u) => u.side === 'israeli' && u.fort && u.area != null).map((u) => u.area!))].find((x) =>
      unitsIn(g, x, 'israeli').every((u) => u.fort),
    )!;
    expect(a).toBeDefined();
    const id = give(g, syrAir(g));
    golan.airRecon(g, id, a);
    if (S(g).samTarget) golan.declineSam(g);
    expect(unitsIn(g, a, 'israeli').every((u) => visibleTo(g, u, 'syrian'))).toBe(true);
  });
  it('16.12: no second Israeli air mission while Syria has not answered the first', () => {
    const g = newGolanGame(32);
    admin(g, 'israeli');
    g.turn = 3;
    give(g, 'IC03');
    give(g, 'IC16');
    golan.airRecon(g, 'IC03', 64);
    expect(S(g).samTarget).toBeDefined();
    expect(() => golan.airInterdiction(g, 'IC16', 73)).toThrow(/16\.12/);
  });
  it('8.23 / 15.6: a strongpoint defending alone may be reinforced by Special Action', () => {
    const g = newGolanGame(33);
    for (const u of unitsIn(g, 27)) if (u.id !== 'I30') u.area = null;
    for (const u of unitsIn(g, 26)) u.area = null;
    expect(unit(g, 'I30').area).toBe(27);
    unit(g, 'S01').area = 27;
    Object.assign(unit(g, 'I05'), { area: 26, disorder: 0, unsupplied: false });
    g.phase = 'combat';
    g.phasing = 'syrian';
    g.contestedAtMoveStart = [27];
    const b = startBattle(g, 27);
    expect(golan.reinforceOptions(g, b)).toContain('I05');
  });
  it('17.23: Lt. Zvika needs a supplied area', () => {
    const g = newGolanGame(34);
    admin(g, 'israeli');
    give(g, 'IC04');
    const a = [...Object.keys(g.control)].map(Number).find((x) => g.control[x] === 'israeli' && unitsIn(g, x).length === 0 && x < 100)!;
    const g2 = structuredClone(g);
    for (const u of g2.units) if (u.side === 'israeli') u.area = null;
    for (const k of Object.keys(g2.control)) if (Number(k) !== a) g2.control[Number(k)] = 'syrian';
    expect(() => golan.playLtZvika(g2, 'IC04', a)).toThrow(/supplied/);
  });
  it("9.31: a replacement reads the unit's supply status, not the live trace", () => {
    const g = newGolanGame(35);
    admin(g, 'israeli');
    give(g, 'IC19');
    const u = g.units.find((x) => x.side === 'israeli' && x.cls === 'armor' && x.area != null && !x.fort && x.max > 1)!;
    u.str = u.max - 1;
    u.unsupplied = true;
    expect(() => golan.playReplacement(g, 'IC19', u.id)).toThrow(/supplied/);
  });
  it('4.21: the alternate event use is Admin Phase only', () => {
    const g = newGolanGame(36);
    g.phase = 'combat';
    give(g, 'IC14');
    expect(() => golan.alternateEventUse(g, 'IC14', [])).toThrow();
  });
  it('17.22: Dugman 5 says so even with no SAM available', () => {
    const g = newGolanGame(37);
    admin(g, 'israeli');
    for (const c of g.chits) if (c.kind === 'sam' && c.box === 'available') c.box = 'cup';
    const n = g.log.length;
    golan.resolveDugman(g, chit(g, give(g, 'IC20')));
    expect(g.log.slice(n).join(' ')).toMatch(/no SAM/);
  });
  it('17.24: the Moroccans may not enter an Israeli-controlled area by any move', () => {
    const g = newGolanGame(38);
    S(g).kingHassan = true;
    const m = unit(g, 'S07');
    m.area = 59;
    const isr = Object.keys(g.control)
      .map(Number)
      .find((x) => g.control[x] === 'israeli' && x < 100)!;
    expect(golan.state(g).kingHassan).toBe(true);
    expect(CUR.moveOk!(g, m, isr)).toBe(false);
  });
  it("17.33 / 6.21: jamming waits for the Defender's Special Action choice, and closes it", () => {
    const g = newGolanGame(39);
    for (const u of unitsIn(g, 27)) if (u.id !== 'I30') u.area = null;
    for (const u of unitsIn(g, 26)) u.area = null;
    unit(g, 'S01').area = 27;
    Object.assign(unit(g, 'I05'), { area: 26, disorder: 0, unsupplied: false });
    g.phase = 'combat';
    g.phasing = 'syrian';
    g.contestedAtMoveStart = [27];
    give(g, 'IC14');
    const ew = give(g, 'SC16');
    const b = startBattle(g, 27);
    expect(b.defSA).toBe(true);
    expect(() => golan.playJamming(g, b, ew)).toThrow(/6\.21/);
    passSA(g, b);
    golan.playJamming(g, b, ew);
    expect(() => defenderReinforceSA(g, b, 'I05', 'IC14')).toThrow(/6\.21/);
  });
  it('16.11a (owner: the rulebook): a commando raid only in the Syrian Admin Phase', () => {
    const g = newGolanGame(41);
    g.turn = 3;
    g.phase = 'admin';
    g.phasing = 'israeli';
    g.done = ['israeli'];
    const c = g.chits.find((x) => x.kind === 'commando')!;
    c.box = 'available';
    const a = Object.keys(g.control)
      .map(Number)
      .find((x) => {
        try {
          const t = structuredClone(g);
          t.phasing = 'syrian';
          t.done = [];
          golan.placeRaid(t, c.id, x);
          return true;
        } catch {
          return false;
        }
      });
    expect(a).toBeDefined();
    expect(() => golan.placeRaid(g, c.id, a!)).toThrow(/16\.11a/);
  });
  it('15.6 (owner: the rulebook): a strongpoint is evacuated as soon as a regular unit leaves its contested area', () => {
    const g = newGolanGame(42);
    for (const u of unitsIn(g, 27)) if (u.id !== 'I30') u.area = null;
    for (const u of unitsIn(g, 26)) u.area = null;
    unit(g, 'S01').area = 27;
    for (const id of ['I05', 'I06']) Object.assign(unit(g, id), { area: 27, disorder: 0, unsupplied: false, moved: false, spent: 0 });
    g.control[26] = 'israeli';
    g.phase = 'movement';
    g.phasing = 'israeli';
    g.contestedAtMoveStart = [27];
    unit(g, 'I05').area = 26; // one of the two leaves
    golan.evacuateStrongpoint(g, 27);
    expect(unit(g, 'I30').box).toBe('evacuated');
  });
  it('16.12 (owner: the rulebook): the SAM reduction comes after the 4.1a recovery', () => {
    const g = newGolanGame(43);
    g.turn = 3;
    g.phasing = 'syrian';
    const sam = g.chits.find((x) => x.kind === 'sam')!;
    sam.box = 'used';
    for (const c of g.chits) if (c.kind === 'sa_block') c.box = 'available';
    g.force = [10, 10, 10, 10, 10, 10];
    reinforcementPhase(g);
    expect(g.recover).toContain('syrian');
    expect(sam.box).toBe('used'); // not rolled yet
    recoverAsset(g, 'syrian', sam.id); // the unused Special Action saves it
    expect(sam.box).toBe('available');
  });
  it('9.34d (owner: the rulebook): Countermeasures do not help unsupplied defending units', () => {
    const g = newGolanGame(44);
    for (const u of unitsIn(g, 27)) if (u.id !== 'I30') u.area = null;
    unit(g, 'S01').area = 27;
    Object.assign(unit(g, 'I05'), { area: 27, disorder: 0, unsupplied: true });
    g.phase = 'combat';
    g.phasing = 'syrian';
    g.contestedAtMoveStart = [27];
    const ew = give(g, 'SC16'),
      cm = give(g, 'IC36');
    const b = startBattle(g, 27);
    if (b.defSA) passSA(g, b);
    golan.playJamming(g, b, ew);
    g.force = [4, 4];
    golan.answerJamming(g, b, cm);
    expect(unit(g, 'I05').disorder).toBe(1); // 4 with no +2: disordered
    expect(unit(g, 'I30').disorder).toBe(0); // the supplied strongpoint: 4 + 2 = 6, holds
  });
  it('17.34 (owner: the rulebook): the Counterbattery player picks the enemy artillery asset', () => {
    const g = newGolanGame(45);
    for (const u of unitsIn(g, 27)) if (u.id !== 'I30') u.area = null;
    unit(g, 'S01').area = 27;
    g.phase = 'combat';
    g.phasing = 'syrian';
    g.contestedAtMoveStart = [27];
    const b = startBattle(g, 27);
    const arts = g.chits.filter((c) => c.side === 'syrian' && c.kind === 'artillery').slice(0, 2);
    for (const c of arts) c.box = 'map';
    b.assets.syrian.push(...arts.map((c) => c.id));
    golan.battleState(b).counterbattery.israeli = 'IC30';
    golan.setCounterbatteryTarget(g, b, 'israeli', arts[1].id);
    g.force = [3];
    golan.afterFire(g, b, 'syrian', 'arty');
    expect(arts[1].box).toBe('future');
    expect(arts[0].box).toBe('map');
  });
  it('19.1 (issue #6): the scoring list adds up to the score; Syrian areas need a Syrian unit; Nafakh has its own table', () => {
    const g = newGolanGame(46);
    const v = E.victory(g);
    expect(v.net).toBe(-6); // Badr starts at Israel +6 (errata)
    for (const s of ['syrian', 'israeli'] as const)
      expect(
        E.vpAreas(g, s)
          .filter((o) => o.ok)
          .reduce((t, o) => t + o.pts, 0),
      ).toBe(v[s]); // no big units destroyed yet
    const syr = E.vpAreas(g, 'syrian').find((o) => !E.unitsIn(g, o.id, 'syrian').length);
    if (syr) expect(syr.ok).toBe(false);
    expect(E.victoryTable(g).map((r) => r[1])).toContain('Israeli Operational Victory');
    E.useGame('golan73');
    const n = E.newGame(1, { scenario: 'nafakh' } as never);
    expect(E.victoryTable(n).map((r) => r[1])).toEqual(['Decisive Victory', 'Marginal Victory']);
    expect(E.vpAreas(n, 'israeli')).toEqual([]);
  });
});
