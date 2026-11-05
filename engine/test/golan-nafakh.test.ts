// 22.4 Battle for Nafakh: its own map sheet (13 areas and two off-map boxes), four turns from the Syrian Movement Phase of turn 1.
import { describe, expect, it } from 'vitest';
import { moveOptions, inSupply, endPhase, victory, neighbors, setPlayArea, golan, VOLUMES, type Game } from '../src';
const finalResult = (g: Game, net: number) => VOLUMES.golan73.finalResult!(g, net);
import { newGolanGame, unit, chit, move, runTo } from './golan-helpers';

const nafakh = (seed = 3): Game => newGolanGame(seed, 'nafakh' as 'badr');
const to = (g: Game, id: string) => moveOptions(g, id).map((o) => o.area).sort((a, b) => a - b);

describe('Battle for Nafakh (22.4)', () => {
  it('sets up on its own sheet: the play area, the boxes, four turns, the Syrian Movement Phase of turn 1', () => {
    const g = nafakh();
    expect(g.lastTurn).toBe(4); expect(g.phase).toBe('movement'); expect(g.phasing).toBe('syrian');
    expect(g.inPlay).toEqual(expect.arrayContaining([34, 42, 48, golan.NAF_NORTH, golan.REAR]));
    expect(unit(g, 'I14').area).toBe(golan.NAF_NORTH); expect(unit(g, 'I14').str).toBe(2);
    expect(unit(g, 'S04').area).toBe(golan.REAR); expect(unit(g, 'S04').disorder).toBe(2);            // the 52nd starts recovering
    expect(unit(g, 'I09').str).toBe(2); expect(unit(g, 'S03').str).toBe(3);
    expect(g.control[34]).toBe('israeli'); expect(g.control[38]).toBe('syrian');
    expect(g.units.some((u) => u.id === 'S01')).toBe(false);                                          // not in the scenario
    expect(g.units.find((u) => u.garrison && u.chitId === 'IC04')?.area).toBe(37);                     // Lt. Zvika in Sindiana
    expect(chit(g, 'IC22').box).toBe('map'); expect(chit(g, 'IC22').area).toBe(42);                     // the HQ Staff in Nafakh
    expect(chit(g, 'SC27').box).toBe('future'); expect(chit(g, 'SC27').turn).toBe(2);
    expect(unit(g, 'I10').arrival).toBe(2); expect(unit(g, 'I10').str).toBe(2);
  });
  it('the Syrian Rear Area enters the sheet at Bunker 109 and Tel Fazra only, for 2 MP', () => {
    const g = nafakh(), opts = moveOptions(g, 'S26');
    expect(opts.find((o) => o.area === 48)?.cost).toBe(2 + 1);                                          // 2 MP, +1 into an occupied area
    expect(opts.every((o) => g.inPlay!.includes(o.area))).toBe(true);
  });
  it('the 33rd holds Tel Fazra until a Special Action frees it', () => {
    const g = nafakh(); expect(to(g, 'S03')).toEqual([]);
    expect(() => golan.freeThe33rd(g)).toThrow(/Special Action/);
    g.chits.find((c) => c.kind === 'sa_block' && c.side === 'syrian')!.box = 'available';
    golan.freeThe33rd(g); expect(to(g, 'S03').length).toBeGreaterThan(0);
  });
  it('the Northern Assembly Area: Katzrin for 4 MP, one unit per phase, or Kuzabia for 5 MP', () => {
    const g = nafakh(); runTo(g, 1, 'israeli', 'movement');
    const opts = moveOptions(g, 'I14');
    expect(opts.find((o) => o.area === 36)?.cost).toBe(4);
    expect(opts.some((o) => o.area === 34)).toBe(true);
    expect(opts.some((o) => o.area === 6 || o.area === 10)).toBe(false);                               // the main map's Assembly links are off this sheet
  });
  it('supply: Israel from the sheet\'s west edge, Syria from the Rear Area', () => {
    const g = nafakh();
    expect(inSupply(g, 'syrian', 39)).toBe(true); expect(inSupply(g, 'israeli', 42)).toBe(true);
  });
  it('victory: uncontested Nafakh is decisive, otherwise strength points in Nafakh, ties to Israel', () => {
    const g = nafakh(); expect(victory(g).net).toBeLessThanOrEqual(0);
    expect(finalResult(g, victory(g).net)).toMatch(/Israeli Decisive Victory/);
    for (const u of g.units.filter((x) => x.area === 42)) u.area = null;
    unit(g, 'S13').area = 42; g.control[42] = 'syrian';
    expect(finalResult(g, victory(g).net)).toMatch(/Syrian Decisive Victory/);
  });
  it('Syria taking Nafakh costs Israel the reusable Special Action and sends the HQ Staff to the cup', () => {
    const g = nafakh(); const sa = g.chits.find((c) => c.kind === 'sa_block' && c.side === 'israeli')!; sa.box = 'available';
    g.control[42] = 'syrian'; endPhase(g);
    expect(chit(g, 'IC22').box).toBe('cup'); expect(sa.box).toBe('eliminated');
  });
  it('plays all four turns to a result', () => {
    const g = nafakh(7); runTo(g, 4, 'israeli', 'supply'); for (let i = 0; i < 20 && !g.over; i++) endPhase(g);
    expect(g.over).toMatch(/Victory/);
  });
  it('leaves Operation Badr untouched: no sheet links on the full map', () => {
    setPlayArea(null); expect(neighbors(48)).not.toContain(golan.REAR); expect(neighbors(36)).not.toContain(golan.ASSEMBLY.A);
    const g = newGolanGame(2); expect(g.inPlay).toBeUndefined(); expect(move).toBeTypeOf('function');
  });
});
