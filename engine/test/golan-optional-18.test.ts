// The Golan '73 rule book's own optional rules (18.1–18.5), each off unless chosen.
import { describe, expect, it } from 'vitest';
import { passSA as passSA_, setReady as setReady_, type Battle as Battle_, type Game as Game_ } from '../src';
/** 6.21-6.23: past the Defender's Special Action decision and the Attacker's assets, to the Defender's own asset step. */
const defStep = (g: Game_, b: Battle_) => {
  if (b.defSA) passSA_(g, b);
  setReady_(g, b, b.attacker);
};
import {
  assign,
  canAssign,
  contested,
  endPhase,
  mustFight,
  fireList,
  isArty,
  moveOptions,
  neighbors,
  startBattle,
  unitsIn,
  useGame,
  newGame,
  golan,
  VOLUMES,
  type Battle,
  type Game,
} from '../src';
import { newGolanGame, unit, chit, give, fresh, move } from './golan-helpers';

const V = () => VOLUMES.golan73;
/** Israel attacks the Syrians in Booster (50) with the 77/7th (and any extra units). */
const attack50 = (opts: Record<string, boolean> = {}, extra: string[] = []) => {
  const g = newGolanGame(6);
  Object.assign(g.opts, opts);
  g.phasing = 'israeli';
  golan.state(g).samTarget = undefined;
  for (const id of ['I05', ...extra]) Object.assign(unit(g, id), { area: 50, disorder: 0 });
  for (const c of g.chits.filter((x) => x.kind === 'sa_block')) c.box = 'available';
  const b = startBattle(g, 50);
  if (b.defSA) passSA_(g, b);
  return { g, b };
};
const sn = (g: Game, b: Battle, side: string, kind: 'arty' | 'ground', key: string) =>
  fireList(g, b, side, kind).find((f) => f.key === key)?.sn;
const regular = (g: Game, a: number, side: string) => unitsIn(g, a, side).filter((u) => !u.garrison && !u.fort && !u.ghost);

