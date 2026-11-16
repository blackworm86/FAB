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
  it("a restore (the other player's rules check put the game back) is the position held before; the marker alone switches no check off", () => {
    const { g } = playChecked(5, 30),
      back = structuredClone(g);
    const now = structuredClone(g);
    now.turn = g.turn + 1; // the change the check refused
    back.restored = { t: 1, why: ['The dice counter went backwards: rolls were undone.'] };
    back.log.push('a line more');
    expect(E.isRestore(now, back)).toBe(true);
    expect(E.samePosition(g, back)).toBe(true); // what the receiving browser asks before it takes it as a restore
    expect(E.samePosition(now, back)).toBe(false);
    const cheat = structuredClone(back); // a modified browser writes the marker on a position of its own making
    cheat.rolls = g.rolls - 1;
    expect(E.samePosition(g, cheat)).toBe(false);
    expect(E.auditChange(g, cheat, g.phasing).join()).toMatch(/dice counter/);
    expect(E.auditChange(now, back, g.phasing).join()).toMatch(/went back/); // (audit, finding 4: the marker used to return "no problem")
  });
  it('the same position whatever the order of its fields and the codes and places of hidden blocks', () => {
    const g = E.newGame(6),
      pub = JSON.parse(E.toPublic(g, 'allied', 's1', new Map())) as E.Game,
      other = JSON.parse(E.toPublic(g, 'allied', 's2', new Map())) as E.Game,
      at = other.units.flatMap((u, i) => (E.isPlaceholder(u) ? [i] : []));
    expect(at.length).toBeGreaterThan(10);
    const [a, b] = [at.find((i) => other.units[i].area !== other.units[at[0]].area)!, at[0]];
    [other.units[a], other.units[b]] = [other.units[b], other.units[a]]; // two hidden blocks change places
    expect(E.samePosition(pub, Object.fromEntries(Object.entries(other).reverse()) as unknown as E.Game)).toBe(true);
    other.units[a].area = other.units[b].area;
    expect(E.samePosition(pub, other)).toBe(false);
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
