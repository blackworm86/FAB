// Sicily: the asset and event sweep of November 2026 (one test per fix).
import { describe, expect, it } from 'vitest';
import * as E from '../src';
import { newSicilyGame, unit } from './sicily-helpers';

const S = E.sicily;
const clear = (g: E.Game, a: number) => {
  for (const u of g.units) if (u.area === a && !u.garrison) u.area = null;
};
const rct = (g: E.Game) => g.chits.find((x) => x.flank && x.flank !== 'once' && x.side === 'allied')!;
const air = (g: E.Game, side: 'allied' | 'axis', n = 0) => {
  const c = g.chits.filter((x) => x.side === side && x.kind === 'air_mission')[n];
  c.box = 'available';
  return c.id;
};
/** The 30 RCT lands in Gela [19] on an Italian unit, US03 in Licata [20] (the report's set-up). */
function landing(seed: number) {
  const g = newSicilyGame(seed);
  g.turn = 2;
  g.phase = 'admin';
  g.phasing = 'allied';
  g.fought = [];
  clear(g, 19);
  clear(g, 20);
  unit(g, 'US03').area = 20;
  g.control[20] = 'allied';
  g.control[19] = 'axis';
  const it = unit(g, 'IT05');
  it.area = 19;
  it.untried = false;
  const c = rct(g);
  c.box = 'available';
  return { g, c };
}

describe('Sicily asset and event sweep', () => {
  it('17.22: a flanking invasion on defenders really fights its round', () => {
    const { g, c } = landing(1);
    expect(S.flankTargets(g, c.id)).toContain(19);
    S.playFlanking(g, c.id, 19);
    const b = E.startBattle(g, 19);
    E.beginCombat(g, b);
    expect(b.result).not.toBe('Attacker eliminated');
    expect(b.stage).not.toBe('done');
  });
  it('16.34 / 16.31: a dogfight undoes the Air Supply recovery, keeps the marker, and no new mission replaces it', () => {
    const g = newSicilyGame(2);
    const u = unit(g, 'US03');
    clear(g, 30);
    u.area = 30;
    u.disorder = 1;
    g.control[30] = 'allied';
    g.phase = 'btCombat';
    g.phasing = 'allied';
    g.contestedAtMoveStart = [];
    E.endPhase(g);
    expect(u.unsupplied).toBe(true);
    S.airSupply(g, air(g, 'allied'), 30);
    expect(u.disorder).toBe(2);
    S.dogfightAirSupply(g, air(g, 'axis'));
    expect(u.disorder).toBe(1);
    expect(u.unsupplied).toBe(true);
    expect(() => S.airSupply(g, air(g, 'allied', 1), 30)).toThrow(/16\.31/);
  });
  it('16.34 / 9.35: Air Supply flown by the non-phasing player lets its units recover', () => {
    const g = newSicilyGame(3);
    const u = unit(g, 'US03');
    clear(g, 30);
    u.area = 30;
    u.disorder = 1;
    u.unsupplied = true;
    g.control[30] = 'allied';
    g.phase = 'supply';
    g.phasing = 'axis';
    S.airSupply(g, air(g, 'allied'), 30);
    expect(u.disorder).toBe(2);
  });
  it('16.31: a dogfighted interdiction is not replaced over the same area', () => {
    const g = newSicilyGame(4);
    g.phase = 'admin';
    g.phasing = 'allied';
    S.airInterdiction(g, air(g, 'allied'), 21);
    g.done = ['allied']; // 4.2c: the Axis answers in its part of the Admin Phase
    S.dogfightInterdiction(g, air(g, 'axis'), 21);
    g.done = [];
    expect(() => S.airInterdiction(g, air(g, 'allied', 1), 21)).toThrow(/16\.31/);
  });
  it("17.21c: a second Fading Italian Morale waits for the first one's picks", () => {
    const g = newSicilyGame(5);
    g.phase = 'admin';
    g.phasing = 'allied';
    const fm = g.chits.filter((x) => x.kind === 'event_fading_morale');
    for (const c of g.chits) if (c.side === 'axis' && c.nation === 'italian' && (E.isArty(c) || E.isBattleAsset(c))) c.box = 'available';
    fm[0].box = 'available';
    fm[1].box = 'available';
    S.playFadingMorale(g, fm[0].id);
    expect(() => S.playFadingMorale(g, fm[1].id)).toThrow(/17\.21c/);
  });
  it("17.22: an airborne drop into the flanking asset's area relieves it", () => {
    const { g, c } = landing(6);
    clear(g, 19);
    S.playFlanking(g, c.id, 19);
    expect(c.box).toBe('map');
    const n2 = E.neighbors(19).find((a) => a !== 20 && a < 100 && !S.isBox(a))!;
    clear(g, n2);
    unit(g, 'US04').area = n2;
    g.control[n2] = 'allied';
    const para = g.units.find(
      (u) =>
        u.side === 'allied' &&
        u.area == null &&
        u.str > 0 &&
        !u.garrison &&
        (u.ech ?? '').startsWith('us') &&
        u.cls !== 'armor' &&
        u.id !== 'US03' &&
        u.id !== 'US04',
    )!;
    Object.assign(para, { box: 'airborne_assault', area: null });
    g.phase = 'combat';
    expect(S.airDropTargets(g, para.id)).toContain(19);
    S.airDrop(g, para.id, 19);
    expect(c.box).not.toBe('map');
  });
  it('14.61: a British brigade is released only with a division', () => {
    const g = newSicilyGame(7);
    g.phase = 'admin';
    g.phasing = 'allied';
    expect(() => S.releaseDivision(g, 'br_4th_arm')).toThrow(/14\.61/);
  });
  it('4.34 / 4.35: roadblocks work in Sicily, and a defended roadblock takes one artillery asset only', () => {
    const g = newSicilyGame(8);
    clear(g, 7);
    g.control[7] = 'axis';
    g.roadblocks[7] = 'axis';
    const n = E.neighbors(7).find((a) => a < 100 && !S.isBox(a))!;
    clear(g, n);
    g.control[n] = 'allied';
    const u = unit(g, 'US03');
    Object.assign(u, { area: n, moved: false, spent: 0, disorder: 0 });
    g.phase = 'movement';
    g.phasing = 'allied';
    g.contestedAtMoveStart = [];
    const o = E.moveOptions(g, u.id).find((x) => x.area === 7);
    expect(o?.mustStop).toBe(true);
    expect(E.moveOptions(g, u.id).some((x) => x.path.length > 2 && x.path.includes(7))).toBe(false);
  });
  it('17.22(iii): naval support may help a flanking invasion that traces no supply', () => {
    const { g, c } = landing(9);
    clear(g, 42);
    const it = unit(g, 'IT06');
    it.area = 42;
    it.untried = false;
    g.control[42] = 'axis';
    expect(S.flankTargets(g, c.id)).toContain(42);
    S.playFlanking(g, c.id, 42);
    expect(E.inSupply(g, 'allied', 42)).toBe(false);
    const b = E.startBattle(g, 42);
    if (b.defSA) E.passSA(g, b);
    const nav = g.chits.find((x) => x.kind === 'naval_support' && x.side === 'allied')!;
    nav.box = 'available';
    expect(E.canAssign(g, b, 'allied', nav) ?? '').not.toMatch(/9\.34a/);
  });
});
