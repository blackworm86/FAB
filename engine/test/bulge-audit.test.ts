// The Bulge and the Series Rules: the rules audit of November 2026 (one test per fix).
import { describe, expect, it } from 'vitest';
import { passSA as passSA_, setReady as setReady_, type Battle as Battle_, type Game as Game_ } from '../src';
/** 6.21-6.23: past the Defender's Special Action decision and the Attacker's assets, to the Defender's own asset step. */
const defStep = (g: Game_, b: Battle_) => { if (b.defSA) passSA_(g, b); setReady_(g, b, b.attacker); };
import { contestedAreas, newGame, useGame, startBattle, beginCombat, roll_step, defenderChoice, chooseRetreat, retreatOptions, canAssign, chit, move, moveOptions, endPhase, supplyChecks, heydteDrop, saAvailable,
  activateBreakthrough, buildFieldWorks, placeTaskForce, defenderReinforceSA, alternateUse, setReserve, type Game } from '../src';

const U = (g: Game, name: string) => g.units.find((u) => u.name === name)!;
const clear = (g: Game, a: number) => { for (const u of g.units) if (u.area === a) u.area = null; };
const fresh = (seed = 1, opts: Record<string, unknown> = {}) => { useGame('bulge'); const g = newGame(seed, opts as never); return g; };
/** The opening battles are treated as already fought, so phases can end. */
const settle = (g: Game) => { g.contestedAtMoveStart = contestedAreas(g); };
const combat = (g: Game, side: 'german' | 'allied' = 'german') => { g.phase = 'combat'; g.phasing = side; g.contestedAtMoveStart = []; g.fought = []; };

