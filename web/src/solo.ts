/** Games against the computer (4.4), kept on this device and, when the player is signed in, in their account (users/{uid}/soloIndex + solo/{id}).
 *  This file is the device side: an index of the device's games (`fab-solo-index`), each game under `fab-solo-<id>`. The account side is in store-rtdb.ts. */

/** What the game lists show of a game against the computer, without opening it. `rev` counts saves; `base` is the account's rev this device last saw. */
export interface SoloMeta {
  id: string; game: string; cpu: string; title: string; scenario: string; created: number; updated: number; rev: number;
  turn: number; step: string; over?: string; level?: 'easy' | 'normal' | 'hard';
  /** device only: the account this copy belongs to ('' = played signed out), and the account rev it was last in step with */
  owner?: string; base?: number;
}
const INDEX = 'fab-solo-index';
export const soloKey = (id: string) => `fab-solo-${id}`;
export const newSoloId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const readIndex = (): Record<string, SoloMeta> => { try { return JSON.parse(localStorage.getItem(INDEX) ?? '{}'); } catch { return {}; } };
const writeIndex = (x: Record<string, SoloMeta>) => { try { localStorage.setItem(INDEX, JSON.stringify(x)); } catch { /* storage off */ } };
export const localMeta = (id: string): SoloMeta | null => readIndex()[id] ?? null;
export const localList = (): SoloMeta[] => Object.values(readIndex()).sort((a, b) => b.updated - a.updated);
export function putLocalMeta(m: SoloMeta) { const x = readIndex(); x[m.id] = m; writeIndex(x); }
export function localGame(id: string): string | null { try { return localStorage.getItem(soloKey(id)); } catch { return null; } }
export function dropLocal(id: string) { const x = readIndex(); delete x[id]; writeIndex(x); try { localStorage.removeItem(soloKey(id)); localStorage.removeItem(`fab-journal:${soloKey(id)}`); } catch { /* storage off */ } }

/** The list fields of a game, read from the game itself. */
export function metaOf(g: { game?: string; turn: number; phase: string; over?: string; opts: { scenario: string } }, base: Pick<SoloMeta, 'id' | 'cpu' | 'title' | 'created'> & Partial<SoloMeta>): SoloMeta {
  return { ...base, game: g.game ?? 'bulge', scenario: g.opts.scenario, updated: Date.now(), rev: base.rev ?? 0, turn: g.turn, step: g.phase, ...(g.over ? { over: g.over } : {}) } as SoloMeta;
}
/** The address of a game against the computer. */
export const soloUrl = (m: { id: string; game: string; cpu: string }) => `${location.pathname}?cpu=${m.cpu}${m.game !== 'bulge' ? `&game=${m.game}` : ''}&solo=${m.id}`;

/** The first version kept one game per volume (`fab-cpu`, `fab-cpu-<game>`): give each an id in the index. */
export function migrateOld(name: (game: string, scenario: string) => string, sides: (game: string) => [string, string] | undefined) {
  for (const game of ['bulge', 'golan73', 'sicily']) {
    const key = game === 'bulge' ? 'fab-cpu' : `fab-cpu-${game}`; let s: string | null = null; try { s = localStorage.getItem(key); } catch { return; }
    if (!s) continue;
    try {
      const g = JSON.parse(s), sd = sides(game); if (!sd) continue;
      const id = newSoloId(), cpu = sd[0];                                                                  // the old card put the player on the second side by default
      localStorage.setItem(soloKey(id), s); const j = localStorage.getItem(`fab-journal:${key}`); if (j) localStorage.setItem(`fab-journal:${soloKey(id)}`, j);
      putLocalMeta(metaOf(g, { id, cpu, title: name(game, g.opts?.scenario ?? ''), created: Date.now(), owner: '' }));
      localStorage.removeItem(key); localStorage.removeItem(`fab-journal:${key}`);
    } catch { /* an unreadable old game: leave it */ }
  }
}

/** Browser storage is small (about 5 MB a site): keep the replay journals of the `keep` most recent games against the computer only
 *  (each is 0.2–0.3 MB; the games themselves stay). Returns how many journals it dropped. */
export function pruneJournals(keep = 4, except?: string): number {
  const old = localList().filter((m) => m.id !== except).slice(Math.max(0, keep - (except ? 1 : 0)));
  let n = 0; for (const m of old) { try { if (localStorage.getItem(`fab-journal:${soloKey(m.id)}`) != null) { localStorage.removeItem(`fab-journal:${soloKey(m.id)}`); n++; } } catch { /* storage off */ } }
  return n;
}
/** Write a value; when the storage is full, drop the oldest games' replay journals and try once more. False: it could not be stored. */
export function storeSafe(key: string, value: string, id?: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { /* full, or storage off */ }
  try { pruneJournals(1, id); localStorage.setItem(key, value); return true; } catch { return false; }
}
/** The account's copy as it really is: the list entry is written first and the position after it, so a save cut off in between (a phone put
 *  away mid-save) leaves an entry one revision ahead of the position it holds. The position's own revision is the one that counts. */
export const accountMeta = (meta: SoloMeta, stateRev: number | undefined): SoloMeta => (stateRev == null || stateRev === meta.rev ? meta : { ...meta, rev: stateRev });
/** Once the account's copy is loaded (`account`: its rev, null if the account has none): 'take' it, 'push' this device's copy, 'ask' the
 *  player (moved on both sides), or the game is 'gone' (opened from the account list, `waiting`, but no longer there). */
export function syncChoice(local: Pick<SoloMeta, 'rev' | 'base'> | null, account: number | null, waiting: boolean): 'take' | 'push' | 'ask' | 'gone' {
  if (account == null) return waiting ? 'gone' : 'push';
  const dirty = !!local && local.rev !== local.base;
  if (waiting || (account !== local?.base && !dirty)) return 'take';
  return account === local!.base ? 'push' : 'ask';
}
