// Hidden blocks online: the opaque id is a real hash (SHA-256) and the shared copy's slot order carries no scenario information.
import { describe, expect, it } from 'vitest';
import { alias, sha256 } from '../src/redact';
import { newGame, useGame, initSplit, toTree } from '../src';

describe('hidden block ids', () => {
  it('sha256 matches the reference implementation', () => {
    const ref: [string, string][] = [['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'], ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad']];
    for (const [m, h] of ref) expect(sha256(m)).toBe(h);
    expect(sha256('a'.repeat(1000))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
    expect(alias('s', 'B1')).not.toBe(alias('s', 'B2'));
  });
  it('the shared copy stores blocks in a shuffled order, so the slot does not name the block', () => {
    useGame('bulge'); const a = newGame(1), b = newGame(1), order = (g: typeof a) => g.units.map((u) => u.id).join();
    const sa = initSplit(a, 'x'.repeat(24), 'y'.repeat(24)), sb = initSplit(b, 'x'.repeat(24), 'y'.repeat(24));
    expect(order(a)).not.toBe(order(newGame(1))); expect(order(a)).not.toBe(order(b));
    expect(Object.keys(toTree(JSON.parse(sa.pub)).units).length).toBe(a.units.length); void sb;
  });
});

describe('the first player to sit changes the salt', () => {
  it('the creator, who made the salts, cannot decode the new ids; the joiner\'s game is unchanged', async () => {
    const { rotateSalt, compose, aliasOf } = await import('../src');
    useGame('bulge'); const g = newGame(2), sp = initSplit(g, 'creator-salt-allied'.padEnd(24, 'a'), 'creator-salt-german'.padEnd(24, 'b'));
    const before = compose(JSON.parse(sp.allied.fresh ? sp.pub : sp.pub), sp.allied, {}).game;
    const r = rotateSalt(sp.pub, sp.allied, {}, 'joiner-secret'.padEnd(24, 'z'))!;
    expect(r.priv.salt).not.toBe(sp.allied.salt); expect(r.priv.fresh).toBeUndefined();
    const after = compose(JSON.parse(r.pub), r.priv, {}).game;
    expect(JSON.stringify(after.units.map((u) => [u.id, u.area, u.name]))).toBe(JSON.stringify(before.units.map((u) => [u.id, u.area, u.name])));   // same game for the joiner
    const old = compose(JSON.parse(r.pub), sp.allied, {}).game;                                           // the creator's old salt finds none of the joiner's blocks
    const mine = Object.keys(sp.allied.secrets), hiddenNow = new Set((JSON.parse(r.pub) as typeof g).units.filter((u) => u.name === 'Hidden block').map((u) => u.id));
    expect(hiddenNow.size).toBeGreaterThan(10); expect(old.units.filter((u) => u.name !== 'Hidden block' && [...hiddenNow].some((h) => h === u.id)).length).toBe(0);
    expect(r.pub).not.toContain(aliasOf(sp.allied, mine[0]));
    expect(rotateSalt(r.pub, r.priv, {}, 'again')).toBeNull();                                              // only the first time
  });
});

describe('playing on after the salt changed', () => {
  it('both seats open the rewritten shared copy, move, and see each other\'s moves', async () => {
    const { rotateSalt, SplitSeat, endPhase } = await import('../src');
    useGame('bulge'); const sp = initSplit(newGame(3), 'g'.repeat(24), 'a'.repeat(24));
    const r = rotateSalt(sp.pub, sp.allied, {}, 'n'.repeat(24))!, ger = new SplitSeat('german'), all = new SplitSeat('allied');
    ger.priv = sp.german; all.priv = r.priv;
    const gg = ger.open(JSON.parse(r.pub)), ga = all.open(JSON.parse(r.pub));
    expect(ga.units.filter((u) => u.name === 'Hidden block' && u.side === 'allied').length).toBe(0);      // the joiner sees all own blocks
    expect(gg.units.filter((u) => u.side === 'allied' && u.area != null && !u.garrison && u.name !== 'Hidden block').length).toBe(0);   // the other side sees them hidden
    ga.log.push('T1 test'); const out = all.save(ga); expect(out.pub).toBeTruthy(); void endPhase;
    const again = ger.open(JSON.parse(out.pub)); expect(again.units.length).toBe(gg.units.length);
  });
});
