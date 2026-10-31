import { describe, expect, it } from 'vitest';
import { History } from '../src/history';

const game = () => ({ rolls: 0, x: 1, y: 'a' });
describe('undo', () => {
  it('restores the game after a plain action', () => {
    const h = new History<ReturnType<typeof game>>(); let g = game();
    g = h.run(g, () => { g.x = 2; }).game; g = h.run(g, () => { g.x = 3; }).game;
    g = h.undo()!; expect(g.x).toBe(2); g = h.undo()!; expect(g.x).toBe(1); expect(h.undo()).toBeNull();
  });
  it('forgets everything once a die is rolled', () => {
    const h = new History<ReturnType<typeof game>>(); let g = game();
    g = h.run(g, () => { g.x = 2; }).game; expect(h.length).toBe(1);
    g = h.run(g, () => { g.rolls++; g.x = 3; }).game; expect(h.length).toBe(0); expect(h.undo()).toBeNull();
  });
  it('rolls the game back when an action throws, and does not record it', () => {
    const h = new History<ReturnType<typeof game>>(); const g0 = game();
    const r = h.run(g0, () => { g0.x = 99; throw new Error('illegal'); });
    expect(r.error?.message).toBe('illegal'); expect(r.game.x).toBe(1); expect(h.length).toBe(0);
  });
  it('keeps only the newest snapshots', () => {
    const h = new History<ReturnType<typeof game>>(3); let g = game();
    for (let i = 0; i < 10; i++) g = h.run(g, () => { g.x++; }).game;
    expect(h.length).toBe(3);
  });
});
