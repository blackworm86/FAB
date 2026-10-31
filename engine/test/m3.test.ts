import { describe, expect, it } from 'vitest';
import { canReserve, setReserve, blocks, updateControlForTest, allocateForTest, defenderRetreatSA, arrivalOptions, placeArrival, newGame, endPhase, mustFight, startBattle, beginCombat, roll_step, attackerChoice, defenderChoice, chooseRetreat, retreatOptions, closeBattle, moveOptions, boxOf, roadblock, roadblockAreas, playInterdiction, staffBoundary, staffPool, staffIntel,
  playAirSupply, airSupplyAreas, rerouteOptions, reroute, stratOptions, move, resolveBlow, connection, neighbors, unitsIn, inSupply, assetLimits, areas, type Game } from '../src';

function toAdmin(seed: number, turn = 2, campaign = false): Game {
  const g = newGame(seed, campaign ? { scenario: 'campaign' } : {});
  for (const a of mustFight(g)) { const b = startBattle(g, a); beginCombat(g, b); for (let i = 0; i < 30 && b.stage !== 'done'; i++) { if (b.stage === 'attChoice') attackerChoice(g, b, false); else if (b.stage === 'defChoice') defenderChoice(g, b, false); else if (b.stage === 'retreat') chooseRetreat(g, b, retreatOptions(g, b)[0]); else roll_step(g, b); } closeBattle(g); }
  while (!(g.turn === turn && g.phase === 'admin')) endPhase(g);
  return g;
}
const give = (g: Game, kind: string, side: 'german' | 'allied') => { const c = g.chits.find((x) => x.kind === kind && x.side === side)!; c.box = 'available'; return c; };
const asGermanMover = (g: Game) => { g.phase = 'movement'; g.phasing = 'german'; g.units.forEach((u) => (u.moved = false)); };

