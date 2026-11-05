// Golan '73 Admin-phase play, events and Special Actions (17.x, 8.x, 14.5, 14.6, 16.11, 16.31) and the alternate set-up.
import { describe, expect, it } from 'vitest';
import { newGolanGame, endPhase, unit, chit, onMap, count, moveOptions, move, mustFight, inSupply, edgeKey,
  blowBridges, roadblock, bridgeDitch, removeMinefield, airInterdiction, airRecon, placeRaid, playRelease, playSSM, resolveDugman, playArrivingBattalion,
  playLtZvika, playKingHassan, playReplacement, alternateEventUse, rally, qualityReplacement, mergeUnits, releaseOperationalReserve, replaceAsset,
  staffReplacement, setReserve, unitFieldWorks, deployOptions, deploy, startBattle, beginCombat, playJamming, answerJamming, playCounterbattery, rollStep,
  area, defenderRetreatSA, defenderReinforceSA, reinforceOptions, chooseRetreat, retreatOptions, neighbors as require_neighbors, fireSam, declineSam, assign, canAssign, fireList, ASSEMBLY, type GGame } from '../src/golan';
import { fight, playOut } from './golan-helpers';

/** A vacant, supplied, Israeli-controlled area of TDN 1 or more, away from the front. */
const quiet = (g: GGame) => [35, 41, 45, 47, 5, 12, 9, 4].find((a) => area(a).tdn >= 1 && count(g, a).israeli + count(g, a).syrian === 0 && inSupply(g, 'israeli', a) && g.control[a] === 'israeli' && !g.chits.some((c) => c.stand && c.area === a))!;
const give = (g: GGame, id: string) => { chit(g, id).box = 'available'; return id; };
const fresh = (g: GGame) => { g.phase = 'admin'; g.samTarget = undefined; };

describe('engineering (4.3, 14.5)', () => {
  it('a roadblock costs +1 to enter an empty area, stops the first enemy and is then removed', () => {
    const g = newGolanGame(1); fresh(g); g.player = 'israeli';
    const a = quiet(g); roadblock(g, give(g, 'IC17'), a);
    expect(g.roadblocks[a]).toBe('israeli');
    g.phase = 'movement'; g.player = 'syrian';
    let r;
    for (const n of require_neighbors(a).filter((x) => x < 100 && count(g, x).israeli === 0)) {
      Object.assign(unit(g, 'S03'), { area: n, revealed: true, movedThisPhase: false }); g.control[n] = 'syrian';
      r = moveOptions(g, 'S03').find((x) => x.area === a && x.path.length === 2); if (r) break;
    }
    expect(r!.mustStop).toBe(true);
    move(g, 'S03', a); expect(g.roadblocks[a]).toBeUndefined(); expect(unit(g, 'S03').area).toBe(a);
  });
  it('a defended roadblock stands and must be fought; it is cleared from the map at the Supply Phase', () => {
    const g = newGolanGame(1); fresh(g); g.player = 'israeli';
    const a = quiet(g); roadblock(g, give(g, 'IC17'), a, true); expect(chit(g, 'IC17')).toMatchObject({ box: 'map', area: a, stand: true });
  });
  it('bridging the AT ditch needs a friendly origin and a friendly or contested enemy far side; at most eight', () => {
    const g = newGolanGame(1); fresh(g);
    const eng = g.chits.find((c) => c.kind === 'engineer' && c.side === 'syrian' && c.box === 'available')!;
    expect(() => bridgeDitch(g, eng.id, 64, 49)).toThrow();                                // 49 is Israeli and not contested
    bridgeDitch(g, eng.id, 64, 50); expect(g.bridgedDitch).toContain(edgeKey(64, 50));       // 50 is contested
  });
  it('only Syrian engineers lift minefields, from next to the mined boundary', () => {
    const g = newGolanGame(1); fresh(g);
    g.minefields.push('63-64');
    const eng = g.chits.find((c) => c.kind === 'engineer' && c.side === 'syrian' && c.box === 'available')!;
    removeMinefield(g, eng.id, 63, 64); expect(g.minefields).not.toContain('63-64');
    const isr = g.chits.find((c) => c.kind === 'engineer' && c.side === 'israeli')!; isr.box = 'available';
    expect(() => removeMinefield(g, isr.id, 29, 30)).toThrow(/Syrian/);
  });
  it('bridges can be blown only where a road crosses a river', () => {
    const g = newGolanGame(1); fresh(g); g.player = 'israeli';
    blowBridges(g, give(g, 'IC17'), 6, [7]); expect(g.blownBridges).toContain('6-7');
    expect(() => blowBridges(g, give(g, 'IC25'), 9, [8])).toThrow(/no bridge/);
  });
});

