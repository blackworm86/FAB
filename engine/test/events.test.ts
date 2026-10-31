import { describe, expect, it } from 'vitest';
import { chooseFirstLoss, newGame, endPhase as endPhaseRaw, autoRecover, mustFight, startBattle, beginCombat, roll_step, attackerChoice, defenderChoice, chooseRetreat, retreatOptions, closeBattle, moveOptions, move, resolveBlow, boxOf, chit, playGreifBridge, playInterdict,
  playBodenplatte, heydteDrop, heydteWindow, buildFieldWorks, unitsIn, setReserve, canReserve, type Game } from '../src';
const endPhase = (g: Game) => { autoRecover(g); endPhaseRaw(g); };

function toAdmin(seed: number, turn = 2, campaign = false): Game {
  const g = newGame(seed, campaign ? { scenario: 'campaign' } : {});
  for (const a of mustFight(g)) { const b = startBattle(g, a); beginCombat(g, b); for (let i = 0; i < 90 && b.stage !== 'done'; i++) { if (b.stage === 'attChoice') attackerChoice(g, b, false); else if (b.stage === 'defChoice') defenderChoice(g, b, true); else if (b.stage === 'attFirst') chooseFirstLoss(g, b, b.attPoint); else if (b.stage === 'retreat') chooseRetreat(g, b, retreatOptions(g, b)[0]); else roll_step(g, b); } closeBattle(g); }
  while (!(g.turn === turn && g.phase === 'admin')) endPhase(g);
  return g;
}
const give = (g: Game, kind: string, side: 'german' | 'allied') => { const c = g.chits.find((x) => x.kind === kind && x.side === side && x.box !== 'available')!; c.box = 'available'; return c; };

