// One area at a time (the table's step moves): the block keeps its points, other blocks end its move, the rules carry across steps.
import { describe, expect, it } from 'vitest';
import { newGame, useGame, move, moveOptions, endMove, endPhase, canReserve, buildFieldWorks, contestedAreas, allowance, neighbors, unitsIn, type Game, type Unit } from '../src';
import { newGolanGame } from './golan-helpers';

const fuelChits = (g: Game) => g.chits.filter((c) => c.kind === 'fuel' && c.box === 'available');
const bulge = (seed = 1) => { useGame('bulge'); const g = newGame(seed); g.phase = 'movement'; g.phasing = 'german'; g.contestedAtMoveStart = contestedAreas(g); return g; };
/** A German armour block with a two-step route through empty areas. */
function walker(g: Game): { u: Unit; a: number; b: number } {
  for (const u of g.units.filter((x) => x.side === 'german' && x.cls === 'armor' && x.area != null && !x.garrison && !contestedAreas(g).includes(x.area))) {
    for (const o of moveOptions(g, u.id).filter((x) => x.path.length === 2 && !x.mustStop)) {
      const save = structuredClone(g); move(g, u.id, o.area, true);
      const next = moveOptions(g, u.id).find((x) => x.path.length === 2 && x.area !== u.area); Object.assign(g, save);
      if (next) return { u: g.units.find((x) => x.id === u.id)!, a: o.area, b: next.area };
    }
  }
  throw new Error('no walker');
}

describe('step moves', () => {
  it('a block moves one area, keeps its points, and goes on from there', () => {
    const g = bulge(); const { u, a, b } = walker(g);
    move(g, u.id, a, true);
    expect(u.area).toBe(a); expect(u.moved).toBe(false); expect(g.moving?.id).toBe(u.id);
    const spent = u.spent!; expect(spent).toBeGreaterThan(0); expect(spent).toBeLessThan(allowance(g, u));
    expect(moveOptions(g, u.id).every((o) => o.cost > spent && o.cost <= allowance(g, u) + 0)).toBe(true);
    move(g, u.id, b, true); expect(u.area).toBe(b);
  });
  it('choosing another block ends the first one for good', () => {
    const g = bulge(2); const { u, a } = walker(g); move(g, u.id, a, true);
    const v = g.units.find((x) => x.side === 'german' && x.id !== u.id && x.area != null && !x.garrison && moveOptions(g, x.id).length)!;
    move(g, v.id, moveOptions(g, v.id)[0].area, true);
    expect(u.moved).toBe(true); expect(moveOptions(g, u.id)).toEqual([]);
  });
  it('a block that started moving takes no reserve marker and builds no field works; the phase end closes its move', () => {
    const g = bulge(3); const { u, a } = walker(g); move(g, u.id, a, true);
    expect(canReserve(g, u)).toBe(false); expect(() => buildFieldWorks(g, u.id)).toThrow(/started moving/);
    endMove(g); expect(u.moved).toBe(true); expect(g.moving).toBeNull();
  });
  it('5.34: after leaving a contested area by steps, it may not enter another contested or enemy area', () => {
    const g = bulge(4); const a = contestedAreas(g).find((x) => g.units.some((u) => u.area === x && u.side === 'german' && u.cls === 'armor' && moveOptions(g, u.id).some((o) => !o.mustStop)));
    if (a == null) return;
    const u = g.units.find((x) => x.area === a && x.side === 'german' && x.cls === 'armor')!, o = moveOptions(g, u.id).find((x) => !x.mustStop)!;
    move(g, u.id, o.area, true);
    for (const x of moveOptions(g, u.id)) expect(unitsIn(g, x.area, 'allied').length).toBe(0);
  });
  it('16.13: fuel is paid once for a move done in steps', () => {
    const g = bulge(5); g.opts.fuel = true; const { u, a, b } = walker(g); const f0 = fuelChits(g).length;
    move(g, u.id, a, true); if (g.moving?.id !== u.id) return; move(g, u.id, b, true);
    for (let i = 0; i < 4 && g.moving?.id === u.id; i++) { const o = moveOptions(g, u.id).find((x) => x.path.length === 2); if (!o) break; move(g, u.id, o.area, true); }
    expect(f0 - fuelChits(g).length).toBeLessThanOrEqual(1);
  });
  it('Golan 14.03: at night a Syrian armour block enters two areas at most, steps included', () => {
    const g = newGolanGame(41); g.turn = 2; g.phase = 'movement'; g.phasing = 'syrian'; g.contestedAtMoveStart = contestedAreas(g);
    const u = g.units.find((x) => x.side === 'syrian' && x.cls === 'armor' && x.area != null && !contestedAreas(g).includes(x.area) && moveOptions(g, x.id).some((o) => o.path.length === 2 && !o.mustStop))!;
    if (!u) return; const o = moveOptions(g, u.id).find((x) => x.path.length === 2 && !x.mustStop)!; move(g, u.id, o.area, true);
    for (const x of moveOptions(g, u.id)) expect(x.path.length).toBe(2);                              // one more area, no more
    void neighbors;
  });
  it('without step the move ends at once (the computer and old saves)', () => {
    const g = bulge(6); const { u, a } = walker(g); move(g, u.id, a); expect(u.moved).toBe(true); expect(g.moving ?? null).toBeNull();
    void endPhase;
  });
});

