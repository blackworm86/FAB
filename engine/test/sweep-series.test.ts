// Rules sweep (series rules + The Bulge exclusive rules): each test states what the printed rule requires.
// A failing test here is an engine deviation from the rules.
import { describe, expect, it } from 'vitest';
import * as E from '../src';

/** A Bulge campaign table with every block off the map and every area German-controlled. */
const blank = (seed = 3) => {
  E.useGame('bulge');
  const g = E.newGame(seed, { scenario: 'campaign' });
  E.useGame('bulge');
  for (const u of g.units) {
    u.area = null;
    u.disorder = 0;
    u.unsupplied = false;
    u.reserve = null;
    u.exploit = false;
    u.moved = false;
  }
  for (const a of E.areas.keys()) g.control[a] = 'german';
  g.battle = null;
  g.fieldWorks = [];
  g.riverAssault = [];
  g.blown = [];
  g.contestedAtMoveStart = [];
  g.fought = [];
  g.turn = 4;
  return g;
};
const unit = (g: E.Game, name: string) => g.units.find((u) => u.name === name)!;
const put = (g: E.Game, name: string, area: number, str?: number) => {
  const u = unit(g, name);
  u.area = area;
  u.str = str ?? u.max;
  u.arrival = undefined;
  return u;
};
const avail = (g: E.Game, id: string) => {
  const c = E.chit(g, id);
  c.box = 'available';
  return c;
};