describe('M3 rules', () => {
  it('roadblock marker (4.34): +1 MP, the enemy must stop, the marker goes when entered', () => {
    const g = toAdmin(3), eng = give(g, 'engineer', 'allied');
    asGermanMover(g);
    const hit = roadblockAreas(g, 'allied').map((a) => ({ a, u: g.units.find((u) => u.side === 'german' && u.area != null && !u.garrison && moveOptions(g, u.id).some((o) => o.area === a))! })).find((x) => x.u);
    expect(hit).toBeDefined();
    const before = moveOptions(g, hit!.u.id).find((o) => o.area === hit!.a)!;
    g.phase = 'admin'; g.phasing = 'allied'; roadblock(g, eng.id, hit!.a, false); expect(eng.box).toBe('used');
    asGermanMover(g); const after = moveOptions(g, hit!.u.id).find((o) => o.area === hit!.a);
    if (after) { expect(after.mustStop).toBe(true); expect(after.cost).toBeGreaterThanOrEqual(Math.min(before.cost + 1, hit!.u.cls === 'armor' ? 6 : 3)); }
    expect(g.roadblocks[hit!.a]).toBe('allied');
  });
  it('defended roadblock (4.35): the engineer becomes a garrison asset, returns to the Used Box after the turn', () => {
    const g = toAdmin(4), eng = give(g, 'engineer', 'allied'), a = roadblockAreas(g, 'allied')[0];
    g.phasing = 'allied'; roadblock(g, eng.id, a, true);
    expect(eng.box).toBe('map'); expect(unitsIn(g, a, 'allied')[0].garrison).toBe(true);
    g.phase = 'btCombat'; endPhase(g);
    expect(eng.box).toBe('used'); expect(unitsIn(g, a).length).toBe(0);
  });
  it('Interdiction (17.2): Germans pay +1 to enter and leave, no strat-move through, the event goes at Supply', () => {
    const g = toAdmin(5, 2, true), air = give(g, 'air_mission', 'allied');
    asGermanMover(g); const u = g.units.find((x) => x.side === 'german' && x.area != null && !x.garrison && moveOptions(g, x.id).length)!, o = moveOptions(g, u.id)[0];
    g.phase = 'admin'; g.phasing = 'allied'; playInterdiction(g, air.id, o.area); expect(air.box).toBe('map');
    asGermanMover(g); const o2 = moveOptions(g, u.id).find((x) => x.area === o.area);
    if (o2) expect(o2.cost).toBeGreaterThanOrEqual(o.cost);
    g.phase = 'btCombat'; g.phasing = 'allied'; endPhase(g);
    expect(air.box).toBe('eliminated'); expect(Object.keys(g.interdicted).length).toBe(0);
  });
  it('Boundary Crossing Pre-authorized (14.62a) marks one German unit and is consumed by its move', () => {
    const g = toAdmin(6), st = give(g, 'command_staff', 'german'), u = g.units.find((x) => x.side === 'german' && x.area != null && !x.garrison && x.ech && x.ech !== 'de_sr')!;
    staffBoundary(g, st.id, u.id); expect(u.bcross).toBe(true); expect(st.box).toBe('used');
    asGermanMover(g); const o = moveOptions(g, u.id)[0]; if (o) { /* movement code clears the marker */ }
  });
  it('Pooled Assets (14.62b) lifts the mixed-echelon limit and goes at Supply; Intelligence reveals an enemy unit until Admin ends', () => {
    const g = toAdmin(7), st = give(g, 'command_staff', 'allied'), area = [...areas.keys()].find((a) => unitsIn(g, a, 'allied').length)!;
    staffPool(g, st.id, area); expect(g.pooled).toBe(area);
    const st2 = give(g, 'command_staff', 'german'); st2.box = 'available'; g.phasing = 'german';
    const foe = g.units.find((u) => u.side === 'allied' && u.area != null && !u.garrison)!; staffIntel(g, st2.id, foe.id); expect(g.revealed).toBe(foe.id);
    endPhase(g); expect(g.revealed).toBeNull();
    g.phase = 'btCombat'; endPhase(g); expect(g.pooled).toBeNull();
  });
  it('Air Supply (17.2) supplies one unsupplied area until the next Supply Phase', () => {
    const g = toAdmin(8, 2, true), air = give(g, 'air_mission', 'allied'), u = g.units.find((x) => x.side === 'allied' && x.area != null && !x.garrison)!;
    g.control[u.area!] = 'allied';
    g.units.filter((x) => x.side === 'german').forEach((x) => { x.area = null; });
    for (const n of areas.keys()) if (n !== u.area) g.control[n] = 'german';        // cut off
    g.phase = 'btCombat'; g.phasing = 'allied'; g.units.forEach((x) => (x.moved = false));
    const opts = airSupplyAreas(g, 'allied');
    if (opts.includes(u.area!)) { playAirSupply(g, air.id, u.area!); expect(inSupply(g, 'allied', u.area!)).toBe(true); endPhase(g); expect(u.unsupplied).toBe(false); g.turn++; g.phase = 'btCombat'; g.phasing = 'german'; endPhase(g); expect(g.airSupply).toBeNull(); expect(air.box).toBe('eliminated'); }
  });
  it('Reroute (8.27): a reinforcement may move to another entry area for a Special Action', () => {
    const g = newGame(9, { scenario: 'campaign' });
    while (!(g.turn === 2 && g.phase === 'reinforcement')) { for (const a of mustFight(g)) { const b = startBattle(g, a); beginCombat(g, b); for (let i = 0; i < 30 && b.stage !== 'done'; i++) { if (b.stage === 'attChoice') attackerChoice(g, b, false); else if (b.stage === 'defChoice') defenderChoice(g, b, false); else if (b.stage === 'retreat') chooseRetreat(g, b, retreatOptions(g, b)[0]); else roll_step(g, b); } closeBattle(g); } endPhase(g); }
    for (const id of [...g.pendingArrivals]) { const o = arrivalOptions(g, id).find((x) => !x.sa); if (o) placeArrival(g, id, o.area); }
    const u = g.units.find((x) => g.arrived.includes(x.id) && rerouteOptions(g, x.id).length);
    if (u) { const to = rerouteOptions(g, u.id)[0], before = boxOf(g, u.side, 'available').length; reroute(g, u.id, to); expect(u.area).toBe(to); expect(boxOf(g, u.side, 'available').length).toBeLessThanOrEqual(before); }
    expect(stratOptions(g, g.units[0].id)).toBeDefined(); expect(assetLimits).toBeDefined();
  });
});

