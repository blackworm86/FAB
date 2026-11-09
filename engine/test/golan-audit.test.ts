// Golan '73: the rules audit of November 2026 (one test per fix).
import { describe, expect, it } from 'vitest';
import { passSA as passSA_, setReady as setReady_, type Battle as Battle_, type Game as Game_ } from '../src';
/** 6.21-6.23: past the Defender's Special Action decision and the Attacker's assets, to the Defender's own asset step. */
const defStep = (g: Game_, b: Battle_) => { if (b.defSA) passSA_(g, b); setReady_(g, b, b.attacker); };
import { startBattle, beginCombat, canAssign, assign, moveOptions, stratOptions, stratMove, setReserve, edgeKey, endPhase, neighbors, inSupply, rollSupply, supplyChecks, firstBattle, golan, ai, type Game } from '../src';
import { newGolanGame, unit, chit, give, move } from './golan-helpers';
const regular = (u: { garrison?: boolean; fort?: unknown; ghost?: unknown }) => !u.garrison && !u.fort && !u.ghost;

const S = golan.state;
/** The Israeli garrison in R. Magshimim (22) cut off: every neighbour Syrian-controlled, a Syrian block in the area. */
const garrisonAlone = (g: Game) => { Object.assign(unit(g, 'S05'), { area: 22 }); g.turn = 3; g.phase = 'combat'; g.phasing = 'syrian'; g.contestedAtMoveStart = [22]; };