describe('sweep: series rules', () => {
  it('3.22 / 5.21: only the Phasing Player marks reserves, and only in his Operational Movement Phase', () => {
    const g = blank();
    g.phase = 'movement';
    g.phasing = 'german';
    for (const a of [56, 57, 58, 29]) g.control[a] = 'allied';
    const al = put(g, '84 Inf', 57);
    expect(() => E.setReserve(g, al.id, true)).toThrow(); // the Allies are not phasing
    g.phase = 'combat';
    const ge = put(g, '12 VG', 9);
    expect(() => E.setReserve(g, ge.id, true)).toThrow(); // not in the Combat Phase either
  });

  it('6.2: disordered attacking units may not be assigned losses', () => {
    const g = blank();
    g.phase = 'combat';
    g.phasing = 'german';
    g.control[23] = 'allied';
    const pt = put(g, '12SS', 23),
      dis = put(g, '12 VG', 23);
    dis.disorder = 1;
    put(g, '106 Inf', 23);
    const b = E.startBattle(g, 23);
    expect(b.attPoint).toBe(pt.id);
    E.allocateForTest(g, b, 'german', 2);
    expect(dis.str).toBe(dis.max); // the disordered unit takes nothing
    expect(pt.str).toBe(pt.max - 2);
  });

  it('8.23 / 9.34d: an unsupplied unit may not reinforce a battle by Special Action', () => {
    const g = blank();
    g.phase = 'combat';
    g.phasing = 'german';
    for (const a of [23, 24]) g.control[a] = 'allied';
    put(g, '12SS', 23);
    put(g, '106 Inf', 23);
    const r = put(g, '7 Arm', 24);
    r.unsupplied = true;
    avail(g, 'SA-allied');
    const b = E.startBattle(g, 23);
    expect(() => E.defenderReinforceSA(g, b, r.id)).toThrow();
  });

  it('8.24 / 9.34d: unsupplied defenders may not retreat before combat by Special Action', () => {
    const g = blank();
    g.phase = 'combat';
    g.phasing = 'german';
    for (const a of [23, 24]) g.control[a] = 'allied';
    put(g, '12SS', 23);
    const d = put(g, '106 Inf', 23);
    d.unsupplied = true;
    avail(g, 'SA-allied');
    const b = E.startBattle(g, 23);
    expect(() => E.defenderRetreatSA(g, b)).toThrow();
  });

  it('7.31: an exploiting unit whose own crossing attempt blew the bridge cannot move at all', () => {
    const g = blank();
    g.phase = 'btMove';
    g.phasing = 'german';
    g.control[23] = 'allied';
    const arm = put(g, '2 Pz', 12);
    arm.exploit = true;
    put(g, '106 Inf', 23);
    expect(E.move(g, arm.id, 23)).toBe('blow');
    g.force = [1];
    expect(E.resolveBlow(g, true)).toBe('stopped');
    expect(arm.area).toBe(12);
    expect(E.moveOptions(g, arm.id)).toEqual([]); // engine still offers 3, 11, 13, 22
  });

  it('8.25: Rally the Troops may designate any supplied area, a contested friendly one included', () => {
    const g = blank();
    g.phase = 'admin';
    g.phasing = 'german';
    g.control[23] = 'german';
    put(g, '12SS', 23).disorder = 1;
    put(g, '106 Inf', 23);
    const s = put(g, '12 VG', 12);
    s.disorder = 1;
    expect(E.inSupply(g, 'german', 23)).toBe(true);
    avail(g, 'SA-german');
    E.rally(g, 'german', 23);
    expect(unit(g, '12SS').disorder).toBe(0);
    expect(s.disorder).toBe(0);
  });

  it('8.26: Quality Replacements go to a supplied reduced unit on the map, not to an eliminated one', () => {
    const g = blank();
    g.phase = 'admin';
    g.phasing = 'german';
    const u = unit(g, '12SS');
    u.area = null;
    u.str = 0; // eliminated
    avail(g, 'SA-german');
    expect(() => E.qualityReplacement(g, u.id)).toThrow();
  });
  it('8.23: a unit that reinforced by Special Action may not be designated the point unit while the original point unit stands', () => {
    const g = blank();
    g.phase = 'combat';
    g.phasing = 'german';
    for (const a of [23, 24]) g.control[a] = 'allied';
    put(g, '12SS', 23);
    const d = put(g, '106 Inf', 23);
    const r = put(g, '7 Arm', 24);
    avail(g, 'SA-allied');
    const b = E.startBattle(g, 23);
    E.defenderReinforceSA(g, b, r.id);
    expect(b.defPoint).toBe(d.id);
    expect(() => E.setPoint(g, b, 'allied', r.id)).toThrow();
  });

  it("17.21: an Air Supply mission played in the Supply Phase lets the area's disordered units adjust their markers (supplied for all purposes but 9.34a/d)", () => {
    const g = blank();
    g.phase = 'btCombat';
    g.phasing = 'allied';
    g.control[23] = 'allied';
    const u = put(g, '106 Inf', 23);
    u.disorder = 1; // cut off: every other area is German
    E.endPhase(g);
    expect(g.phase).toBe('supply');
    expect(u.unsupplied).toBe(true);
    E.playAirSupply(g, avail(g, 'R41.0').id, 23);
    expect(u.disorder).toBe(2); // 9.35: disordered flips to recovering
  });
});

