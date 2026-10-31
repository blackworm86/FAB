import { describe, expect, it } from 'vitest';
import { newGame, startBattle, beginCombat, mustFight, applyCalls, redactFor, alias, unalias, visibleTo, type Game } from '../src';

const SALT = 'test-salt';
function open(): { g: Game; area: number } {
  const g = newGame(5); g.phase = 'combat'; g.phasing = 'german';
  const area = mustFight(g)[0] ?? 11; return { g, area };
}
describe('server actions and hidden blocks', () => {
  it('hides enemy blocks until a battle reveals them, and gives them opaque ids', () => {
    const { g, area } = open();
    const al = g.units.find((u) => u.side === 'allied' && u.area === area && !u.garrison)!;
    const view = redactFor(g, 'german', SALT), seen = view.units.find((u) => u.area === area && u.side === 'allied' && !u.garrison)!;
    expect(seen.name).toBe('Hidden block'); expect(seen.id).not.toBe(al.id); expect(JSON.stringify(view)).not.toContain(al.name);
    expect(view.units.find((u) => u.side === 'german' && u.area === area)!.name).not.toBe('Hidden block');
    const b = startBattle(g, area); beginCombat(g, b);
    expect(redactFor(g, 'german', SALT).units.find((u) => u.id === al.id)!.name).toBe(al.name);
  });
  it('does not leak the dice seed', () => { const { g } = open(); expect(redactFor(g, 'allied', SALT).seed).toBe(0); });
  it('replays calls with the battle marker and checks the seat', () => {
    const { g, area } = open();
    applyCalls(g, [{ fn: 'startBattle', args: [area, false] }], 'german');
    expect(g.battle?.area).toBe(area);
    expect(() => applyCalls(g, [{ fn: 'roll_step', args: [{ $battle: 1 }] }], 'allied')).toThrow();
    applyCalls(g, [{ fn: 'setReady', args: [{ $battle: 1 }, 'german', true] }], 'german');
    expect(() => applyCalls(g, [{ fn: 'setReady', args: [{ $battle: 1 }, 'allied', true] }], 'german')).toThrow();
    applyCalls(g, [{ fn: 'setReady', args: [{ $battle: 1 }, 'allied', true] }], 'allied'); expect(g.battle!.stage).not.toBe('setup');
  });
  it('rejects unknown actions and other seats\' pieces', () => {
    const { g, area } = open();
    expect(() => applyCalls(g, [{ fn: 'newGame', args: [] }], 'german')).toThrow();
    applyCalls(g, [{ fn: 'startBattle', args: [area, false] }], 'german');
    const al = g.chits.find((c) => c.side === 'allied' && c.box === 'available')!;
    expect(() => applyCalls(g, [{ fn: 'assign', args: [{ $battle: 1 }, al.id] }], 'german')).toThrow();
  });
  it('turns aliases back into real ids', () => {
    const { g } = open(); const u = g.units.find((x) => x.side === 'allied' && x.area != null)!;
    expect(unalias(g, SALT, [alias(SALT, u.id), 'x'])).toEqual([u.id, 'x']);
    expect(visibleTo(g, u, 'german')).toBeDefined();
  });
});

import { processAction, viewsOf, startFull } from '../src';
describe('server core', () => {
  it('turns a seat\'s call into new full and redacted states, translating aliases', () => {
    const full = startFull({ scenario: 'tournament', fuel: true }, 5); full.phase = 'combat'; full.phasing = 'german';
    const area = mustFight(full)[0] ?? 11;
    const r = processAction(JSON.stringify(full), SALT, 'german', [{ fn: 'startBattle', args: [area, false] }]);
    const after = JSON.parse(r.full) as Game; expect(after.battle?.area).toBe(area);
    const gv = JSON.parse(r.views.german) as Game, hidden = gv.units.find((u) => u.name === 'Hidden block')!;
    expect(hidden).toBeTruthy(); expect(r.views.german).not.toContain('"seed":5');
    // the German client points at an Allied block by its alias; the server resolves it
    const al = after.units.find((u) => u.side === 'allied' && u.area === area && !u.garrison)!;
    const r2 = processAction(r.full, SALT, 'german', [{ fn: 'setPoint', args: [{ $battle: 1 }, 'german', after.units.find((u) => u.side === 'german' && u.area === area && !u.garrison)!.id] }]);
    expect(JSON.parse(r2.full).battle.attPoint).toBeTruthy(); expect(alias(SALT, al.id)).not.toBe(al.id);
    expect(() => processAction(r.full, SALT, 'allied', [{ fn: 'endPhase', args: [] }])).toThrow();
    expect(viewsOf(after, SALT).public.length).toBeGreaterThan(1000);
  });
});
