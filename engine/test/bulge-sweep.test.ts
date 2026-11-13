// The Bulge: the asset and event sweep of November 2026 (one test per fix).
import { describe, expect, it } from 'vitest';
import { newGame, useGame, chit, heydteWindow, stratOptions, airSupplyAreas, playAirSupply, playInterdict, setReserve, stratMove, eligibleForStep, playReplacement, regimentAreas,
  endPhase, bridgeTargets, startBattle, canAssign, neighbors, passSA, setReady, type Game } from '../src';
const cut = (g: Game, a: number) => { for (const n of neighbors(a)) { clear(g, n); g.control[n] = 'german'; } };

const U = (g: Game, name: string) => g.units.find((u) => u.name === name)!;
const clear = (g: Game, a: number) => { for (const u of g.units) if (u.area === a) u.area = null; };
const fresh = (seed = 1) => { useGame('bulge'); return newGame(seed, { scenario: 'campaign' } as never); };

describe('Bulge asset and event sweep', () => {
  it('16.11: v.d. Heydte drops only in the Admin Phase it is first drawn, and only once', () => {
    const g = fresh(1); const c = chit(g, 'L11.0'); c.box = 'cup'; g.phase = 'admin'; g.phasing = 'german';
    c.box = 'available'; c.drawn = g.turn * 10 + 1; c.firstDrawn = c.drawn; expect(heydteWindow(g, c)).toBe(true);
    g.turn += 1; c.drawn = g.turn * 10 + 1;                                                             // back to the cup and drawn again later
    expect(heydteWindow(g, c)).toBe(false);
  });
  it('17.21: several Air Supply missions at once, each over its own area; garrisons can be air-supplied', () => {
    const g = fresh(3); g.phase = 'supply'; g.phasing = 'allied'; g.battle = null;
    const gar = U(g, 'Garrison Bastogne'); clear(g, 47); gar.area = 47; g.control[47] = 'allied';
    cut(g, 47); expect(airSupplyAreas(g, 'allied')).toContain(47);
    const al = U(g, '106 Inf'); clear(g, 15); al.area = 15; g.control[15] = 'allied'; cut(g, 15); expect(airSupplyAreas(g, 'allied')).toContain(15);
    chit(g, 'R41.0').box = 'available'; chit(g, 'R41.1').box = 'available';
    playAirSupply(g, 'R41.0', 47); playAirSupply(g, 'R41.1', 15); expect(g.airSupplies!.length).toBe(2);
  });
  it('17.11: Greif Interdict may not go on a British unit', () => {
    const g = fresh(4); g.phase = 'admin'; g.phasing = 'german'; const c = chit(g, 'R25.0'); c.box = 'available';
    const br = U(g, '43 Inf'); br.area = 60;
    expect(() => playInterdict(g, 'R25.0', br.id)).toThrow(/American/);
  });
  it('17.11: a failed check to go in reserve loses that marker until the end of the phase', () => {
    const g = fresh(5); g.phase = 'movement'; g.phasing = 'allied'; const u = U(g, '106 Inf'); clear(g, 60); u.area = 60; g.control[60] = 'allied';
    Object.assign(u, { interdict: 'R25.0', moved: false, disorder: 0, unsupplied: false, reserve: null }); chit(g, 'R25.0').box = 'map';
    g.force = [10, 10, 10]; const k = Object.keys(g.markers.allied); const before = k.map((x) => g.markers.allied[x]);
    expect(() => setReserve(g, u.id, true)).toThrow(/17\.11/);
    expect(k.map((x) => g.markers.allied[x]).reduce((a, b) => a + b)).toBe(before.reduce((a, b) => a + b) - 1);
    g.contestedAtMoveStart = []; try { endPhase(g); } catch { /* fine */ }
    expect(k.map((x) => g.markers.allied[x]).reduce((a, b) => a + b)).toBe(before.reduce((a, b) => a + b));
  });
  it('17.11: a strategic move is a move attempt; a failed check stops it', () => {
    const g = fresh(6); g.phase = 'strategic'; g.phasing = 'allied'; const u = U(g, '106 Inf'); clear(g, 60); u.area = 60; g.control[60] = 'allied';
    Object.assign(u, { interdict: 'R25.0', moved: false, disorder: 0, unsupplied: false, reserve: Object.keys(g.markers.allied)[0] }); chit(g, 'R25.0').box = 'map'; g.force = [10, 10, 10];
    const to = stratOptions(g, u.id)[0]; expect(to).toBeDefined(); stratMove(g, u.id, to);
    expect(u.area).toBe(60); expect(u.adjOnly).toBe(true);
  });
  it('17.31 / 17.32: a replacement never adds the elite step', () => {
    const g = fresh(7); const u = U(g, '1SS(-)'); u.str = 2; u.unsupplied = false;                  // next step is the elite one
    expect(eligibleForStep(chit(g, 'L19.0'), u, g)).toBe(false); u.str = 1; expect(eligibleForStep(chit(g, 'L19.0'), u, g)).toBe(true);
  });
  it('9.34d: an air-supplied unit cannot take a replacement step', () => {
    const g = fresh(8); const u = U(g, '106 Inf'); u.area = 60; u.str = 1; u.unsupplied = false; g.airSupplies = [{ area: 60, side: 'allied', id: 'R41.0', stamp: 99 }];
    expect(eligibleForStep(chit(g, 'L56.0'), u, g)).toBe(false);
  });
  it('17.23: the Arriving Regiment comes back in a friendly entry area of the player\'s choice', () => {
    const g = fresh(9); g.phase = 'admin'; g.phasing = 'allied'; const u = U(g, '4 Inf'); u.area = null; u.str = 0; chit(g, 'R31.0').box = 'available';
    const ok = regimentAreas(g, u.id); expect(ok.length).toBeGreaterThan(0); const to = ok[ok.length - 1];
    playReplacement(g, 'R31.0', u.id, to); expect(u.area).toBe(to); expect(u.str).toBe(1);
    expect(ok.every((a) => g.control[a] === 'allied')).toBe(true);
  });
  it('17.12: a Greif-held bridge already tried this Admin Phase is not offered again', () => {
    const g = fresh(10); const k = Object.keys(g.greif)[0]; if (!k) { g.greif['14-15'] = 'R15.0'; }
    const key = Object.keys(g.greif)[0], [a, b] = key.split('-').map(Number); g.control[a] = 'allied'; g.greifTried = [key];
    expect(bridgeTargets(g, 'allied', a)).not.toContain(b);
  });
  it('17.21: no Air Mission for a garrison fighting alone', () => {
    const g = fresh(11); const gar = U(g, 'Garrison Bastogne'), ge = U(g, '2 Pz'); clear(g, 47); gar.area = 47; ge.area = 47; g.control[47] = 'allied';
    g.phase = 'combat'; g.phasing = 'german'; g.contestedAtMoveStart = []; g.fought = []; const b = startBattle(g, 47); if (b.defSA) passSA(g, b); setReady(g, b, b.attacker);
    chit(g, 'R41.0').box = 'available'; expect(canAssign(g, b, 'allied', chit(g, 'R41.0'))).toMatch(/alone/);
  });
});
