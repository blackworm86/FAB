// The additional optional rules of the Battle for Nafakh and Al-Owda scenario sheets (18.x), each off unless chosen.
import { describe, expect, it } from 'vitest';
import { newGame, startBattle, beginCombat, fireList, assign, moveOptions, victory, unitsIn, contested, neighbors, optionalRules, useGame, golan, VOLUMES, type Game, type Battle } from '../src';
import { reachable } from '../src/golan';
import { connections, eastOfSam } from '../src/golan/map';
import { areas } from '../src/map';
import { newGolanGame, unit, chit, give } from './golan-helpers';

/** Israel attacks the Syrians in Booster (50) with the 77/7th, as in the SAM tests. */
const attack50 = (opts: Record<string, boolean> = {}, extra: string[] = []) => {
  const g = newGolanGame(6); Object.assign(g.opts, opts); g.phasing = 'israeli'; golan.state(g).samTarget = undefined;
  for (const id of ['I05', ...extra]) Object.assign(unit(g, id), { area: 50, disorder: 0 });
  for (const c of g.chits.filter((x) => x.kind === 'sa_block')) c.box = 'available';                 // both reusable Special Actions in hand
  const b = startBattle(g, 50); return { g, b };
};
const sn = (g: Game, b: Battle, side: string, kind: 'arty' | 'ground', key: string) => fireList(g, b, side, kind).find((f) => f.key === key)?.sn;