describe('Bulge events', () => {
  it('Greif Team Bridge: blowing it needs a 1 (17.12), and the event leaves play when the bridge goes', () => {
    let blown = 0, tries = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const g = toAdmin(5, 2); g.seed = seed; g.rolls = 0;
      const c = give(g, 'event_greif_bridge', 'german'); playGreifBridge(g, c.id, 21, 37);
      expect(c.box).toBe('map');
      g.phase = 'movement'; g.blowTried = [];
      g.pendingBlow = { unit: g.units.find((u) => u.name === '2 Pz')!.id, path: [21, 37] };
      resolveBlow(g, true); tries++;
      const rolled = Number(/rolled (\d+)/.exec(g.log.filter((l) => l.includes('bridge') && l.includes('rolled')).pop()!)![1]);
      const isBlown = g.blown.includes('21-37'); expect(isBlown).toBe(rolled === 1); if (isBlown) { blown++; expect(c.box).toBe('eliminated'); }
    }
    expect(blown).toBeGreaterThan(3); expect(blown).toBeLessThan(tries / 3);       // about 10 %
  });
  it('Greif Interdict: first move attempt rolls morale +2, the marker goes away, a failure limits the unit to one area', () => {
    let fails = 0, passes = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const g = toAdmin(6, 2); g.seed = seed; g.rolls = 0;
      const c = give(g, 'event_greif_interdict', 'german'), u = g.units.find((x) => x.side === 'allied' && x.area != null && !x.garrison && moveOptions({ ...g, phase: 'movement', phasing: 'allied' } as Game, x.id).some((o) => o.path.length > 2))!;
      playInterdict(g, c.id, u.id); expect(u.interdict).toBe(c.id);
      g.phase = 'movement'; g.phasing = 'allied'; g.units.forEach((x) => (x.moved = false));
      const far = moveOptions(g, u.id).find((o) => o.path.length > 2)!, r = move(g, u.id, far.area);
      expect(u.interdict).toBeUndefined(); expect(c.box).toBe('eliminated');
      if (r === 'interdict') { fails++; expect(u.adjOnly).toBe(true); expect(u.area).not.toBe(far.area); expect(moveOptions(g, u.id).every((o) => o.path.length === 2)).toBe(true); } else passes++;
    }
    expect(fails).toBeGreaterThan(0); expect(passes).toBeGreaterThan(0);
  });
  it('Bodenplatte: each Allied air mission rolls 1-5 unaffected, 6-9 back to the cup, 10 eliminated (Player Aid D)', () => {
    const g = toAdmin(7, 2, true), c = give(g, 'event_bodenplatte', 'german');
    const air = g.chits.filter((x) => x.kind === 'air_mission').slice(0, 12); air.forEach((x) => (x.box = 'available'));
    playBodenplatte(g, c.id);
    const log = g.log.filter((l) => l.includes('Bodenplatte vs'));
    expect(log).toHaveLength(12);
    air.forEach((x, i) => { const r = Number(/rolled (\d+)/.exec(log[i])![1]); expect(x.box).toBe(r === 10 ? 'eliminated' : r >= 6 ? 'cup' : 'available'); });
    expect(c.box).toBe('eliminated');
  });
  it('von der Heydte: drop only in the Admin Phase it was drawn, revealed by the first American entry, relieved by a German block', () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const g = toAdmin(8, 2); g.seed = seed; g.rolls = 0;
      const h = g.chits.find((x) => x.name === 'v.d. Heydte')!; h.box = 'cup'; h.drawn = undefined; expect(heydteWindow(g, h)).toBe(false);
      h.box = 'available'; h.drawn = g.turn * 10 + 1; expect(heydteWindow(g, h)).toBe(true);
      g.units.filter((u) => u.area === 52).forEach((u) => (u.area = null)); g.control[52] = 'allied'; heydteDrop(g, h.id, 52);
      const hd = g.units.find((u) => u.heydte)!; expect(hd.paradrop).toBe('pending'); expect(h.box).toBe('map');
      const al = g.units.find((u) => u.side === 'allied' && !u.garrison && u.area != null)!; al.area = 53; g.control[53] = 'allied'; g.phase = 'movement'; g.phasing = 'allied'; g.units.forEach((u) => (u.moved = false));
      expect(moveOptions(g, al.id).some((o) => o.area === 52)).toBe(true);
      move(g, al.id, 52); outcomes.add(hd.area == null ? 'scattered' : hd.paradrop!);
      if (hd.area == null) expect(h.box).toBe('eliminated'); else expect(hd.paradrop).not.toBe('pending');
      if (hd.paradrop === 'partial') expect(g.units.find((u) => u === hd)!.paradrop).toBe('partial');
    }
    expect([...outcomes].sort()).toEqual(['intact', 'partial', 'scattered']);
    const g = toAdmin(8, 2), h = g.chits.find((x) => x.name === 'v.d. Heydte')!; h.box = 'available'; h.drawn = g.turn * 10 + 1; g.units.filter((u) => u.area === 31).forEach((u) => (u.area = null)); g.control[31] = 'allied'; heydteDrop(g, h.id, 31);
    const hd = g.units.find((u) => u.heydte)!, ger = g.units.find((u) => u.side === 'german' && !u.garrison && u.area != null)!;
    ger.area = 30; g.control[30] = 'german'; g.phase = 'movement'; g.phasing = 'german'; g.units.forEach((u) => (u.moved = false));
    if (moveOptions(g, ger.id).some((o) => o.area === 31)) { move(g, ger.id, 31); expect(hd.area).toBeNull(); expect(h.box).toBe('used'); }
  });
  it('units can build field works (5.23) once, in an uncontested area', () => {
    const g = toAdmin(9, 2); endPhase(g);
    const u = g.units.find((x) => x.side === 'german' && x.area != null && !x.garrison && !x.unsupplied && x.disorder === 0 && !g.fieldWorks.includes(x.area!) && unitsIn(g, x.area!, 'allied').length === 0)!;
    buildFieldWorks(g, u.id); expect(g.fieldWorks).toContain(u.area); expect(u.moved).toBe(true);
    expect(() => buildFieldWorks(g, u.id)).toThrow(); void setReserve; void canReserve; void boxOf; void chit;
  });
});
