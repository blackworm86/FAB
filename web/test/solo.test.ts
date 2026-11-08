// Games against the computer kept on the device: when the browser storage fills up, old replay journals make room, and the game itself is kept.
import { beforeEach, describe, expect, it } from 'vitest';

/** A browser storage with a size limit (in characters, like the real one), that throws when it is full. */
const mem = new Map<string, string>(); let LIMIT = 1e9;
const used = () => [...mem].reduce((t, [k, v]) => t + k.length + v.length, 0);
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null, removeItem: (k: string) => { mem.delete(k); },
    setItem: (k: string, v: string) => { const before = mem.get(k); mem.set(k, String(v)); if (used() > LIMIT) { if (before == null) mem.delete(k); else mem.set(k, before); throw new Error('QuotaExceededError'); } },
  },
});
const S = await import('../src/solo');
const game = (id: string, updated: number) => { S.putLocalMeta({ id, game: 'bulge', cpu: 'german', title: id, scenario: 'tournament', created: updated, updated, rev: 1, turn: 1, step: 'combat' }); mem.set(S.soloKey(id), 'g'.repeat(1000)); mem.set(`fab-journal:${S.soloKey(id)}`, 'j'.repeat(5000)); };

describe('games against the computer: browser storage', () => {
  beforeEach(() => { mem.clear(); LIMIT = 1e9; });
  it('a new game keeps the replays of the few most recent games only; every game itself stays', () => {
    for (let i = 1; i <= 7; i++) game(`s${i}`, i);
    S.pruneJournals(4, 's7');
    const journals = [...mem.keys()].filter((k) => k.startsWith('fab-journal:')).sort();
    expect(journals).toEqual(['fab-journal:fab-solo-s4', 'fab-journal:fab-solo-s5', 'fab-journal:fab-solo-s6', 'fab-journal:fab-solo-s7']);
    for (let i = 1; i <= 7; i++) expect(mem.has(S.soloKey(`s${i}`))).toBe(true);
  });
  it('when the storage is full, a save drops old replays and still stores the game', () => {
    for (let i = 1; i <= 4; i++) game(`s${i}`, i);
    LIMIT = used() + 500;                                                                          // nearly full
    expect(S.storeSafe(S.soloKey('s4'), 'x'.repeat(3000), 's4')).toBe(true);                     // bigger than the room left: the other games' replays go
    expect(mem.get(S.soloKey('s4'))).toBe('x'.repeat(3000));
    expect(mem.has('fab-journal:fab-solo-s1')).toBe(false); expect(mem.has(S.soloKey('s1'))).toBe(true);
  });
  it('and says so when even that is not enough', () => {
    game('s1', 1); LIMIT = used() + 10;
    expect(S.storeSafe(S.soloKey('s1'), 'x'.repeat(50000), 's1')).toBe(false);
  });
});

describe('games against the computer: the account copy', () => {
  const meta = { id: 's1', game: 'bulge', cpu: 'german', title: 't', scenario: 'tournament', created: 1, updated: 2, rev: 7, turn: 3, step: 'combat' };
  it('a save cut off between the list entry and the position counts as the revision the position holds', () => {
    expect(S.accountMeta(meta, 6).rev).toBe(6);                                                    // entry says 7, the position is still 6
    expect(S.accountMeta(meta, 7)).toBe(meta);
    expect(S.accountMeta(meta, undefined)).toBe(meta);                                             // saved before positions carried their revision
  });
});
