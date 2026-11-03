/** Undo for the game state. Each action stores only what it changed (top-level fields, and units/chits one by one), so an undo
 *  survives the other player's writes as long as they did not touch the same things. Actions that show hidden information or
 *  roll dice lock everything before them, with the reason. */
type Rec = Record<string, unknown>;
interface Change { key: string; id?: string; old: string | undefined; now: string | undefined }
interface Entry { label: string; changes: Change[] }
const LISTS = ['units', 'chits'];          // arrays of objects with an `id`: diffed per element
const SKIP = new Set(['log']);             // append-only text: never undone (a line notes the undo)
/** JSON with object keys sorted: a game that went through the shared copy comes back with the same values in another key order. */
const norm = (v: unknown): unknown => (Array.isArray(v) ? v.map(norm) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => [k, norm((v as Record<string, unknown>)[k])])) : v);
const js = (v: unknown) => (v === undefined ? undefined : JSON.stringify(norm(v)));

function parts(g: Rec) {
  const m = new Map<string, string | undefined>();
  for (const k of Object.keys(g)) {
    if (SKIP.has(k)) continue;
    if (LISTS.includes(k) && Array.isArray(g[k])) for (const x of g[k] as Rec[]) m.set(`${k}\u0000${x.id}`, js(x));
    else m.set(k, js(g[k]));
  }
  return m;
}
function diff(a: Map<string, string | undefined>, b: Map<string, string | undefined>): Change[] {
  const out: Change[] = [];
  for (const p of new Set([...a.keys(), ...b.keys()])) {
    const o = a.get(p), n = b.get(p); if (o === n) continue;
    const [key, id] = p.split('\u0000'); out.push({ key, id, old: o, now: n });
  }
  return out;
}

export class History<G extends { rolls: number }> {
  private stack: Entry[] = [];
  /** Why older actions can no longer be undone ('' when nothing locked them). */
  lock = '';
  private busy = false;
  constructor(private limit = 60) {}
  get length() { return this.stack.length; }
  /** What the next undo would take back. */
  get label() { return this.stack.at(-1)?.label ?? ''; }
  clear(reason = '') { this.stack = []; this.lock = reason; }
  /** Run `f` on `g`. On an error the game is restored and the error returned. `lockOf(before, after)` names a reveal that locks undo. */
  run(g: G, f: () => void, label: string | ((before: G, after: G) => string) = '', lockOf?: (a: G, b: G) => string): { game: G; error?: Error } {
    if (this.busy) { f(); return { game: g }; }               // an action started inside another one belongs to it
    const snap = JSON.stringify(g), r0 = g.rolls;
    this.busy = true; try { f(); } catch (e) { return { game: JSON.parse(snap), error: e as Error }; } finally { this.busy = false; }
    const before = JSON.parse(snap) as G, why = g.rolls !== r0 ? 'dice rolled' : lockOf?.(before, g) ?? '';
    if (why) { this.clear(why); return { game: g }; }
    const changes = diff(parts(before as unknown as Rec), parts(g as unknown as Rec));
    if (changes.length) { this.stack.push({ label: typeof label === 'function' ? label(before, g) : label, changes }); this.lock = ''; if (this.stack.length > this.limit) this.stack.shift(); }
    return { game: g };
  }
  /** Another browser wrote `g`: keep the undo unless it rolled dice or `lockOf` names a reveal. */
  remote(prev: G, g: G, lockOf?: (a: G, b: G) => string) {
    const why = g.rolls !== prev.rolls ? 'dice rolled' : lockOf?.(prev, g) ?? ''; if (why) this.clear(why);
  }
  /** Take back the last action on `g`. Returns null with a reason when nothing can be undone or the other player changed the same things. */
  undo(g: G): { game: G | null; why?: string } {
    const e = this.stack.at(-1); if (!e) return { game: null, why: this.lock ? `Locked: ${this.lock}` : 'Nothing to undo' };
    const cur = parts(g as unknown as Rec);
    if (e.changes.some((c) => cur.get(c.id ? `${c.key}\u0000${c.id}` : c.key) !== c.now)) { this.clear('the other player changed the same pieces'); return { game: null, why: 'Cannot undo: the other player changed the same pieces' }; }
    this.stack.pop();
    const out = JSON.parse(JSON.stringify(g)) as Rec;
    for (const c of e.changes) {
      const val = c.old === undefined ? undefined : JSON.parse(c.old);
      if (!c.id) { if (val === undefined) delete out[c.key]; else out[c.key] = val; continue; }
      const list = out[c.key] as Rec[], i = list.findIndex((x) => String(x.id) === c.id);
      if (val === undefined) { if (i >= 0) list.splice(i, 1); } else if (i >= 0) list[i] = val; else list.push(val);
    }
    return { game: out as unknown as G };
  }
}
