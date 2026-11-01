import { describe, expect, it } from 'vitest';
import { newGame, startBattle, mustFight, type Game } from '../src';
import { toPublic, compose, secretsOf, revealsIn, isPlaceholder, setReady, type Priv } from '../src';
describe('split hidden blocks (no server)', () => {
  const SG = 'salt-g', SA = 'salt-a';
  it('keeps each seat\'s block details out of the shared copy and puts them back for their owner', () => {
    const { g, area } = (() => { const x = newGame(5); x.phase = 'combat'; x.phasing = 'german'; return { g: x, area: mustFight(x)[0] ?? 11 }; })();
    const pubG = toPublic(g, 'german', SG, new Map());
    const pub = JSON.parse(toPublic(JSON.parse(pubG) as Game, 'allied', SA, new Map())) as Game;     // both sides' clients hide their own
    const own = g.units.find((u) => u.side === 'german' && u.area != null && !u.garrison)!;
    expect(JSON.stringify(pub)).not.toContain(own.name);
    const privG: Priv = { salt: SG, secrets: secretsOf(g, 'german') };
    const mine = compose(pub, 'german', privG, {}).game, back = mine.units.find((u) => u.id === own.id)!;
    expect(back.name).toBe(own.name); expect(back.str).toBe(own.str);
    const theirs = mine.units.find((u) => u.side === 'allied' && u.area === area && !u.garrison)!;
    expect(isPlaceholder(theirs)).toBe(true);                                              // the German seat cannot read Allied blocks
  });
  it('reveals a battle area through the reveals document, then combat can begin', () => {
    const g = newGame(5); g.phase = 'combat'; g.phasing = 'german'; g.deferBegin = true; const area = mustFight(g)[0] ?? 11;
    const b = startBattle(g, area); setReady(g, b, 'german'); setReady(g, b, 'allied'); expect(b.stage).toBe('setup');
    const reveals = revealsIn(g, 'allied', area, SA);
    const pub = JSON.parse(toPublic(g, 'allied', SA, new Map())) as Game;
    const { game } = compose(pub, 'german', { salt: SG, secrets: secretsOf(g, 'german') }, reveals);
    const foe = game.units.find((u) => u.side === 'allied' && u.area === area && !u.garrison)!; expect(isPlaceholder(foe)).toBe(false);
  });
});
