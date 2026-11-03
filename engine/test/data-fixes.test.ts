import { describe, expect, it } from 'vitest';
import { newGame } from '../src';
describe('counter data (inspection review)', () => {
  it('v.d. Heydte belongs to the 6th Panzer Army', () => {
    const g = newGame(1); expect(g.chits.find((c) => c.id.startsWith('L11'))!.ech).toBe('de_6pz');
  });
});
