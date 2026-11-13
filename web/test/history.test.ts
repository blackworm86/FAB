import { describe, expect, it } from 'vitest';
import { History } from '../src/history';

const game = () => ({
  rolls: 0,
  x: 1,
  y: 'a',
  log: [] as string[],
  units: [
    { id: 'a', area: 1 },
    { id: 'b', area: 2 },
  ],
});
type G = ReturnType<typeof game>;
describe('undo', () => {
  it('restores the game after a plain action', () => {
    const h = new History<G>();
    let g = game();
    g = h.run(
      g,
      () => {
        g.x = 2;
      },
      'two',
    ).game;
    g = h.run(
      g,
      () => {
        g.x = 3;
      },
      'three',
    ).game;
    expect(h.label).toBe('three');
    g = h.undo(g).game!;
    expect(g.x).toBe(2);
    g = h.undo(g).game!;
    expect(g.x).toBe(1);
    expect(h.undo(g).game).toBeNull();
  });
  it('locks once a die is rolled or something is revealed, with the reason', () => {
    const h = new History<G>();
    let g = game();
    g = h.run(g, () => {
      g.x = 2;
    }).game;
    expect(h.length).toBe(1);
    g = h.run(g, () => {
      g.rolls++;
      g.x = 3;
    }).game;
    expect(h.length).toBe(0);
    expect(h.undo(g).why).toMatch(/dice/);
    g = h.run(
      g,
      () => {
        g.y = 'b';
      },
      '',
      (a, b) => (a.y !== b.y ? 'blocks revealed' : ''),
    ).game;
    expect(h.lock).toBe('blocks revealed');
  });
  it('survives the other player changing other pieces, and refuses when they touched the same one', () => {
    const h = new History<G>();
    let g = game();
    g = h.run(g, () => {
      g.units[0].area = 5;
      g.log.push('a moved');
    }).game;
    let r = JSON.parse(JSON.stringify(g)) as G;
    r.units[1].area = 9;
    r.log.push('b moved');
    h.remote(g, r);
    g = r;
    g = h.undo(g).game!;
    expect(g.units[0].area).toBe(1);
    expect(g.units[1].area).toBe(9);
    expect(g.log.length).toBe(2);
    g = h.run(g, () => {
      g.units[0].area = 5;
    }).game;
    r = JSON.parse(JSON.stringify(g)) as G;
    r.units[0].area = 7;
    h.remote(g, r);
    expect(h.undo(r).game).toBeNull();
  });
  it('rolls the game back when an action throws, and does not record it', () => {
    const h = new History<G>();
    const g0 = game();
    const r = h.run(g0, () => {
      g0.x = 99;
      throw new Error('illegal');
    });
    expect(r.error?.message).toBe('illegal');
    expect(r.game.x).toBe(1);
    expect(h.length).toBe(0);
  });
  it('is not fooled by the same piece coming back with its keys in another order', () => {
    const h = new History<G>();
    let g = game();
    g = h.run(g, () => {
      g.units[0].area = 5;
    }).game;
    const back = JSON.parse(JSON.stringify(g)) as G;
    back.units[0] = { area: 5, id: 'a' } as G['units'][0];
    expect(h.undo(back).game?.units[0].area).toBe(1);
  });
});