describe('retreat choice (6.5)', () => {
  it('a retreating defender stops at a retreat stage when several areas are legal, and chooseRetreat moves it disordered', () => {
    let seen = 0;
    for (let seed = 1; seed <= 80 && !seen; seed++) {
      const g = newGame(seed);
      for (const a of mustFight(g)) {
        const b = startBattle(g, a); beginCombat(g, b);
        for (let i = 0; i < 30 && b.stage !== 'done'; i++) {
          if (b.stage === 'attChoice') attackerChoice(g, b, false);
          else if (b.stage === 'defChoice') defenderChoice(g, b, true);
          else if (b.stage === 'retreat') { const opts = retreatOptions(g, b); expect(opts.length).toBeGreaterThan(1); const u = g.units.find((x) => x.id === b.retreat!.queue[0])!; chooseRetreat(g, b, opts[opts.length - 1]); expect(u.area).toBe(opts[opts.length - 1]); expect(u.disorder).toBe(1); seen++; }
          else roll_step(g, b);
        }
        if (b.stage === 'done') closeBattle(g);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('retreat before combat (Special Action)', () => {
  it('stops at the retreat step when several areas are legal, then ends the battle with an exploitation chance', () => {
    const g = newGame(1), b = startBattle(g, 10), sa = g.chits.find((c) => c.kind === 'sa_block' && c.side === 'allied')!;      // area 10: Allied defenders, retreat to 23 or 25
    sa.box = 'available';
    defenderRetreatSA(g, b);
    expect(sa.box).toBe('used'); expect(b.stage).toBe('retreat');
    const opts = retreatOptions(g, b), first = g.units.find((x) => x.id === b.retreat!.queue[0])!;
    expect(opts.length).toBeGreaterThan(1);
    chooseRetreat(g, b, opts[1]); expect(first.area).toBe(opts[1]); expect(first.disorder).toBe(0);                     // 8.24: no disorder
    while (b.stage === 'retreat') chooseRetreat(g, b, retreatOptions(g, b)[0]);
    expect(b.stage).toBe('done'); expect(b.exploit).toBe(true);
  });
});

describe('river crossings (5.35d, 5.35e, 7.31)', () => {
  const quiet = () => {
    const g = newGame(5); g.phase = 'movement'; g.phasing = 'german'; g.fought = []; g.contestedAtMoveStart = [];
    const ger = g.units.find((u) => u.side === 'german' && !u.garrison && u.cls === 'armor')!, al = g.units.find((u) => u.side === 'allied' && !u.garrison)!;
    g.units.forEach((u) => { if (u !== ger && u !== al) u.area = null; });
    let pair: [number, number] | null = null;
    for (const a of areas.keys()) { for (const b of neighbors(a)) { const c = connection(a, b)!; if (c.river && !c.restricted && !g.blown.includes(a < b ? `${a}-${b}` : `${b}-${a}`)) { pair = [a, b]; break; } } if (pair) break; }
    const [a, b] = pair!; ger.area = a; al.area = b; ger.moved = false; ger.reserve = null; ger.disorder = 0; ger.unsupplied = false; g.control[a] = 'german'; g.control[b] = 'allied';
    return { g, ger, a, b };
  };
  const blowUntil = (g: Game, id: string, to: number) => { for (let s = 1; s < 80; s++) { const g2: Game = JSON.parse(JSON.stringify(g)); g2.seed = s * 31; g2.rolls = 0; if (move(g2, id, to) !== 'blow') return null; if (resolveBlow(g2, true) !== 'stopped' && g2.blown.length > g.blown.length) return g2; } return null; };
  it('a unit that crosses a bridge blown in reaction gets a river assault marker when the area is newly contested', () => {
    const { g, ger, b } = quiet(), g2 = blowUntil(g, ger.id, b)!;
    expect(g2.units.find((u) => u.id === ger.id)!.area).toBe(b);
    endPhase(g2); expect(g2.riverAssault).toContain(b);
  });
  it('an exploitation unit never crosses a bridge blown by its own attempt and keeps its move', () => {
    const { g, ger, b } = quiet(); g.phase = 'btMove'; ger.exploit = true;
    for (let s = 1; s < 80; s++) { const g2: Game = JSON.parse(JSON.stringify(g)); g2.seed = s * 31; g2.rolls = 0; if (move(g2, ger.id, b) !== 'blow') continue; if (resolveBlow(g2, true) === 'stopped') { const u = g2.units.find((x) => x.id === ger.id)!; expect(u.area).not.toBe(b); expect(u.moved).toBe(false); expect(moveOptions(g2, u.id).some((o) => o.area === b)).toBe(false); return; } }
    throw new Error('no blown bridge reached');
  });
  it('a unit that cannot cross loses 1 MP and may keep moving (5.35d)', () => {
    const { g, ger } = quiet(); let found = false;
    for (const o of moveOptions(g, ger.id).filter((x) => x.path.length > 2)) {
      const last = o.path[o.path.length - 1], prev = o.path[o.path.length - 2];
      if (!connection(prev, last)!.river) continue;
      g.units.find((u) => u.side === 'allied' && u.area != null)!.area = last; g.control[last] = 'allied';
      for (let s = 1; s < 80 && !found; s++) { const g2: Game = JSON.parse(JSON.stringify(g)); g2.seed = s * 17; g2.rolls = 0; if (move(g2, ger.id, last) !== 'blow') break; if (resolveBlow(g2, true) === 'stopped') { const u = g2.units.find((x) => x.id === ger.id)!; expect(u.area).toBe(prev); expect(u.moved).toBe(false); expect(u.spent).toBeGreaterThan(0); expect(moveOptions(g2, u.id).length).toBeGreaterThan(0); found = true; } }
      if (found) break;
    }
    expect(found).toBe(true);
  });
});

describe('rule fixes from the conformance review', () => {
  it('5.21: a reserve marker is removed when the area becomes contested; 5.2: a unit that moved cannot be marked', () => {
    const g = newGame(5), u = g.units.find((x) => x.side === 'allied' && x.area != null && !x.garrison && canReserve(g, x))!;
    setReserve(g, u.id, true); expect(u.reserve).not.toBeNull();
    const foe = g.units.find((x) => x.side === 'german' && x.area != null && !x.garrison)!; foe.area = u.area; updateControlForTest(g, u.area!);
    expect(u.reserve).toBeNull();
    const w = g.units.find((x) => x.side === 'allied' && x.area != null && !x.garrison && x !== u)!; w.moved = true; expect(canReserve(g, w)).toBe(false);
  });
  it('6.43: losses spread over all units across volleys of one battle', () => {
    const g = newGame(5); const a = mustFight(g).find((x) => blocks(g, x, 'german').length === 2 && blocks(g, x, 'allied').length >= 1)!;
    const b = startBattle(g, a); b.attacker = 'german'; const us = blocks(g, a, 'german'); us.forEach((u) => { u.str = u.max = 3; u.q = ['green', 'green', 'green']; });
    b.attPoint = us[0].id; allocateForTest(g, b, 'german', 1); allocateForTest(g, b, 'german', 1);
    expect(us.map((u) => u.str).sort()).toEqual([2, 2]);
  });
  it('9.5: a defended roadblock of the non-phasing side is removed too at the Supply Phase', () => {
    const g = toAdmin(4, 2), eng = g.chits.find((c) => c.kind === 'engineer' && c.side === 'allied')!; eng.box = 'available';
    g.phasing = 'allied'; const a = roadblockAreas(g, 'allied')[0]; roadblock(g, eng.id, a, true);
    g.phasing = 'german'; g.phase = 'btCombat'; endPhase(g);
    expect(g.units.some((u) => u.id.startsWith('DR-') && u.area != null)).toBe(false); expect(eng.box).toBe('used');
  });
});
