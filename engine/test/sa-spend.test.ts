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

describe('8.21-8.27 every Special Action use spends the chosen counter', () => {
  it('breakthrough movement with a single-use event keeps the reusable block', () => {
    const g = E.newGame(4); g.phase = 'btMove'; g.turn = 3; g.phasing = 'german';
    const block = g.chits.find((c) => c.kind === 'sa_block' && c.side === 'german')!, ev = g.chits.find((c) => c.kind === 'special_action_event' && c.ech === 'de_5pz')!;
    block.box = 'available'; ev.box = 'available';
    const u = g.units.find((x) => x.side === 'german' && x.cls === 'armor' && x.ech === 'de_5pz' && x.area != null)!; Object.assign(u, { moved: false, disorder: 0, unsupplied: false, exploit: false, reserve: null });
    E.activateBreakthrough(g, u.id, ev.id);
    expect(u.exploit).toBe(true); expect(ev.box).toBe('eliminated'); expect(block.box).toBe('available');
  });
});

describe('8.24 retreat before combat', () => {
  const setup = () => { const g = E.newGame(1), sa = g.chits.find((c) => c.kind === 'sa_block' && c.side === 'allied')!; sa.box = 'available'; const b = E.startBattle(g, 10); return { g, b, sa }; };
  it('is the Defender\'s first decision, before any asset is assigned (6.21)', () => {
    const { g, b, sa } = setup(); const art = g.chits.find((c) => c.side === 'allied' && c.kind === 'artillery' && c.box !== 'map')!; art.box = 'available';
    expect(E.canAssign(g, b, 'allied', art)).toMatch(/6\.21/);
    E.defenderRetreatSA(g, b, sa.id); while (b.stage === 'retreat') E.chooseRetreat(g, b, E.retreatOptions(g, b)[0]);
    expect(sa.box).toBe('used'); expect(art.box).toBe('available'); expect(b.stage).toBe('done'); expect(b.exploit).toBe(true);
  });
  it('a garrison stays and the battle goes on against it', () => {
    const g = E.newGame(1), area = 23, gar = g.units.find((u) => u.garrison && u.area === area)!; const ger = g.units.find((u) => u.side === 'german' && u.area === 11)!, al = g.units.find((u) => u.side === 'allied' && u.area === 11)!;
    ger.area = area; al.area = area; g.contestedAtMoveStart = []; const sa = g.chits.find((c) => c.kind === 'sa_block' && c.side === 'allied')!; sa.box = 'available';
    const b = E.startBattle(g, area); E.defenderRetreatSA(g, b, sa.id); while (b.stage === 'retreat') E.chooseRetreat(g, b, E.retreatOptions(g, b)[0]);
    expect(al.area).not.toBe(area); expect(gar.area).toBe(area); expect(b.stage).toBe('setup'); expect(al.disorder).toBe(0);
  });
});
