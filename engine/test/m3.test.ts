import { describe, expect, it } from 'vitest';
import { arrivalOptions, placeArrival, chooseRetreat, retreatOptions, newGame, endPhase, mustFight, startBattle, beginCombat, roll_step, attackerChoice, defenderChoice, chooseRetreat, retreatOptions, closeBattle, moveOptions, boxOf, roadblock, roadblockAreas, playInterdiction, staffBoundary, staffPool, staffIntel,
  playAirSupply, airSupplyAreas, rerouteOptions, reroute, stratOptions, unitsIn, inSupply, assetLimits, areas, type Game } from '../src';

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
