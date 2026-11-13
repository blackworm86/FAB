import { describe, expect, it } from 'vitest';
import {
  newGame,
  mustFight,
  startBattle,
  beginCombat,
  roll_step,
  setPoint,
  passSA,
  setReady,
  boxOf,
  chit,
  areas,
  neighbors,
  connection,
  keyOf,
  repairBridge,
  moveOptions,
  move,
  setPeiperFull,
  peiperCan,
  endPhase,
  unitsIn,
  contested,
  OPTIONAL_RULES,
  type Game,
} from '../src';

const clone = (g: Game) => JSON.parse(JSON.stringify(g)) as Game;
/** A German engineer, an area and a neighbour across a river where a blown bridge can be repaired. */
function repairSpot(g: Game) {
  for (const c of g.chits.filter((x) => x.side === 'german' && x.kind === 'engineer'))
    for (const a of areas.keys())
      for (const n of neighbors(a)) {
        if (!connection(a, n)?.river) continue;
        const t = clone(g);
        t.phase = 'admin';
        t.blown = [keyOf(a, n)];
        chit(t, c.id).box = 'available';
        try {
          repairBridge(t, c.id, a, n);
          return { c: c.id, a, n };
        } catch {
          /* not here */
        }
      }
  throw new Error('no repair spot');
}