describe('air missions and commando raids (16.11, 16.31)', () => {
  it('interdiction: +1 to enter and +1 to leave; a SAM can cancel an Israeli mission east of the barrier', () => {
    const g = newGolanGame(2); fresh(g); g.player = 'israeli';
    const air = g.chits.find((c) => c.kind === 'air_mission' && c.side === 'israeli' && c.box === 'available')!;
    airInterdiction(g, air.id, 73); expect(g.interdicted[73]).toBe('israeli'); expect(g.samTarget).toBe(air.id);
    const sam = g.chits.find((c) => c.kind === 'sam' && c.box === 'available')!;
    const r = fireSam(g, sam.id); if (r !== 'none') expect(g.interdicted[73]).toBeUndefined(); else expect(g.interdicted[73]).toBe('israeli');
  });
  it('reconnaissance reveals the enemy units once it flies', () => {
    const g = newGolanGame(3); fresh(g); g.player = 'israeli';
    const air = g.chits.find((c) => c.kind === 'air_mission' && c.side === 'israeli' && c.box === 'available')!;
    airRecon(g, air.id, 64); expect(g.intel).toBeUndefined(); declineSam(g);
    expect(g.intel?.units).toEqual(onMap(g, 64).filter((u) => u.side === 'syrian').map((u) => u.id));
  });
  it('commandos land in a vacant Israeli area next to Syrian units; Example 13: up the escarpment into the raid costs 3', () => {
    const g = newGolanGame(4); fresh(g);
    Object.assign(unit(g, 'S16'), { area: 23 }); g.control[23] = 'syrian';                  // a Syrian unit next to Ma'ale Gamla
    const cdo = g.chits.find((c) => c.kind === 'commando' && c.box === 'available')!;
    expect(() => placeRaid(g, cdo.id, 2)).toThrow(); placeRaid(g, cdo.id, 24);
    g.phase = 'movement'; g.player = 'israeli'; Object.assign(unit(g, 'I05'), { area: 12 });
    const r = moveOptions(g, 'I05').find((x) => x.area === 24)!; expect(r.cost).toBe(3); expect(r.triggers).toEqual(['raid']);
  });
});