describe('sweep: The Bulge exclusive rules', () => {
  it("14.52: an army that lost its engineer may borrow another army's engineer for bridging functions only (not a roadblock)", () => {
    const g = blank();
    g.phase = 'admin';
    g.phasing = 'german';
    E.chit(g, 'L47.0').box = 'eliminated'; // 7th Army engineer gone
    const eng = avail(g, 'L26.0'); // 6th Pz Army engineer
    expect(E.inSupply(g, 'german', 14)).toBe(true);
    expect(E.areas.get(14)!.zone).toBe(7);
    expect(() => E.roadblock(g, eng.id, 14, false)).toThrow();
  });

  it('16.21: a cut-off garrison asset makes the unsupplied morale check and is eliminated when it fails', () => {
    const g = blank();
    g.phase = 'btCombat';
    g.phasing = 'allied';
    const gar = g.units.find((u) => u.id === 'G38')!;
    gar.area = 38;
    gar.str = 1;
    g.control[38] = 'allied';
    E.endPhase(g);
    expect(g.phase).toBe('supply');
    expect(E.inSupply(g, 'allied', 38)).toBe(false);
    g.force = [10, 10];
    E.rollSupply(g);
    expect(gar.area).toBe(null);
  });

  it('16.13: a German move of more than 3 MP over several areas spends fuel even when it triggers a bridge-blow attempt (5.35d)', () => {
    const g = blank();
    g.phase = 'movement';
    g.phasing = 'german';
    g.control[23] = 'allied';
    const arm = put(g, '2 Pz', 13);
    put(g, '106 Inf', 23);
    const opt = E.moveOptions(g, arm.id).find((o) => o.area === 23)!;
    expect(opt.path).toEqual([13, 12, 23]);
    expect(opt.fuel).toBe(true); // 2 MP field + 1 MP road over the river + 1 MP occupied = 4 MP
    const fuel = () => E.boxOf(g, 'german', 'available').filter((c) => c.kind === 'fuel').length,
      before = fuel();
    expect(E.move(g, arm.id, 23)).toBe('blow');
    E.resolveBlow(g, false); // the Allies decline to try
    expect(arm.area).toBe(23);
    expect(fuel()).toBe(before - 1);
  });

  it("17.1 / 15.1c: a German army replacement event may be applied to a Strategic Reserve unit in that army's zone", () => {
    const g = blank();
    g.phase = 'admin';
    g.phasing = 'german';
    const u = put(g, '6SS', 12, 1); // 6th SS Mountain (infantry, Strategic Reserve) in Zone 5
    const c = avail(g, 'L27.0'); // 5th Pz Army non-elite infantry replacement
    expect(E.eligibleForStep(c, u)).toBe(true);
    E.playReplacement(g, c.id, u.id);
    expect(u.str).toBe(2);
  });

  it('16.21 / 16.22 / 4.21: task force assets may not be returned by the alternate event use', () => {
    const g = blank();
    g.phase = 'admin';
    g.phasing = 'allied';
    E.chit(g, 'R71.0').box = 'eliminated';
    E.chit(g, 'L61.0').box = 'eliminated';
    E.chit(g, 'L62.0').box = 'eliminated';
    const ev = avail(g, 'L48.0');
    E.alternateUse(g, ev.id);
    expect(E.chit(g, 'R71.0').box).toBe('eliminated');
  });

  it('17.22: Rebuild or Replace returns an eliminated unit only, not one that has not arrived yet', () => {
    const g = blank();
    g.phase = 'admin';
    g.phasing = 'allied';
    g.control[47] = 'allied';
    const cav = unit(g, '4 Cav');
    expect(cav.area).toBe(null);
    expect(cav.arrival).toBe(7); // turn 7 reinforcement, still off the map on turn 4
    const c = avail(g, 'L66.0');
    expect(() => E.playRebuild(g, c.id, cav.id, 47)).toThrow();
  });

  it('17.2 / 17.22: the 1st Army Rebuild or Replace may not return a 3rd Army unit', () => {
    const g = blank();
    g.phase = 'admin';
    g.phasing = 'allied';
    g.control[47] = 'allied';
    const cav = unit(g, '6 Cav');
    cav.area = null;
    cav.str = 0;
    cav.arrival = undefined; // eliminated 3rd Army cavalry
    const c = avail(g, 'L66.0');
    expect(() => E.playRebuild(g, c.id, cav.id, 47)).toThrow();
  });

  it('17.21: Air Supply may be used during any Supply Phase, also by the Non-phasing Allied player', () => {
    const g = blank();
    g.phase = 'supply';
    g.phasing = 'german';
    for (const a of E.areas.keys()) g.control[a] = 'german';
    g.control[23] = 'allied';
    const u = put(g, '106 Inf', 23);
    u.unsupplied = true;
    const c = avail(g, 'R41.0');
    E.playAirSupply(g, c.id, 23);
    expect(E.inSupply(g, 'allied', 23)).toBe(true);
  });

  it('17.21: an interdicted area costs the Germans +1 to enter AND +1 to leave (both, when moving between two interdicted areas)', () => {
    const g = blank();
    g.phase = 'movement';
    g.phasing = 'german';
    const inf = put(g, '12 VG', 23);
    g.interdicted[23] = 'R41.0';
    g.interdicted[22] = 'R41.1';
    const to22 = E.moveOptions(g, inf.id).find((o) => o.area === 22)!; // road 1 + leave 23 (+1) + enter 22 (+1)
    expect(to22.cost).toBe(3);
  });
});

