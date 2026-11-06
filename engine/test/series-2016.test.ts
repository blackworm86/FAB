// The Bulge plays the latest series rules (Golan '73 rulebook, 2016) where they differ from its own book: 9.31c and 9.33d.
import { describe, expect, it } from 'vitest';
import * as E from '../src';
import { newGolanGame } from './golan-helpers';

describe('latest series rules in The Bulge and Golan', () => {
  it('9.31: a supply path may pass a vacant friendly area next to uncontested enemy units (The Bulge\'s old 9.31c is gone)', () => {
    E.useGame('bulge'); const g = E.newGame(3); E.useGame('bulge');
    const src = [...E.VOLUMES.bulge.sources(g, 'german')];
    let found = false;
    for (const s of src) for (const v of E.neighbors(s)) for (const start of E.neighbors(v)) {
      if (found || start === s || E.neighbors(start).includes(s)) continue;
      const x = E.neighbors(v).find((n) => n !== s && n !== start && !E.neighbors(start).includes(n) && !E.neighbors(s).includes(n)); if (x == null) continue;
      for (const a of E.areas.keys()) g.control[a] = 'allied';
      for (const u of g.units) u.area = null;
      g.control[s] = g.control[v] = g.control[start] = 'german'; g.blown = [];
      const ge = g.units.find((u) => u.side === 'german' && !u.garrison)!, al = g.units.find((u) => u.side === 'allied' && !u.garrison)!;
      ge.area = start; al.area = x;                                                                     // Allied block next to the vacant link v, uncontested
      expect(E.inSupply(g, 'german', start)).toBe(true);
      found = true;
    }
    expect(found).toBe(true);
  });
  it('9.33d: a disordered unit may not enter an area with enemy units (The Bulge)', () => {
    E.useGame('bulge'); const g = E.newGame(3); g.phase = 'movement'; g.phasing = 'german';
    let checked = 0;
    for (const u of g.units.filter((x) => x.side === 'german' && x.area != null && !x.garrison)) {
      Object.assign(u, { moved: false, reserve: null, unsupplied: false, disorder: 0 });
      const into = E.moveOptions(g, u.id).map((o) => o.area).filter((a) => E.unitsIn(g, a, 'allied').length); if (!into.length) continue;
      u.disorder = 1; const dis = E.moveOptions(g, u.id).map((o) => o.area); u.disorder = 0;
      expect(into.filter((a) => dis.includes(a))).toEqual([]); checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('9.33d: a disordered unit may not enter an area with enemy units (Golan)', () => {
    const g = newGolanGame(6); g.phase = 'movement'; g.phasing = 'israeli';
    const u = g.units.find((x) => x.side === 'israeli' && x.area != null && !x.fort && !x.ghost && !x.garrison && E.neighbors(x.area).some((a) => E.unitsIn(g, a, 'syrian').length))!;
    const en = E.neighbors(u.area!).filter((a) => E.unitsIn(g, a, 'syrian').length);
    Object.assign(u, { moved: false, reserve: null, unsupplied: false, disorder: 0 });
    const ok = E.moveOptions(g, u.id).map((o) => o.area);
    u.disorder = 1; const dis = E.moveOptions(g, u.id).map((o) => o.area);
    expect(en.some((a) => ok.includes(a))).toBe(true);
    expect(en.filter((a) => dis.includes(a))).toEqual([]);
  });
});

/** A Bulge table with every block off the map, for building positions by hand. */
const blank = (seed = 3) => { E.useGame('bulge'); const g = E.newGame(seed); E.useGame('bulge'); for (const u of g.units) u.area = null; g.battle = null; return g; };
const blocksOf = (g: E.Game, side: string) => g.units.filter((u) => u.side === side && !u.garrison);

describe('2016 series changes, The Bulge', () => {
  it('4.34: a friendly unit entering its own roadblock area leaves the marker in place', () => {
    const g = blank(); g.phase = 'movement'; g.phasing = 'german';
    const u = blocksOf(g, 'german')[0], from = 10, to = E.neighbors(from).find((a) => E.connection(from, a)?.type === 'road')!;
    for (const a of E.areas.keys()) g.control[a] = 'german';
    Object.assign(u, { area: from, moved: false, reserve: null, unsupplied: false, disorder: 0 }); g.roadblocks = { [to]: 'german' };
    E.move(g, u.id, to); expect(u.area).toBe(to); expect(g.roadblocks[to]).toBe('german');
  });
  it('5.32: entering an area that holds only assets costs one more movement point', () => {
    const g = blank(); g.phase = 'movement'; g.phasing = 'german'; for (const a of E.areas.keys()) g.control[a] = 'german';
    const u = blocksOf(g, 'german').find((x) => x.cls === 'armor')!, from = 10, to = E.neighbors(from).find((a) => E.connection(from, a)?.type === 'road')!;
    Object.assign(u, { area: from, moved: false, reserve: null, unsupplied: false, disorder: 0 });
    const cost = () => E.moveOptions(g, u.id).find((o) => o.area === to)!.cost;
    const before = cost();
    g.units.push({ ...structuredClone(u), id: 'TEST-ASSET', name: 'asset', garrison: true, area: to, moved: true });
    expect(cost()).toBe(before + 1);
  });
  it('6.6: when every adjoining friendly area is full, the unit retreats on to the nearest area with room', () => {
    const g = blank(); const A = 23, ring = E.neighbors(A);
    for (const a of E.areas.keys()) g.control[a] = 'german';
    for (const n of ring) g.control[n] = 'allied';
    const al = blocksOf(g, 'allied'); let k = 0;
    const d = al[k++]; d.area = A; blocksOf(g, 'german')[0].area = A; g.control[A] = 'allied';
    for (const n of ring) { al[k++].area = n; al[k++].area = n; }                                  // every adjoining area full
    const far = E.neighbors(ring[0]).find((x) => x !== A && !ring.includes(x))!; g.control[far] = 'allied';
    const b = { area: A, retreat: { side: 'allied', queue: [d.id], moved: false, after: 'ground', h: 0, excess: 0 } } as unknown as E.Battle;
    const opts = E.retreatOptions(g, b);
    expect(opts).toContain(far); expect(opts.some((o) => ring.includes(o))).toBe(false);
    for (const n of ring) al.filter((u) => u.area === n)[1].area = null;                           // room again next door: only the adjoining areas
    expect(E.retreatOptions(g, b).every((o) => ring.includes(o))).toBe(true);
  });
  it('6.22/6.23: at most eight battle assets for the Attacker', () => {
    E.useGame('bulge'); const g = E.newGame(3); const a = E.mustFight(g)[0], b = E.startBattle(g, a);
    const att = b.attacker, ech = g.units.find((u) => u.area === a && u.side === att && !u.garrison)!.ech;
    const pool = g.chits.filter((c) => c.side === att && E.isBattleAsset(c)).slice(0, 10);
    for (const c of pool) { c.box = 'available'; c.ech = ech; }
    let n = 0, err: string | null = null;
    for (const c of pool) { err = E.canAssign(g, b, att, c); if (err) break; E.assign(g, b, c.id); n++; }
    expect(n).toBe(8); expect(err).toMatch(/at most 8 battle assets/);
  });
  it('6.42c: a garrison that cannot retreat is destroyed and counts as a hit', () => {
    const g = blank(); E.useGame('bulge'); g.phase = 'combat'; g.phasing = 'german';
    const A = 23; for (const a of E.areas.keys()) g.control[a] = 'allied';
    const d = blocksOf(g, 'allied')[0], at = blocksOf(g, 'german')[0];
    Object.assign(d, { area: A, str: d.max, disorder: 0 }); at.area = A;
    g.units.push({ id: `G${A}`, name: 'Garrison', side: 'allied', cls: 'infantry', q: ['green'], max: 1, str: 1, area: A, garrison: true, disorder: 0, unsupplied: false, moved: true, reserve: null, exploit: false });
    const b = E.startBattle(g, A); Object.assign(b, { stage: 'defChoice', pendingKind: 'ground', pending: 2 });
    const str = d.str; E.defenderChoice(g, b, true);
    if (b.stage === 'retreat') E.chooseRetreat(g, b, E.retreatOptions(g, b)[0]);
    expect(g.units.find((u) => u.id === `G${A}`)!.area).toBeNull();                                  // destroyed: one hit
    expect(d.str).toBe(str); expect(d.area).not.toBe(A);                                            // the retreat absorbed the other
  });
});