describe('Bulge audit fixes', () => {
  it('16.21: one ground hit destroys the garrison; the units may retreat only with a hit to spare', () => {
    const g = fresh(1); const al = U(g, '101'), ge = U(g, '2 Pz'); clear(g, 47); al.area = 47; ge.area = 47; U(g, 'Garrison Bastogne').area = 47; g.control[47] = 'allied'; combat(g);
    g.force = [10, 10, 10, 10, 10, 1, 10, 10, 10];                                                    // defensive fire misses, the Germans score one hit
    const b = startBattle(g, 47); beginCombat(g, b); roll_step(g, b); roll_step(g, b);
    expect(b.pending).toBe(1); expect(b.stage).not.toBe('defChoice');                                 // no retreat option with a single hit
  });
  it('16.11: von der Heydte needs no supply before turn 4', () => {
    const g = fresh(2, { scenario: 'campaign' }); g.turn = 2; g.phase = 'admin'; g.phasing = 'german';
    const c = chit(g, 'L11.0'); c.box = 'available'; clear(g, 52); g.control[52] = 'allied';
    try { heydteDrop(g, c.id, 52); } catch { g.units.push({ id: 'HEYDTE', name: 'v.d. Heydte', side: 'german', cls: 'infantry', q: ['veteran'], max: 1, str: 1, area: 52, garrison: true, disorder: 0, unsupplied: false, moved: true, reserve: null, exploit: false, ech: 'de_sr', chitId: c.id, heydte: true } as never); }
    g.phase = 'btCombat'; settle(g); endPhase(g); expect(g.phase).toBe('supply');
    expect(supplyChecks(g).some((x) => x.unit.id === 'HEYDTE')).toBe(false);
  });
  it('16.22: a Task Force is placed, never assigned to a battle, and one kept back can be placed on a later turn', () => {
    const g = fresh(3); const tf = chit(g, 'R71.0'); tf.box = 'available'; combat(g);
    const al = U(g, '101'), ge = U(g, '2 Pz'); clear(g, 47); al.area = 47; ge.area = 47; g.control[47] = 'allied';
    const b = startBattle(g, 47); defStep(g, b); expect(canAssign(g, b, 'allied', tf)).toMatch(/16\.22/);
    g.battle = null; g.turn = 3; g.phase = 'btCombat'; g.phasing = 'allied'; settle(g); endPhase(g); endPhase(g); expect(g.phase).toBe('reinforcement');
    expect(g.tfNew).toContain('R71.0'); expect(() => placeTaskForce(g, 'R71.0', 56)).not.toThrow();
  });
  it('5.34: a unit leaving a contested area may not enter an area held by an enemy garrison alone', () => {
    const g = fresh(4); const ge = U(g, '2 Pz'), al = U(g, '106 Inf'); clear(g, 21); clear(g, 37); clear(g, 47); ge.area = 21; al.area = 21; U(g, 'Garrison Bastogne').area = 47;
    g.control[37] = 'german'; g.control[47] = 'allied'; g.phase = 'movement'; g.phasing = 'german'; g.contestedAtMoveStart = [21]; ge.moved = false; ge.spent = 0;
    expect(moveOptions(g, ge.id).map((o) => o.area)).not.toContain(47);
  });
  it('5.35c: a bridge crossed in the Reaction Phase is free again in the Breakthrough Movement Phase', () => {
    const g = fresh(5); g.phase = 'reaction'; g.phasing = 'german'; g.riverCross = ['1-15']; endPhase(g);
    expect(g.phase).toBe('btMove'); expect(g.riverCross).toEqual([]);
  });
  it('5.35d: the first bridge crossing into a newly contested area may be blown even after an overland entry', () => {
    const g = fresh(6); const a = U(g, '62 VG'), b2 = U(g, '2 Pz'), al = U(g, '106 Inf'); clear(g, 15); clear(g, 1); clear(g, 14); al.area = 15; a.area = 14; b2.area = 1; g.control[1] = 'german'; g.control[14] = 'german';
    g.phase = 'movement'; g.phasing = 'german'; g.contestedAtMoveStart = []; for (const u of [a, b2]) { u.moved = false; u.spent = 0; }
    expect(move(g, a.id, 15)).toBe('moved'); expect(move(g, b2.id, 15)).toBe('blow');
  });
  it('17.1 / 15.1c: a German army event works for Strategic Reserve units in its zone and not for its own units outside it', () => {
    const g = fresh(7, { scenario: 'campaign' }); chit(g, 'R38.0').box = 'available';                 // 6th Panzer Army
    expect(saAvailable(g, 'german', 'de_sr', 7).some((c) => c.id === 'R38.0')).toBe(true);           // Schleiden, zone 6
    expect(saAvailable(g, 'german', 'de_6pz', 13).some((c) => c.id === 'R38.0')).toBe(false);        // Dasburg, zone 5
    const u = U(g, '12SS'); clear(g, 13); u.area = 13; g.phase = 'btMove'; g.phasing = 'german'; u.moved = false; u.exploit = false;
    for (const c of g.chits) if (c.kind === 'sa_block' && c.side === 'german') c.box = 'used';
    expect(() => activateBreakthrough(g, u.id, 'R38.0')).toThrow(/Higher Echelon/);
  });
  it('8.22: re-engaging in the Breakthrough Combat Phase needs an event of the attackers\' echelon', () => {
    const g = fresh(8); chit(g, 'R38.0').box = 'available'; for (const c of g.chits) if (c.kind === 'sa_block' && c.side === 'german') c.box = 'used';
    g.phase = 'btCombat'; g.phasing = 'german'; g.contestedAtMoveStart = [11]; g.fought = [];
    clear(g, 11); U(g, '62 VG').area = 11; U(g, '106 Inf').area = 11;
    expect(() => startBattle(g, 11, true)).toThrow(/Special Action/); expect(chit(g, 'R38.0').box).toBe('available');
  });
  it('17.11: a failed Greif check on field works or a reserve marker limits the unit to one area', () => {
    const g = fresh(9); const u = U(g, '2 Inf'); clear(g, 27); u.area = 27; g.control[27] = 'allied'; u.interdict = 'R25.0'; u.moved = false; u.spent = 0; u.unsupplied = false; g.fieldWorks = g.fieldWorks.filter((a) => a !== 27);
    g.phase = 'movement'; g.phasing = 'allied'; g.contestedAtMoveStart = []; g.force = [10];
    expect(() => buildFieldWorks(g, u.id)).toThrow(/morale/); expect(u.adjOnly).toBe(true);
    expect(moveOptions(g, u.id).every((o) => o.path.length === 2)).toBe(true);
  });
  it('4.35: a battle of a garrison alone may not be reinforced by Special Action', () => {
    const g = fresh(10); const ge = U(g, '2 Pz'), al = U(g, '101'); clear(g, 47); clear(g, 37); ge.area = 47; U(g, 'Garrison Bastogne').area = 47; al.area = 37; g.control[47] = 'allied'; g.control[37] = 'allied'; combat(g);
    const b = startBattle(g, 47); expect(() => defenderReinforceSA(g, b, al.id)).toThrow(/4\.35/);
  });
  it('17.21: an Allied air mission may support an unsupplied area', () => {
    const g = fresh(11, { scenario: 'campaign' }); const air = chit(g, 'R41.0'); air.box = 'available';
    const ge = U(g, '2 Pz'), al = U(g, '106 Inf'); clear(g, 11); ge.area = 11; al.area = 11; al.unsupplied = true; g.control[11] = 'allied'; combat(g);
    const b = startBattle(g, 11); defStep(g, b); expect(canAssign(g, b, 'allied', air)).toBeNull();
  });
  it('18.2: bid fuel never returns through the alternate event use', () => {
    const g = fresh(12, { bid: 2 }); g.phase = 'admin'; const bid = g.chits.find((c) => c.bid)!; bid.box = 'eliminated';
    const ev = g.chits.find((c) => c.side === 'german' && c.kind === 'event_release')!; ev.box = 'available';
    for (const c of g.chits) if (c.side === 'german' && c.box === 'eliminated' && !c.bid) c.box = 'cup';
    expect(() => alternateUse(g, ev.id)).toThrow(/4\.21/); expect(bid.box).toBe('eliminated');
  });
  it('6.6 (2016): an overstacked unit retreats past full areas to the nearest one with room', () => {
    const g = fresh(13); const [a, b, c] = ['2 Pz', '62 VG', '18 VG'].map((n) => U(g, n)); for (const u of [a, b, c]) { clear(g, u.area!); }
    clear(g, 6); a.area = 6; b.area = 6; c.area = 6; g.control[6] = 'german'; for (const n of [5, 7, 9, 10]) { clear(g, n); g.control[n] = 'german'; }
    const fill = g.units.filter((u) => u.side === 'german' && u.area != null && ![6].includes(u.area)).slice(0, 8); let i = 0; for (const n of [5, 7, 9, 10]) for (let k = 0; k < 2; k++) fill[i++].area = n;
    g.phase = 'movement'; g.phasing = 'german'; settle(g); endPhase(g);
    expect([a, b, c].every((u) => u.area != null)).toBe(true); expect(g.units.filter((u) => u.area === 6).length).toBe(2);
  });
  it('the done flags survive a refused end of phase', () => {
    const g = fresh(14); g.phase = 'admin'; g.done = ['allied']; g.battle = { stage: 'setup' } as never;
    expect(() => endPhase(g)).toThrow(/battle/); expect(g.done).toEqual(['allied']);
  });
  it('17.11: a reserve marker is not spent by a failed Greif check (interdicted unit stays put)', () => {
    const g = fresh(15); const u = U(g, '2 Inf'); clear(g, 27); u.area = 27; g.control[27] = 'allied'; u.interdict = 'R25.0'; u.moved = false; u.unsupplied = false; g.phase = 'movement'; g.phasing = 'allied'; g.force = [10];
    expect(() => setReserve(g, u.id, true)).toThrow(/morale/); expect(u.adjOnly).toBe(true);
  });
  it('6.2: the battle ends when no attacker in good order is left', () => {
    const g = fresh(16); const ge = U(g, '2 Pz'), ge2 = U(g, '62 VG'), al = U(g, '101'); clear(g, 47); ge.area = 47; ge2.area = 47; ge2.disorder = 1; al.area = 47; g.control[47] = 'allied'; combat(g);
    const b = startBattle(g, 47); beginCombat(g, b); ge.str = 0; ge.area = null;                     // the point unit falls
    roll_step(g, b); expect(b.stage).toBe('done'); expect(b.result).toMatch(/good order/);
  });
});
