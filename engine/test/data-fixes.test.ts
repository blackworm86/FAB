import { describe, expect, it } from 'vitest';
import { newGame } from '../src';
describe('counter data (inspection review)', () => {
  it('v.d. Heydte belongs to the 6th Panzer Army', () => {
    const g = newGame(1); expect(g.chits.find((c) => c.id.startsWith('L11'))!.ech).toBe('de_6pz');
  });
});

import { mustFight, startBattle, assign, setEngFw, beginCombat, roll_step, fireList, boxOf } from '../src';
describe('6.33 engineer removes enemy field works', () => {
  it('after artillery and defensive fire, before the attackers fire; the engineer does not fire and the -1 is gone', () => {
    const g = newGame(3, { scenario: 'campaign', fuel: true }); g.phase = 'combat'; g.phasing = 'german'; g.turn = 2;
    const area = mustFight(g)[0]; g.fieldWorks.push(area); g.fwOwner[area] = 'allied';
    const b = startBattle(g, area);
    const eng = g.chits.find((c) => c.side === 'german' && c.kind === 'engineer' && (() => { c.box = 'available'; try { assign(g, b, c.id); return true; } catch { c.box = 'cup'; return false; } })());
    expect(eng).toBeTruthy();
    setEngFw(g, b, true);
    const before = fireList(g, b, 'german', 'ground');
    expect(before.some((f) => f.key === eng!.id)).toBe(false);                                         // the engineer will not fire
    expect(before.every((f) => !f.parts.some(([n]) => /field works/i.test(n)))).toBe(true);           // and the shown SNs have no field-works penalty
    beginCombat(g, b); g.force = Array(40).fill(10);                                                    // every roll misses: nothing is hit before offensive fire
    let guard = 0; while (b.stage !== 'offFire' && guard++ < 10) { if (b.stage.endsWith('Choice') || b.stage === 'attFirst') break; roll_step(g, b); }
    expect(b.stage).toBe('offFire'); expect(g.fieldWorks.includes(area)).toBe(true);                   // still there until offensive fire
    const n0 = b.rolls.length; roll_step(g, b);
    expect(g.fieldWorks.includes(area)).toBe(false); expect(g.log.some((l) => l.includes('engineer removes the field works (6.33)'))).toBe(true);
    expect(b.rolls.slice(n0).some((r) => r.who === eng!.name)).toBe(false);
    void boxOf;
  });
});

import { attackerChoice } from '../src';
describe('6.41b abort', () => {
  it('surviving assigned assets go to the Used Box, not the Eliminated Box', () => {
    const g = newGame(4, { scenario: 'campaign', fuel: true }); g.phase = 'combat'; g.phasing = 'german'; g.turn = 2;
    const area = mustFight(g)[0]; const b = startBattle(g, area);
    const art = g.chits.find((c) => c.side === 'german' && c.kind === 'artillery' && (() => { c.box = 'available'; try { assign(g, b, c.id); return true; } catch { c.box = 'cup'; return false; } })())!;
    expect(art).toBeTruthy(); expect(art.box).not.toBe('eliminated');
    b.stage = 'attChoice'; b.pending = 2;
    attackerChoice(g, b, true);
    expect(art.box).toBe('used');
    expect(g.units.filter((u) => u.area === area && u.side === 'german' && !u.garrison).every((u) => u.disorder === 1)).toBe(true);
  });
});
