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
  it('14.51 (owner: the rulebook): a port may be damaged while its area is contested', () => {
    const g = newSicilyGame(21);
    clear(g, 57);
    unit(g, 'IT05').area = 57;
    unit(g, 'US03').area = 57;
    g.control[57] = 'axis';
    g.phase = 'admin';
    g.phasing = 'axis';
    g.done = [];
    E.chit(g, 'ITC06').box = 'available';
    expect(E.contested(g, 57)).toBe(true);
    S.portWork(g, 'ITC06', 'P3');
    expect(S.state(g).portDamage.P3).toBeGreaterThan(0);
  });
  it('16.33 (owner: the rulebook): both sides may interdict the same area, and each slows only the enemy', () => {
    const g = newSicilyGame(22);
    g.phase = 'admin';
    g.phasing = 'allied';
    g.done = [];
    S.airInterdiction(g, air(g, 'allied'), 21);
    g.done = ['allied'];
    S.airInterdiction(g, air(g, 'axis'), 21);
    expect(g.chits.filter((c) => c.mission === 'interdiction' && c.area === 21).length).toBe(2);
  });
  it('16.34 (owner: the rulebook): several Air Supply missions, one area each', () => {
    const g = newSicilyGame(23);
    for (const [id, a] of [
      ['US03', 30],
      ['US04', 28],
    ] as const) {
      clear(g, a);
      Object.assign(unit(g, id), { area: a, unsupplied: true, disorder: 0 });
      g.control[a] = 'allied';
    }
    g.phase = 'supply';
    g.phasing = 'allied';
    S.airSupply(g, air(g, 'allied'), 30);
    S.airSupply(g, air(g, 'allied', 1), 28);
    expect(E.airSup(g).length).toBe(2);
    S.dogfightAirSupply(g, air(g, 'axis'), 28);
    expect(E.airSup(g).map((m) => m.area)).toEqual([30]);
  });
  it('6.22 (owner: the rulebook): with US and British units together air support fires only as artillery', () => {
    const g = newSicilyGame(24);
    clear(g, 19);
    clear(g, 20);
    unit(g, 'US03').area = 19;
    unit(g, 'BR03').area = 19;
    unit(g, 'IT05').area = 19;
    unit(g, 'IT05').untried = false;
    g.control[19] = 'axis';
    g.phase = 'combat';
    g.phasing = 'allied';
    g.contestedAtMoveStart = [19];
    g.fought = [];
    const b = E.startBattle(g, 19);
    if (b.defSA) E.passSA(g, b);
    const id = air(g, 'allied');
    expect(E.canAssign(g, b, 'allied', E.chit(g, id), 'support')).toMatch(/6\.22/);
    expect(E.canAssign(g, b, 'allied', E.chit(g, id), 'arty')).toBeNull();
  });
  it('14.61: any unreleased division may be released, wherever its blocks are; a single-use Special Action only for its own army', () => {
    const g = newSicilyGame(25);
    g.phase = 'admin';
    g.phasing = 'allied';
    g.done = [];
    const div = g.units.find((u) => u.side === 'allied' && u.division === 'us_1st_inf')!.division!;
    for (const u of g.units) if (u.division === div) u.area = null; // none on the map
    const br = g.chits.find((c) => c.kind === 'special_action_event' && c.side === 'allied' && c.ech === 'br_8th_army')!;
    br.box = 'available';
    expect(() => S.releaseDivision(g, div, br.id)).toThrow(/own army/);
    for (const c of g.chits) if (c.kind === 'sa_block' && c.side === 'allied') c.box = 'available';
    S.releaseDivision(g, div);
    expect(S.state(g).released).toContain(div);
  });
  it('6.6: with every adjoining friendly area full the defender retreats past them, and the choice can be made (owner report, 14 Nov)', () => {
    const g = newSicilyGame(3);
    Object.assign(g, { turn: 3, phase: 'combat', phasing: 'axis', fought: [], battle: null });
    for (const u of g.units) if (u.area != null && !S.isBox(u.area) && !u.garrison) u.area = null;
    for (const a of E.areas.keys()) if (!S.isBox(a)) g.control[a] = 'allied';
    const brit = g.units.filter((u) => u.id.startsWith('BR') && !u.garrison && u.id !== 'BR07');
    let k = 0;
    for (const n of E.neighbors(13).filter((x) => !S.isBox(x)))
      for (let j = 0; j < 2; j++) Object.assign(brit[k++], { area: n, str: 2, box: undefined, untried: false });
    Object.assign(unit(g, 'BR07'), { area: 13, str: 2, disorder: 0, untried: false, box: undefined });
    for (const id of ['GE02', 'GE03']) Object.assign(unit(g, id), { area: 13, str: 3, disorder: 0, box: undefined });
    g.contestedAtMoveStart = [13];
    const b = E.startBattle(g, 13);
    if (b.defSA) E.passSA(g, b);
    E.setReady(g, b, 'axis');
    E.setReady(g, b, 'allied');
    g.force = [10, 10, 10, 10, 10, 10, 1, 1, 9, 9, 9, 9, 9, 9];
    E.beginCombat(g, b);
    for (let i = 0; i < 30 && b.stage !== 'defChoice'; i++) E.roll_step(g, b);
    expect(E.retreatBlocked(g, b)).toEqual([]); // it can retreat, though not next door
    E.defenderChoice(g, b, true);
    expect(b.stage).toBe('retreat');
    const opts = E.retreatOptions(g, b);
    expect(opts.length).toBeGreaterThan(1);
    expect(opts.every((a) => !E.neighbors(13).includes(a))).toBe(true); // all two areas away
    const paths = E.retreatPaths(g, 13, 'allied', unit(g, 'BR07'));
    for (const o of opts) {
      const way = paths.get(o)!;
      expect(way.length).toBe(paths.get(opts[0])!.length); // ties for nearest are all offered
      for (const mid of way.slice(1, -1)) {
        expect(g.control[mid]).toBe('allied'); // only through friendly, uncontested (full) areas
        expect(E.unitsIn(g, mid, 'axis').length).toBe(0);
      }
    }
    const via = paths.get(opts[0])![1];
    const g2 = structuredClone(g);
    Object.assign(g2.units.find((u) => u.id === 'GE03')!, { area: via }); // that full area becomes contested: no way through it
    expect(
      [
        ...E.retreatPaths(
          g2,
          13,
          'allied',
          g2.units.find((u) => u.id === 'BR07'),
        ).values(),
      ].every((w) => !w.includes(via)),
    ).toBe(true);
    E.chooseRetreat(g, b, opts[0]);
    expect(unit(g, 'BR07').area).toBe(opts[0]);
    expect(b.stage).toBe('done');
  });
  it('6.6: retreatBlocked names the defenders with nowhere to go (they would lose a step instead)', () => {
    const g = newSicilyGame(3);
    Object.assign(g, { turn: 3, phase: 'combat', phasing: 'axis', fought: [], battle: null });
    for (const u of g.units) if (u.area != null && !S.isBox(u.area) && !u.garrison) u.area = null;
    for (const n of E.neighbors(14)) if (!S.isBox(n)) g.control[n] = 'axis';
    Object.assign(unit(g, 'BR07'), { area: 14, str: 2, disorder: 0, untried: false, box: undefined });
    Object.assign(unit(g, 'GE02'), { area: 14, str: 3, disorder: 0, box: undefined });
    g.control[14] = 'allied';
    g.contestedAtMoveStart = [14];
    for (const lb of S.landingBoxes) if (lb.area === 14) delete S.state(g).beachheads[lb.id];
    const b = E.startBattle(g, 14);
    expect(E.retreatBlocked(g, b).map((u) => u.id)).toEqual(['BR07']);
  });
  it('15.3d: an untried unit that survives the round that revealed it becomes tried, even after retreating out (owner report, 14 Nov)', () => {
    const g = newSicilyGame(31);
    Object.assign(g, { turn: 3, phase: 'combat', phasing: 'allied', fought: [], battle: null });
    const it = g.units.find((u) => u.untried && u.side === 'axis' && u.area != null)!;
    const a = it.area!;
    for (const u of g.units) if (u.area === a && u.id !== it.id) u.area = null;
    const out = E.neighbors(a).find((n) => !S.isBox(n))!;
    for (const u of g.units) if (u.area === out) u.area = null;
    g.control[out] = 'axis';
    Object.assign(it, { str: Math.max(2, it.str), disorder: 0 });
    Object.assign(unit(g, 'US03'), { area: a, str: 3, disorder: 0, box: undefined });
    g.contestedAtMoveStart = [a];
    const b = E.startBattle(g, a);
    if (b.defSA) E.passSA(g, b);
    E.setReady(g, b, 'allied');
    E.setReady(g, b, 'axis');
    g.force = [1, 10, 10, 10, 10, 10, 10, 10, 10];
    E.beginCombat(g, b); // revealed: its untried check passes
    expect(it.untried).toBe(true);
    it.area = out; // as after a retreat out of the battle
    for (let i = 0; i < 40 && b.stage !== 'done'; i++) {
      if (b.stage === 'defChoice') E.defenderChoice(g, b, true);
      else if (b.stage === 'retreat') E.chooseRetreat(g, b, E.retreatOptions(g, b)[0]);
      else if (b.stage === 'attChoice') E.attackerChoice(g, b, false);
      else if (b.stage === 'attFirst') E.chooseFirstLoss(g, b, b.attPoint);
      else if (b.stage === 'loss') E.chooseLoss(g, b, E.lossOptions(g, b)[0]);
      else E.roll_step(g, b);
    }
    E.closeBattle(g);
    expect(it.area).toBe(out);
    expect(it.untried).toBe(false); // tried now, shown face up like any Italian block
  });
  it('6.2 / 17.21e: an Italian attack ends when the morale checks at the reveal disorder every attacker, and says why', () => {
    const g = newSicilyGame(32);
    Object.assign(g, { turn: 4, phase: 'combat', phasing: 'axis', fought: [], battle: null });
    S.state(g).morale = 2; // level 2: every tried Italian unit in the combat is disordered
    clear(g, 19);
    Object.assign(unit(g, 'IT05'), { area: 19, str: 3, disorder: 0, untried: false });
    Object.assign(unit(g, 'US03'), { area: 19, str: 3, disorder: 0, box: undefined });
    g.control[19] = 'allied';
    g.contestedAtMoveStart = [19];
    const b = E.startBattle(g, 19);
    if (b.defSA) E.passSA(g, b);
    E.setReady(g, b, 'axis');
    E.setReady(g, b, 'allied');
    E.beginCombat(g, b);
    expect(unit(g, 'IT05').disorder).toBe(1);
    expect(b.stage).toBe('done');
    expect(b.result).toMatch(/Italian morale checks at the reveal disordered every attacker/);
  });
  it('22.17 Sunrise Bridge (owner issue #6): each side scores the areas it controls by the scenario values; the table lists them', () => {
    E.useGame('sicily');
    const g = E.newGame(1, { scenario: 'sunrise_bridge' } as never);
    const v0 = E.victory(g);
    expect(v0.axis).toBe(20); // all 13 scoring areas start Axis-controlled (22.13)
    expect(v0.allied).toBe(0);
    expect(E.vpAreas(g, 'axis').reduce((t, o) => t + o.pts, 0)).toBe(20);
    g.control[26] = 'allied';
    g.control[25] = 'allied';
    g.control[16] = 'allied';
    const v1 = E.victory(g);
    expect([v1.allied, v1.axis, v1.net]).toEqual([9, 11, -2]); // Catania 4 + 25: 3 + 16: 2
    expect(
      E.vpAreas(g, 'allied')
        .map((o) => o.id)
        .sort(),
    ).toEqual([16, 25, 26]);
    expect(E.victoryTable(g).map((r) => r[1])).toEqual(['Allied Victory', 'Draw', 'Axis Victory']);
    expect(E.vpNote(g)).toMatch(/22\.17/);
  });
  it('22.28 / 22.38: the Tournament and Campaign victory tables', () => {
    E.useGame('sicily');
    const t = E.newGame(1, { scenario: 'tournament' } as never);
    expect(E.victoryTable(t)).toContainEqual(['4+ Axis VP', 'Axis Victory']);
    expect(E.victoryTable(t)).toContainEqual(['0–3 Axis VP', 'Allied Victory']);
    const c = E.newGame(1, { scenario: 'campaign' } as never);
    expect(E.victoryTable(c).map((r) => r[1])).toEqual([
      'Allied Operational Victory',
      'Allied Marginal Victory',
      'Draw',
      'Axis Marginal Victory',
      'Axis Operational Victory',
    ]);
  });
});