describe('the computer moves one area at a time', () => {
  it('a long computer move goes through every area of its route and takes control of the empty ones', async () => {
    const { ai } = await import('../src');
    const g = bulge(7); const u = g.units.find((x) => x.side === 'german' && x.cls === 'armor' && x.area != null && !x.garrison && moveOptions(g, x.id).some((o) => o.path.length >= 3 && !o.mustStop))!;
    const o = moveOptions(g, u.id).find((x) => x.path.length >= 3 && !x.mustStop)!; for (const a of o.path.slice(1, -1)) if (!unitsIn(g, a).length) g.control[a] = 'allied';
    ai.apply(g, ['move', u.id, o.area]);
    expect(u.area).toBe(o.area); expect(u.moved).toBe(true); expect(g.moving ?? null).toBeNull();
    for (const a of o.path.slice(1, -1)) if (!unitsIn(g, a).length) expect(g.control[a]).toBe('german');
    expect(g.log.filter((l) => l.includes(u.name) && l.includes('→')).length).toBe(o.path.length - 1);   // one log line per step
  });
});

describe('18.3 KG Peiper step by step', () => {
  it('Peiper\'s full move goes on area by area, then ends; the once-per-game use is spent', async () => {
    const { setPeiperFull } = await import('../src');
    useGame('bulge'); const g = newGame(8, { peiper: true } as never); g.turn = 2; g.phase = 'btMove'; g.phasing = 'german'; g.contestedAtMoveStart = contestedAreas(g);
    const p = g.units.find((x) => x.name === 'Peiper')!; p.exploit = true; p.reserve = null; p.moved = false; p.spent = 0;
    if (contestedAreas(g).includes(p.area!)) for (const u of g.units) if (u.area === p.area && u.side === 'allied') u.area = null;
    expect(moveOptions(g, p.id).every((o) => o.path.length === 2)).toBe(true);                     // exploiting: one area
    setPeiperFull(g, p.id, true);
    const o = moveOptions(g, p.id).find((x) => x.path.length === 2 && !x.mustStop)!; move(g, p.id, o.area, true);
    expect(g.moving?.id).toBe(p.id); expect(g.peiperUsed).toBe(true);
    const more = moveOptions(g, p.id); expect(more.length).toBeGreaterThan(0);
    const far = more.find((x) => x.path.length >= 3); if (far) expect(far.cost).toBeLessThanOrEqual(6);
    endMove(g); expect(p.moved).toBe(true); expect(p.exploit).toBe(false); expect(p.peiperFull).toBeFalsy();
    expect(g.log.filter((l) => l.includes('full movement allowance')).length).toBe(1);
  });
});
