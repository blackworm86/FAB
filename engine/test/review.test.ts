import { describe, expect, it } from 'vitest';
import * as E from '../src';

describe('6.8 exploitation is rolled by the attacker', () => {
  const setup = () => {
    const g = E.newGame(1, { scenario: 'campaign' });
    const gar = g.units.find((u) => u.garrison && u.side === 'allied' && u.area != null)!, arm = g.units.find((u) => u.side === 'german' && u.cls === 'armor' && !u.garrison && u.max >= 3)!;
    for (const u of g.units) if (u.area === gar.area && u !== gar) u.area = null;
    arm.area = gar.area; arm.str = arm.max; arm.disorder = 0; g.phase = 'combat'; g.phasing = 'german'; g.force = [1, 1, 1, 1, 1, 1];
    const b = E.startBattle(g, gar.area!); E.beginCombat(g, b);
    for (let i = 0; i < 20 && !['exploit', 'done'].includes(b.stage); i++) { if (b.stage === 'defChoice') E.defenderChoice(g, b, false); else if (b.stage === 'attChoice') E.attackerChoice(g, b, false); else E.roll_step(g, b); }
    return { g, b, arm };
  };
  it('stops at the exploit stage until the attacker rolls', () => {
    const { g, b, arm } = setup(); expect(b.stage).toBe('exploit'); expect(arm.exploit).toBe(false);
    g.force = [3]; E.roll_step(g, b); expect(b.stage).toBe('done'); expect(arm.exploit).toBe(true); expect(b.rolls.at(-1)!.kind).toBe('morale');
  });
  it('can be declined', () => { const { g, b, arm } = setup(); E.declineExploit(g, b); expect(b.stage).toBe('done'); expect(arm.exploit).toBe(false); });
});

describe('16.12 German artillery attrition is the German player\'s choice', () => {
  it('asks for a choice when two regular artillery assets are in the Used Box', () => {
    const g = E.newGame(2);
    while (g.turn === 1) { E.autoRecover(g); for (const a of E.mustFight(g)) { const b = E.startBattle(g, a); E.beginCombat(g, b); for (let i = 0; i < 90 && b.stage !== 'done'; i++) { if (b.stage === 'attChoice') E.attackerChoice(g, b, false); else if (b.stage === 'defChoice') E.defenderChoice(g, b, false); else if (b.stage === 'attFirst') E.chooseFirstLoss(g, b, b.attPoint); else if (b.stage === 'retreat') E.chooseRetreat(g, b, E.retreatOptions(g, b)[0]); else if (b.stage === 'exploit') E.declineExploit(g, b); else E.roll_step(g, b); } E.closeBattle(g); } E.endPhase(g); }
    expect(g.phase).toBe('reinforcement');
    // put two regular artillery in the Used Box and replay the recycling
    const arts = g.chits.filter((c) => c.side === 'german' && c.kind === 'artillery').slice(0, 2); arts.forEach((c) => (c.box = 'used'));
    g.recover = ['german']; E.recoverAsset(g, 'german', null);
    expect(g.artyPick).toBe(true); expect(() => E.endPhase(g)).toThrow(/16.12/);
    E.chooseArtyLoss(g, arts[1].id);
    expect(arts[1].box).toBe('eliminated'); expect(arts[0].box).toBe('cup'); expect(g.artyPick).toBe(false);
  });
});

describe('4.35 defended roadblock uses the engineer chit', () => {
  it('names the block after the engineer', () => {
    const g = E.newGame(3); g.phase = 'admin';
    for (const c of g.chits.filter((x) => x.kind === 'engineer')) {
      c.box = 'available'; const a = E.roadblockAreas(g, c.side).find((x) => E.assetZoneOk(g, c, x)); if (a == null) continue;
      E.roadblock(g, c.id, a, true); const u = g.units.find((x) => x.id === `DR-${c.id}`)!;
      expect(u.chitId).toBe(c.id); expect(u.name).toContain(c.name); return;
    }
    throw new Error('no roadblock area found');
  });
});