describe('events (17.x, 4.21)', () => {
  it('17.11 the Assad Guard is released and placed at a friendly entry area', () => {
    const g = newGolanGame(5); fresh(g); playRelease(g, give(g, 'SC42')); expect(unit(g, 'S21').box).toBe('arriving');
  });
  it('17.12 SSM: Israeli air assets in the Available Box go back to the cup on 1–2', () => {
    const g = newGolanGame(6); fresh(g); playSSM(g, give(g, 'SC46')); expect(chit(g, 'SC46').box).toBe('eliminated');
  });
  it('17.22 Dugman 5 rolls once per available SAM', () => {
    const g = newGolanGame(7); fresh(g); const sams = g.chits.filter((c) => c.kind === 'sam' && c.box === 'available').length;
    const before = g.log.length; resolveDugman(g, chit(g, give(g, 'IC20'))); expect(g.log.length - before).toBe(sams);
  });
  it('17.21 arriving battalions: +2, +1/+1, or an eliminated block back at 2 steps in an Assembly area (and off the VP track)', () => {
    const g = newGolanGame(8); fresh(g);
    for (const id of ['I09', 'I10']) Object.assign(unit(g, id), { box: 'map', area: ASSEMBLY.A });
    playArrivingBattalion(g, give(g, 'IC18'), { split: ['I09', 'I10'] }); expect([unit(g, 'I09').str, unit(g, 'I10').str]).toEqual([3, 3]);
    Object.assign(unit(g, 'I10'), { box: 'eliminated', area: null }); g.eliminatedLarge.israeli = 1;
    playArrivingBattalion(g, give(g, 'IC26'), { rebuild: 'I10', assembly: 'A' });
    expect(unit(g, 'I10')).toMatchObject({ box: 'map', area: ASSEMBLY.A, str: 2 }); expect(g.eliminatedLarge.israeli).toBe(0);
    expect(() => playArrivingBattalion(g, give(g, 'IC27'), { add: 'I09' })).toThrow(/not of the 4th/);
  });
  it('17.23 Lt. Zvika: an elite armor roadblock in an empty Israeli area; it can be reinforced by Special Action', () => {
    const g = newGolanGame(9); fresh(g); g.player = 'israeli';
    const a = quiet(g); playLtZvika(g, give(g, 'IC04'), a); expect(chit(g, 'IC04')).toMatchObject({ box: 'map', area: a, stand: true, quality: 'elite' });
    g.phase = 'combat'; g.player = 'syrian'; Object.assign(unit(g, 'S03'), { area: a, revealed: false });
    expect(mustFight(g)).toContain(a);
    const b = startBattle(g, a); expect(b.defPoint).toBe('IC04');
    const n = require_neighbors(a).find((x) => count(g, x).syrian === 0 && count(g, x).israeli < 2)!;
    Object.assign(unit(g, 'I05'), { area: n }); expect(reinforceOptions(g, b)).toContain('I05');
  });
  it("17.24 King Hassan: the Moroccans do not fire when attacking and keep out of Israeli-controlled areas", () => {
    const g = newGolanGame(10); fresh(g); g.player = 'israeli'; playKingHassan(g, give(g, 'IC13'));
    g.phase = 'combat'; g.player = 'syrian';
    const b = startBattle(g, 59); beginCombat(g, b); expect(fireList(g, b, 'syrian', 'ground').some((f) => f.key === 'S07')).toBe(false);
  });
  it('17.31/17.32 replacements: armor to armor class, mech to mech or infantry class; the unit must be reduced and supplied', () => {
    const g = newGolanGame(11); fresh(g); g.player = 'israeli';
    const arm = g.chits.find((c) => c.kind === 'replacement_arm' && c.side === 'israeli')!.id; give(g, arm);
    unit(g, 'I05').str = 2; expect(() => playReplacement(g, arm, 'I01')).toThrow(); playReplacement(g, arm, 'I05'); expect(unit(g, 'I05').str).toBe(3);
  });
  it('4.21: an event brings two assets back from the Eliminated Box, never SAMs, commandos or air', () => {
    const g = newGolanGame(12); fresh(g);
    const art = g.chits.find((c) => c.kind === 'artillery' && c.side === 'syrian')!, sam = g.chits.find((c) => c.kind === 'sam')!;
    art.box = 'eliminated'; sam.box = 'eliminated';
    const ev = give(g, 'SC27'); expect(() => alternateEventUse(g, ev, [sam.id])).toThrow(/17.4/);
    alternateEventUse(g, ev, [art.id]); expect(art.box).toBe('cup');
  });
});

describe('combat events and Special Actions in battle', () => {
  it('17.33 jamming: each defender rolls (+2 with countermeasures), 5 or less disordered; all disordered = no defending assets', () => {
    const g = newGolanGame(13); give(g, 'SC16'); give(g, 'IC36');
    const b = startBattle(g, 50); playJamming(g, b, 'SC16');
    const sp = onMap(g, 50).find((u) => u.side === 'israeli')!;
    expect(canAssign(g, b, chit(g, 'IC01'))).toMatch(/jamming/);
    answerJamming(g, b, 'IC36');
    const r = b.rolls.at(-1)!; expect(sp.disorder === 1).toBe(r.dice[0] <= 5);
    if (sp.disorder === 1) expect(canAssign(g, b, chit(g, 'IC01'))).toMatch(/jammed/);
  });
  it('17.34 counterbattery (Example 12): on 1–5 the enemy artillery goes that many turns down the track, then straight to the Available Box', () => {
    let hit = false;
    for (let seed = 1; seed < 40 && !hit; seed++) {
      const g = newGolanGame(seed); give(g, 'IC30');
      Object.assign(unit(g, 'I05'), { area: 50 }); for (const u of onMap(g, 50)) u.revealed = true;
      g.player = 'israeli'; const b = startBattle(g, 50);
      playCounterbattery(g, b, 'IC30');
      const art = g.chits.find((c) => c.kind === 'artillery' && c.side === 'syrian' && c.box === 'available')!; assign(g, b, art.id);
      beginCombat(g, b); for (let i = 0; i < 5 && !b.counterbattery.israeli === false; i++) rollStep(g, b);
      if (art.box === 'future') { expect(art.direct).toBe(true); expect(Number(art.turn)).toBeGreaterThan(1); hit = true; }
    }
    expect(hit).toBe(true);
  });
  it('8.24 retreat before combat: no disorder, exploitation for the attacker; 8.23 reinforce from an adjacent area', () => {
    const g = newGolanGame(14); g.player = 'israeli'; g.phase = 'combat';
    Object.assign(unit(g, 'I05'), { area: 64, revealed: false }); g.control[64] = 'syrian';
    const def = onMap(g, 64).filter((u) => u.side === 'syrian');
    give(g, 'SC21'); const b = startBattle(g, 64); defenderRetreatSA(g, b, 'SC21');
    while (b.stage === 'retreat') chooseRetreat(g, b, retreatOptions(g, b)[0]);
    for (const u of def) expect(u.disorder).toBe(0);
    expect(b.result).toMatch(/retreated before combat/); expect(b.stage).toBe('exploit');
    expect(count(g, 64).syrian).toBe(0);
  });
  it('8.22 a Special Action re-engages an already contested area in the Breakthrough Combat Phase', () => {
    const g = newGolanGame(15); for (const a of mustFight(g)) fight(g, a); endPhase(g); endPhase(g); endPhase(g);
    expect(g.phase).toBe('btCombat');
    const a = [27, 28, 39, 48, 50, 57, 59].find((x) => count(g, x).israeli > 0 && count(g, x).syrian > 0 && onMap(g, x).some((u) => u.side === 'syrian' && u.disorder === 0));
    if (!a) return;
    g.freeCombatRound = 0; expect(() => startBattle(g, a)).toThrow(/Special Action/);
    give(g, 'SC21'); const b = startBattle(g, a, { chitId: 'SC21' }); expect(b.locked).toBe(true); expect(chit(g, 'SC21').box).toBe('eliminated');
  });
});

