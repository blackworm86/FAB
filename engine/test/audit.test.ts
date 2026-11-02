import { describe, expect, it } from 'vitest';
import * as E from '../src';

/** Play with each step written by the side that has to act, and check every step the way the other browser does. */
function playChecked(seed: number, steps: number) {
  const g = E.newGame(seed); const problems: string[] = [];
  const step = (f: () => void) => { const prev = structuredClone(g), a = E.actorOf(g), w = a === 'both' ? g.phasing : a; f(); problems.push(...E.auditChange(prev, g, w)); };
  for (let i = 0; i < steps && !g.over; i++) {
    for (const ar of E.mustFight(g)) {
      let b!: E.Battle; step(() => { b = E.startBattle(g, ar); }); step(() => E.beginCombat(g, b));
      for (let k = 0; k < 90 && b.stage !== 'done'; k++) step(() => { if (b.stage === 'attChoice') E.attackerChoice(g, b, false); else if (b.stage === 'defChoice') E.defenderChoice(g, b, false); else if (b.stage === 'attFirst') E.chooseFirstLoss(g, b, b.attPoint); else if (b.stage === 'retreat') E.chooseRetreat(g, b, E.retreatOptions(g, b)[0]); else if (b.stage === 'exploit') E.declineExploit(g, b); else E.roll_step(g, b); });
      step(() => E.closeBattle(g));
    }
    step(() => { E.autoRecover(g); E.endPhase(g); });
  }
  return { g, problems };
}

describe('referee-lite: checking what the other browser wrote', () => {
  it('honest play is never flagged', () => {
    for (const seed of [1, 2, 3]) expect(playChecked(seed, 40).problems).toEqual([]);
  });
  it('flags dice that were undone or changed', () => {
    const { g } = playChecked(4, 3), prev = structuredClone(g), next = structuredClone(g);
    next.rolls = prev.rolls - 1; expect(E.auditChange(prev, next, 'german').join()).toMatch(/dice counter/);
  });
  it('flags a game sent back in time', () => {
    const { g } = playChecked(5, 30), prev = structuredClone(g), next = structuredClone(g);
    expect(prev.turn).toBeGreaterThan(1); next.turn = prev.turn - 1; next.log = [...prev.log]; expect(E.auditChange(prev, next, prev.phasing).join()).toMatch(/went back/);
  });
  it('flags a change by the side that was not supposed to act', () => {
    const g = E.newGame(6); g.phase = 'movement'; g.phasing = 'german';
    const next = structuredClone(g); next.units.find((u) => u.side === 'allied' && u.area != null)!.area = 47;
    expect(E.auditChange(g, next, 'allied').join()).toMatch(/Allied player changed the game while it was the German/);
    expect(E.auditChange(g, next, 'german')).toEqual([]);
  });
});
