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
