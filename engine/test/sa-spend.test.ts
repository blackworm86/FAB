import { describe, expect, it } from 'vitest';
import * as E from '../src';

describe('8.1 the Special Action the player picks is the one spent', () => {
  const setup = () => {
    const g = E.newGame(4); g.phase = 'admin'; g.turn = 3;
    const block = g.chits.find((c) => c.kind === 'sa_block' && c.side === 'german')!, ev = g.chits.find((c) => c.kind === 'special_action_event' && c.ech === 'de_5pz')!;
    block.box = 'available'; ev.box = 'available';
    const u5 = g.units.find((u) => u.side === 'german' && u.ech === 'de_5pz' && u.area != null && u.max > 1)!, u6 = g.units.find((u) => u.side === 'german' && u.ech === 'de_6pz' && u.area != null && u.max > 1)!;
    u5.str = u5.max - 1; u6.str = u6.max - 1; u5.unsupplied = u6.unsupplied = false;
    return { g, block, ev, u5, u6 };
  };
  it('a single-use event is spent, not the reusable block', () => {
    const { g, block, ev, u5 } = setup();
    E.qualityReplacement(g, u5.id, ev.id);
    expect(ev.box).toBe('eliminated'); expect(block.box).toBe('available'); expect(u5.str).toBe(u5.max);
  });
  it('a single-use event cannot help another army', () => {
    const { g, ev, u6 } = setup();
    expect(() => E.qualityReplacement(g, u6.id, ev.id)).toThrow(/Higher Echelon/); expect(ev.box).toBe('available');
  });
  it('the reusable block still works for any army', () => {
    const { g, block, ev, u6 } = setup();
    E.qualityReplacement(g, u6.id, block.id); expect(block.box).toBe('used'); expect(ev.box).toBe('available');
  });
});