describe('Golan optional rules (18.x)', () => {
  it('Golan has its own list of optional rules', () => {
    useGame('golan73'); expect(optionalRules().map((r) => r.key)).toEqual(['atAssets', 't62', 'artyArmor', 'zvikaCup', 'raidMod', 'battleRecovery', 'chemical', 'flank', 'advGhosts']);
    useGame('bulge'); expect(optionalRules().map((r) => r.key)).toContain('bridgeLimit'); useGame('golan73');
  });
  it('anti-tank assets: +1 against an armour point unit; defending with one, Israeli armour fires −1', () => {
    const fire = (on: boolean) => { const { g, b } = attack50({ atAssets: on }); give(g, 'SC02'); assign(g, b, 'SC02'); return { at: sn(g, b, 'syrian', 'ground', 'SC02')!, tank: sn(g, b, 'israeli', 'ground', 'I05')! }; };
    const off = fire(false), on = fire(true);
    expect(on.at).toBe(off.at + 1); expect(on.tank).toBe(off.tank - 1);
  });
  it('T-62 tanks: one extra MP on a field connection, roads unchanged', () => {
    const field = connections().find((c) => c.kind === 'field' && c.a < 100 && c.b < 100 && !c.atDitch && !c.river && !c.escarpment && !c.rugged && !c.wadi && !c.sector)!;
    const ctx = { turn: 5, units: () => ({ israeli: 0, syrian: 0 }) };
    const cost = (slow: boolean) => reachable({ side: 'syrian', cls: 'armor', area: field.a, slowField: slow }, ctx).find((r) => r.area === field.b)!.cost;
    expect(cost(true)).toBe(cost(false) + 1);
    const road = connections().find((c) => c.kind === 'road' && c.a < 100 && c.b < 100 && !c.atDitch && !c.river && !c.sector)!;
    const rc = (slow: boolean) => reachable({ side: 'syrian', cls: 'armor', area: road.a, slowField: slow }, ctx).find((r) => r.area === road.b)?.cost;
    expect(rc(true)).toBe(rc(false));
  });
  it('artillery vs armour: an armour hit by artillery takes a recovery marker, −1 each in ground fire, one stays after the battle', () => {
    const { g, b } = attack50({ artyArmor: true }), u = unit(g, 'I05'), str = u.str;
    b.lossKind = 'arty'; expect(VOLUMES.golan73.absorbLoss!(g, b, 'israeli', u)).toBe(true); expect(u.str).toBe(str); expect(u.rec).toBe(1);
    VOLUMES.golan73.absorbLoss!(g, b, 'israeli', u); expect(u.rec).toBe(2);
    beginCombat(g, b); const with2 = sn(g, b, 'israeli', 'ground', 'I05')!; u.rec = 0; expect(sn(g, b, 'israeli', 'ground', 'I05')).toBe(with2 + 2); u.rec = 2;
    b.lossKind = 'ground'; expect(VOLUMES.golan73.absorbLoss!(g, b, 'israeli', u)).toBe(false);
    VOLUMES.golan73.onBattle!(g, b, 'end'); expect(u.rec).toBe(0); expect(u.disorder).toBe(2);
    const off = attack50(); off.b.lossKind = 'arty'; expect(VOLUMES.golan73.absorbLoss!(off.g, off.b, 'israeli', unit(off.g, 'I05'))).toBe(false);
  });
  it('flank assault: a Special Action; the second unit fires +1 and takes no hits while the point unit stands', () => {
    const { g, b } = attack50({ flank: true }, ['I07']);
    const before = sn(g, b, 'israeli', 'ground', 'I07')!;
    expect(golan.flankOptions(g)).toEqual(['I07']); golan.playFlank(g, 'I07');
    expect(sn(g, b, 'israeli', 'ground', 'I07')).toBe(before + 1); expect(golan.flankOptions(g)).toEqual([]);
    expect(VOLUMES.golan73.lossOk!(g, b, 'israeli', 'I07')).toBe(false); expect(VOLUMES.golan73.lossOk!(g, b, 'israeli', 'I05')).toBe(true);
    unit(g, 'I05').area = null; expect(VOLUMES.golan73.lossOk!(g, b, 'israeli', 'I07')).toBe(true);
    expect(attack50({}, ['I07']).g && golan.flankOptions(attack50({}, ['I07']).g)).toEqual([]);           // off: not offered
  });
  it('chemical warfare: the Syrian defender spends the reusable Special Action, one artillery fires +2; each later use gives Israel a VP', () => {
    const { g, b } = attack50({ chemical: true }); give(g, 'SC08'); assign(g, b, 'SC08');
    const before = sn(g, b, 'syrian', 'arty', 'SC08')!, vp0 = victory(g).israeli;
    expect(golan.chemicalOptions(g)).toEqual(['SC08']); golan.playChemical(g, 'SC08');
    expect(sn(g, b, 'syrian', 'arty', 'SC08')).toBe(before + 2); expect(victory(g).israeli).toBe(vp0);
    golan.state(g).chem = 2; expect(victory(g).israeli).toBe(vp0 + 1);
    expect(g.chits.find((c) => c.kind === 'sa_block' && c.side === 'syrian')!.box).toBe('used');
  });
  it('Lt. Zvika variant: in the Supply Phase he goes back into the Selection Cup', () => {
    const g = newGolanGame(3, 'nafakh' as 'badr'); g.opts.zvikaCup = true;
    const z = g.units.find((u) => u.chitId && chit(g, u.chitId).kind === 'event_lt_zvika')!; expect(z.area).not.toBeNull();
    expect(golan.zvikaOnMap(g)).toBeUndefined(); g.phase = 'supply';
    golan.zvikaToCup(g); expect(z.area).toBeNull(); expect(chit(g, z.chitId!).box).toBe('cup');
  });
  it('battlefield recovery: in a contested area a unit improves only by passing a morale check', () => {
    const g = newGolanGame(6); g.opts.battleRecovery = true;
    const u = unit(g, 'I05'); Object.assign(u, { area: 50, disorder: 1, unsupplied: false }); expect(contested(g, 50)).toBe(true);
    g.force = [10]; expect(VOLUMES.golan73.recoverOk!(g, u)).toBe(false);
    g.force = [1]; expect(VOLUMES.golan73.recoverOk!(g, u)).toBe(true);
    const quiet = g.units.find((x) => x.side === 'israeli' && x.area != null && !x.garrison && !x.fort && !x.ghost && !contested(g, x.area))!;
    expect(VOLUMES.golan73.recoverOk!(g, quiet)).toBe(true);
  });
  it('advanced ghosts: they move (never into an area they would contest); a Syrian entering a ghost-only area removes it and may go on', () => {
    const g = newGolanGame(6); const ghost = g.units.find((u) => u.ghost && u.area != null)!;
    g.phase = 'movement'; g.phasing = 'israeli'; ghost.moved = false;
    expect(moveOptions(g, ghost.id)).toEqual([]);
    g.opts.advGhosts = true; const opts = moveOptions(g, ghost.id); expect(opts.length).toBeGreaterThan(0);
    for (const o of opts) expect(unitsIn(g, o.area, 'syrian').length === 0 || contested(g, o.area)).toBe(true);
    const at = ghost.area!, sy = g.units.find((u) => u.side === 'syrian' && u.area != null && !u.garrison)!;
    const others = unitsIn(g, at, 'israeli').filter((u) => u !== ghost); for (const o of others) o.area = null;
    const from = neighbors(at)[0]; Object.assign(sy, { area: at, moved: true, spent: 0 }); VOLUMES.golan73.afterMove!(g, sy, { area: at, cost: 2, fuel: false, mustStop: true, path: [from, at] });
    expect(ghost.area).toBeNull(); expect(sy.moved).toBe(false); expect(sy.spent).toBe(2);
  });
  it('commando raid modifier: −1 to the die east of the SAM barrier (a 3, partly successful, becomes a 2, a success)', () => {
    for (const on of [false, true]) {
      const g = newGolanGame(6); g.opts.raidMod = on; const V = golan.state(g);
      const a = [...areas.keys()].find((x) => x < 100 && eastOfSam(x) && neighbors(x).length)!, from = neighbors(a)[0], u = unit(g, 'I05');
      V.raids.push(a); Object.assign(u, { area: a }); g.force = [3];
      VOLUMES.golan73.afterMove!(g, u, { area: a, cost: 1, fuel: false, mustStop: true, path: [from, a] });
      expect(V.raidPartial.includes(a)).toBe(!on);
    }
  });
  it('a new game keeps the optional rules chosen, in every scenario', () => {
    useGame('golan73');
    for (const scenario of ['badr', 'badr_alt', 'nafakh', 'alowda']) { const g = newGame(1, { scenario, flank: true, t62: true }); expect(g.opts.scenario).toBe(scenario); expect(g.opts.flank).toBe(true); expect(g.opts.t62).toBe(true); }
    expect(newGame(1, { scenario: 'badr' }).opts.flank).toBeUndefined();
  });
});