describe('Golan audit fixes', () => {
  it('4.35 / 16.24: a garrison fighting alone gets one artillery asset and nothing else', () => {
    const g = newGolanGame(21); garrisonAlone(g); give(g, 'IC30'); give(g, 'IC15');
    const b = startBattle(g, 22); defStep(g, b);
    expect(canAssign(g, b, 'israeli', chit(g, 'IC01'))).toBeNull();                       // one artillery asset
    expect(canAssign(g, b, 'israeli', chit(g, 'IC15'))).toMatch(/4\.35/);                 // no battle asset
    expect(canAssign(g, b, 'israeli', chit(g, 'IC03'))).toMatch(/4\.35/);                 // no air
    expect(() => golan.playCounterbattery(g, b, 'IC30')).toThrow(/4\.35/);                 // no event
  });
  it('16.24: an isolated garrison rolls the unsupplied morale check and can be eliminated', () => {
    const g = newGolanGame(22); for (const n of neighbors(22)) g.control[n] = 'syrian'; g.turn = 3;
    expect(inSupply(g, 'israeli', 22)).toBe(false);
    g.phase = 'btCombat'; g.phasing = 'israeli'; endPhase(g); expect(g.phase).toBe('supply');
    const garrison = g.units.find((u) => u.id === 'G-IC05')!; expect(garrison.unsupplied).toBe(true);
    expect(supplyChecks(g).some((c) => c.unit.id === 'G-IC05')).toBe(true);
    g.force = [10]; rollSupply(g); expect(garrison.area).toBeNull();
  });
  it('22.17: the free Breakthrough combat round of turn 1 is visible without a Special Action', () => {
    const g = newGolanGame(23); g.phase = 'btCombat'; expect(golan.freeRoundLeft(g)).toBe(true);
    S(g).freeCombatRound = 0; expect(golan.freeRoundLeft(g)).toBe(false);
  });
  it('14.03: nobody moves to or from Mt Hermon on the night turn', () => {
    const g = newGolanGame(24); g.turn = 2; g.phase = 'movement'; g.phasing = 'israeli'; g.contestedAtMoveStart = [];
    Object.assign(unit(g, 'I01'), { area: 59, moved: false, spent: 0 });
    expect(moveOptions(g, 'I01').map((o) => o.area)).not.toContain(83);
    g.turn = 3; expect(moveOptions(g, 'I01').map((o) => o.area)).toContain(83);
  });
  it('14.41: a river on a field connection has no bridge to blow', () => {
    const g = newGolanGame(25); g.phase = 'movement'; g.contestedAtMoveStart = [];
    Object.assign(unit(g, 'S01'), { area: 1, moved: false, spent: 0 }); g.control[1] = 'syrian'; Object.assign(unit(g, 'I05'), { area: 3 });
    expect(move(g, 'S01', 3)).toBe('moved'); expect(g.pendingBlow).toBeNull();
  });
  it('16.11a: after a failed raid the Israeli unit may move on', () => {
    const g = newGolanGame(26); g.phase = 'movement'; g.phasing = 'israeli'; g.contestedAtMoveStart = [];
    Object.assign(unit(g, 'I03'), { area: 24, moved: false, spent: 0 }); g.control[26] = 'israeli';
    const c = g.chits.find((x) => x.kind === 'commando')!; c.box = 'map'; c.area = 26; g.units.push({ ...unit(g, 'I03'), id: `R-${c.id}`, side: 'syrian', garrison: true, chitId: c.id, area: 26, name: 'raid', str: 1, max: 1 } as never); S(g).raids.push(26);
    g.force = [8]; move(g, 'I03', 26);
    expect(unit(g, 'I03').moved).toBe(false); expect(moveOptions(g, 'I03').length).toBeGreaterThan(0);
  });
  it('16.12: the Admin Phase cannot end with a SAM answer pending, and a cancelled mission is not flown again over the area', () => {
    const g = newGolanGame(27); g.turn = 3; g.phase = 'admin'; g.phasing = 'israeli'; give(g, 'IC03'); give(g, 'IC16');
    golan.airInterdiction(g, 'IC03', 75); expect(S(g).samTarget).toBe('IC03');
    expect(() => endPhase(g)).toThrow(/16\.12/);
    const sam = g.chits.find((x) => x.kind === 'sam' && x.box === 'available')!; g.force = [3]; golan.fireSam(g, sam.id);
    expect(g.interdicted[75]).toBeUndefined(); expect(() => golan.airInterdiction(g, 'IC16', 75)).toThrow(/16\.12/);
  });
  it('15.7 / 6.8: a ghost-only area gives no exploitation', () => {
    const g = newGolanGame(28); g.turn = 3; g.phase = 'combat'; g.phasing = 'syrian'; g.contestedAtMoveStart = [];
    const ghost = g.units.find((u) => u.ghost && u.area != null)!, a = ghost.area!;
    for (const u of g.units.filter((u) => u.area === a && u.side === 'israeli' && !u.ghost)) u.area = null;
    Object.assign(unit(g, 'S09'), { area: a }); const b = startBattle(g, a); beginCombat(g, b);
    expect(b.exploit).toBe(false); expect(b.stage).toBe('done');
  });
  it('17.33: a jammed Syrian defence fires no SAM', () => {
    const g = newGolanGame(29); g.turn = 3; g.phase = 'combat'; g.phasing = 'israeli'; g.contestedAtMoveStart = [];
    Object.assign(unit(g, 'I05'), { area: 27 }); give(g, 'IC36'); give(g, 'IC03');
    const b = startBattle(g, 27); golan.playJamming(g, b, 'IC36'); g.force = unit(g, 'S01') ? [1, 1, 1, 1] : [1]; golan.answerJamming(g, b);
    expect(golan.battleState(b).defLocked).toBe(true);
    assign(g, b, 'IC03', 'arty'); expect(S(g).samTarget).toBeUndefined();
  });
  it('15.3: the air assault landing is fought before any other battle', () => {
    const g = newGolanGame(30); Object.assign(unit(g, 'I05'), { area: 83 }); golan.airAssault(g, 83);
    expect(firstBattle(g)).toBe(83); expect(() => startBattle(g, 27)).toThrow(/Hermon/);
    expect(ai.next(g, 'syrian', 'normal')?.op).toEqual(['startBattle', 83, false]);
  });
  it('15.12: with mixed Syrian divisions air support may only fire as artillery', () => {
    const g = newGolanGame(31); g.turn = 3; g.phase = 'combat'; g.contestedAtMoveStart = [];
    const s1 = g.units.find((u) => u.side === 'syrian' && u.division === '5th_inf' && u.area != null)!, s2 = g.units.find((u) => u.side === 'syrian' && u.division === '9th_inf' && u.area != null)!;
    Object.assign(s2, { area: 27 }); Object.assign(s1, { area: 27 }); Object.assign(unit(g, 'I05'), { area: 27 }); give(g, 'SC14a');
    const b = startBattle(g, 27);
    expect(canAssign(g, b, 'syrian', chit(g, 'SC14a'), 'support')).toMatch(/15\.12/); expect(canAssign(g, b, 'syrian', chit(g, 'SC14a'), 'arty')).toBeNull();
  });
});

describe('14.11 / 14.14 in strategic moves (the owner\'s ruling, 9 Nov 2026)', () => {
  it('only one unit crosses an escarpment or rugged boundary in the Strategic Movement Phase', () => {
    const g = newGolanGame(42); g.turn = 3; g.phasing = 'israeli';
    const [a, b] = g.units.filter((u) => u.side === 'israeli' && regular(u) && u.cls === 'armor').slice(0, 2);
    for (const u of [a, b]) Object.assign(u, { area: 6, moved: false, unsupplied: false, disorder: 0, reserve: null });
    for (const n of [6, 7, 36]) { for (const u of g.units) if (u.area === n && u !== a && u !== b) u.area = null; g.control[n] = 'israeli'; }
    for (const n of [34, 42]) g.control[n] = 'syrian';                                                   // the other roads into Katzrin closed: only the 7-36 escarpment road is left
    g.phase = 'movement'; for (const u of [a, b]) setReserve(g, u.id, true, true);
    g.phase = 'strategic'; S(g).crossed = [];
    expect(stratOptions(g, a.id)).toContain(36);
    stratMove(g, a.id, 36);
    expect(S(g).crossed).toContain(edgeKey(7, 36));
    expect(stratOptions(g, b.id)).not.toContain(36);
  });
});

