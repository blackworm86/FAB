import { describe, expect, it } from 'vitest';
import * as E from '../src';

/** Play with each step written by the side that has to act, and check every step the way the other browser does. */
function playChecked(seed: number, steps: number) {
  const g = E.newGame(seed);
  const problems: string[] = [];
  const step = (f: () => void) => {
    const prev = structuredClone(g),
      a = E.actorOf(g),
      w = a === 'both' ? g.phasing : a;
    f();
    problems.push(...E.auditChange(prev, g, w));
  };
  for (let i = 0; i < steps && !g.over; i++) {
    for (const ar of E.mustFight(g)) {
      let b!: E.Battle;
      step(() => {
        b = E.startBattle(g, ar);
      });
      step(() => E.beginCombat(g, b));
      for (let k = 0; k < 90 && b.stage !== 'done'; k++)
        step(() => {
          if (b.stage === 'attChoice') E.attackerChoice(g, b, false);
          else if (b.stage === 'defChoice') E.defenderChoice(g, b, false);
          else if (b.stage === 'attFirst') E.chooseFirstLoss(g, b, b.attPoint);
          else if (b.stage === 'retreat') E.chooseRetreat(g, b, E.retreatOptions(g, b)[0]);
          else if (b.stage === 'exploit') E.declineExploit(g, b);
          else E.roll_step(g, b);
        });
      step(() => E.closeBattle(g));
    }
    step(() => {
      E.autoRecover(g);
      E.endPhase(g);
    });
  }
  return { g, problems };
}

describe('referee-lite: checking what the other browser wrote', () => {
  it('honest play is never flagged', () => {
    for (const seed of [1, 2, 3]) expect(playChecked(seed, 40).problems).toEqual([]);
  });
  it('flags dice that were undone or changed', () => {
    const { g } = playChecked(4, 3),
      prev = structuredClone(g),
      next = structuredClone(g);
    next.rolls = prev.rolls - 1;
    expect(E.auditChange(prev, next, 'german').join()).toMatch(/dice counter/);
  });
  it('flags a game sent back in time', () => {
    const { g } = playChecked(5, 30),
      prev = structuredClone(g),
      next = structuredClone(g);
    expect(prev.turn).toBeGreaterThan(1);
    next.turn = prev.turn - 1;
    next.log = [...prev.log];
    expect(E.auditChange(prev, next, prev.phasing).join()).toMatch(/went back/);
  });
  it("a restore (the other player's rules check put the game back) is not flagged as going back", () => {
    const { g } = playChecked(5, 30),
      back = structuredClone(g);
    const now = structuredClone(g);
    now.turn = g.turn + 1; // the change the check refused
    back.restored = { t: 1, why: ['The dice counter went backwards: rolls were undone.'] };
    expect(E.isRestore(now, back)).toBe(true);
    expect(E.auditChange(now, back, g.phasing)).toEqual([]);
    const again = structuredClone(back);
    again.turn = g.turn - 1; // the same restore marker again is an ordinary write
    expect(E.isRestore(back, again)).toBe(false);
    expect(E.auditChange(back, again, g.phasing).join()).toMatch(/went back/);
  });
  it('flags a change by the side that was not supposed to act', () => {
    const g = E.newGame(6);
    g.phase = 'movement';
    g.phasing = 'german';
    const next = structuredClone(g);
    next.units.find((u) => u.side === 'allied' && u.area != null)!.area = 47;
    expect(E.auditChange(g, next, 'allied').join()).toMatch(/Allied player changed the game while it was the German/);
    expect(E.auditChange(g, next, 'german')).toEqual([]);
  });
  it('a block hidden again by its owner out of turn is no move, but a changed morale-check record is', () => {
    const g = E.newGame(6);
    g.phase = 'movement';
    g.phasing = 'german';
    const u = g.units.find((x) => x.side === 'allied' && x.area != null && !x.garrison)!;
    g.checks = [{ who: u.name, sn: 5, die: 3, ok: true } as unknown as NonNullable<E.Game['checks']>[number]];
    const hiddenAgain = JSON.parse(JSON.stringify(g).split(JSON.stringify(u.id)).join('"h0123"')) as E.Game;
    Object.assign(hiddenAgain.units.find((x) => x.id === 'h0123')!, { name: 'Hidden block', str: 1, max: 1 });
    hiddenAgain.checks![0].who = 'a hidden block';
    expect(E.auditChange(g, hiddenAgain, 'allied')).toEqual([]);
    const dice = structuredClone(g);
    (dice.checks![0] as unknown as { die: number }).die = 9;
    expect(E.auditChange(g, dice, 'allied').join()).toMatch(/Allied player changed the game/);
  });
});
