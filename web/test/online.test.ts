// Two seats of the split protocol through online.ts and the stand-in store: what one seat pushes, the other rebuilds without seeing the hidden blocks.
import { describe, expect, it, vi } from 'vitest';
import * as E from '../../engine/src';

type Online = typeof import('../src/online');
const mem = new Map<string, string>();
const win = new EventTarget();
class StorageEv extends Event { key: string | null; constructor(t: string, init?: { key?: string }) { super(t); this.key = init?.key ?? null; } }
Object.assign(globalThis, {
  window: win, StorageEvent: StorageEv,
  localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, String(v)); }, removeItem: (k: string) => { mem.delete(k); } },
  location: { search: '' },
});
/** One browser tab: its own copy of online.ts, seated on `side` of the fake table. */
async function tab(side: 'german' | 'allied') {
  (globalThis as { location: { search: string } }).location.search = `?dev=1&fake=${side}`;
  vi.resetModules();
  const O: Online = await import('../src/online');
  let g: E.Game | null = null;
  await O.startOnline((x) => { g = x; }, () => undefined);
  return { O, get g() { return g!; } };
}
describe('online: two seats on one table', () => {
  it('a move pushed by one seat reaches the other with the hidden blocks still hidden', async () => {
    mem.clear();
    const A = await tab('german'), B = await tab('allied');
    expect(A.O.online.mode).toBe('remote'); expect(A.O.online.mySide()).toBe('german'); expect(B.O.online.mySide()).toBe('allied');
    expect(A.g.units.filter((u) => u.side === 'german').every((u) => !E.isPlaceholder(u))).toBe(true);        // my own blocks are whole on my side
    expect(A.g.units.some((u) => u.side === 'allied' && E.isPlaceholder(u))).toBe(true);                       // the other side's hidden blocks are not
    const gA = JSON.parse(JSON.stringify(A.g)) as E.Game, mine = gA.units.find((u) => u.side === 'german' && u.area != null && !u.garrison)!;
    mine.disorder = 1; gA.log.push('T1 German: a test change');
    await A.O.push(gA);
    expect(B.g.units.find((u) => u.id === mine.id)).toBeUndefined();                                            // B never learns the id of A's hidden block
    expect(B.g.log.at(-1)).toContain('a test change');
    expect(B.g.units.filter((u) => u.side === 'allied').every((u) => !E.isPlaceholder(u))).toBe(true);
    const gB = JSON.parse(JSON.stringify(B.g)) as E.Game, theirs = gB.units.find((u) => u.side === 'allied' && u.area != null && !u.garrison)!;
    theirs.disorder = 2; await B.O.push(gB);
    expect(A.g.units.find((u) => u.id === mine.id)!.disorder).toBe(1);                                          // A's own change survived B's write
    expect(A.g.units.find((u) => u.id === theirs.id)).toBeUndefined();
    expect(A.g.units.filter((u) => u.side === 'allied' && u.disorder === 2)).toHaveLength(1);                   // and B's change arrived as a placeholder
  });
});