describe('Golan optional rules of the rule book (18.1–18.5)', () => {
  it('18.1–18.5 are listed for Golan and all off in a new game', () => {
    const keys = ['fwMaintain', 'withdrawal', 'artyInterdict', 'directSupport', 'syrianAirAttack', 'israeliDivisions'];
    expect(
      V()
        .optional!.filter((r) => keys.includes(r.key))
        .map((r) => r.rule),
    ).toEqual(['18.1', '18.2', '18.31', '18.32', '18.4', '18.5']);
    useGame('golan73');
    const g = newGame(1, { scenario: 'badr' });
    for (const k of keys) expect(g.opts[k as keyof typeof g.opts]).toBeFalsy();
  });

  it('18.1 maintaining field works: off, removed from a contested area; on, the owner checks morale in his Supply Phase', () => {
    const run = (on: boolean, die: number) => {
      const g = newGolanGame(6);
      g.opts.fwMaintain = on || undefined;
      Object.assign(unit(g, 'I05'), { area: 50, disorder: 0 });
      expect(contested(g, 50)).toBe(true);
      g.fieldWorks = [50];
      g.fwOwner[50] = 'syrian';
      g.phasing = 'syrian';
      g.phase = 'btCombat';
      g.battle = null;
      g.fought = [];
      g.fought = [...mustFight(g)];
      g.force = [die];
      endPhase(g);
      expect(g.phase).toBe('supply');
      return g.fieldWorks.includes(50);
    };
    expect(run(false, 1)).toBe(false);
    expect(run(true, 1)).toBe(true);
    expect(run(true, 10)).toBe(false);
  });

  it('18.2 withdrawal: the last unit out of a contested area checks morale; failing, it is disordered and stops in the first area', () => {
    const setup = (on: boolean) => {
      const g = newGolanGame(6);
      g.opts.withdrawal = on || undefined;
      g.phase = 'movement';
      g.phasing = 'israeli';
      for (const u of unitsIn(g, 50, 'israeli')) if (!u.garrison && !u.fort && !u.ghost) u.area = null;
      const u = unit(g, 'I05');
      Object.assign(u, { area: 50, disorder: 0, moved: false, spent: 0 });
      expect(contested(g, 50)).toBe(true);
      golan.state(g).withdrew = [];
      const far = moveOptions(g, 'I05')
        .filter((o) => o.path.length >= 3 && !unitsIn(g, o.path[1], 'syrian').length)
        .sort((x, y) => y.path.length - x.path.length)[0];
      expect(far).toBeTruthy();
      return { g, u, far };
    };
    {
      const { g, u, far } = setup(false);
      g.force = [10];
      move(g, 'I05', far.area);
      expect(u.area).toBe(far.area);
      expect(u.disorder).toBe(0);
    }
    {
      const { g, u, far } = setup(true);
      g.force = [1];
      move(g, 'I05', far.area);
      expect(u.area).toBe(far.area);
      expect(u.disorder).toBe(0);
    }
    {
      const { g, u, far } = setup(true);
      g.force = [10];
      move(g, 'I05', far.area);
      expect(u.disorder).toBe(1);
      expect(u.area).toBe(far.path[1]);
      expect(u.moved).toBe(true);
    }
    {
      const { g, u, far } = setup(true);
      Object.assign(unit(g, 'I07'), { area: 50, disorder: 0 });
      g.force = [10];
      move(g, 'I05', far.area);
      expect(u.area).toBe(far.area);
      expect(u.disorder).toBe(0);
    } // another unit stays: no check
  });

  it('18.31 artillery interdiction: once per Admin Phase per player, next to friendly units; +1 MP to enter, no strat-move; off until the second Supply Phase', () => {
    const find = (g: Game) => {
      g.phase = 'movement';
      g.phasing = 'syrian';
      for (const s of g.units.filter((u) => u.side === 'syrian' && u.area != null && !u.garrison && u.area < 100)) {
        s.moved = false;
        s.spent = 0;
        for (const o of moveOptions(g, s.id))
          if (o.path.length === 2 && !g.interdicted[o.area] && neighbors(o.area).some((n) => n < 100 && regular(g, n, 'israeli').length))
            return { s, a: o.area, cost: o.cost };
      }
      throw new Error('no case');
    };
    const g = newGolanGame(6),
      { s, a, cost } = find(g);
    fresh(g);
    const arty = g.chits.filter((c) => c.side === 'israeli' && isArty(c)),
      id = give(g, arty[0].id);
    give(g, arty[1].id);
    expect(() => golan.artilleryInterdiction(g, id, a)).toThrow(/optional/);
    g.opts.artyInterdict = true;
    golan.state(g).artyInt = [];
    golan.artilleryInterdiction(g, id, a);
    expect(g.interdicted[a]).toBe(id);
    expect(chit(g, id).box).toBe('map');
    expect(() => golan.artilleryInterdiction(g, arty[1].id, neighbors(a).find((n) => n < 100 && !g.interdicted[n])!)).toThrow(
      /once|one artillery/,
    );
    g.phase = 'movement';
    g.phasing = 'syrian';
    s.moved = false;
    expect(moveOptions(g, s.id).find((o) => o.area === a)?.cost).toBe(cost + 1);
    expect(V().stratStep!(g, s, s.area!, a)).toBe(false);
    g.phasing = 'israeli';
    V().onPhase!(g, 'supply', 'mid');
    expect(g.interdicted[a]).toBeUndefined();
    expect(chit(g, id).box).toBe('used');
  });

  it('18.32 direct combat support: Israeli artillery supports instead of firing, +1 to the point unit per asset; it may take a step loss', () => {
    const run = (on: boolean) => {
      const { g, b } = attack50({ directSupport: on });
      const id = give(g, g.chits.find((c) => c.side === 'israeli' && isArty(c) && c.box !== 'map')!.id);
      assign(g, b, id);
      return { g, b, id };
    };
    {
      const { g, id } = run(false);
      expect(golan.directSupportOptions(g)).toEqual([]);
      expect(() => golan.setDirectSupport(g, id, true)).toThrow();
    }
    const { g, b, id } = run(true),
      pt = b.attPoint,
      before = sn(g, b, 'israeli', 'ground', pt)!;
    expect(golan.directSupportOptions(g)).toEqual([id]);
    expect(sn(g, b, 'israeli', 'arty', id)).toBeDefined();
    const lossAsset = (V() as unknown as { lossAsset: (g: Game, b: Battle, s: string, id: string) => boolean }).lossAsset;
    expect(lossAsset(g, b, 'israeli', id)).toBe(false);
    golan.setDirectSupport(g, id, true);
    expect(sn(g, b, 'israeli', 'arty', id)).toBeUndefined();
    expect(sn(g, b, 'israeli', 'ground', pt)).toBe(before + 1);
    expect(lossAsset(g, b, 'israeli', id)).toBe(true);
    golan.setDirectSupport(g, id, false);
    expect(sn(g, b, 'israeli', 'ground', pt)).toBe(before);
  });

  it('18.4 Syrian air support: only when Syria is the Attacker', () => {
    const run = (on: boolean, attacker: string) => {
      const { g, b } = attack50({ syrianAirAttack: on });
      g.turn = [1, 2, 3, 4, 5, 6].find((t) => {
        g.turn = t;
        return !golan.isNight(g);
      })!;
      b.attacker = attacker;
      if (attacker !== 'syrian') defStep(g, b);
      const air = chit(g, give(g, g.chits.find((c) => c.side === 'syrian' && c.kind === 'air_mission')!.id));
      return canAssign(g, b, 'syrian', air, 'arty');
    };
    expect(run(false, 'israeli')).toBeNull();
    expect(run(true, 'israeli')).toMatch(/18\.4/);
    expect(run(true, 'syrian')).toBeNull();
  });

  it('18.5 Israeli divisional organization: mixed divisions get one artillery asset and no battle assets; merging needs the same division', () => {
    const lim = (on: boolean) => {
      const { g, b } = attack50({ israeliDivisions: on }, ['I09']);
      return golan.limits(g, b, 'israeli');
    }; // 77/7th (36th) and 179th (240th)
    expect(lim(false).battle).toBe(8);
    expect(lim(false).artillery).toBeGreaterThan(1); // 2, +1 while Israel holds Mt Hermon (16.21)
    expect(lim(true)).toMatchObject({ artillery: 1, battle: 0 });
    {
      const { g, b } = attack50({ israeliDivisions: true }, ['I07']);
      expect(golan.limits(g, b, 'israeli')).toMatchObject({ artillery: lim(false).artillery, battle: 8 });
    } // one division: no penalty
    const merge = (on: boolean) => {
      const g = newGolanGame(6);
      g.opts.israeliDivisions = on || undefined;
      fresh(g);
      g.phasing = 'israeli';
      for (const c of g.chits.filter((x) => x.kind === 'sa_block')) c.box = 'available';
      const a = golan.ASSEMBLY.A;
      Object.assign(unit(g, 'I05'), { area: a, disorder: 0, str: 1 });
      Object.assign(unit(g, 'I09'), { area: a, disorder: 0, str: 1 });
      golan.mergeUnits(g, 'I05', 'I09');
    };
    expect(() => merge(false)).not.toThrow();
    expect(() => merge(true)).toThrow(/18\.5/);
  });
});
