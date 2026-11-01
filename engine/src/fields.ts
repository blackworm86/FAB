/** The shared game as many small values, so that a move writes only what it changed (Realtime Database): every top-level field of the game is one JSON string,
 *  and each block and chit is one JSON string of its own under its position. Two players changing different blocks never overwrite each other. */
import type { Game } from './game';

export interface Tree { f: Record<string, string>; units: Record<string, string>; chits: Record<string, string> }
const pad = (i: number) => String(i).padStart(4, '0');
const LISTS = ['units', 'chits'] as const;

export function toTree(g: Game): Tree {
  const t: Tree = { f: {}, units: {}, chits: {} };
  for (const [k, v] of Object.entries(g)) if (!(LISTS as readonly string[]).includes(k) && v !== undefined) t.f[k] = JSON.stringify(v);
  g.units.forEach((u, i) => { t.units[pad(i)] = JSON.stringify(u); });
  g.chits.forEach((c, i) => { t.chits[pad(i)] = JSON.stringify(c); });
  return t;
}
export function fromTree(t: Partial<Tree>): Game {
  const g: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(t.f ?? {})) g[k] = JSON.parse(v);
  for (const l of LISTS) g[l] = Object.keys(t[l] ?? {}).sort().map((k) => JSON.parse((t[l] as Record<string, string>)[k]));
  return g as unknown as Game;
}
/** The writes that turn `prev` into `next`, as a multi-path update ('f/phase', 'units/0012'); null removes a path. */
export function diffTree(prev: Tree | null, next: Tree): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const sec of ['f', ...LISTS] as const) {
    const a = prev?.[sec] ?? {}, b = next[sec];
    for (const [k, v] of Object.entries(b)) if (a[k] !== v) out[`${sec}/${k}`] = v;
    for (const k of Object.keys(a)) if (!(k in b)) out[`${sec}/${k}`] = null;
  }
  return out;
}
