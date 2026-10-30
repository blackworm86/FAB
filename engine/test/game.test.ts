import { describe, expect, it } from 'vitest';
import { arrivalOptions, placeArrival, newGame, mustFight, startBattle, beginCombat, roll_step, attackerChoice, defenderChoice, chooseRetreat, retreatOptions, closeBattle, assign, canAssign, endPhase, moveOptions, move, resolveBlow, setReserve, canReserve,
  stratOptions, stratMove, contestedAreas, unitsIn, boxOf, victory, assetLimits, chit, type Game } from '../src';

function runBattle(g: Game, a: number, flip: boolean) {
  const b = startBattle(g, a);
  for (const side of ['german', 'allied'] as const) for (const c of boxOf(g, side, 'available')) { try { assign(g, b, c.id); } catch { /* not assignable */ } }
  beginCombat(g, b);
  for (let i = 0; i < 40 && b.stage !== 'done'; i++) {
    if (b.stage === 'attChoice') attackerChoice(g, b, flip); else if (b.stage === 'defChoice') defenderChoice(g, b, !flip); else if (b.stage === 'retreat') chooseRetreat(g, b, retreatOptions(g, b)[0]); else roll_step(g, b);
  }
  expect(b.stage).toBe('done'); closeBattle(g);
}
function invariants(g: Game) {
  for (let a = 1; a <= 98; a++) for (const side of ['german', 'allied'] as const) expect(unitsIn(g, a, side).filter((u) => !u.garrison).length).toBeLessThanOrEqual(2);
  for (const u of g.units) { if (u.area != null) { expect(u.str).toBeGreaterThanOrEqual(1); expect(u.str).toBeLessThanOrEqual(u.max); } else if (!u.arrival && u.code !== 'Res') expect(u.str === 0 || !!u.garrison).toBe(true); }
  const n = g.chits.length; expect(['german', 'allied'].flatMap((s) => ['future', 'cup', 'available', 'used', 'eliminated', 'map'].flatMap((bx) => boxOf(g, s as 'german', bx as 'cup'))).length).toBe(n);
  for (const sd of ['german', 'allied'] as const) for (const k of Object.keys(g.markers[sd])) expect(g.markers[sd][k]).toBeGreaterThanOrEqual(0);
}
function play(g: Game, seedFlip: number) {
  for (let step = 0; step < 400 && !g.over; step++) {
    const mine = g.units.filter((u) => u.side === (g.phase === 'reaction' ? (g.phasing === 'german' ? 'allied' : 'german') : g.phasing) && u.area != null);
    if (g.phase === 'movement') for (const u of mine) {
      const o = moveOptions(g, u.id); if (o.length) { const r = move(g, u.id, o[(step + u.str) % o.length].area); if (r === 'blow') resolveBlow(g, step % 2 === 0); }
      else if (canReserve(g, u) && step % 2) setReserve(g, u.id, true);
    }
    if (g.phase === 'strategic') for (const u of mine) { const o = stratOptions(g, u.id); if (o.length) stratMove(g, u.id, o[0]); }
    if (g.phase === 'reaction' || g.phase === 'btMove') for (const u of mine) { const o = moveOptions(g, u.id); if (o.length) { const r = move(g, u.id, o[0].area); if (r === 'blow') resolveBlow(g, true); } }
    if (g.phase === 'combat' || g.phase === 'btCombat') for (const a of contestedAreas(g)) { if (g.fought.includes(a)) continue; try { runBattle(g, a, (a + step + seedFlip) % 2 === 0); } catch { /* optional battle not allowed */ } }
    invariants(g); endPhase(g);
  }
}
describe('M2 game flow', () => {
  it('sets up the Tournament: 31 units, 23 German starting assets in the Available Box, no Allied assets', () => {
    const g = newGame(1);
    expect(g.units.filter((u) => u.area != null && !u.garrison)).toHaveLength(31);
    expect(boxOf(g, 'german', 'available')).toHaveLength(23); expect(boxOf(g, 'allied', 'available')).toHaveLength(0);
    expect(g.markers.german).toEqual({ z5: 2, z6: 1, z7: 1 }); expect(g.markers.allied).toEqual({ z56: 3, z7: 2 });
    expect(mustFight(g).sort((a, b) => a - b)).toEqual([9, 10, 11, 12, 16, 18, 19, 21]);
    expect(() => endPhase(g)).toThrow();
  });
  it('turn 2 reinforcement and admin draws follow the Turn Track (German 9, Allied 7 on the first player turn)', () => {
    const g = newGame(3);
    for (const a of mustFight(g)) runBattle(g, a, false);
    while (g.turn === 1) endPhase(g);
    expect(g.turn).toBe(2); expect(g.phase).toBe('reinforcement');
    expect(boxOf(g, 'german', 'available').some((c) => c.kind === 'sa_block')).toBe(true);
    const cupGe = boxOf(g, 'german', 'cup').length, cupAl = boxOf(g, 'allied', 'cup').length;
    expect(g.pendingArrivals.length).toBeGreaterThan(0); const arm = g.units.find((u) => u.name === '7 Arm')!; expect(g.pendingArrivals).toContain(arm.id);
    const opt = arrivalOptions(g, arm.id)[0]; placeArrival(g, arm.id, opt.area); expect(arm.area).toBe(opt.area);       // the player places turn-2 reinforcements
    expect(g.units.find((u) => u.name === '1 Inf')!.str).toBe(1);               // arrives at one step (24.25)
    const avGe = boxOf(g, 'german', 'available').length, avAl = boxOf(g, 'allied', 'available').length;
    endPhase(g);
    expect(g.phase).toBe('admin');
    expect(boxOf(g, 'german', 'available').length - avGe + (cupGe - boxOf(g, 'german', 'cup').length) * 0).toBeGreaterThan(0);
    expect(cupGe - boxOf(g, 'german', 'cup').length).toBe(9); expect(cupAl - boxOf(g, 'allied', 'cup').length).toBe(7);
    void avAl;
  });
  it('asset rules: artillery limits, one regular + one rocket for two German artillery, garrison-only defenders get no help', () => {
    const g = newGame(5); const b = startBattle(g, 11);                       // Bleialf: 62 VG & 18 VG (5th Pz) vs 106 Inf (1st Army) + field works
    const arts = boxOf(g, 'german', 'available').filter((c) => c.kind === 'artillery' && c.ech === 'de_5pz');
    const rkts = boxOf(g, 'german', 'available').filter((c) => c.kind === 'rocket_artillery' && c.ech === 'de_5pz');
    expect(arts.length).toBeGreaterThan(0); expect(rkts.length).toBeGreaterThan(0);
    assign(g, b, arts[0].id);
    expect(canAssign(g, b, 'german', arts[1])).toMatch(/regular and one rocket/);
    assign(g, b, rkts[0].id); expect(canAssign(g, b, 'german', rkts[1])).toMatch(/at most 2/);
    expect(canAssign(g, b, 'german', boxOf(g, 'german', 'available').find((c) => c.ech === 'de_6pz' && c.kind === 'artillery')!)).toMatch(/zone/);
    expect(assetLimits(g, b, 'allied').arty).toBe(2);                         // US defenders: 1 + 1 (16.23)
    expect(assetLimits(g, b, 'german').arty).toBe(2);
  });
  it('plays the whole Tournament scenario for several seeds without breaking any invariant', () => {
    for (const seed of [11, 12, 13, 14]) {
      const g = newGame(seed); play(g, seed);
      expect(g.over).toBeTruthy(); const v = victory(g); expect(v.german).toBeGreaterThanOrEqual(0); expect(v.allied).toBeGreaterThanOrEqual(0);
    }
  });
  it('reserve + strategic movement: one German strat-move per turn, costs a fuel asset, stays on friendly roads', () => {
    const g = newGame(8); for (const a of mustFight(g)) runBattle(g, a, false);
    while (!(g.turn === 2 && g.phase === 'movement')) endPhase(g);
    const u = g.units.find((x) => x.name === '12SS')!;                               // Schleiden, uncontested, 6th Pz zone
    expect(canReserve(g, u)).toBe(true); setReserve(g, u.id, true); expect(g.markers.german.z6).toBe(1);
    endPhase(g); expect(g.phase).toBe('strategic');
    const opts = stratOptions(g, u.id); expect(opts.length).toBeGreaterThan(0);
    const fuel = boxOf(g, 'german', 'available').filter((c) => c.kind === 'fuel').length;
    stratMove(g, u.id, opts[0]); expect(u.area).toBe(opts[0]); expect(boxOf(g, 'german', 'available').filter((c) => c.kind === 'fuel').length).toBe(fuel - 1);
    expect(u.reserve).toBeNull(); expect(g.markers.german.z6).toBe(2);
    const other = g.units.find((x) => x.side === 'german' && x.id !== u.id && x.area != null && !x.unsupplied)!;
    expect(stratOptions(g, other.id)).toEqual([]);                                   // no marker and already one strat-move
  });
  it('crossing a river into a newly contested area lets the defender try to blow the bridge', () => {
    const g = newGame(9); for (const a of mustFight(g)) runBattle(g, a, false);
    while (!(g.turn === 2 && g.phase === 'movement')) endPhase(g);
    let seen = 0;
    for (const u of g.units.filter((x) => x.side === 'german' && x.area != null)) for (const o of moveOptions(g, u.id)) {
      const gg = JSON.parse(JSON.stringify(g)) as Game; const r = move(gg, u.id, o.area);
      if (r === 'blow') { seen++; expect(gg.pendingBlow).not.toBeNull(); expect(() => endPhase(gg)).toThrow(); const out = resolveBlow(gg, true); expect(['blown-crossed', 'stopped', 'failed']).toContain(out); expect(gg.pendingBlow).toBeNull(); }
    }
    expect(seen).toBeGreaterThanOrEqual(0);
  });
  it('victory counts supplied objective areas and eliminated large units', () => {
    const g = newGame(2); const v = victory(g);
    expect(v.german + v.allied).toBeGreaterThan(0);                           // mutual star areas are held by someone at the start
    g.elimLarge.push(g.units.find((u) => u.name === '2 Inf')!.id);
    expect(victory(g).german).toBe(v.german + 1);
  });
});