describe('optional rules (Play Book 18)', () => {
  it('lists every optional rule 18.1-18.9', () => {
    expect(OPTIONAL_RULES.map((r) => r.rule)).toEqual(['18.1', '18.2', '18.3', '18.4', '18.5', '18.6', '18.7', '18.8', '18.9']);
  });

  it('18.1: the Germans repair at most six bridges', () => {
    const g = newGame(3, { bridgeLimit: true });
    expect(g.bridgesLeft).toBe(6);
    const s = repairSpot(g);
    const t = clone(g);
    t.phase = 'admin';
    t.blown = [keyOf(s.a, s.n)];
    chit(t, s.c).box = 'available';
    repairBridge(t, s.c, s.a, s.n);
    expect(t.bridgesLeft).toBe(5);
    const u = clone(g);
    u.phase = 'admin';
    u.bridgesLeft = 0;
    u.blown = [keyOf(s.a, s.n)];
    chit(u, s.c).box = 'available';
    expect(() => repairBridge(u, s.c, s.a, s.n)).toThrow(/six bridges/);
    const off = newGame(3);
    off.phase = 'admin';
    off.blown = [keyOf(s.a, s.n)];
    chit(off, s.c).box = 'available';
    repairBridge(off, s.c, s.a, s.n);
    expect(off.bridgesLeft).toBeUndefined();
  });

  it('18.2: a positive bid adds bid fuel that is eliminated when spent; a negative bid moves fuel to the Used Box', () => {
    const base = boxOf(newGame(3), 'german', 'available').filter((c) => c.kind === 'fuel').length;
    const g = newGame(3, { bid: 3 });
    const bids = g.chits.filter((c) => c.bid);
    expect(bids.length).toBe(3);
    expect(bids.every((c) => c.box === 'available' && c.kind === 'fuel')).toBe(true);
    const n = newGame(3, { bid: -2 });
    expect(boxOf(n, 'german', 'available').filter((c) => c.kind === 'fuel').length).toBe(base - 2);
    expect(boxOf(n, 'german', 'used').filter((c) => c.kind === 'fuel').length).toBe(2);
    // a German move that needs fuel spends the bid asset first, and it goes to the Eliminated Box
    g.phase = 'movement';
    g.turn = 2;
    for (const u of g.units.filter((x) => x.side === 'german' && x.area != null && !x.garrison)) {
      const o = moveOptions(g, u.id).find((x) => x.fuel);
      if (!o) continue;
      move(g, u.id, o.area);
      if (g.pendingBlow) continue;
      expect(g.chits.filter((c) => c.bid && c.box === 'eliminated').length).toBe(1);
      return;
    }
    throw new Error('no fuel move found');
  });

  it('18.3: Peiper, exploiting in Breakthrough Movement up to turn 3, may use its full movement once', () => {
    const g = newGame(4, { peiper: true }),
      p = g.units.find((u) => u.name === 'Peiper')!;
    for (const a of mustFight(g)) g.fought.push(a);
    g.phase = 'btMove';
    g.turn = 2;
    p.exploit = true;
    p.moved = false;
    p.reserve = null;
    const one = moveOptions(g, p.id);
    expect(one.every((o) => o.path.length === 2)).toBe(true);
    expect(peiperCan(g, p)).toBe(true);
    setPeiperFull(g, p.id, true);
    const full = moveOptions(g, p.id);
    expect(full.length).toBeGreaterThanOrEqual(one.length);
    const far = full.find((o) => o.path.length > 2) ?? full[0];
    move(g, p.id, far.area);
    if (!g.pendingBlow) {
      expect(g.peiperUsed).toBe(true);
      expect(peiperCan(g, p)).toBe(false);
    }
    const late = newGame(4, { peiper: true }),
      q = late.units.find((u) => u.name === 'Peiper')!;
    late.phase = 'btMove';
    late.turn = 4;
    q.exploit = true;
    expect(() => setPeiperFull(late, q.id, true)).toThrow(/18.3/);
  });

  it('18.4: in its first battle the 150th is the point unit, then the American point unit checks morale (+2)', () => {
    const g = newGame(5, { pz150: true }),
      pz = g.units.find((u) => u.name === '150 Pz')!;
    const area =
      mustFight(g).find((a) => unitsIn(g, a, 'german').some((u) => u.id === pz.id)) ??
      (() => {
        const a = mustFight(g)[0];
        pz.area = a;
        return a;
      })();
    const b = startBattle(g, area);
    expect(b.attPoint).toBe(pz.id);
    const other = unitsIn(g, area, 'german').find((u) => u.id !== pz.id && !u.garrison);
    if (b.defSA) passSA(g, b);
    setReady(g, b, 'german');
    setReady(g, b, 'allied'); // 6.24: the Attacker's point unit comes last
    if (other) expect(() => setPoint(g, b, 'german', other.id)).toThrow(/18.4/);
    g.force = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10]; // artillery misses, then the morale check fails (10)
    beginCombat(g, b);
    expect(g.pz150Done).toBe(true);
    for (let i = 0; i < 6 && (b.stage === 'attArty' || b.stage === 'defArty'); i++) roll_step(g, b);
    const am = g.units.find((u) => u.id === b.defPoint)!;
    expect(g.log.some((l) => /18\.4/.test(l) && /morale/.test(l))).toBe(true);
    expect(am.disorder === 1 || am.id.startsWith('DR-') || am.garrison).toBeTruthy();
  });

  it('18.7: defending artillery left in a vacated area may be overrun', () => {
    const g = newGame(6, { overrun: true });
    g.phase = 'combat';
    const area = mustFight(g)[0],
      b = startBattle(g, area);
    const art = g.chits.find((c) => c.side === 'allied' && c.kind === 'artillery' && c.box !== 'eliminated')!;
    art.box = 'map';
    b.assets.allied.push(art.id);
    beginCombat(g, b);
    for (const u of unitsIn(g, area, 'allied')) {
      u.area = null;
      u.str = 0;
    } // the defenders are destroyed (2 + unabsorbed hits)
    b.queue = [];
    b.stage = 'offFire';
    g.force = Array(30).fill(1); // offensive fire finds no defenders left; the overrun roll (a 1) destroys the asset
    roll_step(g, b);
    expect(g.log.some((l) => /overrunning artillery: .* is destroyed/.test(l))).toBe(true);
    expect(art.box).toBe('eliminated');
  });

  it('18.8: field works in a contested area stay unless the owner fails a morale check in his own Supply Phase', () => {
    const g = newGame(7, { fwMaintain: true });
    const a = g.fieldWorks.find((x) => contested(g, x))!;
    expect(a).toBeTruthy();
    const owner = g.fwOwner[a];
    for (const x of mustFight(g)) g.fought.push(x);
    g.phasing = owner === 'german' ? 'allied' : 'german';
    g.phase = 'btCombat';
    g.force = Array(40).fill(10);
    endPhase(g);
    expect(g.phase).toBe('supply');
    expect(g.fieldWorks.includes(a)).toBe(true); // not the owner's Supply Phase: untouched
    const h = newGame(7, { fwMaintain: true });
    for (const x of mustFight(h)) h.fought.push(x);
    h.phasing = owner;
    h.phase = 'btCombat';
    h.force = Array(40).fill(1);
    endPhase(h);
    expect(h.fieldWorks.includes(a)).toBe(true);
    expect(h.log.some((l) => /maintained \(18\.8\)/.test(l))).toBe(true);
    const k = newGame(7, { fwMaintain: true });
    for (const x of mustFight(k)) k.fought.push(x);
    k.phasing = owner;
    k.phase = 'btCombat';
    k.force = Array(40).fill(10);
    endPhase(k);
    expect(k.fieldWorks.includes(a)).toBe(false);
    const off = newGame(7);
    for (const x of mustFight(off)) off.fought.push(x);
    off.phasing = owner;
    off.phase = 'btCombat';
    endPhase(off);
    expect(off.fieldWorks.includes(a)).toBe(false); // without the rule: removed automatically
  });

  it('18.9: random reinforcements draw from the units due now and next turn', () => {
    let changed = false;
    for (let seed = 1; seed < 12 && !changed; seed++) {
      const g = newGame(seed, { scenario: 'campaign', randomReinf: true }),
        plain = newGame(seed, { scenario: 'campaign' });
      for (const x of [g, plain]) {
        x.phase = 'supply';
        x.phasing = 'allied';
        x.supplyPending = false;
        x.turn = 2;
        x.contestedAtMoveStart = [];
      }
      endPhase(g);
      endPhase(plain);
      const a = [...g.pendingArrivals].sort().join(),
        b = [...plain.pendingArrivals].sort().join();
      expect(g.pendingArrivals.length).toBe(plain.pendingArrivals.length);
      if (a !== b) changed = true;
    }
    expect(changed).toBe(true);
  });
});
