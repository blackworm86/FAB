import { describe, expect, it } from 'vitest';
import { newGame, startBattle, mustFight, type Game } from '../src';
import { toPublic, compose, secretsOf, revealsIn, freshReveals, isPlaceholder, setReady, type Priv } from '../src';
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

describe('reveals stay current', () => {
  it('publishes a block again when its details changed, so a second battle shows the new strength', () => {
    const g = newGame(5); g.phase = 'combat'; g.phasing = 'german'; const area = mustFight(g)[0] ?? 11;
    const first = revealsIn(g, 'allied', area, 'sa'), u = g.units.find((x) => x.side === 'allied' && x.area === area && !x.garrison)!;
    expect(Object.keys(freshReveals({}, first)).length).toBe(Object.keys(first).length);
    expect(Object.keys(freshReveals(first, revealsIn(g, 'allied', area, 'sa'))).length).toBe(0);             // nothing changed: nothing to publish
    u.str = Math.max(1, u.str - 1);
    const now = revealsIn(g, 'allied', area, 'sa'), changed = freshReveals(first, now);
    expect(Object.values(changed).some((r) => r.id === u.id && r.str === u.str)).toBe(u.str !== (Object.values(first).find((r) => r.id === u.id)!.str));
  });
});

import { SplitSeat, initSplit, beginCombat, neighbors } from '../src';
describe('two seats play a split table', () => {
  it('hides, reveals at battle, hides again, and shows the updated strength in a later battle', () => {
    const g0 = newGame(5); g0.phase = 'combat'; g0.phasing = 'german'; const area = mustFight(g0)[0] ?? 11;
    const sp = initSplit(g0, 'sg', 'sa');
    let pub = sp.pub, reveals = {} as Record<string, never>;
    const ger = new SplitSeat('german'), al = new SplitSeat('allied'); ger.priv = sp.german; al.priv = sp.allied;
    const play = (seat: SplitSeat, other: SplitSeat, f: (g: Game) => void) => {
      const g = seat.open(JSON.parse(pub) as Game); f(g);
      const out = seat.save(g); pub = out.pub; const fresh = seat.due(g); Object.assign(reveals, fresh); ger.reveals = { ...reveals }; al.reveals = { ...reveals }; void other;
    };
    play(ger, al, (g) => { startBattle(g, area); });
    play(ger, al, (g) => setReady(g, g.battle!, 'german'));
    play(al, ger, (g) => setReady(g, g.battle!, 'allied'));
    // both ready: each side's blocks in the area are published, then the attacker begins combat on a game where all of them are known
    play(ger, al, (g) => { const foe = g.units.filter((u) => u.side === 'allied' && u.area === area && !u.garrison); expect(foe.length).toBeGreaterThan(0); expect(foe.every((u) => !isPlaceholder(u))).toBe(true); beginCombat(g, g.battle!); });
    const seen = ger.open(JSON.parse(pub) as Game); expect(seen.units.filter((u) => u.area === area && isPlaceholder(u)).length).toBe(0);
    // the Allied block loses a step, retreats and is hidden again
    let id = '';
    play(al, ger, (g) => { const u = g.units.find((x) => x.side === 'allied' && x.area === area && !x.garrison && x.str > 1) ?? g.units.find((x) => x.side === 'allied' && x.area === area && !x.garrison)!; id = u.id; u.str = Math.max(1, u.str - 1); g.battle = null; const to = neighbors(area).find((n) => !g.units.some((x) => x.area === n))!; u.area = to; u.up = undefined; });
    const after = ger.open(JSON.parse(pub) as Game), moved = after.units.find((u) => u.id === id)!;
    expect(moved.area).not.toBe(area);
    expect(JSON.stringify(JSON.parse(pub))).not.toContain(`"id":"${id}"`);               // the shared copy no longer names it
    // a later battle where it stands: the reveal carries its new strength
    const target = moved.area!;
    play(ger, al, (g) => { const mine = g.units.find((u) => u.side === 'german' && u.area != null && !u.garrison)!; mine.area = target; g.phase = 'combat'; g.phasing = 'german'; startBattle(g, target); setReady(g, g.battle!, 'german'); });
    play(al, ger, (g) => { setReady(g, g.battle!, 'allied'); });
    const later = ger.open(JSON.parse(pub) as Game), now = later.units.find((u) => u.id === id)!;
    const truth = al.open(JSON.parse(pub) as Game).units.find((u) => u.id === id)!;
    expect(isPlaceholder(now)).toBe(false); expect(now.str).toBe(truth.str);            // not the strength it had when it was first revealed
  });
});
