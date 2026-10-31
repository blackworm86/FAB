/** What one seat may see of the full game: hidden enemy blocks (6.24) lose their identity, their strength and their quality, and get an opaque id.
 *  Dice are secret too. The same state, redacted for the other seat, goes to the other player; the full state never leaves the server. */
import { visibleTo, type Game, type Side, type Unit } from './game';

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
/** Opaque, stable id for a block: only the server knows the salt, so the alias says nothing about the block. */
export const alias = (salt: string, id: string) => 'h' + hash(salt + id) + hash(id + salt);

export type Viewer = Side | 'spectator';
const quote = (s: string) => JSON.stringify(s);

export function redactFor(full: Game, viewer: Viewer, salt: string): Game {
  const hidden = full.units.filter((u) => !visibleTo(full, u, viewer));
  const real = new Map(hidden.map((u) => [u.id, alias(salt, u.id)]));
  const names = hidden.map((u) => u.name).filter((n) => n.length > 2).sort((a, b) => b.length - a.length);
  let json = JSON.stringify(full);
  for (const [id, al] of real) json = json.split(quote(id)).join(quote(al));                          // ids appear as values and as keys, so replace the quoted token everywhere
  const g = JSON.parse(json) as Game;
  for (const u of g.units) {
    if (![...real.values()].includes(u.id)) continue;
    const blank: Partial<Unit> = { name: 'Hidden block', cls: 'infantry', q: ['green'], max: 1, str: 1, code: '', symbol: 'inf', ech: '', entry: undefined, arrival: undefined, chitId: undefined, from: undefined };
    Object.assign(u, blank);
  }
  if (g.battle && viewer !== 'spectator' && g.battle.stage === 'setup') { if (viewer === g.battle.attacker) g.battle.defPoint = ''; else g.battle.attPoint = ''; }   // the other point unit stays secret until both are designated
  g.seed = 0;
  g.log = g.log.map((l) => names.reduce((t, n) => t.split(n).join('a hidden block'), l));
  return g;
}

/** Turns the ids a client sends back into real ones. */
export function unalias(full: Game, salt: string, value: unknown): unknown {
  const map = new Map(full.units.map((u) => [alias(salt, u.id), u.id]));
  const walk = (v: unknown): unknown => (typeof v === 'string' ? map.get(v) ?? v : Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v);
  return walk(value);
}