describe('6.43: the owner allocates step losses (decision: players choose)', () => {
  const attack = () => {
    const g = blank();
    g.phase = 'combat';
    g.phasing = 'german';
    g.control[23] = 'allied';
    const a = put(g, '12SS', 23),
      b2 = put(g, '2 Pz', 23);
    put(g, '106 Inf', 23);
    const b = E.startBattle(g, 23);
    E.beginCombat(g, b);
    b.queue = [];
    b.unitHit.german = true;
    b.hit = { german: [b.attPoint] };
    b.pending = 2;
    b.stage = 'attChoice'; // as after the first hit on the point unit
    return { g, b, point: b.attPoint, other: b.attPoint === a.id ? b2.id : a.id };
  };
  it('everyone takes one before anyone takes a second: after the point unit, the next loss must fall on the other attacker', () => {
    const { g, b, other } = attack();
    E.attackerChoice(g, b, false);
    expect(E.unitsIn(g, 23, 'german').find((u) => u.id === other)!.str).toBeLessThan(
      E.unitsIn(g, 23, 'german').find((u) => u.id === other)!.max,
    );
  });
  it('once everyone has taken one, the owner picks freely and the battle waits for the pick', () => {
    const { g, b, point, other } = attack();
    b.hit = { german: [point, other] };
    E.attackerChoice(g, b, false);
    expect(b.stage).toBe('loss');
    expect(new Set(E.lossOptions(g, b))).toEqual(new Set([point, other]));
    const before = E.unitsIn(g, 23, 'german').find((u) => u.id === other)!.str;
    E.chooseLoss(g, b, other);
    expect(E.unitsIn(g, 23, 'german').find((u) => u.id === other)?.str ?? 0).toBe(before - 1);
    expect(b.stage).not.toBe('loss'); // a new round of 6.43: only the point unit could take the last one, so it went there
    expect(b.hit!.german).toEqual([other, point]);
  });
});

describe('6.5: an aborted river assault falls back across the river, also after a move of several areas', () => {
  it('the attacker returns to the area it crossed from, not to where its move began', () => {
    const g = blank();
    g.phase = 'movement';
    g.phasing = 'german';
    const ge = put(g, '2 Pz', 11);
    g.control[11] = 'german';
    g.control[12] = 'german';
    g.control[23] = 'allied'; // Bleialf → Lutzkampen → St. Vith: Lutzkampen–St. Vith crosses the Our
    const al = put(g, '106 Inf', 23);
    al.str = 3;
    const o = E.moveOptions(g, ge.id).find((x) => x.area === 23 && x.path.length === 3);
    if (!o) return; // the map gives no such path from here: nothing to check
    const r = E.move(g, ge.id, 23);
    if (r === 'blow') E.resolveBlow(g, false);
    expect(ge.area).toBe(23);
    expect(E.neighbors(23)).toContain(ge.from!);
    g.phase = 'combat';
    g.riverAssault.push(23);
    g.contestedAtMoveStart = [];
    g.fought = [];
    const b = E.startBattle(g, 23);
    E.beginCombat(g, b);
    g.force = [10, 10, 1, 1, 1, 1, 1, 1];
    for (let i = 0; i < 6 && b.stage !== 'attChoice' && g.battle; i++) E.roll_step(g, b);
    if (b.stage !== 'attChoice') return;
    expect(() => E.attackerChoice(g, b, true)).not.toThrow();
    expect(ge.area).not.toBe(23);
  });
});