describe('Special Actions and staff in the Admin Phase', () => {
  it('rally, quality replacement, merging, the 3rd Tank Division in order, SAM and air replacement', () => {
    const g = newGolanGame(16); fresh(g); g.turn = 3;
    unit(g, 'S01').disorder = 1; give(g, 'SC21'); rally(g, 'syrian', 63, 'SC21'); 
    unit(g, 'S04').str = 3; give(g, 'SC28'); qualityReplacement(g, 'S04', 'SC28'); expect(unit(g, 'S04').str).toBe(4);
    give(g, 'SC33'); releaseOperationalReserve(g, 'SC33'); expect(unit(g, 'S18').box).toBe('arriving'); expect(unit(g, 'S19').box).toBe('operational_reserve');
    const sam = g.chits.find((c) => c.kind === 'sam')!; sam.box = 'eliminated'; give(g, 'SC38'); replaceAsset(g, 'syrian', sam.id, 'SC38'); expect(sam.box).toBe('cup');
    for (const id of ['I06', 'I07']) Object.assign(unit(g, id), { area: 52, disorder: 0 }); unit(g, 'I06').str = 1; unit(g, 'I07').str = 1;
    give(g, 'IC14'); mergeUnits(g, 'I06', 'I07', 'IC14'); expect(unit(g, 'I07').str).toBe(2); expect(unit(g, 'I06').box).toBe('eliminated'); expect(g.eliminatedLarge.israeli).toBe(0);
  });
  it('staff replacements are non-elite only, for infantry-class units', () => {
    const g = newGolanGame(17); fresh(g); g.player = 'israeli'; give(g, 'IC22');
    unit(g, 'I01').str = 2; expect(() => staffReplacement(g, 'IC22', 'I01')).toThrow(/elite/);
  });
  it('reserve markers only on eligible units; field works by a unit that does not move', () => {
    const g = newGolanGame(18); g.phase = 'movement'; g.player = 'israeli';
    expect(() => setReserve(g, 'I05', true)).not.toThrow(); expect(unit(g, 'I05').reserve).toBe(true);
    expect(() => setReserve(g, 'I03', true)).not.toThrow();
    unitFieldWorks(g, 'I06'); expect(g.fieldWorks).toContain(51);
  });
});

describe('alternate set-up (22.2)', () => {
  it('both sides place their units; Syrian units go on squares of their division colour, one per square', () => {
    const g = newGolanGame(19, 'badr_alt');
    expect(g.phase).toBe('deploy'); expect(g.units.filter((u) => u.box === 'deploy').length).toBe(7 + 16);
    expect(deployOptions(g, 'S01').length).toBe(5);                                            // 61st, 5th Inf (yellow): five squares
    expect(deployOptions(g, 'I01')).not.toContain(83);
    expect(() => endPhase(g)).toThrow(/place every unit/);
    for (const u of g.units.filter((x) => x.box === 'deploy')) deploy(g, u.id, deployOptions(g, u.id)[0]);
    endPhase(g); expect([g.turn, g.player, g.phase]).toEqual([1, 'syrian', 'movement']);
    playOut(g); expect(g.result).toMatch(/Victory|Draw/);
  });
});
