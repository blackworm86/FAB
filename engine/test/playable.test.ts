// playable(g): the check the owner's admin tools run after a free edit of the game.
import { describe, expect, it } from 'vitest';
import * as E from '../src';

const SCEN: [string, string[]][] = [
  ['bulge', ['intro', 'tournament', 'campaign', 'cold']],
  ['golan73', ['badr', 'badr_alt', 'nafakh', 'alowda']],
  ['sicily', ['sunrise_bridge', 'tournament', 'campaign', 'campaign_hist']],
];
describe('playable: the admin tools check', () => {
  for (const [game, list] of SCEN)
    for (const scenario of list)
      it(`${game} ${scenario}: the starting position is playable`, () => {
        E.useGame(game);
        const g = E.newGame(1, { scenario } as never);
        expect(E.playable(g).refuse).toEqual([]);
      });
  it('refuses the edits the engine cannot continue from', () => {
    E.useGame('bulge');
    const g = E.newGame(1, { scenario: 'tournament' } as never);
    const a = E.mustFight(g)[0];
    const b = E.startBattle(g, a);
    if (b.defSA) E.passSA(g, b);
    E.setReady(g, b, 'german');
    E.setReady(g, b, 'allied');
    E.beginCombat(g, b);
    expect(E.playable(g).refuse).toEqual([]);
    const g1 = structuredClone(g);
    for (const u of E.unitsIn(g1, a, 'german')) u.area = null; // the attackers lifted off
    expect(E.playable(g1).refuse.join(' ')).toMatch(/no attacking block/);
    const g2 = structuredClone(g);
    g2.phase = 'movement'; // a jump during a battle
    expect(E.playable(g2).refuse.join(' ')).toMatch(/battle is open/);
    const g3 = structuredClone(g);
    g3.battle = null;
    g3.units.find((u) => u.area != null)!.str = 0; // strength 0 without elimination
    expect(E.playable(g3).refuse.join(' ')).toMatch(/no step left/);
    const g4 = structuredClone(g);
    const art = g4.chits.find((c) => c.box === 'available' && E.isArty(c) && c.side === 'german');
    if (art) {
      g4.battle!.assets.german.push(art.id); // a chit in the battle but left in its box
      expect(E.playable(g4).refuse.join(' ')).toMatch(/sits in the available box/);
    }
  });
  it('warns on unusual but playable positions', () => {
    E.useGame('bulge');
    const g = E.newGame(1, { scenario: 'tournament' } as never);
    const a = g.units.find((u) => u.side === 'german' && u.area != null)!.area!;
    for (const u of g.units.filter((x) => x.side === 'german' && x.area == null && !x.garrison).slice(0, 3))
      Object.assign(u, { area: a, str: u.max, box: undefined });
    expect(E.playable(g).refuse).toEqual([]);
    expect(E.playable(g).warn.join(' ')).toMatch(/over the stacking limit/);
  });
});
