// Golan '73: the asset and event sweep of November 2026 (one test per fix).
import { describe, expect, it } from 'vitest';
import { startBattle, unitsIn, visibleTo, golan, type Game } from '../src';
import { CUR } from '../src/volumes';
import { newGolanGame, unit, chit, give } from './golan-helpers';

const S = (g: Game) => golan.state(g);
const syrAir = (g: Game) => g.chits.find((c) => c.kind === 'air_mission' && c.side === 'syrian')!.id;
const admin = (g: Game, side: 'israeli' | 'syrian') => { g.phase = 'admin'; g.phasing = side; S(g).samTarget = undefined; };

describe('Golan asset and event sweep', () => {
  it('16.31c: Syrian reconnaissance may fly over strongpoints only, and shows them', () => {
    const g = newGolanGame(31); admin(g, 'syrian'); g.turn = 3;
    const a = [...new Set(g.units.filter((u) => u.side === 'israeli' && u.fort && u.area != null).map((u) => u.area!))].find((x) => unitsIn(g, x, 'israeli').every((u) => u.fort))!;
    expect(a).toBeDefined(); const id = give(g, syrAir(g));
    golan.airRecon(g, id, a); if (S(g).samTarget) golan.declineSam(g);
    expect(unitsIn(g, a, 'israeli').every((u) => visibleTo(g, u, 'syrian'))).toBe(true);
  });
  it('16.12: no second Israeli air mission while Syria has not answered the first', () => {
    const g = newGolanGame(32); admin(g, 'israeli'); g.turn = 3; give(g, 'IC03'); give(g, 'IC16');
    golan.airRecon(g, 'IC03', 64); expect(S(g).samTarget).toBeDefined();
    expect(() => golan.airInterdiction(g, 'IC16', 73)).toThrow(/16\.12/);
  });
  it('8.23 / 15.6: a strongpoint defending alone may be reinforced by Special Action', () => {
    const g = newGolanGame(33); for (const u of unitsIn(g, 27)) if (u.id !== 'I30') u.area = null; for (const u of unitsIn(g, 26)) u.area = null;
    expect(unit(g, 'I30').area).toBe(27); unit(g, 'S01').area = 27; Object.assign(unit(g, 'I05'), { area: 26, disorder: 0, unsupplied: false });
    g.phase = 'combat'; g.phasing = 'syrian'; g.contestedAtMoveStart = [27];
    const b = startBattle(g, 27); expect(golan.reinforceOptions(g, b)).toContain('I05');
  });
  it('17.23: Lt. Zvika needs a supplied area', () => {
    const g = newGolanGame(34); admin(g, 'israeli'); give(g, 'IC04');
    const a = [...Object.keys(g.control)].map(Number).find((x) => g.control[x] === 'israeli' && unitsIn(g, x).length === 0 && x < 100)!;
    const g2 = structuredClone(g); for (const u of g2.units) if (u.side === 'israeli') u.area = null; for (const k of Object.keys(g2.control)) if (Number(k) !== a) g2.control[Number(k)] = 'syrian';
    expect(() => golan.playLtZvika(g2, 'IC04', a)).toThrow(/supplied/);
  });
  it('9.31: a replacement reads the unit\'s supply status, not the live trace', () => {
    const g = newGolanGame(35); admin(g, 'israeli'); give(g, 'IC19');
    const u = g.units.find((x) => x.side === 'israeli' && x.cls === 'armor' && x.area != null && !x.fort && x.max > 1)!; u.str = u.max - 1; u.unsupplied = true;
    expect(() => golan.playReplacement(g, 'IC19', u.id)).toThrow(/supplied/);
  });
  it('4.21: the alternate event use is Admin Phase only', () => {
    const g = newGolanGame(36); g.phase = 'combat'; give(g, 'IC14');
    expect(() => golan.alternateEventUse(g, 'IC14', [])).toThrow();
  });
  it('17.22: Dugman 5 says so even with no SAM available', () => {
    const g = newGolanGame(37); admin(g, 'israeli'); for (const c of g.chits) if (c.kind === 'sam' && c.box === 'available') c.box = 'cup';
    const n = g.log.length; golan.resolveDugman(g, chit(g, give(g, 'IC20'))); expect(g.log.slice(n).join(' ')).toMatch(/no SAM/);
  });
  it('17.24: the Moroccans may not enter an Israeli-controlled area by any move', () => {
    const g = newGolanGame(38); S(g).kingHassan = true; const m = unit(g, 'S07'); m.area = 59;
    const isr = Object.keys(g.control).map(Number).find((x) => g.control[x] === 'israeli' && x < 100)!;
    expect(golan.state(g).kingHassan).toBe(true);
    expect(CUR.moveOk!(g, m, isr)).toBe(false);
  });
});