describe('15.6 strongpoints get no replacement steps (the owner\'s ruling, 9 Nov 2026)', () => {
  it('neither a Special Action, the command staff nor a replacement event adds a step to a reduced strongpoint', async () => {
    const E = await import('../src');
    const g = newGolanGame(43); g.turn = 3; g.phase = 'admin'; g.phasing = 'israeli';
    const sp = g.units.find((u) => u.fort && u.area != null && u.max > 1)!; sp.str = sp.max - 1;
    for (const c of g.chits) if (c.side === 'israeli' && ['sa_block', 'command_staff', 'replacement_arm', 'replacement_mech'].includes(c.kind)) c.box = 'available';
    const id = (k: string) => g.chits.find((c) => c.side === 'israeli' && c.kind === k && c.box === 'available')!.id;
    expect(() => E.qualityReplacement(g, sp.id)).toThrow(/strongpoint/);
    expect(() => E.staffReplacement(g, id('command_staff'), sp.id)).toThrow();
    expect(() => golan.playReplacement(g, id(sp.cls === 'armor' ? 'replacement_arm' : 'replacement_mech'), sp.id)).toThrow(/strongpoint/);
    expect(sp.str).toBe(sp.max - 1);
  });
});

describe('15.2 / 15.4a the Syrian player chooses the Purple Line release (the owner\'s ruling, 9 Nov 2026)', () => {
  it('the Israeli move waits; Syria picks two Strategic Reserve units and places every released unit; then Israel goes on', async () => {
    const E = await import('../src');
    const g = newGolanGame(44); g.turn = 3; g.phase = 'movement'; g.phasing = 'israeli'; g.contestedAtMoveStart = E.contestedAreas(g);
    const u = unit(g, 'I05'); Object.assign(u, { area: 50, moved: false, spent: 0, disorder: 0 }); for (const x of g.units) if (x.area === 64 || (x.area === 50 && x.side === 'syrian')) x.area = null; g.control[64] = 'syrian'; g.control[50] = 'israeli';
    E.move(g, 'I05', 64);
    expect(S(g).purpleLineCrossed).toBe(true); expect(E.actorOf(g)).toBe('syrian');
    expect(golan.releaseChoices(g).map((x) => x.id).sort()).toEqual(['S21', 'S22', 'S23']);
    const other = g.units.find((x) => x.side === 'israeli' && x.area != null && !x.garrison && !x.fort && !x.ghost && x.id !== 'I05' && E.moveOptions(g, x.id).length);
    if (other) expect(() => E.move(g, other.id, E.moveOptions(g, other.id)[0].area)).toThrow(/15\.2/);
    expect(() => golan.pickRelease(g, ['S21'])).toThrow(/two/);
    golan.pickRelease(g, ['S22', 'S23']);
    expect(unit(g, 'S21').box).toBe('strategic_reserve');
    for (let i = 0; i < 6 && S(g).release; i++) { const id = S(g).release!.place[0]; golan.placeReleased(g, id, golan.releaseTargets(g, id)[0]); }
    expect(S(g).release).toBeUndefined(); expect(E.actorOf(g)).toBe('israeli');
    for (const id of ['S18', 'S19', 'S20', 'S22', 'S23']) expect(unit(g, id).area != null || unit(g, id).box === 'arriving').toBe(true);
  });
  it('the computer as Syria answers the release', async () => {
    const E = await import('../src');
    const g = newGolanGame(45); g.turn = 3; g.phase = 'movement'; g.phasing = 'israeli'; g.contestedAtMoveStart = E.contestedAreas(g);
    Object.assign(unit(g, 'I05'), { area: 50, moved: false, spent: 0, disorder: 0 }); for (const x of g.units) if (x.area === 64 || (x.area === 50 && x.side === 'syrian')) x.area = null; g.control[64] = 'syrian'; g.control[50] = 'israeli';
    E.move(g, 'I05', 64);
    for (let i = 0; i < 8 && S(g).release; i++) { const a = ai.next(g, 'syrian', 'normal')!; ai.apply(g, a.op); }
    expect(S(g).release).toBeUndefined();
  });
});
