import { describe, expect, it } from 'vitest';
import * as E from '../../engine/src';
import { handedOver } from '../src/notices';

describe('4.3 your-move notices: when the other player hands over the move', () => {
  const at = (phase: E.Game['phase'], phasing: E.Side) => { E.useGame('bulge'); const g = E.newGame(1); g.phase = phase; g.phasing = phasing; g.battle = null; return g; };
  it('the German ends his Combat Phase: the Allied Reaction Phase is the Allies\' move', () => {
    expect(handedOver(at('combat', 'german'), at('reaction', 'german'), 'allied')).toBe(true);
    expect(handedOver(at('combat', 'german'), at('reaction', 'german'), 'german')).toBe(false);
  });
  it('a step both sides play (the Admin Phase) counts as a handover to the one who was waiting', () => {
    expect(handedOver(at('supply', 'german'), at('admin', 'allied'), 'allied')).toBe(true);
  });
  it('no notice while it was already this player\'s move, or once the game is over', () => {
    expect(handedOver(at('movement', 'allied'), at('strategic', 'allied'), 'allied')).toBe(false);
    const over = at('reaction', 'german'); over.over = 'German victory';
    expect(handedOver(at('combat', 'german'), over, 'allied')).toBe(false);
  });
});
